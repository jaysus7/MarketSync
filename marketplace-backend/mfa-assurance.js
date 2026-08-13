// Server-side Supabase clients do not have a browser-persisted active session.
// Passing the already-verified caller JWT is therefore mandatory. Calling the
// assurance API without it can report a missing/aal1 session even when the JWT
// presented to the API is already aal2.
export async function hasAal2(client, token) {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token)
  if (error) throw error
  return data?.currentLevel === 'aal2'
}
