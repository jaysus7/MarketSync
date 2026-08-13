-- Standalone AI Chatbot add-on entitlement. Sold on its own so a dealer can pay for
-- just the website chatbot and embed it on LeadBox / eDealer / any site, without the
-- rest of MarketSync. Mirrors the ai_boost / inv_intel *_active/_paid pattern.
-- Requires Stripe price env: STRIPE_AI_CHATBOT_PRICE_ID.
-- Already applied to project omyuqzveegzspeojrqkd.
alter table public.dealerships
  add column if not exists ai_chatbot_active boolean not null default false,
  add column if not exists ai_chatbot_paid boolean not null default false;
