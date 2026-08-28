import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '../../marketplace-frontend');

// Simple static server
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/dashboard.html';
  const filePath = path.join(frontendDir, reqPath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end('Not found');
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(8099, async () => {
  console.log('Static server listening on http://localhost:8099');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Route interceptor for all API endpoints
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.includes('.js') || url.includes('.css') || url.includes('.html') || url.includes('.png') || url.includes('.svg') || url.includes('.woff') || url.includes('fonts.googleapis') || url.includes('cdn.jsdelivr')) {
      return route.continue();
    }
    // Return mock JSON for any API calls
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          id: 'usr_123',
          role: 'dealer_admin',
          plan: 'dealer_os',
          tier: 'dealer_os',
          email: 'jason@apexmotors.com',
          dealership: { id: 'dlr_1', name: 'Apex Motors' }
        },
        profile: {
          id: 'usr_123',
          role: 'dealer_admin',
          plan: 'dealer_os',
          tier: 'dealer_os',
          email: 'jason@apexmotors.com',
          dealership: { id: 'dlr_1', name: 'Apex Motors' }
        },
        data: [],
        workflows: []
      })
    });
  });

  // Seed localStorage
  await page.addInitScript(() => {
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
    localStorage.setItem('ms_dash_mode', 'demo');
  });

  await page.goto('http://localhost:8099/dashboard.html');
  await page.waitForTimeout(1500);

  // Switch to dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });

  // Navigate to Automations Tab
  await page.evaluate(() => {
    if (typeof window.showPage === 'function') {
      window.showPage('automation-builder');
    }
    if (typeof window.loadAutoBuilderPage === 'function') {
      window.loadAutoBuilderPage();
    }
  });
  await page.waitForTimeout(1000);

  // Take screenshot of Automations Cards
  const artifactDir = '/Users/jasonmassie/.gemini/antigravity-ide/brain/302325b5-60ab-47ad-aa51-641efab70936';
  await page.screenshot({ path: `${artifactDir}/automations_templates_cards_dark.png`, fullPage: false });
  console.log('Saved automations_templates_cards_dark.png');

  // Switch to Service tab
  await page.evaluate(() => {
    if (typeof window.switchAutoCategory === 'function') {
      window.switchAutoCategory('service');
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${artifactDir}/automations_service_cards_dark.png`, fullPage: false });
  console.log('Saved automations_service_cards_dark.png');

  // Switch back to leads and open Visual Workflow Builder for 'lead_immediate_response'
  await page.evaluate(() => {
    if (typeof window.switchAutoCategory === 'function') {
      window.switchAutoCategory('leads');
    }
    if (typeof window.openVisualWorkflowBuilder === 'function') {
      window.openVisualWorkflowBuilder('lead_immediate_response');
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${artifactDir}/visual_workflow_builder_lead_response.png`, fullPage: false });
  console.log('Saved visual_workflow_builder_lead_response.png');

  // Open Visual Builder for 'lead_missed_rep' (Missed Lead Manager Escalation)
  await page.evaluate(() => {
    if (typeof window.openVisualWorkflowBuilder === 'function') {
      window.openVisualWorkflowBuilder('lead_missed_rep');
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${artifactDir}/visual_workflow_builder_missed_rep.png`, fullPage: false });
  console.log('Saved visual_workflow_builder_missed_rep.png');

  // Open Test Send modal for 'lead_day7_checkin'
  await page.evaluate(() => {
    if (typeof window.closeVisualBuilder === 'function') {
      window.closeVisualBuilder();
    }
    if (typeof window.testSendWorkflowModal === 'function') {
      window.testSendWorkflowModal('lead_day7_checkin');
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${artifactDir}/test_send_modal_preview.png`, fullPage: false });
  console.log('Saved test_send_modal_preview.png');

  await browser.close();
  server.close();
  process.exit(0);
});
