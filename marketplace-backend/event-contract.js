// Stable event contract validation, kept independent of the database layer so
// producers and automated tests share exactly the same rules.
const EVENT_NAME = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/

export function validateEventContract(eventName, eventVersion = 1) {
  if (typeof eventName !== 'string' || !EVENT_NAME.test(eventName)) {
    return { ok: false, error: 'invalid event name' }
  }
  const version = Number(eventVersion)
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'invalid event version' }
  }
  return { ok: true, version }
}
