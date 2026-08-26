
function hydrateDemoPackageCache() {
  try {
    const cached = sessionStorage.getItem('ms_demo_package') || localStorage.getItem('ms_demo_package');
    if (!cached) return;
    window.__demoActivePackage = window.__demoActivePackage || cached;
    window.__demoPackageId = window.__demoPackageId || cached;
    if (!window.__demoActiveProduct) {
      const id = String(cached).toLowerCase();
      if (id.includes('digital')) window.__demoActiveProduct = 'marketsync-digital';
      else if (id.includes('sales-marketing') || id.includes('sales_marketing')) window.__demoActiveProduct = 'sales-marketing-suite';
      else if (id.includes('service-marketing') || id.includes('service_marketing')) window.__demoActiveProduct = 'service-marketing-suite';
      else if (id.includes('complete-marketing') || id.includes('complete_marketing')) window.__demoActiveProduct = 'complete-marketing-suite';
      else if (id.includes('design')) window.__demoActiveProduct = 'design_studio';
      else if (id.includes('facebook') || id.includes('autoposter') || id.includes('fb_')) window.__demoActiveProduct = 'facebook';
      else if (id.includes('video')) window.__demoActiveProduct = 'video';
      else if (id.includes('website')) window.__demoActiveProduct = 'website';
      else if (id.includes('chatbot') || id.includes('ai_')) window.__demoActiveProduct = 'ai_chatbot';
      else if (id.includes('seo')) window.__demoActiveProduct = 'seo';
      else window.__demoActiveProduct = cached;
    }
  } catch {}
}
window.hydrateDemoPackageCache = hydrateDemoPackageCache;
hydrateDemoPackageCache();

/* dashboard.js split part 2/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Page permission flags (set after profile loads, read by switchPage to mirror panels into Insights)
let __canSeeLeaderboard = false;
let __canSeeTeamInsights = false;
let __canSeeSalesTeam = false;

function msToggleShellMenu(force) {
  const menu = document.getElementById('shell-menu');
  const btn = document.getElementById('shell-menu-btn');
  if (!menu || !btn) return;
  const open = typeof force === 'boolean' ? force : menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !open);
  btn.setAttribute('aria-expanded', String(open));
}
window.msToggleShellMenu = msToggleShellMenu;
function msShellGo(page) { msToggleShellMenu(false); switchPage(page); }
window.msShellGo = msShellGo;

// Early safety stubs for widgets so early clicks before later parts load never throw
if (typeof window.openAiDock !== 'function') window.openAiDock = function() { const p = document.getElementById('ai-dock-panel'); if (p) p.classList.remove('hidden'); };
if (typeof window.closeAiDock !== 'function') window.closeAiDock = function() { const p = document.getElementById('ai-dock-panel'); if (p) p.classList.add('hidden'); };
if (typeof window.toggleAiDock !== 'function') window.toggleAiDock = function() { const p = document.getElementById('ai-dock-panel'); if (p) p.classList.toggle('hidden'); };
if (typeof window.openTeamChatWidget !== 'function') window.openTeamChatWidget = function() { const p = document.getElementById('team-chat-dock-panel'); if (p) p.classList.remove('hidden'); };
// Early Sales loader stub: the real sales-workspace.js registers the same
// function later in the script chain. This prevents a stale/cached shell from
// throwing before that late module arrives.
if (typeof window.loadSalesWorkspace !== 'function') window.loadSalesWorkspace = function() {
  if (typeof renderEngine === 'function' && typeof ENGINES !== 'undefined' && ENGINES.sales) renderEngine('sales');
  else if (typeof showToast === 'function') showToast('Sales workspace is still loading — refresh once and try again.', 'warning');
};
if (typeof window.toggleTeamChatWidget !== 'function') window.toggleTeamChatWidget = function() { const p = document.getElementById('team-chat-dock-panel'); if (p) p.classList.toggle('hidden'); };

function isDemoAccount() {
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  if (access.isDemo) return true;
  const d = (typeof profileContext !== 'undefined' && profileContext?.dealership) ? profileContext.dealership : {};
  if (d && d.name && /(?:^|\b)demo(?:\b|$)/i.test(d.name)) return true;
  return false;
}
window.isDemoAccount = isDemoAccount;

function dealerRoleLanding(role) {
  const routes = {
    DEALER_ADMIN: 'command', OWNER: 'command', MANAGER: 'command',
    SALES_REP: 'sales', BDC: 'sales', FNI: 'fni-overview', SERVICE: 'service-overview',
    ACCOUNTING: 'accounting-overview', CLEANUP: 'recon', PARTS: 'parts-overview',
  };
  return routes[String(role || '').toUpperCase()] || 'sales';
}
window.dealerRoleLanding = dealerRoleLanding;

// ── Header Real-Time & Shift Attendance Clock Engine ───────────────────────
let __shiftState = (() => {
  try { return JSON.parse(localStorage.getItem('ms_shift_state')) || { active: false, startTime: null, breakStart: null, totalBreakMs: 0 }; }
  catch { return { active: false, startTime: null, breakStart: null, totalBreakMs: 0 }; }
})();

function saveShiftState() {
  try { localStorage.setItem('ms_shift_state', JSON.stringify(__shiftState)); } catch {}
  renderShiftDropdownActions();
}

function fmtHHMMSS(ms) {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

async function syncLiveShiftState() {
  if (typeof isSingleProductWorkspace === 'function' && isSingleProductWorkspace()) return;
  if (window.__access && Array.isArray(window.__access.products) && !window.__access.products.includes('dealer_os')) return;
  try {
    const res = await apiGetJson('/hr/time/me').catch(() => null);
    if (res && res.open) {
      __shiftState.active = true;
      __shiftState.startTime = new Date(res.open.clock_in).getTime();
      __shiftState.totalBreakMs = (Number(res.open.break_minutes) || 0) * 60000;
      __shiftState.entryId = res.open.id;
    } else if (res && res.open === null) {
      __shiftState.active = false;
      __shiftState.startTime = null;
      __shiftState.breakStart = null;
      __shiftState.totalBreakMs = 0;
      __shiftState.entryId = null;
    }
    saveShiftState();
  } catch {}
}

let __headerClockInterval = null;

function initHeaderClock() {
  syncLiveShiftState();
  renderShiftDropdownActions();

  const updateClocks = () => {
    if (document.hidden) return;
    
    // 1. Update Real-Time Clock
    const dateEl = document.getElementById('header-clock-date');
    const timeEl = document.getElementById('header-clock-time');
    const periodEl = document.getElementById('header-clock-period');
    const now = new Date();

    if (dateEl) {
      const dateStr = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      if (dateEl.textContent !== dateStr) dateEl.textContent = dateStr;
    }

    if (timeEl) {
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedTime = `${hours}:${minutes}:${seconds}`;

      if (periodEl) {
        if (timeEl.textContent !== formattedTime) timeEl.textContent = formattedTime;
        if (periodEl.textContent !== ampm) periodEl.textContent = ampm;
      } else {
        const fullTime = `${formattedTime} ${ampm}`;
        if (timeEl.textContent !== fullTime) timeEl.textContent = fullTime;
      }
    }

    // 2. Update Shift Attendance Clock
    const timerDisplay = document.getElementById('header-shift-timer-display');
    const statusDot = document.getElementById('header-shift-status-dot');
    const chipBtn = document.getElementById('header-shift-clock-chip');
    const badge = document.getElementById('shift-dropdown-status-badge');
    const durEl = document.getElementById('shift-dropdown-duration');
    const startEl = document.getElementById('shift-dropdown-start-time');
    const breakEl = document.getElementById('shift-dropdown-break-time');

    if (__shiftState.active) {
      const nowMs = Date.now();
      let currentBreak = __shiftState.totalBreakMs || 0;
      if (__shiftState.breakStart) {
        currentBreak += (nowMs - __shiftState.breakStart);
      }
      const elapsed = nowMs - __shiftState.startTime - currentBreak;
      const formatted = fmtHHMMSS(elapsed);

      if (timerDisplay && timerDisplay.textContent !== `Shift: ${formatted}`) {
        timerDisplay.textContent = `Shift: ${formatted}`;
      }
      if (durEl && durEl.textContent !== formatted) durEl.textContent = formatted;
      if (startEl && __shiftState.startTime) {
        const startStr = new Date(__shiftState.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        if (startEl.textContent !== startStr) startEl.textContent = startStr;
      }
      if (breakEl) {
        const breakStr = fmtHHMMSS(currentBreak);
        if (breakEl.textContent !== breakStr) breakEl.textContent = breakStr;
      }

      if (__shiftState.breakStart) {
        if (statusDot && statusDot.className !== 'w-2 h-2 rounded-full bg-amber-500 animate-pulse') {
          statusDot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse';
        }
        if (badge && badge.textContent !== 'On Break') {
          badge.textContent = 'On Break';
          badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700';
        }
        if (chipBtn && !chipBtn.classList.contains('border-amber-500/30')) {
          chipBtn.className = 'flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-600 dark:text-amber-400 shadow-xs hover:bg-amber-500/20 transition-colors cursor-pointer select-none flex-shrink-0';
        }
      } else {
        if (statusDot && statusDot.className !== 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse') {
          statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
        }
        if (badge && badge.textContent !== 'Clocked In') {
          badge.textContent = 'Clocked In';
          badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700';
        }
        if (chipBtn && !chipBtn.classList.contains('border-emerald-500/30')) {
          chipBtn.className = 'flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-xs hover:bg-emerald-500/20 transition-colors cursor-pointer select-none flex-shrink-0';
        }
      }
    } else {
      if (timerDisplay && timerDisplay.textContent !== 'Clock In') timerDisplay.textContent = 'Clock In';
      if (statusDot && statusDot.className !== 'w-2 h-2 rounded-full bg-slate-400') statusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      if (badge && badge.textContent !== 'Clocked Out') {
        badge.textContent = 'Clocked Out';
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600';
      }
      if (durEl && durEl.textContent !== '00:00:00') durEl.textContent = '00:00:00';
      if (startEl && startEl.textContent !== '--:--') startEl.textContent = '--:--';
      if (breakEl && breakEl.textContent !== '00:00:00') breakEl.textContent = '00:00:00';
      if (chipBtn && !chipBtn.classList.contains('border-slate-200')) {
        chipBtn.className = 'flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/90 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer select-none flex-shrink-0';
      }
    }
  };

  if (__headerClockInterval) clearInterval(__headerClockInterval);
  updateClocks();
  __headerClockInterval = setInterval(updateClocks, 1000);
}

function toggleShiftDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('header-shift-dropdown');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function renderShiftDropdownActions() {
  const container = document.getElementById('shift-dropdown-actions');
  if (!container) return;
  if (!__shiftState.active) {
    container.innerHTML = `
      <button onclick="shiftClockIn()" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-md cursor-pointer">Clock In Now</button>
    `;
  } else if (__shiftState.breakStart) {
    container.innerHTML = `
      <button onclick="shiftEndBreak()" class="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs transition shadow-md cursor-pointer">End Break</button>
      <button onclick="shiftClockOut()" class="w-full py-1.5 rounded-xl bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/30 font-bold text-xs transition cursor-pointer">End Shift</button>
    `;
  } else {
    container.innerHTML = `
      <button onclick="shiftStartBreak()" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition border border-slate-700 cursor-pointer">Take Break</button>
      <button onclick="shiftClockOut()" class="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-md cursor-pointer">Clock Out &amp; End Shift</button>
    `;
  }
}

async function shiftClockIn() {
  try {
    const res = await apiSendJson('/hr/time/clock-in', 'POST', {}).catch(() => null);
    const clockInTime = (res && res.entry?.clock_in) ? new Date(res.entry.clock_in).getTime() : Date.now();
    __shiftState = { active: true, startTime: clockInTime, breakStart: null, totalBreakMs: 0, entryId: res?.entry?.id || null };
    saveShiftState();
    if (typeof showToast === 'function') showToast('Clocked in successfully!', 'success');
  } catch (e) {
    __shiftState = { active: true, startTime: Date.now(), breakStart: null, totalBreakMs: 0 };
    saveShiftState();
    if (typeof showToast === 'function') showToast('Clocked in!', 'success');
  }
}

function shiftStartBreak() {
  if (!__shiftState.active) return;
  __shiftState.breakStart = Date.now();
  saveShiftState();
  if (typeof showToast === 'function') showToast('Break started.', 'info');
}

function shiftEndBreak() {
  if (!__shiftState.active || !__shiftState.breakStart) return;
  __shiftState.totalBreakMs += (Date.now() - __shiftState.breakStart);
  __shiftState.breakStart = null;
  saveShiftState();
  if (typeof showToast === 'function') showToast('Returned from break.', 'success');
}

async function shiftClockOut() {
  if (__shiftState.breakStart) {
    __shiftState.totalBreakMs += (Date.now() - __shiftState.breakStart);
  }
  const breakMinutes = Math.round(__shiftState.totalBreakMs / 60000);
  const totalDurationMs = Date.now() - (__shiftState.startTime || Date.now()) - __shiftState.totalBreakMs;
  const formatted = fmtHHMMSS(totalDurationMs);
  
  try {
    await apiSendJson('/hr/time/clock-out', 'POST', { break_minutes: breakMinutes }).catch(() => null);
  } catch {}

  __shiftState = { active: false, startTime: null, breakStart: null, totalBreakMs: 0, entryId: null };
  saveShiftState();
  if (typeof showToast === 'function') showToast('Clocked out. Total shift: ' + formatted, 'info');
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('header-shift-clock-wrapper');
  const dropdown = document.getElementById('header-shift-dropdown');
  if (wrapper && dropdown && !wrapper.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderClock);
  } else {
    setTimeout(initHeaderClock, 0);
  }
}

Object.assign(window, {
  initHeaderClock, toggleShiftDropdown, shiftClockIn, shiftClockOut, shiftStartBreak, shiftEndBreak,
});

// ── Setup, in one line at the foot of the shell ──────────────────────────────
// It shows a count, it opens a modal, and it removes itself the moment the dealership
// is fully configured. It does not appear inside a department, it does not block
// anything, and it never navigates you away from what you were doing.
let __msLaunch = null;      // the last /launch answer, so the modal need not refetch

// Retired: the persistent "Finish setup" nag banner is gone for everyone. The
// Launch Hub page (switchPage('launch')) and msSetupModal() below still exist,
// each doing their own independent /launch fetch, for anyone who navigates
// there deliberately — this just stops the banner announcing itself unprompted
// on every page load.
function refreshSetupIndicator() {
  document.getElementById('setup-status-banner')?.classList.add('hidden');
}
window.refreshSetupIndicator = refreshSetupIndicator;

// ── The setup modal ──────────────────────────────────────────────────────────
// Everything still missing, in one place, with the fields you can actually type into
// right here. The dealership-configuration items ARE a form, so they are a form; the
// rest are jobs somewhere else, and those carry the button that takes you there and
// closes the modal behind you.
const MS_SETUP_FIELDS = [
  ['legal_name', 'Registered legal name', 'text'],
  ['street_address', 'Street address', 'text'],
  ['city', 'City', 'text'],
  ['province', 'Province / state', 'text'],
  ['postal_code', 'Postal / ZIP code', 'text'],
  ['country', 'Country', 'text'],
  ['phone', 'Main phone', 'tel'],
  ['timezone', 'Timezone', 'text'],
  ['hst_number', 'Tax registration number', 'text'],
  ['omvic_reg', 'Dealer registration number', 'text'],
];
// Which requirements this form actually satisfies — the rest are done elsewhere.
const MS_SETUP_FORM_KEYS = new Set(['legal_identity', 'timezone', 'tax_registration']);

async function msSetupModal() {
  const el = crmOverlay(`<div class="p-6"><div class="text-sm text-slate-400 py-10 text-center">Loading setup…</div></div>`, 'max-w-3xl');
  const panel = el.firstElementChild;
  let launch = __msLaunch;
  try {
    const r = await fetch(`${API}/launch`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) { launch = await r.json(); __msLaunch = launch; }
  } catch { /* fall back to the last answer rather than an empty modal */ }
  if (!launch) {
    panel.innerHTML = `<div class="p-6">${engEmpty('Setup could not be loaded, so nothing is shown. Nothing has been changed.')}</div>`;
    return;
  }

  const items = launch.items || [];
  const outstanding = items.filter(i => i.status !== 'done');
  const cfg = launch.dealership || {};
  const needsForm = outstanding.some(i => MS_SETUP_FORM_KEYS.has(i.key));

  const fields = MS_SETUP_FIELDS.map(([k, label, type]) => `
    <label class="block">
      <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">${esc(label)}</span>
      <input data-field="${k}" type="${type}" value="${esc(String(cfg[k] ?? ''))}"
        class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
    </label>`).join('');

  const elsewhere = outstanding.filter(i => !MS_SETUP_FORM_KEYS.has(i.key));

  panel.innerHTML = `
    <div class="flex items-start gap-3 p-5 pb-0">
      <div class="min-w-0 flex-1">
        <div class="text-lg font-black text-slate-900 dark:text-white">Set up your dealership</div>
        <div class="text-[12px] text-slate-400">${items.length - outstanding.length} of ${items.length} done${launch.operational ? ' · you can already operate' : ' · some required items remain'}</div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="p-5 max-h-[70vh] overflow-y-auto">
      ${needsForm ? `<div data-launch-form>
        <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Your dealership</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${fields}</div>
        <div class="flex flex-wrap items-center gap-2 mt-3">
          <button onclick="msSetupSave(this)" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save</button>
          <span class="text-[12px] text-slate-400">A blank field is left as it was — saving never clears something you already entered.</span>
        </div>
      </div>` : ''}

      ${elsewhere.length ? `<div class="${needsForm ? 'mt-6' : ''}">
        <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Done elsewhere</div>
        ${elsewhere.map(i => {
          const action = LAUNCH_ACTIONS[i.key];
          return `<div class="flex items-start gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(i.label)}</div>
              <div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(i.why || '')}</div>
              ${i.actionable_by_you === false ? `<div class="text-[12px] text-slate-400 mt-0.5">Somebody with ${esc(i.permission || 'the right permission')} has to do this</div>` : ''}
            </div>
            ${i.actionable_by_you !== false && action
              ? `<button onclick="msSetupGo(${JSON.stringify(action[0]).replace(/"/g, '&quot;')})" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">${esc(action[1])}</button>`
              : ''}
            <div class="shrink-0 text-[12px] font-bold ${i.status === 'unknown' ? 'text-slate-400' : 'text-amber-600 dark:text-amber-400'}">${i.status === 'unknown' ? 'Could not check' : 'Outstanding'}</div>
          </div>`;
        }).join('')}
      </div>` : ''}

      ${!outstanding.length ? engEmpty('Everything is set up. This will not appear again.') : ''}
    </div>`;
}
window.msSetupModal = msSetupModal;

// Run the item's own action, then get out of the way.
function msSetupGo(code) {
  document.querySelectorAll('.fixed.inset-0.z-\\[9998\\]').forEach(n => n.remove());
  try { (new Function(code))(); } catch (e) { showToast(e.message, 'error'); }
}
window.msSetupGo = msSetupGo;

async function msSetupSave(btn) {
  const form = btn.closest('[data-launch-form]');
  if (!form) return;
  const body = {};
  for (const el of form.querySelectorAll('[data-field]')) {
    const v = el.value.trim();
    if (v) body[el.dataset.field] = v;      // blank leaves the stored value alone
  }
  if (!Object.keys(body).length) { showToast('Nothing to save', 'error'); return; }
  try {
    await apiSendJson('/launch/dealership', 'PATCH', body);
    showToast('Saved', 'success');
    await refreshSetupIndicator();
    // Reopen against fresh state so a satisfied requirement visibly leaves the list.
    document.querySelectorAll('.fixed.inset-0.z-\\[9998\\]').forEach(n => n.remove());
    if (!__msLaunch?.fully_configured) msSetupModal();
  } catch (e) { showToast(e.message, 'error'); }
}
window.msSetupSave = msSetupSave;

// AI Boost — hot/cold segment cache (populated by renderIntel, read by renderCatalog)
let __hotMakeModels = new Set();
let __coldMakeModels = new Set();
// AI Boost — per-vehicle health score cache (id → score)
let __vehicleHealthScores = {};

// Lazy page loaders: registered during init, each runs once the matching page is
// first opened. Keeps login from firing a burst of heavy requests (feeds, catalog,
// leaderboard, inventory-intelligence) all at once, which stalled the free-tier
// backend. Populated in the init flow; drained by switchPage.
const __pageInit = {};
function runPageInit(pageId) {
  const fn = __pageInit[pageId];
  if (fn) { delete __pageInit[pageId]; try { fn(); } catch (e) { console.warn('[lazy-load]', pageId, e); } }
}

// Pre-fetch hot/cold + health caches so tags show on inventory cards. Heavy call,
// so it now runs lazily the first time the Inventory page is opened.
let __invIntelTagsLoaded = false;
function prefetchInvIntelTags() {
  if (!__invIntelActive || __invIntelTagsLoaded) return;
  __invIntelTagsLoaded = true;
  apiGetJson('/ai/inventory-intelligence', { retries: 2 })
    .then(data => {
      if (!data) return;
      __hotMakeModels = new Set((data.hot_segments || []).map(s => `${s.make} ${s.model}`.toLowerCase()));
      __coldMakeModels = new Set((data.cold_segments || []).map(s => `${s.make} ${s.model}`.toLowerCase()));
      __vehicleHealthScores = Object.fromEntries((data.vehicles || []).map(v => [v.id, v.score]));
      if (__hotMakeModels.size > 0 || __coldMakeModels.size > 0) {
        document.getElementById('catalog-segment-pills')?.classList.remove('hidden');
      }
      if (typeof renderCatalog === 'function' && document.getElementById('catalog-list')) renderCatalog();
    })
    .catch(() => { __invIntelTagsLoaded = false; });
}

// Run Engine Boot Lifecycle
document.addEventListener('DOMContentLoaded', () => {
  // Don't boot the dashboard while we're still waiting on the extension SSO bridge
  // (or if there's genuinely no session) — otherwise the init fires auth'd requests
  // with no token and flashes a broken UI before the redirect/reload lands.
  if (__authPending || !localStorage.getItem('token')) return;
  // The retired global Insights/Pulse must never flash before access context resolves.
  // Every workspace now owns its own Pulse; old deep links are redirected in switchPage.
  document.querySelector('[data-page-content="insights"]')?.remove();
  switchPage(dealerRoleLanding(profileContext?.role));
  initializeDashboardEcosystem();
  setupActionListeners();
});


// Single-product Settings account tab: force the 3-column grid directly rather
// than relying on settingsTab()'s computed is-multi toggle — this tier's My
// Account tab should always read as one compact block.
function forceCompactSettingsGrid() {
  // settings-language-card is authored directly inside #profile-panel now (see
  // dashboard.html), explicitly placed on row 2 via CSS — no runtime DOM move
  // needed here any more. Single-product tiers still need is-multi forced
  // directly: settingsTab()'s computed shown-count heuristic is fragile for them.
  document.getElementById('profile-panel')?.classList.add('is-multi');
}

async function initializeDashboardEcosystem() {
  try {
    // Fetch unified server profile context. Render free/starter tier can cold-start
    // (30-60s) — give it real time instead of letting a default browser timeout
    // produce a confusing error that looks identical to an auth failure.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    let res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    // Keep the abort timer armed until the body is fully read (same reasoning as
    // apiGetJson): a response whose headers arrive but whose body stalls must
    // still time out, otherwise the dashboard hangs on a blank/loading screen.
    // The silent refresh starts as the dashboard loads. If the first profile
    // request races an expired/restored access token, wait for that one refresh
    // and retry with the newest token before declaring the session invalid.
    if (res.status === 401) {
      const refreshed = await refreshSessionSilently();
      if (refreshed) {
        res = await fetch(`${API}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
      }
    }
    if (res.status === 401 || res.status === 402) {
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}))
        clearTimeout(timeoutId);
        throw new Error(body.error === 'TRIAL_EXPIRED' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED')
      }
      clearTimeout(timeoutId);
      throw new Error('SESSION_EXPIRED')
    }

    profileContext = await res.json();
    clearTimeout(timeoutId);

    // `/auth/me` carries the safe, normalized entitlement summary too. Use it first
    // so plan-aware navigation is available even if the follow-up request hits a
    // transient Render cold start; /access/context below refreshes the same snapshot
    // when it succeeds.
    if (profileContext?.access && Array.isArray(profileContext.access.features)) {
      window.__access = profileContext.access;
    }
    // fb_only is a plain column on dealerships and rides along on `dealership` in
    // this very response — read it now instead of waiting on the separate
    // /ai/config fetch inside loadAIBoostSection() (below), which can lag well
    // behind boot on a cold-started backend. Until that flag was set, a
    // Facebook-only account rendered with the full DealerOS chrome (generic nav,
    // Insights widgets it has no data for) for however long that fetch took —
    // loadAIBoostSection() still re-sets this once /ai/config lands, harmlessly
    // confirming the same value.
    __fbOnly = !!profileContext?.dealership?.fb_only;

    // Normalized access context (products / entitled features / permissions / defaultRoute)
    // from the central authorization service — the SINGLE source both desktop and mobile
    // nav filter from. Falls back to the legacy /auth/me products object if unavailable,
    // so an older backend keeps working.
    // CRITICAL: this must NEVER block the dashboard from rendering. It is bounded by its
    // own abort timeout so a slow/hanging response (e.g. a cold-started or down backend)
    // can't stall the nav + skeleton screen — worst case we fall through to legacy gating.
    try {
      const acCtrl = new AbortController();
      const acTimer = setTimeout(() => acCtrl.abort(), 8000);
      const ac = await fetch(`${API}/access/context`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: acCtrl.signal,
      });
      clearTimeout(acTimer);
      if (ac.ok) window.__access = await ac.json();
    } catch { /* timed out / unavailable → leave window.__access unset, legacy gating applies */ }

    // The staff time clock belongs only to DealerOS Complete. Gate against the
    // server-authored active subscription plan, with the legacy dealership plan used
    // solely during an access-context cold start. This fails closed for every other plan.
    const activeDealerOsPlan = String(window.__access?.planByProduct?.dealer_os || '').toLowerCase();
    const legacyDealerOsPlan = String(profileContext?.plan || profileContext?.dealership?.plan || '').toLowerCase();
    const hasCompleteTimeClock = activeDealerOsPlan === 'dealer-os-complete'
      || (!activeDealerOsPlan && ['dealeros_complete', 'dealer-os-complete'].includes(legacyDealerOsPlan));
    document.getElementById('header-shift-clock-wrapper')?.classList.toggle('ms-timeclock-entitled', hasCompleteTimeClock);

    // Render Shared Header Components
    // For dealer admins: lead with the DEALERSHIP NAME (so it visually distinguishes the
    // dealer admin view from rep views). Person's name moves to the subtitle line.
    // For reps / solo: lead with the person's name (their own dashboard, not the team's).
    const personName = profileContext.full_name || user.email;
    const isPersonalDealership = profileContext.dealership?.is_personal === true;
    const dealershipName = isPersonalDealership
      ? 'Independent'
      : (profileContext.dealership?.name || 'Independent');
    const isAdminHeader = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext.role);
    refreshSetupIndicator(profileContext.role);

    // Purple "Desk a deal" quick-launch — any admin/manager/F&I (including a solo
    // "Independent" account, which is still allowed to desk deals).
    if (isAdminHeader) {
      const deskBtn = document.getElementById('header-desk-btn');
      if (deskBtn) { deskBtn.classList.remove('hidden'); deskBtn.classList.add('inline-flex'); }
    }

    if (isAdminHeader && !isPersonalDealership) {
      document.getElementById('ui-profile-name').textContent = dealershipName;
      document.getElementById('ui-dealership-name').textContent = `${personName} · Admin`;
    } else {
      document.getElementById('ui-profile-name').textContent = personName;
      document.getElementById('ui-dealership-name').textContent = dealershipName;
    }
    // Owner-only Demo ↔ MarketSync workspace switch.
    try { initDashModeForOwner(); } catch (e) {}

    // Pre-fill profile form
    document.getElementById('prof-name').value = profileContext.full_name || '';
    document.getElementById('prof-email').value = profileContext.email || user.email || '';
    { const p = document.getElementById('prof-phone'); if (p) p.value = profileContext.phone || ''; }
    // Email-sending card: signature + reply-to override (placeholder = login email).
    { const s = document.getElementById('es-signature'); if (s) s.value = profileContext.email_signature || ''; }
    { const r = document.getElementById('es-reply-to'); if (r) { r.value = profileContext.email_reply_to || ''; r.placeholder = profileContext.email || user.email || 'your login email'; } }
    document.getElementById('prof-dealername').value = profileContext.dealership?.name || '';
    document.getElementById('prof-website').value = profileContext.dealership?.website_url || '';
    document.getElementById('prof-display-name').value = profileContext.display_name || '';

    // Avatar preview
    const avatarImg = document.getElementById('prof-avatar-img');
    const avatarInitial = document.getElementById('prof-avatar-initial');
    const avatarRemove = document.getElementById('prof-avatar-remove');
    const setAvatarPreview = (url) => {
      if (url) {
        avatarImg.src = url; avatarImg.classList.remove('hidden');
        avatarInitial.classList.add('hidden'); avatarRemove.classList.remove('hidden');
      } else {
        avatarImg.classList.add('hidden'); avatarInitial.classList.remove('hidden');
        avatarRemove.classList.add('hidden');
        avatarInitial.textContent = (profileContext.full_name || '?').trim().charAt(0).toUpperCase();
      }
    };
    setAvatarPreview(profileContext.avatar_url || null);

    document.getElementById('prof-avatar-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Compress: resize to max 256px and convert to JPEG at 70% quality
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          setAvatarPreview(dataUrl);
          // Replace file input with compressed blob for upload
          canvas.toBlob(blob => {
            const dt = new DataTransfer();
            dt.items.add(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
            document.getElementById('prof-avatar-file').files = dt.files;
          }, 'image/jpeg', 0.70);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    avatarRemove.addEventListener('click', () => {
      document.getElementById('prof-avatar-file').value = '';
      setAvatarPreview(null);
    });

    // Route Workspace Rendering Logic based on Account Role
    const role = profileContext.role || 'SALES_REP'; // Standard safe fallback role assignment
    const isPersonalForPill = profileContext.dealership?.is_personal === true;
    const rolePillLabel = (role === 'SALES_REP' && isPersonalForPill) ? 'SOLO_REP' : (STAFF_ROLE_LABELS[role] || role);
    document.getElementById('ui-role-pill').textContent = rolePillLabel;

    // Hide dealer-only profile fields for sales reps
    if (role !== 'DEALER_ADMIN' && role !== 'OWNER' && role !== 'MANAGER') {
      document.querySelectorAll('[data-dealer-only]').forEach(el => el.classList.add('hidden'));
    }

    // Load transactional data + insights (safely — non-critical metrics must never block boot)
    let fleet = 0, totalListings = 0;
    try {
      [fleet, totalListings] = await Promise.all([
        fetchMetrics('/inventory').catch(() => 0),
        fetchMetrics('/listings').catch(() => 0)
      ]);
    } catch {}

    if (typeof loadInsights === 'function') try { loadInsights(); } catch {}
    if (typeof loadMyTierChip === 'function') try { loadMyTierChip(); } catch {}
    if (typeof initSecurityPanel === 'function') try { initSecurityPanel(); } catch {}

    // If returning from Stripe checkout, verify payment then load AI config
    const aiSessionId = new URLSearchParams(window.location.search).get('ai_boost_session');
    if (aiSessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      await verifyAIBoostSession(aiSessionId);
    }

    if (typeof loadAIBoostSection === 'function') try { loadAIBoostSection(); } catch {}
    if (typeof setupAIBoostListeners === 'function') try { setupAIBoostListeners(); } catch {}
    if (typeof setupInvIntelListeners === 'function') try { setupInvIntelListeners(); } catch {}
    if (typeof setupAiVisionListeners === 'function') try { setupAiVisionListeners(); } catch {}

    const isAdmin = role === 'DEALER_ADMIN' || role === 'OWNER' || role === 'MANAGER' || role === 'DEALER_GROUP';
    const inDealership = !!profileContext.dealership?.id;
    const isPersonal = profileContext.dealership?.is_personal === true;
    const isSolo = role === 'SALES_REP' && (isPersonal || !inDealership);
    const isDealerRep = role === 'SALES_REP' && inDealership && !isPersonal;
    const canManageFeeds = isAdmin || isSolo;

    // Feeds + Catalog visible to anyone with a dealership (team or personal) OR a
    // solo Facebook rep — canManageFeeds already grants isSolo full feed-management
    // rights (Add Feed, Sync Now), but this panel-visibility gate had never been
    // updated to match, so a solo account's Inventory page was just empty: no
    // feeds panel, no catalog, no sync button, nothing to manage or view.
    if (inDealership || isSolo) {
      document.getElementById('feeds-panel')?.classList.remove('hidden');
      document.getElementById('catalog-panel')?.classList.remove('hidden');
      // Defer the actual data loads until the Inventory page is first opened.
      __pageInit.inventory = () => { if (typeof loadInventoryFeeds === 'function') loadInventoryFeeds(); if (typeof loadInventoryCatalog === 'function') loadInventoryCatalog(); if (typeof prefetchInvIntelTags === 'function') prefetchInvIntelTags(); };
    }

    if (!canManageFeeds) {
      // Dealer reps see feeds read-only — hide add/sync controls. Facebook is the
      // one exception: every rep posts and syncs their own assigned inventory to
      // their own Facebook profile there, so Sync Now stays available for a
      // Facebook dealer rep too (Add Feed — connecting a new data source — stays
      // admin-only everywhere, Facebook included).
      const fbOnlyForSync = typeof isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace();
      document.querySelectorAll('[data-admin-only]').forEach(el => {
        if (fbOnlyForSync && el.id === 'sync-now-btn') return;
        el.classList.add('hidden');
      });
    }

    // Billing section: lives inside the Profile card now. Dealer reps don't pay (covered by dealer).
    if (isDealerRep) {
      document.getElementById('billing-section')?.classList.add('hidden');
    }

    // Hide admin-only nav items for non-admins
    if (!isAdmin) {
      document.querySelectorAll('[data-admin-nav]').forEach(el => el.classList.add('hidden'));
    }

    // Groups live inside Profile & Settings — reveal that section for anyone who
    // can create or join a group (dealer admins, group admins, owner).
    if (role === 'DEALER_GROUP' || role === 'OWNER' || role === 'DEALER_ADMIN') {
      document.getElementById('groups-settings-section')?.classList.remove('hidden');
    }

    // Today's Briefing (AI daily digest) on the Insights home page — admins only.
    if (isAdmin) loadDailyDigest();

    // Posting-safety (FB ban protection) settings — dealer-level.
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      document.getElementById('guardrail-settings-section')?.classList.remove('hidden');
      __pageInit.profile = () => loadGuardrailSettings();
    }
    // Reports page + Desk-a-deal (stacked manager reports, custom builder,
    // deal desk) — managers only. Reveal both desktop and mobile entries.
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      document.getElementById('nav-reports')?.classList.remove('hidden');
      document.getElementById('nav-reports-m')?.classList.remove('hidden');
      document.getElementById('nav-desk')?.classList.remove('hidden');
      // Managers get the Accounting group; their commission lives under it, so hide
      // the standalone "My commission" entry for them.
      document.getElementById('grp-accounting-wrap')?.classList.remove('hidden');
      document.getElementById('nav-commissions')?.classList.add('hidden');
    }
    // Hide team-only nav items (Leaderboard) for solo reps — nothing to rank
    if (isSolo || !inDealership) {
      document.querySelectorAll('[data-team-nav]').forEach(el => el.classList.add('hidden'));
    }

    // Solo / personal reps get ONLY Facebook posting & CRM. `canManageFeeds`
    // treats them like admins for feeds, so the dealer-grade features (Inv
    // Intelligence, Website, Equity, Automation, Reports, Desking, Appraisals)
    // and the dealer Settings tabs would otherwise show. Hide them explicitly.
    if (isSolo) {
      document.querySelectorAll('.nav-group[data-group="ii"], .nav-group[data-group="web"], .nav-group[data-group="sales"], [data-page="equity"], [data-page="automation"], #nav-reports, #nav-reports-m, #nav-desk, #nav-appraisal, #grp-accounting-wrap')
        .forEach(el => el.classList.add('hidden'));
      // Dealer-only Settings tabs + their section cards.
      ['team', 'branding', 'aiboost', 'group', 'dealermgmt'].forEach(t =>
        document.querySelector(`#settings-tabs [data-stab="${t}"]`)?.classList.add('hidden'));
      ['settings-team', 'prof-branding-section', 'ai-boost-section', 'inv-intel-section', 'groups-settings-section', 'crm-dms-card', 'guardrail-settings-section']
        .forEach(id => document.getElementById(id)?.classList.add('hidden'));
      __settingsTab = 'account';
    }

    // Specialized sub-roles (F&I / Service / Accounting / Cleanup) are not admins,
    // so the dealer-management Settings tabs don't apply to them either — leave only
    // the personal Account tab (name, password, photo). The sidebar itself is locked
    // to their workspace later by applyStaffRoleNav().
    if (STAFF_ROLE_NAV[role]) {
      ['team', 'branding', 'aiboost', 'group', 'dealermgmt'].forEach(t =>
        document.querySelector(`#settings-tabs [data-stab="${t}"]`)?.classList.add('hidden'));
      ['settings-team', 'prof-branding-section', 'ai-boost-section', 'inv-intel-section', 'groups-settings-section', 'guardrail-settings-section']
        .forEach(id => document.getElementById(id)?.classList.add('hidden'));
      __settingsTab = 'account';
    }

    // All role-based hide rules above have run. Reveal the page now (the head CSS
    // kept role-gated items hidden until this point, so nothing dealer-only ever
    // flashed for a solo rep). This happens synchronously after the hides, so the
    // browser paints the correct nav in one go.
    document.body.classList.add('ms-role-ready');
    personalizeSalesNav();
    syncNavGroupVisibility();
    // Final word for specialized sub-roles: lock the sidebar to their workspace.
    // Runs after the generic hides so it can reveal an otherwise admin-only group.
    applyStaffRoleNav(role);
    document.getElementById('insights-skeleton')?.classList.add('hidden');

    // Overdue-task badge on the Task Board nav item.
    try { if (typeof taskUpdateBadge === 'function') taskUpdateBadge(); } catch (e) {}

    // Setup is user-initiated from the canonical Launch Hub. Never interrupt login
    // or page navigation with a setup modal.
    try {
      renderSetupBar();
    } catch (e) {}

    // Daily Punch Clock Prompt (once per day on login)
    try { if (typeof checkLoginPunchClockPrompt === 'function') checkLoginPunchClockPrompt(); } catch (e) {}

    // The Leaderboard is its own page (the home for the Facebook / fb-only tiers,
    // a Marketing tab in DealerOS). Wire the loader for EVERYONE so navigating to it
    // never lands on an empty panel — this was the "leaderboard doesn't show" bug on
    // the Facebook Solo/Dealer tiers, where the account is personal / has no team.
    __pageInit.leaderboard = () => { try { initGlobalLeaderboard(); } catch (e) {} try { loadLeaderboard(); } catch (e) {} };
    // No real team to rank against (solo / personal), or no team to MANAGE (a
    // salesperson isn't a dealer admin): default the carousel to the Global view and
    // drop the "My Team" toggle — Global is the meaningful board. Only a dealer
    // admin/owner/manager retains the dealer team leaderboard, same as they always
    // have full visibility into their sales staff.
    if (!(inDealership && !isPersonal && isAdmin)) {
      document.getElementById('lb-tab-team')?.classList.add('hidden');
    }

    // Set permission flags used by switchPage to mirror panels into Insights
    __canSeeLeaderboard = inDealership && !isPersonal;
    __canSeeTeamInsights = isAdmin;
    __canSeeSalesTeam = isAdmin;

    // The Dashboard hosts the internal sales-performance board (real deals: sold +
    // F&I + appraisals). The full Team+Global "teaser" board is a Marketing page.
    // Facebook-only tier is the exception — its dashboard IS the full board.
    if (__canSeeLeaderboard) {
      if (__fbOnly) { try { loadLeaderboard(); } catch {} }
      else { try { loadInternalBoard(); } catch {} }
    }
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role) && typeof loadDealerDash === 'function') {
      document.getElementById('dealer-dash')?.classList.remove('hidden');
      loadDealerDash();
    }

    // Wire up the sidebar nav — leaves navigate; some carry a CRM tab to open.
    document.querySelectorAll('#dashboard-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page, tab = btn.dataset.tab;
        // The Customers page can be pre-filtered (Sold view), scoped to the rep's own
        // book ("My Customer Database"), or opened straight into the Add form.
        if (page === 'crm') {
          __crmStatusFilter = btn.dataset.filter === 'sold' ? 'sold,fni,delivered' : '';
          __crmSourceFilter = '';   // start each CRM view unfiltered by source

          __crmInitRep = btn.dataset.crmView === 'mine' ? (profileContext?.id || '') : '';
          // "Search Customers" spans the whole dealership; "My Customer Database" is the rep's own.
          __crmSearchAll = btn.dataset.crmView === 'all';
          __crmPendingAdd = btn.dataset.crmAction === 'add';
        }
        // The Inventory page renders differently for the Facebook posting hub vs
        // the manual (Inventory Intelligence) list — the nav leaf carries the mode.
        if (page === 'inventory' && btn.dataset.invmode) __inventoryMode = btn.dataset.invmode;
        if (page === 'profile' && tab) __settingsTab = tab;
        switchPage(page);
        btn.blur();   // drop the focus outline so it doesn't linger on the old item
      });
    });
    setupMobileMoreMenu();
    // Set the purchased-product boundary BEFORE choosing any landing page. The old
    // sequence opened a role-default/legacy page, then applied product gates and
    // navigated again, producing the visible legacy-page flash on every load.
    applyProductNav(legacyProductsFromAccess(window.__access) || profileContext?.products);

    // Every single-product account (exactly one product, not a bundle or full
    // dealer_os — Design Studio, Facebook Solo/Dealer, AI ChatBot, Video, Website,
    // Social, Email alike) gets the SAME compact Settings treatment, not just
    // Design Studio: the Settings tab bar today is account/admin/hr/sales/
    // marketing/inventory/service/accounting (SETTINGS_TAB_SECTIONS in
    // dashboard-part8.js) — every non-account button carries [data-admin-only],
    // and since these accounts' role is admin-grade (canManageFeeds is true), the
    // generic canManageFeeds hide earlier never touches them. Hide the tab buttons
    // directly instead. Billing lives under Administration for every tier, so fold
    // it into My Account here — it's the one Administration card every
    // single-product tier still needs (Upgrade lives outside Settings entirely, at
    // the header's #open-upgrades button). MUST run after applyProductNav() (just
    // above), not before: that call is what sets the data-product attribute
    // isSingleProductWorkspace()/isFacebookOnlyWorkspace() read — checking it any
    // earlier always reads empty and this block silently never fires.
    if (typeof isSingleProductWorkspace === 'function' && isSingleProductWorkspace()) {
      document.querySelectorAll('#settings-tabs [data-admin-only]').forEach(el => el.classList.add('hidden'));
      if (Array.isArray(SETTINGS_TAB_SECTIONS?.account) && !SETTINGS_TAB_SECTIONS.account.includes('billing-section')) {
        SETTINGS_TAB_SECTIONS.account.push('billing-section');
      }
      const fbOnly = typeof isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace();
      // Facebook Dealer is the one single-product tier that's a real dealership
      // team, not a single-user tool subscriber — computed once here, reused below
      // for both the folded-in Team roster and the Team Chat dock toggle.
      const isFbDealer = /(?:^|\s)facebook_dealer(?:\s|$)/.test(document.documentElement.getAttribute('data-product') || '');
      // Facebook Solo/Dealer additionally fold in Facebook Posting Safety — the
      // one other dealer-admin setting this tier actually uses.
      if (fbOnly && Array.isArray(SETTINGS_TAB_SECTIONS?.account) && !SETTINGS_TAB_SECTIONS.account.includes('guardrail-settings-section')) {
        SETTINGS_TAB_SECTIONS.account.push('guardrail-settings-section');
        document.getElementById('guardrail-settings-section')?.classList.remove('hidden');
      }
      // Design Studio folds in the real "Connected social accounts" card — its
      // scheduler posts to these same accounts, and Administration (where account
      // connections would otherwise live) is hidden entirely for single-product tiers.
      if (typeof isDesignStudioOnlyWorkspace === 'function' && isDesignStudioOnlyWorkspace()
        && Array.isArray(SETTINGS_TAB_SECTIONS?.account) && !SETTINGS_TAB_SECTIONS.account.includes('studio-social-connections')) {
        SETTINGS_TAB_SECTIONS.account.push('studio-social-connections');
        document.getElementById('studio-social-connections')?.classList.remove('hidden');
        if (typeof studioSocialConnectionsRender === 'function') studioSocialConnectionsRender();
      }
      // Video folds in DMS lead-delivery sync (crm-dms-card, normally under
      // Sales), a MarketSync-managed texting number (settings-texting-card) and its
      // own email-sending setup (email-sending-card) — normally under Administration,
      // hidden entirely for single-product tiers. A Video account has no CRM/DMS of
      // its own to send follow-up texts/emails through otherwise, and dealers who do
      // run a real DMS/CRM still need the ADF sync so those follow-ups land there too.
      if (typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace() && Array.isArray(SETTINGS_TAB_SECTIONS?.account)) {
        ['crm-dms-card', 'settings-texting-card', 'email-sending-card'].forEach(id => {
          if (!SETTINGS_TAB_SECTIONS.account.includes(id)) SETTINGS_TAB_SECTIONS.account.push(id);
        });
        if (typeof loadTextingStatus === 'function') loadTextingStatus();
        // Admin view only (settings-texting-card is data-admin-only, hidden for a
        // rep — the rep-level layout, Email/Language stacked under Billing, stays
        // exactly as-is). CRM/DMS + Text messaging fill columns 1-2 of their row
        // with column 3 empty; move Language there instead of leaving it stacked
        // under Email/Billing two rows down.
        if (isAdmin) {
          const texting = document.getElementById('settings-texting-card');
          const lang = document.getElementById('settings-language-card');
          if (texting && lang && lang.previousElementSibling !== texting) {
            texting.parentElement.insertBefore(lang, texting.nextSibling);
          }
        }
      }
      // Facebook Dealer and Video both fold in the Team roster (Sales/Management/etc.
      // picker + Edit/Insights modal) — Administration is hidden entirely for
      // single-product tiers, so My Account is the only place this reaches their reps
      // at all. Gated on role (isAdmin, which includes DEALER_GROUP) rather than the
      // facebook_dealer product string alone — a Group/Dealer Admin previewing a
      // Facebook-only account can resolve to either product label depending on how
      // the account was provisioned, and either way only someone who can actually
      // manage a team should see this (a solo/independent rep has no team).
      const isVideoTeam = typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace();
      if ((fbOnly || isVideoTeam) && isAdmin && Array.isArray(SETTINGS_TAB_SECTIONS?.account) && !SETTINGS_TAB_SECTIONS.account.includes('settings-team')) {
        SETTINGS_TAB_SECTIONS.account.push('settings-team');
      }
      __settingsTab = 'account';
      if (typeof settingsTab === 'function') settingsTab('account');
      // Every single-product tier drops the employment-record card — it renders
      // from GET /hr/me, which 404s for every one of these accounts (they're
      // created through product signup, not the full HR onboarding flow that
      // creates a staff_members row), so the card just sat there permanently
      // showing "Loading your record…". This needs BOTH an immediate direct hide
      // AND removing the id from the tracked list — neither alone is enough:
      //   - Direct hide only: applyProductNav() above already triggered one
      //     settingsTab('account') call (via its own switchPage('profile')) using
      //     the unmodified section list, un-hiding the card — a hide here catches
      //     that. But it's still tracked in SETTINGS_TAB_SECTIONS.account, so ANY
      //     later settingsTab('account') call (the header Profile icon, or the
      //     msRouteFromHash()/bootPage boot-route replay a few lines down when
      //     the URL is #/p/profile) re-adds it to the active set and un-hides it
      //     again — confirmed live: it kept reappearing after landing on
      //     #/p/profile specifically.
      //   - Array removal only: settingsTab()'s toggle loop only manages ids it
      //     still tracks. Remove it from every tab's list without ever hiding it
      //     directly first, and it's stuck in whatever state that FIRST call
      //     left it — visible, permanently showing "Loading your record…".
      // This also fixes the account cards rendering in one stacked column
      // instead of side by side: this card carries data-full-width="true", so
      // while stuck visible it was forcing itself onto its own grid row and
      // pushing everything after it onto rows of their own, wasting the rest of
      // each row's space.
      document.getElementById('settings-my-record')?.classList.add('stab-hide');
      if (Array.isArray(SETTINGS_TAB_SECTIONS?.account)) {
        SETTINGS_TAB_SECTIONS.account = SETTINGS_TAB_SECTIONS.account.filter(id => id !== 'settings-my-record');
      }
      forceCompactSettingsGrid();
      // Every single-product dashboard is one tool, not a department suite — the
      // floating "Intelligence" AI dock exists to coordinate work across a
      // dealership's staff/departments, which a single-tool subscriber doesn't
      // have. Setup Wizard nudges are for configuring DealerOS departments the
      // account never bought.
      document.getElementById('ai-dock-btn')?.classList.add('hidden');
      document.getElementById('ai-dock-panel')?.classList.add('hidden');
      document.getElementById('setup-status-banner')?.classList.add('hidden');
      // Its reps still need Team Chat to coordinate with each other. Every other
      // tier (including Facebook Solo, a lone independent rep) gets it hidden — both
      // the legacy panel AND the staff-chat launcher dock, which mounts itself and
      // must be torn down explicitly so it stops polling/popping notifications.
      document.getElementById('team-chat-dock-panel')?.classList.toggle('hidden', !isFbDealer);
      document.getElementById('staff-chat-dock-bar')?.classList.toggle('hidden', !isFbDealer);
      if (!isFbDealer && typeof window.disableStaffChatDock === 'function') window.disableStaffChatDock();
    }

    // DealerOS: managers/admins land on the Command Center (today's operations +
    // exceptions); reps keep the Dashboard as home.
    // SaaS Admin in MarketSync mode → the company command center; otherwise the
    // dealership role's own My Day. This is a UX landing choice; route permissions remain
    // authoritative and switchPage will refuse any destination the caller cannot open.
    const bootRoute = typeof msRouteFromHash === 'function' ? msRouteFromHash() : null;
    const bootPage = (bootRoute && bootRoute.page) ? bootRoute.page : null;
    const settledWorkspace = typeof resolveWorkspaceContext === 'function' ? resolveWorkspaceContext() : null;
    if (settledWorkspace?.type === 'website' || settledWorkspace === 'website') {
      switchPage('website');
    } else if (bootPage) {
      switchPage(bootPage);
      if (bootRoute.tab && typeof engineTab === 'function' && typeof ENGINES !== 'undefined' && ENGINES[bootPage]) {
        engineTab(bootPage, bootRoute.tab);
      }
    } else if (settledWorkspace?.type === 'marketing_suite') {
      // Suite Pulse is marketing-specific. Do not let an admin/manager role's
      // DealerOS landing override it with the executive command center.
      deptGo('marketing-overview', '', 'overview');
    } else if (__dashMode === 'marketsync' && (profileContext?.workspace === 'saas_admin' || document.documentElement.getAttribute('data-dash-owner') === '1')) {
      switchPage('saas-command');
    } else {
      switchPage(dealerRoleLanding(profileContext?.role));
    }
    applyFeatureFlags();   // hide nav for features the dealer switched off
    // Flatten the left nav to departments for the full DealerOS manager/admin view
    // (runs after all gating so it derives visibility from the settled nav).
    renderDeptNav(profileContext?.role);
    renderUpgradeCta();           // "Upgrade plan" CTA unless already on the full bundle
    applyExtensionVisibility();   // hide the FB extension CTA for SaaS / AI-only accounts
    // The canonical workspace and navigation are now final. Reveal exactly that page
    // on the next frame; legacy compatibility containers were never painted.
    const waitDemo = !!(profileContext?.workspace === 'saas_admin' || profileContext?.is_marketsync || window.__demoActivePackage);
    if (waitDemo) {
      window.__msHoldBootForDemo = true;
      setTimeout(() => {
        if (document.body.classList.contains('ms-app-booting')) document.body.classList.remove('ms-app-booting');
      }, 900);
    } else {
      requestAnimationFrame(() => document.body.classList.remove('ms-app-booting'));
    }

    // Global leaderboard — available to EVERYONE (solo reps included). Loaded lazily on first carousel switch.
    initGlobalLeaderboard();

    if (isAdmin) {
      document.getElementById('leaderboard-panel')?.classList.remove('hidden');
      document.getElementById('dealer-view-panel')?.classList.remove('hidden');
      // Team players + trend charts now live on the Insights page (admin only)
      document.getElementById('insights-team-section')?.classList.remove('hidden');
      if (typeof loadCharts === 'function') try { loadCharts(); } catch {}
      if (typeof loadDealerManagementMatrix === 'function') try { loadDealerManagementMatrix(); } catch {}
    } else {
      document.getElementById('rep-view-panel')?.classList.remove('hidden');
      if (typeof loadMyStats === 'function') try { loadMyStats(); } catch {}
    }

} catch (err) {
    document.body.classList.remove('ms-app-booting');
    if (err.message === 'TRIAL_EXPIRED') {
      // Free trial lapsed — show the blocking paywall popup with all packages to choose.
      openPaywallModal('trial_ended');
      return;
    }
    if (err.message === 'SUBSCRIPTION_REQUIRED') {
      // No active subscription — same paywall (pick a package to continue).
      openPaywallModal('subscription_required');
      return;
    }
    if (err.message === 'SESSION_EXPIRED') {
      // Genuine 401 from the server — token really is invalid/expired. Safe to log out.
      clearLocalStorage();
      window.location.href = 'login.html';
      return;
    }
    // Anything else (network blip, cold-start timeout, a render-time JS error, etc.)
    // is NOT proof the session is invalid. Logging out here is what causes the
    // dashboard <-> login flicker loop. Show an inline error and let the user retry
    // instead of nuking their session.
   console.error('Dashboard init failed (non-auth error):', err);
    const banner = document.createElement('div');
    banner.className = 'fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center py-2';
    banner.innerHTML = `Something went wrong loading the dashboard. <button onclick="window.location.reload()" class="underline font-bold ml-2">Retry</button>`;
    document.body.prepend(banner);
    document.body.classList.add('ms-role-ready'); // reveal page instead of leaving it stuck hidden
  }
}

// Sidebar nav page switcher. Each page shows only its own content — no panel
// mirroring, so Insights stays clean and each nav item lands on a focused view.
// Per-dealer feature toggles — hide nav for features the dealer switched off
// (entitlement still governs access; this is a visibility preference on top).
let __featureFlags = null;
const FEATURE_NAV = {
  // Target the website leaves, not the whole Marketing group — the group also holds
  // Marketplace + AI Chat, which the website toggle must not hide.
  website: '[data-page="website"], [data-page="website-settings"]',
  automation: '[data-page="automation"]',
  equity: '[data-page="equity"]',
  inv_intel: '.nav-group[data-group="ii"]',
  appraisals: '#nav-appraisal',
  reports: '#nav-reports, #nav-reports-m',
};
async function applyFeatureFlags(force) {
  if (__featureFlags === null || force) {
    try { const d = await apiGetJson('/dealership/features', { retries: 1 }); __featureFlags = d?.features || {}; }
    catch { __featureFlags = {}; return; }
  }
  // Use a dedicated `ff-off` class so we never fight the `hidden` class that
  // role/entitlement gating owns — an item hides if role-hidden OR feature-off.
  for (const [k, sel] of Object.entries(FEATURE_NAV)) {
    const off = __featureFlags[k] === false;
    document.querySelectorAll(sel).forEach(el => el.classList.toggle('ff-off', off));
  }
  // Collapse the Sales group if turning a feature off left it with nothing to show.
  if (typeof syncNavGroupVisibility === 'function') syncNavGroupVisibility();
}
window.applyFeatureFlags = applyFeatureFlags;

// How-to guide — open the full guide page inside an in-app modal (iframe),
// not a separate browser tab. Loaded lazily on first open.
function openGuideModal() {
  const m = document.getElementById('guide-modal'), f = document.getElementById('guide-frame');
  if (!m || !f) return;
  if (!f.getAttribute('src')) f.setAttribute('src', '/guide.html');
  m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeGuideModal() {
  const m = document.getElementById('guide-modal');
  if (m) m.classList.add('hidden');
  document.body.style.overflow = '';
}
window.openGuideModal = openGuideModal;
window.closeGuideModal = closeGuideModal;
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'guide-modal') closeGuideModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('guide-modal')?.classList.contains('hidden')) closeGuideModal(); });

// Collapse/expand a nav group in the desktop sidebar.
function toggleNavGroup(id) {
  const body = document.getElementById('grp-' + id);
  const chev = document.getElementById('chev-' + id);
  if (!body) return;
  const collapsed = body.classList.toggle('hidden');
  chev?.classList.toggle('-rotate-90', collapsed);
}
window.toggleNavGroup = toggleNavGroup;

// Show/hide a nav group by whether it has any visible destination (e.g. Sales,
// which holds Appraisals + Equity). Only touches groups WITHOUT their own admin
// gating (`data-admin-nav`), so it can never reveal an admin-only group.
function syncNavGroupVisibility() {
  document.querySelectorAll('#nav-desktop .nav-group').forEach(g => {
    if (g.hasAttribute('data-admin-nav')) return;   // its own gating owns visibility
    const leaves = [...g.querySelectorAll('.nav-group-body .nav-item')];
    if (!leaves.length) return;
    const anyVisible = leaves.some(el => !el.classList.contains('hidden') && !el.classList.contains('ff-off'));
    g.classList.toggle('hidden', !anyVisible);
  });
}
window.syncNavGroupVisibility = syncNavGroupVisibility;

// The Sales menu reads differently by role: a rep sees "My Tasks / My Appointments"
// and no Leads item; a manager/dealer-admin sees "All Tasks / All Appointments" plus
// the manager-only Leads worklist.
function personalizeSalesNav() {
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  const setLbl = (id, txt) => { const el = document.getElementById(id)?.querySelector('[data-nav-label]'); if (el) el.textContent = txt; };
  setLbl('nav-tasks', isMgr ? 'All Tasks' : 'My Tasks');
  setLbl('nav-appointments', isMgr ? 'All Appointments' : 'My Appointments');
  setLbl('nav-leads-sales', isMgr ? 'All Leads' : 'My Leads');
  document.getElementById('nav-leads-sales')?.classList.toggle('hidden', !isMgr);
  document.getElementById('nav-fni-deals')?.classList.toggle('hidden', !isMgr);
}
window.personalizeSalesNav = personalizeSalesNav;

// Header "Post to Facebook" button — opens the Marketplace posting hub (the old
// Facebook › Marketplace nav leaf, now promoted to a one-click header action).
function postToFacebook() { __inventoryMode = 'facebook'; switchPage('inventory'); }
window.postToFacebook = postToFacebook;

// The rank chip + old leaderboard deep links open the full Team+Global board.
// It's a Marketing-department page now (except the Facebook-only tier, where it
// still lives on the dashboard).
function openLeaderboardOnDash() {
  if (__fbOnly) {
    switchPage('leaderboard');
    setTimeout(() => { try { document.getElementById('leaderboard-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 120);
    return;
  }
  switchPage('leaderboard');
  setTimeout(() => { try { document.getElementById('leaderboard-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 120);
}
window.openLeaderboardOnDash = openLeaderboardOnDash;

// ═══════════════════════════════════════════════════════════════════════════
// Departments — the user-facing navigation unit. A department groups several
// existing pages; when you're on one of its pages, the others appear as tabs
// at the top of the content (renderDeptTabbar). Engines stay behind the wall:
// a department's pages are quietly powered by whatever engines they need.
// Single-workspace departments (Executive, admin) use the in-body 5-tab shell
// instead; those pages are intentionally NOT listed here.
// ═══════════════════════════════════════════════════════════════════════════
// `mgr:true` (department or page) = managers/owners/admins only. `roles:[...]` = an
// explicit allow-list. Nothing set = everyone in the dealership (reps included).
// A sales rep therefore sees Sales, Detail/Cleanup and Marketing — with the
// manager/analyst pages inside them hidden — and nothing else. Settings isn't a
// department; the header gear owns it.
//
//  SOURCE OF TRUTH for the dashboard sidebar navigation now lives in
//    js/modules/workspace-registry.js (MS_WORKSPACES) — it is the ONE registry the
//    desktop sidebar, the workspace tab-bar and the mobile bottom row all derive
//    from. To add/rename/reorder/gate a nav item or workspace, edit THERE
//    (and SAAS_DEPARTMENTS below for MarketSync owner mode).
//    The static #nav-desktop tree in dashboard.html is LEGACY and hidden — never
//    edit nav there. See the "LEGACY HARDCODED SIDEBAR" banner in dashboard.html
//    and docs/DEALEROS_UI_AUDIT.md for the full page → workspace mapping.
//
// DEPARTMENTS stays as the name every renderer below already uses, so the
// registry swap needs no changes to renderDeptNav/renderDeptTabbar/deptOpen/
// applyMobileQuickRow. The inline fallback keeps the dashboard navigable if the
// registry file ever fails to load (nav is presentation; the API still enforces
// permissions server-side).
const DEPARTMENTS = (typeof MS_WORKSPACES !== 'undefined' && MS_WORKSPACES) || {
  executive: { label: 'Pulse', icon: 'chart', accent: 'indigo', mgr: true, pages: [{ page: 'command', label: 'Pulse' }] },
  sales: {
    label: 'Sales', icon: 'currency', accent: 'amber',
    pages: [
      { page: 'sales', label: 'Pulse' },
      { page: 'crm', label: 'Customers' },
      { page: 'appointments', label: 'Appointments' },
      { page: 'tasks', label: 'Tasks' },
    ],
  },
};
// Role gate for a department or page spec: explicit `roles` list wins, else `mgr`
// means managers/owners/admins only, else everyone in the dealership.
const DEPT_MGR_ROLES = ['DEALER_ADMIN', 'OWNER', 'MANAGER'];
function deptRoleOk(spec) {
  if (!spec) return true;
  if (Array.isArray(spec.roles)) return spec.roles.includes(profileContext?.role);
  if (spec.mgr) return DEPT_MGR_ROLES.includes(profileContext?.role);
  return true;
}
let __activeDept = null;
let __currentPage = null;

// ── Plan-tier feature gating for the Dealer OS department nav ─────────────────
// Maps every DealerOS nav page → the access-context entitlement required for it to
// show. This makes each plan's sidebar match the plan catalog instead of treating
// every DealerOS account as Pro.
const PAGE_FEATURE = {
  command: 'os.dashboard', insights: 'os.dashboard', sales: 'os.crm',
  'inventory-overview': 'os.inventory', 'fni-overview': 'os.sales', 'service-overview': 'os.service', 'parts-overview': 'os.service', 'accounting-overview': 'os.accounting', 'marketing-overview': 'os.marketing',
  crm: 'os.crm', leads: 'os.crm', appointments: 'os.crm', tasks: 'os.crm',
  appraisal: 'os.crm', equity: 'os.crm',
  inventory: 'os.inventory', recon: 'os.automations',
  accounting: 'os.accounting',
  commissions: 'os.accounting',
  'acct-insights': 'os.accounting', 'acct-reconciliation': 'os.accounting', 'acct-bank': 'os.accounting',
  'acct-expenses': 'os.accounting', 'acct-budget': 'os.accounting', 'acct-tax': 'os.accounting',
  'acct-reports': 'os.accounting', 'acct-settings': 'os.accounting',
  'service-ros': 'os.service', 'service-appointments': 'os.service', 'service-parts': 'os.service',
  website: 'os.website', seo: 'os.marketing',
  'automation-builder': 'os.automations', operations: 'os.automations', taskboard: 'os.automations',
  'email-marketing': 'os.email_marketing',
  delivery: 'os.sales', fni: 'os.sales',
  reports: 'os.reports',
  'inv-intel': 'os.inventory', market: 'os.inventory',
  'ai-home': 'os.marketing', 'video-studio': 'os.marketing', studio: 'design.canvas', 'social-scheduler': 'social.scheduler',
  'api-keys': 'os.integrations',
  'owner-users': 'os.team', 'sales-team': 'os.team', 'people-compliance': 'os.team', hr: 'os.team', people: 'os.team',
  'people-overview': 'os.team',
  // `academy`, `launch`, and `ai-inbox` are deliberately ABSENT: an unmapped page is always allowed.
  // Required compliance training and messaging are not plan upsells, and gating SETUP behind an entitlement
  // would stop a dealership configuring the product it just bought.
  config: 'os.settings',
};
// 'website' is product-gated (not just feature-gated) to mirror the backend exactly:
// GET/PUT /dealership/site is guarded server-side by requireProduct('marketsync_website')
// (routes/site.js), so the nav must ask the same question. Checking only the
// os.website/website.builder feature (as PAGE_ANY_FEATURE below still lists, for
// accounts on the live /access path) left a gap where a feature-true/product-false
// account would still see the tab and then get PRODUCT_ACCESS_REQUIRED — the exact
// defect fixed for the Core/Pro cold-start fallback. Gating on the product here closes
// that gap for every access path, current and future, not just the fallback.
const PAGE_PRODUCT = { leaderboard: 'facebook', 'social-scheduler': 'marketsync_social', studio: 'design_studio', website: 'marketsync_website' };
// Product bundles can expose a department without buying the similarly named
// DealerOS engine. These alternatives keep standalone and Marketing/Digital nav
// honest while still using the same server-authored feature list.
const PAGE_ANY_FEATURE = {
  crm: ['os.crm', 'identity.verify'],
  command: ['os.dashboard', 'identity.reports'],
  'marketing-overview': ['os.marketing', 'design.canvas', 'social.scheduler'],
  studio: ['design.canvas', 'os.marketing'],
  'social-scheduler': ['social.scheduler', 'os.marketing'],
  'email-marketing': ['os.email_marketing', 'email.campaigns', 'email.templates', 'email.audiences', 'email.automations'],
  'automation-builder': ['os.automations', 'os.marketing', 'os.email_marketing', 'email.campaigns', 'email.templates', 'email.audiences', 'email.automations'],
  'video-studio': ['os.marketing', 'video.library'],
  website: ['os.website', 'website.builder'],
  // `seo.intelligence` and `seo.standalone` never existed in the catalog, so this
  // gate only ever really asked `os.marketing`. That is the wrong question: it is
  // the DealerOS marketing engine, which a customer who bought SEO on its own does
  // not have. Measured against the catalog, MarketSync SEO and MarketSync Digital
  // both grant all ten seo.* features and both FAILED this gate — they owned the
  // product and could not see the tab. DealerOS Complete passed only incidentally,
  // via os.marketing, rather than because it owns SEO.
  seo: ['seo.overview', 'seo.audit', 'seo.settings', 'os.marketing'],
  'ai-home': ['os.marketing', 'ai.overview'],
};
// The dealership record also carries its server-authored package name. This fallback
// keeps the DealerOS menu stable during an access-context retry/cold start; it only
// affects navigation presentation — API permissions remain enforced on the server.
// Mirror plan-catalog.js EXACTLY. Core & Pro are operational DealerOS ONLY — they do
// NOT include any MarketSync Digital product (Website, Social, Email, Video, SEO, AI
// Dealer, Design Studio, Facebook). Advertising a Digital work area here shows a tab
// the server then refuses with PRODUCT_ACCESS_REQUIRED (the "Website page → access
// denied" defect). Digital is sold as marketsync-digital and bundled only into
// Complete. This map is a cold-start fallback OR'd with the authoritative /access
// context, so keeping it conservative can only hide a tab that would 403 anyway — it
// can never cause a false denial.
const DEALER_OS_PLAN_FEATURES = {
  starter: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings']),
  growth: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings', 'os.sales', 'os.accounting', 'os.automations', 'os.integrations']),
  // core === CURRENT_CORE_OS
  core: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings']),
  // pro / dealeros_pro === CURRENT_PRO_OS (Core + Sales + Service); no Digital.
  pro: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service']),
  dealeros_pro: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service']),
  // dealeros_complete === CURRENT_COMPLETE_OS + the entire MarketSync Digital bundle.
  dealeros_complete: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service', 'os.team', 'os.accounting', 'os.marketing', 'os.website', 'os.automations', 'os.email_marketing', 'os.integrations', 'fb.inventory', 'fb.leaderboard', 'fb.sales_reps', 'design.canvas', 'social.scheduler', 'social.accounts', 'social.calendar', 'social.studio', 'email.campaigns', 'email.templates', 'email.audiences', 'email.automations', 'video.library', 'video.record', 'video.templates', 'video.settings', 'website.builder', 'website.pages', 'website.domains', 'website.settings', 'ai.overview', 'ai.conversations', 'ai.agents', 'ai.knowledge', 'ai.settings', 'seo.overview', 'seo.audit', 'seo.autofix', 'seo.content', 'seo.competitors', 'seo.local', 'seo.inventory', 'seo.ai_search', 'seo.reports', 'seo.settings']),
};
function dealerPlanFallback() {
  const plan = String(profileContext?.plan || profileContext?.dealership?.plan || '').toLowerCase();
  const features = DEALER_OS_PLAN_FEATURES[plan];
  if (!features) return { features: null, products: null };
  // ONLY Complete bundles the MarketSync Digital products. Core & Pro are operational
  // DealerOS (dealer_os) only — matching plan-catalog.js — so they must not advertise
  // Digital products the server will refuse (PRODUCT_ACCESS_REQUIRED). marketsync-digital
  // (standalone Digital) isn't a DealerOS plan key here; it relies on the live /access
  // context for its product list.
  const digital = plan === 'dealeros_complete';
  return {
    features,
    products: digital
      ? new Set(['dealer_os', 'facebook', 'ai_dealer', 'design_studio', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'marketsync_seo', 'marketsync_identity'])
      : new Set(['dealer_os']),
  };
}
// Dealer-controlled switches are a second visibility layer after the paid plan.
// Keep this mapping page-based rather than deriving it from the legacy sidebar DOM:
// the department nav is its own renderer and must not disappear merely because the
// old nested menu happens to be collapsed or hidden for presentation reasons.
const PAGE_DEALER_FLAG = {
  website: 'website',
  'automation-builder': 'automation', operations: 'automation', taskboard: 'automation',
  equity: 'equity',
  appraisal: 'appraisals',
  reports: 'reports',
  'inv-intel': 'inv_intel', market: 'inv_intel',
};
// True unless this page maps to a feature the plan doesn't include. Scoped to full
// Dealer OS mode: restricted product tiers (Facebook / AI) use their own page sets, and
// window.hasFeature fails OPEN when /access/context is unavailable, so legacy accounts
// and an older backend are never over-filtered.
function pageFeatureOk(pg, invmode = null) {
  if (__productAllowedPages || __fbOnly) return true;   // restricted tiers handled by product nav
  // A dedicated demo tenant has a broad server-side showcase overlay so its operator
  // can switch packages. For navigation presentation, use the selected package's
  // canonical catalog entitlements returned by /demo/control instead. This keeps the
  // normal DealerOS registry unchanged while Core / Pro / Complete reveal only their
  // included work areas. Real-customer authorization continues to use __access.
  const demoEntitlements = window.__demoEntitlements;
  const access = demoEntitlements && Array.isArray(demoEntitlements.products) && Array.isArray(demoEntitlements.features)
    ? demoEntitlements
    : window.__access;
  const fallback = dealerPlanFallback();
  const requiredProduct = (pg === 'inventory' && (invmode || __inventoryMode) === 'facebook')
    ? 'facebook' : PAGE_PRODUCT[pg];
  if (requiredProduct) {
    // The entitlement context is derived server-side from live subscription rows. Until
    // it is available, do not advertise an add-on as part of a lower DealerOS plan.
    return !!((access && (access.isPlatformStaff || (access.products || []).includes(requiredProduct)))
      || fallback.products?.has(requiredProduct));
  }
  const feat = PAGE_FEATURE[pg];
  if (!feat) return true;
  const alternatives = PAGE_ANY_FEATURE[pg] || [feat];
  if (alternatives.length > 1) {
    return alternatives.some(featureId => (access && (access.isPlatformStaff || (access.features || []).includes(featureId)))
      || fallback.features?.has(featureId));
  }
  return !!((access && (access.isPlatformStaff || (access.features || []).includes(feat)))
    || fallback.features?.has(feat));
}

// Is a page reachable for this user? Respect the per-item gating that product /
// role / feature flags apply by toggling the `hidden` class on nav items.
function deptPageVisible(pg, invmode = null) {
  if (!pageFeatureOk(pg, invmode)) return false;   // plan-tier entitlement gate
  if (__staffAllowedPages && !__staffAllowedPages.has(pg)) return false;
  const dealerFlag = PAGE_DEALER_FLAG[pg];
  return !dealerFlag || __featureFlags?.[dealerFlag] !== false;
}
function renderDeptTabbar(pageId) {
  const bar = document.getElementById('dept-tabbar');
  if (!bar) return;
  const hide = () => { bar.classList.add('hidden'); bar.innerHTML = ''; };
  const suite = (typeof getActiveMarketingSuite === 'function') ? getActiveMarketingSuite() : null;
  if (suite && typeof getMarketingSuiteConfig === 'function') {
    const cfg = getMarketingSuiteConfig(suite);
    // Complete / Sales / Service suites: left nav already lists every feature.
    // A second top tab strip is pure duplication — hide it.
    // MarketSync Digital keeps area sub-tabs only when an area has multiple destinations.
    if (suite === 'complete' || suite === 'sales' || suite === 'service') {
      document.getElementById('suite-feature-tabbar')?.replaceChildren();
      return hide();
    }
    if (!cfg.navItems) return hide();
    const activeTab = pageId === 'marketing-overview'
      ? ((typeof ENGINE_STATE !== 'undefined' && ENGINE_STATE['marketing-overview']) || 'overview')
      : pageId === 'website' ? (window.__wsTab || 'setup')
      : pageId === 'seo' ? ((typeof __seoMainTab !== 'undefined' && __seoMainTab) || 'settings')
      : pageId === 'automation-builder' ? (__autoTab || 'overview')
      : pageId === 'ai-home' ? (window.__aiHomeTab || 'conversations')
      : pageId === 'social-scheduler' ? (window.__socialTab || window.__studioSchedulerTab || 'overview')
      : null;
    const area = typeof marketingSuiteAreaForPage === 'function'
      ? marketingSuiteAreaForPage(cfg, pageId, activeTab) : null;
    if (!area || area.id === 'pulse' || area.items.length <= 1 || (pageId === 'website' && activeTab === 'builder')) return hide();
    const tabs = area.items.map(item => {
      const on = item.page === pageId && (!item.tab || item.tab === activeTab);
      const call = item.studioLaunch
        ? 'window.openMarketSyncStudio()'
        : `deptGo('${esc(item.page)}'${item.tab ? `,'','${esc(item.tab)}'` : ''})`;
      return `<button type="button" role="tab" aria-selected="${on}"${on ? ' aria-current="page"' : ''} onclick="${call}" class="px-3.5 py-2 -mb-px border-b-2 text-[13px] font-bold whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'text-indigo-700 dark:text-indigo-300 border-current' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}">${esc(item.label)}</button>`;
    }).join('');
    // Tabs only — suite title lives on the engine header (no triple title stack).
    // Prefer the in-engine mount under the main header when present.
    const tabsHtml = `<div role="tablist" aria-label="${esc(cfg.badge || area.label || 'Suite')}" class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto overscroll-x-contain">${tabs}</div>`;
    const underHeader = document.getElementById('suite-feature-tabbar');
    if (underHeader) {
      underHeader.innerHTML = tabsHtml;
      underHeader.classList.remove('hidden');
      hide();
      return;
    }
    bar.innerHTML = tabsHtml;
    bar.classList.remove('hidden');
    return;
  }
  // Standalone products still use the shared top header — but only as a fallback.
  // Previously these destinations were suppressed here, leaving Website and AI
  // without their Builder/Setup or Pulse/Setup navigation. Now that renderDeptNav's
  // restricted branch renders those same destinations into the sidebar itself
  // (__deptNavBuilt), repeating them up here too is a duplicate nav, not a fallback.
  const restricted = typeof restrictedNavPages === 'function' ? restrictedNavPages() : null;
  const workspaceContext = typeof resolveWorkspaceContext === 'function' ? resolveWorkspaceContext() : null;
  if (!__deptNavBuilt && restricted && restricted.length > 1 && (__productAllowedPages || __fbOnly || __staffAllowedPages || workspaceContext?.type === 'website')) {
    const activeTab = pageId === 'website' ? (window.__wsTab || 'setup')
      : pageId === 'automation-builder' ? (__autoTab || 'overview')
      : pageId === 'ai-home' ? (window.__aiHomeTab || 'conversations')
      : pageId === 'social-scheduler' ? (window.__socialTab || window.__studioSchedulerTab || 'overview')
      : null;
    const tabs = restricted.map(item => {
      const on = item.page === pageId && (!item.tab || item.tab === activeTab);
      const call = item.studioLaunch
        ? 'window.openMarketSyncStudio()'
        : item.studioSchedulerLaunch
          ? 'window.openStudioSchedulerWithEntitlementCheck()'
          : `deptGo('${esc(item.page)}'${item.invmode ? `,'${esc(item.invmode)}'` : `,''`}${item.tab ? `,'${esc(item.tab)}'` : ''})`;
      return `<button type="button" role="tab" aria-selected="${on}"${on ? ' aria-current="page"' : ''} onclick="${call}" class="px-3.5 py-2 -mb-px border-b-2 text-[13px] font-bold whitespace-nowrap transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'text-indigo-700 dark:text-indigo-300 border-current' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}">${esc(item.label)}</button>`;
    }).join('');
    bar.innerHTML = `<div role="tablist" aria-label="Workspace navigation" class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">${tabs}</div>`;
    bar.classList.remove('hidden');
    return;
  }
  if (pageId === 'website' || (typeof resolveWorkspaceContext === 'function' && resolveWorkspaceContext() === 'website')) { __activeDept = null; return hide(); }
  if (__fbOnly) { __activeDept = null; return hide(); }   // stripped Facebook-only tier
  if (__productAllowedPages) { __activeDept = null; return hide(); }   // restricted product tiers use their flat nav, no dept tab-bar
  // MarketSync owner mode uses the SaaS departments, not the dealership ones.
  if (document.documentElement.getAttribute('data-dash-mode') === 'marketsync') { __activeDept = null; return hide(); }
  // A registered engine already owns the department title and primary tabs. Rendering the
  // registry's legacy page tabs above it creates two competing headers (and, once Work opens,
  // a third row of subviews). Settings likewise owns one structured landing page; Automation
  // and API remain contextual destinations inside it rather than a second primary tab bar.
  if ((typeof ENGINES !== 'undefined' && ENGINES[pageId]) || ['config', 'automation-builder', 'api-keys'].includes(pageId)) return hide();
  // Sticky: keep the current department if it owns this page, else find the owner.
  let deptId = (__activeDept && DEPARTMENTS[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
             : Object.keys(DEPARTMENTS).find(d => DEPARTMENTS[d].pages.some(p => p.page === pageId));
  if (!deptId) { __activeDept = null; return hide(); }
  __activeDept = deptId;
  const dept = DEPARTMENTS[deptId];
  const pages = dept.pages.filter(deptPageAllowed);
  if (pages.length <= 1) return hide();   // nothing to move between → no tab-bar
  const A = ENGINE_ACCENTS[dept.accent] || ENGINE_ACCENTS.indigo;
  const tabs = pages.map(p => {
    const on = p.page === pageId && (!p.invmode || p.invmode === __inventoryMode) && (!p.tab || (p.page === 'ai-home' ? (p.tab === (window.__aiHomeTab || 'conversations')) : true));
    return `<button onclick="deptGo('${p.page}'${p.invmode ? `,'${p.invmode}'` : (p.tab ? `,'','${p.tab}'` : '')})" class="px-3.5 py-2 -mb-px border-b-2 text-[13px] font-bold whitespace-nowrap transition ${on ? A.text + ' border-current' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}">${esc(p.label)}</button>`;
  }).join('');
  bar.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="w-7 h-7 rounded-lg ${A.bg} ${A.text} flex items-center justify-center flex-shrink-0">${svgIcon(dept.icon || 'dot', 'w-4 h-4')}</span>
      <span class="text-sm font-black text-slate-900 dark:text-white">${esc(dept.label)}</span>
    </div>
    <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">${tabs}</div>`;
  bar.classList.remove('hidden');
}
// Navigate to a department page (handles the inventory view-mode tabs).
function deptGo(page, invmode, tab) {
  if (invmode) __inventoryMode = invmode;
  if (page === 'website' && tab === 'builder') {
    if (typeof openWebsiteBuilder === 'function') {
      openWebsiteBuilder();
      return;
    }
  }
  // A plain "Website" nav click (no explicit tab) must always land on Setup —
  // otherwise a stale __wsTab left over from a previous openWebsiteBuilder() call
  // silently reopens the Builder instead.
  if (page === 'website') __wsTab = tab || 'setup';
  if (tab && page === 'automation-builder') {
    __autoTab = tab;
    if (typeof loadAutoBuilderPage === 'function') loadAutoBuilderPage();
  }
  if (tab && page === 'ai-home') {
    window.__aiHomeTab = tab;
    if (typeof loadAiHome === 'function') loadAiHome(tab);
  }
  if (page === 'social-scheduler' && tab) {
    window.__socialTab = tab;
    if (typeof loadSocialSchedulerPage === 'function') loadSocialSchedulerPage(tab);
  }
  if (page === 'seo' && tab) {
    if (typeof setSeoMainTab === 'function') setSeoMainTab(tab);
  }
  if (page === 'marketing-overview' && tab) {
    if (typeof ENGINE_STATE !== 'undefined') ENGINE_STATE['marketing-overview'] = tab;
  }
  switchPage(page);
  if (page === 'marketing-overview' && tab) {
    if (typeof engineTab === 'function') {
      engineTab('marketing-overview', tab);
    }
  }
  // 'email-sms'/'email-marketing' are legacy page ids switchPage's remap block
  // folds into automation-builder, defaulting the tab to 'overview' for deep links
  // that carry no tab info of their own (notifications, old bookmarks). A live nav
  // item like Email & SMS (tab: 'campaigns') does carry one — re-apply it after that
  // remap runs so it isn't silently stomped back to the launchpad overview tab.
  if (tab && (page === 'email-sms' || page === 'email-marketing')) {
    __autoTab = tab;
    if (typeof loadAutoBuilderPage === 'function') loadAutoBuilderPage();
  }
}
window.deptGo = deptGo;

// ── Flat department LEFT nav ─────────────────────────────────────────────────
// The legacy left nav is a deep, mode-aware tree. For the full DealerOS
// manager/admin experience we replace it with a flat department list (the
// legacy tree is hidden, not removed, so all its gating still drives which
// departments/pages are reachable). Reps, product tiers, Facebook-only and
// MarketSync owner mode keep the legacy nav untouched — zero regression.
// The MarketSync owner's SaaS back office is its own flat department list —
// the company operating system, not a dealership.
const SAAS_DEPARTMENTS = {
  pulse:          { label: 'Pulse',          icon: 'chart',    accent: 'indigo', always: true, pages: [{ page: 'saas-command', label: 'Company Pulse' }] },
  accounts:       { label: 'Accounts',       icon: 'building', accent: 'indigo', always: true, pages: [{ page: 'saas-customers', label: 'Customer Accounts' }] },
  leads:          { label: 'Leads',          icon: 'funnel',   accent: 'indigo', always: true, pages: [{ page: 'saas-funnel', label: 'Sales Leads' }] },
  work:           { label: 'Work',           icon: 'check',    accent: 'indigo', always: true, pages: [{ page: 'saas-followups', label: 'Follow-ups' }] },
  people:         { label: 'People',         icon: 'users',    accent: 'indigo', always: true, pages: [{ page: 'saas-employees', label: 'People Directory' }] },
  communications: { label: 'Communications', icon: 'chat',     accent: 'indigo', always: true, pages: [{ page: 'saas-automation', label: 'Email, SMS & Automations' }] },
  money:          { label: 'Money',          icon: 'currency', accent: 'emerald', always: true, pages: [{ page: 'saas-accounting', label: 'Company Money' }] },
};
let __deptNavBuilt = false;
let __deptRegistry = DEPARTMENTS;   // which department set the flat nav is showing
function marketsyncOwnerMode() {
  return document.documentElement.getAttribute('data-dash-owner') === '1'
    && document.documentElement.getAttribute('data-dash-mode') === 'marketsync';
}
function resolveWorkspaceContext(userObj, accessObj, currentRouteStr) {
  let activeProd = null;
  const dProd = window.__demoActiveProduct || window.__demoActivePackage;
  if (dProd) {
    if (dProd === 'dealer_os' || dProd === 'dealer-os') {
      return { type: 'dealer_os', product: 'dealer_os' };
    }
    if (dProd === 'dealer-website' || dProd === 'website') {
      return { type: 'website', product: 'website' };
    }
    if (dProd === 'sales-marketing-suite' || dProd === 'sales_marketing_suite' || dProd === 'sales') {
      return { type: 'marketing_suite', suite: 'sales', packageId: 'sales-marketing-suite' };
    }
    if (dProd === 'service-marketing-suite' || dProd === 'service_marketing_suite' || dProd === 'service') {
      return { type: 'marketing_suite', suite: 'service', packageId: 'service-marketing-suite' };
    }
    if (dProd === 'complete-marketing-suite' || dProd === 'complete_marketing_suite' || dProd === 'complete') {
      return { type: 'marketing_suite', suite: 'complete', packageId: 'complete-marketing-suite' };
    }
    if (dProd === 'marketsync-digital' || dProd === 'marketsync_digital' || dProd === 'digital') {
      return { type: 'marketing_suite', suite: 'digital', packageId: 'marketsync-digital' };
    }
    activeProd = dProd;
  } else {
    const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
    let products = '';
    if (access && Array.isArray(access.products)) {
      products = access.products.join(' ');
    } else {
      products = (document.documentElement.getAttribute('data-product') || '').trim();
    }

    if (typeof getActiveMarketingSuite === 'function') {
      const suite = getActiveMarketingSuite();
      if (suite) {
        return { type: 'marketing_suite', suite, packageId: `${suite}-marketing-suite` };
      }
    } else if (typeof isMarketingSuite === 'function' && isMarketingSuite()) {
      const activePackage = (typeof profileContext !== 'undefined' && profileContext?.package_id) || '';
      const suiteKey = activePackage.includes('sales') ? 'sales' : (activePackage.includes('service') ? 'service' : (activePackage.includes('digital') ? 'digital' : 'complete'));
      return { type: 'marketing_suite', suite: suiteKey, packageId: activePackage || 'complete-marketing-suite' };
    }

    if (!products || /(?:^|\s)dealer_os(?:\s|$)/.test(products)) {
      return { type: 'dealer_os', product: 'dealer_os' };
    }
    
    if (typeof PRODUCT_PAGES !== 'undefined') {
      const list = products.split(/\s+/).filter(p => PRODUCT_PAGES.hasOwnProperty(p));
      if (list.length > 0) activeProd = list[0];
    } else {
      activeProd = products.split(/\s+/)[0];
    }
  }

  if (!activeProd) return { type: 'dealer_os', product: 'dealer_os' };

  if (activeProd.includes('website')) return { type: 'website', product: 'website' };
  
  let mappedProd = activeProd;
  if (activeProd.includes('facebook')) mappedProd = 'facebook';
  else if (activeProd.includes('video')) mappedProd = 'video';
  else if (activeProd.includes('social') || activeProd.includes('scheduler')) mappedProd = 'social-scheduler';
  else if (activeProd.includes('campaign') || activeProd.includes('email')) mappedProd = 'campaigns';
  else if (activeProd === 'design-studio' || activeProd === 'design_studio') mappedProd = 'design_studio';
  else if (activeProd === 'ai_chatbot' || activeProd === 'ai-chatbot') mappedProd = 'ai_chatbot';

  return { type: 'standalone', product: mappedProd };
}
window.resolveWorkspaceContext = resolveWorkspaceContext;

function deptNavEligible(role) {
  const ctx = typeof resolveWorkspaceContext === 'function' ? resolveWorkspaceContext() : { type: 'dealer_os', product: 'dealer_os' };
  if (ctx.type === 'website' || ctx.type === 'marketing_suite') {
    return false;
  }
  // The department (DealerOS) nav is the ONE nav for every dealership user — reps
  // included. Each department/page is filtered to what that user can actually see
  // (deptVisible / deptPageVisible respect role + solo + feature-flag gating), so a
  // rep simply gets fewer departments. Excluded only for the tiers that run their
  // own nav: specialized staff workspaces, Facebook-only, restricted products, and
  // the MarketSync back office.
  return !!role
    && !__fbOnly
    && !__staffAllowedPages
    && document.documentElement.getAttribute('data-dash-mode') !== 'marketsync'
    && __productAllowedPages == null;
}
// A page the current user may actually open: role-allowed AND not entitlement/flag hidden.
function deptPageAllowed(p) { return !p.legacy && deptRoleOk(p) && deptPageVisible(p.page, p.invmode); }
function deptHomePage(dept) { return dept.pages.find(deptPageAllowed) || dept.pages.find(deptRoleOk) || dept.pages[0]; }
// A department is present when it has one page the user's role and plan both permit.
// Do not inspect the old nested sidebar here: it is merely a legacy presentation tree
// and its hidden/collapsed classes are not an entitlement signal.
function deptHasRealPage(dept) {
  return dept.pages.some(deptPageAllowed);
}
function deptVisible(dept) {
  if (!deptRoleOk(dept)) return false;   // role gate first (managers-only departments)
  if (dept.always) return true;
  // Plan-tier gate: Core / Pro must not show Marketing, HR/Team, or other paid
  // workspaces that only Complete (or an add-on) includes. A department is visible
  // only when at least one of its non-legacy pages is entitled for this account.
  const entitledPages = (dept.pages || []).filter(p => p && !p.legacy);
  if (entitledPages.length && typeof pageFeatureOk === 'function'
      && !entitledPages.some(p => pageFeatureOk(p.page, p.invmode || null))) {
    return false;
  }
  if (deptHasRealPage(dept)) return true;
  if (dept.probe) { const el = document.querySelector(dept.probe); if (el && !el.classList.contains('hidden')) return true; }
  return false;
}

function renderMarketingSuiteNav(suiteKey, host, navRoot) {
  const cfg = (typeof getMarketingSuiteConfig === 'function') ? getMarketingSuiteConfig(suiteKey) : null;
  if (!cfg || !Array.isArray(cfg.areas)) return;

  __deptRegistry = null;
  document.documentElement.setAttribute('data-ms-suite', suiteKey);

  let html = `<div class="ms-suite-nav-header px-3 pt-2 pb-3 mb-2">
    <div class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">${esc(cfg.badge)}</div>
    <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${esc(cfg.title || 'MarketSync')}</div>
  </div>`;
  // Keep area labels for hierarchy, but expose every actual destination. The
  // previous area-only rail made the suite look like it was missing Builder,
  // AI, Design Studio, Social Scheduler, Automations and campaigns.
  if (Array.isArray(cfg.navItems)) {
    const dealer = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'DEALER_GROUP'].includes(String(profileContext?.role || ''));
    html += cfg.navItems.filter(item => !item.dealerOnly || dealer).map(item => {
      const call = item.studioLaunch
        ? 'window.openMarketSyncStudio()'
        : `deptGo('${esc(item.page)}'${item.invmode ? `,'${esc(item.invmode)}'` : `,''`}${item.tab ? `,'${esc(item.tab)}'` : ''})`;
      return `<button type="button" data-page="${esc(item.page)}"${item.tab ? ` data-tab="${esc(item.tab)}"` : ''} title="${esc(item.label)}" onclick="${call}" class="ms-suite-nav-item dept-nav-item w-full flex items-center gap-2.5 px-3 py-1.5 rounded font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[13px]"><span class="text-indigo-500 flex-shrink-0">${svgIcon(item.icon || 'dot', 'w-4 h-4')}</span><span class="truncate">${esc(item.label)}</span></button>`;
    }).join('');
  } else html += cfg.areas.map(area => {
    const heading = `<div class="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">${esc(area.label)}</div>`;
    const items = (area.items || []).map(item => {
      const call = item.studioLaunch
        ? 'window.openMarketSyncStudio()'
        : `deptGo('${esc(item.page)}'${item.invmode ? `,'${esc(item.invmode)}'` : `,''`}${item.tab ? `,'${esc(item.tab)}'` : ''})`;
      return `<button type="button" data-page="${esc(item.page)}"${item.tab ? ` data-tab="${esc(item.tab)}"` : ''} title="${esc(item.label)}" onclick="${call}" class="ms-suite-nav-item dept-nav-item w-full flex items-center gap-2.5 px-3 py-1.5 rounded font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-[13px]"><span class="text-indigo-500 flex-shrink-0">${svgIcon(item.icon || area.icon || 'dot', 'w-4 h-4')}</span><span class="truncate">${esc(item.label)}</span></button>`;
    }).join('');
    return heading + items;
  }).join('');

  host.innerHTML = html;
  navRoot.classList.add('dept-mode');
  __deptNavBuilt = true;
  if (__currentPage) highlightDeptNav(__currentPage);
  applyMobileQuickRow();
}
window.renderMarketingSuiteNav = renderMarketingSuiteNav;

function suiteAreaOpen(areaId) {
  const suite = typeof getActiveMarketingSuite === 'function' ? getActiveMarketingSuite() : null;
  const cfg = suite && typeof getMarketingSuiteConfig === 'function' ? getMarketingSuiteConfig(suite) : null;
  const area = cfg?.areas?.find(candidate => candidate.id === areaId);
  // Content keeps Design Studio first in its header, but opens the Scheduler as
  // its practical landing workspace instead of launching a full-screen tool.
  const home = area?.items?.find(item => item.page === area.defaultPage) || area?.items?.[0];
  if (!home) return;
  if (home.studioLaunch) return window.openMarketSyncStudio?.();
  deptGo(home.page, home.invmode || '', home.tab || '');
}
window.suiteAreaOpen = suiteAreaOpen;

function renderDeptNav(role) {
  const navRoot = document.getElementById('nav-desktop');
  if (!navRoot) return;
  const ctx = typeof resolveWorkspaceContext === 'function' ? resolveWorkspaceContext() : { type: 'dealer_os', product: 'dealer_os' };
  
  // Reveal sidebar
  navRoot.classList.remove('nav-init');

  if (ctx.type === 'marketing_suite') {
    let host = document.getElementById('dept-nav');
    if (!host) {
      host = document.createElement('div'); host.id = 'dept-nav'; host.className = 'space-y-0.5 mb-1';
      const anchor = document.getElementById('setup-bar-host');
      if (anchor && anchor.parentElement === navRoot) navRoot.insertBefore(host, anchor.nextSibling);
      else navRoot.insertBefore(host, navRoot.firstChild);
    }
    renderMarketingSuiteNav(ctx.suite, host, navRoot);
    return;
  }
  document.documentElement.removeAttribute('data-ms-suite');

  const registry = marketsyncOwnerMode() ? SAAS_DEPARTMENTS : (deptNavEligible(role) ? DEPARTMENTS : null);
  if (!registry) {
    // Restricted product / Facebook tiers: render their nav from the same registry
    // the mobile menu uses (restrictedNavPages) — a flat page list — so desktop and
    // mobile are one source of truth and there's no hardcoded sidebar.
    const rp = restrictedNavPages();
    if (rp && rp.length) {
      __deptRegistry = null;   // flat page list, not a department registry
      let host = document.getElementById('dept-nav');
      if (!host) {
        host = document.createElement('div'); host.id = 'dept-nav'; host.className = 'space-y-0.5 mb-1';
        const anchor = document.getElementById('setup-bar-host');
        if (anchor && anchor.parentElement === navRoot) navRoot.insertBefore(host, anchor.nextSibling);
        else navRoot.insertBefore(host, navRoot.firstChild);
      }
      host.innerHTML = rp.map(p => {
        const call = p.studioSchedulerLaunch
          ? 'window.openStudioSchedulerWithEntitlementCheck()'
          : p.studioLaunch
          ? 'window.openMarketSyncStudio()'
          : `deptGo('${esc(p.page)}'${p.tab ? `,'${esc(p.invmode || '')}','${esc(p.tab)}'` : (p.invmode ? `,'${esc(p.invmode)}'` : '')})`;
        return `<button type="button" data-page="${esc(p.page)}"${p.tab ? ` data-tab="${esc(p.tab)}"` : ''} onclick="${call}" title="${esc(p.label)}" class="ms-product-nav-item dept-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-indigo-500 flex-shrink-0">${svgIcon(p.icon || 'dot', 'w-4 h-4')}</span><span>${esc(p.label)}</span></button>`;
      }).join('');
      navRoot.classList.add('dept-mode');
      __deptNavBuilt = true;
      if (__currentPage) highlightDeptNav(__currentPage);
      applyMobileQuickRow();   // keep the bottom quick-row in sync with this registry
      return;
    }
    navRoot.classList.remove('dept-mode'); document.getElementById('dept-nav')?.remove(); __deptNavBuilt = false; return;
  }
  __deptRegistry = registry;
  let host = document.getElementById('dept-nav');
  if (!host) {
    host = document.createElement('div'); host.id = 'dept-nav'; host.className = 'space-y-0.5 mb-1';
    const anchor = document.getElementById('setup-bar-host');   // sit below the setup bar if present
    if (anchor && anchor.parentElement === navRoot) navRoot.insertBefore(host, anchor.nextSibling);
    else navRoot.insertBefore(host, navRoot.firstChild);
  }
  // Departments render in workflow order; `system: true` workspaces (Settings and
  // anything else that is not a dealership department) drop to a separate rail at
  // the bottom, under a divider — an employee scans DEPARTMENTS first.
  const navBtn = ([id, d]) => {
    const A = ENGINE_ACCENTS[d.accent] || ENGINE_ACCENTS.indigo;
    return `<button type="button" data-dept="${id}" onclick="deptOpen('${id}')" title="${esc(d.label)}" class="dept-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="${A.text} flex-shrink-0">${svgIcon(d.icon || 'dot', 'w-4 h-4')}</span><span>${esc(d.label)}</span></button>`;
  };
  const visible = Object.entries(registry).filter(([, d]) => deptVisible(d) && !d.hideFromSidebar);
  const departments = visible.filter(([, d]) => !d.system);
  const system = visible.filter(([, d]) => d.system);
  host.innerHTML = departments.map(navBtn).join('')
    + (system.length ? `<div class="my-1.5 border-t border-slate-200 dark:border-slate-800"></div>${system.map(navBtn).join('')}` : '');
  navRoot.classList.add('dept-mode');
  __deptNavBuilt = true;
  if (__currentPage) highlightDeptNav(__currentPage);
  applyMobileQuickRow();   // bottom quick-row mirrors the DEPARTMENTS registry too
  // Entitlements can land after the first paint; retry any pending deep link now
  // that this rebuild reflects the newest access context.
  if (typeof msBootRoute === 'function') msBootRoute();
}
window.renderDeptNav = renderDeptNav;
function deptOpen(id) {
  const d = __deptRegistry[id]; if (!d) return;
  __activeDept = id;
  const home = deptHomePage(d);
  if (home.invmode) __inventoryMode = home.invmode;
  switchPage(home.page);
}
window.deptOpen = deptOpen;
function highlightDeptNav(pageId) {
  if (!__deptNavBuilt) return;
  const reg = __deptRegistry;
  // Helper to resolve the currently active tab for tab-aware single-product pages
  const getPageActiveTab = (pg) => {
    if (pg === 'website') return window.__wsTab || 'setup';
    if (pg === 'automation-builder') return window.__autoTab || 'overview';
    if (pg === 'ai-home') return window.__aiHomeTab || 'conversations';
    if (pg === 'social-scheduler') return window.__socialTab || window.__studioSchedulerTab || 'overview';
    if (pg === 'marketing-overview') {
      const st = (typeof ENGINE_STATE !== 'undefined' ? ENGINE_STATE['marketing-overview'] : (typeof window !== 'undefined' ? window.ENGINE_STATE?.['marketing-overview'] : null));
      return st || 'overview';
    }
    return null;
  };

  // Restricted tiers render a FLAT page list (no dept registry): highlight by data-page + data-tab.
  if (!reg) {
    const suite = (typeof getActiveMarketingSuite === 'function') ? getActiveMarketingSuite() : null;
    const cfg = suite && typeof getMarketingSuiteConfig === 'function' ? getMarketingSuiteConfig(suite) : null;
    const activeTab = pageId === 'marketing-overview'
      ? ((typeof ENGINE_STATE !== 'undefined' && ENGINE_STATE['marketing-overview']) || 'overview')
      : pageId === 'automation-builder' ? (__autoTab || 'overview')
      : pageId === 'ai-home' ? (window.__aiHomeTab || 'conversations')
      : pageId === 'website' ? (window.__wsTab || 'setup')
      : pageId === 'social-scheduler' ? (window.__socialTab || window.__studioSchedulerTab || 'overview')
      : null;
    const activeArea = cfg && typeof marketingSuiteAreaForPage === 'function'
      ? marketingSuiteAreaForPage(cfg, pageId, activeTab)?.id : null;
    document.querySelectorAll('#dept-nav .dept-nav-item, #mobile-quickrow-dyn .nav-item').forEach(b => {
      let on = b.dataset.suiteArea ? b.dataset.suiteArea === activeArea : b.dataset.page === pageId;
      if (on && b.dataset.tab) {
        const activeTab = getPageActiveTab(pageId);
        if (activeTab) {
          on = (b.dataset.tab === activeTab);
        }
      }
      b.classList.toggle('bg-indigo-100', on); b.classList.toggle('dark:bg-indigo-950/50', on);
      b.classList.toggle('text-indigo-700', on); b.classList.toggle('dark:text-indigo-300', on);
      b.classList.toggle('text-slate-700', !on); b.classList.toggle('dark:text-slate-300', !on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    return;
  }
  const deptId = (__activeDept && reg[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
               : Object.keys(reg).find(d => reg[d].pages.some(p => p.page === pageId));
  document.querySelectorAll('#dept-nav .dept-nav-item').forEach(b => {
    const on = b.dataset.dept === deptId;
    b.classList.toggle('bg-indigo-100', on); b.classList.toggle('dark:bg-indigo-950/50', on);
    b.classList.toggle('text-indigo-700', on); b.classList.toggle('dark:text-indigo-300', on);
    b.classList.toggle('text-slate-700', !on); b.classList.toggle('dark:text-slate-300', !on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

const MS_LEGACY_PAGE_REDIRECTS = Object.freeze({
  'ai-boost': 'inventory-overview', 'ai-insights': 'command', insights: 'command',
  inventory: 'inventory-overview', fni: 'fni-overview', service: 'service-overview',
  'service-ros': 'service-overview', 'service-appointments': 'service-overview',
  parts: 'parts-overview', accounting: 'accounting-overview', marketing: 'marketing-overview',
  people: 'people-overview', hr: 'people-overview', crm: 'sales', leads: 'sales',
  appointments: 'sales', reports: 'command',
  operations: 'command', taskboard: 'command', settings: 'profile',
});
function canonicalDashboardPage(pageId) {
  const key = String(pageId || '').trim();
  // Facebook Poster is a mode of the legacy Inventory surface. Preserve that
  // mode instead of rewriting the link to the general Inventory Pulse engine.
  if (key === 'inventory' && typeof __inventoryMode !== 'undefined' && __inventoryMode === 'facebook') return key;
  return MS_LEGACY_PAGE_REDIRECTS[key] || key;
}
window.canonicalDashboardPage = canonicalDashboardPage;

function switchPage(pageId) {
  ensurePanelsInOriginalLocations();
  pageId = canonicalDashboardPage(pageId);

  if (pageId === 'inv-intel' && typeof window.openInventoryIntelligence === 'function') {
    window.openInventoryIntelligence();
    return;
  }

  // The old global Insights page was an app-wide pseudo-Pulse. It is retired:
  // each workspace owns its own Pulse now. Preserve old bookmarks by resolving
  // them to the caller's current workspace rather than rendering legacy markup.
  if (pageId === 'insights') {
    pageId = __fbOnly ? 'leaderboard'
      : (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) ? 'saas-command'
      : dealerRoleLanding(profileContext?.role);
  }

  const inMktSuite = typeof isMarketingSuite === 'function' && isMarketingSuite();

  // Map legacy department page IDs directly to the single-source-of-truth workspace engines
  if (pageId === 'crm' || pageId === 'pipeline' || pageId === 'leads' || pageId === 'appointments') {
    const identityOnly = typeof isIdentityVerifyWorkspace === 'function' && isIdentityVerifyWorkspace();
    if (!inMktSuite && !identityOnly) pageId = 'sales';
  }
  // Facebook Poster is a mode of the Inventory surface. Keep that route intact
  // after the legacy redirect pass so restricted Inventory links do not fall
  // through to the settings/default landing page.
  if (pageId === 'inventory' && __inventoryMode !== 'facebook') pageId = 'inventory-overview';
  if (pageId === 'fni') pageId = 'fni-overview';
  if (pageId === 'service' || pageId === 'service-ros' || pageId === 'service-appointments') pageId = 'service-overview';
  if (pageId === 'parts') pageId = 'parts-overview';
  if (pageId === 'accounting') pageId = 'accounting-overview';
  if (pageId === 'marketing') pageId = 'marketing-overview';
  if (pageId === 'people' || pageId === 'hr') pageId = 'people-overview';
  // The three automation follow-up pages are now tabs inside one Builder page —
  // keep old deep links (notifications, mobile nav) working by mapping to the tab.
  if (pageId === 'email-marketing' || pageId === 'email-sms' || pageId === 'automations' || pageId === 'auto-holidays' || pageId === 'auto-leads' || pageId === 'auto-delivery' || pageId === 'sales-campaigns' || pageId === 'service-campaigns' || pageId === 'sales-automations' || pageId === 'service-automations' || pageId === 'marketing-analytics') {
    if (pageId === 'auto-holidays') __autoTab = 'lifecycle';
    else if (pageId === 'auto-delivery') __autoTab = 'sales';
    else if (pageId === 'auto-leads') __autoTab = 'leads';
    else if (pageId === 'sales-campaigns' || pageId === 'service-campaigns') {
      __autoTab = 'campaigns';
      if (pageId === 'sales-campaigns') __campaignCategoryFilter = 'sales';
      if (pageId === 'service-campaigns') __campaignCategoryFilter = 'service';
    } else if (pageId === 'sales-automations' || pageId === 'service-automations') {
      __autoTab = 'automations';
      if (pageId === 'sales-automations') __autoCategoryFilter = 'sales';
      if (pageId === 'service-automations') __autoCategoryFilter = 'service';
    } else if (pageId === 'marketing-analytics') {
      __autoTab = 'performance';
    } else if (pageId === 'email-marketing' || pageId === 'email-sms' || pageId === 'automations') {
      __autoTab = 'overview';
    }
    pageId = 'automation-builder';
  }

  // Handle SEO direct/deep routes: seo, seo/easy, seo/advanced, website/seo, website/seo/easy, website/seo/advanced
  if (typeof pageId === 'string' && (pageId === 'seo' || pageId.startsWith('seo/') || pageId === 'website/seo' || pageId.startsWith('website/seo/'))) {
    if (pageId.endsWith('/easy')) {
      __seoMode = 'easy';
      if (typeof localStorage !== 'undefined') localStorage.setItem('marketsync_seo_mode', 'easy');
    } else if (pageId.endsWith('/advanced')) {
      __seoMode = 'advanced';
      if (typeof localStorage !== 'undefined') localStorage.setItem('marketsync_seo_mode', 'advanced');
    } else if (typeof __seoMode === 'undefined' || !__seoMode) {
      if (typeof localStorage !== 'undefined') {
        __seoMode = localStorage.getItem('marketsync_seo_mode') || 'easy';
      } else {
        __seoMode = 'easy';
      }
    }
    pageId = 'seo';
  }

  if (typeof pageId === 'string' && pageId.startsWith('ai-home/')) {
    const sub = pageId.split('/')[1];
    window.__aiHomeTab = sub || 'conversations';
    pageId = 'ai-home';
  }
  // Website canonical default route: website -> setup first; support deep links: website/builder, website/blog, website/seo, website/setup
  if (typeof pageId === 'string' && pageId.startsWith('website/')) {
    const sub = pageId.split('/')[1];
    if (sub === 'builder') __wsTab = 'builder';
    else if (sub === 'blog') { pageId = 'blog'; }
    else if (sub === 'seo') { pageId = 'seo'; }
    else { __wsTab = 'setup'; pageId = 'website'; }
    if (pageId.startsWith('website/')) pageId = 'website';
  } else if (pageId === 'website') {
    if (!__wsTab || __wsTab === 'settings') __wsTab = 'setup';
  }
  // Facebook-only tier: only the Facebook hub, leaderboard and settings are reachable.
  if (__fbOnly && !FB_ONLY_PAGES.has(pageId)) { __inventoryMode = 'facebook'; pageId = 'inventory'; }
  // Product-restricted tiers (Facebook Solo/Dealer, AI Chatbot): keep them inside
  // their page set so a stale link or hardcoded mobile button can't reach full-OS
  // pages. 'profile' (header gear) is always allowed.
  if (__productAllowedPages && pageId !== 'profile' && !__productAllowedPages.has(pageId)) {
    pageId = __productHome || 'profile';
    if (pageId === 'inventory') __inventoryMode = 'facebook';
  }

  // Old DealerOS bookmarks used the MarketSync-only owner-users route. Keep those
  // bookmarks useful without ever sending a dealership admin to the platform-wide
  // account API. MarketSync HQ continues to use owner-users unchanged.
  if (pageId === 'owner-users' && !marketsyncOwnerMode()) pageId = 'sales-team';

  // Specialized staff role (F&I, Service, Accounting, Cleanup): anything outside
  // their workspace bounces to their home page. Guards deep links & stale nav too.
  if (__staffAllowedPages && !__staffAllowedPages.has(pageId)) { pageId = __staffHome; }

  if (pageId === 'profile') {
    const ctx = typeof resolveWorkspaceContext === 'function' ? resolveWorkspaceContext() : { type: 'dealer_os', product: 'dealer_os' };
    const isStandalone = (typeof isSingleProductWorkspace === 'function' && isSingleProductWorkspace())
      || (typeof isStandaloneWebsiteWorkspace === 'function' && isStandaloneWebsiteWorkspace())
      || ctx.type === 'website' || ctx.type === 'standalone';
    if (isStandalone) {
      document.querySelectorAll('#settings-tabs [data-admin-only]').forEach(el => el.classList.add('hidden'));
      if (typeof SETTINGS_TAB_SECTIONS !== 'undefined' && Array.isArray(SETTINGS_TAB_SECTIONS?.account) && !SETTINGS_TAB_SECTIONS.account.includes('billing-section')) {
        SETTINGS_TAB_SECTIONS.account.push('billing-section');
      }
      if (typeof settingsTab === 'function') settingsTab('account');
      document.getElementById('settings-my-record')?.classList.add('stab-hide');
      if (typeof SETTINGS_TAB_SECTIONS !== 'undefined' && Array.isArray(SETTINGS_TAB_SECTIONS?.account)) {
        SETTINGS_TAB_SECTIONS.account = SETTINGS_TAB_SECTIONS.account.filter(id => id !== 'settings-my-record');
      }
    }
  }

  // Plan-tier gate: a page whose feature the current plan doesn't include bounces to a
  // safe home. The API + RLS already deny the data; this keeps the UI from opening an
  // empty/403 page from a stale link. profile (settings) is always reachable.
  if (pageId !== 'profile' && !pageFeatureOk(pageId)) {
    pageId = (typeof deptNavEligible === 'function' && deptNavEligible(profileContext?.role)) ? 'command' : dealerRoleLanding(profileContext?.role);
  }

  // Accounting has one container but each nav leaf (acct-insights, acct-tax, …) is
  // its own "page" — map those to the shared accounting container.
  const contentKey = (typeof pageId === 'string' && pageId.startsWith('acct-')) ? 'accounting' : pageId;
  if (contentKey !== 'website') {
    window.__lastNonWebsitePage = contentKey;
  }
  const isWsWorkspace = (contentKey === 'website' && (typeof __wsTab === 'undefined' || __wsTab === 'builder'));
  document.documentElement.classList.toggle('website-workspace-mode', isWsWorkspace);
  document.body.classList.toggle('website-workspace-mode', isWsWorkspace);
  if (isWsWorkspace && typeof applyBuilderTheme === 'function') {
    applyBuilderTheme();
  }
  document.querySelectorAll('[data-page-content]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.pageContent !== contentKey);
  });
  document.querySelectorAll('#dashboard-nav .nav-item, #nav-vin-sticker, #nav-inv-intel, #nav-ai-vision').forEach(btn => {
    let active = btn.id === 'nav-inv-intel' ? pageId === 'inv-intel'
                 : btn.id === 'nav-vin-sticker'? pageId === 'vin-sticker'
                 : btn.id === 'nav-ai-vision' ? pageId === 'ai-vision'
                 // Marketplace (facebook) and Inventory List (manual) share data-page
                 // "inventory" — disambiguate by mode so only the active one highlights.
                 : btn.dataset.page === pageId
                   && (pageId !== 'inventory' || !btn.dataset.invmode || btn.dataset.invmode === __inventoryMode);
    // The Customers page has three nav leaves that all share data-page="crm"
    // (Add Customer, Search Customers, My Customer Database). Only the one matching
    // the current view should light up — otherwise they all highlight together.
    if (active && pageId === 'crm') {
      if (btn.dataset.crmAction === 'add') active = false;                       // Add is an action, not a view
      else if (btn.dataset.crmView) active = (btn.dataset.crmView === 'all') === !!__crmSearchAll;
    }
    if (active && btn.dataset.tab) {
      const activeTab = (pageId === 'website') ? (window.__wsTab || 'setup')
                      : (pageId === 'automation-builder') ? (window.__autoTab || 'overview')
                      : (pageId === 'ai-home') ? (window.__aiHomeTab || 'conversations')
                      : (pageId === 'marketing-overview') ? ((typeof ENGINE_STATE !== 'undefined' ? ENGINE_STATE['marketing-overview'] : (typeof window !== 'undefined' ? window.ENGINE_STATE?.['marketing-overview'] : null)) || 'overview')
                      : null;
      if (activeTab) {
        active = (btn.dataset.tab === activeTab);
      }
    }
    btn.classList.toggle('bg-indigo-100', active);
    btn.classList.toggle('dark:bg-indigo-950/50', active);
    btn.classList.toggle('text-indigo-700', active);
    btn.classList.toggle('dark:text-indigo-300', active);
    btn.classList.toggle('text-slate-700', !active);
    btn.classList.toggle('dark:text-slate-300', !active);
    // Explicit active flag so the highlight always reflects the current page,
    // even for the specially-handled (non data-page) nav buttons.
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });

  // Groups load collapsed; expand any group that contains the active page so
  // the current item is visible (a page can live in more than one group).
  document.querySelectorAll('#nav-desktop .nav-item[aria-current="page"]').forEach(leaf => {
    // Walk up EVERY enclosing group body (a page can sit inside a nested subgroup,
    // e.g. Automation → Builder → New Lead Follow-ups) so both levels expand.
    let body = leaf.closest('.nav-group-body');
    while (body) {
      if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        document.getElementById('chev-' + body.id.replace('grp-', ''))?.classList.remove('-rotate-90');
      }
      body = body.parentElement?.closest('.nav-group-body');
    }
  });

  // Fire any one-time lazy loaders registered for this page (feeds, catalog,
  // leaderboard, guardrail settings, inventory-intelligence tags).
  runPageInit(pageId);

  if (pageId === 'inventory') applyInventoryMode();
  if (pageId === 'recon') loadReconPage();
  if (pageId === 'vin-sticker') loadVinStickerPage();
  if (pageId === 'profile') { loadProfileBranding(); loadCrmAdfSetting(); settingsTab(__settingsTab); }
  if (pageId === 'inv-intel' && typeof window._invIntelPageHook === 'function') window._invIntelPageHook();
  if (pageId === 'ai-vision') loadAiVisionPage();
  if (pageId === 'reports') loadReports();
  if (pageId === 'commissions') loadCommissionsPage();
  if (contentKey === 'accounting') loadAccountingPage(pageId.startsWith('acct-') ? pageId.slice(5) : undefined);
  if (pageId === 'affiliates-admin') loadAffiliatesAdmin();
  if (pageId === 'desk') loadDeskDeal();
  if (pageId === 'crm') loadCrmPage();
  if (pageId === 'leads') loadLeadsPage();
  if (pageId === 'appointments') loadAppointmentsPage();
  if (pageId === 'service-appointments') loadServiceAppointments();
  if (pageId === 'service-settings') loadServiceSettings();
  if (pageId === 'tasks') crmLoadTasks();
  if (pageId === 'market') loadMarketPage();
  if (pageId === 'website') loadWebsitePage();
  if (pageId === 'website-settings') loadWebsiteSettings();
  // Blog and SEO are normal in-dashboard pages (not the full-screen Builder workspace).
  if (pageId === 'blog' && typeof loadBlogPage === 'function') loadBlogPage();
  if (pageId === 'seo' && typeof loadSeoPage === 'function') loadSeoPage();
  if (pageId === 'automation') loadAutomationPage();
  if (pageId === 'automation-builder') loadAutoBuilderPage();
  if (pageId === 'email-marketing' || pageId === 'email-campaigns') loadDealerEmail();
  if (pageId === 'studio' || pageId === 'design-studio') {
    Promise.resolve(window.msLoadScript ? window.msLoadScript('js/modules/studio/scene-model.js?v=20260814_v12') : null)
      .then(() => window.msLoadScript && window.msLoadScript('js/modules/studio/fabric-adapter.js?v=20260818_fontfamily_v1'))
      .then(() => window.msLoadScript && window.msLoadScript('js/modules/studio/studio-scheduler.js?v=20260826_digital_pages_v3'))
      .then(() => window.msLoadScript && window.msLoadScript('js/modules/studio/studio-shell.js?v=20260826_studio_tp_v1'))
      .then(() => { if (typeof openMarketSyncStudio === 'function') openMarketSyncStudio(); });
  }
  if (pageId === 'social-scheduler') { if (typeof loadSocialSchedulerPage === 'function') loadSocialSchedulerPage(); }
  if (pageId === 'video-studio') {
    Promise.resolve(window.msLoadScript ? window.msLoadScript('js/modules/video-studio.js?v=20260826_studio_tp_v1') : null)
      .then(() => { if (typeof loadVideoStudioPage === 'function') loadVideoStudioPage(); });
  }
  if (pageId === 'academy') {
    Promise.resolve(window.msLoadScript ? window.msLoadScript('js/modules/academy-workspace.js?v=20260826_academy_load_v1') : null)
      .then(() => { if (typeof loadAcademyWorkspace === 'function') loadAcademyWorkspace(); });
  }
  if (pageId === 'launch') loadLaunchHub();
  if (pageId === 'people-overview') loadPeopleWorkspace();
  if (pageId === 'fni') loadFniPage();
  if (pageId === 'equity') loadEquityPage();
  if (pageId === 'appraisal') { initAppraisal(); loadApprList(); apprEnsureBranding(); }
  if (pageId === 'taskboard') loadTaskBoard();
  if (pageId === 'command') loadCommandCenter();
  if (pageId === 'sales') loadSalesWorkspace();
  if (pageId === 'inventory-overview') loadInventoryWorkspace();
  if (pageId === 'fni-overview') loadFniWorkspace();
  if (pageId === 'service-overview') loadServiceWorkspace();
  if (pageId === 'parts-overview') loadPartsWorkspace();
  if (pageId === 'accounting-overview') loadAccountingWorkspace();
  if (pageId === 'marketing-overview') loadMarketingWorkspace();
  if (pageId === 'saas-command') loadSaasCommand();
  if (pageId === 'saas-customers') loadSaasCustomers();
  if (pageId === 'saas-followups') loadSaasFollowups();
  if (pageId === 'saas-funnel') loadSaasFunnel();
  if (pageId === 'saas-email-marketing') loadSaasEmailMarketing();
  if (pageId === 'saas-studio') loadSaasStudio();
  if (pageId === 'saas-website') loadSaasWebsite();
  if (pageId === 'saas-automation') loadSaasAutomation();
  if (pageId === 'saas-employees') loadSaasEmployees();
  if (pageId === 'saas-accounting') loadSaasAccounting();
  if (pageId === 'config') loadConfigHub();
  if (pageId === 'api-keys') loadApiKeys();
  if (pageId === 'delivery') loadDeliveryQueue();
  if (pageId === 'solo-home') loadSoloHome();
  if (pageId === 'ai-home') loadAiHome(window.__aiHomeTab);
  if (pageId === 'sales-team' && typeof loadDealerManagementMatrix === 'function') { try { loadDealerManagementMatrix(); } catch {} }
  if (pageId === 'operations') loadOperationsPage();
  if (pageId === 'service-ros') loadServiceRosPage();
  if (pageId === 'service-parts') loadServicePartsPage();
  if (pageId === 'owner-users') loadOwnerUsersPage();
  if (pageId === 'ai-inbox') {
    if (typeof loadAiInbox === 'function') { try { loadAiInbox(); } catch {} }
    else if (typeof openTeamChatWidget === 'function') { openTeamChatWidget(); }
  }
  if (pageId === 'people-compliance' || pageId === 'hr' || pageId === 'people') loadPeopleCompliance();

  __currentPage = pageId;
  try { localStorage.setItem('ms_last_page', pageId); } catch {}
  renderDeptTabbar(pageId);
  highlightDeptNav(pageId);
  msSyncRoute(pageId);
}

// ── Workspace routing (additive) ─────────────────────────────────────────────
let __msRouting = false;   // suppress the popstate→switchPage→pushState loop

function msHashFor(pageId) {
  const ws = (typeof msWorkspaceOfPage === 'function' && msWorkspaceOfPage(pageId, __deptRegistry)) || null;
  return ws ? `#/w/${ws}/${pageId}` : `#/p/${pageId}`;
}

function msSyncRoute(pageId) {
  if (__msRouting || !pageId) return;
  try {
    const hash = msHashFor(pageId);
    if (window.location.hash === hash) return;
    history.pushState({ msPage: pageId }, '', hash);
  } catch {}
}

function msRouteFromHash() {
  const m = String(window.location.hash || '').match(/^#\/(?:w\/[^/]+\/|p\/)([\w-]+)$/);
  return m ? m[1] : null;
}

function msApplyRoute() {
  const pageId = msRouteFromHash();
  if (!pageId || pageId === __currentPage) return;
  __msRouting = true;
  try { switchPage(pageId); } finally { __msRouting = false; }
}
window.addEventListener('popstate', msApplyRoute);

let __msBootTarget = msRouteFromHash();
let __msBootTries = 0;
function msBootRoute() {
  if (!__msBootTarget || __msBootTries > 6) return;
  if (typeof switchPage !== 'function') return;
  __msBootTries++;
  __msRouting = true;
  try { switchPage(__msBootTarget); } finally { __msRouting = false; }
  if (__currentPage === __msBootTarget) {
    try { history.replaceState({ msPage: __msBootTarget }, '', msHashFor(__msBootTarget)); } catch {}
    __msBootTarget = null;
  }
}
window.msBootRoute = msBootRoute;

if (__msBootTarget) {
  document.addEventListener('DOMContentLoaded', () => setTimeout(msBootRoute, 100));
  setTimeout(msBootRoute, 500);
  setTimeout(msBootRoute, 1500);
}

// ── Trade Appraisal ──────────────────────────────────────────────────────────
let __apprWired = false;
let __apprDefaults = { recon: 1200, gross: 2500 };   // manager-set appraisal defaults
let __apprCanEditDefaults = false;
// Manager-only control to set the store's default recon + target gross (persists to
// the dealership; every new appraisal starts from these).
function renderApprDefaultsControl() {
  const slot = document.getElementById('appr-defaults-slot'); if (!slot) return;
  if (!__apprCanEditDefaults) { slot.innerHTML = ''; return; }
  const iC = 'w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-right tabular-nums';
  slot.innerHTML = `<div class="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
    <span class="font-semibold">Store defaults:</span>
    <span class="inline-flex items-center gap-1">Recon $<input id="appr-def-recon" type="number" min="0" value="${__apprDefaults.recon}" class="${iC}"></span>
    <span class="inline-flex items-center gap-1">Target gross $<input id="appr-def-gross" type="number" min="0" value="${__apprDefaults.gross}" class="${iC}"></span>
    <button onclick="saveApprDefaults()" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Save defaults</button>
    <span class="text-slate-400">— applied to every new appraisal.</span>
  </div>`;
}
async function saveApprDefaults() {
  const recon = Number(document.getElementById('appr-def-recon')?.value);
  const gross = Number(document.getElementById('appr-def-gross')?.value);
  try {
    await apiSendJson('/ai/config', 'PUT', { appraisal_recon_default: recon, appraisal_gross_default: gross });
    __apprDefaults = { recon: Number.isFinite(recon) ? recon : 1200, gross: Number.isFinite(gross) ? gross : 2500 };
    showToast('Appraisal defaults saved', 'success');
  } catch (e) { showToast(e.message || 'Could not save', 'error'); }
}
window.saveApprDefaults = saveApprDefaults;
// ── VIN barcode scanner (camera) ─────────────────────────────────────────────
// Reads the Code 39 / Code 128 / Data-Matrix VIN barcode printed on the driver's
// door jamb or lower windshield using the browser's built-in BarcodeDetector
// (Chromium desktop + Android Chrome). On a match it fills the target input,
// fires an `input` event, and runs the optional afterFill(vin) callback.
function cleanVin(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ''); // VINs exclude I/O/Q
  const m = s.match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : null;
}
// ZXing is our cross-browser fallback decoder — the native BarcodeDetector isn't
// available on iOS (every iPhone browser, incl. "Chrome", is WebKit) or older
// browsers. Loaded lazily from a CDN only the first time a scan is started.
let __zxingPromise = null;
function loadZXing() {
  if (window.ZXing?.BrowserMultiFormatReader) return Promise.resolve(window.ZXing);
  if (__zxingPromise) return __zxingPromise;
  __zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';
    s.onload = () => (window.ZXing?.BrowserMultiFormatReader ? resolve(window.ZXing) : reject(new Error('zxing missing')));
    s.onerror = () => { __zxingPromise = null; reject(new Error('zxing load failed')); };
    document.head.appendChild(s);
  });
  return __zxingPromise;
}
// Lazy-load pdf.js (only when a dealer uploads a PDF knowledge base) to pull text.
let __pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (__pdfjsPromise) return __pdfjsPromise;
  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; resolve(window.pdfjsLib); }
      catch (e) { reject(e); }
    };
    s.onerror = () => { __pdfjsPromise = null; reject(new Error('pdfjs load failed')); };
    document.head.appendChild(s);
  });
  return __pdfjsPromise;
}
async function extractPdfText(file, options = {}) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  const maxPages = Math.min(pdf.numPages, Number(options.maxPages) > 0 ? Number(options.maxPages) : 40);
  const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : 20000;
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map(it => it.str).join(' ') + '\n';
    if (out.length > maxChars) break;
  }
  return out.slice(0, maxChars);
}
