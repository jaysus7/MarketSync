import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const MIGRATIONS_DIR = new URL('../../supabase/migrations/', import.meta.url)
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
const read = (file) => readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8')

// Slice out a CREATE TABLE body and return its column names. Splits on
// depth-zero commas rather than on newlines, because half these files put one
// column per line and half pack several onto one.
function columnsOf(sql, table) {
  const start = sql.search(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`, 'i'))
  if (start < 0) return null
  const open = sql.indexOf('(', start)
  let depth = 1, i = open + 1
  for (; i < sql.length && depth > 0; i++) {
    if (sql[i] === '(') depth++
    else if (sql[i] === ')') depth--
  }
  const body = sql.slice(open + 1, i - 1)

  const parts = []
  let buf = '', d = 0
  for (const ch of body) {
    if (ch === '(') d++
    else if (ch === ')') d--
    if (ch === ',' && d === 0) { parts.push(buf); buf = '' } else buf += ch
  }
  parts.push(buf)

  return new Set(
    parts
      .map((p) => p.trim().split(/\s+/)[0].toLowerCase())
      .filter((tok) => /^[a-z_][a-z_0-9]*$/.test(tok))
      .filter((tok) => !['constraint', 'primary', 'unique', 'check', 'foreign', 'exclude'].includes(tok))
  )
}

function duplicateDeclarations() {
  const byTable = new Map()
  for (const file of files) {
    const re = /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?([a-z_0-9]+)/gi
    let m
    while ((m = re.exec(read(file)))) {
      const t = m[1].toLowerCase()
      if (!byTable.has(t)) byTable.set(t, [])
      if (!byTable.get(t).includes(file)) byTable.get(t).push(file)
    }
  }
  return [...byTable.entries()].filter(([, inFiles]) => inFiles.length > 1)
}

// Duplicates that are known, reviewed, and harmless. A duplicate is only safe
// when nothing depends on the columns the silently-no-opped CREATE would have
// added. Adding an entry here requires checking that yourself.
const REVIEWED_BENIGN_DUPLICATES = {
  discoverability_validation_jobs:
    'The later declaration adds recommendation_id and attempts, which the live ' +
    'table does not have. Nothing reads them: discoverabilityAutopilotService ' +
    'createValidationJob() writes recommendationId into expected_state JSON ' +
    'instead, and never writes attempts. No later statement in that file ' +
    'references either column, so nothing aborts.',
}

// The defect this pins. hq_expense_categories was declared twice with
// incompatible column sets, both as CREATE TABLE IF NOT EXISTS. The second
// create silently no-opped, and the very next statement --
// hq_vendor_expenses.category_key REFERENCES hq_expense_categories(key) --
// then bound against a table with no `key` column at all. Postgres raised
// "there is no unique constraint matching given keys", which aborted the whole
// command-centre migration and every migration behind it. That is why all 43
// tables owned by the six HQ migrations were missing from staging AND
// production until 2026-09-06.
test('a duplicated table declaration is never depended on by a later statement in the same file', () => {
  for (const [table, inFiles] of duplicateDeclarations()) {
    const shapes = inFiles.map((f) => ({ file: f, cols: columnsOf(read(f), table) })).filter((s) => s.cols)
    const [first, ...rest] = shapes

    for (const later of rest) {
      // Columns the later declaration wants that the first (winning) one lacks.
      const wouldBeMissing = [...later.cols].filter((c) => !first.cols.has(c))
      if (!wouldBeMissing.length) continue

      // Does anything after that CREATE reference one of them? A foreign key,
      // an index, or a seed against a column that does not exist is the thing
      // that turns a silent no-op into an aborted migration.
      const sql = read(later.file)
      const after = sql.slice(sql.search(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`, 'i')))
      const dependedOn = wouldBeMissing.filter((col) => {
        const fk = new RegExp(`references\\s+(?:public\\.)?${table}\\s*\\(\\s*${col}\\s*\\)`, 'i')
        const idx = new RegExp(`index[^;]*on\\s+(?:public\\.)?${table}\\s*\\([^)]*\\b${col}\\b`, 'i')
        const seed = new RegExp(`insert\\s+into\\s+(?:public\\.)?${table}\\s*\\([^)]*\\b${col}\\b`, 'i')
        return fk.test(after) || idx.test(after) || seed.test(after)
      })

      assert.deepEqual(
        dependedOn, [],
        `${table} is declared in both ${first.file} and ${later.file} with different columns. ` +
        `CREATE TABLE IF NOT EXISTS makes the second a silent no-op, yet ${later.file} then ` +
        `depends on [${dependedOn.join(', ')}], which the winning declaration does not have. ` +
        `That aborts the migration and every migration behind it.`
      )
    }
  }
})

test('every duplicated table declaration has been reviewed', () => {
  const duplicates = duplicateDeclarations()
    .filter(([table]) => {
      const shapes = duplicateDeclarations().find(([t]) => t === table)[1]
        .map((f) => columnsOf(read(f), table)).filter(Boolean)
      // Identical shapes are fine and need no review entry.
      return shapes.some((s) => [...shapes[0]].some((c) => !s.has(c)) || [...s].some((c) => !shapes[0].has(c)))
    })
    .map(([table]) => table)

  for (const table of duplicates) {
    assert.ok(
      REVIEWED_BENIGN_DUPLICATES[table],
      `${table} is declared more than once with different columns and is not in ` +
      `REVIEWED_BENIGN_DUPLICATES. Either merge the declarations into one superset ` +
      `(as hq_expense_categories now is), or add an entry saying why the drift is harmless.`
    )
  }

  // hq_expense_categories was the one that broke HQ. It must stay merged, not
  // become an allow-list entry.
  assert.equal(
    REVIEWED_BENIGN_DUPLICATES.hq_expense_categories, undefined,
    'hq_expense_categories must be fixed by merging the declarations, never allow-listed'
  )
  assert.ok(
    !duplicates.includes('hq_expense_categories'),
    'hq_expense_categories declarations have diverged again'
  )
})

test('hq_expense_categories declares what its consumers require, in every file', () => {
  // The live /saas/accounting routes select key/label/monthly_budget, and
  // hq_vendor_expenses.category_key is a foreign key onto (key).
  const declaring = files.filter((f) =>
    /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?hq_expense_categories/i.test(read(f)))
  assert.ok(declaring.length >= 1, 'hq_expense_categories should be declared somewhere')

  for (const file of declaring) {
    const cols = columnsOf(read(file), 'hq_expense_categories')
    for (const column of ['key', 'label', 'monthly_budget']) {
      assert.ok(cols.has(column), `${file} must declare hq_expense_categories.${column}`)
    }
  }
})

test('the foreign key onto hq_expense_categories(key) has a unique index to bind to', () => {
  // Postgres requires a unique constraint on a referenced column. `key text not
  // null unique` supplies it inline; the command-centre file also creates the
  // index explicitly so the FK still binds when another file created the table.
  const commandCentre = files.find((f) => f.includes('hq_command_center_tables'))
  assert.ok(commandCentre, 'the command centre migration should exist')
  const sql = read(commandCentre)
  assert.match(sql, /references\s+public\.hq_expense_categories\s*\(\s*key\s*\)/i)
  assert.match(sql, /create\s+unique\s+index\s+if\s+not\s+exists\s+hq_expense_categories_key_uniq/i)
})
