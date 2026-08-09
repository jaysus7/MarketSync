-- Phase 4 Batch 1, step 5 — parts demand, reservation and issue.
-- Applied to STAGING only. Additive: a new table plus two functions built ON TOP of
-- the hardened stock path from step 1 — nothing here bypasses service_move_stock.
--
-- A request is DEMAND: "RO 123 line 2 needs part X qty 2". It is deliberately NOT a
-- stock movement, an order, or an issued part. Keeping demand separate from stock is
-- what lets Parts become its own department later without unpicking Service.
create table if not exists public.part_requests (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null,
  ro_id uuid not null,
  ro_line_id uuid,
  part_id uuid not null,
  qty_requested numeric not null check (qty_requested > 0),
  qty_reserved numeric not null default 0 check (qty_reserved >= 0),
  qty_issued numeric not null default 0 check (qty_issued >= 0),
  status text not null default 'requested'
    check (status in ('requested','reserved','backordered','issued','fulfilled','cancelled')),
  vendor text,
  eta date,
  note text,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  idempotency_key text,
  updated_at timestamptz not null default now(),
  constraint part_requests_not_over_issued check (qty_issued <= qty_requested),
  constraint part_requests_not_over_reserved check (qty_reserved <= qty_requested)
);
create unique index if not exists part_requests_idempotency_uk
  on public.part_requests (dealership_id, idempotency_key) where idempotency_key is not null;
create index if not exists part_requests_ro_idx on public.part_requests (dealership_id, ro_id, status);
create index if not exists part_requests_part_idx on public.part_requests (dealership_id, part_id, status);
alter table public.part_requests enable row level security;

-- Reserve against AVAILABLE (on_hand - reserved) under the part row lock, so two ROs
-- can never be promised the same physical unit. A short reserve is a real business
-- answer — backordered — not an error.
create or replace function public.service_reserve_part(
  p_dealership uuid, p_request uuid, p_qty numeric
) returns table (reserved numeric, available numeric, backordered numeric)
language plpgsql security definer set search_path = public as $$
declare v_req public.part_requests%rowtype; v_part public.parts%rowtype; v_avail numeric; v_take numeric;
begin
  select * into v_req from public.part_requests
   where id = p_request and dealership_id = p_dealership for update;
  if not found then raise exception 'parts request not found' using errcode = 'P0002'; end if;

  select * into v_part from public.parts
   where id = v_req.part_id and dealership_id = p_dealership for update;
  if not found then raise exception 'part not found' using errcode = 'P0002'; end if;

  v_avail := coalesce(v_part.qty_on_hand,0) - coalesce(v_part.qty_reserved,0);
  v_take  := least(coalesce(p_qty, v_req.qty_requested - v_req.qty_reserved),
                   v_req.qty_requested - v_req.qty_reserved,
                   greatest(v_avail, 0));

  if v_take > 0 then
    update public.parts set qty_reserved = coalesce(qty_reserved,0) + v_take, updated_at = now()
     where id = v_part.id and dealership_id = p_dealership;
    update public.part_requests set qty_reserved = qty_reserved + v_take, updated_at = now()
     where id = p_request;
    v_req.qty_reserved := v_req.qty_reserved + v_take;
  end if;

  update public.part_requests
     set status = case when v_req.qty_reserved >= v_req.qty_requested then 'reserved' else 'backordered' end,
         updated_at = now()
   where id = p_request and status not in ('issued','fulfilled','cancelled');

  return query select v_take, greatest(v_avail - v_take, 0), greatest(v_req.qty_requested - v_req.qty_reserved, 0);
end $$;

-- Issue releases the reservation and moves stock THROUGH service_move_stock, so the
-- ledger entry, the balance update and the idempotency guarantee are the same ones
-- step 1 built. Nothing here writes qty_on_hand directly.
create or replace function public.service_issue_part(
  p_dealership uuid, p_request uuid, p_qty numeric, p_user uuid default null, p_idempotency_key text default null
) returns table (issued numeric, on_hand numeric, request_status text)
language plpgsql security definer set search_path = public as $$
declare v_req public.part_requests%rowtype; v_take numeric; v_mv record; v_status text;
begin
  select * into v_req from public.part_requests
   where id = p_request and dealership_id = p_dealership for update;
  if not found then raise exception 'parts request not found' using errcode = 'P0002'; end if;

  v_take := least(coalesce(p_qty, v_req.qty_requested - v_req.qty_issued), v_req.qty_requested - v_req.qty_issued);
  if v_take <= 0 then
    return query select 0::numeric, (select qty_on_hand from public.parts where id = v_req.part_id), v_req.status;
    return;
  end if;

  select * into v_mv from public.service_move_stock(
    p_dealership, v_req.part_id, 'consume', -v_take, null, v_req.ro_id,
    'request:' || p_request::text, null, p_user, p_idempotency_key);

  if not v_mv.duplicate then
    update public.parts
       set qty_reserved = greatest(coalesce(qty_reserved,0) - least(v_take, coalesce(qty_reserved,0)), 0), updated_at = now()
     where id = v_req.part_id and dealership_id = p_dealership;
    update public.part_requests
       set qty_issued = qty_issued + v_take,
           qty_reserved = greatest(qty_reserved - least(v_take, qty_reserved), 0),
           updated_at = now()
     where id = p_request;
    v_req.qty_issued := v_req.qty_issued + v_take;
  end if;

  v_status := case when v_req.qty_issued >= v_req.qty_requested then 'fulfilled' else 'issued' end;
  update public.part_requests set status = v_status, updated_at = now() where id = p_request;
  return query select case when v_mv.duplicate then 0::numeric else v_take end, v_mv.on_hand, v_status;
end $$;

revoke all on function public.service_reserve_part(uuid,uuid,numeric) from public, anon, authenticated;
revoke all on function public.service_issue_part(uuid,uuid,numeric,uuid,text) from public, anon, authenticated;
