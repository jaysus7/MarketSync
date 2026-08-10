// ── Parts workspace — Batch 3 ────────────────────────────────────────────────
//
// Parts as its OWN department, sharing the same canonical stock and demand records as
// Service. A dealership that bought only Parts could run this surface; a dealership
// that bought only Service never sees it. Neither owns the data — the core does.
//
// Every quantity change goes through the hardened database functions built in Batch 1
// (service_move_stock / service_reserve_part / service_issue_part). Nothing here writes
// a balance, and availability is never computed in the browser: the server returns
// qty_available = on_hand - reserved.
//
// Reads only endpoints that exist:
//   /service-engine/part-requests     demand from Service
//   /service-engine/parts-availability on hand · reserved · available

let __pwData = null;
let __pwWorkView = 'requests';

const pwPartLabel = (p) => `${p.part_number}${p.description ? ` — ${p.description}` : ''}`;
const pwReqShort = (q) => `${q.qty_requested} requested · ${q.qty_reserved} reserved · ${q.qty_issued} issued`;

// The states a Parts employee actually acts on, in the order they act on them.
const PW_ACTIONABLE = ['requested', 'backordered', 'reserved'];

// What Parts should do next about this request. Derived from the request's own state —
// no second workflow.
function pwNextAction(q, availableByPart) {
  const avail = availableByPart[q.part_id] ?? 0;
  if (q.status === 'requested' && avail > 0) return { label: 'Reserve', tone: 'amber', onclick: `pwReserve('${q.id}')` };
  if (q.status === 'requested') return { label: 'Order', tone: 'rose', onclick: `pwOrderNote('${q.id}')` };
  if (q.status === 'backordered' && avail > 0) return { label: 'Reserve', tone: 'amber', onclick: `pwReserve('${q.id}')` };
  if (q.status === 'backordered') return { label: 'Receive', tone: 'rose', onclick: `pwWorkView('receiving')` };
  if (q.status === 'reserved') return { label: 'Issue to RO', tone: 'emerald', onclick: `pwIssue('${q.id}')` };
  return { label: 'Fulfilled', tone: 'slate', onclick: '' };
}

function pwAttention(d) {
  const avail = d.availableByPart || {};
  const items = [];
  for (const q of d.requests || []) {
    if (!PW_ACTIONABLE.includes(q.status)) continue;
    const short = Math.max(0, Number(q.qty_requested) - Number(q.qty_reserved) - Number(q.qty_issued));
    let sev, why;
    if (q.status === 'backordered') { sev = 0; why = `Short ${short} — the shop is waiting`; }
    else if (q.status === 'reserved') { sev = 1; why = 'Reserved and ready to issue'; }
    else if ((avail[q.part_id] ?? 0) > 0) { sev = 2; why = 'New request — stock is available'; }
    else { sev = 0; why = 'New request — none in stock'; }
    items.push({
      sev, id: q.id, who: d.partById?.[q.part_id]?.part_number || 'Part',
      why, age: '', sub: pwReqShort(q),
      action: pwNextAction(q, avail),
    });
  }
  // Low stock is a Parts problem even when nobody has asked yet.
  for (const p of d.parts || []) {
    if (!Number(p.reorder_point) || Number(p.qty_available) > Number(p.reorder_point)) continue;
    items.push({
      sev: 3, id: `low-${p.id}`, who: p.part_number, why: `At or below reorder point (${p.qty_available} ≤ ${p.reorder_point})`,
      age: '', sub: p.description || '', action: { label: 'Receive', tone: 'amber', onclick: `pwReceive('${p.id}')` },
    });
  }
  items.sort((a, b) => a.sev - b.sev);
  return items.slice(0, 25);
}

function pwRequestRow(q, d) {
  const part = d.partById?.[q.part_id] || {};
  const na = pwNextAction(q, d.availableByPart || {});
  const avail = d.availableByPart?.[q.part_id] ?? 0;
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(part.part_number || 'Part')}</div>
      <div class="text-[12px] text-slate-400 truncate">
        ${esc(pwReqShort(q))} · <span class="${avail > 0 ? '' : 'text-rose-500'}">${avail} available</span>
        ${q.eta ? ` · ETA ${esc(q.eta)}` : ''}${q.vendor ? ` · ${esc(q.vendor)}` : ''}
      </div>
    </div>
    ${na.onclick ? `<button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${esc(na.label)}</button>` : ''}
  </div>`;
}

// ── Actions. Every one goes through the canonical server path ────────────────
async function pwRefresh() {
  ENGINE_DATA['parts-overview'] = undefined;
  engineTab('parts-overview', ENGINE_STATE['parts-overview'] || 'overview', true);
}

async function pwReserve(requestId) {
  try {
    const r = await apiSendJson(`/service-engine/part-requests/${requestId}/reserve`, 'POST', {});
    // Reserving short is a real answer, not a failure — say so plainly.
    showToast(r.reserved > 0
      ? (r.backordered > 0 ? `Reserved ${r.reserved}, ${r.backordered} on backorder` : `Reserved ${r.reserved}`)
      : 'None available — this request is on backorder', r.reserved > 0 ? 'success' : 'info');
  } catch (e) { showToast(e.message, 'error'); return; }
  pwRefresh();
}
window.pwReserve = pwReserve;

async function pwIssue(requestId) {
  try {
    const r = await apiSendJson(`/service-engine/part-requests/${requestId}/issue`, 'POST', {});
    showToast(r.issued > 0 ? `Issued ${r.issued} — stock updated` : 'Already issued', r.issued > 0 ? 'success' : 'info');
  } catch (e) { showToast(e.message, 'error'); return; }
  pwRefresh();
}
window.pwIssue = pwIssue;

async function pwReceive(partId) {
  const qty = prompt('How many did you receive?');
  if (!qty || !(Number(qty) > 0)) return;
  try {
    await apiSendJson(`/service-engine/parts/${partId}/receive`, 'POST', { qty: Number(qty) });
    showToast(`Received ${Number(qty)}`, 'success');
  } catch (e) { showToast(e.message, 'error'); return; }
  pwRefresh();
}
window.pwReceive = pwReceive;

async function pwReturnPart(partId) {
  const qty = prompt('How many are coming back into stock?');
  if (!qty || !(Number(qty) > 0)) return;
  try {
    await apiSendJson(`/service-engine/parts/${partId}/return`, 'POST', { qty: Number(qty) });
    showToast(`Returned ${Number(qty)} to stock`, 'success');
  } catch (e) { showToast(e.message, 'error'); return; }
  pwRefresh();
}
window.pwReturnPart = pwReturnPart;

// Ordering is recorded against the request itself — Stage 4 deliberately stops short of
// a purchase-order suite, and this does not pretend to be one.
function pwOrderNote(requestId) {
  showToast('Receive the part when it arrives — that clears the shortage and frees the RO.', 'info');
  __pwWorkView = 'receiving';
  engineTab('parts-overview', 'work');
}
window.pwOrderNote = pwOrderNote;

const PW_WORK_VIEWS = [
  ['requests', 'Requests'], ['ro-parts', 'RO Parts'], ['receiving', 'Receiving'], ['inventory', 'Inventory'],
];
function pwWorkView(v) { __pwWorkView = v; engineTab('parts-overview', 'work'); }
window.pwWorkView = pwWorkView;

function pwRenderWork(body, d) {
  const nav = PW_WORK_VIEWS.map(([id, label]) => {
    const on = __pwWorkView === id;
    return `<button onclick="pwWorkView('${id}')" class="px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
  }).join('');
  let inner = '';

  if (__pwWorkView === 'requests') {
    const groups = [['Short — the shop is waiting', 'backordered'], ['New requests', 'requested'],
                    ['Reserved — ready to issue', 'reserved'], ['Issued', 'issued'], ['Fulfilled', 'fulfilled']];
    inner = `<div class="space-y-3">${groups.map(([title, st]) => {
      const rows = (d.requests || []).filter(q => q.status === st);
      return rows.length ? engCard(`${title} (${rows.length})`, rows.slice(0, 15).map(q => pwRequestRow(q, d)).join('')) : '';
    }).join('') || engEmpty('No parts demand right now.')}</div>`;
  } else if (__pwWorkView === 'ro-parts') {
    // Service and Parts see the SAME state — this is the same request records, grouped
    // by the repair order that is waiting on them.
    const byRo = {};
    for (const q of d.requests || []) { (byRo[q.ro_id] ||= []).push(q); }
    const ros = Object.keys(byRo);
    inner = `<div class="space-y-3">${ros.slice(0, 20).map(roId => {
      const rows = byRo[roId];
      const blocked = rows.some(q => ['requested', 'backordered'].includes(q.status));
      return engCard(`Repair order ${roId.slice(0, 8)}${blocked ? ' — BLOCKED' : ''} (${rows.length})`,
        rows.map(q => pwRequestRow(q, d)).join(''));
    }).join('') || engEmpty('No repair order is waiting on parts.')}</div>`;
  } else if (__pwWorkView === 'receiving') {
    const short = (d.requests || []).filter(q => ['requested', 'backordered'].includes(q.status));
    const needed = {};
    for (const q of short) {
      const n = Math.max(0, Number(q.qty_requested) - Number(q.qty_reserved) - Number(q.qty_issued));
      needed[q.part_id] = (needed[q.part_id] || 0) + n;
    }
    const rows = Object.entries(needed).filter(([, n]) => n > 0);
    inner = engCard(`Needed to unblock the shop (${rows.length})`, rows.map(([partId, qty]) => {
      const p = d.partById?.[partId] || {};
      return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(p.part_number || 'Part')}</div>
          <div class="text-[12px] text-slate-400 truncate">${qty} short${p.description ? ` · ${esc(p.description)}` : ''}</div>
        </div>
        <button onclick="pwReceive('${partId}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Receive</button>
      </div>`;
    }).join('') || engEmpty('Nothing is short.'))
      + `<p class="text-[12px] text-slate-400 mt-3">Receiving is a real stock transaction — it writes the ledger and clears the shortage. Quantities are never edited directly.</p>`;
  } else if (__pwWorkView === 'inventory') {
    inner = engCard('Stock', (d.parts || []).slice(0, 50).map(p => `
      <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(pwPartLabel(p))}</div>
          <div class="text-[12px] text-slate-400 truncate">
            ${p.qty_on_hand} on hand · ${p.qty_reserved || 0} reserved ·
            <span class="${Number(p.qty_available) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${p.qty_available} available</span>
            ${p.bin ? ` · bin ${esc(p.bin)}` : ''}${Number(p.price) ? ` · $${Number(p.price).toLocaleString()}` : ''}
          </div>
        </div>
        <button onclick="pwReceive('${p.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Receive</button>
        <button onclick="pwReturnPart('${p.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Return</button>
      </div>`).join('') || engEmpty('No parts on file.'));
  }
  body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
}

ENGINES['parts-overview'] = {
  rootId: 'parts-overview-root', title: 'Parts', subtitle: 'Demand, availability, receiving and issue — one stock ledger',
  icon: 'gem', accent: 'amber',
  tabLabels: { overview: 'Today', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights', 'settings'] : ['overview', 'work'];
  },

  fetch: async () => {
    const [reqs, parts] = await Promise.all([
      apiGetJson('/service-engine/part-requests').catch(() => ({ requests: [] })),
      apiGetJson('/service-engine/parts-availability').catch(() => ({ parts: [] })),
    ]);
    const d = { requests: reqs.requests || [], parts: parts.parts || [] };
    d.partById = {}; for (const p of d.parts) d.partById[p.id] = p;
    // Availability is the SERVER's number. This only indexes it.
    d.availableByPart = {}; for (const p of d.parts) d.availableByPart[p.id] = Number(p.qty_available);
    __pwData = d;
    return d;
  },

  quickActions: [
    { label: 'Requests', icon: 'clipboard', onclick: "pwWorkView('requests')" },
    { label: 'Receiving', icon: 'truck', onclick: "pwWorkView('receiving')" },
    { label: 'Inventory', icon: 'gem', onclick: "pwWorkView('inventory')" },
    { label: 'Parts catalogue', icon: 'wrench', onclick: "switchPage('service-parts')" },
  ],
  nextActions: (d) => pwAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = pwAttention(d);
      const reqs = d.requests || [];
      const short = reqs.filter(q => q.status === 'backordered').length;
      const toIssue = reqs.filter(q => q.status === 'reserved').length;
      const low = (d.parts || []).filter(p => Number(p.reorder_point) && Number(p.qty_available) <= Number(p.reorder_point)).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Open requests', reqs.filter(q => PW_ACTIONABLE.includes(q.status)).length)}
          ${engKpi('Shop waiting', short, short ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Low stock', low, low ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('Nothing is waiting on Parts.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard(`Ready to issue (${toIssue})`, toIssue ? reqs.filter(q => q.status === 'reserved').slice(0, 6).map(q => pwRequestRow(q, d)).join('') : engEmpty('Nothing reserved and waiting.'))}
          ${engCard(`Short (${short})`, short ? reqs.filter(q => q.status === 'backordered').slice(0, 6).map(q => pwRequestRow(q, d)).join('') : engEmpty('Nothing on backorder.'))}
        </div>`;
    },
    work: pwRenderWork,
    insights(body, d) {
      const parts = d.parts || [];
      const reqs = d.requests || [];
      const onHandValue = round2Safe(parts.reduce((s, p) => s + Number(p.qty_on_hand || 0) * Number(p.cost || 0), 0));
      const fillable = reqs.filter(q => ['reserved', 'issued', 'fulfilled'].includes(q.status)).length;
      const rate = reqs.length ? Math.round((fillable / reqs.length) * 100) : null;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Parts on file', parts.length)}
          ${engKpi('Stock value', '$' + onHandValue.toLocaleString())}
          ${engKpi('Fill rate', rate == null ? '—' : rate + '%')}
          ${engKpi('Reserved units', parts.reduce((s, p) => s + Number(p.qty_reserved || 0), 0))}
        </div>
        ${engCard('Stock at or below reorder point', (parts.filter(p => Number(p.reorder_point) && Number(p.qty_available) <= Number(p.reorder_point)).slice(0, 15).map(p => `
          <div class="flex items-center gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1 font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(pwPartLabel(p))}</div>
            <div class="text-[12px] text-slate-400">${p.qty_available} / ${p.reorder_point}</div>
          </div>`).join('')) || engEmpty('Nothing needs reordering.'))}`;
    },
    settings(body) {
      body.innerHTML = engCard('Parts settings',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Catalogue, bins, reorder points and markup.</p>
         <div class="flex flex-wrap gap-2">
           <button onclick="switchPage('service-parts')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Parts catalogue</button>
           <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
         </div>`);
    },
  },
};

const round2Safe = (x) => Math.round((Number(x) || 0) * 100) / 100;

function loadPartsWorkspace() { renderEngine('parts-overview'); }
window.loadPartsWorkspace = loadPartsWorkspace;
