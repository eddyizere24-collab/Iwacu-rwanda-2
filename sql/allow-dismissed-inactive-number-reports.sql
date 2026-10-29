-- Permit the API's dismissed report state while preserving resolution timestamps.
ALTER TABLE public.inactive_number_reports
  DROP CONSTRAINT IF EXISTS inactive_number_reports_status_check;
ALTER TABLE public.inactive_number_reports
  DROP CONSTRAINT IF EXISTS inactive_number_report_resolution_consistency;
ALTER TABLE public.inactive_number_reports
  ADD CONSTRAINT inactive_number_reports_status_check
    CHECK (status IN ('pending', 'resolved', 'dismissed'));
ALTER TABLE public.inactive_number_reports
  ADD CONSTRAINT inactive_number_report_resolution_consistency
    CHECK (
      (status = 'pending' AND resolved_at IS NULL)
      OR (status IN ('resolved', 'dismissed') AND resolved_at IS NOT NULL)
    );
