-- Seed the HQ email template library + surface the trial drip as an editable,
-- toggleable sequence (trial_onboarding). drip.js checks this sequence's `enabled`
-- flag before sending, and the HQ sequences runner skips 'trialing'-trigger
-- sequences so the drip is never double-sent. Idempotent.
-- (Applied to staging via apply_migration on 2026-08-04; file kept for prod parity.)

insert into public.saas_email_templates (name, subject, body)
select x.name, x.subject, x.body from (values
  ('Trial · Welcome (Day 0)', 'Welcome to MarketSync — let''s sync your inventory', E'Thanks for starting your 30-day trial! MarketSync runs your whole store from one place. First step: connect your inventory so we can pull in your vehicles.'),
  ('Trial · Inventory live (Day 2)', 'Your inventory is live', E'Your vehicles are now in MarketSync. View every listing, check details, and manage what''s ready to post.'),
  ('Trial · Post to Facebook (Day 4)', 'Post to Facebook Marketplace in a couple clicks', E'The MarketSync Chrome extension fills out the Facebook Marketplace listing for you — photos, price, description, all of it.'),
  ('Trial · AS-IS & status badges (Day 6)', 'Pro tip: AS-IS notes & status badges', E'Flag vehicles AS-IS and set status badges (posted, sold, pending) so you always know what''s where.'),
  ('Trial · Never double-post (Day 10)', 'Never double-post a vehicle again', E'MarketSync tracks which vehicles you''ve posted, so you never list the same car twice.'),
  ('Trial · Power-user tips (Day 18)', 'Get the most out of MarketSync', E'Keep your feed connected, post your freshest units first, and re-post slow movers to bump them back to the top.'),
  ('Trial · Trial ending (Day 29)', 'Your MarketSync trial ends tomorrow', E'Your free trial wraps up tomorrow. Pick a plan from your dashboard to keep everything running.'),
  ('Dunning · Payment failed', 'Your MarketSync payment didn''t go through', 'We had trouble charging your card for MarketSync. No action has been taken yet — just update your payment method.'),
  ('Dunning · Update your card', 'Reminder: update your card to keep MarketSync active', 'Your MarketSync subscription is past due. Update your payment details to avoid any interruption.'),
  ('Dunning · Final notice', 'Final notice — your MarketSync access will pause', 'This is the last reminder before your MarketSync access pauses. Update your card today.'),
  ('Win-back · Come back', 'We''d love to have you back at MarketSync', 'Your MarketSync account is paused. Reactivating takes one click whenever you''re ready.'),
  ('Win-back · What''s new', 'What''s new at MarketSync', 'A lot has shipped since you left. Come see what''s new.'),
  ('Onboarding · Getting started', 'Getting started with MarketSync', 'Welcome aboard! Here''s how to connect your inventory, install the extension, and post your first vehicles.'),
  ('Onboarding · Two-week tips', 'Two weeks in — get more from MarketSync', 'You''re rolling. Here are the features dealers get the most value from once they''re past setup.')
) as x(name, subject, body)
where not exists (select 1 from public.saas_email_templates t where t.name = x.name);

insert into public.saas_sequences (key, name, trigger, description, enabled) values
  ('trial_onboarding', 'Trial onboarding drip', 'trialing', 'The 30-day free-trial email series sent to trialing accounts. Toggle off to pause all trial onboarding emails.', true)
on conflict (key) do nothing;

insert into public.saas_sequence_steps (sequence_id, step_order, day_offset, type, subject, body)
select s.id, x.step_order, x.day_offset, 'email', x.subject, x.body
from (values
  (0, 0,  'Welcome to MarketSync — let''s sync your inventory', E'Thanks for starting your 30-day trial! First step: connect your inventory so we can pull in your vehicles.'),
  (1, 2,  'Your inventory is live', E'Your vehicles are now in MarketSync. View every listing and manage what''s ready to post.'),
  (2, 4,  'Post to Facebook Marketplace in a couple clicks', E'The MarketSync Chrome extension fills out the Facebook Marketplace listing for you.'),
  (3, 6,  'Pro tip: AS-IS notes & status badges', E'Flag vehicles AS-IS and set status badges so you always know what''s where.'),
  (4, 10, 'Never double-post a vehicle again', E'MarketSync tracks which vehicles you''ve posted, so you never list the same car twice.'),
  (5, 18, 'Get the most out of MarketSync', E'Keep your feed connected, post your freshest units first, and re-post slow movers.'),
  (6, 29, 'Your MarketSync trial ends tomorrow', E'Your free trial wraps up tomorrow. Pick a plan from your dashboard to keep everything running.')
) as x(step_order, day_offset, subject, body)
join public.saas_sequences s on s.key = 'trial_onboarding'
where not exists (select 1 from public.saas_sequence_steps st where st.sequence_id = s.id);
