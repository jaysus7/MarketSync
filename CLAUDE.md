# CLAUDE.md

Follow **[AGENTS.md](./AGENTS.md)** — it contains the guardrails for this repo.

Highest-priority rules (see AGENTS.md for detail):

1. **Dashboard nav:** edit `DEPARTMENTS` in `marketplace-frontend/js/modules/dashboard-part2.js`.
   The `#nav-desktop` tree in `dashboard.html` is LEGACY/hidden — never edit or surface it.
2. **`dashboard.js` split** (`dashboard.js` + `js/modules/dashboard-part*.js`) is
   contiguous and load-order-critical. Don't reorder script tags; don't feature-split.
3. **Public pages** use the shared shell (`#ms-public-header`/`#ms-public-footer` +
   `/assets/public-shell.js` + `/assets/auth.js`). Don't inline headers or bring back
   the old "Loop" menu.
4. Keep everything working **as it is now**. Verify the dashboard still loads and
   `npm test` passes before committing frontend changes.
