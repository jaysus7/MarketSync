// ── MarketSync Frontend Module: Core Engine Boot, Auth & Navigation ───────────
const API = (location.hostname.includes('staging') ? 'https://marketsync-staging-backend.onrender.com' : 'https://vehicle-marketplace-s0e4.onrender.com');

// Wrap fetch so EVERY call to our API carries the demo-workspace header when the
// owner is in Demo mode — keeps all pages consistently scoped to the demo dealership.
(function () {
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf(API) === 0 &&
          document.documentElement.getAttribute('data-dash-owner') === '1' &&
          document.documentElement.getAttribute('data-dash-mode') === 'demo') {
        init = init || {};
        const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        h.set('X-Act-Demo', '1');
        init = { ...init, headers: h };
      }
    } catch (e) {}
    return _fetch(input, init);
  };
})();

const CARFAX_BASE = 'https://www.carfax.ca/vehicle-history-reports?vin=';

// Global HTML escaper.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
window.esc = esc;

// SVG icons utility
const SVG_ICONS = {
  dot: '<circle cx="12" cy="12" r="3"/>',
  sparkles: '<path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>',
  check: '<path d="M4.5 12.75l6 6 9-13.5"/>',
  play: '<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>',
  close: '<path d="M6 18L18 6M6 6l12 12"/>',
};
function svgIcon(name, cls = 'w-4 h-4') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${SVG_ICONS[name] || SVG_ICONS.dot}</svg>`;
}
window.svgIcon = svgIcon;

// Number input money formatter
function msNum(v) {
  if (v && typeof v === 'object' && 'value' in v) v = v.value;
  const n = Number(String(v == null ? '' : v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}
function msFmtMoney(raw) {
  let s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return s;
  const neg = s[0] === '-';
  s = s.replace(/-/g, '');
  const firstDot = s.indexOf('.');
  let intPart = firstDot >= 0 ? s.slice(0, firstDot) : s;
  const decPart = firstDot >= 0 ? s.slice(firstDot + 1).replace(/\./g, '').slice(0, 2) : null;
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (grouped || (decPart !== null ? '0' : '')) + (decPart !== null ? '.' + decPart : '');
}
window.msNum = msNum;
window.msFmtMoney = msFmtMoney;

// API Json Handlers
function actHeaders() {
  try {
    if (document.documentElement.getAttribute('data-dash-owner') === '1' &&
        document.documentElement.getAttribute('data-dash-mode') === 'demo') return { 'X-Act-Demo': '1' };
  } catch (e) {}
  return {};
}

let token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');

async function apiGetJson(path, { retries = 4, timeoutMs = 15000, onRetry } = {}) {
  let lastErr;
  let triedRefresh = false;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(`${API}${path}`, {
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`, ...actHeaders() },
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (r.status === 401 && !triedRefresh) {
        triedRefresh = true;
        clearTimeout(timer);
        const ok = await refreshSessionSilently();
        if (ok) { attempt--; continue; }
      }
      if (r.ok) return await r.json();
      if ([429, 500, 502, 503, 504].includes(r.status) && attempt < retries) {
        lastErr = new Error(`HTTP ${r.status}`);
      } else {
        let msg = `HTTP ${r.status}`;
        try { const b = await r.json(); if (b?.error) msg = b.error; } catch {}
        throw new Error(msg);
      }
    } catch (e) {
      if (e.name === 'AbortError') lastErr = new Error('Request timed out');
      else lastErr = e;
      if (attempt >= retries) throw lastErr;
    } finally {
      clearTimeout(timer);
    }
    await new Promise(res => setTimeout(res, Math.min(6000, 1000 * (attempt + 1))));
  }
  throw lastErr || new Error('Request failed');
}
window.apiGetJson = apiGetJson;

async function apiSendJson(path, method = 'POST', body = null, { timeoutMs = 20000 } = {}) {
  async function attempt() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${API}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json', ...actHeaders() },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
  }
  let r = await attempt();
  if (r.status === 401) {
    const ok = await refreshSessionSilently();
    if (ok) r = await attempt();
  }
  let data = null; try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data || {};
}
window.apiSendJson = apiSendJson;

function showToast(message, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-indigo-600' };
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl transition-opacity ${colors[type] || colors.info}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, duration);
}
function toast(message, type = 'info', duration = 4000) {
  showToast(message, type, duration);
}
window.showToast = showToast;
window.toast = showToast;

function executeActualSignOut() {
  try { sessionStorage.setItem('ms_logged_out', '1'); } catch {}
  try {
    const tk = localStorage.getItem('token');
    if (tk) fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${tk}` } }).catch(() => {});
  } catch {}
  try { ['token', 'refresh_token', 'user', 'ms_remember_until'].forEach(k => localStorage.removeItem(k)); } catch {}
  window.location.replace('login.html');
}
window.executeActualSignOut = executeActualSignOut;

window.msSignOut = function msSignOut(skipClockCheck = false) {
  if (!skipClockCheck && typeof getTimeClockState === 'function') {
    const clockState = getTimeClockState();
    if (clockState && (clockState.status === 'in' || clockState.status === 'break')) {
      openSignOutClockModal();
      return;
    }
  }
  executeActualSignOut();
};

let __refreshInFlight = null;
async function refreshSessionSilently() {
  if (__refreshInFlight) return __refreshInFlight;
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return false;
  __refreshInFlight = (async () => {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!r.ok) return false;
      const d = await r.json();
      if (d.access_token) { token = d.access_token; localStorage.setItem('token', d.access_token); }
      if (d.refresh_token) localStorage.setItem('refresh_token', d.refresh_token);
      return !!d.access_token;
    } catch { return false; }
    finally { __refreshInFlight = null; }
  })();
  return __refreshInFlight;
}
window.refreshSessionSilently = refreshSessionSilently;
