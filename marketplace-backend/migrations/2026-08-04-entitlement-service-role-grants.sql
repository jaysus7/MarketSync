-- The access service resolves product, plan, feature, membership, and per-user
-- entitlement rows with the server-only Supabase service-role client. RLS still
-- protects browser clients; these grants do not expose the tables to anon or
-- authenticated. Without them PostgREST returns permission denied, which used to
-- make a paid Pro account appear to have no features at all.

grant select on table
  public.products,
  public.features,
  public.plans,
  public.plan_products,
  public.plan_features
to service_role;

grant select, insert, update, delete on table
  public.subscriptions,
  public.product_memberships,
  public.member_permission_overrides
to service_role;
