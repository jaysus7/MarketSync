-- Separate website approval authority from ordinary site editing.
-- Dealer/group owners can approve; editors retain site.manage without approval power.
INSERT INTO public.permissions (id, description)
VALUES ('site.approve', 'Approve dealership website change sets for publication')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, 'site.approve'
FROM public.roles r
WHERE r.id IN ('dealer_group_owner', 'dealer_owner')
ON CONFLICT DO NOTHING;
