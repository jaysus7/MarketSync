-- Phase 6 PR 6.7 — Sales video messaging.
--
-- Owned by SALES, not Marketing. A rep recording a walkaround for one customer about one
-- vehicle is a sales conversation, gated by `customer.edit` and the same consent gate every
-- other sender calls. It reuses Phase 6 plumbing; it does not become a marketing campaign.
--
-- The rule this schema exists to enforce:
--
--   Fetching a link is not watching a video.
--
-- Outlook Safe Links, Gmail's proxy, SMS previewers and security scanners all fetch a URL the
-- moment it is delivered. Recording those as views would tell a rep "your customer watched it
-- twice" about a customer who never opened it — and reps act on that, calling people who did
-- nothing. It would be a lie the product told every single day.
--
-- So a page load is a `link_opened` and nothing more. Only `play_started` — which requires
-- JavaScript and a real user gesture, neither of which a prefetcher performs — begins a watch.
--
-- APPLIED TO STAGING ONLY.

create table if not exists public.sales_videos (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  inventory_id uuid references public.inventory(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,

  title text,
  storage_path text not null,
  public_url text not null,
  poster_url text,
  duration_seconds int,
  bytes bigint,

  -- The public link. Unguessable, and the only thing a customer ever receives — the video's
  -- id is never exposed, so a leaked link cannot be walked to another customer's video.
  share_token text not null,
  -- A share link that lives forever is a data-exposure liability nobody remembers to close.
  expires_at timestamptz,

  status text not null default 'draft',
  channel text,                       -- how it was sent: sms | email
  sent_at timestamptz,
  -- The consent decision AT SEND TIME, kept as evidence. Consent can change afterwards; what
  -- matters when someone asks "why did you text this person" is what was true when we did.
  consent_basis text,

  -- Derived from events, never written directly by a UI.
  first_opened_at timestamptz,
  first_played_at timestamptz,
  watched_seconds int not null default 0,
  watch_percent int,
  play_count int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

do $$ begin
  alter table public.sales_videos add constraint sales_videos_status_valid
    check (status in ('draft', 'ready', 'sent', 'watched', 'expired', 'failed'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.sales_videos add constraint sales_videos_channel_valid
    check (channel is null or channel in ('sms', 'email'));
exception when duplicate_object then null; end $$;

create unique index if not exists sales_videos_share_token_uk on public.sales_videos (share_token);
create index if not exists sales_videos_dealership_idx
  on public.sales_videos (dealership_id, created_at desc) where deleted_at is null;
create index if not exists sales_videos_contact_idx
  on public.sales_videos (contact_id) where contact_id is not null and deleted_at is null;
create index if not exists sales_videos_rep_idx
  on public.sales_videos (created_by, created_at desc) where deleted_at is null;

alter table public.sales_videos enable row level security;

-- ── What actually happened, kept apart from what we wish happened ───────────
create table if not exists public.sales_video_events (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references public.dealerships(id) on delete cascade,
  video_id uuid not null references public.sales_videos(id) on delete cascade,
  kind text not null,
  -- Where the viewer got to, in seconds. Only meaningful for playback events.
  position_seconds int,
  user_agent text,
  created_at timestamptz not null default now()
);

-- 'link_opened' is deliberately its own thing and deliberately NOT a view. Everything from
-- 'play_started' onward requires JavaScript and a user gesture.
do $$ begin
  alter table public.sales_video_events add constraint sales_video_events_kind_valid
    check (kind in ('link_opened', 'play_started', 'progress', 'completed', 'replied'));
exception when duplicate_object then null; end $$;

create index if not exists sales_video_events_video_idx
  on public.sales_video_events (video_id, created_at);

alter table public.sales_video_events enable row level security;

-- ── The derived watch state, owned by the database ──────────────────────────
-- Recomputed from events on every event, so the summary on a rep's screen and the evidence
-- behind it can never disagree. A UI that maintained these counters itself would drift, and
-- the drift would always favour looking busy.
create or replace function public.sales_video_recompute(p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dur int;
  v_opened timestamptz;
  v_played timestamptz;
  v_watched int;
  v_plays int;
begin
  select duration_seconds into v_dur from public.sales_videos where id = p_video_id;

  select min(created_at) filter (where kind = 'link_opened'),
         min(created_at) filter (where kind = 'play_started'),
         count(*) filter (where kind = 'play_started'),
         -- The furthest point reached, not the sum of progress pings: a customer who scrubs
         -- back and rewatches has not watched twice as much video.
         coalesce(max(position_seconds) filter (where kind in ('progress', 'completed')), 0)
    into v_opened, v_played, v_plays, v_watched
    from public.sales_video_events
   where video_id = p_video_id;

  update public.sales_videos
     set first_opened_at = v_opened,
         first_played_at = v_played,
         play_count = coalesce(v_plays, 0),
         watched_seconds = coalesce(v_watched, 0),
         watch_percent = case when v_dur is null or v_dur <= 0 then null
                              else least(100, round(coalesce(v_watched, 0)::numeric * 100 / v_dur))::int end,
         -- Only a real play moves a video to 'watched'. A link that was merely fetched stays
         -- 'sent', which is the honest thing to show the rep who is deciding whether to call.
         status = case when v_played is not null then 'watched' else status end,
         updated_at = now()
   where id = p_video_id;
end;
$$;

revoke all on function public.sales_video_recompute(uuid) from public, anon, authenticated;

create or replace function public.sales_video_event_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sales_video_recompute(new.video_id);
  return new;
end;
$$;

drop trigger if exists sales_video_events_recompute on public.sales_video_events;
create trigger sales_video_events_recompute
  after insert on public.sales_video_events
  for each row execute function public.sales_video_event_recompute();
