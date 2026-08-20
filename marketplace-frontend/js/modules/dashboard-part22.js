/* dashboard.js split part 22/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Sticker button → small popup letting the user pick the factory (OEM) window
// sticker or an AI-generated MarketSync dealer sticker. The Brochure button just
// generates a brochure directly (no popup).
function showStickerChoice(btn) {
  const id = btn.dataset.id;
  const label = btn.dataset.label || 'this vehicle';
  const oemUrl = btn.dataset.oemUrl || '';
  const genUrl = btn.dataset.genUrl || '';
  const savedTag = '<span class="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded">Saved</span>';
  document.getElementById('sticker-choice-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'sticker-choice-modal';
  modal.className = 'fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl">
      <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">Window Sticker</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate" title="${label}">${label} — OEM &amp; AI stickers save separately.</p>
      <div class="space-y-2.5">
        <button data-choice="oem" class="w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition">
          <div class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">${oemUrl ? 'View OEM Sticker' : 'Get OEM Sticker'} ${oemUrl ? savedTag : ''}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${oemUrl ? 'Open your saved factory window sticker.' : 'Pull the authentic factory window sticker for this VIN, when available.'}</div>
        </button>
        <button data-choice="generate" class="w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition ${__aiDocsActive ? '' : 'opacity-70'}">
          <div class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">${genUrl ? 'View Dealer Sticker' : 'Generate Dealer Sticker'} <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg> ${genUrl ? savedTag : (__aiDocsActive ? '' : '<span class="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 px-1.5 py-0.5 rounded">AI Boost</span>')}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${genUrl ? 'Open your saved branded sticker, or regenerate.' : 'Build a branded MarketSync window sticker.'}${(!genUrl && !__aiDocsActive) ? ' Included with AI Boost.' : ''}</div>
        </button>
        ${genUrl ? '<button data-choice="regen" class="w-full text-center text-xs font-bold text-indigo-500 hover:text-indigo-400 py-1 transition">↻ Regenerate dealer sticker</button>' : ''}
      </div>
      <button data-choice="cancel" class="mt-4 w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1.5 transition">Cancel</button>
    </div>`;
  const close = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target === modal) return close();
    const choice = e.target.closest('[data-choice]')?.dataset.choice;
    if (!choice) return;
    if ((choice === 'generate' || choice === 'regen') && !__aiDocsActive) { close(); openUpgradeModal('ai_boost'); return; }
    close();
    if (choice === 'oem') { if (oemUrl) window.open(oemUrl, '_blank'); else generatePdf(id, 'window-sticker', btn, { oemOnly: true }); }
    else if (choice === 'generate') { if (genUrl) window.open(genUrl, '_blank'); else generatePdf(id, 'window-sticker', btn, { forceGenerate: true }); }
    else if (choice === 'regen') generatePdf(id, 'window-sticker', btn, { forceGenerate: true });
  });
  document.body.appendChild(modal);
}

async function runVinPageDecode() {
  const vin = (document.getElementById('vin-page-input')?.value || '').trim().toUpperCase();
  if (!vin || vin.length < 11) {
    document.getElementById('vin-page-error').textContent = 'Enter a valid VIN (at least 11 characters).';
    document.getElementById('vin-page-error').classList.remove('hidden');
    return;
  }
  const token = localStorage.getItem('token');
  document.getElementById('vin-page-loading').classList.remove('hidden');
  document.getElementById('vin-page-results').classList.add('hidden');
  document.getElementById('vin-page-error').classList.add('hidden');
  try {
    const res = await fetch(`${API}/vin/decode/${encodeURIComponent(vin)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Decode failed');
    renderVinPageResults(data);
  } catch (e) {
    document.getElementById('vin-page-error').textContent = e.message;
    document.getElementById('vin-page-error').classList.remove('hidden');
  } finally {
    document.getElementById('vin-page-loading').classList.add('hidden');
  }
}

function renderVinPageResults({ decoded, recalls }) {
  const grid = document.getElementById('vin-page-grid');
  const vd = decoded.vin_data || {};
  const plantStr = [vd.plant_city, vd.plant_state, vd.plant_country].filter(Boolean).join(', ') || null;

  const coreFields = [
    ['Year',         decoded.year],
    ['Make',         decoded.make],
    ['Model',        decoded.model],
    ['Trim',         decoded.trim],
    ['Body Style',   decoded.body_style],
    ['Doors',        decoded.doors],
    ['Fuel Type',    decoded.fuel_type],
    ['Drivetrain',   decoded.drivetrain],
    ['Transmission', decoded.transmission],
    ['Engine',       decoded.engine],
  ].filter(([, v]) => v);

  const extFields = [
    ['Manufacturer',      vd.manufacturer],
    ['Vehicle Type',      vd.vehicle_type],
    ['Series',            vd.series],
    ['Built In',          plantStr],
    ['Plant',             vd.plant_company],
    ['Horsepower',        vd.horsepower ? vd.horsepower + ' HP' : null],
    ['Cylinders',         vd.cylinders],
    ['Displacement',      vd.displacement_l ? vd.displacement_l + 'L' : null],
    ['Displ. (cc)',       vd.displacement_cc ? vd.displacement_cc + 'cc' : null],
    ['Engine Config',     vd.engine_config],
    ['Valve Train',       vd.valve_train],
    ['Turbo',             vd.turbo],
    ['Engine Model',      vd.engine_model],
    ['Engine Mfr',        vd.engine_manufacturer],
    ['Fuel Injection',    vd.fuel_injection],
    ['Alt Fuel',          vd.fuel_type_secondary],
    ['Electrification',   vd.electrification],
    ['Trans Speeds',      vd.transmission_speeds],
    ['Wheel Base',        vd.wheel_base],
    ['Wheel Size (F)',    vd.wheel_size_front],
    ['Wheel Size (R)',    vd.wheel_size_rear],
    ['Wheels',            vd.wheels],
    ['Axles',             vd.axles],
    ['Windows',           vd.windows],
    ['Seat Rows',         vd.seat_rows],
    ['Seats',             vd.seats],
    ['GVWR',              vd.gvwr],
    ['Curb Weight',       vd.curb_weight_lb ? vd.curb_weight_lb + ' lbs' : null],
    ['Brakes',            vd.brake_system],
    ['Steering',          vd.steering_location],
    ['ABS',               vd.abs],
    ['ESC',               vd.esc],
    ['TPMS',              vd.tpms],
    ['Fwd Collision Warn',vd.forward_collision],
    ['Lane Departure',    vd.lane_departure],
    ['Lane Keep',         vd.lane_keep],
    ['Blind Spot Mon',    vd.blind_spot_mon],
    ['Adaptive Cruise',   vd.adaptive_cruise],
    ['Auto Emergency Brk',vd.auto_brake],
    ['Adaptive Hdlts',    vd.adaptive_headlights],
    ['Airbags (Front)',   vd.airbag_front],
    ['Airbags (Side)',    vd.airbag_side],
    ['Airbags (Curtain)', vd.airbag_curtain],
    ['Airbags (Knee)',    vd.airbag_knee],
    ['Keyless Ignition',  vd.keyless_ignition],
    ['SAE Auto Level',    vd.sae_automation],
  ].filter(([, v]) => v);

  const card = (label, value) => `
    <div class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
      <div class="text-xs text-slate-400 uppercase tracking-wide">${label}</div>
      <div class="text-sm font-bold text-slate-900 dark:text-white mt-0.5">${value}</div>
    </div>`;

  let html = coreFields.map(([l, v]) => card(l, v)).join('');
  if (extFields.length) {
    html += `<div class="col-span-2 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-widest">Extended Build Data (NHTSA)</div>`;
    html += extFields.map(([l, v]) => card(l, v)).join('');
  }
  grid.innerHTML = html;

  const recallEl = document.getElementById('vin-page-recalls');
  if (recalls?.length) {
    recallEl.innerHTML = `<div class="text-sm font-bold text-red-600 dark:text-red-400 mb-2"> ${recalls.length} Open Recall${recalls.length > 1 ? 's' : ''}</div>` +
      recalls.map(r => `<div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs mb-2">
        <div class="font-bold text-red-700 dark:text-red-400">${r.Component || ''}</div>
        <div class="text-slate-600 dark:text-slate-400 mt-1">${r.Summary || ''}</div>
      </div>`).join('');
    recallEl.classList.remove('hidden');
  } else {
    recallEl.innerHTML = `<div class="text-sm font-medium text-emerald-600 dark:text-emerald-400"> No open recalls found</div>`;
    recallEl.classList.remove('hidden');
  }
  document.getElementById('vin-page-results').classList.remove('hidden');
}

// The VIN decoder is part of the Inventory Intelligence tier — send the user there.
async function startVinStickerTrial() {
  switchPage('inv-intel');
}

// Handle return from Stripe Checkout for VIN Sticker
(async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('vin_sticker_session');
  if (!sessionId) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API}/billing/vin-sticker-verify?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      __vinStickerActive = true;
      history.replaceState({}, '', window.location.pathname);
      switchPage('vin-sticker');
    }
  } catch {}
})();

// Handle return from any integration OAuth consent screen (QuickBooks, Xero, Google).
(() => {
  const params = new URLSearchParams(window.location.search);
  const provider = params.get('integration');
  if (!provider) return;
  const status = params.get('status');
  const msg = params.get('msg');
  const LABELS = { quickbooks: 'QuickBooks', xero: 'Xero', google_business: 'Google Business', stripe_deposits: 'Online Deposits', square: 'Square' };
  const label = LABELS[provider] || 'Integration';
  history.replaceState({}, '', window.location.pathname);
  const openHub = () => { if (typeof switchPage === 'function') { switchPage('profile'); setTimeout(() => { if (typeof settingsTab === 'function') settingsTab('admin'); }, 250); } };
  const show = () => {
    if (typeof showToast !== 'function') { setTimeout(show, 400); return; }
    // Stripe Connect returns here after onboarding — re-check the account, then open the hub.
    if (provider === 'stripe_deposits') {
      const tk = localStorage.getItem('token');
      if (status === 'return' && tk) {
        fetch(`${API}/deposits/refresh`, { method: 'POST', headers: { 'Authorization': `Bearer ${tk}` } })
          .then(r => r.json()).then(d => showToast(d.charges_enabled ? 'Stripe connected — deposits are ready ' : 'Stripe onboarding saved — finish any remaining steps to go live.', d.charges_enabled ? 'success' : 'info')).catch(() => {});
      } else if (status === 'refresh') { showToast('Stripe onboarding was interrupted — click Connect to resume.', 'info'); }
      openHub(); return;
    }
    if (status === 'connected') showToast(`${label} connected `, 'success');
    else showToast(msg || `${label} connection failed`, 'error');
    openHub();
  };
  show();
})();

// Handle return from Stripe Checkout for Inventory Intelligence
(async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('inv_intel_session');
  if (!sessionId) return;
  const tk = localStorage.getItem('token');
  if (!tk) return;
  try {
    const res = await fetch(`${API}/billing/inv-intel-verify?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${tk}` }
    });
    if (res.ok) {
      __invIntelActive = true;
      history.replaceState({}, '', window.location.pathname);
      switchPage('inv-intel');
    }
  } catch {}
})();

// Handle return from Stripe Checkout for AI Vision
(async () => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('ai_vision_session');
  if (!sessionId) return;
  const tk = localStorage.getItem('token');
  if (!tk) return;
  try {
    const res = await fetch(`${API}/billing/ai-vision-verify?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${tk}` }
    });
    if (res.ok) {
      __aiVisionActive = true;
      renderAiVisionNav();
      history.replaceState({}, '', window.location.pathname);
      switchPage('ai-vision');
    }
  } catch {}
})();

// ── Profile page: Branding + Tone ──────────────────────────────────────────

let _profBrandingLoaded = false;

function _syncProfBrandSwatch() {
  const p = document.getElementById('prof-brand-primary-hex')?.value || '#1a2e4a';
  const a = document.getElementById('prof-brand-accent-hex')?.value || '#c8a84b';
  document.getElementById('prof-brand-swatch-header')?.style.setProperty('background', p);
  document.getElementById('prof-brand-swatch-accent')?.style.setProperty('background', a);
}

async function loadProfileBranding() {
  // Wire up colour pickers once
  if (!_profBrandingLoaded) {
    _profBrandingLoaded = true;

    const primaryPicker = document.getElementById('prof-brand-primary-color');
    const primaryHex    = document.getElementById('prof-brand-primary-hex');
    const accentPicker  = document.getElementById('prof-brand-accent-color');
    const accentHex     = document.getElementById('prof-brand-accent-hex');

    primaryPicker?.addEventListener('input', () => { if (primaryHex) primaryHex.value = primaryPicker.value; _syncProfBrandSwatch(); });
    primaryHex?.addEventListener('input',   () => { if (/^#[0-9a-fA-F]{6}$/.test(primaryHex.value)) { if (primaryPicker) primaryPicker.value = primaryHex.value; _syncProfBrandSwatch(); } });
    accentPicker?.addEventListener('input', () => { if (accentHex) accentHex.value = accentPicker.value; _syncProfBrandSwatch(); });
    accentHex?.addEventListener('input',   () => { if (/^#[0-9a-fA-F]{6}$/.test(accentHex.value)) { if (accentPicker) accentPicker.value = accentHex.value; _syncProfBrandSwatch(); } });

    document.getElementById('prof-brand-logo-input')?.addEventListener('change', uploadProfileLogo);
    document.getElementById('prof-brand-save-btn')?.addEventListener('click', saveProfileBranding);
  }

  const t = localStorage.getItem('token');
  if (!t) return;

  try {
    // Load branding
    const res = await fetch(`${API}/branding`, { headers: { 'Authorization': `Bearer ${t}` } });
    if (res.ok) {
      const data = await res.json();
      const b = data.branding || {};
      if (b.primary_color) {
        document.getElementById('prof-brand-primary-color').value = b.primary_color;
        document.getElementById('prof-brand-primary-hex').value   = b.primary_color;
      }
      if (b.secondary_color) {
        document.getElementById('prof-brand-accent-color').value = b.secondary_color;
        document.getElementById('prof-brand-accent-hex').value   = b.secondary_color;
      }
      if (b.tagline) document.getElementById('prof-brand-tagline').value = b.tagline;
      const ovEn = document.getElementById('prof-overlay-enabled');
      if (ovEn) ovEn.checked = !!b.overlay_enabled;
      const ovPh = document.getElementById('prof-overlay-phone');
      if (ovPh) ovPh.value = b.overlay_phone || '';
      const ovPos = document.getElementById('prof-overlay-position');
      if (ovPos) ovPos.value = b.overlay_position === 'top' ? 'top' : 'bottom';
      const ovLogo = document.getElementById('prof-overlay-logo');
      if (ovLogo) ovLogo.checked = b.overlay_logo !== false;

      // Populate social fields
      for (const soc of ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok']) {
        const el = document.getElementById(`prof-social-${soc}`);
        if (el) el.value = b[`${soc}_url`] || '';
      }

      if (b.logo_url) {
        const preview = document.getElementById('prof-brand-logo-preview');
        if (preview) preview.innerHTML = `<img src="${b.logo_url}" class="max-h-16 max-w-full object-contain p-1" alt="logo">`;
      }
      _syncProfBrandSwatch();
      renderHeaderSocialIcons(b);
    }

    // Load AI tone
    const cfgRes = await fetch(`${API}/ai/config`, { headers: { 'Authorization': `Bearer ${t}` } });
    if (cfgRes.ok) {
      const cfg = await cfgRes.json();
      const toneEl = document.getElementById('prof-ai-tone');
      if (toneEl && cfg.tone) toneEl.value = cfg.tone;
    }
  } catch {}
}

async function uploadProfileLogo() {
  const file = document.getElementById('prof-brand-logo-input').files[0];
  if (!file) return;
  const msg = document.getElementById('prof-brand-save-msg');
  const t = localStorage.getItem('token');
  try {
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch(`${API}/branding/logo`, { method: 'POST', headers: { 'Authorization': `Bearer ${t}` }, body: fd });
    const data = await res.json();
    if (data.url) {
      const preview = document.getElementById('prof-brand-logo-preview');
      if (preview) preview.innerHTML = `<img src="${data.url}" class="max-h-16 max-w-full object-contain p-1" alt="logo">`;
    }
    if (msg) { msg.textContent = res.ok ? 'Logo uploaded' : (data.error || 'Upload failed'); msg.className = `text-xs font-medium px-2.5 py-1 rounded-md ${res.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`; msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 3000); }
  } catch { if (msg) { msg.textContent = 'Upload failed'; msg.className = 'text-xs font-medium px-2.5 py-1 rounded-md text-red-700 bg-red-50'; msg.classList.remove('hidden'); } }
}

async function saveProfileBranding() {
  const t = localStorage.getItem('token');
  const msg = document.getElementById('prof-brand-save-msg');
  const tone = document.getElementById('prof-ai-tone')?.value || 'professional';

  // Save branding colours + tagline + social URLs
  const brandPayload = {
    primary_color:   document.getElementById('prof-brand-primary-hex')?.value || '',
    secondary_color: document.getElementById('prof-brand-accent-hex')?.value || '',
    tagline:         document.getElementById('prof-brand-tagline')?.value || '',
    overlay_enabled:  !!document.getElementById('prof-overlay-enabled')?.checked,
    overlay_phone:    document.getElementById('prof-overlay-phone')?.value || '',
    overlay_position: document.getElementById('prof-overlay-position')?.value || 'bottom',
    overlay_logo:     document.getElementById('prof-overlay-logo')?.checked !== false,
    facebook_url:     document.getElementById('prof-social-facebook')?.value || '',
    instagram_url:    document.getElementById('prof-social-instagram')?.value || '',
    twitter_url:      document.getElementById('prof-social-twitter')?.value || '',
    linkedin_url:     document.getElementById('prof-social-linkedin')?.value || '',
    youtube_url:      document.getElementById('prof-social-youtube')?.value || '',
    tiktok_url:       document.getElementById('prof-social-tiktok')?.value || '',
  };
  try {
    const [brandRes, toneRes] = await Promise.all([
      fetch(`${API}/branding`, { method: 'PUT', headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(brandPayload) }),
      fetch(`${API}/ai/config`, { method: 'POST', headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tone }) }),
    ]);
    const ok = brandRes.ok && toneRes.ok;
    if (ok) renderHeaderSocialIcons(brandPayload);
    // Mirror tone into AI Boost settings element if visible
    const aiToneEl = document.getElementById('ai-tone');
    if (aiToneEl) aiToneEl.value = tone;
    if (msg) { msg.textContent = ok ? 'Saved!' : 'Save failed'; msg.className = `text-xs font-medium px-2.5 py-1 rounded-md ${ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`; msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 3000); }
  } catch { if (msg) { msg.textContent = 'Save failed'; msg.className = 'text-xs font-medium px-2.5 py-1 rounded-md text-red-700 bg-red-50'; msg.classList.remove('hidden'); } }
}

// ── Repricing Rules ──────────────────────────────────────────────────────────

async function loadRepricingRules() {
  try {
    const res = await fetch(`${API}/ai/repricing-rules`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const { rules } = await res.json();
    const enabledEl = document.getElementById('repricing-enabled');
    const daysEl = document.getElementById('repricing-days');
    const dropEl = document.getElementById('repricing-drop-pct');
    const overEl = document.getElementById('repricing-overprice-pct');
    if (enabledEl) enabledEl.checked = !!rules.enabled;
    if (daysEl) daysEl.value = rules.days_on_lot_threshold ?? 45;
    if (dropEl) dropEl.value = rules.price_drop_pct ?? 5;
    if (overEl) overEl.value = rules.overprice_threshold_pct ?? 20;
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('repricing-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('repricing-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await fetch(`${API}/ai/repricing-rules`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: document.getElementById('repricing-enabled')?.checked,
          days_on_lot_threshold: Number(document.getElementById('repricing-days')?.value),
          price_drop_pct: Number(document.getElementById('repricing-drop-pct')?.value),
          overprice_threshold_pct: Number(document.getElementById('repricing-overprice-pct')?.value),
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      showToast('Repricing rules saved', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Rules'; }
  });

  document.getElementById('repricing-apply-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('repricing-apply-btn');
    btn.disabled = true; btn.textContent = 'Applying…';
    try {
      const res = await fetch(`${API}/ai/repricing-apply`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(`${data.flagged} vehicle${data.flagged !== 1 ? 's' : ''} flagged for repricing`, data.flagged > 0 ? 'info' : 'success');
      if (data.flagged > 0) loadAIActivity();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Apply Rules Now'; }
  });

  // Load rules when the section is first visible. It can start open (default
  // expanded), so load immediately in that case; otherwise wait for the first open.
  const repricingBody = document.getElementById('repricing-days')?.closest('.rounded-xl');
  if (repricingBody) {
    if (repricingBody.classList.contains('ai-accordion-open')) {
      loadRepricingRules();
    } else {
      const repricingObs = new MutationObserver(() => {
        if (repricingBody.classList.contains('ai-accordion-open')) {
          loadRepricingRules();
          repricingObs.disconnect();
        }
      });
      repricingObs.observe(repricingBody, { attributes: true, attributeFilter: ['class'] });
    }
  }
});

// ── Stocking Recommendations ─────────────────────────────────────────────────

const STOCKING_CACHE_KEY = 'ms_stocking_recs';
const STOCKING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (matches the server-side cache)

async function loadStockingRecommendations(force = false) {
  const btn = document.getElementById('stocking-generate-btn');
  const results = document.getElementById('stocking-results');
  if (!btn || !results) return;

  // Use cache unless forcing a refresh
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(STOCKING_CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.ts < STOCKING_CACHE_TTL) {
        renderStockingResults(cached.recs, results);
        return;
      }
    } catch {}
  }

  btn.disabled = true;
  btn.textContent = 'Generating…';
  try {
    const res = await fetch(`${API}/ai/stocking-recommendations${force ? '?refresh=1' : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const recs = data.recommendations || [];
      if (!recs.length) { showToast('No recommendations generated — add more inventory history.', 'info'); return; }
      try { localStorage.setItem(STOCKING_CACHE_KEY, JSON.stringify({ ts: Date.now(), recs })); } catch {}
      renderStockingResults(recs, results);
      if (force) showToast('Recommendations refreshed', 'success');
    } catch (e) { showToast(e.message, 'error'); }
    finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg> Refresh';
    }
}

function renderStockingResults(recs, results) {
  const priorityColors = { high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };
  results.innerHTML = `<div class="max-h-[420px] overflow-y-auto space-y-2 pr-1">${recs.map((r, i) => {
    const units = Array.isArray(r.existing_units) ? r.existing_units.filter(u => u?.id) : [];
    const linksHtml = units.length
      ? `<div class="mt-1.5 flex flex-wrap gap-1.5">${units.map(u => {
          const label = u.stocknumber ? `#${u.stocknumber}` : 'View unit';
          const search = u.stocknumber || u.id;
          return `<a href="#" onclick="switchPage('inventory');document.getElementById('catalog-search').value='${search}';renderCatalog();return false;" class="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline">${label} →</a>`;
        }).join('')}</div>`
      : '';
    return `<div class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex items-start gap-2.5">
          <span class="text-xs font-black text-slate-400 mt-0.5 w-4 text-right flex-shrink-0">${i + 1}</span>
          <div class="min-w-0">
            <div class="text-sm font-bold text-slate-900 dark:text-white">${r.make} ${r.model} <span class="font-normal text-slate-500">${r.year_range || ''}</span></div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${r.reason}</div>
            ${linksHtml}
          </div>
        </div>
        <span class="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${priorityColors[r.priority] || priorityColors.low}">${r.priority}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('stocking-generate-btn')?.addEventListener('click', () => loadStockingRecommendations(true));
  // Auto-load (cache-first) the first time the section scrolls into view, so it's
  // always populated without the user having to hit Refresh. Firing on visibility
  // (rather than page load) avoids an API call for users who never open Inv Intel.
  const stockingEl = document.getElementById('stocking-accordion');
  if (stockingEl && 'IntersectionObserver' in window) {
    let stockingLoaded = false;
    const io = new IntersectionObserver((entries) => {
      if (!stockingLoaded && entries.some(e => e.isIntersecting)) {
        stockingLoaded = true;
        loadStockingRecommendations(false);
        io.disconnect();
      }
    }, { threshold: 0.1 });
    io.observe(stockingEl);
  }
});

// ── Competitor Monitoring ─────────────────────────────────────────────────────

async function loadCompetitors() {
  const listEl = document.getElementById('competitors-list');
  const loadingEl = document.getElementById('competitors-loading');
  if (!listEl) return;
  let competitors;
  try {
    const data = await apiGetJson('/ai/competitors', { onRetry: () => {
      if (loadingEl) loadingEl.textContent = 'Still loading…';
    }});
    competitors = data.competitors || [];
  } catch (e) {
    // Always clear the spinner and offer a retry — a silent return here is what
    // left "Loading…" hanging forever.
    if (loadingEl) loadingEl.remove();
    listEl.innerHTML = `<div class="text-xs text-slate-500 dark:text-slate-400">Couldn't load competitors: ${esc(e.message)} <button onclick="loadCompetitors()" class="text-indigo-500 hover:text-indigo-400 font-bold ml-1">Retry</button></div>`;
    return;
  }
  try {
    if (loadingEl) loadingEl.remove();
    if (!competitors.length) {
      listEl.innerHTML = '<div class="text-xs text-slate-400 italic">No competitors added yet.</div>';
      return;
    }
    listEl.innerHTML = competitors.map(c => {
      const sr = c.last_scan_result || {};
      const scannedAt = c.last_scanned_at ? new Date(c.last_scanned_at).toLocaleDateString() : 'Never scanned';
      const hasData = sr.listing_count != null || sr.avg_price != null;
      const count = sr.listing_count != null ? `${sr.listing_count} listings` : '—';
      const priceRange = sr.min_price && sr.max_price ? `$${Number(sr.min_price).toLocaleString()} – $${Number(sr.max_price).toLocaleString()}` : '—';
      const platformBadge = sr.platform ? `<span class="text-[10px] text-indigo-400 font-semibold ml-1">(${sr.platform})</span>` : '';
      const isBlocked = sr.error && /WAF|bot|block|protect/i.test(sr.error);
      const atQuery = encodeURIComponent(c.name + ' Ontario');
      const atSearchUrl = `https://www.autotrader.ca/dealers/?search=${atQuery}`;
      const errorLine = sr.error
        ? isBlocked
          ? `<div class="text-xs text-amber-500 mt-1 leading-snug">Couldn't read this site — no public sitemap and the page is bot-protected. For pricing detail, paste their AutoTrader or CarGurus dealer page below.</div>
            <div class="mt-2 flex gap-1.5 competitor-url-edit hidden" id="url-edit-${c.id}">
              <input type="url" placeholder="AutoTrader, CarGurus, or dealer URL…" class="flex-1 text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200" id="url-input-${c.id}" value="${c.autotrader_url || ''}">
              <button class="competitor-url-save-btn text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded font-semibold" data-id="${c.id}">Save</button>
            </div>`
          : `<div class="text-xs text-amber-500 mt-1 leading-snug"> ${sr.error}</div>`
        : '';
      return `<div class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5" data-competitor-id="${c.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">${c.name}</div>
            <div class="text-xs text-slate-400 mt-0.5">${scannedAt}${hasData ? ` · ${count} · ${priceRange}` : ''}${platformBadge}</div>
            ${c.autotrader_url ? `<a href="${c.autotrader_url}" target="_blank" rel="noopener" class="text-xs text-indigo-500 hover:underline truncate block max-w-xs">${c.autotrader_url}</a>` : '<span class="text-xs text-slate-400">No URL set</span>'}
            ${errorLine}
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            ${isBlocked ? `<button class="competitor-url-toggle-btn text-xs text-indigo-500 hover:text-indigo-700 font-semibold" data-id="${c.id}">Update URL</button>` : ''}
            <button class="competitor-delete-btn text-red-400 hover:text-red-600 transition" data-id="${c.id}" title="Remove">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.competitor-url-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const editRow = document.getElementById(`url-edit-${btn.dataset.id}`);
        if (editRow) editRow.classList.toggle('hidden');
      });
    });

    listEl.querySelectorAll('.competitor-url-save-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const input = document.getElementById(`url-input-${btn.dataset.id}`);
        const newUrl = input?.value.trim();
        if (!newUrl) return;
        btn.textContent = 'Saving…'; btn.disabled = true;
        try {
          const res = await fetch(`${API}/ai/competitors/${btn.dataset.id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ autotrader_url: newUrl })
          });
          if (!res.ok) throw new Error((await res.json()).error);
          showToast('URL updated — run Scan All to refresh', 'success');
          loadCompetitors();
        } catch (e) { showToast(e.message, 'error'); btn.textContent = 'Save'; btn.disabled = false; }
      });
    });

    listEl.querySelectorAll('.competitor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this competitor?')) return;
        try {
          const res = await fetch(`${API}/ai/competitors/${btn.dataset.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
          if (!res.ok) throw new Error((await res.json()).error);
          loadCompetitors();
          showToast('Competitor removed', 'success');
        } catch (e) { showToast(e.message, 'error'); }
      });
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('competitor-add-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('competitor-name-input')?.value.trim();
    const url = document.getElementById('competitor-url-input')?.value.trim();
    if (!name) { showToast('Dealership name required', 'error'); return; }
    try {
      const res = await fetch(`${API}/ai/competitors`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, autotrader_url: url || null })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      document.getElementById('competitor-name-input').value = '';
      document.getElementById('competitor-url-input').value = '';
      loadCompetitors();
      showToast('Competitor added', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  document.getElementById('competitors-scan-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('competitors-scan-btn');
    const compPanel = document.getElementById('competitor-comparison');
    btn.disabled = true; btn.textContent = 'Scanning…';
    compPanel?.classList.add('hidden');
    try {
      // Kick off the background scan on its own. Scan returns immediately with
      // { status: 'scanning', total }. One retry for iOS cold-start / dropped
      // connections so a transient network blip doesn't read as "scan failed".
      let scanRes;
      for (let i = 0; i < 2; i++) {
        try {
          scanRes = await fetch(`${API}/ai/competitors/scan`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
          break;
        } catch (netErr) {
          if (i === 1) throw new Error('Could not reach the server to start the scan. Check your connection and try again.');
          await new Promise(r => setTimeout(r, 2500));
        }
      }
      const scanData = await scanRes.json();
      if (!scanRes.ok) throw new Error(scanData.error || 'Scan failed');

      // Our own lot stats — fetched separately and tolerantly. A failure here
      // must NOT abort the competitor scan (it's only used for the comparison).
      let ourRes = null;
      try { ourRes = await fetch(`${API}/inventory/all`, { headers: { 'Authorization': `Bearer ${token}` } }); }
      catch { ourRes = null; }

      // Poll GET /ai/competitors until all entries have a fresh last_scanned_at
      const total = scanData.total || 1;
      // Backdate 15s: last_scanned_at is stamped with the SERVER clock, scanStarted
      // is the CLIENT clock. If the phone runs ahead, freshly-scanned rows look
      // "older" than start and never count as done — the button sticks on
      // "Scanning 0/N…" for minutes even though the data already landed.
      const scanStarted = Date.now() - 15000;
      let competitors = [];
      btn.textContent = `Scanning 0/${total}…`;
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(r => setTimeout(r, 7000));
        let pollRes;
        try { pollRes = await fetch(`${API}/ai/competitors`, { headers: { 'Authorization': `Bearer ${token}` } }); }
        catch { continue; } // network/CORS during cold-start — keep waiting
        if (!pollRes.ok) continue;
        const pollData = await pollRes.json();
        competitors = pollData.competitors || [];
        const done = competitors.filter(c => c.last_scanned_at && new Date(c.last_scanned_at) > new Date(scanStarted)).length;
        btn.textContent = `Scanning ${done}/${total}…`;
        if (done >= total) break;
      }

      // Build comparison using freshly-scanned competitor data
      const scanDataFinal = { results: competitors.map(c => ({ id: c.id, name: c.name, result: c.last_scan_result })) };

      // Build our lot stats from available inventory
      const ourVehicles = (ourRes && ourRes.ok) ? (await ourRes.json()).filter(v => v.status === 'available' && v.price > 0) : [];
      const ourPrices = ourVehicles.map(v => Number(v.price)).filter(p => p > 0).sort((a, b) => a - b);
      const ourAvg = ourPrices.length ? Math.round(ourPrices.reduce((a, b) => a + b, 0) / ourPrices.length) : null;
      const ourMin = ourPrices[0] || null;
      const ourMax = ourPrices[ourPrices.length - 1] || null;
      const ourCount = ourVehicles.length;

      const results = (scanDataFinal.results || []).filter(r => r.result && !r.result.error);
      if (results.length && compPanel) {
        const fmt = n => n != null ? `$${Number(n).toLocaleString()}` : '—';
        const pct = (a, b) => (a != null && b != null && b !== 0) ? Math.round(((a - b) / b) * 100) : null;

        const rows = results.map(r => {
          const s = r.result;
          const avgDiff = pct(s.avg_price, ourAvg);
          const flags = [];
          if (avgDiff != null && avgDiff < -5) flags.push(`<span class="text-amber-500 font-semibold"> Avg price ${Math.abs(avgDiff)}% below yours</span>`);
          if (avgDiff != null && avgDiff > 10) flags.push(`<span class="text-emerald-500 font-semibold"> You're priced ${avgDiff}% cheaper on avg</span>`);
          if (s.listing_count != null && ourCount > 0 && s.listing_count > ourCount * 1.5) flags.push(`<span class="text-amber-500 font-semibold"> They have ${s.listing_count - ourCount} more units</span>`);
          if (s.min_price != null && ourMin != null && s.min_price < ourMin * 0.9) flags.push(`<span class="text-amber-500 font-semibold"> Their lowest price is ${fmt(s.min_price)} vs your ${fmt(ourMin)}</span>`);

          return `
            <div class="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div class="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 font-bold text-sm text-slate-900 dark:text-white">${r.name}</div>
              <div class="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-700">
                <div class="px-4 py-3 space-y-2">
                  <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Your Lot</div>
                  <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div><span class="text-slate-400">Units:</span> <span class="font-semibold">${ourCount}</span></div>
                    <div><span class="text-slate-400">Avg price:</span> <span class="font-semibold">${fmt(ourAvg)}</span></div>
                    <div><span class="text-slate-400">Range:</span> <span class="font-semibold">${fmt(ourMin)} – ${fmt(ourMax)}</span></div>
                  </div>
                </div>
                <div class="px-4 py-3 space-y-2">
                  <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">${r.name}</div>
                  <div class="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div><span class="text-slate-400">Units:</span> <span class="font-semibold">${s.listing_count ?? '—'}</span></div>
                    <div><span class="text-slate-400">Avg price:</span> <span class="font-semibold">${fmt(s.avg_price)}</span></div>
                    <div><span class="text-slate-400">Range:</span> <span class="font-semibold">${fmt(s.min_price)} – ${fmt(s.max_price)}</span></div>
                  </div>
                </div>
              </div>
              ${flags.length ? `<div class="px-4 py-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-1 text-xs">${flags.join('')}</div>` : ''}
            </div>`;
        }).join('');

        compPanel.innerHTML = `
          <div class="pt-1">
            <div class="flex items-center justify-between mb-3">
              <div class="text-xs uppercase font-bold tracking-wider text-slate-400">Lot Comparison</div>
              <button id="competitor-pdf-btn" class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Download PDF
              </button>
            </div>
            <div class="space-y-3 max-h-[480px] overflow-y-auto pr-1">${rows}</div>
          </div>`;
        compPanel.classList.remove('hidden');
        document.getElementById('competitor-pdf-btn')?.addEventListener('click', () => {
          const panel = document.getElementById('competitor-comparison');
          if (!panel || panel.classList.contains('hidden')) return;
          const inner = panel.querySelector('.space-y-3')?.innerHTML || panel.innerHTML;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Competitor Lot Comparison</title>
<style>
  @media print { .no-print{display:none!important} @page{margin:0.75in} }
  body{font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a}
  .no-print{display:flex;justify-content:flex-end;gap:10px;margin-bottom:16px}
  .no-print button{padding:8px 18px;border-radius:6px;border:none;cursor:pointer;font-weight:700;font-size:13px}
  h1{font-size:18px;font-weight:900;color:#1a2e4a;margin:0 0 4px}
  .sub{font-size:12px;color:#64748b;margin-bottom:20px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px}
  .card-head{background:#1a2e4a;color:#fff;font-weight:700;font-size:14px;padding:10px 14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e2e8f0}
  .col{padding:14px;font-size:13px}
  .col:first-child{border-right:1px solid #e2e8f0}
  .col-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:8px}
  .row{margin-bottom:4px}.row .l{color:#64748b}.row .v{font-weight:700}
  .flags{padding:10px 14px;border-top:1px solid #e2e8f0;font-size:12px}
</style></head><body>
<div class="no-print">
  <button onclick="window.close()" style="background:#f1f5f9;color:#334155"> Close</button>
  <button onclick="window.print()" style="background:#1a2e4a;color:#fff"> Print / Save as PDF</button>
</div>
<h1>Competitor Lot Comparison</h1>
<div class="sub">Generated ${new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
${inner}
</body></html>`;
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `competitor-comparison-${new Date().toISOString().slice(0,10)}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          showToast('Comparison downloaded — open in browser then Print → Save as PDF', 'success', 5000);
        });
      }

      showToast(`Scanned ${total} competitor${total !== 1 ? 's' : ''}`, 'success');
      loadCompetitors();
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Scan All'; }
  });

  // Load competitors when the accordion opens. It can now START open (default
  // expanded), in which case the "class added" observer never fires — so load
  // immediately if it's already open, and otherwise wait for the first open.
  const competitorAccordion = document.getElementById('competitors-list')?.closest('.rounded-xl');
  if (competitorAccordion) {
    if (competitorAccordion.classList.contains('ai-accordion-open')) {
      loadCompetitors();
    } else {
      new MutationObserver((_, obs) => {
        if (competitorAccordion.classList.contains('ai-accordion-open')) {
          loadCompetitors();
          obs.disconnect();
        }
      }).observe(competitorAccordion, { attributes: true, attributeFilter: ['class'] });
    }
  }
});

// ── Weekly Lot Health Report ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const lastSentEl = document.getElementById('weekly-report-last-sent');
  const stored = localStorage.getItem('weekly-report-last-sent');
  if (lastSentEl && stored) lastSentEl.textContent = `Last sent: ${new Date(stored).toLocaleDateString()}`;

  document.getElementById('weekly-report-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('weekly-report-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const res = await fetch(`${API}/ai/weekly-report`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      const now = new Date().toISOString();
      localStorage.setItem('weekly-report-last-sent', now);
      if (lastSentEl) lastSentEl.textContent = `Last sent: ${new Date(now).toLocaleDateString()}`;
      showToast(`Report sent to ${data.recipient}`, 'success', 5000);
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg> Send Report Now'; }
  });

  // PDF download — opens the report HTML in a new tab with a Print button
  document.getElementById('weekly-report-pdf-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('weekly-report-pdf-btn');
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      const res = await fetch(`${API}/ai/weekly-report/html`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (w) setTimeout(() => URL.revokeObjectURL(url), 30000);
      else showToast('Pop-up blocked — allow pop-ups and try again', 'error');
    } catch (e) { showToast(e.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg> Download PDF'; }
  });

});

// ── Notification Center ────────────────────────────────────────────────────
;(function() {
  const bell    = document.getElementById('notif-bell')
  const badge   = document.getElementById('notif-badge')
  const panel   = document.getElementById('notif-panel')
  const backdrop = document.getElementById('notif-backdrop')
  const list    = document.getElementById('notif-list')
  const closeBtn = document.getElementById('notif-close')
  const readAllBtn = document.getElementById('notif-read-all')

  if (!bell || !panel) return

  let _notifTab = 'unread' // 'unread' | 'needs_action' | 'all'
  let _notifScope = 'active' // 'active' | 'all'
  let _notifications = []

  function getActiveProductKey() {
    if (window.__demoActiveProduct) {
      const dp = String(window.__demoActiveProduct).toLowerCase()
      if (dp.includes('facebook') || dp === 'fb') return 'facebook'
      if (dp.includes('website') || dp.includes('site')) return 'website'
      if (dp.includes('email') || dp.includes('sms') || dp.includes('automation')) return 'email_sms'
      if (dp.includes('video')) return 'video'
      if (dp.includes('ai') || dp.includes('chat')) return 'ai_chatbot'
      if (dp.includes('studio') || dp.includes('design')) return 'design_studio'
      if (dp.includes('seo')) return 'seo'
    }

    const docProd = (document.documentElement.getAttribute('data-product') || '').toLowerCase().trim()
    if (docProd) {
      if (docProd.includes('facebook') || docProd === 'fb') return 'facebook'
      if (docProd.includes('video')) return 'video'
      if (docProd.includes('email') || docProd.includes('sms') || docProd.includes('automation')) return 'email_sms'
      if (docProd.includes('website') || docProd.includes('site')) return 'website'
      if (docProd.includes('chatbot') || docProd === 'ai' || docProd === 'ai_dealer') return 'ai_chatbot'
      if (docProd.includes('design_studio') || docProd === 'studio') return 'design_studio'
      if (docProd.includes('seo')) return 'seo'
    }

    const cur = typeof __currentPage !== 'undefined' ? String(__currentPage).toLowerCase() : ''
    if (cur === 'video-studio') return 'video'
    if (cur === 'automation-builder' || cur === 'email-marketing') return 'email_sms'
    if (cur === 'website' || cur === 'blog') return 'website'
    if (cur === 'ai-home' || cur === 'ai-inbox') return 'ai_chatbot'
    if (cur === 'studio') return 'design_studio'
    if (cur === 'seo') return 'seo'
    if (cur === 'inventory' || cur === 'leaderboard') return 'facebook'

    return 'dealer_os'
  }

  function getProductDisplayLabel(k) {
    const map = {
      facebook: 'Facebook AutoPoster',
      video: 'Video Studio',
      email_sms: 'Email & SMS',
      website: 'Dealer Website',
      ai_chatbot: 'AI ChatBot',
      design_studio: 'Design Studio',
      seo: 'MarketSync SEO',
      dealer_os: 'DealerOS'
    }
    return map[k] || 'MarketSync'
  }

  async function authFetch(url, opts = {}) {
    const tk = localStorage.getItem('token')
    const res = await fetch(url, { ...opts, headers: { 'Authorization': `Bearer ${tk}`, ...(opts.headers || {}) } })
    if (!res.ok) throw new Error(res.status)
    return res.json()
  }

  // Inline SVG icons
  const _svg = (p) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
  const NI = {
    clock: _svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    dollar: _svg('<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    camera: _svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    car: _svg('<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13"/><path d="M5 13h14a1 1 0 0 1 1 1v3H4v-3a1 1 0 0 1 1-1z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'),
    search: _svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    card: _svg('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>'),
    chart: _svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
    window: _svg('<rect x="4" y="3" width="16" height="18" rx="1"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="12" x2="20" y2="12"/>'),
    doc: _svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>'),
    mail: _svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>'),
    calendar: _svg('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
    user: _svg('<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/>'),
    clipboard: _svg('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 14l2 2 4-4"/>'),
    bell: _svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    alert: _svg('<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>'),
    check: _svg('<path d="M5 13l4 4L19 7"/>')
  }

  const TYPE_META = {
    aging:        { icon: NI.clock, color: 'text-orange-500' },
    price_drift:  { icon: NI.dollar, color: 'text-amber-500' },
    missing_info: { icon: NI.camera, color: 'text-blue-500' },
    new_arrival:  { icon: NI.car, color: 'text-emerald-500' },
    competitor:   { icon: NI.search, color: 'text-purple-500' },
    billing:      { icon: NI.card, color: 'text-indigo-500' },
    weekly_report:{ icon: NI.chart, color: 'text-slate-500' },
    window_sticker:{ icon: NI.window, color: 'text-cyan-500' },
    brochure:     { icon: NI.doc, color: 'text-rose-500' },
    email_sent:   { icon: NI.mail, color: 'text-teal-500' },
    appointment:  { icon: NI.calendar, color: 'text-indigo-500' },
    new_lead:     { icon: NI.user, color: 'text-emerald-500' },
    appraisal:    { icon: NI.clipboard, color: 'text-violet-500' },
    fb_sold:      { icon: NI.car, color: 'text-emerald-500' },
    sold_vehicle: { icon: NI.car, color: 'text-rose-500' },
    pending_sale: { icon: NI.clock, color: 'text-amber-500' },
    extension_disconnected: { icon: NI.alert, color: 'text-rose-500' },
    video_viewed: { icon: NI.camera, color: 'text-indigo-500' },
    video_failed: { icon: NI.alert, color: 'text-rose-500' },
    customer_replied: { icon: NI.mail, color: 'text-indigo-500' },
    automation_failed: { icon: NI.alert, color: 'text-amber-500' },
    form_lead:    { icon: NI.user, color: 'text-emerald-500' },
    human_requested: { icon: NI.alert, color: 'text-rose-500' },
    chat_lead:    { icon: NI.user, color: 'text-violet-500' },
    scheduled_post_failed: { icon: NI.alert, color: 'text-amber-500' },
    indexing_issue: { icon: NI.search, color: 'text-orange-500' },
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'Just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  function setupPanelHeader() {
    const aside = panel.querySelector('aside')
    if (!aside) return
    const prodKey = getActiveProductKey()
    const prodLabel = getProductDisplayLabel(prodKey)

    let headerEl = aside.querySelector('#notif-panel-header')
    if (!headerEl) {
      aside.innerHTML = `
        <div id="notif-panel-header" class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-black text-slate-900 dark:text-white">Notifications</h2>
              <p id="notif-scope-title" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">${esc(prodLabel)} Feed</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="notif-desktop-toggle" onclick="requestDesktopPermission()" title="Turn on desktop alerts" class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition p-1.5 rounded-lg">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              </button>
              <button id="notif-read-all" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold">Mark read</button>
              <button id="notif-close" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>

          <!-- Scope Switcher & Filter Tabs -->
          <div class="flex items-center justify-between pt-1 gap-2">
            <div class="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold">
              <button id="notif-tab-unread" onclick="window.switchNotifTab('unread')" class="px-2.5 py-1 rounded-md transition ${_notifTab === 'unread' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}">Unread</button>
              <button id="notif-tab-action" onclick="window.switchNotifTab('needs_action')" class="px-2.5 py-1 rounded-md transition ${_notifTab === 'needs_action' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}">Needs Action</button>
              <button id="notif-tab-all" onclick="window.switchNotifTab('all')" class="px-2.5 py-1 rounded-md transition ${_notifTab === 'all' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' : 'text-slate-500'}">All</button>
            </div>

            <button id="notif-scope-toggle" onclick="window.toggleNotifScope()" class="text-[10px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline whitespace-nowrap">
              ${_notifScope === 'active' ? 'Show All Products' : 'Active Product Only'}
            </button>
          </div>
        </div>
        <div id="notif-list" class="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800"></div>
      `
      aside.querySelector('#notif-close')?.addEventListener('click', closePanel)
      aside.querySelector('#notif-read-all')?.addEventListener('click', async () => {
        const prod = _notifScope === 'active' ? getActiveProductKey() : ''
        await authFetch(`${API}/notifications/read-all${prod ? `?product=${prod}` : ''}`, { method: 'POST' }).catch(() => {})
        _notifications.forEach(n => {
          if (!prod || n.product === prod) n.read = true
        })
        renderList(_notifications)
        updateBadge()
      })
    } else {
      const titleEl = aside.querySelector('#notif-scope-title')
      if (titleEl) titleEl.textContent = _notifScope === 'active' ? `${prodLabel} Feed` : 'All MarketSync Feed'
      const scopeBtn = aside.querySelector('#notif-scope-toggle')
      if (scopeBtn) scopeBtn.textContent = _notifScope === 'active' ? 'Show All Products' : 'Active Product Only'
    }
  }

  function renderList(items) {
    const listEl = document.getElementById('notif-list')
    if (!listEl) return

    let filtered = items || []
    if (_notifTab === 'unread') {
      filtered = filtered.filter(n => !n.read)
    } else if (_notifTab === 'needs_action') {
      filtered = filtered.filter(n => (n.needs_action || n.severity === 'action_required' || n.severity === 'critical') && n.status !== 'action_completed' && n.status !== 'acknowledged')
    }

    if (!filtered.length) {
      const emptyMsg = _notifTab === 'needs_action' ? 'No pending action items.' : _notifTab === 'unread' ? 'All caught up! No unread notifications.' : 'No notifications found.'
      listEl.innerHTML = `<div class="flex flex-col items-center justify-center h-56 text-slate-400 text-xs gap-2.5 p-6 text-center"><span class="w-8 h-8 opacity-40">${NI.bell}</span>${esc(emptyMsg)}</div>`
      return
    }

    listEl.innerHTML = filtered.map(n => {
      const meta = TYPE_META[n.type] || { icon: NI.bell, color: 'text-slate-400' }
      const sev = n.severity || 'info'
      const sevBadge = sev === 'critical' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">Critical</span>'
        : sev === 'action_required' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">Action Required</span>'
        : sev === 'warning' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">Warning</span>'
        : ''

      const isResolved = n.status === 'acknowledged' || n.status === 'action_completed'
      const actionLabel = n.action_label || (n.link_page ? 'Open' : n.link_url ? 'View' : null)

      return `
        <div class="notif-item p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition space-y-2 ${n.read ? 'opacity-70' : ''}" data-id="${esc(n.id)}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="flex-shrink-0 ${meta.color}">${meta.icon}</span>
              ${sevBadge}
              ${isResolved ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Resolved</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-mono flex-shrink-0">${timeAgo(n.created_at)}</span>
          </div>

          <div>
            <h4 class="text-xs font-black text-slate-900 dark:text-white leading-snug">${esc(n.title)}</h4>
            ${n.body ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${esc(n.body)}</p>` : ''}
          </div>

          <!-- Action and Acknowledge Buttons -->
          <div class="flex items-center justify-between pt-1.5 gap-2">
            <div class="flex items-center gap-2">
              ${actionLabel ? `
                <button onclick="window.handleNotifAction('${esc(n.id)}', '${esc(n.action_page || n.link_page || '')}', '${esc(n.action_filter || n.link_filter || '')}', '${esc(n.action_url || n.link_url || '')}')" class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs">
                  ${esc(actionLabel)}
                </button>
              ` : ''}
              ${!isResolved && (n.needs_action || sev === 'action_required' || sev === 'critical') ? `
                <button onclick="window.acknowledgeNotif('${esc(n.id)}')" class="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[11px] transition">
                  Acknowledge
                </button>
              ` : ''}
            </div>
            ${!n.read ? '<span class="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0"></span>' : ''}
          </div>
        </div>
      `
    }).join('')
  }

  async function loadNotifications() {
    setupPanelHeader()
    const prod = _notifScope === 'active' ? getActiveProductKey() : ''
    try {
      const data = await authFetch(`${API}/notifications${prod ? `?product=${prod}` : ''}`)
      _notifications = Array.isArray(data) ? data : []
      renderList(_notifications)
    } catch {
      const listEl = document.getElementById('notif-list')
      if (listEl) listEl.innerHTML = '<div class="px-5 py-8 text-center text-xs text-slate-400">Could not load notifications.</div>'
    }
  }

  async function updateBadge() {
    try {
      const prod = getActiveProductKey()
      const { count } = await authFetch(`${API}/notifications/unread-count${prod ? `?product=${prod}` : ''}`)
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count
        badge.classList.remove('hidden')
      } else {
        badge.classList.add('hidden')
      }
    } catch {}
  }

  function openPanel() {
    panel.classList.remove('hidden')
    document.body.style.overflow = 'hidden'
    if (('Notification' in window) && Notification.permission === 'default' && !localStorage.getItem('ms_desktop_prompted')) {
      localStorage.setItem('ms_desktop_prompted', '1')
      requestDesktopPermission()
    }
    loadNotifications()
  }

  function closePanel() {
    panel.classList.add('hidden')
    document.body.style.overflow = ''
    updateBadge()
  }

  window.switchNotifTab = function(t) {
    _notifTab = t
    const aside = panel.querySelector('aside')
    if (aside) {
      aside.querySelectorAll('[id^="notif-tab-"]').forEach(el => {
        el.className = 'px-2.5 py-1 rounded-md transition text-slate-500'
      })
      const activeBtn = aside.querySelector(`#notif-tab-${t === 'needs_action' ? 'action' : t}`)
      if (activeBtn) activeBtn.className = 'px-2.5 py-1 rounded-md transition bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
    }
    renderList(_notifications)
  }

  window.toggleNotifScope = function() {
    _notifScope = _notifScope === 'active' ? 'all' : 'active'
    loadNotifications()
  }

  window.handleNotifAction = async function(id, page, filter, url) {
    await authFetch(`${API}/notifications/${id}/read`, { method: 'POST' }).catch(() => {})
    const found = _notifications.find(n => n.id === id)
    if (found) found.read = true
    updateBadge()

    if (url) {
      window.open(url, '_blank', 'noopener')
      return
    }
    if (page) {
      closePanel()
      if (typeof switchPage === 'function') switchPage(page)
      if (filter && document.getElementById('catalog-search')) {
        document.getElementById('catalog-search').value = filter
        if (typeof renderCatalog === 'function') renderCatalog()
      }
    }
  }

  window.acknowledgeNotif = async function(id) {
    await authFetch(`${API}/notifications/${id}/acknowledge`, { method: 'POST' }).catch(() => {})
    const found = _notifications.find(n => n.id === id)
    if (found) {
      found.status = 'acknowledged'
      found.read = true
    }
    renderList(_notifications)
    updateBadge()
    if (typeof showToast === 'function') showToast('Notification resolved', 'success')
  }

  bell.addEventListener('click', () => panel.classList.contains('hidden') ? openPanel() : closePanel())
  if (closeBtn) closeBtn.addEventListener('click', closePanel)
  if (backdrop) backdrop.addEventListener('click', closePanel)

  function startPolling() {
    updateBadge()
    setInterval(() => { updateBadge() }, 60000)
  }

  const authWait = setInterval(() => {
    if (typeof API !== 'undefined' && localStorage.getItem('token')) {
      clearInterval(authWait)
      startPolling()
    }
  }, 500)
})()


// ── Inventory Intelligence Page ────────────────────────────────────────────
;(function() {
  let _intelData = null
  let _intelLoaded = false

  async function authFetch(url, opts = {}) {
    const tk = localStorage.getItem('token')
    const res = await fetch(url, { ...opts, headers: { 'Authorization': `Bearer ${tk}`, ...(opts.headers || {}) } })
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || res.status) }
    return res.json()
  }

  function scoreColor(s) {
    if (s >= 80) return 'text-emerald-600 dark:text-emerald-400'
    if (s >= 60) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  function scoreBg(s) {
    if (s >= 80) return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    if (s >= 60) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
    return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
  }

  function supplyColor(mos) {
    if (mos === null) return 'text-slate-400'
    if (mos <= 1.5) return 'text-emerald-600 dark:text-emerald-400 font-bold'
    if (mos <= 3)   return 'text-amber-600 dark:text-amber-400'
    return 'text-red-500 dark:text-red-400'
  }

  function statCard(label, value, sub, accent) {
    return `<div class="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">${label}</div>
      <div class="text-2xl font-black ${accent || 'text-slate-900 dark:text-white'}">${value}</div>
      ${sub ? `<div class="text-xs text-slate-500 mt-0.5">${sub}</div>` : ''}
    </div>`
  }

  function renderIntel(data = {}) {
    const summary = data.summary || { total: 0, avg_score: 0, needs_attention: 0, duplicate_vins: 0 }
    const velocity = Array.isArray(data.velocity) ? data.velocity : []
    const hot_segments = Array.isArray(data.hot_segments) ? data.hot_segments : []
    const cold_segments = Array.isArray(data.cold_segments) ? data.cold_segments : []
    const duplicate_vins = Array.isArray(data.duplicate_vins) ? data.duplicate_vins : []
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles : []

    // Populate module-level caches so renderCatalog can show hot/cold tags and health scores
    __hotMakeModels = new Set(hot_segments.map(s => `${s.make} ${s.model}`.toLowerCase()))
    __coldMakeModels = new Set(cold_segments.map(s => `${s.make} ${s.model}`.toLowerCase()))
    __vehicleHealthScores = Object.fromEntries(vehicles.map(v => [v.id, v.score]))
    if (__hotMakeModels.size > 0 || __coldMakeModels.size > 0) {
      document.getElementById('catalog-segment-pills')?.classList.remove('hidden');
    }

    // Stats
    const sa = summary.avg_score || 0
    const statsEl = document.getElementById('inv-intel-stats')
    if (statsEl) {
      statsEl.innerHTML = [
        statCard('Total Units', summary.total || 0, 'available'),
        statCard('Avg Health Score', sa + '/100', '', scoreColor(sa)),
        statCard('Need Attention', summary.needs_attention || 0, 'score < 50', (summary.needs_attention || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'),
        statCard('Duplicate VINs', summary.duplicate_vins || 0, duplicate_vins.length ? 'action required' : 'none found', duplicate_vins.length ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'),
      ].join('')
    }

    // Narrative is loaded async by loadNarrative() — hide until it arrives
    document.getElementById('inv-intel-narrative')?.classList.add('hidden')

    // Hot / Cold segments
    const hotEl = document.getElementById('inv-intel-hot')
    if (hotEl) {
      hotEl.innerHTML = hot_segments.length
        ? hot_segments.map((s, i) => `<div onclick="switchPage('inventory-overview'); setTimeout(() => { engineTab('inventory-overview', 'work'); const i = document.getElementById('catalog-search'); if(i) { i.value = '${s.make} ${s.model}'; renderCatalog(); } }, 50);" class="flex items-center justify-between py-1.5 px-2 -mx-2 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition rounded">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-slate-400 w-4 text-right">${i + 1}</span>
              <span class="font-medium text-slate-900 dark:text-white">${s.make} ${s.model}</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400">${s.monthly_velocity}/mo</div>
              <div class="text-sm text-slate-400">${s.current_stock} in stock</div>
            </div>
          </div>`).join('')
        : '<p class="text-slate-400 text-sm">No hot vehicles detected</p>'
    }

    const coldEl = document.getElementById('inv-intel-cold')
    if (coldEl) {
      coldEl.innerHTML = cold_segments.length
        ? cold_segments.map((s, i) => `<div onclick="switchPage('inventory-overview'); setTimeout(() => { engineTab('inventory-overview', 'work'); const i = document.getElementById('catalog-search'); if(i) { i.value = '${s.make} ${s.model}'; renderCatalog(); } }, 50);" class="flex items-center justify-between py-1.5 px-2 -mx-2 border-b border-slate-100 dark:border-slate-700 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition rounded">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-slate-400 w-4 text-right">${i + 1}</span>
              <span class="font-medium text-slate-900 dark:text-white">${s.make} ${s.model}</span>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-red-600 dark:text-red-400">${s.monthly_velocity}/mo sold</div>
              <div class="text-sm text-slate-400">${s.current_stock} units in stock</div>
            </div>
          </div>`).join('')
        : '<p class="text-slate-400 text-sm">No cold vehicles detected</p>'
    }

    // Duplicates
    const dupsWrap = document.getElementById('inv-intel-dups-wrap')
    const dupsEl = document.getElementById('inv-intel-dups')
    if (dupsWrap && dupsEl) {
      if (duplicate_vins.length) {
        dupsEl.innerHTML = duplicate_vins.map(d => `<div onclick="switchPage('inventory-overview'); setTimeout(() => { engineTab('inventory-overview', 'work'); const i = document.getElementById('catalog-search'); if(i) { i.value = '${d.vin}'; renderCatalog(); } }, 50);" class="bg-white dark:bg-slate-800 rounded-lg px-3 py-2 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition">
          <div class="font-mono text-xs font-bold text-red-700 dark:text-red-400 mb-1">VIN: ${d.vin}</div>
          <div class="flex flex-wrap gap-2">${(Array.isArray(d.units) ? d.units : []).map(u => `<span class="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">${u.year} ${u.make} ${u.model}${u.stock ? ' · ' + u.stock : ''}</span>`).join('')}</div>
        </div>`).join('')
        dupsWrap.classList.remove('hidden')
      } else {
        dupsWrap.classList.add('hidden')
      }
    }

    // Velocity table — wrap parent in scroll container with fade edge
    const velWrap = document.getElementById('inv-intel-velocity-body')?.closest('.overflow-x-auto')
    if (velWrap) {
      velWrap.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch;position:relative'
      if (velWrap.parentElement) velWrap.parentElement.style.position = 'relative'
    }
    const tbody = document.getElementById('inv-intel-velocity-body')
    if (tbody) {
      tbody.innerHTML = velocity.map(s => `<tr onclick="switchPage('inventory-overview'); setTimeout(() => { engineTab('inventory-overview', 'work'); const i = document.getElementById('catalog-search'); if(i) { i.value = '${s.make} ${s.model}'; renderCatalog(); } }, 50);" class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="px-4 py-2.5 font-medium text-slate-900 dark:text-white whitespace-nowrap">${s.make} ${s.model}</td>
        <td class="px-4 py-2.5 text-right tabular-nums">${s.sold_30d}</td>
        <td class="px-4 py-2.5 text-right tabular-nums font-bold">${s.sold_90d}</td>
        <td class="px-4 py-2.5 text-right tabular-nums">${s.current_stock}</td>
        <td class="px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${supplyColor(s.months_of_supply)}">${s.months_of_supply != null ? s.months_of_supply + ' mo' : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No sell-through data yet</td></tr>'
    }

    // Health scores table — with score breakdown sub-row
    const hbody = document.getElementById('inv-intel-health-body')
    if (hbody) {
      hbody.innerHTML = vehicles.map((v, idx) => {
        const b = v.breakdown || {}
        const scoreColor = v.score >= 80 ? '#10b981' : v.score >= 60 ? '#f59e0b' : '#ef4444'
        const issues = Array.isArray(v.issues) ? v.issues : []
        const issueList = issues.length
          ? issues.map(i => `<span class="inline-flex text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">${i}</span>`).join(' ')
          : '<span class="text-emerald-500 text-xs font-semibold"> Good</span>'
        const stockNum = v.stock || v.id?.slice(0, 8) || '—'
        const vehicleLine = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')

        const priceNote = v.price_vs_market_pct != null
          ? (v.price_vs_market_pct >= -3 ? 'priced to market' : `${Math.abs(v.price_vs_market_pct)}% under market`)
          : null;
        const mileNote = v.mileage != null
          ? Number(v.mileage).toLocaleString() + (v.mileage_ratio != null ? (v.mileage_ratio <= 1.0 ? ' · below avg' : v.mileage_ratio <= 1.25 ? ' · slightly high' : ' · high for age') : '')
          : null;
        const money0 = (n) => n != null ? '$' + Number(n).toLocaleString() : '—';
        const priceActual = v.price > 0 ? money0(v.price) + (priceNote ? ' · ' + priceNote : '') : 'No price';
        const mileActual = v.mileage > 0 ? (mileNote || Number(v.mileage).toLocaleString()) : 'No mileage';
        const segments = [
          { label: 'Photos',      val: b.photos,      max: 30, icon: 'camera',   actual: `${v.photos || 0} photo${v.photos === 1 ? '' : 's'}` },
          { label: 'Days on lot', val: b.days,         max: 25, icon: 'calendar', actual: `${v.days}d on lot` },
          { label: 'Price',       val: b.price,        max: 15, icon: 'currency', actual: priceActual },
          { label: 'Mileage',     val: b.mileage,      max: 10, icon: 'hashtag',  actual: mileActual },
          { label: 'Description', val: b.description,  max: 10, icon: 'document', actual: b.description >= 10 ? 'Written' : 'Short / missing' },
          { label: 'VIN decode',  val: b.fields,       max: 10, icon: 'check',    actual: b.fields >= 10 ? 'Decoded' : 'Incomplete' },
        ].filter(s => s.val != null)

        const breakdownId = `hbd-${idx}`
        const breakdownHtml = `
          <div id="${breakdownId}" class="hidden col-span-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              ${segments.map(s => {
                const pct = Math.round((s.val / s.max) * 100)
                const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
                const valColor = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'
                return `<div title="Worth ${s.max}% of the health score">
                  <div class="flex justify-between items-baseline text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 gap-2">
                    <span class="inline-flex items-center gap-1">${svgIcon(s.icon, 'w-3 h-3')}${s.label}</span>
                    <span class="text-[9px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600">worth ${s.max}%</span>
                  </div>
                  <div class="flex justify-between items-baseline mb-1 gap-2">
                    <span class="text-[12px] font-bold ${valColor} truncate">${esc(s.actual)}</span>
                  </div>
                  <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div class="h-1.5 rounded-full ${barColor}" style="width:${pct}%"></div>
                  </div>
                </div>`
              }).join('')}
            </div>
            ${(() => {
              const flags0 = Array.isArray(v.photo_flags) ? v.photo_flags : [];
              const staleNoPhotos = (v.photos > 0) && flags0.some(f => /no photos/i.test(f));
              if ((v.photo_checked_at == null && v.photo_score == null) || staleNoPhotos) {
                return `<div class="mb-3 text-[11px] text-slate-400 dark:text-slate-500">AI Vision: photos not scored yet — will score on the next sync, or click “Score photos”.</div>`;
              }
              const ps = Number(v.photo_score || 0);
              const barColor = ps >= 80 ? 'bg-emerald-500' : ps >= 50 ? 'bg-amber-400' : 'bg-red-400';
              const flags = Array.isArray(v.photo_flags) ? v.photo_flags : [];
              return `<div class="mb-3 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 p-2.5">
                <div class="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  <span class="flex items-center gap-1"><svg viewBox="0 0 24 24" width="12" height="12" class="inline-block flex-shrink-0" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg> AI Vision — Photo Quality</span>
                  <span>${ps}%</span>
                </div>
                <div class="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"><div class="h-1.5 rounded-full ${barColor}" style="width:${ps}%"></div></div>
                <div class="text-[10px] text-slate-400 mt-1">AI-rated photo quality (lighting, framing, clarity) — aim for 80%+. Click “Score photos” to (re)run it.</div>
                ${flags.length ? `<div class="flex flex-wrap gap-1 mt-1.5">${flags.map(f => `<span class="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">${esc(f)}</span>`).join('')}</div>` : '<div class="text-[10px] text-emerald-500 font-semibold mt-1.5"> Photos look good</div>'}
              </div>`;
            })()}
            ${v.issues.length ? `<div class="flex flex-wrap gap-1">${issueList}</div>` : '<div class="text-emerald-500 text-xs font-semibold"> No issues</div>'}
            <div class="mt-3 flex justify-end">
              <button onclick="event.stopPropagation(); editVehicle('${v.id}')" class="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Open stock card to fix →
              </button>
            </div>
          </div>`

        return `<tr class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition border-t border-slate-100 dark:border-slate-800" onclick="
          const bd = document.getElementById('${breakdownId}');
          const row = this.nextElementSibling;
          if (bd) { bd.classList.toggle('hidden'); this.querySelector('.hbd-arrow')?.classList.toggle('rotate-90'); }
        ">
          <td class="px-4 py-5">
            <div class="font-semibold text-sm text-indigo-600 dark:text-indigo-400">${stockNum}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${vehicleLine}</div>
          </td>
          <td class="px-4 py-5 text-center">
            <div class="inline-flex items-baseline gap-1">
              <span class="text-3xl font-black leading-none" style="color:${scoreColor}">${v.score}</span>
              <span class="text-xs text-slate-400 font-semibold">/100</span>
            </div>
          </td>
          <td class="px-4 py-5 text-center tabular-nums text-base text-slate-700 dark:text-slate-300">${v.photos}</td>
          <td class="px-4 py-5 text-center tabular-nums text-base font-semibold ${v.days >= 60 ? 'text-red-500' : v.days >= 30 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}">${v.days}d</td>
          <td class="px-4 py-5 text-right pr-2">
            <svg class="hbd-arrow w-4 h-4 text-slate-400 inline transition-transform duration-150" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </td>
        </tr>
        <tr class="border-0"><td colspan="5" class="p-0">${breakdownHtml}</td></tr>`
      }).join('') || '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-400">No vehicles found</td></tr>'
    }

    document.getElementById('inv-intel-content')?.classList.remove('hidden')
  }

  async function loadIntel(force = false) {
    if (_intelLoaded && !force) return
    const loading = document.getElementById('inv-intel-loading')
    const content = document.getElementById('inv-intel-content')
    loading.classList.remove('hidden')
    content.classList.add('hidden')
    try {
      const data = await authFetch(`${API}/ai/inventory-intelligence`)
      _intelData = data
      _intelLoaded = true
      renderIntel(data)
      // Fire AI narrative separately so it doesn't block the page load
      loadNarrative(data)
    } catch (err) {
      showToast('Could not load inventory intelligence: ' + err.message, 'error')
    } finally {
      loading.classList.add('hidden')
    }
  }

  async function loadNarrative(data) {
    const narEl = document.getElementById('inv-intel-narrative')
    const narList = document.getElementById('inv-intel-narrative-list')
    if (!narEl || !narList) return
    const { summary, hot_segments, cold_segments, velocity, vehicles } = data
    try {
      const payload = {
        total: summary.total,
        avg_score: summary.avg_score,
        needs_attention: summary.needs_attention,
        duplicate_vins: summary.duplicate_vins,
        hot: hot_segments.map(s => `${s.make} ${s.model} (${s.monthly_velocity}/mo, ${s.current_stock} in stock)`),
        cold: cold_segments.map(s => `${s.make} ${s.model} (${s.current_stock} units, ${s.monthly_velocity}/mo)`),
        top_movers: velocity.slice(0, 5).map(s => `${s.make} ${s.model}: ${s.sold_90d} sold`),
        no_photos: vehicles.filter(v => v.photos === 0).length,
        stale: vehicles.filter(v => v.days >= 60).length,
      }
      const result = await authFetch(`${API}/ai/inventory-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (result.narrative?.length) {
        narList.innerHTML = result.narrative.map(b => `<li class="flex gap-2 text-sm text-slate-700 dark:text-slate-300"><span class="text-indigo-500 flex-shrink-0 mt-0.5">›</span>${b}</li>`).join('')
        narEl.classList.remove('hidden')
      }
    } catch {
      // narrative is optional — fail silently
    }
  }

  // Wire refresh button
  document.getElementById('inv-intel-refresh-btn')?.addEventListener('click', () => {
    _intelLoaded = false
    loadIntel(true)
  })

  // Manage subscription button → Stripe portal
  document.getElementById('inv-intel-manage-btn')?.addEventListener('click', launchStripeLifecycle)

  window._loadIntel = loadIntel
  window._invIntelPageHook = () => loadInvIntelPage()
})()

// ── AI Assistant dock ────────────────────────────────────────────────────────
// Floating "Ask MarketSync" chat, grounded in the dealer's live data via
// POST /ai/assistant. Visibility is gated to AI Boost / Inventory Intelligence
// (owner exempt); the launcher is flipped on once /ai/config resolves — see the
// updateAiDockVisibility() call in loadAIBoostSection().
let aiDockMessages = [];
let aiDockBusy = false;
let aiDockPendingCommissionImport = null;
let __aiAssistantName = 'Intelligence';   // dealer-set internal assistant name

// Safe, small Markdown renderer for assistant replies. The previous textContent
// rendering exposed **, #, and list markers to users. Escape first, then recognize
// only a narrow readable subset; arbitrary HTML from the model can never execute.
function aiDockInline(text) {
  const links = [];
  const raw = String(text == null ? '' : text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, href) => {
    try {
      const url = new URL(href);
      if (!['http:', 'https:'].includes(url.protocol)) return label;
      const token = `@@AI_LINK_${links.length}@@`;
      links.push(`<a href="${esc(url.href)}" target="_blank" rel="noopener" class="underline text-indigo-600 dark:text-indigo-400">${esc(label)}</a>`);
      return token;
    } catch { return `${label} (${href})`; }
  });
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code class="bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded text-[.92em]">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/@@AI_LINK_(\d+)@@/g, (_match, index) => links[Number(index)] || '');
  return s;
}
function aiDockRichText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = []; let list = null; let para = [];
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushPara = () => { if (para.length) { out.push(`<p class="mb-2 last:mb-0">${para.map(aiDockInline).join('<br>')}</p>`); para = []; } };
  for (const raw of lines) {
    const line = raw.trim(); let match;
    if (!line) { flushPara(); closeList(); continue; }
    if (/^```[a-z0-9_-]*$/i.test(line)) { flushPara(); closeList(); continue; }
    if (/^([-*_])\1{2,}$/.test(line)) { flushPara(); closeList(); out.push('<hr class="my-2 border-slate-300 dark:border-slate-700">'); continue; }
    if ((match = line.match(/^#{1,6}\s+(.*)$/))) { flushPara(); closeList(); out.push(`<div class="font-bold mt-2 mb-1">${aiDockInline(match[1])}</div>`); continue; }
    if ((match = line.match(/^[-*•]\s+(.*)$/))) {
      flushPara(); if (list !== 'ul') { closeList(); out.push('<ul class="list-disc pl-5 my-2 space-y-1">'); list = 'ul'; }
      out.push(`<li>${aiDockInline(match[1])}</li>`); continue;
    }
    if ((match = line.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara(); if (list !== 'ol') { closeList(); out.push('<ol class="list-decimal pl-5 my-2 space-y-1">'); list = 'ol'; }
      out.push(`<li>${aiDockInline(match[1])}</li>`); continue;
    }
    closeList(); para.push(line);
  }
  flushPara(); closeList();
  return out.join('') || aiDockInline(text);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadProfileBranding());
  } else {
    setTimeout(() => loadProfileBranding(), 0);
  }
}