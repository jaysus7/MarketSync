/**
 * Staging QA Authentication & Role Permission Helper.
 *
 * Performs REAL backend authentication against dedicated staging QA accounts, so the
 * suite proves server-side authorization — not just client-side navigation. There is
 * deliberately no mock-token fallback: if credentials or the API base are missing, the
 * helper throws and the suite fails loudly rather than pretending to be signed in.
 */

export const STAGING_ROLES = {
  OWNER_ADMIN: 'owner_admin',
  MANAGER: 'manager',
  SALESPERSON: 'salesperson',
  SERVICE_TECH: 'service_tech',
  RESTRICTED: 'restricted',
};

// Credentials come strictly from environment secrets — never hardcoded.
export function getRoleCredentials(role) {
  const envKey = role.toUpperCase();
  return {
    email: process.env[`STAGING_TEST_${envKey}_USER`] || '',
    password: process.env[`STAGING_TEST_${envKey}_PASS`] || '',
  };
}

// Backend API base for authentication. Falls back to the site origin (same-origin API).
export function apiBase() {
  const base = process.env.STAGING_API_URL || process.env.STAGING_URL || process.env.BASE_URL;
  if (!base) {
    throw new Error(
      'Staging QA is not configured: set STAGING_API_URL (or STAGING_URL) to the deployed staging backend. Refusing to run against localhost by default.'
    );
  }
  return base.replace(/\/$/, '');
}

// Role → workspace permission matrix (allowed vs denied). Drives the RBAC spec.
export const ROLE_PERMISSIONS = {
  [STAGING_ROLES.OWNER_ADMIN]: {
    allowed: ['dashboard', 'inventory', 'crm', 'sales', 'desking', 'fni', 'service', 'parts', 'accounting', 'commissions', 'studio', 'social', 'video', 'campaigns', 'chatbot', 'website', 'academy', 'people', 'settings'],
    denied: [],
  },
  [STAGING_ROLES.MANAGER]: {
    allowed: ['dashboard', 'inventory', 'crm', 'sales', 'desking', 'fni', 'service', 'parts', 'accounting', 'commissions', 'studio', 'social', 'video', 'campaigns', 'chatbot', 'website', 'academy', 'people', 'settings'],
    denied: [],
  },
  [STAGING_ROLES.SALESPERSON]: {
    allowed: ['dashboard', 'inventory', 'crm', 'sales', 'desking', 'social', 'video', 'academy'],
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
 * Authenticates against the real staging backend and returns the session object
 * ({ access_token, user, ... }) so callers can make authorized API assertions.
 */
export async function authenticate(page, role = STAGING_ROLES.OWNER_ADMIN) {
  const { email, password } = getRoleCredentials(role);
  if (!email || !password) {
    throw new Error(
      `Missing staging QA credentials for role "${role}". Set STAGING_TEST_${role.toUpperCase()}_USER and STAGING_TEST_${role.toUpperCase()}_PASS. The suite will not run with mock tokens.`
    );
  }

  const base = apiBase();
  const res = await page.request.post(`${base}/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status() === 202) {
    const body = await res.json().catch(() => ({}));
    if (body.mfa_required) {
      throw new Error(`Staging QA account "${email}" requires MFA. Provision QA accounts without MFA (or add TOTP handling to this helper).`);
    }
  }
  if (!res.ok()) {
    const body = await res.text().catch(() => '');
    throw new Error(`Staging login failed for "${email}" (HTTP ${res.status()}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Staging login for "${email}" returned no access_token.`);
  }
  return data;
}

/**
 * Authenticates and lands on the dashboard with the exact session contract the app
 * uses (see login.html storeSession()). Waits for the SPA to actually boot.
 */
export async function loginAsRole(page, role = STAGING_ROLES.OWNER_ADMIN) {
  const data = await authenticate(page, role);
  const baseURL = page.context()._options.baseURL || apiBase();

  // Seed the real session keys the dashboard reads (token/user/refresh_token).
  await page.addInitScript((d) => {
    localStorage.setItem('token', d.access_token);
    localStorage.setItem('user', JSON.stringify(d.user || {}));
    if (d.refresh_token) localStorage.setItem('refresh_token', d.refresh_token);
    localStorage.setItem('ms_remember_until', String(Date.now() + 86400000));
  }, data);

  await page.goto(`${baseURL}/dashboard.html`, { waitUntil: 'domcontentloaded' });

  // Wait for the SPA runtime instead of a blind timeout — proves it isn't stuck blank.
  await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 20000 });

  return data;
}
