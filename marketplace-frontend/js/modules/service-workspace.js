// ── Service workspace — Batch 3, built on the Sales pattern ──────────────────
//
// Follows docs/DEALER_OS_UX_ARCHITECTURE.md §11–12: register on the shared ENGINES
// shell, compose the endpoints the Batch 1/2 backend already exposes, invent nothing.
//
// THE RULE THIS FILE OBEYS: the database owns the repair-order state machine
// (audit §32). This module never decides which move is legal — it asks
// GET /service-engine/ros/:id/transitions and renders whatever the backend says is
// currently possible. There is no copy of the graph here, and there must never be one.
//
// Reads only endpoints that exist:
//   /service-engine/ros          repair orders
//   /service/appointments        the appointment book (crm_tasks)
//   /service-engine/part-requests parts demand, for the "waiting on parts" blocker
//   /service-engine/ros/:id/transitions   the legal next actions
//   /service-engine/ros/:id/financials    charged / paid / remaining

// State wording and action wording already exist in dashboard-part12.js, which was
// converted to the canonical vocabulary in PR 4.2a. Reuse them rather than keeping a
// second copy that can drift:// `SVC_ACTION_LABEL` for what the advisor is DOING.
if (typeof window.svcStatusLabel !== 'function') {
  window.svcStatusLabel = (s) => (typeof SVC_STATUS_LABEL !== 'undefined' && SVC_STATUS_LABEL[s]) || s || '';
}

let __svcData = null;

const svcCustomer = (r) => r.customer_name || r.customer || 'Customer';
const svcVehicle = (r) => r.vehicle_desc || [r.year, r.make, r.model].filter(Boolean).join(' ') || '';
const svcAge = (iso) => { if (!iso) return null; const h = (Date.now() - new Date(iso).getTime()) / 36e5; return Number.isFinite(h) ? Math.floor(h) : null; };
const svcAgeLabel = (iso) => { const h = svcAge(iso); return h == null ? '' : (h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`); };

// ── Today: what is stopping the shop from moving work forward ────────────────
// Every category below is a REAL canonical state or a real parts blocker. Nothing here
// is inferred from a field that does not exist.
function svcAttention(d) {
  const items = [];
  const blockedRos = new Set((d.partRequests || [])
    .filter(q => ['requested', 'backordered'].includes(q.status)).map(q => q.ro_id));

  for (const r of d.ros || []) {
    let sev = null, why = null, action = null;
    if (r.status === 'estimate_sent') { sev = 0; why = 'Waiting on the customer to approve'; action = 'Record Decision'; }
    else if (blockedRos.has(r.id)) { sev = 1; why = 'Waiting for parts'; action = 'Open Parts'; }
    else if (r.status === 'checked_in') { sev = 2; why = 'Checked in — nothing started'; action = 'Start Inspection'; }
    else if (r.status === 'inspection') { sev = 3; why = 'Inspection open — no estimate yet'; action = 'Build Estimate'; }
    else if (r.status === 'customer_approved') { sev = 3; why = 'Approved — not yet assigned'; action = 'Assign Work'; }
    else if (r.status === 'quality_check') { sev = 4; why = 'Waiting on QC'; action = 'Open RO'; }
    else if (r.status === 'ready') { sev = 4; why = 'Ready — customer not yet collected'; action = 'Deliver'; }
    else if (r.status === 'delivered') { sev = 5; why = 'Delivered — needs closing'; action = 'Close RO'; }
    if (sev == null) continue;
    items.push({
      sev, id: r.id, who: svcCustomer(r), why,
      age: svcAgeLabel(r.state_changed_at || r.updated_at || r.created_at),
      sub: `${svcVehicle(r)}${r.ro_number ? ` · ${r.ro_number}` : ''}`,
      action: { label: action, tone: sev <= 1 ? 'rose' : sev <= 3 ? 'amber' : 'slate', onclick: `svcOpenRecord('${r.id}')` },
    });
  }

  // Arrivals the shop has not dealt with yet.
  const today = new Date().toDateString();
  for (const a of d.appointments || []) {
    if (a.repair_order_id) continue;                     // already checked in
    if (!a.when || new Date(a.when).toDateString() !== today) continue;
    if (['no_show', 'canceled'].includes(a.status)) continue;
    items.push({
      sev: a.status === 'arrived' ? 0 : 2, id: a.id, who: a.customer || 'Customer',
      why: a.status === 'arrived' ? 'Arrived — not checked in' : 'Booked in today',
      age: '', sub: a.service_type || '',
      action: { label: 'Check In', tone: a.status === 'arrived' ? 'rose' : 'slate', onclick: `svcCheckIn('${a.id}')` },
    });
  }

  items.sort((a, b) => a.sev - b.sev);
  const seen = new Set(); const out = [];
  for (const it of items) { if (seen.has(it.id)) continue; seen.add(it.id); out.push(it); }
  return out.slice(0, 25);
}

function svcRoRow(r, d) {
  const blocked = (d.partRequests || []).some(q => q.ro_id === r.id && ['requested', 'backordered'].includes(q.status));
  const isOverdue = r.promise_time && new Date(r.promise_time) < new Date() && !['ready', 'delivered', 'closed'].includes(r.status);
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="svcOpenRecord('${r.id}')" class="min-w-0 flex-1 text-left">
      <div class="flex items-center gap-2">
        <span class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(svcCustomer(r))}</span>
        ${isOverdue ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 animate-pulse">SLA LATE</span>' : ''}
      </div>
      <div class="text-[12px] text-slate-400 truncate">${svcVehicle(r) ? esc(svcVehicle(r)) : ''}${r.ro_number ? `${svcVehicle(r) ? ' · ' : ''}${esc(r.ro_number)}` : ''}</div>
      <div class="text-[12px] text-slate-400"><span class="font-semibold text-slate-500 dark:text-slate-300">${esc(svcStatusLabel(r.status))}</span>${blocked ? ' · <span class="text-orange-500 font-semibold">waiting for parts</span>' : ''}${Number(r.total) ? ` · $${Number(r.total).toLocaleString()}` : ''}</div>
    </button>
    <div class="flex items-center gap-1.5 shrink-0">
      <button onclick="svcOpenVideoWalkaround('${r.id}', '${r.customer_id || ''}')" title="Record Service Video Walkaround" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition">Video Walkaround</button>
      <button onclick="svcOpenDviModal('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">DVI</button>
      <button onclick="printServiceReceipt('${r.id}')" title="Print / Save Receipt to Timeline" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition">Print Receipt</button>
      ${['ready', 'delivered'].includes(r.status) ? `<button onclick="svcOpenCheckOutModal('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition">Check Out</button>` : ''}
      ${r.status === 'estimate_sent' ? `<button onclick="svcOpenEstimateDrawer('${r.id}')" class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-amber-600 text-white hover:bg-amber-500 transition">Estimate</button>` : ''}
      <button onclick="svcOpenRecord('${r.id}')" class="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Open RO</button>
    </div>
  </div>`;
}

// ── The RO record — one surface, and the backend decides what it may do ──────
async function svcOpenRecord(roId) {
  const el = crmOverlay(`<div class="p-6"><div class="text-sm text-slate-400 py-10 text-center">Loading repair order…</div></div>`, 'max-w-3xl');
  const panel = el.firstElementChild;
  let ro, fin, moves = [];
  try {
    const [roRes, finRes, trRes] = await Promise.all([
      apiGetJson(`/service-engine/ros/${roId}`),
      apiGetJson(`/service-engine/ros/${roId}/financials`).catch(() => null),
      apiGetJson(`/service-engine/ros/${roId}/transitions`).catch(() => ({ transitions: [] })),
    ]);
    ro = roRes.ro || roRes; fin = finRes; moves = trRes.transitions || [];
  } catch (e) {
    panel.innerHTML = `<div class="p-6">${engEmpty(`Couldn't open that repair order: ${e?.message || e}`)}</div>`;
    return;
  }
  const money = (v) => v == null ? '—' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const lines = (ro.lines || []).map(l => `
    <div class="py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1 font-semibold text-[13px] text-slate-800 dark:text-slate-100 truncate">${esc(l.description || l.line_type)}</div>
        <div class="text-[12px] text-slate-400 shrink-0">${l.line_status ? esc(l.line_status) : ''}${Number(l.total) ? ` · ${money(l.total)}` : ''}</div>
      </div>
      ${l.concern ? `<div class="text-[12px] text-slate-500 mt-0.5"><span class="font-semibold">Concern:</span> ${esc(l.concern)}</div>` : ''}
      ${l.cause ? `<div class="text-[12px] text-slate-500"><span class="font-semibold">Cause:</span> ${esc(l.cause)}</div>` : ''}
      ${l.correction ? `<div class="text-[12px] text-slate-500"><span class="font-semibold">Correction:</span> ${esc(l.correction)}</div>` : ''}
    </div>`).join('') || engEmpty('No work on this RO yet.');

  // Legal actions come from the backend. If the graph says a move is impossible, it
  // simply is not rendered — the UI cannot offer something the shop cannot do.
  const actions = moves.map(t => `<button onclick="svcMove('${roId}','${t.to_state}',${t.requires_reason ? 'true' : 'false'})" class="px-3 py-2 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${esc(SVC_ACTION_LABEL[t.to_state] || svcStatusLabel(t.to_state))}</button>`).join('')
    || '<span class="text-[12px] text-slate-400">No further action from this state.</span>';

  panel.innerHTML = `
    <div class="flex items-start gap-3 p-5 pb-0">
      <div class="min-w-0 flex-1">
        <div class="text-lg font-black text-slate-900 dark:text-white truncate">${esc(svcCustomer(ro))}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc(ro.ro_number || '')}${svcVehicle(ro) ? ` · ${esc(svcVehicle(ro))}` : ''}${(ro.mileage_in || ro.odometer) ? ` · Mileage In: ${Number(ro.mileage_in || ro.odometer).toLocaleString()} mi` : ''}${ro.fuel_in ? ` · Fuel In: ${esc(ro.fuel_in)}` : ''}</div>
        <div class="mt-2 flex flex-wrap gap-2 items-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${esc(svcStatusLabel(ro.status))}</span>
          ${(ro.mileage_in || ro.odometer) ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Mileage In: ${Number(ro.mileage_in || ro.odometer).toLocaleString()} mi</span>` : ''}
          ${ro.fuel_in ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Fuel In: ${esc(ro.fuel_in)}</span>` : ''}
        </div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="p-5 pt-3 space-y-4">
      <div>
        <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Next action</div>
        <div class="flex flex-wrap gap-2">
          ${actions}
          <button onclick="printServiceReceipt('${roId}')" class="px-3.5 py-2 rounded-lg text-[12px] font-black bg-blue-600 hover:bg-blue-500 text-white transition inline-flex items-center gap-1.5 shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print / Save Customer Receipt
          </button>
        </div>
      </div>
      ${ro.complaint ? `<div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Customer concern</div>
        <div class="text-[13px] text-slate-700 dark:text-slate-200">${esc(ro.complaint)}</div></div>` : ''}
      <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Work</div>${lines}</div>
      ${fin ? `<div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Money</div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><div class="text-[11px] text-slate-400 font-semibold">Total</div><div class="text-[13px] font-bold">${money(fin.total)}</div></div>
          <div><div class="text-[11px] text-slate-400 font-semibold">Tax</div><div class="text-[13px] font-bold">${money(fin.tax)}</div></div>
          <div><div class="text-[11px] text-slate-400 font-semibold">Paid</div><div class="text-[13px] font-bold">${money(fin.paid)}</div></div>
          <div><div class="text-[11px] text-slate-400 font-semibold">Balance</div><div class="text-[13px] font-bold ${Number(fin.balance) > 0 ? 'text-rose-500' : ''}">${money(fin.balance)}</div></div>
        </div>
        ${fin.financial_disposition ? `<div class="text-[12px] text-slate-400 mt-2">Closed as ${esc(fin.financial_disposition)}</div>` : ''}
      </div>` : ''}
    </div>`;
}
window.svcOpenRecord = svcOpenRecord;

// One business action → one canonical transition. Closing additionally needs the money
// outcome stated, because the backend refuses an implicit balance.
async function svcMove(roId, toState, needsReason) {
  let reason = null, disposition = null;
  if (needsReason) {
    reason = prompt(`Why is this repair order moving to ${svcStatusLabel(toState)}?`);
    if (!reason || !reason.trim()) return;
  }
  if (toState === 'closed') {
    disposition = prompt('How was this repair order settled?\n\npaid_in_full · partial_ar · ar · warranty · internal · goodwill');
    if (!disposition || !disposition.trim()) return;
  }
  try {
    const path = toState === 'closed' ? `/service-engine/ros/${roId}/close` : `/service-engine/ros/${roId}/status`;
    const res = await apiSendJson(path, 'POST', toState === 'closed' ? { reason, disposition: disposition.trim() } : { status: toState, reason });
    // Closing schedules the customer call-back. Say so — and say it plainly when the
    // server could not schedule one, rather than letting the advisor assume it exists.
    if (toState === 'closed') {
      const f = res?.ro?.follow_up;
      if (f?.created) showToast('Closed — follow-up call scheduled for the customer', 'success');
      else if (f?.reason === 'already_scheduled') showToast('Closed — a follow-up call was already outstanding', 'success');
      else if (f?.reason === 'no_customer_on_this_ro') showToast('Closed. No customer on this repair order, so no follow-up call was scheduled.', 'success');
      else showToast(`Closed, but the follow-up call was NOT scheduled${f?.reason ? `: ${f.reason}` : ''}. Call the customer yourself.`, 'error');
    } else showToast(`${svcStatusLabel(toState)} `, 'success');
    document.querySelectorAll('.fixed.inset-0.z-\\[9998\\]').forEach(n => n.remove());
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcMove = svcMove;

// Check-in is idempotent server-side: a double click resolves to the same RO.
async function svcCheckIn(appointmentId, options = {}) {
  try {
    const payload = {};
    if (options.mileage_in != null) payload.mileage_in = options.mileage_in;
    if (options.fuel_in != null) payload.fuel_in = options.fuel_in;
    if (options.odometer != null) payload.odometer = options.odometer;
    const r = await apiSendJson(`/service/appointments/${appointmentId}/check-in`, 'POST', payload);
    showToast(r.created ? `Checked in — ${r.ro?.ro_number || 'RO opened'}` : 'Already checked in', 'success');
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'overview', true);
    if (r.ro?.id) svcOpenRecord(r.ro.id);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcCheckIn = svcCheckIn;

// ── Technician view: My Work ─────────────────────────────────────────────────
// The same repair orders, filtered to the jobs assigned to this technician and stripped
// of desk concerns — no money, no customer negotiation, no close. This shapes the
// SURFACE only: the server decides what a technician may actually do.
//
// There is no TECHNICIAN role to key off — the assignable vocabulary is
// MANAGER/SALES_REP/FNI/SERVICE/ACCOUNTING/CLEANUP, and a single SERVICE role covers
// the advisor and the technician alike. So we use the distinction the server itself
// makes in assertLineActor(): holding service.manage_workflow is the desk, and not
// holding it means you may only touch lines assigned to you. window.canDo fails OPEN
// when the access context is unavailable, which lands on the advisor surface — the
// safe direction, since every action is re-checked server-side either way.
// A technician gets the single "My Work" view. Management roles (the only roles that
// can open the Service department from the sidebar — it is mgr-gated in the registry)
// ALWAYS get the full desk tabs (Pulse / Appointments / Repair Orders / Settings), even
// if they happen to lack the granular service.manage_workflow permission — otherwise the
// department's other pages vanish behind a single tab.
const svcIsTechnician = () => {
  const role = String(profileContext?.role || '').toUpperCase();
  if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) return false;
  return typeof window.canDo === 'function' && !window.canDo('service.manage_workflow');
};

// A job is mine if the line carries my id. Lines come back with the RO.
function svcMyJobs(d) {
  const me = profileContext?.id || user?.id || null;   // same identity CRM uses for "mine"
  const out = [];
  for (const r of d.ros || []) {
    for (const l of r.lines || []) {
      if (!me || l.tech_id !== me) continue;
      if (l.deleted_at) continue;
      out.push({ ro: r, line: l });
    }
  }
  const rank = { blocked: 0, in_progress: 1, assigned: 2, pending: 3, qc: 4, complete: 5 };
  out.sort((a, b) => (rank[a.line.line_status] ?? 9) - (rank[b.line.line_status] ?? 9));
  return out;
}

function svcJobRow(j, d) {
  const l = j.line, r = j.ro;
  const blocked = (d.partRequests || []).some(q => q.ro_line_id === l.id && ['requested', 'backordered'].includes(q.status));
  const next = l.line_status === 'blocked' ? ['resume', 'Resume']
    : l.line_status === 'complete' || l.line_status === 'qc' ? null
    : l.line_status === 'in_progress' ? ['complete', 'Complete']
    : ['start', 'Start'];
  return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="flex items-center gap-3">
      <button onclick="svcOpenRecord('${r.id}')" class="min-w-0 flex-1 text-left">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(l.description || 'Job')}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc(svcVehicle(r) || svcCustomer(r))}${r.ro_number ? ` · ${esc(r.ro_number)}` : ''}</div>
        <div class="text-[12px] text-slate-400">${esc(l.line_status || 'pending')}${blocked ? ' · <span class="text-orange-500">waiting for parts</span>' : ''}</div>
      </button>
      ${next ? `<button onclick="svcJob('${l.id}','${next[0]}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">${next[1]}</button>` : ''}
      ${l.line_status === 'complete' ? `<button onclick="svcJob('${l.id}','qc')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Send to QC</button>` : ''}
      ${l.line_status !== 'blocked' && l.line_status !== 'complete' ? `<button onclick="svcJob('${l.id}','block')" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Block</button>` : ''}
    </div>
    ${l.concern ? `<div class="text-[12px] text-slate-500 mt-1"><span class="font-semibold">Concern:</span> ${esc(l.concern)}</div>` : ''}
    ${l.blocked_reason ? `<div class="text-[12px] text-orange-500 mt-0.5">Blocked: ${esc(l.blocked_reason)}</div>` : ''}
  </div>`;
}

// One shop-floor action. Cause and correction are asked for at the point they are known.
async function svcJob(lineId, action) {
  const body = { action };
  if (action === 'block') {
    const reason = prompt('What is this job waiting for?');
    if (!reason || !reason.trim()) return;
    body.reason = reason.trim();
  }
  if (action === 'complete') {
    const cause = prompt('What did you find? (cause)');
    if (cause) body.cause = cause;
    const correction = prompt('What did you do? (correction)');
    if (correction) body.correction = correction;
  }
  try {
    await apiSendJson(`/service-engine/lines/${lineId}/progress`, 'POST', body);
    showToast('Job updated ', 'success');
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcJob = svcJob;

// ── Appointments — the book, and nothing else ────────────────────────────────
// This was the "Work" tab with four sub-views stacked inside it (Appointments, Repair
// Orders, Dispatch, Ready). Repair Orders is now a tab of its own, Ready is a group
// within it, and Dispatch is gone: it was a filtered copy of the same repair orders
// with a note underneath explaining that you had to open one to do anything.
function svcRenderAppointments(body, d) {
  const groups = [
    ['Arrived — not checked in', (a) => a.status === 'arrived' && !a.repair_order_id],
    ['Today', (a) => !a.repair_order_id && a.when && new Date(a.when).toDateString() === new Date().toDateString() && a.status !== 'arrived'],
    ['Upcoming', (a) => !a.repair_order_id && a.when && new Date(a.when) > new Date() && new Date(a.when).toDateString() !== new Date().toDateString()],
    ['No show', (a) => a.status === 'no_show'],
    ['Converted', (a) => !!a.repair_order_id],
  ];
  const cards = groups.map(([title, filter]) => {
    const rows = (d.appointments || []).filter(filter);
    if (!rows.length) return '';
    return engCard(`${title} (${rows.length})`, rows.slice(0, 15).map(svcApptRow).join(''));
  }).join('');
  body.innerHTML = `${svcUnavailableNote(d)}
    ${engSection('Today and ahead', `<div class="space-y-3">${cards || engEmpty('Nothing booked.')}</div>`, 'Who is coming in, and who has arrived')}`;
  // The book itself, rather than a button that goes and finds it. It renders its own
  // header ("Service appointments"), so no header is duplicated above it.
  engMountPage(body, 'service-appointments', () => loadServiceAppointments());
}

function svcApptRow(a) {
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer || 'Customer')}</div>
      <div class="text-[12px] text-slate-400 truncate">${a.when ? esc(new Date(a.when).toLocaleString()) : ''}${a.service_type ? ` · ${esc(a.service_type)}` : ''}</div>
    </div>
    <button onclick="${a.repair_order_id ? `svcOpenRecord('${a.repair_order_id}')` : `svcOpenCheckInModal('${a.id}')`}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold ${a.repair_order_id ? 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-indigo-600 text-white hover:bg-indigo-500'} transition">${a.repair_order_id ? 'Open RO' : 'Check In'}</button>
  </div>`;
}

// ── Repair Orders — upcoming, open, closed ───────────────────────────────────
// `appointment` is the canonical state of an RO that has been raised but not yet
// checked in, so "upcoming" is a real state and not a date guess. Everything between
// check-in and delivery is open work. Closed is closed.
const SVC_OPEN_ORDER = ['checked_in', 'inspection', 'estimate_sent', 'customer_approved',
                        'customer_declined', 'parts_ordered', 'in_progress', 'quality_check',
                        'ready', 'delivered'];

// The follow-up call that closing an RO produced. `null` for the whole list means the
// call list could not be read — which must not render as "nobody needs calling".
function svcCallFor(d, roId) {
  if (d.followUps == null) return undefined;
  return (d.followUps || []).find(c => c.repair_order_id === roId) || null;
}

function svcClosedRow(r, d) {
  const call = svcCallFor(d, r.id);
  let followUp;
  if (call === undefined) followUp = `<span class="text-slate-400">Follow-up call unknown — the call list could not be loaded</span>`;
  else if (call === null) followUp = `<span class="text-slate-400">No follow-up call on file for this repair order</span>`;
  else if (call.done) followUp = `<span class="text-emerald-600 dark:text-emerald-400 font-semibold">Called${call.done_at ? ` ${esc(new Date(call.done_at).toLocaleDateString())}` : ''}</span>`;
  else followUp = `<span class="text-amber-600 dark:text-amber-400 font-semibold">Call the customer${call.due_at ? ` · due ${esc(new Date(call.due_at).toLocaleDateString())}` : ''}</span>`;
  const phone = call && call.phone ? call.phone : null;
  return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="flex items-center gap-3">
      <button onclick="svcOpenRecord('${r.id}')" class="min-w-0 flex-1 text-left">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(svcCustomer(r))}</div>
        <div class="text-[12px] text-slate-400 truncate">${svcVehicle(r) ? esc(svcVehicle(r)) : ''}${r.ro_number ? `${svcVehicle(r) ? ' · ' : ''}${esc(r.ro_number)}` : ''}</div>
        <div class="text-[12px] text-slate-400">${r.closed_at ? `Closed ${esc(new Date(r.closed_at).toLocaleDateString())}` : 'Closed'}${r.financial_disposition ? ` · ${esc(r.financial_disposition)}` : ''}${Number(r.total) ? ` · $${Number(r.total).toLocaleString()}` : ''}</div>
      </button>
      ${phone ? `<a href="tel:${esc(phone)}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Call ${esc(phone)}</a>` : ''}
      ${call && !call.done ? `<button onclick="svcCallDone('${call.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Mark called</button>` : ''}
    </div>
    <div class="text-[12px] mt-0.5">${followUp}</div>
  </div>`;
}

// The follow-up is a crm_task and is equally completable from Tasks — but a Service-only
// dealership has not bought the CRM department, so this surface completes it through
// Service's own route rather than reaching into /crm/*.
async function svcCallDone(taskId) {
  try {
    await apiSendJson(`/service-engine/follow-up-calls/${taskId}/complete`, 'POST', {});
    showToast('Follow-up call marked done', 'success');
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'ros', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcCallDone = svcCallDone;

// Upcoming, open and closed are SECTIONS of one page, not three tabs behind a second
// nav row. Scrolling shows the whole shop; a filter row hid two thirds of it.
function svcRenderRos(body, d) {
  const upcoming = (d.ros || []).filter(r => r.status === 'appointment');
  const open = `<div class="space-y-3">${SVC_OPEN_ORDER.map(st => {
    const rows = (d.ros || []).filter(r => r.status === st);
    return rows.length ? engCard(`${svcStatusLabel(st)} (${rows.length})`, rows.slice(0, 12).map(r => svcRoRow(r, d)).join('')) : '';
  }).join('') || engCard('', engEmpty('No repair orders open.'))}</div>`;

  let closed;
  if (d.closedRos == null) {
    closed = engCard('', engEmpty('Closed repair orders could not be loaded, so this section is not the whole story.'));
  } else {
    const owed = d.closedRos.filter(r => { const c = svcCallFor(d, r.id); return c && !c.done; }).length;
    closed = `${owed ? `<div class="mb-3 rounded-xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-[13px] font-bold text-amber-900 dark:text-amber-200">${owed} customer${owed === 1 ? '' : 's'} still to call back.</div>` : ''}
      ${engCard('', d.closedRos.map(r => svcClosedRow(r, d)).join('') || engEmpty('Nothing closed yet.'))}
      ${d.closedRos.length >= 200 ? '<p class="text-[12px] text-slate-400 mt-2">Showing the 200 most recent closed repair orders.</p>' : ''}`;
  }

  body.innerHTML = `${svcUnavailableNote(d)}
    ${engSection(`Upcoming (${upcoming.length})`, engCard('', upcoming.map(r => svcRoRow(r, d)).join('') || engEmpty('No repair orders waiting to start.')), 'Booked, not yet checked in')}
    ${engSection(`Open (${(d.ros || []).filter(r => SVC_OPEN_ORDER.includes(r.status)).length})`, open, 'On the floor, from check-in to delivery')}
    ${engSection(`Closed (${d.closedRos == null ? '—' : d.closedRos.length})`, closed, 'Settled and posted — the customer gets a call')}`;
}

// Names what could not be read, so an empty list is never mistaken for a quiet shop.
function svcUnavailableNote(d) {
  const miss = d?.unavailable || [];
  if (!miss.length) return '';
  return `<div class="mb-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">
    Could not load ${esc(miss.join(', '))}. What is shown below is incomplete.</div>`;
}

ENGINES['service-overview'] = {
  rootId: 'service-overview-root', title: 'Service Department', subtitle: 'One repair order — check in, estimate, authorize, repair, deliver',
  icon: 'wrench', accent: 'sky',
  // Right-rail Reports, specific to Service.
  reports: [
    { label: 'Service performance', icon: 'chart', onclick: "openDeptReport('service')" },
    { label: 'Appointments', icon: 'calendar', onclick: "openDeptReport('appointments')" },
  ],
  get tabLabels() {
    return svcIsTechnician() ? { overview: 'Pulse' }
      : { overview: 'Pulse', appointments: 'Appointments', ros: 'Repair Orders', settings: 'Settings' };
  },
  get tabOrder() {
    if (svcIsTechnician()) return ['overview'];          // My Work is the whole job
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    // Settings writes the labour rate and tax that price every RO, so it stays with
    // the desk. An advisor still gets the book and the whole repair-order list.
    return mgr ? ['overview', 'appointments', 'ros', 'settings'] : ['overview', 'appointments', 'ros'];
  },

  fetch: async () => {
    // Every read is named. A failed fetch used to fall back to an empty array, so a
    // dead endpoint and a quiet shop looked identical on screen.
    const miss = [];
    const grab = (label, p) => p.catch(() => { miss.push(label); return null; });
    const [ros, appts, reqs, closed, calls, cfg] = await Promise.all([
      grab('repair orders', apiGetJson('/service-engine/ros')),
      grab('the appointment book', apiGetJson('/service/appointments')),
      grab('parts demand', apiGetJson('/service-engine/part-requests')),
      grab('closed repair orders', apiGetJson('/service-engine/ros?status=closed')),
      grab('follow-up calls', apiGetJson('/service-engine/follow-up-calls')),
      grab('service settings', apiGetJson('/service-engine/config')),
    ]);
    const d = {
      ros: (ros?.ros || []).filter(r => r.status !== 'closed'),
      appointments: appts?.appointments || [],
      partRequests: reqs?.requests || [],
      // null, not [] — "could not read" and "none" are different answers.
      closedRos: closed ? (closed.ros || []) : null,
      followUps: calls ? (calls.calls || []) : null,
      config: cfg ? (cfg.config || null) : null,
      unavailable: miss,
    };
    __svcData = d;
    return d;
  },

  // The desk shortcuts jump to tabs a technician does not have — so the rail follows
  // the same split as the tabs.
  get quickActions() {
    if (svcIsTechnician()) return [
      { label: 'Service Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('service')" },
      { label: 'Parts', icon: 'gem', onclick: "switchPage('service-parts')" },
    ];
    return [
      { label: 'Service Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('service')" },
      { label: 'Appointments', icon: 'calendar', onclick: "engineTab('service-overview','appointments')" },
      { label: 'Repair Orders', icon: 'clipboard', onclick: "engineTab('service-overview','ros')" },
      { label: 'Parts', icon: 'gem', onclick: "switchPage('service-parts')" },
    ];
  },
  // A technician's "what needs me" is their own bench, not the shop's triage queue.
  nextActions: (d) => {
    if (svcIsTechnician()) {
      return svcMyJobs(d || {})
        .filter(j => ['blocked', 'in_progress', 'assigned'].includes(j.line.line_status))
        .slice(0, 5).map(j => ({
          label: `${j.line.description || 'Job'} — ${j.line.line_status === 'blocked' ? 'blocked' : 'open'}`,
          icon: 'flame',
          tone: j.line.line_status === 'blocked' ? SALES_TONE.amber : SALES_TONE.slate,
          onclick: `svcOpenRecord('${j.ro.id}')`,
        }));
    }
    return svcAttention(d || {}).slice(0, 5).map(it => ({
      label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
      tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
    }));
  },

  tabs: {
    overview(body, d) {
      if (svcIsTechnician()) {
        const jobs = svcMyJobs(d);
        const blocked = jobs.filter(j => j.line.line_status === 'blocked').length;
        const active = jobs.filter(j => j.line.line_status === 'in_progress').length;
        body.innerHTML = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('My jobs', jobs.length)}
            ${engKpi('In progress', active, active ? 'text-amber-600 dark:text-amber-400' : '')}
            ${engKpi('Blocked', blocked, blocked ? 'text-orange-600 dark:text-orange-400' : '')}
          </div>
          ${engCard('My work', jobs.length ? jobs.map(j => svcJobRow(j, d)).join('') : engEmpty('Nothing assigned to you right now.'))}`;
        return;
      }
      const att = svcAttention(d);
      const ros = d.ros || [];
      const waiting = ros.filter(r => r.status === 'estimate_sent').length;
      const blocked = new Set((d.partRequests || []).filter(q => ['requested', 'backordered'].includes(q.status)).map(q => q.ro_id)).size;
      const ready = ros.filter(r => r.status === 'ready').length;
      const inspection = ros.filter(r => r.status === 'inspection').length;
      const onFloor = ros.filter(r => ['in_progress', 'quality_check'].includes(r.status));
      const overduePromise = ros.filter(r => r.promise_time && new Date(r.promise_time) < new Date() && !['ready', 'delivered', 'closed'].includes(r.status));
      const declined = ros.filter(r => r.status === 'customer_declined');
      const authorized = ros.filter(r => ['customer_approved', 'parts_ordered', 'in_progress', 'quality_check', 'ready', 'delivered'].includes(r.status));
      const today = new Date().toDateString();
      const todaysAppts = (d.appointments || []).filter(a =>
        a.when && new Date(a.when).toDateString() === today && !['no_show', 'canceled'].includes(a.status));
      // Customers owed a call back after a closed RO — the day's work, not a report.
      const callbacks = d.followUps == null ? null : (d.followUps || []).filter(c => !c.done);

      // ── Pulse grid — the at-a-glance widget wall ────────────────────────────
      const grid = pulseGrid([
        pulseCard({
          title: "What's waiting", count: waiting + inspection, tone: (waiting + inspection) ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' : '',
          onclick: "engineTab('service-overview','ros')",
          inner: [
            pulseRow({ badge: waiting, label: 'Awaiting customer approval', onclick: "engineTab('service-overview','ros')" }),
            pulseRow({ badge: inspection, label: 'Waiting inspection', onclick: "engineTab('service-overview','ros')" }),
            pulseRow({ badge: blocked, label: 'Blocked on parts', valueTone: blocked ? 'text-orange-600 dark:text-orange-400' : undefined, onclick: "switchPage('parts-overview')" }),
          ].join(''),
        }),
        pulseCard({
          title: 'Live ROs', count: ros.length,
          onclick: "engineTab('service-overview','ros')",
          inner: ros.length ? ros.slice(0, 5).map(r => pulseRow({
            badge: '●', badgeTone: 'bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-300',
            label: svcCustomer(r), sub: svcStatusLabel(r.status), onclick: `svcOpenRecord('${r.id}')`,
          })).join('') : '', empty: 'No open repair orders.',
        }),
        pulseCard({
          title: 'Closed ROs', count: d.closedRos == null ? '—' : d.closedRos.length,
          onclick: "engineTab('service-overview','ros')",
          inner: d.closedRos == null ? '' : (d.closedRos.length ? d.closedRos.slice(0, 5).map(r => pulseRow({
            icon: 'check', badgeTone: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
            label: svcCustomer(r), sub: svcStatusLabel(r.status), done: true,
          })).join('') : ''), empty: d.closedRos == null ? 'Could not be loaded.' : 'Nothing closed yet.',
        }),
        pulseCard({
          title: 'Video Walkaround', onclick: "switchPage('video-studio')",
          inner: `<p class="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">Record a walkaround on any repair order to show the customer what was found.</p>`,
        }),
        pulseCard({
          title: 'Needs attention', count: att.length, tone: att.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '', span: 'tall',
          inner: att.length ? att.slice(0, 8).map(salesAttentionRow).join('') : '', empty: 'Nothing is blocking the shop.',
        }),
        pulseCard({
          title: 'Booked today', count: todaysAppts.length,
          onclick: "engineTab('service-overview','appointments')",
          inner: todaysAppts.length ? todaysAppts.slice(0, 6).map(a => pulseRow({
            icon: 'calendar', label: a.customer_name || 'Customer',
            sub: a.when ? new Date(a.when).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
          })).join('') : '', empty: 'Nothing booked for today.',
        }),
        pulseCard({
          title: 'Customers to call back', count: callbacks == null ? '—' : callbacks.length, tone: callbacks && callbacks.length ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300' : '',
          inner: callbacks == null ? '' : (callbacks.length ? callbacks.slice(0, 6).map(c => pulseRow({
            icon: 'phone', label: c.customer || 'Customer', sub: c.title || 'Follow-up call', onclick: `svcOpenRecord('${c.repair_order_id}')`,
          })).join('') : ''), empty: callbacks == null ? 'Could not be loaded.' : 'Every closed RO has been called back.',
        }),
        pulseCard({
          title: 'Ready for the customer', count: ready,
          tone: ready ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : '',
          onclick: "engineTab('service-overview','ros')",
          inner: ready ? ros.filter(r => r.status === 'ready').slice(0, 6).map(r => pulseRow({
            icon: 'check', badgeTone: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300',
            label: svcCustomer(r), sub: svcStatusLabel(r.status), onclick: `svcOpenRecord('${r.id}')`,
          })).join('') : '', empty: 'Nothing is waiting for collection.',
        }),
        pulseCard({
          title: 'On the floor', count: onFloor.length,
          onclick: "engineTab('service-overview','ros')",
          inner: onFloor.length ? onFloor.slice(0, 6).map(r => pulseRow({
            badge: '#', label: svcCustomer(r), sub: svcStatusLabel(r.status), onclick: `svcOpenRecord('${r.id}')`,
          })).join('') : '', empty: 'Nothing is in progress.',
        }),
        pulseCard({
          title: 'Authorization and SLA', count: overduePromise.length,
          tone: overduePromise.length ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300' : '',
          onclick: "engineTab('service-overview','ros')",
          inner: [
            pulseRow({ badge: authorized.length, label: 'Authorized work' }),
            pulseRow({ badge: declined.length, label: 'Declined work', valueTone: declined.length ? 'text-amber-600 dark:text-amber-400' : undefined }),
            pulseRow({ badge: overduePromise.length, label: 'Past promise time', valueTone: overduePromise.length ? 'text-rose-600 dark:text-rose-400' : undefined }),
          ].join(''),
        }),
        pulseCard({
          title: 'Repair orders by stage', count: ros.length,
          onclick: "engineTab('service-overview','ros')",
          inner: Object.keys(SVC_STATUS_LABEL).map(status => {
            const count = ros.filter(r => r.status === status).length;
            return count ? pulseRow({ badge: count, label: svcStatusLabel(status), onclick: "engineTab('service-overview','ros')" }) : '';
          }).filter(Boolean).join(''), empty: 'No open repair orders.',
        }),
        // Service must call no endpoint outside /service(-engine)/… (it is sold and must
        // work standalone), so the leaderboard itself is NOT fetched here — this links to
        // the platform's own Leaderboard page, pre-set to the Service department, which
        // reads /gamification on its own.
        pulseCard({
          title: 'Service leaderboard', onclick: "window.__activeLbDept='service'; switchPage('leaderboard')",
          inner: `<p class="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">Repair orders closed, revenue and CSI, ranked by advisor and tech.</p>`,
        }),
      ]);

      // The widget grid is the Service Pulse. Detailed repair-order work remains
      // available in the dedicated tabs instead of being repeated below it.
      body.innerHTML = `
        ${pulseHeader('Service Pulse', 'One repair order — check in, estimate, authorize, repair, deliver')}
        ${pulseActionsRow([
          { label: 'Check in', onclick: "engineTab('service-overview','appointments')" },
          { label: 'Check out', onclick: "engineTab('service-overview','ros')" },
          { label: 'Video Walkaround', onclick: "switchPage('video-studio')" },
          { label: 'Repair Orders', onclick: "engineTab('service-overview','ros')" },
        ])}
        ${svcUnavailableNote(d)}
        ${grid}`;
      return;

      body.innerHTML = `
        ${pulseHeader('Service Pulse', 'One repair order — check in, estimate, authorize, repair, deliver')}
        ${pulseActionsRow([
          { label: 'Check in', onclick: "engineTab('service-overview','appointments')" },
          { label: 'Check out', onclick: "engineTab('service-overview','ros')" },
          { label: 'Video Walkaround', onclick: "switchPage('video-studio')" },
          { label: 'Repair Orders', onclick: "engineTab('service-overview','ros')" },
        ])}
        ${grid}

        <div class="mt-5">
          ${svcUnavailableNote(d)}
          ${typeof window.svcRenderTriageBar === 'function' ? window.svcRenderTriageBar(d) : ''}
          ${typeof window.svcRenderProactiveAiPanel === 'function' ? window.svcRenderProactiveAiPanel(d) : ''}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard(`Ready for the customer (${ready})`, ready ? ros.filter(r => r.status === 'ready').slice(0, 6).map(r => svcRoRow(r, d)).join('') : engEmpty('Nothing waiting for collection.'))}
          ${engCard('On the floor', onFloor.length ? onFloor.slice(0, 6).map(r => svcRoRow(r, d)).join('') : engEmpty('Nothing in progress.'))}
        </div>
        ${typeof window.svcRenderPerformanceLayer === 'function' ? window.svcRenderPerformanceLayer(d) : ''}
        ${svcInsightsStrip(d)}`;
    },
    appointments: svcRenderAppointments,
    ros: svcRenderRos,
    settings: svcRenderSettings,
  },
};

// ── Insights, folded into My Day ─────────────────────────────────────────────
// This was its own tab. It is a picture of today's shop, so it belongs in today's
// screen. SVC_STATUS_LABEL is the vocabulary dashboard-part12.js already owns — the
// old code read SVC_STATE_LABEL, which has never existed, so opening the tab threw
// "SVC_STATE_LABEL is not defined" and rendered nothing at all.
function svcInsightsStrip(d) {
  const ros = d.ros || [];
  const counts = Object.keys(SVC_STATUS_LABEL)
    .map(k => [svcStatusLabel(k), ros.filter(r => r.status === k).length])
    .filter(r => r[1] > 0);
  const mx = Math.max(1, ...counts.map(r => r[1]));
  const authorized = ros.filter(r => ['customer_approved', 'parts_ordered', 'in_progress', 'quality_check', 'ready', 'delivered'].includes(r.status)).length;
  return `<div class="mt-3">
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
      ${engKpi('Authorized', authorized)}
      ${engKpi('Declined', ros.filter(r => r.status === 'customer_declined').length)}
      ${engKpi('Closed', d.closedRos == null ? '—' : d.closedRos.length)}
    </div>
    ${engCard('Where the work is', counts.length ? counts.map(([l, n]) => `<div class="flex items-center gap-2 text-sm py-0.5">
      <div class="w-36 shrink-0 text-slate-600 dark:text-slate-300">${esc(l)}</div>
      <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-sky-500 rounded-full" style="width:${Math.round((n / mx) * 100)}%"></div></div>
      <div class="w-8 text-right font-bold tabular-nums">${n}</div></div>`).join('') : engEmpty('No open work.'))}
    <p class="text-[12px] text-slate-400 mt-3">Cycle time and technician productivity need actual labour time on every job before they can be shown honestly — see the handoff.</p>
  </div>`;
}

function svcCallbackRow(c) {
  const overdue = c.due_at && new Date(c.due_at) < new Date();
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="svcOpenRecord('${c.repair_order_id}')" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(c.customer || 'Customer')}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(c.title || 'Follow-up call')}</div>
      <div class="text-[12px] ${overdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}">${c.due_at ? `${overdue ? 'Overdue since' : 'Due'} ${esc(new Date(c.due_at).toLocaleDateString())}` : 'No due date'}</div>
    </button>
    ${c.phone ? `<a href="tel:${esc(c.phone)}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Call</a>` : ''}
    <button onclick="svcCallDone('${c.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Done</button>
  </div>`;
}

// ── Settings — the settings, not a signpost to them ──────────────────────────
// These five values are what /service-engine/config already stores and what every RO
// is priced from. The old tab was two buttons that sent you somewhere else to find
// them.
const SVC_SETTING_FIELDS = [
  ['labor_rate', 'Labour rate', '$ per hour', 'number', '0.01'],
  ['tax_rate', 'Tax rate', '% applied to the repair order', 'number', '0.01'],
  ['shop_supplies_pct', 'Shop supplies', '% of labour', 'number', '0.01'],
  ['part_markup_pct', 'Parts markup', '% over cost when a part has no price', 'number', '0.01'],
  ['ro_prefix', 'RO number prefix', 'e.g. RO-', 'text', null],
];

function svcRenderSettings(body, d) {
  if (!d.config) {
    body.innerHTML = svcUnavailableNote(d) + engCard('Service settings',
      engEmpty('Service settings could not be loaded, so they are not shown. Nothing here has been changed.'));
    return;
  }
  const c = d.config;
  const fields = SVC_SETTING_FIELDS.map(([key, label, hint, type, step]) => `
    <label class="block">
      <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">${esc(label)}</span>
      <input id="svc-cfg-${key}" type="${type}"${step ? ` step="${step}"` : ''} value="${esc(String(c[key] ?? ''))}"
        class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
      <span class="block text-[11px] text-slate-400 mt-0.5">${esc(hint)}</span>
    </label>`).join('');
  body.innerHTML = `${svcUnavailableNote(d)}
    ${engCard('Service settings', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${fields}</div>
      <div class="flex flex-wrap items-center gap-2 mt-4">
        <button onclick="svcSaveSettings()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save settings</button>
        <span class="text-[12px] text-slate-400">Applies to repair orders priced from now on. Existing repair orders keep the numbers they were written with.</span>
      </div>`)}
    <div class="mt-3">${engCard('Elsewhere', `
      <div class="flex flex-wrap gap-2">
        <button onclick="switchPage('service-appointments')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Appointment book</button>
        <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
      </div>`)}</div>`;
}

async function svcSaveSettings() {
  const num = (id) => { const el = document.getElementById(id); const v = Number(el?.value); return Number.isFinite(v) ? v : 0; };
  const prefix = String(document.getElementById('svc-cfg-ro_prefix')?.value || '').trim();
  if (!prefix) { showToast('Give the RO number a prefix — it is what every repair order is numbered with.', 'error'); return; }
  try {
    const r = await apiSendJson('/service-engine/config', 'PUT', {
      labor_rate: num('svc-cfg-labor_rate'), tax_rate: num('svc-cfg-tax_rate'),
      shop_supplies_pct: num('svc-cfg-shop_supplies_pct'), part_markup_pct: num('svc-cfg-part_markup_pct'),
      ro_prefix: prefix,
    });
    // The server echoes what it stored; re-read rather than trusting the form.
    showToast('Service settings saved', 'success');
    if (__svcData) __svcData.config = r.config || __svcData.config;
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', 'settings', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcSaveSettings = svcSaveSettings;

function loadServiceWorkspace() { renderEngine('service-overview'); }
window.loadServiceWorkspace = loadServiceWorkspace;
