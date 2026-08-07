# MarketSync — agent guardrails (READ BEFORE EDITING THE FRONTEND)

These rules exist because well-meaning automated edits repeatedly broke the
dashboard and the marketing site. **Keep everything working exactly as it is
now.** Do not "improve", "restore", "modernize", or "re-modularize" the areas
below unless a human explicitly asks for that specific change.

## 1. Dashboard navigation — data-driven, ONE source of truth

- The live sidebar nav is the **department nav** (`#dept-nav`), built at runtime by
  `renderDeptNav()` from the **`DEPARTMENTS`** (and `SAAS_DEPARTMENTS`) registry in
  `marketplace-frontend/js/modules/dashboard-part2.js`.
- **To add / rename / reorder / gate a nav item or department, edit `DEPARTMENTS`
  there — nowhere else.**
- The static `#nav-desktop` tree in `marketplace-frontend/dashboard.html` is
  **LEGACY and hidden at runtime** (`.nav-init` / `.dept-mode`). It is kept ONLY so
  existing role/tier feature-gating selectors keep resolving. **Do NOT add nav items
  to it, surface it, un-hide it, or wire it up.** It is not the navigation.

## 2. `dashboard.js` is split — do NOT reorder or feature-split

- `marketplace-frontend/dashboard.js` + `marketplace-frontend/js/modules/dashboard-part*.js`
  are a **contiguous, load-order-critical split** of one original script. Concatenated
  in the order they are listed in `dashboard.html`, they equal the original file
  byte-for-byte, so global scope/behavior is preserved.
- **Do NOT reorder the `<script>` tags** in `dashboard.html`, and do not move code
  between parts casually.
- **Do NOT attempt a feature-based re-modularization** (extracting functions into
  standalone ES modules / rewiring dependencies). That has broken the dashboard with
  runtime `ReferenceError`s multiple times. If a real refactor is needed, do it
  incrementally and verify the dashboard still loads (see §4) after every step.

## 3. Public marketing pages — shared shell, no inline headers

- Public pages (`index.html`, `features.html`, `compare.html`, `faq.html`, `blog.html`,
  `guide.html`, `support.html`, `security.html`, `privacy-policy.html`, `terms.html`,
  `affiliates.html`, and the product/feature landing pages, plus `dealer-os.html` /
  `ai-chatbot.html` / `facebook-autoposter.html`) render their header/footer from the
  **shared shell**: mount points `#ms-public-header` / `#ms-public-footer` +
  `/assets/public-shell.js` + `/assets/auth.js`.
- **Do NOT inline a page header/footer, and do NOT re-introduce the old "The Loop"
  anchor menu.** To change site nav/footer, edit `marketplace-frontend/assets/public-shell.js`.
- Auth-aware nav goes through `/assets/auth.js` (`MSAuth.isAuthenticated()`), never a
  bare `localStorage` token check.
- App/auth pages are intentionally NOT on the shell: `dashboard.html`, `chat-widget.html`,
  `site.html`, `post.html`, `esign.html`, `group.html`, `training.html`, `affiliate.html`
  (affiliate dashboard), `marketsync-guide.html`, `upgrade.html`, `login/register/forgot/reset`.

## 4. Verify before you commit frontend changes

- Backend suite: `cd marketplace-backend && npm test` (includes `test/public-shell.test.js`).
- Dashboard "does it still load?" check: serve `marketplace-frontend/` and load
  `dashboard.html` in a headless browser with a seeded token; it must render the
  department nav with **no `ReferenceError` / `SyntaxError`** (only backend-network
  errors are expected offline).

## 5. Deploy reality

- Production (`marketsync.link`) deploys from **`main`** (see `render.yaml`); the
  staging site deploys from `staging`. Work merged to `staging` is NOT live on
  `marketsync.link` until `staging` is promoted to `main`.
