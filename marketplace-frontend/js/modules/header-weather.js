/* Compact mobile header clock + local weather. */
(function (global) {
  'use strict';

  const WMO = {
    0: ['Clear', '☀️'], 1: ['Mostly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Cloudy', '☁️'],
    45: ['Fog', '🌫️'], 48: ['Icy fog', '🌫️'],
    51: ['Drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Heavy drizzle', '🌧️'],
    61: ['Rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'],
    71: ['Snow', '❄️'], 73: ['Snow', '❄️'], 75: ['Heavy snow', '❄️'],
    80: ['Showers', '🌧️'], 81: ['Showers', '🌧️'], 82: ['Heavy showers', '🌧️'],
    95: ['Thunder', '⛈️'], 96: ['Storm', '⛈️'], 99: ['Storm', '⛈️']
  };

  function injectCss() {
    if (document.getElementById('header-weather-css')) return;
    const style = document.createElement('style');
    style.id = 'header-weather-css';
    style.textContent = `
      #header-weather-chip{
        display:inline-flex;align-items:center;gap:6px;
        padding:6px 10px;border-radius:12px;
        border:1px solid rgba(148,163,184,.35);
        background:rgba(241,245,249,.92);
        color:#0f172a;font:800 11px/1.1 -apple-system,Segoe UI,sans-serif;
        white-space:nowrap;flex-shrink:0;
      }
      .dark #header-weather-chip{background:rgba(15,23,42,.9);color:#e2e8f0;border-color:rgba(51,65,85,.9)}
      #header-weather-chip .wx-temp{font-variant-numeric:tabular-nums}
      @media (max-width: 767px) {
        #header-shift-clock-chip{
          max-width:min(58vw, 220px);
          overflow:hidden;
          gap:6px !important;
          padding-left:8px !important;
          padding-right:8px !important;
        }
        #header-clock-date{min-width:0 !important;font-size:10px !important}
        #header-clock-time{min-width:5.2ch !important}
        #header-shift-timer-display{display:none !important}
        #header-shift-clock-chip > .h-3\\.5,
        #header-shift-clock-chip .w-px{display:none !important}
        #header-weather-chip .wx-place{display:none}
      }
    `;
    document.head.appendChild(style);
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
    const pair = WMO[code] || WMO[Math.floor(code)] || ['Local', '🌤️'];
    const temp = Math.round(Number(data.temperature_2m));
    const unit = data.unit || '°F';
    const place = data.place ? '<span class="wx-place">' + data.place + '</span>' : '';
    chip.innerHTML = '<span>' + pair[1] + '</span><span class="wx-temp">' + temp + unit + '</span>' + place;
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
      return {
        lat: json.latitude,
        lon: json.longitude,
        place: json.city || json.region || ''
      };
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
      unit: '°',
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
