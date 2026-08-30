# Dealer site `<head>` injector

Streams real per-dealership metadata into the public dealer site as it is served.

## Why this exists

`site.html` is a client-rendered shell. Title, description, canonical, Open Graph and
schema are written by JavaScript after load, so anything that does not execute JS sees
only the static head:

```html
<title>Inventory</title>
```

No canonical, no description, no schema — and identical for every dealership. That is
what Google, social unfurlers, and MarketSync's own Discoverability crawler currently
receive. It is also why public metadata validation cannot pass for a dealer site, and
why Verified 100 is unreachable for one.

This worker fixes it at the edge, without changing how pages are delivered.

## How it works

```
request → origin (unchanged) → is it a dealer page? → fetch metadata → inject → response
                                        │                    │
                                        └── no ──────────────┴── failed/slow ──→ origin response as-is
```

The metadata is computed by the backend from the same published payload the client
renders from, so the edge holds no business logic and the two cannot drift:

| Situation | Endpoint |
|---|---|
| Hosted URL, e.g. `sites.marketsync.link/site.html?d=abc-motors` | `GET /site/:slug/head-metadata` |
| Connected custom domain, e.g. `abcmotors.com/` | `GET /site-head-metadata?host=` |

Both return the structured metadata plus a ready `head_html` block, and both 404 for a
site that is not published.

## Two rules it will not break

**It never breaks a page.** Every failure path — lookup miss, slow or unreachable API,
malformed response, unexpected exception — returns the origin response untouched. A
site loading without ideal metadata is a bad day; a site not loading is an outage. The
metadata request is capped at 800ms and the result is edge-cached for 5 minutes, so
that budget is only ever spent on a cold miss.

**It serves the same HTML to everyone.** No user-agent branching, no bot-only path.
Showing crawlers something visitors do not get is cloaking, and search engines penalise
it.

## Deploying

Requires Cloudflare access; the account already runs Cloudflare for SaaS for dealer
custom hostnames.

```sh
cd workers/dealer-site-head
npx wrangler deploy --env staging     # verify on staging first
npx wrangler deploy                   # production
```

Set `API_ORIGIN` and `PUBLIC_SITE_HOST` in `wrangler.toml` to the real hosts before the
first deploy — the values committed there are placeholders in the expected shape, not
confirmed hostnames.

### Routes

Routes are deliberately **not** committed. Dealer custom domains are provisioned at
runtime through Cloudflare for SaaS (`cfCreateHostname` in
`marketplace-backend/routes/site.js`), so the hostname set changes whenever a dealership
connects a domain; a committed list would go stale immediately.

Bind the worker to:

1. the hosted public-site route (the host serving `site.html`), and
2. the Cloudflare for SaaS custom-hostname fallback origin, so connected dealer domains
   are covered as they are added.

### Verifying it worked

```sh
curl -s "https://<dealer-domain>/" | grep -iE '<title>|canonical|og:title'
```

Before: `<title>Inventory</title>` and nothing else.
After: the dealership's real title, description, canonical and Open Graph tags.

The Discoverability crawler is the honest check — once this is live, publish a dealer
site and the validation job should transition to `validated` instead of failing on
absent metadata.

## Tests

The decision logic is pure and covered in
`marketplace-backend/test/dealer-site-head-worker.test.js`: which requests are dealer
pages, which are left alone, and how each resolves to an endpoint. The HTMLRewriter
call itself is a thin edge-only wrapper and is exercised by deploying to staging.
