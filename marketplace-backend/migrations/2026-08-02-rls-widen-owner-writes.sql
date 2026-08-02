-- Widen two UPDATE policies where the original RBAC policy was stricter than the
-- app's ownership model, so the owning user's own writes can run under RLS
-- (req.supabase) instead of needing the service-role bypass.
--
-- 1. dealer_tasks: an ASSIGNEE must be able to update/complete a task assigned to
--    them (the core shared-ops workflow), not only the creator or a manager.
-- 2. listings: the salesperson who OWNS a Marketplace post (posted_by) must be able
--    to move it through the pipeline, even though they don't hold inventory.edit.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.

-- 1. dealer_tasks UPDATE — add `assignee_id = auth.uid()` to the USING clause.
DROP POLICY IF EXISTS "dealer_tasks_update_authorized" ON public.dealer_tasks;
CREATE POLICY "dealer_tasks_update_authorized" ON public.dealer_tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR assignee_id = (SELECT auth.uid())
    OR authz.has_permission(dealership_id, 'lead.assign')
    OR authz.has_permission(dealership_id, 'settings.manage')
  )
  WITH CHECK (authz.belongs_to_dealership(dealership_id));

-- 2. listings UPDATE — allow the owning rep (posted_by) in addition to inventory.edit.
--    WITH CHECK keeps posted_by pinned to the caller on the rep path, so a rep can't
--    reassign a post away from themselves; managers still go through inventory.edit.
DROP POLICY IF EXISTS "listings_update_authorized" ON public.listings;
CREATE POLICY "listings_update_authorized" ON public.listings
  FOR UPDATE TO authenticated
  USING (
    posted_by = (SELECT auth.uid())
    OR authz.has_permission(authz.inventory_dealership(inventory_id), 'inventory.edit')
  )
  WITH CHECK (
    posted_by = (SELECT auth.uid())
    OR authz.has_permission(authz.inventory_dealership(inventory_id), 'inventory.edit')
  );
