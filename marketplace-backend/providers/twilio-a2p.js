// ─────────────────────────────────────────────────────────────────────────────
// Twilio A2P 10DLC registration for ISVs (MarketSync onboards dealers as its
// SECONDARY customers under one master/ISV account).
//
// The dealer never touches Twilio. They give their business details once during
// onboarding ("Messaging Verification"); MarketSync then, in the background:
//   1. creates a Secondary Customer Profile (TrustHub) for the dealer,
//   2. attaches business info + an authorized representative, evaluates & submits it,
//   3. once approved, builds the A2P Trust Bundle + registers the dealer's Brand,
//   4. once the Brand is approved, registers a Campaign on the dealer's Messaging
//      Service so their number can send A2P traffic.
// Every returned SID + status is persisted so the UI can show one simple line:
//      Pending → In review → Approved → Active.
//
// GUARDED: none of this runs — and nothing breaks — unless the ISV prerequisites
// are present (master creds + the ISV Primary Customer Profile SID that Twilio
// issues once MarketSync's account is approved as an ISV/Reseller). Without them,
// callers get { configured: false } and the dealer's details are simply stored as
// "pending" for manual/ later registration, exactly as before.
// ─────────────────────────────────────────────────────────────────────────────
import { masterCreds } from './twilio-provision.js'

const TRUSTHUB = 'https://trusthub.twilio.com/v1'
const MESSAGING = 'https://messaging.twilio.com/v1'

// Twilio-published policy SIDs (public constants; override via env only if Twilio
// changes them). These select the correct evaluation policy for each bundle type.
const SECONDARY_CP_POLICY = process.env.TWILIO_SECONDARY_CP_POLICY_SID || 'RNb0d4771c2c98518d916a3d4cd70a8f8b'
const A2P_POLICY = process.env.TWILIO_A2P_POLICY_SID || 'RNdfbf3fae0e1107f8aded786e5a467484'

// The one thing that only exists after MarketSync's Twilio account is approved as
// an ISV: the Primary Customer Profile SID (BU…). Everything hangs off it.
export function isvPrimaryProfileSid() { return process.env.TWILIO_ISV_PRIMARY_PROFILE_SID || '' }

export function twilioA2pConfigured() { return !!(masterCreds() && isvPrimaryProfileSid()) }

// Raw Twilio REST call under the master/ISV account. Mirrors twilio-provision's tw().
async function api(url, method = 'GET', params = null) {
  const creds = masterCreds()
  if (!creds) throw new Error('Twilio master account is not configured.')
  const opts = { method, headers: { Authorization: 'Basic ' + Buffer.from(`${creds.sid}:${creds.tok}`).toString('base64') } }
  if (params) { opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'; opts.body = new URLSearchParams(params) }
  const r = await fetch(url, opts)
  if (r.status === 204) return {}
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || `Twilio error ${r.status}`)
  return j
}

// ── Step builders (each is one Twilio resource, so they read against the docs) ──

// A per-dealer Secondary Customer Profile bundle.
async function createSecondaryProfile({ dealerName, email, statusCallbackUrl }) {
  const params = { FriendlyName: `MarketSync — ${dealerName || 'Dealer'}`.slice(0, 64), Email: email, PolicySid: SECONDARY_CP_POLICY }
  if (statusCallbackUrl) params.StatusCallbackUrl = statusCallbackUrl
  const j = await api(`${TRUSTHUB}/CustomerProfiles`, 'POST', params)
  return j.sid
}

// The dealer's business identity (an EndUser of type business information).
async function createBusinessEndUser(profile) {
  const attributes = {
    business_name: profile.legal_name,
    business_registration_identifier: profile.tax_id_type || (profile.country === 'CA' ? 'Other' : 'EIN'),
    business_registration_number: profile.tax_id,
    business_identity: 'direct_customer',
    business_type: profile.business_type || 'Limited Liability Corporation',
    business_industry: profile.industry || 'AUTOMOTIVE',
    business_regions_of_operation: profile.country === 'CA' ? 'CANADA' : 'USA_AND_CANADA',
    website_url: profile.website || undefined,
  }
  const j = await api(`${TRUSTHUB}/EndUsers`, 'POST', {
    FriendlyName: `${profile.legal_name} — business info`.slice(0, 64),
    Type: 'customer_profile_business_information',
    Attributes: JSON.stringify(attributes),
  })
  return j.sid
}

// An authorized representative for the dealer (required on the profile).
async function createRepresentativeEndUser(profile) {
  const [first, ...rest] = String(profile.contact_name || 'Authorized Rep').trim().split(/\s+/)
  const attributes = {
    job_position: profile.contact_title || 'Director',
    last_name: rest.join(' ') || first,
    phone_number: profile.phone,
    first_name: first,
    email: profile.email,
    business_title: profile.contact_title || 'Director',
  }
  const j = await api(`${TRUSTHUB}/EndUsers`, 'POST', {
    FriendlyName: `${profile.legal_name} — authorized rep`.slice(0, 64),
    Type: 'authorized_representative_1',
    Attributes: JSON.stringify(attributes),
  })
  return j.sid
}

async function assign(bundleSid, objectSid) {
  await api(`${TRUSTHUB}/CustomerProfiles/${bundleSid}/EntityAssignments`, 'POST', { ObjectSid: objectSid })
}
async function assignToTrustProduct(bundleSid, objectSid) {
  await api(`${TRUSTHUB}/TrustProducts/${bundleSid}/EntityAssignments`, 'POST', { ObjectSid: objectSid })
}

async function evaluateProfile(bundleSid) {
  return api(`${TRUSTHUB}/CustomerProfiles/${bundleSid}/Evaluations`, 'POST', { PolicySid: SECONDARY_CP_POLICY })
}
async function submitProfile(bundleSid) {
  return api(`${TRUSTHUB}/CustomerProfiles/${bundleSid}`, 'POST', { Status: 'pending-review' })
}
async function getProfile(bundleSid) {
  return api(`${TRUSTHUB}/CustomerProfiles/${bundleSid}`, 'GET')
}

// A2P Trust Bundle (Trust Product) — required before a Brand can be registered.
async function createA2pTrustBundle({ dealerName, email, companyType }) {
  const tp = await api(`${TRUSTHUB}/TrustProducts`, 'POST', {
    FriendlyName: `MarketSync A2P — ${dealerName || 'Dealer'}`.slice(0, 64), Email: email, PolicySid: A2P_POLICY,
  })
  const eu = await api(`${TRUSTHUB}/EndUsers`, 'POST', {
    FriendlyName: `${dealerName} — a2p profile`.slice(0, 64),
    Type: 'us_a2p_messaging_profile_information',
    Attributes: JSON.stringify({ company_type: companyType || 'private' }),
  })
  await assignToTrustProduct(tp.sid, eu.sid)
  await api(`${TRUSTHUB}/TrustProducts/${tp.sid}/Evaluations`, 'POST', { PolicySid: A2P_POLICY })
  await api(`${TRUSTHUB}/TrustProducts/${tp.sid}`, 'POST', { Status: 'pending-review' })
  return tp.sid
}
async function getTrustProduct(sid) { return api(`${TRUSTHUB}/TrustProducts/${sid}`, 'GET') }

async function registerBrand({ customerProfileBundleSid, a2pProfileBundleSid }) {
  const j = await api(`${MESSAGING}/a2p/BrandRegistrations`, 'POST', {
    CustomerProfileBundleSid: customerProfileBundleSid,
    A2PProfileBundleSid: a2pProfileBundleSid,
  })
  return { sid: j.sid, status: j.status }
}
async function getBrand(sid) { return api(`${MESSAGING}/a2p/BrandRegistrations/${sid}`, 'GET') }

// Register the Campaign (use case) on the dealer's Messaging Service so their
// number can actually send. Automotive dealer follow-ups map to MIXED / CUSTOMER_CARE.
async function registerCampaign({ messagingServiceSid, brandSid, dealerName }) {
  const j = await api(`${MESSAGING}/Services/${messagingServiceSid}/Compliance/Usa2p`, 'POST', {
    BrandRegistrationSid: brandSid,
    Description: `Sales, service and appointment follow-ups for ${dealerName || 'the dealership'} to customers who provided their number.`.slice(0, 4096),
    MessageFlow: 'Customers provide their mobile number to the dealership in person, by phone, or on the dealership website when requesting information, booking service, or during a purchase, and consent to receive follow-up messages.'.slice(0, 4096),
    MessageSamples: [
      `Hi {name}, it's {rep} at ${dealerName || 'the dealership'} — here's the video walkaround of the vehicle you asked about: {link}. Reply STOP to opt out.`,
      `Hi {name}, your service appointment at ${dealerName || 'the dealership'} is confirmed for {time}. Reply STOP to opt out.`,
    ],
    UsAppToPersonUsecase: 'MIXED',
    HasEmbeddedLinks: true,
    HasEmbeddedPhone: true,
    OptInMessage: `You are now opted in to messages from ${dealerName || 'the dealership'}. Msg&data rates may apply. Reply STOP to opt out.`.slice(0, 320),
  })
  return { sid: j.sid, status: j.campaign_status || j.status }
}
async function getCampaign(messagingServiceSid) {
  return api(`${MESSAGING}/Services/${messagingServiceSid}/Compliance/Usa2p`, 'GET')
}

// Normalize the many Twilio statuses into the four the dealer sees.
function uiStatus({ profileStatus, brandStatus, campaignStatus }) {
  if (campaignStatus && /verified|success|approved|active/i.test(campaignStatus)) return 'active'
  if (brandStatus && /approved|verified/i.test(brandStatus)) return 'approved'
  if (brandStatus && /failed|rejected/i.test(brandStatus)) return 'failed'
  if (profileStatus === 'twilio-approved' || profileStatus === 'approved') return 'approved'
  if (profileStatus === 'twilio-rejected' || profileStatus === 'rejected') return 'failed'
  return 'in_review'
}

/**
 * Kick off registration for a dealer. Synchronous creation steps only — the
 * approvals are asynchronous, so this returns after submitting the Customer
 * Profile for review and records the SIDs. `advanceDealerA2p` moves it forward.
 *
 * Returns { configured, state } where state is the object to persist.
 */
export async function startDealerA2p({ profile, messagingServiceSid, statusCallbackUrl }) {
  if (!twilioA2pConfigured()) return { configured: false, state: null }
  if (!profile?.legal_name || !profile?.tax_id) throw new Error('Legal business name and tax ID are required.')

  const customerProfileSid = await createSecondaryProfile({ dealerName: profile.legal_name, email: profile.email, statusCallbackUrl })
  const businessSid = await createBusinessEndUser(profile)
  const repSid = await createRepresentativeEndUser(profile)
  // Attach business info, the representative, and MarketSync's primary profile.
  await assign(customerProfileSid, businessSid)
  await assign(customerProfileSid, repSid)
  await assign(customerProfileSid, isvPrimaryProfileSid())
  await evaluateProfile(customerProfileSid)
  await submitProfile(customerProfileSid)

  return {
    configured: true,
    state: {
      customer_profile_sid: customerProfileSid,
      business_end_user_sid: businessSid,
      representative_end_user_sid: repSid,
      messaging_service_sid: messagingServiceSid || null,
      a2p_trust_bundle_sid: null,
      brand_sid: null,
      campaign_sid: null,
      status: 'in_review',
      last_synced_at: new Date().toISOString(),
    },
  }
}

/**
 * Poll Twilio and advance the dealer through the pipeline: once the Customer
 * Profile is approved, build the A2P bundle + Brand; once the Brand is approved,
 * register the Campaign. Idempotent — safe to call repeatedly (e.g. from a status
 * check or a Twilio status-callback webhook). Returns the updated state.
 */
export async function advanceDealerA2p(state, { profile } = {}) {
  if (!twilioA2pConfigured() || !state?.customer_profile_sid) return state
  const s = { ...state }
  const cp = await getProfile(s.customer_profile_sid).catch(() => null)
  const profileStatus = cp?.status || null

  // Customer Profile approved → create the A2P trust bundle + register the Brand.
  if ((profileStatus === 'twilio-approved' || profileStatus === 'approved') && !s.brand_sid) {
    if (!s.a2p_trust_bundle_sid) {
      s.a2p_trust_bundle_sid = await createA2pTrustBundle({
        dealerName: profile?.legal_name, email: profile?.email, companyType: profile?.company_type,
      })
    }
    const tp = await getTrustProduct(s.a2p_trust_bundle_sid).catch(() => null)
    if (tp && (tp.status === 'twilio-approved' || tp.status === 'approved')) {
      const brand = await registerBrand({ customerProfileBundleSid: s.customer_profile_sid, a2pProfileBundleSid: s.a2p_trust_bundle_sid })
      s.brand_sid = brand.sid
    }
  }

  // Brand approved → register the Campaign on the dealer's Messaging Service.
  let brandStatus = null, campaignStatus = null
  if (s.brand_sid) {
    const brand = await getBrand(s.brand_sid).catch(() => null)
    brandStatus = brand?.status || null
    if (/approved|verified/i.test(brandStatus || '') && s.messaging_service_sid && !s.campaign_sid) {
      const camp = await registerCampaign({ messagingServiceSid: s.messaging_service_sid, brandSid: s.brand_sid, dealerName: profile?.legal_name })
      s.campaign_sid = camp.sid; campaignStatus = camp.status
    }
  }
  if (s.messaging_service_sid && s.campaign_sid && !campaignStatus) {
    const camp = await getCampaign(s.messaging_service_sid).catch(() => null)
    campaignStatus = camp?.campaign_status || camp?.status || null
  }

  s.status = uiStatus({ profileStatus, brandStatus, campaignStatus })
  s.last_synced_at = new Date().toISOString()
  return s
}
