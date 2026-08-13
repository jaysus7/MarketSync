import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Guards the P0 email-verification fix: registration must NOT auto-confirm the new
// account, login must gate on a verified email, and a resend path must exist. These
// are source-level assertions (the flows themselves need Supabase), so they stop a
// future edit from silently re-introducing the auto-confirm bypass.
const authPath = new URL('../routes/auth.js', import.meta.url)

test('registration does NOT auto-confirm the new account', async () => {
  const src = await readFile(authPath, 'utf8')
  // The exact bypass we removed: confirming the just-created user id at signup.
  assert.doesNotMatch(
    src,
    /updateUserById\(\s*createdUserId\s*,\s*\{\s*email_confirm:\s*true/,
    'registration must not call updateUserById(createdUserId, { email_confirm: true })'
  )
})

test('login is gated on a verified email', async () => {
  const src = await readFile(authPath, 'utf8')
  assert.match(src, /email_confirmed_at/, 'login must check email_confirmed_at')
  assert.match(src, /EMAIL_NOT_VERIFIED/, 'login must reject unverified emails with EMAIL_NOT_VERIFIED')
})

test('a verification-resend endpoint exists', async () => {
  const src = await readFile(authPath, 'utf8')
  assert.match(src, /\/auth\/resend-verification/, 'resend-verification endpoint must exist')
})
