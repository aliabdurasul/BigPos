-- ============================================================
-- MIGRATION v13: Restaurant Agent + Printer Registry System
-- Implements production-grade printer management:
--   - restaurant_agents: local agent authentication
--   - printers: DB-backed printer registry (no localStorage)
--   - printer_category_routes: routing rules
--   - print_jobs: reliable cloud-queued print delivery
--   - agent_commands: cloud→agent control channel
-- IDEMPOTENT: Safe to run on existing databases
-- ============================================================

-- ─── AGENT REGISTRATION ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS restaurant_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Stored as SHA-256 hex hash of the actual secret token
  agent_token_hash  text NOT NULL UNIQUE,
  -- Last 6 chars of raw token, shown in admin UI for identification
  token_hint    text NOT NULL DEFAULT '',
  hostname      text,
  local_ip      text,
  agent_version text,
  last_seen_at  timestamptz,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('active', 'revoked', 'pending')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- One-time install tokens (exchanged for permanent agent_token)
CREATE TABLE IF NOT EXISTS agent_install_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  token_hint    text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'used', 'expired')),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_agents_restaurant ON restaurant_agents(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_agents_token      ON restaurant_agents(agent_token_hash);
CREATE INDEX IF NOT EXISTS idx_restaurant_agents_status     ON restaurant_agents(status);
CREATE INDEX IF NOT EXISTS idx_install_tokens_hash          ON agent_install_tokens(token_hash);

-- ─── PRINTER REGISTRY ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS printers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  agent_id        uuid REFERENCES restaurant_agents(id) ON DELETE SET NULL,
  -- Human-readable name set by admin (e.g. "Mutfak Yazıcı 1")
  name            text NOT NULL,
  station_type    text NOT NULL DEFAULT 'kitchen'
                    CHECK (station_type IN ('kitchen', 'bar', 'cashier', 'label')),
  ip_address      text NOT NULL,
  port            int  NOT NULL DEFAULT 9100,
  paper_width     int  NOT NULL DEFAULT 80
                    CHECK (paper_width IN (58, 80)),
  -- Status is updated by agent heartbeat, never by admin directly
  status          text NOT NULL DEFAULT 'unknown'
                    CHECK (status IN ('online', 'offline', 'error', 'unknown')),
  last_ping_ok_at timestamptz,
  error_message   text,
  -- Whether admin has enabled this printer
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_printers_restaurant ON printers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printers_agent      ON printers(agent_id);
CREATE INDEX IF NOT EXISTS idx_printers_status     ON printers(restaurant_id, status);

-- ─── CATEGORY → PRINTER ROUTING ───────────────────────────────────

CREATE TABLE IF NOT EXISTS printer_category_routes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  printer_id    uuid NOT NULL REFERENCES printers(id)    ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(restaurant_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_printer_routes_restaurant ON printer_category_routes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_printer_routes_category   ON printer_category_routes(category_id);

-- ─── PRINT JOB QUEUE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS print_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- Which printer this job targets
  printer_id      uuid NOT NULL REFERENCES printers(id),
  -- Type determines how agent renders the payload
  job_type        text NOT NULL
                    CHECK (job_type IN ('kitchen', 'receipt', 'label', 'test')),
  -- Structured order data — agent renders ESC/POS locally
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Cloud never touches raw bytes; agent sets this for audit only
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'dispatched', 'printing', 'done', 'failed', 'cancelled')),
  attempts        int  NOT NULL DEFAULT 0,
  max_attempts    int  NOT NULL DEFAULT 5,
  -- Cloud enforces exponential backoff via this field
  next_retry_at   timestamptz DEFAULT now(),
  -- Dedup key: e.g. "kitchen:{order_id}:{diff_hash}"
  fingerprint     text UNIQUE,
  -- Optional: link to the source order for traceability
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- JSON array of { attempt, error, ts } objects
  error_log       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_restaurant_status ON print_jobs(restaurant_id, status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_status    ON print_jobs(printer_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order             ON print_jobs(order_id);
-- Agent polls: pending jobs for its restaurant, ordered by created_at
CREATE INDEX IF NOT EXISTS idx_print_jobs_poll ON print_jobs(restaurant_id, status, created_at)
  WHERE status IN ('pending', 'failed');

-- ─── AGENT COMMAND INBOX ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_commands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  agent_id      uuid REFERENCES restaurant_agents(id) ON DELETE CASCADE,
  command       text NOT NULL
                  CHECK (command IN ('reload_config', 'ping', 'scan_printers', 'revoke')),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'acked', 'failed')),
  created_at    timestamptz DEFAULT now(),
  acked_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_commands_agent_status ON agent_commands(agent_id, status)
  WHERE status = 'pending';

-- ─── EXTEND EXISTING TABLES ───────────────────────────────────────

-- Add print_status tracking to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS print_status text
  NOT NULL DEFAULT 'unprinted'
  CHECK (print_status IN ('unprinted', 'queued', 'partial', 'printed'));

-- Add source tracking (QR vs POS vs delivery)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text
  NOT NULL DEFAULT 'pos'
  CHECK (source IN ('pos', 'qr', 'delivery'));

-- ─── REALTIME ─────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE printers;         EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;       EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_agents; EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ─── pg_cron: auto-reset orphaned dispatched jobs ─────────────────
-- Requires pg_cron extension. Skip if not available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Reset jobs stuck in 'dispatched' for > 2 minutes back to 'pending'
    PERFORM cron.schedule(
      'reset-orphaned-print-jobs',
      '* * * * *',  -- every minute
      $cron$
        UPDATE print_jobs
        SET status = 'pending', next_retry_at = now()
        WHERE status = 'dispatched'
          AND created_at < now() - interval '2 minutes'
          AND attempts < max_attempts;
      $cron$
    );
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────

-- Returns pending print jobs for an agent's restaurant.
-- Called by the agent's polling loop.
CREATE OR REPLACE FUNCTION get_pending_print_jobs(p_restaurant_id uuid, p_limit int DEFAULT 20)
RETURNS SETOF print_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM print_jobs
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('pending', 'failed')
    AND next_retry_at <= now()
    AND attempts < max_attempts
  ORDER BY created_at ASC
  LIMIT p_limit;
$$;

-- Marks a batch of jobs as 'dispatched' atomically (agent claims them)
CREATE OR REPLACE FUNCTION claim_print_jobs(p_job_ids uuid[])
RETURNS SETOF print_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE print_jobs
  SET status = 'dispatched', attempts = attempts + 1
  WHERE id = ANY(p_job_ids) AND status IN ('pending', 'failed')
  RETURNING *;
$$;

-- Records job completion (done or failed) with error log append
CREATE OR REPLACE FUNCTION complete_print_job(
  p_job_id   uuid,
  p_status   text,  -- 'done' or 'failed'
  p_error    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts int;
  v_max      int;
  v_backoff  interval;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max
  FROM print_jobs WHERE id = p_job_id;

  IF p_status = 'done' THEN
    UPDATE print_jobs
    SET status = 'done',
        completed_at = now()
    WHERE id = p_job_id;

    -- Mark printer as online
    UPDATE printers p
    SET status = 'online', last_ping_ok_at = now(), error_message = NULL, updated_at = now()
    FROM print_jobs j
    WHERE j.id = p_job_id AND j.printer_id = p.id;

  ELSIF p_status = 'failed' THEN
    -- Exponential backoff: 10s, 30s, 2m, 10m, 30m
    v_backoff := CASE v_attempts
      WHEN 1 THEN interval '10 seconds'
      WHEN 2 THEN interval '30 seconds'
      WHEN 3 THEN interval '2 minutes'
      WHEN 4 THEN interval '10 minutes'
      ELSE         interval '30 minutes'
    END;

    IF v_attempts >= v_max THEN
      UPDATE print_jobs
      SET status = 'failed',
          error_log = error_log || jsonb_build_array(
            jsonb_build_object('attempt', v_attempts, 'error', p_error, 'ts', now())
          )
      WHERE id = p_job_id;

      -- Mark printer as error after exhausting retries
      UPDATE printers p
      SET status = 'error', error_message = p_error, updated_at = now()
      FROM print_jobs j
      WHERE j.id = p_job_id AND j.printer_id = p.id;
    ELSE
      UPDATE print_jobs
      SET status = 'pending',
          next_retry_at = now() + v_backoff,
          error_log = error_log || jsonb_build_array(
            jsonb_build_object('attempt', v_attempts, 'error', p_error, 'ts', now())
          )
      WHERE id = p_job_id;

      -- Mark printer as offline after first failure
      UPDATE printers p
      SET status = 'offline', error_message = p_error, updated_at = now()
      FROM print_jobs j
      WHERE j.id = p_job_id AND j.printer_id = p.id;
    END IF;
  END IF;
END;
$$;

-- Creates a print job, deduplicating by fingerprint
CREATE OR REPLACE FUNCTION enqueue_print_job(
  p_restaurant_id uuid,
  p_printer_id    uuid,
  p_job_type      text,
  p_payload       jsonb,
  p_fingerprint   text,
  p_order_id      uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Dedup: if a non-failed/cancelled job with this fingerprint exists, return its id
  SELECT id INTO v_id FROM print_jobs
  WHERE fingerprint = p_fingerprint
    AND status NOT IN ('failed', 'cancelled')
    AND created_at > now() - interval '5 minutes';

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO print_jobs (restaurant_id, printer_id, job_type, payload, fingerprint, order_id)
  VALUES (p_restaurant_id, p_printer_id, p_job_type, p_payload, p_fingerprint, p_order_id)
  RETURNING id INTO v_id;

  -- Update order print_status
  IF p_order_id IS NOT NULL THEN
    UPDATE orders SET print_status = 'queued'
    WHERE id = p_order_id AND print_status = 'unprinted';
  END IF;

  RETURN v_id;
END;
$$;

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────

ALTER TABLE restaurant_agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_install_tokens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_category_routes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commands            ENABLE ROW LEVEL SECURITY;

-- For MVP: open policies using service_role only (anon key blocked by RLS)
-- In production: replace with proper JWT-claim-based policies per role.
-- The agent uses service_role key (stored securely, never in browser).

DROP POLICY IF EXISTS "agents_all"         ON restaurant_agents;
DROP POLICY IF EXISTS "install_tokens_all" ON agent_install_tokens;
DROP POLICY IF EXISTS "printers_all"       ON printers;
DROP POLICY IF EXISTS "routes_all"         ON printer_category_routes;
DROP POLICY IF EXISTS "print_jobs_all"     ON print_jobs;
DROP POLICY IF EXISTS "agent_commands_all" ON agent_commands;

-- Allow all via service_role; anon key gets nothing (RLS enabled + no anon policy)
CREATE POLICY "agents_all"         ON restaurant_agents         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "install_tokens_all" ON agent_install_tokens      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "printers_all"       ON printers                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "routes_all"         ON printer_category_routes   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "print_jobs_all"     ON print_jobs                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agent_commands_all" ON agent_commands            FOR ALL USING (true) WITH CHECK (true);

-- ─── INDEXES FOR COMMON QUERIES ───────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_print_jobs_fingerprint ON print_jobs(fingerprint)
  WHERE fingerprint IS NOT NULL;
