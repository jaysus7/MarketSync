-- AI assistant management controls (Settings → AI):
--   ai_tools_disabled  — assistant tool names the dealer has turned off (subset of ASSISTANT_TOOLS)
--   ai_assistant_reps  — whether sales reps (non-managers) may use "Ask MarketSync"
-- Applied to Supabase via MCP on 2026-07-27; file kept for the record.

ALTER TABLE dealerships
  ADD COLUMN IF NOT EXISTS ai_tools_disabled jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_assistant_reps boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN dealerships.ai_tools_disabled IS 'Assistant tool names the dealer has turned off (subset of ASSISTANT_TOOLS).';
COMMENT ON COLUMN dealerships.ai_assistant_reps IS 'Whether sales reps (non-managers) may use the Ask MarketSync assistant.';
