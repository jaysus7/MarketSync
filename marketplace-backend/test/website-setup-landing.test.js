import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Website Product — Default Landing Setup & Contained Dashboard Architecture', () => {
  const part17Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part17.js');
  const part2Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js');

  const part17Content = fs.readFileSync(part17Path, 'utf8');
  const part2Content = fs.readFileSync(part2Path, 'utf8');

  it('defaults the website landing route to Setup instead of Builder in loadWebsitePage', () => {
    assert.ok(part17Content.includes("if (targetTab === 'builder') __wsTab = 'builder';"), 'Supports explicit targetTab=builder');
    assert.ok(part17Content.includes("else if (targetTab === 'blog') __wsTab = 'blog';"), 'Supports explicit targetTab=blog');
    assert.ok(part17Content.includes("else if (targetTab === 'seo') __wsTab = 'seo';"), 'Supports explicit targetTab=seo');
    assert.ok(part17Content.includes("else __wsTab = 'setup';"), 'Defaults to setup when tab is not specified');
  });

  it('does not render the redundant Builder, Blog, SEO, and Setup tab strip inside wsSetup', () => {
    const setupSource = part17Content.slice(part17Content.indexOf('function wsSetup()'), part17Content.indexOf('window.wsSetup = wsSetup'));
    assert.ok(!setupSource.includes('Website Workspace Top Navigation Tabs'), 'Redundant Website tab strip is absent');
    assert.ok(!setupSource.includes("onclick=\"wsTab('builder')\""), 'Builder tab is not duplicated in Setup');
    assert.ok(!setupSource.includes("onclick=\"wsTab('blog')\""), 'Blog tab is not duplicated in Setup');
    assert.ok(!setupSource.includes("onclick=\"wsTab('seo')\""), 'SEO tab is not duplicated in Setup');
  });

  it('surfaces all 13 core configuration cards in wsSetup', () => {
    const requiredCards = [
      'Dealership Information',
      'Domain',
      'Branding',
      'Appearance',
      'Contact Information',
      'Social Links',
      'Inventory Feed',
      'Forms & Lead Routing',
      'Analytics',
      'Integrations',
      'AI ChatBot',
      'Publishing',
      'Advanced'
    ];

    requiredCards.forEach(c => {
      assert.ok(part17Content.includes(c), `wsSetup contains card "${c}"`);
    });
  });

  it('provides key status indicators across domain, inventory, analytics, chat, and publishing', () => {
    assert.ok(part17Content.includes('SSL Active') || part17Content.includes('DNS Ready'), 'Domain status indicator');
    assert.ok(part17Content.includes('Active Sync'), 'Inventory feed sync status indicator');
    assert.ok(part17Content.includes('GA4:'), 'Analytics GA4 status');
    assert.ok(part17Content.includes('Meta Pixel:'), 'Analytics Meta Pixel status');
    assert.ok(part17Content.includes('isAiChatbotOwned()'), 'AI Chatbot status logic');
  });

  it('exits Builder cleanly back into Website Setup', () => {
    assert.ok(part17Content.includes("function exitWebsiteWorkspace()"), 'exitWebsiteWorkspace exists');
    assert.ok(part17Content.includes("__wsTab = 'setup';"), 'exitWebsiteWorkspace resets tab to setup');
    assert.ok(part17Content.includes("switchPage('website')"), 'exitWebsiteWorkspace routes back to website page');
  });

  it('supports deep linking to website/setup, website/builder, website/blog, and website/seo in switchPage', () => {
    assert.ok(part2Content.includes("pageId.startsWith('website/')"), 'Handles website/ subroutes');
    assert.ok(part2Content.includes("if (!__wsTab || __wsTab === 'settings') __wsTab = 'setup';"), 'Defaults pageId=website to setup');
  });
});
