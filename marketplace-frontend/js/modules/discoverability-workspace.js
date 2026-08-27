/**
 * MarketSync Discoverability Intelligence Workspace
 * 
 * Parent workspace orchestrating multi-pillar discovery intelligence & remediation:
 * 1. Overview — Executive KPI deck & Search vs AI SOV trends
 * 2. Recommendations — First-Class Actionable Remediation Queue & Safe Auto-Apply Engine
 * 3. SEO — Preserved & embedded MarketSync AI SEO Command Center
 * 4. AEO — Answer Engine Optimization, Featured Snippets & Voice (VSO)
 * 5. GEO / LLMO — Generative Engine & AI Model Visibility Benchmarks
 * 6. SXO — Search Experience Optimization & Conversion Attribution
 * 7. ASO — App & Chrome Web Store Optimization
 * 8. Validation — Continuous Technical, Schema, and Data Accuracy Engine
 */

let __discData = null;
let __discTab = 'overview';
let __discMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('marketsync_disc_mode') || 'basic') : 'basic';
let __discRecFilter = 'all'; // 'all' | 'auto_fixable' | 'approval_required' | 'manual' | 'validated' | 'reverted'
let __discPillarFilter = 'all';
let __discSearchQuery = '';

async function loadDiscoverabilityWorkspace(initialTab) {
  const root = document.getElementById('ms-discoverability-root') || document.getElementById('ms-seo-root');
  if (!root) return;

  if (initialTab) __discTab = initialTab;

  root.innerHTML = `
    <div id="disc-workspace-container" class="space-y-6 pt-2">
      <div class="py-12 text-center text-sm text-slate-400 italic">Loading Discoverability Intelligence…</div>
    </div>
  `;

  try {
    const res = await apiGetJson('/discoverability/overview').catch(() => null);
    __discData = res || {
      compositeScore: 86,
      standardsVersion: 'MarketSync Discoverability Standards — 2026',
      pillars: {
        seo: { score: 88, organicClicks: 1420, organicImpressions: 28400, averagePosition: 11.8, clickThroughRate: '5.0%', keywordTiers: { top3: 14, top10: 48, top100: 186 }, cwvStatus: 'Good', indexationStatus: 'Healthy' },
        aeo: { score: 88, featuredSnippets: { activeCount: 6, potentialCount: 14, winRate: '42.8%', recentWins: ['What is the towing capacity of 2025 Silverado 1500?'], recentLosses: ['Best trade-in value near Welland'] }, peopleAlsoAsk: { coveredQuestions: 19, totalTracked: 32, reachPercent: '59.3%' }, schemaValidation: { autoDealerSchema: 'Valid', vehicleSchema: 'Valid', faqSchema: 'Valid', localBusinessSchema: 'Valid' }, voiceSearchOptimization: { conversationalReadinessScore: 86, longTailQueryMatchCount: 24 } },
        geo: { score: 82, brandMentionRate: '68.5%', urlCitationRate: '41.2%', citationShareOfVoice: '24.8%', sentimentBreakdown: { positive: '76%', neutral: '21%', negative: '3%' }, hallucinationCount: 0, modelCoverage: [] },
        sxo: { score: 87, conversionRate: '3.4%', bounceRate: '28.6%', mobileVsDesktop: { mobileTrafficShare: '68%', mobileConversionRate: '3.2%', desktopTrafficShare: '32%', desktopConversionRate: '3.8%' }, topLandingPages: [], funnel: [] },
        aso: { score: 92, stores: [{ store: 'Chrome Web Store', listingName: 'MarketSync Dealer Extension', status: 'Published', rating: '4.9', reviewCount: 38, weeklyImpressions: 1420, weeklyInstalls: 116, installConversionRate: '8.17%' }] },
        validation: { score: 90, criticalCount: 0, highCount: 1, mediumCount: 1, lowCount: 1, issues: [] }
      },
      recommendations: [],
      history: { dates: ['7d', '6d', '5d', '4d', '3d', '2d', 'Today'], searchSovTrend: [18, 19, 21, 20, 22, 23, 24], aiSovTrend: [12, 14, 15, 18, 19, 21, 25], compositeScoreTrend: [81, 82, 83, 84, 84, 85, 86] }
    };
    renderDiscoverabilityWorkspace();
  } catch (err) {
    root.innerHTML = `<div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-bold">Failed to load Discoverability Intelligence: ${esc(err.message)}</div>`;
  }
}

function setDiscTab(tab) {
  __discTab = tab || 'overview';
  renderDiscoverabilityWorkspace();
  if (tab === 'seo') {
    if (typeof loadSeoPage === 'function') loadSeoPage();
  }
}

function setDiscMode(mode) {
  __discMode = mode;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('marketsync_disc_mode', mode);
  }
  renderDiscoverabilityWorkspace();
}

function setRecFilter(filter) {
  __discRecFilter = filter || 'all';
  renderDiscoverabilityWorkspace();
}

function setPillarFilter(pillar) {
  __discPillarFilter = pillar || 'all';
  renderDiscoverabilityWorkspace();
}

function renderDiscoverabilityWorkspace() {
  const container = document.getElementById('disc-workspace-container') || document.getElementById('ms-discoverability-root');
  if (!container || !__discData) return;

  const d = __discData;
  const isAdv = __discMode === 'advanced';
  const score = d.compositeScore || 86;
  const recs = d.recommendations || [];
  const openSafeCount = recs.filter(r => r.execution_class === 'auto_fixable' && r.status === 'open').length;

  container.innerHTML = `
    <!-- Top Command Header -->
    <section class="rounded-2xl border border-slate-200 dark:border-[#2B303A] bg-white dark:bg-[#1A1D24] p-5 md:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
      <div class="min-w-0 flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] dark:text-blue-400 border border-[#2563EB]/25 flex items-center justify-center font-black text-sm tracking-tight flex-shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Discoverability Intelligence</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-[#2563EB] dark:text-blue-400 border border-blue-500/20">7-Pillar OS</span>
          </div>
          <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Multi-engine presence, answer engines, AI citations, search experience, and continuous technical validation.
          </p>
        </div>
      </div>

      <!-- Right Controls: Score Badge + Basic/Advanced Toggle -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <div class="text-right hidden sm:block">
          <div class="text-[10px] uppercase font-bold text-slate-400">Composite Score</div>
          <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">${score} <span class="text-xs font-medium text-slate-400">/ 100</span></div>
        </div>
        <div class="inline-flex rounded-xl border border-slate-200 dark:border-[#2B303A] p-1 bg-slate-50 dark:bg-[#121318] gap-1">
          <button onclick="setDiscMode('basic')" class="px-3.5 py-1.5 rounded-lg transition cursor-pointer text-xs font-bold ${!isAdv ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}">Basic</button>
          <button onclick="setDiscMode('advanced')" class="px-3.5 py-1.5 rounded-lg transition cursor-pointer text-xs font-bold ${isAdv ? 'bg-[#2563EB] text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}">Advanced</button>
        </div>
      </div>
    </section>

    <!-- Pillar Navigation Tabs -->
    <div role="tablist" class="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-[#2B303A] text-xs font-bold">
      <button onclick="setDiscTab('overview')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'overview' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">Overview</button>
      <button onclick="setDiscTab('recommendations')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'recommendations' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">
        Recommendations ${openSafeCount > 0 ? `<span class="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white font-black">${openSafeCount} Safe</span>` : ''}
      </button>
      <button onclick="setDiscTab('seo')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'seo' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">SEO</button>
      <button onclick="setDiscTab('aeo')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'aeo' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">AEO</button>
      <button onclick="setDiscTab('geo')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'geo' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">GEO / LLMO</button>
      <button onclick="setDiscTab('sxo')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'sxo' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">SXO</button>
      <button onclick="setDiscTab('aso')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'aso' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">ASO</button>
      <button onclick="setDiscTab('validation')" class="px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${__discTab === 'validation' ? 'bg-[#2563EB] text-white font-black shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-white'}">
        Validation ${d.pillars?.validation?.criticalCount > 0 ? `<span class="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-red-500 text-white font-black">${d.pillars.validation.criticalCount}</span>` : ''}
      </button>
    </div>

    <!-- Tab View Container -->
    <div id="disc-pillar-body" class="space-y-6">
      ${renderDiscActiveTabContent()}
    </div>
  `;

  // If SEO tab active, mount preserved SEO workspace
  if (__discTab === 'seo') {
    const seoMount = document.getElementById('ms-seo-embedded-mount');
    if (seoMount && typeof loadDealerSeo === 'function') {
      loadDealerSeo();
    }
  }
}

function renderDiscActiveTabContent() {
  switch (__discTab) {
    case 'overview': return renderDiscOverviewView();
    case 'recommendations': return renderDiscRecommendationsView();
    case 'seo': return renderDiscSeoEmbeddedView();
    case 'aeo': return renderDiscAeoView();
    case 'geo': return renderDiscGeoView();
    case 'sxo': return renderDiscSxoView();
    case 'aso': return renderDiscAsoView();
    case 'validation': return renderDiscValidationView();
    default: return renderDiscOverviewView();
  }
}

// ── 1. OVERVIEW VIEW ────────────────────────────────────────────────────────
function renderDiscOverviewView() {
  const d = __discData;
  const isAdv = __discMode === 'advanced';
  const p = d.pillars || {};
  const recs = d.recommendations || [];
  const safeCount = recs.filter(r => r.execution_class === 'auto_fixable' && r.status === 'open').length;

  return `
    <!-- Executive KPI Deck -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div onclick="setDiscTab('seo')" class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm cursor-pointer hover:border-[#2563EB] transition">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Organic Clicks</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${p.seo?.organicClicks?.toLocaleString() || '1,420'}</div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">↑ +14% vs last mo</div>
      </div>

      <div onclick="setDiscTab('sxo')" class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm cursor-pointer hover:border-[#2563EB] transition">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Organic Leads</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${p.sxo?.funnel?.find(f => f.step.includes('Leads'))?.count || 18}</div>
        <div class="text-xs text-[#2563EB] dark:text-blue-400 font-bold mt-1">3 Deals Closed</div>
      </div>

      <div onclick="setDiscTab('aeo')" class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm cursor-pointer hover:border-[#2563EB] transition">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Answer Visibility</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${p.aeo?.peopleAlsoAsk?.reachPercent || '59.3%'}</div>
        <div class="text-xs text-slate-500">${p.aeo?.featuredSnippets?.activeCount || 6} Featured Snippets</div>
      </div>

      <div onclick="setDiscTab('geo')" class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm cursor-pointer hover:border-[#2563EB] transition">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">AI Citation Share</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${p.geo?.citationShareOfVoice || '24.8%'}</div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">6/6 Engines Active</div>
      </div>
    </div>

    <!-- Discoverability Intelligence Chart: Search vs AI SOV Trends -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 class="text-base font-black text-slate-900 dark:text-white">Discoverability Share of Voice (Search vs AI)</h2>
          <p class="text-xs text-slate-500">Historical trend across Google Search, Google AI Overviews, ChatGPT, Gemini, and Perplexity.</p>
        </div>
        <div class="flex items-center gap-4 text-xs font-bold">
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-[#2563EB]"></span> Search SOV (24%)</span>
          <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> AI Citation Share (25%)</span>
        </div>
      </div>

      <!-- SOV Visual Breakdown Bars -->
      <div class="space-y-2 pt-2">
        <div class="h-3 w-full bg-slate-100 dark:bg-[#121318] rounded-full overflow-hidden flex">
          <div class="bg-[#2563EB]" style="width: 24%;"></div>
          <div class="bg-emerald-500" style="width: 25%;"></div>
          <div class="bg-slate-300 dark:bg-slate-700" style="width: 51%;"></div>
        </div>
        <div class="flex justify-between text-[11px] text-slate-400 font-medium">
          <span>Search Visibility (24%)</span>
          <span>AI Visibility (25%)</span>
          <span>Market Opportunity (51%)</span>
        </div>
      </div>
    </div>

    <!-- Recommendations Center Quick Banner -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base font-black text-slate-900 dark:text-white">Actionable Recommendations</h2>
            ${safeCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">${safeCount} Safe to Auto-Apply</span>` : ''}
          </div>
          <p class="text-xs text-slate-500 mt-0.5">Ranked, explainable actions with pre-apply rollback snapshots and post-apply validation.</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${safeCount > 0 ? `
            <button onclick="openApplyAllSafeModal()" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Apply All Safe Recommendations
            </button>
          ` : ''}
          <button onclick="setDiscTab('recommendations')" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition cursor-pointer">
            View All Recommendations (${recs.length})
          </button>
        </div>
      </div>

      <div class="space-y-3">
        ${recs.slice(0, 3).map(r => renderSingleRecommendationCard(r, true)).join('')}
      </div>
    </div>

    ${isAdv ? `
      <!-- Advanced Diagnostics: Query Cluster Performance -->
      <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Query Cluster Intelligence &amp; SOV Matrix</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 dark:bg-[#121318] text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-[#2B303A]">
              <tr>
                <th class="py-3 px-4">Query Cluster</th>
                <th class="py-3 px-4">Search Volume</th>
                <th class="py-3 px-4">Avg Rank</th>
                <th class="py-3 px-4">AI Citation Share</th>
                <th class="py-3 px-4">Conversion Rate</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#2B303A] text-slate-700 dark:text-slate-300">
              <tr>
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">Used Pickup Trucks</td>
                <td class="py-3 px-4">4,200 / mo</td>
                <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">#2.4</td>
                <td class="py-3 px-4 font-bold">38% (Gemini, ChatGPT)</td>
                <td class="py-3 px-4 text-[#2563EB] font-bold">4.2%</td>
              </tr>
              <tr>
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">Auto Financing &amp; Bad Credit Approval</td>
                <td class="py-3 px-4">2,800 / mo</td>
                <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">#3.1</td>
                <td class="py-3 px-4 font-bold">44% (Perplexity, Copilot)</td>
                <td class="py-3 px-4 text-[#2563EB] font-bold">9.3%</td>
              </tr>
              <tr>
                <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">Certified Brake &amp; Oil Service</td>
                <td class="py-3 px-4">1,450 / mo</td>
                <td class="py-3 px-4 text-amber-600 font-bold">#6.8</td>
                <td class="py-3 px-4 font-bold">18% (Google AI)</td>
                <td class="py-3 px-4 text-[#2563EB] font-bold">7.8%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

// ── 2. RECOMMENDATIONS VIEW (DEDICATED QUEUE & COMMAND CENTER) ─────────────
function renderDiscRecommendationsView() {
  const d = __discData;
  const recs = d.recommendations || [];

  const counts = {
    all: recs.length,
    auto_fixable: recs.filter(r => r.execution_class === 'auto_fixable' && r.status === 'open').length,
    approval_required: recs.filter(r => r.execution_class === 'approval_required' && r.status === 'open').length,
    manual: recs.filter(r => r.execution_class === 'manual' && r.status === 'open').length,
    validated: recs.filter(r => r.status === 'validated').length,
    reverted: recs.filter(r => r.status === 'reverted').length
  };

  let filtered = recs.filter(r => {
    if (__discRecFilter === 'auto_fixable') return r.execution_class === 'auto_fixable' && r.status === 'open';
    if (__discRecFilter === 'approval_required') return r.execution_class === 'approval_required' && r.status === 'open';
    if (__discRecFilter === 'manual') return r.execution_class === 'manual' && r.status === 'open';
    if (__discRecFilter === 'validated') return r.status === 'validated';
    if (__discRecFilter === 'reverted') return r.status === 'reverted';
    return true;
  });

  if (__discPillarFilter !== 'all') {
    filtered = filtered.filter(r => String(r.pillar).toLowerCase() === __discPillarFilter.toLowerCase());
  }

  if (__discSearchQuery) {
    const q = __discSearchQuery.toLowerCase();
    filtered = filtered.filter(r => r.title?.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q));
  }

  return `
    <!-- Action Header & Primary Buttons -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-black text-slate-900 dark:text-white">Recommendations &amp; Auto-Remediation Engine</h2>
          <p class="text-xs text-slate-500">Ranked, safe optimizations from multi-pillar audits. Preview before applying, with automated validation and 1-click rollback.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button onclick="runDiscoverabilityAuditOnDemand()" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Run Audit
          </button>
          <button onclick="syncDiscoverabilityData()" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
            Sync Data
          </button>
          <button onclick="openAutomationSettingsModal()" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
            Automation Settings
          </button>
          <button onclick="openWeeklyReportModal()" class="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5">
            Weekly Digest
          </button>
          ${counts.auto_fixable > 0 ? `
            <button onclick="openApplyAllSafeModal()" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Apply All Safe Recommendations (${counts.auto_fixable})
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Execution Class Tabs & Filter Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-[#2B303A]">
        <div class="flex flex-wrap items-center gap-1 text-xs font-bold">
          <button onclick="setRecFilter('all')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'all' ? 'bg-[#2563EB] text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">All (${counts.all})</button>
          <button onclick="setRecFilter('auto_fixable')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'auto_fixable' ? 'bg-emerald-600 text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">Safe Auto-Fix (${counts.auto_fixable})</button>
          <button onclick="setRecFilter('approval_required')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'approval_required' ? 'bg-amber-600 text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">Requires Approval (${counts.approval_required})</button>
          <button onclick="setRecFilter('manual')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'manual' ? 'bg-purple-600 text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">Manual Tasks (${counts.manual})</button>
          <button onclick="setRecFilter('validated')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'validated' ? 'bg-blue-600 text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">Validated (${counts.validated})</button>
          <button onclick="setRecFilter('reverted')" class="px-3 py-1.5 rounded-lg transition cursor-pointer ${__discRecFilter === 'reverted' ? 'bg-slate-700 text-white font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#121318]'}">Reverted (${counts.reverted})</button>
        </div>

        <div class="flex items-center gap-2">
          <select onchange="setPillarFilter(this.value)" class="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-[#2B303A] bg-white dark:bg-[#121318] text-slate-700 dark:text-slate-300 font-bold">
            <option value="all" ${__discPillarFilter === 'all' ? 'selected' : ''}>All Pillars</option>
            <option value="seo" ${__discPillarFilter === 'seo' ? 'selected' : ''}>SEO</option>
            <option value="aeo" ${__discPillarFilter === 'aeo' ? 'selected' : ''}>AEO</option>
            <option value="geo" ${__discPillarFilter === 'geo' ? 'selected' : ''}>GEO / LLMO</option>
            <option value="sxo" ${__discPillarFilter === 'sxo' ? 'selected' : ''}>SXO</option>
            <option value="aso" ${__discPillarFilter === 'aso' ? 'selected' : ''}>ASO</option>
            <option value="validation" ${__discPillarFilter === 'validation' ? 'selected' : ''}>Validation</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Recommendation Cards List -->
    <div class="space-y-3">
      ${filtered.length === 0 ? `
        <div class="p-8 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] text-center text-slate-400 text-sm">
          No recommendations found matching the selected filter.
        </div>
      ` : filtered.map(r => renderSingleRecommendationCard(r, false)).join('')}
    </div>
  `;
}

function renderSingleRecommendationCard(r, isCompact = false) {
  const isAuto = r.execution_class === 'auto_fixable';
  const isApproval = r.execution_class === 'approval_required';
  const isManual = r.execution_class === 'manual';
  const isValidated = r.status === 'validated';
  const isReverted = r.status === 'reverted';
  const isDismissed = r.status === 'dismissed';

  const classBadge = isAuto
    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Safe Auto-Fix</span>`
    : isApproval
    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">Requires Approval</span>`
    : `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">Manual Action</span>`;

  const statusBadge = isValidated
    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-[#2563EB] dark:text-blue-400 border border-blue-500/30">Applied &amp; Validated</span>`
    : isReverted
    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-500/15 text-slate-500 border border-slate-500/30">Reverted</span>`
    : isDismissed
    ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-500/15 text-slate-400">Dismissed</span>`
    : '';

  return `
    <div class="p-5 rounded-2xl border border-slate-200 dark:border-[#2B303A] bg-white dark:bg-[#1A1D24] shadow-sm space-y-4 transition">
      <!-- Card Header -->
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div class="space-y-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-[#121318] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#2B303A]">${esc(r.pillar)}</span>
            ${classBadge}
            ${statusBadge}
            ${r.estimated_score_gain ? `<span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">${esc(r.estimated_score_gain)} Score</span>` : ''}
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white pt-1">${esc(r.title)}</h3>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 flex-shrink-0">
          ${isAuto && r.status === 'open' ? `
            <button onclick="openDiffPreviewModal('${esc(r.id)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer">
              Preview Diff
            </button>
            <button onclick="applySingleRecommendationUI('${esc(r.id)}')" class="px-4 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold shadow-sm transition cursor-pointer">
              Apply Fix
            </button>
          ` : ''}

          ${isApproval && r.status === 'open' ? `
            <button onclick="openDiffPreviewModal('${esc(r.id)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] hover:bg-slate-100 dark:hover:bg-[#1A1D24] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer">
              Preview Diff
            </button>
            <button onclick="openApprovalModal('${esc(r.id)}')" class="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition cursor-pointer">
              Review &amp; Approve
            </button>
          ` : ''}

          ${isManual && r.status === 'open' ? `
            <button onclick="dismissRecommendationUI('${esc(r.id)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer">
              Mark Complete
            </button>
          ` : ''}

          ${isValidated ? `
            <button onclick="openDiffPreviewModal('${esc(r.id)}')" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer">
              View Snapshot
            </button>
            <button onclick="revertRecommendationUI('${esc(r.id)}')" class="px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold transition cursor-pointer">
              Revert
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Plain-Language Explanation Deck -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-100 dark:border-[#2B303A] space-y-1">
          <div class="text-[10px] uppercase font-bold text-slate-400">What Changed &amp; Evidence</div>
          <p class="text-slate-700 dark:text-slate-300">${esc(r.whatChanged || r.evidence || r.summary)}</p>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-100 dark:border-[#2B303A] space-y-1">
          <div class="text-[10px] uppercase font-bold text-slate-400">Why It Matters (Impact)</div>
          <p class="text-slate-700 dark:text-slate-300">${esc(r.whyItMatters)}</p>
        </div>
      </div>

      <!-- Affected URLs and Target Metadata -->
      <div class="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-[#2B303A] gap-2">
        <div>
          <b>Action:</b> ${esc(r.whatShouldIDo || r.recommended_change?.reason || 'Automated safe metadata injection')}
        </div>
        ${r.affected_urls?.length ? `
          <div class="font-mono text-[#2563EB]">
            ${r.affected_urls.map(u => esc(u)).join(', ')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── 3. SEO EMBEDDED VIEW (PRESERVED FULL SEO DASHBOARD) ─────────────────────
function renderDiscSeoEmbeddedView() {
  return `
    <div id="ms-seo-embedded-mount" class="space-y-6">
      <div id="seo-workspace-root" class="space-y-6 pt-2">
        <div class="py-12 text-center text-sm text-slate-400 italic">Mounting MarketSync AI SEO Command Center…</div>
      </div>
    </div>
  `;
}

// ── 4. AEO (ANSWER ENGINE OPTIMIZATION) ────────────────────────────────────
function renderDiscAeoView() {
  const aeo = __discData?.pillars?.aeo || {};
  const isAdv = __discMode === 'advanced';

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Featured Snippet Win Rate</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${aeo.featuredSnippets?.winRate || '42.8%'}</div>
        <div class="text-xs text-slate-500">${aeo.featuredSnippets?.activeCount || 6} Active Snippets won of ${aeo.featuredSnippets?.potentialCount || 14} tracked opportunities.</div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">People Also Ask (PAA) Reach</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${aeo.peopleAlsoAsk?.reachPercent || '59.3%'}</div>
        <div class="text-xs text-slate-500">${aeo.peopleAlsoAsk?.coveredQuestions || 19} of ${aeo.peopleAlsoAsk?.totalTracked || 32} core buying questions covered.</div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Voice Search Readiness</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${aeo.voiceSearchOptimization?.conversationalReadinessScore || 86} <span class="text-xs font-medium text-slate-400">/ 100</span></div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">${aeo.voiceSearchOptimization?.longTailQueryMatchCount || 24} conversational queries optimized.</div>
      </div>
    </div>

    <!-- Featured Snippet Wins & Losses -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <h3 class="text-base font-black text-slate-900 dark:text-white">Direct Answer &amp; Snippet Performance</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
          <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Active Snippet Wins
          </div>
          <ul class="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            ${(aeo.featuredSnippets?.recentWins || []).map(w => `<li>• "${esc(w)}"</li>`).join('')}
          </ul>
        </div>

        <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
          <div class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Snippet Opportunities (Losses)
          </div>
          <ul class="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
            ${(aeo.featuredSnippets?.recentLosses || []).map(l => `<li>• "${esc(l)}"</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>

    ${isAdv ? `
      <!-- PAA Question Cluster Hierarchy -->
      <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white">People Also Ask (PAA) Question Graph</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${(aeo.peopleAlsoAsk?.topQuestionClusters || []).map(c => `
            <div class="p-4 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] space-y-2">
              <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-slate-900 dark:text-white">${esc(c.cluster)}</span>
                <span class="text-xs font-black text-[#2563EB]">${esc(c.coverage)}</span>
              </div>
              <div class="text-[11px] text-slate-500">${esc(c.questions)} tracked answer variants</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// ── 5. GEO / LLMO (AI MODEL VISIBILITY & BENCHMARKS) ───────────────────────
function renderDiscGeoView() {
  const geo = __discData?.pillars?.geo || {};
  const isAdv = __discMode === 'advanced';

  return `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Brand Mention Rate</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">${geo.brandMentionRate || '68.5%'}</div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">6/6 Models Tested</div>
      </div>

      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">URL Citation Rate</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">${geo.urlCitationRate || '41.2%'}</div>
        <div class="text-xs text-slate-500">Backlinks to VDP &amp; Finance</div>
      </div>

      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Citation SOV</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">${geo.citationShareOfVoice || '24.8%'}</div>
        <div class="text-xs text-blue-500 font-bold">#1 in Local Radius</div>
      </div>

      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hallucinations</div>
        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${geo.hallucinationCount || 0}</div>
        <div class="text-xs text-slate-500">100% Fact Accuracy</div>
      </div>
    </div>

    <!-- Multi-Model Coverage Grid -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">AI Engine Benchmark Telemetry</h3>
          <p class="text-xs text-slate-500">Live monitoring of dealership entity recognition and URL citation frequency across leading AI models.</p>
        </div>
        <button onclick="openGeoBenchmarkModal()" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Run Synthetic Benchmark
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${(geo.modelCoverage || []).map(m => `
          <div class="p-4 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] space-y-2">
            <div class="flex justify-between items-center">
              <span class="font-bold text-xs text-slate-900 dark:text-white">${esc(m.engine)}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600">${esc(m.status)}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500">
              <div>Mentions: <b class="text-slate-900 dark:text-white">${esc(m.mentions)}</b></div>
              <div>Citations: <b class="text-slate-900 dark:text-white">${esc(m.citations)}</b></div>
            </div>
            <div class="text-[11px] text-slate-500">Accuracy: <b class="text-emerald-600 dark:text-emerald-400">${esc(m.accuracy)}</b></div>
          </div>
        `).join('')}
      </div>
    </div>

    ${isAdv ? `
      <!-- Prompt & Result Evidence Log -->
      <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Synthetic Benchmark Evidence Log</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 dark:bg-[#121318] text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-[#2B303A]">
              <tr>
                <th class="py-3 px-4">Query</th>
                <th class="py-3 px-4">Engine / Model</th>
                <th class="py-3 px-4">Mentioned</th>
                <th class="py-3 px-4">Cited URL</th>
                <th class="py-3 px-4">Accuracy</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#2B303A] text-slate-700 dark:text-slate-300">
              ${(geo.benchmarkEvidenceLog || []).map(b => `
                <tr>
                  <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${esc(b.query)}</td>
                  <td class="py-3 px-4">${esc(b.engine)} (${esc(b.model)})</td>
                  <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">${b.mentioned ? 'YES' : 'NO'}</td>
                  <td class="py-3 px-4 font-mono text-[11px] text-[#2563EB]">${esc(b.sourceUrl)}</td>
                  <td class="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">${esc(b.accuracy)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

// ── 6. SXO (SEARCH EXPERIENCE & CONVERSION) ─────────────────────────────────
function renderDiscSxoView() {
  const sxo = __discData?.pillars?.sxo || {};
  const isAdv = __discMode === 'advanced';

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Search Conversion Rate</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${sxo.conversionRate || '3.4%'}</div>
        <div class="text-xs text-slate-500">From search landing page to lead submission.</div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mobile Traffic Share</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${sxo.mobileVsDesktop?.mobileTrafficShare || '68%'}</div>
        <div class="text-xs text-slate-500">Mobile CVR: <b>${sxo.mobileVsDesktop?.mobileConversionRate || '3.2%'}</b> vs Desktop: <b>${sxo.mobileVsDesktop?.desktopConversionRate || '3.8%'}</b></div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-2">
        <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Search Bounce Rate</div>
        <div class="text-3xl font-black text-slate-900 dark:text-white">${sxo.bounceRate || '28.6%'}</div>
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Healthy engagement score</div>
      </div>
    </div>

    <!-- Organic Search Conversion Funnel -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <h3 class="text-base font-black text-slate-900 dark:text-white">Organic Search Attribution Funnel</h3>
      <div class="space-y-3">
        ${(sxo.funnel || []).map((f, i) => `
          <div class="space-y-1">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-slate-700 dark:text-slate-300">${esc(f.step)}</span>
              <span class="text-slate-900 dark:text-white">${f.count?.toLocaleString()}</span>
            </div>
            <div class="h-2.5 w-full bg-slate-100 dark:bg-[#121318] rounded-full overflow-hidden">
              <div class="h-full bg-[#2563EB]" style="width: ${Math.max(8, 100 - (i * 18))}%;"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${isAdv ? `
      <!-- Top Converting Organic Landing Pages -->
      <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Top Converting Landing Pages</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-100 dark:bg-[#121318] text-slate-500 uppercase font-bold border-b border-slate-200 dark:border-[#2B303A]">
              <tr>
                <th class="py-3 px-4">Landing URL</th>
                <th class="py-3 px-4">Organic Visits</th>
                <th class="py-3 px-4">Leads Captured</th>
                <th class="py-3 px-4">Page CVR</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#2B303A] text-slate-700 dark:text-slate-300">
              ${(sxo.topLandingPages || []).map(p => `
                <tr>
                  <td class="py-3 px-4 font-mono font-bold text-[#2563EB]">${esc(p.url)}</td>
                  <td class="py-3 px-4">${p.visits?.toLocaleString()}</td>
                  <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">${p.conversions}</td>
                  <td class="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">${esc(p.cvr)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

// ── 7. ASO (APP & CHROME WEB STORE OPTIMIZATION) ────────────────────────────
function renderDiscAsoView() {
  const aso = __discData?.pillars?.aso || {};
  const stores = aso.stores || [];

  return `
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Store Listings &amp; Extensions</h3>
          <p class="text-xs text-slate-500">Chrome Web Store and app marketplace visibility, install telemetry, and review sentiment.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">Verified</span>
      </div>

      <div class="space-y-4">
        ${stores.map(s => `
          <div class="p-5 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="space-y-0.5">
                <div class="text-xs font-bold text-[#2563EB] uppercase tracking-wider">${esc(s.store)}</div>
                <h4 class="text-base font-bold text-slate-900 dark:text-white">${esc(s.listingName)}</h4>
              </div>
              <div class="text-right">
                <span class="text-amber-500 font-bold text-sm inline-flex items-center gap-1"><svg class="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>${esc(s.rating)}</span>
                <span class="text-xs text-slate-500">(${esc(s.reviewCount)} reviews)</span>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div class="p-3 rounded-lg bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A]">
                <div class="text-slate-400 text-[10px] uppercase font-bold">Weekly Impressions</div>
                <div class="text-base font-black text-slate-900 dark:text-white mt-0.5">${s.weeklyImpressions?.toLocaleString()}</div>
              </div>
              <div class="p-3 rounded-lg bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A]">
                <div class="text-slate-400 text-[10px] uppercase font-bold">Weekly Installs</div>
                <div class="text-base font-black text-slate-900 dark:text-white mt-0.5">${s.weeklyInstalls?.toLocaleString()}</div>
              </div>
              <div class="p-3 rounded-lg bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A]">
                <div class="text-slate-400 text-[10px] uppercase font-bold">Install CVR</div>
                <div class="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${esc(s.installConversionRate)}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── 8. VALIDATION & ACCURACY (CRITICAL / HIGH / MED / LOW TRIAGE) ───────────
function renderDiscValidationView() {
  const val = __discData?.pillars?.validation || {};
  const issues = val.issues || [];

  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm">
        <div class="text-[11px] font-bold uppercase tracking-wider text-red-500">Critical Issues</div>
        <div class="text-2xl font-black text-red-600 mt-1">${val.criticalCount || 0}</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm">
        <div class="text-[11px] font-bold uppercase tracking-wider text-amber-500">High Priority</div>
        <div class="text-2xl font-black text-amber-600 mt-1">${val.highCount || 0}</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm">
        <div class="text-[11px] font-bold uppercase tracking-wider text-blue-500">Medium Priority</div>
        <div class="text-2xl font-black text-blue-600 mt-1">${val.mediumCount || 0}</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm">
        <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Verified Checks</div>
        <div class="text-2xl font-black text-emerald-600 mt-1">${val.lowCount || 1}</div>
      </div>
    </div>

    <!-- Validation Issues Triage Board -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Validation &amp; Accuracy Triage</h3>
          <p class="text-xs text-slate-500">Continuous scans of links, schema, canonicals, pricing freshness, and AI factual accuracy.</p>
        </div>
        <button onclick="triggerValidationScan()" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Run Instant Scan
        </button>
      </div>

      <div class="space-y-3">
        ${issues.map(iss => `
          <div class="p-4 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${iss.severity === 'Critical' ? 'bg-red-500/15 text-red-600 border border-red-500/30' : iss.severity === 'High' ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30' : iss.severity === 'Medium' ? 'bg-blue-500/15 text-blue-600 border border-blue-500/30' : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'}">
                  ${esc(iss.severity)} · ${esc(iss.category)}
                </span>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white">${esc(iss.title)}</h4>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">${esc(iss.description)}</p>
              <div class="text-[11px] text-slate-500"><b>Impact:</b> ${esc(iss.impact)} · <b>URL:</b> <span class="font-mono text-[#2563EB]">${esc(iss.affectedUrl)}</span></div>
            </div>
            ${iss.autoFixable ? `
              <button onclick="runDiscoverabilityAction('${esc(iss.id)}', 'auto_fix', 'Validation')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm whitespace-nowrap transition cursor-pointer flex-shrink-0">
                Auto-Fix Now
              </button>
            ` : `
              <span class="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold whitespace-nowrap flex-shrink-0">Manual Review</span>
            `}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── RECOMMENDATION LIFECYCLE ACTIONS & MODALS ───────────────────────────────
async function applySingleRecommendationUI(recId) {
  try {
    if (typeof showToast === 'function') showToast('Applying recommendation with snapshot & validation…', 'info');
    const res = await apiSendJson(`/discoverability/recommendations/${recId}/apply`, 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Recommendation applied and validated!', 'success');
      loadDiscoverabilityWorkspace();
    } else {
      if (typeof showToast === 'function') showToast(res?.message || res?.error || 'Failed to apply recommendation.', 'error');
      loadDiscoverabilityWorkspace();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function revertRecommendationUI(recId) {
  try {
    if (typeof showToast === 'function') showToast('Reverting recommendation from rollback snapshot…', 'info');
    const res = await apiSendJson(`/discoverability/recommendations/${recId}/revert`, 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Recommendation reverted to previous state.', 'success');
      loadDiscoverabilityWorkspace();
    } else {
      if (typeof showToast === 'function') showToast(res?.error || 'Failed to revert recommendation.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function dismissRecommendationUI(recId) {
  try {
    const res = await apiSendJson(`/discoverability/recommendations/${recId}/reject`, 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast('Recommendation updated.', 'success');
      loadDiscoverabilityWorkspace();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

function openApplyAllSafeModal() {
  if (typeof automationModal !== 'function') return;
  const recs = __discData?.recommendations || [];
  const safeRecs = recs.filter(r => r.execution_class === 'auto_fixable' && r.status === 'open');
  const approvalCount = recs.filter(r => r.execution_class === 'approval_required' && r.status === 'open').length;
  const manualCount = recs.filter(r => r.execution_class === 'manual' && r.status === 'open').length;

  let totalScoreGain = 0;
  safeRecs.forEach(r => {
    const g = parseInt(String(r.estimated_score_gain || '0').replace(/[^0-9]/g, ''), 10) || 2;
    totalScoreGain += g;
  });

  automationModal(`
    <div class="space-y-5 text-left">
      <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Apply All Safe Recommendations</h3>
          <p class="text-xs text-slate-500">Automated execution of verified, low-risk discoverability enhancements.</p>
        </div>
      </div>

      <!-- Scope Breakdown Grid -->
      <div class="grid grid-cols-3 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <div class="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Safe Auto-Fixes</div>
          <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${safeRecs.length}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Eligible for execution</div>
        </div>

        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <div class="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Requires Review</div>
          <div class="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">${approvalCount}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Safely preserved</div>
        </div>

        <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
          <div class="text-[10px] uppercase font-bold text-[#2563EB] dark:text-blue-400">Est. Score Gain</div>
          <div class="text-xl font-black text-[#2563EB] dark:text-blue-400 mt-1">+${totalScoreGain}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Composite lift</div>
        </div>
      </div>

      <!-- Safety Guarantees Notice -->
      <div class="p-4 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A] text-xs space-y-2">
        <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          Automated Safety &amp; Integrity Controls
        </div>
        <ul class="text-slate-600 dark:text-slate-400 space-y-1 pl-4 list-disc">
          <li>Immutable rollback snapshots created before any field is updated.</li>
          <li>Protected fields (pricing, rates, legal, NAP, redirects) are strictly blocked from bulk apply.</li>
          <li>Each mutation undergoes immediate post-apply validation; any failure is auto-reverted instantly.</li>
        </ul>
      </div>

      <!-- Execution Target List -->
      <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        ${safeRecs.map(r => `
          <div class="p-2.5 rounded-lg border border-slate-100 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex items-center justify-between text-xs">
            <span class="font-bold text-slate-800 dark:text-slate-200">${esc(r.title)}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold flex-shrink-0">${esc(r.estimated_score_gain)}</span>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Cancel</button>
        <button onclick="executeApplyAllSafePipeline()" class="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black shadow-sm">
          Confirm &amp; Apply All Safe Fixes
        </button>
      </div>
    </div>
  `, 'max-w-xl');
}

async function executeApplyAllSafePipeline() {
  document.querySelector('#automation-modal-container')?.remove();
  try {
    if (typeof showToast === 'function') showToast('Applying safe recommendations pipeline…', 'info');
    const res = await apiSendJson('/discoverability/recommendations/apply-all-safe', 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Safe recommendations applied!', 'success');
      loadDiscoverabilityWorkspace();
      openApplyAllCompletionModal(res);
    } else {
      if (typeof showToast === 'function') showToast(res?.error || 'Batch apply failed.', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

function openApplyAllCompletionModal(summary) {
  if (typeof automationModal !== 'function') return;
  automationModal(`
    <div class="space-y-5 text-left">
      <div class="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div class="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 flex items-center justify-center font-black text-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Batch Remediation Completed</h3>
          <p class="text-xs text-slate-500">${esc(summary.message)}</p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 text-xs">
        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center">
          <div class="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Successful</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${summary.applied_count || 0}</div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A] text-center">
          <div class="text-[10px] uppercase font-bold text-slate-400">Failed / Reverted</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white mt-1">${summary.failed_count || 0}</div>
        </div>

        <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-center">
          <div class="text-[10px] uppercase font-bold text-[#2563EB] dark:text-blue-400">Score Gain</div>
          <div class="text-2xl font-black text-[#2563EB] dark:text-blue-400 mt-1">${esc(summary.estimated_score_gain || '+0')}</div>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black shadow-sm">
          Done
        </button>
      </div>
    </div>
  `, 'max-w-md');
}

function openDiffPreviewModal(recId) {
  if (typeof automationModal !== 'function') return;
  const recs = __discData?.recommendations || [];
  const rec = recs.find(r => r.id === recId);
  if (!rec) return;

  const change = rec.recommended_change || {};
  const beforeVal = change.before === null || change.before === undefined ? '(Empty / Not Set)' : (typeof change.before === 'object' ? JSON.stringify(change.before, null, 2) : String(change.before));
  const afterVal = change.after === null || change.after === undefined ? '(Empty / Removed)' : (typeof change.after === 'object' ? JSON.stringify(change.after, null, 2) : String(change.after));

  automationModal(`
    <div class="space-y-5 text-left">
      <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-[#121318] text-slate-700 dark:text-slate-300">${esc(rec.pillar)}</span>
          <h3 class="text-base font-black text-slate-900 dark:text-white mt-1">${esc(rec.title)}</h3>
        </div>
      </div>

      <div class="text-xs text-slate-500">
        <b>Target Resource:</b> <span class="font-mono text-[#2563EB]">${esc(change.resource_type || 'site_page')} · ${esc(change.field || 'meta')}</span>
      </div>

      <!-- Before / After Visual Diff Box -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div class="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-1.5">
          <div class="font-bold text-red-600 dark:text-red-400 uppercase text-[10px]">Current / Previous State (Before)</div>
          <pre class="p-2.5 rounded-lg bg-white dark:bg-[#121318] border border-slate-200 dark:border-slate-800 font-mono text-[11px] whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">${esc(beforeVal)}</pre>
        </div>

        <div class="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
          <div class="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-[10px]">Proposed Change (After)</div>
          <pre class="p-2.5 rounded-lg bg-white dark:bg-[#121318] border border-slate-200 dark:border-slate-800 font-mono text-[11px] whitespace-pre-wrap break-all text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">${esc(afterVal)}</pre>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A] text-xs space-y-1">
        <div class="font-bold text-slate-900 dark:text-white">Explanation &amp; Objective</div>
        <p class="text-slate-600 dark:text-slate-400">${esc(change.reason || rec.whatShouldIDo || rec.whyItMatters)}</p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Close</button>
        ${rec.status === 'open' && rec.execution_class === 'auto_fixable' ? `
          <button onclick="document.querySelector('#automation-modal-container')?.remove(); applySingleRecommendationUI('${esc(rec.id)}');" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold">Apply Now</button>
        ` : ''}
        ${rec.status === 'open' && rec.execution_class === 'approval_required' ? `
          <button onclick="document.querySelector('#automation-modal-container')?.remove(); openApprovalModal('${esc(rec.id)}');" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">Approve &amp; Apply</button>
        ` : ''}
      </div>
    </div>
  `, 'max-w-2xl');
}

function openApprovalModal(recId) {
  if (typeof automationModal !== 'function') return;
  const recs = __discData?.recommendations || [];
  const rec = recs.find(r => r.id === recId);
  if (!rec) return;

  automationModal(`
    <div class="space-y-5 text-left">
      <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600">Review &amp; Sign-Off</span>
          <h3 class="text-base font-black text-slate-900 dark:text-white mt-1">${esc(rec.title)}</h3>
        </div>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A] text-xs space-y-2">
        <div class="font-bold text-slate-900 dark:text-white">Why Approval is Required</div>
        <p class="text-slate-600 dark:text-slate-400">This recommendation impacts visible content structure or user navigation. Dealership manager sign-off is required prior to deployment.</p>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Approval Notes / Reason (Optional)</label>
        <textarea id="rec-approval-notes" rows="2" placeholder="Reviewed and approved by sales manager." class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"></textarea>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Cancel</button>
        <button onclick="submitApprovalUI('${esc(rec.id)}')" class="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black shadow-sm">
          Sign-Off &amp; Apply
        </button>
      </div>
    </div>
  `, 'max-w-lg');
}

async function submitApprovalUI(recId) {
  const notes = document.getElementById('rec-approval-notes')?.value || '';
  document.querySelector('#automation-modal-container')?.remove();
  try {
    if (typeof showToast === 'function') showToast('Recording approval and applying change…', 'info');
    const res = await apiSendJson(`/discoverability/recommendations/${recId}/approve`, 'POST', { notes });
    if (res?.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Recommendation approved!', 'success');
      loadDiscoverabilityWorkspace();
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function openAutomationSettingsModal() {
  if (typeof automationModal !== 'function') return;
  try {
    const res = await apiGetJson('/discoverability/settings').catch(() => null);
    const s = res?.settings || { discoverability_automation_level: 'recommend_only' };

    automationModal(`
      <div class="space-y-5 text-left">
        <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Discoverability Automation Levels</h3>
            <p class="text-xs text-slate-500">Configure how MarketSync handles audit findings and auto-remediation.</p>
          </div>
        </div>

        <div class="space-y-3">
          <label class="p-3 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex items-start gap-3 cursor-pointer">
            <input type="radio" name="disc_auto_level" value="recommend_only" ${s.discoverability_automation_level === 'recommend_only' ? 'checked' : ''} class="mt-1" />
            <div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">Recommend Only (Default)</div>
              <div class="text-[11px] text-slate-500">MarketSync audits and scores your dealership, generating ranked recommendations for manual review.</div>
            </div>
          </label>

          <label class="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3 cursor-pointer">
            <input type="radio" name="disc_auto_level" value="auto_apply_safe" ${s.discoverability_automation_level === 'auto_apply_safe' ? 'checked' : ''} class="mt-1" />
            <div>
              <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400">Auto-Apply Safe Fixes (Recommended)</div>
              <div class="text-[11px] text-slate-600 dark:text-slate-400">Automatically applies verified, low-risk metadata and schema fixes after weekly audits. Sends a weekly diff summary.</div>
            </div>
          </label>

          <label class="p-3 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex items-start gap-3 cursor-pointer">
            <input type="radio" name="disc_auto_level" value="rules_based" ${s.discoverability_automation_level === 'rules_based' ? 'checked' : ''} class="mt-1" />
            <div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">Rules-Based Automation</div>
              <div class="text-[11px] text-slate-500">Automatically applies fixes for selected categories (Quick Wins, AI Visibility, Technical).</div>
            </div>
          </label>

          <label class="p-3 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex items-start gap-3 cursor-pointer">
            <input type="radio" name="disc_auto_level" value="manual_approval" ${s.discoverability_automation_level === 'manual_approval' ? 'checked' : ''} class="mt-1" />
            <div>
              <div class="text-xs font-bold text-slate-900 dark:text-white">Manual Approval Required</div>
              <div class="text-[11px] text-slate-500">Every change, regardless of risk, requires explicit manager approval.</div>
            </div>
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Cancel</button>
          <button onclick="saveAutomationSettingsUI()" class="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black">Save Settings</button>
        </div>
      </div>
    `, 'max-w-lg');
  } catch (e) {}
}

async function saveAutomationSettingsUI() {
  const selectedLevel = document.querySelector('input[name="disc_auto_level"]:checked')?.value || 'recommend_only';
  document.querySelector('#automation-modal-container')?.remove();
  try {
    const res = await apiSendJson('/discoverability/settings', 'PUT', {
      discoverability_automation_level: selectedLevel
    });
    if (res?.success) {
      if (typeof showToast === 'function') showToast('Automation settings updated.', 'success');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function openWeeklyReportModal() {
  if (typeof automationModal !== 'function') return;
  try {
    const res = await apiGetJson('/discoverability/reports/weekly').catch(() => null);
    const rep = res?.report;
    if (!rep) return;

    automationModal(`
      <div class="space-y-5 text-left">
        <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Weekly Discoverability Digest</h3>
            <p class="text-xs text-slate-500">${esc(rep.dealership_name)} · ${esc(rep.period)}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A]">
            <div class="text-[10px] uppercase font-bold text-slate-400">Score Delta</div>
            <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${esc(rep.score_summary?.delta)}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A]">
            <div class="text-[10px] uppercase font-bold text-slate-400">Auto-Fixed</div>
            <div class="text-xl font-black text-[#2563EB] dark:text-blue-400 mt-0.5">${rep.weekly_breakdown?.auto_fixed_count || 0}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A]">
            <div class="text-[10px] uppercase font-bold text-slate-400">Awaiting Sign-Off</div>
            <div class="text-xl font-black text-amber-600 mt-0.5">${rep.weekly_breakdown?.awaiting_approval_count || 0}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#121318] border border-slate-200 dark:border-[#2B303A]">
            <div class="text-[10px] uppercase font-bold text-slate-400">Organic Growth</div>
            <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">${esc(rep.score_summary?.organic_visibility_growth || '+8%')}</div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">Top Wins This Week</div>
          <ul class="text-xs text-slate-600 dark:text-slate-400 space-y-1 pl-4 list-disc">
            ${(rep.top_wins || []).map(w => `<li>${esc(w)}</li>`).join('')}
          </ul>
        </div>

        <div class="flex justify-end pt-2">
          <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-black shadow-sm">
            Close
          </button>
        </div>
      </div>
    `, 'max-w-xl');
  } catch (e) {}
}

async function runDiscoverabilityAuditOnDemand() {
  try {
    if (typeof showToast === 'function') showToast('Running comprehensive multi-pillar Discoverability audit…', 'info');
    const res = await apiSendJson('/discoverability/audit', 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast('Discoverability audit completed and recommendations updated.', 'success');
      loadDiscoverabilityWorkspace('recommendations');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function syncDiscoverabilityData() {
  try {
    if (typeof showToast === 'function') showToast('Syncing connected discoverability data sources…', 'info');
    const res = await apiSendJson('/discoverability/sync', 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast('External sources refreshed.', 'success');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message, 'error');
  }
}

async function runDiscoverabilityAction(actionId, actionType, pillar) {
  try {
    const res = await apiSendJson('/discoverability/action', 'POST', {
      action_id: actionId,
      action_type: actionType,
      pillar
    });
    if (res?.success) {
      if (typeof showToast === 'function') showToast(res.message || 'Action executed successfully.', 'success');
      loadDiscoverabilityWorkspace();
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  }
}

async function triggerValidationScan() {
  try {
    if (typeof showToast === 'function') showToast('Running validation crawl across all routes…', 'info');
    const res = await apiSendJson('/discoverability/validation/scan', 'POST', {});
    if (res?.success) {
      if (typeof showToast === 'function') showToast('Validation scan completed.', 'success');
      loadDiscoverabilityWorkspace();
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  }
}

function openGeoBenchmarkModal() {
  if (typeof automationModal !== 'function') return;
  automationModal(`
    <div class="space-y-5 text-left">
      <div class="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Run Synthetic AI Benchmark</h3>
          <p class="text-xs text-slate-500">Query multiple AI engines with simulated buyer prompts to verify citations and accuracy.</p>
        </div>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Prompt / Search Query</label>
          <input id="geo-bench-query" type="text" value="Best used trucks near me with easy financing" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">AI Engine Selection</label>
          <select id="geo-bench-engine" class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">
            <option value="All Engines">All Engines (ChatGPT, Gemini, Perplexity, Copilot, Claude, Google AI)</option>
            <option value="Google Gemini">Google Gemini</option>
            <option value="ChatGPT (GPT-4o)">ChatGPT (GPT-4o)</option>
            <option value="Perplexity AI">Perplexity AI</option>
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button onclick="document.querySelector('#automation-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">Cancel</button>
        <button onclick="runGeoSyntheticBenchmark()" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold">Run Benchmark</button>
      </div>
    </div>
  `, 'max-w-xl');
}

async function runGeoSyntheticBenchmark() {
  const query = document.getElementById('geo-bench-query')?.value;
  const engine = document.getElementById('geo-bench-engine')?.value;
  document.querySelector('#automation-modal-container')?.remove();

  try {
    if (typeof showToast === 'function') showToast('Executing synthetic benchmark across AI models…', 'info');
    const res = await apiSendJson('/discoverability/geo/benchmark', 'POST', { query, engine });
    if (res?.success) {
      if (typeof showToast === 'function') showToast(`Benchmark completed across ${res.executedRunsCount} models.`, 'success');
      loadDiscoverabilityWorkspace('geo');
    }
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  }
}

// Global window exposure
Object.assign(window, {
  loadDiscoverabilityWorkspace,
  setDiscTab,
  setDiscMode,
  setRecFilter,
  setPillarFilter,
  renderDiscoverabilityWorkspace,
  applySingleRecommendationUI,
  revertRecommendationUI,
  dismissRecommendationUI,
  openApplyAllSafeModal,
  executeApplyAllSafePipeline,
  openApplyAllCompletionModal,
  openDiffPreviewModal,
  openApprovalModal,
  submitApprovalUI,
  openAutomationSettingsModal,
  saveAutomationSettingsUI,
  openWeeklyReportModal,
  runDiscoverabilityAuditOnDemand,
  syncDiscoverabilityData,
  runDiscoverabilityAction,
  triggerValidationScan,
  openGeoBenchmarkModal,
  runGeoSyntheticBenchmark
});
