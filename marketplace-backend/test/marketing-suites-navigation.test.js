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
      location: { href: '', pathname: '', search: '', hash: '' },
      body: { style: {}, appendChild: () => {} }
    },
    location: { href: '', pathname: '', search: '', hash: '' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
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
  assert.deepEqual(digital.products, ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video', 'marketsync_website', 'ai_dealer']);

  // SEO must NOT be in MarketSync Digital products by default (separate add-on)
  assert.equal(digital.products.includes('marketsync_seo'), false);
  assert.equal(digital.products.includes('seo'), false);
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
  
  // Must include Sales items
  assert.ok(pageLabels.includes('Sales Marketing Overview'));
  assert.ok(pageLabels.includes('Lead Follow-Up'));
  assert.ok(pageLabels.includes('Sold / Delivery Follow-Up'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Social Scheduler'));
  assert.ok(pageLabels.includes('Video'));
  assert.ok(pageLabels.includes('Sales Marketing Reports'));

  // Must NOT include Service-specific or Digital/DealerOS items
  assert.equal(pageLabels.includes('Service Reminders'), false);
  assert.equal(pageLabels.includes('Declined Service Follow-Up'), false);
  assert.equal(pageLabels.includes('Customer Reactivation'), false);
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
  
  // Must include Service items
  assert.ok(pageLabels.includes('Service Marketing Overview'));
  assert.ok(pageLabels.includes('Service Reminders'));
  assert.ok(pageLabels.includes('Declined Service Follow-Up'));
  assert.ok(pageLabels.includes('Customer Reactivation'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Social Scheduler'));
  assert.ok(pageLabels.includes('Video'));
  assert.ok(pageLabels.includes('Service Marketing Reports'));

  // Must NOT include Sales-specific or Digital/DealerOS items
  assert.equal(pageLabels.includes('Lead Follow-Up'), false);
  assert.equal(pageLabels.includes('Sold / Delivery Follow-Up'), false);
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
  
  // Must include both Sales and Service sections
  assert.ok(pageLabels.includes('Marketing Overview'));
  assert.ok(pageLabels.includes('Sales Overview'));
  assert.ok(pageLabels.includes('Sales Campaigns'));
  assert.ok(pageLabels.includes('Sales Automations'));
  assert.ok(pageLabels.includes('Service Overview'));
  assert.ok(pageLabels.includes('Service Campaigns'));
  assert.ok(pageLabels.includes('Service Automations'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Video'));

  // Must NOT include Website/ChatBot/SEO or DealerOS
  assert.equal(pageLabels.includes('Website'), false);
  assert.equal(pageLabels.includes('AI ChatBot'), false);
  assert.equal(pageLabels.includes('SEO'), false);
  assert.equal(pageLabels.includes('Accounting'), false);
});

test('MarketSync Digital navigation without SEO entitlement does not show SEO', (t) => {
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
  
  // Must include Digital items
  assert.ok(pageLabels.includes('Digital Overview'));
  assert.ok(pageLabels.includes('Website'));
  assert.ok(pageLabels.includes('AI ChatBot'));
  assert.ok(pageLabels.includes('Design Studio'));
  assert.ok(pageLabels.includes('Video'));
  assert.ok(pageLabels.includes('Digital Marketing Reports'));

  // SEO must NOT be in the navigation without marketsync_seo entitlement
  assert.equal(pageLabels.includes('SEO'), false);
  assert.equal(pageLabels.includes('Accounting'), false);
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
  
  assert.ok(pageLabels.includes('Digital Overview'));
  assert.ok(pageLabels.includes('Website'));
  assert.ok(pageLabels.includes('AI ChatBot'));
  assert.ok(pageLabels.includes('SEO'), 'SEO must be included when marketsync_seo product/feature is held');
});
