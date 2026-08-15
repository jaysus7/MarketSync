-- Performance Cleanup Migration (Task 5)
-- 1. Deduplicate indexes on high-churn tables (ai_messages, events, staff_*, webhook_deliveries)
-- 2. Optimize RLS policies to use (select auth.uid()) for InitPlan evaluation instead of per-row function calls.

-- 1. Duplicate Index Consolidation & Cleanups
DROP INDEX IF EXISTS public.idx_ai_messages_conv_created;
DROP INDEX IF EXISTS public.idx_events_dealership_created;
DROP INDEX IF EXISTS public.idx_staff_members_dealership_user;
DROP INDEX IF EXISTS public.idx_webhook_deliveries_retry;

-- Ensure primary composite indexes exist cleanly
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_created_at_idx 
  ON public.ai_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS events_dealership_id_created_at_idx 
  ON public.events (dealership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS webhook_deliveries_status_retry_idx 
  ON public.webhook_deliveries (status, next_retry_at);

-- 2. Academy RLS InitPlan Performance Optimization
-- Replacing per-row function evaluation of auth.uid() with (select auth.uid())
ALTER TABLE public.academy_tour_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and edit their own tour progress" ON public.academy_tour_progress;
DROP POLICY IF EXISTS "academy_tour_progress_user_policy" ON public.academy_tour_progress;

CREATE POLICY "academy_tour_progress_user_policy" ON public.academy_tour_progress
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
