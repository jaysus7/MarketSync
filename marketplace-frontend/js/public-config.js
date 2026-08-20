/**
 * MarketSync Public Platform & Pricing Configuration (Single Canonical Source of Truth)
 *
 * All CAD prices, product catalogs, suite definitions, and DealerOS tiers are defined here.
 * Any public page rendering pricing or product cards MUST reference this configuration.
 *
 * RULES:
 * 1. ALL prices are CAD per month.
 * 2. NO emojis anywhere in copy or metadata.
 * 3. Campaigns — Email + SMS is $199/mo + usage.
 */

const MARKETSYNC_PRICING = {
  currency: 'CAD',
  period: 'month',

  // Layer 1: Standalone Products
  standalone: [
    {
      id: 'design-studio',
      name: 'Design Studio',
      price: 19.99,
      priceFormatted: '$19.99',
      unit: '/month',
      badge: 'Creative Workspace',
      desc: 'Dealership design workspace for creating branded graphics, social assets, and marketing collateral — with AI generation and a social scheduler built in, one flat price.',
      features: [
        'Branded creative templates',
        'Typography & logo asset vault',
        'Social media graphics builder',
        'Freeform design canvas',
        'AI-generated images, layouts & copy',
        'Multi-platform social scheduler & calendar',
        'Intelligence by MarketSync asset suggestions'
      ],
      ctaText: 'Start Design Studio',
      ctaUrl: '/register.html?plan=design-studio'
    },
    {
      id: 'autoposter-salesperson',
      name: 'Facebook AutoPoster — Salesperson',
      price: 39,
      priceFormatted: '$39',
      unit: '/month',
      badge: 'Sales Rep Essential',
      desc: 'Individual inventory posting assistant for automotive sales representatives on Facebook Marketplace.',
      features: [
        'Salesperson inventory access',
        'Facebook Marketplace workflow assistant',
        'Automated listing copy generator',
        'Salesperson activity tracking',
        'Marketplace response templates'
      ],
      ctaText: 'Get AutoPoster Rep',
      ctaUrl: '/register.html?plan=autoposter-salesperson'
    },
    {
      id: 'autoposter-dealer',
      name: 'Facebook AutoPoster — Dealer',
      price: 149,
      priceFormatted: '$149',
      unit: '/month',
      badge: 'Dealership Hub',
      desc: 'Centralized Facebook Marketplace inventory distribution for the whole sales team.',
      features: [
        'Full lot inventory syndication',
        'Team-wide Marketplace management',
        'Sales rep listing approval workflows',
        'Centralized inventory lead routing',
        'Salesperson leaderboard & tracking'
      ],
      ctaText: 'Get AutoPoster Dealer',
      ctaUrl: '/register.html?plan=autoposter-dealer'
    },
    {
      id: 'video',
      name: 'Video',
      price: 149,
      priceFormatted: '$149',
      unit: '/month',
      badge: 'Video Marketing',
      desc: 'Vehicle walkaround, customer presentation, and social video creation suite.',
      features: [
        'Vehicle walkaround recording assistant',
        'Branded video overlays & lower thirds',
        'Automated video captions',
        'Video email & SMS delivery links',
        'Video view engagement analytics'
      ],
      ctaText: 'Start Video Suite',
      ctaUrl: '/register.html?plan=video'
    },
    {
      id: 'campaigns-email-sms',
      name: 'Campaigns — Email + SMS',
      price: 199,
      priceFormatted: '$199',
      unit: '/month + usage',
      badge: 'Automated Messaging',
      desc: 'Targeted email and SMS marketing campaigns with intelligent audience segmentation.',
      features: [
        'Email campaign builder & templates',
        'SMS broadcast & automated follow-ups',
        'Audience segmentation engine',
        'Open, click & conversion analytics',
        'Intelligence by MarketSync timing'
      ],
      ctaText: 'Start Campaigns',
      ctaUrl: '/register.html?plan=campaigns-email-sms'
    },
    {
      id: 'dealer-website',
      name: 'Dealer Website',
      price: 249,
      priceFormatted: '$249',
      unit: '/month',
      badge: 'Digital Showroom',
      desc: 'High-performance dealership website platform with live inventory VDPs and lead capture.',
      features: [
        'Live inventory & VDP showroom',
        'Custom domain & SSL included',
        'Mobile-first responsive UX',
        'AI ChatBot integration ready',
        'Automotive SEO optimization'
      ],
      ctaText: 'Get Dealer Website',
      ctaUrl: '/register.html?plan=dealer-website'
    },
    {
      id: 'ai-chatbot',
      name: 'AI ChatBot',
      price: 599,
      priceFormatted: '$599',
      unit: '/month',
      badge: '24/7 Automotive Assistant',
      desc: 'Automotive AI customer engagement assistant trained on your inventory and dealership info.',
      features: [
        'Real-time inventory lookup',
        'Test drive & appointment scheduling',
        'Trade appraisal intake',
        '24/7 lead capture & CRM routing',
        'Dealership knowledgebase responses'
      ],
      ctaText: 'Deploy AI ChatBot',
      ctaUrl: '/register.html?plan=ai-chatbot'
    },
    {
      id: 'marketsync-seo',
      name: 'MarketSync SEO',
      price: 149,
      priceFormatted: '$149',
      unit: '/month',
      badge: 'AI SEO Platform',
      desc: 'Complete automotive AI SEO command center, automated daily monitoring, auto-fix engine, local & inventory SEO rules, and CRM revenue attribution.',
      features: [
        'AI SEO Command Center & Daily Audit',
        'Automated Safe Fix Engine (Auto-Fix Safe)',
        'Local SEO & AutoDealer Schema Generator',
        'Inventory SEO Lifecycle Rules (Active, Sold, Removed)',
        'Competitor Search Tracking & Keyword Gaps',
        'AI Search Readiness & llms.txt Management',
        'CRM Organic Lead & Deal Revenue Attribution'
      ],
      ctaText: 'Get MarketSync SEO',
      ctaUrl: '/register.html?plan=marketsync-seo'
    }
  ],

  // Layer 2: Marketing Suites
  suites: [
    {
      id: 'sales-marketing-suite',
      name: 'Sales Marketing Suite',
      price: 399,
      priceFormatted: '$399',
      unit: '/month',
      badge: 'Sales Growth Pack',
      desc: 'Connected marketing suite for dealership sales teams to capture, nurture, and close leads.',
      includedItems: [
        'Design Studio ($19.99/mo value, with social scheduler & AI included)',
        'Facebook AutoPoster Dealer ($149/mo value)',
        'Campaigns — Email + SMS ($199/mo value)'
      ],
      idealFor: 'Dealership sales departments seeking high-volume lead generation.',
      ctaText: 'Get Sales Suite',
      ctaUrl: '/register.html?plan=sales-marketing-suite'
    },
    {
      id: 'service-marketing-suite',
      name: 'Service Marketing Suite',
      price: 399,
      priceFormatted: '$399',
      unit: '/month',
      badge: 'Fixed Ops Retention',
      desc: 'Customer retention and service marketing platform for service drive revenue growth.',
      includedItems: [
        'Service reminder campaigns',
        'Dormant customer reactivation SMS/email',
        'Service promo landing pages',
        'Customer satisfaction survey loops',
        'Intelligence service recommendations'
      ],
      idealFor: 'Service departments driving customer retention and RO gross profit.',
      ctaText: 'Get Service Suite',
      ctaUrl: '/register.html?plan=service-marketing-suite'
    },
    {
      id: 'complete-marketing-suite',
      name: 'Complete Marketing Suite',
      price: 699,
      priceFormatted: '$699',
      unit: '/month',
      badge: 'All-In-One Marketing',
      desc: 'Full-spectrum connected marketing platform combining Sales, Service, Video, and Social.',
      includedItems: [
        'Sales Marketing Suite ($399/mo value)',
        'Service Marketing Suite ($399/mo value)',
        'Video Suite ($149/mo value)',
        'Intelligence by MarketSync Campaign AI'
      ],
      idealFor: 'Full dealerships replacing multiple standalone marketing tools.',
      ctaText: 'Get Complete Marketing Suite',
      ctaUrl: '/register.html?plan=complete-marketing-suite',
      featured: true
    },
    {
      id: 'marketsync-digital',
      name: 'MarketSync Digital',
      price: 1199,
      priceFormatted: '$1,199',
      unit: '/month',
      badge: 'Complete Digital Presence',
      desc: 'Complete Marketing Suite + Dealer Website + AI ChatBot in one unified platform.',
      includedItems: [
        'Complete Marketing Suite ($699/mo value)',
        'Dealer Website ($249/mo value)',
        'AI ChatBot ($599/mo value)',
        'Unified Digital Dashboard & CRM Lead Sync'
      ],
      idealFor: 'Dealerships seeking a modern website and 360-degree digital growth platform.',
      ctaText: 'Get MarketSync Digital',
      ctaUrl: '/register.html?plan=marketsync-digital',
      flagshipBadge: 'Flagship Digital Package'
    }
  ],

  // Layer 3: Flagship DealerOS Operating System
  dealerOS: [
    {
      id: 'dealer-os-core',
      name: 'DealerOS Core',
      price: 1499,
      priceFormatted: '$1,499',
      unit: '/month',
      badge: 'Connected OS Base',
      desc: 'The connected dealership operating system bringing Sales, CRM, Inventory, and Workflows together.',
      features: [
        'Connected Automotive CRM & Pipeline',
        'Inventory Management & VinSticker',
        'Sales Marketing Suite Included',
        'Desking & Trade Appraisals',
        'Manager Command Center & Reporting',
        'Standard Onboarding & Support'
      ],
      ctaText: 'Book Core Demo',
      ctaUrl: '/demo.html?plan=dealer-os-core'
    },
    {
      id: 'dealer-os-pro',
      name: 'DealerOS Pro',
      price: 2499,
      priceFormatted: '$2,499',
      unit: '/month',
      badge: 'Expanded Departments',
      desc: 'Comprehensive dealership operating system adding Fixed Ops, F&I, Parts, and MarketSync Digital.',
      features: [
        'All DealerOS Core Features',
        'Service & Parts Department Workspaces',
        'F&I Deal Structuring & Lender Submissions',
        'MarketSync Digital Suite Included ($1,199/mo value)',
        'HR Dossier & Staff Directory',
        'Priority Phone & Dedicated Onboarding'
      ],
      ctaText: 'Book Pro Demo',
      ctaUrl: '/demo.html?plan=dealer-os-pro',
      recommended: true
    },
    {
      id: 'dealer-os-complete',
      name: 'DealerOS Complete',
      price: 3999,
      priceFormatted: '$3,999',
      unit: '/month',
      badge: 'Flagship Enterprise OS',
      desc: 'The complete enterprise operating system for full dealership groups with unlimited intelligence.',
      features: [
        'Full DealerOS Pro Platform',
        'Accounting Ledger & General Ledger Sync',
        'Unlimited Intelligence by MarketSync AI',
        'Multi-Store & Dealership Group Aggregation',
        'Custom API Integrations & Webhooks',
        '24/7 Executive Support & Dedicated Manager'
      ],
      ctaText: 'Book Enterprise Demo',
      ctaUrl: '/demo.html?plan=dealer-os-complete',
      flagship: true
    }
  ]
};

if (typeof window !== 'undefined') {
  window.MARKETSYNC_PRICING = MARKETSYNC_PRICING;
}
