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
| Dashboard page containers | 82 |
| Public HTML pages | 59 |
| Roles with distinct navigation | 8 |
| Dashboard modes | 3 |

Roles: `SALES_REP`, `FNI`, `SERVICE`, `CLEANUP`, `ACCOUNTING`, `MANAGER`,
`OWNER`, `DEALER_ADMIN`.
Modes: default DealerOS, `data-dash-mode="marketsync"` (internal),
`data-ms-suite="digital"`, plus `data-dash-mode="demo"`.

**Every one of these renders in light and dark.** A phase is not done until it
has been checked in both.

## Page-coverage audit (re-measured 2026-08-25, at phase 4)

Counted from source. These numbers are the reason the phase order below is what
it is — they are not decoration, and two of them change the plan.

### The design system reaches 2 pages in 59

| Fact | Count |
|---|---|
| HTML pages loading `ms-design-system.css` | **2** (`dashboard.html`, `training.html`) |
| HTML pages not loading it | **57** |
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

### The phase 1 primitives, now proven on one Pulse

| Primitive | Uses in markup |
|---|---|
| `.ms-board` | 3 |
| `.ms-c--*` (card variants) | 71 |
| `.ms-span-*` | 0 |
| `.ms-surface--*` | 0 |
| `.ms-touch` | 0 |
| `.pulse-summary-grid`, `.ms-kpi*` (phase 3) | in use |

Phase 4 adopted `.ms-board` and `.ms-c--*` on the Service Pulse — the first real
content ever put through the masonry grid. **It found a defect immediately**,
which is the entire argument for adopting on one Pulse before eight.

The semantic spans reserved rows as well as columns (`hero` span 3, `feature`
span 2, `tall` span 3). A hero holding six record rows fills about one and a half
of those, and the remaining two rows cannot be backfilled by anything because the
hero has already claimed them — dense packing cannot rescue space that is spoken
for. Measured at 1440px: a dead band roughly 230px tall directly under the lead
card, with cards sitting beside it at a y-offset no reader would associate with
it.

The fix is in `§3`: **semantic spans carry columns only.** Height already
communicates itself, because `grid-auto-rows` is `minmax(row, auto)` and a card
holding more rows is simply taller. Importance is carried by column span,
padding, radius and elevation, none of which strand anything. Board height at
1440px went 936px → 842px with no loss of hierarchy, and no overflow at 1440 /
1280 / 1024 / 768 / 390.

That removal also retired the one real `!important` in the design system: the
`[data-empty="true"]` rule existed only to claw back the rows a hero reserved.

### Legacy weight still to unwind

Counted as **declarations** (`grep -o '!important;'`). An earlier pass counted
bare `!important` occurrences, which also matches the word inside comments and
over-reported by roughly 200 — the corrected figures are below.

| Fact | Declarations |
|---|---|
| `!important` across `css/` | 528 |
| — of which `ms-design-system.css` | **0** |
| Hardcoded hex colours in JS renderers | 718 |
| `class="…"` attributes in JS renderers | 13,762 |

The design system now carries **no** `!important` at all: it wins by cascade
order, being loaded last. The 528 elsewhere are the real backlog, and phase 16 is
where they come out — not before, because each removal needs the surface that
depends on it to have been migrated first.

## Work since phase 3 (not phase work)

Between phase 3 and now the effort went to *"every page functional and ready to
use"* rather than to the numbered phases. Recorded here so the phase table below
is not read as the whole picture:

| Commit | What |
|---|---|
| `457beb4` | page-coverage audit (the numbers above) |
| `7a197bd`, `f81efae` | two genuine CodeQL high-severity fixes |
| `ed3c278` | record-level deep links from Pulse counts |
| `715ace3` | all three dashboard modes / eight roles |
| `e4ab1fd`, `f81efae`, `4f5bc25` | SEO nav gate, entitlement migrations, Pro revoke |
| `6c271d9` | mobile Pulse: logo crop, wrapping headers, quiet zeros |
| `bcb7d7b` | modals: opaque card, readable action buttons |
| `fda1b26` | ten dead inline handlers made to work + a permanent guard |

None of this advanced phases 4-16. **Phase 4 is still the next phase**, and the
measured warning above still stands: the phase 1 primitives have zero uses in
markup, so adopt them on one department Pulse and measure before rolling to
seven more.

## Pulse coverage

| Engine | Pulse | Hierarchy | Records behind counts |
|---|---|---|---|
| `command` (Dealership) | ✅ | ✅ phase 3 | ✅ |
| `sales` | ✅ | ⬜ | ⬜ |
| `inventory-overview` | ✅ | ⬜ | ⬜ |
| `fni-overview` | ✅ | ⬜ | ⬜ |
| `service-overview` | ✅ | ✅ phase 4 | ✅ |
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
| 4 | The eight department Pulses — each audited on its own terms | 🔵 Service done; 7 to go |
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
8. **Semantic spans carry columns, never rows.** A fixed `grid-row` span
   reserves space the card may not fill, and nothing can backfill a claimed row.
   Height comes from content; importance comes from column span, padding, radius
   and elevation. Found by putting the Service Pulse through the grid — 230px of
   dead band under the lead card.
9. **Never invent an identity.** A record that cannot be named shows its id. A
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
