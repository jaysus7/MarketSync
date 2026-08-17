/* dashboard.js split part 9/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function acctFinOverview(el) {
  const s = await apiGetJson('/accounting/summary');
  const card = (label, val, tone) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">${label}</div>
    <div class="text-2xl font-black mt-1 ${tone || 'text-slate-900 dark:text-white'}">${finMoney(val)}</div></div>`;
  el.innerHTML = `
    <div class="text-[11px] text-slate-400 mb-2">Month to date · ${esc(s.month || '')} · all figures from the double-entry ledger</div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${card('Revenue MTD', s.revenue_mtd)}
      ${card('Gross Profit MTD', s.gross_profit_mtd, 'text-emerald-600 dark:text-emerald-400')}
      ${card('Expenses MTD', s.expenses_mtd, 'text-amber-600 dark:text-amber-400')}
      ${card('Net Income MTD', s.net_income_mtd, (Number(s.net_income_mtd) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'))}
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      ${card('Cash Position', s.cash)}
      ${card('Accounts Receivable', s.accounts_receivable)}
      ${card('Accounts Payable', s.accounts_payable, 'text-amber-600 dark:text-amber-400')}
      ${card('Inventory Value', s.inventory_value)}
    </div>`;
}

async function acctFinJournal(el) {
  const d = await apiGetJson('/accounting/journal');
  const entries = d.entries || [];
  if (!entries.length) { el.innerHTML = `<div class="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No journal entries yet. They post automatically as deals deliver, deposits land, and commissions calculate.</div>`; return; }
  el.innerHTML = entries.map(e => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-2">
      <div class="flex items-center justify-between text-[13px]">
        <div class="font-bold text-slate-800 dark:text-slate-200">${esc(e.entry_date)} · ${esc(e.source)}${e.reference ? ' · ' + esc(String(e.reference).slice(0, 8)) : ''}</div>
        <div class="text-[11px] text-slate-400">${esc(e.event_name || '')}</div>
      </div>
      <table class="w-full text-[13px] mt-2"><tbody>
        ${(e.lines || []).map(l => `<tr class="border-t border-slate-100 dark:border-slate-800/60">
          <td class="py-1 text-slate-600 dark:text-slate-300">${esc(l.memo || '')}</td>
          <td class="py-1 text-right tabular-nums ${Number(l.debit) ? '' : 'text-slate-300 dark:text-slate-700'}">${Number(l.debit) ? finMoney(l.debit) : '—'}</td>
          <td class="py-1 text-right tabular-nums ${Number(l.credit) ? '' : 'text-slate-300 dark:text-slate-700'}">${Number(l.credit) ? finMoney(l.credit) : '—'}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`).join('');
}

async function acctFinTrial(el) {
  const d = await apiGetJson('/accounting/trial-balance');
  const rows = (d.rows || []).sort((a, b) => String(a.code).localeCompare(String(b.code)));
  el.innerHTML = `<div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
    <table class="w-full text-sm"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
      <th class="px-3 py-2">Account</th><th class="px-3 py-2 text-right">Debit</th><th class="px-3 py-2 text-right">Credit</th></tr></thead>
    <tbody>${rows.map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60"><td class="px-3 py-2">${esc(r.code || '')} ${esc(r.name)}</td><td class="px-3 py-2 text-right tabular-nums">${r.debit ? finMoney(r.debit) : '—'}</td><td class="px-3 py-2 text-right tabular-nums">${r.credit ? finMoney(r.credit) : '—'}</td></tr>`).join('') || '<tr><td colspan="3" class="px-3 py-8 text-center text-slate-400">No postings yet.</td></tr>'}</tbody>
    <tfoot><tr class="border-t-2 border-slate-300 dark:border-slate-700 font-black"><td class="px-3 py-2">Total ${d.balanced ? '<span class="text-emerald-500 text-[11px] font-bold ml-1"> balanced</span>' : '<span class="text-rose-500 text-[11px] font-bold ml-1"> off</span>'}</td><td class="px-3 py-2 text-right tabular-nums">${finMoney(d.total_debit)}</td><td class="px-3 py-2 text-right tabular-nums">${finMoney(d.total_credit)}</td></tr></tfoot>
    </table></div>`;
}

async function acctFinIncome(el) {
  const now = new Date(); const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const d = await apiGetJson(`/accounting/income-statement?from=${from}`);
  const section = (title, lines, total, tone) => `
    <div class="flex items-center justify-between text-[11px] uppercase font-bold tracking-wider text-slate-400 mt-3 mb-1">${title}<span>${finMoney(total)}</span></div>
    ${(lines || []).map(l => `<div class="flex items-center justify-between text-[13px] py-0.5"><span class="text-slate-600 dark:text-slate-300">${esc(l.name)}</span><span class="tabular-nums">${finMoney(l.amount)}</span></div>`).join('')}`;
  el.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-xl">
    <div class="text-[11px] text-slate-400 mb-1">Month to date · ${esc(from.slice(0, 7))}</div>
    ${section('Revenue', d.revenue_lines, d.revenue)}
    ${section('Cost of sales', d.cogs_lines, d.cogs)}
    <div class="flex items-center justify-between font-bold border-t border-slate-200 dark:border-slate-800 mt-2 pt-2">Gross profit<span class="tabular-nums text-emerald-600 dark:text-emerald-400">${finMoney(d.gross_profit)}</span></div>
    ${section('Expenses', d.expense_lines, d.expense)}
    <div class="flex items-center justify-between font-black text-lg border-t-2 border-slate-300 dark:border-slate-700 mt-2 pt-2">Net income<span class="tabular-nums ${Number(d.net_income) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${finMoney(d.net_income)}</span></div>
  </div>`;
}

async function acctFinBalance(el) {
  const d = await apiGetJson('/accounting/balance-sheet');
  const section = (title, lines, total) => `
    <div class="flex items-center justify-between text-[11px] uppercase font-bold tracking-wider text-slate-400 mt-3 mb-1">${title}<span>${finMoney(total)}</span></div>
    ${(lines || []).map(l => `<div class="flex items-center justify-between text-[13px] py-0.5"><span class="text-slate-600 dark:text-slate-300">${esc(l.name)}</span><span class="tabular-nums">${finMoney(l.amount)}</span></div>`).join('')}`;
  el.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-xl">
    ${section('Assets', d.asset_lines, d.assets)}
    ${section('Liabilities', d.liability_lines, d.liabilities)}
    ${section('Equity', d.equity_lines, d.equity - d.net_income)}
    <div class="flex items-center justify-between text-[13px] py-0.5"><span class="text-slate-600 dark:text-slate-300">Net income (current)</span><span class="tabular-nums">${finMoney(d.net_income)}</span></div>
    <div class="flex items-center justify-between font-black border-t-2 border-slate-300 dark:border-slate-700 mt-2 pt-2">Liabilities + Equity<span class="tabular-nums">${finMoney(d.liabilities + d.equity)}</span></div>
    <div class="text-[11px] mt-2 ${d.balanced ? 'text-emerald-500' : 'text-rose-500'} font-bold">${d.balanced ? ' Balance sheet balances' : ' Out of balance — check journals'}</div>
  </div>`;
}
async function acctFinForecast(el) {
  const d = await apiGetJson('/accounting/forecast');
  const a = d.actual || {}, p = d.pipeline || {}, f = d.forecast || {};
  const card = (label, val, tone) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">${label}</div>
    <div class="text-2xl font-black mt-1 ${tone || 'text-slate-900 dark:text-white'}">${finMoney(val)}</div></div>`;
  el.innerHTML = `
    <div class="text-[11px] text-slate-400 mb-2">Projected month-end · ${esc(d.month || '')}</div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${card('Forecast Revenue', f.revenue)}
      ${card('Forecast Gross', f.gross_profit, 'text-emerald-600 dark:text-emerald-400')}
      ${card('Forecast Payroll', f.payroll, 'text-amber-600 dark:text-amber-400')}
      ${card('Forecast Net', f.net_income, (Number(f.net_income) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'))}
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Sold, undelivered</div><div class="text-2xl font-black mt-1">${p.sold_undelivered || 0}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Open deals</div><div class="text-2xl font-black mt-1">${p.open_deals || 0}</div></div>
      ${card('Expected gross (pipeline)', p.expected_gross)}
      ${card('Expected commission', p.expected_commission, 'text-amber-600 dark:text-amber-400')}
    </div>
    <div class="mt-3 text-[12px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
      Posted MTD so far: revenue ${finMoney(a.revenue)} · gross ${finMoney(a.gross_profit)} · expenses ${finMoney(a.expense)}.
      <div class="mt-1 text-slate-400">${esc(d.note || '')}</div>
    </div>`;
}

async function acctFinPeriods(el) {
  const d = await apiGetJson('/accounting/periods');
  const flow = d.flow || [];
  const label = (s) => ({ open: 'Open', manager_approved: 'Manager approved', controller_approved: 'Controller approved', closed: 'Closed', locked: 'Locked' }[s] || s);
  const nextOf = (s) => { const i = flow.indexOf(s); return (i >= 0 && i < flow.length - 1) ? flow[i + 1] : null; };
  const rows = (d.periods || []).map(pr => {
    const nx = nextOf(pr.status);
    const btn = nx ? `<button onclick="acctPeriodAdvance('${pr.period}')" class="text-[12px] font-bold text-white px-3 py-1.5 rounded-lg ${nx === 'locked' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}">${nx === 'locked' ? 'Lock period' : '→ ' + label(nx)}</button>` : `<span class="text-[11px] font-bold text-rose-500 flex items-center gap-1">${svgIcon('shield', 'w-3.5 h-3.5')}Locked</span>`;
    const tone = pr.status === 'locked' ? 'text-rose-500' : pr.status === 'closed' ? 'text-amber-500' : 'text-slate-500';
    return `<tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="px-3 py-2 font-bold">${esc(pr.period)}</td>
      <td class="px-3 py-2"><span class="font-semibold ${tone}">${label(pr.status)}</span></td>
      <td class="px-3 py-2 text-right">${btn}</td></tr>`;
  }).join('');
  el.innerHTML = `
    <div class="text-[12px] text-slate-500 dark:text-slate-400 mb-3">Close the books each month: Open → Manager approved → Controller approved → Closed → Locked. After lock, no posting or edits — corrections are reversing journal entries only.</div>
    <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl">
      <table class="w-full text-sm"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
        <th class="px-3 py-2">Period</th><th class="px-3 py-2">Status</th><th class="px-3 py-2 text-right">Action</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="px-3 py-8 text-center text-slate-400">No periods yet.</td></tr>'}</tbody></table></div>`;
}
async function acctPeriodAdvance(period) {
  const flowNext = { open: 'manager approved', manager_approved: 'controller approved', controller_approved: 'closed', closed: 'locked' };
  if (!confirm(`Advance ${period}? This moves the period forward and, once locked, prevents any further posting.`)) return;
  try { const r = await apiSendJson('/accounting/periods/advance', 'POST', { period }); showToast(`Period ${period} → ${r.status}`, 'success'); acctLoadFinancials(); }
  catch (e) { showToast(e.message || 'Could not advance', 'error'); }
}
window.acctFinForecast = acctFinForecast; window.acctFinPeriods = acctFinPeriods; window.acctPeriodAdvance = acctPeriodAdvance;
window.acctLoadFinancials = acctLoadFinancials;

// ── Affiliates admin (MarketSync owner) ──────────────────────────────────────
// Affiliates admin renders through the Engine Shell (registered after the shell
// framework loads, below). This thin wrapper is what switchPage calls.
function loadAffiliatesAdmin() { renderEngine('affiliates-admin'); }
function affAdminEdit(a) {
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="text-lg font-black text-slate-900 dark:text-white">${esc(a.name || a.email)}</div>
    <div class="grid grid-cols-2 gap-3">
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Commission %</label><input id="aff-rate" type="number" step="1" value="${a.rate_pct}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Months (0 = lifetime)</label><input id="aff-months" type="number" step="1" value="${a.rate_months}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    </div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
      <select id="aff-status" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="active" ${a.status === 'active' ? 'selected' : ''}>Active</option><option value="suspended" ${a.status === 'suspended' ? 'selected' : ''}>Suspended</option></select></div>
    <div class="flex justify-end gap-2 pt-1"><button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="affAdminSave('${a.id}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button></div>
  </div>`, 'max-w-md');
}
async function affAdminSave(id, btn) {
  btn.disabled = true;
  try {
    await apiSendJson('/affiliate/admin/update', 'POST', { affiliate_id: id, rate_pct: parseFloat(document.getElementById('aff-rate').value), rate_months: parseInt(document.getElementById('aff-months').value), status: document.getElementById('aff-status').value });
    showToast('Affiliate updated', 'success'); btn.closest('.fixed').remove(); loadAffiliatesAdmin();
  } catch (e) { btn.disabled = false; showToast(e.message || 'Could not save', 'error'); }
}
async function affAdminPay(id, amount) {
  if (!confirm(`Mark ${commMoney(amount)} as paid to this affiliate? This posts the payout as a MarketSync expense.`)) return;
  try { const r = await apiSendJson('/affiliate/admin/pay', 'POST', { affiliate_id: id }); showToast(`Paid ${commMoney(r.paid)} (${r.count} commissions)`, 'success'); loadAffiliatesAdmin(); }
  catch (e) { showToast(e.message || 'Could not pay out', 'error'); }
}
window.loadAffiliatesAdmin = loadAffiliatesAdmin; window.affAdminEdit = affAdminEdit; window.affAdminSave = affAdminSave; window.affAdminPay = affAdminPay;

async function acctLoadToday() {
  const body = document.getElementById('acct-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading…</div>';
  try {
    const [acc, entriesR, recon] = await Promise.all([
      __acctState.accounts.length ? Promise.resolve({ accounts: __acctState.accounts }) : apiGetJson('/accounting/accounts'),
      apiGetJson(`/accounting/entries?from=${acctToday()}&to=${acctToday()}`),
      apiSendJson('/accounting/reconcile', 'POST', { date: acctToday(), alert: false }),
    ]);
    __acctState.accounts = acc.accounts || __acctState.accounts;
    const entries = entriesR.entries || [];
    const r = recon.reconciliation || {};
    const acctName = (id) => (__acctState.accounts.find(a => a.id === id) || {}).name || '—';
    const off = r.status === 'off';
    const banner = `<div class="rounded-xl p-4 ${off ? 'bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800' : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'}">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div><div class="font-black ${off ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}">${off ? ' Books don’t reconcile' : ' Day balances'}</div>
          <div class="text-[12px] text-slate-600 dark:text-slate-400 mt-0.5">${esc(r.detail?.note || '')}</div></div>
        <button onclick="acctLoadToday()" class="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">Re-run</button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 text-center">
        ${[['Delivered', r.deals_delivered || 0], ['Income posted', commMoney(r.income_posted)], ['Deposits in', commMoney(r.recorded_cash)], ['Expenses', commMoney(r.expenses_total)], ['Variance', commMoney(r.variance)]].map(([l, v]) => `<div class="bg-white/70 dark:bg-slate-900/50 rounded-lg py-2"><div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">${l}</div><div class="font-black text-slate-900 dark:text-white">${v}</div></div>`).join('')}
      </div></div>`;
    const activeAccts = __acctState.accounts.filter(a => a.active);
    const addExpense = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Add an entry</div>
      <div class="grid sm:grid-cols-6 gap-2 items-end">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Money</label>
          <select id="acct-e-dir" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"><option value="out">Out (expense)</option><option value="in">In (income)</option></select></div>
        <div class="sm:col-span-1"><label class="block text-[11px] font-semibold text-slate-500 mb-1">Account</label>
          <select id="acct-e-account" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm">${activeAccts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Amount ($)</label><input id="acct-e-amount" type="number" step="0.01" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
        <div class="sm:col-span-2"><label class="block text-[11px] font-semibold text-slate-500 mb-1">Description</label><input id="acct-e-desc" type="text" placeholder="Vendor / memo" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
        <div><button onclick="acctAddEntry(this)" class="w-full text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg">Add</button></div>
      </div></div>`;
    const rows = entries.map(e => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="px-3 py-2">${acctName(e.account_id)}</td>
      <td class="px-3 py-2 text-slate-500">${esc(e.description || '')}</td>
      <td class="px-3 py-2"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${e.source === 'manual' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300'}">${e.source === 'manual' ? 'manual' : 'auto'}</span></td>
      <td class="px-3 py-2 text-right font-bold ${e.direction === 'out' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}">${e.direction === 'out' ? '-' : '+'}${commMoney(e.amount)}</td>
      <td class="px-3 py-2 text-right">${e.source === 'manual' ? `<button onclick="acctDelEntry('${e.id}')" class="text-rose-400 hover:text-rose-500 text-xs">Delete</button>` : ''}</td>
    </tr>`).join('');
    body.innerHTML = `
      <div class="flex items-center gap-2 mb-3"><input type="date" value="${acctToday()}" onchange="acctSetDate(this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      ${banner}
      <div class="mt-4">${addExpense}</div>
      <div class="mt-4 overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[560px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <th class="px-3 py-2">Account</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Type</th><th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2"></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400">No entries for this day yet.</td></tr>'}</tbody></table></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load the day.')}</div>`; }
}
async function acctAddEntry(btn) {
  const account_id = document.getElementById('acct-e-account')?.value;
  const amount = parseFloat(document.getElementById('acct-e-amount')?.value || '0');
  const description = document.getElementById('acct-e-desc')?.value || '';
  const direction = document.getElementById('acct-e-dir')?.value === 'in' ? 'in' : 'out';
  if (!amount) { showToast('Enter an amount', 'error'); return; }
  btn.disabled = true;
  try { await apiSendJson('/accounting/entries', 'POST', { account_id, amount, description, direction, entry_date: acctToday() }); showToast('Entry added', 'success'); acctLoadToday(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not add', 'error'); }
}
async function acctDelEntry(id) {
  if (!confirm('Delete this entry?')) return;
  try { await apiSendJson(`/accounting/entries/${id}`, 'DELETE'); acctLoadToday(); } catch (e) { showToast(e.message, 'error'); }
}
window.acctAddEntry = acctAddEntry; window.acctDelEntry = acctDelEntry;

async function acctLoadInsights() {
  const body = document.getElementById('acct-body'); if (!body) return;
  try {
    const d = await apiGetJson(`/accounting/report?month=${acctMonth()}`);
    const lineRows = (arr) => arr.length ? arr.map(l => `<div class="flex justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0"><span>${esc(l.name)}</span><span class="font-semibold">${commMoney(l.total)}</span></div>`).join('') : '<div class="text-sm text-slate-400 py-2">Nothing yet.</div>';
    body.innerHTML = `
      <div class="flex items-center gap-2 mb-3"><input type="month" value="${acctMonth()}" onchange="__acctState.date=this.value+'-01'; acctLoadInsights()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Income</div><div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${commMoney(d.income)}</div></div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Expenses</div><div class="text-2xl font-black text-rose-500 mt-1">${commMoney(d.expense)}</div></div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Net</div><div class="text-2xl font-black mt-1">${commMoney(d.net)}</div></div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="font-bold mb-2">Income</div>${lineRows(d.income_lines || [])}</div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="font-bold mb-2">Expenses</div>${lineRows(d.expense_lines || [])}</div>
      </div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
let __acctAccountsTarget = 'acct-body';
async function acctLoadAccounts(target) {
  __acctAccountsTarget = target || 'acct-body';
  const body = document.getElementById(__acctAccountsTarget); if (!body) return;
  try {
    const d = await apiGetJson('/accounting/accounts');
    __acctState.accounts = d.accounts || [];
    const cat = (c) => ({ income: 'Income', expense: 'Expense', asset: 'Asset', liability: 'Liability', equity: 'Equity' }[c] || c);
    const rows = __acctState.accounts.map(a => `<tr class="border-b border-slate-100 dark:border-slate-800/60 ${a.active ? '' : 'opacity-50'}">
      <td class="px-3 py-2 font-mono text-xs">${esc(a.code || '')}</td>
      <td class="px-3 py-2 font-semibold">${esc(a.name)}</td>
      <td class="px-3 py-2 text-slate-500">${cat(a.category)}${a.system_key ? ' · auto' : ''}</td>
      <td class="px-3 py-2 text-right"><button onclick="acctToggleAccount('${a.id}', ${a.active ? 'false' : 'true'})" class="text-xs font-bold text-slate-500 hover:text-slate-700">${a.active ? 'Deactivate' : 'Activate'}</button>${a.system_key ? '' : ` <button onclick="acctDelAccount('${a.id}')" class="text-xs font-bold text-rose-400 hover:text-rose-500 ml-2">Delete</button>`}</td>
    </tr>`).join('');
    body.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4">
        <div class="text-sm font-bold mb-2">Add an account</div>
        <div class="grid sm:grid-cols-4 gap-2 items-end">
          <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Code</label><input id="acct-a-code" type="text" placeholder="6500" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
          <div class="sm:col-span-1"><label class="block text-[11px] font-semibold text-slate-500 mb-1">Name</label><input id="acct-a-name" type="text" placeholder="Detailing" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
          <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Category</label><select id="acct-a-cat" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"><option value="expense">Expense</option><option value="income">Income</option><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option></select></div>
          <div><button onclick="acctAddAccount(this)" class="w-full text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg">Add</button></div>
        </div></div>
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[520px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Code</th><th class="px-3 py-2">Name</th><th class="px-3 py-2">Category</th><th class="px-3 py-2"></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
async function acctAddAccount(btn) {
  const name = document.getElementById('acct-a-name')?.value.trim();
  const category = document.getElementById('acct-a-cat')?.value;
  const code = document.getElementById('acct-a-code')?.value.trim();
  if (!name) { showToast('Name the account', 'error'); return; }
  btn.disabled = true;
  try { await apiSendJson('/accounting/accounts', 'POST', { name, category, code }); showToast('Account added', 'success'); acctLoadAccounts(__acctAccountsTarget); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not add', 'error'); }
}
async function acctToggleAccount(id, active) { try { await apiSendJson(`/accounting/accounts/${id}`, 'PUT', { active }); acctLoadAccounts(__acctAccountsTarget); } catch (e) { showToast(e.message, 'error'); } }
async function acctDelAccount(id) { if (!confirm('Delete this account?')) return; try { await apiSendJson(`/accounting/accounts/${id}`, 'DELETE'); acctLoadAccounts(__acctAccountsTarget); } catch (e) { showToast(e.message, 'error'); } }
window.acctAddAccount = acctAddAccount; window.acctToggleAccount = acctToggleAccount; window.acctDelAccount = acctDelAccount;

// Expenses — where accounting adds the day's costs; lists the month's expenses.
// ── Dealer Operations expenses ───────────────────────────────────────────────
// A rich expense workspace: each expense links to a vendor, department, employee,
// VIN/stock, RO, PO, payment method and receipt, with the tax split out, an
// approval workflow, filters/search, dealer reports and CSV export.
let __expState = { filters: {}, options: null, vendors: [] };
const EXP_STATUS = { draft: ['Draft', 'bg-slate-100 dark:bg-slate-800 text-slate-500'], submitted: ['Pending', 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'], approved: ['Approved', 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'], rejected: ['Rejected', 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300'], paid: ['Paid', 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'] };
const expIsApprover = () => ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
function expTeam() { try { return Array.isArray(__dealerTeam) ? __dealerTeam : []; } catch { return []; } }
function expFilterQS() {
  const f = __expState.filters, m = f.month || acctMonth();
  const p = new URLSearchParams();
  p.set('from', m + '-01'); p.set('to', m + '-31');
  ['category', 'department', 'status', 'vin', 'q', 'employee_id'].forEach(k => { if (f[k]) p.set(k, f[k]); });
  return p.toString();
}
async function acctLoadExpenses() {
  const body = document.getElementById('acct-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading…</div>';
  try {
    if (!__expState.filters.month) __expState.filters.month = acctMonth();
    const [opts, vend, acc, list] = await Promise.all([
      __expState.options ? Promise.resolve({ ...__expState.options }) : apiGetJson('/expenses/options'),
      apiGetJson('/expense-vendors'),
      __acctState.accounts.length ? Promise.resolve({ accounts: __acctState.accounts }) : apiGetJson('/accounting/accounts'),
      apiGetJson('/expenses?' + expFilterQS()),
    ]);
    __expState.options = opts; __expState.vendors = vend.vendors || [];
    __acctState.accounts = acc.accounts || __acctState.accounts;
    const f = __expState.filters;
    const sel = (id, val, options, blank) => `<select id="${id}" onchange="expSetFilter('${val}', this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="">${blank}</option>${options.map(o => `<option value="${esc(o)}" ${f[val] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    const rows = (list.expenses || []).map(e => {
      const st = EXP_STATUS[e.status] || EXP_STATUS.submitted;
      return `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="px-3 py-2 whitespace-nowrap">${e.expense_date}</td>
        <td class="px-3 py-2">${esc(e.vendor || '—')}${e.receipt_url ? ` <a href="${esc(e.receipt_url)}" target="_blank" title="Receipt" class="text-indigo-500 inline-flex align-middle">${svgIcon("paperclip","w-3.5 h-3.5")}</a>` : ''}</td>
        <td class="px-3 py-2 text-slate-500">${esc(e.category || '—')}</td>
        <td class="px-3 py-2 text-slate-500">${esc(e.department || '—')}</td>
        <td class="px-3 py-2 text-slate-500 whitespace-nowrap">${esc(e.stock_number || e.vin || '—')}</td>
        <td class="px-3 py-2 text-slate-500">${esc(e.employee_name || '—')}</td>
        <td class="px-3 py-2 text-right font-bold text-rose-500 whitespace-nowrap">${commMoney(e.amount)}${Number(e.tax) ? `<span class="block text-[10px] font-normal text-slate-400">tax ${commMoney(e.tax)}</span>` : ''}</td>
        <td class="px-3 py-2"><span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${st[1]}">${st[0]}</span></td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          ${(expIsApprover() && (e.status === 'submitted' || e.status === 'draft')) ? `<button onclick="expApprove('${e.id}')" class="text-emerald-500 hover:text-emerald-600 text-xs font-bold mr-1.5">Approve</button><button onclick="expReject('${e.id}')" class="text-rose-400 hover:text-rose-500 text-xs mr-1.5">Reject</button>` : ''}
          <button onclick="expModal('${e.id}')" class="text-indigo-500 hover:text-indigo-600 text-xs font-bold">Open</button>
        </td></tr>`;
    }).join('');
    body.innerHTML = `
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <input type="month" value="${f.month}" onchange="expSetFilter('month', this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
        <input id="exp-search" value="${esc(f.q || '')}" oninput="clearTimeout(window.__expQT); window.__expQT=setTimeout(()=>expSetFilter('q', this.value), 400)" placeholder="Search vendor, VIN, notes…" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]">
        ${sel('exp-f-dept', 'department', opts.departments, 'All depts')}
        ${sel('exp-f-cat', 'category', opts.categories, 'All categories')}
        ${sel('exp-f-status', 'status', opts.statuses, 'Any status')}
        <div class="flex-1"></div>
        <button onclick="expGenerateRecurring(this)" title="Create this month's recurring expenses" class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">${svgIcon('refresh', 'w-3.5 h-3.5')}Recurring</button>
        <button onclick="expReports()" class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">${svgIcon('chart', 'w-3.5 h-3.5')}Reports</button>
        <button onclick="expExport()" class="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">${svgIcon('download', 'w-3.5 h-3.5')}Export</button>
        <button onclick="expModal()" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">+ Add expense</button>
      </div>
      <div class="text-sm text-slate-500 mb-2">${list.count || 0} expense${list.count === 1 ? '' : 's'} · Total <b class="text-slate-700 dark:text-slate-200">${commMoney(list.sum || 0)}</b></div>
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[900px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Date</th><th class="px-3 py-2">Vendor</th><th class="px-3 py-2">Category</th><th class="px-3 py-2">Dept</th><th class="px-3 py-2">Stock/VIN</th><th class="px-3 py-2">Employee</th><th class="px-3 py-2 text-right">Amount</th><th class="px-3 py-2">Status</th><th class="px-3 py-2"></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9" class="px-3 py-8 text-center text-slate-400">No expenses match — add one, or scan a receipt.</td></tr>'}</tbody></table></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
function expSetFilter(key, val) { __expState.filters[key] = val || undefined; acctLoadExpenses(); }

// Add / edit modal — every operational dimension in one place.
async function expModal(id) {
  let e = { expense_date: acctToday(), status: 'submitted', reimbursable: false, recurring: false };
  if (id) { try { const d = await apiGetJson(`/expenses/${id}`); e = d.expense || e; } catch { showToast('Could not load', 'error'); return; } }
  const opts = __expState.options || { categories: [], departments: [], payment_methods: [], recurrences: [] };
  const expAccts = (__acctState.accounts || []).filter(a => a.category === 'expense' && a.active);
  const ic = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const opt = (list, cur) => `<option value=""></option>` + list.map(o => `<option value="${esc(o)}" ${cur === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const team = expTeam();
  const events = Array.isArray(e.events) ? e.events : [];
  crmOverlay(`<div class="p-5 space-y-3" data-exp>
    <div class="flex items-center justify-between"><div class="text-lg font-black text-slate-900 dark:text-white">${id ? 'Expense' : 'New expense'}</div>
      <div class="flex items-center gap-2">
        <input id="exp-receipt-file" type="file" accept="image/*,application/pdf" capture="environment" class="hidden" onchange="expReceiptPick(this.files[0])">
        <button onclick="document.getElementById('exp-receipt-file').click()" class="flex items-center gap-1.5 text-xs font-bold bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 hover:bg-violet-200 px-3 py-1.5 rounded-lg">${svgIcon('camera', 'w-4 h-4')}Scan / attach receipt</button>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </div>
    <div id="exp-receipt-note" class="text-[11px] ${e.receipt_url ? '' : 'hidden'}">${e.receipt_url ? `<a href="${esc(e.receipt_url)}" target="_blank" class="text-indigo-500 font-bold">${svgIcon("paperclip","w-3.5 h-3.5 inline-block align-text-bottom")} Receipt attached — view</a>` : ''}</div>
    <input type="hidden" id="exp-receipt-url" value="${esc(e.receipt_url || '')}"><input type="hidden" id="exp-receipt-type" value="${esc(e.receipt_type || '')}">
    <div class="grid sm:grid-cols-3 gap-2">
      <div>${lbl('Date')}<input id="exp-date" type="date" value="${esc(e.expense_date || acctToday())}" class="${ic}"></div>
      <div>${lbl('Amount ($ total)')}<input id="exp-amount" type="number" step="0.01" value="${e.amount != null ? e.amount : ''}" class="${ic}"></div>
      <div>${lbl('Tax (GST/HST)')}<input id="exp-tax" type="number" step="0.01" value="${e.tax != null ? e.tax : ''}" class="${ic}"></div>
    </div>
    <div class="grid sm:grid-cols-3 gap-2">
      <div>${lbl('Vendor')}<input id="exp-vendor" list="exp-vendor-list" value="${esc(e.vendor || '')}" placeholder="Supplier" class="${ic}"><datalist id="exp-vendor-list">${__expState.vendors.map(v => `<option value="${esc(v.name)}">`).join('')}</datalist></div>
      <div>${lbl('Category')}<select id="exp-category" class="${ic}">${opt(opts.categories, e.category)}</select></div>
      <div>${lbl('Department')}<select id="exp-department" class="${ic}">${opt(opts.departments, e.department)}</select></div>
    </div>
    <div class="grid sm:grid-cols-3 gap-2">
      <div>${lbl('Employee (who spent)')}<input id="exp-employee" list="exp-emp-list" value="${esc(e.employee_name || '')}" placeholder="Name" class="${ic}"><datalist id="exp-emp-list">${team.map(t => `<option value="${esc(t.full_name || t.display_name || '')}">`).join('')}</datalist></div>
      <div>${lbl('GL / cost-centre account')}<select id="exp-gl" class="${ic}"><option value=""></option>${expAccts.map(a => `<option value="${a.id}" ${e.gl_account_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div>${lbl('Payment method')}<select id="exp-pay" class="${ic}">${opt(opts.payment_methods, e.payment_method)}</select></div>
    </div>
    <div class="grid sm:grid-cols-4 gap-2">
      <div>${lbl('VIN')}<input id="exp-vin" value="${esc(e.vin || '')}" class="${ic}"></div>
      <div>${lbl('Stock #')}<input id="exp-stock" value="${esc(e.stock_number || '')}" class="${ic}"></div>
      <div>${lbl('Repair order #')}<input id="exp-ro" value="${esc(e.repair_order || '')}" class="${ic}"></div>
      <div>${lbl('PO #')}<input id="exp-po" value="${esc(e.po_number || '')}" class="${ic}"></div>
    </div>
    <div class="grid sm:grid-cols-4 gap-2">
      <div>${lbl('Card last 4')}<input id="exp-card" maxlength="4" value="${esc(e.card_last4 || '')}" class="${ic}"></div>
      <div>${lbl('Mileage (km)')}<input id="exp-km" type="number" step="0.1" value="${e.mileage_km != null ? e.mileage_km : ''}" class="${ic}"></div>
      <div>${lbl('$ / km')}<input id="exp-rate" type="number" step="0.01" value="${e.mileage_rate != null ? e.mileage_rate : ''}" placeholder="0.70" class="${ic}"></div>
      <div>${lbl('Recurrence')}<select id="exp-recurrence" class="${ic}">${opt(opts.recurrences, e.recurrence)}</select></div>
    </div>
    <div class="flex flex-wrap items-center gap-4">
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input id="exp-reimb" type="checkbox" class="accent-indigo-600" ${e.reimbursable ? 'checked' : ''}>Reimbursable to employee</label>
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input id="exp-recurring" type="checkbox" class="accent-indigo-600" ${e.recurring ? 'checked' : ''}>Recurring</label>
      ${expIsApprover() && e.status !== 'approved' ? `<label class="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><input id="exp-approve" type="checkbox" class="accent-emerald-600">Approve now</label>` : ''}
    </div>
    <div>${lbl('Notes')}<textarea id="exp-notes" rows="2" class="${ic}" placeholder="Memo, PO details, etc.">${esc(e.notes || '')}</textarea></div>
    ${id && events.length ? `<details class="text-[11px] text-slate-400"><summary class="cursor-pointer font-bold">Audit trail (${events.length})</summary><div class="mt-1 space-y-0.5">${events.slice().reverse().map(v => `<div>${new Date(v.at).toLocaleString()} · <b>${esc(v.action)}</b>${v.detail ? ' · ' + esc(v.detail) : ''}</div>`).join('')}</div></details>` : ''}
    <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
      ${id ? `<button onclick="expDelete('${id}')" class="text-xs font-bold text-rose-500 hover:text-rose-400 px-2 py-2">Delete</button>${e.reimbursable && !e.reimbursed ? `<button onclick="expMarkReimb('${id}')" class="text-xs font-bold text-indigo-500 hover:text-indigo-600 px-2 py-2">Mark reimbursed</button>` : ''}` : ''}
      <div class="flex-1"></div>
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-3 py-2">Cancel</button>
      <button onclick="expSave('${id || ''}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button>
    </div>
  </div>`, 'max-w-2xl');
}
function expVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
async function expSave(id, btn) {
  const team = expTeam();
  const empName = expVal('exp-employee');
  const emp = team.find(t => (t.full_name || t.display_name || '').toLowerCase() === empName.toLowerCase());
  const body = {
    expense_date: expVal('exp-date'), amount: parseFloat(expVal('exp-amount')) || 0, tax: parseFloat(expVal('exp-tax')) || 0,
    vendor: expVal('exp-vendor'), category: expVal('exp-category'), department: expVal('exp-department'),
    employee_name: empName || null, employee_id: emp ? emp.id : null,
    gl_account_id: expVal('exp-gl') || null, payment_method: expVal('exp-pay') || null, card_last4: expVal('exp-card') || null,
    vin: expVal('exp-vin') || null, stock_number: expVal('exp-stock') || null, repair_order: expVal('exp-ro') || null, po_number: expVal('exp-po') || null,
    mileage_km: expVal('exp-km') ? parseFloat(expVal('exp-km')) : null, mileage_rate: expVal('exp-rate') ? parseFloat(expVal('exp-rate')) : null,
    recurrence: expVal('exp-recurrence') || null, recurring: !!document.getElementById('exp-recurring')?.checked,
    reimbursable: !!document.getElementById('exp-reimb')?.checked, notes: expVal('exp-notes') || null,
    receipt_url: expVal('exp-receipt-url') || null, receipt_type: expVal('exp-receipt-type') || null,
  };
  if (document.getElementById('exp-approve')?.checked) body.status = 'approved';
  if (!body.amount && !(body.mileage_km && body.mileage_rate)) { showToast('Enter an amount (or mileage)', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    if (id) await apiSendJson(`/expenses/${id}`, 'PUT', body); else await apiSendJson('/expenses', 'POST', body);
    showToast('Saved ', 'success'); btn.closest('.fixed')?.remove(); acctLoadExpenses();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
// Receipt in the modal: an image is OCR-scanned to prefill; a PDF just attaches. Both upload for the record.
async function expReceiptPick(file) {
  if (!file) return;
  const isImg = (file.type || '').startsWith('image/');
  showToast(isImg ? 'Reading receipt…' : 'Attaching…', 'info');
  try {
    // 1) OCR prefill for images.
    if (isImg) {
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      try {
        const d = await apiSendJson('/accounting/scan-receipt', 'POST', { image: dataUrl, categories: (__expState.options?.categories) || [] }, { timeoutMs: 40000 });
        const f = d.fields || {}; const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
        if (f.date) set('exp-date', f.date); if (f.total != null) set('exp-amount', f.total); if (f.tax != null) set('exp-tax', f.tax); if (f.vendor) set('exp-vendor', f.vendor);
        if (f.category) { const s = document.getElementById('exp-category'); if (s) { const o = [...s.options].find(o => o.value.toLowerCase() === String(f.category).toLowerCase()); if (o) s.value = o.value; } }
      } catch (e) { /* OCR may be off (no AI Boost) — still attach below */ }
    }
    // 2) Upload the file so it's stored on the record.
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`${API}/expenses/upload-receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    document.getElementById('exp-receipt-url').value = d.url; document.getElementById('exp-receipt-type').value = d.type || '';
    const note = document.getElementById('exp-receipt-note'); if (note) { note.classList.remove('hidden'); note.innerHTML = `<a href="${esc(d.url)}" target="_blank" class="text-indigo-500 font-bold">${svgIcon("paperclip","w-3.5 h-3.5 inline-block align-text-bottom")} Receipt attached — view</a>`; }
    showToast('Receipt attached ', 'success');
  } catch (e) { showToast(e.message || 'Could not attach receipt', 'error'); }
}
async function expApprove(id) { try { await apiSendJson(`/expenses/${id}/approve`, 'POST', {}); showToast('Approved ', 'success'); acctLoadExpenses(); } catch (e) { showToast(e.message, 'error'); } }
async function expReject(id) { const note = prompt('Reason for rejecting (optional):') ?? ''; try { await apiSendJson(`/expenses/${id}/reject`, 'POST', { note }); showToast('Rejected', 'success'); acctLoadExpenses(); } catch (e) { showToast(e.message, 'error'); } }
async function expMarkReimb(id) { try { await apiSendJson(`/expenses/${id}/mark-reimbursed`, 'POST', {}); showToast('Marked reimbursed', 'success'); document.querySelector('.fixed[data-exp]')?.closest('.fixed')?.remove(); acctLoadExpenses(); } catch (e) { showToast(e.message, 'error'); } }
async function expDelete(id) { if (!confirm('Delete this expense? This also removes its ledger entry.')) return; try { await apiSendJson(`/expenses/${id}`, 'DELETE'); showToast('Deleted', 'success'); document.querySelector('[data-exp]')?.closest('.fixed')?.remove(); acctLoadExpenses(); } catch (e) { showToast(e.message, 'error'); } }
async function expExport() {
  try {
    showToast('Building CSV…', 'info');
    const r = await fetch(`${API}/expenses/export.csv?` + expFilterQS(), { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `expenses-${__expState.filters.month || acctMonth()}.csv`; a.click(); URL.revokeObjectURL(url);
  } catch (e) { showToast(e.message || 'Could not export', 'error'); }
}
async function expGenerateRecurring(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try { const d = await apiSendJson('/expenses/generate-recurring', 'POST', { month: __expState.filters.month || acctMonth() }); showToast(d.created ? `Created ${d.created} recurring expense${d.created === 1 ? '' : 's'}` : 'Nothing new to create', 'success'); acctLoadExpenses(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not generate', 'error'); }
}
const EXP_REPORTS = [['close', 'Daily close'], ['department', 'P&L by department'], ['employee', 'By salesperson'], ['vin', 'Recon per VIN'], ['vendor', 'Vendor spend'], ['category', 'Top categories'], ['reimbursements', 'Outstanding reimbursements'], ['tax', 'GST/HST summary'], ['payment', 'By payment method']];
async function expReports() {
  const btns = EXP_REPORTS.map(([t, l]) => `<button onclick="expRunReport('${t}', this)" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg">${l}</button>`).join('');
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between"><div class="text-lg font-black text-slate-900 dark:text-white">Expense reports</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-xs text-slate-500">For ${esc(__expState.filters.month || acctMonth())} (approved &amp; pending spend).</p>
    <div class="flex flex-wrap gap-1.5">${btns}</div>
    <div id="exp-report-out" class="pt-1"><div class="text-sm text-slate-400">Pick a report above.</div></div>
  </div>`, 'max-w-lg');
}
async function expRunReport(type, btn) {
  const out = document.getElementById('exp-report-out'); if (!out) return;
  out.innerHTML = '<div class="text-sm text-slate-400">Loading…</div>';
  const m = __expState.filters.month || acctMonth();
  try {
    if (type === 'close') {
      const c = await apiGetJson(`/expenses/checks?month=${m}`);
      const item = (ok, label, detail) => `<div class="flex items-center gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60"><span class="w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 ${ok ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}">${ok ? '' : '!'}</span><span class="text-sm flex-1">${label}</span><span class="text-xs font-bold text-slate-500">${detail}</span></div>`;
      out.innerHTML = `<div class="space-y-0.5">
        ${item(c.pending_count === 0, 'Expenses approved', c.pending_count ? `${c.pending_count} pending (${commMoney(c.pending_total)})` : 'all done')}
        ${item(c.missing_receipts.length === 0, 'Receipts attached', c.missing_receipts.length ? `${c.missing_receipts.length} missing` : 'all attached')}
        ${item(c.duplicates.length === 0, 'No duplicate expenses', c.duplicates.length ? `${c.duplicates.length} to review` : 'clean')}
        ${item(c.outstanding_count === 0, 'Reimbursements paid', c.outstanding_count ? `${commMoney(c.outstanding_total)} owed` : 'none owed')}
      </div>
      <div class="mt-2 text-sm text-slate-500">Month total: <b class="text-slate-700 dark:text-slate-200">${commMoney(c.total)}</b> across ${c.count} expenses.</div>
      ${c.missing_receipts.length ? `<div class="mt-3"><div class="text-[11px] font-bold uppercase text-slate-400 mb-1">Missing receipts</div>${c.missing_receipts.slice(0, 20).map(x => `<div class="text-xs flex justify-between py-0.5"><span>${x.date} · ${esc(x.vendor || x.category || '—')}</span><span class="font-bold">${commMoney(x.amount)}</span></div>`).join('')}</div>` : ''}
      ${c.duplicates.length ? `<div class="mt-3"><div class="text-[11px] font-bold uppercase text-slate-400 mb-1">Possible duplicates</div>${c.duplicates.slice(0, 20).map(x => `<div class="text-xs py-0.5">${esc(x.vendor)} · ${commMoney(x.amount)} · ${x.dates.join(' & ')}</div>`).join('')}</div>` : ''}`;
      return;
    }
    const d = await apiGetJson(`/expenses/report/${type}?from=${m}-01&to=${m}-31`);
    const r = d.result;
    const table = (rowsArr, keyLabel) => `<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-2 py-1.5">${keyLabel}</th><th class="px-2 py-1.5 text-right">Count</th><th class="px-2 py-1.5 text-right">Total</th></tr></thead><tbody>${rowsArr.map(x => `<tr class="border-b border-slate-100 dark:border-slate-800/60"><td class="px-2 py-1.5 font-medium">${esc(x.key)}${x.stock ? ` <span class="text-[10px] text-slate-400">${esc(x.stock)}</span>` : ''}</td><td class="px-2 py-1.5 text-right text-slate-500">${x.count}</td><td class="px-2 py-1.5 text-right font-bold">${commMoney(x.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="px-2 py-4 text-center text-slate-400">No data.</td></tr>'}</tbody></table></div>`;
    if (type === 'tax') {
      out.innerHTML = `<div class="grid grid-cols-3 gap-2 mb-3">${[['Total spend', r.total_spend], ['Taxable base', r.taxable_base], ['GST/HST', r.total_tax]].map(([l, v]) => `<div class="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-center"><div class="text-[11px] text-slate-500">${l}</div><div class="text-base font-black">${commMoney(v)}</div></div>`).join('')}</div>${table(r.by_category, 'Category')}`;
    } else if (type === 'reimbursements') {
      out.innerHTML = `<div class="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 mb-3 text-sm"><b>${commMoney(r.outstanding_total)}</b> outstanding to employees.</div>${table(r.by_employee, 'Employee')}`;
    } else {
      out.innerHTML = table(r, type === 'department' ? 'Department' : type === 'employee' ? 'Employee' : type === 'vin' ? 'VIN' : type === 'vendor' ? 'Vendor' : type === 'payment' ? 'Method' : 'Category');
    }
  } catch (e) { out.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
Object.assign(window, { expSetFilter, expModal, expSave, expReceiptPick, expApprove, expReject, expMarkReimb, expDelete, expExport, expReports, expRunReport, expGenerateRecurring });

// ── Dealer Task Board ────────────────────────────────────────────────────────
// The shared operational board: detail, fuel, plates, safety, photos, parts,
// transport, deliver… assignee + due + priority + status + photos, linked to a
// VIN/stock and a customer. Replaces the whiteboard and the group texts.
let __taskState = { filters: {}, options: null };
const TASK_COLS = [['todo', 'To do'], ['in_progress', 'In progress'], ['blocked', 'Blocked'], ['done', 'Done']];
const TASK_PRI = { urgent: 'border-l-rose-500', high: 'border-l-amber-500', normal: 'border-l-slate-300 dark:border-l-slate-600', low: 'border-l-slate-200 dark:border-l-slate-700' };
const TASK_KIND_ICON = { Detail: 'sparkles', Fuel: 'fuel', Plates: 'tag', Safety: 'shield', Wash: 'droplet', Photos: 'camera', Parts: 'wrench', Transport: 'truck', Call: 'phone', Deliver: 'key', Other: 'clipboard' };
function taskTeamName(id) { const t = expTeam().find(x => x.id === id); return t ? (t.full_name || t.display_name || '') : ''; }
async function loadTaskBoard() {
  const root = document.getElementById('taskboard-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading…</div>';
  try {
    const f = __taskState.filters;
    const qs = new URLSearchParams();
    ['status', 'assignee_id', 'kind', 'q'].forEach(k => { if (f[k]) qs.set(k, f[k]); });
    if (f.mine) qs.set('mine', '1');
    const [opts, list] = await Promise.all([
      __taskState.options ? Promise.resolve(__taskState.options) : apiGetJson('/dealer-tasks/options'),
      apiGetJson('/dealer-tasks?' + qs.toString()),
    ]);
    __taskState.options = opts;
    const tasks = list.tasks || [];
    const team = expTeam();
    const t0 = acctToday();
    const card = (e) => {
      const overdue = e.due_date && e.due_date < t0 && e.status !== 'done';
      const icon = TASK_KIND_ICON[e.kind] || 'clipboard';
      const veh = e.stock_number || e.vin;
      return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${TASK_PRI[e.priority] || TASK_PRI.normal} rounded-lg p-2.5 mb-2 cursor-pointer hover:shadow-sm" onclick="taskModal('${e.id}')">
        <div class="flex items-start gap-2">
          <span class="text-slate-400 dark:text-slate-500 mt-0.5">${svgIcon(icon, 'w-4 h-4')}</span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${esc(e.title)}</div>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              ${e.kind ? `<span>${esc(e.kind)}</span>` : ''}
              ${veh ? `<span class="font-mono">${esc(veh)}</span>` : ''}
              ${e.contact_name ? `<span class="inline-flex items-center gap-1">${svgIcon('user', 'w-3 h-3')}${esc(e.contact_name)}</span>` : ''}
              ${e.assignee_name ? `<span class="inline-flex items-center gap-1">${svgIcon('user', 'w-3 h-3')}${esc(e.assignee_name)}</span>` : ''}
              ${e.due_date ? `<span class="inline-flex items-center gap-1 ${overdue ? 'text-rose-500 font-bold' : ''}">${svgIcon('calendar', 'w-3 h-3')}${e.due_date}${overdue ? ' (overdue)' : ''}</span>` : ''}
              ${(Array.isArray(e.photos) && e.photos.length) ? `<span class="inline-flex items-center gap-0.5">${svgIcon('paperclip', 'w-3 h-3')}${e.photos.length}</span>` : ''}
              ${e.inventory_id ? `<span class="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold">${svgIcon('wrench', 'w-3 h-3')}Cleanup</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 mt-2" onclick="event.stopPropagation()">
          ${e.status !== 'done' ? `<button onclick="taskSetStatus('${e.id}','done')" class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-500">${svgIcon('check', 'w-3.5 h-3.5')}Done</button>` : `<button onclick="taskSetStatus('${e.id}','todo')" class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-slate-600">${svgIcon('reopen', 'w-3.5 h-3.5')}Reopen</button>`}
          ${e.status === 'todo' ? `<button onclick="taskSetStatus('${e.id}','in_progress')" class="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-500 hover:text-indigo-600">${svgIcon('play', 'w-3.5 h-3.5')}Start</button>` : ''}
        </div>
      </div>`;
    };
    const cols = TASK_COLS.map(([st, label]) => {
      const items = tasks.filter(t => t.status === st);
      return `<div class="flex-1 min-w-[220px]">
        <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center justify-between"><span>${label}</span><span class="text-slate-300 dark:text-slate-600">${items.length}</span></div>
        <div>${items.map(card).join('') || '<div class="text-[11px] text-slate-400 italic px-1">—</div>'}</div>
      </div>`;
    }).join('');
    const teamOpts = team.map(t => `<option value="${t.id}" ${f.assignee_id === t.id ? 'selected' : ''}>${esc(t.full_name || t.display_name || '')}</option>`).join('');
    const kindQuick = ['Detail', 'Fuel', 'Plates', 'Safety', 'Photos', 'Transport', 'Deliver'].map(k => `<button onclick="taskModal(null, {kind:'${k}', title:'${k}'})" class="inline-flex items-center gap-1.5 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full">${svgIcon(TASK_KIND_ICON[k], 'w-3.5 h-3.5')}${k}</button>`).join('');
    root.innerHTML = `
      <div><h1 class="text-2xl font-black text-slate-900 dark:text-white">Task Board</h1><p class="text-sm text-slate-500 dark:text-slate-400">Every job to get a car ready — assigned, tracked, done. Detail, fuel, plates, transport, delivery and more.</p></div>
      <div class="flex flex-wrap items-center gap-2">
        <input value="${esc(f.q || '')}" oninput="clearTimeout(window.__taskQT); window.__taskQT=setTimeout(()=>taskSetFilter('q', this.value), 400)" placeholder="Search title, VIN, customer…" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]">
        <select onchange="taskSetFilter('assignee_id', this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="">Anyone</option>${teamOpts}</select>
        <label class="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300"><input type="checkbox" ${f.mine ? 'checked' : ''} onchange="taskSetFilter('mine', this.checked?'1':'')" class="accent-indigo-600">Mine</label>
        <div class="flex-1"></div>
        <button onclick="taskModal()" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">+ New task</button>
      </div>
      <div class="flex flex-wrap gap-1.5">${kindQuick}</div>
      <div class="flex flex-col md:flex-row gap-4">${cols}</div>`;
    taskUpdateBadge();
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}
function taskSetFilter(k, v) { __taskState.filters[k] = v || undefined; loadTaskBoard(); }
async function taskModal(id, prefill) {
  let e = { priority: 'normal', status: 'todo', due_date: acctToday(), photos: [], ...(prefill || {}) };
  if (id) { try { const d = await apiGetJson(`/dealer-tasks/${id}`); e = d.task || e; } catch { showToast('Could not load', 'error'); return; } }
  const opts = __taskState.options || { kinds: [], priorities: [], statuses: [] };
  const team = expTeam();
  const ic = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const sel = (id2, list, cur, blank) => `<select id="${id2}" class="${ic}">${blank ? `<option value="">${blank}</option>` : ''}${list.map(o => `<option value="${esc(o)}" ${cur === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const photos = Array.isArray(e.photos) ? e.photos : [];
  crmOverlay(`<div class="p-5 space-y-3" data-task>
    <div class="flex items-center justify-between"><div class="text-lg font-black text-slate-900 dark:text-white">${id ? 'Task' : 'New task'}</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div>${lbl('Task')}<input id="task-title" value="${esc(e.title || '')}" placeholder="e.g. Detail and photograph" class="${ic}"></div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div>${lbl('Type')}${sel('task-kind', opts.kinds, e.kind, '—')}</div>
      <div>${lbl('Department')}${sel('task-department', opts.departments || [], e.department, '—')}</div>
      <div>${lbl('Priority')}${sel('task-priority', opts.priorities, e.priority || 'normal')}</div>
      <div>${lbl('Status')}${sel('task-status', opts.statuses, e.status || 'todo')}</div>
    </div>
    <div class="grid sm:grid-cols-3 gap-2">
      <div>${lbl('Assign to')}<select id="task-assignee" class="${ic}"><option value="">Unassigned</option>${team.map(t => `<option value="${t.id}" ${e.assignee_id === t.id ? 'selected' : ''}>${esc(t.full_name || t.display_name || '')}</option>`).join('')}</select></div>
      <div>${lbl('Due')}<input id="task-due" type="date" value="${esc(e.due_date || '')}" class="${ic}"></div>
      <div>${lbl('Stock #')}<input id="task-stock" value="${esc(e.stock_number || '')}" class="${ic}"></div>
    </div>
    <div class="grid sm:grid-cols-2 gap-2">
      <div>${lbl('VIN')}<input id="task-vin" value="${esc(e.vin || '')}" class="${ic}"></div>
      <div>${lbl('Customer')}<input id="task-contact" value="${esc(e.contact_name || '')}" placeholder="Name" class="${ic}"></div>
    </div>
    <p class="text-[11px] text-slate-400 -mt-1">Tie the task to a vehicle, a customer, or a department. Internal work (service, lot, facilities) just needs a department.</p>
    <div>${lbl('Notes')}<textarea id="task-notes" rows="2" class="${ic}">${esc(e.notes || '')}</textarea></div>
    <div>
      <div class="flex items-center justify-between mb-1"><span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Photos</span>
        <input id="task-photo-file" type="file" accept="image/*" capture="environment" class="hidden" onchange="taskPhotoPick(this.files[0])">
        <button onclick="document.getElementById('task-photo-file').click()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">+ Add photo</button></div>
      <div id="task-photos" class="flex flex-wrap gap-1.5">${photos.map(u => `<a href="${esc(u)}" target="_blank"><img src="${esc(u)}" class="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700"></a>`).join('')}</div>
      <input type="hidden" id="task-photos-json" value='${esc(JSON.stringify(photos))}'>
    </div>
    <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
      ${id ? `<button onclick="taskDelete('${id}')" class="text-xs font-bold text-rose-500 hover:text-rose-400 px-2 py-2">Delete</button>` : ''}
      <div class="flex-1"></div>
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-3 py-2">Cancel</button>
      <button onclick="taskSave('${id || ''}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button>
    </div>
  </div>`, 'max-w-xl');
}
async function taskPhotoPick(file) {
  if (!file) return; showToast('Uploading…', 'info');
  try {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch(`${API}/dealer-tasks/upload-photo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Upload failed');
    const inp = document.getElementById('task-photos-json'); const arr = JSON.parse(inp.value || '[]'); arr.push(d.url); inp.value = JSON.stringify(arr);
    const wrap = document.getElementById('task-photos'); wrap.insertAdjacentHTML('beforeend', `<a href="${esc(d.url)}" target="_blank"><img src="${esc(d.url)}" class="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700"></a>`);
    showToast('Photo added ', 'success');
  } catch (e) { showToast(e.message || 'Could not upload', 'error'); }
}
function tVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
async function taskSave(id, btn) {
  const title = tVal('task-title'); if (!title) { showToast('Enter a task', 'error'); return; }
  // A task must anchor to a vehicle, a customer, OR a department (internal work).
  const hasVehicle = !!(tVal('task-vin') || tVal('task-stock'));
  const hasCustomer = !!tVal('task-contact');
  const hasDept = !!tVal('task-department');
  if (!hasVehicle && !hasCustomer && !hasDept) { showToast('Tie the task to a vehicle, a customer, or a department', 'error'); document.getElementById('task-department')?.focus(); return; }
  const assignee_id = tVal('task-assignee') || null;
  const body = {
    title, kind: tVal('task-kind') || null, priority: tVal('task-priority') || 'normal', status: tVal('task-status') || 'todo',
    due_date: tVal('task-due') || null, assignee_id, assignee_name: assignee_id ? taskTeamName(assignee_id) : null,
    department: tVal('task-department') || null,
    stock_number: tVal('task-stock') || null, vin: tVal('task-vin') || null, contact_name: tVal('task-contact') || null,
    notes: tVal('task-notes') || null, photos: JSON.parse(document.getElementById('task-photos-json')?.value || '[]'),
  };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { if (id) await apiSendJson(`/dealer-tasks/${id}`, 'PUT', body); else await apiSendJson('/dealer-tasks', 'POST', body); showToast('Saved ', 'success'); btn.closest('.fixed')?.remove(); loadTaskBoard(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
async function taskSetStatus(id, status) { try { await apiSendJson(`/dealer-tasks/${id}`, 'PUT', { status }); loadTaskBoard(); } catch (e) { showToast(e.message, 'error'); } }
async function taskDelete(id) { if (!confirm('Delete this task?')) return; try { await apiSendJson(`/dealer-tasks/${id}`, 'DELETE'); document.querySelector('[data-task]')?.closest('.fixed')?.remove(); loadTaskBoard(); } catch (e) { showToast(e.message, 'error'); } }
async function taskUpdateBadge() {
  try {
    const s = await apiGetJson('/dealer-tasks/summary');
    const b = document.getElementById('taskboard-badge'); if (!b) return;
    const n = s.overdue || 0;
    if (n > 0) { b.textContent = n; b.classList.remove('hidden'); } else b.classList.add('hidden');
  } catch {}
}
Object.assign(window, { taskSetFilter, taskModal, taskSave, taskSetStatus, taskDelete, taskPhotoPick });

// ══ Operations — workflow exceptions dashboard + entity timelines (managers) ══
// Surfaces the workflow engine: open exceptions (stalled recon, unanswered leads,
// sold-not-delivered, overdue tasks, approvals waiting) and a live activity feed.
// Clicking any row opens the five-section entity panel (Summary / Timeline /
// Current State / Next Action / Related Records).
const OPS_SEV = {
  high:   { dot: 'bg-rose-500',   chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
  medium: { dot: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  low:    { dot: 'bg-slate-400',  chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const OPS_KIND_LABEL = {
  recon_stalled: 'Recon stalled', lead_unanswered: 'Lead unanswered', sold_not_delivered: 'Sold, not delivered',
  task_overdue: 'Task overdue', approval_waiting: 'Approval waiting', workflow: 'Workflow',
};
const ENTITY_ICON = { deal: 'currency', vehicle: 'car', customer: 'user', task: 'clipboard' };
function opsRelTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return d.toLocaleDateString();
}

// ══ Facebook Solo/Dealer — Marketplace Performance home ══════════════════════
async function loadSoloHome() {
  const root = document.getElementById('solo-home-root');
  if (!root) return;
  root.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading your marketplace…</div>`;
  let d;
  try { d = await apiGetJson('/marketplace/summary'); }
  catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 py-10 text-center">Couldn't load: ${esc(e.message)}</div>`; return; }
  const num = (v) => v == null ? '—' : Number(v).toLocaleString();
  const resp = d.avg_response_min == null ? '—'
    : d.avg_response_min < 60 ? `${d.avg_response_min} min`
    : `${(d.avg_response_min / 60).toFixed(1)} hr`;
  // Big hero tile + supporting tiles. Views/Messages show "—" until an FB insights
  // sync is connected (we never fabricate those numbers).
  // A stat tile. When `onclick` is supplied it renders as a button that drills in.
  const tile = (label, val, sub, accent, onclick) => `
    <${onclick ? 'button' : 'div'} ${onclick ? `onclick="${onclick}"` : ''} class="block text-left w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-4 ${onclick ? 'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer' : ''}">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">${esc(label)}</div>
      <div class="text-3xl font-black mt-1 ${accent || 'text-slate-800 dark:text-slate-100'}">${val}</div>
      ${sub ? `<div class="text-[11px] text-slate-400 mt-0.5">${esc(sub)}</div>` : ''}
    </${onclick ? 'button' : 'div'}>`;
  const pending = (d.views == null || d.messages == null)
    ? `<div class="text-[12px] text-slate-400 flex items-center gap-2 px-1">${svgIcon('info','w-4 h-4')}Views &amp; messages appear once your Facebook account is connected in Settings.</div>` : '';
  root.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white">Facebook Marketplace</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Your listing performance — last ${d.window_days || 30} days.</p>
      </div>
      <button onclick="__inventoryMode='facebook'; switchPage('inventory')" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition">Post Inventory</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      ${tile('Vehicles Posted', num(d.posted), 'live now — view inventory', 'text-blue-600 dark:text-blue-400', "__inventoryMode='facebook'; switchPage('inventory')")}
      ${tile('Views', num(d.views), 'from Facebook')}
      ${tile('Messages', num(d.messages), 'from Facebook')}
      ${tile('Leads', num(d.leads), 'captured', '', "switchPage('leads')")}
      ${tile('Sold via Marketplace', num(d.sold), 'last 30 days', 'text-emerald-600 dark:text-emerald-400', "__inventoryMode='facebook'; switchPage('inventory')")}
      ${tile('Avg response', resp, 'to a lead')}
    </div>
    ${pending}
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button onclick="__inventoryMode='facebook'; switchPage('inventory')" class="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:shadow-md transition"><div class="font-bold text-slate-800 dark:text-slate-100">My Inventory</div><div class="text-[12px] text-slate-400">Manage &amp; refresh listings</div></button>
      <button onclick="switchPage('leads')" class="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:shadow-md transition"><div class="font-bold text-slate-800 dark:text-slate-100">My Leads</div><div class="text-[12px] text-slate-400">Reply &amp; book appointments</div></button>
      <button onclick="switchPage('profile')" class="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 hover:shadow-md transition"><div class="font-bold text-slate-800 dark:text-slate-100">Settings</div><div class="text-[12px] text-slate-400">Facebook, profile, billing</div></button>
    </div>`;
}
window.loadSoloHome = loadSoloHome;

// ══ Delivery — Sold Vehicle Queue (workflow engine made visible) ══════════════
async function loadDeliveryQueue() {
  const root = document.getElementById('delivery-root');
  if (!root) return;
  root.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading delivery queue…</div>`;
  let d;
  try { d = await apiGetJson('/delivery/queue'); }
  catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 py-10 text-center">${esc(e.message)}</div>`; return; }
  const queue = d.queue || [];
  const badge = document.getElementById('delivery-badge');
  if (badge) { if (queue.length) { badge.textContent = queue.length; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
  const cards = queue.map(v => {
    const checks = v.checklist.map(c => `
      <label class="flex items-center gap-2 text-[13px] cursor-pointer py-0.5">
        <input type="checkbox" ${c.done ? 'checked' : ''} onchange="deliveryToggle('${v.id}','${c.key}',this.checked)" class="w-4 h-4 rounded border-slate-300 text-lime-600 focus:ring-lime-500">
        <span class="${c.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}">${esc(c.label)}</span>
      </label>`).join('');
    return `<div class="bg-white dark:bg-slate-900 border ${v.ready ? 'border-lime-300 dark:border-lime-800' : 'border-slate-200 dark:border-slate-800'} rounded-xl p-4 space-y-3">
      <div class="flex items-start justify-between gap-2">
        <div><div class="font-black text-slate-800 dark:text-slate-100">${esc(v.vehicle)}</div>
          <div class="text-[12px] text-slate-500">${esc(v.customer)}${v.stock ? ' · Stock ' + esc(v.stock) : ''}${v.deal_number ? ' · Deal ' + esc(v.deal_number) : ''}</div></div>
        ${v.ready ? '<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-lime-100 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300">READY</span>' : ''}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">${checks}</div>
      <button onclick="deliveryComplete('${v.id}')" ${v.ready ? '' : 'disabled'} class="w-full px-4 py-2 rounded-lg text-white text-sm font-bold transition ${v.ready ? 'bg-lime-600 hover:bg-lime-500' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'}">Mark delivered → post to accounting</button>
    </div>`;
  }).join('') || `<div class="p-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No vehicles awaiting delivery. Sold deals land here for prep.</div>`;
  root.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div><h1 class="text-2xl font-black text-slate-900 dark:text-white">Delivery</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Sold vehicles being prepped for pickup. Complete the checklist, then deliver.</p></div>
      <button onclick="loadDeliveryQueue()" class="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Refresh</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${cards}</div>`;
}
async function deliveryToggle(id, key, done) {
  try { await apiSendJson(`/delivery/${id}/checklist`, 'POST', { key, done }); loadDeliveryQueue(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function deliveryComplete(id) {
  if (!confirm('Mark this vehicle delivered? This posts the sale to accounting and pays commission.')) return;
  try { await apiSendJson(`/delivery/${id}/deliver`, 'POST'); showToast('Delivered ', 'success'); loadDeliveryQueue(); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { loadDeliveryQueue, deliveryToggle, deliveryComplete });

const CONFIG_META = {
  crm_integration:   { label: 'CRM Integration', category: 'crm', icon: '', desc: 'How captured leads sync out to your CRM (method, lead email, webhook, ADF/XML).' },
  accounting:        { label: 'Accounting & General Ledger', category: 'finance', icon: '', desc: 'Auto-post delivered deals to the ledger, chart of accounts mapping + cost tracking.' },
  service:           { label: 'Service & Parts Parameters', category: 'service', icon: '', desc: 'Labor rate ($/hr), sales tax %, shop supplies %, parts markup, and repair order prefix.' },
  hr_compliance:     { label: 'People & Compliance (HR)', category: 'hr', icon: '', desc: 'Provincial rules (Ontario OHSA/ESA), licence check intervals, mandatory policy documents & safety rules.' },
  ai_knowledge:      { label: 'AI Knowledge Base', category: 'ai', icon: '', desc: 'Facts the chatbot answers from (hours, financing options, inventory specials, trade-in policy).' },
  ai_personality:    { label: 'AI Personality & Greeting', category: 'ai', icon: '', desc: 'Chatbot greeting message, conversation tone, and off-hours auto-reply policies.' },
  notification_rules:{ label: 'Notification & Alert Rules', category: 'crm', icon: '', desc: 'Real-time alert thresholds (hot-lead score cutoffs, SMS numbers, daily digest).' },
};
const cfgLabel = (k) => CONFIG_META[k]?.label || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function settingsGo(page, engineId, tab) {
  switchPage(page)
  if (engineId && tab) setTimeout(() => engineTab(engineId, tab), 0)
}
window.settingsGo = settingsGo

function loadConfigHub() {
  const root = document.getElementById('config-root')
  if (!root) return
  const section = (title, description, actions) => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
    <h2 class="text-[15px] font-black text-slate-900 dark:text-white">${esc(title)}</h2>
    <p class="text-[12px] text-slate-500 dark:text-slate-400 mt-1 mb-3">${esc(description)}</p>
    <div class="flex flex-wrap gap-2">${actions.map(a => `<button onclick="${a.go}" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">${esc(a.label)}</button>`).join('')}</div>
  </div>`
  root.innerHTML = `<div class="space-y-5">
    <div>
      <h1 class="text-xl font-black text-slate-900 dark:text-white">Settings</h1>
      <p class="text-[13px] text-slate-500 dark:text-slate-400">Configure each operating domain where its canonical rules and records live.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${section('General', 'Dealership identity, locations, branding and timezone.', [
        { label: 'Dealership & locations', go: "settingsGo('launch','launch','work')" },
        { label: 'Setup status', go: "settingsGo('launch','launch','overview')" },
      ])}
      ${section('Team & Access', 'Users, employees, roles, permissions and security.', [
        { label: 'Users & access', go: "switchPage('owner-users')" },
        { label: 'Employees', go: "switchPage('sales-team')" },
        { label: 'Security profile', go: "switchPage('profile')" },
      ])}
      ${section('Sales, Inventory & F&I', 'Lead routing, inventory operations and finance workflows.', [
        { label: 'Sales settings', go: "settingsGo('sales','sales','settings')" },
        { label: 'Inventory settings', go: "switchPage('config')" },
        { label: 'F&I settings', go: "settingsGo('fni-overview','fni-overview','settings')" },
      ])}
      ${section('Service & Parts', 'Operating hours, repair-order rules and parts configuration.', [
        { label: 'Service settings', go: "settingsGo('service-overview','service-overview','settings')" },
        { label: 'Parts settings', go: "settingsGo('parts-overview','parts-overview','settings')" },
      ])}
      ${section('Accounting', 'Chart of accounts, tax, posting rules, periods and approvals.', [
        { label: 'Accounting settings', go: "settingsGo('accounting-overview','accounting-overview','settings')" },
        { label: 'Journal & close', go: "settingsGo('accounting-overview','accounting-overview','journal')" },
        { label: 'Budget & bank', go: "settingsGo('accounting-overview','accounting-overview','budget')" },
      ])}
      ${section('Marketing & Communications', 'Brand, campaigns, social, website, email and AI.', [
        { label: 'Marketing settings', go: "settingsGo('marketing-overview','marketing-overview','settings')" },
        { label: 'Website', go: "settingsGo('marketing-overview','marketing-overview','website')" },
        { label: 'Visual Studio', go: "settingsGo('marketing-overview','marketing-overview','studio')" },
      ])}
      ${section('People & Academy', 'Employment policy, training, schedules and compliance.', [
        { label: 'People', go: "switchPage('people-overview')" },
        { label: 'Academy', go: "switchPage('academy')" },
      ])}
      ${section('Automation, Integrations & API', 'One workflow engine, connected providers, and restricted developer access.', [
        { label: 'Automation', go: "switchPage('automation-builder')" },
        { label: 'API & webhooks', go: "switchPage('api-keys')" },
      ])}
    </div>
  </div>`
}

// Retained only for genuine key/value configuration callers while structured Settings is the
// runtime landing. It is deliberately not called by navigation.
async function loadLegacyConfigHub() {
  const root = document.getElementById('config-root');
  if (!root) return;
  root.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading configuration…</div>`;
  let d;
  try { d = await apiGetJson('/config'); }
  catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 py-10 text-center">${esc(e.message)}</div>`; return; }
  const keys = (d.keys || []).sort((a, b) => cfgLabel(a.key).localeCompare(cfgLabel(b.key)));
  const structured = d.structured || [];

  const cards = keys.map(k => {
    const meta = CONFIG_META[k.key] || {
      label: cfgLabel(k.key),
      category: 'general',
      icon: '',
      desc: 'System configuration parameter for your dealership.'
    };
    const valObj = (k.value && typeof k.value === 'object' && !Array.isArray(k.value)) ? k.value : null;
    const jsonStr = JSON.stringify(k.value ?? {}, null, 2);
    const isCustom = k.customized;

    // Build Visual Form Fields if valObj exists
    let formFieldsHtml = '';
    if (valObj && Object.keys(valObj).length > 0) {
      formFieldsHtml = Object.entries(valObj).map(([propKey, propVal]) => {
        const fieldId = `cfg-field-${k.key}-${propKey}`;
        const propLabel = propKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const type = typeof propVal;

        if (type === 'boolean') {
          return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <div>
                <label for="${fieldId}" class="block text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">${esc(propLabel)}</label>
                <span class="text-[10px] text-slate-400 font-mono">${esc(propKey)}</span>
              </div>
              <input type="checkbox" id="${fieldId}" data-prop="${esc(propKey)}" ${propVal ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer">
            </div>
          `;
        } else if (type === 'number') {
          return `
            <div class="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <label for="${fieldId}" class="block text-xs font-bold text-slate-800 dark:text-slate-200">${esc(propLabel)}</label>
              <input type="number" step="any" id="${fieldId}" data-prop="${esc(propKey)}" value="${propVal}" class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none">
            </div>
          `;
        } else {
          return `
            <div class="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
              <label for="${fieldId}" class="block text-xs font-bold text-slate-800 dark:text-slate-200">${esc(propLabel)}</label>
              <input type="text" id="${fieldId}" data-prop="${esc(propKey)}" value="${esc(String(propVal ?? ''))}" class="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:border-indigo-500 focus:outline-none">
            </div>
          `;
        }
      }).join('');
    }

    return `
      <div class="cfg-row-item w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition space-y-4" data-category="${meta.category || 'general'}" data-key="${esc(k.key)}" data-search="${esc(meta.label.toLowerCase() + ' ' + k.key + ' ' + meta.desc.toLowerCase())}">
        <!-- Header Row -->
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0 font-bold">
              ${meta.icon || ''}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-black text-slate-900 dark:text-white truncate">${esc(meta.label)}</h3>
                <code class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-mono">${esc(k.key)}</code>
                ${isCustom 
                  ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Customized</span>' 
                  : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">System Default</span>'}
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">${esc(meta.desc)}</p>
            </div>
          </div>

          <!-- Action Controls Right -->
          <div class="flex items-center gap-2 shrink-0">
            ${valObj ? `<button onclick="cfgToggleView('${esc(k.key)}')" id="btn-toggle-${esc(k.key)}" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1"> Code View</button>` : ''}
            <button onclick="${valObj ? `cfgSaveForm('${esc(k.key)}')` : `cfgSave('${esc(k.key)}')`}" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition flex items-center gap-1"> Save Changes</button>
            ${isCustom ? `<button onclick="cfgReset('${esc(k.key)}')" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 hover:text-rose-600 dark:text-slate-300 text-xs font-bold transition">↺ Reset</button>` : ''}
          </div>
        </div>

        <!-- Editor Content Row -->
        <div id="cfg-form-wrap-${esc(k.key)}" class="w-full">
          ${valObj ? `
            <div id="cfg-form-mode-${esc(k.key)}" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              ${formFieldsHtml}
            </div>
          ` : ''}
          <div id="cfg-code-mode-${esc(k.key)}" class="${valObj ? 'hidden' : ''} space-y-1">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400">JSON Data Payload</label>
            <textarea id="cfg-${esc(k.key)}" rows="${Math.min(10, jsonStr.split('\n').length + 2)}" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-emerald-400 text-xs font-mono focus:border-indigo-500 focus:outline-none leading-relaxed">${esc(jsonStr)}</textarea>
          </div>
        </div>
      </div>
    `;
  }).join('') || '<div class="text-sm text-slate-400 py-6 text-center">No configuration keys found.</div>';

  const structRows = structured.map(s => `
    <div class="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm"></div>
        <div>
          <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">${esc(s.label)}</h4>
          <span class="text-[10px] text-slate-400 font-mono">Editor: ${esc(s.editor)}</span>
        </div>
      </div>
      <span class="px-2.5 py-1 text-xs font-black rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${s.count} rule${s.count === 1 ? '' : 's'} active</span>
    </div>
  `).join('');
  
  const hrFeaturedCard = `
    <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-700/60 rounded-2xl p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow"></div>
        <div>
          <h3 class="font-black text-base text-white leading-tight">People &amp; Compliance (HR Engine)</h3>
          <p class="text-xs text-indigo-200 mt-0.5">Unified employee CRM profiles, driver licence tracking, safety policies, and automated HR workflows.</p>
        </div>
      </div>
      <button onclick="switchPage('people-compliance')" class="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shadow-md transition flex items-center gap-1.5">Open HR Engine </button>
    </div>
  `;

  const categoryTabs = `
    <div class="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
      <div class="flex flex-wrap items-center gap-2">
        <button onclick="cfgFilterCategory('all')" id="cfg-cat-all" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 text-white shadow-sm transition"> All Settings (${keys.length})</button>
        <button onclick="cfgFilterCategory('crm')" id="cfg-cat-crm" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"> CRM &amp; Alerts</button>
        <button onclick="cfgFilterCategory('ai')" id="cfg-cat-ai" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"> AI &amp; Personality</button>
        <button onclick="cfgFilterCategory('hr')" id="cfg-cat-hr" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"> People &amp; Compliance</button>
        <button onclick="cfgFilterCategory('service')" id="cfg-cat-service" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"> Service &amp; Parts</button>
        <button onclick="cfgFilterCategory('finance')" id="cfg-cat-finance" class="cfg-cat-btn px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"> Accounting &amp; Ledger</button>
      </div>
      <div class="relative w-full sm:w-64">
        <input type="text" id="cfg-search-input" onkeyup="cfgSearchFilter()" placeholder=" Filter settings..." class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
      </div>
    </div>
  `;

  root.innerHTML = `
    <div class="space-y-6">
      <!-- Main Settings Header -->
      <div class="flex items-start justify-between flex-wrap gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-black text-slate-900 dark:text-white">Dealership Master Configuration</h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">${keys.length} Master Keys</span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure operational rules, CRM lead delivery, AI personality, service parameters, and general ledger defaults.</p>
        </div>
      </div>

      ${hrFeaturedCard}

      ${categoryTabs}

      <!-- Structured Domains Header & Rows -->
      ${structured.length ? `
        <div class="space-y-3">
          <div class="flex items-center justify-between pt-2">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs"></div>
              <h2 class="text-xs font-black uppercase tracking-wider text-slate-400">Structured System Domains</h2>
            </div>
            <span class="text-[11px] font-bold text-slate-400">${structured.length} Domains</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${structRows}</div>
        </div>
      ` : ''}

      <!-- Configuration Settings Full-Width Rows -->
      <div class="space-y-3">
        <div class="flex items-center justify-between pt-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-xs"></div>
            <h2 class="text-xs font-black uppercase tracking-wider text-slate-400">Core Configuration Parameters</h2>
          </div>
          <span class="text-[11px] font-bold text-slate-400">Full-Width Row View</span>
        </div>
        <div id="cfg-rows-container" class="space-y-4 w-full">
          ${cards}
        </div>
      </div>
    </div>
  `;
}

function cfgToggleView(key) {
  const formMode = document.getElementById(`cfg-form-mode-${key}`);
  const codeMode = document.getElementById(`cfg-code-mode-${key}`);
  const btn = document.getElementById(`btn-toggle-${key}`);
  if (!formMode || !codeMode) return;
  if (formMode.classList.contains('hidden')) {
    formMode.classList.remove('hidden');
    codeMode.classList.add('hidden');
    if (btn) btn.innerHTML = ' Code View';
  } else {
    formMode.classList.add('hidden');
    codeMode.classList.remove('hidden');
    if (btn) btn.innerHTML = ' Form View';
  }
}

async function cfgSaveForm(key) {
  const container = document.getElementById(`cfg-form-mode-${key}`);
  if (!container) return cfgSave(key);
  const inputs = container.querySelectorAll('[data-prop]');
  const obj = {};
  inputs.forEach(inp => {
    const prop = inp.dataset.prop;
    if (inp.type === 'checkbox') {
      obj[prop] = inp.checked;
    } else if (inp.type === 'number') {
      obj[prop] = parseFloat(inp.value) || 0;
    } else {
      obj[prop] = inp.value;
    }
  });
  try {
    await apiSendJson('/config/' + encodeURIComponent(key), 'PUT', { value: obj });
    showToast(`Saved ${key} `, 'success');
    loadConfigHub();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
