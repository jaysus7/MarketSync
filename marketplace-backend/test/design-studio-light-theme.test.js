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
  assert.match(loader, /studio-shell\.js\?v=20260905_obj_diag_v1/g);
  assert.match(dashboard, /marketsync-theme\.css\?v=20260905_obj_diag_v1/);
  // dashboard-part2.js was rebumped for the HQ IA freeze (Phase 1 finalization).
  assert.match(dashboard, /dashboard-part2\.js\?v=20260905_hq_ia_freeze_v1/);
});

test('dark mode gives Studio drawers, cards, icons, and canvas explicit contrast', () => {
  assert.match(theme, /\.dark #ms-studio-master-modal \{ background: #07101f !important; color: #e7eef8 !important;/);
  assert.match(theme, /\.dark #ms-studio-master-modal \.studio-template-card,[\s\S]*background: #111d32 !important; color: #e7eef8 !important;/);
  assert.match(theme, /\.dark #ms-studio-master-modal \.studio-tool-rail-button\[aria-current="page"\] \.studio-tool-icon \{ color: #60a5fa !important;/);
  assert.match(theme, /\.dark #ms-studio-master-modal \[data-studio-region="canvas"\][\s\S]*radial-gradient\(#263a58/);
});

test('phone Studio has one header, compact controls, and tool drawers that open from the dock', () => {
  assert.match(theme, /\[role="tablist"\]\[aria-label="Design Studio"\] \{ display: none !important; \}/);
  assert.match(theme, /\.studio-primary-actions \.studio-desktop-action \{ display: none !important; \}/);
  assert.match(theme, /> footer \.studio-footer-text-control \{ display: none !important; \}/);
  assert.match(shell, /if \(studioIsMobile\(\)\) openStudioMobilePanel\('tool'\)/);
  assert.match(shell, /class="studio-mobile-scrim" onclick="closeStudioMobilePanels\(\)"/);
});
