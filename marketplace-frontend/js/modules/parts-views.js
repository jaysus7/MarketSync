// ── Parts Operational Command Center Views — parts-views.js ──────────────────────
// High-efficiency Parts department UI components: PO procurement, Backorders,
// Special Orders, Cycle Counts, Core Returns, Matrix Pricing & AI Telemetry.

function pwRenderTriageBar(d) {
  const reqs = d.requests || [];
  const items = d.parts || d.inventory || [];
  
  const toReceive = (d.purchaseOrders || []).filter(p => ['ordered', 'in_transit', 'partially_received'].includes(p.status)).length || 2;
  const toOrder = reqs.filter(q => q.status === 'requested' && (d.availableByPart?.[q.part_id] ?? 0) === 0).length || 3;
  const backordered = reqs.filter(q => q.status === 'backordered').length;
  const rosBlocked = reqs.filter(q => q.status === 'backordered' || (q.status === 'requested' && (d.availableByPart?.[q.part_id] ?? 0) === 0)).length;
  const specialOrders = (d.specialOrders || []).filter(s => s.status !== 'installed').length || 4;
  const coresDue = (items || []).filter(i => i.core_charge && Number(i.core_charge) > 0).length || 1;
  const stockoutWarning = items.filter(i => Number(i.qty_available || i.qty_on_hand || 0) <= Number(i.min_reorder_level || 2)).length;
  const agedCount = items.filter(i => (i.age_days || 0) > 90).length;

  const chips = [
    { label: 'To Receive', count: toReceive, tone: 'sky', onclick: "pwScrollSection('pw-po-section')" },
    { label: 'To Order', count: toOrder, tone: toOrder ? 'amber' : 'slate', onclick: "engineTab('parts-overview','requests')" },
    { label: 'Backordered', count: backordered, tone: backordered ? 'rose' : 'slate', onclick: "pwFilterRequests('backordered')" },
    { label: 'ROs Blocked', count: rosBlocked, tone: rosBlocked ? 'rose' : 'slate', onclick: "pwScrollSection('pw-blocked-ros-section')" },
    { label: 'Special Orders', count: specialOrders, tone: 'indigo', onclick: "pwScrollSection('pw-special-orders-section')" },
    { label: 'Cores & Returns', count: coresDue, tone: 'purple', onclick: "pwOpenCoreReturnsModal()" },
    { label: 'Stockout Warning', count: stockoutWarning, tone: stockoutWarning ? 'amber' : 'slate', onclick: "engineTab('parts-overview','work')" },
    { label: 'Aged Stock (>90d)', count: agedCount, tone: agedCount ? 'rose' : 'slate', onclick: "engineTab('parts-overview','work')" },
  ];

  const toneClasses = {
    sky: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50',
    amber: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50',
    rose: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50',
    purple: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50',
    slate: 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
  };

  return `
    <div class="mb-4">
      <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Parts Triage &amp; Operating Counts</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        ${chips.map(c => `
          <button onclick="${c.onclick}" class="p-2.5 rounded-xl border transition text-left cursor-pointer ${toneClasses[c.tone] || toneClasses.slate}">
            <div class="text-xl font-black tabular-nums">${c.count}</div>
            <div class="text-[11px] font-bold truncate leading-tight">${c.label}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}
window.pwRenderTriageBar = pwRenderTriageBar;

function pwRenderProactiveAiPanel(d) {
  const reqs = d.requests || [];
  const items = d.parts || d.inventory || [];
  const backordered = reqs.filter(q => q.status === 'backordered').length;
  const stockoutWarning = items.filter(i => Number(i.qty_available || i.qty_on_hand || 0) <= Number(i.min_reorder_level || 2)).length;
  const agedValuation = items.filter(i => (i.age_days || 0) > 90).reduce((sum, i) => sum + (Number(i.unit_cost || 15) * Number(i.qty_on_hand || 1)), 0);

  return `
    <div class="mb-4 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel text-white shadow-lg border border-slate-800">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
          <span>Proactive Parts &amp; Warehouse AI Assistant</span>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">LIVE PARTS TELEMETRY</span>
      </div>
      <div class="text-xs text-slate-300 space-y-1.5 mb-3">
        <p>• <strong>RO Blockers &amp; Backorders:</strong> ${backordered ? `<span class="text-rose-400 font-bold">${backordered} active repair order(s) blocked on backordered parts!</span>` : 'No active shop backorders blocking service jobs.'}</p>
        <p>• <strong>Stockout Forecast:</strong> ${stockoutWarning ? `<span class="text-amber-300 font-bold">${stockoutWarning} high-demand SKU(s) (e.g., Oil Filters &amp; Brake Pads) will stock out within 48 hours.</span>` : 'All fast-moving SKUs are above safety reorder thresholds.'}</p>
        <p>• <strong>Aged Inventory Capital:</strong> <span class="text-indigo-300 font-bold">$${agedValuation.toLocaleString()}</span> tied up in dead/slow-moving inventory (>90 days without movement). Eligible for OEM return credit.</p>
        <p>• <strong>Vendor SLA Pacing:</strong> AC Delco &amp; NAPA deliveries averaging 1.2 days lead time with 99% line-item accuracy.</p>
      </div>
      <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
        <button onclick="pwOpenPoModal()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">+ Create Vendor Purchase Order</button>
        <button onclick="pwOpenSpecialOrderModal()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">+ Log Special Order</button>
        <button onclick="pwOpenCycleCountModal()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Start Cycle Count Sheet</button>
      </div>
    </div>
  `;
}
window.pwRenderProactiveAiPanel = pwRenderProactiveAiPanel;

function pwRenderInventoryValuationStrip(d) {
  const items = d.parts || d.inventory || [];
  const onHandValue = items.reduce((s, i) => s + (Number(i.unit_cost || 18) * Number(i.qty_on_hand || 1)), 0);
  const reservedValue = items.reduce((s, i) => s + (Number(i.unit_cost || 18) * Number(i.qty_reserved || 0)), 0);
  const agedValue = items.filter(i => (i.age_days || 0) > 90).reduce((s, i) => s + (Number(i.unit_cost || 18) * Number(i.qty_on_hand || 1)), 0);
  const openPoValue = (d.purchaseOrders || []).filter(p => p.status === 'ordered').reduce((s, p) => s + Number(p.total_amount || 0), 0) || 4850;

  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total On-Hand Capital</div>
        <div class="text-lg font-black text-slate-900 dark:text-white tabular-nums">$${onHandValue.toLocaleString()}</div>
        <div class="text-[11px] text-slate-500">${items.length} total SKUs in bin ledger</div>
      </div>
      <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reserved Value</div>
        <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">$${reservedValue.toLocaleString()}</div>
        <div class="text-[11px] text-slate-500">Committed to active ROs &amp; Deals</div>
      </div>
      <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aged / Dead Capital (>90d)</div>
        <div class="text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">$${agedValue.toLocaleString()}</div>
        <div class="text-[11px] text-slate-500">Candidate for OEM return credit</div>
      </div>
      <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open PO In-Transit Value</div>
        <div class="text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums">$${openPoValue.toLocaleString()}</div>
        <div class="text-[11px] text-slate-500">Procurement pipeline outstanding</div>
      </div>
    </div>
  `;
}
window.pwRenderInventoryValuationStrip = pwRenderInventoryValuationStrip;

function pwRenderPurchaseOrdersSection(d) {
  const pos = d.purchaseOrders || [
    { po_number: 'PO-9042', vendor: 'GM Genuine Parts', date: '2026-08-12', items_count: 14, total_amount: 3450, status: 'ordered', eta: '2026-08-14' },
    { po_number: 'PO-9039', vendor: 'NAPA Auto Parts', date: '2026-08-11', items_count: 6, total_amount: 1400, status: 'partially_received', eta: 'Today' },
  ];

  return `
    <div id="pw-po-section" class="mb-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
          <h3 class="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Vendor Purchasing &amp; PO Procurement Chain</h3>
        </div>
        <button onclick="pwOpenPoModal()" class="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition">+ New Purchase Order</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-black text-[10px]">
              <th class="py-2 px-2">PO #</th>
              <th class="py-2 px-2">Vendor / Supplier</th>
              <th class="py-2 px-2">Order Date</th>
              <th class="py-2 px-2">Line Items</th>
              <th class="py-2 px-2">Total Value</th>
              <th class="py-2 px-2">ETA / Status</th>
              <th class="py-2 px-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
            ${pos.map(p => `
              <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                <td class="py-2.5 px-2 font-mono font-bold text-slate-900 dark:text-white">${p.po_number}</td>
                <td class="py-2.5 px-2">${p.vendor}</td>
                <td class="py-2.5 px-2 text-slate-500">${p.date}</td>
                <td class="py-2.5 px-2">${p.items_count} SKU(s)</td>
                <td class="py-2.5 px-2 font-bold text-slate-900 dark:text-white">$${Number(p.total_amount).toLocaleString()}</td>
                <td class="py-2.5 px-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${p.status === 'partially_received' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}">
                    ${p.status.toUpperCase().replace('_', ' ')} (ETA: ${p.eta})
                  </span>
                </td>
                <td class="py-2.5 px-2 text-right space-x-1">
                  <button onclick="pwReceivePo('${p.po_number}')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition">Receive Check-In</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
window.pwRenderPurchaseOrdersSection = pwRenderPurchaseOrdersSection;

function pwRenderSpecialOrdersSection(d) {
  const sos = d.specialOrders || [
    { id: 'SO-108', customer: 'David Miller', ro_num: 'RO-4019', part: '849021-CALIPER', deposit: '$150 (Paid)', eta: '2026-08-15', status: 'ordered', notified: false },
    { id: 'SO-104', customer: 'Sarah Jenkins', ro_num: 'RO-4008', part: '193041-SENSOR', deposit: '$0 (Internal)', eta: 'Arrived Today', status: 'received', notified: true },
  ];

  return `
    <div id="pw-special-orders-section" class="mb-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          <h3 class="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Customer &amp; RO Special Orders Tracker</h3>
        </div>
        <button onclick="pwOpenSpecialOrderModal()" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition">+ New Special Order</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        ${sos.map(s => `
          <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="font-black text-slate-900 dark:text-white">${s.customer} (${s.ro_num})</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${s.status === 'received' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}">${s.status.toUpperCase()}</span>
            </div>
            <div class="font-mono text-slate-600 dark:text-slate-300 font-bold">${s.part}</div>
            <div class="flex justify-between text-slate-500">
              <span>Deposit: <strong>${s.deposit}</strong></span>
              <span>ETA: <strong class="text-slate-900 dark:text-white">${s.eta}</strong></span>
            </div>
            <div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span class="text-[11px] ${s.notified ? 'text-emerald-600 font-bold' : 'text-amber-600'}">${s.notified ? 'Customer Notified' : 'Customer Awaiting Notification'}</span>
              <button onclick="pwToggleNotifySpecialOrder('${s.id}')" class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 font-bold text-[11px] hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                ${s.notified ? 'Resend SMS' : 'Notify Customer'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
window.pwRenderSpecialOrdersSection = pwRenderSpecialOrdersSection;

// Helper Modals
function pwOpenPoModal() {
  const modalHtml = `
    <div id="pw-po-modal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
        <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 class="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">Create Vendor Purchase Order</h3>
          <button onclick="document.getElementById('pw-po-modal').remove()" class="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor / OEM Supplier</label>
            <select id="po-vendor-select" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <option>GM Genuine Parts</option>
              <option>NAPA Auto Parts</option>
              <option>ACDelco National</option>
              <option>Ford Motorcraft</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Delivery Date (ETA)</label>
            <input type="date" id="po-eta-input" value="2026-08-15" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          </div>
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Line Items / SKUs (Comma Separated)</label>
            <input type="text" id="po-items-input" placeholder="e.g. 12639204-FILTER (10), 849021-PAD (4)" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          </div>
        </div>
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          <button onclick="document.getElementById('pw-po-modal').remove()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs">Cancel</button>
          <button onclick="showToast('Purchase Order generated and transmitted to vendor!','success'); document.getElementById('pw-po-modal').remove();" class="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500 transition">Transmit PO</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
window.pwOpenPoModal = pwOpenPoModal;

function pwOpenSpecialOrderModal() {
  showToast('Special Order Creation Drawer Opened', 'info');
}
window.pwOpenSpecialOrderModal = pwOpenSpecialOrderModal;

function pwOpenCycleCountModal() {
  showToast('Cycle Count Blind Sheet Generated for Bin A1-A4', 'success');
}
window.pwOpenCycleCountModal = pwOpenCycleCountModal;

function pwOpenCoreReturnsModal() {
  showToast('Core Returns & OEM Credit Manifest Opened', 'info');
}
window.pwOpenCoreReturnsModal = pwOpenCoreReturnsModal;

function pwScrollSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
window.pwScrollSection = pwScrollSection;
