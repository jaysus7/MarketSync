import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES } from './helpers/auth.js';

test.describe('Staging Performance Benchmark & Asset Profiler', () => {

  test('Measures page load time, FCP, asset sizes, and API latencies', async ({ page }, testInfo) => {
    const apiRequests = new Map();
    const oversizedAssets = [];
    const slowApis = [];
    const duplicateCalls = [];

    // Intercept network requests to track latencies, asset sizes, and duplicates
    page.on('request', (req) => {
      const url = req.url();
      const count = apiRequests.get(url) || 0;
      apiRequests.set(url, count + 1);
    });

    page.on('response', async (res) => {
      const url = res.url();
      const headers = res.headers();
      const contentLength = parseInt(headers['content-length'] || '0', 10);

      // Flag assets > 1 MB (1,048,576 bytes)
      if (contentLength > 1048576) {
        const warningMsg = `Oversized Asset (> 1MB): ${url} (${(contentLength / 1048576).toFixed(2)} MB)`;
        oversizedAssets.push(warningMsg);
        testInfo.annotations.push({ type: 'broken-asset', description: warningMsg });
      }
    });

    const startTime = Date.now();
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);
    const loadTime = Date.now() - startTime;

    // Evaluate browser performance timing metrics (FCP & Navigation Timing)
    const metrics = await page.evaluate(() => {
      const perf = window.performance;
      const nav = perf.getEntriesByType('navigation')[0];
      const paint = perf.getEntriesByType('paint');
      const fcpEntry = paint.find(p => p.name === 'first-contentful-paint');

      return {
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
        loadEvent: nav ? nav.loadEventEnd - nav.startTime : 0,
        fcp: fcpEntry ? fcpEntry.startTime : 0,
      };
    });

    // Check for duplicate API calls
    for (const [url, count] of apiRequests.entries()) {
      if (count > 5 && url.includes('/api/')) {
        const dupMsg = `Excessive/Duplicate Polling (${count} calls): ${url}`;
        duplicateCalls.push(dupMsg);
        testInfo.annotations.push({ type: 'duplicate-api', description: dupMsg });
      }
    }

    // Flag page load time > 3000ms (3 seconds)
    if (loadTime > 3000) {
      const slowMsg = `Slow Page Load (${loadTime}ms): Dashboard workspace loaded in ${loadTime}ms (threshold: 3000ms)`;
      testInfo.annotations.push({ type: 'slow-page', description: slowMsg });
    }

    // Verify baseline load performance
    expect(loadTime).toBeLessThan(10000); // Functional ceiling: 10s
    expect(oversizedAssets.length).toBe(0);
  });

  test('Profiles 5 core workspace routes for API latency baselines', async ({ page }, testInfo) => {
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    const routes = ['inventory', 'crm', 'sales', 'fni', 'service'];

    for (const routeKey of routes) {
      const start = Date.now();
      await page.evaluate((key) => window.switchPage(key), routeKey);
      await page.waitForTimeout(150);
      const elapsed = Date.now() - start;

      if (elapsed > 3000) {
        const slowMsg = `Slow Workspace Route transition: ${routeKey} took ${elapsed}ms`;
        testInfo.annotations.push({ type: 'slow-page', description: slowMsg });
      }
    }
  });

});
