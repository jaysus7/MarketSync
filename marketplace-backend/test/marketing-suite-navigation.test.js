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

// The shared Pulse/Marketing/Content/Academy shell was retired deliberately: the
// departments behind each suite differ enough that a uniform four-area split did not
// describe any of them well. Each suite is now a single area whose flat destination
// list is the sidebar, which is also why the per-page tab strip stays hidden for them
// (see the tab-strip test below).
test('Sales, Service and Complete each present one flat suite area, not a four-area shell', () => {
  const configs = suiteConfigs();
  for (const [suite, label] of [['sales', 'Sales Marketing Suite'], ['service', 'Service Marketing Suite'], ['complete', 'Complete Marketing Suite']]) {
    assert.deepEqual(configs[suite].areas.map(area => area.label), [label]);
    assert.equal(configs[suite].areas[0].id, 'suite');
    assert.equal(configs[suite].areas[0].items[0].label, 'Pulse', 'Pulse stays the first destination');
  }
  // The retired shell must not creep back in as area labels.
  for (const suite of ['sales', 'service', 'complete']) {
    const ids = configs[suite].areas.map(area => area.id);
    assert.deepEqual(ids.filter(id => ['marketing', 'content', 'academy'].includes(id)), []);
  }
});

test('MarketSync Digital is a bespoke shell with one area per product, not the shared suite shell', () => {
  const configs = suiteConfigs();
  assert.deepEqual(configs.digital.areas.map(area => area.label), [
    'MarketSync Digital', 'Website', 'MarketSync SEO', 'AI Customer Agent',
    'Facebook Auto Poster', 'Design Studio', 'Social Studio & Scheduler', 'Video', 'Campaigns'
  ]);
  assert.equal(configs.digital.areas[0].items[0].label, 'Pulse');
});

test('each suite lists its canonical destinations in one flat sidebar', () => {
  const configs = suiteConfigs();
  const suiteItems = suite => labels(configs[suite].areas.find(area => area.id === 'suite'));

  assert.deepEqual(suiteItems('sales'), [
    'Pulse', 'Sales Marketing', 'Facebook Auto Poster', 'Automations', 'Campaigns',
    'Templates', 'Audiences', 'Design Studio', 'Social Studio & Scheduler', 'Video', 'Academy'
  ]);
  assert.deepEqual(suiteItems('service'), [
    'Pulse', 'Service Marketing', 'Facebook Auto Poster', 'Automations', 'Campaigns',
    'Templates', 'Audiences', 'Design Studio', 'Social Studio & Scheduler', 'Video', 'Academy'
  ]);

  // Every suite keeps the shared content and campaign tooling.
  for (const suite of ['sales', 'service', 'complete']) {
    for (const destination of ['Design Studio', 'Social Studio & Scheduler', 'Video', 'Campaigns', 'Academy']) {
      assert.ok(suiteItems(suite).includes(destination), `${suite} must reach ${destination}`);
    }
  }

  const area = (suite, id) => configs[suite].areas.find(candidate => candidate.id === id);
  assert.deepEqual(labels(area('digital', 'website')), ['Setup', 'Builder', 'Blog Post Tips', 'Discovery', 'Website Settings']);
  assert.equal(JSON.stringify(configs).includes('AI Setup'), false);
});

test('suite navigation reuses canonical routes and the shared accessible tabbar', () => {
  const configs = suiteConfigs();
  const items = configs.sales.areas.find(area => area.id === 'suite').items;
  const pageFor = label => items.find(item => item.label === label)?.page;
  // Content destinations still route to the canonical pages rather than suite-local copies.
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
test('a suite dealer who separately owns MarketSync SEO gets it as its own area; one who does not, does not', () => {
  const withSeo = suiteConfigWithAccess('sales', { products: ['design_studio', 'marketsync_seo'] });
  const seoArea = withSeo.areas.find(area => area.id === 'seo');
  assert.ok(seoArea, 'Sales Marketing Suite + owned SEO must expose an SEO area');
  assert.equal(seoArea.label, 'MarketSync SEO');
  assert.deepEqual(labels(seoArea), ['SEO Builder', 'Pulse']);
  // Never combined with a "website" area — Sales/Service/Complete Marketing Suite sell
  // no website product, so there is nothing to combine it with in the first place.
  assert.ok(!withSeo.areas.some(area => area.id === 'website' || area.id === 'digital-presence'));

  const withoutSeo = suiteConfigWithAccess('service', { products: ['design_studio'] });
  assert.ok(!withoutSeo.areas.some(area => area.id === 'seo'), 'no SEO area without the entitlement');
});
