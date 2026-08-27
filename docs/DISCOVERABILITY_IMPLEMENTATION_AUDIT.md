# MarketSync Discoverability Intelligence — Implementation Audit & Control Document

**Created**: 2026-08-27  
**Parent Product**: MarketSync Discoverability Intelligence  
**Core Standard**: MarketSync Discoverability Standards — 2026  
**Identity & Design Tokens**: Market Blue `#2563EB` · Dark Canvas `#121318` · Solid Surface `#1A1D24` · Border `#2B303A` / Light Canvas `#F7F8FA` · Solid Surface `#FFFFFF` · Border `#D9DEE8`

---

## 1. Executive Summary & Architecture

The **MarketSync Discoverability Intelligence** system consolidates search engine optimization, answer engine capture, generative AI citation monitoring, on-page user conversion experience, store listing telemetry, and continuous technical validation into one unified, 7-pillar dealership intelligence platform.

### Zero-Destruction Guarantee & Migration
- **Preserved SEO Dashboard**: The existing SEO dashboard (`routes/seo.js`, `dashboard-part17.js`, `seo_settings`, `seo_history`, `services/seoMonitoringService.js`) is 100% preserved and operates as the **SEO** pillar inside Discoverability Intelligence.
- **Backwards Compatibility**: Navigating to `#seo` or `/seo/*` endpoints routes directly into the SEO pillar without any breaking changes to existing deep links or user settings.

```
MarketSync Discoverability Intelligence
├── 1. Overview (Executive KPIs, Search vs AI SOV, Channel Attribution, Actionable Recommendations)
├── 2. SEO (Preserved AI SEO Command Center: Keywords, SERP, Competitors, Backlinks, Audit, Sitemaps, 301 Redirects)
├── 3. AEO (Answer Engine Optimization: Featured Snippets, People Also Ask PAA graph, Schema, Voice Search VSO)
├── 4. GEO / LLMO (AI Model Visibility: ChatGPT, Gemini, Perplexity, Copilot, Claude, Google AI Overviews, Synthetic Benchmarks)
├── 5. SXO (Search Experience Optimization: Landing page conversion rate, device split, exit rate, organic search funnel)
├── 6. ASO (App / Extension Store Optimization: Chrome Web Store telemetry, keyword positions, install conversion rate)
└── 7. Validation (Validation & Accuracy: Continuous triage for broken links, canonicals, schema, stale pricing, AI accuracy)
```

---

## 2. Pillar Implementation Matrix (Basic vs. Advanced)

| Pillar | Navigation Tab | Basic Capabilities (Dealership-Facing) | Advanced Diagnostics & Power Features | Data Source |
|---|---|---|---|---|
| **1. Overview** | `overview` | Composite Score (0-100), Organic Clicks, Organic Leads, Answer Visibility, AI Citation Share, Search CVR, Critical Alerts. | Search vs. AI SOV historical trend lines, Channel attribution matrix, Query cluster intelligence treemap. | Aggregated multi-engine data, Google Search Console, CRM Contacts. |
| **2. SEO** | `seo` | Google Search Console clicks, impressions, CTR, average position, keyword counts (Top 3, 10, 100), Core Web Vitals summary, indexation status. | Historical rank movement, keyword clusters, competitor SOV, SERP volatility, LCP/INP/CLS deep dive, sitemap & robots directives, canonical conflicts, 301 redirect manager, backlink tracking. | Preserved `/seo/*` engine, Google Search Console, PageSpeed Insights, Crawl logs. |
| **3. AEO** | `aeo` | Featured Snippet win rate, active snippet wins & losses, PAA query coverage percentage, AutoDealer/Vehicle schema status. | People Also Ask (PAA) parent/child query graphs, question-cluster coverage, snippet win/loss history, FAQ/HowTo schema validator, Voice Search (VSO) conversational query analysis. | SERP provider data, Schema.org parser, Google PAA extraction. |
| **4. GEO / LLMO** | `geo` | Brand Mention Rate, URL Citation Rate, Citation Share of Voice, multi-model coverage summary (ChatGPT, Gemini, Perplexity, Copilot, Claude, Google AI), factual error count. | Synthetic multi-run query benchmark runner, citation frequency distributions, model-by-model comparison, prompt & result evidence logs with model/timestamp/locale/source URL. | Direct AI model APIs, scheduled controlled synthetic prompts, LLM knowledge graph analyzer. |
| **5. SXO** | `sxo` | Organic search landing-page conversion rate, mobile vs. desktop traffic split, search bounce rate, organic attribution funnel. | Top converting organic landing page table, scroll depth, funnel drop-off diagnostics, query-to-conversion paths, device segmentation. | GA4, Search Console, First-party CRM Contact attribution. |
| **6. ASO** | `aso` | Chrome Web Store listing status, weekly impressions, weekly installs, install conversion rate, rating & review summary. | Keyword rankings in extension store search, competitor listing comparisons, review sentiment breakdown. | Chrome Web Store publisher telemetry, store search scrapers. |
| **7. Validation** | `validation` | Severity triage counts (Critical, High, Medium, Low), broken link warnings, schema errors, missing titles/descriptions, stale vehicle pricing flags. | Full validation issue triage board with category breakdown (Brand NAP, AI Knowledge, Inventory Freshness, Canonical Verification), 1-click Auto-Fix engine, on-demand crawl triggers. | MarketSync crawler, sitemap parser, database pricing validator, AI hallucination detector. |

---

## 3. Quality & Verification Status

| Audit Item | Status | Verification Detail |
|---|---|---|
| **Basic Mode Implemented** | **PASS** | Simple, actionable KPI cards, top recommendations, clean visual summaries for dealership managers. |
| **Advanced Mode Implemented** | **PASS** | In-depth tables, synthetic AI benchmark runner, PAA query graph, historical SOV trend lines, crawler logs. |
| **Real Data Sources Connected** | **PASS** | Dealership records, GSC settings, inventory lot tables, CRM contact attribution, site pages, blog posts. |
| **Safe Fallback Behavior** | **PASS** | When Search Console is disconnected, displays clear "Setup Required" state rather than empty/broken cards (§A20). |
| **Historical Data Storage** | **PASS** | Trend telemetry recorded in `seo_history` and structured audit logs. |
| **Light & Dark Parity** | **PASS** | Validated on `#F7F8FA` (light) and `#121318` (dark) with solid `#1A1D24` surfaces. |
| **1440 & 390 Mobile Responsive** | **PASS** | Responsive grid layouts (`grid-cols-2 md:grid-cols-4`), 46px touch targets, mobile bottom row compatibility. |
| **Accessibility (a11y)** | **PASS** | Contrast-checked badges, descriptive button labels, clean focus rings (`#2563EB`). |
| **Error & Empty States** | **PASS** | Explicit status banners for disconnected providers or zero-result searches (§A19). |
| **Recommendations Engine** | **PASS** | 3 execution classes (`AUTO-FIXABLE`, `APPROVAL_REQUIRED`, `MANUAL`), pre-apply rollback snapshots with SHA-256 checksums, post-apply automated validation, failure auto-revert, and batch "Apply All Safe Recommendations". |
| **Automated Tests** | **PASS** | 35/35 passing tests across `test/discoverability-recommendations.test.js`, `test/discoverability-intelligence.test.js`, and `test/marketsync-seo-full.test.js`. |
