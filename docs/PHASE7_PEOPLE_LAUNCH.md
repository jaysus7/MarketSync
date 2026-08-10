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

---

## PR 7.2 — Offboarding *(merged)*

**A correction to G4, made after reading the middleware rather than assuming.** The truth check
listed "a terminated employee retains access" as a stop-gate item. That is **not** the case.
`requireAuth` re-reads the profile on every request and refuses `active === false` with
`ACCOUNT_DEACTIVATED`, so the existing one-line removal genuinely did lock people out, live
token or not. Access revocation was never the hole. Recording that plainly matters more than
having been dramatic about it.

**What was actually wrong** was everything around it, and it was quiet:

- **Roles survived the departure.** `user_roles` was never touched, so reopening the account —
  to check something, to rehire — silently restored every permission, and nobody chose that.
- **Owned work was orphaned.** A salesperson left and their entire customer book, open tasks
  and open repair orders stayed assigned to them. Nobody follows up on an orphaned book, and
  nothing said it had happened. This is the real damage, and it was invisible *because* the
  account looked handled.
- Employment was untouched — `staff_members` never learned the person left.
- No reason, no date, no record that offboarding occurred.

**Offboarding is now an ordered workflow that refuses to leave the dealership worse off.** It
counts live ownership first and stops — 409, with the counts — while work would be orphaned and
no successor is named. A count that *failed* is reported as unknown rather than treated as
zero, because "nothing to reassign" from a broken query is how a book gets lost silently.

Order matters and is tested: reassign → revoke roles → deactivate → **mark terminated last**, so
a failure partway never marks someone terminated while they still hold access.

**`created_by` is never reassigned.** Who did a thing is history, and history does not change
because someone resigned. Only live ownership moves — `contacts.assigned_rep`,
`crm_tasks.assigned_to` (open only), `repair_orders.advisor_id`/`technician_id` (open only),
`campaigns.owner_id`. Closed repair orders and finished tasks stay where they are; reassigning
them would rewrite who handled work that is already done.

**The legacy `DELETE /admin/users/:id` now runs the real offboarding**, because that is the path
the existing Team UI actually uses. It is a deliberate behaviour change: removing someone who
still owns live work now returns 409 with the list instead of quietly succeeding.

15 new tests; 848/848; six gates green. No migration.

---

## PR 7.3 — Academy

**What was there.** Five hard-coded courses in `dashboard-part24.js`, a "Complete Course &
Issue Diploma" button, and a printable certificate with a hard-coded name, a hard-coded date
and an invented certificate number (`MS-CERT-2026-98421`). Nothing was assigned, nothing was
tracked, nobody could see who had done what, and the diploma was issued because somebody
clicked it. That is worse than having no diploma: the dealership was publishing a claim about
a person that nobody had checked. The Academy page also had no container of its own and no
entry in the workspace registry — it rendered into the generic `#page-content` and was
reachable only by luck.

**What it is now.** 32 courses MarketSync will actually require of somebody, across the eight
departments plus two universal ones, and nine certification families. Deliberately not padded
to match the 189-entry reference library: a Your Path with 189 entries is the problem this
slice exists to fix, and filler would recreate it. The library stays, searchable, fetched only
when asked for, and never the default view.

**Your Learning** is Required → Department Foundations → Advanced, derived from role +
employment department. `reference` is excluded by construction. Overdue is computed from the
due date, never from a status somebody set, and a person whose path fails to load sees that
rather than an empty one — the same "empty success is a failure mode" rule as My Day.

**A credential requires the work.** `issueCertification` reads completion from
`staff_training_assignments` and refuses unless every required course is complete, naming what
is outstanding. The screen shows the same outstanding count the server would refuse on, so the
button and the refusal cannot disagree. Issuing is behind `staff.training.manage` + MFA.

**The public credential** (`GET /verify/:credentialId`, and `verify.html` on the shared shell)
carries name, holder, issuer, dates and validity — no dealership, no employment record, no
internal ids. The credential ID is generated with `randomToken`, because possession of it is
the entire authorisation for that page. `verify.html` is `noindex`: indexing shared credentials
would turn them into a browsable directory of who works where.

### The defect this slice nearly shipped

`staff_training_assignments` carried a composite foreign key
`(course_id, dealership_id) → staff_training_courses(id, dealership_id)`. That is how the
schema kept one dealership from assigning another's private course. A global course has
`dealership_id = null`, so the pair never matches and **every assignment of a MarketSync course
fails**. The curriculum would have been readable, searchable, certifiable on paper — and
permanently unassignable. Schema, routes, courses, UI and 37 green tests, capability dead.
AGENTS.md A19, sixth instance.

No test could have caught it: CI has no database. It was found by inserting a real assignment
against staging. The tenant guarantee was not given up — it is restated as a trigger: a course
must be global, or belong to the assigning dealership. A second trigger freezes course
ownership, so a course cannot change owner and retroactively invalidate assignments that
already passed the check.

**Proved on staging** with nine probes inside a transaction that deliberately aborts, so
nothing persisted: global courses assign (3 for a Sales rep: two universal + lead workflow),
duplicate assignments refuse, another dealership's private course still refuses, course
ownership is frozen, a second live credential refuses, credential ids are globally unique, and
invented sources and levels refuse. Catalog verified live: 32 global courses, 9 certifications,
38 requirements, 0 requirements naming a course that does not exist.

**At 390px**, the credential row rendered `Credential MS-SALES-8fJq2…` — a truncated ID that
reads as a whole one. The ID was removed from the row entirely (it lives in the credential
modal, where it wraps) and the row now shows the expiry. Same lesson as the Parts availability
row: what a line is FOR must survive the cut, and an identifier cannot survive a cut at all.

**Reachability was its own work.** Academy is a `system: true` workspace, not a tenth
department — the nine are product law — and not a page under People, which is manager-only
while everybody has required training. It carries no `PAGE_FEATURE` entitlement (required
compliance training is not a plan upsell) and is in every specialized role's page allow-list,
including F&I and Service, the roles with the most required training. A test walks that whole
chain, because this screen has already been lost at three of those links.

29 frontend + 37 backend tests; 914/914; six gates green. Migration applied to staging only.

**Deferred, and named rather than implied:** course content itself (each course is a record
with a title, a description and a duration — the lesson body is Phase 8 content work), quiz
and passing-score enforcement (the columns exist and are unused), and a QR image on the
credential (the verification URL is there; rendering it as a QR needs a library decision).

---

## PR 7.4 — The time clock, and payroll that names who it could not pay

**Scope note first.** The plan said "schedule/time, compliance and performance, only to the
depth the existing tables honestly support". Having read the schema against the live database:
**performance is out**, and this is the reason rather than an omission — there are no review,
goal or rating tables at all. Building them here would be inventing a model inside a slice
whose whole instruction was to be honest about depth, and the brief separately forbids opaque
employee scoring. Compliance is partly out for a related reason, recorded under G9 below.

### What was found

**F1 — There is no clock.** `time_entries` had exactly ONE reference in the entire backend —
a `.select()` in `roActualHours` — and zero rows. Nothing clocked anybody in, on any surface,
in any role, and no frontend mentioned it. AGENTS.md A19, eighth instance.

**F2 — So `roActualHours` returned 0.0 for every repair order that has ever existed.** The
comment above it reads "Actual labour comes from the existing payroll clock"; there was no
payroll clock. Service's actual hours — the number behind effective labour rate and job
costing — was structurally zero and rendered as "this job took no time" rather than "nobody
has clocked against it". It now returns `{ hours, entries, open_entries, recorded }`, so the
two can be told apart.

**F3 — `time_entries.employee_id` had no foreign key at all.** Not to `profiles`, not to
`staff_members`, not even a dealership-scoped one. Any uuid was accepted, including another
dealership's employee, on the record that decides what somebody gets paid. It now points at
`staff_members(id, dealership_id)` — time is a fact about *employment*, so it survives the
login being deactivated, and it cannot cross tenants.

**F4 — `staff_payroll_items` was read twice and written nowhere.** Every payroll batch was
empty, and `GET /hr/payroll/batches/:id/export` returned **200 with a CSV of headers and no
rows**. A controller exporting payroll got a successful, empty file that reads as "nobody is
owed anything". That export now refuses with 409 and says how to fix it.

**F5 — A superseded `hr_*` schema exists as an unapplied migration**
(`2026-08-06-hr-foundation.sql`: `hr_employees`, `hr_time_entries`, `hr_certificates`,
`hr_policy_signatures`, `hr_payroll_*`). No code reads or writes any of it and none of it
exists on staging. It is left in place per A6 (KEEP over DELETE) but recorded here: **applying
it would create a third employee identity and a second time system.** Do not apply it.

### What was built

The clock (`routes/people-time.js`), and four rules that each sit somewhere money can go wrong:

- **The clock records what happened.** Hours are derived from the two timestamps on every
  read; no total is stored, because a stored total can disagree with the times behind it. An
  open shift reports `hours: null`, never `0`.
- **Only approved time is paid**, approval names who did it, and the database refuses an
  approval missing either the clock-out or the approver.
- **Every mutation writes `time_entry_change_history`**, which was itself dead (zero
  references) and is now append-only by trigger. An edit that cannot be traced is not applied.
- **Payroll names who it could not compute.** No employment details, no hourly rate, salaried,
  or hours recorded but unapproved — each comes back in `unpayable` with a reason and the
  hours involved. A payroll run that quietly omits somebody looks like a completed run.
  Deductions are explicitly `deductions_calculated: false` rather than a zero that looks
  calculated, and commission is not guessed from the clock — the commission engine owns that
  money, and a second number for it is how two screens start disagreeing.

`staff.time.self` is a new permission, deliberately separate from `staff.time.approve`:
everybody who works here clocks their own time, and that must never imply seeing anybody
else's hours. Time is now a My Day source gated on `staff.time.approve`.

**Proved on staging** with nine probes inside a transaction that aborts, so nothing persisted:
a shift opens; a second open shift for the same person is refused; another dealership's
employee cannot be clocked; an open shift cannot be approved; an approval with no approver is
refused; a break longer than the shift is refused; a new shift opens once the last one closed
(the index is partial, as intended); history cannot be rewritten; history cannot point at
another dealership's entry.

32 new tests; 946/946; six gates green. Migration applied to staging only.

### G9 — Compliance reports "compliant" from absence *(found, not yet fixed)*

`staff_compliance_dashboard_v` is well built and permission-gated in the database. It counts
overdue policy acknowledgements, overdue training, expired certifications, expired documents,
overdue lifecycle tasks and open safety actions. **Every one of those counters reads a table
with no producer**: `staff_policies`, `staff_policy_versions` and
`staff_policy_acknowledgements` have zero references anywhere in the codebase, and
`staff_lifecycle_assignments` has zero references despite 10 seeded templates and 90 template
tasks. So a dealership that has published no policy and started no onboarding sees **all
zeros, reading as "everybody compliant"** — an absence of records rendering as evidence of
compliance. This is the compliance-evidence stop-gate category.

It is named here rather than half-fixed: the honest repair is a policy authoring + publish +
acknowledge chain plus an onboarding assignment producer, which is its own slice. Note that
PR 7.1's `onboarding_not_started` attention item currently has **no remedy** — nothing can
start onboarding — which is the same gap seen from the other side.

---

## PR 7.5 — Compliance: telling an absence of records from a clean bill of health

This closes **G9**, opened in 7.4.

**What was wrong.** `staff_compliance_dashboard_v` is well built and gated in the database. It
counts overdue policy acknowledgements, overdue training, expired certifications, expired
documents, overdue lifecycle tasks and open safety actions — and **every one of those counters
read a table with no producer**. `staff_policies`, `staff_policy_versions` and
`staff_policy_acknowledgements` had zero references anywhere in the codebase.
`staff_lifecycle_assignments` had zero references despite 10 seeded templates and 90 template
tasks. So a dealership that had published no policy and started no onboarding saw **all zeros,
reading as "everybody is compliant"**. An absence of records is not evidence of compliance; on
a compliance surface those two must never render the same way.

**The honesty layer.** `coverage()` reports, per area, whether there are records behind the
number at all, and `/hr/compliance` now ships it alongside the counts. A count that *fails*
comes back `null`, never `0` — an unreadable table must not read as an empty one, which is the
same defect one level up. The unmeasured state is itself a My Day item
(`compliance_not_measured`), because otherwise a dealership measuring nothing has a permanently
clear compliance queue.

**The producers.** Policies can now be created, published, assigned and acknowledged, and
onboarding can be started — the remedy PR 7.1's `onboarding_not_started` never had. Two rules
carry A20:

- **Only the person themselves can acknowledge.** `acknowledged_by_user_id` is the caller,
  never a parameter. A manager may assign, waive with a recorded reason, or chase. A signature
  somebody else supplied is not a signature.
- **An acknowledgement records what was actually read.** The version's checksum is stored on
  the acknowledgement, and the database refuses an acknowledgement without it. Otherwise a
  dealership could rewrite a policy and still claim everybody had accepted it.

**The templates had no producer either.** Five dealerships were seeded with the core checklists
once; every dealership created since had none, so onboarding could never be started there.
`lifecycle-templates.js` checks in the same 18 tasks (same `task_key`s, same content — this is
not a rewrite) and `ensureLifecycleTemplates` seeds them on demand, keyed so re-running corrects
wording rather than duplicating. Started checklists **copy** their tasks, so editing a template
later cannot rewrite a checklist somebody is working through.

### A weaker duplicate guard, caught before shipping — second time this phase

This migration originally added a `reject_published_policy_edit` trigger. Probing staging
revealed `protect_staff_policy_version()` **already exists and is stricter**: it makes published
*and retired* versions fully immutable (allowing only the published → retired transition, and
only when nothing else changed), and it **computes** `checksum_sha256` server-side on publish,
overriding whatever a caller supplies. The duplicate was deleted and `publishPolicyVersion` no
longer sends a checksum at all — it reads back the one the database computed. Sending a value
that gets silently replaced is how two different checksums for one policy end up in circulation.
A test pins the duplicate out. (The first instance was the SSRF guard in Phase 6S.)

**Proved on staging** with ten probes inside a transaction that aborts, so nothing persisted:
publishing computes the checksum; published text cannot be rewritten; a published version
cannot return to draft; an acknowledgement with no record of what was read is refused; one with
the checksum is accepted; a duplicate assignment is refused; one open onboarding per person per
type; another dealership's employee cannot be onboarded here; a blocked task must say why;
template task keys are unique.

28 new tests; 974/974; six gates green. Migration applied to staging only.

**Still deferred, named:** policy *content* (MarketSync ships no model policies — a dealership
writes its own, and shipping template legal text would be advice this product is not qualified
to give), and safety incidents / corrective actions, which have their own tables and are their
own slice.

---

## PR 7.6 — The Dealer Launch Hub *(backend)*

**A correction to G7, made after reading the schema rather than assuming.** The truth check said
"no canonical location or dealership operating configuration". That was too broad. `dealerships`
already carries `legal_name`, `street_address`, `city`, `province`, `country`, `postal_code`,
`phone`, `hst_number` and `omvic_reg`, and those columns are real and correctly placed.

What is actually missing is narrower and worse:

- **Timezone** — absent entirely. Every date this product computes (a training due date, an
  accounting period, a promised time, whether a shift ran overnight) is evaluated in UTC. A
  dealership in Vancouver closes its month at 5pm on the 31st and nothing knows it.
- **Operating hours** — absent. Nothing can say whether the store is open, which is what turns
  "no response in 20 minutes" into either a problem or a Sunday.
- **Locations** — absent. `group_id` covers dealer groups; one dealership with two rooftops has
  nowhere to put the second.

**And the columns that do exist are empty: 0 of 7 dealerships have an address or a legal name.**
The configuration surface was never the gap. Nothing ever asked anybody to fill it in — which
is precisely what the Launch Hub is for.

### The four rules, each from the brief

1. **Derived, never stored.** There is no `setup_completed` column, no `onboarding_step`, no
   checklist table. Every requirement re-reads real configuration on every call, so "done"
   cannot drift from done. A test pins those column names out of both the engine and the
   migration.
2. **Setup is not a lock.** The hub exports readiness and nothing else: no middleware, no 403,
   and a test asserts that `middleware.js`, `access.js` and `authorization.js` do not import it.
   The way to keep "no blanket application lock" true is for this module to be incapable of
   imposing one.
3. **Entitlement decides which requirements EXIST; role decides who may SATISFY them.** A
   dealership without Service is not incomplete for having no service hours — that requirement
   is not theirs. A requirement the caller cannot satisfy is marked `actionable_by_you: false`
   and still listed, because hiding it leaves an invisible blocker and nagging is noise.
4. **"Operational" and "fully configured" are separate answers.** A dealership can sell a car
   before it has picked a logo.

**A failed check is `unknown`, never `false`** — and a hub with any unknown refuses to declare
readiness. Reporting "not done" because a query failed would send somebody to re-enter what
they had already entered.

**Contextual, not a wall.** `GET /launch/feature/:name` lets a department ask about itself and
get back only what it is missing, so setup reaches somebody at the moment it matters.

**Enter once** is enforced rather than intended: the first location is seeded from the
dealership's own address and becomes primary, and one primary per dealership is a partial
unique index. Timezones are validated against `pg_timezone_names` by trigger (a check
constraint may not contain a subquery, and a hard-coded list goes stale) — with **no default**,
because a guessed timezone is worse than a missing one: it produces dates wrong by hours and
nobody looks at a field that already has a value.

**Proved on staging** with eight probes inside a transaction that aborts: a real timezone is
accepted; `America/Torotno` is refused; a primary location is created; a second primary is
refused; a secondary is allowed; a duplicate name is refused case-insensitively; an invalid
location timezone is refused; retiring a primary frees the slot.

27 new tests; 1001/1001; six gates green. Migration applied to staging only.

**Not yet built, and this is the honest remaining gap:** the Launch Hub has **no UI**. The
engine, the routes and the canonical configuration are real and tested, but a dealership cannot
reach any of it from the dashboard yet. Shipping it this way is exactly the dead-wiring shape
this phase keeps finding, so it is recorded as the open item rather than described as done —
the next slice is the hub screen plus the contextual setup prompts inside each department.
