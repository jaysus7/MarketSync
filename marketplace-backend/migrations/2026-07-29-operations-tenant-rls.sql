DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ad_connections','api_keys','api_usage','competitor_dealerships','crm_attachments','customer_ownership_tracking','dealer_tasks','esign_requests','exceptions','expense_vendors','inventory_feeds','marketing_spend','notifications','price_reports','sales','seo_connections','staff_members','state_ownership','vendors'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', tbl);
  END LOOP;
END $$;
