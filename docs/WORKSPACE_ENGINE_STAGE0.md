# Workspace Engine — Stage 0 (design)

One login system, multiple operating modes. MarketSync runs **its own business on the
same kernel it sells** — dealers, MarketSync staff, and affiliate partners are all
`users` in `organizations` with `roles`, `permissions`, `products`, and
`subscriptions`. The login doesn't pick an app; it **resolves a workspace**.

```
User → Role → Permissions → Workspace → Subscription/Relationship
```

## 1. Workspaces (the top-level front door)

| Workspace | Who | Surface |
|---|---|---|
| `saas_admin` | MarketSync owner + employees | The MarketSync back office (homebase): Command Center (MRR/trials/churn), Customers, Trials, Affiliates, Marketing, Product Management, Settings |
| `dealer` | Dealership users | DealerOS **or** a purchased product (Facebook Solo / Dealer / AI Chatbot) — resolved from `dealerships.products` |
| `affiliate` | Partner network | Affiliate portal: performance, referrals, marketing tools, commission history/payouts |

Resolution (live) — `/auth/me` returns `workspace`:
- `saas_admin` if the user has a server-managed MarketSync platform role or is a MarketSync org
  member. *(Staff roles beyond owner are Stage 2.)*
- `affiliate` if the user has an `affiliates` row (not suspended).
- `dealer` otherwise → then `products` picks the product sub-mode (already built).

## 2. What already exists (reuse, don't rebuild)

- **Identity/Org:** `users` (Supabase auth) → `profiles` (role) → `dealerships` (org).
- **Products:** `dealerships.products` + entitlement nav (Facebook Solo/Dealer/AI/DealerOS).
- **SaaS admin (partial):** the owner **All Users** console (Customers + billing +
  engine + product toggles), Affiliates admin, MarketSync dashboard mode.
- **Partner engine (mostly built):** `affiliates`, `affiliate_referrals`,
  `affiliate_commissions`, the affiliate portal, and commission mapping that already
  flows a paying dealer back to the referring affiliate.
- **Commission-as-accounting:** affiliate commissions should post through the existing
  Accounting Engine on `subscription.payment_received` / `affiliate.commission_paid`
  (Stage 3 — the events + rule wiring, same pattern as `service.closed`).

## 3. Build sequence

1. **Workspace resolver** — `/auth/me.workspace` (DONE). Frontend routes the whole
   experience off this one field.
2. **SaaS Admin homebase** — assemble the owner surfaces into one workspace with a
   CEO Command Center (MRR, active subs, trials ending, new accounts, AI usage) on top
   of the existing accounts data; Customers/Trials/Lost tabs; Product Management.
3. **MarketSync employees** — internal staff as org members with scoped permissions
   (Sales / Support / Marketing / Developer) instead of owner-only. A `permissions`
   layer keyed to workspace + role.
4. **Affiliate portal in-app** — fold affiliate.html into the same login as the
   `affiliate` workspace; add marketing tools (link, QR, assets).
5. **Commission → Accounting** — emit `subscription.payment_received` +
   `affiliate.commission_payable/paid`; add the posting rules so partner payouts are
   real double-entry, not a side ledger.

Kernel rules hold throughout: no new `*_accounts` tables — everyone is a user in an org
with a role, a workspace, products, and permissions. Same engines, different front door.
