DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ad_connections','api_keys','api_usage','competitor_dealerships','crm_attachments','customer_ownership_tracking','dealer_tasks','esign_requests','exceptions','expense_vendors','inventory_feeds','marketing_spend','notifications','price_reports','sales','seo_connections','staff_members','state_ownership','vendors'] LOOP
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (dealership_id = (SELECT private.current_dealership_id())) WITH CHECK (dealership_id = (SELECT private.current_dealership_id()))', tbl);
  END LOOP;
END $$;
