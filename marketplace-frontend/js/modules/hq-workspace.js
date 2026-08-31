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
      <button type="button" class="ms-btn ms-btn--primary !text-[11px] !min-h-0 !px-3 !py-1.5" onclick="hqOpenBilling('${d.id}')">Open billing</button>
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
window.hqBillingCoupon = async function(id) {
  const coupon = prompt('Stripe coupon code') || '';
  const reason = prompt('Reason') || '';
  if (!coupon.trim() || !reason.trim()) return;
  try { await apiSendJson('/owner/billing/' + id + '/coupon', 'POST', { coupon: coupon.trim(), reason }); showToast('Coupon applied', 'success'); hqOpenBilling(id); }
  catch (e) { showToast(e.message || 'Coupon failed', 'error'); }
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

// ── HQ Agent Hub ─────────────────────────────────────────────────────────────

const AGENT_META = {
  chatgpt: { name: 'ChatGPT', provider: 'OpenAI', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>', color: 'emerald', role: 'Chief of Staff / Architecture / QA' },
  claude:  { name: 'Claude',  provider: 'Anthropic', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-purple-500"></span>', color: 'purple',  role: 'Senior Builder' },
  gemini:  { name: 'Gemini',  provider: 'Google', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>', color: 'blue',    role: 'Workspace / Search / Visual QA' },
  grok:    { name: 'Grok',    provider: 'xAI', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>', color: 'amber',   role: 'Implementation Engineer / Testing' },
};

async function loadHqAgents() {
  const root = document.getElementById('saas-agents-root');
  if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-6">Loading HQ Agent Hub…</div>';

  try {
    const [agentsRes, tasksRes, approvalsRes, integrationsRes, credsRes] = await Promise.all([
      apiGetJson('/api/hq/agents').catch(() => ({ agents: [] })),
      apiGetJson('/api/hq/tasks').catch(() => ({ tasks: [] })),
      apiGetJson('/api/hq/approvals').catch(() => ({ approvals: [] })),
      apiGetJson('/api/hq/integrations/status').catch(() => ({ integrations: [] })),
      apiGetJson('/api/hq/agent-credentials/status').catch(() => ({ credentials: [], environment: 'staging' }))
    ]);

    const agents = agentsRes.agents || [];
    const tasks = tasksRes.tasks || [];
    const approvals = (approvalsRes.approvals || []).filter(a => a.status === 'pending');
    const integrations = integrationsRes.integrations || [];
    const credentials = credsRes.credentials || [];
    const credEnv = credsRes.environment || 'staging';
    const envBadgeTone = credEnv === 'production'
      ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200'
      : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-200';

    // Compute status counts
    const counts = { Inbox: 0, Ready: 0, 'In Progress': 0, Review: 0, Blocked: 0, Done: 0 };
    tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

    root.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-black text-slate-900 dark:text-white">AI Agent Hub</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${envBadgeTone}">
              ${esc(credEnv.toUpperCase())}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">Central control plane and task ledger for ChatGPT, Claude, Gemini, and Grok.</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800" onclick="hqSyncWorkQueuePrompt()">
            ↻ Sync Work Queue
          </button>
          <button type="button" class="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90" onclick="hqCreateTaskPrompt()">
            + New Task
          </button>
        </div>
      </div>

      <!-- Lifecycle Counters -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        ${['Inbox', 'Ready', 'In Progress', 'Review', 'Blocked', 'Done'].map(st => {
          const color = st === 'Done' ? 'text-emerald-600' : st === 'Blocked' ? 'text-rose-600' : st === 'In Progress' ? 'text-blue-600' : st === 'Review' ? 'text-purple-600' : 'text-slate-700 dark:text-slate-200';
          return `
            <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:border-slate-300" onclick="hqFilterTasks('${st}')">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${st}</div>
              <div class="text-2xl font-black ${color} mt-1">${counts[st] || 0}</div>
            </div>`;
        }).join('')}
      </div>

      <!-- Agent Cards Grid -->
      <div class="text-sm font-black text-slate-900 dark:text-white mb-3">Active Autonomous Agents</div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        ${['chatgpt', 'claude', 'gemini', 'grok'].map(id => {
          const ag = agents.find(a => a.id === id) || { id, display_name: id, status: 'idle', role: 'contributor' };
          const meta = AGENT_META[id] || { name: id, provider: 'AI', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-slate-500"></span>', color: 'slate', role: 'Agent' };
          const statusTone = ag.status === 'working' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                             ag.status === 'blocked' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300' :
                             ag.status === 'review'  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' :
                             'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

          return `
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">${meta.icon}</span>
                    <div>
                      <div class="font-black text-sm text-slate-900 dark:text-white">${esc(meta.name)}</div>
                      <div class="text-[10px] text-slate-400 font-semibold">${esc(meta.provider)} · ${esc(meta.role)}</div>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${statusTone}">
                    ${esc(ag.status || 'idle')}
                  </span>
                </div>

                <div class="space-y-1.5 mt-3 text-xs">
                  <div class="flex justify-between text-slate-500">
                    <span>Current Task:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">${ag.current_task_id ? `<a href="javascript:void(0)" onclick="openHqTaskDetail('${ag.current_task_id}')" class="text-indigo-600 underline">${esc(ag.current_task_id)}</a>` : '—'}</span>
                  </div>
                  <div class="flex justify-between text-slate-500">
                    <span>Heartbeat:</span>
                    <span class="font-semibold text-slate-600 dark:text-slate-400">${ag.last_heartbeat ? new Date(ag.last_heartbeat).toLocaleTimeString() : 'Online'}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                <span class="text-slate-400 font-semibold">Scope: standard</span>
                <button type="button" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline" onclick="hqFilterTasks('', '${id}')">
                  View Tasks →
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- Founder Agent Credentials & Keys Section -->
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Agent Credentials & MCP Keys</h2>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${envBadgeTone}">
                ${esc(credEnv.toUpperCase())}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">Manage secure API keys and MCP connections. Plaintext secrets are displayed only once upon generation.</p>
          </div>
          <button type="button" class="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition-opacity" onclick="hqGenerateMissingKeysPrompt()">
            Generate Missing Agent Keys
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
                <th class="py-2.5 px-3">Agent</th>
                <th class="py-2.5 px-3">Role</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Key Prefix</th>
                <th class="py-2.5 px-3">Created</th>
                <th class="py-2.5 px-3">Last Used</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${['chatgpt', 'claude', 'gemini', 'grok'].map(id => {
                const cred = credentials.find(c => c.agent_id === id) || { agent_id: id, has_active_credential: false };
                const meta = AGENT_META[id] || { name: id, role: 'Agent', icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-slate-500"></span>' };
                const statusBadge = cred.has_active_credential
                  ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Active</span>'
                  : '<span class="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">Not Configured</span>';

                return `
                  <tr class="border-t border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td class="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                      <span>${meta.icon}</span> <span>${esc(meta.name)}</span>
                    </td>
                    <td class="py-3 px-3 text-slate-500 font-semibold whitespace-nowrap">${esc(meta.role)}</td>
                    <td class="py-3 px-3">${statusBadge}</td>
                    <td class="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">${cred.key_prefix ? `${esc(cred.key_prefix)}...` : '—'}</td>
                    <td class="py-3 px-3 text-slate-500 whitespace-nowrap">${cred.created_at ? new Date(cred.created_at).toLocaleDateString() : '—'}</td>
                    <td class="py-3 px-3 text-slate-500 whitespace-nowrap">${cred.last_used_at ? new Date(cred.last_used_at).toLocaleTimeString() : 'Never'}</td>
                    <td class="py-3 px-3 text-right whitespace-nowrap">
                      ${cred.has_active_credential ? `
                        <button type="button" class="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-[11px] hover:bg-slate-50 dark:hover:bg-slate-800" onclick="hqRotateSingleKeyPrompt('${id}')">
                          Rotate Key
                        </button>
                      ` : `
                        <button type="button" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700" onclick="hqGenerateSingleKeyPrompt('${id}')">
                          Generate Key
                        </button>
                      `}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pending Approvals Queue -->
      ${approvals.length ? `
        <div class="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 mb-6">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-amber-600 font-black text-sm">Founder Approval Required (${approvals.length})</span>
          </div>
          <div class="space-y-2">
            ${approvals.map(ap => `
              <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div class="font-bold text-slate-900 dark:text-white">${esc(ap.title)}</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">Requested by <b>${esc(ap.agent_id)}</b> for task <b>${esc(ap.task_id || 'general')}</b> (${esc(ap.action_type)})</div>
                  ${ap.description ? `<p class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">${esc(ap.description)}</p>` : ''}
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]" onclick="hqDecideApproval('${ap.id}', 'approved')">Approve</button>
                  <button type="button" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 font-bold text-[11px]" onclick="hqDecideApproval('${ap.id}', 'rejected')">Reject</button>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

      <!-- Task Ledger Table -->
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div class="font-black text-sm text-slate-900 dark:text-white">Task Ledger (${tasks.length})</div>
          <div class="flex items-center gap-2 text-xs">
            <select id="hq-task-filter-status" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1" onchange="hqApplyTaskFilters()">
              <option value="">All Statuses</option>
              <option value="Inbox">Inbox</option>
              <option value="Ready">Ready</option>
              <option value="In Progress">In Progress</option>
              <option value="Review">Review</option>
              <option value="Blocked">Blocked</option>
              <option value="Done">Done</option>
            </select>
            <select id="hq-task-filter-owner" class="rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-2.5 py-1" onchange="hqApplyTaskFilters()">
              <option value="">All Agents</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="grok">Grok</option>
            </select>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs" id="hq-tasks-table">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                <th class="p-3">ID</th>
                <th class="p-3">Title & Acceptance Criteria</th>
                <th class="p-3">Priority</th>
                <th class="p-3">Owner</th>
                <th class="p-3">Status</th>
                <th class="p-3">QA / Reviewer</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="hq-tasks-tbody">
              ${tasks.length ? tasks.map(t => hqRenderTaskRow(t)).join('') : '<tr><td colspan="7" class="p-6 text-center text-slate-400">No tasks in ledger. Click "+ New Task" or "Sync Work Queue" to add.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-rose-500 text-sm p-6">${esc(e.message || 'Could not load Agent Hub')}</div>`;
  }
}

function hqRenderTaskRow(t) {
  const pTone = t.priority === 'P0' ? 'bg-rose-100 text-rose-700' : t.priority === 'P1' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  const sTone = t.status === 'Done' ? 'text-emerald-600 font-bold' : t.status === 'In Progress' ? 'text-blue-600 font-bold' : t.status === 'Blocked' ? 'text-rose-600 font-bold' : 'text-slate-600';

  return `
    <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40" data-status="${esc(t.status)}" data-owner="${esc(t.owner || '')}">
      <td class="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">${esc(t.id)}</td>
      <td class="p-3">
        <div class="font-bold text-slate-900 dark:text-white cursor-pointer hover:underline" onclick="openHqTaskDetail('${esc(t.id)}')">${esc(t.title)}</div>
        ${t.next_action ? `<div class="text-[11px] text-slate-400 mt-0.5">Next: ${esc(t.next_action)}</div>` : ''}
      </td>
      <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-black ${pTone}">${esc(t.priority)}</span></td>
      <td class="p-3 font-semibold">${esc(t.owner ? (AGENT_META[t.owner]?.name || t.owner) : 'Unassigned')}</td>
      <td class="p-3 ${sTone}">${esc(t.status)}</td>
      <td class="p-3 text-slate-500">${esc(t.qa_owner ? (AGENT_META[t.qa_owner]?.name || t.qa_owner) : '—')}</td>
      <td class="p-3 text-right whitespace-nowrap">
        <button type="button" class="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 font-bold text-[11px] mr-1" onclick="openHqTaskDetail('${esc(t.id)}')">Detail</button>
        ${t.status === 'Ready' || t.status === 'Inbox' ? `<button type="button" class="px-2 py-1 rounded bg-indigo-600 text-white font-bold text-[11px]" onclick="hqClaimTaskPrompt('${esc(t.id)}')">Claim</button>` : ''}
      </td>
    </tr>`;
}

window.openHqTaskDetail = async function(taskId) {
  document.getElementById('hq-task-drawer')?.remove();
  const drawer = document.createElement('div');
  drawer.id = 'hq-task-drawer';
  drawer.className = 'fixed inset-0 z-[130] flex items-center justify-center p-4';
  drawer.innerHTML = `<div class="absolute inset-0 bg-slate-950/50" onclick="document.getElementById('hq-task-drawer')?.remove()"></div>
    <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl" id="hq-task-detail-body">
      Loading task ${esc(taskId)}…
    </div>`;
  document.body.appendChild(drawer);

  try {
    const res = await apiGetJson(`/api/hq/tasks/${taskId}`);
    const t = res.task;
    if (!t) throw new Error('Task not found');

    const events = t.events || [];
    const evidence = t.evidence || [];

    document.getElementById('hq-task-detail-body').innerHTML = `
      <div class="flex justify-between items-start gap-3 mb-4">
        <div>
          <span class="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400">${esc(t.id)} · ${esc(t.priority)}</span>
          <h2 class="text-xl font-black text-slate-900 dark:text-white mt-0.5">${esc(t.title)}</h2>
          <div class="text-xs text-slate-500 mt-1">Status: <b>${esc(t.status)}</b> · Owner: <b>${esc(t.owner || 'Unassigned')}</b> · QA: <b>${esc(t.qa_owner || '—')}</b></div>
        </div>
        <button type="button" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg" onclick="document.getElementById('hq-task-drawer')?.remove()"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      </div>

      ${t.description ? `<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-700 dark:text-slate-300 mb-4">${esc(t.description)}</div>` : ''}

      <!-- Evidence -->
      <div class="mb-4">
        <div class="text-xs font-black text-slate-900 dark:text-white mb-2">Attached Evidence (${evidence.length})</div>
        ${evidence.length ? `
          <div class="space-y-1.5">
            ${evidence.map(ev => `
              <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div class="font-bold">${esc(ev.title)} <span class="text-slate-400 font-normal">(${esc(ev.evidence_type)})</span></div>
                ${ev.url ? `<a href="${esc(ev.url)}" target="_blank" class="text-indigo-600 underline text-[11px]">${esc(ev.url)}</a>` : ''}
              </div>`).join('')}
          </div>` : '<div class="text-xs text-slate-400">No evidence attached yet.</div>'}
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mb-4">
        ${t.status === 'Ready' || t.status === 'Inbox' ? `<button type="button" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs" onclick="hqClaimTaskPrompt('${esc(t.id)}')">Claim Task</button>` : ''}
        ${t.status === 'In Progress' ? `<button type="button" class="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs" onclick="hqHandoffTaskPrompt('${esc(t.id)}')">Handoff to QA</button>` : ''}
        ${t.status !== 'Done' ? `<button type="button" class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs" onclick="hqCompleteTaskPrompt('${esc(t.id)}')">Mark Done</button>` : ''}
      </div>

      <!-- Timeline Events -->
      <div>
        <div class="text-xs font-black text-slate-900 dark:text-white mb-2">Timeline & Audit Events (${events.length})</div>
        <div class="space-y-2">
          ${events.map(ev => `
            <div class="text-xs border-l-2 border-slate-300 dark:border-slate-700 pl-3 py-1">
              <div class="text-slate-500 text-[10px]">${new Date(ev.created_at).toLocaleString()} · <b>${esc(ev.agent_id || 'system')}</b></div>
              <div class="font-semibold text-slate-800 dark:text-slate-200">${esc(ev.note || ev.event_type)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('hq-task-detail-body').innerHTML = `<div class="text-rose-500 text-xs">${esc(e.message)}</div>`;
  }
};

window.hqClaimTaskPrompt = async function(taskId) {
  const agentId = prompt('Claim as agent (chatgpt / claude / gemini / grok):', 'gemini');
  if (!agentId) return;
  try {
    await apiSendJson(`/api/hq/tasks/${taskId}/claim`, 'POST', { agentId });
    if (typeof showToast === 'function') showToast(`Task ${taskId} claimed by ${agentId}`, 'success');
    document.getElementById('hq-task-drawer')?.remove();
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not claim task', 'error');
  }
};

window.hqHandoffTaskPrompt = async function(taskId) {
  const targetAgentId = prompt('Hand off to QA reviewer (grok / chatgpt / claude / gemini):', 'grok');
  if (!targetAgentId) return;
  const note = prompt('Handoff note:', 'Implementation complete. Ready for QA review.');
  try {
    await apiSendJson(`/api/hq/tasks/${taskId}/handoff`, 'POST', { targetAgentId, note });
    if (typeof showToast === 'function') showToast(`Handed off ${taskId} to ${targetAgentId}`, 'success');
    document.getElementById('hq-task-drawer')?.remove();
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Handoff failed', 'error');
  }
};

window.hqCompleteTaskPrompt = async function(taskId) {
  const resultSummary = prompt('Result / Verification Summary:', 'All verification checks and automated tests passed.');
  if (!resultSummary) return;
  try {
    await apiSendJson(`/api/hq/tasks/${taskId}/review`, 'POST', { status: 'Done', resultSummary });
    if (typeof showToast === 'function') showToast(`Task ${taskId} marked Done`, 'success');
    document.getElementById('hq-task-drawer')?.remove();
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not update task', 'error');
  }
};

window.hqDecideApproval = async function(approvalId, decision) {
  const reason = prompt(`Reason for ${decision}:`, 'Verified by platform owner');
  try {
    await apiSendJson(`/api/hq/approvals/${approvalId}/decide`, 'POST', { decision, reason });
    if (typeof showToast === 'function') showToast(`Approval ${decision}`, 'success');
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Decision failed', 'error');
  }
};

window.hqCreateTaskPrompt = async function() {
  const id = prompt('Task ID (e.g. MS-006):');
  if (!id) return;
  const title = prompt('Task Title / Objective:');
  if (!title) return;
  const priority = prompt('Priority (P0, P1, P2, P3):', 'P1') || 'P2';
  const owner = prompt('Assign Agent (chatgpt, claude, gemini, grok):', 'gemini') || null;

  try {
    await apiSendJson('/api/hq/tasks', 'POST', { id, title, priority, owner, status: 'Ready' });
    if (typeof showToast === 'function') showToast(`Task ${id} created`, 'success');
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Could not create task', 'error');
  }
};

window.hqSyncWorkQueuePrompt = async function() {
  if (!confirm('Sync work queue tasks from Google Sheets adapter?')) return;
  try {
    // Default sync probe
    const res = await apiSendJson('/api/hq/sync/work-queue', 'POST', { rows: [] });
    if (typeof showToast === 'function') showToast(`Work queue synced (${res.importedCount || 0} imported, ${res.updatedCount || 0} updated)`, 'success');
    loadHqAgents();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Sync failed', 'error');
  }
};

window.hqApplyTaskFilters = function() {
  const st = document.getElementById('hq-task-filter-status')?.value || '';
  const ow = document.getElementById('hq-task-filter-owner')?.value || '';
  const rows = document.querySelectorAll('#hq-tasks-tbody tr[data-status]');
  rows.forEach(r => {
    const matchStatus = !st || r.dataset.status === st;
    const matchOwner = !ow || r.dataset.owner === ow;
    r.style.display = matchStatus && matchOwner ? '' : 'none';
  });
};

window.hqFilterTasks = function(status, owner) {
  if (status !== undefined && document.getElementById('hq-task-filter-status')) {
    document.getElementById('hq-task-filter-status').value = status;
  }
  if (owner !== undefined && document.getElementById('hq-task-filter-owner')) {
    document.getElementById('hq-task-filter-owner').value = owner;
  }
  hqApplyTaskFilters();
};

// ── FOUNDER AGENT CREDENTIALS HANDLERS ──

window.openHqSecretModal = function({ environment, credentials }) {
  document.getElementById('hq-secret-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'hq-secret-modal';
  modal.className = 'fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm';

  const envTone = environment === 'production'
    ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200'
    : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-200';

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-black text-slate-900 dark:text-white">Generated Agent Credentials</h2>
          <span class="px-3 py-0.5 rounded-full text-xs font-black uppercase border ${envTone}">
            ${esc(environment.toUpperCase())}
          </span>
        </div>
      </div>

      <!-- One-time Warning Banner -->
      <div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 mb-6 flex items-start gap-3">
        <span class="text-amber-600 shrink-0"><svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></span>
        <div class="text-xs text-amber-900 dark:text-amber-200">
          <div class="font-black text-sm">Save these tokens securely now</div>
          <div class="mt-0.5">These plaintext tokens will <b>never</b> be shown again. Store them in your AI client configurations (Claude Desktop, OpenAI Custom Actions, Gemini MCP, Grok MCP). Only SHA-256 hashes are stored server-side.</div>
        </div>
      </div>

      <!-- Credential List -->
      <div class="space-y-4 mb-6">
        ${credentials.map(c => {
          const meta = AGENT_META[c.agent_id] || { name: c.agent_id, icon: '<span class="inline-block w-2.5 h-2.5 rounded-full bg-slate-500"></span>' };
          return `
            <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>${meta.icon}</span> <span>${esc(meta.name)}</span>
                </span>
                <button type="button" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 hq-copy-btn" onclick="hqCopyToken(this, '${esc(c.token)}')">
                  Copy Token
                </button>
              </div>
              <div class="font-mono text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 break-all select-all">
                ${esc(c.token)}
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- Action Footer -->
      <div class="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800" onclick="hqCopyAllTokens()">
            Copy All Tokens
          </button>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input type="checkbox" id="hq-confirm-saved-cb" class="rounded border-slate-300" onchange="hqToggleModalCloseBtn()">
            I have saved these credentials securely
          </label>
        </div>

        <button type="button" id="hq-close-secret-btn" disabled class="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity" onclick="hqCloseAndWipeSecretModal()">
          Done — Close & Wipe Secrets from Memory
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  window._hqTempTokens = credentials;
};

window.hqCopyToken = function(btn, token) {
  navigator.clipboard.writeText(token).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = 'Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 2000);
  });
};

window.hqCopyAllTokens = function() {
  if (!window._hqTempTokens || !window._hqTempTokens.length) return;
  const formatted = window._hqTempTokens.map(c => `${c.agent_id.toUpperCase()}: ${c.token}`).join('\n\n');
  navigator.clipboard.writeText(formatted).then(() => {
    if (typeof showToast === 'function') showToast('All tokens copied to clipboard', 'success');
  });
};

window.hqToggleModalCloseBtn = function() {
  const cb = document.getElementById('hq-confirm-saved-cb');
  const btn = document.getElementById('hq-close-secret-btn');
  if (cb && btn) {
    btn.disabled = !cb.checked;
  }
};

window.hqCloseAndWipeSecretModal = function() {
  window._hqTempTokens = null;
  document.getElementById('hq-secret-modal')?.remove();
  loadHqAgents();
};

window.hqGenerateMissingKeysPrompt = async function() {
  try {
    const statusRes = await apiGetJson('/api/hq/agent-credentials/status');
    const missing = (statusRes.credentials || []).filter(c => !c.has_active_credential).map(c => c.agent_id);
    if (!missing.length) {
      if (typeof showToast === 'function') showToast('All agents already have active credentials. Use "Rotate Key" to generate new ones.', 'info');
      return;
    }

    if (!confirm(`Generate keys for ${missing.length} unconfigured agent(s): ${missing.join(', ')}?`)) return;

    const res = await apiSendJson('/api/hq/agent-credentials/generate', 'POST', {
      agents: missing,
      rotate_existing: false
    });

    if (res.success && res.credentials?.length) {
      openHqSecretModal(res);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Key generation failed', 'error');
  }
};

window.hqGenerateSingleKeyPrompt = async function(agentId) {
  try {
    const res = await apiSendJson('/api/hq/agent-credentials/generate', 'POST', {
      agents: [agentId],
      rotate_existing: false
    });
    if (res.success && res.credentials?.length) {
      openHqSecretModal(res);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Key generation failed', 'error');
  }
};

window.hqRotateSingleKeyPrompt = async function(agentId) {
  if (!confirm(`Are you sure you want to rotate the credential for ${agentId.toUpperCase()}? The existing token will be immediately deactivated.`)) return;

  try {
    const res = await apiSendJson('/api/hq/agent-credentials/generate', 'POST', {
      agents: [agentId],
      rotate_existing: true
    });
    if (res.success && res.credentials?.length) {
      openHqSecretModal(res);
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Key rotation failed', 'error');
  }
};

window.loadHqAgents = loadHqAgents;

// ══ HQ Affiliates ═══════════════════════════════════════════════════════════
// Company view of the affiliate program. Reads /saas/affiliates (see backend).
// Any missing table renders as "Not connected" — no fabricated zeros.
async function loadSaasAffiliates() {
  const root = document.getElementById('saas-affiliates-root'); if (!root) return;
  const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  root.innerHTML = '<div class="text-sm text-slate-400 p-6">Loading affiliates…</div>';
  try {
    const d = await apiGetJson('/saas/affiliates');
    if (!d.connected) {
      root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Affiliates','Program overview + top performers'):'<h1 class="text-2xl font-black">Affiliates</h1>'}
        <div class="rounded-2xl border border-amber-300/60 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-6 text-sm text-amber-800 dark:text-amber-200">
          <b class="block text-base mb-1">Not connected</b>
          The affiliates table is not present in this environment. Enable the affiliate program to populate this page.
        </div>`;
      return;
    }
    const p = d.program || {};
    const rows = (d.affiliates || []).map(a => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${esc(a.code || a.email || a.id)}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 text-xs">${esc((a.status || '—').toLowerCase())}</td>
        <td class="p-3 text-right font-bold">${a.referrals}</td>
        <td class="p-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">${a.active_referrals}</td>
        <td class="p-3 text-right font-black">${money(a.earned)}</td>
        <td class="p-3 text-right ${a.pending_payout > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500'}">${money(a.pending_payout)}</td>
        <td class="p-3 text-right text-slate-500">${a.conversion_rate}%</td>
      </tr>`).join('') || '<tr><td colspan="7" class="p-6 text-center text-sm text-slate-500">No affiliates yet.</td></tr>';
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Affiliates','Program overview + top performers'):'<h1 class="text-2xl font-black">Affiliates</h1>'}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${typeof engKpi === 'function' ? engKpi('Total affiliates', (p.affiliate_count || 0).toLocaleString()) : ''}
        ${typeof engKpi === 'function' ? engKpi('Active', (p.active_affiliates || 0).toLocaleString(), 'text-emerald-600 dark:text-emerald-400') : ''}
        ${typeof engKpi === 'function' ? engKpi('Referrals (active)', `${p.active_referrals || 0}/${p.referral_count || 0}`) : ''}
        ${typeof engKpi === 'function' ? engKpi('Pending payouts', money(p.pending_payouts || 0), (p.pending_payouts || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : '') : ''}
      </div>
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table class="w-full text-left text-xs">
          <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
            <th class="p-3">Affiliate</th><th class="p-3">Status</th>
            <th class="p-3 text-right">Referrals</th><th class="p-3 text-right">Active</th>
            <th class="p-3 text-right">Earned</th><th class="p-3 text-right">Owed</th>
            <th class="p-3 text-right">Conversion</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Could not load affiliates')}</div>`;
  }
}
window.loadSaasAffiliates = loadSaasAffiliates;

// ══ HQ Billing (summary) ═══════════════════════════════════════════════════
async function loadSaasBillingSummary() {
  const root = document.getElementById('saas-billing-root'); if (!root) return;
  const money = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  const NC = '<span class="text-slate-400 text-base font-bold">Not connected</span>';
  root.innerHTML = '<div class="text-sm text-slate-400 p-6">Loading billing…</div>';
  try {
    const d = await apiGetJson('/saas/billing-summary');
    const s = d.subscriptions;
    const r = d.receivables || {};
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Billing','Subscriptions + receivables'):'<h1 class="text-2xl font-black">Billing</h1>'}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${typeof engKpi === 'function' ? engKpi('Active subscriptions', s ? s.active.toLocaleString() : NC, s ? 'text-emerald-600 dark:text-emerald-400' : '') : ''}
        ${typeof engKpi === 'function' ? engKpi('Trialing', s ? s.trialing.toLocaleString() : NC, s ? 'text-blue-600 dark:text-blue-400' : '') : ''}
        ${typeof engKpi === 'function' ? engKpi('Past due (Stripe)', s ? s.past_due.toLocaleString() : NC, (s && s.past_due > 0) ? 'text-rose-600 dark:text-rose-400' : '') : ''}
        ${typeof engKpi === 'function' ? engKpi('Cancelling', s ? s.cancel_at_period_end.toLocaleString() : NC, (s && s.cancel_at_period_end > 0) ? 'text-amber-600 dark:text-amber-400' : '') : ''}
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        ${typeof engCard === 'function' ? engCard('Receivables', `
          <div class="grid grid-cols-2 gap-3">
            ${engKpi('Past-due accounts', (r.past_due_accounts || 0).toLocaleString(), (r.past_due_accounts || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : '')}
            ${engKpi('Estimated owed (MRR)', money(r.estimated_owed_mrr || 0), (r.estimated_owed_mrr || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : '')}
          </div>
          <p class="text-[11px] text-slate-500 mt-2">${esc(r.note || '')}</p>`) : ''}
        ${typeof engCard === 'function' ? engCard('Deep dives', `
          <div class="flex flex-col gap-2">
            <button onclick="switchPage('owner-users')" class="ms-btn ms-btn--primary !text-[13px] justify-start">Open all customers (billing drill-down per account)</button>
            <button onclick="switchPage('saas-accounting')" class="ms-btn !text-[13px] justify-start">Open Accounting (P&L, affiliate cost)</button>
          </div>`) : ''}
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Could not load billing summary')}</div>`;
  }
}
window.loadSaasBillingSummary = loadSaasBillingSummary;

// ══ HQ Product Usage ═══════════════════════════════════════════════════════
async function loadSaasProductUsage() {
  const root = document.getElementById('saas-product-usage-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-6">Loading usage…</div>';
  try {
    const d = await apiGetJson('/saas/product-usage?days=30');
    if (!d.connected) {
      root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Product Usage','Adoption per product (30 days)'):'<h1 class="text-2xl font-black">Product Usage</h1>'}
        <div class="rounded-2xl border border-amber-300/60 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20 p-6 text-sm text-amber-800 dark:text-amber-200">
          <b class="block text-base mb-1">Not connected</b>
          The events spine is unreadable, so per-product adoption cannot be shown.
        </div>`;
      return;
    }
    const label = (window.SAAS_PRODUCT_LABEL || {});
    const rows = (d.products || []).map(p => `
      <tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="p-3 font-bold text-slate-800 dark:text-slate-100">${esc(label[p.key] || p.key)}</td>
        <td class="p-3 text-right font-black">${(p.accounts || 0).toLocaleString()}</td>
        <td class="p-3 text-right">${(p.events || 0).toLocaleString()}</td>
        <td class="p-3 text-right text-xs text-slate-500">${p.last_at ? new Date(p.last_at).toLocaleString() : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-sm text-slate-500">No events in this window.</td></tr>';
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Product Usage','Adoption per product (last '+d.window_days+' days)'):'<h1 class="text-2xl font-black">Product Usage</h1>'}
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
        ${typeof engKpi === 'function' ? engKpi('Products in use', (d.products || []).length.toLocaleString()) : ''}
        ${typeof engKpi === 'function' ? engKpi('Total events', (d.total_events || 0).toLocaleString()) : ''}
        ${typeof engKpi === 'function' ? engKpi('Window (days)', String(d.window_days || 30)) : ''}
      </div>
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table class="w-full text-left text-xs">
          <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-500">
            <th class="p-3">Product</th><th class="p-3 text-right">Accounts</th><th class="p-3 text-right">Events</th><th class="p-3 text-right">Last</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Could not load product usage')}</div>`;
  }
}
window.loadSaasProductUsage = loadSaasProductUsage;

// ══ HQ Platform Health ═════════════════════════════════════════════════════
async function loadSaasHealth() {
  const root = document.getElementById('saas-health-root'); if (!root) return;
  root.innerHTML = '<div class="text-sm text-slate-400 p-6">Checking platform…</div>';
  try {
    const d = await apiGetJson('/saas/platform-health');
    const s = d.signals || {};
    const failedInt = s.failed_integrations == null ? '<span class="text-slate-400 text-base font-bold">Not connected</span>' : (s.failed_integrations).toLocaleString();
    const statusTone = d.status === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';
    root.innerHTML = `${typeof pulseHeader==='function'?pulseHeader('Platform Health','Dunning, expiring trials, integration failures'):'<h1 class="text-2xl font-black">Platform Health</h1>'}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${typeof engKpi === 'function' ? engKpi('Overall', d.status === 'ok' ? 'Healthy' : 'Degraded', statusTone) : ''}
        ${typeof engKpi === 'function' ? engKpi('Past due', (s.past_due || 0).toLocaleString(), (s.past_due || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : '') : ''}
        ${typeof engKpi === 'function' ? engKpi('Trials expiring ≤5d', (s.trials_expiring_5d || 0).toLocaleString(), (s.trials_expiring_5d || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : '') : ''}
        ${typeof engKpi === 'function' ? engKpi('Failed integrations', failedInt, (s.failed_integrations > 0) ? 'text-rose-600 dark:text-rose-400' : '') : ''}
      </div>
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm text-slate-600 dark:text-slate-300">
        Signals are read live from dealerships + dealer_integrations. Environment: <b>${esc(d.env || 'unknown')}</b>.
      </div>`;
  } catch (e) {
    root.innerHTML = `<div class="text-sm text-rose-500 p-4">${esc(e.message || 'Could not load platform health')}</div>`;
  }
}
window.loadSaasHealth = loadSaasHealth;


