-- Supporting index for the inactive-number report resolver foreign key.
-- Apply after persist-inactive-number-reports.sql; safe to run more than once.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_inactive_number_reports_resolved_by
  ON public.inactive_number_reports (resolved_by);
COMMIT;
