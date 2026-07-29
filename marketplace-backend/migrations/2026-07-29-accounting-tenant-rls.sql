DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounting_event_log','accounting_periods','accounting_rules','bank_transactions','commission_adjustments','commission_plans','deal_commissions','expenses','gl_accounts','gl_entries'] LOOP
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (dealership_id = (SELECT private.current_dealership_id())) WITH CHECK (dealership_id = (SELECT private.current_dealership_id()))', tbl);
  END LOOP;
END $$;
