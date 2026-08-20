/*
 * MarketSync marketing site — ONE shared header + footer + motion system.
 *
 * Every public page includes <script src="/site-nav.js" defer></script> and gets the
 * exact same chrome: a real-page menu (no #anchors), "Start free trial" CTA everywhere,
 * an auth-aware Log in ⇄ Dashboard control, a mobile sheet, scroll-reveal animations,
 * and a shrinking sticky header. Change it here → every page updates.
 *
 * Self-contained on purpose: it depends on nothing else, and a missing token or slow
 * network can never break the page (learned the hard way — the header degrades, it
 * never throws).
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var authed = false;
  try { authed = !!localStorage.getItem('token'); } catch (e) {}

  // The ONE navigation model. Real pages only — never #anchors.
  var PRODUCTS = [
    { href: '/design-studio.html', title: 'Design Studio', desc: '$19.99 / mo · Creative Canvas & Templates' },
    { href: '/facebook-autoposter.html', title: 'Facebook AutoPoster', desc: '$39 – $149 / mo · Rep & Dealer Marketplace Posting' },
    { href: '/pricing.html#standalone', title: 'Social Scheduler', desc: '$99 / mo · Multi-Platform Social Media Scheduler' },
    { href: '/video-studio.html', title: 'Video Suite', desc: '$149 / mo · Walkarounds & Video Messaging' },
    { href: '/campaigns.html', title: 'Campaigns — Email + SMS', desc: '$199 / mo + usage · Automated Customer Messaging' },
    { href: '/dealer-website.html', title: 'Dealer Website', desc: '$249 / mo · VDP Showroom & Inventory Showcase' },
    { href: '/pricing.html#standalone', title: 'MarketSync SEO', desc: '$149 / mo · Automotive Search Optimization' },
    { href: '/ai-chatbot.html', title: 'AI ChatBot', desc: '$599 / mo · 24/7 AI Automotive Salesperson' },
  ];
  var SOLUTIONS = [
    { href: '/dealer-os.html', title: 'DealerOS Operating System', desc: 'CRM, Sales, Inventory, Desking & Fixed Ops ($1,499–$3,999)' },
    { href: '/marketing-suites.html', title: 'Connected Marketing Suites', desc: 'Sales ($399), Service ($399), Complete ($699) & Digital ($1,199)' },
    { href: '/facebook-autoposter.html', title: 'Facebook AutoPoster', desc: '1-click Facebook Marketplace auto-posting ($39–$149)' },
    { href: '/ai-chatbot.html', title: 'AI ChatBot', desc: '24/7 AI dealership salesperson ($599)' },
    { href: '/design-studio.html', title: 'Design Studio', desc: 'Creative canvas & marketing templates ($19.99)' },
    { href: '/pricing.html#standalone', title: 'Social Scheduler', desc: 'Multi-platform social media publishing ($99)' },
    { href: '/video-studio.html', title: 'Video Suite', desc: 'Vehicle walkaround videos & customer messaging ($149)' },
    { href: '/campaigns.html', title: 'Campaigns — Email + SMS', desc: 'Targeted customer email & SMS automation ($199+)' },
    { href: '/dealer-website.html', title: 'Dealer Website', desc: 'High-performance VDP showroom ($249)' },
    { href: '/pricing.html#standalone', title: 'MarketSync SEO', desc: 'Dealership search optimization ($149)' },
  ];
  var DEALEROS = [
    { href: '/dealer-os.html', title: 'DealerOS Core', desc: '$1,499 / mo · CRM, Sales & Inventory OS' },
    { href: '/dealer-os.html', title: 'DealerOS Pro', desc: '$2,499 / mo · Fixed Ops, F&I, Desking & Digital' },
    { href: '/dealer-os.html', title: 'DealerOS Complete', desc: '$3,999 / mo · Flagship Enterprise Operating System' },
  ];
  var RESOURCES = [
    { href: '/features.html', title: 'Platform Features' },
    { href: '/guide.html', title: 'How-to Guide' },
    { href: '/faq.html', title: 'FAQ & Help' },
    { href: '/security.html', title: 'Security & Trust' },
  ];
  var TRIAL = '/register.html';

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var authHref = authed ? '/dashboard.html' : '/login.html';
  var authLabel = authed ? 'Dashboard' : 'Log in';

  // ── Header ────────────────────────────────────────────────────────────────
  function headerHTML() {
    var prodItems = PRODUCTS.map(function (s) {
      return '<a href="' + s.href + '" class="ms-dd-item"><span class="ms-dd-t">' + esc(s.title) + '</span><span class="ms-dd-d">' + esc(s.desc) + '</span></a>';
    }).join('');
    var solItems = SOLUTIONS.map(function (s) {
      return '<a href="' + s.href + '" class="ms-dd-item"><span class="ms-dd-t">' + esc(s.title) + '</span><span class="ms-dd-d">' + esc(s.desc) + '</span></a>';
    }).join('');
    var osItems = DEALEROS.map(function (s) {
      return '<a href="' + s.href + '" class="ms-dd-item"><span class="ms-dd-t">' + esc(s.title) + '</span><span class="ms-dd-d">' + esc(s.desc) + '</span></a>';
    }).join('');
    var resItems = RESOURCES.map(function (r) { return '<a href="' + r.href + '" class="ms-dd-item"><span class="ms-dd-t">' + esc(r.title) + '</span></a>'; }).join('');

    var mobProd = PRODUCTS.map(function (s) { return '<a href="' + s.href + '" class="ms-m-link">' + esc(s.title) + '</a>'; }).join('');
    var mobSol = SOLUTIONS.map(function (s) { return '<a href="' + s.href + '" class="ms-m-link">' + esc(s.title) + '</a>'; }).join('');
    var mobOs = DEALEROS.map(function (s) { return '<a href="' + s.href + '" class="ms-m-link">' + esc(s.title) + '</a>'; }).join('');
    var mobRes = RESOURCES.map(function (r) { return '<a href="' + r.href + '" class="ms-m-link">' + esc(r.title) + '</a>'; }).join('');

    return '' +
      '<a href="/" class="ms-logo" aria-label="MarketSync home"><img src="/Logo 2.0.png" alt="MarketSync DealerOS" class="dark:hidden" style="height:32px; width:auto;"><img src="/Logo 2.1.png" alt="MarketSync DealerOS" class="hidden dark:block" style="height:32px; width:auto;"></a>' +
      '<nav class="ms-nav-desktop" aria-label="Primary">' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">Products <svg viewBox="0 0 20 20" fill="currentColor" class="ms-caret"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><div class="ms-dropdown ms-dd-wide">' + prodItems + '</div></div>' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">Suites <svg viewBox="0 0 20 20" fill="currentColor" class="ms-caret"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><div class="ms-dropdown ms-dd-wide">' + solItems + '</div></div>' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">DealerOS <svg viewBox="0 0 20 20" fill="currentColor" class="ms-caret"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><div class="ms-dropdown ms-dd-wide">' + osItems + '</div></div>' +
        '<a href="/pricing.html" class="ms-nav-link">Pricing</a>' +
        '<div class="ms-nav-item"><button class="ms-nav-btn" aria-haspopup="true">Resources <svg viewBox="0 0 20 20" fill="currentColor" class="ms-caret"><path d="M5.5 7.5 10 12l4.5-4.5"/></svg></button><div class="ms-dropdown">' + resItems + '</div></div>' +
      '</nav>' +
      '<div class="ms-nav-cta">' +
        '<a href="' + authHref + '" class="ms-link-quiet">' + authLabel + '</a>' +
        '<a href="/demo.html" class="ms-btn ms-btn-primary">Book a Demo</a>' +
        '<button class="ms-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
      '</div>' +
      '<div class="ms-mobile" hidden>' +
        '<div class="ms-m-label">Products</div>' + mobProd +
        '<div class="ms-m-label">Suites</div>' + mobSol +
        '<div class="ms-m-label">DealerOS</div>' + mobOs +
        '<a href="/pricing.html" class="ms-m-link ms-m-top">Pricing</a>' +
        '<div class="ms-m-label">Resources</div>' + mobRes +
        '<div class="ms-m-actions"><a href="' + authHref + '" class="ms-btn ms-btn-ghost ms-btn-block">' + authLabel + '</a>' +
        '<a href="/demo.html" class="ms-btn ms-btn-primary ms-btn-block">Book a Demo</a></div>' +
      '</div>';
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  function footerHTML() {
    var col = function (title, links) {
      return '<div class="ms-f-col"><div class="ms-f-h">' + title + '</div>' + links.map(function (l) { return '<a href="' + l[1] + '">' + esc(l[0]) + '</a>'; }).join('') + '</div>';
    };
    return '' +
      '<div class="ms-f-cta">' +
        '<h2>One connected operating system for your dealership.</h2>' +
        'replace software fragmentation with DealerOS by MarketSync. Connect sales, service, inventory, marketing, and intelligence in one platform.</p>' +
        '<div class="ms-f-cta-btns"><a href="/demo.html" class="ms-btn ms-btn-primary ms-btn-lg">Book a Dealership Demo</a><a href="/pricing.html" class="ms-btn ms-btn-ghost ms-btn-lg">Explore Pricing</a></div>' +
        '<div class="ms-f-cta-note">Tailored onboarding · Seamless migration from legacy CRMs</div>' +
      '</div>' +
      '<div class="ms-f-grid">' +
        '<div class="ms-f-brand"><a href="/" class="ms-logo ms-logo-sm"><img src="/Logo 2.1.png" alt="MarketSync DealerOS" style="height:28px; width:auto;"></a><p>The intelligent automotive operating system &amp; digital growth platform.</p></div>' +
        col('Products', [['Design Studio ($19.99)', '/pricing.html#standalone'], ['AutoPoster Rep ($39)', '/facebook-autoposter.html'], ['Social Scheduler ($99)', '/pricing.html#standalone'], ['AutoPoster Dealer ($149)', '/facebook-autoposter.html'], ['Video ($149)', '/pricing.html#standalone'], ['Campaigns ($199+)', '/pricing.html#standalone'], ['Dealer Website ($249)', '/dealer-website.html'], ['MarketSync SEO ($149)', '/pricing.html#standalone'], ['AI ChatBot ($599)', '/ai-chatbot.html']]) +
        col('Suites & OS', [['Sales Marketing ($399)', '/pricing.html#suites'], ['Service Marketing ($399)', '/pricing.html#suites'], ['Complete Marketing ($699)', '/pricing.html#suites'], ['MarketSync Digital ($1,199)', '/pricing.html#digital'], ['DealerOS Core ($1,499)', '/dealer-os.html'], ['DealerOS Pro ($2,499)', '/dealer-os.html'], ['DealerOS Complete ($3,999)', '/dealer-os.html']]) +
        col('Company & Trust', [['Features', '/features.html'], ['How-to Guide', '/guide.html'], ['FAQ', '/faq.html'], ['Security & Trust', '/security.html'], ['Privacy Policy', '/privacy-policy.html'], ['Terms of Service', '/terms.html']]) +
        col('Get Started', [['Book a Demo', '/demo.html'], ['Log In', '/login.html'], ['Register', '/register.html']]) +
        '</div>' +
      '<div class="ms-f-bottom"><span>© ' + new Date().getFullYear() + ' MarketSync Technologies Inc. All rights reserved. Prices in CAD/month unless noted.</span></div>';
  }

  // ── Styles (scoped ms-* classes; Apple-ish type + motion) ───────────────────
  var CSS = '' +
    ':root{--ms-accent:#6366F1;--ms-ink:#0b1220;--ms-fg:#e5e7eb;}' +
    '.ms-hd{position:sticky;top:0;z-index:60;backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);background:rgba(255,255,255,.72);border-bottom:1px solid rgba(0,0,0,.06);transition:background .3s,box-shadow .3s,height .3s;}' +
    '@media (prefers-color-scheme:dark){.ms-hd{background:rgba(11,18,32,.72);border-bottom-color:rgba(255,255,255,.08);}}' +
    '.ms-hd.ms-scrolled{box-shadow:0 1px 20px rgba(0,0,0,.08);}' +
    '.ms-hd-in{max-width:1600px;margin:0 auto;height:56px;display:flex;align-items:center;gap:24px;padding:0 32px;}' +
    '.ms-logo{display:inline-flex;align-items:center;gap:9px;font-weight:800;font-size:19px;letter-spacing:-.02em;color:#0b1220;text-decoration:none;}' +
    '@media (prefers-color-scheme:dark){.ms-logo{color:#fff;}}' +
    '.ms-logo-bar{width:6px;height:22px;border-radius:3px;background:var(--ms-accent);}' +
    '.ms-logo-accent{color:var(--ms-accent);}' +
    '.ms-nav-desktop{display:none;align-items:center;gap:4px;margin-right:auto;}' +
    '.ms-nav-item{position:relative;}' +
    '.ms-nav-link,.ms-nav-btn{font:inherit;font-size:14px;font-weight:600;color:#334155;background:none;border:0;cursor:pointer;padding:8px 12px;border-radius:9px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;transition:color .2s,background .2s;}' +
    '@media (prefers-color-scheme:dark){.ms-nav-link,.ms-nav-btn{color:#cbd5e1;}}' +
    '.ms-nav-link:hover,.ms-nav-btn:hover{color:var(--ms-accent);background:rgba(99,102,241,.08);}' +
    '.ms-caret{width:15px;height:15px;stroke:currentColor;stroke-width:1.6;fill:none;transition:transform .2s;}' +
    '.ms-nav-item:hover .ms-caret{transform:rotate(180deg);}' +
    '.ms-dropdown{position:absolute;top:calc(100% + 8px);left:0;min-width:230px;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.16);padding:8px;opacity:0;visibility:hidden;transform:translateY(6px);transition:.18s;}' +
    '.ms-dd-wide{min-width:320px;}' +
    '@media (prefers-color-scheme:dark){.ms-dropdown{background:#0f172a;border-color:rgba(255,255,255,.1);}}' +
    '.ms-nav-item:hover .ms-dropdown{opacity:1;visibility:visible;transform:translateY(0);}' +
    '.ms-dd-item{display:block;padding:10px 12px;border-radius:11px;text-decoration:none;transition:background .15s;}' +
    '.ms-dd-item:hover{background:rgba(99,102,241,.08);}' +
    '.ms-dd-t{display:block;font-size:14px;font-weight:700;color:#0b1220;}' +
    '.ms-dd-d{display:block;font-size:12.5px;color:#64748b;margin-top:2px;}' +
    '@media (prefers-color-scheme:dark){.ms-dd-t{color:#fff;}.ms-dd-d{color:#94a3b8;}}' +
    '.ms-nav-cta{display:flex;align-items:center;gap:10px;margin-left:auto;}' +
    '.ms-link-quiet{display:none;font-size:14px;font-weight:600;color:#334155;text-decoration:none;padding:8px 10px;}' +
    '@media (prefers-color-scheme:dark){.ms-link-quiet{color:#cbd5e1;}}' +
    '.ms-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:700;font-size:14px;border-radius:999px;padding:9px 18px;text-decoration:none;border:1px solid transparent;cursor:pointer;transition:transform .15s,box-shadow .2s,background .2s;white-space:nowrap;}' +
    '.ms-btn:active{transform:scale(.97);}' +
    '.ms-btn-primary{background:var(--ms-accent);color:#fff;box-shadow:0 6px 20px rgba(99,102,241,.35);}' +
    '.ms-btn-primary:hover{background:#4f46e5;box-shadow:0 8px 26px rgba(99,102,241,.5);}' +
    '.ms-btn-ghost{background:rgba(99,102,241,.08);color:var(--ms-accent);}' +
    '.ms-btn-ghost:hover{background:rgba(99,102,241,.16);}' +
    '.ms-btn-lg{padding:14px 28px;font-size:16px;}' +
    '.ms-btn-block{width:100%;}' +
    '.ms-burger{display:inline-flex;flex-direction:column;justify-content:center;gap:5px;width:40px;height:40px;border:0;background:none;cursor:pointer;padding:0 8px;}' +
    '.ms-burger span{display:block;height:2px;border-radius:2px;background:#0b1220;transition:.25s;}' +
    '@media (prefers-color-scheme:dark){.ms-burger span{background:#fff;}}' +
    '.ms-burger.ms-open span:nth-child(1){transform:translateY(7px) rotate(45deg);}' +
    '.ms-burger.ms-open span:nth-child(2){opacity:0;}' +
    '.ms-burger.ms-open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}' +
    '.ms-mobile{position:fixed;top:56px;left:0;right:0;bottom:0;background:#fff;padding:18px 22px 40px;overflow-y:auto;z-index:59;}' +
    '@media (prefers-color-scheme:dark){.ms-mobile{background:#0b1220;}}' +
    '.ms-m-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:18px 0 6px;}' +
    '.ms-m-link{display:block;font-size:18px;font-weight:700;color:#0b1220;text-decoration:none;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06);}' +
    '.ms-m-top{margin-top:6px;}' +
    '@media (prefers-color-scheme:dark){.ms-m-link{color:#fff;border-bottom-color:rgba(255,255,255,.08);}}' +
    '.ms-m-actions{margin-top:24px;display:grid;gap:10px;}' +
    '@media (min-width:900px){.ms-nav-desktop{display:flex;}.ms-link-quiet{display:inline-block;}.ms-burger{display:none;}}' +
    /* footer */
    '.ms-ft{background:#0b1220;color:#94a3b8;margin-top:0;}' +
    '.ms-f-cta{max-width:800px;margin:0 auto;padding:88px 22px 64px;text-align:center;}' +
    '.ms-f-cta h2{font-size:clamp(30px,5vw,46px);font-weight:800;letter-spacing:-.03em;color:#fff;margin:0 0 14px;line-height:1.05;}' +
    '.ms-f-cta p{font-size:17px;line-height:1.6;max-width:620px;margin:0 auto 26px;}' +
    '.ms-f-cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}' +
    '.ms-f-cta-note{margin-top:16px;font-size:13px;color:#64748b;}' +
    '.ms-f-grid{max-width:1600px;margin:0 auto;padding:52px 32px;display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:32px;border-top:1px solid rgba(255,255,255,.08);}' +
    '@media (max-width:860px){.ms-f-grid{grid-template-columns:1fr 1fr;}}' +
    '.ms-f-brand p{margin-top:12px;font-size:14px;max-width:230px;}' +
    '.ms-f-h{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#e2e8f0;margin-bottom:14px;}' +
    '.ms-f-col a{display:block;font-size:14px;color:#94a3b8;text-decoration:none;padding:5px 0;transition:color .15s;}' +
    '.ms-f-col a:hover{color:#fff;}' +
    '.ms-f-bottom{max-width:1600px;margin:0 auto;padding:22px 32px;font-size:13px;border-top:1px solid rgba(255,255,255,.08);}' +
    /* motion */
    '.ms-reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}' +
    '.ms-reveal.ms-in{opacity:1;transform:none;}' +
    '@media (prefers-reduced-motion:reduce){.ms-reveal{opacity:1;transform:none;transition:none;}}';

  function mount() {
    // Styles
    var style = document.createElement('style'); style.id = 'ms-nav-css'; style.textContent = CSS;
    document.head.appendChild(style);

    // Header
    var header = document.getElementById('ms-header') || (function () { var h = document.createElement('header'); document.body.insertBefore(h, document.body.firstChild); return h; })();
    header.className = 'ms-hd'; header.innerHTML = '<div class="ms-hd-in">' + headerHTML() + '</div>';

    // Footer
    var footer = document.getElementById('ms-footer') || (function () { var f = document.createElement('footer'); document.body.appendChild(f); return f; })();
    footer.className = 'ms-ft'; footer.innerHTML = footerHTML();

    // Mobile toggle
    var burger = header.querySelector('.ms-burger'), mobile = header.querySelector('.ms-mobile');
    if (burger && mobile) burger.addEventListener('click', function () {
      var open = burger.classList.toggle('ms-open'); mobile.hidden = !open;
      burger.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : '';
    });

    // Shrink-on-scroll
    var onScroll = function () { header.classList.toggle('ms-scrolled', window.scrollY > 8); };
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

    // Scroll-reveal for any .ms-reveal element (staggered by data-ms-delay).
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var d = e.target.getAttribute('data-ms-delay'); if (d) e.target.style.transitionDelay = d + 'ms';
          e.target.classList.add('ms-in'); io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }) : null;
    var scan = function () { document.querySelectorAll('.ms-reveal:not(.ms-in)').forEach(function (el) { io ? io.observe(el) : el.classList.add('ms-in'); }); };
    scan(); window.MSsyncReveal = scan;   // pages can call after injecting content
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
