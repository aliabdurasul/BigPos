-- ============================================================
-- MIGRATION v15: Fix RLS Policies + Auth Ambiguity
--
-- ROOT CAUSES FIXED:
--
-- 1. "column reference 'id' is ambiguous" in login RPCs
--    PL/pgSQL RETURNS TABLE creates OUT parameter variables
--    in scope for the entire function body. The output column
--    named "id" conflicts with active_sessions.id inside the
--    DELETE statements. Fix: qualify with table name.
--
-- 2. Unsafe UUID cast in every v14 RLS policy
--    current_setting('app.current_restaurant_id', true)::uuid
--    THROWS "invalid input syntax for type uuid" when the
--    setting is '' (empty string). PostgreSQL does NOT
--    guarantee short-circuit evaluation of OR conditions —
--    the planner can reorder them. So the ::uuid cast fires
--    BEFORE the IS NULL / = '' fallback checks, crashing
--    every query against every tenant table silently.
--    Fix: use a SECURITY DEFINER helper function that wraps
--    NULLIF(..., '')::uuid so the empty-string case is
--    absorbed before the cast is attempted.
--
-- 3. floors table has a globally-unique name constraint
--    The original migration created floors.name as UNIQUE.
--    This prevents two restaurants from having a floor with
--    the same name (e.g. "Zemin Kat"). Fix: drop the global
--    unique constraint, add a per-restaurant unique index.
--
-- IDEMPOTENT: Safe to run multiple times
-- ============================================================

-- ─── 1. SAFE TENANT ID HELPER ─────────────────────────────
--
-- Single place to safely read the current_restaurant_id GUC.
-- Handles NULL (GUC not set) and '' (GUC set to empty string)
-- before any ::uuid cast is attempted.
-- All RLS policies call this instead of inlining the cast.

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT NULLIF(current_setting('app.current_restaurant_id', true), '')::uuid;
$$;

-- ─── 2. FIX LOGIN RPCs ─────────────────────────────────────
--
-- The RETURNS TABLE output column named "id" is an implicit
-- OUT variable in PL/pgSQL scope. Inside the function body,
-- bare "id" is ambiguous between that OUT variable and
-- active_sessions.id. Fix: qualify every reference with the
-- table name.

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
  WHERE u.email         = lower(trim(p_email))
    AND u.password_hash = crypt(p_password, u.password_hash)
    AND u.active        = true;

  IF NOT FOUND THEN RETURN; END IF;

  v_token := gen_random_uuid();

  INSERT INTO active_sessions (id, restaurant_id, platform_user_id, role)
  VALUES (v_token, v_user.restaurant_id, v_user.id, v_user.role);

  -- Keep last 5 sessions per user (multiple devices).
  -- Qualify active_sessions.id to avoid ambiguity with the OUT column "id".
  DELETE FROM active_sessions s
  WHERE s.platform_user_id = v_user.id
    AND s.id != v_token
    AND s.created_at < (
      SELECT sub.created_at FROM active_sessions sub
      WHERE sub.platform_user_id = v_user.id
      ORDER BY sub.created_at DESC
      OFFSET 4 LIMIT 1
    );

  RETURN QUERY
    SELECT v_user.id, v_user.email, v_user.name, v_user.role,
           v_user.restaurant_id, v_user.active, v_token;
END;
$$;

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

  -- Keep last 3 sessions per staff member.
  -- Qualify active_sessions.id to avoid ambiguity with the OUT column "id".
  DELETE FROM active_sessions s
  WHERE s.staff_id = v_staff.id
    AND s.id != v_token
    AND s.created_at < (
      SELECT sub.created_at FROM active_sessions sub
      WHERE sub.staff_id = v_staff.id
      ORDER BY sub.created_at DESC
      OFFSET 2 LIMIT 1
    );

  RETURN QUERY
    SELECT v_staff.id, v_staff.name, v_staff.role,
           v_staff.restaurant_id, v_staff.active, v_token;
END;
$$;

-- ─── 3. FIX FLOORS UNIQUE CONSTRAINT ─────────────────────
--
-- The original schema had "name text not null unique" which
-- prevents any two restaurants from having a floor with the
-- same name. Drop the global constraint and add a per-
-- restaurant unique index instead.

ALTER TABLE floors DROP CONSTRAINT IF EXISTS floors_name_key;
DROP INDEX   IF EXISTS floors_name_key;
DROP INDEX   IF EXISTS floors_name_restaurant_unique;

CREATE UNIQUE INDEX floors_name_restaurant_unique
  ON floors(restaurant_id, name)
  WHERE restaurant_id IS NOT NULL;

-- ─── 4. REBUILD ALL TENANT RLS POLICIES ──────────────────
--
-- Drop every policy installed by v14 and replace it with a
-- version that calls current_tenant_id() instead of inlining
-- the unsafe ::uuid cast.
--
-- Pattern used everywhere:
--   current_tenant_id() IS NULL          → no session context yet (fallback)
--   restaurant_id = current_tenant_id()  → row belongs to this tenant
--
-- Tables with a direct restaurant_id column:

DO $$
DECLARE
  tbl text;
  tables_with_rid text[] := ARRAY[
    'staff', 'floors', 'categories', 'menu_items', 'modifier_groups',
    'tables', 'orders', 'order_items', 'payments',
    'daily_closures', 'kitchen_logs', 'discounts',
    'printers', 'printer_category_routes', 'print_jobs', 'agent_commands'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_rid LOOP
    -- Remove any existing tenant_isolation policy (from v14 or earlier)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', tbl);

    EXECUTE format($pol$
      CREATE POLICY "tenant_isolation" ON %I
        FOR ALL USING (
          public.current_tenant_id() IS NULL
          OR restaurant_id = public.current_tenant_id()
        )
        WITH CHECK (
          public.current_tenant_id() IS NULL
          OR restaurant_id = public.current_tenant_id()
        )
    $pol$, tbl);
  END LOOP;
END $$;

-- restaurants: visible if it IS the current tenant, or no tenant context yet
DROP POLICY IF EXISTS "restaurants_tenant_isolation" ON restaurants;
CREATE POLICY "restaurants_tenant_isolation" ON restaurants
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR id = public.current_tenant_id()
  );

-- modifier_options → scoped via modifier_groups.restaurant_id
DROP POLICY IF EXISTS "tenant_isolation" ON modifier_options;
CREATE POLICY "tenant_isolation" ON modifier_options
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM modifier_groups g
      WHERE g.id = modifier_options.group_id
        AND g.restaurant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM modifier_groups g
      WHERE g.id = modifier_options.group_id
        AND g.restaurant_id = public.current_tenant_id()
    )
  );

-- product_modifier_groups → scoped via menu_items.restaurant_id
DROP POLICY IF EXISTS "tenant_isolation" ON product_modifier_groups;
CREATE POLICY "tenant_isolation" ON product_modifier_groups
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM menu_items m
      WHERE m.id = product_modifier_groups.menu_item_id
        AND m.restaurant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM menu_items m
      WHERE m.id = product_modifier_groups.menu_item_id
        AND m.restaurant_id = public.current_tenant_id()
    )
  );

-- order_item_modifiers → scoped via order_items.restaurant_id
DROP POLICY IF EXISTS "tenant_isolation" ON order_item_modifiers;
CREATE POLICY "tenant_isolation" ON order_item_modifiers
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = order_item_modifiers.order_item_id
        AND oi.restaurant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    public.current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM order_items oi
      WHERE oi.id = order_item_modifiers.order_item_id
        AND oi.restaurant_id = public.current_tenant_id()
    )
  );

-- restaurant_agents
DROP POLICY IF EXISTS "restaurant_agents_tenant" ON restaurant_agents;
CREATE POLICY "restaurant_agents_tenant" ON restaurant_agents
  FOR ALL USING (
    public.current_tenant_id() IS NULL
    OR restaurant_id = public.current_tenant_id()
  );

-- ─── 5. UPDATE PRE-REQUEST HOOK TO USE HELPER ─────────────
--
-- Also replace the inline cast in handle_pre_request itself
-- with a safe NULLIF pattern for consistency.

CREATE OR REPLACE FUNCTION public.handle_pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_headers_raw text;
  v_token_text  text;
  v_token_uuid  uuid;
  v_rid         uuid;
BEGIN
  BEGIN
    v_headers_raw := current_setting('request.headers', true);
  EXCEPTION WHEN others THEN RETURN;
  END;

  IF v_headers_raw IS NULL OR v_headers_raw = '' THEN RETURN; END IF;

  BEGIN
    v_token_text := (v_headers_raw::json)->>'x-session-token';
  EXCEPTION WHEN others THEN RETURN;
  END;

  IF v_token_text IS NULL OR v_token_text = '' THEN RETURN; END IF;

  BEGIN
    v_token_uuid := v_token_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN; -- malformed token — ignore silently
  END;

  BEGIN
    SELECT s.restaurant_id INTO v_rid
    FROM active_sessions s
    WHERE s.id = v_token_uuid
      AND s.expires_at > now()
    LIMIT 1;
  EXCEPTION WHEN others THEN RETURN;
  END;

  IF v_rid IS NOT NULL THEN
    PERFORM set_config('app.current_restaurant_id', v_rid::text, true);
  END IF;
END;
$$;

-- ─── VERIFICATION QUERY ────────────────────────────────────
-- Run this after applying to confirm policies are correct:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname = 'tenant_isolation'
-- ORDER BY tablename;
--
-- Expected: all tenant tables show current_tenant_id() in qual,
-- NOT the old inline ::uuid cast.
