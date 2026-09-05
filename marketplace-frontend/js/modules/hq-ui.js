/**
 * MarketSync HQ — shared UI primitives.
 *
 * One canonical set of state renderers, headers, badges and table shells for
 * every HQ page. Every async loader must render one of five explicit states
 * (loading / empty / error / forbidden / not-connected) rather than
 * silently converting an API failure into an empty list — Phase 5 of the HQ
 * finalization brief.
 *
 * Design tokens follow MarketSync brand: Market Blue (#2563EB) accents,
 * slate neutrals, Manrope headings via existing global CSS. All helpers
 * work in light and dark mode without extra classes on the caller.
 *
 * All output escapes untrusted values through the global `esc()` from
 * dashboard.js. Callers must NOT interpolate raw API strings into helper
 * args; helpers do the escape.
 */

(function () {
  'use strict'

  const e = (s) => (typeof esc === 'function' ? esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])))

  // ─── State primitives ──────────────────────────────────────────────────────

  function hqLoading(msg) {
    return `<div class="hq-state hq-state--loading" role="status" aria-live="polite">
      <div class="hq-state__spinner" aria-hidden="true"></div>
      <div class="hq-state__msg">${e(msg || 'Loading…')}</div>
    </div>`
  }

  function hqEmpty(opts) {
    const o = opts || {}
    const title = o.title || 'Nothing here yet'
    const msg = o.message || ''
    const actionHtml = o.actionHtml || ''
    return `<div class="hq-state hq-state--empty" role="status">
      <div class="hq-state__title">${e(title)}</div>
      ${msg ? `<div class="hq-state__msg">${e(msg)}</div>` : ''}
      ${actionHtml || ''}
    </div>`
  }

  function hqError(err, opts) {
    const o = opts || {}
    const raw = (err && (err.message || err.error)) || String(err || 'Something went wrong')
    // Detect auth failures relayed through fetch wrappers so we can render the
    // right state instead of a generic red error.
    const auth = /401|403|forbidden|unauthorized|not authorised/i.test(raw)
    if (auth) return hqForbidden({ detail: raw })
    return `<div class="hq-state hq-state--error" role="alert">
      <div class="hq-state__title">${e(o.title || 'This page could not load')}</div>
      <div class="hq-state__msg">${e(raw)}</div>
      ${o.onRetry ? `<button type="button" class="hq-state__retry" onclick="${o.onRetry}">Try again</button>` : ''}
    </div>`
  }

  function hqForbidden(opts) {
    const o = opts || {}
    return `<div class="hq-state hq-state--forbidden" role="alert">
      <div class="hq-state__title">${e(o.title || 'You don’t have access to this HQ area')}</div>
      <div class="hq-state__msg">${e(o.detail || 'Ask a platform owner to grant the required role and try again.')}</div>
    </div>`
  }

  function hqNotConnected(opts) {
    const o = opts || {}
    return `<div class="hq-state hq-state--notconnected" role="status">
      <div class="hq-state__title">${e(o.title || 'Not connected')}</div>
      <div class="hq-state__msg">${e(o.message || 'This data source has not been configured yet.')}</div>
      ${o.actionHtml || ''}
    </div>`
  }

  // ─── Chrome + content primitives ───────────────────────────────────────────

  function hqPageHeader(title, subtitle, opts) {
    const o = opts || {}
    return `<header class="hq-page-header">
      <div class="hq-page-header__text">
        <h1 class="hq-page-header__title">${e(title)}</h1>
        ${subtitle ? `<p class="hq-page-header__subtitle">${e(subtitle)}</p>` : ''}
      </div>
      ${o.actionsHtml ? `<div class="hq-page-header__actions">${o.actionsHtml}</div>` : ''}
    </header>`
  }

  // Small "Powered by MarketSync" ribbon for shared studios/tools that are
  // also going to be sold standalone. Renders once per page container.
  function hqPoweredByRibbon() {
    return `<div class="hq-powered-by" aria-hidden="true">
      <span class="hq-powered-by__dot"></span>
      <span class="hq-powered-by__text">Powered by MarketSync</span>
    </div>`
  }

  const BADGE_TONES = {
    active:      'hq-badge--good',
    ok:          'hq-badge--good',
    healthy:     'hq-badge--good',
    trialing:    'hq-badge--info',
    trial:       'hq-badge--info',
    pending:     'hq-badge--warn',
    warning:     'hq-badge--warn',
    warn:        'hq-badge--warn',
    past_due:    'hq-badge--danger',
    canceled:    'hq-badge--danger',
    cancelled:   'hq-badge--danger',
    error:       'hq-badge--danger',
    inactive:    'hq-badge--muted',
    unknown:     'hq-badge--muted',
    off:         'hq-badge--muted',
  }

  function hqBadge(label, tone) {
    const key = String(tone || label || '').toLowerCase().replace(/\s+/g, '_')
    const cls = BADGE_TONES[key] || 'hq-badge--muted'
    return `<span class="hq-badge ${cls}">${e(label || '—')}</span>`
  }

  // Simple KPI tile. Falls back to "not measured" when value is null/undefined.
  function hqKpi(label, value, opts) {
    const o = opts || {}
    const isMissing = value == null || value === ''
    const display = isMissing ? 'Not measured' : String(value)
    const cls = isMissing ? 'hq-kpi__value hq-kpi__value--missing' : 'hq-kpi__value'
    return `<div class="hq-kpi">
      <div class="hq-kpi__label">${e(label)}</div>
      <div class="${cls}">${e(display)}</div>
      ${o.hint ? `<div class="hq-kpi__hint">${e(o.hint)}</div>` : ''}
    </div>`
  }

  // Table shell. cols: [{key, label, align?, render?(row)}]; rows: array.
  // Renders explicit empty state instead of "nothing" when there are no rows.
  function hqTable(cols, rows, opts) {
    const o = opts || {}
    if (!Array.isArray(rows) || rows.length === 0) {
      return hqEmpty({ title: o.emptyTitle || 'No rows to show', message: o.emptyMessage })
    }
    const head = cols.map(c => `<th class="hq-table__th${c.align === 'right' ? ' hq-table__th--right' : ''}">${e(c.label)}</th>`).join('')
    const body = rows.map(r => {
      const tds = cols.map(c => {
        const raw = typeof c.render === 'function' ? c.render(r) : r[c.key]
        // If a col.render returned HTML, trust it (author is opting in);
        // otherwise escape.
        const cell = typeof c.render === 'function' ? String(raw == null ? '' : raw) : e(raw == null ? '—' : raw)
        return `<td class="hq-table__td${c.align === 'right' ? ' hq-table__td--right' : ''}">${cell}</td>`
      }).join('')
      return `<tr class="hq-table__tr">${tds}</tr>`
    }).join('')
    return `<div class="hq-table-wrap">
      <table class="hq-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>`
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  window.hqLoading = hqLoading
  window.hqEmpty = hqEmpty
  window.hqError = hqError
  window.hqForbidden = hqForbidden
  window.hqNotConnected = hqNotConnected
  window.hqPageHeader = hqPageHeader
  window.hqPoweredByRibbon = hqPoweredByRibbon
  window.hqBadge = hqBadge
  window.hqKpi = hqKpi
  window.hqTable = hqTable
})()
