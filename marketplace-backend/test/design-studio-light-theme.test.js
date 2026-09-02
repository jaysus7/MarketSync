import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../../marketplace-frontend/css/marketsync-theme.css', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../../marketplace-frontend/js/modules/dashboard-part2.js', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8');

test('light mode keeps Studio layers and the canvas on light system surfaces', () => {
  assert.match(theme, /#ms-studio-master-modal #studio-tool-panel button\[class\*="bg-slate-800"\] \{ background: #e8eef6 !important; color: #172033 !important;/);
  assert.match(theme, /\[data-studio-region="canvas"\][\s\S]*background: #f7f8fa !important;/);
});

test('the tool rail changes only the active icon colour', () => {
  assert.match(shell, /data-studio-tool="templates"/);
  assert.match(shell, /button\.setAttribute\('aria-current', button\.dataset\.studioTool === tool \? 'page' : 'false'\)/);
  assert.match(theme, /\.studio-tool-rail-button\[aria-current="page"\] \.studio-tool-icon \{ color: #2563eb !important; \}/);
  assert.match(theme, /\.studio-tool-rail-button\[aria-current="page"\] \{ background: transparent !important;/);
  assert.doesNotMatch(theme, /\[data-studio-region="rail"\] button\[class\*="bg-indigo-600"\]/);
});

test('Templates fits the rail and the Heading action remains legible', () => {
  assert.match(theme, /\.studio-tool-rail-button[\s\S]*width: 82px;[\s\S]*font-size: 11px;/);
  assert.match(shell, /studioAddText\('heading'\)[^>]+text-white text-xs font-black/);
});

test('the deployed dashboard requests the corrected Studio assets', () => {
  assert.match(loader, /studio-shell\.js\?v=20260902_staging_repair_v1/g);
  assert.match(dashboard, /marketsync-theme\.css\?v=20260902_staging_repair_v1/);
  assert.match(dashboard, /dashboard-part2\.js\?v=20260902_staging_repair_v1/);
});
