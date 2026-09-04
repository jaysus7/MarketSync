/* Website mobile layout + always-on dashboard companion loader. */
(function () {
  var style = document.getElementById('website-mobile-layout-css');
  if (!style) {
    style = document.createElement('style');
    style.id = 'website-mobile-layout-css';
    document.head.appendChild(style);
  }
  style.textContent = `
    #website-root, #page-content, [data-page-content], .website-studio-shell, .website-studio-view {
      overflow: visible !important;
      max-height: none !important;
    }
    #website-root, .website-studio-view, [data-page-content="website"], [data-page-content="marketing"] {
      padding-bottom: 140px !important;
    }
    .website-studio-view p, .website-studio-view h2, .website-studio-view h3 {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: unset !important;
      max-width: 100% !important;
    }
    .website-studio-tabs, [role="tablist"] {
      flex-wrap: wrap !important;
      overflow: visible !important;
      row-gap: 4px !important;
    }
    .website-studio-view .grid { display:grid !important; grid-template-columns:1fr !important; gap:16px !important; }
    @media (min-width: 640px) { .website-studio-view .grid { grid-template-columns:1fr 1fr !important; } }
    .website-studio-view article img, .website-studio-view article .h-36 { max-height:160px !important; height:160px !important; width:100% !important; object-fit:cover !important; }
    @media (max-width: 767px) {
      header.ms-chrome-glass, body > header.fixed {
        overflow: hidden !important;
      }
      #header-clock-date { display: none !important; }
      #header-shift-timer-display { display: none !important; }
      #dashboard-brand img { height: 28px !important; }
      .website-studio-view .truncate { white-space: normal !important; overflow: visible !important; }
      [data-page-content] .overflow-hidden { overflow: visible !important; }
      [data-page-content] .overflow-x-auto { overflow-x: auto !important; overflow-y: visible !important; }
    }
    #svc-checkin-modal #svc-in-date,
    #svc-checkin-modal #svc-in-tag { min-height:44px; height:44px; line-height:20px; }
    #svc-checkin-modal svg[id^="svc-walk-"] { height: 7rem; }
    @media (max-width: 720px) {
      .rounded-xl.border.flex.items-center.justify-between.gap-3 {
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 10px !important;
      }
      .rounded-xl.border .flex.items-center.gap-2.shrink-0 {
        width: 100% !important;
        flex-wrap: wrap !important;
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
    load('js/modules/header-weather.js?v=20260904_wx_v3');
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
