-- Preserve the reviewed receipt image with its canonical manual ledger entry.
-- Existing gl_entries RLS/tenant ownership applies to this column.
alter table public.gl_entries
  add column if not exists receipt_image text;

comment on column public.gl_entries.receipt_image is
  'Reviewed JPG/PNG/WEBP data URL attached to a manual expense entry.';
