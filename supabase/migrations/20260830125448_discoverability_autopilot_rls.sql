-- Secure the existing Batch 8A Discoverability tables.
-- Mutations remain backend-mediated through supabaseAdmin; authenticated
-- clients receive read-only, dealership-scoped dashboard access.

alter table public.discoverability_findings enable row level security;
alter table public.discoverability_recommendations enable row level security;
alter table public.discoverability_autopilot_queue enable row level security;
alter table public.discoverability_autopilot_transitions enable row level security;
alter table public.discoverability_validation_jobs enable row level security;
alter table public.discoverability_autopilot_settings enable row level security;

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

drop policy if exists "discoverability_findings_select_authorized" on public.discoverability_findings;
drop policy if exists "discoverability_recommendations_select_authorized" on public.discoverability_recommendations;
drop policy if exists "discoverability_autopilot_queue_select_authorized" on public.discoverability_autopilot_queue;
drop policy if exists "discoverability_autopilot_transitions_select_authorized" on public.discoverability_autopilot_transitions;
drop policy if exists "discoverability_validation_jobs_select_authorized" on public.discoverability_validation_jobs;
drop policy if exists "discoverability_autopilot_settings_select_authorized" on public.discoverability_autopilot_settings;

do $$
begin
  if to_regprocedure('authz.current_dealership_id()') is not null
     and to_regprocedure('authz.has_permission(uuid,text)') is not null
     and to_regprocedure('authz.is_platform_staff()') is not null then
    create policy "discoverability_findings_select_authorized" on public.discoverability_findings
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
    create policy "discoverability_recommendations_select_authorized" on public.discoverability_recommendations
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
    create policy "discoverability_autopilot_queue_select_authorized" on public.discoverability_autopilot_queue
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
    create policy "discoverability_autopilot_transitions_select_authorized" on public.discoverability_autopilot_transitions
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
    create policy "discoverability_validation_jobs_select_authorized" on public.discoverability_validation_jobs
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
    create policy "discoverability_autopilot_settings_select_authorized" on public.discoverability_autopilot_settings
      for select to authenticated using (
        (dealership_id = (select authz.current_dealership_id())
          and authz.has_permission(dealership_id, 'marketing.view'))
        or (select authz.is_platform_staff())
      );
  end if;
end $$;
