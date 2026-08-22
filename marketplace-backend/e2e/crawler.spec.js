import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES } from './helpers/auth.js';

test.describe('Automated Full-Site Staging Link Crawler & Route Validator', () => {

  test('Crawls public pages, follows internal links, and checks assets & JS errors', async ({ page, baseURL }) => {
    const jsErrors = [];
    const failedRequests = [];

    page.on('pageerror', (err) => jsErrors.push(`Uncaught Exception: ${err.message}`));
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

    const res = await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    expect(res.status()).toBeLessThan(400);

    // Discover internal, same-origin page links (skip anchors, mailto, tel, assets).
    const origin = new URL(baseURL || page.url()).origin;
    const rawHrefs = await page.$$eval('a[href]', (as) => as.map(a => a.getAttribute('href')));
    const hrefs = rawHrefs.filter(Boolean);

    // Dead-link guard: bare "#" or javascript:void(0) with no behavior.
    const deadHrefs = hrefs.filter(h => h === '#' || h.startsWith('javascript:void(0)'));
    expect(deadHrefs.length, `Found ${deadHrefs.length} dead links`).toBe(0);

    const internal = new Set();
    for (const h of hrefs) {
      try {
        const u = new URL(h, page.url());
        if (u.origin !== origin) continue;
        if (/\.(png|jpe?g|svg|gif|webp|css|js|ico|pdf|woff2?)$/i.test(u.pathname)) continue;
        u.hash = '';
        internal.add(u.pathname + u.search);
      } catch (_) { /* ignore malformed */ }
    }

    // Actually visit each internal route (no artificial cap) and assert it loads.
    const brokenRoutes = [];
    for (const routePath of internal) {
      const r = await page.goto(routePath, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (!r || r.status() >= 400) {
        brokenRoutes.push({ routePath, status: r ? r.status() : 'no-response' });
        continue;
      }
      const bodyText = await page.innerText('body').catch(() => '');
      if (bodyText.trim().length < 50) brokenRoutes.push({ routePath, status: 'blank' });
    }

    expect(brokenRoutes, `Broken internal routes: ${JSON.stringify(brokenRoutes)}`).toEqual([]);
    expect(jsErrors, `JS errors found: ${jsErrors.join('; ')}`).toEqual([]);
    expect(failedRequests, `Failed network requests: ${JSON.stringify(failedRequests)}`).toEqual([]);
  });

  test('Crawls ALL authenticated SPA workspace routes (no cap), asserts clean render', async ({ page }, testInfo) => {
    const jsErrors = [];
    const failedApis = [];
    const brokenImages = [];

    page.on('pageerror', (err) => jsErrors.push(`Uncaught Exception: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!/401|403|ERR_CONNECTION_REFUSED|Failed to load resource|CORS|Content Security Policy/.test(text)) {
          jsErrors.push(`Console Error: ${text}`);
        }
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 500) failedApis.push({ url: res.url(), status: res.status() });
    });

    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    const registeredEngines = await page.evaluate(() => {
      const engines = window.ENGINES ? Object.keys(window.ENGINES) : [];
      const workspaces = window.MS_WORKSPACES ? Object.keys(window.MS_WORKSPACES) : [];
      const dataPages = Array.from(document.querySelectorAll('[data-page]')).map(el => el.dataset.page).filter(Boolean);
      return Array.from(new Set([...engines, ...workspaces, ...dataPages]));
    });

    testInfo.annotations.push({
      type: 'discovered-routes',
      description: `${registeredEngines.length} routes: ${registeredEngines.join(', ')}`,
    });
    expect(registeredEngines.length).toBeGreaterThan(0);

    // Visit EVERY discovered route — no slice cap.
    const stuckRoutes = [];
    for (const engineKey of registeredEngines) {
      await page.evaluate((key) => { try { window.switchPage(key); } catch (_) {} }, engineKey);
      const ok = await page.waitForFunction(() => {
        const main = document.querySelector('main') || document.body;
        return main && main.innerText && main.innerText.trim().length > 40;
      }, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!ok) stuckRoutes.push(engineKey);
    }

    const images = await page.locator('img').all();
    for (const img of images) {
      const isLoaded = await img.evaluate((node) => node.complete && node.naturalWidth > 0);
      const src = await img.getAttribute('src');
      if (!isLoaded && src && !src.startsWith('data:')) brokenImages.push(src);
    }

    expect(stuckRoutes, `Workspaces stuck blank/loading: ${stuckRoutes.join(', ')}`).toEqual([]);
    expect(brokenImages, `Broken images: ${brokenImages.join(', ')}`).toEqual([]);
    expect(jsErrors, `Console JS errors: ${jsErrors.join('; ')}`).toEqual([]);
    expect(failedApis, `Server 5xx errors: ${JSON.stringify(failedApis)}`).toEqual([]);
  });

});
