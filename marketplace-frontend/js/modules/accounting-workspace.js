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

const accMoney = (v) => {
  const x = Number(v) || 0;
  return (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const accAge = (d) => (d == null ? '—' : d === 0 ? 'today' : `${d}d`);
const ACC_TONE = { 3: 'text-rose-600 dark:text-rose-400', 2: 'text-amber-600 dark:text-amber-400', 1: 'text-slate-500 dark:text-slate-400' };

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

ENGINES['accounting-overview'] = {
  rootId: 'accounting-overview-root', title: 'Accounting Department',
  subtitle: 'Financial control — what reached the books, what has not, and what is owed',
  icon: 'currency', accent: 'emerald',
  tabLabels: {
    overview: 'Pulse',
    money_in: 'Money In',
    money_out: 'Money Out',
    bank: 'Bank',
    close: 'Close',
    reports: 'Reports',
    budget: 'Budget',
    journal: 'Journal',
    payroll: 'Commissions',
    settings: 'Settings',
  },
  get tabOrder() {
    const role = profileContext?.role;
    const isOwner = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role);
    const isClerk = role === 'ACCOUNTING_CLERK';
    if (isOwner) return ['overview', 'money_in', 'money_out', 'bank', 'close', 'reports', 'budget', 'journal', 'payroll', 'settings'];
    if (isClerk) return ['overview', 'money_in', 'money_out', 'bank', 'payroll'];
    return ['overview', 'money_in', 'money_out', 'bank', 'close', 'reports', 'budget', 'payroll'];
  },
  quickActions: [
    { label: 'Accounting Training (Academy)', icon: 'sparkles', onclick: "openMarketSyncAcademy('accounting')" },
    { label: '+ Record Incoming', icon: 'currency', onclick: "accOpenCustomEntryModal('in')" },
    { label: '+ Record Outgoing', icon: 'clipboard', onclick: "accOpenCustomEntryModal('out')" },
    { label: 'Bank Matching', icon: 'chart', onclick: "engineTab('accounting-overview','bank')" },
    { label: 'Close Period', icon: 'chevronRight', onclick: "engineTab('accounting-overview','close')" },
  ],
  nextActions: (d) => (d?.exceptions || []).slice(0, 5).map(x => ({
    label: `${x.reason || x.kind}${x.amount != null ? ` — ${accMoney(x.amount)}` : ''}`,
    icon: 'flame', tone: ACC_TONE[x.severity] || ACC_TONE[1],
    onclick: "engineTab('accounting-overview','overview')",
  })),
  fetch: async () => {
    const [exc, ar, ap, cit, deals, close, settings, budget, plaidStatus, plaidConfig] = await Promise.all([
      apiGetJson('/accounting/exceptions').catch(() => ({ exceptions: [] })),
      apiGetJson('/accounting/receivables').catch(() => ({ receivables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/payables').catch(() => ({ payables: [], aging: {}, total: 0 })),
      apiGetJson('/accounting/contracts-in-transit').catch(() => ({ contracts: [], total: 0 })),
      apiGetJson('/accounting/deal-posting').catch(() => ({ deals: [] })),
      apiGetJson('/accounting/close-checklist').catch(() => null),
      apiGetJson('/accounting/settings').catch(() => null),
      apiGetJson('/accounting/budget').catch(() => null),
      apiGetJson('/plaid/status').catch(() => null),
      apiGetJson('/plaid/config').catch(() => null),
    ]);
    return {
      exceptions: exc?.exceptions || [],
      receivables: ar?.receivables || [], arAging: ar?.aging || {}, arTotal: ar?.total || 0,
      payables: ap?.payables || [], apAging: ap?.aging || {}, apTotal: ap?.total || 0,
      contracts: cit?.contracts || [], citTotal: cit?.total || 0,
      dealPosting: deals?.deals || [],
      journal: [], close, bank: [], periods: [], periodFlow: [], payPeriods: [],
      commissionExceptions: [],
      settings: settings ? (settings.settings || null) : null,
      budget: budget || null, accounts: null,
      plaid: plaidStatus || null,
      plaidConfigured: plaidConfig ? !!plaidConfig.configured : null,
      commissionPlans: [],
    };
  },
  tabs: {
    overview(body, d) {
      const exc = d.exceptions || [];
      const critical = exc.filter(x => x.severity === 0).length;
      const unfunded = (d.contracts || []).filter(x => x.status === 'unfunded').length;
      const apDue = (d.payables || []).filter(x => x.due_date && new Date(x.due_date) <= new Date()).length;
      const open = (d.receivables || []).filter(x => x.status === 'open');
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
        ${engSection('Where the money stands', `
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            ${engKpi('Customer AR', accMoney(d.arTotal))}
            ${engKpi('In transit', accMoney(d.citTotal))}
            ${engKpi('Vendor AP', accMoney(d.apTotal))}
            ${engKpi('Open receivables', open.length)}
          </div>
          <button onclick="engineTab('accounting-overview','reports')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900">View Statements</button>
        `)}
      `;
    },
    money_in(body, d) {
      if (typeof window.accRenderMoneyIn === 'function') window.accRenderMoneyIn(body, d);
      else body.innerHTML = engCard('Money In', engEmpty('Money In view is loading.'));
    },
    money_out(body, d) {
      if (typeof window.accRenderMoneyOut === 'function') window.accRenderMoneyOut(body, d);
      else body.innerHTML = engCard('Money Out', engEmpty('Money Out view is loading.'));
    },
    bank(body, d) {
      if (typeof window.accRenderBank === 'function') window.accRenderBank(body, d);
      else body.innerHTML = engCard('Bank', engEmpty('Bank view is loading.'));
    },
    close(body, d) {
      if (typeof window.accRenderClose === 'function') window.accRenderClose(body, d);
      else body.innerHTML = engCard('Close', engEmpty('Close checklist is loading.'));
    },
    reports(body, d) {
      if (typeof window.accRenderReports === 'function') window.accRenderReports(body, d);
      else body.innerHTML = engCard('Reports', engEmpty('Reports are loading.'));
    },
    journal(body, d) {
      body.innerHTML = engSection('General journal', engEmpty('Journal entries load from the ledger.'), 'Every posted entry');
    },
    payroll(body, d) {
      body.innerHTML = `<div id="commissions-root" class="space-y-4"></div>`;
      if (typeof window.loadCommissionsPage === 'function') window.loadCommissionsPage();
    },
    budget(body, d) {
      body.innerHTML = engCard('Budget', engEmpty('Budget targets load from Accounting.'));
    },
    settings(body, d) {
      body.innerHTML = engCard('Settings', engEmpty('Accounting settings.'));
    },
  },
};

function loadAccountingWorkspace() { renderEngine('accounting-overview'); }
window.loadAccountingWorkspace = loadAccountingWorkspace;
