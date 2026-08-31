-- Reviewer feedback and explicit rejection state for dealer website change sets.
ALTER TABLE public.website_change_sets
  ADD COLUMN IF NOT EXISTS review_feedback TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.website_change_sets DROP CONSTRAINT IF EXISTS website_change_sets_status_check;
ALTER TABLE public.website_change_sets
  ADD CONSTRAINT website_change_sets_status_check
  CHECK (status IN ('draft', 'review', 'approved', 'rejected', 'published', 'archived'));
