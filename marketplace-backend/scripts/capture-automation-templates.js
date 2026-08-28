import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = '/Users/jasonmassie/.gemini/antigravity-ide/brain/302325b5-60ab-47ad-aa51-641efab70936';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, err.stack));

  // Inject user credentials into localStorage before loading
  await page.addInitScript(() => {
    // Standard mock JWT token (valid format with exp in future)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: 'usr_dealer_admin_1',
      email: 'jason@apexmotors.com',
      role: 'dealer_admin',
      exp: Math.floor(Date.now() / 1000) + 86400 * 30
    }));
    const mockJwt = `${header}.${payload}.signature_mock`;

    localStorage.setItem('token', mockJwt);
    localStorage.setItem('refresh_token', 'mock_refresh_token');
    localStorage.setItem('ms_remember_until', String(Date.now() + 30 * 86400000));
    localStorage.setItem('user', JSON.stringify({
      id: 'usr_1',
      role: 'dealer_admin',
      name: 'Jason Massie',
      store_name: 'Apex Motor Group',
      email: 'jason@apexmotors.com',
      tier: 'dealer_os',
      plan: 'dealer_os'
    }));
  });

  console.log('Navigating to http://localhost:3000/dashboard.html...');
  await page.goto('http://localhost:3000/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Switch to automation-builder page
  console.log('Switching to automation-builder...');
  await page.evaluate(async () => {
    if (typeof window.switchPage === 'function') {
      window.switchPage('automation-builder');
    }
    if (typeof window.autoTab === 'function') {
      window.autoTab('automations');
    }
  });
  await page.waitForTimeout(1500);

  // 1. Capture Leads Workflow Cards
  console.log('Capturing automation templates cards...');
  await page.screenshot({
    path: path.join(artifactDir, 'automation_templates_cards_dark.png'),
    fullPage: false
  });

  // 2. Open Visual Builder on Instant New Lead 90-Second Response
  console.log('Opening Visual Builder for Instant New Lead...');
  await page.evaluate(() => {
    if (typeof window.openVisualWorkflowBuilder === 'function') {
      window.openVisualWorkflowBuilder('lead_immediate_response');
    }
  });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(artifactDir, 'automation_visual_builder_lead_dark.png'),
    fullPage: false
  });

  // Close Visual Builder
  await page.evaluate(() => {
    if (typeof window.closeVisualBuilder === 'function') {
      window.closeVisualBuilder();
    }
  });
  await page.waitForTimeout(800);

  // 3. Open Visual Builder on Service Workflow
  console.log('Opening Visual Builder for Service Maintenance Reminder...');
  await page.evaluate(() => {
    if (typeof window.openVisualWorkflowBuilder === 'function') {
      window.openVisualWorkflowBuilder('service_maint_reminder');
    }
  });
  await page.waitForTimeout(1200);

  await page.screenshot({
    path: path.join(artifactDir, 'automation_visual_builder_service_dark.png'),
    fullPage: false
  });

  // Close Visual Builder
  await page.evaluate(() => {
    if (typeof window.closeVisualBuilder === 'function') {
      window.closeVisualBuilder();
    }
  });
  await page.waitForTimeout(800);

  // 4. Open Test Send Modal
  console.log('Opening Test Send Modal for Day 3 Bump...');
  await page.evaluate(() => {
    if (typeof window.testSendWorkflowModal === 'function') {
      window.testSendWorkflowModal('lead_day3_bump');
    }
  });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(artifactDir, 'automation_test_send_modal_dark.png'),
    fullPage: false
  });

  // Close modal
  await page.evaluate(() => {
    const m = document.getElementById('auto-test-send-modal');
    if (m) m.remove();
  });
  await page.waitForTimeout(500);

  // 5. Open Quick Edit Modal
  console.log('Opening Quick Edit Modal...');
  await page.evaluate(() => {
    if (typeof window.openQuickEditAutoModal === 'function') {
      window.openQuickEditAutoModal('lead_immediate_response');
    }
  });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(artifactDir, 'automation_quick_edit_modal_dark.png'),
    fullPage: false
  });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
