-- Sales reps must be able to sync their own dealership's inventory.
--
-- "Sync Now" (POST /inventory/sync) was gated on `inventory.edit`, which also
-- gates 23 other routes — AI appraisal, competitor vision, AI pricing,
-- syndication, photo upload and the inventory mutation/delete endpoints.
-- Granting `inventory.edit` to `salesperson` would hand every rep at every
-- dealership all of that, so instead this adds a dedicated, narrower
-- permission that covers refreshing the feed and nothing else.
--
-- Granted to `salesperson` (the new capability) plus every role that already
-- held `inventory.edit`, so no role loses the ability to sync.

insert into public.permissions (id, description)
values ('inventory.sync', 'Trigger an inventory feed sync for their own dealership')
on conflict (id) do nothing;

-- Every role that can already edit inventory keeps the ability to sync it,
-- derived from the live grants rather than a hardcoded list so this stays
-- correct if the role set differs by environment.
insert into public.role_permissions (role_id, permission_id)
select distinct rp.role_id, 'inventory.sync'
from public.role_permissions rp
where rp.permission_id = 'inventory.edit'
on conflict do nothing;

-- The actual change: sales reps can now sync.
insert into public.role_permissions (role_id, permission_id)
select r.id, 'inventory.sync'
from public.roles r
where r.id = 'salesperson'
on conflict do nothing;
