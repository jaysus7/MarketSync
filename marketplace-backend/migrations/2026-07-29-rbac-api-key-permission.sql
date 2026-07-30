INSERT INTO public.permissions (id, description) VALUES
  ('api_keys.manage', 'Create and revoke API keys'),
  ('integrations.manage', 'Configure and test dealer integrations'),
  ('site.manage', 'Configure and publish dealership sites'),
  ('settings.manage', 'View and change dealership-wide configuration'),
  ('equity.view', 'View customer equity and pull-ahead information'),
  ('equity.manage', 'Edit equity records and start pull-ahead outreach')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (VALUES ('api_keys.manage'), ('integrations.manage'), ('site.manage'), ('settings.manage')) AS p(id)
WHERE r.id IN ('dealer_group_owner','dealer_owner','general_manager')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (VALUES ('equity.view'), ('equity.manage')) AS p(id)
WHERE r.id IN ('dealer_group_owner','dealer_owner','general_manager','sales_manager','salesperson','fni_manager','service_manager')
ON CONFLICT DO NOTHING;
