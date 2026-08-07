// ── MarketSync Page Template Submodule (Part 2) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<div data-page-content="saas-employees" class="page-content hidden space-y-6">
        <div id="saas-employees-root"></div>
      </div>

<!-- MarketSync SaaS Accounting — the company P&L (recurring revenue + program cost). -->

<div data-page-content="saas-accounting" class="page-content hidden space-y-6">
        <div id="saas-accounting-root"></div>
      </div>

<div data-page-content="owner-users" class="page-content hidden space-y-6">
        <div id="owner-users-root"></div>
      </div>

<div data-page-content="people-compliance" class="page-content hidden space-y-6">
        <div id="people-compliance-root"></div>
      </div>

<div data-page-content="config" class="page-content hidden space-y-6">
        <div id="config-root"></div>
      </div>

<div data-page-content="api-keys" class="page-content hidden space-y-6">
        <div id="api-keys-root"></div>
      </div>

<!-- AI Chat inbox — live AI conversations + the embeddable widget snippet. -->

<div data-page-content="ai-inbox" class="page-content hidden space-y-6">
        <div id="ai-inbox-root"></div>
      </div>

<!-- Accounting — daily ledger, reconciliation, chart of accounts, P&L (managers). -->

<div data-page-content="accounting" class="page-content hidden space-y-6">
        <div id="accounting-root"></div>
      </div>

<!-- Affiliates admin — MarketSync owner manages affiliates + payouts. -->

<div data-page-content="affiliates-admin" class="page-content hidden space-y-6">
        <div id="affadmin-root"></div>
      </div>

<div data-page-content="reports" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Reports</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Every number in the store — pick a report, or build your own.</p>
        </div>

<!-- Report category picker — rendered by renderReportTabs() -->
        <div id="reports-tabs" class="flex flex-wrap gap-1.5"></div>

<!-- Overview: the original always-on report sections -->
        <div id="reports-overview" class="space-y-10">
          <!-- Custom report builder — pick who/what with dropdowns -->
          <div id="report-builder"></div>
          <!-- Executive ROI dashboard (managers) — injected by loadExecutiveRoi() -->
          <div id="exec-roi"></div>
          <!-- Inventory mix & aging report (managers) — injected by loadInventoryMix() -->
          <div id="inv-mix"></div>
          <!-- Sales analysis report (managers) — injected by loadSalesAnalysis() -->
          <div id="sales-analysis"></div>
          <!-- Marketing ROI report (managers) — injected by loadMarketingRoi() -->
          <div id="marketing-roi"></div>
        </div>

<!-- Deep reports (sales, F&I, leads, reps, appraisals, service, activity, customers) -->
        <div id="reports-dynamic" class="hidden"></div>
      </div>

<div data-page-content="desk" class="page-content hidden">
        <div id="desk-root"></div>
      </div>

<div data-page-content="insights" class="page-content hidden space-y-8">

<!-- MarketSync mode: the dashboard is the SaaS lead + revenue view, not vehicle metrics. -->
      <div id="ms-insights"></div>

<!-- Loading skeleton — visible until JS resolves the profile and hides it -->
      <div id="insights-skeleton" class="space-y-4">
        <div class="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
        </div>
      </div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 2]', e); }
})();
