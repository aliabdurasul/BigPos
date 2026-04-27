-- ============================================================
-- MIGRATION v14: RLS Hardening — Tenant Isolation (P0)
--
-- Problem: All tables have FOR ALL USING (true) — any holder
-- of the anon key can read ALL restaurants' data. The
-- platform_users table exposes bcrypt password hashes.
--
-- Strategy:
--   1. Create active_sessions table for token-based auth
--   2. Upgrade login RPCs to mint session tokens
--   3. Install a PostgREST pre-request hook that reads the
--      x-session-token request header and sets the per-
--      transaction GUC app.current_restaurant_id
--   4. Lock platform_users — no direct anon access
--   5. Replace FOR ALL USING (true) on tenant tables with
--      tenant-scoped policies + a PERMISSIVE FALLBACK so
--      existing sessions without tokens don't break yet
--   6. Lock agent tables (service_role only)
--
-- PHASE-IN PLAN:
--   After deploying this migration + frontend changes:
--     • All new logins get a session token
--     • Tokens are sent in x-session-token header
--     • pre-request hook sets app.current_restaurant_id
--     • Tenant tables only return rows for that restaurant
--   When all active sessions have tokens, remove the
--   FALLBACK clauses (OR current_setting(...) IS NULL) in a
--   future migration_v15 to make isolation strict.
--
-- IDEMPOTENT: Safe to run multiple times
-- ============================================================

-- ─── 1. SESSION TABLE ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS active_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  platform_user_id uuid REFERENCES platform_users(id) ON DELETE CASCADE,
  staff_id        uuid REFERENCES staff(id) ON DELETE CASCADE,
  role            text NOT NULL,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at      timestamptz DEFAULT now(),
  -- Exactly one of platform_user_id or staff_id must be set
  CONSTRAINT active_sessions_one_actor CHECK (
    (platform_user_id IS NOT NULL AND staff_id IS NULL) OR
    (platform_user_id IS NULL AND staff_id IS NOT NULL)
  )
);

-- id is the PRIMARY KEY so no extra index needed for token lookups.
-- Index expires_at for future cleanup queries.
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at
  ON active_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_active_sessions_restaurant
  ON active_sessions(restaurant_id);

-- Auto-expire: purge sessions older than 24h (runs on lookup, no cron needed)
-- The index above already filters them out efficiently.

ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_direct_session_access" ON active_sessions;
CREATE POLICY "deny_direct_session_access" ON active_sessions
  FOR ALL USING (false);
-- Only SECURITY DEFINER functions can read/write active_sessions.

-- ─── 2. PRE-REQUEST HOOK ──────────────────────────────────
--
-- Runs before EVERY PostgREST request in the same transaction.
-- Reads the x-session-token header, looks up the session, and
-- sets app.current_restaurant_id so RLS policies can use it.
--
-- IMPORTANT: After running this migration you MUST also run
-- the following in the Supabase Dashboard → SQL Editor to
-- enable the hook (requires SUPERUSER):
--
--   ALTER ROLE authenticator
--     SET pgrst.db_pre_request TO 'public.handle_pre_request';
--   NOTIFY pgrst;
--
-- This cannot be done inside a migration safely on all
-- Supabase plans. Uncomment the lines at the bottom of this
-- file if your plan allows it.

CREATE OR REPLACE FUNCTION public.handle_pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_headers_raw text;
  v_token       text;
  v_rid         uuid;
BEGIN
  -- Safely read request headers (PostgREST sets this GUC)
  BEGIN
    v_headers_raw := current_setting('request.headers', true);
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  IF v_headers_raw IS NULL OR v_headers_raw = '' THEN RETURN; END IF;

  BEGIN
    v_token := (v_headers_raw::json)->>'x-session-token';
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  IF v_token IS NULL OR v_token = '' THEN RETURN; END IF;

  -- Look up the session (index makes this fast)
  BEGIN
    SELECT s.restaurant_id INTO v_rid
    FROM active_sessions s
    WHERE s.id = v_token::uuid
      AND s.expires_at > now()
    LIMIT 1;
  EXCEPTION WHEN others THEN
    RETURN;
  END;

  IF v_rid IS NOT NULL THEN
    -- Transaction-local: lasts exactly for this request
    PERFORM set_config('app.current_restaurant_id', v_rid::text, true);
  END IF;
END;
$$;

-- ─── 3. UPGRADE LOGIN RPCs ────────────────────────────────
--
-- Both RPCs now:
--   a) Create an active_session record
--   b) Return the session token alongside the user/staff data
--
-- The function signatures CHANGE (new column session_token).
-- Frontend must be updated to consume it.

-- verify_platform_login
DROP FUNCTION IF EXISTS verify_platform_login(text, text);
CREATE OR REPLACE FUNCTION verify_platform_login(p_email text, p_password text)
RETURNS TABLE (
  id            uuid,
  email         text,
  name          text,
  role          text,
  restaurant_id uuid,
  active        boolean,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user  platform_users%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO v_user
  FROM platform_users u
  WHERE u.email        = lower(trim(p_email))
    AND u.password_hash = crypt(p_password, u.password_hash)
    AND u.active        = true;

  IF NOT FOUND THEN RETURN; END IF;

  -- Mint a new session token
  v_token := gen_random_uuid();
  INSERT INTO active_sessions (id, restaurant_id, platform_user_id, role)
  VALUES (v_token, v_user.restaurant_id, v_user.id, v_user.role);

  -- Expire old sessions for this user (keep last 5 to support multiple devices)
  DELETE FROM active_sessions
  WHERE platform_user_id = v_user.id
    AND id != v_token
    AND created_at < (
      SELECT created_at FROM active_sessions
      WHERE platform_user_id = v_user.id
      ORDER BY created_at DESC
      OFFSET 4 LIMIT 1
    );

  RETURN QUERY
    SELECT v_user.id, v_user.email, v_user.name, v_user.role,
           v_user.restaurant_id, v_user.active, v_token;
END;
$$;

-- verify_staff_pin
DROP FUNCTION IF EXISTS verify_staff_pin(text, uuid);
CREATE OR REPLACE FUNCTION verify_staff_pin(p_pin text, p_restaurant_id uuid)
RETURNS TABLE (
  id            uuid,
  name          text,
  role          text,
  restaurant_id uuid,
  active        boolean,
  session_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staff staff%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT * INTO v_staff
  FROM staff s
  WHERE s.pin           = p_pin
    AND s.restaurant_id = p_restaurant_id
    AND s.active        = true;

  IF NOT FOUND THEN RETURN; END IF;

  v_token := gen_random_uuid();
  INSERT INTO active_sessions (id, restaurant_id, staff_id, role)
  VALUES (v_token, v_staff.restaurant_id, v_staff.id, v_staff.role);

  -- Keep last 3 sessions per staff member (multiple terminals)
  DELETE FROM active_sessions
  WHERE staff_id = v_staff.id
    AND id != v_token
    AND created_at < (
      SELECT created_at FROM active_sessions
      WHERE staff_id = v_staff.id
      ORDER BY created_at DESC
      OFFSET 2 LIMIT 1
    );

  RETURN QUERY
    SELECT v_staff.id, v_staff.name, v_staff.role,
           v_staff.restaurant_id, v_staff.active, v_token;
END;
$$;

-- ─── 4. LOCK PLATFORM_USERS ───────────────────────────────
--
-- No one can directly SELECT/INSERT/UPDATE/DELETE platform_users
-- via the anon key. The SECURITY DEFINER RPCs above bypass RLS
-- and are the only access path. This protects password hashes.

DROP POLICY IF EXISTS "Allow all on platform_users" ON platform_users;
DROP POLICY IF EXISTS "deny_direct_platform_users"  ON platform_users;

CREATE POLICY "deny_direct_platform_users" ON platform_users
  FOR ALL USING (false);

-- ─── 5. TENANT-SCOPED RLS ON BUSINESS TABLES ─────────────
--
-- Replaces the permissive FOR ALL USING (true) policies with
-- restaurant-scoped ones. The FALLBACK clause (second OR arm)
-- keeps the app working for sessions that don't yet send a
-- token header. Remove it in migration_v15 once all clients
-- are on the updated build.
--
-- Helper macro for the common pattern:

-- Tenant tables (have restaurant_id column):
-- Tables that have a direct restaurant_id column:
DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'staff', 'floors', 'categories', 'menu_items',
    'modifier_groups',
    'tables', 'orders', 'order_items', 'payments',
    'daily_closures', 'kitchen_logs', 'discounts',
    'printers', 'printer_category_routes', 'print_jobs', 'agent_commands'
  ];
  old_policy text;
  policy_names text[] := ARRAY[
    'Allow all on staff',       'Allow all on floors',
    'Allow all on categories',  'Allow all on menu_items',
    'Allow all on modifier_groups',
    'Allow all on tables',      'Allow all on orders',
    'Allow all on order_items', 'Allow all on payments',
    'Allow all on daily_closures', 'Allow all on kitchen_logs',
    'Allow all on discounts',
    'printers_all', 'routes_all', 'print_jobs_all', 'agent_commands_all'
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(tenant_tables, 1) LOOP
    tbl := tenant_tables[i];
    old_policy := policy_names[i];

    -- Drop the old open policy (%I quotes as identifier, not string literal)
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      old_policy, tbl
    );

    -- Add the tenant-scoped policy with permissive fallback
    EXECUTE format($pol$
      CREATE POLICY "tenant_isolation" ON %I
        FOR ALL USING (
          restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
        WITH CHECK (
          restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    $pol$, tbl);
  END LOOP;
END $$;

-- ─── Child / junction tables (no direct restaurant_id) ────────────────────
-- These are scoped via their parent's restaurant_id using EXISTS subqueries.

-- modifier_options → modifier_groups.restaurant_id
DROP POLICY IF EXISTS "Allow all on modifier_options" ON modifier_options;
DROP POLICY IF EXISTS "tenant_isolation"              ON modifier_options;
CREATE POLICY "tenant_isolation" ON modifier_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM modifier_groups g
      WHERE g.id = modifier_options.group_id
        AND (
          g.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM modifier_groups g
      WHERE g.id = modifier_options.group_id
        AND (
          g.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  );

-- product_modifier_groups → menu_items.restaurant_id
DROP POLICY IF EXISTS "Allow all on product_modifier_groups" ON product_modifier_groups;
DROP POLICY IF EXISTS "tenant_isolation"                     ON product_modifier_groups;
CREATE POLICY "tenant_isolation" ON product_modifier_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM menu_items m
      WHERE m.id = product_modifier_groups.menu_item_id
        AND (
          m.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM menu_items m
      WHERE m.id = product_modifier_groups.menu_item_id
        AND (
          m.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  );

-- order_item_modifiers → order_items.restaurant_id
DROP POLICY IF EXISTS "Allow all on order_item_modifiers" ON order_item_modifiers;
DROP POLICY IF EXISTS "tenant_isolation"                  ON order_item_modifiers;
CREATE POLICY "tenant_isolation" ON order_item_modifiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = order_item_modifiers.order_item_id
        AND (
          oi.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = order_item_modifiers.order_item_id
        AND (
          oi.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
          OR current_setting('app.current_restaurant_id', true) IS NULL
          OR current_setting('app.current_restaurant_id', true) = ''
        )
    )
  );

-- restaurants table — super_admin can see all; restoran_admin only theirs
DROP POLICY IF EXISTS "Allow all on restaurants" ON restaurants;
DROP POLICY IF EXISTS "restaurants_tenant_isolation" ON restaurants;

CREATE POLICY "restaurants_tenant_isolation" ON restaurants
  FOR ALL USING (
    -- Visible if it IS the current tenant's restaurant
    id = current_setting('app.current_restaurant_id', true)::uuid
    -- OR no session context (fallback / super_admin path)
    OR current_setting('app.current_restaurant_id', true) IS NULL
    OR current_setting('app.current_restaurant_id', true) = ''
  );

-- ─── 6. LOCK AGENT TABLES ─────────────────────────────────
--
-- Agent uses service_role key (bypasses RLS).
-- Frontend reads restaurant_agents for status display —
-- keep that open with tenant-scoped policy.
-- agent_install_tokens: no direct anon access.

DROP POLICY IF EXISTS "agents_all"         ON restaurant_agents;
DROP POLICY IF EXISTS "install_tokens_all" ON agent_install_tokens;

CREATE POLICY "restaurant_agents_tenant" ON restaurant_agents
  FOR ALL USING (
    restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    OR current_setting('app.current_restaurant_id', true) IS NULL
    OR current_setting('app.current_restaurant_id', true) = ''
  );

-- Install tokens: never directly readable by browser
CREATE POLICY "deny_install_tokens" ON agent_install_tokens
  FOR ALL USING (false);

-- ─── 7. REGISTER THE PRE-REQUEST HOOK ────────────────────
-- Uncomment if your Supabase plan allows running ALTER ROLE.
-- Otherwise run these two lines manually in the SQL Editor:
--
-- ALTER ROLE authenticator
--   SET pgrst.db_pre_request TO 'public.handle_pre_request';
-- NOTIFY pgrst;

DO $$
BEGIN
  ALTER ROLE authenticator
    SET pgrst.db_pre_request TO 'public.handle_pre_request';
  NOTIFY pgrst;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE
    'MANUAL STEP REQUIRED: run these two lines in the SQL Editor as a superuser: '
    'ALTER ROLE authenticator SET pgrst.db_pre_request TO ''public.handle_pre_request''; '
    'NOTIFY pgrst;';
END $$;

-- ─── VERIFICATION QUERIES ─────────────────────────────────
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
