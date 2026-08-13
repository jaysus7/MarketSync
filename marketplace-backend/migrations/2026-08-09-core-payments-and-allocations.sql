-- DealerOS CORE primitive — Payment + Allocation. Applied to STAGING only.
--
-- Discovered during Phase 4 Batch 2: MarketSync had NO payment record at all. Deposits
-- existed only as a Stripe checkout flow, a `deposit.paid` event and a journal entry —
-- nothing you could query to answer "what has this customer paid?".
--
-- This is deliberately NOT a Service table. The wrong fix is service_payments, then
-- deal_payments, then fni_payments, with Accounting trying to reconcile three of them.
-- Departments own workflows; the core owns universal business primitives, and a payment
-- is unquestionably one.
--
--   CUSTOMER → PAYMENT ─┬→ ALLOCATIONS → Service RO / vehicle deal / other receivable
--                       └→ UNAPPLIED (which is what a deposit actually is)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  contact_id uuid,
  amount numeric not null check (amount > 0),
  currency text not null default 'CAD',
  method text not null check (method in ('card','cash','cheque','eft','financing','other')),
  status text not null default 'pending'
    check (status in ('pending','received','failed','voided','partially_refunded','refunded')),
  refunded_amount numeric not null default 0 check (refunded_amount >= 0),
  processor text,
  processor_reference text,
  received_at timestamptz,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,   -- provider-specific state lives here,
                                                 -- so it never leaks into the canonical enum
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_refund_within_amount check (refunded_amount <= amount)
);

-- Idempotency at the DATABASE, not in application checks: a webhook retry or a repeated
-- API call collides here. Two independent keys because the provider and the caller each
-- have their own notion of "the same payment".
create unique index if not exists payments_processor_ref_uk
  on public.payments (dealership_id, processor, processor_reference)
  where processor_reference is not null;
create unique index if not exists payments_idempotency_uk
  on public.payments (dealership_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists payments_contact_idx on public.payments (dealership_id, contact_id, received_at desc);
alter table public.payments enable row level security;

-- WHERE the money was applied. A payment may be split across obligations, partially
-- applied, or left entirely unapplied. There is no canonical invoice object yet, so the
-- subject mechanism is small and explicit rather than open polymorphism.
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  payment_id uuid not null references public.payments(id),
  subject_type text not null check (subject_type in ('repair_order','deal','contact_credit')),
  subject_id uuid not null,
  amount numeric not null check (amount <> 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index if not exists payment_allocations_subject_idx
  on public.payment_allocations (dealership_id, subject_type, subject_id);
alter table public.payment_allocations enable row level security;

-- You cannot apply more money than arrived. Checked under the payment row lock, so two
-- concurrent allocations cannot both fit into the same remaining balance.
create or replace function public.payment_allocation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pay public.payments%rowtype; v_alloc numeric;
begin
  select * into v_pay from public.payments
   where id = new.payment_id and dealership_id = new.dealership_id for update;
  if not found then
    raise exception 'Payment not found for this dealership' using errcode = '23503';
  end if;
  select coalesce(sum(amount), 0) into v_alloc from public.payment_allocations where payment_id = new.payment_id;
  if v_alloc + new.amount > v_pay.amount then
    raise exception 'Allocating % would exceed the payment: % already applied of %',
      new.amount, v_alloc, v_pay.amount using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists payment_allocations_guard on public.payment_allocations;
create trigger payment_allocations_guard before insert on public.payment_allocations
  for each row execute function public.payment_allocation_guard();

-- A received payment is a financial record: amount, currency and provider identity are
-- frozen. Refunds are RECORDED, never simulated by rewriting the original.
create or replace function public.payments_protect() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status in ('received','partially_refunded','refunded') then
    if new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.dealership_id is distinct from old.dealership_id
       or new.processor_reference is distinct from old.processor_reference then
      raise exception 'A received payment cannot be rewritten. Record a refund or reversal instead.'
        using errcode = '23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists payments_protect_trg on public.payments;
create trigger payments_protect_trg before update on public.payments
  for each row execute function public.payments_protect();

create or replace function public.payments_no_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Payments are financial history and cannot be deleted' using errcode = '23514';
end $$;
drop trigger if exists payments_nodelete on public.payments;
create trigger payments_nodelete before delete on public.payments
  for each row execute function public.payments_no_delete();
