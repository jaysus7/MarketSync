/**
 * Accounting workspace — the controller's operating surface (Phase 5 PR 5.2).
 *
 * Today answers one question: what needs Accounting's attention right now? It is an
 * exception queue, not a wall of KPIs.
 *
 * Every number here comes from the POSTED ledger via the server. This file computes no
 * balances, builds no journals and holds no receivable state of its own — that is the
 * whole point of PR 5.1/5.2. Contracts in Transit is shown as a LENDER receivable,
 * separate from customer AR, because conflating them is the exact defect PR 5.2 fixed.
 */

const ACC_VIEWS = [
  ['deal-posting', 'Deal Posting'], ['cit', 'Contracts in Transit'],
  ['ar', 'Receivables'], ['ap', 'Payables'],
  ['journal', 'Journal'], ['banking', 'Banking'],
  ['payroll', 'Payroll & Commissions'], ['close', 'Close'],
];
let __accView = 'deal-posting';
function accView(v) { __accView = v; engineTab('accounting-overview', 'work'); }
window.accView = accView;

const accMoney = (v) => {
  const x = Number(v) || 0;
  return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const accAge = (d) => (d == null ? '—' : d === 0 ? 'today' : `${d}d`);

// Severity drives colour, and colour is the only signal a controller scans for.
const ACC_TONE = { 3: 'text-rose-600 dark:text-rose-400', 2: 'text-amber-600 dark:text-amber-400', 1: 'text-slate-500 dark:text-slate-400' };

// One attention row. Source, amount, age, reason, owner and the action — the six things
// the brief asks every item to carry.
function accExceptionRow(x) {
  return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(x.reason || x.kind)}</div>
        <div class="text-[12px] text-slate-400">${esc(x.source || '—')}${x.owner ? ` · ${esc(x.owner)}` : ''} · ${esc(accAge(x.age_days))}</div>
      </div>
      ${x.amount != null ? `<div class="shrink-0 text-[13px] font-bold ${ACC_TONE[x.severity] || ''}">${esc(accMoney(x.amount))}</div>` : ''}
    </div>
    ${x.action ? `<div class="text-[12px] font-semibold mt-1 ${ACC_TONE[x.severity] || ''}">${esc(x.action)}</div>` : ''}
  </div>`;
}

function accRow({ title, sub, right, tone, action, onclick }) {
  return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
    <div class="min-w-0 flex-1">
      <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(title)}</div>
      <div class="text-[12px] text-slate-400 truncate">${esc(sub || '')}</div>
    </div>
    <div class="shrink-0 text-right">
      <div class="text-[13px] font-bold ${tone || 'text-slate-900 dark:text-white'}">${esc(right || '')}</div>
      ${action ? `<div class="text-[11px] text-slate-400">${esc(action)}</div>` : ''}
    </div>
    ${onclick ? `<button onclick="${onclick}" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open</button>` : ''}
  </div>`;
}

// Aging is derived by the server from real dates. The UI only renders what it is given —
// a bucket computed here would drift from the books the moment a date changed.
function accAging(buckets) {
  const order = ['current', '1-30', '31-60', '61-90', '90+'];
  const shown = order.filter(b => buckets && buckets[b]);
  if (!shown.length) return engEmpty('Nothing outstanding.');
  return `<div class="grid grid-cols-2 md:grid-cols-5 gap-2">
    ${shown.map(b => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 min-w-0">
      <div class="text-[11px] text-slate-500 truncate">${esc(b === 'current' ? 'Current' : b + ' days')}</div>
      <div class="text-[15px] font-black truncate ${b === '90+' ? 'text-rose-600 dark:text-rose-400' : b === '61-90' ? 'text-amber-600 dark:text-amber-400' : ''}">${esc(accMoney(buckets[b]))}</div>
    </div>`).join('')}
  </div>`;
}

// Advancing a period is a financial act: open → manager_approved → controller_approved
// → closed → locked. The server owns the flow and the permission; this only asks.
async function accAdvancePeriod(period, next) {
  if (!confirm(`Advance ${period} to ${next.replace(/_/g, ' ')}? Closed and locked periods refuse new postings.`)) return;
  try {
    const r = await apiSendJson('/accounting/periods/advance', 'POST', { period });
    showToast(`Period ${period} is now ${String(r.status || next).replace(/_/g, ' ')} `, 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', ENGINE_STATE['accounting-overview'] || 'work', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accAdvancePeriod = accAdvancePeriod;

async function accApprove(id) {
  try {
    await apiSendJson(`/expenses/${id}/approve`, 'POST', {});
    showToast('Expense approved ', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', ENGINE_STATE['accounting-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accApprove = accApprove;

async function accPay(id) {
  if (!confirm('Record this bill as paid? This clears the payable and credits cash.')) return;
  try {
    await apiSendJson(`/expenses/${id}/pay`, 'POST', {});
    showToast('Bill paid ', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', ENGINE_STATE['accounting-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accPay = accPay;

ENGINES['accounting-overview'] = {
  rootId: 'accounting-overview-root', title: 'Accounting',
  subtitle: 'Financial control — what reached the books, what has not, and what is owed',
  icon: 'currency', accent: 'emerald',
  tabLabels: { overview: 'My Day', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights'] : ['overview', 'work'];
  },

  quickActions: [
    { label: 'Deal Posting', icon: 'clipboard', onclick: "accView('deal-posting')" },
    { label: 'Contracts in Transit', icon: 'chart', onclick: "accView('cit')" },
    { label: 'Receivables', icon: 'currency', onclick: "accView('ar')" },
    { label: 'Payables', icon: 'gem', onclick: "accView('ap')" },
    { label: 'Journal', icon: 'clipboard', onclick: "accView('journal')" },
    { label: 'Close', icon: 'check', onclick: "accView('close')" },
    { label: 'Full ledger', icon: 'chevronRight', onclick: "switchPage('accounting')" },
  ],
  nextActions: (d) => (d?.exceptions || []).slice(0, 5).map(x => ({
    label: `${x.reason || x.kind}${x.amount != null ? ` — ${accMoney(x.amount)}` : ''}`,
    icon: 'flame', tone: ACC_TONE[x.severity] || ACC_TONE[1],
    onclick: x.kind.startsWith('ap_') ? "accView('ap')" : x.kind.startsWith('ar_') ? "accView('ar')" : x.kind.startsWith('cit') || x.kind.startsWith('funding') ? "accView('cit')" : "accView('deal-posting')",
  })),

  fetch: async () => {
    // Each read degrades to empty on its own, so one unavailable feed never blanks the
    // controller's whole day.
    const [exc, ar, ap, cit, deals, journal, close, bank, periods, payPeriods, commExc] = await Promise.all([
      apiGetJson('/accounting/exceptions').catch(() => ({ exceptions: [] })),
      apiGetJson('/accounting/receivables').catch(() => ({ receivables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/payables').catch(() => ({ payables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/contracts-in-transit').catch(() => ({ contracts: [], total: 0 })),
      apiGetJson('/accounting/deal-posting').catch(() => ({ deals: [] })),
      apiGetJson('/accounting/journal').catch(() => ({ entries: [] })),
      apiGetJson('/accounting/close-checklist').catch(() => null),
      apiGetJson('/plaid/transactions').catch(() => ({ transactions: [] })),
      apiGetJson('/accounting/periods').catch(() => ({ periods: [], flow: [], current: 'open' })),
      apiGetJson('/commissions/pay-periods').catch(() => ({ pay_periods: [] })),
      apiGetJson('/commissions/exceptions').catch(() => ({ exceptions: [] })),
    ]);
    return {
      exceptions: exc.exceptions || [],
      receivables: ar.receivables || [], arAging: ar.aging || {}, arTotal: ar.total || 0,
      payables: ap.payables || [], apAging: ap.aging || {}, apTotal: ap.total || 0,
      contracts: cit.contracts || [], citTotal: cit.total || 0,
      dealPosting: deals.deals || [],
      journal: journal.entries || [],
      close,
      bank: bank.transactions || [],
      periods: periods.periods || [], periodFlow: periods.flow || [],
      payPeriods: payPeriods.pay_periods || payPeriods.periods || [],
      commissionExceptions: commExc.exceptions || [],
    };
  },

  tabs: {
    overview(body, d) {
      const exc = d.exceptions || [];
      const critical = exc.filter(x => x.severity === 3).length;
      const unfunded = (d.contracts || []).filter(c => c.balance > 0).length;
      const apDue = (d.payables || []).filter(b => b.view === 'due').length;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Needs attention', exc.length, exc.length ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Critical', critical, critical ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Awaiting funding', unfunded, unfunded ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Bills due', apDue, apDue ? 'text-amber-600 dark:text-amber-400' : '')}
        </div>
        ${engCard(`Needs attention (${exc.length})`,
          exc.length ? exc.slice(0, 25).map(accExceptionRow).join('')
                     : engEmpty('Nothing needs Accounting right now.'))}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          ${engCard('Customer receivables', accAging(d.arAging))}
          ${engCard('Vendor payables', accAging(d.apAging))}
        </div>`;
    },

    work(body, d) {
      const nav = ACC_VIEWS.map(([v, label]) => `<button onclick="accView('${v}')"
        class="px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap transition ${__accView === v
          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${esc(label)}</button>`).join('');
      let inner = '';

      if (__accView === 'deal-posting') {
        const rows = d.dealPosting || [];
        const pending = rows.filter(r => r.posting_state !== 'posted');
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Delivered deals', rows.length)}
            ${engKpi('Not fully posted', pending.length, pending.length ? 'text-amber-600 dark:text-amber-400' : '')}
            ${engKpi('In transit', accMoney(d.citTotal))}
          </div>
          ${engCard('Has this deal reached the books?', rows.length ? rows.map(r => accRow({
            title: `Deal ${r.deal_number ?? r.deal_id.slice(0, 8)}${r.lender ? ` · ${r.lender}` : ''}`,
            sub: `${r.deal_type || 'deal'} · delivered ${r.delivered_at ? String(r.delivered_at).slice(0, 10) : '—'} · funding ${r.funding_status || 'pending'}`,
            right: r.posting_state === 'posted' ? 'Posted' : r.posting_state === 'exception' ? 'Exception' : 'Pending',
            tone: r.posting_state === 'posted' ? 'text-emerald-600 dark:text-emerald-400'
                : r.posting_state === 'exception' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400',
            action: `CIT ${accMoney(r.cit_balance)} · customer ${accMoney(r.customer_ar)}`,
          })).join('') : engEmpty('No delivered deals yet.'))}`;
      }

      if (__accView === 'cit') {
        const rows = d.contracts || [];
        const negative = rows.filter(c => c.balance < 0);
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('In transit', accMoney(d.citTotal))}
            ${engKpi('Awaiting funding', rows.filter(c => c.state === 'awaiting_funding').length)}
            ${engKpi('Aging / exception', rows.filter(c => c.state === 'aging' || c.state === 'exception').length,
              negative.length ? 'text-rose-600 dark:text-rose-400' : '')}
          </div>
          ${negative.length ? engCard('Exception — negative Contracts in Transit', negative.map(c => accRow({
            title: `Deal ${c.deal_id ? c.deal_id.slice(0, 8) : c.source_id.slice(0, 8)}`,
            sub: 'Funding credited more than delivery debited', right: accMoney(c.balance),
            tone: 'text-rose-600 dark:text-rose-400',
          })).join('')) : ''}
          ${engCard('Lender receivables', rows.length ? rows.map(c => accRow({
            title: `Deal ${c.deal_id ? c.deal_id.slice(0, 8) : c.source_id.slice(0, 8)}`,
            sub: `delivered ${c.delivered_at ? String(c.delivered_at).slice(0, 10) : '—'} · ${accAge(c.age_days)} · ${c.state.replace(/_/g, ' ')}`,
            right: accMoney(c.balance),
            tone: c.balance < 0 ? 'text-rose-600 dark:text-rose-400' : c.state === 'aging' ? 'text-amber-600 dark:text-amber-400' : '',
          })).join('') : engEmpty('Nothing awaiting lender funding.'))}`;
      }

      if (__accView === 'ar') {
        const rows = d.receivables || [];
        const open = rows.filter(r => r.balance > 0);
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Owed to us', accMoney(d.arTotal))}
            ${engKpi('Open receivables', open.length)}
            ${engKpi('Overdue', open.filter(r => (r.age_days ?? 0) > 30).length,
              open.some(r => (r.age_days ?? 0) > 30) ? 'text-amber-600 dark:text-amber-400' : '')}
          </div>
          ${engCard('Aging', accAging(d.arAging))}
          <div class="mt-4"></div>
          ${engCard('Who owes us', open.length ? open.map(r => accRow({
            title: `${r.source === 'service' ? 'Repair order' : r.source === 'deal' ? 'Deal' : r.source} ${String(r.source_id).slice(0, 8)}`,
            sub: `opened ${r.opened_at || '—'} · ${accAge(r.age_days)} · billed ${accMoney(r.original)} · applied ${accMoney(r.applied)}`,
            right: accMoney(r.balance),
            tone: r.status === 'overpaid' ? 'text-rose-600 dark:text-rose-400'
                : (r.age_days ?? 0) > 60 ? 'text-rose-600 dark:text-rose-400'
                : (r.age_days ?? 0) > 30 ? 'text-amber-600 dark:text-amber-400' : '',
            action: r.status,
          })).join('') : engEmpty('Nothing outstanding.'))}`;
      }

      if (__accView === 'ap') {
        const rows = d.payables || [];
        const group = (v) => rows.filter(b => b.view === v);
        const section = (label, list, showApprove, showPay) => list.length ? engCard(`${label} (${list.length})`, list.map(b => `
          <div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(b.vendor || 'Vendor')}</div>
              <div class="text-[12px] text-slate-400 truncate">${esc(b.category || '—')}${b.department ? ` · ${esc(b.department)}` : ''} · ${esc(b.date || '')}</div>
              <div class="text-[12px] text-slate-400">${esc(accAge(b.age_days))}${b.posted_to_ledger ? '' : ' · <span class="text-amber-600 dark:text-amber-400">not in the ledger</span>'}</div>
            </div>
            <div class="shrink-0 text-right">
              <div class="text-[13px] font-bold">${esc(accMoney(b.amount))}</div>
              ${b.outstanding ? `<div class="text-[11px] text-slate-400">${esc(accMoney(b.outstanding))} open</div>` : ''}
            </div>
            ${showApprove ? `<button onclick="accApprove('${b.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Approve</button>` : ''}
            ${showPay ? `<button onclick="accPay('${b.id}')" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Pay</button>` : ''}
          </div>`).join('')) : '';
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('We owe', accMoney(d.apTotal))}
            ${engKpi('Needs review', group('needs_review').length, group('needs_review').length ? 'text-amber-600 dark:text-amber-400' : '')}
            ${engKpi('Exceptions', group('exception').length, group('exception').length ? 'text-rose-600 dark:text-rose-400' : '')}
          </div>
          ${engCard('Aging', accAging(d.apAging))}
          <div class="mt-4"></div>
          ${section('Needs review', group('needs_review'), true, false)}
          ${section('Due', group('due'), false, true)}
          ${section('Exception', group('exception'), false, false)}
          ${section('Paid', group('paid').slice(0, 20), false, false)}
          ${rows.length ? '' : engEmpty('No vendor bills on file.')}`;
      }

      if (__accView === 'journal') {
        const rows = d.journal || [];
        const drafts = rows.filter(e => !e.posted);
        // A journal's lines are shown as they were posted. Nothing here edits them — a
        // posted entry is immutable, and a correction is a new reversing entry.
        const entry = (e) => {
          const dr = (e.lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
          const cr = (e.lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
          const balanced = Math.round(dr * 100) === Math.round(cr * 100);
          return `<div class="py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(e.event_name || e.source || 'Journal')}</div>
                <div class="text-[12px] text-slate-400 truncate">${esc(e.entry_date || '')} · ${esc(e.source || '')}${e.reference ? ` · ${esc(String(e.reference).slice(0, 12))}` : ''}</div>
                <div class="text-[12px] ${e.posted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${e.posted ? 'Posted' : 'Draft — not financial truth'}${balanced ? '' : ' · <span class="text-rose-500">unbalanced</span>'}</div>
              </div>
              <div class="shrink-0 text-right text-[13px] font-bold">${esc(accMoney(dr))}</div>
            </div>
            ${(e.lines || []).length ? `<div class="mt-1.5 space-y-0.5">${e.lines.map(l => `
              <div class="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                <span class="min-w-0 flex-1 truncate">${esc(l.memo || l.account_id || '')}</span>
                <span class="shrink-0 w-20 text-right">${Number(l.debit) ? esc(accMoney(l.debit)) : ''}</span>
                <span class="shrink-0 w-20 text-right">${Number(l.credit) ? esc(accMoney(l.credit)) : ''}</span>
              </div>`).join('')}
              <div class="flex items-center gap-2 text-[12px] font-bold border-t border-slate-100 dark:border-slate-800/60 pt-1 mt-1">
                <span class="min-w-0 flex-1">Debits = Credits</span>
                <span class="shrink-0 w-20 text-right">${esc(accMoney(dr))}</span>
                <span class="shrink-0 w-20 text-right">${esc(accMoney(cr))}</span>
              </div></div>` : ''}
          </div>`;
        };
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Entries', rows.length)}
            ${engKpi('Posted', rows.filter(e => e.posted).length, 'text-emerald-600 dark:text-emerald-400')}
            ${engKpi('Drafts', drafts.length, drafts.length ? 'text-amber-600 dark:text-amber-400' : '')}
          </div>
          ${drafts.length ? engCard(`Drafts — excluded from every balance (${drafts.length})`, drafts.map(entry).join('')) : ''}
          ${engCard('General journal', rows.length ? rows.slice(0, 60).map(entry).join('') : engEmpty('No journal entries yet.'))}`;
      }

      if (__accView === 'banking') {
        const rows = d.bank || [];
        // Honest scope: this is the bank FEED. There is no reconciliation model in the
        // schema yet — no match state, no statement, no reconciliation record — so
        // nothing here may claim a transaction is reconciled.
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Bank transactions', rows.length)}
            ${engKpi('Money in', accMoney(rows.filter(t => (t.direction || '') === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0)))}
            ${engKpi('Money out', accMoney(rows.filter(t => (t.direction || '') === 'out').reduce((s, t) => s + (Number(t.amount) || 0), 0)))}
          </div>
          ${engCard('Matching is not built yet', `<div class="text-[13px] text-slate-500 dark:text-slate-400">
            This is the raw bank feed. MarketSync has no reconciliation model yet — no match
            state, no statement, no reconciliation record — so nothing here is presented as
            reconciled or matched. Building that is its own piece of work.</div>`)}
          <div class="mt-4"></div>
          ${engCard('Cash movement', rows.length ? rows.slice(0, 60).map(t => accRow({
            title: t.name || t.merchant || 'Transaction',
            sub: `${t.txn_date || ''}${t.category ? ` · ${t.category}` : ''}${t.pending ? ' · pending' : ''}`,
            right: accMoney((t.direction === 'out' ? -1 : 1) * (Number(t.amount) || 0)),
            tone: t.direction === 'out' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          })).join('') : engEmpty('No bank transactions. Connect a bank under Integrations.'))}`;
      }

      if (__accView === 'payroll') {
        const periods = d.payPeriods || [];
        const exc = d.commissionExceptions || [];
        // Commission amounts are NOT recalculated here. The Commission Engine computes
        // them deterministically; Accounting reviews, and sees what is exceptional.
        inner = `
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            ${engKpi('Pay periods', periods.length)}
            ${engKpi('Open exceptions', exc.length, exc.length ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Awaiting approval', periods.filter(p => !['paid', 'locked'].includes(p.status)).length)}
          </div>
          ${exc.length ? engCard(`Commission exceptions (${exc.length})`, exc.slice(0, 25).map(x => accRow({
            title: x.type ? String(x.type).replace(/_/g, ' ') : 'Exception',
            sub: x.detail || 'Needs a human before payroll runs',
            right: x.severity || '', tone: 'text-rose-600 dark:text-rose-400',
          })).join('')) : engCard('Commission exceptions', engEmpty('No commission exceptions.'))}
          <div class="mt-4"></div>
          ${engCard('Pay periods', periods.length ? periods.map(p => accRow({
            title: p.name || `${p.start_date} → ${p.end_date}`,
            sub: `${p.period_type || 'period'} · ${p.start_date || ''} → ${p.end_date || ''}`,
            right: String(p.status || 'open').replace(/_/g, ' '),
            tone: p.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400'
                : p.status === 'locked' ? 'text-slate-500' : 'text-amber-600 dark:text-amber-400',
          })).join('') : engEmpty('No pay periods yet.'))}
          ${engCard('Where commissions are calculated', `<div class="text-[13px] text-slate-500 dark:text-slate-400">
            Amounts come from the Commission Engine and are not recomputed here — two
            calculations would eventually disagree, and payroll is the wrong place to find out.</div>
            <button onclick="switchPage('commissions')" class="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Open Payroll</button>`)}`;
      }

      if (__accView === 'close') {
        const c = d.close;
        if (!c) {
          inner = engCard('Close', engEmpty('The close checklist is unavailable right now.'));
        } else {
          const icon = (s) => s === 'clear' ? '<span class="text-emerald-600 dark:text-emerald-400">clear</span>'
                            : s === 'manual' ? '<span class="text-slate-500">attestation</span>'
                            : '<span class="text-rose-600 dark:text-rose-400">blocked</span>';
          const flow = ['open', 'manager_approved', 'controller_approved', 'closed', 'locked'];
          const next = flow[flow.indexOf(c.status) + 1] || null;
          inner = `
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              ${engKpi('Period', c.period)}
              ${engKpi('Status', String(c.status || 'open').replace(/_/g, ' '))}
              ${engKpi('Blockers', c.blockers, c.blockers ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}
            </div>
            ${engCard('What prevents this period from closing', (c.items || []).map(i => `
              <div class="flex items-start gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(i.label)}</div>
                  <div class="text-[12px] text-slate-400">${esc(i.detail || '')}</div>
                </div>
                <div class="shrink-0 text-[12px] font-bold">${icon(i.status)}</div>
              </div>`).join(''))}
            <div class="mt-4"></div>
            ${engCard('Trial balance', `<div class="text-[13px] text-slate-600 dark:text-slate-300">
              Debits ${esc(accMoney(c.trial_balance?.debit))} · Credits ${esc(accMoney(c.trial_balance?.credit))} —
              <span class="${c.trial_balance?.balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} font-bold">${c.trial_balance?.balanced ? 'balanced' : 'OUT OF BALANCE'}</span>
            </div>`)}
            <div class="mt-4"></div>
            ${engCard('Advance the period', c.locked
              ? `<div class="text-[13px] text-slate-500 dark:text-slate-400">This period is ${esc(c.status)}. Closed and locked periods refuse new postings; a correction is a reversing entry in an open period.</div>`
              : next
                ? `<div class="text-[13px] text-slate-500 dark:text-slate-400 mb-2">${c.can_close
                    ? 'Nothing blocking. Advancing is a financial act and is recorded.'
                    : `${c.blockers} blocking item(s) remain. Resolve them before closing.`}</div>
                   <button onclick="accAdvancePeriod('${esc(c.period)}','${esc(next)}')" ${c.can_close ? '' : 'disabled'}
                     class="px-3 py-1.5 rounded-lg text-[12px] font-bold transition ${c.can_close
                       ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                       : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}">Advance to ${esc(next.replace(/_/g, ' '))}</button>`
                : `<div class="text-[13px] text-slate-500 dark:text-slate-400">This period is fully closed.</div>`)}`;
        }
      }

      body.innerHTML = `<div class="flex gap-1.5 mb-3 overflow-x-auto">${nav}</div>${inner}`;
    },

    insights(body, d) {
      // Statements live on the existing Accounting page, which already renders them from
      // the ledger. Pointing there beats building a second, drifting copy.
      const open = (d.receivables || []).filter(r => r.balance > 0);
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          ${engKpi('Customer AR', accMoney(d.arTotal))}
          ${engKpi('In transit', accMoney(d.citTotal))}
          ${engKpi('Vendor AP', accMoney(d.apTotal))}
          ${engKpi('Open receivables', open.length)}
        </div>
        ${engCard('Financial statements', `
          <div class="text-[13px] text-slate-500 dark:text-slate-400">
            Trial balance, P&amp;L and balance sheet are computed from posted journals on the
            Accounting page.
          </div>
          <button onclick="switchPage('accounting')" class="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Open statements</button>`)}`;
    },
  },
};

function loadAccountingWorkspace() { renderEngine('accounting-overview'); }
window.loadAccountingWorkspace = loadAccountingWorkspace;
