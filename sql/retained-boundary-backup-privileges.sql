-- Defense-in-depth for retained pre-move boundary backups.
-- Keep the backup data intact while removing browser-role table privileges.
-- The current project still has RLS enabled with no policies on these tables.
BEGIN;
DO $cleanup$
BEGIN
  IF to_regclass('public._bak_boundaries_geom') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public._bak_boundaries_geom FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regclass('public._bak_boundaries_meta') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public._bak_boundaries_meta FROM PUBLIC, anon, authenticated';
  END IF;
END
$cleanup$;
COMMIT;
