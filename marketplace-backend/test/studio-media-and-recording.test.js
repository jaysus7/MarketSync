import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/strip-comments.js'

const shell = stripComments(readFileSync(new URL('../../marketplace-frontend/js/modules/studio/studio-shell.js', import.meta.url), 'utf8'))
const video = stripComments(readFileSync(new URL('../../marketplace-frontend/js/modules/video-studio.js', import.meta.url), 'utf8'))
const routes = readFileSync(new URL('../routes/marketing-studio.js', import.meta.url), 'utf8')

test('an upload refreshes the library even from a panel that does not show it', () => {
  // loadStudioMediaLibrary used to return early when #studio-media-library was
  // absent — which it is on the Uploads panel, the panel you upload FROM. So the
  // fetch never ran and the library still held its pre-upload list.
  const fn = shell.match(/async function loadStudioMediaLibrary\(\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the loader must exist')
  const fetchAt = fn.indexOf("apiGetJson('/marketing/assets')")
  const guardAt = fn.indexOf('if (!target) return')
  assert.ok(fetchAt > -1, 'it must fetch')
  assert.ok(guardAt === -1 || guardAt > fetchAt, 'it must never bail out before fetching')
  assert.match(fn, /if \(target\) filterStudioMediaLibrary/, 'rendering stays conditional on the panel being mounted')
})

test('a photo uploaded from Uploads is visible there', () => {
  // The panel listed recent VIDEOS only, so a photo produced a success toast and
  // no visible change — indistinguishable from a failed upload.
  assert.match(shell, /function renderStudioUploadedPhotos/)
  assert.match(shell, /id="studio-uploaded-photos"/, 'the panel needs somewhere to show them')
  assert.match(shell, /Recent photo uploads/)
  assert.match(shell, /asset\.kind !== 'video'/, 'photos, not videos')
  assert.match(shell, /if \(tool === 'uploads'\) setTimeout\(\(\) => \{ loadStudioUploadedVideos\(\); loadStudioMediaLibrary\(\); \}/,
    'opening Uploads must load photos as well as videos')
})

test('the background upload reads the field the route actually returns', () => {
  // POST /marketing/assets replies { ok: true, asset }, and the URL is public_url.
  assert.match(routes, /res\.json\(\{ ok: true, asset: data \}\)/)
  const fn = shell.match(/async function studioUploadBackgroundImage\(input\)[\s\S]*?\n\}/)?.[0] || ''
  assert.ok(fn, 'the background upload must exist')
  assert.match(fn, /data\.asset\?\.public_url/, 'public_url is the field that exists')
  assert.ok(!/data\.asset\?\.file_url/.test(fn), 'file_url is not a field this route returns')
})

test('a Studio recording saves itself to the Studio library', () => {
  // It used to sit in memory until a SHARE action uploaded it to /sales-videos as
  // a CUSTOMER video — so from the Studio it saved nowhere and never showed up in
  // the media library.
  assert.match(video, /async function vidSaveRecordingToStudioLibrary/)
  assert.match(video, /\$\{API\}\/marketing\/assets\/video/,
    'it must go to the marketing library, not /sales-videos')
  assert.match(video, /if \(options\.studioMode\) vidSaveRecordingToStudioLibrary\(\);/,
    'a studio recording must save as soon as it exists')
  assert.match(video, /else vidAutoPrepareShareLink\(\);/,
    'a customer recording must keep its existing share flow')
  assert.match(video, /if \(state\.studioLibraryAsset\) return state\.studioLibraryAsset;/,
    'saving twice must not upload twice')
  // And the route it posts to has to exist.
  assert.match(routes, /app\.post\('\/marketing\/assets\/video'/)
})

test('a recording can go straight onto the design', () => {
  const fn = video.match(/vidUseRecordingInDesign[\s\S]*?\n\};/)?.[0] || ''
  assert.ok(fn, 'the handoff must exist')
  assert.match(fn, /await vidSaveRecordingToStudioLibrary\(\)/, 'save first')
  assert.match(fn, /asset\?\.public_url \|\| asset\?\.url/, 'then read the url the route returns')
  assert.match(fn, /addLibraryVideoToCanvas/, 'then place it on the canvas')
  assert.match(fn, /vidCloseStudio\(\)/, 'and close the recorder')
  // The recorder close function is really called vidCloseStudio.
  assert.match(video, /function vidCloseStudio\(\)/)
  assert.ok(!/window\.closeCustomerVideoStudio/.test(video), 'no reference to a function that does not exist')
})
