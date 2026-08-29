-- Additive CMS upgrade: scheduled posts remain private until their publish time.
ALTER TABLE public.dealer_blog_posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS dealer_blog_posts_schedule_idx
  ON public.dealer_blog_posts (dealership_id, status, scheduled_at);
