-- Track whether a vehicle's stored window sticker is the authentic OEM
-- (manufacturer Monroney label, fetched by VIN) or one MarketSync generated.
-- Values: 'oem' | 'generated' | null (not yet built).
alter table public.inventory add column if not exists window_sticker_source text;
