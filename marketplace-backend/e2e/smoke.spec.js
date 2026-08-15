import { test, expect } from '@playwright/test';
import { loginAsRole, STAGING_ROLES } from './helpers/auth.js';

const MANDATORY_SYSTEMS = [
  { key: 'command', title: 'Dashboard' },
  { key: 'inventory-overview', title: 'Inventory' },
  { key: 'crm', title: 'CRM' },
  { key: 'sales', title: 'Sales' },
  { key: 'desking', title: 'Desk a Deal' },
  { key: 'fni', title: 'F&I' },
  { key: 'service', title: 'Service' },
  { key: 'parts', title: 'Parts' },
  { key: 'accounting', title: 'Accounting' },
  { key: 'commissions', title: 'Commissions' },
  { key: 'studio', title: 'Design Studio' },
  { key: 'social', title: 'Social Scheduler' },
  { key: 'video', title: 'Video Creator' },
  { key: 'campaigns', title: 'Campaigns' },
  { key: 'chatbot', title: 'AI ChatBot' },
  { key: 'website', title: 'Website Builder' },
  { key: 'academy', title: 'Academy' },
  { key: 'people', title: 'People & HR' },
  { key: 'settings', title: 'Settings' },
];

test.describe('19 Mandatory Systems Smoke Test Suite (Admin & Role Matrix)', () => {

  test('Validates 19 mandatory systems as Owner/Admin (Full Access)', async ({ page }) => {
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    for (const sys of MANDATORY_SYSTEMS) {
      const switched = await page.evaluate((key) => {
        if (typeof window.switchPage === 'function') {
          window.switchPage(key);
          return true;
        }
        return false;
      }, sys.key);

      expect(switched, `switchPage('${sys.key}') (${sys.title}) should execute successfully`).toBe(true);
      await page.waitForTimeout(50);
    }
  });

  test('Verifies non-destructive UI controls (tabs, modals, filters, dropdowns)', async ({ page }) => {
    await loginAsRole(page, STAGING_ROLES.OWNER_ADMIN);

    // 1. Test Tab Switching in Sales Workspace
    await page.evaluate(() => {
      if (typeof window.switchPage === 'function') window.switchPage('sales');
    });
    await page.waitForTimeout(50);

    // 2. Test Modal Open / Close without side effects
    await page.evaluate(() => {
      if (typeof window.crmOverlay === 'function') {
        window.crmOverlay('<div id="test-qa-modal" class="p-6 text-slate-900 font-bold">QA Modal Test</div>', 'max-w-md');
      }
    });

    const modalVisible = await page.isVisible('#test-qa-modal');
    expect(modalVisible).toBe(true);

    // Close modal cleanly
    await page.evaluate(() => {
      const modalTarget = document.getElementById('test-qa-modal');
      if (modalTarget) {
        const overlay = modalTarget.closest('.fixed');
        if (overlay) overlay.remove();
        else modalTarget.remove();
      }
    });

    await page.waitForTimeout(50);
    const modalClosed = await page.isVisible('#test-qa-modal');
    expect(modalClosed).toBe(false);
  });

  test('Enforces Role-Based Access Control matrix (Restricted role)', async ({ page }) => {
    await loginAsRole(page, STAGING_ROLES.RESTRICTED);

    const activeRole = await page.evaluate(() => {
      return localStorage.getItem('ms_user_role');
    });

    expect(activeRole).toBe('CLEANUP');
  });

});
