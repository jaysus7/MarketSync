-- TEMPLATE: RLS + policies for a new public table.
-- See docs/rls-standard.md. Copy this file, rename it with a dated slug, then:
--   1. Replace <table> with the table name (4 places in policy names + FROM).
--   2. Replace the four <domain>.<action> permission strings.
--   3. If the table has no dealership_id of its own, swap `dealership_id` for the
--      parent resolver, e.g. authz.inventory_dealership(inventory_id).
--   4. Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.
--
-- Every new table MUST run through this. No table ships without RLS.

-- Enable + force so even the table owner is subject to RLS.
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY;

-- Idempotent: drop before create so the migration is safe to re-run.
DROP POLICY IF EXISTS "<table>_select_authorized" ON public.<table>;
DROP POLICY IF EXISTS "<table>_insert_authorized" ON public.<table>;
DROP POLICY IF EXISTS "<table>_update_authorized" ON public.<table>;
DROP POLICY IF EXISTS "<table>_delete_authorized" ON public.<table>;

CREATE POLICY "<table>_select_authorized" ON public.<table>
  FOR SELECT TO authenticated
  USING (authz.has_permission(dealership_id, '<domain>.view'));

CREATE POLICY "<table>_insert_authorized" ON public.<table>
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_permission(dealership_id, '<domain>.edit'));

CREATE POLICY "<table>_update_authorized" ON public.<table>
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, '<domain>.edit'))
  WITH CHECK (authz.has_permission(dealership_id, '<domain>.edit'));

CREATE POLICY "<table>_delete_authorized" ON public.<table>
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, '<domain>.delete'));

-- If this migration introduces a NEW permission string, grant it to the roles that
-- need it in this same migration, e.g.:
--   INSERT INTO public.role_permissions (role_id, permission_id)
--   VALUES ('sales_manager','<domain>.view'), ('dealer_owner','<domain>.edit')
--   ON CONFLICT DO NOTHING;
