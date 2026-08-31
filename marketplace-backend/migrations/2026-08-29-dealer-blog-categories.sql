-- Additive CMS upgrade: preserve existing dealer blog posts while giving them
-- a first-class category for index pages, filtering, and SEO organization.
ALTER TABLE public.dealer_blog_posts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';

CREATE INDEX IF NOT EXISTS dealer_blog_posts_category_idx
  ON public.dealer_blog_posts (dealership_id, category, published_at DESC);
