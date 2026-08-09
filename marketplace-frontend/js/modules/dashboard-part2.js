/* dashboard.js split part 2/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Page permission flags (set after profile loads, read by switchPage to mirror panels into Insights)
let __canSeeLeaderboard = false;
let __canSeeTeamInsights = false;
let __canSeeSalesTeam = false;

// AI Boost — hot/cold segment cache (populated by renderIntel, read by renderCatalog)
let __hotMakeModels = new Set();
let __coldMakeModels = new Set();
// AI Boost — per-vehicle health score cache (id → score)
let __vehicleHealthScores = {};

// Lazy page loaders: registered during init, each runs once the matching page is
// first opened. Keeps login from firing a burst of heavy requests (feeds, catalog,
// leaderboard, inventory-intelligence) all at once, which stalled the free-tier
// backend. Populated in the init flow; drained by switchPage.
const __pageInit = {};
function runPageInit(pageId) {
  const fn = __pageInit[pageId];
  if (fn) { delete __pageInit[pageId]; try { fn(); } catch (e) { console.warn('[lazy-load]', pageId, e); } }
}

// Pre-fetch hot/cold + health caches so tags show on inventory cards. Heavy call,
// so it now runs lazily the first time the Inventory page is opened.
let __invIntelTagsLoaded = false;
function prefetchInvIntelTags() {
  if (!__invIntelActive || __invIntelTagsLoaded) return;
  __invIntelTagsLoaded = true;
  apiGetJson('/ai/inventory-intelligence', { retries: 2 })
    .then(data => {
      if (!data) return;
      __hotMakeModels = new Set((data.hot_segments || []).map(s => `${s.make} ${s.model}`.toLowerCase()));
      __coldMakeModels = new Set((data.cold_segments || []).map(s => `${s.make} ${s.model}`.toLowerCase()));
      __vehicleHealthScores = Object.fromEntries((data.vehicles || []).map(v => [v.id, v.score]));
      if (__hotMakeModels.size > 0 || __coldMakeModels.size > 0) {
        document.getElementById('catalog-segment-pills')?.classList.remove('hidden');
      }
      if (typeof renderCatalog === 'function' && document.getElementById('catalog-list')) renderCatalog();
    })
    .catch(() => { __invIntelTagsLoaded = false; });
}

// Run Engine Boot Lifecycle
document.addEventListener('DOMContentLoaded', () => {
  // Don't boot the dashboard while we're still waiting on the extension SSO bridge
  // (or if there's genuinely no session) — otherwise the init fires auth'd requests
  // with no token and flashes a broken UI before the redirect/reload lands.
  if (__authPending || !localStorage.getItem('token')) return;
  // Show insights immediately — mobile sees content before the auth fetch completes.
  // role-gated items (data-admin-nav etc.) stay hidden until ms-role-ready is set inside init.
  switchPage('insights');
  initializeDashboardEcosystem();
  setupActionListeners();
});


async function initializeDashboardEcosystem() {
  try {
    // Fetch unified server profile context. Render free/starter tier can cold-start
    // (30-60s) — give it real time instead of letting a default browser timeout
    // produce a confusing error that looks identical to an auth failure.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    let res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal
    });
    // Keep the abort timer armed until the body is fully read (same reasoning as
    // apiGetJson): a response whose headers arrive but whose body stalls must
    // still time out, otherwise the dashboard hangs on a blank/loading screen.
    // The silent refresh starts as the dashboard loads. If the first profile
    // request races an expired/restored access token, wait for that one refresh
    // and retry with the newest token before declaring the session invalid.
    if (res.status === 401) {
      const refreshed = await refreshSessionSilently();
      if (refreshed) {
        res = await fetch(`${API}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });
      }
    }
    if (res.status === 401 || res.status === 402) {
      if (res.status === 402) {
        const body = await res.json().catch(() => ({}))
        clearTimeout(timeoutId);
        throw new Error(body.error === 'TRIAL_EXPIRED' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED')
      }
      clearTimeout(timeoutId);
      throw new Error('SESSION_EXPIRED')
    }

    profileContext = await res.json();
    clearTimeout(timeoutId);

    // `/auth/me` carries the safe, normalized entitlement summary too. Use it first
    // so plan-aware navigation is available even if the follow-up request hits a
    // transient Render cold start; /access/context below refreshes the same snapshot
    // when it succeeds.
    if (profileContext?.access && Array.isArray(profileContext.access.features)) {
      window.__access = profileContext.access;
    }

    // Normalized access context (products / entitled features / permissions / defaultRoute)
    // from the central authorization service — the SINGLE source both desktop and mobile
    // nav filter from. Falls back to the legacy /auth/me products object if unavailable,
    // so an older backend keeps working.
    // CRITICAL: this must NEVER block the dashboard from rendering. It is bounded by its
    // own abort timeout so a slow/hanging response (e.g. a cold-started or down backend)
    // can't stall the nav + skeleton screen — worst case we fall through to legacy gating.
    try {
      const acCtrl = new AbortController();
      const acTimer = setTimeout(() => acCtrl.abort(), 8000);
      const ac = await fetch(`${API}/access/context`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: acCtrl.signal,
      });
      clearTimeout(acTimer);
      if (ac.ok) window.__access = await ac.json();
    } catch { /* timed out / unavailable → leave window.__access unset, legacy gating applies */ }

    // Render Shared Header Components
    // For dealer admins: lead with the DEALERSHIP NAME (so it visually distinguishes the
    // dealer admin view from rep views). Person's name moves to the subtitle line.
    // For reps / solo: lead with the person's name (their own dashboard, not the team's).
    const personName = profileContext.full_name || user.email;
    const isPersonalDealership = profileContext.dealership?.is_personal === true;
    const dealershipName = isPersonalDealership
      ? 'Independent'
      : (profileContext.dealership?.name || 'Independent');
    const isAdminHeader = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext.role);

    // Purple "Desk a deal" quick-launch — any admin/manager/F&I (including a solo
    // "Independent" account, which is still allowed to desk deals).
    if (isAdminHeader) {
      const deskBtn = document.getElementById('header-desk-btn');
      if (deskBtn) { deskBtn.classList.remove('hidden'); deskBtn.classList.add('inline-flex'); }
    }

    if (isAdminHeader && !isPersonalDealership) {
      document.getElementById('ui-profile-name').textContent = dealershipName;
      document.getElementById('ui-dealership-name').textContent = `${personName} · Admin`;
    } else {
      document.getElementById('ui-profile-name').textContent = personName;
      document.getElementById('ui-dealership-name').textContent = dealershipName;
    }
    // Owner-only Demo ↔ MarketSync workspace switch.
    try { initDashModeForOwner(); } catch (e) {}

    // Pre-fill profile form
    document.getElementById('prof-name').value = profileContext.full_name || '';
    document.getElementById('prof-email').value = profileContext.email || user.email || '';
    { const p = document.getElementById('prof-phone'); if (p) p.value = profileContext.phone || ''; }
    // Email-sending card: signature + reply-to override (placeholder = login email).
    { const s = document.getElementById('es-signature'); if (s) s.value = profileContext.email_signature || ''; }
    { const r = document.getElementById('es-reply-to'); if (r) { r.value = profileContext.email_reply_to || ''; r.placeholder = profileContext.email || user.email || 'your login email'; } }
    document.getElementById('prof-dealername').value = profileContext.dealership?.name || '';
    document.getElementById('prof-website').value = profileContext.dealership?.website_url || '';
    document.getElementById('prof-display-name').value = profileContext.display_name || '';

    // Avatar preview
    const avatarImg = document.getElementById('prof-avatar-img');
    const avatarInitial = document.getElementById('prof-avatar-initial');
    const avatarRemove = document.getElementById('prof-avatar-remove');
    const setAvatarPreview = (url) => {
      if (url) {
        avatarImg.src = url; avatarImg.classList.remove('hidden');
        avatarInitial.classList.add('hidden'); avatarRemove.classList.remove('hidden');
      } else {
        avatarImg.classList.add('hidden'); avatarInitial.classList.remove('hidden');
        avatarRemove.classList.add('hidden');
        avatarInitial.textContent = (profileContext.full_name || '?').trim().charAt(0).toUpperCase();
      }
    };
    setAvatarPreview(profileContext.avatar_url || null);

    document.getElementById('prof-avatar-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Compress: resize to max 256px and convert to JPEG at 70% quality
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          setAvatarPreview(dataUrl);
          // Replace file input with compressed blob for upload
          canvas.toBlob(blob => {
            const dt = new DataTransfer();
            dt.items.add(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
            document.getElementById('prof-avatar-file').files = dt.files;
          }, 'image/jpeg', 0.70);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
    avatarRemove.addEventListener('click', () => {
      document.getElementById('prof-avatar-file').value = '';
      setAvatarPreview(null);
    });

    // Route Workspace Rendering Logic based on Account Role
    const role = profileContext.role || 'SALES_REP'; // Standard safe fallback role assignment
    const isPersonalForPill = profileContext.dealership?.is_personal === true;
    const rolePillLabel = (role === 'SALES_REP' && isPersonalForPill) ? 'SOLO_REP' : (STAFF_ROLE_LABELS[role] || role);
    document.getElementById('ui-role-pill').textContent = rolePillLabel;

    // Hide dealer-only profile fields for sales reps
    if (role !== 'DEALER_ADMIN' && role !== 'OWNER' && role !== 'MANAGER') {
      document.querySelectorAll('[data-dealer-only]').forEach(el => el.classList.add('hidden'));
    }

    // Load transactional data + insights
    const [fleet, totalListings] = await Promise.all([
      fetchMetrics('/inventory'),
      fetchMetrics('/listings')
    ]);

    loadInsights();
    loadMyTierChip();
    initSecurityPanel();

    // If returning from Stripe checkout, verify payment then load AI config
    const aiSessionId = new URLSearchParams(window.location.search).get('ai_boost_session');
    if (aiSessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      await verifyAIBoostSession(aiSessionId);
    }

    loadAIBoostSection();
    setupAIBoostListeners();
    setupInvIntelListeners();
    setupAiVisionListeners();

    const isAdmin = role === 'DEALER_ADMIN' || role === 'OWNER' || role === 'MANAGER';
    const inDealership = !!profileContext.dealership?.id;
    const isPersonal = profileContext.dealership?.is_personal === true;
    const isSolo = role === 'SALES_REP' && (isPersonal || !inDealership);
    const isDealerRep = role === 'SALES_REP' && inDealership && !isPersonal;
    const canManageFeeds = isAdmin || isSolo;

    // Feeds + Catalog visible to anyone with a dealership (team or personal)
    if (inDealership) {
      document.getElementById('feeds-panel').classList.remove('hidden');
      document.getElementById('catalog-panel').classList.remove('hidden');
      // Defer the actual data loads until the Inventory page is first opened.
      __pageInit.inventory = () => { loadInventoryFeeds(); loadInventoryCatalog(); prefetchInvIntelTags(); };
    }

    if (!canManageFeeds) {
      // Dealer reps see feeds read-only — hide add/sync controls
      document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.add('hidden'));
    }

    // Billing section: lives inside the Profile card now. Dealer reps don't pay (covered by dealer).
    if (isDealerRep) {
      document.getElementById('billing-section')?.classList.add('hidden');
    }

    // Hide admin-only nav items for non-admins
    if (!isAdmin) {
      document.querySelectorAll('[data-admin-nav]').forEach(el => el.classList.add('hidden'));
    }

    // Groups live inside Profile & Settings — reveal that section for anyone who
    // can create or join a group (dealer admins, group admins, owner).
    if (role === 'DEALER_GROUP' || role === 'OWNER' || role === 'DEALER_ADMIN') {
      document.getElementById('groups-settings-section')?.classList.remove('hidden');
    }

    // Today's Briefing (AI daily digest) on the Insights home page — admins only.
    if (isAdmin) loadDailyDigest();

    // Posting-safety (FB ban protection) settings — dealer-level.
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      document.getElementById('guardrail-settings-section')?.classList.remove('hidden');
      __pageInit.profile = () => loadGuardrailSettings();
    }
    // Reports page + Desk-a-deal (stacked manager reports, custom builder,
    // deal desk) — managers only. Reveal both desktop and mobile entries.
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) {
      document.getElementById('nav-reports')?.classList.remove('hidden');
      document.getElementById('nav-reports-m')?.classList.remove('hidden');
      document.getElementById('nav-desk')?.classList.remove('hidden');
      // Managers get the Accounting group; their commission lives under it, so hide
      // the standalone "My commission" entry for them.
      document.getElementById('grp-accounting-wrap')?.classList.remove('hidden');
      document.getElementById('nav-commissions')?.classList.add('hidden');
    }
    // Hide team-only nav items (Leaderboard) for solo reps — nothing to rank
    if (isSolo || !inDealership) {
      document.querySelectorAll('[data-team-nav]').forEach(el => el.classList.add('hidden'));
    }

    // Solo / personal reps get ONLY Facebook posting & CRM. `canManageFeeds`
    // treats them like admins for feeds, so the dealer-grade features (Inv
    // Intelligence, Website, Equity, Automation, Reports, Desking, Appraisals)
    // and the dealer Settings tabs would otherwise show. Hide them explicitly.
    if (isSolo) {
      document.querySelectorAll('.nav-group[data-group="ii"], .nav-group[data-group="web"], .nav-group[data-group="sales"], [data-page="equity"], [data-page="automation"], #nav-reports, #nav-reports-m, #nav-desk, #nav-appraisal, #grp-accounting-wrap')
        .forEach(el => el.classList.add('hidden'));
      // Dealer-only Settings tabs + their section cards.
      ['team', 'branding', 'aiboost', 'group', 'dealermgmt'].forEach(t =>
        document.querySelector(`#settings-tabs [data-stab="${t}"]`)?.classList.add('hidden'));
      ['settings-team', 'prof-branding-section', 'ai-boost-section', 'inv-intel-section', 'groups-settings-section', 'crm-dms-card', 'guardrail-settings-section']
        .forEach(id => document.getElementById(id)?.classList.add('hidden'));
      __settingsTab = 'account';
    }

    // Specialized sub-roles (F&I / Service / Accounting / Cleanup) are not admins,
    // so the dealer-management Settings tabs don't apply to them either — leave only
    // the personal Account tab (name, password, photo). The sidebar itself is locked
    // to their workspace later by applyStaffRoleNav().
    if (STAFF_ROLE_NAV[role]) {
      ['team', 'branding', 'aiboost', 'group', 'dealermgmt'].forEach(t =>
        document.querySelector(`#settings-tabs [data-stab="${t}"]`)?.classList.add('hidden'));
      ['settings-team', 'prof-branding-section', 'ai-boost-section', 'inv-intel-section', 'groups-settings-section', 'guardrail-settings-section']
        .forEach(id => document.getElementById(id)?.classList.add('hidden'));
      __settingsTab = 'account';
    }

    // All role-based hide rules above have run. Reveal the page now (the head CSS
    // kept role-gated items hidden until this point, so nothing dealer-only ever
    // flashed for a solo rep). This happens synchronously after the hides, so the
    // browser paints the correct nav in one go.
    document.body.classList.add('ms-role-ready');
    personalizeSalesNav();
    syncNavGroupVisibility();
    // Final word for specialized sub-roles: lock the sidebar to their workspace.
    // Runs after the generic hides so it can reveal an otherwise admin-only group.
    applyStaffRoleNav(role);
    document.getElementById('insights-skeleton')?.classList.add('hidden');

    // Overdue-task badge on the Task Board nav item.
    try { if (typeof taskUpdateBadge === 'function') taskUpdateBadge(); } catch (e) {}

    // Guided setup: show the sidebar progress bar, and on the very first login for
    // this dealership walk them straight into the Setup Center if anything's unset.
    try {
      renderSetupBar();
      const introKey = `ms_setup_intro_${profileContext?.dealership?.id || 'x'}`;
      if (!localStorage.getItem(introKey)) {
        setTimeout(async () => {
          const steps = setupStepsFor(role); if (!steps.length) return;
          let snap; try { snap = await loadSetupSnapshot(); } catch { return; }
          if (steps.some(s => !setupStepDone(s, snap))) { localStorage.setItem(introKey, '1'); openSetupCenter(); }
        }, 900);
      }
    } catch (e) {}

    // Daily Punch Clock Prompt (once per day on login)
    try { if (typeof checkLoginPunchClockPrompt === 'function') checkLoginPunchClockPrompt(); } catch (e) {}

    // The Leaderboard is its own page (the home for the Facebook / fb-only tiers,
    // a Marketing tab in DealerOS). Wire the loader for EVERYONE so navigating to it
    // never lands on an empty panel — this was the "leaderboard doesn't show" bug on
    // the Facebook Solo/Dealer tiers, where the account is personal / has no team.
    __pageInit.leaderboard = () => { try { initGlobalLeaderboard(); } catch (e) {} try { loadLeaderboard(); } catch (e) {} };
    // No real team to rank against (solo / personal): default the carousel to the
    // Global view and drop the "My Team" toggle — Global is the meaningful board.
    if (!(inDealership && !isPersonal)) {
      document.getElementById('lb-tab-team')?.classList.add('hidden');
    }

    // Set permission flags used by switchPage to mirror panels into Insights
    __canSeeLeaderboard = inDealership && !isPersonal;
    __canSeeTeamInsights = isAdmin;
    __canSeeSalesTeam = isAdmin;

    // The Dashboard hosts the internal sales-performance board (real deals: sold +
    // F&I + appraisals). The full Team+Global "teaser" board is a Marketing page.
    // Facebook-only tier is the exception — its dashboard IS the full board.
    if (__canSeeLeaderboard) {
      if (__fbOnly) { try { loadLeaderboard(); } catch {} }
      else { try { loadInternalBoard(); } catch {} }
    }
    if (['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(role) && typeof loadDealerDash === 'function') {
      document.getElementById('dealer-dash')?.classList.remove('hidden');
      loadDealerDash();
    }

    // Wire up the sidebar nav — leaves navigate; some carry a CRM tab to open.
    document.querySelectorAll('#dashboard-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page, tab = btn.dataset.tab;
        // The Customers page can be pre-filtered (Sold view), scoped to the rep's own
        // book ("My Customer Database"), or opened straight into the Add form.
        if (page === 'crm') {
          __crmStatusFilter = btn.dataset.filter === 'sold' ? 'sold,fni,delivered' : '';
          __crmSourceFilter = '';   // start each CRM view unfiltered by source

          __crmInitRep = btn.dataset.crmView === 'mine' ? (profileContext?.id || '') : '';
          // "Search Customers" spans the whole dealership; "My Customer Database" is the rep's own.
          __crmSearchAll = btn.dataset.crmView === 'all';
          __crmPendingAdd = btn.dataset.crmAction === 'add';
        }
        // The Inventory page renders differently for the Facebook posting hub vs
        // the manual (Inventory Intelligence) list — the nav leaf carries the mode.
        if (page === 'inventory' && btn.dataset.invmode) __inventoryMode = btn.dataset.invmode;
        if (page === 'profile' && tab) __settingsTab = tab;
        switchPage(page);
        btn.blur();   // drop the focus outline so it doesn't linger on the old item
      });
    });
    setupMobileMoreMenu();
    // DealerOS: managers/admins land on the Command Center (today's operations +
    // exceptions); reps keep the Dashboard as home.
    const __mgrHome = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    // SaaS Admin in MarketSync mode → the company command center; otherwise the
    // dealership Command Center (managers) or the rep Dashboard.
    if (__dashMode === 'marketsync' && (profileContext?.workspace === 'saas_admin' || document.documentElement.getAttribute('data-dash-owner') === '1')) switchPage('saas-command');
    else switchPage(__mgrHome ? 'command' : 'insights');
    applyFeatureFlags();   // hide nav for features the dealer switched off
    // Entitlement-driven front door. Prefer the normalized access context (composes
    // subscription tier + product membership + role) and fall back to the legacy
    // /auth/me products object. This is what stops every login landing on Facebook.
    applyProductNav(legacyProductsFromAccess(window.__access) || profileContext?.products);
    // Flatten the left nav to departments for the full DealerOS manager/admin view
    // (runs after all gating so it derives visibility from the settled nav).
    renderDeptNav(profileContext?.role);
    renderUpgradeCta();           // "Upgrade plan" CTA unless already on the full bundle
    applyExtensionVisibility();   // hide the FB extension CTA for SaaS / AI-only accounts

    // Global leaderboard — available to EVERYONE (solo reps included). Loaded lazily on first carousel switch.
    initGlobalLeaderboard();

    if (isAdmin) {
      document.getElementById('leaderboard-panel')?.classList.remove('hidden');
      document.getElementById('dealer-view-panel')?.classList.remove('hidden');
      // Team players + trend charts now live on the Insights page (admin only)
      document.getElementById('insights-team-section')?.classList.remove('hidden');
      loadCharts();
      loadDealerManagementMatrix();
    } else {
      document.getElementById('rep-view-panel').classList.remove('hidden');
      loadMyStats();
    }

} catch (err) {
    if (err.message === 'TRIAL_EXPIRED') {
      // Free trial lapsed — show the blocking paywall popup with all packages to choose.
      openPaywallModal('trial_ended');
      return;
    }
    if (err.message === 'SUBSCRIPTION_REQUIRED') {
      // No active subscription — same paywall (pick a package to continue).
      openPaywallModal('subscription_required');
      return;
    }
    if (err.message === 'SESSION_EXPIRED') {
      // Genuine 401 from the server — token really is invalid/expired. Safe to log out.
      clearLocalStorage();
      window.location.href = 'login.html';
      return;
    }
    // Anything else (network blip, cold-start timeout, a render-time JS error, etc.)
    // is NOT proof the session is invalid. Logging out here is what causes the
    // dashboard <-> login flicker loop. Show an inline error and let the user retry
    // instead of nuking their session.
   console.error('Dashboard init failed (non-auth error):', err);
    const banner = document.createElement('div');
    banner.className = 'fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm text-center py-2';
    banner.innerHTML = `Something went wrong loading the dashboard. <button onclick="window.location.reload()" class="underline font-bold ml-2">Retry</button>`;
    document.body.prepend(banner);
    document.body.classList.add('ms-role-ready'); // reveal page instead of leaving it stuck hidden
  }
}

// Sidebar nav page switcher. Each page shows only its own content — no panel
// mirroring, so Insights stays clean and each nav item lands on a focused view.
// Per-dealer feature toggles — hide nav for features the dealer switched off
// (entitlement still governs access; this is a visibility preference on top).
let __featureFlags = null;
const FEATURE_NAV = {
  // Target the website leaves, not the whole Marketing group — the group also holds
  // Marketplace + AI Chat, which the website toggle must not hide.
  website: '[data-page="website"], [data-page="website-settings"]',
  automation: '[data-page="automation"]',
  equity: '[data-page="equity"]',
  inv_intel: '.nav-group[data-group="ii"]',
  appraisals: '#nav-appraisal',
  reports: '#nav-reports, #nav-reports-m',
};
async function applyFeatureFlags(force) {
  if (__featureFlags === null || force) {
    try { const d = await apiGetJson('/dealership/features', { retries: 1 }); __featureFlags = d?.features || {}; }
    catch { __featureFlags = {}; return; }
  }
  // Use a dedicated `ff-off` class so we never fight the `hidden` class that
  // role/entitlement gating owns — an item hides if role-hidden OR feature-off.
  for (const [k, sel] of Object.entries(FEATURE_NAV)) {
    const off = __featureFlags[k] === false;
    document.querySelectorAll(sel).forEach(el => el.classList.toggle('ff-off', off));
  }
  // Collapse the Sales group if turning a feature off left it with nothing to show.
  if (typeof syncNavGroupVisibility === 'function') syncNavGroupVisibility();
}
window.applyFeatureFlags = applyFeatureFlags;

// How-to guide — open the full guide page inside an in-app modal (iframe),
// not a separate browser tab. Loaded lazily on first open.
function openGuideModal() {
  const m = document.getElementById('guide-modal'), f = document.getElementById('guide-frame');
  if (!m || !f) return;
  if (!f.getAttribute('src')) f.setAttribute('src', '/guide.html');
  m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeGuideModal() {
  const m = document.getElementById('guide-modal');
  if (m) m.classList.add('hidden');
  document.body.style.overflow = '';
}
window.openGuideModal = openGuideModal;
window.closeGuideModal = closeGuideModal;
document.addEventListener('click', (e) => { if (e.target && e.target.id === 'guide-modal') closeGuideModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.getElementById('guide-modal')?.classList.contains('hidden')) closeGuideModal(); });

// Collapse/expand a nav group in the desktop sidebar.
function toggleNavGroup(id) {
  const body = document.getElementById('grp-' + id);
  const chev = document.getElementById('chev-' + id);
  if (!body) return;
  const collapsed = body.classList.toggle('hidden');
  chev?.classList.toggle('-rotate-90', collapsed);
  if (!collapsed) {
    checkDepartmentOpen(id);
  }
}
window.toggleNavGroup = toggleNavGroup;

// Show/hide a nav group by whether it has any visible destination (e.g. Sales,
// which holds Appraisals + Equity). Only touches groups WITHOUT their own admin
// gating (`data-admin-nav`), so it can never reveal an admin-only group.
function syncNavGroupVisibility() {
  document.querySelectorAll('#nav-desktop .nav-group').forEach(g => {
    if (g.hasAttribute('data-admin-nav')) return;   // its own gating owns visibility
    const leaves = [...g.querySelectorAll('.nav-group-body .nav-item')];
    if (!leaves.length) return;
    const anyVisible = leaves.some(el => !el.classList.contains('hidden') && !el.classList.contains('ff-off'));
    g.classList.toggle('hidden', !anyVisible);
  });
}
window.syncNavGroupVisibility = syncNavGroupVisibility;

// The Sales menu reads differently by role: a rep sees "My Tasks / My Appointments"
// and no Leads item; a manager/dealer-admin sees "All Tasks / All Appointments" plus
// the manager-only Leads worklist.
function personalizeSalesNav() {
  const isMgr = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
  const setLbl = (id, txt) => { const el = document.getElementById(id)?.querySelector('[data-nav-label]'); if (el) el.textContent = txt; };
  setLbl('nav-tasks', isMgr ? 'All Tasks' : 'My Tasks');
  setLbl('nav-appointments', isMgr ? 'All Appointments' : 'My Appointments');
  setLbl('nav-leads-sales', isMgr ? 'All Leads' : 'My Leads');
  document.getElementById('nav-leads-sales')?.classList.toggle('hidden', !isMgr);
  document.getElementById('nav-fni-deals')?.classList.toggle('hidden', !isMgr);
}
window.personalizeSalesNav = personalizeSalesNav;

// Header "Post to Facebook" button — opens the Marketplace posting hub (the old
// Facebook › Marketplace nav leaf, now promoted to a one-click header action).
function postToFacebook() { __inventoryMode = 'facebook'; switchPage('inventory'); }
window.postToFacebook = postToFacebook;

// The rank chip + old leaderboard deep links open the full Team+Global board.
// It's a Marketing-department page now (except the Facebook-only tier, where it
// still lives on the dashboard).
function openLeaderboardOnDash() {
  if (__fbOnly) {
    switchPage('insights');
    setTimeout(() => { try { document.getElementById('leaderboard-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 120);
    return;
  }
  switchPage('leaderboard');
  setTimeout(() => { try { document.getElementById('leaderboard-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {} }, 120);
}
window.openLeaderboardOnDash = openLeaderboardOnDash;

// ═══════════════════════════════════════════════════════════════════════════
// Departments — the user-facing navigation unit. A department groups several
// existing pages; when you're on one of its pages, the others appear as tabs
// at the top of the content (renderDeptTabbar). Engines stay behind the wall:
// a department's pages are quietly powered by whatever engines they need.
// Single-workspace departments (Executive, admin) use the in-body 5-tab shell
// instead; those pages are intentionally NOT listed here.
// ═══════════════════════════════════════════════════════════════════════════
// `mgr:true` (department or page) = managers/owners/admins only. `roles:[...]` = an
// explicit allow-list. Nothing set = everyone in the dealership (reps included).
// A sales rep therefore sees Sales, Detail/Cleanup and Marketing — with the
// manager/analyst pages inside them hidden — and nothing else. Settings isn't a
// department; the header gear owns it.
//
// ✅ SOURCE OF TRUTH for the dashboard sidebar navigation now lives in
//    js/modules/workspace-registry.js (MS_WORKSPACES) — it is the ONE registry the
//    desktop sidebar, the workspace tab-bar and the mobile bottom row all derive
//    from. To add/rename/reorder/gate a nav item or workspace, edit THERE
//    (and SAAS_DEPARTMENTS below for MarketSync owner mode).
//    The static #nav-desktop tree in dashboard.html is LEGACY and hidden — never
//    edit nav there. See the "LEGACY HARDCODED SIDEBAR" banner in dashboard.html
//    and docs/DEALEROS_UI_AUDIT.md for the full page → workspace mapping.
//
// DEPARTMENTS stays as the name every renderer below already uses, so the
// registry swap needs no changes to renderDeptNav/renderDeptTabbar/deptOpen/
// applyMobileQuickRow. The inline fallback keeps the dashboard navigable if the
// registry file ever fails to load (nav is presentation; the API still enforces
// permissions server-side).
const DEPARTMENTS = (typeof MS_WORKSPACES !== 'undefined' && MS_WORKSPACES) || {
  executive: { label: 'Executive', icon: 'chart', accent: 'indigo', mgr: true, pages: [{ page: 'command', label: 'Overview' }] },
  sales: {
    label: 'Sales', icon: 'currency', accent: 'amber',
    pages: [
      { page: 'insights', label: 'Overview' },
      { page: 'crm', label: 'Customers' },
      { page: 'appointments', label: 'Appointments' },
      { page: 'tasks', label: 'Tasks' },
    ],
  },
};
// Role gate for a department or page spec: explicit `roles` list wins, else `mgr`
// means managers/owners/admins only, else everyone in the dealership.
const DEPT_MGR_ROLES = ['DEALER_ADMIN', 'OWNER', 'MANAGER'];
function deptRoleOk(spec) {
  if (!spec) return true;
  if (Array.isArray(spec.roles)) return spec.roles.includes(profileContext?.role);
  if (spec.mgr) return DEPT_MGR_ROLES.includes(profileContext?.role);
  return true;
}
let __activeDept = null;
let __currentPage = null;

// ── Plan-tier feature gating for the Dealer OS department nav ─────────────────
// Maps every DealerOS nav page → the access-context entitlement required for it to
// show. This makes each plan's sidebar match the plan catalog instead of treating
// every DealerOS account as Pro.
const PAGE_FEATURE = {
  command: 'os.dashboard', insights: 'os.dashboard',
  crm: 'os.crm', leads: 'os.crm', appointments: 'os.crm', tasks: 'os.crm',
  appraisal: 'os.crm', equity: 'os.crm',
  inventory: 'os.inventory', recon: 'os.inventory',
  accounting: 'os.accounting',
  'service-ros': 'os.service', 'service-appointments': 'os.service', 'service-parts': 'os.service',
  website: 'os.website',
  'automation-builder': 'os.automations', operations: 'os.automations', taskboard: 'os.automations',
  'email-marketing': 'os.email_marketing',
  delivery: 'os.sales', fni: 'os.sales',
  reports: 'os.reports',
  'inv-intel': 'os.inventory', market: 'os.inventory',
  'ai-home': 'os.marketing', 'ai-inbox': 'os.marketing',
  'api-keys': 'os.integrations',
  'owner-users': 'os.team', 'sales-team': 'os.team', 'people-compliance': 'os.team', hr: 'os.team', people: 'os.team',
  config: 'os.settings',
};
const PAGE_PRODUCT = { leaderboard: 'facebook' };
// The dealership record also carries its server-authored package name. This fallback
// keeps the DealerOS menu stable during an access-context retry/cold start; it only
// affects navigation presentation — API permissions remain enforced on the server.
const DEALER_OS_PLAN_FEATURES = {
  starter: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings']),
  growth: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.team', 'os.settings', 'os.sales', 'os.accounting', 'os.marketing', 'os.website', 'os.automations', 'os.integrations']),
  pro: new Set(['os.dashboard', 'os.crm', 'os.inventory', 'os.sales', 'os.accounting', 'os.service', 'os.marketing', 'os.website', 'os.reports', 'os.automations', 'os.email_marketing', 'os.integrations', 'os.team', 'os.settings', 'fb.inventory', 'fb.leaderboard', 'fb.sales_reps', 'ai.overview', 'ai.conversations', 'ai.agents', 'ai.knowledge', 'ai.settings']),
};
function dealerPlanFallback() {
  const plan = String(profileContext?.plan || profileContext?.dealership?.plan || '').toLowerCase();
  const features = DEALER_OS_PLAN_FEATURES[plan];
  if (!features) return { features: null, products: null };
  return { features, products: plan === 'pro' ? new Set(['dealer_os', 'facebook', 'ai_dealer']) : new Set(['dealer_os']) };
}
// Dealer-controlled switches are a second visibility layer after the paid plan.
// Keep this mapping page-based rather than deriving it from the legacy sidebar DOM:
// the department nav is its own renderer and must not disappear merely because the
// old nested menu happens to be collapsed or hidden for presentation reasons.
const PAGE_DEALER_FLAG = {
  website: 'website',
  'automation-builder': 'automation', operations: 'automation', taskboard: 'automation',
  equity: 'equity',
  appraisal: 'appraisals',
  reports: 'reports',
  'inv-intel': 'inv_intel', market: 'inv_intel',
};
// True unless this page maps to a feature the plan doesn't include. Scoped to full
// Dealer OS mode: restricted product tiers (Facebook / AI) use their own page sets, and
// window.hasFeature fails OPEN when /access/context is unavailable, so legacy accounts
// and an older backend are never over-filtered.
function pageFeatureOk(pg, invmode = null) {
  if (__productAllowedPages || __fbOnly) return true;   // restricted tiers handled by product nav
  const access = window.__access;
  const fallback = dealerPlanFallback();
  const requiredProduct = (pg === 'inventory' && (invmode || __inventoryMode) === 'facebook')
    ? 'facebook' : PAGE_PRODUCT[pg];
  if (requiredProduct) {
    // The entitlement context is derived server-side from live subscription rows. Until
    // it is available, do not advertise an add-on as part of a lower DealerOS plan.
    return !!((access && (access.isPlatformStaff || (access.products || []).includes(requiredProduct)))
      || fallback.products?.has(requiredProduct));
  }
  const feat = PAGE_FEATURE[pg];
  if (!feat) return true;
  return !!((access && (access.isPlatformStaff || (access.features || []).includes(feat)))
    || fallback.features?.has(feat));
}

// Is a page reachable for this user? Respect the per-item gating that product /
// role / feature flags apply by toggling the `hidden` class on nav items.
function deptPageVisible(pg, invmode = null) {
  if (!pageFeatureOk(pg, invmode)) return false;   // plan-tier entitlement gate
  if (__staffAllowedPages && !__staffAllowedPages.has(pg)) return false;
  const dealerFlag = PAGE_DEALER_FLAG[pg];
  return !dealerFlag || __featureFlags?.[dealerFlag] !== false;
}
function renderDeptTabbar(pageId) {
  const bar = document.getElementById('dept-tabbar');
  if (!bar) return;
  const hide = () => { bar.classList.add('hidden'); bar.innerHTML = ''; };
  if (__fbOnly) { __activeDept = null; return hide(); }   // stripped Facebook-only tier
  if (__productAllowedPages) { __activeDept = null; return hide(); }   // restricted product tiers use their flat nav, no dept tab-bar
  // MarketSync owner mode uses the SaaS departments, not the dealership ones.
  if (document.documentElement.getAttribute('data-dash-mode') === 'marketsync') { __activeDept = null; return hide(); }
  // Sticky: keep the current department if it owns this page, else find the owner.
  let deptId = (__activeDept && DEPARTMENTS[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
             : Object.keys(DEPARTMENTS).find(d => DEPARTMENTS[d].pages.some(p => p.page === pageId));
  if (!deptId) { __activeDept = null; return hide(); }
  __activeDept = deptId;
  const dept = DEPARTMENTS[deptId];
  const pages = dept.pages.filter(deptPageAllowed);
  if (pages.length <= 1) return hide();   // nothing to move between → no tab-bar
  const A = ENGINE_ACCENTS[dept.accent] || ENGINE_ACCENTS.indigo;
  const tabs = pages.map(p => {
    const on = p.page === pageId && (!p.invmode || p.invmode === __inventoryMode);
    return `<button onclick="deptGo('${p.page}'${p.invmode ? `,'${p.invmode}'` : ''})" class="px-3.5 py-2 -mb-px border-b-2 text-[13px] font-bold whitespace-nowrap transition ${on ? A.text + ' border-current' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}">${esc(p.label)}</button>`;
  }).join('');
  bar.innerHTML = `
    <div class="flex items-center gap-2 mb-1">
      <span class="w-7 h-7 rounded-lg ${A.bg} ${A.text} flex items-center justify-center flex-shrink-0">${svgIcon(dept.icon || 'dot', 'w-4 h-4')}</span>
      <span class="text-sm font-black text-slate-900 dark:text-white">${esc(dept.label)}</span>
    </div>
    <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">${tabs}</div>`;
  bar.classList.remove('hidden');
}
// Navigate to a department page (handles the inventory view-mode tabs).
function deptGo(page, invmode) { if (invmode) __inventoryMode = invmode; switchPage(page); }
window.deptGo = deptGo;

// ── Flat department LEFT nav ─────────────────────────────────────────────────
// The legacy left nav is a deep, mode-aware tree. For the full DealerOS
// manager/admin experience we replace it with a flat department list (the
// legacy tree is hidden, not removed, so all its gating still drives which
// departments/pages are reachable). Reps, product tiers, Facebook-only and
// MarketSync owner mode keep the legacy nav untouched — zero regression.
// The MarketSync owner's SaaS back office is its own flat department list —
// the company operating system, not a dealership.
const SAAS_DEPARTMENTS = {
  hq:         { label: 'MarketSync HQ',    icon: 'chart',    accent: 'violet', pages: [{ page: 'saas-command', label: 'HQ' }] },
  pipeline:   { label: 'Customer Pipeline', icon: 'chart',   accent: 'violet', pages: [{ page: 'saas-customers', label: 'Pipeline' }] },
  followups:  { label: 'Follow-ups',        icon: 'bolt',    accent: 'violet', pages: [{ page: 'saas-followups', label: 'Follow-ups' }] },
  funnel:     { label: 'Funnel',            icon: 'chart',   accent: 'violet', pages: [{ page: 'saas-funnel', label: 'Funnel' }] },
  automation: { label: 'Automation',        icon: 'bolt',    accent: 'violet', pages: [{ page: 'saas-automation', label: 'Automation' }] },
  employees:  { label: 'Employees',        icon: 'user',     accent: 'violet', pages: [{ page: 'saas-employees', label: 'Employees' }] },
  accounts:   { label: 'All Users',        icon: 'user',     accent: 'violet', pages: [{ page: 'owner-users', label: 'Accounts' }] },
  affiliates: { label: 'Affiliates',       icon: 'trophy',   accent: 'amber',   pages: [{ page: 'affiliates-admin', label: 'Affiliates' }] },
  accounting: { label: 'Accounting',       icon: 'currency', accent: 'emerald', always: true, pages: [{ page: 'saas-accounting', label: 'Accounting' }] },
  settings:   { label: 'Settings',         icon: 'user',     accent: 'indigo',  always: true, pages: [{ page: 'profile', label: 'Settings' }] },
};
let __deptNavBuilt = false;
let __deptRegistry = DEPARTMENTS;   // which department set the flat nav is showing
function marketsyncOwnerMode() {
  return document.documentElement.getAttribute('data-dash-owner') === '1'
    && document.documentElement.getAttribute('data-dash-mode') === 'marketsync';
}
function deptNavEligible(role) {
  // The department (DealerOS) nav is the ONE nav for every dealership user — reps
  // included. Each department/page is filtered to what that user can actually see
  // (deptVisible / deptPageVisible respect role + solo + feature-flag gating), so a
  // rep simply gets fewer departments. Excluded only for the tiers that run their
  // own nav: specialized staff workspaces, Facebook-only, restricted products, and
  // the MarketSync back office.
  return !!role
    && !__fbOnly
    && !__staffAllowedPages
    && document.documentElement.getAttribute('data-dash-mode') !== 'marketsync'
    && __productAllowedPages == null;
}
// A page the current user may actually open: role-allowed AND not entitlement/flag hidden.
function deptPageAllowed(p) { return deptRoleOk(p) && deptPageVisible(p.page, p.invmode); }
function deptHomePage(dept) { return dept.pages.find(deptPageAllowed) || dept.pages.find(deptRoleOk) || dept.pages[0]; }
// A department is present when it has one page the user's role and plan both permit.
// Do not inspect the old nested sidebar here: it is merely a legacy presentation tree
// and its hidden/collapsed classes are not an entitlement signal.
function deptHasRealPage(dept) {
  return dept.pages.some(deptPageAllowed);
}
function deptVisible(dept) {
  if (!deptRoleOk(dept)) return false;   // role gate first (managers-only departments)
  if (dept.always) return true;
  if (deptHasRealPage(dept)) return true;
  if (dept.probe) { const el = document.querySelector(dept.probe); if (el && !el.classList.contains('hidden')) return true; }
  return false;
}
function renderDeptNav(role) {
  const navRoot = document.getElementById('nav-desktop');
  if (!navRoot) return;
  // Owner in the SaaS back office → the SaaS departments; a dealer manager in full
  // DealerOS → the dealership departments; anyone else → the legacy nav.
  const registry = marketsyncOwnerMode() ? SAAS_DEPARTMENTS : (deptNavEligible(role) ? DEPARTMENTS : null);
  // The mode is now decided — reveal the sidebar (clears the pre-nav hidden state
  // so the legacy tree never flashes before the department nav for eligible users).
  navRoot.classList.remove('nav-init');
  if (!registry) {
    // Restricted product / Facebook tiers: render their nav from the same registry
    // the mobile menu uses (restrictedNavPages) — a flat page list — so desktop and
    // mobile are one source of truth and there's no hardcoded sidebar.
    const rp = restrictedNavPages();
    if (rp && rp.length) {
      __deptRegistry = null;   // flat page list, not a department registry
      let host = document.getElementById('dept-nav');
      if (!host) {
        host = document.createElement('div'); host.id = 'dept-nav'; host.className = 'space-y-0.5 mb-1';
        const anchor = document.getElementById('setup-bar-host');
        if (anchor && anchor.parentElement === navRoot) navRoot.insertBefore(host, anchor.nextSibling);
        else navRoot.insertBefore(host, navRoot.firstChild);
      }
      host.innerHTML = rp.map(p => `<button type="button" data-page="${esc(p.page)}" onclick="deptGo('${p.page}'${p.invmode ? `,'${p.invmode}'` : ''})" title="${esc(p.label)}" class="dept-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="text-indigo-500 flex-shrink-0">${svgIcon(p.icon || 'dot', 'w-4 h-4')}</span><span>${esc(p.label)}</span></button>`).join('');
      navRoot.classList.add('dept-mode');
      __deptNavBuilt = true;
      if (__currentPage) highlightDeptNav(__currentPage);
      applyMobileQuickRow();   // keep the bottom quick-row in sync with this registry
      return;
    }
    navRoot.classList.remove('dept-mode'); document.getElementById('dept-nav')?.remove(); __deptNavBuilt = false; return;
  }
  __deptRegistry = registry;
  let host = document.getElementById('dept-nav');
  if (!host) {
    host = document.createElement('div'); host.id = 'dept-nav'; host.className = 'space-y-0.5 mb-1';
    const anchor = document.getElementById('setup-bar-host');   // sit below the setup bar if present
    if (anchor && anchor.parentElement === navRoot) navRoot.insertBefore(host, anchor.nextSibling);
    else navRoot.insertBefore(host, navRoot.firstChild);
  }
  // Departments render in workflow order; `system: true` workspaces (Settings and
  // anything else that is not a dealership department) drop to a separate rail at
  // the bottom, under a divider — an employee scans DEPARTMENTS first.
  const navBtn = ([id, d]) => {
    const A = ENGINE_ACCENTS[d.accent] || ENGINE_ACCENTS.indigo;
    return `<button type="button" data-dept="${id}" onclick="deptOpen('${id}')" title="${esc(d.label)}" class="dept-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="${A.text} flex-shrink-0">${svgIcon(d.icon || 'dot', 'w-4 h-4')}</span><span>${esc(d.label)}</span></button>`;
  };
  const visible = Object.entries(registry).filter(([, d]) => deptVisible(d));
  const departments = visible.filter(([, d]) => !d.system);
  const system = visible.filter(([, d]) => d.system);
  host.innerHTML = departments.map(navBtn).join('')
    + (system.length ? `<div class="my-1.5 border-t border-slate-200 dark:border-slate-800"></div>${system.map(navBtn).join('')}` : '');
  navRoot.classList.add('dept-mode');
  __deptNavBuilt = true;
  if (__currentPage) highlightDeptNav(__currentPage);
  applyMobileQuickRow();   // bottom quick-row mirrors the DEPARTMENTS registry too
}
window.renderDeptNav = renderDeptNav;
function deptOpen(id) {
  const d = __deptRegistry[id]; if (!d) return;
  __activeDept = id;
  const home = deptHomePage(d);
  if (home.invmode) __inventoryMode = home.invmode;
  switchPage(home.page);
}
window.deptOpen = deptOpen;
function highlightDeptNav(pageId) {
  if (!__deptNavBuilt) return;
  const reg = __deptRegistry;
  // Restricted tiers render a FLAT page list (no dept registry): highlight by data-page.
  if (!reg) {
    document.querySelectorAll('#dept-nav .dept-nav-item').forEach(b => {
      const on = b.dataset.page === pageId;
      b.classList.toggle('bg-indigo-100', on); b.classList.toggle('dark:bg-indigo-950/50', on);
      b.classList.toggle('text-indigo-700', on); b.classList.toggle('dark:text-indigo-300', on);
      b.classList.toggle('text-slate-700', !on); b.classList.toggle('dark:text-slate-300', !on);
    });
    return;
  }
  const deptId = (__activeDept && reg[__activeDept]?.pages.some(p => p.page === pageId)) ? __activeDept
               : Object.keys(reg).find(d => reg[d].pages.some(p => p.page === pageId));
  document.querySelectorAll('#dept-nav .dept-nav-item').forEach(b => {
    const on = b.dataset.dept === deptId;
    b.classList.toggle('bg-indigo-100', on); b.classList.toggle('dark:bg-indigo-950/50', on);
    b.classList.toggle('text-indigo-700', on); b.classList.toggle('dark:text-indigo-300', on);
    b.classList.toggle('text-slate-700', !on); b.classList.toggle('dark:text-slate-300', !on);
  });
}

function switchPage(pageId) {
  ensurePanelsInOriginalLocations();

  // Pipeline is retired — old deep links land on the Customers page.
  if (pageId === 'pipeline') pageId = 'crm';
  // The three automation follow-up pages are now tabs inside one Builder page —
  // keep old deep links (notifications, mobile nav) working by mapping to the tab.
  if (pageId === 'auto-holidays' || pageId === 'auto-leads' || pageId === 'auto-delivery') {
    __autoTab = pageId === 'auto-holidays' ? 'holidays' : pageId === 'auto-delivery' ? 'delivery' : 'leads';
    pageId = 'automation-builder';
  }
  // Facebook-only tier: only the Facebook hub, leaderboard and settings are reachable.
  if (__fbOnly && !FB_ONLY_PAGES.has(pageId)) { __inventoryMode = 'facebook'; pageId = 'inventory'; }
  // Product-restricted tiers (Facebook Solo/Dealer, AI Chatbot): keep them inside
  // their page set so a stale link or hardcoded mobile button can't reach full-OS
  // pages. 'profile' (header gear) is always allowed.
  if (__productAllowedPages && pageId !== 'profile' && !__productAllowedPages.has(pageId)) {
    pageId = __productHome || 'profile';
    if (pageId === 'inventory') __inventoryMode = 'facebook';
  }

  // Old DealerOS bookmarks used the MarketSync-only owner-users route. Keep those
  // bookmarks useful without ever sending a dealership admin to the platform-wide
  // account API. MarketSync HQ continues to use owner-users unchanged.
  if (pageId === 'owner-users' && !marketsyncOwnerMode()) pageId = 'sales-team';

  // Specialized staff role (F&I, Service, Accounting, Cleanup): anything outside
  // their workspace bounces to their home page. Guards deep links & stale nav too.
  if (__staffAllowedPages && !__staffAllowedPages.has(pageId)) { pageId = __staffHome; }

  // Plan-tier gate: a page whose feature the current plan doesn't include bounces to a
  // safe home. The API + RLS already deny the data; this keeps the UI from opening an
  // empty/403 page from a stale link. profile (settings) is always reachable.
  if (pageId !== 'profile' && !pageFeatureOk(pageId)) {
    pageId = (typeof deptNavEligible === 'function' && deptNavEligible(profileContext?.role)) ? 'command' : 'insights';
  }

  // Accounting has one container but each nav leaf (acct-insights, acct-tax, …) is
  // its own "page" — map those to the shared accounting container.
  const contentKey = (typeof pageId === 'string' && pageId.startsWith('acct-')) ? 'accounting' : pageId;
  document.querySelectorAll('[data-page-content]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.pageContent !== contentKey);
  });
  document.querySelectorAll('#dashboard-nav .nav-item, #nav-vin-sticker, #nav-inv-intel, #nav-ai-vision').forEach(btn => {
    let active = btn.id === 'nav-inv-intel' ? pageId === 'inv-intel'
                 : btn.id === 'nav-vin-sticker'? pageId === 'vin-sticker'
                 : btn.id === 'nav-ai-vision' ? pageId === 'ai-vision'
                 // Marketplace (facebook) and Inventory List (manual) share data-page
                 // "inventory" — disambiguate by mode so only the active one highlights.
                 : btn.dataset.page === pageId
                   && (pageId !== 'inventory' || !btn.dataset.invmode || btn.dataset.invmode === __inventoryMode);
    // The Customers page has three nav leaves that all share data-page="crm"
    // (Add Customer, Search Customers, My Customer Database). Only the one matching
    // the current view should light up — otherwise they all highlight together.
    if (active && pageId === 'crm') {
      if (btn.dataset.crmAction === 'add') active = false;                       // Add is an action, not a view
      else if (btn.dataset.crmView) active = (btn.dataset.crmView === 'all') === !!__crmSearchAll;
    }
    btn.classList.toggle('bg-indigo-100', active);
    btn.classList.toggle('dark:bg-indigo-950/50', active);
    btn.classList.toggle('text-indigo-700', active);
    btn.classList.toggle('dark:text-indigo-300', active);
    btn.classList.toggle('text-slate-700', !active);
    btn.classList.toggle('dark:text-slate-300', !active);
    // Explicit active flag so the highlight always reflects the current page,
    // even for the specially-handled (non data-page) nav buttons.
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });

  // Groups load collapsed; expand any group that contains the active page so
  // the current item is visible (a page can live in more than one group).
  document.querySelectorAll('#nav-desktop .nav-item[aria-current="page"]').forEach(leaf => {
    // Walk up EVERY enclosing group body (a page can sit inside a nested subgroup,
    // e.g. Automation → Builder → New Lead Follow-ups) so both levels expand.
    let body = leaf.closest('.nav-group-body');
    while (body) {
      if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        document.getElementById('chev-' + body.id.replace('grp-', ''))?.classList.remove('-rotate-90');
      }
      body = body.parentElement?.closest('.nav-group-body');
    }
  });

  // Fire any one-time lazy loaders registered for this page (feeds, catalog,
  // leaderboard, guardrail settings, inventory-intelligence tags).
  runPageInit(pageId);

  if (pageId === 'inventory') applyInventoryMode();
  if (pageId === 'recon') loadReconPage();
  if (pageId === 'vin-sticker') loadVinStickerPage();
  if (pageId === 'profile') { loadProfileBranding(); loadCrmAdfSetting(); settingsTab(__settingsTab); }
  if (pageId === 'inv-intel' && typeof window._invIntelPageHook === 'function') window._invIntelPageHook();
  if (pageId === 'ai-vision') loadAiVisionPage();
  if (pageId === 'reports') loadReports();
  if (pageId === 'commissions') loadCommissionsPage();
  if (contentKey === 'accounting') loadAccountingPage(pageId.startsWith('acct-') ? pageId.slice(5) : undefined);
  if (pageId === 'affiliates-admin') loadAffiliatesAdmin();
  if (pageId === 'desk') loadDeskDeal();
  if (pageId === 'crm') loadCrmPage();
  if (pageId === 'leads') loadLeadsPage();
  if (pageId === 'appointments') loadAppointmentsPage();
  if (pageId === 'service-appointments') loadServiceAppointments();
  if (pageId === 'service-settings') loadServiceSettings();
  if (pageId === 'tasks') crmLoadTasks();
  if (pageId === 'market') loadMarketPage();
  if (pageId === 'website') loadWebsitePage();
  if (pageId === 'website-settings') loadWebsiteSettings();
  if (pageId === 'automation') loadAutomationPage();
  if (pageId === 'automation-builder') loadAutoBuilderPage();
  if (pageId === 'email-marketing' || pageId === 'email-campaigns') loadDealerEmail();
  if (pageId === 'academy') loadAcademyPage();
  if (pageId === 'fni') loadFniPage();
  if (pageId === 'equity') loadEquityPage();
  if (pageId === 'appraisal') { initAppraisal(); loadApprList(); apprEnsureBranding(); }
  if (pageId === 'taskboard') loadTaskBoard();
  if (pageId === 'command') loadCommandCenter();
  if (pageId === 'saas-command') loadSaasCommand();
  if (pageId === 'saas-customers') loadSaasCustomers();
  if (pageId === 'saas-followups') loadSaasFollowups();
  if (pageId === 'saas-funnel') loadSaasFunnel();
  if (pageId === 'saas-automation') loadSaasAutomation();
  if (pageId === 'saas-employees') loadSaasEmployees();
  if (pageId === 'saas-accounting') loadSaasAccounting();
  if (pageId === 'config') loadConfigHub();
  if (pageId === 'api-keys') loadApiKeys();
  if (pageId === 'delivery') loadDeliveryQueue();
  if (pageId === 'solo-home') loadSoloHome();
  if (pageId === 'ai-home') loadAiHome();
  if (pageId === 'sales-team' && typeof loadDealerManagementMatrix === 'function') { try { loadDealerManagementMatrix(); } catch {} }
  if (pageId === 'operations') loadOperationsPage();
  if (pageId === 'service-ros') loadServiceRosPage();
  if (pageId === 'service-parts') loadServicePartsPage();
  if (pageId === 'owner-users') loadOwnerUsersPage();
  if (pageId === 'ai-inbox') loadAiInbox();
  if (pageId === 'people-compliance' || pageId === 'hr' || pageId === 'people') loadPeopleCompliance();

  __currentPage = pageId;
  checkDepartmentOpen(pageId);
  renderDeptTabbar(pageId);
  highlightDeptNav(pageId);
}


// ── Trade Appraisal ──────────────────────────────────────────────────────────
let __apprWired = false;
let __apprDefaults = { recon: 1200, gross: 2500 };   // manager-set appraisal defaults
let __apprCanEditDefaults = false;
// Manager-only control to set the store's default recon + target gross (persists to
// the dealership; every new appraisal starts from these).
function renderApprDefaultsControl() {
  const slot = document.getElementById('appr-defaults-slot'); if (!slot) return;
  if (!__apprCanEditDefaults) { slot.innerHTML = ''; return; }
  const iC = 'w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm text-right tabular-nums';
  slot.innerHTML = `<div class="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
    <span class="font-semibold">Store defaults:</span>
    <span class="inline-flex items-center gap-1">Recon $<input id="appr-def-recon" type="number" min="0" value="${__apprDefaults.recon}" class="${iC}"></span>
    <span class="inline-flex items-center gap-1">Target gross $<input id="appr-def-gross" type="number" min="0" value="${__apprDefaults.gross}" class="${iC}"></span>
    <button onclick="saveApprDefaults()" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Save defaults</button>
    <span class="text-slate-400">— applied to every new appraisal.</span>
  </div>`;
}
async function saveApprDefaults() {
  const recon = Number(document.getElementById('appr-def-recon')?.value);
  const gross = Number(document.getElementById('appr-def-gross')?.value);
  try {
    await apiSendJson('/ai/config', 'PUT', { appraisal_recon_default: recon, appraisal_gross_default: gross });
    __apprDefaults = { recon: Number.isFinite(recon) ? recon : 1200, gross: Number.isFinite(gross) ? gross : 2500 };
    showToast('Appraisal defaults saved', 'success');
  } catch (e) { showToast(e.message || 'Could not save', 'error'); }
}
window.saveApprDefaults = saveApprDefaults;
// ── VIN barcode scanner (camera) ─────────────────────────────────────────────
// Reads the Code 39 / Code 128 / Data-Matrix VIN barcode printed on the driver's
// door jamb or lower windshield using the browser's built-in BarcodeDetector
// (Chromium desktop + Android Chrome). On a match it fills the target input,
// fires an `input` event, and runs the optional afterFill(vin) callback.
function cleanVin(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ''); // VINs exclude I/O/Q
  const m = s.match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : null;
}
// ZXing is our cross-browser fallback decoder — the native BarcodeDetector isn't
// available on iOS (every iPhone browser, incl. "Chrome", is WebKit) or older
// browsers. Loaded lazily from a CDN only the first time a scan is started.
let __zxingPromise = null;
function loadZXing() {
  if (window.ZXing?.BrowserMultiFormatReader) return Promise.resolve(window.ZXing);
  if (__zxingPromise) return __zxingPromise;
  __zxingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';
    s.onload = () => (window.ZXing?.BrowserMultiFormatReader ? resolve(window.ZXing) : reject(new Error('zxing missing')));
    s.onerror = () => { __zxingPromise = null; reject(new Error('zxing load failed')); };
    document.head.appendChild(s);
  });
  return __zxingPromise;
}
// Lazy-load pdf.js (only when a dealer uploads a PDF knowledge base) to pull text.
let __pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (__pdfjsPromise) return __pdfjsPromise;
  __pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s.onload = () => {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; resolve(window.pdfjsLib); }
      catch (e) { reject(e); }
    };
    s.onerror = () => { __pdfjsPromise = null; reject(new Error('pdfjs load failed')); };
    document.head.appendChild(s);
  });
  return __pdfjsPromise;
}
async function extractPdfText(file, options = {}) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let out = '';
  const maxPages = Math.min(pdf.numPages, Number(options.maxPages) > 0 ? Number(options.maxPages) : 40);
  const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : 20000;
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map(it => it.str).join(' ') + '\n';
    if (out.length > maxChars) break;
  }
  return out.slice(0, maxChars);
}