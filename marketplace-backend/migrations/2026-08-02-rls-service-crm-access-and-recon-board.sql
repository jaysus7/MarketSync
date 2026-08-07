-- Service-domain RLS reconciliation so service.js + recon.js can run under req.supabase.
--
-- (A) Widen CRM to the service department: service_manager + technician get
--     customer.view/edit so the service appointment book (crm_tasks / contacts /
--     communications) runs under the caller's RLS for service staff.
-- (B) Cross-department Cleanup board: a new recon.view permission, granted to the
--     board's real audience — sales managers + service + F&I + GM/owners — plus a
--     widening of the recon table policies so that audience can read + drive the board.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.

-- (A) CRM access for service staff.
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('service_manager','customer.view'),
  ('service_manager','customer.edit'),
  ('technician','customer.view'),
  ('technician','customer.edit')
ON CONFLICT DO NOTHING;

-- (B) recon.view permission + grants (platform staff bypass via authz.is_platform_staff()).
INSERT INTO public.permissions (id, description)
VALUES ('recon.view', 'View and update the reconditioning / get-ready Cleanup board')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
  ('sales_manager','recon.view'),
  ('service_manager','recon.view'),
  ('technician','recon.view'),
  ('fni_manager','recon.view'),
  ('general_manager','recon.view'),
  ('dealer_owner','recon.view'),
  ('dealer_group_owner','recon.view')
ON CONFLICT DO NOTHING;

-- Widen recon policies to the board audience.
DROP POLICY IF EXISTS "recon_select_authorized" ON public.recon;
CREATE POLICY "recon_select_authorized" ON public.recon
  FOR SELECT TO authenticated
  USING (authz.has_permission(dealership_id, 'service.view')
      OR authz.has_permission(dealership_id, 'recon.view'));

DROP POLICY IF EXISTS "recon_insert_authorized" ON public.recon;
CREATE POLICY "recon_insert_authorized" ON public.recon
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_permission(dealership_id, 'service.write_repair_order')
           OR authz.has_permission(dealership_id, 'recon.view'));

DROP POLICY IF EXISTS "recon_update_authorized" ON public.recon;
CREATE POLICY "recon_update_authorized" ON public.recon
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'service.write_repair_order')
      OR authz.has_permission(dealership_id, 'recon.view'))
  WITH CHECK (authz.has_permission(dealership_id, 'service.write_repair_order')
           OR authz.has_permission(dealership_id, 'recon.view'));

DROP POLICY IF EXISTS "recon_delete_authorized" ON public.recon;
CREATE POLICY "recon_delete_authorized" ON public.recon
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, 'service.write_repair_order')
      OR authz.has_permission(dealership_id, 'recon.view'));
