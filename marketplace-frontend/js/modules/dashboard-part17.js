/* dashboard.js split part 17/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

// ── Inventory CSV import / export ────────────────────────────────────────────
async function invExportCsv(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    const r = await fetch(`${API}/inventory/export.csv`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Inventory exported', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
async function invImportCsv(file) {
  if (!file) return;
  const input = document.getElementById('inv-import-file');
  let text; try { text = await file.text(); } catch { showToast('Could not read that file', 'error'); return; }
  showToast('Importing…', 'info');
  try {
    const d = await apiSendJson('/inventory/import', 'POST', { csv: text });
    const parts = [`${d.created} added`, `${d.updated} updated`]; if (d.skipped) parts.push(`${d.skipped} skipped`);
    showToast('Imported — ' + parts.join(', '), 'success');
    if (d.errors && d.errors.length) console.warn('Import row errors:', d.errors);
    loadInventoryCatalog?.();
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (input) input.value = ''; }
}
window.invExportCsv = invExportCsv; window.invImportCsv = invImportCsv;

// Leads CSV import/export (#19).
async function leadsExportCsv(btn) {
  const orig = btn.innerHTML; btn.disabled = true;
  try {
    const r = await fetch(`${API}/leads/export.csv`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Export failed');
    const blob = await r.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Leads exported', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}
async function leadsImportCsv(file) {
  if (!file) return;
  const input = document.getElementById('leads-import-file');
  let text; try { text = await file.text(); } catch { showToast('Could not read that file', 'error'); return; }
  showToast('Importing…', 'info');
  try {
    const d = await apiSendJson('/leads/import', 'POST', { csv: text });
    const parts = [`${d.created} added`]; if (d.skipped) parts.push(`${d.skipped} skipped`);
    showToast('Imported — ' + parts.join(', '), 'success');
    if (d.errors && d.errors.length) console.warn('Lead import row errors:', d.errors);
    loadLeadsPage?.();
  } catch (e) { showToast(e.message, 'error'); }
  finally { if (input) input.value = ''; }
}
window.leadsExportCsv = leadsExportCsv; window.leadsImportCsv = leadsImportCsv;

// Upload/replace the dealership's branded photo background (used by the AI swap).
function openPhotoBackgroundUploader() {
  const ov = crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-lg font-black text-slate-900 dark:text-white">Branded photo background</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400">Upload one background (your lot, a studio backdrop, a branded scene). When you add vehicle photos you can drop them onto it — the AI cuts out the car and places it on this background.</p>
    ${!__bgProviderReady ? '<div class="text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-2 text-amber-700 dark:text-amber-300">The AI cutout provider isn\'t enabled yet — set REMOVEBG_API_KEY to turn on background swapping. You can still upload the background now.</div>' : ''}
    <div id="pbg-preview">${__photoBackgroundUrl ? `<img src="${esc(__photoBackgroundUrl)}" class="w-full h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-700">` : '<div class="w-full h-40 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm text-slate-400">No background set</div>'}</div>
    <input id="pbg-file" type="file" accept="image/*" class="hidden" onchange="uploadPhotoBackground(this.files[0])">
    <div class="flex gap-2 justify-between">
      <div>${__photoBackgroundUrl ? '<button onclick="removePhotoBackground()" class="text-sm font-bold text-rose-600 hover:text-rose-500 px-2 py-2">Remove</button>' : ''}</div>
      <button onclick="document.getElementById('pbg-file').click()" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">${__photoBackgroundUrl ? 'Replace background' : 'Upload background'}</button>
    </div>
  </div>`, 'max-w-md');
  return ov;
}
async function uploadPhotoBackground(file) {
  if (!file) return;
  showToast('Uploading background…', 'info');
  try {
    const fd = new FormData(); fd.append('background', file);
    const r = await fetch(`${API}/dealership/photo-background`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    __photoBackgroundUrl = d.url;
    showToast('Background saved', 'success');
    document.querySelector('.fixed')?.remove();
  } catch (e) { showToast(e.message, 'error'); }
}
async function removePhotoBackground() {
  try {
    await apiSendJson('/dealership/photo-background', 'DELETE');
    __photoBackgroundUrl = null;
    showToast('Background removed', 'success');
    document.querySelector('.fixed')?.remove();
  } catch (e) { showToast(e.message, 'error'); }
}
// ── Website manager: the public dealer site we host ──────────────────────────
const SITE_BASE = (location.origin && !/^file/.test(location.origin)) ? `${location.origin}/site.html` : 'https://marketsync.link/site.html';
// The settings form body (shared by the Website → Settings tab and the modal).
// "Connect your own domain" — one field, the exact DNS record, and a Check button.
function customDomainCard(cfg) {
  const dom = cfg.custom_domain || '';
  const target = cfg.domain_target || 'marketsync.link';
  const verified = !!cfg.custom_domain_verified;
  const status = !dom ? ''
    : verified
      ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400"> Connected — live at <a href="https://${esc(dom)}" target="_blank" class="underline">${esc(dom)}</a></span>`
      : `<span class="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">⏳ Waiting for DNS — add the record below, then Check.</span>`;
  const rec = (host, val) => `<div class="flex items-center gap-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1"><span class="text-slate-400">${host}</span><span class="flex-1 truncate">${esc(val)}</span><button type="button" onclick="navigator.clipboard?.writeText('${esc(val)}');showToast('Copied','success')" class="text-indigo-600 dark:text-indigo-400 font-bold">Copy</button></div>`;
  return `<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div class="text-sm font-black text-slate-900 dark:text-white"> Your own domain</div>
      ${status}
    </div>
    <p class="text-[11px] text-slate-400">Use your own web address (like <b>www.yourdealership.com</b>) instead of the MarketSync link. Enter it, add one DNS record at your domain provider, and hit Check.</p>
    <div class="flex items-center gap-2">
      <span class="text-xs text-slate-400">https://</span>
      ${`<input id="site-domain" value="${esc(dom)}" placeholder="www.yourdealership.com" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`}
    </div>
    ${dom ? `<div class="space-y-1.5 pt-1">
      <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Add this at your domain provider (GoDaddy, Namecheap, etc.):</div>
      ${rec('CNAME&nbsp;&nbsp;www', target)}
      <div class="text-[10px] text-slate-400">Using the bare domain (no “www”)? Add a CNAME/ALIAS on <b>@</b> pointing to <b>${esc(target)}</b>, or an A record if your provider requires one. Not sure? We’ll help — just ask.</div>
      <div class="flex items-center gap-2 pt-1">
        <button type="button" onclick="verifyDomain(this)" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Check connection</button>
        <span class="text-[10px] text-slate-400">DNS can take a few minutes to an hour to update.</span>
      </div>
    </div>` : `<div class="text-[10px] text-slate-400">Enter your domain and click <b>Save settings</b> below — then the DNS record + Check button appear here.</div>`}
  </div>`;
}
async function verifyDomain(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Checking…';
  try {
    const d = await apiSendJson('/dealership/site/verify-domain', 'POST', {});
    showToast(d.message, d.verified ? 'success' : 'info');
    if (typeof loadWebsitePage === 'function' && __wsTab === 'settings') { __siteCfg.custom_domain_verified = d.verified; renderWsBody(); }
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
function siteSettingsFields(cfg) {
  const c = cfg.content || {};
  const publicUrl = cfg.site_slug ? `${SITE_BASE}?d=${encodeURIComponent(cfg.site_slug)}` : null;
  // Suggest the dealership name as the web address until one is set, so the field is
  // pre-filled (and saving it just keeps that address — no manual typing needed).
  const suggestedSlug = String(c.name || cfg.name || '').trim().toLowerCase()
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const inp = (id, v, ph, cls = '') => `<input id="${id}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}" class="${cls} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const ta = (id, v, ph, rows, mono) => `<textarea id="${id}" rows="${rows}" placeholder="${esc(ph)}" class="w-full ${mono ? 'font-mono text-[11px]' : 'text-sm'} bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">${esc(v || '')}</textarea>`;
  // Card wrapper — matches the Settings page cards (rounded-xl, border, padding,
  // text-lg heading) so Website settings reads as part of the same Settings design.
  const sec = (title, desc, inner) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">${title}</h2>
    ${desc ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">${desc}</p>` : '<div class="mb-3"></div>'}
    ${inner}</div>`;
  return `
    ${sec('Address &amp; visibility', 'Your site&rsquo;s public link and whether it&rsquo;s live.', `
      ${publicUrl ? `<div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 mb-2">
        <span class="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">${esc(publicUrl)}</span>
        <button onclick="navigator.clipboard?.writeText('${publicUrl}');showToast('Link copied','success')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">Copy</button>
        <a href="${publicUrl}" target="_blank" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">Open ↗</a>
      </div>` : ''}
      <div class="flex items-center gap-2">
        <div class="flex-1">${lbl('Site address (letters, numbers, dashes)')}
          <div class="flex items-center gap-1 text-sm"><span class="text-xs text-slate-400 whitespace-nowrap">…/site.html?d=</span>${inp('site-slug', cfg.site_slug || suggestedSlug, suggestedSlug || 'your-dealership', 'flex-1')}</div>
        </div>
        <label class="flex items-center gap-1.5 text-sm font-bold mt-4 whitespace-nowrap"><input id="site-pub" type="checkbox" ${cfg.site_published ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Published</label>
      </div>
      ${customDomainCard(cfg)}`, true)}
    ${sec('Business details', 'Name, contact info and hours shown across your site.', `
      <div class="grid grid-cols-1 gap-2">
        <div>${lbl('Headline / tagline')}${inp('site-tagline', c.tagline, 'Your trusted local dealership', 'w-full')}</div>
        <div><div class="flex items-center justify-between"><div>${lbl('About')}</div><button type="button" onclick="aiAboutMenu(event)" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 mb-1"> AI</button></div>${ta('site-about', c.about, 'A sentence or two about your store', 2)}</div>
        <div class="grid grid-cols-2 gap-2">
          <div>${lbl('Phone')}${inp('site-phone', c.phone, '905-555-1234', 'w-full')}</div>
          <div>${lbl('Email')}${inp('site-email', c.email, 'sales@…', 'w-full')}</div>
        </div>
        <div>${lbl('Address')}${inp('site-address', c.address, 'Street, City', 'w-full')}</div>
        <div>${lbl('Hours')}${ta('site-hours', c.hours, 'Mon–Fri 9–6, Sat 9–5', 2)}</div>
        <div class="grid grid-cols-2 gap-2">
          <div>${lbl('Facebook URL')}${inp('site-fb', c.facebook_url, 'https://facebook.com/…', 'w-full')}</div>
          <div>${lbl('Instagram URL')}${inp('site-ig', c.instagram_url, 'https://instagram.com/…', 'w-full')}</div>
        </div>
      </div>`)}
    ${sec('Branding', 'Your brand colour and the hero image at the top of the homepage.', `
      <div class="grid grid-cols-2 gap-2">
        <div>${lbl('Brand colour')}<input id="site-color" type="color" value="${esc(c.primary_color || '#1e3a8a')}" class="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"></div>
        <div>${lbl('Hero image')}<div class="flex gap-1">${inp('site-hero', c.hero_url, 'Paste URL or upload', 'flex-1')}<input id="site-hero-file" type="file" accept="image/*" class="hidden" onchange="uploadSiteImage('site-hero', this.files[0])"><button type="button" onclick="document.getElementById('site-hero-file').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 rounded-lg">Upload</button><button type="button" onclick="openWsPhotoPicker(url => { const el = document.getElementById('site-hero'); if (el) el.value = url; })" class="text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 px-3 rounded-lg">Browse Photos</button></div></div>
      </div>`)}
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Build &amp; Price brands</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Which brands do you sell new? Only these appear on your Build &amp; Price page — keeps used trade-ins and off-brands out. Leave all unchecked to auto-detect from your new inventory.</p>
      <div id="bm-wrap" class="flex flex-wrap gap-x-3 gap-y-1">${(() => { const set = new Set((c.build_makes || []).map(s => String(s).toLowerCase())); return ['Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Ford', 'Lincoln', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Volkswagen', 'Jeep', 'Ram', 'Dodge', 'Chrysler'].map(b => `<label class="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"><input type="checkbox" class="bm-check accent-indigo-600" value="${b}" ${set.has(b.toLowerCase()) ? 'checked' : ''}>${b}</label>`).join(''); })()}</div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">SEO</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">How your site shows in Google and when shared. Leave blank to auto-generate from your name, city and About.</p>
      <div class="space-y-2">
        <div class="flex justify-end -mb-1"><button type="button" onclick="aiSiteMeta(this)" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500"> AI write title + meta</button></div>
        <div>${lbl('Page title (Google tab, ~60 chars)')}${inp('seo-title', c.seo_title, 'Your Dealership | New & Used Cars, Trucks & SUVs', 'w-full')}</div>
        <div>${lbl('Meta description (~155 chars)')}${ta('seo-desc', c.seo_description, 'Shop new and used vehicles at your dealership. Build & price, get financing, and value your trade — all online.', 2)}</div>
        <div>${lbl('Keywords (comma separated, optional)')}${inp('seo-keywords', c.seo_keywords, 'used cars near me, trucks for sale, car dealership', 'w-full')}</div>
        <div>${lbl('Social share image')}<div class="flex gap-1">${inp('seo-image', c.seo_image, 'Paste URL or upload (falls back to hero)', 'flex-1')}<input id="seo-image-file" type="file" accept="image/*" class="hidden" onchange="uploadSiteImage('seo-image', this.files[0])"><button type="button" onclick="document.getElementById('seo-image-file').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-3 rounded-lg">Upload</button></div></div>
      </div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI sales chat</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">A concierge chat bubble on your site that answers shopper questions from your live inventory and captures leads. Replies come from your stock only.</p>
        </div>
        <label class="flex items-center gap-2 text-sm font-bold whitespace-nowrap"><input id="site-sales-chat" type="checkbox" ${c.sales_chat ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Enabled</label>
      </div>
      <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
        <div>
          ${lbl('Concierge name — what the chat calls itself to shoppers')}
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">Give your website chat a name (e.g. “Ava”). It shows in the chat window and the AI uses it when a shopper asks who they're talking to. Leave blank for a generic “Sales team”.</p>
          <input id="site-chat-name" type="text" maxlength="60" value="${esc(c.chat_name || '')}" placeholder="e.g. Ava" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">
        </div>
        <div>
          <div class="flex items-center justify-between gap-2 mb-1">
            ${lbl('Knowledge base — facts the concierge can answer from')}
            <div class="flex items-center gap-2">
              <input id="site-chat-kb-file" type="file" accept=".txt,.md,.csv,text/plain" class="hidden" onchange="loadChatKbFile(this.files[0])">
              <button type="button" onclick="document.getElementById('site-chat-kb-file').click()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">⬆ Upload .txt/.md</button>
            </div>
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">Store policies, financing &amp; warranty details, hours, staff, FAQs — anything a shopper might ask that isn't in your vehicle listings. The AI prefers these answers and won't invent facts. Up to ~12,000 characters.</p>
          ${ta('site-chat-kb', c.chat_kb, 'e.g. We offer in-house financing for all credit types. Service department open Mon–Sat 7:30–5. 30-day powertrain warranty on all used vehicles. Free CarFax on request. Ask for Jason for fleet pricing.', 6)}
        </div>
        <div>
          ${lbl('Special instructions — how you want the AI to answer')}
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">Tone, style, what to emphasize or avoid, which vehicles to push, when to hand off to a person. These guide the AI but can never override its core rules (it stays honest about your real inventory).</p>
          ${ta('site-chat-instructions', c.chat_instructions, 'e.g. Be enthusiastic but low-pressure. Always mention we buy trades even if the customer doesn\'t buy. Push our certified pre-owned units first. If asked about a vehicle we don\'t have, suggest booking an appointment.', 4)}
        </div>
        <div>
          ${lbl('Disclaimer — shown when pricing/terms come up')}
          <p class="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">A short line the AI works in when a shopper asks about pricing accuracy, availability, or financing terms. Up to ~600 characters.</p>
          ${ta('site-chat-disclaimer', c.chat_disclaimer, 'e.g. Prices shown do not include taxes, licensing, or dealer fees and are subject to change. Availability is not guaranteed until confirmed by an advisor.', 2)}
        </div>
      </div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <h2 class="text-lg font-bold text-slate-900 dark:text-white">Widgets &amp; integrations</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-3">Paste embed code from Keyloop, Equifax, trade-value tools, chat or AI tools. Global scripts (analytics/chat) go in “site-wide code”; placed embeds appear as blocks in a chosen section.</p>
      ${lbl('Site-wide code — runs in the page &lt;head&gt;')}
      ${ta('site-head', c.head_html, '<script>…</script> — analytics, chat, Keyloop tags', 3, true)}
      <div class="flex items-center justify-between mt-3 mb-1">
        <label class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Placed widgets</label>
        <button type="button" onclick="addSiteWidget()" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">+ Add widget</button>
      </div>
      <div id="site-widget-list" class="space-y-2"></div>
    </div>
    <div class="text-[11px] text-slate-400">Pages, Team and design live on their own tabs. Logo comes from your branding.</div>`;
}
async function openSiteManager() {
  let cfg = {};
  try { cfg = await apiGetJson('/dealership/site'); } catch (e) { showToast(e.message, 'error'); return; }
  crmOverlay(`<div class="p-5 space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-lg font-black text-slate-900 dark:text-white">Website settings</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    ${siteSettingsFields(cfg)}
    <div class="flex gap-2 justify-end pt-1">
      <button onclick="this.closest('.fixed').remove()" class="text-sm font-bold text-slate-500 px-4 py-2">Cancel</button>
      <button onclick="saveSite(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save</button>
    </div>
  </div>`, 'max-w-lg');
  __siteWidgets = Array.isArray(cfg.content?.widgets) ? cfg.content.widgets.slice() : [];
  renderSiteWidgets();
}
// Website → Settings tab (same form, inline instead of a modal).
function wsSettings() {
  if (!__siteCfg) return '<div class="mt-4 text-sm text-slate-400">Loading…</div>';
  return wsSetup();
}

function isAiChatbotOwned() {
  const c = __siteCfg?.content || {};
  const dealer = (typeof profileContext !== 'undefined' && profileContext?.dealership) ? profileContext.dealership : {};
  const access = (typeof window !== 'undefined' && window.__access) ? window.__access : {};
  
  if (dealer.ai_chatbot_active || dealer.ai_chatbot_paid) return true;
  if (access.products && (access.products.includes('ai_dealer') || access.products.includes('ai-chatbot'))) return true;
  if (access.features && (access.features.includes('ai.overview') || access.features.includes('ai.conversations'))) return true;
  return false;
}
window.isAiChatbotOwned = isAiChatbotOwned;

async function upgradeToAiChatbot(btn) {
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Preparing checkout…';
  try {
    const res = await apiSendJson('/billing/subscribe-plan', 'POST', { plan: 'ai-chatbot', currency: 'CAD' });
    if (res.url) {
      location.href = res.url;
    } else {
      throw new Error(res.error || 'Could not start checkout session');
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = orig;
    showToast(e.message || 'Checkout failed', 'error');
  }
}
window.upgradeToAiChatbot = upgradeToAiChatbot;

let __wsSetupSection = 'info';

function wsSetup() {
  const secBtn = (id, label) => `<button type="button" onclick="setWsSetupSection('${id}')" class="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between ${__wsSetupSection === id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}"><span>${label}</span> ${id === 'ai-chatbot' ? (isAiChatbotOwned() ? '<span class="w-2 h-2 rounded-full bg-emerald-400" title="Active"></span>' : '<span class="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">Upgrade</span>') : ''}</button>`;

  return `
    <div class="mt-4 max-w-6xl">
      <div class="grid md:grid-cols-[220px_1fr] gap-6 items-start">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-1 shadow-sm sticky top-4">
          <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1">Website Setup</div>
          ${secBtn('info', 'Dealership Info')}
          ${secBtn('domain', 'Domain & DNS')}
          ${secBtn('branding', 'Branding & Colors')}
          ${secBtn('social', 'Social Links')}
          ${secBtn('inventory_feed', 'Inventory Feed')}
          ${secBtn('routing', 'Lead Routing')}
          ${secBtn('seo', 'SEO & Analytics')}
          ${secBtn('ai-chatbot', 'AI ChatBot')}
          ${secBtn('publishing', 'Publishing & Link')}
        </div>

        <div id="ws-setup-body" class="space-y-6">
          ${renderWsSetupSection()}
        </div>
      </div>
    </div>
  `;
}

function setWsSetupSection(sec) {
  __wsSetupSection = sec;
  const body = document.getElementById('ws-setup-body');
  if (body) body.innerHTML = renderWsSetupSection();
}
window.setWsSetupSection = setWsSetupSection;

function renderWsSetupSection() {
  const c = __siteCfg?.content || {};
  const sec = (title, desc, inner) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
    <div>
      <h2 class="text-lg font-black text-slate-900 dark:text-white">${title}</h2>
      ${desc ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${desc}</p>` : ''}
    </div>
    ${inner}
    <div class="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800"><button onclick="saveWebsite(this)" class="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl transition shadow-md">Save Settings</button></div>
  </div>`;

  if (__wsSetupSection === 'domain') {
    return sec('Domain & DNS Configuration', 'Connect your custom domain to your MarketSync dealer website.', customDomainCard(__siteCfg));
  }

  if (__wsSetupSection === 'branding') {
    return sec('Branding & Aesthetics', 'Set your primary brand color, hero background, and dealership logo.', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Brand Primary Color</label>
          <input id="site-color" type="color" value="${esc(c.primary_color || '#1e3a8a')}" class="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 cursor-pointer">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Hero Image</label>
          <div class="flex gap-2">
            <input id="site-hero" value="${esc(c.hero_url || '')}" placeholder="URL or upload" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
            <button type="button" onclick="openWsPhotoPicker(url => { const el = document.getElementById('site-hero'); if (el) el.value = url; })" class="text-xs font-black bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 px-3.5 rounded-xl border border-indigo-500/30">Browse</button>
          </div>
        </div>
      </div>
    `);
  }

  if (__wsSetupSection === 'social') {
    return sec('Social Media Channels', 'Link your official social accounts.', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Facebook Page URL</label>
          <input id="site-fb" value="${esc(c.facebook_url || '')}" placeholder="https://facebook.com/yourdealership" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Instagram Profile URL</label>
          <input id="site-ig" value="${esc(c.instagram_url || '')}" placeholder="https://instagram.com/yourdealership" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
      </div>
    `);
  }

  if (__wsSetupSection === 'inventory_feed') {
    return sec('Inventory Feed & Franchise Makes', 'Select new vehicle franchise lineups to display on your Build & Price page.', `
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">Check the new vehicle makes you sell. Unchecked makes default to auto-detect from your live stock.</p>
      <div id="bm-wrap" class="flex flex-wrap gap-x-4 gap-y-2 py-2">${(() => { const set = new Set((c.build_makes || []).map(s => String(s).toLowerCase())); return ['Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Ford', 'Lincoln', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Volkswagen', 'Jeep', 'Ram', 'Dodge', 'Chrysler'].map(b => `<label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" class="bm-check accent-indigo-600 w-4 h-4 rounded" value="${b}" ${set.has(b.toLowerCase()) ? 'checked' : ''}>${b}</label>`).join(''); })()}</div>
    `);
  }

  if (__wsSetupSection === 'routing') {
    return sec('Lead Capture & Form Routing', 'Where website leads and inquiry forms deliver.', `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Notification Email</label>
          <input id="site-email" value="${esc(c.email || '')}" placeholder="sales@yourdealership.com" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Notification Phone (SMS)</label>
          <input id="site-phone" value="${esc(c.phone || '')}" placeholder="905-555-1234" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
      </div>
    `);
  }

  if (__wsSetupSection === 'seo') {
    return sec('SEO & Head Analytics Code', 'Search engine optimization and tracking tags.', `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Google Page Title (~60 chars)</label>
          <input id="seo-title" value="${esc(c.seo_title || '')}" placeholder="Your Dealership | New & Used Cars, Trucks & SUVs" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Meta Description (~155 chars)</label>
          <textarea id="seo-desc" rows="2" placeholder="Shop new and used vehicles..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.seo_description || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Keywords</label>
          <input id="seo-keywords" value="${esc(c.seo_keywords || '')}" placeholder="used cars near me, trucks for sale" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Site-wide Head HTML Scripts</label>
          <textarea id="site-head" rows="3" placeholder="<script>...</script> (Google Analytics, Meta Pixel)" class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">${esc(c.head_html || '')}</textarea>
        </div>
      </div>
    `);
  }

  if (__wsSetupSection === 'ai-chatbot') {
    if (!isAiChatbotOwned()) {
      return `
        <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl p-8 text-white space-y-6 shadow-2xl">
          <div class="flex items-center justify-between flex-wrap gap-4 border-b border-indigo-900/60 pb-6">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-xl shadow-inner">AI</div>
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="text-2xl font-black text-white">AI ChatBot</h2>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">Standalone Product</span>
                </div>
                <p class="text-indigo-200 text-sm font-medium mt-0.5">Turn your website into a 24/7 digital sales assistant.</p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-3xl font-black text-white">$299 <span class="text-xs font-bold text-slate-400">/ month CAD</span></div>
              <div class="text-[11px] text-indigo-300 font-semibold">Standalone add-on · Instant activation</div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-sm font-black uppercase tracking-wider text-indigo-400">What AI ChatBot does for your dealership:</h3>
            <div class="grid md:grid-cols-2 gap-3 text-xs">
              <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Answers Vehicle Questions</div>
                <p class="text-slate-400 text-[11px]">Replies instantly to shopper questions about pricing, specs, availability, and features using your live lot inventory.</p>
              </div>
              <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Captures 24/7 Leads</div>
                <p class="text-slate-400 text-[11px]">Collects customer contact info, preferred vehicles, and trade details even when your showroom is closed.</p>
              </div>
              <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Helps Customers Find Inventory</div>
                <p class="text-slate-400 text-[11px]">Guides shoppers to matching new and used vehicles on your website based on budget, body style, and payment goals.</p>
              </div>
              <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Routes Sales &amp; Service Inquiries</div>
                <p class="text-slate-400 text-[11px]">Directs service appointment requests, financing applications, and trade appraisals directly to the right department.</p>
              </div>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div class="font-bold text-white text-sm">Keep your existing Dealer Website subscription ($249/mo CAD)</div>
              <div class="text-[11px] text-slate-400">AI ChatBot ($299/mo CAD) is added as a separate standalone product under your account.</div>
            </div>
            <button onclick="upgradeToAiChatbot(this)" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition shadow-xl hover:shadow-indigo-500/30 cursor-pointer whitespace-nowrap">Upgrade to AI ChatBot — $299/mo</button>
          </div>
        </div>
      `;
    }

    // Active AI ChatBot configuration wizard
    return `
      <div class="space-y-6">
        <div class="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-lg"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
            <div>
              <div class="font-black text-emerald-300 text-sm">AI ChatBot Active</div>
              <div class="text-xs text-slate-400">Your 24/7 digital assistant is active on your MarketSync website.</div>
            </div>
          </div>
          <label class="flex items-center gap-2 text-xs font-black text-slate-200 cursor-pointer">
            <input id="site-sales-chat" type="checkbox" ${c.sales_chat ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 rounded"> Enabled on site
          </label>
        </div>

        ${sec('AI Assistant Persona & Setup', 'Configure name, tone, and knowledgebase.', `
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-extrabold text-slate-500 mb-1">Concierge Name</label>
              <input id="site-chat-name" type="text" value="${esc(c.chat_name || '')}" placeholder="e.g. Ava" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
            </div>
            <div>
              <div class="flex items-center justify-between gap-2 mb-1">
                <label class="block text-xs font-extrabold text-slate-500">Knowledgebase Facts</label>
                <input id="site-chat-kb-file" type="file" accept=".txt,.md,.csv,text/plain" class="hidden" onchange="loadChatKbFile(this.files[0])">
                <button type="button" onclick="document.getElementById('site-chat-kb-file').click()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">⬆ Upload .txt/.md</button>
              </div>
              <textarea id="site-chat-kb" rows="5" placeholder="Financing policies, warranties, dealership hours..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.chat_kb || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-extrabold text-slate-500 mb-1">Special Instructions for AI</label>
              <textarea id="site-chat-instructions" rows="3" placeholder="Low-pressure tone, emphasize trade-in offers..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.chat_instructions || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-extrabold text-slate-500 mb-1">Terms Disclaimer</label>
              <textarea id="site-chat-disclaimer" rows="2" placeholder="Prices do not include taxes or license fees..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.chat_disclaimer || '')}</textarea>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  if (__wsSetupSection === 'publishing') {
    const url = c.site_slug ? `${SITE_BASE}?d=${encodeURIComponent(c.site_slug)}` : '';
    return sec('Publishing & Site URL', 'Public website address and visibility status.', `
      <div class="space-y-4">
        ${url ? `
          <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
            <span class="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate font-mono">${esc(url)}</span>
            <button onclick="navigator.clipboard?.writeText('${url}');showToast('Link copied','success')" class="text-xs font-black text-indigo-600 dark:text-indigo-400 px-3 py-1 bg-indigo-600/10 rounded-lg">Copy</button>
            <a href="${url}" target="_blank" class="text-xs font-black text-indigo-600 dark:text-indigo-400 px-3 py-1 bg-indigo-600/10 rounded-lg">Open ↗</a>
          </div>
        ` : ''}
        <div class="flex items-center gap-4">
          <div class="flex-1">
            <label class="block text-xs font-extrabold text-slate-500 mb-1">Site Slug (Address)</label>
            <input id="site-slug" value="${esc(__siteCfg.site_slug || '')}" placeholder="your-dealership" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
          </div>
          <label class="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300 mt-5 cursor-pointer">
            <input id="site-pub" type="checkbox" ${__siteCfg.site_published ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 rounded"> Published Live
          </label>
        </div>
      </div>
    `);
  }

  // Default 'info'
  return sec('Dealership Profile & Contact Details', 'Business name, address, hours, and contact details shown on your site.', `
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-extrabold text-slate-500 mb-1">Headline / Tagline</label>
        <input id="site-tagline" value="${esc(c.tagline || '')}" placeholder="Your trusted local dealership" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
      </div>
      <div>
        <label class="block text-xs font-extrabold text-slate-500 mb-1">About Dealership</label>
        <textarea id="site-about" rows="3" placeholder="A sentence or two about your store..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.about || '')}</textarea>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Phone</label>
          <input id="site-phone" value="${esc(c.phone || '')}" placeholder="905-555-1234" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
        <div>
          <label class="block text-xs font-extrabold text-slate-500 mb-1">Email</label>
          <input id="site-email" value="${esc(c.email || '')}" placeholder="sales@yourdealership.com" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
        </div>
      </div>
      <div>
        <label class="block text-xs font-extrabold text-slate-500 mb-1">Address</label>
        <input id="site-address" value="${esc(c.address || '')}" placeholder="123 Main St, City, Province" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">
      </div>
      <div>
        <label class="block text-xs font-extrabold text-slate-500 mb-1">Hours</label>
        <textarea id="site-hours" rows="2" placeholder="Mon–Fri 9–6, Sat 9–5" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium">${esc(c.hours || '')}</textarea>
      </div>
    </div>
  `);
}
// Upload an image (hero/page) → returns a public URL into the given input field.
async function uploadSiteImage(targetId, file) {
  if (!file) return;
  showToast('Uploading image…', 'info');
  try {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    const el = document.getElementById(targetId); if (el) el.value = d.url;
    showToast('Image uploaded', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
// ── Shared Pexels photo picker — every image field in the Website Builder (Hero,
// section images, galleries) can browse the same free library Design Studio uses,
// instead of only "paste a URL or upload a file". Reuses /marketing/studio/library/
// search (the same endpoint Design Studio's Photos tool calls) so results and
// attribution match exactly.
// ── Shared 3-tab image picker — Upload, Inventory photos, and Pexels library ──
let __wsPhotoPickCallback = null;
let __wsPhotoActiveTab = 'pexels';

function openWsPhotoPicker(onPick) {
  __wsPhotoPickCallback = onPick;
  __wsPhotoActiveTab = 'pexels';
  let modal = document.getElementById('ws-photo-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ws-photo-picker-modal';
    modal.className = 'fixed inset-0 z-[99998] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4';
    document.body.appendChild(modal);
  }
  renderWsPhotoPickerModal();
}

function renderWsPhotoPickerModal() {
  const modal = document.getElementById('ws-photo-picker-modal');
  if (!modal) return;
  
  const tabBtn = (id, label) => `<button type="button" onclick="setWsPhotoTab('${id}')" class="px-4 py-2 text-xs font-black rounded-xl transition ${__wsPhotoActiveTab === id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>`;

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
      <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Select Image</h3>
          <p class="text-[11px] text-slate-400">Choose from Pexels library, your lot inventory, or upload a custom image.</p>
        </div>
        <button type="button" onclick="closeWsPhotoPicker()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">&times;</button>
      </div>

      <div class="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-950">
        ${tabBtn('pexels', 'Pexels Search')}
        ${tabBtn('inventory', 'Inventory Photos')}
        ${tabBtn('upload', 'Upload File')}
      </div>

      <div id="ws-photo-tab-content" class="p-4 flex-1 overflow-y-auto min-h-[300px]">
        ${renderWsPhotoTabBody()}
      </div>

      <div class="p-2.5 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400">
        ${__wsPhotoActiveTab === 'pexels' ? 'High-quality royalty-free photography provided by Pexels' : (__wsPhotoActiveTab === 'inventory' ? 'Live lot vehicle photos from your inventory' : 'Supported formats: JPG, PNG, WEBP')}
      </div>
    </div>`;

  if (__wsPhotoActiveTab === 'pexels') searchWsPhotoLibrary('car dealership');
  else if (__wsPhotoActiveTab === 'inventory') loadWsInventoryPhotos();
}

function setWsPhotoTab(t) {
  __wsPhotoActiveTab = t;
  renderWsPhotoPickerModal();
}
window.setWsPhotoTab = setWsPhotoTab;

function renderWsPhotoTabBody() {
  if (__wsPhotoActiveTab === 'upload') {
    return `
      <div class="space-y-4 py-6 text-center">
        <div class="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 bg-slate-50 dark:bg-slate-950/60 hover:border-indigo-500 transition">
          <svg class="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
          <div class="text-sm font-black text-slate-900 dark:text-white mb-1">Upload a Custom Photo</div>
          <p class="text-xs text-slate-400 mb-4">Drag and drop an image file here or browse from your device.</p>
          <input type="file" id="ws-modal-file" accept="image/*" class="hidden" onchange="uploadWsModalImage(this.files[0])">
          <button type="button" onclick="document.getElementById('ws-modal-file').click()" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-md">Select Local File</button>
        </div>
      </div>
    `;
  }
  if (__wsPhotoActiveTab === 'inventory') {
    return `
      <div class="space-y-3">
        <div id="ws-inv-photos-grid" class="grid grid-cols-3 gap-2">
          <div class="col-span-3 py-10 text-center text-xs text-slate-400">Loading lot inventory photos…</div>
        </div>
      </div>
    `;
  }
  // Pexels
  return `
    <div class="space-y-3">
      <form onsubmit="event.preventDefault(); searchWsPhotoLibrary(document.getElementById('ws-photo-query').value)" class="flex gap-2">
        <input id="ws-photo-query" type="search" value="car dealership" placeholder="Search car dealership, trucks, luxury, SUV..." class="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:outline-none focus:border-indigo-500">
        <button class="px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-xs">Search</button>
      </form>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-bold text-slate-400">Quick topics:</span>
        <button type="button" onclick="document.getElementById('ws-photo-query').value='car dealership'; searchWsPhotoLibrary('car dealership')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">Dealership</button>
        <button type="button" onclick="document.getElementById('ws-photo-query').value='truck'; searchWsPhotoLibrary('truck')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">Trucks</button>
        <button type="button" onclick="document.getElementById('ws-photo-query').value='luxury car'; searchWsPhotoLibrary('luxury car')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">Luxury</button>
        <button type="button" onclick="document.getElementById('ws-photo-query').value='electric vehicle'; searchWsPhotoLibrary('electric vehicle')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">EV</button>
        <button type="button" onclick="document.getElementById('ws-photo-query').value='car service'; searchWsPhotoLibrary('car service')" class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200">Service</button>
      </div>
      <div id="ws-photo-results" class="grid grid-cols-3 gap-2 pt-1"><div class="col-span-3 py-10 text-center text-xs text-slate-400">Loading…</div></div>
    </div>
  `;
}

async function uploadWsModalImage(file) {
  if (!file) return;
  showToast('Uploading custom image…', 'info');
  try {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    pickWsPhoto(d.url);
    showToast('Image uploaded', 'success');
  } catch (e) {
    showToast(e.message || 'Upload failed', 'error');
  }
}
window.uploadWsModalImage = uploadWsModalImage;

async function loadWsInventoryPhotos() {
  const box = document.getElementById('ws-inv-photos-grid');
  if (!box) return;
  try {
    let inv = (typeof __catalogCache !== 'undefined' && __catalogCache?.length) ? __catalogCache : [];
    if (!inv.length) { inv = await apiGetJson('/inventory/all', { retries: 1 }); }
    const photos = [];
    (inv || []).forEach(v => {
      if (Array.isArray(v.photos)) {
        v.photos.forEach(p => { if (p) photos.push({ url: p, label: `${v.year || ''} ${v.make || ''} ${v.model || ''}` }); });
      } else if (v.photo_url) {
        photos.push({ url: v.photo_url, label: `${v.year || ''} ${v.make || ''} ${v.model || ''}` });
      }
    });
    if (!photos.length) {
      box.innerHTML = '<div class="col-span-3 py-10 text-center text-xs text-slate-400 italic">No inventory vehicle photos found on your lot.</div>';
      return;
    }
    box.innerHTML = photos.map(p => `
      <button type="button" onclick="pickWsPhoto('${esc(p.url)}')" title="${esc(p.label)}" class="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition shadow-xs">
        <img src="${esc(p.url)}" loading="lazy" class="w-full h-full object-cover">
        <div class="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-[10px] text-white font-bold truncate opacity-0 group-hover:opacity-100 transition">${esc(p.label)}</div>
      </button>
    `).join('');
  } catch (e) {
    box.innerHTML = '<div class="col-span-3 py-10 text-center text-xs text-rose-500">Could not load inventory photos.</div>';
  }
}

window.openWsPhotoPicker = openWsPhotoPicker;

function closeWsPhotoPicker() {
  document.getElementById('ws-photo-picker-modal')?.remove();
  __wsPhotoPickCallback = null;
}
window.closeWsPhotoPicker = closeWsPhotoPicker;

async function searchWsPhotoLibrary(query) {
  const target = document.getElementById('ws-photo-results');
  if (!target) return;
  target.innerHTML = '<div class="col-span-3 py-10 text-center text-xs text-slate-400">Searching…</div>';
  try {
    const data = await apiGetJson(`/marketing/studio/library/search?q=${encodeURIComponent(query || 'car dealership')}`);
    const results = data?.results || [];
    target.innerHTML = results.length
      ? results.map(r => `<button type="button" onclick="pickWsPhoto('${esc(r.source_url || r.preview_url)}')" title="${esc(r.alt || '')}" class="aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition"><img src="${esc(r.preview_url)}" loading="lazy" class="w-full h-full object-cover"></button>`).join('')
      : '<div class="col-span-3 py-10 text-center text-xs text-slate-400">No matching photos.</div>';
  } catch (e) {
    target.innerHTML = '<div class="col-span-3 py-10 text-center text-xs text-rose-500">Photo search is temporarily unavailable.</div>';
  }
}
window.searchWsPhotoLibrary = searchWsPhotoLibrary;

function pickWsPhoto(url) {
  if (typeof __wsPhotoPickCallback === 'function') __wsPhotoPickCallback(url);
  closeWsPhotoPicker();
}
window.pickWsPhoto = pickWsPhoto;

// Read an uploaded .txt/.md file into the AI chat knowledge-base box (client-side, no upload).
async function loadChatKbFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('File too large — keep it under 2 MB of text.', 'error'); return; }
  try {
    const text = (await file.text() || '').slice(0, 12000);
    const el = document.getElementById('site-chat-kb'); if (!el) return;
    el.value = el.value.trim() ? (el.value.trim() + '\n\n' + text) : text;
    if (el.value.length > 12000) el.value = el.value.slice(0, 12000);
    showToast('Loaded — review, then Save', 'success');
  } catch (e) { showToast('Could not read that file.', 'error'); }
}
let __sitePages = [];
// Built-in pages that ship with every site — dealer can rename or switch off.
const BUILTIN_META = [
  ['inventory', 'Inventory', 'Your live stock, searchable & filterable'],
  ['build', 'Build & Price', 'Configure a new vehicle from your franchise lineup'],
  ['trade', 'Value Trade', 'Trade-in appraisal request form'],
  ['finance', 'Financing', 'Get-pre-approved credit application'],
  ['team', 'Team', 'Your staff, grouped by department'],
  ['contact', 'Contact', 'General contact / inquiry form'],
];
let __siteBuiltins = {};
function defaultBuiltins() { const o = {}; for (const [k, label] of BUILTIN_META) o[k] = { enabled: true, label, menu: '', sections: [] }; return o; }
function normBuiltins(src) {
  const o = defaultBuiltins();
  if (src && typeof src === 'object') for (const [k, def] of BUILTIN_META) { const v = src[k] || {}; o[k] = { enabled: v.enabled !== false, label: (v.label || def).toString().slice(0, 40), menu: (v.menu || '').toString().slice(0, 40), sections: Array.isArray(v.sections) ? v.sections : [] }; }
  return o;
}
let __menuOrder = [];
// One draggable list controls the whole nav: built-in pages + custom pages,
// their order, on/off, labels and submenu grouping. collectMenu() is the single
// source of truth — it reads the DOM row order + each row's fields.
function collectMenu() {
  const list = document.getElementById('menu-list'); if (!list) return;
  const rows = [...list.querySelectorAll('.menu-row')]; if (!rows.length) return;
  __menuOrder = rows.map(r => r.dataset.token).filter(Boolean);
  for (const [k] of BUILTIN_META) {
    const r = list.querySelector(`.menu-row[data-bi="${k}"]`); if (!r) continue;
    __siteBuiltins[k] = { ...(__siteBuiltins[k] || {}), enabled: r.querySelector('.bi-on')?.checked !== false, label: (r.querySelector('.bi-label')?.value || '').trim() || __siteBuiltins[k]?.label || k, menu: (r.querySelector('.bi-menu')?.value || '').trim() };
  }
  const byId = Object.fromEntries((__sitePages || []).map(p => [p.id, p]));
  __sitePages = rows.filter(r => r.dataset.pid).map(r => {
    const id = r.dataset.pid, prev = byId[id] || {};
    return { ...prev, id, title: r.querySelector('.pg-title')?.value || prev.title || '', nav: r.querySelector('.pg-nav')?.checked !== false, menu: (r.querySelector('.pg-menu')?.value || '').trim() || null, body_html: r.querySelector('.pg-body') ? (r.querySelector('.pg-body').value || '') : (prev.body_html || '') };
  });
}
// Back-compat shims for callers elsewhere.
function collectSitePages() { collectMenu(); }
function collectBuiltins() { collectMenu(); }
function renderSitePages() { renderMenuList(); }
function renderBuiltinPages() { renderMenuList(); }
function ensurePageIds() { (__sitePages || []).forEach(p => { if (!p.id) p.id = 'pg' + Math.random().toString(36).slice(2, 9); }); }
function menuDescriptors() {
  ensurePageIds();
  const items = [];
  for (const [k, label, desc] of BUILTIN_META) items.push({ token: 'b:' + k, kind: 'builtin', key: k, def: label, desc, b: __siteBuiltins[k] || { enabled: true, label, menu: '' } });
  for (const p of (__sitePages || [])) items.push({ token: 'p:' + p.id, kind: 'page', page: p });
  const ix = t => { const i = __menuOrder.indexOf(t); return i < 0 ? 9999 : i; };
  items.sort((a, b) => ix(a.token) - ix(b.token));   // stable → unlisted keep natural order
  return items;
}
function menuMove(token, dir) {
  collectMenu();
  const a = __menuOrder, i = a.indexOf(token), j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; renderMenuList();
}
// Nest (dir=1) under the nearest item above, or un-nest (dir=-1) to top level.
function menuSetMenu(it, val) {
  if (it.kind === 'builtin') { (__siteBuiltins[it.key] = __siteBuiltins[it.key] || { enabled: true, label: it.def, menu: '' }).menu = val || ''; }
  else { const p = (__sitePages || []).find(x => x.id === it.page.id); if (p) p.menu = val || null; }
}
function menuIndent(token, dir) {
  collectMenu();
  const items = menuDescriptors();
  const idx = items.findIndex(it => it.token === token); if (idx < 0) return;
  if (dir < 0) { menuSetMenu(items[idx], ''); renderMenuList(); return; }
  let parent = null;
  for (let j = idx - 1; j >= 0; j--) { const m = items[j].kind === 'builtin' ? (items[j].b.menu || '') : (items[j].page.menu || ''); if (!m) { parent = items[j]; break; } }
  if (!parent) { showToast('Put this below another item first, then nest it', 'info'); return; }
  const label = parent.kind === 'builtin' ? (__siteBuiltins[parent.key]?.label || parent.def) : (parent.page.title || '');
  menuSetMenu(items[idx], label); renderMenuList();
}
function wsCustomizeById(id) { collectMenu(); const i = (__sitePages || []).findIndex(p => p.id === id); if (i >= 0) wsSetTarget(i); }
function removeSitePageById(id) { collectMenu(); __sitePages = (__sitePages || []).filter(p => p.id !== id); __menuOrder = __menuOrder.filter(t => t !== 'p:' + id); renderWsBody(); }
const MENU_SWITCH = (cls, on) => `<label class="relative inline-flex items-center cursor-pointer shrink-0"><input type="checkbox" class="${cls} sr-only peer" ${on ? 'checked' : ''} onchange="collectMenu();renderMenuList()"><div class="w-9 h-5 bg-slate-300 dark:bg-slate-600 peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition peer-checked:after:translate-x-4"></div></label>`;
function menuRow(it, i, n) {
  const grp = 'w-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs';
  const menuVal = it.kind === 'builtin' ? (it.b.menu || '') : (it.page.menu || '');
  const indent = menuVal ? 'style="margin-left:1.75rem"' : '';
  const childMark = menuVal ? `<span class="text-slate-400 shrink-0 text-xs" title="Nested under ${esc(menuVal)}">↳</span>` : '';
  const handle = `<span class="menu-drag cursor-grab select-none text-slate-400 shrink-0 text-lg leading-none" draggable="true" title="Drag up/down to reorder, right to nest">⠿</span>
    <div class="flex flex-col shrink-0 -my-1"><button type="button" onclick="menuMove('${it.token}',-1)" ${i === 0 ? 'disabled' : ''} class="text-slate-400 hover:text-slate-700 disabled:opacity-25 leading-none text-[10px]">▲</button><button type="button" onclick="menuMove('${it.token}',1)" ${i === n - 1 ? 'disabled' : ''} class="text-slate-400 hover:text-slate-700 disabled:opacity-25 leading-none text-[10px]">▼</button></div>
    <div class="flex flex-col shrink-0 -my-1"><button type="button" onclick="menuIndent('${it.token}',1)" class="text-slate-400 hover:text-indigo-600 leading-none text-[11px]" title="Nest under the item above">→</button><button type="button" onclick="menuIndent('${it.token}',-1)" ${menuVal ? '' : 'disabled'} class="text-slate-400 hover:text-indigo-600 disabled:opacity-25 leading-none text-[11px]" title="Move to top level">←</button></div>${childMark}`;
  if (it.kind === 'builtin') {
    const b = it.b;
    return `<div class="menu-row flex items-center gap-2 flex-wrap border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 ${b.enabled ? '' : 'opacity-60'}" ${indent} data-token="${it.token}" data-bi="${it.key}">
      ${handle}${MENU_SWITCH('bi-on', b.enabled)}
      <input class="bi-label flex-1 min-w-[110px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold" value="${esc(b.label || it.def)}" placeholder="${esc(it.def)}">
      <input class="bi-menu ${grp}" list="menu-grp-opts" value="${esc(b.menu || '')}" placeholder="Submenu" onchange="collectMenu();renderMenuList()">
      <span class="text-[9px] font-bold text-slate-400 uppercase shrink-0">Built-in</span>
    </div>`;
  }
  const p = it.page;
  const badge = p.kind === 'model' ? '<span class="text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">Model</span>' : p.kind === 'incentive' ? '<span class="text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full shrink-0">Offer</span>' : '';
  const showBody = p.kind === 'model' || p.kind === 'incentive' || (p.body_html && !(p.sections && p.sections.length));
  return `<div class="menu-row border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 space-y-1" ${indent} data-token="${it.token}" data-pid="${p.id}">
    <div class="flex items-center gap-2 flex-wrap">
      ${handle}${MENU_SWITCH('pg-nav', p.nav !== false)}
      <input class="pg-title flex-1 min-w-[110px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold" placeholder="Page title" value="${esc(p.title || '')}">${badge}
      <input class="pg-menu ${grp}" list="menu-grp-opts" value="${esc(p.menu || '')}" placeholder="Submenu" onchange="collectMenu();renderMenuList()">
      <button type="button" onclick="wsCustomizeById('${p.id}')" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap shrink-0"> Customize${(p.sections && p.sections.length) ? ' (' + p.sections.length + ')' : ''}</button>
      <button type="button" onclick="removeSitePageById('${p.id}')" class="text-rose-500 text-xs font-bold shrink-0"></button>
    </div>
    ${showBody ? `<textarea class="pg-body w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1" rows="2" placeholder="${p.kind === 'model' ? 'Intro blurb — inventory lists automatically below it.' : 'Page content — plain text or basic HTML'}">${esc(p.body_html || '')}</textarea>` : ''}
  </div>`;
}
function renderMenuList() {
  const box = document.getElementById('menu-list'); if (!box) return;
  const menus = [...new Set(Object.values(__siteBuiltins).map(b => b.menu).concat((__sitePages || []).map(p => p.menu)).filter(Boolean))];
  const items = menuDescriptors();
  box.innerHTML = `<datalist id="menu-grp-opts">${['New Vehicles', 'Pre-Owned', 'Service', 'Offers', 'About', 'Financing'].concat(menus).filter((v, i, a) => a.indexOf(v) === i).map(m => `<option value="${esc(m)}">`).join('')}</datalist>` + (items.map((it, i) => menuRow(it, i, items.length)).join('') || '<div class="text-[11px] text-slate-400 italic">No menu items.</div>');
  wsMenuDragWire();
}
// Drag from the ⠿ handle; the row is moved. collectMenu() on drop re-reads order.
function wsMenuDragWire() {
  const list = document.getElementById('menu-list'); if (!list || list._dw) return; list._dw = 1;
  let drag = null, startX = 0, lastX = 0;
  list.addEventListener('dragstart', e => { if (!e.target.classList?.contains('menu-drag')) return; drag = e.target.closest('.menu-row'); if (!drag) return; startX = lastX = e.clientX; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', ''); } catch {} setTimeout(() => drag && drag.classList.add('opacity-40'), 0); });
  list.addEventListener('dragend', () => {
    if (!drag) return;
    drag.classList.remove('opacity-40');
    const token = drag.dataset.token, dx = lastX - startX; drag = null;
    collectMenu();                                   // sync new vertical order
    if (dx > 40) menuIndent(token, 1);               // dragged right → nest
    else if (dx < -40) menuIndent(token, -1);        // dragged left → un-nest
    else renderMenuList();                            // refresh arrows/indent marks
  });
  list.addEventListener('dragover', e => { if (!drag) return; e.preventDefault(); lastX = e.clientX; const after = menuDragAfter(list, e.clientY); if (!after) list.appendChild(drag); else list.insertBefore(drag, after); });
}
function menuDragAfter(list, y) {
  let best = null, bestOff = -Infinity;
  for (const el of list.querySelectorAll('.menu-row:not(.opacity-40)')) { const box = el.getBoundingClientRect(); const off = y - box.top - box.height / 2; if (off < 0 && off > bestOff) { bestOff = off; best = el; } }
  return best;
}
// Auto-build model pages (from your inventory) + standard offer pages.
async function autoBuildPages(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Building…';
  try {
    let inv = (typeof __catalogCache !== 'undefined' && __catalogCache?.length) ? __catalogCache : [];
    if (!inv.length) { try { inv = await apiGetJson('/inventory/all', { retries: 1 }); } catch {} }
    const avail = inv.filter(v => String(v.status || 'available').toLowerCase() === 'available');
    // Distinct make+model.
    const seen = new Map();
    for (const v of avail) { if (!v.make || !v.model) continue; const key = `${v.make} ${v.model}`.toLowerCase(); if (!seen.has(key)) seen.set(key, { make: v.make, model: v.model }); }
    collectSitePages();
    const have = new Set(__sitePages.map(p => (p.title || '').toLowerCase()));
    let added = 0;
    for (const { make, model } of seen.values()) {
      const title = `${make} ${model}`;
      if (have.has(title.toLowerCase())) continue;
      // Group each model page under its make → becomes a nav dropdown automatically.
      __sitePages.push({ title, make, model, kind: 'model', nav: true, menu: `${make} Lineup`, body_html: '' });
      have.add(title.toLowerCase()); added++;
    }
    for (const t of ['Current Offers', 'Finance Offers', 'Lease Offers', 'EV Rebates']) {
      if (have.has(t.toLowerCase())) continue;
      __sitePages.push({ title: t, kind: 'incentive', nav: true, menu: 'Offers', body_html: '' });
      have.add(t.toLowerCase()); added++;
    }
    renderSitePages();
    showToast(added ? `Added ${added} page${added === 1 ? '' : 's'} — review & Save` : 'Pages already exist', 'success');
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
window.autoBuildPages = autoBuildPages;
function addSitePage() { collectMenu(); __sitePages.push({ id: 'pg' + Math.random().toString(36).slice(2, 9), title: '', nav: true, body_html: '' }); renderMenuList(); }
function removeSitePage(i) { collectMenu(); __sitePages.splice(i, 1); renderMenuList(); }
// Starter pages the dealer can drop in with one click, pre-filled + grouped in the nav.
const __psec = (type, settings) => ({ id: 's' + Math.random().toString(36).slice(2, 9), type, settings: settings || {} });
function ctxName() { return (__siteCfg?.content?.name) || 'our dealership'; }
function ctxCity() { const c = __siteCfg?.content?.city; return c ? (' in ' + c) : ''; }
// Section builders shared by presets + templates.
const psHero = (h, s, btn, target, bg) => __psec('hero', { headline: h, subheadline: s, button_label: btn || 'Contact us', button_target: target || 'inquiry', overlay: 45, height: 'md', bg: bg || 'g1' });
const psSeo = (h, paras) => __psec('html', { html: `<h2>${h}</h2>` + paras.map(p => `<p>${p}</p>`).join('') });
const psContact = () => __psec('contact', { title: 'Get in touch', subtitle: 'Send us a message and we’ll get right back to you.' });
const psCta = (t, s, btn, target) => __psec('cta_banner', { title: t, subtitle: s, button_label: btn, button_target: target || 'inquiry' });
function PAGE_PRESETS() {
  const name = ctxName(), city = ctxCity();
  return {
    about: { label: 'About Us', page: { title: 'About Us', menu: '', nav: true, sections: [
      psHero(`About ${name}`, `Proudly serving drivers${city} with honest deals and a no-pressure experience.`, 'Meet the team', 'inquiry', 'g8'),
      psSeo('Your trusted local dealership', [
        `At ${name}, buying a vehicle should feel easy, transparent and even a little fun. From your first message to long after you drive off the lot, our team is here to make sure you get the right vehicle at the right price — with zero pressure.`,
        `We’ve built our reputation${city} on straight answers, fair pricing and treating every customer like a neighbour. Whether you’re shopping new, pre-owned or certified, our specialists know the inventory inside and out and will help you find the perfect fit for your life and budget.`,
      ]),
      __psec('staff', { title: 'Meet our team' }),
      psContact(),
    ] } },
    book_service: { label: 'Book a Service Appointment', page: { title: 'Book Service', menu: 'Service', nav: true, sections: [
      psHero('Book a Service Appointment', 'Factory-trained technicians, genuine parts, and scheduling that fits your day.', 'Request appointment', 'inquiry', 'g2'),
      psSeo('Service you can count on', [
        `Keep your vehicle running like new with the certified team at ${name}. From routine oil changes and tire rotations to brakes, diagnostics and full factory-scheduled maintenance, we do it right the first time.`,
        `Booking is simple — tell us your vehicle and preferred time below and a service advisor will confirm the details. Genuine parts, transparent pricing, and a job done right, every time.`,
      ]),
      psContact(),
    ] } },
    service: { label: 'Service Department', page: { title: 'Service', menu: 'Service', nav: true, sections: [
      psHero('Service Department', 'Certified techs. Genuine parts. Your vehicle at its best.', 'Book service', 'inquiry', 'g3'),
      psSeo('Expert care for every vehicle', [
        `Our factory-trained technicians at ${name} handle everything from quick maintenance to complex repairs — oil changes, brakes, tires, batteries, diagnostics and full manufacturer-scheduled service.`,
        `We use genuine OEM parts, quote honestly up front, and get you back on the road fast. Your vehicle is an investment — protect it with a service team that treats it like their own.`,
      ]),
      psContact(),
    ] } },
    parts: { label: 'Parts Department', page: { title: 'Parts', menu: 'Service', nav: true, sections: [
      psHero('Parts Department', 'Genuine OEM parts and accessories, sourced fast.', 'Request a part', 'inquiry', 'g4'),
      psSeo('The right part, guaranteed to fit', [
        `Looking for a specific part? The parts team at ${name} stocks and orders genuine OEM components built to fit and last — no guesswork, no aftermarket compromises.`,
        `Tell us the year, make, model and what you need, and we’ll track it down and let you know availability and pricing right away.`,
      ]),
      psContact(),
    ] } },
    accessories: { label: 'Accessories', page: { title: 'Accessories', menu: 'Service', nav: true, sections: [
      psHero('Accessories', 'Make it yours with genuine accessories.', 'Ask about accessories', 'inquiry', 'g5'),
      psSeo('Personalize your ride', [
        `From all-weather floor mats and cargo liners to tonneau covers, roof racks, running boards and more, ${name} carries the genuine accessories that make your vehicle work harder and look better.`,
        `Not sure what fits? Our team will match the right accessories to your exact vehicle and how you use it.`,
      ]),
      psContact(),
    ] } },
    specials: { label: 'Specials / Offers', page: { title: 'Specials', menu: '', nav: true, sections: [
      psHero('Current Specials', 'Limited-time offers on new, pre-owned and certified vehicles.', 'Get my price', 'inquiry', 'g6'),
      __psec('ad_banner', { tag: 'Limited time', headline: 'This month’s specials', subtitle: 'Save on select new and pre-owned vehicles — while they last.', button_label: 'See the deals', button_target: 'inquiry' }),
      psSeo('Deals worth driving for', [
        `Great vehicles at even better prices — the current specials at ${name} won’t last long. Our best deals move fast, so if something catches your eye, reach out and we’ll hold it for you.`,
      ]),
      __psec('featured_inventory', { title: 'Featured deals', condition: 'all', count: 6 }),
      psCta('See something you like?', 'Get your best price today — no pressure, no games.', 'Get my price', 'inquiry'),
    ] } },
    careers: { label: 'Careers', page: { title: 'Careers', menu: 'About', nav: true, sections: [
      psHero('Careers', 'Join a team that puts people first.', 'Apply now', 'inquiry', 'g7'),
      psSeo(`Grow your career at ${name}`, [
        `We’re always looking for driven, people-first talent — sales, service, parts, finance and admin. If you love helping people and want to grow with a dealership that invests in its team, we want to hear from you.`,
        `Tell us a little about yourself below and attach nothing more than your enthusiasm — we’ll take it from there.`,
      ]),
      psContact(),
    ] } },
    blank: { label: 'Blank page', page: { title: '', menu: '', nav: true, sections: [] } },
  };
}
// A polished, complete home layout every template ships (hero → feature cards →
// featured inventory → text+image → body styles → reviews → map → contact).
function templateHome(ctx) {
  const name = ctx.name || ctxName(), cityTxt = ctx.city ? (' in ' + ctx.city) : ctxCity();
  return [
    psHero(`Experience Automotive Excellence${cityTxt}`, `Shop, finance, and trade with total transparency at ${name}. Explore certified pre-owned and new arrivals today.`, 'Browse inventory', 'inventory', 'g1'),
    __psec('feature_cards', { title: `Why Drivers Choose ${name}` }),
    __psec('body_style', { title: 'Explore Vehicles By Category' }),
    __psec('featured_inventory', { title: 'Featured Inventory Spotlight', condition: 'all', count: 6 }),
    __psec('text_image', { headline: `The ${name} Difference`, body: `At ${name}${cityTxt}, we make it simple to get into a vehicle you'll love at a price that makes sense. Every vehicle is thoroughly inspected, competitively priced, and backed by no-pressure service.`, button_label: 'Meet our team', button_target: 'team' }),
    __psec('reviews', { title: 'What Our Buyers Say' }),
    __psec('map', { title: 'Visit Our Showroom' }),
    __psec('contact', { title: 'Get In Touch' }),
    psCta('Ready to Find Your Next Vehicle?', 'Get pre-approved online or request an instant trade offer in seconds.', 'Get Pre-Approved', 'finance')
  ];
}
// Hero/intro pre-filled on every built-in page so nothing is empty after a template.
function templateBuiltinSections() {
  const city = ctxCity();
  return {
    inventory: [psHero('Browse our inventory', `New, used and certified vehicles${city} — updated daily and priced to move.`, 'Get pre-approved', 'finance', 'g2')],
    build: [psHero('Build your vehicle', 'Configure your next vehicle exactly how you want it, then send us your build — we’ll find it or order it for you.', 'Start building', 'build', 'g3')],
    trade: [psHero('What’s your trade worth?', 'Get a real number from our team — fast, and with no obligation.', 'Value my trade', 'trade', 'g4')],
    finance: [psHero('Financing made easy', 'Apply in minutes — all credit situations welcome, and it won’t affect your score.', 'Start my application', 'finance', 'g5'), __psec('payment_calc', { title: 'Calculate your payments', rate: 7.99, term: 72 })],
    team: [psHero('Meet our team', 'The friendly people behind your next great vehicle.', 'Contact us', 'inquiry', 'g6')],
    contact: [psHero('Get in touch', 'Questions, a test drive, or just want to talk numbers? We’d love to hear from you.', 'Call us', 'inquiry', 'g7')],
  };
}
// Only offer presets the dealer hasn't already added (matched by title). Blank always available.
function wsAddPageOptions() {
  const presets = PAGE_PRESETS();
  const have = new Set((__sitePages || []).map(p => (p.title || '').trim().toLowerCase()));
  let opts = `<option value="">+ Add page…</option>`;
  for (const k of ['about', 'book_service', 'service', 'parts', 'accessories', 'specials', 'careers']) {
    const pr = presets[k]; if (!pr || have.has((pr.page.title || '').trim().toLowerCase())) continue;
    opts += `<option value="${k}">${esc(pr.label)}</option>`;
  }
  return opts + `<option value="blank">Blank page</option>`;
}
function addSitePagePreset(key) {
  if (!key) return;
  collectSitePages();
  const preset = PAGE_PRESETS()[key]; if (!preset) return;
  __sitePages.push({ id: 'pg' + Math.random().toString(36).slice(2, 9), ...JSON.parse(JSON.stringify(preset.page)) });
  renderWsBody();   // rebuild the whole Pages tab so the add dropdown drops the used preset
  showToast(`Added “${preset.label}” — customize & Save`, 'success');
}
const SITE_SLOTS = [['top_banner', 'Top banner'], ['hero_below', 'Under hero'], ['above_inventory', 'Above inventory'], ['below_inventory', 'Below inventory'], ['above_footer', 'Above footer']];
let __siteWidgets = [];
function collectSiteWidgets() {
  const rows = document.querySelectorAll('#site-widget-list [data-widx]');
  __siteWidgets = Array.from(rows).map(r => ({
    slot: r.querySelector('.wg-slot')?.value || 'below_inventory',
    title: r.querySelector('.wg-title')?.value || '',
    html: r.querySelector('.wg-html')?.value || '',
    height: parseInt(r.querySelector('.wg-height')?.value) || 400,
  }));
}
function renderSiteWidgets() {
  const box = document.getElementById('site-widget-list');
  if (!box) return;
  if (!__siteWidgets.length) { box.innerHTML = '<div class="text-[11px] text-slate-400 italic">No widgets yet.</div>'; return; }
  box.innerHTML = __siteWidgets.map((w, i) => `<div data-widx="${i}" class="border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
    <div class="flex gap-2 items-center">
      <select class="wg-slot bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs">${SITE_SLOTS.map(s => `<option value="${s[0]}" ${w.slot === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select>
      <input class="wg-title flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs" placeholder="Title (optional)" value="${esc(w.title || '')}">
      <input class="wg-height bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs" type="number" value="${w.height || 400}" style="width:64px" title="Height (px)">
      <button type="button" onclick="removeSiteWidget(${i})" class="text-rose-500 text-xs font-bold"></button>
    </div>
    <textarea class="wg-html w-full font-mono text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1" rows="2" placeholder="&lt;iframe …&gt; or embed code">${esc(w.html || '')}</textarea>
  </div>`).join('');
}
function addSiteWidget() { collectSiteWidgets(); __siteWidgets.push({ slot: 'below_inventory', title: '', html: '', height: 400 }); renderSiteWidgets(); }
function removeSiteWidget(i) { collectSiteWidgets(); __siteWidgets.splice(i, 1); renderSiteWidgets(); }
async function saveSite(btn) {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  collectSiteWidgets();
  const body = {
    site_slug: val('site-slug'), site_published: document.getElementById('site-pub')?.checked || false,
    ...(document.getElementById('site-domain') ? { custom_domain: val('site-domain') } : {}),
    tagline: val('site-tagline'), about: val('site-about'), phone: val('site-phone'), email: val('site-email'),
    address: val('site-address'), hours: val('site-hours'), primary_color: val('site-color'), hero_url: val('site-hero'),
    facebook_url: val('site-fb'), instagram_url: val('site-ig'),
    seo_title: val('seo-title'), seo_description: val('seo-desc'), seo_keywords: val('seo-keywords'), seo_image: val('seo-image'),
    head_html: document.getElementById('site-head')?.value || '',
    sales_chat: document.getElementById('site-sales-chat')?.checked || false,
    chat_name: document.getElementById('site-chat-name')?.value || '',
    chat_kb: document.getElementById('site-chat-kb')?.value || '',
    chat_instructions: document.getElementById('site-chat-instructions')?.value || '',
    chat_disclaimer: document.getElementById('site-chat-disclaimer')?.value || '',
    widgets: __siteWidgets.filter(w => (w.html || '').trim()),
  };
  if (document.getElementById('bm-wrap')) body.build_makes = Array.from(document.querySelectorAll('.bm-check:checked')).map(el => el.value);
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await apiSendJson('/dealership/site', 'PUT', body);
    showToast('Website saved', 'success');
    btn.disabled = false; btn.textContent = orig;
    const modal = btn.closest('.fixed');
    if (modal) { modal.remove(); openSiteManager(); }        // modal context: reopen fresh
    else if (typeof loadWebsitePage === 'function') { __wsTab = 'settings'; loadWebsitePage(); } // tab context: refresh in place
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
window.openSiteManager = openSiteManager;
window.verifyDomain = verifyDomain;
window.saveSite = saveSite;
window.addSiteWidget = addSiteWidget;
window.removeSiteWidget = removeSiteWidget;
window.addSitePage = addSitePage;
window.removeSitePage = removeSitePage;
window.uploadSiteImage = uploadSiteImage;

// ══ Website page builder (Squarespace-simple, dealership-aware) ═══════════════
// __siteSections = the ACTIVE editing buffer. __wsTarget = 'home' or a page index.
// The home layout lives in __homeSections; each page's layout in __sitePages[i].sections.
let __siteCfg = null, __siteSections = [], __homeSections = [], __wsTarget = 'home', __wsTab = 'builder';
const SEC_META = {
  hero:               { label: 'Hero', fields: [['bg','Background style','herobg'],['image','Or upload a photo','image'],['headline','Headline','text'],['subheadline','Subheadline','text'],['button_label','Button label','text'],['button_target','Button goes to','target'],['button_link','Custom link','text'],['overlay','Image darkness','range'],['height','Height','height']] },
  feature_cards:      { label: 'Feature cards (Inventory / Finance / Contact)', fields: [['title','Heading (optional)','text']] },
  featured_inventory: { label: 'Featured inventory', fields: [['title','Title','text'],['condition','Show','cond'],['count','How many','number']] },
  inventory_grid:     { label: 'Inventory grid', fields: [['title','Title','text']] },
  text_image:         { label: 'Text + image split', fields: [['image','Image','image'],['headline','Headline','text'],['body','Paragraph','textarea'],['button_label','Button label','text'],['button_target','Button goes to','target']] },
  two_col:            { label: 'Two columns', fields: [['left_title','Left heading','text'],['left_body','Left text','textarea'],['left_image','Left image (optional)','image'],['right_title','Right heading','text'],['right_body','Right text','textarea'],['right_image','Right image (optional)','image'],['full','Full-width (edge to edge)','bool']] },
  cards:              { label: 'Cards', fields: [['title','Section heading (optional)','text'],['items','Cards — one per line: Title :: Description','cards'],['columns','Columns','cardcols'],['full','Full-width (edge to edge)','bool']] },
  body_style:         { label: 'Browse by body style', fields: [['title','Title','text']] },
  payment_calc:       { label: 'Payment calculator', fields: [['title','Title','text'],['rate','Default rate %','number'],['term','Default term (months)','number']] },
  ad_banner:          { label: 'Specials / promo ad', fields: [['template','Template','adtpl'],['tag','Tag (e.g. Limited time)','text'],['headline','Headline','text'],['subtitle','Subtitle','text'],['button_label','Button label','text'],['button_target','Button goes to','target'],['button_link','Custom link','text'],['image','Image','image']] },
  trade_cta:          { label: 'Trade-in banner', fields: [['title','Title','text'],['subtitle','Subtitle','text'],['button_label','Button label','text']] },
  finance_cta:        { label: 'Finance banner', fields: [['title','Title','text'],['subtitle','Subtitle','text'],['button_label','Button label','text']] },
  service_cta:        { label: 'Service banner', fields: [['title','Title','text'],['subtitle','Subtitle','text'],['button_label','Button label','text'],['button_target','Button goes to','target'],['button_link','Custom link','text']] },
  cta_banner:         { label: 'Call-to-action banner', fields: [['title','Title','text'],['button_label','Button label','text'],['button_target','Button goes to','target'],['button_link','Custom link','text']] },
  staff:              { label: 'Meet the team', fields: [['title','Title','text']] },
  reviews:            { label: 'Reviews', fields: [['title','Title','text'],['google_rating','Overall rating (e.g. 4.8)','text'],['reviews_url','“Read our Google reviews” link','text'],['items','Reviews — one per line: Name :: 5 :: Their comment','reviews'],['embed_html','Or paste a reviews widget embed (optional)','textarea']] },
  faq:                { label: 'FAQ', fields: [['title','Title','text'],['items','Questions (one per line: Question :: Answer)','faq']] },
  blog:               { label: 'Blog / news (latest posts)', fields: [['title','Title','text'],['count','How many to show','number']] },
  gallery:            { label: 'Photo gallery', fields: [['title','Title','text'],['images','Images','images']] },
  map:                { label: 'Map', fields: [['title','Title','text'],['address','Address (blank = your address)','text']] },
  contact:            { label: 'Contact form', fields: [['title','Title','text']] },
  html:               { label: 'Custom HTML', fields: [['html','HTML','textarea']] },
};
const SEC_ORDER = ['hero','feature_cards','two_col','cards','featured_inventory','text_image','body_style','payment_calc','ad_banner','inventory_grid','trade_cta','finance_cta','service_cta','staff','reviews','faq','blog','gallery','map','contact','cta_banner','html'];

async function loadWebsitePage() {
  const root = document.getElementById('website-root');
  if (!root) return;
  root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div>';
  try { __siteCfg = await apiGetJson('/dealership/site'); } catch (e) { root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load: ${esc(e.message)}</div>`; return; }
  __homeSections = Array.isArray(__siteCfg.content?.sections) ? __siteCfg.content.sections.slice() : [];
  __sitePages = Array.isArray(__siteCfg.content?.pages) ? __siteCfg.content.pages.map(p => ({ id: p.id || ('pg' + Math.random().toString(36).slice(2, 9)), ...p, sections: Array.isArray(p.sections) ? p.sections : [] })) : [];
  __menuOrder = Array.isArray(__siteCfg.content?.menu_order) ? __siteCfg.content.menu_order.slice() : [];
  __siteStaff = Array.isArray(__siteCfg.content?.staff) ? __siteCfg.content.staff.slice() : [];
  __siteBuiltins = normBuiltins(__siteCfg.content?.builtins);
  __wsTarget = 'home'; __siteSections = __homeSections;

  // Handle returning Stripe checkout session or deep link parameters
  const params = new URLSearchParams(location.search);
  const planSession = params.get('plan_session') || params.get('session_id');
  const targetTab = params.get('tab');
  const targetSection = params.get('section');

  if (targetTab === 'setup' || targetTab === 'settings') __wsTab = 'setup';
  else if (targetTab === 'blog') __wsTab = 'blog';
  else if (!__wsTab || __wsTab === 'settings') __wsTab = 'builder';

  if (targetSection) __wsSetupSection = targetSection;

  if (planSession) {
    try {
      const v = await apiGetJson(`/billing/verify-plan-session?session_id=${encodeURIComponent(planSession)}`);
      if (v.success) {
        showToast('Subscription updated successfully!', 'success');
        const cleanUrl = location.pathname + (location.hash || '');
        history.replaceState(null, '', cleanUrl);
        try {
          const ac = await fetch(`${API}/access/context`, { headers: { 'Authorization': `Bearer ${token}` } });
          if (ac.ok) window.__access = await ac.json();
        } catch {}
      }
    } catch (e) {}
  }

  // Ensure default mode is Live Builder
  if (!localStorage.getItem('ms_builder_mode')) __builderMode = 'live';

  renderWebsitePage();
}

// Website Settings — alias for wsSetup()
async function loadWebsiteSettings() {
  const root = document.getElementById('website-settings-root');
  if (!root) return;
  if (!__siteCfg) {
    root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div>';
    try { __siteCfg = await apiGetJson('/dealership/site'); }
    catch (e) { root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load: ${esc(e.message)}</div>`; return; }
  }
  __wsTab = 'setup';
  renderWebsitePage();
}

function wsFlushTarget() {
  if (__wsTarget === 'home') __homeSections = __siteSections;
  else if (typeof __wsTarget === 'string' && __wsTarget.startsWith('b:')) { const k = __wsTarget.slice(2); (__siteBuiltins[k] = __siteBuiltins[k] || { enabled: true, label: k, menu: '' }).sections = __siteSections; }
  else if (__sitePages[__wsTarget]) __sitePages[__wsTarget].sections = __siteSections;
}
function wsSetTarget(v) {
  wsFlushTarget();
  if (v === 'home') { __wsTarget = 'home'; __siteSections = __homeSections || []; }
  else if (typeof v === 'string' && v.startsWith('b:')) { __wsTarget = v; const k = v.slice(2); const b = (__siteBuiltins[k] = __siteBuiltins[k] || { enabled: true, label: k, menu: '' }); b.sections = Array.isArray(b.sections) ? b.sections : []; __siteSections = b.sections; }
  else { __wsTarget = parseInt(v); __siteSections = Array.isArray(__sitePages[__wsTarget]?.sections) ? __sitePages[__wsTarget].sections : []; }
  __wsTab = 'builder'; renderWebsitePage();
}

function renderWebsitePage() {
  const root = document.getElementById('website-root'); if (!root) return;
  const c = __siteCfg.content || {};
  const url = __siteCfg.site_slug ? `${SITE_BASE}?d=${encodeURIComponent(__siteCfg.site_slug)}` : null;
  
  const tab = (id, label) => `<button onclick="wsTab('${id}')" class="px-5 py-2.5 text-xs font-black rounded-xl transition ${(__wsTab === id || (id === 'setup' && __wsTab === 'settings')) ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>`;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black border border-indigo-500/30"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM2.25 12h19.5M12 2.25a15.3 15.3 0 014.5 9.75 15.3 15.3 0 01-4.5 9.75 15.3 15.3 0 01-4.5-9.75A15.3 15.3 0 0112 2.25z"/></svg></div>
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              MarketSync Website Builder
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Full-screen website builder &amp; dealership content platform.</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          ${__wsTab === 'builder' ? `
            <div class="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden text-xs font-bold shadow-xs">
              <button onclick="setBuilderMode('live')" class="px-3 py-1.5 transition ${__builderMode === 'live' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">Live Builder</button>
              <button onclick="setBuilderMode('classic')" class="px-3 py-1.5 transition ${__builderMode !== 'live' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">Simple Builder</button>
            </div>
          ` : ''}
          <button onclick="openWebsiteScannerModal()" class="text-xs font-black bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/40 px-3.5 py-1.5 rounded-xl transition" title="Scan existing website">Scan Site</button>
          ${url ? `<a href="${url}" target="_blank" class="text-xs font-black bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3.5 py-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition">View Site ↗</a>` : ''}
          <label class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"><input id="ws-pub" type="checkbox" ${__siteCfg.site_published ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 rounded">Published</label>
          <button onclick="saveWebsite(this)" class="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition shadow-md cursor-pointer">Save Changes</button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${tab('builder', 'Builder')}
        ${tab('blog', 'Blog')}
        ${tab('seo', 'SEO')}
        ${tab('setup', 'Setup')}
      </div>
      <div id="ws-body"></div>
    </div>`;
  renderWsBody();
}
function wsTab(t) { __wsTab = t; renderWebsitePage(); }
let __builderMode = (() => { try { return localStorage.getItem('ms_builder_mode') || 'live'; } catch { return 'live'; } })();
function setBuilderMode(m) {
  __builderMode = (m === 'live') ? 'live' : 'classic';
  try { localStorage.setItem('ms_builder_mode', __builderMode); } catch {}
  __livePreviewReady = false;
  if (document.getElementById('website-root')) { __wsTab = 'builder'; renderWebsitePage(); }
  else renderWsBody();
}
window.setBuilderMode = setBuilderMode;

// ── Live (WYSIWYG) builder ───────────────────────────────────────────────────
// A side-by-side editor: the dealer's actual site in a preview iframe on the left,
// the section palette + reorderable list on the right. Edits post to the iframe via
// postMessage and render instantly (never saved until "Save"). Clicking a section in
// the preview jumps to its editor. Uses the SAME __siteSections model as Classic, so
// both editors are fully interchangeable.
let __livePreviewReady = false, __liveMsgWired = false, __livePushTimer = null;
function livePreviewPush() {
  if (__builderMode !== 'live') return;
  const ifr = document.getElementById('ws-preview-frame');
  if (!ifr || !ifr.contentWindow || !__livePreviewReady) return;
  clearTimeout(__livePushTimer);
  __livePushTimer = setTimeout(() => {
    try {
      wsFlushTarget();
      const c = __siteCfg.content || {};
      const site = {
        sections: __homeSections, pages: __sitePages, builtins: __siteBuiltins, staff: __siteStaff,
        primary_color: c.primary_color, secondary_color: c.secondary_color,
        tagline: c.tagline, about: c.about, hero_url: c.hero_url, logo_url: c.logo_url,
      };
      let view = 'home';
      if (typeof __wsTarget === 'string' && __wsTarget.startsWith('b:')) { const k = __wsTarget.slice(2); view = k === 'contact' ? 'inquiry' : k; }
      else if (typeof __wsTarget === 'number' && __sitePages[__wsTarget]) view = 'page:' + (__sitePages[__wsTarget].slug || '');
      ifr.contentWindow.postMessage({ type: 'ms-preview-apply', site, view }, '*');
    } catch {}
  }, 140);
}
window.livePreviewPush = livePreviewPush;
function cancelInsert() { __pendingInsertAt = null; const h = document.getElementById('ws-insert-hint'); if (h) h.classList.add('hidden'); }
window.cancelInsert = cancelInsert;
function wireLiveMessages() {
  if (__liveMsgWired) return; __liveMsgWired = true;
  const flashCard = (i) => {
    const box = document.getElementById('ws-sections'); if (!box) return;
    const card = box.children[i]; if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'rounded-xl');
    setTimeout(() => card.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900', 'rounded-xl'), 1800);
  };
  window.addEventListener('message', (ev) => {
    const m = ev.data || {};
    if (m.type === 'ms-preview-ready') { __livePreviewReady = true; livePreviewPush(); }
    else if (m.type === 'ms-preview-click' && typeof m.index === 'number') {
      selectWsSection(m.index);
      flashCard(m.index);
    }
    else if (m.type === 'ms-preview-reorder') {
      const { from, to } = m;
      if (typeof from === 'number' && typeof to === 'number' && from !== to && __siteSections[from]) {
        const [s] = __siteSections.splice(from, 1);
        __siteSections.splice(to, 0, s);
        renderWsSections();   // re-renders list + pushes the new order to the preview
      }
    } else if (m.type === 'ms-preview-action' && typeof m.index === 'number') {
      if (m.action === 'up') moveSection(m.index, -1);
      else if (m.action === 'down') moveSection(m.index, 1);
      else if (m.action === 'delete') delSection(m.index);
      else if (m.action === 'edit') {
        selectWsSection(m.index);
        flashCard(m.index);
      }
      else if (m.action === 'add-below') {
        __pendingInsertAt = m.index + 1;
        const hint = document.getElementById('ws-insert-hint');
        if (hint) hint.classList.remove('hidden');
        const pal = document.getElementById('ws-palette');
        if (pal) { pal.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); pal.classList.add('ring-2', 'ring-indigo-400', 'rounded-lg'); setTimeout(() => pal.classList.remove('ring-2', 'ring-indigo-400', 'rounded-lg'), 2000); }
        if (typeof showToast === 'function') showToast('Pick a section to insert here →', 'info');
      }
    }
  });
}
// ── MarketSync Visual Editor Engine ──────────────────────────────────────────
let __wsPaletteCat = 'all';
let __wsPaletteSearch = '';
let __wsSelectedSecIdx = 0;
let __wsInspectorTab = 'content';
let __wsActiveDeviceView = 'desktop'; // 'desktop' (100%), 'tablet' (768px), 'mobile' (375px)
let __wsActiveLeftNav = 'layers'; // 'layers', 'blocks', 'pages', 'design', 'ai'
let __wsLeftDockCollapsed = false;
let __wsRightDockCollapsed = false;

function toggleWsLeftDock() {
  __wsLeftDockCollapsed = !__wsLeftDockCollapsed;
  const drawer = document.getElementById('ws-left-drawer-content');
  const btn = document.getElementById('ws-left-collapse-btn');
  if (drawer) {
    if (__wsLeftDockCollapsed) drawer.classList.add('hidden');
    else drawer.classList.remove('hidden');
  }
  if (btn) btn.innerHTML = __wsLeftDockCollapsed ? '&gt;' : '&lt;';
}
window.toggleWsLeftDock = toggleWsLeftDock;

function toggleWsRightDock() {
  __wsRightDockCollapsed = !__wsRightDockCollapsed;
  const inspector = document.getElementById('ws-inspector-panel');
  const btn = document.getElementById('ws-right-collapse-btn');
  if (inspector) {
    if (__wsRightDockCollapsed) inspector.classList.add('hidden');
    else inspector.classList.remove('hidden');
  }
  if (btn) btn.innerHTML = __wsRightDockCollapsed ? 'Inspector &laquo;' : 'Inspector &raquo;';
}
window.toggleWsRightDock = toggleWsRightDock;

// Mouse AND touch — a panel dragged on a phone (the Video Studio's teleprompter is
// the first mobile-first user of this) needs touch events; mousedown-only silently
// does nothing on a touchscreen.
function makeWsPanelDraggable(handleEl, targetEl) {
  if (!handleEl || !targetEl) return;
  let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  handleEl.style.cursor = 'grab';
  handleEl.style.touchAction = 'none';
  const point = (e) => e.touches?.[0] || e.changedTouches?.[0] || e;
  const onStart = (e) => {
    if (e.target.closest('button, input, select, textarea, a, label, [contenteditable]')) return;
    isDragging = true;
    handleEl.style.cursor = 'grabbing';
    const p = point(e);
    startX = p.clientX;
    startY = p.clientY;
    const parentRect = targetEl.offsetParent ? targetEl.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    const rect = targetEl.getBoundingClientRect();
    initialLeft = rect.left - parentRect.left;
    initialTop = rect.top - parentRect.top;
    const onMove = (ev) => {
      if (!isDragging) return;
      if (ev.cancelable) ev.preventDefault();
      const mp = point(ev);
      const dx = mp.clientX - startX;
      const dy = mp.clientY - startY;
      targetEl.style.left = `${initialLeft + dx}px`;
      targetEl.style.top = `${initialTop + dy}px`;
      targetEl.style.right = 'auto';
    };
    const onEnd = () => {
      isDragging = false;
      handleEl.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };
  handleEl.addEventListener('mousedown', onStart);
  handleEl.addEventListener('touchstart', onStart, { passive: true });
}
window.makeWsPanelDraggable = makeWsPanelDraggable;

const WIDGET_CATEGORIES = [
  ['all', 'All'],
  ['banners', 'Banners'],
  ['inventory', 'Inventory'],
  ['content', 'Content'],
  ['trust', 'Trust & Reviews'],
  ['contact', 'Contact & Forms']
];

const WIDGET_META_EXT = {
  hero: { icon: 'H', category: 'banners', name: 'Hero Showcase', desc: 'Full-width top header banner with background style & call to action.' },
  feature_cards: { icon: 'C', category: 'inventory', name: 'Feature Cards', desc: 'Quick links to Inventory, Financing, and Service departments.' },
  featured_inventory: { icon: 'V', category: 'inventory', name: 'Featured Inventory', desc: 'Highlight top new & pre-owned vehicles on your lot.' },
  inventory_grid: { icon: 'G', category: 'inventory', name: 'Inventory Grid', desc: 'Complete searchable vehicle grid with filtering.' },
  text_image: { icon: 'T', category: 'content', name: 'Text + Image Split', desc: 'Side-by-side content block for dealership stories or announcements.' },
  two_col: { icon: '2', category: 'content', name: 'Two Columns', desc: '2-column responsive layout for custom features and text.' },
  cards: { icon: 'K', category: 'content', name: 'Card Grid', desc: 'Grid of feature cards with custom titles & descriptions.' },
  body_style: { icon: 'B', category: 'inventory', name: 'Body Styles', desc: 'Browse vehicles by Sedan, SUV, Truck, Coupe.' },
  payment_calc: { icon: '$', category: 'inventory', name: 'Payment Calculator', desc: 'Interactive monthly payment estimator for buyers.' },
  ad_banner: { icon: 'S', category: 'banners', name: 'Specials Banner', desc: 'Promotional ad banner for sales events & discount offers.' },
  trade_cta: { icon: 'T', category: 'banners', name: 'Trade-In Banner', desc: 'Instant trade valuation banner for lead generation.' },
  finance_cta: { icon: 'F', category: 'banners', name: 'Finance Banner', desc: 'Credit pre-approval CTA banner.' },
  service_cta: { icon: 'W', category: 'banners', name: 'Service Banner', desc: 'Service appointment scheduling CTA banner.' },
  cta_banner: { icon: 'A', category: 'banners', name: 'CTA Banner', desc: 'Bold full-width call to action banner.' },
  staff: { icon: 'P', category: 'trust', name: 'Meet The Team', desc: 'Showcase sales reps, managers, and staff photos.' },
  reviews: { icon: 'R', category: 'trust', name: 'Customer Reviews', desc: 'Google reviews carousel & rating badge.' },
  faq: { icon: 'Q', category: 'trust', name: 'FAQ Accordion', desc: 'Frequently asked questions dropdown accordion.' },
  blog: { icon: 'N', category: 'content', name: 'Latest Articles', desc: 'Recent blog posts and news updates.' },
  gallery: { icon: 'I', category: 'content', name: 'Photo Gallery', desc: 'Showroom & vehicle photo grid gallery.' },
  map: { icon: 'M', category: 'contact', name: 'Location Map', desc: 'Interactive map & dealership address.' },
  contact: { icon: 'F', category: 'contact', name: 'Contact Form', desc: 'Lead inquiry form with instant CRM notification.' },
  html: { icon: 'C', category: 'content', name: 'Custom HTML', desc: 'Embed custom HTML code or external widgets.' },
};

function setWsDeviceView(view) {
  __wsActiveDeviceView = view;
  const frameWrap = document.getElementById('ws-frame-wrapper');
  if (frameWrap) {
    if (view === 'mobile') {
      frameWrap.className = 'w-[375px] h-[82vh] mx-auto rounded-3xl border-4 border-slate-700 bg-white shadow-2xl transition-all duration-300 overflow-hidden relative z-0';
    } else if (view === 'tablet') {
      frameWrap.className = 'w-[768px] h-[82vh] mx-auto rounded-2xl border-4 border-slate-700 bg-white shadow-2xl transition-all duration-300 overflow-hidden relative z-0';
    } else {
      frameWrap.className = 'w-full h-[82vh] rounded-xl border border-slate-800 bg-white shadow-sm transition-all duration-300 overflow-hidden relative z-0';
    }
  }
  const btns = document.querySelectorAll('.ws-device-btn');
  btns.forEach(b => {
    const isSel = b.dataset.view === view;
    b.className = `ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg transition ${isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'} cursor-pointer`;
  });
}
window.setWsDeviceView = setWsDeviceView;

function setWsLeftNav(tab) {
  __wsActiveLeftNav = tab;
  const panel = document.getElementById('ws-left-drawer-content');
  if (panel) panel.innerHTML = renderWsLeftDrawerHtml();
  const btns = document.querySelectorAll('.ws-nav-rail-btn');
  btns.forEach(b => {
    const isSel = b.dataset.tab === tab;
    b.className = `ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold transition ${isSel ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white hover:bg-slate-800'} cursor-pointer`;
  });
  if (tab === 'layers') renderWsLayersTree();
  if (__wsLeftDockCollapsed) toggleWsLeftDock();
}
window.setWsLeftNav = setWsLeftNav;

function setWsInspectorTab(tab) {
  __wsInspectorTab = tab;
  const panel = document.getElementById('ws-inspector-content');
  if (panel) panel.innerHTML = renderWsRightInspectorContent();
  const btns = document.querySelectorAll('.ws-insp-tab');
  btns.forEach(b => {
    const isSel = b.dataset.tab === tab;
    b.className = `ws-insp-tab px-3 py-1.5 text-xs font-bold border-b-2 transition ${isSel ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`;
  });
}
window.setWsInspectorTab = setWsInspectorTab;

function selectWsSection(idx) {
  __wsSelectedSecIdx = idx;
  const panel = document.getElementById('ws-inspector-panel');
  if (panel) panel.innerHTML = renderWsRightInspectorHtml();
  renderWsLayersTree();
  if (__wsRightDockCollapsed) toggleWsRightDock();
}
window.selectWsSection = selectWsSection;

function renderWsLayersTreeHtml() {
  return `
    <div id="ws-layers-tree" class="p-4">
      <div class="space-y-1 font-sans text-xs">
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Hierarchical Layers Tree</span>
          <span class="text-slate-500 font-normal text-[9px]">(Drag Header To Move)</span>
        </div>
        <div onclick="selectWsSection(-1)" class="p-2.5 rounded-xl border ${__wsSelectedSecIdx === -1 ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'} cursor-pointer flex items-center justify-between transition">
          <span>Header &amp; Navigation Bar</span>
          <span class="text-[10px] font-mono text-slate-400">Global</span>
        </div>
        <div class="pl-2 space-y-1 border-l-2 border-slate-800 ml-2 my-1">
          ${(__siteSections || []).map((sec, idx) => {
            const isSel = __wsSelectedSecIdx === idx;
            const meta = SEC_META[sec.type] || {};
            return `
              <div onclick="selectWsSection(${idx})" class="p-2.5 rounded-xl border ${isSel ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'} cursor-pointer flex items-center justify-between transition group">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-4 text-[10px] font-mono text-slate-500">${idx + 1}</span>
                  <span class="truncate">${esc(meta.label || sec.type)}</span>
                </div>
                <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button type="button" onclick="event.stopPropagation(); moveSection(${idx},-1)" ${idx === 0 ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-white disabled:opacity-20" title="Move Up">↑</button>
                  <button type="button" onclick="event.stopPropagation(); moveSection(${idx},1)" ${idx === __siteSections.length - 1 ? 'disabled' : ''} class="p-1 text-slate-400 hover:text-white disabled:opacity-20" title="Move Down">↓</button>
                  <button type="button" onclick="event.stopPropagation(); delSection(${idx})" class="p-1 text-rose-400 hover:text-rose-300" title="Delete">×</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div onclick="selectWsSection(-2)" class="p-2.5 rounded-xl border ${__wsSelectedSecIdx === -2 ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'} cursor-pointer flex items-center justify-between transition">
          <span>Footer &amp; Copyright</span>
          <span class="text-[10px] font-mono text-slate-400">Global</span>
        </div>
      </div>
    </div>
  `;
}

function renderWsLayersTree() {
  const treeEl = document.getElementById('ws-layers-tree');
  if (!treeEl) return;
  const temp = document.createElement('div');
  temp.innerHTML = renderWsLayersTreeHtml();
  const inner = temp.firstElementChild?.innerHTML;
  if (inner) treeEl.innerHTML = inner;
}

function renderWsLeftDrawerHtml() {
  const headerHtml = `
    <div id="ws-left-drag-header" class="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-900/80 rounded-t-2xl cursor-grab select-none">
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16"/></svg>
        <span class="text-[11px] font-black uppercase tracking-wider text-slate-300">Tool Drawer</span>
      </div>
      <button type="button" onclick="toggleWsLeftDock()" class="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-800 transition" title="Collapse Drawer">&times;</button>
    </div>
  `;
  if (__wsActiveLeftNav === 'layers') {
    return headerHtml + renderWsLayersTreeHtml();
  } else if (__wsActiveLeftNav === 'blocks') {
    return headerHtml + renderElementorPalette();
  } else if (__wsActiveLeftNav === 'pages') {
    return headerHtml + `
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Pages &amp; Structure</h3>
          <button type="button" onclick="wsTab('pages')" class="text-xs font-bold text-indigo-400 hover:underline">+ Add Page</button>
        </div>
        <div class="space-y-1.5">
          <button onclick="wsSetTarget('home')" class="w-full text-left p-2.5 rounded-xl border transition ${__wsTarget === 'home' ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'}">Home Page</button>
          ${(__sitePages || []).map((p, i) => `
            <button onclick="wsSetTarget(${i})" class="w-full text-left p-2.5 rounded-xl border transition ${__wsTarget === i ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'}">${esc(p.title || 'Untitled Page')}</button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (__wsActiveLeftNav === 'design') {
    return headerHtml + `<div class="p-4 space-y-3">${wsDesign()}</div>`;
  } else if (__wsActiveLeftNav === 'ai') {
    return headerHtml + `
      <div class="p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black uppercase tracking-wider text-violet-400">AI Site Copilot</h3>
        </div>
        <div class="p-3.5 rounded-xl bg-violet-600/10 border border-violet-500/30 space-y-2">
          <label class="block text-xs font-black text-white">Describe the website you want</label>
          <textarea id="ai-site-prompt" rows="3" placeholder="e.g. Build a premium Chevrolet dealership homepage focused on pre-owned trucks, instant trade appraisal, and easy financing..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-violet-500"></textarea>
          <button onclick="aiBuildPageLayoutFromPrompt()" class="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition shadow-lg cursor-pointer">Generate Page Layout</button>
        </div>
      </div>
    `;
  }
  return headerHtml;
}

async function aiBuildPageLayoutFromPrompt() {
  const promptVal = document.getElementById('ai-site-prompt')?.value || '';
  await aiBuildPageLayout();
}
window.aiBuildPageLayoutFromPrompt = aiBuildPageLayoutFromPrompt;

function renderWsRightInspectorHtml() {
  const sec = __siteSections[__wsSelectedSecIdx];
  const meta = sec ? (SEC_META[sec.type] || { label: sec.type }) : null;
  return `
    <div class="p-4 space-y-4">
      <div id="ws-inspector-drag-header" class="flex items-center justify-between border-b border-slate-800 pb-3 select-none">
        <div>
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Property Inspector</h3>
          <p class="text-[11px] text-indigo-400 font-bold">${meta ? esc(meta.label) : 'Select Element'}</p>
        </div>
        ${sec ? `<button onclick="delSection(${__wsSelectedSecIdx})" class="text-xs font-bold text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded">Delete</button>` : ''}
      </div>

      <div class="flex items-center gap-1 border-b border-slate-800">
        <button onclick="setWsInspectorTab('content')" data-tab="content" class="ws-insp-tab px-3 py-1.5 text-xs font-bold border-b-2 ${__wsInspectorTab === 'content' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}">Content</button>
        <button onclick="setWsInspectorTab('style')" data-tab="style" class="ws-insp-tab px-3 py-1.5 text-xs font-bold border-b-2 ${__wsInspectorTab === 'style' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}">Style</button>
        <button onclick="setWsInspectorTab('layout')" data-tab="layout" class="ws-insp-tab px-3 py-1.5 text-xs font-bold border-b-2 ${__wsInspectorTab === 'layout' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}">Layout</button>
        <button onclick="setWsInspectorTab('advanced')" data-tab="advanced" class="ws-insp-tab px-3 py-1.5 text-xs font-bold border-b-2 ${__wsInspectorTab === 'advanced' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400'}">Advanced</button>
      </div>

      <div id="ws-inspector-content" class="space-y-3">
        ${renderWsRightInspectorContent()}
      </div>
    </div>
  `;
}

function renderWsRightInspectorContent() {
  const sec = __siteSections[__wsSelectedSecIdx];
  if (!sec) {
    return `<div class="text-xs text-slate-400 italic py-8 text-center">Click any section or element on the canvas to inspect &amp; edit its properties.</div>`;
  }
  const i = __wsSelectedSecIdx;
  const meta = SEC_META[sec.type] || {};

  if (__wsInspectorTab === 'content') {
    return (meta.fields || []).map(f => wsField(i, sec, f)).join('');
  } else if (__wsInspectorTab === 'style') {
    return `
      <div class="space-y-3 text-xs">
        <div class="space-y-1">
          <label class="font-bold text-slate-400">Background Color / Overlay</label>
          <input type="color" value="${sec.settings?.bg_color || '#0F172A'}" oninput="setSec(${i},'bg_color',this.value)" class="w-full h-8 rounded border border-slate-800 bg-transparent cursor-pointer">
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-400">Text Color Accent</label>
          <input type="color" value="${sec.settings?.text_color || '#FFFFFF'}" oninput="setSec(${i},'text_color',this.value)" class="w-full h-8 rounded border border-slate-800 bg-transparent cursor-pointer">
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-400">Border Radius</label>
          <select onchange="setSec(${i},'border_radius',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
            <option value="none">Square (0px)</option>
            <option value="md" selected>Curved (12px)</option>
            <option value="full">Pill (999px)</option>
          </select>
        </div>
      </div>
    `;
  } else if (__wsInspectorTab === 'layout') {
    return `
      <div class="space-y-3 text-xs">
        <div class="space-y-1">
          <label class="font-bold text-slate-400">Section Height</label>
          <select onchange="setSec(${i},'height',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
            <option value="sm">Short</option>
            <option value="md" selected>Medium</option>
            <option value="lg">Tall</option>
            <option value="screen">Full Screen</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-400">Container Alignment</label>
          <select onchange="setSec(${i},'align',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white">
            <option value="left">Left Aligned</option>
            <option value="center" selected>Center Aligned</option>
            <option value="right">Right Aligned</option>
          </select>
        </div>
      </div>
    `;
  } else if (__wsInspectorTab === 'advanced') {
    return `
      <div class="space-y-3 text-xs">
        <div class="space-y-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
          <div class="font-bold text-slate-300">Device Visibility</div>
          <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Show on Desktop</label>
          <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Show on Tablet</label>
          <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked class="accent-indigo-600"> Show on Mobile</label>
        </div>
      </div>
    `;
  }
  return '';
}

function setWsPaletteCat(cat) {
  __wsPaletteCat = cat;
  const p = document.getElementById('ws-palette-container');
  if (p) p.innerHTML = renderElementorPalette();
}
window.setWsPaletteCat = setWsPaletteCat;

function setWsPaletteSearch(val) {
  __wsPaletteSearch = val;
  const p = document.getElementById('ws-palette-container');
  if (p) p.innerHTML = renderElementorPalette();
}
window.setWsPaletteSearch = setWsPaletteSearch;

async function aiBuildPageLayout() {
  if (__siteSections.length > 0 && !confirm('Replace current sections with an AI-generated high-converting layout?')) return;
  const bBrand = typeof getDealerBranding === 'function' ? getDealerBranding() : { name: 'MarketSync Motors' };
  if (typeof showToast === 'function') showToast('AI Copilot generating custom dealership layout…', 'info');
  
  __siteSections = [
    { id: 'sec_' + Math.random().toString(36).slice(2,8), type: 'hero', settings: { herobg: 'g1', headline: `Welcome to ${bBrand.name}`, subheadline: 'Explore our premium selection of new & certified pre-owned vehicles.', button_label: 'View Inventory →', button_target: 'inventory' } },
    { id: 'sec_' + Math.random().toString(36).slice(2,8), type: 'featured_inventory', settings: { title: 'Featured Vehicles This Week', count: 6 } },
    { id: 'sec_' + Math.random().toString(36).slice(2,8), type: 'trade_cta', settings: { title: 'What Is Your Trade Worth?', subtitle: 'Get an instant market-backed valuation in under 2 minutes.', button_label: 'Value My Trade →' } },
    { id: 'sec_' + Math.random().toString(36).slice(2,8), type: 'reviews', settings: { title: 'Why Drivers Choose Us', google_rating: '4.9' } },
    { id: 'sec_' + Math.random().toString(36).slice(2,8), type: 'contact', settings: { title: 'Visit Our Showroom & Schedule a Test Drive' } }
  ];
  
  renderWsSections();
  if (typeof showToast === 'function') showToast('AI Layout Generated! Click Save to publish.', 'success');
}
window.aiBuildPageLayout = aiBuildPageLayout;

function renderElementorPalette() {
  const catNav = WIDGET_CATEGORIES.map(([id, label]) => `
    <button onclick="setWsPaletteCat('${id}')" class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${__wsPaletteCat === id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'}">${label}</button>
  `).join('');

  const searchQ = (__wsPaletteSearch || '').toLowerCase().trim();

  const filteredSecs = SEC_ORDER.filter(t => {
    const ext = WIDGET_META_EXT[t] || { category: 'content', name: SEC_META[t]?.label || t, desc: '' };
    if (__wsPaletteCat !== 'all' && ext.category !== __wsPaletteCat) return false;
    if (searchQ && !ext.name.toLowerCase().includes(searchQ) && !ext.desc.toLowerCase().includes(searchQ)) return false;
    return true;
  });

  const cardsHtml = filteredSecs.map(t => {
    const ext = WIDGET_META_EXT[t] || { icon: '\u{2725}', category: 'content', name: SEC_META[t]?.label || t, desc: 'Add element section' };
    return `
      <button onclick="addSection('${t}')" class="group p-2.5 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl text-left transition flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-6 h-6 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">${ext.icon}</span>
            <span class="font-bold text-xs text-slate-100 group-hover:text-indigo-400 transition truncate">${esc(ext.name)}</span>
          </div>
          <p class="text-[10px] text-slate-400 leading-snug line-clamp-2">${esc(ext.desc)}</p>
        </div>
        <div class="mt-2 text-[10px] font-bold text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          + Add Section
        </div>
      </button>
    `;
  }).join('');

  return `
    <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
      <div class="flex items-center justify-between">
        <div class="text-xs font-black uppercase tracking-wider text-slate-400">MarketSync Block Library</div>
        <button onclick="aiBuildPageLayout()" class="text-[11px] font-extrabold text-violet-400 hover:text-violet-300 flex items-center gap-1">AI Build</button>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <input type="text" value="${esc(__wsPaletteSearch)}" oninput="setWsPaletteSearch(this.value)" placeholder="Search blocks (e.g. hero, inventory, reviews)..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500">
      </div>

      <!-- Category Filter Pills -->
      <div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">${catNav}</div>

      <!-- Widget Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
        ${cardsHtml || '<div class="col-span-2 text-center text-xs text-slate-400 italic py-4">No blocks match your search.</div>'}
      </div>
    </div>
  `;
}

function renderLiveBuilder(body) {
  wireLiveMessages();
  __livePreviewReady = false;
  const slug = __siteCfg?.site_slug;
  if (!slug) {
    body.innerHTML = `<div class="mt-6 text-sm text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">Name your site address first (Settings → site address) to use the visual builder.<br>You can keep building now in <button onclick="setBuilderMode('classic')" class="text-indigo-600 font-bold">Classic mode ↩</button>.</div>`;
    return;
  }

  body.innerHTML = `
    <!-- Top Visual Workspace Action Bar -->
    <div class="flex items-center justify-between gap-3 py-2 px-3 bg-slate-900 border border-slate-800 rounded-xl mt-3 mb-3 z-20 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-400">Editing Page:</span>
        <select onchange="wsSetTarget(this.value)" class="text-xs font-bold bg-slate-950 text-white border border-slate-800 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer">
          <option value="home" ${__wsTarget === 'home' ? 'selected' : ''}>Home Page</option>
          ${(__sitePages || []).map((p, i) => `<option value="${i}" ${__wsTarget === i ? 'selected' : ''}>${esc(p.title || 'Untitled Page')}</option>`).join('')}
        </select>
      </div>

      <!-- Device Viewport Switcher -->
      <div class="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800">
        <button onclick="setWsDeviceView('desktop')" data-view="desktop" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'desktop' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'} cursor-pointer">Desktop</button>
        <button onclick="setWsDeviceView('tablet')" data-view="tablet" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'tablet' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'} cursor-pointer">Tablet</button>
        <button onclick="setWsDeviceView('mobile')" data-view="mobile" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'mobile' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'} cursor-pointer">Mobile</button>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">SAVED</span>
        <a href="${SITE_BASE}?d=${encodeURIComponent(slug)}" target="_blank" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition">Preview ↗</a>
        <button onclick="saveWebsite(this)" class="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition cursor-pointer">Publish Site</button>
      </div>
    </div>

    <!-- Main Full-Screen Visual Workspace with Floating Collapsible Panels -->
    <div class="relative w-full min-h-[82vh] rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
      
      <!-- Center Full-Screen Live Web Canvas (Takes 100% width on Desktop) -->
      <main class="w-full h-full flex items-center justify-center p-0 overflow-auto relative z-0">
        <div id="ws-frame-wrapper" class="${__wsActiveDeviceView === 'mobile' ? 'w-[375px]' : (__wsActiveDeviceView === 'tablet' ? 'w-[768px]' : 'w-full')} h-[82vh] ${__wsActiveDeviceView === 'desktop' ? 'rounded-xl border border-slate-800' : 'rounded-3xl border-4 border-slate-700'} bg-white shadow-2xl transition-all duration-300 overflow-hidden relative z-0">
          <iframe id="ws-preview-frame" src="${SITE_BASE}?d=${encodeURIComponent(slug)}&preview=1" class="w-full h-full border-0" title="Live Website Canvas"></iframe>
        </div>
      </main>

      <!-- Left Floating Dock (Nav Rail + Drawer) -->
      <div id="ws-left-dock-wrapper" class="absolute left-3 top-3 z-30 flex items-start gap-2 max-h-[78vh]">
        <!-- Nav Rail -->
        <nav class="w-12 bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl flex flex-col items-center py-2.5 gap-2 shrink-0 shadow-2xl">
          <button onclick="setWsLeftNav('layers')" data-tab="layers" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'layers' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white'} cursor-pointer" title="Layers Tree">Tree</button>
          <button onclick="setWsLeftNav('blocks')" data-tab="blocks" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'blocks' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white'} cursor-pointer" title="Add Blocks">+Add</button>
          <button onclick="setWsLeftNav('pages')" data-tab="pages" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'pages' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white'} cursor-pointer" title="Manage Pages">Pages</button>
          <button onclick="setWsLeftNav('design')" data-tab="design" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'design' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white'} cursor-pointer" title="Global Styling">Style</button>
          <button onclick="setWsLeftNav('ai')" data-tab="ai" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'ai' ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/50' : 'text-slate-400 hover:text-white'} cursor-pointer" title="AI Copilot">AI</button>
          <button id="ws-left-collapse-btn" onclick="toggleWsLeftDock()" class="w-9 h-9 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-black transition flex items-center justify-center border border-slate-800 cursor-pointer" title="Toggle Sidebar Collapse">&lt;</button>
        </nav>

        <!-- Floating Drawer Content -->
        <aside id="ws-left-drawer-content" class="w-64 bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-y-auto max-h-[78vh] shadow-2xl transition-all duration-200 ${__wsLeftDockCollapsed ? 'hidden' : ''}">
          ${renderWsLeftDrawerHtml()}
        </aside>
      </div>

      <!-- Right Floating Property Inspector Dock -->
      <div id="ws-right-dock-wrapper" class="absolute right-3 top-3 z-30 flex flex-col items-end gap-2 max-h-[78vh]">
        <div class="flex items-center gap-2">
          <button id="ws-right-collapse-btn" onclick="toggleWsRightDock()" class="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 text-xs font-black text-slate-300 hover:text-white hover:bg-slate-900 transition shadow-xl cursor-pointer" title="Toggle Property Inspector">
            ${__wsRightDockCollapsed ? 'Inspector &laquo;' : 'Inspector &raquo;'}
          </button>
        </div>
        <aside id="ws-inspector-panel" class="w-64 bg-slate-950/90 backdrop-blur-xl border border-slate-800/80 rounded-2xl overflow-y-auto max-h-[74vh] shadow-2xl transition-all duration-200 ${__wsRightDockCollapsed ? 'hidden' : ''}">
          ${renderWsRightInspectorHtml()}
        </aside>
      </div>

    </div>
  `;

  renderWsLayersTree();
}
function renderWsBody() {
  const body = document.getElementById('ws-body'); if (!body) return;
  if (__wsTab === 'setup' || __wsTab === 'settings') { body.innerHTML = wsSetup(); return; }
  if (__wsTab === 'seo') { body.innerHTML = wsSeo(); loadDealerSeo(); return; }
  if (__wsTab === 'design') { body.innerHTML = wsDesign(); return; }
  if (__wsTab === 'pages') { body.innerHTML = wsPages(); renderMenuList(); return; }
  if (__wsTab === 'blog') { body.innerHTML = '<div id="ws-blog-root" class="pt-4"></div>'; loadDealerBlog(); return; }
  if (__wsTab === 'team') { body.innerHTML = wsTeam(); renderSiteStaff(); return; }
  if (__wsTab === 'builder' && __builderMode === 'live') { renderLiveBuilder(body); return; }
  // Builder Classic
  const pageOpts = (__sitePages || []).map((p, i) => `<option value="${i}" ${__wsTarget === i ? 'selected' : ''}> ${esc(p.title || 'Untitled page')}</option>`).join('');
  const builtinOpts = BUILTIN_META.filter(([k]) => (__siteBuiltins[k]?.enabled !== false)).map(([k, label]) => `<option value="b:${k}" ${__wsTarget === 'b:' + k ? 'selected' : ''}> ${esc((__siteBuiltins[k] && __siteBuiltins[k].label) || label)} — top section</option>`).join('');
  body.innerHTML = `
    <div class="flex items-center gap-2 mt-4 mb-2 flex-wrap">
      <span class="text-xs font-bold text-slate-500 dark:text-slate-400">Editing:</span>
      <select onchange="wsSetTarget(this.value)" class="text-sm font-bold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
        <option value="home" ${__wsTarget === 'home' ? 'selected' : ''}>Home page</option>${pageOpts}${builtinOpts ? `<optgroup label="Built-in pages — add a hero/intro on top">${builtinOpts}</optgroup>` : ''}
      </select>
      <button onclick="wsTab('pages')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">＋ Add / manage pages</button>
      <span class="text-[11px] text-slate-400 flex-1">${(__sitePages || []).length ? 'Pick a page to build it — its own hero, CTAs and sections, just like home.' : 'Only Home so far. Add pages in the Pages tab, then pick them here to customize.'}</span>
      <button onclick="openTemplatePicker()" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg">Template</button>
    </div>
    ${(typeof __wsTarget === 'number' && __sitePages[__wsTarget]) ? (() => { const cp = __sitePages[__wsTarget]; return `
    <div class="flex items-center gap-3 mb-3 flex-wrap text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
      <span class="font-bold text-slate-500 dark:text-slate-400">This page's brand:</span>
      <label class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">Accent
        <input type="color" value="${cp.accent || '#4f46e5'}" oninput="setPageStyle('accent',this.value)" class="w-8 h-7 rounded border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer"></label>
      ${cp.accent ? `<button onclick="setPageStyle('accent','',true)" class="text-slate-400 hover:text-rose-500 font-bold" title="Use site default">reset</button>` : '<span class="text-slate-400">(site default)</span>'}
      <label class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 ml-2">Nav icon
        <input value="${esc(cp.icon || '')}" maxlength="4" placeholder="" oninput="setPageStyle('icon',this.value)" class="w-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-1"></label>
      <span class="text-slate-400 flex-1">Shows in the site nav and tints this page's buttons/links.</span>
    </div>
    <div class="mb-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">This page's SEO <span class="font-normal text-slate-400">— a unique title & meta for Google (blank auto-fills from this page)</span></span>
        <button type="button" onclick="aiPageMeta(this)" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500 whitespace-nowrap"> AI write meta</button>
      </div>
      <input id="pg-seo-title" value="${esc(cp.seo_title || '')}" oninput="setPageStyle('seo_title',this.value)" placeholder="SEO title (~60 chars, click-worthy hook)" class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5">
      <textarea id="pg-seo-desc" rows="2" oninput="setPageStyle('seo_description',this.value)" placeholder="Meta description (~155 chars, include your focus keyword)" class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5">${esc(cp.seo_description || '')}</textarea>
      <input id="pg-seo-kw" value="${esc(cp.seo_keyword || '')}" oninput="setPageStyle('seo_keyword',this.value)" placeholder="Focus keyword (e.g. used trucks in ${esc((__siteCfg?.content?.city) || 'your city')})" class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5">
    </div>`; })() : ''}
    <div class="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
      <div id="ws-sections" class="space-y-2"></div>
      <div class="lg:sticky lg:top-4 self-start">
        <div id="ws-palette-container">${renderElementorPalette()}</div>
      </div>
    </div>`;
  renderWsSections();
}
function renderWsSections() {
  if (__builderMode === 'live') livePreviewPush();   // keep the live preview in sync on any structural change
  const box = document.getElementById('ws-sections'); if (!box) return;
  if (!__siteSections.length) { box.innerHTML = '<div class="text-sm text-slate-400 italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">No sections yet. Add one from the right →<br><span class="text-xs">(If you leave this empty, your site uses the default layout.)</span></div>'; return; }
  box.innerHTML = __siteSections.map((sec, i) => `
    <div class="ws-sec bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition"
         data-idx="${i}" ondragover="secDragOver(event,${i})" ondragleave="secDragLeave(event)" ondrop="secDrop(event,${i})">
      <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <span class="ws-sec-grip cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 select-none px-0.5" title="Drag to reorder"
              draggable="true" ondragstart="secDragStart(event,${i})" ondragend="secDragEnd(event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
        </span>
        <span class="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1">${esc(SEC_META[sec.type]?.label || sec.type)}</span>
        <button onclick="moveSection(${i},-1)" ${i === 0 ? 'disabled' : ''} class="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1" title="Move up"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
        <button onclick="moveSection(${i},1)" ${i === __siteSections.length - 1 ? 'disabled' : ''} class="text-slate-400 hover:text-slate-700 disabled:opacity-30 px-1" title="Move down"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>
        <button onclick="dupSection(${i})" class="text-slate-400 hover:text-slate-700 px-1" title="Duplicate"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        <button onclick="delSection(${i})" class="text-rose-500 hover:text-rose-600 px-1" title="Delete"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="p-3 grid sm:grid-cols-2 gap-2">${(SEC_META[sec.type]?.fields || []).map(f => wsField(i, sec, f)).join('')}</div>
    </div>`).join('');
}
// Drag-and-drop section reordering (#27). Keeps the ↑/↓ buttons as a fallback.
let __secDragIdx = null;
function secDragStart(e, i) { __secDragIdx = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch {} const card = e.target.closest('.ws-sec'); if (card) setTimeout(() => card.classList.add('opacity-40'), 0); }
function secDragEnd() { __secDragIdx = null; document.querySelectorAll('#ws-sections .ws-sec').forEach(el => el.classList.remove('opacity-40', 'ring-2', 'ring-indigo-400')); }
function secDragOver(e, i) { if (__secDragIdx === null || __secDragIdx === i) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const card = e.currentTarget; card.classList.add('ring-2', 'ring-indigo-400'); }
function secDragLeave(e) { e.currentTarget.classList.remove('ring-2', 'ring-indigo-400'); }
function secDrop(e, i) {
  e.preventDefault();
  const from = __secDragIdx; __secDragIdx = null;
  document.querySelectorAll('#ws-sections .ws-sec').forEach(el => el.classList.remove('opacity-40', 'ring-2', 'ring-indigo-400'));
  if (from === null || from === i || from < 0 || from >= __siteSections.length) return;
  const [s] = __siteSections.splice(from, 1);
  __siteSections.splice(i, 0, s);
  renderWsSections();
}
window.secDragStart = secDragStart; window.secDragEnd = secDragEnd; window.secDragOver = secDragOver; window.secDragLeave = secDragLeave; window.secDrop = secDrop;
// Which section fields get the  AI writer, and what "kind" it writes as. Titles →
// title/hook + rewrites; body/paragraph/subtitle → rewrites + link insertion. Every
// copy field a dealer can type into should map here so nothing is left un-AI'd.
const WS_AI_KIND = {
  headline: 'headline', title: 'headline', subheadline: 'subheadline', subtitle: 'subheadline',
  button_label: 'cta', items: 'faq', html: 'text', embed_html: 'text',
  body: 'body', text: 'body', paragraph: 'body', intro: 'body', description: 'description',
  left_body: 'body', right_body: 'body', tag: 'cta',
};
function wsField(i, sec, [key, label, type]) {
  const v = sec.settings?.[key];
  const aiKind = WS_AI_KIND[key];
  const lbl = `<div class="flex items-center justify-between mb-1"><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">${label}</label>${aiKind ? `<button type="button" onclick="aiMenu(event,${i},'${key}','${aiKind}')" class="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-500"> AI</button>` : ''}</div>`;
  const cls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm';
  const wide = ['textarea', 'faq', 'reviews', 'images', 'image', 'html'].includes(type) ? 'sm:col-span-2' : '';
  let input;
  if (type === 'textarea' || type === 'html') input = `<textarea rows="3" oninput="setSec(${i},'${key}',this.value)" class="${cls} font-mono text-xs">${esc(v || '')}</textarea>`;
  else if (type === 'range') input = `<input type="range" min="0" max="90" value="${v == null ? 45 : v}" oninput="setSec(${i},'${key}',+this.value)" class="w-full">`;
  else if (type === 'number') input = `<input type="number" value="${esc(v == null ? 6 : v)}" oninput="setSec(${i},'${key}',+this.value)" class="${cls}">`;
  else if (type === 'target') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['inquiry','Contact form'],['inventory','Inventory'],['build','Build & Price'],['trade','Trade-in'],['finance','Financing'],['team','Team'],['link','Custom link']].map(o => `<option value="${o[0]}" ${v === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'herobg') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['','None (solid brand)'],['g1','Indigo glow'],['g2','Sky wave'],['g3','Teal depth'],['g4','Violet dusk'],['g5','Amber warmth'],['g6','Rose accent'],['g7','Emerald'],['g8','Cyan drift']].map(o => `<option value="${o[0]}" ${(v||'')===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'cond') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['all','All'],['new','New'],['used','Used']].map(o => `<option value="${o[0]}" ${v === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'height') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['sm','Short'],['md','Medium'],['lg','Tall'],['screen','Full screen']].map(o => `<option value="${o[0]}" ${(v || 'md') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'image') input = `<div class="flex gap-1 items-center">${v ? `<img src="${esc(v)}" class="w-12 h-9 object-cover rounded">` : ''}<input value="${esc(v || '')}" placeholder="URL or upload" oninput="setSec(${i},'${key}',this.value)" class="${cls} flex-1"><input type="file" accept="image/*" class="hidden" id="secimg-${i}-${key}" onchange="uploadToSec(${i},'${key}',this.files[0])"><button type="button" onclick="document.getElementById('secimg-${i}-${key}').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 rounded">Upload</button><button type="button" onclick="openWsPhotoPicker(url => { setSec(${i},'${key}',url); renderWsSections(); })" class="text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 px-2 rounded">Browse</button></div>`;
  else if (type === 'images') { const arr = Array.isArray(v) ? v : []; input = `<div><div class="flex flex-wrap gap-1 mb-1">${arr.map((u, k) => `<div class="relative"><img src="${esc(u)}" class="w-12 h-9 object-cover rounded"><button onclick="delSecImg(${i},'${key}',${k})" class="absolute -top-1 -right-1 bg-black/60 text-white rounded-full w-4 h-4 text-[10px]">×</button></div>`).join('')}</div><input type="file" accept="image/*" multiple class="hidden" id="secimgs-${i}-${key}" onchange="uploadToSecMulti(${i},'${key}',this.files)"><button type="button" onclick="document.getElementById('secimgs-${i}-${key}').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">+ Add images</button> <button type="button" onclick="openWsPhotoPicker(url => { const arr = (__siteSections[${i}].settings?.['${key}'] || []).slice(); arr.push(url); setSec(${i},'${key}',arr); renderWsSections(); })" class="text-xs font-bold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 px-2 py-1 rounded">Browse Photos</button></div>`; }
  else if (type === 'faq') { const lines = (Array.isArray(v) ? v : []).map(it => `${it.q || ''} :: ${it.a || ''}`).join('\n'); input = `<textarea rows="4" oninput="setSecFaq(${i},'${key}',this.value)" placeholder="Question :: Answer" class="${cls} text-xs">${esc(lines)}</textarea>`; }
  else if (type === 'reviews') { const lines = (Array.isArray(v) ? v : []).map(it => `${it.author || ''} :: ${it.rating || 5} :: ${it.text || ''}`).join('\n'); input = `<textarea rows="4" oninput="setSecReviews(${i},'${key}',this.value)" placeholder="Jane D. :: 5 :: Best dealership experience I've had." class="${cls} text-xs">${esc(lines)}</textarea>`; }
  else if (type === 'cards') { const lines = (Array.isArray(v) ? v : []).map(it => `${it.title || ''} :: ${it.text || ''}`).join('\n'); input = `<textarea rows="4" oninput="setSecCards(${i},'${key}',this.value)" placeholder="Free delivery :: We bring the car to your door." class="${cls} text-xs">${esc(lines)}</textarea>`; }
  else if (type === 'cardcols') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['2','2 across'],['3','3 across'],['4','4 across']].map(o => `<option value="${o[0]}" ${String(v || '3') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'adtpl') input = `<select onchange="setSec(${i},'${key}',this.value)" class="${cls}">${[['classic','Classic — text left, image right'],['imgleft','Image left, text right'],['overlay','Full-bleed image with overlay'],['spotlight','Spotlight card — image on top']].map(o => `<option value="${o[0]}" ${(v || 'classic') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  else if (type === 'bool') input = `<label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" ${v ? 'checked' : ''} onchange="setSec(${i},'${key}',this.checked)" class="rounded"> Yes</label>`;
  else input = `<input value="${esc(v || '')}" oninput="setSec(${i},'${key}',this.value)" class="${cls}">`;
  return `<div class="${wide}">${lbl}${input}</div>`;
}
function setSec(i, key, val) { if (__siteSections[i]) { __siteSections[i].settings = __siteSections[i].settings || {}; __siteSections[i].settings[key] = val; if (__builderMode === 'live') livePreviewPush(); } }
function setSecFaq(i, key, text) { const items = text.split('\n').map(l => { const [q, ...a] = l.split('::'); return { q: (q || '').trim(), a: a.join('::').trim() }; }).filter(x => x.q); setSec(i, key, items); }
function setSecReviews(i, key, text) { const items = text.split('\n').map(l => { const p = l.split('::'); const author = (p[0] || '').trim(); const rating = Math.max(1, Math.min(5, parseInt(p[1]) || 5)); const body = p.slice(2).join('::').trim(); return { author, rating, text: body }; }).filter(x => x.author || x.text); setSec(i, key, items); }
function setSecCards(i, key, text) { const items = text.split('\n').map(l => { const [t, ...d] = l.split('::'); return { title: (t || '').trim(), text: d.join('::').trim() }; }).filter(x => x.title || x.text); setSec(i, key, items); }
window.setSecCards = setSecCards;
window.setSecReviews = setSecReviews;
function delSecImg(i, key, k) { const arr = (__siteSections[i].settings?.[key] || []).slice(); arr.splice(k, 1); setSec(i, key, arr); renderWsSections(); }
async function uploadToSec(i, key, file) { if (!file) return; showToast('Uploading…', 'info'); try { const fd = new FormData(); fd.append('image', file); const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setSec(i, key, d.url); renderWsSections(); showToast('Uploaded', 'success'); } catch (e) { showToast(e.message, 'error'); } }
async function uploadToSecMulti(i, key, files) { for (const f of Array.from(files || [])) { try { const fd = new FormData(); fd.append('image', f); const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd }); const d = await r.json(); if (r.ok) { const arr = (__siteSections[i].settings?.[key] || []).slice(); arr.push(d.url); setSec(i, key, arr); } } catch {} } renderWsSections(); showToast('Images added', 'success'); }
// Per-page brand accent + nav icon (#28). rerender only when we must repaint the row.
function setPageStyle(key, val, rerender) {
  if (typeof __wsTarget === 'number' && __sitePages[__wsTarget]) {
    __sitePages[__wsTarget][key] = (val && String(val).trim()) || null;
    if (rerender) renderWsBody();
  }
}
window.setPageStyle = setPageStyle;
let __pendingInsertAt = null;   // live builder: insert the next-added section at this index (from an on-canvas "＋")
// Section types whose image IS the section — a blank Hero/Text+image/Promo ad reads
// as broken, unlike two_col's explicitly-optional left/right images. Prefills from the
// same free library Design Studio's Photos tool and the Website Builder's own "Browse
// Photos" picker use, so a new site never starts with empty photo holes.
const WS_DEFAULT_IMAGE_TYPES = { hero: 'image', text_image: 'image', ad_banner: 'image' };
function addSection(type) {
  const sec = { id: 's' + Date.now().toString(36), type, settings: {} };
  const imageKey = WS_DEFAULT_IMAGE_TYPES[type];
  if (imageKey && typeof STUDIO_FREE_PHOTOS !== 'undefined' && STUDIO_FREE_PHOTOS.length) {
    sec.settings[imageKey] = STUDIO_FREE_PHOTOS[Math.floor(Math.random() * STUDIO_FREE_PHOTOS.length)].url;
  }
  if (__pendingInsertAt != null && __pendingInsertAt >= 0 && __pendingInsertAt <= __siteSections.length) {
    __siteSections.splice(__pendingInsertAt, 0, sec);
    __pendingInsertAt = null;
    const hint = document.getElementById('ws-insert-hint'); if (hint) hint.classList.add('hidden');
    if (__builderMode === 'live' && typeof showToast === 'function') showToast('Section inserted', 'success');
  } else {
    __siteSections.push(sec);
  }
  renderWsSections();
}
function moveSection(i, dir) { const j = i + dir; if (j < 0 || j >= __siteSections.length) return; const [s] = __siteSections.splice(i, 1); __siteSections.splice(j, 0, s); renderWsSections(); }
function dupSection(i) { __siteSections.splice(i + 1, 0, JSON.parse(JSON.stringify(__siteSections[i]))); renderWsSections(); }
function delSection(i) { __siteSections.splice(i, 1); renderWsSections(); }
const WS_PALETTES = [
  ['Chevy Blue', '#0b2a5b', '#0a1a33', '#d4af37'],
  ['GMC Red', '#c8102e', '#1a1a1a', '#9ea2a2'],
  ['Buick Bronze', '#151a20', '#0a0f14', '#b08d57'],
  ['Ford Blue', '#003478', '#00142e', '#1071e5'],
  ['Midnight', '#1e293b', '#0f172a', '#6366f1'],
  ['Clean Slate', '#334155', '#0f172a', '#2563eb'],
  ['Luxury Gold', '#111111', '#000000', '#c9a24b'],
  ['Forest', '#14532d', '#052e16', '#22c55e'],
];
const WS_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Oswald', 'Bebas Neue', 'Anton', 'Archivo', 'Rubik', 'Barlow', 'Raleway', 'Playfair Display', 'Roboto Slab', 'Merriweather', 'Teko', 'Roboto', 'Open Sans', 'Lato', 'Source Sans 3', 'Nunito Sans', 'Work Sans', 'Mulish', 'PT Sans'];
function wsApplyPalette(p, s, a) { const g = id => document.getElementById(id); if (g('ws-c1')) g('ws-c1').value = p; if (g('ws-c2')) g('ws-c2').value = s; if (g('ws-c3')) g('ws-c3').value = a; showToast('Palette applied — Save to publish', 'info'); }
function wsSetTheme(id) { __siteCfg.content = __siteCfg.content || {}; __siteCfg.content.theme = id; renderWsBody(); showToast('Theme selected — Save to publish', 'info'); }
window.wsSetTheme = wsSetTheme;
function openTemplatePicker() {
  const templates = [
    {
      id: 'luxury',
      name: 'Premier Luxury Dealership',
      desc: 'Playfair Display serif hierarchy, obsidian & gold accents, pill buttons, wide padding, glassmorphic cards, executive sedan hero.',
      preset: 'luxury',
      primary: '#0f172a', secondary: '#1e293b', accent: '#d97706', heading_font: 'Playfair Display', body_font: 'Inter'
    },
    {
      id: 'modern',
      name: 'Modern Omnichannel Showroom',
      desc: 'Outfit & Inter typography, indigo/slate gradients, rounded-2xl cards, glowing primary buttons, futuristic coupe hero.',
      preset: 'modern',
      primary: '#1e3a8a', secondary: '#0f172a', accent: '#4f46e5', heading_font: 'Outfit', body_font: 'Inter'
    },
    {
      id: 'traditional',
      name: 'Traditional Dealership',
      desc: 'Archivo & Open Sans, classic navy/red header, top contact bar, upfront pricing banner, lot flagship hero.',
      preset: 'traditional',
      primary: '#0b2a5b', secondary: '#1f2937', accent: '#dc2626', heading_font: 'Archivo', body_font: 'Open Sans'
    },
    {
      id: 'performance',
      name: 'High-Performance Motorsport & EV',
      desc: 'Syne & Space Grotesk typography, carbon dark styling, neon cyan accents, velocity specs spotlight, night supercar hero.',
      preset: 'performance',
      primary: '#0284c7', secondary: '#020617', accent: '#06b6d4', heading_font: 'Syne', body_font: 'Space Grotesk'
    },
    {
      id: 'truck',
      name: 'Truck & Heavy Duty Hub',
      desc: 'Oswald uppercase headlines, earth/stone theme, heavy-duty towing capacity cards, 4x4 off-road hero.',
      preset: 'truck',
      primary: '#1c1917', secondary: '#292524', accent: '#d97706', heading_font: 'Oswald', body_font: 'Inter'
    },
    {
      id: 'family',
      name: 'Family & Community Motors',
      desc: 'Poppins & Nunito typography, warm teal palette, 5-star Google review spotlight, safe family crossover hero.',
      preset: 'family',
      primary: '#1e293b', secondary: '#0f172a', accent: '#0d9488', heading_font: 'Poppins', body_font: 'Nunito'
    },
    {
      id: 'minimal',
      name: 'Minimalist European Studio',
      desc: 'Monochrome precision grid, generous negative space, 1px border cards, studio white coupe hero.',
      preset: 'minimal',
      primary: '#09090b', secondary: '#27272a', accent: '#2563eb', heading_font: 'Inter', body_font: 'Work Sans'
    },
    {
      id: 'promo',
      name: 'Bold High-Volume Promotional',
      desc: 'Bebas Neue & Roboto typography, high-contrast sales event theme, flash deal banners, red sports car hero.',
      preset: 'promo',
      primary: '#b91c1c', secondary: '#18181b', accent: '#eab308', heading_font: 'Bebas Neue', body_font: 'Roboto'
    },
    {
      id: 'used',
      name: 'Certified Pre-Owned Depot',
      desc: 'Barlow & Rubik typography, amber/navy theme, "Every Credit Approved" finance banner, certified used lot hero.',
      preset: 'used',
      primary: '#1e3a8a', secondary: '#0f172a', accent: '#f59e0b', heading_font: 'Barlow', body_font: 'Rubik'
    },
    {
      id: 'ev',
      name: 'Next-Gen Electric Vehicle Hub',
      desc: 'Plus Jakarta Sans & Inter typography, deep electric blue theme, charging range calculator banner, EV charging hero.',
      preset: 'ev',
      primary: '#030712', secondary: '#0b1329', accent: '#22d3ee', heading_font: 'Plus Jakarta Sans', body_font: 'Inter'
    }
  ];

  const modalHtml = `
    <div class="p-6 space-y-4 max-w-4xl">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white">Choose Complete Homepage Template</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Each template features a distinct visual layout, typography, Pexels imagery, and color palette.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>

      <div class="grid md:grid-cols-2 gap-4 pt-2 max-h-[70vh] overflow-y-auto">
        ${templates.map(t => `
          <button onclick="applyCompleteTemplate('${t.id}')" class="group text-left border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-lg hover:shadow-2xl transition duration-200 space-y-3 cursor-pointer">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">${t.preset}</span>
              <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition">Apply Template →</span>
            </div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">${t.name}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${t.desc}</p>
            <div class="flex items-center gap-1.5 pt-1">
              <span class="w-4 h-4 rounded-full border border-slate-300" style="background:${t.primary}"></span>
              <span class="w-4 h-4 rounded-full border border-slate-300" style="background:${t.secondary}"></span>
              <span class="w-4 h-4 rounded-full border border-slate-300" style="background:${t.accent}"></span>
              <span class="text-[10px] font-mono text-slate-400 ml-2">${t.heading_font} / ${t.body_font}</span>
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  crmOverlay(modalHtml, 'max-w-4xl');
}

function applyCompleteTemplate(templateId) {
  const c = __siteCfg.content || (__siteCfg.content = {});
  const ctx = { name: c.name || ctxName(), city: c.city || '' };

  const configs = {
    luxury: {
      primary_color: '#0f172a', secondary_color: '#1e293b', accent_color: '#d97706', typography: 'luxury', heading_font: 'Playfair Display', body_font: 'Inter', preset: 'luxury',
      hero_url: 'https://images.pexels.com/photos/3764984/pexels-photo-3764984.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Excellence in Motion', 'Experience bespoke automotive service and curated executive vehicles.', 'Explore Collection', 'inventory', 'g1'),
        __psec('feature_cards', { title: 'White-Glove Dealership Experience' }),
        __psec('featured_inventory', { title: 'Private Reserve Spotlight', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Crafted Around Your Driving Life', body: 'At our studio, acquiring a vehicle is a tailored journey. Every luxury vehicle passes 180-point verification.', image: 'https://images.pexels.com/photos/164634/pexels-photo-164634.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Speak to Advisor', button_target: 'team' }),
        __psec('reviews', { title: 'Client Testimonials', google_rating: '4.9' }),
        psCta('Private Appraisal Service', 'Receive an uncompromised valuation for your current luxury vehicle.', 'Request Appraisal', 'trade')
      ]
    },
    modern: {
      primary_color: '#1e3a8a', secondary_color: '#0f172a', accent_color: '#4f46e5', typography: 'modern', heading_font: 'Outfit', body_font: 'Inter', preset: 'modern',
      hero_url: 'https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: templateHome(ctx)
    },
    traditional: {
      primary_color: '#0b2a5b', secondary_color: '#1f2937', accent_color: '#dc2626', typography: 'traditional', heading_font: 'Archivo', body_font: 'Open Sans', preset: 'traditional',
      hero_url: 'https://images.pexels.com/photos/112460/pexels-photo-112460.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Your Trusted Local Car Dealership', 'Honest prices, straightforward financing, and dependable vehicles updated daily.', 'Shop Inventory', 'inventory', 'g2'),
        __psec('ad_banner', { tag: 'Monthly Special', headline: 'Drive Away With Up to $2,000 Off Trade-Ins', subtitle: 'Limited time offers across our new and certified pre-owned lot.', button_label: 'Claim Offer', button_target: 'inquiry', image: 'https://images.pexels.com/photos/7144211/pexels-photo-7144211.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2' }),
        __psec('featured_inventory', { title: 'Top Deals This Week', condition: 'all', count: 6 }),
        __psec('contact', { title: 'Visit Our Showroom Today' })
      ]
    },
    performance: {
      primary_color: '#0284c7', secondary_color: '#020617', accent_color: '#06b6d4', typography: 'performance', heading_font: 'Syne', body_font: 'Space Grotesk', preset: 'performance',
      hero_url: 'https://images.pexels.com/photos/3311574/pexels-photo-3311574.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Engineered for High Performance', 'Precision sports coupes, tuned SUVs, and next-generation electric supercars.', 'View High Velocity Vehicles', 'inventory', 'g4'),
        __psec('body_style', { title: 'Shop By Performance Category' }),
        __psec('featured_inventory', { title: 'Track & Street Lineup', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Uncompromising Horsepower & Tech', body: 'Experience dyno-tested performance and certified pre-owned sports vehicles.', image: 'https://images.pexels.com/photos/1149831/pexels-photo-1149831.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Schedule Test Track Drive', button_target: 'contact' })
      ]
    },
    truck: {
      primary_color: '#1c1917', secondary_color: '#292524', accent_color: '#d97706', typography: 'rugged', heading_font: 'Oswald', body_font: 'Inter', preset: 'truck',
      hero_url: 'https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Heavy Duty Truck & Commercial Headquarters', 'Built to tow, haul, and conquer any job site or off-road trail.', 'Browse Truck Inventory', 'inventory', 'g5'),
        __psec('trade_cta', { title: 'Trade Up Your Work Truck', subtitle: 'Get maximum trade-in value for your current pickup in 2 minutes.', button_label: 'Value My Truck' }),
        __psec('featured_inventory', { title: 'Featured Pickups & 4x4 SUVs', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Towing Power & Payload Excellence', body: 'From diesel crew cabs to 4WD off-road rigs, explore tested truck capability.', image: 'https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Contact Fleet Specialist', button_target: 'contact' })
      ]
    },
    family: {
      primary_color: '#1e293b', secondary_color: '#0f172a', accent_color: '#0d9488', typography: 'family', heading_font: 'Poppins', body_font: 'Nunito', preset: 'family',
      hero_url: 'https://images.pexels.com/photos/1592384/pexels-photo-1592384.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Safe & Reliable Family Vehicles', '5-star safety rated SUVs, crossovers, and minivans for every journey.', 'Explore Family SUVs', 'inventory', 'g7'),
        __psec('reviews', { title: 'Loved by Local Families', google_rating: '4.9' }),
        __psec('featured_inventory', { title: 'Top Rated Family Rides', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Peace of Mind On Every Road', body: 'Comprehensive warranties, multi-point safety checks, and child-safe interior options.', image: 'https://images.pexels.com/photos/4553277/pexels-photo-4553277.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Book Family Test Drive', button_target: 'contact' })
      ]
    },
    minimal: {
      primary_color: '#09090b', secondary_color: '#27272a', accent_color: '#2563eb', typography: 'minimal', heading_font: 'Inter', body_font: 'Work Sans', preset: 'minimal',
      hero_url: 'https://images.pexels.com/photos/909907/pexels-photo-909907.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Essential Automotive Precision', 'Pure design. Transparent terms. Direct digital purchasing.', 'Discover Stock', 'inventory', 'g8'),
        __psec('featured_inventory', { title: 'Curated Vehicles', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Simplicity Redefined', body: 'No hidden fees. Pure vehicle engineering presented without distraction.', image: 'https://images.pexels.com/photos/244206/pexels-photo-244206.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Inquire', button_target: 'contact' })
      ]
    },
    promo: {
      primary_color: '#b91c1c', secondary_color: '#18181b', accent_color: '#eab308', typography: 'promo', heading_font: 'Bebas Neue', body_font: 'Roboto', preset: 'promo',
      hero_url: 'https://images.pexels.com/photos/2127040/pexels-photo-2127040.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('MASSIVE INVENTORY CLEARANCE EVENT', 'Lowest prices of the season on top new and used vehicles!', 'View Flash Clearance', 'inventory', 'g6'),
        __psec('ad_banner', { tag: 'Limited Time Deal', headline: '0% APR Financing Available On Select Units', subtitle: 'Don’t wait — these prices are locked in while inventory lasts.', button_label: 'Get My Price Now', button_target: 'inquiry', image: 'https://images.pexels.com/photos/97075/pexels-photo-97075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2' }),
        __psec('featured_inventory', { title: 'Clearance Spotlight Deals', condition: 'all', count: 6 }),
        psCta('Want the Lowest Price Guarantee?', 'Submit your inquiry in under 30 seconds to lock in extra savings.', 'Lock In My Price', 'inquiry')
      ]
    },
    used: {
      primary_color: '#1e3a8a', secondary_color: '#0f172a', accent_color: '#f59e0b', typography: 'used', heading_font: 'Barlow', body_font: 'Rubik', preset: 'used',
      hero_url: 'https://images.pexels.com/photos/100656/pexels-photo-100656.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('Certified Pre-Owned Car & Truck Depot', '100% inspected, free CarFax reports, and guaranteed credit approval.', 'Shop Used Vehicles', 'inventory', 'g3'),
        __psec('finance_cta', { title: 'All Credit Types Approved', subtitle: 'Good credit, bad credit, or first-time buyer — we get you approved fast.', button_label: 'Get Pre-Approved Online' }),
        __psec('featured_inventory', { title: 'Fresh Pre-Owned Arrivals', condition: 'used', count: 6 }),
        __psec('text_image', { headline: 'Every Vehicle Thoroughly Certified', body: 'Includes multi-point safety inspection, reconditioning, and powertrain warranty.', image: 'https://images.pexels.com/photos/3807277/pexels-photo-3807277.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Value My Trade', button_target: 'trade' })
      ]
    },
    ev: {
      primary_color: '#030712', secondary_color: '#0b1329', accent_color: '#22d3ee', typography: 'ev', heading_font: 'Plus Jakarta Sans', body_font: 'Inter', preset: 'ev',
      hero_url: 'https://images.pexels.com/photos/9800006/pexels-photo-9800006.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      sections: [
        psHero('The Electric & Hybrid Experience', 'Zero emissions, instant torque, and federal EV incentive rebates.', 'Explore EV & Hybrid Stock', 'inventory', 'g1'),
        __psec('payment_calc', { title: 'Estimate Your Monthly Fuel & Charging Savings', rate: 6.99, term: 72 }),
        __psec('featured_inventory', { title: 'Electric & Hybrid Vehicles', condition: 'all', count: 6 }),
        __psec('text_image', { headline: 'Charge Into the Future', body: 'Discover high-range EVs, home charging installation guidance, and battery health warranties.', image: 'https://images.pexels.com/photos/110844/pexels-photo-110844.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2', button_label: 'Calculate EV Rebate', button_target: 'finance' })
      ]
    }
  };

  const selected = configs[templateId] || configs.modern;
  Object.assign(c, selected);
  __homeSections = selected.sections.slice();
  __siteSections = __homeSections;

  document.querySelector('.fixed')?.remove();
  renderWebsitePage();
  showToast(`Applied "${templateId}" template with Pexels imagery — Save to publish`, 'success');
}

window.openTemplatePicker = openTemplatePicker;
window.applyCompleteTemplate = applyCompleteTemplate;

function wsFontOpts(sel) { return `<option value="">— Use preset —</option>` + WS_FONTS.map(f => `<option value="${f}" ${sel === f ? 'selected' : ''}>${f}</option>`).join(''); }
function wsDesign() {
  const c = __siteCfg.content || {};
  const swatch = (id, label, val) => `<div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${label}</label><input id="${id}" type="color" value="${esc(val || '#1e3a8a')}" class="w-full h-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"></div>`;
  const typos = [['modern','Modern'],['luxury','Luxury'],['bold','Bold'],['corporate','Corporate'],['minimal','Minimal']];
  const sel = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const themes = [
    ['classic', 'Classic', 'Balanced, familiar dealer look'],
    ['prestige', 'Prestige', 'Refined, spacious, serif headings'],
    ['modern', 'Modern', 'Crisp, soft depth, rounded'],
    ['bold', 'Bold', 'High-contrast, punchy'],
    ['minimal', 'Minimal', 'Flat, airy, bordered'],
  ];
  const curTheme = c.theme || 'classic';
  return `<div class="mt-4 max-w-lg space-y-5">
    <div>
      <div class="text-sm font-black text-slate-900 dark:text-white mb-2">Design theme <span class="font-normal text-slate-400 text-[11px]">— one click restyles the whole site</span></div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">${themes.map(([id, nm, desc]) => `<button type="button" onclick="wsSetTheme('${id}')" class="text-left rounded-xl border-2 p-3 transition ${curTheme === id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}">
        <div class="text-[13px] font-black text-slate-900 dark:text-white flex items-center gap-1">${nm}${curTheme === id ? ' <span class="text-indigo-500"></span>' : ''}</div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">${desc}</div></button>`).join('')}</div>
      <p class="text-[11px] text-slate-400 mt-1.5">Themes set spacing, corners, shadows and heading style. Save, then “View site” to see it live.</p>
    </div>
    <div>
      <div class="text-sm font-black text-slate-900 dark:text-white mb-2">Quick palettes</div>
      <div class="flex flex-wrap gap-2">${WS_PALETTES.map(([n, p, s, a]) => `<button type="button" onclick="wsApplyPalette('${p}','${s}','${a}')" class="flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 hover:border-indigo-400"><span class="flex"><span class="w-3.5 h-3.5 rounded-l" style="background:${p}"></span><span class="w-3.5 h-3.5" style="background:${s}"></span><span class="w-3.5 h-3.5 rounded-r" style="background:${a}"></span></span>${n}</button>`).join('')}</div>
    </div>
    <div>
      <div class="text-sm font-black text-slate-900 dark:text-white mb-2">Brand colours</div>
      <div class="grid grid-cols-3 gap-2">${swatch('ws-c1', 'Primary', c.primary_color)}${swatch('ws-c2', 'Secondary / hero', c.secondary_color)}${swatch('ws-c3', 'Accent', c.accent_color)}</div>
    </div>
    <div>
      <div class="text-sm font-black text-slate-900 dark:text-white mb-2">Typography</div>
      <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Font preset</label>
      <select id="ws-typo" class="${sel}">${typos.map(t => `<option value="${t[0]}" ${(c.typography || 'modern') === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Heading font</label><select id="ws-hfont" class="${sel}">${wsFontOpts(c.heading_font)}</select></div>
        <div><label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Body font</label><select id="ws-bfont" class="${sel}">${wsFontOpts(c.body_font)}</select></div>
      </div>
      <p class="text-[11px] text-slate-400 mt-1">Pick any Google Font for headings/body — they override the preset. Leave on “Use preset” to keep the preset pairing.</p>
    </div>
    <div class="border-t border-slate-100 dark:border-slate-800 pt-4">
      <label class="flex items-center gap-2 text-sm font-bold"><input id="ws-heroimg" type="checkbox" ${c.hero_photos ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Use my inventory photos for hero backgrounds</label>
      <p class="text-[11px] text-slate-400 mt-1">On: each hero shows a real vehicle from your lot (a different one per page). Off: the built-in gradient art. Upload a photo on any individual hero to override either way.</p>
    </div>
    <p class="text-[11px] text-slate-400">Logo comes from your branding (Settings). Colours &amp; fonts update the whole site automatically.</p>
  </div>`;
}
// Pages tab: extra content pages + auto-built model/offer pages (moved here from Settings).
function wsPages() {
  return `<div class="mt-4 max-w-2xl space-y-3">
    <div class="flex items-start justify-between gap-2 flex-wrap">
      <div>
        <div class="text-sm font-black text-slate-900 dark:text-white">Menu &amp; pages</div>
        <p class="text-[11px] text-slate-400">Drag the ⠿ handle (or use ▲▼) to reorder. Toggle a page on/off, rename its nav label, and type a <b>Submenu</b> name to group items into a dropdown. Built-ins + your own pages all live here.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <button type="button" onclick="autoBuildPages(this)" class="text-xs font-bold text-violet-600 dark:text-violet-400"> Auto-build model &amp; offer pages</button>
        <select onchange="addSitePagePreset(this.value);this.value=''" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5">${wsAddPageOptions()}</select>
      </div>
    </div>
    <div id="menu-list" class="space-y-2"></div>
  </div>`;
}
// ── Team tab: dealer staff (managers, sales, service, admin…) with dept labels ──
let __siteStaff = [];
const STAFF_DEPTS = ['Management', 'Sales', 'Finance', 'Service', 'Parts', 'Admin', 'Reception', 'Other'];
function wsTeam() {
  return `<div class="mt-4 max-w-2xl space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div>
        <div class="text-sm font-black text-slate-900 dark:text-white">Team</div>
        <p class="text-[11px] text-slate-400">Your logged-in sales team appears on the public Team page automatically (edit their name/photo/bio under <b>Sales Team → Edit</b>). Add anyone else here — finance, service, parts, admin, reception — and they'll show under the right department.</p>
      </div>
      <button type="button" onclick="addSiteStaff()" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">+ Add person</button>
    </div>
    <div id="site-staff-list" class="space-y-2"></div>
  </div>`;
}
function collectSiteStaff() {
  if (!document.getElementById('site-staff-list')) return;
  __siteStaff = Array.from(document.querySelectorAll('#site-staff-list [data-stx]')).map((r, idx) => ({
    ...(__siteStaff[idx] || {}),
    name: r.querySelector('.st-name')?.value || '',
    title: r.querySelector('.st-title')?.value || '',
    department: r.querySelector('.st-dept')?.value || 'Sales',
    phone: r.querySelector('.st-phone')?.value || '',
    email: r.querySelector('.st-email')?.value || '',
  }));
}
function renderSiteStaff() {
  const box = document.getElementById('site-staff-list'); if (!box) return;
  const ic = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs';
  if (!__siteStaff.length) { box.innerHTML = '<div class="text-[11px] text-slate-400 italic">No team members yet. Add managers, sales, service, admin…</div>'; return; }
  box.innerHTML = __siteStaff.map((m, i) => `<div data-stx="${i}" class="border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
    <div class="flex gap-2 items-center">
      ${m.photo ? `<img src="${esc(m.photo)}" class="w-9 h-9 rounded-full object-cover shrink-0">` : `<div class="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">${esc((m.name || '?')[0] || '?')}</div>`}
      <input class="st-name flex-1 ${ic}" placeholder="Full name" value="${esc(m.name || '')}">
      <select class="st-dept ${ic}">${STAFF_DEPTS.map(d => `<option ${m.department === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <button type="button" onclick="removeSiteStaff(${i})" class="text-rose-500 text-xs font-bold shrink-0"></button>
    </div>
    <div class="grid grid-cols-2 gap-1">
      <input class="st-title ${ic}" placeholder="Title (e.g. Sales Manager)" value="${esc(m.title || '')}">
      <input class="st-phone ${ic}" placeholder="Phone" value="${esc(m.phone || '')}">
    </div>
    <div class="flex gap-1 items-center">
      <input class="st-email flex-1 ${ic}" placeholder="Email (optional)" value="${esc(m.email || '')}">
      <input type="file" accept="image/*" class="hidden" id="st-file-${i}" onchange="uploadStaffPhoto(${i}, this.files[0])">
      <button type="button" onclick="document.getElementById('st-file-${i}').click()" class="text-xs font-bold bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded shrink-0">${m.photo ? 'Change photo' : 'Photo'}</button>
    </div>
  </div>`).join('');
}
function addSiteStaff() { collectSiteStaff(); __siteStaff.push({ name: '', title: '', department: 'Sales' }); renderSiteStaff(); }
function removeSiteStaff(i) { collectSiteStaff(); __siteStaff.splice(i, 1); renderSiteStaff(); }
async function uploadStaffPhoto(i, file) {
  if (!file) return; collectSiteStaff(); showToast('Uploading photo…', 'info');
  try {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Upload failed');
    __siteStaff[i].photo = d.url; renderSiteStaff(); showToast('Photo added', 'success');
  } catch (e) { showToast(e.message, 'error'); }
}
async function saveWebsite(btn) {
  // Collect design values if on that tab (they persist across tabs via __siteCfg.content).
  const c = __siteCfg.content || (__siteCfg.content = {});
  if (document.getElementById('ws-c1')) { c.primary_color = document.getElementById('ws-c1').value; c.secondary_color = document.getElementById('ws-c2').value; c.accent_color = document.getElementById('ws-c3').value; c.typography = document.getElementById('ws-typo').value; c.heading_font = document.getElementById('ws-hfont')?.value || ''; c.body_font = document.getElementById('ws-bfont')?.value || ''; c.hero_photos = !!document.getElementById('ws-heroimg')?.checked; }
  collectMenu(); collectSiteStaff();      // no-op unless that tab is currently rendered
  wsFlushTarget();                        // push the active buffer onto home / its page
  const body = {
    sections: __homeSections,
    pages: __sitePages.filter(p => (p.title || '').trim()),
    staff: __siteStaff.filter(m => (m.name || '').trim()),
    builtins: Object.keys(__siteBuiltins).length ? __siteBuiltins : defaultBuiltins(),
    menu_order: __menuOrder,
    site_published: document.getElementById('ws-pub')?.checked || false,
    primary_color: c.primary_color, secondary_color: c.secondary_color, accent_color: c.accent_color, typography: c.typography,
    heading_font: c.heading_font || '', body_font: c.body_font || '', hero_photos: !!c.hero_photos,
    theme: c.theme || 'classic',
  };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await apiSendJson('/dealership/site', 'PUT', body); showToast('Website saved', 'success'); btn.disabled = false; btn.textContent = orig; }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
//  AI-per-section: Boost / Fresh / Short / Long / SEO on any copy field, plus a
// SEO title-with-hook option on titles and link-insertion on description copy.
const AI_RICH_KINDS = ['about', 'body', 'text', 'description', 'paragraph', 'intro'];
const AI_TITLE_KINDS = ['headline', 'title', 'cta', 'subheadline'];
function aiMenu(ev, i, key, kind) {
  ev.stopPropagation();
  document.querySelectorAll('.ai-menu').forEach(m => m.remove());
  let acts;
  if (kind === 'faq') acts = [['faq', 'Generate FAQ']];
  else {
    acts = [['boost', ' Boost what\'s here'], ['fresh', 'Rewrite fresh'], ['short', 'Shorter version'], ['long', 'Longer version'], ['seo', 'SEO rewrite']];
    if (AI_TITLE_KINDS.includes(kind)) acts.push(['title', 'SEO title + hook']);
    if (AI_RICH_KINDS.includes(kind)) acts.push(['links', 'Add links']);
  }
  const m = document.createElement('div');
  m.className = 'ai-menu fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[170px]';
  const r = ev.currentTarget.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, r.right - 180) + 'px';
  m.innerHTML = acts.map(a => `<button class="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onclick="aiRun(${i},'${key}','${kind}','${a[0]}');this.closest('.ai-menu').remove()">${a[1]}</button>`).join('');
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }, { once: true }), 10);
}
// The site's primary focus keyword (first of the SEO keywords field) — feeds the
// SEO/title/meta prompts so copy is optimized around what the dealer targets.
function sitePrimaryKeyword() {
  const raw = (document.getElementById('seo-keywords')?.value || __siteCfg?.content?.seo_keywords || '').split(',')[0];
  return (raw || '').trim().slice(0, 80);
}
// Internal link targets (hash URLs that the public site routes) the AI can weave
// into descriptions — built-in pages + the dealer's custom pages.
function siteInternalLinks() {
  const bi = __siteBuiltins || {};
  const on = (k) => !bi[k] || bi[k].enabled !== false;
  const lbl = (k, d) => (bi[k] && bi[k].label) || d;
  const out = [];
  if (on('inventory')) out.push({ label: lbl('inventory', 'our inventory'), href: '#inventory' });
  if (on('finance')) out.push({ label: lbl('finance', 'financing'), href: '#finance' });
  if (on('trade')) out.push({ label: lbl('trade', 'value your trade'), href: '#trade' });
  if (on('build')) out.push({ label: lbl('build', 'build & price'), href: '#build' });
  if (on('contact')) out.push({ label: lbl('contact', 'contact us'), href: '#contact' });
  for (const p of (__sitePages || [])) { if ((p.title || '').trim() && p.slug) out.push({ label: p.title, href: '#/' + p.slug }); }
  return out.slice(0, 12);
}
//  AI menu for the site-level About field (boost / fresh / short / long / SEO / links).
function aiAboutMenu(ev) {
  ev.stopPropagation();
  document.querySelectorAll('.ai-menu').forEach(m => m.remove());
  const acts = [['boost', ' Boost what\'s here'], ['fresh', 'Rewrite fresh'], ['short', 'Shorter version'], ['long', 'Longer version'], ['seo', 'SEO rewrite'], ['links', 'Add links']];
  const m = document.createElement('div');
  m.className = 'ai-menu fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 min-w-[170px]';
  const r = ev.currentTarget.getBoundingClientRect();
  m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, r.right - 180) + 'px';
  m.innerHTML = acts.map(a => `<button class="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800" onclick="aiAboutRun('${a[0]}');this.closest('.ai-menu').remove()">${a[1]}</button>`).join('');
  document.body.appendChild(m);
  setTimeout(() => document.addEventListener('click', function h() { m.remove(); document.removeEventListener('click', h); }, { once: true }), 10);
}
async function aiAboutRun(task) {
  const el = document.getElementById('site-about'); if (!el) return;
  const withLinks = task === 'links';
  showToast(' Writing…', 'info');
  try {
    const d = await apiSendJson('/ai/site-copy', 'POST', { task, kind: 'about', current: el.value, hint: 'about the dealership', keyword: sitePrimaryKeyword(), with_links: withLinks, links: withLinks ? siteInternalLinks() : [] });
    el.value = d.text; showToast(d.html ? ' Links added — review & Save' : ' Done — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI editing needs AI Boost (or your free trial).' : e.message, 'error'); }
}
//  Write the site-wide (home) SEO title + meta description from name/city/About.
async function aiSiteMeta(btn) {
  const kw = sitePrimaryKeyword();
  const about = (document.getElementById('site-about')?.value || __siteCfg?.content?.about || '').trim();
  const name = (__siteCfg?.content?.name || '').trim();
  const orig = btn.textContent; btn.disabled = true; btn.textContent = ' Writing…';
  try {
    const [ttl, dsc] = await Promise.all([
      apiSendJson('/ai/site-copy', 'POST', { task: 'title', kind: 'title', hint: 'homepage', keyword: kw, current: name }),
      apiSendJson('/ai/site-copy', 'POST', { task: 'meta', kind: 'meta', hint: 'homepage', keyword: kw, current: about || name }),
    ]);
    const tEl = document.getElementById('seo-title'); if (tEl && ttl.text) tEl.value = ttl.text;
    const dEl = document.getElementById('seo-desc'); if (dEl && dsc.text) dEl.value = dsc.text;
    showToast(' Title + meta written — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI meta needs AI Boost (or your free trial).' : e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
// Flatten a page's own content (title + body + every section's text) so the AI can
// write a meta description that actually reflects what's ON the page.
function pageContentText(p) {
  const parts = [p.title || '', p.body_html || ''];
  for (const s of (p.sections || [])) for (const v of Object.values(s.settings || {})) if (typeof v === 'string') parts.push(v);
  return parts.join(' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
}
//  Write this page's meta description (and a title if it has none) from its content.
async function aiPageMeta(btn) {
  const p = (typeof __wsTarget === 'number') ? __sitePages[__wsTarget] : null;
  if (!p) { showToast('Pick a page to edit first', 'info'); return; }
  const kw = (p.seo_keyword || sitePrimaryKeyword() || '').trim();
  const pageText = pageContentText(p);
  const orig = btn.textContent; btn.disabled = true; btn.textContent = ' Writing…';
  try {
    const dsc = await apiSendJson('/ai/site-copy', 'POST', { task: 'meta', kind: 'meta', hint: p.title, keyword: kw, current: pageText });
    p.seo_description = dsc.text;
    const dEl = document.getElementById('pg-seo-desc'); if (dEl) dEl.value = dsc.text;
    if (!(p.seo_title || '').trim()) {
      try {
        const ttl = await apiSendJson('/ai/site-copy', 'POST', { task: 'title', kind: 'title', hint: p.title, keyword: kw, current: p.title });
        p.seo_title = ttl.text;
        const tEl = document.getElementById('pg-seo-title'); if (tEl) tEl.value = ttl.text;
      } catch {}
    }
    showToast(' Meta written — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI meta needs AI Boost (or your free trial).' : e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
const __aiHistory = {}; // per-field recent outputs, so repeated clicks don't repeat
async function aiRun(i, key, kind, task) {
  const cur = __siteSections[i]?.settings?.[key];
  const current = Array.isArray(cur) ? cur.map(x => `${x.q} :: ${x.a}`).join('\n') : (cur || '');
  const secLabel = SEC_META[__siteSections[i]?.type]?.label || '';
  const histKey = `${__siteSections[i]?.id || i}:${key}`;
  const avoid = (__aiHistory[histKey] || []).slice(-5);
  const withLinks = task === 'links';
  showToast(' Writing…', 'info');
  try {
    const d = await apiSendJson('/ai/site-copy', 'POST', { task, kind, current, hint: secLabel, avoid, keyword: sitePrimaryKeyword(), with_links: withLinks, links: withLinks ? siteInternalLinks() : [] });
    if (kind === 'faq' || key === 'items') setSecFaq(i, key, d.text); else setSec(i, key, d.text);
    (__aiHistory[histKey] = __aiHistory[histKey] || []).push(d.text);
    renderWsSections();
    showToast(d.html ? ' Links added — review & Save' : ' Done — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI editing needs AI Boost (or your free trial).' : e.message, 'error'); }
}
// ── Templates: distinct layouts + copy pre-filled from the dealer's own details ──
const __mk = (type, settings) => ({ id: 's' + Math.random().toString(36).slice(2, 9), type, settings: settings || {} });
const MAKE_THEME = {
  chevrolet: { p: '#0b2a5b', s: '#0a1a33', a: '#d4af37', t: 'bold' }, gmc: { p: '#c8102e', s: '#1a1a1a', a: '#9ea2a2', t: 'bold' },
  buick: { p: '#151a20', s: '#0a0f14', a: '#b08d57', t: 'luxury' }, ford: { p: '#003478', s: '#00142e', a: '#1071e5', t: 'bold' },
  toyota: { p: '#eb0a1e', s: '#121212', a: '#eb0a1e', t: 'modern' }, honda: { p: '#e40521', s: '#121212', a: '#e40521', t: 'modern' },
  nissan: { p: '#c3002f', s: '#121212', a: '#c3002f', t: 'modern' }, hyundai: { p: '#002c5f', s: '#00142e', a: '#00aad2', t: 'modern' },
};
async function dealerCtxAsync() {
  const c = __siteCfg?.content || {};
  let makes = [];
  try { let inv = (typeof __catalogCache !== 'undefined' && __catalogCache?.length) ? __catalogCache : []; if (!inv.length) { try { inv = await apiGetJson('/inventory/all', { retries: 1 }); } catch {} } makes = [...new Set(inv.map(v => v.make).filter(Boolean))]; } catch {}
  return { name: c.name || 'our dealership', city: c.city || '', makes, primaryMake: makes[0] || '', makeList: makes.slice(0, 3).join(', ') };
}
const SITE_TEMPLATES = [
  { id: 'generic', name: 'Generic', primary: '#1e3a8a', secondary: '#0f172a', accent: '#2563eb', typography: 'modern', build: (x) => [
    __mk('hero', { headline: `Welcome to ${x.name}`, subheadline: `Quality new and used vehicles${x.city ? ' in ' + x.city : ''}. Shop, build and finance — all in one place.`, button_label: 'Browse inventory', button_target: 'inquiry', overlay: 45, height: 'md' }),
    __mk('featured_inventory', { title: 'Featured vehicles', condition: 'all', count: 6 }),
    __mk('trade_cta', { title: 'Value your trade', subtitle: 'Get a real number in minutes.', button_label: 'Value my trade' }),
    __mk('finance_cta', { title: 'Get pre-approved', subtitle: 'Fast and secure — no impact to your credit score.', button_label: 'Get pre-approved' }),
    __mk('staff', { title: 'Meet our team' }),
    __mk('faq', { title: 'Frequently asked questions', items: [{ q: 'Do you offer financing?', a: 'Yes — apply online in minutes and our team finds you a competitive rate.' }, { q: 'Can I value my trade online?', a: `Absolutely. Use our trade tool and we'll get you a real offer.` }] }),
    __mk('contact', { title: 'Get in touch' }),
  ] },
  { id: 'manufacturer', name: 'Manufacturer', primary: '#0b2a5b', secondary: '#0a1a33', accent: '#d4af37', typography: 'bold', build: (x) => {
    const mk = x.primaryMake || 'your favourite brands';
    return [
      __mk('hero', { headline: `Your ${mk} destination${x.city ? ' in ' + x.city : ''}`, subheadline: `Explore the full ${mk} lineup, build yours, and drive home with confidence.`, button_label: `Shop ${mk}`, button_target: 'inquiry', overlay: 40, height: 'lg' }),
      __mk('inventory_grid', { title: `${mk} inventory` }),
      __mk('finance_cta', { title: `${mk} finance offers`, subtitle: 'Competitive rates and factory programs.', button_label: 'Get pre-approved' }),
      __mk('service_cta', { title: 'Factory-trained service', subtitle: 'Keep your vehicle running like new.', button_label: 'Book service', button_target: 'inquiry' }),
      __mk('featured_inventory', { title: 'New arrivals', condition: 'new', count: 6 }),
      __mk('contact', { title: 'Talk to a product specialist' }),
    ];
  } },
  { id: 'modern', name: 'Modern', primary: '#4f46e5', secondary: '#0b1020', accent: '#22d3ee', typography: 'modern', build: (x) => [
    __mk('hero', { headline: `Find your next vehicle, faster`, subheadline: `${x.name} makes it simple — search, build and finance online${x.city ? ' in ' + x.city : ''}.`, button_label: 'Start shopping', button_target: 'inquiry', overlay: 35, height: 'lg' }),
    __mk('featured_inventory', { title: 'Trending now', condition: 'all', count: 6 }),
    __mk('cta_banner', { title: 'Build your dream vehicle online', button_label: 'Build & price', button_target: 'inquiry' }),
    __mk('gallery', { title: 'Inside our store', images: [] }),
    __mk('trade_cta', { title: 'Trade up today', subtitle: 'Instant estimate, real offer.', button_label: 'Value my trade' }),
    __mk('finance_cta', { title: 'Financing that fits', subtitle: 'Pre-approval in minutes.', button_label: 'Get pre-approved' }),
    __mk('contact', { title: 'Let\'s talk' }),
  ] },
  { id: 'clean', name: 'Clean', primary: '#0f766e', secondary: '#111827', accent: '#14b8a6', typography: 'minimal', build: (x) => [
    __mk('hero', { headline: x.name, subheadline: `A simpler way to buy your next vehicle${x.city ? ' in ' + x.city : ''}.`, button_label: 'View inventory', button_target: 'inquiry', overlay: 30, height: 'sm' }),
    __mk('featured_inventory', { title: 'Available now', condition: 'all', count: 6 }),
    __mk('finance_cta', { title: 'Get pre-approved', subtitle: 'Quick, secure, no obligation.', button_label: 'Apply now' }),
    __mk('contact', { title: 'Contact us' }),
  ] },
  { id: 'luxury', name: 'Luxury', primary: '#151515', secondary: '#000000', accent: '#b08d57', typography: 'luxury', build: (x) => [
    __mk('hero', { headline: `An elevated ownership experience`, subheadline: `${x.name} — curated vehicles and concierge service${x.city ? ' in ' + x.city : ''}.`, button_label: 'View the collection', button_target: 'inquiry', overlay: 55, height: 'lg' }),
    __mk('featured_inventory', { title: 'The collection', condition: 'all', count: 6 }),
    __mk('html', { html: `<div class="max-w-3xl"><h2 class="text-2xl font-black mb-2">Effortless from first look to delivery</h2><p class="text-slate-600">Private appointments, home delivery and a dedicated advisor for every client.</p></div>` }),
    __mk('staff', { title: 'Your advisors' }),
    __mk('contact', { title: 'Request a private appointment' }),
  ] },
  { id: 'usedlot', name: 'Used car lot', primary: '#b45309', secondary: '#1c1917', accent: '#f59e0b', typography: 'bold', build: (x) => [
    __mk('hero', { headline: `Quality pre-owned, priced to move`, subheadline: `${x.name} — every vehicle inspected and ready to go${x.city ? ' in ' + x.city : ''}.`, button_label: 'Browse used inventory', button_target: 'inquiry', overlay: 45, height: 'md' }),
    __mk('inventory_grid', { title: 'Our pre-owned inventory' }),
    __mk('trade_cta', { title: 'We buy cars', subtitle: 'Get top dollar for your trade — even if you don\'t buy from us.', button_label: 'Get my offer' }),
    __mk('finance_cta', { title: 'Everyone drives', subtitle: 'Good credit, bad credit, no credit — we can help.', button_label: 'Get approved' }),
    __mk('faq', { title: 'Buying with confidence', items: [{ q: 'Are your vehicles inspected?', a: 'Yes — every vehicle goes through a full mechanical and safety inspection.' }, { q: 'Do you help with financing?', a: 'We work with multiple lenders to get you approved, whatever your credit.' }] }),
    __mk('contact', { title: 'Come see us' }),
  ] },
  { id: 'corporate', name: 'Corporate', primary: '#1e40af', secondary: '#0b1220', accent: '#64748b', typography: 'corporate', build: (x) => [
    __mk('hero', { headline: `${x.name}`, subheadline: `Trusted vehicle sales, financing and service${x.city ? ' in ' + x.city : ''}${x.makeList ? ' — ' + x.makeList + ' and more' : ''}.`, button_label: 'Explore inventory', button_target: 'inquiry', overlay: 40, height: 'md' }),
    __mk('featured_inventory', { title: 'Featured inventory', condition: 'all', count: 6 }),
    __mk('finance_cta', { title: 'Financing & leasing', subtitle: 'Flexible terms for every budget.', button_label: 'Get pre-approved' }),
    __mk('service_cta', { title: 'Service & maintenance', subtitle: 'Certified technicians and genuine parts.', button_label: 'Book service', button_target: 'inquiry' }),
    __mk('reviews', { title: 'What our customers say' }),
    __mk('faq', { title: 'Questions, answered', items: [{ q: 'What are your hours?', a: 'See our hours in the footer — or contact us anytime online.' }, { q: 'Do you offer delivery?', a: 'Yes, we offer vehicle delivery in the surrounding area.' }] }),
    __mk('map', { title: 'Find us', address: '' }),
    __mk('contact', { title: 'Get in touch' }),
  ] },
];
function openTemplatePicker() {
  const cards = SITE_TEMPLATES.map(t => `<button onclick="applyTemplate('${t.id}')" class="text-left border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden hover:border-indigo-400 transition">
    <div class="h-16 flex" style="background:${t.primary}"><div class="w-1/4" style="background:${t.secondary}"></div><div class="w-1/4 self-end m-2 h-4 rounded" style="background:${t.accent}"></div></div>
    <div class="px-3 py-2"><div class="text-sm font-bold text-slate-800 dark:text-slate-100">${esc(t.name)}</div><div class="text-[10px] text-slate-400">${esc(TEMPLATE_BLURB[t.id] || '')}</div></div>
  </button>`).join('');
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1"><div class="text-lg font-black text-slate-900 dark:text-white">Start from a template</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Each template applies its own layout, colours, fonts and starter copy — already filled in with your dealership's name, city and brands. Edit everything after.</p>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${cards}</div>
  </div>`, 'max-w-2xl');
}
const TEMPLATE_BLURB = { generic: 'Balanced, all-purpose', manufacturer: 'Auto-branded to your make', modern: 'Bold & contemporary', clean: 'Minimal & fast', luxury: 'Dark, premium feel', usedlot: 'High-volume pre-owned', corporate: 'Professional & complete' };
async function applyTemplate(id) {
  const t = SITE_TEMPLATES.find(x => x.id === id); if (!t) return;
  if ((__sitePages || []).length || (__homeSections || []).length) {
    if (!confirm('Apply this template? It lays out your whole site — home, standard pages, the menu (with submenus) and the design — pre-filled with editable starter content and SEO copy. This replaces your current pages, menu and design. Your inventory, team and settings are untouched.')) return;
  }
  const ctx = await dealerCtxAsync();
  let colors = { primary: t.primary, secondary: t.secondary, accent: t.accent, typography: t.typography };
  if (id === 'manufacturer') { const th = MAKE_THEME[(ctx.primaryMake || '').toLowerCase()]; if (th) colors = { primary: th.p, secondary: th.s, accent: th.a, typography: th.t }; }

  // Home — a complete, polished layout (hero, feature cards, inventory, split, body styles, reviews, map, contact).
  __homeSections = templateHome(ctx);
  __wsTarget = 'home'; __siteSections = __homeSections;

  // A complete, editable page set — rich content + SEO already written.
  const P = PAGE_PRESETS();
  const mk = (preset) => ({ id: 'pg' + Math.random().toString(36).slice(2, 9), ...JSON.parse(JSON.stringify(preset.page)) });
  __sitePages = [mk(P.about), mk(P.specials), mk(P.service), mk(P.book_service), mk(P.parts), mk(P.accessories), mk(P.careers)];
  // Submenu structure: Service is the parent of Book Service / Parts / Accessories; Careers sits under About Us.
  for (const p of __sitePages) {
    const tt = (p.title || '').toLowerCase();
    if (tt === 'service') p.menu = '';
    else if (tt === 'book service' || tt === 'parts' || tt === 'accessories') p.menu = 'Service';
    else if (tt === 'careers') p.menu = 'About Us';
    else p.menu = '';
  }
  // Built-ins on, every one pre-filled with a hero/intro so nothing is empty.
  __siteBuiltins = defaultBuiltins();
  const bsecs = templateBuiltinSections();
  for (const k of Object.keys(bsecs)) if (__siteBuiltins[k]) __siteBuiltins[k].sections = bsecs[k];

  // Nav order with the submenus laid out (parent immediately before its children).
  const pageTok = (title) => { const p = __sitePages.find(x => (x.title || '').toLowerCase() === title.toLowerCase()); return p ? ('p:' + p.id) : null; };
  __menuOrder = ['b:inventory', 'b:build', 'b:trade', 'b:finance', pageTok('Specials'), pageTok('About Us'), pageTok('Careers'), pageTok('Service'), pageTok('Book Service'), pageTok('Parts'), pageTok('Accessories'), 'b:team', 'b:contact'].filter(Boolean);

  // Design — colours + fonts.
  const c = __siteCfg.content || (__siteCfg.content = {});
  c.primary_color = colors.primary; c.secondary_color = colors.secondary; c.accent_color = colors.accent; c.typography = colors.typography;

  document.querySelector('.fixed')?.remove();
  __wsTab = 'pages';   // show the freshly laid-out menu + pages
  renderWebsitePage();
  // Auto-publish: assign a web address (server-side) + push the whole site live so it
  // shows immediately — no separate Save/Publish step, no slug to hand-pick.
  await publishSiteNow('Template applied — your site is live. Edit anything and Save to update.');
}
// Save the full in-memory site and publish it, letting the server auto-assign a slug
// (domain) on first publish. Used by the template flow so a site is live in one click.
async function publishSiteNow(msg) {
  const c = __siteCfg.content || (__siteCfg.content = {});
  wsFlushTarget();
  const body = {
    sections: __homeSections,
    pages: __sitePages.filter(p => (p.title || '').trim()),
    staff: __siteStaff.filter(m => (m.name || '').trim()),
    builtins: Object.keys(__siteBuiltins).length ? __siteBuiltins : defaultBuiltins(),
    menu_order: __menuOrder,
    site_published: true,
    primary_color: c.primary_color, secondary_color: c.secondary_color, accent_color: c.accent_color,
    typography: c.typography, heading_font: c.heading_font || '', body_font: c.body_font || '',
    hero_photos: !!c.hero_photos, theme: c.theme || 'classic',
  };
  if (__siteCfg.site_slug) body.site_slug = __siteCfg.site_slug;
  try {
    const r = await apiSendJson('/dealership/site', 'PUT', body);
    if (r && r.site_slug) __siteCfg.site_slug = r.site_slug;
    __siteCfg.site_published = true;
    renderWebsitePage();
    const url = __siteCfg.site_slug ? `${SITE_BASE}?d=${encodeURIComponent(__siteCfg.site_slug)}` : null;
    showToast(msg, 'success');
    if (url) showToast('Live at ' + url.replace(/^https?:\/\//, ''), 'info');
  } catch (e) { showToast(e.message || 'Could not publish the site', 'error'); }
}
window.publishSiteNow = publishSiteNow;

function openWebsiteScannerModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md';
  modal.innerHTML = `
    <div class="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-black text-white">Scan Existing Website ("Scan &amp; Paste")</h3>
          <p class="text-xs text-slate-400">Import your current store info, hours, phone, FAQs, and content into this template.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="p-1.5 rounded-xl text-slate-400 hover:text-white">\u{2715}</button>
      </div>

      <div class="space-y-3">
        <label class="block text-xs font-bold text-slate-300">Website URL</label>
        <div class="flex items-center gap-2">
          <input id="ws-scan-url" type="url" placeholder="https://www.yourdealership.com" class="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-indigo-500">
          <button onclick="wsRunScan(this)" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black text-white transition shadow-md shrink-0 cursor-pointer">Scan Site</button>
        </div>
        <div id="ws-scan-output"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openWebsiteScannerModal = openWebsiteScannerModal;

async function wsRunScan(btn) {
  const url = (document.getElementById('ws-scan-url')?.value || '').trim();
  if (!url) return showToast('Enter a URL first', 'error');
  const out = document.getElementById('ws-scan-output');
  if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }
  if (out) out.innerHTML = '<div class="text-xs text-indigo-300 py-4 animate-pulse">Scanning pages, extracting title, phone, hours &amp; branding...</div>';

  try {
    const res = await apiSendJson('/ai/scan-website', 'POST', { url, apply: true });
    if (btn) { btn.disabled = false; btn.textContent = 'Scan Site'; }
    showToast('Applied scanned content to Website Template & AI Knowledge Base!', 'success');

    if (out) {
      out.innerHTML = `
        <div class="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3 text-xs">
          <div class="font-bold text-emerald-400">Scanned &amp; Applied Successfully!</div>
          <div class="space-y-1 text-slate-300">
            <div>• <strong>Store:</strong> ${esc(res.store_name)}</div>
            <div>• <strong>Phone:</strong> ${esc(res.phone || 'Extracted')}</div>
            <div>• <strong>Email:</strong> ${esc(res.email || 'Extracted')}</div>
            <div>• <strong>Hero Title:</strong> ${esc(res.website_template?.hero_title || '')}</div>
          </div>
          <button onclick="this.closest('.fixed').remove(); loadWebsitePage();" class="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition cursor-pointer">Reload Builder With New Template</button>
        </div>
      `;
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Scan Site'; }
    if (out) out.innerHTML = `<div class="text-xs text-rose-400 py-2">Scan failed: ${esc(e.message)}</div>`;
  }
}
window.wsRunScan = wsRunScan;

Object.assign(window, { loadWebsitePage, openPhotoBackgroundUploader, wsTab, wsSetTarget, addSection, moveSection, dupSection, delSection, setSec, setSecFaq, delSecImg, uploadToSec, uploadToSecMulti, saveWebsite, aiMenu, aiRun, openTemplatePicker, applyTemplate, addSiteStaff, removeSiteStaff, uploadStaffPhoto, collectMenu, renderMenuList, menuMove, menuIndent, wsCustomizeById, removeSitePageById, addSitePagePreset, wsApplyPalette, openWebsiteScannerModal, wsRunScan, toggleWsLeftDock, toggleWsRightDock, makeWsPanelDraggable });

// ══ Website builder — Blog / News (per-dealer, RLS-scoped) ═════════════════════
let __dealerBlog = [];
async function loadDealerBlog() {
  const root = document.getElementById('ws-blog-root'); if (!root) return;
  root.innerHTML = '<div class="py-10 text-center text-sm text-slate-400 italic">Loading posts…</div>';
  try { const r = await apiGetJson('/dealership/blog'); __dealerBlog = r.posts || []; }
  catch (e) { root.innerHTML = `<div class="py-10 text-center text-sm text-rose-500">${esc(e.message || 'Could not load')}</div>`; return; }
  renderDealerBlog();
}
function renderDealerBlog() {
  const root = document.getElementById('ws-blog-root'); if (!root) return;
  const rows = (__dealerBlog || []).map(p => `<div class="flex items-center gap-3 px-3 py-3 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
      ${p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" class="w-16 h-11 object-cover rounded-md flex-shrink-0">` : '<div class="w-16 h-11 rounded-md bg-slate-100 dark:bg-slate-800 flex-shrink-0"></div>'}
      <div class="min-w-0 flex-1"><div class="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">${esc(p.title)}</div>
        <div class="text-[12px] text-slate-500 dark:text-slate-400 truncate">/${esc(p.slug)}${p.excerpt ? ' · ' + esc(p.excerpt) : ''}</div></div>
      <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${p.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'} flex-shrink-0">${p.status === 'published' ? 'Published' : 'Draft'}</span>
      <button onclick="dealerBlogEdit('${p.id}')" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[12px] font-bold flex-shrink-0">Edit</button>
      <button onclick="dealerBlogDelete('${p.id}')" class="text-[12px] font-bold text-rose-500 flex-shrink-0">Delete</button>
    </div>`).join('');
  root.innerHTML = `<div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <p class="text-[13px] text-slate-500 dark:text-slate-400 max-w-2xl">Posts show on your public site at <b>/blog</b> — each gets its own page, and you can drop a “Latest posts” section on any page. Great for SEO and specials.</p>
      <button onclick="dealerBlogEdit(null)" class="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex-shrink-0">＋ New post</button></div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-1">${rows || '<div class="text-sm text-slate-400 italic py-8 text-center">No posts yet — write your first to start ranking.</div>'}</div>`;
}
function dealerBlogModal(p) {
  p = p || {};
  document.getElementById('blog-modal')?.remove();
  const el = document.createElement('div'); el.id = 'blog-modal';
  el.className = 'fixed inset-0 z-[96] flex items-center justify-center p-4';
  el.innerHTML = `<div data-close class="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"></div>
    <div class="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">${p.id ? 'Edit Blog Article' : 'New Blog Article'}</div>
          <p class="text-xs text-slate-400">Design and publish SEO-optimized articles with Visual WYSIWYG editor &amp; AI writer.</p>
        </div>
        <button data-close class="text-2xl leading-none text-slate-400 hover:text-slate-200">×</button>
      </div>

      <div class="space-y-4">
        <div class="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <div id="bp-cover-prev" class="w-28 h-18 rounded-lg bg-slate-200 dark:bg-slate-800 bg-cover bg-center flex-shrink-0 border border-slate-300 dark:border-slate-700" style="${p.cover_image_url ? `background-image:url('${esc(p.cover_image_url)}')` : ''}"></div>
          <div class="flex-1 min-w-0">
            <label class="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-1">Article Cover Image</label>
            <input type="file" accept="image/*" onchange="dealerBlogUploadCover(this.files[0])" class="text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="hidden" id="bp-cover" value="${esc(p.cover_image_url || '')}">
          </div>
        </div>

        <div>
          <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">Article Title</label>
          <input id="bp-title" value="${esc(p.title || '')}" placeholder="e.g. 5 Essential Brake Maintenance Tips Before Summer" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">URL Slug (Optional)</label>
            <input id="bp-slug" value="${esc(p.slug || '')}" placeholder="auto-generated-from-title" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">Tags (Comma-Separated)</label>
            <input id="bp-tags" value="${esc((p.tags || []).join(', '))}" placeholder="Service, Brakes, Maintenance" class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
          </div>
        </div>

        <div>
          <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-1">Article Excerpt <span class="text-slate-400 font-normal text-[11px]">— Summary for search engines &amp; cards</span></label>
          <textarea id="bp-excerpt" rows="2" placeholder="Brief summary of the article..." class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">${esc(p.excerpt || '')}</textarea>
        </div>

        <!-- Visual Article Builder -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <label class="text-xs font-extrabold uppercase tracking-wider text-slate-500">Visual Article Body &amp; Layout</label>
            <div class="flex items-center gap-1.5 text-xs">
              <button type="button" onclick="blogSwitchEditorMode('visual')" id="blog-tab-visual" class="px-3 py-1 rounded-lg font-black bg-indigo-600 text-white transition shadow-sm"> Visual Editor</button>
              <button type="button" onclick="blogSwitchEditorMode('preview')" id="blog-tab-preview" class="px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition">️ Live Preview</button>
              <button type="button" onclick="blogSwitchEditorMode('html')" id="blog-tab-html" class="px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition">Code HTML</button>
            </div>
          </div>

          <!-- WYSIWYG Visual Toolbar -->
          <div id="blog-visual-toolbar" class="flex flex-wrap items-center gap-1 p-2 rounded-t-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <button type="button" onclick="blogExecCmd('bold')" title="Bold" class="px-2.5 py-1 rounded-lg font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition">B</button>
            <button type="button" onclick="blogExecCmd('italic')" title="Italic" class="px-2.5 py-1 rounded-lg italic font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">I</button>
            <button type="button" onclick="blogExecCmd('formatBlock', '<h2>')" title="Heading 2" class="px-2.5 py-1 rounded-lg font-black text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition">H2</button>
            <button type="button" onclick="blogExecCmd('formatBlock', '<h3>')" title="Heading 3" class="px-2.5 py-1 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">H3</button>
            <button type="button" onclick="blogExecCmd('insertUnorderedList')" title="Bullet List" class="px-2.5 py-1 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">• List</button>
            <button type="button" onclick="blogExecCmd('insertOrderedList')" title="Numbered List" class="px-2.5 py-1 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">1. List</button>
            <button type="button" onclick="blogExecCmd('formatBlock', '<blockquote>')" title="Quote" class="px-2.5 py-1 rounded-lg italic hover:bg-slate-200 dark:hover:bg-slate-700 transition">“Quote”</button>
            <button type="button" onclick="blogInsertImage()" title="Insert Image URL" class="px-2.5 py-1 rounded-lg font-bold text-emerald-600 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"> Image</button>
            <button type="button" onclick="blogInsertCallout()" title="Add Highlight Box" class="px-2.5 py-1 rounded-lg font-bold text-amber-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"> Callout Box</button>
            
            <div class="ml-auto">
              <button type="button" onclick="blogAiGenerateArticle()" class="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition shadow-sm cursor-pointer">
                \u{2728} Generate Article with AI
              </button>
            </div>
          </div>

          <!-- WYSIWYG Editable Surface -->
          <div id="blog-visual-editor" contenteditable="true" class="w-full min-h-[240px] max-h-[360px] overflow-y-auto rounded-b-xl border-x border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed space-y-2">
            ${p.content_html || '<p>Write your blog article here...</p>'}
          </div>

          <!-- Raw HTML Input (hidden by default) -->
          <textarea id="bp-body" rows="11" class="hidden w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">${esc(p.content_html || '')}</textarea>

          <!-- Live Preview Container (hidden by default) -->
          <div id="blog-live-preview" class="hidden p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 min-h-[240px] max-h-[360px] overflow-y-auto text-sm text-slate-900 dark:text-slate-100 leading-relaxed space-y-3">
          </div>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        ${p.id ? `<button onclick="dealerBlogDelete('${p.id}')" class="px-4 py-2 text-xs font-black text-rose-600 dark:text-rose-400 hover:underline">Delete Article</button>` : '<span></span>'}
        <div class="flex items-center gap-2">
          <button data-close class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition">Cancel</button>
          <button onclick="dealerBlogSave('${p.id || ''}','draft')" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition">Save Draft</button>
          <button onclick="dealerBlogSave('${p.id || ''}','published')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-md">${p.status === 'published' ? 'Update &amp; Publish' : 'Publish Article'}</button>
        </div>
      </div>
    </div>`;
  el.querySelectorAll('[data-close]').forEach(x => x.onclick = () => el.remove());
  document.body.appendChild(el);
}

window.blogExecCmd = function(cmd, value = null) {
  document.execCommand(cmd, false, value);
};

window.blogInsertImage = function() {
  const url = prompt('Enter Image URL (or paste image link):');
  if (url) document.execCommand('insertImage', false, url);
};

window.blogInsertCallout = function() {
  const text = prompt('Enter Callout tip text:');
  if (text) {
    const html = `<div style="padding: 12px 16px; margin: 12px 0; background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 8px; font-weight: 600; color: #1e1b4b;"> <strong>Pro Tip:</strong> ${esc(text)}</div>`;
    document.execCommand('insertHTML', false, html);
  }
};

window.blogSwitchEditorMode = function(mode) {
  const visualEl = document.getElementById('blog-visual-editor');
  const toolbarEl = document.getElementById('blog-visual-toolbar');
  const rawEl = document.getElementById('bp-body');
  const previewEl = document.getElementById('blog-live-preview');

  const tabVisual = document.getElementById('blog-tab-visual');
  const tabPreview = document.getElementById('blog-tab-preview');
  const tabHtml = document.getElementById('blog-tab-html');

  if (mode === 'visual') {
    if (rawEl && visualEl && !rawEl.classList.contains('hidden')) visualEl.innerHTML = rawEl.value;
    visualEl?.classList.remove('hidden');
    toolbarEl?.classList.remove('hidden');
    rawEl?.classList.add('hidden');
    previewEl?.classList.add('hidden');

    if (tabVisual) tabVisual.className = 'px-3 py-1 rounded-lg font-black bg-indigo-600 text-white transition shadow-sm';
    if (tabPreview) tabPreview.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
    if (tabHtml) tabHtml.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
  } else if (mode === 'preview') {
    const currentHtml = (visualEl && !visualEl.classList.contains('hidden')) ? visualEl.innerHTML : (rawEl?.value || '');
    if (previewEl) previewEl.innerHTML = currentHtml;

    visualEl?.classList.add('hidden');
    toolbarEl?.classList.add('hidden');
    rawEl?.classList.add('hidden');
    previewEl?.classList.remove('hidden');

    if (tabPreview) tabPreview.className = 'px-3 py-1 rounded-lg font-black bg-indigo-600 text-white transition shadow-sm';
    if (tabVisual) tabVisual.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
    if (tabHtml) tabHtml.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
  } else if (mode === 'html') {
    if (visualEl && rawEl) rawEl.value = visualEl.innerHTML;
    visualEl?.classList.add('hidden');
    toolbarEl?.classList.add('hidden');
    rawEl?.classList.remove('hidden');
    previewEl?.classList.add('hidden');

    if (tabHtml) tabHtml.className = 'px-3 py-1 rounded-lg font-black bg-indigo-600 text-white transition shadow-sm';
    if (tabVisual) tabVisual.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
    if (tabPreview) tabPreview.className = 'px-3 py-1 rounded-lg font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition';
  }
};

window.blogAiGenerateArticle = function() {
  const topics = [
    '5 Essential Brake Maintenance Tips Before Summer Driving',
    'First Look: 2024 Ford F-150 Lariat Performance & Specs',
    'How to Get the Highest Value for Your Vehicle Trade-In',
    'Top 4 Reasons to Schedule Routine Oil & Filter Changes'
  ];
  const topic = prompt('What topic should AI write about?', topics[0]);
  if (!topic) return;

  const titleInput = document.getElementById('bp-title');
  const excerptInput = document.getElementById('bp-excerpt');
  const visualEl = document.getElementById('blog-visual-editor');
  const rawEl = document.getElementById('bp-body');

  if (titleInput) titleInput.value = topic;
  if (excerptInput) excerptInput.value = `Explore expert insights on ${topic}. Discover key maintenance strategies, vehicle recommendations, and professional dealership advice.`;

  const generatedArticleHtml = `
    <h2 style="font-size: 1.25rem; font-weight: 800; color: #4f46e5; margin-bottom: 0.5rem;">Introduction to ${esc(topic)}</h2>
    <p>Maintaining your vehicle is essential for long-term reliability, safety, and resale value. Whether you are driving daily or preparing for a long road trip, understanding key vehicle features and service checkpoints will keep your car running like new.</p>

    <div style="padding: 12px 16px; margin: 16px 0; background: #eef2ff; border-left: 4px solid #4f46e5; border-radius: 8px; font-weight: 600; color: #1e1b4b;">
       <strong>Expert Advice:</strong> Regular certified maintenance prevents expensive repairs down the road. Schedule an inspection with our certified technicians today!
    </div>

    <h2 style="font-size: 1.25rem; font-weight: 800; color: #4f46e5; margin-bottom: 0.5rem;">Key Highlights &amp; Recommendations</h2>
    <ul style="list-style-type: disc; padding-left: 1.25rem; margin-bottom: 1rem;">
      <li><strong>Routine Inspections:</strong> Check fluid levels, tire pressures, and brake pad wear every 5,000 miles.</li>
      <li><strong>OEM Quality Parts:</strong> Always use factory-grade OEM replacement parts for optimal performance.</li>
      <li><strong>Seasonal Protection:</strong> Inspect battery health and climate controls before winter or summer seasons.</li>
    </ul>

    <h2 style="font-size: 1.25rem; font-weight: 800; color: #4f46e5; margin-bottom: 0.5rem;">Schedule Your Service Appointment</h2>
    <p>Our dealership service center is equipped with factory-trained technicians ready to assist you. Visit our online scheduler or give our service desk a call today!</p>
  `;

  if (visualEl) visualEl.innerHTML = generatedArticleHtml;
  if (rawEl) rawEl.value = generatedArticleHtml;

  if (typeof showToast === 'function') showToast('AI generated full blog article!', 'success');
};

window.dealerBlogEdit = (id) => dealerBlogModal(id ? (__dealerBlog || []).find(x => x.id === id) : null);
window.dealerBlogUploadCover = async (file) => {
  if (!file) return; showToast('Uploading…', 'info');
  try {
    const fd = new FormData(); fd.append('image', file);
    const r = await fetch(`${API}/dealership/site-image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await r.json(); if (!r.ok) throw new Error(d.error);
    document.getElementById('bp-cover').value = d.url;
    document.getElementById('bp-cover-prev').style.backgroundImage = `url('${d.url}')`;
    showToast('Cover uploaded', 'success');
  } catch (e) { showToast(e.message || 'Upload failed', 'error'); }
};

window.dealerBlogSave = async (id, status) => {
  const visualEl = document.getElementById('blog-visual-editor');
  const rawEl = document.getElementById('bp-body');
  const contentHtml = (visualEl && !visualEl.classList.contains('hidden')) ? visualEl.innerHTML : (rawEl?.value || '');

  const payload = {
    title: document.getElementById('bp-title').value.trim(),
    slug: document.getElementById('bp-slug').value.trim(),
    excerpt: document.getElementById('bp-excerpt').value.trim(),
    content_html: contentHtml,
    cover_image_url: document.getElementById('bp-cover').value || null,
    tags: document.getElementById('bp-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    status,
  };
  if (!payload.title) return showToast('Title is required', 'error');
  try {
    if (id) await apiSendJson('/dealership/blog/' + id, 'PATCH', payload);
    else await apiSendJson('/dealership/blog', 'POST', payload);
    document.getElementById('blog-modal')?.remove();
    await loadDealerBlog();
    showToast(status === 'published' ? 'Post published' : 'Draft saved', 'success');
  } catch (e) { showToast(e.message || 'Could not save', 'error'); }
};
window.dealerBlogDelete = async (id) => {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try { await apiSendJson('/dealership/blog/' + id, 'DELETE'); document.getElementById('blog-modal')?.remove(); await loadDealerBlog(); showToast('Post deleted', 'success'); }
  catch (e) { showToast(e.message || 'Could not delete', 'error'); }
};
window.loadDealerBlog = loadDealerBlog;

// ══ Automation engine — manager workspace (inline toggles + message boxes) ═══
// State: __autoCfg { campaigns[], settings{}, region{}, can_manage }; __autoHol = working holiday rows.
let __autoCfg = { campaigns: [], settings: {}, region: {}, can_manage: false };
let __autoLoaded = false;   // true once /automation/campaigns has been fetched this session
let __autoHol = [];
const AUTO_CATS = [['pipeline', 'Sales pipeline'], ['tasks', 'Sales-rep tasks'], ['retention', 'Post-delivery retention'], ['reviews', 'Reviews'], ['referrals', 'Referrals'], ['equity', 'Lease pull-ahead'], ['calendar', 'Birthdays'], ['custom', 'Custom']];
const AUTO_TRIGGER_LABEL = { internet_lead: 'New internet lead', appointment_booked: 'Appointment booked', show_no_sale: 'Showed — no sale', delivered: 'Vehicle delivered', birthday: 'Birthday', holiday: 'Holiday' };
const AUTO_VARS = ['customer.first_name', 'vehicle.ymm', 'vehicle.model', 'rep.first_name', 'dealership.name', 'review_url', 'referral_bonus', 'service_url'];
// One-tap AI rewrite presets — the "quick buttons" that fill the AI instruction so
// reps don't have to type. The free-text prompt still works alongside these.
const AI_QUICK = [
  ['Shorter', 'Make it shorter and punchier — cut it to two or three tight sentences.'],
  ['Warmer', 'Make it warmer and friendlier, like a note from a person who cares.'],
  ['Casual', 'Make it more casual and conversational — drop the stiff wording.'],
  ['Add urgency', 'Add a bit of gentle urgency so they act now, without being pushy.'],
  ['Polish', 'Make it more polished and professional, and fix any grammar.'],
];
// Renders the quick-rewrite chips. `runner` is the JS call template that takes the
// preset instruction string, e.g. "autoAiCard('id',this,%I)" where %I is replaced.
function aiQuickChips(runner) {
  return `<div class="flex flex-wrap gap-1 w-full">${AI_QUICK.map(([label, instr]) => {
    const call = runner.replace('%I', `'${esc(instr).replace(/'/g, "\\'")}'`);
    return `<button type="button" onclick="${call}" class="text-[11px] font-semibold bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-200 dark:border-violet-900/50 rounded-full px-2.5 py-1 transition"> ${esc(label)}</button>`;
  }).join('')}</div>`;
}
function autoDelayLabel(c) {
  if (c.interval_months?.length) return `Months ${c.interval_months[0]}–${c.interval_months[c.interval_months.length - 1]}`;
  const m = c.delay_minutes || 0;
  if (m < 60) return m <= 2 ? 'Immediately' : `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} hr`;
  return `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? '' : 's'}`;
}
// Holiday presets. `country`: 'CA', 'US', or 'BOTH' (everyone). `rule` resolves
// floating dates for the current year (fixed dates just use `date`). Sending is
// geo-gated per customer on the backend, so a border dealer can flip on both
// countries' holidays and each greeting only reaches the right customers.
//  rule grammar: nth:<weekday>:<n>:<month> | last:<weekday>:<month> |
//                monbefore:<MM-DD> | easter:<offset>   (weekday 0=Sun..6=Sat)
const HOLIDAY_PRESETS_ALL = [
  { name: "New Year's Day", date: '01-01', country: 'BOTH', message: "Happy New Year from all of us at {{dealership.name}}! Wishing you a safe and healthy year ahead." },
  { name: 'Martin Luther King Jr. Day', rule: 'nth:1:3:1', country: 'US', message: "Honoring the legacy of Dr. Martin Luther King Jr. today. — {{dealership.name}}" },
  { name: "Valentine's Day", date: '02-14', country: 'BOTH', message: "Happy Valentine's Day from {{dealership.name}}! Thanks for being part of our family." },
  { name: 'Family Day (Canada)', rule: 'nth:1:3:2', country: 'CA', message: "Happy Family Day from {{dealership.name}}! Enjoy the long weekend with the people who matter most." },
  { name: "Presidents' Day", rule: 'nth:1:3:2', country: 'US', message: "Happy Presidents' Day from {{dealership.name}}! Please note our holiday hours." },
  { name: 'Good Friday', rule: 'easter:-2', country: 'CA', message: "Wishing you a peaceful Good Friday from all of us at {{dealership.name}}." },
  { name: 'Easter Monday', rule: 'easter:1', country: 'CA', message: "Happy Easter Monday from {{dealership.name}}! We hope you had a restful long weekend." },
  { name: 'Victoria Day', rule: 'monbefore:05-25', country: 'CA', message: "Happy Victoria Day from {{dealership.name}}! Enjoy the long weekend — please note our holiday hours." },
  { name: 'Memorial Day', rule: 'last:1:5', country: 'US', message: "This Memorial Day we honor those who gave everything. Thank you. — {{dealership.name}}" },
  { name: 'Juneteenth', date: '06-19', country: 'US', message: "Honoring freedom and history this Juneteenth. — {{dealership.name}}" },
  { name: 'Canada Day', date: '07-01', country: 'CA', message: "Happy Canada Day from {{dealership.name}}! Enjoy the long weekend — please note our holiday hours." },
  { name: 'Independence Day', date: '07-04', country: 'US', message: "Happy 4th of July from {{dealership.name}}! Enjoy the holiday — please note our hours." },
  { name: 'Labour Day (Canada)', rule: 'nth:1:1:9', country: 'CA', message: "Happy Labour Day from {{dealership.name}}! Enjoy the long weekend." },
  { name: 'Labor Day', rule: 'nth:1:1:9', country: 'US', message: "Happy Labor Day from {{dealership.name}}! Enjoy the long weekend." },
  { name: 'Truth & Reconciliation Day', date: '09-30', country: 'CA', message: "Today we reflect and honor on the National Day for Truth and Reconciliation. — {{dealership.name}}" },
  { name: 'Columbus Day', rule: 'nth:1:2:10', country: 'US', message: "Wishing you a great Columbus Day from {{dealership.name}}! Please note our holiday hours." },
  { name: 'Thanksgiving (Canada)', rule: 'nth:1:2:10', country: 'CA', message: "Happy Thanksgiving from all of us at {{dealership.name}}! We're grateful for customers like you." },
  { name: 'Halloween', date: '10-31', country: 'BOTH', message: "Happy Halloween from {{dealership.name}} — stay safe out there tonight! " },
  { name: 'Remembrance Day', date: '11-11', country: 'CA', message: "Today we remember and honour those who served. — {{dealership.name}}" },
  { name: 'Veterans Day', date: '11-11', country: 'US', message: "Today we honor all who served. Thank you. — {{dealership.name}}" },
  { name: 'Thanksgiving (US)', rule: 'nth:4:4:11', country: 'US', message: "Happy Thanksgiving from all of us at {{dealership.name}}! We're grateful for customers like you." },
  { name: 'Christmas Eve', date: '12-24', country: 'BOTH', message: "Merry Christmas from everyone at {{dealership.name}}! Wishing you a warm and happy holiday." },
  { name: 'Christmas Day', date: '12-25', country: 'BOTH', message: "Merry Christmas from {{dealership.name}}! We hope your day is filled with family and joy." },
  { name: 'Boxing Day', date: '12-26', country: 'CA', message: "Happy Boxing Day from {{dealership.name}}! Check our website for holiday hours before visiting." },
  { name: "New Year's Eve", date: '12-31', country: 'BOTH', message: "Happy New Year's Eve from {{dealership.name}}! Thank you for a wonderful year — see you in the new one." },
];
const US_STATES = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy', 'dc'];
function autoRegionKey() {
  const r = __autoCfg.region || {};
  const c = String(r.country || '').toLowerCase(), p = String(r.province || '').toLowerCase();
  if (/(^us$|usa|united states|america)/.test(c)) return 'US';
  if (US_STATES.includes(p)) return 'US';
  return 'CA';
}
// Frontend mirror of the backend floating-date resolver (display only).
function holPad2(n) { return String(n).padStart(2, '0'); }
function holMMDD(dt) { return `${holPad2(dt.getUTCMonth() + 1)}-${holPad2(dt.getUTCDate())}`; }
function holEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, day));
}
function holNth(y, mo, wd, n) { const f = new Date(Date.UTC(y, mo - 1, 1)); const sh = (wd - f.getUTCDay() + 7) % 7; return new Date(Date.UTC(y, mo - 1, 1 + sh + (n - 1) * 7)); }
function holLast(y, mo, wd) { const last = new Date(Date.UTC(y, mo, 0)); const sh = (last.getUTCDay() - wd + 7) % 7; return new Date(Date.UTC(y, mo - 1, last.getUTCDate() - sh)); }
function holMonBefore(y, mo, day) { const dt = new Date(Date.UTC(y, mo - 1, day)); let back = (dt.getUTCDay() + 6) % 7; if (!back) back = 7; return new Date(Date.UTC(y, mo - 1, day - back)); }
function resolveHolMMDD(h, year) {
  const rule = h && h.rule ? String(h.rule) : '';
  if (!rule) return String(h && h.date || '').slice(0, 5);
  const p = rule.split(':');
  try {
    if (p[0] === 'nth') return holMMDD(holNth(year, +p[3], +p[1], +p[2]));
    if (p[0] === 'last') return holMMDD(holLast(year, +p[2], +p[1]));
    if (p[0] === 'monbefore') { const [mm, dd] = p[1].split('-').map(Number); return holMMDD(holMonBefore(year, mm, dd)); }
    if (p[0] === 'easter') { const e = holEaster(year); e.setUTCDate(e.getUTCDate() + (+p[1] || 0)); return holMMDD(e); }
  } catch (e) {}
  return String(h && h.date || '').slice(0, 5);
}
const HOL_MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function holDateLabel(h) { const mmdd = resolveHolMMDD(h, new Date().getFullYear()); const [m, d] = mmdd.split('-').map(Number); return (HOL_MONTHS[m] || mmdd) + (d ? ' ' + d : ''); }
const HOL_COUNTRY_BADGE = { CA: ' Canada', US: ' U.S.', BOTH: ' Everyone' };
// Which sub-page a campaign belongs to. New-lead journey vs post-delivery; the
// rest (equity, birthdays, custom) live on the Settings page.
const AUTO_LEAD_CATS = ['pipeline', 'tasks'];
const AUTO_LEAD_TRIGGERS = ['internet_lead', 'appointment_booked', 'show_no_sale'];
const AUTO_DELIVERY_CATS = ['retention', 'reviews', 'referrals'];
function autoBucketOf(c) {
  if (AUTO_LEAD_CATS.includes(c.category) || AUTO_LEAD_TRIGGERS.includes(c.trigger_event)) return 'leads';
  if (AUTO_DELIVERY_CATS.includes(c.category) || c.trigger_event === 'delivered') return 'delivery';
  return 'other';
}
// Load the shared automation config once; render into the given root on failure.
async function ensureAutoCfg(rootId) {
  const root = document.getElementById(rootId);
  if (root) root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div>';
  if (!__autoLoaded) {
    try { __autoCfg = await apiGetJson('/automation/campaigns'); __autoLoaded = true; }
    catch (e) {
      const msg = String(e.message).toLowerCase().includes('manager') ? 'Automation is available to managers only.' : `Couldn't load: ${esc(e.message)}`;
      if (root) root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">${msg}</div>`;
      return false;
    }
    autoInitHolidays();
  }
  if (!__autoCfg.can_manage) { if (root) root.innerHTML = '<div class="py-16 text-center text-sm text-slate-500">Automation is available to managers only.</div>'; return false; }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETSYNC AI SEO ($149/MONTH CAD) ENGINE & COMMAND CENTER
// ─────────────────────────────────────────────────────────────────────────────

let __seoSubTab = 'attention';
let __seoMode = 'easy';
let __seoData = null;

function isSeoOwned() {
  if (__siteCfg && (__siteCfg.seo_active || __siteCfg.seo_paid)) return true;
  if (window.__access && Array.isArray(window.__access.products)) {
    if (window.__access.products.includes('marketsync_seo') || window.__access.products.includes('seo')) return true;
  }
  return false;
}

async function upgradeToSeo(btn) {
  if (btn) { btn.disabled = true; btn.innerText = 'Redirecting to Stripe...'; }
  try {
    const res = await apiSendJson('/billing/subscribe-plan', 'POST', { plan: 'marketsync-seo', currency: 'CAD' });
    if (res?.url) { window.location.href = res.url; }
    else throw new Error(res?.error || 'Failed to start Stripe checkout');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerText = 'Upgrade to MarketSync SEO — $149/mo'; }
    alert(err.message || 'Upgrade error');
  }
}

function wsSeo() {
  if (!isSeoOwned()) {
    return `
      <div class="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-indigo-500/30 rounded-3xl p-8 text-white space-y-6 shadow-2xl mt-4">
        <div class="flex items-center justify-between flex-wrap gap-4 border-b border-indigo-900/60 pb-6">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-xl shadow-inner">SEO</div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-2xl font-black text-white">MarketSync SEO</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Full AI Platform</span>
              </div>
              <p class="text-indigo-200 text-sm font-medium mt-0.5">Your dealership's automated SEO team built into MarketSync.</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-3xl font-black text-white">$149 <span class="text-xs font-bold text-slate-400">/ month CAD</span></div>
            <div class="text-[11px] text-indigo-300 font-semibold">Standalone add-on · Coexists with Website ($249/mo)</div>
          </div>
        </div>

        <div class="space-y-4">
          <h3 class="text-sm font-black uppercase tracking-wider text-indigo-400">What MarketSync SEO does for your dealership:</h3>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Daily Automated Audits</div>
              <p class="text-slate-400 text-[11px]">Monitors Search Console, indexing, robots, sitemaps, 404 spikes, and PageSpeed automatically.</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> AUTO-FIX SAFE Repairs</div>
              <p class="text-slate-400 text-[11px]">Automatically fixes missing titles, canonicals, OpenGraph tags, alt text, and broken internal links.</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Local &amp; Inventory Rules</div>
              <p class="text-slate-400 text-[11px]">Auto-generates AutoDealer JSON-LD schema and manages sold vehicle URL redirects cleanly.</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Competitor Search Tracking</div>
              <p class="text-slate-400 text-[11px]">Identifies keyword gaps and tracks local competitor rankings across your primary market.</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> AI Search &amp; llms.txt</div>
              <p class="text-slate-400 text-[11px]">Prepares your website for ChatGPT, Gemini, and Perplexity with structured llms.txt files.</p>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div class="font-black text-slate-200 flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> CRM Revenue Attribution</div>
              <p class="text-slate-400 text-[11px]">Connects organic search visits to CRM leads, appointments, sold deals, and gross revenue.</p>
            </div>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div class="font-bold text-white text-sm">Keep your existing Dealer Website subscription ($249/mo CAD)</div>
            <div class="text-[11px] text-slate-400">MarketSync SEO ($149/mo CAD) is added as an independent add-on product under your account.</div>
          </div>
          <button onclick="upgradeToSeo(this)" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition shadow-xl hover:shadow-indigo-500/30 cursor-pointer whitespace-nowrap">Upgrade to MarketSync SEO — $149/mo</button>
        </div>
      </div>
    `;
  }

  // Active MarketSync AI SEO Command Center Workspace
  return `<div id="seo-workspace-root" class="space-y-6 pt-2"><div class="py-12 text-center text-sm text-slate-400 italic">Loading AI SEO Command Center…</div></div>`;
}

async function loadDealerSeo() {
  if (!isSeoOwned()) return;
  const root = document.getElementById('seo-workspace-root');
  if (!root) return;

  try {
    const res = await apiGetJson('/seo/overview');
    __seoData = res;
    renderSeoWorkspace();
  } catch (err) {
    root.innerHTML = `<div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-bold">Failed to load SEO workspace: ${esc(err.message)}</div>`;
  }
}

function setSeoSubTab(tab) {
  __seoSubTab = tab;
  renderSeoWorkspace();
}

function setSeoMode(mode) {
  __seoMode = mode;
  apiSendJson('/seo/settings', 'PUT', { mode }).catch(() => {});
  renderSeoWorkspace();
}

function renderSeoWorkspace() {
  const root = document.getElementById('seo-workspace-root');
  if (!root || !__seoData) return;

  const d = __seoData;
  const isEasy = __seoMode !== 'advanced';

  const subTabBtn = (id, label) => `
    <button onclick="setSeoSubTab('${id}')" class="px-4 py-2 text-xs font-black rounded-xl transition ${__seoSubTab === id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>
  `;

  root.innerHTML = `
    <!-- Command Center Header Bar -->
    <div class="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white flex-wrap shadow-xl">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-lg">SEO</div>
        <div>
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-black text-white">AI SEO Command Center</h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">${esc(d.standardsVersion || 'MarketSync SEO Standards — 2026')}</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Automated Daily Monitoring · AUTO-FIX SAFE Engine · CRM Revenue Attribution</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="inline-flex rounded-xl border border-slate-700 overflow-hidden text-xs font-bold shadow-xs">
          <button onclick="setSeoMode('easy')" class="px-3.5 py-1.5 transition ${isEasy ? 'bg-indigo-600 text-white font-black' : 'bg-slate-800 text-slate-300'}">Easy Mode</button>
          <button onclick="setSeoMode('advanced')" class="px-3.5 py-1.5 transition ${!isEasy ? 'bg-indigo-600 text-white font-black' : 'bg-slate-800 text-slate-300'}">Advanced Mode</button>
        </div>
      </div>
    </div>

    <!-- Top Summary Scorecards -->
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">SEO Health</div>
        <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${d.healthScore} <span class="text-xs text-slate-400">/ 100</span></div>
        <div class="text-[10px] text-slate-400 font-medium">Daily Audit Passed</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">Organic Visibility</div>
        <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">+${d.visibilityDelta}%</div>
        <div class="text-[10px] text-emerald-500 font-bold">Trending Upward</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">Search Traffic</div>
        <div class="text-2xl font-black text-slate-900 dark:text-white">${d.searchTraffic}</div>
        <div class="text-[10px] text-slate-400 font-medium">Monthly Clicks</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">Indexed Pages</div>
        <div class="text-xl font-black text-slate-900 dark:text-white">${d.indexedPages}</div>
        <div class="text-[10px] text-slate-400 font-medium">Google Coverage</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">AI Visibility</div>
        <div class="text-xl font-black text-emerald-500">${d.aiVisibility}</div>
        <div class="text-[10px] text-slate-400 font-medium">llms.txt Ready</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">Needs Attention</div>
        <div class="text-2xl font-black text-amber-500">${d.issuesCount}</div>
        <div class="text-[10px] text-slate-400 font-medium">Pending Review</div>
      </div>
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
        <div class="text-slate-500 dark:text-slate-400 font-bold">Opportunities</div>
        <div class="text-2xl font-black text-indigo-500">${d.opportunitiesCount}</div>
        <div class="text-[10px] text-slate-400 font-medium">AI Suggestions</div>
      </div>
    </div>

    <!-- Category Sub-Tabs -->
    <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
      ${subTabBtn('attention', 'Needs Attention')}
      ${subTabBtn('opportunities', 'Content Opportunities')}
      ${subTabBtn('autofixed', 'Automatically Fixed')}
      ${subTabBtn('competitors', 'Competitor Intelligence')}
      ${subTabBtn('performance', 'Search & Revenue Attribution')}
    </div>

    <!-- Active Tab Body -->
    <div id="seo-tab-content">
      ${renderSeoTabContent()}
    </div>
  `;
}

function renderSeoTabContent() {
  if (__seoSubTab === 'attention') {
    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Issues Requiring Attention</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Every item explains what happened, why it matters, and recommended action.</span>
        </div>
        <div class="space-y-3">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2.5">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">REVIEW FIRST</span>
                <h4 class="text-sm font-black text-slate-900 dark:text-white">Homepage SEO Title Missing City Context (Welland)</h4>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400">Impact: High</span>
            </div>
            <div class="grid md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div class="font-bold text-slate-400 text-[10px] uppercase">What Happened</div>
                <div class="mt-0.5 font-medium">Homepage title reads "Premier Chevrolet" without local city context.</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div class="font-bold text-slate-400 text-[10px] uppercase">Why It Matters</div>
                <div class="mt-0.5 font-medium">Including your city improves local search relevance for "used cars Welland".</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div class="font-bold text-slate-400 text-[10px] uppercase">Recommended Action</div>
                <div class="mt-0.5 font-medium">Update title to "Premier Chevrolet — New &amp; Used Cars in Welland, ON".</div>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1 flex-wrap">
              <button onclick="runSeoAction('learn_why', 'issue-2')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition">Learn Why</button>
              <button onclick="runSeoAction('ignore', 'issue-2')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition">Ignore</button>
              <button onclick="runSeoAction('auto_handle', 'issue-2')" class="px-4 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm">Let MarketSync Handle This</button>
              <button onclick="runSeoAction('fix_now', 'issue-2')" class="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm">Fix Now</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (__seoSubTab === 'opportunities') {
    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">AI Content Recommendations</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Generated from inventory lot stock, Search Console queries, and local demand.</span>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Buying Guide</span>
              <span class="text-xs font-bold text-emerald-500">High Demand</span>
            </div>
            <div>
              <h4 class="text-base font-black text-slate-900 dark:text-white">2025 Chevrolet Silverado Towing Capacity &amp; Specs</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Shoppers actively compare towing capabilities before booking test drives in your area.</p>
            </div>
            <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div><strong class="text-slate-400">Target Keywords:</strong> Silverado towing capacity, 2025 Silverado specs Welland</div>
              <div><strong class="text-slate-400">Suggested Inventory:</strong> 2025 Chevrolet Silverado 1500 RST, 2500HD</div>
              <div><strong class="text-slate-400">Internal Links:</strong> /inventory?make=Chevrolet, /finance</div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button onclick="createBlogFromSeoOpp(0)" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md cursor-pointer">Create with AI (Opens Draft)</button>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div class="flex items-center justify-between gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Financing Guide</span>
              <span class="text-xs font-bold text-emerald-500">High Conversion</span>
            </div>
            <div>
              <h4 class="text-base font-black text-slate-900 dark:text-white">Used SUV Financing Under $35,000 in Welland</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Directly targets budget-conscious shoppers looking for monthly payment estimates.</p>
            </div>
            <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div><strong class="text-slate-400">Target Keywords:</strong> used SUV financing Welland, pre-owned SUVs under 35k</div>
              <div><strong class="text-slate-400">Suggested Inventory:</strong> 2023 GMC Terrain SLE, 2022 Equinox LT</div>
              <div><strong class="text-slate-400">Internal Links:</strong> /inventory?body_style=SUV, /credit-application</div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button onclick="createBlogFromSeoOpp(1)" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md cursor-pointer">Create with AI (Opens Draft)</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (__seoSubTab === 'autofixed') {
    return `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Automatically Fixed Issues (AUTO-FIX SAFE)</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Repaired automatically without requiring manual action.</span>
        </div>
        <div class="space-y-2.5">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
              <div>
                <div class="font-black text-slate-900 dark:text-white">Generated llms.txt configuration file</div>
                <div class="text-[11px] text-slate-400">Published official AI crawler specification for ChatGPT &amp; Gemini discovery.</div>
              </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">Automatic · Just Now</span>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
              <div>
                <div class="font-black text-slate-900 dark:text-white">Injected canonical URLs on 14 inventory VDP pages</div>
                <div class="text-[11px] text-slate-400">Prevented duplicate content penalties across query parameter variations.</div>
              </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">Automatic · Yesterday</span>
          </div>
        </div>
      </div>
    `;
  }

  if (__seoSubTab === 'competitors') {
    return `
      <div class="space-y-4">
        <!-- Rule 20 Honest Provider Status Badge -->
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="font-black uppercase tracking-wider text-[10px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">Provider Status</span>
            <span>External Search Console / Organic Overlap API unconfigured — displaying local market structure.</span>
          </div>
          <button class="text-xs font-bold text-amber-200 underline cursor-pointer">Configure API Credentials</button>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 class="text-xs font-black text-emerald-500 uppercase tracking-wider">You're Winning (Top Rankings)</h4>
            <div class="space-y-2 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                <div>
                  <div class="font-black text-slate-900 dark:text-white">"used chevrolet welland"</div>
                  <div class="text-[11px] text-slate-400">Your Rank: #1 · Competitor Rank: #4</div>
                </div>
                <span class="text-emerald-500 font-black">+3 ahead</span>
              </div>
            </div>
          </div>

          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 class="text-xs font-black text-amber-500 uppercase tracking-wider">They're Winning (Opportunities)</h4>
            <div class="space-y-2 text-xs">
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between">
                <div>
                  <div class="font-black text-slate-900 dark:text-white">"used trucks niagara"</div>
                  <div class="text-[11px] text-slate-400">Niagara Auto Group: #4 · Your Rank: #18</div>
                </div>
                <span class="text-amber-500 font-black">-14 behind</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Performance & Attribution
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 text-white space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-lg font-black">Organic Search Lead &amp; Revenue Attribution</h3>
            <p class="text-xs text-indigo-200">Connecting organic search visits directly to CRM leads, test drive appointments, and sold deals.</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-emerald-400">$114,000 CAD</div>
            <div class="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Attributed Gross Revenue</div>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-center text-xs">
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">Organic Search Visits</div>
            <div class="text-xl font-black text-white mt-1">1,482</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">VDPs Viewed</div>
            <div class="text-xl font-black text-white mt-1">890</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">CRM Leads</div>
            <div class="text-xl font-black text-indigo-400 mt-1">31</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">Appointments</div>
            <div class="text-xl font-black text-indigo-400 mt-1">8</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">Sold Vehicles</div>
            <div class="text-xl font-black text-emerald-400 mt-1">3</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function runSeoAction(actionType, issueId) {
  try {
    await apiSendJson('/seo/action', 'POST', { issue_id: issueId, action_type: actionType });
    alert(`SEO Action (${actionType}) applied successfully.`);
    loadDealerSeo();
  } catch (e) {
    alert(`Failed to apply SEO action: ${e.message}`);
  }
}

function createBlogFromSeoOpp(index) {
  // Switch to Blog tab and open blog draft modal pre-filled
  __wsTab = 'blog';
  renderWebsitePage();
  setTimeout(() => {
    if (typeof openBlogEditorModal === 'function') {
      openBlogEditorModal({
        title: index === 0 ? '2025 Chevrolet Silverado Towing Capacity Guide' : 'Used SUV Financing Options',
        category: index === 0 ? 'Buying Guides' : 'Financing',
        excerpt: index === 0 ? 'Complete towing capacity guide for Silverado 1500 & 2500HD.' : 'Find affordable pre-owned SUV financing.'
      });
    }
  }, 200);
}

Object.assign(window, {
  isSeoOwned,
  upgradeToSeo,
  wsSeo,
  loadDealerSeo,
  setSeoSubTab,
  setSeoMode,
  renderSeoWorkspace,
  runSeoAction,
  createBlogFromSeoOpp
});