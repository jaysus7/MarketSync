INSERT INTO public.permissions (id, description) VALUES ('audit.view', 'View and export security audit records') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT id, 'audit.view' FROM public.roles WHERE id IN ('dealer_group_owner','dealer_owner','general_manager')
ON CONFLICT DO NOTHING;
