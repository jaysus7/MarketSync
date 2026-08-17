-- Align the database entitlement catalog with the current public MarketSync ladder.
-- The dashboard consumes plan_features through /access/context, so every sold plan
-- needs exact feature rows rather than only plan_products rows.

INSERT INTO public.features (id, product_id, name, feature_group, sort_order) VALUES
  ('design.templates', 'design_studio', 'Templates', 'studio', 10),
  ('design.assets', 'design_studio', 'Brand Assets', 'studio', 20),
  ('design.canvas', 'design_studio', 'Design Canvas', 'studio', 30),
  ('design.suggestions', 'design_studio', 'AI Suggestions', 'studio', 40),
  ('social.scheduler', 'marketsync_social', 'Social Scheduler', 'social', 10),
  ('social.accounts', 'marketsync_social', 'Connected Accounts', 'social', 20),
  ('social.calendar', 'marketsync_social', 'Content Calendar', 'social', 30),
  ('social.studio', 'marketsync_social', 'Social Studio', 'social', 40),
  ('video.library', 'marketsync_video', 'Video Library', 'video', 10),
  ('video.record', 'marketsync_video', 'Record Video', 'video', 20),
  ('video.templates', 'marketsync_video', 'Video Templates', 'video', 30),
  ('video.settings', 'marketsync_video', 'Video Settings', 'video', 40),
  ('website.builder', 'marketsync_website', 'Website Builder', 'website', 10),
  ('website.pages', 'marketsync_website', 'Website Pages', 'website', 20),
  ('website.domains', 'marketsync_website', 'Domains', 'website', 30),
  ('website.settings', 'marketsync_website', 'Website Settings', 'website', 40),
  ('email.campaigns', 'marketsync_email', 'Email Campaigns', 'email', 10),
  ('email.templates', 'marketsync_email', 'Email Templates', 'email', 20),
  ('email.audiences', 'marketsync_email', 'Email Audiences', 'email', 30),
  ('email.automations', 'marketsync_email', 'Email Automations', 'email', 40)
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  name = EXCLUDED.name,
  feature_group = EXCLUDED.feature_group,
  sort_order = EXCLUDED.sort_order;

UPDATE public.plans AS p
SET monthly_price_cents = v.monthly_price_cents
FROM (VALUES
  ('design-studio', 2900),
  ('autoposter-salesperson', 3900),
  ('social-scheduler', 9900),
  ('autoposter-dealer', 14900),
  ('video', 14900),
  ('campaigns-email-sms', 19900),
  ('dealer-website', 39900),
  ('ai-chatbot', 59900),
  ('sales-marketing-suite', 39900),
  ('service-marketing-suite', 39900),
  ('complete-marketing-suite', 69900),
  ('marketsync-digital', 119900),
  ('dealer-os-core', 149900),
  ('dealer-os-pro', 249900),
  ('dealer-os-complete', 399900)
) AS v(id, monthly_price_cents)
WHERE p.id = v.id;

DELETE FROM public.plan_features
WHERE plan_id IN (
  'design-studio', 'autoposter-salesperson', 'social-scheduler', 'autoposter-dealer',
  'video', 'campaigns-email-sms', 'dealer-website', 'ai-chatbot',
  'sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite',
  'marketsync-digital', 'dealer-os-core', 'dealer-os-pro', 'dealer-os-complete'
);

-- Straight standalone products.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'design-studio', id FROM public.features WHERE product_id = 'design_studio'
UNION ALL SELECT 'autoposter-salesperson', id FROM public.features WHERE id IN ('fb.inventory', 'fb.leaderboard')
UNION ALL SELECT 'social-scheduler', id FROM public.features WHERE product_id = 'marketsync_social' AND id <> 'social.studio'
UNION ALL SELECT 'autoposter-dealer', id FROM public.features WHERE product_id = 'facebook'
UNION ALL SELECT 'video', id FROM public.features WHERE product_id = 'marketsync_video'
UNION ALL SELECT 'campaigns-email-sms', id FROM public.features WHERE product_id = 'marketsync_email'
UNION ALL SELECT 'dealer-website', id FROM public.features WHERE product_id = 'marketsync_website'
UNION ALL SELECT 'ai-chatbot', id FROM public.features WHERE product_id = 'ai_dealer'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Marketing bundles.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'sales-marketing-suite', id FROM public.features
 WHERE product_id IN ('design_studio', 'facebook', 'marketsync_email')
    OR (product_id = 'marketsync_social' AND id <> 'social.studio')
UNION ALL SELECT 'service-marketing-suite', id FROM public.features WHERE product_id = 'marketsync_email'
UNION ALL SELECT 'complete-marketing-suite', id FROM public.features
 WHERE product_id IN ('design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video')
UNION ALL SELECT 'marketsync-digital', id FROM public.features
 WHERE product_id IN ('design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- DealerOS Core: CRM, inventory, sales workflow shell, reporting and the Sales
-- Marketing Suite. It deliberately excludes Service, F&I, HR and Accounting.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'dealer-os-core', id FROM public.features
 WHERE id IN ('os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings')
    OR product_id IN ('design_studio', 'facebook', 'marketsync_email')
    OR (product_id = 'marketsync_social' AND id <> 'social.studio')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- DealerOS Pro: Core + Service, Parts, F&I, HR and MarketSync Digital.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'dealer-os-pro', id FROM public.features
 WHERE id IN ('os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service', 'os.team')
    OR product_id IN ('design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer')
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- DealerOS Complete: Pro + Accounting, Automations and Integrations/API.
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'dealer-os-complete', id FROM public.features
 WHERE id IN (
   'os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings',
   'os.sales', 'os.service', 'os.team', 'os.accounting', 'os.marketing',
   'os.website', 'os.automations', 'os.email_marketing', 'os.integrations'
 ) OR product_id IN ('design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer')
ON CONFLICT (plan_id, feature_id) DO NOTHING;
