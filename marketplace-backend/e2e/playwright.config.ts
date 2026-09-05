/**
 * MarketSync DealerOS — Full E2E certification harness.
 *
 * Config reads every environment variable at run time so specs stay
 * portable across staging URLs and test dealerships. Nothing in this
 * file assumes a specific host or a specific test account.
 *
 * Run:
 *   E2E_BASE_URL=https://staging.marketsync.link \
 *   E2E_MANAGER_EMAIL=... E2E_MANAGER_PASSWORD=... \
 *   npx playwright test
 *
 * Every trace, screenshot and video lands under
 * docs/evidence/full-dealership-e2e/traces/ so the run is
 * independently reviewable.
 */
import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL

if (!baseURL) {
  // Warn instead of throw so `npx playwright test --list` still works
  // for discovery in CI where env vars are set per-job.
  // eslint-disable-next-line no-console
  console.warn(
    '[e2e] E2E_BASE_URL not set. Specs will fail; export it before running.'
  )
}

export default defineConfig({
  testDir: './specs',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // certification is a serial narrative
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../docs/evidence/full-dealership-e2e/traces/html', open: 'never' }],
    ['json', { outputFile: '../../docs/evidence/full-dealership-e2e/traces/results.json' }],
  ],
  outputDir: '../../docs/evidence/full-dealership-e2e/traces/artifacts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Every role's session is stored per-project below; global default
    // is unauthenticated so specs that must exercise the public /apps/
    // launcher work without a login.
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: 'public-desktop',  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'public-tablet',   use: { ...devices['iPad Mini'] } },
    { name: 'public-mobile',   use: { ...devices['iPhone 14'] } },
    { name: 'dealer-principal', use: { ...devices['Desktop Chrome'], storageState: 'auth/dealer-principal.json' } },
    { name: 'sales-manager',    use: { ...devices['Desktop Chrome'], storageState: 'auth/sales-manager.json' } },
    { name: 'salesperson',      use: { ...devices['Desktop Chrome'], storageState: 'auth/salesperson.json' } },
    { name: 'salesperson-mobile', use: { ...devices['iPhone 14'],    storageState: 'auth/salesperson.json' } },
    { name: 'bdc',              use: { ...devices['Desktop Chrome'], storageState: 'auth/bdc.json' } },
    { name: 'fni-manager',      use: { ...devices['Desktop Chrome'], storageState: 'auth/fni-manager.json' } },
    { name: 'service-advisor',  use: { ...devices['Desktop Chrome'], storageState: 'auth/service-advisor.json' } },
    { name: 'technician-mobile', use: { ...devices['iPhone 14'],    storageState: 'auth/technician.json' } },
    { name: 'parts',            use: { ...devices['Desktop Chrome'], storageState: 'auth/parts.json' } },
    { name: 'controller',       use: { ...devices['Desktop Chrome'], storageState: 'auth/controller.json' } },
    { name: 'marketing',        use: { ...devices['Desktop Chrome'], storageState: 'auth/marketing.json' } },
    { name: 'hq-owner',         use: { ...devices['Desktop Chrome'], storageState: 'auth/hq-owner.json' } },
  ],
})
