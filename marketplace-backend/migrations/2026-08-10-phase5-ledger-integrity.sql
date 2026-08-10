-- Phase 5 PR 5.1 — Ledger Integrity.
--
-- Establishes the authoritative posted ledger. Written to be idempotent and
-- environment-agnostic so PRODUCTION can later converge onto this same safe model by
-- running this file unchanged. APPLIED TO STAGING ONLY in this PR.
--
-- The controls here already existed on staging and were absent on production; nothing
-- below weakens a staging control to match production. Direction of travel is
-- production → staging's model, never the reverse.
--
-- The central design point: `posted` is flipped to true LAST, as its own UPDATE, so the
-- posting trigger's balance and line-count checks actually run. Under the previous code
-- the flag was left to a column default and the checks never fired at all.

-- ── 1. `posted` must not be decided by a column default ─────────────────────
-- A journal is born a draft and becomes authoritative only by an explicit act.
-- Production defaults this to true, which would post an empty header before its lines
-- exist; staging already defaults false. Converge on false.
alter table public.journal_entries alter column posted set default false;

-- ── 2. Idempotency is a database guarantee, not a select-then-insert race ───
-- One financial business event produces exactly one authoritative journal. The previous
-- dedupe read first and inserted second, so two concurrent deliveries of the same event
-- both passed the check. The identity is the existing accounting source convention:
-- (dealership, source, reference, event_name).
--
-- Partial: entries with no reference are manual/adjusting and are not event-sourced,
-- so they are not deduplicated by this identity.
create unique index if not exists journal_entries_source_identity_uk
  on public.journal_entries (dealership_id, source, reference, event_name)
  where reference is not null;

-- ── 3. One chart account per system key ────────────────────────────────────
-- gl_accounts had no uniqueness at all, so a dealership could hold two accounts with
-- the same system_key and account resolution would pick arbitrarily.
create unique index if not exists gl_accounts_system_key_uk
  on public.gl_accounts (dealership_id, system_key)
  where system_key is not null;

-- ── 4. The integrity triggers, stated idempotently ─────────────────────────
-- Identical in behaviour to what staging already enforces. Restated here so that
-- applying this file to production installs them there too, unchanged.

create or replace function public.enforce_journal_entry_posting()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $function$
declare
  total_debit numeric;
  total_credit numeric;
  line_count bigint;
begin
  if tg_op = 'DELETE' and old.posted then
    raise exception 'Posted journal entries cannot be deleted; create a reversal entry';
  end if;

  if tg_op = 'UPDATE' and old.posted then
    if new is distinct from old then
      raise exception 'Posted journal entries are immutable; create a reversal entry';
    end if;
  end if;

  -- Fires on the draft → posted transition, which is where the real validation happens.
  if tg_op in ('INSERT','UPDATE') and new.posted and (tg_op = 'INSERT' or not old.posted) then
    select count(*), coalesce(sum(debit),0), coalesce(sum(credit),0)
      into line_count, total_debit, total_credit
    from public.journal_lines
    where journal_entry_id = new.id;

    if line_count < 2 then
      raise exception 'A posted journal entry requires at least two lines';
    end if;
    if total_debit <> total_credit then
      raise exception 'Journal entry is not balanced: debits %, credits %', total_debit, total_credit;
    end if;
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function public.enforce_journal_line_immutability()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $function$
declare
  parent_id uuid;
  parent_posted boolean;
  parent_dealer uuid;
begin
  parent_id := coalesce(new.journal_entry_id, old.journal_entry_id);
  select posted, dealership_id into parent_posted, parent_dealer
  from public.journal_entries where id = parent_id;

  if parent_posted then
    raise exception 'Lines belonging to a posted journal entry are immutable';
  end if;

  if tg_op <> 'DELETE' and new.dealership_id is distinct from parent_dealer then
    raise exception 'Journal line dealership must match journal entry dealership';
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function public.enforce_accounting_period_lock()
returns trigger language plpgsql set search_path to 'public','pg_temp' as $function$
begin
  if tg_op = 'DELETE' and old.status in ('locked','closed') then
    raise exception 'Locked or closed accounting periods cannot be deleted';
  end if;
  if tg_op = 'UPDATE' and old.status in ('locked','closed') then
    if new.dealership_id is distinct from old.dealership_id
       or new.period is distinct from old.period
       or new.status is distinct from old.status
       or new.locked_at is distinct from old.locked_at
       or new.locked_by is distinct from old.locked_by then
      raise exception 'Locked or closed accounting periods are immutable';
    end if;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_journal_entry_posting on public.journal_entries;
create trigger trg_journal_entry_posting
  before insert or update or delete on public.journal_entries
  for each row execute function public.enforce_journal_entry_posting();

drop trigger if exists trg_journal_line_immutability on public.journal_lines;
create trigger trg_journal_line_immutability
  before insert or update or delete on public.journal_lines
  for each row execute function public.enforce_journal_line_immutability();

drop trigger if exists trg_accounting_period_lock on public.accounting_periods;
create trigger trg_accounting_period_lock
  before update or delete on public.accounting_periods
  for each row execute function public.enforce_accounting_period_lock();

-- ── 5. Atomic posting — the ONE way a journal is written ───────────────────
-- Header, lines and the post transition happen in a single transaction. Any failure
-- leaves nothing: no orphan header, no half journal, no fake posted state.
--
-- Account resolution is strict. An unknown account_key FAILS the posting; it never
-- mints an account. Creating a chart account is a deliberate, authorized Accounting
-- act, not a side effect of a mistyped rule.
--
-- Distinct SQLSTATEs let the caller tell these apart without parsing messages:
--   AC001 unknown account key      AC002 period locked
--   AC003 no usable lines          AC004 dealership missing
create or replace function public.accounting_post_journal(
  p_dealership_id uuid,
  p_source        text,
  p_event_name    text,
  p_reference     text,
  p_entry_date    date,
  p_lines         jsonb,
  p_memo          text default null,
  p_workflow_instance_id uuid default null,
  p_refs          jsonb default '{}'::jsonb,
  p_created_by    uuid default null
) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare
  v_entry_id   uuid;
  v_existing   uuid;
  v_date       date := coalesce(p_entry_date, current_date);
  v_period     text;
  v_status     text;
  v_line       jsonb;
  v_acct       uuid;
  v_key        text;
  v_debit      numeric;
  v_credit     numeric;
  v_count      int := 0;
  v_tot_dr     numeric := 0;
  v_tot_cr     numeric := 0;
begin
  if p_dealership_id is null then
    raise exception 'dealership is required to post a journal' using errcode = 'AC004';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'a journal needs lines' using errcode = 'AC003';
  end if;

  -- A locked period refuses the posting outright. The caller turns this into a visible
  -- accounting exception; it is never silently discarded.
  v_period := to_char(v_date, 'YYYY-MM');
  select status into v_status from public.accounting_periods
   where dealership_id = p_dealership_id and period = v_period;
  if v_status in ('locked','closed') then
    raise exception 'accounting period % is %', v_period, v_status using errcode = 'AC002';
  end if;

  -- Idempotency, first pass: an already-posted journal for this source identity wins.
  if p_reference is not null then
    select id into v_existing from public.journal_entries
     where dealership_id = p_dealership_id and source = p_source
       and reference = p_reference and event_name is not distinct from p_event_name
     limit 1;
    if v_existing is not null then
      return jsonb_build_object('journal_entry_id', v_existing, 'created', false, 'duplicate', true);
    end if;
  end if;

  -- Header is born a DRAFT. Nothing is authoritative yet.
  begin
    insert into public.journal_entries
      (dealership_id, entry_date, reference, source, event_name, workflow_instance_id, memo, posted, created_by)
    values
      (p_dealership_id, v_date, p_reference, p_source, p_event_name, p_workflow_instance_id, p_memo, false, p_created_by)
    returning id into v_entry_id;
  exception when unique_violation then
    -- Idempotency, final guarantee: a concurrent caller won the race. Return theirs.
    select id into v_existing from public.journal_entries
     where dealership_id = p_dealership_id and source = p_source
       and reference = p_reference and event_name is not distinct from p_event_name
     limit 1;
    return jsonb_build_object('journal_entry_id', v_existing, 'created', false, 'duplicate', true);
  end;

  -- Lines. A key that is not in this dealership's chart aborts the whole posting.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_key    := v_line->>'account_key';
    v_debit  := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_credit := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    if v_debit = 0 and v_credit = 0 then
      continue;
    end if;

    select id into v_acct from public.gl_accounts
     where dealership_id = p_dealership_id and system_key = v_key and active;
    if v_acct is null then
      raise exception 'no chart account for key "%" — posting refused', v_key using errcode = 'AC001';
    end if;

    insert into public.journal_lines
      (journal_entry_id, dealership_id, account_id, debit, credit, department, memo,
       ref_deal_id, ref_vehicle_id, ref_contact_id, ref_vendor_id, ref_employee_id)
    values
      (v_entry_id, p_dealership_id, v_acct, v_debit, v_credit,
       v_line->>'department', v_line->>'desc',
       nullif(coalesce(v_line->>'ref_deal_id',     p_refs->>'ref_deal_id'),     '')::uuid,
       nullif(coalesce(v_line->>'ref_vehicle_id',  p_refs->>'ref_vehicle_id'),  '')::uuid,
       nullif(coalesce(v_line->>'ref_contact_id',  p_refs->>'ref_contact_id'),  '')::uuid,
       nullif(coalesce(v_line->>'ref_vendor_id',   p_refs->>'ref_vendor_id'),   '')::uuid,
       nullif(coalesce(v_line->>'ref_employee_id', p_refs->>'ref_employee_id'), '')::uuid);

    v_count  := v_count + 1;
    v_tot_dr := v_tot_dr + v_debit;
    v_tot_cr := v_tot_cr + v_credit;
  end loop;

  if v_count = 0 then
    raise exception 'a journal needs lines' using errcode = 'AC003';
  end if;

  -- Post LAST, so the trigger's line-count and balance checks are what decide.
  -- Deliberately not pre-checked here: the database control is the authority.
  update public.journal_entries set posted = true where id = v_entry_id;

  return jsonb_build_object(
    'journal_entry_id', v_entry_id, 'created', true, 'duplicate', false,
    'lines', v_count, 'debit', v_tot_dr, 'credit', v_tot_cr);
end;
$function$;

revoke all on function public.accounting_post_journal(uuid,text,text,text,date,jsonb,text,uuid,jsonb,uuid) from public, anon, authenticated;
