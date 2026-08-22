import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES } from './helpers/auth.js';

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

test.describe('Staging Performance Benchmark & Asset Profiler', () => {

  test('Measures page load, FCP/LCP, asset sizes, and REAL API latencies', async ({ page }, testInfo) => {
    const callCounts = new Map();
    const apiLatencies = []; // { url, ms }
    const oversizedAssets = [];

    page.on('request', (req) => {
      const url = req.url();
      callCounts.set(url, (callCounts.get(url) || 0) + 1);
    });

    page.on('response', async (res) => {
      const url = res.url();
      const headers = res.headers();
      const contentLength = parseInt(headers['content-length'] || '0', 10);
      if (contentLength > 1048576) {
        const msg = `Oversized Asset (> 1MB): ${url} (${(contentLength / 1048576).toFixed(2)} MB)`;
        oversizedAssets.push(msg);
        testInfo.annotations.push({ type: 'broken-asset', description: msg });
      }
      // Real per-request latency from the browser resource timing.
      if (url.includes('/api/') || url.includes('/auth/')) {
        try {
          const t = res.request().timing();
          const ms = (t.responseEnd >= 0 && t.requestStart >= 0)
            ? t.responseEnd - t.requestStart
            : (t.responseEnd >= 0 ? t.responseEnd - t.startTime : -1);
          if (ms >= 0) apiLatencies.push({ url, ms });
        } catch (_) { /* timing not always available */ }
      }
    });

    const startTime = Date.now();
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);
    const loadTime = Date.now() - startTime;

    // Paint + navigation + LCP metrics.
    const metrics = await page.evaluate(() => new Promise((resolve) => {
      const perf = window.performance;
      const nav = perf.getEntriesByType('navigation')[0];
      const paint = perf.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      let lcp = 0;
      try {
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) lcp = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (_) { /* not supported */ }
      setTimeout(() => resolve({
        domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
        loadEvent: nav ? nav.loadEventEnd - nav.startTime : 0,
        fcp: fcp ? fcp.startTime : 0,
        lcp,
      }), 600);
    }));

    // Summarize real API latency.
    const durations = apiLatencies.map(a => a.ms).sort((a, b) => a - b);
    const p50 = percentile(durations, 50);
    const p95 = percentile(durations, 95);
    const slowApis = apiLatencies.filter(a => a.ms > 1000);

    testInfo.annotations.push({
      type: 'api-latency',
      description: `count=${durations.length} p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms slow(>1s)=${slowApis.length}`,
    });
    testInfo.annotations.push({
      type: 'web-vitals',
      description: `load=${loadTime}ms FCP=${metrics.fcp.toFixed(0)}ms LCP=${metrics.lcp.toFixed(0)}ms DCL=${metrics.domContentLoaded.toFixed(0)}ms`,
    });
    for (const s of slowApis) {
      testInfo.annotations.push({ type: 'slow-api', description: `${s.ms.toFixed(0)}ms ${s.url}` });
    }

    // Duplicate / excessive polling.
    const duplicateCalls = [];
    for (const [url, count] of callCounts.entries()) {
      if (count > 5 && url.includes('/api/')) {
        const msg = `Excessive/Duplicate Polling (${count} calls): ${url}`;
        duplicateCalls.push(msg);
        testInfo.annotations.push({ type: 'duplicate-api', description: msg });
      }
    }

    if (loadTime > 3000) {
      testInfo.annotations.push({ type: 'slow-page', description: `Slow Page Load (${loadTime}ms) threshold 3000ms` });
    }

    // Assertions: functional ceilings (report finer detail via annotations above).
    expect(loadTime, 'dashboard load exceeded the 10s functional ceiling').toBeLessThan(10000);
    expect(oversizedAssets, `Oversized assets: ${oversizedAssets.join('; ')}`).toEqual([]);
    expect(p95, 'API p95 latency exceeded 5s').toBeLessThan(5000);
  });

  test('Profiles core workspace route transitions for latency baselines', async ({ page }, testInfo) => {
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    const routes = ['inventory', 'crm', 'sales', 'fni', 'service'];
    for (const routeKey of routes) {
      const start = Date.now();
      await page.evaluate((key) => { try { window.switchPage(key); } catch (_) {} }, routeKey);
      await page.waitForFunction(() => {
        const main = document.querySelector('main') || document.body;
        return main && main.innerText && main.innerText.trim().length > 40;
      }, { timeout: 8000 }).catch(() => {});
      const elapsed = Date.now() - start;
      testInfo.annotations.push({ type: 'route-latency', description: `${routeKey}=${elapsed}ms` });
      if (elapsed > 3000) {
        testInfo.annotations.push({ type: 'slow-page', description: `Slow Workspace Route: ${routeKey} took ${elapsed}ms` });
      }
    }
  });

});
