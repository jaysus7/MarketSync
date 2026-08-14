// ── DealerOS Workspace Registry ──────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH for dashboard navigation.
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
  // ── My Day — one entry; the command engine owns its local tabs ────────────
  // Academy sits here now: required training is something you owe TODAY, so it belongs
  // in the day rather than in a rail nobody scrolls to. Outstanding courses surface in
  // My Day itself and disappear as they are completed.
  executive: {
    label: 'My Day', icon: 'chart', accent: 'indigo', mgr: true,
    pages: [
      { page: 'command', label: 'Pulse' },
      // Academy belongs to the day, but as `legacy` — a plain page here would draw a
      // SECOND tab row above the command engine's own header, which is the exact
      // duplicate-header problem this registry exists to prevent. What the user
      // actually sees is the outstanding-courses list inside My Day itself
      // (cmdAcademyStrip in dashboard-part11.js), which empties as courses are
      // completed and fills again when new ones are assigned.
      { page: 'academy', label: 'Academy', legacy: true },
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
      { page: 'appraisal', label: 'Appraisals' },
      { page: 'crm', label: 'Customers', legacy: true },
      { page: 'appointments', label: 'Appointments', legacy: true },
      { page: 'tasks', label: 'Tasks', legacy: true },
      { page: 'leads', label: 'Leads', mgr: true, legacy: true },
      { page: 'insights', label: 'Insights', mgr: true, legacy: true },
      { page: 'commissions', label: 'My Commission', legacy: true },
    ],
  },

  inventory: {
    label: 'Inventory', icon: 'gem', accent: 'sky',
    pages: [
      { page: 'inventory-overview', label: 'My Day' },
      { page: 'appraisal', label: 'Appraisals' },
      { page: 'inventory', label: 'Vehicles', invmode: 'manual', legacy: true },
      { page: 'equity', label: 'Equity Mining' },
      { page: 'inv-intel', label: 'Inventory Intelligence', mgr: true, legacy: true },
      { page: 'market', label: 'Market & Competitors', mgr: true, legacy: true },
    ],
  },

  fni: {
    label: 'F&I', icon: 'shield', accent: 'indigo', roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'],
    pages: [
      { page: 'fni-overview', label: 'My Day' },
      { page: 'fni', label: 'Deals' },
      { page: 'delivery', label: 'Delivery', mgr: true },
    ],
  },

  recon: {
    label: 'Cleanup', icon: 'sparkles', accent: 'sky',
    pages: [
      { page: 'recon', label: 'My Day' },
    ],
  },

  service: {
    label: 'Service', icon: 'wrench', accent: 'sky', mgr: true,
    pages: [
      { page: 'service-overview', label: 'My Day' },
      { page: 'service-appointments', label: 'Schedule', legacy: true },
      { page: 'service-ros', label: 'Repair Orders', legacy: true },
    ],
  },

  parts: {
    label: 'Parts', icon: 'gem', accent: 'amber', mgr: true,
    pages: [
      { page: 'parts-overview', label: 'My Day' },
      { page: 'service-parts', label: 'Catalogue' },
    ],
  },

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
      { page: 'video-studio', label: 'Video Studio' },
      { page: 'ai-home', label: 'AI Chat' },
      { page: 'ai-inbox', label: 'AI Inbox' },
      { page: 'inventory', label: 'Publish to Facebook', invmode: 'facebook' },
    ],
  },

  people: {
    label: 'HR', icon: 'user', accent: 'emerald', mgr: true,
    pages: [
      { page: 'people-overview', label: 'My Day' },
      // Retained as redirect/deep-link identities only. The HR engine owns Staff and
      // Compliance, so these must never render a second department tab row.
      { page: 'sales-team', label: 'Employees', legacy: true },
      { page: 'people-compliance', label: 'Compliance', legacy: true },
    ],
  },

  // ── Academy — still in the system rail, and that is deliberate ────────────
  // It ALSO appears under My Day above, because required training is a today problem.
  // This entry is what keeps it reachable for everybody: My Day (`executive`) is
  // manager-gated, and a salesperson who cannot reach the courses they are required to
  // complete is the same defect as having no courses at all. The two entries point at
  // one page — this is a second door, never a second Academy.
  //
  // Academy is slated to become its own site rather than a page in the dashboard; when
  // that lands, this entry becomes the link out and My Day keeps the outstanding list.
  academy: {
    label: 'Academy', icon: 'sparkles', accent: 'violet', system: true,
    pages: [
      { page: 'academy', label: 'Your Learning' },
    ],
  },

  settings: {
    label: 'Settings', icon: 'shield', system: true,
    pages: [
      { page: 'profile', label: 'Settings' },
      { page: 'automation-builder', label: 'Automation', legacy: true },
      { page: 'config', label: 'Configuration', legacy: true },
      { page: 'api-keys', label: 'API Keys', legacy: true },
    ],
  },

  // Setup is NOT in the sidebar. It is one line at the foot of the shell that opens a
  // modal (msSetupModal in dashboard-part2.js) and removes itself once the dealership is
  // configured — a permanent nav entry for a job you finish once is furniture. The
  // `launch` PAGE still exists and is still reachable by deep link; it simply no longer
  // occupies a slot in the navigation forever.

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
  MANAGER:      ['command', 'sales', 'inventory-overview'],
  OWNER:        ['command', 'sales', 'inventory-overview'],
  DEALER_ADMIN: ['command', 'sales', 'inventory-overview'],
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
