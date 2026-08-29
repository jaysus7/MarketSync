-- ═══════════════════════════════════════════════════════════════════════════════
-- MarketSync HQ — Customer CRM, Multi-Channel Ingestion & Attribution Schema
-- Migration: 20260828000002_hq_crm_attribution.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. HQ Companies (Dealerships / Corporate Accounts with Dealer Group Hierarchy)
CREATE TABLE IF NOT EXISTS hq_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  website TEXT,
  dealer_group_id UUID REFERENCES hq_companies(id) ON DELETE SET NULL,
  is_dealer_group BOOLEAN NOT NULL DEFAULT false,
  locations_count INTEGER NOT NULL DEFAULT 1,
  address TEXT,
  phone TEXT,
  tier TEXT DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect', 'lead', 'trial', 'customer', 'churned', 'partner')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id TEXT,
  dealership_id UUID REFERENCES dealerships(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_companies_domain ON hq_companies(domain);
CREATE INDEX IF NOT EXISTS idx_hq_companies_status ON hq_companies(status);
CREATE INDEX IF NOT EXISTS idx_hq_companies_stripe ON hq_companies(stripe_customer_id);

-- 2. HQ Contacts (Individual Persons)
CREATE TABLE IF NOT EXISTS hq_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES hq_companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'unsubscribed', 'bounced')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'lead' CHECK (lifecycle_stage IN ('subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'other')),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hq_contacts_email_company_uniq UNIQUE (email, company_id)
);

CREATE INDEX IF NOT EXISTS idx_hq_contacts_email ON hq_contacts(email);
CREATE INDEX IF NOT EXISTS idx_hq_contacts_company ON hq_contacts(company_id);

-- 3. HQ Leads (Inbound Inquiries & Multi-Touch Attribution)
CREATE TABLE IF NOT EXISTS hq_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES hq_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES hq_companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'closed')),
  first_touch_source TEXT,
  last_touch_source TEXT,
  channel TEXT DEFAULT 'website',
  campaign_id TEXT,
  campaign_name TEXT,
  ad_group TEXT,
  ad_id TEXT,
  keyword TEXT,
  landing_page TEXT,
  referrer TEXT,
  gclid TEXT,
  fbclid TEXT,
  wbraid TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  affiliate_id TEXT,
  estimated_value NUMERIC(12, 2) DEFAULT 0,
  notes TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_leads_contact ON hq_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_hq_leads_status ON hq_leads(status);
CREATE INDEX IF NOT EXISTS idx_hq_leads_campaign ON hq_leads(utm_campaign);

-- 4. HQ Opportunities (Sales Pipeline)
CREATE TABLE IF NOT EXISTS hq_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES hq_companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES hq_contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  product TEXT NOT NULL,
  plan TEXT,
  expected_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mrr_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  probability NUMERIC(5, 2) NOT NULL DEFAULT 50,
  stage TEXT NOT NULL DEFAULT 'discovery' CHECK (stage IN (
    'discovery', 'demo_scheduled', 'demo_completed', 'proposal_sent',
    'negotiation', 'won', 'lost'
  )),
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  lost_reason TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_opportunities_company_stage ON hq_opportunities(company_id, stage);

-- 5. HQ Managed Trials
CREATE TABLE IF NOT EXISTS hq_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES hq_companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES hq_contacts(id) ON DELETE SET NULL,
  product TEXT NOT NULL,
  plan TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'extended', 'converted', 'expired', 'cancelled')),
  extended_days INTEGER NOT NULL DEFAULT 0,
  extended_reason TEXT,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. HQ Evidence-Based Consent Records
CREATE TABLE IF NOT EXISTS hq_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES hq_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'marketing', 'all')),
  purpose TEXT NOT NULL,
  source_record TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  policy_version TEXT NOT NULL DEFAULT '2026-v1',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  is_valid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_consent_contact ON hq_consent_records(contact_id, channel);

-- 7. HQ Customer Activity Timeline
CREATE TABLE IF NOT EXISTS hq_customer_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES hq_companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES hq_contacts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_customer_activity_company ON hq_customer_activity(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hq_customer_activity_contact ON hq_customer_activity(contact_id, created_at DESC);

-- 8. HQ Marketing Attribution Graph
CREATE TABLE IF NOT EXISTS hq_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES hq_companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES hq_leads(id) ON DELETE SET NULL,
  touchpoint_type TEXT NOT NULL CHECK (touchpoint_type IN ('first_touch', 'last_touch', 'multi_touch')),
  channel TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign TEXT,
  ad_id TEXT,
  keyword TEXT,
  spend_allocated NUMERIC(12, 2) NOT NULL DEFAULT 0,
  revenue_attributed NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mrr_attributed NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. HQ Import Jobs
CREATE TABLE IF NOT EXISTS hq_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('leads', 'contacts', 'companies', 'opportunities')),
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
