-- Migration: Multi-Subscription Product Coverage & Entitlement Model
-- Resolves subscription collisions when multiple active plans/bundles cover overlapping products
-- (e.g., Dealer Website + MarketSync Digital).
-- Effective access is the UNION of all live product coverages.

CREATE TABLE IF NOT EXISTS public.subscription_product_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  subscription_id text NOT NULL,
  plan_id text NOT NULL,
  product_id text NOT NULL REFERENCES public.products(id),
  status text NOT NULL DEFAULT 'active',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_sub_prod_coverage UNIQUE (subscription_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_prod_coverage_dealer_status
  ON public.subscription_product_coverage (dealership_id, status);

CREATE INDEX IF NOT EXISTS idx_sub_prod_coverage_sub_id
  ON public.subscription_product_coverage (subscription_id);

-- Enable RLS
ALTER TABLE public.subscription_product_coverage ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "sub_prod_coverage_select_dealership" ON public.subscription_product_coverage;
DROP POLICY IF EXISTS "sub_prod_coverage_service_all" ON public.subscription_product_coverage;

-- Authenticated members can only view coverage for their own dealership
CREATE POLICY "sub_prod_coverage_select_dealership"
  ON public.subscription_product_coverage
  FOR SELECT TO authenticated
  USING (
    dealership_id = authz.current_dealership_id()
  );

-- Backend service role has full access
CREATE POLICY "sub_prod_coverage_service_all"
  ON public.subscription_product_coverage
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Backfill from existing subscriptions table if not already populated
INSERT INTO public.subscription_product_coverage (
  dealership_id,
  subscription_id,
  plan_id,
  product_id,
  status,
  trial_ends_at,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  s.dealership_id,
  COALESCE(s.stripe_subscription_id, 'sub_legacy_' || s.dealership_id::text || '_' || s.product_id),
  s.plan_id,
  s.product_id,
  s.status,
  s.trial_ends_at,
  s.current_period_end,
  COALESCE(s.created_at, now()),
  COALESCE(s.updated_at, now())
FROM public.subscriptions s
ON CONFLICT (subscription_id, product_id) DO NOTHING;
