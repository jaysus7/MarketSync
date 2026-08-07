// ── MarketSync Page Template Submodule (Part 5) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<div data-page-content="service-settings" class="page-content hidden hidden space-y-6">
        <div id="service-settings-root"><div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div></div>
      </div>

<div data-page-content="tasks" class="page-content hidden space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Tasks</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Your follow-up queue — speed-to-lead calls and automated reach-outs land here.</p>
        </div>
        <div id="tasks-root"><div class="py-10 text-center text-sm text-slate-400 italic">Loading tasks…</div></div>
      </div>

<div data-page-content="appraisal" class="page-content hidden hidden space-y-6">
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
      </div>

<div data-page-content="vin-sticker" class="page-content hidden hidden space-y-6">

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

</div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 5]', e); }
})();
