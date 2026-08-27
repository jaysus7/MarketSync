# MarketSync Brand & UI Route Audit

**Control document** for the brand migration. Created 2026-08-26. Identity lock: MarketSync / DealerOS by MarketSync / One dealership. One system. / Market Blue `#2563EB`.


## Open STATE / ROUTE defects (do not drop)

| ID | Defect | Class | Status |
|---|---|---|---|
| D001/D002 | Department Pulse often captures as “Loading…” | STATE | Open — retry later, do not stall queue |
| D003 | `#/w/sales/crm` settles on Sales Pulse (`#/w/sales/sales`) | STATE/ROUTE | Open — not accepted |

This file is the definition of “every page is done.” A surface is done only at **95/100 PASS** with no automatic-fail defects.

## Method

- Inventory from every `marketplace-frontend/*.html`, `sitemap.xml`, `dashboard.html` `[data-page-content]`, `workspace-registry.js` `MS_WORKSPACES`, `SAAS_DEPARTMENTS`, modal/drawer IDs, and known overlays from this engagement.
- **Visually inspected this pass:** `https://marketsync.link/` desktop (1920px) live screenshot.
- **Source-inspected this pass:** `login.html`, theme tokens, workspace accents, logo filenames.
- **Authenticated DealerOS / HQ:** not logged in this hour. Scores use source + prior staging screenshots from the ongoing redesign thread. **None of those rows are PASS.**
- Automatic fail criteria applied: old/alternate logo files, department rainbow accents still in registry, unreadable or inconsistent dark mode reported on multiple tools, mobile nav regressions.

### Score weights

Brand 20 · Color 15 · Logo 10 · Typography 10 · Liquid Glass 15 · Components 10 · Light/Dark 10 · Responsive 5 · Accessibility 5 = 100

Subscore columns in the table are written `B/C/L/T/G/Cmp/LD/M/A`.

## Summary

| Metric | Count |
|---|---|
| User-facing surfaces discovered | **167** |
| Public | 54 |
| Authenticated (DealerOS + HQ + overlays) | 113 |
| PASS (95+) | **0** |
| NEEDS WORK | **164** |
| BLOCKED | **3** |
| Average score (excluding BLOCKED) | **60.8** |

### Lowest-scoring scored surfaces

- `/watch.html` — **46** (Public orphan)
- `/post.html` — **46** (Public orphan)
- `/site.html` — **46** (Public orphan)
- `/group.html` — **46** (Public orphan)
- `/chat-widget.html` — **53** (Embed)
- `Customer card / workspace drawer` — **55** (Modal/drawer)
- `Notification panel` — **55** (Drawer)
- `Team chat dock` — **55** (Overlay)
- `AI assistant dock` — **55** (Overlay)
- `Appointment modal` — **55** (Modal)
- `Upgrade modal` — **55** (Modal)
- `Staff / employee modal` — **55** (Modal)

### Most common violations (systemic)

1. **No single canonical logo path.** Repo still ships `logo.png`, `logo-light.png`, `logo-dark.png`, `Logo 2.0.png`, `Logo 2.1.png`, plus `assets/marketsync-logo-*.svg`. Login uses Logo 2.0/2.1. Homepage uses a marketing wordmark. Brief requires one approved angular M/S monogram in `assets/brand/`.
2. **Color system conflict.** Theme defines `--ms-blue-500: #2563EB` and also `--ms-accent: #7c3aed`. Workspace registry still assigns **amber / emerald / violet / sky** department accents. Tailwind `indigo-*` is used instead of Market Blue tokens on forms and buttons.
3. **CSS ownership sprawl.** `ms-design-system.css`, `marketsync-theme.css`, `tailwind-built.css`, dashboard nav CSS, plus page-local `<style>` blocks (homepage). Repaint layers still fight specificity.
4. **Typography drift.** Brief locks Manrope + Inter. Login loads **Satoshi** from Fontshare. Engine titles in theme still declare Satoshi/system stacks.
5. **Liquid Glass hierarchy is inverted on many DealerOS tools.** Content cards and customer records were over-glassed; nav/menus are inconsistent Layer 3. Public site nav is flat white (acceptable if intentional, but not the shared glass primitive).
6. **Component forks.** Buttons, inputs, modals, and tables are re-implemented per workspace (Pulse cards vs raw Tailwind vs engine cards vs HQ tables).
7. **Light/dark holes.** Login even documents a past dark-mode class bug. Prior screens: dark customer-card chrome in light mode; Deal a Deal too bright; email builder without dual theme.
8. **Mobile shell instability.** Bottom nav labels, clock-in placement, and single-product dashes failed repeatedly in staging QA.
9. **Copy drift on public SEO pages.** Facebook Marketplace poster pages still sell a posting app, not a dealership OS.

## Audit table

| ID | Route / Surface | Area | Pub/Auth | B/C/L/T/G/Cmp/LD/M/A | Score | Status | Inspected | Notes |
|---|---|---|---|---|---|---|---|---|
| P001 | / (index.html) | Public home | Public | 18/14/7/9/10/9/8/4/4 | **83** | NEEDS WORK | visual-desktop | Desktop inspected. OS positioning and Market Blue CTAs are correct. Logo is marketing wordmark (not locked canonical assets/brand files). Public nav is opaque white, not Layer-3 glass. Ask MarketSync FAB uses purple-leaning indigo. Dark mode not verified on this capture. |
| P002 | /pricing.html | Public | Public | 16/13/7/8/8/8/7/3/4 | **74** | NEEDS WORK | source+sitemap | Shares public shell; product ladder names look current. Not fully screenshot-audited at all breakpoints. Logo file family still Logo 2.x. |
| P003 | /features.html | Public | Public | 15/12/7/8/8/8/7/3/3 | **71** | NEEDS WORK | source | Public shell family. Feature grid likely still mixes product-silo landing patterns. |
| P004 | /compare.html | Public | Public | 15/12/7/8/8/8/7/3/3 | **71** | NEEDS WORK | source | Compare template; not visually opened this pass. |
| P005 | /dealer-os.html | Public product | Public | 16/12/7/8/8/8/7/3/3 | **72** | NEEDS WORK | source | Flagship product page. Must stay DealerOS by MarketSync, not a rainbow department brochure. |
| P006 | /marketsync-digital.html | Public product | Public | 16/12/7/8/8/8/7/3/3 | **72** | NEEDS WORK | source | Digital suite landing. |
| P007 | /intelligence.html | Public product | Public | 15/12/7/8/8/8/7/3/3 | **71** | NEEDS WORK | source | Intelligence product page. |
| P008 | /marketing-suites.html | Public product | Public | 15/12/7/8/8/8/7/3/3 | **71** | NEEDS WORK | source | Suites landing. |
| P009 | /design-studio.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P010 | /social-scheduler.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P011 | /video-studio.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P012 | /campaigns.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P013 | /ai-chatbot.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P014 | /dealer-website.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | Standalone product SEO page — historically siloed templates; risk of Marketplace-era layout. |
| P015 | /marketsync-seo.html | Public product | Public | 13/11/6/7/7/7/6/3/3 | **63** | NEEDS WORK | source | SEO product page — historically siloed templates; risk of Marketplace-era layout. |
| P016 | /facebook-marketplace-poster.html | Public product | Public | 10/10/6/7/6/6/6/3/3 | **57** | NEEDS WORK | source+sitemap-copy | Copy still Marketplace-poster primary. Conflicts with OS positioning. Automatic brand-identity penalty. |
| P017 | /facebook-autoposter.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P018 | /dealer-inventory-sync.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P019 | /sales-pipeline.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P020 | /sales-leaderboard.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P021 | /ai-listing-copy.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P022 | /market-price-reports.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P023 | /inventory-intelligence.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P024 | /vin-decoder-window-stickers.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P025 | /ai-vision-photo-scoring.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P026 | /dealer-groups.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P027 | /crm-lead-delivery.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P028 | /facebook-posting-safety.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P029 | /marketsync-vs-shiftly-auto.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P030 | /deal-desk.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P031 | /trade-appraisal.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P032 | /automation-followups.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P033 | /equity-mining.html | Public SEO/legacy | Public | 11/10/6/7/6/6/6/3/3 | **58** | NEEDS WORK | source+sitemap | Legacy/feature SEO landing. High probability of old template + Facebook-first framing. |
| P034 | /guide.html | Public docs | Public | 14/11/6/7/6/7/6/3/3 | **63** | NEEDS WORK | source | Long-form guide; type scale and logo family unverified at mobile. |
| P035 | /marketsync-guide.html | Public docs | Public | 13/11/6/7/6/6/6/3/3 | **61** | NEEDS WORK | source | Likely duplicate guide surface (orphan risk). |
| P036 | /blog.html | Public | Public | 14/12/7/8/7/7/6/3/3 | **67** | NEEDS WORK | source | Blog index. |
| P037 | /faq.html | Public | Public | 14/12/7/8/7/7/6/3/3 | **67** | NEEDS WORK | source | FAQ. |
| P038 | /support.html | Public | Public | 14/12/7/8/7/7/6/3/3 | **67** | NEEDS WORK | source | Support. |
| P039 | /security.html | Public legal/trust | Public | 15/12/7/8/7/8/6/3/4 | **70** | NEEDS WORK | source | Trust page; content-heavy. |
| P040 | /terms.html | Public legal | Public | 14/12/7/8/6/7/6/3/4 | **67** | NEEDS WORK | source | Legal typography often falls back to system fonts. |
| P041 | /privacy-policy.html | Public legal | Public | 14/12/7/8/6/7/6/3/4 | **67** | NEEDS WORK | source | Same legal family as terms. |
| P042 | /workflow.html | Public | Public | 13/11/6/7/6/6/6/3/3 | **61** | NEEDS WORK | source | Workflow marketing page. |
| P043 | /affiliates.html | Public | Public | 13/11/6/7/6/6/6/3/3 | **61** | NEEDS WORK | source | Affiliate program marketing. |
| P044 | /affiliate.html | Public | Public | 12/11/6/7/6/6/6/3/3 | **60** | NEEDS WORK | source | Possible duplicate of affiliates.html. |
| P045 | /upgrade.html | Public/auth hybrid | Public | 12/11/6/7/6/6/6/3/3 | **60** | NEEDS WORK | source | Upgrade/paywall marketing. |
| P046 | /demo.html | Public | Public | 13/11/6/7/6/6/6/3/3 | **61** | NEEDS WORK | source | Demo request/entry. |
| P047 | /training.html | Public | Public | 12/11/6/7/6/6/6/3/3 | **60** | NEEDS WORK | source | Training marketing vs in-app Academy. |
| P048 | /watch.html | Public orphan | Public | 8/8/5/6/4/5/5/2/3 | **46** | NEEDS WORK | source | Orphan HTML; not in primary nav. |
| P049 | /post.html | Public orphan | Public | 8/8/5/6/4/5/5/2/3 | **46** | NEEDS WORK | source | Orphan HTML. |
| P050 | /site.html | Public orphan | Public | 8/8/5/6/4/5/5/2/3 | **46** | NEEDS WORK | source | Orphan HTML. |
| P051 | /group.html | Public orphan | Public | 8/8/5/6/4/5/5/2/3 | **46** | NEEDS WORK | source | Orphan HTML. |
| P052 | /chat-widget.html | Embed | Public | 10/10/4/6/5/6/6/3/3 | **53** | NEEDS WORK | source | Embeddable widget; must inherit brand tokens, not a third palette. |
| P053 | /esign.html | Public/auth hybrid | Public | 12/11/6/7/6/6/6/3/3 | **60** | NEEDS WORK | source | eSign receiver surface. |
| A001 | /login.html | Auth | Auth | 14/12/5/6/6/7/8/4/4 | **66** | NEEDS WORK | source-inspected | Source inspected. Warm White/Graphite tokens present. Logo files are /Logo 2.0.png and /Logo 2.1.png (not canonical assets/brand). Loads Satoshi from Fontshare. Buttons/focus use Tailwind indigo, not tokenized Market Blue. Form radius not on central control spec. Heading says “Log in to DealerOS”. |
| A002 | /register.html | Auth | Auth | 13/12/5/6/6/7/7/4/4 | **64** | NEEDS WORK | source | Same auth family as login; expect same logo/font drift. |
| A003 | /forgot-password.html | Auth | Auth | 13/12/5/6/6/7/7/4/4 | **64** | NEEDS WORK | source | Auth family. |
| A004 | /reset-password.html | Auth | Auth | 13/12/5/6/6/7/7/4/4 | **64** | NEEDS WORK | source | Auth family. |
| A005 | /verify.html | Auth | Auth | 12/11/5/6/5/6/7/3/3 | **58** | NEEDS WORK | source | Verification interstitial. |
| D000 | dashboard.html shell (header, dept nav, mobile bar) | DealerOS shell | Auth | 14/9/6/7/9/7/7/3/3 | **65** | NEEDS WORK | source+prior-screens | Shared authenticated chrome. Multiple CSS owners (marketsync-theme, ms-design-system, tailwind-built, dashboard-nav). Workspace accents still amber/emerald/violet/sky. Header gear recently restored. Mobile nav has broken repeatedly in this project. Glass applied unevenly (too much on content cards historically). Not marked PASS — no fresh authenticated screenshot this audit hour. |
| D001 | #command / My Day Pulse | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D002 | #sales Sales Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D003 | #crm Customers | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D004 | #appointments | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D005 | #tasks | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D006 | #leads | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D007 | #appraisal Appraise Trade | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D008 | #inventory-overview Inventory Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D009 | #inventory Vehicles | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D010 | #equity Equity Mining | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D011 | #market Market & Competitors | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D012 | #recon Cleanup | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D013 | #fni-overview F&I Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D014 | #fni Deals | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D015 | #desk Desk a Deal | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D016 | #delivery | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D017 | #service-overview Service Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D018 | #service-appointments | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D019 | #service-ros Repair Orders | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D020 | #parts-overview Parts Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D021 | #service-parts Catalogue | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D022 | #accounting-overview Accounting Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D023 | #accounting | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D024 | #commissions Payroll | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D025 | #marketing-overview Marketing Pulse | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D026 | #social-scheduler | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D027 | #studio Design Studio | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D028 | #email-marketing Campaigns | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D029 | #website | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D030 | #seo | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D031 | #video-studio | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D032 | #ai-home AI Chat | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D033 | #ai-inbox | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D034 | #inventory Facebook publish mode | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D035 | #people-overview HR Pulse | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D036 | #sales-team Employees | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D037 | #people-compliance | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D038 | #academy | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D039 | #leaderboard | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D040 | #operations | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D041 | #taskboard | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D042 | #reports | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D043 | #profile Settings/Account | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D044 | #config Settings hub | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D045 | #automation-builder | DealerOS | Auth | 12/8/6/7/8/6/6/3/3 | **59** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D046 | #api-keys Integrations | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D047 | #website-settings | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D048 | #inv-intel | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D049 | #vin-sticker | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D050 | #ai-vision | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D051 | #solo-home | DealerOS product | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D052 | #launch | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| D053 | #insights | DealerOS | Auth | 13/9/6/7/8/7/7/3/3 | **63** | NEEDS WORK | source+prior-screens | Authenticated surface. Scored from registry + theme source + prior staging screenshots in this engagement (Pulse/card/header drift, department accent colors still in MS_WORKSPACES). Not PASS — no live authenticated visual this hour. |
| H001 | #saas-command HQ Overview | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H002 | #saas-customers Dealerships / 360 | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H003 | #saas-trials | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H004 | #saas-onboarding | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H005 | #saas-followups Health | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H006 | #owner-users Accounts & access | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H007 | #saas-all-users | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H008 | #saas-roles | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H009 | #saas-employees | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H010 | #saas-billing | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H011 | #saas-accounting Company money | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H012 | #saas-products Catalog | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H013 | #saas-entitlements | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H014 | #saas-flags | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H015 | #saas-usage | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H016 | #saas-integrations | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H017 | #saas-automation Support | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H018 | #saas-audit | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H019 | #saas-security | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H020 | #saas-health | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H021 | #saas-funnel | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H022 | #saas-studio | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H023 | #saas-website | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H024 | #saas-email-marketing | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| H025 | #affiliates-admin | MarketSync HQ | Auth | 12/10/6/7/7/7/7/3/3 | **62** | NEEDS WORK | source | HQ command center recently expanded functionally. Visual system is dashboard shell + ad-hoc cards, not a finished HQ material spec. No authenticated visual this hour. |
| O001 | Customer card / workspace drawer | Modal/drawer | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O002 | Notification panel | Drawer | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O003 | Team chat dock | Overlay | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O004 | AI assistant dock | Overlay | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O005 | Appointment modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O006 | Upgrade modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O007 | Staff / employee modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O008 | Service check-in walkaround worksheet | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O009 | Service check-out modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O010 | Quick trade / appraisal handoff | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O011 | Desk a Deal modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O012 | HQ Customer 360 drawer | Drawer | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O013 | HQ billing drawer | Drawer | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O014 | HQ command palette (Ctrl/K) | Overlay | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O015 | Website builder chrome | Tool chrome | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O016 | Design Studio chrome | Tool chrome | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O017 | Video studio / teleprompter | Tool chrome | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O018 | Social scheduler overlays | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O019 | Email designer | Tool chrome | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O020 | Automation builder canvas | Tool chrome | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O021 | Dept setup wizard modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O022 | Things to know modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O023 | Badge reveal modal | Modal | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O024 | Clock-in / shift dropdown | Header control | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O025 | Mobile bottom nav + more sheet | Mobile-only | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| O026 | Report rail | Drawer | Auth | 11/8/5/6/7/6/6/3/3 | **55** | NEEDS WORK | source+prior-screens | Overlay/tooling. Historical defects: dark modal in light mode, glass on content, unbranded buttons, mobile action overflow. Customer card and Deal a Deal flagged in prior screenshots. |
| G001 | Single-product dash (Design Studio / AutoPoster / Video / Website / Chatbot / Digital) | Product gate | Auth | 12/9/6/7/7/6/6/2/3 | **58** | NEEDS WORK | prior-screens | Same shell, restricted nav. Mobile labels and missing settings gear were recurring defects. |
| B001 | Stripe Customer Portal (external) | Billing | Auth | 0/0/0/0/0/0/0/0/0 | **0** | BLOCKED | external | Third-party Stripe hosted UI. Cannot restyle to MarketSync tokens. HQ opens it by design. |
| B002 | Chrome Web Store extension listing | Extension | Public | 0/0/0/0/0/0/0/0/0 | **0** | BLOCKED | external | Google-hosted. Brand assets must be updated in store listing separately. |
| B003 | Academy third-party player if still framed | Academy | Auth | 0/0/0/0/0/0/0/0/0 | **0** | BLOCKED | external-if-present | If any remaining Kajabi/external iframe is live, visual control is outside the repo. In-app academy page itself is D038 NEEDS WORK. |

## Priority queue (remediation order)

Do **not** start another department Pulse repaint while P0 remains open.

### P0 — shared / global (fixes many rows at once)

1. **Canonical logo lock** — create `marketplace-frontend/assets/brand/` with the approved mark only; retarget every `<img>`, favicon, apple-touch, social image; delete or quarantine Logo 2.x / logo.png variants after reference check.
2. **Token lock** — one token file. Market Blue `#2563EB`, Dealer Blue `#1F4ED8`, Deep Blue `#153AA6`, Graphite `#17191F`, Warm White `#F7F8FA`, Dark Canvas `#121318`, Dark Surface `#1A1D24`, Dark Border `#2B303A`. Remove `--ms-accent: #7c3aed`. Replace Tailwind indigo/violet/amber department accents in `MS_WORKSPACES`.
3. **CSS ownership** — `ms-design-system.css` tokens/primitives; `marketsync-theme.css` composition only; `dashboard-nav.css` layout only. Absorb or delete leftover repaint sheets. Ban new `!important` rainbows.
4. **Typography** — Manrope primary, Inter dense UI. Remove Satoshi/Fontshare from login and engine titles.
5. **Global shells** — one public nav/footer; one DealerOS header+dept+mobile bar; HQ uses DealerOS shell family with environment banner only.
6. **Button / form / table / modal primitives** — Market Blue primary, semantic danger only, content-layer tables (no glass blur), Layer-3 glass limited to nav/menus/floating chrome.
7. **Dark mode contract** — html.dark + tokens; no white cards; no hardcoded slate-900 text on dark canvases.

### P1 — high-traffic workflows (after P0)

Login/register, My Day Pulse, Sales Pulse + customer card, Inventory Pulse, Service Pulse + check-in, Desk a Deal, Settings, mobile nav.

### P2 — department routes

F&I, Parts, Accounting/Commissions, Cleanup, Marketing tools (Studio, Scheduler, Video, Campaigns, Website/SEO, Automations), HR, Academy, Intelligence widgets.

### P3 — secondary / legal / SEO / HQ polish / orphans

Legacy SEO landings (rewrite or redirect), legal, blog, affiliates, HQ density pass, watch/post/site/group orphans (redirect or delete).

## First five remediation targets

1. Canonical logo + favicon migration
2. Delete purple `--ms-accent` and department rainbow accents
3. Publish tokenized button+input+modal in one CSS owner
4. Remove Satoshi; enforce Manrope/Inter
5. DealerOS + public shell alignment (nav height, logo size, theme toggle)

## Blocked surfaces

- Stripe Customer Portal (external)
- Chrome Web Store listing (external)
- Any remaining third-party Academy iframe (confirm at runtime)

## Explicit non-claims

- Zero routes are PASS.
- Authenticated scores will be revised after a logged-in screenshot pass at 375 / 390 / 430 / 768 / 1024 / 1440 in light and dark.
- This document does not implement visual fixes.


## Batch 1 — Global Foundation Lock (2026-08-26)

Applied shared-system remediations. **No route is marked PASS.** Authenticated visual verification is still required.

Code-proven this batch:

- Canonical assets live in `marketplace-frontend/assets/brand/`. Public shell, auth, dashboard, favicons retargeted.
- `--ms-accent` purple `#7c3aed` remapped to Market Blue `#2563EB`. HQ `data-dash-mode=marketsync` nav overrides no longer force purple.
- Department `MS_WORKSPACES` accents collapsed to `indigo` (blue family). Semantic status colors untouched.
- Satoshi/Fontshare removed from theme + auth/dashboard HTML; Manrope + Inter loaded.
- Shared primitives added: `.ms-btn*`, `.ms-input`, `.ms-modal*`, `.ms-mat-*`, `.ms-glass-*` with reduced-motion / reduced-transparency / no-backdrop-filter fallbacks.
- CSS ownership documented in `docs/CSS_OWNERSHIP.md`.
- Mobile All-pages sheet uses overlay + strong glass.

Not proven without screenshots: per-route contrast, 375–1440 layout, logo geometry match to the approved die-cut, every leftover Tailwind violet class.

Average score is **not** auto-raised. Next: logged-in visual pass.


## Phase 2 visual pass — 2026-08-26

**Not executed.** Staging credentials were not supplied in the verification request, and the verification browser received HTTP Not Found from `staging-site.onrender.com`. No authenticated route scores changed. Average remains 60.8. PASS count remains 0.

See `docs/BRAND_UI_VISUAL_VERIFICATION.md`.


## Phase 2 update — 2026-08-26 (staging URL confirmed)

Staging origin works: `https://marketsync-staging-site.onrender.com/`. Sessionless visit of `#/p/profile` renders login.

`A001 /login.html` light desktop + mobile inspected on that origin. Score held at NEEDS WORK (~78 / ~76). Sign-in control is off Market Blue. Authenticated rows unchanged. Average **60.8**. PASS **0**.

Credentials still required for My Day through HQ.


## Phase 2 — 2026-08-26 credentials received

Staging API accepted `admin@marketsync.link`. Live visual inspection still limited to the **login** screen (light desktop + mobile). The verification browser did not apply the session to `dashboard.html`, so My Day–HQ rows are unchanged.

Average **60.8**. PASS **0**. Login Sign In button logged as GLOBAL token violation; not patched in this phase.


Phase 2 account map: admin = HQ, sales = dealer switcher. Both API-authenticated. Authenticated UI still not captured by the verification browser.


## Phase 2 live Pulse — 2026-08-26

Dealer session via real login (sales@marketsync.link). Pulse 1440 light scored 71. Punch-clock modal scored 74. Login already 76-78. PASS 0. Average 60.8. Evidence in docs/evidence/phase2/.


## Phase 2 routing 2026-08-26
Hash boot bugs fixed in 1d2ab54 and 67e7c79. Sales workspace visually confirmed. PASS 0. Average 60.8.


## Phase 2 matrix 2026-08-27

Evidence folder updated with dealer 1440 light/dark for core workspaces, Pulse/Sales 390, Pulse 768, HQ command. Hashes resolve to the intended workspace. PASS 0. Average 60.8. Phase 3 not started.


## Phase 3 P0 2026-08-27

Shared token lock and chrome glass landed (`72cb559`, `716c1ac`). Captured actions on Sales 1440 light now use Market Blue for Install Extension, Intelligence, and Demo. Chat FAB still violet until v2 CSS caches. PASS 0. Average 60.8. No department-content edits. Phase 4 not started.


## Phase 3 follow-up 2026-08-27

Login Sign In and staff-chat FAB now render Market Blue in evidence. A001 color subscore improved; route still NEEDS WORK (not 95+). PASS 0. Average ~61. Phase 4 not started.


## Phase 3 P0 closed 2026-08-27

Shared token/glass/chrome/dark P0 landed. PASS 0. Average ~61. Phase 4 (route-specific) not started.


## Phase 4 started 2026-08-27

Canonical dark canvas locked to **#121318**. `#0B1220` is `--ms-blue-950` ink only.

Batch 1 (`ffe699c`): shared pulseRow / pulseCard / pulseActionsRow now use `ms-c` + `ms-btn`. Affects every department Pulse that composes those helpers. No route promoted to PASS yet.

Queue remains the 167-row inventory. Next: recapture Pulse family, then Customers / Settings / HQ cards.


## Phase 4 batch 2
engCard/engKpi and CRM rows migrated to ms-c. D003/H00x still NEEDS WORK pending recapture.
