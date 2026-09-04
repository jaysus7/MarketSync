/* Sit vehicle photos on the branded lot background for site + builder cards. */
(function (global) {
  'use strict';

  function bgUrl() {
    return (global.__photoBackgroundUrl) ||
      (global.DATA && global.DATA.site && global.DATA.site.photo_background_url) ||
      (global.__siteSettings && global.__siteSettings.photo_background_url) || '';
  }

  function paint(img) {
    const bg = bgUrl();
    if (!bg || !img || img.dataset.msLotBg === '1') return;
    const wrap = img.closest('.relative, .vehicle-card, article, button') || img.parentElement;
    if (!wrap) return;
    wrap.style.backgroundImage = 'url(\'' + bg + '\')';
    wrap.style.backgroundSize = 'cover';
    wrap.style.backgroundPosition = 'center';
    img.style.objectFit = 'contain';
    img.style.background = 'transparent';
    img.dataset.msLotBg = '1';
  }

  function scan() {
    document.querySelectorAll('#grid img, #inv-results img, [onclick*="openVehicle"] img, .cshadow img').forEach(paint);
  }

  if (global.DATA && global.DATA.inventory && !global.DATA.vehicles) global.DATA.vehicles = global.DATA.inventory;
  scan();
  setInterval(scan, 1200);
})(window);
