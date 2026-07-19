/**
 * Central model tiering for AI calls.
 *
 *   FAST  — cheap, high-volume work (listing copy, chat, digests, drafts). Haiku.
 *   SMART — high-value reasoning (appraisal, executive/weekly analysis, the concierge
 *           assistant). Defaults to FAST so nothing changes until a dealer/ops opts
 *           in by setting AI_SMART_MODEL (e.g. "claude-sonnet-5") — that way we never
 *           break a working account whose API key lacks access to the bigger model.
 *
 * Override either via env: AI_FAST_MODEL / AI_SMART_MODEL.
 */
export const FAST_MODEL = process.env.AI_FAST_MODEL || 'claude-haiku-4-5-20251001'
export const SMART_MODEL = process.env.AI_SMART_MODEL || FAST_MODEL
