import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const frontend = fs.readFileSync(path.join(root, 'marketplace-frontend/js/modules/dashboard-part17.js'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'marketplace-backend/routes/discoverability.js'), 'utf8');
const monitoring = fs.readFileSync(path.join(root, 'marketplace-backend/services/discoverabilityMonitoringService.js'), 'utf8');

test('Website builder exposes the exact four inspector contracts', () => {
  const inspector = frontend.slice(frontend.indexOf('function renderWsRightInspectorHtml'), frontend.indexOf('function setSiteGlobal'));
  assert.match(inspector, /setWsInspectorTab\('content'\)[\s\S]*>Content<\/button>/);
  assert.match(inspector, /setWsInspectorTab\('style'\)[\s\S]*>Style<\/button>/);
  assert.match(inspector, /setWsInspectorTab\('layout'\)[\s\S]*>Layout<\/button>/);
  assert.match(inspector, /setWsInspectorTab\('discoverability'\)[\s\S]*>SEO &amp; Discoverability<\/button>/);
  assert.doesNotMatch(inspector, /setWsInspectorTab\('advanced'\)|>Advanced<\/button>/);
});

test('Website Discoverability reads canonical evidence and keeps unknown states explicit', () => {
  assert.match(frontend, /apiGetJson\('\/discoverability\/overview'\)/);
  assert.match(frontend, /apiGetJson\('\/discoverability\/search\/overview'\)/);
  assert.match(frontend, /apiGetJson\('\/discoverability\/geo\/benchmark\/latest'\)/);
  assert.match(frontend, /Unknown stays unknown until a public or provider measurement exists/);
  assert.match(frontend, /No measured AI citation evidence is available/);
  assert.match(frontend, /Synthetic lab evidence remains separate from organic AI visibility/);
  assert.match(frontend, /Synthetic lab only/);
  assert.match(frontend, /Draft checks and measured public evidence remain separate/);
});

test('Discoverability Copilot is tenant-scoped and controlled by the deterministic service', () => {
  assert.match(routes, /app\.post\('\/discoverability\/copilot',\s*requireAuth,\s*checkDiscoverabilityEntitlement/);
  assert.match(routes, /\.eq\('dealership_id', req\.dealershipId\)/);
  assert.match(routes, /answerDiscoverabilityQuestion/);
  assert.match(routes, /slice\(0, 500\)/);
  assert.doesNotMatch(routes.slice(routes.indexOf("app.post('/discoverability/copilot'"), routes.indexOf("app.post('/discoverability/recommendations/:id/approve'")), /(?:raw|execute).*sql|dangerouslySetInnerHTML/i);
});

test('canonical builder audit reads the latest persisted draft revision', () => {
  assert.match(monitoring, /from\('dealer_website_revisions'\)/);
  assert.match(monitoring, /\.eq\('dealership_id', dealershipId\)/);
  assert.match(monitoring, /\.eq\('state', 'draft'\)/);
  assert.match(monitoring, /draftRevision\?\.content/);
});
