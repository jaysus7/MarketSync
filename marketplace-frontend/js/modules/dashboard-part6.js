/* dashboard.js split part 6/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// ── Ad-spend auto-import (Meta / Google Ads) panel on the Marketing ROI report ─
async function loadAdSpendPanel() {
  const host = document.getElementById('adspend-panel');
  if (!host) return;
  let data;
  try { data = await apiGetJson('/adspend/status', { retries: 1 }); }
  catch { host.remove(); return; }
  const icon = { meta: 'megaphone', google_ads: 'megaphone' };
  const rows = (data.providers || []).map(p => {
    let right;
    if (!p.configured) right = '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Setup pending</span>';
    else if (p.connected) right = data.can_manage ? `<button onclick="adDisconnect('${p.provider}')" class="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">Disconnect</button>` : '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Connected</span>';
    else right = data.can_manage ? `<button onclick="adConnect('${p.provider}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition">Connect</button>` : '<span class="text-[10px] text-slate-400">Ask an admin</span>';
    const sub = p.connected ? `${esc(p.account || 'Connected')}${p.last_synced_at ? ' · synced ' + new Date(p.last_synced_at).toLocaleDateString('en-US') : ''}${p.last_error ? ' · <span class="text-rose-500">' + esc(p.last_error.slice(0, 50)) + '</span>' : ''}` : (p.configured ? 'Auto-import monthly spend' : 'Server setup pending');
    return `<div class="flex items-center gap-2.5 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">${svgIcon(icon[p.provider] || 'megaphone', 'w-4 h-4')}</div>
      <div class="min-w-0 flex-1"><div class="text-sm font-bold text-slate-900 dark:text-white">${esc(p.label)}</div><div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${sub}</div></div>
      <div class="shrink-0">${right}</div>
    </div>`;
  }).join('');
  const anyConnected = (data.providers || []).some(p => p.connected);
  host.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="flex items-center justify-between mb-1"><div class="text-sm font-bold text-slate-900 dark:text-white">Auto-import spend</div>
      ${anyConnected ? `<button onclick="adSyncNow(this)" class="text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg transition">Sync now</button>` : ''}</div>
    <p class="text-[11px] text-slate-400 mb-2">Connect your ad accounts to pull spend automatically — no monthly typing.</p>
    ${rows}
    ${!data.any_configured ? '<div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">Turns on once the Meta/Google Ads API keys are set on the server.</div>' : ''}
  </div>`;
}
async function adConnect(provider) {
  try { const d = await apiGetJson(`/adspend/connect/${provider}`, { retries: 1 }); if (d.url) window.location.href = d.url; }
  catch (e) { showToast(e.message || 'Could not start the connection', 'error'); }
}
async function adDisconnect(provider) {
  if (!confirm('Disconnect this ad account? Imported spend stays; it just stops updating.')) return;
  try { await apiSendJson(`/adspend/disconnect/${provider}`, 'POST'); showToast('Disconnected', 'success'); loadAdSpendPanel(); }
  catch (e) { showToast(e.message || 'Could not disconnect', 'error'); }
}
async function adSyncNow(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Syncing…';
  try {
    const r = await apiSendJson('/adspend/sync-now', 'POST');
    const months = (r.results || []).reduce((a, x) => a + (x.months || 0), 0);
    showToast(`Imported spend for ${months} month${months === 1 ? '' : 's'}`, 'success');
    loadMarketingRoi();
  } catch (e) { showToast(e.message || 'Sync failed', 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
window.adConnect = adConnect;
window.adDisconnect = adDisconnect;
window.adSyncNow = adSyncNow;
function marketingRoiCsv() {
  const d = __marketingRoiData; if (!d) return;
  const t = d.totals || {};
  const s = [
    { title: `Marketing ROI — last ${d.range_days} days (assumed gross/sale $${d.avg_gross})`, headers: ['Channel', 'Spend', 'Leads', 'Sales', '$/lead', '$/sale', 'Revenue', 'Est gross', 'ROI %'], rows: (d.rows || []).map(r => [r.channel, r.spend, r.leads, r.sales, r.cost_per_lead ?? '', r.cost_per_sale ?? '', r.revenue, r.est_gross, r.roi_pct ?? '']) },
    { title: 'Total', headers: ['Spend', 'Leads', 'Sales', '$/lead', '$/sale', 'Revenue', 'Est gross', 'ROI %'], rows: [[t.spend, t.leads, t.sales, t.cost_per_lead ?? '', t.cost_per_sale ?? '', t.revenue, t.est_gross, t.roi_pct ?? '']] },
  ];
  msDownloadCsv(`marketsync-marketing-roi-${csvDate()}.csv`, csvSections(s));
}
window.marketingRoiCsv = marketingRoiCsv;
function mktRoiRange(v) { __mktRoiRange = v; loadMarketingRoi(); }
function mktSetAvgGross(v) { const n = Number(v); if (Number.isFinite(n) && n >= 0) { __mktAvgGross = n; loadMarketingRoi(); } }
function mktSetSpendPeriod(v) { if (/^\d{4}-\d{2}$/.test(v)) { __mktSpendPeriod = v; loadMarketingRoi(); } }
async function mktSaveSpend(channel, value, el) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) { showToast('Enter a valid amount', 'error'); return; }
  if (el) el.disabled = true;
  try {
    await apiSendJson('/marketing/spend', 'PUT', { channel, period: __mktSpendPeriod, amount });
    if (el) { el.classList.add('ring-2', 'ring-emerald-400'); setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-400'), 900); }
    loadMarketingRoi();
  } catch (e) { showToast(e.message || 'Could not save spend', 'error'); }
  if (el) el.disabled = false;
}
window.mktRoiRange = mktRoiRange;
window.mktSetAvgGross = mktSetAvgGross;
window.mktSetSpendPeriod = mktSetSpendPeriod;
window.mktSaveSpend = mktSaveSpend;

// ── Custom report builder + Sold-per-rep report (managers) ───────────────────
// The 40-column "sold deals" layout, in the exact order requested. `#` (row index)
// is rendered separately; `salesperson` is appended as a trailing convenience column.
const SOLD_DEAL_COLS = [
  { key: 'sold_date', label: 'Sold Date', type: 'date' },
  { key: 'source', label: 'Source' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email' },
  { key: 'street_address', label: 'Street Address' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'postal_code', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
  { key: 'birthday', label: 'Birthday', type: 'date' },
  { key: 'status', label: 'Status' },
  { key: 'delivery_date', label: 'Delivery Date', type: 'date' },
  { key: 'delivery_time', label: 'Delivery Time' },
  { key: 'fni_manager', label: 'FNI Manager' },
  { key: 'deposit_amount', label: 'Deposit Amount' },
  { key: 'type_of_vehicle', label: 'Type Of Vehicle' },
  { key: 'stock_number', label: 'Stock Number' },
  { key: 'vin', label: 'VIN' },
  { key: 'year', label: 'Year' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'trim', label: 'Trim' },
  { key: 'drivetrain', label: 'Drivetrain' },
  { key: 'deal_type', label: 'Deal Type' },
  { key: 'term', label: 'Term' },
  { key: 'plates', label: 'Plates' },
  { key: 'fni_products', label: 'FNI Products' },
  { key: 'trade_type', label: 'Trade Type' },
  { key: 'google_review', label: 'Google Review' },
  { key: 'gm_survey', label: 'GM Survey' },
  { key: 'gm_survey_pct', label: 'GM Survey %' },
  { key: 'fni_gross_1500', label: '$1,500 FNI Gross' },
  { key: 'split_deal', label: 'Split Deal' },
  { key: 'split_with', label: 'Split With' },
  { key: 'vehicle_commission', label: 'Vehicle Commission' },
  { key: 'fni_commission', label: 'FNI Comission' },
  { key: 'unsubscribed', label: 'Unsubscribed' },
  { key: 'no_longer_owns', label: 'No Longer Owns' },
  { key: 'salesperson', label: 'Salesperson' },
];

// Inventory data source — the "what" report. Flat row per vehicle.
const INVENTORY_COLS = [
  { key: 'stock_number', label: 'Stock Number' },
  { key: 'vin', label: 'VIN' },
  { key: 'year', label: 'Year' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'trim', label: 'Trim' },
  { key: 'condition', label: 'Condition' },
  { key: 'body_style', label: 'Body Style' },
  { key: 'exterior_color', label: 'Exterior Color' },
  { key: 'interior_color', label: 'Interior Color' },
  { key: 'mileage', label: 'Mileage' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' },
  { key: 'drivetrain', label: 'Drivetrain' },
  { key: 'fuel_type', label: 'Fuel Type' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'days_on_lot', label: 'Days On Lot' },
  { key: 'lot_date', label: 'Lot Date', type: 'date' },
  { key: 'sold_date', label: 'Sold Date', type: 'date' },
];

// Report source registry — drives dropdown, columns, fetch URL, filenames.
const RB_SOURCES = {
  sold: { label: 'Sold deals (per rep)', noun: 'deal', cols: SOLD_DEAL_COLS, hasRep: true, hasDeal: true,
    url: () => `/reports/sold-deals?range=${encodeURIComponent(__rbRange)}&rep=${encodeURIComponent(__rbRep)}`,
    file: () => `sold-deals-${__rbRep === 'all' ? 'all-reps' : (__rbData?.reps?.find(r => r.id === __rbRep)?.name || 'rep').replace(/\s+/g, '-').toLowerCase()}` },
  inventory: { label: 'Inventory', noun: 'vehicle', cols: INVENTORY_COLS, hasStatus: true,
    url: () => `/reports/inventory?range=${encodeURIComponent(__rbRange)}&status=${encodeURIComponent(__rbStatus)}`,
    file: () => `inventory-${__rbStatus}` },
};

let __rbSource = 'sold';
let __rbRange = '365';
let __rbRep = 'all';
let __rbStatus = 'all';
let __rbData = null;          // last { rows, reps }
let __rbColSel = {};          // per-source Set of selected column keys
let __rbHideBlank = false;    // hide the F&I columns we don't capture yet

function rbFmt(v, type) {
  if (v == null || v === '') return '';
  if (type === 'date') { const d = new Date(v); return isNaN(d) ? String(v) : d.toISOString().slice(0, 10); }
  return String(v);
}
function rbCols() { return RB_SOURCES[__rbSource].cols; }
function rbColSet() {
  if (!__rbColSel[__rbSource]) __rbColSel[__rbSource] = new Set(rbCols().map(c => c.key));
  return __rbColSel[__rbSource];
}

async function loadReportBuilder() {
  const root = document.getElementById('report-builder');
  if (!root) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  if (!isMgr) { root.innerHTML = ''; return; }

  // Shell (rendered once); the data + table live in child nodes we repaint.
  if (!root.dataset.wired) {
    root.dataset.wired = '1';
    root.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">Custom report</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Choose who and what with dropdowns, then export.</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="rb-print" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
              Print / PDF
            </button>
            <button id="rb-export" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition inline-flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
              Export CSV
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <label class="block"><span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Report</span>
            <select id="rb-source" class="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              ${Object.entries(RB_SOURCES).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join('')}
            </select></label>
          <label class="block" id="rb-rep-wrap"><span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Salesperson</span>
            <select id="rb-rep" class="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></select></label>
          <label class="block hidden" id="rb-status-wrap"><span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Status</span>
            <select id="rb-status" class="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="sold">Sold</option>
              <option value="archived">Archived (off feed)</option>
            </select></label>
          <label class="block"><span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Date range</span>
            <select id="rb-range" class="mt-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365" selected>Last 12 months</option>
              <option value="all">All time</option>
            </select></label>
        </div>
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <details class="relative">
            <summary class="cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400 select-none">Columns ▾</summary>
            <div id="rb-cols" class="absolute z-20 mt-2 w-72 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-3 grid grid-cols-1 gap-1"></div>
          </details>
          <label id="rb-hideblank-wrap" class="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" id="rb-hideblank" class="rounded"> Hide columns we don't capture yet
          </label>
        </div>
        <div id="rb-result" class="overflow-auto max-h-[65vh] rounded-lg border border-slate-200 dark:border-slate-800"></div>
      </div>`;
    root.querySelector('#rb-source').addEventListener('change', e => { __rbSource = e.target.value; rbSyncControls(); rbRenderColMenu(); rbFetch(); });
    root.querySelector('#rb-rep').addEventListener('change', e => { __rbRep = e.target.value; rbFetch(); });
    root.querySelector('#rb-status').addEventListener('change', e => { __rbStatus = e.target.value; rbFetch(); });
    root.querySelector('#rb-range').addEventListener('change', e => { __rbRange = e.target.value; rbFetch(); });
    root.querySelector('#rb-hideblank').addEventListener('change', e => { __rbHideBlank = e.target.checked; rbRenderTable(); });
    root.querySelector('#rb-export').addEventListener('click', rbExportCsv);
    root.querySelector('#rb-print').addEventListener('click', rbPrint);
    rbSyncControls();
    rbRenderColMenu();
  }
  await rbFetch();
}

// Show/hide the rep vs status filter + the "hide blank" toggle per source.
function rbSyncControls() {
  const s = RB_SOURCES[__rbSource];
  document.getElementById('rb-rep-wrap')?.classList.toggle('hidden', !s.hasRep);
  document.getElementById('rb-status-wrap')?.classList.toggle('hidden', !s.hasStatus);
  document.getElementById('rb-hideblank-wrap')?.classList.toggle('hidden', !s.cols.some(c => c.blank));
}

// Rebuild the column checkbox menu for the current source.
function rbRenderColMenu() {
  const cw = document.getElementById('rb-cols');
  if (!cw) return;
  const set = rbColSet();
  cw.innerHTML = rbCols().map(c => `<label class="text-xs text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
    <input type="checkbox" data-col="${c.key}" ${set.has(c.key) ? 'checked' : ''} class="rounded"> ${esc(c.label)}${c.blank ? ' <span class="text-slate-400">(blank)</span>' : ''}</label>`).join('');
  cw.querySelectorAll('input[data-col]').forEach(cb => cb.addEventListener('change', () => {
    cb.checked ? set.add(cb.dataset.col) : set.delete(cb.dataset.col);
    rbRenderTable();
  }));
}

async function rbFetch() {
  const rr = document.getElementById('rb-result');
  if (rr) rr.innerHTML = '<div class="text-sm text-slate-400 italic px-4 py-6">Loading…</div>';
  let d;
  try { d = await apiGetJson(RB_SOURCES[__rbSource].url(), { retries: 1 }); }
  catch { if (rr) rr.innerHTML = '<div class="text-sm text-rose-500 px-4 py-6">Could not load the report.</div>'; return; }
  __rbData = d || { rows: [] };
  // Populate the rep dropdown once (keep current selection).
  const sel = document.getElementById('rb-rep');
  if (sel && !sel.dataset.filled && Array.isArray(__rbData.reps)) {
    sel.dataset.filled = '1';
    sel.innerHTML = `<option value="all">All salespeople</option>` +
      __rbData.reps.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    sel.value = __rbRep;
  }
  rbRenderTable();
}

function rbActiveCols() {
  const set = rbColSet();
  return rbCols().filter(c => set.has(c.key) && !(__rbHideBlank && c.blank));
}

function rbRenderTable() {
  const rr = document.getElementById('rb-result');
  if (!rr) return;
  const src = RB_SOURCES[__rbSource];
  const rows = __rbData?.rows || [];
  const cols = rbActiveCols();
  if (!rows.length) { rr.innerHTML = `<div class="text-sm text-slate-400 italic px-4 py-6">No ${src.noun}s match these filters.</div>`; return; }
  const dealCol = src.hasDeal && !simpleCrmActive();
  const head = `<th class="py-2 px-3 text-right sticky left-0 bg-slate-50 dark:bg-slate-950">#</th>` +
    (dealCol ? `<th class="py-2 px-3"></th>` : '') +
    cols.map(c => `<th class="py-2 px-3 whitespace-nowrap ${c.blank ? 'text-slate-400' : ''}">${esc(c.label)}</th>`).join('');
  const body = rows.map((r, i) => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="py-2 px-3 text-right tabular-nums text-slate-400 sticky left-0 bg-white dark:bg-slate-900">${i + 1}</td>
      ${dealCol ? `<td class="py-2 px-3"><button onclick="rbOpenDeal('${r.contact_id}')" title="${r.has_deal ? 'Edit deal desk fields' : 'Add deal desk fields'}" class="text-xs font-bold ${r.has_deal ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'} hover:underline whitespace-nowrap">${r.has_deal ? ' Deal' : '+ Deal'}</button></td>` : ''}
      ${cols.map(c => `<td class="py-2 px-3 whitespace-nowrap ${c.blank ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}">${esc(rbFmt(r[c.key], c.type))}</td>`).join('')}
    </tr>`).join('');
  rr.innerHTML = `
    <div class="px-4 sm:px-0 text-xs text-slate-500 dark:text-slate-400 mb-2">${rows.length} ${src.noun}${rows.length === 1 ? '' : 's'} · ${cols.length} columns shown</div>
    <table class="text-xs text-left border-collapse min-w-full">
      <thead><tr class="border-y border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50 dark:bg-slate-950">${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function rbExportCsv() {
  const rows = __rbData?.rows || [];
  const cols = rbActiveCols();
  const csvCell = v => { const s = (v == null ? '' : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const header = ['#', ...cols.map(c => c.label)].map(csvCell).join(',');
  const lines = rows.map((r, i) => [i + 1, ...cols.map(c => rbFmt(r[c.key], c.type))].map(csvCell).join(','));
  const csv = [header, ...lines].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${RB_SOURCES[__rbSource].file()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Print / Save-as-PDF: opens a clean, print-styled copy of the current report and
// triggers the browser's print dialog (which offers Save as PDF).
function rbPrint() {
  const rows = __rbData?.rows || [];
  const cols = rbActiveCols();
  const title = (RB_SOURCES[__rbSource]?.label || 'Report');
  const esc2 = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const head = ['#', ...cols.map(c => c.label)].map(h => `<th>${esc2(h)}</th>`).join('');
  const body = rows.map((r, i) => `<tr><td>${i + 1}</td>${cols.map(c => `<td>${esc2(rbFmt(r[c.key], c.type))}</td>`).join('')}</tr>`).join('');
  const dealer = (profileContext?.dealershipName || 'MarketSync');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc2(title)}</title>
    <style>
      body{font:13px -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:24px}
      h1{font-size:18px;margin:0 0 2px} .sub{color:#64748b;font-size:12px;margin:0 0 16px}
      table{border-collapse:collapse;width:100%} th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:12px}
      th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#475569}
      tr:nth-child(even) td{background:#f8fafc}
      @media print{body{margin:0}}
    </style></head><body>
    <h1>${esc2(title)}</h1>
    <p class="sub">${esc2(dealer)} · ${rows.length} rows · ${new Date().toLocaleString()}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to print the report', 'error'); return; }
  w.document.write(html); w.document.close();
}
window.loadReportBuilder = loadReportBuilder;

// ── Deal desk record — shared form (used by the Reports modal + Desk-a-deal page)
const DEAL_TEXT_FIELDS = ['delivery_date', 'delivery_time', 'fni_manager', 'deposit_amount', 'deal_type', 'term', 'plates', 'fni_products', 'gm_survey_pct', 'split_with', 'vehicle_commission', 'fni_commission', 'notes'];
const DEAL_BOOL_FIELDS = ['google_review', 'gm_survey', 'fni_gross_1500', 'split_deal'];

// The grid of F&I fields, pre-filled from `deal`. Inputs keep their dl-<key> ids.
function dealFormFieldsHtml(deal = {}) {
  const val = (k) => deal[k] != null ? String(deal[k]) : '';
  const chk = (k) => deal[k] === true ? 'checked' : '';
  const sel = (k, opts) => `<select id="dl-${k}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
    <option value="">—</option>${opts.map(o => `<option value="${o}" ${val(k) === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  const txt = (k, type = 'text', ph = '') => `<input id="dl-${k}" type="${type}" value="${esc(val(k))}" placeholder="${ph}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const cbx = (k, label) => `<label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"><input type="checkbox" id="dl-${k}" ${chk(k)} class="rounded"> ${label}</label>`;
  const field = (label, html) => `<div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">${label}</label>${html}</div>`;
  return `
    ${field('Delivery date', txt('delivery_date', 'date'))}
    ${field('Delivery time', txt('delivery_time', 'time'))}
    ${field('F&amp;I manager', txt('fni_manager', 'text', 'Name'))}
    ${field('Deposit amount', txt('deposit_amount', 'number', '0'))}
    ${field('Deal type', sel('deal_type', ['Finance', 'Lease', 'Cash']))}
    ${field('Term (months)', txt('term', 'number', '60'))}
    ${field('Plates', sel('plates', ['New', 'Transfer']))}
    ${field('GM survey %', txt('gm_survey_pct', 'number', '0'))}
    <div class="sm:col-span-2">${field('F&amp;I products', txt('fni_products', 'text', 'Warranty, GAP, etc.'))}</div>
    ${field('Split with', txt('split_with', 'text', 'Rep name'))}
    ${field('Vehicle commission', txt('vehicle_commission', 'number', '0'))}
    ${field('F&amp;I commission', txt('fni_commission', 'number', '0'))}
    <div></div>
    <div class="sm:col-span-2 grid grid-cols-2 gap-3 pt-1">
      ${cbx('google_review', 'Google review')}
      ${cbx('gm_survey', 'GM survey done')}
      ${cbx('fni_gross_1500', '$1,500 F&I gross')}
      ${cbx('split_deal', 'Split deal')}
    </div>
    <div class="sm:col-span-2">${field('Notes', `<textarea id="dl-notes" rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(val('notes'))}</textarea>`)}</div>`;
}

// Read the dl-* inputs into a POST payload for /reports/deal.
function readDealPayload(contactId) {
  const g = (k) => document.getElementById('dl-' + k);
  const payload = { contact_id: contactId };
  DEAL_TEXT_FIELDS.forEach(k => { const el = g(k); if (el) payload[k] = el.value; });
  DEAL_BOOL_FIELDS.forEach(k => { const el = g(k); if (el) payload[k] = el.checked; });
  return payload;
}

async function saveDealPayload(contactId) {
  const res = await fetch(`${API}/reports/deal`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(readDealPayload(contactId)),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed');
  return (await res.json()).deal;
}

// Reports-table modal (quick edit inline on the report).
async function rbOpenDeal(contactId) {
  const r = (__rbData?.rows || []).find(x => x.contact_id === contactId);
  const who = r ? [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Customer' : 'Customer';
  const veh = r ? [r.year, r.make, r.model, r.trim].filter(Boolean).join(' ') : '';
  let deal = {};
  try { const d = await apiGetJson(`/reports/deal?contact_id=${encodeURIComponent(contactId)}`, { retries: 1 }); deal = d?.deal || {}; } catch {}

  document.getElementById('rb-deal-modal')?.remove();
  const m = document.createElement('div');
  m.id = 'rb-deal-modal';
  m.className = 'fixed inset-0 z-[80] bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto';
  m.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl my-auto">
      <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Deal desk record</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">${esc(who)}${veh ? ' · ' + esc(veh) : ''}</p>
        </div>
        <button onclick="document.getElementById('rb-deal-modal').remove()" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none p-1">&times;</button>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">${dealFormFieldsHtml(deal)}</div>
      <div class="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-800">
        <button onclick="document.getElementById('rb-deal-modal').remove()" class="text-sm font-bold text-slate-600 dark:text-slate-300 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
        <button id="dl-save" onclick="rbSaveDeal('${contactId}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">Save deal</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
}

async function rbSaveDeal(contactId) {
  const btn = document.getElementById('dl-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await saveDealPayload(contactId);
    document.getElementById('rb-deal-modal')?.remove();
    showToast('Deal saved', 'success');
    await rbFetch();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save deal'; }
    showToast(e.message || 'Could not save the deal', 'error');
  }
}
window.rbOpenDeal = rbOpenDeal;
window.rbSaveDeal = rbSaveDeal;

// ── Desk a Deal — full page (managers). Pick a sold/delivered customer, then
// fill the F&I desk record on a dedicated screen (no cramped modal).
let __deskContactId = null;   // set when opened from a CRM customer row
let __deskDealer = null;      // { name, city, province, postal, country, logo } — letterhead + tax
let __deskBuyer = null;       // full contact block for the bill of sale
let __deskDeal = {};          // loaded/working deal record
let __deskCustomerNumber = null;  // per-dealership customer #
let __deskSalesperson = null;     // { name, registration_id } — the rep on this deal
let __deskAddons = [], __deskFni = [], __deskFees = [];
let __deskSearchTimer = null, __deskVehTimer = null;
let __deskCommTouched = false;    // rep manually edited a commission field → stop auto-filling
let __deskCommTimer = null;       // debounce the commission-preview call
let __deskFniCatalog = [];        // F&I products catalog (from /fni/products)
let __deskLenders = [];           // lenders (from /fni/lenders), rate-sorted

const DESK_DEFAULT_APR = 9.99;   // auto-filled rate (editable); financing is stored, not submitted
const deskM = (n) => '$' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Combined sales-tax rate for the dealer's jurisdiction. Canada = HST/GST by
// province (Ontario 13%); US left at 0 for manual entry. Always editable per deal.
function deskTaxRate(prov, country) {
  if (String(country || '').toUpperCase() === 'US') return 0;
  const p = String(prov || '').trim().toLowerCase();
  const m = {
    on: 13, ontario: 13, ontaro: 13,
    nb: 15, 'new brunswick': 15, ns: 15, 'nova scotia': 15, pe: 15, pei: 15, 'prince edward island': 15,
    nl: 15, newfoundland: 15, 'newfoundland and labrador': 15,
    bc: 12, 'british columbia': 12, mb: 12, manitoba: 12, qc: 14.975, quebec: 14.975, 'québec': 14.975,
    sk: 11, saskatchewan: 11, ab: 5, alberta: 5, nt: 5, 'northwest territories': 5,
    nu: 5, nunavut: 5, yt: 5, yukon: 5,
  };
  if (m[p] != null) return m[p];
  if (/ontar/.test(p)) return 13;
  return 13;   // sensible Canadian default; editable
}
let __deskDealerFees = null;   // management's configured fee schedule (from /ai/config), or null
// Re-apply the "locked" flag to a saved deal's fees by matching names against the
// store's fee schedule, so a fee management locked stays locked when the deal reopens.
function deskApplyFeeLocks(fees) {
  const locks = new Set((Array.isArray(__deskDealerFees) ? __deskDealerFees : []).filter(f => f.locked).map(f => (f.name || '').trim().toLowerCase()));
  return fees.map(f => ({ ...f, locked: locks.has((f.name || '').trim().toLowerCase()) }));
}
// Prefill fees on a fresh deal. Uses the store's configured schedule when management
// has set one in Settings (each fee may be `locked` = not editable on the desk),
// else falls back to the standard Ontario lines. Licensing/registration is a
// government passthrough (not taxable); doc fee, OMVIC and tire levy are taxable.
function deskDefaultFees() {
  if (Array.isArray(__deskDealerFees) && __deskDealerFees.length) {
    return __deskDealerFees.map(f => ({ name: f.name, amount: Number(f.amount) || 0, taxable: f.taxable !== false, locked: f.locked === true }));
  }
  return [
    { name: 'Documentation / admin fee', amount: 699, taxable: true, locked: false },
    { name: 'Licensing & registration', amount: 60, taxable: false, locked: true },
    { name: 'OMVIC fee', amount: 10, taxable: true, locked: true },
    { name: 'Tire / enviro levy', amount: 24.75, taxable: true, locked: false },
  ];
}

async function loadDeskDeal() {
  const root = document.getElementById('desk-root');
  if (!root) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  if (!isMgr) { root.innerHTML = '<div class="text-sm text-slate-400 italic p-6">Manager access required.</div>'; return; }
  root.innerHTML = '<div class="text-sm text-slate-400 italic p-6">Loading…</div>';
  // Dealer letterhead + legal identifiers + jurisdiction (documents + default tax).
  if (!__deskDealer) {
    try {
      const cfg = await apiGetJson('/ai/config', { retries: 1 });
      __deskDealer = {
        name: cfg.legal_name || profileContext?.dealership?.name || 'Dealership',
        city: cfg.city, province: cfg.province, postal: cfg.postal_code, country: cfg.country,
        street: cfg.street_address || null, phone: cfg.phone || null, fax: cfg.fax || null,
        hst: cfg.hst_number || null, omvic: cfg.omvic_reg || null, logo: null,
      };
      // Management-configured fee schedule; null until a dealer sets one in Settings.
      __deskDealerFees = Array.isArray(cfg.desk_fees) ? cfg.desk_fees : null;
      // Vehicle-cost tracking (internal gross) — off by default, never on customer docs.
      __deskDealer.costOn = !!cfg.cost_tracking_enabled;
      __deskDealer.costRepVisible = !!cfg.cost_rep_visible;
    } catch { __deskDealer = { name: profileContext?.dealership?.name || 'Dealership' }; }
    try { const b = await apiGetJson('/branding', { retries: 1 }); __deskDealer.logo = b?.branding?.logo_url || null; } catch {}
  }
  const isAdmin = ['DEALER_ADMIN', 'OWNER'].includes(profileContext?.role);
  const needsSetup = !(__deskDealer.hst && __deskDealer.omvic && __deskDealer.street);
  root.innerHTML = `
    <div class="mb-5">
      <h1 class="text-2xl font-black text-slate-900 dark:text-white">Desk a deal</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">Search any customer, structure the full deal, and print an estimate or bill of sale. Everything is stored on the customer's record. Financing figures are estimates only — not a lender commitment.</p>
    </div>
    ${(isAdmin && needsSetup) ? `
    <div id="desk-dealer-setup" class="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl mb-4">
      <div class="px-4 sm:px-5 py-3 text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
        Dealer details for documents <span class="text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">Setup needed</span>
      </div>
      <p class="px-4 sm:px-5 -mt-1 mb-2 text-xs text-slate-400">A one-time setup — this appears on the bill of sale. Once saved, it disappears from here and you can edit it anytime in Settings › Dealer Management.</p>
      <div class="p-4 sm:p-5 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="col-span-2 sm:col-span-3"><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Legal / trade name</label><input id="dlr-legal_name" value="${esc(__deskDealer.name || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div class="col-span-2 sm:col-span-3"><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Street address</label><input id="dlr-street_address" value="${esc(__deskDealer.street || '')}" placeholder="915 Niagara St" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Phone</label><input id="dlr-phone" value="${esc(__deskDealer.phone || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Fax</label><input id="dlr-fax" value="${esc(__deskDealer.fax || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">HST #</label><input id="dlr-hst_number" value="${esc(__deskDealer.hst || '')}" placeholder="R715748679" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">OMVIC / dealer reg #</label><input id="dlr-omvic_reg" value="${esc(__deskDealer.omvic || '')}" placeholder="5686852" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div class="col-span-2 sm:col-span-3"><button onclick="deskSaveDealer(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">Save dealer details</button></div>
      </div>
    </div>` : ''}

    <div id="desk-form"></div>`;

  if (__deskContactId) { deskPickCustomer(__deskContactId); __deskContactId = null; } else { deskRenderForm(null); }
}

async function deskCustomerSearch(q) {
  const box = document.getElementById('desk-results');
  if (!box) return;
  q = (q || '').trim();
  if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  try {
    const d = await apiGetJson(`/deals/customers?q=${encodeURIComponent(q)}`, { retries: 1 });
    const rows = d?.rows || [];
    let html = rows.map(r => `
      <button type="button" onclick="deskPickCustomer('${r.id}')" class="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between">
        <div>
          <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(r.name)}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">${[r.email, r.phone, [r.city, r.province].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ')}</div>
        </div>
        <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">Select →</span>
      </button>`).join('');

    html += `
      <button type="button" onclick="deskOpenAddCustomerModal('${esc(q)}')" class="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition flex items-center gap-2 border-t border-indigo-100 dark:border-indigo-900">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        <span>+ Add New Customer ${q ? `"${esc(q)}"` : ''}</span>
      </button>
    `;
    box.innerHTML = html;
    box.classList.remove('hidden');
  } catch {
    box.innerHTML = `
      <button type="button" onclick="deskOpenAddCustomerModal('${esc(q)}')" class="w-full text-left px-4 py-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        <span>+ Add New Customer</span>
      </button>`;
    box.classList.remove('hidden');
  }
}

window.deskOpenAddCustomerModal = function(initialName = '') {
  let modal = document.getElementById('desk-add-customer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'desk-add-customer-modal';
    document.body.appendChild(modal);
  }
  const parts = initialName.trim().split(' ');
  const fname = parts[0] || '';
  const lname = parts.slice(1).join(' ') || '';

  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span class="p-1.5 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
          </span>
          Add New Customer
        </h3>
        <button onclick="document.getElementById('desk-add-customer-modal').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg">×</button>
      </div>
      <form onsubmit="deskSubmitNewCustomer(event)" class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">First Name *</label>
            <input id="desk-new-fname" required value="${esc(fname)}" placeholder="Ava" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Last Name *</label>
            <input id="desk-new-lname" required value="${esc(lname)}" placeholder="Thompson" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Email</label>
            <input id="desk-new-email" type="email" placeholder="ava@example.com" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Phone</label>
            <input id="desk-new-phone" type="tel" placeholder="(416) 555-0199" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
        </div>
        <div>
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Street Address</label>
          <input id="desk-new-street" placeholder="123 Main St" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">City</label>
            <input id="desk-new-city" placeholder="Toronto" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Province</label>
            <input id="desk-new-prov" placeholder="ON" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
          <div>
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Postal Code</label>
            <input id="desk-new-postal" placeholder="M5V 2T6" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm">
          </div>
        </div>
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button type="button" onclick="document.getElementById('desk-add-customer-modal').remove()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
          <button type="submit" id="desk-add-cust-btn" class="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition">Save & Select Customer</button>
        </div>
      </form>
    </div>
  `;
};

window.deskSubmitNewCustomer = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('desk-add-cust-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const first_name = document.getElementById('desk-new-fname').value.trim();
  const last_name = document.getElementById('desk-new-lname').value.trim();
  const email = document.getElementById('desk-new-email').value.trim();
  const phone = document.getElementById('desk-new-phone').value.trim();
  const street_address = document.getElementById('desk-new-street').value.trim();
  const city = document.getElementById('desk-new-city').value.trim();
  const province = document.getElementById('desk-new-prov').value.trim();
  const postal_code = document.getElementById('desk-new-postal').value.trim();

  try {
    const res = await apiSendJson('/crm/contacts', 'POST', {
      first_name, last_name, email, phone, street_address, city, province, postal_code, status: 'opportunity'
    });
    const contactId = res.contact?.id || res.id;
    document.getElementById('desk-add-customer-modal')?.remove();
    if (contactId) {
      deskPickCustomer(contactId);
    }
  } catch (err) {
    alert(err.message || 'Could not save customer');
    if (btn) { btn.disabled = false; btn.textContent = 'Save & Select Customer'; }
  }
};

async function deskPickCustomer(id) {
  document.getElementById('desk-results')?.classList.add('hidden');
  const wrap = document.getElementById('desk-form');
  if (wrap) wrap.innerHTML = '<div class="text-sm text-slate-400 italic p-4">Loading deal…</div>';
  __deskBuyer = null; __deskDeal = {};
  try { const d = await apiGetJson(`/deals/customer?id=${encodeURIComponent(id)}`, { retries: 1 }); __deskBuyer = d?.contact || null; __deskDeal.__vehicleOfInterest = d?.vehicle || null; } catch {}
  try { const d = await apiGetJson(`/reports/deal?contact_id=${encodeURIComponent(id)}`, { retries: 1 }); __deskDeal = { ...__deskDeal, ...(d?.deal || {}) }; __deskCustomerNumber = d?.customer_number || __deskDeal.customer_number || null; __deskSalesperson = d?.salesperson || null; } catch {}
  const s = document.getElementById('desk-search');
  if (s && __deskBuyer) s.value = __deskBuyer.full_name || [__deskBuyer.first_name, __deskBuyer.last_name].filter(Boolean).join(' ') || '';
  const deal = __deskDeal;
  __deskAddons = Array.isArray(deal.addons) ? deal.addons.slice() : [];
  __deskFni = Array.isArray(deal.fni_items) ? deal.fni_items.slice() : [];
  __deskFees = Array.isArray(deal.fees) ? deskApplyFeeLocks(deal.fees.slice()) : (deal.id ? [] : deskDefaultFees());
  if (!deal.vehicle && deal.__vehicleOfInterest) {
    const v = deal.__vehicleOfInterest;
    deal.vehicle = { year: v.year, make: v.make, model: v.model, trim: v.trim, vin: v.vin, mileage: v.mileage, color: v.exterior_color, stock: v.stocknumber };
    if (deal.selling_price == null && v.price) deal.selling_price = v.price;
    if (!deal.inventory_id && v.id) deal.inventory_id = v.id;
  }
  await crmEnsureLookups();
  deskRenderForm(id);
}

function deskRepSelect(id, selectedId, blankLabel, filterFn) {
  const cls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const reps = (__crmReps || []).filter(r => !filterFn || filterFn(r));
  return `<select id="${id}" class="${cls}"><option value="">${esc(blankLabel || '—')}</option>${reps.map(r => `<option value="${r.id}" ${selectedId === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>`;
}

const DESK_FNI_ROLES = ['FNI', 'DEALER_ADMIN', 'OWNER', 'MANAGER'];
function deskRenderForm(contactId) {
  const wrap = document.getElementById('desk-form');
  if (!wrap) return;
  __deskCommTouched = false;
  const d = __deskDeal || {};
  const b = __deskBuyer || null;
  const veh = d.vehicle || {};
  const ins = d.insurance || {};
  const onFile = !!d.id;
  const buyerName = b ? (b.full_name || [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Customer') : '';
  const rate = d.tax_rate != null ? d.tax_rate : deskTaxRate(__deskDealer?.province, __deskDealer?.country);
  const _dealerCountry = (() => { const c = (__deskDealer?.country || '').trim().toUpperCase(); return (c === 'US' || c === 'USA' || c === 'UNITED STATES') ? 'US' : 'CA'; })();
  const dkCountry = d.tax_country || _dealerCountry;
  const _dealerProv = (__deskDealer?.province || '').trim().toUpperCase();
  const dkProvince = d.tax_province || (DESK_TAX[dkCountry]?.regions?.[_dealerProv] ? _dealerProv : '');
  const apr = d.apr != null ? d.apr : DESK_DEFAULT_APR;
  const taxOnDiff = d.tax_on_difference !== false;
  const iCls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition';
  const fld = (label, html) => `<div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">${label}</label>${html}</div>`;
  const txt = (id, v, ph = '', type = 'text', extra = '') => `<input id="${id}" type="${type}" value="${esc(v == null ? '' : String(v))}" placeholder="${ph}" ${extra} class="${iCls}">`;
  const money = (id, v, ph = '0.00') => `<input id="${id}" type="text" inputmode="decimal" data-money value="${v == null ? '' : msFmtMoney(v)}" placeholder="${ph}" oninput="deskRenderSummary()" class="${iCls}">`;
  const card = (title, body, sub = '') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-4 shadow-sm">
    <div class="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">${title}</h3>${sub ? `<p class="text-xs text-slate-400">${sub}</p>` : ''}</div>
    <div class="p-5">${body}</div></div>`;

  const customerHeaderHtml = b ? `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg flex items-center justify-center uppercase shadow-md">
          ${esc((buyerName[0] || 'C'))}
        </div>
        <div>
          <div class="text-lg font-black text-slate-900 dark:text-white">${esc(buyerName)}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${[b.email, b.phone || b.phone_mobile, [b.city, b.province].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ') || 'No contact details on file'}</div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${__deskCustomerNumber ? `<span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-mono">Customer #${__deskCustomerNumber}</span>` : ''}
        ${(__deskDeal.deal_number) ? `<span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-mono">Deal #${__deskDeal.deal_number}</span>` : ''}
        <span class="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${onFile ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}">${onFile ? 'On file' : 'New deal'}</span>
        <button type="button" onclick="__deskBuyer = null; deskRenderForm(null);" class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Change Customer</button>
      </div>
    </div>
  ` : `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-5 shadow-sm">
      <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <label class="text-xs uppercase tracking-wider text-slate-400 font-black block">Customer Selection</label>
          <p class="text-xs text-slate-500">Search an existing customer or click below to add a new customer.</p>
        </div>
        <button type="button" onclick="deskOpenAddCustomerModal('')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span>+ Add New Customer</span>
        </button>
      </div>
      <div class="relative">
        <input id="desk-search" type="text" autocomplete="off" placeholder="Search customer by name, email or phone number…" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition">
        <div id="desk-results" class="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden hidden max-h-80 overflow-y-auto"></div>
      </div>
    </div>
  `;

  wrap.innerHTML = `
    ${customerHeaderHtml}

    <div class="mb-4">
      <label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Co-buyer <span class="font-normal normal-case">(optional)</span></label>
      <input id="dk-co_buyer" value="${esc(d.co_buyer || '')}" placeholder="Second buyer's full name" class="${iCls} max-w-md">
    </div>

    <div class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
      <div>
        ${card('Insurance', `<details ${(ins.company || ins.policy || ins.agent || ins.phone || ins.expiry) ? 'open' : ''} class="group">
            <summary class="cursor-pointer list-none text-sm font-bold text-indigo-600 dark:text-indigo-400 select-none inline-flex items-center gap-1.5"><span class="group-open:hidden">＋ Add insurance details</span><span class="hidden group-open:inline">Insurance details</span></summary>
            <div class="grid grid-cols-2 gap-3 mt-3">
              ${fld('Company', txt('dk-ins-company', ins.company, ''))}
              ${fld('Policy #', txt('dk-ins-policy', ins.policy, ''))}
              ${fld('Agent / broker', txt('dk-ins-agent', ins.agent, ''))}
              ${fld('Agent phone', txt('dk-ins-phone', ins.phone, '', 'tel'))}
              ${fld('Binder / expiry', txt('dk-ins-expiry', ins.expiry, '', 'date'))}
            </div>
          </details>`, 'Optional — fills onto the bill of sale and the customer card.')}

        ${card('Vehicle', `
          <div class="relative mb-2">
            <input id="desk-veh-search" type="text" autocomplete="off" placeholder="Search inventory by VIN, stock # or name…" class="${iCls}">
            <div id="desk-veh-results" class="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden hidden max-h-64 overflow-y-auto"></div>
          </div>
          <div id="desk-veh-link" class="mb-3 text-[12px]"></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            ${fld('Year', txt('dk-veh-year', veh.year, '2022'))}
            ${fld('Make', txt('dk-veh-make', veh.make, 'Chevrolet'))}
            ${fld('Model', txt('dk-veh-model', veh.model, 'Silverado'))}
            ${fld('Trim', txt('dk-veh-trim', veh.trim, 'LT'))}
            ${fld('Mileage', txt('dk-veh-mileage', veh.mileage, 'km', 'number'))}
            ${fld('Colour', txt('dk-veh-color', veh.color, ''))}
            ${fld('VIN', `<div class="flex gap-1">${txt('dk-veh-vin', veh.vin, '17-digit VIN')}${vinScanBtn('dk-veh-vin')}</div>`)}
            ${fld('Stock #', txt('dk-veh-stock', veh.stock, ''))}
            ${fld('Sale type', `<select id="dk-sale_type" class="${iCls}">${['Retail', 'Wholesale', 'Fleet', 'Lease return'].map(o => `<option ${((d.sale_type || 'Retail') === o) ? 'selected' : ''}>${o}</option>`).join('')}</select>`)}
          </div>
          <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${fld('Retail / MSRP', `<input id="dk-retail" type="text" inputmode="decimal" data-money value="${d.retail == null ? '' : msFmtMoney(d.retail)}" placeholder="0.00" oninput="deskPriceRecalc()" class="${iCls}">`)}
            ${fld('Rebate (before tax)', `<input id="dk-rebate_before_tax" type="text" inputmode="decimal" data-money value="${d.rebate_before_tax == null ? '' : msFmtMoney(d.rebate_before_tax)}" placeholder="0.00" oninput="deskPriceRecalc()" class="${iCls}">`)}
            ${fld('Adjustment (+/−)', `<input id="dk-adjustment" type="text" inputmode="decimal" data-money value="${d.adjustment == null ? '' : msFmtMoney(d.adjustment)}" placeholder="0.00" oninput="deskPriceRecalc()" class="${iCls}">`)}
            ${fld('Selling price', money('dk-selling_price', d.selling_price))}
          </div>
          <p class="text-[11px] text-slate-400 mt-1.5">Enter a Retail/MSRP and the selling price fills in automatically (Retail − rebate + adjustment). Leave Retail blank to just type a selling price.</p>`)}

        ${card('Trade-in', `
          <div class="flex items-center gap-2 mb-3"><button type="button" onclick="deskPullTrade()" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg">↓ Pull saved appraisal</button><span id="desk-trade-hint" class="text-xs text-slate-400"></span></div>
          <div id="desk-trade-picker" class="mb-3 hidden"></div>
          <div class="grid grid-cols-2 gap-3">
            ${fld('Trade description', txt('dk-trade_desc', d.trade_desc, 'Year / make / model'))}
            ${fld('Trade VIN', txt('dk-trade_vin', d.trade_vin, ''))}
            ${fld('Trade allowance', money('dk-trade_value', d.trade_value))}
            ${fld('Lien / payoff', money('dk-trade_payoff', d.trade_payoff))}
          </div>`, 'HST is charged on the price after the trade allowance (Ontario tax-on-the-difference). Pull the customer\'s saved appraisal to fill this in.')}

        ${card('Finance terms', `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            ${fld('Deal type', `<select id="dk-deal_type" class="${iCls}">${['Finance', 'Lease', 'Cash'].map(o => `<option ${d.deal_type === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`)}
            ${fld('Lender', `<input id="dk-finance_company" list="desk-lender-list" value="${esc(d.finance_company || '')}" placeholder="e.g. TD Auto Finance" oninput="deskLenderPicked(this.value)" class="${iCls}"><datalist id="desk-lender-list"></datalist><div id="desk-lender-hint" class="text-[11px] text-slate-400 mt-0.5"></div>`)}
            ${fld('Program', txt('dk-program', d.program, 'e.g. Finance rates'))}
            ${fld('APR / sell rate %', `<input id="dk-apr" type="number" step="0.01" value="${apr}" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Buy rate % (reserve)', `<input id="dk-buy_rate" type="number" step="0.01" value="${d.buy_rate == null ? '' : d.buy_rate}" placeholder="lender buy rate" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Term (months)', `<select id="dk-term" onchange="deskRenderSummary()" class="${iCls}">${[24, 36, 48, 60, 72, 84, 96].map(t => `<option value="${t}" ${(d.term == null ? 60 : d.term) == t ? 'selected' : ''}>${t}</option>`).join('')}</select>`)}
            ${fld('Payment frequency', `<select id="dk-payment_freq" onchange="deskRenderSummary()" class="${iCls}">${[['monthly', 'Monthly'], ['biweekly', 'Bi-weekly'], ['weekly', 'Weekly']].map(([v, l]) => `<option value="${v}" ${((d.payment_freq || 'monthly') === v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
            ${fld('1st payment date', txt('dk-first_payment_date', d.first_payment_date, '', 'date'))}
            ${fld('No-interest deferral (days)', `<input id="dk-deferral_days" type="number" value="${d.deferral_days == null ? '' : d.deferral_days}" placeholder="0" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Balloon / residual', `<input id="dk-balloon" type="text" inputmode="decimal" data-money value="${d.balloon == null ? '' : msFmtMoney(d.balloon)}" placeholder="0.00" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Lease residual $', `<input id="dk-residual_amount" type="text" inputmode="decimal" data-money value="${d.residual_amount == null ? '' : msFmtMoney(d.residual_amount)}" placeholder="lease only" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Lease km/yr', `<input id="dk-mileage_allowance" type="number" value="${d.mileage_allowance == null ? '' : d.mileage_allowance}" placeholder="e.g. 20000" oninput="deskRenderSummary()" class="${iCls}">`)}
            ${fld('Cash down', money('dk-down_payment', d.down_payment))}
            ${fld('Deposit', money('dk-deposit_amount', d.deposit_amount))}
            ${fld('Rebate (after tax)', money('dk-rebate', d.rebate))}
            ${fld('Country', `<select id="dk-tax_country" onchange="deskSetCountry()" class="${iCls}">${Object.entries(DESK_TAX).map(([code, j]) => `<option value="${code}" ${dkCountry === code ? 'selected' : ''}>${esc(j.label)}</option>`).join('')}</select>`)}
            ${fld('State / Province (auto tax)', `<select id="dk-tax_province" onchange="deskSetJurisdiction()" class="${iCls}"><option value="">— Select —</option>${Object.entries((DESK_TAX[dkCountry] || DESK_TAX.CA).regions).map(([code, r]) => `<option value="${code}" ${dkProvince === code ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select>`)}
            ${fld('Tax rate % (total)', `<input id="dk-tax_rate" type="number" step="0.001" value="${rate}" oninput="deskRenderSummary()" class="${iCls}">`)}
            <div class="flex items-end pb-2"><label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"><input type="checkbox" id="dk-tax_on_difference" ${taxOnDiff ? 'checked' : ''} onchange="deskRenderSummary()" class="rounded"> Tax on the difference</label></div>
            <p id="dk-tax-hint" class="col-span-2 text-[11px] text-slate-400 dark:text-slate-500 -mt-1">Pick a state/province to auto-fill the rate. For U.S. deals the rate is <b>state + average local/county</b> — edit it for the buyer's exact jurisdiction.</p>
          </div>`)}

        ${card('Add-ons', `<div id="desk-addons"></div>
          <button type="button" onclick="deskAddLine('addon')" class="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">＋ Add an add-on</button>`, 'Accessories, protection packages, etc. Taxable.')}

        ${card('F&amp;I products', `<div id="desk-fni"></div>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <select id="desk-fni-picker" onchange="deskAddFniFromCatalog(this.value); this.value='';" class="${iCls} text-xs"><option value="">＋ Add from catalog…</option></select>
            <button type="button" onclick="deskAddLine('fni')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">＋ Add manually</button>
            ${['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role) ? `<button type="button" onclick="openFniCatalogManager()" class="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">Manage catalog &amp; lenders</button>` : ''}
          </div>`, 'Warranty, GAP, appearance protection, etc. Taxable. Financing is arranged through your lender program.')}

        ${card('Fees', `<div id="desk-fees"></div>
          <button type="button" onclick="deskAddLine('fee')" class="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">＋ Add a fee</button>`, 'Uncheck “taxable” for government passthroughs like licensing.')}

        <details class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">
          <summary class="px-5 py-3 cursor-pointer text-sm font-black text-slate-900 dark:text-white">Internal — F&amp;I tracking &amp; delivery</summary>
          <div class="p-5 grid grid-cols-2 gap-3">
            ${(__deskDealer.costOn && (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role) || __deskDealer.costRepVisible)) ? fld('Vehicle cost <span class="normal-case font-normal text-slate-400">(internal — never shown to customers)</span>', `<input id="dk-cost" type="text" inputmode="decimal" data-money value="${d.cost == null ? '' : msFmtMoney(d.cost)}" placeholder="0.00" oninput="deskRenderSummary()" class="${iCls}">`) : ''}
            ${fld('F&amp;I manager <span class="normal-case font-normal text-slate-400">(gets F&amp;I commission if the plan pays them)</span>', deskRepSelect('dk-fni_manager_id', d.fni_manager_id, '— none —', r => DESK_FNI_ROLES.includes(r.role)))}
            ${fld('Delivery date', txt('dk-delivery_date', d.delivery_date, '', 'date'))}
            ${fld('Delivery time', txt('dk-delivery_time', d.delivery_time, '', 'time'))}
            ${fld('Plates', `<select id="dk-plates" class="${iCls}"><option value="">—</option>${['New', 'Transfer'].map(o => `<option ${d.plates === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`)}
            ${fld('Vehicle commission <span class="normal-case font-normal text-slate-400">(auto from the plan)</span>', `<input id="dk-vehicle_commission" type="number" value="${d.vehicle_commission == null ? '' : d.vehicle_commission}" placeholder="0" oninput="deskCommTouch()" class="${iCls}">`)}
            ${fld('F&amp;I commission <span class="normal-case font-normal text-slate-400">(auto from the plan)</span>', `<input id="dk-fni_commission" type="number" value="${d.fni_commission == null ? '' : d.fni_commission}" placeholder="0" oninput="deskCommTouch()" class="${iCls}">`)}
            ${fld('Split with', deskRepSelect('dk-split_rep_id', d.split_rep_id, '— none —'))}
            ${fld('Split % to co-rep <span class="normal-case font-normal text-slate-400">(their share of the sales commission)</span>', txt('dk-split_pct', d.split_pct != null ? d.split_pct : 50, '50', 'number'))}
            <div class="col-span-2 grid grid-cols-2 gap-2 pt-1">
              <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="dk-google_review" ${d.google_review ? 'checked' : ''} class="rounded"> Google review</label>
              <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="dk-gm_survey" ${d.gm_survey ? 'checked' : ''} class="rounded"> GM survey done</label>
              <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="dk-fni_gross_1500" ${d.fni_gross_1500 ? 'checked' : ''} class="rounded"> $1,500 F&amp;I gross</label>
              <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="dk-split_deal" ${d.split_deal ? 'checked' : ''} class="rounded"> Split deal</label>
            </div>
            <div class="col-span-2">${fld('Notes', `<textarea id="dk-notes" rows="2" class="${iCls}">${esc(d.notes || '')}</textarea>`)}</div>
          </div>
        </details>
      </div>

      <div class="lg:sticky lg:top-4">
        <div id="desk-summary" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
        <div id="desk-status-bar" class="mt-3">${deskStatusBar(contactId)}</div>
        <div class="flex flex-col gap-2 mt-3">
          <button id="desk-save" onclick="deskSave('${contactId}')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-6 py-2.5 rounded-lg transition">Save deal</button>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="deskPrint('estimate')" class="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold px-3 py-2.5 rounded-lg transition">Print estimate</button>
            <button onclick="deskPrint('bill')" class="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold px-3 py-2.5 rounded-lg transition">Bill of sale</button>
          </div>
          <button onclick="openCreditApp('${contactId}')" class="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-3 py-2.5 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Credit application</button>
          <button onclick="deskEsign('${contactId}','bill')" class="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-3 py-2.5 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Send for e-signature</button>
          <button id="desk-deposit-btn" onclick="deskCollectDeposit('${contactId}')" class="w-full inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-3 py-2.5 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>Collect deposit</button>
          <button onclick="openEsignStatus('${contactId}')" class="w-full text-center text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition py-1">View signature status →</button>
        </div>
      </div>
    </div>`;

  // Wire customer search for the desking block.
  const ds = document.getElementById('desk-search');
  if (ds) {
    ds.addEventListener('input', () => {
      clearTimeout(__deskSearchTimer);
      const q = ds.value.trim();
      if (q.length < 2) {
        const box = document.getElementById('desk-results');
        if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
        return;
      }
      __deskSearchTimer = setTimeout(() => deskCustomerSearch(q), 220);
    });
    ds.addEventListener('focus', () => {
      const q = ds.value.trim();
      if (q.length >= 2) deskCustomerSearch(q);
      else {
        const box = document.getElementById('desk-results');
        if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
      }
    });
  }

  // Wire inventory search for the vehicle block.
  const vs = document.getElementById('desk-veh-search');
  vs?.addEventListener('input', () => { clearTimeout(__deskVehTimer); __deskVehTimer = setTimeout(() => deskVehSearch(vs.value.trim()), 220); });
  // Auto-link by VIN / stock # on blur, and show the link status badge.
  document.getElementById('dk-veh-vin')?.addEventListener('blur', deskTryAutolink);
  document.getElementById('dk-veh-stock')?.addEventListener('blur', deskTryAutolink);
  deskUpdateLinkBadge();
  deskRenderLines();
  deskRenderSummary();
  deskCheckDeposits();   // grey the Collect-deposit button until payments are connected
  deskLoadCatalog();     // populate the F&I product picker + lender datalist
}
// Collect-deposit requires a connected payments account (Stripe Connect charges
// enabled). Grey the button until then and point the rep to Integrations.
let __depositsReady = null;
async function deskCheckDeposits() {
  const apply = () => {
    const btn = document.getElementById('desk-deposit-btn'); if (!btn) return;
    const blocked = __depositsReady === false;
    btn.disabled = blocked;
    btn.classList.toggle('opacity-50', blocked);
    btn.classList.toggle('cursor-not-allowed', blocked);
    btn.title = blocked ? 'Connect payments in Settings → Integrations to collect deposits' : '';
  };
  if (__depositsReady !== null) apply();
  try { const d = await apiGetJson('/deposits/config'); __depositsReady = !!d.charges_enabled; } catch { /* unknown → leave enabled */ }
  apply();
}
window.deskCheckDeposits = deskCheckDeposits;

// ── Line items (add-ons / F&I / fees) ────────────────────────────────────────
function deskLinesFor(kind) { return kind === 'addon' ? __deskAddons : kind === 'fni' ? __deskFni : __deskFees; }
function deskAddLine(kind) { deskLinesFor(kind).push(kind === 'fee' ? { name: '', amount: null, taxable: true } : { name: '', price: null }); deskRenderLines(); deskRenderSummary(); }
function deskDelLine(kind, i) { deskLinesFor(kind).splice(i, 1); deskRenderLines(); deskRenderSummary(); }
function deskLineEdit(kind, i, field, val) { const r = deskLinesFor(kind)[i]; if (!r) return; if (field === 'taxable') r[field] = val; else if (field === 'name') r[field] = val; else { const nn = msNum(val); r[field] = (val === '' || !Number.isFinite(nn)) ? null : nn; } deskRenderSummary(); }
function deskRenderLines() {
  const iCls = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const rowHtml = (kind, r, i, amtKey) => {
    // A fee that management locked can't be edited or removed on the desk.
    const locked = kind === 'fee' && r.locked === true;
    const ro = locked ? 'readonly disabled' : '';
    const roCls = locked ? 'opacity-70 cursor-not-allowed' : '';
    return `
    <div class="flex items-center gap-2 mb-2">
      <input value="${esc(r.name || '')}" oninput="deskLineEdit('${kind}',${i},'name',this.value)" placeholder="Description" ${ro} class="${iCls} ${roCls} flex-1">
      <input value="${r[amtKey] == null ? '' : msFmtMoney(r[amtKey])}" oninput="deskLineEdit('${kind}',${i},'${amtKey}',this.value)" type="text" inputmode="decimal" data-money placeholder="0.00" ${ro} class="${iCls} ${roCls} w-28 text-right">
      ${kind === 'fee' ? `<label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 whitespace-nowrap ${roCls}"><input type="checkbox" ${r.taxable !== false ? 'checked' : ''} ${locked ? 'disabled' : ''} onchange="deskLineEdit('fee',${i},'taxable',this.checked)" class="rounded"> tax</label>` : ''}
      ${locked ? '<span class="text-slate-400 px-1" title="Locked by management — edit in Settings › Dealer Management"></span>' : `<button type="button" onclick="deskDelLine('${kind}',${i})" class="text-rose-500 hover:text-rose-600 px-1" title="Remove"></button>`}
    </div>`;
  };
  const a = document.getElementById('desk-addons'); if (a) a.innerHTML = __deskAddons.map((r, i) => rowHtml('addon', r, i, 'price')).join('') || '<div class="text-xs text-slate-400 italic">None.</div>';
  const f = document.getElementById('desk-fni'); if (f) f.innerHTML = __deskFni.map((r, i) => rowHtml('fni', r, i, 'price')).join('') || '<div class="text-xs text-slate-400 italic">None.</div>';
  const e = document.getElementById('desk-fees'); if (e) e.innerHTML = __deskFees.map((r, i) => rowHtml('fee', r, i, 'amount')).join('') || '<div class="text-xs text-slate-400 italic">None.</div>';
}

// ── F&I catalog + lenders (from the dealership's F&I catalog) ─────────────────
// Loads the product menu + lender list so the desk can pick from a catalog instead
// of free-typing. Silent no-op if the catalog is empty (dealer hasn't set one up).
async function deskLoadCatalog() {
  try {
    const [p, l] = await Promise.all([
      apiGetJson('/fni/products', { retries: 1 }).catch(() => null),
      apiGetJson('/fni/lenders?sort=rate', { retries: 1 }).catch(() => null),
    ]);
    __deskFniCatalog = (p && p.products) || [];
    __deskLenders = (l && l.lenders) || [];
  } catch { __deskFniCatalog = []; __deskLenders = []; }
  deskRenderCatalogControls();
}
function deskRenderCatalogControls() {
  // F&I product picker options.
  const sel = document.getElementById('desk-fni-picker');
  if (sel) {
    if (__deskFniCatalog.length) {
      sel.innerHTML = '<option value="">＋ Add from catalog…</option>' +
        __deskFniCatalog.map((p, i) => `<option value="${i}">${esc(p.name)}${p.retail_default != null ? ' — ' + msFmtMoney(p.retail_default) : ''}</option>`).join('');
      sel.classList.remove('hidden');
    } else { sel.classList.add('hidden'); }   // no catalog → just the manual button
  }
  // Lender datalist (rate-sorted) + "lowest rate" helper (the Lender-by-Rate answer).
  const dl = document.getElementById('desk-lender-list');
  if (dl) dl.innerHTML = __deskLenders.map(l => `<option value="${esc(l.name)}">${l.base_rate != null ? l.base_rate + '%' : ''}${l.tier ? ' · ' + esc(l.tier) : ''}</option>`).join('');
  deskLenderPicked(document.getElementById('dk-finance_company')?.value || '');
}
function deskAddFniFromCatalog(idx) {
  const p = __deskFniCatalog[Number(idx)];
  if (!p) return;
  __deskFni.push({ name: p.name, price: p.retail_default != null ? Number(p.retail_default) : null, cost: p.cost != null ? Number(p.cost) : null, product_id: p.id });
  deskRenderLines(); deskRenderSummary();
}
window.deskAddFniFromCatalog = deskAddFniFromCatalog;
// Show the lowest-rate lender as a nudge, and flag the picked one's rate.
function deskLenderPicked(name) {
  const hint = document.getElementById('desk-lender-hint'); if (!hint) return;
  // "Lender by rate" is an F&I/manager view — reps just pick the lender, they don't
  // see the buy-rate ranking.
  if (!DESK_FNI_ROLES.includes(profileContext?.role)) { hint.textContent = ''; return; }
  if (!__deskLenders.length) { hint.textContent = ''; return; }
  const rated = __deskLenders.filter(l => l.base_rate != null);
  const picked = name ? __deskLenders.find(l => l.name.toLowerCase() === name.trim().toLowerCase()) : null;
  const parts = [];
  if (rated.length) { const lo = rated[0]; parts.push(`Lowest rate: ${esc(lo.name)} ${lo.base_rate}%`); }
  if (picked && picked.base_rate != null) parts.push(`${esc(picked.name)} buy rate ${picked.base_rate}%`);
  hint.textContent = parts.join(' · ');
}
window.deskLenderPicked = deskLenderPicked;

// ── F&I catalog manager (managers) ───────────────────────────────────────────
// Modal to CRUD F&I products (with cost + retail) and lenders (with buy rate).
let __fniMgr = { products: [], lenders: [] };
async function openFniCatalogManager() {
  if (!['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role)) return;
  const ov = crmOverlay(`<div id="fni-mgr-body" class="p-5"><div class="py-10 text-center text-sm text-slate-400 italic">Loading catalog…</div></div>`, 'max-w-3xl');
  ov.dataset.fniMgr = '1';
  await fniMgrReload();
}
window.openFniCatalogManager = openFniCatalogManager;
async function fniMgrReload() {
  try {
    const [p, l] = await Promise.all([
      apiGetJson('/fni/products', { retries: 1 }).catch(() => ({ products: [] })),
      apiGetJson('/fni/lenders', { retries: 1 }).catch(() => ({ lenders: [] })),
    ]);
    __fniMgr = { products: p.products || [], lenders: l.lenders || [] };
  } catch { __fniMgr = { products: [], lenders: [] }; }
  fniMgrRender();
  // Keep the open desk's picker/datalist in sync with catalog edits.
  if (document.getElementById('desk-fni-picker')) deskLoadCatalog();
}
function fniMgrRender() {
  const body = document.getElementById('fni-mgr-body'); if (!body) return;
  const iCls = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm';
  const money = n => n != null ? '$' + Number(n).toLocaleString() : '—';
  const prodRow = (p) => `<tr class="border-t border-slate-100 dark:border-slate-800">
    <td class="py-1.5 pr-2 font-semibold text-slate-700 dark:text-slate-200">${esc(p.name)}${p.category ? `<span class="block text-[11px] text-slate-400">${esc(p.category)}</span>` : ''}</td>
    <td class="py-1.5 px-2 text-right tabular-nums text-slate-500">${money(p.cost)}</td>
    <td class="py-1.5 px-2 text-right tabular-nums text-slate-700 dark:text-slate-200">${money(p.retail_default)}</td>
    <td class="py-1.5 pl-2 text-right"><button onclick="fniMgrDelProduct('${p.id}')" class="text-rose-500 hover:text-rose-600 text-xs font-bold">Remove</button></td></tr>`;
  const lendRow = (l) => `<tr class="border-t border-slate-100 dark:border-slate-800">
    <td class="py-1.5 pr-2 font-semibold text-slate-700 dark:text-slate-200">${esc(l.name)}${l.tier ? `<span class="block text-[11px] text-slate-400">${esc(l.tier)}</span>` : ''}</td>
    <td class="py-1.5 px-2 text-right tabular-nums text-slate-700 dark:text-slate-200">${l.base_rate != null ? l.base_rate + '%' : '—'}</td>
    <td class="py-1.5 pl-2 text-right"><button onclick="fniMgrDelLender('${l.id}')" class="text-rose-500 hover:text-rose-600 text-xs font-bold">Remove</button></td></tr>`;
  body.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-black text-slate-900 dark:text-white">F&amp;I catalog &amp; lenders</h3>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="mb-6">
      <div class="text-sm font-bold text-slate-900 dark:text-white mb-2">F&amp;I products</div>
      <table class="w-full text-sm mb-2"><thead><tr class="text-[10px] uppercase tracking-wider text-slate-400"><th class="text-left pb-1">Product</th><th class="text-right px-2 pb-1">Cost</th><th class="text-right px-2 pb-1">Retail</th><th></th></tr></thead>
        <tbody>${__fniMgr.products.map(prodRow).join('') || '<tr><td colspan="4" class="py-3 text-center text-slate-400 italic text-xs">No products yet.</td></tr>'}</tbody></table>
      <div class="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2.5">
        <input id="fni-np-name" placeholder="Name (e.g. Extended warranty)" class="${iCls} flex-1 min-w-[160px]">
        <input id="fni-np-cat" placeholder="Category" class="${iCls} w-28">
        <input id="fni-np-cost" type="text" inputmode="decimal" placeholder="Cost" class="${iCls} w-24 text-right">
        <input id="fni-np-retail" type="text" inputmode="decimal" placeholder="Retail" class="${iCls} w-24 text-right">
        <button onclick="fniMgrAddProduct()" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Add</button>
      </div>
    </div>
    <div>
      <div class="text-sm font-bold text-slate-900 dark:text-white mb-2">Lenders <span class="font-normal text-slate-400 text-xs">— buy rate powers the Lender-by-Rate order on the desk</span></div>
      <table class="w-full text-sm mb-2"><thead><tr class="text-[10px] uppercase tracking-wider text-slate-400"><th class="text-left pb-1">Lender</th><th class="text-right px-2 pb-1">Buy rate</th><th></th></tr></thead>
        <tbody>${__fniMgr.lenders.map(lendRow).join('') || '<tr><td colspan="3" class="py-3 text-center text-slate-400 italic text-xs">No lenders yet.</td></tr>'}</tbody></table>
      <div class="flex flex-wrap items-end gap-2 bg-slate-50 dark:bg-slate-950/50 rounded-lg p-2.5">
        <input id="fni-nl-name" placeholder="Lender (e.g. TD Auto Finance)" class="${iCls} flex-1 min-w-[160px]">
        <input id="fni-nl-tier" placeholder="Tier" class="${iCls} w-24">
        <input id="fni-nl-rate" type="number" step="0.01" placeholder="Rate %" class="${iCls} w-24 text-right">
        <button onclick="fniMgrAddLender()" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Add</button>
      </div>
    </div>`;
}
async function fniMgrAddProduct() {
  const name = document.getElementById('fni-np-name')?.value.trim();
  if (!name) { showToast('Product name required', 'error'); return; }
  try {
    await apiSendJson('/fni/products', 'POST', {
      name, category: document.getElementById('fni-np-cat')?.value.trim() || null,
      cost: msNum(document.getElementById('fni-np-cost')?.value), retail_default: msNum(document.getElementById('fni-np-retail')?.value),
    });
    await fniMgrReload();
  } catch (e) { showToast(e.message, 'error'); }
}
window.fniMgrAddProduct = fniMgrAddProduct;
async function fniMgrDelProduct(id) {
  try { await apiSendJson(`/fni/products/${id}`, 'DELETE'); await fniMgrReload(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.fniMgrDelProduct = fniMgrDelProduct;
async function fniMgrAddLender() {
  const name = document.getElementById('fni-nl-name')?.value.trim();
  if (!name) { showToast('Lender name required', 'error'); return; }
  try {
    await apiSendJson('/fni/lenders', 'POST', {
      name, tier: document.getElementById('fni-nl-tier')?.value.trim() || null,
      base_rate: msNum(document.getElementById('fni-nl-rate')?.value),
    });
    await fniMgrReload();
  } catch (e) { showToast(e.message, 'error'); }
}
window.fniMgrAddLender = fniMgrAddLender;
async function fniMgrDelLender(id) {
  try { await apiSendJson(`/fni/lenders/${id}`, 'DELETE'); await fniMgrReload(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.fniMgrDelLender = fniMgrDelLender;

// ── Inventory search for the vehicle block ───────────────────────────────────
async function deskVehSearch(q) {
  const box = document.getElementById('desk-veh-results');
  if (!box) return;
  try {
    const d = await apiGetJson(`/deals/vehicles?q=${encodeURIComponent(q)}`, { retries: 1 });
    const rows = d?.rows || [];
    if (!rows.length) { box.classList.add('hidden'); return; }
    box.innerHTML = rows.map(v => {
      const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
      const j = encodeURIComponent(JSON.stringify({ id: v.id, year: v.year, make: v.make, model: v.model, trim: v.trim, vin: v.vin, mileage: v.mileage, color: v.exterior_color, stock: v.stocknumber, price: v.price }));
      return `<button type="button" onclick="deskPickVehicle('${j}')" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(label)} ${v.status && v.status !== 'available' ? `<span class="text-[10px] text-amber-600">(${esc(v.status)})</span>` : ''}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${[v.stocknumber ? '#' + v.stocknumber : '', v.vin, v.price ? deskM(v.price) : ''].filter(Boolean).map(esc).join(' · ')}</div>
      </button>`;
    }).join('');
    box.classList.remove('hidden');
  } catch { box.classList.add('hidden'); }
}
function deskPickVehicle(json) {
  let v; try { v = JSON.parse(decodeURIComponent(json)); } catch { return; }
  document.getElementById('desk-veh-results')?.classList.add('hidden');
  __deskDeal.inventory_id = v.id || null;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('dk-veh-year', v.year); set('dk-veh-make', v.make); set('dk-veh-model', v.model); set('dk-veh-trim', v.trim);
  set('dk-veh-mileage', v.mileage); set('dk-veh-color', v.color); set('dk-veh-vin', v.vin); set('dk-veh-stock', v.stock);
  // Fill Retail/MSRP from the unit's price and let the selling price derive
  // (Retail − rebate + adjustment) instead of dropping the price straight into
  // "selling price".
  if (v.price != null) { set('dk-retail', msFmtMoney(v.price)); if (typeof deskPriceRecalc === 'function') deskPriceRecalc(); }
  const vs = document.getElementById('desk-veh-search'); if (vs) vs.value = '';
  deskUpdateLinkBadge();
  deskRenderSummary();
}

// Show whether the deal is linked to a stocked unit — get-ready/Cleanup only works
// when it is. Managers can pick from the search or auto-link by VIN / stock #.
function deskUpdateLinkBadge() {
  const el = document.getElementById('desk-veh-link'); if (!el) return;
  const stock = (document.getElementById('dk-veh-stock')?.value || '').trim();
  if (__deskDeal.inventory_id) {
    el.innerHTML = `<span class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold"> Linked to inventory${stock ? ' · stock #' + esc(stock) : ''} <button type="button" onclick="deskUnlinkVehicle()" class="text-slate-400 hover:text-rose-500 underline font-normal">unlink</button></span><span class="block text-[11px] text-slate-400">Cleanup / F&amp;I get-ready is enabled for this deal.</span>`;
  } else {
    el.innerHTML = `<span class="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold"> Not linked to a stocked vehicle</span><span class="block text-[11px] text-slate-400">Pick the unit from the search above (or enter a matching VIN/stock #) so F&amp;I get-ready can send it to Cleanup.</span>`;
  }
}
function deskUnlinkVehicle() { __deskDeal.inventory_id = null; deskUpdateLinkBadge(); }

// If a VIN or stock # is typed that exactly matches a stocked unit, link it.
async function deskTryAutolink() {
  if (__deskDeal.inventory_id) return;
  const vin = (document.getElementById('dk-veh-vin')?.value || '').trim();
  const stock = (document.getElementById('dk-veh-stock')?.value || '').trim();
  const q = vin || stock;
  if (!q || q.length < 3) return;
  try {
    const d = await apiGetJson(`/deals/vehicles?q=${encodeURIComponent(q)}`, { retries: 1 });
    const rows = d?.rows || [];
    const match = (vin && rows.find(v => String(v.vin || '').toUpperCase() === vin.toUpperCase()))
               || (stock && rows.find(v => String(v.stocknumber || '').toLowerCase() === stock.toLowerCase()));
    if (match) { __deskDeal.inventory_id = match.id; deskUpdateLinkBadge(); }
  } catch {}
}