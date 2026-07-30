-- Map legacy dealer roles to the new RBAC roles and seed the least-privilege matrix.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.role_id, r.permission_id FROM (VALUES
 ('dealer_group_owner','inventory.view'),('dealer_group_owner','inventory.edit'),('dealer_group_owner','inventory.delete'),('dealer_group_owner','customer.view'),('dealer_group_owner','customer.export'),('dealer_group_owner','lead.create'),('dealer_group_owner','lead.assign'),('dealer_group_owner','deal.create'),('dealer_group_owner','deal.approve'),('dealer_group_owner','deal.finalize'),('dealer_group_owner','accounting.view'),('dealer_group_owner','accounting.edit'),('dealer_group_owner','service.write_repair_order'),('dealer_group_owner','users.manage'),('dealer_group_owner','billing.manage'),
 ('dealer_owner','inventory.view'),('dealer_owner','inventory.edit'),('dealer_owner','inventory.delete'),('dealer_owner','customer.view'),('dealer_owner','customer.export'),('dealer_owner','lead.create'),('dealer_owner','lead.assign'),('dealer_owner','deal.create'),('dealer_owner','deal.approve'),('dealer_owner','deal.finalize'),('dealer_owner','accounting.view'),('dealer_owner','accounting.edit'),('dealer_owner','service.write_repair_order'),('dealer_owner','users.manage'),('dealer_owner','billing.manage'),
 ('general_manager','inventory.view'),('general_manager','inventory.edit'),('general_manager','inventory.delete'),('general_manager','customer.view'),('general_manager','customer.export'),('general_manager','lead.create'),('general_manager','lead.assign'),('general_manager','deal.create'),('general_manager','deal.approve'),('general_manager','deal.finalize'),('general_manager','accounting.view'),('general_manager','accounting.edit'),('general_manager','service.write_repair_order'),('general_manager','users.manage'),
 ('sales_manager','inventory.view'),('sales_manager','inventory.edit'),('sales_manager','customer.view'),('sales_manager','lead.create'),('sales_manager','lead.assign'),('sales_manager','deal.create'),('sales_manager','deal.approve'),
 ('salesperson','inventory.view'),('salesperson','customer.view'),('salesperson','lead.create'),('salesperson','deal.create'),
 ('bdc','customer.view'),('bdc','lead.create'),('fni_manager','customer.view'),('fni_manager','deal.create'),('fni_manager','deal.approve'),('fni_manager','deal.finalize'),
 ('service_manager','service.write_repair_order'),('technician','service.write_repair_order'),('accounting','accounting.view'),('accounting','accounting.edit'),('read_only','inventory.view')
) AS r(role_id, permission_id)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, dealership_id, role_id)
SELECT p.id, p.dealership_id,
  CASE p.role WHEN 'OWNER' THEN 'dealer_owner' WHEN 'DEALER_ADMIN' THEN 'dealer_owner' WHEN 'DEALER_GROUP' THEN 'dealer_group_owner' WHEN 'MANAGER' THEN 'general_manager' WHEN 'SALES_REP' THEN 'salesperson' WHEN 'BDC' THEN 'bdc' WHEN 'FNI' THEN 'fni_manager' WHEN 'SERVICE' THEN 'service_manager' WHEN 'ACCOUNTING' THEN 'accounting' ELSE 'read_only' END
FROM public.profiles p
WHERE p.dealership_id IS NOT NULL
ON CONFLICT DO NOTHING;
