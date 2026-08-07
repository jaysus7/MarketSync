// ── MarketSync Page Template Submodule (Part 4) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<div class="overflow-x-auto">
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

<div data-page-content="market" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Market &amp; Competitors</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Live market snapshots and nearby-lot pricing — part of Inventory Intelligence.</p>
        </div>
        <div id="market-upsell" class="hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-sm text-slate-500 dark:text-slate-400">Market &amp; Competitors is part of <span class="font-bold text-slate-700 dark:text-slate-200">Inventory Intelligence</span>. Activate it to track nearby lots and pull live market snapshots.</div>
        <div id="market-content" class="space-y-6">

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

<div data-page-content="website" class="page-content hidden space-y-6">
        <div id="website-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

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
      </div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 4]', e); }
})();
