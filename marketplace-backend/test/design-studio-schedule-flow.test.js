import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Design Studio Schedule Flow & Full Social Calendar Suite', () => {
  const schedulerPath = path.join(__dirname, '../../marketplace-frontend/js/modules/studio/studio-scheduler.js');
  const shellPath = path.join(__dirname, '../../marketplace-frontend/js/modules/studio/studio-shell.js');
  const schedulerCode = fs.readFileSync(schedulerPath, 'utf8');
  const shellCode = fs.readFileSync(shellPath, 'utf8');

  // Schedule used to force Design Studio's full-screen shell open and overlay the
  // scheduler on top of it (ensureStudioWorkspaceActive/openStudioScheduler) — closing
  // the scheduler left the user stranded back inside Studio instead of on a dashboard
  // page. Schedule is now its own standalone destination: Studio's Schedule button and
  // post-render handoff both close Studio first, then route via switchPage.
  it('Schedule closes Design Studio and hands off to the standalone Social Scheduler page, never nesting inside Studio', () => {
    assert.ok(!schedulerCode.includes('function ensureStudioWorkspaceActive'), 'No longer forces Studio open to show Schedule');
    assert.ok(!schedulerCode.includes('function openStudioScheduler('), 'No longer overlays Schedule inside the Studio modal');
    assert.ok(shellCode.includes("switchPage('social-scheduler')"), 'Schedule button routes to the standalone page via the real router');
    assert.ok(schedulerCode.includes("switchPage('social-scheduler')"), 'Post-render handoff routes to the standalone page via the real router');
    assert.match(shellCode, /closeMarketSyncStudio\(\);\s*\n\s*}\s*\n\s*if \(typeof switchPage === 'function'\) switchPage\('social-scheduler'\)/, 'Closes Studio before navigating to Schedule');
  });

  it('renders Month, Week, and List views for the social calendar', () => {
    assert.ok(schedulerCode.includes('function renderStudioSchedulerCalendar()'), 'Defines Month Calendar renderer');
    assert.ok(schedulerCode.includes('function renderStudioSchedulerWeek()'), 'Defines Week Calendar renderer');
    assert.ok(schedulerCode.includes('function renderStudioSchedulerList()'), 'Defines List view renderer');
  });

  it('displays real post thumbnails, platform badges, times, and status pills on calendar dates', () => {
    assert.ok(schedulerCode.includes('thumb ? `<img src="${esc(thumb)}"'), 'Renders artwork design thumbnail');
    assert.ok(schedulerCode.includes('timeStr'), 'Displays scheduled time formatted');
    assert.ok(schedulerCode.includes('badgeCls'), 'Applies status pill styling');
  });

  it('supports drag-and-drop rescheduling across calendar day cells', () => {
    assert.ok(schedulerCode.includes('function studioCalendarDrag(e, postId)'), 'Defines drag start handler');
    assert.ok(schedulerCode.includes('async function studioCalendarDrop(e, targetDateStr)'), 'Defines drop reschedule handler');
    assert.ok(schedulerCode.includes("apiSendJson(`/social/posts/${postId}`, 'PUT'"), 'Updates scheduled_local on drop');
  });

  it('provides Day Detail view with "+ Schedule Post on this Date"', () => {
    assert.ok(schedulerCode.includes('function studioSchedulerOpenDay(dateStr)'), 'Defines Day Detail opener');
    assert.ok(schedulerCode.includes('+ Schedule Post on this Date'), 'Includes quick date scheduler button');
  });

  it('includes Edit Design action that opens the exact artwork in full-screen Design Studio canvas', () => {
    assert.ok(schedulerCode.includes('function studioSchedulerOpenDesignEditor(designId, assetUrl)'), 'Defines Design Studio editor launcher');
    assert.ok(schedulerCode.includes('window.openMarketSyncStudio(designId || null, { assetUrl })'), 'Loads design into active canvas');
  });

  it('provides independent multi-platform caption tabs and AI caption copywriting tools', () => {
    assert.ok(schedulerCode.includes('function studioSchedulerAiCaption(type)'), 'Defines AI caption tools');
    assert.ok(schedulerCode.includes('rewrite'), 'Supports AI Rewrite');
    assert.ok(schedulerCode.includes('hashtags'), 'Supports hashtag generation');
    assert.ok(schedulerCode.includes('function studioSchedulerSelectCaptionTab(tab)'), 'Supports platform-specific caption tabs');
  });

  it('retains published posts in calendar history and highlights failed publishing with retry action', () => {
    assert.ok(schedulerCode.includes("p.status === 'published'"), 'Checks published status');
    assert.ok(schedulerCode.includes("p.status === 'failed'"), 'Checks failed status');
    assert.ok(schedulerCode.includes('Retry Now'), 'Provides retry button for failed posts');
  });

  // The "Open Social Calendar in Design Studio" handoff button used to send the user
  // from the standalone Scheduler's Accounts tab back into the nested-in-Studio
  // overlay — exactly the pattern this suite now forbids. Account connection
  // management is self-contained on this tab; there is nothing to hand off to.
  it('Settings social connections card keeps connection configuration separate from scheduling', () => {
    assert.ok(schedulerCode.includes('async function studioSocialConnectionsRender()'), 'Defines settings connection renderer');
    assert.ok(!schedulerCode.includes('Open Social Calendar in Design Studio'), 'No handoff back into a nested Studio overlay');
  });

  it('Design Studio toolbar header includes Schedule button wired to the entitlement-checked handoff', () => {
    assert.ok(shellCode.includes('openStudioSchedulerWithEntitlementCheck()'), 'Toolbar schedule button calls openStudioSchedulerWithEntitlementCheck');
  });
});
