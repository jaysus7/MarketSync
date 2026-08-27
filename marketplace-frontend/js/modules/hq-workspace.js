/* MarketSync HQ — entitlements, catalog, trials, search. Uses live /saas and /owner APIs. */
const HQ_CATALOG = [
  ['facebook_solo', 'Facebook AutoPoster — Salesperson', 19],
  ['facebook_dealer', 'Facebook AutoPoster — Dealer', 79],
  ['marketsync_social', 'Social Scheduler', 59],
  ['design_studio', 'Design Studio', 5],
  ['marketsync_video', 'Video', 99],
  ['marketsync_email', 'Campaigns', 129],
  ['marketsync_website', 'Dealer Website', 249],
  ['ai_chatbot', 'AI ChatBot', 299],
  ['sales-marketing-suite', 'Sales Marketing Suite', 249],
  ['service-marketing-suite', 'Service Marketing Suite', 249],
  ['complete-marketing-suite', 'Complete Marketing Suite', 399],
  ['marketsync-digital', 'MarketSync Digital', 599],
  ['dealer_os_core', 'DealerOS Core', 1499],
  ['dealer_os_pro', 'DealerOS Pro', 2499],
  ['dealer_os', 'DealerOS Complete', 3999],
];

function hqEnvBanner() {
  if (document.getElementById('hq-env-banner')) return;
  const host = location.hostname || '';
  const prod = /marketsync\.link$/.test(host) && !/staging/.test(host);
  const bar = document.createElement('div');
  bar.id = 'hq-env-banner';
  bar.className = prod
    ? 'fixed top-0 left-0 right-0 z-[200] text-center text-[11px] font-black tracking-wider py-1 bg-rose-600 text-white'
    : 'fixed top-0 left-0 right-0 z-[200] text-center text-[11px] font-black tracking-wider py-1 bg-amber-500 text-slate-950';
  bar.textContent = prod ? 'PRODUCTION — HQ changes are live' : 'STAGING — HQ sandbox';
  document.body.appendChild(bar);
}

function hqEntitlementMatrix(d) {
  const enabled = new Set(d.product_keys || Object.keys(d.products || {}).filter(k => d.products[k]));
  const rows = HQ_CATALOG.map(([key, label]) => {
    const on = enabled.has(key);
    return `<div class="grid grid-cols-12 gap-2 items-center py-2 border-t border-slate-100 dark:border-slate-800 text-[12px]">
      <div class="col-span-5 font-semibold text-slate-800 dark:text-slate-100">${esc(label)}</div>
      <div class="col-span-2 text-slate-500">${on ? 'Entitled' : 'Off'}</div>
      <div class="col-span-2 ${on ? 'text-emerald-600 font-bold' : 'text-slate-400'}">${on ? 'Enabled' : 'Disabled'}</div>
      <div class="col-span-3 text-right">
        <button type="button" class="px-2 py-1 rounded-lg text-[11px] font-black ${on ? 'bg-rose-50 text-rose-600' : 'bg-indigo-600 text-white'}"
          onclick="hqToggleProduct('${d.id}','${key}',${!on})">${on ? 'Disable' : 'Enable'}</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4 mt-4 mb-4">
    <div class="text-[13px] font-black text-slate-800 dark:text-white mb-1">Products & entitlements</div>
    <p class="text-[11px] text-slate-500 mb-2">Purchased / entitled / enabled. Disable is an HQ override and must include a reason.</p>
    ${rows}
    <div class="flex flex-wrap gap-2 mt-3">
      <button type="button" class="px-3 py-1.5 rounded-xl text-[11px] font-black bg-amber-500 text-slate-950" onclick="hqExtendTrial('${d.id}')">Extend trial</button>
      <button type="button" class="px-3 py-1.5 rounded-xl text-[11px] font-black border border-slate-200 dark:border-slate-700" onclick="hqSupportSession('${d.id}')">Start support inspect</button>
      <button type="button" class="px-3 py-1.5 rounded-xl text-[11px] font-black bg-indigo-600 text-white" onclick="hqOpenBilling('${d.id}')">Open billing</button>
    </div>
  </div>`;
}

window.hqToggleProduct = async function(dealershipId, key, active) {
  const reason = prompt((active ? 'Enable ' : 'Disable ') + key + ' — reason (required)') || '';
  if (!reason.trim()) { if (typeof showToast === 'function') showToast('Reason required', 'error'); return; }
  try {
    await apiSendJson('/owner/dealership/' + dealershipId + '/products', 'POST', { key, active: !!active, reason });
    if (typeof showToast === 'function') showToast((active ? 'Enabled ' : 'Disabled ') + key, 'success');
    if (typeof renderSaasCustomer === 'function') await renderSaasCustomer(dealershipId);
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not change entitlement', 'error');
  }
};

async function loadHqEntitlements() {
  const root = document.getElementById('saas-entitlements-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading accounts…</div>';
  try {
    const d = await apiGetJson('/owner/accounts');
    const accounts = d.accounts || [];
    root.innerHTML = `
      ${typeof pulseHeader === 'function' ? pulseHeader('Entitlements', 'Every dealership product matrix. Toggle is an HQ override.') : '<h1 class="text-2xl font-black">Entitlements</h1>'}
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table class="w-full text-left text-xs">
          <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
            <th class="p-3">Dealership</th><th class="p-3">Status</th><th class="p-3">Products</th><th class="p-3"></th>
          </tr></thead>
          <tbody>${accounts.slice(0, 200).map(a => `
            <tr class="border-t border-slate-100 dark:border-slate-800">
              <td class="p-3 font-bold">${esc(a.name || a.id)}</td>
              <td class="p-3">${esc(a.billing_status || '—')}</td>
              <td class="p-3">${Object.keys(a.products || {}).filter(k => a.products[k]).map(k => esc((window.SAAS_PRODUCT_LABEL||{})[k] || k)).join(', ') || '—'}</td>
              <td class="p-3 text-right"><button class="text-indigo-600 font-black" onclick="openSaasCustomer('${a.id}')">Open 360</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Owner API required')}</div>`;
  }
}

function loadHqProducts() {
  const root = document.getElementById('saas-products-root'); if (!root) return;
  root.innerHTML = `
    ${typeof pulseHeader === 'function' ? pulseHeader('Product catalog', 'List prices in CAD. Stripe IDs stay in billing config.') : ''}
    <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      ${HQ_CATALOG.map(([key, label, cad]) => `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div class="text-[10px] font-black uppercase text-slate-400">${esc(key)}</div>
          <div class="text-sm font-black text-slate-900 dark:text-white mt-1">${esc(label)}</div>
          <div class="text-lg font-black text-indigo-600 mt-2">$${cad} <span class="text-xs font-semibold text-slate-400">CAD/mo</span></div>
        </div>`).join('')}
    </div>`;
}

async function loadHqTrials() {
  const root = document.getElementById('saas-trials-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading trials…</div>';
  try {
    const d = await apiGetJson('/saas/overview');
    const trials = d.trials || [];
    root.innerHTML = `
      ${typeof pulseHeader === 'function' ? pulseHeader('Trials', 'Expiring access across the platform') : ''}
      <div class="space-y-2">${trials.length ? trials.map(t => `
        <button type="button" onclick="${t.id ? `openSaasCustomer('${t.id}')` : ''}" class="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div class="font-black text-slate-900 dark:text-white">${esc(t.name || 'Account')}</div>
          <div class="text-xs text-slate-500">${t.days_left != null ? t.days_left + ' days left' : 'Trialing'}</div>
        </button>`).join('') : '<div class="text-sm text-slate-400">No trials returned by /saas/overview.</div>'}</div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Could not load trials')}</div>`;
  }
}

function hqOpenSearch() {
  document.getElementById('hq-search')?.remove();
  const el = document.createElement('div');
  el.id = 'hq-search';
  el.className = 'fixed inset-0 z-[210] flex items-start justify-center p-6 bg-slate-950/50';
  el.innerHTML = `<div class="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
    <input id="hq-search-q" autofocus placeholder="Search dealership, email, account id…" class="w-full px-4 py-3 text-sm bg-transparent border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
    <div id="hq-search-out" class="max-h-80 overflow-y-auto p-2 text-sm text-slate-500">Type at least 2 characters.</div>
  </div>`;
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  document.body.appendChild(el);
  const q = document.getElementById('hq-search-q');
  let tmr;
  q.oninput = () => {
    clearTimeout(tmr);
    tmr = setTimeout(async () => {
      const v = q.value.trim();
      const out = document.getElementById('hq-search-out');
      if (v.length < 2) { out.textContent = 'Type at least 2 characters.'; return; }
      try {
        const [cust, users] = await Promise.all([
          apiGetJson('/saas/customers').catch(() => ({})),
          apiGetJson('/owner/users').catch(() => ({ users: [] })),
        ]);
        const accounts = Object.values(cust.by_stage || {}).flat().filter(a => JSON.stringify(a).toLowerCase().includes(v.toLowerCase()));
        const people = (users.users || []).filter(u => JSON.stringify(u).toLowerCase().includes(v.toLowerCase()));
        const accHtml = accounts.slice(0, 12).map(a => `<button type="button" class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800" onclick="document.getElementById('hq-search')?.remove();openSaasCustomer('${a.id}')"><span class="text-[10px] font-black uppercase text-slate-400">Dealership</span> ${esc(a.name || a.id)}</button>`).join('');
        const userHtml = people.slice(0, 12).map(u => `<button type="button" class="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800" onclick="document.getElementById('hq-search')?.remove();${u.dealership_id ? `openSaasCustomer('${u.dealership_id}')` : ''}"><span class="text-[10px] font-black uppercase text-slate-400">User</span> ${esc(u.name)} · ${esc(u.email||'')} · ${esc(u.dealership||'')}</button>`).join('');
        out.innerHTML = accHtml + userHtml || '<div class="p-3">No matches.</div>';
      } catch (e) { out.textContent = e.message || 'Search failed'; }
    }, 200);
  };
}

window.loadHqEntitlements = loadHqEntitlements;
window.loadHqProducts = loadHqProducts;
window.loadHqTrials = loadHqTrials;
window.hqEntitlementMatrix = hqEntitlementMatrix;
window.hqOpenSearch = hqOpenSearch;
window.hqEnvBanner = hqEnvBanner;
if (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) {
  document.addEventListener('DOMContentLoaded', hqEnvBanner);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); hqOpenSearch(); }
  });
}


window.hqExtendTrial = async function(id) {
  const days = prompt('Extend trial by how many days?', '14');
  if (!days) return;
  const reason = prompt('Reason (required)') || '';
  if (!reason.trim()) return showToast('Reason required', 'error');
  try {
    await apiSendJson('/owner/dealership/' + id + '/trial', 'POST', { days: Number(days), reason });
    showToast('Trial extended', 'success');
    if (typeof renderSaasCustomer === 'function') await renderSaasCustomer(id);
  } catch (e) { showToast(e.message || 'Could not extend trial', 'error'); }
};

window.hqSupportSession = async function(id) {
  const reason = prompt('Support inspect reason (required)') || '';
  if (!reason.trim()) return showToast('Reason required', 'error');
  try {
    const d = await apiSendJson('/owner/support-session', 'POST', { dealership_id: id, reason });
    window.__hqSupportSession = d;
    let bar = document.getElementById('hq-support-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'hq-support-banner';
      bar.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[220] px-4 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-black shadow-xl flex items-center gap-3';
      document.body.appendChild(bar);
    }
    bar.innerHTML = `SUPPORT INSPECT · ${esc(id.slice(0,8))} · ends ${esc(String(d.expires_at||'').slice(11,16))} UTC <button class="underline" onclick="document.getElementById('hq-support-banner')?.remove();window.__hqSupportSession=null">Exit</button>`;
    showToast(d.note || 'Support inspect started', 'info');
    if (typeof openSaasCustomer === 'function') openSaasCustomer(id);
  } catch (e) { showToast(e.message || 'Could not start support session', 'error'); }
};

async function loadHqAudit() {
  const root = document.getElementById('saas-audit-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading audit…</div>';
  try {
    const d = await apiGetJson('/owner/audit');
    const ev = d.events || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Audit log','HQ actions from audit_log'):''}
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table class="w-full text-left text-xs"><thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <th class="p-3">When</th><th class="p-3">Action</th><th class="p-3">Actor</th><th class="p-3">Dealership</th></tr></thead>
          <tbody>${ev.map(e => `<tr class="border-t border-slate-100 dark:border-slate-800"><td class="p-3 whitespace-nowrap">${esc(String(e.created_at||'').replace('T',' ').slice(0,16))}</td><td class="p-3 font-bold">${esc(e.action)}</td><td class="p-3">${esc(e.actor_email||e.actor_id||'—')}</td><td class="p-3">${esc(e.dealership_id||'—')}</td></tr>`).join('') || '<tr><td class="p-3" colspan="4">No HQ audit rows yet.</td></tr>'}</tbody></table></div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

async function loadHqSecurity() {
  const root = document.getElementById('saas-security-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading security events…</div>';
  try {
    const d = await apiGetJson('/owner/security');
    const ev = d.events || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Security center','security_events stream'):''}
      <div class="space-y-2">${ev.slice(0,80).map(e => `<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
        <div class="font-black">${esc(e.event_type)}</div>
        <div class="text-slate-500">${esc(String(e.created_at||'').replace('T',' ').slice(0,19))} · ${esc(e.ip||'no ip')} · user ${esc(e.user_id||'—')}</div>
      </div>`).join('') || '<div class="text-sm text-slate-400">No security events readable.</div>'}</div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

async function loadHqFlags() {
  const root = document.getElementById('saas-flags-root'); if (!root) return;
  root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Feature flags','Per-dealership flags on dealerships.feature_flags. Not a paid entitlement.'):''}
    <p class="text-sm text-slate-500 mb-3">Open a customer 360 from Entitlements or Dealerships, then use support inspect. Flag writes: POST /owner/flags/:dealershipId with key, active, reason.</p>
    <div class="text-sm">Use Customer 360 search (Ctrl/Cmd-K) then apply flags against a known account id.</div>
    <form class="mt-4 grid gap-2 max-w-md" onsubmit="event.preventDefault();hqWriteFlag();">
      <input id="hq-flag-id" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Dealership UUID">
      <input id="hq-flag-key" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Flag key e.g. beta_video">
      <select id="hq-flag-on" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm"><option value="true">Enable</option><option value="false">Disable</option></select>
      <input id="hq-flag-reason" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" placeholder="Reason">
      <button class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black">Write flag</button>
    </form>`;
}
window.hqWriteFlag = async function() {
  const id = document.getElementById('hq-flag-id')?.value.trim();
  const key = document.getElementById('hq-flag-key')?.value.trim();
  const active = document.getElementById('hq-flag-on')?.value === 'true';
  const reason = document.getElementById('hq-flag-reason')?.value.trim();
  if (!id || !key || !reason) return showToast('Dealership, key, and reason required', 'error');
  try {
    await apiSendJson('/owner/flags/' + id, 'POST', { key, active, reason });
    showToast('Flag saved', 'success');
  } catch (e) { showToast(e.message || 'Flag write failed', 'error'); }
};

window.loadHqAudit = loadHqAudit;
window.loadHqSecurity = loadHqSecurity;
window.loadHqFlags = loadHqFlags;


const HQ_MODULES = [
  ['sales.crm','Sales CRM'],['sales.desk','Desk a Deal'],['sales.calendar','Sales calendar'],
  ['inventory.manage','Inventory'],['inventory.intelligence','Inventory intelligence'],
  ['service.ros','Repair orders'],['service.schedule','Service schedule'],
  ['parts.counter','Parts counter'],['accounting.ledger','Accounting ledger'],
  ['accounting.commissions','Commissions'],['marketing.studio','Design Studio'],
  ['marketing.scheduler','Social Scheduler'],['hr.people','HR / People'],['admin.settings','Settings'],
];

window.hqModuleMatrix = function(d) {
  if (!d?.id) return '';
  return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4 mt-3">
    <div class="text-[13px] font-black mb-2">DealerOS modules</div>
    <p class="text-[11px] text-slate-500 mb-2">Package default plus HQ override. Stored on feature_flags.dealer_os_modules.</p>
    ${HQ_MODULES.map(([k,l]) => `<div class="flex items-center justify-between py-1.5 border-t border-slate-100 dark:border-slate-800 text-[12px]">
      <span>${l}</span>
      <button class="text-[11px] font-black text-indigo-600" onclick="hqToggleModule('${d.id}','${k}')">Toggle</button>
    </div>`).join('')}
  </div>`;
};

window.hqToggleModule = async function(id, key) {
  const reason = prompt('Toggle ' + key + ' — reason') || '';
  if (!reason.trim()) return showToast('Reason required', 'error');
  try {
    const cur = await apiGetJson('/owner/modules/' + id);
    const on = !!(cur.modules && cur.modules[key]);
    await apiSendJson('/owner/modules/' + id, 'POST', { key, active: !on, reason });
    showToast((on ? 'Disabled ' : 'Enabled ') + key, 'success');
  } catch (e) { showToast(e.message || 'Module update failed', 'error'); }
};

async function loadHqUsage() {
  const root = document.getElementById('saas-usage-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading usage…</div>';
  try {
    const d = await apiGetJson('/owner/usage');
    const ns = Object.entries(d.by_namespace || {}).sort((a,b)=>b[1]-a[1]);
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Usage','Last 30 days from events table'):''}
      <div class="text-sm mb-3">${Number(d.total_events||0).toLocaleString()} events</div>
      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          ${ns.map(([k,v]) => `<div class="flex justify-between py-1 text-sm border-t border-slate-100 dark:border-slate-800 first:border-0"><span>${esc(k)}</span><b>${v}</b></div>`).join('') || 'No events'}
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          ${(d.top_dealerships||[]).map(r => `<button class="w-full text-left py-1.5 text-sm border-t border-slate-100 dark:border-slate-800 first:border-0" onclick="openSaasCustomer('${r.dealership_id}')"><b>${esc(r.dealership_id.slice(0,8))}</b> · ${r.events_30d} events</button>`).join('') || 'No dealership activity'}
        </div>
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

async function loadHqHealth() {
  const root = document.getElementById('saas-health-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Checking systems…</div>';
  try {
    const d = await apiGetJson('/owner/health');
    const email = await apiGetJson('/owner/email/health').catch(() => null);
    const entries = Object.entries(d.checks || {});
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('System health','Live checks — not decorative'):''}
      <div class="grid md:grid-cols-2 gap-3">
        ${entries.map(([k,v]) => `<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div class="text-[10px] font-black uppercase text-slate-400">${esc(k)}</div>
          <div class="text-lg font-black ${v && v.ok === false ? 'text-rose-600' : 'text-emerald-600'}">${v && v.ok === false ? 'Down' : (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : 'OK')}</div>
          <div class="text-xs text-slate-500">${esc(v && v.error ? v.error : (v && v.ms != null ? v.ms + ' ms' : JSON.stringify(v)))}</div>
        </div>`).join('')}
        ${email ? `<div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><div class="text-[10px] font-black uppercase text-slate-400">Email</div><pre class="text-[11px] whitespace-pre-wrap">${esc(JSON.stringify(email, null, 2))}</pre></div>` : ''}
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

window.loadHqUsage = loadHqUsage;
window.loadHqHealth = loadHqHealth;


window.hqUserStatus = async function(userId, active) {
  const reason = prompt((active ? 'Activate' : 'Deactivate') + ' user — reason') || '';
  if (!reason.trim()) return showToast('Reason required', 'error');
  try {
    await apiSendJson('/owner/user/' + userId + '/status', 'POST', { active: !!active, reason });
    showToast(active ? 'User activated' : 'User deactivated', 'success');
    if (typeof loadOwnerUsersPage === 'function') loadOwnerUsersPage();
  } catch (e) { showToast(e.message || 'Could not update user', 'error'); }
};

async function loadHqOnboarding() {
  const root = document.getElementById('saas-onboarding-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading onboarding…</div>';
  try {
    const d = await apiGetJson('/owner/onboarding');
    const rows = d.accounts || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Onboarding','Profile, users, products, billing, integrations'):''}
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table class="w-full text-left text-xs">
          <thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th class="p-3">Dealership</th><th class="p-3">%</th><th class="p-3">Steps</th><th class="p-3"></th></tr></thead>
          <tbody>${rows.slice(0,250).map(a => `<tr class="border-t border-slate-100 dark:border-slate-800">
            <td class="p-3 font-bold">${esc(a.name||a.id)}</td>
            <td class="p-3">${a.percent}%</td>
            <td class="p-3">${Object.entries(a.steps||{}).map(([k,v]) => v ? k : '<s>'+k+'</s>').join(' · ')}</td>
            <td class="p-3"><button class="text-indigo-600 font-black" onclick="openSaasCustomer('${a.id}')">360</button></td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

async function loadHqIntegrations() {
  const root = document.getElementById('saas-integrations-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading integrations…</div>';
  try {
    const d = await apiGetJson('/owner/integrations');
    const rows = d.connections || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Integrations','dealer_integrations across customers'):''}
      <div class="space-y-2">${rows.length ? rows.slice(0,300).map(r => `
        <button class="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-sm" onclick="openSaasCustomer('${r.dealership_id}')">
          <b>${esc(r.provider)}</b> · ${esc(r.status||'unknown')} · ${r.enabled ? 'enabled' : 'off'}
          <div class="text-[11px] text-slate-500">${esc(r.dealership_id)} · ${esc(String(r.updated_at||'').slice(0,16))}</div>
        </button>`).join('') : '<div class="text-sm text-slate-400">No dealer_integrations rows.</div>'}</div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

window.loadHqOnboarding = loadHqOnboarding;
window.loadHqIntegrations = loadHqIntegrations;


async function loadHqAllUsers() {
  const root = document.getElementById('saas-all-users-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading users…</div>';
  try {
    const d = await apiGetJson('/owner/users');
    const users = d.users || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('All users','Every profile across dealerships'):''}
      <input id="hq-user-q" oninput="hqFilterUsers()" placeholder="Search name, email, dealership, role" class="w-full max-w-lg mb-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
      <div id="hq-user-table" class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"></div>`;
    window.__hqUsers = users;
    hqFilterUsers();
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}
window.hqFilterUsers = function() {
  const q = (document.getElementById('hq-user-q')?.value || '').toLowerCase();
  const host = document.getElementById('hq-user-table'); if (!host) return;
  const rows = (window.__hqUsers || []).filter(u => !q || JSON.stringify(u).toLowerCase().includes(q)).slice(0, 400);
  host.innerHTML = `<table class="w-full text-left text-xs"><thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
    <th class="p-3">User</th><th class="p-3">Dealership</th><th class="p-3">Role</th><th class="p-3">Status</th><th class="p-3"></th></tr></thead>
    <tbody>${rows.map(u => `<tr class="border-t border-slate-100 dark:border-slate-800">
      <td class="p-3"><b>${esc(u.name)}</b><div class="text-slate-400">${esc(u.email||'')}</div></td>
      <td class="p-3">${esc(u.dealership||'—')}</td>
      <td class="p-3">${esc(u.role||'—')}</td>
      <td class="p-3">${u.active ? 'Active' : 'Inactive'}</td>
      <td class="p-3 text-right whitespace-nowrap">
        <button class="font-black text-indigo-600" onclick="hqChangeDealerRole('${u.id}')">Role</button>
        <button class="font-black text-rose-600 ml-2" onclick="hqUserStatus('${u.id}', ${u.active ? 'false' : 'true'})">${u.active ? 'Deactivate' : 'Activate'}</button>
        ${u.dealership_id ? `<button class="font-black text-slate-600 ml-2" onclick="openSaasCustomer('${u.dealership_id}')">360</button>` : ''}
      </td></tr>`).join('')}</tbody></table>`;
};
window.hqChangeDealerRole = async function(id) {
  const role = prompt('Dealer role (SALES_REP, SERVICE_ADVISOR, ACCOUNTING, …)') || '';
  const reason = prompt('Reason') || '';
  if (!role || !reason) return;
  try {
    await apiSendJson('/owner/user/' + id + '/role', 'POST', { role, reason });
    showToast('Role updated', 'success');
    loadHqAllUsers();
  } catch (e) { showToast(e.message || 'Role change failed', 'error'); }
};

async function loadHqRoles() {
  const root = document.getElementById('saas-roles-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading HQ roles…</div>';
  try {
    const d = await apiGetJson('/saas/employees');
    const matrix = d.permissions_matrix || {};
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('HQ roles','saas_role permissions — owner is platform super-admin'):''}
      <div class="grid md:grid-cols-2 gap-3 mb-4">${Object.entries(matrix).map(([role, perms]) => `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div class="font-black capitalize">${esc(role)}</div>
          <div class="text-xs text-slate-500 mt-1">${(perms||[]).join(', ')}</div>
        </div>`).join('')}</div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        ${(d.staff||[]).map(s => `<div class="flex justify-between py-2 border-t border-slate-100 dark:border-slate-800 first:border-0 text-sm">
          <span><b>${esc(s.name)}</b> · ${esc(s.email||'')}</span><span>${esc(s.saas_role||'')} · ${s.active ? 'active' : 'off'}</span>
        </div>`).join('') || 'No HQ staff rows.'}
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}

window.loadHqAllUsers = loadHqAllUsers;
window.loadHqRoles = loadHqRoles;


function hqConfirmProd(action) {
  const prod = /marketsync\.link$/.test(location.hostname || '') && !/staging/.test(location.hostname || '');
  if (!prod) return true;
  return confirm('PRODUCTION billing action: ' + action + '. Continue?');
}
function hqMoney(cents, cur) {
  const n = Number(cents || 0) / 100;
  return (cur || 'cad').toUpperCase() + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadHqBilling() {
  const root = document.getElementById('saas-billing-root') || document.getElementById('saas-accounting-root');
  if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-4">Loading billing…</div>';
  try {
    const d = await apiGetJson('/owner/billing');
    window.__hqBillingPlans = d.plans || [];
    const rows = d.accounts || [];
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Billing','Live Stripe customer, invoices, plan change, cancel at period end'):''}
      <p class="text-sm text-slate-500 mb-3">${d.stripe_configured ? 'Stripe is configured on this environment.' : 'Stripe secret is not configured — list is from the database only; mutations will 503.'}</p>
      <input id="hq-bill-q" oninput="hqFilterBilling()" placeholder="Search dealership or Stripe id" class="w-full max-w-lg mb-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm">
      <div id="hq-bill-table"></div>`;
    window.__hqBillingAccounts = rows;
    hqFilterBilling();
  } catch (e) { root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message)}</div>`; }
}
window.hqFilterBilling = function() {
  const q = (document.getElementById('hq-bill-q')?.value || '').toLowerCase();
  const host = document.getElementById('hq-bill-table'); if (!host) return;
  const rows = (window.__hqBillingAccounts || []).filter(a => !q || JSON.stringify(a).toLowerCase().includes(q));
  host.innerHTML = `<div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
    <table class="w-full text-left text-xs"><thead><tr class="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-800">
      <th class="p-3">Dealership</th><th class="p-3">Status</th><th class="p-3">Plan</th><th class="p-3">Stripe</th><th class="p-3"></th></tr></thead>
      <tbody>${rows.slice(0,400).map(a => `<tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="p-3 font-bold">${esc(a.name||a.id)}</td>
        <td class="p-3">${esc(a.billing_status||'—')}</td>
        <td class="p-3">${esc(a.plan|| (a.subscriptions||[]).map(s=>s.plan_id).filter(Boolean).join(', ') || '—')}</td>
        <td class="p-3 font-mono text-[10px]">${esc((a.stripe_customer_id||'').slice(0,18) || 'none')}</td>
        <td class="p-3 text-right"><button class="font-black text-indigo-600" onclick="hqOpenBilling('${a.id}')">Open</button></td>
      </tr>`).join('')}</tbody></table></div>`;
};

window.hqOpenBilling = async function(id) {
  document.getElementById('hq-bill-drawer')?.remove();
  const el = document.createElement('div');
  el.id = 'hq-bill-drawer';
  el.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
  el.innerHTML = `<div class="absolute inset-0 bg-slate-950/50" onclick="document.getElementById('hq-bill-drawer')?.remove()"></div>
    <div class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5" id="hq-bill-body">Loading…</div>`;
  document.body.appendChild(el);
  try {
    const d = await apiGetJson('/owner/billing/' + id);
    const plans = window.__hqBillingPlans || [];
    const subs = d.stripe_subscriptions || [];
    const inv = d.invoices || [];
    document.getElementById('hq-bill-body').innerHTML = `
      <div class="flex justify-between gap-3 mb-3">
        <div><div class="text-[10px] font-black uppercase text-slate-400">Billing</div>
        <h2 class="text-xl font-black">${esc(d.name||id)}</h2>
        <div class="text-xs text-slate-500">${esc(d.billing_status||'')} · ${esc(d.plan||'')} · ${esc(d.stripe_customer_id||'no customer')}</div></div>
        <button onclick="document.getElementById('hq-bill-drawer')?.remove()">Close</button>
      </div>
      ${d.stripe_error ? `<div class="text-sm text-rose-600 mb-3">${esc(d.stripe_error)}</div>` : ''}
      <div class="flex flex-wrap gap-2 mb-4">
        <button class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-black" onclick="hqBillingPortal('${id}')">Stripe portal</button>
        <button class="px-3 py-1.5 rounded-xl border text-xs font-black" onclick="hqBillingCancel('${id}')">Cancel at period end</button>
        <button class="px-3 py-1.5 rounded-xl border text-xs font-black" onclick="hqBillingReactivate('${id}')">Reactivate</button>
        <button class="px-3 py-1.5 rounded-xl border text-xs font-black" onclick="hqBillingTrial('${id}')">Stripe trial days</button>
        <button class="px-3 py-1.5 rounded-xl border text-xs font-black" onclick="hqBillingCoupon('${id}')">Apply coupon</button>
      </div>
      <label class="block text-[11px] font-black uppercase text-slate-400 mb-1">Change plan</label>
      <div class="flex gap-2 mb-4">
        <select id="hq-plan-id" class="flex-1 rounded-xl border px-2 py-2 text-sm">${plans.map(p => `<option value="${esc(p.id)}">${esc(p.label)} ($${p.monthly})</option>`).join('')}</select>
        <select id="hq-plan-cur" class="rounded-xl border px-2 py-2 text-sm"><option value="cad">CAD</option><option value="usd">USD</option></select>
        <button class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black" onclick="hqBillingPlan('${id}')">Apply</button>
      </div>
      <div class="text-[13px] font-black mb-1">Stripe subscriptions</div>
      <div class="space-y-2 mb-4">${subs.length ? subs.map(s => `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
        <b>${esc(s.id)}</b> · ${esc(s.status)} · cancel_at_period_end ${s.cancel_at_period_end ? 'yes' : 'no'}
        <div>period end ${s.current_period_end ? new Date(s.current_period_end*1000).toISOString().slice(0,10) : '—'}</div>
      </div>`).join('') : '<div class="text-sm text-slate-400">No Stripe subscriptions returned.</div>'}</div>
      <div class="text-[13px] font-black mb-1">Invoices</div>
      <div class="space-y-1">${inv.length ? inv.map(i => `<a class="block rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs" href="${esc(i.hosted_invoice_url||i.invoice_pdf||'#')}" target="_blank" rel="noopener">
        ${esc(i.number||i.id)} · ${esc(i.status)} · ${hqMoney(i.amount_paid || i.amount_due, i.currency)}
      </a>`).join('') : '<div class="text-sm text-slate-400">No invoices.</div>'}</div>`;
  } catch (e) {
    document.getElementById('hq-bill-body').innerHTML = `<div class="text-rose-500 text-sm">${esc(e.message)}</div>`;
  }
};

window.hqBillingPortal = async function(id) {
  if (!hqConfirmProd('open portal')) return;
  const reason = prompt('Open Stripe portal — reason') || '';
  if (!reason.trim()) return;
  try {
    const r = await apiSendJson('/owner/billing/' + id + '/portal', 'POST', { reason });
    if (r.url) window.open(r.url, '_blank', 'noopener');
    else showToast('No portal URL', 'error');
  } catch (e) { showToast(e.message || 'Portal failed', 'error'); }
};
window.hqBillingCancel = async function(id) {
  if (!hqConfirmProd('cancel at period end')) return;
  if (!confirm('Cancel at period end on Stripe?')) return;
  const reason = prompt('Reason') || '';
  if (!reason.trim()) return;
  try { await apiSendJson('/owner/billing/' + id + '/cancel', 'POST', { reason }); showToast('Set to cancel at period end', 'success'); hqOpenBilling(id); }
  catch (e) { showToast(e.message || 'Cancel failed', 'error'); }
};
window.hqBillingReactivate = async function(id) {
  const reason = prompt('Reason') || '';
  if (!reason.trim()) return;
  try { await apiSendJson('/owner/billing/' + id + '/reactivate', 'POST', { reason }); showToast('Reactivated', 'success'); hqOpenBilling(id); }
  catch (e) { showToast(e.message || 'Reactivate failed', 'error'); }
};
window.hqBillingTrial = async function(id) {
  const days = prompt('Stripe trial days', '14');
  const reason = prompt('Reason') || '';
  if (!days || !reason.trim()) return;
  try { await apiSendJson('/owner/billing/' + id + '/stripe-trial', 'POST', { days: Number(days), reason }); showToast('Stripe trial updated', 'success'); hqOpenBilling(id); }
  catch (e) { showToast(e.message || 'Trial failed', 'error'); }
};
window.hqBillingPlan = async function(id) {
  if (!hqConfirmProd('change plan')) return;
  const plan_id = document.getElementById('hq-plan-id')?.value;
  const currency = document.getElementById('hq-plan-cur')?.value || 'cad';
  const reason = prompt('Change plan to ' + plan_id + ' — reason') || '';
  if (!reason.trim()) return;
  try { await apiSendJson('/owner/billing/' + id + '/plan', 'POST', { plan_id, currency, reason }); showToast('Plan change sent to Stripe', 'success'); hqOpenBilling(id); }
  catch (e) { showToast(e.message || 'Plan change failed', 'error'); }
};

window.loadHqBilling = loadHqBilling;
