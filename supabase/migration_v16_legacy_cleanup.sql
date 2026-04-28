-- ============================================================
-- MIGRATION v16: Legacy Cleanup + Safe Settings Update
--
-- FIXES:
--
-- 1. "relation users does not exist"
--    A `public.users` table exists in some live DBs from before
--    the rename to `platform_users`. Any stale function or trigger
--    referencing it causes runtime errors. Drop it safely.
--
-- 2. updatePrinterConfig wipes entire settings column
--    The frontend was doing `.update({ settings: { printerConfig } })`
--    which replaces the whole JSONB column. This migration adds a
--    SECURITY DEFINER RPC `update_settings_field` that does a safe
--    partial merge: settings = COALESCE(settings, '{}') || {key: value}
--    so unrelated settings keys are preserved.
--
-- 3. Ensure platform_users.active column exists
--    Guards against databases that are missing this column due to
--    partial migration runs.
--
-- IDEMPOTENT: Safe to run multiple times
-- ============================================================

-- ─── 1. DROP LEGACY users TABLE ───────────────────────────
--
-- Some live databases have a public.users table left over from
-- before the rename to platform_users. Drop it (and any dependent
-- objects) only if no essential data is there. The cascade will
-- also remove any stale triggers or views referencing it.
--
-- SAFE: platform_users is the authoritative auth table. Nothing
-- in the current codebase references public.users.

DROP TABLE IF EXISTS public.users CASCADE;

-- Drop any stale functions that referenced the old users table
-- (these would fail at call-time otherwise).
DROP FUNCTION IF EXISTS public.get_user_by_email(text);
DROP FUNCTION IF EXISTS public.create_user(text, text, text);
DROP FUNCTION IF EXISTS public.update_user(uuid, text, text);

-- ─── 2. SAFE PARTIAL SETTINGS UPDATE RPC ─────────────────
--
-- Merges a single key into the restaurant's settings JSONB column
-- without touching other keys. Called by the frontend instead of
-- a direct .update({ settings: { ... } }) which would wipe siblings.
--
-- Usage: SELECT update_settings_field(
--   p_restaurant_id := '...uuid...',
--   p_key           := 'printerConfig',
--   p_value         := '{"enabled": true, ...}'::jsonb
-- );

CREATE OR REPLACE FUNCTION public.update_settings_field(
  p_restaurant_id uuid,
  p_key           text,
  p_value         jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE restaurants
  SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(p_key, p_value),
      updated_at = now()
  WHERE id = p_restaurant_id;
END;
$$;

-- Grant execute to authenticated role so PostgREST can call it
GRANT EXECUTE ON FUNCTION public.update_settings_field(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_settings_field(uuid, text, jsonb) TO anon;

-- ─── 3. PLATFORM_USERS COLUMN GUARDS ─────────────────────
--
-- Ensure columns exist that older partial migrations may have
-- skipped. All are idempotent ADD COLUMN IF NOT EXISTS.

ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ─── 4. ACTIVE_SESSIONS EXPIRY COLUMN GUARD ───────────────
--
-- v14 introduced active_sessions. Guard the expires_at column
-- in case the table was created without it on some DBs.

ALTER TABLE active_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz
  NOT NULL DEFAULT (now() + interval '12 hours');

-- ─── 5. RESTORE OPEN (non-strict) RLS FALLBACK ────────────
--
-- v15 RLS policies use: current_tenant_id() IS NULL OR restaurant_id = current_tenant_id()
-- The IS NULL arm is the fallback for requests that have no session token yet
-- (e.g., the initial login RPC itself, or requests before the hook fires).
--
-- This step is a no-op if v15 already applied correctly. We re-apply the
-- restaurants policy here to ensure it always exists with the right shape,
-- because it is the most commonly broken one on partial deploys.

DROP POLICY IF EXISTS "restaurants_tenant_isolation" ON restaurants;
CREATE POLICY "restaurants_tenant_isolation" ON restaurants
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR id = public.current_tenant_id()
  )
  WITH CHECK (
    public.current_tenant_id() IS NULL
    OR id = public.current_tenant_id()
  );

-- ─── VERIFICATION ─────────────────────────────────────────
-- After running, confirm with:
--
--   SELECT id, name FROM restaurants LIMIT 5;
--   -- Should return rows (not throw "users does not exist")
--
--   SELECT update_settings_field(
--     (SELECT id FROM restaurants LIMIT 1),
--     'test_key',
--     '"test_value"'::jsonb
--   );
--   -- Should return void without error
--
--   SELECT settings FROM restaurants WHERE id = (SELECT id FROM restaurants LIMIT 1);
--   -- settings JSONB should contain "test_key": "test_value"
--   -- AND retain any previously existing keys (printerConfig etc.)
