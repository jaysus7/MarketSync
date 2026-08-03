-- Commission review/approval gates + exceptions queue (Group 4). Additive only.
--
-- 1. Review + approve gates on a pay period (nullable columns). A period must be
--    reviewed AND approved before it can be paid — enforced in the route layer. The
--    open→locked→paid status enum is unchanged.
-- 2. commission_exceptions: an actionable queue of anomalies found on commission lines
--    (no plan, zero/negative payout, unwound-but-not-reversed, cost unknown). Rescans
--    upsert by (dealership_id, deal_id, type) so re-running never duplicates.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first. Idempotent; safe to re-run.

ALTER TABLE public.commission_pay_periods
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by  uuid,
  ADD COLUMN IF NOT EXISTS approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by  uuid;

CREATE TABLE IF NOT EXISTS public.commission_exceptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  deal_id       uuid,
  line_id       uuid,
  rep_id        uuid,
  type          text NOT NULL,
  detail        text,
  severity      text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning','error')),
  status        text NOT NULL DEFAULT 'open'    CHECK (status IN ('open','acknowledged','resolved')),
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, deal_id, type)
);

CREATE INDEX IF NOT EXISTS commission_exceptions_open_idx
  ON public.commission_exceptions (dealership_id, status);

-- ── RLS (accounting.*) ──
ALTER TABLE public.commission_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_exceptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_exceptions_select_authorized" ON public.commission_exceptions;
DROP POLICY IF EXISTS "commission_exceptions_insert_authorized" ON public.commission_exceptions;
DROP POLICY IF EXISTS "commission_exceptions_update_authorized" ON public.commission_exceptions;
DROP POLICY IF EXISTS "commission_exceptions_delete_authorized" ON public.commission_exceptions;

CREATE POLICY "commission_exceptions_select_authorized" ON public.commission_exceptions
  FOR SELECT TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.view'));

CREATE POLICY "commission_exceptions_insert_authorized" ON public.commission_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_exceptions_update_authorized" ON public.commission_exceptions
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.edit'))
  WITH CHECK (authz.has_permission(dealership_id, 'accounting.edit'));

CREATE POLICY "commission_exceptions_delete_authorized" ON public.commission_exceptions
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, 'accounting.delete'));
