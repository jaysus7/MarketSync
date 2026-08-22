-- Grant service_role and authenticated permissions for identity_verifications
grant select, insert, update, delete on table public.identity_verifications to service_role, authenticated, postgres, anon;
