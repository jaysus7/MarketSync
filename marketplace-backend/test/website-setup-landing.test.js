import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Website Studio — seven destinations and one immersive builder', () => {
  const part17Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part17.js');
  const part2Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js');

  const part17Content = fs.readFileSync(part17Path, 'utf8');
  const part2Content = fs.readFileSync(part2Path, 'utf8');

  it('supports the seven Website Studio destinations and defaults to Overview', () => {
    for (const tab of ['overview', 'sites', 'pages', 'templates', 'blog', 'discoverability', 'settings']) {
      assert.ok(part17Content.includes(`['${tab}', '${tab === 'discoverability' ? 'Discoverability' : tab[0].toUpperCase() + tab.slice(1)}']`), `Studio tab ${tab} exists`);
    }
    assert.ok(part17Content.includes("setup: 'overview', seo: 'discoverability'"), 'Legacy Website routes map into the Studio');
    assert.ok(part17Content.includes("__wsTab = 'overview'"), 'Unknown and plain Website state defaults to Overview');
  });

  it('keeps Blog and Discoverability inside Website Studio', () => {
    const tabSource = part17Content.slice(part17Content.indexOf('function wsTab(t)'), part17Content.indexOf('function setBuilderMode'));
    assert.doesNotMatch(tabSource, /switchPage\('blog'\)/);
    assert.doesNotMatch(tabSource, /switchPage\('seo'\)/);
    assert.ok(part17Content.includes("if (__wsTab === 'discoverability')"));
    assert.ok(part17Content.includes("if (__wsTab === 'blog')"));
  });

  it('keeps all website configuration under Settings without a second Setup page', () => {
    const settingsSource = part17Content.slice(part17Content.indexOf('function wsSettings()'), part17Content.indexOf('function isAiChatbotOwned'));
    assert.ok(settingsSource.includes('siteSettingsFields(__siteCfg)'), 'Settings renders the detailed settings form');
    assert.ok(settingsSource.includes("openSetupModal('${id}')"), 'Settings exposes the canonical advanced configuration modals');
    assert.ok(!part17Content.includes('function wsSetup()'), 'The duplicate Setup landing no longer exists');
  });

  it('materializes editable starter sections before opening an empty live builder', () => {
    assert.ok(part17Content.includes('function ensureEditableWebsiteSections()'), 'Editable starter initializer exists');
    assert.ok(part17Content.includes('__homeSections = templateHome({'), 'Empty fallback becomes real editable sections');
    assert.ok(part17Content.includes('ensureEditableWebsiteSections();\n  selectFirstEditableWsSection();\n  wireLiveMessages();'), 'Live builder initializes sections before wiring the canvas');
  });

  it('templates use one catalog, preview before apply, and persist a draft', () => {
    assert.equal((part17Content.match(/const SITE_TEMPLATES =/g) || []).length, 1);
    assert.ok(part17Content.includes('function openWebsiteTemplatePreview(id)'));
    assert.ok(part17Content.includes("const saved = await saveWebsite(btn, 'draft');"));
    assert.equal((part17Content.match(/async function saveWebsite\(/g) || []).length, 1, 'There is one revision-backed save implementation');
  });

  it('exits Builder cleanly back into Website Studio Overview', () => {
    assert.ok(part17Content.includes("function exitWebsiteWorkspace()"), 'exitWebsiteWorkspace exists');
    assert.ok(part17Content.includes("__wsTab = 'overview';"), 'exitWebsiteWorkspace resets tab to overview');
    assert.ok(part17Content.includes("switchPage('website')"), 'exitWebsiteWorkspace routes back to website page');
  });

  it('supports Website Studio deep links without routing Blog or Discoverability away', () => {
    assert.ok(part2Content.includes("pageId.startsWith('website/')"), 'Handles website/ subroutes');
    assert.ok(part2Content.includes("else if (sub === 'blog') { __wsTab = 'blog'; pageId = 'website'; }"));
    assert.ok(part2Content.includes("else if (sub === 'seo') { __wsTab = 'discoverability'; pageId = 'website'; }"));
    assert.ok(part2Content.includes("if (!__wsTab) __wsTab = 'overview';"), 'Defaults pageId=website to Overview');
  });
});
