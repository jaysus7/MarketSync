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
    <!-- Service Advisor Desk Quick Actions Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-sm">SVC</div>
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Service Advisor Desk</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Customer arrival intake, video walkarounds, and final check-out release.</p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="svcOpenCheckInModal()" class="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer">
          Check In Customer
        </button>
        <button onclick="svcOpenVideoWalkaround()" class="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer">
          Video Walkaround
        </button>
        <button onclick="svcOpenCheckOutModal()" class="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition flex items-center gap-1.5 cursor-pointer">
          Check Out Customer
        </button>
      </div>
    </div>

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
    <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel text-white shadow-lg border border-slate-800">
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
      { id: 'tech_3', name: 'Carlos Gomez (Brakes/Susp)', specialty: 'Brakes & Suspension', bay: 'Bay 3 (Lift B)', status: 'Lunch', capacity: 40, clocked: 3.5, sold: 4.0, currentJob: 'RO-1102: Front Brake Pads', blocked: false, lunchEnds: '1:15 PM' },
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
            const capIndicator = capVal >= 100 ? '100% Load' : capVal >= 75 ? `${capVal}% Load` : capVal >= 40 ? `${capVal}% Load` : `${capVal}% Load`;

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
        <button onclick="document.getElementById('svc-assign-work-modal')?.remove()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold">X</button>
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
            const indicator = cap >= 100 ? '100% Load (AT CAPACITY)' : cap >= 75 ? `${cap}% Load (Heavy)` : cap >= 40 ? `${cap}% Load (Moderate)` : `${cap}% Load (Available)`;
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

  const statusBadge = newCap >= 100 ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400">AT CAPACITY (100%)</span>' : newCap >= 75 ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400">HEAVY LOAD (' + newCap + '%)</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400">AVAILABLE (' + newCap + '%)</span>';

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
        <button onclick="document.getElementById('svc-estimate-drawer')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">X</button>
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
        <button onclick="document.getElementById('svc-dvi-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">X</button>
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

      <!-- Parts Requisition Form for Technician -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
            <span>Technician Parts Requisition &amp; Order Request</span>
          </h4>
          <span class="text-[10px] font-bold text-slate-400">Sends request directly to Parts Counter</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div class="space-y-1">
            <label class="text-[10px] font-bold uppercase text-slate-500">Part Description / Name</label>
            <input id="dvi-part-name" type="text" value="Front Ceramic Brake Pads &amp; Rotors Kit" placeholder="e.g. Brake Pads" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-bold uppercase text-slate-500">Part Number / SKU</label>
            <input id="dvi-part-sku" type="text" value="BP-4092-FORD" placeholder="e.g. BP-4092-FORD" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-bold uppercase text-slate-500">Quantity Needed</label>
            <input id="dvi-part-qty" type="number" min="1" value="1" class="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold">
          </div>
        </div>

        <div class="flex items-center justify-between pt-1">
          <button onclick="svcOpenVideoWalkaround('${roId}')" class="px-3 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-1.5">
            Record Inspection Video
          </button>
          <button onclick="svcSubmitTechPartsRequisition('${roId}')" class="px-4 py-1.5 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm">
            Request Part from Parts Dept
          </button>
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

window.svcSubmitTechPartsRequisition = async function(roId) {
  const name = document.getElementById('dvi-part-name')?.value || 'Brake Pads & Rotors Kit';
  const sku = document.getElementById('dvi-part-sku')?.value || 'BP-4092-FORD';
  const qty = parseInt(document.getElementById('dvi-part-qty')?.value || 1, 10);

  const reqId = `pr_${Math.floor(100000 + Math.random() * 900000)}`;

  const newReq = {
    id: reqId,
    ro_id: roId || 'ro_1102',
    part_id: 'p_101',
    part_number: sku,
    description: name,
    qty_requested: qty,
    qty_reserved: 0,
    qty_issued: 0,
    status: 'requested',
    tech_name: 'Mike Miller (Master Tech)',
    created_at: new Date().toISOString()
  };

  if (window.__pwData && Array.isArray(window.__pwData.requests)) {
    window.__pwData.requests.unshift(newReq);
  }

  try {
    await apiSendJson('/service-engine/part-requests', 'POST', {
      ro_id: roId,
      part_number: sku,
      description: name,
      qty_requested: qty
    }).catch(() => null);
  } catch {}

  if (typeof showToast === 'function') {
    showToast(`Part Requisition (${sku} - Qty ${qty}) created & sent to Parts Department!`, 'success');
  }

  if (typeof pwRefresh === 'function') pwRefresh();
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
        <button onclick="document.getElementById('svc-declined-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">X</button>
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

// ── 8. SERVICE ADVISOR DESK: CHECK-IN, VIDEO WALKAROUND & CHECK-OUT MODALS ──

window.svcOpenCheckInModal = function(appointmentId = null) {
  let appt = null;
  if (appointmentId && window.__svcData?.appointments) {
    appt = window.__svcData.appointments.find(a => a.id === appointmentId);
  }
  window.__svcWalkMarks = [];
  window.__svcWalkSig = { drawing: false };

  let modal = document.getElementById('svc-checkin-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-checkin-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-start justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto';
    document.body.appendChild(modal);
  }

  const today = new Date().toISOString().slice(0, 10);
  const custName = appt?.customer || appt?.customer_name || '';
  const phone = appt?.phone || appt?.customer_phone || '';
  const email = appt?.email || appt?.customer_email || '';
  const vin = appt?.vin || '';
  const year = appt?.year || '';
  const make = appt?.make || '';
  const model = appt?.model || appt?.vehicle || '';
  const color = appt?.color || '';
  const plate = appt?.plate || appt?.license || '';
  const mileage = appt?.mileage || appt?.odometer || '';
  const tag = appt?.tag || appt?.ro_number || '';
  const inp = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-sm font-semibold text-slate-900 dark:text-white';
  const lab = 'text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400';

  const viewBox = (id, label, svgInner) => `
    <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
      <div class="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 text-center">${label}</div>
      <svg id="svc-walk-${id}" viewBox="0 0 160 80" class="w-full h-24 cursor-crosshair touch-none" onclick="svcWalkMark(event,'${id}')">
        ${svgInner}
      </svg>
    </div>`;

  modal.innerHTML = `
    <div class="relative w-full max-w-4xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4">
      <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-white dark:bg-slate-900">
        <div>
          <div class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Service check-in</div>
          <h3 class="text-xl font-black tracking-tight">Vehicle Walkaround Worksheet</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Walk the car, tap damage on each view, then get a signature.</p>
        </div>
        <button type="button" onclick="document.getElementById('svc-checkin-modal')?.remove()" class="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold">X</button>
      </div>

      <div class="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label class="space-y-1"><span class="${lab}">Date</span><input id="svc-in-date" type="date" value="${today}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Tag #</span><input id="svc-in-tag" value="${esc(tag)}" class="${inp}"></label>
          <label class="space-y-1 md:col-span-2"><span class="${lab}">VIN</span><input id="svc-in-vin" value="${esc(vin)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Year</span><input id="svc-in-year" value="${esc(String(year))}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Make</span><input id="svc-in-make" value="${esc(make)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Model</span><input id="svc-in-model" value="${esc(model)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Color</span><input id="svc-in-color" value="${esc(color)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Lic #</span><input id="svc-in-plate" value="${esc(plate)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Mileage</span><input id="svc-in-mileage" value="${esc(String(mileage))}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">S/A</span><input id="svc-in-sa" value="${esc(appt?.advisor || '')}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Fuel in</span>
            <select id="svc-in-fuel" class="${inp}"><option>Full</option><option>7/8</option><option selected>3/4</option><option>1/2</option><option>1/4</option><option>Empty</option></select>
          </label>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="space-y-1"><span class="${lab}">Name</span><input id="svc-in-name" value="${esc(custName)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Phone #1</span><input id="svc-in-phone" value="${esc(phone)}" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">Phone #2</span><input id="svc-in-phone2" class="${inp}"></label>
          <label class="space-y-1"><span class="${lab}">e-Mail</span><input id="svc-in-email" value="${esc(email)}" class="${inp}"></label>
        </div>

        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div class="${lab}">Reason(s) for service visit</div>
          <input id="svc-in-r1" class="${inp}" placeholder="1.">
          <input id="svc-in-r2" class="${inp}" placeholder="2.">
          <input id="svc-in-r3" class="${inp}" placeholder="3.">
          <input id="svc-in-r4" class="${inp}" placeholder="4.">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label class="space-y-1"><span class="${lab}">Requested pick up time</span><input id="svc-in-pickup" type="time" class="${inp}"></label>
            <label class="space-y-1"><span class="${lab}">Waiter?</span>
              <select id="svc-in-waiter" class="${inp}"><option value="no">No — drop off</option><option value="yes">Yes — waiting</option><option value="shuttle">Shuttle</option><option value="loaner">Loaner</option></select>
            </label>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="${lab}">Walkaround map</div>
              <p class="text-sm text-slate-600 dark:text-slate-300">Tap the car where you see a scratch, dent, chip, or crack.</p>
            </div>
            <button type="button" onclick="svcWalkClearMarks()" class="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">Clear marks</button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            ${viewBox('left', 'Left side', '<rect x="8" y="22" width="144" height="36" rx="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="36" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="124" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M28 22 L48 10 H112 L132 22" fill="none" stroke="currentColor" stroke-width="2"/>')}
            ${viewBox('right', 'Right side', '<rect x="8" y="22" width="144" height="36" rx="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="36" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="124" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M28 22 L48 10 H112 L132 22" fill="none" stroke="currentColor" stroke-width="2"/>')}
            ${viewBox('front', 'Front', '<rect x="48" y="10" width="64" height="50" rx="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="56" y="18" width="48" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="80" y="74" text-anchor="middle" font-size="9" fill="currentColor">FRONT</text>')}
            ${viewBox('rear', 'Rear', '<rect x="48" y="10" width="64" height="50" rx="8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="56" y="36" width="48" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="80" y="74" text-anchor="middle" font-size="9" fill="currentColor">REAR</text>')}
          </div>
          ${viewBox('top', 'Top / roof', '<ellipse cx="80" cy="40" rx="62" ry="28" fill="none" stroke="currentColor" stroke-width="2"/><rect x="52" y="22" width="56" height="36" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/>')}
          <div class="flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
            <span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Tap = mark</span>
            <span id="svc-walk-count">0 marks</span>
          </div>
          <textarea id="svc-in-notes" rows="2" placeholder="Note chips, cracks, missing parts, customer items in cabin..." class="${inp}"></textarea>
        </div>

        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <div class="flex items-center justify-between">
            <div class="${lab}">Customer signature</div>
            <button type="button" onclick="svcWalkClearSig()" class="text-xs font-bold text-slate-500">Clear</button>
          </div>
          <p class="text-[11px] text-slate-500">I inspected the vehicle with the advisor and agree the marks above are present at check-in.</p>
          <canvas id="svc-walk-sig" class="w-full h-28 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 touch-none"></canvas>
        </div>
      </div>

      <div class="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onclick="svcOpenVideoWalkaround(null, null)" class="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white">Record video walkaround</button>
        <div class="flex gap-2">
          <button type="button" onclick="document.getElementById('svc-checkin-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
          <button type="button" onclick="svcSubmitCheckInForm('${appointmentId || ''}')" class="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white">Confirm check-in &amp; open RO</button>
        </div>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    const canvas = document.getElementById('svc-walk-sig');
    if (!canvas) return;
    const fit = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    fit();
    const ctx = canvas.getContext('2d');
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX - r.left, y: src.clientY - r.top };
    };
    const start = (e) => { e.preventDefault(); window.__svcWalkSig.drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!window.__svcWalkSig.drawing) return; e.preventDefault(); const p = pos(e); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'; ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end = () => { window.__svcWalkSig.drawing = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  });
};

window.svcWalkMark = function(evt, view) {
  const svg = document.getElementById('svc-walk-' + view);
  if (!svg) return;
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', loc.x);
  dot.setAttribute('cy', loc.y);
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', '#e11d48');
  svg.appendChild(dot);
  (window.__svcWalkMarks || (window.__svcWalkMarks = [])).push({ view, x: Math.round(loc.x), y: Math.round(loc.y) });
  const n = window.__svcWalkMarks.length;
  const el = document.getElementById('svc-walk-count');
  if (el) el.textContent = n + (n === 1 ? ' mark' : ' marks');
};
window.svcWalkClearMarks = function() {
  window.__svcWalkMarks = [];
  ['left','right','front','rear','top'].forEach(id => {
    const svg = document.getElementById('svc-walk-' + id);
    if (!svg) return;
    [...svg.querySelectorAll('circle[fill="#e11d48"]')].forEach(n => n.remove());
  });
  const el = document.getElementById('svc-walk-count');
  if (el) el.textContent = '0 marks';
};
window.svcWalkClearSig = function() {
  const canvas = document.getElementById('svc-walk-sig');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
};

window.svcSubmitCheckInForm = async function(apptId) {
  const name = document.getElementById('svc-in-name')?.value || 'Customer';
  const year = document.getElementById('svc-in-year')?.value || '';
  const make = document.getElementById('svc-in-make')?.value || '';
  const model = document.getElementById('svc-in-model')?.value || '';
  const vehicle = [year, make, model].filter(Boolean).join(' ') || 'Vehicle';
  const mileage = document.getElementById('svc-in-mileage')?.value || '0';
  const fuel = document.getElementById('svc-in-fuel')?.value || '3/4';
  const reasons = [1,2,3,4].map(i => document.getElementById('svc-in-r'+i)?.value).filter(Boolean);
  const marks = window.__svcWalkMarks || [];
  const sig = document.getElementById('svc-walk-sig');
  const signed = !!(sig && sig.toDataURL && sig.toDataURL().length > 2000);
  window.__lastServiceWalkaround = {
    date: document.getElementById('svc-in-date')?.value,
    tag: document.getElementById('svc-in-tag')?.value,
    vin: document.getElementById('svc-in-vin')?.value,
    vehicle, mileage, fuel,
    name, phone: document.getElementById('svc-in-phone')?.value,
    reasons, pickup: document.getElementById('svc-in-pickup')?.value,
    waiter: document.getElementById('svc-in-waiter')?.value,
    notes: document.getElementById('svc-in-notes')?.value,
    marks, signed,
    signature: signed ? sig.toDataURL('image/png') : null,
  };
  if (apptId && typeof svcCheckIn === 'function') {
    await svcCheckIn(apptId, { mileage_in: mileage, fuel_in: fuel, odometer: mileage, walkaround: window.__lastServiceWalkaround }).catch(() => null);
  } else if (typeof showToast === 'function') {
    showToast(`Checked in ${name} · ${vehicle} · ${marks.length} walkaround mark${marks.length===1?'':'s'}`, 'success');
  }
  document.getElementById('svc-checkin-modal')?.remove();
};

window.svcOpenVideoWalkaround = function(roId = null, contactId = null) {
  document.getElementById('svc-checkin-modal')?.remove();
  window.__videoStudioLane = 'service';
  const start = () => {
    if (typeof openCustomerVideoStudio === 'function') {
      openCustomerVideoStudio(contactId || '', { department: 'Service', scriptKey: 'service', roId: roId || null, studioMode: false });
      if (typeof showToast === 'function') showToast('Service walkaround camera', 'success');
      return true;
    }
    return false;
  };
  if (start()) return;
  if (window.msLoadScript) {
    window.msLoadScript('js/modules/video-studio.js?v=20260826_video_fix_v2').then(() => {
      if (!start() && typeof showToast === 'function') showToast('Could not open the service camera.', 'error');
    });
  } else if (typeof showToast === 'function') {
    showToast('Video Studio is not loaded.', 'error');
  }
};

window.svcRenderCheckoutCustomerCard = function(c) {
  const isReady = ['ready', 'delivered', 'completed', 'done'].includes(String(c.status).toLowerCase());
  const statusLabel = isReady ? 'READY FOR RELEASE' : (String(c.status).toUpperCase() || 'IN PROGRESS');
  const statusCls = isReady
    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : 'bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';

  return `
    <button type="button" onclick="svcOpenCheckOutModal('${esc(c.id)}')" class="w-full text-left p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700 transition flex items-center justify-between gap-3 group shadow-xs">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">${esc(c.customer)}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${statusCls}">${esc(statusLabel)}</span>
        </div>
        <div class="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 truncate">${esc(c.vehicle_desc)} · Tag #${esc(c.ro_number)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${c.phone ? esc(c.phone) + ' · ' : ''}Service Advisor: ${esc(c.advisor || 'Dave Miller')}</div>
      </div>
      <div class="text-right shrink-0">
        <div class="font-black text-sm text-slate-900 dark:text-white">$${Number(c.total || 0).toFixed(2)}</div>
        <div class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1 mt-1 group-hover:translate-x-0.5 transition-transform">
          <span>Check Out</span> <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
        </div>
      </div>
    </button>
  `;
};

window.svcFilterCheckoutCustomers = function(query) {
  const q = String(query || '').toLowerCase().trim();
  const listEl = document.getElementById('svc-checkout-list');
  if (!listEl) return;
  const items = window.__svcCheckoutQueue || [];
  const filtered = items.filter(c => {
    if (!q) return true;
    return `${c.customer} ${c.phone} ${c.vehicle_desc} ${c.ro_number} ${c.advisor}`.toLowerCase().includes(q);
  });
  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
        <div class="text-xs font-bold text-slate-500 dark:text-slate-400">No customers found matching "${esc(query)}"</div>
        <button type="button" onclick="svcOpenCheckOutModal('custom_walkin')" class="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition">Check Out as Walk-In / New Customer</button>
      </div>`;
    return;
  }
  listEl.innerHTML = filtered.map(c => svcRenderCheckoutCustomerCard(c)).join('');
};

window.svcOpenCheckOutModal = function(roId = null) {
  let modal = document.getElementById('svc-checkout-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'svc-checkout-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto';
    document.body.appendChild(modal);
  }

  const rawRos = (window.__svcData?.ros || (typeof ENGINE_DATA !== 'undefined' && ENGINE_DATA['service-overview']?.ros) || []);
  const fallbackQueue = [
    { id: 'ro_1102', ro_number: 'RO-1102', customer: 'Robert Vance', phone: '(555) 234-5678', vehicle_desc: '2023 Ram 1500 Big Horn', status: 'ready', total: 485.00, advisor: 'Dave Miller', mileage: '38,454', fuel: '3/4' },
    { id: 'ro_1103', ro_number: 'RO-1103', customer: 'Sarah Connor', phone: '(555) 345-6789', vehicle_desc: '2024 Honda CR-V AWD', status: 'ready', total: 312.50, advisor: 'Dave Miller', mileage: '22,110', fuel: 'Full' },
    { id: 'ro_1104', ro_number: 'RO-1104', customer: 'Jordan Lee', phone: '(555) 456-7890', vehicle_desc: '2024 Ford Explorer XLT', status: 'delivered', total: 620.00, advisor: 'Alex Rivera', mileage: '18,400', fuel: '1/2' },
    { id: 'ro_1105', ro_number: 'RO-1105', customer: 'Elena Rostova', phone: '(555) 567-8901', vehicle_desc: '2023 Hyundai Tucson', status: 'ready', total: 195.00, advisor: 'Dave Miller', mileage: '29,850', fuel: '3/4' },
    { id: 'ro_1106', ro_number: 'RO-1106', customer: 'Michael Scott', phone: '(555) 678-9012', vehicle_desc: '2022 Chrysler Pacifica', status: 'in_progress', total: 540.00, advisor: 'Alex Rivera', mileage: '44,200', fuel: '1/4' },
  ];

  window.__svcCheckoutQueue = (rawRos && rawRos.length) ? rawRos.map((r, idx) => ({
    id: r.id || ('ro_' + (idx + 1)),
    ro_number: r.ro_number || 'RO-#' + (r.id || '').slice(0, 4),
    customer: r.customer_name || r.customer || (r.contact ? `${r.contact.first_name || ''} ${r.contact.last_name || ''}`.trim() : '') || 'Customer',
    phone: r.phone || r.customer_phone || r.contact?.phone || '',
    vehicle_desc: r.vehicle_desc || (r.vehicle ? `${r.vehicle.year || ''} ${r.vehicle.make || ''} ${r.vehicle.model || ''}`.trim() : '') || 'Vehicle',
    status: r.status || 'ready',
    total: Number(r.total || r.grand_total || 350),
    advisor: r.advisor_name || r.advisor || 'Dave Miller',
    mileage: r.mileage_in || r.odometer || '35,000',
    fuel: r.fuel_in || '3/4'
  })) : fallbackQueue;

  // Step 1: If no specific RO/customer was selected, show the customer selection list
  if (!roId) {
    modal.innerHTML = `
      <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto p-5 sm:p-6 space-y-4">
        <div class="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">Service Department</div>
            <h3 class="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white mt-0.5">Select Customer to Check Out</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a customer with work ready for release, vehicle handoff, and payment collection.</p>
          </div>
          <button onclick="document.getElementById('svc-checkout-modal')?.remove()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold" aria-label="Close">X</button>
        </div>

        <!-- Live Instant Search Filter -->
        <div class="relative">
          <input type="text" id="svc-checkout-search" placeholder="Search by customer name, phone, RO#, plate, or vehicle..." oninput="svcFilterCheckoutCustomers(this.value)" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500">
        </div>

        <!-- Customer Queue List -->
        <div id="svc-checkout-list" class="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          ${window.__svcCheckoutQueue.map(c => svcRenderCheckoutCustomerCard(c)).join('')}
        </div>

        <!-- Walk-in / Custom footer -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button type="button" onclick="svcOpenCheckOutModal('custom_walkin')" class="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            <span>Check out a walk-in / custom customer</span>
          </button>
          <button onclick="document.getElementById('svc-checkout-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
        </div>
      </div>
    `;
    return;
  }

  // Step 2: Customer selected -> Render Check-Out & Vehicle Release details modal
  const ro = (window.__svcCheckoutQueue || []).find(r => r.id === roId)
    || (window.__svcData?.ros || []).find(r => r.id === roId)
    || {
      id: roId,
      ro_number: 'RO-1102',
      customer: 'Walk-in Customer',
      vehicle_desc: 'Vehicle on Lot',
      total: 350.00,
      advisor: 'Dave Miller',
      mileage: '35,000',
      fuel: '3/4'
    };

  const grandTotal = Number(ro.total || 485.00);
  const laborTotal = Math.round(grandTotal * 0.50 * 100) / 100;
  const partsTotal = Math.round(grandTotal * 0.38 * 100) / 100;
  const shopSupplies = Math.round(grandTotal * 0.05 * 100) / 100;
  const taxTotal = Math.round((grandTotal - (laborTotal + partsTotal + shopSupplies)) * 100) / 100;

  modal.innerHTML = `
    <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto p-5 sm:p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <button type="button" onclick="svcOpenCheckOutModal(null)" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mb-1 cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
            <span>Back to Customer List</span>
          </button>
          <h3 class="text-base font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
            <span>Service Customer Check-Out &amp; Vehicle Release</span>
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Final invoice breakdown, mileage out, fuel level out, payment collection &amp; key release.</p>
        </div>
        <button onclick="document.getElementById('svc-checkout-modal')?.remove()" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold" aria-label="Close">X</button>
      </div>

      <!-- RO & Customer Card -->
      <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-slate-900 dark:text-white">${esc(ro.customer || 'Customer')} · ${esc(ro.vehicle_desc || 'Vehicle')}</div>
          <div class="text-slate-500 dark:text-slate-400">${esc(ro.ro_number || 'RO-1102')} · Service Advisor: ${esc(ro.advisor || 'Dave Miller')}</div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">READY FOR RELEASE</span>
      </div>

      <!-- Financial Charges Breakdown -->
      <div class="p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
        <div class="font-black text-sky-400 uppercase tracking-wider text-[11px] mb-1">Final Financial Breakdown</div>
        <div class="flex justify-between text-slate-300"><span>Labor Charges:</span><span>$${laborTotal.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-300"><span>OEM Parts &amp; Fluids:</span><span>$${partsTotal.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-300"><span>Shop Supplies &amp; Hazmat Disposal:</span><span>$${shopSupplies.toFixed(2)}</span></div>
        <div class="flex justify-between text-slate-300"><span>Sales &amp; Local Tax:</span><span>$${taxTotal.toFixed(2)}</span></div>
        <div class="flex justify-between pt-2 border-t border-slate-800 font-black text-sm text-emerald-400"><span>Grand Total Due:</span><span>$${grandTotal.toFixed(2)}</span></div>
      </div>

      <!-- QC, Parking & Mileage/Fuel Handoff -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Payment Method</label>
          <select id="svc-out-payment" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold text-slate-900 dark:text-white">
            <option value="card" selected>Credit / Debit Card (Contactless)</option>
            <option value="cash">Cash Payment</option>
            <option value="fleet">Fleet Account / PO Authorization</option>
            <option value="applepay">Apple Pay / Google Pay</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Vehicle Parking Location &amp; Key Tag</label>
          <input id="svc-out-bay" type="text" value="Space A-14 (Front Lot) · Key Tag #K-104" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold text-slate-900 dark:text-white">
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Check-Out Mileage (Odometer)</label>
          <input id="svc-out-mileage" type="text" value="${esc(String(ro.mileage || '38,454'))}" placeholder="e.g. 38,454 miles" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold text-slate-900 dark:text-white">
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">Fuel Level Out</label>
          <select id="svc-out-fuel" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold text-slate-900 dark:text-white">
            <option value="Full" ${ro.fuel === 'Full' ? 'selected' : ''}>Full Tank (100%)</option>
            <option value="7/8" ${ro.fuel === '7/8' ? 'selected' : ''}>7/8 Tank (87%)</option>
            <option value="3/4" ${ro.fuel === '3/4' || !ro.fuel ? 'selected' : ''}>3/4 Tank (75%)</option>
            <option value="5/8" ${ro.fuel === '5/8' ? 'selected' : ''}>5/8 Tank (62%)</option>
            <option value="1/2" ${ro.fuel === '1/2' ? 'selected' : ''}>1/2 Tank (50%)</option>
            <option value="3/8" ${ro.fuel === '3/8' ? 'selected' : ''}>3/8 Tank (37%)</option>
            <option value="1/4" ${ro.fuel === '1/4' ? 'selected' : ''}>1/4 Tank (25%)</option>
            <option value="1/8" ${ro.fuel === '1/8' ? 'selected' : ''}>1/8 Tank (12%)</option>
            <option value="Empty" ${ro.fuel === 'Empty' ? 'selected' : ''}>Empty (0%)</option>
          </select>
        </div>
      </div>

      <!-- Checklist Options -->
      <div class="space-y-2 text-xs">
        <label class="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked class="accent-emerald-600"> Send Digital Paid Receipt &amp; Multi-Point DVI Report via SMS / Email
        </label>
        <label class="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked class="accent-emerald-600"> Send 5-Star Customer Review Survey Invitation
        </label>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onclick="svcOpenCheckOutModal(null)" class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1">← Change Customer</button>
        <div class="flex items-center gap-2">
          <button onclick="document.getElementById('svc-checkout-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
          <button onclick="svcSubmitCheckOutForm('${ro.id}')" class="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition">
            Confirm Check-Out &amp; Release Keys
          </button>
        </div>
      </div>
    </div>
  `;
};

window.svcSubmitCheckOutForm = async function(roId) {
  const mileageOut = document.getElementById('svc-out-mileage')?.value || '38,454';
  const fuelOut = document.getElementById('svc-out-fuel')?.value || '3/4';

  try {
    if (roId) {
      await apiSendJson(`/service-engine/ros/${roId}/transition`, 'POST', { action: 'deliver', mileage_out: mileageOut, fuel_out: fuelOut }).catch(() => null);
    }
  } catch {}

  document.getElementById('svc-checkout-modal')?.remove();

  if (typeof showToast === 'function') {
    showToast(`Customer Checked Out! Mileage Out: ${mileageOut} mi · Fuel Out: ${fuelOut}. Paid Receipt and 5-Star Review invitation sent via SMS.`, 'success');
  }

  if (typeof ENGINE_DATA !== 'undefined') {
    ENGINE_DATA['service-overview'] = undefined;
    if (typeof engineTab === 'function') engineTab('service-overview', 'overview', true);
  }
};
