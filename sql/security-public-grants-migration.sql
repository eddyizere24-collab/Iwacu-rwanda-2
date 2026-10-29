-- IWACU RWANDA — restrict public database grants
-- Apply once after the follow-up security hardening migration.
-- Does not enable RLS on spatial_ref_sys; that policy decision remains documented separately.

BEGIN;

-- The PostGIS-owned spatial_ref_sys grants could not be changed by the
-- connected database role (the relation owner is supabase_admin). That
-- finding is documented in SECURITY_AUDIT.md and remains unresolved.
-- The active-leaders view is a public read-only interface; do not leave
-- inherited/default DML grants on the view.
REVOKE ALL PRIVILEGES ON TABLE public.v_active_leaders FROM anon, authenticated;
GRANT SELECT ON TABLE public.v_active_leaders TO anon, authenticated;

COMMIT;
