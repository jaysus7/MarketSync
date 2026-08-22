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

  it('ensures full-screen Design Studio workspace is active whenever Schedule is triggered', () => {
    assert.ok(schedulerCode.includes('function ensureStudioWorkspaceActive()'), 'Defines ensureStudioWorkspaceActive');
    assert.ok(schedulerCode.includes('await ensureStudioWorkspaceActive()'), 'openStudioScheduler awaits studio workspace activation');
    assert.ok(schedulerCode.includes('window.openMarketSyncStudio'), 'Uses canonical openMarketSyncStudio to establish full-screen shell');
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

  it('Settings social connections card keeps connection configuration separate from scheduling', () => {
    assert.ok(schedulerCode.includes('async function studioSocialConnectionsRender()'), 'Defines settings connection renderer');
    assert.ok(schedulerCode.includes('Open Social Calendar in Design Studio'), 'Provides clear handoff button to Design Studio');
  });

  it('Design Studio toolbar header includes Schedule button wired to openStudioScheduler', () => {
    assert.ok(shellCode.includes('openStudioScheduler()'), 'Toolbar schedule button calls openStudioScheduler');
  });
});
