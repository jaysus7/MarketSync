# CLAUDE.md

Follow **[AGENTS.md](./AGENTS.md)** — it contains the guardrails for this repo.

Highest-priority rules (see AGENTS.md for detail):

1. **Dashboard nav:** edit `MS_WORKSPACES` in
   `marketplace-frontend/js/modules/workspace-registry.js` — the ONE registry behind the
   desktop sidebar, workspace tabs and mobile nav. (`DEPARTMENTS` in `dashboard-part2.js`
   is now just an alias of it.) The `#nav-desktop` tree in `dashboard.html` is
   LEGACY/hidden — never edit or surface it. See `docs/DEALEROS_UI_AUDIT.md`.
2. **`dashboard.js` split** (`dashboard.js` + `js/modules/dashboard-part*.js`) is
   contiguous and load-order-critical. Don't reorder script tags; don't feature-split.
3. **Public pages** use the shared shell (`#ms-public-header`/`#ms-public-footer` +
   `/assets/public-shell.js` + `/assets/auth.js`). Don't inline headers or bring back
   the old "Loop" menu.
4. Keep everything working **as it is now**. Verify the dashboard still loads and
   `npm test` passes before committing frontend changes.
