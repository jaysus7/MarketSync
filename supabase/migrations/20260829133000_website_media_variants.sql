-- Persist responsive image renditions without changing the canonical media URL.
ALTER TABLE public.dealer_website_media
  ADD COLUMN IF NOT EXISTS optimized_variants JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.dealer_website_media.optimized_variants IS
  'Responsive WebP/AVIF public URLs keyed by width and format.';
