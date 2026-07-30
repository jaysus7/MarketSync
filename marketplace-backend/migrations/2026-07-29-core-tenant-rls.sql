-- Core tenant isolation. Browser clients use the authenticated Express API,
-- not the Supabase Data API. The server applies RBAC and dealership checks.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_dealership_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT dealership_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION private.owns_inventory(target_inventory_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.inventory
    WHERE id = target_inventory_id
      AND dealership_id = private.current_dealership_id()
  )
$$;

REVOKE ALL ON FUNCTION private.current_dealership_id() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION private.owns_inventory(uuid) FROM PUBLIC, authenticated;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile safely" ON public.profiles;

DROP POLICY IF EXISTS "Core tenant access" ON public.contacts;
DROP POLICY IF EXISTS "Core tenant access" ON public.leads;
DROP POLICY IF EXISTS "Core tenant access" ON public.inventory;
DROP POLICY IF EXISTS "Core tenant access" ON public.deals;
DROP POLICY IF EXISTS "Core tenant access" ON public.crm_tasks;
DROP POLICY IF EXISTS "Admins can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow members of the same dealership to view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users see own dealership inventory" ON public.inventory;

DROP POLICY IF EXISTS "Users can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Users see own dealership listings" ON public.listings;
DROP POLICY IF EXISTS "Tenant listing access" ON public.listings;
DROP POLICY IF EXISTS "Tenant listing insert" ON public.listings;
DROP POLICY IF EXISTS "Tenant listing update" ON public.listings;
DROP POLICY IF EXISTS "Tenant listing delete" ON public.listings;
