-- Inbound provider webhook idempotency (Batches E–I).
-- Reuses integration_deliveries as the durable ledger. Does not create a parallel
-- connection or CRM table. Unique on dealership + method + provider + payload key
-- so a retry after restart cannot insert a second Meta lead or Resend event.
create unique index if not exists integ_deliv_inbound_idempotency
  on public.integration_deliveries (
    dealership_id,
    method,
    coalesce(provider, ''),
    coalesce(payload->>'idempotency_key', '')
  )
  where payload ? 'idempotency_key';
