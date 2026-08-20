-- ─────────────────────────────────────────────────────────────────────────────
-- MARKETING SUITE ENTITLEMENTS ALIGNMENT
--
-- Aligns staging DB plan_products and plan_features to match the canonical
-- backend plan catalog (plan-catalog.js) for all four Marketing Suites:
--
-- 1. Sales Marketing Suite ('sales-marketing-suite'):
--    Products: design_studio, facebook, marketsync_social, marketsync_email, marketsync_video
--
-- 2. Service Marketing Suite ('service-marketing-suite'):
--    Products: design_studio, facebook, marketsync_social, marketsync_email, marketsync_video
--
-- 3. Complete Marketing Suite ('complete-marketing-suite'):
--    Products: design_studio, facebook, marketsync_social, marketsync_email, marketsync_video
--
-- 4. MarketSync Digital ('marketsync-digital'):
--    Products: design_studio, facebook, marketsync_social, marketsync_email, marketsync_video, marketsync_website, ai_dealer
--    (Strictly excludes marketsync_seo by default; SEO is an independent add-on)
--
-- Preserves approved database pricing:
--   - sales-marketing-suite: $399 (39900 cents)
--   - service-marketing-suite: $399 (39900 cents)
--   - complete-marketing-suite: $699 (69900 cents)
--   - marketsync-digital: $1199 (119900 cents)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Ensure all relevant products exist in public.products ─────────────────
INSERT INTO public.products (id, name, sort_order) VALUES
  ('design_studio', 'Design Studio', 4),
  ('facebook', 'Facebook AutoPoster', 1),
  ('marketsync_social', 'Social Scheduler', 5),
  ('marketsync_email', 'Campaigns — Email + SMS', 7),
  ('marketsync_video', 'Video', 6),
  ('marketsync_website', 'Dealer Website', 8),
  ('ai_dealer', 'AI Dealer', 2)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Ensure all relevant features exist in public.features ─────────────────
INSERT INTO public.features (id, product_id, name, feature_group, sort_order) VALUES
  -- design_studio
  ('design.templates', 'design_studio', 'Templates', 'design', 1),
  ('design.assets', 'design_studio', 'Assets', 'design', 2),
  ('design.canvas', 'design_studio', 'Canvas', 'design', 3),
  ('design.suggestions', 'design_studio', 'Suggestions', 'design', 4),

  -- facebook
  ('fb.inventory', 'facebook', 'Inventory', 'facebook', 1),
  ('fb.leaderboard', 'facebook', 'Leaderboard', 'facebook', 2),
  ('fb.sales_reps', 'facebook', 'Sales Reps', 'facebook', 3),

  -- marketsync_social
  ('social.scheduler', 'marketsync_social', 'Scheduler', 'social', 1),
  ('social.accounts', 'marketsync_social', 'Accounts', 'social', 2),
  ('social.calendar', 'marketsync_social', 'Calendar', 'social', 3),
  ('social.studio', 'marketsync_social', 'Studio', 'social', 4),

  -- marketsync_email
  ('email.campaigns', 'marketsync_email', 'Campaigns', 'email', 1),
  ('email.templates', 'marketsync_email', 'Templates', 'email', 2),
  ('email.audiences', 'marketsync_email', 'Audiences', 'email', 3),
  ('email.automations', 'marketsync_email', 'Automations', 'email', 4),

  -- marketsync_video
  ('video.library', 'marketsync_video', 'Library', 'video', 1),
  ('video.record', 'marketsync_video', 'Record', 'video', 2),
  ('video.templates', 'marketsync_video', 'Templates', 'video', 3),
  ('video.settings', 'marketsync_video', 'Settings', 'video', 4),

  -- marketsync_website
  ('website.builder', 'marketsync_website', 'Builder', 'website', 1),
  ('website.pages', 'marketsync_website', 'Pages', 'website', 2),
  ('website.domains', 'marketsync_website', 'Domains', 'website', 3),
  ('website.settings', 'marketsync_website', 'Settings', 'website', 4),

  -- ai_dealer
  ('ai.overview', 'ai_dealer', 'Overview', 'ai_dealer', 1),
  ('ai.conversations', 'ai_dealer', 'Conversations', 'ai_dealer', 2),
  ('ai.agents', 'ai_dealer', 'Agents', 'ai_dealer', 3),
  ('ai.knowledge', 'ai_dealer', 'Knowledge', 'ai_dealer', 4),
  ('ai.settings', 'ai_dealer', 'Settings', 'ai_dealer', 5)
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  name = EXCLUDED.name,
  feature_group = EXCLUDED.feature_group,
  sort_order = EXCLUDED.sort_order;

-- ── 3. Upsert Marketing Suite plans and standalone plans with ratified pricing ───
INSERT INTO public.plans (id, product_id, name, tier, monthly_price_cents, org_type, is_public, is_trial_default) VALUES
  ('design-studio', 'design_studio', 'Design Studio', 0, 1999, 'dealership', true, false),
  ('social-scheduler', 'marketsync_social', 'Social Scheduler', 0, 9900, 'dealership', true, false),
  ('sales-marketing-suite', 'marketsync_social', 'Sales Marketing Suite', 1, 39900, 'dealership', true, false),
  ('service-marketing-suite', 'marketsync_email', 'Service Marketing Suite', 1, 39900, 'dealership', true, false),
  ('complete-marketing-suite', 'marketsync_social', 'Complete Marketing Suite', 2, 69900, 'dealership', true, false),
  ('marketsync-digital', 'marketsync_website', 'MarketSync Digital', 2, 119900, 'dealership', true, false)
ON CONFLICT (id) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  org_type = EXCLUDED.org_type,
  is_public = EXCLUDED.is_public;

-- ── 4. Reconcile plan_products for Marketing Suites & standalone creative/social ──────
DELETE FROM public.plan_products
WHERE plan_id IN (
  'design-studio',
  'social-scheduler',
  'sales-marketing-suite',
  'service-marketing-suite',
  'complete-marketing-suite',
  'marketsync-digital'
);

INSERT INTO public.plan_products (plan_id, product_id) VALUES
  -- Standalone Design Studio & Social Scheduler
  ('design-studio', 'design_studio'),
  ('social-scheduler', 'marketsync_social'),

  -- Sales Marketing Suite
  ('sales-marketing-suite', 'design_studio'),
  ('sales-marketing-suite', 'facebook'),
  ('sales-marketing-suite', 'marketsync_social'),
  ('sales-marketing-suite', 'marketsync_email'),
  ('sales-marketing-suite', 'marketsync_video'),

  -- Service Marketing Suite
  ('service-marketing-suite', 'design_studio'),
  ('service-marketing-suite', 'facebook'),
  ('service-marketing-suite', 'marketsync_social'),
  ('service-marketing-suite', 'marketsync_email'),
  ('service-marketing-suite', 'marketsync_video'),

  -- Complete Marketing Suite
  ('complete-marketing-suite', 'design_studio'),
  ('complete-marketing-suite', 'facebook'),
  ('complete-marketing-suite', 'marketsync_social'),
  ('complete-marketing-suite', 'marketsync_email'),
  ('complete-marketing-suite', 'marketsync_video'),

  -- MarketSync Digital
  ('marketsync-digital', 'design_studio'),
  ('marketsync-digital', 'facebook'),
  ('marketsync-digital', 'marketsync_social'),
  ('marketsync-digital', 'marketsync_email'),
  ('marketsync-digital', 'marketsync_video'),
  ('marketsync-digital', 'marketsync_website'),
  ('marketsync-digital', 'ai_dealer')
ON CONFLICT (plan_id, product_id) DO NOTHING;

-- ── 5. Reconcile plan_features for Marketing Suites & standalone creative/social ──────
DELETE FROM public.plan_features
WHERE plan_id IN (
  'design-studio',
  'social-scheduler',
  'sales-marketing-suite',
  'service-marketing-suite',
  'complete-marketing-suite',
  'marketsync-digital'
);

INSERT INTO public.plan_features (plan_id, feature_id) VALUES
  -- ── Standalone Design Studio Features ──
  ('design-studio', 'design.templates'),
  ('design-studio', 'design.assets'),
  ('design-studio', 'design.canvas'),
  ('design-studio', 'design.suggestions'),

  -- ── Standalone Social Scheduler Features ──
  ('social-scheduler', 'social.scheduler'),
  ('social-scheduler', 'social.accounts'),
  ('social-scheduler', 'social.calendar'),
  ('social-scheduler', 'social.studio'),
  -- ── Sales Marketing Suite Features ──
  ('sales-marketing-suite', 'design.templates'),
  ('sales-marketing-suite', 'design.assets'),
  ('sales-marketing-suite', 'design.canvas'),
  ('sales-marketing-suite', 'design.suggestions'),
  ('sales-marketing-suite', 'social.scheduler'),
  ('sales-marketing-suite', 'social.accounts'),
  ('sales-marketing-suite', 'social.calendar'),
  ('sales-marketing-suite', 'social.studio'),
  ('sales-marketing-suite', 'fb.inventory'),
  ('sales-marketing-suite', 'fb.leaderboard'),
  ('sales-marketing-suite', 'fb.sales_reps'),
  ('sales-marketing-suite', 'email.campaigns'),
  ('sales-marketing-suite', 'email.templates'),
  ('sales-marketing-suite', 'email.audiences'),
  ('sales-marketing-suite', 'email.automations'),
  ('sales-marketing-suite', 'video.library'),
  ('sales-marketing-suite', 'video.record'),
  ('sales-marketing-suite', 'video.templates'),
  ('sales-marketing-suite', 'video.settings'),

  -- ── Service Marketing Suite Features ──
  ('service-marketing-suite', 'design.templates'),
  ('service-marketing-suite', 'design.assets'),
  ('service-marketing-suite', 'design.canvas'),
  ('service-marketing-suite', 'design.suggestions'),
  ('service-marketing-suite', 'social.scheduler'),
  ('service-marketing-suite', 'social.accounts'),
  ('service-marketing-suite', 'social.calendar'),
  ('service-marketing-suite', 'social.studio'),
  ('service-marketing-suite', 'fb.inventory'),
  ('service-marketing-suite', 'fb.leaderboard'),
  ('service-marketing-suite', 'fb.sales_reps'),
  ('service-marketing-suite', 'email.campaigns'),
  ('service-marketing-suite', 'email.templates'),
  ('service-marketing-suite', 'email.audiences'),
  ('service-marketing-suite', 'email.automations'),
  ('service-marketing-suite', 'video.library'),
  ('service-marketing-suite', 'video.record'),
  ('service-marketing-suite', 'video.templates'),
  ('service-marketing-suite', 'video.settings'),

  -- ── Complete Marketing Suite Features ──
  ('complete-marketing-suite', 'design.templates'),
  ('complete-marketing-suite', 'design.assets'),
  ('complete-marketing-suite', 'design.canvas'),
  ('complete-marketing-suite', 'design.suggestions'),
  ('complete-marketing-suite', 'social.scheduler'),
  ('complete-marketing-suite', 'social.accounts'),
  ('complete-marketing-suite', 'social.calendar'),
  ('complete-marketing-suite', 'social.studio'),
  ('complete-marketing-suite', 'fb.inventory'),
  ('complete-marketing-suite', 'fb.leaderboard'),
  ('complete-marketing-suite', 'fb.sales_reps'),
  ('complete-marketing-suite', 'email.campaigns'),
  ('complete-marketing-suite', 'email.templates'),
  ('complete-marketing-suite', 'email.audiences'),
  ('complete-marketing-suite', 'email.automations'),
  ('complete-marketing-suite', 'video.library'),
  ('complete-marketing-suite', 'video.record'),
  ('complete-marketing-suite', 'video.templates'),
  ('complete-marketing-suite', 'video.settings'),

  -- ── MarketSync Digital Features ──
  ('marketsync-digital', 'design.templates'),
  ('marketsync-digital', 'design.assets'),
  ('marketsync-digital', 'design.canvas'),
  ('marketsync-digital', 'design.suggestions'),
  ('marketsync-digital', 'social.scheduler'),
  ('marketsync-digital', 'social.accounts'),
  ('marketsync-digital', 'social.calendar'),
  ('marketsync-digital', 'social.studio'),
  ('marketsync-digital', 'fb.inventory'),
  ('marketsync-digital', 'fb.leaderboard'),
  ('marketsync-digital', 'fb.sales_reps'),
  ('marketsync-digital', 'email.campaigns'),
  ('marketsync-digital', 'email.templates'),
  ('marketsync-digital', 'email.audiences'),
  ('marketsync-digital', 'email.automations'),
  ('marketsync-digital', 'video.library'),
  ('marketsync-digital', 'video.record'),
  ('marketsync-digital', 'video.templates'),
  ('marketsync-digital', 'video.settings'),
  ('marketsync-digital', 'website.builder'),
  ('marketsync-digital', 'website.pages'),
  ('marketsync-digital', 'website.domains'),
  ('marketsync-digital', 'website.settings'),
  ('marketsync-digital', 'ai.overview'),
  ('marketsync-digital', 'ai.conversations'),
  ('marketsync-digital', 'ai.agents'),
  ('marketsync-digital', 'ai.knowledge'),
  ('marketsync-digital', 'ai.settings')
ON CONFLICT (plan_id, feature_id) DO NOTHING;
