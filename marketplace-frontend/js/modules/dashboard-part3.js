/* dashboard.js split part 3/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function openVinScanner(targetId, afterFill) {
  const target = document.getElementById(targetId);
  if (!navigator.mediaDevices?.getUserMedia) { showToast('This browser can’t open the camera — type the VIN instead.', 'error'); return; }
  if (!window.isSecureContext) { showToast('Camera scanning needs a secure (https) page — type the VIN instead.', 'error'); return; }

  const ov = document.createElement('div');
  ov.className = 'fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4';
  ov.innerHTML = `
    <div class="relative w-full max-w-md">
      <video autoplay playsinline muted class="w-full rounded-xl bg-black"></video>
      <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-24 border-2 border-emerald-400 rounded-lg pointer-events-none"></div>
    </div>
    <p class="text-white/80 text-sm mt-3 text-center">Point the camera at the VIN barcode<br><span class="text-white/50 text-xs">on the driver’s door jamb or lower windshield</span></p>
    <button id="vinscan-cancel" class="mt-4 bg-white/15 hover:bg-white/25 text-white text-sm font-bold px-5 py-2.5 rounded-lg">Cancel</button>`;
  document.body.appendChild(ov);
  const video = ov.querySelector('video');

  let stopped = false, cleanup = () => {};
  const stop = () => { if (stopped) return; stopped = true; try { cleanup(); } catch {} ov.remove(); };
  ov.querySelector('#vinscan-cancel').onclick = stop;
  ov.addEventListener('click', (e) => { if (e.target === ov) stop(); });
  const onVin = (vin) => {
    if (stopped) return;
    if (target) { target.value = vin; target.dispatchEvent(new Event('input', { bubbles: true })); }
    if (navigator.vibrate) navigator.vibrate(60);
    stop();
    showToast('VIN scanned: ' + vin, 'success');
    if (typeof afterFill === 'function') afterFill(vin);
  };

  // Fallback: ZXing — works on iPhone (Safari/Chrome), any browser without
  // BarcodeDetector, and is also what the native path below falls back to if it can't
  // find anything (see NATIVE_TIMEOUT_MS below).
  const startZXing = async () => {
    let ZX;
    try { ZX = await loadZXing(); }
    catch { stop(); showToast('Scanner couldn’t load — check your connection, or type the VIN.', 'error'); return; }
    if (stopped) return;
    try {
      const reader = new ZX.BrowserMultiFormatReader();
      cleanup = () => { try { reader.reset(); } catch {} };
      await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, video, (result) => {
        if (!result) return;
        const vin = cleanVin(result.getText());
        if (vin) onVin(vin);
      });
    } catch {
      stop();
      showToast('Camera access was blocked, or scanning isn’t available here — type the VIN.', 'error');
    }
  };

  // Fast path: native BarcodeDetector (Chromium desktop + Android Chrome). In
  // practice its 1D-barcode support (Code 39 / Code 128 — what a VIN door-jamb or
  // window-sticker barcode actually is) is inconsistent across devices: it can run
  // "successfully" — camera on, no error — while never actually detecting anything,
  // which read as "the camera opens and nothing happens." Give it a few seconds, then
  // fall back to ZXing (proven at reading 1D barcodes) instead of leaving the user
  // stuck with a live camera and no feedback.
  if ('BarcodeDetector' in window) {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }); }
    catch { stop(); showToast('Camera access was blocked — allow the camera, then try again.', 'error'); return; }
    cleanup = () => stream.getTracks().forEach(t => t.stop());
    video.srcObject = stream;
    let formats = ['code_39', 'code_128', 'data_matrix', 'pdf417', 'qr_code'];
    try { const sup = await BarcodeDetector.getSupportedFormats(); const f = formats.filter(x => sup.includes(x)); formats = f.length ? f : sup; } catch {}
    const detector = new BarcodeDetector({ formats });
    const NATIVE_TIMEOUT_MS = 4000;
    const startedAt = Date.now();
    let fellBack = false;
    const tick = async () => {
      if (stopped || fellBack) return;
      try {
        const codes = await detector.detect(video);
        for (const c of codes) { const vin = cleanVin(c.rawValue); if (vin) { onVin(vin); return; } }
      } catch {}
      if (stopped) return;
      if (Date.now() - startedAt > NATIVE_TIMEOUT_MS) {
        fellBack = true;
        try { cleanup(); } catch {}
        startZXing();
        return;
      }
      requestAnimationFrame(tick);
    };
    video.onloadedmetadata = () => requestAnimationFrame(tick);
    return;
  }

  startZXing();
}
window.loadZXing = loadZXing;
window.openVinScanner = openVinScanner;
// Small camera "Scan" button markup that drives openVinScanner for a given input.
function vinScanBtn(targetId, afterFillExpr = '') {
  return `<button type="button" title="Scan VIN barcode" onclick="openVinScanner('${targetId}'${afterFillExpr ? ', ' + afterFillExpr : ''})" class="flex items-center gap-1 text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2.5 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10"/></svg>Scan</button>`;
}

let __apprData = null;   // last appraisal result, for the PDF export
let __apprDealId = null; // id of the saved trade_appraisals record (for updates)
let __apprContactId = null; // CRM contact linked to this appraisal (via "Search customers")
let __apprDecodedSpecs = null; // engine/trans/drivetrain/body/fuel from the last VIN decode
let __apprSalesperson = null;  // salesperson name for the CURRENT deal (record's creator, or logged-in)
let __apprBranding = null;     // { logo_url, primary_color, ... } for PDF branding
let __apprDealerInfo = null;   // { city, province, postal_code, country } for PDF header
// License-plate → VIN on the appraisal. Regions come from the same US/CA tables the
// desk deal uses. On success it fills the VIN and triggers the normal decode.
function apprPlateFillRegions() {
  const country = document.getElementById('appr-plate-country')?.value || 'US';
  const sel = document.getElementById('appr-plate-region');
  if (!sel) return;
  const codes = country === 'CA'
    ? Object.keys((typeof DESK_TAX !== 'undefined' && DESK_TAX.CA?.regions) || {})
    : (typeof US_STATE_TAX !== 'undefined' ? US_STATE_TAX.map(([c]) => c) : []);
  sel.innerHTML = '<option value="">State</option>' + codes.map(c => `<option value="${c}">${c}</option>`).join('');
}
async function apprPlateLookup(btn) {
  const plate = (document.getElementById('appr-plate')?.value || '').trim().toUpperCase();
  const region = document.getElementById('appr-plate-region')?.value || '';
  const country = document.getElementById('appr-plate-country')?.value || 'US';
  const msg = document.getElementById('appr-plate-msg');
  const show = (t, err) => { if (msg) { msg.textContent = t; msg.className = 'text-xs mt-1.5 ' + (err ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'); msg.classList.remove('hidden'); } };
  if (!plate) { show('Enter a plate number', true); return; }
  if (!region) { show('Pick the state/province', true); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Looking up…';
  try {
    const d = await apiSendJson('/ai/plate-decode', 'POST', { plate, region, country });
    const vinInput = document.getElementById('appr-vin');
    if (vinInput && d.vin) vinInput.value = d.vin;
    show(`Found VIN ${d.vin} — decoding…`);
    document.getElementById('appr-decode')?.click();   // fill fields + comps via the existing decode
  } catch (e) {
    show(e.message || 'Could not look up that plate', true);
  }
  btn.disabled = false; btn.textContent = orig;
}
window.apprPlateFillRegions = apprPlateFillRegions;
window.apprPlateLookup = apprPlateLookup;

function initAppraisal() {
  apprPlateFillRegions();       // (re)populate the plate region dropdown each visit
  // Reveal the plate → VIN block only if a plate-decode provider is provisioned.
  apiGetJson('/ai/config', { retries: 1 }).then(cfg => {
    if (cfg?.plate_lookup_ready) document.getElementById('appr-plate-block')?.classList.remove('hidden');
    // Manager-set appraisal defaults (recon + target gross); fall back to 1200/2500.
    __apprDefaults = { recon: cfg?.appraisal_recon_default ?? 1200, gross: cfg?.appraisal_gross_default ?? 2500 };
    __apprCanEditDefaults = ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role);
    // Seed the fields now if they're still on the app defaults.
    const rc = document.getElementById('appr-recon'), gr = document.getElementById('appr-gross');
    if (rc && (rc.value === '' || rc.value === '1200')) rc.value = __apprDefaults.recon;
    if (gr && (gr.value === '' || gr.value === '2500')) gr.value = __apprDefaults.gross;
    renderApprDefaultsControl();
  }).catch(() => {});
  if (__apprWired) return;      // switchPage calls this each visit; wire once
  const $ = (id) => document.getElementById(id);
  const decodeBtn = $('appr-decode'), runBtn = $('appr-run'), result = $('appr-result');
  if (!decodeBtn || !runBtn) return;
  __apprWired = true;

  // Standalone VIN decoder — pops the same full specs & recall modal as Inventory.
  // "View full VIN decode" reads the appraisal's VIN field and opens the rich
  // specs + recall report (same modal Inventory uses).
  const runVinLookup = () => {
    const vin = ($('appr-vin')?.value || '').trim().toUpperCase();
    if (vin.length !== 17) { showToast('Decode or enter a 17-character VIN first', 'error'); return; }
    openVinDecode(null, vin);
  };
  $('appr-view-decode')?.addEventListener('click', runVinLookup);

  // Customer search — pull an existing CRM customer into the appraisal, or start new.
  const custSearch = $('appr-cust-search');
  if (custSearch) {
    let t = null;
    custSearch.addEventListener('input', () => {
      clearTimeout(t);
      const q = custSearch.value.trim();
      if (q.length < 2) {
        const box = $('appr-cust-results');
        if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
        return;
      }
      t = setTimeout(() => apprSearchCustomers(q), 220);
    });
    custSearch.addEventListener('focus', () => {
      const q = custSearch.value.trim();
      if (q.length >= 2) apprSearchCustomers(q);
      else {
        const box = $('appr-cust-results');
        if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
      }
    });
    document.addEventListener('click', (e) => {
      const box = $('appr-cust-results');
      if (box && !box.contains(e.target) && e.target !== custSearch) box.classList.add('hidden');
    });
  }

  // OEM factory docs (no AI) — decode for the build, then pull the factory PDF.
  const oemMsg = (t, err) => { const el = $('appr-oem-msg'); if (el) { el.textContent = t; el.className = 'text-xs ' + (err ? 'text-rose-500' : 'text-slate-400'); } };
  async function apprFetchOem(kind) {
    const vin = ((lookupInput?.value || $('appr-vin')?.value) || '').trim().toUpperCase();
    if (vin.length !== 17) { oemMsg('Enter a 17-character VIN first', true); return; }
    const btn = kind === 'sticker' ? $('appr-oem-sticker') : $('appr-oem-brochure');
    const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Fetching…';
    oemMsg('Looking up the factory ' + (kind === 'sticker' ? 'window sticker' : 'brochure') + '…');
    try {
      let make = ($('appr-make')?.value || '').trim(), model = ($('appr-model')?.value || '').trim(), year = ($('appr-year')?.value || '').trim();
      if (!make || (kind === 'brochure' && (!model || !year))) {
        const dr = await fetch(`${API}/ai/vin-decode`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vin }) });
        const dd = await dr.json().catch(() => ({}));
        if (dr.ok) { make = make || dd.make || ''; model = model || dd.model || ''; year = year || dd.year || ''; }
      }
      const path = kind === 'sticker' ? '/vin/oem-window-sticker' : '/vin/oem-brochure';
      const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vin, make, model, year }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { oemMsg(d.message || d.error || 'Not available', true); return; }
      oemMsg('Opened in a new tab.');
      window.open(d.url, '_blank');
    } catch { oemMsg('Lookup failed — try again', true); }
    finally { btn.disabled = false; btn.textContent = orig; }
  }
  $('appr-oem-sticker')?.addEventListener('click', () => apprFetchOem('sticker'));
  $('appr-oem-brochure')?.addEventListener('click', () => apprFetchOem('brochure'));

  decodeBtn.addEventListener('click', async () => {
    const vin = ($('appr-vin').value || '').trim().toUpperCase();
    if (vin.length !== 17) { showToast('Enter a 17-character VIN', 'error'); return; }
    const orig = decodeBtn.textContent;
    decodeBtn.disabled = true; decodeBtn.textContent = 'Decoding…';
    try {
      const r = await fetch(`${API}/ai/vin-decode`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Decode failed');
      if (d.year) $('appr-year').value = d.year;
      $('appr-make').value = d.make || '';
      $('appr-model').value = d.model || '';
      $('appr-trim').value = d.trim || '';
      // Stash the specs so the saved deal + disclosure PDF auto-fill.
      __apprDecodedSpecs = { body_type: d.body_type || null, engine: d.engine || null, transmission: d.transmission || null, drivetrain: d.drivetrain || null, fuel_type: d.fuel_type || null };
      // Prefill the comp filters so the appraisal matches like-for-like (same
      // drivetrain + engine), not every trim/engine of the model.
      if (d.engine && $('appr-engine')) $('appr-engine').value = d.engine;
      const dtSel = $('appr-drivetrain');
      if (dtSel && d.drivetrain) {
        const dt = d.drivetrain.toUpperCase();
        const canon = /AWD|ALL.?WHEEL|4MATIC|QUATTRO|XDRIVE/.test(dt) ? 'AWD'
          : /4WD|4X4|FOUR.?WHEEL/.test(dt) ? '4WD'
          : /FWD|FRONT|4X2|2WD/.test(dt) ? 'FWD'
          : /RWD|REAR/.test(dt) ? 'RWD' : '';
        if (canon) dtSel.value = canon;
      }
      const summary = [d.year, d.make, d.model, d.trim].filter(Boolean).join(' ');
      const sumEl = $('appr-vin-decoded-text'), wrap = $('appr-vin-decoded');
      if (sumEl && wrap) { sumEl.textContent = summary || 'vehicle identified'; wrap.classList.remove('hidden'); }
      showToast('VIN decoded — add mileage, then Appraise', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { decodeBtn.disabled = false; decodeBtn.textContent = orig; }
  });

  // Auto-decode the moment a full 17-char VIN is entered/scanned — the appraiser
  // shouldn't have to click Decode. Fires once per VIN.
  let __apprLastAutoVin = '';
  $('appr-vin')?.addEventListener('input', () => {
    const vin = ($('appr-vin').value || '').trim().toUpperCase();
    if (vin.length === 17 && vin !== __apprLastAutoVin) { __apprLastAutoVin = vin; decodeBtn.click(); }
  });

  runBtn.addEventListener('click', async () => {
    const num = (id) => ($(id).value || '').replace(/[^0-9.]/g, '');
    const body = {
      vin: ($('appr-vin').value || '').trim().toUpperCase() || null,
      year: ($('appr-year').value || '').trim(),
      make: ($('appr-make').value || '').trim(),
      model: ($('appr-model').value || '').trim(),
      trim: ($('appr-trim').value || '').trim(),
      mileage: num('appr-mileage'),
      condition: $('appr-condition').value,
      recon: num('appr-recon'),
      target_gross: num('appr-gross'),
      book_value: num('appr-book'),
      accident: $('appr-accident')?.value || 'none',
      damage: num('appr-damage'),
      // Like-for-like comp filters. Fall back to the decoded specs when the field
      // is blank (e.g. rep decoded a VIN but didn't touch the drivetrain select).
      drivetrain: ($('appr-drivetrain')?.value || '').trim() || (__apprDecodedSpecs?.drivetrain || ''),
      engine: ($('appr-engine')?.value || '').trim() || (__apprDecodedSpecs?.engine || ''),
      radius: $('appr-radius')?.value ?? '',
      appraisal_id: __apprDealId || undefined,   // update the same trade log on re-appraise
    };
    if (!body.year || !body.make || !body.model) { showToast('Year, make and model are required', 'error'); return; }
    const orig = runBtn.textContent;
    runBtn.disabled = true; runBtn.textContent = 'Appraising…';
    result.innerHTML = `<div class="py-10 text-center text-sm text-slate-400 italic">Pulling live market comps…</div>`;
    try {
      const r = await fetch(`${API}/ai/appraise`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Appraisal failed');
      result.innerHTML = renderAppraisal(d);
      if (typeof loadApprList === 'function') loadApprList();  // refresh Recent Trades
    } catch (e) {
      result.innerHTML = `<div class="py-8 text-center text-sm text-slate-500">Couldn't appraise: ${esc(e.message)}</div>`;
    } finally { runBtn.disabled = false; runBtn.textContent = orig; }
  });

  initApprDeal();
}

// ── Appraisal ⇄ CRM customer link ────────────────────────────────────────────
async function apprSearchCustomers(q) {
  const box = document.getElementById('appr-cust-results');
  if (!box) return;
  q = (q || '').trim();
  if (q.length < 2) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  try {
    const d = await apiGetJson(`/crm/contacts?q=${encodeURIComponent(q)}&limit=8`, { retries: 1 });
    const rows = d.contacts || [];
    if (!rows.length) {
      box.innerHTML = `<div class="px-3 py-2.5 text-xs text-slate-400 italic">No match — fill the fields below to add a new customer.</div>`;
    } else {
      box.innerHTML = rows.map(c => {
        const name = esc(c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Customer');
        const sub = [c.phone || c.phone_mobile, c.email].filter(Boolean).map(esc).join(' · ');
        return `<button type="button" onclick='apprPickCustomer(${JSON.stringify(c).replace(/'/g, "&#39;")})' class="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0">
          <div class="text-sm font-semibold text-slate-800 dark:text-slate-100">${name}</div>
          ${sub ? `<div class="text-xs text-slate-400">${sub}</div>` : ''}</button>`;
      }).join('');
    }
    box.classList.remove('hidden');
  } catch (e) { box.classList.add('hidden'); }
}
function apprPickCustomer(c) {
  if (!c || typeof c !== 'object') return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v != null ? v : ''); };
  const fullName = (c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name || '').trim();
  const nameParts = fullName.split(/\s+/);
  set('cust-first', c.first_name || nameParts[0] || '');
  set('cust-last', c.last_name || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''));
  set('cust-home-phone', c.phone_home || c.home_phone || '');
  set('cust-mobile-phone', c.phone_mobile || c.mobile_phone || c.phone || '');
  set('cust-email', c.email || '');
  set('cust-address', c.address || [c.street, c.address_line1, c.city, c.province].filter(Boolean).join(', ') || '');
  set('cust-postal', c.postal_code || c.zip || c.postal || '');

  // If customer has a trade vehicle on file, prefill appraisal vehicle inputs
  const tv = c.trade_vehicle || c.tradeVehicle || c.vehicle;
  if (tv && typeof tv === 'object') {
    if (tv.vin) set('appr-vin', tv.vin);
    if (tv.year) set('appr-year', tv.year);
    if (tv.make) set('appr-make', tv.make);
    if (tv.model) set('appr-model', tv.model);
    if (tv.trim) set('appr-trim', tv.trim);
    if (tv.mileage) set('appr-mileage', tv.mileage);
  }

  __apprContactId = c.id || null;
  const badge = document.getElementById('appr-cust-linked');
  if (badge) { badge.classList.remove('hidden'); badge.classList.add('inline-flex'); }
  const nm = document.getElementById('appr-cust-linked-name');
  if (nm) nm.textContent = fullName || 'Linked';
  const box = document.getElementById('appr-cust-results'); if (box) box.classList.add('hidden');
  const search = document.getElementById('appr-cust-search'); if (search) search.value = '';
  showToast('Customer linked to this appraisal', 'success');
}
function apprUnlinkCustomer() {
  __apprContactId = null;
  const badge = document.getElementById('appr-cust-linked');
  if (badge) { badge.classList.add('hidden'); badge.classList.remove('inline-flex'); }
}
// "New customer" — clear the linked contact + customer fields to start fresh.
function apprClearCustomer() {
  apprUnlinkCustomer();
  ['cust-first', 'cust-last', 'cust-home-phone', 'cust-mobile-phone', 'cust-email', 'cust-address', 'cust-postal']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const box = document.getElementById('appr-cust-results'); if (box) box.classList.add('hidden');
  const search = document.getElementById('appr-cust-search'); if (search) { search.value = ''; search.focus(); }
}
window.apprPickCustomer = apprPickCustomer;
window.apprUnlinkCustomer = apprUnlinkCustomer;
window.apprClearCustomer = apprClearCustomer;

function apprTile(label, value, sub) {
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${esc(label)}</div>
    <div class="text-lg font-black text-slate-900 dark:text-white mt-1 leading-tight">${value}</div>
    <div class="text-[11px] text-slate-400 mt-0.5">${esc(sub)}</div>
  </div>`;
}

// Wipe the appraisal + deal-details forms and all state so every trade starts
// fresh. Resetting __apprDealId is what makes the next Appraise create a NEW
// trade record instead of overwriting the last one.
function resetAppraisal() {
  const set = (id, v = '') => { const el = document.getElementById(id); if (el) el.value = v; };
  ['appr-vin', 'appr-year', 'appr-make', 'appr-model', 'appr-trim', 'appr-mileage', 'appr-engine', 'appr-damage',
   'cust-first', 'cust-last', 'cust-home-phone', 'cust-mobile-phone', 'cust-email', 'cust-postal', 'cust-address', 'disc-notes'
  ].forEach(id => set(id));
  set('appr-condition', 'good'); set('appr-drivetrain', ''); set('appr-radius', '250'); set('appr-accident', 'none');
  set('appr-recon', String(__apprDefaults?.recon ?? 1200)); set('appr-gross', String(__apprDefaults?.gross ?? 2500));
  document.getElementById('appr-vin-decoded')?.classList.add('hidden');
  set('appr-vin-decoded-text');
  const res = document.getElementById('appr-result'); if (res) res.innerHTML = '';
  const dmsg = document.getElementById('appr-deal-msg'); if (dmsg) dmsg.textContent = '';
  document.querySelectorAll('input[name="appr-disposition"]').forEach(r => { r.checked = r.value === 'retail'; });
  document.querySelectorAll('#appr-disclosure-qa select').forEach(s => { s.selectedIndex = 0; });
  document.querySelectorAll('#appr-features input[type=checkbox]').forEach(c => { c.checked = false; });
  // Wipe state → next appraisal is a brand-new record, attributed to the logged-in rep.
  __apprData = null; __apprDealId = null; __apprDecodedSpecs = null; __apprSalesperson = null;
  apprUnlinkCustomer();
  const csr = document.getElementById('appr-cust-results'); if (csr) csr.classList.add('hidden');
  const cs = document.getElementById('appr-cust-search'); if (cs) cs.value = '';
  document.getElementById('appr-vin')?.focus();
  if (typeof showToast === 'function') showToast('Cleared — ready for a new appraisal', 'info');
}

// vAuto-style live comparable listings — click any row to open the actual listing
// (dealer site / AutoTrader / CarGurus, wherever it's listed) and compare.
function apprCompsTable(comps, du, money, numFound) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const srcLabel = (c) => {
    const h = (host(c.url) || (c.source || '')).toLowerCase();
    if (h.includes('autotrader')) return 'AutoTrader';
    if (h.includes('cargurus')) return 'CarGurus';
    if (h.includes('cars.com')) return 'Cars.com';
    if (h.includes('kijiji')) return 'Kijiji';
    return host(c.url) || (c.source || 'Listing');
  };
  const rows = (comps || []).filter(c => c.price > 0).sort((a, b) => a.price - b.price).slice(0, 75);
  if (!rows.length) return '';
  const withLinks = rows.filter(c => c.url).length;
  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Comparable listings${numFound && numFound > rows.length ? ` · ${Number(numFound).toLocaleString()} in market` : ''}</div>
        <div class="text-[11px] text-slate-400">${withLinks} of ${rows.length} link to the live ad</div>
      </div>
      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm border-collapse min-w-[520px]">
          <thead><tr class="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <th class="text-left py-2 px-2">Price</th>
            <th class="text-right py-2 px-2">${du === 'mi' ? 'Miles' : 'KM'}</th>
            <th class="text-left py-2 px-2">Dealer / location</th>
            <th class="text-left py-2 px-2">Source</th>
            <th class="text-right py-2 px-2"></th>
          </tr></thead>
          <tbody>
            ${rows.map(c => {
              const loc = [c.dealer, [c.city, c.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
              const clickable = !!c.url;
              return `<tr class="border-b border-slate-100 dark:border-slate-800/60 ${clickable ? 'cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-950/30' : ''}" ${clickable ? `onclick="window.open('${encodeURI(c.url)}','_blank','noopener')"` : ''}>
                <td class="py-2.5 px-2 font-bold text-slate-900 dark:text-white tabular-nums">${money(c.price)}</td>
                <td class="py-2.5 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${c.miles ? Number(c.miles).toLocaleString() : '—'}</td>
                <td class="py-2.5 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[220px]">${esc(loc || '—')}</td>
                <td class="py-2.5 px-2 text-slate-500 dark:text-slate-400">${esc(srcLabel(c))}</td>
                <td class="py-2.5 px-2 text-right">${clickable ? '<span class="text-blue-600 dark:text-blue-400 font-bold text-xs whitespace-nowrap">View ↗</span>' : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${withLinks === 0 ? '<div class="text-[11px] text-slate-400 mt-2">Direct links aren\'t available for this vehicle\'s comps yet — they populate as fresh market data comes in.</div>' : ''}
    </div>`;
}

// Robust sold-date formatter. MarketCheck dates can arrive as Unix epoch SECONDS,
// which new Date() misreads as ms → "Jan 1970". Coerce seconds→ms and reject any
// pre-2000 / invalid value so we show a clean "—" instead of a bogus 1970.
function fmtSoldDate(s) {
  if (s == null || s === '') return '—';
  let d;
  if (typeof s === 'number' || /^\d+$/.test(String(s))) {
    let n = Number(s); if (n < 1e12) n *= 1000;
    d = new Date(n);
  } else { d = new Date(s); }
  return (isNaN(d.getTime()) || d.getFullYear() < 2000) ? '—' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// Recently-SOLD comps table — like apprCompsTable but with a days-on-market column
// and a sold date. These are proven transactions, the strongest evidence on the sheet.
function apprSoldTable(sold, du, money) {
  const rows = (sold || []).filter(c => c.price > 0).sort((a, b) => a.price - b.price).slice(0, 40);
  if (!rows.length) return '';
  return `
    <div class="mt-3 overflow-x-auto -mx-1">
      <table class="w-full text-sm border-collapse min-w-[520px]">
        <thead><tr class="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
          <th class="text-left py-2 px-2">Sold price</th>
          <th class="text-right py-2 px-2">${du === 'mi' ? 'Miles' : 'KM'}</th>
          <th class="text-right py-2 px-2">Days on mkt</th>
          <th class="text-left py-2 px-2">Location</th>
          <th class="text-right py-2 px-2">Sold</th>
        </tr></thead>
        <tbody>
          ${rows.map(c => {
            const loc = [c.dealer, [c.city, c.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
            const clickable = !!c.url;
            return `<tr class="border-b border-slate-100 dark:border-slate-800/60 ${clickable ? 'cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/20' : ''}" ${clickable ? `onclick="window.open('${encodeURI(c.url)}','_blank','noopener')"` : ''}>
              <td class="py-2 px-2 font-bold text-slate-900 dark:text-white tabular-nums">${money(c.price)}</td>
              <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${c.miles ? Number(c.miles).toLocaleString() : '—'}</td>
              <td class="py-2 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">${c.dom != null ? c.dom : '—'}</td>
              <td class="py-2 px-2 text-slate-600 dark:text-slate-300 truncate max-w-[200px]">${esc(loc || '—')}</td>
              <td class="py-2 px-2 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">${esc(fmtSoldDate(c.sold_date))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAppraisal(d) {
  __apprData = d;
  __apprDealId = d.appraisal_id || null;  // the auto-logged trade record (for Deal Details save + updates)
  __apprSalesperson = null; // new appraisal → attributed to the logged-in user
  const v = d.vehicle || {};
  const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle';
  const cur = d.currency || 'CAD';
  const du = d.distance_unit || 'km';
  const money = (n) => n != null ? '$' + Number(n).toLocaleString() : '—';

  if (!d.retail || !d.appraisal) {
    return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <div class="font-bold text-slate-900 dark:text-white">${esc(label)}</div>
      <div class="text-sm text-amber-600 dark:text-amber-400 mt-2">${esc(d.message || 'No market data found for this vehicle.')}</div>
    </div>`;
  }
  const rt = d.retail, ap = d.appraisal;
  // Only surface the retail→trade step when there's an actual discount (ratio < 100%).
  const hasTradeSpread = ap.trade_value != null && ap.retail_mid != null && ap.trade_value < ap.retail_mid - 1;
  return `
    <div class="space-y-4">
      <div class="bg-blue-600 text-white rounded-2xl p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-blue-100">Suggested trade / cash offer</div>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <div class="text-3xl font-black">${money(ap.suggested_offer)} <span class="text-base font-semibold text-blue-100">${cur}</span></div>
              ${hasTradeSpread ? `<span class="text-[11px] font-bold bg-white/20 rounded-full px-2.5 py-0.5">Wholesale ${money(ap.trade_value)}</span>` : ''}
              ${ap.book_value ? `<span class="text-[11px] font-bold bg-white/20 rounded-full px-2.5 py-0.5">Book ${money(ap.book_value)}</span>` : ''}
              ${ap.book_capped ? `<span class="text-[11px] font-bold bg-amber-400/95 text-amber-950 rounded-full px-2.5 py-0.5">Capped to book</span>` : ''}
            </div>
          </div>
          <button onclick="generateAppraisalPdf()" class="flex-shrink-0 flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            PDF
          </button>
        </div>
        <div class="text-xs text-blue-100 mt-2">${hasTradeSpread ? 'Wholesale ' + money(ap.trade_value) : 'Retail ' + money(ap.retail_mid)} − recon ${money(ap.recon)} − gross ${money(ap.target_gross)} = ACV / wholesale take-in</div>
      </div>
      ${ap.adjustments ? (() => {
        const adj = ap.adjustments;
        const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
        const rows = [];
        rows.push(['Comparable asking median', money(adj.comp_median), rt.count != null ? `${rt.count} comps` : '']);
        if (adj.mileage_adjustment) {
          const more = (adj.subject_mileage != null && adj.market_mileage != null) ? (adj.subject_mileage > adj.market_mileage) : (adj.mileage_adjustment < 0);
          const detail = (adj.subject_mileage != null && adj.market_mileage != null)
            ? `${Number(adj.subject_mileage).toLocaleString()} vs ${Math.round(adj.market_mileage).toLocaleString()} ${du} market`
            : '';
          rows.push([`Mileage adjustment (${more ? 'above' : 'below'} market)`, signed(adj.mileage_adjustment), detail, adj.mileage_adjustment < 0]);
        }
        if (adj.market_realism_amount) {
          rows.push([`Ask → sold (${adj.market_realism_pct}%)`, signed(adj.market_realism_amount), adj.market_realism_proven ? 'from real sold comps' : 'est. transaction gap', true]);
        }
        return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">How we got to retail value</div>
          <div class="space-y-2">
            ${rows.map(([lbl, val, sub, neg]) => `<div class="flex items-center justify-between gap-3 text-sm">
              <div class="min-w-0"><span class="text-slate-700 dark:text-slate-200">${esc(lbl)}</span>${sub ? `<span class="text-[11px] text-slate-400 ml-1.5">${esc(sub)}</span>` : ''}</div>
              <div class="font-bold tabular-nums flex-shrink-0 ${neg ? 'text-rose-500' : 'text-slate-900 dark:text-white'}">${val}</div>
            </div>`).join('')}
            <div class="flex items-center justify-between gap-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
              <div class="font-bold text-slate-900 dark:text-white">Adjusted retail value${adj.accident_amount ? ' (clean history)' : ''}</div>
              <div class="font-black tabular-nums text-slate-900 dark:text-white">${money(adj.retail_clean != null ? adj.retail_clean : adj.retail_value)}</div>
            </div>
            ${adj.accident_amount ? `<div class="flex items-center justify-between gap-3 text-sm">
              <div class="min-w-0"><span class="text-slate-700 dark:text-slate-200">Accident / history${adj.accident_tier ? ` (${esc(adj.accident_tier)})` : ''}${adj.accident_pct != null ? ` −${adj.accident_pct}%` : ''}</span><span class="text-[11px] text-slate-400 ml-1.5">history deduction</span></div>
              <div class="font-bold tabular-nums flex-shrink-0 text-rose-500">−${money(Math.abs(adj.accident_amount))}</div>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm">
              <div class="font-bold text-slate-900 dark:text-white">Retail (this vehicle)</div>
              <div class="font-black tabular-nums text-slate-900 dark:text-white">${money(adj.retail_value)}</div>
            </div>` : ''}
            ${hasTradeSpread ? `<div class="flex items-center justify-between gap-3 text-sm">
              <div class="min-w-0"><span class="text-slate-700 dark:text-slate-200">Retail → wholesale${adj.trade_ratio_pct != null ? ` (${adj.trade_ratio_pct}% of retail)` : ''}</span><span class="text-[11px] text-slate-400 ml-1.5">wholesale spread</span></div>
              <div class="font-bold tabular-nums flex-shrink-0 text-rose-500">−${money(adj.retail_value - adj.trade_value)}</div>
            </div>
            <div class="flex items-center justify-between gap-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
              <div class="font-bold text-slate-900 dark:text-white">Wholesale value (ACV) <span class="text-[11px] font-medium text-slate-400">(compare to AutoTrader)</span></div>
              <div class="font-black tabular-nums text-blue-600 dark:text-blue-400">${money(adj.trade_value)}</div>
            </div>` : ''}
            ${adj.recon ? `<div class="flex items-center justify-between gap-3 text-sm"><div class="text-slate-700 dark:text-slate-200">Reconditioning</div><div class="font-bold tabular-nums text-rose-500">−${money(Math.abs(adj.recon))}</div></div>` : ''}
            ${adj.target_gross ? `<div class="flex items-center justify-between gap-3 text-sm"><div class="text-slate-700 dark:text-slate-200">Target gross</div><div class="font-bold tabular-nums text-rose-500">−${money(Math.abs(adj.target_gross))}</div></div>` : ''}
            <div class="flex items-center justify-between gap-3 text-sm border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
              <div class="font-bold text-slate-900 dark:text-white">Suggested offer</div>
              <div class="font-black tabular-nums text-emerald-600 dark:text-emerald-400">${money(ap.suggested_offer)}</div>
            </div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">Adjusts the market's asking prices for this vehicle's odometer and the ask→sell gap to get retail value. Your ACV / wholesale take-in comes off retail (− recon − gross) and lines up with trade-value tools like AutoTrader.</div>
        </div>`;
      })() : ''}
      ${(() => {
        // Retail cross-check: show every independent read (asking comps, real sold
        // prices, MarketCheck's VIN model) as INPUTS that were reconciled into one
        // retail — instead of two contradicting headline numbers. Only render when we
        // actually have a second signal beyond the comps.
        const sig = ap.retail_signals || {};
        const cards = [];
        cards.push({ lbl: 'Asking comps', val: sig.comps, sub: `${rt.count ?? '—'} live listings` });
        if (sig.sold != null) cards.push({ lbl: 'Recently sold', val: sig.sold, sub: `${(d.sold && d.sold.count) || '—'} sold`, hot: true });
        if (sig.model != null) cards.push({ lbl: 'VIN model', val: sig.model, sub: (d.prediction && d.prediction.low && d.prediction.high) ? `${money(d.prediction.low)}–${money(d.prediction.high)}` : 'MarketCheck' });
        if (cards.length < 2) return '';
        return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Retail cross-check — reconciled from ${cards.length} independent reads</div>
          <div class="grid grid-cols-2 sm:grid-cols-${Math.min(4, cards.length + 1)} gap-2.5">
            ${cards.map(c => `<div class="rounded-xl border ${c.hot ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-700'} p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider ${c.hot ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${esc(c.lbl)}</div>
              <div class="text-lg font-black text-slate-900 dark:text-white tabular-nums">${money(c.val)}</div>
              <div class="text-[10px] text-slate-400">${esc(c.sub)}</div>
            </div>`).join('')}
            <div class="rounded-xl border-2 border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <div class="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Retail used</div>
              <div class="text-lg font-black text-blue-700 dark:text-blue-300 tabular-nums">${money(sig.reconciled != null ? sig.reconciled : rt.median)}</div>
              <div class="text-[10px] text-slate-400">weighted blend</div>
            </div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">We weight real sold prices highest, then the VIN model, then live asks (asking prices run above what cars sell for). One grounded retail — no guessing between numbers.</div>
        </div>`;
      })()}
      ${d.sold ? (() => {
        const s = d.sold;
        const PROV = { ON:'Ontario', QC:'Quebec', BC:'B.C.', AB:'Alberta', MB:'Manitoba', SK:'Saskatchewan', NS:'Nova Scotia', NB:'New Brunswick', NL:'Newfoundland', PE:'P.E.I.' };
        const scope = (s.matched_on && s.matched_on.geo)
          ? (s.radius_used ? `within ${s.radius_used} ${du}` : (s.geo_scope && s.geo_scope !== 'radius' ? (PROV[s.geo_scope] || s.geo_scope) : 'local'))
          : 'nationwide';
        return `<div class="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
          <div class="flex items-center gap-1.5 mb-2">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#059669" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <span class="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Proven to market — recently sold</span>
            <span class="text-[10px] font-medium text-slate-400">${s.count} sold · ${esc(scope)}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            ${apprTile('Sold median', money(s.median_price), s.low && s.high ? `${money(s.low)}–${money(s.high)}` : 'actual sale prices')}
            ${apprTile('Days on market', s.median_dom != null ? s.median_dom + ' days' : '—', 'before it sold')}
            ${apprTile('Ask vs sold', s.ask_vs_sold_pct != null ? '−' + s.ask_vs_sold_pct + '%' : '—', 'asks run high')}
            ${apprTile('Your offer vs sold', s.offer_vs_sold_pct != null ? s.offer_vs_sold_pct + '%' : '—', 'of sold price')}
          </div>
          <div class="text-[11px] text-slate-400 mt-2">These are comparable cars that actually left the market — the closest public proof of what this vehicle sells for, and how fast.</div>
          ${(s.listings && s.listings.length) ? apprSoldTable(s.listings, du, money) : ''}
        </div>`;
      })() : ''}
      ${ap.ai_summary ? `<div class="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl p-4">
        <div class="flex items-center gap-1.5 mb-1">
          <svg viewBox="0 0 24 24" width="14" height="14" class="flex-shrink-0" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
          <span class="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">AI Market Insight</span>
        </div>
        <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${esc(ap.ai_summary)}</p>
      </div>` : ''}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        ${apprTile('We sell for', money(rt.median), `retail · ${rt.count ?? '—'} comps`)}
        ${hasTradeSpread ? apprTile('Wholesale (ACV)', money(ap.trade_value), `${ap.trade_ratio}% of retail`) : apprTile('Retail range', `${money(rt.low)}–${money(rt.high)}`, 'fair retail')}
        ${apprTile('Avg days to sell', rt.avg_days_online != null ? rt.avg_days_online + ' days' : '—', 'on market')}
        ${apprTile('Target gross', money(ap.target_gross), ap.gross_pct != null ? ap.gross_pct + '% of retail' : 'your margin')}
      </div>
      ${(() => {
        const m = rt.matched_on || {};
        const chips = [];
        chips.push('Year ' + (v.year || '—'));
        if (m.trim && v.trim) chips.push('Trim ' + v.trim);
        if (m.drivetrain && v.drivetrain) chips.push(String(v.drivetrain).toUpperCase());
        if (m.engine && v.engine) chips.push(String(v.engine));
        const PROV = { ON:'Ontario', QC:'Quebec', BC:'B.C.', AB:'Alberta', MB:'Manitoba', SK:'Saskatchewan', NS:'Nova Scotia', NB:'New Brunswick', NL:'Newfoundland', PE:'P.E.I.' };
        if (m.geo && rt.radius_used) chips.push('Within ' + rt.radius_used + ' ' + du + (rt.median_distance != null ? ` · ~${Math.round(rt.median_distance)} ${du} avg` : ''));
        else if (m.geo && rt.geo_scope && rt.geo_scope !== 'radius') chips.push((PROV[rt.geo_scope] || rt.geo_scope) + ' only');
        else if (m.geo) chips.push('Local');
        else chips.push('Nationwide');
        return `<div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] font-semibold text-slate-400">Comps matched on:</span>
          ${chips.map(c => `<span class="text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full px-2 py-0.5">${esc(c)}</span>`).join('')}
        </div>`;
      })()}
      ${apprMarketplaceLinks(d, v)}
      ${apprCompsTable(d.comps, du, money, rt.num_found)}
      <div class="text-xs text-slate-400">${esc(label)}${v.mileage ? ` · ${Number(v.mileage).toLocaleString()} ${du}` : ''} · Source: ${esc(rt.source || 'MarketCheck')}. Retail-market based — not auction/wholesale values.</div>
    </div>`;
}

// vAuto-style "check the other marketplaces" jump-offs — dealers price the same car
// differently across sites, so give reps one click to the exact vehicle on AutoTrader
// and CarGurus near them. Uses each site's native search where reliable.
function apprMarketplaceLinks(d, v) {
  const slug = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const make = slug(v.make), model = slug(v.model);
  if (!make || !model) return '';
  const isUS = (d.distance_unit === 'mi');
  const postal = (d.dealer_postal || '').replace(/\s+/g, '');
  const yr = v.year || '';
  // AutoTrader native path search (CA + US both use /cars/{make}/{model}); scope to
  // year + the dealer's location when we have it.
  const atBase = isUS ? 'https://www.autotrader.com' : 'https://www.autotrader.ca';
  const at = isUS
    ? `${atBase}/cars-for-sale/all-cars/${make}/${model}?searchRadius=${d.search_radius || 300}${postal ? `&zip=${encodeURIComponent(postal)}` : ''}${yr ? `&startYear=${yr}&endYear=${yr}` : ''}`
    : `${atBase}/cars/${make}/${model}/?${postal ? `loc=${encodeURIComponent(postal)}&prx=${d.search_radius || 250}&` : ''}${yr ? `yRng=${yr}%2C${yr}&` : ''}sts=Used`;
  // CarGurus URLs are entity-ID based (not buildable), so use a site-scoped Google
  // search — always lands on real CarGurus listings for the vehicle.
  const q = encodeURIComponent(`${yr} ${v.make} ${v.model} ${v.trim || ''} for sale`.trim());
  const cg = `https://www.google.com/search?q=${q}+site:${isUS ? 'cargurus.com' : 'cargurus.ca'}`;
  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-[11px] font-semibold text-slate-400">Compare across sites:</span>
      <a href="${at}" target="_blank" rel="noopener" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">AutoTrader ↗</a>
      <a href="${cg}" target="_blank" rel="noopener" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition">CarGurus ↗</a>
    </div>`;
}

// ── Appraisal PDF (print-to-PDF window with charts) ──────────────────────────
function apprHistogramSvg(prices, marks, money) {
  if (!prices.length) return '';
  const W = 680, H = 210, padL = 44, padR = 20, padT = 24, padB = 40;
  const vals = prices.concat([marks.offer, marks.median, marks.sold].filter(x => x != null));
  const lo = Math.floor(Math.min(...vals) / 1000) * 1000;
  const hi = Math.ceil(Math.max(...vals) / 1000) * 1000 || lo + 1000;
  const bins = 8, bw = (hi - lo) / bins || 1;
  const counts = new Array(bins).fill(0);
  prices.forEach(p => { let i = Math.floor((p - lo) / bw); if (i < 0) i = 0; if (i >= bins) i = bins - 1; counts[i]++; });
  const maxC = Math.max(...counts, 1);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const xOf = (val) => padL + ((val - lo) / (hi - lo)) * plotW;
  let bars = '';
  for (let i = 0; i < bins; i++) {
    const bx = padL + (i / bins) * plotW + 3, bwid = plotW / bins - 6, bh = (counts[i] / maxC) * plotH;
    bars += `<rect x="${bx.toFixed(1)}" y="${(padT + plotH - bh).toFixed(1)}" width="${bwid.toFixed(1)}" height="${bh.toFixed(1)}" fill="#c7d2fe" rx="2"/>`;
  }
  const mark = (val, color, txt) => val == null ? '' :
    `<line x1="${xOf(val).toFixed(1)}" y1="${padT}" x2="${xOf(val).toFixed(1)}" y2="${padT + plotH}" stroke="${color}" stroke-width="2" stroke-dasharray="4 3"/>
     <text x="${xOf(val).toFixed(1)}" y="${padT - 8}" fill="${color}" font-size="10" font-weight="700" text-anchor="middle">${txt}</text>`;
  let xlab = '';
  for (let i = 0; i <= bins; i += 2) { const val = lo + i * bw; xlab += `<text x="${xOf(val).toFixed(1)}" y="${H - padB + 16}" fill="#64748b" font-size="9" text-anchor="middle">${money(Math.round(val))}</text>`; }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    ${bars}
    <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="#cbd5e1"/>
    ${mark(marks.median, '#4f46e5', 'We sell')}
    ${mark(marks.sold, '#b45309', 'Sold')}
    ${mark(marks.offer, '#16a34a', 'We buy')}
    ${xlab}
  </svg>`;
}
function apprLocationSvg(locations) {
  const top = (locations || []).slice(0, 8);
  if (!top.length) return '';
  const maxC = Math.max(...top.map(l => l.count), 1);
  const rowH = 24, W = 680, labelW = 70, numW = 40;
  let rows = '';
  top.forEach((l, i) => {
    const y = i * rowH, bwid = (W - labelW - numW) * (l.count / maxC);
    rows += `<text x="0" y="${y + 16}" font-size="11" fill="#0f172a" font-weight="600">${esc(l.region || 'Other')}</text>
      <rect x="${labelW}" y="${y + 5}" width="${Math.max(2, bwid).toFixed(1)}" height="14" fill="#818cf8" rx="3"/>
      <text x="${(labelW + Math.max(2, bwid) + 6).toFixed(1)}" y="${y + 16}" font-size="10" fill="#475569">${l.count}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${top.length * rowH}" style="width:100%;height:auto">${rows}</svg>`;
}
function generateAppraisalPdf() {
  const d = __apprData;
  if (!d || !d.retail || !d.appraisal) { showToast('Run an appraisal first', 'error'); return; }
  const v = d.vehicle || {}, rt = d.retail, ap = d.appraisal;
  const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') || 'Vehicle';
  const cur = d.currency || 'CAD', du = d.distance_unit || 'km';
  const money = (n) => n != null ? '$' + Number(n).toLocaleString() : '—';
  const prices = (d.comps || []).map(c => c.price).filter(p => p > 0);
  const sd = d.sold || null;
  const hist = apprHistogramSvg(prices, { median: rt.median, offer: ap.suggested_offer, sold: sd?.median_price ?? null }, money);
  const locs = apprLocationSvg(d.locations || []);
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const row = (l, val, strong) => `<tr><td style="padding:6px 0;color:#475569">${l}</td><td style="padding:6px 0;text-align:right;font-weight:${strong ? 800 : 600};color:${strong ? '#4f46e5' : '#0f172a'}">${val}</td></tr>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Appraisal — ${esc(label)}</title>
<style>
  @media print { .no-print{display:none!important} @page{margin:0.6in} }
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff;margin:0;padding:24px;max-width:760px;margin:0 auto}
  h1{font-size:22px;margin:0} h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:26px 0 8px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e2e8f0;padding-bottom:12px}
  .offer{background:#4f46e5;color:#fff;border-radius:12px;padding:18px 20px;margin-top:18px}
  .offer .n{font-size:32px;font-weight:900;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  .card{border:1px solid #e2e8f0;border-radius:10px;padding:14px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
  .stat .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700}
  .stat .v{font-size:18px;font-weight:800;margin-top:2px}
  .cap{font-size:11px;color:#94a3b8;margin-top:6px}
  .btn{padding:9px 18px;border-radius:8px;border:none;cursor:pointer;font-weight:700;font-size:13px;background:#4f46e5;color:#fff}
</style></head><body>
  <div class="no-print" style="display:flex;justify-content:flex-end;gap:10px;margin-bottom:14px">
    <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn" style="background:#e2e8f0;color:#0f172a" onclick="window.close()">Close</button>
  </div>
  <div class="head">
    <div><h1>${esc(d.dealer_name || 'Trade Appraisal')}</h1><div style="color:#64748b;font-size:13px;margin-top:2px">Vehicle Trade Appraisal</div></div>
    <div style="text-align:right;font-size:12px;color:#64748b">${today}</div>
  </div>

  <div style="font-size:17px;font-weight:800;margin-top:16px">${esc(label)}</div>
  <div style="color:#64748b;font-size:13px">${v.mileage ? Number(v.mileage).toLocaleString() + ' ' + du : ''}${v.vin ? ' · VIN ' + esc(v.vin) : ''}</div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px">
    <div class="offer" style="margin-top:0">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.8;font-weight:700">We buy it for (trade / cash offer)</div>
      <div class="n">${money(ap.suggested_offer)} <span style="font-size:15px;opacity:.8">${cur}</span></div>
      ${ap.pct_to_market != null ? `<div style="font-size:12px;opacity:.85;margin-top:4px">${ap.pct_to_market}% of retail market</div>` : ''}
    </div>
    <div class="offer" style="margin-top:0;background:#059669">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.85;font-weight:700">We sell it for (retail)</div>
      <div class="n">${money(rt.median)} <span style="font-size:15px;opacity:.8">${cur}</span></div>
      <div style="font-size:12px;opacity:.9;margin-top:4px">${money(rt.median - ap.suggested_offer)} spread before costs</div>
    </div>
  </div>

  ${ap.ai_summary ? `<div class="card" style="background:#f5f3ff;border-color:#ddd6fe">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6d28d9;font-weight:800;margin-bottom:4px">AI Market Insight</div>
    <div style="font-size:13px;color:#334155;line-height:1.5">${esc(ap.ai_summary)}</div>
  </div>` : ''}

  <h2>Price breakdown</h2>
  <div class="card"><table>
    ${(() => {
      const adj = ap.adjustments;
      if (!adj) return row('Retail market value (median of ' + (rt.count ?? '—') + ' comps)', money(ap.retail_mid));
      const signed = (n) => (n < 0 ? '−' : '+') + money(Math.abs(n));
      let out = row('Comparable asking median (' + (rt.count ?? '—') + ' comps)', money(adj.comp_median));
      if (adj.mileage_adjustment) {
        const detail = (adj.subject_mileage != null && adj.market_mileage != null)
          ? ' (' + Number(adj.subject_mileage).toLocaleString() + ' vs ' + Math.round(adj.market_mileage).toLocaleString() + ' ' + du + ')' : '';
        out += row('Mileage adjustment' + detail, signed(adj.mileage_adjustment));
      }
      if (adj.market_realism_amount) out += row('Ask → sold market adjustment (' + adj.market_realism_pct + '%)', signed(adj.market_realism_amount));
      out += '<tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:4px 0"></div></td></tr>';
      if (adj.accident_amount) {
        out += row('Adjusted retail value (clean history)', money(adj.retail_clean != null ? adj.retail_clean : ap.retail_mid), true);
        out += row('− Accident / history' + (adj.accident_tier ? ' (' + adj.accident_tier + (adj.accident_pct != null ? ', −' + adj.accident_pct + '%' : '') + ')' : ''), '−' + money(Math.abs(adj.accident_amount)));
        out += '<tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:4px 0"></div></td></tr>';
        out += row('Retail value (this vehicle)', money(ap.retail_mid), true);
      } else {
        out += row('Adjusted retail value', money(ap.retail_mid), true);
      }
      if (adj.trade_value != null && adj.trade_value < adj.retail_value - 1) {
        out += row('− Retail → wholesale spread' + (adj.trade_ratio_pct != null ? ' (wholesale = ' + adj.trade_ratio_pct + '% of retail)' : ''), '−' + money(adj.retail_value - adj.trade_value));
        out += '<tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:4px 0"></div></td></tr>';
        out += row('Wholesale value (ACV)', money(adj.trade_value), true);
      }
      return out;
    })()}
    ${row('− Reconditioning', '−' + money(ap.recon))}
    ${row('− Target gross', '−' + money(ap.target_gross))}
    <tr><td colspan="2"><div style="border-top:1px solid #e2e8f0;margin:4px 0"></div></td></tr>
    ${row('ACV / wholesale take-in', money(ap.suggested_offer), true)}
    ${ap.pct_to_market != null ? row('Take-in as % of retail market', ap.pct_to_market + '%') : ''}
  </table></div>

  <div class="grid">
    <div class="card stat"><div class="l">Retail range</div><div class="v">${money(rt.low)}–${money(rt.high)}</div></div>
    <div class="card stat"><div class="l">Avg days to sell</div><div class="v">${rt.avg_days_online != null ? rt.avg_days_online + ' days' : '—'}</div></div>
    <div class="card stat"><div class="l">Comparable listings</div><div class="v">${rt.count ?? '—'}</div></div>
  </div>

  ${sd ? `<h2>Proven to market — recently sold</h2>
  <div class="card" style="border-color:#a7f3d0;background:#f0fdf4">
    <div class="grid" style="margin-top:0">
      <div class="stat"><div class="l">Sold median</div><div class="v" style="color:#047857">${money(sd.median_price)}</div></div>
      <div class="stat"><div class="l">Days on market</div><div class="v">${sd.median_dom != null ? sd.median_dom + ' days' : '—'}</div></div>
      <div class="stat"><div class="l">Your offer vs sold</div><div class="v">${sd.offer_vs_sold_pct != null ? sd.offer_vs_sold_pct + '%' : '—'}</div></div>
    </div>
    <div class="cap">${sd.count} comparable vehicle${sd.count === 1 ? '' : 's'} that actually sold${sd.ask_vs_sold_pct != null ? ` — real sale prices ran ${sd.ask_vs_sold_pct}% below the asking median` : ''}. The closest public proof of what this ${esc(label)} sells for, and how fast.</div>
  </div>` : ''}

  ${hist ? `<h2>Market price distribution</h2><div class="card">${hist}<div class="cap">Live retail listings for this ${esc(label)}. Dashed lines mark what we sell it for (retail)${sd ? ', the recent sold median' : ''} and what we buy it at (offer).</div></div>` : ''}

  ${locs ? `<h2>Where these comparables are</h2><div class="card">${locs}<div class="cap">Locations of the comparable listings (by region), from ${rt.count ?? (d.comps || []).length} active listings.</div></div>` : ''}

  ${(() => {
    const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
    const rows = (d.comps || []).filter(c => c.price > 0).sort((a, b) => a.price - b.price).slice(0, 40);
    if (!rows.length) return '';
    return `<h2>Comparable listings — click to compare</h2><div class="card"><table>
      <tr style="color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.04em">
        <td style="padding:4px 0">Price</td><td style="padding:4px 0;text-align:right">${du === 'mi' ? 'Miles' : 'KM'}</td>
        <td style="padding:4px 0">Dealer / location</td><td style="padding:4px 0;text-align:right">Link</td></tr>
      ${rows.map(c => {
        const loc = [c.dealer, [c.city, c.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
        return `<tr style="border-top:1px solid #f1f5f9">
          <td style="padding:6px 0;font-weight:700">${money(c.price)}</td>
          <td style="padding:6px 0;text-align:right;color:#475569">${c.miles ? Number(c.miles).toLocaleString() : '—'}</td>
          <td style="padding:6px 0;color:#475569;font-size:12px">${esc(loc || '—')}</td>
          <td style="padding:6px 0;text-align:right">${c.url ? `<a href="${encodeURI(c.url)}" target="_blank" style="color:#4f46e5;font-weight:700;text-decoration:none">${esc(host(c.url) || 'View')} ↗</a>` : '<span style="color:#cbd5e1">—</span>'}</td>
        </tr>`;
      }).join('')}
    </table><div class="cap">Live comparable listings. Click a link to open the actual ad and compare.</div></div>`;
  })()}

  ${(() => {
    const rows = (sd?.listings || []).filter(c => c.price > 0).sort((a, b) => a.price - b.price).slice(0, 25);
    if (!rows.length) return '';
    return `<h2>Recently sold — proven transactions</h2><div class="card"><table>
      <tr style="color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.04em">
        <td style="padding:4px 0">Sold price</td><td style="padding:4px 0;text-align:right">${du === 'mi' ? 'Miles' : 'KM'}</td>
        <td style="padding:4px 0;text-align:right">Days on mkt</td><td style="padding:4px 0">Location</td><td style="padding:4px 0;text-align:right">Sold</td></tr>
      ${rows.map(c => {
        const loc = [c.dealer, [c.city, c.region].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
        return `<tr style="border-top:1px solid #f1f5f9">
          <td style="padding:6px 0;font-weight:700;color:#047857">${money(c.price)}</td>
          <td style="padding:6px 0;text-align:right;color:#475569">${c.miles ? Number(c.miles).toLocaleString() : '—'}</td>
          <td style="padding:6px 0;text-align:right;color:#475569">${c.dom != null ? c.dom : '—'}</td>
          <td style="padding:6px 0;color:#475569;font-size:12px">${esc(loc || '—')}</td>
          <td style="padding:6px 0;text-align:right;color:#64748b">${esc(fmtSoldDate(c.sold_date))}</td>
        </tr>`;
      }).join('')}
    </table><div class="cap">Comparable vehicles that recently left the market — real sale prices and how long each took to sell.</div></div>`;
  })()}

  <div style="margin-top:22px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px">
    Prepared ${today}. Values are retail-market estimates from live ${esc(rt.source || 'MarketCheck')} listings — not a guaranteed offer or an auction/wholesale value. Final offer subject to inspection.
  </div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to open the PDF view', 'error'); return; }
  w.document.write(html);
  w.document.close();
}

// Appointments open in a full-screen modal from the Pipeline page.
document.addEventListener('DOMContentLoaded', () => {
  const apptBtn = document.getElementById('open-appointments-btn');
  const panel = document.getElementById('appointments-panel');
  if (!apptBtn || !panel) return;
  const closeBtn = document.getElementById('close-appointments-btn');
  const openModal = () => { panel.classList.remove('hidden'); document.body.style.overflow = 'hidden'; loadAppointmentsPage(); };
  const closeModal = () => { panel.classList.add('hidden'); document.body.style.overflow = ''; };
  apptBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  // Click the dark backdrop (but not the panel itself) to close.
  panel.addEventListener('click', (e) => { if (e.target === panel) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.classList.contains('hidden')) closeModal(); });
});

// ══ Built-in CRM ═════════════════════════════════════════════════════════════
// Unified customer records + activity timeline + follow-up tasks. Every lead,
// appraisal and sale lands on one contact. One tool, one place.
let __crmSearchTimer = null;
const crmMoney = (n, cur) => n != null ? (cur === 'USD' ? 'US$' : '$') + Number(n).toLocaleString() : '—';
const crmWhen = (s) => {
  if (!s) return '';
  const d = new Date(s); if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 1 && d.getDate() === new Date().getDate()) return 'Today';
  if (diff < 2) return 'Yesterday';
  if (diff < 7) return Math.floor(diff) + 'd ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: diff > 300 ? 'numeric' : undefined });
};
const CRM_STATUS = { uncontacted: 'Uncontacted', contacted: 'Contacted', appointment: 'Appointment', sold: 'Sold', fni: 'F&I', turnover: 'Turn over', delivered: 'Delivered', followup: 'Follow up', lost: 'Lost' };
// Chip text: a sold-but-not-yet-delivered customer reads "Sold · Not delivered"
// (orange), and only shows plain "Delivered" (green) once the car is handed over.
const crmChipText = (s) => s === 'sold' ? 'Sold · Not delivered' : (CRM_STATUS[s] || s);
const crmStatusColor = (s) => ({
  uncontacted: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  contacted: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  appointment: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  sold: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  fni: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  turnover: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  followup: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  lost: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
}[s] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300');

// Lookup caches for the intake form (reps + our inventory for the "new car" picker).
let __crmReps = null, __crmInventory = null;
async function crmEnsureLookups() {
  if (!__crmReps) { try { __crmReps = (await apiGetJson('/crm/reps')).reps || []; } catch { __crmReps = []; } }
  if (!__crmInventory) {
    try { __crmInventory = (await apiGetJson('/inventory/all', { retries: 1 })).filter(v => String(v.status || 'available').toLowerCase() === 'available'); }
    catch { __crmInventory = []; }
  }
}