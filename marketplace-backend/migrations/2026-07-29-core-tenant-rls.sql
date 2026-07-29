-- Core tenant isolation. The Express backend uses service_role and therefore
-- bypasses these policies; browser/Data API requests are constrained here.

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

REVOKE ALL ON FUNCTION private.current_dealership_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.owns_inventory(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_dealership_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.owns_inventory(uuid) TO authenticated;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Tenant members can view profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR dealership_id = (SELECT private.current_dealership_id()));
CREATE POLICY "Users can update their own profile safely" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()) AND dealership_id = (SELECT private.current_dealership_id()));

DROP POLICY IF EXISTS "Core tenant access" ON public.contacts;
DROP POLICY IF EXISTS "Core tenant access" ON public.leads;
DROP POLICY IF EXISTS "Core tenant access" ON public.inventory;
DROP POLICY IF EXISTS "Core tenant access" ON public.deals;
DROP POLICY IF EXISTS "Core tenant access" ON public.crm_tasks;
CREATE POLICY "Core tenant access" ON public.contacts FOR ALL TO authenticated
  USING (dealership_id = (SELECT private.current_dealership_id()))
  WITH CHECK (dealership_id = (SELECT private.current_dealership_id()));
CREATE POLICY "Core tenant access" ON public.leads FOR ALL TO authenticated
  USING (dealership_id = (SELECT private.current_dealership_id()))
  WITH CHECK (dealership_id = (SELECT private.current_dealership_id()));
DROP POLICY IF EXISTS "Admins can insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow members of the same dealership to view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Users see own dealership inventory" ON public.inventory;
CREATE POLICY "Core tenant access" ON public.inventory FOR ALL TO authenticated
  USING (dealership_id = (SELECT private.current_dealership_id()))
  WITH CHECK (dealership_id = (SELECT private.current_dealership_id()));
CREATE POLICY "Core tenant access" ON public.deals FOR ALL TO authenticated
  USING (dealership_id = (SELECT private.current_dealership_id()))
  WITH CHECK (dealership_id = (SELECT private.current_dealership_id()));
CREATE POLICY "Core tenant access" ON public.crm_tasks FOR ALL TO authenticated
  USING (dealership_id = (SELECT private.current_dealership_id()))
  WITH CHECK (dealership_id = (SELECT private.current_dealership_id()));

DROP POLICY IF EXISTS "Users can insert listings" ON public.listings;
DROP POLICY IF EXISTS "Users see own dealership listings" ON public.listings;
DROP POLICY IF EXISTS "Tenant listing access" ON public.listings;
CREATE POLICY "Tenant listing access" ON public.listings FOR SELECT TO authenticated
  USING ((SELECT private.owns_inventory(inventory_id)));
CREATE POLICY "Tenant listing insert" ON public.listings FOR INSERT TO authenticated
  WITH CHECK (posted_by = (SELECT auth.uid()) AND (SELECT private.owns_inventory(inventory_id)));
CREATE POLICY "Tenant listing update" ON public.listings FOR UPDATE TO authenticated
  USING ((SELECT private.owns_inventory(inventory_id)))
  WITH CHECK ((SELECT private.owns_inventory(inventory_id)));
CREATE POLICY "Tenant listing delete" ON public.listings FOR DELETE TO authenticated
  USING ((SELECT private.owns_inventory(inventory_id)));
