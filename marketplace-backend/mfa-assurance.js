// Server-side Supabase clients do not have a browser-persisted active session.
// Passing the already-verified caller JWT is therefore mandatory. Calling the
// assurance API without it can report a missing/aal1 session even when the JWT
// presented to the API is already aal2.
export async function hasAal2(client, token) {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token)
  if (error) throw error
  return data?.currentLevel === 'aal2'
}

// Eased step-up policy for requireMfa. A session clears the bar when it is
// already aal2, OR when the account has no way to reach aal2 — i.e. no verified
// MFA factor is enrolled, which Supabase reports as nextLevel 'aal1'. Only an
// account that HAS enrolled MFA but hasn't completed the challenge this session
// (currentLevel 'aal1', nextLevel 'aal2') is asked to step up. This keeps MFA
// meaningful for users who opted in, without locking the entire app for users
// who never set it up. Still throws (never fails open) when Supabase can't
// report the level, so requireMfa surfaces that as a 503 rather than a bypass.
export async function mfaStepUpSatisfied(client, token) {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token)
  if (error) throw error
  return data?.currentLevel === 'aal2' || data?.nextLevel !== 'aal2'
}
