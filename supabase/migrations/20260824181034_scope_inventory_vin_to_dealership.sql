-- Inventory identity is tenant-scoped. The legacy global VIN key allowed a feed
-- upsert for one dealership to reassign another dealership's vehicle row.
alter table public.inventory
  drop constraint if exists inventory_vin_key;

drop index if exists public.inventory_vin_key;

alter table public.inventory
  add constraint inventory_dealership_vin_key unique (dealership_id, vin);
