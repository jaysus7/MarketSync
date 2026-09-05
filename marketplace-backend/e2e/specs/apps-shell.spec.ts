/**
 * Standalone-apps shell E2E — the only spec that can run without a
 * per-role authentication fixture. Verifies each /apps/*.html launcher
 * loads its iframe against /dashboard.html?embedded=<slug>, respects
 * the mobile viewport, and paints before the 3-second budget.
 *
 * Run:
 *   E2E_BASE_URL=https://staging.marketsync.link \
 *     npx playwright test apps-shell
 */
import { test, expect } from '@playwright/test'

const APPS: Array<{ path: string; slug: string; title: RegExp }> = [
  { path: '/apps/appraisals.html',      slug: 'appraisal',       title: /Appraisals/i },
  { path: '/apps/video-studio.html',    slug: 'video-studio',    title: /Video Studio/i },
  { path: '/apps/design-studio.html',   slug: 'design-studio',   title: /Design Studio/i },
  { path: '/apps/website-studio.html',  slug: 'website-studio',  title: /Website Studio/i },
  { path: '/apps/crm.html',             slug: 'crm',             title: /CRM/i },
  { path: '/apps/email-sms.html',       slug: 'email-sms',       title: /Email/i },
  { path: '/apps/desking.html',         slug: 'desking',         title: /Desking/i },
  { path: '/apps/service-checkin.html', slug: 'service-checkin', title: /Service Check-in/i },
]

for (const app of APPS) {
  test(`apps ${app.slug} loads with the shared-source iframe`, async ({ page }) => {
    const t0 = Date.now()
    await page.goto(app.path, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(app.title)
    const iframe = page.locator('iframe#app-frame')
    await expect(iframe).toHaveAttribute('src', new RegExp(`/dashboard\\.html\\?embedded=${app.slug}$`))
    // Shared shell must be branded.
    await expect(page.locator('.app-header__brand')).toContainText(/MarketSync/i)
    // Fast-load budget: shell painted in < 3s on desktop, 4s on mobile.
    const budget = test.info().project.name.includes('mobile') ? 4000 : 3000
    const shellPaint = Date.now() - t0
    expect(shellPaint, `shell paint took ${shellPaint}ms (budget ${budget}ms)`).toBeLessThan(budget)
    // Iframe must have same-origin permission — we can reach into it
    // even without logging in (it will land on /login, which is what
    // the shell watches for).
    const frame = page.frameLocator('#app-frame')
    // If the app is embedded correctly, either the login page loads
    // (visitor is signed out) or the tool page renders. Both are OK
    // for the shell spec; either presence proves the iframe is served.
    const rendered = await Promise.race([
      frame.locator('form[action*="login"], form#login-form').first().waitFor({ timeout: 8000 }).then(() => 'login'),
      frame.locator('[data-page-content]').first().waitFor({ timeout: 8000 }).then(() => 'tool'),
    ]).catch(() => null)
    expect(rendered, `${app.slug} iframe did not render either the login page or the tool`).not.toBeNull()
  })
}

test('picker renders every app tile in the locked priority order', async ({ page }) => {
  await page.goto('/apps/')
  const tiles = page.locator('.app-tile__name')
  await expect(tiles).toHaveCount(APPS.length)
  const expectedOrder = ['Appraisals', 'Video Studio', 'Design Studio', 'Website Studio', 'CRM', 'Email & SMS', 'Desking', 'Service Check-in']
  for (let i = 0; i < expectedOrder.length; i++) {
    await expect(tiles.nth(i)).toContainText(expectedOrder[i])
  }
})
