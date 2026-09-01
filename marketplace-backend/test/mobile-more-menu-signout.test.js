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
  const revealCalls = (body.match(/menu\.classList\.remove\('hidden'\);/g) || []).length;

  assert.ok(upgradeCalls >= 3, 'sanity: the three known nav paths call appendMobileUpgrade');
  assert.ok(revealCalls >= 3, 'sanity: the builder has several paths that reveal the menu');

  // The guarantee is about the way OUT, so it is anchored to every path that actually
  // shows the sheet - not to the upgrade CTA, which a suite tenant deliberately never
  // sees. Comparing against upgrade with equality got this backwards: it made a path
  // that offers sign-out WITHOUT an upgrade CTA look like a defect, and it would have
  // missed a new reveal path that forgot sign-out whenever upgrade grew alongside it.
  assert.equal(signOutCalls, revealCalls, 'every path that reveals the More sheet must append sign out');
  assert.ok(signOutCalls >= upgradeCalls, 'every nav path that offers the upgrade CTA must also offer sign out');
});
