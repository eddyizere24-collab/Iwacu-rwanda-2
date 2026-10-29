-- IWACU RWANDA — follow-up database hardening
-- Apply ONCE, after sql/security-hardening-migration.sql.
-- This migration keeps raw phone numbers inaccessible to browser roles, moves
-- RBAC helper RPCs out of the exposed public schema, and removes duplicate
-- read/write policy paths. It does not touch PostGIS's spatial_ref_sys table;
-- review that extension-owned table separately before changing its RLS.

BEGIN;

-- Make the trigger helper immune to caller-controlled search_path settings.
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog;

-- Convert the safe public view to SECURITY INVOKER. The browser roles receive
-- only the non-sensitive columns used by the view; phone_number is not granted.
GRANT SELECT (id, scope_code, first_name, last_name, role, email, photo_url, valid_from, valid_to, version)
  ON TABLE public.leaders TO anon, authenticated;
GRANT SELECT (scope_code, name_kiny, name_eng, level, valid_to)
  ON TABLE public.boundaries TO anon, authenticated;

CREATE OR REPLACE VIEW public.v_active_leaders
WITH (security_invoker = true)
AS
SELECT
  l.id,
  l.scope_code,
  b.name_kiny AS boundary_name_kiny,
  b.name_eng AS boundary_name_eng,
  b.level,
  l.first_name,
  l.last_name,
  l.role,
  l.email,
  l.photo_url,
  l.valid_from,
  l.version
FROM public.leaders AS l
JOIN public.boundaries AS b ON b.scope_code = l.scope_code
WHERE l.valid_to IS NULL
  AND b.valid_to IS NULL;

COMMENT ON VIEW public.v_active_leaders IS
  'Active leaders joined with boundary names. Uses invoker RLS and deliberately excludes phone numbers.';

-- Remove policies before relocating the helper function objects.
DROP POLICY IF EXISTS "boundaries_public_read" ON public.boundaries;
DROP POLICY IF EXISTS "boundaries_super_admin_write" ON public.boundaries;
DROP POLICY IF EXISTS "boundaries_super_admin_insert" ON public.boundaries;
DROP POLICY IF EXISTS "boundaries_super_admin_update" ON public.boundaries;
DROP POLICY IF EXISTS "boundaries_super_admin_delete" ON public.boundaries;

DROP POLICY IF EXISTS "leaders_public_read" ON public.leaders;
DROP POLICY IF EXISTS "leaders_scoped_admin_write" ON public.leaders;
DROP POLICY IF EXISTS "leaders_scoped_admin_insert" ON public.leaders;
DROP POLICY IF EXISTS "leaders_scoped_admin_update" ON public.leaders;
DROP POLICY IF EXISTS "leaders_scoped_admin_delete" ON public.leaders;

DROP POLICY IF EXISTS "admin_profiles_self_read" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_super_admin_write" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_super_admin_insert" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_super_admin_update" ON public.admin_profiles;
DROP POLICY IF EXISTS "admin_profiles_super_admin_delete" ON public.admin_profiles;

DROP POLICY IF EXISTS "audit_logs_super_admin_read" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_no_direct_write" ON public.audit_logs;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE CREATE ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

ALTER FUNCTION public.is_current_user_super_admin() SET SCHEMA private;
ALTER FUNCTION public.current_user_admin_scope() SET SCHEMA private;
ALTER FUNCTION private.is_current_user_super_admin() SET search_path = '';
ALTER FUNCTION private.current_user_admin_scope() SET search_path = '';

REVOKE EXECUTE ON FUNCTION private.is_current_user_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.current_user_admin_scope() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_current_user_super_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_admin_scope() TO anon, authenticated;

-- One SELECT policy per table/action; write actions have separate scoped rules.
CREATE POLICY "boundaries_public_read"
  ON public.boundaries FOR SELECT TO anon, authenticated
  USING (valid_to IS NULL OR (SELECT private.is_current_user_super_admin()));

CREATE POLICY "boundaries_super_admin_insert"
  ON public.boundaries FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "boundaries_super_admin_update"
  ON public.boundaries FOR UPDATE TO authenticated
  USING ((SELECT private.is_current_user_super_admin()))
  WITH CHECK ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "boundaries_super_admin_delete"
  ON public.boundaries FOR DELETE TO authenticated
  USING ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "leaders_public_read"
  ON public.leaders FOR SELECT TO anon, authenticated
  USING (
    valid_to IS NULL
    OR (SELECT private.is_current_user_super_admin())
    OR scope_code = (SELECT private.current_user_admin_scope())
    OR scope_code LIKE (SELECT private.current_user_admin_scope()) || '-%'
  );

CREATE POLICY "leaders_scoped_admin_insert"
  ON public.leaders FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT private.is_current_user_super_admin())
    OR scope_code = (SELECT private.current_user_admin_scope())
    OR scope_code LIKE (SELECT private.current_user_admin_scope()) || '-%'
  );

CREATE POLICY "leaders_scoped_admin_update"
  ON public.leaders FOR UPDATE TO authenticated
  USING (
    (SELECT private.is_current_user_super_admin())
    OR scope_code = (SELECT private.current_user_admin_scope())
    OR scope_code LIKE (SELECT private.current_user_admin_scope()) || '-%'
  )
  WITH CHECK (
    (SELECT private.is_current_user_super_admin())
    OR scope_code = (SELECT private.current_user_admin_scope())
    OR scope_code LIKE (SELECT private.current_user_admin_scope()) || '-%'
  );

CREATE POLICY "leaders_scoped_admin_delete"
  ON public.leaders FOR DELETE TO authenticated
  USING (
    (SELECT private.is_current_user_super_admin())
    OR scope_code = (SELECT private.current_user_admin_scope())
    OR scope_code LIKE (SELECT private.current_user_admin_scope()) || '-%'
  );

CREATE POLICY "admin_profiles_self_read"
  ON public.admin_profiles FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.is_current_user_super_admin())
  );

CREATE POLICY "admin_profiles_super_admin_insert"
  ON public.admin_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "admin_profiles_super_admin_update"
  ON public.admin_profiles FOR UPDATE TO authenticated
  USING ((SELECT private.is_current_user_super_admin()))
  WITH CHECK ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "admin_profiles_super_admin_delete"
  ON public.admin_profiles FOR DELETE TO authenticated
  USING ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "audit_logs_super_admin_read"
  ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT private.is_current_user_super_admin()));

CREATE POLICY "audit_logs_no_direct_write"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (false);

COMMIT;
