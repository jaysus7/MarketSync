/* Website mobile layout + always-on dashboard companion loader. */
(function () {
  var style = document.getElementById('website-mobile-layout-css');
  if (!style) {
    style = document.createElement('style');
    style.id = 'website-mobile-layout-css';
    document.head.appendChild(style);
  }
  style.textContent = `
    #website-root,
    .website-studio-shell,
    .website-studio-view,
    [data-page-content="website"],
    [data-page-content="marketing"] {
      overflow: visible !important;
      max-height: none !important;
      padding-bottom: 148px !important;
    }
    .website-studio-view p,
    .website-studio-view h2,
    .website-studio-view h3,
    .website-studio-view .truncate {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: unset !important;
      max-width: 100% !important;
    }
    .website-studio-tabs,
    [role="tablist"] {
      flex-wrap: wrap !important;
      overflow: visible !important;
      row-gap: 6px !important;
    }
    .website-studio-view .grid {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }
    @media (min-width: 640px) {
      .website-studio-view .grid { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 767px) {
      header.ms-chrome-glass,
      body > header.fixed {
        overflow: hidden !important;
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
      #dashboard-brand img { height: 28px !important; }
      #header-clock-date { display: none !important; }
      #header-shift-timer-display { display: none !important; }
      #header-clock-display { min-width: 0 !important; }
      #demo-mode-badge {
        top: auto !important;
        bottom: 148px !important;
        left: auto !important;
        right: 16px !important;
        transform: none !important;
      }
      #page-content, [data-page-content] {
        overflow: visible !important;
        max-height: none !important;
        padding-bottom: 148px !important;
      }
      [data-page-content] .overflow-hidden { overflow: visible !important; }
      [data-page-content] .overflow-x-auto {
        overflow-x: auto !important;
        overflow-y: visible !important;
      }
    }
  `;

  function load(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  }

  if (!window.__headerWeatherLoaded) {
    window.__headerWeatherLoaded = true;
    load('js/modules/header-weather.js?v=20260904_wx_v4');
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
      'js/modules/service-walkaround-cars.js?v=20260904_cars_v1',
      'js/modules/service-checkin-video.js?v=20260904_checkin_vid_v1',
      'js/modules/video-teleprompter-policy.js?v=20260904_tp_policy_v1',
      'js/modules/camera-native.js?v=20260904_cam_native_v1',
      'js/modules/calendar-booking-upgrade.js?v=20260904_cal_book_v1',
      'js/modules/service-ro-mobile.js?v=20260904_ro_mobile_v1',
      'js/modules/dvi-text-wrap.js?v=20260904_dvi_wrap_v1',
      'js/modules/academy-theme-fix.js?v=20260904_acad_light_v1'
    ].forEach(load);
  }
})();
