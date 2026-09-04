/* Repair order cards: stack content, wrap actions, restore hierarchy on phones. */
(function () {
  if (document.getElementById('ms-ro-mobile-css')) return init();
  const style = document.createElement('style');
  style.id = 'ms-ro-mobile-css';
  style.textContent = `
    @media (max-width: 720px) {
      [data-page-content="service"] .rounded-xl.border.p-3\.5,
      #service-workspace .rounded-xl.border,
      .svc-ro-row, [data-svc-ro-row] {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;
        padding: 14px !important;
        overflow: hidden !important;
      }
      [data-page-content="service"] .rounded-xl.border .flex.items-center.justify-between {
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;
      }
      [data-page-content="service"] .rounded-xl.border button.min-w-0.flex-1 {
        width: 100% !important;
        min-width: 0 !important;
      }
      [data-page-content="service"] .rounded-xl.border .shrink-0,
      [data-page-content="service"] .rounded-xl.border .flex.items-center.gap-2.shrink-0 {
        width: 100% !important;
        flex-wrap: wrap !important;
        justify-content: flex-start !important;
        row-gap: 8px !important;
      }
      [data-page-content="service"] .rounded-xl.border .truncate {
        white-space: normal !important;
        overflow: visible !important;
      }
      [data-page-content="service"] {
        padding-bottom: 120px !important;
      }
    }
  `;
  document.head.appendChild(style);
  init();

  function restack() {
    document.querySelectorAll('[data-page-content="service"] .rounded-xl.border').forEach(function (card) {
      if (card.dataset.msRoStack === '1') return;
      const actions = card.querySelector('.shrink-0, .flex.items-center.gap-2.shrink-0');
      const titleBtn = card.querySelector('button.min-w-0, button.flex-1, button.text-left');
      if (!titleBtn && !actions) return;
      card.dataset.msRoStack = '1';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'stretch';
      if (actions) {
        actions.style.width = '100%';
        actions.style.flexWrap = 'wrap';
        actions.querySelectorAll('button').forEach(function (b) {
          if ((b.textContent || '').trim() === 'Video Walkaround') b.textContent = 'Tech video';
        });
      }
    });
  }

  function init() {
    restack();
    setInterval(restack, 800);
  }
})();
