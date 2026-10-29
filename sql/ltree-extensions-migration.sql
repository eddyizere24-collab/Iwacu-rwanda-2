-- Move the relocatable ltree extension out of the exposed public schema.
-- Idempotent: safe for fresh installations where schema.sql already installs
-- ltree into extensions, and for existing installations where ltree is in public.
-- This intentionally does not attempt to move PostGIS; its existing geometry
-- dependencies should be handled through the supported Supabase Support process.

DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname
    INTO v_schema
    FROM pg_extension AS e
    JOIN pg_namespace AS n ON n.oid = e.extnamespace
   WHERE e.extname = 'ltree';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'The ltree extension is not installed.';
  ELSIF v_schema = 'public' THEN
    EXECUTE 'ALTER EXTENSION ltree SET SCHEMA extensions';
  ELSIF v_schema <> 'extensions' THEN
    RAISE EXCEPTION 'Expected ltree in public or extensions, found schema %.', v_schema;
  END IF;
END
$$;
