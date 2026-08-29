-- ═══════════════════════════════════════════════════════════════════════════════
-- MarketSync HQ — Corporate General Ledger, Revenue, Expenses & Finance Schema
-- Migration: 20260828000003_hq_finance_ledger.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. HQ Chart of Accounts (Corporate Double-Entry Ledger)
CREATE TABLE IF NOT EXISTS hq_chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense')),
  system_key TEXT UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed Corporate Chart of Accounts
INSERT INTO hq_chart_of_accounts (code, name, category, system_key, description) VALUES
  ('1000', 'Cash / Operating Bank', 'asset', 'cash_operating', 'Primary corporate checking account'),
  ('1050', 'Stripe Clearing Account', 'asset', 'stripe_clearing', 'Undeposited Stripe customer funds in transit'),
  ('1100', 'Accounts Receivable', 'asset', 'accounts_receivable', 'Billed receivables from dealer groups & customers'),
  ('1200', 'Prepaid Expenses', 'asset', 'prepaid_expenses', 'Prepaid software and vendor licenses'),
  ('1500', 'Office & Computer Equipment', 'asset', 'fixed_assets', 'Capital assets and hardware'),
  ('1600', 'Sales Tax Paid / ITCs', 'asset', 'tax_paid', 'Input tax credits paid on corporate purchases'),
  ('2000', 'Accounts Payable', 'liability', 'accounts_payable', 'Outstanding vendor bills and expenses'),
  ('2100', 'Sales Tax Collected / Payable', 'liability', 'tax_collected', 'HST/GST/PST collected on sales'),
  ('2200', 'Unearned / Deferred Revenue', 'liability', 'deferred_revenue', 'Annual upfront prepayments'),
  ('2300', 'Affiliate Commissions Payable', 'liability', 'affiliate_payable', 'Accrued unpaid affiliate commissions'),
  ('2400', 'Staff Commissions Payable', 'liability', 'staff_commission_payable', 'Accrued unpaid staff sales commissions'),
  ('3000', 'Retained Earnings / Owner Equity', 'equity', 'retained_earnings', 'Cumulative net earnings'),
  ('4000', 'Subscription Revenue — Complete', 'revenue', 'sub_revenue_complete', 'DealerOS Complete subscription MRR'),
  ('4010', 'Subscription Revenue — Pro', 'revenue', 'sub_revenue_pro', 'DealerOS Pro subscription MRR'),
  ('4020', 'Subscription Revenue — Core', 'revenue', 'sub_revenue_core', 'DealerOS Core subscription MRR'),
  ('4030', 'Subscription Revenue — Digital', 'revenue', 'sub_revenue_digital', 'DealerOS Digital subscription MRR'),
  ('4050', 'Subscription Revenue — Suites & Standalone', 'revenue', 'sub_revenue_suites', 'CRM, F&I, Inventory, Fixed Ops or AI Chatbot subscriptions'),
  ('4100', 'Usage & Add-on Revenue', 'revenue', 'usage_revenue', 'AI tokens, SMS, Vision, sticker generation'),
  ('4200', 'Professional Services & Setup', 'revenue', 'setup_revenue', 'Onboarding, catalog setup, data migration fees'),
  ('4900', 'Discounts & Refunds (Contra-Revenue)', 'revenue', 'refunds_discounts', 'Customer refunds and promotional discounts'),
  ('5000', 'Hosting & Infrastructure COGS', 'cogs', 'hosting_cogs', 'Render, Supabase, Cloudflare, CDN, Redis hosting'),
  ('5100', 'AI & API Providers COGS', 'cogs', 'ai_cogs', 'Anthropic, OpenAI, DeepSeek, Twilio, Resend API usage'),
  ('5200', 'Payment Processing Fees COGS', 'cogs', 'processing_fees', 'Stripe processing fees and interchange'),
  ('6000', 'Advertising & Lead Generation', 'expense', 'advertising_expense', 'Google Ads, Meta Ads, LinkedIn Ads, sponsorships'),
  ('6100', 'Staff Sales Commissions Expense', 'expense', 'staff_commission_expense', 'Sales team commission earnings'),
  ('6200', 'Affiliate Commissions Expense', 'expense', 'affiliate_expense', 'Affiliate partner revenue share expense'),
  ('6300', 'Contractors & Professional Services', 'expense', 'contractor_expense', 'Engineering, design, legal, accounting contractors'),
  ('6400', 'Software & SaaS Tools', 'expense', 'software_expense', 'Internal tooling (GitHub, Google Workspace, Figma, Linear)'),
  ('6500', 'Payroll & Benefits', 'expense', 'payroll_expense', 'Wages, taxes, and health coverage'),
  ('6600', 'Office, Travel & Meals', 'expense', 'travel_office_expense', 'Conferences, travel, dealer visits, office'),
  ('6900', 'Bank & Admin Fees', 'expense', 'bank_fees', 'Wire fees, foreign exchange, corporate filings')
ON CONFLICT (code) DO NOTHING;

-- 2. HQ Financial Periods
CREATE TABLE IF NOT EXISTS hq_financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. HQ Journal Entries (Double-Entry Header)
CREATE TABLE IF NOT EXISTS hq_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number BIGSERIAL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_id UUID REFERENCES hq_financial_periods(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN (
    'stripe_subscription', 'stripe_invoice', 'manual_income',
    'expense', 'affiliate_payout', 'staff_commission_payout',
    'refund', 'adjustment', 'reversal'
  )),
  source_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'voided', 'reversed', 'archived')),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reversal_of_id UUID REFERENCES hq_journal_entries(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_journal_entries_date_status ON hq_journal_entries(entry_date, status);
CREATE INDEX IF NOT EXISTS idx_hq_journal_entries_source ON hq_journal_entries(source, source_id);

-- 4. HQ Journal Lines (Enforcing Debits & Credits)
CREATE TABLE IF NOT EXISTS hq_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES hq_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES hq_chart_of_accounts(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  description TEXT,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_journal_line_nonzero CHECK (debit > 0 OR credit > 0),
  CONSTRAINT chk_journal_line_not_both CHECK (debit = 0 OR credit = 0)
);

CREATE INDEX IF NOT EXISTS idx_hq_journal_lines_entry ON hq_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_hq_journal_lines_account ON hq_journal_lines(account_id);

-- 5. HQ Vendors
CREATE TABLE IF NOT EXISTS hq_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'software',
  website TEXT,
  contact_email TEXT,
  payment_terms TEXT DEFAULT 'due_on_receipt',
  default_account_code TEXT,
  tax_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. HQ Receipts (Private Storage, OCR & Human Review)
CREATE TABLE IF NOT EXISTS hq_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'extracted', 'reviewed', 'approved', 'rejected', 'posted')),
  ocr_vendor TEXT,
  confidence_score NUMERIC(5, 2),
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. HQ Expense Categories
CREATE TABLE IF NOT EXISTS hq_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  account_code TEXT NOT NULL REFERENCES hq_chart_of_accounts(code) ON DELETE RESTRICT,
  description TEXT,
  is_cogs BOOLEAN NOT NULL DEFAULT false,
  budget_limit_monthly NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. HQ Expenses
CREATE TABLE IF NOT EXISTS hq_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number BIGSERIAL UNIQUE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_id UUID REFERENCES hq_vendors(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  category_id UUID REFERENCES hq_expense_categories(id) ON DELETE SET NULL,
  account_code TEXT NOT NULL REFERENCES hq_chart_of_accounts(code) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_jurisdiction TEXT,
  tax_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_method TEXT NOT NULL DEFAULT 'credit_card',
  receipt_id UUID REFERENCES hq_receipts(id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES hq_journal_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'posted', 'voided')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_expenses_date_status ON hq_expenses(expense_date, status);
CREATE INDEX IF NOT EXISTS idx_hq_expenses_vendor ON hq_expenses(vendor_id);

-- 9. HQ Budgets & Budget Lines
CREATE TABLE IF NOT EXISTS hq_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year INTEGER NOT NULL,
  period_month INTEGER,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  total_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hq_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES hq_budgets(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES hq_chart_of_accounts(code) ON DELETE RESTRICT,
  budgeted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. HQ Recurring Expenses
CREATE TABLE IF NOT EXISTS hq_recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES hq_vendors(id) ON DELETE SET NULL,
  account_code TEXT NOT NULL REFERENCES hq_chart_of_accounts(code) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  next_due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. HQ Financial Forecast Scenarios
CREATE TABLE IF NOT EXISTS hq_financial_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_name TEXT NOT NULL CHECK (scenario_name IN ('Base', 'Conservative', 'Growth')),
  forecast_start_date DATE NOT NULL,
  forecast_end_date DATE NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  projected_mrr JSONB NOT NULL DEFAULT '[]'::jsonb,
  projected_cash JSONB NOT NULL DEFAULT '[]'::jsonb,
  projected_pnl JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. HQ Staff Commission Plans & Rules
CREATE TABLE IF NOT EXISTS hq_commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hq_staff_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES hq_opportunities(id) ON DELETE SET NULL,
  company_id UUID REFERENCES hq_companies(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES hq_commission_plans(id) ON DELETE SET NULL,
  plan_version INTEGER NOT NULL DEFAULT 1,
  deal_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'approved', 'paid', 'clawed_back')),
  accrued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payout_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. HQ Payouts (Staff & Affiliates)
CREATE TABLE IF NOT EXISTS hq_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('staff', 'affiliate')),
  recipient_id TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  payout_method TEXT NOT NULL DEFAULT 'direct_deposit',
  payout_reference TEXT,
  journal_entry_id UUID REFERENCES hq_journal_entries(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. HQ Payment Allocations
CREATE TABLE IF NOT EXISTS hq_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT NOT NULL,
  allocated_to_type TEXT NOT NULL CHECK (allocated_to_type IN ('subscription', 'invoice', 'expense', 'custom')),
  allocated_to_id TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  journal_entry_id UUID REFERENCES hq_journal_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. HQ Audit Log (Immutable Event Stream)
CREATE TABLE IF NOT EXISTS hq_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'System',
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hq_audit_entity ON hq_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_hq_audit_created ON hq_audit_log(created_at DESC);
