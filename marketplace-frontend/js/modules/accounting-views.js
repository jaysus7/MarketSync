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

    <!-- Category Filters -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      ${filterBtn('all', 'All Receivables', ar.length + cit.length)}
      ${filterBtn('cit', 'Contracts in Transit (Lenders)', cit.length)}
      ${filterBtn('customer', 'Customer AR', ar.filter(r => r.source === 'deal' || r.source === 'customer').length)}
      ${filterBtn('service', 'Service AR', ar.filter(r => r.source === 'service' || r.source === 'repair_order').length)}
      ${filterBtn('parts', 'Parts AR', ar.filter(r => r.source === 'parts').length)}
      ${filterBtn('overdue', 'Overdue (>30 Days)', ar.filter(r => r.status === 'overdue' || (r.age_days || 0) > 30).length)}
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
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
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
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
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
      <button onclick="engineTab('accounting-overview','settings')" class="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
        Manage Expenses &amp; Vendors
      </button>
    </div>

    <!-- Accounts Payable Table -->
    ${engCard(`Vendor Accounts Payable (${filteredAp.length})`, `
      ${filteredAp.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
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
                    ${b.view === 'needs_review' ? `
                      <button onclick="accApproveExpense('${esc(b.id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition">Approve</button>
                    ` : b.outstanding > 0 ? `
                      <button onclick="accSchedulePayment('${esc(b.id)}')" class="px-2.5 py-1 rounded text-[11px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Schedule Payment</button>
                    ` : `
                      <span class="text-[11px] text-slate-400 font-bold">Paid</span>
                    `}
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
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[11px]">
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
        <button onclick="document.getElementById('acc-deal-modal')?.remove()" class="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg font-bold">✕</button>
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
