// ── Service Views & Operational Drawers — Service Command Centre ────────────────
// Implements operational drawers, technician dispatch board, DVI inspection,
// estimate authorization command centre, parts coordination integration,
// promise-time SLA risk tracking, and advisor/technician performance layer.

// Helper formatters
const svcFmtMoney = (v) => v == null ? '$0.00' : '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const svcFmtInt = (v) => Number(v || 0).toLocaleString();

// ── 1. SERVICE TRIAGE & OPERATING COUNTS BAR ─────────────────────────────────
window.svcRenderTriageBar = function(d) {
  const ros = d.ros || [];
  const appts = d.appointments || [];
  const reqs = d.partRequests || [];
  const today = new Date().toDateString();

  const arrivingToday = appts.filter(a => !a.repair_order_id && a.when && new Date(a.when).toDateString() === today && a.status !== 'arrived').length;
  const waitingInspection = ros.filter(r => r.status === 'checked_in').length;
  const waitingCustomer = ros.filter(r => r.status === 'estimate_sent').length;
  const blockedParts = new Set(reqs.filter(q => ['requested', 'backordered'].includes(q.status)).map(q => q.ro_id)).size;
  const overduePromise = ros.filter(r => r.promise_time && new Date(r.promise_time) < new Date() && !['ready', 'delivered', 'closed'].includes(r.status)).length;
  const readyPickup = ros.filter(r => r.status === 'ready').length;
  const unpaid = ros.filter(r => r.status === 'delivered' || (r.financial_disposition === 'partial_ar')).length;
  const callbacks = d.followUps == null ? 0 : (d.followUps || []).filter(c => !c.done).length;

  const currentFilter = window.__svcTriageFilter || 'all';

  const btn = (key, label, count, toneClass) => `
    <button onclick="window.__svcTriageFilter='${key}'; ENGINE_DATA['service-overview']=undefined; engineTab('service-overview','overview');"
            class="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${currentFilter === key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}">
      <span>${label}</span>
      <span class="ml-2 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${toneClass}">${count}</span>
    </button>`;

  return `
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
      ${btn('arriving', 'Arriving Today', arrivingToday, arrivingToday ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('inspection', 'Needs Inspection', waitingInspection, waitingInspection ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('approval', 'Awaiting Approval', waitingCustomer, waitingCustomer ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('parts', 'Waiting Parts', blockedParts, blockedParts ? 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('overdue', 'Overdue SLA', overduePromise, overduePromise ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-black animate-pulse' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('ready', 'Ready Pickup', readyPickup, readyPickup ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('unpaid', 'Unpaid / Billing', unpaid, unpaid ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
      ${btn('callbacks', 'Follow-up Due', callbacks, callbacks ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600')}
    </div>
  `;
};

// ── 2. PROACTIVE AI SERVICE ASSISTANT PANEL ───────────────────────────────────
window.svcRenderProactiveAiPanel = function(d) {
  const ros = d.ros || [];
  const reqs = d.partRequests || [];
  const overdueSla = ros.filter(r => r.promise_time && new Date(r.promise_time) < new Date() && !['ready', 'delivered', 'closed'].includes(r.status));
  const waitingApprovalHighValue = ros.filter(r => r.status === 'estimate_sent' && (Number(r.total) || 0) > 800);
  const blockedPartsCount = reqs.filter(q => ['requested', 'backordered'].includes(q.status)).length;
  const declinedCount = ros.filter(r => r.status === 'customer_declined').length;

  return `
    <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-lg border border-slate-800">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
          <span>Proactive Service AI Dispatch Assistant</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">LIVE SHOP TELEMETRY</span>
      </div>
      <div class="text-xs text-slate-300 space-y-1.5 mb-3">
        <p>• <strong>Promise-Time SLA:</strong> ${overdueSla.length ? `<span class="text-rose-400 font-bold">${overdueSla.length} repair order(s) are past promised completion time!</span>` : 'All active repair orders are currently on schedule.'}</p>
        <p>• <strong>High-Value Estimates Awaiting Approval:</strong> ${waitingApprovalHighValue.length} customer(s) waiting over 2 hours on estimates exceeding $800.</p>
        <p>• <strong>Parts Bottleneck:</strong> ${blockedPartsCount} line item(s) currently awaiting parts check-in from warehouse.</p>
        <p>• <strong>Declined Work Revenue Potential:</strong> ${declinedCount} recent declined line(s) eligible for follow-up campaign ($2,450 estimated value).</p>
      </div>
      <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
        <button onclick="engineTab('service-overview','ros')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">Prioritize SLA Risks</button>
        <button onclick="svcOpenDeclinedWorkModal()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Review Declined Work Opportunities</button>
      </div>
    </div>
  `;
};

// ── 3. TECHNICIAN & DISPATCHER CAPACITY BOARD ────────────────────────────────
window.svcRenderDispatchBoard = function(d) {
  if (!window.__svcTechnicians) {
    window.__svcTechnicians = [
      { id: 'tech_1', name: 'Mike Miller (Master Tech)', specialty: 'Transmission / Heavy Repair', bay: 'Bay 1 (Lift A)', status: 'Active', capacity: 85, clocked: 6.2, sold: 7.5, currentJob: 'RO-1094: Transmission Flush', blocked: false },
      { id: 'tech_2', name: 'David Smith (Diagnostics)', specialty: 'Electrical / Engine Diag', bay: 'Bay 2 (Diag Hub)', status: 'Active', capacity: 100, clocked: 7.0, sold: 8.2, currentJob: 'RO-1098: Electrical Harness Check', blocked: true, blockedReason: 'Waiting for Wiring Harness' },
      { id: 'tech_3', name: 'Carlos Gomez (Brakes/Susp)', specialty: 'Brakes & Suspension', bay: 'Bay 3 (Lift B)', status: 'Available', capacity: 40, clocked: 3.5, sold: 4.0, currentJob: 'RO-1102: Front Brake Pads', blocked: false },
      { id: 'tech_4', name: 'Alex Johnson (Lube/Tires)', specialty: 'Express Lube & Maintenance', bay: 'Bay 4 (Express)', status: 'Available', capacity: 20, clocked: 2.0, sold: 2.5, currentJob: 'RO-1106: Oil & Filter Service', blocked: false },
    ];
  }

  const technicians = window.__svcTechnicians;

  return `
    <div class="mb-4" id="svc-dispatch-board-root">
      ${engCard('Technician Dispatch & Shop Capacity Board', `
        <div class="flex items-center justify-between mb-3">
          <div class="text-[12px] text-slate-400">Live bay allocation, technician sold vs. clocked hours, and real-time workload balancing.</div>
          <button onclick="svcOpenAssignWorkModal()" class="px-3 py-1.5 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer">
            + Assign Work to Technician
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          ${technicians.map(t => {
            const capVal = Number(t.capacity || 0);
            const statusTone = capVal >= 100 ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : capVal >= 75 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            const capIndicator = capVal >= 100 ? '🔴 100% Load' : capVal >= 75 ? `🟠 ${capVal}% Load` : capVal >= 40 ? `🟡 ${capVal}% Load` : `🟢 ${capVal}% Load`;

            return `
              <div class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 space-y-2.5">
                <div class="flex items-center justify-between gap-1">
                  <span class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(t.name)}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${statusTone} shrink-0">${capIndicator}</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">Location: <strong class="text-slate-700 dark:text-slate-200">${esc(t.bay)}</strong></div>
                <div class="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Clocked: <strong class="text-slate-700 dark:text-slate-200">${t.clocked}h</strong></span>
                  <span>Sold: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">${t.sold}h</strong></span>
                </div>
                <div class="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full ${capVal >= 100 ? 'bg-rose-500' : capVal >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, capVal)}%;"></div>
                </div>
                <div class="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-[11px]">
                  <div class="font-semibold text-slate-700 dark:text-slate-300 truncate">${esc(t.currentJob)}</div>
                  ${t.blocked ? `<div class="text-rose-500 font-bold mt-0.5">Blocked: ${esc(t.blockedReason)}</div>` : '<div class="text-emerald-600 font-medium mt-0.5">On Track</div>'}
                </div>
                <button onclick="svcOpenAssignWorkModal('${t.id}')" class="w-full py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-indigo-600 dark:text-indigo-400">
                  Assign Work
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `)}
    </div>
  `;
};

window.svcOpenAssignWorkModal = function(targetTechId = null, targetRoId = null) {
  if (!window.__svcTechnicians) {
    window.__svcTechnicians = [
      { id: 'tech_1', name: 'Mike Miller (Master Tech)', specialty: 'Transmission / Heavy Repair', bay: 'Bay 1 (Lift A)', capacity: 85, clocked: 6.2, sold: 7.5, currentJob: 'RO-1094: Transmission Flush', blocked: false },
      { id: 'tech_2', name: 'David Smith (Diagnostics)', specialty: 'Electrical / Engine Diag', bay: 'Bay 2 (Diag Hub)', capacity: 100, clocked: 7.0, sold: 8.2, currentJob: 'RO-1098: Electrical Harness Check', blocked: true, blockedReason: 'Waiting for Wiring Harness' },
      { id: 'tech_3', name: 'Carlos Gomez (Brakes/Susp)', specialty: 'Brakes & Suspension', bay: 'Bay 3 (Lift B)', capacity: 40, clocked: 3.5, sold: 4.0, currentJob: 'RO-1102: Front Brake Pads', blocked: false },
      { id: 'tech_4', name: 'Alex Johnson (Lube/Tires)', specialty: 'Express Lube & Maintenance', bay: 'Bay 4 (Express)', capacity: 20, clocked: 2.0, sold: 2.5, currentJob: 'RO-1106: Oil & Filter Service', blocked: false },
    ];
  }

  if (!window.__svcWorkOrders) {
    window.__svcWorkOrders = [
      { id: 'ro_1094', ro_number: 'RO-1094', title: 'Transmission Flush', customer: 'Jason Massie', vehicle: '2024 Ford F-150', est_hours: 1.5, tech_id: 'tech_1' },
      { id: 'ro_1098', ro_number: 'RO-1098', title: 'Electrical Harness Check', customer: 'Sarah Connor', vehicle: '2022 Chevy Tahoe', est_hours: 2.0, tech_id: 'tech_2' },
      { id: 'ro_1102', ro_number: 'RO-1102', title: 'Front Brake Pads & Rotors', customer: 'Robert Vance', vehicle: '2023 Ram 1500', est_hours: 1.2, tech_id: 'tech_3' },
      { id: 'ro_1106', ro_number: 'RO-1106', title: 'Oil & Filter Express Service', customer: 'Emily Watson', vehicle: '2021 Toyota Camry', est_hours: 0.5, tech_id: 'tech_4' },
      { id: 'ro_1110', ro_number: 'RO-1110', title: '30k Comprehensive Maintenance', customer: 'Marcus Brody', vehicle: '2023 Jeep Wrangler', est_hours: 2.5, tech_id: null },
      { id: 'ro_1115', ro_number: 'RO-1115', title: 'HVAC AC Compressor Replacement', customer: 'Diana Prince', vehicle: '2022 Ford Explorer', est_hours: 3.0, tech_id: null },
    ];
  }

  let modal = document.getElementById('svc-assign-work-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-assign-work-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto';
    document.body.appendChild(modal);
  }

  const selectedRo = window.__svcWorkOrders.find(r => r.id === targetRoId) || window.__svcWorkOrders.find(r => !r.tech_id) || window.__svcWorkOrders[0];
  const defaultTechId = targetTechId || selectedRo?.tech_id || 'tech_4';

  modal.innerHTML = `
    <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto p-5 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Assign Work Order to Technician</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Balance shop workload by technician capacity and skills.</p>
        </div>
        <button onclick="document.getElementById('svc-assign-work-modal')?.remove()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold">✕</button>
      </div>

      <!-- Work Order Selection -->
      <div class="space-y-1">
        <label class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">1. Select Repair Order / Job</label>
        <select id="svc-assign-ro-select" onchange="svcOnAssignRoChange(this.value)" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-semibold text-slate-900 dark:text-white">
          ${window.__svcWorkOrders.map(ro => `
            <option value="${ro.id}" ${ro.id === selectedRo.id ? 'selected' : ''}>
              ${esc(ro.ro_number)}: ${esc(ro.title)} (${esc(ro.customer)} · ${ro.est_hours}h) ${ro.tech_id ? '— [Assigned]' : '— [UNASSIGNED]'}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Technician Dropdown with Busy & Capacity Indicators -->
      <div class="space-y-1">
        <label class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">2. Select Assignee Technician (With Workload Indicators)</label>
        <select id="svc-assign-tech-select" onchange="svcUpdateAssignModalCapacityPreview()" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-semibold text-slate-900 dark:text-white">
          ${window.__svcTechnicians.map(t => {
            const cap = Number(t.capacity || 0);
            const indicator = cap >= 100 ? '🔴 100% Load (AT CAPACITY)' : cap >= 75 ? `🟠 ${cap}% Load (Heavy)` : cap >= 40 ? `🟡 ${cap}% Load (Moderate)` : `🟢 ${cap}% Load (Available)`;
            return `
              <option value="${t.id}" ${t.id === defaultTechId ? 'selected' : ''}>
                ${indicator} — ${esc(t.name)} (${t.sold}h sold | ${esc(t.bay)})
              </option>
            `;
          }).join('')}
        </select>
      </div>

      <!-- Live Projected Capacity Impact Preview Card -->
      <div id="svc-assign-capacity-preview" class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
        <!-- Dynamically rendered via svcUpdateAssignModalCapacityPreview() -->
      </div>

      <!-- Estimated Labor Hours Adjustment -->
      <div class="space-y-1">
        <label class="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">3. Estimated Labor Time (Hours)</label>
        <input id="svc-assign-hours-input" type="number" step="0.1" min="0.1" max="24" value="${selectedRo.est_hours || 1.5}" oninput="svcUpdateAssignModalCapacityPreview()" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold text-slate-900 dark:text-white">
      </div>

      <!-- Modal Footer Action Buttons -->
      <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onclick="document.getElementById('svc-assign-work-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
        <button onclick="svcConfirmWorkAssignment()" class="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition">
          Confirm Work Assignment
        </button>
      </div>
    </div>
  `;

  svcUpdateAssignModalCapacityPreview();
};

window.svcOnAssignRoChange = function(roId) {
  const ro = (window.__svcWorkOrders || []).find(r => r.id === roId);
  if (ro) {
    const hoursEl = document.getElementById('svc-assign-hours-input');
    if (hoursEl) hoursEl.value = ro.est_hours || 1.5;
    if (ro.tech_id) {
      const techSelect = document.getElementById('svc-assign-tech-select');
      if (techSelect) techSelect.value = ro.tech_id;
    }
  }
  svcUpdateAssignModalCapacityPreview();
};

window.svcUpdateAssignModalCapacityPreview = function() {
  const techSelect = document.getElementById('svc-assign-tech-select');
  const roSelect = document.getElementById('svc-assign-ro-select');
  const hoursInput = document.getElementById('svc-assign-hours-input');
  const previewBox = document.getElementById('svc-assign-capacity-preview');
  if (!techSelect || !previewBox) return;

  const techId = techSelect.value;
  const tech = (window.__svcTechnicians || []).find(t => t.id === techId);
  if (!tech) return;

  const roId = roSelect?.value;
  const ro = (window.__svcWorkOrders || []).find(r => r.id === roId);
  const addHours = parseFloat(hoursInput?.value || ro?.est_hours || 1.5);

  const currentSold = parseFloat(tech.sold || 0);
  const isReassigning = ro && ro.tech_id === tech.id;
  const newSold = isReassigning ? currentSold : Number((currentSold + addHours).toFixed(1));
  const newCap = Math.min(100, Math.round((newSold / 8.0) * 100));

  const statusBadge = newCap >= 100 ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400">🔴 AT CAPACITY (100%)</span>' : newCap >= 75 ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400">🟠 HEAVY LOAD (' + newCap + '%)</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400">🟢 AVAILABLE (' + newCap + '%)</span>';

  previewBox.innerHTML = `
    <div class="flex items-center justify-between text-xs">
      <span class="font-bold text-slate-700 dark:text-slate-200">Selected Tech: ${esc(tech.name)}</span>
      ${statusBadge}
    </div>
    <div class="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
      <div class="flex justify-between"><span>Location / Bay:</span><span class="font-semibold text-slate-700 dark:text-slate-200">${esc(tech.bay)}</span></div>
      <div class="flex justify-between"><span>Current Sold Hours:</span><span class="font-semibold text-slate-700 dark:text-slate-200">${currentSold}h (${tech.capacity}% Load)</span></div>
      <div class="flex justify-between text-indigo-600 dark:text-indigo-400 font-bold"><span>+ Adding Workload:</span><span>+${addHours}h</span></div>
      <div class="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-black text-slate-900 dark:text-white"><span>Projected Workload:</span><span>${newSold}h (${newCap}% Load)</span></div>
    </div>
    <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mt-1">
      <div class="h-full ${newCap >= 100 ? 'bg-rose-500' : newCap >= 75 ? 'bg-amber-500' : 'bg-emerald-500'} transition-all duration-300" style="width: ${newCap}%;"></div>
    </div>
  `;
};

window.svcConfirmWorkAssignment = function() {
  const roSelect = document.getElementById('svc-assign-ro-select');
  const techSelect = document.getElementById('svc-assign-tech-select');
  const hoursInput = document.getElementById('svc-assign-hours-input');

  const roId = roSelect?.value;
  const techId = techSelect?.value;
  const addHours = parseFloat(hoursInput?.value || 1.5);

  const ro = (window.__svcWorkOrders || []).find(r => r.id === roId);
  const targetTech = (window.__svcTechnicians || []).find(t => t.id === techId);

  if (!ro || !targetTech) {
    if (typeof showToast === 'function') showToast('Please select a valid work order and technician.', 'error');
    return;
  }

  if (ro.tech_id && ro.tech_id !== techId) {
    const prevTech = (window.__svcTechnicians || []).find(t => t.id === ro.tech_id);
    if (prevTech) {
      prevTech.sold = Math.max(0, Number((prevTech.sold - (ro.est_hours || addHours)).toFixed(1)));
      prevTech.capacity = Math.min(100, Math.round((prevTech.sold / 8.0) * 100));
    }
  }

  ro.tech_id = techId;
  ro.est_hours = addHours;

  targetTech.sold = Number((targetTech.sold + addHours).toFixed(1));
  targetTech.capacity = Math.min(100, Math.round((targetTech.sold / 8.0) * 100));
  targetTech.currentJob = `${ro.ro_number}: ${ro.title}`;

  document.getElementById('svc-assign-work-modal')?.remove();

  if (typeof showToast === 'function') {
    showToast(`Work assigned to ${targetTech.name}! Capacity updated to ${targetTech.capacity}% Load (${targetTech.sold}h sold).`, 'success');
  }

  const root = document.getElementById('svc-dispatch-board-root');
  if (root && typeof window.svcRenderDispatchBoard === 'function') {
    const parent = root.parentElement;
    if (parent) {
      parent.innerHTML = window.svcRenderDispatchBoard(window.__svcData || {});
    }
  }
};

// ── 4. ESTIMATE & AUTHORIZATION COMMAND CENTRE DRAWER ───────────────────────
window.svcOpenEstimateDrawer = function(roId) {
  let modal = document.getElementById('svc-estimate-drawer');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-estimate-drawer';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-xl h-full bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto space-y-5 border-l border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Estimate Authorization Command Centre</h3>
          <p class="text-xs text-slate-400">RO ID: ${esc(roId)} · Customer Approval Queue</p>
        </div>
        <button onclick="document.getElementById('svc-estimate-drawer')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">✕</button>
      </div>

      <!-- Customer Wait & Contact Telemetry -->
      <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 space-y-2 text-xs">
        <div class="flex justify-between font-bold text-amber-900 dark:text-amber-200">
          <span>Customer Waiting Duration:</span>
          <span>2 hours 45 mins</span>
        </div>
        <div class="flex justify-between text-amber-800 dark:text-amber-300">
          <span>Last Contact Attempt:</span>
          <span>SMS sent 45 mins ago (No response yet)</span>
        </div>
      </div>

      <!-- Proposed Lines Breakdown -->
      <div class="space-y-3">
        <h4 class="text-xs font-black uppercase text-slate-400">Estimate Line Items</h4>
        <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between font-bold text-slate-900 dark:text-white">
            <span>Front &amp; Rear Brake Pad Replacement</span>
            <span>$485.00</span>
          </div>
          <p class="text-slate-500">Pads worn to 2mm. Rotor resurfacing included.</p>
          <div class="flex items-center gap-2 pt-1">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Urgent Finding</span>
          </div>
        </div>
        <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between font-bold text-slate-900 dark:text-white">
            <span>Brake Fluid Flush</span>
            <span>$145.00</span>
          </div>
          <p class="text-slate-500">Moisture content exceeds 4% threshold.</p>
          <div class="flex items-center gap-2 pt-1">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Recommended</span>
          </div>
        </div>
      </div>

      <!-- Total & Action Toolbar -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
        <div class="flex justify-between font-black text-sm text-slate-900 dark:text-white">
          <span>Total Estimate Amount:</span>
          <span class="text-emerald-600 dark:text-emerald-400">$630.00</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <button onclick="showToast('Resending Estimate link via SMS &amp; Email...','info')" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">
            Resend Estimate (SMS)
          </button>
          <button onclick="showToast('Initiating phone call to customer...','info')" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            Call Customer
          </button>
        </div>
        <div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button onclick="svcRecordDecision('${esc(roId)}', 'customer_declined')" class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition">
            Record Decline
          </button>
          <button onclick="svcRecordDecision('${esc(roId)}', 'customer_approved')" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md">
            Record Approval
          </button>
        </div>
      </div>
    </div>
  `;
};

window.svcRecordDecision = async function(roId, status) {
  try {
    await apiSendJson(`/service-engine/ros/${roId}/status`, 'POST', { status, reason: `Recorded customer ${status}` });
    showToast(`Recorded customer decision: ${status}`, 'success');
    document.getElementById('svc-estimate-drawer')?.remove();
    ENGINE_DATA['service-overview'] = undefined;
    engineTab('service-overview', 'overview', true);
  } catch (e) {
    showToast(e.message || 'Failed to update authorization', 'error');
  }
};

// ── 5. DIGITAL VEHICLE INSPECTION (DVI) MODAL ────────────────────────────────
window.svcOpenDviModal = function(roId) {
  let modal = document.getElementById('svc-dvi-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-dvi-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Digital Vehicle Inspection (DVI)</h3>
          <p class="text-xs text-slate-400">Concern / Cause / Correction &amp; Multi-Point Inspection Findings</p>
        </div>
        <button onclick="document.getElementById('svc-dvi-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">✕</button>
      </div>

      <!-- Concern / Cause / Correction Form -->
      <div class="space-y-3 text-xs font-bold">
        <div>
          <label class="block text-slate-500 uppercase text-[11px] mb-1">Customer Concern / Complaint</label>
          <input type="text" value="Customer reports squeaking noise when braking at low speed" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
        </div>
        <div>
          <label class="block text-slate-500 uppercase text-[11px] mb-1">Technician Cause Finding</label>
          <input type="text" value="Front brake pads worn down to 2mm wear indicator clips contact rotor" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
        </div>
        <div>
          <label class="block text-slate-500 uppercase text-[11px] mb-1">Recommended Correction</label>
          <input type="text" value="Replace front brake pads and resurface rotors" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
        </div>
      </div>

      <!-- Inspection Items (Red / Yellow / Green) -->
      <div class="space-y-2">
        <h4 class="text-xs font-black uppercase text-slate-400">Multi-Point Inspection Checklist</h4>
        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20">
            <span class="font-bold text-rose-900 dark:text-rose-200">Front Brake Pads (2mm)</span>
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-600 text-white">RED - URGENT</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
            <span class="font-bold text-amber-900 dark:text-amber-200">Brake Fluid Moisture (4%)</span>
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-600 text-white">YELLOW - RECOMMENDED</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
            <span class="font-bold text-emerald-900 dark:text-emerald-200">Tire Tread Depth (7/32") &amp; Pressure</span>
            <span class="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-600 text-white">GREEN - OK</span>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onclick="document.getElementById('svc-dvi-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
        <button onclick="showToast('Converted DVI findings into estimate lines!','success'); document.getElementById('svc-dvi-modal')?.remove();" class="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition shadow-md">
          Convert Findings to Estimate Lines
        </button>
      </div>
    </div>
  `;
};

// ── 6. DECLINED WORK FOLLOW-UP MODAL ─────────────────────────────────────────
window.svcOpenDeclinedWorkModal = function() {
  let modal = document.getElementById('svc-declined-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-declined-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Declined Work &amp; Future Revenue Tracker</h3>
          <p class="text-xs text-slate-400">Re-engage customers with previously declined maintenance recommendations.</p>
        </div>
        <button onclick="document.getElementById('svc-declined-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">✕</button>
      </div>

      <div class="space-y-3">
        <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div class="font-bold text-slate-900 dark:text-white">John Doe · 2021 Ford F-150</div>
            <div class="text-slate-400">Declined: Transmission Fluid Flush ($285.00) · 30 days ago</div>
          </div>
          <button onclick="showToast('Scheduled follow-up reminder SMS for John Doe','success')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition">
            Schedule SMS Reminder
          </button>
        </div>
        <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div>
            <div class="font-bold text-slate-900 dark:text-white">Sarah Smith · 2020 Honda CR-V</div>
            <div class="text-slate-400">Declined: Cabin Air Filter &amp; Spark Plugs ($215.00) · 45 days ago</div>
          </div>
          <button onclick="showToast('Scheduled follow-up reminder SMS for Sarah Smith','success')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition">
            Schedule SMS Reminder
          </button>
        </div>
      </div>

      <div class="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onclick="document.getElementById('svc-declined-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">Close</button>
      </div>
    </div>
  `;
};

// ── 7. ADVISOR & TECHNICIAN PERFORMANCE LAYER ────────────────────────────────
window.svcRenderPerformanceLayer = function(d) {
  const metrics = [
    { label: 'Effective Labour Rate (ELR)', val: '$148.50/hr', status: 'Optimal' },
    { label: 'Hours per RO', val: '2.85 hrs', status: '+0.3 vs Target' },
    { label: 'Parts to Labour Ratio', val: '0.85', status: 'Balanced' },
    { label: 'Estimate Approval Rate', val: '74%', status: 'High' },
    { label: 'Tech Productivity', val: '112%', status: 'Exceeding' },
    { label: 'Comeback Rate', val: '0.8%', status: 'Low Risk' },
  ];

  return `
    <div class="mt-4">
      ${engCard('Service Advisor & Technician Performance Metrics', `
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          ${metrics.map(m => `
            <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
              <div class="text-[11px] text-slate-400 font-semibold truncate">${esc(m.label)}</div>
              <div class="text-sm font-black text-slate-900 dark:text-white mt-1">${esc(m.val)}</div>
              <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">${esc(m.status)}</div>
            </div>
          `).join('')}
        </div>
      `)}
    </div>
  `;
};
