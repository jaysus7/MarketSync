/* dashboard.js split part 16/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function openReconAddPicker() {
  const list = (__reconData && __reconData.not_in_recon) || [];
  if (!list.length) { showToast('Every available vehicle is already on the recon board.', 'info'); return; }
  // Lightweight prompt-based picker for v1 — the manager types the stock # to add.
  const label = prompt(`Add a vehicle to recon by stock # (${list.length} available):\n\n` +
    list.slice(0, 40).map(v => `${v.stocknumber || '—'}  ${v.label}`).join('\n'));
  if (!label) return;
  const q = label.trim().toLowerCase();
  const match = list.find(v => (v.stocknumber || '').toLowerCase() === q)
    || list.find(v => v.label.toLowerCase().includes(q));
  if (!match) { showToast('No matching vehicle found.', 'error'); return; }
  try {
    await reconApi(`/recon/${match.inventory_id}/start`, 'POST', {});
    loadReconPage();
  } catch (e) { showToast(e.message || 'Could not add vehicle', 'error'); }
}

// Reset a card's Post button after the extension replies (POST_STARTED).
function handlePostStarted(d) {
  const btn = window.__msPostBtns?.[d.vehicleId];
  if (btn) {
    btn.disabled = false;
    if (btn.dataset.msLabel) btn.innerHTML = btn.dataset.msLabel;
    delete window.__msPostBtns[d.vehicleId];
  }
  if (d.ok) {
    if (typeof showToast === 'function') showToast('Opening Facebook — the listing will auto-fill in the new tab.', 'success', 4000);
  } else if (d.error) {
    if (typeof showToast === 'function') showToast(d.error, d.blocked ? 'info' : 'error', 6000);
    else alert(d.error);
  }
}

function pullViaExtension(feedId, feedUrl, _retried) {
  const wrap = document.querySelector(`.ms-ext-capture[data-feed-id="${feedId}"]`);
  if (!window.__msExtPresent) {
    // The extension's content script may have loaded after our initial ping. Re-announce
    // and retry once before declaring it absent — turns a silent no-op into either a
    // successful pull or a clear, actionable message.
    if (!_retried) {
      setPullUI(wrap, { status: 'Checking for the MarketSync extension…', disabled: true });
      window.postMessage({ __marketsync: true, dir: 'from-page', type: 'PING' }, '*');
      setTimeout(() => pullViaExtension(feedId, feedUrl, true), 900);
      return;
    }
    setPullUI(wrap, { status: 'MarketSync extension not detected. Make sure it’s installed and enabled, then reload this page. If it is installed, click its toolbar icon once and try Pull Inventory again.', disabled: false });
    return;
  }
  setPullUI(wrap, { status: 'Starting…', disabled: true });
  window.postMessage({ __marketsync: true, dir: 'from-page', type: 'PULL_INVENTORY', feedUrl, feedId }, '*');
}

function handlePullStarted(d) {
  const wrap = document.querySelector(`.ms-ext-capture[data-feed-id="${d.feedId}"]`) || document.querySelector('.ms-ext-capture');
  if (d.ok) { setPullUI(wrap, { status: 'Opening dealer site…', disabled: true }); return; }
  if (d.needsEnable) {
    setPullUI(wrap, { status: 'One-time setup: open the MarketSync extension → "Enable one-click capture", then click Pull Inventory again.', disabled: false });
  } else {
    setPullUI(wrap, { status: d.error || 'Could not start capture.', disabled: false });
  }
}

function applyCaptureState(state, reactToDone = true) {
  if (!state) return;
  const wrap = state.feedId
    ? document.querySelector(`.ms-ext-capture[data-feed-id="${state.feedId}"]`)
    : document.querySelector('.ms-ext-capture');
  if (!wrap) return;
  if (state.status === 'pulling') {
    const label = state.total ? `Pulling… ${state.current || 0}/${state.total}` : 'Pulling inventory…';
    setPullUI(wrap, { status: label, pct: (state.pct != null ? state.pct : null), disabled: true });
  } else if (state.status === 'done') {
    setPullUI(wrap, { status: ` Pulled ${state.count != null ? state.count + ' ' : ''}vehicles.`, pct: 100, disabled: false });
    // Only refresh the catalog/feeds when this 'done' is a fresh event — re-rendering
    // re-applies the persisted state with reactToDone=false, so no reload loop.
    if (reactToDone) {
      loadInventoryCatalog?.();
      loadInsights?.();
      setTimeout(() => loadInventoryFeeds?.(), 1500);  // platform/flag changed → collapse the box
    }
  } else if (state.status === 'error') {
    setPullUI(wrap, { status: state.error || 'Capture failed — try again.', pct: null, disabled: false });
  }
}

function setPullUI(wrap, { status, pct, disabled } = {}) {
  if (!wrap) return;
  const btn = wrap.querySelector('.ms-pull-btn');
  const st = wrap.querySelector('.ms-pull-status');
  const track = wrap.querySelector('.ms-pull-track');
  const fill = wrap.querySelector('.ms-pull-fill');
  if (btn && disabled != null) {
    btn.disabled = disabled;
    btn.textContent = disabled ? 'Pulling…' : 'Pull Inventory';
    btn.classList.toggle('opacity-60', disabled);
  }
  if (st && status != null) st.textContent = status;
  if (track && fill) {
    if (pct == null) { track.style.display = 'none'; }
    else { track.style.display = 'block'; fill.style.width = `${Math.max(0, Math.min(100, pct))}%`; }
  }
}

// ── Global leaderboard (platform-wide, anonymized) ──────────────────────────────
let __glData = null;
let __glTab = 'reps';

function initGlobalLeaderboard() {
  if (window.__glWired) return;
  window.__glWired = true;
  applyLeaderboardProductPresentation();

  // Populate compact tier dots in #lb-legend-tiers
  const tiersEl = document.getElementById('lb-legend-tiers');
  if (tiersEl && !tiersEl.children.length) {
    tiersEl.innerHTML = LB_TIERS.map(t => {
      const isLegend = t.name === 'Legend';
      const marker = isLegend
        ? `<span class="text-indigo-500">${svgIcon('trophy', 'w-3.5 h-3.5')}</span>`
        : `<span class="inline-block w-2 h-2 rounded-full" style="background:${TIER_DOT[t.name] || '#94a3b8'}"></span>`;
      return `<span class="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">${marker}${t.name} <span class="text-slate-400">${t.min >= 1000 ? (t.min/1000)+'k' : t.min}pts</span></span>`;
    }).join('');
  }

  // Carousel: My Team ↔ Global
  let __glLoaded = false;
  const tabTeam = document.getElementById('lb-tab-team');
  const tabGlobal = document.getElementById('lb-tab-global');
  const viewTeam = document.getElementById('lb-view-team');
  const viewGlobal = document.getElementById('lb-view-global');
  const convWrap = document.getElementById('lb-conv-wrap');

  function setCarouselTab(tab) {
    const onTeam = tab === 'team';
    [tabTeam, tabGlobal].forEach(b => {
      if (!b) return;
      b.classList.toggle('bg-white', b.id === (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
      b.classList.toggle('dark:bg-slate-800', b.id === (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
      b.classList.toggle('text-indigo-600', b.id === (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
      b.classList.toggle('dark:text-indigo-400', b.id === (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
      b.classList.toggle('text-slate-600', b.id !== (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
      b.classList.toggle('dark:text-slate-300', b.id !== (onTeam ? 'lb-tab-team' : 'lb-tab-global'));
    });
    if (viewTeam) viewTeam.classList.toggle('hidden', !onTeam);
    if (viewGlobal) viewGlobal.classList.toggle('hidden', onTeam);
    if (convWrap) convWrap.classList.toggle('hidden', !onTeam);
    if (!onTeam && !__glLoaded) { __glLoaded = true; loadGlobalLeaderboard(); }
  }

  if (tabTeam) tabTeam.addEventListener('click', () => setCarouselTab('team'));
  if (tabGlobal) tabGlobal.addEventListener('click', () => setCarouselTab('global'));
  setCarouselTab('team'); // default active

  document.querySelectorAll('.gl-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      __glTab = btn.dataset.glTab;
      document.querySelectorAll('.gl-tab').forEach(b => {
        const on = b === btn;
        b.classList.toggle('bg-white', on);
        b.classList.toggle('dark:bg-slate-800', on);
        b.classList.toggle('text-indigo-600', on);
        b.classList.toggle('dark:text-indigo-400', on);
        b.classList.toggle('text-slate-600', !on);
        b.classList.toggle('dark:text-slate-300', !on);
      });
      renderGlobalLeaderboard();
    });
  });
}

async function loadGlobalLeaderboard() {
  const body = document.getElementById('gl-body');
  if (!body) return;
  try {
    const res = await fetch(`${API}/leaderboard/global`, { headers: { 'Authorization': `Bearer ${token}` } });
    __glData = res.ok ? await res.json() : null;
  } catch { __glData = null; }
  renderGlobalLeaderboard();
}

function renderGlobalLeaderboard() {
  const body = document.getElementById('gl-body');
  const youEl = document.getElementById('gl-you');
  if (!body) return;
  if (!__glData) {
    body.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 italic">Global leaderboard unavailable right now.</td></tr>';
    if (youEl) youEl.classList.add('hidden');
    return;
  }
  const rows = __glTab === 'dealers' ? __glData.dealers : __glData.reps;
  const you = __glTab === 'dealers' ? __glData.you_dealer : __glData.you_rep;
  const total = __glTab === 'dealers' ? __glData.total_dealers : __glData.total_reps;
  const avgPts = __glTab === 'dealers' ? __glData.avg_dealer_points : __glData.avg_rep_points;
  const avgPosted = __glTab === 'dealers' ? __glData.avg_dealer_posted : __glData.avg_rep_posted;
  const avgConv = __glTab === 'dealers' ? __glData.avg_dealer_conv : __glData.avg_rep_conv;

  // Update avg strip
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; };
  const yourConv = you && you.posted > 0 ? Math.round((you.sold / you.posted) * 100) : (you ? 0 : null);
  set('gl-your-pts', you != null ? (you.points || 0).toLocaleString() : '—');
  set('gl-avg-pts', avgPts != null ? avgPts.toLocaleString() : '—');
  set('gl-your-posted', you != null ? (you.posted ?? 0) : '—');
  set('gl-avg-posted', avgPosted != null ? avgPosted : '—');
  set('gl-your-conv', yourConv != null ? yourConv + '%' : '—');
  set('gl-avg-conv', avgConv != null ? avgConv + '%' : '—');

  // Render global podium (top 3)
  const podiumEl = document.getElementById('gl-podium');
  if (podiumEl && rows && rows.length) {
    const top3 = rows.slice(0, 3);
    const order = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd
    const heights = ['h-20', 'h-28', 'h-16'];
    // Winner (center, i===1) gets a trophy; the runners-up get a star.
    const medalIcon = (i) => i === 1
      ? `<span class="text-amber-500">${svgIcon('trophy', 'w-7 h-7')}</span>`
      : `<span class="text-slate-400">${svgIcon('star', 'w-5 h-5')}</span>`;
    const gradients = ['from-slate-300 to-slate-400', 'from-yellow-300 to-amber-500', 'from-orange-300 to-orange-500'];
    const nums = ['2', '1', '3'];
    podiumEl.innerHTML = order.map((r, i) => {
      const avatarHtml = r.avatar_url
        ? `<img src="${r.avatar_url}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow mb-1 mt-1" />`
        : `<div class="w-10 h-10 rounded-full bg-indigo-200 dark:bg-indigo-700 flex items-center justify-center text-indigo-700 dark:text-indigo-200 font-bold text-base mb-1 mt-1">${(r.name || '?')[0].toUpperCase()}</div>`;
      return `
        <div class="flex flex-col items-center text-center">
          <div class="mb-1 flex items-center justify-center h-8">${medalIcon(i)}</div>
          ${avatarHtml}
          <div class="font-bold text-sm text-slate-900 dark:text-white truncate w-full">${r.name}${r.isYou ? ' <span class="text-xs text-indigo-500 font-normal">(you)</span>' : ''}</div>
          <div class="text-xs font-mono text-slate-600 dark:text-slate-300 mt-1 mb-2">${(r.points || 0).toLocaleString()} pts</div>
          <div class="w-full mt-2 rounded-t-lg bg-gradient-to-b ${gradients[i]} ${heights[i]} flex items-start justify-center pt-2 text-white font-black text-xl shadow-inner">${nums[i]}</div>
        </div>`;
    }).join('');
  } else if (podiumEl) {
    podiumEl.innerHTML = '';
  }

  if (youEl) youEl.classList.add('hidden');

  if (!rows || !rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500 italic">No ${__glTab} on the board yet.</td></tr>`;
    return;
  }

  const youInList = rows.some(r => r.isYou);
  const makeRow = (r, pinned) => {
    const hl = r.isYou ? 'bg-indigo-50 dark:bg-indigo-950/40 font-semibold' : '';
    const rank = rankBadge(r.rank);
    const sep = pinned ? '<tr><td colspan="5" class="py-0"><div class="border-t-2 border-dashed border-indigo-300 dark:border-indigo-700"></div></td></tr>' : '';
    const avatarCell = r.avatar_url
      ? `<img src="${r.avatar_url}" class="w-6 h-6 rounded-full object-cover inline-block mr-1.5 align-middle border ${r.isYou ? 'border-indigo-300' : 'border-slate-300 dark:border-slate-600'}" />`
      : `<span class="inline-flex w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 items-center justify-center text-xs font-bold text-slate-500 mr-1.5 align-middle">${(r.name || '?')[0].toUpperCase()}</span>`;
    return `${sep}<tr class="${hl}">
      <td class="py-2.5 px-3 text-left tabular-nums">${rank}</td>
      <td class="py-2.5 px-3 text-left text-slate-900 dark:text-white">${avatarCell}${r.name}${r.isYou ? ' <span class="text-xs text-indigo-500 font-normal">(you)</span>' : ''}</td>
      <td class="py-2.5 px-3 text-right font-mono">${(r.points || 0).toLocaleString()}</td>
      <td class="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">${r.posted ?? '—'}</td>
      <td class="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">${r.sold ?? '—'}</td>
    </tr>`;
  };

  let html = rows.map(r => makeRow(r, false)).join('');
  if (!youInList && you) {
    html += makeRow({ ...you, isYou: true }, true);
  }
  body.innerHTML = html;
}

async function deleteFeed(id) {
  if (!confirm('Remove this inventory feed?\n\nAll synced vehicles from this feed will also be removed from your catalog. This cannot be undone.')) return;
  showSyncStatus('Removing feed and its inventory…', 'info');
  try {
    const res = await fetch(`${API}/inventory-feeds/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    const n = data.inventory_deleted || 0;
    showSyncStatus(n > 0 ? ` Feed removed · ${n} vehicles cleared from catalog.` : ' Feed removed.', 'ok');
    loadInventoryFeeds();
    loadInventoryCatalog();   // refresh the catalog grid so deleted vehicles disappear
    loadInsights();           // update the metric strip counts
  } catch (err) {
    showSyncStatus(err.message, 'err');
  }
}

async function addFeed(feedUrl, feedType) {
  // Find the submit button + URL input so we can show loading state.
  // Probing every platform's URL can take 5-30s — without feedback users think nothing's happening.
  const form = document.getElementById('add-feed-form');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const urlInput = document.getElementById('add-feed-url');
  const originalBtnText = submitBtn?.textContent || 'Add Feed';

  showSyncStatus(`Probing ${feedUrl} … this can take 10-30s while we try known dealer platforms.`, 'info');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding…'; }
  if (urlInput) urlInput.disabled = true;

  try {
    const res = await fetch(`${API}/inventory-feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ feed_url: feedUrl, feed_type: feedType })
    });
    const data = await res.json();
    if (!res.ok) {
      const attempts = Array.isArray(data.attempted) ? `\nTried: ${data.attempted.join(' · ')}` : '';
      throw new Error((data.error || 'Add failed') + attempts);
    }
    const platform = data.platform ? ` · ${data.platform}` : '';

    // Cloudflare-protected dealer: server can't reach it. The feed was saved flagged
    // for extension capture — guide the user to the browser extension instead of
    // auto-syncing (which would return nothing from the server).
    if (data.needs_extension_capture) {
      showSyncStatus(
        ` Feed added${platform}. This dealer blocks server access (Cloudflare). Open the MarketSync browser extension and click "Connect dealer site" to pull inventory from your own browser session.`,
        'ok'
      );
      loadInventoryFeeds();
      if (urlInput) urlInput.value = '';
      return;
    }

    showSyncStatus(` Feed added${platform}. Pulling inventory now…`, 'ok');
    loadInventoryFeeds();
    if (urlInput) urlInput.value = '';

    // Auto-trigger the first sync so the user doesn't have to click Sync Now manually.
    // Skips the dashboard's syncNow() wrapper because we want to keep using the
    // already-disabled submit button to gate the second action.
    try {
      const syncRes = await fetch(`${API}/inventory/sync`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      const syncData = await syncRes.json();
      if (syncRes.ok && syncData.needs_extension_capture) {
        showSyncStatus(
          ` Feed added. This dealer's site blocks server access (Cloudflare) — we've switched it to browser capture. Open the MarketSync extension and click "Pull Inventory" to pull from your own browser session.`,
          'ok'
        );
        loadInventoryFeeds();
      } else if (syncRes.ok && syncData.success) {
        const b = syncData.skip_breakdown || {};
        const reasons = []
        if (b.feed_type > 0) reasons.push(`${b.feed_type} wrong condition`)
        if (b.offline > 0) reasons.push(`${b.offline} offline`)
        if (b.no_identifier > 0) reasons.push(`${b.no_identifier} no VIN/stock #`)
        if (b.upsert_error > 0) reasons.push(`${b.upsert_error} DB errors`)
        const skipNote = syncData.skipped > 0
          ? ` · ${syncData.skipped} skipped (${reasons.join(', ') || 'misc'})`
          : ''
        showSyncStatus(
          ` Feed added. Synced ${syncData.unique_vehicles} unique vehicles (${syncData.available_after_sync} available)${skipNote}.`,
          'ok'
        );
        loadInsights?.()
        loadInventoryCatalog?.()
      } else {
        showSyncStatus(` Feed added. First sync had an issue — click Sync Now to retry.`, 'err');
      }
    } catch (e) {
      showSyncStatus(` Feed added — click Sync Now to pull inventory.`, 'ok');
    }
  } catch (err) {
    showSyncStatus(err.message, 'err');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
    if (urlInput) urlInput.disabled = false;
  }
}

async function syncNow() {
  const btn = document.getElementById('sync-now-btn');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Syncing… 0%';
  showSyncStatus('Sync running — this can take a minute depending on inventory size.', 'info');

  // Poll live progress so the user sees an accurate, moving percentage (and knows
  // the sync isn't frozen). Stops in the finally block when the sync POST resolves.
  const pollProgress = async () => {
    try {
      const r = await fetch(`${API}/inventory/sync/progress`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) return;
      const p = await r.json();
      if (p && typeof p.pct === 'number' && p.phase !== 'idle' && p.phase !== 'done' && p.phase !== 'error') {
        btn.textContent = `Syncing… ${p.pct}%`;
        if (p.message) showSyncStatus(p.message, 'info');
      }
    } catch { /* transient — keep polling */ }
  };
  const progressTimer = setInterval(pollProgress, 900);

  try {
    const res = await fetch(`${API}/inventory/sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sync failed');
    const dupNote = data.duplicates_merged > 0 ? ` · ${data.duplicates_merged} duplicate VINs merged` : '';
    // Build a real skip reason from the breakdown — replaces the misleading "sale-pending / offline" generic
    let skipNote = '';
    if (data.skipped > 0) {
      const b = data.skip_breakdown || {};
      const reasons = [];
      if (b.feed_type > 0) reasons.push(`${b.feed_type} wrong condition`);
      if (b.offline > 0) reasons.push(`${b.offline} offline`);
      if (b.no_identifier > 0) reasons.push(`${b.no_identifier} no VIN/stock #`);
      if (b.upsert_error > 0) reasons.push(`${b.upsert_error} DB errors`);
      skipNote = reasons.length
        ? ` · ${data.skipped} skipped (${reasons.join(', ')})`
        : ` · ${data.skipped} skipped`;
    }
    // Cloudflare/JS-gated site the server couldn't read — the feed was flipped to
    // browser capture. Point the dealer at the extension's Pull Inventory fallback.
    if (data.needs_extension_capture) {
      showSyncStatus(
        `This dealer's site blocks server access (Cloudflare). We've switched it to browser capture — open the MarketSync extension and click "Pull Inventory" (below) to pull your inventory from your own browser session.`,
        'ok'
      );
      loadInventoryFeeds?.();
    } else {
      showSyncStatus(
        `Synced ${data.unique_vehicles} unique vehicles (${data.available_after_sync} available)${dupNote}${skipNote}.`,
        'ok'
      );
    }
    // Refresh insights + catalog after a sync
    loadInsights();
    loadInventoryCatalog();
  } catch (err) {
    showSyncStatus(err.message, 'err');
  } finally {
    clearInterval(progressTimer);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function showSyncStatus(text, kind) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = text;
  el.className = kind === 'ok'
    ? 'mb-3 p-2 text-xs rounded bg-emerald-100 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200'
    : kind === 'err'
      ? 'mb-3 p-2 text-xs rounded bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-200'
      : 'mb-3 p-2 text-xs rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300';
  el.classList.remove('hidden');
}

window.syncNow = syncNow;
window.addFeedFromInput = addFeedFromInput;
window.showSyncStatus = showSyncStatus;

// INVENTORY CATALOG: full vehicle browser
let __catalogCache = [];
let __marketPositions = {};   // inventory_id → market median (Inventory Intelligence)
let __marketMeta = {};        // inventory_id → { count, trim_matched } comp quality
let __marketVerdicts = {};    // inventory_id → { verdict, headline, reason, price_at_generation }

// Carfax: open the dealer's embedded Carfax report for this VIN (scraped from the
// vehicle's listing page + cached), falling back to a Carfax Canada VIN search.
async function openCarfax(id, vin) {
  const w = window.open('about:blank', '_blank');
  const fallback = vin ? `${CARFAX_BASE}${encodeURIComponent(vin)}` : 'https://www.carfax.ca/';
  try {
    const r = await fetch(`${API}/inventory/${id}/carfax`, { headers: { 'Authorization': `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    const url = d.url || fallback;
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
    if (d.source === 'fallback') showToast('No Carfax badge on that listing — opened a Carfax search instead.', 'info');
  } catch {
    if (w) w.location.href = fallback; else window.open(fallback, '_blank', 'noopener');
  }
}

// ── Vehicle history: Carfax deep-link + stored reports (VHR / lien / valuation) ──
async function openVehicleHistory(opts = {}) {
  const { inventory_id = null, vin = '', label = 'Vehicle', contact_id = null, deal_id = null } = opts;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[72] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  const CI = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 dark:text-white';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg my-10 shadow-2xl">
    <div class="flex items-center justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
      <div><h3 class="text-base font-bold text-slate-900 dark:text-white">Vehicle history</h3><div class="text-xs text-slate-400">${esc(label)}${vin ? ' · VIN ' + esc(vin) : ''}</div></div>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="p-5 space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Pull Carfax</span>
        <a href="https://www.carfax.ca/vehicle-history-reports?vin=${encodeURIComponent(vin)}" target="_blank" rel="noopener" class="text-xs font-bold bg-[#0a1e3f] hover:bg-[#122a52] text-white px-3 py-1.5 rounded-lg">Carfax Canada </a>
        <a href="https://www.carfax.com/vehicle/${encodeURIComponent(vin)}" target="_blank" rel="noopener" class="text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg">Carfax US</a>
        <span class="text-[11px] text-slate-400">then attach the report below</span>
      </div>
      <div class="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
        <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Attach a report</div>
        <div class="grid grid-cols-2 gap-2">
          <select data-type class="${CI}"><option value="vhr">History (VHR)</option><option value="lien">Lien check</option><option value="valuation">Valuation</option><option value="other">Other</option></select>
          <input data-provider value="carfax" class="${CI}" placeholder="Provider">
        </div>
        <input data-file type="file" accept="application/pdf,image/*" class="${CI} w-full text-xs">
        <input data-link class="${CI} w-full" placeholder="…or paste a report link (URL)">
        <button data-save class="w-full text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save report</button>
      </div>
      <div><div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Stored reports</div><div data-list class="space-y-1.5 text-sm"><div class="text-slate-400 italic text-xs py-2">Loading…</div></div></div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });
  const listEl = modal.querySelector('[data-list]');

  const load = async () => {
    const p = new URLSearchParams();
    if (inventory_id) p.set('inventory_id', inventory_id);
    else if (deal_id) p.set('deal_id', deal_id);
    else if (contact_id) p.set('contact_id', contact_id);
    else if (vin) p.set('vin', vin);
    try {
      const d = await apiGetJson(`/history?${p}`);
      const rows = d?.reports || [];
      listEl.innerHTML = rows.length ? rows.map(r => {
        const link = r.file_url || r.external_url;
        const when = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
        return `<div class="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
          <div class="min-w-0"><div class="font-semibold text-slate-800 dark:text-slate-100 truncate">${esc((r.report_type || 'vhr').toUpperCase())} · ${esc(r.provider || 'carfax')}</div><div class="text-[11px] text-slate-400">${when}</div></div>
          <div class="flex items-center gap-2 shrink-0">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">Open</a>` : ''}<button data-del="${r.id}" class="text-xs font-bold text-rose-500 hover:text-rose-600">Delete</button></div>
        </div>`;
      }).join('') : '<div class="text-slate-400 italic text-xs py-2">No reports stored yet.</div>';
      listEl.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        try { await fetch(`${API}/history/${b.dataset.del}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); load(); }
        catch { showToast('Could not delete', 'error'); }
      }));
    } catch (e) { listEl.innerHTML = `<div class="text-rose-400 text-xs py-2">${esc(e.message || 'Could not load')}</div>`; }
  };

  modal.querySelector('[data-save]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const file = modal.querySelector('[data-file]').files[0];
    const linkUrl = modal.querySelector('[data-link]').value.trim();
    if (!file && !linkUrl) { showToast('Attach a file or paste a report link.', 'error'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (linkUrl) fd.append('external_url', linkUrl);
      fd.append('vin', vin || '');
      fd.append('report_type', modal.querySelector('[data-type]').value);
      fd.append('provider', modal.querySelector('[data-provider]').value.trim() || 'carfax');
      if (inventory_id) fd.append('inventory_id', inventory_id);
      if (contact_id) fd.append('contact_id', contact_id);
      if (deal_id) fd.append('deal_id', deal_id);
      const r = await fetch(`${API}/history`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Save failed');
      modal.querySelector('[data-file]').value = ''; modal.querySelector('[data-link]').value = '';
      showToast('Report saved.', 'success'); load();
    } catch (e) { showToast(e.message || 'Save failed', 'error'); }
    btn.disabled = false; btn.textContent = 'Save report';
  });
  load();
}
window.openVehicleHistory = openVehicleHistory;

// ══ Manual inventory: add/edit a vehicle with photos ═════════════════════════
// MarketSync as the source of truth — dealers load units here, photos and all,
// and everything (website, syndication) reads from this.
let __vehExistingUrls = [];   // already-uploaded photo URLs (editable)
let __vehFormFiles = [];      // File objects staged for upload
// Rendered-car placeholder for photoless stock cards — the car on the dealer's
// chosen background (if set), else a neutral gradient.
function catalogCarPlaceholder(cls) {
  const bg = (typeof __photoBackgroundUrl !== 'undefined' && __photoBackgroundUrl) ? __photoBackgroundUrl : null;
  const style = bg ? `background-image:url('${esc(bg)}');background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#334155,#0f172a)';
  return `<div class="${cls} flex items-center justify-center overflow-hidden" style="${style}"><svg viewBox="0 0 120 46" class="w-3/4 max-w-[150px]" style="opacity:.92"><path d="M10 34 h100 a3 3 0 0 0 3-3 v-6 a4 4 0 0 0-3-4 l-14-3 -9-9 a7 7 0 0 0-5-2 H43 a7 7 0 0 0-5 2 l-9 9 -14 3 a4 4 0 0 0-3 4 v6 a3 3 0 0 0 3 3 z" fill="#ffffff" fill-opacity=".9"/><circle cx="34" cy="35" r="7" fill="#0f172a"/><circle cx="86" cy="35" r="7" fill="#0f172a"/><circle cx="34" cy="35" r="3" fill="#fff"/><circle cx="86" cy="35" r="3" fill="#fff"/></svg></div>`;
}
let __photoBackgroundUrl = null;  // dealership branded background (or null)
let __bgProviderReady = false;    // AI cutout provider key configured server-side

function openVehicleForm(vehicle) {
  const v = vehicle || {};
  const isEdit = !!v.id;
  __vehExistingUrls = Array.isArray(v.image_urls) ? v.image_urls.slice() : [];
  __vehFormFiles = [];
  // Enriched VIN decode (safety systems, recalls) held while the form is open, so it
  // saves with the vehicle and enriches the AI copy. Seed from the existing record.
  __vehDecodedVinData = (v.vin_data && typeof v.vin_data === 'object') ? v.vin_data : null;
  __vehDecodedRecalls = Array.isArray(v.recalls) ? v.recalls : null;
  const inp = (id, val, ph, cls = '') => `<input id="${id}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph)}" class="${cls} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const opts = (cur, arr) => arr.map(o => `<option value="${o[0]}" ${String(cur || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('');
  const selCls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-lg font-black text-slate-900 dark:text-white">${isEdit ? 'Edit vehicle' : 'Add vehicle'}</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="flex gap-2">
      ${inp('veh-vin', v.vin, '17-char VIN (optional — auto-fills specs)', 'flex-1 uppercase')}
      ${vinScanBtn('veh-vin', '() => vehDecode()')}
      <button type="button" onclick="vehDecode()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 rounded-lg">Decode</button>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div>${lbl('Year')}${inp('veh-year', v.year, '2021', 'w-full')}</div>
      <div>${lbl('Make')}${inp('veh-make', v.make, 'Make', 'w-full')}</div>
      <div>${lbl('Model')}${inp('veh-model', v.model, 'Model', 'w-full')}</div>
      <div>${lbl('Trim')}${inp('veh-trim', v.trim, 'Trim', 'w-full')}</div>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div>${lbl('Price ($)')}<input id="veh-price" type="text" inputmode="decimal" data-money value="${v.price == null ? '' : msFmtMoney(v.price)}" oninput="vehUpdateGross()" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div>${lbl('Mileage (km)')}${inp('veh-mileage', v.mileage, '', 'w-full')}</div>
      <div>${lbl('Condition')}<select id="veh-condition" class="${selCls}">${opts(v.condition || 'used', [['used', 'Used'], ['new', 'New'], ['demo', 'Demo'], ['certified', 'Certified (CPO)']])}</select></div>
      <div>${lbl('Stock #')}${inp('veh-stock', v.stocknumber, '', 'w-full')}</div>
    </div>
    <div class="grid grid-cols-4 gap-2 items-end">
      <div>${lbl('Invoice / cost ($)')}<input id="veh-invoice" type="text" inputmode="decimal" data-money value="${v.invoice_amount == null ? '' : msFmtMoney(v.invoice_amount)}" placeholder="Dealer cost" oninput="vehUpdateGross()" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div class="col-span-3"><div class="text-[11px] text-slate-400 leading-snug pb-1.5">Front-end gross <span id="veh-gross" class="font-bold text-slate-700 dark:text-slate-200"></span> — internal only; never shown to reps, customers or your website.</div></div>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div>${lbl('Ext. colour')}${inp('veh-ext', v.exterior_color, '', 'w-full')}</div>
      <div>${lbl('Int. colour')}${inp('veh-int', v.interior_color, '', 'w-full')}</div>
      <div>${lbl('Drivetrain')}<select id="veh-drive" class="${selCls}">${opts(v.drivetrain, [['', '—'], ['FWD', 'FWD'], ['RWD', 'RWD'], ['AWD', 'AWD'], ['4WD', '4WD']])}</select></div>
      <div>${lbl('Doors')}${inp('veh-doors', v.doors, '', 'w-full')}</div>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div>${lbl('Transmission')}${inp('veh-trans', v.transmission, '', 'w-full')}</div>
      <div>${lbl('Fuel')}${inp('veh-fuel', v.fuel_type, '', 'w-full')}</div>
      <div>${lbl('Engine')}${inp('veh-engine', v.engine, '', 'w-full')}</div>
      <div>${lbl('Body')}${inp('veh-body', v.body_style, '', 'w-full')}</div>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Description</label>
        <button type="button" onclick="vehAiMenu(event,'description')" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500"> AI</button>
      </div>
      <textarea id="veh-desc" rows="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(v.description || '')}</textarea>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sales pitch <span class="text-slate-400 font-normal">(shown on your website)</span></label>
        <button type="button" onclick="vehAiMenu(event,'pitch')" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500"> AI</button>
      </div>
      <textarea id="veh-pitch" rows="3" placeholder="A compelling pitch for this car. Click  AI, or type your own." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(v.sales_pitch || '')}</textarea>
    </div>
    <div class="border-t border-slate-200 dark:border-slate-700 pt-3">
      <div class="text-sm font-black text-slate-900 dark:text-white">Key specs</div>
      <p class="text-[11px] text-slate-400 mb-2">The VIN decode can't provide these — enter what you know. Each shows on your website's vehicle page only if filled in.</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>${lbl('Towing capacity')}${inp('veh-sp-tow', (v.specs_manual || {}).towing_capacity, 'e.g. 7,700 lb', 'w-full')}</div>
        <div>${lbl('Horsepower')}${inp('veh-sp-hp', (v.specs_manual || {}).horsepower, 'e.g. 310 hp', 'w-full')}</div>
        <div>${lbl('Torque')}${inp('veh-sp-tq', (v.specs_manual || {}).torque, 'e.g. 430 lb-ft', 'w-full')}</div>
        <div>${lbl('Curb weight')}${inp('veh-sp-cw', (v.specs_manual || {}).curb_weight, 'e.g. 4,900 lb', 'w-full')}</div>
        <div>${lbl('Payload')}${inp('veh-sp-pl', (v.specs_manual || {}).payload, 'e.g. 1,550 lb', 'w-full')}</div>
        <div>${lbl('Seating')}${inp('veh-sp-seat', (v.specs_manual || {}).seating, 'e.g. 5', 'w-full')}</div>
        <div>${lbl('Fuel economy')}${inp('veh-sp-fe', (v.specs_manual || {}).fuel_economy, 'e.g. 11.5/8.0 L/100km', 'w-full')}</div>
        <div>${lbl('Cargo / bed')}${inp('veh-sp-cargo', (v.specs_manual || {}).cargo, 'e.g. 5 ft 2 in box', 'w-full')}</div>
      </div>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1">
        ${lbl('Photos')}
        <button type="button" onclick="openPhotoBackgroundUploader()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">${__photoBackgroundUrl ? 'Change branded background' : 'Set branded background'}</button>
      </div>
      <div id="veh-photos" class="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-2"></div>
      <input id="veh-file" type="file" accept="image/*" multiple class="hidden" onchange="vehAddFiles(this.files); this.value='';">
      <input id="veh-cam" type="file" accept="image/*" capture="environment" class="hidden" onchange="vehAddFiles(this.files); this.value='';">
      <div class="grid grid-cols-2 gap-2">
        <button type="button" onclick="document.getElementById('veh-file').click()" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 rounded-lg py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 transition">+ Add photos</button>
        <button type="button" onclick="document.getElementById('veh-cam').click()" class="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 rounded-lg py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 transition flex items-center justify-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z"/></svg>Take photo</button>
      </div>
      ${__photoBackgroundUrl ? `<label class="flex items-center gap-2 mt-2 text-xs ${__bgProviderReady ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}">
        <input id="veh-bg-toggle" type="checkbox" ${__bgProviderReady ? 'checked' : 'disabled'} class="accent-indigo-600">
        Put these photos on our branded background${__bgProviderReady ? '' : ' (AI background not enabled yet)'}
        <img src="${esc(__photoBackgroundUrl)}" class="w-8 h-6 object-cover rounded ml-auto border border-slate-200 dark:border-slate-700">
      </label>` : ''}
    </div>
    <div class="flex gap-2 items-center justify-between pt-1">
      <div>${isEdit ? `<button onclick="vehDelete('${v.id}')" class="text-sm font-bold text-rose-600 hover:text-rose-500 px-2 py-2">Delete</button>` : ''}</div>
      <div class="flex gap-2">
        <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
        <button onclick="vehSave(this, ${isEdit ? `'${v.id}'` : 'null'})" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">${isEdit ? 'Save' : 'Add vehicle'}</button>
      </div>
    </div>
  </div>`, 'max-w-2xl');
  renderVehPhotos();
  vehUpdateGross();
}
// Live front-end gross in the vehicle form: price − invoice (managers only).
function vehUpdateGross() {
  const el = document.getElementById('veh-gross'); if (!el) return;
  const price = msNum(document.getElementById('veh-price')?.value) || 0;
  const invRaw = document.getElementById('veh-invoice')?.value;
  const inv = msNum(invRaw);
  if (invRaw === '' || invRaw == null || !(inv > 0) || !(price > 0)) { el.textContent = ''; return; }
  const gross = price - inv;
  el.textContent = `${gross >= 0 ? '+' : '−'}$${Math.abs(gross).toLocaleString()}`;
  el.className = 'font-bold ' + (gross >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400');
}
window.vehUpdateGross = vehUpdateGross;
function renderVehPhotos() {
  const box = document.getElementById('veh-photos');
  if (!box) return;
  const thumbs = [];
  __vehExistingUrls.forEach((u, i) => thumbs.push(`<div class="relative aspect-square"><img src="${esc(u)}" class="w-full h-full object-cover rounded-lg"><button type="button" onclick="vehRemoveExisting(${i})" class="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center">×</button></div>`));
  __vehFormFiles.forEach((f, i) => thumbs.push(`<div class="relative aspect-square"><img src="${URL.createObjectURL(f)}" class="w-full h-full object-cover rounded-lg opacity-90"><button type="button" onclick="vehRemoveFile(${i})" class="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 text-xs leading-none flex items-center justify-center">×</button><span class="absolute bottom-0.5 left-0.5 bg-indigo-600 text-white text-[8px] font-bold px-1 rounded">new</span></div>`));
  box.innerHTML = thumbs.join('') || '<div class="col-span-full text-xs text-slate-400 italic py-2">No photos yet — the first one becomes the main photo.</div>';
}
function vehAddFiles(fileList) { __vehFormFiles.push(...Array.from(fileList || [])); renderVehPhotos(); }
function vehRemoveFile(i) { __vehFormFiles.splice(i, 1); renderVehPhotos(); }
function vehRemoveExisting(i) { __vehExistingUrls.splice(i, 1); renderVehPhotos(); }
let __vehDecodedVinData = null;   // enriched NHTSA vin_data held while the form is open
let __vehDecodedRecalls = null;   // recall list from the enriched decode
// Fill the add/edit form from a decoded VIN. Prefers the ENRICHED decoder
// (/vin/decode — safety systems, plant, recalls, extra fields) and falls back to
// the lightweight decoder when Inventory Intelligence isn't active.
async function vehDecode() {
  const vin = (document.getElementById('veh-vin')?.value || '').trim().toUpperCase();
  if (vin.length !== 17) { showToast('Enter a 17-character VIN', 'error'); return; }
  const btn = document.querySelector('[onclick="vehDecode()"]');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Decoding…'; }
  const setDrive = (val) => { const dt = document.getElementById('veh-drive'); if (dt && val) { const u = String(val).toUpperCase(); dt.value = /AWD|ALL|4MATIC|QUATTRO/.test(u) ? 'AWD' : /4WD|4X4/.test(u) ? '4WD' : /RWD|REAR/.test(u) ? 'RWD' : /FWD|FRONT/.test(u) ? 'FWD' : ''; } };
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null && val !== '') el.value = val; };
  try {
    // Enriched decode first — GET /vin/decode/:vin returns { decoded, recalls, all_fields }.
    const er = await fetch(`${API}/vin/decode/${encodeURIComponent(vin)}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (er.ok) {
      const ed = await er.json();
      const d = ed.decoded || {};
      set('veh-year', d.year); set('veh-make', d.make); set('veh-model', d.model); set('veh-trim', d.trim);
      set('veh-trans', d.transmission); set('veh-fuel', d.fuel_type); set('veh-engine', d.engine);
      set('veh-body', d.body_style); set('veh-doors', d.doors); setDrive(d.drivetrain);
      __vehDecodedVinData = (d.vin_data && typeof d.vin_data === 'object') ? d.vin_data : null;
      __vehDecodedRecalls = Array.isArray(ed.recalls) ? ed.recalls : null;
      const nRec = __vehDecodedRecalls ? __vehDecodedRecalls.length : 0;
      showToast(nRec ? `VIN decoded —  ${nRec} open recall${nRec > 1 ? 's' : ''} flagged` : 'VIN decoded — full specs & recall check', 'success');
      return;
    }
    // 403 = no Inventory Intelligence → fall back to the free lightweight decoder.
    if (er.status !== 403) { const ej = await er.json().catch(() => ({})); throw new Error(ej.error || 'Decode failed'); }
    const r = await fetch(`${API}/ai/vin-decode`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ vin }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Decode failed');
    set('veh-year', d.year); set('veh-make', d.make); set('veh-model', d.model); set('veh-trim', d.trim);
    set('veh-trans', d.transmission); set('veh-fuel', d.fuel_type); set('veh-engine', d.engine); set('veh-body', d.body_type || d.body_style);
    setDrive(d.drivetrain);
    showToast('VIN decoded', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = orig; } }
}
// Collect the current form's vehicle facts so the  AI writer has real context
// even before the vehicle is saved (year/make/model + specs + decoded VIN data).
function vehFormFacts() {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  const valn = (i) => val(i).replace(/,/g, '');   // data-money fields carry commas
  return {
    year: val('veh-year'), make: val('veh-make'), model: val('veh-model'), trim: val('veh-trim'),
    condition: document.getElementById('veh-condition')?.value || 'used', mileage: val('veh-mileage'), price: valn('veh-price'),
    exterior_color: val('veh-ext'), interior_color: val('veh-int'), drivetrain: document.getElementById('veh-drive')?.value || '',
    doors: val('veh-doors'), transmission: val('veh-trans'), fuel_type: val('veh-fuel'), engine: val('veh-engine'), body_style: val('veh-body'),
    specs_manual: {
      towing_capacity: val('veh-sp-tow'), horsepower: val('veh-sp-hp'), torque: val('veh-sp-tq'), curb_weight: val('veh-sp-cw'),
      payload: val('veh-sp-pl'), seating: val('veh-sp-seat'), fuel_economy: val('veh-sp-fe'), cargo: val('veh-sp-cargo'),
    },
    vin_data: __vehDecodedVinData || undefined,
  };
}
//  AI menu for the vehicle Description / Sales-pitch fields — same modes as the
// automation & website writers (boost / fresh / short / long / seo).
function vehAiMenu(ev, field) {
  ev.stopPropagation();
  document.querySelectorAll('.ai-menu').forEach(m => m.remove());
  const acts = [['boost', ' Boost what\'s here'], ['fresh', 'Rewrite fresh'], ['short', 'Shorter version'], ['long', 'Longer version'], ['seo', 'SEO rewrite']];
  const m = document.createElement('div');
  m.className = 'ai-menu fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[170px]';
  const r = ev.currentTarget.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, r.right - 180) + 'px';
  m.innerHTML = acts.map(a => `<button class="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onclick="vehAiRun('${field}','${a[0]}');this.closest('.ai-menu').remove()">${a[1]}</button>`).join('');
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }, { once: true }), 10);
}
async function vehAiRun(field, task) {
  const taId = field === 'pitch' ? 'veh-pitch' : 'veh-desc';
  const ta = document.getElementById(taId); if (!ta) return;
  const facts = vehFormFacts();
  if (!facts.make || !facts.model) { showToast('Add at least the make and model first (or Decode a VIN).', 'info'); return; }
  showToast(' Writing…', 'info');
  try {
    const d = await apiSendJson('/ai/vehicle-copy', 'POST', { field, task, vehicle: facts, current: ta.value });
    if (d.text) { ta.value = d.text; showToast(' Done — review & Save', 'success'); }
    else showToast('Could not generate copy', 'error');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? `AI writing needs AI Boost (or your free trial).` : e.message, 'error'); }
}
async function vehSave(btn, id) {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  const valn = (i) => val(i).replace(/,/g, '');   // strip commas from data-money fields
  const body = {
    vin: val('veh-vin'), year: val('veh-year'), make: val('veh-make'), model: val('veh-model'), trim: val('veh-trim'),
    price: valn('veh-price'), invoice_amount: valn('veh-invoice'), mileage: val('veh-mileage'), condition: document.getElementById('veh-condition')?.value || 'used',
    stocknumber: val('veh-stock'), exterior_color: val('veh-ext'), interior_color: val('veh-int'),
    drivetrain: document.getElementById('veh-drive')?.value || '', doors: val('veh-doors'),
    transmission: val('veh-trans'), fuel_type: val('veh-fuel'), engine: val('veh-engine'), body_style: val('veh-body'),
    description: val('veh-desc'), sales_pitch: val('veh-pitch'), image_urls: __vehExistingUrls,
    specs_manual: {
      towing_capacity: val('veh-sp-tow'), horsepower: val('veh-sp-hp'), torque: val('veh-sp-tq'), curb_weight: val('veh-sp-cw'),
      payload: val('veh-sp-pl'), seating: val('veh-sp-seat'), fuel_economy: val('veh-sp-fe'), cargo: val('veh-sp-cargo'),
    },
  };
  // Persist the enriched VIN decode + recall check when the form decoded a VIN.
  if (__vehDecodedVinData) body.vin_data = __vehDecodedVinData;
  if (__vehDecodedRecalls) body.recalls = __vehDecodedRecalls;
  if (!body.make || !body.model) { showToast('Make and model are required', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    let vehId = id;
    if (id) await apiSendJson(`/inventory/${id}`, 'PUT', body);
    else { const d = await apiSendJson('/inventory', 'POST', body); vehId = d.vehicle?.id; }
    if (vehId && __vehFormFiles.length) {
      const useBg = document.getElementById('veh-bg-toggle')?.checked;
      btn.textContent = useBg ? `Applying background to ${__vehFormFiles.length}…` : `Uploading ${__vehFormFiles.length} photo${__vehFormFiles.length > 1 ? 's' : ''}…`;
      const fd = new FormData();
      __vehFormFiles.forEach(f => fd.append('photos', f));
      if (useBg) fd.append('background', '1');
      const r = await fetch(`${API}/inventory/${vehId}/photos`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Photo upload failed'); }
    }
    btn.closest('.fixed').remove();
    showToast(id ? 'Vehicle updated' : 'Vehicle added', 'success');
    if (typeof loadInventoryCatalog === 'function') loadInventoryCatalog();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
// Per-car: write an AI sales pitch and drop it into the form's textarea.
async function vehGenPitch(id, btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = ' Writing…';
  try {
    const d = await apiSendJson('/ai/sales-pitch', 'POST', { ids: [id] });
    const text = d.pitches && d.pitches[id];
    if (text) { const ta = document.getElementById('veh-pitch'); if (ta) ta.value = text; showToast('Sales pitch written — review & Save', 'success'); }
    else showToast(d.limited ? 'Monthly AI limit reached — resets next month.' : 'Could not generate a pitch', 'error');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'Sales pitches need AI Boost (or your free trial).' : e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
// Bulk: write pitches for every available car that doesn't have one yet.
async function generateAllPitches(btn) {
  let inv = (typeof __catalogCache !== 'undefined' && __catalogCache?.length) ? __catalogCache : [];
  if (!inv.length) { try { inv = await apiGetJson('/inventory/all', { retries: 1 }); } catch {} }
  const avail = inv.filter(v => String(v.status || 'available').toLowerCase() === 'available');
  const missing = avail.filter(v => !(v.sales_pitch && String(v.sales_pitch).trim()));
  const ids = (missing.length ? missing : avail).map(v => v.id);
  if (!ids.length) { showToast('No available vehicles to write for.', 'info'); return; }
  const verb = missing.length ? `Write AI sales pitches for the ${ids.length} car${ids.length > 1 ? 's' : ''} without one?` : `Every car already has a pitch. Re-write all ${ids.length}?`;
  if (!confirm(`${verb} This uses AI Boost credits.`)) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = ` Writing ${ids.length}…`;
  try {
    const d = await apiSendJson('/ai/sales-pitch', 'POST', { ids });
    showToast(`Wrote ${d.count} sales pitch${d.count === 1 ? '' : 'es'}${d.limited ? ' — hit the monthly AI limit' : ''}`, d.count ? 'success' : 'error');
    if (typeof loadInventoryCatalog === 'function') loadInventoryCatalog();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message === 'AI Boost not active' ? 'Sales pitches need AI Boost (or your free trial).' : e.message, 'error'); }
}
async function vehDelete(id) {
  if (!id || !confirm('Delete this vehicle and its photos? This cannot be undone.')) return;
  try {
    await apiSendJson(`/inventory/${id}`, 'DELETE');
    showToast('Vehicle deleted', 'success');
    document.querySelector('.fixed')?.remove();
    if (typeof loadInventoryCatalog === 'function') loadInventoryCatalog();
  } catch (e) { showToast(e.message, 'error'); }
}
async function editVehicle(id) {
  const cached = (typeof __catalogCache !== 'undefined' ? __catalogCache : []).find(x => x.id === id);
  if (cached) { openVehicleForm(cached); return; }
  // Not in the inventory-page cache (e.g. opened from the health panel) — fetch it.
  try { const v = await apiGetJson(`/inventory/${id}`, { retries: 1 }); openVehicleForm(v.vehicle || v); }
  catch { showToast('Could not open that unit', 'error'); }
}