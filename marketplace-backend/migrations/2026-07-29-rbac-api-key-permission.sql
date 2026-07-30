INSERT INTO public.permissions (id, description) VALUES
  ('api_keys.manage', 'Create and revoke API keys'),
  ('integrations.manage', 'Configure and test dealer integrations')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN (VALUES ('api_keys.manage'), ('integrations.manage')) AS p(id)
WHERE r.id IN ('dealer_group_owner','dealer_owner','general_manager')
ON CONFLICT DO NOTHING;
