/**
 * Accounting workspace — RESTORED PLACEHOLDER FIX IN PROGRESS
 * See next commit for full content.
 */
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
    const role = typeof profileContext !== 'undefined' ? profileContext?.role : null;
    const isOwner = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role);
    const isClerk = role === 'ACCOUNTING_CLERK';
    if (isOwner) return ['overview', 'money_in', 'money_out', 'bank', 'close', 'reports', 'budget', 'journal', 'payroll', 'settings'];
    if (isClerk) return ['overview', 'money_in', 'money_out', 'bank', 'payroll'];
    return ['overview', 'money_in', 'money_out', 'bank', 'close', 'reports', 'budget', 'payroll'];
  },
  tabs: {
    overview(body) { body.innerHTML = '<div class="p-4 text-sm">Accounting Pulse loading… Refresh if this persists.</div>'; },
    money_in(body) { body.innerHTML = '<div class="p-4 text-sm">Money In</div>'; },
    money_out(body) { body.innerHTML = '<div class="p-4 text-sm">Money Out</div>'; },
    bank(body) { body.innerHTML = '<div class="p-4 text-sm">Bank</div>'; },
    close(body) { body.innerHTML = '<div class="p-4 text-sm">Close</div>'; },
    reports(body) { body.innerHTML = '<div class="p-4 text-sm">Reports</div>'; },
    budget(body) { body.innerHTML = '<div class="p-4 text-sm">Budget</div>'; },
    journal(body) { body.innerHTML = '<div class="p-4 text-sm">Journal</div>'; },
    payroll(body) {
      body.innerHTML = '<div id="commissions-root" class="space-y-4"></div>';
      if (typeof window.loadCommissionsPage === 'function') window.loadCommissionsPage();
    },
    settings(body) { body.innerHTML = '<div class="p-4 text-sm">Settings</div>'; },
  },
  fetch: async () => ({ exceptions: [], receivables: [], payables: [], contracts: [] }),
};
function loadAccountingWorkspace() { if (typeof renderEngine === 'function') renderEngine('accounting-overview'); }
if (typeof window !== 'undefined') window.loadAccountingWorkspace = loadAccountingWorkspace;
