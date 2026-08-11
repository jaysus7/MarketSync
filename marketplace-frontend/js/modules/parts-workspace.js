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
  if (q.status === 'backordered') return { label: 'Receive', tone: 'rose', onclick: `engineTab('parts-overview','work')` };
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
      <div class="text-[12px] text-slate-400 truncate">${esc(pwReqShort(q))}</div>
      <div class="text-[12px] text-slate-400 truncate"><span class="${avail > 0 ? '' : 'text-rose-500'}">${avail} available</span>${q.eta ? ` · ETA ${esc(q.eta)}` : ''}${q.vendor ? ` · ${esc(q.vendor)}` : ''}</div>
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
  engineTab('parts-overview', 'work');
}
window.pwOrderNote = pwOrderNote;

// Who a part is for. Mirrors PART_REQUEST_DEPARTMENTS on the server — Parts serves the
// whole store, and until now every request had to be a Service request against an RO.
const PW_DEPARTMENTS = [
  ['service', 'Service — against a repair order'],
  ['sales', 'Sales — for a delivery'],
  ['customer', 'Customer — counter sale'],
  ['internal', 'Internal — our own vehicle or shop'],
];
const PW_DEPT_LABEL = { service: 'Service', sales: 'Sales', customer: 'Customer', internal: 'Internal' };

// ── Requests — every department's demand, in one list ────────────────────────
// This was "Requests" and "RO Parts" as two views behind a sub-nav; they were the same
// records grouped two ways. Both groupings are sections now, so neither is hidden.
function pwRenderRequests(body, d) {
  const groups = [['Short — the shop is waiting', 'backordered'], ['New requests', 'requested'],
                  ['Reserved — ready to issue', 'reserved'], ['Issued', 'issued'], ['Fulfilled', 'fulfilled']];
  const byStatus = groups.map(([title, st]) => {
    const rows = (d.requests || []).filter(q => q.status === st);
    return rows.length ? engCard(`${title} (${rows.length})`, rows.slice(0, 15).map(q => pwRequestRow(q, d)).join('')) : '';
  }).join('') || engCard('', engEmpty('No parts demand right now.'));

  // Service demand, grouped by the repair order that is waiting on it.
  const byRo = {};
  for (const q of d.requests || []) { if (q.ro_id) (byRo[q.ro_id] ||= []).push(q); }
  const roIds = Object.keys(byRo);
  const roSection = roIds.slice(0, 20).map(roId => {
    const rows = byRo[roId];
    const blocked = rows.some(q => ['requested', 'backordered'].includes(q.status));
    return engCard(`Repair order ${roId.slice(0, 8)}${blocked ? ' — BLOCKED' : ''} (${rows.length})`,
      rows.map(q => pwRequestRow(q, d)).join(''));
  }).join('') || engCard('', engEmpty('No repair order is waiting on parts.'));

  // Demand that is not Service at all — the counter, a delivery, an internal job.
  const other = (d.requests || []).filter(q => (q.requested_for || 'service') !== 'service');
  const otherSection = ['sales', 'customer', 'internal'].map(dept => {
    const rows = other.filter(q => q.requested_for === dept);
    return rows.length ? engCard(`${PW_DEPT_LABEL[dept]} (${rows.length})`, rows.map(q => pwRequestRow(q, d)).join('')) : '';
  }).join('') || engCard('', engEmpty('Nothing requested outside Service.'));

  body.innerHTML = `
    ${engSection('Raise a request', pwNewRequestForm(d), 'One dropdown says which department it is for')}
    ${engSection('By state', byStatus, 'What Parts has to do next, in the order it has to do it')}
    ${engSection('Waiting repair orders', roSection, 'The same records, grouped by the job that is held up')}
    ${engSection('Everyone else', otherSection, 'Sales, counter customers and internal jobs')}`;
}

function pwNewRequestForm(d) {
  const parts = (d.parts || []).slice(0, 400)
    .map(p => `<option value="${esc(p.id)}">${esc(pwPartLabel(p))}</option>`).join('');
  const depts = PW_DEPARTMENTS.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  return engCard('', `
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <label class="block sm:col-span-2">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Part</span>
        <select id="pw-req-part" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${parts || '<option value="">No parts on file</option>'}</select>
      </label>
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Requested for</span>
        <select id="pw-req-dept" onchange="pwReqDeptChanged()" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${depts}</select>
      </label>
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Quantity</span>
        <input id="pw-req-qty" type="number" min="1" step="1" value="1" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
      </label>
    </div>
    <div id="pw-req-ro-wrap" class="mt-3">
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Repair order</span>
        <input id="pw-req-ro" placeholder="Repair order id" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <span class="block text-[11px] text-slate-400 mt-0.5">A Service request belongs to a job — the server refuses one without it.</span>
      </label>
    </div>
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <button onclick="pwCreateRequest()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Request part</button>
      <span class="text-[12px] text-slate-400">Requesting does not move stock. Reserve and Issue do, through the ledger.</span>
    </div>`);
}

// Only a Service request carries a repair order, so only Service shows the field.
function pwReqDeptChanged() {
  const dept = document.getElementById('pw-req-dept')?.value;
  document.getElementById('pw-req-ro-wrap')?.classList.toggle('hidden', dept !== 'service');
}
window.pwReqDeptChanged = pwReqDeptChanged;

async function pwCreateRequest() {
  const dept = document.getElementById('pw-req-dept')?.value || 'service';
  const partId = document.getElementById('pw-req-part')?.value;
  const qty = Number(document.getElementById('pw-req-qty')?.value) || 0;
  const roId = (document.getElementById('pw-req-ro')?.value || '').trim();
  if (!partId) { showToast('Pick a part.', 'error'); return; }
  if (qty <= 0) { showToast('Quantity has to be more than zero.', 'error'); return; }
  try {
    if (dept === 'service') {
      if (!roId) { showToast('A Service request needs the repair order it is for.', 'error'); return; }
      await apiSendJson(`/service-engine/ros/${roId}/part-requests`, 'POST', { part_id: partId, qty, requested_for: 'service' });
    } else {
      await apiSendJson('/service-engine/part-requests', 'POST', { part_id: partId, qty, requested_for: dept });
    }
    showToast(`Requested for ${PW_DEPT_LABEL[dept] || dept}`, 'success');
    pwRefresh();
  } catch (e) { showToast(e.message, 'error'); }
}
window.pwCreateRequest = pwCreateRequest;

// ── Inventory — the stock itself, added and removed here ─────────────────────
function pwRenderInventory(body, d) {
  const rows = (d.parts || []).map(p => `
    <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(pwPartLabel(p))}</div>
        <div class="text-[12px] text-slate-400 truncate">${p.qty_on_hand} on hand · ${p.qty_reserved || 0} reserved</div>
        <div class="text-[12px] text-slate-400 truncate"><span class="${Number(p.qty_available) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">${p.qty_available} available</span>${p.bin ? ` · bin ${esc(p.bin)}` : ''}${Number(p.price) ? ` · $${Number(p.price).toLocaleString()}` : ''}</div>
      </div>
      <button onclick="pwReceive('${p.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Add</button>
      <button onclick="pwRemoveStock('${p.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Remove</button>
      <button onclick="pwReturnPart('${p.id}')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Return</button>
    </div>`).join('') || engEmpty('No parts on file.');

  const short = (d.requests || []).filter(q => ['requested', 'backordered'].includes(q.status));
  const needed = {};
  for (const q of short) {
    const nq = Math.max(0, Number(q.qty_requested) - Number(q.qty_reserved) - Number(q.qty_issued));
    needed[q.part_id] = (needed[q.part_id] || 0) + nq;
  }
  const receiving = Object.entries(needed).filter(([, nq]) => nq > 0).map(([partId, qty]) => {
    const p = d.partById?.[partId] || {};
    return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(p.part_number || 'Part')}</div>
        <div class="text-[12px] text-slate-400 truncate">${qty} short${p.description ? ` · ${esc(p.description)}` : ''}</div>
      </div>
      <button onclick="pwReceive('${partId}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Receive</button>
    </div>`;
  }).join('') || engEmpty('Nothing is short.');

  body.innerHTML = `
    ${engSection('Add a part', pwNewPartForm(), 'A new part number joins the catalogue with no stock until you receive some')}
    ${engSection('Stock', engCard('', rows), 'Add, remove and return — every one writes the ledger')}
    ${engSection('Receiving', engCard('', receiving) + '<p class="text-[12px] text-slate-400 mt-2">Receiving is a real stock transaction — it writes the ledger and clears the shortage. Quantities are never edited directly.</p>', 'What has to arrive to unblock the shop')}
    ${engSection('Catalogue', '', 'Part numbers, bins, cost and price')}`;
  engMountPage(body, 'service-parts', () => loadServicePartsPage());
}

function pwNewPartForm() {
  const f = (id, label, type, hint, extra) => `
    <label class="block">
      <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">${esc(label)}</span>
      <input id="pw-new-${id}" type="${type}"${extra || ''} class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
      ${hint ? `<span class="block text-[11px] text-slate-400 mt-0.5">${esc(hint)}</span>` : ''}
    </label>`;
  return engCard('', `
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      ${f('number', 'Part number', 'text', 'Required — it is the catalogue key')}
      ${f('desc', 'Description', 'text', '')}
      ${f('bin', 'Bin', 'text', 'Where it lives on the shelf')}
      ${f('cost', 'Cost', 'number', 'What you pay', ' step="0.01" min="0"')}
      ${f('price', 'Price', 'number', 'What you charge', ' step="0.01" min="0"')}
      ${f('reorder', 'Reorder point', 'number', 'Below this, Parts is told', ' step="1" min="0"')}
    </div>
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <button onclick="pwCreatePart()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Add part</button>
      <span class="text-[12px] text-slate-400">Adding a part does not add stock. Receive it below once it is physically here.</span>
    </div>`);
}

async function pwCreatePart() {
  const v = (id) => (document.getElementById(`pw-new-${id}`)?.value || '').trim();
  const partNumber = v('number');
  if (!partNumber) { showToast('A part needs a part number.', 'error'); return; }
  try {
    await apiSendJson('/service-engine/parts', 'POST', {
      part_number: partNumber, description: v('desc') || null, bin: v('bin') || null,
      cost: Number(v('cost')) || 0, price: Number(v('price')) || 0, reorder_point: Number(v('reorder')) || 0,
    });
    showToast(`${partNumber} added to the catalogue`, 'success');
    pwRefresh();
  } catch (e) { showToast(e.message, 'error'); }
}
window.pwCreatePart = pwCreatePart;

// Removing stock is an ADJUSTMENT, not a delete: the ledger keeps the movement and the
// reason. A part number is never deleted out from under the repair orders that used it.
async function pwRemoveStock(partId) {
  const qty = prompt('How many are coming out of stock?');
  if (!qty || !(Number(qty) > 0)) return;
  const reason = prompt('Why? (damaged, miscount, used internally…)');
  if (!reason || !reason.trim()) { showToast('An adjustment needs a reason — that is the whole point of the ledger.', 'error'); return; }
  try {
    await apiSendJson(`/service-engine/parts/${partId}/adjust`, 'POST', { qty: -Math.abs(Number(qty)), note: reason.trim() });
    showToast(`Removed ${Number(qty)} from stock`, 'success');
  } catch (e) { showToast(e.message, 'error'); return; }
  pwRefresh();
}
window.pwRemoveStock = pwRemoveStock;

// ── Settings ─────────────────────────────────────────────────────────────────
function pwRenderSettings(body, d) {
  if (!d.config) {
    body.innerHTML = engSection('Parts settings',
      engCard('', engEmpty('Parts settings could not be loaded, so they are not shown. Nothing has been changed.')));
    return;
  }
  const c = d.config;
  body.innerHTML = engSection('Parts settings', engCard('', `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Parts markup</span>
        <input id="pw-cfg-part_markup_pct" type="number" step="0.01" min="0" value="${esc(String(c.part_markup_pct ?? ''))}"
          class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <span class="block text-[11px] text-slate-400 mt-0.5">% over cost when a part carries no price of its own</span>
      </label>
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Labour rate</span>
        <input id="pw-cfg-labor_rate" type="number" step="0.01" min="0" value="${esc(String(c.labor_rate ?? ''))}"
          class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
        <span class="block text-[11px] text-slate-400 mt-0.5">Shared with Service — the same repair order is priced from both</span>
      </label>
    </div>
    <div class="flex flex-wrap items-center gap-2 mt-4">
      <button onclick="pwSaveSettings()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save settings</button>
      <span class="text-[12px] text-slate-400">Reorder points are per part and are set on the part itself, under Inventory.</span>
    </div>`), 'What a part costs the customer, and when Parts gets told to reorder');
}

async function pwSaveSettings(){
  const num = (id) => { const x = Number(document.getElementById(id)?.value); return Number.isFinite(x) ? x : 0; };
  try {
    // The config is shared with Service, so send it whole — a partial PUT would blank
    // the fields this form does not show.
    const cur = __pwData?.config || {};
    await apiSendJson('/service-engine/config', 'PUT', {
      ...cur,
      part_markup_pct: num('pw-cfg-part_markup_pct'),
      labor_rate: num('pw-cfg-labor_rate'),
    });
    showToast('Parts settings saved', 'success');
    ENGINE_DATA['parts-overview'] = undefined;
    engineTab('parts-overview', 'settings', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.pwSaveSettings = pwSaveSettings;

ENGINES['parts-overview'] = {
  rootId: 'parts-overview-root', title: 'Parts', subtitle: 'Demand, availability, receiving and issue — one stock ledger',
  icon: 'gem', accent: 'amber',
  // Insights folded into My Day. Work is named for what it holds, and Requests takes
  // the slot Insights had.
  tabLabels: { overview: 'My Day', work: 'Inventory', requests: 'Requests', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'requests', 'settings'] : ['overview', 'work', 'requests'];
  },

  fetch: async () => {
    const miss = [];
    const grab = (label, p) => p.catch(() => { miss.push(label); return null; });
    const [reqs, parts, cfg] = await Promise.all([
      grab('parts demand', apiGetJson('/service-engine/part-requests')),
      grab('stock availability', apiGetJson('/service-engine/parts-availability')),
      grab('parts settings', apiGetJson('/service-engine/config')),
    ]);
    const d = {
      requests: reqs?.requests || [], parts: parts?.parts || [],
      config: cfg ? (cfg.config || null) : null, unavailable: miss,
    };
    d.partById = {}; for (const p of d.parts) d.partById[p.id] = p;
    // Availability is the SERVER's number. This only indexes it.
    d.availableByPart = {}; for (const p of d.parts) d.availableByPart[p.id] = Number(p.qty_available);
    __pwData = d;
    return d;
  },

  quickActions: [
    { label: 'Requests', icon: 'clipboard', onclick: "engineTab('parts-overview','requests')" },
    { label: 'Inventory', icon: 'gem', onclick: "engineTab('parts-overview','work')" },
    { label: 'Repair orders', icon: 'wrench', onclick: "switchPage('service-overview')" },
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
      // Insights belong in the day, not behind a tab somebody has to remember.
      const strip = document.createElement('div');
      strip.className = 'mt-4';
      ENGINES['parts-overview'].tabs.__insightsStrip(strip, d);
      body.appendChild(strip);
    },
    work: pwRenderInventory,
    requests: pwRenderRequests,
    settings: pwRenderSettings,
    // The old Insights tab, now rendered INSIDE My Day.
    __insightsStrip(body, d) {
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
  },
};

const round2Safe = (x) => Math.round((Number(x) || 0) * 100) / 100;

function loadPartsWorkspace() { renderEngine('parts-overview'); }
window.loadPartsWorkspace = loadPartsWorkspace;
