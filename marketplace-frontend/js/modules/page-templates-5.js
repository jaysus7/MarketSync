// ── MarketSync Page Template Submodule (Part 5) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<!-- ── 2. Department Setup Wizard Modal ── -->
  <div id="dept-setup-wizard-modal" class="hidden fixed inset-0 z-[86] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
    <div class="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[90vh]">
      <div class="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
        <div>
          <div class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400" id="dsw-dept-tag">Setup Wizard</div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white" id="dsw-dept-title">Configure Integrations &amp; Store Info</h3>
        </div>
        <button onclick="closeSetupWizardModal()" class="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none">&times;</button>
      </div>

      <div class="p-6 space-y-5 overflow-y-auto flex-1">
        <div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
          <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Cross-Platform Auto-Sync Active:</strong> Information entered here (Legal Name, Address, Phone, Website, CRM Intake Email) automatically syncs across all department wizards and settings. No double-entry!
          </div>
        </div>

        <form id="dsw-form" class="space-y-4">
          <!-- Dynamically populated per department -->
          <div id="dsw-fields-container" class="space-y-4"></div>
        </form>
      </div>

      <div class="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
        <button type="button" onclick="closeSetupWizardModal()" class="text-xs font-bold text-slate-500">Cancel</button>
        <button type="button" onclick="completeDepartmentWizard()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-emerald-500/30 transition flex items-center gap-2">
          <span>Complete Setup &amp; Unlock Badge 🎖️</span>
        </button>
      </div>
    </div>
  </div>

  <!-- ── 3. Dealer Gamification Badge Reveal Modal ── -->
  <div id="dealer-badge-reveal-modal" class="hidden fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-8 text-center shadow-2xl border border-amber-500/40 relative overflow-hidden animate-bounce-short">
      <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 mx-auto flex items-center justify-center text-4xl shadow-xl shadow-amber-500/30 mb-4" id="dbr-badge-icon">
        🛡️
      </div>
      <div class="text-xs font-black uppercase tracking-widest text-amber-500">DEALER Gamification Badge Earned!</div>
      <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-1" id="dbr-badge-title">CRM Commander</h3>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-2" id="dbr-badge-desc">You have successfully Opened and configured the CRM &amp; Customer Management department!</p>

      <div class="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-3">
        <button type="button" onclick="closeBadgeRevealModal()" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
          Claim Badge &amp; Continue
        </button>
      </div>
    </div>
  </div>

  <!-- ── 4. Printable Academy Certificate Modal ── -->
  <div id="academy-certificate-modal" class="hidden fixed inset-0 z-[95] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
    <div class="bg-white dark:bg-slate-950 w-full max-w-4xl rounded-2xl shadow-2xl border border-amber-500/40 overflow-hidden my-auto flex flex-col">
      <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0 print:hidden">
        <div class="text-sm font-bold text-slate-900 dark:text-white">Official Certificate of Completion</div>
        <div class="flex items-center gap-3">
          <!-- LinkedIn Button -->
          <a id="cert-linkedin-btn" href="#" target="_blank" rel="noopener" class="bg-[#0a66c2] hover:bg-[#084e96] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
            Add to LinkedIn
          </a>
          <button type="button" onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-19.126 0C1.081 7.441.313 8.375.313 9.456v6.294c0 1.081.768 2.015 1.837 2.175h1.091"/></svg>
            Print Diploma
          </button>
          <button onclick="closeAcademyCertificateModal()" class="text-slate-400 hover:text-slate-600 text-2xl font-bold leading-none p-1">&times;</button>
        </div>
      </div>

      <!-- Printable Diploma Sheet -->
      <div id="printable-certificate-sheet" class="p-8 sm:p-12 bg-[#fffdfa] text-slate-900 relative overflow-hidden border-8 border-double border-amber-600/40 m-4 rounded-xl shadow-inner">
        <!-- Certificate Watermark Seal -->
        <div class="absolute -right-16 -bottom-16 w-64 h-64 opacity-5 pointer-events-none">
          <svg fill="currentColor" viewBox="0 0 640 512"><path d="M320 32c-8.1 0-16.1 1.4-23.7 4.1L15.8 137.4C6.3 140.9 0 149.9 0 160s6.3 19.1 15.8 22.6l57.9 20.9C57.3 229.3 48 259.8 48 292.6l0 3.4c0 28.6-8.9 57.1-25.1 82.9c-6.8 10.9-8.4 24.4-4.3 36.6c4 12.1 13.2 21.9 25.1 26.6l7 2.8c-3.5 27.6-13.3 51.9-26.5 71.6c-3.3 4.9-3.6 11.2-.8 16.4c2.8 5.2 8.2 8.5 14.2 8.5l72 0c6 0 11.4-3.3 14.2-8.5c2.8-5.2 2.5-11.5-.8-16.4c-13.2-19.7-23-44-26.5-71.6l7-2.8c11.9-4.7 21.1-14.5 25.1-26.6c4.1-12.2 2.5-25.7-4.3-36.6C121 353.1 112 324.6 112 296l0-3.4c0-27 7.6-52.5 20.9-74.4l163.4 59c7.6 2.7 15.6 4.1 23.7 4.1s16.1-1.4 23.7-4.1L624.2 182.6c9.5-3.5 15.8-12.5 15.8-22.6s-6.3-19.1-15.8-22.6L343.7 36.1C336.1 33.4 328.1 32 320 32z"/></svg>
        </div>

        <div class="text-center space-y-4">
          <div class="text-xs font-black uppercase tracking-widest text-amber-700">MarketSync Academy · Official Certification</div>
          <h1 class="text-3xl sm:text-4xl font-serif font-bold text-slate-900 tracking-wide" style="font-family: Georgia, serif;">Certificate of Mastery</h1>
          <p class="text-xs text-slate-500 uppercase tracking-widest">This certifies that</p>
          <div class="text-2xl sm:text-3xl font-black text-indigo-900 border-b border-slate-300 pb-2 max-w-lg mx-auto" id="cert-student-name">Alex Johnson</div>
          <p class="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">has successfully completed all required modules, practical assignments, and exams for</p>
          <div class="text-xl font-bold text-amber-800 font-serif my-2" id="cert-course-name">Certified Email Campaign Specialist</div>
          <p class="text-xs text-slate-500">Issued by MarketSync Technologies Inc.</p>

          <div class="pt-8 flex items-center justify-between text-left text-xs text-slate-600 max-w-xl mx-auto">
            <div>
              <div class="font-bold text-slate-900" id="cert-date font-mono">August 5, 2026</div>
              <div class="text-[10px] text-slate-400">Issue Date</div>
            </div>
            <div class="text-center">
              <div class="w-12 h-12 rounded-full border-2 border-amber-500 mx-auto flex items-center justify-center text-amber-600 font-bold text-[10px]">VERIFIED</div>
              <div class="text-[9px] font-mono text-slate-400 mt-1" id="cert-id-code">MS-CERT-2026-98421</div>
            </div>
            <div class="text-right">
              <div class="font-serif italic font-bold text-indigo-900 text-sm" style="font-family: Georgia, serif;">MarketSync Academic Board</div>
              <div class="text-[10px] text-slate-400">Official Signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MarketSync Modular Sub-Files -->
  <script src="js/modules/core-init.js?v=20260806_v2"></script>
  <script src="js/modules/timeclock-hr.js?v=20260806_v2"></script>
  <script src="js/modules/compliance-academy.js?v=20260806_v2"></script>
  <script src="js/modules/commission-engine.js?v=20260806_v2"></script>
  <script src="js/modules/crm-pipeline.js?v=20260806_v2"></script>
  <script src="dashboard.js?v=20260806_v2"></script>
  <!-- Google Translate widget (per-rep dashboard translation) -->
  <script>
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false }, 'google_translate_element');
    };
  </script>
  <script src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit" async></script>
  <script src="tour.js?v=20260805_hr30d_v3"></script>
  <script src="table-sort.js?v=20260706a"></script>
</body>
</html><div data-page-content="crm" class="page-content hidden space-y-6">
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

<div data-page-content="tasks" class="page-content hidden space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Tasks</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Your follow-up queue — speed-to-lead calls and automated reach-outs land here.</p>
        </div>
        <div id="tasks-root"><div class="py-10 text-center text-sm text-slate-400 italic">Loading tasks…</div></div>
      </div>

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

<div data-page-content="desk" class="page-content hidden">
        <div id="desk-root"></div>
      </div>

<div data-page-content="service-ros" class="page-content hidden space-y-6">
        <div id="service-ros-root"></div>
      </div>

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

<div data-page-content="service-parts" class="page-content hidden space-y-6">
        <div id="service-parts-root"></div>
      </div>

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

<div data-page-content="accounting" class="page-content hidden space-y-6">
        <div id="accounting-root"></div>
      </div>

      <!-- Affiliates admin — MarketSync owner manages affiliates + payouts. -->
      <div data-page-content="affiliates-admin" class="page-content hidden space-y-6">
        <div id="affadmin-root"></div>
      </div>

<div data-page-content="people-compliance" class="page-content hidden space-y-6">
        <div id="people-compliance-root"></div>
      </div>

<div data-page-content="shift-clock" class="page-content hidden space-y-6"><h1 class="text-xl font-bold capitalize">shift clock</h1></div>

<div data-page-content="reports" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Reports</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Every number in the store — pick a report, or build your own.</p>
        </div>

        <!-- Report category picker — rendered by renderReportTabs() -->
        <div id="reports-tabs" class="flex flex-wrap gap-1.5"></div>

        <!-- Overview: the original always-on report sections -->
        <div id="reports-overview" class="space-y-10">
          <!-- Custom report builder — pick who/what with dropdowns -->
          <div id="report-builder"></div>
          <!-- Executive ROI dashboard (managers) — injected by loadExecutiveRoi() -->
          <div id="exec-roi"></div>
          <!-- Inventory mix & aging report (managers) — injected by loadInventoryMix() -->
          <div id="inv-mix"></div>
          <!-- Sales analysis report (managers) — injected by loadSalesAnalysis() -->
          <div id="sales-analysis"></div>
          <!-- Marketing ROI report (managers) — injected by loadMarketingRoi() -->
          <div id="marketing-roi"></div>
        </div>

        <!-- Deep reports (sales, F&I, leads, reps, appraisals, service, activity, customers) -->
        <div id="reports-dynamic" class="hidden"></div>
      </div>

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

<div data-page-content="commissions" class="page-content hidden space-y-6">
        <div id="commissions-root"></div>
      </div>

      <!-- Task board — shared operational tasks (detail, fuel, plates, transport, deliver…). -->
      <div data-page-content="taskboard" class="page-content hidden space-y-6">
        <div id="taskboard-root"></div>
      </div>

      <!-- Operations — workflow exceptions dashboard + entity timeline lookup (managers). -->
      <div data-page-content="command" class="page-content hidden space-y-6">
        <div id="command-root"></div>
      </div>

<div data-page-content="taskboard" class="page-content hidden space-y-6">
        <div id="taskboard-root"></div>
      </div>

      <!-- Operations — workflow exceptions dashboard + entity timeline lookup (managers). -->
      <div data-page-content="command" class="page-content hidden space-y-6">
        <div id="command-root"></div>
      </div>

<div data-page-content="delivery" class="page-content hidden space-y-6">
        <div id="delivery-root"></div>
      </div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 5]', e); }
})();
