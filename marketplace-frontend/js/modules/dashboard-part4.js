/* dashboard.js split part 4/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// CRM is now split into separate pages (Customers / Leads / Appointments /
// Tasks). This page renders just the Customers (contacts) view.
async function loadCrmPage() {
  if (typeof switchPage === 'function' && typeof engineTab === 'function') {
    switchPage('sales');
    setTimeout(() => engineTab('sales', 'work'), 50);
    return;
  }
  const body = document.getElementById('crm-body');
  if (!body) return;
  await crmLoadContacts(body);
  if (__crmPendingAdd) { __crmPendingAdd = false; if (typeof crmOpenForm === 'function') crmOpenForm(); }
}

// Legacy shim: old callers that flipped a CRM tab now navigate to that page.
function crmSetTab(t) { switchPage(t === 'contacts' ? 'crm' : t); }
window.crmSetTab = crmSetTab;

// ── CRM + Lead insights + sales-lead reports (#21, #22) ─────────────────────
let __crmInsightsRange = '30';
async function loadCrmInsights() {
  const root = document.getElementById('crm-insights-root');
  if (!root) return;
  let d;
  try { d = await apiGetJson(`/crm/insights?range=${encodeURIComponent(__crmInsightsRange)}`, { retries: 1 }); }
  catch (e) { root.innerHTML = `<div class="py-12 text-center text-sm text-slate-500">Couldn't load insights: ${esc(e.message)}</div>`; return; }
  if (d.empty) { root.innerHTML = `<div class="py-12 text-center text-sm text-slate-400 italic">No data yet.</div>`; return; }

  const CRM_STATUS_LABEL = { uncontacted: 'Uncontacted', contacted: 'Contacted', appointment: 'Appointment', sold: 'Sold', fni: 'F&I', delivered: 'Delivered', followup: 'Follow-up', lost: 'Lost' };
  const card = (inner, extra = '') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 ${extra}">${inner}</div>`;
  const stat = (label, value, sub = '') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${esc(label)}</div>
    <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${esc(String(value))}</div>
    ${sub ? `<div class="text-xs mt-0.5">${sub}</div>` : ''}</div>`;

  const trend = d.leads.trend_pct;
  const trendHtml = `<span class="${trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-bold">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span> <span class="text-slate-400">vs prior ${d.range_days}d</span>`;

  // Horizontal bar list (lead sources / rep leaderboard).
  const barList = (items, labelFn, max) => {
    const mx = max || Math.max(1, ...items.map(i => i.count));
    return items.slice(0, 8).map(i => `<div class="flex items-center gap-2 text-sm">
      <div class="w-28 shrink-0 truncate text-slate-600 dark:text-slate-300" title="${esc(labelFn(i))}">${esc(labelFn(i))}</div>
      <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-indigo-500 rounded-full" style="width:${Math.round((i.count / mx) * 100)}%"></div></div>
      <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${i.count}</div>
    </div>`).join('') || '<div class="text-xs text-slate-400 italic">No data in range.</div>';
  };

  // Pipeline funnel bars.
  const fmax = Math.max(1, ...d.pipeline.funnel.map(f => f.count));
  const funnelHtml = d.pipeline.funnel.filter(f => f.count > 0).map(f => `<div class="flex items-center gap-2 text-sm">
    <div class="w-24 shrink-0 text-slate-600 dark:text-slate-300">${esc(CRM_STATUS_LABEL[f.status] || f.status)}</div>
    <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-violet-500 rounded-full" style="width:${Math.round((f.count / fmax) * 100)}%"></div></div>
    <div class="w-8 text-right font-bold tabular-nums text-slate-700 dark:text-slate-200">${f.count}</div>
  </div>`).join('') || '<div class="text-xs text-slate-400 italic">No contacts yet.</div>';

  const rangeBtn = (v, label) => `<button onclick="crmInsightsRange('${v}')" class="px-3 py-1.5 text-xs font-bold rounded-lg border ${__crmInsightsRange === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}">${label}</button>`;

  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div class="text-sm text-slate-500 dark:text-slate-400">${d.is_manager ? 'Team-wide' : 'Your book'} · last ${d.range_days} days</div>
      <div class="flex gap-1.5">${rangeBtn('7', '7d')}${rangeBtn('30', '30d')}${rangeBtn('90', '90d')}${rangeBtn('365', '1y')}</div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${stat('New leads', d.leads.total, trendHtml)}
      ${stat('Pipeline', d.pipeline.total_contacts, `${d.pipeline.won} won`)}
      ${stat('Conversion', d.pipeline.conversion_pct + '%', 'contacts → sold/delivered')}
      ${stat('Open tasks', d.tasks.open, `${d.tasks.overdue} overdue · ${d.tasks.due_today} due today`)}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      ${card(`<div class="text-sm font-bold text-slate-900 dark:text-white mb-3">Lead sources</div><div class="space-y-2">${barList(d.leads.by_source, i => i.key)}</div>`)}
      ${card(`<div class="text-sm font-bold text-slate-900 dark:text-white mb-3">Pipeline funnel</div><div class="space-y-2">${funnelHtml}</div>`)}
      ${d.is_manager ? card(`<div class="text-sm font-bold text-slate-900 dark:text-white mb-3">Leads by rep</div><div class="space-y-2">${barList(d.leads.per_rep, i => i.name)}</div>`, 'lg:col-span-2') : ''}
    </div>`;
}
function crmInsightsRange(v) { __crmInsightsRange = v; loadCrmInsights(); }
window.crmInsightsRange = crmInsightsRange;

let __crmCanSeeAll = false;
let __crmStatusFilter = '';   // set by the "Sold Customers" nav leaf (comma list)
let __crmInitRep = '';        // "My Customer Database" nav leaf pre-filters to the current user
let __crmSearchAll = false;   // "Search Customers" leaf spans the whole dealership (all reps)
let __crmSourceFilter = '';   // 'marketsync' = only leads from our own website + AI chat + DR shells
let __crmPendingAdd = false;  // "Add Customer" nav leaf opens the New-contact form on load
const crmIsSoldView = () => !!__crmStatusFilter;
function crmClearStatusFilter() { __crmStatusFilter = ''; crmLoadContacts(); }
// "MarketSync leads" chip — toggle to only leads from our own website + AI chat + DR shells.
function crmToggleMarketSync() {
  __crmSourceFilter = __crmSourceFilter === 'marketsync' ? '' : 'marketsync';
  const chip = document.getElementById('crm-ms-chip');
  if (chip) {
    const on = __crmSourceFilter === 'marketsync';
    chip.className = `inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-lg border transition ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'}`;
  }
  crmRefreshContacts();
}
window.crmToggleMarketSync = crmToggleMarketSync;
window.crmClearStatusFilter = crmClearStatusFilter;
// Retitle the shared CRM page depending on whether we're on Customers or the
// Sold Customers view (both live on the same page container).
function crmApplyPageChrome() {
  const t = document.getElementById('crm-page-title'), s = document.getElementById('crm-page-sub');
  const search = document.getElementById('crm-search');
  if (crmIsSoldView()) {
    if (t) t.textContent = 'Sold Customers';
    if (s) s.textContent = 'Everyone who bought — their deal, sale source and salesperson, ready for delivery follow-up, referrals and equity mining.';
    if (search) search.placeholder = 'Search sold customers — name, email, phone…';
  } else {
    if (t) t.textContent = 'Customers';
    if (s) s.textContent = 'Every lead, appraisal and sale on one customer record — with a full activity timeline, follow-up tasks, and one-click email.';
    if (search) search.placeholder = 'Search ALL contacts — name, email, phone…';
  }
}
// Renders the persistent toolbar (search + manager "by rep" filter) ONCE, then
// only refreshes the list on search/filter so the search box keeps focus.
async function crmLoadContacts(targetEl) {
  const body = targetEl || document.getElementById('crm-body');
  if (!body) return;
  await crmEnsureLookups();   // reps for the "by rep" filter
  crmApplyPageChrome();
  body.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[200px]">
        <div class="relative flex-1 min-w-[200px] max-w-sm">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4-4"/></svg>
          <input id="crm-search" placeholder="${crmIsSoldView() ? 'Search sold customers — name, email, phone…' : 'Search ALL contacts — name, email, phone…'}" oninput="crmSearchDebounced()" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm">
        </div>
        <span id="crm-repfilter"></span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" id="crm-bulk-btn" data-admin-only onclick="openBulkOutreach()" class="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Bulk message
        </button>
        <button type="button" onclick="openCrmContactModal()" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          New contact
        </button>
      </div>
    </div>
    <div id="crm-list" class="py-10 text-center text-sm text-slate-400 italic">Loading contacts…</div>`;
  crmRefreshContacts();
}
function crmSearchDebounced() { clearTimeout(__crmSearchTimer); __crmSearchTimer = setTimeout(crmRefreshContacts, 300); }
async function crmRefreshContacts() {
  if (!document.getElementById('crm-list')) return;
  const q = (document.getElementById('crm-search')?.value || '').trim();
  // On first render the "by rep" select doesn't exist yet — fall back to the rep the
  // "My Customer Database" nav leaf pre-selected, so the first fetch is already scoped.
  const rep = document.getElementById('crm-rep')?.value ?? __crmInitRep;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (rep) params.set('rep', rep);
  if (__crmSearchAll && !rep) params.set('scope', 'all');   // whole-dealership browse for Search Customers
  if (__crmStatusFilter) params.set('status', __crmStatusFilter);
  if (__crmSourceFilter) params.set('source', __crmSourceFilter);
  try {
    const d = await apiGetJson(`/crm/contacts${params.toString() ? `?${params}` : ''}`);
    const list = document.getElementById('crm-list');
    if (!list) return;   // navigated away mid-fetch
    __crmCanSeeAll = d.can_see_all;
    // Render the "by rep" filter once managers are confirmed (kept across refreshes).
    const rf = document.getElementById('crm-repfilter');
    if (rf && d.can_see_all && !document.getElementById('crm-rep')) {
      rf.innerHTML = `<select id="crm-rep" onchange="crmRefreshContacts()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        <option value="">All reps</option>
        ${(__crmReps || []).map(r => `<option value="${r.id}" ${r.id === __crmInitRep ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
      </select>`;
    }
    const contacts = d.contacts || [];
    const soldView = crmIsSoldView();
    if (!contacts.length) {
      list.className = '';
      list.innerHTML = `<div class="py-16 text-center text-sm text-slate-400">${q || rep || __crmStatusFilter ? (soldView ? 'No sold customers match.' : 'No contacts match.') : 'No contacts yet — they appear automatically as you capture leads and save appraisals, or add one manually.'}</div>`;
      return;
    }
    const scopeNote = q ? 'searching all' : (rep ? 'one rep' : (d.can_see_all ? 'whole team' : 'yours'));
    list.className = '';
    // Sold Customers gets a purpose-built table (deal-oriented columns); the open
    // pipeline keeps the pipeline-move contact list.
    if (soldView) {
      list.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-sm text-left min-w-[640px]">
          <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider">
            <th class="py-2.5 px-4">Customer</th><th class="py-2.5 px-3">Stage</th><th class="py-2.5 px-3">Sale source</th><th class="py-2.5 px-3">Salesperson</th><th class="py-2.5 px-3 whitespace-nowrap">Sold</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">${contacts.map(crmSoldRow).join('')}</tbody>
        </table></div></div>
        <div class="text-[11px] text-slate-400 mt-2">${contacts.length} sold customer${contacts.length === 1 ? '' : 's'} · ${scopeNote}</div>`;
    } else {
      list.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        ${contacts.map(crmContactRow).join('')}</div>
        <div class="text-[11px] text-slate-400 mt-2">${contacts.length} contact${contacts.length === 1 ? '' : 's'} · ${scopeNote}</div>`;
    }
  } catch (e) {
    const list = document.getElementById('crm-list');
    if (list) list.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load contacts: ${esc(e.message)}<br><button onclick="crmRefreshContacts()" class="mt-3 text-indigo-500 font-bold">Retry</button></div>`;
  }
}
function crmContactRow(c) {
  const initials = (c.full_name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const sub = [c.email, c.phone].filter(Boolean).join(' · ');
  return `<div onclick="openCrmContact('${c.id}')" class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition">
    <div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-black flex-shrink-0">${esc(initials || '?')}</div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2"><span class="font-bold text-slate-900 dark:text-white truncate">${esc(c.full_name || 'Unknown')}</span>
        <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${crmStatusColor(c.status)}">${esc(crmChipText(c.status))}</span>
        ${c.dnc ? '<span class="text-[10px] font-bold text-rose-500">DNC</span>' : ''}
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(sub || '—')}</div>
    </div>
    <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
      <select onclick="event.stopPropagation()" onchange="crmQuickStatus(event,'${c.id}')" title="Move up the pipeline" class="text-[11px] font-bold border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 px-1.5 py-1 cursor-pointer">
        ${Object.entries(CRM_STATUS).map(([k, l]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      ${c.rep_name ? `<div class="text-[11px] text-slate-500 dark:text-slate-400">${esc(c.rep_name)}</div>` : ''}
      <div class="text-[11px] text-slate-400">${esc(crmWhen(c.last_activity_at || c.created_at))}</div>
    </div>
  </div>`;
}
// A row on the Sold Customers table — deal-oriented, distinct from the pipeline list.
function crmSoldRow(c) {
  const initials = (c.full_name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const sub = [c.email, c.phone].filter(Boolean).join(' · ');
  return `<tr onclick="openCrmContact('${c.id}')" class="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition">
    <td class="py-3 px-4">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs font-black flex-shrink-0">${esc(initials || '?')}</div>
        <div class="min-w-0">
          <div class="font-bold text-slate-900 dark:text-white truncate">${esc(c.full_name || 'Unknown')}${c.dnc ? ' <span class="text-[10px] font-bold text-rose-500">DNC</span>' : ''}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc(sub || '—')}</div>
        </div>
      </div>
    </td>
    <td class="py-3 px-3"><span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${crmStatusColor(c.status)}">${esc(crmChipText(c.status))}</span></td>
    <td class="py-3 px-3 text-slate-600 dark:text-slate-300">${esc(c.sold_source || c.source || '—')}</td>
    <td class="py-3 px-3 text-slate-600 dark:text-slate-300">${esc(c.rep_name || '—')}</td>
    <td class="py-3 px-3 text-slate-400 whitespace-nowrap">${esc(crmWhen(c.last_activity_at || c.created_at))}</td>
  </tr>`;
}
// Quick pipeline move from the list — PUT the new stage (fires automation server-side).
async function crmQuickStatus(ev, id) {
  ev.stopPropagation();
  const sel = ev.target, status = sel.value;
  sel.disabled = true;
  // On a win, capture where the deal came from — powers the ROI "sales by source".
  const body = { status };
  if (['sold', 'fni', 'delivered'].includes(status)) {
    const src = askSoldSource();
    if (src) body.sold_source = src;
  }
  try { await apiSendJson(`/crm/contacts/${id}`, 'PUT', body); showToast('Moved to ' + (CRM_STATUS[status] || status), 'success'); if (typeof crmRefreshContacts === 'function') crmRefreshContacts(); }
  catch (e) { showToast(e.message, 'error'); }
  finally { sel.disabled = false; }
}
// Sold-source is no longer prompted on the Sold click (too disruptive). The ROI
// "sales by source" report falls back to the contact's existing lead source, and it
// can still be set on the contact record directly.
function askSoldSource() { return null; }
window.crmQuickStatus = crmQuickStatus;

// ── Contact detail modal ─────────────────────────────────────────────────────
function crmOverlay(inner, maxW = 'max-w-2xl') {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-[9998] bg-black/50 flex items-start md:items-center justify-center p-3 overflow-y-auto';
  el.innerHTML = `<div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ${maxW} my-4 max-h-[92vh] overflow-y-auto" onclick="event.stopPropagation()">${inner}</div>`;
  el.addEventListener('click', () => el.remove());
  document.addEventListener('keydown', function esc2(ev) { if (ev.key === 'Escape') { el.remove(); document.removeEventListener('keydown', esc2); } });
  document.body.appendChild(el);
  return el;
}
// Can the current user make changes to this contact? Managers/admins always can;
// a rep can edit their own book (assigned to them) or an unassigned lead — otherwise
// it's read-only.
function canEditContact(c) {
  if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role)) return true;
  const rep = c.owner_id || c.assigned_to || c.rep_id || null;
  const me = profileContext?.id || user?.id || null;
  return !rep || rep === me;
}
// Minimize the open customer modal to a corner chip so a rep can keep it "parked"
// while they work elsewhere, then reopen it.
function crmMinimizeModal(btn) {
  const overlay = btn.closest('.fixed'); if (!overlay) return;
  const nameEl = overlay.querySelector('.text-lg.font-black');
  const name = nameEl ? nameEl.textContent.trim() : 'Customer';
  overlay.style.display = 'none';
  overlay.dataset.minimized = '1';
  document.getElementById('crm-min-chip')?.remove();
  const chip = document.createElement('div');
  chip.id = 'crm-min-chip';
  chip.className = 'fixed bottom-4 right-4 z-[9997] flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-full pl-4 pr-1.5 py-1.5';
  chip.innerHTML = `<span class="text-sm font-bold text-slate-700 dark:text-slate-200 max-w-[180px] truncate">${esc(name)}</span>
    <button onclick="crmRestoreModal()" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950/40">Open</button>
    <button onclick="crmCloseMinimized()" title="Close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 w-6 h-6 flex items-center justify-center rounded-full">×</button>`;
  document.body.appendChild(chip);
}
function crmRestoreModal() { const o = document.querySelector('.fixed[data-minimized="1"]'); if (o) { o.style.display = ''; delete o.dataset.minimized; } document.getElementById('crm-min-chip')?.remove(); }
function crmCloseMinimized() { document.querySelector('.fixed[data-minimized="1"]')?.remove(); document.getElementById('crm-min-chip')?.remove(); }
Object.assign(window, { crmMinimizeModal, crmRestoreModal, crmCloseMinimized });

async function openCrmContact(id, initialTab = 'timeline') {
  const ov = crmOverlay(`<div class="p-10 text-center text-sm text-slate-400 italic">Loading customer card…</div>`, 'max-w-4xl');
  try {
    const [d, eqData] = await Promise.all([
      apiGetJson(`/crm/contacts/${id}`).catch(e => ({ contact: {}, timeline: [], tasks: [] })),
      apiGetJson(`/equity/lease/by-contact/${id}`).catch(e => ({ lease: null, settings: {} }))
    ]);
    ov.querySelector('div > div').innerHTML = crmDetailHtml(d, eqData, initialTab);
    ov.__contactId = id;
    if (d.contact?.id) {
      setTimeout(() => { idvFillProvider(); idvRefresh(id); }, 100);
    }
  } catch (e) { ov.querySelector('div > div').innerHTML = `<div class="p-8 text-center text-sm text-slate-500">Couldn't load customer: ${esc(e.message)}</div>`; }
}

function crmSwitchCardTab(tabName) {
  ['timeline', 'equity', 'edit'].forEach(t => {
    const btn = document.getElementById(`crm-tab-btn-${t}`);
    const panel = document.getElementById(`crm-tab-panel-${t}`);
    if (btn) {
      if (t === tabName) {
        btn.className = 'px-4 py-2 text-xs font-bold border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 flex items-center gap-1.5';
      } else {
        btn.className = 'px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent flex items-center gap-1.5';
      }
    }
    if (panel) panel.classList.toggle('hidden', t !== tabName);
  });
}
window.crmSwitchCardTab = crmSwitchCardTab;

function crmEquityMiningTab(c, d, eqData) {
  const lease = eqData?.lease || {};
  const tv = c.trade_vehicle || {};
  const vehLabel = lease.vehicle || [tv.year, tv.make, tv.model, tv.trim].filter(Boolean).join(' ') || 'No trade vehicle on file';
  const vin = lease.vin || tv.vin || '—';
  const payment = lease.monthly_payment || 0;
  const payoff = lease.payoff_amount || lease.residual_value || 0;
  const estVal = lease.estimated_market_value || lease.wholesale_value || (payoff ? payoff + 2500 : 0);
  const netEq = lease.net_equity != null ? lease.net_equity : (estVal - payoff);

  const isPos = netEq >= 0;
  const eqBadge = (netEq !== 0 || payoff > 0)
    ? `<span class="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full ${isPos ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'}">${isPos ? '▲ +' : '▼ -'}$${Math.abs(netEq).toLocaleString()} ${isPos ? 'Positive Equity' : 'Negative Equity'}</span>`
    : `<span class="text-xs font-bold text-slate-400">Equity calculation pending</span>`;

  return `
    <div class="space-y-4">
      <div class="bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span class="text-sm font-bold text-white">Equity &amp; Lease Opportunity</span>
          </div>
          <div>${eqBadge}</div>
        </div>
        ${isPos ? `
        <div class="text-xs text-indigo-200 bg-indigo-950/80 border border-indigo-800/60 rounded-lg p-2.5 mb-3">
          ⚡ <b>Auto Alert:</b> Customer has <b>$${Math.abs(netEq).toLocaleString()}</b> in positive trade equity. Eligible to upgrade into a new vehicle with <b>$0 cash down</b> while keeping monthly payment at or under <b>$${payment ? payment : 'current'}/mo</b>.
        </div>` : `
        <div class="text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 mb-3">
          Customer currently has negative equity position ($${Math.abs(netEq).toLocaleString()}). Review lender roll-over terms or appraisal adjustment.
        </div>`}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
          <div class="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
            <div class="text-slate-400 font-medium">Trade Vehicle</div>
            <div class="font-bold text-white truncate" title="${esc(vehLabel)}">${esc(vehLabel)}</div>
            ${vin !== '—' ? `<div class="text-[10px] text-slate-500 font-mono">VIN ${esc(vin)}</div>` : ''}
          </div>
          <div class="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
            <div class="text-slate-400 font-medium">Est. Market Value</div>
            <div class="font-bold text-emerald-400 text-sm">$${Number(estVal || 0).toLocaleString()}</div>
          </div>
          <div class="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
            <div class="text-slate-400 font-medium">Payoff / Residual</div>
            <div class="font-bold text-slate-200 text-sm">$${Number(payoff || 0).toLocaleString()}</div>
          </div>
          <div class="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
            <div class="text-slate-400 font-medium">Monthly Payment</div>
            <div class="font-bold text-indigo-300 text-sm">${payment ? '$' + Number(payment).toLocaleString() + '/mo' : '—'}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="openDeskForContact('${c.id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6m3 6V7m3 10v-4M4 4h16v16H4z"/></svg>
            Desk Deal with Equity
          </button>
          <button onclick="apprFromContact(${JSON.stringify({ id: c.id, full_name: c.full_name || '', first_name: c.first_name || '', last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', address: c.address || '', postal_code: c.postal_code || '' }).replace(/'/g, "&#39;")})" class="text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Appraise Trade
          </button>
          ${c.email ? `<button onclick="crmEmailForm('${c.id}')" class="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M4 6h16v12H4z"/></svg>
            Send Equity Offer
          </button>` : ''}
        </div>
      </div>
    </div>`;
}

function crmEditFormContent(c) {
  const id = c.id;
  const inp = (id2, val, ph, cls = '') => `<input id="${id2}" value="${esc(val ?? '')}" placeholder="${esc(ph)}" class="${cls} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const repOpts = ['<option value="">— Unassigned —</option>'].concat((__crmReps || []).map(r => `<option value="${r.id}" ${c.assigned_rep === r.id ? 'selected' : ''}>${esc(r.name)}</option>`)).join('');
  const statusOpts = Object.entries(CRM_STATUS).map(([k, l]) => `<option value="${k}" ${(c.status || 'uncontacted') === k ? 'selected' : ''}>${l}</option>`).join('');
  const preInv = (__crmInventory || []).find(v => v.id === c.interest_inventory_id);
  const isCo = c.contact_type === 'company';
  const sect = (t) => `<div class="text-[11px] font-black uppercase tracking-wider text-indigo-500 pt-2 border-t border-slate-100 dark:border-slate-800">${t}</div>`;

  return `
    <div class="space-y-3 pt-2">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-bold text-slate-900 dark:text-white">Customer Record &amp; Identification</div>
        <button type="button" onclick="crmScanLicense()" title="Scan driver's licence" class="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>Scan licence
        </button>
      </div>
      <input type="file" id="crm-license-file" accept="image/*" capture="environment" class="hidden">
      <div id="crm-license-status" class="hidden text-xs rounded-lg px-3 py-2"></div>
      <div class="flex gap-2">
        <label class="flex-1"><input type="radio" name="crm-ctype" value="individual" ${!isCo ? 'checked' : ''} class="peer hidden" onchange="crmToggleCompany(false)"><span class="block text-center text-xs font-bold py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 cursor-pointer">Individual</span></label>
        <label class="flex-1"><input type="radio" name="crm-ctype" value="company" ${isCo ? 'checked' : ''} class="peer hidden" onchange="crmToggleCompany(true)"><span class="block text-center text-xs font-bold py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 peer-checked:bg-indigo-600 peer-checked:text-white peer-checked:border-indigo-600 cursor-pointer">Company</span></label>
      </div>
      <div id="crm-company-row" class="${isCo ? '' : 'hidden'}">${lbl('Company name')}${inp('crm-f-company', c.company_name, 'Company name', 'w-full')}</div>
      ${sect('Name')}
      <div class="grid grid-cols-2 gap-2">
        <div>${lbl('First name')}${inp('crm-f-first', c.first_name, 'First', 'w-full')}</div>
        <div>${lbl('Last name')}${inp('crm-f-last', c.last_name, 'Last', 'w-full')}</div>
        <div>${lbl('Middle name')}${inp('crm-f-middle', c.middle_name, 'Middle', 'w-full')}</div>
        <div>${lbl('Suffix')}${inp('crm-f-suffix', c.suffix, 'Jr, Sr, III', 'w-full')}</div>
      </div>
      ${sect('Contact')}
      <div>${lbl('Email')}${inp('crm-f-email', c.email, 'name@email.com', 'w-full')}</div>
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('Mobile #')}${inp('crm-f-mobile', c.phone_mobile || c.phone, 'Mobile', 'w-full')}</div>
        <div>${lbl('Home #')}${inp('crm-f-home', c.phone_home, 'Home', 'w-full')}</div>
        <div>${lbl('Work #')}${inp('crm-f-work', c.phone_work, 'Work', 'w-full')}</div>
      </div>
      ${sect('Address')}
      <div>${lbl('Street address')}${inp('crm-f-address', c.address, 'Street address', 'w-full')}</div>
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('City')}${inp('crm-f-city', c.city, 'City', 'w-full')}</div>
        <div>${lbl('Province / State')}${inp('crm-f-province', c.province || (window.__dealerLocale?.province || ''), 'ON', 'w-full')}</div>
        <div>${lbl('Postal / ZIP')}${inp('crm-f-postal', c.postal_code, 'A1A 1A1', 'w-full')}</div>
      </div>
      ${sect('Identification')}
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('Birthday')}<input id="crm-f-birthday" type="date" value="${esc(c.birthday || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div>${lbl("Driver's licence #")}${inp('crm-f-dl', c.dl_number, 'DL number', 'w-full')}</div>
        <div>${lbl('DL expiry')}<input id="crm-f-dlexp" type="date" value="${esc(c.dl_expiry || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      </div>
      ${id ? idvBlock(c) : ''}
      ${id ? vehicleFitBlock(c) : ''}
      ${sect('Source & assignment')}
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('Source')}${(() => {
          const cur = c.source || '';
          const match = CRM_SOURCES.find(p => p.toLowerCase() === cur.toLowerCase());
          const sel = match || (cur ? '__other' : '');
          return `<select id="crm-f-source-sel" onchange="crmSourceOther(this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="">— Where did they come from? —</option>
            ${CRM_SOURCES.map(o => `<option value="${esc(o)}" ${sel === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
            <option value="__other" ${sel === '__other' ? 'selected' : ''}>Other (type your own)…</option>
          </select>
          <input id="crm-f-source" value="${esc(cur)}" placeholder="Type the source" class="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm ${sel === '__other' ? '' : 'hidden'}">`;
        })()}</div>
        <div>${lbl('Salesperson')}<select id="crm-f-rep" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${repOpts}</select></div>
        <div>${lbl('Status')}<select id="crm-f-status" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${statusOpts}</select></div>
      </div>
      ${sect('Notes')}
      <textarea id="crm-f-notes" rows="2" placeholder="Notes" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(c.notes || '')}</textarea>
      <div class="flex gap-2 justify-end pt-2">
        <button onclick="crmSaveContact(this, ${id ? `'${id}'` : 'null'})" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg">${id ? 'Save Changes' : 'Create Customer'}</button>
      </div>
    </div>`;
}

function crmDetailHtml(d, eqData = {}, initialTab = 'timeline') {
  const c = d.contact;
  const canEdit = canEditContact(c);
  const phone = (c.phone || c.phone_mobile || c.phone_home || c.phone_work || '').trim();
  crmIndexTranscripts(d.timeline);
  const initials = (c.full_name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const openTasks = (d.tasks || []).filter(t => !t.done);

  return `
  <div class="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-start justify-between gap-3 z-10">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-sm font-black flex-shrink-0">${esc(initials || '?')}</div>
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap"><span class="text-lg font-black text-slate-900 dark:text-white truncate">${esc(c.full_name || 'Unknown')}</span>
          <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${crmStatusColor(c.status)}">${esc(crmChipText(c.status))}</span>
          ${c.is_sales_customer ? '<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" title="Has sales history">Sales</span>' : ''}
          ${c.is_service_customer ? '<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" title="Has service history">Service</span>' : ''}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${esc([c.email, phone].filter(Boolean).join(' · ') || 'No contact info')}</div>
      </div>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0">
      <button onclick="crmMinimizeModal(this)" title="Minimize" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M5 12h14"/></svg></button>
      <button onclick="this.closest('.fixed').remove()" title="Close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
  </div>

  <!-- Primary Operations Bar -->
  <div class="px-5 pt-3 flex flex-wrap gap-2 ${!canEdit ? 'hidden' : ''}">
    ${c.email && !c.dnc && c.consent_email !== false ? `<button onclick="crmEmailForm('${c.id}')" class="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M4 6h16v12H4z"/></svg>Email</button>` : ''}
    ${phone ? `<a href="tel:${esc(phone)}" onclick="crmQuickLog('${c.id}','call')" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>Call</a>` : ''}
    ${phone ? `<a href="sms:${esc(phone)}" onclick="crmQuickLog('${c.id}','sms')" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h8M8 8h8m-8 8h4m5-13H3v14l4-3h14V3z"/></svg>Text</a>` : ''}
    <button onclick="crmLogForm('${c.id}')" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">Log activity</button>
    <button onclick="crmTaskForm('${c.id}')" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">Add task</button>
    <button onclick="crmApptForm('${c.id}')" class="flex items-center gap-1.5 text-xs font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>Book appointment</button>
    ${SALES_ROLES.includes(profileContext?.role) ? `<button onclick="openDeskForContact('${c.id}')" class="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6m3 6V7m3 10v-4M4 4h16v16H4z"/></svg>${d.deal ? 'View deal' : 'Desk deal'}</button>` : ''}
    ${SALES_ROLES.includes(profileContext?.role) ? `<button onclick='apprFromContact(${JSON.stringify({ id: c.id, full_name: c.full_name || '', first_name: c.first_name || '', last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', address: c.address || '', postal_code: c.postal_code || '' }).replace(/'/g, "&#39;")})' class="flex items-center gap-1.5 text-xs font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>Appraise vehicle</button>` : ''}
  </div>

  <!-- Unified Sub-Tabs Header -->
  <div class="px-5 mt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
    <button id="crm-tab-btn-timeline" onclick="crmSwitchCardTab('timeline')" class="px-4 py-2 text-xs font-bold ${initialTab === 'timeline' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'} flex items-center gap-1.5">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Activity &amp; Timeline
    </button>
    <button id="crm-tab-btn-equity" onclick="crmSwitchCardTab('equity')" class="px-4 py-2 text-xs font-bold ${initialTab === 'equity' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'} flex items-center gap-1.5">
      <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
      Equity Mining
    </button>
    <button id="crm-tab-btn-edit" onclick="crmSwitchCardTab('edit')" class="px-4 py-2 text-xs font-bold ${initialTab === 'edit' ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-b-2 border-transparent'} flex items-center gap-1.5">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
      Customer Record &amp; ID
    </button>
  </div>

  <div class="p-5">
    <!-- Tab 1: Timeline -->
    <div id="crm-tab-panel-timeline" class="${initialTab === 'timeline' ? '' : 'hidden'} space-y-4">
      ${c.notes ? `<div class="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-950/40 rounded-lg p-3 text-slate-700 dark:text-slate-300">${esc(c.notes)}</div>` : ''}
      ${crmVehicleCards(c, d)}
      ${crmDetailFacts(c, d)}
      ${openTasks.length ? `<div>
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Open tasks</div>
        <div class="space-y-1.5">${openTasks.map(t => crmTaskRow(t, c.id)).join('')}</div>
      </div>` : ''}
      ${crmAttachmentsHtml(c, d)}
      <div id="crm-detail-form"></div>
      <div>
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Activity timeline</div>
        ${(d.timeline || []).length ? `<div class="space-y-2.5">${d.timeline.map(t => crmTimelineItem(t, c.id)).join('')}</div>`
          : '<div class="text-sm text-slate-400 italic py-4">No activity yet.</div>'}
      </div>
    </div>

    <!-- Tab 2: Equity Mining -->
    <div id="crm-tab-panel-equity" class="${initialTab === 'equity' ? '' : 'hidden'}">
      ${crmEquityMiningTab(c, d, eqData)}
    </div>

    <!-- Tab 3: Customer Record & Intake Form -->
    <div id="crm-tab-panel-edit" class="${initialTab === 'edit' ? '' : 'hidden'}">
      ${crmEditFormContent(c)}
    </div>
  </div>`;
}
// Registry of saved AI/marketplace transcripts on the open contact, keyed by comm id,
// so the "View AI conversation" button can open a modal without another round-trip.
let __chatTx = {};
function crmIndexTranscripts(timeline) {
  __chatTx = {};
  for (const t of (timeline || [])) {
    if (t.kind === 'comm' && t.id && t.meta && t.meta.kind === 'ai_chat' && Array.isArray(t.meta.transcript)) {
      __chatTx[t.id] = { transcript: t.meta.transcript, source: t.meta.source || 'other', at: t.at };
    }
  }
}
function openChatTx(id) {
  const rec = __chatTx[id]; if (!rec) return showToast('Conversation not found', 'error');
  const SRC = { website: 'Website AI chat', marketplace: 'Marketplace conversation', sms: 'Text conversation', other: 'AI conversation' };
  const bubbles = rec.transcript.map(m => {
    const mine = m.role === 'assistant';   // the dealership/AI side
    return `<div class="flex ${mine ? 'justify-start' : 'justify-end'}">
      <div class="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-indigo-50 dark:bg-indigo-950/40 text-slate-800 dark:text-slate-100 rounded-tl-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tr-sm'}">
        <div class="text-[10px] font-bold uppercase tracking-wide mb-0.5 ${mine ? 'text-indigo-500 dark:text-indigo-300' : 'text-slate-400'}">${mine ? svgIcon('sparkles', 'w-3 h-3 inline-block -mt-0.5') + ' AI' : 'Customer'}</div>
        <div class="whitespace-pre-wrap">${esc(m.content)}</div>
      </div></div>`;
  }).join('');
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1">
      <div><div class="text-lg font-black text-slate-900 dark:text-white">${SRC[rec.source] || 'AI conversation'}</div>
        <div class="text-xs text-slate-400">${rec.transcript.length} messages${rec.at ? ' · ' + esc(crmWhen(rec.at)) : ''} — this is what the AI told the customer.</div></div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="mt-3 space-y-2 max-h-[65vh] overflow-y-auto pr-1">${bubbles}</div>
  </div>`, 'max-w-lg');
}
window.openChatTx = openChatTx;
// ── Attachments: photos, videos & files reps add to a customer ───────────────
function crmFileSize(n) { if (!n) return ''; return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function crmAttachmentTile(a, contactId) {
  const del = `<button onclick="event.stopPropagation();crmDeleteAttachment('${a.id}','${contactId}')" title="Remove" class="absolute top-1 right-1 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center">×</button>`;
  if (a.kind === 'image') {
    return `<div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">${del}<a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.url)}" loading="lazy" class="w-full h-full object-cover"></a></div>`;
  }
  if (a.kind === 'video') {
    return `<div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">${del}<video src="${esc(a.url)}" controls preload="metadata" class="w-full h-full object-contain"></video></div>`;
  }
  return `<div class="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center p-2 text-center">${del}
    <a href="${esc(a.url)}" target="_blank" rel="noopener" class="flex flex-col items-center gap-1">
      <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2z"/></svg>
      <span class="text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[80px]">${esc(a.filename || 'file')}</span>
      ${a.size ? `<span class="text-[9px] text-slate-400">${crmFileSize(a.size)}</span>` : ''}
    </a></div>`;
}
function crmAttachmentsHtml(c, d) {
  const atts = d.attachments || [];
  return `<div>
    <div class="flex items-center justify-between mb-1.5">
      <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Attachments${atts.length ? ` · ${atts.length}` : ''}</div>
    </div>
    <input id="crm-att-file" type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple class="hidden" onchange="crmUploadAttachments('${c.id}', this.files); this.value='';">
    <input id="crm-att-photo" type="file" accept="image/*" capture="environment" class="hidden" onchange="crmUploadAttachments('${c.id}', this.files); this.value='';">
    <input id="crm-att-video" type="file" accept="video/*" capture="environment" class="hidden" onchange="crmUploadAttachments('${c.id}', this.files); this.value='';">
    <div class="flex flex-wrap gap-2 mb-2">
      <button type="button" onclick="document.getElementById('crm-att-file').click()" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20 11"/></svg>Attach files</button>
      <button type="button" onclick="document.getElementById('crm-att-photo').click()" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg>Take photo</button>
      <button type="button" onclick="document.getElementById('crm-att-video').click()" class="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>Record video</button>
    </div>
    <div id="crm-att-status" class="hidden text-xs text-slate-400 mb-2"></div>
    ${atts.length ? `<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">${atts.map(a => crmAttachmentTile(a, c.id)).join('')}</div>` : '<div class="text-xs text-slate-400 italic">No attachments yet — add photos of the trade, docs, or a walkaround video.</div>'}
  </div>`;
}
async function crmUploadAttachments(contactId, fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const status = document.getElementById('crm-att-status');
  const big = files.find(f => f.size > 60 * 1024 * 1024);
  if (big) { showToast(`"${big.name}" is over 60 MB — too large to attach.`, 'error'); return; }
  if (status) { status.classList.remove('hidden'); status.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}…`; }
  try {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const r = await fetch(`${API}/crm/contacts/${contactId}/attachments`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Upload failed');
    showToast('Attached', 'success');
    openCrmContact(contactId);   // refresh the detail so the new items show
  } catch (e) { if (status) status.classList.add('hidden'); showToast(e.message || 'Upload failed', 'error'); }
}
async function crmDeleteAttachment(id, contactId) {
  if (!confirm('Remove this attachment?')) return;
  try { await apiSendJson(`/crm/attachments/${id}`, 'DELETE'); showToast('Removed', 'success'); openCrmContact(contactId); }
  catch (e) { showToast(e.message, 'error'); }
}
window.crmUploadAttachments = crmUploadAttachments; window.crmDeleteAttachment = crmDeleteAttachment;

// No phone on file yet — prompt to add one, then open the edit form.
function crmNeedPhone(id) {
  showToast('Add a phone number for this customer first', 'info');
  if (typeof crmOpenForm === 'function') crmOpenForm(id);
}
window.crmNeedPhone = crmNeedPhone;

// Compact facts grid on the contact detail (address, DL, birthday, extra phones,
// source/salesperson, trade + new-car-of-interest vehicles).
function crmDetailFacts(c, d) {
  const rows = [];
  const fact = (k, v) => { if (v) rows.push(`<div><dt class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${esc(k)}</dt><dd class="text-sm text-slate-800 dark:text-slate-100">${esc(v)}</dd></div>`); };
  if (c.contact_type === 'company') fact('Company', c.company_name);
  const addr = [c.address, [c.city, c.province, c.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  fact('Address', addr);
  if (c.phone_home) fact('Home #', c.phone_home);
  if (c.phone_work) fact('Work #', c.phone_work);
  if (c.birthday) fact('Birthday', new Date(c.birthday).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }));
  if (c.dl_number) fact("Driver's licence", c.dl_number + (c.dl_expiry ? ` (exp ${new Date(c.dl_expiry).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })})` : ''));
  fact('Source', c.source);
  fact('Salesperson', c.rep_name);
  // Trade-in + desired vehicle now render as their own cards (crmVehicleCards).
  if (!rows.length) return '';
  return `<dl class="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3">${rows.join('')}</dl>`;
}
// Prominent cards: the vehicle they want to buy + their trade-in (pulled from the
// appraisal). The desired-vehicle card carries the Desk-a-Deal action.
function crmVehicleCards(c, d) {
  const cards = [];
  const wants = d.interest_vehicle_label;
  if (wants && wants.label) {
    const canDesk = canEditContact(c) && SALES_ROLES.includes(profileContext?.role);
    // If the interest is pinned to a real stock unit, link straight to it (VDP) —
    // opens the Inventory catalog filtered to its stock #, like the stocking recs.
    const vdp = (wants.inventory_id && (wants.stocknumber || wants.inventory_id))
      ? `<a href="#" onclick="switchPage('inventory');const s=document.getElementById('catalog-search');if(s){s.value='${esc(wants.stocknumber || wants.inventory_id)}';renderCatalog();}return false;" class="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline">${wants.stocknumber ? '#' + esc(wants.stocknumber) : 'View unit'} →</a>`
      : '';
    cards.push(`<div class="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 rounded-xl p-3">
      <div class="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1 flex items-center gap-1">${svgIcon('car', 'w-3.5 h-3.5')}Wants to buy</div>
      <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(wants.label)}</div>
      <div class="flex items-center gap-2 flex-wrap">
        ${wants.price ? `<span class="text-[12px] text-slate-500 dark:text-slate-400">$${Number(wants.price).toLocaleString()}</span>` : ''}
        ${vdp}
      </div>
      ${canDesk ? `<button onclick="openDeskForContact('${c.id}')" class="mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">${d.deal ? 'View deal' : 'Desk a deal'}</button>` : ''}
    </div>`);
  }
  const tv = c.trade_vehicle;
  if (tv && (tv.make || tv.vin)) {
    const label = [tv.year, tv.make, tv.model, tv.trim].filter(Boolean).join(' ');
    const sub = [tv.mileage ? Number(tv.mileage).toLocaleString() + ' km' : '', tv.vin ? 'VIN ' + tv.vin : ''].filter(Boolean).join(' · ');
    cards.push(`<div class="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
      <div class="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1 flex items-center gap-1">${svgIcon('tag', 'w-3.5 h-3.5')}Trade-in</div>
      <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(label || 'Trade vehicle')}</div>
      ${sub ? `<div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(sub)}</div>` : ''}
      ${SALES_ROLES.includes(profileContext?.role) ? `<button onclick="switchPage('appraisal')" class="mt-2 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200">${tv.appraisal_id ? 'View appraisal' : 'Appraise car'}</button>` : ''}
    </div>`);
  }
  // Insurance — pulled from the deal once F&I fills it on the desk.
  const insr = d.deal?.insurance;
  if (insr && (insr.company || insr.policy || insr.agent || insr.phone || insr.expiry)) {
    const line = [insr.policy ? 'Policy ' + insr.policy : '', insr.agent || '', insr.phone || '', insr.expiry ? 'exp ' + insr.expiry : ''].filter(Boolean).join(' · ');
    cards.push(`<div class="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
      <div class="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-1 flex items-center gap-1">${svgIcon('shield', 'w-3.5 h-3.5')}Insurance</div>
      <div class="text-sm font-bold text-slate-900 dark:text-white">${esc(insr.company || 'On file')}</div>
      ${line ? `<div class="text-[12px] text-slate-500 dark:text-slate-400">${esc(line)}</div>` : ''}
    </div>`);
  }
  if (!cards.length) return '';
  return `<div class="flex flex-wrap gap-3">${cards.join('')}</div>`;
}
function crmTaskRow(t, contactId) {
  const overdue = t.due_at && new Date(t.due_at) < Date.now();
  const isAppt = t.type === 'appointment';
  const dot = t.type === 'lead_followup' ? 'bg-orange-500' : t.type === 'delivery_followup' ? 'bg-emerald-500' : isAppt ? 'bg-violet-500' : '';
  // Appointments get outcome actions so the timeline records show / no-show / cancel,
  // plus reschedule (opens a new date/time picker).
  const acts = (isAppt && !t.done && contactId) ? `<div class="flex flex-wrap gap-1.5 mt-1 ml-6">
      <button onclick="crmApptOutcome('${t.id}','${contactId}','showed')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200">Showed</button>
      <button onclick="crmApptOutcome('${t.id}','${contactId}','no_show')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-200">No-show</button>
      <button onclick="crmApptOutcome('${t.id}','${contactId}','cancelled')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Cancel</button>
      <button onclick="crmApptReschedule('${t.id}','${contactId}',${JSON.stringify(t.title || 'Appointment').replace(/"/g, '&quot;')},'${t.due_at || ''}')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200">Reschedule</button>
    </div>` : '';
  return `<div>
    <div class="flex items-center gap-2 text-sm">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="crmToggleTask('${t.id}', this.checked, '${contactId}')" class="w-4 h-4 rounded accent-indigo-600 flex-shrink-0">
      ${dot ? `<span class="w-2 h-2 rounded-full ${dot} flex-shrink-0" title="${isAppt ? 'Appointment' : t.type === 'lead_followup' ? 'New-lead follow-up' : 'Delivery follow-up'}"></span>` : ''}
      <span class="flex-1 ${t.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}">${esc(t.title)}</span>
      ${t.due_at ? `<span class="text-[11px] ${overdue && !t.done ? 'text-rose-500 font-bold' : 'text-slate-400'}">${esc(crmWhen(t.due_at))}</span>` : ''}
    </div>
    ${acts}
  </div>`;
}
// Appointment outcomes — mark the task resolved and record what happened on the timeline.
async function crmApptOutcome(taskId, contactId, outcome) {
  const map = {
    showed:    { subject: 'Appointment — showed',    body: 'Customer showed for the appointment.' },
    no_show:   { subject: 'Appointment — no-show',    body: 'Customer did not show (no-show).' },
    cancelled: { subject: 'Appointment — cancelled',  body: 'Appointment cancelled.' },
  };
  const m = map[outcome]; if (!m) return;
  try {
    await apiSendJson(`/crm/tasks/${taskId}`, 'PUT', { done: true });
    await apiSendJson(`/crm/contacts/${contactId}/log`, 'POST', { channel: 'note', direction: 'internal', subject: m.subject, body: m.body });
    showToast('Updated', 'success'); openCrmContact(contactId);
  } catch (e) { showToast(e.message, 'error'); }
}
function crmApptReschedule(taskId, contactId, title, dueAt) {
  const d = dueAt ? new Date(dueAt) : new Date();
  const dateStr = isNaN(d) ? '' : d.toISOString().slice(0, 10);
  const timeStr = isNaN(d) ? '09:00' : d.toTimeString().slice(0, 5);
  const iCls = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm';
  crmDetailFormSlot(`<div class="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 rounded-lg p-3 space-y-2">
    <div class="text-sm font-bold text-slate-800 dark:text-slate-100">Reschedule appointment</div>
    <div class="flex gap-2"><input id="crm-resch-date" type="date" value="${dateStr}" class="${iCls}"><input id="crm-resch-time" type="time" value="${timeStr}" class="${iCls}"></div>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmApptRescheduleSave('${taskId}','${contactId}',${JSON.stringify(title || 'Appointment').replace(/"/g, '&quot;')})" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg">Save new time</button></div>
  </div>`);
}
async function crmApptRescheduleSave(taskId, contactId, title) {
  const date = document.getElementById('crm-resch-date')?.value;
  const time = document.getElementById('crm-resch-time')?.value || '09:00';
  if (!date) { showToast('Pick a date', 'error'); return; }
  const iso = new Date(`${date}T${time}`).toISOString();
  try {
    await apiSendJson(`/crm/tasks/${taskId}`, 'PUT', { due_at: iso });
    await apiSendJson(`/crm/contacts/${contactId}/log`, 'POST', { channel: 'note', direction: 'internal', subject: 'Appointment rescheduled', body: `${title} moved to ${new Date(iso).toLocaleString()}` });
    showToast('Rescheduled', 'success'); openCrmContact(contactId);
  } catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { crmApptOutcome, crmApptReschedule, crmApptRescheduleSave });
function crmTimelineItem(t, cid) {
  const chIco = { call: 'phone', sms: 'chat', email: 'mail', note: 'note' };
  let head = '', bodyTxt = t.body || '', reply = '', iconName = 'note';
  if (t.kind === 'comm') {
    // Saved AI/marketplace transcript → show a "View AI conversation" opener.
    if (t.meta && t.meta.kind === 'ai_chat' && t.id) {
      const SRC = { website: 'Website AI chat', marketplace: 'Marketplace conversation', sms: 'Text conversation', other: 'AI conversation' };
      const n = Array.isArray(t.meta.transcript) ? t.meta.transcript.length : 0;
      return `<div class="flex gap-2.5">
        <div class="w-7 flex-shrink-0 flex justify-center pt-0.5 text-indigo-500">${msIco('chat', 'w-4 h-4')}</div>
        <div class="min-w-0 flex-1 border-l-2 border-slate-100 dark:border-slate-800 pl-3 pb-1">
          <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">${svgIcon('sparkles', 'w-4 h-4 text-indigo-500')}${esc(SRC[t.meta.source] || 'AI conversation')}</div>
          <div class="text-sm text-slate-600 dark:text-slate-300 mt-0.5">${n} message${n === 1 ? '' : 's'} with the AI concierge.</div>
          <button onclick="openChatTx('${t.id}')" class="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">${msIco('chat', 'w-3 h-3')} View AI conversation</button>
          <div class="text-[11px] text-slate-400 mt-0.5">${esc(crmWhen(t.at))}</div>
        </div>
      </div>`;
    }
    iconName = chIco[t.channel] || 'note';
    const label = { call: 'Call', sms: 'Text', email: 'Email', note: 'Note', system: 'System', chat: 'Chat' }[t.channel] || 'Note';
    const dir = t.direction === 'in' ? ' (inbound)' : t.direction === 'out' ? ' (outbound)' : '';
    head = `${label}${dir}${t.subject ? ` — ${esc(t.subject)}` : ''}`;
    // Reply to an inbound customer message right from the timeline.
    if (cid && t.direction === 'in' && ['sms', 'email', 'call'].includes(t.channel)) {
      reply = `<button onclick="crmReplyForm('${cid}','${t.channel}',${JSON.stringify(t.subject || '').replace(/"/g, '&quot;')})" class="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">${msIco('reply', 'w-3 h-3')} Reply</button>`;
    }
    // Booked appointment with a video link → one-tap Join.
    if (t.meta && t.meta.meet_url) {
      reply = `<a href="${esc(t.meta.meet_url)}" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">${msIco('calendar', 'w-3 h-3')} Join video call</a>` + reply;
    }
  } else if (t.kind === 'lead') {
    iconName = 'inbox';
    head = `Lead${t.source ? ` · ${esc(t.source)}` : ''}${t.vehicle ? ` — ${esc(t.vehicle)}` : ''}`;
  } else if (t.kind === 'appraisal') {
    iconName = 'car';
    head = `Appraisal — ${esc(t.vehicle || 'vehicle')}${t.offer != null ? ` · offer ${crmMoney(t.offer, t.currency)}` : ''}`;
    bodyTxt = '';
  } else if (t.kind === 'sale') { iconName = 'check'; }
  return `<div class="flex gap-2.5">
    <div class="w-7 flex-shrink-0 flex justify-center pt-0.5 text-slate-400">${msIco(iconName, 'w-4 h-4')}</div>
    <div class="min-w-0 flex-1 border-l-2 border-slate-100 dark:border-slate-800 pl-3 pb-1">
      <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">${head}</div>
      ${bodyTxt ? `<div class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mt-0.5">${esc(bodyTxt)}</div>` : ''}
      <div class="text-[11px] text-slate-400 mt-0.5">${esc(crmWhen(t.at))}${t.rep ? ` · ${esc(t.rep)}` : ''}</div>
      ${reply}
    </div>
  </div>`;
}

// ── Inline forms inside the detail modal ─────────────────────────────────────
function crmDetailFormSlot(html) { const s = document.getElementById('crm-detail-form'); if (s) { s.innerHTML = html; s.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }
function crmLogForm(id) {
  crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
    <div class="flex gap-2">
      <select id="crm-log-channel" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="note">Note</option><option value="call">Call</option><option value="sms">Text</option><option value="email">Email</option></select>
      <input id="crm-log-subject" placeholder="Subject (optional)" class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
    </div>
    <textarea id="crm-log-body" rows="2" placeholder="What happened?" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></textarea>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmSaveLog('${id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Log it</button></div>
  </div>`);
}
async function crmSaveLog(id) {
  const channel = document.getElementById('crm-log-channel')?.value || 'note';
  const subject = document.getElementById('crm-log-subject')?.value || '';
  const body = document.getElementById('crm-log-body')?.value || '';
  // A call / text / email touch must carry a note (audit): reps log what happened.
  if (channel !== 'note' && !body.trim()) { showToast(`Add a note about the ${channel === 'sms' ? 'text' : channel}`, 'error'); return; }
  if (!body.trim() && !subject.trim()) { showToast('Add a note', 'error'); return; }
  try { await apiSendJson(`/crm/contacts/${id}/log`, 'POST', { channel, subject, body, direction: channel === 'note' ? 'internal' : 'out' }); showToast('Logged', 'success'); openCrmContact(id); }
  catch (e) { showToast(e.message, 'error'); }
}
// Reply to an inbound message from the timeline. Email actually sends; other
// channels record an outbound touch (no SMS gateway wired here).
function crmReplyForm(id, channel, subject) {
  const isEmail = channel === 'email';
  const re = subject && !/^re:/i.test(subject) ? `Re: ${subject}` : (subject || '');
  crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
    <div class="text-xs font-bold text-slate-600 dark:text-slate-300">Reply via ${isEmail ? 'email' : channel === 'sms' ? 'text' : 'call note'}</div>
    ${isEmail ? `<input id="crm-reply-subject" value="${esc(re)}" placeholder="Subject" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">` : ''}
    <textarea id="crm-reply-body" rows="3" placeholder="${isEmail ? 'Type your reply…' : 'What you said / will say…'}" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></textarea>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button id="crm-reply-send" onclick="crmSendReply('${id}','${channel}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">${isEmail ? 'Send email' : 'Log reply'}</button></div>
  </div>`);
}
async function crmSendReply(id, channel) {
  const body = (document.getElementById('crm-reply-body')?.value || '').trim();
  if (!body) { showToast('Write a reply first', 'error'); return; }
  const btn = document.getElementById('crm-reply-send');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    if (channel === 'email') {
      const subject = (document.getElementById('crm-reply-subject')?.value || '').trim();
      if (!subject) { showToast('Add a subject', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Send email'; } return; }
      await apiSendJson(`/crm/contacts/${id}/email`, 'POST', { subject, body });
      showToast('Email sent', 'success');
    } else {
      await apiSendJson(`/crm/contacts/${id}/log`, 'POST', { channel, subject: '', body, direction: 'out' });
      showToast('Reply logged', 'success');
    }
    openCrmContact(id);
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = channel === 'email' ? 'Send email' : 'Log reply'; } showToast(e.message, 'error'); }
}
window.crmReplyForm = crmReplyForm;
window.crmSendReply = crmSendReply;

// Fired when a rep taps Call/Text — opens a wrap-up so the touch is logged WITH a
// required note (and, for calls, the time spent). A live timer runs while the call
// is in progress; "Use timer" stamps the elapsed duration.
let __crmCallTimer = null;
function crmQuickLog(id, channel) {
  const isCall = channel === 'call';
  crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${isCall ? 'Call wrap-up' : 'Text wrap-up'}</div>
      ${isCall ? `<div class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400" id="crm-call-timer" data-start="${Date.now()}">0:00</div>` : ''}
    </div>
    ${isCall ? `<div class="flex items-center gap-2"><label class="text-xs text-slate-500">Duration</label><input id="crm-call-dur" type="text" placeholder="e.g. 5m" class="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm"><button type="button" onclick="crmCallStamp()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">Use timer</button></div>` : ''}
    <textarea id="crm-ql-note" rows="2" placeholder="Add a note (required) — what happened?" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></textarea>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmQuickLogSave('${id}','${channel}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Log ${isCall ? 'call' : 'text'}</button></div>
  </div>`);
  if (isCall) crmStartCallTimer();
}
function crmStartCallTimer() {
  clearInterval(__crmCallTimer);
  __crmCallTimer = setInterval(() => {
    const el = document.getElementById('crm-call-timer');
    if (!el) { clearInterval(__crmCallTimer); return; }   // form closed → stop
    const s = Math.floor((Date.now() - Number(el.dataset.start)) / 1000);
    el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}
function crmCallStamp() {
  const el = document.getElementById('crm-call-timer'), d = document.getElementById('crm-call-dur');
  if (!el || !d) return;
  const s = Math.floor((Date.now() - Number(el.dataset.start)) / 1000);
  d.value = s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}
async function crmQuickLogSave(id, channel) {
  const note = (document.getElementById('crm-ql-note')?.value || '').trim();
  if (!note) { showToast('Add a note before saving', 'error'); return; }
  let body = note;
  if (channel === 'call') { const dur = (document.getElementById('crm-call-dur')?.value || '').trim(); body = dur ? `Call (${dur}) — ${note}` : `Call — ${note}`; }
  else if (channel === 'sms') body = `Text — ${note}`;
  clearInterval(__crmCallTimer);
  try { await apiSendJson(`/crm/contacts/${id}/log`, 'POST', { channel, direction: 'out', body }); showToast('Logged', 'success'); openCrmContact(id); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { crmQuickLog, crmStartCallTimer, crmCallStamp, crmQuickLogSave });
function crmEmailForm(id) {
  crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-indigo-200 dark:border-indigo-900 rounded-lg p-3 space-y-2">
    <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Send email</div>
    <input id="crm-email-subject" placeholder="Subject" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
    <textarea id="crm-email-body" rows="4" placeholder="Message…" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></textarea>
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] text-slate-400">Replies go to ${esc((profileContext?.email_reply_to || profileContext?.email) || 'your inbox')} · <button type="button" onclick="switchPage('profile');settingsTab('account')" class="text-indigo-500 font-bold">change</button></span>
      <div class="flex gap-2"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmSendEmail('${id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Send</button></div>
    </div>
  </div>`);
}
async function crmSendEmail(id) {
  const subject = document.getElementById('crm-email-subject')?.value || '';
  const body = document.getElementById('crm-email-body')?.value || '';
  if (!subject.trim() || !body.trim()) { showToast('Subject and message required', 'error'); return; }
  try { await apiSendJson(`/crm/contacts/${id}/email`, 'POST', { subject, body }); showToast('Email sent', 'success'); openCrmContact(id); }
  catch (e) { showToast(e.message, 'error'); }
}
function crmTaskForm(id) {
  crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
    <div class="flex gap-2">
      <select id="crm-task-type" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="followup">Follow-up</option><option value="call">Call</option><option value="text">Text</option><option value="email">Email</option><option value="other">Other</option></select>
      <input id="crm-task-due" type="date" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm">
    </div>
    <input id="crm-task-title" placeholder="Task (e.g. Follow up on financing)" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmSaveTask('${id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Add task</button></div>
  </div>`);
}
async function crmSaveTask(id) {
  const title = document.getElementById('crm-task-title')?.value || '';
  const type = document.getElementById('crm-task-type')?.value || 'followup';
  const due = document.getElementById('crm-task-due')?.value || '';
  if (!title.trim()) { showToast('Enter a task', 'error'); return; }
  try { await apiSendJson('/crm/tasks', 'POST', { contact_id: id, title, type, due_at: due ? new Date(due).toISOString() : null }); showToast('Task added', 'success'); openCrmContact(id); }
  catch (e) { showToast(e.message, 'error'); }
}
async function crmToggleTask(taskId, done, contactId, fromList) {
  // Completing a task requires a note — it posts to the customer's timeline so the
  // record shows WHAT happened, not just a checkmark. Un-checking needs no note.
  const refresh = () => { if (fromList) crmLoadTasks(); else if (contactId) openCrmContact(contactId); else crmLoadTasks(); };
  let note = null;
  if (done) {
    note = prompt('Add a note about this task before completing it:', '');
    if (note == null || !note.trim()) { refresh(); return; }   // cancelled/blank → don't complete
  }
  try {
    await apiSendJson(`/crm/tasks/${taskId}`, 'PUT', { done });
    if (done && note && note.trim() && contactId) {
      await apiSendJson(`/crm/contacts/${contactId}/log`, 'POST', { channel: 'note', direction: 'internal', subject: 'Task completed', body: note.trim() });
    }
    refresh();   // timeline / list reflects the note immediately (no manual refresh)
  } catch (e) { showToast(e.message, 'error'); }
}
// ── Lease / equity details right on the delivered customer (managers) ────────
async function crmLeaseForm(id) {
  crmDetailFormSlot(`<div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-sm text-slate-500">Loading lease details…</div>`);
  let d;
  try { [d] = await Promise.all([apiGetJson(`/equity/lease/by-contact/${id}`), eqEnsureVehicles()]); }
  catch (e) { crmDetailFormSlot(`<div class="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-lg p-3 text-sm text-rose-600">Couldn't load: ${esc(e.message)}</div>`); return; }
  const l = d.lease;
  if (!l) { crmDetailFormSlot(`<div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2 text-sm"><div class="text-slate-600 dark:text-slate-300">No delivered vehicle record found for this customer yet. Lease/finance details attach to a delivered ownership record.</div><div class="flex justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Close</button></div></div>`); return; }
  const dt = l.deal_type || (l.is_leased ? 'lease' : 'finance');
  const ic = 'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs';
  crmDetailFormSlot(`<div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 space-y-2" data-lease="${l.id}">
    <div class="flex items-center gap-2 flex-wrap">
      <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 flex-1 min-w-0">Deal / equity — ${esc(l.vehicle || 'vehicle')}</div>
      <select class="clz-dtype bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold" onchange="eqDealTypeToggle(this)">${Object.keys(DEAL_LABELS).map(t => `<option value="${t}" ${dt === t ? 'selected' : ''}>${DEAL_LABELS[t]}</option>`).join('')}</select>
    </div>
    ${l.equity != null ? `<div class="text-xs font-bold ${l.equity >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${eqMoney(l.equity)} est. equity${l.months_remaining != null ? ` · ${l.months_remaining} mo left` : ''} · est. wholesale ${eqMoney(l.wholesaleEst)} − payoff ${eqMoney(l.payoffEst)}</div>` : ''}
    <div><label class="text-[10px] text-slate-400">Vehicle purchased</label><select class="clz-vehicle ${ic}">${eqVehicleOptions(l.vehicle_id, l.vehicle)}</select></div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      ${eqDealFields(l, ic, 'clz-', dt, d.settings)}
    </div>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmSaveLease('${l.id}','${id}', this)" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg">Save</button></div>
  </div>`);
}
async function crmSaveLease(leaseId, contactId, btn) {
  const card = btn.closest('[data-lease]'); const g = (c) => card.querySelector(c)?.value.trim();
  const body = {
    deal_type: card.querySelector('.clz-dtype')?.value || 'lease',
    vehicle_id: card.querySelector('.clz-vehicle')?.value || '',
    lease_term_months: g('.clz-term'), monthly_payment: g('.clz-pay'), residual_value: g('.clz-res'),
    loan_amount: g('.clz-loan'), loan_apr: g('.clz-apr'), purchase_price: g('.clz-price'),
    payoff_amount: g('.clz-payoff'), delivery_mileage: g('.clz-miles'), annual_km_allowance: g('.clz-km'),
  };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await apiSendJson(`/equity/lease/${leaseId}`, 'PUT', body); showToast('Deal saved', 'success'); crmLeaseForm(contactId); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
// ── Appointment booking (with Gmail + Outlook calendar links) ────────────────
function crmApptForm(id) {
  const now = new Date(Date.now() + 3600000);
  const defDate = now.toISOString().slice(0, 10), defTime = now.toTimeString().slice(0, 5);
  crmDetailFormSlot(`<div class="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 rounded-lg p-3 space-y-2">
    <div class="text-[11px] font-bold uppercase tracking-wider text-violet-500">Book appointment</div>
    <input id="crm-appt-title" value="Appointment" placeholder="Title" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
    <div class="flex gap-2">
      <input id="crm-appt-date" type="date" value="${defDate}" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm">
      <input id="crm-appt-time" type="time" value="${defTime}" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm">
      <select id="crm-appt-dur" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="30">30 min</option><option value="60" selected>1 hr</option><option value="90">1.5 hr</option></select>
    </div>
    <input id="crm-appt-vehicle" placeholder="Vehicle / stock # (optional)" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
    <textarea id="crm-appt-note" rows="2" placeholder="Notes (optional) — added to the timeline" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></textarea>
    <div class="flex gap-2 justify-end"><button onclick="crmDetailFormSlot('')" class="text-xs font-bold text-slate-500 px-3 py-1.5">Cancel</button>
      <button onclick="crmSaveAppt('${id}')" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg">Book + get calendar links</button></div>
  </div>`);
}
function crmCalLinks(title, startIso, mins, details) {
  const start = new Date(startIso), end = new Date(start.getTime() + mins * 60000);
  const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');   // 20260711T150000Z
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${z(start)}/${z(end)}&details=${encodeURIComponent(details || '')}`;
  const o = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&body=${encodeURIComponent(details || '')}`;
  const ics = 'data:text/calendar;charset=utf8,' + encodeURIComponent(`BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:${z(start)}\nDTEND:${z(end)}\nSUMMARY:${title}\nDESCRIPTION:${details || ''}\nEND:VEVENT\nEND:VCALENDAR`);
  return { g, o, ics };
}
async function crmSaveAppt(id) {
  const title = document.getElementById('crm-appt-title')?.value || 'Appointment';
  const date = document.getElementById('crm-appt-date')?.value;
  const time = document.getElementById('crm-appt-time')?.value || '09:00';
  const dur = Number(document.getElementById('crm-appt-dur')?.value || 60);
  const vehicle = (document.getElementById('crm-appt-vehicle')?.value || '').trim();
  const note = (document.getElementById('crm-appt-note')?.value || '').trim();
  if (!date) { showToast('Pick a date', 'error'); return; }
  const startIso = new Date(`${date}T${time}`).toISOString();
  const fullTitle = vehicle ? `${title} · ${vehicle}` : title;
  const details = ['Booked via MarketSync CRM', vehicle ? `Vehicle: ${vehicle}` : '', note].filter(Boolean).join('\n');
  try {
    await apiSendJson('/crm/tasks', 'POST', { contact_id: id, title: fullTitle, type: 'appointment', due_at: startIso });
    await apiSendJson(`/crm/contacts/${id}/log`, 'POST', { channel: 'note', direction: 'internal', subject: 'Appointment booked', body: `${fullTitle} — ${new Date(startIso).toLocaleString()}` });
    // A note typed on the appointment posts to the timeline as its own note.
    if (note) await apiSendJson(`/crm/contacts/${id}/log`, 'POST', { channel: 'note', direction: 'internal', subject: 'Appointment note', body: note });
    await apiSendJson(`/crm/contacts/${id}`, 'PUT', { status: 'appointment' });
    const { g, o, ics } = crmCalLinks(fullTitle, startIso, dur, details);
    crmDetailFormSlot(`<div class="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900 rounded-lg p-3 space-y-2">
      <div class="text-sm font-bold text-slate-800 dark:text-slate-100">Appointment booked for ${esc(new Date(startIso).toLocaleString())}</div>
      <div class="text-xs text-slate-500">Add it to your calendar:</div>
      <div class="flex flex-wrap gap-2">
        <a href="${g}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">${msIco('calendar', 'w-3.5 h-3.5')} Google Calendar</a>
        <a href="${o}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">${msIco('calendar', 'w-3.5 h-3.5')} Outlook</a>
        <a href="${ics}" download="appointment.ics" class="inline-flex items-center gap-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">${msIco('download', 'w-3.5 h-3.5')} .ics file</a>
      </div>
      <button onclick="openCrmContact('${id}')" class="text-xs font-bold text-indigo-500">Done</button>
    </div>`);
    showToast('Appointment booked', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Full add/edit contact form (the dealership intake workflow) ─────────────
// CRM / DMS (ADF) connection — lives on the Settings page now.
async function loadCrmAdfSetting() {
  const card = document.getElementById('crm-dms-card'); if (!card) return;
  try {
    const d = await apiGetJson('/leads/crm-email');
    card.classList.toggle('hidden', !d.can_configure);
    const inp = document.getElementById('crm-adf-email'); if (inp) inp.value = d.crm_adf_email || '';
  } catch { /* leave as-is */ }
}
async function saveCrmAdfEmail(btn) {
  const inp = document.getElementById('crm-adf-email'), msg = document.getElementById('crm-adf-msg');
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await fetch(`${API}/leads/crm-email`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ crm_adf_email: (inp?.value || '').trim() }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed');
    if (msg) { msg.textContent = ' Saved — leads now deliver to your CRM.'; msg.className = 'text-xs mt-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); }
  } catch (e) { if (msg) { msg.textContent = e.message; msg.className = 'text-xs mt-2 text-red-500'; msg.classList.remove('hidden'); } }
  finally { btn.disabled = false; btn.textContent = orig; }
}
window.saveCrmAdfEmail = saveCrmAdfEmail;
// Preset lead sources for the New/Edit contact form (with a write-your-own option).
const CRM_SOURCES = ['Walk-in', 'Website', 'Facebook Marketplace', 'AutoTrader', 'Kijiji', 'CarGurus', 'Referral', 'Phone-up', 'Google', 'Repeat customer', 'Service drive'];
// Toggle the custom-source input when "Other" is picked; otherwise mirror the preset.
function crmSourceOther(val) {
  const inp = document.getElementById('crm-f-source');
  if (!inp) return;
  if (val === '__other') { inp.classList.remove('hidden'); if (CRM_SOURCES.includes(inp.value)) inp.value = ''; inp.focus(); }
  else { inp.value = val; inp.classList.add('hidden'); }
}
window.crmSourceOther = crmSourceOther;
function openCrmContactModal() { crmOpenForm(null); }
let __crmTradeDecoded = null;   // decoded trade vehicle held while the form is open

// Searchable "new car of interest" picker over our own inventory (stock # first).
function crmInvLabel(v) {
  return `${v.stocknumber ? '#' + v.stocknumber + ' — ' : ''}${[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}${v.price ? ' · $' + Number(v.price).toLocaleString() : ''}`;
}
function crmInterestSearch() {
  const box = document.getElementById('crm-interest-results');
  const qi = document.getElementById('crm-f-interest-q');
  const hid = document.getElementById('crm-f-interest');
  if (!box || !qi) return;
  const q = (qi.value || '').trim().toLowerCase();
  if (!q && hid) hid.value = '';   // cleared → unpin
  let items = (__crmInventory || []);
  if (q) {
    const match = (v) => {
      const stock = String(v.stocknumber || '').toLowerCase();
      const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ').toLowerCase();
      return stock.includes(q) || label.includes(q) || String(v.vin || '').toLowerCase().includes(q);
    };
    // Stock-number hits first (this is how a desk looks a car up).
    items = items.filter(match).sort((a, b) => {
      const as = String(a.stocknumber || '').toLowerCase().includes(q) ? 0 : 1;
      const bs = String(b.stocknumber || '').toLowerCase().includes(q) ? 0 : 1;
      return as - bs;
    });
  }
  items = items.slice(0, 30);
  if (!items.length) { box.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400">No matching stock</div>'; box.classList.remove('hidden'); return; }
  box.innerHTML = items.map(v => `<button type="button" onmousedown="event.preventDefault()" onclick="crmPickInterest('${v.id}')" class="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm flex justify-between gap-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
    <span class="truncate">${v.stocknumber ? `<span class="font-bold text-indigo-600 dark:text-indigo-400">#${esc(v.stocknumber)}</span> ` : ''}${esc([v.year, v.make, v.model, v.trim].filter(Boolean).join(' '))}</span>
    ${v.price ? `<span class="text-slate-400 flex-shrink-0 tabular-nums">$${Number(v.price).toLocaleString()}</span>` : ''}
  </button>`).join('');
  box.classList.remove('hidden');
}
function crmPickInterest(id) {
  const v = (__crmInventory || []).find(x => x.id === id);
  if (!v) return;
  const hid = document.getElementById('crm-f-interest'); if (hid) hid.value = id;
  const qi = document.getElementById('crm-f-interest-q'); if (qi) qi.value = crmInvLabel(v);
  document.getElementById('crm-interest-results')?.classList.add('hidden');
}
async function crmOpenForm(id) {
  if (id) {
    return openCrmContact(id, 'edit');
  }
  await crmEnsureLookups();
  const c = {};
  __crmTradeDecoded = null;
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div class="text-lg font-black text-slate-900 dark:text-white">New contact</div>
      <div class="flex items-center gap-2">
        <button type="button" onclick="crmScanLicense()" title="Scan a driver's licence to fill this in" class="inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>Scan licence</button>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </div>
    ${crmEditFormContent(c)}
  </div>`, 'max-w-2xl');
}
function crmToggleCompany(isCo) { const r = document.getElementById('crm-company-row'); if (r) r.classList.toggle('hidden', !isCo); }

// Scan a driver's licence → AI reads it → prefill the New-contact form. On mobile,
// capture="environment" opens the rear camera; on desktop it's a file picker. The
// image is sent for a one-time read and is never stored.
function crmScanLicense() {
  const file = document.getElementById('crm-license-file');
  if (!file) return;
  file.value = '';
  file.onchange = async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const status = document.getElementById('crm-license-status');
    const show = (msg, kind) => { if (!status) return; status.className = `text-xs rounded-lg px-3 py-2 ${kind === 'error' ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : kind === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'}`; status.textContent = msg; status.classList.remove('hidden'); };
    show('Reading the licence…', 'info');
    try {
      const dataUrl = await crmDownscaleImage(f, 1600);
      const r = await apiSendJson('/crm/scan-license', 'POST', { image: dataUrl }, { timeoutMs: 40000 });
      const x = r.fields || {};
      const set = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      set('crm-f-first', x.first_name); set('crm-f-last', x.last_name);
      set('crm-f-address', x.address); set('crm-f-city', x.city);
      set('crm-f-province', x.province_state); set('crm-f-postal', x.postal_code);
      set('crm-f-dl', x.dl_number); set('crm-f-birthday', x.date_of_birth); set('crm-f-dlexp', x.expiry);
      const got = ['first_name','last_name','address','dl_number'].filter(k => x[k]).length;
      show(got ? 'Licence read — please double-check the fields, then Save.' : 'Couldn’t read much — try a sharper, straight-on photo.', got ? 'ok' : 'error');
    } catch (e) { show(e.message || 'Could not read the licence.', 'error'); }
  };
  file.click();
}
// Downscale + JPEG-compress a licence photo in the browser before upload.
function crmDownscaleImage(fileOrBlob, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = URL.createObjectURL(fileOrBlob);
  });
}
// ── ID verification (Stripe Identity) ───────────────────────────────────────
// Real government-ID + selfie/liveness check on a saved customer. Stripe does the
// document + biometric work on a hosted page; we only track pass/fail here. The ID
// images never touch our servers. Only shown on an already-saved contact.
function idvBadge(status, verifiedAt) {
  const map = {
    verified: ['bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', 'ID verified'],
    processing: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Checking…'],
    pending: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Awaiting customer'],
    requires_input: ['bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300', 'Needs another attempt'],
    manual_review: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Manual review'],
    failed: ['bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300', 'Failed'],
    expired: ['bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', 'Expired'],
    canceled: ['bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', 'Canceled'],
  };
  const [cls, label] = map[status] || ['bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', 'Not verified'];
  const when = status === 'verified' && verifiedAt ? ` · ${new Date(verifiedAt).toLocaleDateString()}` : '';
  return `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}">${label}${when}</span>`;
}
function idvBlock(c) {
  const cid = c.id;
  // Contact-level verification columns are legacy mirrors and can be stale. The canonical,
  // purpose-scoped record is loaded immediately from /identity/status below.
  const status = 'unstarted';
  const summary = '';
  const lastErr = '';
  return `<div class="text-[11px] font-black uppercase tracking-wider text-indigo-500 pt-1">Identity verification</div>
    <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-800 dark:text-slate-100">Government ID + selfie</span> <span id="idv-badge">${idvBadge(status, c.id_verified_at)}</span></div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400">The customer photographs their ID and takes a selfie; images stay with the verification provider.</div>
          <label class="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-500">Purpose
            <select id="idv-purpose" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"><option value="test_drive">Test drive</option><option value="credit_application">Credit application</option><option value="remote_purchase">Remote purchase</option><option value="esign">E-sign</option><option value="payment">Payment</option><option value="delivery">Delivery</option></select>
          </label>
          <div id="idv-provider-slot" class="mt-1"></div>
          <div id="idv-summary">${summary}${lastErr}</div>
        </div>
        <div class="flex flex-col gap-1.5 shrink-0">
          <button type="button" onclick="idvStart('${cid}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">${status === 'unstarted' ? 'Start verification' : 'Re-run'}</button>
          ${status !== 'unstarted' ? `<button type="button" onclick="idvRefresh('${cid}')" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Refresh status</button>` : ''}
        </div>
      </div>
      <div id="idv-link" class="hidden mt-2"></div>
    </div>`;
}
async function idvStart(contactId) {
  const link = document.getElementById('idv-link');
  if (link) { link.classList.remove('hidden'); link.innerHTML = '<div class="text-xs text-slate-500">Creating a secure verification link…</div>'; }
  try {
    const purpose = document.getElementById('idv-purpose')?.value || 'test_drive';
    const r = await apiSendJson('/identity/start', 'POST', { contact_id: contactId, purpose }, { timeoutMs: 30000 });
    if (!r.url) throw new Error('No verification link returned.');
    const badge = document.getElementById('idv-badge'); if (badge) badge.innerHTML = idvBadge('pending');
    if (link) link.innerHTML = `
      <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Send this secure link to the customer, or open it on your device for them:</div>
      <div class="flex gap-1.5">
        <input readonly value="${esc(r.url)}" onclick="this.select()" class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs">
        <button type="button" onclick="navigator.clipboard.writeText('${esc(r.url)}');showToast('Link copied','success')" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 rounded-lg">Copy</button>
        <a href="${esc(r.url)}" target="_blank" rel="noopener" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Open</a>
      </div>
      <div class="text-[11px] text-slate-400 mt-1">After they finish, press <b>Refresh status</b> to update the result.</div>`;
  } catch (e) {
    if (link) link.innerHTML = `<div class="text-xs text-rose-600 dark:text-rose-400">${esc(e.message || 'Could not start verification.')}</div>`;
  }
}
async function idvRefresh(contactId) {
  const badge = document.getElementById('idv-badge');
  if (badge) badge.innerHTML = idvBadge('processing');
  try {
    const r = await apiGetJson(`/identity/status?contact_id=${encodeURIComponent(contactId)}`);
    if (badge) badge.innerHTML = idvBadge(r.status, r.verified_at);
    const sum = document.getElementById('idv-summary');
    if (sum) {
      const rep = r.verification || r;
      if (r.status === 'verified') sum.innerHTML = `<div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">${esc(rep.legal_name || '')}${rep.dob ? ` · DOB ${esc(rep.dob)}` : ''} · document ${esc(rep.document_result || 'unknown')} · liveness ${esc(rep.liveness_result || 'unknown')}${rep.face_match_score != null ? ` · match ${Number(rep.face_match_score).toFixed(0)}/100` : ' · match score unavailable'}</div>`;
      else if (r.status === 'manual_review') sum.innerHTML = `<div class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Provider result needs evidence review. It is not verified yet.</div>`;
      else if ((r.status === 'failed' || r.status === 'expired') && rep.last_error) sum.innerHTML = `<div class="text-[11px] text-rose-500 mt-1">${esc(rep.last_error)}</div>`;
    }
    if (r.status === 'verified') { showToast('Identity verified', 'success'); const l = document.getElementById('idv-link'); if (l) l.classList.add('hidden'); }
  } catch (e) { if (badge) badge.innerHTML = idvBadge('requires_input'); showToast(e.message || 'Could not check status', 'error'); }
}
// Verification-provider picker (managers only, shown when >1 provider is configured
// server-side). Cached so opening a contact doesn't re-fetch every time.
let __idvConfig = null;
async function idvEnsureConfig() { if (!__idvConfig) { try { __idvConfig = await apiGetJson('/identity/config'); } catch { __idvConfig = { available: [] }; } } return __idvConfig; }
async function idvFillProvider() {
  const slot = document.getElementById('idv-provider-slot'); if (!slot) return;
  const cfg = await idvEnsureConfig();
  const opts = cfg.providers || [];
  if (opts.length < 2) return;  // nothing to choose
  slot.innerHTML = `<label class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Provider:
    <select onchange="idvSetProvider(this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
      ${opts.map(o => `<option value="${esc(o.value)}" ${cfg.selected === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select></label>`;
}
async function idvSetProvider(provider) {
  try { const r = await apiSendJson('/identity/provider', 'PUT', { provider }); if (__idvConfig) __idvConfig.selected = r.selected; showToast('Verification provider updated', 'success'); }
  catch (e) { showToast(e.message || 'Could not update provider', 'error'); }
}
window.idvFillProvider = idvFillProvider; window.idvSetProvider = idvSetProvider;
window.crmScanLicense = crmScanLicense;
window.idvStart = idvStart; window.idvRefresh = idvRefresh;
// Header "Add customer" button — opens a fresh contact and immediately fires the
// licence camera scan so the AI fills in all the details. After saving, the contact
// record offers the full ID + selfie verification (Persona / Stripe Identity).
async function identityScan() {
  try { await crmOpenForm(); } catch (e) { showToast(e.message || 'Could not open the form', 'error'); return; }
  setTimeout(() => { try { crmScanLicense(); } catch (e) {} }, 200);
}
window.identityScan = identityScan;

function vehicleFitBlock(c) {
  return `<div class="text-[11px] font-black uppercase tracking-wider text-indigo-500 pt-1">Affordability &amp; vehicle fit</div>
    <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
      <div class="grid grid-cols-2 gap-2"><label class="text-[11px] font-semibold text-slate-500">Desired monthly payment<input id="fit-payment" type="number" min="0" step="25" class="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"></label><label class="text-[11px] font-semibold text-slate-500">Body style<input id="fit-body" placeholder="SUV, truck, sedan" class="mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"></label></div>
      <button type="button" onclick="crmVehicleFit('${c.id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Find available vehicles</button>
      <div id="fit-results" class="space-y-2"></div>
    </div>`;
}
const __vehicleFitResults = {};
function crmFitSendOptions(contactId) {
  const rows = (__vehicleFitResults[contactId] || []).slice(0, 5);
  if (!rows.length) return showToast('Find available vehicles first', 'error');
  crmEmailForm(contactId);
  const subject = document.getElementById('crm-email-subject'), body = document.getElementById('crm-email-body');
  if (subject) subject.value = 'Vehicle options selected for you';
  if (body) body.value = `Here are the available vehicles I selected for you:\n\n${rows.map(v => `${[v.year,v.make,v.model,v.trim].filter(Boolean).join(' ')} · Stock ${v.stock_number || 'not assigned'} · ${money(v.price)}${v.estimated_payment != null ? ` · estimated ${money(v.estimated_payment)}/month` : ''}`).join('\n')}\n\nReply and I will arrange a closer look or appointment.`;
}
function crmFitBookAppointment(contactId) {
  const first = (__vehicleFitResults[contactId] || [])[0];
  crmApptForm(contactId);
  const vehicle = document.getElementById('crm-appt-vehicle');
  if (vehicle && first) vehicle.value = `${[first.year,first.make,first.model,first.trim].filter(Boolean).join(' ')} · Stock ${first.stock_number || 'not assigned'}`;
}
function crmFitDeskDeal(contactId) { openDeskForContact(contactId); }
async function crmVehicleFit(contactId) {
  const host = document.getElementById('fit-results'); if (!host) return;
  host.innerHTML = '<div class="text-xs text-slate-400">Checking current inventory…</div>';
  try {
    const desired = Number(document.getElementById('fit-payment')?.value || 0) || null;
    const body = (document.getElementById('fit-body')?.value || '').trim() || null;
    const r = await apiSendJson(`/customers/${encodeURIComponent(contactId)}/vehicle-fit`, 'POST', { desired_payment: desired, body_style: body });
    const a = r.affordability || {}, rows = r.matches || [];
    __vehicleFitResults[contactId] = rows;
    const paymentContext = a.assumptions_complete ? `${a.apr}% · ${a.term_months} months` : 'Payment estimate unavailable until rate and term are known';
    host.innerHTML = `<div class="text-[11px] text-slate-500">${esc(paymentContext)} · Next action: <b>${esc(r.next_action || 'Review')}</b></div>${rows.length ? `<div class="flex flex-wrap gap-2"><button type="button" onclick="crmFitSendOptions('${contactId}')" class="text-[11px] font-bold bg-indigo-600 text-white px-2.5 py-1.5 rounded-lg">Send vehicle options</button><button type="button" onclick="crmFitBookAppointment('${contactId}')" class="text-[11px] font-bold border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg">Book appointment</button><button type="button" onclick="crmFitDeskDeal('${contactId}')" class="text-[11px] font-bold border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg">Desk deal</button></div>${rows.slice(0, 6).map(v => `<button type="button" onclick="openVehicleRecord('${v.inventory_id}')" class="w-full text-left flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"><div class="w-16 h-12 rounded bg-slate-100 dark:bg-slate-800 bg-cover bg-center shrink-0" ${v.photo ? `style="background-image:url('${esc(v.photo)}')"` : ''}></div><div class="min-w-0 flex-1"><div class="text-xs font-bold text-slate-900 dark:text-white">${esc([v.year,v.make,v.model,v.trim].filter(Boolean).join(' '))}</div><div class="text-[11px] text-slate-500">Stock ${esc(v.stock_number || '—')} · ${money(v.price)}${v.estimated_payment != null ? ` · est. ${money(v.estimated_payment)}/mo` : ''}</div><div class="text-[11px] font-bold text-indigo-600">Fit ${v.fit_score}/100 · ${esc((v.reasons || []).join(' · '))}</div></div></button>`).join('')}` : '<div class="text-xs text-amber-600">No currently available inventory fits the supported budget.</div>'}`;
  } catch (e) { host.innerHTML = `<div class="text-xs text-rose-500">${esc(e.message || 'Could not calculate vehicle fit.')}</div>`; }
}
Object.assign(window, { crmVehicleFit, crmFitSendOptions, crmFitBookAppointment, crmFitDeskDeal });
async function crmDecodeTrade() {
  const vin = (document.getElementById('crm-f-tradevin')?.value || '').trim().toUpperCase();
  if (vin.length !== 17) { showToast('Enter a 17-character VIN', 'error'); return; }
  try {
    const r = await fetch(`${API}/ai/vin-decode`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vin }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Decode failed');
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = v; };
    set('crm-f-tradeyear', d.year); set('crm-f-trademake', d.make); set('crm-f-trademodel', d.model); set('crm-f-tradetrim', d.trim);
    __crmTradeDecoded = { vin, ...d };
    showToast('VIN decoded', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
async function crmSaveContact(btn, id) {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  const ctype = document.querySelector('input[name="crm-ctype"]:checked')?.value || 'individual';
  const tradeVin = val('crm-f-tradevin');
  const trade = (tradeVin || val('crm-f-trademake')) ? {
    vin: tradeVin || null, year: val('crm-f-tradeyear') || null, make: val('crm-f-trademake') || null,
    model: val('crm-f-trademodel') || null, trim: val('crm-f-tradetrim') || null, mileage: val('crm-f-trademiles') || null,
  } : null;
  const body = {
    contact_type: ctype,
    company_name: val('crm-f-company'),
    first_name: val('crm-f-first'), last_name: val('crm-f-last'), middle_name: val('crm-f-middle'), suffix: val('crm-f-suffix'),
    email: val('crm-f-email'), phone_mobile: val('crm-f-mobile'), phone_home: val('crm-f-home'), phone_work: val('crm-f-work'),
    phone: val('crm-f-mobile'),
    address: val('crm-f-address'), city: val('crm-f-city'), province: val('crm-f-province'), postal_code: val('crm-f-postal'),
    birthday: val('crm-f-birthday') || null, dl_number: val('crm-f-dl'), dl_expiry: val('crm-f-dlexp') || null,
    source: val('crm-f-source'), assigned_rep: val('crm-f-rep') || null, status: val('crm-f-status') || 'uncontacted',
    trade_vehicle: trade, interest_inventory_id: val('crm-f-interest') || null,
    notes: val('crm-f-notes'),
  };
  const nameGiven = body.first_name || body.last_name || body.company_name;
  if (!nameGiven && !body.email && !body.phone) { showToast('Enter a name, phone, or email', 'error'); return; }
  try {
    const d = id ? await apiSendJson(`/crm/contacts/${id}`, 'PUT', body) : await apiSendJson('/crm/contacts', 'POST', body);
    btn.closest('.fixed').remove();
    showToast(id ? 'Saved' : 'Contact created', 'success');
    if (document.getElementById('crm-body')) crmLoadContacts();   // refresh the list if we're on it
    const cid = id || d.contact?.id;
    if (cid) openCrmContact(cid);
  } catch (e) { showToast(e.message, 'error'); }
}

// ── Tasks tab ────────────────────────────────────────────────────────────────
// Colour + label per automated task journey: orange for new-lead follow-up,
// green for post-delivery follow-up, neutral for manually-added tasks.
function crmTaskTypeMeta(type) {
  if (type === 'lead_followup') return { label: 'New lead', border: 'border-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' };
  if (type === 'delivery_followup') return { label: 'Delivery', border: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' };
  if (type === 'appointment') return { label: 'Appointment', border: 'border-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' };
  return { label: 'Follow-up', border: 'border-sky-500', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' };
}
async function crmLoadTasks() {
  const body = document.getElementById('tasks-root');
  if (!body) return;
  body.innerHTML = `<div id="crm-tasklist" class="py-10 text-center text-sm text-slate-400 italic">Loading tasks…</div>`;
  try {
    const d = await apiGetJson('/crm/tasks?scope=open');
    const tasks = d.tasks || [];
    const el = document.getElementById('crm-tasklist');
    if (!el) return;   // user navigated away mid-fetch
    if (!tasks.length) { el.className = ''; el.innerHTML = '<div class="py-16 text-center text-sm text-slate-400">No open tasks. Add follow-ups from a contact.</div>'; return; }
    el.className = '';
    // Legend for the task journeys shown here.
    const legend = `<div class="flex flex-wrap items-center gap-3 mb-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>New-lead follow-up</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>Follow-up</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Delivery follow-up</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-violet-500"></span>Appointment</span>
    </div>`;
    el.innerHTML = legend + `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
      ${tasks.map(t => {
        const overdue = t.due_at && new Date(t.due_at) < Date.now();
        const meta = crmTaskTypeMeta(t.type);
        return `<div class="flex items-center gap-3 px-4 py-3 border-l-4 ${meta.border}">
          <input type="checkbox" onchange="crmToggleTask('${t.id}', this.checked, ${t.contact_id ? `'${t.contact_id}'` : 'null'}, true)" class="w-4 h-4 rounded accent-indigo-600 flex-shrink-0">
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">${esc(t.title)}</div>
            <div class="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">${t.contact_name ? `<button onclick="openCrmContact('${t.contact_id}')" class="text-indigo-500 hover:underline">${esc(t.contact_name)}</button>` : ''}<span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${meta.badge}">${esc(meta.label)}</span></div>
          </div>
          ${t.due_at ? `<span class="text-[11px] flex-shrink-0 ${overdue ? 'text-rose-500 font-bold' : 'text-slate-400'}">${esc(crmWhen(t.due_at))}</span>` : ''}
        </div>`;
      }).join('')}</div>`;
  } catch (e) {
    const el = document.getElementById('crm-tasklist');
    if (el) el.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load tasks: ${esc(e.message)}<br><button onclick="crmLoadTasks()" class="mt-3 text-indigo-500 font-bold">Retry</button></div>`;
  }
}

// ── Leads (CRM ADF delivery) ─────────────────────────────────────────────────
async function loadLeadsPage() {
  const root = document.getElementById('leads-root');
  if (!root) return;
  root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Loading leads…</div>`;
  let data;
  try {
    data = await apiGetJson('/leads', { onRetry: (n, total) => {
      root.innerHTML = `<div class="py-16 text-center text-sm text-slate-400 italic">Still loading… retrying (${n}/${total})</div>`;
    }});
  } catch (e) {
    root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load leads: ${esc(e.message)}<br><button onclick="loadLeadsPage()" class="mt-3 text-indigo-500 hover:text-indigo-400 font-bold">Retry</button></div>`;
    return;
  }

  const crmSet = !!data.crm_adf_email;

  const canReassign = !!data.can_reassign;
  const reps = data.reps || [];
  const statusPill = (l) => {
    if (l.adf_sent_at) return `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Sent to CRM</span>`;
    if (l.adf_error) return `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" title="${esc(l.adf_error)}">Failed</span>`;
    return `<span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Not delivered</span>`;
  };
  // Speed-to-lead clock. Open leads tick LIVE every second (green ≤5m, amber ≤15m,
  // red after); answered leads freeze at their time-to-answer. The live text is filled
  // by startLeadTimers() so all rows update in one interval.
  const sittingBadge = (l) => {
    if (!l.created_at) return '<span class="text-xs text-slate-400">—</span>';
    if (l.responded_at) {
      const sec = Math.max(0, Math.round((new Date(l.responded_at) - new Date(l.created_at)) / 1000));
      // Colour the answered time by the response goal — fast = green, slow = red.
      return `<span class="text-xs font-bold ${leadTimeClasses(sec).join(' ')}" title="Answered${l.responded_by_name ? ' by ' + esc(l.responded_by_name) : ''} in ${fmtLeadDuration(sec)}"> ${fmtLeadDuration(sec)}</span>`;
    }
    return `<span class="lead-timer text-xs font-black tabular-nums" data-created="${l.created_at}" title="Live — time this lead has gone unanswered">${fmtLeadDuration(Math.max(0, Math.round((Date.now() - new Date(l.created_at)) / 1000)))}</span>`;
  };
  // Managers/dealer-admins get a reassign dropdown; everyone else sees the owner name.
  const repControl = (l) => {
    if (canReassign && reps.length) {
      const opts = ['<option value="">Unassigned</option>']
        .concat(reps.map(r => `<option value="${r.id}" ${r.id === l.owner_id ? 'selected' : ''}>${esc(r.name)}</option>`)).join('');
      return `<select class="lead-reassign mt-1 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5" data-id="${l.id}" title="Reassign this lead">${opts}</select>`;
    }
    return `<div class="text-[11px] font-semibold mt-0.5 inline-flex items-center gap-1 ${l.rep ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${l.rep ? esc(l.rep) : 'Unassigned'}</div>`;
  };
  // Hot-lead score badge ( hot / warm / cold) — hover for the biggest driver.
  const scoreBadge = (l) => {
    if (l.score == null) return '';
    const m = { hot: ['', 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'], warm: ['', 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'], cold: ['', 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'] };
    const [ic, cls] = m[l.score_tier] || m.cold;
    return `<span class="text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${cls}" title="Lead score ${l.score}/100${l.score_reason ? ' · ' + esc(l.score_reason) : ''}">${ic} ${l.score}</span>`;
  };
  // Surface the hottest leads first — that's the point of scoring.
  const sortedLeads = (data.leads || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const rows = sortedLeads.map(l => `
    <tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="py-3 px-3"><div class="flex items-center gap-2"><span class="font-semibold text-slate-900 dark:text-white">${esc(l.name || '—')}</span>${scoreBadge(l)}</div><div class="text-xs text-slate-400">${esc(l.source || '')}</div>${repControl(l)}</td>
      <td class="py-3 px-3 text-slate-600 dark:text-slate-300">${esc(l.phone || '')}${l.phone && l.email ? '<br>' : ''}${esc(l.email || '')}</td>
      <td class="py-3 px-3 text-slate-500 dark:text-slate-400 max-w-[220px]">${esc(l.comments || '')}</td>
      <td class="py-3 px-3 whitespace-nowrap">${sittingBadge(l)}</td>
      <td class="py-3 px-3">${statusPill(l)}</td>
      <td class="py-3 px-3 text-right whitespace-nowrap">
        ${!l.responded_at ? `<button class="lead-answered text-emerald-600 hover:text-emerald-500 text-xs font-bold" data-id="${l.id}" data-contact="${l.contact_id || ''}" title="Log a call/text/email with a note — stops the clock"> Log &amp; complete</button>` : ''}
        <button class="lead-ai-reply text-violet-600 hover:text-violet-500 text-xs font-bold ml-3" data-id="${l.id}"> Draft reply</button>
        ${!l.adf_sent_at && crmSet ? `<button class="lead-resend text-indigo-500 hover:text-indigo-400 text-xs font-bold ml-3" data-id="${l.id}">Send to CRM</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="6" class="py-8 text-center text-sm text-slate-400 italic">No leads yet.</td></tr>';

  root.innerHTML = `
    <div class="mb-5 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Leads</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Incoming Marketplace &amp; web leads — each auto-assigned to a salesperson and delivered to your CRM as an ADF email. To log one yourself, add them as a contact.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="crmOpenForm(null)" class="inline-flex items-center gap-1.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>New contact</button>
        <button onclick="leadsExportCsv(this)" class="inline-flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export CSV</button>
        ${data.can_configure ? `<button onclick="document.getElementById('leads-import-file').click()" class="inline-flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import CSV</button>
        <input id="leads-import-file" type="file" accept=".csv,text/csv" class="hidden" onchange="leadsImportCsv(this.files[0])">` : ''}
      </div>
    </div>

    ${data.can_reassign ? (() => { const sla = leadSla(); return `<div class="mb-4 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
      <span class="font-semibold">Response goal:</span>
      <span class="inline-flex items-center gap-1">green ≤ <input type="number" min="1" value="${sla.good}" id="lead-sla-good" class="w-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-right tabular-nums"> min</span>
      <span class="inline-flex items-center gap-1">amber ≤ <input type="number" min="1" value="${sla.ok}" id="lead-sla-ok" class="w-14 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-right tabular-nums"> min</span>
      <span class="text-slate-400">(red after) —</span>
      <button onclick="saveLeadSla(document.getElementById('lead-sla-good').value, document.getElementById('lead-sla-ok').value)" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Save</button>
    </div>`; })() : ''}

    <div id="leads-metrics" class="mb-4"></div>

    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto"><table class="w-full text-sm text-left min-w-[640px]">
        <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
          <th class="py-3 px-3">Buyer</th><th class="py-3 px-3">Contact</th><th class="py-3 px-3">Notes</th><th class="py-3 px-3">Time to answer</th><th class="py-3 px-3">CRM</th><th class="py-3 px-3 text-right">Action</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;

  startLeadTimers();
  if (data.can_reassign) renderLeadMetrics();

  root.querySelectorAll('.lead-answered').forEach(b => b.addEventListener('click', () => openLeadComplete(b.dataset.id, b.dataset.contact || '')));

  root.querySelectorAll('.lead-resend').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Sending…';
    try {
      const r = await fetch(`${API}/leads/${b.dataset.id}/resend`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      loadLeadsPage();
    } catch (e) { alert(e.message); b.disabled = false; b.textContent = 'Send to CRM'; }
  }));

  root.querySelectorAll('.lead-ai-reply').forEach(b => b.addEventListener('click', () => openLeadReply(b.dataset.id)));

  // Manager reassignment — update the lead's owner, then refresh the list + timers.
  root.querySelectorAll('.lead-reassign').forEach(sel => sel.addEventListener('change', async () => {
    const prev = sel.dataset.prev || '';
    sel.disabled = true;
    try {
      const r = await fetch(`${API}/leads/${sel.dataset.id}/assign`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rep_id: sel.value || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      showToast('Lead reassigned', 'success');
      loadLeadsPage();
    } catch (e) { showToast(e.message || 'Could not reassign', 'error'); sel.disabled = false; }
  }));
}

// Format seconds → compact "1h 02m 45s" / "3m 12s" / "45s" (down to the second).
// Response-time goal (minutes) → green ≤ good, amber ≤ ok, red after. Managers set
// it on the Opportunities page; stored per dealership. Defaults 5 / 15.
function leadSla() {
  try { const s = JSON.parse(localStorage.getItem('ms_lead_sla_' + (profileContext?.dealership_id || 'x')) || 'null'); if (s && s.good > 0 && s.ok > 0) return s; } catch {}
  return { good: 5, ok: 15 };
}
function leadTimeClasses(sec) {
  const { good, ok } = leadSla();
  return sec <= good * 60 ? ['text-emerald-600', 'dark:text-emerald-400']
    : sec <= ok * 60 ? ['text-amber-600', 'dark:text-amber-400']
    : ['text-red-500'];
}
function saveLeadSla(good, ok) {
  const g = Math.max(1, Number(good) || 5), o = Math.max(g, Number(ok) || 15);
  try { localStorage.setItem('ms_lead_sla_' + (profileContext?.dealership_id || 'x'), JSON.stringify({ good: g, ok: o })); } catch {}
  loadLeadsPage();
}
window.saveLeadSla = saveLeadSla;
function fmtLeadDuration(totalSec) {
  totalSec = Math.max(0, Math.floor(totalSec));
  const s = totalSec % 60, m = Math.floor(totalSec / 60) % 60, h = Math.floor(totalSec / 3600) % 24, d = Math.floor(totalSec / 86400);
  const p = (n) => String(n).padStart(2, '0');
  if (d > 0) return `${d}d ${p(h)}h ${p(m)}m`;
  if (h > 0) return `${h}h ${p(m)}m ${p(s)}s`;
  if (m > 0) return `${m}m ${p(s)}s`;
  return `${s}s`;
}

// One interval ticks every open lead's clock each second. Colour escalates with age
// (≤5m green, ≤15m amber, then red) so a stalling lead visually screams. Self-clears
// once no live timers remain on the page.
let __leadTimerInterval = null;
function startLeadTimers() {
  if (__leadTimerInterval) { clearInterval(__leadTimerInterval); __leadTimerInterval = null; }
  const COLORS = ['text-emerald-600', 'dark:text-emerald-400', 'text-amber-600', 'dark:text-amber-400', 'text-red-500'];
  const tick = () => {
    const els = document.querySelectorAll('.lead-timer');
    if (!els.length) { clearInterval(__leadTimerInterval); __leadTimerInterval = null; return; }
    els.forEach(el => {
      const sec = Math.max(0, Math.round((Date.now() - new Date(el.dataset.created)) / 1000));
      el.textContent = fmtLeadDuration(sec);
      el.classList.remove(...COLORS);
      el.classList.add(...leadTimeClasses(sec));
    });
  };
  tick();
  __leadTimerInterval = setInterval(tick, 1000);
}

Object.assign(window, {
  openCrmContact,
  crmOpenForm,
  crmLoadContacts,
  loadCrmPage,
  crmQuickLog,
  crmSaveContact,
  crmScanLicense,
  crmTaskForm,
  crmLogForm,
  crmApptForm,
  crmEmailForm,
  crmLeaseForm,
  crmDecodeTrade,
  crmInterestSearch,
  crmPickInterest,
  crmToggleCompany,
  crmSourceOther,
  idvStart,
  idvRefresh,
  idvVerifyInPerson
});

