-- Grant execute privileges on RLS permission helper functions to authenticated, service_role, and anon
DO $$
BEGIN
  -- Grant schema usage if authz schema exists
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'authz') THEN
    GRANT USAGE ON SCHEMA authz TO authenticated, service_role, anon;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO authenticated, service_role, anon;
  END IF;

  -- Grant execute on public functions
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role, anon;
END $$;
