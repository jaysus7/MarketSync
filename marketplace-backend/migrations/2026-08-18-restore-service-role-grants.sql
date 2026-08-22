-- Restore service_role's table/sequence grants in `public`.
--
-- service_role is the backend's privileged key: it bypasses RLS and is never
-- exposed to clients (only used server-side via supabaseAdmin). Supabase grants
-- it on every public object by default, but on STAGING a batch of recent tables
-- (sales_videos, sales_video_events, campaigns, payments, reviews, time_entries,
-- deal_finalizations, review_requests, staff_payroll_*, … ~46 in all) were
-- created without the service_role grant. Any supabaseAdmin query against them
-- failed at the Postgres GRANT check with:
--
--     permission denied for table sales_videos
--
-- (first surfaced as a red toast when sending a Video Studio walkaround).
--
-- This does NOT change data, schema, or RLS — RLS stays enabled and service_role
-- bypasses it as designed; this only restores the grant the role is supposed to
-- have, and sets the default so future tables get it too.
--
-- APPLIED TO STAGING via Supabase (migration `restore_service_role_grants`) on
-- 2026-08-18. Production already had the grants (verified: 0 tables missing), so
-- this is a no-op there but kept for parity / future environments.

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
