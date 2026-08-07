// ── MarketSync Frontend: Main Dashboard Controller & Navigation Orchestrator ────
// Keeps dashboard operations modular, under 1000 lines, delegating domain logic to
// submodules loaded in dashboard.html (dept-nav, core-init, timeclock-hr, compliance-academy,
// commission-engine, crm-pipeline, inventory-intel, fni-desking, service-parts, analytics-reports).

var profileContext = window.profileContext || null;
var activePageId = window.activePageId || 'insights';

// ── DOM Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    document.body.classList.add('ms-role-ready');
    const navDesktop = document.getElementById('nav-desktop');
    if (navDesktop) navDesktop.classList.remove('nav-init');

    await initDashboardSession();
    bindNavigationEvents();
    bindGlobalShortcutKeys();
    bindQuickActionModals();
    initializeDefaultView();
  } catch (err) {
    console.error('Dashboard init error:', err);
    document.body.classList.add('ms-role-ready');
    const navDesktop = document.getElementById('nav-desktop');
    if (navDesktop) navDesktop.classList.remove('nav-init');
    if (typeof showToast === 'function') showToast('Dashboard loaded with degraded state: ' + err.message, 'error');
  }
});

// ── Session & User Context Bootstrapping ──────────────────────────────────────
async function initDashboardSession() {
  document.body.classList.add('ms-role-ready');
  const navDesktop = document.getElementById('nav-desktop');
  if (navDesktop) navDesktop.classList.remove('nav-init');

  const storedToken = localStorage.getItem('token');
  if (!storedToken) {
    profileContext = profileContext || { name: 'Demo User', role: 'DEALER_ADMIN', email: 'admin@marketsync.com' };
  } else {
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) profileContext = JSON.parse(rawUser);
    } catch (e) {
      profileContext = null;
    }
  }

  try {
    if (typeof apiGetJson === 'function' && storedToken) {
      const userPromise = apiGetJson('/auth/me', { retries: 1, timeoutMs: 3000 }).catch(() => null);
      const accessPromise = apiGetJson('/access/context', { retries: 1, timeoutMs: 3000 }).catch(() => null);

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
    console.warn('Bootstrap background access fetch timed out, using fallback session');
  }

  updateProfileHeaderUI();
  updateRolePermissionsUI();
}
window.initDashboardSession = initDashboardSession;

function updateProfileHeaderUI() {
  document.body.classList.add('ms-role-ready');
  if (!profileContext) return;

  const nameEl = document.getElementById('ui-profile-name') || document.getElementById('user-display-name');
  const roleEl = document.getElementById('ui-role-pill') || document.getElementById('user-display-role');
  const dealerEl = document.getElementById('ui-dealership-name');
  const avatarEl = document.getElementById('user-avatar-img');

  if (nameEl) nameEl.textContent = profileContext.name || profileContext.email || 'Staff Member';
  if (roleEl) roleEl.textContent = (profileContext.role || 'Sales Rep').replace('_', ' ');
  if (dealerEl) dealerEl.textContent = profileContext.dealership_name || profileContext.dealer_name || 'MarketSync Store';
  if (avatarEl && profileContext.avatar_url) avatarEl.src = profileContext.avatar_url;
}

function updateRolePermissionsUI() {
  document.body.classList.add('ms-role-ready');
  if (!profileContext) return;
  const role = (profileContext.role || 'DEALER_ADMIN').toUpperCase();
  const isAdmin = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ADMIN'].includes(role);

  document.querySelectorAll('[data-admin-nav], [data-admin-only]').forEach(el => {
    if (isAdmin) el.classList.remove('hidden');
    else el.classList.add('hidden');
  });

  if (typeof renderDeptNav === 'function') {
    renderDeptNav(role);
  }

  const rr = document.getElementById('report-rail');
  if (rr) rr.classList.remove('hidden');

  if (typeof renderSetupBar === 'function') {
    try { renderSetupBar(); } catch(e) {}
  }

  if (typeof updateShiftClockUI === 'function') {
    updateShiftClockUI();
  }
}

// ── Tab & Navigation Router ───────────────────────────────────────────────────
function switchPage(pageId, options = {}) {
  if (!pageId) return;
  document.body.classList.add('ms-role-ready');

  if (pageId === 'overview' || pageId === 'dashboard') pageId = 'insights';

  // 1. Hide all .page-content elements
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));

  // 2. Locate target container by data-page-content, element id, or page- prefix
  let targetPage = document.querySelector(`[data-page-content="${pageId}"]`) ||
                     document.getElementById(`page-${pageId}`) ||
                     document.getElementById(pageId);

  if (!targetPage) {
    const pagesHost = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (pagesHost) {
      targetPage = document.createElement('div');
      targetPage.setAttribute('data-page-content', pageId);
      targetPage.className = 'page-content hidden space-y-6';
      targetPage.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6"><h2 class="text-xl font-bold capitalize text-slate-900 dark:text-white mb-2">${pageId.replace(/-/g, ' ')}</h2><p class="text-sm text-slate-500">Loading module workspace...</p></div>`;
      pagesHost.appendChild(targetPage);
    }
  }

  if (targetPage) {
    targetPage.classList.remove('hidden');
  }

  // 3. Highlight active navigation item
  document.querySelectorAll('.nav-item').forEach(btn => {
    const btnPage = btn.getAttribute('data-page');
    const isTarget = btnPage === pageId || btn.id === `nav-${pageId}`;
    if (isTarget) {
      btn.setAttribute('aria-current', 'page');
      btn.classList.add('bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-600', 'dark:text-indigo-400', 'font-bold');
    } else {
      btn.removeAttribute('aria-current');
      btn.classList.remove('bg-indigo-50', 'dark:bg-indigo-950/50', 'text-indigo-600', 'dark:text-indigo-400', 'font-bold');
    }
  });

  activePageId = pageId;
  window.activePageId = pageId;

  if (typeof renderDeptTabbar === 'function') {
    renderDeptTabbar(pageId);
  }
  if (typeof highlightDeptNav === 'function') {
    highlightDeptNav(pageId);
  }

  try {
    if (window.location.hash !== `#${pageId}`) {
      window.history.replaceState(null, '', `#${pageId}`);
    }
  } catch (e) {}

  closeMobileSidebar();
  dispatchSubmodulePageLoad(pageId, options);
}
window.switchPage = switchPage;
window.showPage = switchPage;

function dispatchSubmodulePageLoad(pageId, options) {
  switch (pageId) {
    case 'insights':
    case 'overview':
      if (typeof updateShiftClockUI === 'function') updateShiftClockUI();
      if (typeof renderDashboardAnalytics === 'function') renderDashboardAnalytics();
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
  const sidebar = document.getElementById('mobile-sidebar') || document.getElementById('nav-more-menu');
  if (sidebar) sidebar.classList.remove('hidden', '-translate-x-full');
}
window.openMobileSidebar = openMobileSidebar;

function closeMobileSidebar() {
  const sidebar = document.getElementById('mobile-sidebar') || document.getElementById('nav-more-menu');
  if (sidebar) sidebar.classList.add('hidden');
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
        switchPage(page);
      }
    }
  });

  const mobileToggle = document.getElementById('mobile-menu-toggle') || document.getElementById('nav-more');
  if (mobileToggle) mobileToggle.addEventListener('click', openMobileSidebar);

  const mobileClose = document.getElementById('nav-more-close');
  if (mobileClose) mobileClose.addEventListener('click', closeMobileSidebar);

  const signOutBtn = document.getElementById('logout-btn') || document.getElementById('btn-sign-out');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (typeof msSignOut === 'function') msSignOut();
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('login.html');
      }
    });
  }
}

// ── Global Keyboard Shortcuts ─────────────────────────────────────────────────
function bindGlobalShortcutKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-dialog:not(.hidden), [id$="-modal"]:not(.hidden)').forEach(m => m.classList.add('hidden'));
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
}

function initializeDefaultView() {
  document.body.classList.add('ms-role-ready');
  if (typeof renderDeptNav === 'function') {
    renderDeptNav(profileContext?.role || 'DEALER_ADMIN');
  }

  const hashPage = window.location.hash.replace('#', '');
  if (hashPage) {
    switchPage(hashPage);
  } else {
    switchPage('insights');
  }
}

// ── Window Namespace Exports ──────────────────────────────────────────────────
window.profileContext = profileContext;
window.activePageId = activePageId;
