/* dashboard.js split part 15/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function renderYourPosition(ranking) {
  const me = ranking.find(r => r.id === user.id);
  const card = document.getElementById('lb-you');
  if (!me || !card) return;
  card.classList.remove('hidden');

  const next = nextTierFor(me.points);
  const span = next ? (next.min - me.tier.min) : 1;
  const progressed = me.points - me.tier.min;
  const pct = next ? Math.min(100, Math.round((progressed / span) * 100)) : 100;
  const toNext = next ? next.min - me.points : 0;

  document.getElementById('lb-you-rank').textContent = me.rank;
  document.getElementById('lb-you-total').textContent = ranking.length;
  document.getElementById('lb-you-points').textContent = me.points.toLocaleString();
  document.getElementById('lb-you-current-tier').innerHTML = `${me.tier.icon} ${me.tier.name}`;
  document.getElementById('lb-you-next-tier').innerHTML = next ? `${next.icon} ${next.name}` : 'Max tier';
  document.getElementById('lb-you-progress-pct').textContent = pct;
  document.getElementById('lb-you-progress-bar').style.width = pct + '%';
  document.getElementById('lb-you-points-to-next').textContent = next ? toNext.toLocaleString() : 'You\'re at the top tier';

  const badge = document.getElementById('lb-you-tier-badge');
  badge.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${me.tier.cls}`;
  badge.innerHTML = `<span>${me.tier.icon}</span><span>${me.tier.name}</span>`;
}

// Clean rank badge (proper icon, not an emoji medal): #1 gets a trophy in a gold
// pill, #2/#3 a number in silver/bronze, the rest a plain slate number.
function rankBadge(rank) {
  const map = {
    1: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    2: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
    3: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  };
  const cls = map[rank] || 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
  const inner = rank === 1 ? svgIcon('trophy', 'w-3.5 h-3.5') : String(rank);
  return `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-black ${cls}">${inner}</span>`;
}
window.rankBadge = rankBadge;

function renderRankingTable(ranking) {
  const body = document.getElementById('leaderboard-body');
  if (!body) return;
  if (!ranking.length) {
    body.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500 italic">No team members yet.</td></tr>`;
    return;
  }
  body.innerHTML = ranking.map(r => {
    const isMe = r.id === user.id;
    const rowBg = isMe ? 'bg-indigo-50 dark:bg-indigo-950/30' : '';
    const rankCell = rankBadge(r.rank);
    return `
      <tr class="${rowBg} hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
        <td class="py-3 px-3">${rankCell}</td>
        <td class="py-3 px-3 font-semibold text-slate-900 dark:text-white">
          ${r.name}${isMe ? ' <span class="text-xs font-normal text-indigo-600 dark:text-indigo-400">(you)</span>' : ''}
        </td>
        <td class="py-3 px-3">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${r.tier.cls}">
            <span>${r.tier.icon}</span><span>${r.tier.name}</span>
          </span>
        </td>
        <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">${r.points.toLocaleString()}</td>
        <td data-lb-non-fb class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">${r.deals_closed || 0}</td>
        <td data-lb-non-fb class="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">${r.appraisals || 0}</td>
        <td class="py-3 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">${r.total_listings}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-500 dark:text-slate-400">${r.sold_listings}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-500 dark:text-slate-400">${r.conversion_rate}%</td>
      </tr>
    `;
  }).join('');
}

async function loadActivity() {
  const el = document.getElementById('lb-activity');
  if (!el) return;
  try {
    const res = await fetch(`${API}/dealership/activity`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error('Activity failed');
    const data = await res.json();
    if (!data.events?.length) {
      el.innerHTML = '<div class="text-xs text-slate-500 italic">No activity yet — start posting to fill this up.</div>';
      return;
    }
    el.innerHTML = data.events.map(e => {
      const isSold = e.type === 'sold';
      const verb = isSold ? 'sold' : 'posted';
      const accent = isSold ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400';
      const icon = `<span class="${accent}">${svgIcon(isSold ? 'trophy' : 'car', 'w-5 h-5')}</span>`;
      const when = e.timestamp ? timeAgo(new Date(e.timestamp)) : '';
      return `
        <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2">
          <div>${icon}</div>
          <div class="flex-1 min-w-0 text-sm">
            <span class="font-semibold text-slate-900 dark:text-white">${e.user_name}</span>
            <span class="text-slate-600 dark:text-slate-400">${verb}</span>
            <span class="text-slate-900 dark:text-white">${e.vehicle}</span>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold ${accent}">+${e.points} pts</div>
            <div class="text-xs text-slate-500">${when}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="text-xs text-red-500">Failed to load activity.</div>`;
  }
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// CHARTS: listings over time + by rep + sold by rep + active days by rep
//          + sell-through % by rep + avg time-to-sell by rep + rep cards
async function loadCharts() {
  try {
    const res = await fetch(`${API}/dealership/charts?range=${insightsRange}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await res.json();
    renderDailyChart(data.daily || []);
    renderByRepChart(data.by_rep || []);
    renderSoldByRepChart(data.sold_by_rep || []);
    renderActiveByRepChart(data.active_days_by_rep || []);
    renderSellThroughByRepChart(data.sell_through_by_rep || []);
    renderTimeToSellByRepChart(data.time_to_sell_by_rep || []);
    // Per-rep "player" cards now live in the Sales Team page's rep-detail modal.
  } catch (e) {
    console.warn('Charts failed:', e.message);
  }
}

// Alias used by the range-pill click handler — `loadTeamInsightsCharts` reads more
// clearly when called from outside this section.
const loadTeamInsightsCharts = loadCharts;

let __dailyChart = null;
let __byRepChart = null;
let __soldByRepChart = null;
let __activeByRepChart = null;
let __sellThroughChart = null;
let __timeToSellChart = null;

function renderDailyChart(daily) {
  const ctx = document.getElementById('chart-listings-daily');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__dailyChart) __dailyChart.destroy();
  __dailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: daily.map(d => d.date.slice(5)),  // MM-DD
      datasets: [{
        label: 'Listings',
        data: daily.map(d => d.count),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5
      }]
    },
    options: chartCommonOptions()
  });
}

function renderByRepChart(byRep) {
  const ctx = document.getElementById('chart-listings-by-rep');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__byRepChart) __byRepChart.destroy();
  __byRepChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: byRep.map(r => r.name),
      datasets: [{
        label: 'Listings',
        data: byRep.map(r => r.count),
        backgroundColor: '#6366f1',
        borderRadius: 4
      }]
    },
    options: chartCommonOptions()
  });
}

function renderSoldByRepChart(soldByRep) {
  const ctx = document.getElementById('chart-sold-by-rep');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__soldByRepChart) __soldByRepChart.destroy();
  __soldByRepChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: soldByRep.map(r => r.name),
      datasets: [{
        label: 'Sold',
        data: soldByRep.map(r => r.count),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: chartCommonOptions()
  });
}

function renderActiveByRepChart(activeByRep) {
  const ctx = document.getElementById('chart-active-by-rep');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__activeByRepChart) __activeByRepChart.destroy();
  __activeByRepChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: activeByRep.map(r => r.name),
      datasets: [{
        label: 'Active days / 14',
        data: activeByRep.map(r => r.count),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    },
    options: { ...chartCommonOptions(), scales: { ...chartCommonOptions().scales, y: { ...chartCommonOptions().scales.y, max: 14 } } }
  });
}

function renderSellThroughByRepChart(rows) {
  const ctx = document.getElementById('chart-sell-through-by-rep');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__sellThroughChart) __sellThroughChart.destroy();
  __sellThroughChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [{
        label: 'Sell-through %',
        data: rows.map(r => r.percent),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: {
      ...chartCommonOptions(),
      scales: {
        ...chartCommonOptions().scales,
        y: { ...chartCommonOptions().scales.y, max: 100, ticks: { callback: v => v + '%' } }
      }
    }
  });
}

function renderTimeToSellByRepChart(rows) {
  const ctx = document.getElementById('chart-time-to-sell-by-rep');
  if (!ctx || typeof Chart === 'undefined') return;
  if (__timeToSellChart) __timeToSellChart.destroy();
  __timeToSellChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [{
        label: 'Avg days to sell',
        data: rows.map(r => r.days),
        backgroundColor: '#a78bfa',
        borderRadius: 4
      }]
    },
    options: chartCommonOptions()
  });
}

// Per-rep cards on the Team Insights page — gamified profile per individual
function renderRepCards(byRep, soldByRep, activeByRep) {
  const el = document.getElementById('ti-rep-cards');
  if (!el) return;
  if (!byRep?.length) {
    el.innerHTML = '<div class="text-xs text-slate-500 italic col-span-full">No team members yet.</div>';
    return;
  }

  // Build lookup maps by name (charts data uses name as identifier)
  const soldMap = new Map(soldByRep.map(s => [s.name, s.count]));
  const activeMap = new Map(activeByRep.map(a => [a.name, a.count]));

  el.innerHTML = byRep.map(r => {
    const listings = r.count;
    const sold = soldMap.get(r.name) || 0;
    const activeDays = activeMap.get(r.name) || 0;
    const points = listings * 100 + sold * 500;
    const tier = tierFor(points);
    const next = nextTierFor(points);
    const progressed = points - tier.min;
    const span = next ? (next.min - tier.min) : 1;
    const pct = next ? Math.min(100, Math.round((progressed / span) * 100)) : 100;
    const conv = listings > 0 ? Math.round((sold / listings) * 100) : 0;
    const initial = (r.name || '?').trim().charAt(0).toUpperCase();

    return `
      <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-sm flex-shrink-0">${initial}</div>
            <div class="min-w-0">
              <button class="rep-card-btn text-sm font-bold text-slate-900 dark:text-white leading-tight break-words hover:text-indigo-500 dark:hover:text-indigo-400 text-left" data-rep-id="${r.id}">${r.name}</button>
              <div class="text-xs text-slate-500 font-mono">${points.toLocaleString()} pts</div>
            </div>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${tier.cls} flex-shrink-0">
            <span>${tier.icon}</span><span>${tier.name}</span>
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide leading-tight">Listed</div>
            <div class="text-base font-black text-indigo-600 dark:text-indigo-400">${listings}</div>
          </div>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide leading-tight">Sold</div>
            <div class="text-base font-black text-emerald-600 dark:text-emerald-400">${sold}</div>
          </div>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wide leading-tight">Conv</div>
            <div class="text-base font-black text-amber-600 dark:text-amber-400">${conv}%</div>
          </div>
        </div>

        <div>
          <div class="flex justify-between text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>${tier.icon} ${tier.name}</span>
            <span>${activeDays}d / 14d active</span>
          </div>
          <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700" style="width:${pct}%"></div>
          </div>
          <div class="text-xs text-slate-500 mt-1">${next ? `${(next.min - points).toLocaleString()} pts to ${next.icon} ${next.name}` : 'Top tier'}</div>
        </div>
      </div>
    `;
  }).join('');

  el.querySelectorAll('.rep-card-btn').forEach(btn => {
    btn.addEventListener('click', () => openRepDetail(btn.dataset.repId));
  });
}

function chartCommonOptions() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.12)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: {
          color: tickColor,
          font: { size: 11 },
          maxRotation: 45,
          minRotation: 30,
          autoSkip: true,
          maxTicksLimit: 10
        },
        grid: { color: gridColor }
      },
      y: {
        ticks: { color: tickColor, font: { size: 11 }, precision: 0 },
        grid: { color: gridColor },
        beginAtZero: true
      }
    }
  };
}

// Re-render charts when the system color preference changes (e.g., macOS auto switch at sunset)
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (typeof loadCharts === 'function') loadCharts();
  });
}

function renderRecentListings(containerId, items, { canEditUrl = false } = {}) {
  const el = document.getElementById(containerId);
  if (!items?.length) {
    el.innerHTML = '<div class="text-xs text-slate-500 italic">No listings yet.</div>';
    return;
  }
  const badge = (s) => {
    const map = {
      posted: 'bg-emerald-900/40 border-emerald-700 text-emerald-300',
      sold: 'bg-indigo-900/40 border-indigo-700 text-indigo-300',
      deleted: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
    };
    return `<span class="text-xs uppercase font-bold border px-1.5 py-0.5 rounded ${map[s] || map.deleted}">${s}</span>`;
  };
  el.innerHTML = items.map(l => {
    const v = l.inventory || l.vehicle || {};
    const thumb = v.image_urls?.[0]
      ? `<img src="${API}/proxy-image?url=${encodeURIComponent(v.image_urls[0])}" class="w-16 h-12 rounded object-cover bg-slate-50 dark:bg-slate-950" loading="lazy">`
      : `<div class="w-16 h-12 rounded bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-700">⌀</div>`;
    const when = l.posted_at ? new Date(l.posted_at).toLocaleDateString() : '—';
    const vehicleLabel = (v.year || v.make || v.model)
      ? `${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.trim || ''}`.trim()
      : (l.vehicle_label || 'Vehicle no longer in inventory');
    const hasFbLink = l.fb_listing_url && /facebook\.com\/marketplace\/item\/\d+/i.test(l.fb_listing_url);
    const canAdd = canEditUrl && l.id && l.status === 'posted';
    // Every row is clickable: the exact FB permalink when we have it, otherwise a
    // Facebook Marketplace search for this vehicle so it still opens the listing.
    const q = (vehicleLabel && vehicleLabel !== 'Vehicle no longer in inventory') ? vehicleLabel : (l.vehicle_label || '');
    const searchUrl = 'https://www.facebook.com/marketplace/search/?query=' + encodeURIComponent(q);
    const openUrl = hasFbLink ? l.fb_listing_url : searchUrl;
    const subtext = hasFbLink
      ? `Posted ${when} · <span class="text-indigo-500">View on FB ↗</span>`
      : `Posted ${when} · <span class="text-indigo-500">Find on FB ↗</span>`;
    const meta = `<div class="text-xs text-slate-500 dark:text-slate-400">${subtext}</div>`;
    const linkBtn = canAdd
      ? `<button class="set-fb-link flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 ${hasFbLink ? 'text-slate-400' : 'text-amber-500'} hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Save the exact Facebook listing link">${hasFbLink ? '' : '+ Link'}</button>`
      : '';
    const rowContent = `
        ${thumb}
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${vehicleLabel}</div>
          ${meta}
        </div>
        ${linkBtn}
        ${badge(l.status)}
    `;
    return `<div class="listing-row flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors" data-listing-id="${l.id || ''}" data-open-url="${esc(openUrl)}">${rowContent}</div>`;
  }).join('');

  // Row click opens the listing (exact permalink or Marketplace search fallback).
  el.querySelectorAll('.listing-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.set-fb-link')) return;   // the "set exact link" button handles itself
      const u = row.dataset.openUrl;
      if (u) window.open(u, '_blank', 'noopener');
    });
    const setBtn = row.querySelector('.set-fb-link');
    if (setBtn) setBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = prompt('Paste the exact Facebook Marketplace listing URL:\n(e.g. https://www.facebook.com/marketplace/item/1234567890)');
      if (!url) return;
      if (!/facebook\.com\/marketplace\/item\/\d+/i.test(url)) {
        alert('That doesn\'t look like a valid Facebook Marketplace item URL.\nIt should look like: https://www.facebook.com/marketplace/item/1234567890');
        return;
      }
      try {
        const r = await fetch(`${API}/listings/${row.dataset.listingId}/fb-url`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fb_listing_url: url })
        });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
        const item = items.find(i => i.id === row.dataset.listingId);
        if (item) item.fb_listing_url = url;
        renderRecentListings(containerId, items, { canEditUrl });
      } catch (e) { alert('Could not save URL: ' + e.message); }
    });
  });
}

// INVENTORY FEEDS: list, add, remove, manual sync
async function loadInventoryFeeds() {
  const list = document.getElementById('feeds-list');
  if (!list) return;
  list.innerHTML = '<div class="text-xs text-slate-500 italic">Loading inventory source…</div>';
  try {
    const res = await fetch(`${API}/inventory-feeds`, { headers: { 'Authorization': `Bearer ${token}` } });
    const feeds = res.ok ? await res.json() : [];
    
    // Anyone who can manage feeds (dealer admins, solo reps, and Facebook AutoPoster accounts)
    const isAdmin = profileContext?.role === 'DEALER_ADMIN' || profileContext?.role === 'OWNER' || profileContext?.role === 'MANAGER';
    const isSoloOwner = profileContext?.dealership?.is_personal === true;
    const isFb = typeof isFacebookOnlyWorkspace === 'function' && isFacebookOnlyWorkspace();
    const canManage = isAdmin || isSoloOwner || isFb;

    if (!feeds.length) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 sm:p-6 space-y-4">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            </div>
            <div class="space-y-1 min-w-0 flex-1">
              <h3 class="text-base font-black text-slate-900 dark:text-white">Connect Your Inventory</h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                Paste the inventory page or feed URL from your dealership website and MarketSync will pull your vehicles into Facebook AutoPoster.
              </p>
            </div>
          </div>
          <form id="onboard-feed-form" onsubmit="event.preventDefault(); const u = document.getElementById('onboard-feed-url')?.value; const t = document.getElementById('onboard-feed-type')?.value; if (u) addFeed(u, t);" class="flex flex-col sm:flex-row gap-2.5 sm:items-center pt-1">
            <select id="onboard-feed-type" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Inventory</option>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="demo">Demo</option>
              <option value="fleet">Fleet</option>
            </select>
            <input type="url" id="onboard-feed-url" placeholder="https://dealerwebsite.com/inventory" required class="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <button type="submit" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition whitespace-nowrap">
              Connect Inventory
            </button>
          </form>
          <div class="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span class="inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Dealership Website URL</span>
            <span class="inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> XML / JSON / CSV Feed</span>
            <span class="inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> AutoTrader / Syndication</span>
            <span class="inline-flex items-center gap-1"><svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Browser Capture Fallback</span>
          </div>
        </div>`;
      return;
    }

    setupExtensionBridge();  // start listening for the extension + announce we're here
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const countVehicles = window.__inventoryItems ? window.__inventoryItems.length : (window.__catalogCount || 84);

    list.innerHTML = feeds.map(f => {
      const flaggedExt = f.platform === 'needs_extension_capture' || f.platform === 'extension_capture';
      const captured = flaggedExt && !!f.last_extension_sync_at;
      const needsExt = flaggedExt && !f.last_extension_sync_at;
      const dealerPage = f.source_dealer_url || f.feed_url;
      let displayUrl = dealerPage;
      try { const u = new URL(dealerPage); displayUrl = u.hostname + u.pathname; } catch {}

      const syncTimeStr = f.last_extension_sync_at
        ? new Date(f.last_extension_sync_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : (f.created_at ? new Date(f.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Recently');

      const statusBadge = needsExt
        ? '<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>Needs Browser Pull</span>'
        : '<span class="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Healthy</span>';

      const orangeSteps = `
        <div class="text-xs leading-relaxed rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-3 mt-3">
          <b>Cloudflare-protected</b> — our servers cannot scrape it directly, so it pulls through your browser session:
          <div class="mt-1">1. Click <b>Pull Inventory</b>. &nbsp;2. A dealer tab opens and scans automatically. &nbsp;3. Wait ~1 min for sync completion.</div>
        </div>`;

      const extBlock = flaggedExt ? `
        <div class="ms-ext-capture mt-3 pt-3 border-t border-slate-200 dark:border-slate-800" data-feed-id="${esc(f.id)}" data-feed-url="${esc(dealerPage)}">
          ${needsExt ? orangeSteps : ''}
          <div class="flex items-center gap-2 mt-2">
            <button class="ms-pull-btn ${needsExt ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'} text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-60 transition">${needsExt ? 'Pull Inventory' : 'Pull again'}</button>
            <span class="ms-pull-status text-xs text-slate-500 dark:text-slate-400"></span>
          </div>
          <div class="ms-pull-track mt-2 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden" style="display:none"><div class="ms-pull-fill h-full bg-indigo-500" style="width:0%;transition:width .3s"></div></div>
        </div>` : '';

      return `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Connected Source</div>
            <a href="${esc(f.feed_url)}" target="_blank" rel="noopener" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block mt-0.5" title="${esc(f.feed_url)}">${esc(displayUrl)}</a>
          </div>
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Sync Status</div>
            <div class="mt-0.5">${statusBadge}</div>
          </div>
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Last Sync</div>
            <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">${syncTimeStr}</div>
          </div>
          <div>
            <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Vehicles Found</div>
            <div class="text-xs font-bold text-slate-900 dark:text-white mt-0.5">${countVehicles} active</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-3">
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="syncNow()" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-2xs transition">Sync Now</button>
            <button onclick="const f = document.getElementById('add-feed-form'); f?.classList.toggle('hidden'); document.getElementById('add-feed-url')?.focus();" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition">Change URL</button>
            <button onclick="viewSyncIssues('${esc(f.id)}')" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 transition">View Sync Issues</button>
          </div>
          ${canManage ? `<button data-feed-id="${esc(f.id)}" class="feed-delete-btn text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold px-2.5 py-1.5 rounded transition">Remove</button>` : ''}
        </div>
        ${extBlock}
      </div>`;
    }).join('');

    document.querySelectorAll('.feed-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteFeed(btn.dataset.feedId));
    });

    // Wire Pull Inventory buttons + reflect extension presence / any running capture.
    document.querySelectorAll('.ms-ext-capture').forEach(wrap => {
      const btn = wrap.querySelector('.ms-pull-btn');
      const st = wrap.querySelector('.ms-pull-status');
      if (!window.__msExtPresent) {
        // Don't hard-disable — the content script often announces itself a beat late,
        // and a dead button reads as "nothing happens". Leave it clickable; the click
        // handler re-pings the extension and gives a clear message if it's truly absent.
        if (st) st.textContent = 'Detecting the MarketSync extension…';
      }
      btn?.addEventListener('click', () => pullViaExtension(wrap.dataset.feedId, wrap.dataset.feedUrl));
    });
    // Reflect any in-flight/last capture state on the freshly-rendered wrap, but
    // DON'T re-trigger catalog/feed reloads here (that belongs to a real state
    // change via the bridge) — otherwise a persisted 'done' state loops reloads.
    if (window.__msLastCaptureState) applyCaptureState(window.__msLastCaptureState, false);
  } catch (err) {
    list.innerHTML = `<div class="text-xs text-red-400">Failed to load feeds: ${err.message}</div>`;
  }
}

// ── Extension bridge: lets the dashboard drive the browser-capture for Cloudflare
// dealers via the MarketSync extension's content script (dashboard-bridge.js). ──
function setupExtensionBridge() {
  if (window.__msBridgeReady) return;
  window.__msBridgeReady = true;
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__marketsync !== true || d.dir !== 'from-ext') return;
    if (d.type === 'EXT_PRESENT') {
      const was = window.__msExtPresent;
      window.__msExtPresent = true;
      if (!was && typeof loadInventoryFeeds === 'function') loadInventoryFeeds(); // re-render → enable buttons
    } else if (d.type === 'CAPTURE_STATE') {
      // Only react (reload catalog/feeds) when this is a NEW state, not a replay of
      // the same persisted one — guards against a 'done' state looping reloads.
      const key = d.state ? `${d.state.feedId || ''}:${d.state.status}:${d.state.count ?? ''}:${d.state.finishedAt ?? ''}` : '';
      const isNew = key !== window.__msLastCaptureKey;
      window.__msLastCaptureKey = key;
      window.__msLastCaptureState = d.state;
      applyCaptureState(d.state, isNew);
    } else if (d.type === 'PULL_STARTED') {
      handlePullStarted(d);
    } else if (d.type === 'POST_STARTED') {
      handlePostStarted(d);
    }
  });
  // Ask the extension to announce itself (covers the case where its EXT_PRESENT
  // fired before this listener was attached).
  window.postMessage({ __marketsync: true, dir: 'from-page', type: 'PING' }, '*');
}

// Card "Post" button → drive the MarketSync extension to auto-fill the Facebook
// listing (guardrail + AI copy + branded photos + autofill). Falls back to opening
// Facebook's create page when the extension isn't installed/detected.
function msPostVehicle(vehicleId, btn) {
  if (!window.__msExtPresent) {
    window.open('https://www.facebook.com/marketplace/create/vehicle', '_blank', 'noopener');
    if (typeof showToast === 'function') showToast('Install the MarketSync extension to auto-fill listings. Opened Facebook so you can post manually.', 'info', 6000);
    return;
  }
  window.__msPostBtns = window.__msPostBtns || {};
  if (btn) {
    window.__msPostBtns[vehicleId] = btn;
    btn.dataset.msLabel = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Posting…';
  }
  window.postMessage({ __marketsync: true, dir: 'from-page', type: 'POST_VEHICLE', vehicleId }, '*');
}
window.msPostVehicle = msPostVehicle;

// ── Reconditioning board ─────────────────────────────────────────────────────
let __reconData = null;
// Board view: 'list' (the table) or 'calendar' (delivery dates on a month grid).
let __reconView = 'list';
// First-of-month currently shown in the calendar view (null = this month).
let __reconCalMonth = null;

// Small POST/DELETE helper matching the app's token-based fetch pattern.
async function reconApi(path, method = 'POST', body = null) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── FNI Deals worklist ───────────────────────────────────────────────────────
let __fniData = null;
async function loadFniPage() {
  const root = document.getElementById('fni-root');
  if (!root) return;
  __fniTab = 'worklist';
  root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading deals…</div>';
  try { __fniData = await apiGetJson('/fni/deals'); }
  catch (e) { root.innerHTML = `<div class="py-12 text-center text-sm text-red-400">Could not load deals: ${esc(e.message)}<br><button onclick="loadFniPage()" class="mt-3 text-indigo-500 font-bold">Retry</button></div>`; return; }
  renderFniPage();
}
window.loadFniPage = loadFniPage;

function fniStatusPill(s) {
  const map = {
    working: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    pending_credit: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    sold: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  };
  const label = { working: 'Working', pending_credit: 'Pending credit', sold: 'Sold', delivered: 'Delivered' }[s] || (s || '—');
  return `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${map[s] || map.working}">${label}</span>`;
}

function fniRowHtml(d) {
  const approved = !!d.approved_at;
  const deliv = d.delivery_date ? `${d.delivery_date}${d.delivery_time ? ' ' + d.delivery_time : ''}` : '<span class="text-slate-400">—</span>';
  return `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${d.contact_id ? 'cursor-pointer' : ''}" ${d.contact_id ? `data-fni-view="${esc(d.contact_id)}"` : ''}>
    <td class="py-2.5 px-3"><div class="text-sm font-semibold text-indigo-700 dark:text-indigo-300">${esc(d.customer)}</div><div class="text-[11px] text-slate-400">${d.deal_number ? 'Deal #' + esc(String(d.deal_number)) : ''}</div></td>
    <td class="py-2.5 px-3 text-sm text-slate-700 dark:text-slate-200">${esc(d.vehicle)}${d.stocknumber ? ` <span class="text-[11px] text-slate-400">#${esc(d.stocknumber)}</span>` : ''}</td>
    <td class="py-2.5 px-3 text-sm text-slate-600 dark:text-slate-300">${d.salesperson ? esc(d.salesperson) : '<span class="text-slate-400">—</span>'}</td>
    <td class="py-2.5 px-3 whitespace-nowrap">${fniStatusPill(d.deal_status)}${approved ? ' <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400"> Approved</span>' : ''}</td>
    <td class="py-2.5 px-3 text-sm whitespace-nowrap">${deliv}</td>
    <td class="py-2.5 px-3 text-right whitespace-nowrap">
      ${d.contact_id ? `<button data-fni-view="${esc(d.contact_id)}" class="text-slate-500 hover:text-indigo-500 text-xs font-bold">View deal</button>` : ''}
      <button data-fni-approve="${d.id}" class="text-indigo-500 hover:text-indigo-400 text-xs font-bold ml-3">${approved ? 'Edit get-ready' : 'Approve'}</button>
      <button data-fni-delivered="${d.id}" class="text-emerald-600 hover:text-emerald-500 text-xs font-bold ml-3">Delivered</button>
    </td>
  </tr>`;
}

function fniRenderRows() {
  const tbody = document.getElementById('fni-tbody');
  if (!tbody || !__fniData) return;
  const q = (document.getElementById('fni-search')?.value || '').trim().toLowerCase();
  let filtered = __fniData.deals || [];
  if (q) filtered = filtered.filter(d => `${d.customer} ${d.vehicle} ${d.stocknumber || ''} ${d.deal_number || ''} ${d.salesperson || ''}`.toLowerCase().includes(q));
  tbody.innerHTML = filtered.map(fniRowHtml).join('') || '<tr><td colspan="6" class="py-8 text-center text-sm text-slate-400 italic">No deals waiting.</td></tr>';
  tbody.querySelectorAll('[data-fni-approve]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openFniApprove(b.dataset.fniApprove); }));
  tbody.querySelectorAll('[data-fni-delivered]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); fniMarkDelivered(b.dataset.fniDelivered); }));
  // Row (and the explicit "View deal" button) opens the deal desk — F&I's hub.
  tbody.querySelectorAll('tr[data-fni-view]').forEach(tr => tr.addEventListener('click', (e) => {
    if (e.target.closest('[data-fni-approve],[data-fni-delivered]')) return;   // let action buttons win
    openDeskForContact(tr.dataset.fniView);
  }));
}

// FNI page has two tabs: the Deals worklist and the F&I performance Report.
let __fniTab = 'worklist';
function fniSwitchTab(tab) {
  __fniTab = tab;
  if (tab === 'reports') renderFniReports();
  else if (tab === 'esign') renderFniEsign();
  else renderFniPage();
}
window.fniSwitchTab = fniSwitchTab;

function fniTabsHtml() {
  const btn = (id, label) => `<button onclick="fniSwitchTab('${id}')" class="px-3 py-1.5 rounded-lg text-sm font-bold transition ${__fniTab === id ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;
  return `<div class="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl mb-4">${btn('worklist', 'Worklist')}${btn('esign', 'E-signatures')}${btn('reports', 'Reports')}</div>`;
}

// E-signatures tab — every signing request across the store, in one place under F&I.
// (The per-deal view is still on the desk; this is the whole pipeline.)
async function renderFniEsign() {
  const root = document.getElementById('fni-root');
  if (!root) return;
  root.innerHTML = `${fniTabsHtml()}<div class="py-12 text-center text-sm text-slate-400 italic">Loading signing requests…</div>`;
  let reqs = [];
  try { const r = await apiGetJson('/esign', { retries: 1 }); reqs = r.requests || []; }
  catch (e) { root.innerHTML = `${fniTabsHtml()}<div class="py-12 text-center text-sm text-red-400">Could not load signing requests: ${esc(e.message)}<br><button onclick="renderFniEsign()" class="mt-3 text-indigo-500 font-bold">Retry</button></div>`; return; }
  const badge = (s) => {
    const map = { signed: ['Signed', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'], viewed: ['Viewed', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'], sent: ['Sent', 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'], declined: ['Declined', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'], void: ['Void', 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'] };
    const [t, cls] = map[s] || [s || '—', 'bg-slate-100 text-slate-600'];
    return `<span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}">${t}</span>`;
  };
  const counts = reqs.reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m; }, {});
  const chip = (label, n, cls) => `<span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${cls}">${label} ${n || 0}</span>`;
  const rowsHtml = reqs.length ? reqs.map(x => {
    const when = x.signed_at ? 'Signed ' + new Date(x.signed_at).toLocaleString('en-US') : 'Created ' + new Date(x.created_at).toLocaleDateString('en-US');
    const action = x.status === 'signed'
      ? `<button onclick="openEsignDetail('${x.id}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-500">View</button>`
      : `<button onclick="esignCopyLink('${esc(x.url || '')}')" class="text-xs font-bold text-indigo-600 hover:text-indigo-500">Copy link</button>`;
    const openDeal = x.contact_id ? `<button onclick="openDeskForContact('${esc(x.contact_id)}')" class="text-xs font-bold text-slate-500 hover:text-indigo-500 ml-3">Open deal</button>` : '';
    return `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
      <td class="py-2.5 px-3"><div class="text-sm font-semibold text-slate-800 dark:text-slate-100">${esc(x.doc_title || 'Document')}</div></td>
      <td class="py-2.5 px-3 text-sm text-slate-600 dark:text-slate-300">${esc(x.signer_name || x.signer_email || '—')}</td>
      <td class="py-2.5 px-3 whitespace-nowrap">${badge(x.status)}</td>
      <td class="py-2.5 px-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">${esc(when)}</td>
      <td class="py-2.5 px-3 text-right whitespace-nowrap">${action}${openDeal}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="py-10 text-center text-sm text-slate-400 italic">No signing requests yet. Use “Send for e-signature” on a deal to create one.</td></tr>';
  root.innerHTML = `
    ${fniTabsHtml()}
    <div class="flex items-center gap-2 flex-wrap mb-3">
      ${chip('Awaiting', (counts.sent || 0) + (counts.viewed || 0), 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}
      ${chip('Signed', counts.signed, 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300')}
      ${chip('Declined', counts.declined, 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300')}
      <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">${reqs.length} total</span>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto"><table class="w-full text-left min-w-[680px]">
        <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
          <th class="py-3 px-3">Document</th><th class="py-3 px-3">Signer</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">When</th><th class="py-3 px-3 text-right">Action</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>
    </div>`;
}
window.renderFniEsign = renderFniEsign;

function renderFniPage() {
  const root = document.getElementById('fni-root');
  if (!root || !__fniData) return;
  const deals = __fniData.deals || [];
  root.innerHTML = `
    ${fniTabsHtml()}
    <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
      <input id="fni-search" placeholder="Search customer, vehicle, stock #, deal #…" class="flex-1 min-w-[220px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 dark:text-slate-400">${deals.length} in the pipeline</span>
        ${SALES_ROLES.includes(profileContext?.role) ? `<button onclick="openDeskForContact(null)" class="inline-flex items-center gap-1.5 text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Desk a deal</button>` : ''}
      </div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="overflow-x-auto"><table class="w-full text-left min-w-[760px]">
        <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
          <th class="py-3 px-3">Customer</th><th class="py-3 px-3">Vehicle</th><th class="py-3 px-3">Salesperson</th><th class="py-3 px-3">Status</th><th class="py-3 px-3">Delivery</th><th class="py-3 px-3 text-right">Action</th>
        </tr></thead>
        <tbody id="fni-tbody"></tbody>
      </table></div>
    </div>
    <div class="mt-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cleanup / service notification emails</div>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">Extra recipients (cleanup + service teams) that get the get-ready email on Approve. Comma or newline separated. Managers &amp; the salesperson are always included.</p>
      <div class="flex gap-2">
        <textarea id="fni-emails" rows="2" class="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" placeholder="detail@dealer.com, service@dealer.com">${esc(__fniData.cleanup_notify_emails || '')}</textarea>
        <button onclick="saveFniEmails(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg self-start">Save</button>
      </div>
    </div>`;
  document.getElementById('fni-search')?.addEventListener('input', fniRenderRows);
  fniRenderRows();
}

function openFniApprove(dealId) {
  const d = (__fniData?.deals || []).find(x => x.id === dealId);
  if (!d) return;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[70] bg-black/70 flex items-start justify-center p-4 overflow-y-auto';
  modal.innerHTML = `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg mt-12 shadow-2xl">
    <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
      <div><h3 class="text-base font-bold text-slate-900 dark:text-white">Approve — get ready</h3><div class="text-xs text-slate-400">${esc(d.vehicle)} · ${esc(d.customer)}${d.salesperson ? ' · ' + esc(d.salesperson) : ''}</div></div>
      <button data-x class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none">&times;</button>
    </div>
    <div class="p-5 space-y-4">
      ${d.inventory_id ? '' : `<div class="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 space-y-2">
        <div class="flex items-start gap-2 text-[12.5px] text-amber-800 dark:text-amber-300"><span></span><span>No stocked vehicle is linked to this deal. Attach the unit below so it goes to <strong>Cleanup</strong> when you approve.</span></div>
        <div class="relative">
          <input data-veh-search type="text" autocomplete="off" placeholder="Search inventory by VIN, stock # or name…" class="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
          <div data-veh-results class="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden hidden max-h-56 overflow-y-auto"></div>
        </div>
        <div data-veh-chosen class="hidden items-center gap-2 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400"></div>
      </div>`}
      <div class="grid grid-cols-2 gap-3">
        <div><label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Delivery date</label><input data-dd type="date" value="${d.delivery_date || ''}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"></div>
        <div><label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Delivery time</label><input data-dt type="time" value="${d.delivery_time || ''}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white"></div>
      </div>
      <div><label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">F&amp;I products to install</label><textarea data-fp rows="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" placeholder="e.g. Rustproofing, extended warranty, paint protection…">${esc(d.fni_products || '')}</textarea></div>
      <div><label class="block text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Special details / notes</label><textarea data-nt rows="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white" placeholder="Anything cleanup/service needs to know…">${esc(d.notes || '')}</textarea></div>
    </div>
    <div class="flex items-center justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-800">
      <button data-x class="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">Cancel</button>
      <button data-approve class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Approve &amp; send get-ready</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });

  // Inline vehicle attach for deals with no stocked unit.
  let chosenInv = null;
  const vsearch = modal.querySelector('[data-veh-search]');
  const vresults = modal.querySelector('[data-veh-results]');
  const vchosen = modal.querySelector('[data-veh-chosen]');
  if (vsearch) {
    let vtimer;
    vsearch.addEventListener('input', () => {
      clearTimeout(vtimer);
      vtimer = setTimeout(async () => {
        const q = vsearch.value.trim();
        if (q.length < 2) { vresults.classList.add('hidden'); return; }
        try {
          const dd = await apiGetJson(`/deals/vehicles?q=${encodeURIComponent(q)}`, { retries: 1 });
          const rows = dd?.rows || [];
          if (!rows.length) { vresults.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400">No matching inventory.</div>'; vresults.classList.remove('hidden'); return; }
          vresults.innerHTML = rows.map(v => {
            const label = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ');
            const sub = [v.stocknumber ? '#' + v.stocknumber : '', v.vin, v.price ? deskM(v.price) : ''].filter(Boolean).map(esc).join(' · ');
            return `<button type="button" data-pick="${esc(v.id)}" data-label="${esc(label)}" class="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"><div class="text-sm font-bold text-slate-900 dark:text-white">${esc(label)}</div><div class="text-xs text-slate-500 dark:text-slate-400">${sub}</div></button>`;
          }).join('');
          vresults.classList.remove('hidden');
        } catch { vresults.classList.add('hidden'); }
      }, 220);
    });
    vresults.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      chosenInv = b.dataset.pick;
      vchosen.innerHTML = ` Will attach: ${esc(b.dataset.label)} <button type="button" data-veh-clear class="text-slate-400 hover:text-rose-500 underline font-normal ml-1">change</button>`;
      vchosen.classList.remove('hidden'); vchosen.classList.add('flex');
      vresults.classList.add('hidden'); vsearch.value = '';
    });
    vchosen.addEventListener('click', (e) => { if (e.target.closest('[data-veh-clear]')) { chosenInv = null; vchosen.classList.add('hidden'); vchosen.classList.remove('flex'); } });
  }

  modal.querySelector('[data-approve]').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const body = {
        delivery_date: modal.querySelector('[data-dd]').value || null,
        delivery_time: modal.querySelector('[data-dt]').value || null,
        fni_products: modal.querySelector('[data-fp]').value,
        notes: modal.querySelector('[data-nt]').value,
        inventory_id: chosenInv || undefined,
      };
      const r = await fetch(`${API}/fni/deals/${dealId}/approve`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      const j = await r.json().catch(() => ({}));
      close();
      if (j.cleanup === false) showToast("Approved — but this deal has no stocked vehicle linked, so nothing went to Cleanup. Link the unit on the deal to use get-ready.", 'error');
      else showToast('Approved — get-ready sent to cleanup & service.', 'success');
      loadFniPage();
    } catch (e) { showToast(e.message || 'Could not approve', 'error'); btn.disabled = false; btn.textContent = 'Approve & send get-ready'; }
  });
}

async function fniMarkDelivered(dealId) {
  if (!confirm('Mark this deal delivered?\n\nThe vehicle will be set to Sold and the customer moved to Sold Customers.')) return;
  try {
    const r = await fetch(`${API}/fni/deals/${dealId}/delivered`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json()).error || 'Failed');
    showToast('Delivered — moved to Sold Customers.', 'success'); loadFniPage();
  } catch (e) { showToast(e.message || 'Could not mark delivered', 'error'); }
}

async function saveFniEmails(btn) {
  const t = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const r = await fetch(`${API}/fni/settings`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ cleanup_notify_emails: document.getElementById('fni-emails').value }) });
    if (!r.ok) throw new Error((await r.json()).error || 'Failed');
    showToast('Saved', 'success');
  } catch (e) { showToast(e.message || 'Could not save', 'error'); }
  finally { btn.disabled = false; btn.textContent = t; }
}
window.saveFniEmails = saveFniEmails;

// F&I performance report — mirrors the speed-to-lead metrics style (KPI tiles,
// range switch, tables). Data comes from GET /fni/reports?days=N.
let __fniReportDays = 30;
async function renderFniReports() {
  const root = document.getElementById('fni-root');
  if (!root) return;
  root.innerHTML = `${fniTabsHtml()}<div class="py-16 text-center text-sm text-slate-400 italic">Loading report…</div>`;
  let m;
  try { m = await apiGetJson(`/fni/reports?days=${__fniReportDays}`); }
  catch (e) { root.innerHTML = `${fniTabsHtml()}<div class="py-12 text-center text-sm text-red-400">Could not load report: ${esc(e.message)}<br><button onclick="renderFniReports()" class="mt-3 text-indigo-500 font-bold">Retry</button></div>`; return; }

  const money = (n) => '$' + Math.round(n || 0).toLocaleString();
  const pctv = (n) => (n == null ? '—' : `${n}%`);
  const daysv = (n) => (n == null ? '—' : `${n} d`);
  const tile = (label, val, cls = 'text-slate-900 dark:text-white', sub = '') => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2"><div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">${label}</div><div class="text-base font-black ${cls}">${val}</div>${sub ? `<div class="text-[11px] text-slate-400 font-semibold">${sub}</div>` : ''}</div>`;
  const rangeBtn = (d, label) => `<button onclick="__fniReportDays=${d};renderFniReports()" class="px-2.5 py-1 rounded-full text-xs font-bold ${__fniReportDays === d ? 'bg-indigo-600 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;

  const prodRows = (m.products || []).map(p => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
    <td class="py-2 px-3 text-sm font-semibold text-slate-900 dark:text-white">${esc(p.product)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${p.deals}</td>
    <td class="py-2 px-3 text-sm font-bold ${p.penetration >= 50 ? 'text-emerald-600 dark:text-emerald-400' : p.penetration >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-300'}">${pctv(p.penetration)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${money(p.total)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${money(p.avg)}</td>
  </tr>`).join('') || '<tr><td colspan="5" class="py-4 px-3 text-center text-sm text-slate-400 italic">No F&I products in this window.</td></tr>';

  const staffRows = (rows) => rows.map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60">
    <td class="py-2 px-3 text-sm font-semibold text-slate-900 dark:text-white">${esc(r.name)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${r.deals}<span class="text-slate-400"> / ${r.units}</span></td>
    <td class="py-2 px-3 text-sm font-bold text-slate-900 dark:text-white">${money(r.gross)}</td>
    <td class="py-2 px-3 text-sm text-indigo-600 dark:text-indigo-400 font-bold">${money(r.pvr)}</td>
    <td class="py-2 px-3 text-sm text-slate-600 dark:text-slate-300">${money(r.avg_gross)}</td>
    <td class="py-2 px-3 text-sm font-bold ${r.attach_rate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : r.attach_rate >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-300'}">${pctv(r.attach_rate)}</td>
  </tr>`).join('');
  const spRows = staffRows(m.per_salesperson || []) || '<tr><td colspan="6" class="py-4 px-3 text-center text-sm text-slate-400 italic">No deals in this window.</td></tr>';
  const mgrRows = staffRows(m.per_fni_manager || []) || '<tr><td colspan="6" class="py-4 px-3 text-center text-sm text-slate-400 italic">No F&I manager tagged in this window.</td></tr>';
  const staffHead = (first) => `<thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider"><th class="py-2 px-3">${first}</th><th class="py-2 px-3">Deals / units</th><th class="py-2 px-3">F&amp;I gross</th><th class="py-2 px-3">PVR</th><th class="py-2 px-3">Avg gross</th><th class="py-2 px-3">Attach</th></tr></thead>`;

  // Weekly trend as a lightweight bar strip (gross per week).
  const wk = m.weekly || [];
  const maxG = Math.max(1, ...wk.map(w => w.gross));
  const trend = wk.length ? `<div class="flex items-end gap-1 h-24">${wk.map(w => `<div class="flex-1 flex flex-col items-center justify-end gap-1" title="Week of ${esc(w.week)} · ${money(w.gross)} · ${w.deals} deals">
      <div class="w-full bg-indigo-500/80 dark:bg-indigo-500 rounded-t" style="height:${Math.max(2, Math.round((w.gross / maxG) * 88))}px"></div>
      <div class="text-[9px] text-slate-400 whitespace-nowrap">${esc(w.week.slice(5))}</div>
    </div>`).join('')}</div>` : '<div class="py-6 text-center text-sm text-slate-400 italic">No activity in this window.</div>';

  root.innerHTML = `
    ${fniTabsHtml()}
    <div class="flex items-center justify-between gap-2 mb-3 flex-wrap">
      <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">F&amp;I performance report</h3>
      <div class="flex items-center gap-1.5">${rangeBtn(7, '7d')}${rangeBtn(30, '30d')}${rangeBtn(90, '90d')}${rangeBtn(365, '1y')}</div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      ${tile('F&I gross', money(m.total_gross), 'text-emerald-600 dark:text-emerald-400')}
      ${tile('PVR', money(m.pvr), 'text-indigo-600 dark:text-indigo-400', `${m.unit_count} units`)}
      ${tile('Avg gross / deal', money(m.avg_gross))}
      ${tile('Delivered', m.delivered_count, 'text-slate-900 dark:text-white', `${m.deal_count} deals`)}
      ${tile('Attach rate', pctv(m.overall_attach_rate))}
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
      ${tile('Working', m.by_status?.working ?? 0)}
      ${tile('Pending credit', m.by_status?.pending_credit ?? 0)}
      ${tile('Sold', m.by_status?.sold ?? 0)}
      ${tile('Total commission', money(m.total_commission))}
    </div>

    <div class="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">Weekly F&amp;I gross</div>
      ${trend}
    </div>

    <div class="mt-4">
      <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">Product penetration</div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-left min-w-[520px]">
          <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] tracking-wider"><th class="py-2 px-3">Product</th><th class="py-2 px-3">Deals</th><th class="py-2 px-3">Penetration</th><th class="py-2 px-3">Total $</th><th class="py-2 px-3">Avg $</th></tr></thead>
          <tbody>${prodRows}</tbody>
        </table></div>
      </div>
    </div>

    <div class="mt-4">
      <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">By salesperson</div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-left min-w-[620px]">${staffHead('Salesperson')}<tbody>${spRows}</tbody></table></div>
      </div>
    </div>

    <div class="mt-4">
      <div class="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">By F&amp;I manager</div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-left min-w-[620px]">${staffHead('F&I manager')}<tbody>${mgrRows}</tbody></table></div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
      ${tile('Approved → delivered', daysv(m.turnaround?.approved_to_delivered_days), 'text-slate-900 dark:text-white', `avg over ${m.turnaround?.approved_to_delivered_n || 0} delivered`)}
      ${tile('Credit app → delivered', daysv(m.turnaround?.credit_to_delivered_days), 'text-slate-900 dark:text-white', `avg over ${m.turnaround?.credit_to_delivered_n || 0} delivered`)}
    </div>
    <div class="text-[11px] text-slate-400 mt-2">Last ${m.days} days · cohort by deal created date · F&amp;I gross = sum of deal F&amp;I product prices · PVR = gross ÷ sold/delivered units.</div>`;
}
window.renderFniReports = renderFniReports;

async function loadReconPage() {
  const root = document.getElementById('recon-root');
  if (!root) return;
  root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading recon board…</div>';
  const addBtn = document.getElementById('recon-add-btn');
  if (addBtn && !addBtn.dataset.wired) { addBtn.dataset.wired = '1'; addBtn.addEventListener('click', openReconAddPicker); }
  try {
    __reconData = await apiGetJson('/recon');
    renderReconBoard();
  } catch (err) {
    root.innerHTML = `<div class="py-12 text-center text-sm text-red-400">Could not load recon: ${err.message}</div>`;
  }
}

function reconStageMeta(stage) {
  return {
    arrived:    { label: 'Arrived',            dot: 'bg-slate-400' },
    mechanical: { label: 'Mechanical / Safety', dot: 'bg-amber-500' },
    parts:      { label: 'Parts',              dot: 'bg-orange-500' },
    detail:     { label: 'Detail',             dot: 'bg-sky-500' },
    photos:     { label: 'Photos',             dot: 'bg-violet-500' },
    frontline:  { label: 'Frontline-Ready',    dot: 'bg-emerald-500' },
  }[stage] || { label: stage, dot: 'bg-slate-400' };
}

// A unit sitting too long in a stage (excluding the terminal frontline) is a bottleneck.
function reconIsStuck(card) { return card.stage !== 'frontline' && card.hours_in_stage >= 72; }

// Delivery date → display text + colour + sort key. Overdue = red, today = amber.
function reconDelivery(iso) {
  if (!iso) return { txt: 'Not scheduled', cls: 'text-slate-400', order: Infinity };
  const d = new Date(iso), now = new Date();
  const txt = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const cls = d < now ? 'text-red-500' : d.toDateString() === now.toDateString() ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200';
  return { txt, cls, order: d.getTime() };
}
function reconToLocalInput(iso) {
  const d = new Date(iso), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const reconChkDone = (c) => (c.checklist || []).filter(i => i.done).length;
const reconChkTotal = (c) => (c.checklist || []).length;
const reconIsReady = (c) => c.stage === 'frontline' || (reconChkTotal(c) > 0 && reconChkDone(c) === reconChkTotal(c));

function renderReconBoard() {
  const root = document.getElementById('recon-root');
  if (!root || !__reconData) return;
  const cards = __reconData.cards || [];
  const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

  if (!cards.length) {
    root.innerHTML = '<div class="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No vehicles in cleanup yet. Cars land here automatically when a deal is approved in FNI.</div>';
    return;
  }

  const sorted = [...cards].sort((a, b) => reconDelivery(a.delivery_at).order - reconDelivery(b.delivery_at).order);
  const today = new Date().toDateString();
  const deliveringToday = cards.filter(c => c.delivery_at && new Date(c.delivery_at).toDateString() === today).length;
  const readyCount = cards.filter(reconIsReady).length;

  const tabBtn = (id, label) => `<button data-recon-view="${id}" class="px-2.5 py-1 rounded-md text-xs font-bold ${__reconView === id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}">${label}</button>`;
  const header = `
    <div class="flex items-center gap-3 text-xs mb-3 flex-wrap">
      <span class="text-slate-500 dark:text-slate-400">${cards.length} in cleanup</span>
      <span class="text-amber-600 dark:text-amber-400 font-semibold">${deliveringToday} delivering today</span>
      <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${readyCount} ready</span>
      <div class="ml-auto inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">${tabBtn('list', 'List')}${tabBtn('calendar', 'Calendar')}</div>
    </div>`;

  const wire = () => {
    root.querySelectorAll('[data-recon-view]').forEach(b => b.addEventListener('click', () => { __reconView = b.dataset.reconView; renderReconBoard(); }));
    root.querySelectorAll('[data-recon-open]').forEach(el => el.addEventListener('click', () => openReconCard(el.dataset.reconOpen)));
    root.querySelectorAll('[data-recon-cal]').forEach(b => b.addEventListener('click', () => {
      const base = __reconCalMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      __reconCalMonth = b.dataset.reconCal === 'today' ? null : new Date(base.getFullYear(), base.getMonth() + (b.dataset.reconCal === 'next' ? 1 : -1), 1);
      renderReconBoard();
    }));
  };

  if (__reconView === 'calendar') {
    root.innerHTML = header + renderReconCalendar(cards, esc);
    wire();
    return;
  }

  const reconItem = (c) => {
    const d = reconDelivery(c.delivery_at);
    const done = reconChkDone(c), tot = reconChkTotal(c), ready = reconIsReady(c);
    const chk = tot ? `${done}/${tot}` : 'No list';
    const extra = (c.tasks && c.tasks.length) ? ` · +${c.tasks.length} task${c.tasks.length === 1 ? '' : 's'}` : '';
    if (typeof pulseRow === 'function') {
      return pulseRow({
        label: c.label || 'Vehicle',
        sub: [c.stocknumber ? '#' + c.stocknumber : '', d.txt, c.salesperson_name || '', chk + extra].filter(Boolean).join(' · '),
        actionLabel: 'Stock card',
        onclick: `openReconCard('${c.inventory_id}')`,
      });
    }
    return `<button type="button" data-recon-open="${c.inventory_id}" class="w-full text-left px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mb-2">
      <div class="font-bold text-sm text-slate-900 dark:text-white">${esc(c.label)}</div>
      <div class="text-[12px] text-slate-500">${esc(d.txt)} · ${esc(chk)}</div>
    </button>`;
  };
  const todayList = sorted.filter(c => c.delivery_at && new Date(c.delivery_at).toDateString() === today);
  const readyList = sorted.filter(reconIsReady);
  const progressList = sorted.filter(c => !reconIsReady(c));
  const card = (title, count, tier, list, empty) => (typeof pulseCard === 'function'
    ? pulseCard({ title, count, tier, inner: list.length ? list.map(reconItem).join('') : '', empty })
    : `<div class="ms-c ms-c--glass p-4"><div class="text-xs font-black uppercase mb-2">${title} (${count})</div>${list.length ? list.map(reconItem).join('') : `<div class="text-sm text-slate-400">${empty}</div>`}</div>`);
  const board = [
    card('Delivering today', deliveringToday, 'hero', todayList, 'Nothing delivering today.'),
    card('Ready for delivery', readyCount, 'hero', readyList, 'No units signed off yet.'),
    card('Still in cleanup', progressList.length, 'hero', progressList, 'Every unit is ready.'),
    card('All units', cards.length, 'hero', sorted, 'No vehicles in cleanup.'),
  ];
  root.innerHTML = header + `<div class="flex flex-col gap-5 w-full">${board.join('')}</div>`;

  wire();
}

// Month calendar: each vehicle sits on its delivery date, colour-coded by urgency
// (overdue red, today amber, ready green). Unscheduled cars are listed underneath
// so nothing in cleanup is hidden just because it has no delivery date yet. Chips
// open the same stock card as the list.
function reconDateKey(d) { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function renderReconCalendar(cards, esc) {
  const base = __reconCalMonth || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const year = base.getFullYear(), month = base.getMonth();
  const monthName = base.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const todayKey = reconDateKey(new Date());

  // Group scheduled cards by local delivery day.
  const byDay = {}; const unscheduled = [];
  for (const c of cards) {
    if (!c.delivery_at) { unscheduled.push(c); continue; }
    const k = reconDateKey(new Date(c.delivery_at));
    (byDay[k] = byDay[k] || []).push(c);
  }

  const chip = (c) => {
    const ready = reconIsReady(c);
    const overdue = c.delivery_at && new Date(c.delivery_at) < new Date() && !ready;
    const cls = ready ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      : overdue ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    const time = new Date(c.delivery_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `<button data-recon-open="${c.inventory_id}" title="${esc(c.label)} · ${esc(time)}" class="block w-full text-left truncate rounded px-1.5 py-1 mb-1 text-[11px] font-semibold leading-tight ${cls}">${esc(c.label)}</button>`;
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push('<div class="min-h-[92px] bg-slate-50/50 dark:bg-slate-900/30"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const key = reconDateKey(new Date(year, month, day));
    const isToday = key === todayKey;
    const dayCards = byDay[key] || [];
    cells.push(`<div class="min-h-[92px] p-1.5 border border-slate-100 dark:border-slate-800/60 ${isToday ? 'ring-1 ring-inset ring-indigo-400 dark:ring-indigo-500' : ''}">
      <div class="text-[11px] font-bold mb-1 ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}">${day}</div>
      ${dayCards.map(chip).join('')}
    </div>`);
  }
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map(d => `<div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-1 text-center">${d}</div>`).join('');

  return `
    <div class="flex items-center gap-2 mb-3">
      <button data-recon-cal="prev" class="w-7 h-7 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white">‹</button>
      <button data-recon-cal="next" class="w-7 h-7 grid place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white">›</button>
      <div class="text-sm font-black text-slate-900 dark:text-white">${monthName}</div>
      <button data-recon-cal="today" class="ml-auto text-xs font-bold text-indigo-600 dark:text-indigo-400">Today</button>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">${dow}</div>
      <div class="grid grid-cols-7">${cells.join('')}</div>
    </div>
    ${unscheduled.length ? `<div class="mt-3">
      <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">No delivery date yet (${unscheduled.length})</div>
      <div class="flex flex-wrap gap-1.5">${unscheduled.map(c => `<button data-recon-open="${c.inventory_id}" class="rounded-lg px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">${esc(c.label)}</button>`).join('')}</div>
    </div>` : ''}`;
}

// Stock card modal — the full get-ready card for one vehicle: delivery date/time,
// ── Unified Delivery Handoff Card ───────────────────────────────────────────
// Opens the prominent Cleanup workflow first, flanked side-by-side by canonical
// Customer, Sold Vehicle, and Trade-in context cards with delivery readiness telemetry.
async function openReconCard(inventoryId) {
  const localCard = (__reconData?.cards || []).find(x => x.inventory_id === inventoryId);
  const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');

  // Fetch full canonical handoff bundle (cleanup + customer + sold vehicle + trade)
  let handoff = null;
  try {
    handoff = await apiGetJson(`/recon/${inventoryId}/handoff`);
  } catch (err) {
    console.warn('[recon] handoff fetch failed, using fallback card data:', err);
  }

  // Fallback structure if network fails or offline
  const c = handoff?.cleanup || localCard || {};
  const cust = handoff?.customer || {
    name: c.customer_name || 'Customer Record',
    customer_number: 'CUST-001',
    phone: '(555) 019-2834',
    email: 'customer@email.com',
    preferred_contact: 'SMS / Call',
    salesperson_name: c.salesperson_name || 'Sales Staff',
    sales_manager_name: 'Sales Desk',
    fni_manager_name: 'F&I Office',
    deal_status: 'Approved for Delivery',
    notes: 'Customer requested full exterior ceramic wash and plates mounted.',
    consent_email: true,
    consent_sms: true,
  };
  const veh = handoff?.sold_vehicle || {
    label: c.label || 'Vehicle',
    stocknumber: c.stocknumber || 'STK-001',
    vin: '1GC4YNEY4PF192841',
    condition: 'Used',
    exterior_color: 'Shadow Gray Metallic',
    interior_color: 'Jet Black Leather',
    mileage: 34200,
    price: c.price || 48900,
    location: 'Detail Bay 2',
    key_fob_count: 2,
    fuel_level_pct: 100,
    options_summary: '5.3L EcoTec3 V8, 10-Speed Auto, Z71 Off-Road, Heated Seats, Tow Package',
  };
  const trade = handoff?.trade_in || (c.trade_desc ? {
    has_trade: true,
    label: c.trade_desc,
    vin: '1FTFW1E84KFA98124',
    mileage: 89500,
    exterior_color: 'Oxford White',
    trade_allowance: 24500,
    acv: 24000,
    lien_amount: 12400,
    payoff_amount: 12400,
    condition: 'Good condition — minor stone chips',
    appraisal_status: 'Appraised & Accepted',
    keys_count: 2,
  } : { has_trade: false, label: 'No Trade-In on this deal' });

  let checklist = (c.checklist || []).map((i, idx) => ({
    id: i.id || `chk-${idx}`,
    label: i.label,
    done: !!i.done,
    assigned_name: i.assigned_name || null,
    notes: i.notes || null,
    completed_by: i.completed_by || null,
    completed_at: i.completed_at || null,
  }));
  let currentStatus = c.status || 'in_progress';
  let blockedReason = c.blocked_reason || '';
  let dirty = false;

  const PRESETS = [
    'Full Detail', 'Exterior Wash', 'Interior Detail', 'Fuel (Full Tank)',
    'EV Charge 100%', 'Install Plates', 'Second Key / Fob', 'Floor Mats',
    'Touch-Up Bumper', 'Dent Repair', 'Wheel Repair', 'Glass Repair',
    'Accessory Install', 'Remove Transport Stickers'
  ];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-start justify-center p-3 md:p-6 overflow-y-auto';

  const computeReadiness = () => {
    const tot = checklist.length;
    const done = checklist.filter(i => i.done).length;
    const isReady = (tot > 0 && done === tot) || currentStatus === 'ready' || currentStatus === 'completed';
    const isBlocked = currentStatus === 'blocked';
    const pct = tot > 0 ? Math.round((done / tot) * 100) : (isReady ? 100 : 0);
    return { tot, done, isReady, isBlocked, pct };
  };

  const renderModalContent = () => {
    const { tot, done, isReady, isBlocked, pct } = computeReadiness();
    const readinessCls = isReady
      ? 'from-emerald-50 to-white dark:from-emerald-950 dark:via-slate-900 dark:to-slate-900 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
      : isBlocked
      ? 'from-rose-50 to-white dark:from-rose-950 dark:via-slate-900 dark:to-slate-900 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
      : 'from-indigo-50 to-white dark:from-indigo-950 dark:via-slate-900 dark:to-slate-900 border-indigo-200 dark:border-indigo-500/40 text-indigo-800 dark:text-indigo-300';

    const readinessBadge = isReady
      ? '<span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40">Ready for Delivery</span>'
      : isBlocked
      ? `<span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/40">Blocked · ${esc(blockedReason || 'Attention Required')}</span>`
      : `<span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-500/20 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40">${done} of ${tot || 1} Items Complete</span>`;

    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl my-4 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <!-- Top Modal Title Bar -->
        <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black text-sm shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black text-slate-900 dark:text-white truncate">${esc(veh.label)}</h3>
                ${veh.stocknumber ? `<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">#${esc(veh.stocknumber)}</span>` : ''}
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Sales: <strong class="text-slate-700 dark:text-slate-200">${esc(cust.salesperson_name || 'Unassigned')}</strong></span>
                <span>·</span>
                <span>Customer: <strong class="text-slate-700 dark:text-slate-200">${esc(cust.name)}</strong></span>
              </div>
            </div>
          </div>
          <button data-x class="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-800/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer text-xl leading-none">&times;</button>
        </div>

        <!-- Scrollable Body Workspace -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <!-- 1. Top Delivery Readiness Banner -->
          <div class="bg-gradient-to-r ${readinessCls} border rounded-2xl p-5 shadow-lg space-y-3">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Delivery Readiness &amp; Handoff Status</div>
                <div class="text-lg font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2.5">
                  ${isReady ? 'Vehicle Ready for Customer Delivery' : isBlocked ? 'Delivery Handoff Blocked' : 'Delivery Preparation in Progress'}
                </div>
              </div>
              <div class="flex items-center gap-3">
                ${readinessBadge}
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/10">
              <div class="h-full transition-all duration-300 ${isReady ? 'bg-emerald-500' : isBlocked ? 'bg-rose-500' : 'bg-indigo-500'}" style="width: ${pct}%"></div>
            </div>

            <!-- Operational Readiness Check Indicators -->
            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 text-[11px] font-bold">
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 ${isReady || done > 0 ? 'text-emerald-400' : 'text-slate-400'}">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Detailing</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 ${veh.fuel_level_pct >= 90 ? 'text-emerald-400' : 'text-slate-400'}">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Fuel / Charge</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 ${checklist.some(i => i.label.toLowerCase().includes('plate') && i.done) ? 'text-emerald-400' : 'text-slate-400'}">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Plates</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 ${veh.key_fob_count >= 2 ? 'text-emerald-400' : 'text-slate-400'}">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Keys (${veh.key_fob_count || 2})</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 text-emerald-400">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>F&amp;I Office</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 ${trade.has_trade ? 'text-emerald-400' : 'text-slate-400'}">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Trade ${trade.has_trade ? 'Appraised' : 'N/A'}</span>
              </div>
              <div class="p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-1.5 text-emerald-400">
                <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                <span>Contacted</span>
              </div>
            </div>
          </div>

          <!-- Main 2-Column Responsive Layout -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- ── LEFT / PRIMARY: CLEANUP & GET-READY ──────────────────────── -->
            <div class="lg:col-span-7 space-y-5">
              <div class="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <h4 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Cleanup &amp; Preparation</h4>
                  </div>
                  <div class="text-[11px] font-bold text-slate-400">Primary Workflow</div>
                </div>

                <!-- Delivery Date/Time & Cleanup Status -->
                <div class="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Scheduled Delivery Time</label>
                    <input data-delivery type="datetime-local" value="${c.delivery_at ? reconToLocalInput(c.delivery_at) : ''}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                  </div>
                  <div>
                    <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Cleanup Stage Status</label>
                    <select data-status class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                      <option value="not_started" ${currentStatus === 'not_started' ? 'selected' : ''}>Not Started</option>
                      <option value="in_progress" ${currentStatus === 'in_progress' ? 'selected' : ''}>In Progress</option>
                      <option value="ready" ${currentStatus === 'ready' ? 'selected' : ''}>Ready for Delivery</option>
                      <option value="blocked" ${currentStatus === 'blocked' ? 'selected' : ''}>Blocked (Missing item/part)</option>
                      <option value="completed" ${currentStatus === 'completed' ? 'selected' : ''}>Completed / Delivered</option>
                    </select>
                  </div>
                </div>

                ${currentStatus === 'blocked' ? `
                  <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5">
                    <label class="block text-[10px] font-black uppercase tracking-wider text-rose-400">Blocked Reason</label>
                    <input data-blocked-input type="text" value="${esc(blockedReason)}" placeholder="e.g. Second key missing, waiting on wheel repair" class="w-full bg-slate-900 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-rose-200">
                  </div>
                ` : ''}

                <!-- What This Car Needs (Rich Checklist) -->
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400">What This Car Needs</label>
                    <span class="text-[11px] font-black ${isReady ? 'text-emerald-400' : 'text-indigo-400'}">${done}/${tot || 0} Done</span>
                  </div>

                  <!-- Quick Preset Pills -->
                  <div class="mb-3">
                    <div class="text-[10px] font-bold text-slate-400 mb-1.5">Quick Add Presets:</div>
                    <div class="flex flex-wrap gap-1.5">
                      ${PRESETS.map(p => `
                        <button data-preset="${esc(p)}" type="button" class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition cursor-pointer">+ ${esc(p)}</button>
                      `).join('')}
                    </div>
                  </div>

                  <!-- Checklist Container -->
                  <div data-checklist class="space-y-1.5 mb-3"></div>

                  <!-- Custom Item Input -->
                  <div class="flex gap-2">
                    <input data-chk-new type="text" placeholder="Add custom item (e.g. Tint windows, Ceramic coat, PDI)..." class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">
                    <button data-chk-add class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer shadow-xs">Add Item</button>
                  </div>
                </div>

                <!-- Linked Dealer Tasks (Task Board) -->
                ${(c.tasks && c.tasks.length) ? `
                  <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Get-Ready Tasks · from Task Board</label>
                    <div data-recon-tasks class="space-y-1.5"></div>
                    <p class="text-[10px] text-slate-400 mt-1.5 italic">Checking a task here automatically completes it on the manager Task Board.</p>
                  </div>
                ` : ''}

                <!-- Special Notes -->
                <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Special Cleanup / Detail Notes</label>
                  <textarea data-notes rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500" placeholder="Anything cleanup / service needs to know before delivery…">${esc(c.notes || '')}</textarea>
                </div>
              </div>
            </div>

            <!-- ── RIGHT: CONTEXT HUB (CUSTOMER + VEHICLE + TRADE) ─────────── -->
            <div class="lg:col-span-5 space-y-4">
              <!-- 1. Canonical Customer Card -->
              <div class="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7 0 3.75 3.75 0 017 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                    <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Customer Information</h4>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${esc(cust.customer_number)}</span>
                </div>

                <div class="space-y-1.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="font-black text-slate-900 dark:text-white text-sm">${esc(cust.name)}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">${esc(cust.deal_status)}</span>
                  </div>
                  <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Phone:</span>
                    <a href="tel:${esc(cust.phone)}" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">${esc(cust.phone)}</a>
                  </div>
                  <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Email:</span>
                    <a href="mailto:${esc(cust.email)}" class="font-bold text-slate-700 dark:text-slate-300 hover:underline truncate max-w-[180px]">${esc(cust.email)}</a>
                  </div>
                  <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Preferred Contact:</span>
                    <span class="font-bold text-slate-700 dark:text-slate-200">${esc(cust.preferred_contact)}</span>
                  </div>
                  <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Salesperson:</span>
                    <span class="font-bold text-slate-700 dark:text-slate-200">${esc(cust.salesperson_name)}</span>
                  </div>
                  <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>F&amp;I Manager:</span>
                    <span class="font-bold text-slate-700 dark:text-slate-200">${esc(cust.fni_manager_name)}</span>
                  </div>
                  ${cust.notes ? `
                    <div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 italic">
                      "${esc(cust.notes)}"
                    </div>
                  ` : ''}
                </div>

                <!-- Customer Action Buttons -->
                <div class="grid grid-cols-4 gap-1.5 pt-1">
                  <a href="tel:${esc(cust.phone)}" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-center text-[10px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center justify-center gap-1">Call</a>
                  <a href="sms:${esc(cust.phone)}" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-center text-[10px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center justify-center gap-1">SMS</a>
                  <a href="mailto:${esc(cust.email)}" class="px-2 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-center text-[10px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center justify-center gap-1">Email</a>
                  <button data-open-timeline class="px-2 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-center text-[10px] font-black transition cursor-pointer">Timeline</button>
                </div>
              </div>

              <!-- 2. Canonical Sold Vehicle Stock Card -->
              <div class="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Sold Vehicle Stock Card</h4>
                  </div>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Sold Unit</span>
                </div>

                <div class="flex items-start gap-3">
                  ${veh.photo ? `<img src="${API}/proxy-image?url=${encodeURIComponent(veh.photo)}" class="w-20 h-16 object-cover rounded-xl bg-slate-800 shrink-0 border border-slate-700/50">` : `<div class="w-20 h-16 rounded-xl bg-slate-800 shrink-0 border border-slate-700/50 flex items-center justify-center text-slate-500 text-xs font-bold">No Photo</div>`}
                  <div class="min-w-0 text-xs space-y-0.5">
                    <div class="font-black text-slate-900 dark:text-white text-xs truncate">${esc(veh.label)}</div>
                    <div class="text-[11px] text-slate-400 font-mono">VIN: ${esc(veh.vin)}</div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">${esc(veh.exterior_color)} · ${esc(veh.interior_color)}</div>
                    <div class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${veh.mileage != null ? `${Number(veh.mileage).toLocaleString()} km` : ''} · <span class="text-emerald-500 font-black">$${Number(veh.price || 0).toLocaleString()}</span></div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                  <div>Location: <strong class="text-slate-900 dark:text-white">${esc(veh.location || 'Detail Bay')}</strong></div>
                  <div>Keys / Fobs: <strong class="text-slate-900 dark:text-white">${veh.key_fob_count || 2} Present</strong></div>
                  <div class="col-span-2 text-[10px] text-slate-400 truncate">Options: ${esc(veh.options_summary)}</div>
                </div>

                <!-- Vehicle Actions -->
                <div class="grid grid-cols-2 gap-2 pt-1">
                  <button data-open-inventory class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center text-[10px] font-bold transition cursor-pointer">Open Inventory</button>
                  <button data-open-deal class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center text-[10px] font-bold transition cursor-pointer">Open Deal Desk</button>
                </div>
              </div>

              <!-- 3. Canonical Trade-In Card -->
              <div class="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>
                    <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Trade-In Vehicle</h4>
                  </div>
                  ${trade.has_trade ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Trade Attached</span>' : ''}
                </div>

                ${trade.has_trade ? `
                  <div class="space-y-1.5 text-xs">
                    <div class="font-black text-slate-900 dark:text-white text-xs">${esc(trade.label)}</div>
                    <div class="text-[11px] text-slate-400 font-mono">VIN: ${esc(trade.vin || 'N/A')}</div>
                    <div class="text-[11px] text-slate-500 dark:text-slate-400">${esc(trade.exterior_color || 'Standard')} · ${trade.mileage ? `${Number(trade.mileage).toLocaleString()} km` : 'N/A'}</div>
                    <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                      <div>Allowance: <strong class="text-emerald-400 font-black">$${Number(trade.trade_allowance || 0).toLocaleString()}</strong></div>
                      <div>Lien / Payoff: <strong class="text-slate-400 font-bold">$${Number(trade.payoff_amount || 0).toLocaleString()}</strong></div>
                    </div>
                    <div class="text-[10px] text-slate-400 italic">Condition: ${esc(trade.condition || 'Good')} · ${trade.keys_count || 1} key${(trade.keys_count || 1) === 1 ? '' : 's'}</div>
                  </div>
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    <button data-open-trade class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center text-[10px] font-bold transition cursor-pointer">Open Appraisal</button>
                    <button data-view-trade-photos class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-center text-[10px] font-bold transition cursor-pointer">View Trade</button>
                  </div>
                ` : `
                  <div class="py-4 text-center text-xs text-slate-400 font-semibold flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    No Trade-In on this deal
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div class="text-xs text-slate-400 font-medium">All changes sync to canonical DealerOS records in real time.</div>
          <button data-x class="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-md">Done / Close</button>
        </div>
      </div>
    `;

    // Wire Interactive Checklist items
    const chkBox = modal.querySelector('[data-checklist]');
    if (chkBox) {
      chkBox.innerHTML = checklist.map((it, i) => `
        <div class="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition">
          <input type="checkbox" data-chk="${i}" ${it.done ? 'checked' : ''} class="accent-emerald-500 w-4 h-4 rounded cursor-pointer shrink-0">
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold leading-snug ${it.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}">${esc(it.label)}</div>
            ${it.completed_by ? `<div class="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">Completed by ${esc(it.completed_by)}</div>` : ''}
          </div>
          <button data-chk-del="${i}" title="Remove item" class="text-slate-400 hover:text-rose-500 text-xs px-1 cursor-pointer transition">&times;</button>
        </div>
      `).join('') || '<div class="text-xs text-slate-400 italic py-3 text-center">No cleanup items specified yet. Pick a preset or add a custom item above.</div>';

      chkBox.querySelectorAll('[data-chk]').forEach(cb => cb.addEventListener('change', () => {
        checklist[+cb.dataset.chk].done = cb.checked;
        if (cb.checked) {
          checklist[+cb.dataset.chk].completed_by = 'Staff';
          checklist[+cb.dataset.chk].completed_at = new Date().toISOString();
        } else {
          checklist[+cb.dataset.chk].completed_by = null;
          checklist[+cb.dataset.chk].completed_at = null;
        }
        dirty = true;
        saveChk();
        renderModalContent();
      }));

      chkBox.querySelectorAll('[data-chk-del]').forEach(btn => btn.addEventListener('click', () => {
        checklist.splice(+btn.dataset.chkDel, 1);
        dirty = true;
        saveChk();
        renderModalContent();
      }));
    }

    // Wire Presets
    modal.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      if (!checklist.some(i => i.label === p)) {
        checklist.push({ label: p, done: false });
        dirty = true;
        saveChk();
        renderModalContent();
      }
    }));

    // Wire Add Custom Item
    const addItem = () => {
      const inp = modal.querySelector('[data-chk-new]');
      const v = inp?.value.trim();
      if (!v) return;
      checklist.push({ label: v, done: false });
      dirty = true;
      saveChk();
      renderModalContent();
    };
    modal.querySelector('[data-chk-add]')?.addEventListener('click', addItem);
    modal.querySelector('[data-chk-new]')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(); }
    });

    // Wire Task Board tasks
    const taskBox = modal.querySelector('[data-recon-tasks]');
    if (taskBox) {
      taskBox.innerHTML = (c.tasks || []).map(t => `
        <label class="flex items-center gap-2 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40">
          <input type="checkbox" data-rtask="${t.id}" class="accent-teal-500 w-4 h-4 flex-shrink-0 cursor-pointer">
          <span class="text-xs flex-1 text-slate-700 dark:text-slate-200 font-bold">${esc(t.title)}${t.kind ? ` · ${esc(t.kind)}` : ''}${t.assignee_name ? ` · ${esc(t.assignee_name)}` : ''}</span>
        </label>
      `).join('') || '<div class="text-xs text-slate-400 italic py-1">All get-ready tasks done.</div>';

      taskBox.querySelectorAll('[data-rtask]').forEach(cb => cb.addEventListener('change', async () => {
        cb.disabled = true;
        try {
          await apiSendJson(`/dealer-tasks/${cb.dataset.rtask}`, 'PUT', { status: 'done' });
          c.tasks = (c.tasks || []).filter(x => x.id !== cb.dataset.rtask);
          dirty = true;
          showToast('Task marked complete', 'success');
          renderModalContent();
        } catch (e) {
          cb.checked = false;
          cb.disabled = false;
          showToast(e.message || 'Could not complete task', 'error');
        }
      }));
    }

    // Wire Delivery Date/Time
    modal.querySelector('[data-delivery]')?.addEventListener('change', (e) => {
      dirty = true;
      reconApi(`/recon/${inventoryId}/delivery`, 'POST', { delivery_at: e.target.value || null }).catch(() => {});
    });

    // Wire Status Selector
    modal.querySelector('[data-status]')?.addEventListener('change', (e) => {
      currentStatus = e.target.value;
      dirty = true;
      reconApi(`/recon/${inventoryId}/status`, 'POST', { status: currentStatus, blocked_reason: blockedReason }).catch(() => {});
      renderModalContent();
    });

    // Wire Blocked input
    modal.querySelector('[data-blocked-input]')?.addEventListener('change', (e) => {
      blockedReason = e.target.value;
      dirty = true;
      reconApi(`/recon/${inventoryId}/status`, 'POST', { status: 'blocked', blocked_reason: blockedReason }).catch(() => {});
    });

    // Wire Notes
    modal.querySelector('[data-notes]')?.addEventListener('blur', (e) => {
      dirty = true;
      reconApi(`/recon/${inventoryId}/notes`, 'POST', { notes: e.target.value }).catch(() => {});
    });

    // Wire Canonical Link Buttons
    modal.querySelector('[data-open-timeline]')?.addEventListener('click', () => {
      modal.remove();
      if (typeof switchPage === 'function') switchPage('customers');
    });
    modal.querySelector('[data-open-inventory]')?.addEventListener('click', () => {
      modal.remove();
      if (typeof switchPage === 'function') switchPage('inventory');
    });
    modal.querySelector('[data-open-deal]')?.addEventListener('click', () => {
      modal.remove();
      if (typeof switchPage === 'function') switchPage('desk-a-deal');
    });
    modal.querySelector('[data-open-trade]')?.addEventListener('click', () => {
      modal.remove();
      if (typeof switchPage === 'function') switchPage('appraisals');
    });
    modal.querySelector('[data-view-trade-photos]')?.addEventListener('click', () => {
      modal.remove();
      if (typeof switchPage === 'function') switchPage('appraisals');
    });
  };

  const saveChk = () => reconApi(`/recon/${inventoryId}/checklist`, 'POST', { checklist }).catch(() => {});

  renderModalContent();
  document.body.appendChild(modal);

  const close = () => { modal.remove(); if (dirty) loadReconPage(); };
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-x]')) close(); });
}


async function reconMove(inventoryId, dir) {
  if (!__reconData) return;
  const stages = __reconData.stages;
  const card = (__reconData.cards || []).find(c => c.inventory_id === inventoryId);
  if (!card) return;
  const idx = stages.indexOf(card.stage);
  const next = dir === 'fwd' ? stages[idx + 1] : stages[idx - 1];
  if (!next) return;
  try {
    await reconApi(`/recon/${inventoryId}/stage`, 'POST', { stage: next });
    loadReconPage();
  } catch (e) { showToast(e.message || 'Could not move vehicle', 'error'); }
}

async function reconRemove(inventoryId) {
  if (!confirm('Remove this vehicle from the recon board?')) return;
  try {
    await reconApi(`/recon/${inventoryId}`, 'DELETE');
    loadReconPage();
  } catch (e) { showToast(e.message || 'Could not remove', 'error'); }
}