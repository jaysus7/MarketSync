-- ─────────────────────────────────────────────────────────────────────────────
-- DealerOS Pro — Email Marketing (reusable template library + broadcast campaigns).
--
-- Brings the HQ "Automation & Email" template/campaign layer to dealers as a
-- Pro-tier feature. Sequences (lifecycle drips) already live in the existing
-- automation engine; this adds a dealer-editable template library and one-off
-- broadcast campaigns targeting CRM contact segments.
--
-- Gating:
--   • Feature `os.email_marketing` seeded to os_pro (+ os_enterprise superset) only.
--     The API layer enforces requireFeature('os.email_marketing').
--   • RLS enforces tenant isolation + the `lead.assign` permission (the same
--     managerial permission the existing automation routes require).
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dealer_email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name          text NOT NULL,
  subject       text NOT NULL DEFAULT '',
  body          text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT 'general',
  active        boolean NOT NULL DEFAULT true,
  is_seed       boolean NOT NULL DEFAULT false,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dealer_email_templates_dealer_idx
  ON public.dealer_email_templates (dealership_id);

CREATE TABLE IF NOT EXISTS public.dealer_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name            text NOT NULL,
  segment         jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_id     uuid REFERENCES public.dealer_email_templates(id) ON DELETE SET NULL,
  subject         text NOT NULL DEFAULT '',
  body            text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'draft', -- draft | sending | sent | failed
  scheduled_at    timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count      integer NOT NULL DEFAULT 0,
  last_error      text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);
CREATE INDEX IF NOT EXISTS dealer_campaigns_dealer_idx
  ON public.dealer_campaigns (dealership_id, created_at DESC);

-- ── Grants (RLS still applies; the app uses the authenticated role via req.supabase) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_campaigns TO authenticated;
GRANT ALL ON public.dealer_email_templates TO service_role;
GRANT ALL ON public.dealer_campaigns TO service_role;

-- ── RLS: tenant isolation + lead.assign permission (per docs/rls-standard.md) ──
ALTER TABLE public.dealer_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_email_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealer_email_templates_select_authorized" ON public.dealer_email_templates;
DROP POLICY IF EXISTS "dealer_email_templates_insert_authorized" ON public.dealer_email_templates;
DROP POLICY IF EXISTS "dealer_email_templates_update_authorized" ON public.dealer_email_templates;
DROP POLICY IF EXISTS "dealer_email_templates_delete_authorized" ON public.dealer_email_templates;

CREATE POLICY "dealer_email_templates_select_authorized" ON public.dealer_email_templates
  FOR SELECT TO authenticated USING (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_email_templates_insert_authorized" ON public.dealer_email_templates
  FOR INSERT TO authenticated WITH CHECK (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_email_templates_update_authorized" ON public.dealer_email_templates
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'lead.assign'))
  WITH CHECK (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_email_templates_delete_authorized" ON public.dealer_email_templates
  FOR DELETE TO authenticated USING (authz.has_permission(dealership_id, 'lead.assign'));

DROP POLICY IF EXISTS "dealer_campaigns_select_authorized" ON public.dealer_campaigns;
DROP POLICY IF EXISTS "dealer_campaigns_insert_authorized" ON public.dealer_campaigns;
DROP POLICY IF EXISTS "dealer_campaigns_update_authorized" ON public.dealer_campaigns;
DROP POLICY IF EXISTS "dealer_campaigns_delete_authorized" ON public.dealer_campaigns;

CREATE POLICY "dealer_campaigns_select_authorized" ON public.dealer_campaigns
  FOR SELECT TO authenticated USING (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_campaigns_insert_authorized" ON public.dealer_campaigns
  FOR INSERT TO authenticated WITH CHECK (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_campaigns_update_authorized" ON public.dealer_campaigns
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'lead.assign'))
  WITH CHECK (authz.has_permission(dealership_id, 'lead.assign'));
CREATE POLICY "dealer_campaigns_delete_authorized" ON public.dealer_campaigns
  FOR DELETE TO authenticated USING (authz.has_permission(dealership_id, 'lead.assign'));

-- ── Feature catalog: Pro-only email marketing ────────────────────────────────
INSERT INTO public.features (id, product_id, name, feature_group, sort_order)
VALUES ('os.email_marketing', 'dealer_os', 'Email Marketing', 'ops', 11)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, feature_group = EXCLUDED.feature_group, sort_order = EXCLUDED.sort_order;

INSERT INTO public.plan_features (plan_id, feature_id)
VALUES ('os_pro', 'os.email_marketing'), ('os_enterprise', 'os.email_marketing')
ON CONFLICT DO NOTHING;
