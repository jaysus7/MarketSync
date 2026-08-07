// ── MarketSync Frontend: Main Dashboard Controller & Navigation Orchestrator ────
// Keeps dashboard operations modular, under 1000 lines, delegating domain logic to
// submodules loaded in dashboard.html (core-init, timeclock-hr, compliance-academy,
// commission-engine, crm-pipeline, inventory-intel, fni-desking, service-parts, analytics-reports).

var profileContext = window.profileContext || null;
var activePageId = window.activePageId || 'overview';

// ── DOM Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDashboardSession();
    bindNavigationEvents();
    bindGlobalShortcutKeys();
    bindQuickActionModals();
    initializeDefaultView();
  } catch (err) {
    console.error('Dashboard init error:', err);
    if (typeof showToast === 'function') showToast('Dashboard loaded with degraded state: ' + err.message, 'error');
  }
});

// ── Session & User Context Bootstrapping ──────────────────────────────────────
async function initDashboardSession() {
  const storedToken = localStorage.getItem('token');
  if (!storedToken) {
    window.location.replace('login.html');
    return;
  }

  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) profileContext = JSON.parse(rawUser);
  } catch (e) {
    profileContext = null;
  }

  // Fetch updated profile and access context asynchronously with timeout protection
  try {
    if (typeof apiGetJson === 'function') {
      const userPromise = apiGetJson('/auth/me', { retries: 1, timeoutMs: 4000 });
      const accessPromise = apiGetJson('/access/context', { retries: 1, timeoutMs: 4000 }).catch(() => null);

      const [userRes, accessRes] = await Promise.all([userPromise, accessPromise]);
      if (userRes && userRes.user) {
        profileContext = userRes.user;
        localStorage.setItem('user', JSON.stringify(profileContext));
      }
      if (accessRes) {
        window.__access = accessRes;
      }
    }
  } catch (err) {
    console.warn('Bootstrap background access fetch timed out or failed, proceeding with cached user session');
  }

  updateProfileHeaderUI();
  updateRolePermissionsUI();
}
window.initDashboardSession = initDashboardSession;

function updateProfileHeaderUI() {
  if (!profileContext) return;
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const emailEl = document.getElementById('user-display-email');
  const avatarEl = document.getElementById('user-avatar-img');

  if (nameEl) nameEl.textContent = profileContext.name || profileContext.email || 'Staff Member';
  if (roleEl) roleEl.textContent = (profileContext.role || 'Sales Rep').replace('_', ' ');
  if (emailEl) emailEl.textContent = profileContext.email || '';
  if (avatarEl && profileContext.avatar_url) avatarEl.src = profileContext.avatar_url;
}

function updateRolePermissionsUI() {
  if (!profileContext) return;
  const role = profileContext.role || 'SALES_REP';
  const isAdmin = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role);

  document.querySelectorAll('[data-admin-nav]').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  if (typeof updateShiftClockUI === 'function') {
    updateShiftClockUI();
  }
}

// ── Tab & Navigation Router ───────────────────────────────────────────────────
function showPage(pageId, options = {}) {
  if (!pageId) return;
  const targetPage = document.getElementById(`page-${pageId}`);
  if (!targetPage) return;

  // Hide active pages
  document.querySelectorAll('.dashboard-page').forEach(p => p.classList.add('hidden'));
  targetPage.classList.remove('hidden');

  // Update nav item active styling
  document.querySelectorAll('.nav-item').forEach(btn => {
    const isTarget = btn.getAttribute('data-page') === pageId || btn.id === `nav-${pageId}`;
    if (isTarget) {
      btn.classList.add('bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-600', 'dark:text-indigo-400', 'font-bold');
      btn.classList.remove('text-slate-700', 'dark:text-slate-300', 'text-slate-600', 'dark:text-slate-400');
    } else {
      btn.classList.remove('bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-600', 'dark:text-indigo-400', 'font-bold');
    }
  });

  activePageId = pageId;
  closeMobileSidebar();

  // Lazy trigger submodule page loaders
  dispatchSubmodulePageLoad(pageId, options);
}
window.showPage = showPage;

function dispatchSubmodulePageLoad(pageId, options) {
  switch (pageId) {
    case 'overview':
    case 'dashboard':
      if (typeof updateShiftClockUI === 'function') updateShiftClockUI();
      break;
    case 'commissions':
      if (typeof loadCommissionsPage === 'function') loadCommissionsPage();
      break;
    case 'people-compliance':
      if (typeof loadComplianceAcademy === 'function') loadComplianceAcademy();
      break;
    case 'inventory':
    case 'appraisal':
    case 'equity':
      if (typeof loadEquityMiningData === 'function') loadEquityMiningData();
      break;
    case 'fni':
    case 'desk':
      if (typeof initFniDesking === 'function') initFniDesking();
      break;
    case 'service-ros':
    case 'service-appointments':
    case 'service-parts':
      if (typeof initServiceParts === 'function') initServiceParts();
      break;
    case 'leaderboard':
    case 'reports':
      if (typeof initAnalyticsReports === 'function') initAnalyticsReports();
      break;
    default:
      break;
  }
}

// ── Sidebar Group Accordion & Collapsing ─────────────────────────────────────
function toggleNavGroup(groupId) {
  if (!groupId) return;
  const body = document.getElementById(`grp-${groupId}`);
  const chev = document.getElementById(`chev-${groupId}`);
  if (!body) return;

  const isHidden = body.classList.contains('hidden');
  if (isHidden) {
    body.classList.remove('hidden');
    if (chev) chev.classList.remove('-rotate-90');
  } else {
    body.classList.add('hidden');
    if (chev) chev.classList.add('-rotate-90');
  }
}
window.toggleNavGroup = toggleNavGroup;

// ── Mobile Navigation Controls ────────────────────────────────────────────────
function openMobileSidebar() {
  const sidebar = document.getElementById('mobile-sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (sidebar) sidebar.classList.remove('-translate-x-full');
  if (overlay) overlay.classList.remove('hidden');
}
window.openMobileSidebar = openMobileSidebar;

function closeMobileSidebar() {
  const sidebar = document.getElementById('mobile-sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  if (sidebar) sidebar.classList.add('-translate-x-full');
  if (overlay) overlay.classList.add('hidden');
}
window.closeMobileSidebar = closeMobileSidebar;

// ── Navigation Event Listeners ────────────────────────────────────────────────
function bindNavigationEvents() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-page]');
    if (target) {
      const page = target.getAttribute('data-page');
      if (page) {
        e.preventDefault();
        showPage(page);
      }
    }
  });

  const mobileToggle = document.getElementById('mobile-menu-toggle');
  if (mobileToggle) mobileToggle.addEventListener('click', openMobileSidebar);

  const mobileOverlay = document.getElementById('mobile-sidebar-overlay');
  if (mobileOverlay) mobileOverlay.addEventListener('click', closeMobileSidebar);

  const signOutBtn = document.getElementById('btn-sign-out');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (typeof msSignOut === 'function') msSignOut();
      else if (typeof executeActualSignOut === 'function') executeActualSignOut();
    });
  }
}

// ── Global Keyboard Shortcuts ─────────────────────────────────────────────────
function bindGlobalShortcutKeys() {
  document.addEventListener('keydown', (e) => {
    // ESC closes open modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-dialog:not(.hidden)').forEach(m => m.classList.add('hidden'));
    }
    // Command/Ctrl + K focuses global search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('global-search-input');
      if (searchInput) searchInput.focus();
    }
  });
}

// ── Quick Action Modals & Dialog Triggers ──────────────────────────────────────
function bindQuickActionModals() {
  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      filterDashboardGlobalSearch(query);
    });
  }
}

function filterDashboardGlobalSearch(query) {
  if (!query) return;
  // Global search filtering across active page tables and cards
}

function initializeDefaultView() {
  const hashPage = window.location.hash.replace('#', '');
  if (hashPage && document.getElementById(`page-${hashPage}`)) {
    showPage(hashPage);
  } else {
    showPage('overview');
  }
}

// ── Window Namespace Exports ──────────────────────────────────────────────────
window.profileContext = profileContext;
window.activePageId = activePageId;
