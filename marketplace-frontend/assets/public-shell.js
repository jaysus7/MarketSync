/*
 * MarketSync public marketing shell — ONE shared header + footer for every
 * public page. This is the approved mega-menu design (formerly site-nav.js):
 * a real-page Solutions/Resources menu, "Start free trial" CTA everywhere, an
 * auth-aware Log in ⇄ Dashboard control, a mobile sheet, scroll-reveal, and a
 * shrinking sticky header.
 *
 * Drop a page onto it with:
 *   <div id="ms-public-header"></div>
 *   <main> …page content… </main>
 *   <div id="ms-public-footer"></div>
 *   <script src="/assets/auth.js" defer></script>
 *   <script src="/assets/public-shell.js" defer></script>
 *
 * Legacy #ms-header / #ms-footer mount ids are still honoured. Styling lives in
 * public-shell.css (auto dark/light via prefers-color-scheme — no manual toggle,
 * no flash). Signed-in state comes from the centralized auth.js session check,
 * never a bare token. Self-contained and defensive: a missing mount is created,
 * nothing here throws.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__msPublicShell) return;
  window.__msPublicShell = true;

  var CSS_HREF = '/assets/public-shell.css';
  var TRIAL = '/register.html';

  // ── Navigation model — verbatim from the earlier shared shell (site-nav.js
  //    @ a74b747). Real pages only, never bare #anchors.
  var SOLUTIONS = [
    { href: '/dealer-os.html', title: 'DealerOS', desc: 'The complete dealership operating system' },
    { href: '/facebook-autoposter.html', title: 'Facebook AutoPoster', desc: 'One-click Marketplace posting' },
    { href: '/ai-chatbot.html', title: 'AI ChatBot', desc: 'An AI salesperson on your website 24/7' },
  ];
  var RESOURCES = [
    { href: '/guide.html', title: 'How-to Guide' },
    { href: '/blog.html', title: 'Blog' },
    { href: '/faq.html', title: 'FAQ' },
    { href: '/security.html', title: 'Security' },
  ];

  // Footer columns — verbatim from the earlier shared shell (site-nav.js).
  var FOOTER_COLS = [
    ['Solutions', [
      ['DealerOS', '/dealer-os.html'],
      ['Facebook AutoPoster', '/facebook-autoposter.html'],
      ['AI ChatBot', '/ai-chatbot.html'],
      ['Pricing', '/compare.html'],
    ]],
    ['Company', [
      ['How-to Guide', '/guide.html'],
      ['Blog', '/blog.html'],
      ['FAQ', '/faq.html'],
      ['Support', '/support.html'],
    ]],
    ['Trust', [
      ['Security', '/security.html'],
      ['Privacy Policy', '/privacy-policy.html'],
      ['Terms', '/terms.html'],
    ]],
    ['Get started', [
      ['Start free trial', TRIAL],
      ['Log in', '/login.html'],
    ]],
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Auth-aware state via centralized auth.js ────────────────────────
  function authed() {
    try {
      if (window.MSAuth && typeof window.MSAuth.isAuthenticated === 'function') return window.MSAuth.isAuthenticated();
    } catch (e) {}
    try { return !!localStorage.getItem('token'); } catch (e) { return false; }
  }
  function firstName() {
    try { if (window.MSAuth && window.MSAuth.getFirstName) return window.MSAuth.getFirstName(); } catch (e) {}
    return '';
  }
  var isAuthed = authed();
  var authHref = isAuthed ? '/dashboard.html' : '/login.html';
  var authLabel = isAuthed ? (firstName() || 'Dashboard') : 'Log in';

  // Which page are we on (for active highlighting)?
  function currentFile() {
    var p = location.pathname;
    var f = p.substring(p.lastIndexOf('/') + 1).toLowerCase();
    return f || 'index.html';
  }
  function isActive(href) {
    var t = href.substring(href.lastIndexOf('/') + 1).toLowerCase();
    return t && t === currentFile();
  }
  function act(href, cls) { return isActive(href) ? ' ' + cls : ''; }

  var CARET = '<svg viewBox="0 0 20 20" fill="currentColor" class="ms-caret"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg>';

  // ── Header ──────────────────────────────────────────────────────────
  function headerHTML() {
    var solItems = SOLUTIONS.map(function (s) {
      return '<a href="' + s.href + '" class="ms-dd-item' + act(s.href, 'ms-active') + '"><span class="ms-dd-t">' + esc(s.title) + '</span><span class="ms-dd-d">' + esc(s.desc) + '</span></a>';
    }).join('');
    var resItems = RESOURCES.map(function (r) {
      return '<a href="' + r.href + '" class="ms-dd-item' + act(r.href, 'ms-active') + '"><span class="ms-dd-t">' + esc(r.title) + '</span></a>';
    }).join('');
    var mobSol = SOLUTIONS.map(function (s) { return '<a href="' + s.href + '" class="ms-m-link' + act(s.href, 'ms-active') + '">' + esc(s.title) + '</a>'; }).join('');
    var mobRes = RESOURCES.map(function (r) { return '<a href="' + r.href + '" class="ms-m-link' + act(r.href, 'ms-active') + '">' + esc(r.title) + '</a>'; }).join('');

    return '' +
      '<a href="/" class="ms-logo" aria-label="MarketSync home"><span class="ms-logo-bar"></span>Market<span class="ms-logo-accent">Sync</span></a>' +
      '<nav class="ms-nav-desktop" aria-label="Primary">' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">Solutions ' + CARET + '</button><div class="ms-dropdown ms-dd-wide">' + solItems + '</div></div>' +
        '<a href="/compare.html" class="ms-nav-link' + act('/compare.html', 'ms-active') + '">Pricing</a>' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">Resources ' + CARET + '</button><div class="ms-dropdown">' + resItems + '</div></div>' +
      '</nav>' +
      '<div class="ms-nav-cta">' +
        '<a href="' + authHref + '" class="ms-link-quiet">' + esc(authLabel) + '</a>' +
        '<a href="' + TRIAL + '" class="ms-btn ms-btn-primary">Start free trial</a>' +
        '<button class="ms-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '</div>' +
      '<div class="ms-mobile" hidden>' +
        '<div class="ms-m-label">Solutions</div>' + mobSol +
        '<a href="/compare.html" class="ms-m-link ms-m-top' + act('/compare.html', 'ms-active') + '">Pricing</a>' +
        '<div class="ms-m-label">Resources</div>' + mobRes +
        '<div class="ms-m-actions"><a href="' + authHref + '" class="ms-btn ms-btn-ghost ms-btn-block">' + esc(authLabel) + '</a>' +
        '<a href="' + TRIAL + '" class="ms-btn ms-btn-primary ms-btn-block">Start free trial</a></div>' +
      '</div>';
  }

  // ── Footer ──────────────────────────────────────────────────────────
  function footerHTML() {
    var cols = FOOTER_COLS.map(function (c) {
      return '<div class="ms-f-col"><div class="ms-f-h">' + esc(c[0]) + '</div>' +
        c[1].map(function (l) { return '<a href="' + l[1] + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>';
    }).join('');
    return '' +
      '<div class="ms-f-cta">' +
        '<h2>Run your whole store from one login.</h2>' +
        '<p>Replace vAuto, your CRM, PBS, DeskIt, eDealer and your Facebook posting tool — with one platform your team actually likes using.</p>' +
        '<div class="ms-f-cta-btns"><a href="' + TRIAL + '" class="ms-btn ms-btn-primary ms-btn-lg">Start your free 30-day trial</a><a href="/compare.html" class="ms-btn ms-btn-ghost ms-btn-lg">See pricing</a></div>' +
        '<div class="ms-f-cta-note">No credit card required · Set up in a day</div>' +
      '</div>' +
      '<div class="ms-f-grid">' +
        '<div class="ms-f-brand"><a href="/" class="ms-logo ms-logo-sm"><span class="ms-logo-bar"></span>Market<span class="ms-logo-accent">Sync</span></a><p>The all-in-one platform for modern car dealerships.</p></div>' +
        cols +
      '</div>' +
      '<div class="ms-f-bottom"><span>© ' + new Date().getFullYear() + ' MarketSync Technologies Inc. All rights reserved.</span></div>';
  }

  // ── Theme (automatic OS dark/light) ─────────────────────────────────
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applySystemTheme() { if (media) document.documentElement.classList.toggle('dark', media.matches); }
  function initTheme() {
    applySystemTheme();
    if (!media) return;
    var h = function () { applySystemTheme(); };
    if (media.addEventListener) media.addEventListener('change', h);
    else if (media.addListener) media.addListener(h);
  }

  // ── Scroll-reveal (shared contract with site-marketing.css) ─────────
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
  window.MSsyncReveal = scanReveal;

  // ── Mount ───────────────────────────────────────────────────────────
  function ensureCss() {
    if (document.querySelector('link[data-ms-public-shell]') || document.querySelector('link[href="' + CSS_HREF + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = CSS_HREF; link.setAttribute('data-ms-public-shell', '');
    document.head.appendChild(link);
  }
  function mountInto(ids, html, atStart, cls) {
    var host = null, i;
    for (i = 0; i < ids.length; i++) { host = document.getElementById(ids[i]); if (host) break; }
    if (!host) {
      host = document.createElement('div'); host.id = ids[0];
      if (atStart) document.body.insertBefore(host, document.body.firstChild);
      else document.body.appendChild(host);
    }
    if (cls) host.className = cls;
    host.innerHTML = html;
    return host;
  }
  function wireMobileMenu(host, mobile) {
    var burger = host.querySelector('.ms-burger');
    if (!burger || !mobile) return;
    burger.addEventListener('click', function () {
      var open = burger.classList.toggle('ms-open'); mobile.hidden = !open;
      burger.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : '';
    });
    mobile.addEventListener('click', function (e) {
      if (e.target && e.target.closest('a')) {
        burger.classList.remove('ms-open'); mobile.hidden = true;
        burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
      }
    });
  }

  function mount() {
    ensureCss();
    initTheme();
    var header = mountInto(['ms-public-header', 'ms-header'], '<div class="ms-hd-in">' + headerHTML() + '</div>', true, 'ms-hd');
    mountInto(['ms-public-footer', 'ms-footer'], footerHTML(), false, 'ms-ft');
    // Relocate the mobile sheet to <body>: the header's backdrop-filter would
    // otherwise be the containing block for its position:fixed, clipping it to
    // the 56px header box (only "Solutions" showed).
    var mobile = header.querySelector('.ms-mobile');
    if (mobile) document.body.appendChild(mobile);
    wireMobileMenu(header, mobile);
    var onScroll = function () { header.classList.toggle('ms-scrolled', window.scrollY > 8); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    scanReveal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
