-- Cover the author foreign keys used by the builder audit/history queries.
CREATE INDEX IF NOT EXISTS idx_dealer_website_revisions_created_by
  ON dealer_website_revisions(created_by);
CREATE INDEX IF NOT EXISTS idx_dealer_website_revisions_base_revision
  ON dealer_website_revisions(base_revision_id);
CREATE INDEX IF NOT EXISTS idx_dealer_website_media_created_by
  ON dealer_website_media(created_by);
