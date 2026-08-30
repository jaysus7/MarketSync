-- Secure the Batch 8A Discoverability autopilot tables.
--
-- Canonical pattern: marketplace-backend/migrations/_TEMPLATE-new-table-rls.sql and
-- marketplace-backend/docs/rls-standard.md. `authz.has_permission(dealership_id,
-- '<domain>.<action>')` already folds tenant isolation AND platform-staff access into a
-- single per-row check, so the policies below deliberately do not add a separate
-- dealership predicate -- doing so would duplicate (and could contradict) that helper.
--
-- Reads:  dealership-scoped, permission-gated, read-only for `authenticated`.
-- Writes: no `authenticated` write policy, by design. Findings, recommendations, the
--         autopilot queue, its transitions and validation jobs are mutated only by the
--         backend remediation workflow through `supabaseAdmin` (service_role, which
--         carries BYPASSRLS). Dealers act on this data through the approval endpoints,
--         never by writing rows directly. This is intentionally stricter than the
--         four-policy template.
--
-- `marketing.view` is the existing catalogued permission for this product surface; no
-- new permission string is introduced, so no role_permissions grant is required here.

alter table public.discoverability_findings enable row level security;
alter table public.discoverability_findings force row level security;
alter table public.discoverability_recommendations enable row level security;
alter table public.discoverability_recommendations force row level security;
alter table public.discoverability_autopilot_queue enable row level security;
alter table public.discoverability_autopilot_queue force row level security;
alter table public.discoverability_autopilot_transitions enable row level security;
alter table public.discoverability_autopilot_transitions force row level security;
alter table public.discoverability_validation_jobs enable row level security;
alter table public.discoverability_validation_jobs force row level security;
alter table public.discoverability_autopilot_settings enable row level security;
alter table public.discoverability_autopilot_settings force row level security;

revoke all on table public.discoverability_findings,
  public.discoverability_recommendations,
  public.discoverability_autopilot_queue,
  public.discoverability_autopilot_transitions,
  public.discoverability_validation_jobs,
  public.discoverability_autopilot_settings from anon, authenticated;

grant select on table public.discoverability_findings,
  public.discoverability_recommendations,
  public.discoverability_autopilot_queue,
  public.discoverability_autopilot_transitions,
  public.discoverability_validation_jobs,
  public.discoverability_autopilot_settings to authenticated;

-- Idempotent: drop before create so the migration is safe to re-run.
drop policy if exists "discoverability_findings_select_authorized" on public.discoverability_findings;
drop policy if exists "discoverability_recommendations_select_authorized" on public.discoverability_recommendations;
drop policy if exists "discoverability_autopilot_queue_select_authorized" on public.discoverability_autopilot_queue;
drop policy if exists "discoverability_autopilot_transitions_select_authorized" on public.discoverability_autopilot_transitions;
drop policy if exists "discoverability_validation_jobs_select_authorized" on public.discoverability_validation_jobs;
drop policy if exists "discoverability_autopilot_settings_select_authorized" on public.discoverability_autopilot_settings;

-- The `authz` helper layer ships through marketplace-backend/migrations, not through
-- supabase/migrations. If it is not present yet (e.g. a bare `supabase db reset`), skip
-- policy creation rather than failing the migration. That leaves RLS enabled with zero
-- policies, which is fail-closed: `authenticated` reads nothing until the authz layer
-- and these policies are both in place.
do $$
begin
  if to_regprocedure('authz.has_permission(uuid,text)') is null then
    raise notice 'authz.has_permission(uuid,text) not found; skipping Discoverability autopilot policies (tables remain RLS-enabled and deny-all for authenticated)';
    return;
  end if;

  create policy "discoverability_findings_select_authorized" on public.discoverability_findings
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));

  create policy "discoverability_recommendations_select_authorized" on public.discoverability_recommendations
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));

  create policy "discoverability_autopilot_queue_select_authorized" on public.discoverability_autopilot_queue
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));

  create policy "discoverability_autopilot_transitions_select_authorized" on public.discoverability_autopilot_transitions
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));

  create policy "discoverability_validation_jobs_select_authorized" on public.discoverability_validation_jobs
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));

  create policy "discoverability_autopilot_settings_select_authorized" on public.discoverability_autopilot_settings
    for select to authenticated
    using (authz.has_permission(dealership_id, 'marketing.view'));
end $$;
