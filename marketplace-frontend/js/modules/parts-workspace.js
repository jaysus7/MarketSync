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
const pwStatus = (p) => (Number(p.reorder_point) > 0 && Number(p.qty_available ?? p.qty_on_hand ?? 0) <= Number(p.reorder_point)) ? 'low' : 'ok';
window.pwStatus = pwStatus;

async function pwExportCsv(btn) {
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Exporting…'; }
  try {
    const r = await fetch(`${API}/service-engine/parts/export.csv`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parts-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Parts inventory exported', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = orig; } }
}
window.pwExportCsv = pwExportCsv;

async function pwImportCsv(file) {
  if (!file) return;
  const input = document.getElementById('pw-import-file');
  let text;
  try { text = await file.text(); } catch { showToast('Could not read that file', 'error'); return; }
  showToast('Importing parts…', 'info');
  try {
    const d = await apiSendJson('/service-engine/parts/import', 'POST', { csv: text });
    const parts = [`${d.created || 0} added`, `${d.updated || 0} updated`];
    if (d.skipped) parts.push(`${d.skipped} skipped`);
    showToast('Imported — ' + parts.join(', '), 'success');
    if (d.errors && d.errors.length) console.warn('Parts import row errors:', d.errors);
    pwRefresh();
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (input) input.value = ''; }
}
window.pwImportCsv = pwImportCsv;

function pwFilterInventoryTable() {
  const query = (document.getElementById('pw-inv-search')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.pw-part-row');
  rows.forEach(r => {
    const text = (r.getAttribute('data-search') || '').toLowerCase();
    r.classList.toggle('hidden', query.length > 0 && !text.includes(query));
  });
}
window.pwFilterInventoryTable = pwFilterInventoryTable;

function pwFilterRequestsTable() {
  const query = (document.getElementById('pw-req-search')?.value || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.pw-request-row');
  rows.forEach(r => {
    const text = (r.getAttribute('data-search') || '').toLowerCase();
    r.classList.toggle('hidden', query.length > 0 && !text.includes(query));
  });
}
window.pwFilterRequestsTable = pwFilterRequestsTable;

function pwToggleAddPartForm() {
  const wrap = document.getElementById('pw-add-part-wrap');
  if (wrap) wrap.classList.toggle('hidden');
}
window.pwToggleAddPartForm = pwToggleAddPartForm;

function pwToggleNewRequestForm() {
  const wrap = document.getElementById('pw-request-part-wrap');
  if (wrap) wrap.classList.toggle('hidden');
}
window.pwToggleNewRequestForm = pwToggleNewRequestForm;

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
window.pwAttention = pwAttention;
window.partsAttention = pwAttention;

function pwRequestRow(q, d) {
  const part = d.partById?.[q.part_id] || {};
  const na = pwNextAction(q, d.availableByPart || {});
  const avail = d.availableByPart?.[q.part_id] ?? 0;
  const contact = q.contact_id ? (d.contactById?.[q.contact_id] || { full_name: 'Customer' }) : null;
  const deal = q.deal_id ? (d.dealById?.[q.deal_id] || { customer_name: 'Deal' }) : null;

  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(part.part_number || 'Part')}</div>
      <div class="text-[12px] text-slate-400 truncate"><span class="${avail > 0 ? '' : 'text-rose-500'}">${avail} available</span>${q.eta ? ` · ETA ${esc(q.eta)}` : ''}${q.vendor ? ` · ${esc(q.vendor)}` : ''}</div>
    </div>
    <button onclick="printPartsReceipt('${q.id}')" title="Print / Save Parts Receipt to Timeline" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition">Print Receipt</button>
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
  ['sales', 'Sales & F&I — delivery & deal supplies'],
  ['cleanup', 'Cleanup — detailing & wash supplies'],
  ['office', 'Office — admin & paper supplies'],
  ['customer', 'Customer — counter sale'],
  ['parts', 'Parts — inventory stock'],
  ['internal', 'Internal — shop equipment & maintenance'],
];
const PW_DEPT_LABEL = {
  service: 'Service', sales: 'Sales & F&I', cleanup: 'Cleanup & Detailing',
  office: 'Office & Admin', customer: 'Customer', parts: 'Parts Stock', internal: 'Internal Shop'
};

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
  const contactsOptions = (d.contacts || []).map(c => `<option value="${esc(c.id)}">${esc(c.full_name || c.name || c.email || 'Customer')}</option>`).join('');
  const dealsOptions = (d.deals || []).map(x => `<option value="${esc(x.id)}">${esc(x.customer_name || 'Deal')} — ${esc(x.vehicle_label || x.vehicle || x.id.slice(0, 8))}</option>`).join('');

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

    <!-- Customer & Deal Assignment -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Customer Access</span>
        <select id="pw-req-contact" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <option value="">-- Attach Customer (Optional) --</option>
          ${contactsOptions}
        </select>
      </label>
      <label class="block">
        <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Deal Access</span>
        <select id="pw-req-deal" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
          <option value="">-- Attach to Deal (Optional) --</option>
          ${dealsOptions}
        </select>
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
  const contactId = document.getElementById('pw-req-contact')?.value || null;
  const dealId = document.getElementById('pw-req-deal')?.value || null;

  if (!partId) { showToast('Pick a part.', 'error'); return; }
  if (qty <= 0) { showToast('Quantity has to be more than zero.', 'error'); return; }
  try {
    const payload = { part_id: partId, qty, requested_for: dept, contact_id: contactId, deal_id: dealId };
    if (dept === 'service') {
      if (!roId) { showToast('A Service request needs the repair order it is for.', 'error'); return; }
      await apiSendJson(`/service-engine/ros/${roId}/part-requests`, 'POST', payload);
    } else {
      await apiSendJson('/service-engine/part-requests', 'POST', payload);
    }
    showToast(`Requested for ${PW_DEPT_LABEL[dept] || dept}`, 'success');
    pwRefresh();
  } catch (e) { showToast(e.message, 'error'); }
}
window.pwCreateRequest = pwCreateRequest;

// ── Inventory — the stock itself, added and removed here ─────────────────────
function pwRenderInventory(body, d) {
  const parts = d.parts || [];
  const reqs = d.requests || [];

  const stockRows = parts.map(p => {
    const low = Number(p.reorder_point) > 0 && Number(p.qty_available ?? p.qty_on_hand ?? 0) <= Number(p.reorder_point);
    const searchKey = `${p.part_number} ${p.description || ''} ${p.bin || ''}`.toLowerCase();
    return `
      <tr class="pw-part-row border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition" data-search="${esc(searchKey)}">
        <td class="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">
          <div>${esc(p.part_number)}</div>
          ${p.bin ? `<div class="text-[11px] font-normal text-slate-400">Bin: ${esc(p.bin)}</div>` : ''}
        </td>
        <td class="px-3 py-2.5 text-slate-600 dark:text-slate-300">${esc(p.description || '—')}</td>
        <td class="px-3 py-2.5 text-right tabular-nums font-semibold">${p.qty_on_hand || 0}</td>
        <td class="px-3 py-2.5 text-right tabular-nums text-slate-400">${p.qty_reserved || 0}</td>
        <td class="px-3 py-2.5 text-right tabular-nums font-black ${Number(p.qty_available) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">
          ${p.qty_available || 0}
          ${low ? `<span class="inline-block ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 dark:bg-rose-950/50 text-rose-600">Low</span>` : ''}
        </td>
        <td class="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">$${Number(p.cost || 0).toLocaleString()}</td>
        <td class="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">$${Number(p.price || 0).toLocaleString()}</td>
        <td class="px-3 py-2.5 text-right whitespace-nowrap space-x-1.5">
          <button onclick="pwReceive('${p.id}')" class="px-2 py-1 rounded text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition">+ Receive</button>
          <button onclick="pwRemoveStock('${p.id}')" class="px-2 py-1 rounded text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">- Adjust</button>
          <button onclick="pwReturnPart('${p.id}')" class="px-2 py-1 rounded text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition">Return</button>
        </td>
      </tr>`;
  }).join('') || `<tr><td colspan="8" class="px-4 py-8 text-center text-sm text-slate-400">No parts in stock. Use "+ Add Part", Import CSV, or receive inventory.</td></tr>`;

  // Searchable Requests section
  const shortReqs = reqs.filter(q => ['requested', 'backordered'].includes(q.status));
  const activeReqs = reqs.filter(q => PW_ACTIONABLE.includes(q.status));
  const reqRows = activeReqs.map(q => {
    const part = d.partById?.[q.part_id] || {};
    const avail = d.availableByPart?.[q.part_id] ?? 0;
    const na = pwNextAction(q, d.availableByPart || {});
    const searchKey = `${part.part_number || ''} ${part.description || ''} ${q.ro_id || ''} ${q.requested_for || ''}`.toLowerCase();
    return `
      <div class="pw-request-row flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0" data-search="${esc(searchKey)}">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(part.part_number || 'Part')} ${part.description ? `<span class="font-normal text-slate-400">· ${esc(part.description)}</span>` : ''}</div>
          <div class="text-[12px] text-slate-400 truncate"><span class="${avail > 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}">${avail} available</span> · ${q.qty_requested} requested (${PW_DEPT_LABEL[q.requested_for] || q.requested_for || 'Service'})${q.ro_id ? ` · <span class="text-indigo-600 dark:text-indigo-400 font-bold">RO #${esc(q.ro_id.slice(0, 8))}</span>` : ''}</div>
        </div>
        <button onclick="printPartsReceipt('${q.id}')" title="Print / Save Parts Receipt" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition">Print Receipt</button>
        ${na.onclick ? `<button onclick="${na.onclick}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${esc(na.label)}</button>` : ''}
      </div>`;
  }).join('') || engEmpty('No active parts requests waiting.');

  // Receiving shortages needed to unblock shop
  const needed = {};
  for (const q of shortReqs) {
    const nq = Math.max(0, Number(q.qty_requested) - Number(q.qty_reserved) - Number(q.qty_issued));
    needed[q.part_id] = (needed[q.part_id] || 0) + nq;
  }
  const receiving = Object.entries(needed).filter(([, nq]) => nq > 0).map(([partId, qty]) => {
    const p = d.partById?.[partId] || {};
    return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(p.part_number || 'Part')}</div>
        <div class="text-[12px] text-slate-400 truncate"><span class="text-rose-500 font-bold">${qty} short</span>${p.description ? ` · ${esc(p.description)}` : ''}</div>
      </div>
      <button onclick="pwReceive('${partId}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-sky-600 hover:bg-sky-500 text-white transition">Receive &amp; Fulfill</button>
    </div>`;
  }).join('') || engEmpty('Nothing is short. All active repair orders are supplied.');

  body.innerHTML = `
    <!-- Top Action & Search Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="relative flex-1 min-w-[240px] max-w-md">
        <input id="pw-inv-search" oninput="pwFilterInventoryTable()" type="text" placeholder="Search inventory by Part #, description, bin..." class="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:border-indigo-500">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="pwToggleAddPartForm()" class="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition shadow-sm">+ Add Part</button>
        <button onclick="pwToggleNewRequestForm()" class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm">+ Request Part</button>
        <button onclick="pwExportCsv(this)" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition">Export CSV</button>
        <label class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer">
          Import CSV
          <input id="pw-import-file" type="file" accept=".csv" onchange="pwImportCsv(this.files[0])" class="hidden">
        </label>
      </div>
    </div>

    <!-- Add Part Accordion -->
    <div id="pw-add-part-wrap" class="hidden mb-4">
      ${engSection('Add a new part to catalogue', pwNewPartForm(), 'Creates the part record in the ledger; receive stock to set quantity')}
    </div>

    <!-- Request Part Accordion -->
    <div id="pw-request-part-wrap" class="hidden mb-4">
      ${engSection('Raise a Part Request', pwNewRequestForm(d), 'Request parts for Service repair orders, counter customers, Sales deliveries, or shop supplies')}
    </div>

    <!-- Parts Inventory Stock Table -->
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm mb-6">
      <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Stock Ledger &amp; Catalogue (${parts.length} parts)</h3>
        <span class="text-[11px] text-slate-400">All changes write immutable ledger transactions</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black text-[10px] bg-slate-50/50 dark:bg-slate-800/30">
              <th class="py-2.5 px-3">Part #</th>
              <th class="py-2.5 px-3">Description</th>
              <th class="py-2.5 px-3 text-right">On Hand</th>
              <th class="py-2.5 px-3 text-right">Reserved</th>
              <th class="py-2.5 px-3 text-right">Available</th>
              <th class="py-2.5 px-3 text-right">Cost</th>
              <th class="py-2.5 px-3 text-right">Price</th>
              <th class="py-2.5 px-3 text-right">Stock Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            ${stockRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Active Requests Section (Folded Inside Inventory) -->
    <div class="mb-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Department Demands &amp; Active Requests</h3>
        <div class="relative min-w-[200px] max-w-xs">
          <input id="pw-req-search" oninput="pwFilterRequestsTable()" type="text" placeholder="Filter requests by part / RO #..." class="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs">
          <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>
      ${engCard('', reqRows)}
    </div>

    <!-- Shop Shortages & Receiving Section -->
    <div class="mb-6">
      <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-2">Shop Shortages &amp; Waiting ROs</h3>
      ${engCard('', receiving + '<p class="text-[12px] text-slate-400 mt-2">Receiving writes the ledger and immediately clears the shortage to unblock shop repairs.</p>')}
    </div>
  `;
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
  rootId: 'parts-overview-root', title: 'Parts Department', subtitle: 'Demand, availability, receiving and issue — one stock ledger',
  icon: 'gem', accent: 'amber',
  tabLabels: { overview: 'Pulse', work: 'Inventory', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'settings'] : ['overview', 'work'];
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
    { label: 'Parts Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('parts')" },
    { label: '+ Add Part', icon: 'plus', onclick: "engineTab('parts-overview','work')" },
    { label: '+ Request Part', icon: 'clipboard', onclick: "engineTab('parts-overview','work')" },
    { label: 'Export Parts CSV', icon: 'download', onclick: "pwExportCsv(this)" },
    { label: 'Repair Orders', icon: 'wrench', onclick: "switchPage('service-overview')" },
  ],
  nextActions: (d) => pwAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = pwAttention(d || {});
      const reqs = d.requests || [];
      const parts = d.parts || [];
      const items = d.inventory || parts;
      const backordered = reqs.filter(q => q.status === 'backordered');
      const requested = reqs.filter(q => q.status === 'requested');
      const reserved = reqs.filter(q => q.status === 'reserved');
      const low = items.filter(i => pwStatus(i) === 'low').length;
      const unitsOnHand = parts.reduce((s, p) => s + Number(p.qty_on_hand || 0), 0);

      const triageBar = typeof pwRenderTriageBar === 'function' ? pwRenderTriageBar(d) : '';
      const proactiveAiPanel = typeof pwRenderProactiveAiPanel === 'function' ? pwRenderProactiveAiPanel(d) : '';
      const valuationStrip = typeof pwRenderInventoryValuationStrip === 'function' ? pwRenderInventoryValuationStrip(d) : '';
      const poSection = typeof pwRenderPurchaseOrdersSection === 'function' ? pwRenderPurchaseOrdersSection(d) : '';
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
        return rows.length ? engCard(`${PW_DEPT_LABEL[dept] || dept} (${rows.length})`, rows.map(q => pwRequestRow(q, d)).join('')) : '';
      }).join('') || engCard('', engEmpty('Nothing requested outside Service.'));

      // ── Pulse grid — the at-a-glance widget wall ────────────────────────────
      const lowStockParts = parts.filter(p => Number(p.reorder_point) > 0 && Number(p.qty_available ?? p.qty_on_hand ?? 0) <= Number(p.reorder_point))
        .sort((a, b) => Number(a.qty_available ?? 0) - Number(b.qty_available ?? 0));
      const highestValueParts = [...parts].sort((a, b) =>
        (Number(b.qty_on_hand || 0) * Number(b.cost || 0)) - (Number(a.qty_on_hand || 0) * Number(a.cost || 0))).slice(0, 6);
      const pulse = pulseGrid([
        pulseCard({
          title: 'Backordered — shop waiting', count: backordered.length, tone: backordered.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
          onclick: "engineTab('parts-overview','work')",
          inner: backordered.length ? backordered.slice(0, 5).map(q => pulseRow({
            badge: '!', badgeTone: 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300',
            label: d.partById?.[q.part_id]?.part_number || 'Part', sub: pwReqShort(q),
          })).join('') : '', empty: 'Nothing on backorder.',
        }),
        pulseCard({
          title: 'New requests to order', count: requested.length,
          onclick: "engineTab('parts-overview','work')",
          inner: requested.length ? requested.slice(0, 5).map(q => pulseRow({
            badge: '#', label: d.partById?.[q.part_id]?.part_number || 'Part', sub: pwReqShort(q),
          })).join('') : '', empty: 'No new requests.',
        }),
        pulseCard({
          title: 'Reserved — ready to issue', count: reserved.length, tone: reserved.length ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : '',
          onclick: "engineTab('parts-overview','work')",
          inner: reserved.length ? reserved.slice(0, 5).map(q => pulseRow({
            badge: '✓', badgeTone: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300',
            label: d.partById?.[q.part_id]?.part_number || 'Part', sub: pwReqShort(q),
          })).join('') : '', empty: 'Nothing reserved right now.',
        }),
        pulseSearchCard({ title: 'Inventory', placeholder: 'Search parts by number or description', count: parts.length, onclick: "engineTab('parts-overview','work')" }),
        pulseCard({
          title: 'Needs attention', count: att.length, tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '', span: 'tall',
          inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '', empty: 'Nothing is waiting on Parts.',
        }),
        pulseCard({
          title: 'At or below reorder point', count: lowStockParts.length, tone: lowStockParts.length ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' : '',
          inner: lowStockParts.length ? lowStockParts.slice(0, 6).map(p => pulseRow({
            badge: '↓', badgeTone: 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-300',
            label: pwPartLabel(p), done: Number(p.qty_available ?? 0) === 0,
            value: `${p.qty_available ?? 0}/${p.reorder_point}`, onclick: `pwReceive('${p.id}')`,
          })).join('') : '', empty: 'Nothing needs reordering.',
        }),
        pulseCard({
          title: 'Highest value in stock', count: highestValueParts.length,
          onclick: "engineTab('parts-overview','work')",
          inner: highestValueParts.length ? highestValueParts.map(p => pulseRow({
            badge: '$', label: pwPartLabel(p), sub: `${p.qty_on_hand || 0} on hand`,
            value: '$' + Math.round(Number(p.qty_on_hand || 0) * Number(p.cost || 0)).toLocaleString(),
          })).join('') : '', empty: 'No parts on file yet.',
        }),
      ]);

      body.innerHTML = `
        ${pulseHeader('Parts Pulse', 'Demand, availability, receiving and issue — one stock ledger')}
        ${pulse}

        <div class="mt-5">${triageBar}</div>
        ${proactiveAiPanel}
        ${valuationStrip}

        <div id="pw-blocked-ros-section" class="mb-4">
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            ${engKpi('Units in stock', unitsOnHand)}
            ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Open requests', reqs.filter(q => PW_ACTIONABLE.includes(q.status)).length)}
            ${engKpi('Shop waiting', backordered.length, backordered.length ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Low stock', low, low ? 'text-amber-600 dark:text-amber-400' : '')}
          </div>
        </div>

        ${poSection}

        ${engSection('By state', byStatus, 'What Parts has to do next, in the order it has to do it')}
        ${engSection('Waiting repair orders', roSection, 'The same records, grouped by the job that is held up')}
        ${engSection('Everyone else', otherSection, 'Sales, counter customers and internal jobs')}`;

      // Insights belong in the day, not behind a tab somebody has to remember.
      const strip = document.createElement('div');
      strip.className = 'mt-4';
      ENGINES['parts-overview'].tabs.__insightsStrip(strip, d);
      body.appendChild(strip);
    },
    work: pwRenderInventory,
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
