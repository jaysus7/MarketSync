-- Configuration Engine: dealer-overridable key/value config so engines read behavior
-- instead of hardcoding it (kernel contract §6). dealership_id null = global default.
-- Service-role-only RLS. Already applied to project omyuqzveegzspeojrqkd.
create table if not exists public.dealer_config (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid,                    -- null = global default
  key text not null,
  value jsonb not null default '{}',
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists dealer_config_key
  on public.dealer_config (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), key);
alter table public.dealer_config enable row level security;

insert into public.dealer_config (dealership_id, key, value) values
  (null, 'lead_sources', '["Website","Facebook Marketplace","AutoTrader","Kijiji","Walk-in","Phone","Referral","Service","Repeat","Other"]'::jsonb),
  (null, 'deal_types', '["Retail","Lease","Cash","Wholesale","Fleet"]'::jsonb),
  (null, 'vehicle_statuses', '["incoming","available","pending","sold","delivered","archived"]'::jsonb),
  (null, 'notification_rules', '{"appointment_requested":true,"trade_discussed":true,"finance_requested":true,"lead_score_over":80,"asks_for_human":true}'::jsonb),
  (null, 'ai_personality', '{"tone":"friendly, professional, concise","greeting":"Hi! Thanks for visiting. How can I help you find your next vehicle?","handoff":"Let me connect you with one of our specialists."}'::jsonb),
  (null, 'required_forms', '{"delivery":["bill_of_sale"],"finance":["credit_application"]}'::jsonb)
on conflict (coalesce(dealership_id,'00000000-0000-0000-0000-000000000000'::uuid), key) do nothing;
