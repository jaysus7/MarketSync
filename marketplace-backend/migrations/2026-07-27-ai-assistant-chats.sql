-- Internal "Ask MarketSync" transcripts (one row per Q&A) for manager review.
-- Applied to Supabase via MCP on 2026-07-27; file kept for the record.

CREATE TABLE IF NOT EXISTS ai_assistant_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  question text NOT NULL,
  answer text,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_assistant_chats_dealer_time
  ON ai_assistant_chats (dealership_id, created_at DESC);

COMMENT ON TABLE ai_assistant_chats IS 'Internal Ask MarketSync transcripts (one row per Q&A) for manager review.';
