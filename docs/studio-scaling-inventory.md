# Studio scaling inventory (P0 audit — 2026-09-06)

Every place in the Studio codebase that affects canvas size, zoom, transform,
retina scaling, or viewport. This is the deletion list once the Raw Canvas
Mode diagnostic tells us which single strategy stays. Do not delete
anything from this list until that decision is made — the point is to see
the whole surface at once so the second scaling system can be recognized
when it walks in.

## 1. Fabric-internal sizing — the "document coordinate system"

Single place. Belongs to the adapter.

- `marketplace-frontend/js/modules/studio/fabric-adapter.js:188`
  `this.fabricCanvas.setDimensions({ width: pageWidth, height: pageHeight })`
  Runs at every `renderScene()`. pageWidth/pageHeight come from
  `scene.pages[i].width/height || scene.width/height || 1080`.
  With Fabric v5's default `enableRetinaScaling=true`, this also multiplies
  the intrinsic `<canvas>` bitmap by `devicePixelRatio` — that is where the
  observed `cvs attr=3240×5760, css=1080×1920` comes from on an iPhone.

- `marketplace-frontend/js/modules/studio/fabric-adapter.js:538`
  `this.fabricCanvas.setDimensions({ width, height })` inside
  `resizeCurrentPage()`. Only fires when the user changes canvas size in
  the size picker.

**Keep.** This is the one place logical dimensions are authoritative.

## 2. CSS transform on the artboard container — the "presentation scaler"

This is the outer stage the P0 note calls out. Single place today, but
three code paths write to it.

- `marketplace-frontend/js/modules/studio/studio-shell.js:1283`
  `<div id="studio-artboard-container" style="width:${scene.width}px;
  height:${scene.height}px; transform:translate(-50%, -50%) scale(0.55);">`
  Initial mount uses a hard-coded `scale(0.55)` before any fit runs.

- `marketplace-frontend/js/modules/studio/studio-shell.js:603` `applyStudioZoom()`
  Writes `container.style.transform = translate(-50%, -50%) scale(${zoom})`.

- `marketplace-frontend/js/modules/studio/studio-shell.js:588` `zoomStudioFit()`
  Computes fit scale from `viewport.clientWidth/Height` minus 32px padding
  and canvas dims, calls `applyStudioZoom()`.

Note the origin: the container is `absolute; left:1/2; top:1/2` with a
`translate(-50%, -50%)` inside the transform. The scale multiplier compounds
with the translate every write.

**Called from (fifteen places):**

- `studio-shell.js:580` `zoomStudioIn()`
- `studio-shell.js:585` `zoomStudioOut()`
- `studio-shell.js:693` `setTimeout(zoomStudioFit, 100)` on open
- `studio-shell.js:2763` `zoomStudioFit()` after `loadStudioTemplate`
- `studio-shell.js:2776` deferred repaint calls it again 120ms + 700ms later
- `studio-shell.js:3111` after page switch
- `studio-shell.js:3162` after action sheet close
- `studio-shell.js:3195` after template apply
- `studio-shell.js:3260` after action
- `studio-shell.js:3564` `setTimeout(zoomStudioFit, 50)`
- `studio-shell.js:3573` `setTimeout(zoomStudioFit, 50)`

Every one of these paths eventually rewrites the container transform.

## 3. Fabric viewport transform

- `fabric-adapter.js` never sets `viewportTransform` explicitly. Default
  identity `[1, 0, 0, 1, 0, 0]`. Fabric's internal zoom stays at 1.

- `studio-shell.js:869` (Raw Canvas Mode ON) sets it to identity — no-op in
  practice because it already is identity. Belt-and-braces for the P0 fix
  path when a future zoom strategy might use it.

**No competing viewport transform today.** Good — this is one of the three
axes the P0 note says must have only one owner.

## 4. Fabric wrapper / lower-canvas / upper-canvas — Fabric-injected DOM

- Fabric injects `.canvas-container > .lower-canvas + .upper-canvas` around
  the `#studio-main-canvas` element. Their `style.width`, `style.height`,
  `style.position` are written by Fabric on `setDimensions`.

- `marketsync-theme.css` — global `canvas { display: block; max-width: 100% }`
  reset. **This can crush the wrapper on mobile** if `max-width: 100%`
  narrows a 1080px canvas to viewport width without a matching height rule.
  Confirmed target of investigation in Phase 4 of the Raw Canvas Mode plan.

- `.studio-scroll-row > *` universal rule at `marketsync-theme.css:3986`
  (Website Studio swipe rules). Not scoped to Studio — shouldn't hit the
  canvas, but the `> *` selector needs a re-audit under a phone width where
  the artboard container might briefly parent an element with that class.

## 5. ResizeObserver

- `studio-shell.js:690`
  `window.__studioFitObserver = new ResizeObserver(() => rAF(zoomStudioFit))`
  observes `#studio-canvas-viewport`. Fires on every viewport resize,
  orientation change, and initial layout.

**Only observer today.** Raw Canvas Mode disconnects it when ON.

## 6. Retina / DPR

- No manual DPR math anywhere in the adapter. Fabric's
  `enableRetinaScaling` (default true) does it internally. That is why
  `cvs attr=3240×5760` on a 3× iPhone but the wrapper reports `1080×1920`.

**Keep implicit.** Do not add manual `Math.round(w * devicePixelRatio)`
math anywhere — that is exactly the double-scaling the P0 note forbids.

## 7. Studio zoom state (window global)

- `window.__studioZoomLevel` — set in `zoomIn`, `zoomOut`, `zoomStudioFit`.
  Read in `applyStudioZoom` and in the diag repaint logs.
- `window.__studioRawCanvasMode` — set only by Raw Canvas Mode toggle.
- `window.__studioFitObserver` — set on adapter init, disconnected on Raw ON.

## 8. Mobile CSS overrides (theme.css)

- `.studio-scroll-row` responsive swipe rules — do not touch canvas.
- `.website-studio-shell` overflow-x containment — does not scope Studio.
- `#ms-studio-master-modal` — the modal that wraps the studio. Its
  `applyStudioMobileChrome` MutationObserver injects styles on children.
  Only touches text buttons and the breakpoint switcher, never
  `.canvas-container` / `.lower-canvas` / `.upper-canvas`. Safe today.

## Summary — the three axes

| Axis | Owner today | Number of writers |
|---|---|---|
| Document coords (Fabric logical) | `fabric-adapter.setDimensions()` | 2 (renderScene + resizePage) |
| Presentation scale (CSS) | `applyStudioZoom()` + inline mount | 15+ callers of `zoomStudioFit` |
| Viewport transform (Fabric) | never set today | 0 (Raw ON writes identity — no-op) |

## Deletion candidates (per Raw Canvas Mode outcome)

If Raw ON renders successfully:
- The bug is somewhere in **axis 2 (CSS presentation scale)**. The 15
  `zoomStudioFit` callers need to be collapsed to one: mount at fit-scale
  once, resize on ResizeObserver only, delete the deferred re-fit timers,
  delete the hard-coded `scale(0.55)` on the artboard container HTML.

If Raw ON stays blank:
- The bug is in **axis 1 (Fabric DOM/canvas layering)** or in a template
  covering rect. Neither needs the CSS scaler collapsed — but the mount's
  `scale(0.55)` on line 1283 becomes strictly cosmetic and should still be
  removed to avoid a competing initial state.

Do not touch anything on this list until the Raw Canvas Mode dump names the
failing axis. The point of writing it down is to make sure the fix removes
things instead of adding another layer.
