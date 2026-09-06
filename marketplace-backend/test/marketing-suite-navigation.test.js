import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getPlan } from '../plan-catalog.js';

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, '../../marketplace-frontend');
const workspaceSource = fs.readFileSync(resolve(frontend, 'js/modules/marketing-workspace.js'), 'utf8');
const shellSource = fs.readFileSync(resolve(frontend, 'js/modules/dashboard-part2.js'), 'utf8');
const registrySource = fs.readFileSync(resolve(frontend, 'js/modules/workspace-registry.js'), 'utf8');

function suiteConfigs() {
  const setup = workspaceSource.slice(0, workspaceSource.indexOf('let __socialView'));
  const context = { window: {}, document: { documentElement: { getAttribute: () => '' } } };
  vm.createContext(context);
  vm.runInContext(setup, context);
  return JSON.parse(JSON.stringify(context.window.MARKETING_SUITE_CONFIG));
}

const labels = area => area.items.map(item => item.label);

// The suite shell was deliberately flattened: buildMarketingSuiteConfig now
// builds ONE area per suite ("Single area so the shell renders like Digital
// (flat feature list under the suite)"), replacing the old four-area
// Pulse / Marketing / Content / Academy shell. That older shell exists nowhere
// in the source any more, so these assert the shipped structure — just as
// strictly, and still pinning canonical routes and entitlement behaviour.
test('Sales, Service and Complete each render as one flat suite area', () => {
  const configs = suiteConfigs();
  for (const suite of ['sales', 'service', 'complete']) {
    assert.equal(configs[suite].areas.length, 1, `${suite} must be a single flat area`);
    assert.equal(configs[suite].areas[0].id, 'suite');
    assert.equal(configs[suite].areas[0].label, configs[suite].badge);
  }
  assert.deepEqual(configs.sales.areas.map(area => area.label), ['Sales Marketing Suite']);
  assert.deepEqual(configs.service.areas.map(area => area.label), ['Service Marketing Suite']);
  assert.deepEqual(configs.complete.areas.map(area => area.label), ['Complete Marketing Suite']);
});

test('MarketSync Digital is a bespoke shell with one area per product, not the shared suite shell', () => {
  const configs = suiteConfigs();
  assert.deepEqual(configs.digital.areas.map(area => area.label), [
    'MarketSync Digital', 'Website Studio', 'MarketSync SEO', 'AI Customer Agent',
    'Facebook Auto Poster', 'Design Studio', 'Social Studio & Scheduler', 'Video', 'Campaigns'
  ]);
  assert.equal(configs.digital.areas[0].items[0].label, 'Pulse');
});

test('suite page headers expose canonical products without moving them into the sidebar', () => {
  const configs = suiteConfigs();
  for (const suite of ['sales', 'service', 'complete']) {
    const items = labels(configs[suite].areas[0]);
    // Pulse leads every suite, and the creative products stay in the flat list.
    assert.equal(items[0], 'Pulse', `${suite} must lead with Pulse`);
    for (const product of ['Campaigns', 'Automations', 'Templates', 'Audiences', 'Design Studio', 'Social Studio & Scheduler', 'Video', 'Academy']) {
      assert.ok(items.includes(product), `${suite} must expose ${product}`);
    }
    // No product may appear twice in a flat list — that was the whole risk of
    // collapsing the areas.
    assert.equal(new Set(items).size, items.length, `${suite} has a duplicated nav item`);
  }
  // "Complete (and Digital) fold sales+service into the main Pulse. Single-mode
  // suites keep one named hub because that IS the product." So the named hub
  // appears for sales and service only, and Complete deliberately has neither.
  assert.deepEqual(labels(configs.sales.areas[0]).filter(l => l.endsWith(' Marketing')), ['Sales Marketing']);
  assert.deepEqual(labels(configs.service.areas[0]).filter(l => l.endsWith(' Marketing')), ['Service Marketing']);
  assert.deepEqual(labels(configs.complete.areas[0]).filter(l => l.endsWith(' Marketing')), []);
  assert.equal(JSON.stringify(configs).includes('AI Setup'), false);
});

test('suite navigation reuses canonical routes and the shared accessible tabbar', () => {
  const configs = suiteConfigs();
  const items = configs.sales.areas[0].items;
  const pageFor = label => items.find(item => item.label === label)?.page;
  // The creative products keep their canonical routes in the flat list.
  assert.equal(pageFor('Design Studio'), 'studio');
  assert.equal(pageFor('Social Studio & Scheduler'), 'social-scheduler');
  assert.equal(pageFor('Video'), 'video-studio');
  assert.match(shellSource, /role="tablist"/);
  assert.match(shellSource, /aria-selected=/);
  assert.match(shellSource, /overflow-x-auto/);
  assert.match(shellSource, /function suiteAreaOpen/);
  assert.match(shellSource, /function renderMarketingSuiteNav/);
});

// Sales/Service/Complete Marketing Suite's sidebar (renderMarketingSuiteNav) already
// lists every area's items flat, so the per-page area header + tab strip
// (renderDeptTabbar) would just repeat it above the page content — a real "headers
// that are also on the main nav" duplicate. Only MarketSync Digital's sidebar is
// condensed to one item per product (cfg.navItems), where that tab strip is the only
// way to reach an area's sub-destinations (e.g. Website's Setup/Builder/Settings).
test('the suite tab strip only renders for Digital, whose sidebar cannot show sub-destinations on its own', () => {
  const tabbarBody = shellSource.slice(
    shellSource.indexOf('function renderDeptTabbar'),
    shellSource.indexOf('function suiteAreaOpen')
  );
  assert.match(tabbarBody, /if \(!cfg\.navItems\) return hide\(\);/,
    'Sales/Service/Complete (no cfg.navItems) must hide the redundant tab strip');
});

function detectSuite(access) {
  const setup = workspaceSource.slice(0, workspaceSource.indexOf('let __socialView'));
  const context = {
    window: { __access: access },
    document: { documentElement: { getAttribute: () => '' } },
    profileContext: null,
  };
  vm.createContext(context);
  vm.runInContext(setup, context);
  return context.window.getActiveMarketingSuite();
}

// Sales, Service and Complete Marketing Suite grant the EXACT SAME atomic product set
// (design_studio, facebook, marketsync_social, marketsync_email, marketsync_video) — see
// plan-catalog.js. access.products alone can never distinguish which suite a real account
// is on; only access.planByProduct (which plan actually sold each product — see
// access-policy.js's computeAccessContext / routes/profile.js's /auth/me) can. This
// fixture matches the REAL shape the backend sends (no package_id, no data-product/
// data-package attribute — those are never populated for a real account), unlike the
// synthetic fixtures elsewhere in this file that pre-date this fix.
test('getActiveMarketingSuite tells Sales, Service, Complete and Digital apart using access.planByProduct', () => {
  const sharedProducts = ['design_studio', 'facebook', 'marketsync_social', 'marketsync_email', 'marketsync_video'];
  const planByProductFor = (planId) => Object.fromEntries(sharedProducts.map(p => [p, planId]));

  assert.equal(detectSuite({ products: sharedProducts, planByProduct: planByProductFor('sales-marketing-suite') }), 'sales');
  assert.equal(detectSuite({ products: sharedProducts, planByProduct: planByProductFor('service-marketing-suite') }), 'service');
  assert.equal(detectSuite({ products: sharedProducts, planByProduct: planByProductFor('complete-marketing-suite') }), 'complete');
  assert.equal(detectSuite({ products: sharedProducts, planByProduct: planByProductFor('marketsync-digital') }), 'digital');

  // No planByProduct at all (e.g. a real DealerOS account) must not be misread as a suite.
  assert.equal(detectSuite({ products: ['dealer_os'], planByProduct: { dealer_os: 'dealer-os-complete' } }), null);
});

test('MarketSync Digital canonical entitlement includes SEO while suite prices remain unchanged', () => {
  assert.ok(getPlan('marketsync-digital').products.includes('marketsync_seo'));
  assert.equal(getPlan('sales-marketing-suite').monthly, 399);
  assert.equal(getPlan('service-marketing-suite').monthly, 399);
  assert.equal(getPlan('complete-marketing-suite').monthly, 699);
  assert.equal(getPlan('marketsync-digital').monthly, 1199);
});

test('DealerOS workspace registry remains the reference architecture', () => {
  for (const label of ['Pulse', 'Sales', 'Inventory', 'Service', 'Marketing', 'Accounting', 'Academy', 'Settings']) {
    assert.match(registrySource, new RegExp(`label: '${label}'`));
  }
  assert.doesNotMatch(registrySource, /Digital Presence/);
});

function suiteConfigWithAccess(suiteKey, access) {
  const setup = workspaceSource.slice(0, workspaceSource.indexOf('let __socialView'));
  const context = {
    window: { __access: access },
    document: { documentElement: { getAttribute: () => '' } },
    profileContext: null,
  };
  vm.createContext(context);
  vm.runInContext(setup, context);
  // JSON round-trip: node:assert/strict's deepEqual treats a vm-realm Array as a
  // different constructor than this realm's Array even with identical structure.
  return JSON.parse(JSON.stringify(context.window.getMarketingSuiteConfig(suiteKey)));
}

// MarketSync SEO (marketsync-seo / marketsync_seo) is independently purchasable on top
// of Sales/Service/Complete Marketing Suite even though it isn't bundled in — these
// suites have no website concept at all, so it must never be folded into anything else.
test('a suite dealer who separately owns MarketSync SEO gets it as a nav item; one who does not, does not', () => {
  // With the flat shell there is no separate area to inject, so SEO arrives as
  // a feature item ("Inject SEO as a feature item (Digital-style) before
  // Academy"). The entitlement rule it protects is unchanged: only an account
  // that owns marketsync_seo may see it at all.
  const withSeo = suiteConfigWithAccess('sales', { products: ['design_studio', 'marketsync_seo'] });
  const seoItem = (withSeo.navItems || []).find(item => item.page === 'seo');
  assert.ok(seoItem, 'Sales Marketing Suite + owned SEO must expose MarketSync SEO');
  assert.equal(seoItem.label, 'MarketSync SEO');
  // Never combined with a "website" area — Sales/Service/Complete Marketing Suite sell
  // no website product, so there is nothing to combine it with in the first place.
  assert.ok(!withSeo.areas.some(area => area.id === 'website' || area.id === 'digital-presence'));

  const withoutSeo = suiteConfigWithAccess('service', { products: ['design_studio'] });
  assert.ok(!(withoutSeo.navItems || []).some(item => item.page === 'seo'), 'no SEO without the entitlement');
  assert.ok(!withoutSeo.areas.some(area => area.id === 'seo'), 'and no SEO area either');
});
