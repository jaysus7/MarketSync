-- Preserve operational task history after users remove a task from the board.

ALTER TABLE IF EXISTS public.dealer_tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dealer_tasks_active_idx
  ON public.dealer_tasks (dealership_id, status, due_date)
  WHERE deleted_at IS NULL;
