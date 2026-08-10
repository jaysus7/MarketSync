# Phase 6 — Marketing + Communications: critical truth check

Baseline: `staging` @ `2c3d1f8`, 613/613 tests, six `check:*` green.

Scope of this check, per the phase method: only the nine places where a wrong assumption is
unrecoverable — customer identity, conversation identity, campaign/source attribution,
consent, social publishing ownership, external-account authorization, actual spend,
delivered-sale/gross attribution, tenant isolation. Everything else is inspected while
building.

---

## CURRENT TRUTH

Considerably more exists than the absence of a `marketing` department suggests.

**Strong foundations, reuse as-is:**

- **`ai_conversations`** already carries `contact_id` **and** `visitor_token`, plus `source`,
  `status`, `assigned_salesperson`, `summary`, `sentiment`, `lead_score`, `lead_type`,
  `booked`, `requested_rep`. The anonymous-visitor → identified-customer bridge is already
  modelled. `ai_messages` holds the transcript.
- **`customer_consents`** is a real consent record: `consent_type`, `status`,
  `lawful_basis`, `policy_version`, `notice_text_hash`, `captured_by`, `captured_at`,
  `expires_at`, `ip`, `user_agent`, `evidence`. This is the consent truth Phase 6 must reuse.
- **`contacts`** is the canonical customer; `leads`, `deals`, `inventory` are canonical.
- **`automated_campaigns`** holds triggered lifecycle messaging (trigger event, channel,
  delay, templates).
- `marketing_spend` (channel, period, amount), `dealer_campaigns`, `dealer_email_templates`.

**Not present at all:** any social account table, publishing model, conversation channel
beyond web chat, video messaging, reputation, segments, website forms, or a Marketing
department workspace.

`saas_campaigns` / `saas_email_templates` are **MarketSync's own** marketing, not a
dealership's. They belong to Phase 9B and are out of scope.

---

## CRITICAL GAPS

### G1 — Attribution runs on display names, not identity *(blocking)*

`buildMarketingRoi()` attributes every lead and sale by passing a **free-text**
`contacts.source` / `sold_source` string through `channelOf()`. `contacts` has no
`campaign_id`; nothing links a customer to a campaign by ID.

The brief's required chain — Campaign → Source → Lead/Customer → Opportunity → Appointment →
Deal → Delivered — **cannot be traced today**. Two campaigns on the same channel are
indistinguishable, and a renamed source silently re-buckets history.

### G2 — There is no canonical Campaign *(blocking)*

`dealer_campaigns` is an **email blast**: name, segment, template, subject, body,
`scheduled_at`, `sent_count`. It has no objective, no channels, no budget, no spend, no
inventory link, no owner, no approval state.

A Campaign that spans Meta + Google + organic + email + SMS + a landing page has nowhere to
live, so provider IDs would inevitably become the campaign identity — the exact outcome the
brief forbids.

### G3 — No source taxonomy *(blocking)*

`contacts.source` is free text and `channelOf()` normalises by string matching. Nothing stops
each screen inventing its own spelling. The taxonomy the brief lists (Facebook Ads,
Instagram Organic, Marketplace, Walk-In, …) does not exist as data.

### G4 — Budget and actual spend are the same column

`marketing_spend` has one `amount` and a `source` column that is entirely unused (no rows,
no writer). Nothing distinguishes *planned* from *actually spent*, so any ROI built on it
risks reporting budget as spend — explicitly forbidden.

### G5 — Gross is assumed, not read

`/marketing/roi` accepts `avg_gross` as a query parameter and otherwise falls back to a
constant `DEFAULT_AVG_GROSS`; revenue comes from `deals.selling_price`. Marketing is
inventing profitability.

This is now fixable rather than merely wrong: **Phase 5 made posted gross real.** Marketing
should consume delivered units and posted gross from Accounting instead of assuming an
average.

### G6 — Social identity and publishing authorization do not exist *(blocking, and the most dangerous)*

There is no table for a connected social account, so there is no notion of a
dealership-owned page versus a salesperson's personal account, no ownership, no per-account
permission, no token custody, and no server-side publish authorization.

Publishing is **irreversible and external**. Building any composer before this exists would
mean the UI decides who may post as whom — the one failure mode in Phase 6 that cannot be
undone by a migration.

### G7 — Consent exists but nothing enforces it

`customer_consents` is well modelled and **no route reads it**. There is no shared
"may we contact this customer on this channel" helper, so every new sender — campaigns, AI
follow-up, sales video, automation — would re-decide it independently, and one of them would
get it wrong.

---

## DECISIONS

1. **Campaign becomes a first-class canonical record** with channels, budget, actual spend,
   inventory scope, owner and approval state. Provider campaign IDs are stored as **external
   references on the campaign**, never as the identity.
2. **A closed source taxonomy** in one place, used by every screen. `contacts.source` is
   preserved and mapped, not rewritten — historical strings stay readable.
3. **Attribution by ID.** A contact gains a nullable `campaign_id` and a normalised
   `source_key`. Where only a legacy string exists, it maps through the taxonomy and is
   reported as *inferred*, distinctly from *linked*.
4. **Budget and actual spend are separate**, and actual spend records where it came from
   (imported from a provider, or entered by a person). ROI is computed only from actual.
5. **Gross comes from Accounting**, not an assumption. Where a delivered deal has no posted
   gross, the campaign reports units without gross rather than an invented figure.
6. **Social accounts get an ownership model before any composer is built**:
   dealership-owned vs user-owned, explicit per-account grants, server-side authorization on
   every publish. Tokens are never returned to the client.
7. **One consent gate** all senders call. Opt-out propagates because there is only one
   place to ask.
8. **Conversation stays the existing `ai_conversations` + `ai_messages`**, extended with
   channel so SMS and email continue the same conversation. No second conversation model.

---

## IMPLEMENTATION — order matters

The blocking-identity work comes first, because everything else attributes to it.

1. Source taxonomy + canonical Campaign + campaign↔contact link by ID.
2. Budget vs actual spend, and ROI rebuilt on posted gross.
3. Social account ownership + authorization (before any publishing UI exists).
4. One consent gate, adopted by every sender.
5. Conversation channel continuity (web → SMS/email), human takeover, timeline events.
6. Marketing department workspace: My Day, Campaigns, Studio, Social, Email & SMS,
   Conversations, Website, Reputation.
7. Sales video messaging — owned by **Sales**, reusing Phase 6 media/consent/tracking.
8. Phase 6 E2E.

---

## DEFERRED

- Provider ad-spend importers (Meta/Google) — the model records actual spend and its origin
  now; each importer is its own integration.
- Multi-touch attribution beyond first-touch and last-touch. The data supports those two
  honestly; anything more would be a promise the timeline cannot keep.
- Full creative editor parity with Canva, and advanced video editing.

---

## TESTS

To be written alongside, not after:

- A contact linked to a campaign by ID attributes to it; a legacy free-text source attributes
  as *inferred* and is labelled as such.
- Two campaigns on one channel stay distinguishable.
- ROI never uses budget as spend, and reports units without gross rather than assuming one.
- Publishing to an account the user does not hold a grant for is refused **server-side**.
- A salesperson cannot publish to the dealership page without an explicit grant.
- Every sender path calls the consent gate; an opted-out customer is refused on that channel.
- A conversation that moves web → SMS keeps one `conversation_id` and one customer.
- Cross-dealership reads and publishes are refused.
