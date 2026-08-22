# MarketSync Production Release Gate — August 20, 2026

## 1. Release Gate Purpose
This document specifies the authoritative gate checks and sign-off criteria before staging is promoted to `main` for the production release.

## 2. Hard Governance Rules (Part A of AGENTS.md)
1. **Branch Discipline (A17)**:
   - Staging remains the verification environment.
   - Promotion to `main` is a deliberate, approved action. Never auto-merge into `main`.
2. **Runtime Proof (A19)**:
   - Every producer writes to canonical database models; consumers assert observable state.
3. **External Evidence (A20)**:
   - External provider states (`published`, `captured`, `verified`, `sent`) must require authoritative proof.
4. **Product Boundaries (A21)**:
   - Standalone products enforce explicit plan entitlements and role permissions.

## 3. Pre-Promotion Verification Checklist

| Area | Check | Status | Evidence / Verification |
|---|---|---|---|
| **Catalog & Pricing** | All plans match authoritative DB catalog prices | Verified | `test/plan-catalog.test.js`, `public-config.js`, `pricing.html` |
| **Multi-Subscription Coverage** | Overlapping subscriptions union products cleanly | Verified | `subscription_product_coverage` table, `test/access-policy.test.js` |
| **Entitlement + RBAC Composition** | Owner without website gets 403; Rep without permission gets 403 | Verified | `test/website-auth-specificity.test.js` |
| **Private Video Storage** | Raw video in private bucket; access via time-limited signed tokens | Verified | `test/secure-sales-video-storage.test.js` |
| **SEO Integrity** | Zero fake metrics; honest disconnected states for Search Console | Verified | `test/marketsync-seo-full.test.js`, `routes/seo.js` |
| **Static & Transport Security** | Full CSP, HSTS, frame-ancestors, rate limiting in place | Verified | `_headers`, `render.yaml`, `security.js` |
| **Backend Test Suite** | 100% green tests in `marketplace-backend` | Verified | `npm test` |
| **Code Quality Checks** | All six check scripts pass | Verified | `check:syntax`, `check:imports`, `check:exports`, `check:routes`, `check:frontend`, `check:startup` |

## 4. Release Sign-Off Protocol
1. Verify all migrations in `PRODUCTION_DB_PROMOTION_2026-08-20.md` have been reviewed.
2. Confirm staging HEAD is fully tested and green.
3. Obtain explicit operator approval prior to creating promotion PR from `staging` to `main`.
