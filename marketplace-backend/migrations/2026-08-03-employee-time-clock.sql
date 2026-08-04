-- Employee time clock — sign in / sign out + tracked hours for every employee.
--
-- One row per clock-in → clock-out session. A partial unique index guarantees an
-- employee can only have ONE active (not-yet-clocked-out) session at a time — the DB,
-- not the app, enforces "no double clock-in". Techs may optionally attribute a session
-- to a repair order (ro_id) so shop labor time is captured too.
--
-- RLS: an employee reads + writes their OWN entries; staff managers (users.manage) read
-- and edit everyone's (timesheets, corrections, approvals). Apply to STAGING first.
-- Idempotent.

CREATE TABLE IF NOT EXISTS public.time_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id  uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL,
  clock_in       timestamptz NOT NULL DEFAULT now(),
  clock_out      timestamptz,
  break_minutes  integer NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  ro_id          uuid,                       -- optional: tech time attributed to a repair order
  note           text,
  source         text NOT NULL DEFAULT 'web',
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','approved')),
  edited_by      uuid,
  edited_at      timestamptz,
  approved_by    uuid,
  approved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (clock_out IS NULL OR clock_out >= clock_in)
);

-- Exactly one open session per employee (DB-enforced — prevents double clock-in).
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_active
  ON public.time_entries (employee_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS time_entries_dealer_day_idx
  ON public.time_entries (dealership_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS time_entries_employee_idx
  ON public.time_entries (employee_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS time_entries_ro_idx
  ON public.time_entries (ro_id);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_select" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON public.time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON public.time_entries;

-- Own entries, or all if you manage staff.
CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (employee_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'users.manage'));

-- An employee clocks their OWN time; a manager may also enter on their behalf.
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (employee_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'users.manage'));

CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (employee_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'users.manage'))
  WITH CHECK (employee_id = (select auth.uid()) OR authz.has_permission(dealership_id, 'users.manage'));

-- Only staff managers may delete a time entry.
CREATE POLICY "time_entries_delete" ON public.time_entries
  FOR DELETE TO authenticated
  USING (authz.has_permission(dealership_id, 'users.manage'));
