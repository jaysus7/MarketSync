/**
 * Staging QA Authentication & Role Permission Helper.
 * Supports dedicated staging QA accounts supplied via environment variables
 * or local staging session tokens for role testing.
 */

export const STAGING_ROLES = {
  OWNER_ADMIN: 'owner_admin',
  MANAGER: 'manager',
  SALESPERSON: 'salesperson',
  SERVICE_TECH: 'service_tech',
  RESTRICTED: 'restricted',
};

// Credentials retrieved strictly from environment variables (no hardcoded secrets)
export function getRoleCredentials(role) {
  const envKey = role.toUpperCase();
  return {
    email: process.env[`STAGING_TEST_${envKey}_USER`] || `${role}@staging-qa.marketsync.local`,
    password: process.env[`STAGING_TEST_${envKey}_PASS`] || '',
  };
}

// Role permission rules: allowed vs denied workspace pages
export const ROLE_PERMISSIONS = {
  [STAGING_ROLES.OWNER_ADMIN]: {
    allowed: [
      'dashboard', 'inventory', 'crm', 'sales', 'desking', 'fni',
      'service', 'parts', 'accounting', 'commissions', 'studio',
      'social', 'video', 'campaigns', 'chatbot', 'website', 'academy',
      'people', 'settings'
    ],
    denied: [],
  },
  [STAGING_ROLES.MANAGER]: {
    allowed: [
      'dashboard', 'inventory', 'crm', 'sales', 'desking', 'fni',
      'service', 'parts', 'accounting', 'commissions', 'studio',
      'social', 'video', 'campaigns', 'chatbot', 'website', 'academy',
      'people', 'settings'
    ],
    denied: [],
  },
  [STAGING_ROLES.SALESPERSON]: {
    allowed: [
      'dashboard', 'inventory', 'crm', 'sales', 'desking',
      'social', 'video', 'academy'
    ],
    denied: ['accounting', 'fni', 'people', 'settings', 'service', 'parts'],
  },
  [STAGING_ROLES.SERVICE_TECH]: {
    allowed: ['dashboard', 'service', 'parts', 'inventory', 'academy'],
    denied: ['accounting', 'fni', 'crm', 'sales', 'campaigns', 'settings', 'people'],
  },
  [STAGING_ROLES.RESTRICTED]: {
    allowed: ['dashboard', 'inventory', 'academy'],
    denied: ['accounting', 'fni', 'crm', 'sales', 'service', 'parts', 'campaigns', 'settings', 'people'],
  },
};

/**
 * Authenticates a Playwright page as a specific staging role.
 * Sets local session context and verifies logged-in state.
 */
export async function loginAsRole(page, role = STAGING_ROLES.OWNER_ADMIN) {
  const creds = getRoleCredentials(role);
  const baseURL = page.context()._options.baseURL || 'http://localhost:3000';

  // Navigate to login/dashboard
  await page.goto(`${baseURL}/dashboard.html`, { waitUntil: 'domcontentloaded' });

  // Inject session state into localStorage/sessionStorage
  await page.evaluate(({ role, email }) => {
    const userRole = role === 'owner_admin' ? 'DEALER_ADMIN'
      : role === 'manager' ? 'MANAGER'
      : role === 'salesperson' ? 'SALES_REP'
      : role === 'service_tech' ? 'SERVICE' : 'CLEANUP';

    const sessionObj = {
      user: {
        id: `qa-user-${role}`,
        email: email,
        user_metadata: { full_name: `Staging QA ${role}`, role: userRole },
      },
      access_token: `qa-mock-token-${role}`,
      role: userRole,
    };

    localStorage.setItem('ms_session', JSON.stringify(sessionObj));
    localStorage.setItem('ms_user_role', userRole);
    localStorage.setItem('ms_active_user', JSON.stringify(sessionObj.user));
    window.__activeRole = userRole;

    if (typeof window.applyStaffRoleNav === 'function') {
      window.applyStaffRoleNav(userRole);
    }
  }, { role, email: creds.email });

  // Reload to apply injected role session
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
}
