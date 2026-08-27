# MarketSync Discoverability Intelligence — Recommendations & Auto-Remediation Engine

> **Authority Document:** Operating specification and safety manual for MarketSync Discoverability Recommendations, automated safe remediation, pre-mutation snapshots, post-apply validation, and 1-click rollback.

---

## 1. Overview & Core Philosophy

MarketSync Discoverability Intelligence is not merely a diagnostic tool; it is an active **remediation operating system**. It bridges audit findings with deterministic actions to answer the essential questions for dealership operators:

- **What changed?** (Empirical metric, rank change, or crawler discrepancy)
- **Why does it matter?** (Search visibility, CTR loss, or voice/AI query capture)
- **What should we do?** (Plain-language action with structured target fields)
- **Can MarketSync fix it?** (Automated mutation handler vs. approval workflow vs. manual task)
- **Is it safe to apply automatically?** (Safety Engine evaluation and protected field verification)
- **What happened after the fix?** (Immediate post-apply DOM/JSON-LD validation check)
- **Can we undo it?** (Deterministic rollback using SHA-256 pre-mutation state snapshots)

```
Audit (Scheduled or On-Demand)
  ↓
Recommendation Generation & Finding Deduplication
  ↓
Risk & Execution Classification (Auto-Fixable | Approval Required | Manual)
  ↓
Safety Engine Gate (canAutoApplyRecommendation)
  ↓
Rollback Snapshot Creation (SHA-256 Checksum + Pre-mutation State)
  ↓
Mutation Execution (In-Database Page / Config / Manifest Mutation)
  ↓
Post-Apply Automated Validation (HTML DOM / JSON-LD / HTTP Route Status)
  ↓
[Pass] → Mark Validated & Compute Score Lift (+Score)
[Fail] → Immediate Safe Automatic Revert & Incident Logging
```

---

## 2. Three Execution Classes

Every recommendation belongs strictly to one of three execution tiers:

| Execution Class | Description | Examples | Eligible for *Apply All*? |
|---|---|---|---|
| **`AUTO-FIXABLE`** | Safe, low-risk, high-confidence (>= 80%) changes targeting unambiguous metadata, schema, and crawler guidance. | Missing/weak title tags, meta descriptions, image alt tags, verified JSON-LD FAQPage schemas, llms.txt generation, canonical normalization, heading hierarchy. | **YES** |
| **`APPROVAL_REQUIRED`** | High-impact changes that alter visible content layout, copy, redirects, or navigation. | Long-form buying guides, new page sections, CTA position changes, 301 redirects, navigation reorganization, schema entity modifications. | **NO** (Requires explicit dealer sign-off) |
| **`MANUAL` / `EXTERNAL`** | External platforms, outreach, or marketplace actions outside MarketSync API authority. | Chrome Web Store review acquisition, Google Business Profile external verifications, Apple Business Connect, backlink/PR outreach. | **NO** (Formatted as actionable task cards) |

---

## 3. Safety Engine & Protected Fields Guard

The safety policy `canAutoApplyRecommendation(rec)` evaluates every proposed action prior to execution:

### Strict Safety Criteria:
1. `execution_class === 'auto_fixable'`
2. `risk_level === 'low'`
3. `confidence >= 80`
4. Non-empty evidence and explicit `before` and `after` states.
5. Dealership ownership of the affected page/resource.
6. **Zero Protected Fields Affected**: The engine strictly blocks bulk execution on protected properties.

### Protected Fields (Require Explicit Sign-Off):
- **Pricing & Rates:** `price`, `msrp`, `incentives`, `discount`, `finance_rate`, `interest_rate`, `lease_terms`, `payment_claim`
- **Legal & Compliance:** `legal_disclaimer`, `privacy_policy`, `terms_of_service`, `accessibility_statement`, `oem_compliance`, `warranty_claim`
- **Core Dealership NAP:** `dealership_name`, `phone`, `address`, `city`, `zip_code`, `state`, `contact_email`
- **Destructive Directives:** `delete_page`, `merge_pages`, `noindex_directive`, `robots_disallow_all`, `redirect_high_traffic`
- **Promotional Positioning:** `homepage_hero_headline`, `homepage_hero_cta`

---

## 4. Rollback Subsystem & Pre-Mutation Snapshots

Before any mutation occurs, MarketSync captures an immutable rollback snapshot:

```javascript
{
  "id": "snap_1787818900000_a1b2c3d4",
  "dealership_id": "d_100",
  "recommendation_id": "rec_seo_missing_title_trucks",
  "resource_type": "dealer_site_pages",
  "resource_id": "page_trucks",
  "field": "meta_title",
  "previous_value": "Inventory | Apex Auto Gallery",
  "proposed_value": "Used Trucks for Sale in Welland, ON | Apex Auto Gallery",
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "actor_id": "user_admin_123",
  "actor_email": "admin@apexautogallery.com",
  "created_at": "2026-08-27T08:30:00Z"
}
```

### 1-Click Rollback (`POST /discoverability/recommendations/:id/revert`):
- Restores `previous_value` to the database/resource.
- Re-validates the restored state.
- Updates recommendation status to `reverted`.
- Records an immutable audit log entry in `audit_log` and `seo_history`.

---

## 5. Post-Apply Automated Validation Engine

Upon applying any change, MarketSync immediately tests the live resource:

- **Meta Tags / Titles:** Re-queries page record and confirms rendered DOM title/description matches proposed specification.
- **Schema JSON-LD:** Parses JSON syntax and validates standard schema.org structure (e.g. `FAQPage` contains `mainEntity` array with valid `Question` and `Answer` structures).
- **llms.txt / Sitemaps:** Confirms manifest generation and HTTP 200 route availability.
- **Broken Links:** Verifies destination URL returns HTTP 200 OK.

> **Failure Isolation:** If post-apply validation fails, MarketSync marks the status `failed`, immediately triggers automatic rollback to restore `previous_value`, records `error_message`, and preserves system stability.

---

## 6. "Apply All Safe Recommendations" Batch Pipeline

When dealership staff click **"Apply All Safe Recommendations"**:

1. **Eligibility Freeze:** Freezes open `auto_fixable` recommendations meeting all safety gates.
2. **Conflict Resolution:** Detects if multiple recommendations touch the same resource + field, prioritizing the higher-confidence action.
3. **Precondition Re-check:** Confirms live state matches expected `before` value.
4. **Snapshot Capture:** Prepares pre-mutation state snapshots for all items.
5. **Sequential Execution & Validation:** Applies each change and validates live result.
6. **Failure Isolation:** Any individual failure is safely rolled back without aborting remaining independent fixes.
7. **Score Recalculation:** Computes composite Discoverability score lift.
8. **Summary Modal:** Displays total successful fixes, 0 destructive changes, and score delta.

---

## 7. Dealership Automation Levels

Configurable under `Discoverability → Automation Settings`:

1. **Recommend Only (Default):** Generates ranked recommendations; no automatic mutations.
2. **Auto-Apply Safe Fixes (Recommended):** Automatically executes verified low-risk fixes after weekly audits and delivers an email diff summary.
3. **Rules-Based Automation:** Automatically applies safe recommendations matching selected categories (Quick Wins, AI Visibility, Technical).
4. **Manual Approval Required:** Requires explicit manager sign-off on all changes.

---

## 8. API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/discoverability/overview` | `GET` | Multi-pillar executive overview and composite scores. |
| `/discoverability/recommendations` | `GET` | List recommendations with status, pillar, and category filters. |
| `/discoverability/recommendations/:id` | `GET` | Single recommendation detail, before/after diff, snapshot metadata. |
| `/discoverability/recommendations/:id/apply` | `POST` | Single apply with snapshot creation and post-apply validation. |
| `/discoverability/recommendations/:id/approve` | `POST` | Approve `approval_required` recommendation. |
| `/discoverability/recommendations/:id/reject` | `POST` | Dismiss/reject recommendation. |
| `/discoverability/recommendations/:id/revert` | `POST` | Revert applied recommendation from rollback snapshot. |
| `/discoverability/recommendations/apply-all-safe` | `POST` | Batch apply all eligible safe recommendations. |
| `/discoverability/recommendations/revert-batch` | `POST` | Batch rollback of specified recommendation IDs. |
| `/discoverability/audit` | `POST` | Run comprehensive on-demand audit and update queue. |
| `/discoverability/sync` | `POST` | Refresh external telemetry (GSC, CWS, GBP). |
| `/discoverability/settings` | `GET` / `PUT` | Read and update dealership automation levels. |
| `/discoverability/reports/weekly` | `GET` | Weekly Discoverability report payload and digest. |
