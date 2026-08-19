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
    { page: 'command', label: 'Executive / My Day' },
    { page: 'sales', label: 'Sales' },
    { page: 'crm', label: 'CRM' },
    { page: 'inventory-overview', label: 'Inventory' },
    { page: 'fni-overview', label: 'F&I' },
    { page: 'service-overview', label: 'Service' },
    { page: 'parts-overview', label: 'Parts' },
    { page: 'marketing-overview', label: 'Marketing' },
    { page: 'accounting-overview', label: 'Accounting' },
    { page: 'website', label: 'Website' },
    { page: 'academy', label: 'Academy' },
    { page: 'config', label: 'Administration' },
  ];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

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
    if (pkgId.includes('campaign') || pkgId.includes('email') || pkgId.includes('social')) return 'campaigns';
    if (pkgId.includes('website') || pkgId === 'dealer-website') return 'website';
    if (pkgId.includes('chatbot') || pkgId.includes('ai_')) return 'ai_chatbot';
    if (pkgId.includes('dealer-os') || pkgId.includes('suite') || pkgId === 'marketsync-digital') return 'dealer_os';
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
    // Append the badge to <body> as a FIXED, top-of-everything overlay (see the
    // #demo-mode-badge CSS: position:fixed, z-index above every product full-screen
    // modal). It must NOT live inside the header/product chrome: single-product tiers and
    // full-screen surfaces (Video / Design studio) hide or bury the header, and the
    // operator has to reach this switcher to get back out — that's exactly the flow that
    // broke when the badge was re-parented into the header. Appended BEFORE the panel is
    // built so a later panel/nav error can never drop it.
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
    try {
      const res = await apiCall('/demo/control');
      if (!res.ok) return; // not the demo account — render nothing
      const data = await res.json();
      window.__demoControlData = data;

      // Build the badge + panel FIRST so the operator can always reach the switcher —
      // even if the product-nav narrowing below throws on some tier. boot()'s outer catch
      // would otherwise swallow that error and leave no badge at all (the regression).
      buildPanel(data);

      // Narrow the demo's VISIBLE nav to the currently-selected package, so a prospect
      // sees just that one product's dashboard. The demo dealership is entitled to every
      // product server-side (the showcase overlay in access-policy.js), so without this
      // narrowing it would always show the full suite. This reuses the exact same
      // applyProductNav() a real single-product customer goes through, so the demo view
      // and a real single-product purchase render identically. Best-effort: never let it
      // drop the badge/panel we just built.
      if (data?.state?.packageId) {
        try {
          window.__demoPackageId = data.state.packageId;
          window.__demoActiveProduct = mapDemoPackageToProduct(data.state.packageId);

          const legacyMap = {
            design_studio: { design_studio: true },
            facebook: { facebook_solo: true },
            video: { marketsync_video: true },
            campaigns: { marketsync_social: true },
            website: { marketsync_website: true },
            ai_chatbot: { ai_chatbot: true },
            dealer_os: { dealer_os: true },
          };
          const prodObj = legacyMap[window.__demoActiveProduct] || { dealer_os: true };
          if (typeof applyProductNav === 'function') applyProductNav(prodObj);
          if (typeof renderDeptNav === 'function') renderDeptNav(data.state.roleKey || 'DEALER_ADMIN');
        } catch (e) { /* nav narrowing is best-effort; the badge/panel stay up */ }
      }

      const singleProduct = typeof window.isSingleProductWorkspace === 'function' && window.isSingleProductWorkspace();
      if (typeof switchPage === 'function' && !singleProduct) switchPage('inventory');
    } catch (e) { /* network hiccup — no demo panel this load, not fatal */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
