-- Migration: HR & Compliance Supabase Foundation with RLS & Data API Grants
-- 1. hr_employees (Roster profiles linked to auth/users and dealerships)
-- 2. hr_time_entries (Timeclock records with clock-in, clock-out, breaks, notes)
-- 3. hr_training_completions (Course completions & 25-question test scores)
-- 4. hr_certificates (Official completion diplomas issued)
-- 5. hr_policy_signatures (Signed safety policies & Bill 168 compliance)
-- 6. hr_leave_requests (Vacation, sick leave, and time-off requests)
-- 7. hr_payroll_batches & hr_payroll_items (Real accounting payroll ledger)

CREATE TABLE IF NOT EXISTS public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'salesperson',
  department TEXT NOT NULL DEFAULT 'Sales',
  hourly_rate NUMERIC(10,2) DEFAULT 22.50,
  salary NUMERIC(10,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active',
  emergency_contact TEXT,
  sin_ssn_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  course_id TEXT NOT NULL,
  course_title TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  certificate_id TEXT,
  expiry_date TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.hr_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  certificate_id TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL,
  course_title TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url TEXT
);

CREATE TABLE IF NOT EXISTS public.hr_policy_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  policy_id TEXT NOT NULL,
  policy_title TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  document_hash TEXT
);

CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hours NUMERIC(6,2) DEFAULT 16.00,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_payroll_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL,
  batch_number TEXT NOT NULL UNIQUE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  staff_count INT DEFAULT 0,
  gross_wages NUMERIC(12,2) DEFAULT 0.00,
  commissions NUMERIC(12,2) DEFAULT 0.00,
  tax_withheld NUMERIC(12,2) DEFAULT 0.00,
  net_payroll NUMERIC(12,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'Paid & Disbursed',
  journal_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hr_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.hr_payroll_batches(id) ON DELETE CASCADE,
  dealership_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  base_wages NUMERIC(10,2) DEFAULT 0.00,
  commissions NUMERIC(10,2) DEFAULT 0.00,
  spiffs NUMERIC(10,2) DEFAULT 0.00,
  bonuses NUMERIC(10,2) DEFAULT 0.00,
  tax_deductions NUMERIC(10,2) DEFAULT 0.00,
  net_pay NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable & Force RLS
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_time_entries FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_completions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_certificates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_policy_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_policy_signatures FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_payroll_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_batches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hr_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_items FORCE ROW LEVEL SECURITY;

-- PostgREST & Data API Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.hr_employees,
  public.hr_time_entries,
  public.hr_training_completions,
  public.hr_certificates,
  public.hr_policy_signatures,
  public.hr_leave_requests,
  public.hr_payroll_batches,
  public.hr_payroll_items
TO service_role, authenticated;
