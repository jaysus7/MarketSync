import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../shared.js'
import { requireAuth } from '../../middleware.js'
import { rateLimit, getClientIp, generateRecoveryCodes, hashRecoveryCode } from '../../security.js'
import { audit, AuditAction } from '../../audit.js'
import { createMfaLoginChallenge, consumeMfaLoginChallenge, getMfaLoginChallenge } from '../../mfa-login-challenges.js'
import {
  beginPasskeyRegistration, finishPasskeyRegistration,
  beginPasskeyLogin, finishPasskeyLogin,
  listUserPasskeys, deletePasskey
} from '../../passkeys.js'

function maskPhone(phone) {
  const value = String(phone || '')
  if (value.length < 5) return 'your phone'
  return `${value.slice(0, 2)}••• ••• ${value.slice(-4)}`
}

async function replaceMfaRecoveryCodes(userId) {
  const codes = generateRecoveryCodes(10)
  const rows = codes.map(code => ({ user_id: userId, code_hash: hashRecoveryCode(code) }))
  await supabaseAdmin.from('recovery_codes').delete().eq('user_id', userId)
  const { error } = await supabaseAdmin.from('recovery_codes').insert(rows)
  if (error) throw error
  return codes
}

export function registerAuthMfaPasskeyRoutes(app) {
  // Step 1 — Start enrollment. Returns the TOTP secret + a provisioning URI the
  // frontend renders into a QR code.
  app.post('/auth/2fa/enroll', requireAuth, rateLimit('mfa-enroll', 5, 60 * 60 * 1000), async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })

      const { data: factors, error: factorsError } = await userClient.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const totpFactors = factors?.totp || []
      if (totpFactors.some(factor => factor.status === 'verified')) {
        return res.status(409).json({ error: 'MFA_ALREADY_ENABLED', message: 'Multi-factor authentication is already enabled on this account.' })
      }
      await Promise.all(totpFactors
        .filter(factor => factor.status !== 'verified')
        .map(async factor => {
          const { error } = await userClient.auth.mfa.unenroll({ factorId: factor.id })
          if (error) throw error
        }))

      const { data, error } = await userClient.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `MarketSync-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
      })
      if (error) return res.status(400).json({ error: error.message })

      res.json({
        factor_id: data.id,
        qr_code_uri: data.totp?.uri || null,
        secret: data.totp?.secret || null
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Step 2 — Verify the user can produce a valid TOTP code, finalizing enrollment
  app.post('/auth/2fa/verify-enroll', requireAuth, rateLimit('mfa-verify', 10, 60 * 60 * 1000), async (req, res) => {
    const { factor_id, code } = req.body || {}
    if (!factor_id || !code) return res.status(400).json({ error: 'factor_id and code are required' })

    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })

      const { data: challenge, error: chErr } = await userClient.auth.mfa.challenge({ factorId: factor_id })
      if (chErr) return res.status(400).json({ error: chErr.message })

      const { data: verifiedSession, error: verifyErr } = await userClient.auth.mfa.verify({
        factorId: factor_id,
        challengeId: challenge.id,
        code
      })
      if (verifyErr) return res.status(400).json({ error: 'Invalid code. Make sure your authenticator app is in sync.' })

      let codes = []
      try { codes = await replaceMfaRecoveryCodes(req.user.id) }
      catch (codeErr) { console.warn('recovery_codes insert failed:', codeErr.message) }

      audit(req, AuditAction.MFA_ENROLLED, { factor_id })
      res.json({
        success: true,
        message: 'Two-factor authentication is now active on this account.',
        access_token: verifiedSession?.access_token || null,
        refresh_token: verifiedSession?.refresh_token || null,
        recovery_codes: codes,
        recovery_codes_note: 'Save these somewhere safe (password manager, printed). Each one works ONCE if you lose your phone. They will not be shown again.'
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Native Supabase Phone MFA
  app.post('/auth/2fa/phone/enroll', requireAuth, rateLimit('mfa-phone-enroll', 5, 60 * 60 * 1000), async (req, res) => {
    const phone = String(req.body?.phone || '').replace(/[\s()-]/g, '')
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter a mobile number with country code, for example +19055551234.' })
    }
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      const { data: factors, error: factorsError } = await userClient.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const phoneFactors = factors?.phone || []
      if (phoneFactors.some(factor => factor.status === 'verified' && factor.phone === phone)) {
        return res.status(409).json({ error: 'PHONE_MFA_ALREADY_ENABLED', message: 'Text-message MFA is already enabled for this number.' })
      }
      await Promise.all(phoneFactors.filter(factor => factor.status !== 'verified').map(async factor => {
        const { error } = await userClient.auth.mfa.unenroll({ factorId: factor.id })
        if (error) throw error
      }))
      const { data: enrolled, error: enrollError } = await userClient.auth.mfa.enroll({
        factorType: 'phone', phone,
        friendlyName: `MarketSync-SMS-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`,
      })
      if (enrollError) return res.status(400).json({ error: enrollError.message, code: 'PHONE_MFA_NOT_CONFIGURED' })
      const { data: challenge, error: challengeError } = await userClient.auth.mfa.challenge({ factorId: enrolled.id })
      if (challengeError) return res.status(400).json({ error: challengeError.message, code: 'PHONE_MFA_SEND_FAILED' })
      res.json({ factor_id: enrolled.id, challenge_id: challenge.id, phone: maskPhone(phone), message: 'Verification code sent by text message.' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/2fa/phone/verify-enroll', requireAuth, rateLimit('mfa-phone-verify', 10, 60 * 60 * 1000), async (req, res) => {
    const { factor_id, challenge_id, code } = req.body || {}
    if (!factor_id || !challenge_id || !/^\d{6,10}$/.test(String(code || ''))) {
      return res.status(400).json({ error: 'factor_id, challenge_id, and the texted code are required' })
    }
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      const { data: verifiedSession, error } = await userClient.auth.mfa.verify({ factorId: factor_id, challengeId: challenge_id, code: String(code).trim() })
      if (error) return res.status(400).json({ error: 'Invalid verification code. Try again.' })
      let codes = []
      try { codes = await replaceMfaRecoveryCodes(req.user.id) }
      catch (codeErr) { console.warn('recovery_codes insert failed:', codeErr.message) }
      audit(req, AuditAction.MFA_ENROLLED, { factor_id, factor_type: 'phone' })
      res.json({
        success: true,
        message: 'Text-message MFA is now active on this account.',
        access_token: verifiedSession?.access_token || null,
        refresh_token: verifiedSession?.refresh_token || null,
        recovery_codes: codes,
        recovery_codes_note: 'Save these somewhere safe. Each one works ONCE if you lose access to your phone.'
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/auth/2fa/unenroll', requireAuth, rateLimit('mfa-unenroll', 5, 60 * 60 * 1000), async (req, res) => {
    const { factor_id } = req.body || {}
    if (!factor_id) return res.status(400).json({ error: 'factor_id is required' })

    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })

      const { data: factors } = await userClient.auth.mfa.listFactors()
      const allFactors = [...(factors?.totp || []), ...(factors?.phone || [])]
      const targetFactor = allFactors.find(f => f.id === factor_id)
      if (!targetFactor) return res.status(404).json({ error: 'MFA factor not found.' })

      const { error } = await userClient.auth.mfa.unenroll({ factorId: factor_id })
      if (error) return res.status(400).json({ error: error.message })

      const remainingVerified = allFactors.filter(f => f.id !== factor_id && f.status === 'verified')
      if (remainingVerified.length === 0) {
        await supabaseAdmin.from('recovery_codes').delete().eq('user_id', req.user.id)
      }

      audit(req, AuditAction.MFA_UNENROLLED, { factor_id })
      res.json({ success: true, message: 'MFA factor removed.' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/auth/2fa/status', requireAuth, async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })

      const { data: factors, error } = await userClient.auth.mfa.listFactors()
      if (error) return res.status(500).json({ error: error.message })

      const totpFactors = factors?.totp || []
      const phoneFactors = factors?.phone || []
      const verifiedTotp = totpFactors.filter(f => f.status === 'verified')
      const verifiedPhone = phoneFactors.filter(f => f.status === 'verified')
      const enabled = verifiedTotp.length > 0 || verifiedPhone.length > 0

      let recoveryCodesRemaining = 0
      if (enabled) {
        const { count } = await supabaseAdmin
          .from('recovery_codes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', req.user.id)
        recoveryCodesRemaining = count || 0
      }

      const passkeys = await listUserPasskeys({ supabaseAdmin, userId: req.user.id })

      res.json({
        enabled,
        factors: [
          ...verifiedTotp.map(f => ({ id: f.id, type: 'totp', friendly_name: f.friendly_name, created_at: f.created_at })),
          ...verifiedPhone.map(f => ({ id: f.id, type: 'phone', friendly_name: f.friendly_name, phone: maskPhone(f.phone), created_at: f.created_at }))
        ],
        recovery_codes_remaining: recoveryCodesRemaining,
        passkeys
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/2fa/recovery-codes/regenerate', requireAuth, rateLimit('recovery-regen', 3, 60 * 60 * 1000), async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
      })
      const { data: factors } = await userClient.auth.mfa.listFactors()
      const verifiedCount = [...(factors?.totp || []), ...(factors?.phone || [])].filter(f => f.status === 'verified').length
      if (verifiedCount === 0) {
        return res.status(400).json({ error: 'Enable 2FA first before generating recovery codes.' })
      }

      const codes = await replaceMfaRecoveryCodes(req.user.id)
      audit(req, AuditAction.RECOVERY_CODES_REGENERATED, {})
      res.json({
        success: true,
        recovery_codes: codes,
        recovery_codes_note: 'Your old recovery codes are now invalid. Save these new ones somewhere safe.'
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/auth/passkey/list', requireAuth, async (req, res) => {
    try {
      const passkeys = await listUserPasskeys({ supabaseAdmin, userId: req.user.id })
      res.json({ passkeys })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/passkey/register/begin', requireAuth, rateLimit('passkey-reg-begin', 10, 60 * 60 * 1000), async (req, res) => {
    try {
      const options = await beginPasskeyRegistration({ user: req.user, userAgent: req.headers['user-agent'] })
      res.json(options)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/passkey/register/finish', requireAuth, rateLimit('passkey-reg-finish', 10, 60 * 60 * 1000), async (req, res) => {
    try {
      const result = await finishPasskeyRegistration({ user: req.user, body: req.body || {} })
      audit(req, AuditAction.PASSKEY_REGISTERED, { credential_id: result.passkey?.credential_id || null })
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.post('/auth/passkey/login/begin', rateLimit('passkey-login-begin', 20, 60 * 60 * 1000), async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase()
      const options = await beginPasskeyLogin({ email })
      res.json(options)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/passkey/login/finish', rateLimit('passkey-login-finish', 20, 60 * 60 * 1000), async (req, res) => {
    try {
      const result = await finishPasskeyLogin({ body: req.body || {}, ip: getClientIp(req), userAgent: req.headers['user-agent'] })
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  app.delete('/auth/passkey/:id', requireAuth, rateLimit('passkey-delete', 10, 60 * 60 * 1000), async (req, res) => {
    try {
      const id = String(req.params.id || '')
      const deleted = await deletePasskey({ supabaseAdmin, userId: req.user.id, passkeyId: id })
      if (!deleted) return res.status(404).json({ error: 'Passkey not found.' })
      audit(req, AuditAction.PASSKEY_DELETED, { passkey_id: id })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/2fa/send-code', rateLimit('mfa-send-code', 5, 15 * 60 * 1000), async (req, res) => {
    const { factor_id, partial_token } = req.body || {}
    const loginChallenge = getMfaLoginChallenge(partial_token)
    if (!factor_id || !loginChallenge) return res.status(401).json({ error: 'MFA challenge expired. Please sign in again.' })
    try {
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${loginChallenge.accessToken}` } }
      })
      const { data: factors, error: factorError } = await userClient.auth.mfa.listFactors()
      if (factorError) throw factorError
      const phoneFactor = (factors?.phone || []).find(f => f.id === factor_id && f.status === 'verified')
      if (!phoneFactor) return res.status(400).json({ error: 'Choose a verified text-message factor.' })
      const { data: challenge, error } = await userClient.auth.mfa.challenge({ factorId: factor_id })
      if (error) return res.status(400).json({ error: error.message })
      res.json({ challenge_id: challenge.id, phone: maskPhone(phoneFactor.phone), message: 'Code sent.' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/auth/2fa/challenge', rateLimit('mfa-challenge', 5, 15 * 60 * 1000), async (req, res) => {
    const { factor_id, challenge_id, code, partial_token } = req.body || {}
    if (!factor_id || !code || !partial_token) {
      return res.status(400).json({ error: 'factor_id, code, and partial_token are required' })
    }

    try {
      const loginChallenge = getMfaLoginChallenge(partial_token)
      if (!loginChallenge) {
        return res.status(401).json({ error: 'MFA challenge expired. Please sign in again.' })
      }
      const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${loginChallenge.accessToken}` } }
      })

      const normalized = code.replace(/[\s-]/g, '').toUpperCase()
      const isRecoveryCode = /^[A-Z2-9]{8}$/.test(normalized)

      if (isRecoveryCode) {
        const { data: { user } } = await userClient.auth.getUser()
        if (!user) return res.status(401).json({ error: 'Invalid session.' })

        const hash = hashRecoveryCode(normalized)
        const { data: codeRow, error: lookupErr } = await supabaseAdmin
          .from('recovery_codes')
          .select('id')
          .eq('user_id', user.id)
          .eq('code_hash', hash)
          .maybeSingle()
        if (lookupErr || !codeRow) return res.status(401).json({ error: 'Invalid recovery code.' })

        await supabaseAdmin.from('recovery_codes').delete().eq('id', codeRow.id)

        supabaseAdmin.from('logins').insert({
          user_id: user.id,
          ip: getClientIp(req),
          user_agent: (req.headers['user-agent'] || '').slice(0, 500) + ' [recovery-code]'
        }).then(({ error: logErr }) => {
          if (logErr) console.warn('login log failed:', logErr.message)
        })

        const { count: remaining } = await supabaseAdmin
          .from('recovery_codes').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)

        const completed = consumeMfaLoginChallenge(partial_token)
        return res.json({
          access_token: completed.accessToken,
          refresh_token: completed.refreshToken,
          user: { id: user.id, email: user.email },
          used_recovery_code: true,
          recovery_codes_remaining: remaining || 0
        })
      }

      const { data: factors, error: factorError } = await userClient.auth.mfa.listFactors()
      if (factorError) throw factorError
      const totpFactor = (factors?.totp || []).find(f => f.id === factor_id && f.status === 'verified')
      const phoneFactor = (factors?.phone || []).find(f => f.id === factor_id && f.status === 'verified')
      if (!totpFactor && !phoneFactor) return res.status(400).json({ error: 'That MFA method is not available on this account.' })

      let activeChallengeId = challenge_id
      if (totpFactor) {
        const { data: challenge, error: chErr } = await userClient.auth.mfa.challenge({ factorId: factor_id })
        if (chErr) return res.status(400).json({ error: chErr.message })
        activeChallengeId = challenge.id
      } else if (!activeChallengeId) {
        return res.status(400).json({ error: 'Send a text-message code before verifying.' })
      }

      const { data, error } = await userClient.auth.mfa.verify({
        factorId: factor_id,
        challengeId: activeChallengeId,
        code
      })
      if (error) return res.status(401).json({ error: 'Invalid or expired MFA code.' })

      consumeMfaLoginChallenge(partial_token)

      supabaseAdmin.from('logins').insert({
        user_id: data.user?.id,
        ip: getClientIp(req),
        user_agent: (req.headers['user-agent'] || '').slice(0, 500) + (phoneFactor ? ' [phone-mfa]' : ' [totp]')
      }).then(({ error: logErr }) => {
        if (logErr) console.warn('login log failed:', logErr.message)
      })

      res.json({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: { id: data.user?.id, email: data.user?.email }
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
