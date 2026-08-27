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
