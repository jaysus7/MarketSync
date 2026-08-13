-- setConfig() upserts with ON CONFLICT (dealership_id, key), but the only unique index
-- on dealer_config was on COALESCE(dealership_id, zero-uuid), key — an expression index
-- that ON CONFLICT (dealership_id, key) cannot match, so every config save failed with
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".
-- Add a plain unique index on (dealership_id, key) so the upsert resolves.
create unique index if not exists dealer_config_dealership_key_uniq
  on public.dealer_config (dealership_id, key);
