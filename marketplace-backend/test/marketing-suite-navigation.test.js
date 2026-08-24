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

test('Sales, Service and Complete share the same DealerOS-style major-area shell', () => {
  const configs = suiteConfigs();
  const common = ['Pulse', 'Marketing', 'Content', 'Reports', 'Academy'];
  assert.deepEqual(configs.sales.areas.map(area => area.label), common);
  assert.deepEqual(configs.service.areas.map(area => area.label), common);
  assert.deepEqual(configs.complete.areas.map(area => area.label), common);
});

test('MarketSync Digital is a bespoke shell with one area per product, not the shared suite shell', () => {
  const configs = suiteConfigs();
  assert.deepEqual(configs.digital.areas.map(area => area.label), [
    'MarketSync Digital', 'Website', 'MarketSync SEO', 'AI Customer Agent',
    'Design Studio', 'Social Studio & Scheduler', 'Facebook Marketplace', 'Video', 'Email, SMS & Campaigns'
  ]);
  assert.equal(configs.digital.areas[0].items[0].label, 'Pulse');
});

test('suite page headers expose canonical products without moving them into the sidebar', () => {
  const configs = suiteConfigs();
  const area = (suite, id) => configs[suite].areas.find(candidate => candidate.id === id);
  assert.deepEqual(labels(area('sales', 'marketing')), ['Sales Marketing', 'Campaigns', 'Automations', 'Email & SMS', 'Campaign Library']);
  assert.deepEqual(labels(area('service', 'marketing')), ['Service Marketing', 'Campaigns', 'Automations', 'Email & SMS', 'Campaign Library']);
  assert.deepEqual(labels(area('complete', 'marketing')), ['Sales Marketing', 'Service Marketing', 'Campaigns', 'Automations', 'Email & SMS', 'Campaign Library']);
  for (const suite of ['sales', 'service', 'complete']) {
    assert.deepEqual(labels(area(suite, 'content')), ['Design Studio', 'Social Scheduler', 'Video']);
    assert.equal(configs[suite].areas[0].items[0].label, 'Pulse');
  }
  assert.deepEqual(labels(area('digital', 'website')), ['Setup', 'Builder', 'Website Settings']);
  assert.equal(JSON.stringify(configs).includes('AI Setup'), false);
});

test('suite navigation reuses canonical routes and the shared accessible tabbar', () => {
  const configs = suiteConfigs();
  const content = configs.sales.areas.find(area => area.id === 'content').items;
  assert.deepEqual(content.map(item => item.page), ['studio', 'social-scheduler', 'video-studio']);
  assert.match(shellSource, /role="tablist"/);
  assert.match(shellSource, /aria-selected=/);
  assert.match(shellSource, /overflow-x-auto/);
  assert.match(shellSource, /function suiteAreaOpen/);
  assert.match(shellSource, /function renderMarketingSuiteNav/);
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
