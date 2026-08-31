-- Dealer-group website governance. Rooftops retain their own site content;
-- this JSON policy carries only inherited controls from the group.
ALTER TABLE public.dealer_groups
  ADD COLUMN IF NOT EXISTS website_governance JSONB NOT NULL DEFAULT '{}'::jsonb;
