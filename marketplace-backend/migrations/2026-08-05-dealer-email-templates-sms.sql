-- Dealer email templates: add an SMS/text channel flag so a template can be toggled
-- on for text as well as email. `active` already exists (on/off). RLS unchanged.
ALTER TABLE public.dealer_email_templates
  ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false;
