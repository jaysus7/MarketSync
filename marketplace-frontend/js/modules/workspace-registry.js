// ── DealerOS Workspace Registry ──────────────────────────────────────────────
// ✅ SINGLE SOURCE OF TRUTH for dashboard navigation.
//
// Desktop sidebar, the local workspace tab-bar and the mobile bottom row all derive
// from THIS file. To add / rename / reorder / gate a navigation entry, edit here —
// nowhere else. (`DEPARTMENTS` in dashboard-part2.js is now just an alias of
// MS_WORKSPACES, kept so the existing renderers work untouched. The `#nav-desktop`
// tree in dashboard.html remains LEGACY and hidden — never edit nav there.)
//
// Employees navigate their DEALERSHIP, not our software architecture. System
// engines — Customer/CRM, Automation, AI, Integration, Analytics, Communication,
// Configuration, Marketplace — are deliberately NOT primary departments; they power
// the workspaces underneath (Doc 21 §10 Shared Platform Services).
//
// Shape is intentionally identical to the previous DEPARTMENTS registry:
//   { label, icon, accent, mgr?|roles?, probe?, always?, system?, pages: [ {page,label,invmode?,mgr?,roles?} ] }
// so renderDeptNav() / renderDeptTabbar() / applyMobileQuickRow() consume it as-is.
//
// GATING IS NOT DEFINED HERE. Role (`mgr`/`roles`), plan entitlement (PAGE_FEATURE /
// PAGE_PRODUCT), dealer feature flags (PAGE_DEALER_FLAG) and product/staff tiers are
// applied by dashboard-part2.js exactly as before. This registry only decides
// GROUPING and LABELS. Every `page` value below is an existing [data-page-content]
// container — Phase 1 moves access points, it does not add or remove pages.

const MS_WORKSPACES = {
  // ── Management My Day — one entry; the command engine owns its local tabs ──
  executive: {
    label: 'My Day', icon: 'chart', accent: 'indigo', mgr: true,
    pages: [
      { page: 'command', label: 'My Day' },
      // Deep-link identities retained for bookmarks and contextual actions. `legacy`
      // keeps them out of the department header so Management has one nav system.
      { page: 'leaderboard', label: 'Performance', legacy: true },
      { page: 'operations', label: 'Operations', legacy: true },
      { page: 'taskboard', label: 'Task Board', legacy: true },
      { page: 'reports', label: 'Reports', legacy: true },
    ],
  },

  // ── Sales — the highest-frequency workspace; visible to every rep ──────────
  // Sales is the DealerOS REFERENCE department (Phase 2). The `sales` page is an
  // engine-shell workspace (Today / Work / Insights / Automation / Settings) that
  // composes the existing Sales pages rather than replacing them — see
  // js/modules/sales-workspace.js and docs/SALES_PHASE2_AUDIT.md.
  //
  // The individual pages below stay in the tab-bar so every existing entry point,
  // deep link and bookmark keeps working; `sales` simply leads.
  sales: {
    label: 'Sales', icon: 'currency', accent: 'amber',
    pages: [
      { page: 'sales', label: 'My Day' },
      { page: 'crm', label: 'Customers' },
      { page: 'appointments', label: 'Appointments' },
      { page: 'tasks', label: 'Tasks' },
      { page: 'leads', label: 'Leads', mgr: true },
      { page: 'insights', label: 'Insights', mgr: true },
      // "My commission" — a rep-facing page whose only access point lived in the
      // retired legacy tree, leaving it unreachable. Restored here (all roles);
      // managers also reach it via Accounting → Payroll.
      { page: 'commissions', label: 'My Commission' },
    ],
  },

  // ── Inventory — one vehicle lifecycle: acquire → recon → price → publish ──
  // Absorbs Appraisals + Equity Mining (were Sales), Cleanup/Recon (was its own
  // department), Inventory Intelligence + Market (were Sales), and Facebook
  // Marketplace publishing (was Marketing). ONE inventory pool — the Vehicles and
  // Syndication tabs are two views of the same page via __inventoryMode.
  inventory: {
    label: 'Inventory', icon: 'gem', accent: 'sky',
    pages: [
      { page: 'inventory-overview', label: 'My Day' },
      { page: 'inventory', label: 'Vehicles', invmode: 'manual' },
      { page: 'appraisal', label: 'Acquire' },
      { page: 'equity', label: 'Equity Mining' },
      { page: 'recon', label: 'Recon' },
      { page: 'inv-intel', label: 'Pricing', mgr: true },
      { page: 'market', label: 'Market', mgr: true },
      { page: 'inventory', label: 'Syndication', invmode: 'facebook' },
    ],
  },

  // ── F&I — first-class workspace. Desk-a-deal stays contextual (per customer).
  fni: {
    label: 'F&I', icon: 'shield', accent: 'indigo', roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'],
    pages: [
      { page: 'fni-overview', label: 'My Day' },
      { page: 'fni', label: 'Deals' },
      { page: 'delivery', label: 'Delivery', mgr: true },
    ],
  },

  service: {
    label: 'Service', icon: 'wrench', accent: 'sky', mgr: true,
    pages: [
      { page: 'service-overview', label: 'My Day' },
      { page: 'service-appointments', label: 'Schedule' },
      { page: 'service-ros', label: 'Repair Orders' },
    ],
  },

  parts: {
    label: 'Parts', icon: 'gem', accent: 'amber', mgr: true,
    pages: [
      { page: 'parts-overview', label: 'My Day' },
      { page: 'service-parts', label: 'Catalogue' },
    ],
  },

  // The Accounting page renders its own rich internal menu (Financials, Insights,
  // Reconciliation, Tax…) — that menu IS its local nav, so Overview is one entry.
  accounting: {
    label: 'Accounting', icon: 'currency', accent: 'emerald', probe: '#grp-accounting-wrap', mgr: true,
    pages: [
      { page: 'accounting-overview', label: 'My Day' },
      { page: 'accounting', label: 'Overview' },
      { page: 'commissions', label: 'Payroll' },
    ],
  },

  marketing: {
    label: 'Marketing', icon: 'megaphone', accent: 'violet', mgr: true,
    pages: [
      { page: 'marketing-overview', label: 'My Day' },
      { page: 'email-marketing', label: 'Campaigns' },
      { page: 'website', label: 'Website' },
      { page: 'ai-home', label: 'AI Chat' },
      // Same story as `commissions`: a working page whose access point was lost.
      { page: 'ai-inbox', label: 'AI Inbox' },
    ],
  },

  // ── People — the employee lifecycle (was "Administration") ────────────────
  people: {
    label: 'People', icon: 'user', accent: 'emerald', mgr: true,
    pages: [
      { page: 'people-overview', label: 'My Day' },
      // Retained as redirect/deep-link identities only. The People engine owns Team and
      // Compliance, so these must never render a second department tab row.
      { page: 'sales-team', label: 'Employees', legacy: true },
      { page: 'people-compliance', label: 'Compliance', legacy: true },
    ],
  },

  // ── Academy — system rail, NOT a tenth department and NOT inside People ────
  // The nine departments are how a dealership is organised; learning is not one of them, so
  // Academy carries `system: true` and renders below the divider next to Settings.
  //
  // It is deliberately not a page under People either: People is manager-only, and everybody
  // has required training. A salesperson who cannot reach the courses they are required to
  // complete is the same defect as having no courses at all. The manager view is the Team tab
  // inside the workspace, which gates itself on `staff.training.view`.
  academy: {
    label: 'Academy', icon: 'sparkles', accent: 'violet', system: true,
    pages: [
      { page: 'academy', label: 'Your Learning' },
    ],
  },

  // ── Setup — the ONE Launch Hub, in the system rail beside Settings ────────
  // Manager-only because satisfying a requirement needs settings.manage; the hub itself gates
  // nothing and blocks nobody. See js/modules/launch-workspace.js.
  launch: {
    label: 'Set up', icon: 'shield', accent: 'indigo', system: true, mgr: true,
    pages: [
      { page: 'launch', label: 'Set up your dealership' },
    ],
  },

  // ── System — rendered in the bottom/system section, not as a department ────
  // Automation deliberately lives HERE, not in a department: contextual automation
  // belongs inside workspaces, global advanced automation belongs in Settings.
  settings: {
    label: 'Settings', icon: 'shield', accent: 'indigo', system: true, mgr: true,
    pages: [
      { page: 'config', label: 'Settings' },
      { page: 'automation-builder', label: 'Automation', legacy: true },
      { page: 'api-keys', label: 'API Keys', legacy: true },
    ],
  },
};

// Bottom/system rail. `profile` is the header gear (always reachable, every tier).
const MS_SYSTEM_NAV = [
  { id: 'ask', label: 'Ask MarketSync', icon: 'sparkles', action: 'msAskOpen' },
  { id: 'notifications', label: 'Notifications', icon: 'bolt', action: 'msNotificationsOpen' },
  { id: 'settings', label: 'Settings', icon: 'shield', page: 'profile' },
];

// ── Role-aware mobile bottom navigation ──────────────────────────────────────
// Not a shrunken desktop sidebar: each role gets the 4 destinations it actually
// uses, then "More". Pages still pass every gate before rendering; an entry the
// user cannot reach is dropped rather than shown dead.
const MS_ROLE_MOBILE_NAV = {
  SALES_REP:    ['sales', 'crm', 'appointments', 'tasks'],
  FNI:          ['fni-overview', 'crm', 'appointments', 'tasks'],
  SERVICE:      ['service-ros', 'service-appointments', 'crm', 'tasks'],
  CLEANUP:      ['recon', 'taskboard'],
  ACCOUNTING:   ['accounting', 'commissions', 'crm', 'tasks'],
  MANAGER:      ['command', 'sales', 'inventory-overview', 'tasks'],
  OWNER:        ['command', 'sales', 'inventory-overview', 'tasks'],
  DEALER_ADMIN: ['command', 'sales', 'inventory-overview', 'tasks'],
};
const MS_MOBILE_NAV_DEFAULT = ['insights', 'crm', 'tasks'];

// ── Pure structural helpers (no DOM, no gating — safe to unit test) ──────────

// Every distinct page id referenced by the registry.
function msAllWorkspacePages(reg) {
  const r = reg || MS_WORKSPACES;
  const out = new Set();
  Object.values(r).forEach(w => (w.pages || []).forEach(p => out.add(p.page)));
  return [...out];
}

// Which workspace owns a page id (first match wins — mirrors renderDeptTabbar).
function msWorkspaceOfPage(pageId, reg) {
  const r = reg || MS_WORKSPACES;
  return Object.keys(r).find(id => (r[id].pages || []).some(p => p.page === pageId)) || null;
}

// The ordered mobile page list for a role (structural only; caller applies gates).
function msMobileNavForRole(role) {
  return MS_ROLE_MOBILE_NAV[role] || MS_MOBILE_NAV_DEFAULT;
}

// Departments (non-system) in sidebar order.
function msDepartmentIds(reg) {
  const r = reg || MS_WORKSPACES;
  return Object.keys(r).filter(id => !r[id].system);
}

if (typeof window !== 'undefined') {
  window.MS_WORKSPACES = MS_WORKSPACES;
  window.MS_SYSTEM_NAV = MS_SYSTEM_NAV;
  window.MS_ROLE_MOBILE_NAV = MS_ROLE_MOBILE_NAV;
  window.msAllWorkspacePages = msAllWorkspacePages;
  window.msWorkspaceOfPage = msWorkspaceOfPage;
  window.msMobileNavForRole = msMobileNavForRole;
  window.msDepartmentIds = msDepartmentIds;
}
