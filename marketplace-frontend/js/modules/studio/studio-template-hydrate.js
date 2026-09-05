/**
 * studio-template-hydrate.js — INTENTIONALLY DISABLED.
 *
 * This module used to wrap startStudioTemplate/applyStudioTemplate/
 * previewStudioTemplate with multi-timeout re-paints (paint() at
 * 600ms, 1600ms, plus 800ms after every click on any button or
 * article), all guarded by a self-regenerating setInterval that
 * re-wrapped every 800ms.
 *
 * Result observed via the in-app diagnostic panel:
 *   19:47:11.912 studio opened · adapter=true · fabric=true
 *   19:47:11.912 loadTemplate(tmpl_cpo_portrait) ready=true
 *   19:47:11.924 loadTemplate(tmpl_cpo_portrait) ready=true
 *   19:47:11.927 loadTemplate(tmpl_cpo_portrait) ready=true
 *   ... 19 total loadTemplate() calls in under 1 second ...
 *   canvas       144 objects  (~7 stacked copies of one template)
 *
 * The runaway paint stack overloaded the canvas with duplicate
 * elements drawn at 1080px+ scale, leaving the visible viewport
 * looking empty even though the canvas was full.
 *
 * Root fix landed elsewhere: openMarketSyncStudio now awaits
 * initStudioAdapter and calls loadStudioTemplate exactly once with
 * the requested template key. The single-call path is correct and
 * requires no re-hydration. This module's wrapping strategy was a
 * workaround for a race condition that is now genuinely fixed.
 *
 * Left as a no-op so any script tag that references it still loads
 * without a 404, and any code that imports the module gets a
 * defined global.
 */
(function (global) {
  'use strict'
  global.__studioHydrateDisabled = true
})(window)
