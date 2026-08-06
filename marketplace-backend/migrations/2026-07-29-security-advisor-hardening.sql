-- Supabase security-advisor remediation. Keep function lookup deterministic and
-- prevent browser/Data API roles from invoking internal SECURITY DEFINER helpers.
DO $$
BEGIN
  IF to_regprocedure('public.bump_usage(uuid,text,integer,integer)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.bump_usage(uuid,text,integer,integer) SET search_path = public, pg_catalog';
  END IF;

  IF to_regprocedure('public.update_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_catalog';
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;
