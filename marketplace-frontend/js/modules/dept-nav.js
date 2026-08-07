// ── MarketSync Department Navigation Submodule ─────────────────────────
// Manages flat department sidebar navigation and department sub-tab bars.

var esc = window.esc || function(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};
window.esc = esc;

var SVG_ICONS = {
  chart: '<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>',
  currency: '<path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  shield: '<path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.959 11.959 0 0112 2.714z"/>',
  wrench: '<path d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-4.486c.048-.58-.024-1.193-.188-1.743l-3.14 3.14a1.875 1.875 0 11-2.652-2.652l3.14-3.14c-.55-.164-1.163-.236-1.743-.188a4.5 4.5 0 00-4.486 4.486c-.048.58.024 1.193.188 1.743l-3.14-3.14a1.875 1.875 0 112.652 2.652l-3.14 3.14z"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9l3-6z"/><path d="M3 9h18M8.5 3l1.5 6L12 3l2 6 1.5-6M9.9 9L12 21l2.1-12"/>',
  droplet: '<path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z"/>',
  users: '<path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>',
  trophy: '<path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>',
  user: '<path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>',
  bolt: '<path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
  rocket: '<path d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758L16.5 21"/>',
  car: '<path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>',
  star: '<path d="M11.48 3.5a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>',
  dot: '<path d="M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0"/>',
  calendar: '<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>',
  paperclip: '<path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>',
  check: '<path d="M4.5 12.75l6 6 9-13.5"/>',
  play: '<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>',
  reopen: '<path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>',
  eye: '<path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  download: '<path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>',
  refresh: '<path d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.66 0a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>',
  receipt: '<path d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M3.75 21V4.5A1.5 1.5 0 015.25 3h13.5a1.5 1.5 0 011.5 1.5V21l-2.25-1.5L15.75 21l-2.25-1.5L11.25 21 9 19.5 6.75 21 4.5 19.5 3.75 21z"/>',
  plus: '<path d="M12 4.5v15m7.5-7.5h-15"/>',
  close: '<path d="M6 18L18 6M6 6l12 12"/>',
  chevronRight: '<path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
  chat: '<path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>',
  globe: '<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M11.5 3a15.3 15.3 0 000 18M12.5 3a15.3 15.3 0 010 18"/>',
  flame: '<path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/><path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"/>',
  megaphone: '<path d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73"/>',
  hashtag: '<path d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"/>',
  document: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>',
};

var svgIcon = function(name, cls = 'w-4 h-4') {
  const path = SVG_ICONS[name] || SVG_ICONS['dot'];
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">${path}</svg>`;
};
window.svgIcon = svgIcon;

var ENGINE_ACCENTS = window.ENGINE_ACCENTS || {
  violet: { text: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-100 dark:bg-violet-950/50', solid: 'bg-violet-600 hover:bg-violet-700' },
  indigo:  { text: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-950/40',   solid: 'bg-indigo-600 hover:bg-indigo-500' },
  sky:     { text: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-50 dark:bg-sky-950/40',         solid: 'bg-sky-600 hover:bg-sky-500' },
  emerald: { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', solid: 'bg-emerald-600 hover:bg-emerald-500' },
  amber:   { text: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40',     solid: 'bg-amber-600 hover:bg-amber-500' },
};
window.ENGINE_ACCENTS = ENGINE_ACCENTS;

var DEPARTMENTS = {
  executive: {
    label: 'Daily Briefing', icon: 'chart', accent: 'indigo', mgr: true,
    pages: [{ page: 'command', label: 'Daily Briefing' }],
  },
  sales: {
    label: 'Sales', icon: 'currency', accent: 'amber',
    pages: [
      { page: 'insights', label: 'Dashboard' },
      { page: 'crm', label: 'Customers' },
      { page: 'appointments', label: 'Appointments' },
      { page: 'tasks', label: 'Tasks' },
      { page: 'inventory', label: 'Inventory', invmode: 'manual' },
      { page: 'appraisal', label: 'Appraisals' },
      { page: 'equity', label: 'Equity Mining' },
      { page: 'leads', label: 'Opportunities', mgr: true },
      { page: 'inv-intel', label: 'Inventory Intelligence', mgr: true },
      { page: 'market', label: 'Market', mgr: true },
      { page: 'delivery', label: 'Deliveries', mgr: true },
      { page: 'reports', label: 'Reports', mgr: true },
    ],
  },
  fni: {
    label: 'F&I', icon: 'shield', accent: 'indigo', roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'],
    pages: [
      { page: 'fni', label: 'Deals' },
    ],
  },
  service: {
    label: 'Service', icon: 'wrench', accent: 'sky', mgr: true,
    pages: [
      { page: 'service-ros', label: 'Repair Orders' },
      { page: 'service-appointments', label: 'Appointments' },
    ],
  },
  parts: {
    label: 'Parts', icon: 'gem', accent: 'amber', mgr: true,
    pages: [{ page: 'service-parts', label: 'Parts Inventory' }],
  },
  cleanup: {
    label: 'Detail / Cleanup', icon: 'droplet', accent: 'sky',
    pages: [{ page: 'recon', label: 'Cleanup' }],
  },
  accounting: {
    label: 'Accounting', icon: 'currency', accent: 'emerald', probe: '#grp-accounting-wrap', mgr: true,
    pages: [{ page: 'accounting', label: 'Accounting' }],
  },
  hr: {
    label: 'HR & Compliance', icon: 'users', accent: 'violet', mgr: true,
    pages: [
      { page: 'people-compliance', label: 'Compliance Academy' },
      { page: 'shift-clock', label: 'Workstation' },
    ],
  },
};
window.DEPARTMENTS = DEPARTMENTS;

var __deptNavBuilt = false;
var __deptRegistry = DEPARTMENTS;
var __activeDept = null;

function DEPT_MGR_ROLES() {
  return ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ADMIN'];
}

function deptRoleOk(spec) {
  if (!spec) return true;
  const userRole = (window.profileContext && window.profileContext.role) || 'DEALER_ADMIN';
  if (spec.mgr) return DEPT_MGR_ROLES().includes(userRole);
  if (spec.roles && Array.isArray(spec.roles)) return spec.roles.includes(userRole);
  return true;
}

function deptHomePage(dept) {
  return dept.pages.find(deptRoleOk) || dept.pages[0] || { page: 'insights' };
}

function deptVisible(dept) {
  return deptRoleOk(dept);
}

function renderDeptNav(role) {
  const navRoot = document.getElementById('nav-desktop');
  if (!navRoot) return;

  const registry = DEPARTMENTS;
  __deptRegistry = registry;

  navRoot.classList.remove('nav-init');

  let host = document.getElementById('dept-nav');
  if (!host) {
    host = document.createElement('div');
    host.id = 'dept-nav';
    host.className = 'space-y-0.5 mb-1';
    navRoot.insertBefore(host, navRoot.firstChild);
  }

  host.innerHTML = Object.entries(registry).filter(([, d]) => deptVisible(d)).map(([id, d]) => {
    const A = ENGINE_ACCENTS[d.accent] || ENGINE_ACCENTS.indigo;
    return `<button type="button" data-dept="${id}" onclick="deptOpen('${id}')" title="${esc(d.label)}" class="dept-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="${A.text} flex-shrink-0">${svgIcon(d.icon || 'dot', 'w-4 h-4')}</span><span>${esc(d.label)}</span></button>`;
  }).join('');

  navRoot.classList.add('dept-mode');
  __deptNavBuilt = true;
  highlightDeptNav(window.activePageId || 'insights');
}
window.renderDeptNav = renderDeptNav;

function deptOpen(id) {
  const d = __deptRegistry[id];
  if (!d) return;
  __activeDept = id;
  const home = deptHomePage(d);
  if (typeof switchPage === 'function') switchPage(home.page);
  if (typeof openDepartmentSetupWizard === 'function') {
    openDepartmentSetupWizard(id);
  }
}
window.deptOpen = deptOpen;

function deptGo(page, invmode) {
  if (invmode && typeof setInventoryMode === 'function') setInventoryMode(invmode);
  if (typeof switchPage === 'function') switchPage(page);
}
window.deptGo = deptGo;

function highlightDeptNav(pageId) {
  if (!__deptNavBuilt || !__deptRegistry) return;
  const deptId = (__activeDept && __deptRegistry[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
               : Object.keys(__deptRegistry).find(d => __deptRegistry[d].pages.some(p => p.page === pageId));

  document.querySelectorAll('#dept-nav .dept-nav-item').forEach(b => {
    const on = b.dataset.dept === deptId;
    b.classList.toggle('bg-indigo-100', on);
    b.classList.toggle('dark:bg-indigo-950/50', on);
    b.classList.toggle('text-indigo-700', on);
    b.classList.toggle('dark:text-indigo-300', on);
    b.classList.toggle('text-slate-700', !on);
    b.classList.toggle('dark:text-slate-300', !on);
  });
}
window.highlightDeptNav = highlightDeptNav;

function renderDeptTabbar(pageId) {
  const tabbar = document.getElementById('dept-tabbar');
  if (!tabbar) return;

  const deptKey = Object.keys(__deptRegistry).find(d => __deptRegistry[d].pages.some(p => p.page === pageId));
  const dept = __deptRegistry[deptKey];

  if (!dept || !dept.pages || dept.pages.length <= 1) {
    tabbar.classList.add('hidden');
    tabbar.innerHTML = '';
    return;
  }

  const allowedPages = dept.pages.filter(p => deptRoleOk(p));
  const A = ENGINE_ACCENTS[dept.accent] || ENGINE_ACCENTS.indigo;

  tabbar.className = 'flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 border-b border-slate-200 dark:border-slate-800';
  tabbar.innerHTML = allowedPages.map(p => {
    const active = p.page === pageId;
    const invAttr = p.invmode ? `,'${p.invmode}'` : '';
    return `
      <button type="button" onclick="deptGo('${p.page}'${invAttr})" class="px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${active ? `${A.solid} text-white shadow-sm` : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}">
        ${esc(p.label)}
      </button>
    `;
  }).join('');

  tabbar.classList.remove('hidden');
}
window.renderDeptTabbar = renderDeptTabbar;
