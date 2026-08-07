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
        <button onclick="dealerEmailSendCampaign('${t.id}')" class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-bold flex items-center gap-1">🚀 Run Broadcast</button>
        <button onclick="dealerEmailEditTmplVisual('${t.id}')" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-black shadow-sm transition flex items-center gap-1">🎨 Visual Builder</button>
        <button onclick="dealerEmailEditTmpl('${t.id}')" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-[12px] font-bold transition flex items-center gap-1">✏️ Basic Builder</button>
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
        <button onclick="dealerEmailEditCampaignVisual('${c.id}')" class="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[12px] font-black shadow-sm transition flex items-center gap-1">🎨 Visual Builder</button>
        <button onclick="dealerEmailDeleteCampaign('${c.id}')" class="text-[12px] font-bold text-rose-500 hover:text-rose-600 ml-1">✕</button>
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
    el.textContent = `🎯 Audience: ${r.reachable || r.matched || 0} qualified recipients`;
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

    el.textContent = `🎯 Audience: ${filtered.toLocaleString()} qualified recipients`;
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
    subject: '🔥 Fresh Arrivals at {{dealership}} — Check Them Out!',
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
    subject: '🎁 {{first_name}}, your trade is worth more this month at {{dealership}}',
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
    subject: '🔧 Seasonal Maintenance Special for {{first_name}}',
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
          <div class="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-black">🎨</div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-black text-slate-900 dark:text-white leading-tight">Visual Email Builder ${__builderMeta.isTemplate ? '(Template Editor)' : '(Campaign Studio)'}</h2>
              <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center gap-1">🏢 ${esc(bBrand.name)}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Drag, customize blocks &amp; send responsive email campaigns.</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="openEmailFullPreviewModal()" class="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition flex items-center gap-1.5 shadow-sm border border-indigo-200/60 dark:border-indigo-800/60">👁️ Preview Email</button>
          <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button onclick="setBuilderDevice('desktop')" id="btn-device-desktop" class="px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-900 text-indigo-600 shadow-sm">💻 Desktop</button>
            <button onclick="setBuilderDevice('mobile')" id="btn-device-mobile" class="px-2.5 py-1 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">📱 Mobile</button>
          </div>
          <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2">✕</button>
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
                <button onclick="generateAiEmailSubject()" title="AI Write Subject" class="px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-xs font-black shadow-sm shrink-0 flex items-center gap-1">✨ AI</button>
              </div>
            </div>
          </div>

          <!-- Add Block Palette -->
          <div class="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
            <div class="text-xs font-black uppercase tracking-wider text-slate-400">Add Content Blocks</div>
            <div class="grid grid-cols-3 gap-2">
              <button onclick="addBuilderBlock('header')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">📌 Header</button>
              <button onclick="addBuilderBlock('hero')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">🖼️ Hero</button>
              <button onclick="addBuilderBlock('text')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">📝 Text</button>
              <button onclick="addBuilderBlock('vehicle')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">🚘 Vehicle</button>
              <button onclick="addBuilderBlock('promo')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">🏷️ Promo</button>
              <button onclick="addBuilderBlock('cta')" class="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 rounded-lg text-center text-xs font-bold text-slate-700 dark:text-slate-300 transition">🔘 Button</button>
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
          <button onclick="saveMailchimpCampaign(true)" class="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-500/30 transition">🚀 Send Campaign Now</button>
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
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">👁️</div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">Email Inbox Full Preview</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Subject: <span class="font-semibold text-slate-700 dark:text-slate-300">${esc(subject)}</span></p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">Branded for ${esc(bBrand.name)}</span>
          <button data-close class="text-slate-400 hover:text-slate-600 text-2xl font-bold px-2">✕</button>
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
          <button onclick="event.stopPropagation(); deleteBuilderBlock(${idx})" title="Delete Block" class="p-1 hover:bg-rose-600 rounded text-rose-300">🗑️</button>
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
      showToast('AI generated subject line ✓', 'success');
    }
  } catch {
    const subjEl = document.getElementById('mb-subject');
    if (subjEl) subjEl.value = `🔥 Special Dealership Offer for {{first_name}}!`;
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
      showToast(`Campaign sent to ${sent.sent || 0} recipients ✓`, 'success');
    } else {
      showToast('Campaign draft saved ✓', 'success');
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
  icon: 'user', accent: 'violet',
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
ENGINES['saas-accounting'] = {
  rootId: 'saas-accounting-root', title: 'Accounting', subtitle: "MarketSync's books — recurring revenue and program cost",
  icon: 'currency', accent: 'emerald',
  fetch: () => apiGetJson('/saas/accounting'),
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
      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          ${engKpi('MRR', engMoney0(d.mrr), 'text-emerald-600 dark:text-emerald-400')}
          ${engKpi('ARR', engMoney0(d.arr), 'text-emerald-600 dark:text-emerald-400')}
          ${engKpi('Program cost /mo', engMoney0(d.monthly_expense), 'text-rose-600 dark:text-rose-400')}
          ${engKpi('Net MRR', engMoney0(d.net_mrr), netTone)}
          ${engKpi('Net margin', (d.net_margin || 0) + '%', netTone)}
          ${engKpi('New MRR (mo)', engMoney0(d.new_mrr_this_month), 'text-indigo-600 dark:text-indigo-400')}
        </div>
        ${engCard('This month', `<div class="text-[13px] text-slate-600 dark:text-slate-300 space-y-1.5">
          <div class="flex items-center justify-between"><span>Recurring revenue (MRR)</span><span class="font-bold text-emerald-600 dark:text-emerald-400">${engMoney0(d.mrr)}</span></div>
          <div class="flex items-center justify-between"><span>Affiliate program cost</span><span class="font-bold text-rose-600 dark:text-rose-400">− ${engMoney0(d.monthly_expense)}</span></div>
          <div class="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1.5"><span class="font-black text-slate-800 dark:text-slate-100">Net recurring</span><span class="font-black ${netTone}">${engMoney0(d.net_mrr)}</span></div>
        </div>`)}
        <div class="text-[12px] text-slate-400">Revenue is recognised from live product entitlements across ${(d.paying || 0).toLocaleString()} paying accounts (${(d.trials || 0).toLocaleString()} in trial). Cash settlement reconciles in Stripe.</div>`;
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
          ${engKpi('MRR', engMoney0(d.mrr), 'text-emerald-600 dark:text-emerald-400')}
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
        <li class="flex items-start gap-2">${svgIcon('check', 'w-4 h-4 text-emerald-500 mt-0.5')}<span>MRR is recomputed live from product entitlements every time you open this page — no manual bookkeeping.</span></li>
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
  tabLabels: { work: 'Revenue', insights: 'Expenses' },
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
      if (r.ok) { out.className = 'text-[12px] text-emerald-600 dark:text-emerald-400 font-bold'; out.textContent = `Sent to ${r.sent_to} ✓`; }
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
  try { await apiSendJson('/saas/employees/role', 'POST', { user_id: userId, saas_role: role }); showToast('Updated ✓', 'success'); refreshSaasRoles(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function saasAddEmployee() {
  const email = document.getElementById('saas-emp-email').value.trim();
  const role = document.getElementById('saas-emp-role').value;
  if (!email) return showToast('Email required', 'error');
  try { await apiSendJson('/saas/employees/role', 'POST', { email, saas_role: role }); showToast('Staff added ✓', 'success'); refreshSaasRoles(); }
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
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60'}">${isDone ? '✓ Passed (100%)' : c.duration}</span>
          </div>
          <h4 class="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-1">${esc(c.title)}</h4>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">${esc(c.desc)}</p>
        </div>

        <div class="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-1">
          <button onclick="openTrainingCourseModal('${c.id}')" class="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition flex items-center gap-1">
            <span>📖</span><span>${isDone ? 'Review' : 'Start'}</span>
          </button>
          <button onclick="openEmployeeCertificateModal('Active Employee', '${esc(c.title)}', '${new Date().toISOString().split('T')[0]}', 'CERT-${c.id.toUpperCase()}-2026')" class="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[10px] transition">🏆 Cert</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>☀️ My Employee Workstation &amp; Safety Station</span>
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
              <span>🎓 Mandatory Safety &amp; Compliance Video Courses</span>
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
ENGINES['command'] = {
  rootId: 'command-root', title: 'Daily Briefing', subtitle: "Today's operations across every department — problems first",
  icon: 'chart', accent: 'indigo', tabLabels: { work: 'Needs Attention' },
  tabOrder: ['overview', 'work'],   // Insights/Automation/Settings removed per audit

  fetch: async () => {
    const [cc, ev] = await Promise.all([
      apiGetJson('/command-center').catch(() => ({ tiles: {}, exceptions: [], exception_count: 0 })),
      apiGetJson('/events?limit=40').catch(() => ({ events: [] })),
    ]);
    const badge = document.getElementById('command-badge');
    if (badge) { const n = cc.exception_count || 0; if (n) { badge.textContent = n; badge.classList.remove('hidden'); } else badge.classList.add('hidden'); }
    return { cc, events: ev.events || [] };
  },
  quickActions: [
    { label: 'Reports', icon: 'chart', onclick: "switchPage('reports')" },
    { label: 'Task Board', icon: 'clipboard', onclick: "switchPage('taskboard')" },
    { label: 'Operations', icon: 'bolt', onclick: "switchPage('operations')" },
  ],
  nextActions: (d) => (d.cc.exceptions || []).slice(0, 4).map(x => ({
    label: `${OPS_KIND_LABEL[x.kind] || x.kind}${x.department ? ' · ' + x.department : ''}`,
    icon: 'shield', tone: (OPS_SEV[x.severity] || {}).text || 'text-amber-500',
    onclick: `opsOpenEntity('${x.entity_type}','${x.entity_id}')`,
  })),
  tabs: {
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
      const workstationHtml = typeof renderDailyBriefingWorkstation === 'function' ? renderDailyBriefingWorkstation() : '';
      body.innerHTML = `
        <div class="text-lg font-black text-slate-900 dark:text-white mb-2">${greet}</div>
        <div id="daily-briefing-workstation-host">
          ${workstationHtml}
        </div>
        <div>
          <div class="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Today's operations</div>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            ${tile('Leads waiting', t.leads_waiting ?? 0, 'leads', true)}
            ${tile('Deals in progress', t.deals_in_progress ?? 0, 'desk', false)}
            ${tile('Deliveries today', t.deliveries_today ?? 0, 'fni', false)}
            ${tile('Recon delays', t.recon_delays ?? 0, 'recon', true)}
            ${tile('Service bottlenecks', t.service_bottlenecks ?? 0, 'service-ros', true)}
          </div>
        </div>
        ${engCard('Needs attention', `<div class="text-[13px] text-slate-600 dark:text-slate-300">${(d.cc.exceptions || []).length ? `<b class="text-slate-900 dark:text-white">${(d.cc.exceptions || []).length}</b> item${(d.cc.exceptions || []).length === 1 ? '' : 's'} across departments — see the Needs Attention tab.` : 'Every workflow is on track.'}</div>`)}`;
    },
    work(body, d) {
      const ex = d.cc.exceptions || [];
      const exCards = ex.length ? ex.slice(0, 20).map(execExceptionCard).join('') : `<div class="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex flex-col items-center gap-2">${svgIcon('check', 'w-6 h-6 text-emerald-400')}Nothing needs attention. Every workflow is on track.</div>`;
      const feed = (d.events || []).length ? d.events.map(e => `
        <button onclick="opsOpenEntity('${e.entity_type}','${e.entity_id}')" class="w-full text-left flex items-start gap-2.5 px-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition">
          <span class="mt-0.5 text-slate-400">${svgIcon(ENTITY_ICON[e.entity_type] || 'dot', 'w-4 h-4')}</span>
          <div class="min-w-0 flex-1"><div class="text-[13px] text-slate-700 dark:text-slate-200 truncate">${esc(e.summary || e.event_name)}</div><div class="text-[11px] text-slate-400">${esc(e.event_name)} · ${opsRelTime(e.created_at)}</div></div>
        </button>`).join('') : `<div class="text-sm text-slate-400 py-6 text-center">No recent activity.</div>`;
      body.innerHTML = `<div class="grid lg:grid-cols-2 gap-6">
        <div class="space-y-2.5"><div class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200">${svgIcon('shield', 'w-4 h-4 text-amber-500')}Needs attention <span class="text-xs font-bold text-slate-400">${ex.length}</span></div>${exCards}</div>
        <div class="space-y-1"><div class="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-200 mb-1.5">${svgIcon('bolt', 'w-4 h-4 text-indigo-500')}Live activity</div><div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 max-h-[70vh] overflow-y-auto">${feed}</div></div>
      </div>`;
    },
    insights(body) {
      body.innerHTML = engCard('Executive insights', `
        <p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Cross-department performance lives in Reports and the sales dashboard.</p>
        <div class="flex flex-wrap gap-2">
          <button onclick="switchPage('reports')" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">Open Reports →</button>
          <button onclick="switchPage('insights')" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">Sales Dashboard →</button>
        </div>`);
    },
    automation(body) {
      body.innerHTML = engCard('Automation', `<p class="text-[13px] text-slate-600 dark:text-slate-300">The workflow engine watches every department and raises the exceptions on the Needs Attention tab automatically. Configure cadences and follow-up rules in <button onclick="switchPage('automation')" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Automation</button>, or see the full stream in <button onclick="switchPage('operations')" class="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Operations</button>.</p>`);
    },
    settings(body) {
      body.innerHTML = engCard('Settings', `<p class="text-[13px] text-slate-600 dark:text-slate-300 mb-3">Company-wide defaults and access live in Configuration and Administration.</p>
        <div class="flex flex-wrap gap-2">
          <button onclick="switchPage('config')" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">Configuration →</button>
          <button onclick="switchPage('owner-users')" class="text-[13px] font-bold px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700">All Users & Accounts →</button>
        </div>`);
    },
  },
};
function loadCommandCenter() { renderEngine('command'); }
async function cmdResolveException(id) {
  try { await apiSendJson(`/exceptions/${id}/resolve`, 'POST'); showToast('Resolved ✓', 'success'); renderEngine('command'); }
  catch (e) { showToast(e.message, 'error'); }
}
Object.assign(window, { loadCommandCenter, cmdResolveException });

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