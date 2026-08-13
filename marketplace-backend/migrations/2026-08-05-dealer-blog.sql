-- ─────────────────────────────────────────────────────────────────────────────
-- Dealer website — per-dealership Blog / News.
--
-- Each dealership authors its own posts inside the Website builder; they render on
-- the dealer's public site at /blog with individual post pages and a "Latest posts"
-- section. Distinct from the platform-level `blog_posts` (MarketSync marketing blog).
--
-- Gating: RLS enforces tenant isolation + the `site.manage` permission (owner / GM),
-- the same permission the rest of the website builder uses. Public reads are served
-- server-side (supabaseAdmin) in site.js, so visitors never touch this table directly.
--
-- Apply to STAGING (hpxnjbdiaaoopxeayfen) first, verify, then production.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dealer_blog_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id   uuid NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  excerpt         text NOT NULL DEFAULT '',
  content_html    text NOT NULL DEFAULT '',
  cover_image_url text,
  author          text,
  tags            text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft',   -- draft | published
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dealership_id, slug)
);
CREATE INDEX IF NOT EXISTS dealer_blog_posts_dealer_idx
  ON public.dealer_blog_posts (dealership_id, status, published_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dealer_blog_posts TO authenticated;
GRANT ALL ON public.dealer_blog_posts TO service_role;

ALTER TABLE public.dealer_blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_blog_posts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealer_blog_posts_select_authorized" ON public.dealer_blog_posts;
DROP POLICY IF EXISTS "dealer_blog_posts_insert_authorized" ON public.dealer_blog_posts;
DROP POLICY IF EXISTS "dealer_blog_posts_update_authorized" ON public.dealer_blog_posts;
DROP POLICY IF EXISTS "dealer_blog_posts_delete_authorized" ON public.dealer_blog_posts;

CREATE POLICY "dealer_blog_posts_select_authorized" ON public.dealer_blog_posts
  FOR SELECT TO authenticated USING (authz.has_permission(dealership_id, 'site.manage'));
CREATE POLICY "dealer_blog_posts_insert_authorized" ON public.dealer_blog_posts
  FOR INSERT TO authenticated WITH CHECK (authz.has_permission(dealership_id, 'site.manage'));
CREATE POLICY "dealer_blog_posts_update_authorized" ON public.dealer_blog_posts
  FOR UPDATE TO authenticated
  USING (authz.has_permission(dealership_id, 'site.manage'))
  WITH CHECK (authz.has_permission(dealership_id, 'site.manage'));
CREATE POLICY "dealer_blog_posts_delete_authorized" ON public.dealer_blog_posts
  FOR DELETE TO authenticated USING (authz.has_permission(dealership_id, 'site.manage'));
