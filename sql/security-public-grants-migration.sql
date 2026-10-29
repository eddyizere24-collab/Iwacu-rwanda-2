-- IWACU RWANDA — restrict public database grants
-- Apply once after the follow-up security hardening migration.
-- Does not enable RLS on spatial_ref_sys; that policy decision remains documented separately.

BEGIN;

-- PostGIS keeps this table as static coordinate-system metadata.
-- Browser roles may read definitions, but must never modify the extension-owned data.
REVOKE ALL PRIVILEGES ON TABLE public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated;

-- The active-leaders view is a public read-only interface; do not leave
-- inherited/default DML grants on the view.
REVOKE ALL PRIVILEGES ON TABLE public.v_active_leaders FROM anon, authenticated;
GRANT SELECT ON TABLE public.v_active_leaders TO anon, authenticated;

COMMIT;
