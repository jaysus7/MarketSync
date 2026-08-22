const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

export function validTimeZone(timeZone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date()); return true } catch { return false }
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]))
}

// Resolve a wall-clock value in the dealership timezone without trusting the browser's zone.
// A DST spring-forward time has no matching instant and is refused. During the fall overlap,
// the earlier occurrence wins deterministically; the returned flag lets the UI explain it.
export function dealerLocalToUtc(local, timeZone) {
  const match = LOCAL_RE.exec(String(local || ''))
  if (!match) throw new Error('Schedule time must use YYYY-MM-DDTHH:mm.')
  if (!validTimeZone(timeZone)) throw new Error('The dealership timezone is not valid.')
  const wanted = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`
  const naive = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] || 0))
  const matches = []
  for (let delta = -16 * 60; delta <= 16 * 60; delta++) {
    const instant = new Date(naive + delta * 60_000)
    const p = localParts(instant, timeZone)
    const shown = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
    if (shown === wanted) matches.push(instant.toISOString())
  }
  if (!matches.length) throw new Error('That local time does not exist because of a daylight-saving change. Choose another time.')
  return { utc: matches[0], ambiguous: matches.length > 1 }
}
