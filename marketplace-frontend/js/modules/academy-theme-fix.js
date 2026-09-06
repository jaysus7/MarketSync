/* Academy follows dashboard light theme; banner and cards wrap cleanly. */
(function () {
  // ── Why this is page-scoped now ────────────────────────────────────────────
  // This module used to strip `dark` off <html> unconditionally at load:
  //
  //     if (ms-theme !== 'dark') document.documentElement.classList.remove('dark')
  //
  // It is loaded by the ALWAYS-ON dashboard companion loader
  // (website-mobile-layout.js), not by an Academy page, so that one line ran on
  // every dashboard boot and turned dark mode off for the ENTIRE app -- HQ
  // included. Nothing put it back: the inline bootstrap in dashboard.html only
  // toggles `dark` on a prefers-color-scheme CHANGE event, never again on load.
  // And the opt-out it checked (`ms-theme`) is written only by
  // toggleAcademyTheme() in training.js, a different page, so a dashboard user
  // could never have set it. Net effect: dark mode was dead app-wide.
  //
  // Academy still wants its light treatment, so keep it -- but only while the
  // Academy page is actually on screen, and restore the real theme on the way
  // out. Everything else in the dashboard keeps whatever theme it should have.
  const root = document.documentElement;

  const userWantsDark = () => {
    try {
      return localStorage.getItem('ms-theme') === 'dark' || localStorage.getItem('theme') === 'dark';
    } catch (e) { return false; }
  };
  const prefersDark = () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Visible means: the Academy page container exists and is not the hidden one.
  // offsetParent is null for a `display:none` subtree, which is exactly what
  // the SPA's `.hidden` class produces.
  function academyOnScreen() {
    const page = document.querySelector('[data-page-content="academy"]');
    if (page) return !page.classList.contains('hidden') && page.offsetParent !== null;
    const rootEl = document.getElementById('academy-root');
    return !!(rootEl && rootEl.offsetParent !== null);
  }

  // Restores to the only theme source the dashboard actually has today: the OS
  // setting. If a real in-app theme preference is ever added, read it here.
  function restoreTheme() {
    root.classList.toggle('dark', userWantsDark() || prefersDark());
  }

  function syncAcademyTheme() {
    if (userWantsDark()) return;          // explicit dark opt-in wins everywhere
    if (academyOnScreen()) {
      if (root.classList.contains('dark')) {
        root.classList.remove('dark');
        root.dataset.msAcademyLight = '1';   // remember that WE dimmed it
      }
    } else if (root.dataset.msAcademyLight === '1') {
      delete root.dataset.msAcademyLight;
      restoreTheme();
    }
  }

  if (!document.getElementById('academy-theme-fix-css')) {
    const style = document.createElement('style');
    style.id = 'academy-theme-fix-css';
    style.textContent = `
      body.ac-shell, #academy-root, [data-page-content="academy"] {
        background: #F5F7F9 !important;
        color: #0f172a !important;
      }
      body.ac-shell .ac-panel,
      body.ac-shell .ac-hero,
      body.ac-shell .ac-progress,
      #academy-root .rounded-2xl,
      [data-page-content="academy"] .rounded-2xl {
        background: #fff !important;
        color: #0f172a !important;
        border-color: #e2e8f0 !important;
      }
      body.ac-shell h1, body.ac-shell h2, body.ac-shell h3,
      #academy-root h2, #academy-root h3 {
        color: #0f172a !important;
      }
      @media (max-width: 767px) {
        body.ac-shell header.ac-header .flex.items-center.justify-between {
          flex-wrap: wrap;
          gap: 8px;
        }
        .ac-main { padding-left: 12px !important; padding-right: 12px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function fixBanner() {
    document.querySelectorAll('h2, h3, div').forEach(function (el) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.indexOf('Mandatory HR') !== 0) return;
      const card = el.closest('.rounded-2xl, .rounded-3xl, [class*="rounded"]');
      if (!card || card.dataset.msAcadFix === '1') return;
      card.dataset.msAcadFix = '1';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'stretch';
      card.style.gap = '10px';
      card.style.background = '#fff1f2';
      card.style.color = '#881337';
    });
  }
  setInterval(function () { fixBanner(); syncAcademyTheme(); }, 800);
  fixBanner();
  syncAcademyTheme();
})();
