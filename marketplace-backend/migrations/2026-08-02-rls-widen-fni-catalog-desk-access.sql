-- Widen fni_products + lenders RLS so the F&I catalog matches how it's used, letting
-- fni-catalog.js run under req.supabase without breaking the deal desk or sales
-- managers:
--   • SELECT: the whole deal desk (deal.create) can read the F&I product/lender menu,
--     in addition to F&I staff (fni.credit_application.view). Product COST is stripped
--     for non-managers in the route (canManageCatalog), so reps never see back-end gross.
--   • INSERT/UPDATE: managers who approve deals (deal.approve) can manage the catalog,
--     in addition to F&I (fni.credit_application.edit) — matching the route guard.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['fni_products','lenders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_authorized" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_authorized" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_authorized" ON public.%I', tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "%s_select_authorized" ON public.%I
        FOR SELECT TO authenticated
        USING (authz.has_permission(dealership_id, 'fni.credit_application.view')
            OR authz.has_permission(dealership_id, 'deal.create'))
    $f$, tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "%s_insert_authorized" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (authz.has_permission(dealership_id, 'fni.credit_application.edit')
                 OR authz.has_permission(dealership_id, 'deal.approve'))
    $f$, tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "%s_update_authorized" ON public.%I
        FOR UPDATE TO authenticated
        USING (authz.has_permission(dealership_id, 'fni.credit_application.edit')
            OR authz.has_permission(dealership_id, 'deal.approve'))
        WITH CHECK (authz.has_permission(dealership_id, 'fni.credit_application.edit')
                 OR authz.has_permission(dealership_id, 'deal.approve'))
    $f$, tbl, tbl);
  END LOOP;
END $$;
