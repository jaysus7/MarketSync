# CLAUDE.md

**Start here, in this order:**

1. **[docs/SESSION_HANDOFF.md](./docs/SESSION_HANDOFF.md)** — current state, what
   landed, the next recommended slice, and the acceptance gates to run.
2. **[docs/DEALEROS_ROADMAP.md](./docs/DEALEROS_ROADMAP.md)** — the ONE phase authority
   (what is done, what is next). No other document's phase numbers override it.
3. **[AGENTS.md](./AGENTS.md)** — **Part A** is the governing product/architecture
   law (canonical records, frozen kernel, audit-before-code, entitlements,
   security); **Part B** is the frontend guardrails. Both are binding.
4. **[docs/DEALER_OS_UX_ARCHITECTURE.md](./docs/DEALER_OS_UX_ARCHITECTURE.md)** — how the
   Dealer OS UI actually works (engine registration, tabs, gating, department rules).
   Read before building or changing a department.
5. **[docs/KERNEL_CONTRACT.md](./docs/KERNEL_CONTRACT.md)** — frozen.

MarketSync is a **dealer operating system**, not a set of features. Employees
navigate their dealership, not our software architecture. Audit before coding;
prefer KEEP > FIX > MOVE > MERGE > BUILD > DELETE; never weaken a test or bypass
RLS/RBAC/MFA/entitlements to make work pass.

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
