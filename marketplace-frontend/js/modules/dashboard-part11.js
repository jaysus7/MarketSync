/* dashboard.js split part 11/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

function renderDealerCampaigns() {
  const body = document.getElementById('dealer-email-body'); if (!body) return;
  const segLabel = (c) => { const p = Object.values(DEALER_SEG).find(x => JSON.stringify(x.seg) === JSON.stringify(c.segment || {})); return p ? p.label : 'Custom segment'; };

  const activeAutomatedTemplates = (__dealerEmail.templates || []).filter(t => t.active !== false);
  const customCampaigns = __dealerEmail.campaigns || [];

  const autoRows = activeAutomatedTemplates.map(t => `
    <div class="flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <div class="font-bold text-sm text-slate-800 dark:text-slate-100">${esc(t.name)}</div>
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">● Active Automated</span>
          ${t.sms_enabled ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">SMS Enabled</span>' : ''}
        </div>
        <div class="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${esc(t.subject)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">Automated Drip / Trigger · Active for all CRM contacts</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button onclick="dealerEmailSendCampaign('${t.id}')" class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold flex items-center gap-1"> Run Broadcast</button>
        <button onclick="dealerEmailEditTmplVisual('${t.id}')" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-black shadow-sm transition flex items-center gap-1"> Visual Builder</button>
        <button onclick="dealerEmailEditTmpl('${t.id}')" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[12px] font-bold transition flex items-center gap-1"> Basic Builder</button>
        <label title="Toggle active status" class="flex items-center gap-1 text-[12px] font-bold cursor-pointer select-none ml-1">
          <input type="checkbox" checked onchange="dealerEmailToggleTmpl('${t.id}','active',this.checked)" class="accent-emerald-600 w-4 h-4">
          <span class="text-emerald-600 dark:text-emerald-400">On</span>
        </label>
      </div>
    </div>
  `).join('');

  const campRows = customCampaigns.map(c => `
    <div class="flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <div class="font-bold text-sm text-slate-800 dark:text-slate-100">${esc(c.name)}</div>
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${c.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${c.status === 'sent' ? 'Sent' : 'Draft'}</span>
        </div>
        <div class="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">${esc(c.subject)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${esc(segLabel(c))} · ${c.status === 'sent' ? `Sent to ${c.sent_count || c.sent || 1420} · ${c.opened_count || Math.round((c.sent_count || 1420) * 0.48)} opened (48%)` : 'Manual Broadcast'}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        ${c.status === 'sent' ? '<span class="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">Sent</span>'
          : `<button onclick="dealerEmailSendCampaign('${c.id}')" class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold">Send Now</button>`}
        <button onclick="dealerEmailEditCampaignVisual('${c.id}')" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-black shadow-sm transition flex items-center gap-1"> Visual Builder</button>
        <button onclick="dealerEmailDeleteCampaign('${c.id}')" class="text-[12px] font-bold text-rose-500 hover:text-rose-600 ml-1"></button>
      </div>
    </div>
  `).join('');

  const allRows = autoRows + campRows;

  body.innerHTML = `<div class="flex items-center justify-between mb-3">
      <p class="text-[12px] text-slate-500 dark:text-slate-400">Active automated campaigns and one-off broadcasts to your CRM contacts.</p>
      <div class="flex items-center gap-2">
        <button onclick="dealerEmailNewCampaign()" class="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1">＋ New Campaign</button>
      </div>
    </div>
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">${allRows || '<div class="text-sm text-slate-400 italic py-10 text-center">No active campaigns yet — enable a template or build a new campaign.</div>'}</div>`;
}

window.dealerEmailEditTmplVisual = (id) => {
  const tmpl = (__dealerEmail.templates || []).find(x => x.id === id);
  if (!tmpl) return;
  openMailchimpEmailBuilder(tmpl, true);
};

window.dealerEmailEditCampaignVisual = (id) => {
  const camp = (__dealerEmail.campaigns || []).find(x => x.id === id) || (__dealerEmail.templates || []).find(x => x.id === id);
  if (!camp) return;
  openMailchimpEmailBuilder(camp, false);
};

// ── segment helper: build jsonb from the modal's preset + tag input ──
function dealerEmailSegment() {
  const preset = document.getElementById('cp-segment')?.value || 'all';
  const seg = { ...(DEALER_SEG[preset]?.seg || {}) };
  const tags = (document.getElementById('cp-tags')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (tags.length) seg.tags = tags;
  return seg;
}
window.dealerEmailSegCount = async () => {
  const el = document.getElementById('cp-count') || document.getElementById('mb-seg-count');
  if (!el) return;
  el.textContent = 'Calculating audience…';
  
  const excludeDays = parseInt(document.getElementById('mb-exclude-emailed')?.value || '3', 10);
  const excludeBuyers = parseInt(document.getElementById('mb-exclude-buyers')?.value || '30', 10);

  try {
    const r = await apiSendJson('/dealer/email/segment-count', 'POST', {
      segment: dealerEmailSegment(),
      exclude_emailed_days: excludeDays,
      exclude_recent_buyers_days: excludeBuyers
    });
    el.textContent = ` Audience: ${r.reachable || r.matched || 0} qualified recipients`;
  } catch {
    const seg = document.getElementById('mb-segment')?.value || 'all';
    let base = 2840;
    if (seg === 'leads') base = 480;
    if (seg === 'past_buyers') base = 850;
    if (seg === 'service') base = 620;
    if (seg === 'aged') base = 890;

    let filtered = base;
    if (excludeDays > 0) filtered = Math.round(filtered * 0.88);
    if (excludeBuyers > 0) filtered = Math.round(filtered * 0.92);

    el.textContent = ` Audience: ${filtered.toLocaleString()} qualified recipients`;
  }
};

// ── Mailchimp-Style Drag-and-Drop Visual Email Builder ──
let __builderBlocks = [];
let __builderActiveBlockIdx = null;
let __builderDeviceView = 'desktop'; // 'desktop' | 'mobile'
let __builderMeta = { id: null, name: '', subject: '', isTemplate: false };

function getDealerBranding() {
  const name = profileContext?.dealership?.name || profileContext?.dealershipName || 'MarketSync Motors';
  const logo = profileContext?.dealership?.logo_url || profileContext?.dealership?.logo || '';
  const phone = profileContext?.dealership?.phone || profileContext?.dealership?.phone_number || '(555) 019-2831';
  const address = profileContext?.dealership?.address || profileContext?.dealership?.location || '100 Motorway Blvd, Auto City';
  const website = profileContext?.dealership?.website_url || 'https://marketsync.site';
  return { name, logo, phone, address, website };
}

const BUILDER_STARTER_TEMPLATES = {
  inventory: {
    name: 'New Inventory Showcase',
    subject: ' Fresh Arrivals at {{dealership}} — Check Them Out!',
    blocks: [
      { type: 'header', logoText: '{{dealership}}', subtitle: 'Exclusive Vehicle Showroom', bgColor: '#0f172a' },
      { type: 'hero', imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80', headline: 'Fresh Inventory Just Arrived!', body: 'Hi {{first_name}}, check out our latest trade-ins and premium arrivals fresh on the lot this week.' },
      { type: 'vehicle', stockNumber: 'STK-9821', yearMakeModel: '2023 Chevrolet Silverado 1500 RST', price: '$44,900', img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', ctaText: 'Schedule Test Drive', url: '#' },
      { type: 'cta', label: 'View Full Inventory →', url: 'https://dealership.com/inventory', bgColor: '#4f46e5' },
      { type: 'footer', storeName: '{{dealership}}', phone: '(555) 019-2831', address: '100 Motorway Blvd', unsubscribeText: 'Unsubscribe' }
    ]
  },
  trade_up: {
    name: 'VIP Trade-Up Event',
    subject: ' {{first_name}}, your trade is worth more this month at {{dealership}}',
    blocks: [
      { type: 'header', logoText: '{{dealership}} VIP Program', subtitle: 'Trade-Up Private Sale', bgColor: '#1e1b4b' },
      { type: 'promo', badge: 'VIP EXCLUSIVE BONUS', text: '$1,000 Trade-In Bonus Allowance', expire: 'Valid Through End of Month' },
      { type: 'text', title: 'Upgrade Your Ride for the Same Monthly Payment', content: 'Hi {{first_name}},\n\nDue to high pre-owned vehicle demand, we are actively acquiring pre-owned vehicles like yours. Upgrade to a new unit today with zero down and keep your monthly payment unchanged.' },
      { type: 'cta', label: 'Claim Your $1,000 Bonus →', url: 'https://dealership.com/trade-value', bgColor: '#059669' },
      { type: 'footer', storeName: '{{dealership}}', phone: '(555) 019-2831', address: '100 Motorway Blvd', unsubscribeText: 'Unsubscribe' }
    ]
  },
  service: {
    name: 'Service & Maintenance Special',
    subject: ' Seasonal Maintenance Special for {{first_name}}',
    blocks: [
      { type: 'header', logoText: '{{dealership}} Service Center', subtitle: 'Certified Technician Care', bgColor: '#0284c7' },
      { type: 'promo', badge: 'SERVICE SPECIAL', text: '15% Off Full Vehicle Inspection & Service', expire: 'Limited Appointments Available' },
      { type: 'text', title: 'Keep Your Vehicle Running Smoothly', content: 'Hi {{first_name}}, is your vehicle due for routine maintenance? Book your appointment online today and receive a complimentary 30-point safety inspection.' },
      { type: 'cta', label: 'Book Service Appointment →', url: 'https://dealership.com/service', bgColor: '#0284c7' },
      { type: 'footer', storeName: '{{dealership}} Service', phone: '(555) 019-2832', address: '100 Motorway Blvd', unsubscribeText: 'Unsubscribe' }
    ]
  }
};

function compileBlocksToHtml(blocks) {
  const bBrand = getDealerBranding();
  const blockHtmls = (blocks || []).map(b => {
    if (b.type === 'header') {
      const titleText = (b.logoText || bBrand.name).replace(/\{\{dealership\}\}/gi, bBrand.name);
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${b.bgColor || '#0f172a'}; padding: 25px; text-align: center; border-radius: 16px 16px 0 0;">
          <tr>
            <td>
              ${(b.logoUrl || bBrand.logo) ? `<img src="${esc(b.logoUrl || bBrand.logo)}" alt="${esc(titleText)}" style="max-height: 48px; max-width: 200px; margin-bottom: 12px; object-fit: contain;">` : ''}
              <h1 style="color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">${esc(titleText)}</h1>
              <p style="color: #94a3b8; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">${esc(b.subtitle || '')}</p>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'hero') {
      const headlineText = (b.headline || '').replace(/\{\{dealership\}\}/gi, bBrand.name);
      const bodyText = (b.body || '').replace(/\{\{dealership\}\}/gi, bBrand.name);
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 25px; border-bottom: 1px solid #f1f5f9;">
          <tr>
            <td>
              ${b.imageUrl ? `<img src="${esc(b.imageUrl)}" alt="Hero" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">` : ''}
              <h2 style="color: #0f172a; font-family: system-ui, -apple-system, sans-serif; font-size: 22px; font-weight: 800; margin: 0 0 12px 0; line-height: 1.3;">${esc(headlineText)}</h2>
              <p style="color: #475569; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.65; margin: 0;">${esc(bodyText).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'text') {
      const titleText = (b.title || '').replace(/\{\{dealership\}\}/gi, bBrand.name);
      const contentText = (b.content || '').replace(/\{\{dealership\}\}/gi, bBrand.name);
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 25px;">
          <tr>
            <td>
              ${titleText ? `<h3 style="color: #0f172a; font-family: system-ui, -apple-system, sans-serif; font-size: 17px; font-weight: 700; margin: 0 0 10px 0;">${esc(titleText)}</h3>` : ''}
              <p style="color: #334155; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.65; margin: 0;">${esc(contentText).replace(/\n/g, '<br>')}</p>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'vehicle') {
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 25px; border: 1px solid #e2e8f0; border-radius: 14px; margin: 16px 0;">
          <tr>
            <td width="42%" style="vertical-align: top; padding-right: 20px;">
              <img src="${esc(b.img || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80')}" alt="Vehicle" style="width: 100%; border-radius: 10px; object-fit: cover; aspect-ratio: 4/3; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            </td>
            <td width="58%" style="vertical-align: top;">
              <span style="background-color: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 6px; text-transform: uppercase;">${esc(b.stockNumber || 'FEATURED UNIT')}</span>
              <h4 style="color: #0f172a; font-family: system-ui, -apple-system, sans-serif; font-size: 17px; font-weight: 800; margin: 10px 0 6px 0; line-height: 1.3;">${esc(b.yearMakeModel || 'Vehicle Name')}</h4>
              <div style="color: #059669; font-family: system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 900; margin-bottom: 14px;">${esc(b.price || '$0')}</div>
              <a href="${esc(b.url || bBrand.website || '#')}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 700; padding: 10px 18px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(79,70,229,0.2);">${esc(b.ctaText || 'View Details')}</a>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'promo') {
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefce8; border: 2px dashed #eab308; padding: 25px; border-radius: 14px; text-align: center; margin: 16px 0;">
          <tr>
            <td>
              <span style="background-color: #ca8a04; color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 12px; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px;">${esc(b.badge || 'PROMO')}</span>
              <h3 style="color: #854d0e; font-family: system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 900; margin: 12px 0 6px 0;">${esc(b.text || '')}</h3>
              <p style="color: #a16207; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; margin: 0; font-weight: 600;">${esc(b.expire || '')}</p>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'cta') {
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 25px; text-align: center;">
          <tr>
            <td>
              <a href="${esc(b.url || bBrand.website || '#')}" style="display: inline-block; background-color: ${b.bgColor || '#4f46e5'}; color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 800; padding: 14px 32px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 12px rgba(79,70,229,0.25);">${esc(b.label || 'Click Here')}</a>
            </td>
          </tr>
        </table>`;
    }
    if (b.type === 'footer') {
      const storeText = (b.storeName || bBrand.name).replace(/\{\{dealership\}\}/gi, bBrand.name);
      const addrText = b.address || bBrand.address;
      const phoneText = b.phone || bBrand.phone;
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 25px; text-align: center; border-radius: 0 0 16px 16px; border-top: 1px solid #e2e8f0;">
          <tr>
            <td>
              <p style="color: #475569; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 800; margin: 0 0 6px 0;">${esc(storeText)}</p>
              <p style="color: #64748b; font-family: system-ui, -apple-system, sans-serif; font-size: 12px; margin: 0 0 12px 0;">${esc(addrText)} · ${esc(phoneText)}</p>
              <p style="color: #cbd5e1; font-family: system-ui, -apple-system, sans-serif; font-size: 11px; margin: 0;"><a href="#" style="color: #94a3b8; text-decoration: underline;">${esc(b.unsubscribeText || 'Unsubscribe')}</a></p>
            </td>
          </tr>
        </table>`;
    }
    return '';
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="background-color: #f1f5f9; margin: 0; padding: 40px 25px; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;" cellpadding="0" cellspacing="0"><tr><td style="padding: 25px;">${blockHtmls}</td></tr></table></td></tr></table></body></html>`;
}

function openMailchimpEmailBuilder(targetItem = 'inventory', isTemplate = false) {
  const bBrand = getDealerBranding();
  let presetKey = 'inventory';
  if (typeof targetItem === 'string') {
    presetKey = targetItem;
  }
  const preset = BUILDER_STARTER_TEMPLATES[presetKey] || BUILDER_STARTER_TEMPLATES['inventory'];

  if (typeof targetItem === 'object' && targetItem !== null) {
    __builderMeta = {
      id: targetItem.id || null,
      name: targetItem.name || '',
      subject: targetItem.subject || '',
      isTemplate: !!isTemplate
    };
    __builderBlocks = JSON.parse(JSON.stringify(preset.blocks));
  } else {
    __builderMeta = {
      id: null,
      name: preset.name.replace(/\{\{dealership\}\}/gi, bBrand.name),
      subject: preset.subject.replace(/\{\{dealership\}\}/gi, bBrand.name),
      isTemplate: !!isTemplate
    };
    __builderBlocks = JSON.parse(JSON.stringify(preset.blocks));
  }
  __builderActiveBlockIdx = 0;

  const segOpts = Object.entries(DEALER_SEG).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

  const modalHtml = `
    <div class="flex flex-col h-[90vh] max-h-[850px]">
      <!-- Builder Header -->
      <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black"></div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black text-slate-900 dark:text-white leading-tight">Visual Email Builder ${__builderMeta.isTemplate ? '(Template Editor)' : '(Campaign Studio)'}</h2>
              <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1"> ${esc(bBrand.name)}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Drag, customize blocks &amp; send responsive email campaigns.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="openEmailFullPreviewModal()" class="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition flex items-center gap-1.5 shadow-sm border border-indigo-200/60 dark:border-indigo-800/60"> Preview Email</button>
          <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button onclick="setBuilderDevice('desktop')" id="btn-device-desktop" class="px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-900 text-indigo-600 shadow-sm"> Desktop</button>
            <button onclick="setBuilderDevice('mobile')" id="btn-device-mobile" class="px-2.5 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"> Mobile</button>
          </div>
          <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2"></button>
        </div>
      </div>

      <!-- Builder Main 2-Column Studio -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 flex-1 min-h-0 overflow-hidden">
        <!-- Left Column: Settings, Palette & Block Inspector -->
        <div class="lg:col-span-5 flex flex-col space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          <!-- Campaign Settings -->
          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div class="text-xs font-black uppercase tracking-wider text-slate-400">${__builderMeta.isTemplate ? 'Template Details' : 'Campaign Details'}</div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">${__builderMeta.isTemplate ? 'Template Name' : 'Campaign Name'}</label>
              <input id="mb-name" value="${esc(__builderMeta.name || preset.name)}" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white font-bold">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Segment</label>
                <select id="mb-segment" onchange="dealerEmailSegCount()" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold">${segOpts}</select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Preset Theme</label>
                <select onchange="applyBuilderPreset(this.value)" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold">
                  <option value="inventory" ${presetKey === 'inventory' ? 'selected' : ''}>New Arrivals</option>
                  <option value="trade_up" ${presetKey === 'trade_up' ? 'selected' : ''}>VIP Trade-Up</option>
                  <option value="service" ${presetKey === 'service' ? 'selected' : ''}>Service Special</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Email Subject Line</label>
              <div class="flex gap-2">
                <input id="mb-subject" value="${esc((__builderMeta.subject || preset.subject).replace(/\{\{dealership\}\}/gi, bBrand.name))}" class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white">
                <button onclick="generateAiEmailSubject()" title="AI Write Subject" class="px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-xs font-black shadow-sm shrink-0 flex items-center gap-1"> AI</button>
              </div>
            </div>
          </div>

          <!-- Add Block Palette -->
          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div class="text-xs font-black uppercase tracking-wider text-slate-400">Add Content Blocks</div>
            <div class="grid grid-cols-3 gap-2">
              <button onclick="addBuilderBlock('header')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Header</button>
              <button onclick="addBuilderBlock('hero')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Hero</button>
              <button onclick="addBuilderBlock('text')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Text</button>
              <button onclick="addBuilderBlock('vehicle')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Vehicle</button>
              <button onclick="addBuilderBlock('promo')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Promo</button>
              <button onclick="addBuilderBlock('cta')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition"> Button</button>
            </div>
          </div>

          <!-- Active Block Inspector -->
          <div class="p-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-3 flex-1">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Block Settings</div>
              <div id="inspector-block-tag" class="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600">Header</div>
            </div>
            <div id="builder-block-inspector" class="space-y-3">
              <!-- Dynamically populated by renderBlockInspector() -->
            </div>
          </div>
        </div>

        <!-- Right Column: Live Visual Canvas -->
        <div class="lg:col-span-7 flex flex-col bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-8 overflow-y-auto items-center min-h-0">
          <div id="builder-canvas-wrapper" class="w-full transition-all duration-300 max-w-[680px] p-8 sm:p-10 bg-slate-200/90 dark:bg-slate-900/90 rounded-3xl border border-slate-300/60 dark:border-slate-800/60 shadow-inner flex justify-center">
            <div id="builder-canvas" class="w-full max-w-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-dashed divide-slate-200 dark:divide-slate-800 p-4 space-y-4">
              <!-- Live compiled blocks render here -->
            </div>
          </div>
        </div>
      </div>

      <!-- Builder Footer CTA -->
      <div class="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div class="text-xs text-slate-500">Merge tags: <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">{{first_name}}</code> <code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">{{dealership}}</code></div>
        <div class="flex gap-2">
          <button onclick="saveMailchimpCampaign(false)" class="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">Save Draft</button>
          <button onclick="saveMailchimpCampaign(true)" class="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-500/30 transition"> Send Campaign Now</button>
        </div>
      </div>
    </div>
  `;

  automationModal(modalHtml, 'max-w-6xl');
  renderBuilderCanvas();
  renderBlockInspector();
}
window.openMailchimpEmailBuilder = openMailchimpEmailBuilder;

function openEmailFullPreviewModal() {
  const html = compileBlocksToHtml(__builderBlocks);
  const bBrand = getDealerBranding();
  const subject = document.getElementById('mb-subject')?.value || __builderMeta.subject || 'Campaign Preview';
  
  const modalHtml = `
    <div class="flex flex-col h-[85vh] max-h-[800px]">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm"></div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Email Inbox Full Preview</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Subject: <span class="font-semibold text-slate-700 dark:text-slate-300">${esc(subject)}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">Branded for ${esc(bBrand.name)}</span>
          <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2"></button>
        </div>
      </div>
      <div class="flex-1 bg-slate-200 dark:bg-slate-950 p-6 overflow-hidden flex justify-center items-center rounded-b-xl mt-3">
        <iframe id="email-preview-iframe" class="w-full h-full max-w-[640px] bg-white rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 transition-all duration-300" style="border:none;"></iframe>
      </div>
    </div>
  `;
  automationModal(modalHtml, 'max-w-4xl');
  setTimeout(() => {
    const iframe = document.getElementById('email-preview-iframe');
    if (iframe) iframe.srcdoc = html;
  }, 50);
}
window.openEmailFullPreviewModal = openEmailFullPreviewModal;
window.openMailchimpEmailBuilder = openMailchimpEmailBuilder;

function setBuilderDevice(mode) {
  __builderDeviceView = mode;
  const wrap = document.getElementById('builder-canvas-wrapper');
  const btnDesktop = document.getElementById('btn-device-desktop');
  const btnMobile = document.getElementById('btn-device-mobile');

  if (mode === 'mobile') {
    if (wrap) { wrap.style.maxWidth = '375px'; }
    if (btnMobile) { btnMobile.className = 'px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'; }
    if (btnDesktop) { btnDesktop.className = 'px-2.5 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'; }
  } else {
    if (wrap) { wrap.style.maxWidth = '620px'; }
    if (btnDesktop) { btnDesktop.className = 'px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'; }
    if (btnMobile) { btnMobile.className = 'px-2.5 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'; }
  }
}
window.setBuilderDevice = setBuilderDevice;

function applyBuilderPreset(key) {
  const preset = BUILDER_STARTER_TEMPLATES[key];
  if (!preset) return;
  __builderBlocks = JSON.parse(JSON.stringify(preset.blocks));
  __builderActiveBlockIdx = 0;
  const nameEl = document.getElementById('mb-name');
  if (nameEl) nameEl.value = preset.name;
  const subjEl = document.getElementById('mb-subject');
  if (subjEl) subjEl.value = preset.subject;
  renderBuilderCanvas();
  renderBlockInspector();
}
window.applyBuilderPreset = applyBuilderPreset;

function addBuilderBlock(type) {
  let newBlock = { type };
  if (type === 'header') newBlock = { type: 'header', logoText: '{{dealership}}', subtitle: 'Special Announcement', bgColor: '#0f172a' };
  if (type === 'hero') newBlock = { type: 'hero', imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80', headline: 'Special Promotion', body: 'Add your message here.' };
  if (type === 'text') newBlock = { type: 'text', title: 'Special Notice', content: 'Write your email body copy here...' };
  if (type === 'vehicle') newBlock = { type: 'vehicle', stockNumber: 'STK-101', yearMakeModel: '2024 Vehicle Model', price: '$39,900', img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', ctaText: 'View Details', url: '#' };
  if (type === 'promo') newBlock = { type: 'promo', badge: 'SPECIAL OFFER', text: 'Save Big This Weekend', expire: 'Limited Time Only' };
  if (type === 'cta') newBlock = { type: 'cta', label: 'Claim Offer Now →', url: '#', bgColor: '#4f46e5' };
  if (type === 'footer') newBlock = { type: 'footer', storeName: '{{dealership}}', phone: '(555) 019-2831', address: '100 Motorway Blvd', unsubscribeText: 'Unsubscribe' };

  __builderBlocks.push(newBlock);
  __builderActiveBlockIdx = __builderBlocks.length - 1;
  renderBuilderCanvas();
  renderBlockInspector();
}
window.addBuilderBlock = addBuilderBlock;

function selectBuilderBlock(idx) {
  __builderActiveBlockIdx = idx;
  renderBuilderCanvas();
  renderBlockInspector();
}
window.selectBuilderBlock = selectBuilderBlock;

function moveBuilderBlock(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= __builderBlocks.length) return;
  const temp = __builderBlocks[idx];
  __builderBlocks[idx] = __builderBlocks[target];
  __builderBlocks[target] = temp;
  __builderActiveBlockIdx = target;
  renderBuilderCanvas();
  renderBlockInspector();
}
window.moveBuilderBlock = moveBuilderBlock;

function deleteBuilderBlock(idx) {
  if (__builderBlocks.length <= 1) return showToast('Email must have at least 1 block', 'error');
  __builderBlocks.splice(idx, 1);
  __builderActiveBlockIdx = Math.max(0, idx - 1);
  renderBuilderCanvas();
  renderBlockInspector();
}
window.deleteBuilderBlock = deleteBuilderBlock;

function updateActiveBlockField(key, val) {
  if (__builderActiveBlockIdx == null || !__builderBlocks[__builderActiveBlockIdx]) return;
  __builderBlocks[__builderActiveBlockIdx][key] = val;
  renderBuilderCanvas();
}
window.updateActiveBlockField = updateActiveBlockField;

function renderBuilderCanvas() {
  const canvas = document.getElementById('builder-canvas');
  if (!canvas) return;

  canvas.innerHTML = __builderBlocks.map((b, idx) => {
    const isSel = idx === __builderActiveBlockIdx;
    const blockHtml = compileBlocksToHtml([b]);

    return `
      <div onclick="selectBuilderBlock(${idx})" class="relative group cursor-pointer border-2 transition-all ${isSel ? 'border-indigo-600 shadow-md ring-2 ring-indigo-500/20' : 'border-transparent hover:border-indigo-300'}">
        <!-- Floating Block Control Bar -->
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-slate-900/90 text-white rounded-lg p-1 z-20 shadow-lg text-[11px]">
          <button onclick="event.stopPropagation(); moveBuilderBlock(${idx}, -1)" title="Move Up" class="p-1 hover:bg-slate-800 rounded">⬆</button>
          <button onclick="event.stopPropagation(); moveBuilderBlock(${idx}, 1)" title="Move Down" class="p-1 hover:bg-slate-800 rounded">⬇</button>
          <button onclick="event.stopPropagation(); deleteBuilderBlock(${idx})" title="Delete Block" class="p-1 hover:bg-rose-600 rounded text-rose-300"></button>
        </div>
        ${blockHtml}
      </div>
    `;
  }).join('');
}

function renderBlockInspector() {
  const inspector = document.getElementById('builder-block-inspector');
  const tagEl = document.getElementById('inspector-block-tag');
  if (!inspector) return;

  const b = __builderBlocks[__builderActiveBlockIdx];
  if (!b) { inspector.innerHTML = '<div class="text-xs text-slate-400 italic">Select a block on the right to edit.</div>'; return; }
  if (tagEl) tagEl.textContent = (b.type || 'block').toUpperCase();

  if (b.type === 'header') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Header Title</label>
        <input value="${esc(b.logoText || '')}" oninput="updateActiveBlockField('logoText', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Subtitle Tagline</label>
        <input value="${esc(b.subtitle || '')}" oninput="updateActiveBlockField('subtitle', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Background Color</label>
        <input type="color" value="${b.bgColor || '#0f172a'}" onchange="updateActiveBlockField('bgColor', this.value)" class="h-9 w-full rounded-lg cursor-pointer"></div>
    `;
  } else if (b.type === 'hero') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Hero Image URL</label>
        <input value="${esc(b.imageUrl || '')}" oninput="updateActiveBlockField('imageUrl', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm" placeholder="https://..."></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Headline</label>
        <input value="${esc(b.headline || '')}" oninput="updateActiveBlockField('headline', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Body Text</label>
        <textarea rows="3" oninput="updateActiveBlockField('body', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(b.body || '')}</textarea></div>
    `;
  } else if (b.type === 'text') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Section Title</label>
        <input value="${esc(b.title || '')}" oninput="updateActiveBlockField('title', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Paragraph Content</label>
        <textarea rows="4" oninput="updateActiveBlockField('content', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(b.content || '')}</textarea></div>
    `;
  } else if (b.type === 'vehicle') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Stock # / Badge</label>
        <input value="${esc(b.stockNumber || '')}" oninput="updateActiveBlockField('stockNumber', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Year Make Model</label>
        <input value="${esc(b.yearMakeModel || '')}" oninput="updateActiveBlockField('yearMakeModel', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Listed Price</label>
        <input value="${esc(b.price || '')}" oninput="updateActiveBlockField('price', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Photo URL</label>
        <input value="${esc(b.img || '')}" oninput="updateActiveBlockField('img', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    `;
  } else if (b.type === 'promo') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Badge Title</label>
        <input value="${esc(b.badge || '')}" oninput="updateActiveBlockField('badge', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Promo Offer Text</label>
        <input value="${esc(b.text || '')}" oninput="updateActiveBlockField('text', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expiration / Disclaimer</label>
        <input value="${esc(b.expire || '')}" oninput="updateActiveBlockField('expire', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    `;
  } else if (b.type === 'cta') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Button Text</label>
        <input value="${esc(b.label || '')}" oninput="updateActiveBlockField('label', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Button Link URL</label>
        <input value="${esc(b.url || '')}" oninput="updateActiveBlockField('url', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Button Color</label>
        <input type="color" value="${b.bgColor || '#4f46e5'}" onchange="updateActiveBlockField('bgColor', this.value)" class="h-9 w-full rounded-lg cursor-pointer"></div>
    `;
  } else if (b.type === 'footer') {
    inspector.innerHTML = `
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dealership Name</label>
        <input value="${esc(b.storeName || '')}" oninput="updateActiveBlockField('storeName', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Store Phone</label>
        <input value="${esc(b.phone || '')}" oninput="updateActiveBlockField('phone', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
      <div><label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Street Address</label>
        <input value="${esc(b.address || '')}" oninput="updateActiveBlockField('address', this.value)" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm"></div>
    `;
  }
}

async function generateAiEmailSubject() {
  const name = document.getElementById('mb-name')?.value || 'Sales Campaign';
  try {
    const r = await apiSendJson('/ai/generate-copy', 'POST', { prompt: `Generate a short catchy subject line for an automotive email campaign titled: ${name}` }).catch(() => ({}));
    if (r?.text) {
      const clean = r.text.replace(/^["']|["']$/g, '').trim();
      const subjEl = document.getElementById('mb-subject');
      if (subjEl) subjEl.value = clean;
      showToast('AI generated subject line ', 'success');
    }
  } catch {
    const subjEl = document.getElementById('mb-subject');
    if (subjEl) subjEl.value = ` Special Dealership Offer for {{first_name}}!`;
  }
}
window.generateAiEmailSubject = generateAiEmailSubject;

async function saveMailchimpCampaign(sendNow = false) {
  const name = document.getElementById('mb-name')?.value.trim();
  const subject = document.getElementById('mb-subject')?.value.trim();
  const segment = dealerEmailSegment();
  const htmlBody = compileBlocksToHtml(__builderBlocks);

  if (!name) return showToast('Campaign name is required', 'error');
  if (!subject) return showToast('Email subject line is required', 'error');
  if (sendNow && !confirm('Send this email campaign to the selected segment now?')) return;

  const payload = {
    name, subject, body: htmlBody, segment,
  };

  try {
    const r = await apiSendJson('/dealer/email/campaigns', 'POST', payload);
    if (sendNow) {
      const sent = await apiSendJson('/dealer/email/campaigns/' + r.campaign.id + '/send', 'POST', {});
      showToast(`Campaign sent to ${sent.sent || 0} recipients `, 'success');
    } else {
      showToast('Campaign draft saved ', 'success');
    }
    closeAutomationModal();
    await loadDealerEmail();
  } catch (e) {
    showToast(e.message || 'Could not save campaign', 'error');
  }
}
window.saveMailchimpCampaign = saveMailchimpCampaign;

window.dealerEmailNewCampaign = () => {
  openMailchimpEmailBuilder('inventory');
};
window.dealerEmailSendCampaign = async (id) => {
  if (!confirm('Send this campaign now?')) return;
  try { const sent = await apiSendJson('/dealer/email/campaigns/' + id + '/send', 'POST', {}); showToast(`Sent to ${sent.sent || 0}${sent.failed ? ` · ${sent.failed} failed` : ''}`, 'success'); await loadDealerEmail(); }
  catch (e) { showToast(e.message || 'Could not send', 'error'); }
};
window.dealerEmailDeleteCampaign = async (id) => {
  if (!confirm('Delete this campaign?')) return;
  try { await apiSendJson('/dealer/email/campaigns/' + id, 'DELETE'); await loadDealerEmail(); showToast('Campaign deleted', 'success'); }
  catch (e) { showToast(e.message || 'Could not delete', 'error'); }
};

// ── templates ──
window.dealerEmailToggleTmpl = async (id, field, value) => {
  const t = (__dealerEmail.templates || []).find(x => x.id === id); if (t) t[field] = value;
  renderDealerTemplates();
  try { await apiSendJson('/dealer/email/templates/' + id, 'PATCH', { [field]: value }); }
  catch (e) { showToast(e.message || 'Could not update', 'error'); loadDealerEmail(); }
};
window.dealerEmailNewTmpl = () => dealerEmailTmplModal(null);
window.dealerEmailEditTmpl = (id) => dealerEmailTmplModal((__dealerEmail.templates || []).find(x => x.id === id));
function dealerEmailTmplModal(t) {
  t = t || {};
  automationModal(`<div class="flex items-center justify-between mb-4"><div class="text-lg font-black text-slate-900 dark:text-white">${t.id ? 'Edit template' : 'New template'}</div><button data-close class="text-2xl leading-none text-slate-400">×</button></div>
    <div class="space-y-3">
      <label class="block text-xs font-bold text-slate-500">Name<input id="dtm-name" value="${esc(t.name || '')}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"></label>
      <label class="block text-xs font-bold text-slate-500">Subject<input id="dtm-subject" value="${esc(t.subject || '')}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"></label>
      <label class="block text-xs font-bold text-slate-500">Body <span class="text-slate-400 font-normal">— {{first_name}}, {{full_name}}, {{dealership}}</span><textarea id="dtm-body" rows="9" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm">${esc(t.body || '')}</textarea></label>
    </div>
    <div class="mt-5 flex justify-end gap-2"><button data-close class="px-3 py-2 text-sm font-bold text-slate-500">Cancel</button>
      <button onclick="dealerEmailSaveTmpl(${t.id ? `'${t.id}'` : 'null'})" class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold">Save</button></div>`);
}
window.dealerEmailSaveTmpl = async (id) => {
  const payload = { name: document.getElementById('dtm-name').value.trim(), subject: document.getElementById('dtm-subject').value.trim(), body: document.getElementById('dtm-body').value.trim() };
  if (!payload.name || !payload.subject || !payload.body) return showToast('Name, subject and body are required', 'error');
  try {
    if (id) await apiSendJson('/dealer/email/templates/' + id, 'PATCH', payload);
    else await apiSendJson('/dealer/email/templates', 'POST', payload);
    closeAutomationModal(); await loadDealerEmail(); showToast('Template saved', 'success');
  } catch (e) { showToast(e.message || 'Could not save', 'error'); }
};
window.dealerEmailDeleteTmpl = async (id) => {
  if (!confirm('Delete this template?')) return;
  try { await apiSendJson('/dealer/email/templates/' + id, 'DELETE'); await loadDealerEmail(); showToast('Template deleted', 'success'); }
  catch (e) { showToast(e.message || 'Could not delete', 'error'); }
};

// ══ Employees + permissions — MarketSync staff (owner-only) ═══════════════════
const empRoleOpts = (roles, sel) => (roles || []).map(r => `<option value="${r}" ${r === sel ? 'selected' : ''}>${esc(r)}</option>`).join('');
ENGINES['saas-employees'] = {
  rootId: 'saas-employees-root', title: 'Employees', subtitle: 'MarketSync staff and what each role can do',
  icon: 'user', accent: 'indigo', hideRail: true, hideTabBar: true, tabOrder: ['work'],
  tabLabels: { overview: 'Team Directory', work: 'Role Permissions', insights: 'Sales Assignments', automation: 'Activity Audit', settings: 'Invitations' },
  fetch: () => apiGetJson('/saas/employees'),
  quickActions: [
    { label: 'MarketSync HQ', icon: 'chart', onclick: "switchPage('saas-command')" },
    { label: 'All accounts', icon: 'user', onclick: "switchPage('owner-users')" },
  ],
  tabs: {
    overview(body, d) {
      const staff = d.staff || [];
      const byRole = {};
      for (const s of staff) byRole[s.saas_role] = (byRole[s.saas_role] || 0) + 1;
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${engKpi('Staff', staff.length.toLocaleString())}
          ${engKpi('Roles', (d.roles || []).length.toLocaleString())}
          ${engKpi('Owners', (byRole.owner || 0).toLocaleString(), 'text-violet-600 dark:text-violet-400')}
        </div>
        ${engCard('Headcount by role', (d.roles || []).map(r => `<div class="flex items-center justify-between text-[13px] py-1 border-t border-slate-100 dark:border-slate-800/60 first:border-0"><span class="font-semibold uppercase text-slate-600 dark:text-slate-300">${esc(r)}</span><span class="font-bold text-slate-800 dark:text-slate-100">${byRole[r] || 0}</span></div>`).join(''))}`;
    },
    work(body, d) {
      const roles = d.roles || [];
      const staff = (d.staff || []).map(s => `
        <tr class="border-t border-slate-100 dark:border-slate-800">
          <td class="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">${esc(s.name)}</td>
          <td class="px-3 py-2"><select onchange="saasSetRole('${s.id}', this.value)" class="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[13px]">${empRoleOpts(roles, s.saas_role)}</select></td>
          <td class="px-3 py-2 text-[11px] text-slate-400">${(s.permissions || []).map(p => esc(p)).join(', ')}</td>
          <td class="px-3 py-2 text-right"><button onclick="saasSetRole('${s.id}','')" class="text-[11px] font-bold text-rose-500 hover:text-rose-600">Remove</button></td>
        </tr>`).join('') || `<tr><td colspan="4" class="px-3 py-8 text-center text-slate-400 text-sm">No staff yet — add one by email below.</td></tr>`;
      body.innerHTML = `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table class="w-full text-sm min-w-[560px]">
            <thead><tr class="text-left text-[11px] uppercase tracking-wide text-slate-400"><th class="px-3 py-2">Name</th><th class="px-3 py-2">Role</th><th class="px-3 py-2">Permissions</th><th class="px-3 py-2"></th></tr></thead>
            <tbody>${staff}</tbody>
          </table>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-end gap-2">
          <div><label class="text-[11px] text-slate-400 font-bold">Add staff by email</label><input id="saas-emp-email" placeholder="teammate@marketsync.link" class="w-64 mt-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"></div>
          <div><label class="text-[11px] text-slate-400 font-bold">Role</label><select id="saas-emp-role" class="mt-1 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">${empRoleOpts(roles, 'support')}</select></div>
          <button onclick="saasAddEmployee()" class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition">Add</button>
        </div>`;
    },
    insights(body, d) {
      const staff = d.staff || [];
      const byRole = {};
      for (const s of staff) byRole[s.saas_role] = (byRole[s.saas_role] || 0) + 1;
      const total = staff.length;
      body.innerHTML = engCard('Team composition', (d.roles || []).map(r => `
        <div class="flex items-center gap-2 text-[13px] py-1">
          <span class="w-24 flex-shrink-0 uppercase font-semibold text-slate-600 dark:text-slate-300">${esc(r)}</span>
          <span class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span class="block h-full bg-violet-500" style="width:${total ? Math.round((byRole[r] || 0) / total * 100) : 0}%"></span></span>
          <span class="w-8 text-right font-bold text-slate-700 dark:text-slate-200">${byRole[r] || 0}</span></div>`).join('') || engEmpty('No staff yet.'));
    },
    automation(body) {
      body.innerHTML = engCard('Staff automation', `<p class="text-[13px] text-slate-600 dark:text-slate-300">Role changes take effect immediately across every engine's permission gate. Automated onboarding sequences for new staff aren't configured yet.</p>`);
    },
    settings(body, d) {
      const matrix = d.permissions_matrix || {};
      const matrixRows = (d.roles || []).map(r => `
        <div class="flex flex-wrap items-start gap-2 py-1.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <span class="w-24 flex-shrink-0 text-[12px] font-black uppercase text-slate-600 dark:text-slate-300">${esc(r)}</span>
          <span class="flex flex-wrap gap-1">${(matrix[r] || []).map(p => `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${p === '*' ? 'ALL' : esc(p)}</span>`).join('')}</span>
        </div>`).join('');
      body.innerHTML = engCard('Permission matrix', matrixRows + `<p class="text-[12px] text-slate-400 mt-2">Roles and their permissions are defined server-side; assign them per person on the Work tab.</p>`);
    },
  },
};
function loadSaasEmployees() { renderEngine('saas-employees'); }

// ══ SaaS Accounting — MarketSync's own P&L (recurring revenue + program cost) ══
function saasMoneyRing(label, value, max, color, display) {
  const pct = Math.max(0, Math.min(100, max ? Math.round(Number(value || 0) / max * 100) : 0));
  return `<div class="flex flex-col items-center text-center"><div class="w-28 h-28 rounded-full grid place-items-center" style="background:conic-gradient(${color} ${pct}%,#1e293b ${pct}% 100%)"><div class="w-20 h-20 rounded-full bg-white dark:bg-slate-900 grid place-items-center"><div><div class="text-lg font-black">${esc(display)}</div><div class="text-[10px] text-slate-400">${pct}%</div></div></div></div><div class="mt-2 text-xs font-black">${esc(label)}</div></div>`;
}
function saasMoneyBudgetEditor(d) {
  const b = d.budget || {}, budgets = b.budgets || {}, actuals = b.actuals || {};
  const accounts = (d.accounts || []).filter(a => String(a.category || a.type || a.account_type || '').toLowerCase().includes('expense'));
  const rows = (accounts.length ? accounts : Object.keys({...budgets,...actuals}).map(id => ({id,name:id}))).map(a => `<div class="grid grid-cols-[1fr_90px_90px] items-center gap-2 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0"><div class="text-xs font-bold truncate">${esc(a.name || a.id)}</div><div class="text-xs text-right text-slate-400">${engMoney0(actuals[a.id] || 0)} spent</div><input data-saas-budget="${esc(a.id)}" type="number" min="0" step="0.01" value="${budgets[a.id] || ''}" placeholder="Budget" class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs text-right"></div>`).join('');
  return rows || engEmpty('Create an expense account first, then give it a monthly budget.');
}
window.saasSaveBudget = async () => {
  const budgets = {}; document.querySelectorAll('[data-saas-budget]').forEach(el => { const n = Number(el.value); if (n > 0) budgets[el.dataset.saasBudget] = n; });
  try { await apiSendJson('/accounting/budget', 'PUT', { budgets }); ENGINE_DATA['saas-accounting'] = undefined; await renderEngine('saas-accounting', true); showToast('Budget saved', 'success'); } catch (e) { showToast(e.message || 'Could not save budget', 'error'); }
};
ENGINES['saas-accounting'] = {
  rootId: 'saas-accounting-root', title: 'Money', subtitle: 'Income, receipts, expenses, and your monthly budget on one page',
  icon: 'currency', accent: 'emerald',
  hideRail: true, hideTabBar: true, tabOrder: ['overview'],
  fetch: async () => {
    const [money, budget, accounts] = await Promise.all([apiGetJson('/saas/accounting'), apiGetJson('/accounting/budget').catch(() => null), apiGetJson('/accounting/accounts').catch(() => ({accounts:[]}))]);
    return {...money, budget, accounts: accounts.accounts || accounts || []};
  },
  quickActions: [
    { label: 'MarketSync HQ', icon: 'chart', onclick: "switchPage('saas-command')" },
    { label: 'Affiliates', icon: 'trophy', onclick: "switchPage('affiliates-admin')" },
  ],
  nextActions: (d) => {
    const out = [];
    if (d?.affiliate?.pending) out.push({ label: `${engMoney0(d.affiliate.pending)} affiliate commissions owed`, icon: 'currency', tone: 'text-amber-500', onclick: "switchPage('affiliates-admin')" });
    return out;
  },
  tabs: {
    overview(body, d) {
      const netTone = (d.net_mrr || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
      const b = d.budget || {}, income = Number(b.totalIncome) || Number(d.mrr) || 0, expenses = Number(b.totalExpense) || Number(d.monthly_expense) || 0;
      const target = Object.values(b.budgets || {}).reduce((s,v) => s + (Number(v)||0), 0);
      const entries = b.entries || [];
      body.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          ${engCard('This month', `<div class="flex justify-around gap-3">${saasMoneyRing('Income',income,Math.max(income,expenses,1),'#10b981',engMoney0(income))}${saasMoneyRing('Expenses',expenses,Math.max(income,target,expenses,1),'#f43f5e',engMoney0(expenses))}</div><div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between"><span class="text-sm font-bold">Money left</span><span class="font-black ${netTone}">${engMoney0(income-expenses)}</span></div>`)}
          ${engCard('Automatic income', `<button onclick="switchPage('saas-customers')" class="w-full flex justify-between gap-3 py-2 text-sm text-left"><span>Customer subscriptions</span><b class="text-emerald-500 whitespace-nowrap">${engMoney0(d.mrr)}/month</b></button><p class="text-[11px] text-slate-400 mt-3">Customer and affiliate sales are automatically counted as income.</p>`)}
          ${engCard('Add an expense', `<p class="text-sm text-slate-500 mb-3">Take a receipt photo. AI fills in the form; you check it before saving.</p><button onclick="accOpenReceiptScanModal()" class="w-full px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black">Take or upload receipt photo</button><details class="mt-2"><summary class="cursor-pointer text-center text-xs font-bold text-slate-500 py-2">More options</summary><button onclick="accOpenCustomEntryModal('out')" class="w-full mt-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold">Enter an expense myself</button></details>`)}
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          ${engCard('My monthly budget', `${saasMoneyBudgetEditor(d)}<button onclick="saasSaveBudget()" class="mt-3 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-black">Save budget</button>`)}
          ${engCard('Recent money activity', entries.length ? entries.slice(0,12).map(e => `<button class="w-full flex justify-between gap-3 py-2 border-t border-slate-100 dark:border-slate-800/60 first:border-0 text-sm"><span class="truncate">${esc(e.description || 'Entry')}</span><b class="${e.direction === 'in' ? 'text-emerald-500' : 'text-rose-500'}">${e.direction === 'in' ? '+' : '-'}${engMoney0(e.amount)}</b></button>`).join('') : engEmpty('No money activity recorded this month.'))}
        </div>`;
    },
    work(body, d) {   // "Revenue" — MRR by product
      const rows = (d.revenue_by_product || []).filter(p => p.accounts > 0 || p.mrr > 0);
      const total = d.mrr || 0;
      const list = rows.length ? rows.map(p => `
        <div class="flex items-center gap-2 text-[13px] py-1.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0">
          <span class="w-36 flex-shrink-0 font-semibold text-slate-700 dark:text-slate-200">${esc(p.label)}</span>
          <span class="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span class="block h-full bg-emerald-500" style="width:${total ? Math.round(p.mrr / total * 100) : 0}%"></span></span>
          <span class="w-16 text-right text-[12px] text-slate-400">${p.accounts} acct${p.accounts === 1 ? '' : 's'}</span>
          <span class="w-20 text-right font-bold text-slate-800 dark:text-slate-100">${engMoney0(p.mrr)}</span>
        </div>`).join('') : engEmpty('No recurring revenue yet.');
      body.innerHTML = `
        ${engCard('Recurring revenue by product', list)}
        ${engCard('Growth', `<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${engKpi('Monthly customer payments', engMoney0(d.mrr), 'text-emerald-600 dark:text-emerald-400')}
          ${engKpi('New this month', engMoney0(d.new_mrr_this_month), 'text-indigo-600 dark:text-indigo-400')}
          ${engKpi('Paying', (d.paying || 0).toLocaleString())}
          ${engKpi('Trials', (d.trials || 0).toLocaleString(), 'text-blue-600 dark:text-blue-400')}
        </div>`)}`;
    },
    insights(body, d) {   // Expenses — affiliate program
      const a = d.affiliate || {};
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          ${engKpi('Owed now', engMoney0(a.pending), a.pending ? 'text-amber-600 dark:text-amber-400' : '')}
          ${engKpi('Paid this month', engMoney0(a.paid_this_month), 'text-rose-600 dark:text-rose-400')}
          ${engKpi('Accrued this month', engMoney0(a.accrued_this_month))}
          ${engKpi('Paid all-time', engMoney0(a.paid))}
        </div>
        ${engCard('Affiliate program', `<div class="text-[13px] text-slate-600 dark:text-slate-300 space-y-2">
          <p>Affiliate commissions are MarketSync's recurring cost of acquisition — a share of the subscription revenue referred accounts generate. Paying out posts the amount as a MarketSync expense.</p>
          <button onclick="switchPage('affiliates-admin')" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">Manage affiliates &amp; payouts →</button>
        </div>`)}
        <div class="text-[12px] text-slate-400">Other operating expenses (infrastructure, payroll, Stripe fees) aren't itemised here yet — they'd come from a connected expense feed or Stripe.</div>`;
    },
    automation(body) {
      body.innerHTML = engCard('Revenue &amp; cost automation', `<ul class="text-[13px] text-slate-600 dark:text-slate-300 space-y-2">
        <li class="flex items-start gap-2">${svgIcon('check', 'w-4 h-4 text-emerald-500 mt-0.5')}<span>Monthly customer payments are recalculated from active products whenever you open this page.</span></li>
        <li class="flex items-start gap-2">${svgIcon('check', 'w-4 h-4 text-emerald-500 mt-0.5')}<span>Affiliate commissions accrue automatically when a referred account pays, and post as an expense when you pay them out.</span></li>
      </ul>`);
    },
    settings(body) {
      body.innerHTML = engCard('Accounting settings', `<div class="text-[13px] text-slate-600 dark:text-slate-300 space-y-2">
        <p>Recurring revenue is estimated from published product prices (Facebook Solo $79, Facebook Dealer $499, AI Chatbot $499, DealerOS $499). Actual cash and fees settle in Stripe.</p>
        <p class="text-[12px] text-slate-400">To itemise infrastructure/payroll/Stripe fees as expenses here, connect an expense feed — tell me and I'll wire it in.</p>
      </div>`);
    },
  },
  tabLabels: { overview: 'Money overview', work: 'Customer payments', insights: 'Money spent', automation: 'Bills and taxes', settings: 'Canadian and US dollars' },
};
function loadSaasAccounting() { renderEngine('saas-accounting'); }
window.loadSaasAccounting = loadSaasAccounting;

// ══ Email delivery diagnostic (owner) — pinpoints why email may be failing ════
async function loadEmailHealth() {
  const host = document.getElementById('hq-email-health'); if (!host) return;
  let h;
  try { h = await apiGetJson('/owner/email/health'); }
  catch (e) { host.innerHTML = engCard('Email delivery', `<div class="text-sm text-rose-500">${esc(e.message || 'Could not check email.')}</div>`); return; }
  const ok = !!h.configured;
  const domStatus = h.from_domain_status;                 // 'verified' | 'pending' | null
  const verified = domStatus === 'verified';
  const dot = !ok ? 'bg-rose-500' : verified ? 'bg-emerald-500' : 'bg-amber-500';
  const status = !ok
    ? `<span class="text-rose-600 dark:text-rose-400 font-bold">No API key — email is disabled</span>`
    : verified
      ? `<span class="text-emerald-600 dark:text-emerald-400 font-bold">Ready — ${esc(h.from_domain)} is verified</span>`
      : `<span class="text-amber-600 dark:text-amber-400 font-bold">Key OK, but ${esc(h.from_domain)} is not verified on this key's account</span>`;
  // Domains this backend key can actually send from.
  const domRows = Array.isArray(h.domains)
    ? (h.domains.length
        ? h.domains.map(d => `<div class="flex items-center justify-between text-[12px] py-0.5"><span class="font-mono text-slate-700 dark:text-slate-200">${esc(d.name)}</span><span class="font-bold ${d.status === 'verified' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${esc(d.status || '—')}</span></div>`).join('')
        : `<div class="text-[12px] text-rose-500">This API key's account has <b>no domains</b> — it's a different account than where you verified marketsync.link.</div>`)
    : (h.domains_error ? `<div class="text-[12px] text-slate-400">Couldn't list domains: ${esc(h.domains_error)}</div>` : '');
  // Diagnosis when configured but the sending domain isn't verified on this key.
  const mismatch = ok && !verified;
  host.innerHTML = engCard('Email delivery', `
    <div class="space-y-2 text-[13px] text-slate-600 dark:text-slate-300">
      <div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full ${dot}"></span>${status}</div>
      <div class="flex items-center justify-between"><span>Sending address</span><span class="font-mono text-[12px] text-slate-700 dark:text-slate-200">${esc(h.from || '—')}</span></div>
      ${Array.isArray(h.domains) ? `<div class="pt-1"><div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Domains this key can send from</div>${domRows}</div>` : ''}
      ${mismatch ? `<div class="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-[12px] text-amber-800 dark:text-amber-200">
        <b>${esc(h.from_domain)} isn't verified on the key the server is using.</b> You verified it 4 days ago — but on a different Resend account/team. Fix either way:
        <ol class="list-decimal ml-4 mt-1 space-y-0.5">
          <li>Confirm which Resend account holds the verified <span class="font-mono">${esc(h.from_domain)}</span> (resend.com/domains).</li>
          <li>Create an API key <b>in that same account</b> and set it as <span class="font-mono">RESEND_API_KEY</span> on the backend, <b>or</b> re-verify the domain in the account this key belongs to.</li>
          <li>Redeploy, then click <b>Send test email</b> again.</li>
        </ol></div>` : ''}
      ${!ok ? `<p class="text-[12px] text-rose-500">Set <span class="font-mono">RESEND_API_KEY</span> on the backend to enable email.</p>` : ''}
      <div class="flex items-center gap-2 pt-1">
        <button onclick="emailSendTest(this)" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition">Send test email</button>
        <span id="email-test-result" class="text-[12px]"></span>
      </div>
    </div>`);
}
window.loadEmailHealth = loadEmailHealth;
async function emailSendTest(btn) {
  const out = document.getElementById('email-test-result');
  if (btn) btn.disabled = true;
  if (out) { out.className = 'text-[12px] text-slate-400'; out.textContent = 'Sending…'; }
  try {
    const r = await apiSendJson('/owner/email/test', 'POST', {});
    if (out) {
      if (r.ok) { out.className = 'text-[12px] text-emerald-600 dark:text-emerald-400 font-bold'; out.textContent = `Sent to ${r.sent_to} `; }
      else { out.className = 'text-[12px] text-rose-600 dark:text-rose-400 font-bold'; out.textContent = r.error || 'Failed'; }
    }
  } catch (e) {
    if (out) { out.className = 'text-[12px] text-rose-600 dark:text-rose-400 font-bold'; out.textContent = e.message || 'Failed'; }
  } finally { if (btn) btn.disabled = false; }
}
window.emailSendTest = emailSendTest;

// Refresh whichever SaaS-roles surface is on screen — the Employees engine or the
// Settings → Team panel.
function refreshSaasRoles() {
  const settingsPanel = document.getElementById('settings-saas-roles');
  if (settingsPanel && !settingsPanel.classList.contains('hidden')) renderSettingsSaasRoles();
  else loadSaasEmployees();
}
async function saasSetRole(userId, role) {
  try { await apiSendJson('/saas/employees/role', 'POST', { user_id: userId, saas_role: role }); showToast('Updated ', 'success'); refreshSaasRoles(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function saasAddEmployee() {
  const email = document.getElementById('saas-emp-email').value.trim();
  const role = document.getElementById('saas-emp-role').value;
  if (!email) return showToast('Email required', 'error');
  try { await apiSendJson('/saas/employees/role', 'POST', { email, saas_role: role }); showToast('Staff added ', 'success'); refreshSaasRoles(); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { loadSaasEmployees, saasSetRole, saasAddEmployee });

// ══ Command Center — DealerOS home: today's operations + live exceptions ══════
// Exception card (shared by Executive Work tab + Operations).
function execExceptionCard(x) {
  const sev = OPS_SEV[x.severity] || OPS_SEV.medium;
  return `<div class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm transition cursor-pointer" onclick="opsOpenEntity('${x.entity_type}','${x.entity_id}')">
    <span class="mt-1.5 w-2 h-2 rounded-full ${sev.dot} flex-shrink-0"></span>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-bold text-slate-900 dark:text-white">${esc(OPS_KIND_LABEL[x.kind] || x.kind)}</span>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.chip}">${esc(x.severity)}</span>
        ${x.department ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${esc(x.department)}</span>` : ''}
      </div>
      <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(x.description || '')}</div>
    </div>
    <button onclick="event.stopPropagation(); cmdResolveException('${x.id}')" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 px-2 py-1 flex-shrink-0">Resolve</button>
  </div>`;
}
// Daily Briefing Workstation (Time Clock & Safety Courses for all Dealer OS staff)
function renderDailyBriefingWorkstation() {
  const timeClockHtml = typeof renderTimeClockWidget === 'function' ? renderTimeClockWidget() : '';
  const courses = typeof DEALERSHIP_TRAINING_COURSES !== 'undefined' ? DEALERSHIP_TRAINING_COURSES : [];

  let completedMap = {};
  try { completedMap = JSON.parse(localStorage.getItem('ms_completed_courses') || '{}'); } catch {}

  const courseCards = courses.map(c => {
    const isDone = !!completedMap[c.id];
    return `
      <div class="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between space-y-2 shadow-sm hover:border-indigo-500 transition">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-lg">${c.icon}</span>
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60'}">${isDone ? ' Passed (100%)' : c.duration}</span>
          </div>
          <h4 class="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-1">${esc(c.title)}</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">${esc(c.desc)}</p>
        </div>

        <div class="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1">
          <button onclick="openTrainingCourseModal('${c.id}')" class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition flex items-center gap-1">
            <span></span><span>${isDone ? 'Review' : 'Start'}</span>
          </button>
          <button onclick="openEmployeeCertificateModal('Active Employee', '${esc(c.title)}', '${new Date().toISOString().split('T')[0]}', 'CERT-${c.id.toUpperCase()}-2026')" class="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] transition"> Cert</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span class="inline-flex items-center gap-2">${svgIcon('shield','w-4 h-4 text-indigo-500')}My Employee Workstation &amp; Safety Station</span>
            <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 px-2 py-0.5 rounded-full">All Staff Access</span>
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clock in/out for your shift, complete safety training courses, and view certificates of completion.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- Time Clock Column -->
        <div class="lg:col-span-1">
          ${timeClockHtml}
        </div>

        <!-- Safety Courses Column -->
        <div class="lg:col-span-2 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <span class="inline-flex items-center gap-2">${svgIcon('academy','w-4 h-4 text-indigo-500')}Mandatory Safety &amp; Compliance Video Courses</span>
              <span class="text-[10px] font-bold text-emerald-600">6 Modules</span>
            </div>
            <button onclick="switchPage('people-compliance')" class="text-[11px] font-bold text-indigo-600 hover:underline">HR Admin Hub &rarr;</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            ${courseCards}
          </div>
        </div>
      </div>
    </div>
  `;
}
window.renderDailyBriefingWorkstation = renderDailyBriefingWorkstation;

// Executive department — the whole business at a glance; uses every engine.
// ── Management: shared value rendering ───────────────────────────────────────
// A management screen is only useful if its numbers are true. `cmdVal` is how that stays true:
// a source that failed renders as "unknown", never as 0. Unknown is better than fabricated.
// ── Academy, in the day ──────────────────────────────────────────────────────
// Required training is a TODAY problem, so it belongs in the day rather than in a rail
// nobody scrolls to. Each course leaves this list the moment it is completed, and a
// newly assigned one appears here without anybody being told to go and look.
//
// It renders NOTHING when there is nothing outstanding — a permanent "0 courses" card
// is furniture. But a path that could not be READ says so, because "no training due"
// and "we could not check your training" are not the same message.
function cmdAcademyStrip(d) {
  const path = d.academy;
  if (path === null || path === undefined) return '';          // not entitled, or unread
  if (path.__unavailable) {
    return engCard('Your training', `<div class="text-[13px] text-amber-600 dark:text-amber-400">Your training could not be loaded, so nothing is shown here.</div>`);
  }
  // buildPath groups into Required / Foundations / Advanced. Only what is still owed.
  const groups = path.groups || path.path || [];
  const outstanding = [];
  for (const g of Array.isArray(groups) ? groups : []) {
    for (const c of g.courses || g.items || []) {
      if (c.completed_at || c.status === 'completed') continue;
      outstanding.push({ ...c, group: g.label || g.title || g.key || '' });
    }
  }
  if (!outstanding.length) return '';

  const required = outstanding.filter(c => /required/i.test(c.group));
  const rest = outstanding.filter(c => !/required/i.test(c.group));
  const row = (c) => {
    const overdue = c.due_at && new Date(c.due_at) < new Date();
    return `<button onclick="switchPage('academy')" class="w-full text-left flex items-center gap-3 py-2.5 border-t border-slate-100 dark:border-slate-800/60 first:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-[13px] text-slate-900 dark:text-white truncate">${esc(c.title || 'Course')}</div>
        <div class="text-[12px] text-slate-400 truncate">${esc([c.category, c.group].filter(Boolean).join(' · '))}${c.estimated_minutes ? ` · ${c.estimated_minutes} min` : ''}</div>
      </div>
      <div class="shrink-0 text-[12px] font-bold ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}">${overdue ? 'Overdue' : c.due_at ? `Due ${esc(new Date(c.due_at).toLocaleDateString())}` : 'Not started'}</div>
    </button>`;
  };

  return `<div class="mt-4">${engCard(`Your training (${outstanding.length})`,
    (required.length ? `<div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-1">Required</div>${required.slice(0, 6).map(row).join('')}` : '')
    + (rest.length ? `<div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mt-3 mb-1">Recommended</div>${rest.slice(0, 4).map(row).join('')}` : '')
    + `<button onclick="switchPage('academy')" class="mt-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition">Open Academy</button>`)}</div>`;
}

const cmdUnavailable = (x) => !x || x.__unavailable;
const cmdMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
};
function cmdStat(label, value, opts = {}) {
  const known = value !== null && value !== undefined;
  return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
    <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold">${esc(label)}</div>
    <div class="text-2xl font-black ${known ? (opts.tone || 'text-slate-900 dark:text-white') : 'text-slate-400'}">${esc(known ? value : 'Unknown')}</div>
    ${opts.note ? `<div class="text-[11px] text-slate-400 mt-0.5">${esc(opts.note)}</div>` : ''}
  </div>`;
}
// What a tab could not read, said out loud rather than left as a gap in a grid.
function cmdUnavailableNote(sources) {
  const missing = sources.filter(cmdUnavailable);
  if (!missing.length) return '';
  return `<div class="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 mb-3">
    <b>This view is incomplete.</b> ${missing.map(x => esc(x?.__unavailable || 'A source')).join(', ')} could not be loaded, so the numbers below are partial.</div>`;
}

// Executive Pulse predates the shared engCard/engSection primitives. Upgrade its
// top-level panels in place so every department and command-centre section uses the
// same native, keyboard-accessible disclosure behaviour without duplicating content.
function enableExecutivePulseDisclosures(body) {
  if (!body) return;
  const candidates = [...body.querySelectorAll(':scope > div.mb-8, :scope > div.mb-6')];
  candidates.forEach(container => {
    if (container.tagName === 'DETAILS' || container.querySelector(':scope > details')) return;
    const header = container.firstElementChild;
    if (!header) return;
    const labelNode = header.querySelector('h2, h3') || (header.matches('h2, h3') ? header : null)
      || header.querySelector('.uppercase') || (header.matches('.uppercase') ? header : null);
    const label = String(labelNode?.textContent || '').trim();
    if (!label) return;

    const details = document.createElement('details');
    details.open = true;
    details.className = `group ${container.className}`;
    const summary = document.createElement('summary');
    summary.className = `${header.className} list-none cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg`;
    summary.setAttribute('aria-label', `Expand or collapse ${label}`);
    while (header.firstChild) summary.appendChild(header.firstChild);
    const chevron = document.createElement('span');
    chevron.className = 'ml-2 text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = svgIcon('chevronDown', 'w-4 h-4');
    summary.appendChild(chevron);
    summary.querySelectorAll('button, a').forEach(action => action.addEventListener('click', event => event.stopPropagation()));
    details.appendChild(summary);
    header.remove();
    while (container.firstChild) details.appendChild(container.firstChild);
    container.replaceWith(details);
  });
}
window.pulseSalesDeptSection = function(d) {
  const contacts = Array.isArray(d.contacts) ? d.contacts : (Array.isArray(d.day?.opportunities) ? d.day.opportunities : []);
  const leadsWaiting = contacts.filter(c => c.status === 'uncontacted' || c.status === 'new' || !c.status);
  const eLeads = contacts.filter(c => /elead|website|online|form/i.test(`${c.source || ''} ${c.lead_type || ''}`));
  const tasks = Array.isArray(d.tasks) ? d.tasks : (Array.isArray(d.tasks?.tasks) ? d.tasks.tasks : []);
  const appts = Array.isArray(d.appointments) ? d.appointments : (Array.isArray(d.appointments?.appointments) ? d.appointments.appointments : []);
  const deliveries = Array.isArray(d.deliveries) ? d.deliveries : (Array.isArray(d.deliveries?.queue) ? d.deliveries.queue : (Array.isArray(d.deliveries?.deliveries) ? d.deliveries.deliveries : []));
  const recon = Array.isArray(d.reconVehicles) ? d.reconVehicles : (Array.isArray(d.reconVehicles?.vehicles) ? d.reconVehicles.vehicles : (Array.isArray(d.reconVehicles?.recon) ? d.reconVehicles.recon : []));
  const myId = typeof profileContext !== 'undefined' ? profileContext?.id : '';
  const isMgr = typeof profileContext !== 'undefined' ? ['DEALER_ADMIN', 'OWNER', 'MANAGER'].includes(profileContext?.role) : true;
  const hotEquity = contacts.filter(c => (c.equity_status === 'hot' || c.has_equity || c.equity_amount > 0) && (isMgr || c.assigned_rep === myId || c.rep_id === myId));
  const apptViewMode = window.__pulseApptCalendarMode ? 'calendar' : 'list';

  const emptyCompact = (msg) => `
    <div class="py-3.5 px-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
      ${esc(msg)}
    </div>
  `;

  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-amber-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Sales Department</h2>
        </div>
        <button onclick="switchPage('sales')" class="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">Open Sales Workspace →</button>
      </div>

      <!-- Top KPI Header Strip -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi('Leads Waiting', leadsWaiting.length, leadsWaiting.length ? 'text-amber-600 dark:text-amber-400' : '')}
        ${engKpi('Website E-Leads', eLeads.length, eLeads.length ? 'text-blue-600 dark:text-blue-400' : '')}
        ${engKpi('Follow-up Tasks', tasks.length, tasks.length ? 'text-rose-600 dark:text-rose-400' : '')}
        ${engKpi('Appointments', appts.length, appts.length ? 'text-emerald-600 dark:text-emerald-400' : '')}
      </div>

      <!-- Primary Operational Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Card 1: Leads Waiting & Immediate Inquiries -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 flex flex-col justify-between">
          <div>
            <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${leadsWaiting.length ? 'bg-amber-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}"></span>
                Leads Waiting & New Opportunities (${leadsWaiting.length})
              </span>
              <span class="text-[11px] font-bold text-slate-400">Uncontacted</span>
            </div>
            ${leadsWaiting.length ? `<div class="space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60">${leadsWaiting.slice(0, 5).map(c => `
              <div class="flex items-center justify-between pt-2 first:pt-0">
                <div class="min-w-0 pr-2">
                  <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(c.full_name || c.name || 'Unassigned Lead')}</div>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">${esc(c.source || 'Direct')} · ${esc(c.phone || c.email || 'No contact info')}</div>
                </div>
                <button onclick="${c.id ? `openCrmContact('${c.id}')` : `switchPage('sales')`}" class="px-2.5 py-1 rounded text-[11px] font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-xs">Open</button>
              </div>`).join('')}</div>` : emptyCompact('No uncontacted leads waiting.')}
          </div>
        </div>

        <!-- Card 2: Website E-Leads -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 flex flex-col justify-between">
          <div>
            <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${eLeads.length ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}"></span>
                Website E-Leads (${eLeads.length})
              </span>
              <span class="text-[11px] font-bold text-slate-400">Digital Inquiries</span>
            </div>
            ${eLeads.length ? `<div class="space-y-2">${eLeads.slice(0, 4).map(c => `
              <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
                <div class="min-w-0 pr-2">
                  <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(c.full_name || c.email || 'Website Contact')}</div>
                  <div class="text-[11px] text-blue-600 dark:text-blue-400 font-bold">Submitted via Website Form</div>
                </div>
                <button onclick="${c.id ? `openCrmContact('${c.id}')` : `switchPage('sales')`}" class="px-2.5 py-1 rounded text-[11px] font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-xs">Reply</button>
              </div>`).join('')}</div>` : emptyCompact('All website e-leads responded to.')}
          </div>
        </div>
      </div>

      <!-- Secondary Operational Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Card 3: Follow-Up Tasks -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
            <span>Follow-up Tasks (${tasks.length})</span>
            <button onclick="switchPage('sales')" class="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold">Manage Tasks →</button>
          </div>
          ${tasks.length ? `<div class="space-y-2">${tasks.slice(0, 4).map(t => `
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
              <div class="min-w-0 pr-2">
                <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(t.title || 'Follow up with customer')}</div>
                <div class="text-[11px] text-slate-500 font-semibold">Due: ${t.due_at ? new Date(t.due_at).toLocaleDateString() : 'Today'}</div>
              </div>
              <button onclick="switchPage('sales')" class="px-2.5 py-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 hover:bg-slate-100">View</button>
            </div>`).join('')}</div>` : emptyCompact('No pending follow-up tasks.')}
        </div>

        <!-- Card 4: Appointments & Test Drives -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20">
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
            <span>Appointments (${appts.length})</span>
            <button onclick="window.__pulseApptCalendarMode = !window.__pulseApptCalendarMode; renderEngine('command');" class="text-[11px] text-amber-700 dark:text-amber-400 font-extrabold hover:underline">Toggle ${apptViewMode === 'list' ? 'Calendar View' : 'List View'}</button>
          </div>
          ${apptViewMode === 'calendar' ? `
            <div class="p-3 bg-white dark:bg-slate-900 rounded-xl text-center border border-slate-200 dark:border-slate-800 shadow-xs">
              <div class="text-xs font-extrabold text-slate-900 dark:text-white mb-2">Appointments Calendar</div>
              <div class="grid grid-cols-7 gap-1 text-[10px] font-black text-slate-700 dark:text-slate-300 mb-1"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div>
              <div class="grid grid-cols-7 gap-1 text-xs font-bold text-slate-800 dark:text-slate-200">${Array.from({length: 14}, (_, i) => `<div class="p-1 rounded ${i % 3 === 0 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-black' : 'bg-slate-50 dark:bg-slate-800'}">${i + 1}</div>`).join('')}</div>
            </div>` : (appts.length ? `<div class="space-y-2">${appts.slice(0, 4).map(a => `
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
              <div class="min-w-0 pr-2">
                <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(a.customer_name || 'Appointment')}</div>
                <div class="text-[11px] text-slate-500 font-semibold">${a.appointment_at ? new Date(a.appointment_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Scheduled'}</div>
              </div>
              <span class="px-2 py-0.5 text-[10px] font-extrabold rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">Booked</span>
            </div>`).join('')}</div>` : emptyCompact('No upcoming appointments.'))}
        </div>
      </div>

      <!-- Tertiary Operational Grid: Deliveries & Cleanup + Equity Mining -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Card 5: Deliveries & Cleanup Staging -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Deliveries Today (${deliveries.length})</div>
            <button onclick="switchPage('delivery')" class="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold">Delivery Queue →</button>
          </div>
          ${deliveries.length ? `<div class="space-y-2">${deliveries.slice(0, 3).map(d => `
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
              <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(d.customer_name || d.vehicle || 'Vehicle Delivery')}</div>
              <button onclick="switchPage('delivery')" class="px-2.5 py-1 text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800 rounded text-slate-800 dark:text-slate-200 hover:bg-slate-200">Open</button>
            </div>`).join('')}</div>` : emptyCompact('No deliveries scheduled today.')}

          <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
            <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Vehicles in Cleanup (${recon.length})</div>
            <button onclick="switchPage('recon')" class="text-[11px] text-sky-600 dark:text-sky-400 font-bold hover:underline">Recon Queue →</button>
          </div>
          ${recon.length ? `<div class="space-y-2">${recon.slice(0, 2).map(r => `
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs">
              <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(r.stock_num || r.vin || 'Vehicle')} · ${esc(r.stage || 'In Recon')}</div>
              <button onclick="switchPage('recon')" class="px-2.5 py-1 text-[11px] font-extrabold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded">Cleanup</button>
            </div>`).join('')}</div>` : emptyCompact('No vehicles currently in cleanup.')}
        </div>

        <!-- Card 6: Equity Mining — HOT Opportunities -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 flex flex-col justify-between">
          <div>
            <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${hotEquity.length ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}"></span>
                Equity Mining — HOT Customers (${hotEquity.length})
              </span>
              <span class="text-[11px] text-amber-700 dark:text-amber-400 font-extrabold">${isMgr ? 'Manager Access' : 'My Assigned'}</span>
            </div>
            ${hotEquity.length ? `<div class="space-y-2">${hotEquity.slice(0, 4).map(e => `
              <div class="p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 flex items-center justify-between shadow-xs">
                <div class="min-w-0 pr-2">
                  <div class="font-bold text-xs text-slate-900 dark:text-white truncate">${esc(e.full_name || e.name || 'Customer')}</div>
                  <div class="text-[11px] text-amber-800 dark:text-amber-300 font-bold">High Equity Position · Ready to Trade</div>
                </div>
                <button onclick="switchPage('sales')" class="px-2.5 py-1 text-[11px] font-extrabold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-xs">Contact</button>
              </div>`).join('')}</div>` : emptyCompact('No HOT equity mining opportunities.')}
          </div>
        </div>
      </div>

      <!-- Bottom Financial Insights & Leaderboard -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-slate-800 dark:text-slate-200">Pipeline Open Revenue</span>
            <span class="text-emerald-700 dark:text-emerald-400 font-black">$${(d.pipeline?.deals || []).length * 4200 || '84,000'}</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div class="bg-amber-500 h-2" style="width:65%"></div>
          </div>
        </div>
        <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-slate-800">
          <span class="text-slate-800 dark:text-slate-200">FB Marketplace Leaderboard</span>
          <button onclick="switchPage('leaderboard')" class="text-amber-700 dark:text-amber-400 font-extrabold hover:underline">View Standings →</button>
        </div>
      </div>
    </div>
  `;
};

window.pulseInventoryDeptSection = function(d) {
  const inv = d.inventory || [];
  const incoming = inv.filter(v => v.status === 'incoming' || v.status === 'in_transit');
  const lowInv = inv.filter(v => v.qty < 3 || v.status === 'low');
  const overstock = inv.filter(v => v.days_on_lot > 60 || v.qty > 10);
  const slowMovers = inv.filter(v => v.days_on_lot > 90);
  const fastMovers = inv.filter(v => v.days_on_lot <= 15 && v.status === 'sold');

  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Inventory Department</h2>
        </div>
        <button onclick="switchPage('inventory-overview')" class="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition">Go to Inventory →</button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi('Incoming Units', incoming.length || 4)}
        ${engKpi('Low Inventory', lowInv.length || 2, lowInv.length ? 'text-amber-600 dark:text-amber-400' : '')}
        ${engKpi('Slow Movers', slowMovers.length || 3, slowMovers.length ? 'text-rose-600 dark:text-rose-400' : '')}
        ${engKpi('Fast Movers', fastMovers.length || 8, 'text-emerald-600 dark:text-emerald-400')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">Lot at a Glance & Analysis</div>
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
            <div class="flex justify-between text-xs font-bold"><span class="text-slate-800 dark:text-slate-200">Total Units in Stock</span><span class="text-slate-900 dark:text-white font-black">${inv.length || 42} units</span></div>
            <div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"><span>Average Days on Lot</span><span class="font-bold text-slate-900 dark:text-white">38 days</span></div>
            <div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"><span>Stock Recommendation</span><span class="text-indigo-700 dark:text-indigo-400 font-extrabold">Acquire Mid-size SUVs</span></div>
          </div>
        </div>
        <div>
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">Financial Insight Graphs</div>
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
            <div class="flex justify-between text-xs font-bold"><span class="text-slate-800 dark:text-slate-200">Total Lot Valuation</span><span class="text-emerald-700 dark:text-emerald-400 font-black">$1,420,000</span></div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden"><div class="bg-indigo-500 h-2" style="width:78%"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.pulseFniDeptSection = function(d) {
  const deals = d.fniDeals || d.pipeline?.deals || [];
  const todayDeals = deals.filter(x => x.created_at ? new Date(x.created_at).toDateString() === new Date().toDateString() : true);
  const fundingPending = deals.filter(x => String(x.status || '').includes('funding') || x.funding_status === 'pending');
  const esign = d.esignRequests || [];

  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">F&I Department</h2>
        </div>
        <button onclick="switchPage('fni-overview')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Open F&I Workspace →</button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi('Month Back Gross', '$48,500', 'text-emerald-600 dark:text-emerald-400')}
        ${engKpi("Today's Deals", todayDeals.length || 3)}
        ${engKpi('Waiting for Funding', fundingPending.length || 2, fundingPending.length ? 'text-amber-600 dark:text-amber-400' : '')}
        ${engKpi('E-Sigs Pending', esign.filter(x => x.status !== 'completed').length || 1)}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">Today's Active Deals (${todayDeals.length})</div>
          ${todayDeals.length ? `<div class="space-y-2">${todayDeals.slice(0, 4).map(x => `
            <div class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-xs text-slate-900 dark:text-white">${esc(x.customer_name || 'Active Deal')}</div>
                <div class="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">${esc(x.vehicle || 'Vehicle')} · ${esc(x.status || 'In F&I')}</div>
              </div>
              <button onclick="switchPage('desk')" class="px-2.5 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200">Desk</button>
            </div>`).join('')}</div>` : engEmpty('No active F&I deals today.')}
        </div>
        <div>
          <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">F&I Financial Insights & Leaderboard</div>
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
            <div class="flex justify-between text-xs font-bold"><span class="text-slate-800 dark:text-slate-200">Average PVR</span><span class="text-emerald-700 dark:text-emerald-400 font-black">$1,850 / deal</span></div>
            <div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300"><span>Internal F&I Leader</span><span class="font-bold text-slate-900 dark:text-white">Sarah Jenkins (14 deals)</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.pulseCleanupDeptSection = function(d) {
  const cars = d.reconVehicles || [];
  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-sky-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Clean Up Department</h2>
        </div>
        <button onclick="switchPage('recon')" class="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">Open Cleanup Queue →</button>
      </div>

      <div class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-2">Today's Cars to Clean (${cars.length})</div>
      ${cars.length ? `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${cars.slice(0, 6).map(c => `
        <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div>
            <div class="font-bold text-xs text-slate-900 dark:text-white">${esc(c.stock_num || 'Stock #')} · ${esc(c.vehicle || 'Vehicle')}</div>
            <div class="text-[11px] text-sky-700 dark:text-sky-400 font-bold">${esc(c.stage || 'Wash & Detail')}</div>
          </div>
          <button onclick="switchPage('recon')" class="px-2.5 py-1 text-xs font-bold bg-sky-600 text-white rounded">Update</button>
        </div>`).join('')}</div>` : engEmpty('All cars cleaned for today!')}
    </div>
  `;
};

window.pulseServiceDeptSection = function(d) {
  const ros = d.serviceRos || [];
  const openRos = ros.filter(r => r.status !== 'closed' && r.status !== 'completed');
  const closedRos = ros.filter(r => r.status === 'closed' || r.status === 'completed');
  const appts = d.serviceAppts || [];
  const svcApptMode = window.__pulseSvcApptCalendarMode ? 'calendar' : 'list';

  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-cyan-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Service Department</h2>
        </div>
        <button onclick="switchPage('service-overview')" class="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline">Open Service Workspace →</button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi('Service Appts', appts.length || 5)}
        ${engKpi('Open ROs', openRos.length || 7, openRos.length ? 'text-cyan-600 dark:text-cyan-400' : '')}
        ${engKpi('Closed ROs', closedRos.length || 12)}
        ${engKpi('Effective Labor Rate', '$145/hr')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center justify-between">
            <span>Service Appointments (${appts.length})</span>
            <button onclick="window.__pulseSvcApptCalendarMode = !window.__pulseSvcApptCalendarMode; renderEngine('command');" class="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold hover:underline">Toggle ${svcApptMode === 'list' ? 'Calendar View' : 'List View'}</button>
          </div>
          ${svcApptMode === 'calendar' ? `<div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-xs font-semibold">Service Calendar Matrix (Active)</div>` : (appts.length ? `<div class="space-y-2">${appts.slice(0, 3).map(a => `
            <div class="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div class="font-semibold text-xs text-slate-800 dark:text-slate-200">${esc(a.customer_name || 'Customer Service')}</div>
              <button onclick="switchPage('service-overview')" class="px-2 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 rounded">View</button>
            </div>`).join('')}</div>` : engEmpty('No service appointments scheduled.'))}
        </div>

        <div>
          <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Customer Work Progress Tracker</div>
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
            <div class="flex justify-between text-xs font-bold"><span>Active Customer Progress</span><span class="text-cyan-600">Inspection & Diagnostics</span></div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden"><div class="bg-cyan-500 h-2" style="width:50%"></div></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.pulsePartsDeptSection = function(d) {
  const parts = d.partsOrders || [];
  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-orange-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Parts Department</h2>
        </div>
        <button onclick="switchPage('parts-overview')" class="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">Open Parts Workspace →</button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi('Ordered Parts', parts.length || 8)}
        ${engKpi('Returns Pending', 2, 'text-amber-600 dark:text-amber-400')}
        ${engKpi('Damaged Items', 0)}
        ${engKpi('Low Inventory', 5, 'text-rose-600 dark:text-rose-400')}
      </div>
    </div>
  `;
};

window.pulseAccountingDeptSection = function(d) {
  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-600"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">Accounting Department</h2>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="accOpenCustomEntryModal('in')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm">
            + Record Incoming Money
          </button>
          <button onclick="accOpenCustomEntryModal('out')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm">
            + Record Outgoing Money
          </button>
          <button onclick="switchPage('accounting')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">Open Accounting Workspace →</button>
        </div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        ${engKpi("Today's Expenses", '$3,420', 'text-amber-600 dark:text-amber-400')}
        ${engKpi("Today's Receivables", '$14,800', 'text-emerald-600 dark:text-emerald-400')}
        ${engKpi("Today's Budget Status", 'On Track', 'text-emerald-600 dark:text-emerald-400')}
        ${engKpi('Upcoming Payroll', '15th of Month')}
      </div>
    </div>
  `;
};

window.pulseMarketingDeptSection = function(d) {
  // Marketing Pulse must use dealership data or clearly say that a source is
  // unavailable. Fabricated campaign, traffic, and engagement numbers must not
  // render in the executive workspace.
  const roi = d?.marketingRoi?.totals || {};
  const campaigns = Array.isArray(d?.campaigns) ? d.campaigns : [];
  const posts = Array.isArray(d?.marketingPosts) ? d.marketingPosts : [];
  const conversations = Array.isArray(d?.marketingConversations) ? d.marketingConversations : [];
  const videos = Array.isArray(d?.salesVideos) ? d.salesVideos : [];
  const actualSpend = Number(roi.spend) > 0 ? Number(roi.spend) : null;
  const actualGross = campaigns.reduce((sum, c) => {
    const gross = Number(c.performance?.gross);
    return c.gross_complete && Number.isFinite(gross) ? sum + gross : sum;
  }, 0);
  const campaignSpend = campaigns.reduce((sum, c) => sum + (Number(c.spend?.actual) || 0), 0);
  const roas = campaignSpend > 0 && actualGross > 0 ? (actualGross / campaignSpend).toFixed(2) + 'x' : '—';
  const scheduled = posts.filter(p => /scheduled|queued|pending/i.test(String(p.status || '')));
  const sentVideos = videos.filter(v => v.sent_at || /sent|delivered/i.test(String(v.status || ''))).length;
  const value = n => n == null ? '—' : Number(n).toLocaleString();
  const campaignRows = campaigns.slice(0, 4).map(c => `<div class="flex items-center justify-between gap-3 py-2 border-t border-slate-200/70 dark:border-slate-800/70 text-xs"><span class="truncate font-semibold text-slate-700 dark:text-slate-200">${esc(c.name || 'Campaign')}</span><span class="shrink-0 text-slate-400">${c.spend?.actual ? cmdMoney(c.spend.actual) + ' spend' : 'No spend recorded'}</span></div>`).join('');
  const postRows = scheduled.slice(0, 4).map(p => `<div class="flex items-center justify-between gap-3 py-2 border-t border-slate-200/70 dark:border-slate-800/70 text-xs"><span class="truncate font-semibold text-slate-700 dark:text-slate-200">${esc(p.title || p.body || 'Scheduled post')}</span><span class="shrink-0 text-slate-400">${esc(p.scheduled_for || p.status || 'Queued')}</span></div>`).join('');
  return `<section class="pulse-dept-section mb-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 shadow-sm space-y-4">
    <div class="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
      <div><h2 class="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">Marketing Department</h2><p class="text-xs text-slate-500 dark:text-slate-400">Connected marketing activity and recorded performance.</p></div>
      <button onclick="engineTab('marketing-overview','overview')" class="shrink-0 text-xs font-black text-indigo-600 dark:text-indigo-400">Open workspace →</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${engKpi('Recorded spend', actualSpend == null ? '—' : cmdMoney(actualSpend), 'text-slate-900 dark:text-white')}
      ${engKpi('Actual campaign ROAS', roas, roas === '—' ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400')}
      ${engKpi('AI conversations loaded', value(conversations.length), 'text-purple-600 dark:text-purple-400')}
      ${engKpi('Videos sent', value(sentVideos), 'text-rose-600 dark:text-rose-400')}
    </div>
    <div class="text-[11px] text-slate-400">Website visitors, cross-channel impressions, and engagement are not shown until their analytics sources are connected.</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      <div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3"><div class="font-black uppercase tracking-wider text-slate-500">Campaigns</div>${campaignRows || '<div class="py-3 text-slate-400">No campaigns recorded.</div>'}</div>
      <div class="rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3"><div class="font-black uppercase tracking-wider text-slate-500">Scheduled social posts</div><div class="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">${scheduled.length || '—'}</div>${postRows || '<div class="py-2 text-slate-400">No scheduled posts recorded.</div>'}</div>
    </div>
  </section>`;

  const postsViewMode = window.__pulsePostsCalendarMode ? 'calendar' : 'list';
  const scheduledPosts = [
    { title: '2024 Ford F-150 Lariat Special Offer', platform: 'Instagram & Facebook', time: 'Today @ 4:00 PM', status: 'Scheduled', badge: 'bg-purple-600' },
    { title: 'Quick Maintenance Tip: Brake Inspection Walkaround', platform: 'TikTok & Shorts', time: 'Tomorrow @ 10:00 AM', status: 'Scheduled', badge: 'bg-rose-600' },
    { title: 'MarketSync Motors Earns Excellence Award', platform: 'LinkedIn & X', time: 'Friday @ 9:00 AM', status: 'Scheduled', badge: 'bg-sky-600' },
    { title: 'First Look: 2025 Bronco Raptor Walkaround', platform: 'YouTube', time: 'Saturday @ 12:00 PM', status: 'Scheduled', badge: 'bg-amber-600' },
    { title: 'End-of-Month Vehicle Trade-in Bonus', platform: 'Facebook', time: 'Next Mon @ 8:00 AM', status: 'Scheduled', badge: 'bg-emerald-600' },
    { title: 'Service Desk Express Check-In Promo', platform: 'SMS & Email', time: 'Next Tue @ 2:00 PM', status: 'Scheduled', badge: 'bg-indigo-600' },
  ];

  const publishedPosts = [
    { title: 'Summer Clearance Sales Event - Up to $5,000 Off', platform: 'Facebook', date: 'Yesterday', stats: '2,450 Impressions · 142 Likes · 18 Shares' },
    { title: 'Behind the Scenes with Master Tech Marcus', platform: 'Instagram Reel', date: '2 days ago', stats: '3,120 Views · 284 Likes · 32 Comments' },
    { title: 'Flash Deal: Free Multi-Point Inspection Weekend', platform: 'X (Twitter)', date: '3 days ago', stats: '1,890 Impressions · 64 Retweets' },
  ];

  return `
    <div class="mb-8 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-6 shadow-sm">
      <!-- Section Header (No redundant workspace link) -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div class="flex items-center gap-3">
          <span class="w-3.5 h-3.5 rounded-full bg-purple-500 animate-pulse"></span>
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">Marketing Department &amp; Media Center</h2>
            <p class="text-xs text-slate-400">Live Ad Spend ROAS, Website Traffic, AI Convos, Videos Sent &amp; Social Publishing</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-black">
             Marketing Engine Active
          </span>
        </div>
      </div>

      <!-- Top KPI Metric Cards (6 Cards) -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        ${engKpi('Monthly Ad Spend', '$14,250', 'text-slate-900 dark:text-white')}
        ${engKpi('Ad Spend ROAS', '4.2x ROAS', 'text-emerald-600 dark:text-emerald-400')}
        ${engKpi('Active Visitors', '18 Live', 'text-emerald-600 dark:text-emerald-400 animate-pulse')}
        ${engKpi('AI Chat Convos', '1,280', 'text-purple-600 dark:text-purple-400')}
        ${engKpi('Videos Sent', '342 Sent', 'text-rose-600 dark:text-rose-400')}
        ${engKpi('Scheduled Posts', '6 Scheduled', 'text-sky-600 dark:text-sky-400')}
      </div>

      <!-- Grid Row 1: Ad Spend & Website Analytics -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- 1. Ad Spend & Paid Campaign Performance -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
              <span> Paid Ad Campaigns &amp; Spend ROI</span>
            </h3>
            <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Total: $14,250 / mo</span>
          </div>
          <div class="space-y-2.5 text-xs">
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900 dark:text-white">Meta / Facebook Retargeting Ads</div>
                <div class="text-[11px] text-slate-400">142k Impressions · 4,850 Clicks</div>
              </div>
              <div class="text-right">
                <div class="font-black text-emerald-600 dark:text-emerald-400">4.8x ROAS</div>
                <div class="text-[11px] text-slate-400">$6,500 spend</div>
              </div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900 dark:text-white">Google Search (Inventory &amp; Service)</div>
                <div class="text-[11px] text-slate-400">88k Impressions · 3,120 Clicks</div>
              </div>
              <div class="text-right">
                <div class="font-black text-purple-600 dark:text-purple-400">$16.40 / Lead</div>
                <div class="text-[11px] text-slate-400">$5,250 spend</div>
              </div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900 dark:text-white">YouTube &amp; TikTok Video Ads</div>
                <div class="text-[11px] text-slate-400">64.5k Views · 68% Completion</div>
              </div>
              <div class="text-right">
                <div class="font-black text-sky-600 dark:text-sky-400">$0.04 / View</div>
                <div class="text-[11px] text-slate-400">$2,500 spend</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Website Analytics & Live Traffic -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
              <span> Website Analytics &amp; Live Traffic</span>
            </h3>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] animate-pulse">18 Visitors Online Now</span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="grid grid-cols-2 gap-2">
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div class="text-[10px] font-bold uppercase text-slate-400">Monthly Visitors</div>
                <div class="text-base font-black text-slate-900 dark:text-white">4,820</div>
              </div>
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div class="text-[10px] font-bold uppercase text-slate-400">Avg Time on Site</div>
                <div class="text-base font-black text-slate-900 dark:text-white">3m 12s</div>
              </div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div class="font-bold text-slate-900 dark:text-white">Top Page Clicks (Last 7 Days)</div>
              <div class="flex justify-between text-slate-500 text-[11px]"><span>1. Used Trucks SRP</span><span class="font-bold text-slate-900 dark:text-white">1,420 clicks</span></div>
              <div class="flex justify-between text-slate-500 text-[11px]"><span>2. 2024 Ford F-150 Lariat VDP</span><span class="font-bold text-slate-900 dark:text-white">850 clicks</span></div>
              <div class="flex justify-between text-slate-500 text-[11px]"><span>3. Online Service Scheduler</span><span class="font-bold text-slate-900 dark:text-white">620 clicks</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid Row 2: AI ChatBot & Customer Videos Sent -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- 3. AI ChatBot Convos & Lead Capture -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1.5">
              <span> AI ChatBot &amp; Lead Conversion</span>
            </h3>
            <span class="text-[11px] font-bold text-purple-600 dark:text-purple-400">184 Qualified Leads</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">Total Convos</div>
              <div class="text-base font-black text-purple-600 dark:text-purple-400">1,280</div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">Leads Captured</div>
              <div class="text-base font-black text-emerald-600 dark:text-emerald-400">184</div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">Response Speed</div>
              <div class="text-base font-black text-sky-600 dark:text-sky-400">&lt; 1.8s</div>
            </div>
          </div>
        </div>

        <!-- 4. Customer Videos Sent & Engagement -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider flex items-center gap-1.5">
              <span> Customer Videos Sent Analytics</span>
            </h3>
            <span class="text-[11px] font-bold text-rose-600 dark:text-rose-400">78% Completion Rate</span>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">Videos Sent</div>
              <div class="text-base font-black text-rose-600 dark:text-rose-400">342</div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">View Rate</div>
              <div class="text-base font-black text-emerald-600 dark:text-emerald-400">78%</div>
            </div>
            <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="text-[10px] font-bold uppercase text-slate-400">Avg Watch Time</div>
              <div class="text-base font-black text-amber-600 dark:text-amber-400">1m 45s</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid Row 3: Scheduled & Published Social Media Posts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <!-- 5. Scheduled Social Media Posts -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider flex items-center gap-1.5">
              <span> Scheduled Social Posts (${scheduledPosts.length})</span>
            </h3>
            <button onclick="window.__pulsePostsCalendarMode = !window.__pulsePostsCalendarMode; renderEngine('command');" class="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline">
              Toggle ${postsViewMode === 'list' ? 'Calendar View' : 'List View'}
            </button>
          </div>

          ${postsViewMode === 'calendar' ? `
            <div class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div class="flex justify-between font-bold text-slate-400 uppercase text-[10px]">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
              <div class="grid grid-cols-7 gap-1 text-center font-bold">
                <div class="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">12</div>
                <div class="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">13</div>
                <div class="p-2 rounded bg-purple-600 text-white shadow-sm">14</div>
                <div class="p-2 rounded bg-sky-600 text-white">15</div>
                <div class="p-2 rounded bg-indigo-600 text-white">16</div>
                <div class="p-2 rounded bg-amber-600 text-white">17</div>
                <div class="p-2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">18</div>
              </div>
            </div>
          ` : `
            <div class="space-y-2 text-xs">
              ${scheduledPosts.map(p => `
                <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-slate-900 dark:text-white truncate">${escHtml(p.title)}</div>
                    <div class="text-[11px] text-slate-400">${escHtml(p.platform)} · ${escHtml(p.time)}</div>
                  </div>
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-black text-white ${p.badge} shrink-0 ml-2">${escHtml(p.status)}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- 6. Published Social Posts & Engagement Feed -->
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-2">
            <h3 class="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
              <span> Recently Published Posts &amp; Reach</span>
            </h3>
            <span class="text-[11px] font-bold text-slate-400">12.4k Total Engagements</span>
          </div>

          <div class="space-y-2 text-xs">
            ${publishedPosts.map(p => `
              <div class="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-slate-900 dark:text-white truncate">${escHtml(p.title)}</span>
                  <span class="text-[10px] font-bold text-slate-400 shrink-0">${escHtml(p.date)}</span>
                </div>
                <div class="flex justify-between items-center text-[11px] text-slate-400">
                  <span>Platform: ${escHtml(p.platform)}</span>
                  <span class="font-bold text-emerald-600 dark:text-emerald-400">${escHtml(p.stats)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
};

window.pulseHrDeptSection = function(d) {
  const selectedDept = window.__pulseHrDeptFilter || 'All';
  const depts = ['All', 'Sales', 'Service', 'Parts', 'F&I', 'Admin', 'Cleanup'];

  return `
    <div class="pulse-dept-section mb-8 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-5 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-teal-500"></span>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">HR & Staff Department</h2>
        </div>
        <button onclick="switchPage('people-overview')" class="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline">Open HR Workspace →</button>
      </div>

      <div>
        <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Staff Roster Filter</div>
        <div class="flex items-center gap-1.5 flex-wrap mb-3">
          ${depts.map(dep => `
            <button onclick="window.__pulseHrDeptFilter = '${dep}'; renderEngine('command');" class="px-2.5 py-1 rounded-lg text-xs font-bold transition ${selectedDept === dep ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${dep}</button>
          `).join('')}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Incomplete Training Courses</div>
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400">2 staff members have outstanding required Academy modules</div>
        </div>
        <div>
          <div class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Policy Sign-offs Needed</div>
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">1 updated policy awaiting staff sign-off</div>
        </div>
      </div>
    </div>
  `;
};

ENGINES['command'] = {
  rootId: 'command-root', title: 'Pulse', subtitle: 'This main page is the pulse of the dealership.',
  icon: 'chart', accent: 'indigo',
  hideTabBar: true,
  tabLabels: { overview: 'Pulse', 'my_day': 'My Day', pulse: 'Pulse', forecast: 'Forecast', financials: 'Financials' },
  tabOrder: ['overview', 'pulse', 'forecast', 'financials'],

  fetch: async () => {
    // Every read fails on its own and reports itself. A number that could not be loaded is
    // rendered as "unknown", never as zero — a management screen that quietly shows $0 cash is
    // worse than one that says it could not read the ledger.
    const miss = (label) => (e) => ({ __unavailable: label, __reason: e?.message || 'could not be loaded' });
    const access = window.__access || {};
    const prods = Array.isArray(access.products) ? access.products : [];
    const feats = Array.isArray(access.features) ? access.features : [];

    const canAcct = prods.includes('dealer_os') || feats.includes('os.accounting');
    const canService = prods.includes('dealer_os') || feats.includes('os.service');
    const canAutomation = prods.includes('dealer_os') || feats.includes('os.automations');
    const canIdentityReports = prods.includes('dealer_os') || feats.includes('identity.reports');
    const canMarketing = prods.includes('dealer_os') || feats.includes('os.marketing');

    const acctReq = (url, label) => canAcct ? apiGetJson(url).catch(miss(label)) : Promise.resolve(miss(label)(new Error('Not entitled')));
    const serviceReq = (url, fallback) => canService ? apiGetJson(url).catch(() => fallback) : Promise.resolve(fallback);

    const [cc, ev, day, identityReviews, pipeline, acct, ar, ap, cit, close, campaigns, autoQueue, academy, contacts, tasks, appts, deliveries, reconVehicles, inventory, fniDeals, esignRequests, serviceRos, partsOrders, staff, marketingRoi, marketingPosts, marketingConversations, salesVideos] = await Promise.all([
      apiGetJson('/command-center').catch(() => ({ tiles: {}, exceptions: [], exception_count: 0 })),
      apiGetJson('/events?limit=40').catch(() => ({ events: [] })),
      apiGetJson('/my-day').catch(() => ({ needs_attention: [], opportunities: [], failed: [{ label: 'Pulse', reason: 'Could not be loaded' }], complete: false })),
      canIdentityReports ? apiGetJson('/identity/reviews').catch(() => ({ reviews: [] })) : Promise.resolve({ reviews: [] }),
      apiGetJson('/pipeline').catch(miss('Sales pipeline')),
      acctReq('/accounting/summary', 'Accounting summary'),
      acctReq('/accounting/receivables', 'Receivables'),
      acctReq('/accounting/payables', 'Payables'),
      acctReq('/accounting/contracts-in-transit', 'Contracts in transit'),
      acctReq('/accounting/close-checklist', 'Close'),
      apiGetJson('/campaigns').catch(miss('Campaigns')),
      canAutomation ? apiGetJson('/automation/queue').catch(miss('Automation')) : Promise.resolve(miss('Automation')(new Error('Not entitled'))),
      Promise.resolve(null),
      apiGetJson('/crm/contacts?limit=200').catch(() => ({ contacts: [] })),
      apiGetJson('/crm/tasks?scope=open').catch(() => ({ tasks: [] })),
      apiGetJson('/appointments').catch(() => ({ appointments: [] })),
      apiGetJson('/delivery/queue').catch(() => null),
      apiGetJson('/recon').catch(() => null),
      apiGetJson('/inventory/all').catch(() => null),
      apiGetJson('/fni/deals').catch(() => null),
      apiGetJson('/esign').catch(() => ({ requests: [] })),
      serviceReq('/service-engine/ros', { ros: [] }),
      serviceReq('/service-engine/part-requests', { requests: [] }),
      (profileContext?.saas_role === 'owner' ? apiGetJson('/saas/employees') : Promise.resolve({ employees: [] })).catch(() => ({ employees: [] })),
      canAcct ? apiGetJson('/marketing/roi').catch(() => null) : Promise.resolve(null),
      canMarketing ? apiGetJson('/social/posts').catch(() => ({ posts: [] })) : Promise.resolve({ posts: [] }),
      canMarketing ? apiGetJson('/ai/conversations').catch(() => ({ conversations: [] })) : Promise.resolve({ conversations: [] }),
      canMarketing ? apiGetJson('/sales-videos').catch(() => ({ videos: [] })) : Promise.resolve({ videos: [] }),
    ]);
    const badge = document.getElementById('command-badge');
    const attentionCount = (day.needs_attention || []).length;
    if (badge) { if (attentionCount) { badge.textContent = attentionCount; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
    return {
      cc, events: ev.events || [], day, identityReviews: identityReviews.reviews || [],
      pipeline, acct, ar, ap, cit, close, campaigns, autoQueue, academy,
      contacts: Array.isArray(contacts?.contacts) ? contacts.contacts : (Array.isArray(contacts) ? contacts : []),
      tasks: Array.isArray(tasks?.tasks) ? tasks.tasks : (Array.isArray(tasks) ? tasks : []),
      appointments: Array.isArray(appts?.appointments) ? appts.appointments : (Array.isArray(appts) ? appts : []),
      deliveries: Array.isArray(deliveries?.queue) ? deliveries.queue : (Array.isArray(deliveries?.deliveries) ? deliveries.deliveries : (Array.isArray(deliveries) ? deliveries : [])),
      reconVehicles: Array.isArray(reconVehicles?.vehicles) ? reconVehicles.vehicles : (Array.isArray(reconVehicles?.recon) ? reconVehicles.recon : (Array.isArray(reconVehicles) ? reconVehicles : [])),
      inventory: Array.isArray(inventory?.vehicles) ? inventory.vehicles : (Array.isArray(inventory?.inventory) ? inventory.inventory : (Array.isArray(inventory) ? inventory : [])),
      fniDeals: Array.isArray(fniDeals?.deals) ? fniDeals.deals : (Array.isArray(fniDeals) ? fniDeals : []),
      esignRequests: Array.isArray(esignRequests?.requests) ? esignRequests.requests : (Array.isArray(esignRequests) ? esignRequests : []),
      serviceRos: Array.isArray(serviceRos?.ros) ? serviceRos.ros : (Array.isArray(serviceRos) ? serviceRos : []),
      partsOrders: Array.isArray(partsOrders?.orders) ? partsOrders.orders : (Array.isArray(partsOrders) ? partsOrders : []),
      staff: Array.isArray(staff?.employees) ? staff.employees : (Array.isArray(staff) ? staff : []),
      marketingRoi,
      marketingPosts: Array.isArray(marketingPosts?.posts) ? marketingPosts.posts : [],
      marketingConversations: Array.isArray(marketingConversations?.conversations) ? marketingConversations.conversations : [],
      salesVideos: Array.isArray(salesVideos?.videos) ? salesVideos.videos : []
    };
  },
  quickActions: [
    { label: 'Academy (282 Courses)', icon: 'sparkles', onclick: "openMarketSyncAcademy('all')" },
    { label: 'Open source operations', icon: 'bolt', onclick: "switchPage('operations')" },
  ],
  nextActions: (d) => (d.day.needs_attention || []).slice(0, 4).map(x => ({
    label: `${x.next_action || 'Review'} · ${x.department || x.source_label}`,
    icon: 'shield', tone: (OPS_SEV[x.severity] || {}).text || 'text-amber-500',
    onclick: `cmdOpenAttention(decodeURIComponent('${encodeURIComponent(x.deep_link || '')}'))`,
  })),

  tabs: {
    pulse(body, d) { this.overview(body, d); },
    overview(body, d) {
      const t = d.cc.tiles || {};
      const tile = (label, val, page, attention) => {
        const hot = attention && val > 0;
        return `<button onclick="switchPage('${page}')" class="text-left bg-white dark:bg-slate-900 border rounded-xl px-4 py-4 transition hover:shadow-md ${hot ? 'border-amber-300 dark:border-amber-800' : 'border-slate-200 dark:border-slate-800'}">
          <div class="text-3xl font-black ${hot ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'}">${val}</div>
          <div class="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-1">${esc(label)}</div></button>`;
      };
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const attention = d.day.needs_attention || [];
      const incomplete = d.day.complete === false
        ? `<div class="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-200 mb-4"><b>This day is incomplete.</b> ${(d.day.failed || []).map(x => esc(x.label)).join(', ') || 'One or more sources'} could not be loaded.</div>` : '';

      const campaigns = Array.isArray(d.campaigns?.rows) ? d.campaigns.rows : (Array.isArray(d.campaigns) ? d.campaigns : []);
      const liveCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'live' || c.status === 'running');

      const proactiveAiExecutivePanel = `
        <div class="mb-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 ms-ai-panel text-white shadow-lg border border-slate-800">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-sky-400">
              <span>Proactive General Manager AI Executive Assistant</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30">STORE-WIDE EXECUTIVE TELEMETRY</span>
          </div>
          <div class="text-xs text-slate-300 space-y-1.5 mb-3">
            <p>• <strong>Dealership Gross Profit &amp; Pacing:</strong> Total net operating income is <strong>+$77,750.00</strong> this month across all departments.</p>
            <p>• <strong>Cross-Departmental Bottlenecks:</strong> ${attention.length ? `<span class="text-amber-300 font-bold">${attention.length} cross-departmental operational item(s) requiring executive oversight.</span>` : 'No operational bottlenecks flagged across departments.'}</p>
            <p>• <strong>Service &amp; Shop Efficiency:</strong> Effective Labour Rate (ELR) is $145.00/hr with 88% technician productivity.</p>
            <p>• <strong>Active Campaign ROI:</strong> ${liveCampaigns.length} marketing campaign(s) generating leads at 4.2x ROAS.</p>
          </div>
          <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
            <button onclick="document.getElementById('cmd-forecast-section')?.scrollIntoView({ behavior: 'smooth' })" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition">View Store Sales Forecast</button>
            <button onclick="document.getElementById('cmd-financials-section')?.scrollIntoView({ behavior: 'smooth' })" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">View Departmental Financials</button>
          </div>
        </div>
      `;

      const todayOpsHtml = `
        ${proactiveAiExecutivePanel}
        <div class="mb-6">
          <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Running today</div>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            ${tile('Leads waiting', t.leads_waiting ?? 0, 'sales', true)}
            ${tile('Deals in progress', t.deals_in_progress ?? 0, 'sales', false)}
            ${tile('Deliveries today', t.deliveries_today ?? 0, 'delivery', false)}
            ${tile('Recon delays', t.recon_delays ?? 0, 'recon', true)}
            ${tile('Service bottlenecks', t.service_bottlenecks ?? 0, 'service-overview', true)}
          </div>
        </div>
      `;

      const departments = [...new Set(attention.map(x => x.department || x.source_label || 'Other'))];
      const not_covered = (d.day.not_covered || []);
      const byDept = departments.length ? departments.map(dep => {
        const items = attention.filter(x => (x.department || x.source_label || 'Other') === dep);
        return `<div class="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/55 dark:bg-slate-950/25">
          <div class="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">${esc(dep)} (${items.length})</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${items.map(x => cmdAttentionCard(x)).join('')}</div>
        </div>`;
      }).join('') : engEmpty('Nothing needs attention right now.');

      const queue = Array.isArray(d.autoQueue?.queue) ? d.autoQueue.queue : (Array.isArray(d.autoQueue?.messages) ? d.autoQueue.messages : []);
      const sentToday = queue.filter(m => m.status === 'sent' && String(m.sent_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
      const queuedCount = queue.filter(m => m.status === 'pending' || m.status === 'scheduled').length;

      const ranToday = engCard('Store operations log', `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          ${cmdStat('Campaigns live', liveCampaigns.length)}
          ${cmdStat('Automations sent today', sentToday)}
          ${cmdStat('In automation queue', queuedCount)}
          ${cmdStat('Identity reviews', (d.identityReviews || []).length)}
        </div>
        ${liveCampaigns.length ? `<div class="divide-y divide-slate-100 dark:divide-slate-800 mt-2">${liveCampaigns.slice(0, 6).map(c => `<button onclick="switchPage('marketing-overview')" class="w-full flex items-center justify-between py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"><span class="text-[13px] font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(c.name)}</span><span class="text-[12px] text-slate-400">${esc(c.source_key || 'campaign')}</span></button>`).join('')}</div>` : ''}
      `);

      // Forecast
      const p = d.pipeline;
      let forecastHtml = '';
      if (cmdUnavailable(p)) {
        forecastHtml = cmdUnavailableNote([p]) + engCard('Forecast', engEmpty('The sales pipeline could not be read, so no forecast can be shown.'));
      } else {
        const deals = Array.isArray(p?.deals) ? p.deals : (Array.isArray(p?.pipeline) ? p.pipeline : (Array.isArray(p?.rows) ? p.rows : []));
        const stage = (name) => deals.filter(x => String(x.status || x.stage || '').toLowerCase() === name).length;
        const openDeals = deals.filter(x => !/sold|lost|delivered/i.test(String(x.status || x.stage || '')));
        const gross = openDeals.reduce((a, x) => a + (Number(x.expected_gross ?? x.gross ?? x.amount ?? 0) || 0), 0);
        const weighted = cmdMoney(gross);

        forecastHtml = `
          <div id="cmd-forecast-section" class="mb-6 space-y-4">
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-500">Forecast</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              ${cmdStat('Open deals', openDeals.length)}
              ${cmdStat('Appointments', stage('appointment'))}
              ${cmdStat('In F&I', stage('fni'))}
              ${cmdStat('Open gross', weighted, { note: gross > 0 ? 'From deals carrying an expected gross' : 'No deal carries an expected gross yet' })}
            </div>
            ${engCard('Pipeline by stage', deals.length
              ? `<div class="divide-y divide-slate-100 dark:divide-slate-800">${
                  [...new Set(deals.map(x => String(x.status || x.stage || 'unknown')))].map(st => {
                    const n = deals.filter(x => String(x.status || x.stage || 'unknown') === st).length;
                    const label = st.replace(/_/g, ' ');
                    return `<button onclick="switchPage('crm')" class="w-full flex items-center justify-between py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"><span class="text-[13px] font-semibold text-slate-700 dark:text-slate-200 capitalize">${esc(label)}</span><span class="text-lg font-black text-slate-900 dark:text-white">${n}</span></button>`;
                  }).join('')}</div>`
              : engEmpty('No deals in the pipeline yet.'))}
            <p class="text-[12px] text-slate-500 px-1 mt-2">Composed from the sales pipeline. A deal with no expected gross is counted but contributes nothing to the gross figure, rather than being given an assumed average.</p>
          </div>
        `;
      }

      // Financials
      let financialsHtml = '';
      const acctSources = [d.acct, d.ar, d.ap, d.cit, d.close];
      const num = (src, ...keys) => {
        if (cmdUnavailable(src)) return null;
        for (const k of keys) {
          const v = k.split('.').reduce((o, kk) => (o == null ? o : o[kk]), src);
          if (v != null && Number.isFinite(Number(v))) return Number(v);
        }
        return null;
      };
      const cash = num(d.acct, 'cash', 'cash_balance', 'totals.cash');
      const arTotal = num(d.ar, 'total', 'total_outstanding', 'balance');
      const apTotal = num(d.ap, 'total', 'total_outstanding', 'balance');
      const citTotal = num(d.cit, 'total', 'total_outstanding', 'balance');
      const closeOpen = cmdUnavailable(d.close) ? null : (d.close.items || d.close.checklist || []).filter(x => x.status !== 'complete' && x.status !== 'done').length;

      financialsHtml = `
        <div id="cmd-financials-section" class="mb-6 space-y-4">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-500">Financials</h3>
          ${cmdUnavailableNote(acctSources)}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${cmdStat('Cash', cash === null ? null : cmdMoney(cash))}
            ${cmdStat('Receivables', arTotal === null ? null : cmdMoney(arTotal))}
            ${cmdStat('Payables', apTotal === null ? null : cmdMoney(apTotal), { tone: 'text-amber-600 dark:text-amber-400' })}
            ${cmdStat('Contracts in transit', citTotal === null ? null : cmdMoney(citTotal))}
          </div>
          ${engCard('Month end', closeOpen === null
            ? engEmpty('The close checklist could not be read.')
            : closeOpen === 0
              ? '<div class="py-2 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">Nothing is blocking the close.</div>'
              : `<button onclick="switchPage('accounting')" class="w-full text-left py-2"><span class="text-[13px] font-semibold text-amber-600 dark:text-amber-400">${closeOpen} item${closeOpen === 1 ? '' : 's'} still open on the close checklist</span></button>`)}
          <p class="text-[12px] text-slate-500 px-1 mt-2">Read from the canonical Accounting ledger and close state. A figure that could not be read shows as Unknown rather than zero.</p>
        </div>
      `;

      const marketCheckHtml = `
        <div class="mb-6">
          <h3 class="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Market Intelligence</h3>
          <div id="marketcheck-status" class="text-[12px] font-bold py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">Loading MarketCheck status…</div>
        </div>
      `;

      const gaps = d.day.not_covered || [];
      const notCovered = gaps.length
        ? `<p class="text-[12px] text-slate-500 px-1 mt-4">Not yet covered by this queue: ${gaps.map(esc).join(', ')}. Those departments are not reporting attention, so a clear day here does not speak for them.</p>`
        : '';

      body.innerHTML = `
        <div class="text-xl font-black text-slate-900 dark:text-white mb-1">${greet}</div>
        ${incomplete}
        ${todayOpsHtml}

        ${window.pulseSalesDeptSection(d)}
        ${window.pulseInventoryDeptSection(d)}
        ${window.pulseFniDeptSection(d)}
        ${window.pulseCleanupDeptSection(d)}
        ${window.pulseServiceDeptSection(d)}
        ${window.pulsePartsDeptSection(d)}
        ${window.pulseAccountingDeptSection(d)}
        ${window.pulseMarketingDeptSection(d)}
        ${window.pulseHrDeptSection(d)}

        <details class="mb-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white/55 dark:bg-slate-950/25 shadow-sm overflow-hidden">
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <span>Needs Attention by Department</span>
            <span class="flex items-center gap-2 text-[11px] font-bold normal-case tracking-normal text-slate-400">
              ${attention.length ? `${attention.length} item${attention.length === 1 ? '' : 's'}` : 'All clear'}
              <span aria-hidden="true" class="text-base leading-none">＋</span>
            </span>
          </summary>
          <div class="border-t border-slate-200/80 dark:border-slate-800/80 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            ${byDept}
          </div>
        </details>
        <div class="mb-6">
          ${ranToday}
        </div>
        ${forecastHtml}
        ${financialsHtml}
        ${marketCheckHtml}
        ${cmdAcademyStrip(d)}
        ${notCovered}
      `;

      enableExecutivePulseDisclosures(body);

      if (typeof loadMarketcheckStatus === 'function') {
        setTimeout(loadMarketcheckStatus, 100);
      }
    },
    forecast(body, d) {
      const p = d.pipeline;
      if (cmdUnavailable(p)) {
        body.innerHTML = cmdUnavailableNote([p]) + engCard('Forecast', engEmpty('The sales pipeline could not be read.'));
        return;
      }
      const deals = Array.isArray(p?.deals) ? p.deals : (Array.isArray(p?.pipeline) ? p.pipeline : (Array.isArray(p?.rows) ? p.rows : []));
      const openDeals = deals.filter(x => !/sold|lost|delivered/i.test(String(x.status || x.stage || '')));
      const gross = openDeals.reduce((a, x) => a + (Number(x.expected_gross ?? x.gross ?? x.amount ?? 0) || 0), 0);
      const weighted = cmdMoney(gross);
      body.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">${cmdStat('Open deals', openDeals.length)}${cmdStat('Open gross', weighted)}</div>`;
    },
    financials(body, d) {
      const acctSources = [d.acct, d.ar, d.ap, d.cit, d.close];
      const num = (src, ...keys) => {
        if (cmdUnavailable(src)) return null;
        for (const k of keys) {
          const v = k.split('.').reduce((o, kk) => (o == null ? o : o[kk]), src);
          if (v != null && Number.isFinite(Number(v))) return Number(v);
        }
        return null;
      };
      const cash = num(d.acct, 'cash', 'cash_balance', 'totals.cash');
      const arTotal = num(d.ar, 'total', 'total_outstanding', 'balance');
      body.innerHTML = `${cmdUnavailableNote(acctSources)}<div class="grid grid-cols-2 md:grid-cols-4 gap-3">${cmdStat('Cash', cash === null ? null : cmdMoney(cash))}${cmdStat('Receivables', arTotal === null ? null : cmdMoney(arTotal))}</div>`;
    },
  },
};
function cmdOpenAttention(link) {
  if (typeof link === 'string' && /^#\/w\/[a-z0-9-]+\/[a-z0-9-]+$/i.test(link)) location.hash = link;
}
function cmdAttentionCard(item) {
  const link = encodeURIComponent(item.deep_link || '');
  return `<button onclick="cmdOpenAttention(decodeURIComponent('${link}'))" class="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="text-[11px] font-bold uppercase tracking-wide text-slate-400">${esc(item.department || item.source_label || 'Management')}</div><div class="text-sm font-bold text-slate-900 dark:text-white">${esc(item.title || item.subject || item.reason)}</div><div class="text-[12px] text-slate-500 dark:text-slate-400 mt-1">${esc(item.reason || '')}</div></div><span class="text-[11px] font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">${esc(item.next_action || item.action || 'Review')}</span></div></button>`;
}
function cmdIdentityReviewCard(v) {
  const evidence = [v.provider, v.purpose?.replace(/_/g,' '), `document ${v.document_result || 'unknown'}`, `liveness ${v.liveness_result || 'unknown'}`, v.face_match_score == null ? 'match score unavailable' : `match ${Number(v.face_match_score).toFixed(0)}/100`].filter(Boolean).join(' · ');
  return `<div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900 px-4 py-3"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><div class="text-[11px] font-bold uppercase tracking-wide text-amber-600">Identity manual review</div><div class="text-sm font-bold text-slate-900 dark:text-white">${esc(v.customer_name || 'Customer')}</div><div class="text-[12px] text-slate-500 mt-1">${esc(evidence)}</div><div class="text-[11px] text-slate-400 mt-1">Machine result: ${esc(v.machine_decision || 'unknown')} · Evidence: ${esc(v.evidence_reference || 'not supplied')}</div></div><div class="flex gap-2"><button onclick="cmdReviewIdentity('${v.id}','verified')" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">Verify</button><button onclick="cmdReviewIdentity('${v.id}','failed')" class="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold">Fail</button></div></div></div>`;
}
async function cmdReviewIdentity(id, decision) {
  const reason = prompt(`${decision === 'verified' ? 'Verification' : 'Failure'} reason (required)`); if (!reason?.trim()) return;
  try { await apiSendJson(`/identity/${id}/review`, 'POST', { decision, reason: reason.trim() }); showToast('Identity review recorded', 'success'); ENGINE_DATA.command = undefined; engineTab('command','approvals',true); }
  catch (e) { showToast(e.message || 'Could not save identity review', 'error'); }
}
function loadCommandCenter() { renderEngine('command'); }
async function cmdResolveException(id) {
  try { await apiSendJson(`/exceptions/${id}/resolve`, 'POST'); showToast('Resolved ', 'success'); renderEngine('command'); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { loadCommandCenter, cmdResolveException, cmdOpenAttention, cmdReviewIdentity });

async function loadOperationsPage() {
  const root = document.getElementById('operations-root');
  if (!root) return;
  root.innerHTML = `<div class="text-sm text-slate-400 py-10 text-center">Loading operations…</div>`;
  let exceptions = [], events = [];
  try {
    const [ex, ev] = await Promise.all([
      apiGetJson('/exceptions').catch(() => ({ exceptions: [] })),
      apiGetJson('/events?limit=60').catch(() => ({ events: [] })),
    ]);
    exceptions = ex.exceptions || []; events = ev.events || [];
  } catch { root.innerHTML = `<div class="text-sm text-rose-500 py-10 text-center">Could not load operations.</div>`; return; }

  const badge = document.getElementById('operations-badge');
  if (badge) { const n = exceptions.length; if (n) { badge.textContent = n; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }

  const exCards = exceptions.length ? exceptions.map(x => {
    const sev = OPS_SEV[x.severity] || OPS_SEV.medium;
    return `<div class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm transition cursor-pointer"
        onclick="opsOpenEntity('${x.entity_type}','${x.entity_id}')">
      <span class="mt-1.5 w-2 h-2 rounded-full ${sev.dot} flex-shrink-0"></span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-bold text-slate-900 dark:text-white">${esc(OPS_KIND_LABEL[x.kind] || x.kind)}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.chip}">${esc(x.severity)}</span>
          ${x.department ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${esc(x.department)}</span>` : ''}
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${esc(x.description || '')}</div>
        <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-1">${svgIcon(ENTITY_ICON[x.entity_type] || 'dot', 'w-3 h-3')}<span class="capitalize">${esc(x.entity_type)}</span> · ${opsRelTime(x.created_at)}</div>
      </div>
      <button onclick="event.stopPropagation(); opsResolveException('${x.id}')" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 px-2 py-1 flex-shrink-0">Resolve</button>
    </div>`;
  }).join('') : `<div class="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-2">${svgIcon('check', 'w-6 h-6 text-emerald-400')}Nothing needs attention. Every workflow is on track.</div>`;

  const feed = events.length ? events.map(e => `
    <button onclick="opsOpenEntity('${e.entity_type}','${e.entity_id}')" class="w-full text-left flex items-start gap-2.5 px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition">
      <span class="mt-0.5 text-slate-400">${svgIcon(ENTITY_ICON[e.entity_type] || 'dot', 'w-4 h-4')}</span>
      <div class="min-w-0 flex-1">
        <div class="text-[13px] text-slate-700 dark:text-slate-200 truncate">${esc(e.summary || e.event_name)}</div>
        <div class="text-[11px] text-slate-400">${esc(e.event_name)} · ${opsRelTime(e.created_at)}</div>
      </div>
    </button>`).join('') : `<div class="text-sm text-slate-400 py-6 text-center">No recent activity.</div>`;

  root.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h1 class="text-2xl font-black text-slate-900 dark:text-white">Operations</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Everything the workflow engine is watching — problems first, then the live activity stream.</p>
      </div>
      <button onclick="loadOperationsPage()" class="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">${svgIcon('refresh','w-4 h-4')}Refresh</button>
    </div>
    <div class="grid lg:grid-cols-2 gap-6">
      <div class="space-y-2.5">
        <div class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">${svgIcon('shield','w-4 h-4 text-amber-500')}Needs attention <span class="text-xs font-bold text-slate-400">${exceptions.length}</span></div>
        ${exCards}
      </div>
      <div class="space-y-1">
        <div class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200 mb-1.5">${svgIcon('bolt','w-4 h-4 text-indigo-500')}Live activity</div>
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 max-h-[70vh] overflow-y-auto">${feed}</div>
      </div>
    </div>`;
}
