-- IWACU RWANDA security hardening migration
-- Apply this file in the Supabase SQL Editor after the base schema exists.
-- It does not create admin users or configure Supabase Auth.

BEGIN;

-- SECURITY DEFINER functions must not trust a caller-controlled search path.
ALTER FUNCTION public.calculate_location_confidence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.ingest_boundary_feature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.ingest_boundary_batch(JSONB)
  SET search_path = pg_catalog, public;

-- The version helper accepts only the two tables that actually have a version
-- column. The table identifier is always schema-qualified.
CREATE OR REPLACE FUNCTION public.check_version(
  p_table TEXT,
  p_id UUID,
  p_expected_version INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $checkversion$
DECLARE
  current_version INTEGER;
BEGIN
  IF p_table NOT IN ('leaders', 'boundaries') THEN
    RAISE EXCEPTION 'Unsupported table for version check';
  END IF;

  EXECUTE format('SELECT version FROM public.%I WHERE id = $1', p_table)
    INTO current_version
    USING p_id;

  IF current_version IS NULL THEN
    RAISE EXCEPTION 'Record not found';
  END IF;

  IF current_version <> p_expected_version THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$checkversion$;

-- Use SECURITY DEFINER helpers to avoid recursive admin_profiles RLS policies.
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $adminfn$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles AS ap
    WHERE ap.user_id = auth.uid()
      AND ap.is_super_admin IS TRUE
  );
$adminfn$;

CREATE OR REPLACE FUNCTION public.current_user_admin_scope()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $adminscope$
  SELECT ap.scope_code
  FROM public.admin_profiles AS ap
  WHERE ap.user_id = auth.uid()
  LIMIT 1;
$adminscope$;

REVOKE ALL ON FUNCTION public.is_current_user_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_admin_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_admin_scope() TO authenticated;

-- Remove the old recursive policies before replacing them.
DROP POLICY IF EXISTS "boundaries_super_admin_write" ON public.boundaries;
DROP POLICY IF EXISTS "leaders_scoped_admin_write" ON public.leaders;
DROP POLICY IF EXISTS "admin_profiles_self_read" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_super_admin_write" ON public.admin_profiles;
DROP POLICY IF EXISTS "audit_logs_super_admin_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_direct_write" ON public.audit_logs;

CREATE POLICY "boundaries_super_admin_write"
  ON public.boundaries FOR ALL
  TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

CREATE POLICY "leaders_scoped_admin_write"
  ON public.leaders FOR ALL
  TO authenticated
  USING (
    public.is_current_user_super_admin()
    OR scope_code = public.current_user_admin_scope()
    OR scope_code LIKE public.current_user_admin_scope() || '-%'
  )
  WITH CHECK (
    public.is_current_user_super_admin()
    OR scope_code = public.current_user_admin_scope()
    OR scope_code LIKE public.current_user_admin_scope() || '-%'
  );

CREATE POLICY "admin_profiles_self_read"
  ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_current_user_super_admin());

CREATE POLICY "admin_profiles_super_admin_write"
  ON public.admin_profiles FOR ALL
  TO authenticated
  USING (public.is_current_user_super_admin())
  WITH CHECK (public.is_current_user_super_admin());

CREATE POLICY "audit_logs_super_admin_read"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_current_user_super_admin());

CREATE POLICY "audit_logs_no_direct_write"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Browser-facing roles must not read base tables directly. The leaders table
-- contains raw phone numbers; public application data must go through server
-- APIs that mask phones, while the public view deliberately excludes them.
REVOKE ALL PRIVILEGES ON TABLE public.boundaries FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.leaders FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.admin_profiles FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM anon, authenticated;

GRANT SELECT ON public.admin_profiles TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.v_active_leaders TO anon, authenticated;

-- Privileged RPCs are server-only; do not leave PostgreSQL's default PUBLIC
-- EXECUTE permission in place.
REVOKE EXECUTE ON FUNCTION public.check_version(TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_version(TEXT, UUID, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.calculate_location_confidence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_location_confidence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.ingest_boundary_feature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_boundary_feature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.ingest_boundary_batch(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_boundary_batch(JSONB) TO service_role;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
