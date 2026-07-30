DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounting_event_log','accounting_periods','accounting_rules','bank_transactions','commission_adjustments','commission_plans','deal_commissions','expenses','gl_accounts','gl_entries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', tbl);
  END LOOP;
END $$;
