-- Phase 8 runtime repair: Stage 4 created this RLS-protected table before explicit Data API
-- grants were consistently recorded. Backend attention and canonical Fixed Ops actions use
-- the service-role client; this grant exposes the table to that trusted role while RLS stays
-- enabled for ordinary authenticated clients.
grant select, insert, update, delete on table public.part_requests to service_role;
