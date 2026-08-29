-- Website Builder media organization. Existing rows remain in the default
-- Library folder; folders are metadata only and never affect public URLs.
ALTER TABLE public.dealer_website_media
  ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'Library';

ALTER TABLE public.dealer_website_media
  DROP CONSTRAINT IF EXISTS dealer_website_media_folder_length;
ALTER TABLE public.dealer_website_media
  ADD CONSTRAINT dealer_website_media_folder_length CHECK (char_length(folder) BETWEEN 1 AND 80);

CREATE INDEX IF NOT EXISTS idx_dealer_website_media_folder
  ON public.dealer_website_media(dealership_id, folder, created_at DESC);
