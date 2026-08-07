// ── MarketSync Page Template Submodule (Part 4) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<!-- Activity feed -->
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

<!-- ── Repricing Rules ─────────────────────────────────────────── -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ai-accordion-open">
            <button type="button" onclick="this.closest('.rounded-xl').classList.toggle('ai-accordion-open')" class="w-full px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"></span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">Repricing Rules <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg></h3>
                <span class="text-xs text-slate-400 font-normal">— auto-flag stale overpriced units</span>
              </div>
              <svg class="w-4 h-4 text-slate-400 transition-transform ai-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="ai-accordion-body p-5 space-y-4">
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
                <strong class="text-slate-700 dark:text-slate-200">What this is:</strong> a watchdog that flags units sitting too long or priced above market so you can act before they go stale.
                <strong class="text-slate-700 dark:text-slate-200">How to use it:</strong> turn it on, set the days-on-lot trigger and how far above market counts as "overpriced," and MarketSync raises a Needs-Attention flag on each unit that trips a rule (prices are never changed automatically — you stay in control).
              </p>
              <div class="flex items-center gap-3">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="repricing-enabled" class="sr-only peer">
                  <div class="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Enable automated repricing alerts</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Days on Lot</label>
                  <input type="number" id="repricing-days" min="1" max="365" value="45" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <p class="text-xs text-slate-400 mt-1">Flag vehicles on lot longer than this.</p>
                </div>
                <div>
                  <label class="block text-xs uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Suggested Price Drop %</label>
                  <input type="number" id="repricing-drop-pct" min="1" max="50" value="5" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <p class="text-xs text-slate-400 mt-1">Recommended reduction when flagged.</p>
                </div>
                <div>
                  <label class="block text-xs uppercase font-bold text-slate-400 mb-1.5 tracking-wider">Overprice Threshold %</label>
                  <input type="number" id="repricing-overprice-pct" min="1" max="100" value="20" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <p class="text-xs text-slate-400 mt-1">% above median to consider overpriced.</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <button id="repricing-save-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">Save Rules</button>
                <button id="repricing-apply-btn" class="bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">Apply Rules Now</button>
              </div>
            </div>
          </div>

<!-- ── Stocking Recommendations ────────────────────────────────── -->
          <div id="stocking-accordion" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ai-accordion-open">
            <button type="button" onclick="this.closest('.rounded-xl').classList.toggle('ai-accordion-open')" class="w-full px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Stock Recommendations</h3>
                <span class="text-xs text-slate-400 font-normal">— AI-driven acquisition targets</span>
              </div>
              <svg class="w-4 h-4 text-slate-400 transition-transform ai-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="ai-accordion-body p-5 space-y-4">
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Analyzes your recent sell-through history, current stock, and nearby competitor lots to recommend the 5 best vehicles to acquire next.</p>
              <button id="stocking-generate-btn" class="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
                Refresh
              </button>
              <div id="stocking-results" class="space-y-3"></div>
            </div>
          </div>

<!-- ── Reports & Alerts section header ───────────────────────────── -->
          <div class="pt-2">
            <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="w-1.5 h-4 rounded-full bg-violet-500 flex-shrink-0"></span> Reports &amp; Alerts
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-3.5">Email digests of aging units, price drift and gaps — sent to your alert address.</p>
          </div>

<!-- ── Weekly Lot Health Report ────────────────────────────────── -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ai-accordion-open">
            <button type="button" onclick="this.closest('.rounded-xl').classList.toggle('ai-accordion-open')" class="w-full px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0"></span>
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Weekly Lot Health Report</h3>
                <span class="text-xs text-slate-400 font-normal">— email digest of aging, drift &amp; gaps</span>
              </div>
              <svg class="w-4 h-4 text-slate-400 transition-transform ai-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="ai-accordion-body p-5 space-y-4">
              <!-- Daily briefing email opt-in -->
              <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily briefing email</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">A short “Today's Briefing” to your alert email — only on days there's something to act on.</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" id="daily-digest-toggle" class="sr-only peer">
                  <div class="w-10 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Sends a full lot health email to your alert address: aging units (60+ days), price drift flags, slow movers, and missing-info alerts from the last 7 days.</p>
              <div class="flex items-center gap-3 flex-wrap">
                <button id="weekly-report-btn" class="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                  Send Report Now
                </button>
                <button id="weekly-report-pdf-btn" class="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold px-5 py-2 rounded-lg transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                  Download PDF
                </button>
                <span id="weekly-report-last-sent" class="text-xs text-slate-400"></span>
              </div>
            </div>
          </div>

</div><!-- /inv-intel-active-content -->
      </div>

<div data-page-content="ai-vision" class="page-content hidden hidden space-y-6">

<div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              AI Vision
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">AI photo-quality scoring — find the listings with weak photos before buyers scroll past them.</p>
          </div>
        </div>

<!-- Upsell — non-subscribers -->
        <div id="ai-vision-page-upsell" class="hidden">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">AI Vision — included with AI Boost</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Start with a free 30-day trial. No credit card required.</p>
            </div>
            <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>AI scores every listing's photos 0–100</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Flags blurry, dark &amp; placeholder photos</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Checks the hero photo actually shows the car</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Worst listings surface first — fix them fast</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Runs automatically on every inventory sync</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Flags photo counts that are too low to convert</div>
            </div>
            <div class="px-6 py-5 border-t border-slate-200 dark:border-slate-800">
              <button id="ai-vision-upgrade-btn" class="bg-amber-500 hover:bg-amber-400 text-white font-bold px-6 py-3 rounded-lg transition text-sm">Included with AI Boost →</button>
              <span class="ml-4 text-xs text-slate-400">AI Vision is part of AI Boost — $129/month</span>
            </div>
          </div>
        </div>

<!-- Active content -->
        <div id="ai-vision-active-content" class="hidden space-y-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div id="ai-vision-stats" class="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1"></div>
            <button id="ai-vision-scan-btn" class="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition whitespace-nowrap">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Scan Photos <svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Lowest-scoring listings</h3>
              <span class="text-xs text-slate-400">Worst photos first</span>
            </div>
            <div id="ai-vision-list" class="divide-y divide-slate-100 dark:divide-slate-800">
              <div class="px-5 py-10 text-center text-sm text-slate-400 italic">Run a scan to score your photos.</div>
            </div>
          </div>
        </div>
      </div>

<div data-page-content="website" class="page-content hidden space-y-6">
        <div id="website-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="website-settings" class="page-content hidden hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Website Settings</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Domain, SEO, tracking and lead-capture widgets for your dealer site.</p>
        </div>
        <div id="website-settings-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="automation" class="page-content hidden hidden space-y-6">
        <div id="automation-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="automation-builder" class="page-content hidden hidden space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Automation Builder</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Build the follow-up sequences that fire automatically.</p>
        </div>
        <div id="auto-builder-tabs" class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 flex-wrap"></div>
        <div id="auto-leads-root" class="space-y-6 hidden"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
        <div id="auto-delivery-root" class="space-y-6 hidden"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
        <div id="auto-holidays-root" class="space-y-6 hidden"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="equity" class="page-content hidden space-y-6">
        <div id="equity-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="crm" class="page-content hidden space-y-6">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 id="crm-page-title" class="text-xl font-bold text-slate-900 dark:text-white">Customers</h2>
            <p id="crm-page-sub" class="text-sm text-slate-500 dark:text-slate-400 mt-1">Every lead, appraisal and sale on one customer record — with a full activity timeline, follow-up tasks, and one-click email.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" id="crm-bulk-btn" data-admin-only onclick="openBulkOutreach()" class="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Bulk message
            </button>
            <button type="button" onclick="openCrmContactModal()" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              New contact
            </button>
          </div>
        </div>
        <div id="crm-body"></div>
      </div>

<div data-page-content="leads" class="page-content hidden space-y-6">
        <div id="leads-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading leads…</div></div>
      </div>

<div data-page-content="appointments" class="page-content hidden hidden space-y-6">
        <div id="appointments-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading appointments…</div></div>
      </div>

<div data-page-content="service-appointments" class="page-content hidden hidden space-y-6">
        <div id="service-appointments-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading service appointments…</div></div>
      </div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 4]', e); }
})();
