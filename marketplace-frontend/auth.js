/*
 * MarketSync — single shared authentication module (window.MSAuth).
 *
 * This is the one and only source of truth for authentication across every static
 * page (marketing site, login, register, dashboard). The app is a vanilla multi-page
 * site served from ONE origin, so there is no React/Supabase-JS client — the browser
 * equivalent of "one Supabase client + one AuthProvider" is this one module, included
 * on every page. Do not re-implement token reading, host resolution, refresh, or
 * sign-out anywhere else — call MSAuth.
 *
 * Authentication model: the backend (/auth/*) owns Supabase server-side and mints a
 * Supabase access-token JWT + refresh token. We persist them in localStorage (shared
 * across all same-origin pages) and treat a user as authenticated ONLY when a token
 * exists AND its JWT `exp` is still in the future — never on mere key presence.
 *
 * The pure decision helpers (parseJwt / isTokenValid / needsRefresh / resolveDashboard
 * / stale-key set) are also exported via module.exports so they can be unit-tested under
 * Node without a browser. Everything that touches window/localStorage/fetch is guarded.
 */
(function () {
  'use strict';

  // Build tag — bump on every auth.js change so caches can't serve a stale copy AND so
  // the console proves which script is live (see the boot log below).
  var BUILD = '20260803b';

  var HAS_WINDOW = typeof window !== 'undefined';
  var HAS_STORAGE = HAS_WINDOW && (function () { try { return !!window.localStorage; } catch (e) { return false; } })();

  // ── Config: ONE API host resolver (mirrors every page's old inline copy) ──────
  function resolveApiBase() {
    try {
      return (typeof location !== 'undefined' && location.hostname.indexOf('staging') !== -1)
        ? 'https://marketsync-staging-backend.onrender.com'
        : 'https://vehicle-marketplace-s0e4.onrender.com';
    } catch (e) {
      return 'https://vehicle-marketplace-s0e4.onrender.com';
    }
  }

  // Session keys we own. These are the ONLY auth keys; nothing else is authoritative.
  var SESSION_KEYS = ['token', 'refresh_token', 'user', 'ms_remember_until'];
  // UI prefs that must survive a session clear (not auth state).
  var PERSIST_KEYS = ['ms_tour_done', 'ms_ext_cta_dismissed'];
  // Stale custom auth flags left by older implementations. These are NOT trusted and
  // must be purged on startup so nothing reads a fake "logged in" boolean. We never
  // include the real SESSION_KEYS here.
  var STALE_AUTH_KEYS = ['isLoggedIn', 'loggedIn', 'authenticated', 'authUser',
    'currentUser', 'hasSession', 'userToken', 'accessToken', 'ms_authed', 'ms_user'];

  var EXP_SKEW_MS = 30 * 1000;          // treat a token as expired 30s early (clock skew)
  var REFRESH_AHEAD_MS = 5 * 60 * 1000; // proactively refresh when <5min of life remains

  // ── Pure helpers (no IO — unit-tested) ───────────────────────────────────────
  // Decode a JWT payload without verifying the signature (the SERVER verifies; the
  // client only needs the expiry to decide when to refresh). Returns null on garbage.
  function parseJwt(token) {
    if (!token || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length < 2) return null;
    try {
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = b64.length % 4; if (pad) b64 += '===='.slice(pad);
      var json = (typeof atob === 'function')
        ? atob(b64)
        : Buffer.from(b64, 'base64').toString('binary');
      // handle UTF-8 payloads
      try {
        json = decodeURIComponent(json.split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
      } catch (e) { /* ascii payload — use as-is */ }
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  // A token is valid iff it decodes AND its exp is in the future (with skew).
  function isTokenValid(token, nowMs) {
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var claims = parseJwt(token);
    if (!claims || typeof claims.exp !== 'number') return false;
    return (claims.exp * 1000) - EXP_SKEW_MS > now;
  }

  // Should we refresh? Yes when there is a token but it's expired or within the
  // proactive window (and only meaningful when a refresh_token exists — caller checks).
  function needsRefresh(token, nowMs) {
    var now = typeof nowMs === 'number' ? nowMs : Date.now();
    var claims = parseJwt(token);
    if (!claims || typeof claims.exp !== 'number') return true; // unknown/garbage → try refresh
    return (claims.exp * 1000) - REFRESH_AHEAD_MS <= now;
  }

  // The single authenticated landing target. This app has ONE adaptive dashboard
  // (dashboard.html) that self-configures from /access/context per product + role, so
  // every authenticated user routes there. Kept as a function so per-product landing
  // pages can be introduced later without touching callers.
  function resolveDashboardTarget(ctx) {
    return 'dashboard.html';
  }

  // ── Storage wrappers (safe in non-browser) ───────────────────────────────────
  function lsGet(k) { if (!HAS_STORAGE) return null; try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { if (!HAS_STORAGE) return; try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { if (!HAS_STORAGE) return; try { window.localStorage.removeItem(k); } catch (e) {} }

  function getToken() { return lsGet('token'); }
  function getRefreshToken() { return lsGet('refresh_token'); }
  function getUser() {
    var raw = lsGet('user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  // Remember-window: "keep me signed in" (30d) vs a short 12h window.
  function rememberLapsed() {
    var until = Number(lsGet('ms_remember_until') || '0');
    return !!until && Date.now() > until;
  }

  // ── Session state (validated, never a cached boolean) ─────────────────────────
  // Authenticated ⇔ a token exists, its JWT is still valid, and the remember window
  // has not lapsed. An expired token is NOT authenticated (refresh handles renewal).
  function isAuthenticated() {
    var t = getToken();
    if (!t) return false;
    if (rememberLapsed()) return false;
    return isTokenValid(t);
  }

  // True when we have *some* stored session (valid or merely refreshable). Used to
  // decide whether it's worth attempting a silent refresh before giving up.
  function hasStoredSession() {
    return !!getToken() && !rememberLapsed();
  }

  function getSession() {
    if (!isAuthenticated()) return null;
    return { token: getToken(), user: getUser() };
  }

  // Persist a login response { access_token, refresh_token, user }.
  function storeSession(data, remember) {
    if (!data || !data.access_token) return false;
    clearLoggedOutFlag();
    lsSet('token', data.access_token);
    if (data.user) lsSet('user', JSON.stringify(data.user));
    if (data.refresh_token) lsSet('refresh_token', data.refresh_token);
    var days = remember === false ? 0.5 : 30;
    lsSet('ms_remember_until', String(Date.now() + days * 86400000));
    debug('session stored', { remember: remember !== false, exp: (parseJwt(data.access_token) || {}).exp });
    return true;
  }

  function clearSession() {
    SESSION_KEYS.forEach(lsDel);
  }

  // Remove everything except UI prefs (used on hard sign-out).
  function clearAllButPrefs() {
    if (!HAS_STORAGE) return;
    var saved = {};
    PERSIST_KEYS.forEach(function (k) { var v = lsGet(k); if (v !== null) saved[k] = v; });
    try { window.localStorage.clear(); } catch (e) { SESSION_KEYS.concat(STALE_AUTH_KEYS).forEach(lsDel); }
    Object.keys(saved).forEach(function (k) { lsSet(k, saved[k]); });
  }

  // One-time startup purge of stale custom auth flags from older builds. NEVER touches
  // the real SESSION_KEYS. Returns the keys it removed (for tests/debug).
  function cleanupStaleKeys() {
    var removed = [];
    STALE_AUTH_KEYS.forEach(function (k) {
      if (lsGet(k) !== null) { lsDel(k); removed.push(k); }
    });
    if (removed.length) debug('purged stale auth keys', removed);
    return removed;
  }

  // ── Deliberate sign-out flag (so a page can tell it just logged out) ──────────
  function setLoggedOutFlag() { if (HAS_WINDOW) { try { window.sessionStorage.setItem('ms_logged_out', '1'); } catch (e) {} } }
  function clearLoggedOutFlag() { if (HAS_WINDOW) { try { window.sessionStorage.removeItem('ms_logged_out'); } catch (e) {} } }

  // ── Token refresh — single-flight so concurrent callers share one request ─────
  var _refreshInFlight = null;
  function refreshToken() {
    if (_refreshInFlight) return _refreshInFlight;
    var rt = getRefreshToken();
    if (!rt || rememberLapsed()) return Promise.resolve(false);
    var base = resolveApiBase();
    _refreshInFlight = fetch(base + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    }).then(function (r) {
      if (!r.ok) return false;
      return r.json().then(function (d) {
        if (d && d.access_token) { lsSet('token', d.access_token); }
        if (d && d.refresh_token) { lsSet('refresh_token', d.refresh_token); }
        debug('token refreshed', { exp: (parseJwt(d && d.access_token) || {}).exp });
        return !!(d && d.access_token);
      });
    }).catch(function () { return false; }).then(function (ok) {
      _refreshInFlight = null;
      return ok;
    });
    return _refreshInFlight;
  }

  // Ensure a usable access token before protected work: refresh if expired/near-expiry.
  // Returns true if we (now) have a valid token.
  function ensureFreshToken() {
    var t = getToken();
    if (!t) return Promise.resolve(false);
    if (!needsRefresh(t)) return Promise.resolve(true);
    if (!getRefreshToken() || rememberLapsed()) return Promise.resolve(isTokenValid(t));
    return refreshToken().then(function () { return isTokenValid(getToken()); });
  }

  // ── Authenticated fetch — the ONLY way protected calls should be made ─────────
  // Injects the Bearer token, refreshes proactively, and on a 401 refreshes once and
  // retries. If it still 401s, the session is truly dead → hard sign-out to login.
  function apiFetch(path, opts) {
    opts = opts || {};
    var base = resolveApiBase();
    var url = /^https?:/i.test(path) ? path : base + path;
    function doFetch() {
      var headers = Object.assign({}, opts.headers || {});
      var tk = getToken();
      if (tk) headers['Authorization'] = 'Bearer ' + tk;
      return fetch(url, Object.assign({}, opts, { headers: headers }));
    }
    return ensureFreshToken().then(doFetch).then(function (r) {
      if (r.status !== 401) return r;
      return refreshToken().then(function (ok) {
        if (!ok) { signOut(); throw new Error('Session expired'); }
        return doFetch().then(function (r2) {
          if (r2.status === 401) { signOut(); throw new Error('Session expired'); }
          return r2;
        });
      });
    });
  }

  // ── Sign in (used by login.html paths) ────────────────────────────────────────
  function signIn(email, password) {
    var base = resolveApiBase();
    return fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) {
      return r.json().then(function (data) { return { status: r.status, ok: r.ok, data: data }; });
    });
  }

  // ── Sign out — ONE centralized handler ────────────────────────────────────────
  // Best-effort revoke the server session, clear ALL local auth state, then REPLACE
  // history with the login page so Back cannot restore an authenticated view.
  var _signingOut = false;
  function signOut(options) {
    options = options || {};
    var redirect = options.redirect === undefined ? 'login.html' : options.redirect;
    if (_signingOut) return Promise.resolve();
    _signingOut = true;
    setLoggedOutFlag();
    var base = resolveApiBase();
    var tk = getToken();
    var revoke = tk
      ? fetch(base + '/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tk } }).catch(function () {})
      : Promise.resolve();
    // Clear local state immediately (do not wait on the network to drop the session).
    clearSession();
    cleanupStaleKeys();
    clearAllButPrefs();
    debug('signed out');
    return revoke.then(function () {
      if (HAS_WINDOW && redirect) { try { window.location.replace(redirect); } catch (e) { window.location.href = redirect; } }
      _signingOut = false;
    });
  }

  // ── Marketing header: Login ⇄ Dashboard (validated, never a cached boolean) ────
  // Supports the index.html id-based buttons AND auto-swaps plain header/nav "Log in"
  // links on any marketing page that just includes this script. When a token exists
  // but is expired, we kick a silent refresh and re-apply once it lands.
  function applyAuthNav() {
    if (!HAS_WINDOW || typeof document === 'undefined') return;
    var authed = isAuthenticated();
    // If we have a refreshable-but-expired session, try to revive it, then re-apply.
    if (!authed && hasStoredSession() && needsRefresh(getToken()) && getRefreshToken()) {
      refreshToken().then(function (ok) { if (ok) applyAuthNav(); });
    }
    var show = function (id) { var el = document.getElementById(id); if (el) el.style.display = ''; };
    var hide = function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; };
    // index.html explicit buttons
    (authed ? hide : show)('nav-login');
    (authed ? hide : show)('nav-signup');
    (authed ? hide : show)('mob-login');
    (authed ? hide : show)('mob-signup');
    (authed ? show : hide)('nav-dashboard-btn');
    (authed ? show : hide)('mob-dashboard');
    // Point the dashboard buttons at the single authenticated entry route.
    var navDash = document.getElementById('nav-dashboard-btn'); if (navDash) navDash.setAttribute('href', 'app.html');
    var mobDash = document.getElementById('mob-dashboard'); if (mobDash) mobDash.setAttribute('href', 'app.html');
    if (authed) {
      var user = getUser() || {};
      var name = user.full_name || (user.user_metadata && user.user_metadata.full_name) || user.email || '';
      var first = String(name).split(/\s+/)[0];
      var nm = document.getElementById('nav-user-name');
      if (first && nm) nm.textContent = first;
    }
    // Stable, explicit swap targets: EVERY [data-auth-nav] element (desktop + mobile,
    // drawer, sticky header) is toggled — not just the first — using attributes, not
    // fragile text matching. Authenticated → "Dashboard" / app.html; else → "Login" /
    // login.html. Also swaps plain header/nav links to login.html as a fallback for
    // marketing pages that only include auth.js without adding the attribute.
    try {
      var navEls = document.querySelectorAll(
        '[data-auth-nav], header a[href*="login.html"], nav a[href*="login.html"], a[data-ms-auth="login"]'
      );
      navEls.forEach(function (a) {
        if (a.id === 'nav-login' || a.id === 'mob-login' || a.id === 'nav-dashboard-btn' || a.id === 'mob-dashboard') return; // id-handled above
        if (authed) {
          if (!a.getAttribute('data-ms-login-text')) a.setAttribute('data-ms-login-text', a.textContent);
          if (!a.getAttribute('data-ms-login-href')) a.setAttribute('data-ms-login-href', a.getAttribute('href') || 'login.html');
          a.textContent = 'Dashboard';
          a.setAttribute('href', 'app.html');
        } else if (a.getAttribute('data-ms-login-text')) {
          a.textContent = a.getAttribute('data-ms-login-text');
          a.setAttribute('href', a.getAttribute('data-ms-login-href') || 'login.html');
        }
      });
      // Sign-out controls are visible only when authenticated.
      document.querySelectorAll('[data-auth-signout]').forEach(function (b) {
        b.hidden = !authed;
      });
    } catch (e) {}
  }

  // Wire EVERY [data-auth-signout] control (desktop/mobile header, drawer, account
  // menu, settings, profile) to the ONE centralized signOut — no inline onclick, no
  // per-page handler. Idempotent (marks wired elements) and guards double-clicks.
  function wireSignOut() {
    if (!HAS_WINDOW || typeof document === 'undefined') return;
    document.querySelectorAll('[data-auth-signout]').forEach(function (btn) {
      if (btn.getAttribute('data-ms-signout-wired')) return;
      btn.setAttribute('data-ms-signout-wired', '1');
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (btn.getAttribute('data-ms-signing-out')) return;   // ignore repeat clicks
        btn.setAttribute('data-ms-signing-out', '1');
        btn.disabled = true;
        Promise.resolve(signOut({ redirect: 'login.html' })).catch(function () {
          btn.removeAttribute('data-ms-signing-out');
          btn.disabled = false;
        });
      });
    });
  }

  // ── Dev-only debug logging (never logs secrets) ───────────────────────────────
  function debugEnabled() {
    if (!HAS_WINDOW) return false;
    try {
      var h = location.hostname;
      return h === 'localhost' || h === '127.0.0.1' || h.indexOf('staging') !== -1 ||
        /[?&]authdebug=1/.test(location.search);
    } catch (e) { return false; }
  }
  function debug() {
    if (!debugEnabled()) return;
    var args = ['[MSAuth]'].concat(Array.prototype.slice.call(arguments));
    try { console.log.apply(console, args); } catch (e) {}
  }
  function debugBoot() {
    if (!debugEnabled()) return;
    var claims = parseJwt(getToken());
    debug('init', {
      origin: (typeof location !== 'undefined' ? location.origin : ''),
      api: resolveApiBase(),
      authenticated: isAuthenticated(),
      hasStoredSession: hasStoredSession(),
      rememberLapsed: rememberLapsed(),
      userId: (getUser() || {}).id || null,
      sessionExpiresAt: claims && claims.exp ? new Date(claims.exp * 1000).toISOString() : null,
    });
  }

  // ── Public surface ────────────────────────────────────────────────────────────
  var MSAuth = {
    // config
    API: resolveApiBase(),
    BUILD: BUILD,
    resolveApiBase: resolveApiBase,
    SESSION_KEYS: SESSION_KEYS,
    STALE_AUTH_KEYS: STALE_AUTH_KEYS,
    // pure (tested)
    parseJwt: parseJwt,
    isTokenValid: isTokenValid,
    needsRefresh: needsRefresh,
    resolveDashboardTarget: resolveDashboardTarget,
    // state
    getToken: getToken,
    getRefreshToken: getRefreshToken,
    getUser: getUser,
    getSession: getSession,
    isAuthenticated: isAuthenticated,
    hasStoredSession: hasStoredSession,
    rememberLapsed: rememberLapsed,
    // lifecycle
    storeSession: storeSession,
    clearSession: clearSession,
    cleanupStaleKeys: cleanupStaleKeys,
    refreshToken: refreshToken,
    ensureFreshToken: ensureFreshToken,
    apiFetch: apiFetch,
    signIn: signIn,
    signOut: signOut,
    // ui
    applyAuthNav: applyAuthNav,
    wireSignOut: wireSignOut,
  };

  if (HAS_WINDOW) {
    // Prove which script is actually running (helps diagnose stale-cache deploys).
    try { console.info('[MSAuth] loaded ' + BUILD); } catch (e) {}
    // Startup: purge stale flags, wire the header + every sign-out control (load +
    // bfcache restore), log debug once.
    cleanupStaleKeys();
    window.MSAuth = MSAuth;
    window.msSignOut = function () { return signOut({ redirect: 'login.html' }); };
    var boot = function () { debugBoot(); applyAuthNav(); wireSignOut(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    window.addEventListener('pageshow', function () { applyAuthNav(); wireSignOut(); });
  }

  // Node/CommonJS export for unit tests (classic-script safe: guarded by typeof).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MSAuth;
  }
})();
