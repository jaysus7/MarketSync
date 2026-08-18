// WebAuthn / Passkeys — passwordless authentication using device biometrics
// (Touch ID, Face ID, Windows Hello) or hardware security keys (YubiKey).
//
// Flow:
//   REGISTER (in dashboard, while signed in):
//     1. POST /auth/passkey/register/begin  → returns challenge
//     2. Browser prompts user (Touch ID / passkey picker)
//     3. POST /auth/passkey/register/finish → server stores credential
//
//   AUTHENTICATE (at login):
//     1. POST /auth/passkey/login/begin     → returns challenge + allowed credentials
//     2. Browser prompts user
//     3. POST /auth/passkey/login/finish    → server verifies + returns Supabase session
//
// We DO NOT replace TOTP — passkeys are an additional/parallel factor.
// Users with both: any one of (TOTP code, recovery code, passkey) gets them in.

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './shared.js'

// Relying Party config — must match the origin the browser sees
const RP_NAME = 'MarketSync'
const RP_ID = process.env.WEBAUTHN_RP_ID || 'marketsync.link'  // domain only, no protocol
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://marketsync.link'

// In-memory challenge cache (challenges expire in 5 min, so memory is fine for
// single-node deploys). Key: userId — value: { challenge, expiresAt }
const challengeCache = new Map()

function setChallenge(key, challenge) {
  challengeCache.set(key, { challenge, expiresAt: Date.now() + 5 * 60 * 1000 })
}
function takeChallenge(key) {
  const entry = challengeCache.get(key)
  challengeCache.delete(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.challenge
}
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of challengeCache) {
    if (v.expiresAt < now) challengeCache.delete(k)
  }
}, 5 * 60 * 1000).unref?.()

// ──────────────────────────────────────────────────────────────────────────────
// REGISTRATION (called while user is already signed in)
// ──────────────────────────────────────────────────────────────────────────────
export async function beginPasskeyRegistration({ user }) {
  const userId = user?.id
  const userEmail = user?.email || ''
  // Fetch any existing passkeys so we don't register the same authenticator twice
  const { data: existing } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId)

  const excludeCredentials = (existing || []).map(c => ({
    id: c.credential_id,
    transports: c.transports || undefined
  }))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: new TextEncoder().encode(userId),
    userName: userEmail,
    userDisplayName: userEmail,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: undefined  // accept platform OR cross-platform
    },
    supportedAlgorithmIDs: [-7, -257]  // ES256 + RS256, the two most-supported
  })

  setChallenge(`reg:${userId}`, options.challenge)
  return options
}

export async function finishPasskeyRegistration({ user, body }) {
  const userId = user?.id
  const { response, device_name: deviceName } = body || {}
  const expectedChallenge = takeChallenge(`reg:${userId}`)
  // The route sends whatever this throws straight back as a 400, and the browser
  // only trusts the HTTP status — so failures MUST throw, never resolve.
  if (!expectedChallenge) throw new Error('Registration challenge expired — please try again.')

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false
    })
  } catch (e) {
    throw new Error(`Verification failed: ${e.message}`)
  }
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed.')
  }

  const { credential } = verification.registrationInfo
  const { id, publicKey, counter, transports } = credential

  const { error } = await supabaseAdmin.from('webauthn_credentials').insert({
    user_id: userId,
    credential_id: id,
    public_key: Buffer.from(publicKey).toString('base64'),
    counter,
    transports: transports || null,
    device_name: deviceName || null
  })
  if (error) throw new Error(error.message)

  return { ok: true, passkey: { credential_id: id } }
}

// ──────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION (called at login, BEFORE password — passkey IS the password)
// ──────────────────────────────────────────────────────────────────────────────
export async function beginPasskeyLogin({ email }) {
  const key = (email || '').toLowerCase()
  let allowCredentials = []

  if (key) {
    // Resolve the user by email via profiles (profiles.id === the auth user id),
    // then scope the prompt to that user's registered credentials. Best-effort
    // only — if we can't resolve, we fall back to discoverable credentials.
    // finish() is the real gate: it verifies the signed assertion against the
    // stored public key and replay counter.
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id').eq('email', key).maybeSingle()
    if (profile?.id) {
      const { data: creds } = await supabaseAdmin
        .from('webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', profile.id)
      allowCredentials = (creds || []).map(c => ({
        id: c.credential_id,
        transports: c.transports || undefined
      }))
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    timeout: 60000,
    // Passwordless login: the passkey replaces the password, so REQUIRE user
    // verification (biometric / PIN) — a presence-only security key tap must not
    // authenticate on its own.
    userVerification: 'required',
    allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined
  })

  setChallenge(`auth:${key}`, { challenge: options.challenge })
  return options
}

export async function finishPasskeyLogin({ body }) {
  const { email, response } = body || {}
  const cached = takeChallenge(`auth:${(email || '').toLowerCase()}`)
  // Failures MUST throw — the route relays the message as a 400 and the browser
  // only trusts the HTTP status.
  if (!cached) throw new Error('Sign-in challenge expired — please try again.')

  const credentialId = response?.id  // base64url-encoded
  const { data: cred, error: lookupErr } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, user_id, public_key, counter, transports')
    .eq('credential_id', credentialId)
    .maybeSingle()
  if (lookupErr || !cred) throw new Error('Unknown passkey.')

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: cached.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64')),
        counter: cred.counter,
        transports: cred.transports || undefined
      },
      // Login is passwordless, so the biometric/PIN gesture is mandatory.
      requireUserVerification: true
    })
  } catch (e) {
    throw new Error(`Verification failed: ${e.message}`)
  }
  if (!verification.verified) throw new Error('Passkey verification failed.')

  // Bump the counter to prevent replay. FAIL CLOSED: if we can't persist the new
  // counter, a replayed assertion would still verify next time — so throw before
  // minting a session rather than issuing one on an un-recorded counter.
  const { error: counterErr } = await supabaseAdmin
    .from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id)
  if (counterErr) throw new Error('Could not complete sign-in — please try again.')

  // Mint a real Supabase session for the credential's OWNER — the authoritative
  // email from the account, never the client-supplied one. Server-side passwordless
  // path: admin-generate a magic-link OTP, then verify it to obtain access/refresh
  // tokens. The verified WebAuthn assertion above is the proof of identity. Verify
  // on a throwaway client with persistSession:false so we never leave a user session
  // attached to a shared client instance.
  const { data: got, error: getErr } = await supabaseAdmin.auth.admin.getUserById(cred.user_id)
  const ownerEmail = got?.user?.email
  if (getErr || !ownerEmail) throw new Error('Could not resolve the account for this passkey.')

  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: ownerEmail })
  const otp = link?.properties?.email_otp
  if (linkErr || !otp) throw new Error('Could not start the session.')

  const ephemeral = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  const { data: verified, error: otpErr } = await ephemeral.auth.verifyOtp({ type: 'email', email: ownerEmail, token: otp })
  if (otpErr || !verified?.session) throw new Error('Could not complete sign-in.')

  return {
    ok: true,
    userId: cred.user_id,
    user: { id: cred.user_id, email: ownerEmail },
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token
  }
}

// List a user's passkeys (for the management UI)
export async function listUserPasskeys({ supabaseAdmin, userId }) {
  const { data, error } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, device_name, transports, created_at, last_used_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return data || []
}

// Delete a passkey by its internal ID (must belong to the requesting user)
export async function deletePasskey({ supabaseAdmin, userId, passkeyId }) {
  const { error } = await supabaseAdmin
    .from('webauthn_credentials')
    .delete()
    .eq('id', passkeyId)
    .eq('user_id', userId)
  return !error
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP-UP (called while already signed in, to satisfy the MFA gate with a
// biometric passkey — Touch ID / Face ID / Windows Hello / fingerprint — instead
// of a TOTP code). userVerification is REQUIRED here: the whole point is that the
// device confirms the human, which is what makes a passkey MFA-grade.
// ──────────────────────────────────────────────────────────────────────────────
export async function beginPasskeyStepUp({ supabaseAdmin, userId }) {
  const { data: creds } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userId)
  const allowCredentials = (creds || []).map(c => ({
    id: c.credential_id,
    transports: c.transports || undefined
  }))
  if (!allowCredentials.length) return { ok: false, error: 'NO_PASSKEY' }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    timeout: 60000,
    userVerification: 'required',
    allowCredentials
  })
  setChallenge(`stepup:${userId}`, options.challenge)
  return { ok: true, options }
}

export async function finishPasskeyStepUp({ supabaseAdmin, userId, response }) {
  const expectedChallenge = takeChallenge(`stepup:${userId}`)
  if (!expectedChallenge) return { ok: false, error: 'Step-up challenge expired — please try again.' }

  const credentialId = response?.id
  // Scoped to THIS user (unlike login, where we don't yet know who they are) — a
  // step-up must be satisfied by the signed-in user's own passkey.
  const { data: cred, error: lookupErr } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, user_id, public_key, counter, transports')
    .eq('credential_id', credentialId)
    .eq('user_id', userId)
    .maybeSingle()
  if (lookupErr || !cred) return { ok: false, error: 'Unknown passkey.' }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64')),
        counter: cred.counter,
        transports: cred.transports || undefined
      },
      requireUserVerification: true
    })
  } catch (e) {
    return { ok: false, error: `Verification failed: ${e.message}` }
  }
  if (!verification.verified) return { ok: false, error: 'Passkey verification failed.' }

  await supabaseAdmin
    .from('webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq('id', cred.id)

  recordPasskeyStepUp(userId)
  return { ok: true }
}

// Short-lived step-up markers so requireMfa can accept a recent biometric passkey
// verification as satisfying the gate. In-memory with a TTL, matching the
// challenge cache's single-node design tradeoff above.
const STEP_UP_TTL_MS = 20 * 60 * 1000
const stepUpCache = new Map()

export function recordPasskeyStepUp(userId) {
  if (!userId) return
  stepUpCache.set(userId, Date.now() + STEP_UP_TTL_MS)
}

export function hasRecentPasskeyStepUp(userId) {
  if (!userId) return false
  const expiresAt = stepUpCache.get(userId)
  if (!expiresAt) return false
  if (expiresAt < Date.now()) { stepUpCache.delete(userId); return false }
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [k, v] of stepUpCache) {
    if (v < now) stepUpCache.delete(k)
  }
}, 5 * 60 * 1000).unref?.()
