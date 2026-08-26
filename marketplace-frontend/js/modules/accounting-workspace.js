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
      body.innerHTML = `<div id="accounting-commissions-root" class="space-y-4 min-h-[20rem]"></div>`;
      const mount = document.getElementById('accounting-commissions-root');
      if (typeof window.loadCommissionsPage === 'function') {
        try { window.loadCommissionsPage(mount); }
        catch (e) { body.innerHTML = engCard('Commissions', engEmpty(e.message || 'Could not load commission engine.')); }
      } else {
        body.innerHTML = engCard('Commissions', engEmpty('Commission engine is loading… refresh in a moment.'));
      }
    },
    budget(body, d) {
      if (typeof window.accRenderBudgetSheet === 'function') window.accRenderBudgetSheet(body, d);
      else body.innerHTML = engCard('Budget', engEmpty('Budget sheet is loading.'));
    },
    settings(body, d) {
      body.innerHTML = engCard('Settings', engEmpty('Accounting settings.'));
    },
  },
};



const ACC_BUDGET_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function accBudgetBlankLine() {
  return { id: 'ln_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: '', kind: 'expense', amounts: Array(12).fill(0), notes: '' };
}

async function accRenderBudgetSheet(body) {
  body.innerHTML = `<div class="text-sm text-slate-400 py-8 text-center">Loading budget…</div>`;
  const year = (window.__accBudgetYear) || new Date().getFullYear();
  window.__accBudgetYear = year;
  let wb = { year, lines: [] };
  let actuals = {};
  try {
    const res = await apiGetJson(`/accounting/budget?month=${year}-01`);
    if (res?.workbook && Array.isArray(res.workbook.lines) && res.workbook.lines.length) {
      wb = { year: Number(res.workbook.year) || year, lines: res.workbook.lines.map(l => ({
        id: l.id, name: l.name || '', kind: l.kind === 'income' ? 'income' : 'expense',
        amounts: Array.from({ length: 12 }, (_, i) => Number(l.amounts?.[i]) || 0),
        notes: l.notes || '',
      })) };
    }
    actuals = res?.actuals || {};
  } catch (e) {
    /* empty workbook is fine */
  }
  if (!wb.lines.length) {
    wb.lines = [
      { ...accBudgetBlankLine(), name: 'Vehicle sales', kind: 'income' },
      { ...accBudgetBlankLine(), name: 'F&I / aftermarket', kind: 'income' },
      { ...accBudgetBlankLine(), name: 'Payroll', kind: 'expense' },
      { ...accBudgetBlankLine(), name: 'Floorplan interest', kind: 'expense' },
      { ...accBudgetBlankLine(), name: 'Advertising', kind: 'expense' },
    ];
  }
  window.__accBudgetWb = wb;
  accPaintBudgetSheet(body);
}

function accBudgetFmt(n) {
  const x = Number(n) || 0;
  if (!x) return '';
  return x.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function accPaintBudgetSheet(body) {
  if (!body) body = document.querySelector('#accounting-overview-root [data-engine-body], #accounting-overview-root .eng-body') || document.getElementById('accounting-overview-root');
  const host = document.getElementById('acc-budget-sheet-host') || body;
  const wb = window.__accBudgetWb || { year: new Date().getFullYear(), lines: [] };
  const year = wb.year || new Date().getFullYear();

  const sumRow = (ln) => (ln.amounts || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const colSum = (kind, mi) => wb.lines.filter(l => l.kind === kind).reduce((a, l) => a + (Number(l.amounts?.[mi]) || 0), 0);
  const yearSum = (kind) => wb.lines.filter(l => l.kind === kind).reduce((a, l) => a + sumRow(l), 0);

  const income = yearSum('income');
  const expense = yearSum('expense');
  const net = income - expense;

  const cell = (ln, mi) => {
    const v = Number(ln.amounts?.[mi]) || 0;
    return `<td class="p-0 border-l border-slate-100 dark:border-slate-800">
      <input data-acc-bgt="${esc(ln.id)}" data-m="${mi}" type="text" inputmode="decimal"
        value="${v ? accBudgetFmt(v) : ''}" placeholder="—"
        class="w-full min-w-[4.5rem] px-2 py-1.5 text-right text-[12px] font-semibold tabular-nums bg-transparent text-slate-900 dark:text-white outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/40"
        onfocus="this.select()" onkeydown="accBudgetKey(event,this)" onchange="accBudgetCommit(this)">
    </td>`;
  };

  const rowHtml = (ln) => `
    <tr class="group border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
      <td class="p-0 sticky left-0 bg-white dark:bg-slate-900 z-[1]">
        <input data-acc-bgt-name="${esc(ln.id)}" value="${esc(ln.name)}" placeholder="Line name"
          class="w-full min-w-[10rem] px-3 py-1.5 text-[13px] font-bold bg-transparent text-slate-900 dark:text-white outline-none focus:bg-indigo-50 dark:focus:bg-indigo-950/40"
          onchange="accBudgetRename(this)">
      </td>
      <td class="p-0">
        <select data-acc-bgt-kind="${esc(ln.id)}" onchange="accBudgetKind(this)"
          class="w-full px-2 py-1.5 text-[11px] font-bold bg-transparent text-slate-600 dark:text-slate-300 outline-none">
          <option value="income" ${ln.kind === 'income' ? 'selected' : ''}>Income</option>
          <option value="expense" ${ln.kind === 'expense' ? 'selected' : ''}>Expense</option>
        </select>
      </td>
      ${ACC_BUDGET_MONTHS.map((_, i) => cell(ln, i)).join('')}
      <td class="px-2 py-1.5 text-right text-[12px] font-black tabular-nums ${ln.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}">${accBudgetFmt(sumRow(ln)) || '—'}</td>
      <td class="px-1 py-1 text-center">
        <button type="button" onclick="accBudgetDelRow('${esc(ln.id)}')" title="Remove line" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 text-sm font-black px-1">×</button>
      </td>
    </tr>`;

  const totRow = (label, kind, cls) => `
    <tr class="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
      <td class="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-50 dark:bg-slate-800/50">${label}</td>
      <td></td>
      ${ACC_BUDGET_MONTHS.map((_, i) => `<td class="px-2 py-2 text-right text-[12px] font-black tabular-nums ${cls}">${accBudgetFmt(colSum(kind, i)) || '—'}</td>`).join('')}
      <td class="px-2 py-2 text-right text-[12px] font-black tabular-nums ${cls}">${accBudgetFmt(yearSum(kind)) || '—'}</td>
      <td></td>
    </tr>`;

  const html = `
    <div id="acc-budget-sheet-host" class="space-y-4">
      <section class="ms-c--glass bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Workbook</div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">${year} operating budget</h3>
            <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Spreadsheet-style — add lines, type amounts, tab between cells. No Excel required.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="accBudgetShiftYear(-1)" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">← ${year - 1}</button>
            <button type="button" onclick="accBudgetShiftYear(1)" class="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">${year + 1} →</button>
            <button type="button" onclick="accBudgetAddRow()" class="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black shadow-sm">+ Add line</button>
            <button type="button" id="acc-budget-save-btn" onclick="accBudgetSave(this)" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md">Save budget</button>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3 mt-4">
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Income</div>
            <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">${accMoney(income)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Expense</div>
            <div class="text-lg font-black text-slate-900 dark:text-white tabular-nums">${accMoney(expense)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Net</div>
            <div class="text-lg font-black tabular-nums ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${accMoney(net)}</div>
          </div>
        </div>
      </section>

      <div class="ms-c--glass bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse min-w-[980px]">
            <thead>
              <tr class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                <th class="text-left px-3 py-2 sticky left-0 bg-slate-50 dark:bg-slate-800/80 z-[1]">Line</th>
                <th class="text-left px-2 py-2">Type</th>
                ${ACC_BUDGET_MONTHS.map(m => `<th class="text-right px-2 py-2">${m}</th>`).join('')}
                <th class="text-right px-2 py-2">${year} total</th>
                <th class="w-8"></th>
              </tr>
            </thead>
            <tbody>
              ${wb.lines.map(rowHtml).join('') || `<tr><td colspan="16" class="px-4 py-10 text-center text-slate-400 text-sm">No lines yet — press <b>+ Add line</b>.</td></tr>`}
              ${totRow('Total income', 'income', 'text-emerald-600 dark:text-emerald-400')}
              ${totRow('Total expense', 'expense', 'text-slate-800 dark:text-slate-100')}
            </tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <button type="button" onclick="accBudgetAddRow()" class="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline">+ Add another line</button>
          <span class="text-[11px] text-slate-400">Tab / Enter moves like a spreadsheet. Save stores this workbook on the dealership.</span>
        </div>
      </div>
    </div>`;

  if (host.id === 'acc-budget-sheet-host') host.outerHTML = html;
  else host.innerHTML = html;
}

function accBudgetFind(id) {
  return (window.__accBudgetWb?.lines || []).find(l => l.id === id);
}
function accBudgetParseAmt(raw) {
  const n = parseFloat(String(raw || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
}
function accBudgetCommit(el) {
  const ln = accBudgetFind(el.getAttribute('data-acc-bgt'));
  if (!ln) return;
  const mi = Number(el.getAttribute('data-m'));
  ln.amounts[mi] = accBudgetParseAmt(el.value);
  el.value = ln.amounts[mi] ? accBudgetFmt(ln.amounts[mi]) : '';
  accPaintBudgetSheet();
}
function accBudgetRename(el) {
  const ln = accBudgetFind(el.getAttribute('data-acc-bgt-name'));
  if (ln) ln.name = el.value.slice(0, 80);
}
function accBudgetKind(el) {
  const ln = accBudgetFind(el.getAttribute('data-acc-bgt-kind'));
  if (ln) ln.kind = el.value === 'income' ? 'income' : 'expense';
  accPaintBudgetSheet();
}
function accBudgetAddRow() {
  if (!window.__accBudgetWb) window.__accBudgetWb = { year: new Date().getFullYear(), lines: [] };
  window.__accBudgetWb.lines.push(accBudgetBlankLine());
  accPaintBudgetSheet();
  const last = document.querySelector('[data-acc-bgt-name]:last-of-type');
  last?.focus();
}
function accBudgetDelRow(id) {
  if (!window.__accBudgetWb) return;
  window.__accBudgetWb.lines = window.__accBudgetWb.lines.filter(l => l.id !== id);
  accPaintBudgetSheet();
}
function accBudgetKey(e, el) {
  if (e.key !== 'Enter' && e.key !== 'Tab') return;
  const cells = [...document.querySelectorAll('[data-acc-bgt][data-m]')];
  const i = cells.indexOf(el);
  if (i < 0) return;
  e.preventDefault();
  const next = e.shiftKey ? cells[i - 1] : cells[i + 1];
  if (next) { next.focus(); next.select?.(); }
  else if (!e.shiftKey) accBudgetAddRow();
}
async function accBudgetShiftYear(delta) {
  window.__accBudgetYear = (window.__accBudgetYear || new Date().getFullYear()) + delta;
  const body = document.getElementById('acc-budget-sheet-host')?.parentElement;
  if (body) accRenderBudgetSheet(body);
}
async function accBudgetSave(btn) {
  const wb = window.__accBudgetWb;
  if (!wb) return;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/accounting/budget', 'PUT', { workbook: wb, budgets: {} });
    showToast('Budget saved', 'success');
  } catch (e) {
    showToast(e.message || 'Could not save budget', 'error');
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}
Object.assign(window, {
  accRenderBudgetSheet, accPaintBudgetSheet, accBudgetAddRow, accBudgetDelRow,
  accBudgetCommit, accBudgetRename, accBudgetKind, accBudgetKey, accBudgetSave, accBudgetShiftYear,
});

function loadAccountingWorkspace() { renderEngine('accounting-overview'); }
window.loadAccountingWorkspace = loadAccountingWorkspace;
