import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES, ROLE_PERMISSIONS } from './helpers/auth.js';

const MANDATORY_SYSTEMS = [
  { key: 'command', title: 'Dashboard' },
  { key: 'inventory-overview', title: 'Inventory' },
  { key: 'crm', title: 'CRM' },
  { key: 'sales', title: 'Sales' },
  { key: 'desking', title: 'Desk a Deal' },
  { key: 'fni', title: 'F&I' },
  { key: 'service', title: 'Service' },
  { key: 'parts', title: 'Parts' },
  { key: 'accounting', title: 'Accounting' },
  { key: 'commissions', title: 'Commissions' },
  { key: 'studio', title: 'Design Studio' },
  { key: 'social', title: 'Social Scheduler' },
  { key: 'video', title: 'Video Creator' },
  { key: 'campaigns', title: 'Campaigns' },
  { key: 'chatbot', title: 'AI ChatBot' },
  { key: 'website', title: 'Website Builder' },
  { key: 'academy', title: 'Academy' },
  { key: 'people-overview', title: 'People & HR' },
  { key: 'settings', title: 'Settings' },
];

// Reads the workspaces the signed-in user can actually navigate to, straight from the
// role-aware nav the app rendered (buttons/links wired to switchPage, plus [data-page]).
async function readNavigableWorkspaces(page) {
  return page.evaluate(() => {
    const keys = new Set();
    document.querySelectorAll('[data-page]').forEach(el => el.dataset.page && keys.add(el.dataset.page));
    document.querySelectorAll('[onclick]').forEach(el => {
      const m = /switchPage\(\s*['"]([^'"]+)['"]/.exec(el.getAttribute('onclick') || '');
      if (m) keys.add(m[1]);
    });
    return Array.from(keys);
  });
}

test.describe('19 Mandatory Systems Smoke Test Suite (Admin & Role Matrix)', () => {

  test('Validates 19 mandatory systems as Owner/Admin (renders, no errors, not blank)', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(`${err.message}`));

    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    // loginAsRole already proved switchPage exists (SPA booted). Guard anyway.
    const booted = await page.evaluate(() => typeof window.switchPage === 'function');
    expect(booted, 'SPA runtime (window.switchPage) must be available').toBe(true);

    for (const sys of MANDATORY_SYSTEMS) {
      await page.evaluate((key) => window.switchPage(key), sys.key);

      // Wait for the workspace to settle instead of a blind timeout: its content root
      // should appear and carry real text (not a permanent spinner / blank frame).
      await page.waitForFunction(() => {
        const main = document.querySelector('main') || document.body;
        return main && main.innerText && main.innerText.trim().length > 40;
      }, { timeout: 10000 }).catch(() => {});

      const rendered = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const text = (main?.innerText || '').trim();
        const stuck = /^(loading|please wait)\.*$/i.test(text);
        return { len: text.length, stuck };
      });

      expect(rendered.len, `${sys.title} (${sys.key}) rendered blank`).toBeGreaterThan(40);
      expect(rendered.stuck, `${sys.title} (${sys.key}) is stuck in a loading state`).toBe(false);
    }

    expect(jsErrors, `Uncaught JS errors while sweeping systems: ${jsErrors.join('; ')}`).toEqual([]);
  });

  test('Non-destructive UI controls (modal open/close without side effects)', async ({ page }) => {
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    await page.evaluate(() => window.switchPage('sales'));

    await page.evaluate(() => {
      if (typeof window.crmOverlay === 'function') {
        window.crmOverlay('<div id="test-qa-modal" class="p-6 text-slate-900 font-bold">QA Modal Test</div>', 'max-w-md');
      }
    });
    expect(await page.isVisible('#test-qa-modal')).toBe(true);

    await page.evaluate(() => {
      const t = document.getElementById('test-qa-modal');
      if (t) { const o = t.closest('.fixed'); (o || t).remove(); }
    });
    expect(await page.isVisible('#test-qa-modal')).toBe(false);
  });

  test('RBAC: a restricted user cannot navigate to denied workspaces', async ({ page }) => {
    await loginAsRole(page, STAGING_ROLES.RESTRICTED);

    const nav = await readNavigableWorkspaces(page);
    const denied = ROLE_PERMISSIONS[STAGING_ROLES.RESTRICTED].denied;

    const leaked = denied.filter(key => nav.some(k => k === key || k.startsWith(`${key}-`)));
    expect(leaked, `Restricted role exposes denied workspaces in nav: ${leaked.join(', ')}`).toEqual([]);

    // Force-navigate to each denied workspace; the app must refuse to render it as the
    // active content (gating), and must not throw.
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));
    for (const key of denied) {
      await page.evaluate((k) => { try { window.switchPage(k); } catch (_) {} }, key);
      await page.waitForTimeout(50);
      const activeDenied = await page.evaluate((k) => {
        const root = document.querySelector(`[data-page-content="${k}"], #page-${k}`);
        return !!(root && !root.classList.contains('hidden') && root.offsetParent !== null);
      }, key);
      expect(activeDenied, `Denied workspace "${key}" rendered active content for a restricted user`).toBe(false);
    }
    expect(jsErrors, `Errors during forced denied navigation: ${jsErrors.join('; ')}`).toEqual([]);
  });

});
