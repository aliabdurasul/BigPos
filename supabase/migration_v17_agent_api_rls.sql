-- ============================================================
-- MIGRATION v17: Production-Grade Agent API + RLS Hardening
--
-- WHAT THIS DOES:
-- 1. Replaces wide-open "FOR ALL USING (true)" policies on all
--    printer/agent tables with tenant-scoped policies using
--    the current_tenant_id() helper from v15.
-- 2. Removes broken v14 "deny_install_tokens" policy.
-- 3. Adds SECURITY DEFINER helper RPCs used only by Edge Functions:
--      register_agent_with_token()  - atomic token->agent exchange
--      verify_agent_token()         - agent auth on every request
--      agent_heartbeat_update()     - heartbeat + status update
--      expire_install_tokens()      - scheduled cleanup
-- 4. Revokes browser (anon/authenticated) access to those RPCs.
--    Edge Functions run as service_role, bypassing RLS + REVOKE.
--
-- IDEMPOTENT: Safe to run multiple times.
-- REQUIRES:   v15 migration applied (current_tenant_id, active_sessions).
-- ============================================================

-- 0. Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ensure current_tenant_id() exists (idempotent copy from v15)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT NULLIF(current_setting('app.current_restaurant_id', true), '')::uuid;
$$;

-- 2. Ensure active_sessions.expires_at exists (from v16)
ALTER TABLE active_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz
    NOT NULL DEFAULT (now() + interval '30 days');

-- ─── 3. FIX RLS ON PRINTER / AGENT TABLES ────────────────────────

-- Remove all old wide-open v13 policies
DROP POLICY IF EXISTS "agents_all"           ON restaurant_agents;
DROP POLICY IF EXISTS "install_tokens_all"   ON agent_install_tokens;
DROP POLICY IF EXISTS "printers_all"         ON printers;
DROP POLICY IF EXISTS "routes_all"           ON printer_category_routes;
DROP POLICY IF EXISTS "print_jobs_all"       ON print_jobs;
DROP POLICY IF EXISTS "agent_commands_all"   ON agent_commands;

-- Remove v14 broken / overly broad policies
DROP POLICY IF EXISTS "deny_install_tokens"       ON agent_install_tokens;
DROP POLICY IF EXISTS "restaurant_agents_tenant"  ON restaurant_agents;

-- Remove prior v17 policies for full idempotency
DROP POLICY IF EXISTS "printers_tenant"               ON printers;
DROP POLICY IF EXISTS "printer_routes_tenant"         ON printer_category_routes;
DROP POLICY IF EXISTS "print_jobs_tenant_select"      ON print_jobs;
DROP POLICY IF EXISTS "agents_tenant_select"          ON restaurant_agents;
DROP POLICY IF EXISTS "install_tokens_no_browser"     ON agent_install_tokens;
DROP POLICY IF EXISTS "agent_commands_tenant_select"  ON agent_commands;

-- printers: full tenant-scoped CRUD (admin manages via UI)
CREATE POLICY "printers_tenant" ON printers
  FOR ALL
  USING  (restaurant_id = current_tenant_id())
  WITH CHECK (restaurant_id = current_tenant_id());

-- printer_category_routes: full tenant-scoped CRUD
CREATE POLICY "printer_routes_tenant" ON printer_category_routes
  FOR ALL
  USING  (restaurant_id = current_tenant_id())
  WITH CHECK (restaurant_id = current_tenant_id());

-- print_jobs: tenant READ only (UI status display)
--   INSERT via enqueue_print_job() SECURITY DEFINER RPC
--   UPDATE via complete_print_job() SECURITY DEFINER RPC (agent via service_role)
CREATE POLICY "print_jobs_tenant_select" ON print_jobs
  FOR SELECT
  USING (restaurant_id = current_tenant_id());

-- restaurant_agents: tenant READ only (admin status page)
--   INSERT/UPDATE via register-agent / agent-heartbeat Edge Functions
CREATE POLICY "agents_tenant_select" ON restaurant_agents
  FOR SELECT
  USING (restaurant_id = current_tenant_id());

-- agent_install_tokens: ZERO browser access.
--   create-install-token Edge Function uses service_role (bypasses this).
CREATE POLICY "install_tokens_no_browser" ON agent_install_tokens
  FOR ALL USING (false);

-- agent_commands: tenant READ only from browser
CREATE POLICY "agent_commands_tenant_select" ON agent_commands
  FOR SELECT
  USING (restaurant_id = current_tenant_id());

-- ─── 4. SECURITY DEFINER HELPER RPCs ─────────────────────────────
-- Called exclusively by Edge Functions (service_role).
-- Revoked from anon + authenticated roles in section 5.

-- 4a. register_agent_with_token
--     Validates install token, creates agent record atomically.
--     Returns permanent agent_token (PLAINTEXT, shown ONCE -- never stored).
DROP FUNCTION IF EXISTS public.register_agent_with_token(text,text,text,text);
CREATE OR REPLACE FUNCTION public.register_agent_with_token(
  p_token    text,
  p_hostname text DEFAULT NULL,
  p_local_ip text DEFAULT NULL,
  p_version  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash       text;
  v_token_rec  agent_install_tokens%ROWTYPE;
  v_agent_id   uuid;
  v_perm_token text;
  v_perm_hash  text;
BEGIN
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_token_rec
  FROM agent_install_tokens
  WHERE token_hash = v_hash
    AND status     = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_or_expired_token');
  END IF;

  -- Permanent agent token: 32 random bytes, stored only as SHA-256 hash
  v_perm_token := encode(gen_random_bytes(32), 'hex');
  v_perm_hash  := encode(digest(v_perm_token, 'sha256'), 'hex');

  INSERT INTO restaurant_agents (
    restaurant_id, agent_token_hash, token_hint,
    hostname, local_ip, agent_version, status, last_seen_at
  ) VALUES (
    v_token_rec.restaurant_id,
    v_perm_hash,
    right(v_perm_token, 6),
    p_hostname, p_local_ip, p_version,
    'active', now()
  )
  RETURNING id INTO v_agent_id;

  -- One-time use: mark install token consumed
  UPDATE agent_install_tokens
  SET status = 'used'
  WHERE id = v_token_rec.id;

  RETURN jsonb_build_object(
    'agent_id',      v_agent_id,
    'agent_token',   v_perm_token,
    'restaurant_id', v_token_rec.restaurant_id
  );
END;
$$;

-- 4b. verify_agent_token
--     Used by every agent-facing Edge Function for request authentication.
DROP FUNCTION IF EXISTS public.verify_agent_token(text);
CREATE OR REPLACE FUNCTION public.verify_agent_token(p_token text)
RETURNS TABLE (agent_id uuid, restaurant_id uuid, agent_status text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, restaurant_id, status
  FROM restaurant_agents
  WHERE agent_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND status = 'active';
$$;

-- 4c. agent_heartbeat_update
--     Updates agent last_seen_at + metadata. Called every ~30 seconds by agent.
DROP FUNCTION IF EXISTS public.agent_heartbeat_update(uuid,text,text,text);
CREATE OR REPLACE FUNCTION public.agent_heartbeat_update(
  p_agent_id uuid,
  p_hostname text DEFAULT NULL,
  p_local_ip text DEFAULT NULL,
  p_version  text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE restaurant_agents
  SET
    last_seen_at  = now(),
    status        = 'active',
    hostname      = COALESCE(p_hostname, hostname),
    local_ip      = COALESCE(p_local_ip, local_ip),
    agent_version = COALESCE(p_version, agent_version),
    updated_at    = now()
  WHERE id = p_agent_id;
$$;

-- 4d. expire_install_tokens
--     Marks pending tokens past their expires_at as 'expired'.
DROP FUNCTION IF EXISTS public.expire_install_tokens();
CREATE OR REPLACE FUNCTION public.expire_install_tokens()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH expired AS (
    UPDATE agent_install_tokens
    SET status = 'expired'
    WHERE status    = 'pending'
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::int FROM expired;
$$;

-- ─── 5. REVOKE DIRECT RPC CALLS FROM BROWSER ─────────────────────
-- Edge Functions use service_role -- not affected by these revokes.
REVOKE ALL ON FUNCTION public.register_agent_with_token(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_agent_token(text)                        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agent_heartbeat_update(uuid,text,text,text)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_install_tokens()                         FROM PUBLIC;

-- ─── 6. SCHEDULE TOKEN EXPIRY VIA pg_cron (IF AVAILABLE) ─────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN PERFORM cron.unschedule('expire-install-tokens'); EXCEPTION WHEN others THEN NULL; END;
    PERFORM cron.schedule(
      'expire-install-tokens',
      '*/10 * * * *',
      'SELECT public.expire_install_tokens()'
    );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── VERIFICATION (uncomment to check after applying) ────────────
-- SELECT tablename, policyname, permissive, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'printers','printer_category_routes','print_jobs',
--   'restaurant_agents','agent_install_tokens','agent_commands'
-- )
-- ORDER BY tablename, policyname;
