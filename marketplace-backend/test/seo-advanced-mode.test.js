import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SEO Suite - Advanced Mode Dual Architecture & Component Completeness', async (t) => {
  const p17Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part17.js');
  const p2Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js');

  assert.ok(fs.existsSync(p17Path), 'dashboard-part17.js exists');
  assert.ok(fs.existsSync(p2Path), 'dashboard-part2.js exists');

  const p17Content = fs.readFileSync(p17Path, 'utf8');
  const p2Content = fs.readFileSync(p2Path, 'utf8');

  await t.test('setSeoMode handles mode switching and local storage persistence', () => {
    assert.match(p17Content, /function setSeoMode\(mode\)/);
    assert.match(p17Content, /marketsync_seo_mode/);
    assert.match(p17Content, /__seoMainTab = 'overview'/);
  });

  await t.test('renderSeoWorkspace renders Easy Mode and Advanced Mode tabs appropriately', () => {
    assert.match(p17Content, /setSeoMode\('easy'\)/);
    assert.match(p17Content, /setSeoMode\('advanced'\)/);
    assert.match(p17Content, /navTab\('keywords', 'Keywords'\)/);
    assert.match(p17Content, /navTab\('rankings', 'Rankings'\)/);
    assert.match(p17Content, /navTab\('backlinks', 'Backlinks'\)/);
    assert.match(p17Content, /navTab\('pages', 'Pages'\)/);
    assert.match(p17Content, /navTab\('local', 'Local'\)/);
    assert.match(p17Content, /navTab\('audit', 'Audit'\)/);
    assert.match(p17Content, /navTab\('ai', 'AI Visibility'\)/);
  });

  await t.test('All 13 Advanced SEO views and Easy Mode views are defined', () => {
    const requiredViews = [
      'renderSeoEasyOverviewView',
      'renderSeoAdvancedOverviewView',
      'renderSeoKeywordsView',
      'renderSeoRankingsView',
      'renderSeoCompetitorsView',
      'renderSeoBacklinksView',
      'renderSeoContentView',
      'renderSeoPagesView',
      'renderSeoLocalView',
      'renderSeoTechnicalView',
      'renderSeoAuditView',
      'renderSeoAiView',
      'renderSeoAnalyticsView',
      'renderSeoSettingsWorkspace',
      'renderSeoAutopilotView',
      'renderSeoHistoryView',
      'renderSeoRedirectsView'
    ];

    for (const viewName of requiredViews) {
      assert.match(p17Content, new RegExp(`function ${viewName}\\(`), `Function ${viewName} should be defined in dashboard-part17.js`);
    }
  });

  await t.test('Deep SEO route parsing in switchPage supports easy/advanced modes', () => {
    assert.match(p2Content, /seo\/advanced/);
    assert.match(p2Content, /marketsync_seo_mode/);
  });

  await t.test('Global window exports include all SEO view and action functions', () => {
    assert.match(p17Content, /renderSeoAdvancedOverviewView/);
    assert.match(p17Content, /renderSeoKeywordsView/);
    assert.match(p17Content, /renderSeoRankingsView/);
    assert.match(p17Content, /renderSeoBacklinksView/);
    assert.match(p17Content, /renderSeoPagesView/);
    assert.match(p17Content, /renderSeoLocalView/);
    assert.match(p17Content, /renderSeoAuditView/);
    assert.match(p17Content, /renderSeoAiView/);
  });
});
