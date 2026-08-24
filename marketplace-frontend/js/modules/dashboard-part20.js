/* dashboard.js split part 20/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// ── AI BOOST ────────────────────────────────────────────────────────────────

let __aiBoostActive = false;
let __aiBoostConfigLoaded = false;
let __vinStickerActive = false;   // VIN decode + OEM docs — core (always true)
let __aiDocsActive = false;       // generated/branded sticker & brochure — AI Boost
let __invIntelActive = true;
let __aiVisionActive = false;     // now equals AI Boost

async function loadAIActivity() {
  const loading = document.getElementById('ai-activity-loading');
  const empty = document.getElementById('ai-activity-empty');
  const errorEl = document.getElementById('ai-activity-error');
  const list = document.getElementById('ai-activity-list');
  const countEl = document.getElementById('ai-activity-count');
  // Inventory Scan now lives on the Inventory page and is part of the Inventory
  // Intelligence add-on. Toggle the scan controls/results vs the upgrade CTA.
  const controls = document.getElementById('inv-scan-controls');
  const activeWrap = document.getElementById('inv-scan-active');
  const upsell = document.getElementById('inv-scan-upsell');

  __aiBoostConfigLoaded = true;
  if (controls) controls.classList.remove('hidden');
  if (activeWrap) activeWrap.classList.remove('hidden');
  if (upsell) upsell.classList.add('hidden');

  loadScanUsage();

  if (!list) return;

  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  list.classList.add('hidden');

  try {
    const res = await fetch(`${API}/ai/activity`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load activity');

    const items = data.activity || [];
    if (loading) loading.classList.add('hidden');

    // Summary stats
    const totalEl = document.getElementById('ai-stat-total');
    const warnEl = document.getElementById('ai-stat-warnings');
    const priceEl = document.getElementById('ai-stat-price-flags');
    const copyEl = document.getElementById('ai-stat-copies');
    if (totalEl) totalEl.textContent = items.length;
    if (warnEl) warnEl.textContent = items.filter(i => i.warnings?.length > 0).length;
    if (priceEl) priceEl.textContent = items.filter(i => i.price_flagged).length;
    if (copyEl) copyEl.textContent = items.filter(i => i.copy_generated).length;

    if (items.length === 0) { if (empty) empty.classList.remove('hidden'); return; }

    __aiActivityItems = items;
    renderAiActivity();
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
  }
}

// Today's Briefing — AI daily operator digest on the Insights (home) page.
async function loadDailyDigest() {
  const card = document.getElementById('daily-digest');
  if (!card) return;
  try {
    const r = await fetch(`${API}/ai/daily-digest`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return;
    const d = await r.json();
    const summaryEl = document.getElementById('digest-summary');
    const itemsEl = document.getElementById('digest-items');
    const dateEl = document.getElementById('digest-date');
    if (dateEl && d.date) dateEl.textContent = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    if (summaryEl) summaryEl.textContent = d.summary || '';
    if (itemsEl) {
      itemsEl.innerHTML = (d.items || []).map(it =>
        `<button type="button" class="digest-item flex items-center gap-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-full transition" data-page="${esc(it.page)}"><span class="text-indigo-500">${svgIcon('chevronRight', 'w-3 h-3')}</span>${esc(it.text)}</button>`
      ).join('');
      itemsEl.querySelectorAll('.digest-item').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.page)));
    }
    card.classList.remove('hidden');
  } catch {}
}

// Daily briefing email opt-in toggle (Reports & Alerts section).
async function loadDigestToggle() {
  const el = document.getElementById('daily-digest-toggle');
  if (!el) return;
  try {
    const r = await fetch(`${API}/ai/config`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (r.ok) { const cfg = await r.json(); el.checked = cfg.daily_digest_enabled !== false; }
  } catch {}
  if (!el._wired) {
    el._wired = true;
    el.addEventListener('change', async () => {
      try {
        const r = await fetch(`${API}/ai/config`, {
          method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_digest_enabled: el.checked }),
        });
        if (!r.ok) throw new Error();
        showToast(el.checked ? 'Daily briefing email on' : 'Daily briefing email off', 'success');
      } catch { el.checked = !el.checked; showToast('Could not save that', 'error'); }
    });
  }
}

// Your Lot at a Glance — vehicle count + price range for competitor comparison.
async function loadLotOverview() {
  const countEl = document.getElementById('lot-ov-count');
  if (!countEl) return;
  try {
    const inv = await apiGetJson('/inventory/all', { retries: 1 });
    const avail = (inv || []).filter(v => String(v.status || 'available').toLowerCase() === 'available');
    const prices = avail.map(v => Number(v.price)).filter(p => p > 0).sort((a, b) => a - b);
    const money = n => '$' + Math.round(n).toLocaleString();
    const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
    const rangeTxt = prices.length ? `${money(prices[0])}–${money(prices[prices.length - 1])}` : '—';
    const avgTxt = prices.length ? money(prices.reduce((a, b) => a + b, 0) / prices.length) : '—';
    set('lot-ov-count', avail.length.toLocaleString());
    set('lot-ov-range', rangeTxt);
    set('lot-ov-avg', avgTxt);
    // Model year cannot determine condition: a current-year demo or trade is still used.
    const isNew = v => String(v.condition || '').trim().toLowerCase() === 'new';
    const nu = avail.filter(isNew).length;
    set('lot-ov-split', `${nu} / ${avail.length - nu}`);
    // Compact copy inside the Competitor Monitoring card.
    set('lot-mini-count', avail.length.toLocaleString());
    set('lot-mini-range', rangeTxt);
    set('lot-mini-avg', avgTxt);
  } catch {}
}

// Monthly live-market usage vs the soft cap (cached lookups don't count).
async function loadScanUsage() {
  const el = document.getElementById('inv-scan-usage');
  if (!el) return;
  try {
    const r = await fetch(`${API}/ai/usage`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return;
    const u = await r.json();
    if (!u?.marketcheck) return;
    const { used, limit } = u.marketcheck;
    el.textContent = `Live market lookups this month: ${used.toLocaleString()} / ${limit.toLocaleString()} · cached lookups are free`;
    el.classList.remove('hidden');
  } catch {}
}

// Which category the Inventory Scan Results list is filtered to.
let __aiActivityItems = [];
let __aiActivityFilter = 'all';

// Priority rank for ordering: price flags first, then missing info, then copies
// written, then everything else — so the units that need action float to the top.
function aiRowPriority(i) {
  if (i.price_flagged) return 0;
  if (i.warnings?.length > 0) return 1;
  if (i.copy_generated) return 2;
  return 3;
}

function renderAiActivity() {
  const list = document.getElementById('ai-activity-list');
  const empty = document.getElementById('ai-activity-empty');
  const countEl = document.getElementById('ai-activity-count');
  if (!list) return;

  // Highlight the active filter card.
  document.querySelectorAll('.ai-stat-card').forEach(c => {
    const on = c.dataset.aiFilter === __aiActivityFilter;
    c.classList.toggle('ring-2', on);
    c.classList.toggle('ring-indigo-500', on);
  });

  const f = __aiActivityFilter;
  const filtered = __aiActivityItems.filter(i =>
    f === 'all' ? true :
    f === 'price' ? i.price_flagged :
    f === 'missing' ? (i.warnings?.length > 0) :
    f === 'copies' ? i.copy_generated : true
  );
  // Sort by priority, then newest first within a group.
  filtered.sort((a, b) => aiRowPriority(a) - aiRowPriority(b) || new Date(b.created_at) - new Date(a.created_at));

  if (countEl) countEl.textContent = f === 'all' ? `${filtered.length} checks` : `${filtered.length} of ${__aiActivityItems.length}`;

  if (!filtered.length) {
    list.innerHTML = `<li class="px-4 py-8 text-center text-sm text-slate-400">No vehicles in this category.</li>`;
    list.classList.remove('hidden');
    if (empty) empty.classList.add('hidden');
    return;
  }

  list.innerHTML = filtered.map(item => {
    const date = new Date(item.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const stock = item.stocknumber ? `<span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">#${esc(item.stocknumber)}</span>` : '';
    const badges = [];
    if (item.price_flagged) {
      const dir = (item.price_pct_diff || 0) > 0 ? 'overpriced' : 'underpriced';
      const pct = Math.abs(item.price_pct_diff || 0);
      badges.push(`<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">${pct}% ${dir}</span>`);
    }
    if (item.warnings?.length > 0) badges.push(`<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">${item.warnings.length} alert${item.warnings.length > 1 ? 's' : ''}</span>`);
    if (item.copy_generated) badges.push(`<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">Copy written</span>`);
    const warningList = item.warnings?.length > 0
      ? `<ul class="mt-1.5 text-xs text-amber-700 dark:text-amber-300 space-y-0.5 list-disc list-inside">${item.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`
      : '';
    const clickable = !!item.inventory_id;
    const hint = item.price_flagged ? 'Click for full price report →' : 'View price comparison →';
    return `<li class="px-4 py-3.5 ${clickable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors' : ''}" ${clickable ? `data-price-report="${item.inventory_id}"` : ''}>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-sm text-slate-900 dark:text-white">${esc(item.vehicle_label || 'Unknown vehicle')}</span>
            ${stock}
          </div>
          <div class="flex flex-wrap gap-1.5 mt-1.5">${badges.join('') || '<span class="text-xs text-slate-400">No issues found</span>'}</div>
          ${warningList}
          ${clickable ? `<div class="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">${hint}</div>` : ''}
        </div>
        <div class="text-xs text-slate-400 whitespace-nowrap flex-shrink-0 mt-0.5">${date}</div>
      </div>
    </li>`;
  }).join('');
  list.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');

  list.querySelectorAll('[data-price-report]').forEach(li => {
    li.addEventListener('click', () => openPriceReport(li.dataset.priceReport));
  });
}

// Wire the stat cards as category filters.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.ai-stat-card').forEach(card => {
    card.addEventListener('click', () => {
      __aiActivityFilter = card.dataset.aiFilter || 'all';
      renderAiActivity();
    });
  });
});

// ── Reusable Upgrade / Purchase Modal ───────────────────────────────────────
// Opened by every locked AI / Inventory-Intelligence CTA. Shows the add-on's
// feature list + price and starts checkout — replaces the old AI Boost page.
const UPGRADE_PLANS = {
  inv_intel: {
    eyebrow: 'Flagship add-on',
    title: 'Inventory Intelligence',
    tagline: 'Know exactly where every unit sits vs the live market — and value every trade.',
    price: '$299',
    cta: 'Start 30-Day Free Trial',
    endpoint: 'subscribe-inv-intel',
    features: [
      '“% to market” on every used vehicle',
      'Inventory Scan — live market comps across your whole lot',
      'vAuto-style trade appraisals with printable PDF',
      'Lot Average Report — your lot vs the market',
      'Hot / cold detection, turn rate & health scores',
      'Duplicate VIN detection & automated repricing rules',
      'Direct competition monitoring',
      'VIN decoder, recalls & factory window stickers',
    ],
  },
  ai_boost: {
    eyebrow: 'Add-on',
    title: 'AI Boost',
    tagline: 'AI listing tools that write, check and polish every vehicle.',
    price: '$129',
    cta: 'Start 30-Day Free Trial',
    endpoint: 'subscribe-ai-boost',
    features: [
      'AI listing copy in your dealership’s tone',
      'Missing-info alerts (photos, price, mileage)',
      'AI Vision photo scoring 0–100',
      'Branded window stickers & AI dealer brochures',
      'Price intelligence flags on every unit',
    ],
  },
};

function openUpgradeModal(addon) {
  const plan = UPGRADE_PLANS[addon];
  const modal = document.getElementById('upgrade-modal');
  if (!plan || !modal) return;
  document.getElementById('upgrade-modal-eyebrow').textContent = plan.eyebrow;
  document.getElementById('upgrade-modal-title').textContent = plan.title;
  document.getElementById('upgrade-modal-tagline').textContent = plan.tagline;
  document.getElementById('upgrade-modal-price').textContent = plan.price;
  document.getElementById('upgrade-modal-features').innerHTML = plan.features.map(f =>
    `<li class="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg><span>${esc(f)}</span></li>`
  ).join('');
  const buy = document.getElementById('upgrade-modal-buy');
  buy.textContent = plan.cta;
  buy.disabled = false;
  buy.onclick = async () => {
    buy.disabled = true;
    buy.textContent = 'Redirecting…';
    try {
      const res = await fetch(`${API}/billing/${plan.endpoint}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      throw new Error(data.error || 'Failed to start checkout');
    } catch (e) {
      buy.disabled = false;
      buy.textContent = plan.cta;
      alert('Could not start checkout: ' + e.message);
    }
  };
  modal.classList.remove('hidden');
}

function closeUpgradeModal() {
  document.getElementById('upgrade-modal')?.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('upgrade-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUpgradeModal();
  });
});
window.openUpgradeModal = openUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;

// Shared checkout starter (30-day trial, no card required) — used by the modal + hub.
async function startAddonCheckout(endpoint, btn, ctaText) {
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  try {
    const res = await fetch(`${API}/billing/${endpoint}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    throw new Error(data.error || 'Failed to start checkout');
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = ctaText || 'Start 30-day free trial'; }
    alert('Could not start checkout: ' + e.message);
  }
}

// Trial countdown badge on the  Upgrades icon (days left in the 30-day trial).
function updateTrialBadge(daysLeft) {
  const b = document.getElementById('upg-days-badge');
  if (!b) return;
  if (daysLeft > 0) {
    b.textContent = daysLeft + 'd';
    b.classList.remove('hidden');
    const btn = document.getElementById('open-upgrades');
    if (btn) btn.title = `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left · Upgrades & add-ons`;
  } else {
    b.classList.add('hidden');
  }
}
window.updateTrialBadge = updateTrialBadge;

// ── Price Report Modal ──────────────────────────────────────────────────────

let __prChart = null;
let __prData = null; // store last report data for PDF export

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pr-close')?.addEventListener('click', closePriceReport);
  document.getElementById('price-report-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closePriceReport();
  });
  document.getElementById('pr-pdf-btn')?.addEventListener('click', exportPriceReportPDF);
});

function closePriceReport() {
  document.getElementById('price-report-modal')?.classList.add('hidden');
  if (__prChart) { __prChart.destroy(); __prChart = null; }
  __prData = null;
}

// ── Lot Average Report ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ai-lot-report-btn')?.addEventListener('click', openLotReport);
  document.getElementById('lr-close')?.addEventListener('click', () =>
    document.getElementById('lot-report-modal')?.classList.add('hidden'));
  document.getElementById('lot-report-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
  });
});

async function openLotReport() {
  const modal = document.getElementById('lot-report-modal');
  const loading = document.getElementById('lr-loading');
  const content = document.getElementById('lr-content');
  const errorEl = document.getElementById('lr-error');
  if (!modal) return;
  modal.classList.remove('hidden');
  loading?.classList.remove('hidden');
  content?.classList.add('hidden');
  errorEl?.classList.add('hidden');

  const money = n => '$' + Number(n || 0).toLocaleString();
  try {
    const res = await fetch(`${API}/ai/lot-report`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not build lot report');
    loading?.classList.add('hidden');

    if (!data.count) {
      if (errorEl) {
        errorEl.textContent = 'No comparable vehicles yet — run "Scan All Inventory" first so we can pull market comps for your lot.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    const sub = document.getElementById('lr-subtitle');
    if (sub) sub.textContent = `${data.count} vehicle${data.count === 1 ? '' : 's'} with market comps · from your latest scan`;
    document.getElementById('lr-count').textContent = data.count;
    document.getElementById('lr-lot-avg').textContent = money(data.lot_avg);
    document.getElementById('lr-market-avg').textContent = money(data.market_avg);

    const diffEl = document.getElementById('lr-diff');
    const p = data.overall_pct_diff || 0;
    diffEl.textContent = (p > 0 ? '+' : '') + p + '%';
    diffEl.className = 'text-2xl font-black ' + (p > 5 ? 'text-red-600 dark:text-red-400' : p < -5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400');

    document.getElementById('lr-over').textContent = data.over;
    document.getElementById('lr-fair').textContent = data.fair;
    document.getElementById('lr-under').textContent = data.under;

    const rowColor = pct => pct > 5 ? 'text-red-600 dark:text-red-400' : pct < -5 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';
    document.getElementById('lr-rows').innerHTML = (data.vehicles || []).map(v => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer" data-lr-report="${v.inventory_id}">
        <td class="px-3 py-2 font-medium text-slate-900 dark:text-white">
          <div class="flex items-center gap-2">
            <span>${esc(v.label)}</span>
            <button type="button" data-lr-stock="${v.inventory_id}" title="Open stock card" class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div>
        </td>
        <td class="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">${money(v.your_price)}</td>
        <td class="px-3 py-2 text-right tabular-nums text-slate-500 dark:text-slate-400">${money(v.market_avg)}</td>
        <td class="px-3 py-2 text-right tabular-nums font-bold ${rowColor(v.pct_diff)}">${(v.pct_diff > 0 ? '+' : '') + v.pct_diff}%</td>
      </tr>`).join('');

    // Click a row to open that vehicle's full price report; the pencil opens the stock card.
    document.getElementById('lr-rows').querySelectorAll('[data-lr-report]').forEach(tr => {
      tr.addEventListener('click', () => { modal.classList.add('hidden'); openPriceReport(tr.dataset.lrReport); });
    });
    document.getElementById('lr-rows').querySelectorAll('[data-lr-stock]').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); modal.classList.add('hidden'); editVehicle(btn.dataset.lrStock); });
    });

    content?.classList.remove('hidden');
  } catch (err) {
    loading?.classList.add('hidden');
    if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
  }
}

function exportPriceReportPDF() {
  if (!__prData) return;
  const { vehicle, estimate, pct_diff, label, currency, data_source } = __prData;
  const cl = currency === 'USD' ? 'USD' : 'CAD';
  const distUnit = cl === 'USD' ? 'mi' : 'km';
  const fmt = n => n != null ? '$' + Number(n).toLocaleString() + ' ' + cl : '—';
  const fmtMi = n => n != null ? Number(n).toLocaleString() + ' ' + distUnit : '—';

  const lowConf = !!estimate && estimate.reliable === false;   // comps not like-for-like
  const over = pct_diff != null && pct_diff > 0;
  const diffColor = lowConf ? '#94a3b8' : (pct_diff == null ? '#94a3b8' : over ? '#ef4444' : '#7c3aed');
  const diffText = pct_diff != null ? (over ? '+' : '') + pct_diff + '%' : '—';

  const avgs = estimate?.marketplace_averages || [];
  const sourceNames = avgs.length ? avgs.map(m => m.name) : [];
  const ma = estimate?.mileage_analysis;
  const isNew = vehicle.condition === 'new' || Number(vehicle.year) >= new Date().getFullYear();

  const ptm = estimate?.price_to_market_pct;
  // Colour by the action verdict (ok=green, raise=amber, lower=red), matching the modal.
  const _verdictColorMap = { ok: '#10b981', raise: '#f59e0b', lower: '#ef4444' };
  const ptmColor = ptm == null ? '#94a3b8' : (_verdictColorMap[estimate?.pricing_verdict] || '#0f172a');
  const dom = estimate?.days_on_market_estimate;

  const ratingColorMap = {
    'well below average': '#7c3aed', 'below average': '#c4b5fd',
    'average': '#94a3b8', 'above average': '#f59e0b', 'well above average': '#ef4444'
  };
  const mileageImpact = ma?.mileage_price_impact != null ? Number(ma.mileage_price_impact) : null;
  const mileageImpactColor = mileageImpact == null ? '#94a3b8' : mileageImpact > 0 ? '#7c3aed' : '#ef4444';
  const mileageImpactText = mileageImpact != null
    ? (mileageImpact > 0 ? '+' : mileageImpact < 0 ? '−' : '') + '$' + Math.abs(mileageImpact).toLocaleString() + ' ' + cl
    : '—';

  const canvas = document.getElementById('pr-chart');
  const chartImg = canvas ? canvas.toDataURL('image/png') : null;

  const win = window.open('', '_blank');
  if (!win) return;

  const html = `<!DOCTYPE html><html><head>
<title>Market Price Report – ${label}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:letter portrait;margin:13mm 13mm 11mm}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0f172a;font-size:10.5px;line-height:1.35;background:#fff}
/* On-screen (the auto-opened tab): render as a centered letter-width page so the
   preview matches the print and never stretches full browser width. Print uses @page. */
@media screen{html{background:#e5e7eb}body{width:8.5in;max-width:100%;min-height:11in;margin:20px auto;padding:13mm;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.15)}}
.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2.5px solid #6366f1;padding-bottom:7px;margin-bottom:8px}
.header h1{font-size:14px;font-weight:900;letter-spacing:-.3px;margin-bottom:1px}
.header .sub{font-size:9.5px;color:#64748b}
.header-right{text-align:right;font-size:8.5px;color:#94a3b8;line-height:1.7}
.badge{display:inline-block;background:#eef2ff;color:#6366f1;font-size:7.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:99px;border:1px solid #c7d2fe}
.sl{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin:7px 0 4px}
.strip5{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:7px}
.tile{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 5px;text-align:center}
.tile .tl{font-size:7px;text-transform:uppercase;font-weight:700;letter-spacing:.06em;color:#94a3b8;margin-bottom:2px}
.tile .tv{font-size:13px;font-weight:900}
.mkt3{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:7px}
.mkt-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:6px 7px}
.mkt-name{font-size:7.5px;font-weight:800;color:#6366f1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px;border-bottom:1px solid #e2e8f0;padding-bottom:2px}
.mkt-row{display:flex;justify-content:space-between;align-items:center;padding:1.5px 0}
.mkt-lbl{font-size:8px;color:#64748b}
.mkt-val{font-size:9px;font-weight:800}
.mkt-cnt{font-size:7.5px;color:#94a3b8;margin-top:2px}
.two-col{display:grid;grid-template-columns:3fr 2fr;gap:7px;margin-bottom:7px}
.chart-wrap{border:1px solid #e2e8f0;border-radius:5px;padding:5px;background:#fafafa}
.chart-wrap img{width:100%;display:block;max-height:150px;object-fit:contain}
.mi-panel{background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;padding:7px}
.mi-row{display:flex;justify-content:space-between;align-items:center;padding:2.5px 0;border-bottom:1px solid #f1f5f9}
.mi-row:last-of-type{border-bottom:none}
.mi-key{font-size:8px;color:#64748b}
.mi-val{font-size:9px;font-weight:800}
.mi-note{font-size:7.5px;color:#64748b;margin-top:4px;line-height:1.5;border-top:1px solid #f1f5f9;padding-top:4px}
.range-header{display:flex;justify-content:space-between;font-size:8.5px;color:#64748b;font-family:monospace;margin-bottom:2px}
.range-track{height:9px;border-radius:99px;background:#e2e8f0;position:relative;overflow:visible;margin-bottom:2px}
.range-band{position:absolute;top:0;height:100%;border-radius:99px}
.range-marker{position:absolute;top:50%;transform:translate(-50%,-50%);width:11px;height:11px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.range-ends{display:flex;justify-content:space-between;font-size:7.5px;color:#94a3b8;margin-bottom:7px}
.insight{background:#eef2ff;border:1px solid #c7d2fe;border-radius:5px;padding:7px 9px;margin-bottom:6px}
.insight .il{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6366f1;margin-bottom:2px}
.insight p{font-size:9.5px;color:#1e293b;line-height:1.5}
.insight .ic{font-size:8px;color:#94a3b8;margin-top:2px}
.footer{border-top:1px solid #e2e8f0;padding-top:5px;margin-top:5px;font-size:7.5px;color:#94a3b8;line-height:1.55;display:flex;justify-content:space-between;gap:10px}
.footer .fl{flex:1}
.footer .fr{text-align:right;white-space:nowrap}
.printbar{margin-bottom:12px;text-align:right}
.printbar button{background:#6366f1;color:#fff;border:none;font-size:12px;font-weight:700;padding:8px 16px;border-radius:6px;cursor:pointer}
.printbar button:hover{background:#4f46e5}
@media print{.printbar{display:none!important}}
</style></head><body>

<div class="printbar"><button onclick="window.print()"> Print / Save as PDF</button></div>

<div class="header">
  <div>
    <h1>${label}</h1>
    <div class="sub">${[
      vehicle.stocknumber ? 'Stock #' + vehicle.stocknumber : null,
      vehicle.condition ? vehicle.condition.charAt(0).toUpperCase() + vehicle.condition.slice(1) : null,
      vehicle.mileage ? fmtMi(vehicle.mileage) : null,
      vehicle.exterior_color || null
    ].filter(Boolean).join(' · ')}</div>
  </div>
  <div class="header-right">
    <div class="badge">AI Market Report</div><br>
    ${new Date().toLocaleDateString('en-CA', { year:'numeric', month:'long', day:'numeric' })}<br>
    MarketSync AI Boost
  </div>
</div>

${lowConf ? `<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:8px 12px;font-size:11px;margin-bottom:10px;line-height:1.5"> <b>Low-confidence market read</b> — the comparable listings may not match this exact trim${estimate.comp_count != null ? ` (only ${estimate.comp_count} found)` : ''}, so the % to market is a rough guide, not a firm number. Verify against your book (Black Book / vAuto) before repricing.</div>` : ''}
<div class="sl">Price Summary</div>
<div class="strip5">
  <div class="tile"><div class="tl">Your Price</div><div class="tv">${fmt(vehicle.price)}</div></div>
  <div class="tile"><div class="tl">Market Average</div><div class="tv">${(() => {
    const _ap = (estimate?.marketplace_averages || []).map(m => Number(m.avg)).filter(p => p > 0).sort((a,b)=>a-b);
    const _m = _ap.length ? (_ap.length%2===0?(_ap[Math.floor(_ap.length/2)-1]+_ap[Math.floor(_ap.length/2)])/2:_ap[Math.floor(_ap.length/2)]):null;
    const _vp = _m ? _ap.filter(p=>p>=_m*0.55&&p<=_m*1.8) : _ap;
    const _avg = _vp.length ? Math.round(_vp.reduce((a,b)=>a+b,0)/_vp.length) : estimate?.mid;
    return fmt(_avg);
  })()}</div></div>
  <div class="tile"><div class="tl">Difference</div><div class="tv" style="color:${diffColor}">${diffText}</div></div>
  <div class="tile"><div class="tl">Price to Market</div><div class="tv" style="color:${ptmColor}">${ptm != null ? ptm + '%' : '—'}</div></div>
  <div class="tile"><div class="tl">Est. Days to Sell</div><div class="tv">${dom != null ? dom + 'd' : '—'}</div></div>
</div>

${avgs.length ? `
<div class="sl">Average Price by Marketplace</div>
<div class="mkt3">
  ${avgs.map(m => {
    const mAvg = Number(m.avg);
    const vp = Number(vehicle.price);
    const vs = mAvg ? Math.round(((vp - mAvg) / mAvg) * 100) : null;
    const vsColor = vs == null ? '#94a3b8' : vs > 0 ? '#ef4444' : '#7c3aed';
    return `<div class="mkt-card">
      <div class="mkt-name">${m.name}</div>
      <div class="mkt-row"><span class="mkt-lbl">Avg Price</span><span class="mkt-val">${fmt(m.avg)}</span></div>
      ${m.avg_mileage ? `<div class="mkt-row"><span class="mkt-lbl">Avg Mileage</span><span class="mkt-val">${fmtMi(m.avg_mileage)}</span></div>` : ''}
      <div class="mkt-row"><span class="mkt-lbl">Your vs Avg</span><span class="mkt-val" style="color:${vsColor}">${vs != null ? (vs > 0 ? '+' : '') + vs + '%' : '—'}</span></div>
      <div class="mkt-cnt">${m.estimated_listings || ''}</div>
    </div>`;
  }).join('')}
</div>` : ''}

<div class="two-col">
  <div>
    <div class="sl">Marketplace Averages vs Your Price</div>
    <div class="chart-wrap">${chartImg ? `<img src="${chartImg}" alt="Price chart"/>` : '<div style="height:130px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:9px">Chart unavailable</div>'}</div>
  </div>
  <div>
    <div class="sl">Mileage Analysis</div>
    <div class="mi-panel">
      <div class="mi-row"><span class="mi-key">Your Mileage</span><span class="mi-val">${vehicle.mileage ? fmtMi(vehicle.mileage) : 'N/A'}</span></div>
      <div class="mi-row"><span class="mi-key">Market Avg</span><span class="mi-val">${ma?.market_avg_mileage ? fmtMi(ma.market_avg_mileage) : '—'}</span></div>
      ${avgs.filter(m => m.avg_mileage).map(m =>
        `<div class="mi-row"><span class="mi-key">${m.name}</span><span class="mi-val">${fmtMi(m.avg_mileage)}</span></div>`
      ).join('')}
      <div class="mi-row"><span class="mi-key">Rating</span><span class="mi-val" style="color:${ratingColorMap[ma?.mileage_rating] || '#94a3b8'}">${ma?.mileage_rating ? ma.mileage_rating.charAt(0).toUpperCase() + ma.mileage_rating.slice(1) : '—'}</span></div>
      <div class="mi-row"><span class="mi-key">Price Impact</span><span class="mi-val" style="color:${mileageImpactColor}">${mileageImpactText}</span></div>
      ${ma?.mileage_note ? `<div class="mi-note">${ma.mileage_note}</div>` : ''}
    </div>
  </div>
</div>

${estimate ? `
<div class="sl">Overall Market Range (${cl})</div>
<div class="range-header">
  <span>${fmt(estimate.low)}</span>
  <span style="font-weight:700;color:#0f172a">${fmt(estimate.mid)}&nbsp;avg</span>
  <span>${fmt(estimate.high)}</span>
</div>
${(() => {
  const lo = estimate.low, hi = estimate.high, vp = Number(vehicle.price);
  const span = (hi - lo) || 1;
  const markerPct = Math.min(97, Math.max(3, ((vp - lo) / span) * 100));
  return `<div class="range-track"><div class="range-band" style="left:0%;width:100%;background:#c7d2fe"></div><div class="range-marker" style="left:${markerPct}%;background:#6366f1"></div></div>`;
})()}
<div class="range-ends"><span>Market Low</span><span style="font-weight:700;color:#6366f1">▲ Your Price</span><span>Market High</span></div>` : ''}

${estimate?.note ? `
<div class="insight">
  <div class="il">AI Market Insight</div>
  <p>${estimate.note}</p>
  ${estimate.confidence ? `<div class="ic">Confidence: ${estimate.confidence.charAt(0).toUpperCase() + estimate.confidence.slice(1)}</div>` : ''}
</div>` : ''}

${(estimate?.comps && estimate.comps.length) ? `
<div class="sl">Comparable Listings (${estimate.comps.length})</div>
<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:4px">
  <thead><tr style="text-align:left;color:#64748b;border-bottom:1px solid #e2e8f0">
    <th style="padding:6px 8px">Year / Trim</th>
    <th style="padding:6px 8px;text-align:right">Price</th>
    <th style="padding:6px 8px;text-align:right">Mileage</th>
    <th style="padding:6px 8px">Dealer / Location</th>
    <th style="padding:6px 8px"></th>
  </tr></thead>
  <tbody>
  ${estimate.comps.map(c => `<tr style="border-bottom:1px solid #f1f5f9">
    <td style="padding:6px 8px;font-weight:600;color:#0f172a">${esc([c.year, c.trim].filter(Boolean).join(' ') || '—')}</td>
    <td style="padding:6px 8px;text-align:right;color:#0f172a">${c.price ? fmt(c.price) : '—'}</td>
    <td style="padding:6px 8px;text-align:right;color:#334155">${c.mileage ? fmtMi(c.mileage) : '—'}</td>
    <td style="padding:6px 8px;color:#64748b">${esc([c.dealer, c.region].filter(Boolean).join(', ') || '—')}</td>
    <td style="padding:6px 8px;white-space:nowrap">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:#6366f1;font-weight:700;text-decoration:none">View ↗</a>` : ''}</td>
  </tr>`).join('')}
  </tbody>
</table></div>
<div style="font-size:10px;color:#94a3b8;margin-top:6px">These are the live listings behind the ${fmt(estimate.mid)} average. Check the trim column — if they aren't this vehicle's trim, treat the % to market as a rough guide, not a firm number.</div>
` : ''}

<div class="footer">
  <div class="fl"><strong>Sources:</strong> ${sourceNames.join(' · ') || 'AI market analysis'}&nbsp;&nbsp;·&nbsp;&nbsp;${data_source === 'marketcheck' ? 'Live market data from MarketCheck.' : 'AI-analyzed from marketplace listings. Not a live data feed.'} ${isNew ? 'New vehicles matched by same year.' : 'Used vehicles matched by same year and trim.'} Not a guarantee of resale value.</div>
  <div class="fr">Generated ${new Date().toLocaleDateString('en-CA', { year:'numeric', month:'short', day:'numeric' })}</div>
</div>

</body></html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
  // No auto-print — let the user review, then click Print / Save as PDF when ready.
}

async function openPriceReport(inventoryId, forceRefresh = false) {
  const modal = document.getElementById('price-report-modal');
  const loading = document.getElementById('pr-loading');
  const content = document.getElementById('pr-content');
  if (!modal) return;

  modal.classList.remove('hidden');
  loading.classList.remove('hidden');
  loading.textContent = forceRefresh ? 'Refreshing AI market estimate…' : 'Generating AI market estimate…';
  content.classList.add('hidden');
  if (__prChart) { __prChart.destroy(); __prChart = null; }
  __prData = null;

  try {
    const res = await fetch(`${API}/ai/price-report/${inventoryId}${forceRefresh ? '?refresh=1' : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      let msg = 'Could not load report';
      try { const e = await res.json(); if (e?.error) msg = e.error; } catch {}
      throw new Error(msg);
    }
    const { vehicle, estimate, pct_diff, data_source, skipped, reason, cached, generated_at } = await res.json();

    // New / current-year / demo vehicles have no reliable used-market comp set —
    // the backend returns skipped:true with a reason instead of a bogus report.
    if (skipped || !estimate) {
      const lbl = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
      document.getElementById('pr-title').textContent = lbl;
      document.getElementById('pr-subtitle').textContent = vehicle.stocknumber ? `Stock #${vehicle.stocknumber} · ${vehicle.condition || ''}` : (vehicle.condition || '');
      loading.classList.remove('hidden');
      loading.innerHTML = `<div class="py-8 text-center text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">${esc(reason || 'A market price report isn’t available for this vehicle.')}</div>`;
      content.classList.add('hidden');
      return;
    }

    const currency = estimate?.currency || 'CAD';
    const currencyLabel = currency === 'USD' ? 'USD' : 'CAD';
    const fmt = n => n != null ? '$' + Number(n).toLocaleString() + ' ' + currencyLabel : '—';
    const label = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
    __prData = { vehicle, estimate, pct_diff, label, currency, data_source };

    document.getElementById('pr-title').textContent = label;
    const subBase = vehicle.stocknumber ? `Stock #${vehicle.stocknumber} · ${vehicle.condition || ''}` : (vehicle.condition || '');
    const subEl = document.getElementById('pr-subtitle');
    if (cached && generated_at) {
      const days = Math.floor((Date.now() - new Date(generated_at)) / 86400000);
      const ago = days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
      subEl.innerHTML = `${esc(subBase)} · <span class="text-slate-400">cached ${ago}</span> · <button id="pr-refresh" class="text-indigo-500 hover:text-indigo-400 font-semibold">Refresh</button>`;
      setTimeout(() => document.getElementById('pr-refresh')?.addEventListener('click', () => openPriceReport(inventoryId, true)), 0);
    } else {
      subEl.textContent = subBase;
    }

    // Compute market average from valid (non-outlier) marketplace bars
    const _avgsAll = estimate?.marketplace_averages || [];
    const _rawPrices = _avgsAll.map(m => Number(m.avg)).filter(p => p > 0).sort((a, b) => a - b);
    const _med = _rawPrices.length ? (_rawPrices.length % 2 === 0
      ? (_rawPrices[Math.floor(_rawPrices.length / 2) - 1] + _rawPrices[Math.floor(_rawPrices.length / 2)]) / 2
      : _rawPrices[Math.floor(_rawPrices.length / 2)]) : null;
    const _validPrices = _med
      ? _avgsAll.map(m => Number(m.avg)).filter(p => p > 0 && p >= _med * 0.55 && p <= _med * 1.8)
      : _rawPrices;
    const computedMarketAvgForTiles = _validPrices.length
      ? Math.round(_validPrices.reduce((a, b) => a + b, 0) / _validPrices.length)
      : estimate?.mid;

    document.getElementById('pr-your-price').textContent = fmt(vehicle.price);
    document.getElementById('pr-median').textContent = fmt(computedMarketAvgForTiles);

    const diffEl = document.getElementById('pr-diff');
    if (pct_diff != null) {
      const over = pct_diff > 0;
      diffEl.textContent = (over ? '+' : '') + pct_diff + '%';
      diffEl.className = 'text-xl font-black ' + (over ? 'text-red-500' : 'text-amber-500');
      diffEl.title = over ? 'Priced above AI market estimate' : 'Priced below AI market estimate';
    } else {
      diffEl.textContent = '—';
      diffEl.className = 'text-xl font-black text-slate-400';
    }

    // Range bar
    if (estimate) {
      document.getElementById('pr-range-low').textContent = fmt(estimate.low);
      document.getElementById('pr-range-mid').textContent = fmt(estimate.mid);
      document.getElementById('pr-range-high').textContent = fmt(estimate.high);

      const lo = estimate.low, hi = estimate.high;
      const span = (hi - lo) || 1;
      const vp = Number(vehicle.price);
      const markerPct = Math.min(100, Math.max(0, ((vp - lo) / span) * 100));
      document.getElementById('pr-range-band').style.cssText = 'left:0%;width:100%';
      document.getElementById('pr-price-marker').style.left = markerPct + '%';
    }

    // Action verdict — the tag meaning: ok = priced right (even if above/below market),
    // raise = underpriced (money on the table), lower = overpriced (will sit).
    const verdict = estimate?.pricing_verdict || 'ok';
    const V = {
      ok:    { icon: '', box: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800', head: 'text-emerald-700 dark:text-emerald-300', body: 'text-emerald-800/80 dark:text-emerald-200/70', tile: 'text-emerald-500', fallbackHead: 'Priced right' },
      raise: { icon: '↑', box: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800', head: 'text-amber-700 dark:text-amber-300', body: 'text-amber-800/80 dark:text-amber-200/70', tile: 'text-amber-500', fallbackHead: 'Underpriced — room to raise' },
      lower: { icon: '↓', box: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800', head: 'text-red-700 dark:text-red-300', body: 'text-red-800/80 dark:text-red-200/70', tile: 'text-red-500', fallbackHead: 'Overpriced — consider lowering' },
    };
    const vc = V[verdict] || V.ok;
    const vBanner = document.getElementById('pr-verdict');
    if (vBanner) {
      if (estimate) {
        vBanner.className = 'rounded-lg border p-4 flex items-start gap-3 ' + vc.box;
        document.getElementById('pr-verdict-icon').textContent = vc.icon;
        const hEl = document.getElementById('pr-verdict-headline');
        hEl.textContent = estimate.verdict_headline || vc.fallbackHead;
        hEl.className = 'text-sm font-black ' + vc.head;
        const rEl = document.getElementById('pr-verdict-reason');
        rEl.textContent = estimate.verdict_reason || '';
        rEl.className = 'text-xs mt-1 leading-relaxed ' + vc.body;
        rEl.classList.toggle('hidden', !estimate.verdict_reason);
      } else {
        vBanner.className = 'hidden rounded-lg border p-4 flex items-start gap-3';
      }
    }

    // Market velocity — colour the Price-to-Market tile by the ACTION verdict, not the
    // raw ratio (a high % can be fine and a low % can still be too high for the unit).
    const ptmEl = document.getElementById('pr-ptm');
    const daysEl = document.getElementById('pr-days');
    if (ptmEl) {
      const ptm = estimate?.price_to_market_pct;
      ptmEl.textContent = ptm != null ? ptm + '%' : '—';
      ptmEl.className = 'text-xl font-black ' + (ptm == null ? 'text-slate-400' : vc.tile);
    }
    if (daysEl) daysEl.textContent = estimate?.days_on_market_estimate != null ? estimate.days_on_market_estimate + ' days' : '—';

    // Mileage panel
    const ma = estimate?.mileage_analysis;
    const distUnit = currencyLabel === 'USD' ? 'mi' : 'km';
    const fmtMi = n => n != null ? Number(n).toLocaleString() + ' ' + distUnit : '—';
    document.getElementById('pr-your-mileage').textContent = vehicle.mileage ? fmtMi(vehicle.mileage) : 'N/A';
    document.getElementById('pr-market-mileage').textContent = ma?.market_avg_mileage ? fmtMi(ma.market_avg_mileage) : '—';

    const ratingEl = document.getElementById('pr-mileage-rating');
    const ratingColorMap = {
      'well below average': 'text-emerald-500', 'below average': 'text-emerald-400',
      'average': 'text-slate-500', 'above average': 'text-amber-500', 'well above average': 'text-red-500'
    };
    if (ratingEl && ma?.mileage_rating) {
      ratingEl.textContent = ma.mileage_rating.charAt(0).toUpperCase() + ma.mileage_rating.slice(1);
      ratingEl.className = 'text-xs font-bold ' + (ratingColorMap[ma.mileage_rating] || 'text-slate-400');
    }

    const impactEl = document.getElementById('pr-mileage-impact');
    if (impactEl && ma?.mileage_price_impact != null) {
      const imp = Number(ma.mileage_price_impact);
      impactEl.textContent = (imp >= 0 ? '+' : '') + '$' + Math.abs(imp).toLocaleString() + ' ' + currencyLabel;
      impactEl.className = 'text-xs font-bold ' + (imp > 0 ? 'text-emerald-500' : imp < 0 ? 'text-red-500' : 'text-slate-400');
      if (imp > 0) impactEl.title = 'Premium for low mileage vs market average';
      else if (imp < 0) impactEl.title = 'Discount for high mileage vs market average';
    }
    document.getElementById('pr-mileage-note').textContent = ma?.mileage_note || '';

    // Mileage range bar: position marker at your mileage vs market avg
    if (ma?.market_avg_mileage && vehicle.mileage) {
      const marketAvgMi = Number(ma.market_avg_mileage);
      const yourMi = Number(vehicle.mileage);
      // Range: 0 to 2x market avg
      const rangeMax = marketAvgMi * 2;
      const markerPct = Math.min(100, Math.max(0, (yourMi / rangeMax) * 100));
      const marker = document.getElementById('pr-mileage-marker');
      if (marker) {
        marker.style.left = markerPct + '%';
        marker.className = 'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ' +
          (yourMi < marketAvgMi * 0.8 ? 'bg-emerald-500' : yourMi > marketAvgMi * 1.2 ? 'bg-red-500' : 'bg-amber-400');
      }
    }

    // AI insight
    document.getElementById('pr-ai-note').textContent = estimate?.note || '—';
    const confLabel = document.getElementById('pr-confidence-label');
    if (estimate?.confidence) {
      const confMap = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence — limited comparable data' };
      const srcBadge = data_source === 'marketcheck'
        ? '<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">● MarketCheck live data</span>'
        : data_source === 'live'
        ? '<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">● Live data</span>'
        : '<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">AI estimate</span>';
      confLabel.innerHTML = (confMap[estimate.confidence] || estimate.confidence) + srcBadge;
    } else {
      confLabel.textContent = '';
    }

    // Per-marketplace average cards
    const cardsEl = document.getElementById('pr-marketplace-cards');
    const marketplaceAvgs = estimate?.marketplace_averages || [];
    if (cardsEl && marketplaceAvgs.length) {
      const yourPrice = Number(vehicle.price);
      cardsEl.innerHTML = marketplaceAvgs.map(m => {
        const mAvg = Number(m.avg);
        const vs = mAvg ? Math.round(((yourPrice - mAvg) / mAvg) * 100) : null;
        const vsColor = vs == null ? 'text-slate-400' : vs > 5 ? 'text-red-500' : vs < -5 ? 'text-emerald-500' : 'text-amber-500';
        const vsText = vs != null ? (vs > 0 ? '+' : '') + vs + '% vs avg' : '';
        return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center shadow-sm">
          <div class="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1 truncate">${m.name}</div>
          <div class="text-lg font-black text-slate-900 dark:text-white">${fmt(m.avg)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${m.estimated_listings || ''}</div>
          ${vs != null ? `<div class="text-[10px] font-bold mt-1 ${vsColor}">${vsText}</div>` : ''}
        </div>`;
      }).join('');
    }

    // Methodology note
    const isNew = vehicle.condition === 'new' || Number(vehicle.year) >= new Date().getFullYear();
    document.getElementById('pr-match-note').textContent = isNew
      ? `new ${vehicle.year} ${vehicle.make} ${vehicle.model} (same year)`
      : `used ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''} (same year and trim)`;

    // Chart — marketplace averages + your price
    const ctx = document.getElementById('pr-chart');
    if (ctx && typeof Chart !== 'undefined' && estimate) {
      const yourPrice = Number(vehicle.price);
      const avgs = estimate.marketplace_averages || [];

      // Filter out marketplace averages that are outliers (< 55% or > 180% of
      // the median) — bad scrape data on one source shouldn't skew the chart.
      const rawAvgPrices = avgs.map(m => Number(m.avg)).filter(p => p > 0).sort((a, b) => a - b);
      const medIdx = Math.floor(rawAvgPrices.length / 2);
      const avgMedian = rawAvgPrices.length ? (rawAvgPrices.length % 2 === 0
        ? (rawAvgPrices[medIdx - 1] + rawAvgPrices[medIdx]) / 2
        : rawAvgPrices[medIdx]) : null;
      const validAvgs = avgMedian
        ? avgs.filter(m => { const p = Number(m.avg); return p >= avgMedian * 0.55 && p <= avgMedian * 1.8; })
        : avgs;

      // Build labels and data: one bar per valid marketplace avg, then Your Price
      const chartLabels = [...validAvgs.map(m => m.name), 'Your Price'];
      const chartData = [...validAvgs.map(m => Number(m.avg)), yourPrice];
      const chartColors = [
        'rgba(99,102,241,0.25)', 'rgba(99,102,241,0.35)', 'rgba(99,102,241,0.20)',
        '#6366f1' // your price always solid indigo
      ].slice(0, chartData.length);
      // Last bar (Your Price) is always solid indigo
      chartColors[chartData.length - 1] = '#6366f1';
      const chartBorders = chartColors.map((_, i) => i === chartData.length - 1 ? '#4f46e5' : '#818cf8');

      // Market average = mean of the valid marketplace bars (excludes Your Price and outliers)
      const validPrices = validAvgs.map(m => Number(m.avg)).filter(p => p > 0);
      const computedMarketAvg = validPrices.length
        ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length)
        : estimate.mid;
      const midLine = chartData.map(() => computedMarketAvg);

      __prChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: `Price (${currencyLabel})`,
              data: chartData,
              backgroundColor: chartColors,
              borderColor: chartBorders,
              borderWidth: 2,
              borderRadius: 6,
              order: 2
            },
            {
              label: 'Market Average',
              data: midLine,
              type: 'line',
              borderColor: '#f59e0b',
              borderWidth: 2,
              borderDash: [5, 4],
              pointRadius: 0,
              fill: false,
              tension: 0,
              order: 1
            }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { boxWidth: 12, font: { size: 10 }, padding: 12 } },
            tooltip: { callbacks: { label: c => '$' + Number(c.raw).toLocaleString() + ' ' + currencyLabel } }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: v => '$' + Number(v).toLocaleString(), font: { size: 10 } },
              grid: { color: 'rgba(148,163,184,0.15)' }
            },
            x: { ticks: { font: { size: 10 } }, grid: { display: false } }
          }
        }
      });
    }

    loading.classList.add('hidden');
    content.classList.remove('hidden');
  } catch (err) {
    loading.textContent = 'Failed to load report: ' + err.message;
  }
}

async function verifyAIBoostSession(sessionId) {
  try {
    const res = await fetch(`${API}/billing/ai-boost-verify?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return; // webhook will still handle it; fail silently
    showToast('AI Boost activated! Its AI tools are now live on every vehicle.', 'success', 6000);
    switchPage('inventory');
  } catch {}
}

// Nav "Paid" badges — green when the dealer has that entitlement, grey when not.
// data-ent="base" = included in every plan (Website, CRM); data-ent="pro" = part of
// the Inventory Intelligence / Professional bundle (Automation, Equity, Appraisal).
function applyPaidBadges() {
  const invIntel = !!__invIntelActive;
  const base = 'nav-paid hidden md:inline text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ml-auto';
  const green = base + ' bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  const grey = base + ' bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500';
  document.querySelectorAll('.nav-paid').forEach(el => {
    const on = el.dataset.ent === 'base' ? true : invIntel;
    el.className = on ? green : grey;
    el.title = on ? 'Included in your plan' : 'Requires Inventory Intelligence — tap to upgrade';
    el.textContent = 'Paid';
  });
}

// Render the assistant management controls: reps-access toggle + per-tool checkboxes.
// Reads the catalog + current disabled list from /ai/config (cfg passed in).
function renderAiAssistantMgmt(cfg) {
  const panel = document.getElementById('ai-assistant-mgmt');
  if (!panel) return;
  const reps = document.getElementById('ai-assistant-reps');
  if (reps) reps.checked = cfg.ai_assistant_reps !== false;
  const list = document.getElementById('ai-tools-list');
  const catalog = Array.isArray(cfg.ai_tools_catalog) ? cfg.ai_tools_catalog : [];
  const disabled = new Set(Array.isArray(cfg.ai_tools_disabled) ? cfg.ai_tools_disabled : []);
  if (list) {
    list.innerHTML = catalog.map(t => `
      <label class="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 cursor-pointer">
        <input type="checkbox" data-ai-tool="${esc(t.name)}" ${disabled.has(t.name) ? '' : 'checked'} class="accent-indigo-600 w-4 h-4 mt-0.5">
        <span class="min-w-0"><span class="block text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(t.label || t.name)}</span><span class="block text-[11px] text-slate-400">${esc(t.desc || '')}</span></span>
      </label>`).join('');
  }
  panel.classList.remove('hidden');
}
window.renderAiAssistantMgmt = renderAiAssistantMgmt;

// Manager review of recent "Ask MarketSync" transcripts (who asked what, when).
async function openAiHistory() {
  const ov = crmOverlay('<div id="ai-hist-body" class="p-5"><div class="py-10 text-center text-sm text-slate-400 italic">Loading chat history…</div></div>', 'max-w-2xl');
  const body = () => ov.querySelector('#ai-hist-body');
  let chats = [];
  try { const r = await apiGetJson('/ai/assistant/history?limit=100', { retries: 1 }); chats = r.chats || []; }
  catch (e) { if (body()) body().innerHTML = `<div class="py-10 text-center text-sm text-red-400">${esc(e.message || 'Could not load history')}</div>`; return; }
  const fmt = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return ''; } };
  const rows = chats.length ? chats.map(c => `
    <div class="py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">${esc(c.user_name || 'Someone')}</span>
        <span class="text-[11px] text-slate-400">${esc(fmt(c.created_at))}${Array.isArray(c.tools) && c.tools.length ? ' · ' + esc(c.tools.join(', ')) : ''}</span>
      </div>
      <div class="text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">${esc(c.question || '')}</div>
      ${c.answer ? `<div class="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">${aiDockRichText(c.answer)}</div>` : ''}
    </div>`).join('') : '<div class="py-10 text-center text-sm text-slate-400 italic">No assistant questions logged yet.</div>';
  if (body()) body().innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-black text-slate-900 dark:text-white">Assistant chat history</h3>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="max-h-[65vh] overflow-y-auto">${rows}</div>`;
}
window.openAiHistory = openAiHistory;

// Fill the AI usage panel: today's assistant questions + this month's AI/market ops.
async function loadAiUsage() {
  const panel = document.getElementById('ai-usage-panel');
  if (!panel) return;
  let u;
  try { u = await apiGetJson('/ai/usage', { retries: 1 }); } catch { panel.classList.add('hidden'); return; }
  const pct = (used, limit) => limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const set = (barId, txtId, used, limit, suffix) => {
    const bar = document.getElementById(barId), txt = document.getElementById(txtId);
    const p = pct(used, limit);
    if (bar) { bar.style.width = p + '%'; bar.classList.toggle('bg-rose-500', p >= 90); }
    if (txt) txt.textContent = `${(used || 0).toLocaleString()} / ${(limit || 0).toLocaleString()}${suffix ? ' ' + suffix : ''}`;
  };
  set('ai-use-asst-bar', 'ai-use-asst-txt', u.assistant?.used, u.assistant?.limit, 'today');
  set('ai-use-ai-bar', 'ai-use-ai-txt', u.monthly?.ai?.used, u.monthly?.ai?.limit);
  set('ai-use-mc-bar', 'ai-use-mc-txt', u.monthly?.marketcheck?.used, u.monthly?.marketcheck?.limit);
  panel.classList.remove('hidden');
}
window.loadAiUsage = loadAiUsage;

async function loadAIBoostSection() {
  const section = document.getElementById('ai-boost-section');
  if (!section) return;
  try {
    const res = await fetch(`${API}/ai/config`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const cfg = await res.json();
    __aiBoostActive = !!cfg.ai_boost_active;
    __vinStickerActive = !!cfg.vin_sticker_active;           // = Inventory Intelligence tier
    __aiDocsActive = !!cfg.ai_docs_active;                   // generated docs = AI Boost
    __invIntelActive = true;
    // Facebook-only tier strips the dashboard to the Facebook hub + leaderboard.
    __fbOnly = !!cfg.fb_only;
    applyFbOnlyMode();
    // Trial countdown badge on the  Upgrades icon during the 30-day full-access window.
    updateTrialBadge(cfg.full_access ? (cfg.trial_days_left || 0) : 0);
    // Photo tools state (branded background + AI cutout provider) for the add-vehicle form.
    __photoBackgroundUrl = cfg.photo_background_url || null;
    __bgProviderReady = !!cfg.background_provider_ready;
    // Trade Appraisal is part of the Inventory Intelligence add-on — hide otherwise.
    document.getElementById('nav-appraisal')?.classList.toggle('hidden', !__invIntelActive);
    // Header quick-launch (Desk a deal + Appraise): for every sales user — reps
    // included — on the full DealerOS. Not the Facebook-only / restricted-product /
    // MarketSync-owner / specialized-staff tiers (those run their own workspaces).
    const canQuickSell = !__fbOnly && !__productAllowedPages && !__staffAllowedPages && !marketsyncOwnerMode();
    const deskHdr = document.getElementById('header-desk-btn');
    if (deskHdr) { deskHdr.classList.toggle('hidden', !canQuickSell); deskHdr.classList.toggle('inline-flex', canQuickSell); }
    const apprHdr = document.getElementById('header-appraise-btn');
    if (apprHdr) {
      const showAppr = canQuickSell && __invIntelActive;
      apprHdr.classList.toggle('hidden', !showAppr);
      apprHdr.classList.toggle('inline-flex', showAppr);
    }
    // Re-sync the Sales group now Appraisals' visibility is known.
    if (typeof syncNavGroupVisibility === 'function') syncNavGroupVisibility();
    // Paint the nav "Paid" badges: green when the dealer is entitled, grey when not.
    applyPaidBadges();
    applyFeatureFlags();   // re-hide any feature the dealer switched off (e.g. Appraisals)
    applyProductNav(legacyProductsFromAccess(window.__access) || profileContext?.products);   // keep the product front door applied after config load
    renderDeptNav(profileContext?.role);   // rebuild the department nav once feature flags settle
    // Role, product and entitlement context are settled here, so a #/w/... deep link
    // (refresh / bookmark / shared link) can now be restored and correctly gated.
    if (typeof msBootRoute === 'function') msBootRoute();
    renderUpgradeCta();
    applyExtensionVisibility();
    // Reveal the floating AI assistant dock for entitled dealers (owner exempt).
    updateAiDockVisibility();
    applyAssistantName(cfg.ai_assistant_name);
    // Reveal the fixed Reports quick-access rail for Inventory Intelligence dealers.
    updateReportRailVisibility();
    // Stash dealership location for the appraisal PDFs' header.
    __apprDealerInfo = { city: cfg.city, province: cfg.province, postal_code: cfg.postal_code, country: cfg.country };
    // Localization defaults — new customer/appraisal forms inherit the dealer's
    // country/province instead of hardcoded ON/US.
    window.__dealerLocale = { country: (cfg.country || 'CA').toUpperCase(), province: cfg.province || '' };
    __aiVisionActive = !!cfg.ai_vision_active;               // = AI Boost
    renderAiVisionNav();
    __aiBoostConfigLoaded = true;
    // Hot/cold + health tags load lazily the first time Inventory is opened
    // (prefetchInvIntelTags), instead of on login — keeps the initial burst small.
    // If the user is already on the Inventory page, prime them now.
    if (__invIntelActive && !document.querySelector('[data-page-content="inventory"]')?.classList.contains('hidden')) {
      prefetchInvIntelTags();
    }
    renderAIBoostSection(cfg);
    initVinStickerPage();
    renderInvIntelSidebar(cfg);
    if (__vinStickerActive) loadBrandingSettings();
    // If the user is already on the Inventory Intelligence page (navigated there
    // before config loaded), refresh the Inventory Scan card now that flags are set.
    const iiPage = document.querySelector('[data-page-content="inv-intel"]');
    if (iiPage && !iiPage.classList.contains('hidden')) loadAIActivity();
  } catch {}
}
