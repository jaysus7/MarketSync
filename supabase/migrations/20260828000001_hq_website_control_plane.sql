-- ═══════════════════════════════════════════════════════════════════════════════
-- MarketSync HQ — Website Control Plane, Headless CMS & Discovery Engine Schema
-- Migration: 20260828000001_hq_website_control_plane.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Website Pages
CREATE TABLE IF NOT EXISTS website_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  template TEXT NOT NULL DEFAULT 'standard',
  featured_image_url TEXT,
  nav_visibility BOOLEAN NOT NULL DEFAULT true,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  og_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_pages_site_slug_uniq UNIQUE (site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_site_status ON website_pages(site_id, status);
CREATE INDEX IF NOT EXISTS idx_website_pages_slug ON website_pages(slug);

-- 2. Website Page Versions (Immutable Revision History)
CREATE TABLE IF NOT EXISTS website_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  sections_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  og_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_summary TEXT,
  editor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_page_versions_page_ver_uniq UNIQUE (page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_website_page_versions_page ON website_page_versions(page_id, version_number DESC);

-- 3. Website Sections (Structured Page Builder Content)
CREATE TABLE IF NOT EXISTS website_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'hero', 'text', 'image', 'image_text', 'features', 'benefits',
    'pricing', 'comparison', 'testimonials', 'logos', 'statistics',
    'video', 'faq', 'cta', 'contact', 'form', 'product_grid',
    'product_detail', 'dealeros_feature_grid', 'blog_feed', 'custom_html'
  )),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_sections_page_order ON website_sections(page_id, sort_order ASC);

-- 4. Website Posts (Blog CMS)
CREATE TABLE IF NOT EXISTS website_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  content_markdown TEXT,
  cover_image_url TEXT,
  author TEXT NOT NULL DEFAULT 'MarketSync',
  category TEXT DEFAULT 'General',
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'n8n', 'ai', 'import')),
  workflow_id TEXT,
  workflow_name TEXT,
  generation_date TIMESTAMPTZ,
  seo_title TEXT,
  seo_description TEXT,
  canonical_url TEXT,
  og_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_posts_site_slug_uniq UNIQUE (site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_posts_site_status ON website_posts(site_id, status);
CREATE INDEX IF NOT EXISTS idx_website_posts_slug ON website_posts(slug);
CREATE INDEX IF NOT EXISTS idx_website_posts_workflow ON website_posts(workflow_id);

-- 5. Website Post Versions
CREATE TABLE IF NOT EXISTS website_post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES website_posts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL,
  change_summary TEXT,
  editor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_post_versions_post_ver_uniq UNIQUE (post_id, version_number)
);

-- 6. Website Media Library
CREATE TABLE IF NOT EXISTS website_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  compression_state TEXT NOT NULL DEFAULT 'original' CHECK (compression_state IN ('original', 'optimized', 'compressed', 'failed')),
  usage_locations TEXT[] NOT NULL DEFAULT '{}',
  uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_media_site ON website_media(site_id);
CREATE INDEX IF NOT EXISTS idx_website_media_filename ON website_media(filename);

-- 7. Website Navigation Menus
CREATE TABLE IF NOT EXISTS website_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  location TEXT NOT NULL CHECK (location IN ('primary', 'secondary', 'footer', 'mobile')),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_nav_site_loc_uniq UNIQUE (site_id, location)
);

CREATE TABLE IF NOT EXISTS website_navigation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navigation_id UUID NOT NULL REFERENCES website_navigation(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES website_navigation_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  page_id UUID REFERENCES website_pages(id) ON DELETE SET NULL,
  target TEXT NOT NULL DEFAULT '_self' CHECK (target IN ('_self', '_blank')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_external BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_nav_items_nav_order ON website_navigation_items(navigation_id, sort_order ASC);

-- 8. Website Redirects
CREATE TABLE IF NOT EXISTS website_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  hits BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_redirects_site_src_uniq UNIQUE (site_id, source_path)
);

-- 9. Website Design Tokens
CREATE TABLE IF NOT EXISTS website_design_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  category TEXT NOT NULL CHECK (category IN ('brand', 'typography', 'layout', 'liquid_glass', 'components')),
  token_key TEXT NOT NULL,
  token_value JSONB NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT website_design_tokens_site_key_uniq UNIQUE (site_id, category, token_key)
);

-- 10. Website SEO Global Settings
CREATE TABLE IF NOT EXISTS website_seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate' UNIQUE,
  default_title_template TEXT NOT NULL DEFAULT '%s — MarketSync',
  default_description_template TEXT,
  canonical_domain TEXT NOT NULL DEFAULT 'https://marketsync.link',
  robots_txt TEXT,
  sitemap_enabled BOOLEAN NOT NULL DEFAULT true,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_organization JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Website Discovery Scans & Findings
CREATE TABLE IF NOT EXISTS website_discovery_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  overall_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  seo_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  accessibility_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  content_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  conversion_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  cwv_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  scan_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_discovery_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES website_discovery_scans(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT NOT NULL CHECK (category IN ('seo', 'performance', 'accessibility', 'content', 'conversion', 'links', 'media')),
  page_slug TEXT NOT NULL,
  issue TEXT NOT NULL,
  explanation TEXT NOT NULL,
  recommended_fix TEXT NOT NULL,
  expected_benefit TEXT,
  risk_level TEXT NOT NULL DEFAULT 'requires_approval' CHECK (risk_level IN ('safe_auto', 'requires_approval', 'manual_only')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'dismissed', 'reverted')),
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_findings_scan_status ON website_discovery_findings(scan_id, status);

-- 12. Website Change Sets (Batch Publishing with Optimistic Concurrency)
CREATE TABLE IF NOT EXISTS website_change_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  name TEXT NOT NULL,
  description TEXT,
  version_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_change_set_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_set_id UUID NOT NULL REFERENCES website_change_sets(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('page', 'post', 'section', 'navigation', 'design_token', 'redirect', 'seo')),
  item_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'publish')),
  diff_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Website Deployments & Production Verification
CREATE TABLE IF NOT EXISTS website_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL DEFAULT 'marketsync_corporate',
  change_set_id UUID REFERENCES website_change_sets(id) ON DELETE SET NULL,
  commit_id TEXT,
  build_id TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'publish' CHECK (trigger_type IN ('publish', 'manual', 'api', 'rollback')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'queued', 'building', 'build_failed', 'built',
    'deploying', 'deployment_failed', 'deployed',
    'verifying', 'verified', 'verification_failed', 'rolled_back'
  )),
  published_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  build_logs TEXT,
  deployed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_status TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_deployments_site_created ON website_deployments(site_id, created_at DESC);
