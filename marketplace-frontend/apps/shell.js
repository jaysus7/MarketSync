/**
 * MarketSync Standalone Apps — shared boot.
 *
 * One file, no dependencies. Every /apps/*.html loads this and calls
 * MarketSyncApp.mount({...}) to render its header + hero + main slot.
 *
 * Explicitly does NOT depend on the DealerOS dashboard.js bundle — the
 * whole point is that these apps are usable without a dealership.
 */

(function () {
  'use strict'

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  function header(opts) {
    const meta = opts.stage === 'live'
      ? 'Live app'
      : (opts.stage === 'dealeros'
        ? 'Available in DealerOS today'
        : 'Standalone product')
    return `<header class="app-header">
      <a href="/apps/" class="app-header__brand">
        <span class="app-header__mark"></span> MarketSync
      </a>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <span class="app-header__meta">${esc(meta)}</span>
        <a href="/dashboard.html" class="app-header__signin">Sign in</a>
      </div>
    </header>`
  }

  function hero(opts) {
    return `<section class="app-hero">
      ${opts.eyebrow ? `<div class="app-hero__eyebrow">${esc(opts.eyebrow)}</div>` : ''}
      <h1 class="app-hero__title">${esc(opts.title)}</h1>
      ${opts.subtitle ? `<p class="app-hero__sub">${esc(opts.subtitle)}</p>` : ''}
    </section>`
  }

  function footer() {
    return `<footer class="app-footer">
      <div>© MarketSync · <a href="/apps/">All products</a> · <a href="/dashboard.html">Sign in</a></div>
    </footer>`
  }

  // Render the standard shell for an app page and hand back a mount point
  // for page-specific content.
  function mount(opts) {
    const o = opts || {}
    document.title = (o.title || 'MarketSync') + ' — MarketSync'
    const app = document.getElementById('app-root') || (() => {
      const div = document.createElement('div'); div.id = 'app-root'; document.body.appendChild(div); return div
    })()
    app.innerHTML = `
      ${header(o)}
      ${o.hideHero ? '' : hero(o)}
      <main class="app-container" id="app-main"></main>
      ${footer()}
    `
    const main = document.getElementById('app-main')
    if (typeof o.render === 'function') o.render(main)
    return main
  }

  // Standard "coming soon / use in DealerOS today" content used by every
  // launcher whose target module hasn't been extracted from the dashboard
  // bundle yet. Honest, mobile-first, mounts a real waitlist form.
  function dealerOsAvailable(opts) {
    const o = opts || {}
    return `<div class="app-card">
      <h2 class="app-card__title">${esc(o.usableTitle || 'Ready to use today in DealerOS')}</h2>
      <p class="app-card__msg">${esc(o.usableMsg || 'This tool ships inside your DealerOS account right now. Sign in and open it from your workspace nav.')}</p>
      <a class="app-btn app-btn--primary app-btn--full" href="/dashboard.html">Open in DealerOS</a>
    </div>
    <div class="app-card">
      <h2 class="app-card__title">Standalone app · coming soon</h2>
      <p class="app-card__msg">${esc(o.standaloneMsg || 'A single-user standalone version of this app is on the way — no dealership required. Join the waitlist and we\'ll let you know the moment it opens.')}</p>
      <form id="app-waitlist" onsubmit="return MarketSyncApp.joinWaitlist(event, '${esc(o.slug || '')}')">
        <input required type="email" name="email" placeholder="you@example.com" autocomplete="email"
          style="width:100%;padding:0.75rem 1rem;border-radius:0.75rem;border:1px solid var(--app-border);background:var(--app-surface-soft);color:var(--app-text);font-size:1rem;margin-bottom:0.75rem" />
        <button class="app-btn app-btn--primary app-btn--full" type="submit">Join the waitlist</button>
      </form>
      <div id="app-waitlist-result" style="margin-top:0.75rem;font-size:0.875rem;color:var(--app-text-soft)"></div>
    </div>`
  }

  async function joinWaitlist(evt, slug) {
    evt.preventDefault()
    const email = evt.target?.email?.value?.trim() || ''
    const out = document.getElementById('app-waitlist-result')
    if (!email) return false
    // Post to a public waitlist endpoint. If the endpoint isn't there yet,
    // fall back to a mailto so the user can still reach us — never a
    // silent no-op.
    try {
      const res = await fetch('/api/apps/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, product: slug || 'unknown', source: 'apps' }),
      })
      if (res.ok) {
        if (out) out.textContent = 'Thanks — you\'re on the list. We\'ll email you.'
        evt.target.reset()
        return false
      }
      throw new Error('endpoint unavailable')
    } catch {
      if (out) {
        out.innerHTML = 'Waitlist endpoint isn\'t reachable from here yet — email us at <a href="mailto:hello@marketsync.link?subject=Waitlist:%20' +
          encodeURIComponent(slug || '') + '&body=Please%20add%20' + encodeURIComponent(email) +
          '%20to%20the%20' + encodeURIComponent(slug || '') + '%20waitlist.">hello@marketsync.link</a> and we\'ll add you.'
      }
    }
    return false
  }

  window.MarketSyncApp = { mount, dealerOsAvailable, joinWaitlist, esc }
})()
