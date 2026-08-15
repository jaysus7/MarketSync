-- Supabase RLS Audit Classification Migration (Task 3)
-- Hardening and enforcing strict Row-Level Security on all core backend-service tables.
--
-- CLASSIFICATION AUDIT REPORT:
-- All 9 audited tables (payments, payment_allocations, ro_estimates, ro_authorizations,
-- campaigns, marketing_assets, sales_videos, social_accounts, social_posts) are
-- BACKEND / SERVICE-ROLE ONLY.
--
-- Browser clients interact with MarketSync solely via the Express API server (which enforces
-- session authentication, RBAC permissions via requirePermission middleware, and tenant scoping).
-- Direct PostgREST / Supabase Data API access from anon or authenticated client JWTs is denied by default.

-- 1. Payments & Allocations
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations FORCE ROW LEVEL SECURITY;

-- 2. RO Financial Estimates & Authorizations
ALTER TABLE public.ro_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ro_estimates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ro_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ro_authorizations FORCE ROW LEVEL SECURITY;

-- 3. Marketing Campaigns & Assets
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_assets FORCE ROW LEVEL SECURITY;

-- 4. Sales Video Messaging
ALTER TABLE public.sales_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_videos FORCE ROW LEVEL SECURITY;

-- 5. Social Media Accounts & Posts (Contains encrypted OAuth credentials)
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts FORCE ROW LEVEL SECURITY;
