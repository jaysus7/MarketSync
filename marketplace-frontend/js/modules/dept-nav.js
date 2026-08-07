// ── MarketSync Department Navigation Submodule ─────────────────────────
// Manages flat department sidebar navigation and department sub-tab bars.

var esc = window.esc || function(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
};
window.esc = esc;

var svgIcon = window.svgIcon || function(name, cls = 'w-4 h-4') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`;
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

var SAAS_DEPARTMENTS = {
  hq:         { label: 'MarketSync HQ',    icon: 'chart',    accent: 'violet', pages: [{ page: 'saas-command', label: 'HQ' }] },
  pipeline:   { label: 'Customer Pipeline', icon: 'chart',   accent: 'violet', pages: [{ page: 'saas-customers', label: 'Pipeline' }] },
  followups:  { label: 'Follow-ups',        icon: 'bolt',    accent: 'violet', pages: [{ page: 'saas-followups', label: 'Follow-ups' }] },
  accounts:   { label: 'All Users',        icon: 'user',     accent: 'violet', pages: [{ page: 'owner-users', label: 'Accounts' }] },
  affiliates: { label: 'Affiliates',       icon: 'trophy',   accent: 'amber',   pages: [{ page: 'affiliates-admin', label: 'Affiliates' }] },
  settings:   { label: 'Settings',         icon: 'user',     accent: 'indigo',  always: true, pages: [{ page: 'profile', label: 'Settings' }] },
};
window.SAAS_DEPARTMENTS = SAAS_DEPARTMENTS;

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

function deptPageAllowed(p) {
  return deptRoleOk(p);
}

function deptHomePage(dept) {
  return dept.pages.find(deptPageAllowed) || dept.pages[0] || { page: 'insights' };
}

function deptVisible(dept) {
  if (!deptRoleOk(dept)) return false;
  return true;
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
  const bar = document.getElementById('dept-tabbar');
  if (!bar) return;

  const reg = __deptRegistry;
  let deptId = (__activeDept && reg[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
               : Object.keys(reg).find(d => reg[d].pages.some(p => p.page === pageId));

  if (!deptId) {
    bar.innerHTML = '';
    bar.classList.add('hidden');
    return;
  }

  __activeDept = deptId;
  const dept = reg[deptId];
  const pages = dept.pages.filter(deptPageAllowed);
  const A = ENGINE_ACCENTS[dept.accent] || ENGINE_ACCENTS.indigo;

  bar.innerHTML = `
    <div class="flex items-center gap-3 overflow-x-auto py-2 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div class="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-800">
        <span class="w-6 h-6 rounded ${A.bg} ${A.text} flex items-center justify-center">${svgIcon(dept.icon || 'dot', 'w-3.5 h-3.5')}</span>
        <span class="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">${esc(dept.label)}</span>
      </div>
      <div class="flex items-center gap-1">
        ${pages.map(p => {
          const on = p.page === pageId;
          return `<button onclick="deptGo('${p.page}'${p.invmode ? `,'${p.invmode}'` : ''})" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${on ? A.bg + ' ' + A.text : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(p.label)}</button>`;
        }).join('')}
      </div>
    </div>
  `;
  bar.classList.remove('hidden');
}
window.renderDeptTabbar = renderDeptTabbar;
