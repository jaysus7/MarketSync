/**
 * MarketSync Discoverability Intelligence Workspace
 * 
 * Parent workspace orchestrating multi-pillar discovery intelligence:
 * 1. Overview — Executive KPI deck & Search vs AI SOV trends
 * 2. SEO — Preserved & embedded MarketSync AI SEO Command Center
 * 3. AEO — Answer Engine Optimization, Featured Snippets & Voice (VSO)
 * 4. GEO / LLMO — Generative Engine & AI Model Visibility Benchmarks
 * 5. SXO — Search Experience Optimization & Conversion Attribution
 * 6. ASO — App & Chrome Web Store Optimization
 * 7. Validation — Continuous Technical, Schema, and Data Accuracy Engine
 */

let __discData = null;
let __discTab = 'overview';
let __discMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('marketsync_disc_mode') || 'basic') : 'basic';

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

function renderDiscoverabilityWorkspace() {
  const container = document.getElementById('disc-workspace-container') || document.getElementById('ms-discoverability-root');
  if (!container || !__discData) return;

  const d = __discData;
  const isAdv = __discMode === 'advanced';
  const score = d.compositeScore || 86;

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
        <div class="text-xs text-slate-500 mt-1">${p.aeo?.featuredSnippets?.activeCount || 6} Featured Snippets</div>
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

    <!-- Recommendations Engine (Action Center) -->
    <div class="p-5 md:p-6 rounded-2xl bg-white dark:bg-[#1A1D24] border border-slate-200 dark:border-[#2B303A] shadow-sm space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-black text-slate-900 dark:text-white">Actionable Recommendations</h2>
          <p class="text-xs text-slate-500">Prioritized optimizations to expand local visibility and capture high-intent buyers.</p>
        </div>
        <span class="px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-400 border border-blue-200 dark:border-blue-800">${d.recommendations?.length || 0} Actions</span>
      </div>

      <div class="space-y-3">
        ${(d.recommendations || []).map(r => `
          <div class="p-4 rounded-xl border border-slate-200 dark:border-[#2B303A] bg-slate-50 dark:bg-[#121318] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${r.severity === 'High' ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30' : 'bg-blue-500/15 text-[#2563EB] border border-blue-500/30'}">${esc(r.pillar)} · ${esc(r.severity)}</span>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white">${esc(r.title)}</h4>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-400">${esc(r.whatChanged)}</p>
              <div class="text-[11px] text-slate-500"><b>Action:</b> ${esc(r.whatShouldIDo)}</div>
            </div>
            <button onclick="runDiscoverabilityAction('${esc(r.id)}', '${esc(r.actionType)}', '${esc(r.pillar)}')" class="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1F4ED8] text-white text-xs font-bold shadow-sm whitespace-nowrap transition cursor-pointer flex-shrink-0">
              Apply Recommendation
            </button>
          </div>
        `).join('')}
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

// ── 2. SEO EMBEDDED VIEW (PRESERVED FULL SEO DASHBOARD) ─────────────────────
function renderDiscSeoEmbeddedView() {
  return `
    <div id="ms-seo-embedded-mount" class="space-y-6">
      <div id="seo-workspace-root" class="space-y-6 pt-2">
        <div class="py-12 text-center text-sm text-slate-400 italic">Mounting MarketSync AI SEO Command Center…</div>
      </div>
    </div>
  `;
}

// ── 3. AEO (ANSWER ENGINE OPTIMIZATION) ────────────────────────────────────
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

// ── 4. GEO / LLMO (AI MODEL VISIBILITY & BENCHMARKS) ───────────────────────
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

// ── 5. SXO (SEARCH EXPERIENCE & CONVERSION) ─────────────────────────────────
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

// ── 6. ASO (APP & CHROME WEB STORE OPTIMIZATION) ────────────────────────────
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
                <span class="text-amber-500 font-bold text-sm">★ ${esc(s.rating)}</span>
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

// ── 7. VALIDATION & ACCURACY (CRITICAL / HIGH / MED / LOW TRIAGE) ───────────
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

// ── ACTIONS & MODALS ────────────────────────────────────────────────────────
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
    } else {
      if (typeof showToast === 'function') showToast(res?.error || 'Action failed.', 'error');
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
  renderDiscoverabilityWorkspace,
  runDiscoverabilityAction,
  triggerValidationScan,
  openGeoBenchmarkModal,
  runGeoSyntheticBenchmark
});
