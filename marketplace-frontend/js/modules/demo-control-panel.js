/**
 * Demo Control Center — renders ONLY when GET /demo/control succeeds (i.e. the signed-in
 * account is the one dedicated demo login). No client-side flag decides visibility; the
 * server does, via routes/demo-control.js's tenant-only guard. A real customer's browser
 * gets a 403 and this file renders nothing.
 *
 * Package/role/scenario switches reload the page after a successful write — the safest way
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
  const SCENARIO_LABELS = {
    healthy: 'Healthy Dealership', needs_attention: 'Needs Attention', busy_sales_day: 'Busy Sales Day',
    service_department: 'Service Department', marketing_demo: 'Marketing Demo', dealer_principal: 'Dealer Principal',
  };

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

  function buildPanel(data) {
    const badge = document.createElement('button');
    badge.id = 'demo-mode-badge';
    badge.type = 'button';
    badge.title = `Demo mode — ${data.dealership.name}`;
    badge.textContent = 'DEMO MODE';

    const panel = document.createElement('div');
    panel.id = 'demo-control-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="dcp-head">
        <span>Demo Control</span>
        <span class="dcp-dealer">${esc(data.dealership.name)}</span>
      </div>
      <label class="dcp-field">Package
        <select id="dcp-package">${data.packages.map(p => `<option value="${esc(p.id)}"${p.id === data.state.packageId ? ' selected' : ''}>${esc(p.label || p.id)}</option>`).join('')}</select>
      </label>
      <label class="dcp-field">Role
        <select id="dcp-role">${data.roles.map(r => `<option value="${esc(r.key)}"${r.key === data.state.roleKey ? ' selected' : ''}>${esc(r.label)}${r.approximated ? ' *' : ''}</option>`).join('')}</select>
      </label>
      <label class="dcp-field">Scenario
        <select id="dcp-scenario">${data.scenarios.map(s => `<option value="${esc(s)}"${s === data.state.scenario ? ' selected' : ''}>${esc(SCENARIO_LABELS[s] || s)}</option>`).join('')}</select>
      </label>
      <label class="dcp-field">Department
        <select id="dcp-department">${DEPARTMENTS.map(d => `<option value="${esc(d.page)}">${esc(d.label)}</option>`).join('')}</select>
      </label>
      <label class="dcp-toggle">
        <input type="checkbox" id="dcp-presentation"${data.state.presentationMode ? ' checked' : ''}>
        Presentation Mode
      </label>
      <button type="button" id="dcp-reset" class="dcp-reset">Reset Demo</button>
      <div class="dcp-note">* approximated to the closest existing role</div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(badge);

    badge.addEventListener('click', () => { panel.hidden = !panel.hidden; });
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
    panel.querySelector('#dcp-scenario').addEventListener('change', (e) => switchAndReload('/demo/control/scenario', { scenario: e.target.value }));
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
      buildPanel(data);
    } catch (e) { /* network hiccup — no demo panel this load, not fatal */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
