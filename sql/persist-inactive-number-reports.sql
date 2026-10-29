-- Persist citizen reports about inactive leader phone numbers.
CREATE TABLE IF NOT EXISTS public.inactive_number_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id text NOT NULL CHECK (length(leader_id) BETWEEN 1 AND 100),
  leader_name text NOT NULL CHECK (length(leader_name) BETWEEN 1 AND 160),
  reported_phone text NOT NULL CHECK (length(reported_phone) BETWEEN 1 AND 32),
  boundary_name text NOT NULL CHECK (length(boundary_name) BETWEEN 1 AND 200),
  citizen_comment text CHECK (citizen_comment IS NULL OR length(citizen_comment) <= 300),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT inactive_number_report_resolution_consistency
    CHECK (
      (status = 'pending' AND resolved_at IS NULL)
      OR (status IN ('resolved', 'dismissed') AND resolved_at IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_inactive_number_reports_status_created
  ON public.inactive_number_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inactive_number_reports_leader
  ON public.inactive_number_reports (leader_id);
ALTER TABLE public.inactive_number_reports ENABLE ROW LEVEL SECURITY;
-- schema.sql defines the deny-all policy for fresh installs; the separate
-- deny-browser-access-to-inactive-reports.sql migration reasserts it safely
-- when upgrading a database where this table was introduced later.

REVOKE ALL ON TABLE public.inactive_number_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inactive_number_reports TO service_role;
GRANT ALL ON TABLE public.inactive_number_reports TO postgres;
