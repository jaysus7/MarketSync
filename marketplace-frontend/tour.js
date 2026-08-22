// tour.js — MarketSync in-app guided tour.
// A dependency-free spotlight walkthrough for the dashboard. Auto-runs once for
// new users (tracked in localStorage) and can be replayed from the "Tour" button.
// Steps target real dashboard elements when present and fall back to a centered
// card otherwise, so a missing/hidden element never breaks the tour.
(() => {
  const DONE_KEY = 'ms_tour_done';
  const PAD = 8;

  // Click a sidebar nav button to switch SPA pages before a step that needs it.
  const goPage = (page) => {
    const btn = document.querySelector(`#dashboard-nav [data-page="${page}"]`);
    if (btn) btn.click();
  };
  // Expand a collapsed left-nav group so its items are targetable.
  const openGroup = (id) => {
    document.getElementById('grp-' + id)?.classList.remove('hidden');
    document.getElementById('chev-' + id)?.classList.remove('-rotate-90');
  };

  const STEPS = [
    {
      target: null,
      title: ' Welcome — the full tour',
      body: `A quick guided walk through everything MarketSync does — from posting cars to closing deals, service, automation and your books. It'll move you between pages as it goes. Skip anytime, and replay it later from the <b>Tour</b> button.`
    },
    {
      target: '#dashboard-nav',
      title: 'Your control center',
      body: `Everything lives in this left menu — colour-coded by area and collapsed by default. Click a section name to open its page, or the arrow to expand its items. Your <b>Settings</b> are behind the gear icon, top-right.`
    },
    {
      target: '#feeds-panel',
      before: () => goPage('inventory'),
      title: 'Build your inventory',
      body: `Your inventory <b>auto-syncs</b> from your website feed or a CSV — year, make, model, price, mileage and photos — so you never re-type a car. Hit <b>Sync Now</b> to pull the latest; sold cars drop off automatically.`
    },
    {
      target: '#install-ext-btn',
      before: () => goPage('inventory'),
      title: 'Post to Facebook in seconds',
      body: `Install the <b>MarketSync</b> Chrome extension and sign in once. On Facebook, pick a car and click <b>Post</b> — it fills the whole Marketplace listing. Mark a car <b>Sold</b> and it clears the Facebook listing for you too.`
    },
    {
      target: '#nav-inv-intel',
      before: () => { openGroup('ii'); },
      title: 'Inventory Intelligence — the price brain',
      body: `Know the live market price of every car. <b>Scan</b> your whole lot for mispriced units (red flags), see <b>hot/cold</b> tags and <b>days-to-sell</b>, decode any VIN, and pull factory window stickers &amp; Carfax. <span style="opacity:.8">(Paid add-on / free trial.)</span>`
    },
    {
      target: null,
      title: 'AI does the busywork',
      body: `<b>AI Boost</b> writes your listings, scores your photos (0–100) and picks the best cover, drafts replies to shopper leads, and can chat with customers on your website all night — every  button across the app. You set its name and tone in Settings.`
    },
    {
      target: '#dashboard-nav [data-page="crm"]',
      before: () => { openGroup('crm'); goPage('crm'); },
      title: 'CRM — every customer, one card',
      body: `Leads, appointments, tasks and full history live on one record per person. Each customer moves along a pipeline — <b>Uncontacted → Contacted → Appointment → Sold → Delivered</b> — and auto follow-up tasks keep anyone from slipping.`
    },
    {
      target: '#idscan-btn',
      // Add customer lives in the header menu now, so open it before pointing at it.
      before: () => { try { msToggleShellMenu(true); } catch {} },
      title: 'Add a customer by scanning their licence',
      body: `Open the <b>menu</b> at the top right and tap <b>Add customer</b> to scan a driver's licence — it fills in the name, address and details for you. You can also run a full ID + selfie verification from the customer's record.`
    },
    {
      target: '#header-desk-btn',
      title: 'Desk a deal',
      body: `Build the whole deal — vehicle, trade (tax on the difference), fees, add-ons, F&amp;I, tax and monthly payment. Print an <b>estimate</b> or <b>bill of sale</b>, or <b>send it for e-signature</b>. Then one button — <b>Delivered</b> — updates the customer, the car, the books and the rep's commission.`
    },
    {
      target: '#dashboard-nav [data-page="service-appointments"]',
      before: () => { openGroup('service'); goPage('service-appointments'); },
      title: 'Service keeps them for years',
      body: `Book oil changes, tires and repairs against the <b>same customer record</b> as their purchase — calendar or list. <b>Equity Mining</b> here flags past buyers ready to trade up: the easiest next sale.`
    },
    {
      target: '#dashboard-nav [data-page="automation-builder"]',
      before: () => { openGroup('auto'); goPage('automation-builder'); },
      title: 'Automation that never sleeps',
      body: `Set up follow-up <b>touches</b> once and they fire by themselves — new-lead chases, delivery thank-you + review &amp; referral asks, and holiday/birthday notes. Flip <b>Engine on</b> and it runs for years.`
    },
    {
      target: '#dashboard-nav [data-page="website"]',
      before: () => { openGroup('web'); goPage('website'); },
      title: 'Your dealer website',
      body: `A drag-and-drop builder made of <b>blocks</b> — hero, featured inventory, specials, reviews, payment calculator and more. Your synced stock and an AI chat appear automatically. Set your colours and hit <b>Publish</b>.`
    },
    {
      target: '#nav-reports',
      before: () => goPage('reports'),
      title: 'Reports & the Executive summary',
      body: `Managers get a deep report for every area plus a one-screen <b>Executive summary</b> — revenue, lead speed, conversion and <b>sales by salesperson</b> — for any date range, exportable to CSV.`
    },
    {
      target: '#grp-accounting-wrap',
      before: () => { openGroup('accounting'); },
      title: 'Accounting — mostly automatic',
      body: `Delivered deals, F&amp;I, tax and deposits <b>post themselves</b> to the ledger; your team only types in expenses. Each day the books check themselves (and email you if something's off), with tax and CSV reports built in.`
    },
    {
      target: '#nav-commissions',
      title: 'Commissions, calculated for you',
      body: `Pay plans (% of gross, flat, or greater-of), F&amp;I pay and split deals are computed automatically the moment a deal is delivered — reps watch their pay build on <b>My commission</b>; managers see the whole team.`
    },
    {
      target: '#header-settings',
      title: 'Settings & features',
      body: `The gear icon opens <b>Settings</b> — team, branding, billing &amp; add-ons, AI voice, integrations and security, all in tabs. Under <b>Dealer Management → Features</b> you can turn any paid area on or off store-wide.`
    },
    {
      target: null,
      title: " That's the whole platform",
      body: `Replay this tour anytime from the <b>Tour</b> button, and open the <a href="/guide.html" target="_blank" rel="noopener">full step-by-step guide</a> for screen-by-screen detail on any feature. Happy selling!`
    }
  ];

  // Short, area-specific tours — one per Setup step. Each is launched from the
  // Setup Center's "Show me" button (window.startAreaTour), so every spot gives a
  // guided look AND its setup form.
  const AREA_TOURS = {
    command: [
      { target: '#dashboard-nav [data-page="command"]', before: () => goPage('command'), title: '1. Executive Overview', body: `Start on the <b>Left</b> with your real-time revenue, leads, and store velocity metrics.` },
      { target: '[data-page-content="command"]', before: () => goPage('command'), title: '2. Operational Flow', body: `Monitor department health across sales, inventory, service, and team performance.` },
      { target: '#header-desk-btn', title: '3. Quick Action Launchpad', body: `Desk a deal or appraise a vehicle right from the header. Everything else — add a customer, post to Facebook, upgrades, settings — is under the menu beside the bell.` }
    ],
    inventory: [
      { target: '#feeds-panel', before: () => goPage('inventory'), title: '1. Ingest Inventory (Left)', body: `Your inventory <b>auto-syncs</b> from your website feed or CSV. Hit <b>Sync Now</b> to pull latest units.` },
      { target: '#inventory-table', before: () => goPage('inventory'), title: '2. Manage Stock (Center)', body: `Review photos, edit pricing, AI listing copy, and mark units as active or pending.` },
      { target: '#install-ext-btn', before: () => goPage('inventory'), title: '3. Market Execution (Right)', body: `Click <b>Post to Facebook</b> to push listings to Facebook Marketplace in seconds.` }
    ],
    'inv-intel': [
      { target: '#nav-inv-intel', before: () => { openGroup('ii'); goPage('inv-intel'); }, title: '1. Intelligence Scan (Left)', body: `Scan your entire lot for mispriced units, market flags, and days-on-lot alerts.` },
      { target: '[data-page-content="inv-intel"]', before: () => goPage('inv-intel'), title: '2. Market Pricing (Center)', body: `Analyze real-time regional vehicle price distribution and competitive positioning.` },
      { target: '#nav-vin-sticker', before: () => goPage('vin-sticker'), title: '3. Assets & Stickers (Right)', body: `Generate factory VIN decodes, window stickers, and 2-page AI vehicle brochures.` }
    ],
    market: [
      { target: '[data-page-content="market"]', before: () => { openGroup('ii'); goPage('market'); }, title: '1. Competitor Lot Scan (Left)', body: `Track competitor dealership listings, price changes, and new arrivals.` },
      { target: '[data-page-content="market"]', before: () => goPage('market'), title: '2. Radius Boundary (Center)', body: `Set your regional competitive radius to compare price positioning.` },
      { target: '[data-page-content="market"]', before: () => goPage('market'), title: '3. Under-cut Alerts (Right)', body: `Get notified whenever a competitor drops price on a matching unit!` }
    ],
    crm: [
      { target: '#dashboard-nav [data-page="crm"]', before: () => { openGroup('crm'); goPage('crm'); }, title: '1. Lead Ingestion (Left)', body: `All shopper leads from Facebook, Website AI Chat, and phone calls land directly here.` },
      { target: '[data-page-content="crm"]', before: () => goPage('crm'), title: '2. Pipeline & Touchpoints (Center)', body: `Drag customers through stages: <b>Uncontacted → Contacted → Appointment → Sold</b>.` },
      { target: '#idscan-btn', before: () => { try { msToggleShellMenu(true); } catch {} }, title: '3. Customer Verification', body: `<b>Add customer</b> in the header menu scans driver's licences to instant-populate customer profiles and run ID verifications.` }
    ],
    sales: [
      { target: '#header-desk-btn', before: () => goPage('desk'), title: '1. Vehicle & Trade Input (Left)', body: `Select the vehicle, trade-in, pay-off, and customer details on the deal desk.` },
      { target: '[data-page-content="desk"]', before: () => goPage('desk'), title: '2. Deal Structuring (Center)', body: `Calculate tax, backend F&I products, lender rates, and monthly payment options.` },
      { target: '[data-page-content="desk"]', before: () => goPage('desk'), title: '3. Contract & Delivery (Right)', body: `Print Buyers Order, Bill of Sale, e-Sign contracts, and mark deal as <b>Delivered</b>!` }
    ],
    appraisal: [
      { target: '[data-page-content="appraisal"]', before: () => { openGroup('sales'); goPage('appraisal'); }, title: '1. VIN Scanner & Specs (Left)', body: `Decode VIN, pull specs, options, and recall history in one click.` },
      { target: '[data-page-content="appraisal"]', before: () => goPage('appraisal'), title: '2. Recon & Target Gross (Center)', body: `Set reconditioning estimates and target front-end gross profit.` },
      { target: '[data-page-content="appraisal"]', before: () => goPage('appraisal'), title: '3. Market Offer Capping (Right)', body: `Calculate suggested trade-in offer capped by live market book value.` }
    ],
    equity: [
      { target: '[data-page-content="equity"]', before: () => { openGroup('sales'); goPage('equity'); }, title: '1. Database Scanner (Left)', body: `Scan CRM and Service records for customers in a positive equity position.` },
      { target: '[data-page-content="equity"]', before: () => goPage('equity'), title: '2. Trade-Up Parity (Center)', body: `Match customers into new vehicles with equal or lower monthly payments.` },
      { target: '[data-page-content="equity"]', before: () => goPage('equity'), title: '3. VIP Invitation (Right)', body: `Trigger automated trade-up SMS and Email campaign invites!` }
    ],
    delivery: [
      { target: '[data-page-content="delivery"]', before: () => goPage('delivery'), title: '1. Sold Queue (Left)', body: `Monitor pending customer deliveries and vehicle holds.` },
      { target: '[data-page-content="delivery"]', before: () => goPage('delivery'), title: '2. Detail Checklist (Center)', body: `Verify pre-delivery wash, detail, and accessory installation.` },
      { target: '[data-page-content="delivery"]', before: () => goPage('delivery'), title: '3. Key Handover & Review (Right)', body: `Hand over keys, complete digital signatures, and trigger Google Review request!` }
    ],
    'fni-worklist': [
      { target: '[data-page-content="fni"]', before: () => { openGroup('sales'); goPage('fni'); }, title: '1. Credit Application (Left)', body: `Capture customer income, employment, and credit application details.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '2. Lender Routing (Center)', body: `Submit applications directly to prime and subprime lender portals.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '3. F&I Menu Presentation (Right)', body: `Present warranties, GAP insurance, and chemical protection menus.` }
    ],
    'fni-esignatures': [
      { target: '[data-page-content="fni"]', before: () => { openGroup('sales'); goPage('fni'); }, title: '1. Document Prep (Left)', body: `Generate Buyers Order, Bill of Sale, and disclosure forms.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '2. Remote Signing (Center)', body: `Send secure e-sign link via SMS or sign live on tablet.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '3. Digital Archive (Right)', body: `Archive signed tamper-proof PDFs in the digital deal jacket.` }
    ],
    web: [
      { target: '#dashboard-nav [data-page="website"]', before: () => { openGroup('web'); goPage('website'); }, title: '1. Structure & Hero (Left)', body: `Choose your layout blocks, hero banners, and featured vehicle showcases.` },
      { target: '[data-page-content="website"]', before: () => goPage('website'), title: '2. Content & AI Chat (Center)', body: `Configure colors, logo, and turn on the 24/7 AI Sales Assistant widget.` },
      { target: '#dashboard-nav [data-page="website"]', before: () => goPage('website'), title: '3. Custom Domain & Launch (Right)', body: `Connect your domain name, SSL certificate, and hit <b>Publish Site</b>!` }
    ],
    'ai-inbox': [
      { target: '#dashboard-nav [data-page="ai-inbox"]', before: () => goPage('ai-inbox'), title: '1. Multi-Channel Inbox (Left)', body: `View inbound shopper conversations from Facebook Messenger, SMS, and Web Chat.` },
      { target: '[data-page-content="ai-inbox"]', before: () => goPage('ai-inbox'), title: '2. AI Copilot (Center)', body: `Let AI Boost draft intelligent replies, answer vehicle specs, and qualify buyers.` },
      { target: '[data-page-content="ai-inbox"]', before: () => goPage('ai-inbox'), title: '3. Hand-off & Booking (Right)', body: `Book test drives directly to your sales calendar with one click.` }
    ],
    service: [
      { target: '#dashboard-nav [data-page="service-appointments"]', before: () => { openGroup('service'); goPage('service-appointments'); }, title: '1. Service Intake (Left)', body: `Schedule repair orders, oil changes, and maintenance against existing customer records.` },
      { target: '[data-page-content="service-appointments"]', before: () => goPage('service-appointments'), title: '2. Repair Dispatch (Center)', body: `Track open repair orders, parts requisitions, and technician status.` },
      { target: '#dashboard-nav [data-page="equity"]', before: () => { openGroup('sales'); goPage('equity'); }, title: '3. Equity Mining (Right)', body: `Identify service customers with high equity ready to trade up into new vehicles!` }
    ],
    'service-parts': [
      { target: '[data-page-content="service-parts"]', before: () => { openGroup('service'); goPage('service-parts'); }, title: '1. Parts Catalog (Left)', body: `Manage OEM and aftermarket parts numbers and inventory counts.` },
      { target: '[data-page-content="service-parts"]', before: () => goPage('service-parts'), title: '2. Reorder Thresholds (Center)', body: `Set automatic reorder alerts for fast-moving maintenance items.` },
      { target: '[data-page-content="service-parts"]', before: () => goPage('service-parts'), title: '3. RO Requisitions (Right)', body: `Bill parts directly to active Repair Orders.` }
    ],
    recon: [
      { target: '[data-page-content="recon"]', before: () => { openGroup('sales'); goPage('recon'); }, title: '1. Recon Intake Queue (Left)', body: `Log newly acquired trades into the detail and wash queue.` },
      { target: '[data-page-content="recon"]', before: () => goPage('recon'), title: '2. Wash & Photo (Center)', body: `Complete 360 photo booth capture and interior detailing.` },
      { target: '[data-page-content="recon"]', before: () => goPage('recon'), title: '3. Lot Release (Right)', body: `Mark vehicle Ready for Sale to release it to live inventory.` }
    ],
    accounting: [
      { target: '#grp-accounting-wrap', before: () => { openGroup('accounting'); goPage('accounting'); }, title: '1. Ledger Ingestion (Left)', body: `Delivered deals, trade-ins, and F&I profits automatically post to your general ledger.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('accounting'), title: '2. Expenses & Payroll (Center)', body: `Log vendor invoices, inventory pack, and automatically computed rep commissions.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('accounting'), title: '3. Tax & Daily Recon (Right)', body: `Run automated daily reconciliation and export tax reports in one click.` }
    ],
    'acct-tax': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-tax'); }, title: '1. Sales Tax Rates (Left)', body: `Configure regional sales tax rates (HST / PST / GST / State Tax).` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-tax'), title: '2. Tax Registration # (Center)', body: `Enter official Tax Registration ID for invoice printing.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-tax'), title: '3. Accountant Export (Right)', body: `Automate monthly tax report export to your CPA.` }
    ],
    'acct-recon': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-recon'); }, title: '1. Bank Statement Feed (Left)', body: `Sync daily bank transaction feeds.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-recon'), title: '2. Deposit Auto-Match (Center)', body: `Auto-match bank deposits against delivered deal receipts.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-recon'), title: '3. Exception Clearing (Right)', body: `Clear fee variances and outstanding deposits.` }
    ],
    reports: [
      { target: '#nav-reports', before: () => goPage('reports'), title: '1. Filter & Date Selector (Left)', body: `Choose date ranges, store locations, or individual sales reps.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '2. Executive Summary (Center)', body: `Analyze gross profit, lead velocity, conversion rates, and ROI per channel.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '3. Export & Schedule (Right)', body: `Export CSV reports or schedule weekly executive email summaries to leadership.` }
    ],
    operations: [
      { target: '#dashboard-nav [data-page="operations"]', before: () => goPage('operations'), title: '1. Store Operations (Left)', body: `Manage store schedules, vendor logins, and departmental compliance.` },
      { target: '#dashboard-nav [data-page="taskboard"]', before: () => goPage('taskboard'), title: '2. Task Kanban (Center)', body: `Assign, track, and complete tasks across sales, recon, and detail.` },
      { target: '[data-page-content="operations"]', before: () => goPage('operations'), title: '3. Audit Trail (Right)', body: `Monitor full system security logs and user activity.` }
    ],
    auto: [
      { target: '#dashboard-nav [data-page="automation-builder"]', before: () => { openGroup('auto'); goPage('automation-builder'); }, title: '1. Trigger Selection (Left)', body: `Pick automated triggers: New Lead, Uncontacted 24h, Post-Delivery, Holiday, Birthday.` },
      { target: '[data-page-content="automation-builder"]', before: () => goPage('automation-builder'), title: '2. Drip Sequence Builder (Center)', body: `Craft SMS and email sequences with personalization tags like {first_name} and {vehicle}.` },
      { target: '[data-page-content="automation-builder"]', before: () => goPage('automation-builder'), title: '3. Engine Control (Right)', body: `Toggle <b>Engine ON</b> and let MarketSync follow up 24/7/365 automatically!` }
    ],
    'email-campaigns': [
      { target: '#dashboard-nav [data-page="email-campaigns"]', before: () => goPage('email-campaigns'), title: '1. Audience Targeting (Left)', body: `Select audience segments: Active Shoppers, Past Buyers, Aged Leads, or Service Customers.` },
      { target: '[data-page-content="email-campaigns"]', before: () => goPage('email-campaigns'), title: '2. Email Composer (Center)', body: `Design responsive vehicle show-case emails using AI copy and inventory cards.` },
      { target: '[data-page-content="email-campaigns"]', before: () => goPage('email-campaigns'), title: '3. Broadcast & ROI Analytics (Right)', body: `Send or schedule broadcasts and track real-time open rates, clicks, and vehicle sales!` }
    ],
    academy: [
      { target: '#dashboard-nav [data-page="academy"]', before: () => goPage('academy'), title: '1. Course Dashboard (Left)', body: `Explore MarketSync masterclasses with live completion progress bars.` },
      { target: '[data-page-content="academy"]', before: () => goPage('academy'), title: '2. Interactive Class Player (Center)', body: `Watch video lessons, read step-by-step guides, and track your progress.` },
      { target: '[data-page-content="academy"]', before: () => goPage('academy'), title: '3. Printable Certificates & LinkedIn (Right)', body: `Earn official certifications, print diploma PDFs, and add credentials to your LinkedIn profile!` }
    ],
    config: [
      { target: '[data-page-content="config"]', before: () => goPage('config'), title: '1. Feature Flags (Left)', body: `Toggle system-wide feature flags and operational rules.` },
      { target: '[data-page-content="config"]', before: () => goPage('config'), title: '2. Timeout & Retry Policy (Center)', body: `Configure API call timeout limits and background retry policies.` },
      { target: '[data-page-content="config"]', before: () => goPage('config'), title: '3. Engine Health (Right)', body: `Monitor background task execution and database sync queues.` }
    ],
    'api-keys': [
      { target: '[data-page-content="api-keys"]', before: () => goPage('api-keys'), title: '1. REST API Keys (Left)', body: `Generate API tokens for custom DMS, CRM, and inventory integrations.` },
      { target: '[data-page-content="api-keys"]', before: () => goPage('api-keys'), title: '2. Webhook Callbacks (Center)', body: `Subscribe to real-time events for new leads, deal deliveries, and inventory changes.` },
      { target: '[data-page-content="api-keys"]', before: () => goPage('api-keys'), title: '3. MCP Server Connections (Right)', body: `Connect Model Context Protocol (MCP) servers for AI copilot tool expansion.` }
    ],
    'crm-appointments': [
      { target: '[data-page-content="crm"]', before: () => { openGroup('crm'); goPage('appointments'); }, title: '1. Calendar View (Left)', body: `View scheduled test drives and sales appointments.` },
      { target: '[data-page-content="crm"]', before: () => goPage('appointments'), title: '2. SMS Reminders (Center)', body: `Automate 24-hour and 2-hour pre-appointment customer SMS text reminders.` },
      { target: '[data-page-content="crm"]', before: () => goPage('appointments'), title: '3. Show Rate Analytics (Right)', body: `Track customer appointment show rates and conversion to sold deals!` }
    ],
    'crm-tasks': [
      { target: '[data-page-content="crm"]', before: () => { openGroup('crm'); goPage('tasks'); }, title: '1. Task Agenda (Left)', body: `Prioritize daily rep phone calls, emails, and follow-up activities.` },
      { target: '[data-page-content="crm"]', before: () => goPage('tasks'), title: '2. Auto-Task Engine (Center)', body: `Tasks are auto-created when new leads arrive from Facebook or Website.` },
      { target: '[data-page-content="crm"]', before: () => goPage('tasks'), title: '3. Overdue Escalations (Right)', body: `Overdue follow-ups automatically alert sales managers for review.` }
    ],
    'crm-opps': [
      { target: '[data-page-content="crm"]', before: () => { openGroup('crm'); goPage('crm'); }, title: '1. Opportunities Pipeline (Left)', body: `Drag deal cards through pipeline stages from Lead to Delivered.` },
      { target: '[data-page-content="crm"]', before: () => goPage('crm'), title: '2. Rotting Alerts (Center)', body: `Stale deals inactive over 48h are automatically highlighted.` },
      { target: '[data-page-content="crm"]', before: () => goPage('crm'), title: '3. Forecast Revenue (Right)', body: `Project monthly front and back-end gross profit based on win probability.` }
    ],
    'sales-reports': [
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '1. Gross Profit Reports (Left)', body: `Analyze total front-end and back-end gross revenue by sales rep.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '2. Conversion Funnel (Center)', body: `Track lead-to-appointment and appointment-to-sale conversion rates.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '3. Executive Email Digest (Right)', body: `Automate weekly PDF & CSV report digests sent to dealership leadership.` }
    ],
    'fni-reports': [
      { target: '[data-page-content="fni"]', before: () => { openGroup('sales'); goPage('fni'); }, title: '1. PVR Benchmarks (Left)', body: `Track Per Vehicle Retail (PVR) back-end gross profit per deal.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '2. Product Penetration (Center)', body: `Monitor warranty, GAP, tire & wheel, and chemical protection percentages.` },
      { target: '[data-page-content="fni"]', before: () => goPage('fni'), title: '3. Lender Approval Mix (Right)', body: `Analyze lender approval rates and funded contract distribution.` }
    ],
    'service-appointments': [
      { target: '[data-page-content="service-appointments"]', before: () => { openGroup('service'); goPage('service-appointments'); }, title: '1. Service Intake (Left)', body: `Schedule repair orders and maintenance appointments.` },
      { target: '[data-page-content="service-appointments"]', before: () => goPage('service-appointments'), title: '2. Shop Capacity (Center)', body: `Set maximum daily shop labor hour capacity.` },
      { target: '[data-page-content="service-appointments"]', before: () => goPage('service-appointments'), title: '3. Automated Reminders (Right)', body: `Send appointment confirmation and SMS text reminders to customers.` }
    ],
    'acct-insights': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-insights'); }, title: '1. P&L Net Margin (Left)', body: `Track real-time store net profit margin and contribution.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-insights'), title: '2. Department Contribution (Center)', body: `Break down profit contribution across Sales, F&I, Service, and Parts.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-insights'), title: '3. Overhead Cap Warning (Right)', body: `Receive alerts when store overhead exceeds budgeted limits.` }
    ],
    'acct-bank': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-bank'); }, title: '1. Operating Accounts (Left)', body: `Manage operating, payroll, and floorplan bank accounts.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-bank'), title: '2. Transit Routing (Center)', body: `Set up bank transit, institution, and account routing numbers.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-bank'), title: '3. Bank Feed Connection (Right)', body: `Connect daily bank feeds for automatic transaction reconciliation.` }
    ],
    'acct-expenses': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-expenses'); }, title: '1. Expense Categories (Left)', body: `Track vendor, advertising, pack, and floorplan interest expenses.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-expenses'), title: '2. Approval Limits (Center)', body: `Set purchase order and manager expense approval caps.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-expenses'), title: '3. Invoice OCR (Right)', body: `Scan vendor invoices for automated general ledger posting.` }
    ],
    'acct-budget': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-budget'); }, title: '1. Budget Allocation (Left)', body: `Allocate monthly budgets for Marketing, Personnel, and Facilities.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-budget'), title: '2. Spend vs Budget (Center)', body: `Compare real-time department spend against allocated budget.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-budget'), title: '3. Budget Overrun Alert (Right)', body: `Get notified when department spend reaches 90% of budget cap.` }
    ],
    'acct-reports': [
      { target: '[data-page-content="accounting"]', before: () => { openGroup('accounting'); goPage('acct-reports'); }, title: '1. Fiscal Period Setup (Left)', body: `Configure fiscal year start month and accounting periods.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-reports'), title: '2. Financial Statements (Center)', body: `Generate Income Statements, Balance Sheets, and Trial Balances.` },
      { target: '[data-page-content="accounting"]', before: () => goPage('acct-reports'), title: '3. CPA Export (Right)', body: `Export transaction ledgers directly to QuickBooks, CSV, or Excel.` }
    ],
    'facebook-autoposter': [
      { target: '#install-ext-btn', before: () => goPage('inventory'), title: '1. Extension Sync (Left)', body: `Connect MarketSync Chrome Extension for 1-click posting.` },
      { target: '[data-page-content="inventory"]', before: () => goPage('inventory'), title: '2. Listing Template (Center)', body: `Format AI-generated vehicle descriptions and photo sequence.` },
      { target: '#install-ext-btn', before: () => goPage('inventory'), title: '3. 1-Click Post (Right)', body: `Push inventory listings to Facebook Marketplace in seconds!` }
    ],
    'ai-chatbot': [
      { target: '[data-page-content="website"]', before: () => { openGroup('web'); goPage('website'); }, title: '1. Embed Widget (Left)', body: `Embed 24/7 AI chat assistant widget on your website.` },
      { target: '[data-page-content="website"]', before: () => goPage('website'), title: '2. Knowledge Base (Center)', body: `Train AI on inventory specs, financing, location, and store hours.` },
      { target: '[data-page-content="website"]', before: () => goPage('website'), title: '3. Test Drive Booking (Right)', body: `AI automatically qualifies leads and schedules test drives on your calendar.` }
    ],
    leaderboard: [
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '1. Points Rules (Left)', body: `Award points for units sold, test drives, and customer reviews.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '2. Showroom TV Display (Center)', body: `Launch full-screen leaderboard for live showroom TV displays.` },
      { target: '[data-page-content="reports"]', before: () => goPage('reports'), title: '3. Rep Rewards (Right)', body: `Track monthly rep rankings and bonus reward payouts.` }
    ],
    taskboard: [
      { target: '[data-page-content="taskboard"]', before: () => goPage('taskboard'), title: '1. Kanban Columns (Left)', body: `Organize tasks: To Do, In Progress, Review, Completed.` },
      { target: '[data-page-content="taskboard"]', before: () => goPage('taskboard'), title: '2. Team Assignments (Center)', body: `Assign tasks to sales reps, detailers, and transport drivers.` },
      { target: '[data-page-content="taskboard"]', before: () => goPage('taskboard'), title: '3. Priority Badges (Right)', body: `Highlight urgent tasks with priority escalation badges.` }
    ]
  };

  let idx = 0;
  let activeSteps = STEPS;   // the full tour by default; area tours swap this in
  let isFullTour = true;     // only the full tour records "seen" so it stops auto-running
  let els = null;
  let reposition = null;   // active scroll/resize handler for the current step
  let roObserver = null;   // ResizeObserver that repositions when the target resizes
  let renderToken = 0;     // guards against a stale async render repositioning

  function buildUI() {
    if (els) return els;
    const css = document.createElement('style');
    css.textContent = `
      .ms-tour-backdrop{position:fixed;inset:0;z-index:99998;pointer-events:auto;}
      .ms-tour-hole{position:fixed;z-index:99998;border-radius:10px;
        box-shadow:0 0 0 9999px rgba(15,23,42,0.72);transition:top .2s ease,left .2s ease,width .2s ease,height .2s ease,opacity .2s ease;pointer-events:none;}
      .ms-tour-card{position:fixed;z-index:100000;max-width:400px;width:calc(100vw - 32px);
        background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:14px;
        padding:22px 22px 16px;box-shadow:0 20px 50px rgba(0,0,0,.5);
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .ms-tour-card h3{margin:0 0 10px;font-size:21px;font-weight:800;color:#fff;line-height:1.25;}
      .ms-tour-card p{margin:0 0 18px;font-size:16px;line-height:1.6;color:#cbd5e1;}
      .ms-tour-card b{color:#fff;}
      .ms-tour-card a{color:#a5b4fc;text-decoration:underline;font-weight:700;}
      .ms-tour-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .ms-tour-dots{display:flex;gap:6px;margin-bottom:14px;}
      .ms-tour-dot{width:7px;height:7px;border-radius:99px;background:#334155;}
      .ms-tour-dot.on{background:#6366f1;}
      .ms-tour-dontshow{display:flex;align-items:center;gap:6px;font-size:13px;color:#94a3b8;cursor:pointer;user-select:none;margin-bottom:12px;}
      .ms-tour-dontshow input{accent-color:#6366f1;width:15px;height:15px;cursor:pointer;margin:0;}
      .ms-tour-btns{display:flex;gap:8px;}
      .ms-tour-btn{border:none;cursor:pointer;font-size:15px;font-weight:700;padding:9px 18px;border-radius:9px;}
      .ms-tour-next{background:#6366f1;color:#fff;}
      .ms-tour-next:hover{background:#4f46e5;}
      .ms-tour-back{background:#1e293b;color:#cbd5e1;}
      .ms-tour-skip{position:absolute;top:12px;right:16px;background:none;border:none;color:#64748b;
        font-size:22px;cursor:pointer;line-height:1;}
      .ms-tour-skip:hover{color:#cbd5e1;}
    `;
    document.head.appendChild(css);

    const backdrop = document.createElement('div');
    backdrop.className = 'ms-tour-backdrop';
    const hole = document.createElement('div');
    hole.className = 'ms-tour-hole';
    const card = document.createElement('div');
    card.className = 'ms-tour-card';
    card.innerHTML = `
      <button class="ms-tour-skip" aria-label="Close tour">×</button>
      <h3></h3><p></p>
      <div class="ms-tour-dots"></div>
      <label class="ms-tour-dontshow" id="ms-tour-dontshow-row" style="display:none">
        <input type="checkbox" id="ms-tour-dontshow-chk">
        Don't show this again
      </label>
      <div class="ms-tour-foot">
        <div></div>
        <div class="ms-tour-btns">
          <button class="ms-tour-btn ms-tour-back">Back</button>
          <button class="ms-tour-btn ms-tour-next">Next</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    document.body.appendChild(hole);
    document.body.appendChild(card);

    card.querySelector('.ms-tour-skip').onclick = () => {
      const chk = document.getElementById('ms-tour-dontshow-chk');
      if (chk?.checked) { try { localStorage.setItem(DONE_KEY, '1'); } catch {} }
      end();
    };
    backdrop.onclick = end;
    card.querySelector('.ms-tour-back').onclick = () => { if (idx > 0) { idx--; render(); } };
    card.querySelector('.ms-tour-next').onclick = () => {
      const chk = document.getElementById('ms-tour-dontshow-chk');
      if (chk?.checked) { try { localStorage.setItem(DONE_KEY, '1'); } catch {} end(); return; }
      idx < activeSteps.length - 1 ? (idx++, render()) : end();
    };

    els = { backdrop, hole, card };
    return els;
  }

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  // Poll for the target to become laid-out & visible (it may be on a not-yet-shown
  // SPA page that step.before() just switched to).
  const waitForVisible = (selector, timeout) => new Promise((resolve) => {
    const start = Date.now();
    (function poll() {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return resolve(el);
      if (Date.now() - start > timeout) return resolve(el && isVisible(el) ? el : null);
      setTimeout(poll, 60);
    })();
  });

  function detachReposition() {
    if (reposition) {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      reposition = null;
    }
    if (roObserver) { roObserver.disconnect(); roObserver = null; }
  }

  async function render() {
    const { hole, card } = buildUI();
    const step = activeSteps[idx];
    const token = ++renderToken;
    detachReposition();

    // Hide the old spotlight immediately so it never lingers on the previous
    // target while we locate the new one (that caused the "jumps to two spots").
    hole.style.opacity = '0';
    hole.style.pointerEvents = 'none';

    if (step.before) { try { step.before(); } catch {} }

    // Fill text + chrome immediately so the card never looks frozen.
    card.querySelector('h3').innerHTML = step.title;
    card.querySelector('p').innerHTML = step.body;
    card.querySelector('.ms-tour-dots').innerHTML =
      activeSteps.map((_, i) => `<span class="ms-tour-dot ${i === idx ? 'on' : ''}"></span>`).join('');
    card.querySelector('.ms-tour-back').style.visibility = idx === 0 ? 'hidden' : 'visible';
    card.querySelector('.ms-tour-next').textContent = idx === activeSteps.length - 1 ? 'Finish' : 'Next';
    const dontShowRow = card.querySelector('#ms-tour-dontshow-row');
    if (dontShowRow) dontShowRow.style.display = (idx === 0 && isFullTour) ? 'flex' : 'none';

    let target = null;
    if (step.target) target = await waitForVisible(step.target, step.before ? 2200 : 1200);
    if (token !== renderToken) return;   // user advanced while we were waiting

    if (target) {
      // Instant scroll (no smooth-scroll race), then a brief settle, then reveal
      // the spotlight directly on the final position so it never visibly jumps.
      target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
      await new Promise(r => setTimeout(r, 220));
      if (token !== renderToken) return;
      positionTo(target);
      reposition = () => { if (token === renderToken) positionTo(target); };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      // Reposition only when the target's box actually changes (e.g. catalog
      // images finish loading) — no blind interval, so no drifting.
      if (window.ResizeObserver) {
        roObserver = new ResizeObserver(() => reposition());
        try { roObserver.observe(target); } catch {}
      }
    } else {
      hole.style.opacity = '0';
      hole.style.width = hole.style.height = '0px';
      centerCard();
    }

    if (idx === activeSteps.length - 1) setTimeout(() => { if (token === renderToken) fireConfetti(); }, 250);
  }

  function positionTo(target) {
    const { hole, card } = els;
    if (!isVisible(target)) { hole.style.opacity = '0'; centerCard(); return; }
    const r = target.getBoundingClientRect();
    hole.style.opacity = '1';
    hole.style.top = (r.top - PAD) + 'px';
    hole.style.left = (r.left - PAD) + 'px';
    hole.style.width = (r.width + PAD * 2) + 'px';
    hole.style.height = (r.height + PAD * 2) + 'px';

    const cw = card.offsetWidth, ch = card.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = r.bottom + 14, left = r.left;
    if (top + ch > vh - 12) top = r.top - ch - 14;          // flip above
    if (top < 12) top = Math.max(12, (vh - ch) / 2);        // last resort: vertical center
    left = Math.min(Math.max(12, left), vw - cw - 12);
    card.style.top = top + 'px';
    card.style.left = left + 'px';
    card.style.transform = 'none';
  }

  function centerCard() {
    const { card } = els;
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%,-50%)';
  }

  // Self-contained confetti — real popping burst, rendered ON TOP of everything.
  // Two side cannons fire inward/upward (party-popper style) plus a center pop.
  function fireConfetti() {
    const canvas = document.createElement('canvas');
    // Above the card (100000) so it visibly pops in front, not behind the modal.
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:100002;pointer-events:none;';
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#a855f7', '#fff'];
    const parts = [];
    const burst = (ox, oy, angle, count, power) => {
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * 0.9;     // spread cone
        const speed = power * (0.55 + Math.random() * 0.7);
        parts.push({
          x: ox, y: oy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          w: 7 + Math.random() * 7,
          h: 9 + Math.random() * 9,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.5,
          color: colors[(Math.random() * colors.length) | 0],
          round: Math.random() < 0.3
        });
      }
    };
    // Two corner cannons aiming up-and-inward + a center pop upward.
    burst(0, H, -Math.PI / 3.2, 120, 26);              // bottom-left → up-right
    burst(W, H, -Math.PI + Math.PI / 3.2, 120, 26);    // bottom-right → up-left
    burst(W / 2, H * 0.62, -Math.PI / 2, 90, 22);      // center → straight up

    const start = Date.now();
    (function frame() {
      const t = Date.now() - start;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      parts.forEach(p => {
        p.vy += 0.42;        // gravity
        p.vx *= 0.992;
        p.vy *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        const alpha = Math.max(0, 1 - t / 3200);
        if (alpha <= 0 || p.y > H + 40) return;
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 3200 && alive > 0) requestAnimationFrame(frame);
      else canvas.remove();
    })();
  }

  // start() runs the full tour. start(stepsArray) runs a short area tour. The header
  // Tour button passes a click event — not an array — so it still runs the full tour.
  function start(steps) {
    const custom = Array.isArray(steps) && steps.length;
    activeSteps = custom ? steps : STEPS;
    isFullTour = !custom;
    idx = 0;
    buildUI();
    els.backdrop.style.display = els.hole.style.display = els.card.style.display = 'block';
    render();
  }

  function end() {
    renderToken++;
    detachReposition();
    if (els) els.backdrop.style.display = els.hole.style.display = els.card.style.display = 'none';
    if (isFullTour) { try { localStorage.setItem(DONE_KEY, '1'); } catch {} }   // area tours never suppress the full one
  }

  // Public entry points: the header Tour button + per-area tours from Setup.
  window.startMarketSyncTour = start;
  window.startAreaTour = (id) => { const s = AREA_TOURS[id]; if (s) start(s); };
  window.fireConfetti = fireConfetti;

  // Wire the replay button + auto-run for first-time users once the dashboard
  // has rendered its nav.
  function init() {
    // Place a "Tour" button in the header, just to the left of Sign Out.
    const logout = document.getElementById('logout-btn');
    if (logout && !document.getElementById('ms-tour-btn')) {
      const btn = document.createElement('button');
      btn.id = 'ms-tour-btn';
      btn.type = 'button';
      btn.textContent = 'Tour';
      btn.className = 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2.5 sm:px-3 py-1.5 rounded text-[11px] sm:text-xs font-medium border border-indigo-200 dark:border-indigo-800 transition whitespace-nowrap';
      btn.onclick = () => {
        if (typeof window.openDepartmentSetupWizard === 'function') {
          window.openDepartmentSetupWizard(window.__activeOpenDeptId || 'crm');
        } else {
          start();
        }
      };
      logout.parentNode.insertBefore(btn, logout);
    }
    let done = false;
    try { done = localStorage.getItem(DONE_KEY) === '1'; } catch {}
    if (!done) setTimeout(start, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 600));
  } else {
    setTimeout(init, 600);
  }
})();
