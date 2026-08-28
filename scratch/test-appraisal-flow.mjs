import { chromium } from '/Users/jasonmassie/Developer/MarketSync/marketplace-backend/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'marketplace-frontend');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/dashboard.html';
  const filePath = path.join(FRONTEND_DIR, reqPath);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, async () => {
  console.log('Test server listening on port 3000');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[BROWSER ERROR]', msg.text());
  });
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

  function resContact(route, id) {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contact: {
          id: 'c-101',
          first_name: 'Sarah',
          last_name: 'Connor',
          full_name: 'Sarah Connor',
          phone: '416-555-0199',
          phone_mobile: '416-555-0199',
          email: 'sarah.connor@example.com',
          address: '123 Cyber Way',
          city: 'Toronto',
          province: 'ON',
          postal_code: 'M5V 2T6',
          status: 'contacted',
          trade_vehicle: {
            vin: '1HGCR2F83HA000101',
            year: '2019',
            make: 'Honda',
            model: 'Accord',
            trim: 'Sport 2.0T',
            mileage: '48,500'
          }
        },
        timeline: [],
        tasks: [],
        deal: null
      })
    });
  }

  await page.route(url => !url.href.includes('3000'), async route => {
    const url = route.request().url();
    if (url.includes('/crm/contacts/')) {
      const id = url.split('/').pop().split('?')[0];
      return resContact(route, id);
    }
    if (url.includes('/equity/lease/by-contact/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lease: null, settings: {} })
      });
    }
    if (url.includes('/ai/appraisals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], meta: { restricted: false, salespeople: [] } })
      });
    }
    if (url.includes('/access/context') || url.includes('/entitlements')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: ['dealer_os', 'facebook', 'ai_dealer'],
          features: ['os.dashboard', 'os.crm', 'os.inventory', 'os.reports', 'os.settings', 'os.sales', 'os.service', 'os.team', 'os.accounting', 'os.marketing', 'os.website', 'os.automations'],
          isPlatformStaff: false
        })
      });
    }
    if (url.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-1',
          name: 'Jason Massie',
          role: 'DEALER_ADMIN',
          dealership_id: 'd-1',
          dealership: { id: 'd-1', name: 'Massie Motors', plan: 'dealeros_complete' }
        })
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('ms_auth_token', 'mock-token');
    localStorage.setItem('user', JSON.stringify({
      id: 'u-1',
      name: 'Jason Massie',
      role: 'DEALER_ADMIN',
      dealership_id: 'd-1',
      plan: 'dealeros_complete'
    }));
    localStorage.setItem('profileContext', JSON.stringify({
      id: 'u-1',
      role: 'DEALER_ADMIN',
      name: 'Jason Massie',
      plan: 'dealeros_complete',
      dealership: { id: 'd-1', plan: 'dealeros_complete' },
      products: ['dealer_os', 'facebook'],
      features: ['os.sales', 'os.crm', 'os.appraisal', 'os.inventory', 'os.dashboard']
    }));
  });

  await page.goto('http://localhost:3000/dashboard.html');
  await page.waitForTimeout(1500);

  // Step 1: Open customer modal
  console.log('Testing openCrmContact...');
  await page.evaluate(() => openCrmContact('c-101'));
  await page.waitForTimeout(1000);

  // Take screenshot of Customer Modal
  await page.screenshot({ path: path.join(__dirname, '../customer_card_modal.png') });
  console.log('Saved customer_card_modal.png');

  // Step 2: Click "Appraise Trade" button inside the modal dialog
  console.log('Clicking Appraise Trade inside modal...');
  const clickedInfo = await page.evaluate(() => {
    const modal = document.querySelector('.ms-modal-scrim') || document.querySelector('.ms-crm-glass');
    if (!modal) return { modalFound: false };
    const btns = Array.from(modal.querySelectorAll('button')).map(b => ({ text: b.textContent.trim(), onclick: b.getAttribute('onclick') }));
    const tradeBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.includes('Appraise Trade') || b.textContent.includes('Full Appraisal'));
    if (tradeBtn) {
      tradeBtn.click();
      return { modalFound: true, clicked: true, text: tradeBtn.textContent, onclick: tradeBtn.getAttribute('onclick') };
    }
    return { modalFound: true, clicked: false, btns };
  });
  console.log('Modal button info:', clickedInfo);

  await page.waitForTimeout(1000);
  const activePageInfo = await page.evaluate(() => {
    const active = document.querySelector('.page-content:not(.hidden)');
    return { activeId: active?.getAttribute('data-page-content') };
  });
  console.log('Active page after click:', activePageInfo);

  // Step 3: Verify we are on Trade Appraisal page and customer fields are filled
  const pageContentVisible = await page.$eval('[data-page-content="appraisal"]', el => !el.classList.contains('hidden'));
  console.log('Is [data-page-content="appraisal"] visible?', pageContentVisible);

  const custFirstVal = await page.$eval('#cust-first', el => el.value);
  const custLastVal = await page.$eval('#cust-last', el => el.value);
  const custPhoneVal = await page.$eval('#cust-mobile-phone', el => el.value);
  const custEmailVal = await page.$eval('#cust-email', el => el.value);
  const custPostalVal = await page.$eval('#cust-postal', el => el.value);
  const custAddressVal = await page.$eval('#cust-address', el => el.value);
  const apprVinVal = await page.$eval('#appr-vin', el => el.value);
  const apprYearVal = await page.$eval('#appr-year', el => el.value);
  const apprMakeVal = await page.$eval('#appr-make', el => el.value);
  const apprModelVal = await page.$eval('#appr-model', el => el.value);
  const linkedName = await page.$eval('#appr-cust-linked-name', el => el.textContent);

  console.log('Prefill Results:');
  console.log('  First Name:', custFirstVal);
  console.log('  Last Name:', custLastVal);
  console.log('  Mobile Phone:', custPhoneVal);
  console.log('  Email:', custEmailVal);
  console.log('  Postal:', custPostalVal);
  console.log('  Address:', custAddressVal);
  console.log('  Trade VIN:', apprVinVal);
  console.log('  Trade Vehicle:', `${apprYearVal} ${apprMakeVal} ${apprModelVal}`);
  console.log('  Linked Badge Name:', linkedName);

  // Dismiss any open modal before screenshot
  await page.evaluate(() => {
    document.querySelectorAll('#automation-modal, .ms-modal-scrim, [id*="modal"]').forEach(el => el.remove());
  });
  await page.waitForTimeout(300);

  // Save Trade Appraisal screenshots in Light and Dark mode
  await page.screenshot({ path: path.join(__dirname, '../appraisal_prefilled_light.png') });
  
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, '../appraisal_prefilled_dark.png') });

  console.log('Saved appraisal_prefilled_light.png and appraisal_prefilled_dark.png');

  if (custFirstVal === 'Sarah' && custLastVal === 'Connor' && custEmailVal === 'sarah.connor@example.com' && apprVinVal === '1HGCR2F83HA000101') {
    console.log('>>> TEST PASSED: Customer contact and trade details prefilled perfectly on Trade Appraisal page! <<<');
  } else {
    console.error('>>> TEST FAILED: Fields did not match expected values! <<<');
  }

  await browser.close();
  server.close();
  process.exit(0);
});
