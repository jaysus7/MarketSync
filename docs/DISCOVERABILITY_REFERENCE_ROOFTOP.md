# Reference rooftop readiness

What a real dealership needs in place before its Discoverability score means anything.

This is Batch 9 STEP 27. It exists because the corporate site is not a dealership: it has
no inventory, no service lane and no storefront, so a corporate Verified 100 proves the
platform is honest, not that it works on the thing it was built for. The first reference
rooftop is where that gets proven.

**Do not build a demo dealer site to score against it.** A site with invented inventory
produces invented evidence, and the whole point of the validation chain is that the proof
comes from a public response nobody staged.

## What "ready" means

A rooftop is ready to be measured when every row below is either connected and returning
real data, or explicitly marked `NOT_APPLICABLE` under a rule that describes the
dealership — not under a preference for a higher score. `corporateFactAudit.coverage()`
enforces that distinction; an exemption without a matching rule is reported as misuse and
put back into the denominator.

## Pages the crawler must be able to reach

Discoverability scores what it can fetch. A page behind a login, a JS-only route with no
server-rendered content, or a URL absent from the sitemap is not measured — it is missing.

| Page | Why it is scored separately |
|---|---|
| Homepage | Entity facts, Organization/LocalBusiness schema, primary internal links |
| New SRP | Indexable facets, pagination, canonical discipline |
| Used SRP | Same, plus inventory freshness signals |
| VDP | The template that multiplies: Vehicle schema, VIN, price, availability, images |
| Make/model pages | Whether strategic pages exist at all, and whether anything links to them |
| Service | Service-department entity facts, booking path |
| Parts | Often orphaned; frequently the only page with no inbound links |
| Finance | Application path, disclosure content |
| Trade / appraisal | Conversion path distinct from the deal path |
| Staff | Person entities; a common source of stale facts |
| Reviews | Ratings may be marked up **only** where genuinely earned and visible |
| Offers / specials | Expiry discipline: a lapsed offer in schema is a false claim |
| Blog / resources | Answer-ready content for AEO |
| Contact | NAP consistency against Google Business Profile |

For a bilingual market, EN and FR are separate measured surfaces with their own
`hreflang`, canonicals and schema. A French page canonicalising to its English twin is the
same defect as a product page canonicalising to another product.

## Machine-readable identity

- `robots.txt` — search and training crawler policy stated explicitly, sitemap referenced.
  Blocking a training crawler is a legitimate choice and is not scored as a failure.
- `sitemap.xml` — canonical public URLs only. No login, no account pages, no redirect
  stubs, no URL that canonicalises elsewhere.
- `llms.txt` — current products, current positioning, authoritative URLs, and **no
  duplicated prices**. Link the pricing page instead. This is the file that goes stale
  first, because nothing renders it.
- Structured data — Organization or AutoDealer, WebSite, Vehicle on VDPs, Offer only where
  the price is visible on the page. No invented `sameAs`, no unearned ratings, no `price: 0`.

## Providers that gate Evidence Coverage

Controllable quality can reach 100 without any of these. Evidence Coverage cannot.

| Provider | Gates | Without it |
|---|---|---|
| Google Search Console | Search pillar: queries, impressions, CTR, position | `not_connected` — the pillar is unmeasured, not zero |
| Bing Webmaster / IndexNow | Submission of validated changes | Submission unavailable; submitting is never proof of indexing |
| Google Business Profile | Local pillar: NAP, hours, local rank evidence | `not_connected` |
| A real AI benchmark provider | GEO citation and factual accuracy | `not_measured`; synthetic runs never count as live |
| First-party conversion tracking | SXO funnel | Uninstrumented stages are `not_instrumented`, never `measured_zero` |
| DMS / CRM revenue join | Vehicle and service attribution | Attribution incomplete; gross and revenue stay `not_measured` |
| Field CWV (CrUX or RUM) | Performance | Lab Lighthouse numbers may not be reported as real-user data |

## Order of operations

1. Connect the providers first. Fixing before measuring means no baseline to prove against.
2. Take the baseline crawl and persist it — quality, coverage, per-pillar, and severity
   counts. A number with no starting point is a claim, not a result.
3. Work the findings through the Batch 8 lifecycle: detected → recommendation → risk →
   approval or auto-fix → change set → publish → validation job → public recrawl →
   validated → resolved. Never mark a finding fixed by hand; a deployment alone does not
   resolve anything, and the platform enforces that.
4. Re-crawl and compare. A finding that returns is a regression, not a new finding.
5. Report the outcome as it is: `verified_100` only when quality, coverage, criticals,
   highs and validation failures all clear. Otherwise `controllable_quality_100` with the
   provider blockers named.

## What must never happen

- Special-casing a hostname so the reference rooftop scores better.
- Marking a check `NOT_APPLICABLE` because it is inconvenient. Crawlability, metadata,
  structured data, entity facts and search performance apply to every dealership.
- Counting synthetic benchmark runs toward live coverage.
- Reporting zero conversions from a funnel that was never instrumented.
- Publishing a fix and calling the finding resolved before the public recrawl agrees.
