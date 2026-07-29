DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['ai_activity','ai_assistant_chats','ai_conversations','ai_memory','ai_messages','automated_campaigns','calendar_connections','communications','dealer_config','dealer_integrations','integration_deliveries','scheduled_messages','webhook_deliveries','workflow_instances','workflow_templates'] LOOP
    EXECUTE format('CREATE POLICY "Tenant isolation" ON public.%I FOR ALL TO authenticated USING (dealership_id = (SELECT private.current_dealership_id())) WITH CHECK (dealership_id = (SELECT private.current_dealership_id()))', tbl);
  END LOOP;
END $$;
