-- Add an external link target to notifications so a notification can point
-- directly at a generated artifact (e.g. a window sticker / brochure PDF) or a
-- report URL. When set, the in-app notification opens this URL in a new tab.
alter table public.notifications add column if not exists link_url text;
