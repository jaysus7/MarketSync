import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COURSES, COURSE_KEYS } from '../academy-curriculum.js'
import { LESSONS, LESSON_COURSE_KEYS, LESSON_COUNT } from '../academy-lessons.js'

// The Academy had 32 courses and no content.
//
// Every one had content_url NULL and there was no lesson table, so somebody could be
// assigned "Credit applications and privacy law", be blocked from a certification until
// they completed it, and have nothing at all to open. A course page listing "lessons in
// order" on top of that would be the purest form of the defect A19 names — a screen
// describing something that does not exist.

const BE = new URL('../', import.meta.url)
const FE = new URL('../../marketplace-frontend/', import.meta.url)
const read = (u, rel) => readFileSync(new URL(rel, u), 'utf8')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const routes = strip(read(BE, 'routes/academy.js'))
const sync = strip(read(BE, 'scripts/academy-sync.mjs'))
const migration = read(BE, 'migrations/2026-08-11-academy-lessons.sql').replace(/^\s*--.*$/gm, '')
const site = read(FE, 'academy.html')
const part2 = strip(read(FE, 'js/modules/dashboard-part2.js'))

test('every course has lessons — a course nobody can take is the whole defect', () => {
  const missing = COURSES.map(c => c.course_key).filter(k => !LESSON_COURSE_KEYS.has(k))
  assert.deepEqual(missing, [], 'these courses can be assigned and cannot be opened')
  const orphan = [...LESSON_COURSE_KEYS].filter(k => !COURSE_KEYS.has(k))
  assert.deepEqual(orphan, [], 'lessons written for a course that does not exist')
  assert.ok(LESSON_COUNT >= COURSES.length * 3, `expected real depth, got ${LESSON_COUNT} lessons`)
})

test('reading is not doing — every course ends somewhere you use the product', () => {
  const noCheckpoint = Object.entries(LESSONS)
    .filter(([, ls]) => !ls.some(x => x.kind === 'checkpoint')).map(([k]) => k)
  assert.deepEqual(noCheckpoint, [], 'a course of pure reading certifies nobody')
  // And a lesson always has something in it.
  for (const [key, lessons] of Object.entries(LESSONS)) {
    lessons.forEach(x => {
      assert.ok(x.title && x.title.length > 3, `${key}/${x.lesson_key} needs a title`)
      assert.ok(x.body && x.body.length > 120, `${key}/${x.lesson_key} has no real body`)
      assert.ok(x.estimated_minutes > 0, `${key}/${x.lesson_key} needs a duration`)
    })
  }
})

test('the sync refuses to publish a course nobody can take', () => {
  assert.match(sync, /have no lessons and cannot be completed/)
  assert.match(sync, /lessons written for course\(s\) that do not exist/)
  assert.match(sync, /has no checkpoint/)
  // And it proves the lessons landed rather than trusting the write returned.
  assert.match(sync, /if \(lessonCount < LESSON_COUNT\) fail/)
  // Retiring content must never destroy somebody's completion history.
  assert.match(sync, /\.update\(\{ active: false \}\)\.in\('id', stale\.map/)
})

test('progress is per lesson, and a lesson is read or it is not', () => {
  assert.match(migration, /create table if not exists public\.staff_training_lessons/)
  assert.match(migration, /create table if not exists public\.staff_training_lesson_progress/)
  // Completing the same lesson twice is the same fact.
  assert.match(migration, /staff_training_lesson_progress_uniq[\s\S]*?\(staff_member_id, lesson_id\)/)
  // Tenant isolation the way the rest of the schema does it.
  assert.match(migration, /foreign key \(staff_member_id, dealership_id\)\s*references public\.staff_members \(id, dealership_id\)/)
})

test('you may only ever record your own completion', () => {
  // Marking a colleague's training complete is how a compliance record stops meaning
  // anything, so RLS forbids it rather than the UI hiding the button.
  assert.match(migration, /staff_training_lesson_progress_insert_self/)
  assert.match(migration, /for insert to authenticated[\s\S]*?user_id = auth\.uid\(\)/)
  assert.match(migration, /force row level security/)
})

test('completing a lesson rolls up, rather than being declared', () => {
  assert.match(routes, /app\.post\('\/academy\/lessons\/:id\/complete'/)
  // Recount from the records rather than incrementing a stored number.
  assert.match(routes, /const percent = total \? Math\.round\(\(done \/ total\) \* 100\) : 0/)
  assert.match(routes, /const finished = total > 0 && done >= total/)
  assert.match(routes, /patch\.status = 'completed'/)
  // The lesson is recorded even if the assignment roll-up fails — and that is reported.
  assert.match(routes, /Your progress was saved but the assignment could not be updated/)
  // A dealership's lesson belongs to that dealership; a global one is everybody's.
  assert.match(routes, /if \(lesson\.dealership_id && lesson\.dealership_id !== req\.dealershipId\)/)
})

test('the catalogue is browsable, gated and honest about empty courses', () => {
  assert.match(routes, /app\.get\('\/academy\/catalog'/)
  assert.match(routes, /mine: courseAppliesTo\(c, \{ role, curricula \}\)/,
    'what is THEIRS must be distinguished from what merely exists')
  assert.match(routes, /takeable: stats\.count > 0/,
    'a course with no lessons must be marked, not silently opened')
  // Percent comes from lessons actually completed, never from a stored figure that
  // could disagree with them.
  assert.match(routes, /percent: stats\.count \? Math\.round\(\(Math\.min\(done, stats\.count\) \/ stats\.count\) \* 100\) : 0/)
  assert.match(routes, /app\.get\('\/academy\/courses\/:key'/)
  assert.match(routes, /next_lesson_id: rows\.find\(x => !x\.completed\)\?\.id \|\| null/)
})

test('the Academy is its own site, and every entry point goes there', () => {
  assert.match(part2, /if \(pageId === 'academy'\) \{ location\.href = '\/academy\.html'; return; \}/,
    'one redirect, so no entry point has to remember')
  assert.match(site, /<title>MarketSync Academy<\/title>/)
  assert.match(site, /academy\/catalog/)
  assert.match(site, /academy\/courses\//)
  assert.match(site, /academy\/lessons\//)
  // It is not a public page.
  assert.match(site, /name="robots" content="noindex"/)
  assert.match(site, /You are not signed in/)
})

test('the site organises by department and level, in learning order', () => {
  assert.match(site, /const order = \['required', 'foundation', 'advanced', 'reference'\]/,
    'Required first — that is the order somebody should take them in')
  assert.match(site, /Departments/)
  assert.match(site, /VIEW\.dept === 'mine'/)
  // Lessons are numbered and in order, with completion visible.
  assert.match(site, /lessons\.map\(\(l, i\) =>/)
  assert.match(site, /l\.completed/)
})

test('the site never fakes progress or content', () => {
  // Completion is the server's answer, not an optimistic tick.
  assert.match(site, /async function acComplete/)
  assert.match(site, /if \(msg\) msg\.textContent = e\.message/,
    'a failed write must leave the lesson unfinished on screen')
  // A course with no lessons says so instead of opening an empty reader.
  assert.match(site, /This course has no lessons yet/)
  // Somebody with no employment record is told their progress will not be saved.
  assert.match(site, /Your progress will not be saved/)
})
