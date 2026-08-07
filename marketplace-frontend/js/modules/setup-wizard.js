// ── MarketSync Guided Setup Wizard & Progress Bar Submodule ────────────
// Manages store onboarding progress bar, setup steps, and modal wizards.

var __setupSnap = null;
var MGR_SET = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ADMIN'];

async function fetchSetupSnap() {
  if (__setupSnap) return __setupSnap;
  const token = localStorage.getItem('token');
  if (!token) return { feeds: [], site: {}, acct: {}, svc: {}, twilio: null, cal: { providers: [] } };
  const jget = p => (typeof apiGetJson === 'function' ? apiGetJson(p) : Promise.resolve(null)).catch(() => null);
  const apiHost = typeof API !== 'undefined' ? API : '/api';
  const feedsP = fetch(`${apiHost}/inventory-feeds`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
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

const PRODUCT_SETUP_STEPS = {
  ai_chatbot: [
    { id: 'ai-personality', icon: 'sparkles', label: "Set your AI's voice", desc: 'Name your assistant and set its greeting and tone.', done: () => setupAck('ai-personality'), run: () => { setSetupAck('ai-personality'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-knowledge', icon: 'chat', label: 'Teach it about your store', desc: 'Hours, financing, specials — what it should know when it answers.', done: () => setupAck('ai-knowledge'), run: () => { setSetupAck('ai-knowledge'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-install', icon: 'globe', label: 'Add the chat to your website', desc: 'Copy the snippet and paste it into your site — it goes live instantly.', done: () => setupAck('ai-install'), run: () => { setSetupAck('ai-install'); setupCloseAll(); switchPage('ai-home'); } },
  ],
  facebook_solo: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); switchPage('inventory'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); switchPage('inventory'); } },
  ],
  facebook_dealer: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); switchPage('inventory'); } },
    { id: 'reps', icon: 'user', label: 'Add your sales reps', desc: 'Invite your team, see their insights, and set managers.', done: () => setupAck('reps'), run: () => { setSetupAck('reps'); setupCloseAll(); switchPage('sales-team'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); switchPage('inventory'); } },
  ],
};

function setupAck(id) {
  return localStorage.getItem(`ms_setup_ack_${id}`) === '1';
}

function setSetupAck(id) {
  localStorage.setItem(`ms_setup_ack_${id}`, '1');
}

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
  if (p === 'marketsync') return [];
  if (PRODUCT_SETUP_STEPS[p]) return PRODUCT_SETUP_STEPS[p];
  return SETUP_STEPS.filter(st => {
    if (!st.roles) return true;
    return st.roles.includes(role);
  });
}

function setupCloseAll() {
  document.querySelectorAll('.fixed').forEach(el => {
    if (el.dataset && el.dataset.setup) el.remove();
  });
}

async function renderSetupBar() {
  const host = document.getElementById('setup-bar-host');
  if (!host) return;

  const role = (window.profileContext && window.profileContext.role) || 'DEALER_ADMIN';
  const steps = setupStepsFor(role);
  if (!steps.length) {
    host.innerHTML = '';
    return;
  }

  let snap = { feeds: [] };
  try { snap = await fetchSetupSnap(); } catch (e) {}

  const doneCount = steps.filter(s => {
    try { return s.done(snap); } catch (e) { return false; }
  }).length;

  const pct = Math.round((doneCount / steps.length) * 100);

  if (doneCount >= steps.length) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = `
    <div class="mb-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <span class="text-xs font-bold text-indigo-700 dark:text-indigo-300">Guided Setup</span>
        <span class="text-xs font-black text-indigo-600 dark:text-indigo-400">${doneCount}/${steps.length} (${pct}%)</span>
      </div>
      <div class="w-full h-1.5 bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden mb-2">
        <div class="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-500" style="width: ${pct}%"></div>
      </div>
      <div class="flex gap-2">
        <button onclick="openSetupCenter()" class="w-full text-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 py-1.5 px-3 rounded-lg transition">
          Continue Setup →
        </button>
      </div>
    </div>
  `;
}
window.renderSetupBar = renderSetupBar;

function openSetupCenter() {
  const role = (window.profileContext && window.profileContext.role) || 'DEALER_ADMIN';
  const steps = setupStepsFor(role);
  if (!steps.length) return;

  const nextStep = steps[0];
  if (nextStep && typeof nextStep.run === 'function') {
    nextStep.run();
  }
}
window.openSetupCenter = openSetupCenter;