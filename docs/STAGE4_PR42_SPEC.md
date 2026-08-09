# PR 4.2 — Estimates, authorization, technician workflow (APPROVED SPEC)

**Status: approved, not yet implemented.** Start from `staging` @ `8cc0489`.

> **Do not redesign this.** It was reviewed and approved as-is. Read
> `docs/SESSION_HANDOFF.md`, `docs/STAGE4_SERVICE_PARTS_AUDIT.md` §32 and merged PR #74
> first, then implement exactly what is below.

**Goal.** Immutable estimates, provable customer authorization, and a real technician
workflow — while preserving the **database-owned RO state machine** established in #74.

---

## Product frame — why this one matters

MarketSync is one DealerOS core with **independently purchasable department engines**.
Service is the first proof that a department can be bought and operated alone.

- The **Service engine owns its business workflow**.
- The **shared core owns reusable primitives**: dealership, customer, vehicle,
  users/roles, tasks, timeline, documents, communications, events, automation,
  payments/deposits, financial posting.
- Departments talk through **canonical records and events** — never duplicated tables
  or duplicated logic.

Target lifecycle: `appointment → check-in → inspection → estimate → estimate_sent →
customer_approved | customer_declined → parts_ordered (if required) → technician work →
QC → ready → delivered → payment/AR → closed`.

## Reuse — do not build parallel infrastructure

`contacts` + `findOrCreateContact` · `customer_vehicles` · `repair_orders` · `ro_lines` ·
`time_entries` (**already has `ro_id`**) · `esign_requests` · `customer_consents` ·
`communications` · `emitEvent` · `audit()` · `getConfig(dealer,'service')` · the four
Service permissions · `transitionRepairOrder` · `allowedRoTransitions`.

**Do not create:** a second customer model · a second vehicle model · `ro_jobs` · a
second signing system · a JavaScript copy of the RO state machine.

## Schema (staging only, additive)

**`ro_estimates`** — `ro_id · version · lines_snapshot jsonb · labour · parts · fee ·
sublet · discount · subtotal · tax · total · created_by · created_at · presented_at`,
unique `(ro_id, version)`.

> Once `presented_at` is set, **Postgres must reject mutation** of the financial and
> snapshot columns. Estimate immutability belongs in the database, not merely in
> application code.

**`ro_authorizations`** — `ro_id · estimate_id · decision (approved|declined|deferred) ·
approved_amount · authorized_party_name · contact_id ·
method (in_person|phone|sms|email|esign|portal) · decided_at · captured_by ·
decline_reason · evidence jsonb · esign_request_id`.

**`ro_lines`** gains — `concern · cause · correction · op_code · pay_type · recommended ·
line_status · started_at · completed_at · blocked_reason · hours_actual`.

**`esign_requests`** gains a nullable `ro_id` — reuse the signing rail, do not build a
second one.

## Invariants

1. Presented estimate versions are immutable.
2. Estimate version numbers are monotonic per RO.
3. `estimate_sent` requires a presented estimate.
4. `customer_approved` / `customer_declined` require authorization against the **latest
   presented** estimate.
5. An authorization's estimate must belong to the same RO **and** dealership.
6. Any material priced-line change after presentation creates a **new** estimate version.
7. Any material priced-line change after approval **invalidates coverage** of the old
   authorization.
8. An RO must not remain effectively authorized against a stale estimate.
9. `concern` is never overwritten by `cause` or `correction`.
10. Technician completion of lines never closes the RO.
11. Dealership scoping enforced on every mutation.
12. Repeated authorization submissions are safely idempotent when the same decision and
    evidence are retried.

## Authorization invalidation — the mechanism, stated precisely

**Never delete or mutate prior authorization. Authorization is evidence.**

Invalidation is not a write to the old record. It is a **derived question**: *is the
latest presented estimate covered by a valid authorization?* Compute coverage by
comparing the newest presented `ro_estimates.version` against the newest
`ro_authorizations.estimate_id`. If they differ, the RO is uncovered and needs a fresh
decision — while v1's approval stays permanently readable.

The dealership must be able to prove, months later:

> *"The customer approved v1 at 10:42, then additional work was found, v2 was issued,
> and another approval was required."*

**The worked example that must pass:** estimate v1 = \$400 → customer approves → priced
work changes to \$1,900 → v2 created → **v1's approval remains in history but does not
authorize v2** → new approval required.

## Technician workflow

`ro_lines` **is** the job unit. Actual labour uses `time_entries.ro_id` — do not create
another time system.

| Advisor | Technician |
|---|---|
| create / revise estimate | view assigned lines |
| present estimate | start work |
| record authorization / decline | block work with reason |
| assign technician | record cause / findings |
| move toward QC / ready where permitted | record correction · actual time · mark line complete |

Enforce the split **server-side through permissions**. The frontend is not the authority
and must keep asking the backend which actions are currently legal.

## Known conflicts to resolve

- `addRoLine` currently guards only `closed`. Priced-line mutation after presentation
  must trigger the versioning/coverage rules above.
- `recomputeRoTotals` may keep updating **live RO totals**, but must never touch a
  historical estimate snapshot.
- **Tax:** preserve current configured behaviour. Multi-jurisdiction tax is explicitly
  PR 4.4 — do not solve it here.

## Tests required

DB rejects mutation of a presented estimate · version monotonicity · authorization ↔
estimate binding · authorization ↔ dealership scoping · **\$400 approved → \$1,900 → v2 →
v1 does not cover v2** · concern survives cause/correction updates · technician cannot
close an RO · advisor and technician receive different legal action sets · dealership
isolation · idempotent duplicate authorization · `estimate_sent` impossible without a
presented estimate · `customer_approved` / `customer_declined` impossible without
authorization for the latest estimate.

Run the full suite and all six `check:*` before opening the PR.
**Do not weaken database controls to make tests pass.**

## Architectural constraints (all PRs)

No duplicate state machines · no duplicate customer or vehicle records · no hidden
dependency on the Sales engine · no frontend business-rule authority · no weakening DB
controls · no duplicate financial posting logic · no demo-only workflow where a real
dealership action is required · no broad rewrite of working shared infrastructure ·
every mutation dealership-scoped and permission-aware · idempotency and concurrency
safety preserved.

## Standalone-product test — ask at the end of every PR

1. *"If a dealership bought only MarketSync Service, could the service department
   perform this part of its job completely?"* If no, name the missing operational
   requirement.
2. *"Did we build something inside Service that belongs in the DealerOS core or another
   department?"* If yes, **refactor the ownership boundary rather than duplicating it.**

Only make the seams correct so Service connects cleanly to Parts, Accounting, Sales/CRM
and Inventory. Do not build those departments now.

## On completion

1. exact schema changes · 2. new/changed routes and services · 3. the authorization
invalidation mechanism · 4. test results · 5. confirmation that
`book → check in → inspect → estimate → present → authorize → assign technician →
perform work → QC → ready` works standalone · 6. `docs/SESSION_HANDOFF.md` updated ·
7. PR opened against `staging`.

**Stop after PR 4.2 is green. Do not begin PR 4.3.**
