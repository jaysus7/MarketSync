# RLS + Policy Standard — every new table

**Rule: no table ships without RLS.** Every new table in the `public` schema must
enable Row Level Security *and* carry permission-based policies at the moment it is
created — in the same migration, never "later". This is a hard requirement, not a
nice-to-have. The service-role key (`supabaseAdmin`) bypasses RLS, so RLS is the
last line of defence that protects tenant data even if an app-layer
`.eq('dealership_id', …)` filter is ever forgotten.

## The model (how this codebase does authorization)

- **Tenancy + permission live in one check.** Policies call
  `authz.has_permission(dealership_id, '<domain>.<action>')`, which is `true` when
  the caller (via `auth.uid()`) holds that permission **in that dealership**, or is
  platform staff. Tenant isolation and RBAC are enforced together, per row.
- **Policies run as the caller.** They apply to the `authenticated` Postgres role.
  Dealer-facing API routes must therefore query with **`req.supabase`** (the
  request-scoped client bound to the caller's JWT — see `middleware.js`), *not*
  `supabaseAdmin`. `req.supabase` runs as `authenticated`, so the policies below
  actually fire.
- **Child tables resolve the parent's dealership.** A row that has no
  `dealership_id` of its own (e.g. it hangs off `inventory`) uses the parent
  helper, e.g. `authz.has_permission(authz.inventory_dealership(inventory_id), …)`.

## Required policies per table

Four policies, one per command, named `<table>_<cmd>_authorized`:

| Command | `USING` | `WITH CHECK` |
|---------|---------|--------------|
| SELECT  | view permission  | — |
| INSERT  | — | edit/create permission |
| UPDATE  | edit permission  | edit permission |
| DELETE  | delete permission | — |

Pick the permission from the domain the table belongs to (`inventory.*`,
`customer.*`, `deal.*`, `service.*`, `accounting.*`, …). If a new domain needs a
new permission string, add it to the RBAC permission catalogue and grant it to the
appropriate roles in the **same** migration — a policy referencing a permission no
role holds silently locks everyone out.

## Migration template

See `migrations/_TEMPLATE-new-table-rls.sql`. Copy it, replace the table name and
the four permission strings, run it against **staging** (`hpxnjbdiaaoopxeayfen`)
first, verify, then production.

## Before you write a route against a new table

1. Confirm which permission each policy requires (query `pg_policy`, or read the
   migration).
2. Confirm **every role that legitimately uses the feature actually holds that
   permission** (query `public.role_permissions`). A route guarded by permission X
   whose table's SELECT policy needs permission Y will silently return empty for any
   role that has X but not Y. Reconcile the two before shipping.
3. Use `req.supabase` for that route's reads and writes.

## When `supabaseAdmin` is still allowed

Reserve the service-role client for work that is *not* a dealer acting on their own
data, and document the reason inline at each call site:

- Supabase Auth administration and platform administration.
- Verified webhook processing, cron jobs, and background workers (no `req`/JWT).
- Audit and security-event writes; maintenance/backfill operations.
- Cross-user roster / display-name lookups that the `profiles` SELECT policy
  intentionally restricts to `users.manage` (dealership-scoped, non-sensitive).
- Shared helpers with no request context (they receive an explicit,
  already-validated `dealershipId`).

If you reach for `supabaseAdmin` in a dealer-facing route for any other reason, it
usually means the RLS policy is stricter than the app's ownership model — fix the
policy, don't route around it.

## Verify (paste into the SQL editor / MCP)

```sql
-- 1. Any public table WITHOUT RLS enabled? (must return zero rows)
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 2. RLS enabled but NO policies? (must return zero rows)
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid=c.oid);

-- 3. Inspect one table's policies
select polname, polcmd,
  pg_get_expr(polqual, polrelid)      as using_expr,
  pg_get_expr(polwithcheck, polrelid) as check_expr
from pg_policy where polrelid = 'public.<table>'::regclass order by polcmd;
```
