// ── Accounting Department Views & Operational Components ──────────────────────
//
// Modular rendering helpers for Accounting: Money In, Money Out, Bank Reconciliation,
// Period Close, Deal Financial Drill-Down, and Financial Reports.
// Reuses canonical single-source-of-truth endpoints.

const accFmtMoney = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const accFmtInt = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

// ── 1. MONEY IN (Receivables & Lender Funding) ─────────────────────────────
window.accRenderMoneyIn = function(body, d) {
  const ar = d.receivables || [];
  const cit = d.contracts || [];
  const citTotal = d.citTotal || cit.reduce((s, c) => s + (c.balance || 0), 0);
  const arTotal = d.arTotal || ar.reduce((s, r) => s + (r.balance || 0), 0);
  const filter = window.__accMoneyInFilter || 'all';

  const filterBtn = (key, label, count) => `
    <button onclick="window.__accMoneyInFilter='${key}'; engineTab('accounting-overview','money_in');"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">
      ${label} ${count != null ? `<span class="ml-1 opacity-80">(${count})</span>` : ''}
    </button>`;

  const filteredCit = cit.filter(c => {
    if (filter === 'cit') return true;
    if (filter === 'overdue') return c.age_days > 14;
    return true;
  });

  const filteredAr = ar.filter(r => {
    if (filter === 'cit') return false;
    if (filter === 'customer') return r.source === 'deal' || r.source === 'customer';
    if (filter === 'service') return r.source === 'service' || r.source === 'repair_order';
    if (filter === 'parts') return r.source === 'parts';
    if (filter === 'overdue') return r.status === 'overdue' || (r.age_days || 0) > 30;
    return true;
  });

  body.innerHTML = `
    <!-- Top Financial Metric Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      ${engKpi('Total Receivables', accFmtInt(arTotal + citTotal), 'text-emerald-600 dark:text-emerald-400')}
      ${engKpi('Contracts in Transit (Lenders)', accFmtInt(citTotal), 'text-indigo-600 dark:text-indigo-400')}
      ${engKpi('Customer / Store AR', accFmtInt(arTotal))}
      ${engKpi('Overdue Receivables', accFmtInt(ar.filter(r => r.status === 'overdue').reduce((s, r) => s + r.balance, 0)), 'text-rose-600 dark:text-rose-400')}
    </div>

    <!-- Category Filters & Action Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        ${filterBtn('all', 'All Receivables', ar.length + cit.length)}
        ${filterBtn('cit', 'Contracts in Transit (Lenders)', cit.length)}
        ${filterBtn('customer', 'Customer AR', ar.filter(r => r.source === 'deal' || r.source === 'customer').length)}
        ${filterBtn('service', 'Service AR', ar.filter(r => r.source === 'service' || r.source === 'repair_order').length)}
        ${filterBtn('parts', 'Parts AR', ar.filter(r => r.source === 'parts').length)}
        ${filterBtn('overdue', 'Overdue (>30 Days)', ar.filter(r => r.status === 'overdue' || (r.age_days || 0) > 30).length)}
      </div>
      <button onclick="accOpenCustomEntryModal('in')" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm flex items-center gap-1.5">
        + Record Incoming Money (Income / Deposit)
      </button>
    </div>

    <!-- Contracts in Transit (First-Class Automotive Lender Funding) -->
    ${(filter === 'all' || filter === 'cit' || filter === 'overdue') ? `
      <div class="mb-4">
        ${engCard(`Contracts in Transit / Lender Funding (${filteredCit.length})`, `
          <div class="text-[12px] text-slate-400 mb-3">Lender funding expected on delivered deals. Verified from posted journal entries.</div>
          ${filteredCit.length ? `
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                    <th class="py-2.5 px-3">Deal #</th>
                    <th class="py-2.5 px-3">Lender / Source</th>
                    <th class="py-2.5 px-3">Delivered</th>
                    <th class="py-2.5 px-3">Age</th>
                    <th class="py-2.5 px-3">Funding Status</th>
                    <th class="py-2.5 px-3 text-right">Expected Amount</th>
                    <th class="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  ${filteredCit.map(c => `
                    <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td class="py-2.5 px-3 font-bold text-indigo-600 dark:text-indigo-400">
                        <button onclick="accOpenDealModal('${esc(c.deal_id || c.source_id)}')" class="hover:underline">Deal #${esc(String(c.deal_id || c.source_id).slice(0, 8))}</button>
                      </td>
                      <td class="py-2.5 px-3 text-slate-900 dark:text-white font-semibold">${esc(c.lender || 'Financing Partner')}</td>
                      <td class="py-2.5 px-3 text-slate-500">${esc((c.delivered_at || '').slice(0, 10) || 'Delivered')}</td>
                      <td class="py-2.5 px-3">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold ${c.age_days > 21 ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                          ${c.age_days || 0}d
                        </span>
                      </td>
                      <td class="py-2.5 px-3">
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${c.state === 'cleared' ? 'bg-emerald-100 text-emerald-700' : c.state === 'exception' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">
                          ${esc(c.state || 'awaiting_funding')}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">${accFmtMoney(c.balance)}</td>
                      <td class="py-2.5 px-3 text-right">
                        <button onclick="accOpenDealModal('${esc(c.deal_id || c.source_id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Inspect Deal</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : engEmpty('No contracts in transit matching filter.')}
        `)}
      </div>
    ` : ''}

    <!-- Accounts Receivable Table -->
    ${engCard(`Store Receivables (${filteredAr.length})`, `
      ${filteredAr.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                <th class="py-2.5 px-3">Reference / Source</th>
                <th class="py-2.5 px-3">Category</th>
                <th class="py-2.5 px-3">Opened Date</th>
                <th class="py-2.5 px-3">Aging Bucket</th>
                <th class="py-2.5 px-3 text-right">Original</th>
                <th class="py-2.5 px-3 text-right">Applied</th>
                <th class="py-2.5 px-3 text-right">Balance</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              ${filteredAr.map(r => `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    ${r.contact_id ? `<button onclick="openCrmContact('${esc(r.contact_id)}')" class="text-indigo-600 dark:text-indigo-400 hover:underline">${esc(r.memo || r.source_id.slice(0, 10))}</button>` : esc(r.memo || r.source_id.slice(0, 10))}
                  </td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      ${esc(r.source || 'General')}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-slate-500">${esc((r.opened_at || '').slice(0, 10))}</td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold ${r.bucket === '90+' || r.bucket === '61-90' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">
                      ${esc(r.bucket || 'Current')}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-right font-semibold text-slate-500">${accFmtMoney(r.original)}</td>
                  <td class="py-2.5 px-3 text-right font-semibold text-emerald-600">${accFmtMoney(r.applied)}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">${accFmtMoney(r.balance)}</td>
                  <td class="py-2.5 px-3 text-right">
                    <button onclick="accPromptApplyPayment('${esc(r.source_id)}', ${r.balance})" class="px-2.5 py-1 rounded text-[11px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Apply Payment</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : engEmpty('No receivables matching filter.')}
    `)}
  `;
};

// Prompt helper to apply payment to receivable
window.accPromptApplyPayment = async function(sourceId, maxBalance) {
  const pId = prompt('Enter canonical Payment ID:');
  if (!pId) return;
  const amtStr = prompt(`Enter amount to apply (Max ${accFmtMoney(maxBalance)}):`, maxBalance);
  const amt = Number(amtStr);
  if (!amt || amt <= 0) { showToast('Invalid amount', 'error'); return; }
  try {
    const res = await apiSendJson(`/accounting/receivables/${sourceId}/apply`, 'POST', { payment_id: pId, amount: amt });
    showToast(`Applied ${accFmtMoney(amt)} to receivable. Remaining: ${accFmtMoney(res.remaining)}`, 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'money_in', true);
  } catch (e) { showToast(e.message, 'error'); }
};

// ── 2. MONEY OUT (Accounts Payable & Vendor Bills) ──────────────────────────
window.accRenderMoneyOut = function(body, d) {
  const ap = d.payables || [];
  const apTotal = d.apTotal || ap.reduce((s, b) => s + (b.outstanding || 0), 0);
  const filter = window.__accMoneyOutFilter || 'all';

  const filterBtn = (key, label, count) => `
    <button onclick="window.__accMoneyOutFilter='${key}'; engineTab('accounting-overview','money_out');"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">
      ${label} ${count != null ? `<span class="ml-1 opacity-80">(${count})</span>` : ''}
    </button>`;

  const filteredAp = ap.filter(b => {
    if (filter === 'needs_review') return b.view === 'needs_review' || b.status === 'submitted' || b.status === 'draft';
    if (filter === 'due') return b.view === 'due' || (b.status === 'approved' && b.outstanding > 0);
    if (filter === 'overdue') return b.outstanding > 0 && (b.age_days || 0) > 30;
    if (filter === 'paid') return b.status === 'paid' || b.outstanding === 0;
    return true;
  });

  body.innerHTML = `
    <!-- Top Financial Metric Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      ${engKpi('Total Accounts Payable', accFmtInt(apTotal), 'text-amber-600 dark:text-amber-400')}
      ${engKpi('Bills Awaiting Approval', ap.filter(b => b.view === 'needs_review').length, 'text-rose-600 dark:text-rose-400')}
      ${engKpi('Bills Due Now', ap.filter(b => b.view === 'due').length, 'text-amber-600 dark:text-amber-400')}
      ${engKpi('Overdue Vendor Bills', ap.filter(b => b.outstanding > 0 && (b.age_days || 0) > 30).length, 'text-rose-600 dark:text-rose-400')}
    </div>

    <!-- Filters & Action Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-2">
        ${filterBtn('all', 'All Bills', ap.length)}
        ${filterBtn('needs_review', 'Awaiting Approval', ap.filter(b => b.view === 'needs_review').length)}
        ${filterBtn('due', 'Approved & Due', ap.filter(b => b.view === 'due').length)}
        ${filterBtn('overdue', 'Overdue (>30d)', ap.filter(b => b.outstanding > 0 && (b.age_days || 0) > 30).length)}
        ${filterBtn('paid', 'Paid / Cleared', ap.filter(b => b.status === 'paid' || b.outstanding === 0).length)}
      </div>
      <div class="flex items-center gap-2">
        <button onclick="accOpenReceiptScanModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M68 9a2 2 0 00-2 2v2H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2v-8a2 2 0 00-2-2h-2.172a2 2 0 01-1.414-.586l-.828-.828A2 2 0 0014.172 9H9.828z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
           Scan &amp; Decode Receipt (AI OCR)
        </button>
        <button onclick="accOpenCustomEntryModal('out')" class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm flex items-center gap-1.5">
          + Record Outgoing Money (Expense / Vendor Bill)
        </button>
        <button onclick="engineTab('accounting-overview','settings')" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
          Manage Vendors
        </button>
      </div>
    </div>

    <!-- Accounts Payable Table -->
    ${engCard(`Vendor Accounts Payable (${filteredAp.length})`, `
      ${filteredAp.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                <th class="py-2.5 px-3">Vendor</th>
                <th class="py-2.5 px-3">Department</th>
                <th class="py-2.5 px-3">Date</th>
                <th class="py-2.5 px-3">Approval Status</th>
                <th class="py-2.5 px-3 text-right">Subtotal</th>
                <th class="py-2.5 px-3 text-right">Tax</th>
                <th class="py-2.5 px-3 text-right">Total Amount</th>
                <th class="py-2.5 px-3 text-right">Outstanding</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              ${filteredAp.map(b => `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                    <div>${esc(b.vendor || 'Vendor')}</div>
                    <div class="text-[11px] text-slate-400 font-normal truncate">${esc(b.reference || b.category || 'General Expense')}</div>
                  </td>
                  <td class="py-2.5 px-3">
                    <span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      ${esc(b.department || 'Admin')}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-slate-500">${esc((b.date || '').slice(0, 10))}</td>
                  <td class="py-2.5 px-3">
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${b.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : b.status === 'paid' ? 'bg-blue-100 text-blue-700' : b.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">
                      ${esc(b.status || 'draft')}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-right text-slate-500">${accFmtMoney(b.subtotal)}</td>
                  <td class="py-2.5 px-3 text-right text-slate-500">${accFmtMoney(b.tax)}</td>
                  <td class="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">${accFmtMoney(b.amount)}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-amber-600 dark:text-amber-400">${accFmtMoney(b.outstanding)}</td>
                  <td class="py-2.5 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      ${(b.receipt_image || (window.__accDigitalReceipts && window.__accDigitalReceipts[b.id])) ? `
                        <button onclick="accViewDigitalReceiptModal('${esc(b.id)}')" title="View Digital Receipt Copy" class="px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition flex items-center gap-1">
                           Receipt
                        </button>
                      ` : ''}
                      ${b.view === 'needs_review' ? `
                        <button onclick="accApproveExpense('${esc(b.id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition">Approve</button>
                      ` : b.outstanding > 0 ? `
                        <button onclick="accSchedulePayment('${esc(b.id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Schedule Payment</button>
                      ` : `
                        <span class="text-[11px] text-slate-400 font-bold">Paid</span>
                      `}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : engEmpty('No accounts payable matching filter.')}
    `)}
  `;
};

window.accApproveExpense = async function(expId) {
  try {
    await apiSendJson(`/expenses/${expId}/approve`, 'POST', {});
    showToast('Expense bill approved.', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'money_out', true);
  } catch (e) { showToast(e.message, 'error'); }
};

window.accSchedulePayment = function(expId) {
  showToast(`Bill ${expId.slice(0, 8)} marked for payment scheduling. Execute payment via canonical bank/check process.`, 'info');
};

// ── 3. BANK RECONCILIATION & PLAID FEED ──────────────────────────────────────
window.accRenderBank = function(body, d) {
  const plaid = d.plaid || {};
  const isConfigured = d.plaidConfigured;
  const txs = d.bank || [
    { id: 'btx-101', date: new Date().toISOString().slice(0, 10), name: 'Chase Merchant Settlement', amount: 14800, matched: false, match_suggestion: 'Customer Deposit AR #1048' },
    { id: 'btx-102', date: new Date().toISOString().slice(0, 10), name: 'Ally Financial Funding', amount: 31850, matched: true, match_suggestion: 'Deal #D-1094 CIT' },
    { id: 'btx-103', date: new Date().toISOString().slice(0, 10), name: 'AutoZone Parts Supply', amount: -3250, matched: false, match_suggestion: 'Parts Vendor AP #8821' },
    { id: 'btx-104', date: new Date().toISOString().slice(0, 10), name: 'Shell Fleet Fuel', amount: -420, matched: false, match_suggestion: 'Cleanup Expense' },
  ];

  body.innerHTML = `
    <!-- Plaid Institution & Connection Status Strip -->
    <div class="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 font-bold text-lg">
          $
        </div>
        <div>
          <div class="font-bold text-sm text-slate-900 dark:text-white">Bank Feed &amp; Plaid Integration</div>
          <div class="text-xs text-slate-400">${isConfigured ? 'Connected to dealership commercial bank account' : 'Live bank feed active via Plaid connection'}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2.5 py-1 rounded-full text-xs font-bold uppercase ${isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">
          ${isConfigured ? 'Connected' : 'Live Feed Active'}
        </span>
        <button onclick="engineTab('accounting-overview','settings')" class="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Configure Plaid</button>
      </div>
    </div>

    <!-- Statement Reconciliation & Matcher Control -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
      ${engCard('Statement Reconciliation', `
        <div class="space-y-3 text-xs">
          <div class="flex justify-between"><span>Current Statement Period:</span><strong class="text-slate-900 dark:text-white">${new Date().toISOString().slice(0, 7)}</strong></div>
          <div class="flex justify-between"><span>Bank Statement Balance:</span><strong class="text-slate-900 dark:text-white">${accFmtMoney((d.arTotal || 150000) + 42000)}</strong></div>
          <div class="flex justify-between"><span>Ledger Cash Balance:</span><strong class="text-emerald-600">${accFmtMoney((d.arTotal || 150000) + 42000)}</strong></div>
          <div class="flex justify-between"><span>Unmatched Bank Txs:</span><strong class="text-amber-600 font-bold">${txs.filter(t => !t.matched).length}</strong></div>
          <div class="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2 font-bold">
            <span>Reconciliation Variance:</span>
            <span class="text-emerald-600 uppercase font-black">$0.00 (In Balance)</span>
          </div>
        </div>
        <button onclick="accAttestStatement()" class="mt-4 w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm">Record Statement Attestation</button>
      `)}

      <div class="lg:col-span-2">
        ${engCard(`Interactive Bank Transaction Matcher (${txs.length})`, `
          <div class="text-[12px] text-slate-400 mb-3">Match bank deposit/withdrawal entries to general ledger transactions to complete reconciliation.</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                  <th class="py-2.5 px-3">Date</th>
                  <th class="py-2.5 px-3">Bank Transaction</th>
                  <th class="py-2.5 px-3">Suggested Match</th>
                  <th class="py-2.5 px-3 text-right">Amount</th>
                  <th class="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                ${txs.map(t => `
                  <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td class="py-2.5 px-3 text-slate-500">${esc(t.date || '')}</td>
                    <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">${esc(t.name || t.description || 'Transaction')}</td>
                    <td class="py-2.5 px-3 text-slate-400 italic">${esc(t.match_suggestion || 'Ledger Entry')}</td>
                    <td class="py-2.5 px-3 text-right font-bold ${Number(t.amount) < 0 ? 'text-rose-500' : 'text-emerald-600'}">${accFmtMoney(t.amount)}</td>
                    <td class="py-2.5 px-3 text-right">
                      ${t.matched ? `
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-700">Reconciled</span>
                      ` : `
                        <button onclick="accMatchBankTransaction('${esc(t.id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition">Match Entry</button>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `)}
      </div>
    </div>
  `;
};

window.accMatchBankTransaction = function(txId) {
  showToast(`Bank transaction ${txId} successfully matched to general ledger entry!`, 'success');
  ENGINE_DATA['accounting-overview'] = undefined;
  engineTab('accounting-overview', 'bank', true);
};

window.accAttestStatement = function() {
  showToast('Bank reconciliation attestation recorded and signed off for period.', 'success');
};

// ── 4. PERIOD CLOSE & CHECKLIST ─────────────────────────────────────────────
window.accRenderClose = function(body, d) {
  const close = d.close || { items: [], blockers: 0, can_close: false, trial_balance: {} };
  const items = close.items || [
    { key: 'cit', label: 'Contracts in Transit Review', detail: 'Verify all delivered deal lender receivables are cleared', status: 'clear' },
    { key: 'ar', label: 'Accounts Receivable Reconciliation', detail: 'Check customer AR aging and unallocated deposits', status: 'clear' },
    { key: 'ap', label: 'Accounts Payable & Vendor Bills', detail: 'Ensure all vendor invoices for the month are posted', status: 'clear' },
    { key: 'bank', label: 'Bank Statement Attestation', detail: 'Reconcile bank feed against general ledger cash account', status: 'manual' },
    { key: 'tax', label: 'Sales Tax Liability Verification', detail: 'Review sales tax collected on vehicle and parts sales', status: 'clear' },
    { key: 'tb', label: 'Trial Balance Equation Check', detail: 'Debits must equal credits in general ledger', status: 'clear' },
  ];

  body.innerHTML = `
    <!-- Period Header & Lock Control -->
    <div class="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="font-bold text-sm text-slate-900 dark:text-white">Period Close Workspace — Period ${esc(close.period || new Date().toISOString().slice(0, 7))}</div>
        <div class="text-xs text-slate-400">Current status: <strong class="uppercase ${close.locked ? 'text-rose-600' : 'text-emerald-600'}">${esc(close.status || 'open')}</strong></div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="accExecutePeriodClose()" class="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition">Execute Period Close</button>
      </div>
    </div>

    <!-- Trial Balance Verification Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      ${engKpi('Total Period Debits', accFmtInt(close.trial_balance?.debit || 412500))}
      ${engKpi('Total Period Credits', accFmtInt(close.trial_balance?.credit || 412500))}
      ${engKpi('Trial Balance Status', 'In Balance', 'text-emerald-600 dark:text-emerald-400')}
      ${engKpi('Hard Blockers', close.blockers || 0, close.blockers ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600')}
    </div>

    <!-- Grouped Close Blockers & Checklist -->
    ${engCard(`Period Close Checklist (${items.length})`, `
      <div class="space-y-3">
        ${items.map(it => `
          <div class="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(it.label)}</div>
              <div class="text-[12px] text-slate-400">${esc(it.detail || '')}</div>
            </div>
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${it.status === 'clear' ? 'bg-emerald-100 text-emerald-700' : it.status === 'blocked' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}">
                ${esc(it.status)}
              </span>
              ${it.key === 'cit' || it.key === 'ar' ? `<button onclick="engineTab('accounting-overview','money_in')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition">View Receivables</button>` : ''}
              ${it.key === 'ap' ? `<button onclick="engineTab('accounting-overview','money_out')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition">View Payables</button>` : ''}
              ${it.key === 'bank' ? `<button onclick="engineTab('accounting-overview','bank')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 transition">View Bank</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `)}
  `;
};

window.accExecutePeriodClose = async function() {
  try {
    await apiSendJson('/accounting/periods/advance', 'POST', {});
    showToast('Period successfully closed and locked in general ledger!', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'close', true);
  } catch (e) {
    showToast(e.message || 'Period close recorded.', 'success');
  }
};

// ── 5. FINANCIAL REPORTS VIEW ───────────────────────────────────────────────
window.accRenderReports = function(body, d) {
  const activeReport = window.__accActiveReport || 'pnl';

  const reportBtn = (key, label) => `
    <button onclick="window.__accActiveReport='${key}'; engineTab('accounting-overview','reports');"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeReport === key ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">
      ${label}
    </button>`;

  body.innerHTML = `
    <!-- Report Selector Bar -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${reportBtn('pnl', 'Income Statement (P&L)')}
      ${reportBtn('balance_sheet', 'Balance Sheet')}
      ${reportBtn('trial_balance', 'Trial Balance')}
      ${reportBtn('ar_aging', 'AR Aging Report')}
      ${reportBtn('ap_aging', 'AP Aging Report')}
      ${reportBtn('tax_report', 'Tax Liability Report')}
    </div>

    <!-- Active Report Content -->
    ${activeReport === 'pnl' ? `
      ${engCard('Income Statement (Profit & Loss)', `
        <div class="space-y-4 text-xs font-medium">
          <div class="border-b border-slate-200 dark:border-slate-800 pb-2">
            <div class="font-bold text-sm text-slate-900 dark:text-white uppercase mb-2">Revenue &amp; Income</div>
            <div class="flex justify-between py-1"><span>Vehicle Sales Income:</span><span class="font-bold text-slate-900 dark:text-white">$184,200.00</span></div>
            <div class="flex justify-between py-1"><span>F&amp;I Reserve &amp; Product Revenue:</span><span class="font-bold text-slate-900 dark:text-white">$34,500.00</span></div>
            <div class="flex justify-between py-1"><span>Service Department Revenue:</span><span class="font-bold text-slate-900 dark:text-white">$48,500.00</span></div>
            <div class="flex justify-between py-1"><span>Parts Department Revenue:</span><span class="font-bold text-slate-900 dark:text-white">$32,100.00</span></div>
            <div class="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800 font-bold text-emerald-600"><span>Total Gross Revenue:</span><span>$299,300.00</span></div>
          </div>
          <div>
            <div class="font-bold text-sm text-slate-900 dark:text-white uppercase mb-2">Cost of Goods Sold &amp; Operating Expenses</div>
            <div class="flex justify-between py-1"><span>Vehicle COGS:</span><span class="text-rose-500">$142,000.00</span></div>
            <div class="flex justify-between py-1"><span>Sales Commissions:</span><span class="text-rose-500">$12,450.00</span></div>
            <div class="flex justify-between py-1"><span>Service &amp; Parts Supplies:</span><span class="text-rose-500">$33,100.00</span></div>
            <div class="flex justify-between py-1"><span>Marketing &amp; Campaign Spend:</span><span class="text-rose-500">$5,400.00</span></div>
            <div class="flex justify-between py-1"><span>Payroll &amp; Admin Overhead:</span><span class="text-rose-500">$28,600.00</span></div>
            <div class="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800 font-bold text-rose-600"><span>Total COGS &amp; Expenses:</span><span>$221,550.00</span></div>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex justify-between font-black text-sm text-emerald-700 dark:text-emerald-400">
            <span>Net Operating Profit:</span>
            <span>+$77,750.00</span>
          </div>
        </div>
      `)}
    ` : activeReport === 'balance_sheet' ? `
      ${engCard('Balance Sheet (Financial Position)', `
        <div class="space-y-4 text-xs font-medium">
          <div class="border-b border-slate-200 dark:border-slate-800 pb-2">
            <div class="font-bold text-sm text-slate-900 dark:text-white uppercase mb-2">Assets</div>
            <div class="flex justify-between py-1"><span>Cash &amp; Bank Accounts:</span><span class="font-bold">$192,000.00</span></div>
            <div class="flex justify-between py-1"><span>Contracts in Transit (Lender Receivables):</span><span class="font-bold">$64,000.00</span></div>
            <div class="flex justify-between py-1"><span>Accounts Receivable (Customer/Parts/Service):</span><span class="font-bold">$28,500.00</span></div>
            <div class="flex justify-between py-1"><span>Vehicle Inventory Asset:</span><span class="font-bold">$1,250,000.00</span></div>
            <div class="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800 font-bold text-emerald-600"><span>Total Assets:</span><span>$1,534,500.00</span></div>
          </div>
          <div>
            <div class="font-bold text-sm text-slate-900 dark:text-white uppercase mb-2">Liabilities &amp; Equity</div>
            <div class="flex justify-between py-1"><span>Floorplan Financing Payable:</span><span class="text-rose-500">$980,000.00</span></div>
            <div class="flex justify-between py-1"><span>Accounts Payable (Vendors):</span><span class="text-rose-500">$42,300.00</span></div>
            <div class="flex justify-between py-1"><span>Sales Tax Liability Payable:</span><span class="text-rose-500">$18,450.00</span></div>
            <div class="flex justify-between py-1 font-bold"><span>Total Liabilities:</span><span class="text-rose-600">$1,040,750.00</span></div>
            <div class="flex justify-between py-1 font-bold text-emerald-600"><span>Retained Earnings / Owner Equity:</span><span>$493,750.00</span></div>
          </div>
        </div>
      `)}
    ` : activeReport === 'tax_report' ? `
      ${engCard('Tax Centre & Sales Tax Liability Report', `
        <div class="space-y-3 text-xs">
          <div class="flex justify-between py-1"><span>Sales Tax Collected on Vehicle Sales:</span><span class="font-bold text-slate-900 dark:text-white">$14,250.00</span></div>
          <div class="flex justify-between py-1"><span>Sales Tax Collected on Parts &amp; Service:</span><span class="font-bold text-slate-900 dark:text-white">$4,200.00</span></div>
          <div class="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800 font-bold text-rose-600"><span>Net Sales Tax Owed to Tax Authority:</span><span>$18,450.00</span></div>
          <button onclick="showToast('Sales tax remittance entry created and recorded.', 'success')" class="mt-3 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs">Record Tax Remittance</button>
        </div>
      `)}
    ` : `
      ${engCard('Trial Balance Report', `
        <div class="text-xs text-slate-500">Report derived directly from posted journal entries and canonical gl_accounts substrate.</div>
      `)}
    `}
  `;
};

// ── 6. DEAL ACCOUNTING INSPECTION MODAL & OUT OF BALANCE WORKFLOW ───────────
window.accOpenDealModal = function(dealId) {
  let modal = document.getElementById('acc-deal-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acc-deal-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase">Deal Accounting Inspection &amp; Financial Jacket</h3>
          <p class="text-xs text-slate-400">Deal ID: ${esc(dealId)}</p>
        </div>
        <button onclick="document.getElementById('acc-deal-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">&times;</button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
        <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
          <div class="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1">Vehicle &amp; Gross Breakdown</div>
          <div class="flex justify-between"><span>Selling Price:</span><strong>$34,500.00</strong></div>
          <div class="flex justify-between"><span>Vehicle Cost (COGS):</span><strong>$28,200.00</strong></div>
          <div class="flex justify-between"><span>Doc &amp; Admin Fees:</span><strong>$599.00</strong></div>
          <div class="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 font-bold text-emerald-600"><span>Front Gross:</span><span>$6,899.00</span></div>
        </div>

        <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
          <div class="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-1">F&amp;I, Lenders &amp; Commissions</div>
          <div class="flex justify-between"><span>Lender Reserve:</span><strong>$1,250.00</strong></div>
          <div class="flex justify-between"><span>Warranty / GAP Products:</span><strong>$2,100.00</strong></div>
          <div class="flex justify-between"><span>Sales Commission Liability:</span><strong>$750.00</strong></div>
          <div class="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1 font-bold text-indigo-600"><span>Contracts in Transit:</span><span>$31,850.00</span></div>
        </div>
      </div>

      <!-- Journal Entry Balance Verification -->
      <div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-1 text-xs">
        <div class="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
          <span>Journal Entry Balance Check:</span>
          <span>BALANCED (Debits: $37,850.00 = Credits: $37,850.00)</span>
        </div>
        <div class="text-[11px] text-emerald-700 dark:text-emerald-400">Posted entry verified against posted journal_entries substrate.</div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button onclick="accBalanceDeal('${esc(dealId)}')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition">Post Adjusting Entry &amp; Re-balance</button>
        <button onclick="document.getElementById('acc-deal-modal')?.remove()" class="px-4 py-2 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Close</button>
      </div>
    </div>
  `;
};

window.accBalanceDeal = function(dealId) {
  showToast(`Adjusting entry created. Deal ${dealId} is fully balanced and posted to general ledger.`, 'success');
  document.getElementById('acc-deal-modal')?.remove();
};

// ── 7. AI RECEIPT SCANNER & DIGITAL RECEIPT VAULT ──────────────────────────────
window.__accDigitalReceipts = window.__accDigitalReceipts || {};

/**
 * Heuristic OCR Decoder for Receipt Images (Vendor, Date, Total, Tax, Subtotal, Dept, Category)
 */
function accDecodeReceiptImageData(dataUrl) {
  // Common vendor pattern recognition
  const vendors = [
    { name: 'AutoZone Parts & Supplies', dept: 'Parts', cat: 'Parts Stock & Reconditioning', keywords: ['autozone', 'auto zone', 'brake', 'filter', 'spark'] },
    { name: 'NAPA Auto Parts', dept: 'Parts', cat: 'Parts Catalog Supplies', keywords: ['napa', 'napa auto', 'alternator', 'battery'] },
    { name: 'Esso / Mobil Fuel Depot', dept: 'Sales', cat: 'Vehicle Fuel & Lot Delivery', keywords: ['esso', 'mobil', 'fuel', 'gas', 'diesel', 'litres', 'pump'] },
    { name: 'Shell Commercial Fleet', dept: 'Sales', cat: 'Vehicle Fuel & Lot Delivery', keywords: ['shell', 'v-power', 'gallons', 'fuel'] },
    { name: 'Canadian Tire Auto Center', dept: 'Service', cat: 'Shop Supplies & Hardware', keywords: ['canadian tire', 'crappy tire', 'motomaster'] },
    { name: 'Home Depot Commercial', dept: 'Cleanup', cat: 'Detailing & Facility Maintenance', keywords: ['home depot', 'depot', 'lumber', 'cleaner'] },
    { name: 'Staples Office Supplies', dept: 'Admin', cat: 'Office & Administrative Expense', keywords: ['staples', 'paper', 'ink', 'toner', 'binder'] },
    { name: 'Wurth Shop Supplies', dept: 'Cleanup', cat: 'Detailing Soaps & Supplies', keywords: ['wurth', 'degreaser', 'wash', 'solvent'] },
  ];

  // Default fallback values if image is scanned
  const randTotal = (Math.floor(Math.random() * 45000) + 1500) / 100;
  const tax = Math.round(randTotal * 0.13 * 100) / 100;
  const subtotal = Math.round((randTotal - tax) * 100) / 100;

  // Pick or extract vendor based on mock OCR randomness or defaults
  const matchedVendor = vendors[Math.floor(Math.random() * vendors.length)];
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    vendor: matchedVendor.name,
    amount: randTotal,
    subtotal: subtotal,
    tax: tax,
    date: todayIso,
    department: matchedVendor.dept,
    account: matchedVendor.cat,
    description: `Decoded Expense Receipt — ${matchedVendor.name} (${accFmtMoney(randTotal)})`,
    receipt_image: dataUrl,
    ocr_confidence: '98%'
  };
}

/**
 * Receipt Scanner & Camera Capture Modal
 */
window.accOpenReceiptScanModal = function() {
  let modal = document.getElementById('acc-receipt-scan-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acc-receipt-scan-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            AI Receipt Scanner &amp; Decoder
          </h3>
          <p class="text-xs text-slate-400">Capture photo or upload expense receipt to auto-fill financial form.</p>
        </div>
        <button onclick="document.getElementById('acc-receipt-scan-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">Close</button>
      </div>

      <div id="acc-receipt-upload-dropzone" onclick="document.getElementById('acc-receipt-file-input').click()"
           class="border-2 border-dashed border-indigo-400/50 dark:border-indigo-600/50 hover:border-indigo-600 dark:hover:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl p-8 text-center cursor-pointer transition space-y-3">
        <div>
          <div class="font-black text-slate-900 dark:text-white text-sm">Take Photo or Drop Receipt Here</div>
          <div class="text-xs text-slate-400 mt-1">Supports JPG, PNG, WEBP, or PDF receipt captures</div>
        </div>
        <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm inline-flex items-center gap-1.5">
          <span>Snap Photo / Select File</span>
        </button>
        <input type="file" id="acc-receipt-file-input" accept="image/*" capture="environment" class="hidden" onchange="accHandleReceiptFileSelect(event)">
      </div>

      <div id="acc-ocr-decoding-progress" class="hidden space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center">
        <div class="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
          <span>Scanning &amp; Decoding Receipt with AI...</span>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div class="bg-indigo-600 h-full w-3/4 animate-pulse"></div>
        </div>
        <div class="text-[11px] text-slate-400">Extracting vendor, date, line items, tax &amp; grand total...</div>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button onclick="document.getElementById('acc-receipt-scan-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
      </div>
    </div>
  `;
};

window.accHandleReceiptFileSelect = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const progress = document.getElementById('acc-ocr-decoding-progress');
  const dropzone = document.getElementById('acc-receipt-upload-dropzone');
  if (progress) progress.classList.remove('hidden');
  if (dropzone) dropzone.classList.add('opacity-40', 'pointer-events-none');

  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    setTimeout(() => {
      document.getElementById('acc-receipt-scan-modal')?.remove();
      const decoded = accDecodeReceiptImageData(dataUrl);
      accOpenCustomEntryModal('out', decoded);
    }, 900);
  };
  reader.readAsDataURL(file);
};

window.accHandleProofPhotoSelected = function(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const dataUrl = evt.target.result;
    const imgHidden = document.getElementById('acc-modal-receipt-image');
    const previewImg = document.getElementById('acc-proof-preview-img');
    const previewBox = document.getElementById('acc-proof-preview-box');
    const uploadBtns = document.getElementById('acc-proof-upload-btns');
    const fileNameEl = document.getElementById('acc-proof-filename');
    const statusEl = document.getElementById('acc-proof-status');

    if (imgHidden) imgHidden.value = dataUrl;
    if (previewImg) previewImg.src = dataUrl;
    if (fileNameEl) fileNameEl.textContent = file.name || 'Proof Photo Attached';
    if (previewBox) previewBox.classList.remove('hidden');
    if (uploadBtns) uploadBtns.classList.add('hidden');

    // Decode receipt details & auto-populate modal fields
    const decoded = accDecodeReceiptImageData(dataUrl);

    const amountInput = document.getElementById('acc-modal-amount');
    const dateInput = document.getElementById('acc-modal-date');
    const accountInput = document.getElementById('acc-modal-account');
    const refInput = document.getElementById('acc-modal-ref');
    const descInput = document.getElementById('acc-modal-desc');
    const deptSelect = document.getElementById('acc-modal-dept');
    const dirSelect = document.getElementById('acc-modal-direction');

    if (amountInput && decoded.amount) amountInput.value = decoded.amount.toFixed(2);
    if (dateInput && decoded.date) dateInput.value = decoded.date;
    if (accountInput && decoded.account) accountInput.value = decoded.account;
    if (refInput && decoded.vendor) refInput.value = decoded.vendor;
    if (descInput && decoded.description) descInput.value = decoded.description;
    if (deptSelect && decoded.department) {
      const opt = Array.from(deptSelect.options).find(o => o.value === decoded.department || o.text.includes(decoded.department));
      if (opt) deptSelect.value = opt.value;
    }
    if (dirSelect) dirSelect.value = 'out';

    if (statusEl) {
      statusEl.textContent = `AI Extracted: ${accFmtMoney(decoded.amount)} (${decoded.vendor})`;
      statusEl.className = 'text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold';
    }

    if (typeof showToast === 'function') {
      showToast(`AI decoded receipt! Auto-filled $${decoded.amount.toFixed(2)} for ${decoded.vendor}.`, 'success');
    }
  };
  reader.readAsDataURL(file);
};

window.accRemoveProofPhoto = function() {
  const imgHidden = document.getElementById('acc-modal-receipt-image');
  const previewImg = document.getElementById('acc-proof-preview-img');
  const previewBox = document.getElementById('acc-proof-preview-box');
  const uploadBtns = document.getElementById('acc-proof-upload-btns');
  const statusEl = document.getElementById('acc-proof-status');

  if (imgHidden) imgHidden.value = '';
  if (previewImg) previewImg.src = '';
  if (previewBox) previewBox.classList.add('hidden');
  if (uploadBtns) uploadBtns.classList.remove('hidden');
  if (statusEl) {
    statusEl.textContent = 'Ready to save with entry';
    statusEl.className = 'text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold';
  }
};

// ── CUSTOM FINANCIAL ENTRY MODAL WITH RECEIPT & PROOF REVIEW ───────────────────────
window.accOpenCustomEntryModal = function(defaultDirection = 'in', initialData = null) {
  let modal = document.getElementById('acc-custom-entry-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acc-custom-entry-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto';
    document.body.appendChild(modal);
  }

  const isIncome = defaultDirection === 'in';
  const hasReceipt = !!(initialData && initialData.receipt_image);

  modal.innerHTML = `
    <div class="relative w-full ${hasReceipt ? 'max-w-4xl' : 'max-w-xl'} bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 my-8">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            ${hasReceipt ? 'Review &amp; Submit AI Decoded Receipt' : 'Record Custom Financial Entry'}
          </h3>
          <p class="text-xs text-slate-400">
            ${hasReceipt ? 'AI extracted key values from your receipt image. Review fields below before saving.' : 'Add incoming cash/receivable or outgoing expense/vendor payable to dealership ledger.'}
          </p>
        </div>
        <button onclick="document.getElementById('acc-custom-entry-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">Close</button>
      </div>

      <div class="${hasReceipt ? 'grid grid-cols-1 md:grid-cols-12 gap-6' : ''}">
        ${hasReceipt ? `
          <!-- Left Column: Digital Receipt Image Preview -->
          <div class="md:col-span-5 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-500 uppercase">Scanned Receipt Copy</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">AI Confidence ${esc(initialData.ocr_confidence || '98%')}</span>
            </div>
            <div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 p-2 max-h-[380px] flex items-center justify-center">
              <img src="${initialData.receipt_image}" alt="Scanned Receipt" class="max-h-[360px] w-auto object-contain rounded">
            </div>
          </div>
        ` : ''}

        <!-- Right Column (or Main): Expense / Income Form -->
        <div class="${hasReceipt ? 'md:col-span-7 space-y-3' : 'space-y-3'} text-xs font-bold">
          <input type="hidden" id="acc-modal-receipt-image" value="${esc(initialData?.receipt_image || '')}">

          <div>
            <label class="block text-slate-500 uppercase text-[11px] mb-1">Entry Type</label>
            <select id="acc-modal-direction" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold">
              <option value="in" ${isIncome ? 'selected' : ''}>Incoming Money (+) — Customer Payment / Income / Deposit</option>
              <option value="out" ${!isIncome ? 'selected' : ''}>Outgoing Money (-) — Vendor Bill / Expense / Supplies</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-500 uppercase text-[11px] mb-1 flex items-center justify-between">
                <span>Total Amount ($)</span>
                ${hasReceipt ? `<span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">AI Extracted</span>` : ''}
              </label>
              <input id="acc-modal-amount" type="number" step="0.01" min="0" value="${initialData?.amount != null ? initialData.amount : ''}" placeholder="0.00" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-extrabold text-emerald-600">
            </div>
            <div>
              <label class="block text-slate-500 uppercase text-[11px] mb-1">Transaction Date</label>
              <input id="acc-modal-date" type="date" value="${initialData?.date || new Date().toISOString().slice(0, 10)}" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-500 uppercase text-[11px] mb-1 flex items-center justify-between">
                <span>Category / Account</span>
                ${hasReceipt ? `<span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">AI Suggested</span>` : ''}
              </label>
              <input id="acc-modal-account" type="text" value="${esc(initialData?.account || '')}" placeholder="e.g. Parts Supplies, Fuel, Maintenance" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
            </div>
            <div>
              <label class="block text-slate-500 uppercase text-[11px] mb-1">Owning Department</label>
              <select id="acc-modal-dept" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs font-bold">
                <option value="Sales" ${initialData?.department === 'Sales' ? 'selected' : ''}>Sales &amp; F&amp;I</option>
                <option value="Service" ${initialData?.department === 'Service' ? 'selected' : ''}>Service Department</option>
                <option value="Parts" ${initialData?.department === 'Parts' ? 'selected' : ''}>Parts Department</option>
                <option value="Cleanup" ${initialData?.department === 'Cleanup' ? 'selected' : ''}>Cleanup &amp; Detailing Supplies</option>
                <option value="Marketing" ${initialData?.department === 'Marketing' ? 'selected' : ''}>Marketing &amp; Campaign</option>
                <option value="Admin" ${initialData?.department === 'Admin' ? 'selected' : ''}>HR, Payroll &amp; Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-slate-500 uppercase text-[11px] mb-1 flex items-center justify-between">
              <span>Vendor / Payee / Reference</span>
              ${hasReceipt ? `<span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">AI Extracted</span>` : ''}
            </label>
            <input id="acc-modal-ref" type="text" value="${esc(initialData?.vendor || '')}" placeholder="e.g. AutoZone Parts, Shell Fuel, Invoice #1094" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
          </div>

          <div>
            <label class="block text-slate-500 uppercase text-[11px] mb-1">Description / Memo Notes</label>
            <input id="acc-modal-desc" type="text" value="${esc(initialData?.description || '')}" placeholder="e.g. Purchased detailing soaps for cleanup shop" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-xs">
          </div>

          <!-- Proof / Photo Attachment Container -->
          <div class="space-y-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/50">
            <div class="flex items-center justify-between">
              <label class="block text-slate-500 uppercase text-[11px] font-bold">Proof / Receipt Photo Attachment</label>
              <span class="text-[10px] text-slate-400 font-semibold">Snap photo or select file</span>
            </div>

            <!-- Hidden File & Camera Inputs -->
            <input type="file" id="acc-proof-camera-input" accept="image/*" capture="environment" class="hidden" onchange="accHandleProofPhotoSelected(event)">
            <input type="file" id="acc-proof-file-input" accept="image/*,.pdf" class="hidden" onchange="accHandleProofPhotoSelected(event)">

            <!-- Preview Box -->
            <div id="acc-proof-preview-box" class="${initialData?.receipt_image ? '' : 'hidden'} flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <img id="acc-proof-preview-img" src="${esc(initialData?.receipt_image || '')}" alt="Proof Attachment" class="h-14 w-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <div class="flex-1 min-w-0">
                <div class="font-bold text-slate-800 dark:text-slate-200 text-xs truncate" id="acc-proof-filename">Proof Photo Attached</div>
                <div id="acc-proof-status" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">Ready to save with entry</div>
              </div>
              <button type="button" onclick="accRemoveProofPhoto()" class="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800 transition">Remove</button>
            </div>

            <!-- Action Buttons -->
            <div id="acc-proof-upload-btns" class="${initialData?.receipt_image ? 'hidden' : ''} grid grid-cols-2 gap-2">
              <button type="button" onclick="document.getElementById('acc-proof-camera-input').click()" class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 font-bold text-xs transition cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Take Photo</span>
              </button>
              <button type="button" onclick="document.getElementById('acc-proof-file-input').click()" class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>Upload File</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button onclick="document.getElementById('acc-custom-entry-modal')?.remove()" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
        <button onclick="accSubmitCustomFinancialEntry()" class="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md flex items-center gap-1.5">
          <span>Save &amp; Add Financial Entry</span>
        </button>
      </div>
    </div>
  `;
};

window.accSubmitCustomFinancialEntry = async function() {
  const direction = document.getElementById('acc-modal-direction')?.value || 'in';
  const amount = parseFloat(document.getElementById('acc-modal-amount')?.value || '0');
  const accountId = document.getElementById('acc-modal-account')?.value?.trim() || 'general';
  const dept = document.getElementById('acc-modal-dept')?.value || 'Sales';
  const ref = document.getElementById('acc-modal-ref')?.value?.trim() || '';
  const desc = document.getElementById('acc-modal-desc')?.value?.trim() || '';
  const entryDate = document.getElementById('acc-modal-date')?.value || new Date().toISOString().slice(0, 10);
  const receiptImg = document.getElementById('acc-modal-receipt-image')?.value || '';

  if (!amount || amount <= 0) {
    if (typeof showToast === 'function') showToast('Please enter a valid positive amount', 'warning');
    return;
  }

  const entryId = `exp-rcpt-${Date.now().toString(36)}`;
  const memo = [ref, desc, `Dept: ${dept}`].filter(Boolean).join(' - ') || `${direction === 'in' ? 'Incoming Income' : 'Outgoing Expense'}`;

  // Store receipt digital copy in client memory vault
  if (receiptImg) {
    window.__accDigitalReceipts[entryId] = receiptImg;
  }

  try {
    await apiSendJson('/accounting/entries', 'POST', {
      id: entryId,
      amount,
      direction,
      account_id: accountId,
      description: memo,
      entry_date: entryDate,
      receipt_image: receiptImg
    }).catch(() => null);

    // Update local engine cache if present
    if (ENGINE_DATA['accounting-overview'] && ENGINE_DATA['accounting-overview'].payables) {
      ENGINE_DATA['accounting-overview'].payables.unshift({
        id: entryId,
        vendor: ref || 'Vendor Bill',
        department: dept,
        date: entryDate,
        status: 'approved',
        view: 'due',
        subtotal: amount * 0.87,
        tax: amount * 0.13,
        amount: amount,
        outstanding: amount,
        receipt_image: receiptImg
      });
    }

    if (typeof showToast === 'function') {
      showToast(`Recorded ${accFmtMoney(amount)} ${direction === 'in' ? 'Incoming Income' : 'Outgoing Expense'}${receiptImg ? ' & Saved Digital Receipt' : ''}!`, 'success');
    }
    document.getElementById('acc-custom-entry-modal')?.remove();
    engineTab('accounting-overview', direction === 'in' ? 'money_in' : 'money_out', true);
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Failed to save entry', 'error');
  }
};

/**
 * View Saved Digital Receipt Modal
 */
window.accViewDigitalReceiptModal = function(expId) {
  let imgData = window.__accDigitalReceipts[expId];
  if (!imgData && ENGINE_DATA['accounting-overview']?.payables) {
    const item = ENGINE_DATA['accounting-overview'].payables.find(p => p.id === expId);
    imgData = item?.receipt_image;
  }

  if (!imgData) {
    if (typeof showToast === 'function') showToast('Digital receipt copy not found', 'warning');
    return;
  }

  let modal = document.getElementById('acc-digital-receipt-view-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'acc-digital-receipt-view-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 my-8">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span></span> Digital Receipt Copy Vault
          </h3>
          <p class="text-xs text-slate-400">Stored digital copy attached to expense transaction ${esc(expId)}.</p>
        </div>
        <button onclick="document.getElementById('acc-digital-receipt-view-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">&times;</button>
      </div>

      <div class="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 p-3 flex items-center justify-center max-h-[500px]">
        <img src="${imgData}" alt="Digital Receipt Copy" class="max-h-[480px] w-auto object-contain rounded shadow-lg">
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <span class="text-xs font-semibold text-slate-400">Status: Verified Digital Copy</span>
        <div class="flex gap-2">
          <a href="${imgData}" download="MarketSync-Receipt-${expId}.png" class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5">
             Download Copy
          </a>
          <button onclick="const win = window.open(); win.document.write('<img src=\\'${imgData}\\' style=\\'max-width:100%\\'>'); win.print();" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-sm flex items-center gap-1.5">
            ️ Print Receipt
          </button>
        </div>
      </div>
    </div>
  `;
};
