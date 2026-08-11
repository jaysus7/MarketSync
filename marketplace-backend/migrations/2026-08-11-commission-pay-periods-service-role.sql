-- The canonical commission routes use the server-side Supabase client. The original
-- pay-period migration granted authenticated users through RLS but omitted the backend
-- service role entirely, causing every server read to fail before tenant scoping ran.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.commission_pay_periods
  TO service_role;
