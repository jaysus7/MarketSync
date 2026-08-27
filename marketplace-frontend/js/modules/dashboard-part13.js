/* dashboard.js split part 13/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function loadServicePartsPage() {
  const root = document.getElementById('service-parts-root');
  if (!root) return;
  root.innerHTML = '<div class="text-slate-400 text-sm p-6">Loading parts…</div>';
  try {
    const list = await apiGetJson('/service-engine/parts');
    __svcParts = list.parts || [];
    const rows = __svcParts.map(p => {
      const low = Number(p.reorder_point) > 0 && Number(p.qty_on_hand) <= Number(p.reorder_point);
      return `<tr class="border-t border-slate-100 dark:border-slate-800">
        <td class="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">${esc(p.part_number)}</td>
        <td class="px-3 py-2 text-slate-600 dark:text-slate-300">${esc(p.description || '')}</td>
        <td class="px-3 py-2 text-slate-400">${esc(p.bin || '')}</td>
        <td class="px-3 py-2 text-right ${low ? 'text-rose-600 font-black' : ''}">${Number(p.qty_on_hand)}${low ? ' ' : ''}</td>
        <td class="px-3 py-2 text-right">${svcMoney(p.cost)}</td>
        <td class="px-3 py-2 text-right">${svcMoney(p.price)}</td>
        <td class="px-3 py-2 text-right whitespace-nowrap">
          <button onclick="svcReceive('${p.id}','${esc(p.part_number)}')" class="text-teal-600 hover:text-teal-500 text-xs font-bold">Receive</button>
          <button onclick="svcAdjust('${p.id}','${esc(p.part_number)}')" class="text-slate-500 hover:text-slate-700 text-xs font-bold ml-2">Adjust</button>
        </td></tr>`;
    }).join('') || `<tr><td colspan="7" class="px-3 py-10 text-center text-slate-400 text-sm">No parts yet — add one.</td></tr>`;
    root.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Parts Inventory</h1>
        <button onclick="svcAddPartForm()" class="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition">+ Add Part</button>
      </div>
      <div id="svc-part-form"></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <table class="w-full text-sm min-w-[620px]">
          <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400"><th class="px-3 py-2">Part #</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Bin</th><th class="px-3 py-2 text-right">On hand</th><th class="px-3 py-2 text-right">Cost</th><th class="px-3 py-2 text-right">Price</th><th class="px-3 py-2 text-right">Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) { root.innerHTML = `<div class="text-rose-500 text-sm p-6">Couldn't load: ${esc(e.message)}</div>`; }
}
function svcAddPartForm() {
  const box = document.getElementById('svc-part-form');
  if (!box) return;
  box.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
    <div><label class="text-[11px] text-slate-400 font-bold">Part #</label><input id="svc-p-num" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <div class="md:col-span-2"><label class="text-[11px] text-slate-400 font-bold">Description</label><input id="svc-p-desc" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <div><label class="text-[11px] text-slate-400 font-bold">Bin</label><input id="svc-p-bin" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <div><label class="text-[11px] text-slate-400 font-bold">Cost</label><input id="svc-p-cost" type="number" step="0.01" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <div><label class="text-[11px] text-slate-400 font-bold">Price</label><input id="svc-p-price" type="number" step="0.01" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <div><label class="text-[11px] text-slate-400 font-bold">Reorder pt</label><input id="svc-p-reorder" type="number" class="w-full mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
    <button onclick="svcAddPart()" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition">Save part</button>
  </div>`;
}
async function svcAddPart() {
  const body = {
    part_number: document.getElementById('svc-p-num').value.trim(),
    description: document.getElementById('svc-p-desc').value.trim() || null,
    bin: document.getElementById('svc-p-bin').value.trim() || null,
    cost: Number(document.getElementById('svc-p-cost').value) || 0,
    price: Number(document.getElementById('svc-p-price').value) || 0,
    reorder_point: Number(document.getElementById('svc-p-reorder').value) || 0,
  };
  if (!body.part_number) return showToast('Part # required', 'error');
  try { await apiSendJson('/service-engine/parts', 'POST', body); showToast('Part saved ', 'success'); loadServicePartsPage(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function svcReceive(id, num) {
  const qty = prompt(`Receive how many of ${num}?`, '1');
  if (qty == null) return;
  try { await apiSendJson(`/service-engine/parts/${id}/receive`, 'POST', { qty: Number(qty) }); showToast('Received ', 'success'); loadServicePartsPage(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function svcAdjust(id, num) {
  const qty = prompt(`Adjust ${num} by (use a negative number to reduce):`, '0');
  if (qty == null) return;
  try { await apiSendJson(`/service-engine/parts/${id}/adjust`, 'POST', { qty: Number(qty) }); showToast('Adjusted ', 'success'); loadServicePartsPage(); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, {
  loadServiceRosPage, svcRoFilter, svcNewRoForm, svcCustSearch, svcPickCust, svcCreateRo, svcOpenRo,
  svcLineTypeChanged, svcLinePartChanged, svcAddLine, svcRemoveLine, svcCloseRo,
  loadServicePartsPage, svcAddPartForm, svcAddPart, svcReceive, svcAdjust,
});

// ══ Owner / Platform console — all accounts + billing/engine controls ═════════
let __ownerAccounts = [];
let __ownerFlags = [];
let __ownerProductLabels = { facebook_solo: 'Facebook Solo', facebook_dealer: 'Facebook Dealer', ai_chatbot: 'AI Chatbot', marketsync_video: 'MarketSync Video', dealer_os: 'DealerOS' };
let __ownerSearch = '';
const ownerBillChip = (s) => {
  const map = { ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', TRIALING: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300', INACTIVE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', PAST_DUE: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' };
  return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${map[s] || 'bg-slate-100 text-slate-500 dark:bg-slate-800'}">${esc(s || '—')}</span>`;
};
const ownerTrialTxt = (t) => {
  if (!t) return '';
  const d = new Date(t), now = new Date();
  const days = Math.round((d - now) / 86400000);
  return `<span class="text-[11px] ${days < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}">trial ${days < 0 ? 'expired' : 'ends'} ${d.toLocaleDateString()}${days >= 0 ? ` (${days}d)` : ''}</span>`;
};

// One account card (billing + product/engine toggles + users).
function ownerAccountCard(a) {
  const engines = __ownerFlags.map(f => {
    const on = !!a.engines[f.key];
    return `<button onclick="ownerToggleEngine('${a.id}','${f.key}',${!on})" class="text-[11px] font-bold px-2.5 py-1 rounded-full transition ${on ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}">${on ? '● ' : '○ '}${esc(f.label)}</button>`;
  }).join('');
  const prod = a.products || {};
  const products = Object.keys(__ownerProductLabels).map(k => {
    const on = !!prod[k];
    return `<button onclick="ownerToggleProduct('${a.id}','${k}',${!on})" class="text-[11px] font-bold px-2.5 py-1 rounded-full transition ${on ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}">${on ? '● ' : '○ '}${esc(__ownerProductLabels[k])}</button>`;
  }).join('');
  const oneUser = a.is_personal && a.users?.length === 1 ? a.users[0] : null;
  const billTarget = oneUser ? `ownerBill('user','${oneUser.id}'` : `ownerBill('dealer','${a.id}'`;
  const effStatus = oneUser ? oneUser.billing_status : a.billing_status;
  const effTrial = oneUser ? oneUser.trial_ends_at : a.trial_ends_at;
  const users = (a.users || []).map(u => `
    <div class="flex flex-wrap items-center gap-2 text-[13px] py-1 border-t border-slate-100 dark:border-slate-800/60">
      <span class="font-semibold text-slate-700 dark:text-slate-200">${esc(u.name)}</span>
      <span class="text-[11px] text-slate-400">${esc(u.role || '')}</span>
      ${ownerBillChip(u.billing_status)}${ownerTrialTxt(u.trial_ends_at)}
      <span class="ml-auto flex gap-1">
        <button onclick="ownerBill('user','${u.id}','comp')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100">Comp</button>
        <button onclick="ownerBill('user','${u.id}','trial30')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200">+30d</button>
        <button onclick="ownerBill('user','${u.id}','block')" class="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100">Block</button>
        <button onclick="hqUserStatus('${u.id}', false)" class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">Deactivate</button>
      </span>
    </div>`).join('') || '<div class="text-[12px] text-slate-400 py-1">No users.</div>';
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-black text-slate-800 dark:text-slate-100">${esc(a.name || 'Account')}</span>
        ${a.is_personal ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">PERSONAL</span>' : ''}
        ${a.plan ? `<span class="text-[11px] text-slate-400">${esc(a.plan)}</span>` : ''}
        ${ownerBillChip(effStatus)}${ownerTrialTxt(effTrial)}
        <span class="ml-auto flex items-center gap-2 text-[11px] text-slate-400">${a.users?.length || 0} user(s)
          <button onclick="openSaasCustomer('${a.id}')" class="font-black text-indigo-600">360</button>
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button onclick="${billTarget},'comp')" class="text-[11px] font-bold px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500">Comp (indefinite)</button>
        <button onclick="${billTarget},'trial30')" class="text-[11px] font-bold px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500">+30d trial</button>
        <button onclick="${billTarget},'trial7')" class="text-[11px] font-bold px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300">+7d trial</button>
        <button onclick="${billTarget},'block')" class="text-[11px] font-bold px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-500">Block</button>
      </div>
      <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Product (front door)</div><div class="flex flex-wrap gap-1.5">${products}</div></div>
      <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Engines</div><div class="flex flex-wrap gap-1.5">${engines}</div></div>
      <div><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-0.5">Users</div>${users}</div>
    </div>`;
}
function ownerFilteredAccounts() {
  const q = __ownerSearch;
  return __ownerAccounts.filter(a => !q || (a.name || '').toLowerCase().includes(q) || (a.users || []).some(u => (u.name || '').toLowerCase().includes(q)));
}
// Re-render just the account cards into the Work tab (used by toggles + search).
function ownerRenderCards() {
  const host = document.getElementById('owner-work-cards');
  if (!host) return;
  const cards = ownerFilteredAccounts().map(ownerAccountCard).join('') || '<div class="text-slate-400 text-sm p-6">No accounts match.</div>';
  host.innerHTML = cards;
}
function ownerSearch(v) { __ownerSearch = (v || '').toLowerCase(); ownerRenderCards(); }

ENGINES['owner-users'] = {
  rootId: 'owner-users-root', title: 'All Users & Accounts', subtitle: 'Every account — provision products, engines, and billing',
  icon: 'user', accent: 'violet', tabLabels: { work: 'Accounts' },
  fetch: async () => {
    const d = await apiGetJson('/owner/accounts');
    __ownerAccounts = d.accounts || [];
    __ownerFlags = d.engine_flags || [];
    if (d.product_labels) __ownerProductLabels = d.product_labels;
    return d;
  },
  quickActions: [
    { label: 'MarketSync HQ', icon: 'chart', onclick: "switchPage('saas-command')" },
    { label: 'Customer Pipeline', icon: 'chart', onclick: "switchPage('saas-customers')" },
  ],
  tabs: {
    overview(body) {
      const accts = __ownerAccounts;
      const totalUsers = accts.reduce((s, a) => s + (a.users?.length || 0), 0);
      const S = (a) => { const u = a.is_personal && a.users?.length === 1 ? a.users[0] : null; return String((u ? u.billing_status : a.billing_status) || '').toUpperCase(); };
      let active = 0, trial = 0, pastdue = 0, personal = 0;
      for (const a of accts) { const s = S(a); if (s === 'ACTIVE') active++; else if (s === 'TRIALING') trial++; else if (s === 'PAST_DUE' || s === 'INACTIVE') pastdue++; if (a.is_personal) personal++; }
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          ${engKpi('Accounts', accts.length.toLocaleString())}
          ${engKpi('Users', totalUsers.toLocaleString())}
          ${engKpi('Active', active.toLocaleString(), 'text-emerald-600 dark:text-emerald-400')}
          ${engKpi('Trialing', trial.toLocaleString(), 'text-blue-600 dark:text-blue-400')}
          ${engKpi('Past due', pastdue.toLocaleString(), pastdue ? 'text-rose-600 dark:text-rose-400' : '')}
          ${engKpi('Personal', personal.toLocaleString())}
        </div>
        ${engCard('Billing status', engBar([
          { pct: accts.length ? Math.round(active / accts.length * 100) : 0, cls: 'bg-emerald-500', label: `Active (${active})` },
          { pct: accts.length ? Math.round(trial / accts.length * 100) : 0, cls: 'bg-blue-500', label: `Trialing (${trial})` },
          { pct: accts.length ? Math.round(pastdue / accts.length * 100) : 0, cls: 'bg-rose-500', label: `Past due / blocked (${pastdue})` },
        ]))}`;
    },
    work(body) {
      body.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm text-slate-500">${__ownerAccounts.length} accounts · ${__ownerAccounts.reduce((s, a) => s + (a.users?.length || 0), 0)} users</div>
          <input oninput="ownerSearch(this.value)" value="${esc(__ownerSearch)}" placeholder="Search account or user…" class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
        </div>
        <div id="owner-work-cards" class="grid grid-cols-1 lg:grid-cols-2 gap-3"></div>`;
      ownerRenderCards();
    },
    insights(body) {
      const accts = __ownerAccounts;
      const prodCounts = {};
      for (const k of Object.keys(__ownerProductLabels)) prodCounts[k] = accts.filter(a => a.products && a.products[k]).length;
      const engCounts = {};
      for (const f of __ownerFlags) engCounts[f.key] = accts.filter(a => a.engines && a.engines[f.key]).length;
      const barRow = (label, n) => `<div class="flex items-center gap-2 text-[13px] py-1">
        <span class="w-40 flex-shrink-0 text-slate-600 dark:text-slate-300 font-semibold truncate">${esc(label)}</span>
        <span class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span class="block h-full bg-indigo-500" style="width:${accts.length ? Math.round(n / accts.length * 100) : 0}%"></span></span>
        <span class="w-8 text-right font-bold text-slate-700 dark:text-slate-200">${n}</span></div>`;
      body.innerHTML = `
        ${engCard('Product adoption', Object.keys(__ownerProductLabels).map(k => barRow(__ownerProductLabels[k], prodCounts[k])).join(''))}
        ${engCard('Engine adoption', __ownerFlags.map(f => barRow(f.label, engCounts[f.key])).join(''))}`;
    },
    automation(body) {
      body.innerHTML = engCard('Provisioning', `<p class="text-[13px] text-slate-600 dark:text-slate-300">Paid subscriptions provision products and engines automatically via Stripe webhooks. The toggles on the Accounts tab are manual overrides — use them to comp an account, extend a trial, or grant an engine outside of billing.</p>`);
    },
    settings(body) {
      body.innerHTML = engCard('Engine flags', `<div class="text-[13px] text-slate-600 dark:text-slate-300"><p class="mb-2">These entitlements can be toggled per account on the Accounts tab:</p><div class="flex flex-wrap gap-1.5">${__ownerFlags.map(f => `<span class="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${esc(f.label)}</span>`).join('')}</div><p class="text-[12px] text-slate-400 mt-3">Stripe price IDs and plan limits are configured via environment variables on the server.</p></div>`);
    },
  },
};
function loadOwnerUsersPage() { renderEngine('owner-users'); }
async function ownerToggleEngine(dealerId, key, active) {
  try {
    await apiSendJson(`/owner/dealership/${dealerId}/engines`, 'POST', { key, active });
    const acc = __ownerAccounts.find(a => a.id === dealerId);
    if (acc) acc.engines[key] = active;
    ownerRenderCards();
  } catch (e) { showToast(e.message, 'error'); }
}
async function ownerToggleProduct(dealerId, key, active) {
  try {
    const r = await apiSendJson(`/owner/dealership/${dealerId}/products`, 'POST', { key, active });
    const acc = __ownerAccounts.find(a => a.id === dealerId);
    if (acc) acc.products = r.products || acc.products;
    ownerRenderCards();
  } catch (e) { showToast(e.message, 'error'); }
}
async function ownerBill(kind, id, action) {
  const body = action === 'comp' ? { clear_trial: true }
    : action === 'trial30' ? { trial_days: 30 }
    : action === 'trial7' ? { trial_days: 7 }
    : action === 'block' ? { billing_status: 'INACTIVE' } : {};
  if (action === 'block' && !confirm('Block this account? They will be locked out until reactivated.')) return;
  try {
    await apiSendJson(`/owner/${kind === 'user' ? 'user' : 'dealership'}/${id}/billing`, 'POST', body);
    showToast('Updated ', 'success');
    loadOwnerUsersPage();
  } catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { loadOwnerUsersPage, ownerSearch, ownerToggleEngine, ownerToggleProduct, ownerBill });

// ══ Affiliates — referral partners, rates, and payouts (owner) ════════════════
const affBadge = (s) => `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s === 'active' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/40 text-rose-600'}">${esc(s)}</span>`;
function affRow(a) {
  return `<tr class="border-b border-slate-100 dark:border-slate-800/60">
    <td class="px-3 py-2"><div class="font-semibold">${esc(a.name || a.email)}</div><div class="text-[11px] text-slate-400">${esc(a.email)} · <span class="font-mono">${esc(a.code)}</span></div></td>
    <td class="px-3 py-2 text-center">${a.referrals} <span class="text-slate-400">/ ${a.active} paying</span></td>
    <td class="px-3 py-2 text-center">${a.rate_pct}% · ${Number(a.rate_months) > 0 ? a.rate_months + 'mo' : 'life'}</td>
    <td class="px-3 py-2 text-right text-amber-600 dark:text-amber-400">${commMoney(a.pending)}</td>
    <td class="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">${commMoney(a.paid)}</td>
    <td class="px-3 py-2 text-center">${affBadge(a.status)}</td>
    <td class="px-3 py-2 text-right whitespace-nowrap">
      <button onclick='affAdminEdit(${JSON.stringify(a)})' class="text-xs font-bold text-indigo-600 hover:text-indigo-500">Edit</button>
      ${a.pending > 0 ? `<button onclick="affAdminPay('${a.id}', ${a.pending})" class="text-xs font-bold text-emerald-600 hover:text-emerald-500 ml-2">Pay out</button>` : ''}
    </td></tr>`;
}
ENGINES['affiliates-admin'] = {
  rootId: 'affadmin-root', title: 'Affiliates', subtitle: 'Referral partners, their rates, and payouts',
  icon: 'trophy', accent: 'amber', hideRail: true, hideTabBar: true, tabOrder: ['work'],
  tabLabels: { overview: 'Affiliate Directory', work: 'Pending Payouts', insights: 'Referral Links', automation: 'Commission Tiers', settings: 'Payout Logs' },
  fetch: () => apiGetJson('/affiliate/admin/list'),
  quickActions: [
    { label: 'Program page', icon: 'globe', onclick: "window.open('affiliates.html','_blank')" },
    { label: 'MarketSync HQ', icon: 'chart', onclick: "switchPage('saas-command')" },
  ],
  nextActions: (d) => {
    const owed = (d?.affiliates || []).filter(a => a.pending > 0).length;
    return owed ? [{ label: `${owed} affiliate${owed === 1 ? '' : 's'} owed a payout`, icon: 'currency', tone: 'text-amber-500', onclick: "engineTab('affiliates-admin','work')" }] : [];
  },
  tabs: {
    overview(body, d) {
      const t = d.totals || {};
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          ${engKpi('Affiliates', (t.affiliates || 0).toLocaleString())}
          ${engKpi('Referrals', (t.referrals || 0).toLocaleString())}
          ${engKpi('Paying', (t.active || 0).toLocaleString(), 'text-emerald-600 dark:text-emerald-400')}
          ${engKpi('Owed', commMoney(t.pending), 'text-amber-600 dark:text-amber-400')}
          ${engKpi('Paid out', commMoney(t.paid))}
        </div>
        <p class="text-[13px] text-slate-500 dark:text-slate-400">Affiliates sign up at <a href="affiliates.html" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:underline">marketsync.link/affiliates</a>.</p>`;
    },
    work(body, d) {
      const rows = (d.affiliates || []).map(affRow).join('');
      body.innerHTML = `<div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[760px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <th class="px-3 py-2">Affiliate</th><th class="px-3 py-2 text-center">Referrals</th><th class="px-3 py-2 text-center">Rate</th><th class="px-3 py-2 text-right">Pending</th><th class="px-3 py-2 text-right">Paid</th><th class="px-3 py-2 text-center">Status</th><th class="px-3 py-2"></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7" class="px-3 py-8 text-center text-slate-400">No affiliates yet. Share the program page to get your first partners.</td></tr>'}</tbody></table></div>`;
    },
    insights(body, d) {
      const affs = (d.affiliates || []).slice().sort((a, b) => (b.paid + b.pending) - (a.paid + a.pending));
      const totalRef = affs.reduce((s, a) => s + (a.referrals || 0), 0);
      const totalPaying = affs.reduce((s, a) => s + (a.active || 0), 0);
      const conv = totalRef ? Math.round(totalPaying / totalRef * 100) : 0;
      const top = affs.slice(0, 8).map(a => `<div class="flex items-center justify-between text-[13px] py-1 border-t border-slate-100 dark:border-slate-800/60 first:border-0"><span class="font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(a.name || a.email)}</span><span class="font-bold text-slate-800 dark:text-slate-100">${commMoney((a.paid || 0) + (a.pending || 0))}</span></div>`).join('') || engEmpty('No affiliates yet.');
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${engKpi('Referrals → paying', conv + '%', 'text-amber-600 dark:text-amber-400')}
          ${engKpi('Total referrals', totalRef.toLocaleString())}
          ${engKpi('Paying customers', totalPaying.toLocaleString(), 'text-emerald-600 dark:text-emerald-400')}
        </div>
        ${engCard('Top affiliates by earnings', top)}`;
    },
    automation(body) {
      body.innerHTML = engCard('Commission automation', `<p class="text-[13px] text-slate-600 dark:text-slate-300">Commissions accrue automatically when a referred account pays, using each affiliate's rate and duration. Paying out posts the amount as a MarketSync expense in Accounting.</p>`);
    },
    settings(body) {
      body.innerHTML = engCard('Program settings', `<div class="text-[13px] text-slate-600 dark:text-slate-300 space-y-2"><p>Each affiliate's commission % and duration (months, or lifetime) are set per partner — edit them on the Affiliates tab.</p><p class="text-[12px] text-slate-400">The public sign-up page is <a href="affiliates.html" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:underline">affiliates.html</a>.</p></div>`);
    },
  },
};
window.loadAffiliatesAdmin = loadAffiliatesAdmin;

// ══ Staff / Team Messaging App ══════════════════════════════════════════════
let __teamChatMembers = [];
let __teamChatActiveUserId = null;
let __teamChatFilter = 'all'; // 'all', 'online', 'unread'
let __teamChatSearch = '';
let __teamChatPollTimer = null;

async function loadAiInbox() {
  const root = document.getElementById('ai-inbox-root'); if (!root) return;
  if (__teamChatPollTimer) clearInterval(__teamChatPollTimer);

  root.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2 mb-4">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>${svgIcon('chat', 'w-6 h-6 text-sky-500')}</span>
          <span>Team Messaging</span>
        </h1>
        <p class="text-xs text-slate-500 dark:text-slate-400">Directly message staff members across sales, service, parts, F&amp;I, and accounting. See who is online or leave a message for when they log in.</p>
      </div>
      <button onclick="refreshTeamChat()" class="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        ${svgIcon('refresh', 'w-3.5 h-3.5')} Refresh
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
      <!-- Left Column: Staff Roster -->
      <div class="md:col-span-4 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div class="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-slate-950/50">
          <input type="text" id="team-chat-search" placeholder="Search staff members…" oninput="filterTeamChatRoster(this.value)" class="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <div class="flex items-center gap-1">
            <button onclick="setTeamChatFilter('all')" id="tc-flt-all" class="flex-1 text-[11px] font-bold py-1 rounded-lg bg-sky-600 text-white transition">All</button>
            <button onclick="setTeamChatFilter('online')" id="tc-flt-online" class="flex-1 text-[11px] font-bold py-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition">Online</button>
            <button onclick="setTeamChatFilter('unread')" id="tc-flt-unread" class="flex-1 text-[11px] font-bold py-1 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition">Unread</button>
          </div>
        </div>
        <div id="team-chat-roster-list" class="flex-1 overflow-y-auto p-2 space-y-1">
          <div class="p-4 text-center text-xs text-slate-400">Loading staff roster…</div>
        </div>
      </div>

      <!-- Right Column: Direct Message Thread -->
      <div id="team-chat-thread-container" class="md:col-span-8 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <div class="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 grid place-items-center mb-3">
            ${svgIcon('chat', 'w-6 h-6')}
          </div>
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Select a colleague to start messaging</div>
          <p class="text-xs max-w-sm text-slate-400">Colleagues will receive an instant notification. If they are offline, your messages will be ready for them when they sign back on.</p>
        </div>
      </div>
    </div>
  `;

  await refreshTeamChat();
  if (__teamChatPollTimer) clearInterval(__teamChatPollTimer);
  __teamChatPollTimer = setInterval(pollTeamChatMessages, 8000);
}
window.loadAiInbox = loadAiInbox;

async function refreshTeamChat() {
  try {
    const res = await apiGetJson('/team/chat/roster');
    __teamChatMembers = res?.members || [];
    renderTeamChatRoster();
    if (__teamChatActiveUserId) {
      await loadTeamChatThread(__teamChatActiveUserId, false);
    }
  } catch (e) {
    const rosterList = document.getElementById('team-chat-roster-list');
    if (rosterList) rosterList.innerHTML = `<div class="p-4 text-center text-xs text-rose-500">Could not load staff list.</div>`;
  }
}
window.refreshTeamChat = refreshTeamChat;

function setTeamChatFilter(flt) {
  __teamChatFilter = flt;
  ['all', 'online', 'unread'].forEach(k => {
    const b = document.getElementById(`tc-flt-${k}`);
    if (b) b.className = `flex-1 text-[11px] font-bold py-1 rounded-lg transition ${k === flt ? 'bg-sky-600 text-white' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800'}`;
  });
  renderTeamChatRoster();
}
window.setTeamChatFilter = setTeamChatFilter;

function filterTeamChatRoster(val) {
  __teamChatSearch = (val || '').toLowerCase().trim();
  renderTeamChatRoster();
}
window.filterTeamChatRoster = filterTeamChatRoster;

function renderTeamChatRoster() {
  const el = document.getElementById('team-chat-roster-list');
  if (!el) return;

  let filtered = __teamChatMembers.filter(m => {
    if (__teamChatSearch && !m.name.toLowerCase().includes(__teamChatSearch) && !m.role.toLowerCase().includes(__teamChatSearch)) return false;
    if (__teamChatFilter === 'online' && !m.online) return false;
    if (__teamChatFilter === 'unread' && !m.unread_count) return false;
    return true;
  });

  if (!filtered.length) {
    el.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No staff members found matching criteria.</div>`;
    return;
  }

  el.innerHTML = filtered.map(m => {
    const active = m.id === __teamChatActiveUserId;
    const initial = (m.name || 'S').charAt(0).toUpperCase();
    const lastSnippet = m.last_message ? (m.last_message.from_me ? 'You: ' : '') + m.last_message.content : 'No messages yet';
    return `
      <button onclick="selectTeamChatUser('${m.id}')" class="w-full text-left flex items-center gap-3 p-2.5 rounded-xl transition ${active ? 'bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'}">
        <div class="relative flex-shrink-0">
          <div class="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black grid place-items-center text-xs">
            ${m.avatar_url ? `<img src="${esc(m.avatar_url)}" class="w-full h-full rounded-full object-cover"/>` : initial}
          </div>
          <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${m.online ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(m.name)}</span>
            <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">${esc(m.role)}</span>
          </div>
          <div class="flex items-center justify-between gap-1 mt-0.5">
            <span class="text-[11px] text-slate-400 truncate">${esc(lastSnippet)}</span>
            ${m.unread_count ? `<span class="bg-sky-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">${m.unread_count}</span>` : ''}
          </div>
        </div>
      </button>
    `;
  }).join('');
}

async function selectTeamChatUser(userId) {
  __teamChatActiveUserId = userId;
  renderTeamChatRoster();
  await loadTeamChatThread(userId, true);
}
window.selectTeamChatUser = selectTeamChatUser;

async function loadTeamChatThread(userId, initialLoad = false) {
  const container = document.getElementById('team-chat-thread-container');
  if (!container) return;

  const target = __teamChatMembers.find(m => m.id === userId);
  if (!target) return;

  let messages = [];
  try {
    const res = await apiGetJson(`/team/chat/messages?with=${encodeURIComponent(userId)}`);
    messages = res?.messages || [];
  } catch { /* keep last */ }

  if (target.unread_count) {
    target.unread_count = 0;
    renderTeamChatRoster();
  }

  const initial = (target.name || 'S').charAt(0).toUpperCase();

  const msgListHtml = messages.length ? messages.map(m => {
    const fromMe = m.sender_id !== target.id;
    const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return `
      <div class="flex flex-col ${fromMe ? 'items-end' : 'items-start'} space-y-1">
        <div class="max-w-[78%] px-3.5 py-2 rounded-2xl ${fromMe ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'} text-xs leading-relaxed break-words">
          ${esc(m.content)}
        </div>
        <span class="text-[10px] text-slate-400 px-1">${timeStr}</span>
      </div>
    `;
  }).join('') : `
    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
      <p class="text-xs">No previous messages with ${esc(target.name)}. Say hello!</p>
    </div>
  `;

  if (initialLoad || !document.getElementById('team-chat-msg-body')) {
    container.innerHTML = `
      <!-- Header -->
      <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
        <div class="flex items-center gap-3">
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold grid place-items-center text-xs">
              ${target.avatar_url ? `<img src="${esc(target.avatar_url)}" class="w-full h-full rounded-full object-cover"/>` : initial}
            </div>
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${target.online ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          </div>
          <div>
            <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>${esc(target.name)}</span>
              <span class="text-[10px] font-normal text-slate-400">(${esc(target.role)})</span>
            </div>
            <div class="text-[11px] ${target.online ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-slate-400'}">
              ${target.online ? '<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 align-middle mr-1"></span>Online now' : '<span class="inline-block w-2 h-2 rounded-full bg-slate-400 align-middle mr-1"></span>Offline — replies saved for when they log in'}
            </div>
          </div>
        </div>
      </div>

      <!-- Messages Body -->
      <div id="team-chat-msg-body" class="flex-1 overflow-y-auto p-4 space-y-3">
        ${msgListHtml}
      </div>

      <!-- Input Footer -->
      <form id="team-chat-form" onsubmit="sendTeamChatMessage(event)" class="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
        <input type="text" id="team-chat-input" placeholder="Message ${esc(target.name)}… (Enter to send)" class="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500" autocomplete="off" />
        <button type="submit" class="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5">
          <span>Send</span>
          <svg class="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m-7 7l7-7 7 7"/></svg>
        </button>
      </form>
    `;
    const box = document.getElementById('team-chat-msg-body');
    if (box) box.scrollTop = box.scrollHeight;
    document.getElementById('team-chat-input')?.focus();
  } else {
    const box = document.getElementById('team-chat-msg-body');
    if (box) {
      const isAtBottom = (box.scrollHeight - box.scrollTop) <= (box.clientHeight + 60);
      box.innerHTML = msgListHtml;
      if (isAtBottom) box.scrollTop = box.scrollHeight;
    }
  }
}

async function sendTeamChatMessage(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('team-chat-input');
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text || !__teamChatActiveUserId) return;

  input.value = '';
  try {
    await apiPostJson('/team/chat/messages', { recipient_id: __teamChatActiveUserId, content: text });
    await loadTeamChatThread(__teamChatActiveUserId, false);
    const box = document.getElementById('team-chat-msg-body');
    if (box) box.scrollTop = box.scrollHeight;
  } catch (err) {
    showToast('Failed to send message: ' + (err.message || 'Error'), 'error');
  }
}
window.sendTeamChatMessage = sendTeamChatMessage;

async function pollTeamChatMessages() {
  if (document.hidden) return;
  const activePage = document.querySelector('[data-page-content="ai-inbox"]');
  if (!activePage || activePage.classList.contains('hidden')) return;
  if (__teamChatActiveUserId) {
    await loadTeamChatThread(__teamChatActiveUserId, false);
  }
}
function aiCopyEmbed() {
  const el = document.getElementById('ai-embed-code') || document.getElementById('ai-embed-snippet');
  if (!el) return;
  navigator.clipboard?.writeText(el.textContent).then(() => showToast('Snippet copied ', 'success')).catch(() => showToast('Copy failed', 'error'));
}
window.aiCopyEmbed = aiCopyEmbed;
// Mirrors the backend scoreConversation() so we can explain how a lead score was
// reached. Keep in sync with routes/ai-runtime.js:scoreConversation.
function aiScoreFactors(messages, captured, memory) {
  const text = (messages || []).filter(m => m.role === 'user').map(m => m.message).join(' ').toLowerCase();
  const eng = Math.min(20, (messages || []).length * 2);
  return [
    { label: 'Engagement (message count)', pts: eng, on: eng > 0 },
    { label: 'Shared contact info', pts: 25, on: !!captured },
    { label: 'Mentioned a trade-in', pts: 12, on: /trade|trade-in|my car/.test(text) },
    { label: 'Asked about financing / payments', pts: 15, on: /financ|payment|apr|monthly|approv|credit/.test(text) },
    { label: 'Wants a test drive / to visit', pts: 15, on: /test drive|appointment|come in|visit|see it/.test(text) },
    { label: 'Buying-intent language', pts: 8, on: /buy|purchase|deal|price|available|in stock/.test(text) },
    { label: 'Named a vehicle of interest', pts: 5, on: (memory || []).some(m => m.memory_type === 'vehicle_interest') },
  ];
}
// Badge tone for the lead-score button. Thresholds match aiFeedRow's score coloring
// (dashboard-part10.js) and the "80+ triggers a hot-lead alert" copy shown below it.
function AI_SCORE_TONE(score) {
  if (score >= 80) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
  if (score >= 50) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
}
let __aiConvo = null;   // last opened conversation cache (for print / share)
let __aiReplySender = 'rep'; // 'rep' or 'ai'
let __aiReplyChannel = 'chat'; // 'chat', 'sms', 'email'

function aiSetReplySender(who) {
  __aiReplySender = who === 'ai' ? 'ai' : 'rep';
  const on = 'bg-indigo-600 text-white shadow-sm', off = 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  const rep = document.getElementById('ai-sender-rep'), ai = document.getElementById('ai-sender-ai');
  if (rep) rep.className = `px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplySender === 'rep' ? on : off}`;
  if (ai) ai.className = `px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplySender === 'ai' ? on : off}`;
}
window.aiSetReplySender = aiSetReplySender;

function aiSetReplyChannel(ch) {
  __aiReplyChannel = ['chat', 'sms', 'email'].includes(ch) ? ch : 'chat';
  const on = 'bg-indigo-600 text-white shadow-sm', off = 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
  const chat = document.getElementById('ai-chan-chat');
  const sms = document.getElementById('ai-chan-sms');
  const email = document.getElementById('ai-chan-email');
  if (chat) chat.className = `px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'chat' ? on : off}`;
  if (sms) sms.className = `px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'sms' ? on : off}`;
  if (email) email.className = `px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'email' ? on : off}`;
}
window.aiSetReplyChannel = aiSetReplyChannel;

function aiSetReplyAs(who, ch) {
  if (who) aiSetReplySender(who);
  if (ch) aiSetReplyChannel(ch);
}
window.aiSetReplyAs = aiSetReplyAs;

async function aiOpenConversation(id) {
  const overlay = crmOverlay(`<div class="p-5"><div class="text-sm text-slate-400 py-16 text-center">Loading…</div></div>`, 'max-w-2xl');
  const panel = overlay.firstElementChild;
  let convo = null, messages = [], memory = [], qualification = null, scoreDetails = null, leadBrief = null;
  try {
    const d = await apiGetJson(`/ai/conversations/${id}`);
    convo = d.conversation;
    messages = d.messages || [];
    memory = d.memory || [];
    qualification = d.qualification || null;
    scoreDetails = d.score_details || null;
    leadBrief = d.lead_brief || null;
  } catch {
    if (panel) panel.innerHTML = '<div class="p-6 text-rose-500 text-sm">Could not load.</div>';
    return;
  }
  if (!panel || !overlay.isConnected) return;
  
  // Persona name for the assistant (cached).
  if (window.__aiAssistantName === undefined) { try { const pr = await apiGetJson('/ai/personality'); window.__aiAssistantName = pr.personality?.name || ''; } catch { window.__aiAssistantName = ''; } }
  convo.assistant_name = window.__aiAssistantName || 'Avery (AI)';
  __aiConvo = { id, convo, messages, memory, qualification, scoreDetails, leadBrief };

  // Calculate live presence status
  const lastMsgTime = convo.last_message_at ? new Date(convo.last_message_at).getTime() : 0;
  const now = Date.now();
  const minsDiff = (now - lastMsgTime) / 60000;
  const isOnline = minsDiff < 5;
  const isAway = minsDiff >= 5 && minsDiff < 15;
  const isOffline = !isOnline && !isAway;

  // Auto-route default channel
  if (isOnline) __aiReplyChannel = 'chat';
  else if (convo.contact_phone) __aiReplyChannel = 'sms';
  else if (convo.contact_email) __aiReplyChannel = 'email';
  else __aiReplyChannel = 'chat';

  const presenceBadge = isOnline 
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Online on Website</span>`
    : isAway
    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Away (Tab Hidden)</span>`
    : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20"><span class="w-2 h-2 rounded-full bg-slate-400"></span>Offline (Left Site)</span>`;

  const bubbles = messages.map(m => {
    const isUser = m.role === 'user';
    const isHuman = !isUser && m.sender_type === 'human';
    const channelTag = m.channel === 'sms' ? 'SMS' : m.channel === 'email' ? 'Email' : 'Website Chat';
    const label = isUser ? 'Customer' : (isHuman ? 'You' : (convo.assistant_name || 'AI'));
    const tone = isUser ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
      : isHuman ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white';
    
    return `
      <div class="flex flex-col ${isUser ? 'items-start' : 'items-end'} mb-2">
        <div class="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold text-slate-400">
          <span>${esc(label)}</span>
          <span>·</span>
          <span class="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">${esc(channelTag)}</span>
          ${m.created_at ? `<span>· ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
        </div>
        <div class="max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] whitespace-pre-wrap ${tone}">${esc(m.message)}</div>
      </div>
    `;
  }).join('');

  const score = convo.lead_score || (scoreDetails?.score || 0);
  const scoreCat = scoreDetails?.category || (score >= 75 ? 'HOT' : score >= 45 ? 'WARM' : 'NURTURE');
  const reasonsList = scoreDetails?.reasons || [];
  const handoff = convo.status === 'handoff';

  // Lead brief section HTML
  const vehicleName = leadBrief?.interest?.vehicle_title || qualification?.vehicle_interest || 'Vehicle not specified';
  const timeframe = leadBrief?.purchase?.timeframe || qualification?.purchase_timeframe || 'Not specified';
  const budget = leadBrief?.purchase?.budget_or_payment || qualification?.comfortable_payment_range || qualification?.budget_range || 'Flexible';
  const trade = leadBrief?.trade?.vehicle || 'None / Undecided';
  const mainObj = leadBrief?.objections?.primary || qualification?.main_objection || null;
  const nextAction = leadBrief?.next_best_action?.suggested_action || 'Follow up with shopper';
  const openingLine = leadBrief?.next_best_action?.suggested_opening_line || '';

  const briefCard = `
    <div class="p-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-950/20 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${scoreCat === 'HOT' ? 'bg-rose-500 text-white' : scoreCat === 'WARM' ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'}">${scoreCat} LEAD</span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200">AI Qualification Brief</span>
        </div>
        <span class="text-[11px] font-bold text-sky-600 dark:text-sky-400">Score ${score}/100</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div class="text-[10px] font-bold uppercase text-slate-400">Target Vehicle</div>
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate" title="${esc(vehicleName)}">${esc(vehicleName)}</div>
        </div>
        <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div class="text-[10px] font-bold uppercase text-slate-400">Timeframe</div>
          <div class="font-bold text-slate-800 dark:text-slate-200 capitalize truncate">${esc(timeframe)}</div>
        </div>
        <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div class="text-[10px] font-bold uppercase text-slate-400">Budget / Pmt</div>
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate">${esc(budget)}</div>
        </div>
        <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div class="text-[10px] font-bold uppercase text-slate-400">Trade-in</div>
          <div class="font-bold text-slate-800 dark:text-slate-200 truncate" title="${esc(trade)}">${esc(trade)}</div>
        </div>
      </div>

      ${mainObj && mainObj !== 'None identified' ? `
        <div class="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl">
          <span class="font-bold">Objection Note:</span>
          <span>${esc(mainObj)}</span>
        </div>
      ` : ''}

      <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Recommended Next Step</span>
          ${openingLine ? `<button type="button" onclick="aiUseOpeningLine()" class="text-[11px] font-bold text-indigo-600 hover:underline">Use Suggested Opening</button>` : ''}
        </div>
        <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${esc(nextAction)}</div>
        ${openingLine ? `<div id="ai-opening-script" class="text-[11px] text-slate-500 dark:text-slate-400 italic">“${esc(openingLine)}”</div>` : ''}
      </div>
    </div>
  `;

  panel.innerHTML = `<div class="p-5 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-lg font-black text-slate-900 dark:text-white truncate">${convo.contact_name ? esc(convo.contact_name) : 'AI Conversation'}</h2>
          ${presenceBadge}
          <button onclick="document.getElementById('ai-score-explain').classList.toggle('hidden')" title="How is this scored?" class="text-[11px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${AI_SCORE_TONE(score)}">score ${score} ⓘ</button>
        </div>
        ${(convo.contact_phone || convo.contact_email) ? `<div class="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">${esc(convo.contact_phone || '')}${convo.contact_phone && convo.contact_email ? ' · ' : ''}${esc(convo.contact_email || '')}</div>` : ''}
      </div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>

    <div id="ai-score-explain" class="hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Lead Score Signals (${scoreCat} · ${score}/100)</div>
      ${reasonsList.length ? reasonsList.map(r => `<div class="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>${esc(r)}</div>`).join('') : '<div class="text-xs text-slate-400">Early inquiry / browsing</div>'}
    </div>

    ${briefCard}

    <div id="ai-convo-log" class="space-y-2 max-h-64 overflow-y-auto p-1 border-t border-b border-slate-100 dark:border-slate-800 py-3">${bubbles || '<div class="text-sm text-slate-400 text-center py-6">No messages.</div>'}</div>

    <!-- Offline Visitor Fallback Alert -->
    ${!isOnline ? `
      <div class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5">
        <div class="font-bold text-amber-600 dark:text-amber-300 flex items-center justify-between">
          <span>Website visitor is offline</span>
          <span class="text-[10px] font-mono text-slate-400">Omnichannel Fallback</span>
        </div>
        <p class="text-slate-500 dark:text-slate-400 leading-relaxed">Replying via Website Chat will be received when the visitor returns to your site. Select <b>SMS</b> or <b>Email</b> to reach them immediately.</p>
        <div class="flex items-center gap-2 pt-1">
          ${convo.contact_phone ? `<button type="button" onclick="aiSetReplyChannel('sms')" class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition">Continue by SMS</button>` : ''}
          ${convo.contact_email ? `<button type="button" onclick="aiSetReplyChannel('email')" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] transition">Continue by Email</button>` : ''}
        </div>
      </div>
    ` : ''}

    <!-- Reply Box with Independent Sender & Channel Selectors -->
    <div class="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-3 space-y-3">
      <div class="grid sm:grid-cols-2 gap-3 pb-1 border-b border-slate-200 dark:border-slate-800">
        <!-- Sender Selector -->
        <div>
          <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Send as (Sender)</label>
          <div class="inline-flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 text-xs">
            <button type="button" id="ai-sender-rep" onclick="aiSetReplySender('rep')" class="px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplySender === 'rep' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}">You (rep)</button>
            <button type="button" id="ai-sender-ai" onclick="aiSetReplySender('ai')" class="px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplySender === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}">${esc(convo.assistant_name)}</button>
          </div>
        </div>

        <!-- Channel Selector -->
        <div>
          <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Channel (Transport)</label>
          <div class="inline-flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1 text-xs">
            <button type="button" id="ai-chan-chat" onclick="aiSetReplyChannel('chat')" class="px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'chat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}">Website Chat</button>
            <button type="button" id="ai-chan-sms" onclick="aiSetReplyChannel('sms')" ${!convo.contact_phone ? 'disabled' : ''} class="px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'sms' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 disabled:opacity-30'}" title="${convo.contact_phone ? 'Send via SMS' : 'No phone number available'}">SMS</button>
            <button type="button" id="ai-chan-email" onclick="aiSetReplyChannel('email')" ${!convo.contact_email ? 'disabled' : ''} class="px-3 py-1 rounded-lg font-bold transition text-xs ${__aiReplyChannel === 'email' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 disabled:opacity-30'}" title="${convo.contact_email ? 'Send via Email' : 'No email available'}">Email</button>
          </div>
        </div>
      </div>

      <textarea id="ai-reply-box" rows="3" placeholder="Type your message to the customer..." class="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"></textarea>

      <div class="flex items-center gap-1.5 flex-wrap py-1">
        <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Co-Pilot:</span>
        <button onclick="aiDraftReply('${id}',this,'draft')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Draft full reply with AI">Draft</button>
        <button onclick="aiDraftReply('${id}',this,'shorter')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Make reply shorter and punchy">Shorter</button>
        <button onclick="aiDraftReply('${id}',this,'warmer')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Make reply warm and welcoming">Warmer</button>
        <button onclick="aiDraftReply('${id}',this,'direct')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Direct test drive ask">Direct</button>
        <button onclick="aiDraftReply('${id}',this,'explain_objection')" class="text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition" title="Analyze customer objection">Explain</button>
        <button onclick="aiDraftReply('${id}',this,'suggest_alternative')" class="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition" title="Suggest inventory alternatives">Alternative</button>
      </div>

      <div class="flex items-center gap-2 flex-wrap pt-1">
        <button onclick="aiSendReply('${id}',this)" class="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-md transition">Send Message</button>
        ${handoff ? `<button onclick="aiSetConvStatus('${id}','active',this)" class="text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-2">Hand back to AI</button>` : ''}
        <div class="flex-1"></div>
        <button onclick="aiRefreshConvo('${id}')" class="text-xs font-bold text-slate-400 hover:text-slate-200 px-2 py-2" title="Refresh">↻ Refresh</button>
      </div>
    </div>

    <div class="flex items-center gap-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex-wrap">
      <button onclick="aiPrintConversation()" class="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-2">Save / Print PDF</button>
      <div class="relative">
        <button onclick="document.getElementById('ai-share-menu').classList.toggle('hidden')" class="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-2">↗ Share</button>
        <div id="ai-share-menu" class="hidden absolute bottom-full left-0 mb-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1 z-10">
          <button onclick="aiShareConversation('email')" class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800">Email</button>
          <button onclick="aiShareConversation('sms')" class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800">Text</button>
          <button onclick="aiShareConversation('copy')" class="w-full text-left px-3 py-1.5 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-800">Copy link</button>
        </div>
      </div>
      <div class="flex-1"></div>
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-3 py-2">Close</button>
    </div></div>`;

  aiSetReplySender(__aiReplySender);
  aiSetReplyChannel(__aiReplyChannel);
}

function aiUseOpeningLine() {
  if (!__aiConvo?.leadBrief?.next_best_action?.suggested_opening_line) return;
  const line = __aiConvo.leadBrief.next_best_action.suggested_opening_line;
  const box = document.getElementById('ai-reply-box');
  if (box) {
    box.value = line;
    box.focus();
    showToast('Suggested opening line inserted', 'info');
  }
}
window.aiUseOpeningLine = aiUseOpeningLine;

async function aiSendReply(id, btn) {
  const box = document.getElementById('ai-reply-box');
  const message = (box?.value || '').trim();
  if (!message) { showToast('Type a reply first', 'error'); return; }
  if (btn) btn.disabled = true;
  try {
    const mode = __aiReplySender === 'ai' ? 'ai' : 'human';
    const channel = __aiReplyChannel || 'chat';
    await apiSendJson(`/ai/conversations/${id}/reply`, 'POST', { mode, channel, message });
    if (box) box.value = '';
    showToast(`Sent as ${mode === 'ai' ? 'AI' : 'You'} via ${channel.toUpperCase()}`, 'success');
    aiOpenConversation(id);   // refresh transcript
  } catch (e) { showToast(e.message || 'Failed', 'error'); if (btn) btn.disabled = false; }
}

// AI Co-Pilot draft — generates suggested reply with chosen style/intent into the box
async function aiDraftReply(id, btn, style = 'draft') {
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try {
    const d = await apiSendJson(`/ai/conversations/${id}/reply`, 'POST', { mode: 'draft', style });
    const box = document.getElementById('ai-reply-box');
    if (box) {
      if (style === 'explain_objection') {
        showToast(d.draft || 'Analysis ready', 'info');
      } else {
        box.value = d.draft || '';
        box.focus();
        showToast('Draft ready — edit, then Send', 'success');
      }
    }
  } catch (e) { showToast(e.message || 'Failed', 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = origText; }
}
window.aiDraftReply = aiDraftReply;
async function aiRefreshConvo(id) { aiOpenConversation(id); }
async function aiSetConvStatus(id, status, btn) {
  if (btn) btn.disabled = true;
  try { await apiSendJson(`/ai/conversations/${id}/status`, 'POST', { status }); showToast(status === 'handoff' ? 'You have taken over' : 'Returned to AI', 'success'); aiOpenConversation(id); }
  catch (e) { showToast(e.message || 'Failed', 'error'); if (btn) btn.disabled = false; }
}
async function aiSummarize(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Summarizing…'; }
  try { await apiSendJson(`/ai/conversations/${id}/summarize`, 'POST'); showToast('Summary saved ', 'success'); aiOpenConversation(id); }
  catch (e) { showToast(e.message || 'Failed', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Summarize'; } }
}
function aiConvoTranscriptText() {
  if (!__aiConvo) return '';
  return (__aiConvo.messages || []).map(m => `${m.role === 'user' ? 'Customer' : 'Dealership'}: ${m.message}`).join('\n\n');
}
function aiPrintConversation() {
  if (!__aiConvo) return;
  const c = __aiConvo.convo || {};
  const rows = (__aiConvo.messages || []).map(m => `<div style="margin:8px 0"><div style="font-size:11px;color:#64748b;font-weight:700">${m.role === 'user' ? 'Customer' : 'Dealership'}</div><div style="background:${m.role === 'user' ? '#f1f5f9' : '#e0e7ff'};padding:8px 12px;border-radius:10px;display:inline-block;max-width:80%;white-space:pre-wrap">${esc(m.message)}</div></div>`).join('');
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to print', 'error'); return; }
  w.document.write(`<!doctype html><html><head><title>AI Conversation</title><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#0f172a}</style></head><body>
    <h2>AI Conversation</h2>
    <p style="color:#64748b;font-size:13px">Lead score: ${c.lead_score || 0} · ${c.department || 'general'} · ${c.lead_type || 'general'}${c.website ? ' · ' + esc(c.website) : ''}</p>
    ${c.summary ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;white-space:pre-wrap;font-size:13px">${esc(c.summary)}</div>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">${rows}
    <script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
function aiShareConversation(how) {
  document.getElementById('ai-share-menu')?.classList.add('hidden');
  if (!__aiConvo) return;
  const link = `${location.origin}${location.pathname}#ai-convo=${__aiConvo.id}`;
  const body = aiConvoTranscriptText();
  if (how === 'copy') { navigator.clipboard?.writeText(link).then(() => showToast('Link copied ', 'success')).catch(() => showToast('Copy failed', 'error')); return; }
  if (how === 'email') { window.open(`mailto:?subject=${encodeURIComponent('AI Conversation')}&body=${encodeURIComponent(body + '\n\n' + link)}`); return; }
  if (how === 'sms') { window.open(`sms:?&body=${encodeURIComponent('AI Conversation — ' + link)}`); return; }
}
// Deep link: open a conversation from a shared #ai-convo=<id> link.
function aiCheckConvoHash() {
  const m = (location.hash || '').match(/ai-convo=([\w-]+)/);
  if (m && typeof aiOpenConversation === 'function') aiOpenConversation(m[1]);
}
window.addEventListener('hashchange', aiCheckConvoHash);
Object.assign(window, { loadAiInbox, aiCopyEmbed, aiOpenConversation, aiSetConvStatus, aiSummarize, aiSendReply, aiSetReplySender, aiSetReplyChannel, aiSetReplyAs, aiDraftReply, aiRefreshConvo, aiPrintConversation, aiShareConversation });

// Budget — a monthly spending target per expense category, tracked against actual spend.
async function acctLoadBudget() {
  const body = document.getElementById('acct-body'); if (!body) return;
  try {
    const [acc, b] = await Promise.all([
      __acctState.accounts.length ? Promise.resolve({ accounts: __acctState.accounts }) : apiGetJson('/accounting/accounts'),
      apiGetJson(`/accounting/budget?month=${acctMonth()}`),
    ]);
    __acctState.accounts = acc.accounts || __acctState.accounts;
    const accts = __acctState.accounts.filter(a => a.category === 'expense' && a.active);
    const budgets = b.budgets || {}, actuals = b.actuals || {};
    let totBudget = 0, totActual = 0;
    const rows = accts.map(a => {
      const budget = Number(budgets[a.id]) || 0;
      const spent = Number(actuals[a.id]) || 0;
      totBudget += budget; totActual += spent;
      const pct = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
      const over = budget > 0 && spent > budget;
      const bar = budget > 0 ? (over ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-300 dark:bg-slate-700';
      const remain = budget - spent;
      return `<tr class="border-b border-slate-100 dark:border-slate-800/60">
        <td class="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-200">${esc(a.name)}</td>
        <td class="px-3 py-2.5"><div class="flex items-center gap-1"><span class="text-slate-400 text-xs">$</span><input data-budget-acct="${a.id}" type="number" min="0" step="10" value="${budget || ''}" placeholder="—" class="w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"></div></td>
        <td class="px-3 py-2.5 text-right font-bold ${over ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}">${commMoney(spent)}</td>
        <td class="px-3 py-2.5 w-40"><div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full ${bar} rounded-full transition-all" style="width:${budget > 0 ? Math.max(pct, spent > 0 ? 4 : 0) : 0}%"></div></div></td>
        <td class="px-3 py-2.5 text-right text-sm ${budget > 0 ? (remain < 0 ? 'text-rose-500 font-bold' : 'text-emerald-600 dark:text-emerald-400') : 'text-slate-400'}">${budget > 0 ? (remain < 0 ? `${commMoney(-remain)} over` : `${commMoney(remain)} left`) : '—'}</td>
      </tr>`;
    }).join('');
    const totPct = totBudget > 0 ? Math.min(100, Math.round(totActual / totBudget * 100)) : 0;
    const totOver = totBudget > 0 && totActual > totBudget;
    body.innerHTML = `
      <div class="flex items-center gap-2 mb-3 flex-wrap">
        <input type="month" value="${acctMonth()}" onchange="__acctState.date=this.value+'-01'; acctLoadBudget()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
        <span class="text-sm text-slate-500">Set a monthly target per category — spend is tracked automatically.</span>
      </div>
      ${totBudget > 0 ? `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4">
        <div class="flex items-center justify-between mb-1.5"><span class="text-sm font-bold">This month</span><span class="text-sm font-bold ${totOver ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}">${commMoney(totActual)} <span class="text-slate-400 font-normal">of</span> ${commMoney(totBudget)}</span></div>
        <div class="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div class="h-full ${totOver ? 'bg-rose-500' : totPct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'} rounded-full transition-all" style="width:${totPct}%"></div></div>
        ${totOver ? `<p class="text-[11px] text-rose-500 font-bold mt-1.5">Over budget by ${commMoney(totActual - totBudget)}.</p>` : `<p class="text-[11px] text-slate-400 mt-1.5">${commMoney(totBudget - totActual)} left across all categories.</p>`}
      </div>` : ''}
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[640px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Category</th><th class="px-3 py-2">Monthly budget</th><th class="px-3 py-2 text-right">Spent</th><th class="px-3 py-2">Progress</th><th class="px-3 py-2 text-right">Remaining</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400">No expense categories yet — add them under Settings.</td></tr>'}</tbody></table>
      </div>
      <div class="mt-3"><button onclick="acctSaveBudget(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save budget</button></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
async function acctSaveBudget(btn) {
  const budgets = {};
  document.querySelectorAll('[data-budget-acct]').forEach(el => { const v = parseFloat(el.value || '0'); if (v > 0) budgets[el.getAttribute('data-budget-acct')] = v; });
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await apiSendJson('/accounting/budget', 'PUT', { budgets }); showToast('Budget saved', 'success'); acctLoadBudget(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
window.acctLoadBudget = acctLoadBudget; window.acctSaveBudget = acctSaveBudget;

// Bank account — link a bank via Plaid; transactions feed the daily reconciliation.
function plaidEnsureScript() {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load Plaid.'));
    document.head.appendChild(s);
  });
}
async function acctLoadBank() {
  const body = document.getElementById('acct-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading…</div>';
  try {
    const st = await apiGetJson('/plaid/status');
    if (!st.configured) {
      body.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl text-center">
        <div class="w-12 h-12 mx-auto rounded-xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-2xl mb-3"></div>
        <div class="text-lg font-black text-slate-900 dark:text-white">Connect your bank</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">Bank linking isn't switched on for this server yet. Once it is, link your dealership account here to add a bank cross-check to daily reconciliation.</p>
        <button disabled class="text-sm font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 px-5 py-2.5 rounded-lg cursor-not-allowed">Connect with Plaid</button></div>`;
      return;
    }
    if (!st.connected) {
      body.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl text-center">
        <div class="w-12 h-12 mx-auto rounded-xl bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-2xl mb-3"></div>
        <div class="text-lg font-black text-slate-900 dark:text-white">Connect your bank</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Securely link your dealership bank via Plaid. We pull daily transactions and match money in against your recorded deposits — so reconciliation catches anything the books miss. Read-only; you can disconnect anytime.</p>
        <button onclick="plaidConnect(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg">Connect with Plaid</button></div>`;
      return;
    }
    const tx = await apiGetJson('/plaid/transactions').catch(() => ({ transactions: [] }));
    const rows = (tx.transactions || []).slice(0, 50).map(t => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="px-3 py-2">${t.txn_date}</td><td class="px-3 py-2">${esc(t.name || '')}${t.pending ? ' <span class="text-[10px] text-amber-500">pending</span>' : ''}</td>
      <td class="px-3 py-2 text-slate-500">${esc(t.category || '')}</td>
      <td class="px-3 py-2 text-right font-bold ${t.direction === 'in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}">${t.direction === 'in' ? '+' : '-'}${commMoney(t.amount)}</td></tr>`).join('');
    body.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div><div class="font-black text-slate-900 dark:text-white flex items-center gap-2"> ${esc(st.institution_name || 'Bank connected')}</div>
          <div class="text-[12px] text-slate-500 dark:text-slate-400">${(st.accounts || []).map(a => esc(a.name) + (a.mask ? ` ••${esc(a.mask)}` : '')).join(' · ') || 'Linked'}${st.last_sync ? ` · synced ${new Date(st.last_sync).toLocaleString()}` : ''}</div></div>
        <div class="flex items-center gap-2">
          <button onclick="plaidSync(this)" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">Sync now</button>
          <button onclick="plaidDisconnect(this)" class="text-xs font-bold text-rose-500 hover:text-rose-400">Disconnect</button>
        </div></div>
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[600px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Date</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Category</th><th class="px-3 py-2 text-right">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="px-3 py-6 text-center text-slate-400">No transactions yet — press Sync now.</td></tr>'}</tbody></table></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load bank status.')}</div>`; }
}
async function plaidConnect(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Opening…';
  try {
    await plaidEnsureScript();
    const { link_token } = await apiSendJson('/plaid/link-token', 'POST', {});
    if (!link_token) throw new Error('Could not start bank linking.');
    const handler = window.Plaid.create({
      token: link_token,
      onSuccess: async (public_token) => {
        try { await apiSendJson('/plaid/exchange', 'POST', { public_token }); showToast('Bank linked', 'success'); acctLoadBank(); }
        catch (e) { showToast(e.message || 'Could not link the bank', 'error'); }
      },
      onExit: () => { btn.disabled = false; btn.textContent = orig; },
    });
    handler.open();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not connect', 'error'); }
}
async function plaidSync(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Syncing…';
  try { const r = await apiSendJson('/plaid/sync', 'POST', {}); showToast(`Synced ${r.synced || 0} transactions`, 'success'); acctLoadBank(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Sync failed', 'error'); }
}
async function plaidDisconnect(btn) {
  if (!confirm('Disconnect your bank? Reconciliation will stop using the bank feed.')) return;
  btn.disabled = true;
  try { await apiSendJson('/plaid/disconnect', 'POST', {}); showToast('Bank disconnected', 'success'); acctLoadBank(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
window.plaidConnect = plaidConnect; window.plaidSync = plaidSync; window.plaidDisconnect = plaidDisconnect;

// Reports — the month's full ledger + reconciliation history, with CSV export.
async function acctLoadReportsDetail() {
  const body = document.getElementById('acct-body'); if (!body) return;
  try {
    const [acc, entriesR, recons] = await Promise.all([
      __acctState.accounts.length ? Promise.resolve({ accounts: __acctState.accounts }) : apiGetJson('/accounting/accounts'),
      apiGetJson(`/accounting/entries?from=${acctMonth()}-01&to=${acctMonth()}-31`),
      apiGetJson(`/accounting/reconciliations?month=${acctMonth()}`),
    ]);
    __acctState.accounts = acc.accounts || __acctState.accounts;
    const acctName = (id) => (__acctState.accounts.find(a => a.id === id) || {}).name || '—';
    window.__acctEntries = entriesR.entries || [];
    const entRows = (entriesR.entries || []).map(e => `<tr class="border-b border-slate-100 dark:border-slate-800/60"><td class="px-3 py-2">${e.entry_date}</td><td class="px-3 py-2">${acctName(e.account_id)}</td><td class="px-3 py-2 text-slate-500">${esc(e.description || '')}</td><td class="px-3 py-2">${e.source}</td><td class="px-3 py-2 text-right font-semibold ${e.direction === 'out' ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}">${e.direction === 'out' ? '-' : '+'}${commMoney(e.amount)}</td></tr>`).join('');
    const recRows = (recons.reconciliations || []).map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60"><td class="px-3 py-2">${r.recon_date}</td><td class="px-3 py-2">${r.status === 'off' ? '<span class="text-rose-500 font-bold">Off</span>' : '<span class="text-emerald-600 dark:text-emerald-400 font-bold">Balanced</span>'}</td><td class="px-3 py-2 text-right">${commMoney(r.income_posted)}</td><td class="px-3 py-2 text-right">${commMoney(r.expenses_total)}</td><td class="px-3 py-2 text-right">${commMoney(r.recorded_cash)}</td><td class="px-3 py-2 text-right">${commMoney(r.variance)}</td></tr>`).join('');
    body.innerHTML = `
      <div class="flex items-center gap-2 mb-3"><input type="month" value="${acctMonth()}" onchange="__acctState.date=this.value+'-01'; acctLoadReportsDetail()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"><button onclick="acctExportCsv()" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">Export CSV</button></div>
      <div class="mb-4"><div class="font-bold mb-1">Reconciliation history</div>
        <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"><table class="w-full text-sm min-w-[560px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Date</th><th class="px-3 py-2">Status</th><th class="px-3 py-2 text-right">Income</th><th class="px-3 py-2 text-right">Expenses</th><th class="px-3 py-2 text-right">Deposits</th><th class="px-3 py-2 text-right">Variance</th></tr></thead><tbody>${recRows || '<tr><td colspan="6" class="px-3 py-6 text-center text-slate-400">No reconciliations yet.</td></tr>'}</tbody></table></div></div>
      <div><div class="font-bold mb-1">Ledger — ${acctMonth()}</div>
        <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"><table class="w-full text-sm min-w-[620px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Date</th><th class="px-3 py-2">Account</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Source</th><th class="px-3 py-2 text-right">Amount</th></tr></thead><tbody>${entRows || '<tr><td colspan="5" class="px-3 py-6 text-center text-slate-400">No entries this month.</td></tr>'}</tbody></table></div></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
function acctExportCsv() {
  const rows = window.__acctEntries || [];
  const acctName = (id) => (__acctState.accounts.find(a => a.id === id) || {}).name || '';
  const lines = [['Date', 'Account', 'Description', 'Source', 'Direction', 'Amount']].concat(rows.map(e => [e.entry_date, acctName(e.account_id), (e.description || '').replace(/"/g, '""'), e.source, e.direction, e.amount]));
  const csv = lines.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `ledger-${acctMonth()}.csv`; a.click();
}
window.acctLoadBank = acctLoadBank; window.acctLoadReportsDetail = acctLoadReportsDetail; window.acctExportCsv = acctExportCsv;
window.acctLoadInsights = acctLoadInsights; window.acctLoadExpenses = acctLoadExpenses;

// Tax — sales tax collected (auto from delivered deals) vs tax paid / ITCs, and the
// net owing for the period. Record ITCs / remittances here.
async function acctLoadTax() {
  const body = document.getElementById('acct-body'); if (!body) return;
  try {
    const d = await apiGetJson(`/accounting/tax?month=${acctMonth()}`);
    const rows = (d.lines || []).map(l => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
      <td class="px-3 py-2">${l.date}</td><td class="px-3 py-2 text-slate-500">${esc(l.description || '')}</td>
      <td class="px-3 py-2"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${l.kind === 'collected' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300'}">${l.kind === 'collected' ? 'Collected' : 'Paid / ITC'}</span></td>
      <td class="px-3 py-2 text-right font-bold">${commMoney(l.amount)}</td></tr>`).join('');
    body.innerHTML = `
      <div class="flex items-center gap-2 mb-3"><input type="month" value="${acctMonth()}" onchange="__acctState.date=this.value+'-01'; acctLoadTax()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">
        <span class="text-sm text-slate-500">${esc(d.label || 'Sales tax')}${d.tax_number ? ` · #${esc(d.tax_number)}` : ''} · remit ${esc(d.frequency || 'quarterly')}</span></div>
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Collected (from deals)</div><div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${commMoney(d.collected)}</div></div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Paid / ITCs</div><div class="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">${commMoney(d.paid)}</div></div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] uppercase font-bold tracking-wider text-slate-400">Net owing</div><div class="text-2xl font-black mt-1 ${d.net_owing > 0 ? 'text-rose-500' : 'text-slate-900 dark:text-white'}">${commMoney(d.net_owing)}</div></div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4">
        <div class="text-sm font-bold mb-2">Record tax paid / an input-tax-credit</div>
        <div class="grid sm:grid-cols-4 gap-2 items-end">
          <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Date</label><input id="tax-date" type="date" value="${acctToday()}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
          <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Amount ($)</label><input id="tax-amount" type="number" step="0.01" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
          <div class="sm:col-span-1"><label class="block text-[11px] font-semibold text-slate-500 mb-1">Description</label><input id="tax-desc" type="text" placeholder="ITC / remittance" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"></div>
          <div><button onclick="acctAddTaxPaid(this)" class="w-full text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg">Add</button></div>
        </div></div>
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[560px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800"><th class="px-3 py-2">Date</th><th class="px-3 py-2">Description</th><th class="px-3 py-2">Type</th><th class="px-3 py-2 text-right">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="px-3 py-6 text-center text-slate-400">No tax activity this month yet — it fills in as deals are delivered.</td></tr>'}</tbody></table></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load tax.')}</div>`; }
}
async function acctAddTaxPaid(btn) {
  const amount = parseFloat(document.getElementById('tax-amount')?.value || '0');
  if (!amount) { showToast('Enter an amount', 'error'); return; }
  btn.disabled = true;
  try { await apiSendJson('/accounting/tax/paid', 'POST', { amount, description: document.getElementById('tax-desc')?.value || '', entry_date: document.getElementById('tax-date')?.value || acctToday() }); showToast('Recorded', 'success'); acctLoadTax(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not save', 'error'); }
}
window.acctLoadTax = acctLoadTax; window.acctAddTaxPaid = acctAddTaxPaid;

async function acctLoadSettings() {
  const body = document.getElementById('acct-body'); if (!body) return;
  try {
    const { settings: s } = await apiGetJson('/accounting/settings');
    body.innerHTML = `<div class="space-y-6">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 max-w-2xl">
      <div class="text-sm font-black uppercase tracking-wider text-slate-400">Reconciliation alerts</div>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Accounting team emails (comma-separated)</label>
        <input id="acct-s-acc" type="text" value="${esc((s.accounting_emails || []).join(', '))}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">GM / owner emails (comma-separated)</label>
        <input id="acct-s-gm" type="text" value="${esc((s.gm_emails || []).join(', '))}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <p class="text-[11px] text-slate-400">These addresses get an email whenever a day doesn't reconcile.</p>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Variance tolerance ($)</label>
        <input id="acct-s-tol" type="number" step="1" value="${s.tolerance}" class="w-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <label class="flex items-center gap-2 text-sm font-semibold"><input id="acct-s-autopost" type="checkbox" ${s.auto_post ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Auto-post delivered deals &amp; deposits to the ledger</label>
      <label class="flex items-center gap-2 text-sm font-semibold"><input id="acct-s-enabled" type="checkbox" ${s.enabled ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Run the daily reconciliation</label>
      <div class="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 text-sm font-black uppercase tracking-wider text-slate-400">Tax</div>
      <div class="grid sm:grid-cols-3 gap-3">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Tax label</label><input id="acct-s-taxlabel" type="text" value="${esc(s.tax_label || 'Sales tax')}" placeholder="HST / GST / Sales tax" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Tax / registration #</label><input id="acct-s-taxnum" type="text" value="${esc(s.tax_number || '')}" placeholder="GST/HST #" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Remittance</label><select id="acct-s-taxfreq" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${['monthly', 'quarterly', 'annual'].map(f => `<option value="${f}" ${(s.tax_frequency || 'quarterly') === f ? 'selected' : ''}>${f[0].toUpperCase() + f.slice(1)}</option>`).join('')}</select></div>
      </div>
      <p class="text-[11px] text-slate-400">Tax on delivered deals auto-posts to Sales Tax Collected; record ITCs/remittances on the Tax tab.</p>
      <div class="pt-1"><button onclick="acctSaveSettings(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg">Save</button></div>
      </div>
      <div><div class="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">Chart of accounts</div><div id="acct-accounts-box"><div class="text-sm text-slate-400">Loading…</div></div></div>
      <div><div class="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">Commission structure</div><div id="acct-comm-box"><div class="text-sm text-slate-400">Loading…</div></div></div>
    </div>`;
    acctLoadAccounts('acct-accounts-box');
    __commPlansTarget = 'acct-comm-box';
    commLoadPlans();
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
async function acctSaveSettings(btn) {
  const payload = {
    accounting_emails: document.getElementById('acct-s-acc')?.value || '',
    gm_emails: document.getElementById('acct-s-gm')?.value || '',
    tolerance: parseFloat(document.getElementById('acct-s-tol')?.value || '25'),
    auto_post: document.getElementById('acct-s-autopost')?.checked,
    enabled: document.getElementById('acct-s-enabled')?.checked,
    tax_label: document.getElementById('acct-s-taxlabel')?.value || 'Sales tax',
    tax_number: document.getElementById('acct-s-taxnum')?.value || '',
    tax_frequency: document.getElementById('acct-s-taxfreq')?.value || 'quarterly',
  };
  btn.disabled = true;
  try { await apiSendJson('/accounting/settings', 'PUT', payload); showToast('Saved', 'success'); btn.disabled = false; }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not save', 'error'); }
}
window.acctSaveSettings = acctSaveSettings;

// ── Commissions page ─────────────────────────────────────────────────────────
// Reps see their own earnings (status, clawback reasons, bonuses); managers get a
// team rollup and the plan builder. All figures come from the commission engine.
let __commState = { tab: null, month: null };
const commIsMgr = () => ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'].includes(String(profileContext?.role||'').toUpperCase());
function commMoney(v) { const n = Number(v) || 0; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function commMonth() { return __commState.month || new Date().toISOString().slice(0, 7); }
function commStatusPill(s) {
  const map = { pending: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Pending'],
    earned: ['bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', 'Earned'],
    paid: ['bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', 'Paid'],
    clawed_back: ['bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300', 'Clawed back'] };
  const [c, l] = map[s] || ['bg-slate-100 dark:bg-slate-800 text-slate-600', s];
  return `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${c}">${l}</span>`;
}
function loadCommissionsPage(rootEl) {
  if (!__commState.tab) __commState.tab = commIsMgr() ? 'ai-importer' : 'mine';
  if (!commIsMgr() && !['mine', 'statements'].includes(__commState.tab)) __commState.tab = 'mine';
  // Prefer an explicit mount (Accounting → Commissions). The global #commissions-root
  // lives on the standalone commissions page and would steal getElementById.
  const root = rootEl
    || document.getElementById('accounting-commissions-root')
    || document.querySelector('[data-engine-body="accounting-overview"] #commissions-root')
    || document.getElementById('commissions-root');
  if (!root) return;
  const tab = (id, label) => `<button onclick="commSetTab('${id}')" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${__commState.tab === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>`;
  root.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Commissions &amp; Pay Engine</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${commIsMgr() ? 'AI Document Commission Generator, multi-engine sync, team payouts, and pay period ledgers.' : 'Your earnings this period — pending, earned, paid, and statements.'}</p>
      </div>
      <input type="month" value="${commMonth()}" onchange="commSetMonth(this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
    </div>
    <div class="flex flex-wrap gap-2 pt-1 pb-1">
      ${commIsMgr() ? tab('ai-importer', ' AI Document Generator &amp; Engine Sync') : ''}
      ${tab('mine', 'My commission')}
      ${tab('statements', 'My statements')}
      ${commIsMgr() ? tab('team', 'Team') : ''}
      ${commIsMgr() ? tab('plans', 'Commission plans') : ''}
      ${commIsMgr() ? tab('bonuses', 'Bonus plans') : ''}
      ${commIsMgr() ? tab('periods', 'Pay periods') : ''}
      ${commIsMgr() ? tab('exceptions', 'Exceptions') : ''}
    </div>
    <div id="comm-body" class="pt-2"><div class="text-sm text-slate-400">Loading…</div></div>`;
  __commPlansTarget = 'comm-body';
  if (__commState.tab === 'ai-importer') commLoadAIImporter();
  else if (__commState.tab === 'mine') commLoadMine();
  else if (__commState.tab === 'statements') commLoadStatements();
  else if (__commState.tab === 'plans') commLoadPlans('commission');
  else if (__commState.tab === 'bonuses') commLoadPlans('bonus');
  else if (__commState.tab === 'periods') commLoadPeriods();
  else if (__commState.tab === 'exceptions') commLoadExceptions();
  else commLoadTeam();
}
function commSetTab(t) { __commState.tab = t; loadCommissionsPage(); }
function commSetMonth(m) { __commState.month = m; loadCommissionsPage(); }
window.loadCommissionsPage = loadCommissionsPage; window.commSetTab = commSetTab; window.commSetMonth = commSetMonth;

// ── Group 7: Pay periods · Statements · Exceptions ───────────────────────────
const commMoney2 = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function commPeriodBadge(s) {
  const m = { open: ['bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', 'Open'],
    locked: ['bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', 'Locked'],
    paid: ['bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300', 'Paid'] };
  const [c, l] = m[s] || ['bg-slate-100 dark:bg-slate-800 text-slate-600', s];
  return `<span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${c}">${l}</span>`;
}
const commBtn = (label, onclick, kind) => {
  const styles = { primary: 'bg-indigo-600 text-white hover:bg-indigo-500', ghost: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700', danger: 'bg-rose-600 text-white hover:bg-rose-500', ok: 'bg-emerald-600 text-white hover:bg-emerald-500' };
  return `<button onclick="${onclick}" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${styles[kind] || styles.ghost}">${label}</button>`;
};

// Authenticated CSV download (a plain <a> can't send the Bearer token → 401).
async function commDownloadCsv(path, filename) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'export.csv';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (e) { showToast(e.message || 'Export failed', 'error'); }
}
window.commDownloadCsv = commDownloadCsv;

// ── Pay periods (managers) ──
async function commLoadPeriods() {
  const body = document.getElementById('comm-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading pay periods…</div>';
  let data; try { data = await apiGetJson('/commissions/pay-periods'); } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; return; }
  const periods = data.periods || [];
  const types = data.period_types || ['weekly', 'biweekly', 'semi_monthly', 'monthly', 'custom'];
  const typeOpts = types.map(t => `<option value="${t}">${t.replace('_', '-')}</option>`).join('');
  const cards = periods.length ? periods.map(p => {
    const acts = [];
    if (p.status === 'open') { acts.push(commBtn('Assign earned', `commPeriodAssign('${p.id}')`, 'ghost')); acts.push(commBtn('Lock', `commPeriodStatus('${p.id}','locked')`, 'primary')); }
    if (p.status === 'locked' && !p.reviewed_at) acts.push(commBtn('Review', `commPeriodReview('${p.id}')`, 'primary'));
    if (p.status === 'locked' && p.reviewed_at && !p.approved_at) acts.push(commBtn('Approve', `commPeriodApprove('${p.id}')`, 'primary'));
    if (p.status === 'locked' && p.approved_at) acts.push(commBtn('Mark paid', `commPeriodStatus('${p.id}','paid')`, 'ok'));
    if (p.status === 'locked') acts.push(commBtn('Unlock', `commPeriodStatus('${p.id}','open')`, 'ghost'));
    acts.push(commBtn('Payroll CSV', `commDownloadCsv('/commissions/pay-periods/${p.id}/export.csv','payroll-${esc(p.name)}.csv')`, 'ghost'));
    const gate = `${p.reviewed_at ? ' reviewed' : ''}${p.approved_at ? ' ·  approved' : ''}`;
    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div><span class="font-bold text-slate-900 dark:text-white">${esc(p.name)}</span> ${commPeriodBadge(p.status)}
          <div class="text-xs text-slate-400">${p.start_date} → ${p.end_date} · ${p.lines || 0} lines · ${commMoney2(p.total)} ${gate ? '· ' + gate : ''}</div></div>
        <div class="flex flex-wrap gap-1.5">${acts.join('')}</div>
      </div></div>`;
  }).join('') : '<div class="text-sm text-slate-400 py-6 text-center">No pay periods yet — create one to group and pay commissions.</div>';
  body.innerHTML = `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 mb-3 flex flex-wrap items-end gap-2">
      <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type</label>
        <select id="pp-type" onchange="document.getElementById('pp-custom').style.display=this.value==='custom'?'flex':'none'" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm">${typeOpts}</select></div>
      <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Anchor date</label>
        <input id="pp-anchor" type="date" value="${new Date().toISOString().slice(0,10)}" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      <div id="pp-custom" style="display:none" class="gap-2 items-end">
        <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Start</label><input id="pp-start" type="date" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
        <div><label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">End</label><input id="pp-end" type="date" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm"></div>
      </div>
      ${commBtn('Create period', 'commCreatePeriod()', 'primary')}
    </div>
    <div class="space-y-2">${cards}</div>`;
}
async function commCreatePeriod() {
  const type = document.getElementById('pp-type')?.value || 'monthly';
  const b = { period_type: type };
  if (type === 'custom') { b.start_date = document.getElementById('pp-start')?.value; b.end_date = document.getElementById('pp-end')?.value; }
  else b.anchor_date = document.getElementById('pp-anchor')?.value;
  try { await apiSendJson('/commissions/pay-periods', 'POST', b); showToast('Pay period created', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message || 'Could not create period', 'error'); }
}
async function commPeriodAssign(id) {
  try { const r = await apiSendJson(`/commissions/pay-periods/${id}/assign`, 'POST', {}); showToast(`Assigned ${r.assigned} earned line(s)`, 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodStatus(id, status) {
  if (status === 'paid' && !confirm('Mark this period paid? This books the pay run and locks the lines as paid.')) return;
  try { await apiSendJson(`/commissions/pay-periods/${id}/status`, 'POST', { status }); showToast(`Period ${status}`, 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodReview(id) {
  try { await apiSendJson(`/commissions/pay-periods/${id}/review`, 'POST', {}); showToast('Period reviewed', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commPeriodApprove(id) {
  try { await apiSendJson(`/commissions/pay-periods/${id}/approve`, 'POST', {}); showToast('Period approved', 'success'); commLoadPeriods(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.commLoadPeriods = commLoadPeriods; window.commCreatePeriod = commCreatePeriod; window.commPeriodAssign = commPeriodAssign;
window.commPeriodStatus = commPeriodStatus; window.commPeriodReview = commPeriodReview; window.commPeriodApprove = commPeriodApprove;

// ── Exceptions (managers) ──
async function commLoadExceptions() {
  const body = document.getElementById('comm-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading exceptions…</div>';
  let data; try { data = await apiGetJson('/commissions/exceptions'); } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; return; }
  const list = data.exceptions || [];
  const rows = list.length ? list.map(x => {
    const sev = x.severity === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400';
    const acts = x.status === 'open'
      ? commBtn('Acknowledge', `commExceptionStatus('${x.id}','acknowledged')`, 'ghost') + ' ' + commBtn('Resolve', `commExceptionStatus('${x.id}','resolved')`, 'ok')
      : commBtn('Resolve', `commExceptionStatus('${x.id}','resolved')`, 'ok');
    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2 flex-wrap">
      <div><span class="font-bold ${sev}">${esc(x.type.replace(/_/g,' '))}</span> <span class="text-[10px] uppercase tracking-wider text-slate-400">${esc(x.status)}</span>
        <div class="text-xs text-slate-500 dark:text-slate-400">${esc(x.detail || '')}</div></div>
      <div class="flex gap-1.5">${acts}</div></div>`;
  }).join('') : '<div class="text-sm text-slate-400 py-6 text-center">No open exceptions. </div>';
  body.innerHTML = `
    <div class="flex justify-end mb-3">${commBtn('Scan now', 'commScanExceptions()', 'primary')}</div>
    <div class="space-y-2">${rows}</div>`;
}
async function commScanExceptions() {
  try { const r = await apiSendJson('/commissions/exceptions/scan', 'POST', {}); showToast(`Scan complete — ${r.found} found, ${r.auto_resolved} auto-resolved`, 'success'); commLoadExceptions(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commExceptionStatus(id, status) {
  try { await apiSendJson(`/commissions/exceptions/${id}/status`, 'POST', { status }); commLoadExceptions(); }
  catch (e) { showToast(e.message, 'error'); }
}
window.commLoadExceptions = commLoadExceptions; window.commScanExceptions = commScanExceptions; window.commExceptionStatus = commExceptionStatus;

// ── Statements (reps: own; managers see their own here too) ──
async function commLoadStatements() {
  const body = document.getElementById('comm-body'); if (!body) return;
  body.innerHTML = '<div class="text-sm text-slate-400">Loading statements…</div>';
  let data; try { data = await apiGetJson('/commissions/statements/mine'); } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; return; }
  const st = data.statements || [];
  const rows = st.length ? st.map(s => {
    const p = s.period, ack = s.acknowledgment;
    const badge = ack ? (ack.status === 'disputed' ? '<span class="text-[10px] font-bold text-rose-600">Disputed</span>' : '<span class="text-[10px] font-bold text-emerald-600">Acknowledged</span>') : '<span class="text-[10px] text-slate-400">Not signed</span>';
    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2 flex-wrap">
      <div><span class="font-bold text-slate-900 dark:text-white">${esc(p.name)}</span> ${commPeriodBadge(p.status)} ${badge}
        <div class="text-xs text-slate-400">${p.start_date} → ${p.end_date}</div></div>
      <div class="flex gap-1.5">${commBtn('View', `commViewStatement('${p.id}')`, 'primary')}</div></div>`;
  }).join('') : '<div class="text-sm text-slate-400 py-6 text-center">No statements yet — they appear once your commissions are assigned to a pay period.</div>';
  body.innerHTML = `<div class="space-y-2">${rows}</div><div id="comm-stmt-detail" class="mt-4"></div>`;
}
async function commViewStatement(periodId) {
  const box = document.getElementById('comm-stmt-detail'); if (box) box.innerHTML = '<div class="text-sm text-slate-400">Loading…</div>';
  let d; try { d = await apiGetJson(`/commissions/statements/mine?period_id=${encodeURIComponent(periodId)}`); } catch (e) { if (box) box.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; return; }
  __commStmt = d;   // stash for print
  const t = d.totals, ack = d.acknowledgment;
  const lines = (d.lines || []).map(l => `<tr class="border-t border-slate-100 dark:border-slate-800">
    <td class="py-1.5 pr-3">${esc(l.deal_number || '—')}</td><td class="py-1.5 pr-3">${esc(l.customer || '—')}</td>
    <td class="py-1.5 pr-3 text-right">${commMoney2(l.front)}</td><td class="py-1.5 pr-3 text-right">${commMoney2(l.back)}</td>
    <td class="py-1.5 pr-3 text-right">${commMoney2(l.spiff)}</td><td class="py-1.5 pr-3 text-right font-bold">${commMoney2(l.total)}</td>
    <td class="py-1.5">${commStatusBadge(l.status)}</td></tr>`).join('');
  const signed = ack ? `<span class="text-xs ${ack.status === 'disputed' ? 'text-rose-600' : 'text-emerald-600'} font-bold">${ack.status === 'disputed' ? 'You disputed this statement' : 'You acknowledged this statement'}</span>` : '';
  if (box) box.innerHTML = `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 class="font-black text-slate-900 dark:text-white">${esc(d.period.name)} — Statement</h3>
        <div class="flex flex-wrap gap-1.5">
          ${commBtn('Print / PDF', `commPrintStatement()`, 'ghost')}
          ${commBtn('CSV', `commDownloadCsv('/commissions/statements/mine.csv?period_id=${periodId}','statement-${esc(d.period.name)}.csv')`, 'ghost')}
          ${ack ? '' : commBtn('Acknowledge', `commAckStatement('${periodId}')`, 'ok')}
          ${ack ? '' : commBtn('Dispute', `commDisputeStatement('${periodId}')`, 'danger')}
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div class="rounded-lg bg-slate-50 dark:bg-slate-950 p-2.5"><div class="text-[10px] uppercase tracking-wider text-slate-400">Units</div><div class="font-black text-slate-900 dark:text-white">${t.units}</div></div>
        <div class="rounded-lg bg-slate-50 dark:bg-slate-950 p-2.5"><div class="text-[10px] uppercase tracking-wider text-slate-400">Front</div><div class="font-black text-slate-900 dark:text-white">${commMoney2(t.front)}</div></div>
        <div class="rounded-lg bg-slate-50 dark:bg-slate-950 p-2.5"><div class="text-[10px] uppercase tracking-wider text-slate-400">F&I + Spiff</div><div class="font-black text-slate-900 dark:text-white">${commMoney2(t.back + t.spiff)}</div></div>
        <div class="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 p-2.5"><div class="text-[10px] uppercase tracking-wider text-indigo-500">Payable</div><div class="font-black text-indigo-700 dark:text-indigo-300">${commMoney2(t.payable)}</div></div>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-left text-slate-400"><th class="pb-1 pr-3">Deal</th><th class="pb-1 pr-3">Customer</th><th class="pb-1 pr-3 text-right">Front</th><th class="pb-1 pr-3 text-right">F&I</th><th class="pb-1 pr-3 text-right">Spiff</th><th class="pb-1 pr-3 text-right">Total</th><th class="pb-1">Status</th></tr></thead><tbody>${lines || '<tr><td colspan="7" class="py-3 text-center text-slate-400">No lines in this period.</td></tr>'}</tbody></table></div>
      <div class="mt-2">${signed}</div>
    </div>`;
}
let __commStmt = null;
function commPrintStatement() {
  const d = __commStmt; if (!d) return;
  const rows = (d.lines || []).map(l => `<tr><td>${esc(l.deal_number || '—')}</td><td>${esc(l.customer || '—')}</td><td style="text-align:right">${commMoney2(l.front)}</td><td style="text-align:right">${commMoney2(l.back)}</td><td style="text-align:right">${commMoney2(l.spiff)}</td><td style="text-align:right">${commMoney2(l.total)}</td><td>${esc(l.status)}</td></tr>`).join('');
  const w = window.open('', '_blank'); if (!w) { showToast('Allow pop-ups to print', 'error'); return; }
  w.document.write(`<!doctype html><html><head><title>Statement — ${esc(d.period.name)}</title>
    <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:32px;color:#0f172a}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}.tot{margin-top:16px;font-weight:800}</style></head>
    <body><h1>Commission Statement — ${esc(d.period.name)}</h1><div>${d.period.start_date} → ${d.period.end_date}</div>
    <table><thead><tr><th>Deal</th><th>Customer</th><th style="text-align:right">Front</th><th style="text-align:right">F&I</th><th style="text-align:right">Spiff</th><th style="text-align:right">Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="tot">Payable: ${commMoney2(d.totals.payable)} · Units: ${d.totals.units}</div>
    </body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
async function commAckStatement(periodId) {
  try { await apiSendJson(`/commissions/statements/${periodId}/acknowledge`, 'POST', {}); showToast('Statement acknowledged', 'success'); commViewStatement(periodId); }
  catch (e) { showToast(e.message, 'error'); }
}
async function commDisputeStatement(periodId) {
  const note = prompt('What’s wrong with this statement? (a manager will review)'); if (note == null) return;
  try { await apiSendJson(`/commissions/statements/${periodId}/dispute`, 'POST', { note }); showToast('Dispute submitted', 'success'); commViewStatement(periodId); }
  catch (e) { showToast(e.message, 'error'); }
}
window.commLoadStatements = commLoadStatements; window.commViewStatement = commViewStatement; window.commPrintStatement = commPrintStatement;
window.commAckStatement = commAckStatement; window.commDisputeStatement = commDisputeStatement;

function commStatCards(s) {
  const card = (label, val, cls) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">${label}</div><div class="text-2xl font-black mt-1 ${cls || 'text-slate-900 dark:text-white'}">${commMoney(val)}</div></div>`;
  return `<div class="grid grid-cols-2 md:grid-cols-6 gap-3">
    ${card('Pending', s.pending)}
    ${card('Earned', s.earned, 'text-blue-600 dark:text-blue-400')}
    ${card('Paid', s.paid, 'text-emerald-600 dark:text-emerald-400')}
    ${card('Volume bonus', s.volume_bonus, 'text-indigo-600 dark:text-indigo-400')}
    ${card('Clawed back', s.clawed_back, 'text-rose-600 dark:text-rose-400')}
    ${card('Take-home', s.total, 'text-slate-900 dark:text-white')}
  </div>`;
}
function commDealsTable(s, mgr) {
  if (!s.deals.length) return '<div class="text-sm text-slate-400 py-6 text-center">No deals this month yet.</div>';
  return `<div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
    <table class="w-full text-sm min-w-[720px]">
      <thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
        <th class="px-3 py-2">Deal</th><th class="px-3 py-2">Customer</th><th class="px-3 py-2 text-right">Front</th><th class="px-3 py-2 text-right">Back (F&amp;I)</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2">Status</th>${mgr ? '<th class="px-3 py-2"></th>' : ''}</tr></thead>
      <tbody>${s.deals.map(d => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
        <td class="px-3 py-2 font-mono text-xs">#${d.deal_number || '—'}${d.role && d.role !== 'salesperson' ? `<span class="ml-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${d.role === 'fni_manager' ? 'F&I' : 'Split'}</span>` : ''}</td>
        <td class="px-3 py-2">${esc(d.customer || '—')}</td>
        <td class="px-3 py-2 text-right">${commMoney(d.front)}</td>
        <td class="px-3 py-2 text-right">${commMoney(d.back)}</td>
        <td class="px-3 py-2 text-right font-bold">${commMoney(d.total)}</td>
        <td class="px-3 py-2">${commStatusPill(d.status)}${d.reason ? `<div class="text-[10px] text-rose-500 mt-0.5">${esc(d.reason)}</div>` : ''}</td>
        ${mgr ? `<td class="px-3 py-2 text-right whitespace-nowrap">${d.status === 'pending' ? `<button onclick="commMarkFunded('${d.deal_id}')" class="text-[11px] font-bold text-blue-600 hover:text-blue-500">Mark funded</button>` : ''}${d.status !== 'clawed_back' ? ` <button onclick="commClawback('${d.deal_id}')" class="text-[11px] font-bold text-rose-500 hover:text-rose-400 ml-2">Claw back</button>` : ''}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table></div>`;
}
function commAdjList(s) {
  if (!s.adjustments || !s.adjustments.length) return '';
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Bonuses &amp; adjustments</div>
    ${s.adjustments.map(a => `<div class="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <div><span class="font-semibold capitalize">${esc(a.type)}</span>${a.reason ? ` — <span class="text-slate-500 dark:text-slate-400">${esc(a.reason)}</span>` : ''}</div>
      <div class="font-bold ${a.amount < 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}">${commMoney(a.amount)}</div>
    </div>`).join('')}
  </div>`;
}
async function commLoadMine() {
  const body = document.getElementById('comm-body'); if (!body) return;
  try {
    const s = await apiGetJson(`/commissions/mine?month=${commMonth()}`);
    body.innerHTML = `${commStatCards(s)}<div class="mt-4 space-y-4">${commDealsTable(s, false)}${commAdjList(s)}</div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load your commission.')}</div>`; }
}
async function commLoadTeam() {
  const body = document.getElementById('comm-body'); if (!body) return;
  try {
    const d = await apiGetJson(`/commissions/team?month=${commMonth()}`);
    const t = d.totals || {};
    const totals = `<div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Units</div><div class="text-2xl font-black mt-1">${t.units || 0}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending</div><div class="text-2xl font-black mt-1">${commMoney(t.pending)}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Earned</div><div class="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">${commMoney(t.earned)}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Paid</div><div class="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">${commMoney(t.paid)}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bonuses</div><div class="text-2xl font-black mt-1 text-indigo-600 dark:text-indigo-400">${commMoney(t.bonus)}</div></div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"><div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</div><div class="text-2xl font-black mt-1">${commMoney(t.total)}</div></div>
    </div>`;
    const rows = (d.reps || []).filter(r => r.units || r.total || r.pending).map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onclick="commViewRep('${r.rep_id}')">
      <td class="px-3 py-2 font-semibold">${esc(r.rep_name)}</td>
      <td class="px-3 py-2 text-right">${r.units}</td>
      <td class="px-3 py-2 text-right">${commMoney(r.pending)}</td>
      <td class="px-3 py-2 text-right text-blue-600 dark:text-blue-400">${commMoney(r.earned)}</td>
      <td class="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">${commMoney(r.paid)}</td>
      <td class="px-3 py-2 text-right text-indigo-600 dark:text-indigo-400">${commMoney(r.volume_bonus)}</td>
      <td class="px-3 py-2 text-right text-rose-500">${commMoney(r.clawed_back)}</td>
      <td class="px-3 py-2 text-right font-bold">${commMoney(r.total)}</td>
    </tr>`).join('');
    body.innerHTML = `${totals}
      <div class="flex justify-end mb-2"><button onclick="commMarkPaidMonth()" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg">Mark earned → paid (this month)</button></div>
      <div class="overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <table class="w-full text-sm min-w-[760px]"><thead><tr class="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <th class="px-3 py-2">Rep</th><th class="px-3 py-2 text-right">Units</th><th class="px-3 py-2 text-right">Pending</th><th class="px-3 py-2 text-right">Earned</th><th class="px-3 py-2 text-right">Paid</th><th class="px-3 py-2 text-right">Bonus</th><th class="px-3 py-2 text-right">Clawed</th><th class="px-3 py-2 text-right">Total</th>
        </tr></thead><tbody>${rows || '<tr><td colspan="8" class="px-3 py-6 text-center text-slate-400">No commission activity this month.</td></tr>'}</tbody></table>
      </div>
      <div id="comm-rep-detail" class="mt-4"></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load the team.')}</div>`; }
}
async function commViewRep(repId) {
  const box = document.getElementById('comm-rep-detail'); if (!box) return;
  box.innerHTML = '<div class="text-sm text-slate-400">Loading rep…</div>';
  try {
    const s = await apiGetJson(`/commissions/rep/${repId}?month=${commMonth()}`);
    box.innerHTML = `<div class="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div class="flex items-center justify-between mb-3"><h3 class="text-lg font-black text-slate-900 dark:text-white">${esc(s.rep_name)}</h3>
        <button onclick="commAddAdjustment('${repId}','${esc(s.rep_name)}')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg">+ Bonus / adjustment</button></div>
      ${commStatCards(s)}<div class="mt-4 space-y-4">${commDealsTable(s, true)}${commAdjList(s)}</div></div>`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) { box.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message)}</div>`; }
}
async function commMarkFunded(dealId) {
  try { await apiSendJson('/commissions/mark-funded', 'POST', { deal_id: dealId }); showToast('Marked funded — commission earned', 'success'); loadCommissionsPage(); }
  catch (e) { showToast(e.message || 'Could not mark funded', 'error'); }
}
async function commClawback(dealId) {
  const reason = prompt('Reason for the clawback (the rep will see this):', '');
  if (reason === null) return;
  try { await apiSendJson('/commissions/clawback', 'POST', { deal_id: dealId, reason }); showToast('Commission clawed back', 'success'); loadCommissionsPage(); }
  catch (e) { showToast(e.message || 'Could not claw back', 'error'); }
}
async function commMarkPaidMonth() {
  if (!confirm('Mark all EARNED commissions this month as paid? Do this after your payroll run.')) return;
  try { await apiSendJson('/commissions/mark-paid', 'POST', { month: commMonth() }); showToast('Marked paid', 'success'); loadCommissionsPage(); }
  catch (e) { showToast(e.message || 'Could not mark paid', 'error'); }
}
function commAddAdjustment(repId, repName) {
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="text-lg font-black text-slate-900 dark:text-white">Adjust — ${esc(repName)}</div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
      <select id="adj-type" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="bonus">Bonus</option><option value="spiff">Spiff</option><option value="adjustment">Adjustment</option><option value="clawback">Clawback (deduction)</option></select></div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Amount ($)</label><input id="adj-amount" type="number" step="1" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Reason (rep sees this)</label><input id="adj-reason" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    <div class="flex justify-end gap-2 pt-1"><button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="commSaveAdjustment('${repId}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button></div>
  </div>`, 'max-w-md');
}
async function commSaveAdjustment(repId, btn) {
  const type = document.getElementById('adj-type')?.value;
  const amount = parseFloat(document.getElementById('adj-amount')?.value || '0');
  const reason = document.getElementById('adj-reason')?.value || '';
  if (!amount) { showToast('Enter an amount', 'error'); return; }
  btn.disabled = true;
  try { await apiSendJson('/commissions/adjust', 'POST', { rep_id: repId, type, amount, reason }); showToast('Saved', 'success'); btn.closest('.fixed').remove(); commViewRep(repId); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not save', 'error'); }
}
window.commViewRep = commViewRep; window.commMarkFunded = commMarkFunded; window.commClawback = commClawback;
window.commMarkPaidMonth = commMarkPaidMonth; window.commAddAdjustment = commAddAdjustment; window.commSaveAdjustment = commSaveAdjustment;

// ── Plans tab ────────────────────────────────────────────────────────────────
let __commPlans = [], __commReps = [];
let __commPlansTarget = 'comm-body';   // where the plan builder renders (Commissions or Accounting → Settings)
async function commLoadPlans(kindFilter) {
  const body = document.getElementById(__commPlansTarget) || document.getElementById('comm-body'); if (!body) return;
  window.__commKindFilter = kindFilter || window.__commKindFilter || 'commission';
  kindFilter = window.__commKindFilter;
  try {
    const d = await apiGetJson('/commissions/plans');
    __commPlans = d.plans || [];
    __commReps = d.reps || [];
    if (!__commPlans.length) {
      __commPlans = [
        { id: 'pl_sales_comm', name: 'Sales commission', role: 'sales', kind: 'commission', is_default: true, active: true, config: { front: { method: 'percent', percent: 25 }, back: { method: 'percent', percent: 10 } } },
        { id: 'pl_sales_bonus', name: 'Sales volume bonus', role: 'sales', kind: 'bonus', active: true, config: { bonuses: [{ basis: 'units', threshold: 8, amount: 250 }] } },
        { id: 'pl_bdc_comm', name: 'BDC appointment commission', role: 'bdc', kind: 'commission', active: true, config: { front: { method: 'flat', flat: 25 } } },
        { id: 'pl_bdc_bonus', name: 'BDC show bonus', role: 'bdc', kind: 'bonus', active: true, config: { bonuses: [{ basis: 'units', threshold: 20, amount: 150 }] } },
        { id: 'pl_svc_comm', name: 'Technician flag hours', role: 'service', kind: 'commission', active: true, config: { front: { method: 'percent', percent: 40 } } },
        { id: 'pl_svc_bonus', name: 'Tech CSI bonus', role: 'service', kind: 'bonus', active: true, config: { bonuses: [{ basis: 'gross', threshold: 5000, amount: 200 }] } },
        { id: 'pl_adv_comm', name: 'Advisor RO commission', role: 'advisor', kind: 'commission', active: true, config: { front: { method: 'percent', percent: 8 } } },
        { id: 'pl_adv_bonus', name: 'Advisor multi-point bonus', role: 'advisor', kind: 'bonus', active: true, config: { bonuses: [{ basis: 'units', threshold: 30, amount: 175 }] } },
      ];
    }
    body.innerHTML = `
      <div class="grid lg:grid-cols-2 gap-6">
        <div>
          <div class="flex items-center justify-between mb-2"><h3 class="text-lg font-black text-slate-900 dark:text-white">${kindFilter === 'bonus' ? 'Bonus plans' : 'Commission plans'}</h3>
            <button onclick="commEditPlan(null,'${kindFilter}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">+ New ${kindFilter === 'bonus' ? 'bonus' : 'commission'} plan</button></div>
          <div class="flex flex-wrap gap-1.5 mb-2">${['sales','bdc','service','advisor'].map(r => `<button type="button" onclick="window.__commRoleFilter='${r}';commLoadPlans('${kindFilter}')" class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${(window.__commRoleFilter||'sales')===r?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-800'}">${r}</button>`).join('')}<button type="button" onclick="window.__commRoleFilter='';commLoadPlans('${kindFilter}')" class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${!window.__commRoleFilter?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-800'}">All</button></div>
          <div class="space-y-2">${(__commPlans.filter(p => (p.kind||p.config?.kind||'commission')===(kindFilter||'commission') && (!window.__commRoleFilter || (p.role||p.config?.role||'sales')===window.__commRoleFilter)).length ? __commPlans.filter(p => (p.kind||p.config?.kind||'commission')===(kindFilter||'commission') && (!window.__commRoleFilter || (p.role||p.config?.role||'sales')===window.__commRoleFilter)).map(commPlanCard).join('') : '<div class="text-sm text-slate-400">No plans in this lane yet.</div>')}</div>
        </div>
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white mb-2">Assign reps</h3>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
            ${__commReps.map(r => `<div class="flex items-center justify-between gap-2 px-3 py-2">
              <span class="text-sm font-semibold">${esc(r.display_name || r.full_name || 'Rep')}</span>
              <select onchange="commAssign('${r.id}', this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs">
                <option value="">Default plan</option>
                ${__commPlans.map(p => `<option value="${p.id}" ${r.commission_plan_id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select></div>`).join('') || '<div class="px-3 py-3 text-sm text-slate-400">No reps.</div>'}
          </div>
          <p class="text-[11px] text-slate-400 mt-2">Reps on “Default plan” use whichever plan is marked default.</p>
        </div>
      </div>
      <div id="comm-plan-editor" class="mt-6"></div>`;
  } catch (e) { body.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load plans.')}</div>`; }
}
function commPlanCard(p) {
  const f = p.config?.front || {}, b = p.config?.back || {};
  const packTxt = f.pack ? ` · ${f.pack_type === 'percent' ? (f.pack + '%') : ('$' + f.pack)} pack` : '';
  const desc = `${f.method === 'flat' ? commMoney(f.flat) + '/unit' : f.method === 'percent' ? (f.percent || 0) + '% gross' : `greater of ${f.percent || 0}% gross or ${commMoney(f.flat)}`}${packTxt} · F&I ${b.method === 'flat' ? commMoney(b.flat) : (b.percent || 0) + '%'}`;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
    <div class="min-w-0"><div class="font-bold text-slate-900 dark:text-white flex items-center gap-2">${esc(p.name)}<span class="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">${esc(p.role||p.config?.role||'sales')}</span><span class="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">${esc(p.kind||p.config?.kind||'commission')}</span>${p.is_default ? '<span class="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full">Default</span>' : ''}${p.active ? '' : '<span class="text-[10px] text-slate-400">(inactive)</span>'}</div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${desc}</div></div>
    <button onclick='commEditPlan(${JSON.stringify(p.id)})' class="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex-shrink-0">Edit</button>
  </div>`;
}
function commEditPlan(id, kindPref) {
  const p = id ? __commPlans.find(x => x.id === id) : null;
  const c = p?.config || {}; const f = c.front || {}; const b = c.back || {}; const bonuses = Array.isArray(c.bonuses) ? c.bonuses : [];
  const box = document.getElementById('comm-plan-editor'); if (!box) return;
  const inp = (id2, val, ph, type = 'number') => `<input id="${id2}" type="${type}" value="${val != null ? esc(val) : ''}" placeholder="${ph || ''}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  box.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
    <div class="flex items-center justify-between"><h3 class="text-lg font-black text-slate-900 dark:text-white">${id ? 'Edit plan' : 'New plan'}</h3>
      ${id ? `<button onclick="commDeletePlan('${id}')" class="text-xs font-bold text-rose-500 hover:text-rose-400">Delete</button>` : ''}</div>
    <div class="grid sm:grid-cols-2 gap-3">
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Plan name</label>${inp('pl-name', p?.name, 'e.g. Standard sales', 'text')}</div>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Role</label>
        <select id="pl-role" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
          ${['sales','bdc','service','advisor'].map(r => `<option value="${r}" ${(p?.role||c.role||window.__commRoleFilter||'sales')===r?'selected':''}>${r === 'bdc' ? 'BDC' : r === 'advisor' ? 'Service advisor' : r[0].toUpperCase()+r.slice(1)}</option>`).join('')}
        </select></div>
      <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
        <select id="pl-kind" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="commission" ${(p?.kind||c.kind||kindPref||'commission')==='commission'?'selected':''}>Commission</option>
          <option value="bonus" ${(p?.kind||c.kind||kindPref||'commission')==='bonus'?'selected':''}>Bonus</option>
        </select></div>
      <div class="flex items-end gap-4">
        <label class="inline-flex items-center gap-2 text-sm font-semibold"><input id="pl-default" type="checkbox" ${p?.is_default ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Default plan</label>
        <label class="inline-flex items-center gap-2 text-sm font-semibold"><input id="pl-active" type="checkbox" ${p ? (p.active ? 'checked' : '') : 'checked'} class="accent-indigo-600 w-4 h-4">Active</label>
      </div>
    </div>
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Front-end (vehicle)</div>
      <div class="grid sm:grid-cols-4 gap-3">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Method</label>
          <select id="pl-fmethod" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="greater" ${(f.method || 'greater') === 'greater' ? 'selected' : ''}>Greater of % or flat</option>
            <option value="percent" ${f.method === 'percent' ? 'selected' : ''}>% of gross</option>
            <option value="flat" ${f.method === 'flat' ? 'selected' : ''}>Flat per unit</option>
          </select></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">% of gross</label>${inp('pl-fpercent', f.percent, '25')}</div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Flat / mini ($)</label>${inp('pl-fflat', f.flat, '250')}</div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Pack</label>
          <div class="flex gap-1.5">
            ${inp('pl-fpack', f.pack, '500')}
            <select id="pl-fpacktype" class="w-16 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm">
              <option value="flat" ${(f.pack_type || 'flat') === 'flat' ? 'selected' : ''}>$</option>
              <option value="percent" ${f.pack_type === 'percent' ? 'selected' : ''}>%</option>
            </select>
          </div></div>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">Gross = selling price − vehicle cost − pack (a flat $ or a % of selling price). Cost stays internal; never shown to customers.</p>
    </div>
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Back-end (F&amp;I)</div>
      <div class="grid sm:grid-cols-3 gap-3">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Method</label>
          <select id="pl-bmethod" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="percent" ${(b.method || 'percent') === 'percent' ? 'selected' : ''}>% of F&amp;I</option>
            <option value="flat" ${b.method === 'flat' ? 'selected' : ''}>Flat per deal</option>
          </select></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">% of F&amp;I</label>${inp('pl-bpercent', b.percent, '5')}</div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Flat ($)</label>${inp('pl-bflat', b.flat, '0')}</div>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 mt-3">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">F&amp;I commission goes to</label>
          <select id="pl-backto" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="salesperson" ${(c.back_to || 'salesperson') === 'salesperson' ? 'selected' : ''}>Salesperson</option>
            <option value="fni_manager" ${c.back_to === 'fni_manager' ? 'selected' : ''}>F&amp;I manager</option>
            <option value="split" ${c.back_to === 'split' ? 'selected' : ''}>Split (F&amp;I manager + salesperson)</option>
          </select></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">F&amp;I manager share % (if split)</label>${inp('pl-backfnipct', c.back_fni_pct, '100')}</div>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">When paid to the F&amp;I manager, their own plan's F&amp;I rate is used if they have one. Pick the F&amp;I manager on the deal desk.</p>
    </div>
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">What a split deal divides</div>
      <div class="flex flex-wrap gap-4">
        <label class="inline-flex items-center gap-2 text-sm font-semibold"><input id="pl-split-front" type="checkbox" ${(c.split_covers?.front !== false) ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Front-end</label>
        <label class="inline-flex items-center gap-2 text-sm font-semibold"><input id="pl-split-back" type="checkbox" ${(c.split_covers?.back !== false) ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">F&amp;I / back-end</label>
        <label class="inline-flex items-center gap-2 text-sm font-semibold"><input id="pl-split-spiff" type="checkbox" ${(c.split_covers?.spiff !== false) ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Per-deal bonus / spiff</label>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">The co-rep's split % applies to the ticked pieces. <b>Volume bonuses are never split</b> — each rep earns their own from their own units/gross.</p>
    </div>
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
      <div class="grid sm:grid-cols-2 gap-3">
        <div><label class="block text-[11px] font-semibold text-slate-500 mb-1">Spiff per deal ($)</label>${inp('pl-spiff', c.spiff_per_deal, '0')}</div>
      </div>
      <div class="mt-3">
        <div class="flex items-center justify-between mb-1"><div class="text-xs font-black uppercase tracking-wider text-slate-400">Volume bonuses (monthly)</div>
          <button onclick="commAddBonusRow()" class="text-[11px] font-bold text-indigo-600">+ Add tier</button></div>
        <div id="pl-bonuses" class="space-y-2">${bonuses.map(commBonusRow).join('')}</div>
      </div>
    </div>
    <div class="flex justify-end gap-2 pt-2"><button onclick="commLoadPlans()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="commSavePlan(${id ? `'${id}'` : 'null'}, this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg">Save plan</button></div>
  </div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function commBonusRow(bn) {
  bn = bn || {};
  return `<div class="flex items-center gap-2 comm-bonus-row">
    <select class="cb-basis bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm"><option value="units" ${bn.basis !== 'gross' ? 'selected' : ''}>Units ≥</option><option value="gross" ${bn.basis === 'gross' ? 'selected' : ''}>Gross ≥ $</option></select>
    <input type="number" class="cb-threshold w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm" placeholder="10" value="${bn.threshold != null ? esc(bn.threshold) : ''}">
    <span class="text-sm text-slate-400">→ pay $</span>
    <input type="number" class="cb-amount w-28 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm" placeholder="500" value="${bn.amount != null ? esc(bn.amount) : ''}">
    <button onclick="this.closest('.comm-bonus-row').remove()" class="text-rose-400 hover:text-rose-500 text-sm"></button>
  </div>`;
}
function commAddBonusRow() { const w = document.getElementById('pl-bonuses'); if (w) w.insertAdjacentHTML('beforeend', commBonusRow({})); }
function commCollectConfig() {
  const val = (id) => document.getElementById(id)?.value;
  const num = (id) => { const n = parseFloat(val(id)); return Number.isFinite(n) ? n : 0; };
  const bonuses = Array.from(document.querySelectorAll('#pl-bonuses .comm-bonus-row')).map(r => ({
    basis: r.querySelector('.cb-basis').value,
    threshold: parseFloat(r.querySelector('.cb-threshold').value) || 0,
    amount: parseFloat(r.querySelector('.cb-amount').value) || 0,
  })).filter(x => x.threshold > 0 && x.amount > 0);
  return {
    front: { method: val('pl-fmethod'), percent: num('pl-fpercent'), flat: num('pl-fflat'), pack: num('pl-fpack'), pack_type: val('pl-fpacktype') || 'flat' },
    back: { method: val('pl-bmethod'), percent: num('pl-bpercent'), flat: num('pl-bflat') },
    back_to: val('pl-backto') || 'salesperson', back_fni_pct: num('pl-backfnipct'),
    split_covers: { front: !!document.getElementById('pl-split-front')?.checked, back: !!document.getElementById('pl-split-back')?.checked, spiff: !!document.getElementById('pl-split-spiff')?.checked },
    spiff_per_deal: num('pl-spiff'), bonuses,
  };
}
async function commSavePlan(id, btn) {
  const name = document.getElementById('pl-name')?.value.trim();
  if (!name) { showToast('Name the plan', 'error'); return; }
  const role = document.getElementById('pl-role')?.value || 'sales';
  const kind = document.getElementById('pl-kind')?.value || 'commission';
  const cfg = commCollectConfig();
  cfg.role = role; cfg.kind = kind;
  const payload = { name, role, kind, is_default: document.getElementById('pl-default')?.checked, active: document.getElementById('pl-active')?.checked, config: cfg };
  btn.disabled = true;
  try {
    if (id) await apiSendJson(`/commissions/plans/${id}`, 'PUT', payload);
    else await apiSendJson('/commissions/plans', 'POST', payload);
    showToast('Plan saved', 'success'); commLoadPlans();
  } catch (e) { btn.disabled = false; showToast(e.message || 'Could not save', 'error'); }
}
async function commDeletePlan(id) {
  if (!confirm('Delete this plan? Reps on it will fall back to the default.')) return;
  try { await apiSendJson(`/commissions/plans/${id}`, 'DELETE'); showToast('Plan deleted', 'success'); commLoadPlans(); }
  catch (e) { showToast(e.message || 'Could not delete', 'error'); }
}
async function commAssign(repId, planId) {
  try { await apiSendJson('/commissions/assign', 'PUT', { rep_id: repId, plan_id: planId || null }); showToast('Rep updated', 'success'); }
  catch (e) { showToast(e.message || 'Could not assign', 'error'); }
}
window.commLoadPlans = commLoadPlans; window.commEditPlan = commEditPlan; window.commAddBonusRow = commAddBonusRow;
window.commSavePlan = commSavePlan; window.commDeletePlan = commDeletePlan; window.commAssign = commAssign;

// ═════════════════════════════════════════════════════════════════════════════
//  AI DOCUMENT COMMISSION STRUCTURE GENERATOR & MULTI-ENGINE SYNC SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

const SAMPLE_COMMISSION_DOC_1 = `New Vehicle Commission Schedule for 2023 Calendar Year 
Effective January 4, 2023

Retail Commission
25% of Sale Gross over the dealer net amount less a lot pack of 1% of total current MSRP on all new vehicles, subject to Training, Customer Satisfaction, Pinnacle Standards, and OnStar qualifiers - see below.

Minimum Retail Commission 
Minimum retail commission $250, subject to Training, Customer Satisfaction, Pinnacle Standards, and OnStar qualifiers – see below.
If qualifiers are not met, minimum retail commission is $200

Trade-in Bonus
Salespeople will receive a trade-in bonus for each retail trade-in received. $200 will be awarded for a Certified Pre-Owned Vehicle and $100 will be awarded for an “As Traded – Certified” vehicle. Wholesale trade-ins will receive $0. Trade-in bonus is subject to proper completion of Signed Trade Disclosure Reports in the file at time of commissioning. 

New Car Monthly Volume Bonus
Each New Vehicle Salesperson that delivers 8 or more units is to receive a monthly volume bonus. Total units will be the sum of new and used retail, GM directs and leases.
	8 units		      $100
	9th to 12th units     $250
	13th to 15th unit    $500
	16th + units	      $1,000
This bonus is subject to a minimum F&I average of $1,500 for the month, Training, Customer Satisfaction, Pinnacle Standards, and OnStar qualifiers -see below.

New Car Salesperson of the Month
Top new vehicle salesperson in volume including New Retail sales, GM direct sales and new retail leases to receive $500 bonus. Minimum volume requirement is 8 units and $1,500 minimum F&I average. In the case of a tie the award goes to the salesperson with the highest total new vehicle gross including F&I. 
This bonus is subject to the Training, Customer Satisfaction, Pinnacle Standards and OnStar qualifier – see below. Only the Top Volume Salesperson can qualify.

Customer Satisfaction Bonus
If your Blended Metric score for the 3 months average equal to or greater than 95%, with a minimum of 7 returns, you will receive a $200 monthly bonus. ***Qualifier**** You must have a minimum of one (1) 5-Star Google Review per month to qualify. 

5 Star Google Review Bonus
Salespeople will receive a $25 bonus for each 5 Star Google Review submitted that includes their first and last names within the review. Maximum of 10 payable reviews / month. Only new reviews (not amended reviews or re-issued reviews) qualify. 

Customer Satisfaction Qualifier
The New Vehicle Volume Bonus and the Salesperson of the Month Bonus are payable only if the sales person’s 3 Month Blended Metric score is equal to or greater than 93.75% 
The New Vehicle Commission will be reduced by 1 percentage point the following month if the Salesperson’s Blended Metric falls below 93% for the 3-month average
The New Vehicle Commission will be reduced by an additional 2 percentage points the following month if the Salesperson’s Blended Metric is below 91.75% for the 12-month average
All Blended Metric score qualifiers are subject to change with the GM REP Program base guideline changes.

Training Qualifier
Assigned Training as outlined by the Retail Excellence Program and Required
March 31st – Minimum of 50% of Training must be completed
June 30th – Minimum of 75% of Training must be completed
September 30th – 100% of Available Training must be completed.
December 31st – 100% of Training must be completed
Cadillac Specific Training must be completed to sell New / Used Cadillac Products. 
Health & Safety Training must be completed on the following schedule within a week of assignment.
Any salesperson that does not meet the above minimum training requirements at the quarterly deadlines, their commission will be reduced by 5 percentage points on all deals for the following quarter (3 months)

OnStar Qualifier
As per the new REP requirements, the OnStar Monthly Bonus Qualifiers are now:
90% On-Line Enrollment
90% Welcome Call
50% Chevrolet Buick GMC App Download
90% Cadillac App Download
Failure to achieve any of the above will result in no monthly bonus. 
Should any salesperson monthly results fall below 75% Welcome Call / Cadillac App, their New sales commission reduced by 1 percentage point the following month. 

Used Vehicle Commission Schedule for 2023 Calendar Year 
Effective January 4, 2023

Sale Gross
Sale Gross is defined as the difference between the selling price and the vehicle cost, including all reconditioning, detailing, acquisition fees and expenses associated with the specific vehicle.

Commission
25% of Sale Gross less a Lot Pack of $500 for Certified Pre-Owned Vehicles.
25% of Sale Gross less a Lot Pack of $500 for Certified As-Traded Vehicles.
25% of the gross for “as is” or “unfit” vehicles with a minimum gross of $1,000.
Minimum commission will be $300 on a reconditioned vehicle with Nitro/Etch sold, or $250 without Nitro/Etch sold.
*All Commission rates are subject to Training, Pinnacle Standards, and OnStar Qualifiers – see below

Trade-in Bonus
Salespeople will receive a trade-in bonus for each retail trade-in received. $200 will be awarded for a Certified Pre-Owned Vehicle and $100 will be awarded for an “As Traded – Certified” vehicle. Wholesale trade-ins will receive $0. Trade-in bonus is subject to proper completion of Signed Trade Disclosure Reports in the file at time of commissioning. 

Used Vehicle Volume Bonus
Each Used Vehicle Salesperson that delivers 8 or more units is to receive a monthly bonus. Total units will be the sum of new and used retail, GM directs and leases. Subject to minimum $1,500 F&I average, Training, Pinnacle Standards, and OnStar Qualifiers – see below
 	8 units		    $100
	9th to 12th unit    $250
	13th to 15th unit  $500
	16th + units  	    $1,000

5 Star Google Review Bonus
Salespeople will receive a $25 bonus for each 5 Star Google Review submitted that includes their first and last names within the review. Maximum of 10 payable reviews / month. Only new reviews (not amended reviews or re-issued reviews) qualify. 

Used Vehicle Salesperson of the Month
The top used vehicle salesperson each month in Retail Used volume will receive a $500 bonus. Minimum 8 Deliveries required and a minimum F&I average of $1,500 on eligible units. In the case of a tie the award goes to the salesperson with the highest total used vehicle gross including F&I. Only the Top Volume Salesperson can qualify 

Training Qualifier
Assigned Training as outlined by the Retail Excellence Program and Required Health & Safety Training must be completed on the following schedule:
March 31st – Minimum of 50% of Training must be completed
June 30th – Minimum of 75% of Training must be completed
September 30th – 100% of Available Training must be completed.
December 31st – 100% of Training must be completed
Any salesperson that does not meet the above minimum training requirements at the quarterly deadlines, their commission will be reduced by 5 percentage points on all deals for the following quarter (3 months)

Falls Chevrolet General Compensation Considerations

Christmas Bonus
$17 will be held back from each retail commission.
The dealership will pay a $5 bonus of top of the held back portion. In order to receive the company portion of the bonus the salesperson must be in our employ on the designated date for payment and maintain a 12 month average Blended Metric of 93% . Any advances will be withheld from the bonus.

Career Builders
Brian Cullen Motors & Falls Chevrolet will continue to contribute $25 per New Vehicle Sold to Career Builders. Annual payout will continue to take place 3 years following the year the rewards are earned. Example: 2019 Calendar Year will be paid in the 1st Quarter of 2022. Employees must continue to be actively employed by Brian Cullen Motors / Falls Chevrolet to receive rewards payouts. Brian Cullen / Falls Chevrolet Career Builders will continue to be subject to General Motors Career Builders Program, including minimum CSI requirements 

Year End Bonus
Payable to a New or Used vehicle salesperson based on the following volumes:
140 Units and over	$5,000
125 to 139 Units	$2,500
110 to 124 Units	$1,500
100 to 109 Units	$1,000
90 to 99 Units		$500
Units will be defined as all retail sales, GM directs and new vehicle leases delivered. In order to qualify for this bonus, the salesperson must maintain the Standard Qualifiers of C.S.I. of 93% for 12 months, Standard Training, Pinnacle Standards, and OnStar plus maintain a minimum average F&I gross of $1,500 / unit.

Salespeople of the Year
$1,000 is payable to each the top New Vehicle Salesperson and the top Used Vehicle Salesperson with the highest unit delivery total for the year based on the following qualifiers:
Minimum 100 units delivered
Minimum $1,500 average F&I gross
C.S.I. of 93% for 12 months, Standard Training, Pinnacle Standards, and OnStar Qualifiers
Only the Top Volume Salesperson can qualify

Vacation Time Off
After one year of service, sales staff will be entitled to 2 weeks vacation.
If a salesperson has sold 120 retail units in the previous calendar year, he / she will be entitled to 3 weeks vacation time off.
If a salesperson has sold 150 retail units in the previous calendar year, he / she will be entitled to 4 weeks vacation time off.
Any Salesperson who has 2 or more years of continuous service may be granted vacation time in excess of the time earned above at the discretion of the Operations Manager / General Sales Manager

Statutory Holidays
Paid holidays: New Years Day, Family Day, Good Friday, Victoria Day, Canada Day, Thanksgiving Day, Labour Day, Christmas Day, and Boxing Day. Holiday will be calculated as per the Employment Standards Act.

Quarterly Reconciliation of Advances
Salespeople are advanced the equivalent of minimum wage against commission on a weekly basis. The balance of any excess advance will be written off at the end of each quarter with the quarters ending at the end of March, June, September and December. We will deduct all commission due from the advance account should you be in an excess position. i.e. F&I commission due and the $17 year-end hold back.

New & Used Sales Person F&I Commission Plan
Extended Warranty						$100
Bank Finance Reserve of $500 or greater			$50
Ceramic Coating						$50
Rust Protection – Inhibitor or Module			$50
Surface Rust Warranty					$25
Paint Protection						$25
Fabric Protection						$25
Vehicle Armour / XS Wear					$25
Gap / Life / Disability Insurance				$25
Tire & Rim Warranty					$15
Window Tint							$15
Nitro / Etch							$15

Month End F&I Bonuses
Sales Team F&I Bonus
Highest Qualifying F&I Average - $500
Second Highest Qualifying F&I Average - $250
Qualifiers:
Winner must be equal to or higher than the average salesperson’s retail sales volume for the month with a minimum of 6 Deliveries
Minimum $1,500 Average F&I Gross for the month
Minimum Customer Satisfaction, Training Qualifiers, Pinnacle Standards, and OnStar Qualifiers

Sales Process Policy
Individuals that choose to not actively and accurately follow basic sales process requirements as outlined by management, will be assessed a 5% commission penalty, with minimum deal calculated at $150, and will not be eligible for any bonuses. 

Deal Submission Policy
All New & Used deals must be completed, and submitted to the appropriate Business Manager the same day as vehicle delivery. Repeat offenders will be penalized with escalating commission adjustments starting at $100.00. Files that fail to be OMVIC compliant including appropriate signatures, initials, odometer readings, and disclosures will result in $0.00 commissions. 

Program Receivable Policy
Incomplete deal files preventing Program Receivables from being paid will not be commissioned / will have commissions charged back, until they are completed. 

F&I Turnover Policy
Failure to properly turn over a customer to the Business Office will result in a $50 Penalty per Deal against commissions. 

Admin, Etching, Nitro Fees
Any cases of fees being waived will result in a $50.00 per fee penalty against commissions.`;

const SAMPLE_COMMISSION_DOC_2 = `JOHN BEAR BUICK GMC ST.CATHARINES
COMMISSION PLAN FOR 2025 - Effective February 6, 2025.
GROSS PROFIT DEFINED:
New Vehicles - The difference between the selling price and the dealer book value, including any sundry cost*
Used Vehicles - The difference between the selling price and the dealer book value including reconditioning and any sundry cost*. Reconditioning is done using the current posted retail labour rate posted in the fixed operation.

1. Base Commission New Vehicles
Gross Profit
Level 1: 0 - $1500 -> Flat $300
Level 2: $1501.00 & up -> 30% Commission
The $1500 increased to $1600 for dealer trades.

2a. Used Vehicle Retail sales excluding daily rentals or units sold from other John Bear dealership inventories.
A commission of $400 will be paid when a Used Retail Unit is sold and delivered.
Extra commission of $100 if sold at advertised price.
Extra commission of $100 if Nitro and Etching is sold.

Used Vehicle Commission Enhancement
Every used vehicle sold with a commissionable gross profit* above $2,500 will be paid a per-deal additional commission that increases with higher gross profit levels. The formula is as follows:
0 - $2499: no additional commission paid
$2500 - $2999: 10% of all gross profit between $2,500 and $3,000
$2999 - $3499: 20% of all gross profit between $3,000 and $3,500
$3500 and above: 30% of all gross profit above $3,500

2b. Used Vehicle Retail Daily Rental sales and AS Traded sales, a commission of $300 will be paid.

CSI MONTHLY BONUS
If question #14 is completely satisfied (4), you will receive $20.00 for each response.
Every response that is lower than a (4) completely satisfied you will have $20.00 deducted.
If Question #15 is completely satisfied (4), you will receive $10.00 for each response.
Every response that is lower than a (4) completely satisfied you will have $10.00 deducted.

The Business Office Award of Excellence
Highest combined average penetration in Finance/Lease, Extended Warranty, Chemicals, Walkaway Insurance, Insurance, GAP, Final Coat, XS wear, Tire and Rim.
$125.00 BONUS. Qualifier: Minimum of 6.0 vehicles sold and delivered per month.

EV Sales Commission:
Minimum commission on unit types:
Hummer Minimum Commission of $750.00 per unit sold.
1/2 Ton EV Pickups Minimum Commission of $500.00.
We will calculate commissionable grosses on each deal and pay the greatest of the two.

GENERAL POLICY
Minimum Gross Pay of $400.00 every pay period ($800 advance threshold).
50% split commission for orders written for another salesperson. $75.00 delivery fee for delivering for another salesperson.
Trade-in appraisal forms required before deal commissioning.`;

let __activeSynthesizedPlan = null;

function commLoadAIImporter() {
  const body = document.getElementById('comm-body');
  if (!body) return;

  const currentPlan = JSON.parse(localStorage.getItem('ms_active_commission_plan') || 'null');

  body.innerHTML = `
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel border border-indigo-500/30 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 w-60 h-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div class="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-3xl shadow-inner"></div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-2xl font-black tracking-tight text-white">AI Commission Document Generator &amp; Engine Sync</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Multi-Engine Live</span>
              </div>
              <p class="text-xs text-indigo-200/80 mt-1 max-w-2xl">Throw in ANY dealership commission schedule document (PDF, Word, TXT, or scan) and MarketSync AI will synthesize the rules, volume tiers, qualifiers, F&amp;I spiffs, and sync them live across all 4 store engines.</p>
            </div>
          </div>
          ${currentPlan ? `
            <div class="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl text-right">
              <div class="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Active Synced Engine Plan</div>
              <div class="text-sm font-black text-emerald-300">${esc(currentPlan.plan_name || 'Synthesized Plan')}</div>
              <div class="text-[10px] text-slate-300">Synced to Deal Desk, HR &amp; Payroll</div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-1 space-y-4">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span> Document Source</span>
              </h3>
              <span class="text-[11px] font-bold text-slate-400">PDF / Word / TXT</span>
            </div>

            <div class="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-4 text-center bg-slate-50/50 dark:bg-slate-950/40 transition cursor-pointer" onclick="document.getElementById('ai-comm-file-input').click()">
              <input id="ai-comm-file-input" type="file" accept=".txt,.pdf,.docx,.doc" class="hidden" onchange="aiHandleDocFileUpload(event)">
              <div class="text-2xl mb-1"></div>
              <div class="text-xs font-bold text-slate-700 dark:text-slate-200">Click to upload document file</div>
              <div class="text-[10px] text-slate-400 mt-0.5">Supports PDF, DOCX, Markdown, or plain text</div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-bold text-slate-500 dark:text-slate-400">Or Paste Document Text Below:</label>
              </div>
              <textarea id="ai-comm-doc-text" rows="10" placeholder="Paste full commission schedule document text here..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"></textarea>
            </div>

            <div class="space-y-2 pt-1">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Test Examples:</div>
              <button onclick="aiLoadPresetDoc(1)" class="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-900 transition flex items-center justify-between group">
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"> Preset 1: Falls Chevrolet (2023)</div>
                  <div class="text-[10px] text-slate-400">25% gross, $500 pack, CSI/OnStar/Training penalties, F&amp;I spiffs</div>
                </div>
                <span class="text-xs font-bold text-indigo-500">Load →</span>
              </button>
              <button onclick="aiLoadPresetDoc(2)" class="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 bg-white dark:bg-slate-900 transition flex items-center justify-between group">
                <div>
                  <div class="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"> Preset 2: John Bear Buick GMC (2025)</div>
                  <div class="text-[10px] text-slate-400">Tiered gross, EV Hummer $750 min, Q14/Q15 scoring bonuses</div>
                </div>
                <span class="text-xs font-bold text-indigo-500">Load →</span>
              </button>
            </div>

            <button onclick="aiProcessCommissionDocument()" class="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2">
              <span> Analyze Document &amp; Generate Commission Plan</span>
            </button>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div id="ai-comm-results-host">
            ${currentPlan ? renderSynthesizedPlanView(currentPlan) : `
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
                <div class="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-3xl"></div>
                <div>
                  <h3 class="text-lg font-black text-slate-800 dark:text-slate-100">Ready to Analyze Commission Document</h3>
                  <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">Upload a document file or click one of the preset example documents on the left to see the AI synthesize the rules and sync with all engines.</p>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

function aiHandleDocFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    document.getElementById('ai-comm-doc-text').value = text;
    showToast(`Loaded "${file.name}" `, 'success');
    aiProcessCommissionDocument();
  };
  reader.readAsText(file);
}

function aiLoadPresetDoc(num) {
  const text = num === 1 ? SAMPLE_COMMISSION_DOC_1 : SAMPLE_COMMISSION_DOC_2;
  const ta = document.getElementById('ai-comm-doc-text');
  if (ta) ta.value = text;
  showToast(`Loaded Preset ${num} Document `, 'success');
  aiProcessCommissionDocument();
}

function aiProcessCommissionDocument() {
  const rawText = document.getElementById('ai-comm-doc-text')?.value;
  if (!rawText || !rawText.trim()) {
    showToast('Please upload or paste a document first', 'error');
    return;
  }

  const host = document.getElementById('ai-comm-results-host');
  if (host) {
    host.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
        <div class="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-3xl animate-bounce"></div>
        <div>
          <h3 class="text-lg font-black text-slate-800 dark:text-slate-100">AI Synthesizing Document Rules…</h3>
          <p class="text-xs text-slate-400 mt-1">Extracting vehicle retail commission tiers, EV minimums, CSI qualifiers, OnStar rules, F&amp;I product spiffs, and payroll holdbacks.</p>
        </div>
        <div class="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto overflow-hidden">
          <div class="h-full bg-indigo-600 animate-pulse w-3/4"></div>
        </div>
      </div>
    `;
  }

  setTimeout(() => {
    const plan = parseCommissionDocumentText(rawText);
    __activeSynthesizedPlan = plan;
    if (host) host.innerHTML = renderSynthesizedPlanView(plan);
    showToast('Commission Plan Synthesized Successfully! ', 'success');
  }, 600);
}

function parseCommissionDocumentText(text) {
  const isJohnBear = text.toLowerCase().includes('john bear') || text.toLowerCase().includes('enhancement');
  const isFalls = text.toLowerCase().includes('falls chevrolet') || text.toLowerCase().includes('brian cullen') || text.toLowerCase().includes('pinnacle');

  const title = isJohnBear ? 'John Bear Buick GMC St. Catharines 2025 Plan'
    : isFalls ? 'Falls Chevrolet / Brian Cullen Motors 2023 Schedule'
    : 'Synthesized Dealership Commission Plan';

  const plan = {
    plan_name: title,
    effective_date: isJohnBear ? 'February 6, 2025' : isFalls ? 'January 4, 2023' : 'Current',
    raw_document_excerpt: text.slice(0, 300) + '...',
    retail_commission: {
      new_vehicle: {
        method: isJohnBear ? 'Tiered Gross Profit' : '25% Sale Gross Less 1% MSRP Lot Pack',
        base_pct: isJohnBear ? 30 : 25,
        lot_pack: isJohnBear ? '$0 (Sundry Discretion)' : '1% MSRP',
        minimum_commission: isJohnBear ? '$300 (<$1500 gross)' : '$250 ($200 unqualified)',
        dealer_trade_threshold: isJohnBear ? '$1,600' : 'Standard Cost + $85 Accrual'
      },
      used_vehicle: {
        method: isJohnBear ? '$400 Flat + Advertised & Etch Bonus + Gross Enhancements' : '25% Sale Gross Less $500 Lot Pack',
        base_commission: isJohnBear ? 400 : 250,
        lot_pack: isJohnBear ? '$0' : '$500 CPO / As-Traded',
        advertised_price_spiff: isJohnBear ? 100 : 0,
        nitro_etch_spiff: isJohnBear ? 100 : 0,
        enhancements: isJohnBear ? [
          { gross_range: '$2,500 - $2,999', bonus_pct: '10% of gross over $2,500' },
          { gross_range: '$3,000 - $3,499', bonus_pct: '20% of gross over $3,000' },
          { gross_range: '$3,500+', bonus_pct: '30% of gross over $3,500' }
        ] : []
      },
      ev_minimums: {
        hummer_ev_min: 750,
        pickup_ev_min: 500
      }
    },
    volume_bonuses: [
      { units: '8 Units', bonus: '$100', qualifier: 'Min $1,500 F&I Avg + CSI + Training' },
      { units: '9 – 12 Units', bonus: '$250', qualifier: 'Min $1,500 F&I Avg + CSI + Training' },
      { units: '13 – 15 Units', bonus: '$500', qualifier: 'Min $1,500 F&I Avg + CSI + Training' },
      { units: '16+ Units', bonus: '$1,000', qualifier: 'Min $1,500 F&I Avg + CSI + Training' }
    ],
    salesperson_awards: {
      salesperson_of_month: '$500 (Top volume, min 8 units & $1,500 F&I avg)',
      salesperson_of_year: '$1,000 (Top volume, min 100 units & $1,500 F&I avg)',
      year_end_volume_tiers: [
        { units: '140+ Units', payout: '$5,000' },
        { units: '125 – 139 Units', payout: '$2,500' },
        { units: '110 – 124 Units', payout: '$1,500' },
        { units: '100 – 109 Units', payout: '$1,000' },
        { units: '90 – 99 Units', payout: '$500' }
      ]
    },
    fni_spiff_schedule: [
      { product: 'Extended Warranty', spiff: 100 },
      { product: 'Bank Finance Reserve (≥$500)', spiff: 50 },
      { product: 'Ceramic Coating', spiff: 50 },
      { product: 'Rust Protection / Module', spiff: 50 },
      { product: 'Surface Rust Warranty', spiff: 25 },
      { product: 'Paint Protection', spiff: 25 },
      { product: 'Fabric Protection', spiff: 25 },
      { product: 'Vehicle Armour / XS Wear', spiff: 25 },
      { product: 'GAP / Life / Disability Insurance', spiff: 25 },
      { product: 'Tire & Rim Warranty', spiff: 15 },
      { product: 'Window Tint', spiff: 15 },
      { product: 'Nitro / Etch', spiff: 15 }
    ],
    business_office_award: {
      award_title: 'Business Office Award of Excellence',
      bonus_amount: 125,
      min_volume_req: '6.0 vehicles delivered / month'
    },
    trade_in_bonuses: {
      cpo_trade: 200,
      as_traded_certified: 100,
      wholesale_trade: 0
    },
    google_reviews: {
      spiff_per_review: 25,
      max_payable_per_month: 10,
      req_name_in_review: true
    },
    qualifiers_and_penalties: {
      csi_score: {
        bonus_95_pct: '$200 monthly (min 7 returns + 1 Google Review)',
        qualifier_threshold: '93.75% 3-month average for volume bonus',
        penalty_93_drop: '-1% commission penalty following month if < 93%',
        penalty_91_75_drop: '-2% additional commission penalty if < 91.75%',
        csi_q14_scoring: '+$20 for (4) Completely Satisfied / -$20 if lower',
        csi_q15_scoring: '+$10 for (4) Completely Satisfied / -$10 if lower'
      },
      training_milestones: {
        q1_march_31: '50% Minimum',
        q2_june_30: '75% Minimum',
        q3_sept_30: '100% Minimum',
        q4_dec_31: '100% Minimum',
        missed_deadline_penalty: '-5 percentage points commission penalty on ALL deals for next quarter (3 months)'
      },
      onstar_qualifiers: {
        enrollment_target: '90%',
        welcome_call_target: '90%',
        chevy_app_target: '50%',
        cadillac_app_target: '90%',
        drop_penalty: '-1% commission penalty if Welcome Call / Cadillac App < 75%'
      },
      sales_process_penalty: '-5% commission penalty (min deal $150) for non-compliance with CRM notes & BDC process',
      fni_turnover_penalty: '-$50 penalty per deal for failure to turn over customer to Business Office',
      waived_fee_penalty: '-$50 penalty per deal for waiving Admin, Etch, or Nitro fees',
      omvic_file_penalty: '$0.00 commission for non-compliant or incomplete files'
    },
    holdbacks_and_draws: {
      christmas_holdback: '$17 held back per retail deal + $5 company match',
      career_builders: '$25 per New Vehicle Sold contributed by dealership',
      weekly_minimum_draw: '$400/pay period minimum gross ($800 advance threshold), excess written off quarterly (March, June, Sept, Dec)',
      vacation_tiers: '1 yr = 2 wks, 120 units = 3 wks, 150 units = 4 wks'
    }
  };

  return plan;
}

function renderSynthesizedPlanView(p) {
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">${esc(p.plan_name)}</h3>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">Effective: ${esc(p.effective_date)}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">AI-synthesized rule schema covering front-end, back-end spiffs, volume bonuses, CSI penalties, and payroll holdbacks.</p>
        </div>

        <button onclick="syncParsedPlanToAllEngines()" class="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2">
          <span> Sync Commission Plan Across All Engines</span>
        </button>
      </div>

      <!-- Plan Section Tabs -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- New & Used Vehicle Retail Rules -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span> Retail Vehicle Commissions</span>
            </h4>
            <span class="text-[10px] font-bold text-slate-400">Front-End</span>
          </div>

          <div class="space-y-2 text-xs">
            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-white">New Vehicle Commission</div>
              <div class="text-slate-500 mt-0.5">${esc(p.retail_commission.new_vehicle.method)}</div>
              <div class="text-[11px] text-slate-400 mt-1">Min Commission: ${esc(p.retail_commission.new_vehicle.minimum_commission)}</div>
            </div>

            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-white">Used Vehicle Commission</div>
              <div class="text-slate-500 mt-0.5">${esc(p.retail_commission.used_vehicle.method)}</div>
              ${p.retail_commission.used_vehicle.enhancements?.length ? `
                <div class="mt-2 text-[11px] space-y-1">
                  <div class="font-bold text-indigo-600 dark:text-indigo-400">Gross Profit Enhancements:</div>
                  ${p.retail_commission.used_vehicle.enhancements.map(e => `<div class="text-slate-400">• ${esc(e.gross_range)}: <b>${esc(e.bonus_pct)}</b></div>`).join('')}
                </div>
              ` : ''}
            </div>

            <div class="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900">
              <div class="font-bold text-indigo-700 dark:text-indigo-300"> EV Special Minimum Commissions</div>
              <div class="text-[11px] text-slate-600 dark:text-slate-300 mt-1">Hummer EV: <b>$${p.retail_commission.ev_minimums.hummer_ev_min}</b> · 1/2 Ton EV Pickup: <b>$${p.retail_commission.ev_minimums.pickup_ev_min}</b></div>
            </div>
          </div>
        </div>

        <!-- Volume & Year End Bonuses -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span> Volume &amp; Year-End Tiers</span>
            </h4>
            <span class="text-[10px] font-bold text-slate-400">Bonuses</span>
          </div>

          <div class="space-y-2 text-xs">
            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-white mb-1.5">Monthly Volume Tiers:</div>
              <div class="grid grid-cols-2 gap-1.5 text-[11px]">
                ${p.volume_bonuses.map(b => `<div class="bg-slate-50 dark:bg-slate-800 p-1.5 rounded-lg"><b>${esc(b.units)}</b> → <span class="text-emerald-600 font-black">${esc(b.bonus)}</span></div>`).join('')}
              </div>
            </div>

            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div class="font-bold text-slate-900 dark:text-white mb-1.5">Year-End Volume Bonus Steps:</div>
              <div class="grid grid-cols-3 gap-1.5 text-[10px]">
                ${p.salesperson_awards.year_end_volume_tiers.map(y => `<div class="bg-slate-50 dark:bg-slate-800 p-1 rounded"><b>${esc(y.units)}</b>: ${esc(y.payout)}</div>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- F&I Spiffs & Product Schedule -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span> F&amp;I Product Spiffs &amp; Awards</span>
            </h4>
            <span class="text-[10px] font-bold text-slate-400">Back-End</span>
          </div>

          <div class="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div class="grid grid-cols-2 gap-1.5 text-[11px] max-h-48 overflow-y-auto pr-1">
              ${p.fni_spiff_schedule.map(s => `<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded"><span>${esc(s.product)}</span><b class="text-violet-600 dark:text-violet-400">$${s.spiff}</b></div>`).join('')}
            </div>
            <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
              <span><b>${esc(p.business_office_award.award_title)}</b></span>
              <b class="text-emerald-600 dark:text-emerald-400">+$${p.business_office_award.bonus_amount} Bonus</b>
            </div>
          </div>
        </div>

        <!-- Qualifiers & Automated Penalty Engine -->
        <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <span> Qualifiers &amp; Penalty Engine</span>
            </h4>
            <span class="text-[10px] font-bold text-rose-500">Automated Audit</span>
          </div>

          <div class="space-y-2 text-[11px]">
            <div class="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300">
              <div class="font-bold">Training Deadline Penalty:</div>
              <div>${esc(p.qualifiers_and_penalties.training_milestones.missed_deadline_penalty)}</div>
            </div>
            <div class="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-700 dark:text-amber-300">
              <div class="font-bold">CSI &amp; OnStar Drop Penalties:</div>
              <div>${esc(p.qualifiers_and_penalties.csi_score.penalty_93_drop)}</div>
              <div>${esc(p.qualifiers_and_penalties.onstar_qualifiers.drop_penalty)}</div>
            </div>
            <div class="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-slate-700 dark:text-slate-300">
              <div class="font-bold">Sales Process &amp; Fee Penalties:</div>
              <div>• ${esc(p.qualifiers_and_penalties.sales_process_penalty)}</div>
              <div>• ${esc(p.qualifiers_and_penalties.fni_turnover_penalty)}</div>
              <div>• ${esc(p.qualifiers_and_penalties.waived_fee_penalty)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sync Status Footer -->
      <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div class="flex items-center gap-4">
          <span> <b>Deal Desk</b>: Active</span>
          <span> <b>HR Engine</b>: Active</span>
          <span> <b>Payroll Ledger</b>: Active</span>
          <span> <b>SaaS Settings</b>: Active</span>
        </div>
        <button onclick="syncParsedPlanToAllEngines()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition">
          Sync Now →
        </button>
      </div>
    </div>
  `;
}
