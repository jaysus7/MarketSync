/* dashboard.js split part 14/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function syncParsedPlanToAllEngines() {
  const plan = __activeSynthesizedPlan || parseCommissionDocumentText(SAMPLE_COMMISSION_DOC_1);
  localStorage.setItem('ms_active_commission_plan', JSON.stringify(plan));

  crmOverlay(`
    <div class="p-6 space-y-5 text-center">
      <div class="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-inner animate-pulse">⚡</div>
      <div>
        <h3 class="text-xl font-black text-slate-900 dark:text-white">Synced Across All MarketSync Engines!</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">"${esc(plan.plan_name)}" rules have been written live into all store operational engines.</p>
      </div>

      <div class="grid grid-cols-2 gap-3 text-left text-xs">
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">✓ Deal Desk Engine</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Calculates packs, gross tiers, EV minimums &amp; F&amp;I spiffs on every deal.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">✓ HR &amp; Compliance Engine</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Tracks training deadlines, CSI scores &amp; process penalties on rep profiles.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">✓ Accounting Payroll Ledger</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Feeds gross commissions, volume bonuses, Christmas holdbacks &amp; draws.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">✓ Store Settings</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Saved as primary active commission plan template.</div>
        </div>
      </div>

      <button onclick="this.closest('.fixed').remove(); commLoadAIImporter();" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition">
        Done &amp; View Active Engine Plan
      </button>
    </div>
  `, 'max-w-md');

  showToast('Commission Plan Synced Across All Engines! ⚡', 'success');
}

window.commLoadAIImporter = commLoadAIImporter;
window.aiHandleDocFileUpload = aiHandleDocFileUpload;
window.aiLoadPresetDoc = aiLoadPresetDoc;
window.aiProcessCommissionDocument = aiProcessCommissionDocument;
window.syncParsedPlanToAllEngines = syncParsedPlanToAllEngines;

// Reports page — stacks the three manager reports + the sold-per-rep report and
// the custom report builder. Called from switchPage('reports').
function loadReports() {
  renderReportTabs();
  if (__rptTab === 'overview') {
    loadExecutiveRoi();
    loadInventoryMix();
    loadSalesAnalysis();
    loadMarketingRoi();
    loadReportBuilder();
  } else {
    loadDeepReport(__rptTab);
  }
}

// ── Deep reports hub ─────────────────────────────────────────────────────────
let __rptTab = 'overview';
let __rptRange = '90';
const REPORT_DEFS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales' },
  { key: 'fni', label: 'F&I' },
  { key: 'leads', label: 'Leads & sources' },
  { key: 'reps', label: 'Rep scorecard' },
  { key: 'appraisals', label: 'Appraisals' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'service', label: 'Service' },
  { key: 'esign', label: 'E-signatures' },
  { key: 'marketing', label: 'Marketing ROI' },
  { key: 'activity', label: 'Activity' },
  { key: 'customers', label: 'Customers' },
];
function renderReportTabs() {
  const host = document.getElementById('reports-tabs'); if (!host) return;
  const ms = document.documentElement.getAttribute('data-dash-mode') === 'marketsync';
  const defs = ms ? REPORT_DEFS.filter(d => MS_REPORT_KEYS.has(d.key)) : REPORT_DEFS;
  // MarketSync mode has no Overview (it's vehicle-heavy) — default to Leads.
  if (ms && !MS_REPORT_KEYS.has(__rptTab)) __rptTab = 'leads';
  host.innerHTML = defs.map(d => `<button onclick="reportsTab('${d.key}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border transition ${__rptTab === d.key ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${d.label}</button>`).join('');
}
function reportsTab(key) {
  __rptTab = key;
  renderReportTabs();
  const overview = document.getElementById('reports-overview');
  const dyn = document.getElementById('reports-dynamic');
  if (key === 'overview') {
    overview?.classList.remove('hidden'); dyn?.classList.add('hidden');
    loadExecutiveRoi(); loadInventoryMix(); loadSalesAnalysis(); loadMarketingRoi(); loadReportBuilder();
  } else {
    overview?.classList.add('hidden'); dyn?.classList.remove('hidden');
    loadDeepReport(key);
  }
}
function rptRange(v) { __rptRange = v; loadDeepReport(__rptTab); }
window.reportsTab = reportsTab;
window.rptRange = rptRange;

// One generic renderer for all deep reports: stat tiles from `summary`, a table
// for every array field the endpoint returns. Keeps the 8 reports consistent.
const RPT_MONEY_HINT = /(revenue|price|offer|commission|gross|amount|value)/i;
function rptFmtVal(k, v) {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (/pct|percent|rate/i.test(k)) return v + '%';
    if (RPT_MONEY_HINT.test(k)) return '$' + Number(v).toLocaleString();
    return Number(v).toLocaleString();
  }
  return esc(String(v));
}
function rptLabel(k) { return k.replace(/_/g, ' ').replace(/\bpct\b/i, '%').replace(/\bfni\b/i, 'F&I').replace(/^\w/, c => c.toUpperCase()); }
function rptTable(title, rows) {
  if (!Array.isArray(rows) || !rows.length) return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-sm font-bold text-slate-900 dark:text-white mb-1">${esc(title)}</div><div class="text-xs text-slate-400 italic">No data in range.</div></div>`;
  const cols = Object.keys(rows[0]);
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 overflow-x-auto">
    <div class="text-sm font-bold text-slate-900 dark:text-white mb-2">${esc(title)}</div>
    <table class="w-full text-sm min-w-[420px]"><thead><tr class="text-[10px] uppercase tracking-wider text-slate-400">${cols.map((c, i) => `<th class="pb-1 ${i === 0 ? 'text-left' : 'text-right px-2'}">${esc(rptLabel(c))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr class="border-t border-slate-100 dark:border-slate-800">${cols.map((c, i) => `<td class="py-1.5 ${i === 0 ? 'text-left font-semibold text-slate-700 dark:text-slate-200' : 'text-right px-2 tabular-nums text-slate-600 dark:text-slate-300'}">${rptFmtVal(c, r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table>
  </div>`;
}
async function loadDeepReport(key) {
  const host = document.getElementById('reports-dynamic'); if (!host) return;
  const def = REPORT_DEFS.find(d => d.key === key);
  host.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading report…</div>';
  let d;
  try { d = await apiGetJson(`/reports/${key}?range=${__rptRange}`, { retries: 1 }); }
  catch (e) { host.innerHTML = `<p class="text-sm text-rose-500">${esc(e.message || 'Could not load report')}</p>`; return; }
  __rptData = d;
  const rangeBtn = (v, l) => `<button onclick="rptRange('${v}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${__rptRange === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${l}</button>`;
  // Stat tiles from summary (special-case funnel).
  let tiles = '';
  if (d.summary && typeof d.summary === 'object') {
    tiles = `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">${Object.entries(d.summary).map(([k, v]) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${esc(rptLabel(k))}</div><div class="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">${rptFmtVal(k, v)}</div></div>`).join('')}</div>`;
  }
  // Funnel (leads report) as its own bar strip.
  let funnel = '';
  if (d.funnel) {
    const f = d.funnel; const max = Math.max(1, ...Object.values(f));
    funnel = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-sm font-bold text-slate-900 dark:text-white mb-2">Lead funnel</div>${['new', 'contacted', 'appointment', 'sold'].map(s => `<div class="flex items-center gap-2 text-sm py-0.5"><div class="w-24 text-slate-600 dark:text-slate-300 capitalize">${s}</div><div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${Math.round((f[s] / max) * 100)}%"></div></div><div class="w-10 text-right font-bold tabular-nums">${f[s] || 0}</div></div>`).join('')}</div>`;
  }
  // Any array fields → tables.
  const tables = Object.entries(d).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => rptTable(rptLabel(k), v)).join('');
  host.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-1">
      <div><h2 class="text-xl font-black text-slate-900 dark:text-white">${esc((def?.label || key).replace(/^\S+\s/, ''))}</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Last ${d.range_days} days.</p></div>
      <div class="flex gap-1.5 items-center">${rangeBtn('30', '30d')}${rangeBtn('90', '90d')}${rangeBtn('180', '6mo')}${rangeBtn('365', '1y')}
        <button onclick="exportReportCsv()" class="ml-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">${svgIcon("download","w-3.5 h-3.5 inline-block align-text-bottom mr-0.5")}CSV</button></div>
    </div>
    ${tiles}${funnel ? '<div class="mt-4">' + funnel + '</div>' : ''}
    <div class="grid grid-cols-1 ${tables.length > 700 ? 'lg:grid-cols-2' : ''} gap-4 mt-4">${tables}</div>`;
}
window.loadDeepReport = loadDeepReport;
let __rptData = null;
// Export the currently-viewed deep report to CSV: a Summary block, then one block
// per table the report returned. Built client-side from the fetched JSON.
function exportReportCsv() {
  const d = __rptData; if (!d) return;
  const cell = v => { const s = (v == null ? '' : String(v)); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blocks = [];
  if (d.summary && typeof d.summary === 'object') {
    blocks.push('Summary'); blocks.push(['Metric', 'Value'].map(cell).join(','));
    for (const [k, v] of Object.entries(d.summary)) blocks.push([rptLabel(k), v].map(cell).join(','));
    blocks.push('');
  }
  if (d.funnel) { blocks.push('Lead funnel'); blocks.push(['Stage', 'Count'].map(cell).join(',')); for (const [k, v] of Object.entries(d.funnel)) blocks.push([k, v].map(cell).join(',')); blocks.push(''); }
  for (const [k, v] of Object.entries(d)) {
    if (!Array.isArray(v) || !v.length) continue;
    blocks.push(rptLabel(k));
    const cols = Object.keys(v[0]);
    blocks.push(cols.map(c => cell(rptLabel(c))).join(','));
    for (const row of v) blocks.push(cols.map(c => cell(row[c])).join(','));
    blocks.push('');
  }
  const csv = blocks.join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `marketsync-${__rptTab}-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.exportReportCsv = exportReportCsv;

// Sales snapshot — clickable "what needs me now" tiles at the top of the Sales
// dashboard (managers / DealerOS). Each tile deep-links to its filtered view.
async function loadSalesSnapshot() {
  const el = document.getElementById('sales-snapshot');
  if (!el) return;
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  // Only the DealerOS store dashboard — not Facebook-only tiers or MarketSync owner mode.
  if (!isMgr || __fbOnly || document.documentElement.getAttribute('data-dash-mode') === 'marketsync') { el.className = 'hidden'; return; }
  let d;
  try { d = await apiGetJson('/dashboard/sales-snapshot', { retries: 1 }); }
  catch { el.className = 'hidden'; return; }
  if (!d || d.empty) { el.className = 'hidden'; return; }
  // label, value, tone, target page, optional invmode, urgent-when-positive?
  const tiles = [
    { label: 'Unanswered leads', val: d.unanswered_leads, page: 'leads', tone: 'rose', urgent: true },
    { label: 'Follow-ups due today', val: d.followups_today, page: 'tasks', tone: 'amber' },
    { label: 'Overdue follow-ups', val: d.followups_overdue, page: 'tasks', tone: 'rose', urgent: true },
    { label: 'Appointments today', val: d.appointments_today, page: 'appointments', tone: 'violet' },
    { label: 'Deals working', val: d.deals_working, page: 'fni', tone: 'indigo' },
    { label: 'Deliveries pending', val: d.deliveries_pending, page: 'delivery', tone: 'sky' },
    { label: 'Sold this month', val: d.sold_this_month, page: 'reports', tone: 'emerald' },
  ];
  const toneCls = {
    rose: 'text-rose-600 dark:text-rose-400', amber: 'text-amber-600 dark:text-amber-400',
    violet: 'text-violet-600 dark:text-violet-400', indigo: 'text-indigo-600 dark:text-indigo-400',
    sky: 'text-sky-600 dark:text-sky-400', emerald: 'text-emerald-600 dark:text-emerald-400',
  };
  const go = (page) => `deptGo && typeof deptGo==='function' ? deptGo('${page}') : switchPage('${page}')`;
  el.className = 'space-y-2';
  el.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-sm font-black text-slate-900 dark:text-white">Sales snapshot</span>
      <span class="text-xs text-slate-400">what needs you now — tap a tile</span>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      ${tiles.map(t => {
        const hot = t.urgent && t.val > 0;
        return `<button type="button" onclick="${go(t.page)}" class="text-left bg-white dark:bg-slate-900 border ${hot ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-800'} rounded-xl px-3 py-2.5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition">
          <div class="text-2xl font-black tabular-nums ${toneCls[t.tone] || 'text-slate-900 dark:text-white'}">${t.val}</div>
          <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">${t.label}</div>
        </button>`;
      }).join('')}
    </div>`;
}
window.loadSalesSnapshot = loadSalesSnapshot;

async function loadInsights() {
  loadSyncHealth();
  loadSalesSnapshot();
  try {
    const res = await fetch(`${API}/dashboard/insights?range=${insightsRange}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Insights endpoint failed: ${res.status}`, body);
      return;
    }
    const data = await res.json();

    // Range label & scope subtext
    syncRangeLabels(data.range_label);
    const scopePrefix = data.scope === 'dealership' ? 'team total' : 'your posts';
    document.getElementById('metric-listings-scope').textContent = `${scopePrefix} · ${data.range_label || 'lifetime'}`;

    // Top row (existing four)
    document.getElementById('metric-synced').textContent = data.inventory_available ?? data.inventory_synced;
    document.getElementById('metric-synced-total').textContent = data.inventory_synced;
    document.getElementById('metric-listings').textContent = data.listings_posted;
    document.getElementById('metric-sold').textContent = data.sold_this_month;
    document.getElementById('metric-active-days').textContent = `${data.active_days_this_week}/7`;

    // Second row (new metrics)
    document.getElementById('metric-time-to-sell').textContent = data.avg_time_to_sell_days ?? '—';
    document.getElementById('metric-posts-per-day').textContent = data.posts_per_day || '—';
    document.getElementById('metric-sell-through').textContent = data.sell_through_rate || 0;
    document.getElementById('metric-aged').textContent = data.inventory_aged_60d ?? 0;

    // Admin-only: show admin vs reps breakdown under Listings Posted
    if (data.scope === 'dealership') {
      const bd = document.getElementById('metric-listings-breakdown');
      bd?.classList.remove('hidden');
      bd?.classList.add('grid');
      document.getElementById('metric-listings-admin').textContent = data.listings_by_admin ?? 0;
      document.getElementById('metric-listings-reps').textContent = data.listings_by_reps ?? 0;
    }

    // Hide the "Posts/Day" tile in Lifetime mode since the rate isn't meaningful there
    const ppdCard = document.getElementById('metric-posts-per-day')?.closest('.bg-white, .dark\\:bg-slate-900');
    if (ppdCard) ppdCard.style.opacity = (data.range === 'lifetime') ? '0.5' : '1';
  } catch (e) {
    console.error('Insights load threw:', e);
  }
}

// ── Dealer-level insight bundles on the Dashboard (managers/admins) ──────────
// Sales / appointments / e-sign KPIs, a marketing-ROI snapshot, and the full
// CRM/lead insights panel — all from the same endpoints the Reports hub uses.
let __dealerDashRange = 30;
async function loadDealerDash() {
  const host = document.getElementById('dealer-dash');
  if (!host) return;
  const days = __dealerDashRange;
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString();
  // Pull the snapshots in parallel; tolerate any single one failing.
  const grab = (p) => apiGetJson(`${p}${p.includes('?') ? '&' : '?'}range=${days}`, { retries: 1 }).catch(() => null);
  const [sales, appts, esign, mkt] = await Promise.all([
    grab('/reports/sales'), grab('/reports/appointments'), grab('/reports/esign'), grab('/reports/marketing'),
  ]);
  const tile = (label, value, sub, color) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${esc(label)}</div>
    <div class="text-2xl font-black mt-1 tabular-nums ${color || 'text-slate-900 dark:text-white'}">${value}</div>
    ${sub ? `<div class="text-xs text-slate-500 mt-0.5">${sub}</div>` : ''}</div>`;
  const ss = sales?.summary || {}, as = appts?.summary || {}, es = esign?.summary || {};
  const costOn = ss.front_gross != null;
  const kpis = [
    tile('Units sold', ss.units ?? 0, `${money(ss.revenue || 0)} revenue`, 'text-slate-900 dark:text-white'),
    costOn ? tile('Front gross', money(ss.front_gross), `${money(ss.avg_gross || 0)} avg`, 'text-emerald-600 dark:text-emerald-400') : tile('Avg sale price', money(ss.avg_price || 0), 'per unit', 'text-slate-900 dark:text-white'),
    tile('Appt show-rate', (as.show_rate_pct ?? 0) + '%', `${as.showed ?? 0} shown · ${as.no_show ?? 0} no-show`, 'text-sky-600 dark:text-sky-400'),
    tile('E-sign completion', (es.completion_pct ?? 0) + '%', `${es.signed ?? 0} of ${es.sent ?? 0} signed`, 'text-indigo-600 dark:text-indigo-400'),
  ].join('');

  // Marketing ROI snapshot — top channels by ROI.
  let mktBlock = '';
  const rows = (mkt?.rows || []).filter(r => r.spend || r.sales).sort((a, b) => (b.roi_pct ?? -1e9) - (a.roi_pct ?? -1e9)).slice(0, 4);
  if (rows.length) {
    mktBlock = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2"><div class="text-sm font-bold text-slate-900 dark:text-white">Marketing ROI — top channels</div>
        <button onclick="switchPage('reports')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Full report →</button></div>
      <div class="space-y-1.5">${rows.map(r => {
        const roi = r.roi_pct == null ? '—' : (r.roi_pct >= 0 ? '+' : '') + r.roi_pct + '%';
        const cls = (r.roi_pct ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
        return `<div class="flex items-center justify-between text-sm"><span class="text-slate-600 dark:text-slate-300 truncate">${esc(r.channel)}</span><span class="tabular-nums"><span class="text-slate-400 text-xs mr-2">${money(r.spend || 0)} → ${r.sales || 0} sold</span><span class="font-black ${cls}">${roi}</span></span></div>`;
      }).join('')}</div></div>`;
  }

  host.innerHTML = `
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Dealership insights <span class="font-normal text-slate-500 text-sm">· last ${days} days</span></h2>
      <div class="inline-flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-bold">
        ${[30, 90, 180].map(d => `<button onclick="dealerDashRange(${d})" class="px-3 py-1.5 rounded ${days === d ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-300'}">${d === 180 ? '6mo' : d + 'd'}</button>`).join('')}
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${kpis}</div>
    ${mktBlock}
    <div id="crm-insights-root"></div>`;
  // Revive the full CRM/lead insights panel (dormant until now) inside the dashboard.
  if (typeof loadCrmInsights === 'function') { try { loadCrmInsights(); } catch {} }
}
function dealerDashRange(d) { __dealerDashRange = d; loadDealerDash(); }
window.dealerDashRange = dealerDashRange;

// Range pill click — sync all pills, persist, reload everything insight-related
document.addEventListener('click', (e) => {
  const pill = e.target.closest?.('.range-pill');
  if (!pill) return;
  insightsRange = pill.dataset.range;
  localStorage.setItem('insightsRange', insightsRange);
  syncRangePillsUI();
  loadInsights();
  // Repaint team charts too if they're loaded (admin only)
  if (typeof loadTeamInsightsCharts === 'function' && __canSeeTeamInsights) {
    loadTeamInsightsCharts();
  }
  // Repaint personal charts for solo/dealer reps.
  if (document.getElementById('chart-my-trend')) loadMyCharts();
});

document.addEventListener('DOMContentLoaded', syncRangePillsUI);

// The Chrome extension is only for posting to Facebook Marketplace, so its CTA +
// header button only make sense for Facebook products and full DealerOS. The
// MarketSync owner (SaaS back office) and AI-Chatbot-only accounts never post to
// Facebook, so they should never see the install prompt.
function extensionRelevant() {
  if (marketsyncOwnerMode()) return false;              // owner's SaaS back office
  const prod = document.documentElement.getAttribute('data-product') || '';
  if (!prod) return true;                                // full DealerOS uses FB posting
  return /facebook/.test(prod);                          // product-restricted → only FB tiers
}
// Decide the install-extension CTA visibility once the product/workspace is known.
function applyExtensionVisibility() {
  const banner = document.getElementById('ext-cta-banner');
  const headerBtn = document.getElementById('ext-header-btn');
  if (!extensionRelevant()) { banner?.classList.add('hidden'); headerBtn?.classList.add('hidden'); return; }
  let dismissed = false;
  try { dismissed = localStorage.getItem('ms_ext_cta_dismissed') === '1'; } catch {}
  // Not dismissed → big banner at the top. Dismissed → compact "Install extension"
  // button beside Tour in the header.
  if (dismissed) { banner?.classList.add('hidden'); headerBtn?.classList.remove('hidden'); }
  else { banner?.classList.remove('hidden'); headerBtn?.classList.add('hidden'); }
}
window.applyExtensionVisibility = applyExtensionVisibility;
// Wire the dismiss action once; visibility itself is driven by applyExtensionVisibility
// (called from init after the product/workspace is resolved), so nothing flashes for
// non-Facebook accounts.
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ext-cta-dismiss')?.addEventListener('click', () => {
    document.getElementById('ext-cta-banner')?.classList.add('hidden');
    document.getElementById('ext-header-btn')?.classList.remove('hidden');
    try { localStorage.setItem('ms_ext_cta_dismissed', '1'); } catch {}
  });
});

// DEALER DOMAIN: Real team roster from /dealership/team
async function loadDealerManagementMatrix() {
  const tableBody = document.getElementById('dealer-team-table-body');
  if (!tableBody) return;
  const isFacebookTeam = !!__productAllowedPages;
  const title = document.getElementById('dealer-team-title');
  const subtitle = document.getElementById('dealer-team-subtitle');
  const invite = document.getElementById('invite-rep-btn');
  const inviteMgr = document.getElementById('invite-manager-btn');

  if (title) title.textContent = isFacebookTeam ? 'Sales Team' : 'Users & Team';
  if (subtitle) subtitle.textContent = isFacebookTeam
    ? 'Add or remove sales reps for your dealership.'
    : 'Invite, edit, assign roles, pause, or remove users in this dealership.';
  if (invite) {
    invite.textContent = isFacebookTeam ? '+ Invite Rep' : '+ Invite User';
    invite.onclick = (e) => { e.preventDefault(); if (typeof openAddEmployeeModal === 'function') openAddEmployeeModal(); };
  }
  if (inviteMgr) {
    inviteMgr.onclick = (e) => { e.preventDefault(); if (typeof openAddEmployeeModal === 'function') openAddEmployeeModal(); };
  }

  tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-slate-500 italic">Loading team...</td></tr>`;

  let team = [];
  try {
    const res = await fetch(`${API}/dealership/team`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      team = await res.json();
    }
  } catch (e) {}

  if (!team.length) {
    tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-slate-500 italic">No team members yet. Click "+ Invite User" to onboard a new member.</td></tr>`;
    return;
  }

  tableBody.innerHTML = team.map(m => {
    const isSelf = user && m.id === user.id;
    const isAdmin = m.role === 'DEALER_ADMIN' || m.role === 'OWNER';
    const isManager = m.role === 'MANAGER';
    const roleBadge = (isAdmin || isManager)
      ? `<span class="px-2 py-0.5 rounded text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">${m.role}</span>`
      : `<span class="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">${m.role}</span>`;
    // One consolidated Edit button per rep — opens complete onboarding & profile editor modal
    const action = `<button class="rep-edit-btn inline-flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-400" data-rep-id="${m.id}"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</button>`;
    const youTag = isSelf ? ' <span class="text-xs text-slate-500 font-normal">(you)</span>' : '';
    const nameCell = `<button class="rep-detail-btn text-left font-bold text-slate-900 dark:text-white hover:text-indigo-400 transition" data-rep-id="${m.id}">${esc(m.full_name || '(no name)')}${youTag}</button>`;
    return `
      <tr class="border-b border-slate-200/60 dark:border-slate-800/40 hover:bg-white/60 dark:bg-slate-900/40 transition">
        <td class="py-3 px-3">${nameCell}</td>
        <td class="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate">${esc(m.email || '—')}</td>
        <td class="py-3 px-3">${roleBadge}</td>
        <td class="py-3 px-3 font-semibold ${m.active === false ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${esc(m.account_status || (m.active === false ? 'Paused' : 'Active'))}</td>
        <td class="py-3 px-3 text-slate-600 dark:text-slate-300">${m.linked_employee ? `<button onclick="switchPage('people-overview'); setTimeout(() => engineTab('people-overview','work'), 0)" class="text-left font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">${esc(m.linked_employee.name || 'Employee card')}</button>` : '<span class="text-amber-600 dark:text-amber-400">Employment missing</span>'}</td>
        <td class="py-3 px-3 text-slate-500">${esc(m.linked_employee?.department || 'Not assigned')}</td>
        <td class="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">${m.logins_30d ?? 0}</td>
        <td class="py-3 px-3 text-right">${action}</td>
      </tr>
    `;
  }).join('');

  __dealerTeam = team;   // cache for the edit modal
  document.querySelectorAll('.rep-detail-btn, .rep-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const repId = btn.dataset.repId;
      if (typeof openEditEmployeeModal === 'function') {
        openEditEmployeeModal(repId);
      } else if (typeof openRepEdit === 'function') {
        openRepEdit(repId);
      }
    });
  });
  if (typeof loadLeadRoutingCard === 'function') loadLeadRoutingCard();
}

// ── Consolidated rep editor — profile (name/bio/photo) + role + routing +
//    appraisal visibility + password reset + remove, all in one modal ──────────
let __dealerTeam = [];
let __repEditAvatar = null;
function openRepEdit(id) {
  const m = (__dealerTeam || []).find(x => x.id === id); if (!m) { showToast('Rep not found — reload the page', 'error'); return; }
  __repEditAvatar = m.avatar_url || null;
  const isSelf = m.id === user.id;
  const isAdmin = m.role === 'DEALER_ADMIN' || m.role === 'OWNER';
  const isManager = m.role === 'MANAGER';
  const viewerAdmin = profileContext?.role === 'DEALER_ADMIN' || profileContext?.role === 'OWNER';
  const ic = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const routingRow = (m.role === 'SALES_REP')
    ? `<div>${lbl('Sales lot (for auto-assigned leads)')}<select id="re-team" class="${ic}">${[['', '—'], ['new', 'New'], ['used', 'Used'], ['both', 'Both']].map(o => `<option value="${o[0]}" ${(m.sales_team || '') === o[0] ? 'selected' : ''}>${o[1] === '—' ? 'Not set' : o[1]}</option>`).join('')}</select></div>`
    : `<div>${lbl('Manager scope (lead notifications)')}<select id="re-mgr" class="${ic}">${[['', '—'], ['gm', 'General manager'], ['gsm', 'GSM'], ['new_mgr', 'New-car manager'], ['used_mgr', 'Used-car manager'], ['fni', 'F&I manager']].map(o => `<option value="${o[0]}" ${(m.mgr_role || '') === o[0] ? 'selected' : ''}>${o[1] === '—' ? 'Not set' : o[1]}</option>`).join('')}</select></div>`;
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between"><div class="text-lg font-black text-slate-900 dark:text-white">Edit ${esc(m.full_name || 'team member')}</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="flex items-center gap-3">
      <div id="re-avatar-wrap" class="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg font-black text-slate-500 shrink-0">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" class="w-full h-full object-cover">` : esc((m.full_name || '?')[0] || '?')}</div>
      <div><input type="file" accept="image/*" id="re-photo-file" class="hidden" onchange="repEditUploadPhoto(this.files[0])"><button type="button" onclick="document.getElementById('re-photo-file').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-lg">Upload photo</button><p class="text-[11px] text-slate-400 mt-1">Shows on your website team page.</p></div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div>${lbl('Full name')}<input id="re-name" value="${esc(m.full_name || '')}" class="${ic}"></div>
      <div>${lbl('Display name (public)')}<input id="re-display" value="${esc(m.display_name || '')}" placeholder="${esc(m.full_name || '')}" class="${ic}"></div>
    </div>
    <div>${lbl('Bio (public — appears on the website)')}<textarea id="re-bio" rows="3" class="${ic}" placeholder="A sentence or two about this team member.">${esc(m.bio || '')}</textarea></div>
    <div>${lbl('Registration / OMVIC # (prints on the bill of sale, beside their signature)')}<input id="re-reg" value="${esc(m.registration_id || '')}" placeholder="5642822" class="${ic}"></div>
    <div class="grid grid-cols-2 gap-2">
      ${routingRow}
      ${m.role === 'SALES_REP' ? `<div>${lbl('Appraisals')}<label class="flex items-center gap-2 text-sm ${ic}"><input id="re-appr" type="checkbox" class="accent-indigo-600" ${m.can_see_all_appraisals ? 'checked' : ''}>Sees all appraisals</label></div>` : '<div></div>'}
    </div>
    <label class="flex items-center gap-2 text-sm"><input id="re-active" type="checkbox" class="accent-indigo-600" ${m.active !== false ? 'checked' : ''}>Active (uncheck to pause lead assignment &amp; rep sends)</label>
    <div class="border-t border-slate-200 dark:border-slate-700 pt-3 flex flex-wrap items-center gap-2">
      ${(!isSelf && !isAdmin && viewerAdmin) ? `<div class="flex items-center gap-1.5"><label class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Role</label><select id="re-role" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-2 rounded-lg">${[['SALES_REP', 'Sales rep'], ['MANAGER', 'Manager'], ['FNI', 'F&I'], ['SERVICE', 'Service'], ['ACCOUNTING', 'Accounting'], ['CLEANUP', 'Cleanup']].map(o => `<option value="${o[0]}" ${m.role === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><button onclick="repEditRole('${m.id}', document.getElementById('re-role').value, this)" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg">Set</button></div>` : ''}
      ${(!isSelf && viewerAdmin) ? `<button onclick="repEditPassword('${m.id}', this)" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-lg">Reset password</button>` : ''}
      ${(!isSelf && !isAdmin) ? `<button onclick="repEditRemove('${m.id}','${esc(m.full_name || 'this rep')}')" class="text-xs font-bold text-rose-600 hover:text-rose-500 px-2 py-2">Remove</button>` : ''}
      <div class="flex-1"></div>
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="repEditSave('${m.id}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button>
    </div>
    <p id="re-msg" class="hidden text-xs"></p>
  </div>`, 'max-w-lg');
}
async function repEditUploadPhoto(file) {
  if (!file) return; showToast('Uploading…', 'info');
  try {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Upload failed');
    __repEditAvatar = d.url;
    const w = document.getElementById('re-avatar-wrap'); if (w) w.innerHTML = `<img src="${esc(d.url)}" class="w-full h-full object-cover">`;
    showToast('Photo set — Save to apply', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
async function repEditSave(id, btn) {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson(`/admin/users/${id}/profile`, 'PUT', { full_name: val('re-name'), display_name: val('re-display'), bio: val('re-bio'), avatar_url: __repEditAvatar, registration_id: val('re-reg') });
    const team = {}; const t = document.getElementById('re-team'); const mg = document.getElementById('re-mgr');
    if (t) team.sales_team = t.value; if (mg) team.mgr_role = mg.value;
    const act = document.getElementById('re-active'); if (act) team.active = act.checked;
    if (Object.keys(team).length) await apiSendJson(`/admin/users/${id}/team`, 'PUT', team);
    const appr = document.getElementById('re-appr');
    if (appr) await fetch(`${API}/ai/rep-appraisal-visibility`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ rep_id: id, can_see_all: appr.checked }) });
    btn.closest('.fixed').remove(); showToast('Saved', 'success'); loadDealerManagementMatrix();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
async function repEditPassword(id, btn) {
  if (!confirm('Reset this person\'s password to a new temporary one? They\'ll need to use it to sign in.')) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Resetting…';
  try {
    const d = await apiSendJson(`/admin/users/${id}/password`, 'PUT', {});
    const msg = document.getElementById('re-msg'); if (msg) { msg.textContent = `New temporary password: ${d.password} — copy it now and share it securely.`; msg.className = 'text-xs text-emerald-600 dark:text-emerald-400 select-all'; msg.classList.remove('hidden'); }
    showToast('Password reset', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
async function repEditRole(id, to, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try { await apiSendJson(`/admin/users/${id}/role`, 'POST', { role: to }); showToast('Role updated', 'success'); btn.closest('.fixed').remove(); loadDealerManagementMatrix(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
async function repEditRemove(id, name) {
  if (typeof removeRep === 'function') { document.querySelector('.fixed')?.remove(); removeRep(id, name); }
}
Object.assign(window, { openRepEdit, repEditUploadPhoto, repEditSave, repEditPassword, repEditRole, repEditRemove });

// Lead routing + notification config card (on the Sales Team page).
async function loadLeadRoutingCard() {
  const card = document.getElementById('lead-routing-card'); if (!card) return;
  let d; try { d = await apiGetJson('/leads/routing'); } catch { return; }
  if (!d.can_manage) { card.classList.add('hidden'); return; }
  const r = d.routing || {};
  const targeted = r.mode !== 'all';
  card.classList.remove('hidden');
  card.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">Lead routing &amp; notifications</h2>
    <p class="text-slate-500 dark:text-slate-400 text-xs mb-3">New leads are auto-assigned by a random draw within the matching lot. Set each person's lot/scope in the roster below.</p>
    <div class="space-y-2 text-sm">
      <label class="flex items-start gap-2 cursor-pointer"><input type="radio" name="lr-mode" value="targeted" ${targeted ? 'checked' : ''} class="mt-1 accent-indigo-600"><span><b>Targeted</b> — a used lead goes to a random used-car rep + the GSM and used-car manager (new → new rep + new manager).</span></label>
      <label class="flex items-start gap-2 cursor-pointer"><input type="radio" name="lr-mode" value="all" ${targeted ? '' : 'checked'} class="mt-1 accent-indigo-600"><span><b>Everyone</b> — assign to a random rep and notify <b>all management</b>.</span></label>
    </div>
    <div class="border-t border-slate-200 dark:border-slate-800 mt-3 pt-3 space-y-2 text-sm">
      <label class="flex items-center gap-2"><input id="lr-notify-reps" type="checkbox" ${r.notify_reps !== false ? 'checked' : ''} class="accent-indigo-600">Notify the assigned rep</label>
      <label class="flex items-center gap-2"><input id="lr-notify-mgrs" type="checkbox" ${r.notify_managers !== false ? 'checked' : ''} class="accent-indigo-600">Notify management</label>
      <label class="flex items-center gap-2"><input id="lr-notify-all-sales" type="checkbox" ${r.notify_all_sales ? 'checked' : ''} class="accent-indigo-600">Also notify <b>all sales</b> (Everyone mode)</label>
    </div>
    <button onclick="saveLeadRouting(this)" class="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded transition">Save routing</button>
    <span id="lr-msg" class="hidden text-xs ml-2"></span>
  </div>`;
}
async function saveLeadRouting(btn) {
  const mode = document.querySelector('input[name="lr-mode"]:checked')?.value || 'targeted';
  const body = { mode, notify_reps: document.getElementById('lr-notify-reps')?.checked, notify_managers: document.getElementById('lr-notify-mgrs')?.checked, notify_all_sales: document.getElementById('lr-notify-all-sales')?.checked };
  const msg = document.getElementById('lr-msg'); btn.disabled = true;
  try { await apiSendJson('/leads/routing', 'PUT', body); if (msg) { msg.textContent = '✓ Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); } }
  catch (e) { if (msg) { msg.textContent = e.message; msg.className = 'text-xs ml-2 text-red-500'; msg.classList.remove('hidden'); } }
  finally { btn.disabled = false; }
}
window.saveLeadRouting = saveLeadRouting;

async function loadGuardrailSettings() {
  try {
    const r = await fetch(`${API}/posting/guardrail`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return;
    const g = await r.json();
    const en = document.getElementById('gr-enabled');
    const cap = document.getElementById('gr-cap');
    const sp = document.getElementById('gr-spacing');
    const burst = document.getElementById('gr-burst');
    if (en) en.checked = g.enabled !== false;
    if (cap) cap.value = g.daily_cap ?? 25;
    if (sp) sp.value = g.min_spacing_minutes ?? 2;
    if (burst) burst.value = g.burst_size ?? 5;
  } catch {}
  const btn = document.getElementById('gr-save');
  if (btn && !btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', async () => {
      const msg = document.getElementById('gr-msg');
      btn.disabled = true;
      try {
        const r = await fetch(`${API}/posting/guardrail-settings`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: document.getElementById('gr-enabled').checked,
            daily_cap: Number(document.getElementById('gr-cap').value),
            min_spacing_minutes: Number(document.getElementById('gr-spacing').value),
            burst_size: Number(document.getElementById('gr-burst').value),
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Failed');
        msg.textContent = '✓ Saved'; msg.className = 'text-xs mt-2 text-emerald-600 dark:text-emerald-400';
      } catch (e) { msg.textContent = e.message; msg.className = 'text-xs mt-2 text-red-500'; }
      finally { msg.classList.remove('hidden'); btn.disabled = false; }
    });
  }
}

async function setRepRole(id, name, to) {
  const label = to === 'MANAGER' ? 'manager' : 'sales rep';
  if (!confirm(`Change ${name} to ${label}? ${to === 'MANAGER' ? 'Managers get full dealer access for this store and can manage reps.' : ''}`)) return;
  try {
    const res = await fetch(`${API}/admin/users/${id}/role`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: to }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Role change failed');
    showInviteResult(`${name} is now a ${label}.`, 'ok');
    loadDealerManagementMatrix();
  } catch (err) {
    showInviteResult(err.message, 'err');
  }
}

async function removeRep(id, name) {
  if (!confirm(`Remove ${name} from your dealership? Their account will be deleted.`)) return;
  try {
    const res = await fetch(`${API}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Remove failed');
    showInviteResult(`Removed ${name}.`, 'ok');
    loadDealerManagementMatrix();
  } catch (err) {
    showInviteResult(err.message, 'err');
  }
}

async function inviteRep(payload) {
  const res = await fetch(`${API}/admin/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invite failed');
  return data;
}

async function openRepDetail(repId) {
  const modal = document.getElementById('rep-detail-modal');
  modal.classList.remove('hidden');
  // Reset to loading state
  document.getElementById('rep-detail-name').textContent = 'Loading...';
  document.getElementById('rep-detail-email').textContent = '';
  document.getElementById('rep-detail-meta').textContent = '';
  ['total', 'active', 'sold', 'deleted'].forEach(k =>
    document.getElementById(`rep-detail-${k}`).textContent = '—'
  );
  document.getElementById('rep-detail-recent').innerHTML = '<div class="text-xs text-slate-500 italic">Loading...</div>';

  try {
    const res = await fetch(`${API}/dealership/team/${repId}/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to load rep stats');
    }
    const data = await res.json();
    document.getElementById('rep-detail-name').textContent = data.profile.full_name || '(no name)';
    document.getElementById('rep-detail-email').textContent = data.profile.email || '';
    const joined = data.profile.joined_at ? new Date(data.profile.joined_at).toLocaleDateString() : '—';
    document.getElementById('rep-detail-meta').textContent = `${data.profile.role} · joined ${joined}`;
    document.getElementById('rep-detail-total').textContent = data.totals.total;
    document.getElementById('rep-detail-active').textContent = data.totals.active;
    document.getElementById('rep-detail-sold').textContent = data.totals.sold;
    document.getElementById('rep-detail-deleted').textContent = data.totals.deleted;

    // Player card — tier / points / progress (same scoring as the old Insights cards).
    const listings = Number(data.totals.total) || 0;
    const sold = Number(data.totals.sold) || 0;
    const points = listings * 100 + sold * 500;
    const tier = tierFor(points);
    const next = nextTierFor(points);
    const pct = next ? Math.min(100, Math.round(((points - tier.min) / (next.min - tier.min)) * 100)) : 100;
    const conv = listings > 0 ? Math.round((sold / listings) * 100) : 0;
    const tierEl = document.getElementById('rep-detail-tier');
    if (tierEl) {
      tierEl.className = `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${tier.cls}`;
      tierEl.innerHTML = `<span>${tier.icon}</span><span>${tier.name}</span>`;
    }
    const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    set('rep-detail-points', `${points.toLocaleString()} pts`);
    set('rep-detail-conv', `${conv}% conversion`);
    const bar = document.getElementById('rep-detail-progress');
    if (bar) bar.style.width = `${pct}%`;
    set('rep-detail-next', next ? `${(next.min - points).toLocaleString()} pts to ${next.name}` : 'Top tier');

    renderRecentListings('rep-detail-recent', data.recent);
  } catch (err) {
    document.getElementById('rep-detail-recent').innerHTML = `<div class="text-xs text-red-400">${err.message}</div>`;
  }
}

function closeRepDetail() {
  document.getElementById('rep-detail-modal').classList.add('hidden');
}

function showInviteResult(text, kind) {
  const el = document.getElementById('invite-result');
  el.innerHTML = text;
  el.className = kind === 'ok'
    ? 'mb-3 p-2 text-xs rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200'
    : 'mb-3 p-2 text-xs rounded bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200';
  el.classList.remove('hidden');
}

// SALES DOMAIN: Real personal stats from /me/stats
// Fetch ALL listings (not just the truncated "recent" set from /me/stats) filtered
// by status. Reuses the same renderRecentListings() renderer.
async function loadMyListingsFiltered(status) {
  // Update active-tab styling
  ['posted', 'sold', 'all'].forEach(s => {
    const btn = document.getElementById(`rep-listings-filter-${s}`);
    if (!btn) return;
    if (s === status) {
      btn.className = 'text-xs px-2 py-1 rounded border border-indigo-600 bg-indigo-600 text-white';
    } else {
      btn.className = 'text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400';
    }
  });

  const el = document.getElementById('rep-recent-list');
  el.innerHTML = '<div class="text-xs text-slate-500 italic">Loading...</div>';
  try {
    const res = await fetch(`${API}/listings?status=${status}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load listings');
    const data = await res.json();
    renderRecentListings('rep-recent-list', data, { canEditUrl: true });
  } catch (e) {
    el.innerHTML = `<div class="text-xs text-red-400">${e.message}</div>`;
  }
}
async function loadMyStats() {
  try {
    const res = await fetch(`${API}/me/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    document.getElementById('rep-stat-total').textContent = data.totals.total;
    document.getElementById('rep-stat-active').textContent = data.totals.active;
    document.getElementById('rep-stat-sold').textContent = data.totals.sold;
    document.getElementById('rep-stat-deleted').textContent = data.totals.deleted;
    renderRecentListings('rep-recent-list', data.recent, { canEditUrl: true });
  } catch (e) {
    document.getElementById('rep-recent-list').innerHTML = `<div class="text-xs text-red-400">${e.message}</div>`;
  }
  loadMyCharts();
}

// Personal insight charts for solo reps / dealer reps (mirrors the dealer charts).
let __myTrendChart = null, __myStatusChart = null;
async function loadMyCharts() {
  const trendCtx = document.getElementById('chart-my-trend');
  if (!trendCtx || typeof Chart === 'undefined') return;
  let data;
  try {
    const res = await fetch(`${API}/me/charts?range=${insightsRange}`, { headers: { 'Authorization': `Bearer ${token}` } });
    data = res.ok ? await res.json() : null;
  } catch { data = null; }
  if (!data) return;

  const trend = data.trend || [];
  if (__myTrendChart) __myTrendChart.destroy();
  __myTrendChart = new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: trend.map(d => data.monthly ? d.date : d.date.slice(5)),
      datasets: [
        { label: 'Posted', data: trend.map(d => d.posted), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.15)', fill: true, tension: 0.3, pointRadius: 2 },
        { label: 'Sold', data: trend.map(d => d.sold), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', fill: true, tension: 0.3, pointRadius: 2 }
      ]
    },
    options: { ...chartCommonOptions(), plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 10 } } } } }
  });

  const statusCtx = document.getElementById('chart-my-status');
  if (statusCtx) {
    const b = data.breakdown || { active: 0, sold: 0, deleted: 0 };
    if (__myStatusChart) __myStatusChart.destroy();
    __myStatusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Sold', 'Removed'],
        datasets: [{ data: [b.active, b.sold, b.deleted], backgroundColor: ['#6366f1', '#10b981', '#94a3b8'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 }, color: window.matchMedia('(prefers-color-scheme: dark)').matches ? '#94a3b8' : '#64748b' } } } }
    });
  }
}

// LEADERBOARD: gamified tier system + podium + activity feed
const LB_TIERS = [
  { name: 'Bronze',   min: 0,     icon: svgIcon('star', 'w-3.5 h-3.5 inline-block align-text-bottom text-orange-500'), cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' },
  { name: 'Silver',   min: 500,   icon: svgIcon('star', 'w-3.5 h-3.5 inline-block align-text-bottom text-slate-400'), cls: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600' },
  { name: 'Gold',     min: 2500,  icon: svgIcon('trophy', 'w-3.5 h-3.5 inline-block align-text-bottom text-amber-500'), cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
  { name: 'Platinum', min: 7500,  icon: svgIcon('gem', 'w-3.5 h-3.5 inline-block align-text-bottom text-cyan-500'), cls: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700' },
  { name: 'Diamond',  min: 15000, icon: svgIcon('gem', 'w-3.5 h-3.5 inline-block align-text-bottom text-indigo-500'), cls: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
  { name: 'Legend',   min: 30000, icon: svgIcon('flame', 'w-3.5 h-3.5 inline-block align-text-bottom text-red-500'), cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' }
];

// Shared leaderboard legend — "How you earn points" + "The Six Tiers". Rendered
// into both the team and global boards so the scoring rules are always visible.
const TIER_DOT = { Bronze: '#b45309', Silver: '#94a3b8', Gold: '#f59e0b', Platinum: '#22d3ee', Diamond: '#a78bfa', Legend: '#7c6cf6' };
function leaderboardLegendHTML() {
  const rules = [
    { label: 'Close a deal (sold / F&amp;I / delivered)', pts: '+500', cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Complete a trade appraisal', pts: '+50', cls: 'text-amber-600 dark:text-amber-400' },
    { label: 'Post a car to Facebook Marketplace', pts: '+100', cls: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Sell a car you posted ("I Sold It")', pts: '+500', cls: 'text-emerald-600 dark:text-emerald-400' }
  ];
  const ruleRows = rules.map((r, i) => `
    <div class="flex items-center justify-between py-3 ${i < rules.length - 1 ? 'border-b border-slate-100 dark:border-slate-800/60' : ''}">
      <span class="text-sm text-slate-700 dark:text-slate-300">${r.label}</span>
      <span class="font-bold ${r.cls}">${r.pts}</span>
    </div>`).join('');
  const tierRows = LB_TIERS.map(t => {
    const isLegend = t.name === 'Legend';
    const marker = isLegend
      ? `<span class="text-indigo-500">${svgIcon('trophy', 'w-3.5 h-3.5')}</span>`
      : `<span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${TIER_DOT[t.name] || '#94a3b8'}"></span>`;
    return `
      <div class="flex items-center justify-between px-3 py-2.5 rounded-lg ${isLegend ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800' : 'bg-slate-50 dark:bg-slate-950/60'}">
        <span class="flex items-center gap-2.5 ${isLegend ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}">${marker}${t.name}</span>
        <span class="text-sm font-medium ${isLegend ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}">${t.min.toLocaleString()} pts</span>
      </div>`;
  }).join('');
  return `
    <div class="lb-legend grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
      <div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">How you earn points</h3>
        <div>${ruleRows}</div>
        <p class="text-xs italic text-slate-400 mt-3">It pays to be the one who closes the deal.</p>
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-3">The Six Tiers</h3>
        <div class="space-y-1.5">${tierRows}</div>
      </div>
    </div>`;
}
// Append the legend to a board panel once (idempotent).
function ensureLeaderboardLegend(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel || panel.querySelector('.lb-legend')) return;
  panel.insertAdjacentHTML('beforeend', leaderboardLegendHTML());
}

function facebookLeaderboardActive() {
  return __fbOnly || /facebook/.test(document.documentElement.getAttribute('data-product') || '');
}

// Facebook tiers are deliberately scored only from Marketplace activity. The full
// DealerOS leaderboard still includes its sales and appraisal incentives.
const calcPoints = (m) => (m.total_listings || 0) * 100 + (m.sold_listings || 0) * 500
  + (facebookLeaderboardActive() ? 0 : (m.deals_closed || 0) * 500 + (m.appraisals || 0) * 50);

function applyLeaderboardProductPresentation() {
  const facebook = facebookLeaderboardActive();
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('lb-title', facebook ? '🏆 Facebook Posting Leaderboard' : '🏆 Leaderboard');
  set('lb-subtitle', facebook
    ? '100 pts per Facebook post · 500 pts per Facebook sale · Build your posting streak and lead the board.'
    : '500 pts / deal · 50 pts / appraisal · 100 pts / listing · Climb the tiers, top the team.');
  set('lb-conv-label', facebook ? 'Facebook Conversion' : 'Team Conversion');
  set('lb-rankings-title', facebook ? 'Facebook posting rankings' : 'Full rankings');
  set('lb-tab-global', facebook ? '🌎 Facebook Community' : '🌎 Global');
  set('gl-subtitle', facebook
    ? 'How your Facebook posting stacks up across MarketSync. Other accounts are anonymized.'
    : 'How you stack up across every dealer & rep on MarketSync. Others are anonymized — only you see your name.');
  set('gl-posted-label', facebook ? 'Your Facebook Posts' : 'Your Listings');
}

function leaderboardRanking(rows) {
  let ranking = (rows || []).map(r => {
    const points = calcPoints(r);
    return { ...r, points, tier: tierFor(points) };
  });
  // The standard endpoint also powers DealerOS, so it returns its richer all-sales
  // rank. Re-rank only the Facebook experience from Facebook posts and FB sales.
  if (facebookLeaderboardActive()) {
    ranking = ranking
      .sort((a, b) => b.points - a.points || b.sold_listings - a.sold_listings || b.total_listings - a.total_listings || String(a.name || '').localeCompare(String(b.name || '')))
      .map((r, index) => ({ ...r, rank: index + 1 }));
  }
  return ranking;
}
const tierFor = (points) => {
  let current = LB_TIERS[0];
  for (const t of LB_TIERS) if (points >= t.min) current = t;
  return current;
};
const nextTierFor = (points) => LB_TIERS.find(t => t.min > points) || null;

async function loadLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;
  applyLeaderboardProductPresentation();
  body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500 italic">Loading leaderboard...</td></tr>`;
  try {
    const res = await fetch(`${API}/dealership/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Leaderboard failed');
    const data = await res.json();

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('lb-conv', data.team_conversion_rate ?? 0);
    setText('lb-team-sold', data.team_total_sold ?? 0);
    setText('lb-team-total', data.team_total_listings ?? 0);

    const ranking = leaderboardRanking(data.ranking);

    renderPodium(ranking);
    renderYourPosition(ranking);
    renderRankingTable(ranking);
    updateTierChip(ranking);
    loadActivity();
    loadAchievements();
  } catch (e) {
    console.warn('Leaderboard failed:', e.message);
    body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 italic">Failed to load leaderboard.</td></tr>`;
  }
}

// ── Internal sales-performance board (Dashboard) ─────────────────────────────
// The SECOND, internal leaderboard: ranks reps by REAL deals — units sold, F&I
// gross, and appraisals. No Facebook-posting points (that competitive/teaser
// board lives under Marketing). Rendered into the dashboard's leaderboard slot.
async function loadInternalBoard() {
  const slot = document.getElementById('dash-leaderboard-slot');
  if (!slot) return;
  slot.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6"><div class="text-center text-sm text-slate-400 italic py-8">Loading sales performance…</div></div>`;
  let data;
  try {
    const res = await fetch(`${API}/dealership/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('failed');
    data = await res.json();
  } catch { slot.innerHTML = ''; return; }
  const soldOf = (r) => (r.units_sold || r.deals_closed || 0);
  const scoreOf = (r) => soldOf(r) * 500 + (r.appraisals || 0) * 50 + Math.round((r.fni_gross || 0) / 100);
  const ranking = (data.ranking || []).slice()
    .map(r => ({ ...r, _sold: soldOf(r), _score: scoreOf(r) }))
    .sort((a, b) => b._score - a._score || b._sold - a._sold || (b.fni_gross || 0) - (a.fni_gross || 0) || String(a.name || '').localeCompare(String(b.name || '')))
    .map((r, i) => ({ ...r, _rank: i + 1 }));
  const money = (n) => '$' + Number(n || 0).toLocaleString();
  const stat = (label, val) => `<div class="flex-1 min-w-[110px]"><div class="text-2xl font-black text-slate-900 dark:text-white tabular-nums">${val}</div><div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${label}</div></div>`;
  const medal = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `<span class="text-slate-400 font-mono">${rank}</span>`;
  const selfId = (typeof user !== 'undefined' && user) ? user.id : null;
  const rows = ranking.length ? ranking.map(r => {
    const me = r.id === selfId;
    return `<tr class="border-b border-slate-100 dark:border-slate-800/60 ${me ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}">
      <td class="py-2.5 px-3 text-center w-12">${medal(r._rank)}</td>
      <td class="py-2.5 px-3"><span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${esc(r.name || '—')}</span>${me ? '<span class="ml-1.5 text-[10px] font-bold text-indigo-500">YOU</span>' : ''}</td>
      <td class="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-white">${r._sold}</td>
      <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${money(r.fni_gross)}</td>
      <td class="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-200">${r.appraisals || 0}</td>
      <td class="py-2.5 px-3 text-right tabular-nums font-bold text-indigo-600 dark:text-indigo-400">${r._score.toLocaleString()}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6" class="py-10 text-center text-sm text-slate-400 italic">No sales activity yet.</td></tr>';
  slot.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="flex items-start justify-between gap-3 flex-wrap px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2"><span class="text-amber-500">${svgIcon('trophy', 'w-5 h-5')}</span><h3 class="text-base font-black text-slate-900 dark:text-white">Sales performance</h3></div>
          <p class="text-xs text-slate-400 mt-0.5">Real deals — units sold, F&amp;I gross, and appraisals.</p>
        </div>
        <button onclick="switchPage('leaderboard')" class="text-xs font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 whitespace-nowrap">Full leaderboard →</button>
      </div>
      <div class="flex flex-wrap gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-800/60">
        ${stat('Units sold', data.team_total_units ?? 0)}
        ${stat('F&amp;I gross', money(data.team_total_fni_gross))}
        ${stat('Appraisals', data.team_total_appraisals ?? 0)}
      </div>
      <div class="overflow-x-auto"><table class="w-full text-left min-w-[520px]">
        <thead><tr class="text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-slate-800">
          <th class="py-2.5 px-3 text-center w-12">#</th><th class="py-2.5 px-3">Rep</th><th class="py-2.5 px-3 text-right">Sold</th><th class="py-2.5 px-3 text-right">F&amp;I gross</th><th class="py-2.5 px-3 text-right">Appraisals</th><th class="py-2.5 px-3 text-right">Score</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
}
window.loadInternalBoard = loadInternalBoard;

// ── Badges everywhere: the always-on header rank/tier chip ────────────────────
// Reflects the signed-in rep's live tier + rank on every page. Fed from a ranking
// array when the leaderboard is open (free), or self-fetched once at startup.
function updateTierChip(ranking) {
  const chip = document.getElementById('ui-tier-chip');
  if (!chip) return;
  const me = (ranking || []).find(r => r.id === user.id);
  if (!me || !me.tier) { chip.classList.add('hidden'); return; }
  // Hidden on the crowded mobile header; shows from sm up (badges live on the
  // leaderboard for phones). Icon-only until md, full tier + rank on md+.
  chip.className = `hidden sm:inline-flex items-center gap-1.5 px-2 md:px-2.5 py-1 rounded-full text-xs font-bold border transition hover:brightness-110 whitespace-nowrap ${me.tier.cls}`;
  const rankTxt = me.rank ? `#${me.rank}` : '';
  chip.innerHTML = `<span>${me.tier.icon}</span><span class="hidden md:inline">${me.tier.name}</span>${rankTxt ? `<span class="opacity-70 font-mono">${rankTxt}</span>` : ''}`;
}
async function loadMyTierChip() {
  const chip = document.getElementById('ui-tier-chip');
  if (!chip) return;
  try {
    const res = await fetch(`${API}/dealership/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    const ranking = leaderboardRanking(data.ranking);
    updateTierChip(ranking);
  } catch (e) { /* non-fatal — chip just stays hidden */ }
}

// ── Achievements (gamification badges) ───────────────────────────────────────
async function loadAchievements() {
  const wrap = document.getElementById('lb-achievements');
  if (!wrap) return;
  try {
    const res = await fetch(`${API}/gamification`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('gamification failed');
    const d = await res.json();
    if (!d.me && !d.dealership) { wrap.innerHTML = ''; return; }
    const facebook = facebookLeaderboardActive();
    const facebookBadge = (badge) => {
      if (!facebook) return badge;
      if (badge.key === 'closer') return { ...badge, label: 'Facebook Closer', description: 'Cars you sold through Facebook Marketplace' };
      return badge;
    };
    const onlyFacebook = (badges) => (badges || [])
      .filter(b => !facebook || ['closer', 'mover', 'speed', 'coverage', 'fastlot', 'sellthrough'].includes(b.key))
      .map(facebookBadge);
    wrap.innerHTML = `
      ${d.me ? `<div class="mb-4">
        <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-2">${facebook ? 'Your Facebook achievements' : 'Your achievements'}</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${onlyFacebook(d.me.badges).map(badgeCard).join('')}</div>
      </div>` : ''}
      ${d.dealership ? `<div>
        <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-2">${esc(d.dealership.name || 'Dealership')} ${facebook ? 'Facebook achievements' : 'achievements'}</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${onlyFacebook(d.dealership.badges).map(badgeCard).join('')}</div>
      </div>` : ''}`;
  } catch (e) {
    console.warn('Achievements failed:', e.message);
    wrap.innerHTML = '';
  }
}

// Roman-numeral tier tag for a badge level (I / II / III). Grey when locked.
function badgeCard(b) {
  const tiers = ['', 'I', 'II', 'III', 'IV', 'V'];
  const earned = (b.level || 0) > 0;
  const roman = tiers[b.level] || (b.level ? String(b.level) : '');
  const valLabel = b.unit === '%' ? `${b.value}%`
    : b.unit === 'h' ? (b.value != null ? `${b.value}h` : '—')
    : `${b.value}${b.unit ? ' ' + b.unit : ''}`;
  // Progress line: cumulative badges show a bar to next; descending/maxed show a note.
  const next = b.next;
  const progress = (b.progress_pct != null && next != null)
    ? `<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
         <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style="width:${b.progress_pct}%"></div>
       </div>
       <div class="text-[10px] text-slate-400 mt-1">${next}${b.unit === '%' ? '%' : ''} for next tier</div>`
    : (next == null
        ? `<div class="text-[10px] font-bold text-amber-500 mt-2">★ Max tier reached</div>`
        : `<div class="text-[10px] text-slate-400 mt-2">Reach ${next}${b.unit === 'h' ? 'h or less' : ''} to unlock</div>`);
  return `
    <div class="rounded-xl border p-3 ${earned
      ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800'
      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'}">
      <div class="flex items-start justify-between gap-2">
        <div class="text-2xl leading-none ${earned ? '' : 'opacity-30 grayscale'}">${b.icon || '🏅'}</div>
        ${earned ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">TIER ${roman}</span>`
          : `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-400">LOCKED</span>`}
      </div>
      <div class="text-sm font-bold text-slate-900 dark:text-white mt-1.5 leading-tight">${esc(b.label)}</div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">${esc(b.description || '')}</div>
      <div class="text-lg font-black text-slate-900 dark:text-white mt-1.5 tabular-nums">${valLabel}</div>
      ${progress}
    </div>`;
}

function renderPodium(ranking) {
  const el = document.getElementById('lb-podium');
  if (!el) return;
  if (!ranking.length) {
    el.innerHTML = '<div class="text-center text-xs text-slate-500 italic col-span-3 py-6">No team members yet.</div>';
    return;
  }

  // Visual order: 2nd · 1st · 3rd (1st is centered and tallest).
  // Always render all 3 slots — empty slots become placeholders.
  const positions = [
    { m: ranking[1], rankNum: 2, height: 'h-24', bar: 'from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500', crown: `<span class="text-slate-400">${svgIcon('star', 'w-6 h-6')}</span>` },
    { m: ranking[0], rankNum: 1, height: 'h-32', bar: 'from-amber-300 to-amber-500',                                       crown: `<span class="text-amber-500">${svgIcon('trophy', 'w-7 h-7')}</span>` },
    { m: ranking[2], rankNum: 3, height: 'h-20', bar: 'from-orange-300 to-orange-500',                                     crown: `<span class="text-orange-400">${svgIcon('star', 'w-6 h-6')}</span>` }
  ];

  el.innerHTML = positions.map(p => {
    if (!p.m) {
      return `
        <div class="flex flex-col items-center text-center opacity-40">
          <div class="mb-1 flex items-center justify-center h-8">${p.crown}</div>
          <div class="font-bold text-sm text-slate-400 italic w-full">Open</div>
          <div class="text-xs text-slate-400 mt-1 mb-2">—</div>
          <div class="w-full mt-2 rounded-t-lg bg-slate-200 dark:bg-slate-800 ${p.height} flex items-start justify-center pt-2 text-slate-400 font-black text-xl">${p.rankNum}</div>
        </div>
      `;
    }
    const isMe = p.m.id === user.id;
    return `
      <div class="flex flex-col items-center text-center">
        <div class="mb-1 flex items-center justify-center h-8">${p.crown}</div>
        <div class="font-bold text-sm text-slate-900 dark:text-white truncate w-full">${p.m.name}${isMe ? ' <span class="text-xs text-indigo-600 dark:text-indigo-400">(you)</span>' : ''}</div>
        <div class="inline-flex items-center gap-1 mt-1 mb-2 px-2 py-0.5 rounded-full text-xs font-bold border ${p.m.tier.cls}">
          <span>${p.m.tier.icon}</span><span>${p.m.tier.name}</span>
        </div>
        <div class="text-xs font-mono text-slate-600 dark:text-slate-300">${p.m.points.toLocaleString()} pts</div>
        <div class="w-full mt-2 rounded-t-lg bg-gradient-to-b ${p.bar} ${p.height} flex items-start justify-center pt-2 text-white font-black text-xl shadow-inner">
          ${p.rankNum}
        </div>
      </div>
    `;
  }).join('');
}
