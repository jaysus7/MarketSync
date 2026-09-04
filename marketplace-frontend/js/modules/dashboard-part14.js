/* dashboard.js split part 14/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function syncParsedPlanToAllEngines() {
  const plan = __activeSynthesizedPlan || parseCommissionDocumentText(SAMPLE_COMMISSION_DOC_1);
  localStorage.setItem('ms_active_commission_plan', JSON.stringify(plan));

  crmOverlay(`
    <div class="p-6 space-y-5 text-center">
      <div class="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl shadow-inner animate-pulse"></div>
      <div>
        <h3 class="text-xl font-black text-slate-900 dark:text-white">Synced Across All MarketSync Engines!</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">"${esc(plan.plan_name)}" rules have been written live into all store operational engines.</p>
      </div>

      <div class="grid grid-cols-2 gap-3 text-left text-xs">
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400"> Deal Desk Engine</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Calculates packs, gross tiers, EV minimums &amp; F&amp;I spiffs on every deal.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400"> HR &amp; Compliance Engine</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Tracks training deadlines, CSI scores &amp; process penalties on rep profiles.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400"> Accounting Payroll Ledger</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Feeds gross commissions, volume bonuses, Christmas holdbacks &amp; draws.</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="font-bold text-emerald-600 dark:text-emerald-400"> Store Settings</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Saved as primary active commission plan template.</div>
        </div>
      </div>

      <button onclick="this.closest('.fixed').remove(); commLoadAIImporter();" class="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition">
        Done &amp; View Active Engine Plan
      </button>
    </div>
  `, 'max-w-md');

  showToast('Commission Plan Synced Across All Engines! ', 'success');
}

window.commLoadAIImporter = commLoadAIImporter;
window.aiHandleDocFileUpload = aiHandleDocFileUpload;
window.aiLoadPresetDoc = aiLoadPresetDoc;
window.aiProcessCommissionDocument = aiProcessCommissionDocument;
window.syncParsedPlanToAllEngines = syncParsedPlanToAllEngines;

// ── Canonical reporting library ──────────────────────────────────────────────
// One catalogue powers All Reports, every department view, every individual
// report URL, Report Lab, and Intelligence. The older operational endpoints are
// retained below for exports/backwards compatibility, but no longer form a
// second report navigation system.
const REPORT_DEPARTMENTS = [
  ['all', 'All reports'], ['executive', 'Executive'], ['sales', 'Sales'],
  ['inventory', 'Inventory'], ['crm', 'CRM'], ['marketing', 'Marketing'],
  ['website', 'Website'], ['fni', 'F&I'], ['service', 'Service'],
  ['parts', 'Parts'], ['accounting', 'Accounting'], ['people', 'People'],
  ['customers', 'Customers'], ['communications', 'Communications'],
  ['automations', 'Automations & AI']
];
const REPORT_DEPT_FROM_LEGACY = {
  overview: 'all', sales: 'sales', fni: 'fni', leads: 'crm', reps: 'people',
  appraisals: 'inventory', appointments: 'service', service: 'service',
  esign: 'fni', marketing: 'marketing', activity: 'crm', customers: 'customers'
};
let __reportingDept = 'all';
let __reportingSearch = '';
let __reportingRequest = 0;
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
function reportDeptLabel(id) { return REPORT_DEPARTMENTS.find(d => d[0] === id)?.[1] || rptLabel(id); }
function reportingSetUrl({ reportId = null, department = null } = {}) {
  try {
    const url = new URL(location.href);
    if (reportId) url.searchParams.set('report', reportId); else url.searchParams.delete('report');
    if (department && department !== 'all') url.searchParams.set('report_department', department); else url.searchParams.delete('report_department');
    history.replaceState({ ...(history.state || {}), msPage: 'reports' }, '', url.pathname + (url.search ? url.search : '') + (url.hash || '#/p/reports'));
  } catch {}
}
function renderReportTabs() {
  const host = document.getElementById('reports-tabs'); if (!host) return;
  host.className = 'flex gap-1.5 overflow-x-auto pb-2 -mb-2';
  host.innerHTML = REPORT_DEPARTMENTS.map(([id, label]) => `<button type="button" onclick="reportingSelectDepartment('${id}')" class="whitespace-nowrap px-3 py-2 text-xs font-bold rounded-xl border transition ${__reportingDept === id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400'}">${esc(label)}</button>`).join('');
}
function reportsTab(key) {
  reportingSelectDepartment(REPORT_DEPT_FROM_LEGACY[key] || key || 'all');
}
function rptRange(v) { __rptRange = v; loadDeepReport(__rptTab); }
window.reportsTab = reportsTab;
window.rptRange = rptRange;

function reportingFormatValue(group) {
  if (!group || group.value == null) return '—';
  if (group.unit === 'money') return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(group.value);
  if (group.unit === 'percent') return `${group.value}%`;
  return Number.isFinite(Number(group.value)) ? Number(group.value).toLocaleString() : esc(String(group.value));
}
function reportingResultHtml(result) {
  const groups = result?.groups || [];
  if (!groups.length) return '<div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">No records were found in this report window.</div>';
  if (groups.length === 1 && !Object.keys(groups[0].dimensions || {}).length) {
    const group = groups[0];
    return `<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"><div class="text-4xl font-black text-slate-950 dark:text-white tabular-nums">${reportingFormatValue(group)}</div><div class="mt-2 text-xs text-slate-500 dark:text-slate-400">${group.available === false ? esc(group.note || 'Required source data is not recorded yet.') : `${Number(group.sample_size || 0).toLocaleString()} source records`}</div></div>`;
  }
  const dims = [...new Set(groups.flatMap(g => Object.keys(g.dimensions || {})))];
  return `<div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"><table class="w-full min-w-[520px] text-sm"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">${dims.map(d => `<th class="px-4 py-3">${esc(rptLabel(d))}</th>`).join('')}<th class="px-4 py-3 text-right">Value</th><th class="px-4 py-3 text-right">Sample</th></tr></thead><tbody>${groups.slice(0, 250).map(g => `<tr class="border-b border-slate-100 dark:border-slate-800/70">${dims.map(d => `<td class="px-4 py-3 text-slate-700 dark:text-slate-200">${esc(g.dimensions?.[d] ?? '—')}</td>`).join('')}<td class="px-4 py-3 text-right font-bold text-slate-950 dark:text-white">${reportingFormatValue(g)}</td><td class="px-4 py-3 text-right text-slate-500">${Number(g.sample_size || 0).toLocaleString()}</td></tr>`).join('')}</tbody></table></div>`;
}
function reportingSourcesHtml(status = {}) {
  const entries = Object.entries(status);
  if (!entries.length) return '';
  return `<div class="flex flex-wrap gap-2 mt-4">${entries.map(([source, s]) => `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${s.available ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}">${esc(rptLabel(source))}: ${s.available ? `${Number(s.rows || 0).toLocaleString()} live rows` : 'not recorded'}</span>`).join('')}</div>`;
}
async function openSemanticReport(id, options = {}) {
  if (!id) return;
  const host = document.getElementById('reports-dynamic'); if (!host) return;
  if (!options.keepUrl) reportingSetUrl({ reportId: id, department: __reportingDept });
  host.innerHTML = '<div class="py-20 text-center text-sm text-slate-400">Running report against live dealership data…</div>';
  try {
    const data = await apiSendJson(`/reporting/reports/${encodeURIComponent(id)}/run`, 'POST', {});
    const report = data.report || {};
    host.innerHTML = `<div class="space-y-5">
      <div class="flex items-start justify-between gap-4 flex-wrap"><div class="min-w-0"><button type="button" onclick="closeSemanticReport()" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">← ${esc(reportDeptLabel(report.department))} reports</button><h2 class="mt-2 text-2xl font-black text-slate-950 dark:text-white">${esc(report.name || id)}</h2><p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">${esc(report.description || '')}</p></div><button type="button" onclick="navigator.clipboard?.writeText(location.href);showToast('Report link copied','success')" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">Copy link</button></div>
      <div class="flex flex-wrap gap-2 text-xs"><span class="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">${esc((report.metric_ids || []).map(rptLabel).join(', '))}</span><span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${esc((report.default_dimensions || []).map(rptLabel).join(' × ') || 'Store total')}</span><span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Last ${Number(data.plan?.date_range?.days || report.date_range?.days || 30)} days</span></div>
      ${(data.results || []).map(result => `<section class="space-y-3"><div><div class="text-sm font-black text-slate-900 dark:text-white">${esc(rptLabel(result.metric_id))}</div><div class="text-xs text-slate-400 font-mono mt-0.5">${esc(result.formula || '')}</div></div>${reportingResultHtml(result)}</section>`).join('')}
      ${reportingSourcesHtml(data.source_status)}
      <p class="text-xs text-slate-400">Results are aggregated on the server and tenant-scoped to this dealership. Missing source fields are shown as unavailable—not as zero.</p>
    </div>`;
  } catch (error) {
    host.innerHTML = `<div class="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-5"><button type="button" onclick="closeSemanticReport()" class="text-xs font-bold text-rose-700 dark:text-rose-300">← Back to reports</button><p class="mt-3 text-sm text-rose-700 dark:text-rose-300">${esc(error.message || 'Could not run this report.')}</p></div>`;
  }
}
window.openSemanticReport = openSemanticReport;

function closeSemanticReport() {
  reportingSetUrl({ department: __reportingDept });
  loadReportLibraryPage();
}
window.closeSemanticReport = closeSemanticReport;

async function loadReportLibraryPage() {
  const host = document.getElementById('reports-dynamic'); if (!host) return;
  document.getElementById('reports-overview')?.classList.add('hidden');
  host.classList.remove('hidden');
  renderReportTabs();
  const requestId = ++__reportingRequest;
  host.innerHTML = '<div class="py-20 text-center text-sm text-slate-400">Loading the report catalogue…</div>';
  try {
    const qs = new URLSearchParams();
    if (__reportingDept !== 'all') qs.set('department', __reportingDept);
    if (__reportingSearch) qs.set('search', __reportingSearch);
    const data = await apiGetJson(`/reporting/reports${qs.toString() ? '?' + qs : ''}`, { retries: 1 });
    if (requestId !== __reportingRequest) return;
    const reports = data.reports || [];
    host.innerHTML = `<div class="space-y-5"><div class="flex items-center justify-between gap-3 flex-wrap"><div><h2 class="text-xl font-black text-slate-950 dark:text-white">${esc(reportDeptLabel(__reportingDept))}</h2><p class="text-sm text-slate-500 dark:text-slate-400">${Number(data.count || 0).toLocaleString()} specific reports with their own live view.</p></div><a href="/report-lab.html" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Build a custom report</a></div>
      <label class="relative block"><span class="sr-only">Search reports</span><input id="report-library-search" value="${esc(__reportingSearch)}" placeholder="Search by report, metric, department, model, salesperson…" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></label>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">${reports.slice(0, 120).map(report => `<a href="${esc(report.canonical_url || `/dashboard.html?report=${encodeURIComponent(report.id)}#/p/reports`)}" onclick="event.preventDefault();openSemanticReport('${esc(report.id)}')" class="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition"><div class="flex items-start justify-between gap-3"><span class="text-[10px] uppercase tracking-wider font-black text-indigo-600 dark:text-indigo-400">${esc(reportDeptLabel(report.department))}</span><span class="text-[10px] text-slate-400">${esc(rptLabel(report.visualization || 'table'))}</span></div><h3 class="mt-2 text-sm font-black leading-snug text-slate-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">${esc(report.name)}</h3><p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">${esc(report.description || '')}</p><div class="mt-3 text-[11px] text-slate-400">${esc((report.default_dimensions || []).map(rptLabel).join(' × ') || 'Store total')}</div></a>`).join('')}</div>
      ${reports.length > 120 ? `<p class="text-center text-xs text-slate-400">Showing 120 of ${reports.length.toLocaleString()}. Search to narrow the list.</p>` : ''}
      ${!reports.length ? '<div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-500">No reports match that search.</div>' : ''}</div>`;
    const input = document.getElementById('report-library-search');
    let timer;
    input?.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { __reportingSearch = input.value.trim(); loadReportLibraryPage(); }, 250); });
  } catch (error) {
    host.innerHTML = `<div class="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-5 text-sm text-rose-700 dark:text-rose-300">${esc(error.message || 'Could not load reports.')}</div>`;
  }
}

function reportingSelectDepartment(id) {
  __reportingDept = REPORT_DEPARTMENTS.some(d => d[0] === id) ? id : 'all';
  __reportingSearch = '';
  reportingSetUrl({ department: __reportingDept });
  loadReportLibraryPage();
}
window.reportingSelectDepartment = reportingSelectDepartment;

function loadReports() {
  const params = new URLSearchParams(location.search);
  const reportId = params.get('report');
  const dept = params.get('report_department');
  if (dept && REPORT_DEPARTMENTS.some(d => d[0] === dept)) __reportingDept = dept;
  document.getElementById('reports-overview')?.classList.add('hidden');
  document.getElementById('reports-dynamic')?.classList.remove('hidden');
  renderReportTabs();
  if (reportId) openSemanticReport(reportId, { keepUrl: true }); else loadReportLibraryPage();
}

// Open the Reports hub already focused on one department's report tab. The engine
// rails link here so "Reports" on the right rail is specific to the department you're
// in. switchPage('reports') runs loadReports() synchronously (the tabs DOM is built
// before this returns), so reportsTab() can safely select the deep tab right after.
function openDeptReport(key) {
  __reportingDept = REPORT_DEPT_FROM_LEGACY[key] || key || 'all';
  if (!REPORT_DEPARTMENTS.some(d => d[0] === __reportingDept)) __reportingDept = 'all';
  reportingSetUrl({ department: __reportingDept });
  switchPage('reports');
}
window.openDeptReport = openDeptReport;

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
    const setMetric = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setMetric('metric-listings-scope', `${scopePrefix} · ${data.range_label || 'lifetime'}`);

    // Top row (existing four)
    setMetric('metric-synced', data.inventory_available ?? data.inventory_synced);
    setMetric('metric-synced-total', data.inventory_synced);
    setMetric('metric-listings', data.listings_posted);
    setMetric('metric-sold', data.sold_this_month);
    setMetric('metric-active-days', `${data.active_days_this_week}/7`);

    // Second row (new metrics)
    setMetric('metric-time-to-sell', data.avg_time_to_sell_days ?? '—');
    setMetric('metric-posts-per-day', data.posts_per_day || '—');
    setMetric('metric-sell-through', data.sell_through_rate || 0);
    setMetric('metric-aged', data.inventory_aged_60d ?? 0);

    // Admin-only: show admin vs reps breakdown under Listings Posted
    if (data.scope === 'dealership') {
      const bd = document.getElementById('metric-listings-breakdown');
      bd?.classList.remove('hidden');
      bd?.classList.add('grid');
      setMetric('metric-listings-admin', data.listings_by_admin ?? 0);
      setMetric('metric-listings-reps', data.listings_by_reps ?? 0);
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
  // The header "Use Chrome" button stays in the main nav ALWAYS for Facebook-posting
  // workspaces — it's how you reach the extension after the first-run banner is gone.
  // The banner is just the extra one-time nudge, dismissible on its own.
  headerBtn?.classList.remove('hidden');
  let dismissed = false;
  try { dismissed = localStorage.getItem('ms_ext_cta_dismissed') === '1'; } catch {}
  if (dismissed) banner?.classList.add('hidden');
  else banner?.classList.remove('hidden');
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

  if (title) title.textContent = isFacebookTeam ? 'Staff' : 'Users & Team';
  if (subtitle) subtitle.textContent = isFacebookTeam
    ? 'Add or remove staff for your dealership.'
    : 'Invite, edit, assign roles, pause, or remove users in this dealership.';
  if (invite) {
    invite.textContent = isFacebookTeam ? '+ Invite Staff' : '+ Invite User';
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
  // Always openRepEdit — these rows come from /dealership/team (profile records), not
  // the People module's employee roster openEditEmployeeModal expects. That function
  // exists globally but its data source (getPeopleComplianceData) is permanently
  // stubbed to return [] ("legacy callers receive no invented roster"), so calling it
  // here silently no-ops: Edit looked wired but did nothing when clicked.
  document.querySelectorAll('.rep-detail-btn, .rep-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const repId = btn.dataset.repId;
      if (typeof openRepEdit === 'function') openRepEdit(repId);
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
  // Keep this light Liquid Glass editor consistent even when the dashboard has
  // a global dark class. The old dark utility classes made the fields unreadable.
  const ic = 'w-full bg-white/85 text-slate-900 placeholder-slate-400 border border-slate-300 rounded-xl px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-600 mb-1">${t}</label>`;
  const checkRow = 'flex items-center gap-2 text-sm text-slate-700 rounded-xl border border-slate-200 bg-white/70 px-3 py-2';
  const routingRow = (m.role === 'SALES_REP')
    ? `<div>${lbl('Sales lot (for auto-assigned leads)')}<select id="re-team" class="${ic}">${[['', '—'], ['new', 'New'], ['used', 'Used'], ['both', 'Both']].map(o => `<option value="${o[0]}" ${(m.sales_team || '') === o[0] ? 'selected' : ''}>${o[1] === '—' ? 'Not set' : o[1]}</option>`).join('')}</select></div>`
    : `<div>${lbl('Manager scope (lead notifications)')}<select id="re-mgr" class="${ic}">${[['', '—'], ['gm', 'General manager'], ['gsm', 'GSM'], ['new_mgr', 'New-car manager'], ['used_mgr', 'Used-car manager'], ['fni', 'F&I manager']].map(o => `<option value="${o[0]}" ${(m.mgr_role || '') === o[0] ? 'selected' : ''}>${o[1] === '—' ? 'Not set' : o[1]}</option>`).join('')}</select></div>`;
  const ov = crmOverlay(`<div class="ms-staff-editor space-y-4">
    <div class="flex items-center justify-between"><div class="text-lg font-black text-slate-900 dark:text-white">Edit ${esc(m.full_name || 'team member')}</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="flex items-center gap-3">
      <div id="re-avatar-wrap" class="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg font-black text-slate-500 shrink-0">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" class="w-full h-full object-cover">` : esc((m.full_name || '?')[0] || '?')}</div>
      <div><input type="file" accept="image/*" id="re-photo-file" class="hidden" onchange="repEditUploadPhoto(this.files[0])"><button type="button" onclick="document.getElementById('re-photo-file').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-3 py-1.5 rounded-lg">Upload photo</button><p class="text-[11px] text-slate-400 mt-1">Shows on your website team page.</p></div>
    </div>
    <div id="re-insights" class="grid grid-cols-3 gap-2 text-center bg-white/70 border border-slate-200 rounded-xl p-2.5">
      <div class="text-xs text-slate-400 italic col-span-3 py-1">Loading insights…</div>
    </div>
    <div class="ms-staff-grid grid grid-cols-2 gap-3">
      <div>${lbl('Full name')}<input id="re-name" value="${esc(m.full_name || '')}" class="${ic}"></div>
      <div>${lbl('Display name (public)')}<input id="re-display" value="${esc(m.display_name || '')}" placeholder="${esc(m.full_name || '')}" class="${ic}"></div>
    </div>
    <div>${lbl('Bio (public — appears on the website)')}<textarea id="re-bio" rows="3" class="${ic}" placeholder="A sentence or two about this team member.">${esc(m.bio || '')}</textarea></div>
    <div>${lbl('Registration / OMVIC # (prints on the bill of sale, beside their signature)')}<input id="re-reg" value="${esc(m.registration_id || '')}" placeholder="5642822" class="${ic}"></div>
    <div class="ms-staff-grid grid grid-cols-2 gap-3">
      ${routingRow}
      ${m.role === 'SALES_REP' ? `<div>${lbl('Appraisals')}<label class="${checkRow}"><input id="re-appr" type="checkbox" class="accent-indigo-600" ${m.can_see_all_appraisals ? 'checked' : ''}>Sees all appraisals</label></div>` : '<div></div>'}
    </div>
    <label class="${checkRow}"><input id="re-active" type="checkbox" class="accent-indigo-600" ${m.active !== false ? 'checked' : ''}>Active (uncheck to pause lead assignment &amp; rep sends)</label>
    <div class="ms-staff-actions border-t border-slate-200 pt-4 flex flex-wrap items-center gap-2">
      ${(!isSelf && !isAdmin && viewerAdmin) ? `<div class="flex items-center gap-1.5"><label class="text-[11px] font-semibold text-slate-600">Role</label><select id="re-role" class="text-xs font-bold bg-white text-slate-900 border border-slate-300 px-3 py-2 rounded-xl shadow-sm">${[['SALES_REP', 'Sales rep'], ['MANAGER', 'Manager'], ['FNI', 'F&I'], ['SERVICE', 'Service'], ['ACCOUNTING', 'Accounting'], ['CLEANUP', 'Cleanup']].map(o => `<option value="${o[0]}" ${m.role === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><button onclick="repEditRole('${m.id}', document.getElementById('re-role').value, this)" class="text-xs font-bold bg-white text-slate-700 border border-slate-300 px-3 py-2 rounded-xl shadow-sm">Set</button></div>` : ''}
      ${(!isSelf && viewerAdmin) ? `<button type="button" onclick="repEditPassword('${m.id}')" class="inline-flex items-center justify-center text-xs font-bold bg-white/80 text-slate-700 border border-slate-300 px-3 py-2 rounded-xl shadow-sm hover:border-indigo-400 hover:text-indigo-700 transition">Set password</button>` : ''}
      ${(!isSelf && !isAdmin) ? `<button onclick="repEditRemove('${m.id}','${esc(m.full_name || 'this rep')}')" class="text-xs font-bold text-rose-600 hover:text-rose-500 px-2 py-2">Remove</button>` : ''}
      <div class="flex-1"></div>
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="repEditSave('${m.id}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button>
    </div>
    ${(!isSelf && viewerAdmin) ? `<section id="re-password-panel" class="hidden rounded-2xl border border-indigo-200/70 bg-indigo-50/65 p-4 space-y-3">
      <div><h4 class="text-sm font-black text-slate-900">Set a new password</h4><p class="text-[11px] text-slate-500 mt-0.5">Choose the exact password this person should use. Minimum 8 characters.</p></div>
      <div class="ms-staff-grid grid grid-cols-2 gap-3">
        <div>${lbl('New password')}<div class="flex gap-2"><input id="re-password" type="password" autocomplete="new-password" class="${ic}" placeholder="Enter a password"><button type="button" onclick="repTogglePasswordVisibility()" class="shrink-0 px-3 rounded-xl border border-slate-300 bg-white/80 text-xs font-bold text-slate-600">Show</button></div></div>
        <div>${lbl('Confirm password')}<input id="re-password-confirm" type="password" autocomplete="new-password" class="${ic}" placeholder="Enter it again"></div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="repGeneratePassword()" class="px-3 py-2 rounded-xl border border-slate-300 bg-white/80 text-xs font-bold text-slate-700">Generate strong password</button>
        <button type="button" onclick="repEditApplyPassword('${m.id}', this)" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black">Set new password</button>
      </div>
      <div id="re-password-result" class="hidden rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div class="text-[11px] font-bold text-emerald-800 mb-1.5">Password updated — copy it before closing.</div>
        <div class="flex gap-2"><input id="re-password-copy" readonly class="${ic} font-mono select-all"><button type="button" onclick="repCopyPassword()" class="shrink-0 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black">Copy</button></div>
      </div>
      <p id="re-password-error" class="hidden text-xs font-bold text-rose-600"></p>
    </section>` : ''}
    <p id="re-msg" class="hidden text-xs"></p>
  </div>`, 'max-w-xl');
  if (ov && typeof loadRepEditInsights === 'function') loadRepEditInsights(m.id);
}
// Posts / leads / conversion for this rep, sourced from the same /gamification
// leaderboard data the Sales Leaderboard page uses — this is the "Insights" the
// Edit modal now folds in, instead of being a separate popup.
async function loadRepEditInsights(repId) {
  const host = document.getElementById('re-insights');
  if (!host) return;
  try {
    const res = await fetch(`${API}/gamification`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const dept = data.departments?.facebook;
    const row = (dept?.leaderboard || []).find(r => r.rep_id === repId);
    const metrics = row?.metrics || {};
    const posted = metrics.posted ?? 0;
    const sold = metrics.sold_30d ?? metrics.sold ?? 0;
    const conv = posted > 0 ? Math.round((sold / posted) * 100) : 0;
    if (!document.getElementById('re-insights')) return;   // modal closed while loading
    host.innerHTML = `
      <div><div class="text-lg font-black text-slate-900">${posted}</div><div class="text-[10px] uppercase tracking-wider text-slate-500">Posts</div></div>
      <div><div class="text-lg font-black text-slate-900">${sold}</div><div class="text-[10px] uppercase tracking-wider text-slate-500">Sold</div></div>
      <div><div class="text-lg font-black text-slate-900">${conv}%</div><div class="text-[10px] uppercase tracking-wider text-slate-500">Conversion</div></div>
    `;
  } catch (e) {
    if (document.getElementById('re-insights')) host.innerHTML = `<div class="text-xs text-slate-400 italic col-span-3 py-1">Insights unavailable</div>`;
  }
}
window.loadRepEditInsights = loadRepEditInsights;
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
function repEditPassword() {
  const panel = document.getElementById('re-password-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) document.getElementById('re-password')?.focus();
}
function repTogglePasswordVisibility() {
  const fields = ['re-password', 're-password-confirm'].map(id => document.getElementById(id)).filter(Boolean);
  const reveal = fields[0]?.type === 'password';
  fields.forEach(field => { field.type = reveal ? 'text' : 'password'; });
}
function repGeneratePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = new Uint32Array(18); crypto.getRandomValues(bytes);
  const password = Array.from(bytes, value => chars[value % chars.length]).join('') + 'Aa9!';
  const pass = document.getElementById('re-password');
  const confirm = document.getElementById('re-password-confirm');
  if (pass) pass.value = password;
  if (confirm) confirm.value = password;
}
async function repCopyPassword() {
  const input = document.getElementById('re-password-copy'); if (!input?.value) return;
  try { await navigator.clipboard.writeText(input.value); }
  catch { input.select(); document.execCommand('copy'); }
  showToast('Password copied', 'success');
}
async function repEditApplyPassword(id, btn) {
  const password = document.getElementById('re-password')?.value || '';
  const confirmation = document.getElementById('re-password-confirm')?.value || '';
  const error = document.getElementById('re-password-error');
  const fail = message => { if (error) { error.textContent = message; error.classList.remove('hidden'); } };
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (password !== confirmation) return fail('The passwords do not match.');
  if (error) error.classList.add('hidden');
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Setting…';
  try {
    const d = await apiSendJson(`/admin/users/${id}/password`, 'PUT', { password });
    const result = document.getElementById('re-password-result');
    const copy = document.getElementById('re-password-copy');
    if (copy) copy.value = d.password || password;
    result?.classList.remove('hidden');
    showToast('Password updated', 'success');
  } catch (e) { fail(e.message || 'Could not update password.'); }
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
Object.assign(window, { openRepEdit, repEditUploadPhoto, repEditSave, repEditPassword, repTogglePasswordVisibility, repGeneratePassword, repCopyPassword, repEditApplyPassword, repEditRole, repEditRemove });

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
  try { await apiSendJson('/leads/routing', 'PUT', body); if (msg) { msg.textContent = ' Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); } }
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
        msg.textContent = ' Saved'; msg.className = 'text-xs mt-2 text-emerald-600 dark:text-emerald-400';
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
  if (!el) return;
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
  // MarketSync HQ and other restricted workspaces do not render the dealership
  // rep-stat panel. A platform-staff login can still pass through the generic
  // dealership bootstrap, so treat the absent panel as an intentional no-op.
  const recent = document.getElementById('rep-recent-list');
  if (!recent) return;
  try {
    const res = await fetch(`${API}/me/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load stats');
    const data = await res.json();
    const setStat = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setStat('rep-stat-total', data.totals.total);
    setStat('rep-stat-active', data.totals.active);
    setStat('rep-stat-sold', data.totals.sold);
    setStat('rep-stat-deleted', data.totals.deleted);
    renderRecentListings('rep-recent-list', data.recent, { canEditUrl: true });
  } catch (e) {
    recent.innerHTML = `<div class="text-xs text-red-400">${e.message}</div>`;
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

function leaderboardDeptsForRole(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'SERVICE') return ['service'];
  if (r === 'PARTS') return ['parts'];
  if (r === 'FNI') return ['fni'];
  if (r === 'ACCOUNTING') return ['accounting'];
  if (r === 'CLEANUP') return ['cleanup'];
  if (r === 'SALES_REP') return ['sales', 'facebook'];
  return ['facebook', 'sales', 'service', 'fni', 'video'];
}

function applyLeaderboardProductPresentation() {
  const facebook = facebookLeaderboardActive();
  const video = typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace();
  const allowed = leaderboardDeptsForRole(typeof profileContext !== 'undefined' ? profileContext?.role : '');
  document.querySelectorAll('#lb-dept-tabs .lb-dept-btn').forEach(btn => {
    const key = (btn.id || '').replace('lb-dept-', '');
    btn.classList.toggle('hidden', allowed.length < 3 && !allowed.includes(key));
  });
  if (allowed.length && !allowed.includes(window.__activeLbDept)) window.__activeLbDept = allowed[0];
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  // A Facebook-tier or Video-tier account has no Sales/Service/F&I department to
  // browse — the department tab row is Global vs My Team only (both already
  // department-scoped below), so the department selector itself is hidden rather
  // than left showing tabs that lead nowhere for this account.
  document.getElementById('lb-dept-tabs')?.classList.toggle('hidden', facebook || video);
  if (facebook) window.__activeLbDept = 'facebook';
  else if (video) window.__activeLbDept = 'video';
  const isFb = window.__activeLbDept === 'facebook';
  const scopeTabs = document.getElementById('lb-scope-tabs');
  if (scopeTabs) {
    scopeTabs.classList.toggle('hidden', !isFb);
  }
  // The 5 middle ranking-table columns are shared markup across every department
  // — Facebook's "Deals/Appr./Listings/FB Sold/Conv." labels are the DEFAULT text,
  // not fixed captions, so a department with different metrics (Video) must
  // relabel them instead of leaving Facebook's words sitting over its own numbers.
  // Reset to that default here so switching department tabs never leaves a stale
  // label from a previous visit to Video showing.
  const DEFAULT_COLS = ['Deals', 'Appr.', 'Listings', 'FB Sold', 'Conv.'];
  DEFAULT_COLS.forEach((label, i) => set(`lb-col-${i + 1}`, label));
  document.querySelectorAll('[data-lb-non-fb]').forEach(el => el.classList.toggle('hidden', facebook));
  document.getElementById('lb-activity-section')?.classList.remove('hidden');
  if (video) {
    // Sales Video has 5 real metrics of its own (sent this month, total sent,
    // watched, watch rate, average watch completion) — reuse all 5 shared middle
    // columns instead of hiding two and leaving the row 1 cell short of its header.
    ['Sent (30d)', 'Total Sent', 'Watched', 'Watch Rate', 'Avg Watch'].forEach((label, i) => set(`lb-col-${i + 1}`, label));
    // "Recent activity" reads from the Facebook/inventory posting feed — it has no
    // video-sending equivalent yet, so showing it here would just mislabel
    // Facebook activity as video activity.
    document.getElementById('lb-activity-section')?.classList.add('hidden');
    set('lb-title', ' Sales Video Leaderboard');
    set('lb-subtitle', '100 pts / video sent · 250 pts / video watched · 5 pts per point of average watch completion.');
    set('lb-conv-label', 'Videos Sent');
    set('lb-rankings-title', 'Video sending rankings');
    set('lb-tab-team', ' My Team');
    set('lb-tab-global', ' Global');
    set('gl-posted-label', 'Your Videos');
    return;
  }
  set('lb-title', facebook ? ' Facebook Posting Leaderboard' : ' Leaderboard');
  set('lb-subtitle', facebook
    ? '100 pts per Facebook post · 500 pts per Facebook sale · Build your posting streak and lead the board.'
    : '500 pts / deal · 50 pts / appraisal · 100 pts / listing · Climb the tiers, top the team.');
  set('lb-conv-label', facebook ? 'Facebook Conversion' : 'Team Conversion');
  set('lb-rankings-title', facebook ? 'Facebook posting rankings' : 'Full rankings');
  set('lb-tab-team', facebook ? ' Facebook Marketplace Dealer Leaderboard' : ' My Team');
  set('lb-tab-global', facebook ? ' Facebook Community' : ' Global');
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

function updateTierChip(ranking) {
  const chip = document.getElementById('ui-tier-chip');
  if (!chip) return;
  const me = (ranking || []).find(r => r.id === (typeof user !== 'undefined' ? user?.id : profileContext?.user?.id));
  if (!me || !me.tier) { chip.classList.add('hidden'); return; }
  chip.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition hover:brightness-110 whitespace-nowrap ${me.tier.cls}`;
  chip.classList.remove('hidden');
  const rankTxt = me.rank ? `#${me.rank}` : '';
  chip.innerHTML = `<span>${me.tier.icon}</span><span>${me.tier.name}</span>${rankTxt ? `<span class="opacity-70 font-mono">${rankTxt}</span>` : ''}`;
}
window.updateTierChip = updateTierChip;

async function loadMyTierChip() {
  const chip = document.getElementById('ui-tier-chip');
  if (!chip) return;
  try {
    const res = await fetch(`${API}/dealership/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    const ranking = (data.ranking || []).map(r => {
      const points = calcPoints(r);
      return { ...r, points, tier: tierFor(points) };
    });
    updateTierChip(ranking);
  } catch (e) { /* non-fatal — chip just stays hidden */ }
}
window.loadMyTierChip = loadMyTierChip;

window.__activeLbDept = 'facebook';

function switchLeaderboardDept(deptKey) {
  const allowed = leaderboardDeptsForRole(typeof profileContext !== 'undefined' ? profileContext?.role : '');
  if (allowed.length && deptKey && !allowed.includes(deptKey)) return;
  window.__activeLbDept = deptKey || allowed[0] || 'facebook';
  ['facebook', 'sales', 'service', 'fni', 'video'].forEach(k => {
    const btn = document.getElementById(`lb-dept-${k}`);
    if (!btn) return;
    const active = k === window.__activeLbDept;
    btn.className = `lb-dept-btn px-3.5 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${active
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`;
  });
  if (window.__activeLbDept !== 'facebook') {
    const tabTeam = document.getElementById('lb-tab-team');
    if (tabTeam && typeof setCarouselTab === 'function') setCarouselTab('team');
  }
  loadLeaderboard();
  loadAchievements();
}
window.switchLeaderboardDept = switchLeaderboardDept;

async function loadLeaderboard() {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;
  applyLeaderboardProductPresentation();
  body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500 italic">Loading ${window.__activeLbDept || 'department'} leaderboard...</td></tr>`;
  try {
    const res = await fetch(`${API}/gamification`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Leaderboard failed');
    const data = await res.json();

    const currentDeptKey = window.__activeLbDept || 'facebook';
    const dept = (data.departments && data.departments[currentDeptKey]) ? data.departments[currentDeptKey] : null;

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    
    if (dept) {
      setText('lb-title', dept.title || 'Department Leaderboard');
      setText('lb-rankings-title', `${dept.title} rankings`);
      if (dept.totals) {
        setText('lb-conv', dept.totals.sales_30d || dept.totals.posted || dept.totals.sent_30d || 0);
        setText('lb-team-sold', dept.totals.sold || dept.totals.ro_closed || dept.totals.fni_deals || dept.totals.watched || 0);
        setText('lb-team-total', dept.totals.posted || dept.totals.total_sold || dept.totals.total_sent || 0);
      }
    }

    const leaderboardList = dept ? dept.leaderboard : [];
    const formattedRanking = leaderboardList.map((r, i) => {
      const pts = r.score || (r.metrics?.sold_30d * 500) || 0;
      return {
        id: r.rep_id,
        name: r.full_name,
        rank: r.rank || (i + 1),
        title: r.title || 'Team Member',
        points: pts,
        tier: tierFor(pts),
        metrics: r.metrics || {},
      };
    });

    renderPodium(formattedRanking);
    renderYourPosition(formattedRanking);
    renderDepartmentRankingTable(formattedRanking, currentDeptKey);
    updateTierChip(formattedRanking);
    loadActivity();
    loadAchievements();
  } catch (e) {
    console.warn('Leaderboard failed:', e.message);
    body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 italic">Failed to load leaderboard.</td></tr>`;
  }
}

function renderDepartmentRankingTable(ranking, deptKey) {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;
  if (!ranking.length) {
    body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-400 italic">No activity recorded for this department yet.</td></tr>`;
    return;
  }

  const money = (n) => '$' + Number(n || 0).toLocaleString();
  const selfId = (typeof user !== 'undefined' && user) ? user.id : null;

  body.innerHTML = ranking.map(r => {
    const isMe = r.id === selfId;
    const m = r.metrics || {};

    let metricCols = '';
    if (deptKey === 'facebook') {
      metricCols = `
        <td class="py-3 px-3 text-right font-mono font-bold">${m.posted || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.leads || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.resp_time_min ? m.resp_time_min + 'm' : '—'}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${m.sold || 0}</td>
      `;
    } else if (deptKey === 'sales') {
      metricCols = `
        <td class="py-3 px-3 text-right font-mono font-bold">${m.sold_30d || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.total_sold || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.appraisals || 0}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${money(m.gross_profit)}</td>
      `;
    } else if (deptKey === 'service') {
      metricCols = `
        <td class="py-3 px-3 text-right font-mono font-bold">${m.ro_closed || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.tech_eff_pct ? m.tech_eff_pct + '%' : '—'}</td>
        <td class="py-3 px-3 text-right font-mono">${m.csi_score ? m.csi_score + '%' : '—'}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${money(m.service_rev)}</td>
      `;
    } else if (deptKey === 'fni') {
      metricCols = `
        <td class="py-3 px-3 text-right font-mono font-bold">${m.fni_deals || 0}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">${money(m.pvr_avg)}</td>
        <td class="py-3 px-3 text-right font-mono">${m.vsc_pct ? m.vsc_pct + '%' : '—'}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${money(m.fni_gross)}</td>
      `;
    } else if (deptKey === 'video') {
      // 5 tds to fill all 5 shared middle columns (relabeled to video's own
      // metrics in applyLeaderboardProductPresentation) — every other department
      // only fills 4 of the 5 and leaves one blank, but Video actually has 5 real
      // numbers, so use the column Facebook's "Deals"/"Appr." slots free up here.
      metricCols = `
        <td class="py-3 px-3 text-right font-mono">${m.sent_30d || 0}</td>
        <td class="py-3 px-3 text-right font-mono font-bold">${m.total_sent || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.watched || 0}</td>
        <td class="py-3 px-3 text-right font-mono">${m.watch_rate_pct ? m.watch_rate_pct + '%' : '—'}</td>
        <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${m.avg_watch_pct ? m.avg_watch_pct + '%' : '—'}</td>
      `;
    }

    return `
      <tr class="border-b border-slate-100 dark:border-slate-800/60 ${isMe ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}">
        <td class="py-3 px-3 font-mono font-bold text-slate-500">#${r.rank}</td>
        <td class="py-3 px-3">
          <div class="font-bold text-slate-900 dark:text-white">${esc(r.name)}${isMe ? ' <span class="text-xs text-indigo-600 dark:text-indigo-400 font-normal">(you)</span>' : ''}</div>
          <div class="text-[11px] text-slate-400">${esc(r.title)}</div>
        </td>
        <td class="py-3 px-3">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${r.tier?.cls || ''}">
            ${r.tier?.name || 'Rookie'}
          </span>
        </td>
        ${metricCols}
        <td class="py-3 px-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">${(r.points || 0).toLocaleString()}</td>
      </tr>
    `;
  }).join('');
}

// ── Achievements (gamification badges to be won) ──────────────────────────────────
async function loadAchievements() {
  const wrap = document.getElementById('lb-achievements');
  if (!wrap) return;
  try {
    const res = await fetch(`${API}/gamification`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('gamification failed');
    const d = await res.json();
    
    const currentDeptKey = window.__activeLbDept || 'facebook';
    const deptInfo = d.departments ? d.departments[currentDeptKey] : null;

    const myRep = deptInfo ? deptInfo.me : d.me;
    let myBadges = myRep ? (myRep.badges || []) : [];

    if (!myBadges.length) {
      const defaultDeptBadges = {
        fni: [
          { key: 'fni_mastermind', icon: 'gem', label: 'F&I Mastermind', description: 'Average PVR of $1,500, $2,500, or $3,500+.', unit: '$', thresholds: [1500, 2500, 3500] },
          { key: 'warranty_wizard', icon: 'shield', label: 'Warranty Wizard', description: 'VSC / warranty attach rate 50%, 70%, 85%.', unit: '%', thresholds: [50, 70, 85] },
          { key: 'protection_pro', icon: 'document', label: 'Protection Pro', description: 'Sell F&I products on 10, 50, 150 deals.', thresholds: [10, 50, 150] },
          { key: 'gross_titan', icon: 'cash', label: 'F&I Gross Titan', description: 'Generate $15k, $50k, or $150k F&I gross.', unit: '$', thresholds: [15000, 50000, 150000] },
          { key: 'menu_master', icon: 'trophy', label: 'F&I Producer', description: 'Work 10, 50, or 100 F&I deals.', thresholds: [10, 50, 100] },
        ],
        sales: [
          { key: 'sales_fast_starter', icon: 'rocket', label: 'First 5 Sales', description: 'Sell your first 5 vehicles.', thresholds: [5] },
          { key: 'sales_month_master', icon: 'trophy', label: 'Monthly 15 Club', description: 'Sell 15 units in 30 days.', thresholds: [15] },
          { key: 'sales_trade_hunter', icon: 'refresh', label: 'Trade Hunter', description: 'Appraise 10, 30, or 75 trades.', thresholds: [10, 30, 75] },
          { key: 'sales_gross_champion', icon: 'cash', label: 'Gross Champion', description: 'Generate $25k, $75k, or $150k gross.', unit: '$', thresholds: [25000, 75000, 150000] },
          { key: 'sales_quick_close', icon: 'bolt', label: 'Fast Lot Turn', description: 'Close inventory in under 14 days.', unit: 'd', thresholds: [14] },
        ],
        service: [
          { key: 'service_ro_closer', icon: 'tool', label: 'RO Finisher', description: 'Close 25, 100, or 300 repair orders.', thresholds: [25, 100, 300] },
          { key: 'service_tech_efficiency', icon: 'bolt', label: 'Tech Efficiency', description: 'Reach 85%, 100%, 120% efficiency.', unit: '%', thresholds: [85, 100, 120] },
          { key: 'service_csi_star', icon: 'star', label: 'CSI 5-Star', description: 'Achieve 90%, 95%, 98% satisfaction.', unit: '%', thresholds: [90, 95, 98] },
          { key: 'service_revenue_titan', icon: 'cash', label: 'Service Rev Titan', description: 'Generate $25k, $75k, $200k service rev.', unit: '$', thresholds: [25000, 75000, 200000] },
          { key: 'service_turnaround', icon: 'clock', label: 'Fast Turnaround', description: 'Complete same-day service work.', thresholds: [1] },
        ],
        facebook: [
          { key: 'fb_speed_demon', icon: 'bolt', label: 'Speed to Lead', description: 'Reply in under 5 minutes.', unit: 'm', thresholds: [5] },
          { key: 'fb_post_machine', icon: 'car', label: 'Posting Machine', description: 'Post 10, 50, 200 listings.', thresholds: [10, 50, 200] },
          { key: 'fb_closer', icon: 'cash', label: 'Marketplace Closer', description: 'Sell 5, 20, 50 marketplace leads.', thresholds: [5, 20, 50] },
          { key: 'fb_volume_king', icon: 'crown', label: '30-Day Volume King', description: 'Top volume poster on lot.', thresholds: [30] },
          { key: 'fb_fast_turn', icon: 'clock', label: 'Fast Lot Turn', description: 'Units sold in under 21 days.', unit: 'd', thresholds: [21] },
        ],
        video: [
          { key: 'vid_first_send', icon: 'video', label: 'First Send', description: 'Send your first walkaround video.', thresholds: [1] },
          { key: 'vid_prolific', icon: 'video', label: 'Prolific Sender', description: 'Send 10, 50, 200 walkaround videos.', thresholds: [10, 50, 200] },
          { key: 'vid_watched', icon: 'eye', label: 'Getting Watched', description: 'Have 5, 25, 75 videos watched.', thresholds: [5, 25, 75] },
          { key: 'vid_engagement', icon: 'fire', label: 'High Engagement', description: 'Reach 40%, 65%, 85% watch rate.', unit: '%', thresholds: [40, 65, 85] },
          { key: 'vid_full_watch', icon: 'star', label: 'Full Attention', description: 'Average 40%, 65%, 90% completion.', unit: '%', thresholds: [40, 65, 90] },
        ],
        parts: [
          { key: 'parts_order_ace', icon: 'box', label: 'Order Ace', description: 'Fulfill 20, 100, 300 parts orders.', thresholds: [20, 100, 300] },
          { key: 'parts_accuracy', icon: 'target', label: 'Inventory Accuracy', description: 'Maintain 98%+ stock accuracy.', unit: '%', thresholds: [98] },
          { key: 'parts_turnover', icon: 'bolt', label: 'Fast Turnover', description: 'Rapid movement turnover on parts.', thresholds: [50] },
          { key: 'parts_counter_pro', icon: 'tool', label: 'Counter Pro', description: 'Serve 50, 200, 500 repair order parts.', thresholds: [50, 200, 500] },
        ],
        accounting: [
          { key: 'acct_ledger_master', icon: 'chart', label: 'Ledger Master', description: 'Post 50, 200, 1000 journal entries.', thresholds: [50, 200, 1000] },
          { key: 'acct_speed_post', icon: 'bolt', label: 'Fast Posting', description: 'Post vehicle deals within 24h.', thresholds: [24] },
          { key: 'acct_audit_ready', icon: 'shield', label: 'Audit Ready', description: 'Zero unassigned variances on ledger.', thresholds: [100] },
          { key: 'acct_cash_flow', icon: 'cash', label: 'Cash Flow Champion', description: 'Collect CIT in under 7 days.', unit: 'd', thresholds: [7] },
        ],
      };
      myBadges = defaultDeptBadges[currentDeptKey] || defaultDeptBadges.sales;
    }

    const unlockedCount = myBadges.filter(b => Number(b.level || 0) > 0).length;

    wrap.innerHTML = `
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
            ${deptInfo ? deptInfo.title : 'Department'} Badges to be Won
          </div>
          <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">${unlockedCount} of ${myBadges.length} unlocked</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${myBadges.map(badgeCard).join('')}
        </div>
      </div>
    `;
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
  const valLabel = b.value == null ? '—'
    : b.unit === '%' ? `${b.value}%`
    : b.unit === 'h' ? `${b.value}h`
    : `${b.value}${b.unit ? ' ' + b.unit : ''}`;
  // Progress line: cumulative badges show a bar to next; descending/maxed show a note.
  const next = b.next;
  const progress = (b.progress_pct != null && next != null)
    ? `<div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
         <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style="width:${b.progress_pct}%"></div>
       </div>
       <div class="text-[10px] text-slate-400 mt-1">${next}${b.unit === '%' ? '%' : ''} for next tier</div>`
    : (next == null
        ? `<div class="text-[10px] font-bold text-amber-500 mt-2">Max tier reached</div>`
        : `<div class="text-[10px] text-slate-400 mt-2">Reach ${next}${b.unit === 'h' ? 'h or less' : ''} to unlock</div>`);
  const iconSvg = typeof getBadgeIconSvg === 'function' ? getBadgeIconSvg(b.icon || b.key || 'star', 'w-6 h-6') : (typeof svgIcon === 'function' ? svgIcon('star', 'w-6 h-6') : '');
  return `
    <div class="rounded-xl border p-3 ${earned
      ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800'
      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'}">
      <div class="flex items-start justify-between gap-2">
        <div class="p-1.5 rounded-lg ${earned ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">${iconSvg}</div>
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
