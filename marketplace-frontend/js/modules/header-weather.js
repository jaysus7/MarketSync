/* Compact mobile header clock + local weather. */
(function (global) {
  'use strict';

  // Condition names only. These used to carry an emoji glyph each, rendered
  // straight into the header chip as the weather icon — the exact "emoji as UI"
  // the zero-emoji rule forbids (icons come from the SVG icon system, and a
  // glyph renders differently on every platform and reads as nothing to a
  // screen reader). The chip now shows the condition in words.
  const WMO = {
    0: ['Clear'], 1: ['Mostly clear'], 2: ['Partly cloudy'], 3: ['Cloudy'],
    45: ['Fog'], 48: ['Icy fog'],
    51: ['Drizzle'], 53: ['Drizzle'], 55: ['Heavy drizzle'],
    61: ['Rain'], 63: ['Rain'], 65: ['Heavy rain'],
    71: ['Snow'], 73: ['Snow'], 75: ['Heavy snow'],
    80: ['Showers'], 81: ['Showers'], 82: ['Heavy showers'],
    95: ['Thunder'], 96: ['Storm'], 99: ['Storm']
  };

  function injectCss() {
    var style = document.getElementById('header-weather-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'header-weather-css';
      document.head.appendChild(style);
    }
    style.textContent = `
      #header-weather-chip{
        display:inline-flex;align-items:center;gap:4px;
        padding:4px 8px;border-radius:10px;
        border:1px solid rgba(148,163,184,.35);
        background:rgba(241,245,249,.92);
        color:#0f172a;font:800 11px/1.1 -apple-system,Segoe UI,sans-serif;
        white-space:nowrap;flex-shrink:0;
      }
      .dark #header-weather-chip{background:rgba(15,23,42,.9);color:#e2e8f0;border-color:rgba(51,65,85,.9)}
      /* The condition is a word now, not a single glyph, and the chip is
         nowrap + flex-shrink:0 — so bound it, or "Partly cloudy" widens the
         mobile header the way this file's own media query works to prevent.
         Below 480px the word is dropped entirely; the chip's title attribute
         still carries the full condition. */
      #header-weather-chip .wx-cond{max-width:9ch;overflow:hidden;text-overflow:ellipsis}
      @media (max-width: 479px){ #header-weather-chip .wx-cond{display:none} }
      @media (max-width: 767px) {
        header.ms-chrome-glass,
        body > header.fixed {
          overflow: hidden !important;
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          padding-left: 10px !important;
          padding-right: 10px !important;
          gap: 6px !important;
        }
        header.ms-chrome-glass > div:first-child {
          min-width: 0 !important;
          flex: 1 1 auto !important;
          overflow: hidden !important;
          gap: 6px !important;
        }
        #dashboard-brand img { height: 28px !important; width: auto !important; }
        #header-clock-date { display: none !important; }
        #header-clock-display { min-width: 0 !important; }
        #header-clock-time { min-width: 0 !important; font-size: 12px !important; }
        #header-shift-timer-display { display: none !important; }
        #header-shift-clock-chip {
          max-width: none !important;
          overflow: visible !important;
          gap: 4px !important;
          padding: 4px 8px !important;
        }
        #header-shift-clock-chip .w-px,
        #header-shift-clock-chip > .h-3\\.5 { display: none !important; }
        #header-weather-chip { padding: 4px 6px; }
        #header-weather-chip .wx-place { display: none; }
        #ui-role-pill { display: none !important; }
      }
    `;
  }

  function compactClock() {
    if (window.innerWidth > 767) return;
    const timeEl = document.getElementById('header-clock-time');
    if (!timeEl) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    timeEl.textContent = hours + ':' + minutes;
    const period = document.getElementById('header-clock-period');
    if (period) period.textContent = ampm;
  }

  function ensureWeatherChip() {
    if (document.getElementById('header-weather-chip')) return document.getElementById('header-weather-chip');
    const clock = document.getElementById('header-shift-clock-wrapper') || document.getElementById('header-shift-clock-chip');
    if (!clock || !clock.parentElement) return null;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.id = 'header-weather-chip';
    chip.title = 'Local weather';
    chip.textContent = 'Weather';
    clock.parentElement.insertBefore(chip, clock.nextSibling);
    return chip;
  }

  function renderWeather(chip, data) {
    const code = Number(data.weather_code);
    const pair = WMO[code] || WMO[Math.floor(code)] || ['Local'];
    const temp = Math.round(Number(data.temperature_2m));
    const place = data.place ? '<span class="wx-place">' + data.place + '</span>' : '';
    chip.innerHTML = '<span class="wx-cond">' + pair[0] + '</span><span class="wx-temp">' + temp + '°</span>' + place;
    chip.title = pair[0] + (data.place ? ' · ' + data.place : '');
  }

  function coordsFromGeo() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, place: '' }); },
        function () { resolve(null); },
        { enableHighAccuracy: false, timeout: 2500, maximumAge: 30 * 60 * 1000 }
      );
    });
  }

  async function coordsFromIp() {
    try {
      const res = await fetch('https://ipwho.is/');
      const json = await res.json();
      if (!json || !json.success) return { lat: 39.41, lon: -74.36, place: 'Brigantine' };
      return { lat: json.latitude, lon: json.longitude, place: json.city || json.region || '' };
    } catch (e) {
      return { lat: 39.41, lon: -74.36, place: 'Brigantine' };
    }
  }

  async function loadWeather() {
    const chip = ensureWeatherChip();
    if (!chip) return;
    let loc = await coordsFromGeo();
    if (!loc) loc = await coordsFromIp();
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon + '&current=temperature_2m,weather_code&temperature_unit=fahrenheit';
    const res = await fetch(url);
    const json = await res.json();
    const current = json && json.current || {};
    renderWeather(chip, {
      temperature_2m: current.temperature_2m,
      weather_code: current.weather_code,
      place: loc.place
    });
  }

  injectCss();
  compactClock();
  setInterval(compactClock, 1000);
  const boot = setInterval(function () {
    if (document.getElementById('header-shift-clock-chip')) {
      injectCss();
      ensureWeatherChip();
      loadWeather().catch(function () {});
      clearInterval(boot);
    }
  }, 400);
  setTimeout(function () { clearInterval(boot); }, 20000);
})(window);
