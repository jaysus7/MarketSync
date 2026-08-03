-- Employee commission statements — acknowledge / dispute tracking (Group 5). Additive.
--
-- A "statement" is a rep's commission lines for a pay period (computed from existing
-- deal_commissions — no data duplicated). This table only records the rep's sign-off:
-- acknowledged or disputed (with a note). One row per (period, rep).
--
-- RLS: a rep may read + write their OWN row; accounting managers may read all and
-- resolve disputes. Apply to STAGING first. Idempotent.

CREATE TABLE IF NOT EXISTS public.commission_statement_acks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id  uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  pay_period_id  uuid NOT NULL REFERENCES public.commission_pay_periods(id) ON DELETE CASCADE,
  rep_id         uuid NOT NULL,
  status         text NOT NULL DEFAULT 'acknowledged' CHECK (status IN ('acknowledged','disputed')),
  note           text,
  resolved_at    timestamptz,
  resolved_by    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pay_period_id, rep_id)
);

CREATE INDEX IF NOT EXISTS commission_statement_acks_period_idx
  ON public.commission_statement_acks (dealership_id, pay_period_id);

ALTER TABLE public.commission_statement_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_statement_acks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_statement_acks_select" ON public.commission_statement_acks;
DROP POLICY IF EXISTS "commission_statement_acks_insert" ON public.commission_statement_acks;
DROP POLICY IF EXISTS "commission_statement_acks_update" ON public.commission_statement_acks;
DROP POLICY IF EXISTS "commission_statement_acks_delete" ON public.commission_statement_acks;

-- Rep sees their own; accounting managers see all in their dealership.
CREATE POLICY "commission_statement_acks_select" ON public.commission_statement_acks
  FOR SELECT TO authenticated
  USING (rep_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'accounting.view'));

-- A rep records their own sign-off; a manager may also record/resolve on their behalf.
CREATE POLICY "commission_statement_acks_insert" ON public.commission_statement_acks
  FOR INSERT TO authenticated
  WITH CHECK (rep_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_statement_acks_update" ON public.commission_statement_acks
  FOR UPDATE TO authenticated
  USING (rep_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'accounting.edit'))
  WITH CHECK (rep_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_statement_acks_delete" ON public.commission_statement_acks
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.delete'));
