// Resolve the backend by host so the staging site talks to the staging backend and
// production talks to production — otherwise a token minted by one is rejected by the
// other (the "logs in then logs out" bug). Keep in sync with login/register/reset pages.
const API = (location.hostname.includes('staging') ? 'https://marketsync-staging-backend.onrender.com' : 'https://vehicle-marketplace-s0e4.onrender.com');

// Wrap fetch so EVERY call to our API carries the demo-workspace header when the
// owner is in Demo mode — keeps all pages (even those using raw fetch) consistently
// scoped to the sandboxed demo dealership. No-op for non-API URLs and other users.
(function () {
  const _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf(API) === 0 &&
        document.documentElement.getAttribute('data-dash-owner') === '1' &&
        document.documentElement.getAttribute('data-dash-mode') === 'demo') {
        init = init || {};
        const h = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
        h.set('X-Act-Demo', '1');
        init = { ...init, headers: h };
      }
    } catch (e) { }
    return _fetch(input, init);
  };
})();
// Carfax Canada report link by VIN. Swap to your dealer badge/report URL if you
// wire the Carfax account (the VIN is appended, URL-encoded).
const CARFAX_BASE = 'https://www.carfax.ca/vehicle-history-reports?vin=';

// Global HTML escaper. Used throughout the pipeline board, leads table, and other
// renderers. It was previously only defined locally inside one function, so those
// other call sites threw "Can't find variable: esc" mid-render — which left the
// Pipeline & Leads page stuck on "Loading…" (the render crashed before painting).
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Inline line-icon set (Font Awesome / Heroicons style) — no external library, so
// it's CSP-safe and inherits currentColor like the rest of the UI. Use svgIcon()
// everywhere instead of emojis.
const SVG_ICONS = {
  dot: '<circle cx="12" cy="12" r="3"/>',
  video: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-2.72a.75.75 0 011.28.53v7.38a.75.75 0 01-1.28.53l-4.72-2.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-7.5A2.25 2.25 0 0013.5 6.75h-9A2.25 2.25 0 002.25 9v7.5a2.25 2.25 0 002.25 2.25z"/>',
  sparkles: '<path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/><path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>',
  fuel: '<path d="M3.75 21h10.5M4.5 21V5.25A2.25 2.25 0 016.75 3h4.5a2.25 2.25 0 012.25 2.25V21M13.5 9h2.25a2.25 2.25 0 012.25 2.25v6a1.5 1.5 0 003 0V9.257a1.5 1.5 0 00-.44-1.06l-2.06-2.06M7.5 7.5h3"/>',
  tag: '<path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/><path d="M6 6h.008v.008H6V6z"/>',
  shield: '<path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>',
  droplet: '<path d="M12 21a9 9 0 01-9-9c0-3.6 4.5-9.75 9-11.25C16.5 2.25 21 8.4 21 12a9 9 0 01-9 9z"/>',
  camera: '<path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"/>',
  wrench: '<path d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085"/>',
  truck: '<path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>',
  phone: '<path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/>',
  key: '<path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>',
  clipboard: '<path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>',
  user: '<path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>',
  calendar: '<path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>',
  paperclip: '<path d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>',
  check: '<path d="M4.5 12.75l6 6 9-13.5"/>',
  play: '<path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>',
  reopen: '<path d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>',
  rocket: '<path d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758L16.5 21"/>',
  eye: '<path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>',
  chart: '<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>',
  download: '<path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>',
  refresh: '<path d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.66 0a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>',
  receipt: '<path d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M3.75 21V4.5A1.5 1.5 0 015.25 3h13.5a1.5 1.5 0 011.5 1.5V21l-2.25-1.5L15.75 21l-2.25-1.5L11.25 21 9 19.5 6.75 21 4.5 19.5 3.75 21z"/>',
  plus: '<path d="M12 4.5v15m7.5-7.5h-15"/>',
  close: '<path d="M6 18L18 6M6 6l12 12"/>',
  chevronRight: '<path d="m8.25 4.5 7.5 7.5-7.5 7.5"/>',
  chat: '<path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"/>',
  globe: '<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M11.5 3a15.3 15.3 0 000 18M12.5 3a15.3 15.3 0 010 18"/>',
  bolt: '<path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>',
  trophy: '<path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/>',
  star: '<path d="M11.48 3.5a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9l3-6z"/><path d="M3 9h18M8.5 3l1.5 6L12 3l2 6 1.5-6M9.9 9L12 21l2.1-12"/>',
  flame: '<path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/><path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z"/>',
  megaphone: '<path d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73"/>',
  currency: '<path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
  hashtag: '<path d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5"/>',
  document: '<path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>',
  car: '<path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/>',
  users: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>',
};
function svgIcon(name, cls = 'w-4 h-4') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">${SVG_ICONS[name] || SVG_ICONS.dot}</svg>`;
}

// ── Auto-format number inputs: thousands commas + up to 2 decimals ───────────
// Give an input `data-money` (with type="text" inputmode="decimal") and it formats
// live as the user types — e.g. 26626 → 26,626. Read the value back through msNum(),
// which strips the commas so Number parsing stays correct. msFmtMoney formats a value.
function msNum(v) {
  if (v && typeof v === 'object' && 'value' in v) v = v.value;
  const n = Number(String(v == null ? '' : v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}
function msFmtMoney(raw) {
  let s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
  if (s === '' || s === '-' || s === '.') return s;
  const neg = s[0] === '-';
  s = s.replace(/-/g, '');
  const firstDot = s.indexOf('.');
  let intPart = firstDot >= 0 ? s.slice(0, firstDot) : s;
  const decPart = firstDot >= 0 ? s.slice(firstDot + 1).replace(/\./g, '').slice(0, 2) : null;
  intPart = intPart.replace(/^0+(?=\d)/, '');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (grouped || (decPart !== null ? '0' : '')) + (decPart !== null ? '.' + decPart : '');
}
// Live formatter — runs on any data-money input, keeping the caret a stable distance
// from the end so inserted commas don't jump the cursor.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el || el.tagName !== 'INPUT' || !el.hasAttribute('data-money')) return;
  const before = el.value;
  const caretFromEnd = before.length - (el.selectionStart ?? before.length);
  const after = msFmtMoney(before);
  if (after !== before) {
    el.value = after;
    const pos = Math.max(0, after.length - caretFromEnd);
    try { el.setSelectionRange(pos, pos); } catch { }
  }
}, true);
// Format pre-filled data-money inputs inside a freshly-rendered container.
function msFormatMoneyInputs(root) {
  (root || document).querySelectorAll?.('input[data-money]')?.forEach(el => {
    if (el.value !== '') el.value = msFmtMoney(el.value);
  });
}

// Inline SVG icon set — replaces emoji for a cleaner, professional look. Paths are
// standard Heroicons outlines (render on currentColor). Add names as pages migrate.
const MS_ICONS = {
  chat: 'M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.7 9.7 0 01-4-.85L3 21l1.85-4.5A8 8 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0l-2 3h-4l-1 2H9l-1-2H4m16 0v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3',
  car: 'M8 17a2 2 0 11-4 0 2 2 0 014 0zm12 0a2 2 0 11-4 0 2 2 0 014 0zM3 13h18l-1.5-5.5A2 2 0 0017.6 6H6.4a2 2 0 00-1.9 1.5L3 13zm0 0v3h1m16-3v3h-1',
  check: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  phone: 'M3 5a2 2 0 012-2h1.6a1 1 0 01.95.68l1 3a1 1 0 01-.27 1.06l-1.2 1.2a12 12 0 005.7 5.7l1.2-1.2a1 1 0 011.06-.27l3 1a1 1 0 01.68.95V19a2 2 0 01-2 2A16 16 0 013 5z',
  mail: 'M3 8l9 6 9-6M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z',
  note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z',
  calendar: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  download: 'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16',
  reply: 'M3 10h10a5 5 0 015 5v2M3 10l6-6M3 10l6 6',
  trophy: 'M8 21h8m-4-4v4M7 4h10v4a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3m10-4h3v1a3 3 0 01-3 3',
};
function msIco(name, cls) {
  const d = MS_ICONS[name]; if (!d) return '';
  return `<svg class="${cls || 'w-4 h-4'} inline-block flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
}

// GET a JSON endpoint with a cold-start-friendly retry. The backend runs on a
// tier that spins down when idle, so the first request after a lull can hang or
// return a 502/503/504 for ~30–60s while it wakes. We retry those (and network
// errors) a few times with backoff, and surface the real status/message on final
// failure instead of a generic "could not load".
// In owner Demo mode, scope every API call to the sandboxed demo workspace via a
// header the backend honors only for the MarketSync owner. Read from the DOM so it
// works regardless of when the mode variables initialize.
function actHeaders() {
  try {
    if (document.documentElement.getAttribute('data-dash-owner') === '1' &&
      document.documentElement.getAttribute('data-dash-mode') === 'demo') return { 'X-Act-Demo': '1' };
  } catch (e) { }
  return {};
}
const __apiInflight = new Map();
async function apiGetJson(path, { retries = 4, timeoutMs = 15000, onRetry } = {}) {
  if (__apiInflight.has(path)) return __apiInflight.get(path);
  const reqPromise = (async () => {
    let lastErr;
    let triedRefresh = false;   // one silent token refresh per call on a 401
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const r = await fetch(`${API}${path}`, {
          headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`, ...actHeaders() },
          signal: ctrl.signal,
          cache: 'no-store',   // avoid 304s that Response.ok treats as a failure
        });
        if (r.status === 401 && !triedRefresh) {
          triedRefresh = true;
          clearTimeout(timer);
          const ok = await refreshSessionSilently();
          if (ok) { attempt--; continue; }
        }
        if (r.ok) return await r.json();
        if ([429, 500, 502, 503, 504].includes(r.status) && attempt < retries) {
          lastErr = new Error(`HTTP ${r.status}`);
        } else {
          // A status outside the retryable set (404, 403, 400, ...) is a deterministic
          // answer — retrying the identical request won't change it. Mark it so the
          // catch block below throws immediately instead of silently retrying it up to
          // `retries` more times (a plain throw here used to get caught by the same
          // catch as a network error and re-looped, turning e.g. a 404 into a ~15s
          // stall before the real error ever reached the caller).
          let msg = `HTTP ${r.status}`;
          try { const b = await r.json(); if (b?.error) msg = b.error; } catch { }
          const err = new Error(msg);
          err.nonRetryable = true;
          throw err;
        }
      } catch (e) {
        if (e.name === 'AbortError') lastErr = new Error('Request timed out');
        else lastErr = e;
        if (attempt >= retries || e.nonRetryable) throw lastErr;
      } finally {
        clearTimeout(timer);
      }
      if (typeof onRetry === 'function') try { onRetry(attempt + 1, retries + 1); } catch { }
      await new Promise(res => setTimeout(res, Math.min(6000, 1000 * (attempt + 1))));
    }
    throw lastErr || new Error('Request failed');
  })().finally(() => {
    __apiInflight.delete(path);
  });
  __apiInflight.set(path, reqPromise);
  return reqPromise;
}

// Generic JSON write helper (POST/PUT/PATCH/DELETE). Throws Error(body.error) on
// non-2xx so callers can try/catch + toast. Used by the built-in CRM.
async function apiSendJson(path, method = 'POST', body = null, { timeoutMs = 20000 } = {}) {
  async function attempt() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${API}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json', ...actHeaders() },
        body: body != null ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
  }
  let r = await attempt();
  // 401 → refresh the token once and retry (self-heal an expired session). No forced
  // logout: a failed refresh just surfaces the error, it doesn't eject the user.
  if (r.status === 401) {
    const ok = await refreshSessionSilently();
    if (ok) r = await attempt();
  }
  let data = null; try { data = await r.json(); } catch { }
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data || {};
}

// Same contract as apiSendJson, for a FormData body (file uploads) — no
// Content-Type header is set here on purpose; the browser must generate the
// multipart boundary itself, which it can only do if the header is left unset.
// Default timeout is longer than a JSON write since these carry real file bytes
// (e.g. sales videos, up to 200MB).
async function apiSendFormData(path, method = 'POST', formData, { timeoutMs = 120000 } = {}) {
  async function attempt() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(`${API}${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${token || localStorage.getItem('token') || ''}`, ...actHeaders() },
        body: formData,
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }
  }
  let r = await attempt();
  if (r.status === 401) {
    const ok = await refreshSessionSilently();
    if (ok) r = await attempt();
  }
  let data = null; try { data = await r.json(); } catch { }
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data || {};
}

// Surface otherwise-invisible runtime errors so "stuck loading" symptoms become
// diagnosable instead of silent. Deduped so a repeating error doesn't spam.
; (function installGlobalErrorSurfacer() {
  let last = '';
  const show = (label, msg) => {
    const text = `${label}: ${msg}`;
    if (text === last) return; last = text;
    console.error('[MarketSync]', text);
    try { if (typeof showToast === 'function') showToast(text.slice(0, 160), 'error', 8000); } catch { }
  };
  window.addEventListener('error', (e) => show('JS error', e.message || String(e.error || e)));
  window.addEventListener('unhandledrejection', (e) => show('Unhandled', (e.reason && (e.reason.message || e.reason)) || 'promise rejection'));
})();

function showToast(message, type = 'info', duration = 4000) {
  const el = document.createElement('div');
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-indigo-600' };
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-xl transition-opacity ${colors[type] || colors.info}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, duration);
}
function toast(message, type = 'info', duration = 4000) {
  showToast(message, type, duration);
}
window.toast = showToast;

// If the extension passed a token in the URL hash (#tk=...), store it into
// localStorage so the user is automatically logged in, then strip the hash.
; (function bootstrapExtensionToken() {
  try {
    const hash = window.location.hash
    const match = hash.match(/[#&]tk=([^&]+)/)
    if (match) {
      const tk = decodeURIComponent(match[1])
      localStorage.setItem('token', tk)
      // Replace hash without reloading so the token isn't left in browser history
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  } catch { }
})()

  // After a calendar OAuth round-trip the provider redirects back with
  // ?calendar=connected|error. Surface it, land the user on Integrations, then
  // strip the params so a refresh doesn't re-toast.
  ; (function bootstrapCalendarReturn() {
    try {
      const q = new URLSearchParams(window.location.search)
      const state = q.get('calendar')
      if (!state) return
      const provider = q.get('provider') || ''
      const label = provider === 'google' ? 'Google Calendar' : provider === 'microsoft' ? 'Outlook Calendar' : 'Calendar'
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          if (state === 'connected') { showToast(`${label} connected`, 'success'); if (typeof switchPage === 'function') { switchPage('profile'); setTimeout(() => { if (typeof settingsTab === 'function') settingsTab('admin'); }, 250); } }
          else showToast(`Couldn’t connect ${label}${q.get('msg') ? ': ' + q.get('msg') : ''}`, 'error', 7000)
        }, 400)
      })
      q.delete('calendar'); q.delete('provider'); q.delete('msg')
      history.replaceState(null, '', window.location.pathname + (q.toString() ? '?' + q.toString() : ''))
    } catch { }
  })()

  // Same, for the ad-spend (Meta / Google Ads) OAuth return.
  ; (function bootstrapAdSpendReturn() {
    try {
      const q = new URLSearchParams(window.location.search)
      const state = q.get('adspend')
      if (!state) return
      const provider = q.get('provider') || ''
      const label = provider === 'meta' ? 'Meta Ads' : provider === 'google_ads' ? 'Google Ads' : 'Ad account'
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          if (state === 'connected') { showToast(`${label} connected — importing spend…`, 'success'); if (typeof switchPage === 'function') switchPage('reports'); }
          else showToast(`Couldn’t connect ${label}${q.get('msg') ? ': ' + q.get('msg') : ''}`, 'error', 7000)
        }, 400)
      })
      q.delete('adspend'); q.delete('provider'); q.delete('msg')
      history.replaceState(null, '', window.location.pathname + (q.toString() ? '?' + q.toString() : ''))
    } catch { }
  })()

// Keys that should survive localStorage.clear() (user-level UI preferences, not session data)
const PERSIST_KEYS = ['ms_tour_done', 'ms_ext_cta_dismissed'];
function clearLocalStorage() {
  const saved = {};
  PERSIST_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v !== null) saved[k] = v; } catch { } });
  localStorage.clear();
  Object.entries(saved).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch { } });
}

// Deliberate sign-out. Defined globally + wired via inline onclick on the Sign Out button
// so it works even if a later listener in setupActionListeners fails to attach. Belt-and-
// suspenders: explicitly drop the session keys, flag the extension bridge not to re-login,
// then bounce to the login page.
function executeActualSignOut() {
  try { sessionStorage.setItem('ms_logged_out', '1'); } catch { }
  try {
    const tk = localStorage.getItem('token');
    if (tk) fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${tk}` } }).catch(() => { });
  } catch { }
  try { ['token', 'refresh_token', 'user', 'ms_remember_until'].forEach(k => localStorage.removeItem(k)); } catch { }
  try { clearLocalStorage(); } catch { }
  window.location.replace('login.html');
}
window.executeActualSignOut = executeActualSignOut;

window.msSignOut = function msSignOut(skipClockCheck = false) {
  if (!skipClockCheck && typeof getTimeClockState === 'function') {
    const clockState = getTimeClockState();
    if (clockState && (clockState.status === 'in' || clockState.status === 'break')) {
      openSignOutClockModal();
      return;
    }
  }
  executeActualSignOut();
};

// "Keep me signed in" window: if it has lapsed, drop the stored session so the
// user is returned to login instead of riding a stale token.
(function enforceRememberWindow() {
  try {
    const until = Number(localStorage.getItem('ms_remember_until') || '0');
    if (!until || Date.now() <= until) {
      // Auto-extend session for 30 days so active users never face unexpected passkey or password prompts
      localStorage.setItem('ms_remember_until', String(Date.now() + 30 * 86400000));
    } else if (Date.now() > until) {
      clearLocalStorage();
    }
  } catch { }
})();

// Local Security Handshake Validations
let token = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');

// A dashboard that redirected to login can be restored from the browser back/forward
// cache with its old in-memory `token`, even though login has since stored a fresh
// session. Reloading only restored pages makes the script read the current session
// from storage instead of immediately treating that stale token as a logout.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) window.location.reload();
});

// Silently refresh the Supabase access token using the stored refresh token, so a
// "keep me signed in" session stays alive for its full window without the user
// re-authenticating. Runs on load and every 30 minutes.
// Returns true when it obtained a fresh access token, false otherwise. Single-flight so
// several 401s at once share one refresh call instead of stampeding /auth/refresh.
let __refreshInFlight = null;
async function refreshSessionSilently() {
  if (__refreshInFlight) return __refreshInFlight;
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return false;
  const until = Number(localStorage.getItem('ms_remember_until') || '0');
  if (until && Date.now() > until) return false; // window lapsed — bootstrap handles logout
  __refreshInFlight = (async () => {
    try {
      const r = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!r.ok) return false; // keep the current token; it may still be valid
      const d = await r.json();
      if (d.access_token) { token = d.access_token; localStorage.setItem('token', d.access_token); }
      if (d.refresh_token) localStorage.setItem('refresh_token', d.refresh_token);
      return !!d.access_token;
    } catch { return false; }
    finally { __refreshInFlight = null; }
  })();
  return __refreshInFlight;
}
if (token && localStorage.getItem('refresh_token')) {
  // Do not refresh immediately after a password/passkey login. The login response
  // already contains a fresh access token, and rotating its refresh token while
  // the dashboard is simultaneously booting `/auth/me` can make a successful
  // sign-in look like an expired session. A genuine expiry is still repaired by
  // the 401 retry above, and established sessions refresh on this interval.
  setInterval(refreshSessionSilently, 30 * 60 * 1000);
}

// True while we're waiting to see if the extension's single-sign-on bridge will
// inject a token. Blocks the dashboard init from running (and failing) in that window.
let __authPending = false;

if (!token) {
  // Don't bounce straight to login. The extension bridge (dashboard-bridge.js)
  // runs at document_idle and mirrors the extension's session into localStorage —
  // redirecting before it lands is exactly what caused the dashboard↔login flash
  // when a user is signed into the extension but not yet the site. Wait briefly for
  // the token to appear; reload cleanly if it does, only then fall back to login.
  __authPending = true;
  (async () => {
    for (let i = 0; i < 20; i++) {          // ~2s grace window
      await new Promise(r => setTimeout(r, 100));
      const t = localStorage.getItem('token');
      if (t) { token = t; location.reload(); return; }
    }
    clearLocalStorage();
    window.location.href = 'login.html';
  })();
}

const user = userRaw ? JSON.parse(userRaw) : {};
let profileContext = null;

// ── Owner workspace mode: vehicle-dealer DEMO ↔ running MarketSync ────────────
// Only the MarketSync owner sees the switch. MarketSync mode trims the nav to the
// SaaS pages, trims Settings, and repaints the UI purple (all via CSS driven by the
// html[data-dash-mode] attribute). Persisted per-browser.
let __dashMode = localStorage.getItem('ms_dash_mode') === 'marketsync' ? 'marketsync' : 'demo';
// The pages that remain in MarketSync mode (everything else is vehicle-only).
const MS_ALLOWED_PAGES = new Set(['command', 'saas-command', 'saas-customers', 'saas-followups', 'saas-funnel', 'saas-automation', 'saas-employees', 'insights', 'crm', 'tasks', 'appointments', 'leads', 'fni', 'reports', 'profile', 'accounting', 'commissions', 'affiliates-admin', 'owner-users']);

// ── Specialized dealership sub-roles ─────────────────────────────────────────
// Beyond DEALER_ADMIN / OWNER / MANAGER / SALES_REP, a store can give a login one
// of these narrow roles. Each sees ONLY its own workspace (plus CRM where noted):
//   FNI        → the complete Sales + CRM workspace (deals, appraisals, F&I, cleanup)
//   SERVICE    → the Service tabs + CRM
//   ACCOUNTING → the Accounting tabs + CRM
//   CLEANUP    → the Cleanup (recon) board only
// `groups` = the nav-group data-group ids they may see; `pages` = every data-page
// value reachable (used to hide stray items and to gate switchPage); `home` = the
// page they land on. Profile stays reachable for everyone (password, photo, etc.).
// `academy` is in EVERY role's page list, like `profile`: required training is required OF
// these roles in particular — F&I credit compliance, service authorization — so a specialized
// role that cannot reach its own required courses is the worst version of this gate.
const STAFF_ROLE_NAV = {
  FNI: { groups: ['crm', 'sales', 'acquisition'], pages: ['insights', 'crm', 'tasks', 'appointments', 'leads', 'appraisal', 'fni', 'recon', 'desk', 'taskboard', 'profile', 'academy'], home: 'crm' },
  SERVICE: { groups: ['crm', 'service', 'acquisition'], pages: ['crm', 'tasks', 'appointments', 'service-appointments', 'equity', 'service-settings', 'taskboard', 'profile', 'academy'], home: 'service-appointments' },
  ACCOUNTING: { groups: ['crm', 'accounting'], pages: ['crm', 'tasks', 'appointments', 'acct-insights', 'acct-reconciliation', 'acct-bank', 'commissions', 'acct-expenses', 'acct-budget', 'acct-tax', 'acct-reports', 'acct-settings', 'taskboard', 'profile', 'academy'], home: 'acct-insights' },
  CLEANUP: { groups: ['sales'], pages: ['recon', 'taskboard', 'profile', 'academy'], home: 'recon' },
};
const STAFF_ROLE_LABELS = { FNI: 'F&I', SERVICE: 'Service', ACCOUNTING: 'Accounting', CLEANUP: 'Cleanup' };
// Roles allowed to desk/appraise/work a deal from a CRM card (managers + F&I).
const SALES_ROLES = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'FNI'];
let __staffAllowedPages = null;   // Set of reachable data-page values, or null for full-access roles
let __staffHome = null;           // landing page for a staff role

// Restrict the sidebar to a specialized role's workspace. Runs once, late in init
// (after the generic role hides), so its reveal of an otherwise admin-only group
// (Service / Accounting) is the final word. Returns true if a staff role applied.
function applyStaffRoleNav(role) {
  window.applyStaffRoleNav = applyStaffRoleNav;
  const cfg = STAFF_ROLE_NAV[role];
  if (!cfg) return false;
  const allowGroups = new Set(cfg.groups);
  const allowPages = new Set(cfg.pages);
  __staffAllowedPages = allowPages;
  __staffHome = cfg.home;
  document.documentElement.setAttribute('data-staff-role', role.toLowerCase());
  // Show only the allowed nav groups (this un-hides Service/Accounting, which are
  // data-admin-nav and were hidden for this non-admin role a moment ago).
  document.querySelectorAll('#dashboard-nav .nav-group').forEach(g => {
    g.classList.toggle('hidden', !allowGroups.has(g.dataset.group));
  });
  // Any nav item (either bar) is visible only if its page is in the allow-set.
  document.querySelectorAll('#dashboard-nav .nav-item[data-page]').forEach(it => {
    it.classList.toggle('hidden', !allowPages.has(it.dataset.page));
  });
  // Open the groups so their items are visible without a click.
  cfg.groups.forEach(gid => document.getElementById('grp-' + gid)?.classList.remove('hidden'));
  document.getElementById('grp-accounting-wrap')?.classList.toggle('hidden', !allowGroups.has('accounting'));
  return true;
}

// ── Setup step forms ─────────────────────────────────────────────────────────
// The form definitions used by the Guided Setup Center below — one tiny form per
// config-backed step. Each has a `load` (prefill), `fields`, and `save`.
const SETUP_WIZARDS = {
  accounting: {
    title: 'Set up Accounting', icon: 'receipt',
    intro: "Tell us how you handle sales tax so deals post to the books correctly. About 30 seconds.",
    roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'ACCOUNTING'],
    load: async () => (await apiGetJson('/accounting/settings')).settings || {},
    isConfigured: async () => { try { const s = (await apiGetJson('/accounting/settings')).settings; return !!(s && (s.tax_number || (s.accounting_emails || []).length)); } catch { return false; } },
    fields: [
      { key: 'tax_label', label: 'What sales tax do you charge?', placeholder: 'GST/HST', hint: 'The label that prints on deals — e.g. GST, HST, PST, or Sales tax.' },
      { key: 'tax_number', label: 'Tax / business registration number', placeholder: '12345 6789 RT0001' },
      { key: 'tax_frequency', label: 'How often do you remit?', type: 'select', options: [['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['annual', 'Annual']] },
      { key: 'accounting_emails', label: 'Accounting email(s)', placeholder: 'books@yourdealer.com', hint: 'Where reconciliation alerts go. Separate several with commas.' },
    ],
    // Merge onto the current settings — the PUT rebuilds the whole object, so we
    // must send back the fields the wizard doesn't touch (tolerance, gm_emails…).
    save: async (v) => {
      let cur = {}; try { cur = (await apiGetJson('/accounting/settings')).settings || {}; } catch { }
      await apiSendJson('/accounting/settings', 'PUT', { ...cur, tax_label: v.tax_label, tax_number: v.tax_number, tax_frequency: v.tax_frequency, accounting_emails: v.accounting_emails });
      if (typeof loadAccountingPage === 'function') loadAccountingPage();
    },
  },
  service: {
    title: 'Set up Service', icon: 'wrench',
    intro: "Turn on online service booking and tell customers when you're open.",
    roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'SERVICE'],
    load: async () => (await apiGetJson('/service/config')).settings || {},
    isConfigured: async () => { try { const s = (await apiGetJson('/service/config')).settings; return !!(s && s.enabled); } catch { return false; } },
    fields: [
      { key: 'enabled', label: 'Online booking', type: 'checkbox', checkboxLabel: 'Let customers request service appointments from my website' },
      { key: 'hours', label: 'Service hours', placeholder: 'Mon–Fri 8–5, Sat 9–1' },
      { key: 'desk_email', label: 'Where booking requests go', placeholder: 'service@yourdealer.com' },
      { key: 'duration_min', label: 'Default appointment length (minutes)', type: 'number', placeholder: '60' },
    ],
    save: async (v) => { await apiSendJson('/service/config', 'PUT', { enabled: !!v.enabled, hours: v.hours, desk_email: v.desk_email, duration_min: v.duration_min }); if (typeof loadServiceSettings === 'function') loadServiceSettings(); },
  },
  website: {
    title: 'Set up your website', icon: 'globe',
    intro: 'Claim your web address, add a tagline, pick your brand colour, and go live. You can fine-tune everything later in the Website builder.',
    roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER'],
    load: async () => (await apiGetJson('/dealership/site')) || {},
    isConfigured: async () => { try { const s = await apiGetJson('/dealership/site'); return !!(s && (s.site_published || s.site_slug)); } catch { return false; } },
    fields: [
      { key: 'site_slug', label: 'Your web address', placeholder: 'your-dealership', hint: 'Becomes marketsync.site/your-dealership. Letters, numbers and dashes.' },
      { key: 'tagline', label: 'Tagline', placeholder: 'Quality used vehicles, no pressure.' },
      { key: 'primary_color', label: 'Brand colour', type: 'color' },
      { key: 'site_published', label: 'Go live', type: 'checkbox', checkboxLabel: 'Publish my site now' },
    ],
    // PUT merges (only sends the keys we set), so a partial save is safe.
    save: async (v) => { await apiSendJson('/dealership/site', 'PUT', { site_slug: v.site_slug, tagline: v.tagline, primary_color: v.primary_color, site_published: !!v.site_published }); if (typeof loadWebsiteSettings === 'function') { __wsTab = 'settings'; loadWebsitePage(); } },
  },
  inventory: {
    title: 'Connect your inventory', icon: 'car',
    intro: "Paste a link to your inventory — your website's used-cars page or an existing feed — and we'll pull every vehicle in automatically. This can take 10–30 seconds while we detect the platform.",
    roles: ['DEALER_ADMIN', 'OWNER', 'MANAGER'],
    isConfigured: async () => { try { const r = await fetch(`${API}/inventory-feeds`, { headers: { Authorization: `Bearer ${token}` } }); const feeds = r.ok ? await r.json() : []; return Array.isArray(feeds) && feeds.length > 0; } catch { return false; } },
    fields: [
      { key: 'feed_url', label: 'Inventory / feed URL', placeholder: 'https://yourdealership.com/inventory', hint: 'Your public inventory page works — no special feed needed. Leave blank to add it later.' },
    ],
    save: async (v) => {
      const url = (v.feed_url || '').trim();
      if (!url) return;   // nothing entered — just finish; they can add one on the Inventory page
      const r = await fetch(`${API}/inventory-feeds`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ feed_url: url, feed_type: 'auto' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not connect that link — you can try again on the Inventory page.');
      if (typeof loadInventoryFeeds === 'function') { loadInventoryFeeds(); loadInventoryCatalog?.(); }
    },
  },
};

// ── Guided Setup Center ──────────────────────────────────────────────────────
// One place that walks a dealer through every essential, step by step, until
// nothing's left. A progress bar lives in the sidebar and disappears the moment
// setup is complete. Each step (a) knows whether it's DONE from live config and
// (b) takes the user EXACTLY to where they finish it. Form steps re-open the
// Center on save so the user flows straight to the next step.
const MGR_SET = ['DEALER_ADMIN', 'OWNER', 'MANAGER'];
const __setupAckKey = (id) => `ms_setup_ack_${(profileContext?.dealership?.id || 'x')}_${id}`;
function setupAck(id) { try { return localStorage.getItem(__setupAckKey(id)) === '1'; } catch { return false; } }
function setSetupAck(id) { try { localStorage.setItem(__setupAckKey(id), '1'); } catch { } }

// One live snapshot feeds every step's done-check. Fetched once; refresh after a step.
let __setupSnap = null;
async function loadSetupSnapshot(force) {
  if (__setupSnap && !force) return __setupSnap;
  const jget = async (u) => { try { return await apiGetJson(u); } catch { return null; } };
  const feedsP = fetch(`${API}/inventory-feeds`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : []).catch(() => []);
  const [feeds, site, acct, svc, integ, cal] = await Promise.all([
    feedsP, jget('/dealership/site'), jget('/accounting/settings'), jget('/service/config'), jget('/integrations'), jget('/calendar/status'),
  ]);
  __setupSnap = {
    feeds: Array.isArray(feeds) ? feeds : [],
    site: site || {}, acct: acct?.settings || {}, svc: svc?.settings || {},
    twilio: ((integ && integ.providers) || []).find(p => p.provider === 'twilio') || null,
    cal: cal || { providers: [] },
  };
  return __setupSnap;
}

// The steps. Order = the order we walk people through.
const SETUP_STEPS = [
  { id: 'inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull every vehicle in from your website or a feed — automatically.', roles: MGR_SET, tour: 'inventory', done: s => s.feeds.length > 0, run: () => runSetupForm('inventory') },
  { id: 'website', icon: 'globe', label: 'Set up your website', desc: 'Claim your web address, add your look, and go live.', roles: MGR_SET, tour: 'website', done: s => !!(s.site.site_published || s.site.site_slug), run: () => runSetupForm('website') },
  { id: 'texting', icon: 'chat', label: 'Connect texting', desc: 'Text customers right from a lead (Twilio).', roles: MGR_SET, tour: 'texting', done: s => !!(s.twilio && isIntegrationConnected(s.twilio)), run: () => setupGoIntegration('twilio') },
  { id: 'calendar', icon: 'calendar', label: 'Connect your calendar', desc: 'Appointments sync to Google or Outlook — both ways.', roles: MGR_SET, tour: 'calendar', done: s => (s.cal.providers || []).some(p => p.connected), run: () => setupGoIntegration('calendar') },
  { id: 'accounting', icon: 'receipt', label: 'Set up sales tax', desc: 'So every deal posts to the books correctly.', roles: [...MGR_SET, 'ACCOUNTING'], tour: 'accounting', done: s => !!(s.acct.tax_number || (s.acct.accounting_emails || []).length), run: () => runSetupForm('accounting') },
  { id: 'service', icon: 'wrench', label: 'Turn on service booking', desc: 'Let customers book service from your website.', roles: [...MGR_SET, 'SERVICE'], tour: 'service', done: s => !!s.svc.enabled, run: () => runSetupForm('service') },
  { id: 'automation', icon: 'bolt', label: 'Turn on follow-ups', desc: 'Auto-text and email your leads on autopilot.', roles: MGR_SET, tour: 'automation', done: () => false, run: () => { setSetupAck('automation'); setupCloseAll(); switchPage('automation-builder'); showToast('Flip on a sequence to finish this step', 'info'); } },
];
// Product-specific onboarding. Each product sells a different job-to-be-done, so
// the startup wizard walks a different path. DealerOS (full) keeps the role-based
// SETUP_STEPS above; the MarketSync owner gets no dealer wizard at all.
const PRODUCT_SETUP_STEPS = {
  ai_chatbot: [
    { id: 'ai-personality', icon: 'sparkles', label: "Set your AI's voice", desc: 'Name your assistant and set its greeting and tone.', done: () => setupAck('ai-personality'), run: () => { setSetupAck('ai-personality'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-knowledge', icon: 'chat', label: 'Teach it about your store', desc: 'Hours, financing, specials — what it should know when it answers.', done: () => setupAck('ai-knowledge'), run: () => { setSetupAck('ai-knowledge'); setupCloseAll(); switchPage('ai-home'); } },
    { id: 'ai-install', icon: 'globe', label: 'Add the chat to your website', desc: 'Copy the snippet and paste it into your site — it goes live instantly.', done: () => setupAck('ai-install'), run: () => { setSetupAck('ai-install'); setupCloseAll(); switchPage('ai-home'); } },
  ],
  facebook_solo: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); __inventoryMode = 'manual'; switchPage('inventory'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); __inventoryMode = 'facebook'; switchPage('inventory'); } },
  ],
  facebook_dealer: [
    { id: 'fb-extension', icon: 'download', label: 'Install the Chrome extension', desc: 'It posts a full Marketplace listing in one click.', done: () => setupAck('fb-extension'), run: () => { setSetupAck('fb-extension'); setupCloseAll(); applyExtensionVisibility(); showToast('Use “Install extension” at the top right to add it', 'info'); } },
    { id: 'fb-inventory', icon: 'car', label: 'Add your inventory', desc: 'Pull your vehicles in from your website or a CSV.', done: s => (s.feeds || []).length > 0, run: () => { setupCloseAll(); __inventoryMode = 'manual'; switchPage('inventory'); } },
    { id: 'reps', icon: 'user', label: 'Add your sales reps', desc: 'Invite your team, see their insights, and set managers.', done: () => setupAck('reps'), run: () => { setSetupAck('reps'); setupCloseAll(); switchPage('sales-team'); } },
    { id: 'fb-post', icon: 'rocket', label: 'Post your first car', desc: 'Pick a vehicle and post it to Facebook Marketplace.', done: () => setupAck('fb-post'), run: () => { setSetupAck('fb-post'); setupCloseAll(); __inventoryMode = 'facebook'; switchPage('inventory'); } },
  ],
};
// Which onboarding path applies right now (product entitlement / workspace).
function currentProductKey() {
  if (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) return 'marketsync';
  const prod = document.documentElement.getAttribute('data-product') || '';
  if (/facebook_dealer/.test(prod)) return 'facebook_dealer';
  if (/facebook_solo/.test(prod)) return 'facebook_solo';
  if (/ai_chatbot/.test(prod)) return 'ai_chatbot';
  return 'dealer_os';
}
function setupStepsFor(role) {
  const p = currentProductKey();
  if (p === 'marketsync') return [];                          // owner SaaS — no dealer setup wizard
  if (PRODUCT_SETUP_STEPS[p]) return PRODUCT_SETUP_STEPS[p];  // AI / Facebook tiers
  if (typeof DEPARTMENTS_CONFIG === 'object' && DEPARTMENTS_CONFIG) {
    return Object.values(DEPARTMENTS_CONFIG).map(config => ({
      id: config.id,
      icon: config.badgeIcon || '',
      label: config.title,
      desc: config.badgeDesc || `Configure ${config.title}`,
      roles: MGR_SET,
      done: () => localStorage.getItem(`ms_dept_opened_${config.id}`) === '1',
      run: () => switchPage('launch')
    }));
  }
  return SETUP_STEPS.filter(s => s.roles.includes(role));     // full DealerOS fallback
}
function setupStepDone(step, snap) { return setupAck(step.id) || (typeof step.done === 'function' ? step.done(snap) : false); }
function setupCloseAll() { document.querySelectorAll('.fixed').forEach(el => { if (el.dataset.setup) el.remove(); }); }

// The compact progress bar at the top of the sidebar. Vanishes when all done.
// Retired: the "Open Setup" sidebar button and the Setup Wizard nudge it opened are
// gone for everyone (was already hidden for single-product accounts; now hidden for
// full DealerOS accounts too). The Launch Hub page (switchPage('launch')) still
// exists for anyone who navigates there directly.
async function renderSetupBar() {
  if (typeof refreshSetupIndicator === 'function') {
    await refreshSetupIndicator();
  }
  const host = document.getElementById('setup-bar-host');
  if (host) host.innerHTML = '';
}

// Compatibility entry point used by older buttons. All setup entry points now route
// to the canonical Launch Hub; no department wizard may appear over operational work.
function openSetupCenter() {
  switchPage('launch');
}
function setupRun(id) { const s = setupStepsFor(profileContext?.role).find(x => x.id === id); if (s) s.run(); }
// Close the Setup overlay and run that spot's short guided tour.
function setupTour(tourId) { setupCloseAll(); if (typeof startAreaTour === 'function') startAreaTour(tourId); }

// Refresh everything after a step and flow straight to the next one.
async function afterSetupStep() {
  try { await loadSetupSnapshot(true); } catch { }
  renderSetupBar();
  openSetupCenter();
}

// Form-based steps (inventory/website/accounting/service): a tiny form, then
// back to the Center to continue.
async function runSetupForm(id) {
  setupCloseAll();
  const w = SETUP_WIZARDS[id]; if (!w) return;
  let cur = {}; try { if (w.load) cur = (await w.load()) || {}; } catch { }
  const ic = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const fieldHtml = (f) => {
    const v = cur[f.key], fid = `wiz-${f.key}`;
    let input;
    if (f.type === 'checkbox') input = `<label class="flex items-center gap-2 text-sm ${ic}"><input id="${fid}" type="checkbox" class="accent-indigo-600" ${v ? 'checked' : ''}>${esc(f.checkboxLabel || 'Yes')}</label>`;
    else if (f.type === 'select') input = `<select id="${fid}" class="${ic}">${f.options.map(o => `<option value="${o[0]}" ${String(v) === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    else input = `<input id="${fid}" type="${f.type || 'text'}" value="${esc(Array.isArray(v) ? v.join(', ') : (v ?? ''))}" placeholder="${esc(f.placeholder || '')}" class="${ic}">`;
    return `<div><label class="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1">${esc(f.label)}</label>${input}${f.hint ? `<p class="text-[11px] text-slate-400 mt-1">${esc(f.hint)}</p>` : ''}</div>`;
  };
  crmOverlay(`<div class="p-5 space-y-4" data-setup-body>
    <div class="flex items-start gap-3">
      <button onclick="openSetupCenter()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 mt-0.5" title="Back to all steps"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
      <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">${svgIcon(w.icon || 'clipboard', 'w-5 h-5')}</div>
      <div class="min-w-0"><div class="text-lg font-black text-slate-900 dark:text-white">${esc(w.title)}</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">${esc(w.intro)}</p></div>
    </div>
    <div class="space-y-3">${w.fields.map(fieldHtml).join('')}</div>
    <div class="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
      <button onclick="openSetupCenter()" class="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-2">← All steps</button>
      <button onclick="setupTour('${id}')" class="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-2">${svgIcon('eye', 'w-3.5 h-3.5')}Show me around</button>
      <div class="flex-1"></div>
      <button onclick="setupSaveForm('${id}', this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save &amp; continue</button>
    </div>
  </div>`, 'max-w-lg').dataset.setup = '1';
}
async function setupSaveForm(id, btn) {
  const w = SETUP_WIZARDS[id]; const v = {};
  (w.fields || []).forEach(f => {
    const el = document.getElementById(`wiz-${f.key}`); if (!el) return;
    v[f.key] = f.type === 'checkbox' ? el.checked : (f.type === 'number' ? (parseInt(el.value) || undefined) : (el.value || '').trim());
  });
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await w.save(v); showToast('Saved ', 'success'); await afterSetupStep(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not save', 'error'); }
}
// Integration steps: land the user EXACTLY on the right card, pulsed.
function setupGoIntegration(which) {
  setupCloseAll();
  __focusIntegration = which;   // 'twilio' → Twilio card · 'calendar' → calendar sync card
  switchPage('profile');
  setTimeout(() => { if (typeof settingsTab === 'function') settingsTab('admin'); }, 200);
}
let __focusIntegration = null;
// After the Integrations tab renders, scroll to + flash the targeted card.
function focusIntegrationCard() {
  if (!__focusIntegration) return;
  const sel = __focusIntegration === 'calendar' ? '#calsync-card' : `[data-provider="${__focusIntegration}"]`;
  __focusIntegration = null;
  setTimeout(() => {
    const el = document.querySelector(sel); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('setup-flash');
    setTimeout(() => el.classList.remove('setup-flash'), 2600);
  }, 400);
}
Object.assign(window, { openSetupCenter, setupRun, setupSaveForm, setupTour, renderSetupBar });

// ── Facebook-only tier ───────────────────────────────────────────────────────
// A dealer who pays for Facebook posting alone sees only the Facebook posting hub
// (inventory in facebook mode) + the leaderboard. Driven by cfg.fb_only from
// /ai/config; the sidebar is stripped via html[data-dash-tier="fb"] CSS.
let __fbOnly = false;
// The leaderboard panel lives on the Dashboard (insights) — in fb tier the insights
// page is stripped by CSS to just the leaderboard, so 'insights' is the leaderboard.
const FB_ONLY_PAGES = new Set(['inventory', 'leaderboard', 'insights', 'profile']);
function applyFbOnlyMode() {
  if (__fbOnly) document.documentElement.setAttribute('data-dash-tier', 'fb');
  else document.documentElement.removeAttribute('data-dash-tier');
  applyMobileQuickRow();   // trim the mobile bottom bar to the fb page set
  if (!__fbOnly) return;
  // Land on the Leaderboard (the fb tier's home) — no separate dashboard.
  if (typeof switchPage === 'function') switchPage('leaderboard');
  // A legacy Facebook-only account may be identified only after its config finishes
  // loading. Repaint the score with Facebook-only rules once that happens.
  if (typeof loadLeaderboard === 'function') loadLeaderboard();
}
window.applyFbOnlyMode = applyFbOnlyMode;

// ── Product experience layer (entitlement-driven nav) ────────────────────────
// Same kernel + engines underneath; the sidebar + landing are generated from the
// dealership's products (from /auth/me). DealerOS (or no product set) = full nav.
// A non-OS product exposes only its department set — MarketSync feels simple at
// each price point, powerful as they upgrade. The union applies when a dealer holds
// several products (e.g. Facebook Dealer + AI Chatbot).
const PRODUCT_PAGES = {
  design_studio: ['profile'],
  facebook: ['leaderboard', 'inventory'],
  facebook_solo: ['leaderboard', 'inventory'],
  facebook_dealer: ['leaderboard', 'inventory'],
  video: ['video-studio', 'leaderboard'],
  marketsync_video: ['video-studio', 'leaderboard'],
  campaigns: ['marketing-overview', 'automation-builder', 'email-marketing', 'saas-automation'],
  social: ['marketing-overview'],
  marketsync_social: ['marketing-overview'],
  email_marketing: ['marketing-overview', 'automation-builder', 'email-marketing'],
  marketsync_email: ['marketing-overview', 'automation-builder', 'email-marketing'],
  ai_chatbot: ['ai-home'],
  website: ['website', 'blog', 'seo'],
  marketsync_website: ['website', 'blog', 'seo'],
  'sales-marketing-suite': ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'sales-automations', 'leads', 'marketing-analytics', 'email-sms', 'email-marketing'],
  sales_marketing_suite: ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'sales-automations', 'leads', 'marketing-analytics', 'email-sms', 'email-marketing'],
  'service-marketing-suite': ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'service-campaigns', 'service-automations', 'crm', 'marketing-analytics', 'email-sms', 'email-marketing'],
  service_marketing_suite: ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'service-campaigns', 'service-automations', 'crm', 'marketing-analytics', 'email-sms', 'email-marketing'],
  'complete-marketing-suite': ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'service-campaigns', 'sales-automations', 'service-automations', 'crm', 'marketing-analytics', 'email-sms', 'email-marketing', 'leads'],
  complete_marketing_suite: ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'service-campaigns', 'sales-automations', 'service-automations', 'crm', 'marketing-analytics', 'email-sms', 'email-marketing', 'leads'],
  'marketsync-digital': ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'service-campaigns', 'sales-automations', 'service-automations', 'crm', 'marketing-analytics', 'website', 'blog', 'seo', 'ai-home', 'email-sms', 'email-marketing', 'leads'],
  marketsync_digital: ['marketing-overview', 'automation-builder', 'video-studio', 'studio', 'sales-campaigns', 'service-campaigns', 'sales-automations', 'service-automations', 'crm', 'marketing-analytics', 'website', 'blog', 'seo', 'ai-home', 'email-sms', 'email-marketing', 'leads'],
  dealer_os: null,
};
const PRODUCT_HOME = {
  design_studio: 'profile',
  facebook: 'leaderboard',
  facebook_solo: 'leaderboard',
  facebook_dealer: 'leaderboard',
  video: 'video-studio',
  marketsync_video: 'video-studio',
  campaigns: 'marketing-overview',
  social: 'marketing-overview',
  marketsync_social: 'marketing-overview',
  email_marketing: 'marketing-overview',
  marketsync_email: 'marketing-overview',
  ai_chatbot: 'ai-home',
  website: 'website',
  marketsync_website: 'website',
  'sales-marketing-suite': 'marketing-overview',
  sales_marketing_suite: 'marketing-overview',
  'service-marketing-suite': 'marketing-overview',
  service_marketing_suite: 'marketing-overview',
  'complete-marketing-suite': 'marketing-overview',
  complete_marketing_suite: 'marketing-overview',
  'marketsync-digital': 'marketing-overview',
  marketsync_digital: 'marketing-overview',
};
const FB_PRODUCTS = new Set(['facebook_solo', 'facebook_dealer']);
let __productAllowedPages = null;   // Set of reachable pages under a restricted product, else null

// Marketing Suite workspace detector
function isMarketingSuite() {
  const product = document.documentElement.getAttribute('data-product') || '';
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  const activePackage = profileContext?.package_id || window.__demoActivePackage || window.__demoActiveProduct || '';
  if (activePackage === 'sales-marketing-suite' || activePackage === 'service-marketing-suite' || activePackage === 'complete-marketing-suite' || activePackage === 'marketsync-digital') {
    return true;
  }
  if (/(?:^|\s)(?:sales[-_]marketing[-_]suite|service[-_]marketing[-_]suite|complete[-_]marketing[-_]suite|marketsync[-_]digital)(?:\s|$)/.test(product)) {
    return true;
  }
  if (access.products && (access.products.includes('sales_marketing_suite') || access.products.includes('service_marketing_suite') || access.products.includes('complete_marketing_suite') || access.products.includes('marketsync_digital'))) {
    return true;
  }
  return false;
}
window.isMarketingSuite = isMarketingSuite;

// The standalone AI Chatbot plan deliberately has a smaller surface than DealerOS.
// It must never show the internal "Ask MarketSync" assistant controls — that is a
// separate employee tool, not something a chatbot-only customer bought.
function isAiChatbotOnlyWorkspace() {
  const products = document.documentElement.getAttribute('data-product') || '';
  return /(?:^|\s)ai_chatbot(?:\s|$)/.test(products) && !/(?:^|\s)dealer_os(?:\s|$)/.test(products);
}

// Design Studio standalone: the editor itself IS the product, not a tab inside a
// Marketing dashboard the customer never bought. Login lands straight in the
// full-screen studio modal; closing it reveals Settings (My Account), not a
// DealerOS department dashboard.
function isDesignStudioOnlyWorkspace() {
  const products = document.documentElement.getAttribute('data-product') || '';
  return /(?:^|\s)design_studio(?:\s|$)/.test(products) && !/(?:^|\s)dealer_os(?:\s|$)/.test(products);
}
window.isDesignStudioOnlyWorkspace = isDesignStudioOnlyWorkspace;

function isVideoOnlyWorkspace() {
  const products = document.documentElement.getAttribute('data-product') || '';
  return /(?:^|\s)marketsync_video(?:\s|$)/.test(products) && !/(?:^|\s)dealer_os(?:\s|$)/.test(products);
}
window.isVideoOnlyWorkspace = isVideoOnlyWorkspace;

// Facebook-only tiers (Solo or Dealer AutoPoster) bought Facebook posting, not the
// rest of DealerOS — the dealer-administration Settings tabs (HR, Marketing,
// Inventory, Service, Accounting, CRM/DMS, desking) don't apply to them. This is a
// PRODUCT check, not a role check: a facebook_dealer account's owner is a
// DEALER_ADMIN, so the role-based isSolo trim elsewhere never catches them and they
// were seeing the full DealerOS Administration tab.
function isFacebookOnlyWorkspace() {
  const products = document.documentElement.getAttribute('data-product') || '';
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  const isFb = (/(?:^|\s)facebook_solo(?:\s|$)/.test(products)
    || /(?:^|\s)facebook_dealer(?:\s|$)/.test(products)
    || /(?:^|\s)autoposter-salesperson(?:\s|$)/.test(products)
    || /(?:^|\s)autoposter-dealer(?:\s|$)/.test(products)
    || /(?:^|\s)facebook(?:\s|$)/.test(products)
    || (access.products && access.products.includes('facebook') && !access.products.includes('dealer_os')));
  return isFb && !/(?:^|\s)dealer_os(?:\s|$)/.test(products);
}
window.isFacebookOnlyWorkspace = isFacebookOnlyWorkspace;

// True for ANY account with exactly one product active (not a bundle, not full
// dealer_os) — Design Studio, Facebook Solo/Dealer, AI ChatBot, Video, Website,
// Social, Email alike. Every single-product dashboard shares the same simplified
// chrome rule: header collapses to Profile + Sign out, Open Setup never appears.
function isSingleProductWorkspace() {
  if (typeof resolveWorkspaceContext === 'function') {
    const ctx = resolveWorkspaceContext();
    if (ctx.type === 'website' || ctx.type === 'standalone' || ctx.type === 'marketing_suite') return true;
  }
  if (typeof isMarketingSuite === 'function' && isMarketingSuite()) return true;
  const products = (document.documentElement.getAttribute('data-product') || '').trim();
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  if (window.__demoActiveProduct && window.__demoActiveProduct !== 'dealer_os' && window.__demoActiveProduct !== 'dealer-os') return true;
  if (access.products && access.products.length === 1 && !access.products.includes('dealer_os')) return true;
  return !!products && products.split(/\s+/).length === 1 && !products.includes('dealer_os');
}
window.isSingleProductWorkspace = isSingleProductWorkspace;

function isStandaloneWebsiteWorkspace() {
  if (typeof resolveWorkspaceContext === 'function') {
    return resolveWorkspaceContext().type === 'website';
  }
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  if (access.products && access.products.includes('dealer_os')) return false;
  const products = (document.documentElement.getAttribute('data-product') || '').trim();
  if (products.includes('dealer_os')) return false;
  return (window.__demoActiveProduct === 'dealer-website' || window.__demoActiveProduct === 'website')
    || (access.products && access.products.length === 1 && (access.products.includes('marketsync_website') || access.products.includes('website')))
    || (/(?:^|\s)(?:marketsync_website|website)(?:\s|$)/.test(products) && !products.includes('dealer_os'));
}
window.isStandaloneWebsiteWorkspace = isStandaloneWebsiteWorkspace;
let __productHome = null;           // Where a product-restricted tier lands / bounces to
// applyProductNav() runs twice on every load: once at boot, then again once
// /ai/config resolves (loadAIBoostSection re-applies gating after learning
// __fbOnly — that fetch can cold-start-lag 30-60s on Render's free tier). Both
// calls compute the same home page and used to force-navigate every time,
// so if the user clicked into e.g. Inventory during that window, the second
// call silently yanked them back to the product's home page with no warning.
// Only the first call should ever auto-navigate.
let __productNavHomeApplied = false;

// ── Access-context helpers (frontend mirror of the backend access service) ────
// One place the UI asks "can I see/do this?", reading the derived summary from
// /access/context. These are UX gates only — every action is still enforced server-side
// (route guards + RLS). If the context is unavailable they fail OPEN to legacy behavior
// (return true), so an older backend or a failed fetch never hides a page the legacy
// gating would have shown.
window.hasProduct = function (productId) {
  const a = window.__access; if (!a || !Array.isArray(a.products)) return true;
  return a.isPlatformStaff || a.products.includes(productId);
};
window.hasFeature = function (featureId) {
  const a = window.__access; if (!a || !Array.isArray(a.features)) return true;
  return a.isPlatformStaff || a.features.includes(featureId);
};
window.canDo = function (permission) {
  const a = window.__access; if (!a || !Array.isArray(a.permissions)) return true;
  return a.permissions.includes('*') || a.permissions.includes(permission);
};

// Translate the normalized products (facebook / ai_dealer / dealer_os) from the access
// context into the legacy product-page keys applyProductNav already understands, so the
// mature nav logic is reused unchanged. Returns null when no context is present (caller
// falls back to the legacy /auth/me products object).
function legacyProductsFromAccess(access) {
  // Demo mode: the demo dealership is entitled to EVERY product (the showcase overlay in
  // access-policy.js), so access.products always includes dealer_os — which below would
  // force the full DealerOS sidebar and silently override the single product the operator
  // picked in the Demo Control Center. Honor the selected demo product for NAV so a
  // prospect sees just that product's dashboard, exactly as a real single-product
  // customer would. (dealer_os falls through to the normal full-nav path.)
  const demoProd = window.__demoActiveProduct;
  if (demoProd && demoProd !== 'dealer_os' && demoProd !== 'dealer-os') {
    const demoNav = {
      design_studio: { design_studio: true },
      facebook: { facebook_solo: true },
      video: { marketsync_video: true },
      campaigns: { marketsync_social: true },
      website: { marketsync_website: true },
      ai_chatbot: { ai_chatbot: true },
    }[demoProd];
    if (demoNav) return demoNav;
  }
  if (!access || !Array.isArray(access.products) || !access.products.length) return null;
  if (access.isPlatformStaff || access.products.includes('dealer_os')) return { dealer_os: true };
  const out = {};
  if (access.products.includes('facebook')) {
    // fb.sales_reps entitlement ⇒ the Dealership tier (rep management); else Solo.
    if ((access.features || []).includes('fb.sales_reps')) out.facebook_dealer = true;
    else out.facebook_solo = true;
  }
  if (access.products.includes('ai_dealer')) out.ai_chatbot = true;
  if (access.products.includes('design_studio')) out.design_studio = true;
  if (access.products.includes('marketsync_video')) out.marketsync_video = true;
  if (access.products.includes('marketsync_website')) out.marketsync_website = true;
  if (access.products.includes('marketsync_social')) out.marketsync_social = true;
  if (access.products.includes('marketsync_email')) out.marketsync_email = true;
  return Object.keys(out).length ? out : null;
}
window.legacyProductsFromAccess = legacyProductsFromAccess;

// ── Upgrade to unlock ────────────────────────────────────────────────────────
// Turns plan-tier gating into a path forward: a sidebar CTA + a modal listing the
// plans above the caller's current one, each starting Stripe Checkout. Reads the plan
// catalog from the backend (/billing/plans — the single source), so pricing/tiers never
// drift from the server.
let __planCatalogCache = null;
async function fetchPlanCatalog() {
  if (__planCatalogCache) return __planCatalogCache;
  try {
    const token = localStorage.getItem('token');
    const r = await fetch(`${API}/billing/plans`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    __planCatalogCache = await r.json();
    return __planCatalogCache;
  } catch { return null; }
}
async function startPlanCheckout(planId, btn) {
  const token = localStorage.getItem('token');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting checkout…'; }
  try {
    const r = await fetch(`${API}/billing/subscribe-plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: planId }),
    });
    const d = await r.json();
    if (r.ok && d.url) { window.location.href = d.url; return; }
    throw new Error(d.error || 'Could not start checkout.');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message || 'Checkout unavailable — billing may not be configured yet.', 'error');
    else alert(e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Upgrade'; }
  }
}
window.startPlanCheckout = startPlanCheckout;

// Every real product key a plan's `products` array can contain. Used by both the
// upgrade modal and the trial-expired paywall so a product never renders as a bare
// key or, worse, collapses onto some other product's name.
const MS_PRODUCT_LABELS = {
  dealer_os: 'Dealer OS', facebook: 'Facebook', ai_dealer: 'AI Dealer',
  design_studio: 'Design Studio', marketsync_video: 'Video', marketsync_website: 'Website',
  marketsync_social: 'Social', marketsync_email: 'Email & SMS', marketsync_seo: 'MarketSync SEO',
};
function msPlanProductLine(p) {
  return [...new Set(p.products)].map(x => MS_PRODUCT_LABELS[x] || x).join(' + ');
}
function msPlanCard(p, { included, money }) {
  return `
    <div class="border ${included ? 'border-emerald-400' : 'border-slate-200 dark:border-slate-700'} rounded-xl p-4 flex flex-col">
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-black text-slate-900 dark:text-white">${esc(p.label)}</span>
        <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">${money(p.monthly)}<span class="text-[10px] font-medium text-slate-400">/mo</span></span>
      </div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-1">${msPlanProductLine(p)} · ${p.feature_count} features${p.id === 'os_pro' || p.id === 'dealer-os-complete' ? ' · bundles everything' : ''}</div>
      ${included
      ? '<div class="mt-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 py-2">Included in your plan</div>'
      : `<button onclick="startPlanCheckout('${p.id}', this)" ${p.configured ? '' : 'disabled title="Pricing not configured yet"'} class="mt-3 ${p.configured ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'} text-white text-xs font-bold py-2 rounded-lg transition">${p.configured ? 'Upgrade' : 'Coming soon'}</button>`}
    </div>`;
}

async function openPlanUpgradeModal() {
  const data = await fetchPlanCatalog();
  if (!data || !Array.isArray(data.plans)) { if (typeof showToast === 'function') showToast('Could not load plans.', 'error'); return; }
  const current = data.current || [];
  // Grandfathered plans are never offered as a new purchase — only shown at all if
  // the account is actually still on one, so it can see what it currently has.
  const visible = data.plans.filter(p => !p.legacyPlan || current.includes(p.id));
  const currentPlans = visible.filter(p => current.includes(p.id));
  const currentMax = Math.max(0, ...currentPlans.map(p => p.monthly));
  const currentProducts = new Set(currentPlans.flatMap(p => p.products));
  const money = n => '$' + Number(n).toLocaleString();

  // Bundles (more than one product): offer only real upgrades — costs at least as
  // much as what the account already pays — falling back to the full list only if
  // nothing qualifies (e.g. already on the top bundle).
  const bundles = visible.filter(p => p.products.length > 1);
  const bundleOptions = bundles.filter(p => !current.includes(p.id) && p.monthly >= currentMax);
  const bundleCards = (bundleOptions.length ? bundleOptions : bundles)
    .map(p => msPlanCard(p, { included: current.includes(p.id), money })).join('');

  // Add-ons (exactly one product, sold standalone): always shown — greyed out
  // ("Included in your plan") the moment that product is already covered by any
  // currently-held plan, purchasable otherwise. No monthly-price filter here: an
  // add-on is often cheaper than a full bundle, which is exactly why it used to
  // vanish under the bundle-only "costs at least as much" filter.
  const addons = visible.filter(p => p.products.length === 1);
  const addonCards = addons
    .map(p => msPlanCard(p, { included: current.includes(p.id) || currentProducts.has(p.products[0]), money })).join('');

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[80] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl mt-12 p-6 shadow-2xl">
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-base font-black text-slate-900 dark:text-white">Upgrade your plan</h3>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Your plan decides what you can access. Upgrade to unlock more.</p>
    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Plans</div>
    <div class="grid sm:grid-cols-2 gap-3 mb-5">${bundleCards}</div>
    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Add-ons</div>
    <div class="grid sm:grid-cols-2 gap-3">${addonCards}</div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) modal.remove(); });
}
window.openPlanUpgradeModal = openPlanUpgradeModal;

// The trial-ended PAYWALL — a blocking popup (no dismiss) shown when the 30-day free
// trial has lapsed. Lists every package (Facebook-only, AI-only, Dealer OS tiers) so the
// user picks what they want and pays. Rendered over the shell on a 402 from the API.
let __paywallOpen = false;
async function openPaywallModal(reason) {
  if (__paywallOpen) return;
  __paywallOpen = true;
  const data = await fetchPlanCatalog();
  // Grandfathered plans are never offered to a new/re-subscribing customer — only
  // the current, real, publicly-sold catalog belongs on the paywall.
  const plans = ((data && data.plans) || []).filter(p => !p.legacyPlan);
  const money = n => '$' + Number(n).toLocaleString();
  const cards = plans.map(p => `
    <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col bg-white dark:bg-slate-900">
      <div class="flex items-baseline justify-between">
        <span class="text-sm font-black text-slate-900 dark:text-white">${esc(p.label)}</span>
        <span class="text-sm font-black text-indigo-600 dark:text-indigo-400">${money(p.monthly)}<span class="text-[10px] font-medium text-slate-400">/mo</span></span>
      </div>
      <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-1">${msPlanProductLine(p)} · ${p.feature_count} features${p.id === 'os_pro' || p.id === 'dealer-os-complete' ? ' · bundles everything' : ''}</div>
      <button onclick="startPlanCheckout('${p.id}', this)" ${p.configured ? '' : 'disabled title="Pricing not configured yet"'} class="mt-3 ${p.configured ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'} text-white text-xs font-bold py-2 rounded-lg transition">${p.configured ? 'Choose this plan' : 'Coming soon'}</button>
    </div>`).join('');
  const modal = document.createElement('div');
  modal.id = 'paywall-modal';
  modal.className = 'fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl mt-10 p-6 shadow-2xl">
    <div class="text-center mb-1"><span class="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white"><span class="w-1.5 h-6 bg-indigo-500 rounded-sm"></span>Market<span class="text-indigo-600 dark:text-indigo-400">Sync</span></span></div>
    <h3 class="text-lg font-black text-slate-900 dark:text-white text-center mt-3">Your free trial has ended</h3>
    <p class="text-sm text-slate-500 dark:text-slate-400 text-center mb-5">Choose the package that fits — Facebook only, AI Chatbot only, or the full Dealer OS. Pick what you want to keep going.</p>
    <div class="grid sm:grid-cols-2 gap-3">${cards || '<p class="text-sm text-slate-500 col-span-2 text-center py-6">Plans are being set up — please contact support.</p>'}</div>
    <div class="text-center mt-5"><button onclick="clearLocalStorage();window.location.href='login.html'" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Sign out</button></div>
  </div>`;
  document.body.appendChild(modal); // intentionally NOT dismissable — payment is required to continue
}
window.openPaywallModal = openPaywallModal;

// Sidebar "Upgrade plan" CTA — shown unless the account already holds the full bundle
// (all three products, i.e. Dealer OS Pro). Idempotent; safe to call after each nav render.
function renderUpgradeCta() {
  const navRoot = document.getElementById('nav-desktop');
  if (!navRoot) return;
  const a = window.__access;
  const onTopPlan = a && Array.isArray(a.products) && ['dealer_os', 'facebook', 'ai_dealer'].every(p => a.products.includes(p));
  let cta = document.getElementById('upgrade-cta');
  if (onTopPlan || a?.isPlatformStaff) { cta?.remove(); return; }
  if (!cta) {
    cta = document.createElement('button');
    cta.id = 'upgrade-cta';
    cta.type = 'button';
    cta.setAttribute('onclick', 'openPlanUpgradeModal()');
    cta.className = 'w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition shadow';
    cta.innerHTML = '<span aria-hidden="true">⭐</span><span>Upgrade plan</span>';
  }
  navRoot.appendChild(cta); // keep it pinned to the bottom after nav re-renders
}
window.renderUpgradeCta = renderUpgradeCta;

// Populate the Settings → Billing "Current plan" card from the account's active plan.
async function renderCurrentPlanBox() {
  const box = document.getElementById('current-plan-box');
  if (!box) return;
  const data = await fetchPlanCatalog();
  const cur = (data && data.current) || [];
  const plan = data && data.plans.find(p => cur.includes(p.id));
  if (!plan) { box.classList.add('hidden'); return; }
  const prod = msPlanProductLine(plan);
  const nm = document.getElementById('current-plan-name');
  const dt = document.getElementById('current-plan-detail');
  if (nm) nm.textContent = `${plan.label} · $${Number(plan.monthly).toLocaleString()}/mo`;
  if (dt) dt.textContent = `${prod} · ${plan.feature_count} features`;
  box.classList.remove('hidden');
}
window.renderCurrentPlanBox = renderCurrentPlanBox;

function applyProductNav(products) {
  products = products || {};
  // The "Post to Facebook" header button belongs to the dealer tiers (Facebook Dealer
  // and DealerOS Pro, which includes Facebook). It must not leak into Starter/Growth
  // merely because they are DealerOS accounts.
  const access = window.__access;
  const planFallback = typeof dealerPlanFallback === 'function' ? dealerPlanFallback() : null;
  const showFbPost = !!products.facebook_dealer
    || !!(access && (access.isPlatformStaff || (access.products || []).includes('facebook')))
    || !!planFallback?.products?.has('facebook');
  document.getElementById('fb-post-btn')?.classList.toggle('hidden', !showFbPost);
  // DealerOS (or nothing set) → the full department sidebar; clear any restriction.
  if (products.dealer_os) { __productAllowedPages = null; __productHome = null; document.documentElement.removeAttribute('data-product'); applyMobileQuickRow(); return; }
  const active = Object.keys(PRODUCT_PAGES).filter(k => products[k] && PRODUCT_PAGES[k]);
  if (!active.length) { __productAllowedPages = null; __productHome = null; applyMobileQuickRow(); return; }
  const allow = new Set(['profile']);
  active.forEach(k => (PRODUCT_PAGES[k] || []).forEach(p => allow.add(p)));
  __productAllowedPages = allow;
  document.documentElement.setAttribute('data-product', active.join(' '));
  // Facebook products render the Dashboard/Insights page as just the leaderboard (reuse
  // the existing fb-tier CSS). AI/other products don't.
  if (active.length && active.every(k => FB_PRODUCTS.has(k))) document.documentElement.setAttribute('data-dash-tier', 'fb');
  else document.documentElement.removeAttribute('data-dash-tier');
  if (typeof applyLeaderboardProductPresentation === 'function') applyLeaderboardProductPresentation();
  // Hide every nav item (desktop + mobile) whose page isn't in this product's set.
  document.querySelectorAll('#dashboard-nav .nav-item[data-page]').forEach(it => {
    if (!allow.has(it.dataset.page)) it.classList.add('hidden');
  });
  // Reveal nav buttons that ship hidden-by-default (so DealerOS never sees them) but
  // belong to this product's set.
  ['solo-home', 'ai-home'].forEach(pg => {
    document.querySelectorAll(`#dashboard-nav .nav-item[data-page="${pg}"]`).forEach(it => it.classList.toggle('hidden', !allow.has(pg)));
  });
  // Collapse any group left with no visible leaf.
  document.querySelectorAll('#nav-desktop .nav-group').forEach(g => {
    const anyVisible = [...g.querySelectorAll('.nav-group-body .nav-item[data-page]')].some(it => allow.has(it.dataset.page));
    g.classList.toggle('hidden', !anyVisible);
  });
  // Land on this product's home screen.
  const home = PRODUCT_HOME[active[0]] || [...allow][0] || 'profile';
  __productHome = home;
  applyMobileQuickRow();   // trim the mobile bottom bar to this tier's pages
  if (home) {
    if (home === 'inventory') __inventoryMode = 'facebook';
    if (typeof switchPage === 'function' && !__productNavHomeApplied) { __productNavHomeApplied = true; switchPage(home); }
  }
  // A single-product account (exactly one product, not a bundle) gets the whole
  // simplified chrome, every tier alike: the header collapses to Profile + Sign out
  // (clicking Profile opens Settings — that's the one and only settings entry point
  // now, so the separate gear icon, notification bell, and dealership social-icon
  // strip all go), and Open Setup never appears (that wizathese top headers go to the left nav for this dashrd walks through
  // DealerOS departments this account doesn't have). "Design Studio" style single-
  // page tiers get an even flatter sidebar — see restrictedNavPages().
  if (active.length === 1) {
    document.getElementById('header-settings')?.classList.add('hidden');
    document.getElementById('notif-bell')?.classList.remove('hidden');
    document.getElementById('header-social-icons')?.classList.add('hidden');
    document.getElementById('setup-bar-host')?.replaceChildren();
    // Independent single-tool programs never show the AI assistant or team/staff
    // chat — those coordinate a dealership's departments/staff, which a single-tool
    // subscriber doesn't have. Facebook Dealer is a real dealership team, so it keeps
    // team chat. This runs after the tier resolves, so it also catches the staff-chat
    // dock if it mounted before data-product was known.
    if (active[0] !== 'facebook_dealer') {
      document.getElementById('ai-dock-btn')?.classList.add('hidden');
      document.getElementById('ai-dock-panel')?.classList.add('hidden');
      document.getElementById('team-chat-dock-panel')?.classList.add('hidden');
      document.getElementById('staff-chat-dock-bar')?.classList.add('hidden');
      if (typeof window.disableStaffChatDock === 'function') window.disableStaffChatDock();
    }
  }
  // Design Studio standalone: launch straight into the editor, not the Settings page
  // it lands on underneath (that page exists only so closing the editor has somewhere
  // to go). Also drop chrome that only makes sense for an employee inside a
  // dealership — the shift punch clock, internal staff messaging, and the
  // "Intelligence" AI assistant dock — none of it applies to a single-user editor
  // account.
  if (active.length === 1 && active[0] === 'design_studio') {
    document.getElementById('header-shift-clock-wrapper')?.classList.add('hidden');
    document.getElementById('ai-dock-btn')?.classList.add('hidden');
    document.getElementById('staff-chat-dock-bar')?.classList.add('hidden');
    if (typeof window.openMarketSyncStudio === 'function') window.openMarketSyncStudio();
  }
}
window.applyProductNav = applyProductNav;

// Rebuild the mobile bottom quick-row from the SAME registry the desktop nav +
// "more" sheet use (restrictedNavPages), so a restricted tier never shows a
// dead/leaky Home/CRM/Stock button, and the order matches the tier (e.g. Facebook:
// Leaderboard · Inventory · Customers). Full-OS dealers keep the authored row.
// The Menu (#nav-more) is always kept reachable.
function applyMobileQuickRow() {
  const authored = document.querySelectorAll('#dashboard-nav > button.nav-item[data-page]');
  const more = document.getElementById('nav-more');
  // Build the bottom quick-row from the SAME registry the desktop nav + "All pages"
  // sheet use — nothing hardcoded — for both restricted tiers and full DealerOS.
  let pages = null;
  // The "Menu" overflow sheet only earns its place when the quick row can't fit
  // everything. A restricted tier's whole page set is small enough (≤4) to sit
  // directly in the row, so the sheet would just repeat those same buttons plus
  // Upgrade — already reachable from the header's own button — with nothing new.
  let showMoreBtn = true;
  const suite = (typeof getActiveMarketingSuite === 'function') ? getActiveMarketingSuite() : null;
  if (suite && typeof getMarketingSuiteConfig === 'function') {
    const cfg = getMarketingSuiteConfig(suite);
    if (cfg && cfg.mobileQuickRow) {
      pages = cfg.mobileQuickRow;
      showMoreBtn = true;
    }
  } else if (__fbOnly || __productAllowedPages) {
    // Restricted tiers (Facebook / product): that tier's exact page set.
    const restricted = (restrictedNavPages() || []).filter(p => p.page !== 'profile');
    pages = restricted.slice(0, 4);
    showMoreBtn = restricted.length > pages.length;
  } else if (__deptNavBuilt && __deptRegistry) {
    // Full DealerOS: ROLE-AWARE bottom row — a salesperson gets Pipeline/Customers/
    // Tasks, a technician gets Repair Orders/Schedule, a manager gets the store view.
    // This is not a shrunken sidebar: the destinations come from MS_ROLE_MOBILE_NAV,
    // resolved against the SAME workspace registry the desktop nav uses, and each
    // one still passes deptPageAllowed (role + entitlement + dealer flags) before it
    // renders — an entry the user can't reach is dropped, never shown dead.
    const wanted = typeof msMobileNavForRole === 'function'
      ? msMobileNavForRole(profileContext?.role) : null;
    if (wanted) {
      // Resolve each page to its registry tab so label/icon stay in one place.
      pages = wanted.map(pg => {
        for (const d of Object.values(__deptRegistry)) {
          const tab = (d.pages || []).find(p => p.page === pg);
          if (tab && deptRoleOk(d) && deptPageAllowed(tab)) {
            // A workspace's FIRST tab is its home, and those are all called
            // "Overview" — useless on a 4-icon bar (Executive and Sales would both
            // read "Overview"). Show the workspace name for a home tab, the tab name
            // for a deeper one: Executive · Sales · Inventory · Tasks.
            const isHome = d.pages[0] && d.pages[0].page === pg;
            return { page: tab.page, label: isHome ? d.label : tab.label, icon: d.icon, invmode: tab.invmode };
          }
        }
        return null;
      }).filter(Boolean).slice(0, 4);
    }
    // No role mapping (or nothing survived gating) → first visible workspaces' homes.
    if (!pages || !pages.length) {
      pages = Object.values(__deptRegistry).filter(d => deptVisible(d) && !d.system).slice(0, 4).map(d => {
        const home = d.pages.find(deptPageAllowed) || d.pages[0] || {};
        return { page: home.page, label: d.label, icon: d.icon, invmode: home.invmode };
      }).filter(p => p.page);
    }
  }
  if (!pages || !pages.length) {
    // No registry yet (legacy/solo tree) — drop any generated row, keep the authored one.
    document.getElementById('mobile-quickrow-dyn')?.remove();
    return;
  }
  // Hide the authored (hardcoded) quick buttons and render the registry-driven row.
  authored.forEach(b => b.classList.add('hidden'));
  let host = document.getElementById('mobile-quickrow-dyn');
  if (!host) {
    host = document.createElement('div');
    host.id = 'mobile-quickrow-dyn';
    host.className = 'contents md:hidden';   // display:contents → children join the flex row
    if (more && more.parentElement) more.parentElement.insertBefore(host, more);
  }
  host.innerHTML = pages.map(p => {
    const call = p.studioLaunch
      ? 'window.openMarketSyncStudio()'
      : `deptGo('${esc(p.page)}'${p.tab ? `,'${esc(p.invmode || '')}','${esc(p.tab)}'` : (p.invmode ? `,'${esc(p.invmode)}'` : '')})`;
    return `<button type="button" data-page="${esc(p.page)}"${p.tab ? ` data-tab="${esc(p.tab)}"` : ''} onclick="${call}" title="${esc(p.label)}" class="nav-item md:hidden flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-1 rounded font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><span class="opacity-70">${svgIcon(p.icon || 'dot', 'w-[18px] h-[18px]')}</span><span class="text-[9px] leading-none">${esc(p.label.split(' ')[0])}</span></button>`;
  }).join('');
  more?.classList.toggle('hidden', !showMoreBtn);
}
window.applyMobileQuickRow = applyMobileQuickRow;

// The page list for a restricted tier's mobile "more" sheet (with labels/icons), or
// null for the full-OS experience (which uses the department / legacy renderers).
function restrictedNavPages() {
  // Exact per-product / per-role nav (Settings lives on the header gear, never here):
  //   Facebook Solo ................. Inventory, Leaderboard
  //   Facebook Dealer — Rep ......... My Inventory, Leaderboard
  //   Facebook Dealer — Owner/Admin . Inventory, Leaderboard (Staff is in Settings)
  //   AI Dealer / AI Chatbot ........ AI Dealer (its page only)
  const product = document.documentElement.getAttribute('data-product') || '';
  const activeProducts = product.trim().split(/\s+/).filter(Boolean);
  const canManageTeam = ['DEALER_ADMIN', 'OWNER', 'MANAGER', 'DEALER_GROUP'].includes(profileContext?.role);
  const INV = (label) => ({ page: 'inventory', label, icon: 'megaphone', invmode: 'facebook' });
  const LEADER = { page: 'leaderboard', label: 'Leaderboard', icon: 'trophy' };
  const AI = { page: 'ai-home', label: 'AI Chatbot', icon: 'sparkles' };
  const META = {
    'marketing-overview': { page: 'automation-builder', tab: 'overview', label: 'Overview', icon: 'chart' },
    'email-marketing': { page: 'automation-builder', tab: 'overview', label: 'Overview', icon: 'chart' },
    'automation-builder': { page: 'automation-builder', tab: 'overview', label: 'Overview', icon: 'chart' },
    'video-studio': { page: 'video-studio', label: 'Video', icon: 'video' },
    website: { page: 'website', label: 'Website', icon: 'globe' },
  };

  const mktSuite = (typeof getActiveMarketingSuite === 'function') ? getActiveMarketingSuite() : null;
  if (mktSuite && typeof getMarketingSuiteConfig === 'function') {
    const cfg = getMarketingSuiteConfig(mktSuite);
    if (cfg && Array.isArray(cfg.sections)) {
      const items = [];
      const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
      const hasSeo = access.isPlatformStaff || !!(
        (access.products && (access.products.includes('marketsync_seo') || access.products.includes('seo')))
        || (access.features && access.features.includes('seo.manage'))
        || /(?:^|\s)(?:marketsync_seo|seo)(?:\s|$)/.test(document.documentElement.getAttribute('data-product') || '')
      );

      for (const section of cfg.sections) {
        for (const it of section.items) {
          if (it.requiresSeo && !hasSeo) continue;
          items.push({
            page: it.page,
            tab: it.tab,
            label: it.label,
            icon: it.icon,
            invmode: it.invmode,
            studioLaunch: it.studioLaunch,
            section: section.title
          });
        }
      }
      return items;
    }
  }

  if (activeProducts.length === 1 && /facebook_dealer/.test(product)) {
    return canManageTeam ? [INV('Inventory'), LEADER] : [INV('My Inventory'), LEADER];
  }
  if (activeProducts.length === 1 && /facebook_solo/.test(product)) return [INV('Inventory'), LEADER];
  if (activeProducts.length === 1 && /ai_chatbot/.test(product)) return [AI];
  if (activeProducts.length === 1 && /design_studio/.test(product)) {
    // The one and only sidebar entry — launches the editor. Settings is reached
    // through the header's Profile icon now (every single-product tier's rule), not
    // a second sidebar row, so this never needs to double as a "current page" link
    // and never needs to fight Settings for the highlighted state.
    return [{ page: 'studio', label: 'Design Studio', icon: 'camera', studioLaunch: true }];
  }
  if (activeProducts.length === 1 && /(marketsync_email|email_marketing|campaigns[-_]email[-_]sms|marketsync_social|marketing[-_]overview|marketing|campaigns|automations)/.test(product)) {
    const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
    const feats = access.features || [];
    const hasAuto = access.isPlatformStaff || feats.includes('email.automations') || feats.includes('os.automations') || !access.features;
    const items = [
      { page: 'marketing-overview', tab: 'overview', label: 'Overview', icon: 'chart' },
    ];
    if (hasAuto) {
      items.push({ page: 'marketing-overview', tab: 'automations', label: 'Automations', icon: 'bolt' });
    }
    items.push(
      { page: 'marketing-overview', tab: 'campaigns', label: 'Campaigns', icon: 'megaphone' },
      { page: 'marketing-overview', tab: 'templates', label: 'Templates', icon: 'document' },
      { page: 'marketing-overview', tab: 'audiences', label: 'Audiences', icon: 'users' },
      { page: 'marketing-overview', tab: 'performance', label: 'Performance', icon: 'sparkles' },
    );
    return items;
  }

  const isWebsiteProduct = (typeof isStandaloneWebsiteWorkspace === 'function' && isStandaloneWebsiteWorkspace())
    || (window.__demoActiveProduct === 'dealer-website');

  if (isWebsiteProduct) {
    const list = [
      // Builder is the full-screen site editor (the one intentional "full pager").
      // Blog and SEO open as normal in-dashboard pages (page content area + sidebar),
      // like the rest of MarketSync — not the full-screen workspace. Setup stays with
      // the Builder workspace (it configures that editor).
      { page: 'website', tab: 'builder', label: 'Builder', icon: 'globe' },
      { page: 'blog', label: 'Blog', icon: 'document' },
      { page: 'seo', label: 'SEO', icon: 'chart' },
      { page: 'website', tab: 'setup', label: 'Setup', icon: 'wrench' },
    ];
    const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
    const hasAi = !!(window.__aiBoostActive || (window.__siteCfg && window.__siteCfg.ai_boost_active)
      || (access.products && (access.products.includes('marketsync_ai') || access.products.includes('ai_boost') || access.products.includes('ai_chatbot') || access.products.includes('ai')))
      || /(?:^|\s)(?:marketsync_ai|ai_boost|ai_chatbot|ai)(?:\s|$)/.test(product));

    if (hasAi) {
      list.push({ page: 'ai-home', label: 'AI', icon: 'sparkles' });
    }
    return list;
  }

  // Fallback for any other restricted product set (keeps generic behavior).
  // 'sales-team' is deliberately absent — no restricted tier gets it as a nav
  // page any more, Staff management lives in Settings for all of them.
  if (__productAllowedPages) {
    const meta = { ...META, 'ai-home': AI, leaderboard: LEADER, inventory: INV('Inventory') };
    return ['marketing-overview', 'email-marketing', 'video-studio', 'website', 'ai-home', 'inventory', 'leaderboard']
      .filter(p => __productAllowedPages.has(p)).map(p => meta[p]);
  }
  // Legacy pure fb_only accounts with no product set: the same two Facebook items.
  if (__fbOnly) return [INV('Inventory'), LEADER];
  return null;
}
window.restrictedNavPages = restrictedNavPages;
// Facebook products get a simplified CRM (customers + leads only — no deal desk /
// accounting affordances inside CRM).
function simpleCrmActive() { return /facebook/.test(document.documentElement.getAttribute('data-product') || ''); }
window.simpleCrmActive = simpleCrmActive;
// In MarketSync mode the Reports hub shows only the SaaS-relevant reports (no
// vehicle inventory, F&I, appraisals or service — MarketSync sells software).
const MS_REPORT_KEYS = new Set(['leads', 'marketing', 'appointments', 'activity', 'customers', 'reps']);
function applyDashMode(mode) {
  __dashMode = mode === 'marketsync' ? 'marketsync' : 'demo';
  document.documentElement.setAttribute('data-dash-mode', __dashMode);
  document.querySelectorAll('#ms-mode-switch button').forEach(b => b.setAttribute('data-on', b.dataset.mode === __dashMode ? '1' : '0'));
  // In MarketSync mode "Sales" is a direct page (the F&I/subscriptions list), not a
  // collapsible group — point its header at the page and open it.
  const salesHead = document.getElementById('nav-sales-head');
  if (salesHead) {
    salesHead.onclick = __dashMode === 'marketsync'
      ? () => { if (typeof switchPage === 'function') switchPage('fni'); }
      : () => { if (typeof toggleNavGroup === 'function') toggleNavGroup('sales'); };
  }
  if (__dashMode === 'marketsync') { try { renderMarketsyncInsights(); } catch (e) { } }
}
function setDashMode(mode) {
  applyDashMode(mode);
  localStorage.setItem('ms_dash_mode', __dashMode);
  // Full reload so every page re-fetches under the new workspace header cleanly.
  if (__dashMode === 'demo') {
    if (typeof showToast === 'function') showToast('Loading demo workspace…', 'info');
    apiSendJson('/demo/seed', 'POST', {}).catch(() => { }).finally(() => location.reload());
  } else {
    location.reload();
  }
}
window.setDashMode = setDashMode;
async function demoReset() {
  if (!confirm('Reset the demo dealership back to its starting data? Your real MarketSync data is untouched.')) return;
  try { await apiSendJson('/demo/reset', 'POST', {}); showToast('Demo reset', 'success'); location.reload(); }
  catch (e) { showToast(e.message || 'Could not reset', 'error'); }
}
window.demoReset = demoReset;
// Walk a demo customer forward/back through the pipeline for a live demo.
const DEMO_STAGES = ['uncontacted', 'contacted', 'appointment', 'sold', 'fni', 'delivered'];
async function demoStepStage(id, dir, cur) {
  let i = DEMO_STAGES.indexOf(cur); if (i < 0) i = 0;
  i = Math.max(0, Math.min(DEMO_STAGES.length - 1, i + (dir === 'next' ? 1 : -1)));
  try { await apiSendJson(`/crm/contacts/${id}`, 'PUT', { status: DEMO_STAGES[i] }); if (typeof openCrmContact === 'function') openCrmContact(id); }
  catch (e) { showToast(e.message || 'Could not update', 'error'); }
}
window.demoStepStage = demoStepStage;

// MarketSync dashboard: leads (from the website + chatbot) + revenue potential across
// the five price points. Rendered into #ms-insights; only visible in MarketSync mode.
async function renderMarketsyncInsights() {
  const host = document.getElementById('ms-insights');
  if (!host || document.documentElement.getAttribute('data-dash-mode') !== 'marketsync') return;
  host.innerHTML = '<div class="py-16 text-center text-sm text-violet-400 italic">Loading MarketSync insights…</div>';
  let d;
  try { d = await apiGetJson('/marketsync/insights', { retries: 1 }); } catch (e) { host.innerHTML = `<div class="py-10 text-center text-sm text-rose-500">${esc(e.message || 'Could not load')}</div>`; return; }
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const open = d.open || 0, total = d.total || 0;
  const tile = (label, val, sub) => `<div class="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-white dark:bg-slate-900 p-4">
    <div class="text-2xl font-black text-violet-700 dark:text-violet-300">${val}</div>
    <div class="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">${label}</div>${sub ? `<div class="text-[11px] text-slate-400 mt-0.5">${sub}</div>` : ''}</div>`;
  const rows = (d.price_points || []).map(p => {
    const perCust = p.monthly, moPot = perCust * open, yr = moPot * 12;
    return `<tr class="border-b border-violet-100 dark:border-violet-950/60">
      <td class="py-2 pr-3 font-bold text-slate-800 dark:text-slate-100">${esc(p.label)}</td>
      <td class="py-2 px-3 text-right text-slate-600 dark:text-slate-300">${money(perCust)}/mo</td>
      <td class="py-2 px-3 text-right font-semibold text-violet-700 dark:text-violet-300">${money(moPot)}/mo</td>
      <td class="py-2 pl-3 text-right font-black text-violet-800 dark:text-violet-200">${money(yr)}/yr</td>
    </tr>`;
  }).join('');
  const srcRows = (d.by_source || []).map(s => `<div class="flex items-center justify-between text-sm py-1"><span class="text-slate-600 dark:text-slate-300">${esc(s.source)}</span><span class="font-bold text-slate-800 dark:text-slate-100">${s.count}</span></div>`).join('') || '<div class="text-sm text-slate-400 italic">No leads yet.</div>';
  host.innerHTML = `
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 class="text-2xl font-black text-slate-900 dark:text-white">MarketSync</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Leads from your website + chatbot, and what they're worth across the five price points.</p></div>
      <div class="flex items-center gap-2">
        <a href="/marketsync-guide.html" target="_blank" rel="noopener" class="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 border border-violet-200 dark:border-violet-900 rounded-lg px-3 py-2">Owner guide</a>
        <button onclick="marketsyncCleanup(this)" class="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 border border-violet-200 dark:border-violet-900 rounded-lg px-3 py-2">Remove sample leads</button>
      </div>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
      ${tile('Total leads', total)}
      ${tile('Open pipeline', open, 'not yet closed')}
      ${tile('Won', d.won || 0)}
      ${tile('New · 30 days', d.new_30d || 0)}
    </div>
    <div class="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-white dark:bg-slate-900 p-5 mt-4">
      <h2 class="text-lg font-black text-slate-900 dark:text-white">Revenue potential</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">If your <b>${open}</b> open lead${open === 1 ? '' : 's'} converted at each price point — per customer, monthly recurring, and annual run-rate.</p>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="text-[11px] uppercase tracking-wide text-slate-400 border-b border-violet-100 dark:border-violet-950/60">
          <th class="text-left py-1.5 pr-3">Price point</th><th class="text-right py-1.5 px-3">Per customer</th><th class="text-right py-1.5 px-3">Pipeline / mo</th><th class="text-right py-1.5 pl-3">Pipeline / yr</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="text-[11px] text-slate-400 mt-3">Monthly = per-customer price × open leads. Annual = monthly × 12.</p>
    </div>
    <div class="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-white dark:bg-slate-900 p-5 mt-4">
      <h2 class="text-base font-black text-slate-900 dark:text-white mb-2">Where leads come from</h2>
      ${srcRows}
    </div>`;
}
window.renderMarketsyncInsights = renderMarketsyncInsights;
async function marketsyncCleanup(btn) {
  if (!confirm('Remove the sample MarketSync leads (keeps Sean Agostino) and put his demo on the calendar?')) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Cleaning…';
  try {
    const d = await apiSendJson('/marketsync/cleanup', 'POST', {});
    showToast(`Removed ${d.removed || 0} sample lead(s)${d.sean_appointment ? " · Sean's demo added to the calendar" : ''}`, 'success');
    renderMarketsyncInsights();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Cleanup failed', 'error'); }
}
window.marketsyncCleanup = marketsyncCleanup;
// Reveal the switch + apply the saved mode once we know this is the MarketSync owner.
function initDashModeForOwner() {
  const isOwner = profileContext?.is_marketsync === true || ['JMS Automotive', 'MarketSync'].includes(profileContext?.dealership?.name);
  if (!isOwner) return;
  document.documentElement.setAttribute('data-dash-owner', '1');
  // Reveal the owner-only platform console (all accounts + billing/engine controls).
  document.getElementById('nav-owner-users')?.classList.remove('hidden');
  document.getElementById('nav-saas-command')?.classList.remove('hidden');   // SaaS Command Center
  document.getElementById('nav-saas-customers')?.classList.remove('hidden'); // Customer Pipeline
  document.getElementById('nav-saas-followups')?.classList.remove('hidden'); // Account follow-up queue
  document.getElementById('nav-saas-funnel')?.classList.remove('hidden');    // Checkout funnel / abandoned carts
  document.getElementById('nav-saas-automation')?.classList.remove('hidden');// Automation & email (editable drips)
  document.getElementById('nav-saas-employees')?.classList.remove('hidden'); // Employees + permissions
  // The demo dealership workspace has been retired — the owner runs the MarketSync
  // SaaS business only, so force the SaaS back office and land on the HQ.
  __dashMode = 'marketsync';
  localStorage.setItem('ms_dash_mode', 'marketsync');
  applyDashMode('marketsync');
  // Dealer-only Settings tabs don't apply to the SaaS owner (Team becomes SaaS
  // roles via renderSettingsSaasRoles). Hide the purely dealership ones.
  ['group', 'branding', 'aiboost', 'dealermgmt'].forEach(t =>
    document.querySelector(`#settings-tabs [data-stab="${t}"]`)?.classList.add('hidden'));
  if (typeof switchPage === 'function') switchPage('saas-command');
}
