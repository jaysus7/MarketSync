-- Fold the standalone Social Scheduler product into Design Studio: one flat-priced
-- product ($19.99/mo, was $29/mo) that now also grants the scheduler/accounts/
-- calendar features, instead of selling scheduling as a separate $99/mo plan.
-- No real paying customers on either plan yet, so this is a straight catalog
-- rewrite rather than a subscriber migration.

UPDATE public.plans
SET monthly_price_cents = 1999
WHERE id = 'design-studio';

-- Grant design-studio the same scheduler/accounts/calendar features social-scheduler
-- granted (still excluding social.studio, which stays exclusive to a marketsync_social
-- purchase — design-studio already has its own design.canvas).
INSERT INTO public.plan_features (plan_id, feature_id)
SELECT 'design-studio', id FROM public.features
WHERE product_id = 'marketsync_social' AND id <> 'social.studio'
ON CONFLICT (plan_id, feature_id) DO NOTHING;

-- Retire social-scheduler as a sellable plan rather than deleting it outright —
-- reversible, and avoids any FK surprises if a historical row still references it.
UPDATE public.plans
SET is_public = false
WHERE id = 'social-scheduler';
