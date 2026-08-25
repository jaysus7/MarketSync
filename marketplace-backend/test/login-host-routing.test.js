import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const login = readFileSync(new URL('../../marketplace-frontend/login.html', import.meta.url), 'utf8')

test('raw local login previews redirect to the secure production login', () => {
  assert.match(login, /location\.protocol === 'file:'/)
  assert.match(login, /location\.replace\('https:\/\/marketsync\.link\/login\.html'\)/)
})

test('staging login authenticates against staging while production uses production', () => {
  assert.match(login, /location\.hostname\.includes\('staging'\)/)
  assert.match(login, /https:\/\/marketsync-staging-backend\.onrender\.com/)
  assert.match(login, /https:\/\/vehicle-marketplace-s0e4\.onrender\.com/)
})
