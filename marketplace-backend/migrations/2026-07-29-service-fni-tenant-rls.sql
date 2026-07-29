DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['credit_applications','fni_products','lenders','parts','part_txns','repair_orders','ro_lines','recon','reconciliations','vehicle_history_reports','trade_appraisals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (dealership_id = (SELECT private.current_dealership_id())) WITH CHECK (dealership_id = (SELECT private.current_dealership_id()))', tbl);
  END LOOP;
END $$;
