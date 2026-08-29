CREATE VIEW public.subscription_product_coverage
WITH (security_invoker = true)
AS
SELECT *
FROM public.subscriptions;

REVOKE ALL ON public.subscription_product_coverage FROM anon;
REVOKE ALL ON public.subscription_product_coverage FROM authenticated;
REVOKE ALL ON public.subscription_product_coverage FROM service_role;
GRANT SELECT ON public.subscription_product_coverage TO authenticated;
GRANT SELECT ON public.subscription_product_coverage TO service_role;

COMMENT ON VIEW public.subscription_product_coverage IS
'Compatibility access surface matching subscriptions until canonical subscription coverage storage is introduced.';
