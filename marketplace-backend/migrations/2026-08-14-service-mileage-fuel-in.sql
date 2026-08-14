-- Migration: Add mileage_in and fuel_in to repair_orders table
alter table public.repair_orders add column if not exists mileage_in integer;
alter table public.repair_orders add column if not exists fuel_in text;
