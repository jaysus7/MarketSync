-- Phase 2: Canonical Data Model - Opportunities and Appointments

CREATE TABLE IF NOT EXISTS public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  inventory_id uuid,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- The core stages of the dealership sales process
  stage text NOT NULL DEFAULT 'New Lead',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  
  source text,
  lost_reason text,
  notes text,
  
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunities_dealership_idx ON public.opportunities(dealership_id);
CREATE INDEX IF NOT EXISTS opportunities_contact_idx ON public.opportunities(contact_id);

CREATE TABLE IF NOT EXISTS public.sales_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  inventory_id uuid,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  appointment_at timestamptz NOT NULL,
  appointment_type text DEFAULT 'showroom',
  source text,
  notes text,
  
  -- Lifecycle states
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'arrived', 'showed', 'no-show', 'cancelled', 'rescheduled')),
  reminded_at timestamptz,
  
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_appointments_dealership_idx ON public.sales_appointments(dealership_id);
CREATE INDEX IF NOT EXISTS sales_appointments_opportunity_idx ON public.sales_appointments(opportunity_id);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_appointments ENABLE ROW LEVEL SECURITY;

-- 
-- BACKFILL LOGIC
--

-- 1. Create an opportunity for every contact that has an active or past deal/status
INSERT INTO public.opportunities (
  dealership_id,
  contact_id,
  assigned_to,
  stage,
  status,
  created_at,
  updated_at
)
SELECT 
  c.dealership_id,
  c.id,
  c.assigned_rep,
  CASE 
    WHEN c.status IN ('sold', 'fni', 'delivered') THEN 'Delivered'
    WHEN c.status = 'appointment' THEN 'Appointment Set'
    WHEN c.status = 'contacted' THEN 'Contacted'
    WHEN c.status = 'lost' THEN 'Lost'
    ELSE 'New Lead'
  END,
  CASE 
    WHEN c.status IN ('sold', 'fni', 'delivered') THEN 'won'
    WHEN c.status = 'lost' THEN 'lost'
    ELSE 'active'
  END,
  c.created_at,
  c.created_at
FROM public.contacts c
ON CONFLICT DO NOTHING;

-- 2. Migrate existing CRM tasks (type='appointment') into sales_appointments
INSERT INTO public.sales_appointments (
  dealership_id,
  contact_id,
  assigned_to,
  appointment_at,
  notes,
  status,
  created_at,
  updated_at
)
SELECT
  t.dealership_id,
  t.contact_id,
  t.assigned_to,
  t.due_at,
  t.title,
  CASE WHEN t.done THEN 'showed' ELSE 'booked' END,
  t.created_at,
  COALESCE(t.done_at, t.created_at)
FROM public.crm_tasks t
WHERE t.type = 'appointment' AND t.contact_id IS NOT NULL;

-- 3. Update deals to link to opportunities
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deals_opportunity_idx ON public.deals(opportunity_id);

-- Backfill deals to point to the newly created opportunities for their contacts
UPDATE public.deals d
SET opportunity_id = o.id
FROM public.opportunities o
WHERE d.contact_id = o.contact_id
  AND d.dealership_id = o.dealership_id
  AND d.opportunity_id IS NULL;
