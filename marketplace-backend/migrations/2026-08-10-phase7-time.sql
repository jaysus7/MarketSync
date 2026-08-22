-- Phase 7 PR 7.4 — the time clock, and payroll that cannot quietly pay nobody.
--
-- CURRENT TRUTH, found by reading the code against the live database:
--
--   `time_entries` has ONE reference in the entire backend — a `.select()` in
--   `roActualHours` (service-engine.js) — and 0 rows. Nothing clocks anybody in, on any
--   surface, in any role. The comment above that function reads "Actual labour comes from the
--   existing payroll clock", and there is no payroll clock. So every repair order's actual
--   hours is structurally 0.0, and it renders as "no labour recorded" rather than "there is no
--   clock" — an operational number, silently empty. AGENTS.md A19, eighth instance.
--
--   `staff_payroll_items` is read twice and written NOWHERE. A payroll batch can be created
--   and is always empty, and `GET /hr/payroll/batches/:id/export` returns 200 with a CSV of
--   headers and zero rows. A controller exporting payroll gets a successful empty file, which
--   reads as "nobody is owed anything". "Empty success is a failure mode", on payroll.
--
-- APPLIED TO STAGING ONLY.

-- ── Whose time is this? ─────────────────────────────────────────────────────
-- `employee_id` carried NO foreign key at all — not to `profiles`, not to `staff_members`,
-- not even a dealership-scoped one. Any uuid was accepted, including an employee of another
-- dealership, on the record that decides what somebody gets paid.
--
-- It points at `staff_members` because time is a fact about EMPLOYMENT, not about a login:
-- a terminated employee's hours must survive their account, and a login with no employment
-- record has nothing to be paid against. Composite, so the row cannot cross tenants — the
-- same shape every other staff table already uses.
delete from public.time_entries te
  where not exists (select 1 from public.staff_members s
                    where s.id = te.employee_id and s.dealership_id = te.dealership_id);

do $$ begin
  alter table public.time_entries
    add constraint time_entries_employee_same_dealer
    foreign key (employee_id, dealership_id)
    references public.staff_members(id, dealership_id) on delete cascade;
exception when duplicate_object then null; end $$;

-- A person is in one place at a time. Two open entries means somebody clocked in twice and
-- every hour after that is double-counted — enforced here rather than in a route, because a
-- route can be raced and this decides pay.
create unique index if not exists time_entries_one_open_per_employee
  on public.time_entries (dealership_id, employee_id) where clock_out is null;

create index if not exists time_entries_employee_period_idx
  on public.time_entries (dealership_id, employee_id, clock_in desc);

-- An approved entry must actually be finished and must record who approved it. Approval is
-- what turns recorded time into money, so it cannot be a flag somebody sets in passing.
do $$ begin
  alter table public.time_entries add constraint time_entries_approval_complete
    check (status <> 'approved' or (clock_out is not null and approved_by is not null and approved_at is not null));
exception when duplicate_object then null; end $$;

-- Break time cannot exceed the shift, or the entry pays negative hours.
do $$ begin
  alter table public.time_entries add constraint time_entries_break_within_shift
    check (clock_out is null or break_minutes <= (extract(epoch from (clock_out - clock_in)) / 60));
exception when duplicate_object then null; end $$;

-- ── The change history was itself dead ──────────────────────────────────────
-- `time_entry_change_history` had zero references. A manager edit to somebody's hours left no
-- trace, which is the whole reason the table exists.
do $$ begin
  alter table public.time_entry_change_history
    add constraint time_entry_change_history_entry_same_dealer
    foreign key (time_entry_id, dealership_id)
    references public.time_entries(id, dealership_id) on delete cascade;
exception when duplicate_object | undefined_object then null; end $$;

-- The composite target above needs `time_entries` to be uniquely addressable by the pair.
do $$ begin
  alter table public.time_entries add constraint time_entries_id_dealership_unique unique (id, dealership_id);
exception when duplicate_object | duplicate_table then null; end $$;

create index if not exists time_entry_change_history_entry_idx
  on public.time_entry_change_history (time_entry_id, created_at desc);

-- History is evidence. It is written once and never rewritten, the same rule
-- `staff_status_history` already carries.
create or replace function public.reject_time_entry_history_mutation()
returns trigger language plpgsql as $fn$
begin
  raise exception 'Time entry change history is append-only';
end $fn$;

drop trigger if exists time_entry_change_history_append_only on public.time_entry_change_history;
create trigger time_entry_change_history_append_only
  before update or delete on public.time_entry_change_history
  for each row execute function public.reject_time_entry_history_mutation();

-- ── Payroll items must name a real employee, and a real batch ───────────────
do $$ begin
  alter table public.staff_payroll_items
    add constraint staff_payroll_items_staff_same_dealer
    foreign key (staff_member_id, dealership_id)
    references public.staff_members(id, dealership_id) on delete restrict;
exception when duplicate_object | undefined_object then null; end $$;

-- One line per employee per batch. Running the calculation twice must correct the line, not
-- pay somebody twice.
create unique index if not exists staff_payroll_items_one_per_staff_per_batch
  on public.staff_payroll_items (batch_id, staff_member_id);

alter table public.time_entries enable row level security;
alter table public.time_entry_change_history enable row level security;

-- ── Who may clock, and who may approve ──────────────────────────────────────
-- `staff.time.approve` already existed in the catalog and was granted to nobody, because there
-- was no clock to approve. Clocking your own time is a separate, much smaller permission:
-- everybody who works here does it, and it must never imply seeing anybody else's hours.
insert into public.permissions (id, description)
select id, descr from (values
  ('staff.time.self', 'Clock your own time in and out, and see your own entries')
) as v(id, descr)
where not exists (select 1 from public.permissions p where p.id = v.id);

insert into public.role_permissions (role_id, permission_id)
select r, 'staff.time.self' from
  (values ('dealer_owner'),('dealer_group_owner'),('general_manager'),('sales_manager'),
          ('fni_manager'),('service_manager'),('accounting'),('salesperson'),('bdc'),
          ('technician')) as roles(r)
where not exists (select 1 from public.role_permissions rp where rp.role_id=roles.r and rp.permission_id='staff.time.self');

-- Approving somebody else's hours is a management act, and it decides pay.
insert into public.role_permissions (role_id, permission_id)
select r, 'staff.time.approve' from
  (values ('dealer_owner'),('dealer_group_owner'),('general_manager'),('sales_manager'),
          ('fni_manager'),('service_manager'),('accounting')) as roles(r)
where not exists (select 1 from public.role_permissions rp where rp.role_id=roles.r and rp.permission_id='staff.time.approve');
