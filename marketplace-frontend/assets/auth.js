/*
 * MarketSync — centralized public-site auth/session helper.
 *
 * The marketing shell (public-shell.js) and any public page can ask this ONE
 * module "is the visitor signed in?" instead of each page re-checking
 * localStorage by hand. The important rule: a token *string* on its own does
 * not mean the visitor is authenticated. The login flow stores a Supabase
 * `access_token` (a JWT with an `exp` claim) plus a `refresh_token`. A session
 * is treated as valid when:
 *
 *   - a token exists, AND
 *   - if that token is a JWT, it is not past its `exp` — OR a `refresh_token`
 *     exists (an expired access token that can still be refreshed is a live
 *     session, so the marketing nav should keep showing "Dashboard").
 *
 * No network call is made — this is display-state logic for public pages and
 * must never throw or block rendering. Real authorization always happens on the
 * backend; this only decides which nav to paint.
 */
(function (global) {
  'use strict';

  function safeGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; } catch (e) { return null; }
  }

  function readToken() { return safeGet('token') || ''; }
  function readRefreshToken() { return safeGet('refresh_token') || ''; }

  // Decode a JWT payload without verifying the signature (display use only).
  function decodeJwt(token) {
    if (!token || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length !== 3) return null; // not JWT-shaped (opaque token)
    try {
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var pad = b64.length % 4;
      if (pad) b64 += new Array(5 - pad).join('=');
      var json = decodeURIComponent(
        atob(b64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
      );
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function isExpired(claims) {
    if (!claims || typeof claims.exp !== 'number') return false; // no exp → cannot prove expiry
    // 30s of clock skew tolerance.
    return (claims.exp * 1000) <= (Date.now() - 30000);
  }

  function isAuthenticated() {
    var token = readToken();
    if (!token) return false;
    var claims = decodeJwt(token);
    if (claims && isExpired(claims)) {
      // Access token has expired — the session is still live only if it can be refreshed.
      return !!readRefreshToken();
    }
    return true;
  }

  function getUser() {
    try { return JSON.parse(safeGet('user') || '{}') || {}; } catch (e) { return {}; }
  }

  // Best-effort first name for the "Dashboard" nav button.
  function getFirstName() {
    var user = getUser();
    var name = (user && user.user_metadata && user.user_metadata.full_name) ||
               (user && user.full_name) ||
               (user && user.name) ||
               (user && user.email) || '';
    if (!name) {
      var claims = decodeJwt(readToken()) || {};
      name = (claims.user_metadata && claims.user_metadata.full_name) || claims.name || claims.email || '';
    }
    name = String(name || '').trim();
    if (!name) return '';
    return name.split(/\s+/)[0];
  }

  function clear() {
    try {
      ['token', 'refresh_token', 'user', 'ms_remember_until'].forEach(function (k) {
        global.localStorage && global.localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  var MSAuth = {
    isAuthenticated: isAuthenticated,
    getToken: readToken,
    getUser: getUser,
    getFirstName: getFirstName,
    decodeJwt: decodeJwt,
    clear: clear
  };

  // Expose both as a global (public pages / shell) and as a CommonJS export (Node tests).
  global.MSAuth = MSAuth;
  if (typeof module !== 'undefined' && module.exports) { module.exports = MSAuth; }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
