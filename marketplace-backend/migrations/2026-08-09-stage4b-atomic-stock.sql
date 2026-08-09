-- Phase 4 Batch 1, step 1 — make parts stock mutation atomic.
-- Applied to STAGING (hpxnjbdiaaoopxeayfen) only. Production untouched.
--
-- Additive and backward compatible: the previous code path keeps working against this
-- schema, so the migration is safe on its own.
--
-- Stage 4A found `moveStock` reading qty_on_hand into Node, adding to it and writing
-- the sum back, with no transaction, no row lock and no idempotency key. Two people
-- touching the same part at once lost an update, and nothing stopped stock going
-- negative. Reservation and issue are built on this next, so it is hardened first.
alter table public.parts add column if not exists qty_reserved numeric not null default 0;
alter table public.part_txns add column if not exists idempotency_key text;

create unique index if not exists part_txns_idempotency_uk
  on public.part_txns (dealership_id, idempotency_key)
  where idempotency_key is not null;

alter table public.parts drop constraint if exists parts_qty_nonnegative;
alter table public.parts add constraint parts_qty_nonnegative
  check (qty_on_hand >= 0 and qty_reserved >= 0);

-- One movement = one locked row + one ledger entry + one balance update, or nothing.
-- The insufficient-stock check happens INSIDE the lock, so its answer is authoritative
-- rather than a guess against a stale read.
create or replace function public.service_move_stock(
  p_dealership uuid, p_part uuid, p_txn_type text, p_qty numeric,
  p_unit_cost numeric default null, p_ro uuid default null,
  p_reference text default null, p_note text default null,
  p_user uuid default null, p_idempotency_key text default null
) returns table (txn_id uuid, on_hand numeric, reserved numeric, reorder_point numeric, part_number text, duplicate boolean)
language plpgsql security definer set search_path = public as $$
declare v_part public.parts%rowtype; v_txn uuid; v_new numeric;
begin
  -- A retry returns the original result and moves nothing.
  if p_idempotency_key is not null then
    select id into v_txn from public.part_txns
     where dealership_id = p_dealership and idempotency_key = p_idempotency_key;
    if found then
      select * into v_part from public.parts where id = p_part and dealership_id = p_dealership;
      return query select v_txn, v_part.qty_on_hand, v_part.qty_reserved, v_part.reorder_point, v_part.part_number, true;
      return;
    end if;
  end if;

  select * into v_part from public.parts
   where id = p_part and dealership_id = p_dealership
   for update;
  if not found then raise exception 'part not found' using errcode = 'P0002'; end if;

  v_new := round(coalesce(v_part.qty_on_hand, 0) + p_qty, 2);
  if v_new < 0 then
    raise exception 'Insufficient stock for %: % on hand, % requested',
      v_part.part_number, v_part.qty_on_hand, abs(p_qty) using errcode = '23514';
  end if;

  insert into public.part_txns
    (dealership_id, part_id, txn_type, qty, unit_cost, ro_id, reference, note, created_by, idempotency_key)
  values
    (p_dealership, p_part, p_txn_type, p_qty, coalesce(p_unit_cost, v_part.cost),
     p_ro, p_reference, p_note, p_user, p_idempotency_key)
  returning id into v_txn;

  update public.parts set qty_on_hand = v_new, updated_at = now()
   where id = p_part and dealership_id = p_dealership;

  return query select v_txn, v_new, v_part.qty_reserved, v_part.reorder_point, v_part.part_number, false;
end $$;

revoke all on function public.service_move_stock(uuid,uuid,text,numeric,numeric,uuid,text,text,uuid,text) from public, anon, authenticated;
