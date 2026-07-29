INSERT INTO public.permissions (id, description) VALUES ('api_keys.manage', 'Create and revoke API keys') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT id, 'api_keys.manage' FROM public.roles WHERE id IN ('dealer_group_owner','dealer_owner','general_manager')
ON CONFLICT DO NOTHING;
