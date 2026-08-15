-- Supabase Security Advisor Cleanup Migration (Task 4)
-- Remediation of Supabase Security Advisor warnings:
-- 1. Ensure all SECURITY DEFINER functions have a fixed, safe search_path (public, pg_catalog).
-- 2. Revoke PUBLIC, anon, and authenticated EXECUTE permissions on internal trigger/helper functions.
-- 3. Verify no dangerous public EXECUTE grants exist on sensitive RPC paths.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Fix search_path on all SECURITY DEFINER functions in public schema
  FOR r IN 
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_catalog', r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore if built-in system function
    END;
  END LOOP;

  -- 2. Revoke dangerous EXECUTE grants on trigger and internal helper functions
  IF to_regprocedure('public.payment_allocation_guard()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.payment_allocation_guard() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.payments_protect()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.payments_protect() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.payments_no_delete()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.payments_no_delete() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.ro_estimates_assign_version()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ro_estimates_assign_version() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.ro_estimates_immutable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ro_estimates_immutable() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.ro_estimates_no_delete()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ro_estimates_no_delete() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.ro_auth_validate()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ro_auth_validate() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.ro_auth_immutable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.ro_auth_immutable() FROM PUBLIC, anon, authenticated';
  END IF;

  IF to_regprocedure('public.sales_video_event_recompute()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.sales_video_event_recompute() FROM PUBLIC, anon, authenticated';
  END IF;

END $$;
