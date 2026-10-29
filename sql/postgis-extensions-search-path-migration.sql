-- Prepare app-owned PostGIS routines for the supported move of PostGIS to extensions.
-- Safe before the move: public remains in search_path, so current extension lookups still work.
-- Apply once after the existing security-hardening migration.
BEGIN;
ALTER FUNCTION public.calculate_location_confidence(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.ingest_boundary_feature(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  SET search_path = pg_catalog, public, extensions;
ALTER FUNCTION public.ingest_boundary_batch(JSONB)
  SET search_path = pg_catalog, public, extensions;
COMMIT;
