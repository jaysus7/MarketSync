# Design System Rollout — scope, phases and coverage

## Scope

**Every Pulse, every page, every dashboard, every role.** Not the dashboard, not
the obvious screens. A surface is in scope if a human can reach it: department
Pulses, engine tabs, record pages, settings, builders, the public site, and every
role and dashboard mode each of those renders under.

This is written down because the failure mode is predictable: improve the screens
that are easy to find, declare the system "applied", and leave the rest looking
like a different product. The coverage tables below exist to make that visible.

## The two non-negotiable principles

> **Masonry exists to communicate importance. Liquid Glass exists to communicate
> functional layers. Neither exists merely for decoration.**

And the rule that falls out of the first one:

> **Each department's Pulse has its own important information.** The Dealership
> Pulse's five tiles are not a template. Service leads on promised-time risk and
> parts holds; Accounting leads on cash and contracts in transit; Cleanup leads on
> units aging in recon. Copying one department's emphasis onto another produces a
> layout that looks designed and says nothing. Every Pulse gets its own audit of
> *what a person in that department needs first*, before any layout work.

Emphasis is **data-driven**: a tile is prominent because its number says someone
is needed, not because of where it sits. When the store is calm the row flattens
back to equals — the honest picture of a calm store.

## Surface inventory

Counted from source, not from memory. Refresh with the commands in
`test/design-system-coverage.test.js`.

| Surface class | Count |
|---|---|
| Pulse engines | 9 |
| Registered engines (all tabs) | 19 |
| Dashboard page containers | 67 |
| Public HTML pages | 59 |
| Roles with distinct navigation | 8 |
| Dashboard modes | 3 |

Roles: `SALES_REP`, `FNI`, `SERVICE`, `CLEANUP`, `ACCOUNTING`, `MANAGER`,
`OWNER`, `DEALER_ADMIN`.
Modes: default DealerOS, `data-dash-mode="marketsync"` (internal),
`data-ms-suite="digital"`, plus `data-dash-mode="demo"`.

**Every one of these renders in light and dark.** A phase is not done until it
has been checked in both.

## Page-coverage audit (measured 2026-08-25, at 3b1d215)

Counted from source. These numbers are the reason the phase order below is what
it is — they are not decoration, and two of them change the plan.

### The design system reaches 1 page in 59

| Fact | Count |
|---|---|
| HTML pages loading `ms-design-system.css` | **1** (`dashboard.html`) |
| HTML pages not loading it | **58** |
| Public pages loading `marketsync-theme.css` | 3 |
| Public pages on `/site-marketing.css` | 19 |
| Public pages pulling a stylesheet from a third-party CDN | 24 |
| Pages carrying inline `<style>` blocks | 45 pages, 95 blocks |

Phase 14 ("public site") cannot be a restyle. The public site is a **separate
styling world** — its own marketing stylesheet, a CDN dependency, and 95 inline
style blocks — and none of the token, material or card work applies to it until
the design system is actually loaded there. That is a prerequisite step, not a
polish pass, and it needs care: dropping a stylesheet onto 58 live marketing
pages can regress them all at once.

The CDN stylesheet on 24 pages is also inconsistent with the completed migration
away from the Tailwind Play CDN, and is worth folding into the same phase.

### The phase 1 primitives are not in use anywhere

| Primitive | Uses in markup |
|---|---|
| `.ms-board` | **0** |
| `.ms-c--*` (card variants) | **0** |
| `.ms-span-*` | **0** |
| `.ms-surface--*` | **0** |
| `.ms-touch` | **0** |
| `.pulse-summary-grid`, `.ms-kpi*` (phase 3) | in use |

Stated plainly: the masonry and card system built in phase 1 has never laid out
a real card. It is internally consistent and tested, but **unproven against real
content**. Only the phase 3 Pulse components are actually rendering.

The consequence for phase 4: adopt the primitives on **one** department Pulse
first and measure it, before rolling the same treatment across the other seven.
Defects in an unused foundation surface the moment it meets real data, and
finding them once is much cheaper than finding them eight times.

### Legacy weight still to unwind

| Fact | Count |
|---|---|
| `!important` across `css/` | 696 |
| — of which `marketsync-theme.css` | 489 |
| — of which `dashboard-brand-repaint.css` | 156 |
| — of which `dashboard-nav.css` | 47 |
| — of which `ms-design-system.css` | **2** |
| Hardcoded hex colours in JS renderers | 718 |
| `class="…"` attributes in JS renderers | 13,762 |

The design system holds its own line (2 `!important` in ~600 lines) because it
wins by cascade order. The 694 elsewhere are the real backlog, and phase 16 is
where they come out — not before, because each removal needs the surface that
depends on it to have been migrated first.

## Pulse coverage

| Engine | Pulse | Hierarchy | Records behind counts |
|---|---|---|---|
| `command` (Dealership) | ✅ | ✅ phase 3 | ✅ |
| `sales` | ✅ | ⬜ | ⬜ |
| `inventory-overview` | ✅ | ⬜ | ⬜ |
| `fni-overview` | ✅ | ⬜ | ⬜ |
| `service-overview` | ✅ | ⬜ | ⬜ |
| `parts-overview` | ✅ | ⬜ | ⬜ |
| `accounting-overview` | ✅ | ⬜ | ⬜ |
| `marketing-overview` | ✅ | ⬜ | ⬜ |
| `people-overview` | ✅ | ⬜ | ⬜ |

## Phases

| # | Phase | State |
|---|---|---|
| 1 | Foundation: tokens, material, card + grid primitives | ✅ merged (#194) |
| 2 | Liquid Glass becomes opt-in; light/dark shell | ✅ in #196 |
| 3 | Dealership Pulse: importance-driven KPI row + records behind counts | ✅ in #196 |
| 4 | The eight department Pulses — each audited on its own terms | ⬜ next |
| 5 | Sales | ⬜ |
| 6 | Inventory | ⬜ |
| 7 | Service | ⬜ |
| 8 | Parts | ⬜ |
| 9 | Accounting | ⬜ |
| 10 | HR / People | ⬜ |
| 11 | Marketing + ChatBot | ⬜ |
| 12 | Builders (website, studio) | ⬜ |
| 13 | Settings, Academy, Guide | ⬜ |
| 14 | Public site | ⬜ |
| 15 | Responsive + a11y regression pass across all roles and modes | ⬜ |
| 16 | Legacy CSS cleanup | ⬜ |

## Invariants established — do not re-litigate

Each of these was found by measurement and cost real time. They are settled.

1. **Glass is opt-in.** Never decide a surface's material from a colour class.
   `.bg-white:not(...)` caught 1,297 call sites. Glass belongs to floating chrome
   (`.ms-glass`, header, nav, rails). Content surfaces are solid.
2. **Pulse keeps its 300px right-hand operations rail.** Hierarchy happens inside
   the board's own column. Do not reclaim the rail's width.
3. **Media queries add no specificity.** Every width breakpoint lives in the one
   responsive section at the end of `ms-design-system.css`.
4. **`:not()` takes its argument's specificity**, so `.bg-white:not(#id)` outranks
   a bare `#id`. Exemption lists are a symptom, not a fix.
5. **No `vw` clamps for a type scale.** They collapse tiers into each other at
   exactly the widths where the distinction matters.
6. **A span wider than the column count invents implicit columns.** Check that
   every breakpoint tiles exactly before shipping a grid.
7. **The design system wins by cascade order, not `!important`.**
   `ms-design-system.css` loads last. If a rule there needs `!important`, the real
   problem is a legacy rule that should be scoped instead.
8. **Never invent an identity.** A record that cannot be named shows its id. A
   count and its record list come from different endpoints, so a short list says
   "Showing 2 of 5", never implies it is all of them.

## How a phase is done

1. **Audit first.** What does a person in this department need first? Read the
   renderer, not the screenshot.
2. **Build a measured repro.** Serve the real CSS, drive it with Playwright, read
   computed styles and geometry. Do not judge by eye alone.
3. **Check both themes and every breakpoint the surface has.**
4. **Mutation-test new guards.** A test that cannot fail is not a test.
5. **Full gate:** `NODE_ENV=test node --test test/*.test.js` and
   `npm run check:frontend`.
6. **Update the coverage tables above** in the same commit.
