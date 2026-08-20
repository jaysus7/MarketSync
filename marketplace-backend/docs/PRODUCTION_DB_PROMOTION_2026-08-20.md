# Production Database Promotion Runbook — August 20, 2026

## 1. Overview & Strict Safety Directives
- **DO NOT RUN THESE MIGRATIONS AGAINST PRODUCTION DIRECTLY.**
- This document outlines the schema diffs, execution order, pre-flight checks, rollback procedures, and validation queries for the operator during scheduled production promotion.
- All migrations have been tested on staging.

---

## 2. Migration Execution Order

The following migrations must be executed sequentially on the production Supabase database:

1. **`2026-08-20-security-hardening-xss-mfa-ai-ssrf.sql`**
   - **Purpose**: Schema updates for MFA recovery codes, CSRF/SSRF url whitelisting, and session security.
   - **Pre-flight**: Ensure `dealerships` and `profiles` tables exist.
   - **Rollback**: Drop added columns/indexes with `ALTER TABLE profiles DROP COLUMN IF EXISTS mfa_recovery_codes_hash;`.

2. **`2026-08-20-multi-subscription-product-coverage.sql`**
   - **Purpose**: Creates `public.subscription_product_coverage` table with RLS, indexes, unique constraint `(subscription_id, product_id)`, and backfills from existing `subscriptions`.
   - **Pre-flight**: Verify `products` and `dealerships` foreign key constraints exist.
   - **Rollback**:
     ```sql
     DROP POLICY IF EXISTS "sub_prod_coverage_select_dealership" ON public.subscription_product_coverage;
     DROP POLICY IF EXISTS "sub_prod_coverage_service_all" ON public.subscription_product_coverage;
     DROP TABLE IF EXISTS public.subscription_product_coverage;
     ```

---

## 3. Schema Diffs & Verification Queries

### Pre-Promotion Validation
```sql
-- 1. Check current active plans in production
SELECT id, name, monthly_price_cents, is_public FROM public.plans ORDER BY monthly_price_cents;

-- 2. Verify subscription count prior to backfill
SELECT count(*) FROM public.subscriptions;
```

### Post-Migration Verification
```sql
-- 1. Confirm subscription_product_coverage table exists and is populated
SELECT count(*) FROM public.subscription_product_coverage;

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'subscription_product_coverage';

-- 3. Verify unique constraint is active
SELECT conname, contype FROM pg_constraint WHERE conname = 'uq_sub_prod_coverage';
```

---

## 4. Rollback Plan
If any step fails during promotion:
1. Revert `subscription_product_coverage` table and RLS policies using rollback script above.
2. The legacy `subscriptions` table remains intact and functional as the backward-compatible fallback.
3. Notify the incident commander before attempting re-run.
