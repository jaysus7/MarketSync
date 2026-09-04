/* Keep Website Studio template cards fully visible on phones. */
(function () {
  if (document.getElementById('website-mobile-layout-css')) return;
  const style = document.createElement('style');
  style.id = 'website-mobile-layout-css';
  style.textContent = `
    #website-root, #page-content, [data-page-content], .website-studio-shell, .website-studio-view {
      overflow: visible !important;
      max-height: none !important;
    }
    #website-root, .website-studio-view {
      padding-bottom: 112px;
    }
    .website-studio-view .grid {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }
    @media (min-width: 640px) {
      .website-studio-view .grid { grid-template-columns: 1fr 1fr !important; }
    }
    .website-studio-view article {
      overflow: hidden;
    }
    .website-studio-view article .h-36,
    .website-studio-view article img {
      max-height: 160px !important;
      height: 160px !important;
      width: 100% !important;
      object-fit: cover !important;
    }
    .website-studio-view article .flex.gap-2 {
      flex-wrap: wrap;
    }
    .website-studio-view article .flex.gap-2 > button {
      min-width: calc(50% - 6px);
    }
    @media (max-width: 420px) {
      .website-studio-view article .flex.gap-2 {
        flex-direction: column;
      }
      .website-studio-view article .flex.gap-2 > button {
        width: 100%;
        min-width: 0;
      }
    }
  `;
  document.head.appendChild(style);
})();
