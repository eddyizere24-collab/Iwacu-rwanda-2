-- Defense in depth: browser roles must never read or write citizen reports directly.
CREATE POLICY inactive_number_reports_deny_browser_access
  ON public.inactive_number_reports
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
