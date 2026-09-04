/* Academy follows dashboard light theme; banner and cards wrap cleanly. */
(function () {
  try {
    if (localStorage.getItem('ms-theme') !== 'dark' && localStorage.getItem('theme') !== 'dark') {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}

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
  setInterval(fixBanner, 800);
  fixBanner();
})();
