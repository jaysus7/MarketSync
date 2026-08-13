-- Version the unified event contract. Consumers can now evolve payloads without
-- guessing which shape an older event uses. Existing history remains v1.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_event_version_positive;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_version_positive CHECK (event_version >= 1);

CREATE INDEX IF NOT EXISTS events_name_version_idx
  ON public.events (dealership_id, event_name, event_version, created_at DESC);
