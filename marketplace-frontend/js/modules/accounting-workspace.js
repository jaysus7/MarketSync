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

// The eight views that used to be a second row of tabs inside "Work" are now
// sections: Deal Posting, Contracts in Transit, Receivables and Payables stack in
// My Day; Journal and Close are the Journal tab; Payroll and Budget are tabs of
// their own. Each is still one function — see the bottom of this file.

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
  tabLabels: { overview: 'Pulse', journal: 'Journal', payroll: 'Payroll', budget: 'Budget', settings: 'Settings' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(profileContext?.role);
    // Settings writes tax handling, auto-posting and who gets the alerts, and Budget
    // connects the bank — both are controller acts.
    return mgr ? ['overview', 'journal', 'payroll', 'budget', 'settings'] : ['overview', 'journal'];
  },

  quickActions: [
    { label: 'Journal', icon: 'clipboard', onclick: "engineTab('accounting-overview','journal')" },
    { label: 'Payroll', icon: 'currency', onclick: "engineTab('accounting-overview','payroll')" },
    { label: 'Budget', icon: 'chart', onclick: "engineTab('accounting-overview','budget')" },
    { label: 'Full ledger', icon: 'chevronRight', onclick: "switchPage('accounting')" },
  ],
  // Every exception now lands on My Day, where its section already lives.
  nextActions: (d) => (d?.exceptions || []).slice(0, 5).map(x => ({
    label: `${x.reason || x.kind}${x.amount != null ? ` — ${accMoney(x.amount)}` : ''}`,
    icon: 'flame', tone: ACC_TONE[x.severity] || ACC_TONE[1],
    onclick: "engineTab('accounting-overview','overview')",
  })),

  fetch: async () => {
    // Each read degrades to empty on its own, so one unavailable feed never blanks the
    // controller's whole day.
    const [exc, ar, ap, cit, deals, journal, close, bank, periods, payPeriods, commExc,
           settings, budget, accounts, plaidStatus, plaidConfig, commPlans] = await Promise.all([
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
      // null, not a default object: Settings and Budget must be able to tell
      // "could not read" from "nothing configured".
      apiGetJson('/accounting/settings').catch(() => null),
      apiGetJson('/accounting/budget').catch(() => null),
      apiGetJson('/accounting/accounts').catch(() => null),
      apiGetJson('/plaid/status').catch(() => null),
      apiGetJson('/plaid/config').catch(() => null),
      apiGetJson('/commissions/plans').catch(() => null),
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
      settings: settings ? (settings.settings || null) : null,
      budget: budget || null,
      accounts: accounts ? (accounts.accounts || []) : null,
      plaid: plaidStatus || null,
      plaidConfigured: plaidConfig ? !!plaidConfig.configured : null,
      commissionPlans: commPlans ? (commPlans.plans || []) : null,
    };
  },

  tabs: {
    // ── My Day ───────────────────────────────────────────────────────────────
    // The controller's whole day on one page: what is exceptional, whether deals
    // reached the books, what the lenders owe, what customers owe and what we owe.
    // Deal Posting, Contracts in Transit, Receivables and Payables used to be four
    // clicks inside a second tab bar, which meant the day was never visible at once.
    overview(body, d) {
      const exc = d.exceptions || [];
      const critical = exc.filter(x => x.severity === 3).length;
      const unfunded = (d.contracts || []).filter(c => c.balance > 0).length;
      const apDue = (d.payables || []).filter(b => b.view === 'due').length;
      const open = (d.receivables || []).filter(r => r.balance > 0);
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

        ${engSection('Deal posting', accDealPostingView(d), 'Has every delivered deal reached the books?')}
        ${engSection('Contracts in transit', accCitView(d), 'What the lenders still owe on delivered deals')}
        ${engSection('Receivables', accArView(d), 'What customers owe')}
        ${engSection('Payables', accApView(d), 'What we owe, and what is due')}

        ${engSection('Where the money stands', `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
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
            <button onclick="switchPage('accounting')" class="mt-2 px-3 py-1.5 rounded-lg text-[12px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition">Open statements</button>`)}`)}`;
    },

    // ── Journal ──────────────────────────────────────────────────────────────
    // Was the "Work" tab, which opened onto eight more tabs. The journal is the book
    // of record, and the period close is the act of shutting it — one page, two
    // sections, no second nav.
    journal(body, d) {
      body.innerHTML = engSection('General journal', accJournalView(d), 'Every posted entry, and the drafts that are not financial truth yet')
        + engSection('Period close', accCloseView(d), 'What prevents this period from closing');
    },

    // ── Payroll ──────────────────────────────────────────────────────────────
    // Took the old Insights slot. Commissions live here because a commission IS
    // payroll; the amounts are the Commission Engine's and are not recomputed.
    payroll(body, d) {
      body.innerHTML = accPayrollView(d);
    },

    // ── Budget ───────────────────────────────────────────────────────────────
    budget(body, d) {
      body.innerHTML = accBudgetView(d);
    },

    settings(body, d) {
      body.innerHTML = accSettingsView(d);
    },

  },
};


// ── The sections ─────────────────────────────────────────────────────────────
// Each of these was a view behind the old "Work" sub-nav. They are unchanged in
// substance — they now return their HTML so a tab can stack several of them under
// headings instead of hiding seven behind one.

function accDealPostingView(d) {
  let inner = '';
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
  return inner;
}

function accCitView(d) {
  let inner = '';
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
  return inner;
}

function accArView(d) {
  let inner = '';
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
  return inner;
}

function accApView(d) {
  let inner = '';
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
  return inner;
}

function accJournalView(d) {
  let inner = '';
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
  return inner;
}

function accBankingView(d) {
  let inner = '';
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
  return inner;
}

function accPayrollView(d) {
  let inner = '';
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
  return inner;
}

function accCloseView(d) {
  let inner = '';
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
  return inner;
}

// ── Budget ───────────────────────────────────────────────────────────────────
// A monthly spending target per expense account against this month's actual spend,
// plus the bank connection that makes the actuals real. Both /accounting/budget and
// the Plaid routes already exist; this is the surface for them.
function accBudgetView(d) {
  const b = d.budget;
  const bank = accBankConnection(d);
  if (!b) {
    return bank + engSection('Budget vs actual',
      engCard('', engEmpty('The budget could not be loaded, so nothing is shown. No targets have been changed.')));
  }
  const accounts = (d.accounts || []).filter(a => String(a.type || a.account_type || '').toLowerCase().includes('expense'));
  const budgets = b.budgets || {};
  const actuals = b.actuals || {};
  // Accounts with a target OR spend this month. An account with neither is noise.
  const rows = (accounts.length ? accounts : Object.keys({ ...budgets, ...actuals }).map(id => ({ id, name: id })))
    .filter(a => budgets[a.id] != null || actuals[a.id] != null);
  const totalBudget = Object.values(budgets).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalActual = Object.values(actuals).reduce((s, v) => s + (Number(v) || 0), 0);

  const list = rows.map(a => {
    const target = Number(budgets[a.id]) || 0;
    const actual = Number(actuals[a.id]) || 0;
    const pct = target > 0 ? Math.round((actual / target) * 100) : null;
    const over = target > 0 && actual > target;
    return `<div class="flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(a.name || a.id)}</div>
        <div class="text-[12px] ${over ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-400'}">
          ${esc(accMoney(actual))} spent${target > 0 ? ` of ${esc(accMoney(target))}${pct == null ? '' : ` · ${pct}%`}` : ' · no target set'}</div>
      </div>
      <input id="acc-budget-${esc(a.id)}" type="number" step="0.01" min="0" value="${target || ''}" placeholder="0.00"
        class="shrink-0 w-28 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-right">
    </div>`;
  }).join('');

  return bank + engSection(`Budget vs actual — ${esc(b.month || '')}`, `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
      ${engKpi('Budgeted', accMoney(totalBudget))}
      ${engKpi('Actual', accMoney(totalActual), totalBudget > 0 && totalActual > totalBudget ? 'text-rose-600 dark:text-rose-400' : '')}
      ${engKpi('Remaining', accMoney(totalBudget - totalActual), totalBudget - totalActual < 0 ? 'text-rose-600 dark:text-rose-400' : '')}
    </div>
    ${engCard('Monthly target per expense account', list || engEmpty('No expense accounts with a target or spend this month.'))}
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <button onclick="accSaveBudget()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save targets</button>
      <span class="text-[12px] text-slate-400">Actuals come from posted journal entries. A blank target means no budget is set.</span>
    </div>`, 'What you planned to spend against what the ledger says you did');
}

// The bank connection, stated honestly. `configured: false` means this MarketSync
// deployment has no Plaid credentials — that is a different problem from a dealership
// that simply has not linked an account, and saying so saves a support call.
function accBankConnection(d) {
  const cfg = d.plaidConfigured;
  const st = d.plaid;
  let inner;
  if (cfg === false) {
    inner = engCard('', `<div class="text-[13px] text-slate-500 dark:text-slate-400">Bank connections are not configured on this MarketSync deployment, so there is nothing to connect to yet.</div>`);
  } else if (st == null) {
    inner = engCard('', engEmpty('The bank connection status could not be read, so it is not shown.'));
  } else if (st.connected || st.item_id || st.institution) {
    inner = engCard('', `
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-[13px] text-slate-900 dark:text-white">${esc(st.institution || 'Bank connected')}</div>
          <div class="text-[12px] text-slate-400">${st.last_sync ? `Last synced ${esc(String(st.last_sync).slice(0, 16).replace('T', ' '))}` : 'Not synced yet'}${st.accounts ? ` · ${st.accounts} account(s)` : ''}</div>
        </div>
        <button onclick="accBankSync()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Sync now</button>
        <button onclick="accBankDisconnect()" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">Disconnect</button>
      </div>`);
  } else {
    inner = engCard('', `
      <div class="text-[13px] text-slate-600 dark:text-slate-300 mb-2">No bank account is linked. Connecting one brings your real cash movement in beside the ledger.</div>
      <button onclick="accBankConnect()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Connect your bank</button>`);
  }
  return engSection('Your bank', inner + '<div class="mt-3">' + accBankingView(d) + '</div>',
    'Linked through Plaid — MarketSync never sees your banking password');
}

async function accSaveBudget() {
  const budgets = {};
  document.querySelectorAll('[id^="acc-budget-"]').forEach(el => {
    const id = el.id.slice('acc-budget-'.length);
    const v = Number(el.value);
    if (Number.isFinite(v) && v > 0) budgets[id] = v;
  });
  try {
    await apiSendJson('/accounting/budget', 'PUT', { budgets });
    showToast('Budget targets saved', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'budget', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accSaveBudget = accSaveBudget;

// Plaid Link runs in the bank's own hosted flow. We can mint the token; we cannot
// complete the handshake without the Link SDK on the page, so rather than draw a
// button that silently does nothing, this says exactly where it stops.
async function accBankConnect() {
  try {
    const r = await apiSendJson('/plaid/link-token', 'POST', {});
    if (r?.link_token && typeof window.Plaid?.create === 'function') {
      window.Plaid.create({
        token: r.link_token,
        onSuccess: async (publicToken) => {
          try {
            await apiSendJson('/plaid/exchange', 'POST', { public_token: publicToken });
            showToast('Bank connected', 'success');
            ENGINE_DATA['accounting-overview'] = undefined;
            engineTab('accounting-overview', 'budget', true);
          } catch (e) { showToast(e.message, 'error'); }
        },
      }).open();
      return;
    }
    showToast('The bank link opened a token but Plaid Link is not loaded on this page, so the connection cannot be completed here yet.', 'error');
  } catch (e) { showToast(e.message, 'error'); }
}
window.accBankConnect = accBankConnect;

async function accBankSync() {
  try {
    const r = await apiSendJson('/plaid/sync', 'POST', {});
    showToast(r?.added != null ? `Synced — ${r.added} new transaction(s)` : 'Sync requested', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'budget', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accBankSync = accBankSync;

async function accBankDisconnect() {
  if (!confirm('Disconnect the bank? Transactions already imported stay; no new ones will arrive.')) return;
  try {
    await apiSendJson('/plaid/disconnect', 'POST', {});
    showToast('Bank disconnected', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'budget', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accBankDisconnect = accBankDisconnect;

// ── Settings ─────────────────────────────────────────────────────────────────
// The settings themselves, not a button that goes and finds them: posting behaviour,
// tolerance, tax handling, who gets alerted, and the commission plans that decide what
// payroll pays.
const ACC_SETTING_FIELDS = [
  ['tolerance', 'Reconciliation tolerance', 'Dollars a daily reconciliation may be off before it is an exception', 'number'],
  ['tax_label', 'Tax label', 'What this jurisdiction calls it — Sales tax, GST, VAT', 'text'],
  ['tax_number', 'Tax registration number', 'Printed on documents that need it', 'text'],
  ['accounting_emails', 'Accounting alerts to', 'Comma separated', 'text'],
  ['gm_emails', 'GM alerts to', 'Comma separated', 'text'],
];

function accSettingsView(d) {
  const st = d.settings;
  if (!st) {
    return engSection('Accounting settings',
      engCard('', engEmpty('Accounting settings could not be loaded, so they are not shown. Nothing has been changed.')));
  }
  const val = (k) => Array.isArray(st[k]) ? st[k].join(', ') : (st[k] ?? '');
  const fields = ACC_SETTING_FIELDS.map(([key, label, hint, type]) => `
    <label class="block">
      <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">${esc(label)}</span>
      <input id="acc-set-${key}" type="${type}"${type === 'number' ? ' step="0.01" min="0"' : ''} value="${esc(String(val(key)))}"
        class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">
      <span class="block text-[11px] text-slate-400 mt-0.5">${esc(hint)}</span>
    </label>`).join('');

  const freq = ['monthly', 'quarterly', 'annual'].map(f =>
    `<option value="${f}"${st.tax_frequency === f ? ' selected' : ''}>${f}</option>`).join('');

  return `
    ${engSection('Posting and alerts', engCard('', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${fields}
        <label class="block">
          <span class="block text-[12px] font-bold text-slate-600 dark:text-slate-300">Tax filing frequency</span>
          <select id="acc-set-tax_frequency" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm">${freq}</select>
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-4 mt-3">
        <label class="inline-flex items-center gap-2 text-sm font-semibold">
          <input id="acc-set-auto_post" type="checkbox" ${st.auto_post !== false ? 'checked' : ''} class="rounded"> Post automatically when a deal or repair order closes
        </label>
        <label class="inline-flex items-center gap-2 text-sm font-semibold">
          <input id="acc-set-enabled" type="checkbox" ${st.enabled !== false ? 'checked' : ''} class="rounded"> Accounting automations on
        </label>
      </div>
      <div class="flex flex-wrap items-center gap-2 mt-4">
        <button onclick="accSaveSettings()" class="px-3 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:opacity-90 transition">Save settings</button>
        <span class="text-[12px] text-slate-400">Turning automatic posting off means every deal and repair order waits for a human.</span>
      </div>`), 'How the books behave, and who hears about it')}

    ${engSection('Commission plans', accCommissionPlans(d), 'What payroll pays, and on what')}

    ${engSection('Chart of accounts', engCard('', d.accounts == null
      ? engEmpty('The chart of accounts could not be loaded.')
      : `<div class="text-[13px] text-slate-500 dark:text-slate-400 mb-2">${d.accounts.length} account(s) on file. Accounts are created and edited on the Accounting page, which owns the ledger.</div>
         <button onclick="switchPage('accounting')" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Open the chart of accounts</button>`))}`;
}

function accCommissionPlans(d) {
  const plans = d.commissionPlans;
  if (plans == null) return engCard('', engEmpty('Commission plans could not be loaded.'));
  if (!plans.length) return engCard('', engEmpty('No commission plans yet. Payroll cannot calculate a commission without one.'));
  return engCard('', plans.map(p => accRow({
    title: p.name || 'Plan',
    sub: `${p.plan_type || p.type || 'plan'}${p.role ? ` · ${p.role}` : ''}${p.active === false ? ' · inactive' : ''}`,
    right: p.active === false ? 'inactive' : 'active',
    tone: p.active === false ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400',
  })).join('') + `<button onclick="switchPage('commissions')" class="mt-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold">Edit plans in Payroll</button>`);
}

async function accSaveSettings() {
  const v = (id) => document.getElementById(id)?.value ?? '';
  const chk = (id) => !!document.getElementById(id)?.checked;
  try {
    await apiSendJson('/accounting/settings', 'PUT', {
      tolerance: Number(v('acc-set-tolerance')) || 25,
      tax_label: v('acc-set-tax_label'), tax_number: v('acc-set-tax_number'),
      tax_frequency: v('acc-set-tax_frequency'),
      accounting_emails: v('acc-set-accounting_emails'), gm_emails: v('acc-set-gm_emails'),
      auto_post: chk('acc-set-auto_post'), enabled: chk('acc-set-enabled'),
    });
    showToast('Accounting settings saved', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', 'settings', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accSaveSettings = accSaveSettings;

function loadAccountingWorkspace() { renderEngine('accounting-overview'); }
window.loadAccountingWorkspace = loadAccountingWorkspace;
