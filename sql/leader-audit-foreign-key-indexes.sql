-- IWACU RWANDA — supporting indexes for leader audit foreign keys
-- Applied to Supabase project buexgewxypvkqmphvfec on 2026-10-29.
-- Safe/idempotent: these indexes improve joins and user-reference lookups.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_leaders_created_by ON public.leaders(created_by);
CREATE INDEX IF NOT EXISTS idx_leaders_updated_by ON public.leaders(updated_by);
COMMIT;
