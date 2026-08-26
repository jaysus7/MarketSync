/**
 * Mobile nav fix: when Demo Control Center is previewing DealerOS, do not trap
 * the "All pages" sheet in MarketSync SaaS admin destinations (Accounts/Leads/…).
 * Runs after dashboard.js so it can wrap restrictedNavPages.
 */
(function () {
  const orig = window.restrictedNavPages;
  if (typeof orig !== 'function') return;
  window.restrictedNavPages = function restrictedNavPagesPatched() {
    const result = orig.apply(this, arguments);
    const demoProd = (window.__demoActiveProduct || window.__demoActivePackage || '').toString().toLowerCase();
    const demoIsActive = !!(window.__demoActiveProduct || window.__demoActivePackage);
    const demoForcesDealerOs = !demoProd
      || demoProd === 'dealer_os'
      || demoProd === 'dealer-os'
      || demoProd.includes('dealer-os')
      || demoProd.includes('dealer_os');
    // SaaS admin short-list starts with saas-command. When demoing DealerOS,
    // force the full department path (null = use MS_WORKSPACES / desktop depts).
    if (demoIsActive && demoForcesDealerOs
        && Array.isArray(result)
        && result[0]
        && result[0].page === 'saas-command') {
      return null;
    }
    return result;
  };
})();
