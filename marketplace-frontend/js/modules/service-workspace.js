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
// second copy that can drift: `svcStatusLabel()` for the state a user sees, and
// `SVC_ACTION_LABEL` for what the advisor is DOING.

let __svcData = null;
let __svcWorkView = 'repair-orders';

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
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <button onclick="svcOpenRecord('${r.id}')" class="min-w-0 flex-1 text-left">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(svcCustomer(r))}</div>
      <div class="text-[12px] text-slate-400 truncate">
        <span class="font-semibold text-slate-500 dark:text-slate-300">${esc(svcStatusLabel(r.status))}</span>
        ${svcVehicle(r) ? ` · ${esc(svcVehicle(r))}` : ''}${r.ro_number ? ` · ${esc(r.ro_number)}` : ''}
        ${blocked ? ' · <span class="text-orange-500">waiting for parts</span>' : ''}
        ${Number(r.total) ? ` · $${Number(r.total).toLocaleString()}` : ''}
      </div>
    </button>
    <button onclick="svcOpenRecord('${r.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open RO</button>
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
        <div class="text-[12px] text-slate-400 truncate">${esc(ro.ro_number || '')}${svcVehicle(ro) ? ` · ${esc(svcVehicle(ro))}` : ''}${ro.odometer ? ` · ${Number(ro.odometer).toLocaleString()} km` : ''}</div>
        <div class="mt-2"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${esc(svcStatusLabel(ro.status))}</span></div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="p-5 pt-3 space-y-4">
      <div>
        <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Next action</div>
        <div class="flex flex-wrap gap-2">${actions}</div>
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
    await apiSendJson(path, 'POST', toState === 'closed' ? { reason, disposition: disposition.trim() } : { status: toState, reason });
    showToast(`${svcStatusLabel(toState)} ✓`, 'success');
    document.querySelectorAll('.fixed.inset-0.z-\\[9998\\]').forEach(n => n.remove());
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcMove = svcMove;

// Check-in is idempotent server-side: a double click resolves to the same RO.
async function svcCheckIn(appointmentId) {
  try {
    const r = await apiSendJson(`/service/appointments/${appointmentId}/check-in`, 'POST', {});
    showToast(r.created ? `Checked in — ${r.ro?.ro_number || 'RO opened'}` : 'Already checked in', 'success');
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', ENGINE_STATE['service-overview'] || 'overview', true);
    if (r.ro?.id) svcOpenRecord(r.ro.id);
  } catch (e) { showToast(e.message, 'error'); }
}
window.svcCheckIn = svcCheckIn;

const SVC_WORK_VIEWS = [
  ['appointments', 'Appointments'], ['repair-orders', 'Repair Orders'],
  ['dispatch', 'Dispatch'], ['ready', 'Ready'],
];
function svcWorkView(v) { __svcWorkView = v; engineTab('service-overview', 'work'); }
window.svcWorkView = svcWorkView;

function svcRenderWork(body, d) {
  const nav = SVC_WORK_VIEWS.map(([id, label]) => {
    const on = __svcWorkView === id;
    return `<button onclick="svcWorkView('${id}')" class="px-3 py-1.5 rounded-lg text-[13px] font-bold transition ${on ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`;
  }).join('');
  let inner = '';

  if (__svcWorkView === 'appointments') {
    const groups = [
      ['Arrived — not checked in', (a) => a.status === 'arrived' && !a.repair_order_id],
      ['Today', (a) => !a.repair_order_id && a.when && new Date(a.when).toDateString() === new Date().toDateString() && a.status !== 'arrived'],
      ['Upcoming', (a) => !a.repair_order_id && a.when && new Date(a.when) > new Date() && new Date(a.when).toDateString() !== new Date().toDateString()],
      ['No show', (a) => a.status === 'no_show'],
      ['Converted', (a) => !!a.repair_order_id],
    ];
    inner = `<div class="space-y-3">${groups.map(([title, filter]) => {
      const rows = (d.appointments || []).filter(filter);
      if (!rows.length) return '';
      return engCard(`${title} (${rows.length})`, rows.slice(0, 15).map(a => `
        <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.customer || 'Customer')}</div>
            <div class="text-[12px] text-slate-400 truncate">${a.when ? esc(new Date(a.when).toLocaleString()) : ''}${a.service_type ? ` · ${esc(a.service_type)}` : ''}</div>
          </div>
          <button onclick="${a.repair_order_id ? `svcOpenRecord('${a.repair_order_id}')` : `svcCheckIn('${a.id}')`}" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold ${a.repair_order_id ? 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'} transition">${a.repair_order_id ? 'Open RO' : 'Check In'}</button>
        </div>`).join(''));
    }).join('') || engEmpty('Nothing booked.')}</div>`;
  } else if (__svcWorkView === 'repair-orders') {
    const order = ['checked_in', 'inspection', 'estimate_sent', 'customer_approved', 'parts_ordered', 'in_progress', 'quality_check', 'ready', 'delivered'];
    inner = `<div class="space-y-3">${order.map(st => {
      const rows = (d.ros || []).filter(r => r.status === st);
      return rows.length ? engCard(`${svcStatusLabel(st)} (${rows.length})`, rows.slice(0, 12).map(r => svcRoRow(r, d)).join('')) : '';
    }).join('') || engEmpty('No repair orders open.')}</div>`;
  } else if (__svcWorkView === 'dispatch') {
    const active = (d.ros || []).filter(r => ['customer_approved', 'parts_ordered', 'in_progress'].includes(r.status));
    inner = engCard(`On the floor (${active.length})`, active.map(r => svcRoRow(r, d)).join('') || engEmpty('Nothing on the floor.'))
      + `<p class="text-[12px] text-slate-400 mt-3">Assignment and job progress happen on the repair order — open one to assign a technician.</p>`;
  } else if (__svcWorkView === 'ready') {
    const ready = (d.ros || []).filter(r => r.status === 'ready');
    const delivered = (d.ros || []).filter(r => r.status === 'delivered');
    inner = `<div class="space-y-3">
      ${engCard(`Ready for the customer (${ready.length})`, ready.map(r => svcRoRow(r, d)).join('') || engEmpty('Nothing waiting for collection.'))}
      ${delivered.length ? engCard(`Delivered — needs closing (${delivered.length})`, delivered.map(r => svcRoRow(r, d)).join('')) : ''}
    </div>`;
  }
  body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
}

ENGINES['service-overview'] = {
  rootId: 'service-overview-root', title: 'Service', subtitle: 'One repair order — check in, estimate, authorize, repair, deliver',
  icon: 'wrench', accent: 'sky',
  tabLabels: { overview: 'Today', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights', 'settings'] : ['overview', 'work'];
  },

  fetch: async () => {
    const [ros, appts, reqs] = await Promise.all([
      apiGetJson('/service-engine/ros').catch(() => ({ ros: [] })),
      apiGetJson('/service/appointments').catch(() => ({ appointments: [] })),
      apiGetJson('/service-engine/part-requests').catch(() => ({ requests: [] })),
    ]);
    const d = {
      ros: (ros.ros || []).filter(r => r.status !== 'closed'),
      appointments: appts.appointments || [],
      partRequests: reqs.requests || [],
    };
    __svcData = d;
    return d;
  },

  quickActions: [
    { label: 'Appointments', icon: 'calendar', onclick: "svcWorkView('appointments')" },
    { label: 'Repair Orders', icon: 'clipboard', onclick: "svcWorkView('repair-orders')" },
    { label: 'Ready', icon: 'check', onclick: "svcWorkView('ready')" },
    { label: 'Parts', icon: 'gem', onclick: "switchPage('service-parts')" },
  ],
  nextActions: (d) => svcAttention(d || {}).slice(0, 5).map(it => ({
    label: `${it.who} — ${it.action?.label || 'Open'}`, icon: 'flame',
    tone: SALES_TONE[it.action?.tone] || SALES_TONE.slate, onclick: it.action?.onclick || '',
  })),

  tabs: {
    overview(body, d) {
      const att = svcAttention(d);
      const ros = d.ros || [];
      const waiting = ros.filter(r => r.status === 'estimate_sent').length;
      const blocked = new Set((d.partRequests || []).filter(q => ['requested', 'backordered'].includes(q.status)).map(q => q.ro_id)).size;
      const ready = ros.filter(r => r.status === 'ready').length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', att.length, att.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Open ROs', ros.length)}
          ${engKpi('Awaiting approval', waiting, waiting ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Waiting for parts', blocked, blocked ? 'text-orange-600 dark:text-orange-400' : '')}
        </div>
        ${engCard('Needs attention', att.length ? att.map(salesAttentionRow).join('') : engEmpty('Nothing is blocking the shop.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          ${engCard(`Ready for the customer (${ready})`, ready ? ros.filter(r => r.status === 'ready').slice(0, 6).map(r => svcRoRow(r, d)).join('') : engEmpty('Nothing waiting for collection.'))}
          ${engCard('On the floor', ros.filter(r => ['in_progress', 'quality_check'].includes(r.status)).slice(0, 6).map(r => svcRoRow(r, d)).join('') || engEmpty('Nothing in progress.'))}
        </div>`;
    },
    work: svcRenderWork,
    insights(body, d) {
      const ros = d.ros || [];
      const counts = Object.keys(SVC_STATE_LABEL).map(k => [svcStatusLabel(k), ros.filter(r => r.status === k).length]).filter(r => r[1] > 0);
      const mx = Math.max(1, ...counts.map(r => r[1]));
      const open = ros.length;
      const authorized = ros.filter(r => ['customer_approved', 'parts_ordered', 'in_progress', 'quality_check', 'ready', 'delivered'].includes(r.status)).length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Open ROs', open)}
          ${engKpi('Authorized', authorized)}
          ${engKpi('Awaiting approval', ros.filter(r => r.status === 'estimate_sent').length)}
          ${engKpi('Declined', ros.filter(r => r.status === 'customer_declined').length)}
        </div>
        ${engCard('Where the work is', counts.length ? counts.map(([l, n]) => `<div class="flex items-center gap-2 text-sm py-0.5">
          <div class="w-36 shrink-0 text-slate-600 dark:text-slate-300">${esc(l)}</div>
          <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden"><div class="h-full bg-sky-500 rounded-full" style="width:${Math.round((n / mx) * 100)}%"></div></div>
          <div class="w-8 text-right font-bold tabular-nums">${n}</div></div>`).join('') : engEmpty('No open work.'))}
        <p class="text-[12px] text-slate-400 mt-3">Cycle time and technician productivity need actual labour time on every job before they can be shown honestly — see the handoff.</p>`;
    },
    settings(body) {
      body.innerHTML = engCard('Service settings',
        `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Labour rate, tax, shop supplies and the appointment book.</p>
         <div class="flex flex-wrap gap-2">
           <button onclick="switchPage('service-appointments')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Appointment book</button>
           <button onclick="switchPage('config')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Dealership configuration</button>
         </div>`);
    },
  },
};

function loadServiceWorkspace() { renderEngine('service-overview'); }
window.loadServiceWorkspace = loadServiceWorkspace;
