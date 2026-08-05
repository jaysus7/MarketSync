/*
 * MarketSync public marketing shell — ONE shared header + footer for every
 * public page. Drop a page onto it with three things:
 *
 *   <div id="ms-public-header"></div>
 *   <main> …page content… </main>
 *   <div id="ms-public-footer"></div>
 *   <script src="/assets/public-shell.js" defer></script>
 *
 * It injects the approved homepage chrome (announcement bar, desktop header,
 * mobile menu, footer), highlights the active page, wires the mobile menu and
 * theme listener exactly once, and paints the auth-aware nav (Log in ⇄
 * Dashboard) using the centralized session check in auth.js — a token string
 * alone never counts as signed-in.
 *
 * System (OS) dark/light is automatic: a tiny inline snippet in each page's
 * <head> sets the `dark` class before first paint (no flash); this file keeps
 * it live when the OS theme changes. There is no manual toggle by design.
 *
 * Self-contained and defensive: styling lives in public-shell.css, nothing here
 * throws, and a missing mount point is created rather than fatal.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__msPublicShell) return;      // guard: init once
  window.__msPublicShell = true;

  var CSS_HREF = '/assets/public-shell.css';

  // ── Navigation model (the approved homepage nav — the single source of truth).
  // Bare homepage anchors are made root-absolute so they work from any page.
  var NAV = [
    { href: '/#loop', label: 'The Loop' },
    { href: '/#what-is-it', label: 'What is it?' },
    { href: '/#products', label: 'Platform' },
    { href: '/workflow.html', label: 'Workflow' },
    { href: '/features.html', label: 'Features' },
    { href: '/compare.html', label: 'Compare' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/#faq', label: 'FAQ' },
    { href: '/blog.html', label: 'Blog' }
  ];
  var FOOTER_LINKS = [
    { href: '/login.html', label: 'Log In' },
    { href: '/register.html', label: 'Sign Up' },
    { href: '/features.html', label: 'Features' },
    { href: '/upgrade.html', label: 'Pricing' },
    { href: '/blog.html', label: 'Blog' },
    { href: '/faq.html', label: 'FAQ' },
    { href: '/security.html', label: 'Security' },
    { href: '/support.html', label: 'Support' },
    { href: '/terms.html', label: 'Terms' },
    { href: '/privacy-policy.html', label: 'Privacy' },
    { href: '/affiliates.html', label: 'Become an affiliate' }
  ];

  // Icons (inline SVG so the shell never depends on an icon font).
  var ICON_GRAD = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3 1 8l11 5 9-4.09V15h2V8L12 3zM5 13.18v3.82c0 1.66 3.13 3 7 3s7-1.34 7-3v-3.82l-7 3.18-7-3.18z"/></svg>';
  var ICON_USER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';
  var ICON_BARS = '<svg class="msps-bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  var ICON_X = '<svg class="msps-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_GIFT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 7h-2.18A3 3 0 0 0 12 4.35 3 3 0 0 0 6.18 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm-5-1a1 1 0 1 1-1 1 1 1 0 0 1 1-1zM9 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm2 15H7v-7h4v7zm6 0h-4v-7h4v7z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Which nav entry (if any) matches the page we're on.
  function currentFile() {
    var p = location.pathname.replace(/\/+$/, '/');
    var file = p.substring(p.lastIndexOf('/') + 1);
    if (!file || file === '') file = 'index.html';
    return file.toLowerCase();
  }
  function isActive(href) {
    var file = currentFile();
    var hi = href.indexOf('#');
    if (hi === 0 || href === '/' || href.indexOf('/#') === 0) {
      // Homepage anchor — only "active" on the homepage itself, and we leave it unmarked.
      return false;
    }
    var target = href.substring(href.lastIndexOf('/') + 1).toLowerCase();
    return target && target === file;
  }

  // ── Auth-aware bits ────────────────────────────────────────────────
  function authed() {
    try {
      if (window.MSAuth && typeof window.MSAuth.isAuthenticated === 'function') {
        return window.MSAuth.isAuthenticated();
      }
    } catch (e) {}
    // Defensive fallback only if auth.js failed to load: token presence.
    try { return !!localStorage.getItem('token'); } catch (e) { return false; }
  }
  function firstName() {
    try { if (window.MSAuth && window.MSAuth.getFirstName) return window.MSAuth.getFirstName(); } catch (e) {}
    return '';
  }

  // ── Markup ─────────────────────────────────────────────────────────
  function headerHTML() {
    var isAuthed = authed();
    var name = isAuthed ? (firstName() || 'Dashboard') : '';

    var desktopNav = NAV.map(function (n) {
      return '<a href="' + esc(n.href) + '"' + (isActive(n.href) ? ' class="msps-active"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');

    var mobileNav = NAV.map(function (n) {
      return '<a href="' + esc(n.href) + '"' + (isActive(n.href) ? ' class="msps-active"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');

    var cta = isAuthed
      ? '<a class="msps-btn msps-dash" href="/dashboard.html" title="Go to your dashboard">' + ICON_USER + '<span>' + esc(name) + '</span></a>'
      : '<a class="msps-link msps-login" href="/login.html">Log in</a>' +
        '<a class="msps-btn msps-signup" href="/register.html">Sign up free</a>';

    var mobileActions = isAuthed
      ? '<a class="msps-m-dash" href="/dashboard.html">My Dashboard</a>'
      : '<a class="msps-m-login" href="/login.html">Log in</a><a class="msps-m-signup" href="/register.html">Sign up free</a>';

    return '' +
      '<div class="msps-announce">' + ICON_GIFT + '30-day free trial · No credit card required</div>' +
      '<header class="msps-hd">' +
        '<div class="msps-hd-in">' +
          '<a class="msps-logo" href="/" aria-label="MarketSync home">' +
            '<span class="msps-logo-bar">|</span>' +
            '<span class="msps-logo-word">Market<span class="msps-logo-accent">Sync</span></span>' +
          '</a>' +
          '<nav class="msps-nav" aria-label="Primary">' + desktopNav + '</nav>' +
          '<div class="msps-cta">' +
            '<a class="msps-icon-btn" href="/guide.html" title="How-to guide — learn every feature" aria-label="How-to guide">' + ICON_GRAD + '</a>' +
            cta +
            '<button class="msps-burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="msps-mobile-menu">' + ICON_BARS + ICON_X + '</button>' +
          '</div>' +
        '</div>' +
        '<nav class="msps-mobile" id="msps-mobile-menu" hidden aria-label="Mobile">' +
          mobileNav +
          '<a href="/guide.html">How-to Guide</a>' +
          '<div class="msps-m-actions">' + mobileActions + '</div>' +
        '</nav>' +
      '</header>';
  }

  function footerHTML() {
    var year = new Date().getFullYear();
    var links = FOOTER_LINKS.map(function (l) {
      return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');
    return '' +
      '<footer class="msps-ft">' +
        '<div><p>© ' + year + ' MarketSync Technologies Inc. All rights reserved.</p></div>' +
        '<div class="msps-ft-links">' + links + '</div>' +
      '</footer>';
  }

  // ── Theme (automatic OS dark/light) ────────────────────────────────
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applySystemTheme() {
    if (!media) return;
    document.documentElement.classList.toggle('dark', media.matches);
  }
  function initTheme() {
    applySystemTheme();                       // idempotent re-apply (head snippet already ran)
    if (!media) return;
    var handler = function () { applySystemTheme(); };
    if (media.addEventListener) media.addEventListener('change', handler);
    else if (media.addListener) media.addListener(handler);   // Safari < 14
  }

  // ── Mount ──────────────────────────────────────────────────────────
  function ensureCss() {
    if (document.querySelector('link[data-ms-public-shell]')) return;
    if (document.querySelector('link[href="' + CSS_HREF + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    link.setAttribute('data-ms-public-shell', '');
    document.head.appendChild(link);
  }

  function mountInto(ids, html, atStart) {
    var host = null, i;
    for (i = 0; i < ids.length; i++) { host = document.getElementById(ids[i]); if (host) break; }
    if (!host) {
      host = document.createElement('div');
      host.id = ids[0];
      if (atStart) document.body.insertBefore(host, document.body.firstChild);
      else document.body.appendChild(host);
    }
    host.innerHTML = html;
    return host;
  }

  function wireMobileMenu(host) {
    var burger = host.querySelector('.msps-burger');
    var menu = host.querySelector('.msps-mobile');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      var open = burger.classList.toggle('msps-open');
      menu.hidden = !open;
      burger.setAttribute('aria-expanded', String(open));
    });
    // Close the sheet after tapping a link.
    menu.addEventListener('click', function (e) {
      if (e.target && e.target.closest('a')) {
        burger.classList.remove('msps-open');
        menu.hidden = true;
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Scroll-reveal for any .ms-reveal element (contract shared with site-marketing.css:
  // .ms-reveal starts hidden, gains .ms-in when it scrolls into view; data-ms-delay
  // staggers it). Pages that use .ms-reveal depend on this to become visible at all,
  // so the no-IntersectionObserver path reveals everything immediately.
  var _io = null;
  function scanReveal() {
    var els = document.querySelectorAll('.ms-reveal:not(.ms-in)');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('ms-in'); });
      return;
    }
    if (!_io) {
      _io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var d = e.target.getAttribute('data-ms-delay');
            if (d) e.target.style.transitionDelay = d + 'ms';
            e.target.classList.add('ms-in');
            _io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    }
    Array.prototype.forEach.call(els, function (el) { _io.observe(el); });
  }
  window.MSsyncReveal = scanReveal;   // pages can call after injecting content

  function mount() {
    ensureCss();
    initTheme();
    var headerHost = mountInto(['ms-public-header', 'ms-header'], headerHTML(), true);
    mountInto(['ms-public-footer', 'ms-footer'], footerHTML(), false);
    wireMobileMenu(headerHost);
    scanReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
