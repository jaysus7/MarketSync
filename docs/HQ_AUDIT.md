# MarketSync HQ audit (2026-08-26)

## What already existed
- Workspace flag: `profileContext.workspace === 'saas_admin'` + `data-dash-owner=1`
- Nav: `SAAS_DEPARTMENTS` (Pulse, Accounts, Leads, Work, People, Communications, Money)
- Pages: saas-command, saas-customers, saas-followups, saas-funnel, saas-automation, saas-employees, saas-accounting, owner-users
- Customer 360 drawer: `openSaasCustomer` → `GET /saas/customers/:id`
- Backend: `routes/saas-admin.js` (overview, customers, followups, employees, accounting, assistant)
- Backend: `routes/owner-admin.js` (accounts list, product toggle, engine flags, billing/trial patch)
- Access: `SYSTEM_ROLES.PLATFORM_OWNER` + `saasCan` / `saas_role`

## Gaps vs HQ spec
- Product catalog in owner-admin was only facebook_solo, facebook_dealer, ai_chatbot, dealer_os
- No entitlement matrix / reasoned override in 360
- No trials / catalog / entitlements pages
- No HQ global search
- No staging vs production banner
- No hq_audit_events table (toggle now attempts insert; ignored if missing)
- Feature flags, support impersonation, Stripe admin actions, module-level DealerOS matrix still incomplete

## Batch 1–3 started in this pass
- HQ IA nav
- Catalog + entitlement toggles through `/owner/dealership/:id/products`
- Customer 360 product matrix
- Trials + catalog + entitlements pages
- Cmd/Ctrl-K search against `/saas/customers`
- Staging/production banner


## Batch 4–7 (this pass)
- Trial extend: POST /owner/dealership/:id/trial (reason required)
- Audit log page: GET /owner/audit (audit_log)
- Security page: GET /owner/security (security_events)
- Feature flags: GET/POST /owner/flags/:id (dealerships.feature_flags)
- Support inspect session: POST /owner/support-session (audited, no JWT swap)
- Customer 360: Extend trial + Start support inspect


## Batch 8
- GET /owner/usage — 30-day events aggregation
- GET /owner/health — Supabase + Stripe config + email health
- GET/POST /owner/modules/:id — DealerOS module overrides
- POST /owner/user/:id/status — activate/deactivate with reason
- HQ pages: Usage, System health
- Customer 360 DealerOS module toggles


## Batch 9
- GET /owner/onboarding — 5-step checklist from real account data
- GET /owner/integrations — dealer_integrations
- All Users cards: Deactivate user, open 360


## Batch 10 — remaining closable work
- GET /owner/users + POST /owner/user/:id/role
- HQ All Users + HQ Roles pages
- Tests: marketplace-backend/test/hq-owner-admin.test.js

## Still external / not faked
- Stripe change-plan / invoice mutation (no existing write API reused; customer 360 already lists Stripe invoices when a customer id exists)
- JWT impersonation (support inspect only)
- Percentage feature-flag rollout (no backend)
- n8n / webhook live probes beyond email + supabase health


## Full billing
- GET /owner/billing and /owner/billing/:id (DB + Stripe customer/subs/invoices)
- POST portal, cancel at period end, reactivate, plan change (proration), Stripe trial
- All mutations reason + audit + syncSubscriptionFromStripe
- 503 if Stripe is not configured rather than fake success


## Close-out
Customer 360 opens full Stripe billing. Global search covers dealerships and users. Production hostname requires an extra confirm on billing mutations. Coupons apply on the Stripe customer when a valid coupon id exists.

HQ is operationally complete against existing backend primitives. Remaining external-only items: JWT impersonation, percentage flag rollout, n8n live probes.
