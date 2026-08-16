-- Ownership history so a vehicle keeps EVERY owner and a customer keeps EVERY vehicle
-- (current + former). `customer_vehicles` stays the VIN-canonical vehicle (one row per
-- VIN per dealership); this table records who owned it and when.
--
-- Backend/service-role only, mirroring customer_vehicles (RLS enabled, deny-all: no
-- policies). The equity-mining `customer_ownership_tracking` table is intentionally left
-- untouched — this is the service/CRM ownership spine keyed to the canonical vehicle.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.customer_vehicle_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealership_id UUID NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  customer_vehicle_id UUID NOT NULL REFERENCES public.customer_vehicles(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  owned_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  owned_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exactly one CURRENT owner per vehicle.
CREATE UNIQUE INDEX IF NOT EXISTS customer_vehicle_owners_current_uk
  ON public.customer_vehicle_owners (customer_vehicle_id) WHERE is_current;
-- At most one OPEN period per (vehicle, contact) pair.
CREATE UNIQUE INDEX IF NOT EXISTS customer_vehicle_owners_open_pair_uk
  ON public.customer_vehicle_owners (customer_vehicle_id, contact_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS customer_vehicle_owners_vehicle_idx ON public.customer_vehicle_owners (customer_vehicle_id);
CREATE INDEX IF NOT EXISTS customer_vehicle_owners_contact_idx ON public.customer_vehicle_owners (contact_id);
CREATE INDEX IF NOT EXISTS customer_vehicle_owners_dealer_idx ON public.customer_vehicle_owners (dealership_id);

ALTER TABLE public.customer_vehicle_owners ENABLE ROW LEVEL SECURITY;

-- Backfill a current-owner period for any existing owned vehicle.
INSERT INTO public.customer_vehicle_owners (dealership_id, customer_vehicle_id, contact_id, is_current, owned_from)
SELECT cv.dealership_id, cv.id, cv.contact_id, TRUE, COALESCE(cv.created_at, now())
FROM public.customer_vehicles cv
WHERE cv.contact_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Integrity: clear any dangling RO->customer_vehicle link, then add the missing FKs.
UPDATE public.repair_orders ro
SET customer_vehicle_id = NULL
WHERE customer_vehicle_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.customer_vehicles cv WHERE cv.id = ro.customer_vehicle_id);

ALTER TABLE public.repair_orders
  DROP CONSTRAINT IF EXISTS repair_orders_customer_vehicle_id_fkey,
  ADD CONSTRAINT repair_orders_customer_vehicle_id_fkey
  FOREIGN KEY (customer_vehicle_id) REFERENCES public.customer_vehicles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_vehicles
  DROP CONSTRAINT IF EXISTS customer_vehicles_contact_id_fkey,
  ADD CONSTRAINT customer_vehicles_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.customer_vehicles
  DROP CONSTRAINT IF EXISTS customer_vehicles_origin_inventory_id_fkey,
  ADD CONSTRAINT customer_vehicles_origin_inventory_id_fkey
  FOREIGN KEY (origin_inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL;
