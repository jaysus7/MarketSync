/* dashboard.js split part 12/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function opsResolveException(id) {
  try { await apiSendJson(`/exceptions/${id}/resolve`, 'POST'); showToast('Resolved ✓', 'success'); loadOperationsPage(); }
  catch (e) { showToast(e.message || 'Failed', 'error'); }
}

// ══ Five-section entity panel — the UI law: Summary / Timeline / Current State /
// Next Action / Related Records — for a deal, vehicle, or customer. ═══════════
async function opsOpenEntity(type, id, label) {
  if (!type || !id) return;
  const overlay = crmOverlay(`<div class="p-5"><div class="text-sm text-slate-400 py-16 text-center">Loading…</div></div>`, 'max-w-2xl');
  const panel = overlay.firstElementChild;   // the white card; swap its content when data arrives
  const taskParam = type === 'deal' ? 'deal_id' : type === 'vehicle' ? 'inventory_id' : 'contact_id';
  let timeline = [], instances = [], tasks = [];
  try {
    const [tl, wf, tk] = await Promise.all([
      apiGetJson(`/timeline/${type}/${id}`).catch(() => ({ timeline: [] })),
      apiGetJson(`/workflow/instances/${type}/${id}`).catch(() => ({ instances: [] })),
      apiGetJson(`/dealer-tasks?${taskParam}=${encodeURIComponent(id)}`).catch(() => ({ tasks: [] })),
    ]);
    timeline = tl.timeline || []; instances = wf.instances || []; tasks = tk.tasks || [];
  } catch {}

  const latest = timeline[0];
  const curState = latest?.to_state || (instances[0]?.status === 'running' ? 'in progress' : '—');
  const dept = timeline.find(e => e.department)?.department || null;
  const running = instances.filter(i => i.status === 'running');
  const openTasks = tasks.filter(t => t.status !== 'done');
  const blocked = openTasks.filter(t => t.status === 'blocked');
  const actionable = openTasks.filter(t => t.status !== 'blocked');
  const nextTask = actionable[0] || null;

  const sec = (icon, title, body) => `<div class="space-y-2">
    <div class="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-400">${svgIcon(icon,'w-3.5 h-3.5')}${title}</div>
    ${body}</div>`;

  const timelineHtml = timeline.length ? `<div class="relative pl-4 space-y-2.5 max-h-56 overflow-y-auto">
    ${timeline.map(e => `<div class="relative">
      <span class="absolute -left-4 top-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
      <div class="text-[13px] text-slate-700 dark:text-slate-200">${esc(e.summary || e.event_name)}</div>
      <div class="text-[11px] text-slate-400">${e.department ? esc(e.department) + ' · ' : ''}${opsRelTime(e.created_at)}</div>
    </div>`).join('')}</div>` : `<div class="text-xs text-slate-400">No activity recorded yet.</div>`;

  const nextHtml = nextTask
    ? `<div class="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
         <div class="text-sm font-bold text-indigo-900 dark:text-indigo-200">${esc(nextTask.title)}</div>
         <div class="text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">${esc(nextTask.kind || '')}${nextTask.department ? ' · ' + esc(nextTask.department) : ''}${nextTask.due_date ? ' · due ' + esc(nextTask.due_date) : ''}</div>
         <button onclick="this.closest('.fixed').remove(); switchPage('taskboard')" class="mt-2 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">Open on Task Board ${svgIcon('chevronRight','w-3 h-3')}</button>
       </div>`
    : running.length
      ? `<div class="text-sm text-slate-500 dark:text-slate-400">Workflow running — no open task right now.</div>`
      : `<div class="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">${svgIcon('check','w-4 h-4')}All caught up.</div>`;

  const relatedHtml = `<div class="flex flex-wrap gap-1.5 text-[11px]">
    ${running.map(i => `<span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1">${svgIcon('bolt','w-3 h-3')}Workflow running</span>`).join('')}
    ${blocked.length ? `<span class="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">${blocked.length} blocked</span>` : ''}
    <span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${openTasks.length} open task${openTasks.length === 1 ? '' : 's'}</span>
    <span class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${timeline.length} event${timeline.length === 1 ? '' : 's'}</span>
  </div>`;

  if (!panel || !overlay.isConnected) return;   // user closed it while loading
  panel.innerHTML = `<div class="p-5 space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <span class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-500">${svgIcon(ENTITY_ICON[type] || 'dot','w-5 h-5')}</span>
        <div>
          <div class="text-lg font-black text-slate-900 dark:text-white capitalize">${esc(label || type)}</div>
          <div class="text-[11px] text-slate-400 font-mono">${esc(String(id).slice(0, 8))}</div>
        </div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>

    ${sec('eye','Current state', `<div class="flex items-center gap-2"><span class="text-base font-bold text-slate-900 dark:text-white capitalize">${esc(curState)}</span>${dept ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${esc(dept)}</span>` : ''}</div>`)}

    ${sec('rocket','Next action', nextHtml)}

    ${sec('calendar','Timeline', timelineHtml)}

    ${sec('clipboard','Related records', relatedHtml)}
  </div>`;
}
Object.assign(window, { loadOperationsPage, opsResolveException, opsOpenEntity });

// ══ Service & Parts Engine UI — repair orders + parts stock ═══════════════════
let __svcRoFilter = '';
let __svcParts = [];   // cached catalog for the add-line part picker
const svcMoney = (v) => '$' + (Number(v) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// The repair-order state machine lives in the DATABASE (docs/STAGE4_SERVICE_PARTS_AUDIT.md
// §32). These are the twelve states `repair_orders_status_valid` actually permits — the
// old open / awaiting_parts / canceled were never real and no RO could ever hold them.
// The label is dealership language; the value persisted is always the canonical state.
const SVC_STATUSES = ['appointment', 'checked_in', 'inspection', 'estimate_sent', 'customer_approved',
                      'customer_declined', 'parts_ordered', 'in_progress', 'quality_check', 'ready',
                      'delivered', 'closed'];
const SVC_STATUS_LABEL = {
  appointment: 'Booked', checked_in: 'Checked In', inspection: 'Inspecting',
  estimate_sent: 'Awaiting Approval', customer_approved: 'Approved', customer_declined: 'Declined',
  parts_ordered: 'Waiting for Parts', in_progress: 'In Progress', quality_check: 'Quality Check',
  ready: 'Ready', delivered: 'Delivered', closed: 'Closed',
};
const svcStatusLabel = (s) => SVC_STATUS_LABEL[s] || s;
// What the advisor is DOING, phrased as the action rather than the resulting state.
const SVC_ACTION_LABEL = {
  checked_in: 'Check In', inspection: 'Start Inspection', estimate_sent: 'Send Estimate',
  customer_approved: 'Record Approval', customer_declined: 'Record Decline',
  parts_ordered: 'Mark Parts Ordered', in_progress: 'Start Work', quality_check: 'Send to QC',
  ready: 'Mark Ready', delivered: 'Deliver to Customer', closed: 'Close RO → post to accounting',
};
let __svcTransitions = [];
const svcStatusChip = (s) => {
  const c = { appointment: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', checked_in: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300', inspection: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300', estimate_sent: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', customer_approved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300', customer_declined: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', parts_ordered: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300', in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', quality_check: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', delivered: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300', closed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' }[s] || 'bg-slate-100 text-slate-600';
  return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${c}">${esc(svcStatusLabel(s))}</span>`;
};

async function loadServiceRosPage() {
  const root = document.getElementById('service-ros-root');
  if (!root) return;
  root.innerHTML = '<div class="text-slate-400 text-sm p-6">Loading repair orders…</div>';
  try {
    const [sum, list] = await Promise.all([
      apiGetJson('/service-engine/summary').catch(() => ({})),
      apiGetJson('/service-engine/ros' + (__svcRoFilter ? '?status=' + encodeURIComponent(__svcRoFilter) : '')),
    ]);
    const ros = list.ros || [];
    const stat = (label, val) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-sm"><div class="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">${esc(label)}</div><div class="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">${val}</div></div>`;
    const tab = (key, label) => `<button onclick="svcRoFilter('${key}')" class="px-4 py-2 rounded-xl text-xs font-bold transition ${__svcRoFilter === key ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${esc(label)}</button>`;
    const rows = ros.map(r => `
      <tr class="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer" onclick="svcOpenRo('${r.id}')">
        <td class="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-200 w-[15%]">${esc(r.ro_number || '—')}</td>
        <td class="px-4 py-3.5 text-slate-600 dark:text-slate-300 w-[35%] font-medium">${esc(r.vehicle_desc || (r.vin ? 'VIN ' + r.vin : '—'))}</td>
        <td class="px-4 py-3.5 w-[20%]">${svcStatusChip(r.status)}</td>
        <td class="px-4 py-3.5 text-right font-bold text-slate-700 dark:text-slate-200 w-[15%]">${svcMoney(r.total)}</td>
        <td class="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap w-[15%]">${r.opened_at ? new Date(r.opened_at).toLocaleDateString() : ''}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm font-medium">No repair orders${__svcRoFilter ? ' in this state' : ' yet'}.</td></tr>`;
    root.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Repair Orders</h1>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Manage active service repair orders, shop status, and billing.</p>
          </div>
          <button onclick="svcNewRoForm()" class="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-md shadow-teal-600/20 transition flex items-center gap-1.5">+ New RO</button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${stat('Open ROs', sum.open_ros ?? 0)}${stat('Closed', sum.closed_ros ?? 0)}${stat('Revenue', svcMoney(sum.revenue))}${stat('Gross', svcMoney(sum.gross))}
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1 pb-1">
          ${tab('', 'All')}${['checked_in', 'estimate_sent', 'parts_ordered', 'in_progress', 'ready', 'delivered', 'closed'].map(s => tab(s, svcStatusLabel(s))).join('')}
        </div>

        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                <th class="px-4 py-3.5 font-bold w-[15%]">RO #</th>
                <th class="px-4 py-3.5 font-bold w-[35%]">Vehicle</th>
                <th class="px-4 py-3.5 font-bold w-[20%]">Status</th>
                <th class="px-4 py-3.5 font-bold text-right w-[15%]">Total</th>
                <th class="px-4 py-3.5 font-bold w-[15%]">Opened</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">${rows}</tbody>
          </table>
        </div>
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-rose-500 text-sm p-6">Couldn't load: ${esc(e.message)}</div>`; }
}
function svcRoFilter(k) { __svcRoFilter = k; loadServiceRosPage(); }

async function svcNewRoForm() {
  const root = document.getElementById('service-ros-root');
  if (!root) return;
  root.innerHTML = `
    <button onclick="loadServiceRosPage()" class="text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← Back</button>
    <h1 class="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">New Repair Order</h1>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-xl space-y-3">
      <div>
        <label class="text-[12px] font-bold text-slate-500">Customer (optional)</label>
        <input id="svc-ro-cust" oninput="svcCustSearch(this.value)" placeholder="Search customer by name/phone/email" class="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
        <input type="hidden" id="svc-ro-cust-id">
        <div id="svc-ro-cust-results" class="mt-1 space-y-1"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-[12px] font-bold text-slate-500">Vehicle</label><input id="svc-ro-veh" placeholder="2019 Honda Civic" class="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
        <div><label class="text-[12px] font-bold text-slate-500">VIN</label><input id="svc-ro-vin" class="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-[12px] font-bold text-slate-500">Odometer</label><input id="svc-ro-odo" type="number" class="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
      </div>
      <div><label class="text-[12px] font-bold text-slate-500">Complaint / concern</label><textarea id="svc-ro-complaint" rows="2" class="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></textarea></div>
      <button onclick="svcCreateRo()" class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition">Open RO</button>
    </div>`;
}
let __svcCustTimer = null;
function svcCustSearch(q) {
  clearTimeout(__svcCustTimer);
  const box = document.getElementById('svc-ro-cust-results');
  if (!q || q.trim().length < 2) { if (box) box.innerHTML = ''; return; }
  __svcCustTimer = setTimeout(async () => {
    try {
      const r = await apiGetJson('/deals/customers?q=' + encodeURIComponent(q.trim()));
      box.innerHTML = (r.rows || []).slice(0, 6).map(c => `<button onclick="svcPickCust('${c.id}','${esc((c.name || '').replace(/'/g, ' '))}')" class="block w-full text-left px-3 py-1.5 rounded-lg text-[13px] bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40">${esc(c.name)}${c.phone ? ' · ' + esc(c.phone) : ''}</button>`).join('');
    } catch {}
  }, 300);
}
function svcPickCust(id, name) {
  document.getElementById('svc-ro-cust-id').value = id;
  document.getElementById('svc-ro-cust').value = name;
  document.getElementById('svc-ro-cust-results').innerHTML = `<div class="text-[12px] text-teal-600 font-bold">✓ ${esc(name)}</div>`;
}
async function svcCreateRo() {
  const body = {
    contact_id: document.getElementById('svc-ro-cust-id').value || null,
    vehicle_desc: document.getElementById('svc-ro-veh').value.trim() || null,
    vin: document.getElementById('svc-ro-vin').value.trim() || null,
    odometer: document.getElementById('svc-ro-odo').value ? Number(document.getElementById('svc-ro-odo').value) : null,
    complaint: document.getElementById('svc-ro-complaint').value.trim() || null,
  };
  try { const r = await apiSendJson('/service-engine/ros', 'POST', body); showToast('RO ' + (r.ro?.ro_number || '') + ' opened ✓', 'success'); svcOpenRo(r.ro.id); }
  catch (e) { showToast(e.message, 'error'); }
}

async function svcOpenRo(id) {
  const root = document.getElementById('service-ros-root');
  if (!root) return;
  root.innerHTML = '<div class="text-slate-400 text-sm p-6">Loading RO…</div>';
  try {
    const [res, tr] = await Promise.all([
      apiGetJson('/service-engine/ros/' + id),
      apiGetJson(`/service-engine/ros/${id}/transitions`).catch(() => ({ transitions: [] })),
    ]);
    __svcTransitions = tr.transitions || [];
    if (!__svcParts.length) { try { __svcParts = (await apiGetJson('/service-engine/parts')).parts || []; } catch {} }
    const ro = res.ro, cust = res.customer;
    const closed = ro.status === 'closed';
    const lineRows = (ro.lines || []).map(l => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="px-3 py-2"><span class="text-[11px] font-bold uppercase text-slate-400">${esc(l.line_type)}</span></td>
        <td class="px-3 py-2 text-slate-600 dark:text-slate-300">${esc(l.description || '')}</td>
        <td class="px-3 py-2 text-right">${Number(l.qty)}</td>
        <td class="px-3 py-2 text-right">${svcMoney(l.total)}</td>
        <td class="px-3 py-2 text-right">${closed ? '' : `<button onclick="svcRemoveLine('${ro.id}','${l.id}')" class="text-rose-500 hover:text-rose-600 text-xs font-bold">Remove</button>`}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400 text-sm">No lines yet.</td></tr>`;
    const partOpts = __svcParts.map(p => `<option value="${p.id}" data-price="${p.price}">${esc(p.part_number)} — ${esc(p.description || '')} (${p.qty_on_hand} on hand)</option>`).join('');
    // Business actions, not a free status dropdown. The legal moves come from the
    // database's own transition table via /transitions — the frontend never carries a
    // second copy of the graph, so it can never offer a move the shop cannot make.
    const nextActions = (__svcTransitions || []).map(t => `<button onclick="svcTransition('${ro.id}','${t.to_state}',${t.requires_reason ? 'true' : 'false'})" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-sm font-bold transition">${esc(SVC_ACTION_LABEL[t.to_state] || svcStatusLabel(t.to_state))}</button>`).join('')
      || '<span class="text-sm text-slate-400">No further action from this state.</span>';
    root.innerHTML = `
      <button onclick="loadServiceRosPage()" class="text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">← All ROs</button>
      <div class="flex flex-wrap items-center justify-between gap-3 mt-2">
        <div><h1 class="text-xl font-black text-slate-800 dark:text-slate-100">RO ${esc(ro.ro_number || '')}</h1>
          <div class="text-sm text-slate-500 mt-0.5">${esc(ro.vehicle_desc || ro.vin || '')}${cust ? ' · ' + esc(cust.name) : ''}</div></div>
        <div class="flex items-center gap-2">${svcStatusChip(ro.status)}</div>
      </div>
      ${ro.complaint ? `<div class="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2"><span class="font-bold">Concern:</span> ${esc(ro.complaint)}</div>` : ''}
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table class="w-full text-sm min-w-[520px]">
          <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400"><th class="px-3 py-2">Type</th><th class="px-3 py-2">Description</th><th class="px-3 py-2 text-right">Qty</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2"></th></tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot><tr class="border-t-2 border-slate-200 dark:border-slate-700"><td colspan="3" class="px-3 py-2 text-right font-bold text-slate-500">Total (incl. tax)</td><td class="px-3 py-2 text-right font-black text-slate-800 dark:text-slate-100">${svcMoney(ro.total)}</td><td></td></tr></tfoot>
        </table>
      </div>
      ${closed ? '' : `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div class="text-[12px] font-bold text-slate-500 uppercase tracking-wide">Add line</div>
        <div class="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <div><label class="text-[11px] text-slate-400 font-bold">Type</label>
            <select id="svc-line-type" onchange="svcLineTypeChanged()" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="labor">Labor</option><option value="part">Part</option><option value="sublet">Sublet</option><option value="fee">Fee</option></select></div>
          <div id="svc-line-part-wrap" class="hidden md:col-span-2"><label class="text-[11px] text-slate-400 font-bold">Part</label>
            <select id="svc-line-part" onchange="svcLinePartChanged()" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">— pick —</option>${partOpts}</select></div>
          <div id="svc-line-desc-wrap" class="md:col-span-2"><label class="text-[11px] text-slate-400 font-bold">Description</label><input id="svc-line-desc" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
          <div id="svc-line-hours-wrap"><label class="text-[11px] text-slate-400 font-bold">Hours</label><input id="svc-line-hours" type="number" step="0.1" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
          <div><label class="text-[11px] text-slate-400 font-bold">Qty</label><input id="svc-line-qty" type="number" value="1" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
          <div><label class="text-[11px] text-slate-400 font-bold">Unit price</label><input id="svc-line-price" type="number" step="0.01" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
        </div>
        <button onclick="svcAddLine('${ro.id}')" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition">Add line</button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${nextActions}
      </div>`}`;
    svcLineTypeChanged();
  } catch (e) { root.innerHTML = `<div class="text-rose-500 text-sm p-6">Couldn't load RO: ${esc(e.message)}</div>`; }
}
function svcLineTypeChanged() {
  const t = document.getElementById('svc-line-type')?.value;
  if (!t) return;
  document.getElementById('svc-line-part-wrap').classList.toggle('hidden', t !== 'part');
  document.getElementById('svc-line-hours-wrap').classList.toggle('hidden', t !== 'labor');
}
function svcLinePartChanged() {
  const sel = document.getElementById('svc-line-part');
  const opt = sel?.selectedOptions?.[0];
  if (opt && opt.dataset.price) document.getElementById('svc-line-price').value = opt.dataset.price;
}
async function svcAddLine(roId) {
  const type = document.getElementById('svc-line-type').value;
  const body = {
    line_type: type,
    description: document.getElementById('svc-line-desc').value.trim() || null,
    qty: Number(document.getElementById('svc-line-qty').value) || 1,
    hours: type === 'labor' && document.getElementById('svc-line-hours').value ? Number(document.getElementById('svc-line-hours').value) : null,
    unit_price: document.getElementById('svc-line-price').value ? Number(document.getElementById('svc-line-price').value) : 0,
    part_id: type === 'part' ? (document.getElementById('svc-line-part').value || null) : null,
  };
  if (type === 'part' && !body.part_id) return showToast('Pick a part', 'error');
  try { await apiSendJson(`/service-engine/ros/${roId}/lines`, 'POST', body); svcOpenRo(roId); }
  catch (e) { showToast(e.message, 'error'); }
}
async function svcRemoveLine(roId, lineId) {
  try { await apiSendJson(`/service-engine/ros/${roId}/lines/${lineId}`, 'DELETE'); svcOpenRo(roId); }
  catch (e) { showToast(e.message, 'error'); }
}
// One business action → one canonical transition. `closed` keeps its confirmation
// because it is the financial act: parts are drawn and the sale is posted.
async function svcTransition(roId, toState, needsReason) {
  let reason = null;
  if (needsReason) {
    reason = prompt(`Why is this repair order moving to ${svcStatusLabel(toState)}?`);
    if (!reason || !reason.trim()) return;
  }
  if (toState === 'closed' && !confirm('Close this RO? Parts will be drawn from stock and the sale posted to accounting.')) return;
  try {
    const path = toState === 'closed' ? `/service-engine/ros/${roId}/close` : `/service-engine/ros/${roId}/status`;
    await apiSendJson(path, 'POST', toState === 'closed' ? { reason } : { status: toState, reason });
    showToast(`${svcStatusLabel(toState)} ✓`, 'success');
    svcOpenRo(roId);
  } catch (e) { showToast(e.message, 'error'); }
}
async function svcCloseRo(roId) {
  if (!confirm('Close this RO? Parts will be drawn from stock and the sale posted to accounting.')) return;
  try { await apiSendJson(`/service-engine/ros/${roId}/close`, 'POST'); showToast('RO closed & posted ✓', 'success'); svcOpenRo(roId); }
  catch (e) { showToast(e.message, 'error'); }
}