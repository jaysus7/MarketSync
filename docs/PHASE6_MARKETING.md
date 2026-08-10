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

---

## OUTCOMES

### PR 6.1 — Campaign identity, source taxonomy, spend and gross *(merged, #81)*

Closed G1–G5. A canonical `campaigns` record with an id that leads and deals carry;
`marketing_sources` as the taxonomy; budget and actual spend separated into distinct columns;
gross read from **posted** journal lines. A campaign whose deliveries have not reached the
books reports its units with `gross_unknown` counted — never a per-unit average standing in
for a number nobody posted. Legacy free-text sources map through `inferSourceKey()` and stay
labelled *inferred*; linked and inferred figures are never summed.

### PR 6.2 — Social identity and server-side publishing authorization *(merged, #82)*

Closed G6, the most dangerous gap. `canActOnAccount()` decides every publish server-side:
dealership-owned pages need a grant **or** `marketing.publish`; user-owned accounts need
ownership or an explicit grant. The user branch resolves first, so `marketing.publish` can
never reach a salesperson's personal account. A cross-tenant account is refused identically
to one that does not exist — the refusal reveals nothing. Credentials never leave the server:
reads go through a `SAFE_COLUMNS` allowlist that omits `credentials_enc`.

### PR 6.3 — One consent gate *(merged)*

Closed G7. `mayContact()` is the single gate every sender calls, and it answers with a
*basis* — `express`, `implied`, `internal` or `blocked` — rather than a bare boolean, so a
refusal can be explained to the person who hit it. Hard stops (opt-out, DNC) precede channel
flags, which precede automation pause, which precedes reachability. `recordOptOut()` writes
both the flag and the evidence record, because a preference with no provenance is not consent.

### PR 6.4 — Conversation continuity and human takeover *(merged, #83)*

The customer is the identity; the channel is not. `identifyConversation()` **merges** into an
existing open thread rather than opening a second one, and a database partial unique index
makes one-open-conversation-per-contact real rather than aspirational. Merged threads keep
their transcript and point at the winner — the record of what was said is evidence, not
scratch. `takeOver()` cannot be silently undone by the AI runtime, and `handoffBrief()` hands
a person the transcript, the reachable channels and the next action instead of a raw log.

### PR 6.5 — The Marketing operating workspace *(this PR)*

My Day is **composed**, not re-derived. `/marketing/attention` merges `campaignAttention`,
`socialAttention` and `conversationAttention`; the workspace renders what the server decided
and computes no severity of its own. A second opinion about "what needs attention" would drift
from the department that owns the fact, and then two screens would disagree about the same
dealership. Each source degrades to empty independently, so one failing department cannot
blank the day. Problems and opportunities are separated rather than ranked against each other
— "this is working, do more" is not a smaller version of "this is broken".

Items hand off to whoever can actually fix them: a gross gap is owned by **Accounting** and
routes there, a waiting customer is owned by **Sales**. Three honesty rules are carried into
the pixels: linked and inferred attribution sit in separate cards with the reason stated;
an incomplete gross is said out loud wherever the number appears; and publishing rights are
reported by the server (`can_publish` plus `why`), never re-decided in the browser.

Validated at 390px across all six surfaces — no horizontal overflow, no clipped state signals,
no collapsed tap targets. That pass caught two real defects: the manager-only tab rendered as
the raw key `insights`, and a post whose targets partly failed was labelled **published**. It
now reads *Partly published* and names how many failed.

### PR 6.6 — Studio and social publishing *(this PR)*

**The finding:** nothing had ever published. There is no provider API call for social anywhere
in the codebase — the only Meta calls are ad-*spend* reads. A dealership could compose a post,
schedule it, watch it sit at `scheduled`, and never be told. Not failed, because nothing marked
it failed. Not published, because nothing published it. The vehicle it advertised stayed on the
lot. **Silence was the bug**, and it is the same shape as the Phase 5 finding that the general
ledger had never posted a transaction: a state machine with no engine behind it.

PR 6.2 had already written the vocabulary — `social_posts.status` has allowed `publishing`,
`published`, `partially_published` and `failed` since then, and `social_post_targets` has
carried an `attempts` counter. Nothing had ever written any of them.

**The claim is the database's job.** `social_claim_due_targets` uses `for update skip locked`,
so two workers take disjoint work. Read-then-write in application code has a window in the
middle, and that window is where a customer sees the same post twice. Proven on staging with
six rollback probes: only the due post is claimed (a future-scheduled one is not); a post
awaiting approval is never claimed; a held lease returns nothing to a second worker; an expired
lease is reclaimed with `attempts` incremented; a target with an `external_post_id` is never
re-claimed; and a duplicate provider id is refused by a unique index rather than by hope. This
is the **fourth database-owned control layer**, alongside the RO state machine, the journal
posting triggers and the accounting period lock.

**`published` requires evidence.** A target is published only when a provider returned an id
for something it created. No adapter, no credentials, a throw, or a success with no id are all
failures carrying a reason written for a person. `applyTargetOutcome` refuses to write
`published` even when handed `{ ok: true }` with no id — because "published" is a claim to the
dealership that their inventory is in front of customers, and making that claim falsely is
worse than admitting we could not send it.

**No provider adapter ships in this slice, deliberately.** Each network is its own OAuth app,
review process and publishing semantics. What ships is the boundary plus the honest failure: a
dealership on staging today gets *"MarketSync cannot publish to facebook yet — no integration
is connected. Nothing was sent."* — visible, in the queue, with a reason, instead of a post
that quietly never happens. `social_post_stuck` surfaces the old silent case directly.

**Studio** is a library, not an editor: `marketing_assets` reusing the existing
`vehicle-photos` bucket and WebP encode rather than growing a second image pipeline. Deletes
are soft, because a post that already went out still shows the image it was published with.

Authorization is re-checked **at publish time**, not trusted from compose time — a grant can be
withdrawn between scheduling a post and it reaching customers, and that later moment is the one
that matters. A target the user may no longer publish to is `skipped`, not `failed`: nothing
broke, the permission changed, and the queue should say which.

**Deferred, honestly:** the provider adapters themselves (Meta, Instagram, TikTok, LinkedIn),
video assets beyond the `kind` column, and per-network content validation (aspect ratios,
length caps) — the composer records dimensions so that check has something to run on later.

### PR 6.7 — Sales video messaging *(this PR)*

**Owned by Sales, not Marketing.** A rep recording a walkaround for one customer about one
vehicle is a sales conversation. It is gated on `customer.view` / `customer.edit`, and it
reuses the Phase 6 consent gate rather than becoming a campaign.

**The rule: fetching a link is not watching a video.** Outlook Safe Links, Gmail's proxy, SMS
previewers and security scanners fetch a URL the moment it is delivered. Counting those as
views would tell a rep *"your customer watched it twice"* about someone who never opened it —
and reps act on that, calling people who did nothing. It would be a lie the product told every
single day. So a page load records `link_opened` and nothing more; only `play_started`, which
requires JavaScript and a real playback event, begins a watch. The rep-facing summary for a
merely-fetched link says so in words: *"often an email scanner, not the customer."*

Proven on staging: three `link_opened` events left the video at `sent`, `play_count` 0,
`watched_seconds` 0. A real play that scrubbed back to 10s after reaching 30s recorded
`watched` at 30s / 50% — the furthest point reached, not the sum of pings, so rewatching does
not inflate the number. The summary is recomputed **by a database trigger** on every event, so
what a rep sees and the evidence behind it cannot drift apart; a UI keeping its own counters
would drift, and drift always favours looking busy.

**The share link** is an unguessable token, never the row id, so a leaked link cannot be walked
to another customer's video. It expires (60 days, enforced on read rather than by a sweeper).
The public payload carries the rep's **first name** and the vehicle — never the customer's own
record, because a leaked link must not become a way to read someone's CRM entry.

**A finding along the way:** staging had only one storage bucket (`staff-documents`).
`vehicle-photos` and `vehicle-pdfs` — referenced throughout the codebase since long before
Phase 6 — did not exist there, and nothing creates buckets at runtime, so **every vehicle-photo
upload has been failing on staging**. Created all three (plus `sales-videos`) with explicit
size and MIME limits.

**Deferred:** in-browser recording (the uploader accepts a file; `getUserMedia` capture is its
own piece of work), server-side transcoding and poster-frame extraction, and actually
delivering the SMS/email — sending records the consent basis and marks the video sent, but the
message itself rides the existing sender work rather than growing a second one here.

### PR 6.8 — Reputation: asking for reviews, honestly *(this PR)*

**Scope note:** the roadmap slice reads "Website / Reputation". The dealer website already
exists and works (`routes/site.js`, `submodules/site-public.js`); **Reputation did not exist at
all** — no reviews, no requests, no model. This PR does Reputation. Website remains open.

**The decision: no review gating.** The standard dealer "reputation management" feature asks
the customer how they feel first, then sends happy customers to Google and routes unhappy ones
to a private form. The FTC has acted on it and it breaches Google's own policies — but the
reason not to build it is simpler than either: it manufactures a rating that is not true, and
every dealer who buys it is buying a liability nobody told them about.

That decision is **structural, not a policy note somebody can ignore**:

- A request is created from an **event** — a delivery, a closed repair order — and the route
  refuses one that does not name the visit it follows. There is no `sentiment` field, no
  `expected_rating`, and no pre-screen question, because there is no point in the flow where
  sentiment *could* be consulted. The tests assert the **absence** of that path deliberately,
  since a change adding it back would look like a helpful feature request.
- Every request carries the public review link **and** the private-feedback route together.
  The private option is an addition offered to everyone, never a diversion for the unhappy.
- Suppression exists, because there are real reasons not to ask. Every one of them must be
  written down: a database check refuses a suppression with no reason, and suppression only
  applies to a request that has not gone out — it cannot retroactively hide an ask.
- `askEligibility()` is where a gate would live if the product had one, so it is written to be
  checkable: consent and timing only, and a test asserts no rating or score appears in it.

**Not nagging is part of the same honesty.** A unique index enforces one ask per customer per
event, and a 90-day cooldown covers the rest. Both proven on staging: a reasonless suppression
was refused by check violation, and a second ask for the same event by unique violation.

**A review is somebody else's statement.** The dealership owns its reply and nothing else —
there is no route that edits a review, and a test asserts the reply path writes only
`response_body` / `responded_at` / `responded_by`.

**The average never hides what is behind it.** A 4.2 built from fifty 5s and twelve 1s is a
different dealership from a 4.2 of steady 4s, and only one has a problem to fix, so
`ratingSummary` reports the detractor count alongside the average and says so in words. An
empty record reports `average: null` — an average of nothing is not zero stars.

`reputationAttention` is composed into `/marketing/attention`, which now merges four sources.

**Deferred:** importing reviews from Google/Facebook (each is its own integration — the schema
and the dedupe index are ready), the private-feedback landing page, and actually delivering the
request message, which rides the existing sender rather than growing a second one.

### PR 6.9 — The dealer website, wired to Phase 6 truth *(this PR)*

The website already worked — settings, custom domain, blog, public site, lead forms, booking,
chat, all rate-limited. What it did not do was **tell the rest of the system anything**.

**The finding, in the same shape as the rest of this phase:** PR 6.1 gave `leads` and
`contacts` a `campaign_id` and a `source_key`. PR 6.3 built a consent gate that can read
express consent. The front door — where nearly every customer actually arrives — wrote **none
of them**. So every website lead attributed as *inferred*, the campaign that paid for the click
was dropped on arrival, and every customer who typed their number into a contact form resolved
as `implied`, the weakest basis there is.

**Attribution.** A visit links to a campaign by its **id** (`?c=<uuid>`), never by matching a
`utm_campaign` string against campaign names — two campaigns called "Summer Sale" a year apart
is precisely the defect 6.1 removed. A cross-tenant or deleted id is ignored rather than
honoured, so a crafted link cannot attribute a lead to another dealership's campaign. No id
means `campaign_id` stays null and the lead is honestly *inferred* from its source string:
unknown beats a plausible guess. The attribution is carried onto the contact **only when
blank** — a customer's first campaign is the one that earned them, and a later visit must not
overwrite it.

**Consent.** `mayContact` has been able to READ express consent since 6.3 and nothing had ever
written it, so `recordConsent()` is the missing counterpart. A form submission records consent
for the channels the customer actually volunteered — email if they gave an email, sms and phone
if they gave a number — with real evidence: the form type, the IP, the user agent, the time. A
malformed IP is dropped rather than allowed to fail the `inet` column and take the whole record
with it, and an evidence write that fails is logged, never thrown: losing the dealership's lead
over an audit row is the worse outcome by far.

**Deferred:** surfacing campaign links in the Marketing workspace (a link builder that emits
`?c=<id>` is a small UI, and the resolver it would feed is done), and first-touch vs last-touch
attribution, which the timeline supports but which is a reporting decision rather than a
capture one.

### PR 6.10 — Insights, cross-department My Day, and Marketing E2E *(this PR — Phase 6 closes)*

**My Day is now one queue across departments**, composed from the six attention builders Phase 6
produced — `campaignAttention`, `socialAttention`, `reputationAttention`,
`conversationAttention`, `salesVideoAttention`, `accountingExceptions`. It derives nothing of
its own; that was the design from 6.5 and it holds.

Three decisions, each a direct application of the rules added to AGENTS.md this phase:

**Permission is checked per SOURCE, not per endpoint.** My Day spans departments, so a single
endpoint gate could only ever do one of two wrong things: leak accounting exceptions to a
salesperson, or hide them from a controller. Each source names its own permission and is not
even *loaded* when the caller lacks it — the loader never runs, rather than running and having
its output filtered. A permission lookup that throws is treated as refusal; failing open is how
data crosses departments.

**A source that fails is reported as failed.** This is A20's "empty success is a failure mode"
in its most literal form: a morning that looks calm because Accounting timed out is worse than
one that says *"This day is incomplete — Accounting could not be loaded."* `complete: false`
and the banner are part of the answer, not an error path. An all-quiet day and a broken day
produce the same empty list and must never look the same.

**Departments with no builder are named out loud.** `not_covered` lists Service, Parts,
Inventory, F&I and People. Someone whose whole job is Service must not be told their day is
clear by a queue that was never able to see Service.

**Normalization, because one source predates the contract.** `accountingExceptions` carries no
`subject`; composing it raw would have rendered blank rows. Every item is normalized —
subject synthesised from what the source does carry, severity clamped rather than trusted, the
**owner preserved** so a gross gap noticed by Marketing is still owned by Accounting.

**The E2E** (`test/marketing-e2e.test.js`) walks all five Phase 6 chains and asserts the
**joins**, which is where every defect this phase found was actually hiding: website form →
contact → campaign id → consent → reachable · approve → due → claim → provider → published ·
send → fetched → played → watched · visit → ask → both destinations → honest rating · six
departments → one day. Where a link is a pure function it is executed; where it is a database
contract it is asserted against the applied migration.

**Deferred:** a dedicated cross-department home surface. The composed day is currently rendered
in the Marketing workspace's My Day tab, which is the surface that exists; giving it its own
top-level home is a navigation decision, not a data one, and the endpoint is ready for it.
