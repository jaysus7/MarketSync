# MarketSync Blog — Feature-Truth Audit

Purpose: make sure every "MarketSync does X" blog post maps to a **shipped** feature, so
content brings trials that convert instead of leads that churn on a broken promise.

Only **feature-claim** topics are audited here. Pure how-to / opinion / SEO / ROI / competitor
posts don't assert a product capability, so they carry no truth risk and aren't listed.

**Legend**
- ✅ **Ships** — claim it as fact. Code evidence given.
- 🟡 **Partial / reframe** — real but not exactly as the title implies; adjust the angle.
- 🔴 **Roadmap** — does NOT ship today. Do not publish as a product claim; cut or reframe as opinion.

---

## 🔴 Truth-risk flags — fix these before publishing

| ID | Topic | Problem | Fix |
|----|-------|---------|-----|
| 127 | AI Answers Marketplace Messages 24/7 | There is **no** FB Marketplace messaging API — you can't auto-answer Marketplace DMs. BUT you **do** have an AI website chat concierge (`/site/:slug/chat`) that answers from live inventory, and SMS/email lead follow-up. | Reframe to **"AI answers buyer questions 24/7 on your dealership website"** + "auto-follows-up on every lead by text/email." Both are real. Drop "Marketplace." |
| 166 | Which Vehicles Get the Most Marketplace Clicks? | Facebook does **not** expose per-listing Marketplace click/view data to third parties. You can't report it. | Reframe to on-lot signals you *do* have: **market demand (hot/cold), days-on-lot, message/lead volume in your CRM.** |
| 159 | Vehicles Receiving Messages But No Appointments | Same issue — you don't have Marketplace message counts per vehicle. | Reframe to CRM-side: **leads with no booked appointment** (you have appointment data in the pipeline). |
| 134 | Landing Pages for Every Manufacturer Automatically | Not built. Website builder exists (`routes/site.js`) but no auto OEM landing-page generator. | Move to **roadmap** or write as SEO opinion, not a MarketSync feature. |
| 135 | Dealer Incentive Pages Improve Rankings | Not built. | Roadmap / opinion only. |
| 139 | VIN-Based Pages Improve SEO | VIN **decode** ships; per-VIN indexable landing pages do not. | Roadmap / opinion only. |
| 173 | Automating Vehicle Price Changes | Repricing **rules + flags** exist (`repricing_rules`, the new ok/raise/lower verdict), but MarketSync **surfaces** the change — it doesn't auto-rewrite the price. | Reframe to **"automated repricing signals / recommendations"**, not "automatic price changes." |

---

## ✅ Ships — claim these as fact (with code evidence)

**Posting & inventory**
- Connect to DMS feed / auto-detect (EDealer, UX Auto, LeadBox…) — `sync/platforms.js`, `sync/genericFeed.js` (#1, #82, #89, #113)
- Chrome extension, no IT setup — `marketplace-extension/` (#2)
- Field-by-field FB listing build — `content.js` `fillListingForm` (#34)
- Proxy image system (fast, un-throttled photos) — `/proxy-image` (#12, #30)
- Auto-remove / auto-delist sold cars — engine auto-sold + archive, extension FB sync action (#10, #44, #121)
- Sold / leased / AS-IS handled differently — status logic in sync (#47)
- Condition filters ("post only what you want") — condition pills (#62, #110)
- Inventory update sync (price, mileage, photos — not just new) — upsert path in `sync/engine.js` (#123, #174)
- Automatic inventory refresh / renewals — nightly sync + relist (#175, #201)
- Smart inventory filters — catalog filters (#202)

**People & accountability**
- Per-rep listings / role-based access (reps see only their own) — `posted_by`, role scoping (#28, #32, #120, #200)
- Bronze / Silver / Gold leaderboard + gamification — leaderboard (#31, #96, #199, #162)
- Audit trail of listing actions — `audit.js` (#68)

**AI & intelligence**
- AI writes vehicle descriptions / pitches — `/ai/enrich-listing` (#126, #130, and #17/#40 as craft)
- Marketplace/vehicle Health Score — AI Boost per-vehicle score (#198)
- AI website sales-chat concierge (answers from live inventory) — `/site/:slug/chat` (#127 reframed)
- AI market price report + trade appraisal — `/ai/price-report`, appraisals (#196)

**CRM, leads & automation**
- Website builder w/ lead capture (no WordPress) — `routes/site.js`, `routes/blog.js` (#131, #132, #140)
- CRM automates follow-up (not just reminders) — `routes/automation.js`, `drip.js` (#141, #145)
- Auto-assign / route leads, kill cherry-picking — `lead-routing.js` (#142, #143, #147)
- Automated texting (90-sec speed-to-lead + drip) — `automation.js` `channel:'sms'` sequences (#144, #150)
- Stripe billing, no long-term contract — `routes/billing.js` (#7)

**Reporting** — role dashboards (dealer / manager / salesperson), aging + activity — `routes/dashboard.js`, `routes/groups.js` (#156–158, #160, #163–165, #203–205). *Exclude the two Marketplace-click ones flagged above.*

---

## 🟡 Reframe slightly (real, but tighten the claim)

- #133 "Drag-and-drop builder" — confirm the editor is truly drag-drop before claiming it; if not, say "no-code site builder."
- #136 "Inventory pages that rank on Google" — you have inventory pages; the *ranking* is an outcome, not a guarantee. Write as best-practice, not a promise.
- #155 "Track every lead source automatically" — verify source attribution is captured end-to-end before claiming "every."
- #197 "Identifies duplicate inventory automatically" — VIN de-dupe happens on sync (`onConflict: 'vin'`); if there's no *surfaced* duplicate report, frame as "prevents duplicates" not "identifies/flags them for you."

---

## Cluster map (pillar + supporting) — publish in this structure, not randomly

Google rewards topical authority. Group the 226 into ~14 pillars; each pillar is one big page,
supporting posts link up to it and to each other.

1. **Facebook Marketplace for Dealers: Complete Guide** → #4, #10, #16, #30, #55, #74, #102, #122…
2. **Inventory Pricing & Market Intelligence** → price report, verdict, #168, #170, #26, #75…
3. **Dealership CRM & Lead Follow-Up** → #141–150, #151–155, #56, #64…
4. **Automation & the Connected Dealership** → #171–180, #181–185…
5. **AI for Car Dealers** → #126–130, website chat, description AI…
6. **Dealer Websites & SEO** → #131–140 (minus the roadmap ones), #211–215…
7. **Reporting & Analytics for GMs** → #156–170 (minus click-data ones)…
8. **Reconditioning & Speed-to-Market** → *(new pillar — pairs with the recon module being built)*
9. **ROI & The Cost of Manual Work** → #216–220, #58, #80, #98…
10. **Competitor / Category** → #206–210, #14, #15…
11. **Gamification & Rep Adoption** → #31, #96, #199, #200…
12. **Multi-Location / Dealer Groups** → #45, #52, #92, #192…
13. **Compliance & Account Health** → #83, #8, #21, #30…
14. **Case Studies** → #221–225, #51…

Each supporting post links to its pillar; each pillar links to 6–10 supporting posts. Same 226
articles, far more traffic.
