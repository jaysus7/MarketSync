import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES } from './helpers/auth.js';

test.describe('Automated Full-Site Staging Link Crawler & Route Validator', () => {

  test('Crawls public landing pages and validates links, assets, and JS error boundaries', async ({ page }) => {
    const jsErrors = [];
    const failedRequests = [];

    page.on('pageerror', (err) => {
      jsErrors.push(`Uncaught Exception: ${err.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('401') && !text.includes('403') && !text.includes('ERR_CONNECTION_REFUSED')) {
          jsErrors.push(`Console Error: ${text}`);
        }
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400 && res.status() !== 401 && res.status() !== 403) {
        failedRequests.push({ url: res.url(), status: res.status() });
      }
    });

    // 1. Visit public entry
    const res = await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBeLessThan(400);

    // 2. Discover all internal hrefs
    const anchors = await page.locator('a[href]').all();
    const hrefs = [];
    for (const a of anchors) {
      const href = await a.getAttribute('href');
      if (href) hrefs.push(href);
    }

    // 3. Verify no dead hrefs (# or javascript:void(0) without action)
    const deadHrefs = hrefs.filter(h => h === '#' || h.startsWith('javascript:void(0)'));
    expect(deadHrefs.length, `Found ${deadHrefs.length} dead links`).toBe(0);

    // 4. Verify primary content is non-empty
    const bodyText = await page.innerText('body');
    expect(bodyText.trim().length).toBeGreaterThan(50);

    // 5. Verify no uncaught JS errors
    expect(jsErrors.length, `JS errors found: ${jsErrors.join('; ')}`).toBe(0);
    expect(failedRequests.length, `Failed network requests: ${JSON.stringify(failedRequests)}`).toBe(0);
  });

  test('Crawls authenticated SPA dashboard routes, workspace navigation, and drawer links', async ({ page }, testInfo) => {
    const jsErrors = [];
    const failedApis = [];
    const brokenImages = [];

    page.on('pageerror', (err) => {
      jsErrors.push(`Uncaught Exception: ${err.message}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('401') && !text.includes('403') && !text.includes('ERR_CONNECTION_REFUSED') && !text.includes('Failed to load resource') && !text.includes('CORS') && !text.includes('Content Security Policy')) {
          jsErrors.push(`Console Error: ${text}`);
        }
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 500) {
        failedApis.push({ url: res.url(), status: res.status() });
      }
    });

    // Authenticate as owner_admin
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);
    await page.waitForTimeout(300);

    // Discover all SPA workspace pages registered in DOM via [data-page] or window.ENGINES
    const registeredEngines = await page.evaluate(() => {
      const engines = window.ENGINES ? Object.keys(window.ENGINES) : [];
      const dataPages = Array.from(document.querySelectorAll('[data-page]')).map(el => el.dataset.page).filter(Boolean);
      return Array.from(new Set([...engines, ...dataPages]));
    });

    testInfo.annotations.push({
      type: 'discovered-routes',
      description: registeredEngines.map(e => `/dashboard.html#${e}`),
    });

    expect(registeredEngines.length).toBeGreaterThan(0);

    // Visit discovered workspace pages dynamically
    for (const engineKey of registeredEngines.slice(0, 15)) {
      await page.evaluate((key) => {
        if (typeof window.switchPage === 'function') {
          window.switchPage(key);
        }
      }, engineKey);

      await page.waitForTimeout(100);
    }

    // Check for broken images (naturalWidth === 0)
    const images = await page.locator('img').all();
    for (const img of images) {
      const isLoaded = await img.evaluate((node) => node.complete && node.naturalWidth > 0);
      const src = await img.getAttribute('src');
      if (!isLoaded && src && !src.startsWith('data:')) {
        brokenImages.push(src);
      }
    }

    expect(brokenImages.length, `Broken images found: ${brokenImages.join(', ')}`).toBe(0);
    expect(jsErrors.length, `Console JS errors: ${jsErrors.join('; ')}`).toBe(0);
    expect(failedApis.length, `Server 5xx errors: ${JSON.stringify(failedApis)}`).toBe(0);
  });

});
