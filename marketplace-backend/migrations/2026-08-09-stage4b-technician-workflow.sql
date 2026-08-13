-- Phase 4 Batch 1, step 4 — technician workflow on the existing job unit.
-- Applied to STAGING only. Additive columns + constraints on ro_lines.
--
-- No ro_jobs table: ro_lines already IS the unit of work. Giving a job a second
-- identity would split the same work across two records and guarantee they drift.
alter table public.ro_lines add column if not exists concern text;
alter table public.ro_lines add column if not exists cause text;
alter table public.ro_lines add column if not exists correction text;
alter table public.ro_lines add column if not exists op_code text;
alter table public.ro_lines add column if not exists pay_type text;
alter table public.ro_lines add column if not exists recommended boolean not null default false;
alter table public.ro_lines add column if not exists line_status text not null default 'pending';
alter table public.ro_lines add column if not exists started_at timestamptz;
alter table public.ro_lines add column if not exists completed_at timestamptz;
alter table public.ro_lines add column if not exists blocked_reason text;
alter table public.ro_lines add column if not exists hours_actual numeric;

alter table public.ro_lines drop constraint if exists ro_lines_line_status_valid;
alter table public.ro_lines add constraint ro_lines_line_status_valid
  check (line_status in ('pending','assigned','in_progress','blocked','complete','qc','declined'));

alter table public.ro_lines drop constraint if exists ro_lines_pay_type_valid;
alter table public.ro_lines add constraint ro_lines_pay_type_valid
  check (pay_type is null or pay_type in ('customer','warranty','internal','goodwill'));

-- A blocked job must say what it is waiting for, or the shop cannot act on it.
alter table public.ro_lines drop constraint if exists ro_lines_blocked_needs_reason;
alter table public.ro_lines add constraint ro_lines_blocked_needs_reason
  check (line_status <> 'blocked' or nullif(btrim(coalesce(blocked_reason,'')),'') is not null);

create index if not exists ro_lines_tech_idx on public.ro_lines (dealership_id, tech_id, line_status)
  where deleted_at is null;

-- Advisor/desk work: estimates, customer authorization, technician assignment, moving
-- the car toward the customer. Deliberately NOT granted to technicians — a technician
-- finishes jobs, they do not run the customer's transaction.
insert into public.permissions (id, description)
  values ('service.manage_workflow', 'Advisor/desk work: estimates, customer authorization, technician assignment')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r, 'service.manage_workflow'
from unnest(array['platform_owner','dealer_group_owner','dealer_owner','general_manager','service_manager']) r
on conflict do nothing;
