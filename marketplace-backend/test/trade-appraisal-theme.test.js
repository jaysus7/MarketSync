import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../../marketplace-frontend/dashboard.html', import.meta.url), 'utf8')
const css = readFileSync(new URL('../../marketplace-frontend/css/ms-liquid-glass.css', import.meta.url), 'utf8')

test('Trade Appraisal has a true light-default surface and scoped dark palette', () => {
  assert.match(css, /\.appraisal-page > \.flex\.items-center\.justify-between \{[\s\S]*?background: #ffffff;[\s\S]*?border: 1px solid #dbe3ef;/)
  assert.match(css, /\.appraisal-page > \.flex\.items-center\.justify-between h2 \{[\s\S]*?color: #0f172a;/)
  assert.match(css, /\.appraisal-page \.rounded-2xl \{[\s\S]*?background: #ffffff;[\s\S]*?border-color: #dbe3ef;/)
  assert.match(css, /\.appraisal-page \.rounded-2xl input,[\s\S]*?background: #f8fafc;[\s\S]*?color: #0f172a;/)
  assert.match(css, /\.dark \.appraisal-page \.rounded-2xl \{[\s\S]*?background: rgba\(15,23,42,\.76\)/)
  assert.doesNotMatch(css, /(?<!\.dark )\.appraisal-page \.rounded-2xl \{\s*background: rgba\(15,\s*23,\s*42/)
})

test('Trade Appraisal phone controls wrap without horizontal overflow', () => {
  const start = html.indexOf('data-page-content="appraisal"')
  const block = html.slice(start, html.indexOf('data-page-content=', start + 40))
  assert.match(block, /appraisal-workflow grid[^\"]*md:grid-cols-2[^\"]*xl:grid-cols-3/)
  assert.match(block, /class="appr-vin-row"/)
  assert.match(block, /class="appr-vin-links flex flex-wrap/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.appraisal-page \.appr-vin-row \{ grid-template-columns: minmax\(0,1fr\) minmax\(0,1fr\); \}/)
  assert.match(css, /\.appraisal-page \.appr-vin-row #appr-vin \{ grid-column: 1 \/ -1;/)
  assert.match(css, /\.appraisal-page \.appr-vin-links > button \{ flex: 1 1 calc\(50% - \.5rem\);/)
})
