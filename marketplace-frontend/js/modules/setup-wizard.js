// ── MarketSync Guided Setup Wizard & Progress Bar Submodule ────────────
// Manages store onboarding progress bar, setup steps, and modal wizards.

  const feedsP = fetch(`${API}/inventory-feeds`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
  const [feeds, site, acct, svc, integ, cal] = await Promise.all([
    feedsP, jget('/dealership/site'), jget('/accounting/settings'), jget('/service/config'), jget('/integrations'), jget('/calendar/status'),
  ]);
  __setupSnap = {
    feeds: Array.isArray(feeds) ? feeds : [],
    site: site || {}, acct: acct?.settings || {}, svc: svc?.settings || {},
    twilio: ((integ && integ.providers) || []).find(p => p.provider === 'twilio') || null,
    cal: cal || { providers: [] },
  };
  return __setupSnap;
}

// The steps. Order = the order we walk people through.
const SETUP_STEPS = [
  { id: 'inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull every vehicle in from your website or a feed — automatically.', roles: MGR_SET, tour: 'inventory', done: s => s.feeds.length > 0, run: () => runSetupForm('inventory') },
  { id: 'website', icon: 'globe', label: 'Set up your website', desc: 'Claim your web address, add your look, and go live.', roles: MGR_SET, tour: 'website', done: s => !!(s.site.site_published || s.site.site_slug), run: () => runSetupForm('website') },
  { id: 'texting', icon: 'chat', label: 'Connect texting', desc: 'Text customers right from a lead (Twilio).', roles: MGR_SET, tour: 'texting', done: s => !!(s.twilio && isIntegrationConnected(s.twilio)), run: () => setupGoIntegration('twilio') },
  { id: 'calendar', icon: 'calendar', label: 'Connect your calendar', desc: 'Appointments sync to Google or Outlook — both ways.', roles: MGR_SET, tour: 'calendar', done: s => (s.cal.providers || []).some(p => p.connected), run: () => setupGoIntegration('calendar') },
  { id: 'accounting', icon: 'receipt', label: 'Set up sales tax', desc: 'So every deal posts to the books correctly.', roles: [...MGR_SET, 'ACCOUNTING'], tour: 'accounting', done: s => !!(s.acct.tax_number || (s.acct.accounting_emails || []).length), run: () => runSetupForm('accounting') },
  { id: 'service', icon: 'wrench', label: 'Turn on service booking', desc: 'Let customers book service from your website.', roles: [...MGR_SET, 'SERVICE'], tour: 'service', done: s => !!s.svc.enabled, run: () => runSetupForm('service') },
  { id: 'automation', icon: 'bolt', label: 'Turn on follow-ups', desc: 'Auto-text and email your leads on autopilot.', roles: MGR_SET, tour: 'automation', done: () => false, run: () => { setSetupAck('automation'); setupCloseAll(); switchPage('automation-builder'); showToast('Flip on a sequence to finish this step', 'info'); } },
];
// Product-specific onboarding. Each product sells a different job-to-be-done, so
// the startup wizard walks a different path. DealerOS (full) keeps the role-based
// SETUP_STEPS above; the MarketSync owner gets no dealer wizard at all.
const PRODUCT_SETUP_STEPS = {
  ai_chatbot: [
    { id: 'ai-personality', icon: 'sparkles', label: "Set your AI's voice", desc: 'Name your assistant and set its greeting and tone.', done: () => setupAck('ai-personality'), run: () => { setSetupAck('ai-personality'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-knowledge', icon: 'chat', label: 'Teach it about your store', desc: 'Hours, financing, specials — what it should know when it answers.', done: () => setupAck('ai-knowledge'), run: () => { setSetupAck('ai-knowledge'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-install', icon: 'globe', label: 'Add the chat to your website', desc: 'Copy the snippet and paste it into your site — it goes live instantly.', done: () => setupAck('ai-install'), run: () => { setSetupAck('ai-install'); setupCloseAll(); switchPage('ai-home'); } },
  ],
  facebook_solo: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); __inventoryMode = 'manual'; switchPage('inventory'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); __inventoryMode = 'facebook'; switchPage('inventory'); } },
  ],
  facebook_dealer: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); __inventoryMode = 'manual'; switchPage('inventory'); } },
    { id: 'reps', icon: 'user', label: 'Add your sales reps', desc: 'Invite your team, see their insights, and set managers.', done: () => setupAck('reps'), run: () => { setSetupAck('reps'); setupCloseAll(); switchPage('sales-team'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); __inventoryMode = 'facebook'; switchPage('inventory'); } },
  ],
};
// Which onboarding path applies right now (product entitlement / workspace).
function currentProductKey() {
  if (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) return 'marketsync';
  const prod = document.documentElement.getAttribute('data-product') || '';
  if (/facebook_dealer/.test(prod)) return 'facebook_dealer';
  if (/facebook_solo/.test(prod)) return 'facebook_solo';
  if (/ai_chatbot/.test(prod)) return 'ai_chatbot';
  return 'dealer_os';
}
function setupStepsFor(role) {
  const p = currentProductKey();
  if (p === 'marketsync') return [];                          // owner SaaS — no dealer setup wizard
  if (PRODUCT_SETUP_STEPS[p]) return PRODUCT_SETUP_STEPS[p];  // AI / Facebook tiers
  if (typeof DEPARTMENTS_CONFIG === 'object' && DEPARTMENTS_CONFIG) {
    return Object.values(DEPARTMENTS_CONFIG).map(config => ({
      id: config.id,
      icon: config.badgeIcon || '🛡️',
      label: config.title,
      desc: config.badgeDesc || `Configure ${config.title}`,
      roles: MGR_SET,
      done: () => localStorage.getItem(`ms_dept_opened_${config.id}`) === '1',
      run: () => openDepartmentSetupWizard(config.id)
    }));
  }
  return SETUP_STEPS.filter(s => s.roles.includes(role));     // full DealerOS fallback
}
function setupStepDone(step, snap) { return setupAck(step.id) || (typeof step.done === 'function' ? step.done(snap) : false); }
function setupCloseAll() { document.querySelectorAll('.fixed').forEach(el => { if (el.dataset.setup) el.remove(); }); }

// The compact progress bar at the top of the sidebar. Vanishes when all done.
async function renderSetupBar() {
  const host = document.getElementById('setup-bar-host'); if (!host) return;
  const steps = setupStepsFor(profileContext?.role);
  if (!steps.length) { host.innerHTML = ''; return; }
  let snap; try { snap = await loadSetupSnapshot(); } catch { return; }
  const done = steps.filter(s => setupStepDone(s, snap)).length, total = steps.length;
  if (done >= total) { host.innerHTML = ''; return; }
  const pct = Math.round(done / total * 100);
  host.innerHTML = `<button onclick="openSetupCenter()" title="Finish setting up" class="w-full text-left rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 mb-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition">
    <div class="flex items-center justify-between gap-2"><span class="inline-flex items-center gap-1.5 text-[12px] font-black text-indigo-700 dark:text-indigo-300">${svgIcon('rocket', 'w-3.5 h-3.5')}Finish setup</span><span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">${done}/${total}</span></div>
    <div class="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 overflow-hidden mt-1.5"><div class="h-full bg-indigo-600 rounded-full transition-all duration-500" style="width:${pct}%"></div></div>
  </button>`;
}

// Opens the department setup wizard & spotlight tour for the active department.
function openSetupCenter() {
  const deptId = typeof __activeOpenDeptId !== 'undefined' && __activeOpenDeptId ? __activeOpenDeptId : (typeof __currentPage !== 'undefined' && __currentPage ? __currentPage : 'crm');
  if (typeof openDepartmentSetupWizard === 'function') openDepartmentSetupWizard(deptId);
}
function setupRun(id) { const s = setupStepsFor(profileContext?.role).find(x => x.id === id); if (s) s.run(); }
// Close the Setup overlay and run that spot's short guided tour.
function setupTour(tourId) { setupCloseAll(); if (typeof startAreaTour === 'function') startAreaTour(tourId); }

// Refresh everything after a step and flow straight to the next one.
async function afterSetupStep() {
  try { await loadSetupSnapshot(true); } catch {}
  renderSetupBar();
  openSetupCenter();
}

// Form-based steps (inventory/website/accounting/service): a tiny form, then
// back to the Center to continue.
async function runSetupForm(id) {
  setupCloseAll();
  const w = SETUP_WIZARDS[id]; if (!w) return;
  let cur = {}; try { if (w.load) cur = (await w.load()) || {}; } catch {}
  const ic = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const fieldHtml = (f) => {
    const v = cur[f.key], fid = `wiz-${f.key}`;
    let input;
    if (f.type === 'checkbox') input = `<label class="flex items-center gap-2 text-sm ${ic}"><input id="${fid}" type="checkbox" class="accent-indigo-600" ${v ? 'checked' : ''}>${esc(f.checkboxLabel || 'Yes')}</label>`;
    else if (f.type === 'select') input = `<select id="${fid}" class="${ic}">${f.options.map(o => `<option value="${o[0]}" ${String(v) === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else input = `<input id="${fid}" type="${f.type || 'text'}" value="${esc(Array.isArray(v) ? v.join(', ') : (v ?? ''))}" placeholder="${esc(f.placeholder || '')}" class="${ic}">`;
    return `<div><label class="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1">${esc(f.label)}</label>${input}${f.hint ? `<p class="text-[11px] text-slate-400 mt-1">${esc(f.hint)}</p>` : ''}</div>`;
  };
  crmOverlay(`<div class="p-5 space-y-4" data-setup-body>
    <div class="flex items-start gap-3">
      <button onclick="openSetupCenter()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 mt-0.5" title="Back to all steps"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
      <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">${svgIcon(w.icon || 'clipboard', 'w-5 h-5')}</div>
      <div class="min-w-0"><div class="text-lg font-black text-slate-900 dark:text-white">${esc(w.title)}</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${esc(w.intro)}</p></div>
    </div>
    <div class="space-y-3">${w.fields.map(fieldHtml).join('')}</div>
    <div class="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
      <button onclick="openSetupCenter()" class="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-2">← All steps</button>
      <button onclick="setupTour('${id}')" class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-2">${svgIcon('eye', 'w-3.5 h-3.5')}Show me around</button>
      <div class="flex-1"></div>
      <button onclick="setupSaveForm('${id}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save &amp; continue</button>
    </div>
  </div>`, 'max-w-lg').dataset.setup = '1';
}
async function setupSaveForm(id, btn) {
  const w = SETUP_WIZARDS[id]; const v = {};
  (w.fields || []).forEach(f => {
    const el = document.getElementById(`wiz-${f.key}`); if (!el) return;
    v[f.key] = f.type === 'checkbox' ? el.checked : (f.type === 'number' ? (parseInt(el.value) || undefined) : (el.value || '').trim());
  });
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await w.save(v); showToast('Saved ✓', 'success'); await afterSetupStep(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
// Integration steps: land the user EXACTLY on the right card, pulsed.
function setupGoIntegration(which) {
  setupCloseAll();
  __focusIntegration = which;   // 'twilio' → Twilio card · 'calendar' → calendar sync card
  switchPage('profile');
  setTimeout(() => { if (typeof settingsTab === 'function') settingsTab('admin'); }, 200);
}
let __focusIntegration = null;
// After the Integrations tab renders, scroll to + flash the targeted card.
function focusIntegrationCard() {
  if (!__focusIntegration) return;
  const sel = __focusIntegration === 'calendar' ? '#calsync-card' : `[data-provider="${__focusIntegration}"]`;
  __focusIntegration = null;
  setTimeout(() => {
    const el = document.querySelector(sel); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('setup-flash');
    setTimeout(() => el.classList.remove('setup-flash'), 2600);
  }, 400);
}
Object.assign(window, { openSetupCenter, setupRun, setupSaveForm, setupTour, renderSetupBar });

// ── Facebook-only tier ───────────────────────────────────────────────────────
// A dealer who pays for Facebook posting alone sees only the Facebook posting hub
// (inventory in facebook mode) + the leaderboard. Driven by cfg.fb_only from
// /ai/config; the sidebar is stripped via html[data-dash-tier="fb"] CSS.
let __fbOnly = false;
// The leaderboard panel lives on the Dashboard (insights) — in fb tier the insights
// page is stripped by CSS to just the leaderboard, so 'insights' is the leaderboard.
const FB_ONLY_PAGES = new Set(['inventory', 'leaderboard', 'insights', 'profile']);
function applyFbOnlyMode() {
  if (__fbOnly) document.documentElement.setAttribute('data-dash-tier', 'fb');
  else document.documentElement.removeAttribute('data-dash-tier');
  applyMobileQuickRow();   // trim the mobile bottom bar to the fb page set
  if (!__fbOnly) return;