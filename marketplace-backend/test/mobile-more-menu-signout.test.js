import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const dashPart5Js = fs.readFileSync(path.join(rootDir, 'marketplace-frontend', 'js', 'modules', 'dashboard-part5.js'), 'utf8');

// The mobile "More" sheet (#nav-more-menu) is the phone equivalent of the
// desktop header — the desktop header always has #logout-btn reachable, so
// the mobile sheet must always offer the same way out, on every nav path it
// can build (restricted tier, department registry, or the legacy desktop
// mirror), not just the destinations deeper into the app.
test('mobile "More" menu always offers a way to sign out', () => {
  assert.match(dashPart5Js, /function setupMobileMoreMenu/, 'defines the mobile more-menu builder');
  assert.match(dashPart5Js, /const appendMobileSignOut = \(\) => \{[\s\S]*?window\.msSignOut\(\)/, 'sign-out row calls the real sign-out function');

  const body = dashPart5Js.slice(
    dashPart5Js.indexOf('function setupMobileMoreMenu'),
    dashPart5Js.indexOf('// ── Sales Pipeline')
  );
  const upgradeCalls = (body.match(/appendMobileUpgrade\(\);/g) || []).length;
  const signOutCalls = (body.match(/appendMobileSignOut\(\);/g) || []).length;
  assert.ok(upgradeCalls >= 3, 'sanity: the three known nav paths call appendMobileUpgrade');
  assert.equal(signOutCalls, upgradeCalls, 'every nav path that offers the upgrade CTA must also offer sign out');
});
