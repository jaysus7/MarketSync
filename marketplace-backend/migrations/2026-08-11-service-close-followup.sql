-- Service: closing a repair order produces the follow-up call.
--
-- "Once an RO is closed, call the customer." Until now closing an RO ended the job —
-- the money posted, the parts came out of stock, and nobody was ever asked to phone
-- anybody. The follow-up is now a real crm_tasks row written by closeRepairOrder(),
-- so it exists whether or not a human opens the Service workspace.
--
-- This column is what ties that task back to the repair order. Without it the Closed
-- list would have to infer "has this customer been called?" from the task TITLE, which
-- is exactly the kind of guess that reads as working and is not.
--
-- STAGING ONLY (hpxnjbdiaaoopxeayfen) pending 9A convergence. Additive: one nullable
-- column, one unique constraint that no existing row can violate, one partial index.

-- The composite target the tenant-safe FK below needs. `id` is already unique on its
-- own (primary key), so this constraint cannot fail on existing data.
alter table public.repair_orders
  drop constraint if exists repair_orders_id_dealership_key;
alter table public.repair_orders
  add constraint repair_orders_id_dealership_key unique (id, dealership_id);

alter table public.crm_tasks add column if not exists repair_order_id uuid;

-- Composite FK, the tenant-isolation idiom used throughout this schema: a task may
-- only point at a repair order in ITS OWN dealership. The plain
-- (repair_order_id) -> repair_orders(id) form would happily let a task in dealership A
-- reference an RO in dealership B.
--
-- No ON DELETE clause on purpose. SET NULL would try to null dealership_id too (it is
-- NOT NULL, so the delete would fail at runtime in a confusing place); CASCADE would
-- silently delete a customer follow-up because someone removed a repair order. The
-- default RESTRICT makes the conflict visible.
alter table public.crm_tasks drop constraint if exists crm_tasks_repair_order_fk;
alter table public.crm_tasks
  add constraint crm_tasks_repair_order_fk
  foreign key (repair_order_id, dealership_id)
  references public.repair_orders (id, dealership_id);

-- The Closed list and the de-duplication check both ask exactly one question: which
-- repair orders still have an outstanding call?
create index if not exists crm_tasks_repair_order_open_idx
  on public.crm_tasks (dealership_id, repair_order_id)
  where repair_order_id is not null and done = false;

-- crm_tasks already carries RLS and its policies key off dealership_id, which is
-- unchanged — a new column needs no new policy. Nothing to grant.
