/* dashboard.js split part 24/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// Google Translate widget: when the rep picks a language, persist it so their
// AI-written Facebook listing copy comes out in that language too.
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el && el.classList && el.classList.contains('goog-te-combo')) {
    try {
      fetch(`${API}/ai/my-language`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: el.value || '' }),
      }).catch(() => {});
    } catch {}
  }
});

// ── Department Opening, Left-to-Right Workflow, Setup Wizard & Gamification ──
let __activeOpenDeptId = null;

const DEPARTMENTS_CONFIG = {
  command: {
    id: 'command',
    title: 'Command Center & Executive Briefing',
    badgeTitle: 'Executive Commander',
    badgeIcon: '📊',
    badgeDesc: 'You have configured the Command Center & Executive Overview department!',
    stages: [
      { num: '1', title: 'Executive Overview', desc: 'Monitor revenue, lead velocity, and store performance.' },
      { num: '2', title: 'Operational Flow', desc: 'Track department health across sales, inventory & service.' },
      { num: '3', title: 'Action Launchpad', desc: 'Execute quick actions directly from the header.' }
    ],
    tutorials: ['Daily revenue & exception monitoring', 'Department health velocity cards', 'Quick action header buttons for instant deal desking'],
    fields: [
      { key: 'legal_name', label: 'Legal Dealership Name', placeholder: 'e.g. Apex Motors Inc.', sharedKey: 'legal_name' },
      { key: 'store_tz', label: 'Store Time Zone', placeholder: 'America/Toronto' }
    ]
  },
  crm: {
    id: 'crm',
    title: 'CRM & Customer Management',
    badgeTitle: 'CRM Commander',
    badgeIcon: '🛡️',
    badgeDesc: 'You have configured the CRM & Customer Management department!',
    stages: [
      { num: '1', title: 'Lead Ingestion', desc: 'Capture leads automatically from Facebook, Web Chat, and SMS.' },
      { num: '2', title: 'Pipeline Stages', desc: 'Drag customers from Uncontacted to Appointment and Sold.' },
      { num: '3', title: 'Verification', desc: 'Scan driver\'s licences to auto-fill customer profiles.' }
    ],
    tutorials: ['Multi-channel lead consolidation (Facebook, Web, SMS)', 'Kanban drag-and-drop customer pipeline', 'Driver\'s licence barcode scanner for instant profile creation'],
    fields: [
      { key: 'crm_email', label: 'Lead Intake Email', placeholder: 'leads@dealership.com', sharedKey: 'crm_email' },
      { key: 'phone', label: 'Sales Line Phone', placeholder: '(555) 019-2831', sharedKey: 'phone' }
    ]
  },
  inventory: {
    id: 'inventory',
    title: 'Inventory & Stock Management',
    badgeTitle: 'Inventory Director',
    badgeIcon: '🚘',
    badgeDesc: 'You have configured the Inventory Management department!',
    stages: [
      { num: '1', title: 'Stock Ingestion', desc: 'Sync website feed or CSV file to auto-populate inventory.' },
      { num: '2', title: 'Catalog Management', desc: 'Edit specs, photos, and AI-generated vehicle descriptions.' },
      { num: '3', title: 'Market Execution', desc: 'One-click post to Facebook Marketplace in seconds.' }
    ],
    tutorials: ['Automated inventory feed sync (CSV / Website Feed)', 'AI vehicle sales pitch generator', 'Chrome Extension one-click Facebook Marketplace posting'],
    fields: [
      { key: 'feed_url', label: 'Inventory Feed URL (CSV/XML)', placeholder: 'https://feed.provider.com/stock.csv' },
      { key: 'dms_platform', label: 'DMS Provider', placeholder: 'vAuto / Homenet / PBS / Reynolds' }
    ]
  },
  'inv-intel': {
    id: 'inv-intel',
    title: 'Inventory Intelligence & Pricing Watchdog',
    badgeTitle: 'Pricing Strategist',
    badgeIcon: '📈',
    badgeDesc: 'You have configured Inventory Intelligence & Market Watchdog!',
    stages: [
      { num: '1', title: 'Market Watchdog', desc: 'Auto-flag stale or overpriced units against live comps.' },
      { num: '2', title: 'Turn Rate Analysis', desc: 'Track days-on-lot and monthly sell-through velocity.' },
      { num: '3', title: 'AI Lot Narrative', desc: 'Generate daily AI executive lot recommendations.' }
    ],
    tutorials: ['Days-on-lot watchdog triggers', 'vAuto-style market comp pricing analysis', 'Copart live auction reference data'],
    fields: [
      { key: 'stale_days', label: 'Stale Vehicle Alert Threshold (Days)', placeholder: '45' },
      { key: 'overprice_pct', label: 'Overpriced Alert Threshold (% above market)', placeholder: '5.0' },
      { key: 'auto_reprice', label: 'Automated Repricing Watchdog', placeholder: 'Enabled' }
    ]
  },
  market: {
    id: 'market',
    title: 'Market & Competitor Intelligence',
    badgeTitle: 'Market Analyst',
    badgeIcon: '🔍',
    badgeDesc: 'You have configured Market & Competitor Lot Monitoring!',
    stages: [
      { num: '1', title: 'Competitor Tracking', desc: 'Monitor nearby dealership lots and price adjustments.' },
      { num: '2', title: 'Scraper Radius', desc: 'Set regional geographical market boundary for comp matching.' },
      { num: '3', title: 'Price Positioning', desc: 'Benchmark inventory against local market averages.' }
    ],
    tutorials: ['Competitor lot URL tracking', 'Regional comp radius configuration', 'Price change notification alerts'],
    fields: [
      { key: 'comp_radius', label: 'Competitor Monitoring Radius (KM / Miles)', placeholder: '150' },
      { key: 'target_market_pct', label: 'Target Price-to-Market (%)', placeholder: '98.5' }
    ]
  },
  sales: {
    id: 'sales',
    title: 'Sales & Desking Department',
    badgeTitle: 'Desking Specialist',
    badgeIcon: '📑',
    badgeDesc: 'You have configured the Sales & Deal Desking department!',
    stages: [
      { num: '1', title: 'Deal Input', desc: 'Select stock vehicle, trade-in, and customer profile.' },
      { num: '2', title: 'Deal Structuring', desc: 'Calculate taxes, F&I back-end products, and payments.' },
      { num: '3', title: 'Delivery & Printing', desc: 'Print Buyers Orders, Bill of Sale, and mark unit Delivered.' }
    ],
    tutorials: ['Interactive Deal Desk calculator with trade payoff', 'F&I menu pricing & margin calculator', 'Printable Buyers Order, Bill of Sale, and e-Signature workflow'],
    fields: [
      { key: 'default_tax_rate', label: 'Default Sales Tax Rate (%)', placeholder: '13.0' },
      { key: 'default_doc_fee', label: 'Default Documentation Fee ($)', placeholder: '499.00' }
    ]
  },
  appraisal: {
    id: 'appraisal',
    title: 'Vehicle Appraisals & Acquisition',
    badgeTitle: 'Appraisal Master',
    badgeIcon: '🏷️',
    badgeDesc: 'You have configured the Vehicle Appraisal & Trade-In department!',
    stages: [
      { num: '1', title: 'VIN & Specs', desc: 'Decode VIN, pull specs, options, and recall status.' },
      { num: '2', title: 'Condition & Recon', desc: 'Estimate reconditioning cost and target front-end gross.' },
      { num: '3', title: 'Offer Calculation', desc: 'Generate suggested trade-in offer capped by market book value.' }
    ],
    tutorials: ['VIN barcode scanner and NHTSA decode', 'Reconditioning cost calculator', 'Market-based suggested trade offer capping'],
    fields: [
      { key: 'default_recon_cost', label: 'Default Recon Cost Estimate ($)', placeholder: '1,200.00' },
      { key: 'target_front_gross', label: 'Target Front Gross ($)', placeholder: '2,500.00' },
      { key: 'max_acq_pct', label: 'Max Acquisition % of Market Value', placeholder: '88.0' }
    ]
  },
  equity: {
    id: 'equity',
    title: 'Equity Mining & Trade-Up Scanner',
    badgeTitle: 'Equity Specialist',
    badgeIcon: '💎',
    badgeDesc: 'You have configured Equity Mining & Trade-Up Acquisitions!',
    stages: [
      { num: '1', title: 'Database Scanning', desc: 'Scan CRM and Service database for positive equity units.' },
      { num: '2', title: 'Trade-Up Calculation', desc: 'Calculate lower monthly payments into newer inventory.' },
      { num: '3', title: 'Automated Outreach', desc: 'Trigger SMS & Email trade-up invitations.' }
    ],
    tutorials: ['Automated equity database scanner', 'Payment parity trade-up calculator', 'One-click VIP campaign trigger'],
    fields: [
      { key: 'min_equity', label: 'Minimum Positive Equity Target ($)', placeholder: '2,000.00' },
      { key: 'min_vehicle_age', label: 'Minimum Vehicle Age for Trade-Up (Years)', placeholder: '2' }
    ]
  },
  delivery: {
    id: 'delivery',
    title: 'Vehicle Delivery Queue',
    badgeTitle: 'Delivery Specialist',
    badgeIcon: '🚚',
    badgeDesc: 'You have configured the Vehicle Delivery department!',
    stages: [
      { num: '1', title: 'Sold Queue', desc: 'Track pending deliveries and sold vehicle holds.' },
      { num: '2', title: 'Pre-Delivery Inspection', desc: 'Complete wash, detail, and accessory installation checklist.' },
      { num: '3', title: 'Handover & Review', desc: 'Hand over keys, complete e-sign, and request Google Review.' }
    ],
    tutorials: ['Sold vehicle queue tracking', 'Pre-delivery detail checklist', 'Automated review request follow-up'],
    fields: [
      { key: 'delivery_manager', label: 'Delivery Coordinator Name', placeholder: 'Sarah Connor' },
      { key: 'review_link', label: 'Google Review Link', placeholder: 'https://g.page/apexmotors/review' }
    ]
  },
  'fni-worklist': {
    id: 'fni-worklist',
    title: 'F&I Deals & Lender Routing',
    badgeTitle: 'F&I Manager',
    badgeIcon: '💳',
    badgeDesc: 'You have configured F&I Deals & Lender Routing!',
    stages: [
      { num: '1', title: 'Credit Application', desc: 'Gather applicant income, housing, and credit details.' },
      { num: '2', title: 'Lender Submissions', desc: 'Route applications to preferred prime & subprime lenders.' },
      { num: '3', title: 'Back-End Menu', desc: 'Present warranties, GAP insurance, and tire protection.' }
    ],
    tutorials: ['Credit application intake & validation', 'Lender portal credit routing', 'F&I product menu presentation'],
    fields: [
      { key: 'preferred_lender', label: 'Primary Lender Portal', placeholder: 'DealerTrack / RouteOne / Bank' },
      { key: 'target_pvr', label: 'Target PVR Back-End Gross ($)', placeholder: '1,850.00' }
    ]
  },
  'fni-esignatures': {
    id: 'fni-esignatures',
    title: 'eSignatures & Digital Contracts',
    badgeTitle: 'Digital Signing Officer',
    badgeIcon: '✍️',
    badgeDesc: 'You have configured Digital eSignatures & Contracts!',
    stages: [
      { num: '1', title: 'Document Prep', desc: 'Generate Buyers Order, Bill of Sale, and disclosure forms.' },
      { num: '2', title: 'In-Person / Remote Sign', desc: 'Send e-sign link via SMS/Email or present on tablet.' },
      { num: '3', title: 'Vault & Archive', desc: 'Store tamper-proof PDF contracts in digital deal jacket.' }
    ],
    tutorials: ['Tamper-proof digital e-signature engine', 'Remote customer signing via SMS', 'Automated deal jacket PDF archiving'],
    fields: [
      { key: 'esign_provider', label: 'e-Sign Engine Status', placeholder: 'Enabled (MarketSync Native)' },
      { key: 'contract_retention', label: 'Contract Retention Period (Years)', placeholder: '7' }
    ]
  },
  service: {
    id: 'service',
    title: 'Service & Fixed Ops Department',
    badgeTitle: 'Service Director',
    badgeIcon: '🧰',
    badgeDesc: 'You have configured the Service & Parts department!',
    stages: [
      { num: '1', title: 'Service Intake', desc: 'Schedule appointments and create repair orders.' },
      { num: '2', title: 'Repair Dispatch', desc: 'Manage open repair orders, parts, and technician assignments.' },
      { num: '3', title: 'Equity Mining', desc: 'Identify high-equity service customers to trade up.' }
    ],
    tutorials: ['Service scheduling and repair order tracking', 'Parts inventory requisitions', 'Automated Equity Mining scanner for trade-in acquisitions'],
    fields: [
      { key: 'service_phone', label: 'Service Desk Phone', placeholder: '(555) 019-2832', sharedKey: 'phone' },
      { key: 'labor_rate', label: 'Hourly Labor Rate ($)', placeholder: '145.00' }
    ]
  },
  'service-parts': {
    id: 'service-parts',
    title: 'Parts Inventory & Reordering',
    badgeTitle: 'Parts Manager',
    badgeIcon: '⚙️',
    badgeDesc: 'You have configured Parts Inventory & Vendor Reordering!',
    stages: [
      { num: '1', title: 'Parts Catalog', desc: 'Track OEM and aftermarket parts numbers and quantities.' },
      { num: '2', title: 'Reorder Alerts', desc: 'Set minimum stock levels for fast-moving maintenance items.' },
      { num: '3', title: 'RO Requisitions', desc: 'Issue parts directly to active Repair Orders.' }
    ],
    tutorials: ['Parts SKU barcode inventory management', 'Automated vendor reorder alerts', 'Repair order parts billing'],
    fields: [
      { key: 'parts_markup', label: 'Default Parts Markup %', placeholder: '40.0' },
      { key: 'primary_parts_vendor', label: 'Primary Parts Supplier', placeholder: 'OEM Direct / NAPA' }
    ]
  },
  recon: {
    id: 'recon',
    title: 'Cleanup & Detail Reconditioning',
    badgeTitle: 'Recon Supervisor',
    badgeIcon: '🧼',
    badgeDesc: 'You have configured Cleanup & Detail Reconditioning!',
    stages: [
      { num: '1', title: 'Intake Queue', desc: 'Log acquired trade-ins into detail and wash queue.' },
      { num: '2', title: 'Wash & Photo', desc: 'Complete 360 photo booth capture and interior detailing.' },
      { num: '3', title: 'Lot Release', desc: 'Release vehicle to live inventory as Ready for Sale.' }
    ],
    tutorials: ['Detail turnaround SLA tracker', 'Photo booth image upload workflow', 'Automated Ready for Sale status update'],
    fields: [
      { key: 'recon_sla', label: 'Target Recon Turnaround SLA (Hours)', placeholder: '48' },
      { key: 'photo_booth_bay', label: 'Photo Bay Location', placeholder: 'Building B - Bay 3' }
    ]
  },
  accounting: {
    id: 'accounting',
    title: 'Accounting & Dealership Books',
    badgeTitle: 'Controller',
    badgeIcon: '💼',
    badgeDesc: 'You have configured Accounting & Dealership Books!',
    stages: [
      { num: '1', title: 'Ledger Ingestion', desc: 'Delivered deals automatically post to general ledger.' },
      { num: '2', title: 'Expenses & Payroll', desc: 'Track vendor invoices, inventory pack, and rep commissions.' },
      { num: '3', title: 'Reconciliation & Tax', desc: 'Run daily bank reconciliation and export tax reports.' }
    ],
    tutorials: ['Automated deal posting from Sales Desk to General Ledger', 'Commission calculation and rep payroll export', 'One-click tax report generation & bank reconciliation'],
    fields: [
      { key: 'accounting_email', label: 'Accounting Contact Email', placeholder: 'accounting@dealership.com' },
      { key: 'currency', label: 'Primary Currency', placeholder: 'CAD / USD' }
    ]
  },
  'acct-tax': {
    id: 'acct-tax',
    title: 'Tax Rates & Accountant Setup',
    badgeTitle: 'Tax Administrator',
    badgeIcon: '🏛️',
    badgeDesc: 'You have configured Tax Rates & Corporate Accountant Settings!',
    stages: [
      { num: '1', title: 'Tax Jurisdiction', desc: 'Set regional sales tax rates (HST/PST/GST/State Tax).' },
      { num: '2', title: 'Corporate Registration', desc: 'Enter Business Tax Registration # for official invoice printing.' },
      { num: '3', title: 'Accountant Export', desc: 'Automate monthly tax ledger export to corporate accountant.' }
    ],
    tutorials: ['Multi-jurisdiction sales tax configuration', 'Tax ID printing on Buyers Orders & Bills of Sale', 'Automated monthly CPA ledger export'],
    fields: [
      { key: 'default_tax_rate', label: 'Default Sales Tax Rate (%)', placeholder: '13.0' },
      { key: 'tax_id_number', label: 'Tax Registration ID / HST #', placeholder: 'RT0001-984210' },
      { key: 'cpa_email', label: 'Corporate Accountant Email', placeholder: 'cpa@accountingfirm.com' }
    ]
  },
  'acct-recon': {
    id: 'acct-recon',
    title: 'Daily Bank Reconciliation',
    badgeTitle: 'Reconciliation Manager',
    badgeIcon: '🏦',
    badgeDesc: 'You have configured Daily Bank Reconciliation!',
    stages: [
      { num: '1', title: 'Bank Feeds', desc: 'Sync daily bank transaction statement feeds.' },
      { num: '2', title: 'Auto-Matching', desc: 'Match bank deposits against delivered deal receipts.' },
      { num: '3', title: 'Exception Clearing', desc: 'Clear outstanding deposits and fee variances.' }
    ],
    tutorials: ['Automated bank feed deposit matching', 'Deal receipt reconciliation', 'Variance exception clearing'],
    fields: [
      { key: 'bank_name', label: 'Primary Operating Bank', placeholder: 'RBC / TD / Chase' },
      { key: 'match_tolerance', label: 'Auto-Match Tolerance ($)', placeholder: '0.05' }
    ]
  },
  web: {
    id: 'web',
    title: 'Website & Digital Showroom',
    badgeTitle: 'Digital Webmaster',
    badgeIcon: '🌐',
    badgeDesc: 'You have configured the Website department!',
    stages: [
      { num: '1', title: 'Structure & Theme', desc: 'Choose theme colors, logo, and homepage hero.' },
      { num: '2', title: 'AI Assistant Widget', desc: 'Configure 24/7 AI chat widget to capture leads.' },
      { num: '3', title: 'Custom Domain', desc: 'Connect custom domain name and publish site.' }
    ],
    tutorials: ['Drag-and-drop website block builder', '24/7 AI Assistant lead capture widget', 'Custom domain & SSL auto-provisioning'],
    fields: [
      { key: 'website_url', label: 'Dealership Website URL', placeholder: 'https://www.apexmotors.com', sharedKey: 'website_url' },
      { key: 'subdomain', label: 'MarketSync Subdomain', placeholder: 'apexmotors' }
    ]
  },
  auto: {
    id: 'auto',
    title: 'Automations & Follow-Up Drips',
    badgeTitle: 'Automation Master',
    badgeIcon: '⚡',
    badgeDesc: 'You have configured the Automation department!',
    stages: [
      { num: '1', title: 'Triggers', desc: 'Select automated triggers for new leads & aged units.' },
      { num: '2', title: 'Sequences', desc: 'Craft multi-step SMS and email follow-up drips.' },
      { num: '3', title: 'Engine Control', desc: 'Turn Engine ON for automated 24/7 follow-up.' }
    ],
    tutorials: ['Event-driven automation triggers', 'Personalized SMS & Email template tags', '24/7 background campaign execution engine'],
    fields: [
      { key: 'sender_name', label: 'Email Sender Name', placeholder: 'Apex Motors Sales Team' },
      { key: 'sender_email', label: 'Sender Email Address', placeholder: 'info@apexmotors.com' }
    ]
  },
  'email-campaigns': {
    id: 'email-campaigns',
    title: 'Email Campaigns & Broadcasts',
    badgeTitle: 'Email Campaign Specialist',
    badgeIcon: '📧',
    badgeDesc: 'You have configured Email Broadcasts & Newsletters!',
    stages: [
      { num: '1', title: 'Audience Targeting', desc: 'Filter customer segments: Active Shoppers, Past Buyers, Aged Leads.' },
      { num: '2', title: 'AI Copy Builder', desc: 'Generate vehicle showcase copy and promotional offers.' },
      { num: '3', title: 'Broadcast Analytics', desc: 'Send campaign and track real-time open rates and inquiries.' }
    ],
    tutorials: ['Audience segment filtering', 'AI-generated promo email copy', 'Real-time open & click tracking analytics'],
    fields: [
      { key: 'broadcast_sender', label: 'Broadcast Sender Name', placeholder: 'Apex Motors Deals' },
      { key: 'reply_to', label: 'Reply-To Email Address', placeholder: 'sales@apexmotors.com' }
    ]
  },
  'owner-users': {
    id: 'owner-users',
    title: 'User Administration & Staff Roles',
    badgeTitle: 'User Administrator',
    badgeIcon: '👥',
    badgeDesc: 'You have configured User Administration & Permissions!',
    stages: [
      { num: '1', title: 'User Roster', desc: 'Add sales reps, F&I managers, service advisors, and accounting staff.' },
      { num: '2', title: 'Role Access', desc: 'Assign granular permissions: Rep, Manager, Admin, Accountant.' },
      { num: '3', title: 'MFA Security', desc: 'Enforce multi-factor authentication for team accounts.' }
    ],
    tutorials: ['Role-based access control (RBAC)', 'Sales team roster management', 'MFA security enforcement'],
    fields: [
      { key: 'default_role', label: 'Default New User Role', placeholder: 'Sales Rep' },
      { key: 'require_mfa', label: 'Require MFA for Managers', placeholder: 'Enabled' }
    ]
  },
  operations: {
    id: 'operations',
    title: 'Store Operations & Compliance',
    badgeTitle: 'Operations Director',
    badgeIcon: '🏢',
    badgeDesc: 'You have configured Store Operations & Compliance!',
    stages: [
      { num: '1', title: 'Store Schedule', desc: 'Set operating hours for sales, service, and parts.' },
      { num: '2', title: 'Vendor Logins', desc: 'Manage DMS, CRM, and website vendor integration keys.' },
      { num: '3', title: 'Security Audit', desc: 'Monitor store audit log and security events.' }
    ],
    tutorials: ['Store operating hours configuration', 'Vendor credential management', 'System audit log monitoring'],
    fields: [
      { key: 'store_address', label: 'Dealership Street Address', placeholder: '100 Motorway Blvd', sharedKey: 'address' },
      { key: 'store_hours', label: 'Sales Operating Hours', placeholder: 'Mon-Fri: 9am-8pm, Sat: 9am-6pm' }
    ]
  },
  config: {
    id: 'config',
    title: 'System Configuration Engine',
    badgeTitle: 'System Architect',
    badgeIcon: '⚙️',
    badgeDesc: 'You have configured the System Configuration Engine!',
    stages: [
      { num: '1', title: 'Engine Overview', desc: 'Control platform feature flags, timeouts, and system defaults.' },
      { num: '2', title: 'Rule Scoping', desc: 'Configure regional rules for pricing, taxes, and notifications.' },
      { num: '3', title: 'System Health', desc: 'Monitor API health, database sync status, and background workers.' }
    ],
    tutorials: ['Global platform feature flags', 'API timeout & retry policy settings', 'Background queue health monitoring'],
    fields: [
      { key: 'api_timeout_ms', label: 'API Call Timeout (ms)', placeholder: '10000' },
      { key: 'log_level', label: 'System Log Level', placeholder: 'INFO' }
    ]
  },
  'api-keys': {
    id: 'api-keys',
    title: 'API & MCP Keys',
    badgeTitle: 'API Developer',
    badgeIcon: '🔑',
    badgeDesc: 'You have configured Developer API & MCP Keys!',
    stages: [
      { num: '1', title: 'API Tokens', desc: 'Generate REST API keys for custom inventory & CRM integrations.' },
      { num: '2', title: 'Webhooks', desc: 'Register webhook endpoints for real-time lead and deal events.' },
      { num: '3', title: 'MCP Servers', desc: 'Connect Model Context Protocol servers for AI assistant tools.' }
    ],
    tutorials: ['Developer REST API key generation', 'Real-time webhook event subscriptions', 'MCP AI server endpoint configuration'],
    fields: [
      { key: 'webhook_url', label: 'Lead Webhook Callback URL', placeholder: 'https://api.yourdomain.com/webhook' },
      { key: 'mcp_server_url', label: 'MCP Server Endpoint', placeholder: 'https://mcp.yourdomain.com/sse' }
    ]
  },
  'crm-appointments': {
    id: 'crm-appointments', title: 'Sales & CRM Appointments', badgeTitle: 'Appointment Coordinator', badgeIcon: '📅',
    badgeDesc: 'You have configured Sales & CRM Appointments!',
    stages: [
      { num: '1', title: 'Calendar Sync', desc: 'Sync sales rep Google/Outlook calendars.' },
      { num: '2', title: 'Automated Reminders', desc: 'Configure 24h & 2h pre-appointment SMS reminders.' },
      { num: '3', title: 'Show-Rate Tracking', desc: 'Track appointment show rate and conversion to sale.' }
    ],
    tutorials: ['Sales calendar sync', 'Pre-appointment automated SMS reminders', 'Show rate conversion analytics'],
    fields: [
      { key: 'calendar_tz', label: 'Calendar Time Zone', placeholder: 'America/Toronto' },
      { key: 'reminder_sms_lead_hours', label: 'SMS Reminder Lead Time (Hours)', placeholder: '24' }
    ]
  },
  'crm-tasks': {
    id: 'crm-tasks', title: 'Sales Tasks & Follow-Up Reminders', badgeTitle: 'Task Manager', badgeIcon: '✅',
    badgeDesc: 'You have configured Sales Tasks & Follow-Up Reminders!',
    stages: [
      { num: '1', title: 'Auto-Task Assignment', desc: 'Create tasks on new lead intake.' },
      { num: '2', title: 'Daily Rep Agenda', desc: 'Prioritize phone calls, emails, and SMS follow-ups.' },
      { num: '3', title: 'SLA Escalation', desc: 'Escalate overdue tasks to sales manager.' }
    ],
    tutorials: ['Automatic task assignment rules', 'Daily rep follow-up queue', 'Manager task SLA escalation'],
    fields: [
      { key: 'default_task_due_hours', label: 'Default Follow-Up Task SLA (Hours)', placeholder: '2' },
      { key: 'escalate_manager_email', label: 'Manager Escalation Email', placeholder: 'mgr@dealership.com' }
    ]
  },
  'crm-opps': {
    id: 'crm-opps', title: 'Opportunities Pipeline & Deal Stages', badgeTitle: 'Pipeline Strategist', badgeIcon: '🎯',
    badgeDesc: 'You have configured Opportunities Pipeline & Deal Stages!',
    stages: [
      { num: '1', title: 'Stage Probability', desc: 'Set win probabilities for Uncontacted, Appointment, and Desking.' },
      { num: '2', title: 'Rotting Alerts', desc: 'Flag deals inactive for more than 48 hours.' },
      { num: '3', title: 'Forecast Reporting', desc: 'Project monthly front and back-end gross revenue.' }
    ],
    tutorials: ['Kanban deal stage probability', 'Stale deal rotting alerts', 'Monthly gross revenue forecasting'],
    fields: [
      { key: 'rotting_days', label: 'Stale Deal Alert Threshold (Days)', placeholder: '3' },
      { key: 'target_monthly_deals', label: 'Target Monthly Unit Sales', placeholder: '45' }
    ]
  },
  'sales-reports': {
    id: 'sales-reports', title: 'Sales Reports & Rep Benchmarks', badgeTitle: 'Sales Analyst', badgeIcon: '📊',
    badgeDesc: 'You have configured Sales Reports & Benchmarks!',
    stages: [
      { num: '1', title: 'Metric Selection', desc: 'Choose gross profit, conversion rate, and lead response metrics.' },
      { num: '2', title: 'Rep Leaderboards', desc: 'Track sales rep volume and average front gross.' },
      { num: '3', title: 'Executive Digest', desc: 'Automate weekly executive email reports.' }
    ],
    tutorials: ['Gross profit analytics', 'Rep performance leaderboard', 'Automated weekly email report digest'],
    fields: [
      { key: 'report_email_recipient', label: 'Executive Digest Email', placeholder: 'gm@dealership.com' },
      { key: 'target_front_gross_per_unit', label: 'Target Front Gross / Unit ($)', placeholder: '2,200.00' }
    ]
  },
  'fni-reports': {
    id: 'fni-reports', title: 'F&I Reports & PVR Benchmarks', badgeTitle: 'F&I Analyst', badgeIcon: '📈',
    badgeDesc: 'You have configured F&I Reports & PVR Benchmarks!',
    stages: [
      { num: '1', title: 'PVR Tracking', desc: 'Track Per Vehicle Retail (PVR) back-end income.' },
      { num: '2', title: 'Product Penetration', desc: 'Monitor warranty, GAP, and chemical protection percentages.' },
      { num: '3', title: 'Lender Mix', desc: 'Analyze lender approval and funded deal distribution.' }
    ],
    tutorials: ['PVR back-end income tracker', 'Product penetration percentage reporting', 'Lender approval mix analytics'],
    fields: [
      { key: 'target_pvr_goal', label: 'Target PVR Goal ($)', placeholder: '1,850.00' },
      { key: 'warranty_penetration_goal', label: 'Warranty Penetration Target (%)', placeholder: '55.0' }
    ]
  },
  'service-appointments': {
    id: 'service-appointments', title: 'Service Appointments & Capacity', badgeTitle: 'Service Coordinator', badgeIcon: '📅',
    badgeDesc: 'You have configured Service Appointments & Capacity!',
    stages: [
      { num: '1', title: 'Advisor Intake', desc: 'Schedule appointments per service advisor.' },
      { num: '2', title: 'Bay Capacity', desc: 'Set maximum daily shop labor hours.' },
      { num: '3', title: 'Automated Reminders', desc: 'Send appointment confirmation and SMS reminders.' }
    ],
    tutorials: ['Advisor appointment scheduling', 'Daily shop labor hour capacity limits', 'Automated SMS appointment reminders'],
    fields: [
      { key: 'max_daily_labor_hours', label: 'Max Daily Shop Capacity (Labor Hours)', placeholder: '64' },
      { key: 'service_advisor_email', label: 'Service Lead Advisor Email', placeholder: 'service@dealership.com' }
    ]
  },
  'acct-insights': {
    id: 'acct-insights', title: 'Financial Insights & Profitability', badgeTitle: 'Financial Analyst', badgeIcon: '💡',
    badgeDesc: 'You have configured Financial Insights & Profitability!',
    stages: [
      { num: '1', title: 'P&L Benchmarks', desc: 'Set target net margin and overhead cost caps.' },
      { num: '2', title: 'Department Split', desc: 'Track gross contribution across Sales, F&I, Service, and Parts.' },
      { num: '3', title: 'Variance Alerts', desc: 'Get notified when overhead exceeds budget.' }
    ],
    tutorials: ['Departmental P&L contribution tracking', 'Overhead cost cap alerts', 'Real-time store net profit estimation'],
    fields: [
      { key: 'target_net_margin_pct', label: 'Target Store Net Margin (%)', placeholder: '8.5' },
      { key: 'monthly_overhead_cap', label: 'Monthly Overhead Cap ($)', placeholder: '65,000.00' }
    ]
  },
  'acct-bank': {
    id: 'acct-bank', title: 'Bank Accounts & Operating Accounts', badgeTitle: 'Treasury Officer', badgeIcon: '🏦',
    badgeDesc: 'You have configured Bank Accounts & Operating Accounts!',
    stages: [
      { num: '1', title: 'Account Registration', desc: 'Register operating, payroll, and floorplan bank accounts.' },
      { num: '2', title: 'Transit Routing', desc: 'Enter transit, institution, and account numbers.' },
      { num: '3', title: 'Daily Feed Sync', desc: 'Connect bank feeds for automated reconciliation.' }
    ],
    tutorials: ['Operating & payroll account registration', 'Bank transit & routing configuration', 'Automated daily bank feed sync'],
    fields: [
      { key: 'operating_bank_name', label: 'Operating Bank Name', placeholder: 'Royal Bank / Chase / TD' },
      { key: 'account_last4', label: 'Operating Account (Last 4 Digits)', placeholder: '9421' }
    ]
  },
  'acct-expenses': {
    id: 'acct-expenses', title: 'Expense Tracking & Approval Limits', badgeTitle: 'Expense Controller', badgeIcon: '💸',
    badgeDesc: 'You have configured Expense Tracking & Approval Limits!',
    stages: [
      { num: '1', title: 'Expense Categories', desc: 'Configure vendor, floorplan interest, pack, and advertising categories.' },
      { num: '2', title: 'Manager Approval Limits', desc: 'Set maximum expense amount requiring GM approval.' },
      { num: '3', title: 'Invoice Scanning', desc: 'Scan and OCR vendor invoices for automated ledger posting.' }
    ],
    tutorials: ['Custom expense category taxonomy', 'Manager purchase order approval limits', 'Vendor invoice OCR ingestion'],
    fields: [
      { key: 'approval_limit_mgr', label: 'Manager Expense Approval Limit ($)', placeholder: '1,000.00' },
      { key: 'default_pack_amount', label: 'Default Vehicle Stock Pack ($)', placeholder: '600.00' }
    ]
  },
  'acct-budget': {
    id: 'acct-budget', title: 'Monthly Budgeting & Variance', badgeTitle: 'Budget Director', badgeIcon: '📊',
    badgeDesc: 'You have configured Monthly Budgeting & Variance!',
    stages: [
      { num: '1', title: 'Budget Allocation', desc: 'Allocate monthly budgets for Marketing, Personnel, and Facilities.' },
      { num: '2', title: 'Variance Tracking', desc: 'Compare actual spend against budget in real-time.' },
      { num: '3', title: 'Overrun Warning', desc: 'Trigger alerts when department spend hits 90% of budget.' }
    ],
    tutorials: ['Departmental budget allocation', 'Real-time spend vs budget tracking', 'Budget overrun early warning alerts'],
    fields: [
      { key: 'monthly_marketing_budget', label: 'Monthly Marketing Budget ($)', placeholder: '12,500.00' },
      { key: 'budget_alert_pct', label: 'Budget Alert Threshold (%)', placeholder: '90' }
    ]
  },
  'acct-reports': {
    id: 'acct-reports', title: 'Financial Reports & CPA Export', badgeTitle: 'Reporting Officer', badgeIcon: '📑',
    badgeDesc: 'You have configured Financial Reports & CPA Export!',
    stages: [
      { num: '1', title: 'Fiscal Year Setup', desc: 'Set store fiscal year start month.' },
      { num: '2', title: 'Report Templates', desc: 'Balance sheet, Income statement, Trial balance, and Tax summary.' },
      { num: '3', title: 'CPA Export', desc: 'Export trial balance and transaction ledger to Excel / CSV / QuickBooks.' }
    ],
    tutorials: ['Fiscal year period configuration', 'Standard financial statement generation', 'QuickBooks / CSV ledger export'],
    fields: [
      { key: 'fiscal_start_month', label: 'Fiscal Year Start Month', placeholder: 'January' },
      { key: 'export_format', label: 'Default CPA Export Format', placeholder: 'CSV / Excel' }
    ]
  },
  'facebook-autoposter': {
    id: 'facebook-autoposter', title: 'Facebook Marketplace Autoposter', badgeTitle: 'Marketplace Automation Specialist', badgeIcon: '📱',
    badgeDesc: 'You have configured Facebook Marketplace Autoposter!',
    stages: [
      { num: '1', title: 'Extension Sync', desc: 'Connect MarketSync Chrome Extension.' },
      { num: '2', title: 'Listing Template', desc: 'Format AI-generated sales copy and photo ordering.' },
      { num: '3', title: '1-Click Execution', desc: 'Post inventory listings to Facebook Marketplace in seconds.' }
    ],
    tutorials: ['Chrome Extension connection', 'AI listing description generator', '1-click Facebook Marketplace posting'],
    fields: [
      { key: 'fb_location_city', label: 'Facebook Marketplace Primary City', placeholder: 'Toronto, ON' },
      { key: 'auto_include_vin', label: 'Include VIN in Listing Copy', placeholder: 'Yes' }
    ]
  },
  'ai-chatbot': {
    id: 'ai-chatbot', title: 'AI Assistant ChatBot Widget', badgeTitle: 'AI Operations Specialist', badgeIcon: '🤖',
    badgeDesc: 'You have configured AI Assistant ChatBot Widget!',
    stages: [
      { num: '1', title: 'Widget Embedding', desc: 'Embed 24/7 AI chat widget on your dealership website.' },
      { num: '2', title: 'Knowledge Base', desc: 'Train AI on store inventory, location, hours, and financing terms.' },
      { num: '3', title: 'Lead Capture & Booking', desc: 'Automatically capture lead contact info and book test drives.' }
    ],
    tutorials: ['Website AI chat widget installation', 'Inventory & store rules training', 'Automated test drive booking'],
    fields: [
      { key: 'chatbot_greeting', label: 'Welcome Greeting Message', placeholder: 'Hi! Looking for a vehicle or scheduling service?' },
      { key: 'lead_notify_email', label: 'Lead Notification Email', placeholder: 'leads@dealership.com' }
    ]
  },
  leaderboard: {
    id: 'leaderboard', title: 'Sales Leaderboard & Ranking Overview', badgeTitle: 'Leaderboard Champion', badgeIcon: '🏆',
    badgeDesc: 'You have completed the Leaderboard Overview!',
    stages: [
      { num: '1', title: 'Dealership Store View', desc: 'View top performing sales reps within your local dealership in real-time.' },
      { num: '2', title: 'Global Network View', desc: 'Toggle the Global tab to see how your store and reps rank against all MarketSync dealerships nationwide.' },
      { num: '3', title: 'Showroom TV Display', desc: 'Launch full-screen mode to project live sales rankings on your showroom floor monitors.' }
    ],
    tutorials: [
      'Toggle between Dealership Store & Global Network rankings',
      'Real-time units sold & gross profit tracking',
      'Full-screen TV display mode for showroom floor monitors'
    ],
    fields: []
  },
  taskboard: {
    id: 'taskboard', title: 'Operations Taskboard & Kanban', badgeTitle: 'Kanban Master', badgeIcon: '📋',
    badgeDesc: 'You have configured Operations Taskboard & Kanban!',
    stages: [
      { num: '1', title: 'Column Layout', desc: 'Configure columns: To Do, In Progress, Review, Completed.' },
      { num: '2', title: 'Task Assignment', desc: 'Assign tasks to reps, detailers, and drivers.' },
      { num: '3', title: 'Priority Tags', desc: 'Set urgent, high, and normal priority badges.' }
    ],
    tutorials: ['Operational task Kanban layout', 'Team member task assignment', 'Priority escalation tags'],
    fields: [
      { key: 'default_task_assignee', label: 'Default Operations Task Assignee', placeholder: 'Detail Dept' },
      { key: 'high_priority_color', label: 'High Priority Color', placeholder: 'Rose / Red' }
    ]
  },
  academy: {
    id: 'academy', title: 'MarketSync Training Academy', badgeTitle: 'Certified Master', badgeIcon: '🎓',
    badgeDesc: 'You have configured MarketSync Training Academy!',
    stages: [
      { num: '1', title: '200 Masterclass Lessons', desc: 'Complete lessons across Sales, CRM, Inventory, and F&I.' },
      { num: '2', title: 'Interactive Quizzes', desc: 'Test knowledge with real-world dealership scenario quizzes.' },
      { num: '3', title: 'Certificates', desc: 'Earn official printable certificates and LinkedIn badges.' }
    ],
    tutorials: ['200 dealership masterclass lessons', 'Interactive knowledge checks', 'Printable PDF certificates & LinkedIn integration'],
    fields: [
      { key: 'trainee_name', label: 'Primary Trainee Name', placeholder: 'John Doe' },
      { key: 'cert_title', label: 'Certificate Title', placeholder: 'Certified Digital Dealership Specialist' }
    ]
  },
  marketing: {
    id: 'marketing',
    title: 'Marketing & Growth Suite',
    badgeTitle: 'Marketing Director',
    badgeIcon: '🚀',
    badgeDesc: 'You have configured the Marketing & Growth Suite!',
    stages: [
      { num: '1', title: 'Multi-Channel Setup', desc: 'Configure Facebook Autoposter, Dealership Website, and 24/7 AI ChatBot.' },
      { num: '2', title: 'Visual Email Marketing', desc: 'Launch Mailchimp-style visual email campaigns with auto-branding and AI copy generator.' },
      { num: '3', title: 'Sales Leaderboard', desc: 'Project real-time store rankings and gross profit tracking on your showroom floor.' }
    ],
    tutorials: ['Facebook Autoposter 1-click execution', 'Mailchimp-style visual email builder', 'Showroom TV sales leaderboard ranking display'],
    fields: [
      { key: 'primary_marketing_channel', label: 'Primary Focus Channel', placeholder: 'Facebook Marketplace / Email Broadcasts' },
      { key: 'target_monthly_leads', label: 'Target Monthly Lead Goal', placeholder: '250' }
    ]
  },
  'ai-inbox': {
    id: 'ai-inbox', title: 'AI Chat & Multi-Channel Inbox', badgeTitle: 'AI Communications Director', badgeIcon: '💬',
    badgeDesc: 'You have configured AI Chat & Multi-Channel Inbox!',
    stages: [
      { num: '1', title: 'Inbox Consolidation', desc: 'Consolidate messages from Facebook Messenger, Web Chat, and SMS.' },
      { num: '2', title: 'AI Copilot Auto-Reply', desc: 'Enable Gemini AI to draft responses, share vehicle specs, and qualify buyers.' },
      { num: '3', title: 'Test Drive Hand-Off', desc: 'Auto-schedule test drives directly to your sales calendar.' }
    ],
    tutorials: ['Multi-channel inbox (Facebook, Web Chat, SMS)', 'AI Copilot buyer qualification & specs', 'Automated test drive calendar booking'],
    fields: [
      { key: 'ai_copilot_mode', label: 'AI Copilot Mode', placeholder: 'Auto-Pilot (Full Auto)' },
      { key: 'ai_response_delay_sec', label: 'AI Response Delay (Seconds)', placeholder: '15' },
      { key: 'ai_fallback_email', label: 'Rep Escalation Email', placeholder: 'sales@dealership.com' }
    ]
  }
};

function checkDepartmentOpen(pageId) {
  if (!pageId) return;
  let deptId = pageId;

  // Exact page to department schema mapping
  if (pageId === 'inv-intel' || pageId === 'market') deptId = pageId;
  if (pageId === 'fni' || pageId === 'desk' || pageId === 'recon') deptId = pageId === 'fni' ? 'fni-worklist' : (pageId === 'recon' ? 'recon' : 'sales');
  if (pageId === 'appraisal' || pageId === 'equity' || pageId === 'delivery') deptId = pageId;
  if (pageId === 'service-ros' || pageId === 'service-appointments' || pageId === 'service-parts') deptId = pageId === 'service-parts' ? 'service-parts' : 'service';
  if (typeof pageId === 'string' && pageId.startsWith('acct-')) deptId = pageId;
  if (pageId === 'website' || pageId === 'website-settings') deptId = 'web';
  if (pageId === 'marketing') deptId = 'marketing';
  if (pageId === 'autoposter') deptId = 'facebook-autoposter';
  if (pageId === 'ai-chatbot') deptId = 'ai-chatbot';
  if (pageId === 'automation' || pageId === 'automation-builder' || pageId === 'email-campaigns' || pageId === 'email-marketing') deptId = (pageId === 'email-campaigns' || pageId === 'email-marketing') ? 'email-campaigns' : 'auto';
  if (pageId === 'leaderboard') deptId = 'leaderboard';
  if (pageId === 'academy') deptId = 'academy';
  if (pageId === 'ai-inbox' || pageId === 'ai-home' || pageId === 'ai-vision' || pageId === 'ai-chat') deptId = 'ai-inbox';

  const deptConfig = DEPARTMENTS_CONFIG[deptId] || DEPARTMENTS_CONFIG[pageId];
  if (!deptConfig) return;

  const key = `ms_dept_opened_${deptId}`;
  try {
    if (!localStorage.getItem(key)) {
      openDepartmentSetupWizard(deptId);
    }
  } catch {}
}
window.checkDepartmentOpen = checkDepartmentOpen;

// ── MarketSync Training Academy Implementation ──────────────────────────────
const ACADEMY_COURSES = [
  {
    id: 'email-marketing',
    title: 'Email Marketing & Visual Studio Mastery',
    category: 'Marketing & Retention',
    badge: 'NEW 📧',
    icon: '✉️',
    desc: 'Master segment targeting, Mailchimp-style visual block building, automatic store branding, AI copy generation, 25px block padding rules, and campaign analytics.',
    lessons: [
      { num: '1', title: 'Audience Segmentation & Filters', desc: 'Target Active Shoppers, Past Buyers, Aged Leads, and Service Customers for maximum conversion.' },
      { num: '2', title: 'Mailchimp Visual Drag & Drop Builder', desc: 'Customize headers, hero banners, vehicle cards, promo badges, CTAs, and footers with auto-branding.' },
      { num: '3', title: '✨ AI Subject Line & Copy Copilot', desc: 'Auto-craft high-converting email subject lines and vehicle offer copy powered by AI.' },
      { num: '4', title: '25px Padding Rule & HTML Standards', desc: 'Enforce standard 25px block padding for clean, mobile-responsive layout across all email clients.' },
      { num: '5', title: 'Inbox Full Preview & Broadcast Analytics', desc: 'Test desktop/mobile views, inspect full inbox previews, and track open & click rates in real time.' }
    ]
  },
  {
    id: 'facebook-autoposter',
    title: 'Facebook Marketplace Autoposter',
    category: 'Social Marketing',
    badge: 'POPULAR 📱',
    icon: '📲',
    desc: 'Learn how to automate Facebook Marketplace postings using the MarketSync Chrome Extension and AI descriptions.',
    lessons: [
      { num: '1', title: 'Chrome Extension Connection', desc: 'Install and authenticate the MarketSync Extension.' },
      { num: '2', title: 'AI Vehicle Description Setup', desc: 'Auto-generate Facebook compliant sales descriptions with VIN details.' },
      { num: '3', title: '1-Click Marketplace Execution', desc: 'Queue and post vehicle listings safely with automatic anti-ban throttling.' }
    ]
  },
  {
    id: 'website-builder',
    title: 'Dealership Visual Website Builder',
    category: 'Digital Showroom',
    badge: 'ESSENTIAL 🌐',
    icon: '🎨',
    desc: 'Build custom dealership pages with Elementor-style visual palette, AI layout generator, and custom domain setup.',
    lessons: [
      { num: '1', title: 'Elementor Palette & Section Ordering', desc: 'Add Banners, Inventory Grid, Reviews, and Contact Forms.' },
      { num: '2', title: '✨ AI Build Layout Copilot', desc: 'Construct a high-converting 5-section homepage in 1 click.' },
      { num: '3', title: 'Custom Domain & SSL Setup', desc: 'Claim your web slug and point custom domain records.' }
    ]
  },
  {
    id: 'ai-chatbot',
    title: '24/7 AI Assistant & Web Widget',
    category: 'Lead Capture',
    badge: 'AI DRIVEN 🤖',
    icon: '💬',
    desc: 'Install AI chat widget, train inventory knowledge base, and auto-book test drive appointments.',
    lessons: [
      { num: '1', title: 'Widget Embedding', desc: 'Paste 1-line script onto your website or LeadBox page.' },
      { num: '2', title: 'Knowledge Base & Inventory Sync', desc: 'Train AI assistant on store pricing, store hours, and specs.' },
      { num: '3', title: 'Automated Calendar Booking', desc: 'Set up automated test drive booking straight to rep calendars.' }
    ]
  },
  {
    id: 'sales-leaderboard',
    title: 'Sales Leaderboard & TV Display',
    category: 'Team Performance',
    badge: 'GAMIFIED 🏆',
    icon: '📊',
    desc: 'Project live sales rankings, gross profit tracking, and rep leaderboards onto showroom TV screens.',
    lessons: [
      { num: '1', title: 'Dealership & Global Rankings', desc: 'Compare store sales reps against store and nationwide rankings.' },
      { num: '2', title: 'Showroom TV Display Mode', desc: 'Launch full-screen high-contrast display for floor monitors.' }
    ]
  }
];

function loadAcademyPage() {
  const container = document.getElementById('page-content-academy') || document.getElementById('page-content');
  if (!container) return;

  const bBrand = typeof getDealerBranding === 'function' ? getDealerBranding() : { name: 'MarketSync Motors' };

  const courseCards = ACADEMY_COURSES.map((c, i) => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="px-2.5 py-1 text-[11px] font-extrabold rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">${c.category}</span>
          <span class="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">${c.badge}</span>
        </div>
        <div class="flex items-start gap-3">
          <span class="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black text-xl shrink-0">${c.icon}</span>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white leading-snug">${esc(c.title)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${esc(c.desc)}</p>
          </div>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          <div class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Course Syllabus (${c.lessons.length} Modules)</div>
          ${c.lessons.map(l => `
            <div class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span class="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-[10px]">${l.num}</span>
              <span class="font-bold truncate">${esc(l.title)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
        <button onclick="openAcademyCourseModal(${i})" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5">🎓 Start Course &amp; Earn Certificate</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div class="relative z-10 max-w-2xl space-y-3">
          <span class="px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">🎓 MarketSync Masterclass Academy</span>
          <h1 class="text-2xl sm:text-4xl font-black leading-tight text-white">Dealership Training &amp; Official Certifications</h1>
          <p class="text-sm text-slate-300 leading-relaxed">Master modern dealership tools including Mailchimp-style Email Marketing, Facebook Autoposter, AI ChatBot, Website Builder, and Sales Leaderboards. Earn official completion credentials and add them directly to your LinkedIn resume!</p>
          <div class="pt-2 flex items-center gap-3">
            <button onclick="openAcademyCertificateModal('Certified Digital Dealership Specialist')" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg transition flex items-center gap-2">📜 View Sample Printable Diploma</button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${courseCards}
      </div>
    </div>
  `;
}
window.loadAcademyPage = loadAcademyPage;

function openAcademyCourseModal(courseIdx) {
  const c = ACADEMY_COURSES[courseIdx];
  if (!c) return;

  const modalHtml = `
    <div class="flex flex-col h-[85vh] max-h-[750px]">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">${c.icon}</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">${esc(c.title)}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">${esc(c.category)} · Official Certification Module</p>
          </div>
        </div>
        <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2">✕</button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-4 my-2 scrollbar-thin">
        <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
          <p class="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">${esc(c.desc)}</p>
        </div>

        <div class="space-y-3">
          <div class="text-xs font-black uppercase tracking-wider text-slate-400">Interactive Syllabus &amp; Key Takeaways</div>
          ${c.lessons.map(l => `
            <div class="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">${l.num}</span>
                <span class="font-extrabold text-xs text-slate-900 dark:text-white">${esc(l.title)}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 pl-7 leading-relaxed">${esc(l.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between gap-3">
        <span class="text-xs text-slate-500">100% Completion unlocks official certificate</span>
        <button onclick="openAcademyCertificateModal('Certified ${esc(c.title)}')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition flex items-center gap-1.5">🏆 Complete Course &amp; Issue Diploma</button>
      </div>
    </div>
  `;
  automationModal(modalHtml, 'max-w-3xl');
}
window.openAcademyCourseModal = openAcademyCourseModal;

function openAcademyCertificateModal(courseTitle = 'Certified Email Marketing & Campaign Specialist') {
  const modal = document.getElementById('academy-certificate-modal');
  if (!modal) return;
  const bBrand = typeof getDealerBranding === 'function' ? getDealerBranding() : { name: 'MarketSync Motors' };
  const userObj = (typeof profileContext === 'object' && profileContext?.user) ? profileContext.user : {};
  const studentName = userObj.first_name ? `${userObj.first_name} ${userObj.last_name || ''}` : 'Certified Specialist';

  const nameEl = document.getElementById('cert-student-name');
  if (nameEl) nameEl.textContent = studentName;
  const courseEl = document.getElementById('cert-course-name');
  if (courseEl) courseEl.textContent = courseTitle;

  const linkedinBtn = document.getElementById('cert-linkedin-btn');
  if (linkedinBtn) {
    const certUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(courseTitle)}&organizationName=${encodeURIComponent(bBrand.name)}&issueYear=${new Date().getFullYear()}&issueMonth=${new Date().getMonth() + 1}`;
    linkedinBtn.href = certUrl;
  }

  modal.classList.remove('hidden');
}
window.openAcademyCertificateModal = openAcademyCertificateModal;

function closeAcademyCertificateModal() {
  const modal = document.getElementById('academy-certificate-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeAcademyCertificateModal = closeAcademyCertificateModal;

function showThingsToKnowModal(deptId) {
  const config = DEPARTMENTS_CONFIG[deptId];
  if (!config) return;
  __activeOpenDeptId = deptId;

  const titleEl = document.getElementById('ttk-dept-title');
  if (titleEl) titleEl.textContent = `Opening ${config.title}`;
  const iconEl = document.getElementById('ttk-dept-badge-icon');
  if (iconEl) iconEl.textContent = config.badgeIcon || '🛡️';

  const stagesContainer = document.getElementById('ttk-workflow-stages');
  if (stagesContainer) {
    stagesContainer.innerHTML = (config.stages || []).map(s => `
      <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
        <div class="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center mb-2">${s.num}</div>
        <div class="text-xs font-bold text-slate-900 dark:text-white">${s.title}</div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${s.desc}</div>
      </div>
    `).join('');
  }

  const tutorialList = document.getElementById('ttk-tutorial-list');
  if (tutorialList) {
    tutorialList.innerHTML = (config.tutorials || []).map(t => `
      <li class="flex items-start gap-2 text-xs">
        <svg class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
        <span>${t}</span>
      </li>
    `).join('');
  }

  const modal = document.getElementById('dept-things-to-know-modal');
  if (modal) modal.classList.remove('hidden');
}
window.showThingsToKnowModal = showThingsToKnowModal;

function closeThingsToKnowModal() {
  const modal = document.getElementById('dept-things-to-know-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeThingsToKnowModal = closeThingsToKnowModal;

function startDepartmentTourAndWizard() {
  closeThingsToKnowModal();
  const deptId = __activeOpenDeptId;
  if (!deptId) return;
  try { localStorage.setItem(`ms_dept_opened_${deptId}`, '1'); } catch {}
  if (typeof window.startAreaTour === 'function') {
    window.startAreaTour(deptId);
  }
}
window.startDepartmentTourAndWizard = startDepartmentTourAndWizard;

function openDepartmentSetupWizard(deptId) {
  const config = DEPARTMENTS_CONFIG[deptId || __activeOpenDeptId] || DEPARTMENTS_CONFIG['crm'];
  if (!config) return;
  __activeOpenDeptId = config.id;

  const tagEl = document.getElementById('dsw-dept-tag');
  if (tagEl) tagEl.textContent = `${config.title} · Setup Wizard`;
  const titleEl = document.getElementById('dsw-dept-title');
  if (titleEl) titleEl.textContent = `Configure ${config.title}`;

  let sharedStore = {};
  try { sharedStore = JSON.parse(localStorage.getItem('ms_shared_dealer_data') || '{}'); } catch {}

  const fieldsContainer = document.getElementById('dsw-fields-container');
  if (fieldsContainer) {
    if (config.fields && config.fields.length > 0) {
      fieldsContainer.innerHTML = (config.fields || []).map(f => {
        const val = (f.sharedKey && sharedStore[f.sharedKey]) ? sharedStore[f.sharedKey] : '';
        return `
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              ${f.label} ${f.sharedKey ? '<span class="text-[10px] text-amber-500 font-semibold">(Auto-Synced)</span>' : ''}
            </label>
            <input type="text" data-field-key="${f.key}" data-shared-key="${f.sharedKey || ''}" value="${val}" placeholder="${f.placeholder || ''}" oninput="handleSharedDataInput('${f.sharedKey || ''}', this)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
          </div>
        `;
      }).join('');
    } else {
      fieldsContainer.innerHTML = `
        <div class="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 text-center space-y-2">
          <div class="text-3xl">🏆</div>
          <div class="font-black text-sm text-violet-900 dark:text-violet-200">No Configuration Inputs Required</div>
          <div class="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Use the top tabs on the Leaderboard page to switch between <b>Dealership Store View</b> (internal team rankings) and <b>Global Network View</b> (store vs store nationwide). Click <b>Done</b> below to complete overview.
          </div>
        </div>
      `;
    }
  }

  const modal = document.getElementById('dept-setup-wizard-modal');
  if (modal) modal.classList.remove('hidden');
}
window.openDepartmentSetupWizard = openDepartmentSetupWizard;

function closeSetupWizardModal() {
  const modal = document.getElementById('dept-setup-wizard-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeSetupWizardModal = closeSetupWizardModal;

function handleSharedDataInput(sharedKey, el) {
  if (!sharedKey || !el) return;
  syncSharedDealerData(sharedKey, el.value);
}
window.handleSharedDataInput = handleSharedDataInput;

function syncSharedDealerData(key, value) {
  if (!key) return;
  try {
    let sharedStore = JSON.parse(localStorage.getItem('ms_shared_dealer_data') || '{}');
    sharedStore[key] = value;
    localStorage.setItem('ms_shared_dealer_data', JSON.stringify(sharedStore));
    document.querySelectorAll(`input[data-shared-key="${key}"]`).forEach(inp => {
      if (inp !== document.activeElement) inp.value = value;
    });
  } catch {}
}
window.syncSharedDealerData = syncSharedDealerData;

function completeDepartmentWizard() {
  closeSetupWizardModal();
  const deptId = __activeOpenDeptId;
  if (!deptId) return;
  try { localStorage.setItem(`ms_dept_opened_${deptId}`, '1'); } catch {}
  awardDealerBadge(deptId);
  if (typeof renderSetupBar === 'function') renderSetupBar();
}
window.completeDepartmentWizard = completeDepartmentWizard;

function awardDealerBadge(deptId) {
  const config = DEPARTMENTS_CONFIG[deptId];
  if (!config) return;

  try {
    let badges = JSON.parse(localStorage.getItem('ms_unlocked_badges') || '[]');
    if (!badges.includes(deptId)) {
      badges.push(deptId);
      localStorage.setItem('ms_unlocked_badges', JSON.stringify(badges));
    }
  } catch {}

  const iconEl = document.getElementById('dbr-badge-icon');
  if (iconEl) iconEl.textContent = config.badgeIcon || '🛡️';
  const titleEl = document.getElementById('dbr-badge-title');
  if (titleEl) titleEl.textContent = config.badgeTitle || 'Department Specialist';
  const descEl = document.getElementById('dbr-badge-desc');
  if (descEl) descEl.textContent = config.badgeDesc || `You have completed setup for ${config.title}!`;

  const modal = document.getElementById('dealer-badge-reveal-modal');
  if (modal) modal.classList.remove('hidden');

  if (typeof window.fireConfetti === 'function') {
    window.fireConfetti();
  }
}
window.awardDealerBadge = awardDealerBadge;

function closeBadgeRevealModal() {
  const modal = document.getElementById('dealer-badge-reveal-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeBadgeRevealModal = closeBadgeRevealModal;

function renderSettingsHrCard() {
  const card = document.getElementById('settings-hr-card');
  if (!card) return;
  const employees = typeof getPeopleComplianceData === 'function' ? getPeopleComplianceData() : [];
  const activeCount = employees.filter(e => e.status === 'Active').length;
  const expiringLicences = employees.filter(e => e.licence_status && e.licence_status.includes('Expiring')).length;

  card.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">👥</div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">People &amp; Compliance (HR Engine)</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Employee profiles, driver licence tracking, safety policy e-signatures &amp; automated HR workflows.</p>
          </div>
        </div>
        <button onclick="switchPage('people-compliance')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition">Open Full HR Workspace 👥</button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="text-slate-400 font-bold">Active Staff</div>
          <div class="text-xl font-black text-slate-900 dark:text-white mt-1">${activeCount} Members</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="text-slate-400 font-bold">Expiring Licences</div>
          <div class="text-xl font-black text-amber-500 mt-1">${expiringLicences} Expiring</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="text-slate-400 font-bold">WHMIS / Safety</div>
          <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">100% Up-to-date</div>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="text-slate-400 font-bold">Compliance Score</div>
          <div class="text-xl font-black text-emerald-600 mt-1">96.4%</div>
        </div>
      </div>

      <div class="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800 rounded-xl text-xs space-y-2">
        <div class="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
          <span>⚡ HR &amp; Security Automation Triggers</span>
          <span class="text-[10px] text-emerald-600 font-bold uppercase">Active</span>
        </div>
        <div class="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
          New hire account auto-provisioning, sales rep store transfer, licence expiration alerts, and 1-click employee offboarding security kill-switch are enabled.
        </div>
      </div>
    </div>
  `;
}
window.renderSettingsHrCard = renderSettingsHrCard;

const DEFAULT_EMPLOYEES = [
  {
    id: 'emp-101',
    first_name: 'Marcus',
    last_name: 'Vance',
    email: 'marcus.vance@dealership.com',
    phone: '(555) 234-5678',
    role: 'General Sales Manager',
    department: 'Sales',
    location: 'Main Showroom',
    manager: 'Dealership Principal',
    emp_type: 'Full-Time Permanent',
    status: 'Active',
    start_date: '2021-03-15',
    licence_no: 'DL-8934201-ON',
    licence_expiry: '2027-11-20',
    licence_status: 'Valid',
    abstract_date: '2024-01-10',
    comp_plan: 'Management Gross Tier',
    compliance_docs: [
      { name: 'Employment Agreement', signed: true, date: '2021-03-15' },
      { name: 'Workplace Harassment Policy (Bill 168)', signed: true, date: '2023-09-01' },
      { name: 'Demo Drive & Fleet Policy', signed: true, date: '2023-09-01' }
    ],
    training: [
      { name: 'WHMIS 2015 Certification', completed: true, expiry: '2026-09-01' },
      { name: 'Workplace Harassment (Bill 168)', completed: true, expiry: '2025-09-01' },
      { name: 'Demo Driver Safety', completed: true, expiry: '2026-05-15' }
    ],
    assets: ['Dealership iPhone 15', 'Showroom iPad Pro', 'Keys to Demo Unit 2024 F-150'],
    perf: { units_mtd: 18, gross_mtd: 42500, active_leads: 34, comm_mtd: 8400, rating: 'Top Producer' },
    emergency: { name: 'Sarah Vance', relation: 'Spouse', phone: '(555) 987-6543' }
  },
  {
    id: 'emp-102',
    first_name: 'Sarah',
    last_name: 'Jenkins',
    email: 's.jenkins@dealership.com',
    phone: '(555) 345-6789',
    role: 'Senior Sales Representative',
    department: 'Sales',
    location: 'Main Showroom',
    manager: 'Marcus Vance',
    emp_type: 'Full-Time Permanent',
    status: 'Active',
    start_date: '2022-06-01',
    licence_no: 'DL-4482910-ON',
    licence_expiry: '2028-04-14',
    licence_status: 'Valid',
    abstract_date: '2024-02-15',
    comp_plan: 'Standard Sales Tier A',
    compliance_docs: [
      { name: 'Employment Agreement', signed: true, date: '2022-06-01' },
      { name: 'Workplace Harassment Policy (Bill 168)', signed: true, date: '2023-09-01' }
    ],
    training: [
      { name: 'WHMIS 2015 Certification', completed: true, expiry: '2026-06-01' },
      { name: 'EV High-Voltage Safety', completed: true, expiry: '2026-01-10' }
    ],
    assets: ['Showroom iPad Air', 'Sales Desk Locker Key'],
    perf: { units_mtd: 14, gross_mtd: 31200, active_leads: 28, comm_mtd: 6100, rating: 'Exceeds Expectations' },
    emergency: { name: 'David Jenkins', relation: 'Brother', phone: '(555) 876-5432' }
  },
  {
    id: 'emp-103',
    first_name: 'David',
    last_name: 'Miller',
    email: 'd.miller@dealership.com',
    phone: '(555) 456-7890',
    role: 'F&I Finance Manager',
    department: 'Finance',
    location: 'Finance Office B',
    manager: 'Marcus Vance',
    emp_type: 'Full-Time Permanent',
    status: 'Active',
    start_date: '2020-01-10',
    licence_no: 'DL-1192834-ON',
    licence_expiry: '2026-08-30',
    licence_status: 'Valid',
    abstract_date: '2024-01-05',
    comp_plan: 'F&I Reserve Tier',
    compliance_docs: [
      { name: 'Employment Agreement', signed: true, date: '2020-01-10' },
      { name: 'PIPEDA Customer Privacy Policy', signed: true, date: '2023-11-15' }
    ],
    training: [
      { name: 'PIPEDA Customer Privacy', completed: true, expiry: '2025-11-15' },
      { name: 'WHMIS 2015 Certification', completed: true, expiry: '2026-01-10' }
    ],
    assets: ['Secure Finance Workstation', 'Digital Signature Pad'],
    perf: { units_mtd: 22, gross_mtd: 58000, active_leads: 19, comm_mtd: 11200, rating: 'Top Producer' },
    emergency: { name: 'Elena Miller', relation: 'Spouse', phone: '(555) 765-4321' }
  },
  {
    id: 'emp-104',
    first_name: 'Elena',
    last_name: 'Rostova',
    email: 'e.rostova@dealership.com',
    phone: '(555) 567-8901',
    role: 'Service Manager & Master Tech',
    department: 'Service',
    location: 'Service Bay 1',
    manager: 'General Manager',
    emp_type: 'Full-Time Permanent',
    status: 'Active',
    start_date: '2019-08-20',
    licence_no: 'DL-7728193-ON',
    licence_expiry: '2027-02-18',
    licence_status: 'Valid',
    abstract_date: '2024-03-01',
    comp_plan: 'Service Department Labor Tier',
    compliance_docs: [
      { name: 'Employment Agreement', signed: true, date: '2019-08-20' },
      { name: 'JHSC Safety Responsibilities', signed: true, date: '2024-01-15' }
    ],
    training: [
      { name: 'Automotive Hoist Safety Inspection', completed: true, expiry: '2026-03-01' },
      { name: 'EV High-Voltage Rescue Protocol', completed: true, expiry: '2026-08-20' },
      { name: 'WHMIS 2015 Certification', completed: true, expiry: '2026-08-20' }
    ],
    assets: ['Diagnostic Scanner Tablet', 'Master Shop Keycard', 'JHSC Inspection Clipboard'],
    perf: { units_mtd: 142, gross_mtd: 89000, active_leads: 12, comm_mtd: 9500, rating: 'Top Producer' },
    emergency: { name: 'Igor Rostov', relation: 'Father', phone: '(555) 654-3210' }
  }
];
window.DEFAULT_EMPLOYEES = DEFAULT_EMPLOYEES;

function getPeopleComplianceData() {
  if (!window.__peopleComplianceEmployees) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('ms_people_employees')); } catch {}
    window.__peopleComplianceEmployees = (saved && Array.isArray(saved) && saved.length > 0) ? saved : JSON.parse(JSON.stringify(DEFAULT_EMPLOYEES));
  }
  return window.__peopleComplianceEmployees;
}
window.getPeopleComplianceData = getPeopleComplianceData;

function loadPeopleCompliance() {
  const container = document.getElementById('people-compliance-root') || document.getElementById('page-content');
  if (!container) return;
  renderPeopleCompliance();
}
let __peopleComplianceView = 'overview';
window.__peopleComplianceView = __peopleComplianceView;

function renderPeopleCompliance() {
  const root = document.getElementById('people-compliance-root');
  if (!root) return;

  const employees = getPeopleComplianceData();
  const v = __peopleComplianceView;

  const tabPill = (id, label, icon) => `
    <button onclick="setPeopleComplianceView('${id}')" class="px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${v === id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">
      <span>${icon}</span><span>${label}</span>
    </button>
  `;

  root.innerHTML = `
    <div class="space-y-6 max-w-7xl mx-auto">
      <!-- Header Bar -->
      <div class="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl shadow-inner">👥</div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">People &amp; Compliance Engine</h1>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Operational HR</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Unified employee profiles, licence &amp; safety compliance, and automated dealership HR workflows.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="openAddEmployeeModal()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5">＋ Onboard Employee</button>
          <button onclick="openLogIncidentModal()" class="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-500/20 transition flex items-center gap-1.5">📋 Log Safety Incident</button>
        </div>
      </div>

      <!-- 5 Standard Engine Navigation Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        ${tabPill('overview', 'Overview', '📊')}
        ${tabPill('people', 'People & Profiles', '👥')}
        ${tabPill('compliance', 'Compliance & Training', '🛡️')}
        ${tabPill('automation', 'HR Workflows', '⚡')}
        ${tabPill('settings', 'Engine Settings', '⚙️')}
      </div>

      <div id="people-compliance-body"></div>
    </div>
  `;

  const body = document.getElementById('people-compliance-body');
  if (!body) return;

  if (v === 'overview') renderPeopleOverview(body, employees);
  if (v === 'people') renderPeopleDirectory(body, employees);
  if (v === 'compliance') renderPeopleComplianceTab(body, employees);
  if (v === 'automation') renderPeopleAutomation(body, employees);
  if (v === 'settings') renderPeopleSettings(body, employees);
}