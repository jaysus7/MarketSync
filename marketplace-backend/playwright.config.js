import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for MarketSync Automated Staging QA & Performance Suite.
 *
 * Target resolution:
 *  - STAGING_URL / BASE_URL set to a REAL deployed origin  -> test that origin, start no local server.
 *  - unset (or pointing at localhost)                      -> boot the app locally and test it.
 * The previous config keyed `webServer` on `STAGING_URL` being merely *defined*, so the CI
 * fallback of STAGING_URL=http://localhost:3000 disabled the local server AND had nothing to
 * connect to -> ERR_CONNECTION_REFUSED. Keying on "is this localhost?" fixes that.
 */
const TARGET = process.env.STAGING_URL || process.env.BASE_URL || 'http://localhost:3000';
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(TARGET);

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  expect: {
    timeout: 7000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['./e2e/helpers/reporter.js'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: TARGET,
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Boot the app locally ONLY when the target is localhost; against a real deployed
  // staging origin we must not spin up a throwaway server.
  webServer: IS_LOCAL_TARGET ? {
    command: 'node server.js',
    url: 'http://localhost:3000/health',
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      PORT: '3000',
      SERVE_STATIC: 'true',
      NODE_ENV: 'test',
      SKIP_DEMO_REFRESH: 'true',
      SUPABASE_URL: process.env.SUPABASE_URL || 'https://dummy.supabase.co',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'dummy-anon',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-role',
      RUN_WORKERS: 'false',
    },
  } : undefined,
});
