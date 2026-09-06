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
  executive: {
    label: 'Pulse', icon: 'chart', accent: 'market', mgr: true,
    pages: [
      { page: 'command', label: 'Pulse' },
      { page: 'academy', label: 'Academy', legacy: true },
      { page: 'leaderboard', label: 'Performance', legacy: true },
      { page: 'operations', label: 'Operations', legacy: true },
      { page: 'taskboard', label: 'Task Board', legacy: true },
      { page: 'reports', label: 'Reports', legacy: true },
    ],
  },

  sales: {
    label: 'Sales', icon: 'currency', accent: 'market',
    pages: [
      { page: 'sales', label: 'Pulse' },
      { page: 'crm', label: 'Customers', legacy: true },
      { page: 'appointments', label: 'Appointments', legacy: true },
      { page: 'tasks', label: 'Tasks', legacy: true },
      { page: 'leads', label: 'Leads', mgr: true, legacy: true },
      { page: 'commissions', label: 'My Commission', legacy: true },
      { page: 'appraisal', label: 'Appraise Trade', legacy: true },
    ],
  },

  inventory: {
    label: 'Inventory', icon: 'gem', accent: 'market',
    pages: [
      { page: 'inventory-overview', label: 'Pulse' },
      { page: 'inventory', label: 'Vehicles', invmode: 'manual', legacy: true },
      { page: 'equity', label: 'Equity Mining', legacy: true },
      { page: 'market', label: 'Market & Competitors', mgr: true, legacy: true },
    ],
  },

  cleanup: {
    label: 'Cleanup', icon: 'droplet', accent: 'market',
    pages: [
      { page: 'recon', label: 'Cleanup' },
    ],
  },

  fni: {
    label: 'F&I', icon: 'shield', accent: 'market', roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'],
    pages: [
      { page: 'fni-overview', label: 'Pulse' },
      { page: 'fni', label: 'Deals', legacy: true },
      { page: 'delivery', label: 'Delivery', mgr: true },
    ],
  },

  service: {
    label: 'Service', icon: 'wrench', accent: 'market', mgr: true,
    pages: [
      { page: 'service-overview', label: 'Pulse' },
      { page: 'service-appointments', label: 'Schedule', legacy: true },
      { page: 'service-ros', label: 'Repair Orders', legacy: true },
    ],
  },

  parts: {
    label: 'Parts', icon: 'gem', accent: 'market', mgr: true,
    pages: [
      { page: 'parts-overview', label: 'Pulse' },
      { page: 'service-parts', label: 'Catalogue' },
    ],
  },

  accounting: {
    label: 'Accounting', icon: 'currency', accent: 'market', probe: '#grp-accounting-wrap', mgr: true,
    pages: [
      { page: 'accounting-overview', label: 'Pulse' },
      { page: 'accounting', label: 'Overview' },
      { page: 'commissions', label: 'Payroll' },
    ],
  },

  marketing: {
    label: 'Marketing', icon: 'megaphone', accent: 'market', mgr: true,
    pages: [
      { page: 'website', label: 'Website Studio', anyFeature: ['os.website', 'website.builder', 'website.pages'] },
      { page: 'marketing-overview', label: 'Design Studio', tab: 'studio', anyFeature: ['design.canvas', 'design.templates', 'os.marketing'] },
      { page: 'video-studio', label: 'Video Studio', anyFeature: ['video.library', 'video.record', 'os.marketing'] },
      { page: 'automation-builder', label: 'Email/SMS Studio', tab: 'campaigns', studio: 'email', anyFeature: ['os.email_marketing', 'email.campaigns', 'email.templates', 'email.audiences'] },
      { page: 'automation-builder', label: 'Automations Studio', tab: 'automations', studio: 'automation', anyFeature: ['os.automations', 'email.automations'] },
      { page: 'email-marketing', label: 'Email Marketing', legacy: true },
      { page: 'discoverability', label: 'Discoverability', legacy: true },
      { page: 'seo', label: 'SEO', legacy: true },
      { page: 'blog', label: 'Blog', legacy: true },
      { page: 'social-scheduler', label: 'Social Scheduler', legacy: true },
      { page: 'ai-home', label: 'AI Customer Agent', legacy: true },
      { page: 'ai-inbox', label: 'Messaging', legacy: true },
    ],
  },

  people: {
    label: 'HR', icon: 'user', accent: 'market', mgr: true,
    pages: [
      { page: 'people-overview', label: 'Pulse' },
      { page: 'sales-team', label: 'Employees', legacy: true },
      { page: 'people-compliance', label: 'Compliance', legacy: true },
    ],
  },

  academy: {
    label: 'Academy', icon: 'sparkles', accent: 'market', system: true,
    pages: [
      { page: 'academy', label: 'Your Learning' },
    ],
  },

  settings: {
    label: 'Settings', icon: 'shield', accent: 'market', system: true, hideFromSidebar: true,
    pages: [
      { page: 'config', label: 'Settings' },
      { page: 'automation-builder', label: 'Automations', mgr: true, legacy: true },
      { page: 'api-keys', label: 'Integrations', mgr: true, legacy: true },
    ],
  },

};

const MS_SYSTEM_NAV = [
  { id: 'messaging', label: 'Messaging', icon: 'chat', page: 'ai-inbox' },
  { id: 'notifications', label: 'Notifications', icon: 'bolt', action: 'msNotificationsOpen' },
  { id: 'settings', label: 'Settings', icon: 'shield', page: 'profile' },
];

const MS_ROLE_MOBILE_NAV = {
  SALES_REP:    ['command', 'video-studio', 'website', 'inventory', 'leaderboard'],
  FNI:          ['fni-overview', 'crm', 'appointments', 'tasks'],
  SERVICE:      ['service-ros', 'service-appointments', 'crm', 'tasks'],
  CLEANUP:      ['recon', 'taskboard'],
  ACCOUNTING:   ['accounting', 'commissions', 'crm', 'tasks'],
  MANAGER:      ['command', 'sales', 'inventory-overview', 'website'],
  OWNER:        ['command', 'sales', 'inventory-overview', 'website'],
  DEALER_ADMIN: ['command', 'sales', 'inventory-overview', 'website'],
};
const MS_MOBILE_NAV_DEFAULT = ['sales', 'crm', 'tasks'];

function msAllWorkspacePages(reg) {
  const r = reg || MS_WORKSPACES;
  const out = new Set();
  Object.values(r).forEach(w => (w.pages || []).forEach(p => out.add(p.page)));
  return [...out];
}

function msWorkspaceOfPage(pageId, reg) {
  const r = reg || MS_WORKSPACES;
  return Object.keys(r).find(id => (r[id].pages || []).some(p => p.page === pageId)) || null;
}

function msMobileNavForRole(role) {
  return MS_ROLE_MOBILE_NAV[role] || MS_MOBILE_NAV_DEFAULT;
}

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
