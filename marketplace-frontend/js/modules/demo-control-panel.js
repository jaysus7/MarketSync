/**
 * Demo Control Center — renders ONLY when GET /demo/control succeeds (i.e. the signed-in
 * account is the one dedicated demo login). No client-side flag decides visibility; the
 * server does, via routes/demo-control.js's tenant-only guard. A real customer's browser
 * gets a 403 and this file renders nothing.
 *
 * Package/role switches reload the page after a successful write — the safest way
 * to guarantee every module (nav, feature gates, workspace registry) picks up the new
 * entitlement/role context, matching how initializeDashboardEcosystem() boots everything
 * from a single /auth/me read on load. Department switching and Presentation Mode are
 * pure client-side (switchPage() / a CSS class) — no reload needed.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  const DEPARTMENTS = [
    { page: 'command', label: 'Executive / Pulse' },
    { page: 'sales', label: 'Sales' },
    { page: 'crm', label: 'CRM' },
    { page: 'inventory-overview', label: 'Inventory' },
    { page: 'recon', label: 'Cleanup' },
    { page: 'fni-overview', label: 'F&I' },
    { page: 'service-overview', label: 'Service' },
    { page: 'parts-overview', label: 'Parts' },
    { page: 'marketing-overview', label: 'Marketing' },
    { page: 'accounting-overview', label: 'Accounting' },
    { page: 'website', label: 'Website' },
    { page: 'academy', label: 'Academy' },
    { page: 'config', label: 'Administration' },
  ];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c])); }

  function apiBase() { return window.API || (location.hostname.includes('staging') ? 'https://marketsync-staging-backend.onrender.com' : 'https://vehicle-marketplace-s0e4.onrender.com'); }
  function getToken() { return localStorage.getItem('token'); }

  async function apiCall(path, opts) {
    return fetch(`${apiBase()}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...(opts && opts.headers) },
    });
  }

  function applyPresentationMode(on) {
    document.documentElement.classList.toggle('ms-presentation-mode', !!on);
  }

  const FIELD_ICON = {
    package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dcp-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-8.25-4.5-8.25 4.5m16.5 0-8.25 4.5m8.25-4.5v9l-8.25 4.5m0-9L3.75 7.5m8.25 4.5v9M3.75 7.5v9l8.25 4.5"/></svg>',
    role: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dcp-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/></svg>',
    department: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="dcp-svg"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M4.5 3h15v18h-15V3zM9 21V9h6v12"/></svg>',
  };

  function mapDemoPackageToProduct(pkgId) {
    if (!pkgId) return 'dealer_os';
    if (pkgId === 'design-studio') return 'design_studio';
    if (pkgId.includes('autoposter') || pkgId.includes('facebook') || pkgId === 'fb_solo' || pkgId === 'fb_dealership') return 'facebook';
    if (pkgId === 'video' || pkgId === 'marketsync_video') return 'video';
    if (pkgId.includes('campaign') || pkgId.includes('email')) return 'campaigns';
    if (pkgId.includes('website') || pkgId === 'dealer-website') return 'website';
    if (pkgId.includes('chatbot') || pkgId.includes('ai_')) return 'ai_chatbot';
    if (pkgId.includes('identity')) return 'marketsync_identity';
    if (pkgId === 'sales-marketing-suite' || pkgId === 'sales_marketing_suite') return 'sales-marketing-suite';
    if (pkgId === 'service-marketing-suite' || pkgId === 'service_marketing_suite') return 'service-marketing-suite';
    if (pkgId === 'complete-marketing-suite' || pkgId === 'complete_marketing_suite') return 'complete-marketing-suite';
    if (pkgId === 'marketsync-digital' || pkgId === 'marketsync_digital') return 'marketsync-digital';
    if (pkgId.includes('dealer-os') || pkgId.includes('dealer_os')) return 'dealer_os';
    return 'dealer_os';
  }

  window.openDemoControlPanel = function () {
    const p = document.getElementById('demo-control-panel');
    if (p) p.hidden = false;
  };
  window.toggleDemoControlPanel = function () {
    const p = document.getElementById('demo-control-panel');
    if (p) p.hidden = !p.hidden;
  };

  function buildPanel(data) {
    const badge = document.createElement('button');
    badge.id = 'demo-mode-badge';
    badge.type = 'button';
    badge.title = `Demo mode — ${data.dealership.name}`;
    badge.textContent = 'Demo';
    if (!document.getElementById('demo-mode-badge')) document.body.appendChild(badge);

    const field = (id, label, iconKey, options) => `
      <label class="dcp-field">
        <span class="dcp-field-icon">${FIELD_ICON[iconKey]}${esc(label)}</span>
        <span class="dcp-select-wrap"><select id="${id}">${options}</select></span>
      </label>`;

    const panel = document.createElement('div');
    panel.id = 'demo-control-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dcp-head">
        <div class="dcp-head-title">
          <span>Demo Control Center</span>
          <span class="dcp-dealer">${esc(data.dealership.name)}</span>
        </div>
        <button type="button" id="dcp-close" class="dcp-close" aria-label="Close">&times;</button>
      </div>
      <div class="dcp-body">
        <div class="dcp-section-label">What they're demoing</div>
        ${field('dcp-package', 'Package', 'package', data.packages.map(p => `<option value="${esc(p.id)}"${p.id === data.state.packageId ? ' selected' : ''}>${esc(p.label || p.id)}</option>`).join(''))}
        ${field('dcp-role', 'Role', 'role', data.roles.map(r => `<option value="${esc(r.key)}"${r.key === data.state.roleKey ? ' selected' : ''}>${esc(r.label)}${r.approximated ? ' *' : ''}</option>`).join(''))}
        <div class="dcp-divider"></div>
        <div class="dcp-section-label">Jump to</div>
        ${field('dcp-department', 'Department', 'department', DEPARTMENTS.map(d => `<option value="${esc(d.page)}">${esc(d.label)}</option>`).join(''))}
        <label class="dcp-toggle">
          <span>Presentation Mode</span>
          <input type="checkbox" id="dcp-presentation"${data.state.presentationMode ? ' checked' : ''}>
        </label>
        <div class="dcp-footer">
          <button type="button" id="dcp-reset" class="dcp-reset">Reset Demo</button>
          <div class="dcp-note">* approximated to the closest existing role</div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    badge.addEventListener('click', () => { window.toggleDemoControlPanel(); });
    panel.querySelector('#dcp-close').addEventListener('click', () => { panel.hidden = true; });
    document.addEventListener('click', (e) => {
      if (!panel.hidden && !panel.contains(e.target) && e.target !== badge) panel.hidden = true;
    });

    async function switchAndReload(path, body) {
      const res = await apiCall(path, { method: 'PUT', body: JSON.stringify(body) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Could not switch — please try again.'); return; }
      location.reload();
    }

    panel.querySelector('#dcp-package').addEventListener('change', (e) => switchAndReload('/demo/control/package', { packageId: e.target.value }));
    panel.querySelector('#dcp-role').addEventListener('change', (e) => switchAndReload('/demo/control/role', { roleKey: e.target.value }));
    panel.querySelector('#dcp-department').addEventListener('change', (e) => {
      panel.hidden = true;
      try { if (typeof switchPage === 'function') switchPage(e.target.value); } catch (err) {}
    });
    panel.querySelector('#dcp-presentation').addEventListener('change', async (e) => {
      applyPresentationMode(e.target.checked);
      await apiCall('/demo/control/presentation', { method: 'PUT', body: JSON.stringify({ presentationMode: e.target.checked }) });
    });
    panel.querySelector('#dcp-reset').addEventListener('click', async () => {
      if (!confirm('Reset the demo? This wipes and reseeds all demo data and restores the default package/role.')) return;
      const res = await apiCall('/demo/control/reset', { method: 'POST' });
      if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Reset failed — please try again.'); return; }
      location.reload();
    });

    applyPresentationMode(data.state.presentationMode);
  }

  async function boot() {
    if (window.__access && typeof window.isDemoAccount === 'function' && !window.isDemoAccount()) return;
    try {
      const res = await apiCall('/demo/control');
      if (!res.ok) return;
      const data = await res.json();
      window.__demoControlData = data;
      if (data.activePackage && Array.isArray(data.activePackage.products) && Array.isArray(data.activePackage.features)) {
        window.__demoEntitlements = {
          packageId: data.activePackage.id,
          products: data.activePackage.products,
          features: data.activePackage.features,
        };
      }

      buildPanel(data);

      if (data?.state?.packageId) {
        try {
          window.__demoPackageId = data.state.packageId;
          window.__demoActivePackage = data.state.packageId;
          window.__demoActiveProduct = mapDemoPackageToProduct(data.state.packageId);
          try {
            sessionStorage.setItem('ms_demo_package', data.state.packageId);
            localStorage.setItem('ms_demo_package', data.state.packageId);
          } catch {}

          const legacyMap = {
            design_studio: { design_studio: true },
            facebook: { facebook_solo: true },
            video: { marketsync_video: true },
            campaigns: { marketsync_email: true },
            website: { marketsync_website: true },
            ai_chatbot: { ai_chatbot: true },
            marketsync_identity: { marketsync_identity: true },
            'sales-marketing-suite': { 'sales-marketing-suite': true },
            'service-marketing-suite': { 'service-marketing-suite': true },
            'complete-marketing-suite': { 'complete-marketing-suite': true },
            'marketsync-digital': { 'marketsync-digital': true },
            dealer_os: { dealer_os: true },
          };
          const prodObj = legacyMap[window.__demoActiveProduct] || { dealer_os: true };
          if (typeof applyProductNav === 'function') applyProductNav(prodObj);
          if (typeof renderDeptNav === 'function') renderDeptNav(data.state.roleKey || 'DEALER_ADMIN');
        } catch (e) { /* nav narrowing is best-effort; the badge/panel stay up */ }
      }

      const suiteProducts = new Set(['sales-marketing-suite', 'service-marketing-suite', 'complete-marketing-suite', 'marketsync-digital']);
      const isMarketingSuiteDemo = suiteProducts.has(window.__demoActiveProduct);
      const isIdentityVerifyDemo = window.__demoActiveProduct === 'marketsync_identity';
      const singleProduct = typeof window.isSingleProductWorkspace === 'function' && window.isSingleProductWorkspace();
      const current = window.__currentPage || '';
      if (isIdentityVerifyDemo && current !== 'crm') {
        if (typeof switchPage === 'function') switchPage('crm');
      } else if (isMarketingSuiteDemo) {
        if (typeof deptGo === 'function') deptGo('marketing-overview', '', 'overview');
        else if (typeof switchPage === 'function') switchPage('marketing-overview');
      } else if (typeof switchPage === 'function' && !singleProduct) {
        // A full DealerOS demo otherwise lands wherever the dashboard happened to
        // boot, which for a fresh demo tenant can be an empty Home page. Inventory
        // always has vehicles to show. 'inventory' rather than 'inventory-overview':
        // this account switches between a full DealerOS package and a Facebook-only
        // one, and switchPage() resolves the generic id to whichever concrete page
        // the active tier has. Guarded by !singleProduct — a standalone product demo
        // has no Inventory page to land on. (`singleProduct` was already computed
        // for exactly this guard and had no other reader.)
        switchPage('inventory');
      }
    } catch (e) { /* network hiccup — no demo panel this load, not fatal */ }
    document.body.classList.remove('ms-app-booting');
    window.__msHoldBootForDemo = false;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

// Mobile "All pages" fix: when Demo is previewing DealerOS, do not trap the sheet
// in MarketSync SaaS admin pages (Accounts / Leads / Work / …).
(function patchRestrictedNavForDealerOsDemo() {
  const install = () => {
    const orig = window.restrictedNavPages;
    if (typeof orig !== 'function' || orig.__msDemoNavPatched) return;
    function restrictedNavPagesPatched() {
      const result = orig.apply(this, arguments);
      const demoProd = (window.__demoActiveProduct || window.__demoActivePackage || '').toString().toLowerCase();
      const demoIsActive = !!(window.__demoActiveProduct || window.__demoActivePackage);
      const demoForcesDealerOs = !demoProd
        || demoProd === 'dealer_os'
        || demoProd === 'dealer-os'
        || demoProd.includes('dealer-os')
        || demoProd.includes('dealer_os');
      if (demoIsActive && demoForcesDealerOs
          && Array.isArray(result)
          && result[0]
          && result[0].page === 'saas-command') {
        return null;
      }
      return result;
    }
    restrictedNavPagesPatched.__msDemoNavPatched = true;
    window.restrictedNavPages = restrictedNavPagesPatched;
  };
  install();
  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 0);
  setTimeout(install, 500);
})();
