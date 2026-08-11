# MarketSync Studio — audit before rebuild

Read before writing any Studio code. Audit only; no code changed.

Baseline when audited: `62bf253`. **Re-verified against `78cca4c`** — see the addendum at the
end, which materially changes sections 1–4 and the phasing.

---

## The headline finding

**There is no Studio editor to rebuild.** The brief describes upgrading an existing editor; what
exists is a media *library*, and its own source header says so:

> "This is deliberately a library, not an editor. Creative tooling — templates, overlays, the
> background swap that already exists for vehicle photos — can be built on top of a place where
> assets live. It cannot be built on a text box full of links."
> — `routes/marketing-studio.js:8`

In total, today's Studio is:

- **114 lines of backend** — three routes: list, upload, delete.
- **~18 lines of frontend** — a thumbnail grid inside `marketing-workspace.js` (`__mktView === 'studio'`).
- **One flat table** — `marketing_assets` (media rows, no structure).

There is no canvas, no scene model, no template table, no design table, no layer concept, no
editor shell. **This is ~95% greenfield**, not a refactor. That changes the effort and the risk
profile materially, so it is stated first rather than discovered in week three.

What that does *not* mean: there is a lot of adjacent infrastructure worth reusing, and one
existing system the brief would have accidentally duplicated (§6 below).

---

## 1. Current Studio architecture

| Layer | What exists | File |
|---|---|---|
| Backend routes | `GET/POST/DELETE /marketing/assets` | `routes/marketing-studio.js` (114 lines) |
| Storage | Supabase bucket, WebP encode via `toWebp()` | reuses `routes/inventory.js` |
| Table | `marketing_assets` | `migrations/2026-08-10-phase6-social-publishing.sql:95` |
| Frontend | thumbnail grid, one upload button | `js/modules/marketing-workspace.js:304` |
| Permissions | `marketing.view` / `marketing.edit`, + `requireMfa` | route-level |

`marketing_assets` columns: `kind` (image|video), `storage_path`, `public_url`, `width`,
`height`, `bytes`, `title`, `alt_text`, `inventory_id`, `campaign_id`, `created_by`, soft delete.
Already linked to the vehicle and campaign an asset belongs to — genuinely useful, keep.

---

## 2. Existing functionality that can remain

**Keep unchanged:**

- `marketing_assets` table and its indexes. It is a correct media library and becomes Studio's
  "Uploads" + "Photos → previously uploaded" panels for free.
- The upload pipeline (`toWebp`, same bucket, same size caps). The header's reasoning is right:
  a second image pipeline is a second set of bugs.
- `marketing.view` / `marketing.edit` permissions. **Do not add Studio-specific permissions** —
  the brief says do not build another permission system, and these already fit.
- The publishing engine end to end (§5).
- `social_accounts.ownership` / `owner_user_id` — the personal-vs-dealership model already
  exists (§5). The brief's §11 is already solved at the data layer.

---

## 3. Components that should be refactored

- **`renderTemplate` + `buildVars`** (`routes/automation.js:146` and `:153`) — the existing
  dynamic-field engine. Both are **module-private** (not exported). Studio needs them, so they
  must be *extracted* to a shared module and imported by both automation and Studio.
  Extraction, not duplication. This is the single most important refactor in the whole rebuild.
- **`marketing-workspace.js` studio view** — becomes a launcher (list designs, "New design")
  rather than a grid. The editor itself must not live inside the marketing workspace engine.
- **`listAssets`** — needs `kind`/provider filtering once stock photography and graphics exist.

---

## 4. Components that should be replaced

Only one, and it is small: the 18-line thumbnail grid. Everything else in Studio is additive.

---

## 5. Existing backend/API capabilities worth building on

**Publishing (Phase 6.2/6.6) — reuse entirely, do not touch.**
`social_posts` (with `media` jsonb, `scheduled_for`, approval states) → `social_post_targets` →
`social_claim_due_targets()` with `for update skip locked`. The claim is DB-owned. Studio's job
ends at producing an asset + handing off; the scheduler distributes. The brief agrees.

**Personal vs dealership identity — already modelled.**
`social_accounts.ownership` is `'dealership' | 'user'` with `owner_user_id`, plus a
`capabilities` jsonb that records what the provider *actually* permits. Studio's "publishing
identity" (brief §7, §11) reads this. Nothing new required.

**Inventory** — the canonical vehicle source. Bind, never copy (brief agrees).

**Brand** — `dealerships.branding` (jsonb) already exists, plus `legal_name`, `phone`,
`website_url`, `site_slug`, and as of Phase 7 `timezone`, `operating_hours` and
`dealership_locations`. The Brand Kit is a *read model over existing config*, not new storage.

**Server-side rendering — already available, and this is a significant find.**
The backend already depends on `puppeteer-core` + `@sparticuz/chromium` (headless Chrome) and
`sharp`. That is a complete scene→PNG flattening path with **no new dependency**. It also means
the canonical render happens server-side, so the image a customer sees is not whatever the
designer's browser happened to rasterize.

**Fonts** — `@fontsource/arimo` and `@fontsource/tinos` are already installed.

---

## 6. The system the brief would have duplicated

The brief proposes bindings like `{vehicle.year}` (single brace), while saying:

> "Do not hard-code the exact syntax if an existing MarketSync dynamic-field system already
> exists. Reuse it."

**One exists.** `routes/automation.js:146`:

```js
function renderTemplate(tmpl, vars) {
  return String(tmpl || '').replace(/\{\{\s*([\w.]+)\s*(?:\|\s*([^}]*))?\}\}/g, (_, key, fb) => {
    const v = vars[key]
    if (v != null && String(v).trim() !== '') return String(v)
    return fb != null ? fb.trim() : ''
  })
}
```

Syntax is **`{{namespace.field|fallback}}`**, and the rule at `:56` is explicit: *"unresolved
tokens collapse to the fallback (never raw tags)."* `buildVars` already supplies
`vehicle.year|make|model|trim|ymm`, `dealership.name|phone`, `rep.first_name|full_name`,
`customer.*`, `review_url`, `service_url`, `referral_bonus`.

**Recommendation: Studio uses `{{…}}`, not `{…}`.** Rationale beyond consistency — the fallback
mechanism is exactly what a *design* needs. A price element bound to `{{vehicle.price|Call for
price}}` degrades gracefully; `{vehicle.price}` rendering empty leaves a hole in the artwork, and
rendering the raw tag puts `{vehicle.price}` on a Facebook post.

Namespaces Studio must **add** to `buildVars` (they do not exist yet): `vehicle.price`,
`vehicle.payment`, `vehicle.mileage`, `vehicle.stock_number`, `vehicle.vin`,
`dealership.website`, `salesperson.*` (currently only `rep.*`).

⚠️ **VIN caution.** The brief lists `{vehicle.vin}` "where appropriate". A VIN on a public social
graphic is a real-world abuse vector (VIN cloning, fraudulent listings). Recommend VIN be
available in the editor but **excluded from any template MarketSync ships**, and flagged when
bound in a design destined for a public post.

---

## 7. Proposed scene/design data model

Two new tables. Structured scene, never a flattened image (brief §5).

```
studio_designs
  id, dealership_id, name, format_key, width, height,
  scene           jsonb   -- the page/element tree
  owner_user_id, ownership ('dealership'|'user')   -- mirrors social_accounts exactly
  vehicle_id      uuid → inventory (nullable: the currently bound vehicle)
  preview_asset_id uuid → marketing_assets (last render; NOT the source of truth)
  template_id     uuid → studio_templates (what it was created from)
  created_by, created_at, updated_at, deleted_at

studio_templates
  id, dealership_id (NULL = MarketSync-authored global — the marketing_sources /
                     staff_training_courses precedent from PR 6.1 / 7.3)
  template_key, name, category, format_key, scene jsonb, thumbnail_url,
  version_number, active, created_by, timestamps
```

`scene` shape:

```json
{ "version": 1,
  "pages": [ { "id": "p1", "width": 1080, "height": 1080, "background": {...},
    "elements": [
      { "id": "e1", "type": "text", "x": 64, "y": 820, "w": 560, "h": 96,
        "rotation": 0, "z": 3, "locked": false, "hidden": false, "name": "Price",
        "content": { "text": "{{vehicle.price|Call for price}}" },
        "style": { "fontFamily": "Arimo", "fontSize": 72, "fontWeight": 700, ... },
        "binding": { "source": "vehicle", "field": "price" } } ] } ] }
```

Element types per brief: `text`, `image`, `shape`, `svg`, `vehicle-image`, `dynamic-text`,
`dealer-brand`, `uploaded-asset`.

**A template is a design with bindings** — same `scene` schema, no second format. That is what
makes "save as template" and "one template → many vehicles" nearly free.

`format_key` (square/portrait/story/landscape/marketplace/custom) stays *metadata*: the scene
carries width/height, so the core model is not platform-coupled (brief §8).

---

## 8. Proposed component architecture

```
studio/
  scene-model.js      pure: create/mutate/validate scene, undo-redo stack   ← fully unit-testable
  bindings.js         wraps the EXTRACTED renderTemplate + Studio's vars
  canvas-renderer.js  scene → DOM/SVG, hit-testing, snapping, guides
  interactions.js     select/drag/resize/rotate/multi-select/keyboard
  panels/             templates, inventory, photos, graphics, shapes, text, uploads, brand
  inspector/          text, image, shape, position
  layers.js
  studio-shell.js     top bar, panel orchestration, autosave
```

The scene model must be **pure and separately testable** — that is what lets the canvas be
proven without a browser, and it is the difference between this being maintainable and it being
a 4,000-line file nobody will touch.

---

## 9. Migration strategy for existing Studio data

**Nothing to migrate.** `marketing_assets` rows are media, not designs; they keep working
unchanged and appear in Studio's Photos/Uploads panels. No backfill, no data transformation, no
risk to existing rows. `studio_designs` and `studio_templates` start empty.

---

## 10. Testing implications

- **Scene model**: real unit tests (pure functions) — add/move/resize/z-order/group/undo/redo,
  and that an unknown element type is rejected rather than silently dropped.
- **Bindings**: `{{vehicle.price|Call for price}}` resolves; an unbound field collapses to the
  fallback; **a raw `{{tag}}` must never reach a rendered asset** — that is the regression test
  that matters most, because the failure is public.
- **Render**: scene → PNG produces the declared dimensions; a design with a failed image fetch
  fails loudly rather than rendering a hole.
- **Publishing handoff**: Studio produces `marketing_assets` row → `social_posts.media`
  references it → the existing target/claim path is untouched.
- **RBAC/tenancy**: a design cannot be read or rendered cross-dealership; a salesperson cannot
  publish through a dealership-owned account they do not own.
- **390px**: the mobile subset (open, edit text, replace vehicle, preview, approve, schedule).

Given this codebase's history — seven dead-wiring defects in Phase 7 alone — **every phase needs
the producer→consumer proof, not source assertions.** A Studio that can save a design nobody can
render is the same defect class in a new place.

---

## 11. Dependencies already present that support this

| Need | Already available |
|---|---|
| Server-side render (scene → PNG) | `puppeteer-core` + `@sparticuz/chromium` |
| Raster processing / WebP / resize | `sharp` |
| Fonts | `@fontsource/arimo`, `@fontsource/tinos` |
| Upload handling | `multer` |
| Storage + CDN URLs | Supabase storage (bucket + pipeline in use) |
| Dynamic fields | `renderTemplate` / `buildVars` (needs extracting) |
| Publishing + scheduling | `social_posts` / `social_post_targets` / DB claim |
| Identity (personal vs dealership) | `social_accounts.ownership` |

---

## 12. New dependencies — recommendation: **none on the backend, and probably none on the frontend**

**The constraint that decides this:** the frontend has **no build step**. `dashboard.html` loads
~30 plain `<script>` tags in a load-order-critical sequence; Tailwind comes from a CDN; there is
no bundler, no framework, no module system in the browser. CLAUDE.md rule 2 explicitly protects
that ordering.

That rules out the obvious picks (Fabric.js, Konva, tldraw, any React-based editor) unless a
build pipeline is introduced — which is a much larger, riskier change than the Studio itself and
would touch every existing page.

**Recommendation: build the canvas on inline SVG + DOM, no library.**

- SVG gives text, shapes, images, transforms, z-order and hit-testing natively.
- It is inspectable and testable without a headless browser.
- It matches what the server will render (Chromium renders the same SVG/HTML).
- No new dependency, no build step, no threat to the existing shell.

Cost, stated honestly: freehand vector paths and advanced boolean ops would be materially harder
than with Fabric/Konva. The brief lists free-form paths as *"architect for later"*, and
explicitly excludes full Illustrator/Photoshop, so this is an acceptable trade — but it is a real
one, and if freehand vector becomes a near-term requirement this decision should be revisited
**before** Phase B rather than worked around.

**If a build step is ever wanted anyway**, that should be its own decision with its own PR, not
smuggled in under Studio.

---

## 13. Implementation phases

Aligned to the brief's A–J, with the ordering change the audit implies:

| Phase | Scope | Note |
|---|---|---|
| **A** | Scene model + `studio_designs`/`studio_templates` migration + **extract `renderTemplate`/`buildVars`** | Extraction first — everything downstream binds to it |
| **B** | Editor shell (top bar, panels, autosave) + SVG canvas render | No interactions yet |
| **C** | Canvas manipulation: select/drag/resize/rotate/z-order/snapping/keyboard/undo-redo | The bulk of the interaction work |
| **D** | Text / images / shapes + inspector | |
| **E** | Layers panel | Small once C and D exist |
| **F** | Assets: uploads, existing library, vehicle photos, graphics | Stock-photo provider adapter interface, one provider |
| **G** | Inventory bindings + vehicle swap re-render | The differentiator |
| **H** | Brand kit (read model over existing dealership config) | |
| **I** | Templates + server-side render endpoint | Render is what makes templates publishable |
| **J** | Scheduler handoff, 390px, E2E, security regression | |

Phases A and B are the ones worth doing carefully; the rest follow the model laid down there.

---

## Open questions for the owner

1. **Build step** — confirm the no-build-step constraint holds. It is the single decision that
   most shapes the editor (§12).
2. **Stock photography provider** — needs an account and licence review. Which provider, and who
   holds the key? The adapter can ship before the provider is chosen.
3. **Graphics/icon library licensing** — the brief says "only assets whose licensing permits this
   use". MarketSync ships none today. Someone has to choose and clear a set.
4. **VIN on public creative** — recommend excluding from shipped templates (§6).
5. **Sequencing vs Phase 8** — Codex is on Phase 8 (OS coherence). Studio touches
   `marketing-workspace.js` and the workspace registry, both of which 8.0 is also changing.
   Recommend Studio starts after 8.0 merges, or explicitly agrees a file boundary.


---

# ADDENDUM — re-verified at `78cca4c`

Between writing this audit and starting Phase A, `staging` advanced 20 commits. Two of them
change the audit's premise, so the sections above are corrected here rather than silently left
stale.

## A Studio editor now exists

`fb255c4 feat: add dealer marketing studio editor` shipped while this audit was being written.
What it is, precisely:

- **Backend** `POST /marketing/studio/render` (`routes/marketing-studio.js`, now 186 lines).
  Takes a flat spec — `format`, `headline`, `subheadline`, `cta`, `accent_color`, `text_color`,
  optional background `asset_id` — composites an SVG overlay onto the background with `sharp`,
  and stores the flattened WebP as a `marketing_assets` row.
- **Frontend** `mktStudioOpen` / `mktStudioPreview` / `mktStudioRender` — a modal in
  `marketing-workspace.js` with a live CSS preview and four format presets.

**It is well built for what it is.** `studioDesignSpec` clamps format, colours and overlay;
`studioOverlaySvg` escapes dealer-authored text (there is a test asserting `<script>` becomes
`&lt;script&gt;`); the background must be a tenant-scoped `marketing_assets` row rather than an
arbitrary fetched URL. That is the right security posture and it should be preserved.

## What it does not do, measured against this brief

| Brief requirement | Status |
|---|---|
| §5 "Do NOT store designs as flattened images" | **Inverted** — a flattened image is the only artefact |
| §10 "Preserve the editable design so users can return later" | **Not possible** — nothing persists the headline, colours or format |
| §2 canvas: select/drag/resize/rotate/multi-select/layers | absent |
| §3 contextual inspector | absent (fixed form) |
| §4 layers panel | absent |
| §6 dynamic MarketSync bindings | absent |
| §7 brand kit | absent |
| §9 template system | absent (no template or design table) |
| §1 inventory panel / vehicle drag-in | absent |

There is still **no `studio_designs` and no `studio_templates` table**, so §7 of this audit
(the scene model) stands unchanged and is the largest remaining gap.

## Corrected assessment

The editor is best understood as **a single hard-coded template with a server-side renderer** —
roughly "Phase 0.5" against the A–J plan. It is genuinely useful today and it is *not* wasted
work: under a scene model it becomes one template rendered through the general renderer, and its
`sharp` + escaped-SVG pipeline is the render path §5 of this audit recommended.

The one thing to avoid is letting the flat spec harden into the persistence model. Today a design
cannot be reopened; if posts start referencing rendered assets in volume before designs are
persisted, every one of them becomes un-editable history.

## Ownership call

Two agents were briefed on Studio simultaneously and both started. That is the duplicate-engine
outcome the brief warns about, so this audit stops at the boundary rather than building a second
editor.

**Recommended split, with reasons:**

- **Codex keeps `marketing-studio.js` and the marketing-workspace surface.** It is mid-flight
  there and has the most recent context.
- **The scene model + persistence is the next slice and is collision-free**: new
  `studio_designs` / `studio_templates` tables, a pure `scene-model.js`, and the
  `renderTemplate`/`buildVars` extraction from `automation.js` — a file Codex has *not* touched
  in these 20 commits.
- **Sequencing that avoids throwaway work**: persist designs *before* the flat renderer is
  widely used, then teach the existing renderer to render a scene. That keeps Codex's security
  posture and makes today's designs re-openable rather than stranded.

Whoever picks it up, the two decisions from the original open-questions list are now settled by
inspection: **no build step** (so inline SVG, no Fabric/Konva), and **`{{ns.field|fallback}}`**
for bindings, reusing `renderTemplate`.
