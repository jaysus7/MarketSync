-- FIX: the HQ tables were created with RLS enabled but service_role was never
-- granted table privileges. The backend accesses them with the service role
-- (supabaseAdmin), so every query failed with "permission denied for table ..."
-- (surfaced to the UI as the Follow-ups page erroring / other HQ reads coming back
-- empty). RLS-bypass is not grant-bypass — the role still needs table GRANTs.
grant all on public.saas_account_followups     to service_role;
grant all on public.saas_sequences             to service_role;
grant all on public.saas_sequence_steps        to service_role;
grant all on public.saas_email_templates       to service_role;
grant all on public.saas_campaigns             to service_role;
grant all on public.saas_sequence_enrollments  to service_role;
grant all on public.saas_sequence_events       to service_role;
grant all on public.saas_checkout_sessions     to service_role;
