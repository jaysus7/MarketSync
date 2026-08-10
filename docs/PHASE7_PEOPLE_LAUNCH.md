# Phase 7 — People + Academy + Dealer Launch: critical truth check

Baseline: `a3745e7` on `staging` · 815/815 tests · all six `check:*` green · Phase 6 complete.

---

## CURRENT TRUTH

### The People engine exists, is well built, and has never held an employee

`staff_members` and its twenty satellite tables were built in the People/HR rebuild. The schema
is good: employment status, onboarding status, compliance status, manager hierarchy, lifecycle
templates and tasks, policies with versions and acknowledgements, certifications, documents,
assets with an event log, leave requests with an approval trail, payroll batches and items,
time entries with change history, and three reporting views.

`routes/hr.js` exposes 14 routes over it, each correctly gated on a real `staff.*` permission,
with MFA on the sensitive ones. Training completion writes real evidence. Leave decisions are
recorded. The permission vocabulary is complete (17 `staff.*` permissions).

**Live row counts on staging:**

| Table | Rows |
|---|---:|
| `staff_members` | **0** |
| `staff_employment_details` | 0 |
| `staff_training_assignments` | 0 |
| `staff_training_courses` | 0 |
| `staff_policies` / `_acknowledgements` | 0 / 0 |
| `staff_certifications` | 0 |
| `time_entries` | 0 |
| `staff_leave_requests` | 0 |
| `staff_payroll_batches` | 0 |
| `staff_assets` | 0 |
| `staff_status_history` | 0 |
| `staff_lifecycle_templates` | 10 *(seeded)* |
| `profiles` | 7 |
| `user_roles` | 6 |

Seven people can log into this dealership. **Zero of them are employees.**

### Why: nothing creates one

`routes/hr.js` has no create route. The only `INSERT` into `staff_members` in the codebase is
`POST /team/staff` in `routes/submodules/dashboard-reports.js` — a legacy Team feature that
writes a *contact-shaped* row (name, team, phone, email, notes) and sets neither `user_id`,
`employment_status`, `department`, nor `job_title`.

Nothing in registration, invitation or user management creates a staff record. So the chain
`hire → employee → role → training → compliance` has **no producer at its first link**.

The consequence is visible in the code's own words. `POST /hr/training/complete` resolves the
caller through `selfStaffMemberId(req)` and returns:

> `No staff profile linked to your account`

That is the correct behaviour, and it is what **every user gets today**, for every People
feature, because no login has ever been linked to a staff record.

**This is the sixth instance this build of the same defect class** — complete schema, complete
routes, no runtime producer — after the general ledger, social publishing, attribution, consent
and the storage buckets. It is exactly what AGENTS.md A19 was written for, and it is the single
most important fact about Phase 7.

### Employee identity is split three ways

| Model | Populated | Holds | Read by |
|---|---|---|---|
| `profiles` + `user_roles` → `role_permissions` | **yes** (7 / 6) | login, RBAC role, permissions | `hasPermission()` — the authoritative gate |
| `staff_members` | no | employment, department, manager, statuses | `routes/hr.js` |
| `profiles.role` / `account_role` / `mgr_role` / `saas_role` / `system_role` | partly | five parallel role-ish strings | frontend `profileContext.role`, various routes |

`profiles` additionally duplicates `department`, `active` and `sales_team` against
`staff_members.department`, `.active` / `.employment_status` and `.team`. Nothing keeps them
consistent, because nothing writes the second one.

**Roles are keyed to the login (`user_roles.user_id`), employment to the staff record.** Those
are different keys for the same person, and today they are never joined.

### Academy is a static frontend array

~189 course entries live in `marketplace-frontend/js/modules/dashboard-part24.js`. The database
table `staff_training_courses` is empty and has no importer. There is no certification engine,
no credential, no verification surface. `staff_certifications` exists as a table and is unused.

### Dealer Launch has no canonical configuration to reference

There is **no `locations` / `stores` table**. `dealerships` carries `name`, `legal_name`,
`street_address`, `city`, `province`, `postal_code`, `phone` — and **no timezone, tax region,
logo, or hours**. Those are precisely the "enter once" values the brief names.

Setup state itself is not modelled: no `setup_*` table, no per-step status, no readiness. The
existing per-page setup flows write directly to their own department's config.

---

## CRITICAL GAPS

**G1 — The employee record has no producer *(blocking, and the whole phase turns on it)*.**
Until a login becomes an employee, every People feature is unreachable by construction.

**G2 — Two identities for one person.** Role/permission on `profiles`+`user_roles`, employment
on `staff_members`, joined by nothing. "One employee identity" is Phase 7's first exit
criterion and cannot be met by either model alone.

**G3 — Five role columns on `profiles`.** `role`, `account_role`, `mgr_role`, `saas_role`,
`system_role`, alongside the real RBAC. Which one drives the experience is currently answered
differently in different files.

**G4 — Offboarding cannot revoke access.** There is no offboarding route at all. Setting
`staff_members.employment_status = 'terminated'` on a record that does not exist, and is not
linked to the login, would revoke nothing. **Stop-gate item: a terminated employee retains
access.** No session invalidation, no role revocation, no ownership reassignment.

**G5 — Academy content is not addressable.** Static frontend array; nothing can be assigned,
required, tracked or certified against it.

**G6 — No certification engine.** Required for the clarification's exit criteria: credential
ID, version, expiry, verification URL, sharing.

**G7 — No canonical location or dealership operating configuration.** Timezone, tax region,
hours, logo, and locations do not exist, so "enter once" has nowhere to be entered.

**G8 — No setup state model.** Readiness cannot be derived from real state because no state is
recorded. A checklist built now would manufacture readiness — the exact thing the brief forbids.

---

## DECISIONS

**D1 — `profiles` is the person; `staff_members` is their employment.** Do not merge them and
do not migrate roles onto the staff record. One person = one `profiles` row (the login and its
RBAC) with **at most one** `staff_members` row (their employment at this dealership),
joined by `staff_members.user_id`, enforced unique per dealership. This keeps the authoritative
permission path untouched — it is frozen kernel — while giving employment a home.

**D2 — Creating a user creates an employee.** The producer G1 is missing gets built at the
point a person is invited or added, so the two are never out of step. An existing login without
a staff record is backfilled on first People read, not left broken.

**D3 — `user_roles` remains the only permission truth.** The five `profiles.*_role` columns are
**display/legacy** and get documented as such, not deleted (A6: KEEP over DELETE, and live code
reads them). Phase 7 adds no sixth.

**D4 — Offboarding is a workflow with an ordered checklist, not a boolean.** It must revoke
roles, invalidate sessions, and require ownership reassignment before it can complete.

**D5 — Academy content moves into the database**, imported from the existing array rather than
rewritten, so it can be assigned, required and certified against. The array stays the source
for the import.

**D6 — Setup requirements are typed** (`REQUIRED_TO_LAUNCH` / `REQUIRED_FOR_FEATURE` /
`RECOMMENDED` / `OPTIONAL`) and **derived**, never stored as a checklist someone ticks.
Readiness is computed from real configuration, and "Operational" is reported separately from
"Fully configured".

**D7 — Entitlement decides which requirements exist; role decides who may satisfy them.** They
stay separate, per the brief.

---

## IMPLEMENTATION — order matters

1. **7.1 — Employee identity + producer.** `staff_members.user_id` unique per dealership;
   create-employee route; invitation flow produces one; backfill for the 7 existing logins;
   employment state machine with audited transitions; Team workspace and employee card reading
   one joined identity.
2. **7.2 — Offboarding + ownership reassignment.** The stop-gate item. Revoke roles, invalidate
   sessions, block completion while owned leads/deals/tasks remain, preserve history.
3. **7.3 — Academy: content into the database, Your Path, certification engine, credential +
   public verification.**
4. **7.4 — Schedule/time, compliance and performance**, only to the depth the existing tables
   honestly support.
5. **7.5 — Dealer Launch Hub**: canonical dealership operating config + locations, typed
   derived requirements, entitlement-aware, save/resume, contextual Academy.
6. **7.6 — People My Day + E2E 1–12 + 390px.**

---

## DEFERRED

Full payroll provider, benefits, ATS/recruiting, workforce forecasting, opaque AI employee
scoring, generic LMS replacement, course-authoring suite, MarketSync internal HR, affiliate
Academy — all explicitly out of Phase 7 per the brief.

---

## TESTS

To be written alongside, not after:

- A user created through the normal flow **has** a staff record, and exactly one.
- An existing login with no staff record is backfilled rather than 400ing.
- `profiles` and `staff_members` cannot disagree about employment status.
- A terminated employee cannot authenticate, holds no roles, and has an invalidated session.
- Offboarding **refuses to complete** while the employee still owns leads, deals or tasks.
- Employee history survives termination.
- A salesperson cannot read another employee's compensation; a controller can.
- Dealer A cannot read, role, train or offboard a Dealer B employee — server-side.
- Required training assignment is deterministic from role + department + policy.
- A certification issues only on satisfied requirements, and its public verification surface
  exposes the credential and nothing else about the employee.
- Launch readiness derives from real configuration; a missing `REQUIRED_FOR_FEATURE` item
  blocks its feature and nothing else.
- Shared dealership configuration is requested once and referenced thereafter.


---

## PR 7.1 — Employee identity and its producer *(merged)*

**No migration was needed.** The schema was already right and had been all along:
`staff_members_dealership_user_uidx` is unique on `(dealership_id, user_id)`, the
`employment_status` check already enforced exactly `invited | active | on_leave | suspended |
terminated`, and `staff_status_history` existed with a matching constraint. Nothing had ever
used any of it. This slice is pure code — KEEP over BUILD.

**The producer.** `ensureStaffMember()` is now called when a user is invited, so a login and an
employment record are created together and cannot drift. Logins that predate it are backfilled
lazily on their first People read, as `active` rather than `invited` — someone who has been
signing in for months is not waiting on an invitation. Duplicates are prevented by the database
rather than by a read-then-write, and losing that race re-reads instead of failing, because the
caller wanted an employee to exist and one does.

**The model, stated once.** `profiles` is the person — their login, and via `user_roles` their
permissions, which stays frozen kernel and is untouched here. `staff_members` is their
employment. A test asserts `people-identity.js` never reads `user_roles` or `role_permissions`,
so employment can never quietly become a second permission source.

**Termination refuses, deliberately.** `changeEmploymentStatus` will not terminate until the
offboarding workflow exists. Marking someone terminated while they keep their roles, their
session and their owned work is worse than not offering the button — that is the 7.2 stop-gate
item, and a status flag that revokes nothing would read as if it had.

**The directory shows logins with no employment record** rather than hiding them, flagged
`linked: false`, and `peopleAttention` raises `employee_record_missing` for each. A person who
can sign in and does not appear in their own team list is how a dealership loses track of who
works there. People is now a My Day source and has been removed from `not_covered`.

Proven on staging with three rollback probes: a second employment record for one login was
refused by unique violation, an invented status was refused by check violation, and history
wrote against the same lifecycle. 18 new tests; 833/833; six gates green.

**A bug caught on the way:** the first draft of `POST /hr/employees` used `supabaseAdmin`,
which is not imported in `hr.js` — a ReferenceError no gate can see, because none of them
execute route bodies. It also would have bypassed the RLS posture that module documents in its
own header. It now uses `req.supabase`, and a test pins `supabaseAdmin` out of the file.
