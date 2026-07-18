-- FNI approve stamp (deal enters "approved — get ready" once F&I signs off).
alter table public.deals add column if not exists approved_at timestamptz;

-- Extra get-ready email recipients (cleanup + service teams) that aren't login
-- users — one or more addresses, comma/newline separated.
alter table public.dealerships add column if not exists cleanup_notify_emails text;
