DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['credit_applications','fni_products','lenders','parts','part_txns','repair_orders','ro_lines','recon','reconciliations','vehicle_history_reports','trade_appraisals'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', tbl);
  END LOOP;
END $$;
