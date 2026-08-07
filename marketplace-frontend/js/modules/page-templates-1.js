// ── MarketSync Page Template Submodule (Part 1) ─────────────────────────────
(function injectPageTemplates() {
  try {
    var host = document.getElementById('pages-container') || document.querySelector('main section:nth-child(2) > div');
    if (host) {
      host.insertAdjacentHTML('beforeend', `<div data-page-content="profile" class="page-content hidden space-y-6">
        <div>
          <h1 class="text-2xl font-black text-slate-900 dark:text-white">Settings</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Your team, account, branding, billing and add-ons — all in one place.</p>
        </div>
        <!-- Settings sub-nav — each tab reveals only its own section(s). -->
        <div id="settings-tabs" class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button data-stab="account" onclick="settingsTab('account')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">My Account</button>
          <button data-stab="admin" data-admin-only onclick="settingsTab('admin')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Administration</button>
          <button data-stab="sales" data-admin-only onclick="settingsTab('sales')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Sales</button>
          <button data-stab="marketing" data-admin-only onclick="settingsTab('marketing')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Marketing</button>
          <button data-stab="inventory" data-admin-only onclick="settingsTab('inventory')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Inventory</button>
          <button data-stab="service" data-admin-only onclick="settingsTab('service')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Service</button>
          <button data-stab="accounting" data-admin-only onclick="settingsTab('accounting')" class="stab-btn whitespace-nowrap px-3.5 py-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">Accounting</button>
        </div>

<!-- These tab sections flow into two columns on wide screens (settings-cols);
             JS adds .is-multi only when the active tab has more than one card. -->
        <div id="settings-panel-extra" class="settings-cols gap-5 [column-fill:_balance]">
        <!-- Integrations Hub — connect MarketSync to the rest of the dealership stack.
             Webhooks are our own outbound "glue" (live today); the F&I / accounting
             rails show as coming-soon until we're certified with the partner. -->
        <div id="integrations-section" data-admin-only data-full-width="true" class="stab-hide space-y-4 break-inside-avoid mb-5">
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Integrations</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Connect MarketSync to the tools you already use. Send events out to Zapier, Make, or your own app — and plug in the F&amp;I and accounting rails as they come online.</p>
          </div>
          <div id="integrations-list"><div class="py-10 text-center text-sm text-slate-400 italic">Loading…</div></div>
        </div>

<!-- Team — Sales/Management are login users; Service/Admin/Cleanup/Lot are label rosters -->
        <div id="settings-team" data-stab-panel="team" data-full-width="true" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 break-inside-avoid mb-5">
          <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">Team</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pick a team to see its members. Sales &amp; Management sign in; the rest are roster labels.</p>
            </div>
            <select id="team-picker" onchange="loadSettingsTeam(this.value)" class="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-semibold">
              <option value="sales">Sales team</option>
              <option value="management">Management team</option>
              <option value="service">Service team</option>
              <option value="admin">Admin team</option>
              <option value="cleanup">Cleanup team</option>
              <option value="lot">Lot team</option>
            </select>
          </div>
          <div id="team-roster"><div class="py-10 text-center text-sm text-slate-400 italic">Loading…</div></div>
        </div>

<!-- CRM / DMS connection (ADF lead delivery) — moved here from the CRM Leads tab -->
        <div id="crm-dms-card" data-admin-only class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">CRM / DMS connection</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Your CRM/DMS lead-intake address (VinSolutions, DealerSocket, Elead, PBS, etc.). Leads captured in MarketSync are emailed here as ADF XML and auto-imported. Not sure? Ask your CRM admin for your "ADF" or "email lead" address.</p>
          <div class="flex gap-2">
            <input id="crm-adf-email" type="email" placeholder="leads@yourcrm-intake.com" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
            <button id="crm-adf-save" onclick="saveCrmAdfEmail(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save</button>
          </div>
          <p id="crm-adf-msg" class="hidden text-xs mt-2"></p>
        </div>
        <!-- Feature toggles — hide paid features this dealer doesn't use -->
        <div id="dealer-features-card" data-admin-only class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Features</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Turn features on or off for your whole store. Switching one off hides it from the menu for everyone; you can turn it back on any time.</p>
          <div id="dealer-features-list" class="space-y-2"><div class="text-sm text-slate-400 italic py-3">Loading…</div></div>
        </div>
        <!-- Dealer details for documents — legal identifiers printed on the bill of sale -->
        <div id="dealer-docs-card" data-admin-only class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Dealer details for documents</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Your legal / trade name, address and registration numbers — these print on every estimate and bill of sale.</p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="col-span-2 sm:col-span-3"><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Legal / trade name</label><input id="dd-legal_name" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div class="col-span-2 sm:col-span-3"><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Street address</label><input id="dd-street_address" placeholder="915 Niagara St" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Phone</label><input id="dd-phone" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">Fax</label><input id="dd-fax" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">HST #</label><input id="dd-hst_number" placeholder="R715748679" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
            <div><label class="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">OMVIC / dealer reg #</label><input id="dd-omvic_reg" placeholder="5686852" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
          </div>
          <div class="mt-3"><button id="dealer-docs-save" onclick="saveDealerDocs(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save dealer details</button></div>
        </div>
        <!-- Deal Desk: management-controlled fee schedule (prefilled + lockable) -->
        <div id="desk-fees-card" data-admin-only class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Deal Desk — fees</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Set the fees that prefill on every deal. <b>Locked</b> fees can't be changed on the desk (consistent across all deals); unlocked ones can be adjusted per-deal. Mark each taxable or not.</p>
          <div id="desk-fees-list" class="space-y-2"><div class="text-sm text-slate-400 italic py-3">Loading…</div></div>
          <div class="flex items-center justify-between mt-3">
            <button onclick="deskFeeAddRow()" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">＋ Add a fee</button>
            <button id="desk-fees-save" onclick="saveDeskFees(this)" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Save fees</button>
          </div>
        </div>
        <!-- Language: per-rep dashboard translation (Google Translate) + AI listing-copy language -->
        <div id="settings-language-card" data-full-width="true" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 notranslate break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Language</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Translate your dashboard into any language — it's saved to your browser, just for you. Your choice also becomes the language for your AI-written Facebook listings.</p>
          <div id="google_translate_element"></div>
        </div>
        <!-- Text messaging — provision a dedicated SMS number under MarketSync, no
             Twilio account needed. Powers automated follow-ups + AI autoresponder texts. -->
        <div id="settings-texting-card" data-admin-only class="stab-hide bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Text messaging (SMS)</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Get your own texting number to send automated follow-ups and AI replies — carrier-compliant, no Twilio account to set up.</p>
          <div id="texting-root"><div class="text-sm text-slate-400 italic py-3">Loading…</div></div>
        </div>
        <!-- Service department settings live on their own page — linked here so the
             Service section exists under Settings without duplicating those controls. -->
        <div id="settings-service-card" data-admin-only class="stab-hide bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Service &amp; Parts</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Labour rate, tax, shop supplies, parts markup and RO prefix.</p>
          <button onclick="switchPage('service-settings')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Open Service settings →</button>
        </div>
        <!-- Accounting department settings live on the Accounting page. -->
        <div id="settings-accounting-card" data-admin-only class="stab-hide bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 break-inside-avoid mb-5">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Accounting</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Chart of accounts, auto-posting rules and cost tracking.</p>
          <button onclick="switchPage('accounting')" class="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Open Accounting →</button>
        </div>
        </div><!-- /#settings-panel-extra -->
      </div>

<div data-page-content="commissions" class="page-content hidden hidden space-y-6">
        <div id="commissions-root"></div>
      </div>

<div data-page-content="taskboard" class="page-content hidden hidden space-y-6">
        <div id="taskboard-root"></div>
      </div>

<div data-page-content="command" class="page-content hidden space-y-6">
        <div id="command-root"></div>
      </div>

<div data-page-content="solo-home" class="page-content hidden hidden space-y-6">
        <div id="solo-home-root"></div>
      </div>

<div data-page-content="ai-home" class="page-content hidden space-y-6">
        <div id="ai-home-root"></div>
      </div>

<div data-page-content="operations" class="page-content hidden hidden space-y-6">
        <div id="operations-root"></div>
      </div>

<div data-page-content="delivery" class="page-content hidden space-y-6">
        <div id="delivery-root"></div>
      </div>

<div data-page-content="service-ros" class="page-content hidden hidden space-y-6">
        <div id="service-ros-root"></div>
      </div>

<div data-page-content="service-parts" class="page-content hidden hidden space-y-6">
        <div id="service-parts-root"></div>
      </div>

<div data-page-content="saas-command" class="page-content hidden hidden space-y-6">
        <div id="saas-command-root"></div>
      </div>

<div data-page-content="saas-customers" class="page-content hidden hidden space-y-6">
        <div id="saas-customers-root"></div>
      </div>

<div data-page-content="saas-followups" class="page-content hidden hidden space-y-6">
        <div id="saas-followups-root"></div>
      </div>

<div data-page-content="saas-funnel" class="page-content hidden hidden space-y-6">
        <div id="saas-funnel-root"></div>
      </div>

<div data-page-content="saas-automation" class="page-content hidden hidden space-y-6">
        <div id="saas-automation-root"></div>
      </div>

<div data-page-content="email-marketing" class="page-content hidden hidden space-y-6">
        <div id="dealer-email-root"></div>
      </div>

<div data-page-content="saas-employees" class="page-content hidden hidden space-y-6">
        <div id="saas-employees-root"></div>
      </div>

<div data-page-content="saas-accounting" class="page-content hidden hidden space-y-6">
        <div id="saas-accounting-root"></div>
      </div>

<div data-page-content="owner-users" class="page-content hidden hidden space-y-6">
        <div id="owner-users-root"></div>
      </div>

<div data-page-content="people-compliance" class="page-content hidden hidden space-y-6">
        <div id="people-compliance-root"></div>
      </div>

<div data-page-content="config" class="page-content hidden space-y-6">
        <div id="config-root"></div>
      </div>

<div data-page-content="api-keys" class="page-content hidden space-y-6">
        <div id="api-keys-root"></div>
      </div>

<div data-page-content="ai-inbox" class="page-content hidden space-y-6">
        <div id="ai-inbox-root"></div>
      </div>

<div data-page-content="accounting" class="page-content hidden hidden space-y-6">
        <div id="accounting-root"></div>
      </div>

<div data-page-content="affiliates-admin" class="page-content hidden hidden space-y-6">
        <div id="affadmin-root"></div>
      </div>

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
        </div>`);
      if (typeof window.switchPage === 'function' && window.activePageId) {
        try { window.switchPage(window.activePageId); } catch(e) {}
      }
    }
  } catch (e) { console.error('[Page Templates Init: Part 1]', e); }
})();
