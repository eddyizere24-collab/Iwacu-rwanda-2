-- IWACU RWANDA — reserve the national root scope for a super-admin.
-- Additive and safe for the current live data. Apply after the base admin_profiles table exists.
-- A pre-existing invalid national profile causes this migration to stop rather than silently change its rights.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.admin_profiles
    WHERE scope_code = 'RW'
      AND is_super_admin IS NOT TRUE
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce national-scope rule: fix any admin_profiles rows with scope_code RW and is_super_admin false first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.admin_profiles'::regclass
      AND conname = 'admin_profiles_national_scope_requires_super_admin'
  ) THEN
    ALTER TABLE public.admin_profiles
      ADD CONSTRAINT admin_profiles_national_scope_requires_super_admin
      CHECK (scope_code <> 'RW' OR is_super_admin IS TRUE);
  END IF;
END
$$;

COMMIT;
