// ── MarketSync Page Template Chunk ──────────────────────────────────────────
(function injectChunk() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<!-- ── MarketSync Dashboard Page Containers ─────────────────────── -->
<div data-page-content="command" class="page-content hidden space-y-6">
        <div id="command-root"></div>
      </div>

<div data-page-content="insights" class="page-content space-y-8">

      <!-- MarketSync mode: the dashboard is the SaaS lead + revenue view, not vehicle metrics. -->
      <div id="ms-insights"></div>

      <!-- Loading skeleton — visible until JS resolves the profile and hides it -->
      <div id="insights-skeleton" class="space-y-4">
        <div class="h-7 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
          <div class="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
        </div>
      </div>

      <!-- Sales snapshot — clickable "what needs me now" tiles (managers / DealerOS).
           Populated by loadSalesSnapshot(); each tile deep-links to its filtered view. -->
      <div id="sales-snapshot" class="hidden"></div>

      <!-- Today's Briefing — AI daily operator digest (dealer admins) -->
      <div id="daily-digest" data-admin-only class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div class="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" width="16" height="16" class="flex-shrink-0" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Today's Briefing</h3>
          <span id="digest-date" class="text-xs text-slate-400"></span>
        </div>
        <p id="digest-summary" class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3"></p>
        <div id="digest-items" class="flex flex-wrap gap-2"></div>
      </div>

      <!-- AI Boost upsell banner — shown to dealer admins who haven't activated AI Boost -->
      <div id="ai-boost-upsell-banner" class="hidden" data-admin-only>
        <div class="flex items-start justify-between gap-4 bg-indigo-600/10 dark:bg-indigo-900/30 border border-indigo-400/40 dark:border-indigo-600/50 rounded-xl px-5 py-4">
          <div class="flex items-start gap-3">
            <svg viewBox="0 0 24 24" width="26" height="26" class="flex-shrink-0 mt-0.5" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
            <div>
              <p class="font-bold text-slate-900 dark:text-white text-sm">AI Boost — $129/month add-on</p>
              <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">Let AI write your listing copy, flag missing photos or price, and check if your vehicles are priced competitively — all before you post.</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button id="ai-boost-upsell-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Try Free for 30 Days</button>
            <button id="ai-boost-upsell-close" aria-label="Dismiss" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none p-1 transition">×</button>
          </div>
        </div>
      </div>

      <!-- Sync staleness banner (Cloudflare/extension feeds that haven't refreshed) -->
      <div id="sync-health-banner" class="hidden items-start gap-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-4">
        <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-bold text-amber-800 dark:text-amber-200">Inventory sync is behind</div>
          <div id="sync-health-msg" class="text-xs text-amber-700 dark:text-amber-300 mt-0.5"></div>
        </div>
        <a id="sync-health-open" target="_blank" rel="noopener" class="hidden flex-shrink-0 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition">Open dealer site</a>
        <button id="sync-health-dismiss" aria-label="Dismiss" class="flex-shrink-0 text-amber-400 hover:text-amber-600 text-lg leading-none p-1">×</button>
      </div>

      <!-- Time range toggle. Reusable component — same markup is used on Team Insights too. -->
      <div class="range-toggle flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Insights · <span class="range-label font-normal text-slate-500 text-sm">lifetime</span></h2>
        <div class="inline-flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-bold">
          <button type="button" data-range="7" class="range-pill px-3 py-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition">7d</button>
          <button type="button" data-range="30" class="range-pill px-3 py-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition">30d</button>
          <button type="button" data-range="90" class="range-pill px-3 py-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition">90d</button>
          <button type="button" data-range="365" class="range-pill px-3 py-1.5 rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition">1y</button>
          <button type="button" data-range="lifetime" class="range-pill px-3 py-1.5 rounded bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition">Lifetime</button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4" id="metrics-strip">
        <button type="button" onclick="switchPage('inventory')" title="Open your inventory" class="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition cursor-pointer">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Available Inventory</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1" id="metric-synced">—</div>
          <div class="text-xs text-slate-500 mt-0.5"><span id="metric-synced-total">—</span> total synced</div>
        </button>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Listings Posted</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1" id="metric-listings">—</div>
          <div class="text-xs text-slate-500 mt-0.5" id="metric-listings-scope">lifetime</div>
          <div class="hidden mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/60 grid grid-cols-2 gap-2" id="metric-listings-breakdown">
            <div>
              <div class="text-sm uppercase font-bold text-slate-500 tracking-wider">Admin</div>
              <div class="text-sm font-bold text-slate-900 dark:text-white" id="metric-listings-admin">0</div>
            </div>
            <div>
              <div class="text-sm uppercase font-bold text-slate-500 tracking-wider">Sales reps</div>
              <div class="text-sm font-bold text-slate-900 dark:text-white" id="metric-listings-reps">0</div>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Sold via Marketplace</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1" id="metric-sold">—</div>
          <div class="text-xs text-slate-500 mt-0.5">lifetime</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Active Days</div>
          <div class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1" id="metric-active-days">—</div>
          <div class="text-xs text-slate-500 mt-0.5">this week</div>
        </div>
      </div>

      <!-- Second row: derived insights. 4-col to line up with the row above. -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg" title="Average number of days between when a vehicle was posted to Marketplace and when it sold.">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Avg Time to Sell</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1"><span id="metric-time-to-sell">—</span><span class="text-sm font-normal text-slate-500 ml-1">days</span></div>
          <div class="text-xs text-slate-500 mt-0.5">posted → sold</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg" title="Average listings posted per day in this range.">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Posts / Day</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1" id="metric-posts-per-day">—</div>
          <div class="text-xs text-slate-500 mt-0.5">average rate</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg" title="Of vehicles you posted to Marketplace, how many sold? Higher is better.">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Sell-Through</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1"><span id="metric-sell-through">—</span><span class="text-sm font-normal text-slate-500 ml-0.5">%</span></div>
          <div class="text-xs text-slate-500 mt-0.5">sold ÷ posted</div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-lg" title="Available cars that have sat on your lot longer than 60 days.">
          <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Aged Inventory</div>
          <div class="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1" id="metric-aged">—</div>
          <div class="text-xs text-slate-500 mt-0.5">on lot &gt; 60 days</div>
        </div>
      </div>

      <!-- ───────── TEAM SECTION (admin only) — trend charts ───────── -->
      <!-- Per-rep "players" cards moved to the Sales Team page — click a rep's
           name there to see their tier, points & stats in a modal. -->
      <div id="insights-team-section" class="hidden space-y-6">

      <!-- Charts grid — 3x2 = 6 charts -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-3">Trends</div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Listings posted (daily)</div>
            <div class="relative h-72"><canvas id="chart-listings-daily"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Listings by rep</div>
            <div class="relative h-72"><canvas id="chart-listings-by-rep"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Sold by rep</div>
            <div class="relative h-72"><canvas id="chart-sold-by-rep"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Active days by rep</div>
            <div class="relative h-72"><canvas id="chart-active-by-rep"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Sell-through % by rep</div>
            <div class="relative h-72"><canvas id="chart-sell-through-by-rep"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Avg time to sell by rep (days)</div>
            <div class="relative h-72"><canvas id="chart-time-to-sell-by-rep"></canvas></div>
          </div>
        </div>
      </div>

      </div>

      <!-- rep-view-panel: My Performance (reps only) -->
      <div id="rep-view-panel" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-1">My Performance</h2>
        <p class="text-slate-500 dark:text-slate-400 text-xs mb-4">Your personal listing activity.</p>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Total Posts</div>
            <div class="text-2xl font-black text-slate-900 dark:text-white mt-1" id="rep-stat-total">0</div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Active</div>
            <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1" id="rep-stat-active">0</div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Sold</div>
            <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1" id="rep-stat-sold">0</div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
            <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Removed</div>
            <div class="text-2xl font-black text-slate-500 mt-1" id="rep-stat-deleted">0</div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <h3 class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">Listings &amp; sales over time</h3>
            <div class="relative h-48"><canvas id="chart-my-trend"></canvas></div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3">
            <h3 class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">Listing status</h3>
            <div class="relative h-48"><canvas id="chart-my-status"></canvas></div>
          </div>
        </div>

       <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Recent Listings</h3>
          <div class="flex gap-1">
            <button id="rep-listings-filter-posted" class="text-xs px-2 py-1 rounded border border-indigo-600 bg-indigo-600 text-white" onclick="loadMyListingsFiltered('posted')">Active</button>
            <button id="rep-listings-filter-sold" class="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400" onclick="loadMyListingsFiltered('sold')">Sold</button>
            <button id="rep-listings-filter-all" class="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400" onclick="loadMyListingsFiltered('all')">All</button>
          </div>
        </div>
        <div id="rep-recent-list" class="space-y-2 max-h-[600px] overflow-y-auto">
          <div class="text-xs text-slate-500 italic">Loading...</div>
        </div>
      </div>

      <!-- Dealer-level insights (managers/admins): sales/appointments/e-sign KPIs,
           marketing ROI snapshot, and the full CRM/lead insight panel. -->
      <div id="dealer-dash" class="hidden space-y-6"></div>

      <!-- Leaderboard — relocated here from its own nav page so the dashboard is home base. -->
      <div id="dash-leaderboard-slot" class="space-y-6"></div>

      </div>
      <!-- ───────── INVENTORY PAGE ───────── -->
      <div data-page-content="inventory" class="page-content hidden space-y-8">


      <div id="feeds-panel" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <div class="flex flex-wrap justify-between items-start mb-4 gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Inventory Feeds</h2>
            <p class="text-slate-500 dark:text-slate-400 text-xs">Manage data feed sources and pull the latest inventory.</p>
          </div>
          <button id="sync-now-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded transition whitespace-nowrap">
            Sync Now
          </button>
        </div>
        <div id="sync-status" class="hidden mb-3 p-2 text-xs rounded"></div>
        <div id="feeds-list" class="space-y-2 mb-4">
          <div class="text-xs text-slate-500 italic">Loading feeds...</div>
        </div>
        <form id="add-feed-form" data-admin-only class="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center pt-3 border-t border-slate-200 dark:border-slate-800">
          <select id="add-feed-type" class="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            <option value="all">All Inventory</option>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="demo">Demo</option>
            <option value="fleet">Fleet</option>
          </select>
          <input type="url" id="add-feed-url" placeholder="https://.../inventory.json" required class="w-full sm:flex-1 sm:min-w-[200px] min-w-0 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
          <button type="submit" class="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold px-3 py-2 rounded border border-slate-300 dark:border-slate-700 transition">Add Feed</button>
        </form>
      </div>

      <div id="catalog-panel" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <div class="sticky top-0 z-20 bg-white dark:bg-slate-900 space-y-3 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-1 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 id="catalog-title" class="text-lg font-bold text-slate-900 dark:text-white">Inventory Catalog</h2>
              <p id="catalog-sub" class="text-slate-500 dark:text-slate-400 text-xs">Your added vehicles &amp; trades — plus feed-synced stock to post on Facebook.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <input type="text" id="catalog-search" placeholder="Search make, model, VIN, stock..." class="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 w-full sm:w-64">
              <button id="site-manage-btn" data-admin-only onclick="switchPage('website')" class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0 border border-slate-300 dark:border-slate-700">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>
                Website
              </button>
              <button id="gen-pitches-btn" data-admin-only onclick="generateAllPitches(this)" title="Write an AI sales pitch for every car that doesn't have one" class="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0">✨ Sales pitches</button>
              <input type="file" id="inv-import-file" accept=".csv,text/csv" class="hidden" onchange="invImportCsv(this.files[0])">
              <button data-admin-only onclick="document.getElementById('inv-import-file').click()" title="Bulk import vehicles from a CSV" class="inv-raw-add flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0 border border-slate-300 dark:border-slate-700">Import CSV</button>
              <button data-admin-only onclick="invExportCsv(this)" title="Download all inventory as CSV" class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0 border border-slate-300 dark:border-slate-700">Export CSV</button>
              <!-- Sync Inventory: reveals the (otherwise hidden) feed panel on demand. -->
              <button id="sync-inventory-btn" data-admin-only onclick="toggleFeedsPanel(this)" title="Pull inventory from your website feed" class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0 border border-slate-300 dark:border-slate-700">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Sync Inventory
              </button>
              <button id="add-vehicle-btn" data-admin-only onclick="openVehicleForm()" class="inv-raw-add flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded transition whitespace-nowrap flex-shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                Add vehicle
              </button>
            </div>
          </div>
          <!-- Status pill row -->
          <div class="flex flex-wrap gap-1.5" id="catalog-status-pills">
            <button data-status="all"       class="catalog-status-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition">All</button>
            <button data-status="available" class="catalog-status-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Available</button>
            <button data-status="posted"    class="catalog-status-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Posted</button>
            <button data-status="pending"   class="catalog-status-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Pending</button>
            <button data-status="sold"      class="catalog-status-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Sold</button>
          </div>
          <!-- Type pill row -->
          <div class="flex flex-wrap gap-1.5" id="catalog-type-pills">
            <button data-type="all"  class="catalog-type-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition">All</button>
            <button data-type="new"  class="catalog-type-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">New</button>
            <button data-type="used" class="catalog-type-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Used</button>
            <button data-type="demo" class="catalog-type-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Demo</button>
          </div>
          <!-- Segment pill row (AI Boost only — hidden until caches load) -->
          <div class="flex flex-wrap gap-1.5 hidden" id="catalog-segment-pills">
            <button data-seg="all"  class="catalog-segment-pill active px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600 text-white transition">All</button>
            <button data-seg="hot"  class="catalog-segment-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Hot</button>
            <button data-seg="cold" class="catalog-segment-pill px-3 py-1 rounded-full text-xs font-semibold border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">❄️ Cold</button>
          </div>
          <!-- hidden select kept for JS compatibility -->
          <select id="catalog-status" class="hidden"></select>
        </div>
        <div id="catalog-value-summary" class="hidden grid-cols-2 sm:grid-cols-4 gap-2 mb-3"></div>
        <div id="catalog-list" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div class="text-xs text-slate-500 italic col-span-full">Loading catalog...</div>
        </div>
      </div>

      </div>
      <!-- ───────── RECONDITIONING PAGE ───────── -->
      <div data-page-content="recon" class="page-content hidden space-y-5">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">Cleanup</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Get-ready list for cars going out — delivery times, what each car needs, and sign-off. Cars land here automatically when a deal is approved in FNI.</p>
          </div>
        </div>
        <div id="recon-root">
          <div class="py-16 text-center text-sm text-slate-400 italic">Loading cleanup…</div>
        </div>
      </div>
      <!-- ───────── FNI DEALS PAGE ───────── -->
      <div data-page-content="fni" class="page-content hidden space-y-5">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">Deals</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pending &amp; pushed deals waiting for delivery. Do the credit app &amp; F&amp;I products, hit <b>Approve</b> to send get-ready to cleanup/service, then <b>Delivered</b> to close it out.</p>
          </div>
        </div>
        <div id="fni-root">
          <div class="py-16 text-center text-sm text-slate-400 italic">Loading deals…</div>
        </div>
      </div>
      <!-- ───────── LEADERBOARD PAGE ───────── -->
      <div data-page-content="leaderboard" class="page-content hidden space-y-6">

      <!-- Single combined card with carousel tabs -->
      <div id="leaderboard-panel" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6 space-y-6">

        <!-- Header row: title + team conversion + carousel tabs -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="lb-title" class="text-lg font-bold text-slate-900 dark:text-white">🏆 Leaderboard</h2>
            <p id="lb-subtitle" class="text-slate-500 dark:text-slate-400 text-xs">500 pts / deal · 50 pts / appraisal · 100 pts / listing · Climb the tiers, top the team.</p>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <!-- Team conversion (hidden on global view) -->
            <div id="lb-conv-wrap" class="text-right">
              <div id="lb-conv-label" class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Team Conversion</div>
              <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none"><span id="lb-conv">—</span>%</div>
              <div id="lb-team-summary" class="text-xs text-slate-500"><span id="lb-team-sold">0</span> sold of <span id="lb-team-total">0</span> posted</div>
            </div>
            <!-- Carousel tab pills -->
            <div class="inline-flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-bold">
              <button type="button" id="lb-tab-team" class="lb-view-tab px-3 py-1.5 rounded bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm transition">My Team</button>
              <button type="button" id="lb-tab-global" class="lb-view-tab px-3 py-1.5 rounded text-slate-500 dark:text-slate-400 transition">🌎 Global</button>
            </div>
          </div>
        </div>

        <!-- ── Legend (compact, always visible at top) ── -->
        <div class="lb-legend border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span data-lb-non-fb><span class="font-bold text-emerald-600 dark:text-emerald-400">+500</span> Close a deal</span>
          <span data-lb-non-fb><span class="font-bold text-amber-600 dark:text-amber-400">+50</span> Trade appraisal</span>
          <span><span class="font-bold text-indigo-600 dark:text-indigo-400">+100</span> Post a car</span>
          <span><span class="font-bold text-emerald-600 dark:text-emerald-400">+500</span> Sell what you posted</span>
          <div id="lb-legend-tiers" class="w-full flex flex-wrap gap-x-5 gap-y-0.5 mt-0.5"></div>
        </div>

        <!-- ── MY TEAM VIEW ── -->
        <div id="lb-view-team">
          <!-- Podium for top 3 -->
          <div id="lb-podium" class="grid grid-cols-3 gap-2 sm:gap-3 items-end max-w-2xl mx-auto mb-6">
            <div class="text-center text-xs text-slate-500 italic col-span-3 py-6">Loading podium...</div>
          </div>

          <!-- Your position / progress -->
          <div id="lb-you" class="bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg p-5 hidden mb-6">
            <div class="flex items-center justify-between mb-3 gap-4 flex-wrap">
              <div>
                <div class="text-xs uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-300">Your position</div>
                <div class="flex items-baseline gap-2 mt-1">
                  <span class="text-3xl font-black text-slate-900 dark:text-white">#<span id="lb-you-rank">—</span></span>
                  <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">of <span id="lb-you-total">—</span></span>
                </div>
              </div>
              <div class="text-right">
                <div id="lb-you-tier-badge" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"></div>
                <div class="text-2xl font-black text-slate-900 dark:text-white mt-1"><span id="lb-you-points">0</span> <span class="text-xs font-medium text-slate-500">pts</span></div>
              </div>
            </div>
            <div class="mt-2">
              <div class="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                <span id="lb-you-current-tier">—</span>
                <span><span id="lb-you-progress-pct">0</span>% to <span id="lb-you-next-tier">—</span></span>
              </div>
              <div class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div id="lb-you-progress-bar" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700" style="width:0%"></div>
              </div>
              <div class="text-xs text-slate-500 mt-1"><span id="lb-you-points-to-next">0</span> pts to next tier</div>
            </div>
          </div>

          <!-- Achievements (rep + dealership badges) -->
          <div id="lb-achievements" class="mb-6"></div>

          <!-- Full ranking table -->
          <div>
            <div id="lb-rankings-title" class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-2">Full rankings</div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-xs">
                    <th class="py-3 px-3 text-left w-12">Rank</th>
                    <th class="py-3 px-3 text-left">Player</th>
                    <th class="py-3 px-3 text-left">Tier</th>
                    <th class="py-3 px-3 text-right">Points</th>
                    <th data-lb-non-fb class="py-3 px-3 text-right">Deals</th>
                    <th data-lb-non-fb class="py-3 px-3 text-right">Appr.</th>
                    <th class="py-3 px-3 text-right">Listings</th>
                    <th class="py-3 px-3 text-right">FB Sold</th>
                    <th class="py-3 px-3 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody id="leaderboard-body" class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr><td colspan="9" class="p-6 text-center text-slate-500 italic">Loading leaderboard...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Activity feed -->
          <div class="mt-6">
            <div class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-2">Recent activity</div>
            <div id="lb-activity" class="space-y-2 max-h-72 overflow-y-auto pr-1">
              <div class="text-xs text-slate-500 italic">Loading activity...</div>
            </div>
          </div>
        </div>

        <!-- ── GLOBAL VIEW ── (hidden by default) -->
        <div id="lb-view-global" class="hidden" id="global-leaderboard-panel">
          <div class="flex items-center justify-between mb-3">
            <p id="gl-subtitle" class="text-xs text-slate-500 dark:text-slate-400">How you stack up across every dealer &amp; rep on MarketSync. Others are anonymized — only you see your name.</p>
            <!-- Reps / Dealers toggle -->
            <div class="inline-flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-bold flex-shrink-0 ml-3">
              <button type="button" data-gl-tab="reps" class="gl-tab px-3 py-1.5 rounded bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition">Reps</button>
              <button type="button" data-gl-tab="dealers" class="gl-tab px-3 py-1.5 rounded text-slate-600 dark:text-slate-300 transition">Dealers</button>
            </div>
          </div>
          <!-- Global podium -->
          <div id="gl-podium" class="grid grid-cols-3 gap-2 sm:gap-3 items-end max-w-2xl mx-auto mb-5"></div>

          <!-- Global avg comparison strip -->
          <div id="gl-avg-strip" class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-4 py-3 text-center">
              <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Your Points</div>
              <div id="gl-your-pts" class="text-xl font-black text-indigo-600 dark:text-indigo-400">—</div>
              <div class="text-xs text-slate-400 mt-0.5">Avg: <span id="gl-avg-pts">—</span></div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-4 py-3 text-center">
              <div id="gl-posted-label" class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Your Listings</div>
              <div id="gl-your-posted" class="text-xl font-black text-indigo-600 dark:text-indigo-400">—</div>
              <div class="text-xs text-slate-400 mt-0.5">Avg: <span id="gl-avg-posted">—</span></div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-4 py-3 text-center">
              <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Your Conv %</div>
              <div id="gl-your-conv" class="text-xl font-black text-amber-600 dark:text-amber-400">—</div>
              <div class="text-xs text-slate-400 mt-0.5">Avg: <span id="gl-avg-conv">—</span></div>
            </div>
          </div>
          <div id="gl-you" class="hidden text-xs rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 px-3 py-2 mb-3"></div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-xs">
                  <th class="py-3 px-3 text-left w-12">Rank</th>
                  <th class="py-3 px-3 text-left">Name</th>
                  <th class="py-3 px-3 text-right">Points</th>
                  <th class="py-3 px-3 text-right">Listings</th>
                  <th class="py-3 px-3 text-right">Sold</th>
                </tr>
              </thead>
              <tbody id="gl-body" class="divide-y divide-slate-100 dark:divide-slate-800/60">
                <tr><td colspan="5" class="p-6 text-center text-slate-500 italic">Loading global leaderboard…</td></tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      </div>
      <!-- ───────── SALES TEAM PAGE ───────── -->
      <div data-page-content="sales-team" class="page-content hidden space-y-8">

      <div id="lead-routing-card" data-admin-only class="hidden"></div>

      <div id="dealer-view-panel" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <div class="flex justify-between items-start mb-4 gap-4 flex-wrap">
          <div>
            <h2 id="dealer-team-title" class="text-lg font-bold text-slate-900 dark:text-white">Staff &amp; Team</h2>
            <p id="dealer-team-subtitle" class="text-slate-500 dark:text-slate-400 text-xs">Invite, edit, assign roles, comp plans, and manage staff members.</p>
          </div>
          <div class="flex gap-2">
            <button id="invite-rep-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded transition whitespace-nowrap">
              + Invite Staff
            </button>
            <button id="invite-manager-btn" data-admin-only class="bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold px-4 py-2 rounded transition whitespace-nowrap">
              + Invite Manager
            </button>
          </div>
        </div>

        <form id="invite-rep-form" class="hidden mb-4 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded space-y-2">
          <div id="invite-form-title" class="text-xs font-bold text-slate-700 dark:text-slate-200">Invite a staff member</div>
          <input type="hidden" id="invite-role" value="SALES_REP">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" id="invite-name" required placeholder="Full name" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            <input type="email" id="invite-email" required placeholder="staff@dealership.com" class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
          </div>
          <input type="password" id="invite-password" placeholder="Temporary password (leave blank to auto-generate)" class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
          <div class="flex gap-2 justify-end">
            <button type="button" id="invite-cancel-btn" class="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:hover:text-slate-700 dark:text-slate-200 px-3 py-2">Cancel</button>
            <button type="submit" id="invite-submit-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded transition">Create Staff Member</button>
          </div>
        </form>

        <div id="invite-result" class="hidden mb-3 p-2 text-xs rounded"></div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold text-xs">
                <th class="py-3 px-3">Name</th>
                <th class="py-3 px-3 max-w-[160px]">Email</th>
                <th class="py-3 px-3">Role</th>
                <th class="py-3 px-3">Location</th>
                <th class="py-3 px-3">Comp Plan</th>
                <th class="py-3 px-3 text-center">Compliance</th>
                <th class="py-3 px-3 text-right">Logins</th>
                <th class="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="dealer-team-table-body" class="divide-y divide-slate-800/60 text-slate-700 dark:text-slate-200">
              <tr><td colspan="8" class="p-4 text-slate-500 italic">Loading team...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      </div><!-- /sales-team page -->

      <!-- ── AI Boost Page ── -->

      <!-- ── Inventory Intelligence Page ───────────────────────────────────── -->
      <!-- ───────── MARKET & COMPETITORS PAGE (Inventory Intelligence) ───────── -->
      <div data-page-content="market" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Market &amp; Competitors</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Live market snapshots and nearby-lot pricing — part of Inventory Intelligence.</p>
        </div>
        <div id="market-upsell" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500 dark:text-slate-400">Market &amp; Competitors is part of <span class="font-bold text-slate-700 dark:text-slate-200">Inventory Intelligence</span>. Activate it to track nearby lots and pull live market snapshots.</div>
        <div id="market-content" class="space-y-6">
          <!-- ── Market & Competitors section header ───────────────────────── -->
          <div class="pt-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-sky-500 flex-shrink-0"></span> Market &amp; Competitors
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-3.5">Track nearby dealership lots and compare their pricing against your lot at a glance.</p>
          </div>

          <!-- ── Market Snapshot (MarketCheck) ───────────────────────────── -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Market Snapshot</h3>
              <span class="text-[9px] font-black uppercase tracking-wider bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded-full leading-none">Live</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Active listing count, median price and days-on-market for any make/model — live from MarketCheck.</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input id="msnap-make" placeholder="Make" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <input id="msnap-model" placeholder="Model" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <input id="msnap-year" inputmode="numeric" placeholder="Year (optional)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <input id="msnap-trim" placeholder="Trim (optional)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            </div>
            <button id="msnap-run" class="mt-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Get snapshot</button>
            <div id="msnap-result" class="mt-3"></div>
          </div>

          <!-- ── Competitor Monitoring ───────────────────────────────────── -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ai-accordion-open">
            <button type="button" onclick="this.closest('.rounded-xl').classList.toggle('ai-accordion-open')" class="w-full px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0"></span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">Direct Competition <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg></h3>
                <span class="text-xs text-slate-400 font-normal">— track nearby dealership lots</span>
              </div>
              <svg class="w-4 h-4 text-slate-400 transition-transform ai-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="ai-accordion-body p-5 space-y-4">
              <!-- Your lot — compact, for quick side-by-side comparison with competitors -->
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 px-3 py-2 text-xs">
                <span class="font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">Your lot</span>
                <span class="text-slate-600 dark:text-slate-300"><span id="lot-mini-count" class="font-bold text-slate-900 dark:text-white">—</span> vehicles</span>
                <span class="text-slate-600 dark:text-slate-300"><span id="lot-mini-range" class="font-bold text-slate-900 dark:text-white">—</span></span>
                <span class="text-slate-600 dark:text-slate-300">avg <span id="lot-mini-avg" class="font-bold text-slate-900 dark:text-white">—</span></span>
              </div>
              <div id="competitors-list" class="space-y-2">
                <div class="text-xs text-slate-400 italic" id="competitors-loading">Loading…</div>
              </div>
              <!-- Add competitor form -->
              <div class="pt-3 border-t border-slate-200 dark:border-slate-700">
                <div class="text-xs uppercase font-bold text-slate-400 mb-2 tracking-wider">Add Competitor</div>
                <div class="flex flex-col sm:flex-row gap-2">
                  <input type="text" id="competitor-name-input" placeholder="Dealership name" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <input type="url" id="competitor-url-input" placeholder="Inventory URL (dealership site or autotrader.ca/dealers/…)" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <button id="competitor-add-btn" class="bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Add</button>
                </div>
              </div>
              <button id="competitors-scan-btn" class="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold px-5 py-2 rounded-lg transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Scan All
              </button>
              <!-- Comparison panel — populated by JS after scan -->
              <div id="competitor-comparison" class="hidden"></div>
            </div>
          </div>
        </div>
      </div>

      <div data-page-content="inv-intel" class="page-content hidden space-y-6">

        <!-- Header -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
              Inventory Intelligence
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Turn rate, health scores, vehicle gaps, and AI insights for your lot.</p>
          </div>
        </div>

        <!-- ── Upsell — non-subscribers ──────────────────────────────────── -->
        <div id="inv-intel-page-upsell" class="hidden">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Everything in Inventory Intelligence — $299/month</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Start with a free 30-day trial. No credit card required.</p>
            </div>
            <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Hot &amp; cold vehicle detection</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Turn rate per vehicle</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Per-vehicle health scores (0–100)</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>AI-written lot narrative — plain English insights</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Duplicate VIN detection across your lot</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Months-of-supply analysis by make &amp; model</div>
            </div>
            <div class="px-6 py-5 border-t border-slate-200 dark:border-slate-800">
              <button id="inv-intel-page-upgrade-btn" class="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-lg transition text-sm">Start 30-Day Free Trial</button>
              <span class="ml-4 text-xs text-slate-400">No credit card required · $299/month after trial</span>
            </div>
          </div>
        </div>

        <!-- ── Active content ─────────────────────────────────────────────── -->
        <div id="inv-intel-active-content" class="hidden space-y-5">

          <!-- MarketCheck live-data status — tells the dealer if the licensed feed is on -->
          <div id="marketcheck-status" class="hidden text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-2"></div>

          <!-- ── Your lot at a glance — the baseline for competitor comparison ──── -->
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-violet-500 flex-shrink-0"></span> Your Lot at a Glance
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-3.5">Your live inventory totals — compare these against the competitor lots you track further down.</p>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">Vehicles on lot</div>
              <div class="text-2xl font-black text-slate-900 dark:text-white" id="lot-ov-count">—</div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">Price range</div>
              <div class="text-2xl font-black text-slate-900 dark:text-white" id="lot-ov-range">—</div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">Average price</div>
              <div class="text-2xl font-black text-slate-900 dark:text-white" id="lot-ov-avg">—</div>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div class="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">New / Used</div>
              <div class="text-2xl font-black text-slate-900 dark:text-white" id="lot-ov-split">—</div>
            </div>
          </div>

          <!-- ── Inventory Scan — part of the Inventory Intelligence add-on ────────── -->
      <div id="inv-scan-card" data-admin-only class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" class="flex-shrink-0" aria-hidden="true"><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
              Inventory Scan
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-xs mt-0.5 max-w-xl">Run live-market checks across every active listing — refreshes each vehicle's “% to market”, flags mispriced units, and powers your Lot Average Report and trade appraisals.</p>
          </div>
          <!-- Active controls — Inventory Intelligence subscribers -->
          <div id="inv-scan-controls" class="hidden flex flex-wrap gap-2 sm:justify-end">
            <button id="ai-sync-all-btn" class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition whitespace-nowrap">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Scan All Inventory
            </button>
            <button id="ai-activity-refresh" class="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold px-4 py-2.5 rounded-lg transition border border-slate-200 dark:border-slate-700 whitespace-nowrap">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh Log
            </button>
            <button id="ai-lot-report-btn" class="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition whitespace-nowrap">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              Lot Average Report
            </button>
          </div>
        </div>

        <!-- Upsell — non-subscribers -->
        <div id="inv-scan-upsell" class="hidden mt-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-lg px-4 py-3">
          <p class="text-sm text-violet-800 dark:text-violet-200 flex-1">Inventory Scan is part of <strong>Inventory Intelligence</strong> — see exactly how every unit is priced against the live market, flag mispriced stock, and value trades.</p>
          <button type="button" onclick="openUpgradeModal('inv_intel')" class="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Unlock — $299/mo</button>
        </div>

        <!-- Active content — progress, stats, results -->
        <div id="inv-scan-active" class="hidden mt-4 space-y-4">
          <div id="ai-sync-status" class="hidden space-y-2">
            <div class="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <svg class="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              <span id="ai-sync-status-text">Starting scan…</span>
            </div>
            <div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div id="ai-sync-progress-bar" class="h-full bg-indigo-500 rounded-full transition-all duration-500" style="width:0%"></div>
            </div>
            <div class="text-xs text-slate-400" id="ai-sync-progress-label"></div>
          </div>

          <!-- Monthly live-market usage vs cap (cached lookups don't count) -->
          <div id="inv-scan-usage" class="hidden text-[11px] text-slate-400"></div>

          <!-- Summary stat cards — click to filter the list below -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button type="button" data-ai-filter="all" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none">
              <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Total Checks</div>
              <div class="text-3xl font-black text-slate-900 dark:text-white" id="ai-stat-total">—</div>
            </button>
            <button type="button" data-ai-filter="price" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition hover:border-red-300 dark:hover:border-red-700 focus:outline-none">
              <div class="text-xs uppercase font-bold tracking-wider text-red-500 mb-1">Price Flags</div>
              <div class="text-3xl font-black text-red-500" id="ai-stat-price-flags">—</div>
            </button>
            <button type="button" data-ai-filter="missing" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition hover:border-amber-300 dark:hover:border-amber-700 focus:outline-none">
              <div class="text-xs uppercase font-bold tracking-wider text-amber-500 mb-1">Missing Info</div>
              <div class="text-3xl font-black text-amber-500" id="ai-stat-warnings">—</div>
            </button>
            <button type="button" data-ai-filter="copies" class="ai-stat-card text-left bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition hover:border-emerald-300 dark:hover:border-emerald-700 focus:outline-none">
              <div class="text-xs uppercase font-bold tracking-wider text-emerald-500 mb-1">Copies Written</div>
              <div class="text-3xl font-black text-emerald-500" id="ai-stat-copies">—</div>
            </button>
          </div>

          <!-- Activity feed -->
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Inventory Scan Results — per-vehicle checks</h3>
              <span id="ai-activity-count" class="text-xs text-slate-400"></span>
            </div>
            <div class="max-h-[500px] overflow-y-auto">
              <div id="ai-activity-loading" class="py-12 text-center text-sm text-slate-400 italic">Loading…</div>
              <div id="ai-activity-empty" class="hidden py-12 text-center text-sm text-slate-400 px-6">No activity yet — click <strong class="text-slate-600 dark:text-slate-300">Scan All Inventory</strong> to run the first check.</div>
              <div id="ai-activity-error" class="hidden py-6 px-5 text-sm text-red-500"></div>
              <ul id="ai-activity-list" class="hidden divide-y divide-slate-100 dark:divide-slate-800"></ul>
            </div>
          </div>
        </div>
      </div>


          <!-- VIN decode, recalls, window stickers & brochures now live on each
               vehicle in the Inventory page (part of Inventory Intelligence). -->
          <div class="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900 rounded-xl px-4 py-3 text-sm text-violet-800 dark:text-violet-200 flex items-center gap-2">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>VIN decode, recall checks, window stickers &amp; brochures are now on each vehicle under <button type="button" onclick="switchPage('inventory')" class="font-bold underline hover:no-underline">Inventory</button>.</span>
          </div>



          <!-- ── Lot Analysis ──────────────────────────────────────────────── -->
          <div class="pt-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-emerald-500 flex-shrink-0"></span> Lot Analysis
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-3.5">Turn rate, health scores, hot &amp; cold movers, duplicate VINs, and an AI-written read on your whole lot.</p>
          </div>
          <div class="space-y-4">
            <div class="flex items-center justify-end gap-3">
              <button id="inv-intel-refresh-btn" class="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-500 dark:text-violet-400 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
                Refresh
              </button>
            </div>

            <!-- Loading state -->
            <div id="inv-intel-loading" class="hidden flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <svg class="animate-spin w-8 h-8 text-violet-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              <span class="text-sm">Analyzing your inventory…</span>
            </div>

            <!-- Content -->
            <div id="inv-intel-content" class="hidden space-y-6">

              <!-- Summary stat row -->
              <div id="inv-intel-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3"></div>

              <!-- AI Narrative -->
              <div id="inv-intel-narrative" class="hidden bg-gradient-to-br from-violet-50 to-slate-50 dark:from-violet-950/30 dark:to-slate-900 border border-violet-200 dark:border-violet-800/50 rounded-xl p-5">
                <div class="flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
                  <span class="text-sm font-bold text-slate-900 dark:text-white">AI Lot Analysis</span>
                  <span class="text-[10px] text-slate-400">Generated now</span>
                </div>
                <ul id="inv-intel-narrative-list" class="space-y-1.5"></ul>
              </div>

              <!-- Hot / Cold Segments -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-white dark:bg-slate-800/60 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-3">
                    <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
                    <span class="text-sm font-bold text-slate-900 dark:text-white">Top 5 Hot Vehicles</span>
                    <span class="text-xs text-slate-400">Low stock · selling fast</span>
                  </div>
                  <div id="inv-intel-hot" class="space-y-2 text-sm text-slate-500">—</div>
                </div>
                <div class="bg-white dark:bg-slate-800/60 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                  <div class="flex items-center gap-2 mb-3">
                    <span class="text-base">🧊</span>
                    <span class="text-sm font-bold text-slate-900 dark:text-white">Top 5 Cold Vehicles</span>
                    <span class="text-xs text-slate-400">High stock · slow moving</span>
                  </div>
                  <div id="inv-intel-cold" class="space-y-2 text-sm text-slate-500">—</div>
                </div>
              </div>

              <!-- Duplicate VINs alert -->
              <div id="inv-intel-dups-wrap" class="hidden bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-base">⚠️</span>
                  <span class="text-sm font-bold text-red-800 dark:text-red-300">Duplicate VINs Detected</span>
                </div>
                <div id="inv-intel-dups" class="space-y-2 text-sm"></div>
              </div>

              <!-- Turn Rate table -->
              <div class="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <span class="text-sm font-bold text-slate-900 dark:text-white">Turn Rate</span>
                  <span class="text-xs text-slate-400">Last 90 days · sorted by volume</span>
                </div>
                <div style="-webkit-overflow-scrolling:touch;max-height:360px;overflow-x:auto;overflow-y:auto">
                  <table class="min-w-full text-sm">
                    <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                      <tr>
                        <th class="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Vehicle</th>
                        <th class="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sold 30d</th>
                        <th class="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Sold 90d</th>
                        <th class="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">In Stock</th>
                        <th class="text-right px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Mo. Supply</th>
                      </tr>
                    </thead>
                    <tbody id="inv-intel-velocity-body" class="divide-y divide-slate-100 dark:divide-slate-700"></tbody>
                  </table>
                </div>
              </div>

              <!-- Vehicle Health Scores -->
              <div class="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                  <span class="text-sm font-bold text-slate-900 dark:text-white">Vehicle Health Scores</span>
                  <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-400 hidden sm:inline">Lowest scores first · click to open unit</span>
                    <button type="button" id="health-score-photos-btn" class="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition">Score photos (AI Vision)</button>
                  </div>
                </div>
                <div style="max-height:420px;overflow-x:auto;overflow-y:auto">
                  <table class="w-full text-sm">
                    <thead class="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
                      <tr>
                        <th class="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Unit</th>
                        <th class="text-center px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                        <th class="text-center px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Photos</th>
                        <th class="text-center px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Days</th>
                        <th class="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody id="inv-intel-health-body"></tbody>
                  </table>
                </div>
              </div>

            </div><!-- /inv-intel-content -->
          </div><!-- /analysis section -->

          <!-- ── Pricing & Acquisition section header ──────────────────────── -->
          <div class="pt-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-orange-500 flex-shrink-0"></span> Inventory Intelligence
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-3.5">Auto-flag stale, overpriced units and get AI recommendations on what to stock next.</p>
          </div>
`);
      if (window.switchPage && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Template Chunk Init]', e); }
})();
