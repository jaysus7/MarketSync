import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { PLAN_CATALOG } from '../plan-catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load frontend modules in a sandbox environment
function createFrontendSandbox(overrides = {}) {
  const sandbox = {
    window: {
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    document: {
      documentElement: {
        getAttribute: (attr) => {
          if (attr === 'data-product') return sandbox.__productAttr || '';
          if (attr === 'data-package') return sandbox.__packageAttr || '';
          if (attr === 'data-dash-mode') return sandbox.__dashModeAttr || '';
          if (attr === 'data-dash-owner') return sandbox.__dashOwnerAttr || '';
          return null;
        },
        setAttribute: () => {},
        removeAttribute: () => {}
      },
      getElementById: (id) => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, appendChild: () => {} }),
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { hostname: 'localhost', href: '', pathname: '', search: '', hash: '' },
      body: { style: {}, appendChild: () => {} }
    },
    location: { hostname: 'localhost', href: '', pathname: '', search: '', hash: '' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    fetch: () => Promise.resolve({ ok: true, json: async () => ({}) }),
    setTimeout: (fn) => typeof fn === 'function' && fn(),
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    console: console,
    profileContext: overrides.profileContext || null,
    __demoActiveProduct: overrides.__demoActiveProduct || null,
    __demoActivePackage: overrides.__demoActivePackage || null,
    __access: overrides.__access || null,
    __productAttr: overrides.productAttr || '',
    __packageAttr: overrides.packageAttr || '',
    __dashModeAttr: '',
    __dashOwnerAttr: '',
    __fbOnly: false,
    __staffAllowedPages: null,
    __productAllowedPages: null,
    __deptRegistry: null,
    __deptNavBuilt: false,
    __currentPage: 'marketing-overview',
    DEPARTMENTS: {},
    ENGINE_ACCENTS: {},
    svgIcon: (icon) => `<svg>${icon}</svg>`,
    esc: (str) => String(str || ''),
    showToast: () => {},
    ENGINES: {},
    ENGINE_STATE: {},
    ENGINE_DATA: {},
    apiGetJson: async () => ({}),
    apiSendJson: async () => ({})
  };

  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};

  // Load marketing-workspace.js
  const mktCode = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/js/modules/marketing-workspace.js'), 'utf8');
  vm.runInNewContext(mktCode, sandbox);

  // Load dashboard-part2.js
  const d2Code = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js'), 'utf8');
  vm.runInNewContext(d2Code, sandbox);

  // Load dashboard.js (relevant parts for restrictedNavPages)
  const dCode = fs.readFileSync(path.join(__dirname, '../../marketplace-frontend/dashboard.js'), 'utf8');
  vm.runInNewContext(dCode, sandbox);

  return sandbox;
}

test('Marketing Suites Plan Catalog definitions adhere to product boundaries', (t) => {
  const sales = PLAN_CATALOG['sales-marketing-suite'];
  const service = PLAN_CATALOG['service-marketing-suite'];
  const complete = PLAN_CATALOG['complete-marketing-suite'];
  const digital = PLAN_CATALOG['marketsync-digital'];

  assert.ok(sales, 'Sales Marketing Suite must exist in plan catalog');
  assert.ok(service, 'Service Marketing Suite must exist in plan catalog');
  assert.ok(complete, 'Complete Marketing Suite must exist in plan catalog');
  assert.ok(digital, 'MarketSync Digital must exist in plan catalog');

  // Pricing verification ($399, $399, $699, $1199)
  assert.equal(sales.monthly, 399);
  assert.equal(service.monthly, 399);
  assert.equal(complete.monthly, 699);
  assert.equal(digital.monthly, 1199);

  // Check product inclusions
  assert.deepEqual(sales.products, ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video']);
  assert.deepEqual(service.products, ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video']);
  assert.deepEqual(complete.products, ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video']);
  assert.deepEqual(digital.products, ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer', 'marketsync_seo']);
});

test('Sales Marketing Suite navigation and workspace isolation', (t) => {
  const sandbox = createFrontendSandbox({
    productAttr: 'sales-marketing-suite',
    profileContext: { package_id: 'sales-marketing-suite', role: 'DEALER_ADMIN' },
    __access: {
      products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'sales_marketing_suite'],
      features: ['email.automations', 'social.scheduler', 'video.create']
    }
  });

  const ctx = sandbox.resolveWorkspaceContext();
  assert.equal(ctx.type, 'marketing_suite');
  assert.equal(ctx.suite, 'sales');

  // DealerOS nav must be blocked
  assert.equal(sandbox.deptNavEligible('DEALER_ADMIN'), false);

  const pages = sandbox.restrictedNavPages();
  assert.ok(Array.isArray(pages));

  const pageLabels = pages.map(p => p.label);
  
  // Major areas flatten to these canonical page-header destinations for mobile/More.
  assert.ok(pageLabels.includes('Pulse'));
  assert.ok(pageLabels.includes('Sales Marketing'));
  assert.ok(pageLabels.includes('Campaigns'));
  assert.ok(pageLabels.includes('Automations'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Social Scheduler'));
  assert.ok(pageLabels.includes('Video'));
  // Performance was a dead-end destination (pointed at a fabricated demo table) — every
  // suite's performance metrics live on Pulse instead, not a separate nav entry.
  assert.equal(pageLabels.includes('Performance'), false);

  const pulse = pages.find(p => p.label === 'Pulse');
  assert.deepEqual({ page: pulse.page, tab: pulse.tab }, { page: 'marketing-overview', tab: 'overview' });
  const automations = pages.find(p => p.label === 'Automations');
  assert.deepEqual({ page: automations.page, tab: automations.tab }, { page: 'automation-builder', tab: 'automations' });

  // Must NOT include Service-specific or Digital/DealerOS items
  assert.equal(pageLabels.includes('Service Marketing'), false);
  assert.equal(pageLabels.includes('Website'), false);
  assert.equal(pageLabels.includes('AI ChatBot'), false);
  assert.equal(pageLabels.includes('SEO'), false);
  assert.equal(pageLabels.includes('Accounting'), false);
  assert.equal(pageLabels.includes('F&I'), false);
});

test('Service Marketing Suite navigation and workspace isolation', (t) => {
  const sandbox = createFrontendSandbox({
    productAttr: 'service-marketing-suite',
    profileContext: { package_id: 'service-marketing-suite', role: 'DEALER_ADMIN' },
    __access: {
      products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'service_marketing_suite'],
      features: ['email.automations', 'social.scheduler', 'video.create']
    }
  });

  const ctx = sandbox.resolveWorkspaceContext();
  assert.equal(ctx.type, 'marketing_suite');
  assert.equal(ctx.suite, 'service');

  // DealerOS nav must be blocked
  assert.equal(sandbox.deptNavEligible('DEALER_ADMIN'), false);

  const pages = sandbox.restrictedNavPages();
  assert.ok(Array.isArray(pages));

  const pageLabels = pages.map(p => p.label);
  
  assert.ok(pageLabels.includes('Pulse'));
  assert.ok(pageLabels.includes('Service Marketing'));
  assert.ok(pageLabels.includes('Campaigns'));
  assert.ok(pageLabels.includes('Automations'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Social Scheduler'));
  assert.ok(pageLabels.includes('Video'));
  assert.equal(pageLabels.includes('Performance'), false);

  // Must NOT include Sales-specific or Digital/DealerOS items
  assert.equal(pageLabels.includes('Sales Marketing'), false);
  assert.equal(pageLabels.includes('Website'), false);
  assert.equal(pageLabels.includes('AI ChatBot'), false);
  assert.equal(pageLabels.includes('SEO'), false);
  assert.equal(pageLabels.includes('Accounting'), false);
  assert.equal(pageLabels.includes('F&I'), false);
});

test('Complete Marketing Suite navigation includes distinct Sales & Service sections', (t) => {
  const sandbox = createFrontendSandbox({
    productAttr: 'complete-marketing-suite',
    profileContext: { package_id: 'complete-marketing-suite', role: 'DEALER_ADMIN' },
    __access: {
      products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'complete_marketing_suite'],
      features: ['email.automations', 'social.scheduler', 'video.create']
    }
  });

  const ctx = sandbox.resolveWorkspaceContext();
  assert.equal(ctx.type, 'marketing_suite');
  assert.equal(ctx.suite, 'complete');

  assert.equal(sandbox.deptNavEligible('DEALER_ADMIN'), false);

  const pages = sandbox.restrictedNavPages();
  const pageLabels = pages.map(p => p.label);
  
  assert.ok(pageLabels.includes('Pulse'));
  assert.ok(pageLabels.includes('Sales Marketing'));
  assert.ok(pageLabels.includes('Service Marketing'));
  assert.ok(pageLabels.includes('Campaigns'));
  assert.ok(pageLabels.includes('Automations'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Video'));

  // Must NOT include Website/ChatBot/SEO or DealerOS
  assert.equal(pageLabels.includes('Website'), false);
  assert.equal(pageLabels.includes('AI ChatBot'), false);
  assert.equal(pageLabels.includes('SEO'), false);
  assert.equal(pageLabels.includes('Accounting'), false);

});

test('MarketSync Digital package exposes its complete Digital Presence area', (t) => {
  const sandbox = createFrontendSandbox({
    productAttr: 'marketsync-digital',
    profileContext: { package_id: 'marketsync-digital', role: 'DEALER_ADMIN' },
    __access: {
      products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer', 'marketsync_digital'],
      features: ['email.automations', 'social.scheduler', 'video.create', 'website.builder', 'ai.chatbot']
    }
  });

  const ctx = sandbox.resolveWorkspaceContext();
  assert.equal(ctx.type, 'marketing_suite');
  assert.equal(ctx.suite, 'digital');

  assert.equal(sandbox.deptNavEligible('DEALER_ADMIN'), false);

  const pages = sandbox.restrictedNavPages();
  const pageLabels = pages.map(p => p.label);
  
  assert.equal(pageLabels.join('|'), [
    'Pulse',
    'Dealer Website',
    'MarketSync SEO',
    'AI Customer Agent',
    'Design Studio',
    'Social Studio & Scheduler',
    'Facebook Marketplace',
    'Video',
    'Email, SMS & Campaigns',
  ].join('|'));
  assert.equal(pageLabels.includes('Accounting'), false);

  const digitalConfig = sandbox.getMarketingSuiteConfig('digital');
  assert.deepEqual(Array.from(digitalConfig.areas.find(area => area.id === 'website').items, item => item.label), ['Setup', 'Builder', 'Website Settings']);
  assert.deepEqual(Array.from(digitalConfig.areas.find(area => area.id === 'seo').items, item => item.label), ['SEO Builder', 'Pulse']);
  assert.equal(digitalConfig.navItems.find(item => item.page === 'website').tab, 'setup');
  assert.equal(digitalConfig.navItems.find(item => item.page === 'seo').tab, 'settings');
  assert.deepEqual(Array.from(digitalConfig.areas.find(area => area.id === 'ai').items, item => item.label), ['Pulse', 'Setup']);
});

test('MarketSync Digital navigation with SEO entitlement includes SEO', (t) => {
  const sandbox = createFrontendSandbox({
    productAttr: 'marketsync-digital marketsync_seo',
    profileContext: { package_id: 'marketsync-digital', role: 'DEALER_ADMIN' },
    __access: {
      products: ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer', 'marketsync_digital', 'marketsync_seo'],
      features: ['email.automations', 'social.scheduler', 'video.create', 'website.builder', 'ai.chatbot', 'seo.manage']
    }
  });

  const pages = sandbox.restrictedNavPages();
  const pageLabels = pages.map(p => p.label);
  
  assert.ok(pageLabels.includes('Pulse'));
  assert.ok(pageLabels.includes('Dealer Website'));
  assert.ok(pageLabels.includes('AI Customer Agent'));
  assert.ok(pageLabels.includes('MarketSync SEO'), 'MarketSync SEO must use its product name');
});

test('MarketSync Digital is inferred from owned component products without an aggregate SKU', () => {
  const sandbox = createFrontendSandbox({
    productAttr: 'marketsync_website marketsync_seo ai_dealer design_studio marketsync_social facebook marketsync_video marketsync_email',
    profileContext: { package_id: '', role: 'DEALER_ADMIN' },
    __access: {
      products: ['marketsync_website', 'marketsync_seo', 'ai_dealer', 'design_studio', 'marketsync_social', 'facebook', 'marketsync_video', 'marketsync_email'],
      features: ['website.builder', 'seo.manage', 'ai.chatbot', 'social.scheduler', 'video.create', 'email.automations']
    }
  });

  const ctx = sandbox.resolveWorkspaceContext();
  assert.equal(ctx.type, 'marketing_suite');
  assert.equal(ctx.suite, 'digital');
  assert.equal(sandbox.restrictedNavPages().at(-1).label, 'Email, SMS & Campaigns');
});

test('Tracked migration 2026-08-20-marketing-suite-plan-entitlements.sql aligns plan_products and plan_features', (t) => {
  const migPath = path.join(__dirname, '../migrations/2026-08-20-marketing-suite-plan-entitlements.sql');
  assert.ok(fs.existsSync(migPath), 'Migration file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Verify prices ($399 -> 39900, $399 -> 39900, $699 -> 69900, $1199 -> 119900)
  assert.match(sql, /\('sales-marketing-suite',\s*'marketsync_social',\s*'Sales Marketing Suite',\s*1,\s*39900/);
  assert.match(sql, /\('service-marketing-suite',\s*'marketsync_email',\s*'Service Marketing Suite',\s*1,\s*39900/);
  assert.match(sql, /\('complete-marketing-suite',\s*'marketsync_social',\s*'Complete Marketing Suite',\s*2,\s*69900/);
  assert.match(sql, /\('marketsync-digital',\s*'marketsync_website',\s*'MarketSync Digital',\s*2,\s*119900/);

  // Verify plan_products mappings
  assert.match(sql, /\('sales-marketing-suite',\s*'design_studio'\)/);
  assert.match(sql, /\('sales-marketing-suite',\s*'facebook'\)/);
  assert.match(sql, /\('sales-marketing-suite',\s*'marketsync_social'\)/);
  assert.match(sql, /\('sales-marketing-suite',\s*'marketsync_email'\)/);
  assert.match(sql, /\('sales-marketing-suite',\s*'marketsync_video'\)/);

  assert.match(sql, /\('service-marketing-suite',\s*'design_studio'\)/);
  assert.match(sql, /\('service-marketing-suite',\s*'facebook'\)/);
  assert.match(sql, /\('service-marketing-suite',\s*'marketsync_social'\)/);
  assert.match(sql, /\('service-marketing-suite',\s*'marketsync_email'\)/);
  assert.match(sql, /\('service-marketing-suite',\s*'marketsync_video'\)/);

  assert.match(sql, /\('complete-marketing-suite',\s*'design_studio'\)/);
  assert.match(sql, /\('complete-marketing-suite',\s*'facebook'\)/);
  assert.match(sql, /\('complete-marketing-suite',\s*'marketsync_social'\)/);
  assert.match(sql, /\('complete-marketing-suite',\s*'marketsync_email'\)/);
  assert.match(sql, /\('complete-marketing-suite',\s*'marketsync_video'\)/);

  assert.match(sql, /\('marketsync-digital',\s*'design_studio'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'facebook'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'marketsync_social'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'marketsync_email'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'marketsync_video'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'marketsync_website'\)/);
  assert.match(sql, /\('marketsync-digital',\s*'ai_dealer'\)/);

  const seoMigration = fs.readFileSync(path.join(__dirname, '../migrations/2026-08-20-marketsync-digital-seo-entitlement.sql'), 'utf8');
  assert.match(seoMigration, /\('marketsync-digital',\s*'marketsync_seo'\)/);
  for (const feature of ['seo.overview', 'seo.audit', 'seo.autofix', 'seo.content', 'seo.competitors', 'seo.local', 'seo.inventory', 'seo.ai_search', 'seo.reports', 'seo.settings']) {
    assert.match(seoMigration, new RegExp(feature.replace('.', '\\\.')));
  }
});
