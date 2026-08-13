/* dashboard.js split part 21/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function renderAIBoostSection(cfg) {
  const badge = document.getElementById('ai-boost-badge');
  const inactive = document.getElementById('ai-boost-inactive');
  const activePanel = document.getElementById('ai-boost-active');
  if (!badge || !inactive || !activePanel) return;

  const upsellBanner = document.getElementById('ai-boost-upsell-banner');
  if (upsellBanner) {
    const isAdmin = profileContext?.role === 'DEALER_ADMIN' || profileContext?.role === 'OWNER' || profileContext?.role === 'MANAGER';
    const dismissed = (() => { try { return localStorage.getItem('ms_ai_boost_banner_dismissed') === '1'; } catch { return false; } })();
    const showBanner = isAdmin && !cfg.ai_boost_active && !dismissed;
    upsellBanner.classList.toggle('hidden', !showBanner);
    const closeBtn = document.getElementById('ai-boost-upsell-close');
    if (closeBtn && !closeBtn._wired) {
      closeBtn._wired = true;
      closeBtn.addEventListener('click', () => {
        upsellBanner.classList.add('hidden');
        try { localStorage.setItem('ms_ai_boost_banner_dismissed', '1'); } catch {}
      });
    }
  }

  // AI Boost no longer has a sidebar nav item or dedicated page — it's sold via
  // the in-context upgrade modal and configured in this Profile section.

  if (cfg.ai_boost_active) {
    badge.textContent = 'Active';
    badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500 bg-emerald-900/30 text-emerald-300';
    badge.classList.remove('hidden');
    inactive.classList.add('hidden');
    activePanel.classList.remove('hidden');

    // Pre-fill form
    const toneEl = document.getElementById('ai-tone');
    if (toneEl) toneEl.value = cfg.ai_tone || 'professional';
    const emailEl = document.getElementById('ai-manager-email');
    if (emailEl) emailEl.value = cfg.ai_manager_email || '';
    const cty = document.getElementById('ai-country'); if (cty) cty.value = (cfg.country || 'CA').toUpperCase() === 'US' ? 'US' : 'CA';
    const prov = document.getElementById('ai-province'); if (prov) prov.value = cfg.province || '';
    const cityEl = document.getElementById('ai-city'); if (cityEl) cityEl.value = cfg.city || '';
    const postal = document.getElementById('ai-postal'); if (postal) postal.value = cfg.postal_code || '';

    const reqFields = cfg.ai_required_fields || [];
    ['price', 'mileage', 'image_urls', 'description'].forEach(f => {
      const idMap = { price: 'ai-req-price', mileage: 'ai-req-mileage', image_urls: 'ai-req-photos', description: 'ai-req-description' };
      const el = document.getElementById(idMap[f]);
      if (el) el.checked = reqFields.includes(f);
    });
    // AI persona + knowledge base
    const asstName = document.getElementById('ai-assistant-name'); if (asstName) asstName.value = cfg.ai_assistant_name || '';
    const inStyle = document.getElementById('ai-internal-style'); if (inStyle) inStyle.value = cfg.ai_internal_style || '';
    const cuStyle = document.getElementById('ai-customer-style'); if (cuStyle) cuStyle.value = cfg.ai_customer_style || '';
    const kb = document.getElementById('ai-knowledge'); if (kb) kb.value = cfg.ai_knowledge || '';
    const kbName = document.getElementById('ai-kb-name'); if (kbName) kbName.textContent = cfg.ai_knowledge_name ? `Loaded: ${cfg.ai_knowledge_name}` : '';
    const costEn = document.getElementById('ai-cost-enabled'); if (costEn) costEn.checked = !!cfg.cost_tracking_enabled;
    const costRep = document.getElementById('ai-cost-rep'); if (costRep) costRep.checked = !!cfg.cost_rep_visible;
    const arMode = document.getElementById('ai-ar-mode'); if (arMode) arMode.value = cfg.autoresponder_mode || 'off';
    const arCh = document.getElementById('ai-ar-channel'); if (arCh) arCh.value = cfg.autoresponder_channel || 'email';
    renderAiAssistantMgmt(cfg);   // capabilities + access toggles
    loadAiUsage();   // fill the usage panel (today's assistant + monthly AI/market)
  } else {
    badge.textContent = 'Not Active';
    badge.className = 'text-xs font-bold px-2 py-0.5 rounded-full border border-slate-500 bg-slate-800 text-slate-400';
    badge.classList.remove('hidden');
    inactive.classList.remove('hidden');
    activePanel.classList.add('hidden');
  }
}

async function startAIBoostCheckout(btn, resetLabel) {
  btn.disabled = true;
  btn.textContent = 'Redirecting...';
  try {
    const res = await fetch(`${API}/billing/subscribe-ai-boost`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    throw new Error(data.error || 'Failed to start checkout');
  } catch (err) {
    btn.disabled = false;
    btn.textContent = resetLabel;
    alert('Could not start AI Boost checkout: ' + err.message);
  }
}

function setupAIBoostListeners() {
  document.getElementById('ai-boost-upgrade-btn')?.addEventListener('click', (e) => {
    startAIBoostCheckout(e.currentTarget, 'Start 30-Day Free Trial — $129/month after');
  });

  document.getElementById('ai-boost-upsell-btn')?.addEventListener('click', (e) => {
    startAIBoostCheckout(e.currentTarget, 'Try Free for 30 Days');
  });

  document.getElementById('ai-boost-page-upgrade-btn')?.addEventListener('click', (e) => {
    startAIBoostCheckout(e.currentTarget, 'Try Free for 30 Days');
  });
  document.getElementById('ai-boost-manage-btn')?.addEventListener('click', launchStripeLifecycle);

  document.getElementById('ai-activity-refresh')?.addEventListener('click', loadAIActivity);

  document.getElementById('ai-boost-goto-page-btn')?.addEventListener('click', () => {
    switchPage('inventory');
  });

  document.getElementById('ai-sync-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('ai-sync-all-btn');
    const status = document.getElementById('ai-sync-status');
    const statusText = document.getElementById('ai-sync-status-text');
    const progressBar = document.getElementById('ai-sync-progress-bar');
    const progressLabel = document.getElementById('ai-sync-progress-label');

    const resetBtn = () => {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Scan All Inventory`;
      if (status) status.classList.add('hidden');
      if (progressBar) progressBar.style.width = '0%';
    };

    btn.disabled = true;
    btn.textContent = 'Scanning…';
    if (status) status.classList.remove('hidden');
    if (statusText) statusText.textContent = 'Starting scan…';
    if (progressBar) progressBar.style.width = '0%';
    if (progressLabel) progressLabel.textContent = '';

    try {
      const res = await fetch(`${API}/ai/sync-all`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      const total = data.queued || 0;
      if (statusText) statusText.textContent = `Scanning ${total} vehicles…`;

      if (total === 0) { resetBtn(); return; }

      // Start the counting window slightly in the past. The rows are stamped with
      // the SERVER clock; scanStartedAt is the CLIENT clock. If the phone runs even
      // a second ahead, the first vehicle's row lands just before the window and is
      // never counted — so the bar caps one short (e.g. "161 of 162") and never
      // finishes. A 15s buffer absorbs normal clock skew.
      const scanStartedAt = new Date(Date.now() - 15000);

      // Finish either when every vehicle reported in, OR when the count stops
      // advancing for a while (backend loop is done but a row or two fell outside
      // the window) — never hang forever at 99%.
      let lastProcessed = -1;
      let lastAdvanceAt = Date.now();
      const STALL_MS = 45000;

      const finishScan = (label) => {
        clearInterval(pollInterval);
        if (statusText) statusText.textContent = label;
        if (progressBar) progressBar.style.width = '100%';
        if (progressLabel) progressLabel.textContent = `${total} of ${total} checked (100%)`;
        loadAIActivity();
        setTimeout(resetBtn, 3000);
      };

      // Poll every 3 seconds — count only activity items newer than scan start
      const pollInterval = setInterval(async () => {
        try {
          const r = await fetch(`${API}/ai/activity?limit=500`, { headers: { 'Authorization': `Bearer ${token}` } });
          const d = r.ok ? await r.json() : {};
          const processed = (d.activity || []).filter(a => new Date(a.created_at) >= scanStartedAt).length;
          if (processed > lastProcessed) { lastProcessed = processed; lastAdvanceAt = Date.now(); }
          const pct = Math.min(100, Math.round((processed / total) * 100));
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressLabel) progressLabel.textContent = `${Math.min(processed, total)} of ${total} checked (${pct}%)`;
          if (statusText) statusText.textContent = `Scanning ${total} vehicles…`;
          loadAIActivity();
          if (processed >= total) {
            finishScan(`Done — ${total} vehicles scanned`);
          } else if (processed > 0 && (Date.now() - lastAdvanceAt) > STALL_MS) {
            finishScan(`Done — ${processed} of ${total} scanned`);
          }
        } catch {}
      }, 3000);

      // Safety timeout — stop polling after 10 minutes regardless
      setTimeout(() => { clearInterval(pollInterval); resetBtn(); }, 600000);

    } catch (err) {
      resetBtn();
      showToast('Scan failed: ' + err.message, 'error');
    }
  });

  document.getElementById('ai-config-save-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('ai-config-save-btn');
    const msg = document.getElementById('ai-config-msg');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const reqFields = [];
    if (document.getElementById('ai-req-price')?.checked) reqFields.push('price');
    if (document.getElementById('ai-req-mileage')?.checked) reqFields.push('mileage');
    if (document.getElementById('ai-req-photos')?.checked) reqFields.push('image_urls');
    if (document.getElementById('ai-req-description')?.checked) reqFields.push('description');

    const payload = {
      ai_tone: document.getElementById('ai-tone')?.value || 'professional',
      ai_manager_email: document.getElementById('ai-manager-email')?.value.trim() || null,
      ai_required_fields: reqFields,
      country: document.getElementById('ai-country')?.value || 'CA',
      province: document.getElementById('ai-province')?.value.trim() || null,
      city: document.getElementById('ai-city')?.value.trim() || null,
      postal_code: document.getElementById('ai-postal')?.value.trim() || null,
      ai_assistant_name: document.getElementById('ai-assistant-name')?.value.trim() || null,
      ai_internal_style: document.getElementById('ai-internal-style')?.value.trim() || null,
      ai_customer_style: document.getElementById('ai-customer-style')?.value.trim() || null,
      ai_knowledge: document.getElementById('ai-knowledge')?.value.trim() || null,
      cost_tracking_enabled: !!document.getElementById('ai-cost-enabled')?.checked,
      cost_rep_visible: !!document.getElementById('ai-cost-rep')?.checked,
      autoresponder_mode: document.getElementById('ai-ar-mode')?.value || 'off',
      autoresponder_channel: document.getElementById('ai-ar-channel')?.value || 'email',
    };
    // Assistant capabilities/access — only send when the panel is actually shown
    // (entitled), so a non-entitled save can't blank the tool list or reps access.
    const mgmt = document.getElementById('ai-assistant-mgmt');
    if (mgmt && !mgmt.classList.contains('hidden')) {
      payload.ai_assistant_reps = !!document.getElementById('ai-assistant-reps')?.checked;
      payload.ai_tools_disabled = [...document.querySelectorAll('#ai-tools-list [data-ai-tool]')].filter(el => !el.checked).map(el => el.dataset.aiTool);
    }

    try {
      const res = await fetch(`${API}/ai/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      msg.textContent = ' Saved';
      msg.className = 'text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
      msg.classList.remove('hidden');
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'text-xs font-medium px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
      msg.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save AI Settings';
      setTimeout(() => msg.classList.add('hidden'), 4000);
    }
  });

  // Knowledge-base file upload — extract text client-side (PDF via pdf.js if present,
  // else plain read) and drop it into the KB textarea for the dealer to review + save.
  document.getElementById('ai-kb-upload-btn')?.addEventListener('click', () => document.getElementById('ai-kb-file')?.click());
  document.getElementById('ai-kb-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const nameEl = document.getElementById('ai-kb-name');
    if (file.size > 8 * 1024 * 1024) { showToast('File too large — keep it under 8MB or paste the text.', 'error'); return; }
    if (nameEl) nameEl.textContent = 'Reading ' + file.name + '…';
    try {
      let text = '';
      if (/\.pdf$/i.test(file.name)) { text = await extractPdfText(file); }
      else { text = await file.text(); }
      text = (text || '').trim();
      if (!text) { if (nameEl) nameEl.textContent = ''; showToast('Couldn’t read text from that file — paste it instead.', 'error'); e.target.value = ''; return; }
      const kb = document.getElementById('ai-knowledge');
      if (kb) kb.value = text.slice(0, 12000);
      if (nameEl) nameEl.textContent = 'Loaded: ' + file.name + ' — review, then Save AI Settings';
    } catch { if (nameEl) nameEl.textContent = ''; showToast('Could not read that file — paste the text instead.', 'error'); }
    e.target.value = '';
  });

  document.getElementById('ai-enrich-close')?.addEventListener('click', closeAIEnrichModal);
  document.getElementById('ai-enrich-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'ai-enrich-modal') closeAIEnrichModal();
  });
  document.getElementById('ai-enrich-copy-btn')?.addEventListener('click', () => {
    const text = document.getElementById('ai-enrich-copy')?.textContent;
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  });
}

function closeAIEnrichModal() {
  document.getElementById('ai-enrich-modal')?.classList.add('hidden');
}

async function openAIEnrich(inventoryId) {
  const modal = document.getElementById('ai-enrich-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('ai-enrich-loading').classList.remove('hidden');
  document.getElementById('ai-enrich-content').classList.add('hidden');
  document.getElementById('ai-enrich-error').classList.add('hidden');

  try {
    const res = await fetch(`${API}/ai/enrich-listing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ inventory_id: inventoryId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Enrichment failed');

    document.getElementById('ai-enrich-loading').classList.add('hidden');
    document.getElementById('ai-enrich-content').classList.remove('hidden');

    // Warnings
    const warningsBlock = document.getElementById('ai-enrich-warnings');
    const warningsList = document.getElementById('ai-enrich-warnings-list');
    if (data.warnings && data.warnings.length > 0) {
      warningsList.innerHTML = data.warnings.map(w => `<li>${w}</li>`).join('');
      warningsBlock.classList.remove('hidden');
    } else {
      warningsBlock.classList.add('hidden');
    }

    // Price flag
    const priceFlag = document.getElementById('ai-enrich-price-flag');
    const priceFlagText = document.getElementById('ai-enrich-price-flag-text');
    if (data.price_flag?.flagged) {
      const dir = data.price_flag.pct_diff > 0 ? 'above' : 'below';
      const pct = Math.abs(data.price_flag.pct_diff);
      priceFlagText.textContent = `This vehicle is priced ${pct}% ${dir} the median of ${data.price_flag.comp_count} comparable vehicle${data.price_flag.comp_count !== 1 ? 's' : ''} ($${Number(data.price_flag.median).toLocaleString()} median).`;
      priceFlag.classList.remove('hidden');
    } else {
      priceFlag.classList.add('hidden');
    }

    // Copy
    document.getElementById('ai-enrich-copy').textContent = data.copy || '(No copy generated)';
  } catch (err) {
    document.getElementById('ai-enrich-loading').classList.add('hidden');
    const errEl = document.getElementById('ai-enrich-error');
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  }
}

// "5 minutes ago", "2 days ago", etc — easier to scan than a date string
function friendlyAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + ' hr ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
  return date.toLocaleDateString();
}

// ── VIN Decode & PDF (VIN Sticker add-on) ────────────────────────────────────

let __vinDecodeVehicleId = null;
let __vinDecodeData = null;

function openVinDecode(vehicleId, existingVin) {
  __vinDecodeVehicleId = vehicleId;
  __vinDecodeData = null;
  const modal = document.getElementById('vin-decode-modal');
  document.getElementById('vin-decode-results').classList.add('hidden');
  document.getElementById('vin-decode-error').classList.add('hidden');
  document.getElementById('vin-decode-loading').classList.add('hidden');
  const vinLabel = document.getElementById('vin-decode-vin');
  if (vinLabel) vinLabel.textContent = existingVin ? `VIN ${existingVin}` : '';
  modal.classList.remove('hidden');
  // Auto-load the full decode from the vehicle's VIN — no manual step.
  if (existingVin && existingVin.length >= 11) runVinDecode(existingVin);
  else showVinError('This vehicle has no VIN on file to decode.');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('vin-decode-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'vin-decode-modal') e.target.classList.add('hidden');
  });

  // Branding Settings wiring
  const primaryPicker = document.getElementById('branding-primary-color');
  const primaryHex = document.getElementById('branding-primary-color-hex');
  const secondaryPicker = document.getElementById('branding-secondary-color');
  const secondaryHex = document.getElementById('branding-secondary-color-hex');

  const syncSwatch = () => {
    const p = primaryHex?.value || '#1a2e4a';
    const s = secondaryHex?.value || '#c8a84b';
    document.getElementById('branding-swatch-header')?.style.setProperty('background', p);
    document.getElementById('branding-swatch-accent')?.style.setProperty('background', s);
  };

  primaryPicker?.addEventListener('input', () => { if (primaryHex) primaryHex.value = primaryPicker.value; syncSwatch(); });
  primaryHex?.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(primaryHex.value)) { primaryPicker.value = primaryHex.value; syncSwatch(); } });
  secondaryPicker?.addEventListener('input', () => { if (secondaryHex) secondaryHex.value = secondaryPicker.value; syncSwatch(); });
  secondaryHex?.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(secondaryHex.value)) { secondaryPicker.value = secondaryHex.value; syncSwatch(); } });

  document.getElementById('branding-logo-input')?.addEventListener('change', uploadBrandingLogo);
  document.getElementById('branding-save-btn')?.addEventListener('click', saveBrandingSettings);
});

async function runVinDecode(vinArg) {
  const vin = String(vinArg || '').trim().toUpperCase();
  if (!vin || vin.length < 11) {
    showVinError('This vehicle has no VIN on file to decode.');
    return;
  }
  const token = localStorage.getItem('token');
  document.getElementById('vin-decode-loading').classList.remove('hidden');
  document.getElementById('vin-decode-results').classList.add('hidden');
  document.getElementById('vin-decode-error').classList.add('hidden');
  try {
    const res = await fetch(`${API}/vin/decode/${encodeURIComponent(vin)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Decode failed');
    __vinDecodeData = data;
    renderVinResults(data);

    // Persist the recall check to this vehicle so its Inventory card stops saying
    // "not checked yet" and shows /. Only stores vin_data + recalls — it does not
    // overwrite the vehicle's year/make/model.
    if (__vinDecodeVehicleId) {
      const recalls = Array.isArray(data.recalls) ? data.recalls : [];
      fetch(`${API}/vin/apply/${__vinDecodeVehicleId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ decoded: { vin_data: data.decoded?.vin_data ?? null }, recalls }),
      }).then(() => {
        const v = (typeof __catalogCache !== 'undefined' ? __catalogCache : []).find(x => x.id === __vinDecodeVehicleId);
        if (v) { v.recalls = recalls; v.recalls_checked_at = new Date().toISOString(); if (typeof renderCatalog === 'function') renderCatalog(); }
      }).catch(() => {});
    }
  } catch (e) {
    showVinError(e.message);
  } finally {
    document.getElementById('vin-decode-loading').classList.add('hidden');
  }
}

function showVinError(msg) {
  const el = document.getElementById('vin-decode-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function renderVinResults({ decoded, recalls, all_fields }) {
  const grid = document.getElementById('vin-decoded-grid');
  const escv = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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

  const card = (label, value) => `
    <div class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
      <div class="text-xs text-slate-400 uppercase tracking-wide">${escv(label)}</div>
      <div class="text-sm font-bold text-slate-900 dark:text-white mt-0.5">${escv(value)}</div>
    </div>`;

  // Summary tiles up top, then EVERY field NHTSA returned (full deep dive).
  let html = coreFields.map(([l, v]) => card(l, v)).join('');
  const all = Array.isArray(all_fields) ? all_fields : [];
  if (all.length) {
    html += `<div class="col-span-2 sm:col-span-3 mt-1 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-widest">Full Build Data — ${all.length} fields (NHTSA)</div>`;
    html += all.map(f => card(f.label, f.value)).join('');
  }
  grid.innerHTML = html;

  const recallSection = document.getElementById('vin-recalls-section');
  const recallHeader = document.getElementById('vin-recalls-header');
  const recallList = document.getElementById('vin-recalls-list');
  if (recalls?.length) {
    recallHeader.innerHTML = `<span class="text-red-600 dark:text-red-400"> ${recalls.length} Open Recall${recalls.length > 1 ? 's' : ''}</span>`;
    recallList.innerHTML = recalls.map(r => `
      <div class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs">
        <div class="font-bold text-red-700 dark:text-red-400">${r.Component || 'Component'}</div>
        <div class="text-slate-600 dark:text-slate-400 mt-1">${r.Summary || r.Consequence || ''}</div>
        ${r.Remedy ? `<div class="text-emerald-700 dark:text-emerald-400 mt-1 font-medium">Remedy: ${r.Remedy}</div>` : ''}
      </div>`).join('');
    recallSection.classList.remove('hidden');
  } else {
    recallHeader.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400"> No open recalls found</span>`;
    recallList.innerHTML = '';
    recallSection.classList.remove('hidden');
  }

  document.getElementById('vin-decode-results').classList.remove('hidden');
}

async function generatePdf(vehicleId, type, btn, opts = {}) {
  const token = localStorage.getItem('token');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating…';
  const label = type === 'window-sticker' ? 'Window Sticker' : 'Brochure';
  // oemOnly = fetch the factory sticker only (no fallback); forceGenerate = branded.
  const genQuery = opts.oemOnly ? '?source=oem'
    : opts.forceGenerate ? '?source=generate&regen=1' : '';
  // Status polling must check the SAME variant's cache (OEM vs generated).
  const statusQuery = opts.oemOnly ? '?source=oem' : '?source=generate';

  const openUrl = (url, source) => {
    window.open(url, '_blank');
    // For window stickers, tell the dealer whether it's the authentic factory
    // document or one we generated.
    let msg = `${label} ready — opened in new tab`;
    if (type === 'window-sticker') {
      msg = source === 'oem'
        ? 'Official manufacturer window sticker — opened in new tab'
        : 'MarketSync-generated window sticker — opened in new tab';
    }
    showToast(msg, 'success');
    btn.disabled = false;
    btn.textContent = origText;
  };

  const pollStatus = async (deadline) => {
    if (Date.now() > deadline) {
      showToast(`${label} is still generating — check back in a minute and click again to open it`, 'info', 8000);
      btn.disabled = false;
      btn.textContent = origText;
      return;
    }
    try {
      const r = await fetch(`${API}/pdf/${type}/${vehicleId}/status${statusQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const d = await r.json();
      if (d.status === 'ready' && d.url) {
        openUrl(d.url, d.source);
      } else {
        setTimeout(() => pollStatus(deadline), 4000);
      }
    } catch {
      setTimeout(() => pollStatus(deadline), 4000);
    }
  };

  try {
    showToast(`Generating ${label} — this takes 15–30 seconds on first run…`, 'info', 35000);
    const res = await fetch(`${API}/pdf/${type}/${vehicleId}${genQuery}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    // OEM-only requested but none exists → offer to generate one instead.
    if (res.status === 404 && data.error === 'no_oem') {
      btn.disabled = false;
      btn.textContent = origText;
      showNoOemPrompt(vehicleId, btn, type);
      return;
    }
    if (!res.ok) throw new Error(data.error || 'PDF generation failed');
    if (data.url) {
      // Cached — open immediately
      openUrl(data.url, data.source);
    } else {
      // Generation started — poll for completion (150s deadline)
      pollStatus(Date.now() + 150_000);
    }
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = origText;
  }
}

// Shown when "Get OEM" finds no factory document — explains and offers to generate
// a branded dealer one instead. Works for both window stickers and brochures.
function showNoOemPrompt(vehicleId, btn, type = 'window-sticker') {
  const isBrochure = type === 'brochure';
  const noun = isBrochure ? 'brochure' : 'window sticker';
  const genLabel = isBrochure ? 'Generate Dealer Brochure' : 'Generate Dealer Sticker';
  const detail = isBrochure
    ? "There's no manufacturer brochure on file for this vehicle (factory brochures are available up to 2023). You can generate a branded dealer brochure instead."
    : "There's no authentic OEM window sticker available for this VIN. You can generate a branded dealer sticker instead.";
  document.getElementById('no-oem-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'no-oem-modal';
  modal.className = 'fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl text-center">
      <div class="w-11 h-11 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-3">
        <svg class="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
      </div>
      <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">No factory ${noun} found</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">${detail}</p>
      <button data-act="generate" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5">
        ${genLabel} <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
      </button>
      <button data-act="cancel" class="mt-2.5 w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1.5 transition">Cancel</button>
    </div>`;
  const close = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target === modal) return close();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    close();
    if (act === 'generate') {
      if (!__aiDocsActive) { openUpgradeModal('ai_boost'); return; }
      generatePdf(vehicleId, type, btn, { forceGenerate: true });
    }
  });
  document.body.appendChild(modal);
}

// Brochure button → OEM (factory brochure from Auto-Brochures) vs generated dealer
// brochure. Mirrors the sticker choice.
function showBrochureChoice(btn) {
  const id = btn.dataset.id;
  const label = btn.dataset.label || 'this vehicle';
  const oemUrl = btn.dataset.oemUrl || '';
  const genUrl = btn.dataset.genUrl || '';
  const savedTag = '<span class="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded">Saved</span>';
  document.getElementById('brochure-choice-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'brochure-choice-modal';
  modal.className = 'fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6 shadow-2xl">
      <h3 class="text-base font-bold text-slate-900 dark:text-white mb-1">Brochure</h3>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate" title="${label}">${label} — OEM &amp; AI brochures save separately.</p>
      <div class="space-y-2.5">
        <button data-choice="oem" class="w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition">
          <div class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">${oemUrl ? 'View OEM Brochure' : 'Get OEM Brochure'} ${oemUrl ? savedTag : ''}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${oemUrl ? 'Open your saved factory brochure.' : 'Pull the authentic manufacturer sales brochure (available up to 2023).'}</div>
        </button>
        <button data-choice="generate" class="w-full text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition ${__aiDocsActive ? '' : 'opacity-70'}">
          <div class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">${genUrl ? 'View Dealer Brochure' : 'Generate Dealer Brochure'} <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg> ${genUrl ? savedTag : (__aiDocsActive ? '' : '<span class="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 px-1.5 py-0.5 rounded">AI Boost</span>')}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${genUrl ? 'Open your saved branded brochure, or regenerate.' : 'Build a branded MarketSync brochure.'}${(!genUrl && !__aiDocsActive) ? ' Included with AI Boost.' : ''}</div>
        </button>
        ${genUrl ? '<button data-choice="regen" class="w-full text-center text-xs font-bold text-indigo-500 hover:text-indigo-400 py-1 transition">↻ Regenerate dealer brochure</button>' : ''}
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
    if (choice === 'oem') { if (oemUrl) window.open(oemUrl, '_blank'); else generatePdf(id, 'brochure', btn, { oemOnly: true }); }
    else if (choice === 'generate') { if (genUrl) window.open(genUrl, '_blank'); else generatePdf(id, 'brochure', btn, { forceGenerate: true }); }
    else if (choice === 'regen') generatePdf(id, 'brochure', btn, { forceGenerate: true });
  });
  document.body.appendChild(modal);
}

async function loadBrandingSettings() {
  // The old AI Boost branding card was removed — branding is now managed in
  // Profile & Settings (loadProfileBranding / prof-brand-*). If those legacy
  // elements aren't in the DOM, there's nothing to populate here.
  if (!document.getElementById('branding-primary-color')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API}/branding`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    const b = data.branding || {};
    if (b.primary_color) {
      document.getElementById('branding-primary-color').value = b.primary_color;
      document.getElementById('branding-primary-color-hex').value = b.primary_color;
      document.getElementById('branding-swatch-header')?.style.setProperty('background', b.primary_color);
    }
    if (b.secondary_color) {
      document.getElementById('branding-secondary-color').value = b.secondary_color;
      document.getElementById('branding-secondary-color-hex').value = b.secondary_color;
      document.getElementById('branding-swatch-accent')?.style.setProperty('background', b.secondary_color);
    }
    if (b.tagline) document.getElementById('branding-tagline').value = b.tagline;
    if (b.logo_url) {
      const preview = document.getElementById('branding-logo-preview');
      preview.innerHTML = `<img src="${b.logo_url}" alt="Logo" class="max-h-full max-w-full object-contain p-2">`;
    }
  } catch {}
}

async function uploadBrandingLogo() {
  const file = document.getElementById('branding-logo-input').files[0];
  if (!file) return;
  const token = localStorage.getItem('token');
  const msg = document.getElementById('branding-save-msg');
  const formData = new FormData();
  formData.append('logo', file);
  try {
    const res = await fetch(`${API}/branding/logo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    const preview = document.getElementById('branding-logo-preview');
    preview.innerHTML = `<img src="${data.url}" alt="Logo" class="max-h-full max-w-full object-contain p-2">`;
    showBrandingMsg(' Logo uploaded', true);
  } catch (e) {
    showBrandingMsg(e.message, false);
  }
}

async function saveBrandingSettings() {
  const token = localStorage.getItem('token');
  const payload = {
    primary_color: document.getElementById('branding-primary-color-hex')?.value || '',
    secondary_color: document.getElementById('branding-secondary-color-hex')?.value || '',
    tagline: document.getElementById('branding-tagline')?.value || '',
  };
  try {
    const res = await fetch(`${API}/branding`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    showBrandingMsg(' Branding saved', true);
  } catch (e) {
    showBrandingMsg(e.message, false);
  }
}

function showBrandingMsg(text, ok) {
  const el = document.getElementById('branding-save-msg');
  el.textContent = text;
  el.className = `text-xs font-medium px-2.5 py-1 rounded-md ${ok ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── VIN Sticker & Brochure page ───────────────────────────────────────────────

function initVinStickerPage() {
  renderVinStickerNav();
  renderInvIntelNav();
  loadVinStickerPage();

  document.getElementById('vin-page-decode-btn')?.addEventListener('click', runVinPageDecode);
  document.getElementById('vin-page-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runVinPageDecode();
  });
  document.getElementById('vin-sticker-page-upgrade-btn')?.addEventListener('click', startVinStickerTrial);
  document.getElementById('vin-sticker-manage-btn')?.addEventListener('click', launchStripeLifecycle);
}

function renderVinStickerNav() {
  const btn = document.getElementById('nav-vin-sticker');
  const pill = document.getElementById('nav-vin-sticker-pill');
  if (!btn) return;

  // Show for everyone (roles: admins + dealer reps). The hidden class was set
  // by the pre-render CSS; now that config is loaded we can reveal it.
  btn.classList.remove('hidden');

  if (__vinStickerActive) {
    btn.classList.remove('text-slate-400', 'dark:text-slate-600');
    btn.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    if (pill) pill.classList.add('hidden');
  } else {
    btn.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    if (pill) pill.classList.remove('hidden');
  }

  if (!btn._clickWired) {
    btn._clickWired = true;
    btn.addEventListener('click', () => switchPage('vin-sticker'));
  }
}

function renderInvIntelNav() {
  const btn = document.getElementById('nav-inv-intel');
  if (!btn) return;
  const isAdmin = profileContext?.role === 'DEALER_ADMIN' || profileContext?.role === 'OWNER' || profileContext?.role === 'MANAGER';
  if (!isAdmin) { btn.classList.add('hidden'); return; }

  btn.classList.remove('hidden');
  const pill = document.getElementById('nav-inv-intel-pill');
  if (__invIntelActive) {
    btn.classList.remove('text-slate-400', 'dark:text-slate-600');
    btn.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    if (pill) pill.classList.add('hidden');
  } else {
    btn.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
    if (pill) pill.classList.remove('hidden');
  }

  if (!btn._clickWired) {
    btn._clickWired = true;
    // Group header: the name only expands/collapses the dropdown now — the
    // "Pricing & Acquisition" sub-item is what navigates to the page.
    btn.addEventListener('click', () => toggleNavGroup('ii'));
  }
}

async function loadVinStickerPage() {
  const upsell = document.getElementById('vin-sticker-page-upsell');
  const active = document.getElementById('vin-sticker-active-content');
  if (!upsell || !active) return;

  if (__vinStickerActive) {
    upsell.classList.add('hidden');
    active.classList.remove('hidden');
    loadVinStickerInventory();
  } else {
    upsell.classList.remove('hidden');
    active.classList.add('hidden');
  }
}

function renderInvIntelSidebar(cfg) {
  const badge = document.getElementById('inv-intel-badge');
  const inactive = document.getElementById('inv-intel-sidebar-inactive');
  const activeEl = document.getElementById('inv-intel-sidebar-active');
  if (!badge || !inactive || !activeEl) return;

  if (__invIntelActive) {
    const trialEnd = cfg?.inv_intel_trial_ends_at;
    const inTrial = trialEnd && new Date(trialEnd) > new Date();
    badge.textContent = inTrial ? 'Trial' : 'Active';
    badge.className = `text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${inTrial ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'}`;
    badge.classList.remove('hidden');
    inactive.classList.add('hidden');
    activeEl.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    inactive.classList.remove('hidden');
    activeEl.classList.add('hidden');
  }
}

// Market & Competitors — its own page (was a section inside Inventory Intelligence).
// Gated the same way: show the upsell unless the dealer has Inventory Intelligence.
function loadMarketPage() {
  const upsell = document.getElementById('market-upsell');
  const content = document.getElementById('market-content');
  if (!upsell || !content) return;
  if (__invIntelActive) {
    upsell.classList.add('hidden');
    content.classList.remove('hidden');
    loadCompetitors();   // nearby-lot list + comparison
    loadLotOverview();   // "Your lot" mini-stats for side-by-side
    loadMarketcheckStatus?.();
  } else {
    upsell.classList.remove('hidden');
    content.classList.add('hidden');
  }
}

function loadInvIntelPage() {
  const upsell = document.getElementById('inv-intel-page-upsell');
  const active = document.getElementById('inv-intel-active-content');
  if (!upsell || !active) return;

  if (__invIntelActive) {
    upsell.classList.add('hidden');
    active.classList.remove('hidden');
    if (typeof window._loadIntel === 'function') window._loadIntel();
    loadStockingRecommendations(false);
    loadMarketcheckStatus();
    loadAIActivity();   // Inventory Scan now lives on this page
    loadLotOverview();  // Your Lot at a Glance
    loadDigestToggle(); // Daily briefing email opt-in
  } else {
    upsell.classList.remove('hidden');
    active.classList.add('hidden');
  }
}

// Show whether the licensed MarketCheck feed is connected & live, so the dealer can
// tell at a glance that pricing/competitor data is using real data (not the scraper).
async function loadMarketcheckStatus() {
  const el = document.getElementById('marketcheck-status');
  if (!el) return;
  let s;
  try {
    const r = await fetch(`${API}/ai/marketcheck-status`, { headers: { 'Authorization': `Bearer ${token}` } });
    s = await r.json();
  } catch { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const dot = (c) => `<span class="w-2 h-2 rounded-full ${c} flex-shrink-0"></span>`;
  if (!s.configured) {
    el.className = 'text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200';
    el.innerHTML = `${dot('bg-amber-500')} MarketCheck not connected — pricing & competitor data fall back to an AI estimate. Add MARKETCHECK_API_KEY in your Render backend environment for live market data.`;
  } else if (s.ok) {
    el.className = 'text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200';
    el.innerHTML = `${dot('bg-emerald-500')} MarketCheck connected — live market data is active${s.sample_found ? ` (test query returned ${Number(s.sample_found).toLocaleString()} comps)` : ''}.`;
  } else if (s.status === 429) {
    el.className = 'text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200';
    el.innerHTML = `${dot('bg-amber-500')} MarketCheck key is active (rate limit reached / HTTP 429). Comps will refresh automatically as rate limits reset.`;
  } else {
    el.className = 'text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200';
    el.innerHTML = `${dot('bg-red-500')} MarketCheck key is set but the test call failed${s.status ? ` (HTTP ${s.status})` : ''}. Check the key or your plan/endpoint access.`;
  }
}

async function startInvIntelCheckout() {
  const btn = document.getElementById('inv-intel-page-upgrade-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Opening checkout…';
  try {
    const res = await fetch(`${API}/billing/subscribe-inv-intel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    window.location.href = data.url;
  } catch (e) {
    alert(e.message);
    btn.disabled = false;
    btn.textContent = 'Start 30-Day Free Trial';
  }
}

function setupInvIntelListeners() {
  document.getElementById('inv-intel-page-upgrade-btn')?.addEventListener('click', startInvIntelCheckout);
  document.getElementById('inv-intel-upgrade-btn')?.addEventListener('click', startInvIntelCheckout);
  document.getElementById('inv-intel-goto-page-btn')?.addEventListener('click', () => switchPage('inv-intel'));
}

// ── AI Vision ──────────────────────────────────────────────────────────────
function renderAiVisionNav() {
  const btn = document.getElementById('nav-ai-vision');
  if (!btn) return;
  const isAdmin = profileContext?.role === 'DEALER_ADMIN' || profileContext?.role === 'OWNER' || profileContext?.role === 'MANAGER';
  if (!isAdmin) { btn.classList.add('hidden'); return; }
  btn.classList.remove('hidden');
  btn.classList.add('text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
  document.getElementById('nav-ai-vision-pill')?.classList.toggle('hidden', __aiVisionActive);
  if (!btn._clickWired) { btn._clickWired = true; btn.addEventListener('click', () => switchPage('ai-vision')); }
}

// AI Vision is part of AI Boost — open the AI Boost purchase modal to subscribe.
function startAiVisionCheckout() {
  openUpgradeModal('ai_boost');
}

function scoreColor(s) {
  if (s >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function renderAiVisionResults(data) {
  const stats = document.getElementById('ai-vision-stats');
  const list = document.getElementById('ai-vision-list');
  if (!stats || !list) return;
  const s = data.summary || {};
  const tile = (label, val, cls = '') => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3">
      <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">${label}</div>
      <div class="text-xl font-black mt-0.5 ${cls}">${val}</div>
    </div>`;
  stats.innerHTML = [
    tile('Avg photo score', s.avg_score != null ? `${s.avg_score}` : '—', s.avg_score != null ? scoreColor(s.avg_score) : ''),
    tile('Need attention', s.needs_attention ?? 0, 'text-red-600 dark:text-red-400'),
    tile('No photos', s.no_photos ?? 0, (s.no_photos ? 'text-red-600 dark:text-red-400' : '')),
    tile('Scanned', `${s.scored ?? 0}/${s.total ?? 0}`),
  ].join('');

  const vehicles = data.vehicles || [];
  if (!vehicles.length) {
    list.innerHTML = '<div class="px-5 py-10 text-center text-sm text-slate-400 italic">No scored listings yet — run a scan.</div>';
    return;
  }
  list.innerHTML = vehicles.map(v => {
    const flags = (v.flags || []).map(f => `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">${esc(f)}</span>`).join(' ');
    const thumb = v.thumb
      ? `<img src="${esc(v.thumb)}" alt="" class="w-14 h-14 rounded object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-800">`
      : `<div class="w-14 h-14 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">${svgIcon('car', 'w-6 h-6')}</div>`;
    return `
      <div class="px-5 py-3.5 flex items-center gap-3.5">
        ${thumb}
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-slate-900 dark:text-white truncate">${esc(v.label)}${v.stocknumber ? ` <span class="text-slate-400 font-normal">· #${esc(v.stocknumber)}</span>` : ''}</div>
          <div class="text-xs text-slate-400 mt-0.5">${v.photo_count} photo${v.photo_count === 1 ? '' : 's'}</div>
          ${flags ? `<div class="flex flex-wrap gap-1 mt-1.5">${flags}</div>` : ''}
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-2xl font-black ${scoreColor(v.score)}">${v.score}</div>
          <div class="text-[10px] uppercase font-bold tracking-wider text-slate-400">/100</div>
        </div>
      </div>`;
  }).join('');
}

async function loadAiVisionResults() {
  try {
    const res = await fetch(`${API}/ai/vision/results`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    renderAiVisionResults(await res.json());
  } catch {}
}

let __aiVisionScanning = false;
// "Score photos" button inside Vehicle Health Scores — runs the same AI Vision scan
// and refreshes the health table so the new photo grades show inline (no separate page).
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('health-score-photos-btn');
  if (!b) return;
  b.addEventListener('click', async () => {
    if (b._busy) return;
    b._busy = true; b.disabled = true;
    const orig = b.textContent; b.textContent = 'Scoring photos…';
    try {
      const res = await fetch(`${API}/ai/vision/scan`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      const total = data.total || 0;
      if (!total) { showToast('All photos are already scored.', 'info'); }
      else { showToast(`Scoring photos on ${total} listing${total === 1 ? '' : 's'} — refresh in a moment to see grades fill in.`, 'info', 6000); }
      try { if (typeof loadIntel === 'function') await loadIntel(true); } catch {}
      // Refresh again after the background batch has had time to run.
      if (total > (data.scored_now || 0)) setTimeout(() => { try { loadIntel(true); } catch {} }, 20000);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      b._busy = false; b.disabled = false; b.textContent = orig;
    }
  });
});

async function runAiVisionScan() {
  const btn = document.getElementById('ai-vision-scan-btn');
  if (!btn || __aiVisionScanning) return;
  __aiVisionScanning = true;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.textContent = 'Scanning…';
  try {
    const res = await fetch(`${API}/ai/vision/scan`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Scan failed');
    const total = data.total || 0;
    if (!total) { showToast('All photos are already scored — nothing new to scan.', 'info'); await loadAiVisionResults(); return; }
    // The first few were scored synchronously — show them right away.
    await loadAiVisionResults();
    if (total <= (data.scored_now || 0)) { showToast(`Scored ${total} listing${total === 1 ? '' : 's'}.`, 'info'); return; }
    showToast(`Scanning photos on ${total} listing${total === 1 ? '' : 's'} — the rest fills in over the next couple of minutes.`, 'info', 6000);
    // Poll results for ~2 min as the background scan fills in scores.
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 6000));
      await loadAiVisionResults();
    }
  } catch (e) {
    showToast(e.message, 'error');
  } finally {
    __aiVisionScanning = false;
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

function loadAiVisionPage() {
  const upsell = document.getElementById('ai-vision-page-upsell');
  const active = document.getElementById('ai-vision-active-content');
  if (!upsell || !active) return;
  if (__aiVisionActive) {
    upsell.classList.add('hidden');
    active.classList.remove('hidden');
    loadAiVisionResults();
  } else {
    upsell.classList.remove('hidden');
    active.classList.add('hidden');
  }
}

function setupAiVisionListeners() {
  document.getElementById('ai-vision-upgrade-btn')?.addEventListener('click', startAiVisionCheckout);
  document.getElementById('ai-vision-scan-btn')?.addEventListener('click', runAiVisionScan);
}

async function loadVinStickerInventory() {
  const loading = document.getElementById('vin-sticker-inventory-loading');
  const empty = document.getElementById('vin-sticker-inventory-empty');
  const list = document.getElementById('vin-sticker-inventory-list');
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API}/inventory/all`, { headers: { 'Authorization': `Bearer ${token}` } });
    const vehicles = await res.json();
    if (!res.ok) throw new Error(vehicles?.error || `HTTP ${res.status}`);
    loading.classList.add('hidden');
    if (!vehicles.length) { empty.classList.remove('hidden'); return; }

    list.innerHTML = vehicles.map(v => {
      const label   = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
      const price   = v.price   ? `$${Number(v.price).toLocaleString()}` : 'No price';
      const mileage = v.mileage ? `${Number(v.mileage).toLocaleString()} km` : (v.condition === 'new' ? 'New' : '');
      const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

      const recallBadge = v.recalls?.length
        ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded px-1.5 py-0.5"> ${v.recalls.length} recall${v.recalls.length > 1 ? 's' : ''}</span>`
        : (v.recalls_checked_at ? `<span class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5"> No recalls</span>` : '');

      const hasVin      = !!(v.vin_data);
      const hasSticker  = !!(v.window_sticker_oem_url || v.window_sticker_gen_url || v.window_sticker_url);
      const hasBrochure = !!(v.brochure_oem_url || v.brochure_gen_url || v.brochure_url);
      const allDone     = hasVin && hasSticker && hasBrochure;

      const statusDot = allDone
        ? `<div class="w-1.5 self-stretch rounded-full bg-purple-500 flex-shrink-0" title="VIN decoded · Sticker · Brochure — all complete"></div>`
        : hasSticker
          ? `<div class="w-1.5 self-stretch rounded-full bg-emerald-500 flex-shrink-0" title="Window sticker generated"></div>`
          : `<div class="w-1.5 self-stretch rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0"></div>`;

      const cardBg = allDone
        ? 'bg-purple-50/40 dark:bg-purple-950/10'
        : hasSticker
          ? 'bg-emerald-50/40 dark:bg-emerald-950/10'
          : '';

      // Status communicated via action button states — no separate badge row needed

      // Spec detail is available in the VIN Decode modal, so we keep the card
      // clean and don't repeat it here.
      const chips = '';

      const vinBtnCls = hasVin
        ? 'bg-emerald-50 dark:bg-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-800/60 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
      const vinBtnLabel = hasVin ? `&#10003; VIN` : `VIN`;
      const decodeBtn = `<button class="vs-decode-btn text-xs ${vinBtnCls} px-3 py-1.5 rounded-lg transition font-semibold" data-id="${v.id}" data-vin="${v.vin || ''}">${vinBtnLabel}</button>`;

      const stickerBtnCls   = hasSticker ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500';
      const stickerBtnLabel = hasSticker ? `&#10003; Sticker` : `Sticker`;
      const brochureBtnCls  = hasBrochure ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-500';
      const brochureBtnLabel = hasBrochure ? `&#10003; Brochure` : `Brochure`;

      const thumbUrl = v.image_urls?.[0] || null;
      const thumbHtml = thumbUrl
        ? `<div class="flex-shrink-0 w-24 h-16 bg-slate-900 dark:bg-slate-950 overflow-hidden rounded-sm self-center"><img src="${thumbUrl}" alt="" class="w-full h-full object-contain" loading="lazy"></div>`
        : `<div class="flex-shrink-0 w-24 h-16 bg-slate-100 dark:bg-slate-800 rounded-sm self-center flex items-center justify-center"><span class="text-slate-400 dark:text-slate-600 text-xs">No photo</span></div>`;

      return `<li class="flex gap-0 border-b border-slate-100 dark:border-slate-800 last:border-0 ${cardBg}">
        ${statusDot}
        <div class="flex-1 px-3 py-3">
          <div class="flex gap-3 items-start">
            ${thumbHtml}
            <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-start gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-bold text-slate-900 dark:text-white">${label}</span>
                ${v.stocknumber ? `<span class="text-xs font-mono text-slate-400 dark:text-slate-500">#${v.stocknumber}</span>` : ''}
                ${recallBadge}
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span class="font-semibold text-slate-700 dark:text-slate-200">${price}</span>
                ${mileage ? `<span>· ${mileage}</span>` : ''}
                ${v.vin ? `<span class="font-mono text-slate-400 dark:text-slate-500">${v.vin}</span>` : ''}
              </div>
              ${chips ? `<div class="flex flex-wrap gap-1 mt-1.5">${chips}</div>` : ''}
            </div>
            <div class="flex gap-2 flex-shrink-0 items-start pt-0.5">
              ${decodeBtn}
              <button class="vs-sticker-btn text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition font-bold" data-id="${v.id}" data-label="${label.replace(/"/g, '&quot;')}" data-oem-url="${v.window_sticker_oem_url || ''}" data-gen-url="${v.window_sticker_gen_url || ''}">${stickerBtnLabel} ▾</button>
              <button class="vs-brochure-btn text-xs ${brochureBtnCls} text-white px-3 py-1.5 rounded-lg transition font-bold" data-id="${v.id}" data-label="${label.replace(/"/g, '&quot;')}" data-oem-url="${v.brochure_oem_url || ''}" data-gen-url="${v.brochure_gen_url || ''}">${brochureBtnLabel} ▾</button>
            </div>
            </div>
          </div>
        </div>
      </li>`;
    }).join('');
    list.classList.remove('hidden');

    list.querySelectorAll('.vs-decode-btn').forEach(btn => {
      btn.addEventListener('click', () => openVinDecode(btn.dataset.id, btn.dataset.vin));
    });
    list.querySelectorAll('.vs-sticker-btn').forEach(btn => {
      btn.addEventListener('click', () => showStickerChoice(btn));
    });
    list.querySelectorAll('.vs-brochure-btn').forEach(btn => {
      btn.addEventListener('click', () => showBrochureChoice(btn));
    });
  } catch {
    loading.textContent = 'Failed to load inventory.';
  }
}