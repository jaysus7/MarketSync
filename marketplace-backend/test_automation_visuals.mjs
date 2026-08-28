import pkg from '@playwright/test';
const { chromium } = pkg;
import path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Intercept all API calls and return clean successful mock responses
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/me') || url.includes('/user/profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: {
            id: 'usr_test_1',
            role: 'dealer_admin',
            dealership_id: 'deal_123',
            name: 'Jason Massie',
            email: 'jason@marketsync.link',
            package: 'dealer_os',
            entitlements: ['all']
          }
        })
      });
    }
    if (url.includes('onrender.com') || (url.includes('localhost:3000') && !url.includes('.html') && !url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.svg') && !url.includes('.jpg'))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [], items: [], contacts: [], deals: [], workflows: [] })
      });
    }
    return route.continue();
  });

  // Load dashboard
  await page.goto('http://localhost:3000/dashboard.html');

  // Seed auth token and demo user
  await page.addInitScript(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const user = {
      id: 'usr_admin_1',
      email: 'admin@apexautogallery.com',
      name: 'Jason Massie',
      role: 'DEALER_ADMIN',
      dealership_id: 'dealership_apex_1',
      dealership: {
        id: 'dealership_apex_1',
        name: 'Apex Auto Gallery',
        plan: 'dealeros_complete'
      }
    };
    const access = {
      isPlatformStaff: true,
      products: ['dealer_os'],
      features: ['os.automations', 'os.marketing', 'os.sales', 'os.inventory']
    };

    localStorage.setItem('token', 'mock-token-dealer-admin');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('ms_remember_until', String(Date.now() + 864000000));
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('ms_theme', 'dark');
    localStorage.setItem('ms_clock_ack', '1');
    localStorage.setItem('hr_clock_ack', '1');
    localStorage.setItem('shift_clock_dismissed', 'true');
    localStorage.setItem('ms_timeclock_prompt_date', todayStr);
    localStorage.setItem('ms_time_clock_state', JSON.stringify({ status: 'in', start_time: Date.now() }));
    localStorage.setItem('ms_timeclock_state', JSON.stringify({ status: 'in', start_time: Date.now() }));
    localStorage.setItem('ms_shift_clock_state', JSON.stringify({ clocked_in: true, shift_id: 'sh1', start_time: new Date().toISOString() }));

    window.profileContext = user;
    window.__access = access;
    window.accessContext = access;
    window.checkLoginPunchClockPrompt = () => {};
  });

  await page.goto('http://localhost:3000/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Navigate to Automations and filter to Leads
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.querySelectorAll('#automation-modal, #automation-modal-backdrop, #punch-clock-modal, #shift-clock-modal, [data-modal="punch-clock"], .punch-clock-overlay, #modal-backdrop, .modal-backdrop').forEach(m => m.remove());

    if (typeof deptGo === 'function') {
      deptGo('automation-builder', null, 'automations');
    } else if (typeof switchPage === 'function') {
      switchPage('automation-builder');
    }

    if (typeof autoTab === 'function') {
      autoTab('automations');
    }
    if (typeof filterAutoCategory === 'function') {
      filterAutoCategory('leads');
    }
  });

  await page.waitForTimeout(1500);

  const artifactDir = '/Users/jasonmassie/.gemini/antigravity-ide/brain/302325b5-60ab-47ad-aa51-641efab70936';
  await page.screenshot({ path: path.join(artifactDir, 'automation_templates_cards_dark.png'), fullPage: false });

  // Open Visual Workflow Builder for lead_immediate_response
  await page.evaluate(() => {
    if (typeof openVisualWorkflowBuilder === 'function') {
      openVisualWorkflowBuilder('lead_immediate_response');
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'workflow_builder_instant_lead_dark.png'), fullPage: false });

  // Close modal and open Visual Workflow Builder for service_maint_reminder
  await page.evaluate(() => {
    const modal = document.getElementById('visual-wf-builder-modal');
    if (modal) modal.classList.add('hidden');
    if (typeof openVisualWorkflowBuilder === 'function') {
      openVisualWorkflowBuilder('service_maint_reminder');
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'workflow_builder_maint_reminder_dark.png'), fullPage: false });

  // Close builder and open Test Send Modal
  await page.evaluate(() => {
    const modal = document.getElementById('visual-wf-builder-modal');
    if (modal) modal.classList.add('hidden');
    if (typeof testSendWorkflowModal === 'function') {
      testSendWorkflowModal('lead_immediate_response');
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'workflow_test_send_modal_dark.png'), fullPage: false });

  console.log('Screenshots captured successfully!');
  await browser.close();
  process.exit(0);
})();
