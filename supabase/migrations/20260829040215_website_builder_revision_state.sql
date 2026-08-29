-- MarketSync Website Builder — dealer draft/publish revisions, structured
-- component documents, responsive values, and a private media index.
CREATE TABLE IF NOT EXISTS dealer_website_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','archived')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_revision_id UUID REFERENCES dealer_website_revisions(id) ON DELETE SET NULL,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CONSTRAINT dealer_website_revision_number_uniq UNIQUE (dealership_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_dealer_website_revisions_latest ON dealer_website_revisions(dealership_id, revision_number DESC);
CREATE INDEX IF NOT EXISTS idx_dealer_website_revisions_state ON dealer_website_revisions(dealership_id, state, revision_number DESC);

CREATE TABLE IF NOT EXISTS dealer_website_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES dealerships(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dealer_website_media_dealer ON dealer_website_media(dealership_id, created_at DESC);

ALTER TABLE dealer_website_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_website_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dealer_website_revisions_service_only ON dealer_website_revisions;
DROP POLICY IF EXISTS dealer_website_media_service_only ON dealer_website_media;
CREATE POLICY dealer_website_revisions_service_only ON dealer_website_revisions FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY dealer_website_media_service_only ON dealer_website_media FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON dealer_website_revisions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dealer_website_media TO service_role;
