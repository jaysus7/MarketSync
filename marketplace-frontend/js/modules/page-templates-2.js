// ── MarketSync Page Template Submodule (Part 2) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<!-- ── AI Boost Page ── -->

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



          `);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 2]', e); }
})();
