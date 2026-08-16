-- "Book a demo" lead capture from the public marketing site (demo.html). Platform-
-- level, not tied to any dealership_id — mirrors support_requests exactly: insert
-- happens via supabaseAdmin from the public POST route, reads are platform-staff-only.

CREATE TABLE IF NOT EXISTS public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  dealership_name text,
  plan text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demo_requests_platform_only" ON public.demo_requests;
CREATE POLICY "demo_requests_platform_only" ON public.demo_requests
  FOR ALL TO authenticated
  USING (authz.is_platform_staff())
  WITH CHECK (authz.is_platform_staff());
