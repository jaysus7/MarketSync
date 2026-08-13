-- People / HR engine — plan gate, granular permissions, and payroll schema.
-- Additive + idempotent: creates the os.people feature, its plan entitlements
-- (Growth/Pro/Enterprise), the missing granular staff permissions (payroll,
-- compensation, self-service) with role grants, and the payroll tables with RLS.
-- Matches existing conventions: features.id = 'os.*', authz.has_permission(dealership_id, perm)
-- + authz.is_staff_self(staff_member_id) for tenant/permission scoping.

-- ── 1. Feature: os.people (product dealer_os, admin group) ────────────────────
insert into public.features (id, product_id, name, feature_group, description, sort_order)
select 'os.people', 'dealer_os', 'People / HR', 'admin',
       'Employee directory, onboarding, compliance, time-off, documents and payroll.',
       coalesce((select max(sort_order) from public.features where product_id='dealer_os'), 0) + 1
where not exists (select 1 from public.features where id='os.people');

-- ── 2. Plan gating — People is a Growth+ capability ───────────────────────────
insert into public.plan_features (plan_id, feature_id)
select p, 'os.people' from (values ('os_growth'),('os_pro'),('os_enterprise')) as v(p)
where exists (select 1 from public.plans where id = v.p)
  and not exists (select 1 from public.plan_features pf where pf.plan_id=v.p and pf.feature_id='os.people');

-- ── 3. Granular permissions (payroll, compensation, self-service) ─────────────
insert into public.permissions (id, description)
select id, descr from (values
  ('staff.payroll.view',      'View payroll batches and items'),
  ('staff.payroll.manage',    'Create, edit and approve payroll batches'),
  ('staff.payroll.export',    'Export payroll to accounting/providers'),
  ('staff.compensation.view', 'View employee compensation details'),
  ('staff.leave.self',        'Submit and view your own time-off requests'),
  ('staff.documents.self',    'View your own HR documents'),
  ('staff.training.self',     'View and complete your own assigned training')
) as v(id, descr)
where not exists (select 1 from public.permissions p where p.id = v.id);

-- ── 4. Role grants ────────────────────────────────────────────────────────────
-- Payroll + compensation: owners, GM and accounting only.
insert into public.role_permissions (role_id, permission_id)
select r, perm from
  (values ('dealer_owner'),('dealer_group_owner'),('general_manager'),('accounting')) as roles(r),
  (values ('staff.payroll.view'),('staff.payroll.manage'),('staff.payroll.export'),('staff.compensation.view')) as perms(perm)
where not exists (select 1 from public.role_permissions rp where rp.role_id=roles.r and rp.permission_id=perms.perm);

-- Self-service (own leave + own documents): every non-platform role.
insert into public.role_permissions (role_id, permission_id)
select r, perm from
  (values ('dealer_owner'),('dealer_group_owner'),('general_manager'),('sales_manager'),
          ('fni_manager'),('service_manager'),('accounting'),('salesperson'),('bdc'),
          ('technician'),('read_only')) as roles(r),
  (values ('staff.leave.self'),('staff.documents.self'),('staff.training.self')) as perms(perm)
where not exists (select 1 from public.role_permissions rp where rp.role_id=roles.r and rp.permission_id=perms.perm);

-- ── 5. Payroll tables ─────────────────────────────────────────────────────────
create table if not exists public.staff_payroll_batches (
  id            uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'draft',   -- draft | approved | exported
  notes         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  constraint staff_payroll_batches_status_chk check (status in ('draft','approved','exported'))
);

create table if not exists public.staff_payroll_items (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.staff_payroll_batches(id) on delete cascade,
  dealership_id   uuid not null,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  gross_amount    numeric(12,2) not null default 0,
  deductions      numeric(12,2) not null default 0,
  net_amount      numeric(12,2) not null default 0,
  currency        text not null default 'CAD',
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists staff_payroll_batches_dealer_idx on public.staff_payroll_batches(dealership_id);
create index if not exists staff_payroll_items_batch_idx     on public.staff_payroll_items(batch_id);
create index if not exists staff_payroll_items_dealer_idx    on public.staff_payroll_items(dealership_id);
create index if not exists staff_payroll_items_staff_idx     on public.staff_payroll_items(staff_member_id);

-- ── 6. RLS — tenant + permission scoped (manager-only; no self access) ─────────
alter table public.staff_payroll_batches enable row level security;
alter table public.staff_payroll_items   enable row level security;

drop policy if exists staff_payroll_batches_select on public.staff_payroll_batches;
create policy staff_payroll_batches_select on public.staff_payroll_batches for select
  using (authz.has_permission(dealership_id,'staff.payroll.view') or authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_batches_insert on public.staff_payroll_batches;
create policy staff_payroll_batches_insert on public.staff_payroll_batches for insert
  with check (authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_batches_update on public.staff_payroll_batches;
create policy staff_payroll_batches_update on public.staff_payroll_batches for update
  using (authz.has_permission(dealership_id,'staff.payroll.manage'))
  with check (authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_batches_delete on public.staff_payroll_batches;
create policy staff_payroll_batches_delete on public.staff_payroll_batches for delete
  using (authz.has_permission(dealership_id,'staff.payroll.manage'));

drop policy if exists staff_payroll_items_select on public.staff_payroll_items;
create policy staff_payroll_items_select on public.staff_payroll_items for select
  using (authz.has_permission(dealership_id,'staff.payroll.view') or authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_items_insert on public.staff_payroll_items;
create policy staff_payroll_items_insert on public.staff_payroll_items for insert
  with check (authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_items_update on public.staff_payroll_items;
create policy staff_payroll_items_update on public.staff_payroll_items for update
  using (authz.has_permission(dealership_id,'staff.payroll.manage'))
  with check (authz.has_permission(dealership_id,'staff.payroll.manage'));
drop policy if exists staff_payroll_items_delete on public.staff_payroll_items;
create policy staff_payroll_items_delete on public.staff_payroll_items for delete
  using (authz.has_permission(dealership_id,'staff.payroll.manage'));
