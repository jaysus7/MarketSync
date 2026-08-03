-- Commission pay periods — the payroll organizing layer on top of deal_commissions.
--
-- Additive only: a new table + a nullable pay_period_id column on deal_commissions.
-- The existing commission lifecycle (pending → earned → paid / clawed_back) is NOT
-- changed; pay periods simply group the "earned" lines that get paid together and give
-- accounting a lockable boundary. Apply to STAGING (hpxnjbdiaaoopxeayfen) first, then prod.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.commission_pay_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- weekly | biweekly | semi_monthly | monthly | custom
  period_type   text NOT NULL DEFAULT 'monthly'
                  CHECK (period_type IN ('weekly','biweekly','semi_monthly','monthly','custom')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  -- open  → lines can be assigned/removed; locked → frozen for review/payroll; paid → paid out
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','locked','paid')),
  locked_at     timestamptz,
  locked_by     uuid,
  paid_at       timestamptz,
  paid_by       uuid,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE (dealership_id, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS commission_pay_periods_dealership_idx
  ON public.commission_pay_periods (dealership_id, start_date DESC);

-- Link commission lines to a pay period (nullable — existing rows stay unassigned).
ALTER TABLE public.deal_commissions
  ADD COLUMN IF NOT EXISTS pay_period_id uuid REFERENCES public.commission_pay_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS deal_commissions_pay_period_idx
  ON public.deal_commissions (pay_period_id);

-- ── RLS (see docs/rls-standard.md) — enable + force so even the owner is subject ──
ALTER TABLE public.commission_pay_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_pay_periods FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_pay_periods_select_authorized" ON public.commission_pay_periods;
DROP POLICY IF EXISTS "commission_pay_periods_insert_authorized" ON public.commission_pay_periods;
DROP POLICY IF EXISTS "commission_pay_periods_update_authorized" ON public.commission_pay_periods;
DROP POLICY IF EXISTS "commission_pay_periods_delete_authorized" ON public.commission_pay_periods;

CREATE POLICY "commission_pay_periods_select_authorized" ON public.commission_pay_periods
  FOR SELECT TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.view'));

CREATE POLICY "commission_pay_periods_insert_authorized" ON public.commission_pay_periods
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_pay_periods_update_authorized" ON public.commission_pay_periods
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.edit'))
  WITH CHECK (authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_pay_periods_delete_authorized" ON public.commission_pay_periods
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.delete'));
