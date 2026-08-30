-- Close the RLS gap on the Batch 1-7 Discoverability evidence tables.
--
-- These tables shipped with RLS enabled but ZERO policies and full
-- INSERT/UPDATE/DELETE grants to `authenticated`. That is fail-closed only by
-- accident: RLS with no policy denies everything, so the standing write grants were
-- latent -- the moment any permissive policy were added, `authenticated` could write
-- crawl evidence, search metrics and attribution rows directly. This migration makes
-- the intent explicit rather than relying on the absence of a policy.
--
-- Same posture as the Batch 8A autopilot tables: dealership-scoped, permission-gated
-- read for `authenticated`; all writes stay backend-mediated through `supabaseAdmin`
-- (service_role carries BYPASSRLS). Verified before writing this: no Discoverability
-- route or service uses `req.supabase`, so nothing writes these tables as the caller.
--
-- `authz.has_permission(dealership_id, ...)` already folds tenant isolation and
-- platform-staff access into one per-row check (marketplace-backend/docs/rls-standard.md).

-- Parent resolvers for the child evidence tables, mirroring authz.inventory_dealership().
create or replace function authz.discoverability_crawl_run_dealership(p_crawl_run_id uuid)
returns uuid language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select dealership_id from public.discoverability_crawl_runs where id = p_crawl_run_id $function$;

create or replace function authz.discoverability_ai_run_dealership(p_run_id uuid)
returns uuid language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select dealership_id from public.discoverability_ai_benchmark_runs where id = p_run_id $function$;

create or replace function authz.discoverability_search_run_dealership(p_run_id uuid)
returns uuid language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$ select dealership_id from public.discoverability_search_sync_runs where id = p_run_id $function$;

-- Tables that carry dealership_id directly.
do $$
declare
  own_tables text[] := array[
    'discoverability_crawl_runs',
    'discoverability_ai_benchmark_runs',
    'discoverability_search_sync_runs',
    'discoverability_search_opportunities',
    'discoverability_search_impacts',
    'discoverability_local_rank_evidence',
    'discoverability_indexnow_submissions',
    'discoverability_sxo_snapshots',
    'discoverability_attribution_links'
  ];
  t text;
begin
  foreach t in array own_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_authorized', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (authz.has_permission(dealership_id, %L))',
      t || '_select_authorized', t, 'marketing.view'
    );
  end loop;
end $$;

-- Child tables resolve the parent run's dealership.
do $$
declare
  child_tables text[][] := array[
    array['discoverability_crawl_pages', 'crawl_run_id', 'discoverability_crawl_run_dealership'],
    array['discoverability_crawl_findings', 'crawl_run_id', 'discoverability_crawl_run_dealership'],
    array['discoverability_ai_benchmark_evidence', 'run_id', 'discoverability_ai_run_dealership'],
    array['discoverability_search_metrics', 'run_id', 'discoverability_search_run_dealership']
  ];
  i int;
  t text;
  col text;
  fn text;
begin
  for i in 1 .. array_length(child_tables, 1) loop
    t := child_tables[i][1];
    col := child_tables[i][2];
    fn := child_tables[i][3];
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_authorized', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (authz.has_permission(authz.%I(%I), %L))',
      t || '_select_authorized', t, fn, col, 'marketing.view'
    );
  end loop;
end $$;
