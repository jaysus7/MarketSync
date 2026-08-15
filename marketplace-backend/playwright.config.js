import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for MarketSync Automated Staging QA & Performance Suite.
 */
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
    baseURL: process.env.STAGING_URL || process.env.BASE_URL || 'http://localhost:3000',
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
  webServer: process.env.STAGING_URL ? undefined : {
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
  },
});
