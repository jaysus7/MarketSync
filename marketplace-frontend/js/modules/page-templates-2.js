// ── MarketSync Page Template Chunk ──────────────────────────────────────────
(function injectChunk() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `          <!-- ── Repricing Rules ─────────────────────────────────────────── -->
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
      </div><!-- /inv-intel page -->

      <!-- ── AI Vision Page ────────────────────────────────────────────────── -->
      <div data-page-content="ai-vision" class="page-content hidden space-y-6">

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
      </div><!-- /ai-vision page -->

      <!-- ── CRM Page (unified customer records + timeline + tasks) ────────── -->
      <!-- ── Website builder page ─────────────────────────────────────────── -->
      <div data-page-content="website" class="page-content hidden space-y-6">
        <div id="website-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

      <!-- ── Website settings (own page — domain, SEO, widgets) ───────────── -->
      <div data-page-content="website-settings" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Website Settings</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Domain, SEO, tracking and lead-capture widgets for your dealer site.</p>
        </div>
        <div id="website-settings-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

      <div data-page-content="automation" class="page-content hidden space-y-6">
        <div id="automation-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

      <!-- Automation Builder — one page, tabbed like the Website builder. Each tab's
           body keeps its original root id so the existing bucket loaders work unchanged. -->
      <div data-page-content="automation-builder" class="page-content hidden space-y-6">
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

      <!-- CRM — Customers (contacts). Leads / Appointments / Tasks are their own pages. -->
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

      <!-- CRM — Leads (header + content rendered by loadLeadsPage into leads-root) -->
      <div data-page-content="leads" class="page-content hidden space-y-6">
        <div id="leads-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading leads…</div></div>
      </div>

      <!-- CRM — Appointments (the loader renders its own month-calendar header) -->
      <div data-page-content="appointments" class="page-content hidden space-y-6">
        <div id="appointments-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading appointments…</div></div>
      </div>

      <!-- SERVICE — Appointments -->
      <div data-page-content="service-appointments" class="page-content hidden space-y-6">
        <div id="service-appointments-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading service appointments…</div></div>
      </div>

      <!-- SERVICE — Settings -->
      <div data-page-content="service-settings" class="page-content hidden space-y-6">
        <div id="service-settings-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

      <!-- CRM — Tasks -->
      <div data-page-content="tasks" class="page-content hidden space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Tasks</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Your follow-up queue — speed-to-lead calls and automated reach-outs land here.</p>
        </div>
        <div id="tasks-root"><div class="py-10 text-center text-sm text-slate-400 italic">Loading tasks…</div></div>
      </div>

      <!-- ── Trade Appraisal Page ─────────────────────────────────────────── -->
      <div data-page-content="appraisal" class="page-content hidden space-y-6">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Trade Appraisal</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Live retail market value + a suggested cash/trade offer, powered by MarketCheck. Enter a VIN to auto-fill, or type it in.</p>
          </div>
          <button type="button" onclick="resetAppraisal()" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition flex-shrink-0">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            New appraisal
          </button>
        </div>

        <!-- Two-column layout: appraisal flow on the left, Appraisals list pinned right -->
        <div class="grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_360px]">
          <div class="space-y-6 min-w-0">

        <!-- Card: the appraisal form -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <!-- License plate → VIN (optional; shown only when a plate-decode provider is provisioned) -->
          <div id="appr-plate-block" class="hidden">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Look up by plate <span class="normal-case font-normal text-slate-400">(optional — finds the VIN, then fills the fields below)</span></label>
            <div class="flex flex-wrap gap-2">
              <input id="appr-plate" maxlength="10" placeholder="Plate #" class="flex-1 min-w-[120px] uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <select id="appr-plate-country" onchange="apprPlateFillRegions()" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm"><option value="US">US</option><option value="CA">CA</option></select>
              <select id="appr-plate-region" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm w-28"></select>
              <button id="appr-plate-btn" onclick="apprPlateLookup(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Find VIN</button>
            </div>
            <p id="appr-plate-msg" class="hidden text-xs mt-1.5"></p>
          </div>
          <!-- VIN → auto-fill the appraisal fields -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Decode VIN <span class="normal-case font-normal text-slate-400">(optional — only identifies the vehicle &amp; fills the fields below)</span></label>
            <div class="flex gap-2">
              <input id="appr-vin" maxlength="17" placeholder="e.g. 1GNSKBKC5FR123456" class="flex-1 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <button type="button" onclick="openVinScanner('appr-vin', () => document.getElementById('appr-decode').click())" title="Scan VIN barcode" class="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold px-3 py-2 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10"/></svg>Scan</button>
              <button id="appr-decode" class="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Decode</button>
            </div>
            <div id="appr-vin-decoded" class="hidden mt-2 flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg px-3 py-2">
              <svg class="w-4 h-4 flex-shrink-0 mt-px" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              <span><span class="font-bold">Decoded:</span> <span id="appr-vin-decoded-text"></span> — this only identifies the vehicle. Add mileage and click <span class="font-semibold">Appraise</span>; the value comes from live market comps, not the VIN.</span>
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <button type="button" id="appr-view-decode" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 transition">View full VIN decode</button>
              <button type="button" id="appr-oem-sticker" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition">OEM Window Sticker</button>
              <button type="button" id="appr-oem-brochure" class="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition">OEM Brochure</button>
              <span id="appr-oem-msg" class="text-xs text-slate-400"></span>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Year</label><input id="appr-year" inputmode="numeric" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Make</label><input id="appr-make" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Model</label><input id="appr-model" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Trim</label><input id="appr-trim" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Mileage</label><input id="appr-mileage" inputmode="numeric" data-money class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Condition</label><select id="appr-condition" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="good">Good</option><option value="excellent">Excellent</option><option value="fair">Fair</option><option value="rough">Rough</option></select></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Recon ($)</label><input id="appr-recon" inputmode="numeric" data-money value="1,200" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Target gross ($)</label><input id="appr-gross" inputmode="numeric" data-money value="2,500" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Book value ($) <span class="text-slate-400 font-normal">— optional</span></label><input id="appr-book" inputmode="numeric" data-money placeholder="Black Book / guide" title="Black Book or your guide value. If set, the suggested offer is capped so it never exceeds book." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
          </div>
          <div id="appr-defaults-slot"></div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Drivetrain</label><select id="appr-drivetrain" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="">Any</option><option value="FWD">FWD</option><option value="RWD">RWD</option><option value="AWD">AWD</option><option value="4WD">4WD / 4x4</option></select></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Engine</label><input id="appr-engine" placeholder="e.g. 3.5L V6" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Comp radius</label><select id="appr-radius" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="100">100</option><option value="250" selected>250</option><option value="500">500</option><option value="1000">1000</option><option value="0">Nationwide</option></select></div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Accident / history <span class="font-normal text-slate-400">(if known)</span></label>
              <select id="appr-accident" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="none">Clean — none reported</option>
                <option value="minor">Minor (1 claim, cosmetic)</option>
                <option value="moderate">Moderate (panel / multiple)</option>
                <option value="major">Major / structural / airbags</option>
                <option value="branded">Branded (salvage / rebuilt / flood)</option>
              </select>
            </div>
            <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Reported damage ($) <span class="font-normal text-slate-400">optional</span></label><input id="appr-damage" inputmode="numeric" data-money placeholder="e.g. 4200" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
          </div>

          <button id="appr-run" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Appraise</button>
        </div>

        <div id="appr-result"></div>

        <!-- ── Deal Details: customer + disclosure + salesperson ─────────────── -->
        <div class="space-y-6">
          <div class="flex items-center gap-2 pt-2">
            <span class="w-1.5 h-4 rounded-full bg-indigo-500 flex-shrink-0"></span>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Deal Details</h3>
            <span class="text-xs text-slate-500 dark:text-slate-400">— fill in, save, and print a Customer Summary or Disclosure</span>
          </div>

          <!-- Salesperson + Notify Appraiser + disposition -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Salesperson</label>
                <input id="appr-salesperson-input" placeholder="Salesperson name" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <p class="text-[11px] text-slate-400 mt-1">Prefilled from your login — edit if a different rep handled it.</p>
              </div>
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Notify Appraiser <span class="normal-case font-normal text-slate-400">(managers alerted on save)</span></label>
                <div id="appr-notify-list" class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                  <div class="text-xs text-slate-400 italic col-span-full">Loading managers…</div>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Disposition</label>
              <div class="flex gap-2 max-w-md">
                <label class="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-950/40">
                  <input type="radio" name="appr-disposition" value="retail" checked class="accent-indigo-600"> Retail
                </label>
                <label class="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-950/40">
                  <input type="radio" name="appr-disposition" value="wholesale" class="accent-indigo-600"> Wholesale
                </label>
              </div>
            </div>
          </div>

          <!-- Customer Information -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <div class="flex items-center justify-between gap-2 mb-3">
              <h4 class="text-sm font-bold text-slate-900 dark:text-white">Customer Information</h4>
              <span id="appr-cust-linked" class="hidden items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-full px-2 py-0.5">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                <span id="appr-cust-linked-name">Linked</span>
                <button type="button" onclick="apprUnlinkCustomer()" class="ml-1 text-emerald-600/70 hover:text-emerald-600" title="Unlink">✕</button>
              </span>
            </div>
            <!-- Search existing customer or start a new one -->
            <div class="relative mb-3">
              <div class="flex gap-2">
                <input id="appr-cust-search" autocomplete="off" placeholder="Search customers by name, phone, or email…" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
                <button type="button" onclick="apprClearCustomer()" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 rounded-lg whitespace-nowrap">New customer</button>
              </div>
              <div id="appr-cust-results" class="hidden absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"></div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">First name</label><input id="cust-first" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Last name</label><input id="cust-last" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Home phone</label><input id="cust-home-phone" inputmode="tel" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Mobile phone</label><input id="cust-mobile-phone" inputmode="tel" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email</label><input id="cust-email" inputmode="email" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Postal / ZIP</label><input id="cust-postal" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
              <div class="sm:col-span-2"><label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Address</label><input id="cust-address" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            </div>
          </div>

          <!-- Disclosure (collapsible) -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ai-accordion-open">
            <button type="button" onclick="this.closest('.rounded-xl').classList.toggle('ai-accordion-open')" class="w-full px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
              <h4 class="text-sm font-bold text-slate-900 dark:text-white">Trade-In Disclosure</h4>
              <svg class="ai-chevron w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div class="ai-accordion-body p-5 space-y-5">
              <!-- Features -->
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Equipment &amp; features</label>
                <div id="appr-features" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-slate-700 dark:text-slate-200"></div>
              </div>

              <!-- History Q&A -->
              <div class="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4" id="appr-disclosure-qa"></div>

              <div>
                <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Additional notes / disclosures</label>
                <textarea id="disc-notes" rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></textarea>
              </div>
            </div>
          </div>

        </div>
          </div><!-- /left column -->

          <!-- ── Right sidebar: actions + Appraisals list (pinned on this page) ── -->
          <aside class="space-y-3 lg:sticky lg:top-2 self-start">
          <!-- Actions -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2">
            <button id="appr-save-deal" class="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg transition">Save appraisal</button>
            <button id="appr-pdf-summary" class="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 transition">Customer Summary PDF</button>
            <button id="appr-pdf-disclosure" class="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-bold px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 transition">Disclosure PDF</button>
            <div id="appr-deal-msg" class="hidden text-sm rounded-lg px-3 py-2"></div>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-4 rounded-full bg-slate-400 flex-shrink-0"></span>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">Appraisals</h3>
            <span id="appr-list-scope" class="hidden text-[11px] text-slate-400"></span>
          </div>
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input id="appr-list-search" placeholder="Search customer, vehicle, VIN…" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
              <select id="appr-list-salesperson" class="hidden w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="">All salespeople</option></select>
              <select id="appr-list-disposition" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"><option value="">All dispositions</option><option value="retail">Retail</option><option value="wholesale">Wholesale</option></select>
            </div>
            <div id="appr-list" class="divide-y divide-slate-100 dark:divide-slate-800 lg:max-h-[60vh] lg:overflow-y-auto"><div class="text-xs text-slate-400 italic py-4">Loading…</div></div>
          </div>
          </aside>
        </div><!-- /appraisal grid -->
      </div><!-- /appraisal page -->

      <!-- Pipeline retired: Leads + Appointments now live as tabs inside the CRM page. -->

      <!-- Appointment modal (pipeline) -->
      <div id="appt-modal" class="hidden fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-sm p-6">
          <h3 class="text-base font-bold mb-1">Set appointment</h3>
          <p id="appt-veh" class="text-xs text-slate-500 dark:text-slate-400 mb-4"></p>
          <label class="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1.5">Date &amp; time</label>
          <input id="appt-dt" type="datetime-local" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm mb-3">
          <label class="block text-xs uppercase font-bold tracking-wider text-slate-400 mb-1.5">Note (optional)</label>
          <input id="appt-note" placeholder="Buyer name, phone…" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm mb-4">
          <div class="flex justify-end gap-2">
            <button id="appt-cancel" class="text-sm font-bold px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancel</button>
            <button id="appt-save" class="text-sm font-bold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition">Save</button>
          </div>
          <p id="appt-err" class="hidden text-xs text-red-500 mt-2"></p>
        </div>
      </div>

      <!-- ── VIN Sticker & Brochure page ───────────────────────────────────── -->
      <div data-page-content="vin-sticker" class="page-content hidden space-y-6">

        <!-- Page header -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">VIN Sticker &amp; Brochure</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Decode any VIN, generate branded window stickers and 2-page vehicle brochures — cached and shareable.</p>
          </div>
          <div id="vin-sticker-status-badge"></div>
        </div>

        <!-- ── Upsell — non-subscribers ──────────────────────────────────── -->
        <div id="vin-sticker-page-upsell" class="hidden">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">The VIN decoder is part of Inventory Intelligence — $299/month</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Decode VINs, pull factory window stickers, and print branded stickers &amp; brochures (branded/AI versions need AI Boost).</p>
            </div>
            <div class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>VIN decode via NHTSA — year, make, model, trim, engine</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Open recall lookup — shown on every sticker and brochure</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Branded window sticker PDF — your logo, colours, VIN barcode</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>2-page vehicle brochure — hero photo, specs, features, pricing</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Shareable permanent link — text or email to any customer</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Branding settings — logo, primary &amp; accent colours, tagline</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>PDFs cached until sold — auto-deleted on vehicle sale</div>
              <div class="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>One-click apply decoded data back to inventory record</div>
            </div>
            <div class="px-6 py-5 border-t border-slate-200 dark:border-slate-800">
              <button id="vin-sticker-page-upgrade-btn" class="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-lg transition text-sm">Get Inventory Intelligence →</button>
              <span class="ml-4 text-xs text-slate-400">Included with Inventory Intelligence · $299/month</span>
            </div>
          </div>
        </div>

        <!-- ── Active content ─────────────────────────────────────────────── -->
        <div id="vin-sticker-active-content" class="space-y-5">

          <!-- Quick VIN decode tool -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick VIN Decode</h3>
            <div class="flex gap-2">
              <input type="text" id="vin-page-input" maxlength="17" placeholder="Enter 17-character VIN…" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase">
              <button id="vin-page-decode-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition whitespace-nowrap">Decode</button>
            </div>
            <div id="vin-page-loading" class="hidden mt-3 text-sm text-slate-400 italic">Decoding…</div>
            <div id="vin-page-error" class="hidden mt-3 text-sm text-red-500"></div>
            <div id="vin-page-results" class="hidden mt-4 space-y-3">
              <div id="vin-page-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-2"></div>
              <div id="vin-page-recalls" class="hidden"></div>
            </div>
          </div>

          <!-- Inventory list with PDF actions -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div class="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Your Inventory</h3>
              <span class="text-xs text-slate-400">Click Sticker or Brochure to generate a branded PDF</span>
            </div>
            <div class="max-h-[60vh] overflow-y-auto scrollbar-none">
              <div id="vin-sticker-inventory-loading" class="py-10 text-center text-sm text-slate-400 italic">Loading inventory…</div>
              <div id="vin-sticker-inventory-empty" class="hidden py-10 text-center text-sm text-slate-400">No vehicles found. Add inventory first.</div>
              <ul id="vin-sticker-inventory-list" class="hidden divide-y divide-slate-100 dark:divide-slate-800"></ul>
            </div>
          </div>

        </div><!-- /vin-sticker-active-content -->

      </div><!-- /vin-sticker page -->

      </div><!-- /content max-width wrapper -->

    </section>
  </main>

  <!-- ── Reports rail — fixed quick-access to every lot-wide report (II; shown via JS) ── -->
  <div id="report-rail" class="hidden fixed right-0 top-1/2 -translate-y-1/2 z-30 flex-col items-stretch gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-2xl shadow-xl shadow-slate-900/10 py-2.5 pl-2 pr-2.5 max-h-[94vh] overflow-y-auto">
    <div class="flex items-center justify-between gap-1 px-1 pb-1.5">
      <span class="rr-head-label text-[10px] font-black uppercase tracking-widest text-slate-400">Reports</span>
      <button type="button" onclick="toggleReportRail()" title="Expand / minimize reports" aria-label="Expand or minimize reports" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 mx-auto">
        <svg id="rr-chevron" class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
    </div>
    <button type="button" data-report="lot" title="Lot Average Report — your whole lot vs the market" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-violet-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Lot Average</span>
    </button>
    <button type="button" data-report="scan" title="Inventory Scan — live market comps across your whole lot" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Inventory Scan</span>
    </button>
    <button type="button" data-report="snapshot" title="Market Snapshot — supply, price & days-to-sell for a model" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 dark:hover:text-sky-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-sky-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M7 14l4-4 4 4 5-6"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Market Snapshot</span>
    </button>
    <button type="button" data-report="weekly" title="Weekly Lot Health Report — aging, price drift & slow movers (PDF)" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Lot Health</span>
    </button>
    <button type="button" data-report="speed" title="Speed to Lead — how fast leads get answered, per rep" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Speed to Lead</span>
    </button>
    <button type="button" data-report="equity" title="Equity Mining — customers who may be in a positive equity position" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-700 dark:hover:text-teal-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-teal-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Equity Mining</span>
    </button>
    <button type="button" data-report="marketing" title="Marketing ROI — spend vs leads, sales & ROI by channel" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-violet-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9A9.004 9.004 0 0015 3.512V9h5.488z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Marketing ROI</span>
    </button>
    <button type="button" data-report="appointments" title="Appointments & show-rate — booked, shown, no-show by rep" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Appointments</span>
    </button>
    <button type="button" data-report="esign" title="E-signature completion — sent, viewed, signed, time-to-sign" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">E-signatures</span>
    </button>
    <button type="button" data-report="sales" title="Sales — units, revenue, deal-type & finance mix, by rep" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Sales</span>
    </button>
    <button type="button" data-report="fni" title="F&I — penetration, product mix & income, by F&I manager" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-950/40 hover:text-green-700 dark:hover:text-green-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">F&amp;I</span>
    </button>
    <button type="button" data-report="leads" title="Leads &amp; sources — source performance, funnel & speed-to-lead" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:text-sky-700 dark:hover:text-sky-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-sky-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Leads &amp; sources</span>
    </button>
    <button type="button" data-report="reps" title="Rep scorecard — leads, units, revenue, appraisals & activity per rep" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-700 dark:hover:text-amber-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Rep scorecard</span>
    </button>
    <button type="button" data-report="appraisals" title="Appraisals — trades appraised, acquired & spread, by rep" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-violet-700 dark:hover:text-violet-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-violet-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Appraisals</span>
    </button>
    <button type="button" data-report="service" title="Service — appointments, types & sales↔service crossover" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-700 dark:hover:text-teal-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-teal-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Service</span>
    </button>
    <button type="button" data-report="activity" title="Activity — communications by channel & follow-up completion" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-rose-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Activity</span>
    </button>
    <button type="button" data-report="customers" title="Customers — base, sales vs service, consent & top sources" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-700 dark:hover:text-cyan-300 transition">
      <svg class="w-5 h-5 flex-shrink-0 text-cyan-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 00-3-3.87"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">Customers</span>
    </button>
    <button type="button" data-report="all" title="All reports — the full Reports page" class="group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
      <svg class="w-5 h-5 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      <span class="text-xs font-bold whitespace-nowrap">All reports</span>
    </button>
  </div>

  <!-- ── AI Assistant dock — floating "Ask MarketSync" chat (paid; shown via JS) ── -->
  <button id="ai-dock-btn" type="button" aria-label="Ask MarketSync" class="hidden fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm pl-4 pr-5 py-3 rounded-full shadow-lg shadow-indigo-600/40 transition">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h5M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12Z"/></svg>
    <span id="ai-dock-btn-label">Ask MarketSync</span>
  </button>

  <div id="ai-dock-panel" class="hidden fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[390px] max-h-[calc(100dvh-2rem)] h-[560px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      <div class="flex items-center gap-2 min-w-0">
        <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h8M8 14h5M21 12a8.5 8.5 0 0 1-12.4 7.55L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12Z"/></svg>
        </span>
        <div class="min-w-0">
          <div id="ai-dock-title" class="text-sm font-bold text-slate-900 dark:text-white leading-tight">Ask MarketSync</div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Answers from your live lot data</div>
        </div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button id="ai-dock-clear" title="New chat" class="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
        </button>
        <button id="ai-dock-close" title="Close" class="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <div id="ai-dock-messages" class="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-sm"></div>
    <div id="ai-dock-file-status" class="hidden border-t border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-950/30"></div>
    <form id="ai-dock-form" class="border-t border-slate-200 dark:border-slate-800 p-2.5 flex items-end gap-2">
      <input id="ai-dock-file" type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,.md,.csv,.json,.rtf" class="hidden">
      <button id="ai-dock-attach" type="button" title="Attach a commission plan PDF or document" class="flex-shrink-0 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition" aria-label="Attach commission plan document">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m20.5 11.5-8.8 8.8a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>
      </button>
      <textarea id="ai-dock-input" rows="1" placeholder="Ask about your lot, leads, pricing…" class="flex-1 resize-none max-h-28 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
      <button id="ai-dock-send" type="submit" class="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg transition" aria-label="Send">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </form>
  </div>

  <!-- Rep detail modal — top-level so it opens from the Sales Team page too -->
      <div id="rep-detail-modal" class="hidden fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-6 overflow-y-auto">
        <div class="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-6 max-w-3xl w-full mt-12">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h3 class="text-lg font-bold text-slate-900 dark:text-white" id="rep-detail-name">—</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400" id="rep-detail-email">—</p>
              <p class="text-xs text-slate-500 mt-0.5" id="rep-detail-meta">—</p>
            </div>
            <button id="rep-detail-close" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white dark:text-white text-xl px-2">×</button>
          </div>

          <!-- Player card — tier, points & progress (moved here from Insights) -->
          <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 mb-5">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span id="rep-detail-tier" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border"></span>
                <span id="rep-detail-points" class="text-xs text-slate-500 font-mono"></span>
              </div>
              <span id="rep-detail-conv" class="text-xs font-bold text-amber-600 dark:text-amber-400"></span>
            </div>
            <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div id="rep-detail-progress" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700" style="width:0%"></div>
            </div>
            <div id="rep-detail-next" class="text-xs text-slate-500 mt-1"></div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
              <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Total Posts</div>
              <div class="text-2xl font-black text-slate-900 dark:text-white mt-1" id="rep-detail-total">0</div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
              <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Active</div>
              <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1" id="rep-detail-active">0</div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
              <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Sold</div>
              <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1" id="rep-detail-sold">0</div>
            </div>
            <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded">
              <div class="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Removed</div>
              <div class="text-2xl font-black text-slate-500 mt-1" id="rep-detail-deleted">0</div>
            </div>
          </div>

          <h4 class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">Recent Listings</h4>
          <div id="rep-detail-recent" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            <div class="text-xs text-slate-500 italic">Loading...</div>
          </div>
        </div>
      </div>

  <!-- ── Upgrade / Purchase Modal — opened by every locked AI / Intelligence CTA ── -->
  <div id="upgrade-modal" class="hidden fixed inset-0 z-[60] bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg mt-12 mb-10 overflow-hidden shadow-2xl">
      <div class="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
        <div>
          <div id="upgrade-modal-eyebrow" class="text-[11px] font-black uppercase tracking-wider text-violet-500 mb-1">Add-on</div>
          <h3 id="upgrade-modal-title" class="text-xl font-black text-slate-900 dark:text-white">Unlock</h3>
          <p id="upgrade-modal-tagline" class="text-sm text-slate-500 dark:text-slate-400 mt-1"></p>
        </div>
        <button type="button" onclick="closeUpgradeModal()" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none px-1 flex-shrink-0">&times;</button>
      </div>
      <div class="px-6 py-5">
        <div class="flex items-baseline gap-1 mb-4">
          <span id="upgrade-modal-price" class="text-4xl font-black text-slate-900 dark:text-white"></span>
          <span class="text-slate-500 text-sm">/ month</span>
        </div>
        <ul id="upgrade-modal-features" class="space-y-2.5 mb-5"></ul>
        <button id="upgrade-modal-buy" class="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl transition text-sm">Start 30-Day Free Trial</button>
        <p class="text-center text-xs text-slate-400 mt-2">No credit card required · cancel anytime</p>
      </div>
    </div>
  </div>

  <!-- Price Report Modal — top-level so it opens from any page (Inventory, Inventory Intelligence) -->
        <div id="price-report-modal" class="hidden fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
          <div id="price-report-inner" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-4xl mt-10 mb-10 overflow-hidden">

            <!-- Header -->
            <div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1 mb-0.5"><svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg> AI Market Price Report</div>
                <h3 id="pr-title" class="text-lg font-bold text-slate-900 dark:text-white">Price Report</h3>
                <p id="pr-subtitle" class="text-xs text-slate-500 mt-0.5"></p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button id="pr-pdf-btn" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Save as PDF
                </button>
                <button id="pr-close" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none px-1">&times;</button>
              </div>
            </div>

            <!-- Loading -->
            <div id="pr-loading" class="py-16 text-center text-sm text-slate-400 italic">Generating AI market estimate…</div>

            <!-- Content (hidden until loaded) -->
            <div id="pr-content" class="hidden p-6 space-y-6">

              <!-- Action verdict banner: green (priced right) / amber (raise) / red (lower) -->
              <div id="pr-verdict" class="hidden rounded-lg border p-4 flex items-start gap-3">
                <span id="pr-verdict-icon" class="text-xl leading-none mt-0.5"></span>
                <div class="min-w-0">
                  <div id="pr-verdict-headline" class="text-sm font-black"></div>
                  <p id="pr-verdict-reason" class="text-xs mt-1 leading-relaxed"></p>
                </div>
              </div>

              <!-- Summary strip: Your Price / Overall Market Mid / Difference -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Your Price</div>
                  <div id="pr-your-price" class="text-xl font-black text-slate-900 dark:text-white"></div>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Market Average</div>
                  <div id="pr-median" class="text-xl font-black text-slate-900 dark:text-white"></div>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Difference</div>
                  <div id="pr-diff" class="text-xl font-black"></div>
                </div>
              </div>

              <!-- Per-Marketplace Average Cards -->
              <div>
                <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Average Price by Marketplace</div>
                <div id="pr-marketplace-cards" class="grid grid-cols-3 gap-3"></div>
              </div>

              <!-- Chart + Mileage side by side -->
              <div class="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <!-- Chart -->
                <div class="sm:col-span-3">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Marketplace Averages vs Your Price</div>
                  <div class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                    <div class="relative h-52"><canvas id="pr-chart"></canvas></div>
                  </div>
                </div>
                <!-- Mileage Panel -->
                <div class="sm:col-span-2">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Mileage Analysis</div>
                  <div id="pr-mileage-panel" class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 h-full space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-slate-500">Your mileage</span>
                      <span id="pr-your-mileage" class="text-sm font-black text-slate-900 dark:text-white"></span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-slate-500">Market avg</span>
                      <span id="pr-market-mileage" class="text-sm font-bold text-slate-600 dark:text-slate-300"></span>
                    </div>
                    <!-- Mileage range bar -->
                    <div class="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible mt-1">
                      <div id="pr-mileage-marker" class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" title="Your mileage"></div>
                    </div>
                    <div class="flex justify-between text-[9px] text-slate-400"><span>Low</span><span>Market Avg</span><span>High</span></div>
                    <div class="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500">Rating</span>
                        <span id="pr-mileage-rating" class="text-xs font-bold"></span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500">Price impact</span>
                        <span id="pr-mileage-impact" class="text-xs font-bold"></span>
                      </div>
                    </div>
                    <p id="pr-mileage-note" class="text-[10px] text-slate-400 leading-relaxed"></p>
                  </div>
                </div>
              </div>

              <!-- Market Range Bar -->
              <div>
                <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2">Overall Market Range</div>
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 space-y-2">
                  <div class="flex justify-between text-xs text-slate-500 font-mono">
                    <span id="pr-range-low"></span>
                    <span id="pr-range-mid" class="font-bold text-slate-700 dark:text-slate-200"></span>
                    <span id="pr-range-high"></span>
                  </div>
                  <div class="relative h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible">
                    <div id="pr-range-band" class="absolute top-0 h-full rounded-full bg-indigo-200 dark:bg-indigo-900/60"></div>
                    <div id="pr-price-marker" class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white shadow-md" title="Your price"></div>
                  </div>
                  <div class="flex justify-between text-[10px] text-slate-400">
                    <span>Market Low</span>
                    <span>Market High</span>
                  </div>
                </div>
              </div>

              <!-- Market velocity row -->
              <div class="grid grid-cols-2 gap-3" id="pr-velocity-row">
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Price to Market</div>
                  <div id="pr-ptm" class="text-xl font-black text-slate-900 dark:text-white"></div>
                  <div class="text-[10px] text-slate-400 mt-0.5">% of market average</div>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <div class="text-xs uppercase font-bold tracking-wider text-slate-400 mb-1">Est. Days to Sell</div>
                  <div id="pr-days" class="text-xl font-black text-slate-900 dark:text-white"></div>
                  <div class="text-[10px] text-slate-400 mt-0.5">at current price</div>
                </div>
              </div>

              <!-- AI Insight note -->
              <div class="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-lg px-4 py-3">
                <div class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">AI Market Insight</div>
                <p id="pr-ai-note" class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"></p>
                <p class="text-xs text-slate-400 mt-1.5" id="pr-confidence-label"></p>
              </div>

              <!-- Method note -->
              <p class="text-xs text-slate-400 leading-relaxed">AI market analysis based on <span id="pr-match-note"></span>. Used vehicles matched by same year and trim. New vehicles matched by same year. Pricing data is AI-analyzed from marketplace listings — this is not a live data feed. Estimates reflect typical market conditions and are not a guarantee of resale value.</p>
            </div>

          </div>
        </div>

        <!-- Lot Average Report Modal -->
        <div id="lot-report-modal" class="hidden fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl mt-10 mb-10 overflow-hidden">
            <div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-wider text-violet-500 flex items-center gap-1 mb-0.5"><svg viewBox="0 0 24 24" width="14" height="14" class="inline-block flex-shrink-0" aria-hidden="true"><title>AI Boost feature — included in your plan</title><path d="M12 2.5l2.4 6.6 6.6 2.4-6.6 2.4L12 20.5l-2.4-6.6L3 11.5l6.6-2.4z" fill="#c4b5fd" fill-opacity="0.5" stroke="#6d28d9" stroke-width="1.4" stroke-linejoin="round"/></svg> Lot Average Report</div>
                <h3 class="text-lg font-bold text-slate-900 dark:text-white">Your Lot vs the Market</h3>
                <p id="lr-subtitle" class="text-xs text-slate-500 mt-0.5"></p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button id="lr-pdf-btn" class="hidden flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Save as PDF
                </button>
                <button id="lr-close" class="text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none px-1">&times;</button>
              </div>
            </div>

            <div id="lr-loading" class="py-16 text-center text-sm text-slate-400 italic">Building lot report…</div>`);
      if (window.switchPage && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Template Chunk Init]', e); }
})();
