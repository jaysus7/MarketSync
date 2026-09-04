/* Website mobile layout + always-on dashboard companion loader. */
(function () {
  if (!document.getElementById('website-mobile-layout-css')) {
    const style = document.createElement('style');
    style.id = 'website-mobile-layout-css';
    style.textContent = `
    #website-root, #page-content, [data-page-content], .website-studio-shell, .website-studio-view {
      overflow: visible !important;
      max-height: none !important;
    }
    #website-root, .website-studio-view { padding-bottom: 112px; }
    .website-studio-view .grid { display:grid !important; grid-template-columns:1fr !important; gap:16px !important; }
    @media (min-width: 640px) { .website-studio-view .grid { grid-template-columns:1fr 1fr !important; } }
    .website-studio-view article img, .website-studio-view article .h-36 { max-height:160px !important; height:160px !important; width:100% !important; object-fit:cover !important; }
    @media (max-width: 420px) { .website-studio-view article .flex.gap-2 { flex-direction:column; } }
    #svc-checkin-modal #svc-in-date,
    #svc-checkin-modal #svc-in-tag {
      min-height: 44px;
      height: 44px;
      line-height: 20px;
    }
    #svc-checkin-modal svg[id^="svc-walk-"] { height: 7rem; }
  `;
    document.head.appendChild(style);
  }

  function load(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  }

  if (!window.__headerWeatherLoaded) {
    window.__headerWeatherLoaded = true;
    load('js/modules/header-weather.js?v=20260904_wx_v1');
  }

  if (!window.__studioCompanionsFromDash) {
    window.__studioCompanionsFromDash = true;
    [
      'js/modules/studio/studio-dashboard-home.js?v=20260904_home_dash_v4',
      'js/modules/studio/studio-template-previews.js?v=20260904_tmpl_preview_v4',
      'js/modules/studio/studio-page-thumbs.js?v=20260904_white_canvas_v2',
      'js/modules/studio/studio-context-toolbar.js?v=20260904_ctx_toolbar_v2',
      'js/modules/inventory-actions-upgrade.js?v=20260904_inv_actions_v1',
      'js/modules/service-checkin-upgrade.js?v=20260904_checkin_v1',
      'js/modules/service-walkaround-cars.js?v=20260904_cars_v1'
    ].forEach(load);
  }
})();
