import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Header Live Clock & Shift Attendance Layout Stability', () => {
  const htmlPath = path.join(__dirname, '../../marketplace-frontend/dashboard.html');
  const part2Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part2.js');
  const part25Path = path.join(__dirname, '../../marketplace-frontend/js/modules/dashboard-part25.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const part2Content = fs.readFileSync(part2Path, 'utf8');
  const part25Content = fs.readFileSync(part25Path, 'utf8');

  it('contains fixed-width and tabular numbers styling for live clock in dashboard.html', () => {
    assert.ok(htmlContent.includes('.clock-display'), 'Defines .clock-display class');
    assert.ok(htmlContent.includes('font-variant-numeric: tabular-nums'), 'Applies tabular-nums font variant');
    assert.ok(htmlContent.includes('font-feature-settings: "tnum"'), 'Applies tnum font feature');
    assert.ok(htmlContent.includes('min-width: 11.5ch') || htmlContent.includes('min-width: 11ch'), 'Specifies minimum width for clock container');
  });

  it('structures the live clock into predictable sub-elements (time and AM/PM period)', () => {
    assert.ok(htmlContent.includes('id="header-clock-time"'), 'Contains header-clock-time element');
    assert.ok(htmlContent.includes('id="header-clock-period"'), 'Contains header-clock-period element');
    assert.ok(htmlContent.includes('id="header-clock-display"'), 'Contains header-clock-display wrapper');
  });

  it('explicitly disables transition and animation on live clock text', () => {
    assert.ok(htmlContent.includes('transition: none !important'), 'Disables transition on clock display');
    assert.ok(htmlContent.includes('animation: none !important'), 'Disables animation on clock display');
  });

  it('uses a single canonical interval and clears prior timer in dashboard-part2.js', () => {
    assert.ok(part2Content.includes('let __headerClockInterval = null;'), 'Defines __headerClockInterval variable');
    assert.ok(part2Content.includes('if (__headerClockInterval) clearInterval(__headerClockInterval);'), 'Clears existing interval');
    assert.ok(part2Content.includes('__headerClockInterval = setInterval(updateClocks, 1000);'), 'Sets single interval');
  });

  it('updates textContent directly without rebuilding header DOM on each tick', () => {
    assert.ok(part2Content.includes('timeEl.textContent = formattedTime') || part2Content.includes('timeEl.textContent = fullTime'), 'Updates timeEl.textContent');
    assert.ok(!part2Content.includes('timeEl.innerHTML ='), 'Does not use innerHTML on timeEl');
    assert.ok(!part25Content.includes('timerDisplay.innerHTML ='), 'part25 does not use innerHTML on timerDisplay');
  });
});
