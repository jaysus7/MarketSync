-- Extends the DB-level entitlement catalog (products / plans / plan_products) with the
-- 15 currently-sold SKUs (marketplace-frontend/js/public-config.js), matching
-- plan-catalog.js's PLAN_CATALOG exactly. Generated from that file — do not hand-edit
-- the values without re-deriving them from PLAN_CATALOG.
--
-- WHY THIS IS NEEDED SEPARATELY FROM plan-catalog.js: subscriptions has a
-- validate_subscription_catalog() trigger that calls resolve_plan_id()/resolve_product_id()
-- against these DB tables — the JS catalog alone is not enough for provisionPlan() to
-- actually write a subscription row for one of these ids; the DB rejects it with
-- "Unknown or inactive subscription plan". This is what made /register.html?plan=<id>
-- fail for 9 of the 15 current SKUs (and would have blocked the Demo Control Center's
-- Product Switcher from provisioning them too).
--
-- Nothing existing is touched: fb_solo/fb_dealership/ai_standard/os_starter/os_growth/
-- os_pro/os_enterprise stay exactly as they are — real subscribers are unaffected.

INSERT INTO public.products (id, name, sort_order) VALUES
  ('design_studio', 'Design Studio', 4),
  ('marketsync_social', 'Social Scheduler', 5),
  ('marketsync_video', 'Video', 6),
  ('marketsync_email', 'Campaigns — Email + SMS', 7),
  ('marketsync_website', 'Dealer Website', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plans (id, product_id, name, tier, monthly_price_cents, org_type, is_public, is_trial_default) VALUES
  ('design-studio', 'design_studio', 'Design Studio', 0, 500, 'dealership', true, false),
  ('autoposter-salesperson', 'facebook', 'Facebook AutoPoster — Salesperson', 0, 1900, 'solo', true, false),
  ('social-scheduler', 'marketsync_social', 'Social Scheduler', 0, 5900, 'dealership', true, false),
  ('autoposter-dealer', 'facebook', 'Facebook AutoPoster — Dealer', 1, 7900, 'dealership', true, false),
  ('video', 'marketsync_video', 'Video', 0, 9900, 'dealership', true, false),
  ('campaigns-email-sms', 'marketsync_email', 'Campaigns — Email + SMS', 0, 12900, 'dealership', true, false),
  ('dealer-website', 'marketsync_website', 'Dealer Website', 0, 24900, 'dealership', true, false),
  ('ai-chatbot', 'ai_dealer', 'AI ChatBot', 0, 29900, 'dealership', true, false),
  ('sales-marketing-suite', 'marketsync_social', 'Sales Marketing Suite', 1, 24900, 'dealership', true, false),
  ('service-marketing-suite', 'marketsync_email', 'Service Marketing Suite', 1, 24900, 'dealership', true, false),
  ('complete-marketing-suite', 'marketsync_social', 'Complete Marketing Suite', 2, 39900, 'dealership', true, false),
  ('marketsync-digital', 'marketsync_website', 'MarketSync Digital', 2, 59900, 'dealership', true, false),
  ('dealer-os-core', 'dealer_os', 'DealerOS Core', 0, 149900, 'dealership', true, false),
  ('dealer-os-pro', 'dealer_os', 'DealerOS Pro', 1, 249900, 'dealership', true, false),
  ('dealer-os-complete', 'dealer_os', 'DealerOS Complete', 2, 399900, 'dealership', true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.plan_products (plan_id, product_id) VALUES
  ('design-studio', 'design_studio'),
  ('autoposter-salesperson', 'facebook'),
  ('social-scheduler', 'marketsync_social'),
  ('autoposter-dealer', 'facebook'),
  ('video', 'marketsync_video'),
  ('campaigns-email-sms', 'marketsync_email'),
  ('dealer-website', 'marketsync_website'),
  ('ai-chatbot', 'ai_dealer'),
  ('sales-marketing-suite', 'design_studio'),
  ('sales-marketing-suite', 'facebook'),
  ('sales-marketing-suite', 'marketsync_social'),
  ('sales-marketing-suite', 'marketsync_email'),
  ('service-marketing-suite', 'marketsync_email'),
  ('complete-marketing-suite', 'design_studio'),
  ('complete-marketing-suite', 'facebook'),
  ('complete-marketing-suite', 'marketsync_social'),
  ('complete-marketing-suite', 'marketsync_email'),
  ('complete-marketing-suite', 'marketsync_video'),
  ('marketsync-digital', 'design_studio'),
  ('marketsync-digital', 'facebook'),
  ('marketsync-digital', 'marketsync_social'),
  ('marketsync-digital', 'marketsync_email'),
  ('marketsync-digital', 'marketsync_video'),
  ('marketsync-digital', 'marketsync_website'),
  ('marketsync-digital', 'ai_dealer'),
  ('dealer-os-core', 'dealer_os'),
  ('dealer-os-core', 'design_studio'),
  ('dealer-os-core', 'facebook'),
  ('dealer-os-core', 'marketsync_social'),
  ('dealer-os-core', 'marketsync_email'),
  ('dealer-os-pro', 'dealer_os'),
  ('dealer-os-pro', 'design_studio'),
  ('dealer-os-pro', 'facebook'),
  ('dealer-os-pro', 'marketsync_social'),
  ('dealer-os-pro', 'marketsync_email'),
  ('dealer-os-pro', 'marketsync_video'),
  ('dealer-os-pro', 'marketsync_website'),
  ('dealer-os-pro', 'ai_dealer'),
  ('dealer-os-complete', 'dealer_os'),
  ('dealer-os-complete', 'design_studio'),
  ('dealer-os-complete', 'facebook'),
  ('dealer-os-complete', 'marketsync_social'),
  ('dealer-os-complete', 'marketsync_email'),
  ('dealer-os-complete', 'marketsync_video'),
  ('dealer-os-complete', 'marketsync_website'),
  ('dealer-os-complete', 'ai_dealer')
ON CONFLICT (plan_id, product_id) DO NOTHING;
