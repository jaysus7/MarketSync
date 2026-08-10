/**
 * Social provider adapters (Phase 6 PR 6.6).
 *
 * This file is a boundary, not an integration. Each network — Facebook Pages, Instagram,
 * TikTok, LinkedIn — is its own OAuth app, its own review process and its own publishing
 * semantics; they arrive one at a time, and each is its own piece of work.
 *
 * What matters is what happens BEFORE any of them exist, because that is the state the
 * product is in today: a dealership schedules a post and nothing publishes it. Until this
 * slice, that failure was silent — the post sat at 'scheduled' forever and nobody was told.
 *
 * The rule this file exists to enforce:
 *
 *   A post is only 'published' when a provider returned an id for something it created.
 *
 * No provider, no credentials, an exception, or a success with no id — all of these are
 * failures with a plain-English reason. None of them may ever be recorded as published.
 * "Published" is a claim to the dealership that their inventory is in front of customers;
 * making that claim falsely is worse than admitting we could not send it.
 */

export const PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED'
export const PROVIDER_NO_CREDENTIALS = 'PROVIDER_NO_CREDENTIALS'
export const PROVIDER_NO_EVIDENCE = 'PROVIDER_NO_EVIDENCE'
export const PROVIDER_THREW = 'PROVIDER_THREW'

// The networks the product talks about. Being listed here means the dealership can connect an
// account and compose for it — NOT that MarketSync can publish to it. `publishToProvider`
// decides that, and says so out loud when it cannot.
export const KNOWN_PROVIDERS = ['facebook', 'instagram', 'tiktok', 'linkedin', 'x', 'youtube']

const ADAPTERS = new Map()

/**
 * Register a real integration. An adapter is `async publish({ account, body, media }) =>
 * { external_post_id }` — it either returns the provider's id or throws. It is deliberately
 * not allowed to report success any other way.
 */
export function registerSocialProvider(provider, adapter) {
  if (!provider || typeof adapter?.publish !== 'function') {
    throw new Error('A social provider adapter must supply a publish() function.')
  }
  ADAPTERS.set(provider, adapter)
}

export function socialProviderConfigured(provider) { return ADAPTERS.has(provider) }
export function configuredSocialProviders() { return [...ADAPTERS.keys()].sort() }

// Exported for tests: no adapters ship in this slice, so a test that registers one must be
// able to put the registry back the way it found it.
export function __resetSocialProviders() { ADAPTERS.clear() }

/**
 * Attempt one publication. Never throws — the dispatcher needs an outcome for every target,
 * because a target with no outcome is a post whose fate nobody records.
 *
 * `retryable` distinguishes "try again in a minute" from "this will never work until a human
 * does something". Retrying a missing integration forever would bury the real message.
 */
export async function publishToProvider({ account, body, media = [] }) {
  const provider = account?.provider || 'unknown'
  const adapter = ADAPTERS.get(provider)

  if (!adapter) {
    return {
      ok: false, code: PROVIDER_NOT_CONFIGURED, retryable: false,
      error: `MarketSync cannot publish to ${provider} yet — no integration is connected. Nothing was sent.`,
    }
  }
  if (account.status !== 'connected') {
    return {
      ok: false, code: PROVIDER_NO_CREDENTIALS, retryable: false,
      error: `The ${provider} account "${account.display_name}" is ${account.status}. Reconnect it, then publish again.`,
    }
  }

  try {
    const out = await adapter.publish({ account, body, media })
    const id = out?.external_post_id
    // A provider that returns nothing identifiable has not demonstrated that it created
    // anything. Treat it as a failure rather than write "published" on our own authority.
    if (!id) {
      return {
        ok: false, code: PROVIDER_NO_EVIDENCE, retryable: true,
        error: `${provider} accepted the request but returned no post id, so we cannot confirm it went live.`,
      }
    }
    return { ok: true, external_post_id: String(id), url: out.url || null }
  } catch (e) {
    return {
      ok: false, code: PROVIDER_THREW, retryable: e?.retryable !== false,
      error: `${provider} refused the post: ${e?.message || 'unknown error'}`,
    }
  }
}
