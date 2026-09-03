-- Reporting Intelligence semantic layer (staging).
-- Does not duplicate canonical business tables. Stores report definitions,
-- saved reports, schedules and insight audit only.

CREATE TABLE IF NOT EXISTS reporting_metrics (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  department text NOT NULL,
  description text,
  source_entity text NOT NULL,
  formula text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  unit text,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporting_dimensions (
  id text PRIMARY KEY,
  dim_group text NOT NULL,
  source text,
  pii boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS reporting_report_defs (
  id text PRIMARY KEY,
  name text NOT NULL,
  department text NOT NULL,
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporting_saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  owner_id uuid,
  name text NOT NULL,
  definition jsonb NOT NULL,
  favourite boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  schedule jsonb,
  alert_thresholds jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reporting_saved_reports_dealer_idx
  ON reporting_saved_reports (dealership_id);

CREATE TABLE IF NOT EXISTS reporting_insight_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  statement text NOT NULL,
  relationship text NOT NULL,
  sample_size integer NOT NULL,
  reliability_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reporting_export_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  actor_id uuid,
  report_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reporting_saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_insight_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_export_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reporting_saved_reports_tenant ON reporting_saved_reports;
CREATE POLICY reporting_saved_reports_tenant ON reporting_saved_reports
  USING (dealership_id::text = current_setting('request.jwt.claims', true)::jsonb->>'dealership_id');

DROP POLICY IF EXISTS reporting_insight_audit_tenant ON reporting_insight_audit;
CREATE POLICY reporting_insight_audit_tenant ON reporting_insight_audit
  USING (dealership_id::text = current_setting('request.jwt.claims', true)::jsonb->>'dealership_id');

DROP POLICY IF EXISTS reporting_export_audit_tenant ON reporting_export_audit;
CREATE POLICY reporting_export_audit_tenant ON reporting_export_audit
  USING (dealership_id::text = current_setting('request.jwt.claims', true)::jsonb->>'dealership_id');
