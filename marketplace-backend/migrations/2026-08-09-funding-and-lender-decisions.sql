-- Stage 3 — canonical funding state + lender decisions.
-- Additive + idempotent. See docs/STAGE3_INVENTORY_FNI_AUDIT.md §4/§8.
--
-- WHY THESE EXIST (the "why can't the canonical record represent this?" test):
--   funding_*  — `deals` already carries approved_at / credit_app_at / sold_at /
--                delivered_at but has NO funding state, so the funding queue had
--                nothing to read and `funding.received` had no transition to fire
--                from. Three small columns on the deal, not a new deal record.
--   lender     — a deal can legitimately be submitted to, and receive answers from,
--   decisions    SEVERAL lenders. No existing canonical record can hold a
--                one-to-many set of decisions, so this is genuinely new business
--                state. It references the deal and the lender; it deliberately
--                stores NO customer, vehicle or deal data of its own.

-- ── 1. Funding state on the canonical deal ───────────────────────────────────
-- Intentionally small vocabulary. `deals` must not become a lender-response table.
alter table public.deals add column if not exists funding_status text;
alter table public.deals add column if not exists funded_at timestamptz;
alter table public.deals add column if not exists funding_submitted_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'deals_funding_status_chk') then
    alter table public.deals add constraint deals_funding_status_chk
      check (funding_status is null or funding_status in
        ('not_required','pending','submitted','conditions','funded','exception'));
  end if;
end $$;

create index if not exists deals_funding_status_idx on public.deals(dealership_id, funding_status);

-- ── 2. Lender decisions (one deal → many lender answers) ─────────────────────
create table if not exists public.deal_lender_decisions (
  id                uuid primary key default gen_random_uuid(),
  dealership_id     uuid not null,
  deal_id           uuid not null references public.deals(id) on delete cascade,
  lender_id         uuid references public.lenders(id) on delete set null,
  -- submission → response
  submission_status text not null default 'draft',
  submitted_at      timestamptz,
  responded_at      timestamptz,
  decision          text,                    -- approved | conditional | declined | pending
  rate              numeric(6,3),
  term_months       integer,
  approved_amount   numeric(12,2),
  conditions        text,
  approval_expires_on date,
  -- exactly one selected decision per deal (enforced by the index below)
  selected          boolean not null default false,
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_by        uuid,
  updated_at        timestamptz not null default now(),
  constraint dld_submission_status_chk check (submission_status in ('draft','submitted','responded','withdrawn','expired')),
  constraint dld_decision_chk check (decision is null or decision in ('approved','conditional','declined','pending'))
);

create index if not exists dld_deal_idx   on public.deal_lender_decisions(deal_id);
create index if not exists dld_dealer_idx on public.deal_lender_decisions(dealership_id);
create index if not exists dld_lender_idx on public.deal_lender_decisions(lender_id);

-- "Only one lender decision can be selected for a deal at a time" — enforced in the
-- database, not just the application, so a concurrent write cannot produce two.
create unique index if not exists dld_one_selected_per_deal
  on public.deal_lender_decisions(deal_id) where selected;

-- ── 3. RLS — tenant + permission scoped, matching the F&I convention ─────────
-- Reads follow deal visibility (deal.approve is the F&I authority already used by
-- /fni/lenders); writes require it. Sales must not read finance terms here.
alter table public.deal_lender_decisions enable row level security;

drop policy if exists dld_select on public.deal_lender_decisions;
create policy dld_select on public.deal_lender_decisions for select
  using (authz.has_permission(dealership_id,'deal.approve') or authz.has_permission(dealership_id,'accounting.view'));
drop policy if exists dld_insert on public.deal_lender_decisions;
create policy dld_insert on public.deal_lender_decisions for insert
  with check (authz.has_permission(dealership_id,'deal.approve'));
drop policy if exists dld_update on public.deal_lender_decisions;
create policy dld_update on public.deal_lender_decisions for update
  using (authz.has_permission(dealership_id,'deal.approve'))
  with check (authz.has_permission(dealership_id,'deal.approve'));
drop policy if exists dld_delete on public.deal_lender_decisions;
create policy dld_delete on public.deal_lender_decisions for delete
  using (authz.has_permission(dealership_id,'deal.approve'));
