# MarketSync

**Post your entire dealership inventory to Facebook Marketplace in about 60 seconds per vehicle.**

MarketSync is a web app + Chrome extension that helps car dealerships and independent
auto sales reps list their whole lot on Facebook Marketplace without hours of manual data
entry. It auto-syncs inventory from the dealer's existing website, auto-fills every
Marketplace listing field, tracks which rep sold which vehicle, and ranks the sales team
on a gamified leaderboard — plus AI listing copy, trade appraisals, VIN window stickers,
live price-to-market intelligence, and CRM lead delivery.

> A human always clicks **Post** — MarketSync never auto-posts or spams, so it stays within
> Facebook's rules. Not affiliated with Meta or Facebook.

Live site: <https://marketsync.link>

---

## What it does

- **Inventory sync** — Reads a dealer's website inventory automatically (Schema.org
  structured data or a smart detector). No manual setup or code.
- **One-click Facebook Marketplace posting** — The Chrome extension fills in year, make,
  model, price, mileage, color, photos, and description. The user only clicks *Post*.
- **Sold tracking (three ways)** — "I Sold It" (+500 pts), "Sold by Other" (tracked, no
  points), and Facebook Auto-Detect (the extension notices when FB marks a listing sold).
- **Gamified leaderboard** — Reps earn 100 pts per vehicle posted and 500 pts per sale,
  climbing tiers: Bronze → Silver → Gold → Platinum → Diamond → Legend.
- **AI listing copy** — One-click polished Marketplace descriptions in any language and tone.
- **Trade appraisal** — Retail vs. wholesale (ACV) values with disclosure and
  customer-summary PDFs.
- **VIN decoder + window stickers** — Full trim/MSRP/package breakdown and printable stickers.
- **Inventory intelligence** — Turn Rate, health scores, hot/cold movers, aged-unit alerts,
  duplicate-VIN detection, live price-to-market flags, and MarketCheck price prediction.
- **CRM lead delivery & sales pipeline** — Route Marketplace leads to the right rep.
- **Dashboard insights** — Available inventory, listings posted, sold counts, sell-through
  rate, average time to sell, per-rep contribution charts, and team trends.

## Who it's for

- New, used, and fleet car dealerships that want their whole lot on Facebook Marketplace.
- Independent / individual auto sales reps whose dealership hasn't adopted a tool yet.
- United States and Canadian dealerships.

## Pricing

| Plan | Price | For |
|------|-------|-----|
| **Dealer** | $499/mo | The whole dealership — unlimited reps, auto-sync, leaderboard, insights, rep management |
| **Individual Sales Rep** | $79/mo | A single rep working solo |
| AI Boost (add-on) | $129/mo | One-click AI writing on every vehicle |
| Inventory Intelligence (add-on) | $299/mo | Turn Rate, health scores, appraisal, competitor monitoring |

Every account starts with a **7-day free trial, no credit card required**. Month-to-month,
cancel anytime.

---

## Repository layout

```
Vehicle-Marketplace/
├── marketplace-frontend/     Static marketing site + app UI (HTML/Tailwind, deployed to Cloudflare Pages)
│   ├── index.html            Homepage
│   ├── dashboard.html/.js     Signed-in dealer/rep dashboard
│   ├── blog.html, post.html   Blog (content served from the backend API / Supabase)
│   ├── *.html                 SEO landing pages (ai-listing-copy, vin-decoder-window-stickers, …)
│   ├── llms.txt               Product summary for AI crawlers
│   ├── sitemap.xml, robots.txt, _redirects, _headers
│   └── og/, img/              Open Graph and other images
├── marketplace-backend/      Node/Express API (deployed to Render), backed by Supabase (Postgres)
│   ├── server.js             App entry; registers routes
│   ├── routes/               Feature routes (blog, auth, billing, inventory, sync, leads, …)
│   ├── migrations/           SQL migrations — run manually in the Supabase SQL editor
│   ├── puppeteerRenderer.js   PDF/brochure/window-sticker rendering
│   └── passkeys.js, security.js, notifications.js, …
├── marketplace-extension/    Chrome (MV3) extension that fills out Facebook Marketplace
│   ├── manifest.json
│   ├── background.js, content.js, dealer-extract.js, popup.html/.js
│   └── icons/
└── content/posts/            Legacy seed blog post (the live blog reads from Supabase, not here)
```

## Architecture

- **Frontend** — Static HTML styled with Tailwind (CDN), deployed to Cloudflare Pages.
  `_redirects` proxies a few paths (e.g. `/blog/:slug`, `/blog-sitemap.xml`) to the backend
  for server-side-rendered, crawlable pages.
- **Backend** — Express API on Render. Talks to Supabase (Postgres) via the service key.
  Routes are registered in `server.js` from `routes/*.js`.
- **Database** — Supabase Postgres. Schema changes live in `marketplace-backend/migrations/`
  and are applied manually in the Supabase SQL editor (safe to re-run).
- **Extension** — Manifest V3 Chrome extension. Reads the signed-in session from the website
  and fills Facebook Marketplace's listing form; the user clicks Post.

## Local development

### Backend
```bash
cd marketplace-backend
npm install
# Set the required environment variables (see below), then:
node server.js
```

Key environment variables (set in Render or a local `.env`):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Supabase project + admin access |
| `FRONTEND_URL` | Base URL used in generated links (e.g. `https://marketsync.link`) |
| `BLOG_API_KEY` | Shared secret for the n8n → `POST /blog` publishing endpoint |
| `STRIPE_*` | Billing |
| `MARKETCHECK_*` | Market price / intelligence data |

> Run `git grep process.env marketplace-backend` for the full list before deploying.

### Frontend
The frontend is static — open the HTML files directly or serve the folder:
```bash
cd marketplace-frontend
python3 -m http.server 8080
```
The app talks to the deployed backend (the API base is set in the page scripts).

### Extension
1. Visit `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select `marketplace-extension/`.
3. Sign in on the website; the extension picks up the session.

## Database migrations

Migrations are plain SQL in `marketplace-backend/migrations/`, named by date. To apply one,
paste it into the Supabase SQL editor and run it (each is written to be safe to re-run).

## The blog pipeline

Blog posts are **not** stored in the repo — they live in the Supabase `blog_posts` table and
are published by an external **n8n** workflow that calls `POST /blog` with an `x-api-key`
header (`BLOG_API_KEY`). The backend renders crawlable pages at `/ssr/blog/:slug` and a
dynamic `/blog-sitemap.xml`. See `marketplace-backend/routes/blog.js`.

## License

Proprietary — © 2026 MarketSync Technologies Inc. All rights reserved.
