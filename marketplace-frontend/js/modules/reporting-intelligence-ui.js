/**
 * MarketSync Reporting Intelligence UI.
 * Dropdowns compile through /reporting/lab. Values come from /reporting/query.
 */
(function (global) {
  'use strict'

  const DEPTS = [
    { id: 'executive', label: 'Executive', icon: 'fa-gauge-high', blurb: 'Store pulse: units, gross, close rate, ROAS, AI cost.' },
    { id: 'sales', label: 'Sales', icon: 'fa-car', blurb: 'Units, revenue, front gross, show rate, productivity.' },
    { id: 'inventory', label: 'Inventory', icon: 'fa-warehouse', blurb: 'Days to sell, turn, market position, VDP views.' },
    { id: 'crm', label: 'CRM & Follow-Up', icon: 'fa-address-book', blurb: 'Response time, appointments, untouched leads, overdue tasks.' },
    { id: 'marketing', label: 'Marketing', icon: 'fa-bullhorn', blurb: 'ROAS, CAC, CPL, cost per appointment and sale.' },
    { id: 'website', label: 'Website', icon: 'fa-globe', blurb: 'VDP views, leads per vehicle, close rate.' },
    { id: 'fni', label: 'F&I', icon: 'fa-file-signature', blurb: 'Penetration, back gross, product mix.' },
    { id: 'service', label: 'Service', icon: 'fa-wrench', blurb: 'RO revenue, labour rate, technician efficiency.' },
    { id: 'parts', label: 'Parts', icon: 'fa-gears', blurb: 'Parts turn and service-attached parts dollars.' },
    { id: 'accounting', label: 'Accounting', icon: 'fa-calculator', blurb: 'Revenue, front/back/total gross, AI cost.' },
    { id: 'people', label: 'People', icon: 'fa-users', blurb: 'Productivity, close rate, follow-up, video send rate.' },
    { id: 'customers', label: 'Customers', icon: 'fa-heart', blurb: 'LTV, repeat vs new, cohort performance.' },
    { id: 'communications', label: 'Communications', icon: 'fa-video', blurb: 'Video send, view, and video-to-sale rates.' },
    { id: 'automations', label: 'Automations & AI', icon: 'fa-robot', blurb: 'Automation ROI, AI cost, AI-influenced revenue.' }
  ]

  function apiBase() {
    if (global.MS_API_BASE) return global.MS_API_BASE.replace(/\/$/, '')
    const host = global.location && global.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:10000'
    if (host && host.includes('staging')) return 'https://marketsync-staging-backend.onrender.com'
    return 'https://vehicle-marketplace-s0e4.onrender.com'
  }

  function token() {
    try { return localStorage.getItem('token') || '' } catch (e) { return '' }
  }

  async function req(path, opts) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {})
    const t = token()
    if (t) headers.Authorization = 'Bearer ' + t
    const res = await fetch(apiBase() + path, Object.assign({}, opts, { headers }))
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = new Error(body.error || body.message || ('HTTP ' + res.status))
      err.code = body.code
      err.status = res.status
      throw err
    }
    return body
  }

  function optionList(items, valueKey, labelKey, selected) {
    return '<option value="">— none —</option>' + items.map((item) => {
      const v = typeof item === 'string' ? item : item[valueKey]
      const l = typeof item === 'string' ? item : (item[labelKey] || item.display_name || item.id)
      return `<option value="${esc(v)}"${selected === v ? ' selected' : ''}>${esc(labelize(l))}</option>`
    }).join('')
  }

  function labelize(s) {
    return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]))
  }

  function formatValue(group) {
    if (group == null || group.value == null) return '—'
    if (group.unit === 'money') return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(group.value)
    if (group.unit === 'percent') return group.value + '%'
    return String(group.value)
  }

  function renderTable(result) {
    const groups = (result && result.groups) || []
    if (!groups.length) return '<p class="ri-empty">No rows in this window. Connect live data on staging to fill the grid.</p>'
    const dimKeys = Object.keys(groups[0].dimensions || {})
    const head = dimKeys.map((k) => `<th>${esc(labelize(k))}</th>`).join('') + '<th>Value</th><th>Sample</th>'
    const rows = groups.map((g) => {
      const cells = dimKeys.map((k) => `<td>${esc(g.dimensions[k])}</td>`).join('')
      return `<tr>${cells}<td class="ri-num">${esc(formatValue(g))}</td><td>${esc(g.sample_size ?? '')}</td></tr>`
    }).join('')
    return `<div class="ri-table-wrap"><table class="ri-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
  }

  function deptById(id) {
    return DEPTS.find((d) => d.id === id) || { id: id, label: labelize(id), icon: 'fa-chart-line', blurb: '' }
  }

  async function loadCatalog() {
    try {
      return await req('/reporting/catalog')
    } catch (err) {
      return { ok: false, offline: true, error: err.message, metrics: [], dimensions: [], visualizations: ['kpi', 'table', 'bar', 'line', 'heatmap', 'funnel'], comparisons: ['prior_period', 'prior_year', 'benchmark'] }
    }
  }

  function bindLab(root, catalog) {
    const metrics = catalog.metrics || []
    const dims = catalog.dimensions || []
    const viz = catalog.visualizations || ['table', 'bar', 'line', 'kpi']
    const cmp = catalog.comparisons || ['prior_period', 'prior_year']
    const dimOpts = optionList(dims, 'id', 'id')

    root.querySelector('#ri-metric').innerHTML = optionList(metrics, 'id', 'display_name', 'units_sold')
    ;[1, 2, 3, 4, 5].forEach((n) => {
      const sel = root.querySelector('#ri-dim' + n)
      if (sel) sel.innerHTML = dimOpts
    })
    root.querySelector('#ri-viz').innerHTML = optionList(viz.map((v) => ({ id: v, display_name: labelize(v) })), 'id', 'display_name', 'table')
    root.querySelector('#ri-compare').innerHTML = optionList(cmp.map((v) => ({ id: v, display_name: labelize(v) })), 'id', 'display_name')

    const metricSel = root.querySelector('#ri-metric')
    function filterDims() {
      const m = metrics.find((x) => x.id === metricSel.value)
      const allowed = new Set((m && m.allowed_dimensions) || dims.map((d) => d.id))
      ;[1, 2, 3, 4, 5].forEach((n) => {
        const sel = root.querySelector('#ri-dim' + n)
        if (!sel) return
        const keep = sel.value
        sel.innerHTML = optionList(dims.filter((d) => allowed.has(d.id)), 'id', 'id', keep)
      })
    }
    metricSel.addEventListener('change', filterDims)
    filterDims()

    async function compileAndRun() {
      const status = root.querySelector('#ri-status')
      const out = root.querySelector('#ri-results')
      status.textContent = 'Compiling…'
      const payload = {
        metric: metricSel.value,
        dimension1: root.querySelector('#ri-dim1').value,
        dimension2: root.querySelector('#ri-dim2').value,
        dimension3: root.querySelector('#ri-dim3').value,
        dimension4: root.querySelector('#ri-dim4').value,
        dimension5: root.querySelector('#ri-dim5').value,
        visualization: root.querySelector('#ri-viz').value || 'table',
        comparison: root.querySelector('#ri-compare').value || null,
        days: Number(root.querySelector('#ri-days').value || 30),
        filters: {},
        name: root.querySelector('#ri-name').value || undefined
      }
      const used = root.querySelector('#ri-used')
      if (used && used.checked) payload.filters.new_used = 'used'
      try {
        const compiled = await req('/reporting/lab', { method: 'POST', body: JSON.stringify(payload) })
        status.textContent = 'Running query…'
        let query
        try {
          query = await req('/reporting/query', { method: 'POST', body: JSON.stringify({
            metric_ids: compiled.plan.metric_ids,
            dimensions: compiled.plan.dimensions,
            filters: compiled.plan.filters,
            date_range: compiled.plan.date_range,
            comparison: compiled.plan.comparison,
            visualization: compiled.plan.visualization
          }) })
        } catch (qerr) {
          query = { results: [{ metric_id: compiled.plan.metric_ids[0], groups: [] }], note: qerr.message }
        }
        const planBits = compiled.plan.dimensions.length
          ? compiled.plan.dimensions.map(labelize).join(' × ')
          : 'store totals'
        out.innerHTML = `
          <div class="ri-plan">
            <strong>${esc(compiled.definition.name)}</strong>
            <span>${esc(labelize(compiled.plan.metric_ids[0]))} by ${esc(planBits)}</span>
            <span class="ri-pill">${esc(compiled.plan.visualization)}</span>
          </div>
          ${(query.results || []).map(renderTable).join('')}
          <p class="ri-hint">Formulas stay locked in the metric registry. Values are read from this dealership's canonical live records.</p>`
        status.textContent = compiled.ok ? 'Ready' : 'Check plan'
        root._lastDefinition = compiled.definition
      } catch (err) {
        status.textContent = 'Blocked'
        out.innerHTML = `<div class="ri-error">${esc(err.message)}${err.code ? ' (' + esc(err.code) + ')' : ''}</div>
          <p class="ri-hint">Only approved metric IDs and up to five dimensions can be combined. The AI and this lab cannot invent formulas.</p>`
      }
    }

    root.querySelector('#ri-run').addEventListener('click', compileAndRun)
    root.querySelector('#ri-save').addEventListener('click', async () => {
      const status = root.querySelector('#ri-status')
      if (!root._lastDefinition) {
        status.textContent = 'Run the report first'
        return
      }
      try {
        await req('/reporting/saved', { method: 'POST', body: JSON.stringify({ definition: root._lastDefinition, name: root.querySelector('#ri-name').value }) })
        status.textContent = 'Saved to this rooftop'
      } catch (err) {
        status.textContent = err.message
      }
    })
  }

  function renderDeptCards(mount) {
    mount.innerHTML = DEPTS.map((d) => `
      <a class="ri-card" href="/reporting.html?dept=${esc(d.id)}">
        <i class="fa-solid ${esc(d.icon)}"></i>
        <h3>${esc(d.label)}</h3>
        <p>${esc(d.blurb)}</p>
        <span>Open department →</span>
      </a>`).join('')
  }

  async function renderDepartment(root, deptId) {
    const dept = deptById(deptId)
    root.querySelector('#ri-dept-title').textContent = dept.label + ' reports'
    root.querySelector('#ri-dept-blurb').textContent = dept.blurb
    const list = root.querySelector('#ri-report-list')
    const search = root.querySelector('#ri-search')
    let reports = []
    try {
      const data = await req('/reporting/reports?department=' + encodeURIComponent(deptId))
      reports = data.reports || []
      root.querySelector('#ri-count').textContent = reports.length + ' definitions'
    } catch (err) {
      root.querySelector('#ri-count').textContent = 'Catalog unavailable'
      list.innerHTML = `<div class="ri-error">${esc(err.message)}. Sign in on staging and confirm the reporting routes are deployed.</div>`
      return
    }

    function paint() {
      const q = (search.value || '').toLowerCase()
      const filtered = reports.filter((r) => !q || (r.name || '').toLowerCase().includes(q) || (r.metric_ids || []).join(' ').includes(q))
      list.innerHTML = filtered.slice(0, 80).map((r) => `
        <a class="ri-report" href="/dashboard.html?report=${encodeURIComponent(r.id)}#/p/reports" data-id="${esc(r.id)}">
          <strong>${esc(r.name)}</strong>
          <span>${esc((r.metric_ids || []).map(labelize).join(', '))}</span>
          <em>${esc((r.default_dimensions || []).map(labelize).join(' × ') || 'Store totals')} · ${esc(r.visualization || 'table')}</em>
        </a>`).join('') + (filtered.length > 80 ? `<p class="ri-hint">Showing 80 of ${filtered.length}. Narrow the search.</p>` : '')
      list.querySelectorAll('.ri-report').forEach((btn) => {
        btn.addEventListener('click', (event) => { event.preventDefault(); runSaved(rById(btn.getAttribute('data-id'))) })
      })
    }

    function rById(id) { return reports.find((r) => r.id === id) }

    async function runSaved(report) {
      if (!report) return
      const out = root.querySelector('#ri-dept-results')
      out.innerHTML = '<p class="ri-hint">Running ' + esc(report.name) + '…</p>'
      try {
        const query = await req('/reporting/query', { method: 'POST', body: JSON.stringify({
          metric_ids: report.metric_ids,
          dimensions: report.default_dimensions,
          visualization: report.visualization
        }) })
        out.innerHTML = `<h3>${esc(report.name)}</h3>${(query.results || []).map(renderTable).join('')}`
      } catch (err) {
        out.innerHTML = `<div class="ri-error">${esc(err.message)}</div>`
      }
    }

    search.addEventListener('input', paint)
    paint()
  }

  async function boot() {
    const mode = document.body.getAttribute('data-ri-mode') || 'hub'
    const catalog = await loadCatalog()
    if (mode === 'lab') {
      bindLab(document.getElementById('ri-app'), catalog)
      return
    }
    if (mode === 'dept') {
      const dept = new URLSearchParams(location.search).get('dept') || document.body.getAttribute('data-ri-dept') || 'sales'
      await renderDepartment(document.getElementById('ri-app'), dept)
      return
    }
    renderDeptCards(document.getElementById('ri-dept-grid'))
  }

  global.MSReportingUI = { DEPTS, boot, loadCatalog, deptById }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})(typeof window !== 'undefined' ? window : globalThis)
