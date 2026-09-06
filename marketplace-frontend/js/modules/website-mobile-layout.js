/* Always-on dashboard companion loader. */
(function () {
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
      'js/modules/studio/studio-page-thumbs.js?v=20260906_upper_canvas_fix_v1',
      'js/modules/studio/studio-context-toolbar.js?v=20260904_ctx_toolbar_v2',
      'js/modules/studio/studio-template-hydrate.js?v=20260905_disabled_v1',
      'js/modules/studio/studio-shape-drop.js?v=20260904_shape_drop_v1',
      'js/modules/studio/studio-elements-drop.js?v=20260904_el_drop_v2',
      'js/modules/studio/studio-live-motion.js?v=20260904_live_motion_v1',
      'js/modules/studio/studio-chart-data.js?v=20260904_chart_data_v1',
      'js/modules/studio/studio-remove-bg.js?v=20260904_rmbg_v1',
      'js/modules/inventory-background-fix.js?v=20260904_pbg_v1',
      'js/modules/website-stock-cards.js?v=20260904_lotbg_v1',
      'js/modules/inventory-actions-upgrade.js?v=20260904_inv_actions_v1',
      'js/modules/inventory-site-bridge.js?v=20260904_inv_bridge_v1',
      'js/modules/service-checkin-upgrade.js?v=20260904_checkin_v1',
      'js/modules/service-walkaround-cars.js?v=20260904_cars_v1',
      'js/modules/service-checkin-video.js?v=20260904_checkin_vid_v2',
      'js/modules/video-teleprompter-policy.js?v=20260904_tp_policy_v1',
      'js/modules/camera-native.js?v=20260904_cam_native_v1',
      'js/modules/calendar-booking-upgrade.js?v=20260904_cal_book_v1',
      'js/modules/service-ro-mobile.js?v=20260904_ro_mobile_v1',
      'js/modules/dvi-text-wrap.js?v=20260904_dvi_wrap_v1',
      'js/modules/academy-theme-fix.js?v=20260906_acad_scoped_v1'
    ].forEach(load);
  }
})();
