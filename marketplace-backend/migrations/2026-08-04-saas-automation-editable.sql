-- MarketSync HQ — editable automation (drips) + email template library.
-- Moves the sequence catalog out of code and into the DB so HQ can view/edit every
-- step (timing, copy, email-or-task), toggle sequences, and reuse email templates.
-- Seeded from the code catalog. Service-role only (RLS on, no policies).

create table if not exists public.saas_email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body       text not null,               -- HTML; supports {{first_name}} {{account}} merge fields
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saas_email_templates enable row level security;

create table if not exists public.saas_sequences (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,        -- dunning | winback | onboarding_touch | ...
  name        text not null,
  trigger     text,                        -- past_due | cancelled | trialing | manual
  description text,
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.saas_sequences enable row level security;

create table if not exists public.saas_sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.saas_sequences(id) on delete cascade,
  step_order  int not null default 0,
  day_offset  int not null default 0,
  type        text not null default 'email',   -- email | task
  template_id uuid references public.saas_email_templates(id) on delete set null,
  subject     text,   -- email (inline, when no template)
  body        text,
  title       text,   -- task
  note        text,
  priority    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists saas_seq_steps_seq on public.saas_sequence_steps (sequence_id, step_order);
alter table public.saas_sequence_steps enable row level security;

-- ── Seed the current catalog (idempotent) ──
insert into public.saas_sequences (key, name, trigger, description) values
  ('dunning',          'Payment recovery',      'past_due',  'Recover a failed payment before the account churns.'),
  ('winback',          'Win-back',              'cancelled', 'Re-engage a cancelled account.'),
  ('onboarding_touch', 'White-glove onboarding','manual',    'A hands-on onboarding cadence you enroll new accounts into.')
on conflict (key) do nothing;

insert into public.saas_sequence_steps (sequence_id, step_order, day_offset, type, subject, body, title, note, priority)
select s.id, x.step_order, x.day_offset, x.type, x.subject, x.body, x.title, x.note, x.priority
from (values
  ('dunning', 0, 0, 'email', 'Your MarketSync payment didn''t go through', 'We had trouble charging your card for MarketSync. No action has been taken on your account yet — just update your payment method and you''re all set.', null, null, null),
  ('dunning', 1, 2, 'email', 'Reminder: update your card to keep MarketSync active', 'Your MarketSync subscription is past due. Update your payment details to avoid any interruption to posting, your dealer site, or the AI chat.', null, null, null),
  ('dunning', 2, 5, 'task',  null, null, 'Call about failed payment', 'Dunning day 5 — personal outreach before access pauses.', 'high'),
  ('dunning', 3, 8, 'email', 'Final notice — your MarketSync access will pause', 'This is the last reminder before your MarketSync access pauses. Update your card today to keep everything running.', null, null, null),
  ('winback', 0, 1,  'email', 'We''d love to have you back at MarketSync', 'Your MarketSync account is paused. If there''s anything we could have done better, just reply — we read every message. Reactivating takes one click whenever you''re ready.', null, null, null),
  ('winback', 1, 14, 'email', 'What''s new at MarketSync', 'A lot has shipped since you left — faster Facebook posting, a smarter AI chat, and deeper inventory intelligence. Come see what''s new.', null, null, null),
  ('winback', 2, 30, 'task',  null, null, 'Win-back call', '30 days since cancellation — personal check-in.', 'normal'),
  ('onboarding_touch', 0, 0,  'task',  null, null, 'Onboarding kickoff call', 'Schedule the kickoff and confirm the inventory feed is connected.', 'high'),
  ('onboarding_touch', 1, 2,  'email', 'Getting started with MarketSync', 'Welcome aboard! Here''s how to connect your inventory, install the extension, and post your first vehicles to Facebook Marketplace.', null, null, null),
  ('onboarding_touch', 2, 7,  'task',  null, null, 'Week-1 adoption check', 'Confirm they''ve posted, and offer help with anything stuck.', 'normal'),
  ('onboarding_touch', 3, 14, 'email', 'Two weeks in — get more from MarketSync', 'You''re rolling. Here are the features dealers get the most value from once they''re past setup.', null, null, null)
) as x(key, step_order, day_offset, type, subject, body, title, note, priority)
join public.saas_sequences s on s.key = x.key
where not exists (select 1 from public.saas_sequence_steps st where st.sequence_id = s.id);
