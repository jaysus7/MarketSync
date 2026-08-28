/* dashboard.js split part 8/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Collect a real, refundable deposit as part of the deal. Generates a Stripe
// payment link (funds go into the dealer's own connected account) tied to this
// customer and the desked vehicle. Rep sends/opens it; the webhook stamps the
// customer record "deposit paid".
function deskCollectDeposit(contactId) {
  if (!contactId) { showToast('Pick a customer first', 'error'); return; }
  crmOverlay(`<div class="p-5 space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-lg font-black text-slate-900 dark:text-white">Collect a deposit</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400">The deposit is charged straight into your own Stripe payouts account and is refundable per your policy. Send the customer this secure link or open it on your device.</p>
    <div>
      <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Deposit amount</label>
      <div class="flex items-center gap-2">
        <span class="text-slate-500 font-bold">$</span>
        <input id="dep-amount" type="number" min="1" step="1" placeholder="500" class="w-40 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        <button type="button" onclick="deskDepositCreate('${contactId}')" class="text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg">Create link</button>
      </div>
      <div class="text-[11px] text-slate-400 mt-1">Leave blank to use your default deposit amount.</div>
    </div>
    <div id="dep-link" class="hidden"></div>
  </div>`, 'max-w-lg');
}
async function deskDepositCreate(contactId) {
  const link = document.getElementById('dep-link');
  const amt = parseInt(document.getElementById('dep-amount')?.value || '', 10);
  if (link) { link.classList.remove('hidden'); link.innerHTML = '<div class="text-xs text-slate-500">Creating a secure deposit link…</div>'; }
  try {
    const body = { contact_id: contactId, vehicle_id: (typeof __deskDeal !== 'undefined' && __deskDeal?.inventory_id) || null };
    if (amt && amt > 0) body.amount = amt;
    const r = await apiSendJson('/deposits/checkout', 'POST', body, { timeoutMs: 30000 });
    if (!r.url) throw new Error('No link returned.');
    if (link) link.innerHTML = `
      <div class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Send this secure link to the customer, or open it to take payment now:</div>
      <div class="flex gap-1.5">
        <input readonly value="${esc(r.url)}" onclick="this.select()" class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs">
        <button type="button" onclick="navigator.clipboard.writeText('${esc(r.url)}');showToast('Link copied','success')" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-3 rounded-lg">Copy</button>
        <a href="${esc(r.url)}" target="_blank" rel="noopener" class="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg">Open</a>
      </div>
      <div class="text-[11px] text-slate-400 mt-1">Once paid, it shows on the customer's record automatically.</div>`;
  } catch (e) {
    if (link) link.innerHTML = `<div class="text-xs text-rose-600 dark:text-rose-400">${esc(e.message || 'Could not create the deposit link.')}</div>`;
  }
}
window.deskCollectDeposit = deskCollectDeposit; window.deskDepositCreate = deskDepositCreate;
// Open the Desk-a-deal page focused on one customer/deal (from CRM, F&I, or Sales rows).
let __deskDealId = null;
function openDeskForContact(contactId, dealId) {
  __deskContactId = contactId || null;
  __deskDealId = dealId || null;
  switchPage('desk');
}
function openDeskForDeal(dealId, contactId) {
  __deskContactId = contactId || null;
  __deskDealId = dealId || null;
  switchPage('desk');
}
// Open the Trade Appraisal page pre-filled with this customer's details.
function apprFromContact(cIdOrObj) {
  document.querySelector('.ms-modal-scrim')?.remove();
  document.querySelectorAll('.fixed:has(#crm-actions-wrap), .fixed:has(#crm-actions-menu), .fixed:has(#crm-tab-btn-timeline)').forEach(el => el.remove());
  let contact = null;
  const active = (typeof __crmActiveContact !== 'undefined' && __crmActiveContact) || {};
  if (cIdOrObj && typeof cIdOrObj === 'object') {
    contact = (cIdOrObj.id && cIdOrObj.id === active.id) ? { ...active, ...cIdOrObj } : cIdOrObj;
  } else {
    const id = typeof cIdOrObj === 'string' ? cIdOrObj : null;
    if (id && active.id === id) {
      contact = active;
    } else if (id && typeof __crmContactsCache !== 'undefined' && Array.isArray(__crmContactsCache)) {
      contact = __crmContactsCache.find(x => x.id === id) || { id };
    } else {
      contact = active.id ? active : (id ? { id } : {});
    }
  }
  window.__apprPrefillContact = contact;
  if (typeof switchPage === 'function') switchPage('appraisal');
  const apply = () => {
    if (typeof apprPickCustomer !== 'function') return false;
    const firstEl = document.getElementById('cust-first');
    if (!firstEl) return false;
    apprPickCustomer(window.__apprPrefillContact || contact);
    return true;
  };
  if (!apply()) {
    let n = 0;
    const tmr = setInterval(() => { if (apply() || ++n > 40) clearInterval(tmr); }, 100);
  }
}
window.apprFromContact = apprFromContact;
window.loadDeskDeal = loadDeskDeal;
window.deskPickCustomer = deskPickCustomer;
window.deskAddLine = deskAddLine;
window.deskDelLine = deskDelLine;
window.deskLineEdit = deskLineEdit;
window.deskVehSearch = deskVehSearch;
window.deskPickVehicle = deskPickVehicle;
window.deskPullTrade = deskPullTrade;
window.deskApplyTrade = deskApplyTrade;
window.deskRenderSummary = deskRenderSummary;
window.deskSave = deskSave;
window.deskSetStatus = deskSetStatus;
window.deskSaveDealer = deskSaveDealer;
window.deskPrint = deskPrint;
window.deskEsign = deskEsign;
window.openEsignStatus = openEsignStatus;
window.openEsignDetail = openEsignDetail;
window.esignCopyLink = esignCopyLink;
window.openDeskForContact = openDeskForContact;
window.openDeskForDeal = openDeskForDeal;

// ── Settings hub: tab-filter the profile page into named sections ────────────
let __settingsTab = 'account';
// Settings organised by department — one section per department, each card lives in
// exactly one section (no repeated info), laid out in a 2–3 column grid. "My Account"
// holds the per-user personal settings; the rest are dealership departments (admin).
const SETTINGS_TAB_SECTIONS = {
  account: ['profile-form', 'security-section', 'settings-my-record', 'settings-language-card'],
  admin: ['settings-team', 'billing-section', 'integrations-section', 'settings-texting-card', 'groups-settings-section', 'dealer-features-card', 'email-sending-card'],
  team_chat: ['settings-team-chat-card'],
  hr: ['settings-hr-card'],
  sales: ['crm-dms-card', 'desk-fees-card', 'dealer-docs-card', 'guardrail-settings-section'],
  marketing: ['prof-branding-section', 'ai-boost-section'],
  inventory: ['inv-intel-section'],
  service: ['settings-service-card'],
  accounting: ['settings-accounting-card'],
  email_sms: ['settings-email-sms-card'],
};
// The header gear jumps straight to Administration on full DealerOS — but a
// restricted tier (Design Studio / Facebook-only) has that tab button hidden, and
// hardcoding 'admin' would still force it open by calling settingsTab() directly,
// bypassing the trim entirely. Land on My Account instead when Administration
// isn't actually reachable.
function openSettingsAdmin() {
  switchPage('profile');
  const adminHidden = document.querySelector('#settings-tabs [data-stab="admin"]')?.classList.contains('hidden');
  settingsTab(adminHidden ? 'account' : 'admin');
}
window.openSettingsAdmin = openSettingsAdmin;
function settingsTab(tab) {
  if (!SETTINGS_TAB_SECTIONS[tab]) tab = 'account';
  __settingsTab = tab;
  const active = new Set(SETTINGS_TAB_SECTIONS[tab]);
  // Show only the active tab's cards; role-hidden ones keep their own `hidden`.
  Object.values(SETTINGS_TAB_SECTIONS).flat().forEach(id => {
    document.getElementById(id)?.classList.toggle('stab-hide', !active.has(id));
  });
  document.querySelectorAll('#settings-tabs .stab-btn').forEach(b => {
    const on = b.dataset.stab === tab;
    b.classList.toggle('border-indigo-500', on);
    b.classList.toggle('text-indigo-600', on);
    b.classList.toggle('dark:text-indigo-400', on);
    b.classList.toggle('border-transparent', !on);
    b.classList.toggle('text-slate-500', !on);
  });
  // Two-column layout only when the active tab actually shows more than one card
  // (a lone card stays full-width instead of hugging the left half).
  ['profile-panel', 'settings-panel-extra'].forEach(pid => {
    const panel = document.getElementById(pid); if (!panel) return;
    const shown = Array.from(panel.children).filter(el =>
      el.nodeType === 1 && el.id !== 'profile-msg' &&
      !el.classList.contains('stab-hide') && !el.classList.contains('hidden'));
    panel.classList.toggle('is-multi', shown.length > 1);
  });
  if (tab === 'email_sms') {
    if (typeof renderSettingsEmailSmsCard === 'function') renderSettingsEmailSmsCard();
  }
  if (tab === 'hr') {
    if (typeof renderSettingsHrCard === 'function') renderSettingsHrCard();
  }
  // Your own employment record — everybody has one, so it lives in My Account.
  if (tab === 'account') {
    if (typeof renderMyRecordCard === 'function') renderMyRecordCard();
    // Facebook Dealer folds its Team roster into My Account (Administration is
    // hidden entirely for single-product tiers, so this is its only way to reach it).
    if (Array.isArray(SETTINGS_TAB_SECTIONS.account) && SETTINGS_TAB_SECTIONS.account.includes('settings-team')) {
      loadSettingsTeam(document.getElementById('team-picker')?.value || 'sales');
      // Facebook Dealer and Video neither one has a separate "Staff" nav page —
      // their real staff management (Invite Rep/Manager, role table) folds into
      // this SAME Team card instead, exactly like Administration folds it in for
      // full DealerOS below (nodes are moved, not cloned, so IDs keep working).
      const isFbOrVideoTeam = (typeof isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace())
        || (typeof isVideoOnlyWorkspace === 'function' && isVideoOnlyWorkspace());
      if (isFbOrVideoTeam) {
        const host = document.getElementById('settings-team');
        const dv = document.getElementById('dealer-view-panel');
        const lr = document.getElementById('lead-routing-card');
        const isAdminNow = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'DEALER_GROUP'].includes(profileContext?.role);
        if (host && dv && isAdminNow) { dv.classList.remove('hidden'); if (dv.parentElement !== host) host.appendChild(dv); }
        if (host && lr && isAdminNow && lr.parentElement !== host) host.appendChild(lr);
        if (isAdminNow && typeof loadDealerManagementMatrix === 'function') loadDealerManagementMatrix();
      }
    }
  }
  // Administration bundles team, billing, integrations, group, features + texting.
  if (tab === 'admin') {
    if (typeof renderCurrentPlanBox === 'function') renderCurrentPlanBox();
    if (typeof loadDealerFeatures === 'function') loadDealerFeatures();
    if (typeof loadIntegrations === 'function') loadIntegrations();
    if (typeof loadTextingStatus === 'function') loadTextingStatus();
    // Team: MarketSync owner sees SaaS staff/roles; a dealer sees their team + login
    // management + lead routing (nodes are moved, not cloned, so IDs keep working).
    if (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) {
      renderSettingsSaasRoles();
    } else {
      loadSettingsTeam(document.getElementById('team-picker')?.value || 'sales');
      const host = document.getElementById('settings-team');
      const dv = document.getElementById('dealer-view-panel');
      const lr = document.getElementById('lead-routing-card');
      const isAdmin = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
      if (host && dv && isAdmin) { dv.classList.remove('hidden'); if (dv.parentElement !== host) host.appendChild(dv); }
      if (host && lr && isAdmin && lr.parentElement !== host) host.appendChild(lr);
      if (isAdmin && typeof loadDealerManagementMatrix === 'function') loadDealerManagementMatrix();
    }
  }
  if (tab === 'sales') { if (typeof loadDeskFeeSettings === 'function') loadDeskFeeSettings(); if (typeof loadDealerDocs === 'function') loadDealerDocs(); }
  if (tab === 'team_chat' && typeof loadTeamChatSettings === 'function') loadTeamChatSettings();
}
window.settingsTab = settingsTab;

// ── Text messaging — provision a MarketSync-managed SMS number per dealer ──────
let __texting = { status: null };
async function loadTextingStatus() {
  const root = document.getElementById('texting-root'); if (!root) return;
  try { __texting.status = await apiGetJson('/integrations/twilio/provision/status'); }
  catch (e) {
    // requireMfa returns the bare code 'MFA_REQUIRED' as the error message — show
    // the actual reason instead of that raw code.
    root.innerHTML = e.message === 'MFA_REQUIRED'
      ? `<div class="text-sm text-amber-600 dark:text-amber-400">Complete multi-factor authentication above to manage text messaging.</div>`
      : `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load')}</div>`;
    return;
  }
  renderTexting();
}
window.loadTextingStatus = loadTextingStatus;
const TX_INP = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
function renderTexting() {
  const root = document.getElementById('texting-root'); if (!root) return;
  const s = __texting.status || {};
  if (!s.available) {
    root.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400">Automatic number provisioning isn't switched on for this server yet. You can still connect your own Twilio account under <b>Integrations</b> above.</div>`;
    return;
  }
  if (s.platform_managed && s.number) {
    // Four stages the dealer actually cares about. Everything Twilio calls this
    // (submitted / twilio-approved / brand pending / campaign verified …) collapses
    // into: not started → pending → in review → approved → active.
    const a2p = s.a2p_status || 'not_started';
    const STAGE = { not_started: 0, pending: 1, submitted: 1, in_review: 2, approved: 3, active: 4, error: 1 };
    const badgeMap = {
      not_started: ['Not verified', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'],
      pending: ['Pending', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'],
      submitted: ['Pending', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'],
      in_review: ['In review', 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'],
      approved: ['Approved', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'],
      active: ['Active', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'],
      error: ['Needs attention', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'],
    };
    const badge = badgeMap[a2p] || badgeMap.not_started;
    const started = a2p !== 'not_started';
    root.innerHTML = `
      <div class="flex items-center gap-3 mb-2 flex-wrap">
        <div class="text-xl font-black text-slate-900 dark:text-white">${esc(s.number)}</div>
        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${badge[1]}">${badge[0]}</span>
        <button onclick="textingRelease()" class="ml-auto text-[12px] font-bold text-rose-500">Release number</button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Your automated follow-ups and AI texts send from this number. Any additional numbers you add later are attached to the same approved messaging profile automatically — you only verify once.</p>
      ${started ? textingA2pStages(STAGE[a2p] || 1, a2p, s) : textingA2pForm(s.a2p_profile || {}, s)}`;
    return;
  }
  root.innerHTML = `
    ${s.byo ? '<div class="text-xs text-slate-500 dark:text-slate-400 mb-2">You\'re currently using your own Twilio (Integrations). Provision a MarketSync-managed number instead below.</div>' : ''}
    <div class="flex gap-2 items-end mb-3 flex-wrap">
      <div><label class="block text-[11px] font-bold text-slate-500 mb-1">Country</label><select id="tx-country" class="${TX_INP}" style="width:90px"><option value="US">US</option><option value="CA">CA</option></select></div>
      <div style="width:110px"><label class="block text-[11px] font-bold text-slate-500 mb-1">Province / State</label><input id="tx-region" maxlength="4" placeholder="e.g. ON" class="${TX_INP}"></div>
      <div class="flex-1 min-w-[140px]"><label class="block text-[11px] font-bold text-slate-500 mb-1">City</label><input id="tx-city" placeholder="e.g. Welland" class="${TX_INP}"></div>
      <div style="width:110px"><label class="block text-[11px] font-bold text-slate-500 mb-1">Area code (optional)</label><input id="tx-area" maxlength="3" placeholder="e.g. 416" class="${TX_INP}"></div>
      <button onclick="textingSearch(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg">Search numbers</button>
    </div>
    <p class="text-[11px] text-slate-400 dark:text-slate-500 mb-3 -mt-1">Search by province/state (2-letter code) and city to get a local number, or leave them blank and use an area code.</p>
    <div id="tx-results"></div>`;
}
// Messaging Verification (A2P 10DLC). Reframed from a per-number "carrier
// registration" chore into a once-per-dealership verification: the dealer only
// types the two things we can't know (legal name + tax ID); everything else is
// pulled from their dealership profile server-side. MarketSync submits the Twilio
// ISV registration in the background.
function textingA2pForm(p, s) {
  const lbl = (t) => `<label class="block text-[11px] font-bold text-slate-500 mb-1">${t}</label>`;
  const configured = s && s.a2p_configured;
  return `<div class="border-t border-slate-100 dark:border-slate-800 pt-3">
    <div class="text-sm font-black text-slate-900 dark:text-white mb-1">Messaging Verification</div>
    <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">US carriers require a one-time business verification (A2P 10DLC) before texting at full volume. Enter your legal business name and tax ID — we'll use your dealership's address, phone and website automatically and handle the registration for you.</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div>${lbl('Legal business name')}<input id="a2p-legal" value="${esc(p.legal_name || '')}" placeholder="As registered with the IRS/CRA" class="${TX_INP}"></div>
      <div>${lbl('Tax ID (EIN / BN)')}<input id="a2p-tax" value="${esc(p.tax_id || '')}" placeholder="e.g. 12-3456789" class="${TX_INP}"></div>
    </div>
    <details class="mt-2">
      <summary class="text-[12px] font-bold text-slate-500 cursor-pointer select-none">Override auto-filled business details (optional)</summary>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        <div class="sm:col-span-2">${lbl('Business address')}<input id="a2p-address" value="${esc(p.address || '')}" placeholder="From your dealership profile" class="${TX_INP}"></div>
        <div>${lbl('Website')}<input id="a2p-website" value="${esc(p.website || '')}" placeholder="From your dealership profile" class="${TX_INP}"></div>
        <div>${lbl('Contact email')}<input id="a2p-email" value="${esc(p.email || '')}" class="${TX_INP}"></div>
        <div>${lbl('Contact phone')}<input id="a2p-phone" value="${esc(p.phone || '')}" placeholder="From your dealership profile" class="${TX_INP}"></div>
        <div>${lbl('Authorized contact name')}<input id="a2p-contact" value="${esc(p.contact_name || '')}" class="${TX_INP}"></div>
        <div>${lbl('Contact title')}<input id="a2p-title" value="${esc(p.contact_title || '')}" placeholder="e.g. General Manager" class="${TX_INP}"></div>
      </div>
    </details>
    ${configured ? '' : '<p class="text-[11px] text-amber-600 dark:text-amber-400 mt-2">Automatic submission isn\'t switched on for this server yet — your details are saved and will be submitted once it is.</p>'}
    <button onclick="textingSubmitA2p(this)" class="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg">Verify my business</button>
  </div>`;
}

// The status view once verification has been submitted: a 4-step progress line and
// a Refresh that polls Twilio for the latest approval state.
function textingA2pStages(stage, status, s) {
  const steps = ['Submitted', 'In review', 'Approved', 'Active'];
  const dot = (i) => {
    const done = stage > i, cur = stage === i + 1;
    const cls = done ? 'bg-emerald-500 text-white' : cur ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500';
    return `<div class="flex items-center gap-2">
      <span class="w-5 h-5 rounded-full text-[11px] font-black grid place-items-center ${cls}">${done ? '&#10003;' : i + 1}</span>
      <span class="text-[12px] ${done || cur ? 'text-slate-800 dark:text-slate-100 font-bold' : 'text-slate-400'}">${steps[i]}</span>
    </div>`;
  };
  const msg = status === 'error'
    ? 'Something needs attention with your submission — check your legal name and tax ID and re-submit.'
    : status === 'active'
      ? 'Your dealership is verified and texting at full volume. Additional numbers attach automatically.'
      : status === 'approved'
        ? 'Your business is approved — activating your messaging campaign now.'
        : 'Your verification is with the carriers. This usually takes a few business days; no action needed.';
  return `<div class="border-t border-slate-100 dark:border-slate-800 pt-3">
    <div class="text-sm font-black text-slate-900 dark:text-white mb-3">Messaging Verification</div>
    <div class="flex flex-wrap gap-x-5 gap-y-2 mb-3">${[0, 1, 2, 3].map(dot).join('')}</div>
    <p class="text-xs text-slate-500 dark:text-slate-400">${msg}</p>
    <div class="flex gap-2 mt-3">
      <button onclick="textingRefreshA2p(this)" class="text-[12px] font-bold text-indigo-600 dark:text-indigo-400">Refresh status</button>
      ${status === 'error' ? '<button onclick="textingRestartA2p()" class="text-[12px] font-bold text-slate-500">Edit details</button>' : ''}
    </div>
  </div>`;
}
window.textingSearch = async (btn) => {
  const country = document.getElementById('tx-country')?.value || 'US';
  const region = (document.getElementById('tx-region')?.value || '').trim();
  const city = (document.getElementById('tx-city')?.value || '').trim();
  const area = (document.getElementById('tx-area')?.value || '').trim();
  const box = document.getElementById('tx-results'); if (box) box.innerHTML = '<div class="text-sm text-slate-400 italic py-2">Searching…</div>';
  try {
    const r = await apiGetJson(`/integrations/twilio/provision/search?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}&area=${encodeURIComponent(area)}`);
    const rows = (r.numbers || []).map(n => `<div class="flex items-center gap-3 px-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
        <div class="flex-1"><div class="font-bold text-sm text-slate-800 dark:text-slate-100">${esc(n.number)}</div><div class="text-[12px] text-slate-500">${esc([n.locality, n.region].filter(Boolean).join(', '))}</div></div>
        <button onclick="textingProvision('${esc(n.number)}', this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold px-3 py-1.5 rounded-lg">Use this number</button>
      </div>`).join('');
    if (box) box.innerHTML = rows ? `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-1">${rows}</div>` : '<div class="text-sm text-slate-400 italic py-2">No numbers found — try a different city, province/state or area code.</div>';
  } catch (e) { if (box) box.innerHTML = `<div class="text-sm text-rose-500 py-2">${esc(e.message || 'Search failed')}</div>`; }
};
window.textingProvision = async (number, btn) => {
  if (!confirm(`Provision ${number} as your dealership texting number?`)) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Provisioning…'; }
  try { await apiSendJson('/integrations/twilio/provision/buy', 'POST', { number }); showToast('Number provisioned — you can now text from it', 'success'); await loadTextingStatus(); }
  catch (e) { showToast(e.message || 'Could not provision', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Use this number'; } }
};
window.textingSubmitA2p = async (btn) => {
  const val = (id) => document.getElementById(id)?.value.trim() || '';
  const payload = {
    legal_name: val('a2p-legal'), tax_id: val('a2p-tax'),
    address: val('a2p-address'), website: val('a2p-website'),
    email: val('a2p-email'), phone: val('a2p-phone'),
    contact_name: val('a2p-contact'), contact_title: val('a2p-title'),
  };
  if (!payload.legal_name || !payload.tax_id) return showToast('Legal business name and tax ID are required', 'error');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  try {
    const r = await apiSendJson('/integrations/twilio/a2p', 'POST', payload);
    showToast(r.configured ? 'Business submitted for verification' : 'Details saved — we\'ll submit when verification is switched on', 'success');
    await loadTextingStatus();
  }
  catch (e) { showToast(e.message || 'Could not submit', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Verify my business'; } }
};
window.textingRefreshA2p = async (btn) => {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  try { await apiSendJson('/integrations/twilio/a2p/refresh', 'POST', {}); await loadTextingStatus(); }
  catch (e) { showToast(e.message || 'Could not refresh', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Refresh status'; } }
};
// Drop back to the editable form after a failed submission.
window.textingRestartA2p = () => {
  if (__texting.status) { __texting.status.a2p_status = 'not_started'; renderTexting(); }
};
window.textingRelease = async () => {
  if (!confirm('Release this texting number? Automated texts will stop until you provision a new one.')) return;
  try { await apiSendJson('/integrations/twilio/provision/release', 'POST', {}); showToast('Number released', 'success'); await loadTextingStatus(); }
  catch (e) { showToast(e.message || 'Could not release', 'error'); }
};

// MarketSync owner's Settings → Team = SaaS staff + roles (owner/sales/support/
// marketing/developer) with the permission matrix — not a dealership sales team.
// Renders into #settings-team, hiding the dealer team markup while active.
async function renderSettingsSaasRoles() {
  const host = document.getElementById('settings-team'); if (!host) return;
  Array.from(host.children).forEach(c => { if (c.id !== 'settings-saas-roles') c.classList.add('hidden'); });
  let panel = document.getElementById('settings-saas-roles');
  if (!panel) { panel = document.createElement('div'); panel.id = 'settings-saas-roles'; host.prepend(panel); }
  panel.classList.remove('hidden');
  panel.innerHTML = `<div class="text-sm text-slate-400 py-6 text-center">Loading team…</div>`;
  let d;
  try { d = await apiGetJson('/saas/employees'); }
  catch (e) { panel.innerHTML = `<div class="text-sm text-rose-500 py-6 text-center">${esc(e.message || 'Could not load team.')}</div>`; return; }
  const roles = d.roles || [], matrix = d.permissions_matrix || {};
  const staff = (d.staff || []).map(s => `
    <tr class="border-t border-slate-100 dark:border-slate-800">
      <td class="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">${esc(s.name)}</td>
      <td class="px-3 py-2"><select onchange="saasSetRole('${s.id}', this.value)" class="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px]">${empRoleOpts(roles, s.saas_role)}</select></td>
      <td class="px-3 py-2 text-[11px] text-slate-400">${(s.permissions || []).map(p => esc(p)).join(', ')}</td>
      <td class="px-3 py-2 text-right"><button onclick="saasSetRole('${s.id}','')" class="text-[11px] font-bold text-rose-500 hover:text-rose-600">Remove</button></td>
    </tr>`).join('') || `<tr><td colspan="4" class="px-3 py-8 text-center text-slate-400 text-sm">No staff yet — add one by email below.</td></tr>`;
  const matrixRows = roles.map(r => `
    <div class="flex flex-wrap items-start gap-2 py-1.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      <span class="w-24 flex-shrink-0 text-[12px] font-black uppercase text-slate-600 dark:text-slate-300">${esc(r)}</span>
      <span class="flex flex-wrap gap-1">${(matrix[r] || []).map(p => `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${p === '*' ? 'ALL' : esc(p)}</span>`).join('')}</span>
    </div>`).join('');
  panel.innerHTML = `
    <div class="mb-3"><h3 class="text-sm font-black text-slate-800 dark:text-slate-100">MarketSync team &amp; roles</h3>
      <p class="text-[12px] text-slate-500 dark:text-slate-400">Your staff and what each SaaS role can do. Owner-only.</p></div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
      <table class="w-full text-sm min-w-[560px]">
        <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400"><th class="px-3 py-2">Name</th><th class="px-3 py-2">Role</th><th class="px-3 py-2">Permissions</th><th class="px-3 py-2"></th></tr></thead>
        <tbody>${staff}</tbody>
      </table>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-2 mt-3">
      <div><label class="text-[11px] text-slate-400 font-bold">Add staff by email</label><input id="saas-emp-email" placeholder="teammate@marketsync.link" class="w-64 mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
      <div><label class="text-[11px] text-slate-400 font-bold">Role</label><select id="saas-emp-role" class="mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">${empRoleOpts(roles, 'support')}</select></div>
      <button onclick="saasAddEmployee()" class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition">Add</button>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mt-3">
      <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Permission matrix</div>${matrixRows}
    </div>`;
}
window.renderSettingsSaasRoles = renderSettingsSaasRoles;

// ── Integrations Hub ─────────────────────────────────────────────────────────
// Lists every connectable service. "Webhooks" is the live outbound glue — a dealer
// pastes a URL + optional signing secret and picks which events to send; the rest
// are the gated F&I / accounting rails, shown as coming-soon until certified.
let __integrationsCache = null;
async function loadIntegrations() {
  const host = document.getElementById('integrations-list');
  if (!host) return;
  host.innerHTML = '<div class="py-10 text-center text-sm text-slate-400 italic">Loading…</div>';
  try {
    const data = await apiGetJson('/integrations', { retries: 1 });
    __integrationsCache = data;
    renderIntegrations(data);
  } catch (e) {
    host.innerHTML = `<div class="py-8 text-center text-sm text-rose-500">${esc(e.message || 'Could not load integrations')}</div>`;
  }
}
// A coloured badge + glyph per provider (CSP-safe emoji — no external logos).
const INTEGRATION_ICONS = {
  webhook:         { emoji: '', bg: 'bg-violet-100 dark:bg-violet-950/40' },
  twilio:          { emoji: '', bg: 'bg-rose-100 dark:bg-rose-950/40' },
  quickbooks:      { emoji: '', bg: 'bg-emerald-100 dark:bg-emerald-950/40' },
  xero:            { emoji: '', bg: 'bg-sky-100 dark:bg-sky-950/40' },
  google_business: { emoji: '⭐', bg: 'bg-amber-100 dark:bg-amber-950/40' },
  carfax:          { emoji: '', bg: 'bg-indigo-100 dark:bg-indigo-950/40' },
  routeone:        { emoji: '', bg: 'bg-slate-100 dark:bg-slate-800' },
  dealertrack:     { emoji: '', bg: 'bg-slate-100 dark:bg-slate-800' },
  stripe_deposits: { emoji: '', bg: 'bg-indigo-100 dark:bg-indigo-950/40' },
  square_deposits: { emoji: '◼', bg: 'bg-slate-100 dark:bg-slate-800' },
};
function integrationIcon(provider) {
  const i = INTEGRATION_ICONS[provider] || { emoji: '', bg: 'bg-slate-100 dark:bg-slate-800' };
  return `<div class="w-10 h-10 rounded-lg ${i.bg} flex items-center justify-center text-xl flex-shrink-0" aria-hidden="true">${i.emoji}</div>`;
}
// Short human blurb per category so the section reads as a map, not a dump.
const CATEGORY_BLURB = {
  Automation: 'Push MarketSync events anywhere — Zapier, Make, or your own app.',
  Payments: 'Take online deposits straight into your own account.',
  Messaging: 'Send texts from your own number.',
  Accounting: 'Sync sold-deal and F&I income to your books.',
  'F&I': 'Credit and vehicle-history rails — stage your credentials now; live pull activates once certified.',
  Marketing: 'Reviews, listings, and your online presence.',
  Other: '',
};
function renderIntegrations(data) {
  const host = document.getElementById('integrations-list');
  if (!host) return;
  const providers = data.providers || [];
  const events = data.webhook_events || [];
  const connected = providers.filter(p => isIntegrationConnected(p)).length;
  const liveAvail = providers.filter(p => p.live).length;
  // Group by category, in a sensible order.
  const order = ['Automation', 'Payments', 'Messaging', 'Accounting', 'Marketing', 'F&I', 'Other'];
  const byCat = {};
  providers.forEach(p => { (byCat[p.category] = byCat[p.category] || []).push(p); });
  const cats = Object.keys(byCat).sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  // Within a category: live first, then connected first.
  const rank = p => (p.live ? 0 : 10) + (isIntegrationConnected(p) ? -1 : 0);
  const summary = `<div class="flex items-center gap-4 mb-4 text-xs">
    <span class="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>${connected} connected</span>
    <span class="inline-flex items-center gap-1.5 font-semibold text-slate-500 dark:text-slate-400"><span class="w-2 h-2 rounded-full bg-slate-400"></span>${liveAvail} available to connect</span>
  </div>`;
  host.innerHTML = summary + `<div id="social-connections-card" class="mb-6"></div>` + cats.map(cat => `
    <div class="mb-6">
      <div class="mb-2">
        <h3 class="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">${esc(cat)}</h3>
        ${CATEGORY_BLURB[cat] ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">${esc(CATEGORY_BLURB[cat])}</p>` : ''}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">${byCat[cat].slice().sort((a, b) => rank(a) - rank(b)).map(p => {
        const card = p.provider === 'webhook' ? webhookCard(p, events) : p.provider === 'twilio' ? twilioCard(p) : p.provider === 'google_business' ? googleBusinessCard(p) : p.provider === 'square_deposits' ? squareCard(p) : (p.deposits && p.live) ? depositsCard(p) : (p.oauth && p.live) ? oauthCard(p) : (p.manual && Array.isArray(p.fields)) ? fniCredsCard(p) : providerCard(p);
        // Grey out anything not set up yet; full colour on hover so it's still usable.
        const inner = isIntegrationConnected(p) ? card : `<div class="opacity-60 hover:opacity-100 transition-opacity h-full">${card}</div>`;
        return `<div data-provider="${esc(p.provider)}" class="h-full">${inner}</div>`;   // anchor for guided-setup focus
      }).join('')}</div>
    </div>`).join('');
  if (!data.pii_ready) {
    host.insertAdjacentHTML('afterbegin', `<div class="mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">Encryption key not set — signing secrets and credentials can't be stored until <code>PII_ENCRYPTION_KEY</code> is configured on the server.</div>`);
  }
  // Calendar sync (Google / Outlook) — its own card at the top, loaded async.
  host.insertAdjacentHTML('afterbegin', '<div id="calsync-card" class="mb-6"></div>');
  loadCalendarSyncCard();
  loadSocialConnectionsCard();
  // Outbound listing syndication (AutoTrader / Trader.ca / Kijiji / Google) — a feed
  // card the dealer hands to each platform. Loaded async so the hub renders instantly.
  host.insertAdjacentHTML('beforeend', '<div id="synd-card" class="mb-6"></div>');
  loadSyndicationCard();
  // Guided setup sent us here to finish a specific integration — scroll to + flash it.
  if (typeof focusIntegrationCard === 'function') focusIntegrationCard();
}
async function loadSocialConnectionsCard() {
  const host = document.getElementById('social-connections-card'); if (!host) return;
  try {
    const { accounts = [] } = await apiGetJson('/social/accounts', { retries: 1 });
    const providers = ['facebook', 'tiktok', 'youtube', 'linkedin'];
    host.innerHTML = `<div class="mb-2"><h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Social</h3><p class="text-[11px] text-slate-400 mt-0.5">Connect a provider, choose the Page, professional account or channel, and keep its authorization encrypted on MarketSync.</p></div><div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"><div class="grid grid-cols-1 md:grid-cols-2 gap-2">${providers.map(provider => { const rows = accounts.filter(a => a.provider === provider); return `<div class="flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"><div class="min-w-0"><div class="text-sm font-bold text-slate-900 dark:text-white capitalize">${provider === 'youtube' ? 'Google / YouTube' : provider}</div><div class="text-[11px] text-slate-500 truncate">${rows.length ? rows.map(a => esc(a.display_name)).join(', ') : 'Not connected'}</div></div><button onclick="connectSocialProvider('${provider}', this)" class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg ${rows.length ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' : 'bg-indigo-600 text-white'}">${rows.length ? 'Add / reconnect' : 'Connect'}</button></div>` }).join('')}</div></div>`;
  } catch (e) { host.innerHTML = `<div class="text-xs text-rose-500">${esc(e.message || 'Could not load social connections')}</div>`; }
}
async function connectSocialProvider(provider, btn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = 'Opening…';
  try { const d = await apiGetJson(`/social/connect/${provider}`, { retries: 1 }); if (!d.url) throw new Error('Provider is not configured yet.'); window.location.href = d.url; }
  catch (e) { btn.disabled = false; btn.textContent = old; showToast(e.message || 'Could not start connection', 'error'); }
}
async function selectSocialConnection(sessionId, accountId) {
  try { await apiSendJson(`/social/oauth/sessions/${encodeURIComponent(sessionId)}/select`, 'POST', { external_account_id: accountId }); showToast('Social account connected', 'success'); loadIntegrations(); }
  catch (e) { showToast(e.message || 'Could not finish connection', 'error'); }
}
window.connectSocialProvider = connectSocialProvider;
window.selectSocialConnection = selectSocialConnection;
let __syndCfg = null;
async function loadSyndicationCard() {
  const host = document.getElementById('synd-card'); if (!host) return;
  let cfg; try { cfg = await apiGetJson('/syndication/config', { retries: 1 }); } catch { host.remove(); return; }
  __syndCfg = cfg;
  const copyBtn = (url) => `<button onclick="copySyndUrl(this,'${esc(url)}')" class="shrink-0 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 rounded-lg">Copy</button>`;
  const row = (label, url) => `<div class="flex items-center gap-2">
      <span class="text-[11px] font-bold uppercase tracking-wide text-slate-400 w-10">${label}</span>
      <input readonly value="${esc(url)}" onclick="this.select()" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-300">
      ${copyBtn(url)}
      <a href="${esc(url)}" target="_blank" rel="noopener" class="shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 px-1">Open</a>
    </div>`;
  const body = cfg.ready
    ? `<div class="space-y-2">
         <p class="text-xs text-slate-500 dark:text-slate-400">Give these live feed links to AutoTrader, Trader.ca, Kijiji Autos or Google — they pull your ${cfg.vehicle_count} in-stock ${cfg.vehicle_count === 1 ? 'vehicle' : 'vehicles'} automatically and stay in sync (${esc(cfg.currency)} pricing). Updates every time a car is added, sold or repriced.</p>
         ${row('CSV', cfg.csv_url)}
         ${row('XML', cfg.xml_url)}
         ${cfg.google_url ? row('Google', cfg.google_url) : ''}
         <p class="text-[11px] text-slate-400 dark:text-slate-500">Most classifieds accept the CSV or XML. Use the <b>Google</b> feed for Google Merchant Center / Vehicle ads.</p>
         <div class="pt-1">
           <div class="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Step-by-step setup</div>
           <div class="flex flex-wrap gap-1.5">
             ${['autotrader', 'cargurus', 'kijiji', 'google', 'facebook'].map(p => `<button onclick="syndicationGuide('${p}')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg transition">${SYND_GUIDES[p].name} →</button>`).join('')}
           </div>
         </div>
       </div>`
    : `<div class="space-y-2.5">
         <p class="text-xs text-slate-500 dark:text-slate-400">A syndication feed is one live web link that holds all your in-stock vehicles. You paste it into AutoTrader, Kijiji, Google and the rest <b>once</b> — from then on they pull straight from MarketSync, so every new car, price change and sold unit updates on those sites automatically. No re-listing, no double entry.</p>
         <div class="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
           <b class="text-slate-600 dark:text-slate-300">To switch it on:</b> the feed link is built from your public website address, so publish your MarketSync site first. Go to <b>Website</b> in the left menu, pick your address, and hit Publish — this card turns into live feed links the moment you do.
         </div>
         <button onclick="switchPage('website')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition">Set up my website →</button>
       </div>`;
  host.innerHTML = `
    <div class="mb-2">
      <h3 class="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Listing Syndication</h3>
      <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Push your inventory to the big classifieds via a feed — no re-keying, always current.</p>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center text-xl shrink-0" aria-hidden="true"></div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">Inventory feed</span>${cfg.ready ? '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Live</span>' : '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Set up website</span>'}</div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AutoTrader · Trader.ca · Kijiji Autos · Google vehicle listings</p>
        </div>
      </div>
      ${body}
    </div>`;
}
async function copySyndUrl(btn, url) {
  try { await navigator.clipboard.writeText(url); const t = btn.textContent; btn.textContent = 'Copied '; setTimeout(() => btn.textContent = t, 1400); }
  catch { showToast('Copy failed — select the text and copy manually', 'error'); }
}
window.copySyndUrl = copySyndUrl;

// Per-platform step-by-step setup for the syndication feeds. `feed` = which of the
// dealer's feed URLs to hand that platform; `link` opens the platform's portal.
const SYND_GUIDES = {
  autotrader: {
    name: 'AutoTrader', emoji: '', feed: 'xml', link: 'https://www.autotrader.ca/dealers/',
    intro: 'AutoTrader / Trader.ca pulls your inventory from a feed URL managed by your account rep.',
    steps: [
      'Copy your <b>XML feed URL</b> below.',
      'Sign in to your AutoTrader / Trader Portal dealer account (or email your AutoTrader account rep).',
      'Go to <b>Inventory → Feeds</b> (or ask your rep to add a new inventory feed source).',
      'Paste your XML feed URL as the source and set the fetch to <b>daily</b>.',
      'Save. Your first sync usually appears within 24 hours, then stays current automatically.',
    ],
    note: 'No feed option in your portal? Email the URL to your AutoTrader rep — they can onboard it for you.',
  },
  cargurus: {
    name: 'CarGurus', emoji: '', feed: 'csv', link: 'https://www.cargurus.com/Cars/dealers/',
    intro: 'CarGurus ingests inventory from a daily feed — add it in the Dealer Dashboard or send it to onboarding.',
    steps: [
      'Copy your <b>CSV feed URL</b> below.',
      'Sign in to the <b>CarGurus Dealer Dashboard</b>.',
      'Open <b>Inventory → Inventory settings / Data feed</b>.',
      'Add a new feed source and paste your CSV feed URL (schedule: daily).',
      'Save — or email the URL to CarGurus dealer onboarding and they’ll validate + ingest it.',
    ],
    note: 'CarGurus validates the first feed manually; it can take a business day to appear.',
  },
  kijiji: {
    name: 'Kijiji Autos', emoji: '', feed: 'xml', link: 'https://www.kijijiautos.ca/',
    intro: 'Kijiji Autos onboards dealer inventory through a feed via your Kijiji account manager.',
    steps: [
      'Copy your <b>XML feed URL</b> below.',
      'Contact your Kijiji Autos account manager (or Kijiji dealer support).',
      'Give them your XML feed URL as your inventory feed source.',
      'They configure a daily pull — your live inventory then flows in automatically.',
    ],
    note: 'Kijiji Autos feeds are set up by their team; there isn’t a self-serve feed box today.',
  },
  google: {
    name: 'Google Vehicle Listings', emoji: '', feed: 'google', link: 'https://merchants.google.com/',
    intro: 'Google Merchant Center / Vehicle ads pull a scheduled feed you add yourself.',
    steps: [
      'Copy your <b>Google feed URL</b> below.',
      'Open <b>Google Merchant Center</b> (create a free account if you don’t have one).',
      'Go to <b>Products → Feeds → +</b> to add a primary feed.',
      'Choose <b>Scheduled fetch</b>, paste your Google feed URL, and set it to fetch <b>daily</b>.',
      'Save. Google validates the feed, then your vehicles appear in Vehicle listings.',
    ],
    note: 'Vehicle ads may require enabling the vehicle-listings program in Merchant Center for your region.',
  },
  facebook: {
    name: 'Facebook Marketplace', emoji: '', feed: null, link: 'https://marketsync.link/facebook-marketplace-poster.html',
    intro: 'Facebook Marketplace works through the MarketSync Chrome extension — no feed needed.',
    steps: [
      'Install the <b>MarketSync Chrome extension</b> (top-right “Install extension”).',
      'Open Facebook Marketplace and click the extension.',
      'Pick a vehicle — title, price, photos and description fill in automatically.',
      'Click <b>Post</b>. MarketSync tracks who posted and who sold for the leaderboard.',
    ],
    note: 'This is the one channel that isn’t a feed — Facebook doesn’t allow automated dealer feeds for Marketplace.',
  },
};
function syndicationGuide(key) {
  const g = SYND_GUIDES[key]; if (!g) return;
  const cfg = __syndCfg || {};
  const feedUrl = g.feed ? cfg[g.feed + '_url'] : null;
  const steps = g.steps.map((s, i) => `<li class="flex gap-2.5"><span class="shrink-0 w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">${i + 1}</span><span class="text-sm text-slate-700 dark:text-slate-200 pt-0.5">${s}</span></li>`).join('');
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1">
      <div class="text-lg font-black text-slate-900 dark:text-white">${g.emoji} Add your inventory to ${esc(g.name)}</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">${esc(g.intro)}</p>
    ${feedUrl ? `<div class="flex items-center gap-2 mb-4">
      <input readonly value="${esc(feedUrl)}" onclick="this.select()" class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-600 dark:text-slate-300">
      <button onclick="copySyndUrl(this,'${esc(feedUrl)}')" class="shrink-0 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Copy feed URL</button>
    </div>` : ''}
    <ol class="space-y-2.5">${steps}</ol>
    ${g.note ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-4 border-t border-slate-100 dark:border-slate-800 pt-3"> ${esc(g.note)}</p>` : ''}
    <div class="mt-4"><a href="${esc(g.link)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg">Open ${esc(g.name)} →</a></div>
  </div>`, 'max-w-lg');
}
window.syndicationGuide = syndicationGuide;
// ── Calendar sync card (Google Calendar / Outlook) ──────────────────────────
async function loadCalendarSyncCard() {
  const host = document.getElementById('calsync-card');
  if (!host) return;
  let data;
  try { data = await apiGetJson('/calendar/status', { retries: 1 }); }
  catch { host.remove(); return; }

  const providerIcons = {
    google: { emoji: '', bg: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600' },
    microsoft: { emoji: '', bg: 'bg-sky-100 dark:bg-sky-950/40 text-sky-600' }
  };

  const cards = (data.providers || []).map(p => {
    let actionBtn;
    if (!p.configured) {
      actionBtn = '<span class="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Setup pending</span>';
    } else if (p.connected) {
      actionBtn = `<button onclick="calDisconnect('${p.provider}')" class="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-1.5 rounded-lg transition border border-rose-200 dark:border-rose-900">Disconnect</button>`;
    } else {
      actionBtn = `<button onclick="calConnect('${p.provider}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg shadow transition">Connect</button>`;
    }

    const sub = p.connected
      ? `Connected${p.account ? ' · ' + esc(p.account) : ''}${p.last_synced_at ? ' · synced ' + new Date(p.last_synced_at).toLocaleDateString('en-US') : ''}`
      : p.configured ? 'Two-way sync for your appointments' : 'Built and ready — switches on once server keys are set.';

    const ic = providerIcons[p.provider] || { emoji: '', bg: 'bg-blue-100 dark:bg-blue-950/40 text-blue-600' };

    return `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-sm hover:border-indigo-500 transition">
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <div class="w-10 h-10 rounded-xl ${ic.bg} flex items-center justify-center text-xl shrink-0 font-bold shadow-inner">
              ${ic.emoji}
            </div>
            ${p.connected ? '<span class="text-[10px] font-black uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">Connected</span>' : ''}
          </div>
          <h4 class="font-black text-sm text-slate-900 dark:text-white leading-tight">${esc(p.label)}</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">${sub}</p>
        </div>

        <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span class="text-[10px] font-bold text-slate-400">Two-Way Sync</span>
          <div>${actionBtn}</div>
        </div>
      </div>
    `;
  }).join('');

  const anyConnected = (data.providers || []).some(p => p.connected);

  host.innerHTML = `
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Calendar Sync</h3>
        <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Appointments booked in MarketSync appear on your calendar, and events flow back in both directions.</p>
      </div>
      ${anyConnected ? `
        <button onclick="calSyncNow(this)" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg transition shadow-sm">
           Sync Now
        </button>
      ` : ''}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${cards}
    </div>
  `;
}
async function calConnect(provider) {
  try {
    const d = await apiGetJson(`/calendar/connect/${provider}`, { retries: 1 });
    if (d.url) window.location.href = d.url;   // hand off to the provider's consent screen
  } catch (e) { showToast(e.message || 'Could not start the connection', 'error'); }
}
async function calDisconnect(provider) {
  if (!confirm('Disconnect this calendar? Existing events stay put; new appointments just stop syncing.')) return;
  try { await apiSendJson(`/calendar/disconnect/${provider}`, 'POST'); showToast('Calendar disconnected', 'success'); loadCalendarSyncCard(); }
  catch (e) { showToast(e.message || 'Could not disconnect', 'error'); }
}
async function calSyncNow(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Syncing…';
  try {
    const r = await apiSendJson('/calendar/sync-now', 'POST');
    const t = (r.results || []).reduce((a, x) => ({ i: a.i + (x.imported || 0), u: a.u + (x.updated || 0), c: a.c + (x.cancelled || 0) }), { i: 0, u: 0, c: 0 });
    showToast(`Synced — ${t.i} new, ${t.u} updated, ${t.c} cancelled`, 'success');
    loadCalendarSyncCard();
  } catch (e) { showToast(e.message || 'Sync failed', 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
window.calConnect = calConnect;
window.calDisconnect = calDisconnect;
window.calSyncNow = calSyncNow;

function isIntegrationConnected(p) {
  if (!p.enabled) return false;
  const m = p.lender_code_map || {};
  // Connected when a secret is stored OR the non-secret config that makes it work is set.
  return !!(p.configured || m.url || m.from || m.realm_id || m.tenant_id || m.connected_at || (m.account_id && m.charges_enabled));
}
function statusPill(p) {
  if (isIntegrationConnected(p)) return '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Connected</span>';
  if (p.live) return '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">Available</span>';
  if (p.manual) return '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">Manual mode</span>';
  return '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Coming soon</span>';
}
function providerCard(p) {
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex items-start gap-3">
    ${integrationIcon(p.provider)}
    <div class="min-w-0">
      <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
    </div>
  </div>`;
}
// Manual-mode credential card for the gated F&I rails (Carfax / RouteOne /
// Dealertrack). The dealer stages credentials now — stored encrypted, used in
// manual/export mode today, flipping to a native pull once we're DSP-certified.
// Secret fields never come back from the server (we only learn `configured`).
function fniCredsCard(p) {
  const cfg = p.lender_code_map || {};
  const fields = (p.fields || []).map(f => {
    const id = `fni-${p.provider}-${f.key}`;
      if (f.secret) {
        const ph = p.configured ? '•••••••• (saved — leave blank to keep)' : (f.placeholder || '');
        return `<div>
          <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">${esc(f.label)}</label>
          <div class="relative w-full">
            <input id="${id}" data-secret="1" type="password" autocomplete="off" placeholder="${esc(ph)}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
          </div>
        </div>`;
      }
    return `<div>
      <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">${esc(f.label)}</label>
      <input id="${id}" data-secret="0" type="text" autocomplete="off" value="${esc(cfg[f.key] || '')}" placeholder="${esc(f.placeholder || '')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
    </div>`;
  }).join('');
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4" data-fni="${esc(p.provider)}">
    <div class="flex items-start gap-3 mb-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
        ${isIntegrationConnected(p) && cfg.connected_at ? `<p class="text-[11px] text-slate-400 mt-1">Credentials stored ${new Date(cfg.connected_at).toLocaleDateString()}.</p>` : ''}
      </div>
      <label class="inline-flex items-center cursor-pointer flex-shrink-0">
        <input id="fni-${esc(p.provider)}-enabled" type="checkbox" class="sr-only peer" ${p.enabled ? 'checked' : ''}>
        <div class="relative w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 rounded-full transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4"></div>
      </label>
    </div>
    <div class="space-y-2.5">
      ${fields}
      <div class="flex items-center gap-2 pt-1">
        <button onclick="saveFniCreds('${esc(p.provider)}', this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save</button>
        ${p.configured || p.enabled ? `<button onclick="disconnectOAuth('${esc(p.provider)}', '${esc(p.label)}', this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>` : ''}
      </div>
      <p class="text-[11px] text-amber-600 dark:text-amber-400/90">Stored securely (encrypted). Used in manual/export mode today — MarketSync flips this to a native in-deal pull the moment we're certified with ${esc(p.label)}, with no re-entry needed.</p>
    </div>
  </div>`;
}
async function saveFniCreds(provider, btn) {
  const card = btn.closest('[data-fni]'); if (!card) return;
  const enabled = !!card.querySelector(`#fni-${provider}-enabled`)?.checked;
  const lender_code_map = {}; const credentials = {};
  card.querySelectorAll('input[data-secret]').forEach(el => {
    const key = el.id.replace(`fni-${provider}-`, '');
    const val = (el.value || '').trim();
    if (el.dataset.secret === '1') { if (val) credentials[key] = val; }
    else lender_code_map[key] = val;
  });
  // Keep the connected date once creds exist so the card can show it.
  const already = (__integrationsCache?.providers || []).find(x => x.provider === provider);
  const hasSecret = already?.configured || Object.keys(credentials).length;
  if (enabled && !hasSecret) return showToast('Enter your credentials before enabling.', 'error');
  if (hasSecret && !lender_code_map.connected_at) lender_code_map.connected_at = (already?.lender_code_map?.connected_at) || new Date().toISOString();
  const payload = { enabled, lender_code_map };
  if (Object.keys(credentials).length) payload.credentials = credentials;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson(`/integrations/${provider}`, 'PUT', payload);
    btn.textContent = 'Saved '; showToast('Credentials saved', 'success');
    setTimeout(() => loadIntegrations(), 700);
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
window.saveFniCreds = saveFniCreds;
function webhookCard(p, events) {
  const cfg = p.lender_code_map || {};
  const url = cfg.url || '';
  const subscribed = Array.isArray(cfg.events) ? cfg.events : [];
  const evBoxes = events.map(ev => {
    const on = !subscribed.length || subscribed.includes(ev);
    return `<label class="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mr-3 mb-1">
      <input type="checkbox" class="wh-ev accent-indigo-600" value="${esc(ev)}" ${on ? 'checked' : ''}> ${esc(ev)}</label>`;
  }).join('');
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3 mb-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
      </div>
      <label class="inline-flex items-center cursor-pointer flex-shrink-0">
        <input id="wh-enabled" type="checkbox" class="sr-only peer" ${p.enabled ? 'checked' : ''}>
        <div class="relative w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 rounded-full transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4"></div>
      </label>
    </div>
    <div class="space-y-2.5">
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Endpoint URL</label>
        <input id="wh-url" type="url" value="${esc(url)}" placeholder="https://hooks.zapier.com/…" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Signing secret <span class="font-normal text-slate-400">(optional — signs each request as <code>X-MarketSync-Signature</code>)</span></label>
        <div class="relative w-full">
          <input id="wh-secret" type="password" placeholder="${p.configured ? '•••••••• (saved — leave blank to keep)' : 'Leave blank for none'}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Events to send</label>
        <div>${evBoxes}</div>
      </div>
      <div class="flex items-center gap-2 pt-1">
        <button onclick="saveWebhook(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save</button>
        <button onclick="testWebhook(this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Send test</button>
        ${p.configured || p.enabled ? '<button onclick="disconnectWebhook(this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>' : ''}
      </div>
    </div>
  </div>`;
}
async function saveWebhook(btn) {
  const url = (document.getElementById('wh-url')?.value || '').trim();
  const secret = (document.getElementById('wh-secret')?.value || '').trim();
  const enabled = !!document.getElementById('wh-enabled')?.checked;
  const all = [...document.querySelectorAll('.wh-ev')];
  const checked = all.filter(c => c.checked).map(c => c.value);
  // Empty list = all events; only send a subset when the user unchecked some.
  const evs = checked.length === all.length ? [] : checked;
  if (enabled && !/^https?:\/\//i.test(url)) return showToast('Enter a valid https:// URL', 'error');
  const payload = { enabled, lender_code_map: { url, events: evs } };
  if (secret) payload.credentials = { secret };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/integrations/webhook', 'PUT', payload);
    btn.textContent = 'Saved '; showToast('Webhook saved', 'success');
    setTimeout(() => loadIntegrations(), 700);
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
async function testWebhook(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await apiSendJson('/integrations/webhook/test', 'POST', {});
    btn.textContent = 'Sent '; showToast('Test event sent to your endpoint', 'success');
  } catch (e) { showToast(e.message || 'Could not send test — save & enable a URL first', 'error'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
}
async function disconnectWebhook(btn) {
  if (!confirm('Disconnect this webhook? The URL and secret will be removed.')) return;
  btn.disabled = true;
  try { await apiSendJson('/integrations/webhook', 'DELETE'); showToast('Webhook disconnected', 'success'); loadIntegrations(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
// Twilio (bring-your-own account) — SID + token stored encrypted, from-number in
// lender_code_map. When connected, all automated texts send from the dealer's number.
function twilioCard(p) {
  const cfg = p.lender_code_map || {};
  const from = cfg.from || '';
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3 mb-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
      </div>
      <label class="inline-flex items-center cursor-pointer flex-shrink-0">
        <input id="tw-enabled" type="checkbox" class="sr-only peer" ${p.enabled ? 'checked' : ''}>
        <div class="relative w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-checked:bg-emerald-500 rounded-full transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4"></div>
      </label>
    </div>
    <div class="space-y-2.5">
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Account SID</label>
        <input id="tw-sid" type="text" autocomplete="off" placeholder="${p.configured ? '•••••••• (saved — leave blank to keep)' : 'ACxxxxxxxxxxxxxxxx'}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Auth Token</label>
        <div class="relative w-full">
          <input id="tw-token" type="password" autocomplete="off" placeholder="${p.configured ? '•••••••• (saved — leave blank to keep)' : 'Your Twilio auth token'}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        </div>
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">From number <span class="font-normal text-slate-400">(your Twilio number, E.164)</span></label>
        <input id="tw-from" type="tel" value="${esc(from)}" placeholder="+15195551234" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
      </div>
      <div class="flex items-center gap-2 pt-1">
        <button onclick="saveTwilio(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save</button>
        <button onclick="testTwilio(this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Send test text</button>
        ${p.configured || p.enabled ? '<button onclick="disconnectTwilio(this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>' : ''}
      </div>
      <p class="text-[11px] text-slate-400 dark:text-slate-500">Until you connect this, automated texts send from the shared MarketSync number.</p>
    </div>
  </div>`;
}
async function saveTwilio(btn) {
  const sid = (document.getElementById('tw-sid')?.value || '').trim();
  const token = (document.getElementById('tw-token')?.value || '').trim();
  const from = (document.getElementById('tw-from')?.value || '').trim();
  const enabled = !!document.getElementById('tw-enabled')?.checked;
  if (enabled && !from) return showToast('Enter your Twilio from-number', 'error');
  // SID + token both come as a pair; require both when setting for the first time.
  if ((sid && !token) || (!sid && token)) return showToast('Enter both the SID and the auth token', 'error');
  const payload = { enabled, lender_code_map: { from } };
  if (sid && token) payload.credentials = { account_sid: sid, auth_token: token };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/integrations/twilio', 'PUT', payload);
    btn.textContent = 'Saved '; showToast('Twilio settings saved', 'success');
    setTimeout(() => loadIntegrations(), 700);
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
async function testTwilio(btn) {
  const to = prompt('Send a test text to which number? (E.164, e.g. +15195551234)', '');
  if (!to) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
  try {
    await apiSendJson('/integrations/twilio/test', 'POST', { to: to.trim() });
    btn.textContent = 'Sent '; showToast('Test text sent', 'success');
  } catch (e) { showToast(e.message || 'Could not send — save & enable first', 'error'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
}
async function disconnectTwilio(btn) {
  if (!confirm('Disconnect Twilio? Automated texts will go back to the shared MarketSync number.')) return;
  btn.disabled = true;
  try { await apiSendJson('/integrations/twilio', 'DELETE'); showToast('Twilio disconnected', 'success'); loadIntegrations(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
// OAuth connector card (QuickBooks, Xero, Google Business). "Connect" bounces to the
// provider's consent screen; once linked we show when + Test / Disconnect. One set of
// handlers drives every OAuth provider via its `provider` key.
// Google Business Profile gets its own card: the standard OAuth connect flow (when
// the app is provisioned) PLUS an always-available AI post composer. The composer
// works in "assisted" mode today — write the post with AI, copy it, open Google
// Business — and flips to one-click publish the moment Google approves API access,
// mirroring how the F&I connectors stage credentials before certification.
function googleBusinessCard(p) {
  const connected = p.configured && p.enabled;
  const cfg = p.lender_code_map || {};
  // The AI post composer works today (assisted: write → copy → post), so this card
  // is never "coming soon". Pill reflects the real state: Connected, Available to
  // auto-publish (OAuth app provisioned), or Ready (composer/assisted posting).
  const pill = connected
    ? '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Connected</span>'
    : p.live
      ? '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">Available</span>'
      : '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">Ready</span>';
  let connectRow;
  if (!p.live) {
    connectRow = `<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-2">The AI post composer works right now — write a post and add it to Google Business in a couple of clicks. One-click auto-publish switches on once Google approves MarketSync's Business Profile access.</p>`;
  } else if (connected) {
    connectRow = `<div class="flex items-center gap-2 mt-3">
        <button onclick="testOAuth('${p.provider}', this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Test connection</button>
        <button onclick="disconnectOAuth('${p.provider}', '${esc(p.label)}', this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>
      </div>`;
  } else {
    connectRow = `<div class="flex items-center gap-2 mt-3">
        <button onclick="connectOAuth('${p.provider}', this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Connect ${esc(p.label)}</button>
      </div>`;
  }
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${pill}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
        ${connected && cfg.connected_at ? `<p class="text-[11px] text-slate-400 mt-1">Connected ${new Date(cfg.connected_at).toLocaleDateString()}.</p>` : ''}
        ${connectRow}
        <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button onclick="openGbpComposer()" class="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold px-4 py-2 rounded-lg transition"> Compose a post</button>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">Let AI write a Google Business post for a new arrival, a special, or a general update.</p>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Google Business post composer modal ─────────────────────────────────────────
async function openGbpComposer() {
  const gbLive = !!(__integrationsCache?.providers || []).find(p => p.provider === 'google_business' && p.configured && p.enabled);
  let inv = [];
  try { inv = await apiGetJson('/inventory/all', { retries: 1 }); } catch {}
  const vehOpts = (inv || [])
    .filter(v => String(v.status || 'available').toLowerCase() === 'available')
    .slice(0, 300)
    .map(v => `<option value="${v.id}">${esc([v.year, v.make, v.model, v.trim].filter(Boolean).join(' '))}${v.price ? ' — $' + Number(v.price).toLocaleString() : ''}</option>`).join('');
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1"><div class="text-lg font-black text-slate-900 dark:text-white"> Compose a Google Business post</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Let AI draft a post for your Google Business Profile, then publish or copy it over.</p>
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Post type</label>
          <select id="gbp-kind" class="${inp}">
            <option value="new_arrival">New arrival</option>
            <option value="special"> Special offer</option>
            <option value="update" selected>General update</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">About a vehicle (optional)</label>
          <select id="gbp-veh" class="${inp}">
            <option value="">— No specific vehicle —</option>${vehOpts}
          </select>
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400">Post text</label>
          <button onclick="gbpWrite(this)" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"> Write with AI</button>
        </div>
        <textarea id="gbp-text" rows="6" placeholder="Write your post, or hit “Write with AI” to draft one." class="${inp}"></textarea>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button onclick="gbpCopy(this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Copy text</button>
        <a href="https://business.google.com/posts" target="_blank" rel="noopener" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Open Google Business ↗</a>
        <button onclick="gbpPublish(this)" class="ml-auto bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold px-4 py-2 rounded-lg transition">${gbLive ? 'Publish to Google' : 'Publish'}</button>
      </div>
      <p class="text-[11px] text-slate-400 dark:text-slate-500">${gbLive ? 'Publishing posts straight to your connected Google Business Profile.' : 'One-click publish activates once Google approves API access. For now, “Publish” checks the connection — copy the text and paste it into Google Business.'}</p>
    </div>
  </div>`, 'max-w-lg');
}
async function gbpWrite(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Writing…';
  try {
    const d = await apiSendJson('/integrations/google_business/compose', 'POST', {
      kind: document.getElementById('gbp-kind')?.value || 'update',
      inventory_id: document.getElementById('gbp-veh')?.value || null,
    });
    if (d.text) { document.getElementById('gbp-text').value = d.text; showToast('Draft ready — tweak it and publish', 'success'); }
    else throw new Error('AI returned nothing');
  } catch (e) { showToast(e.message || 'Could not write the post', 'error'); }
  btn.disabled = false; btn.textContent = orig;
}
async function gbpCopy(btn) {
  const t = document.getElementById('gbp-text')?.value.trim();
  if (!t) { showToast('Write the post first', 'error'); return; }
  try { await navigator.clipboard.writeText(t); const o = btn.textContent; btn.textContent = 'Copied '; setTimeout(() => btn.textContent = o, 1400); }
  catch { showToast('Could not copy — select the text manually', 'error'); }
}
async function gbpPublish(btn) {
  const t = document.getElementById('gbp-text')?.value.trim();
  if (!t) { showToast('Write the post first', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    const d = await apiSendJson('/integrations/google_business/post', 'POST', { text: t });
    if (d.ok) { showToast('Posted to Google Business ', 'success'); btn.closest('.fixed')?.remove(); }
    else {
      // Staged fallback: copy the text and open Google Business for a manual paste.
      try { await navigator.clipboard.writeText(t); } catch {}
      showToast(d.reason ? d.reason + ' Text copied — paste it in Google Business.' : 'Text copied — paste it in Google Business.', 'info');
      window.open('https://business.google.com/posts', '_blank', 'noopener');
    }
  } catch (e) { showToast(e.message || 'Could not publish', 'error'); }
  btn.disabled = false; btn.textContent = orig;
}
window.openGbpComposer = openGbpComposer;
window.gbpWrite = gbpWrite;
window.gbpCopy = gbpCopy;
window.gbpPublish = gbpPublish;

function oauthCard(p) {
  const connected = p.configured && p.enabled;
  const cfg = p.lender_code_map || {};
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
        ${connected && cfg.connected_at ? `<p class="text-[11px] text-slate-400 mt-1">Connected ${new Date(cfg.connected_at).toLocaleDateString()}${cfg.tenant_name ? ' · ' + esc(cfg.tenant_name) : ''}.</p>` : ''}
        ${connected && p.category === 'Accounting' ? `
        <label class="flex items-center gap-2 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" ${cfg.autosync ? 'checked' : ''} onchange="toggleAccountingAutosync('${p.provider}', this)" class="rounded accent-indigo-600">
          Auto-post sold-deal income when a deal is delivered
        </label>` : ''}
        <div class="flex items-center gap-2 mt-3">
          ${connected
            ? `<button onclick="testOAuth('${p.provider}', this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Test connection</button>
               <button onclick="disconnectOAuth('${p.provider}', '${esc(p.label)}', this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>`
            : `<button onclick="connectOAuth('${p.provider}', this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Connect ${esc(p.label)}</button>`}
        </div>
      </div>
    </div>
  </div>`;
}
async function connectOAuth(provider, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Opening…';
  try {
    const d = await apiGetJson(`/integrations/${provider}/connect`, { retries: 1 });
    if (d.url) { window.location.href = d.url; return; }   // full-page redirect into the provider's consent screen
    throw new Error('Could not start the connection.');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not connect', 'error'); }
}
async function testOAuth(provider, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const d = await apiSendJson(`/integrations/${provider}/test`, 'POST', {});
    btn.textContent = 'Connected '; showToast(d.company || 'Connection is healthy', 'success');
  } catch (e) { showToast(e.message || 'Connection check failed', 'error'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
}
async function disconnectOAuth(provider, label, btn) {
  if (!confirm(`Disconnect ${label}? MarketSync will stop syncing to it.`)) return;
  btn.disabled = true;
  try { await apiSendJson(`/integrations/${provider}`, 'DELETE'); showToast(`${label} disconnected`, 'success'); loadIntegrations(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
window.loadIntegrations = loadIntegrations;
window.saveWebhook = saveWebhook;
window.testWebhook = testWebhook;
window.disconnectWebhook = disconnectWebhook;
window.saveTwilio = saveTwilio;
window.testTwilio = testTwilio;
window.disconnectTwilio = disconnectTwilio;
async function toggleAccountingAutosync(provider, el) {
  const on = !!el.checked;
  try {
    await apiSendJson(`/integrations/${provider}/autosync`, 'PUT', { autosync: on });
    showToast(on ? 'Auto-post to your books is ON' : 'Auto-post is off', 'success');
    // Reflect in the cache so a re-render keeps the toggle state.
    const p = (__integrationsCache?.providers || []).find(x => x.provider === provider);
    if (p) { p.lender_code_map = { ...(p.lender_code_map || {}), autosync: on }; }
  } catch (e) { el.checked = !on; showToast(e.message || 'Could not update', 'error'); }
}
window.connectOAuth = connectOAuth;
window.testOAuth = testOAuth;
window.disconnectOAuth = disconnectOAuth;
window.toggleAccountingAutosync = toggleAccountingAutosync;

// Square deposits card — dealer connects their own Square account via OAuth; once
// connected, the same "Collect deposit" flow (website + deal desk) routes to Square.
function squareCard(p) {
  const connected = p.configured && p.enabled;
  const cfg = p.lender_code_map || {};
  // p.live = MarketSync's Square app keys are set on the server. Until they are,
  // there's nothing for a dealer to do — show an honest "ready, pending setup"
  // state instead of a misleading Connect button or "Coming soon" pill.
  const pendingPill = '<span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Setup pending</span>';
  const controls = !p.live
    ? `<p class="text-[11px] text-slate-400 mt-2">Built and ready — Square switches on once MarketSync's Square keys are set on the server. Nothing to do here yet.</p>`
    : `<div class="flex items-center gap-2 mt-3">
        ${connected
          ? `<button onclick="disconnectSquare('${esc(p.label)}', this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>`
          : `<button onclick="connectSquare(this)" class="bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg transition hover:opacity-90">Connect Square</button>`}
      </div>`;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${p.live ? statusPill(p) : pendingPill}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
        ${connected && cfg.connected_at ? `<p class="text-[11px] text-slate-400 mt-1">Connected ${new Date(cfg.connected_at).toLocaleDateString()}${cfg.location_name ? ' · ' + esc(cfg.location_name) : ''}.</p>` : ''}
        ${controls}
      </div>
    </div>
  </div>`;
}
async function connectSquare(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Opening…';
  try {
    const d = await apiGetJson('/square/connect', { retries: 1 });
    if (d.url) { window.location.href = d.url; return; }
    throw new Error('Could not start the connection.');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not connect', 'error'); }
}
async function disconnectSquare(label, btn) {
  if (!confirm(`Disconnect ${label}? MarketSync will stop routing deposits to Square.`)) return;
  btn.disabled = true;
  try { await apiSendJson('/square/disconnect', 'POST', {}); showToast(`${label} disconnected`, 'success'); loadIntegrations(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
window.connectSquare = connectSquare;
window.disconnectSquare = disconnectSquare;

// Online deposits (Stripe Connect) card — dealer connects their own Stripe, sets a
// deposit amount, and flips it on to show a "Reserve with a deposit" button on their site.
function depositsCard(p) {
  const m = p.lender_code_map || {};
  const connected = !!m.account_id;
  const ready = !!m.charges_enabled;
  const amount = Number(m.deposit_amount) || 500;
  const cur = String(m.currency || 'usd').toUpperCase();
  const on = !!p.enabled && ready;
  const statusLine = !connected ? ''
    : ready ? `<p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">Stripe account connected — payouts go straight to you.</p>`
      : `<p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Onboarding started — finish Stripe's steps to start accepting deposits.</p>`;
  let controls;
  if (!connected) {
    controls = `<button onclick="connectDeposits(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Connect Stripe</button>
      <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-2">You'll finish on Stripe's secure onboarding, then set your deposit amount here.</p>`;
  } else if (!ready) {
    controls = `<div class="flex items-center gap-2">
        <button onclick="connectDeposits(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Finish Stripe onboarding</button>
        <button onclick="refreshDeposits(this)" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 rounded-lg transition">Re-check status</button>
      </div>`;
  } else {
    controls = `<div class="space-y-2.5">
        <div class="flex items-end gap-2">
          <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Deposit amount (${cur})</label>
            <input id="dep-amount" type="number" min="1" step="1" value="${amount}" class="w-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
          <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 pb-2"><input id="dep-enabled" type="checkbox" ${on ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Show "Reserve with a deposit" on my site</label>
        </div>
        <label class="inline-flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input id="dep-bank" type="checkbox" ${m.accept_bank ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 mt-0.5"><span>Also accept bank transfer <span class="font-normal text-slate-500 dark:text-slate-400">(lower fees — pre-authorized debit in Canada, ACH in the US). Enable the method in your Stripe dashboard first; card is always offered.</span></span></label>
        <div class="flex items-center gap-2">
          <button onclick="saveDeposits(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save</button>
          <button onclick="disconnectDeposits(this)" class="ml-auto text-xs text-rose-500 hover:text-rose-400 font-semibold">Disconnect</button>
        </div>
      </div>`;
  }
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
    <div class="flex items-start gap-3 mb-3">
      ${integrationIcon(p.provider)}
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white">${esc(p.label)}</span>${statusPill(p)}</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(p.description)}</p>
        ${statusLine}
      </div>
    </div>
    ${controls}
  </div>`;
}
async function connectDeposits(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Opening…';
  try {
    const d = await apiSendJson('/deposits/connect', 'POST', {});
    if (d.url) { window.location.href = d.url; return; }
    throw new Error('Could not start onboarding.');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not connect Stripe', 'error'); }
}
async function refreshDeposits(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const d = await apiSendJson('/deposits/refresh', 'POST', {});
    showToast(d.charges_enabled ? 'Connected — deposits are ready ' : 'Still finishing on Stripe — try again shortly.', d.charges_enabled ? 'success' : 'info');
    loadIntegrations();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not check status', 'error'); }
}
async function saveDeposits(btn) {
  const amount = Math.max(1, parseInt(document.getElementById('dep-amount')?.value) || 0);
  const enabled = !!document.getElementById('dep-enabled')?.checked;
  const accept_bank = !!document.getElementById('dep-bank')?.checked;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/deposits/config', 'PUT', { deposit_amount: amount, enabled, accept_bank });
    btn.textContent = 'Saved '; showToast(enabled ? 'Deposits are live on your site' : 'Deposit settings saved', 'success');
    setTimeout(() => loadIntegrations(), 700);
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
async function disconnectDeposits(btn) {
  if (!confirm('Disconnect online deposits? Your website will stop offering a deposit option. (Your Stripe account itself stays intact.)')) return;
  btn.disabled = true;
  try { await apiSendJson('/deposits/config', 'DELETE'); showToast('Online deposits disconnected', 'success'); loadIntegrations(); }
  catch (e) { btn.disabled = false; showToast(e.message || 'Could not disconnect', 'error'); }
}
window.connectDeposits = connectDeposits;
window.refreshDeposits = refreshDeposits;
window.saveDeposits = saveDeposits;
window.disconnectDeposits = disconnectDeposits;

// ── Dealer details for documents (Settings › Dealer Management) ──────────────
// Same legal identifiers the desk uses on the bill of sale — edited here anytime.
async function loadDealerDocs() {
  if (!document.getElementById('dd-legal_name')) return;
  let cfg = {};
  try { cfg = await apiGetJson('/ai/config', { retries: 1 }); } catch {}
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('dd-legal_name', cfg.legal_name); set('dd-street_address', cfg.street_address);
  set('dd-phone', cfg.phone); set('dd-fax', cfg.fax);
  set('dd-hst_number', cfg.hst_number); set('dd-omvic_reg', cfg.omvic_reg);
}
async function saveDealerDocs(btn) {
  const g = (id) => (document.getElementById(id)?.value || '').trim();
  const payload = { legal_name: g('dd-legal_name'), street_address: g('dd-street_address'), phone: g('dd-phone'), fax: g('dd-fax'), hst_number: g('dd-hst_number'), omvic_reg: g('dd-omvic_reg') };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/ai/config', 'PUT', payload);
    // Keep the desk's cached copy in sync so it reflects the edit immediately.
    if (__deskDealer) __deskDealer = { ...__deskDealer, name: payload.legal_name || __deskDealer.name, street: payload.street_address || null, phone: payload.phone || null, fax: payload.fax || null, hst: payload.hst_number || null, omvic: payload.omvic_reg || null };
    btn.textContent = 'Saved '; setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
    showToast('Dealer details saved', 'success');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
window.saveDealerDocs = saveDealerDocs;

// ── Per-user email sending settings (Settings › Account) ────────────────────
async function saveEmailSettings(btn) {
  const sig = (document.getElementById('es-signature')?.value || '').trim();
  const replyTo = (document.getElementById('es-reply-to')?.value || '').trim();
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) { showToast('Enter a valid reply-to email address', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/profile/update', 'PUT', { emailSignature: sig, emailReplyTo: replyTo });
    if (profileContext) { profileContext.email_signature = sig || null; profileContext.email_reply_to = replyTo || null; }
    btn.textContent = 'Saved '; setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
    showToast('Email settings saved', 'success');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
window.saveEmailSettings = saveEmailSettings;

// ── Deal Desk fee schedule (Settings › Dealer Management) ────────────────────
// Management-controlled prefill fees. Each: { name, amount, taxable, locked }.
let __deskFeeConfig = [];
const DESK_FEE_FALLBACK = [
  { name: 'Documentation / admin fee', amount: 699, taxable: true, locked: false },
  { name: 'Licensing & registration', amount: 60, taxable: false, locked: true },
  { name: 'OMVIC fee', amount: 10, taxable: true, locked: true },
  { name: 'Tire / enviro levy', amount: 24.75, taxable: true, locked: false },
];
async function loadDeskFeeSettings() {
  const list = document.getElementById('desk-fees-list');
  if (!list) return;
  try {
    const cfg = await apiGetJson('/ai/config', { retries: 1 });
    __deskFeeConfig = Array.isArray(cfg.desk_fees) && cfg.desk_fees.length ? cfg.desk_fees.map(f => ({ name: f.name || '', amount: f.amount ?? '', taxable: f.taxable !== false, locked: f.locked === true })) : DESK_FEE_FALLBACK.slice();
  } catch { __deskFeeConfig = DESK_FEE_FALLBACK.slice(); }
  renderDeskFeeSettings();
}
function renderDeskFeeSettings() {
  const list = document.getElementById('desk-fees-list');
  if (!list) return;
  const iCls = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  list.innerHTML = __deskFeeConfig.length ? __deskFeeConfig.map((f, i) => `
    <div class="flex flex-wrap items-center gap-2">
      <input value="${esc(f.name || '')}" oninput="deskFeeEdit(${i},'name',this.value)" placeholder="Fee name" class="${iCls} flex-1 min-w-[160px]">
      <input value="${f.amount == null || f.amount === '' ? '' : msFmtMoney(f.amount)}" oninput="deskFeeEdit(${i},'amount',this.value)" type="text" inputmode="decimal" data-money placeholder="0.00" class="${iCls} w-28 text-right">
      <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 whitespace-nowrap"><input type="checkbox" ${f.taxable !== false ? 'checked' : ''} onchange="deskFeeEdit(${i},'taxable',this.checked)" class="rounded"> Taxable</label>
      <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 whitespace-nowrap" title="Locked fees can't be changed on the desk"><input type="checkbox" ${f.locked ? 'checked' : ''} onchange="deskFeeEdit(${i},'locked',this.checked)" class="rounded">  Lock</label>
      <button type="button" onclick="deskFeeDelRow(${i})" class="text-rose-500 hover:text-rose-600 px-1" title="Remove"></button>
    </div>`).join('') : '<div class="text-sm text-slate-400 italic py-1">No fees yet — add the ones your store charges on every deal.</div>';
}
function deskFeeEdit(i, field, val) { const r = __deskFeeConfig[i]; if (!r) return; r[field] = (field === 'amount') ? (val === '' ? '' : msNum(val)) : val; }
function deskFeeAddRow() { __deskFeeConfig.push({ name: '', amount: '', taxable: true, locked: false }); renderDeskFeeSettings(); }
function deskFeeDelRow(i) { __deskFeeConfig.splice(i, 1); renderDeskFeeSettings(); }
async function saveDeskFees(btn) {
  const clean = __deskFeeConfig.map(f => ({ name: (f.name || '').trim(), amount: Number(f.amount) || 0, taxable: f.taxable !== false, locked: f.locked === true })).filter(f => f.name);
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/ai/config', 'PUT', { desk_fees: clean });
    __deskFeeConfig = clean.length ? clean : [];
    __deskDealerFees = clean;   // refresh the desk's cache so new deals prefill the new schedule
    btn.textContent = 'Saved '; setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1400);
    showToast('Deal-desk fees saved', 'success');
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save fees', 'error'); }
}
window.deskFeeAddRow = deskFeeAddRow; window.deskFeeDelRow = deskFeeDelRow; window.deskFeeEdit = deskFeeEdit; window.saveDeskFees = saveDeskFees;

// ── Feature toggles (Settings › Dealer Management) ───────────────────────────
const FEATURE_LABELS = { website: 'Website', automation: 'Automation', equity: 'Equity Mining', inv_intel: 'Inventory Intelligence', appraisals: 'Appraisals', reports: 'Reports' };
async function loadDealerFeatures() {
  const root = document.getElementById('dealer-features-list');
  if (!root) return;
  let d;
  try { d = await apiGetJson('/dealership/features', { retries: 1 }); }
  catch { root.innerHTML = '<div class="text-sm text-rose-500 py-2">Could not load features.</div>'; return; }
  __featureFlags = d?.features || {};
  root.innerHTML = Object.entries(FEATURE_LABELS).map(([k, label]) => {
    const on = __featureFlags[k] !== false;
    return `<label class="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${label}</span>
      <button onclick="toggleDealerFeature('${k}', ${!on})" title="${on ? 'On — click to hide' : 'Off — click to show'}" class="shrink-0 w-9 h-5 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} relative"><span class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition" style="left:${on ? '18px' : '2px'}"></span></button>
    </label>`;
  }).join('');
}
async function toggleDealerFeature(key, on) {
  const prev = __featureFlags[key] !== false;
  __featureFlags[key] = on;
  loadDealerFeatures();          // optimistic
  applyFeatureFlags();           // reflect in the nav immediately (both directions)
  try {
    await apiSendJson('/dealership/features', 'PUT', __featureFlags);
  } catch (e) {
    __featureFlags[key] = prev; loadDealerFeatures(); applyFeatureFlags();
    showToast(e.message || 'Only owners/admins can change features', 'error');
  }
}
window.loadDealerFeatures = loadDealerFeatures;

const TEAM_CHAT_DEFAULTS = {
  enabled: true,
  staffAccess: 'all', // all | managers
  sound: true,
  desktopNotify: true,
  channels: { general: true, sales: true, service: true, parts: true, recon: true },
};
function teamChatSettings() {
  return { ...TEAM_CHAT_DEFAULTS, ...(window.__teamChatSettings || {}) };
}
async function loadTeamChatSettings() {
  const root = document.getElementById('team-chat-settings-root');
  if (!root) return;
  let cfg = { ...TEAM_CHAT_DEFAULTS };
  try {
    const d = await apiGetJson('/config/team_chat');
    if (d && d.value && typeof d.value === 'object') cfg = { ...cfg, ...d.value };
  } catch (e) {
    try {
      const raw = localStorage.getItem('ms_team_chat_settings');
      if (raw) cfg = { ...cfg, ...JSON.parse(raw) };
    } catch {}
  }
  window.__teamChatSettings = cfg;
  renderTeamChatSettings(root, cfg);
  applyTeamChatSettings(cfg);
}
function renderTeamChatSettings(root, cfg) {
  const ch = cfg.channels || TEAM_CHAT_DEFAULTS.channels;
  const toggle = (key, on) => `<button type="button" onclick="toggleTeamChatSetting('${key}', ${!on})" class="shrink-0 w-9 h-5 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} relative"><span class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition" style="left:${on ? '18px' : '2px'}"></span></button>`;
  root.innerHTML = `
    <label class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
      <span><div class="text-sm font-bold text-slate-800 dark:text-slate-100">Enable Team Chat</div><div class="text-[12px] text-slate-500">Shows the chat bubble for people who are allowed to use it.</div></span>
      ${toggle('enabled', cfg.enabled !== false)}
    </label>
    <div class="py-2 border-b border-slate-100 dark:border-slate-800">
      <div class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Who can use Team Chat</div>
      <div class="flex flex-wrap gap-2">
        <button type="button" onclick="setTeamChatAccess('all')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.staffAccess !== 'managers' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">All staff</button>
        <button type="button" onclick="setTeamChatAccess('managers')" class="px-3 py-1.5 rounded-full text-xs font-bold border ${cfg.staffAccess === 'managers' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Managers &amp; admins only</button>
      </div>
    </div>
    <label class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
      <span><div class="text-sm font-bold text-slate-800 dark:text-slate-100">Message sound</div><div class="text-[12px] text-slate-500">Play a sound when a new internal message arrives.</div></span>
      ${toggle('sound', cfg.sound !== false)}
    </label>
    <label class="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800">
      <span><div class="text-sm font-bold text-slate-800 dark:text-slate-100">Desktop notifications</div><div class="text-[12px] text-slate-500">Ask the browser to notify when Team Chat is in the background.</div></span>
      ${toggle('desktopNotify', cfg.desktopNotify !== false)}
    </label>
    <div class="py-2">
      <div class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Channels</div>
      <div class="grid sm:grid-cols-2 gap-2">
        ${[['general','General Chat'],['sales','Sales Floor'],['service','Service Bay'],['parts','Parts Desk'],['recon','Recon & Detail']].map(([k,l]) => `
          <label class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">${l}</span>
            <button type="button" onclick="toggleTeamChatChannel('${k}')" class="shrink-0 w-9 h-5 rounded-full transition ${ch[k] !== false ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} relative"><span class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition" style="left:${ch[k] !== false ? '18px' : '2px'}"></span></button>
          </label>`).join('')}
      </div>
    </div>
    <p class="text-[12px] text-slate-400">Retention is 90 days. Channel membership still follows each person’s department.</p>
  `;
}
async function persistTeamChatSettings() {
  const cfg = teamChatSettings();
  try { localStorage.setItem('ms_team_chat_settings', JSON.stringify(cfg)); } catch {}
  try { await apiSendJson('/config/team_chat', 'PUT', { value: cfg }); }
  catch (e) { /* local persist is enough if MFA/config is locked */ }
  applyTeamChatSettings(cfg);
}
function toggleTeamChatSetting(key, on) {
  window.__teamChatSettings = { ...teamChatSettings(), [key]: on };
  persistTeamChatSettings();
  const root = document.getElementById('team-chat-settings-root');
  if (root) renderTeamChatSettings(root, window.__teamChatSettings);
}
function setTeamChatAccess(mode) {
  window.__teamChatSettings = { ...teamChatSettings(), staffAccess: mode };
  persistTeamChatSettings();
  const root = document.getElementById('team-chat-settings-root');
  if (root) renderTeamChatSettings(root, window.__teamChatSettings);
}
function toggleTeamChatChannel(key) {
  const cfg = teamChatSettings();
  const channels = { ...(cfg.channels || {}), [key]: cfg.channels?.[key] === false };
  window.__teamChatSettings = { ...cfg, channels };
  persistTeamChatSettings();
  const root = document.getElementById('team-chat-settings-root');
  if (root) renderTeamChatSettings(root, window.__teamChatSettings);
}
function applyTeamChatSettings(cfg) {
  cfg = cfg || teamChatSettings();
  window.__teamChatSettings = cfg;
  const role = (typeof profileContext !== 'undefined' && profileContext?.role) || '';
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'DEALER_GROUP'].includes(String(role));
  const allowed = cfg.enabled !== false && (cfg.staffAccess !== 'managers' || isMgr);
  const bar = document.getElementById('staff-chat-dock-bar');
  if (bar) bar.classList.toggle('hidden', !allowed);
  const panel = document.getElementById('team-chat-dock-panel');
  // Never force-open the messenger. Only hide it when Team Chat is off.
  if (panel && !allowed) panel.classList.add('hidden');
  if (!allowed && typeof window.disableStaffChatDock === 'function') {
    try { window.disableStaffChatDock(); } catch {}
  }
}
window.loadTeamChatSettings = loadTeamChatSettings;
window.toggleTeamChatSetting = toggleTeamChatSetting;
window.setTeamChatAccess = setTeamChatAccess;
window.toggleTeamChatChannel = toggleTeamChatChannel;
window.applyTeamChatSettings = applyTeamChatSettings;

window.toggleDealerFeature = toggleDealerFeature;

// ── Team roster (Settings › Team) ────────────────────────────────────────────
let __teamCurrent = 'sales';
async function loadSettingsTeam(team) {
  __teamCurrent = team || 'sales';
  const root = document.getElementById('team-roster');
  if (!root) return;
  root.innerHTML = '<div class="py-10 text-center text-sm text-slate-400 italic">Loading…</div>';
  let d;
  try { d = await apiGetJson(`/team/roster?team=${encodeURIComponent(__teamCurrent)}`, { retries: 1 }); }
  catch { root.innerHTML = '<div class="py-8 text-center text-sm text-rose-500">Could not load the roster.</div>'; return; }
  const members = d?.members || [];
  const roleBadge = (r) => ({ OWNER: 'Owner', DEALER_ADMIN: 'Admin', MANAGER: 'Manager', SALES_REP: 'Sales' }[r] || r || '');
  if (d.login) {
    const rows = members.length ? members.map(m => `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
        <div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-black flex-shrink-0 overflow-hidden">${m.avatar_url ? `<img src="${esc(m.avatar_url)}" class="w-full h-full object-cover">` : esc((m.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="flex-1 min-w-0"><div class="font-bold text-slate-900 dark:text-white truncate">${esc(m.name)}</div></div>
        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${esc(roleBadge(m.role))}</span>
      </div>`).join('') : '<div class="py-8 text-center text-sm text-slate-400 italic">No one on this team yet.</div>';
    root.innerHTML = `
      <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">${rows}</div>
      <div class="flex items-center justify-between mt-3 gap-2 flex-wrap">
        <span class="text-[11px] text-slate-400">${members.length} member${members.length === 1 ? '' : 's'} · they sign in to MarketSync — manage logins, roles &amp; lead routing below.</span>
      </div>`;
  } else {
    const rows = members.length ? members.map(m => `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
        <div class="flex-1 min-w-0">
          <div class="font-bold text-slate-900 dark:text-white truncate">${esc(m.name)}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${[m.phone, m.email].filter(Boolean).map(esc).join(' · ') || '—'}</div>
        </div>
        <button onclick="teamDeleteStaff('${m.id}')" class="text-slate-400 hover:text-rose-500 p-1" title="Remove" aria-label="Remove">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0l-.5 12a1 1 0 01-1 1H8.5a1 1 0 01-1-1L7 7"/></svg>
        </button>
      </div>`).join('') : '<div class="py-8 text-center text-sm text-slate-400 italic">No one on this team yet — add your first below.</div>';
    root.innerHTML = `
      <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mb-4">${rows}</div>
      <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Add to ${esc(__teamCurrent)} team</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input id="team-add-name" placeholder="Name" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
          <input id="team-add-phone" placeholder="Phone (optional)" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
          <input id="team-add-email" placeholder="Email (optional)" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        </div>
        <button id="team-add-btn" onclick="teamAddStaff()" class="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Add member</button>
      </div>`;
  }
}
window.loadSettingsTeam = loadSettingsTeam;

async function teamAddStaff() {
  const name = document.getElementById('team-add-name')?.value.trim();
  if (!name) { showToast('Enter a name', 'error'); return; }
  const btn = document.getElementById('team-add-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  try {
    const res = await fetch(`${API}/team/staff`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ team: __teamCurrent, name, phone: document.getElementById('team-add-phone')?.value.trim(), email: document.getElementById('team-add-email')?.value.trim() }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Add failed');
    await loadSettingsTeam(__teamCurrent);
  } catch (e) { if (btn) { btn.disabled = false; btn.textContent = 'Add member'; } showToast(e.message || 'Could not add', 'error'); }
}
async function teamDeleteStaff(id) {
  if (!confirm('Remove this team member?')) return;
  try {
    const res = await fetch(`${API}/team/staff/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Delete failed');
    await loadSettingsTeam(__teamCurrent);
  } catch (e) { showToast(e.message || 'Could not remove', 'error'); }
}
window.teamAddStaff = teamAddStaff;
window.teamDeleteStaff = teamDeleteStaff;

// ── Accounting page ──────────────────────────────────────────────────────────
// Managers/accounting. The deal + F&I auto-post income; accounting adds the day's
// expenses; a daily reconciliation flags anything off (and emails when it is).
let __acctState = { tab: 'financials', date: null, accounts: [], finSub: 'overview' };
const ACCT_TABS = [['financials', 'Financials'], ['payroll', 'Payroll & HR'], ['insights', 'Insights'], ['reconciliation', 'Reconciliation'], ['bank', 'Bank account'], ['expenses', 'Expenses'], ['budget', 'Budget'], ['tax', 'Tax'], ['reports', 'Reports'], ['settings', 'Settings']];
function acctToday() { return __acctState.date || new Date().toISOString().slice(0, 10); }
function acctMonth() { return acctToday().slice(0, 7); }
function loadAccountingPage(goTab) {
  if (goTab) __acctState.tab = goTab;
  const root = document.getElementById('accounting-root'); if (!root) return;
  const tab = (id, label) => `<button onclick="acctSetTab('${id}')" class="px-3 py-1.5 rounded-lg text-sm font-bold transition ${__acctState.tab === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>`;
  root.innerHTML = `
    <div><h1 class="text-2xl font-black text-slate-900 dark:text-white">Accounting</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">Deals &amp; F&amp;I post themselves — add the day's expenses and close the books. Reconciliation runs daily and alerts you when something's off.</p></div>
    <div class="flex flex-wrap gap-1.5">${ACCT_TABS.map(([id, l]) => tab(id, l)).join('')}</div>
    <div id="acct-body" class="pt-1"><div class="text-sm text-slate-400">Loading…</div></div>`;
  const map = { financials: acctLoadFinancials, payroll: acctLoadPayroll, insights: acctLoadInsights, reconciliation: acctLoadToday, bank: acctLoadBank, expenses: acctLoadExpenses, budget: acctLoadBudget, tax: acctLoadTax, reports: acctLoadReportsDetail, settings: acctLoadSettings };
  (map[__acctState.tab] || acctLoadFinancials)();
}
function acctSetTab(t) { __acctState.tab = t; loadAccountingPage(); }
function acctSetDate(d) { __acctState.date = d; acctLoadToday(); }
// Nav sub-item → jump to the Accounting page on a specific tab.
function acctGo(tab) { __acctState.tab = tab; switchPage('accounting'); }
window.loadAccountingPage = loadAccountingPage; window.acctSetTab = acctSetTab; window.acctSetDate = acctSetDate; window.acctGo = acctGo;

// ── Financials — the journal-driven accounting dashboard + statements ─────────
// Every number here reads from journal_entries/journal_lines (double-entry), never
// from balances that were edited. Sub-views: Overview cards, Journal, Trial Balance,
// Income Statement, Balance Sheet.
const FIN_SUBS = [['overview', 'Overview'], ['forecast', 'Forecast'], ['journal', 'Journal'], ['trial', 'Trial Balance'], ['income', 'Income Statement'], ['balance', 'Balance Sheet'], ['periods', 'Period Close']];
function acctFinSub(s) { __acctState.finSub = s; acctLoadFinancials(); }
window.acctFinSub = acctFinSub;
const finMoney = (x) => (Number(x) < 0 ? '-$' : '$') + Math.abs(Number(x) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

async function acctLoadFinancials() {
  const body = document.getElementById('acct-body'); if (!body) return;
  const sub = __acctState.finSub || 'overview';
  const subTabs = FIN_SUBS.map(([id, l]) => `<button onclick="acctFinSub('${id}')" class="px-2.5 py-1 rounded-lg text-[13px] font-bold transition ${sub === id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${l}</button>`).join('');
  body.innerHTML = `<div class="flex flex-wrap gap-1.5 mb-4">${subTabs}</div><div id="fin-body"><div class="text-sm text-slate-400">Loading…</div></div>`;
  const el = document.getElementById('fin-body');
  try {
    if (sub === 'overview') return acctFinOverview(el);
    if (sub === 'journal') return acctFinJournal(el);
    if (sub === 'trial') return acctFinTrial(el);
    if (sub === 'income') return acctFinIncome(el);
    if (sub === 'balance') return acctFinBalance(el);
    if (sub === 'forecast') return acctFinForecast(el);
    if (sub === 'periods') return acctFinPeriods(el);
  } catch (e) { el.innerHTML = `<div class="text-sm text-rose-500">${esc(e.message || 'Could not load.')}</div>`; }
}
