# Phase 6S — Security stabilization

CodeQL was enabled on this repository for the first time during Phase 6 and immediately
surfaced **68 findings** against the whole codebase. They predate all Phase 6 work. This slice
triaged every one, fixed the confirmed issues, and stopped.

**Scope held deliberately:** no authentication rewrite, no billing replacement, no integration
redesign, no production migrations. Confirmed issues in sensitive paths only.

---

## Why so many findings, and why so few fixes

Two custom safety primitives account for most of the noise. CodeQL does not model either, so
it reports the protected code as unprotected:

| Primitive | Where | Findings it explains |
|---|---|---|
| `rateLimit(name, max, windowMs, …)` in `security.js` | every auth route | 7 of 30 "missing rate limiting" |
| `esc()` in `dashboard.js` | every frontend template | the XSS / HTML-injection family |

That is not a criticism of the tool — it is the reason a raw finding count is not a security
posture, and the reason this slice triaged before it touched anything.

**The severity API returned 403 for this token**, so per-alert CodeQL severities could not be
retrieved. Findings below are classified by **exploitability**, argued explicitly, rather than
by a number that could not be read. Where that judgement is debatable it is written down so it
can be argued with.

---

## Disposition of all 68

| Class | Count | Disposition |
|---|---:|---|
| Missing rate limiting | 30 | 7 **false positive** (already limited) · 12 **fixed** · 11 **accepted** (authenticated + permissioned, no cost) |
| Server-side request forgery | 7 | 1 **fixed** (persisted feed URL) · 6 **accepted with mitigation** (intended dealer-URL fetching, guarded at intake) |
| Polynomial regex on uncontrolled data | 5 | **accepted** — all bounded by input caps; one input cap **added** |
| Sensitive data read from GET | 4 | **false positive** — expense filters, not credentials |
| Insecure randomness | 3 | 2 **fixed** (see below) · 1 **false positive** (cosmetic ids) |
| Clear-text storage of sensitive info | 3 | **false positive** — module-scope variable, not storage |
| Incomplete string escaping | 3 | **accepted** — display-only formatting |
| Biased random from CSPRNG | 2 | **false positive** — see the arithmetic below |
| Password hash with insufficient effort | 2 | **false positive** — see below |
| Replacement of a substring with itself | 2 | **false positive** — cosmetic |
| Incomplete URL substring sanitization | 1 | **false positive** — picks a display label, not a security decision |
| Externally-controlled format string | 1 | **fixed** |
| DOM text reinterpreted as HTML | 1 | **fixed** — genuine stored XSS |
| Client-side XSS | 1 | **false positive** — `esc()` not modelled |
| Type confusion through parameter tampering | 1 | **fixed** |
| Loop bound injection | 1 | **fixed** (input cap) |

---

## Confirmed and fixed

### 1. The anonymous visitor token was `Math.random()` — cross-customer chat exposure

**The worst of the set.** `ai-runtime.js` minted a website visitor's token with
`Math.random()`. That token is a **bearer credential**: `resolveConversation()` (PR 6.4) looks
a conversation up by it, so whoever holds it reads that visitor's transcript — which by 6.4
can include the customer's name, phone, trade details, and merges into a known customer's
thread.

V8 implements `Math.random()` as xorshift128+; its internal state is recoverable from a
handful of observed outputs. Opening the chat widget a few times yields those outputs. Other
visitors' tokens were therefore derivable.

Fixed with `randomToken()` — a single exported CSPRNG helper, so the next person reaches for
the right thing by default.

### 2. Meeting room URLs and customer attachment paths were `Math.random()`

A booked test-drive's Jitsi room URL is the **only** access control on that room. The
`crm-attachments` bucket is **public**, so the object path is the only thing protecting a
customer's uploaded documents. Both now use the CSPRNG. Sales-video storage paths likewise.

Cosmetic ids (widget/section keys) were deliberately **left alone** — changing them would be
churn with no security value and would obscure which changes mattered.

### 3. A persisted feed URL was never checked for SSRF

`/feeds/probe` validated its URL through `feed-probe-policy.js`. `/feeds/add` — the one that
**stores** a URL the server then fetches on a schedule forever — did not. A feed pointed at
`http://169.254.169.254/` turns our own fetcher into a credential-exfiltration tool.

Fixed by applying the **existing** policy. Worth recording: I first wrote a new regex-based
guard in `security.js` before finding `feed-probe-policy.js`, which is strictly better — it
resolves DNS and rejects embedded credentials. The duplicate was deleted and a test now
asserts it stays deleted. KEEP > BUILD, and a second weaker copy of a security control is
worse than none because the two drift.

### 4. Stored XSS in the appraisal print window

`apprPrintWindow(title, inner)` interpolated `title` raw into `<title>` before
`document.write`. `title` carries the vehicle's make/model/trim — **which arrives from
dealer-supplied external feeds**. Markup in a trim name would have executed in the dealer's
browser. The body was already safe: `fld()` and `apprDiscAns()` escape every value.

### 5. Rate limiting where abuse is genuinely possible

Added, and only here:

- `/sync`, `/cron/sync-all`, `/cron/drip` — unauthenticated until the secret check, and a
  valid call starts a full inventory sync.
- `/square/webhook` — signature-verified but reachable by anyone; each call costs an HMAC.
- `billing/*-verify` ×5 — each hits Stripe. A cost guard, not an access control.
- `integrations/:provider/test`, `integrations/google_business/post` — outbound provider calls.

**Not** added to the 11 authenticated, MFA'd, permission-gated CRUD routes CodeQL flagged.
Blanket limits there would be theatre and would eventually break a legitimate bulk operation.

### 6. Input the server walks is now bounded

- Lead CSV import capped at 8MB (the parser walks every character).
- `?dealership_id=` coerced from Express's array-on-repeat to a string.
- A user-controlled value removed from a `console.error` format position.

---

## False positives, with the reasoning

These are documented rather than "fixed" because changing them would make the code worse.

**`security.js:72` — "password hashed insecurely" (SHA-1).** This is the Have I Been Pwned
k-anonymity check. SHA-1 is *mandated by that protocol*; only the first 5 hex characters leave
the server and the full hash never does. It is not password storage. Replacing it would break
the breach check.

**`security.js:132`, `groups.js:10` — "biased random from a CSPRNG".** The alphabet is 32
characters and the source is a uniform byte, `0–255`. **256 mod 32 = 0**, so every character
is exactly equally likely. There is no bias to remove. (The rule is right in general — modulo
a value that does not divide 256 *would* bias — it just does not apply here.)

**`public-api.js:20` — "password hashed insecurely" (SHA-256 of an API key).** The key is
`msk_live_` + 24 CSPRNG bytes = **192 bits of entropy**. bcrypt exists to make *low*-entropy
secrets expensive to guess; against a 192-bit random token it adds nothing but latency on
every API request. SHA-256 is the correct choice.

**`dashboard-part26.js` ×3 — "clear text storage of sensitive information".** A module-scope
variable holding the employee list already fetched for display. Not storage — no cookie, no
`localStorage`, no disk.

**7 × "missing rate limiting" on auth/MFA/passkeys** — all already limited (`mfa-verify`,
`mfa-phone-verify`, `passkey-login-begin`, `passkey-login-finish`, `mfa-challenge`, `login`,
plus `forgot`/`reset`). A regression test now pins these so a future "fix" for the alerts
cannot quietly remove them.

**`dashboard-part13.js:415` — client-side XSS.** Every interpolation in that panel goes
through `esc()`. CodeQL does not recognise it as a sanitizer.

---

## Accepted risk, recorded

- **6 SSRF findings** in `puppeteerRenderer.js`, `shared.js`, `twilio-provision.js`,
  `feeds.js`. Fetching dealer-supplied URLs is what inventory sync and feed import *are*;
  the product cannot exist without it. Mitigated at intake by `isSafeHttpUrl`. **Not fully
  solved:** a hostname that resolves to a private address after the check, or DNS rebinding,
  still gets through. That needs egress-level network controls, which is an infrastructure
  decision rather than a code one. **This is the largest remaining item.**
- **5 polynomial-regex findings.** All operate on inputs bounded by explicit caps
  (`.slice()` limits, the new CSV cap). Worth revisiting if any cap is ever removed.
- **11 rate-limiting findings** on authenticated, permissioned routes with no external cost.

---

## Verification

| | |
|---|---|
| Security regression tests | **15 new**, in `test/security-stabilization.test.js` |
| Full suite | **789/789** (was 774 — 15 added, 0 broken) |
| Acceptance gates | all six PASS |
| Migrations | none — this slice changed no schema |

**Timing-safe comparison was already correct everywhere** (`cron-auth.js`, `providers/*.js`,
`calendarSync.js`, `automation.js` all use `timingSafeEqual` with length checks). The Square
webhook verifies its signature before doing any work. Those were checked and needed nothing.

---

## What this slice did NOT do

CodeQL could not be re-run from here, and **the before/after counts by severity that the brief
asked for cannot be produced from this session.**

- `workflow_dispatch` and the re-run API both return 403 for this token.
- The code-scanning alerts API returns 403, so per-alert severities were never readable.
- **CodeQL does not run on `staging` pull requests at all.** It ran once, on PR #84, only
  because that PR was mistakenly opened against `main`. Every subsequent PR — #85 through #89,
  including this one — ran `backend` and nothing else.

That last point is the one worth acting on, and it is a **repository configuration issue, not
a code one**: all development flows through `staging`, so CodeQL currently scans none of it.
Findings would first appear at the `staging` → `main` promotion, which is the worst possible
moment to discover them. Someone with repo admin should extend the CodeQL default setup to
`staging` PRs. That is a deliberate hand-off, not something this slice changed.

The honest statement is therefore: **12 findings fixed, 24 classified as false positives with
reasons, 32 accepted with reasons — and no tool-verified "after" number.** Asserting one would
be inventing evidence.
