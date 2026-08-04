-- The backend performs RBAC checks with the Supabase service-role key.  RLS still
-- governs browser clients; this grant merely restores the server-only client’s
-- ability to read membership/permission rows and manage role assignments.
-- Do not grant these privileges to anon or authenticated.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO service_role;
GRANT SELECT ON TABLE public.role_permissions TO service_role;
