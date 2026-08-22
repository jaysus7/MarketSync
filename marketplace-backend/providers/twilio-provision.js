// ─────────────────────────────────────────────────────────────────────────────
// Twilio provisioning under MarketSync's MASTER account.
//
// Lets us hand each dealership its own dedicated texting number without the dealer
// ever touching Twilio (the "SaaS" model). We buy a local number under the master
// account, wrap it in a per-dealer Messaging Service, and store the (non-secret)
// number + service SID on the dealer's integration row. Sends then go out with the
// master credentials + that Messaging Service, so each dealer texts from their own
// compliant number.
//
// Everything is guarded: if the master account isn't configured, callers get a clear
// "not configured" error and nothing else breaks.
// ─────────────────────────────────────────────────────────────────────────────
const API = 'https://api.twilio.com/2010-04-01'
const MSG = 'https://messaging.twilio.com/v1'

export function masterCreds() {
  const sid = process.env.TWILIO_MASTER_SID || process.env.TWILIO_ACCOUNT_SID
  const tok = process.env.TWILIO_MASTER_TOKEN || process.env.TWILIO_AUTH_TOKEN
  return (sid && tok) ? { sid, tok } : null
}
export function twilioProvisionConfigured() { return !!masterCreds() }

async function tw(url, method = 'GET', params = null, creds = masterCreds()) {
  if (!creds) throw new Error('Twilio master account is not configured (set TWILIO_MASTER_SID / TWILIO_MASTER_TOKEN).')
  const opts = { method, headers: { Authorization: 'Basic ' + Buffer.from(`${creds.sid}:${creds.tok}`).toString('base64') } }
  if (params) { opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'; opts.body = new URLSearchParams(params) }
  const r = await fetch(url, opts)
  if (r.status === 204) return {}
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || `Twilio error ${r.status}`)
  return j
}

// Search available local numbers (SMS-capable) by country + region (province/state)
// + city + area code / contains. Region is Twilio's 2-letter province/state code
// (e.g. ON, CA); city is the locality name (e.g. Welland).
export async function searchNumbers({ country = 'US', region = '', city = '', areaCode = '', contains = '', limit = 10 } = {}) {
  const creds = masterCreds()
  const q = new URLSearchParams({ SmsEnabled: 'true', PageSize: String(Math.min(30, limit)) })
  if (region) q.set('InRegion', String(region).trim().toUpperCase().slice(0, 4))
  if (city) q.set('InLocality', String(city).trim())
  if (areaCode) q.set('AreaCode', String(areaCode).replace(/\D/g, '').slice(0, 3))
  if (contains) q.set('Contains', contains)
  const j = await tw(`${API}/Accounts/${creds.sid}/AvailablePhoneNumbers/${country}/Local.json?${q}`, 'GET')
  return (j.available_phone_numbers || []).map(n => ({
    number: n.phone_number, friendly: n.friendly_name, locality: n.locality, region: n.region,
  }))
}

// Buy a number under the master account.
export async function buyNumber(number, { smsUrl = '', friendlyName = '' } = {}) {
  const creds = masterCreds()
  const params = { PhoneNumber: number }
  if (smsUrl) params.SmsUrl = smsUrl
  if (friendlyName) params.FriendlyName = friendlyName.slice(0, 64)
  const j = await tw(`${API}/Accounts/${creds.sid}/IncomingPhoneNumbers.json`, 'POST', params)
  return { sid: j.sid, number: j.phone_number }
}

export async function releaseNumber(numberSid) {
  if (!numberSid) return
  const creds = masterCreds()
  await tw(`${API}/Accounts/${creds.sid}/IncomingPhoneNumbers/${numberSid}.json`, 'DELETE')
}

// A per-dealer Messaging Service — the recommended sender for A2P + inbound routing.
export async function createMessagingService(friendlyName, { inboundUrl = '' } = {}) {
  const params = { FriendlyName: String(friendlyName || 'MarketSync dealer').slice(0, 64) }
  if (inboundUrl) params.InboundRequestUrl = inboundUrl
  const j = await tw(`${MSG}/Services`, 'POST', params)
  return { sid: j.sid }
}
export async function addNumberToService(serviceSid, numberSid) {
  await tw(`${MSG}/Services/${serviceSid}/PhoneNumbers`, 'POST', { PhoneNumberSid: numberSid })
}

// Provision the whole thing for a dealer: buy a number, wrap it in a Messaging
// Service, wire inbound. Returns the metadata to persist (all non-secret).
export async function provisionForDealer({ chosenNumber, dealerName = '', inboundUrl = '' }) {
  if (!twilioProvisionConfigured()) throw new Error('Twilio master account is not configured.')
  if (!chosenNumber) throw new Error('Pick a number first.')
  const svc = await createMessagingService(`MarketSync — ${dealerName || 'Dealer'}`, { inboundUrl })
  const bought = await buyNumber(chosenNumber, { smsUrl: inboundUrl, friendlyName: dealerName })
  try { await addNumberToService(svc.sid, bought.sid) } catch (e) { /* number still usable via From */ }
  return {
    platform_managed: true,
    from: bought.number,
    number_sid: bought.sid,
    messaging_service_sid: svc.sid,
    a2p_status: 'not_started',
    provisioned_at: new Date().toISOString(),
  }
}
