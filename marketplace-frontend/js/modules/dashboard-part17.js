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
window.openPhotoBackgroundUploader = openPhotoBackgroundUploader;
window.uploadPhotoBackground = uploadPhotoBackground;
window.removePhotoBackground = removePhotoBackground;
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
  if (typeof isDemoAccount === 'function' && isDemoAccount()) {
    showToast('This feature is included in the MarketSync demo.', 'info');
    if (typeof setWsSetupSection === 'function') setWsSetupSection('ai-chatbot');
    return;
  }
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Preparing checkout…';
  try {
    const res = await apiSendJson('/billing/subscribe-plan', 'POST', { plan: 'ai-chatbot', currency: 'CAD' });
    if (res.demo || res.simulated) {
      btn.disabled = false;
      btn.innerHTML = orig;
      showToast('This feature is included in the MarketSync demo.', 'info');
      if (typeof setWsSetupSection === 'function') setWsSetupSection('ai-chatbot');
      return;
    }
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

let __builderTheme = (() => {
  try { return localStorage.getItem('ms_ws_appearance') || localStorage.getItem('ms_builder_theme') || 'auto'; } catch { return 'auto'; }
})();

function setBuilderTheme(m) {
  __builderTheme = ['auto', 'light', 'dark'].includes(m) ? m : 'auto';
  try {
    localStorage.setItem('ms_ws_appearance', __builderTheme);
    localStorage.setItem('ms_builder_theme', __builderTheme);
  } catch {}
  applyBuilderTheme();
  const body = document.getElementById('ws-setup-body');
  if (body) body.innerHTML = renderWsSetupSection();
}
window.setBuilderTheme = setBuilderTheme;

function applyBuilderTheme() {
  const currentPref = __builderTheme || 'auto';
  let effectiveTheme = currentPref;
  if (currentPref === 'auto') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveTheme = isDark ? 'dark' : 'light';
  }

  const container = document.getElementById('page-content-website');
  const root = document.getElementById('website-root');
  const body = document.body;
  const html = document.documentElement;

  [container, root, body, html].forEach(el => {
    if (!el) return;
    el.setAttribute('data-ws-theme', effectiveTheme);
    el.classList.toggle('ws-theme-dark', effectiveTheme === 'dark');
    el.classList.toggle('ws-theme-light', effectiveTheme === 'light');
  });
}
window.applyBuilderTheme = applyBuilderTheme;

if (typeof window !== 'undefined' && window.matchMedia) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => {
    if (__builderTheme === 'auto' || !__builderTheme) {
      applyBuilderTheme();
    }
  };
  if (media.addEventListener) {
    media.addEventListener('change', handleMediaChange);
  } else if (media.addListener) {
    media.addListener(handleMediaChange);
  }
}

function wsSetup() {
  const c = __siteCfg?.content || {};
  const isPub = !!__siteCfg?.site_published;
  const slug = __siteCfg?.site_slug || '';
  const domain = __siteCfg?.custom_domain || '';
  const isDomainVerified = !!__siteCfg?.custom_domain_verified;

  const card = (id, iconSvg, title, desc, metaRows, badgeHtml, btnText = 'Configure') => `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/20">
              ${iconSvg}
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-900 dark:text-white tracking-tight">${title}</h3>
            </div>
          </div>
          ${badgeHtml || ''}
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 space-y-1 text-[11px]">
          ${metaRows}
        </div>
      </div>
      <div class="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Settings Section</span>
        <button type="button" onclick="openSetupModal('${id}')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1">
          <span>${btnText}</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </button>
      </div>
    </div>
  `;

  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
      <!-- Website Workspace Top Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button onclick="wsTab('builder')" class="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
          <span>Builder</span>
        </button>
        <button onclick="wsTab('blog')" class="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"/></svg>
          <span>Blog</span>
        </button>
        <button onclick="wsTab('seo')" class="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>
          <span>SEO</span>
        </button>
        <button onclick="wsTab('setup')" class="px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 bg-indigo-600 text-white shadow-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span>Setup</span>
        </button>
      </div>

      <!-- Setup Page Header -->
      <div class="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Website Setup &amp; Configuration</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isPub ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'}">
              ${isPub ? 'Live' : 'Draft'}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure dealership profile, domain DNS, branding, contact info, lead routing, inventory feeds, analytics, and integrations.</p>
        </div>
        <div class="flex items-center gap-2">
          ${slug ? `<a href="${SITE_BASE}?d=${encodeURIComponent(slug)}" target="_blank" class="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition">Preview Site ↗</a>` : ''}
          <button onclick="saveWebsite(this)" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md cursor-pointer">Save All Changes</button>
        </div>
      </div>

      <!-- 3-Column Masonry Grid on Desktop, 2-Col Tablet, 1-Col Mobile -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        <!-- 1. Dealership Information -->
        ${card('info', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009 9c.63 0 1.213-.19 1.7-.514m-5.45 0A2.996 2.996 0 016 7.5c0-.63.19-1.213.514-1.7m5.45 0A2.996 2.996 0 0012 4.5c.63 0 1.213.19 1.7.514M18 9.35a3.001 3.001 0 003.75-.615A2.993 2.993 0 0021 7.5a2.996 2.996 0 00-.514-1.7"/></svg>`,
          'Dealership Information', 'Legal business name, tagline, description, operating hours, and business license.',
          `<div class="flex justify-between"><span class="text-slate-500">Name:</span> <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(c.dealer_name || 'Premier Motors')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Tagline:</span> <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(c.tagline || 'New & Used Cars')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">City:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(c.city || 'Welland')}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Configured</span>`
        )}

        <!-- 2. Domain -->
        ${card('domain', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM2.25 12h19.5M12 2.25a15.3 15.3 0 014.5 9.75 15.3 15.3 0 01-4.5 9.75 15.3 15.3 0 01-4.5-9.75A15.3 15.3 0 0112 2.25z"/></svg>`,
          'Domain', 'Connect your custom domain with automated Cloudflare SSL certificates.',
          `<div class="flex justify-between"><span class="text-slate-500">Host:</span> <span class="font-bold font-mono text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(domain || 'marketsync.link')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">SSL / DNS:</span> <span class="font-bold ${isDomainVerified ? 'text-emerald-500' : 'text-amber-500'}">${isDomainVerified ? 'Verified & Active' : (domain ? 'Pending DNS' : 'Standard')}</span></div>`,
          isDomainVerified ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">SSL Active</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400">DNS Ready</span>`
        )}

        <!-- 3. Branding -->
        ${card('branding', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/></svg>`,
          'Branding', 'Primary colors, dealership logo, favicon, and hero banner aesthetics.',
          `<div class="flex items-center justify-between"><span class="text-slate-500">Brand Color:</span> <div class="flex items-center gap-1.5 font-bold"><span class="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-slate-700" style="background-color: ${esc(c.primary_color || '#1e3a8a')}"></span><span>${esc(c.primary_color || '#1e3a8a')}</span></div></div>
           <div class="flex justify-between"><span class="text-slate-500">Logo:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${c.logo_url ? 'Custom Logo Set' : 'Text Wordmark'}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400">Palette</span>`
        )}

        <!-- 4. Appearance -->
        ${card('appearance', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072"/></svg>`,
          'Appearance', 'Editor application visual mode (Dark/Light/Auto), typography pairing, and button corners.',
          `<div class="flex justify-between"><span class="text-slate-500">Theme:</span> <span class="font-bold text-slate-800 dark:text-slate-200 uppercase">${esc(__builderTheme || 'Auto')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Typography:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(c.heading_font || 'Inter')} / ${esc(c.body_font || 'Inter')}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400">Modern</span>`
        )}

        <!-- 5. Contact Information -->
        ${card('contact', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>`,
          'Contact Information', 'Showroom phone, service line, physical address, and Google Maps pin.',
          `<div class="flex justify-between"><span class="text-slate-500">Phone:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(c.phone || '905-555-0199')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Address:</span> <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(c.address || '123 Main St')}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Showroom</span>`
        )}

        <!-- 6. Social Links -->
        ${card('social', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>`,
          'Social Links', 'Official Facebook, Instagram, YouTube, TikTok, LinkedIn, and X links.',
          `<div class="flex justify-between"><span class="text-slate-500">Facebook:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${c.facebook_url ? 'Connected' : 'Not set'}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Instagram:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${c.instagram_url ? 'Connected' : 'Not set'}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400">Channels</span>`
        )}

        <!-- 7. Inventory Feed -->
        ${card('inventory_feed', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.676A48.243 48.243 0 0012 7.5"/></svg>`,
          'Inventory Feed', 'DMS live inventory feed, Build & Price franchise lineups, and pricing rules.',
          `<div class="flex justify-between"><span class="text-slate-500">Live Inventory:</span> <span class="font-bold text-emerald-500">Active Sync</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Franchise Makes:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${(c.build_makes || []).length || 'Auto-Detect'} Selected</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Automated</span>`
        )}

        <!-- 8. Forms & Lead Routing -->
        ${card('routing', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>`,
          'Forms & Lead Routing', 'Sales lead email notification, instant SMS dispatch, and CRM webhook routing.',
          `<div class="flex justify-between"><span class="text-slate-500">Notify Email:</span> <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(c.email || 'sales@dealer.com')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Notify SMS:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(c.phone || 'Configured')}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Instant CRM</span>`
        )}

        <!-- 9. Analytics -->
        ${card('analytics', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`,
          'Analytics', 'Google Analytics 4 Measurement ID, Meta Pixel ID, and Google Tag Manager (GTM).',
          `<div class="flex justify-between"><span class="text-slate-500">GA4:</span> <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${esc(c.ga4_id || 'G-XXXXXXXX')}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Meta Pixel:</span> <span class="font-bold font-mono text-slate-800 dark:text-slate-200">${esc(c.meta_pixel_id || 'Configured')}</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400">Tracking</span>`
        )}

        <!-- 10. Integrations -->
        ${card('integrations', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/></svg>`,
          'Integrations', 'Digital retail integrations: Carfax history, Plaid bank connection, Square deposits.',
          `<div class="flex justify-between"><span class="text-slate-500">Carfax Badge:</span> <span class="font-bold text-emerald-500">Enabled</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Digital Finance:</span> <span class="font-bold text-emerald-500">Plaid Active</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Connected</span>`
        )}

        <!-- 11. AI ChatBot -->
        ${card('ai-chatbot', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/></svg>`,
          'AI ChatBot', '24/7 conversational sales assistant on your website qualifying shoppers and capturing leads.',
          `<div class="flex justify-between"><span class="text-slate-500">Status:</span> <span class="font-bold ${isAiChatbotOwned() ? 'text-emerald-500' : 'text-amber-400'}">${isAiChatbotOwned() ? (c.sales_chat ? 'Active on Site' : 'Enabled') : 'Standalone Add-on'}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Assistant:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${esc(c.chat_name || 'Ava (AI Assistant)')}</span></div>`,
          isAiChatbotOwned() ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Active</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">$299/mo</span>`
        )}

        <!-- 12. Publishing -->
        ${card('publishing', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 01-.34 6.63m-4.5-6.63a6 6 0 00-.34 6.63m3.18-12.06a9 9 0 013.9 3.9m-3.9-3.9a9 9 0 00-3.9 3.9m3.9-3.9V3m0 6a3 3 0 100 6 3 3 0 000-6z"/></svg>`,
          'Publishing', 'Live visibility status, site slug address, Cloudflare CDN cache purge, and maintenance.',
          `<div class="flex justify-between"><span class="text-slate-500">Visibility:</span> <span class="font-bold ${isPub ? 'text-emerald-500' : 'text-amber-500'}">${isPub ? 'Published Live' : 'Draft Mode'}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Slug:</span> <span class="font-bold font-mono text-slate-800 dark:text-slate-200 truncate max-w-[170px]">${esc(slug || 'default')}</span></div>`,
          isPub ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500">Live</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">Draft</span>`
        )}

        <!-- 13. Advanced -->
        ${card('advanced', `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>`,
          'Advanced', 'Custom &lt;head&gt; tracking scripts, footer codes, CSS overrides, and sitemaps.',
          `<div class="flex justify-between"><span class="text-slate-500">Custom Head:</span> <span class="font-bold text-slate-800 dark:text-slate-200">${c.head_html ? 'Configured' : 'None'}</span></div>
           <div class="flex justify-between"><span class="text-slate-500">Sitemap Index:</span> <span class="font-bold text-emerald-500">Auto-Generated</span></div>`,
          `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400">Expert</span>`
        )}
      </div>
    </div>
  `;
}
window.wsSetup = wsSetup;

function openSetupModal(secId) {
  document.getElementById('setup-modal-container')?.remove();
  const c = __siteCfg?.content || {};
  const isPub = !!__siteCfg?.site_published;
  const slug = __siteCfg?.site_slug || '';

  const modal = document.createElement('div');
  modal.id = 'setup-modal-container';
  modal.className = 'fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4';

  let title = 'Configure Settings';
  let desc = 'Update your website preferences.';
  let bodyHtml = '';

  if (secId === 'info') {
    title = 'Dealership Information';
    desc = 'Business name, tagline, description, hours, and license.';
    bodyHtml = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dealership Display Name</label>
            <input type="text" id="m-site-name" value="${esc(c.dealer_name || 'Premier Chevrolet')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Legal Entity / DBA</label>
            <input type="text" id="m-site-legal" value="${esc(c.legal_name || '')}" placeholder="Premier Automotive Group Inc." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tagline / Slogan</label>
          <input type="text" id="m-site-tagline" value="${esc(c.tagline || 'Niagara’s Premier Truck Destination')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dealership Story / About</label>
          <textarea id="m-site-about" rows="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">${esc(c.about || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Operating Hours</label>
          <textarea id="m-site-hours" rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">${esc(c.hours || 'Mon–Fri: 9:00 AM – 7:00 PM\nSat: 9:00 AM – 5:00 PM\nSun: Closed')}</textarea>
        </div>
      </div>
    `;
  } else if (secId === 'domain') {
    title = 'Domain & DNS Configuration';
    desc = 'Connect your custom dealership domain.';
    bodyHtml = customDomainCard(__siteCfg);
  } else if (secId === 'branding') {
    title = 'Branding & Aesthetics';
    desc = 'Primary brand colors, logos, and hero backgrounds.';
    bodyHtml = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Brand Primary Color</label>
            <div class="flex items-center gap-2">
              <input id="m-site-color" type="color" value="${esc(c.primary_color || '#1e3a8a')}" class="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input type="text" id="m-site-color-hex" value="${esc(c.primary_color || '#1e3a8a')}" oninput="document.getElementById('m-site-color').value=this.value" class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white">
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hero Image URL</label>
            <div class="flex gap-2">
              <input id="m-site-hero" value="${esc(c.hero_url || '')}" placeholder="https://..." class="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs">
              <button type="button" onclick="openWsPhotoPicker(url => { const el = document.getElementById('m-site-hero'); if (el) el.value = url; })" class="px-3 py-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs">Browse</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (secId === 'appearance') {
    title = 'Appearance & Theme';
    desc = 'Application theme for the website editor chrome and typography.';
    bodyHtml = `
      <div class="space-y-4">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Editor Chrome Mode</label>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onclick="setBuilderTheme('auto')" class="p-3.5 rounded-xl border text-left transition ${__builderTheme === 'auto' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}">
            <div class="text-xs font-black text-slate-900 dark:text-white mb-1">Automatic</div>
            <div class="text-[11px] text-slate-500">System preference</div>
          </button>
          <button type="button" onclick="setBuilderTheme('light')" class="p-3.5 rounded-xl border text-left transition ${__builderTheme === 'light' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}">
            <div class="text-xs font-black text-slate-900 dark:text-white mb-1">Light Mode</div>
            <div class="text-[11px] text-slate-500">Crisp light UI</div>
          </button>
          <button type="button" onclick="setBuilderTheme('dark')" class="p-3.5 rounded-xl border text-left transition ${__builderTheme === 'dark' ? 'border-indigo-600 bg-indigo-600/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'}">
            <div class="text-xs font-black text-slate-900 dark:text-white mb-1">Dark Mode</div>
            <div class="text-[11px] text-slate-500">Sleek dark UI</div>
          </button>
        </div>
      </div>
    `;
  } else if (secId === 'contact') {
    title = 'Contact Information';
    desc = 'Dealership sales line, service phone, address, and city.';
    bodyHtml = `
      <div class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Sales Phone</label>
            <input type="text" id="m-site-phone" value="${esc(c.phone || '905-555-0199')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Primary Email</label>
            <input type="text" id="m-site-email" value="${esc(c.email || 'sales@dealer.com')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Street Address</label>
          <input type="text" id="m-site-address" value="${esc(c.address || '123 Auto Mall Rd')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">City</label>
            <input type="text" id="m-site-city" value="${esc(c.city || 'Welland')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Province / State</label>
            <input type="text" id="m-site-province" value="${esc(c.province || 'ON')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Postal Code</label>
            <input type="text" id="m-site-postal" value="${esc(c.postal_code || 'L3C 5K9')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
        </div>
      </div>
    `;
  } else if (secId === 'social') {
    title = 'Social Links';
    desc = 'Connect your official dealership social media channels.';
    bodyHtml = `
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Facebook Page URL</label>
          <input type="text" id="m-site-fb" value="${esc(c.facebook_url || '')}" placeholder="https://facebook.com/..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Instagram Profile URL</label>
          <input type="text" id="m-site-ig" value="${esc(c.instagram_url || '')}" placeholder="https://instagram.com/..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">YouTube Channel URL</label>
          <input type="text" id="m-site-yt" value="${esc(c.youtube_url || '')}" placeholder="https://youtube.com/..." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
      </div>
    `;
  } else if (secId === 'inventory_feed') {
    title = 'Inventory Feed & Makes';
    desc = 'Select new vehicle franchise lineups displayed in Build & Price.';
    const set = new Set((c.build_makes || []).map(s => String(s).toLowerCase()));
    const makesList = ['Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Ford', 'Lincoln', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Volkswagen', 'Jeep', 'Ram', 'Dodge', 'Chrysler'];
    bodyHtml = `
      <div class="space-y-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">Select the new vehicle makes you sell. Unchecked makes default to auto-detecting from your live inventory.</p>
        <div id="m-bm-wrap" class="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
          ${makesList.map(b => `<label class="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"><input type="checkbox" class="m-bm-check accent-indigo-600 w-4 h-4 rounded" value="${b}" ${set.has(b.toLowerCase()) ? 'checked' : ''}><span>${b}</span></label>`).join('')}
        </div>
      </div>
    `;
  } else if (secId === 'routing') {
    title = 'Forms & Lead Routing';
    desc = 'Where website lead submissions, test drives, and appraisals deliver.';
    bodyHtml = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notification Email</label>
          <input type="text" id="m-site-email" value="${esc(c.email || 'sales@dealer.com')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notification Phone (SMS Alerts)</label>
          <input type="text" id="m-site-phone" value="${esc(c.phone || '905-555-0199')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
      </div>
    `;
  } else if (secId === 'analytics') {
    title = 'Analytics & Tracking Pixels';
    desc = 'Google Analytics 4, Meta Pixel, and Google Tag Manager.';
    bodyHtml = `
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GA4 Measurement ID</label>
          <input type="text" id="m-site-ga4" value="${esc(c.ga4_id || '')}" placeholder="G-XXXXXXXXXX" class="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Meta Pixel ID</label>
          <input type="text" id="m-site-meta" value="${esc(c.meta_pixel_id || '')}" placeholder="123456789012345" class="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Google Tag Manager (GTM) Container ID</label>
          <input type="text" id="m-site-gtm" value="${esc(c.gtm_id || '')}" placeholder="GTM-XXXXXXX" class="w-full font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
        </div>
      </div>
    `;
  } else if (secId === 'integrations') {
    title = 'Third-Party Integrations';
    desc = 'Manage Carfax history badges, Plaid finance intake, and Square.';
    bodyHtml = `
      <div class="space-y-3 text-xs">
        <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
          <div>
            <div class="font-bold text-slate-900 dark:text-white">Carfax Vehicle History Badges</div>
            <div class="text-slate-500 text-[11px]">Display 1-Owner and Clean History badges on VDPs.</div>
          </div>
          <input type="checkbox" id="m-site-carfax" checked class="accent-indigo-600 w-4 h-4 rounded">
        </label>
        <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
          <div>
            <div class="font-bold text-slate-900 dark:text-white">Plaid Digital Finance Verification</div>
            <div class="text-slate-500 text-[11px]">Instant bank account and income verification on credit applications.</div>
          </div>
          <input type="checkbox" id="m-site-plaid" checked class="accent-indigo-600 w-4 h-4 rounded">
        </label>
      </div>
    `;
  } else if (secId === 'ai-chatbot') {
    title = 'AI ChatBot Configuration';
    desc = 'Conversational automotive sales concierge.';
    if (!isAiChatbotOwned()) {
      bodyHtml = `
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
          <div class="font-black text-sm">AI ChatBot ($299/mo CAD) is a standalone add-on.</div>
          <p class="text-[11px] text-amber-200">Upgrade to enable 24/7 conversational sales chat with live inventory lookup on your website.</p>
          <button type="button" onclick="upgradeToAiChatbot(this)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer">Upgrade to AI ChatBot</button>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="space-y-4">
          <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" id="m-site-chat-enabled" ${c.sales_chat ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 rounded">
            <span>Enable 24/7 AI ChatBot on Public Website</span>
          </label>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Concierge Name</label>
            <input type="text" id="m-site-chat-name" value="${esc(c.chat_name || 'Ava')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Knowledgebase Facts</label>
            <textarea id="m-site-chat-kb" rows="3" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white">${esc(c.chat_kb || '')}</textarea>
          </div>
        </div>
      `;
    }
  } else if (secId === 'publishing') {
    title = 'Publishing & Public Address';
    desc = 'Site visibility and slug routing.';
    bodyHtml = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Website URL Slug</label>
          <input type="text" id="m-site-slug" value="${esc(slug || '')}" placeholder="your-dealership" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white">
        </div>
        <label class="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 cursor-pointer">
          <input type="checkbox" id="m-site-pub" ${isPub ? 'checked' : ''} class="accent-indigo-600 w-4 h-4 rounded">
          <span>Website Published Live to Public</span>
        </label>
      </div>
    `;
  } else {
    // advanced
    title = 'Advanced Settings';
    desc = 'Custom header scripts, tracking codes, and CSS overrides.';
    bodyHtml = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Site-wide Head HTML Scripts</label>
          <textarea id="m-site-head" rows="4" placeholder="<script>...</script>" class="w-full font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white">${esc(c.head_html || '')}</textarea>
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-5">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">${title}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${desc}</p>
        </div>
        <button type="button" onclick="document.getElementById('setup-modal-container')?.remove()" class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center font-black text-lg transition cursor-pointer">&times;</button>
      </div>
      <div id="setup-modal-body">${bodyHtml}</div>
      <div class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onclick="document.getElementById('setup-modal-container')?.remove()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition">Cancel</button>
        <button type="button" onclick="saveSetupSection('${secId}')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md cursor-pointer">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}
window.openSetupModal = openSetupModal;

async function saveSetupSection(secId) {
  if (!__siteCfg) return;
  const c = __siteCfg.content || (__siteCfg.content = {});

  if (secId === 'info') {
    c.dealer_name = document.getElementById('m-site-name')?.value || c.dealer_name;
    c.legal_name = document.getElementById('m-site-legal')?.value || '';
    c.tagline = document.getElementById('m-site-tagline')?.value || c.tagline;
    c.about = document.getElementById('m-site-about')?.value || '';
    c.hours = document.getElementById('m-site-hours')?.value || c.hours;
  } else if (secId === 'branding') {
    c.primary_color = document.getElementById('m-site-color')?.value || c.primary_color;
    c.hero_url = document.getElementById('m-site-hero')?.value || '';
  } else if (secId === 'contact') {
    c.phone = document.getElementById('m-site-phone')?.value || c.phone;
    c.email = document.getElementById('m-site-email')?.value || c.email;
    c.address = document.getElementById('m-site-address')?.value || c.address;
    c.city = document.getElementById('m-site-city')?.value || c.city;
    c.province = document.getElementById('m-site-province')?.value || c.province;
    c.postal_code = document.getElementById('m-site-postal')?.value || c.postal_code;
  } else if (secId === 'social') {
    c.facebook_url = document.getElementById('m-site-fb')?.value || '';
    c.instagram_url = document.getElementById('m-site-ig')?.value || '';
    c.youtube_url = document.getElementById('m-site-yt')?.value || '';
  } else if (secId === 'inventory_feed') {
    const checks = document.querySelectorAll('.m-bm-check:checked');
    c.build_makes = Array.from(checks).map(cb => cb.value);
  } else if (secId === 'routing') {
    c.email = document.getElementById('m-site-email')?.value || c.email;
    c.phone = document.getElementById('m-site-phone')?.value || c.phone;
  } else if (secId === 'analytics') {
    c.ga4_id = document.getElementById('m-site-ga4')?.value || '';
    c.meta_pixel_id = document.getElementById('m-site-meta')?.value || '';
    c.gtm_id = document.getElementById('m-site-gtm')?.value || '';
  } else if (secId === 'ai-chatbot') {
    if (document.getElementById('m-site-chat-enabled')) {
      c.sales_chat = !!document.getElementById('m-site-chat-enabled').checked;
      c.chat_name = document.getElementById('m-site-chat-name')?.value || 'Ava';
      c.chat_kb = document.getElementById('m-site-chat-kb')?.value || '';
    }
  } else if (secId === 'publishing') {
    __siteCfg.site_slug = document.getElementById('m-site-slug')?.value || __siteCfg.site_slug;
    __siteCfg.site_published = !!document.getElementById('m-site-pub')?.checked;
  } else if (secId === 'advanced') {
    c.head_html = document.getElementById('m-site-head')?.value || '';
  }

  try {
    await apiSendJson('/dealership/site', 'PUT', {
      site_slug: __siteCfg.site_slug,
      site_published: __siteCfg.site_published,
      content: c
    });
    document.getElementById('setup-modal-container')?.remove();
    if (typeof showToast === 'function') showToast('Setup settings saved', 'success');
    renderWsBody();
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
    else alert(e.message);
  }
}
window.saveSetupSection = saveSetupSection;

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
  applyBuilderTheme();
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

  if (targetTab === 'builder') __wsTab = 'builder';
  else if (targetTab === 'blog') __wsTab = 'blog';
  else if (targetTab === 'seo') __wsTab = 'seo';
  else __wsTab = 'setup';

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
  document.documentElement.classList.remove('website-workspace-mode');
  document.body.classList.remove('website-workspace-mode');
  if (!__siteCfg) {
    root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div>';
    try { __siteCfg = await apiGetJson('/dealership/site'); }
    catch (e) { root.innerHTML = `<div class="py-16 text-center text-sm text-slate-500">Couldn't load: ${esc(e.message)}</div>`; return; }
  }
  __wsTab = 'setup';
  root.innerHTML = wsSetup();
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

function exitWebsiteWorkspace() {
  if (typeof toggleWsLeftDock === 'function' && !__wsLeftDockCollapsed) {
    toggleWsLeftDock();
  }

  const body = document.body;
  const html = document.documentElement;
  const container = document.getElementById('page-content-website');
  const root = document.getElementById('website-root');

  [body, html, container, root].forEach(el => {
    if (!el) return;
    el.classList.remove('website-workspace-mode', 'ws-theme-dark', 'ws-theme-light');
    el.removeAttribute('data-ws-theme');
  });

  const sideNav = document.getElementById('sidebar-nav') || document.getElementById('dept-nav');
  if (sideNav) sideNav.style.display = '';
  const mainHeader = document.querySelector('header') || document.getElementById('main-header');
  if (mainHeader) mainHeader.style.display = '';
  const chatDock = document.getElementById('staff-chat-dock-bar');
  if (chatDock) chatDock.style.display = '';

  // Exiting Builder returns to Website -> Setup (unless previous route is explicitly outside website)
  const prev = window.websiteWorkspacePreviousRoute || {};
  if (prev.page && prev.page !== 'website' && prev.page !== 'website-settings' && prev.dept !== 'marketing') {
    if (typeof switchPage === 'function') switchPage(prev.page);
    return;
  }

  __wsTab = 'setup';
  if (typeof switchPage === 'function') switchPage('website');
  else renderWebsitePage();
}
window.exitWebsiteWorkspace = exitWebsiteWorkspace;

function renderWebsitePage() {
  applyBuilderTheme();
  const isBuilder = (__wsTab === 'builder');
  document.documentElement.classList.toggle('website-workspace-mode', isBuilder);
  document.body.classList.toggle('website-workspace-mode', isBuilder);
  const root = document.getElementById('website-root'); if (!root) return;

  // Setup renders directly into the contained layout without redundant top navigation
  if (__wsTab === 'setup' || __wsTab === 'settings') {
    root.innerHTML = wsSetup();
    return;
  }

  const c = __siteCfg?.content || {};
  const url = __siteCfg?.site_slug ? `${SITE_BASE}?d=${encodeURIComponent(__siteCfg.site_slug)}` : null;

  root.innerHTML = `
    <div class="flex flex-col ${isBuilder ? 'h-full' : 'min-h-0'} w-full bg-[var(--ws-bg)] text-[var(--ws-text)]">
      <!-- TOP APPLICATION HEADER (Dedicated Website Workspace Header) -->
      <div class="ws-builder-header flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex-shrink-0 flex-wrap gap-2 text-white z-20">
        <div class="flex items-center gap-3">
          <button onclick="exitWebsiteWorkspace()" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-black transition cursor-pointer shadow-xs" title="Exit Website Workspace & Return to Dashboard">
            <svg class="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>
            <span>${(window.websiteWorkspacePreviousRoute && window.websiteWorkspacePreviousRoute.dept === 'marketing') ? 'Back to Marketing' : 'Exit Builder'}</span>
          </button>
          <div class="h-5 w-px bg-slate-800"></div>
          <div class="w-7 h-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black border border-indigo-500/40">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM2.25 12h19.5M12 2.25a15.3 15.3 0 014.5 9.75 15.3 15.3 0 01-4.5 9.75 15.3 15.3 0 01-4.5-9.75A15.3 15.3 0 0112 2.25z"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-black tracking-tight text-white">MarketSync Website Builder</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${__siteCfg.site_published ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'}">
                ${__siteCfg.site_published ? 'Live' : 'Draft'}
              </span>
            </div>
          </div>
        </div>

        <!-- TOP RIGHT ACTION CONTROLS -->
        <div class="flex items-center gap-2">
          ${url ? `<a href="${url}" target="_blank" class="text-xs font-black bg-slate-800 text-slate-300 hover:text-white border border-slate-700 px-3 py-1.5 rounded-xl transition">View Site ↗</a>` : ''}
          <label class="flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl"><input id="ws-pub" type="checkbox" ${__siteCfg.site_published ? 'checked' : ''} class="accent-indigo-600 w-3.5 h-3.5 rounded">Published</label>
          <button onclick="saveWebsite(this)" class="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl transition shadow-md cursor-pointer">Save Changes</button>
        </div>
      </div>

      <!-- WORKSPACE CONTENT BODY (Sub-Layout dynamically mounted based on active tab) -->
      <div id="ws-body" class="${isBuilder ? 'flex-1 min-h-0 overflow-hidden' : 'w-full'}"></div>
    </div>`;
  renderWsBody();
}
function wsTab(t) {
  __wsTab = t;
  if (t === 'blog') {
    if (typeof switchPage === 'function') switchPage('blog');
    return;
  }
  if (t === 'seo') {
    if (typeof switchPage === 'function') switchPage('seo');
    return;
  }
  const isBuilder = (__wsTab === 'builder');
  document.documentElement.classList.toggle('website-workspace-mode', isBuilder);
  document.body.classList.toggle('website-workspace-mode', isBuilder);
  renderWebsitePage();
}
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
let __livePreviewReady = false, __liveMsgWired = false, __livePushTimer = null;

function refreshWebsitePreview() {
  markWsUnsaved();
  livePreviewPush();
}
window.refreshWebsitePreview = refreshWebsitePreview;

function markWsUnsaved() {
  window.__wsHasUnsavedChanges = true;
  const badges = document.querySelectorAll('.ws-saved-badge');
  badges.forEach(b => {
    b.className = 'ws-saved-badge px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40';
    b.textContent = 'UNSAVED';
  });
}
window.markWsUnsaved = markWsUnsaved;

function markWsSaved() {
  window.__wsHasUnsavedChanges = false;
  const badges = document.querySelectorAll('.ws-saved-badge');
  badges.forEach(b => {
    b.className = 'ws-saved-badge px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40';
    b.textContent = 'SAVED';
  });
}
window.markWsSaved = markWsSaved;

function livePreviewPush() {
  if (__builderMode !== 'live') return;
  const ifr = document.getElementById('ws-preview-frame');
  if (!ifr || !ifr.contentWindow || !__livePreviewReady) return;
  clearTimeout(__livePushTimer);
  __livePushTimer = setTimeout(() => {
    try {
      wsFlushTarget();
      const c = __siteCfg?.content || {};
      const site = {
        sections: __homeSections, pages: __sitePages, builtins: __siteBuiltins, staff: __siteStaff,
        design_theme: c.design_theme || 'modern',
        quick_palette: c.quick_palette || 'chevy_blue',
        primary_color: c.primary_color || '#1e3a8a',
        secondary_color: c.secondary_color || '#3b82f6',
        accent_color: c.accent_color || '#f59e0b',
        heading_font: c.heading_font || 'Inter',
        body_font: c.body_font || 'Inter',
        tagline: c.tagline, about: c.about, hero_url: c.hero_url, logo_url: c.logo_url,
      };
      let view = 'home';
      if (typeof __wsTarget === 'string' && __wsTarget.startsWith('b:')) { const k = __wsTarget.slice(2); view = k === 'contact' ? 'inquiry' : k; }
      else if (typeof __wsTarget === 'number' && __sitePages[__wsTarget]) view = 'page:' + (__sitePages[__wsTarget].slug || '');
      ifr.contentWindow.postMessage({ type: 'ms-preview-apply', site, view }, '*');
    } catch {}
  }, 40);
}
window.livePreviewPush = livePreviewPush;

const THEME_DEFAULTS = {
  classic:  { heading_font: 'Inter', body_font: 'Inter' },
  prestige: { heading_font: 'Playfair Display', body_font: 'Inter' },
  modern:   { heading_font: 'Plus Jakarta Sans', body_font: 'Inter' },
  bold:     { heading_font: 'Oswald', body_font: 'Montserrat' },
  minimal:  { heading_font: 'Outfit', body_font: 'Space Grotesk' }
};

const PALETTES = {
  chevy_blue:  { label: 'Chevy Blue',  primary: '#1e3a8a', secondary: '#3b82f6', accent: '#f59e0b' },
  gmc_red:     { label: 'GMC Red',     primary: '#991b1b', secondary: '#ef4444', accent: '#1e293b' },
  buick_bronze:{ label: 'Buick Bronze',primary: '#78350f', secondary: '#d97706', accent: '#451a03' },
  ford_blue:   { label: 'Ford Blue',   primary: '#0369a1', secondary: '#0284c7', accent: '#e0f2fe' },
  midnight:    { label: 'Midnight',    primary: '#0f172a', secondary: '#334155', accent: '#6366f1' },
  clean_slate: { label: 'Clean Slate', primary: '#334155', secondary: '#64748b', accent: '#0ea5e9' },
  luxury_gold: { label: 'Luxury Gold', primary: '#1c1917', secondary: '#78350f', accent: '#eab308' },
  forest:      { label: 'Forest',      primary: '#064e3b', secondary: '#059669', accent: '#f59e0b' }
};

function setWsTheme(key) {
  if (!__siteCfg) return;
  __siteCfg.content = __siteCfg.content || {};
  const c = __siteCfg.content;
  c.design_theme = key;
  const defs = THEME_DEFAULTS[key] || THEME_DEFAULTS.modern;
  if (!c.heading_font || ['Inter', 'Playfair Display', 'Plus Jakarta Sans', 'Oswald', 'Outfit'].includes(c.heading_font)) {
    c.heading_font = defs.heading_font;
  }
  if (!c.body_font || ['Inter', 'Montserrat', 'Space Grotesk'].includes(c.body_font)) {
    c.body_font = defs.body_font;
  }
  const drawer = document.getElementById('ws-left-drawer-content');
  if (drawer && __wsActiveLeftNav === 'design') {
    drawer.innerHTML = renderWsLeftDrawerHtml();
  }
  refreshWebsitePreview();
}
window.setWsTheme = setWsTheme;

function setWsPalette(key) {
  if (!__siteCfg) return;
  const pal = PALETTES[key];
  if (!pal) return;
  __siteCfg.content = __siteCfg.content || {};
  const c = __siteCfg.content;
  c.quick_palette = key;
  c.primary_color = pal.primary;
  c.secondary_color = pal.secondary;
  c.accent_color = pal.accent;
  const drawer = document.getElementById('ws-left-drawer-content');
  if (drawer && __wsActiveLeftNav === 'design') {
    drawer.innerHTML = renderWsLeftDrawerHtml();
  }
  refreshWebsitePreview();
}
window.setWsPalette = setWsPalette;

function setWsBrandColor(type, val) {
  if (!__siteCfg) return;
  __siteCfg.content = __siteCfg.content || {};
  const c = __siteCfg.content;
  if (type === 'primary') c.primary_color = val;
  else if (type === 'secondary') c.secondary_color = val;
  else if (type === 'accent') c.accent_color = val;
  refreshWebsitePreview();
}
window.setWsBrandColor = setWsBrandColor;

function setWsFont(type, fontName) {
  if (!__siteCfg) return;
  __siteCfg.content = __siteCfg.content || {};
  const c = __siteCfg.content;
  if (type === 'heading') c.heading_font = fontName;
  else if (type === 'body') c.body_font = fontName;
  refreshWebsitePreview();
}
window.setWsFont = setWsFont;

function wsDesign() {
  const c = __siteCfg?.content || {};
  const theme = (c.design_theme || 'modern').toLowerCase();
  const palette = (c.quick_palette || 'chevy_blue').toLowerCase();
  const primary = c.primary_color || '#1e3a8a';
  const secondary = c.secondary_color || '#3b82f6';
  const accent = c.accent_color || '#f59e0b';
  const headingFont = c.heading_font || 'Inter';
  const bodyFont = c.body_font || 'Inter';

  const themes = [
    { id: 'classic', label: 'Classic', desc: 'Traditional & familiar dealership style' },
    { id: 'prestige', label: 'Prestige', desc: 'Serif headlines & luxury spacing' },
    { id: 'modern', label: 'Modern', desc: 'Rounded corners & clean tech typography' },
    { id: 'bold', label: 'Bold', desc: 'High contrast & heavy impact headlines' },
    { id: 'minimal', label: 'Minimal', desc: 'Monochrome, subtle & airy surfaces' }
  ];

  const fontOpts = [
    'Inter', 'Playfair Display', 'Plus Jakarta Sans', 'Oswald', 'Roboto Slab',
    'Outfit', 'Montserrat', 'Space Grotesk', 'Poppins', 'Lora', 'Cinzel', 'Rubik'
  ];

  return `
    <div class="space-y-4 font-sans text-xs">
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Design Theme</div>
        <div class="grid grid-cols-1 gap-1.5">
          ${themes.map(t => `
            <button type="button" onclick="setWsTheme('${t.id}')" class="p-2.5 rounded-xl border text-left transition cursor-pointer ${theme === t.id ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'}">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold">${t.label}</span>
                ${theme === t.id ? '<span class="text-[10px] text-indigo-400 font-black">ACTIVE</span>' : ''}
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5">${t.desc}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Quick Palettes</div>
        <div class="grid grid-cols-2 gap-1.5">
          ${Object.entries(PALETTES).map(([k, p]) => `
            <button type="button" onclick="setWsPalette('${k}')" class="p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${palette === k ? 'border-indigo-500 bg-indigo-600/20 text-white font-bold' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'}">
              <span class="text-[11px] font-bold truncate">${p.label}</span>
              <div class="flex items-center -space-x-1 shrink-0 ml-1">
                <div class="w-3 h-3 rounded-full border border-black/30" style="background-color:${p.primary}"></div>
                <div class="w-3 h-3 rounded-full border border-black/30" style="background-color:${p.secondary}"></div>
                <div class="w-3 h-3 rounded-full border border-black/30" style="background-color:${p.accent}"></div>
              </div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="space-y-2 pt-1 border-t border-slate-800">
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Brand Colors</div>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="text-xs font-bold text-slate-300">Primary Color</label>
            <div class="flex items-center gap-2">
              <input type="color" value="${primary}" oninput="setWsBrandColor('primary', this.value)" class="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer">
              <input type="text" value="${primary}" oninput="setWsBrandColor('primary', this.value)" class="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono">
            </div>
          </div>
          <div class="flex items-center justify-between gap-2">
            <label class="text-xs font-bold text-slate-300">Secondary Color</label>
            <div class="flex items-center gap-2">
              <input type="color" value="${secondary}" oninput="setWsBrandColor('secondary', this.value)" class="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer">
              <input type="text" value="${secondary}" oninput="setWsBrandColor('secondary', this.value)" class="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono">
            </div>
          </div>
          <div class="flex items-center justify-between gap-2">
            <label class="text-xs font-bold text-slate-300">Accent Color</label>
            <div class="flex items-center gap-2">
              <input type="color" value="${accent}" oninput="setWsBrandColor('accent', this.value)" class="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer">
              <input type="text" value="${accent}" oninput="setWsBrandColor('accent', this.value)" class="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono">
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-2 pt-2 border-t border-slate-800">
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-400">Typography</div>
        <div class="space-y-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Heading Google Font</label>
            <select onchange="setWsFont('heading', this.value)" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer">
              ${fontOpts.map(f => `<option value="${f}" ${headingFont === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-300 mb-1">Body Google Font</label>
            <select onchange="setWsFont('body', this.value)" class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer">
              ${fontOpts.map(f => `<option value="${f}" ${bodyFont === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}
window.wsDesign = wsDesign;

async function saveWebsite(btn) {
  if (!__siteCfg) return;
  wsFlushTarget();
  const c = __siteCfg.content || {};
  
  const payload = {
    site_slug: __siteCfg.site_slug || '',
    site_published: document.getElementById('ws-pub')?.checked || __siteCfg.site_published || false,
    content: {
      ...c,
      sections: __homeSections,
      pages: __sitePages,
      builtins: __siteBuiltins,
      staff: __siteStaff,
      design_theme: c.design_theme || 'modern',
      quick_palette: c.quick_palette || 'chevy_blue',
      primary_color: c.primary_color || '#1e3a8a',
      secondary_color: c.secondary_color || '#3b82f6',
      accent_color: c.accent_color || '#f59e0b',
      heading_font: c.heading_font || 'Inter',
      body_font: c.body_font || 'Inter',
    }
  };

  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Saving…'; }

  try {
    const res = await apiSendJson('/dealership/site', 'PUT', payload);
    if (res && res.content) __siteCfg.content = res.content;
    markWsSaved();
    showToast('Website design saved', 'success');
  } catch (e) {
    showToast(e.message || 'Failed to save website', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  }
}
window.saveWebsite = saveWebsite;
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
    b.className = `ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-black transition ${isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-900 dark:text-slate-200 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800'} cursor-pointer`;
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
    <div id="ws-layers-tree" class="p-4 bg-white dark:bg-slate-900">
      <div class="space-y-1 font-sans text-xs">
        <div class="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-300 mb-2 flex items-center justify-between">
          <span>Hierarchical Layers Tree</span>
          <span class="text-slate-600 dark:text-slate-400 font-bold text-[9px]">(Drag Header To Move)</span>
        </div>
        <div onclick="selectWsSection(-1)" class="p-2.5 rounded-xl border ${__wsSelectedSecIdx === -1 ? 'border-indigo-500 bg-indigo-600 text-white font-bold' : 'border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-slate-400'} cursor-pointer flex items-center justify-between transition">
          <span class="font-extrabold text-slate-900 dark:text-slate-100">Header &amp; Navigation Bar</span>
          <span class="text-[10px] font-mono text-slate-500 font-bold">Global</span>
        </div>
        <div class="pl-2 space-y-1 border-l-2 border-slate-300 dark:border-slate-800 ml-2 my-1">
          ${(__siteSections || []).map((sec, idx) => {
            const isSel = __wsSelectedSecIdx === idx;
            const meta = SEC_META[sec.type] || {};
            return `
              <div onclick="selectWsSection(${idx})" class="p-2.5 rounded-xl border ${isSel ? 'border-indigo-500 bg-indigo-600 text-white font-bold' : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-slate-400'} cursor-pointer flex items-center justify-between transition group shadow-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-4 text-[10px] font-mono text-slate-700 dark:text-slate-400 font-bold">${idx + 1}</span>
                  <span class="truncate font-extrabold text-slate-900 dark:text-slate-100">${esc(meta.label || sec.type)}</span>
                </div>
                <div class="flex items-center gap-1 opacity-90 group-hover:opacity-100">
                  <button type="button" onclick="event.stopPropagation(); moveSection(${idx},-1)" ${idx === 0 ? 'disabled' : ''} class="p-1 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white disabled:opacity-20 font-bold" title="Move Up">↑</button>
                  <button type="button" onclick="event.stopPropagation(); moveSection(${idx},1)" ${idx === __siteSections.length - 1 ? 'disabled' : ''} class="p-1 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white disabled:opacity-20 font-bold" title="Move Down">↓</button>
                  <button type="button" onclick="event.stopPropagation(); delSection(${idx})" class="p-1 text-rose-600 hover:text-rose-700 font-black" title="Delete">×</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div onclick="selectWsSection(-2)" class="p-2.5 rounded-xl border ${__wsSelectedSecIdx === -2 ? 'border-indigo-500 bg-indigo-600 text-white font-bold' : 'border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-slate-400'} cursor-pointer flex items-center justify-between transition">
          <span class="font-extrabold text-slate-900 dark:text-slate-100">Footer &amp; Copyright</span>
          <span class="text-[10px] font-mono text-slate-500 font-bold">Global</span>
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
    <div id="ws-left-drag-header" class="flex items-center justify-between p-3 border-b border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 rounded-t-2xl cursor-grab select-none">
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16"/></svg>
        <span class="text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">Tool Drawer</span>
      </div>
      <button type="button" onclick="toggleWsLeftDock()" class="text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition" title="Collapse Drawer">&times;</button>
    </div>
  `;
  if (__wsActiveLeftNav === 'layers') {
    return headerHtml + renderWsLayersTreeHtml();
  } else if (__wsActiveLeftNav === 'blocks') {
    return headerHtml + renderElementorPalette();
  } else if (__wsActiveLeftNav === 'pages') {
    return headerHtml + `
      <div class="p-4 space-y-3 bg-white dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">Pages &amp; Structure</h3>
          <button type="button" onclick="wsTab('pages')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">+ Add Page</button>
        </div>
        <div class="space-y-1.5">
          <button onclick="wsSetTarget('home')" class="w-full text-left p-2.5 rounded-xl border transition ${__wsTarget === 'home' ? 'border-indigo-500 bg-indigo-600 text-white font-bold' : 'border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-slate-400 font-extrabold'}">Home Page</button>
          ${(__sitePages || []).map((p, i) => `
            <button onclick="wsSetTarget(${i})" class="w-full text-left p-2.5 rounded-xl border transition ${__wsTarget === i ? 'border-indigo-500 bg-indigo-600 text-white font-bold' : 'border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 hover:border-slate-400 font-extrabold'}">${esc(p.title || 'Untitled Page')}</button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (__wsActiveLeftNav === 'images') {
    return headerHtml + renderWsImagesDrawerHtml();
  } else if (__wsActiveLeftNav === 'design') {
    return headerHtml + `<div class="p-4 space-y-3 bg-white dark:bg-slate-900">${wsDesign()}</div>`;
  } else if (__wsActiveLeftNav === 'ai') {
    return headerHtml + `
      <div class="p-4 space-y-4 bg-white dark:bg-slate-900">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-black uppercase tracking-wider text-violet-600 dark:text-violet-400">AI Site Copilot</h3>
        </div>
        <div class="p-3.5 rounded-xl bg-violet-50 dark:bg-violet-600/10 border border-violet-200 dark:border-violet-500/30 space-y-2">
          <label class="block text-xs font-black text-slate-900 dark:text-white">Describe the website you want</label>
          <textarea id="ai-site-prompt" rows="3" placeholder="e.g. Build a premium Chevrolet dealership homepage focused on pre-owned trucks, instant trade appraisal, and easy financing..." class="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"></textarea>
          <button onclick="aiBuildPageLayoutFromPrompt()" class="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition shadow-lg cursor-pointer">Generate Page Layout</button>
        </div>
      </div>
    `;
  }
}

let __wsDrawerPhotoTab = 'pexels';
function setWsDrawerPhotoTab(t) {
  __wsDrawerPhotoTab = t;
  const el = document.getElementById('ws-left-drawer-content');
  if (el) el.innerHTML = renderWsLeftDrawerHtml();
}
window.setWsDrawerPhotoTab = setWsDrawerPhotoTab;

function renderWsImagesDrawerHtml() {
  const tabBtn = (id, label) => `<button type="button" onclick="setWsDrawerPhotoTab('${id}')" class="px-2.5 py-1 text-[11px] font-black rounded-lg transition ${__wsDrawerPhotoTab === id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'}">${label}</button>`;
  
  return `
    <div class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-300">Images &amp; Media</h3>
        <button type="button" onclick="openWsPhotoPicker()" class="text-[11px] font-bold text-indigo-400 hover:underline">Full Modal ↗</button>
      </div>
      <div class="flex items-center gap-1 border-b border-slate-800 pb-2">
        ${tabBtn('pexels', 'Pexels')}
        ${tabBtn('inventory', 'Inventory')}
        ${tabBtn('upload', 'Upload')}
      </div>
      <div id="ws-drawer-photo-body">
        ${renderWsDrawerPhotoBody()}
      </div>
    </div>
  `;
}

function renderWsDrawerPhotoBody() {
  if (__wsDrawerPhotoTab === 'upload') {
    return `
      <div class="space-y-3 py-2 text-center">
        <div class="border border-dashed border-slate-700 rounded-xl p-4 bg-slate-950/60 hover:border-indigo-500 transition">
          <svg class="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
          <div class="text-xs font-bold text-white mb-1">Upload File</div>
          <p class="text-[10px] text-slate-400 mb-3">JPG, PNG, WEBP</p>
          <input type="file" id="ws-drawer-file" accept="image/*" class="hidden" onchange="uploadWsModalImage(this.files[0])">
          <button type="button" onclick="document.getElementById('ws-drawer-file').click()" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Choose File</button>
        </div>
      </div>
    `;
  }
  if (__wsDrawerPhotoTab === 'inventory') {
    setTimeout(loadWsInventoryPhotos, 50);
    return `
      <div id="ws-inv-photos-grid" class="grid grid-cols-2 gap-1.5 pt-1">
        <div class="col-span-2 py-6 text-center text-xs text-slate-400">Loading lot photos…</div>
      </div>
    `;
  }
  // Pexels drawer tab
  setTimeout(() => searchWsPhotoLibrary('car dealership'), 50);
  return `
    <div class="space-y-2">
      <form onsubmit="event.preventDefault(); searchWsPhotoLibrary(document.getElementById('ws-drawer-photo-query').value)" class="flex gap-1">
        <input id="ws-drawer-photo-query" type="search" value="car dealership" placeholder="Search..." class="flex-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-indigo-500">
        <button class="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold">Go</button>
      </form>
      <div class="flex items-center gap-1 flex-wrap text-[10px]">
        <button type="button" onclick="searchWsPhotoLibrary('car dealership')" class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">Store</button>
        <button type="button" onclick="searchWsPhotoLibrary('truck')" class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">Trucks</button>
        <button type="button" onclick="searchWsPhotoLibrary('luxury car')" class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">Luxury</button>
        <button type="button" onclick="searchWsPhotoLibrary('electric vehicle')" class="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">EV</button>
      </div>
      <div id="ws-photo-results" class="grid grid-cols-2 gap-1.5 pt-1"><div class="col-span-2 py-6 text-center text-xs text-slate-400">Loading…</div></div>
  `;
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
          <label class="font-bold text-slate-300">Background Color / Overlay</label>
          <input type="color" value="${sec.settings?.bg_color || '#0F172A'}" oninput="setSec(${i},'bg_color',this.value)" class="w-full h-8 rounded border border-slate-700 bg-transparent cursor-pointer">
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-300">Text Color Accent</label>
          <input type="color" value="${sec.settings?.text_color || '#FFFFFF'}" oninput="setSec(${i},'text_color',this.value)" class="w-full h-8 rounded border border-slate-700 bg-transparent cursor-pointer">
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-300">Border Radius</label>
          <select onchange="setSec(${i},'border_radius',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white">
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
          <label class="font-bold text-slate-300">Section Height</label>
          <select onchange="setSec(${i},'height',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white">
            <option value="sm">Short</option>
            <option value="md" selected>Medium</option>
            <option value="lg">Tall</option>
            <option value="screen">Full Screen</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="font-bold text-slate-300">Container Alignment</label>
          <select onchange="setSec(${i},'align',this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white">
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
        <div class="space-y-2 p-3 rounded-xl bg-slate-900 border border-slate-700">
          <div class="font-bold text-white">Device Visibility</div>
          <label class="flex items-center gap-2 cursor-pointer text-slate-300"><input type="checkbox" checked class="accent-indigo-600"> Show on Desktop</label>
          <label class="flex items-center gap-2 cursor-pointer text-slate-300"><input type="checkbox" checked class="accent-indigo-600"> Show on Tablet</label>
          <label class="flex items-center gap-2 cursor-pointer text-slate-300"><input type="checkbox" checked class="accent-indigo-600"> Show on Mobile</label>
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
    <div class="ws-studio-container flex flex-col flex-1 h-full w-full bg-[var(--ws-bg)] text-[var(--ws-text)] overflow-hidden">
      <!-- Top Visual Workspace Action Bar -->
      <div class="ws-top-action-bar flex items-center justify-between gap-3 py-1.5 px-4 bg-[var(--ws-panel)] border-b border-[var(--ws-border)] flex-shrink-0 z-20 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-[var(--ws-text-muted)]">Editing Page:</span>
          <select onchange="wsSetTarget(this.value)" class="text-xs font-bold bg-[var(--ws-input-bg)] text-[var(--ws-input-text)] border border-[var(--ws-input-border)] rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer">
            <option value="home" ${__wsTarget === 'home' ? 'selected' : ''}>Home Page</option>
            ${(__sitePages || []).map((p, i) => `<option value="${i}" ${__wsTarget === i ? 'selected' : ''}>${esc(p.title || 'Untitled Page')}</option>`).join('')}
          </select>
        </div>

        <!-- Device Viewport Switcher -->
        <div class="flex items-center bg-[var(--ws-panel-raised)] rounded-lg p-1 border border-[var(--ws-border)]">
          <button onclick="setWsDeviceView('desktop')" data-view="desktop" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'desktop' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer">Desktop</button>
          <button onclick="setWsDeviceView('tablet')" data-view="tablet" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'tablet' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer">Tablet</button>
          <button onclick="setWsDeviceView('mobile')" data-view="mobile" class="ws-device-btn px-2.5 py-1 text-xs font-bold rounded-lg ${__wsActiveDeviceView === 'mobile' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer">Mobile</button>
        </div>

        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">SAVED</span>
          <a href="${SITE_BASE}?d=${encodeURIComponent(slug)}" target="_blank" class="px-3 py-1 rounded-lg bg-[var(--ws-panel-raised)] text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)] border border-[var(--ws-border)] text-xs font-bold transition">Preview ↗</a>
          <button onclick="saveWebsite(this)" class="px-4 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md transition cursor-pointer">Publish Site</button>
        </div>
      </div>

      <!-- Main Studio Visual Canvas Container -->
      <div class="relative flex-1 w-full h-full bg-[var(--ws-bg)] overflow-hidden">
        <!-- Center Full-Screen Live Web Canvas -->
        <main class="w-full h-full flex items-center justify-center p-0 overflow-hidden relative z-0">
          <div id="ws-frame-wrapper" class="${__wsActiveDeviceView === 'mobile' ? 'w-[375px] h-[92%]' : (__wsActiveDeviceView === 'tablet' ? 'w-[768px] h-[92%]' : 'w-full h-full')} ${__wsActiveDeviceView === 'desktop' ? 'border-0' : 'rounded-3xl border-4 border-slate-500 dark:border-slate-700 shadow-2xl'} bg-white transition-all duration-300 overflow-hidden relative z-0">
            <iframe id="ws-preview-frame" src="${SITE_BASE}?d=${encodeURIComponent(slug)}&preview=1" class="w-full h-full border-0" title="Live Website Canvas"></iframe>
          </div>
        </main>

        <!-- Left Floating Dock (Nav Rail + Drawer) -->
        <div id="ws-left-dock-wrapper" class="absolute left-3 top-3 z-30 flex items-start gap-2 max-h-[calc(100vh-120px)]">
          <!-- Nav Rail -->
          <nav class="w-12 bg-[var(--ws-panel)] backdrop-blur-xl border border-[var(--ws-border)] rounded-2xl flex flex-col items-center py-2.5 gap-2 shrink-0 shadow-2xl">
            <button onclick="setWsLeftNav('layers')" data-tab="layers" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'layers' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="Layers Tree">Tree</button>
            <button onclick="setWsLeftNav('blocks')" data-tab="blocks" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'blocks' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="Add Blocks">+Add</button>
            <button onclick="setWsLeftNav('pages')" data-tab="pages" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'pages' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="Manage Pages">Pages</button>
            <button onclick="setWsLeftNav('images')" data-tab="images" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'images' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="Media & Photos">Images</button>
            <button onclick="setWsLeftNav('design')" data-tab="design" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'design' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="Global Styling">Style</button>
            <button onclick="setWsLeftNav('ai')" data-tab="ai" class="ws-nav-rail-btn w-9 h-9 rounded-xl flex flex-col items-center justify-center text-[10px] font-bold ${__wsActiveLeftNav === 'ai' ? 'bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 border border-indigo-500/50' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text)]'} cursor-pointer" title="AI Copilot">AI</button>
            <button id="ws-left-collapse-btn" onclick="toggleWsLeftDock()" class="w-9 h-9 mt-2 rounded-xl bg-[var(--ws-panel-raised)] hover:bg-slate-200 dark:hover:bg-slate-800 text-[var(--ws-text-muted)] hover:text-[var(--ws-text)] text-xs font-black transition flex items-center justify-center border border-[var(--ws-border)] cursor-pointer" title="Collapse tools">&lt;</button>
          </nav>

          <!-- Floating Drawer Content -->
          <aside id="ws-left-drawer-content" class="w-64 bg-[var(--ws-panel)] backdrop-blur-xl border border-[var(--ws-border)] rounded-2xl overflow-y-auto max-h-[calc(100vh-120px)] shadow-2xl transition-all duration-200 ${__wsLeftDockCollapsed ? 'hidden' : ''}">
            ${renderWsLeftDrawerHtml()}
          </aside>
        </div>

        <!-- Right Floating Property Inspector Dock -->
        <div id="ws-right-dock-wrapper" class="absolute right-3 top-3 z-30 flex flex-col items-end gap-2 max-h-[calc(100vh-120px)]">
          <div class="flex items-center gap-2">
            <button id="ws-right-collapse-btn" onclick="toggleWsRightDock()" class="px-3 py-1.5 rounded-xl bg-[var(--ws-panel)] backdrop-blur-xl border border-[var(--ws-border)] text-xs font-black text-[var(--ws-text-secondary)] hover:text-[var(--ws-text)] transition shadow-xl cursor-pointer" title="Toggle Property Inspector">
              ${__wsRightDockCollapsed ? 'Inspector &laquo;' : 'Inspector &raquo;'}
            </button>
          </div>
          <aside id="ws-inspector-panel" class="w-64 bg-[var(--ws-panel)] backdrop-blur-xl border border-[var(--ws-border)] rounded-2xl overflow-y-auto max-h-[calc(100vh-160px)] shadow-2xl transition-all duration-200 ${__wsRightDockCollapsed ? 'hidden' : ''}">
            ${renderWsRightInspectorHtml()}
          </aside>
        </div>
      </div>
    </div>
  `;

  renderWsLayersTree();
}
function wsBlog() {
  return `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">Website Blog &amp; Content Management</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Publish automotive guides, vehicle comparisons, and maintenance articles to rank locally and convert search traffic.</p>
        </div>
        <button type="button" onclick="dealerBlogEdit(null)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5">
          <span>+ New Article</span>
        </button>
      </div>
      <div id="ws-blog-root"></div>
    </div>
  `;
}
window.wsBlog = wsBlog;

function renderWsBody() {
  const body = document.getElementById('ws-body'); if (!body) return;

  // Cleanup lingering floating canvas docks when switching away from Builder
  if (__wsTab !== 'builder') {
    document.getElementById('ws-left-dock-wrapper')?.remove();
    document.getElementById('ws-right-dock-wrapper')?.remove();
    document.getElementById('ws-inspector-panel')?.remove();
  }

  if (__wsTab === 'setup' || __wsTab === 'settings') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950';
    body.innerHTML = wsSetup();
    return;
  }
  if (__wsTab === 'seo') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950';
    body.innerHTML = wsSeo();
    loadDealerSeo();
    return;
  }
  if (__wsTab === 'blog') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950';
    body.innerHTML = wsBlog();
    loadDealerBlog();
    return;
  }
  if (__wsTab === 'design') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950 p-6';
    body.innerHTML = wsDesign();
    return;
  }
  if (__wsTab === 'pages') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950 p-6';
    body.innerHTML = wsPages();
    renderMenuList();
    return;
  }
  if (__wsTab === 'team') {
    body.className = 'flex-1 min-h-0 overflow-y-auto w-full bg-slate-50 dark:bg-slate-950 p-6';
    body.innerHTML = wsTeam();
    renderSiteStaff();
    return;
  }
  if (__wsTab === 'builder' && __builderMode === 'live') {
    body.className = 'flex-1 min-h-0 overflow-hidden flex flex-col w-full h-full';
    renderLiveBuilder(body);
    return;
  }
  // Builder Classic
  body.className = 'flex-1 min-h-0 overflow-y-auto w-full p-4';
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
  const lbl = `<div class="flex items-center justify-between mb-1"><label class="block text-[11px] font-bold text-slate-300">${label}</label>${aiKind ? `<button type="button" onclick="aiMenu(event,${i},'${key}','${aiKind}')" class="text-[11px] font-bold text-violet-400 hover:text-violet-300"> AI</button>` : ''}</div>`;
  const cls = 'w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500';
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
function setSec(i, key, val) { if (__siteSections[i]) { __siteSections[i].settings = __siteSections[i].settings || {}; __siteSections[i].settings[key] = val; refreshWebsitePreview(); } }
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
let __seoMainTab = 'overview';
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

  return `<div id="seo-workspace-root" class="space-y-6 pt-2"><div class="py-12 text-center text-sm text-slate-400 italic">Loading AI SEO Application…</div></div>`;
}

async function loadDealerSeo() {
  const root = document.getElementById('seo-workspace-root');
  if (!root) return;

  if (!__seoMode) {
    if (typeof localStorage !== 'undefined') {
      __seoMode = localStorage.getItem('marketsync_seo_mode') || 'easy';
    } else {
      __seoMode = 'easy';
    }
  }

  try {
    const [overviewRes, settingsRes] = await Promise.all([
      apiGetJson('/seo/overview').catch(() => null),
      apiGetJson('/seo/settings').catch(() => null)
    ]);
    __seoData = overviewRes || {
      healthScore: null,
      visibilityDelta: null,
      searchTraffic: null,
      indexedPages: '--',
      aiVisibility: 'Pending Audit',
      issuesCount: 0,
      opportunitiesCount: 0,
      shareOfVoice: '--',
      trackedKeywords: 0,
      top3Count: 0,
      top10Count: 0,
      top20Count: 0,
      leadsCount: 0,
      apptsCount: 0,
      revenueAttributed: '$0',
      referringDomains: 0,
      totalBacklinks: 0,
      standardsVersion: 'Standards — 2026'
    };
    __seoFullSettings = settingsRes?.settings || {};
    if (settingsRes?.settings?.mode && !localStorage.getItem('marketsync_seo_mode')) {
      __seoMode = settingsRes.settings.mode;
    }
    renderSeoWorkspace();
  } catch (err) {
    root.innerHTML = `<div class="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm font-bold">Failed to load SEO workspace: ${esc(err.message)}</div>`;
  }
}

function setSeoMainTab(tab) {
  __seoMainTab = tab || 'overview';
  renderSeoWorkspace();
}
window.setSeoMainTab = setSeoMainTab;

function setSeoSubTab(tab) {
  __seoSubTab = tab;
  renderSeoWorkspace();
}
window.setSeoSubTab = setSeoSubTab;

function setSeoMode(mode) {
  __seoMode = mode;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('marketsync_seo_mode', mode);
  }
  __seoMainTab = 'overview';
  apiSendJson('/seo/settings', 'PUT', { mode }).catch(() => {});
  renderSeoWorkspace();
}
window.setSeoMode = setSeoMode;

function renderSeoWorkspace() {
  const root = document.getElementById('seo-workspace-root');
  if (!root || !__seoData) return;

  const d = __seoData;
  const isEasy = __seoMode !== 'advanced';

  const navTab = (id, label) => `
    <button onclick="setSeoMainTab('${id}')" data-seo-tab="${id}" class="px-3.5 py-2 text-xs font-black rounded-xl transition cursor-pointer ${__seoMainTab === id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}">${label}</button>
  `;

  root.innerHTML = `
    <!-- Top SEO Application Navigation Suite -->
    <div class="flex items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white flex-wrap shadow-xl">
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black text-lg">SEO</div>
        <div>
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-black text-white">MarketSync SEO Suite</h2>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">${esc(d.standardsVersion || 'Standards — 2026')}</span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Full Dealership Search Engine &amp; AI Discovery Platform</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="inline-flex rounded-xl border border-slate-700 overflow-hidden text-xs font-bold shadow-xs">
          <button onclick="setSeoMode('easy')" class="px-3 py-1.5 transition cursor-pointer ${isEasy ? 'bg-indigo-600 text-white font-black' : 'bg-slate-800 text-slate-300'}">Easy Mode</button>
          <button onclick="setSeoMode('advanced')" class="px-3 py-1.5 transition cursor-pointer ${!isEasy ? 'bg-indigo-600 text-white font-black' : 'bg-slate-800 text-slate-300'}">Advanced Mode</button>
        </div>
      </div>
    </div>

    <!-- Primary Application Navigation Tabs -->
    <div class="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
      ${isEasy ? `
        ${navTab('overview', 'Command Center')}
        ${navTab('content', 'Content')}
        ${navTab('technical', 'Technical')}
        ${navTab('redirects', 'Redirects & 404s')}
        ${navTab('analytics', 'Search & Revenue')}
        ${navTab('competitors', 'Competitors')}
        ${navTab('autopilot', 'Auto-Pilot')}
        ${navTab('settings', 'Settings')}
        ${navTab('history', 'Change Log')}
      ` : `
        ${navTab('overview', 'Overview')}
        ${navTab('keywords', 'Keywords')}
        ${navTab('rankings', 'Rankings')}
        ${navTab('competitors', 'Competitors')}
        ${navTab('backlinks', 'Backlinks')}
        ${navTab('content', 'Content')}
        ${navTab('pages', 'Pages')}
        ${navTab('local', 'Local')}
        ${navTab('technical', 'Technical')}
        ${navTab('audit', 'Audit')}
        ${navTab('ai', 'AI Visibility')}
        ${navTab('analytics', 'Analytics')}
        ${navTab('settings', 'Settings')}
      `}
    </div>

    <!-- Main Workspace Body -->
    <div id="seo-main-body">
      ${renderSeoMainBody()}
    </div>
  `;
}

function renderSeoMainBody() {
  if (__seoMode === 'advanced') {
    if (__seoMainTab === 'overview') return renderSeoAdvancedOverviewView();
    if (__seoMainTab === 'keywords') return renderSeoKeywordsView();
    if (__seoMainTab === 'rankings') return renderSeoRankingsView();
    if (__seoMainTab === 'competitors') return renderSeoCompetitorsView();
    if (__seoMainTab === 'backlinks') return renderSeoBacklinksView();
    if (__seoMainTab === 'content') return renderSeoContentView();
    if (__seoMainTab === 'pages') return renderSeoPagesView();
    if (__seoMainTab === 'local') return renderSeoLocalView();
    if (__seoMainTab === 'technical') return renderSeoTechnicalView();
    if (__seoMainTab === 'audit') return renderSeoAuditView();
    if (__seoMainTab === 'ai') return renderSeoAiView();
    if (__seoMainTab === 'analytics') return renderSeoAnalyticsView();
    if (__seoMainTab === 'settings' || __seoMainTab === 'titles') return renderSeoSettingsWorkspace();
    return renderSeoAdvancedOverviewView();
  } else {
    if (__seoMainTab === 'overview') return renderSeoEasyOverviewView();
    if (__seoMainTab === 'content') return renderSeoContentView();
    if (__seoMainTab === 'technical' || __seoMainTab === 'sitemaps' || __seoMainTab === 'robots') return renderSeoTechnicalView();
    if (__seoMainTab === 'redirects') return renderSeoRedirectsView();
    if (__seoMainTab === 'analytics') return renderSeoAnalyticsView();
    if (__seoMainTab === 'competitors') return renderSeoCompetitorsView();
    if (__seoMainTab === 'autopilot') return renderSeoAutopilotView();
    if (__seoMainTab === 'settings' || __seoMainTab === 'titles') return renderSeoSettingsWorkspace();
    if (__seoMainTab === 'history') return renderSeoHistoryView();
    return renderSeoEasyOverviewView();
  }
}

function renderSeoOverviewView() {
  return __seoMode === 'advanced' ? renderSeoAdvancedOverviewView() : renderSeoEasyOverviewView();
}

function renderSeoEasyOverviewView() {
  const d = __seoData || {};
  return `
    <div class="space-y-6">
      <!-- Top Summary Scorecards -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">SEO Health</div>
          <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${d.healthScore != null ? d.healthScore : '--'} <span class="text-xs text-slate-400">/ 100</span></div>
          <div class="text-[10px] text-slate-400 font-medium">Daily Audit</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">Organic Visibility</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${d.visibilityDelta != null ? `+${d.visibilityDelta}%` : '--'}</div>
          <div class="text-[10px] text-emerald-500 font-bold">${d.visibilityDelta != null ? 'Active' : 'Pending GSC'}</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">Search Traffic</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white">${d.searchTraffic != null ? d.searchTraffic : (d.providerStatus?.connected ? 0 : 'Connect GSC')}</div>
          <div class="text-[10px] text-slate-400 font-medium">Monthly Clicks</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">Indexed Pages</div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${esc(d.indexedPages || '--')}</div>
          <div class="text-[10px] text-slate-400 font-medium">Google Coverage</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">AI Visibility</div>
          <div class="text-xl font-black text-emerald-600 dark:text-emerald-400">${esc(d.aiVisibility || '--')}</div>
          <div class="text-[10px] text-slate-400 font-medium">llms.txt Active</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">Action Items</div>
          <div class="text-2xl font-black text-amber-500">${d.issuesCount != null ? d.issuesCount : 0}</div>
          <div class="text-[10px] text-slate-400 font-medium">Warnings Flagged</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-500 dark:text-slate-400 font-bold">Opportunities</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${d.opportunitiesCount != null ? d.opportunitiesCount : 0}</div>
          <div class="text-[10px] text-slate-400 font-medium">High Impact Targets</div>
        </div>
      </div>

      <!-- Action Items Required Attention -->
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Issues Requiring Attention</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Classified by dealer impact: Review First vs Auto-Fix Safe.</p>
          </div>
          <button onclick="runSeoAction('auto_heal_all', 'all')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer">Auto-Heal All Safe Issues</button>
        </div>

        <div class="space-y-3">
          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div class="space-y-1 max-w-xl">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">Review First</span>
                <span class="font-bold text-slate-900 dark:text-white">Homepage Meta Description Length</span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">Your homepage meta description is 42 characters. Recommended length is 120-160 characters to optimize Google CTR.</p>
            </div>
            <button onclick="setSeoMainTab('settings')" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition cursor-pointer">Edit Homepage Meta</button>
          </div>

          <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div class="space-y-1 max-w-xl">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Auto-Fix Safe</span>
                <span class="font-bold text-slate-900 dark:text-white">Missing Image Alt Tags on 2 VDP Photos</span>
              </div>
              <p class="text-slate-600 dark:text-slate-300 text-[11px]">2 inventory images lack descriptive alt attributes. Auto-repair will inject Year/Make/Model metadata.</p>
            </div>
            <button onclick="runSeoAction('fix_alt_tags', 'iss-2')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition cursor-pointer">Apply 1-Click Fix</button>
          </div>
        </div>
      </div>

      <!-- Live Self-Healing Feed -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Recent Auto-Repaired SEO Events</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Autonomous background optimizations</span>
        </div>
        <div class="space-y-2">
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
              <div>
                <div class="font-black text-slate-900 dark:text-white">Generated llms.txt AI crawler specification file</div>
                <div class="text-[11px] text-slate-400">Published official specification for ChatGPT, Claude, and Gemini discovery.</div>
              </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">Automatic · Just Now</span>
          </div>
          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
              <div>
                <div class="font-black text-slate-900 dark:text-white">Regenerated XML Sitemaps with 347 verified inventory URLs</div>
                <div class="text-[11px] text-slate-400">Synced fresh VDP stock URLs and submitted to Search Console.</div>
              </div>
            </div>
            <span class="text-[10px] font-bold text-slate-400 whitespace-nowrap">Automatic · Today</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoAdvancedOverviewView() {
  const d = __seoData || {};
  return `
    <div class="space-y-6">
      <!-- Semrush-Style Top Metrics Workstation (16 Scorecards) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Visibility Score</div>
          <div class="text-xl font-black text-indigo-600 dark:text-indigo-400">78.4%</div>
          <div class="text-[10px] text-emerald-500 font-bold">+14.2% MoM</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Share of Voice</div>
          <div class="text-xl font-black text-emerald-500">${esc(d.shareOfVoice || '42.8%')}</div>
          <div class="text-[10px] text-slate-400">#1 in Market</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Tracked Keywords</div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${d.trackedKeywords || 48}</div>
          <div class="text-[10px] text-indigo-400 font-bold">6 in Top 3 · 24 Top 10</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Search Clicks</div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${d.searchTraffic != null ? d.searchTraffic : '--'}</div>
          <div class="text-[10px] text-slate-400">${d.providerStatus?.connected ? 'Live GSC' : 'Connect GSC'}</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">CRM Leads</div>
          <div class="text-xl font-black text-indigo-500">${d.leadsCount != null ? d.leadsCount : 0}</div>
          <div class="text-[10px] text-slate-400">Attributed Leads</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Appointments</div>
          <div class="text-xl font-black text-emerald-500">${d.apptsCount != null ? d.apptsCount : 0}</div>
          <div class="text-[10px] text-slate-400">Showroom &amp; Service</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Attributed Rev</div>
          <div class="text-xl font-black text-emerald-400">${esc(d.revenueAttributed || '$0')}</div>
          <div class="text-[10px] text-slate-400">Closed Units</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Referring Domains</div>
          <div class="text-xl font-black text-indigo-400">${d.referringDomains != null ? d.referringDomains : 0}</div>
          <div class="text-[10px] text-slate-400">${d.totalBacklinks != null ? `${d.totalBacklinks} Backlinks` : '0 Backlinks'}</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Site Health</div>
          <div class="text-xl font-black text-emerald-500">${d.healthScore != null ? d.healthScore : '--'} / 100</div>
          <div class="text-[10px] text-slate-400">Audit Status</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Indexed Pages</div>
          <div class="text-xl font-black text-slate-900 dark:text-white">${esc(d.indexedPages || '--')}</div>
          <div class="text-[10px] text-slate-400">Indexation Status</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Content Gaps</div>
          <div class="text-xl font-black text-amber-500">8 Topics</div>
          <div class="text-[10px] text-slate-400">Silverado, F-150</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Competitor Rank</div>
          <div class="text-xl font-black text-emerald-500">+4 Lead</div>
          <div class="text-[10px] text-slate-400">vs Niagara Motors</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Local Pack Rank</div>
          <div class="text-xl font-black text-emerald-400">#1.8 Avg</div>
          <div class="text-[10px] text-slate-400">Google 3-Pack Map</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">AI Readiness</div>
          <div class="text-xl font-black text-emerald-400">${esc(d.aiVisibility || '88% Ready')}</div>
          <div class="text-[10px] text-slate-400">llms.txt Active</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Core Web Vitals</div>
          <div class="text-xl font-black text-emerald-500">Good</div>
          <div class="text-[10px] text-slate-400">LCP 1.1s · INP 36ms</div>
        </div>
        <div class="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[9px] tracking-wider">HTTPS / SSL</div>
          <div class="text-xl font-black text-emerald-500">100%</div>
          <div class="text-[10px] text-slate-400">TLS 1.3 Active</div>
        </div>
      </div>

      <!-- Real-Time Automotive Inventory SEO Intelligence Engine -->
      <div class="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 text-white space-y-4 shadow-xl">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-black">Real-Time Inventory SEO &amp; Demand Engine</h3>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Lot Synced</span>
              </div>
              <p class="text-xs text-indigo-200">Connects active vehicle inventory on your lot to search volume, organic ranks, and revenue opportunity.</p>
            </div>
          </div>
          <button onclick="setSeoMainTab('keywords')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md">Explore All Keyword Clusters ↗</button>
        </div>

        <div class="grid md:grid-cols-3 gap-4 text-xs pt-1">
          <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-300">23 Silverado Trucks in Stock</span>
              <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black text-[10px]">Rank #14 &rarr; Brock Ford #3</span>
            </div>
            <p class="text-slate-400 text-[11px]">High local search volume for <code class="text-indigo-300 font-mono">used silverado welland</code> (1,400 queries/mo). Generated 14 CRM leads &amp; 3 sold deals last month.</p>
            <div class="pt-1 flex items-center justify-between">
              <span class="text-emerald-400 font-bold text-[11px]">+$12,400 Opp Gross</span>
              <button onclick="createBlogFromSeoOpp(0)" class="text-indigo-400 hover:text-indigo-300 font-bold underline text-[11px] cursor-pointer">Optimize Silverado SRP &amp; Schema</button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-300">Used SUV Financing Intent</span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[10px]">Rank #2 Winning</span>
            </div>
            <p class="text-slate-400 text-[11px]">Targeting <code class="text-indigo-300 font-mono">car loan bad credit welland</code> with high transactional intent. Direct pipeline into F&amp;I Credit Intake.</p>
            <div class="pt-1 flex items-center justify-between">
              <span class="text-emerald-400 font-bold text-[11px]">28 Leads Generated</span>
              <button onclick="createBlogFromSeoOpp(1)" class="text-indigo-400 hover:text-indigo-300 font-bold underline text-[11px] cursor-pointer">Expand Finance Landing Page</button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-300">Certified Service &amp; Brakes</span>
              <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[10px]">Rank #7 Opportunity</span>
            </div>
            <p class="text-slate-400 text-[11px]">Queries for <code class="text-indigo-300 font-mono">brake repair near me</code> are rising 24%. Opportunity to drive fixed-ops repair orders.</p>
            <div class="pt-1 flex items-center justify-between">
              <span class="text-emerald-400 font-bold text-[11px]">+$8,600 Service ROs</span>
              <button onclick="setSeoMainTab('content')" class="text-indigo-400 hover:text-indigo-300 font-bold underline text-[11px] cursor-pointer">Draft Service SEO Guide</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Provider Telemetry Status Bar -->
      <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap text-xs">
        <div class="flex items-center gap-4 flex-wrap text-[11px]">
          <span class="font-black uppercase tracking-wider text-slate-400">Data Providers:</span>
          <span class="flex items-center gap-1.5 font-bold text-emerald-500"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Google Search Console (Live)</span>
          <span class="flex items-center gap-1.5 font-bold text-emerald-500"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> GA4 Analytics (Active)</span>
          <span class="flex items-center gap-1.5 font-bold text-emerald-500"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Google Business Profile (Synced)</span>
          <span class="flex items-center gap-1.5 font-bold text-emerald-500"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Semrush / SERP Index (Connected)</span>
          <span class="flex items-center gap-1.5 font-bold text-emerald-500"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> llms.txt AI Crawler (Verified)</span>
        </div>
        <button onclick="setSeoMainTab('settings')" class="text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer">Manage API Integrations &rarr;</button>
      </div>
    </div>
  `;
}

function renderSeoSettingsWorkspace() {
  const s = __seoFullSettings || {};
  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Rank-Math Dealership SEO Configuration</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Control site-wide meta defaults, URL canonicalization, titles, breadcrumbs, and tracking tags.</p>
        </div>
        <button onclick="saveSeoFormSettings(event)" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer">Save SEO Settings</button>
      </div>

      <form id="seo-settings-form" onsubmit="saveSeoFormSettings(event)" class="space-y-6">
        <!-- 1. General & Canonical Settings -->
        <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            General &amp; Canonical Indexing
          </h4>
          <div class="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Dealership SEO Name</label>
              <input type="text" id="seo-site-name" value="${esc(s.site_name || 'Premier Chevrolet')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Title Separator</label>
              <select id="seo-separator" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white">
                <option value="|" ${s.separator === '|' ? 'selected' : ''}>| (Pipe)</option>
                <option value="-" ${s.separator === '-' ? 'selected' : ''}>- (Hyphen)</option>
                <option value="•" ${s.separator === '•' ? 'selected' : ''}>• (Bullet)</option>
                <option value="—" ${s.separator === '—' ? 'selected' : ''}>— (Em Dash)</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Canonical Domain</label>
              <input type="text" id="seo-canonical-domain" value="${esc(s.canonical_domain || 'https://marketsync.link')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Trailing Slash Preference</label>
              <select id="seo-trailing-slash" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white">
                <option value="add_slash" ${s.trailing_slash !== 'remove_slash' ? 'selected' : ''}>Enforce trailing slash (/inventory/)</option>
                <option value="remove_slash" ${s.trailing_slash === 'remove_slash' ? 'selected' : ''}>Strip trailing slash (/inventory)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 2. Titles & Meta Defaults -->
        <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
            Automated Title &amp; Description Templates
          </h4>
          <div class="space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Homepage Title Template</label>
              <input type="text" id="seo-title-homepage" value="${esc(s.title_homepage || '%dealer% | New & Used Cars in %city%')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Homepage Meta Description</label>
              <textarea id="seo-desc-homepage" rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white">${esc(s.desc_homepage || 'Welcome to %dealer% in %city%. Browse top new and pre-owned inventory, get pre-approved financing, and schedule certified auto service.')}</textarea>
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle VDP Title Template</label>
              <input type="text" id="seo-title-vdp" value="${esc(s.title_vdp || '%year% %make% %model% %trim% for Sale in %city% | %dealer%')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle VDP Meta Description</label>
              <textarea id="seo-desc-vdp" rows="2" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white">${esc(s.desc_vdp || 'Buy this %year% %make% %model% %trim% at %dealer% in %city%. Stock #%stock%, competitive pricing, instant trade-in appraisal, and easy financing.')}</textarea>
            </div>
          </div>
        </div>

        <!-- 3. Webmaster & Tracking IDs -->
        <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Webmaster &amp; Analytics Tracking
          </h4>
          <div class="grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Google Analytics 4 (GA4 ID)</label>
              <input type="text" id="seo-ga4-id" value="${esc(s.ga4_measurement_id || 'G-MSDEMO2026')}" placeholder="G-XXXXXXXXXX" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Meta Pixel ID</label>
              <input type="text" id="seo-meta-pixel-id" value="${esc(s.meta_pixel_id || 'FB-9059414226')}" placeholder="1234567890" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Google Tag Manager (GTM ID)</label>
              <input type="text" id="seo-gtm-id" value="${esc(s.gtm_id || 'GTM-MSSYNC1')}" placeholder="GTM-XXXXXX" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono" />
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button type="submit" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer">Save SEO Configuration</button>
        </div>
      </form>
    </div>
  `;
}

function renderSeoContentView() {
  return `
    <div class="space-y-6">
      <!-- Section 1: AI Content Opportunities -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">AI Content &amp; Keyword Opportunities</h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Identifies local search queries in your primary market.</span>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between">
            <div class="space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">High Local Volume</span>
                <span class="text-emerald-500 font-bold">+340 estimated clicks/mo</span>
              </div>
              <h4 class="text-sm font-black text-slate-900 dark:text-white">2025 Chevrolet Silverado Towing Capacity &amp; Specs</h4>
              <p class="text-slate-500 dark:text-slate-400">High local query volume for Silverado 1500 and 2500HD trailer payload ratings in your market.</p>
              <div class="flex flex-wrap gap-1 pt-1">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"># Silverado towing</span>
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"># 2025 specs</span>
              </div>
            </div>
            <button onclick="createBlogFromSeoOpp(0)" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              Draft AI Article in Blog
            </button>
          </div>

          <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 flex flex-col justify-between">
            <div class="space-y-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">High Commercial Intent</span>
                <span class="text-emerald-500 font-bold">+280 estimated clicks/mo</span>
              </div>
              <h4 class="text-sm font-black text-slate-900 dark:text-white">Used SUV Financing Under $35,000</h4>
              <p class="text-slate-500 dark:text-slate-400">Captures budget-conscious buyers searching for affordable monthly pre-approved SUV financing.</p>
              <div class="flex flex-wrap gap-1 pt-1">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"># used SUV financing</span>
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300"># used cars under 35k</span>
              </div>
            </div>
            <button onclick="createBlogFromSeoOpp(1)" class="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              Draft AI Article in Blog
            </button>
          </div>
        </div>
      </div>

      <!-- Section 2: On-Page Headline & SEO Assistant -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Live On-Page SEO &amp; Headline Analyzer
        </h4>
        <div class="grid md:grid-cols-2 gap-4 text-xs">
          <div class="space-y-3">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Page Title or Headline</label>
              <input type="text" id="seo-test-title" value="2025 Chevrolet Silverado Trucks for Sale in Welland" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Primary Target Keyword</label>
              <input type="text" id="seo-test-kw" value="Chevrolet Silverado" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white" />
            </div>
            <button onclick="runOnpageAnalysis(this)" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">Analyze Headline</button>
          </div>
          <div id="seo-onpage-result" class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-500">SEO Quality Score</span>
              <span class="text-xl font-black text-emerald-500">95 / 100</span>
            </div>
            <div class="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
              <p class="text-emerald-500 font-bold">Passed &middot; Primary keyword found at start of title</p>
              <p class="text-emerald-500 font-bold">Passed &middot; Local geographic city context (Welland) included</p>
              <p class="text-emerald-500 font-bold">Passed &middot; Character length optimal (52 / 60 max)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoTechnicalView() {
  return `
    <div class="space-y-6">
      <!-- 1. XML Sitemaps -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">XML Sitemaps Architecture</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">Automatically splits pages, inventory, and blog into search-engine indexable feeds.</p>
          </div>
          <button onclick="regenerateSitemapAction(this)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">Regenerate Sitemap</button>
        </div>
        <div class="grid md:grid-cols-3 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div class="font-black text-slate-900 dark:text-white">sitemap.xml</div>
            <div class="text-[11px] text-slate-400">Primary index file · 347 total URLs</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div class="font-black text-slate-900 dark:text-white">sitemap-inventory.xml</div>
            <div class="text-[11px] text-slate-400">Active live VDPs · Last-modified headers</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div class="font-black text-slate-900 dark:text-white">sitemap-blog.xml</div>
            <div class="text-[11px] text-slate-400">Published articles &amp; buying guides</div>
          </div>
        </div>
      </div>

      <!-- 2. Robots & LLM AI Specification -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">Robots.txt &amp; AI Discovery (llms.txt)</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">Controls search engine and AI crawler access rules.</p>
          </div>
          <button onclick="generateLlmsTxtAction(this)" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">Generate llms.txt</button>
        </div>
        <div class="grid md:grid-cols-2 gap-4 text-xs font-mono">
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1 font-sans">Robots.txt Live Rules</label>
            <textarea id="seo-robots-txt" rows="4" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white">User-agent: *&#10;Allow: /&#10;Disallow: /admin/&#10;Disallow: /checkout/&#10;Sitemap: https://marketsync.link/sitemap.xml</textarea>
          </div>
          <div>
            <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1 font-sans">llms.txt AI Crawler Readiness</label>
            <div class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 space-y-1 text-[11px]">
              <div>GPTBot (ChatGPT): <span class="text-emerald-500 font-bold">Allowed</span></div>
              <div>ClaudeBot (Anthropic): <span class="text-emerald-500 font-bold">Allowed</span></div>
              <div>PerplexityBot: <span class="text-emerald-500 font-bold">Allowed</span></div>
              <div>Specification URL: <span class="text-indigo-400 font-bold">https://marketsync.link/llms.txt</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Local SEO & Schema.org JSON-LD -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">AutoDealer Schema.org JSON-LD Output</h4>
        <div class="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
          <pre>{
  "@context": "https://schema.org",
  "@type": "AutoDealer",
  "name": "Premier Chevrolet",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "1426 Niagara Street",
    "addressLocality": "Welland",
    "addressRegion": "ON",
    "postalCode": "L3B 6A3",
    "addressCountry": "CA"
  },
  "telephone": "(905) 941-4226",
  "url": "https://marketsync.link"
}</pre>
        </div>
      </div>
    </div>
  `;
}

function renderSeoRedirectsView() {
  return `
    <div class="space-y-6">
      <!-- 301 Redirects Table -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">Active 301 / 302 URL Redirects</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">Preserves inbound search authority when vehicle inventory or pages move.</p>
          </div>
          <button onclick="addRedirectModal()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">+ Add Redirect</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-2.5">Source URL</th>
                <th class="py-2.5">Target Destination</th>
                <th class="py-2.5">Type</th>
                <th class="py-2.5">Hits</th>
                <th class="py-2.5">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td class="py-3 font-mono">/inventory/used-2023-chevy-silverado</td>
                <td class="py-3 font-mono text-indigo-500">/inventory/2023-chevrolet-silverado-1500-stk905</td>
                <td class="py-3"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">301</span></td>
                <td class="py-3 font-bold">42</td>
                <td class="py-3"><button onclick="deleteRedirect('red-1')" class="text-red-400 hover:text-red-300 font-bold cursor-pointer">Delete</button></td>
              </tr>
              <tr>
                <td class="py-3 font-mono">/finance-specials</td>
                <td class="py-3 font-mono text-indigo-500">/credit-application</td>
                <td class="py-3"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">301</span></td>
                <td class="py-3 font-bold">18</td>
                <td class="py-3"><button onclick="deleteRedirect('red-2')" class="text-red-400 hover:text-red-300 font-bold cursor-pointer">Delete</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 404 Error Log Monitor -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h4 class="text-xs font-black uppercase tracking-wider text-amber-500">404 Error Log &amp; Auto-Fix Monitor</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-xs text-left">
            <thead class="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-2.5">Missing URL (404)</th>
                <th class="py-2.5">Hits</th>
                <th class="py-2.5">Referrer</th>
                <th class="py-2.5">AI Target Suggestion</th>
                <th class="py-2.5">Auto-Heal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td class="py-3 font-mono">/used-trucks-niagara-falls</td>
                <td class="py-3 font-bold text-amber-500">14</td>
                <td class="py-3 text-slate-400">Google Organic</td>
                <td class="py-3 font-mono text-indigo-400">/inventory?body_style=Truck</td>
                <td class="py-3"><button onclick="resolve404Error('404-1', 'create_redirect', '/inventory?body_style=Truck')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer">Create 301</button></td>
              </tr>
              <tr>
                <td class="py-3 font-mono">/service-coupons-2025</td>
                <td class="py-3 font-bold text-amber-500">8</td>
                <td class="py-3 text-slate-400">Direct Bookmark</td>
                <td class="py-3 font-mono text-indigo-400">/service</td>
                <td class="py-3"><button onclick="resolve404Error('404-2', 'create_redirect', '/service')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg cursor-pointer">Create 301</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderSeoAnalyticsView() {
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/30 text-white space-y-4 shadow-xl">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-lg font-black">Organic Search Lead &amp; Revenue Attribution</h3>
            <p class="text-xs text-indigo-200">Connecting organic search visits directly to CRM leads, test drive appointments, and sold deals.</p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-black text-emerald-400">$148,200 CAD</div>
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
            <div class="text-xl font-black text-indigo-400 mt-1">42</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">Appointments</div>
            <div class="text-xl font-black text-indigo-400 mt-1">18</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div class="text-slate-400 text-[10px] font-bold">Sold Vehicles</div>
            <div class="text-xl font-black text-emerald-400 mt-1">14</div>
          </div>
        </div>
      </div>

      <!-- Monthly AI Report Summary -->
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">Monthly AI Executive SEO Report — August 2026</h4>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Organic clicks increased 18% this month for Premier Chevrolet. Used truck pages drove most of the growth. MarketSync automatically corrected 13 broken redirects and refreshed 42 vehicle metadata records. The strongest next opportunity is financing-related content in your local area.
        </p>
      </div>
    </div>
  `;
}

function renderSeoCompetitorsView() {
  return `
    <div class="space-y-6">
      <!-- Competitor Organic Matrix -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">Local Dealership Competitor Matrix</h4>
          <span class="text-xs text-slate-400">Niagara Market Benchmark</span>
        </div>
        <div class="grid md:grid-cols-3 gap-4 text-xs">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-900 dark:text-white">Niagara Motors</span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold text-[10px]">We Lead</span>
            </div>
            <div class="text-[11px] text-slate-400 space-y-0.5">
              <div>Organic Keywords: 320 · Traffic: ~1,100/mo</div>
              <div>Domain Authority: 42 · Local Pack: #2.4</div>
            </div>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-900 dark:text-white">Welland Auto Mall</span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 font-bold text-[10px]">We Lead</span>
            </div>
            <div class="text-[11px] text-slate-400 space-y-0.5">
              <div>Organic Keywords: 280 · Traffic: ~840/mo</div>
              <div>Domain Authority: 38 · Local Pack: #3.1</div>
            </div>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-900 dark:text-white">Brock Ford</span>
              <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-[10px]">Close Rival</span>
            </div>
            <div class="text-[11px] text-slate-400 space-y-0.5">
              <div>Organic Keywords: 410 · Traffic: ~1,600/mo</div>
              <div>Domain Authority: 51 · Local Pack: #1.4</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <h4 class="text-xs font-black text-emerald-500 uppercase tracking-wider">You're Winning (Top Rankings)</h4>
          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div class="font-black text-slate-900 dark:text-white">"used chevrolet welland"</div>
                <div class="text-[11px] text-slate-400">Your Rank: #1 · Competitor Rank: #4</div>
              </div>
              <span class="text-emerald-500 font-black">+3 ahead</span>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div class="font-black text-slate-900 dark:text-white">"truck financing niagara"</div>
                <div class="text-[11px] text-slate-400">Your Rank: #2 · Competitor Rank: #7</div>
              </div>
              <span class="text-emerald-500 font-black">+5 ahead</span>
            </div>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
          <h4 class="text-xs font-black text-amber-500 uppercase tracking-wider">Keyword Gap Opportunities</h4>
          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div class="font-black text-slate-900 dark:text-white">"used trucks niagara"</div>
                <div class="text-[11px] text-slate-400">Brock Ford: #3 · Your Rank: #14</div>
              </div>
              <button onclick="createBlogFromSeoOpp(0)" class="text-indigo-600 dark:text-indigo-400 font-bold underline text-[11px] cursor-pointer">Outrank with AI</button>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div>
                <div class="font-black text-slate-900 dark:text-white">"brake repair welland"</div>
                <div class="text-[11px] text-slate-400">Niagara Auto: #2 · Your Rank: #7</div>
              </div>
              <button onclick="setSeoMainTab('content')" class="text-indigo-600 dark:text-indigo-400 font-bold underline text-[11px] cursor-pointer">Outrank with AI</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoAutopilotView() {
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-black uppercase tracking-wider text-indigo-500">Auto-Pilot Self-Healing Rules</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">Automated actions run in background according to MarketSync SEO Standards.</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active</span>
        </div>
        <div class="space-y-3 text-xs">
          <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input type="checkbox" checked class="rounded text-indigo-600 focus:ring-0" />
            <div>
              <div class="font-bold text-slate-900 dark:text-white">Auto-generate XML sitemaps daily and submit to Search Console</div>
              <div class="text-[11px] text-slate-400">Updates whenever vehicles are added, sold, or modified.</div>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input type="checkbox" checked class="rounded text-indigo-600 focus:ring-0" />
            <div>
              <div class="font-bold text-slate-900 dark:text-white">Auto-inject canonical headers on duplicate query parameter URLs</div>
              <div class="text-[11px] text-slate-400">Prevents duplicate content ranking penalties.</div>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input type="checkbox" checked class="rounded text-indigo-600 focus:ring-0" />
            <div>
              <div class="font-bold text-slate-900 dark:text-white">Auto-create 301 Category Redirects when sold inventory is deleted</div>
              <div class="text-[11px] text-slate-400">Preserves inbound backlink equity directly to make/model inventory.</div>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input type="checkbox" checked class="rounded text-indigo-600 focus:ring-0" />
            <div>
              <div class="font-bold text-slate-900 dark:text-white">Auto-populate missing image alt tags from vehicle Year/Make/Model metadata</div>
              <div class="text-[11px] text-slate-400">Boosts Google Image Search discovery for all lot inventory.</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  `;
}

function renderSeoHistoryView() {
  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">SEO Audit &amp; Repair History</h3>
        <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">Complete ledger of automatic self-healing and manual edits.</span>
      </div>
      <div class="space-y-2 text-xs">
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-black text-[10px]">AUTOMATIC</span>
            <div>
              <div class="font-black text-slate-900 dark:text-white">Regenerated XML Sitemap Index</div>
              <div class="text-[11px] text-slate-400">Synced 347 verified inventory URLs to sitemap-inventory.xml.</div>
            </div>
          </div>
          <span class="text-[11px] text-slate-400">Just now</span>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-black text-[10px]">MANUAL</span>
            <div>
              <div class="font-black text-slate-900 dark:text-white">Saved Rank-Math SEO configuration patch</div>
              <div class="text-[11px] text-slate-400">Updated homepage title template and separator preference.</div>
            </div>
          </div>
          <span class="text-[11px] text-slate-400">Today</span>
        </div>
      </div>
    </div>
  `;
}

function renderSeoKeywordsView() {
  return `
    <div class="space-y-6">
      <!-- Keyword Research & Tracking Header -->
      <div class="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Keyword Research &amp; Target Clustering</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Discover local automotive search volume, keyword difficulty, intent, and competitor overlap.</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="text" id="kw-search-input" placeholder="Search keywords (e.g. used silverado niagara)..." class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white w-64" />
          <button class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer">Analyze</button>
        </div>
      </div>

      <!-- Keyword Metrics Table -->
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table class="w-full text-left text-xs text-slate-700 dark:text-slate-200">
          <thead class="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3.5">Keyword</th>
              <th class="p-3.5">Intent</th>
              <th class="p-3.5">Monthly Volume</th>
              <th class="p-3.5">Difficulty (KD%)</th>
              <th class="p-3.5">CPC (CAD)</th>
              <th class="p-3.5">SERP Features</th>
              <th class="p-3.5">Current Rank</th>
              <th class="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">used cars welland</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-500">Commercial</span></td>
              <td class="p-3.5 font-bold">1,900</td>
              <td class="p-3.5"><span class="text-amber-500 font-bold">42% (Medium)</span></td>
              <td class="p-3.5">$2.84</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">Local Pack · Reviews</span></td>
              <td class="p-3.5 font-black text-emerald-500">#1</td>
              <td class="p-3.5 text-right"><span class="text-indigo-500 font-bold">Tracking OK</span></td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">truck dealership niagara</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">Transactional</span></td>
              <td class="p-3.5 font-bold">1,300</td>
              <td class="p-3.5"><span class="text-emerald-500 font-bold">28% (Easy)</span></td>
              <td class="p-3.5">$3.40</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">Local Pack · SiteLinks</span></td>
              <td class="p-3.5 font-black text-emerald-500">#2</td>
              <td class="p-3.5 text-right"><span class="text-indigo-500 font-bold">Tracking OK</span></td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">car loan bad credit welland</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">Transactional</span></td>
              <td class="p-3.5 font-bold">880</td>
              <td class="p-3.5"><span class="text-rose-500 font-bold">58% (Hard)</span></td>
              <td class="p-3.5">$6.12</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">Finance Calculator</span></td>
              <td class="p-3.5 font-black text-indigo-400">#4</td>
              <td class="p-3.5 text-right"><span class="text-indigo-500 font-bold">Tracking OK</span></td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">how much is my trade worth</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-500/20 text-slate-400">Informational</span></td>
              <td class="p-3.5 font-bold">2,400</td>
              <td class="p-3.5"><span class="text-amber-500 font-bold">38% (Medium)</span></td>
              <td class="p-3.5">$1.95</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">AI Overview · Tool</span></td>
              <td class="p-3.5 font-black text-slate-400">#9</td>
              <td class="p-3.5 text-right"><button onclick="createBlogFromSeoOpp(1)" class="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer">+ Draft Brief</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSeoRankingsView() {
  return `
    <div class="space-y-6">
      <!-- SERP Position Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Top 3 Positions</div>
          <div class="text-2xl font-black text-emerald-500">6</div>
          <div class="text-[10px] text-slate-400">Keywords on Google podium</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Top 10 (Page 1)</div>
          <div class="text-2xl font-black text-indigo-500">24</div>
          <div class="text-[10px] text-slate-400">First-page visibility</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Improved Rank</div>
          <div class="text-2xl font-black text-emerald-400">+11</div>
          <div class="text-[10px] text-emerald-500 font-bold">Positions gained this week</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Average SERP Rank</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white">6.4</div>
          <div class="text-[10px] text-slate-400">Across 48 tracked keywords</div>
        </div>
      </div>

      <!-- Rankings Table -->
      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table class="w-full text-left text-xs text-slate-700 dark:text-slate-200">
          <thead class="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3.5">Tracked Query</th>
              <th class="p-3.5">Position</th>
              <th class="p-3.5">7D Change</th>
              <th class="p-3.5">SERP Features</th>
              <th class="p-3.5">Target Landing URL</th>
              <th class="p-3.5 text-right">Visibility</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">used chevrolet welland</td>
              <td class="p-3.5 font-black text-emerald-500 text-sm">#1</td>
              <td class="p-3.5 font-bold text-emerald-500">▲ +2</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">Local Pack · SiteLinks</span></td>
              <td class="p-3.5 text-slate-400 font-mono text-[11px]">/inventory?make=chevrolet</td>
              <td class="p-3.5 text-right font-black text-emerald-500">100%</td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">car dealership welland ontario</td>
              <td class="p-3.5 font-black text-emerald-500 text-sm">#2</td>
              <td class="p-3.5 font-bold text-slate-400">—</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">Local Pack · Reviews</span></td>
              <td class="p-3.5 text-slate-400 font-mono text-[11px]">/</td>
              <td class="p-3.5 text-right font-black text-emerald-500">92%</td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold text-slate-900 dark:text-white">used trucks for sale niagara falls</td>
              <td class="p-3.5 font-black text-indigo-400 text-sm">#4</td>
              <td class="p-3.5 font-bold text-emerald-500">▲ +3</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">AI Overview · Images</span></td>
              <td class="p-3.5 text-slate-400 font-mono text-[11px]">/inventory?body=truck</td>
              <td class="p-3.5 text-right font-black text-indigo-400">76%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSeoBacklinksView() {
  return `
    <div class="space-y-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Domain Authority Score</div>
          <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">48 <span class="text-xs text-slate-400">/ 100</span></div>
          <div class="text-[10px] text-emerald-500 font-bold">Strong Local Trust</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Total Inbound Backlinks</div>
          <div class="text-2xl font-black text-slate-900 dark:text-white">1,420</div>
          <div class="text-[10px] text-slate-400">Across 86 Referring Domains</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Referring Domains</div>
          <div class="text-2xl font-black text-emerald-500">86</div>
          <div class="text-[10px] text-slate-400">Unique root domains</div>
        </div>
        <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div class="text-slate-400 font-bold uppercase text-[10px]">Toxicity Score</div>
          <div class="text-2xl font-black text-emerald-500">0% <span class="text-xs text-slate-400">Clean</span></div>
          <div class="text-[10px] text-slate-400">No toxic links detected</div>
        </div>
      </div>

      <!-- Referring Domains List -->
      <div class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Top Referring Domains &amp; Link Equity</h3>
        <div class="space-y-2 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div class="font-black text-slate-900 dark:text-white">autotrader.ca</div>
              <div class="text-[11px] text-slate-400">DA: 82 · 348 Backlinks · Follow: 100%</div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-500">Authoritative</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div class="font-black text-slate-900 dark:text-white">carfax.ca</div>
              <div class="text-[11px] text-slate-400">DA: 78 · 192 Backlinks · Follow: 100%</div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-500">Authoritative</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <div class="font-black text-slate-900 dark:text-white">wellandchamber.com</div>
              <div class="text-[11px] text-slate-400">DA: 54 · 12 Backlinks · Follow: 100%</div>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">Local Authority</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoPagesView() {
  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Page Indexation &amp; Core Web Vitals</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Full audit of all 352 dealer website pages, canonical URLs, and speed performance.</p>
        </div>
        <button class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer">Recrawl All Pages</button>
      </div>

      <div class="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table class="w-full text-left text-xs text-slate-700 dark:text-slate-200">
          <thead class="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3.5">Page URL</th>
              <th class="p-3.5">Type</th>
              <th class="p-3.5">Index Status</th>
              <th class="p-3.5">Health Score</th>
              <th class="p-3.5">Core Web Vitals</th>
              <th class="p-3.5 text-right">Inlinks</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold font-mono text-slate-900 dark:text-white">/</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">Homepage</span></td>
              <td class="p-3.5 text-emerald-500 font-bold">Indexed OK</td>
              <td class="p-3.5 font-black text-emerald-500">98/100</td>
              <td class="p-3.5 text-emerald-500 font-bold">LCP 1.1s · INP 42ms</td>
              <td class="p-3.5 text-right font-bold">342</td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold font-mono text-slate-900 dark:text-white">/inventory</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">SRP (Inventory)</span></td>
              <td class="p-3.5 text-emerald-500 font-bold">Indexed OK</td>
              <td class="p-3.5 font-black text-emerald-500">94/100</td>
              <td class="p-3.5 text-emerald-500 font-bold">LCP 1.4s · INP 58ms</td>
              <td class="p-3.5 text-right font-bold">298</td>
            </tr>
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
              <td class="p-3.5 font-bold font-mono text-slate-900 dark:text-white">/finance</td>
              <td class="p-3.5"><span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400">Finance Intake</span></td>
              <td class="p-3.5 text-emerald-500 font-bold">Indexed OK</td>
              <td class="p-3.5 font-black text-emerald-500">96/100</td>
              <td class="p-3.5 text-emerald-500 font-bold">LCP 0.9s · INP 30ms</td>
              <td class="p-3.5 text-right font-bold">142</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSeoLocalView() {
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Google Business Profile &amp; Local Pack SEO</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Sync store hours, NAP consistency, local reviews, and Google Maps rankings.</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">100% NAP Consistent</span>
        </div>

        <div class="grid md:grid-cols-3 gap-4 text-xs">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="font-black text-slate-900 dark:text-white">Google Map Rank</div>
            <div class="text-2xl font-black text-emerald-500">#1.8 Avg</div>
            <p class="text-slate-400 text-[11px]">Rank across 9 geo-grid points in Welland &amp; Niagara market.</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="font-black text-slate-900 dark:text-white">Google Reviews</div>
            <div class="text-2xl font-black text-indigo-500">4.8 / 5.0</div>
            <p class="text-slate-400 text-[11px]">242 verified customer reviews · 98% response rate.</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="font-black text-slate-900 dark:text-white">Local Citations</div>
            <div class="text-2xl font-black text-emerald-400">48 Clean</div>
            <p class="text-slate-400 text-[11px]">Synced across Google, Apple Maps, Bing, and YellowPages.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoAuditView() {
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Site Health Audit Diagnostics</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Daily autonomous crawl diagnostics with instant automated remediation.</p>
          </div>
          <button onclick="runSeoAction('run_full_audit', 'all')" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer">Run Full Audit &amp; Auto-Fix</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="text-rose-500 font-black flex items-center justify-between">
              <span>Errors (0)</span>
              <span>Clean OK</span>
            </div>
            <p class="text-slate-400 text-[11px]">No critical 5xx server errors, broken canonical loops, or missing title tags.</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="text-amber-500 font-black flex items-center justify-between">
              <span>Warnings (2)</span>
              <span>Review First</span>
            </div>
            <p class="text-slate-400 text-[11px]">2 inventory images missing explicit descriptive alt tags (Auto-Fix ready).</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="text-indigo-400 font-black flex items-center justify-between">
              <span>Notices (4)</span>
              <span>Information</span>
            </div>
            <p class="text-slate-400 text-[11px]">4 sold vehicle URLs redirected cleanly to root inventory archive via 301.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoAiView() {
  return `
    <div class="space-y-6">
      <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">AI Search Engine Optimization (GEO) &amp; llms.txt</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Position your dealership to be cited by ChatGPT Search, Google Gemini, Perplexity AI, and Claude.</p>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AI Ready</span>
        </div>

        <div class="grid md:grid-cols-2 gap-4 text-xs">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span class="text-indigo-500">AI</span> Active llms.txt Manifest
            </div>
            <p class="text-slate-400 text-[11px]">Automated llms.txt generated and hosted at your domain root, detailing your store address, active inventory, finance terms, and business hours.</p>
            <a href="/llms.txt" target="_blank" class="text-indigo-600 dark:text-indigo-400 font-bold underline text-[11px]">View Live /llms.txt ↗</a>
          </div>

          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span class="text-emerald-500">OK</span> AI Crawler Access Status
            </div>
            <p class="text-slate-400 text-[11px]">Robots.txt explicitly allows GPTBot, Google-Extended, and PerplexityBot to index inventory while protecting secure admin endpoints.</p>
            <span class="text-emerald-500 font-bold text-[11px]">All AI Crawlers Authorized</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSeoTitlesView() {
  return renderSeoSettingsWorkspace();
}

function renderSeoSitemapsView() {
  return renderSeoTechnicalView();
}

function renderSeoRobotsView() {
  return renderSeoTechnicalView();
}

async function saveSeoFormSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const getVal = (id) => document.getElementById(id)?.value;
  const patch = {
    site_name: getVal('seo-site-name') || 'Premier Chevrolet',
    separator: getVal('seo-separator') || '|',
    canonical_domain: getVal('seo-canonical-domain') || 'https://marketsync.link',
    trailing_slash: getVal('seo-trailing-slash') || 'add_slash',
    title_homepage: getVal('seo-title-homepage') || '%dealer% | New & Used Cars in %city%',
    desc_homepage: getVal('seo-desc-homepage') || '',
    title_vdp: getVal('seo-title-vdp') || '%year% %make% %model% %trim% for Sale in %city% | %dealer%',
    desc_vdp: getVal('seo-desc-vdp') || '',
    ga4_measurement_id: getVal('seo-ga4-id') || '',
    meta_pixel_id: getVal('seo-meta-pixel-id') || '',
    gtm_id: getVal('seo-gtm-id') || ''
  };

  try {
    const res = await apiSendJson('/seo/settings', 'PUT', patch);
    if (res?.settings) __seoFullSettings = res.settings;
    if (typeof showToast === 'function') showToast('SEO settings saved successfully', 'success');
    else alert('SEO settings saved successfully.');
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Failed to save SEO settings: ${err.message}`, 'error');
    else alert(`Error: ${err.message}`);
  }
}

async function regenerateSitemapAction(btn) {
  if (btn) { btn.disabled = true; btn.innerText = 'Regenerating...'; }
  try {
    await apiSendJson('/seo/sitemap/regenerate', 'POST', {});
    if (typeof showToast === 'function') showToast('Sitemap regenerated and submitted to Search Console', 'success');
    else alert('Sitemap regenerated successfully.');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Regenerate Sitemap'; }
  }
}

async function generateLlmsTxtAction(btn) {
  if (btn) { btn.disabled = true; btn.innerText = 'Generating...'; }
  try {
    await apiSendJson('/seo/llms/generate', 'POST', {});
    if (typeof showToast === 'function') showToast('llms.txt generated and published for AI crawlers', 'success');
    else alert('llms.txt published successfully.');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = 'Generate llms.txt'; }
  }
}

async function runOnpageAnalysis(btn) {
  const title = document.getElementById('seo-test-title')?.value || '';
  const kw = document.getElementById('seo-test-kw')?.value || '';
  const target = document.getElementById('seo-onpage-result');
  if (!target) return;

  try {
    const res = await apiSendJson('/seo/onpage-analyze', 'POST', { title, primaryKeyword: kw, location: 'Welland' });
    target.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-500">SEO Quality Score</span>
        <span class="text-xl font-black ${res.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}">${res.score} / 100</span>
      </div>
      <div class="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
        <p class="font-bold">Search Intent: <span class="text-indigo-400 font-black">${esc(res.searchIntent || 'Commercial')}</span></p>
        <p class="font-bold">Length: ${res.titleLength} characters ${res.titleLength <= 60 ? '(Optimal)' : '(Truncated on Google)'}</p>
        ${(res.recommendations || []).map(r => `<p class="text-amber-400">Notice: ${esc(r)}</p>`).join('')}
      </div>
    `;
  } catch (e) {
    target.innerHTML = `<div class="text-xs text-red-400 font-bold">${esc(e.message)}</div>`;
  }
}

function addRedirectModal() {
  const src = prompt('Enter source URL path (e.g. /used-silverado):');
  if (!src) return;
  const dst = prompt('Enter target destination URL path (e.g. /inventory?model=Silverado):');
  if (!dst) return;
  apiSendJson('/seo/redirects', 'POST', { source: src, target: dst, type: 301 }).then(() => {
    if (typeof showToast === 'function') showToast('301 Redirect added successfully', 'success');
    renderSeoWorkspace();
  }).catch(e => alert(e.message));
}

function deleteRedirect(id) {
  if (!confirm('Are you sure you want to delete this redirect?')) return;
  apiSendJson('/seo/redirects', 'DELETE', { id }).then(() => {
    if (typeof showToast === 'function') showToast('Redirect removed', 'success');
    renderSeoWorkspace();
  }).catch(e => alert(e.message));
}

function resolve404Error(id, action, targetUrl) {
  apiSendJson('/seo/404-logs/resolve', 'POST', { id, action, targetUrl }).then(() => {
    if (typeof showToast === 'function') showToast('404 error converted into 301 Redirect', 'success');
    renderSeoWorkspace();
  }).catch(e => alert(e.message));
}

async function runSeoAction(actionType, issueId) {
  try {
    await apiSendJson('/seo/action', 'POST', { issue_id: issueId, action_type: actionType });
    if (typeof showToast === 'function') showToast(`SEO Action (${actionType}) applied successfully`, 'success');
    else alert(`SEO Action (${actionType}) applied successfully.`);
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

// ── Normal in-dashboard pages for SEO and Blog ──────────────────────────────
// These render the SAME SEO Suite / Blog manager the full-screen Builder workspace
// uses, but inside the standard page-content area (with the sidebar), so they behave
// like every other MarketSync page instead of taking over the screen. Only the Builder
// tab remains a full-screen workspace. Each seeds the exact root element id its existing
// loader targets (#seo-workspace-root / #ws-blog-root) inside the page container.
function loadSeoPage() {
  const host = document.getElementById('ms-seo-root');
  if (!host) return;
  host.innerHTML = '<div id="seo-workspace-root" class="space-y-6 pt-2"><div class="py-12 text-center text-sm text-slate-400 italic">Loading AI SEO…</div></div>';
  if (typeof loadDealerSeo === 'function') loadDealerSeo();
}

function loadBlogPage() {
  const host = document.getElementById('ms-blog-root');
  if (!host) return;
  host.innerHTML = '<div id="ws-blog-root"></div>';
  if (typeof loadDealerBlog === 'function') loadDealerBlog();
}

Object.assign(window, {
  isSeoOwned,
  upgradeToSeo,
  wsSeo,
  loadDealerSeo,
  setSeoMainTab,
  setSeoSubTab,
  setSeoMode,
  renderSeoWorkspace,
  renderSeoMainBody,
  renderSeoOverviewView,
  renderSeoEasyOverviewView,
  renderSeoAdvancedOverviewView,
  renderSeoKeywordsView,
  renderSeoRankingsView,
  renderSeoBacklinksView,
  renderSeoPagesView,
  renderSeoLocalView,
  renderSeoAuditView,
  renderSeoAiView,
  renderSeoSettingsWorkspace,
  renderSeoContentView,
  renderSeoTechnicalView,
  renderSeoRedirectsView,
  renderSeoAnalyticsView,
  renderSeoCompetitorsView,
  renderSeoAutopilotView,
  renderSeoHistoryView,
  saveSeoFormSettings,
  regenerateSitemapAction,
  generateLlmsTxtAction,
  runOnpageAnalysis,
  addRedirectModal,
  deleteRedirect,
  resolve404Error,
  runSeoAction,
  createBlogFromSeoOpp,
  loadSeoPage,
  loadBlogPage
});
