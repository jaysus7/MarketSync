-- Phase 4 Batch 2 — closing an RO requires an explicit money outcome. STAGING only.
--
-- A zero balance is NOT required: carrying AR is a real dealership decision, and
-- warranty and internal work are settled other ways entirely. What is refused is an
-- IMPLICIT balance — closing without saying how the money ended.
alter table public.repair_orders add column if not exists financial_disposition text;
alter table public.repair_orders add column if not exists closed_balance numeric;

alter table public.repair_orders drop constraint if exists repair_orders_disposition_valid;
alter table public.repair_orders add constraint repair_orders_disposition_valid
  check (financial_disposition is null
         or financial_disposition in ('paid_in_full','partial_ar','ar','warranty','internal','goodwill'));

alter table public.repair_orders drop constraint if exists repair_orders_closed_needs_disposition;
alter table public.repair_orders add constraint repair_orders_closed_needs_disposition
  check (status <> 'closed' or financial_disposition is not null);
