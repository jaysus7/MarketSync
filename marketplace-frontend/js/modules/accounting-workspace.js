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

async function accApprove(id) {
  try {
    await apiSendJson(`/expenses/${id}/approve`, 'POST', {});
    showToast('Expense approved ✓', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', ENGINE_STATE['accounting-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accApprove = accApprove;

async function accPay(id) {
  if (!confirm('Record this bill as paid? This clears the payable and credits cash.')) return;
  try {
    await apiSendJson(`/expenses/${id}/pay`, 'POST', {});
    showToast('Bill paid ✓', 'success');
    ENGINE_DATA['accounting-overview'] = undefined;
    engineTab('accounting-overview', ENGINE_STATE['accounting-overview'] || 'overview', true);
  } catch (e) { showToast(e.message, 'error'); }
}
window.accPay = accPay;

ENGINES['accounting-overview'] = {
  rootId: 'accounting-overview-root', title: 'Accounting',
  subtitle: 'Financial control — what reached the books, what has not, and what is owed',
  icon: 'currency', accent: 'emerald',
  tabLabels: { overview: 'Today', work: 'Work' },
  get tabOrder() {
    const mgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(profileContext?.role);
    return mgr ? ['overview', 'work', 'insights'] : ['overview', 'work'];
  },

  quickActions: [
    { label: 'Deal Posting', icon: 'clipboard', onclick: "accView('deal-posting')" },
    { label: 'Contracts in Transit', icon: 'chart', onclick: "accView('cit')" },
    { label: 'Receivables', icon: 'currency', onclick: "accView('ar')" },
    { label: 'Payables', icon: 'gem', onclick: "accView('ap')" },
    { label: 'Full ledger', icon: 'chevronRight', onclick: "switchPage('accounting')" },
  ],
  nextActions: (d) => (d?.exceptions || []).slice(0, 5).map(x => ({
    label: `${x.reason || x.kind}${x.amount != null ? ` — ${accMoney(x.amount)}` : ''}`,
    icon: 'flame', tone: ACC_TONE[x.severity] || ACC_TONE[1],
    onclick: x.kind.startsWith('ap_') ? "accView('ap')" : x.kind.startsWith('ar_') ? "accView('ar')" : x.kind.startsWith('cit') || x.kind.startsWith('funding') ? "accView('cit')" : "accView('deal-posting')",
  })),

  fetch: async () => {
    const [exc, ar, ap, cit, deals] = await Promise.all([
      apiGetJson('/accounting/exceptions').catch(() => ({ exceptions: [] })),
      apiGetJson('/accounting/receivables').catch(() => ({ receivables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/payables').catch(() => ({ payables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/contracts-in-transit').catch(() => ({ contracts: [], total: 0 })),
      apiGetJson('/accounting/deal-posting').catch(() => ({ deals: [] })),
    ]);
    return {
      exceptions: exc.exceptions || [],
      receivables: ar.receivables || [], arAging: ar.aging || {}, arTotal: ar.total || 0,
      payables: ap.payables || [], apAging: ap.aging || {}, apTotal: ap.total || 0,
      contracts: cit.contracts || [], citTotal: cit.total || 0,
      dealPosting: deals.deals || [],
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
