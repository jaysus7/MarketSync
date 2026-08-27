import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = path.resolve(__dirname, '../../marketplace-frontend')
const EVIDENCE_DIR = path.resolve(__dirname, '../../docs/evidence/phase4')

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
}

const MOCK_SARAH = {
  id: 'c1111111-1111-1111-1111-111111111111',
  first_name: 'Sarah',
  last_name: 'Jenkins',
  full_name: 'Sarah Jenkins',
  email: 'sarah.jenkins@example.com',
  phone: '(416) 555-0192',
  phone_mobile: '(416) 555-0192',
  city: 'Toronto',
  province: 'ON',
  postal_code: 'M5V 2T6',
  stage: 'appointment',
  status: 'appointment',
  source: 'Website Form',
  source_key: 'website_inventory',
  created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
  assigned_rep: 'Jason Massie',
  assigned_rep_name: 'Jason Massie',
  notes: 'Interested in financing options and trade-in evaluation for 2021 Audi S5.',
  lead_score: 94,
  vehicle_interest: '2024 BMW M4 Competition Coupe',
  vehicle_vin: 'WBS33AY08RFM12345',
  vehicle_price: 84900,
  trade_vehicle: {
    year: 2021,
    make: 'Audi',
    model: 'S5',
    trim: 'Progressiv Coupe',
    vin: 'WAUB8AF45MA012984',
    monthly_payment: 850,
    payoff_amount: 38500,
    estimated_market_value: 43000
  },
  trade_allowance: 43000,
  tags: ['High Intent', 'Trade-In', 'Financing Pre-Qualified']
}

const MOCK_TIMELINE = [
  { id: 't1', type: 'inbound_lead', title: 'Website Lead Received', body: 'Submitted inquiry on 2024 BMW M4 Competition', created_at: new Date(Date.now() - 3600000 * 48).toISOString() },
  { id: 't2', type: 'call_outbound', title: 'Outbound Discovery Call', body: 'Spoke with Sarah. Confirmed test drive appointment for Friday at 2:00 PM.', created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
  { id: 't3', type: 'appointment_set', title: 'VIP Showroom Test Drive Booked', body: 'Scheduled for Aug 28, 2:00 PM with Jason Massie', created_at: new Date(Date.now() - 3600000 * 12).toISOString() }
]

const MOCK_TASKS = [
  { id: 'tk1', title: 'Prepare 2024 BMW M4 for 2:00 PM test drive (detail & fuel)', due_at: new Date().toISOString(), status: 'open', priority: 'high' }
]

const MOCK_CONTACTS = [
  MOCK_SARAH,
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    first_name: 'David',
    last_name: 'Miller',
    full_name: 'David Miller',
    email: 'dmiller@example.com',
    phone: '(416) 555-0144',
    stage: 'contacted',
    status: 'contacted',
    source: 'Facebook Marketplace',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
    assigned_rep: 'Jason Massie',
    vehicle_interest: '2023 Porsche 911 Carrera',
    lead_score: 88
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    first_name: 'Elena',
    last_name: 'Rostova',
    full_name: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    phone: '(416) 555-0188',
    stage: 'fni',
    status: 'fni',
    source: 'Showroom Walk-in',
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    assigned_rep: 'Jason Massie',
    vehicle_interest: '2024 Mercedes-AMG GT 53',
    lead_score: 98
  }
]

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, 'http://127.0.0.1')
    let reqPath = parsedUrl.pathname
    if (reqPath === '/' || reqPath === '') reqPath = '/dashboard.html'
    const filePath = path.join(FRONTEND_DIR, reqPath)

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      })
      fs.createReadStream(filePath).pipe(res)
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`Not Found: ${reqPath}`)
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      console.log(`Static frontend server running at http://127.0.0.1:${port}`)
      resolve({ server, port })
    })
  })
}

async function setupPageRoutes(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()

    if (url.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          email: 'sales@marketsync.link',
          role: 'owner_admin',
          full_name: 'Jason Massie',
          dealership_id: '00000000-0000-0000-0000-000000000001',
          dealership_name: 'Apex Auto Gallery'
        })
      })
    }

    if (url.includes('/branding')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          primary_color: '#2563EB',
          accent_color: '#1F4ED8',
          tagline: 'Premier Luxury & Exotic Automobiles',
          dealership_name: 'Apex Auto Gallery'
        })
      })
    }

    if (url.includes('/access/context')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isPlatformStaff: false,
          dealership: { id: '00000000-0000-0000-0000-000000000001', name: 'Apex Auto Gallery', plan: 'dealeros_complete' },
          products: ['dealer_os', 'facebook', 'ai_dealer', 'design_studio', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'marketsync_seo', 'marketsync_identity'],
          features: ['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service', 'os.team', 'os.accounting', 'os.marketing', 'os.website', 'os.automations', 'os.email_marketing', 'os.integrations', 'seo.overview', 'seo.audit', 'seo.autofix', 'seo.content', 'seo.competitors', 'seo.local', 'seo.inventory', 'seo.ai_search', 'seo.reports', 'seo.settings']
        })
      })
    }

    if (url.includes('/crm/contacts/c1111111') || url.includes('/crm/contacts/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contact: MOCK_SARAH,
          timeline: MOCK_TIMELINE,
          tasks: MOCK_TASKS
        })
      })
    }

    if (url.includes('/crm/contacts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contacts: MOCK_CONTACTS, total: MOCK_CONTACTS.length })
      })
    }

    if (url.includes('/equity/lease/by-contact/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          lease: {
            vehicle: '2021 Audi S5 Progressiv Coupe',
            vin: 'WAUB8AF45MA012984',
            monthly_payment: 850,
            payoff_amount: 38500,
            estimated_market_value: 43000,
            net_equity: 4500
          },
          settings: {}
        })
      })
    }

    if (url.includes('/crm/insights')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isManager: true,
          funnel: { uncontacted: 4, contacted: 12, appointment: 8, sold: 15, close_rate: 34 },
          leads: { total: 39, website: 18, facebook: 14, showroom: 7 }
        })
      })
    }

    if (url.includes('/crm/tasks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tasks: MOCK_TASKS })
      })
    }

    if (url.includes('/appointments')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          appointments: [
            { id: 'ap1', customer_name: 'Sarah Jenkins', vehicle_label: '2024 BMW M4 Competition', scheduled_at: new Date(Date.now() + 3600000 * 24).toISOString(), type: 'Test Drive', status: 'confirmed' }
          ]
        })
      })
    }

    if (url.includes('/delivery/queue')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          queue: [
            { id: 'dq1', customer_name: 'Elena Rostova', vehicle_label: '2024 Mercedes-AMG GT 53', scheduled_for: 'Tomorrow 10:00 AM', status: 'ready' }
          ]
        })
      })
    }

    if (url.includes('/hq/agent-credentials/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          environment: 'staging',
          credentials: [
            { agent_id: 'chatgpt', name: 'ChatGPT', has_key: true, key_prefix: 'ms_agent_chatgpt_a1b2c3d4', updated_at: new Date().toISOString() },
            { agent_id: 'claude', name: 'Claude', has_key: true, key_prefix: 'ms_agent_claude_e5f6g7h8', updated_at: new Date().toISOString() },
            { agent_id: 'gemini', name: 'Gemini', has_key: true, key_prefix: 'ms_agent_gemini_i9j0k1l2', updated_at: new Date().toISOString() },
            { agent_id: 'grok', name: 'Grok', has_key: true, key_prefix: 'ms_agent_grok_m3n4o5p6', updated_at: new Date().toISOString() }
          ]
        })
      })
    }

    if (url.includes('/hq/agents')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          agents: [
            { agent_id: 'chatgpt', name: 'ChatGPT', provider: 'OpenAI', status: 'ready', has_key: true, last_seen: new Date().toISOString() },
            { agent_id: 'claude', name: 'Claude', provider: 'Anthropic', status: 'in_progress', has_key: true, last_seen: new Date().toISOString() },
            { agent_id: 'gemini', name: 'Gemini', provider: 'Google', status: 'ready', has_key: true, last_seen: new Date().toISOString() },
            { agent_id: 'grok', name: 'Grok', provider: 'xAI', status: 'ready', has_key: true, last_seen: new Date().toISOString() }
          ]
        })
      })
    }

    if (url.includes('/hq/tasks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [
            { id: 'MS-001', title: 'Staging Auth & Route Hardening', agent: 'grok', status: 'In Progress', priority: 'high', created_at: new Date().toISOString() },
            { id: 'MS-002', title: 'Founder Key Rotation Protocol', agent: 'claude', status: 'Ready', priority: 'medium', created_at: new Date().toISOString() },
            { id: 'MS-005', title: 'Brand UI & Verification', agent: 'gemini', status: 'In Progress', priority: 'high', created_at: new Date().toISOString() }
          ]
        })
      })
    }

    if (url.includes('/hq/approvals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ approvals: [] })
      })
    }

    if (url.includes('/hq/integrations/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          integrations: [
            { provider: 'github', connected: true, label: 'GitHub Repository' },
            { provider: 'google_workspace', connected: true, label: 'Google Workspace' },
            { provider: 'supabase', connected: true, label: 'Supabase Database' }
          ]
        })
      })
    }

    if (url.includes('/discoverability/overview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entitled: true,
          compositeScore: 86,
          standardsVersion: 'MarketSync Discoverability Standards — 2026',
          pillars: {
            seo: { score: 88, organicClicks: 1420, organicImpressions: 28400, averagePosition: 11.8, clickThroughRate: '5.0%', keywordTiers: { top3: 14, top10: 48, top100: 186 }, cwvStatus: 'Good', indexationStatus: 'Healthy' },
            aeo: { score: 88, featuredSnippets: { activeCount: 6, potentialCount: 14, winRate: '42.8%', recentWins: ['What is the towing capacity of 2025 Silverado 1500?'], recentLosses: ['Best trade-in value near Welland'] }, peopleAlsoAsk: { coveredQuestions: 19, totalTracked: 32, reachPercent: '59.3%' }, schemaValidation: { autoDealerSchema: 'Valid', vehicleSchema: 'Valid', faqSchema: 'Valid', localBusinessSchema: 'Valid' }, voiceSearchOptimization: { conversationalReadinessScore: 86, longTailQueryMatchCount: 24 } },
            geo: { score: 82, brandMentionRate: '68.5%', urlCitationRate: '41.2%', citationShareOfVoice: '24.8%', sentimentBreakdown: { positive: '76%', neutral: '21%', negative: '3%' }, hallucinationCount: 0, modelCoverage: [
              { engine: 'ChatGPT (GPT-4o)', mentions: 18, citations: 12, accuracy: '100%', status: 'Active' },
              { engine: 'Google Gemini', mentions: 22, citations: 16, accuracy: '100%', status: 'Active' },
              { engine: 'Perplexity AI', mentions: 19, citations: 15, accuracy: '98%', status: 'Active' },
              { engine: 'Microsoft Copilot', mentions: 14, citations: 9, accuracy: '100%', status: 'Active' },
              { engine: 'Anthropic Claude', mentions: 12, citations: 7, accuracy: '100%', status: 'Active' },
              { engine: 'Google AI Overviews', mentions: 16, citations: 11, accuracy: '100%', status: 'Active' }
            ], benchmarkEvidenceLog: [
              { id: 'bm-1', query: 'Best dealership for used trucks in Welland', engine: 'Google Gemini', model: 'Gemini 1.5 Pro', timestamp: new Date().toISOString(), locale: 'en-CA', mentioned: true, cited: true, sourceUrl: 'https://marketsync.link', accuracy: 'Accurate' }
            ] },
            sxo: { score: 87, conversionRate: '3.4%', bounceRate: '28.6%', mobileVsDesktop: { mobileTrafficShare: '68%', mobileConversionRate: '3.2%', desktopTrafficShare: '32%', desktopConversionRate: '3.8%' }, topLandingPages: [
              { url: '/inventory?body_style=Truck', visits: 640, conversions: 24, cvr: '3.75%' },
              { url: '/credit-application', visits: 410, conversions: 38, cvr: '9.27%' }
            ], funnel: [
              { step: 'Search Visitors', count: 1820 },
              { step: 'VDP / Lead Page Views', count: 940 },
              { step: 'Qualified Organic Leads Captured', count: 18 },
              { step: 'Deals Closed / Delivered', count: 3 }
            ] },
            aso: { score: 92, stores: [{ store: 'Chrome Web Store', listingName: 'MarketSync Dealer Extension & Copilot', status: 'Published / Verified', rating: '4.9 / 5.0', reviewCount: 38, weeklyImpressions: 1420, weeklyInstalls: 116, installConversionRate: '8.17%' }] },
            validation: { score: 90, criticalCount: 0, highCount: 1, mediumCount: 1, lowCount: 1, issues: [
              { id: 'val-1', severity: 'High', category: 'Brand & NAP Consistency', title: 'Incomplete Dealership Address in Canonical Settings', description: 'Missing postal code limits local map pack indexing.', impact: 'Local search relevance', autoFixable: false, affectedUrl: '/settings' }
            ] }
          },
          recommendations: [
            { id: 'rec-1', pillar: 'GEO / LLMO', severity: 'High', title: 'Publish Silverado & Used SUV Knowledge Guides for Local Area', whatChanged: 'Local truck search volume grew 22% while AI answer engines cited competitors.', whyItMatters: 'Capturing citations drives high-intent test drives.', whatShouldIDo: 'Auto-generate localized buying guide with Vehicle JSON-LD.', actionType: 'create_ai_content' }
          ],
          history: { dates: ['7d', '6d', '5d', '4d', '3d', '2d', 'Today'], searchSovTrend: [18, 19, 21, 20, 22, 23, 24], aiSovTrend: [12, 14, 15, 18, 19, 21, 25], compositeScoreTrend: [81, 82, 83, 84, 84, 85, 86] }
        })
      })
    }

    if (url.includes('/saas/customers') || url.includes('/owner/customers')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dealerships: [
            { id: 'd1', name: 'Apex Auto Gallery', plan: 'dealer_os', status: 'active', monthly_mrr: 3999, active_users: 14, leads_30d: 142 }
          ]
        })
      })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true })
    })
  })
}

async function captureAll(browser, baseUrl) {
  console.log('\n--- Capturing Verified Surfaces ---')

  const tasks = [
    // Settings Reference Route (D043)
    { id: 'D043-settings', route: '#/p/profile', pageId: 'profile', w: 1440, h: 900, theme: 'light', isMobile: false },
    { id: 'D043-settings', route: '#/p/profile', pageId: 'profile', w: 1440, h: 900, theme: 'dark', isMobile: false },
    { id: 'D043-settings', route: '#/p/profile', pageId: 'profile', w: 390, h: 844, theme: 'light', isMobile: true },
    { id: 'D043-settings', route: '#/p/profile', pageId: 'profile', w: 390, h: 844, theme: 'dark', isMobile: true },

    // Customer Workspace Reference Record (D003)
    { id: 'D003-customer-record', route: '#/w/sales/sales', pageId: 'sales', customerId: 'c1111111-1111-1111-1111-111111111111', w: 1440, h: 900, theme: 'light', isMobile: false },
    { id: 'D003-customer-record', route: '#/w/sales/sales', pageId: 'sales', customerId: 'c1111111-1111-1111-1111-111111111111', w: 1440, h: 900, theme: 'dark', isMobile: false },
    { id: 'D003-customer-record', route: '#/w/sales/sales', pageId: 'sales', customerId: 'c1111111-1111-1111-1111-111111111111', w: 390, h: 844, theme: 'light', isMobile: true },
    { id: 'D003-customer-record', route: '#/w/sales/sales', pageId: 'sales', customerId: 'c1111111-1111-1111-1111-111111111111', w: 390, h: 844, theme: 'dark', isMobile: true },

    // HQ AI Agent Hub (H004)
    { id: 'H004-hq-agents', route: '#/p/saas-agents', pageId: 'saas-agents', w: 1440, h: 900, theme: 'light', isMobile: false, isHq: true },
    { id: 'H004-hq-agents', route: '#/p/saas-agents', pageId: 'saas-agents', w: 1440, h: 900, theme: 'dark', isMobile: false, isHq: true },
    { id: 'H004-hq-agents', route: '#/p/saas-agents', pageId: 'saas-agents', w: 390, h: 844, theme: 'light', isMobile: true, isHq: true },
    { id: 'H004-hq-agents', route: '#/p/saas-agents', pageId: 'saas-agents', w: 390, h: 844, theme: 'dark', isMobile: true, isHq: true },

    // Discoverability Intelligence Workspace (D016)
    { id: 'D016-discoverability', route: '#/p/discoverability', pageId: 'discoverability', w: 1440, h: 900, theme: 'light', isMobile: false },
    { id: 'D016-discoverability', route: '#/p/discoverability', pageId: 'discoverability', w: 1440, h: 900, theme: 'dark', isMobile: false },
    { id: 'D016-discoverability', route: '#/p/discoverability', pageId: 'discoverability', w: 390, h: 844, theme: 'light', isMobile: true },
    { id: 'D016-discoverability', route: '#/p/discoverability', pageId: 'discoverability', w: 390, h: 844, theme: 'dark', isMobile: true },

    // Login Surface (A001)
    { id: 'A001-login', isLogin: true, url: '/login.html', w: 1440, h: 900, theme: 'light', isMobile: false },
    { id: 'A001-login', isLogin: true, url: '/login.html', w: 1440, h: 900, theme: 'dark', isMobile: false },
    { id: 'A001-login', isLogin: true, url: '/login.html', w: 390, h: 844, theme: 'light', isMobile: true },
    { id: 'A001-login', isLogin: true, url: '/login.html', w: 390, h: 844, theme: 'dark', isMobile: true }
  ]

  for (const t of tasks) {
    const context = await browser.newContext({
      viewport: { width: t.w, height: t.h },
      isMobile: t.isMobile,
      deviceScaleFactor: 2
    })

    const page = await context.newPage()
    await setupPageRoutes(page)

    if (t.isLogin) {
      await page.goto(`${baseUrl}${t.url}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(400)
      await page.evaluate(({ theme }) => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }, { theme: t.theme })
      await page.waitForTimeout(300)
    } else {
      await page.addInitScript(({ themeVal, isHq }) => {
        window.API = '/api'
        window.__API_URL = '/api'

        const user = isHq ? {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'admin@marketsync.link',
          role: 'platform_owner',
          system_role: 'platform_owner',
          saas_role: 'owner',
          full_name: 'Jason Massie',
          dealership_name: 'MarketSync HQ'
        } : {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'sales@marketsync.link',
          role: 'owner_admin',
          full_name: 'Jason Massie',
          dealership_name: 'Apex Auto Gallery',
          dealership: {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Apex Auto Gallery',
            plan: 'dealeros_complete'
          }
        }

        localStorage.setItem('token', isHq ? 'mock-token-hq-admin' : 'mock-token-dealer-admin')
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.setItem('ms_remember_until', String(Date.now() + 86400000))
        localStorage.setItem('theme', themeVal)
        const todayStr = new Date().toISOString().split('T')[0]
        localStorage.setItem('ms_timeclock_prompt_date', todayStr)
        localStorage.setItem('ms_time_clock_state', JSON.stringify({ status: 'in', start_time: Date.now() }))
        localStorage.setItem('ms_timeclock_state', JSON.stringify({ status: 'in', start_time: Date.now() }))
        localStorage.setItem('shift_clock_dismissed', 'true')
        localStorage.setItem('ms_clock_dismissed_until', String(Date.now() + 86400000))
        localStorage.setItem('ms_shift_clock_state', JSON.stringify({ clocked_in: true, shift_id: 'sh1', start_time: new Date().toISOString() }))
      }, { themeVal: t.theme, isHq: !!t.isHq })

      await page.goto(`${baseUrl}/dashboard.html${t.route}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(600)

      await page.evaluate(async ({ targetPage, theme, customerId, isHq }) => {
        window.checkLoginPunchClockPrompt = () => {}
        if (isHq) {
          document.documentElement.setAttribute('data-dash-owner', '1')
          document.documentElement.setAttribute('data-dash-mode', 'marketsync')
        }

        // Dismiss any intrusive modal overlays during evidence capture
        document.querySelectorAll('#automation-modal, #automation-modal-backdrop, #punch-clock-modal, #shift-clock-modal, [data-modal="punch-clock"], .punch-clock-overlay, #modal-backdrop, .modal-backdrop').forEach(m => m.remove());

        if (typeof switchPage === 'function') switchPage(targetPage)
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }

        const banner = document.getElementById('dash-load-fail-banner')
        if (banner) banner.classList.add('hidden')

        if (typeof renderDeptNav === 'function') renderDeptNav()
        if (typeof applyMobileQuickRow === 'function') applyMobileQuickRow()
        if (typeof applyExtensionVisibility === 'function') applyExtensionVisibility()

        if (isHq && typeof loadHqAgents === 'function' && targetPage === 'saas-agents') {
          await loadHqAgents()
        }

        if (targetPage === 'discoverability' && typeof loadDiscoverabilityWorkspace === 'function') {
          await loadDiscoverabilityWorkspace()
        }

        if (customerId && typeof openCrmContact === 'function') {
          await openCrmContact(customerId)
        }

        document.querySelectorAll('#punch-clock-modal, #shift-clock-modal, [data-modal="punch-clock"], .punch-clock-overlay, #modal-backdrop, .modal-backdrop').forEach(m => m.remove());
      }, { targetPage: t.pageId, theme: t.theme, customerId: t.customerId, isHq: !!t.isHq })

      await page.waitForTimeout(800)
    }

    const screenshotName = `${t.id}-${t.w}-${t.theme}`
    const imgPath = path.join(EVIDENCE_DIR, `${screenshotName}.png`)
    const jsonPath = path.join(EVIDENCE_DIR, `${screenshotName}.json`)

    await page.screenshot({ path: imgPath, fullPage: false })

    const metadata = {
      name: screenshotName,
      w: t.w,
      h: t.h,
      theme: t.theme,
      route: t.route,
      pageId: t.pageId,
      hash: await page.evaluate(() => window.location.hash),
      timestamp: new Date().toISOString()
    }

    fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2))
    console.log(`Saved: ${screenshotName}.png & .json (Hash: ${metadata.hash})`)

    await context.close()
  }
}

async function main() {
  const { server, port } = await startStaticServer()
  const baseUrl = `http://127.0.0.1:${port}`

  const browser = await chromium.launch({ headless: true })

  try {
    await captureAll(browser, baseUrl)
  } finally {
    await browser.close()
    server.close()
    console.log('\nAll captures complete!')
  }
}

main().catch(err => {
  console.error('Fatal capture error:', err)
  process.exit(1)
})
