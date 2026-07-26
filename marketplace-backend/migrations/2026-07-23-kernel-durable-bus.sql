-- Kernel conformance pass: durable event bus + accounting settings via Config.
--
-- 1) DURABLE BUS (closes the §3 kernel debt). The event bus was in-process only:
--    a subscriber that hadn't run when the process restarted was never retried.
--    We add events.dispatched_at as a durable watermark. emitEvent stamps it once
--    the row has been fanned out; a catch-up poller re-dispatches any row that was
--    emitted but never stamped (crash mid-flight). Subscribers are idempotent, so a
--    replay is always safe (at-least-once delivery).
--
--    Existing history is backfilled with dispatched_at = created_at so the poller
--    ONLY ever processes events emitted AFTER this deploy — it never re-dispatches
--    the whole table (which would re-post journals, re-run workflows, etc.).

alter table public.events add column if not exists dispatched_at timestamptz;

update public.events set dispatched_at = created_at where dispatched_at is null;

-- Partial index for the poller's pending scan (kept tiny — only undispatched rows).
create index if not exists events_pending_dispatch_idx
  on public.events (created_at) where dispatched_at is null;

-- 2) ACCOUNTING SETTINGS via the Configuration Engine (contract §6). The accounting
--    engine now reads getConfig(dealer,'accounting') first, falling back to the legacy
--    dealerships.accounting_settings / cost_tracking_enabled columns. Seed the global
--    default (auto_post on, cost tracking off) so the key shows in the config catalog.
insert into public.dealer_config (dealership_id, key, value)
select null, 'accounting', '{"auto_post":true,"cost_tracking":false}'::jsonb
where not exists (
  select 1 from public.dealer_config c
  where c.dealership_id is null and c.key = 'accounting'
);
