-- Phase 6 PR 6.8 — Reputation: asking for reviews, honestly.
--
-- THE DECISION THIS SCHEMA ENCODES: no review gating.
--
-- The standard dealer "reputation management" feature asks the customer how they feel first,
-- then sends happy customers to Google and routes unhappy ones to a private form. That is
-- review gating. The FTC has taken action over it, and it violates Google's own policies —
-- but the reason not to build it is simpler than either: it manufactures a rating that is not
-- true, and every dealer who buys the product is buying a liability they were not told about.
--
-- So the shape here is deliberate and structural, not a policy note somebody can ignore:
--
--   • A review request is created from an EVENT (a delivery, a closed repair order), never
--     from a prediction about how the customer feels. There is no sentiment field on the
--     request, because there is no point in the flow where sentiment could be consulted.
--   • Every request carries BOTH the public review link and the private-feedback route. The
--     private option is offered to everyone, always — it is an addition, never a diversion.
--   • Suppression exists only for reasons that have nothing to do with the expected rating:
--     consent, a recent previous ask, or an explicit staff exclusion with a written reason.
--
-- A dealership that wants to raise its rating has exactly one supported method: do better work.
--
-- APPLIED TO STAGING ONLY.

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  -- What happened that earned the right to ask. A request with no source event is not
  -- allowed, which is what stops a bulk "ask everyone who might say something nice" sweep.
  source text not null,
  source_id uuid,

  channel text,
  status text not null default 'pending',
  consent_basis text,

  -- The two destinations, side by side. Both are always populated for a sent request.
  public_url text,
  private_feedback_token text,

  -- Set only when a human deliberately excluded this customer, WITH a reason. Nullable, and
  -- the reason is not optional when it is used — an exclusion nobody has to justify is a
  -- gate wearing a different hat.
  suppressed_reason text,

  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.review_requests add constraint review_requests_source_valid
    check (source in ('vehicle_delivered', 'service_closed', 'manual'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.review_requests add constraint review_requests_status_valid
    check (status in ('pending', 'sent', 'responded', 'suppressed', 'failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.review_requests add constraint review_requests_channel_valid
    check (channel is null or channel in ('sms', 'email'));
exception when duplicate_object then null; end $$;

-- A suppression must say why. This is the constraint that keeps "suppressed" from quietly
-- becoming the place unhappy customers go.
do $$ begin
  alter table public.review_requests add constraint review_requests_suppression_needs_reason
    check (status <> 'suppressed' or (suppressed_reason is not null and length(btrim(suppressed_reason)) > 0));
exception when duplicate_object then null; end $$;

-- One ask per customer per event. Nagging a customer into a review is its own kind of
-- dishonesty, and the database is a better guarantee of that than a code path.
create unique index if not exists review_requests_once_per_event
  on public.review_requests (dealership_id, contact_id, source, source_id)
  where source_id is not null;

create index if not exists review_requests_dealership_idx
  on public.review_requests (dealership_id, created_at desc);
create unique index if not exists review_requests_private_token_uk
  on public.review_requests (private_feedback_token) where private_feedback_token is not null;

alter table public.review_requests enable row level security;

-- ── Reviews as they actually are ────────────────────────────────────────────
-- A review is somebody else's statement. The dealership may respond to it; it may not edit
-- it, and this table gives it nowhere to try.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  source text not null,
  external_id text,
  author_name text,
  rating numeric(2,1),
  body text,
  posted_at timestamptz,
  url text,

  -- The dealership's reply, which is the only part of this row it owns.
  response_body text,
  responded_at timestamptz,
  responded_by uuid references public.profiles(id) on delete set null,

  contact_id uuid references public.contacts(id) on delete set null,
  review_request_id uuid references public.review_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.reviews add constraint reviews_source_valid
    check (source in ('google', 'facebook', 'cars_com', 'dealerrater', 'private'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.reviews add constraint reviews_rating_range
    check (rating is null or (rating >= 1 and rating <= 5));
exception when duplicate_object then null; end $$;

-- The same external review must not be imported twice.
create unique index if not exists reviews_external_uk
  on public.reviews (dealership_id, source, external_id) where external_id is not null;

create index if not exists reviews_dealership_idx
  on public.reviews (dealership_id, posted_at desc);
-- Finding the ones nobody has answered is the whole job.
create index if not exists reviews_unanswered_idx
  on public.reviews (dealership_id, posted_at desc) where responded_at is null;

alter table public.reviews enable row level security;

-- Where the dealership's public review link lives, on the existing *_settings convention.
-- Asking a customer for a public review with nowhere to leave one wastes the single ask that
-- customer will tolerate, so the route refuses to send until this is set.
alter table public.dealerships add column if not exists reputation_settings jsonb not null default '{}'::jsonb;
