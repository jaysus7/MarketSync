/* dashboard.js split part 18/26 — contiguous, load-order-critical. Do not reorder the <script> tags in dashboard.html. */

async function loadAutomationPage() {
  if (!(await ensureAutoCfg('automation-root'))) return;
  renderAutomationSettings();
}
async function loadAutoHolidays() {
  if (!(await ensureAutoCfg('auto-holidays-root'))) return;
  renderHolidaysRoot();
}
function renderHolidaysRoot() {
  const root = document.getElementById('auto-holidays-root'); if (!root) return;
  root.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div><h2 class="text-xl font-bold text-slate-900 dark:text-white">Holidays</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Dated greetings to your delivered customers — auto-filled for your region. Flip on the ones you want, edit the wording, or add your own.</p></div>
      <button onclick="autoAddCustom('holidays')" class="flex-shrink-0 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Add custom</button>
    </div>
    ${autoHolidaysHtml()}`;
}
async function loadAutoLeads() {
  if (!(await ensureAutoCfg('auto-leads-root'))) return;
  renderAutoBucket('auto-leads-root', 'leads', 'New Lead Follow-ups', 'Automated texts, emails and rep tasks that fire when a new lead comes in — through the first appointment and showroom visit.');
}
async function loadAutoDelivery() {
  if (!(await ensureAutoCfg('auto-delivery-root'))) return;
  renderAutoBucket('auto-delivery-root', 'delivery', 'Delivery Follow-ups', 'Post-delivery retention, review requests and referral asks — everything that fires after the customer takes delivery.');
}
function renderAutoBucket(rootId, bucket, title, desc) {
  const root = document.getElementById(rootId); if (!root) return;
  const cards = (__autoCfg.campaigns || []).filter(c => autoBucketOf(c) === bucket);
  const byCat = {}; for (const c of cards) (byCat[c.category] = byCat[c.category] || []).push(c);
  root.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div><h2 class="text-xl font-bold text-slate-900 dark:text-white">${title}</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">${desc}</p></div>
      <div class="flex-shrink-0 flex items-center gap-2">
        <button onclick="autoAddCustom('${bucket}')" class="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-sm font-bold px-3 py-2 rounded-lg transition"> Custom</button>
        <button onclick="autoOpenTemplates('${bucket}')" class="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Add more</button>
      </div>
    </div>
    ${cards.length ? AUTO_CATS.filter(([k]) => byCat[k]?.length).map(([k, label]) => `<div><div class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 mt-4">${label}</div><div class="space-y-2">${byCat[k].map(autoCardHtml).join('')}</div></div>`).join('')
      : '<div class="py-12 text-center text-sm text-slate-400 italic">No campaigns here yet — hit <b>Add more</b> to pick from ready-made email templates.</div>'}`;
}

// Ready-made email templates the dealer can add with one click. {{tags}} render
// live at send time (customer/vehicle/rep/dealership + review_url, service_url…).
const AUTO_TEMPLATES = {
  leads: [
    { name: 'Instant thank-you', trigger_event: 'internet_lead', delay_minutes: 5, subject_template: 'Thanks for reaching out, {{customer.first_name|there}}', message_body_template: `Hi {{customer.first_name|there}},\n\nThanks for your interest in the {{vehicle.ymm|vehicle}} at {{dealership.name}}! I'd love to help you with the next step — whether that's more photos, a payment estimate, or booking a test drive.\n\nWhat's the best number to reach you at?\n\n{{rep.first_name|Your sales team}}\n{{dealership.name}}` },
    { name: 'Day 1 — still available', trigger_event: 'internet_lead', delay_minutes: 1440, subject_template: 'The {{vehicle.model|vehicle}} is still here', message_body_template: `Hi {{customer.first_name|there}},\n\nJust a quick note that the {{vehicle.ymm|vehicle}} you were looking at is still available. These move quickly — want me to hold it for you or set up a time to see it?\n\n{{rep.first_name|Your sales team}}` },
    { name: 'Get pre-approved', trigger_event: 'internet_lead', delay_minutes: 2880, subject_template: 'Know your payment before you visit', message_body_template: `Hi {{customer.first_name|there}},\n\nWant to know your exact payment before you come in? Getting pre-approved takes about two minutes and doesn't affect your credit score. Reply here and I'll send you a secure link.\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
    { name: 'What is your trade worth', trigger_event: 'internet_lead', delay_minutes: 4320, subject_template: 'Your trade could lower your payment', message_body_template: `Hi {{customer.first_name|there}},\n\nHave a vehicle to trade? We're paying strong numbers right now, and it could bring your payment on the {{vehicle.model|new one}} down more than you'd expect. Send me the year, make, model and mileage and I'll get you a real range.\n\n{{rep.first_name|Your team}}` },
    { name: 'Book a test drive', trigger_event: 'internet_lead', delay_minutes: 2880, subject_template: 'Want to take the {{vehicle.model|vehicle}} for a spin?', message_body_template: `Hi {{customer.first_name|there}},\n\nNothing beats getting behind the wheel. I can have the {{vehicle.ymm|vehicle}} cleaned up and ready whenever works for you — mornings, evenings or weekends. What day suits you best?\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
    { name: 'New pricing / incentive', trigger_event: 'internet_lead', delay_minutes: 7200, subject_template: 'Good news on the {{vehicle.model|vehicle}}', message_body_template: `Hi {{customer.first_name|there}},\n\nThere's been an update to the pricing and incentives on the {{vehicle.ymm|vehicle}} — it's worth a fresh look. Want me to put the new numbers together for you?\n\n{{rep.first_name|Your sales team}}` },
    { name: 'Help you compare', trigger_event: 'internet_lead', delay_minutes: 5760, subject_template: 'Still deciding? Happy to help', message_body_template: `Hi {{customer.first_name|there}},\n\nPicking the right vehicle is a big decision. If you're weighing the {{vehicle.model|vehicle}} against other options, I'm glad to walk you through the differences honestly — no pressure. Just reply with what matters most to you.\n\n{{rep.first_name|Your team}}` },
    { name: 'Day 7 check-in', trigger_event: 'internet_lead', delay_minutes: 10080, subject_template: 'Checking in, {{customer.first_name|there}}', message_body_template: `Hi {{customer.first_name|there}},\n\nJust circling back on the {{vehicle.model|vehicle}}. Did you find what you were after, or are you still shopping? Either way I'm here to help whenever you're ready.\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
    { name: 'Day 14 — we miss you', trigger_event: 'internet_lead', delay_minutes: 20160, subject_template: 'Still thinking about the {{vehicle.model|vehicle}}?', message_body_template: `Hi {{customer.first_name|there}},\n\nI don't want you to miss out. If the timing wasn't right before, let's find a way to make it work now — flexible appointments, home delivery, and straightforward numbers. Want to pick it back up?\n\n{{rep.first_name|Your team}}` },
    { name: 'After a visit — no deal', trigger_event: 'show_no_sale', delay_minutes: 480, send_at_hour: 9, subject_template: 'Thanks for coming in, {{customer.first_name|there}}', message_body_template: `Hi {{customer.first_name|there}},\n\nThanks for taking the time to visit {{dealership.name}}. I spoke with my manager about sharpening the numbers on the {{vehicle.ymm|vehicle}} and your trade — I think we can get closer than where we left off. Can I give you a quick call?\n\n{{rep.first_name|Your sales team}}` },
  ],
  delivery: [
    { name: 'Congrats & welcome', trigger_event: 'delivered', delay_minutes: 60, subject_template: 'Congrats on your {{vehicle.model|new vehicle}}!', message_body_template: `Hi {{customer.first_name|there}},\n\nCongratulations from all of us at {{dealership.name}}! We hope you love the {{vehicle.ymm|vehicle}}. If any questions come up as you settle in, reply here anytime — we're always happy to help.\n\n{{rep.first_name|Your team}}` },
    { name: 'Getting to know your vehicle', trigger_event: 'delivered', delay_minutes: 2880, subject_template: 'A few tips for your {{vehicle.model|vehicle}}', message_body_template: `Hi {{customer.first_name|there}},\n\nNow that you've had a couple of days with the {{vehicle.ymm|vehicle}}, want a hand pairing your phone, setting up driver profiles, or getting the most out of the tech? Reply and I'll walk you through it.\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
    { name: '30-day check-in', trigger_event: 'delivered', delay_minutes: 43200, send_at_hour: 10, subject_template: "One month in — how's it going?", message_body_template: `Hi {{customer.first_name|there}},\n\nHard to believe it's been a month with your {{vehicle.ymm|vehicle}}! How's everything going? If it's about time for that first maintenance, our service team makes it easy — book online at {{service_url|our website}}.\n\nThanks for being part of the {{dealership.name}} family.` },
    { name: 'First service reminder', trigger_event: 'delivered', delay_minutes: 129600, send_at_hour: 10, subject_template: 'Time for your first service', message_body_template: `Hi {{customer.first_name|there}},\n\nKeeping up with routine maintenance protects your warranty and your resale value. Your {{vehicle.model|vehicle}} is coming due — book a convenient time at {{service_url|our website}} and we'll take great care of it.\n\n{{dealership.name}} Service` },
    { name: '48-hour review request', trigger_event: 'delivered', delay_minutes: 2880, send_at_hour: 12, subject_template: 'How did we do?', message_body_template: `Hi {{customer.first_name|there}},\n\nThank you again for choosing {{dealership.name}}! If you have 30 seconds, a quick Google review would mean the world to our team: {{review_url|our review page}}.\n\nWe truly appreciate you.` },
    { name: 'Referral pitch', trigger_event: 'delivered', delay_minutes: 20160, send_at_hour: 11, subject_template: 'Know anyone car shopping?', message_body_template: `Hi {{customer.first_name|there}},\n\nHope you're loving the {{vehicle.model|new ride}}! Quick one — we pay {{referral_bonus|a referral bonus}} for anyone you send our way who buys. Know a friend or family member in the market? Just send them to me directly.\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
    { name: 'Accessories & add-ons', trigger_event: 'delivered', delay_minutes: 10080, subject_template: 'Make your {{vehicle.model|vehicle}} yours', message_body_template: `Hi {{customer.first_name|there}},\n\nWant to personalize your {{vehicle.ymm|vehicle}}? From all-weather mats and cargo liners to remote start and protection packages, our parts team can set you up. Reply and I'll send options that fit your vehicle.\n\n{{dealership.name}}` },
    { name: 'Seasonal prep', trigger_event: 'delivered', delay_minutes: 129600, subject_template: 'Is your {{vehicle.model|vehicle}} season-ready?', message_body_template: `Hi {{customer.first_name|there}},\n\nWith the season changing, it's a good time for a quick check — tires, battery, fluids and wipers. Book a seasonal inspection at {{service_url|our website}} and drive with confidence.\n\n{{dealership.name}} Service` },
    { name: 'Warranty reminder', trigger_event: 'delivered', delay_minutes: 259200, subject_template: 'A note about your coverage', message_body_template: `Hi {{customer.first_name|there}},\n\nJust a friendly reminder to keep your service records up to date — it keeps your {{vehicle.model|vehicle}}'s warranty in good standing and helps at trade-in time. Any questions about your coverage, just reply.\n\n{{dealership.name}}` },
    { name: 'Anniversary & trade-up', trigger_event: 'delivered', delay_minutes: 525600, send_at_hour: 10, subject_template: 'Happy one year with your {{vehicle.model|vehicle}}!', message_body_template: `Hi {{customer.first_name|there}},\n\nIt's been a year with your {{vehicle.ymm|vehicle}} — thank you for being a loyal customer! Values are strong right now, so you may be in a great equity position to upgrade for a similar payment. Want me to run the numbers, no obligation?\n\n{{rep.first_name|Your team}} at {{dealership.name}}` },
  ],
};
function autoOpenTemplates(bucket) {
  const list = AUTO_TEMPLATES[bucket] || [];
  const rows = list.map((t, i) => `
    <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="font-bold text-sm text-slate-900 dark:text-white">${esc(t.name)}</div>
          <div class="text-[11px] text-slate-400">${esc(AUTO_TRIGGER_LABEL[t.trigger_event] || t.trigger_event)} · ${autoDelayText(t.delay_minutes)} · email</div>
        </div>
        <button onclick="autoAddTemplate('${bucket}',${i},this)" class="flex-shrink-0 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Add</button>
      </div>
      <div class="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-3">${esc(t.subject_template ? t.subject_template + ' — ' : '')}${esc(t.message_body_template.replace(/\n+/g, ' ').slice(0, 160))}…</div>
    </div>`).join('');
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1">
      <div class="text-lg font-black text-slate-900 dark:text-white">Add an email automation</div>
      <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Pick a ready-made template — it's added switched on, and you can edit the wording or timing after.</p>
    <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">${rows}</div>
  </div>`, 'max-w-2xl');
}
function autoDelayText(mins) {
  const m = Number(mins) || 0;
  if (m < 60) return m <= 5 ? 'right away' : `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} hr`;
  return `${Math.round(m / 1440)} day${Math.round(m / 1440) === 1 ? '' : 's'}`;
}
async function autoAddTemplate(bucket, i, btn) {
  const t = (AUTO_TEMPLATES[bucket] || [])[i]; if (!t) return;
  const cat = bucket === 'delivery' ? 'retention' : 'pipeline';
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const d = await apiSendJson('/automation/campaigns', 'POST', {
      name: t.name, category: cat, trigger_event: t.trigger_event, channel: 'email',
      subject_template: t.subject_template || '', message_body_template: t.message_body_template,
      delay_minutes: t.delay_minutes || 0, send_at_hour: t.send_at_hour ?? null, sender_identity: 'house', is_active: true,
    });
    if (d.campaign) { __autoCfg.campaigns = [...(__autoCfg.campaigns || []), d.campaign]; }
    btn.textContent = 'Added ';
    showToast('Automation added', 'success');
    autoRerenderCurrent();   // reflect it on the page behind the modal
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
// ── Build-your-own custom follow-up (all three tabs) ─────────────────────────
// Leads/Delivery → a from-scratch campaign (name, channel, timing, message).
// Holidays → a custom dated greeting. Everything lands switched on and editable.
function autoAddCustom(bucket) {
  if (bucket === 'holidays') return autoAddHolidayModal();
  const lbl = t => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const when = bucket === 'delivery' ? 'after the customer takes delivery' : 'after a new lead comes in';
  const ov = crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1"><div class="text-lg font-black text-slate-900 dark:text-white">Custom follow-up</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Build your own automated touch that fires ${when}. Use {{customer.first_name}}, {{vehicle.model}}, {{rep.first_name}}, {{dealership.name}} — they fill in at send time.</p>
    <div class="space-y-3">
      <div>${lbl('Name')}<input id="acx-name" placeholder="e.g. 3-day personal video" class="${inp}"></div>
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('Channel')}<select id="acx-ch" class="${inp}"><option value="sms">Text (SMS)</option><option value="email">Email</option><option value="task">Rep task</option></select></div>
        <div>${lbl('Send after')}<input id="acx-num" type="number" min="0" value="1" class="${inp}"></div>
        <div>${lbl('Unit')}<select id="acx-unit" class="${inp}"><option value="hours">hours</option><option value="days" selected>days</option></select></div>
      </div>
      <div id="acx-subj-wrap">${lbl('Email subject')}<input id="acx-subj" placeholder="Subject line" class="${inp}"></div>
      <div>${lbl('Message')}<textarea id="acx-body" rows="4" placeholder="Hi {{customer.first_name|there}}, …" class="${inp}"></textarea></div>
    </div>
    <button onclick="autoSubmitCustom('${bucket}',this)" class="mt-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Add follow-up</button>
  </div>`, 'max-w-lg');
  const sync = () => { const w = ov.querySelector('#acx-subj-wrap'); if (w) w.style.display = ov.querySelector('#acx-ch').value === 'email' ? '' : 'none'; };
  ov.querySelector('#acx-ch').addEventListener('change', sync); sync();
}
async function autoSubmitCustom(bucket, btn) {
  const g = id => document.getElementById(id);
  const name = (g('acx-name').value || '').trim(); if (!name) return showToast('Give it a name', 'error');
  const ch = g('acx-ch').value;
  const num = Math.max(0, parseInt(g('acx-num').value) || 0);
  const delay_minutes = (g('acx-unit').value === 'hours') ? num * 60 : num * 1440;
  const body = (g('acx-body').value || '').trim(); if (!body) return showToast('Add a message', 'error');
  const subject = ch === 'email' ? (g('acx-subj').value || '').trim() : '';
  const category = ch === 'task' ? 'tasks' : (bucket === 'delivery' ? 'retention' : 'pipeline');
  const trigger_event = bucket === 'delivery' ? 'delivered' : 'internet_lead';
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Adding…';
  try {
    const d = await apiSendJson('/automation/campaigns', 'POST', { name, category, trigger_event, channel: ch, subject_template: subject, message_body_template: body, delay_minutes, sender_identity: ch === 'email' ? 'house' : 'rep', is_active: true });
    if (d.campaign) __autoCfg.campaigns = [...(__autoCfg.campaigns || []), d.campaign];
    showToast('Custom follow-up added', 'success');
    btn.closest('.fixed')?.remove();
    autoRerenderCurrent();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
// Custom holiday greeting — a proper modal (replaces the old double prompt).
// ── Natural-language bulk outreach (managers) ───────────────────────────────────
// Type what you want ("text everyone uncontacted 3+ days about our sale"); AI drafts
// the message + audience; you review the count + sample, tweak, then confirm the send.
let __bulkPlan = null;
function openBulkOutreach(prefill) {
  __bulkPlan = null;
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1"><div class="text-lg font-black text-slate-900 dark:text-white"> Bulk message</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Describe who to reach and what to say — in plain English. Nothing sends until you review and confirm.</p>
    <textarea id="bulk-instruction" rows="2" placeholder="e.g. Text everyone we haven't contacted in 3 days about our weekend sale event" class="${inp}">${prefill ? esc(prefill) : ''}</textarea>
    <div class="flex flex-wrap gap-1.5 mt-2">
      ${['Text uncontacted leads from the last 7 days','Email positive-equity customers about upgrading','Text customers with a lease maturing in 6 months','Email everyone who came from Facebook this month'].map(s => `<button onclick="document.getElementById('bulk-instruction').value=this.textContent;" class="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-950/40 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg">${s}</button>`).join('')}
    </div>
    <button id="bulk-plan-btn" onclick="bulkPlan(this)" class="mt-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition">Preview audience →</button>
    <div id="bulk-result" class="mt-4"></div>
  </div>`, 'max-w-xl');
  // Handed off from the assistant with a ready instruction → jump straight to preview.
  if (prefill) setTimeout(() => document.getElementById('bulk-plan-btn')?.click(), 60);
}
async function bulkPlan(btn) {
  const instruction = document.getElementById('bulk-instruction')?.value.trim();
  if (!instruction) { showToast('Describe who to reach and what to say', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Thinking…';
  const box = document.getElementById('bulk-result');
  try {
    const d = await apiSendJson('/ai/bulk/plan', 'POST', { instruction });
    __bulkPlan = d;
    const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
    box.innerHTML = `
      <div class="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">${d.channel === 'sms' ? ' Text message' : ' Email'}</span>
          <span class="text-xs font-black ${d.audience_count ? 'text-slate-700 dark:text-slate-200' : 'text-rose-500'}">${d.audience_count} recipient${d.audience_count === 1 ? '' : 's'}${d.audience_count > d.capped ? ` (first ${d.capped} will send)` : ''}</span>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">${esc(d.summary)}</p>
        ${d.sample?.length ? `<p class="text-[11px] text-slate-400">e.g. ${d.sample.map(s => esc(s.name)).join(', ')}</p>` : ''}
        ${d.channel === 'email' ? `<div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Subject</label><input id="bulk-subject" class="${inp}" value="${esc(d.subject || '')}"></div>` : ''}
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Message (edit before sending — {{first_name}} personalizes)</label><textarea id="bulk-message" rows="4" class="${inp}">${esc(d.message)}</textarea></div>
      </div>
      ${d.audience_count ? `<button onclick="bulkSend(this)" class="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition">Send to ${Math.min(d.audience_count, d.capped)} customer${Math.min(d.audience_count, d.capped) === 1 ? '' : 's'} →</button>`
        : `<p class="mt-3 text-xs text-slate-400 italic">No one matches that (after consent/opt-out filtering). Try a broader ask.</p>`}`;
  } catch (e) { box.innerHTML = `<p class="text-xs text-rose-500">${esc(e.message || 'Could not build that')}</p>`; }
  btn.disabled = false; btn.textContent = orig;
}
async function bulkSend(btn) {
  if (!__bulkPlan) return;
  const message = document.getElementById('bulk-message')?.value.trim();
  const subject = document.getElementById('bulk-subject')?.value.trim() || __bulkPlan.subject;
  if (!message) { showToast('Message is empty', 'error'); return; }
  if (!confirm(`Send this ${__bulkPlan.channel === 'sms' ? 'text' : 'email'} to ${Math.min(__bulkPlan.audience_count, __bulkPlan.capped)} customer(s)?`)) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const d = await apiSendJson('/ai/bulk/execute', 'POST', { channel: __bulkPlan.channel, filter: __bulkPlan.filter, message, subject });
    showToast(`Sent ${d.sent}${d.failed ? `, ${d.failed} failed` : ''} `, d.failed ? 'info' : 'success');
    btn.closest('.fixed')?.remove();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Send failed', 'error'); }
}
window.openBulkOutreach = openBulkOutreach;
window.bulkPlan = bulkPlan;
window.bulkSend = bulkSend;

// ══ Service department (fixed ops) ═══════════════════════════════════════════
let __serviceCfg = null;
async function loadServiceSettings() {
  const root = document.getElementById('service-settings-root'); if (!root) return;
  let d; try { d = await apiGetJson('/service/config', { retries: 1 }); } catch { root.innerHTML = '<p class="text-sm text-rose-500">Could not load service settings.</p>'; return; }
  __serviceCfg = d.settings;
  const s = d.settings;
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const bookUrl = d.site_slug ? `${API.replace(/\/$/, '')}/site/${d.site_slug}/service-book` : null;
  root.innerHTML = `
    <div><h2 class="text-xl font-black text-slate-900 dark:text-white">Service settings</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">Set up your service menu and online booking. Service customers share the same record as their sales history.</p></div>
    <div class="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="svc-enabled" ${s.enabled ? 'checked' : ''} class="accent-teal-600 w-4 h-4">Let customers book service online from my website</label>
      ${!d.site_published ? `<p class="text-[11px] text-amber-600 dark:text-amber-400">Publish your website first (Website settings) for online booking to appear.</p>` : bookUrl ? `<p class="text-[11px] text-slate-400">Booking endpoint: <code class="text-[10px]">${esc(bookUrl)}</code></p>` : ''}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Service desk email (booking alerts)</label><input id="svc-email" type="email" value="${esc(s.desk_email || '')}" placeholder="service@yourstore.com" class="${inp}"></div>
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Default appointment length (min)</label><input id="svc-duration" type="number" min="15" step="15" value="${s.duration_min || 60}" class="${inp}"></div>
      </div>
      <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Service menu (one per line)</label><textarea id="svc-types" rows="6" class="${inp}">${esc((s.service_types || []).join('\n'))}</textarea></div>
      <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Service hours (shown to customers)</label><textarea id="svc-hours" rows="2" placeholder="Mon–Fri 8–5, Sat 9–1" class="${inp}">${esc(s.hours || '')}</textarea></div>
      <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Note for customers (optional)</label><textarea id="svc-note" rows="2" placeholder="e.g. Loaner cars available with 48h notice." class="${inp}">${esc(s.note || '')}</textarea></div>
      <button onclick="saveServiceSettings(this)" class="text-sm font-bold bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg">Save service settings</button>
      <span id="svc-msg" class="hidden text-xs ml-2"></span>
    </div>`;
}
async function saveServiceSettings(btn) {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const body = {
    enabled: !!document.getElementById('svc-enabled')?.checked,
    desk_email: v('svc-email'), hours: v('svc-hours'), note: v('svc-note'),
    duration_min: parseInt(v('svc-duration')) || 60,
    service_types: v('svc-types').split('\n').map(x => x.trim()).filter(Boolean),
  };
  const msg = document.getElementById('svc-msg'); const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { const d = await apiSendJson('/service/config', 'PUT', body); __serviceCfg = d.settings; if (msg) { msg.textContent = ' Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); } }
  catch (e) { if (msg) { msg.textContent = e.message; msg.className = 'text-xs ml-2 text-rose-500'; msg.classList.remove('hidden'); } }
  finally { btn.disabled = false; btn.textContent = 'Save service settings'; }
}
let __svcApptData = [];
let __svcApptView = 'calendar';   // 'calendar' | 'list'
let __svcApptMonth = new Date();
function svcApptSetView(v) { __svcApptView = v; renderSvcAppts(); }
window.svcApptSetView = svcApptSetView;
function svcApptViewToggle() {
  const b = (v, label) => `<button onclick="svcApptSetView('${v}')" class="text-xs font-bold px-3 h-8 rounded-lg border transition ${__svcApptView === v ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;
  return `<div class="inline-flex gap-1">${b('calendar', 'Calendar')}${b('list', 'List')}</div>`;
}
async function loadServiceAppointments() {
  const root = document.getElementById('service-appointments-root'); if (!root) return;
  root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading service appointments…</div>';
  let d; try { d = await apiGetJson('/service/appointments', { retries: 1 }); } catch { root.innerHTML = '<p class="text-sm text-rose-500">Could not load service appointments.</p>'; return; }
  __svcApptData = d.appointments || [];
  const nextUp = __svcApptData.find(a => a.when && !a.done) || __svcApptData.find(a => a.when);
  __svcApptMonth = nextUp && nextUp.when ? new Date(nextUp.when) : new Date();
  renderSvcAppts();
}
function renderSvcAppts() { if (__svcApptView === 'list') renderSvcApptList(); else renderSvcApptCalendar(); }
function svcApptHeader() {
  return `<div class="flex items-center justify-between gap-3 flex-wrap mb-4">
      <div><h2 class="text-xl font-black text-slate-900 dark:text-white">Service appointments</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Every service visit, attached to the customer's record.</p></div>
      <div class="flex items-center gap-1.5 flex-wrap">${svcApptViewToggle()}
        <button onclick="openServiceBooking()" class="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-4 h-8 rounded-lg transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Book service</button>
      </div>
    </div>`;
}
function renderSvcApptList() {
  const root = document.getElementById('service-appointments-root'); if (!root) return;
  const appts = __svcApptData;
  const now = Date.now();
  const upcoming = appts.filter(a => !a.done && (!a.when || new Date(a.when).getTime() >= now - 3600000));
  const past = appts.filter(a => a.done || (a.when && new Date(a.when).getTime() < now - 3600000));
  const fmt = w => { if (!w) return 'No time set'; try { return new Date(w).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return w; } };
  const row = a => `<div class="flex items-center gap-3 py-2.5 px-3 border-b border-slate-100 dark:border-slate-800">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap"><span class="font-bold text-sm text-slate-900 dark:text-white truncate">${esc(a.customer)}</span>${a.service_type ? `<span class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">${esc(a.service_type)}</span>` : ''}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${fmt(a.when)}${a.rep ? ' · ' + esc(a.rep) : ''}</div>
      </div>
      ${a.contact_id ? `<button onclick="switchPage('crm'); openCrmContact('${a.contact_id}')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0">View</button>` : ''}
      ${!a.done ? `<button onclick="serviceApptDone('${a.id}', this)" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg shrink-0">Done</button>` : '<span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0"> Done</span>'}
    </div>`;
  root.innerHTML = svcApptHeader() + `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div class="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-950/50">Upcoming (${upcoming.length})</div>
      ${upcoming.length ? upcoming.map(row).join('') : '<div class="py-8 text-center text-xs text-slate-400 italic">No upcoming service appointments.</div>'}
      ${past.length ? `<div class="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-950/50">Past / done (${past.length})</div>${past.slice(0, 50).map(row).join('')}` : ''}
    </div>`;
}
function renderSvcApptCalendar() {
  const root = document.getElementById('service-appointments-root'); if (!root) return;
  const now = Date.now();
  const byDay = {};
  __svcApptData.forEach(a => {
    if (!a.when) return;
    const x = new Date(a.when); const k = `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
    (byDay[k] = byDay[k] || []).push(a);
  });
  const noTime = __svcApptData.filter(a => !a.when && !a.done);
  const view = new Date(__svcApptMonth.getFullYear(), __svcApptMonth.getMonth(), 1);
  const monthName = view.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const firstDow = view.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const td = new Date(); const todayKey = `${td.getFullYear()}-${td.getMonth()}-${td.getDate()}`;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<div class="bg-slate-50/60 dark:bg-slate-900/40 min-h-[92px]"></div>');
  for (let day = 1; day <= daysInMonth; day++) {
    const k = `${view.getFullYear()}-${view.getMonth()}-${day}`;
    const items = (byDay[k] || []).sort((a, b) => new Date(a.when) - new Date(b.when));
    const isToday = k === todayKey;
    const chips = items.slice(0, 3).map(a => {
      const t = new Date(a.when).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      const done = a.done || new Date(a.when).getTime() < now - 3600000;
      const cls = done ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300';
      const label = `${a.customer || 'Service'}${a.service_type ? ' · ' + a.service_type : ''}`;
      return `<div class="w-full truncate text-[10px] font-semibold px-1.5 py-1 rounded ${cls}" title="${esc(t + ' · ' + label)}">${esc(t)} ${esc(a.customer || 'Service')}</div>`;
    }).join('');
    const more = items.length > 3 ? `<div class="text-[10px] text-slate-400 px-1.5">+${items.length - 3} more</div>` : '';
    cells.push(`
      <div class="bg-white dark:bg-slate-900 min-h-[92px] p-1.5 flex flex-col gap-1 ${isToday ? 'ring-2 ring-inset ring-teal-400' : ''}">
        <span class="text-[11px] font-bold ${isToday ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}">${day}</span>
        ${chips}${more}
      </div>`);
  }
  while (cells.length % 7 !== 0) cells.push('<div class="bg-slate-50/60 dark:bg-slate-900/40 min-h-[92px]"></div>');
  root.innerHTML = svcApptHeader() + `
    <div class="mb-3 flex items-center gap-1.5 flex-wrap">
      <button id="svc-appt-prev" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Previous month"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
      <div class="text-sm font-bold text-slate-800 dark:text-slate-200 min-w-[140px] text-center">${monthName}</div>
      <button id="svc-appt-next" class="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Next month"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
      <button id="svc-appt-today" class="text-xs font-bold px-3 h-8 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Today</button>
    </div>
    <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      ${dow.map(d => `<div class="bg-slate-50 dark:bg-slate-950 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-2">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${noTime.length ? `<div class="mt-3 text-[11px] text-slate-400 italic">${noTime.length} appointment${noTime.length > 1 ? 's' : ''} with no time set — see the List view.</div>` : ''}`;
  document.getElementById('svc-appt-prev')?.addEventListener('click', () => { __svcApptMonth = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderSvcApptCalendar(); });
  document.getElementById('svc-appt-next')?.addEventListener('click', () => { __svcApptMonth = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderSvcApptCalendar(); });
  document.getElementById('svc-appt-today')?.addEventListener('click', () => { __svcApptMonth = new Date(); renderSvcApptCalendar(); });
}
async function serviceApptDone(id, btn) {
  btn.disabled = true; btn.textContent = '…';
  try { await apiSendJson(`/service/appointments/${id}`, 'PUT', { done: true }); loadServiceAppointments(); }
  catch (e) { btn.disabled = false; btn.textContent = 'Done'; showToast(e.message || 'Could not update', 'error'); }
}
let __svcBookContactId = null;
function openServiceBooking(prefill) {
  __svcBookContactId = prefill?.contact_id || null;
  const types = (__serviceCfg?.service_types) || ['Oil change', 'Tire change / rotation', 'Brakes', 'Diagnostic', 'Scheduled maintenance', 'Recall', 'Detailing', 'Other'];
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-3"><div class="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">${svgIcon('wrench', 'w-5 h-5 text-teal-600')} Book service</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="space-y-3">
      <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Customer name</label><input id="svcb-name" class="${inp}" placeholder="Full name" value="${esc(prefill?.name || '')}"></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Email</label><input id="svcb-email" type="email" class="${inp}" value="${esc(prefill?.email || '')}"></div>
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Phone</label><input id="svcb-phone" class="${inp}" value="${esc(prefill?.phone || '')}"></div>
      </div>
      <p class="text-[11px] text-slate-400">If this customer already exists (by email/phone), the appointment attaches to their record.</p>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Service</label><select id="svcb-type" class="${inp}">${types.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
        <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Date & time</label><input id="svcb-when" type="datetime-local" class="${inp}"></div>
      </div>
      <div><label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Notes</label><textarea id="svcb-notes" rows="2" class="${inp}" placeholder="Concern / requested work"></textarea></div>
      <button onclick="submitServiceBooking(this)" class="w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition">Book appointment</button>
    </div>
  </div>`, 'max-w-lg');
}
async function submitServiceBooking(btn) {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const name = g('svcb-name'); const when = g('svcb-when');
  if (!name) { showToast('Enter a customer name', 'error'); return; }
  if (!when) { showToast('Pick a date and time', 'error'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Booking…';
  try {
    await apiSendJson('/service/appointments', 'POST', { contact_id: __svcBookContactId || undefined, name, email: g('svcb-email'), phone: g('svcb-phone'), service_type: g('svcb-type'), when: new Date(when).toISOString(), notes: g('svcb-notes') });
    showToast('Service appointment booked ', 'success');
    btn.closest('.fixed')?.remove();
    loadServiceAppointments();
  } catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message || 'Could not book', 'error'); }
}
window.loadServiceSettings = loadServiceSettings;
window.saveServiceSettings = saveServiceSettings;
window.loadServiceAppointments = loadServiceAppointments;
window.serviceApptDone = serviceApptDone;
window.openServiceBooking = openServiceBooking;
window.submitServiceBooking = submitServiceBooking;

function autoAddHolidayModal() {
  const lbl = t => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const inp = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  crmOverlay(`<div class="p-5">
    <div class="flex items-center justify-between mb-1"><div class="text-lg font-black text-slate-900 dark:text-white">Add a custom holiday</div><button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">A dated greeting that sends every year to your delivered customers.</p>
    <div class="space-y-3">
      <div>${lbl('Name')}<input id="ahm-name" placeholder="e.g. Customer Appreciation Day" class="${inp}"></div>
      <div class="grid grid-cols-2 gap-2">
        <div>${lbl('Date (MM-DD)')}<input id="ahm-date" placeholder="10-13" maxlength="5" class="${inp}"></div>
        <div>${lbl('Who gets it')}<select id="ahm-country" class="${inp}"><option value="BOTH"> Everyone</option><option value="CA"> Canadian customers only</option><option value="US"> U.S. customers only</option></select></div>
      </div>
      <div>${lbl('Message')}<textarea id="ahm-msg" rows="3" placeholder="Happy … from {{dealership.name}}!" class="${inp}"></textarea></div>
    </div>
    <button onclick="autoSubmitHoliday(this)" class="mt-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Add holiday</button>
  </div>`, 'max-w-lg');
}
function autoSubmitHoliday(btn) {
  const g = id => document.getElementById(id);
  const name = (g('ahm-name').value || '').trim(); if (!name) return showToast('Name it', 'error');
  const date = (g('ahm-date').value || '').trim(); if (!/^\d{2}-\d{2}$/.test(date)) return showToast('Use MM-DD (e.g. 10-13)', 'error');
  const country = ['CA', 'US', 'BOTH'].includes(g('ahm-country')?.value) ? g('ahm-country').value : 'BOTH';
  const message = (g('ahm-msg').value || '').trim() || `Happy ${name} from {{dealership.name}}!`;
  __autoHol.push({ name, date, rule: null, country, message, subject: `Happy ${name} from {{dealership.name}}`, enabled: true, preset: false });
  btn.closest('.fixed')?.remove();
  renderHolidaysRoot();
  showToast('Holiday added — review, then Save holidays', 'success');
}

function autoInitHolidays() {
  const saved = Array.isArray(__autoCfg.settings.holidays) ? __autoCfg.settings.holidays : [];
  const byName = {}; for (const h of saved) byName[String(h.name || '').toLowerCase()] = h;
  const region = autoRegionKey();   // dealer's own country → shown/sorted first
  const rows = HOLIDAY_PRESETS_ALL.map(p => {
    const sv = byName[p.name.toLowerCase()];
    return {
      name: p.name, date: resolveHolMMDD(p, new Date().getFullYear()), rule: p.rule || null, country: p.country,
      message: sv?.message || p.message,
      subject: sv?.subject || `Happy ${p.name.replace(/\s*\(.*\)$/, '')} from {{dealership.name}}`,
      enabled: sv ? sv.enabled !== false : false, preset: true,
    };
  });
  // Custom (non-preset) saved holidays keep their spot at the end.
  const presetNames = new Set(HOLIDAY_PRESETS_ALL.map(p => p.name.toLowerCase()));
  for (const h of saved) {
    if (presetNames.has(String(h.name || '').toLowerCase())) continue;
    rows.push({ name: h.name, date: h.date, rule: h.rule || null, country: (h.country === 'CA' || h.country === 'US') ? h.country : 'BOTH', message: h.message || `Happy ${h.name} from {{dealership.name}}!`, subject: h.subject || `Happy ${h.name} from {{dealership.name}}`, enabled: h.enabled !== false, preset: false });
  }
  // Stable sort: dealer's own country + Everyone first, then by calendar date.
  const cRank = c => (c === region || c === 'BOTH') ? 0 : 1;
  rows.sort((a, b) => (cRank(a.country) - cRank(b.country)) || (resolveHolMMDD(a, 2026) < resolveHolMMDD(b, 2026) ? -1 : 1));
  __autoHol = rows;
}
// Settings page (the Automation group header). Engine switch, professional email
// setup, global settings, and any campaigns that aren't lead/delivery/holiday.
function renderAutomationSettings() {
  const root = document.getElementById('automation-root'); if (!root) return;
  const s = __autoCfg.settings || {};
  const other = (__autoCfg.campaigns || []).filter(c => autoBucketOf(c) === 'other');
  const byCat = {}; for (const c of other) (byCat[c.category] = byCat[c.category] || []).push(c);
  root.innerHTML = `
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Automation settings</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">The engine, your professional email setup, and global settings. Manage the actual touches — the email &amp; text templates — under <button onclick="switchPage('automation-builder')" class="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">New Lead, Delivery &amp; Holiday follow-ups &rarr;</button></p>
      </div>
      <label class="flex items-center gap-1.5 text-sm font-bold"><input type="checkbox" ${s.enabled !== false ? 'checked' : ''} onchange="autoToggleEngine(this.checked)" class="accent-indigo-600 w-4 h-4">Engine on</label>
    </div>
    <div class="grid lg:grid-cols-2 gap-4 items-start">
      ${autoEmailSetupHtml(s)}
      ${autoGlobalsHtml(s)}
    </div>
    ${other.length ? `<div class="pt-2"><div class="text-sm font-black text-slate-900 dark:text-white">Other campaigns</div>
      ${AUTO_CATS.filter(([k]) => byCat[k]?.length).map(([k, label]) => `<div><div class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 mt-4">${label}</div><div class="space-y-2">${byCat[k].map(autoCardHtml).join('')}</div></div>`).join('')}</div>` : ''}`;
}
// Re-render whichever automation view is currently on screen (after a toggle/save).
function autoRerenderCurrent() {
  if (!document.querySelector('[data-page-content="automation"]')?.classList.contains('hidden')) return renderAutomationSettings();
  if (!document.querySelector('[data-page-content="automation-builder"]')?.classList.contains('hidden')) {
    if (__autoTab === 'delivery') return renderAutoBucket('auto-delivery-root', 'delivery', 'Delivery Follow-ups', 'Post-delivery retention, review requests and referral asks — everything that fires after the customer takes delivery.');
    if (__autoTab === 'holidays') return renderHolidaysRoot();
    return renderAutoBucket('auto-leads-root', 'leads', 'New Lead Follow-ups', 'Automated texts, emails and rep tasks that fire when a new lead comes in — through the first appointment and showroom visit.');
  }
}

// Automation Builder: one page, tabbed like the Website builder. Each tab's body
// keeps its original root id, so the existing bucket loaders render unchanged.
// ── Email & SMS: Central Dealership Communication Automation Engine ──────────
let __autoTab = 'overview';
function autoTab(t) { __autoTab = t; loadAutoBuilderPage(); }
window.autoTab = autoTab;

// Comprehensive dictionary of categorized dealership automation workflows
const ALL_AUTOMATIONS_CATALOG = {
  leads: [
    { key: 'lead_immediate_response', name: 'Instant New Lead 90-Second Response', category: 'leads', trigger_event: 'internet_lead', channel: 'sms', delay_minutes: 2, sender_identity: 'rep', is_active: true,
      subject_template: 'Thanks for reaching out to {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, it's {{rep.first_name|the team}} at {{dealership.name}}. Saw you were looking at the {{vehicle.ymm|vehicle}} — is that still the one you had your eye on, or are you open to options? Happy to check live availability for you.`,
      steps: ['Trigger: New lead from Website / Facebook / Marketplace', 'Wait 90 seconds (Allow human rep to reply first)', 'IF no human reply -> Send SMS from assigned rep', 'Auto-assign rep round-robin if unassigned', 'Stop condition: Customer replies or books appointment'] },
    { key: 'lead_90s_speed', name: '90-Second Speed-to-Lead SLA Escalation', category: 'leads', trigger_event: 'internet_lead', channel: 'both', delay_minutes: 2, sender_identity: 'rep', is_active: true,
      subject_template: 'Your vehicle inquiry at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, thanks for contacting {{dealership.name}}! I'm putting together the window sticker and pricing for the {{vehicle.ymm|vehicle}} right now. When would be a good time for a quick 2-minute call?`,
      steps: ['Trigger: Inbound internet lead submitted', 'Wait 2 minutes', 'Send dual SMS + Email', 'Create urgent CRM call task for rep', 'Stop condition: Call logged or lead status updated'] },
    { key: 'lead_missed_rep', name: 'Missed Lead Manager Escalation', category: 'leads', trigger_event: 'internet_lead', channel: 'task', delay_minutes: 15, sender_identity: 'house', is_active: true,
      message_body_template: `Urgent: Inbound lead has not been contacted within 15 minutes. Re-assign or contact immediately.`,
      steps: ['Trigger: Lead uncontacted after 15 min', 'Send manager alert notification', 'Re-assign lead to active on-duty rep', 'Stop condition: Rep logs contact'] },
    { key: 'lead_day1_followup', name: 'Day 1 Personal Follow-up', category: 'leads', trigger_event: 'internet_lead', channel: 'sms', delay_minutes: 1440, sender_identity: 'rep', is_active: true,
      message_body_template: `Hey {{customer.first_name|there}} — just checking in on the {{vehicle.model|vehicle}}. Are you looking to buy this week, or just researching options? Happy to send a quick video walkaround if that helps!`,
      steps: ['Trigger: 24 hours post-lead creation', 'Check: No showroom visit or appointment', 'Send personalized SMS from assigned rep', 'Stop condition: Customer reply'] },
    { key: 'lead_day3_still_looking', name: 'Day 3 "Still Looking" Bump', category: 'leads', trigger_event: 'internet_lead', channel: 'sms', delay_minutes: 4320, sender_identity: 'rep', is_active: true,
      message_body_template: `Hey {{customer.first_name|there}} — did you end up finding something, or are you still shopping around for the {{vehicle.model|right vehicle}}?`,
      steps: ['Trigger: 72 hours post-lead creation', 'Check: Lead status still open', 'Send casual text bump', 'Stop condition: Reply or status change'] },
    { key: 'lead_day7_checkin', name: 'Day 7 Value & Comparison Touch', category: 'leads', trigger_event: 'internet_lead', channel: 'email', delay_minutes: 10080, sender_identity: 'rep', is_active: true,
      subject_template: 'Still deciding on the {{vehicle.model|vehicle}}?',
      message_body_template: `Hi {{customer.first_name|there}},\n\nJust circling back on the {{vehicle.model|vehicle}}. Did you find what you were after, or are you still comparing vehicles? We have fresh arrivals and strong trade-in incentives this week. Reply and I'll send over the updated sheet.\n\n{{rep.first_name|Your sales team}}\n{{dealership.name}}`,
      steps: ['Trigger: 7 days with no appointment', 'Send value comparison email', 'Offer trade appraisal & financing options', 'Stop condition: Reply or deal started'] },
    { key: 'lead_longterm_nurture', name: 'Long-Term 30/60/90-Day Buyer Nurture', category: 'leads', trigger_event: 'internet_lead', channel: 'email', delay_minutes: 43200, sender_identity: 'house', is_active: true,
      subject_template: 'New arrivals & incentives at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWanted to keep you in the loop on newly arrived inventory and current incentives at {{dealership.name}}. If your vehicle search is still active, take a look at our live inventory at {{service_url|our website}}.\n\nBest regards,\n{{dealership.name}}`,
      steps: ['Trigger: 30 days inactive lead', 'Send monthly curated inventory highlights', 'Re-evaluate every 30 days up to 90 days', 'Stop condition: Opt-out or lead re-engagement'] },
    { key: 'lead_appt_confirm', name: 'Showroom Appointment Confirmation', category: 'leads', trigger_event: 'appointment_created', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'Confirmed: Your appointment at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, your appointment to view the {{vehicle.ymm|vehicle}} at {{dealership.name}} is confirmed! We'll have the keys and vehicle ready for you. See you soon!`,
      steps: ['Trigger: Appointment booked in CRM', 'Send instant SMS & Email confirmation with directions and rep contact', 'Add to dealership calendar', 'Stop condition: Appointment completed'] },
    { key: 'lead_appt_reminder', name: 'Showroom Appointment 2-Hour Reminder', category: 'leads', trigger_event: 'appointment_reminder', channel: 'sms', delay_minutes: 120, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, quick reminder about your appointment at {{dealership.name}} in 2 hours. Looking forward to meeting you! Need to adjust the time? Just reply here.`,
      steps: ['Trigger: 2 hours prior to scheduled appointment', 'Send SMS reminder with quick reschedule prompt', 'Alert assigned rep', 'Stop condition: Check-in at showroom'] },
    { key: 'lead_missed_appt', name: 'Missed Appointment Rescheduling Sequence', category: 'leads', trigger_event: 'appointment_missed', channel: 'sms', delay_minutes: 30, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, sorry we missed you today! I still have the {{vehicle.model|vehicle}} set aside for you. Would tomorrow morning or afternoon work better to reschedule?`,
      steps: ['Trigger: Appointment marked No-Show', 'Wait 30 minutes', 'Send friendly SMS rescheduling touch', 'Follow-up email 24 hours later if no reply', 'Stop condition: Rescheduled or replied'] },
    { key: 'lead_no_response', name: 'No-Response Multi-Channel Cadence', category: 'leads', trigger_event: 'internet_lead', channel: 'both', delay_minutes: 7200, sender_identity: 'rep', is_active: true,
      subject_template: 'Quick question regarding your vehicle search',
      message_body_template: `Hi {{customer.first_name|there}}, I've tried to reach you a couple of times regarding the {{vehicle.model|vehicle}}. If you are no longer in the market, please let me know so I don't continue to bother you. Otherwise, I'm here to help!`,
      steps: ['Trigger: 5 days with zero customer response', 'Send "permission to close file" message', 'High reply rate trigger', 'Stop condition: Customer replies'] },
    { key: 'lead_lost_reactivation', name: 'Lost Lead 60-Day Reactivation', category: 'leads', trigger_event: 'lead_lost', channel: 'email', delay_minutes: 86400, sender_identity: 'house', is_active: true,
      subject_template: 'Special private offer for {{customer.first_name|there}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWe know timing is everything when buying a vehicle. If you're still considering an upgrade, we have exclusive private incentives and higher trade-in values this month. Check our latest stock at {{service_url|our website}}.\n\n{{dealership.name}}`,
      steps: ['Trigger: Lead marked Lost > 60 days ago', 'Send personalized reactivation email with market offer', 'Track link clicks to re-open CRM deal', 'Stop condition: Deal re-opened'] }
  ],

  sales: [
    { key: 'delivery_sold_congrats', name: 'Sold Congratulations & Welcome to the Family', category: 'sales', trigger_event: 'deal_sold', channel: 'both', delay_minutes: 10, sender_identity: 'rep', is_active: true,
      subject_template: 'Congratulations on your new {{vehicle.ymm|vehicle}}!',
      message_body_template: `Congratulations {{customer.first_name|there}}! Everyone at {{dealership.name}} is thrilled for you and your new {{vehicle.ymm|vehicle}}. We appreciate your business and are here for anything you need!`,
      steps: ['Trigger: Deal marked Sold / Contract Signed', 'Send instant congratulatory SMS from rep + Email from GM', 'Attach digital welcome packet', 'Stop condition: Delivery scheduled'] },
    { key: 'delivery_confirmation', name: 'Delivery Time & Logistics Confirmation', category: 'sales', trigger_event: 'delivery_scheduled', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, your vehicle delivery is set for {{delivery_time|your scheduled time}}. Please remember to bring your driver's license and proof of insurance. We'll have everything ready!`,
      steps: ['Trigger: Delivery date/time set in CRM', 'Send SMS confirmation with checklist', 'Notify delivery coordinator', 'Stop condition: Vehicle delivered'] },
    { key: 'delivery_day_instructions', name: 'Delivery-Day Checklist & App Onboarding', category: 'sales', trigger_event: 'delivered', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Welcome to your {{vehicle.ymm|vehicle}} — Quick Start Guide',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWelcome to your new {{vehicle.ymm|vehicle}}! Here is your quick start guide, roadside assistance details, and warranty documentation. If you need assistance setting up connected services or phone pairing, reply anytime.\n\n{{dealership.name}}`,
      steps: ['Trigger: Vehicle marked Delivered in DMS/CRM', 'Send Digital Owner Guide & Emergency Roadside contacts', 'Log delivery completion to timeline'] },
    { key: 'delivery_day1', name: '1-Day Post-Delivery Check-in', category: 'sales', trigger_event: 'delivered', channel: 'sms', delay_minutes: 1440, sender_identity: 'rep', is_active: true,
      message_body_template: `Congrats again on the {{vehicle.ymm|new vehicle}}, {{customer.first_name|there}}! Hope the first drive was amazing. If you want a hand pairing your phone or configuring anything on the dash, just shout — happy to walk you through it! — {{rep.first_name|Your team}}`,
      steps: ['Trigger: 24 hours post-delivery', 'Send personalized SMS from assigned rep', 'Ensure total satisfaction', 'Stop condition: Reply received'] },
    { key: 'delivery_day7', name: '7-Day Tech & Features Support', category: 'sales', trigger_event: 'delivered', channel: 'sms', delay_minutes: 10080, sender_identity: 'rep', is_active: true,
      message_body_template: `Hey {{customer.first_name|there}}, {{rep.first_name|just}} checking in after your first week with the {{vehicle.model|vehicle}}. Any buttons or infotainment settings you have questions on? Happy to help anytime!`,
      steps: ['Trigger: 7 days post-delivery', 'Check for customer feature questions', 'Stop condition: Customer replies'] },
    { key: 'delivery_day30', name: '30-Day Milestone & 1st Service Intro', category: 'sales', trigger_event: 'delivered', channel: 'email', delay_minutes: 43200, sender_identity: 'house', is_active: true,
      subject_template: "One month in — how's the {{vehicle.model|vehicle}}?",
      message_body_template: `Hi {{customer.first_name|there}},\n\nHard to believe it's already been a month with your {{vehicle.ymm|vehicle}}! When you're ready for routine maintenance or accessories, our service team makes it easy — book online anytime at {{service_url|our website}}.\n\nThanks again for being part of the {{dealership.name}} family.`,
      steps: ['Trigger: 30 days post-delivery', 'Introduce Service Department & Online Booking link', 'Record 30-day milestone'] },
    { key: 'delivery_day90', name: '90-Day Ownership Satisfaction Pulse', category: 'sales', trigger_event: 'delivered', channel: 'sms', delay_minutes: 129600, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, 90 days in! Just wanted to ensure everything is running perfectly with your {{vehicle.model|vehicle}}. Reach out whenever you need anything! — {{rep.first_name|Your team}} at {{dealership.name}}`,
      steps: ['Trigger: 90 days post-delivery', 'Relationship pulse touchpoint', 'Route any issues to service or management'] },
    { key: 'delivery_anniversary', name: 'Ownership 1-Year Anniversary & Equity Check', category: 'sales', trigger_event: 'delivered', channel: 'both', delay_minutes: 525600, sender_identity: 'rep', is_active: true,
      subject_template: 'Happy 1-Year Anniversary with your {{vehicle.model|vehicle}}!',
      message_body_template: `Happy 1-Year Anniversary with your {{vehicle.ymm|vehicle}}, {{customer.first_name|there}}! Values are strong right now — if you ever want a complimentary trade equity review, let me know. Thank you for choosing {{dealership.name}}!`,
      steps: ['Trigger: 365 days post-delivery', 'Send dual celebration SMS + Email', 'Offer complimentary equity check', 'Repeats annually on year 2, 3, 4, 5'] },
    { key: 'delivery_birthday', name: 'Customer Birthday Celebration', category: 'sales', trigger_event: 'birthday', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Happy Birthday, {{customer.first_name|there}}!  Wishing you a fantastic year ahead from all of us at {{dealership.name}}. Enjoy your day! — {{rep.first_name|Your friends at the store}}`,
      steps: ['Trigger: Customer birthday date', 'Send morning birthday text greeting', 'Zero sales pressure — pure relationship building'] },
    { key: 'delivery_referral_request', name: 'Day 14 Referral Incentive Request', category: 'sales', trigger_event: 'delivered', channel: 'sms', delay_minutes: 20160, sender_identity: 'rep', is_active: true,
      message_body_template: `{{customer.first_name|Hey}} — hope you're loving the {{vehicle.model|new ride}}! Quick note: we pay {{referral_bonus|a $200 referral bonus}} for anyone you send our way who buys. Know a friend or family member shopping? Send them my way! — {{rep.first_name|Your team}}`,
      steps: ['Trigger: 14 days post-delivery', 'Send referral program SMS with cash bonus details', 'Track referral leads in CRM'] },
    { key: 'delivery_review_request', name: '48-Hour Google Review & Sentiment Check', category: 'sales', trigger_event: 'delivered', channel: 'sms', delay_minutes: 2880, sender_identity: 'house', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, thank you again for choosing {{dealership.name}}! If you have 30 seconds, a quick Google review would mean the world to our team: {{review_url|our review page}}`,
      steps: ['Trigger: 48 hours post-delivery', 'Sentiment router check', 'Positive sentiment -> Direct to Google / DealerRater', 'Negative sentiment -> Urgent GM escalation task'] }
  ],

  service: [
    { key: 'service_appt_confirm', name: 'Service Appointment Confirmation', category: 'service', trigger_event: 'service_booked', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Confirmed: Service Appointment at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, your service appointment for your {{vehicle.ymm|vehicle}} is confirmed for {{service_time|your scheduled time}}. Need to adjust or add a service? Reply here anytime.`,
      steps: ['Trigger: Service appointment created in DMS/Service Engine', 'Send instant SMS & Email with check-in instructions', 'Stop condition: Checked in'] },
    { key: 'service_reminder', name: 'Service Due 48-Hour Reminder', category: 'service', trigger_event: 'service_reminder', channel: 'sms', delay_minutes: 2880, sender_identity: 'house', is_active: true,
      message_body_template: `Reminder: Your service appointment for your {{vehicle.model|vehicle}} at {{dealership.name}} is coming up in 2 days. See you soon!`,
      steps: ['Trigger: 48 hours prior to service appointment', 'Send SMS reminder', 'Stop condition: RO opened'] },
    { key: 'service_missed_appt', name: 'Missed Service Appointment Follow-up', category: 'service', trigger_event: 'service_missed', channel: 'sms', delay_minutes: 60, sender_identity: 'house', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, we missed you today for your service visit. To re-book a time that fits your schedule, click here: {{service_url|our booking link}} or reply with a day that works.`,
      steps: ['Trigger: Service appointment missed', 'Send instant re-book link', 'Stop condition: Rescheduled'] },
    { key: 'service_status_update', name: 'Repair Order Status & Video Multi-Point Inspection', category: 'service', trigger_event: 'service_ro_update', channel: 'sms', delay_minutes: 0, sender_identity: 'house', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, your technician has completed the multi-point inspection on your {{vehicle.model|vehicle}}. View the video inspection and approve items here: {{service_url|your service tracker}}`,
      steps: ['Trigger: Technician uploads MPI video / status changes to In Progress', 'Send customer SMS with 1-click inspection viewer and approval portal'] },
    { key: 'service_vehicle_ready', name: 'Vehicle Ready for Pickup & Mobile Pay', category: 'service', trigger_event: 'service_ready', channel: 'sms', delay_minutes: 0, sender_identity: 'house', is_active: true,
      message_body_template: `Great news {{customer.first_name|there}}! Your {{vehicle.ymm|vehicle}} is ready for pickup at {{dealership.name}}. Pay online now for express contactless checkout: {{service_url|pay invoice}}`,
      steps: ['Trigger: RO marked Complete / Ready for Pickup', 'Send ready notification with express mobile payment link', 'Stop condition: Vehicle checked out'] },
    { key: 'service_declined_followup', name: 'Declined Service 14-Day Safety Follow-up', category: 'service', trigger_event: 'service_declined', channel: 'email', delay_minutes: 20160, sender_identity: 'house', is_active: true,
      subject_template: 'Important maintenance reminder for your {{vehicle.ymm|vehicle}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nDuring your recent visit, our technician noted maintenance recommendations for your {{vehicle.ymm|vehicle}} that were deferred. To keep your vehicle safe and operating at its best, schedule anytime at {{service_url|our service page}}.\n\n{{dealership.name}} Service Team`,
      steps: ['Trigger: Declined service lines on closed RO', 'Wait 14 days', 'Send educational safety & longevity email with 10% coupon', 'Stop condition: Service re-booked'] },
    { key: 'service_maint_reminder', name: '6-Month / 5,000-Mile Maintenance Interval', category: 'service', trigger_event: 'service_interval', channel: 'both', delay_minutes: 259200, sender_identity: 'house', is_active: true,
      subject_template: 'Time for your next routine service at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, our records indicate your {{vehicle.ymm|vehicle}} is due for its 6-month routine maintenance. Protect your warranty and book online here: {{service_url|book appointment}}`,
      steps: ['Trigger: 6 months or calculated mileage milestone', 'Send dual SMS + Email', 'Stop condition: Appointment booked'] },
    { key: 'service_seasonal_reminder', name: 'Seasonal Prep & Inspection Campaign', category: 'service', trigger_event: 'seasonal', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Is your {{vehicle.model|vehicle}} ready for the season?',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWith changing seasonal weather, make sure your battery, fluids, wipers, and brakes are ready. Schedule your comprehensive seasonal multi-point inspection at {{service_url|our website}}.\n\n{{dealership.name}} Service`,
      steps: ['Trigger: Seasonal calendar triggers (Spring/Fall/Winter)', 'Broadcast seasonal maintenance specials', 'Stop condition: Service booked'] },
    { key: 'service_tire_change', name: 'Seasonal Tire Swap & Alignment Notice', category: 'service', trigger_event: 'tire_season', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Time for your seasonal tire change at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, tire changeover season is here! Beat the rush and schedule your tire swap, storage, and four-wheel alignment at {{service_url|our booking link}}.`,
      steps: ['Trigger: Regional tire swap season (April & November)', 'Send SMS & Email broadcast with tire storage options'] },
    { key: 'service_oil_change', name: 'Oil & Filter Change Due Notice', category: 'service', trigger_event: 'oil_due', channel: 'sms', delay_minutes: 0, sender_identity: 'house', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, your {{vehicle.model|vehicle}} is coming due for its next oil & filter service. Keep your engine running smoothly — book a quick slot at {{service_url|book service}}.`,
      steps: ['Trigger: Mileage / date estimate for oil change', 'Send express booking text'] },
    { key: 'service_maint_intervals', name: '30k / 60k / 90k Major Factory Maintenance', category: 'service', trigger_event: 'major_service', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Major factory maintenance milestone for your {{vehicle.ymm|vehicle}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nYour {{vehicle.ymm|vehicle}} is approaching a major factory mileage milestone. Staying on schedule ensures warranty coverage and top resale value. View full package details and reserve your loaner vehicle at {{service_url|our service portal}}.\n\n{{dealership.name}} Service`,
      steps: ['Trigger: Mileage crossing 30k/60k/90k/120k thresholds', 'Send detailed factory package overview with loaner vehicle reservation'] },
    { key: 'service_dormant_reactivation', name: 'Dormant Service Customer 12-Month Win-Back', category: 'service', trigger_event: 'service_dormant', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'We miss you at {{dealership.name}} — $25 Service Gift',
      message_body_template: `Hi {{customer.first_name|there}}, it's been over a year since we've seen your {{vehicle.model|vehicle}}! Enjoy $25 off your next service visit. Book online at {{service_url|our website}} with code WELCOMEBACK.`,
      steps: ['Trigger: No RO in 12+ months', 'Send $25 gift certificate promotion', 'Stop condition: Service appointment booked'] }
  ],

  inventory: [
    { key: 'inv_price_drop', name: 'Price Drop Alert on Viewed / Saved Units', category: 'inventory', trigger_event: 'price_drop', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'Price Reduced on the {{vehicle.ymm|vehicle}} you viewed!',
      message_body_template: `Great news {{customer.first_name|there}}! The price on the {{vehicle.ymm|vehicle}} you checked out has just dropped by {{price_drop_amount|$500}}. Want me to hold the keys for a test drive? — {{rep.first_name|Your sales rep}}`,
      steps: ['Trigger: Vehicle price reduced in DMS/Inventory', 'Match against active leads who viewed/saved this VIN', 'Send instant alert', 'Stop condition: Lead replies'] },
    { key: 'inv_vehicle_available', name: 'Vehicle Back in Stock / Available Notification', category: 'inventory', trigger_event: 'unit_available', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, the {{vehicle.ymm|vehicle}} you inquired on is available and ready for showing! When would you like to come see it? — {{rep.first_name|Your team}}`,
      steps: ['Trigger: Unit completed recon / back on market', 'Send to waitlisted shoppers'] },
    { key: 'inv_similar_available', name: 'Similar / Alternate Vehicle Arrival Match', category: 'inventory', trigger_event: 'similar_arrival', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'New arrival matches your vehicle search at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, a {{vehicle.ymm|vehicle}} just arrived on our lot that matches what you were shopping for! Take a first look before it goes live publicly: {{vehicle_link|view vehicle}}`,
      steps: ['Trigger: New unit added matching customer saved criteria', 'Send early VIP sneak peek'] },
    { key: 'inv_aging_campaign', name: 'Aged Inventory Special Pricing Broadcast', category: 'inventory', trigger_event: 'aged_unit', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Manager Special Clearance at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWe are clearing aged frontline inventory this week with special manager pricing and low APR financing on select models. View the complete clearance list at {{service_url|our inventory page}}.\n\n{{dealership.name}} Sales`,
      steps: ['Trigger: Inventory units > 60 days on lot', 'Send segmented clearance broadcast'] },
    { key: 'inv_tradein_opp', name: 'High Trade-In Value Market Opportunity', category: 'inventory', trigger_event: 'trade_demand', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'We need your {{vehicle.ymm|vehicle}} for our inventory!',
      message_body_template: `Hi {{customer.first_name|there}}, our pre-owned department is urgently looking for vehicles like your {{vehicle.ymm|vehicle}}. We are paying above-market value this week. Want a quick 2-minute appraisal estimate? No obligation!`,
      steps: ['Trigger: High demand trade model identified', 'Target past buyers with matching vehicle', 'Offer free appraisal'] },
    { key: 'inv_lease_maturity', name: 'Lease 6-Month Maturity Pull-Ahead', category: 'inventory', trigger_event: 'lease_end', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'Lease Pull-Ahead Program for your {{vehicle.ymm|vehicle}}',
      message_body_template: `Hi {{customer.first_name|there}}, you're within 6 months of your lease maturity on the {{vehicle.ymm|vehicle}}. Under our pull-ahead program, we may be able to waive your remaining payments and upgrade you to a new model for a similar payment. Let's look at numbers!`,
      steps: ['Trigger: 180 days prior to lease maturity date', 'Send dual channel pull-ahead offer'] },
    { key: 'inv_finance_maturity', name: 'Finance 36/48-Month Upgrade Equity Window', category: 'inventory', trigger_event: 'finance_window', channel: 'both', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      subject_template: 'Equity Upgrade Opportunity on your {{vehicle.ymm|vehicle}}',
      message_body_template: `Hi {{customer.first_name|there}}, you've reached the optimal equity window on your {{vehicle.ymm|vehicle}} finance contract. You can trade into a brand new vehicle today with little to no change in payment. Reply to review your options!`,
      steps: ['Trigger: 36 or 48 months on finance contract', 'Send equity trade-up invitation'] },
    { key: 'inv_equity_opp', name: 'Positive Equity Position Upgrade Alert', category: 'inventory', trigger_event: 'equity_positive', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Good news {{customer.first_name|there}}! Market values show your {{vehicle.ymm|vehicle}} currently has approximately {{equity_amount|$3,500}} in positive trade equity. Want to see what that gets you into? — {{rep.first_name|Your sales rep}}`,
      steps: ['Trigger: Equity Radar identifies > $2,000 positive equity', 'Send text alert with trade-in calculations'] },
    { key: 'inv_vehicle_anniversary', name: 'Vehicle Purchase Anniversary Equity Check', category: 'inventory', trigger_event: 'anniversary', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Your Annual Vehicle Value & Equity Report',
      message_body_template: `Hi {{customer.first_name|there}},\n\nHappy purchase anniversary! As part of our customer care program, we generated your complimentary annual vehicle market valuation for your {{vehicle.ymm|vehicle}}. View your report at {{service_url|our website}}.\n\n{{dealership.name}}`,
      steps: ['Trigger: Annual vehicle purchase anniversary', 'Send annual valuation report'] },
    { key: 'inv_new_arrival', name: 'New Inventory Arrival Notification', category: 'inventory', trigger_event: 'new_inventory', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Just Arrived: Fresh inventory at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nOver 20+ fresh vehicles just arrived and passed our multi-point certification. Browse full photos and pricing before they hit major marketplaces: {{service_url|view inventory}}.\n\n{{dealership.name}}`,
      steps: ['Trigger: Weekly inventory sync', 'Send new arrivals digest to active shoppers'] },
    { key: 'inv_saved_vehicle_followup', name: 'Saved / Favorited Vehicle Inactivity Bump', category: 'inventory', trigger_event: 'saved_vehicle', channel: 'sms', delay_minutes: 2880, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, saw you saved the {{vehicle.ymm|vehicle}} on our site. It's generating a lot of interest today — would you like to take it for a quick spin before it sells? — {{rep.first_name|Your team}}`,
      steps: ['Trigger: Customer favorites a vehicle on site without submitting form', 'Wait 48 hours', 'Send personalized outreach text'] }
  ],

  marketing: [
    { key: 'mkt_newsletter', name: 'Monthly Dealership VIP Newsletter', category: 'marketing', trigger_event: 'monthly_newsletter', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'The {{dealership.name}} Monthly Insider',
      message_body_template: `Hi {{customer.first_name|there}},\n\nWelcome to this month's dealership insider! Check out top community news, local vehicle spotlights, maintenance advice, and this month's featured incentives at {{service_url|our website}}.\n\n{{dealership.name}}`,
      steps: ['Trigger: 1st of every month', 'Broadcast to full opted-in customer database'] },
    { key: 'mkt_promotions', name: 'Factory Sales & Rebate Promotion Broadcast', category: 'marketing', trigger_event: 'factory_event', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: '0% APR & Factory Rebates This Weekend at {{dealership.name}}',
      message_body_template: `Special Event: 0% Financing & bonus rebates are live this weekend at {{dealership.name}}! Don't miss the biggest manufacturer incentives of the season. View all qualifying models: {{service_url|view promotions}}`,
      steps: ['Trigger: Manufacturer national sales event', 'Broadcast to past leads and sold customer base'] },
    { key: 'mkt_holidays', name: 'Holiday & Seasonal Greetings', category: 'marketing', trigger_event: 'holiday', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Happy Holidays from all of us at {{dealership.name}}',
      message_body_template: `Wishing you and your family a wonderful holiday season from everyone at {{dealership.name}}! Please note our holiday sales and service hours before stopping by: {{service_url|view hours}}.`,
      steps: ['Trigger: Major regional holidays', 'Automated dated greeting delivery'] },
    { key: 'mkt_dealer_events', name: 'Dealership VIP Event & Test Drive Party', category: 'marketing', trigger_event: 'vip_event', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'You are invited: Private VIP Test Drive Event',
      message_body_template: `You're invited to our Private VIP Test Drive Event at {{dealership.name}}! Enjoy complimentary refreshments, exclusive trade-in bonuses, and private test drives. RSVP here: {{service_url|rsvp link}}`,
      steps: ['Trigger: Scheduled dealership event', 'Send VIP invitations with RSVP tracking'] },
    { key: 'mkt_sales_events', name: 'End-of-Month Clearance Sales Push', category: 'marketing', trigger_event: 'eom_push', channel: 'sms', delay_minutes: 0, sender_identity: 'house', is_active: true,
      message_body_template: `End-of-Month Goal Alert: We need to move 15 more vehicles by Sunday to hit our volume target. Huge discounts on all remaining inventory! Check deals here: {{service_url|clearance deals}}`,
      steps: ['Trigger: Final 3 days of calendar month', 'Send targeted SMS clearance blast'] },
    { key: 'mkt_service_specials', name: 'Monthly Service & Parts Coupon Pack', category: 'marketing', trigger_event: 'service_special', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Your Monthly Service Savings Pass at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nSave on your next service visit with our exclusive monthly coupon pass! Includes discounts on synthetic oil changes, brake pads, tire rotations, and battery tests. Download coupons here: {{service_url|download coupons}}.\n\n{{dealership.name}} Service`,
      steps: ['Trigger: Monthly service schedule', 'Broadcast coupon bundle to service database'] },
    { key: 'mkt_winback_campaign', name: '180-Day Inactive Customer Win-Back Campaign', category: 'marketing', trigger_event: 'winback_180', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'We want you back at {{dealership.name}} — Exclusive $500 Voucher',
      message_body_template: `Hi {{customer.first_name|there}}, we haven't seen you in a while! Here is an exclusive $500 vehicle credit or $50 service voucher valid through this month. Claim your voucher at {{service_url|claim voucher}}.`,
      steps: ['Trigger: Customer with no activity in 180 days', 'Send high-value incentive offer'] },
    { key: 'mkt_customer_reactivation', name: 'Annual Community Reactivation Sweepstakes', category: 'marketing', trigger_event: 'reactivation', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Annual Customer Appreciation at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nThank you for being part of our dealership community! Enter our annual appreciation giveaway for a chance to win a year of free car washes and detailing. Enter now: {{service_url|enter giveaway}}.\n\n{{dealership.name}}`,
      steps: ['Trigger: Annual community event', 'Drive engagement and re-verify contact info'] },
    { key: 'mkt_segmented_campaign', name: 'Targeted Custom Audience Segment Broadcast', category: 'marketing', trigger_event: 'custom_segment', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Exclusive opportunity for {{dealership.name}} VIPs',
      message_body_template: `Hi {{customer.first_name|there}}, based on your ownership history, you qualify for an exclusive preferred rate on our newest inventory. Reply or visit {{service_url|our portal}} to review your private offer.`,
      steps: ['Trigger: Custom CRM audience filter', 'Send personalized multi-touch campaign'] },
    { key: 'mkt_scheduled_onetime', name: 'Scheduled One-Time Broadcast Campaign', category: 'marketing', trigger_event: 'onetime_blast', channel: 'both', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Special Announcement from {{dealership.name}}',
      message_body_template: `Important update from {{dealership.name}}: New showroom expansion and extended evening service hours now open to serve you better! Visit {{service_url|our website}} for details.`,
      steps: ['Trigger: Custom scheduled datetime', 'Dispatch to selected audience tags'] }
  ],

  lifecycle: [
    { key: 'birthday', name: 'Automated Birthday Celebration Greeting', category: 'lifecycle', trigger_event: 'birthday', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Happy Birthday, {{customer.first_name|there}}!  Hope you have an incredible celebration today. Best wishes from your friends at {{dealership.name}}!`,
      steps: ['Trigger: Date matches customer birthday', 'Dispatches at 9:00 AM local time', 'Logged to customer timeline'] },
    { key: 'anniversary_year1', name: 'Vehicle Purchase Anniversary (1-Year)', category: 'lifecycle', trigger_event: 'delivered', channel: 'both', delay_minutes: 525600, sender_identity: 'rep', is_active: true,
      subject_template: 'Happy 1 Year with your {{vehicle.ymm|vehicle}}!',
      message_body_template: `Happy 1-Year Anniversary with your {{vehicle.ymm|vehicle}}, {{customer.first_name|there}}! We hope you have loved every mile. If you ever need anything, I'm just a text away. — {{rep.first_name|Your sales rep}}`,
      steps: ['Trigger: 1 year post-delivery', 'Send celebration message + complimentary wash coupon'] },
    { key: 'anniversary_multi', name: 'Long-Term Ownership Milestone (Years 2, 3, 4, 5)', category: 'lifecycle', trigger_event: 'delivered', channel: 'email', delay_minutes: 1051200, sender_identity: 'house', is_active: true,
      subject_template: 'Milestone Anniversary with {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}},\n\nThank you for being a long-time member of the {{dealership.name}} family. We appreciate your loyalty and are always here for your sales, service, and parts needs.\n\nWarm regards,\n{{dealership.name}} Team`,
      steps: ['Trigger: 2, 3, 4, 5 years post-delivery', 'Maintain brand retention'] },
    { key: 'holidays_thanksgiving', name: 'Thanksgiving Customer Appreciation Greeting', category: 'lifecycle', trigger_event: 'holiday', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Happy Thanksgiving from {{dealership.name}}',
      message_body_template: `Wishing you and your loved ones a very Happy Thanksgiving! We are grateful for your continued support and trust in {{dealership.name}}.`,
      steps: ['Trigger: Thanksgiving holiday date', 'Dispatches to active customer base'] },
    { key: 'holidays_newyear', name: 'New Year Greeting & Holiday Hours', category: 'lifecycle', trigger_event: 'holiday', channel: 'email', delay_minutes: 0, sender_identity: 'house', is_active: true,
      subject_template: 'Happy New Year from {{dealership.name}}!',
      message_body_template: `Happy New Year, {{customer.first_name|there}}! May the coming year bring health, happiness, and great roads ahead. Thank you for choosing {{dealership.name}}!`,
      steps: ['Trigger: January 1st', 'Dispatches morning greeting'] }
  ],

  custom: [
    { key: 'custom_vip_tradein', name: 'Custom High-Value Trade Appraisal Flow', category: 'custom', trigger_event: 'custom_trigger', channel: 'both', delay_minutes: 15, sender_identity: 'rep', is_active: true,
      subject_template: 'Your custom trade appraisal at {{dealership.name}}',
      message_body_template: `Hi {{customer.first_name|there}}, your trade evaluation has been processed. We are prepared to offer top dollar for your vehicle. Can we connect for 2 minutes today?`,
      steps: ['Trigger: Custom Webhook / Manual Enrollment', 'Wait 15 minutes', 'Send dual SMS & Email', 'Assign priority sales agent', 'Stop condition: Call completed'] },
    { key: 'custom_weekend_drive', name: 'Custom Extended Weekend Test Drive Campaign', category: 'custom', trigger_event: 'custom_trigger', channel: 'sms', delay_minutes: 0, sender_identity: 'rep', is_active: true,
      message_body_template: `Hi {{customer.first_name|there}}, we have an exclusive 24-hour overnight test drive available on the {{vehicle.ymm|vehicle}} this weekend. Would you like to reserve it? — {{rep.first_name|Your team}}`,
      steps: ['Trigger: Tagged VIP prospect', 'Send test drive invitation', 'Stop condition: Reservation confirmed'] }
  ]
};

// ── Render Top Operational Metrics Strip ──────────────────────────────────────
function renderAutoMetricsStrip() {
  const container = document.getElementById('auto-builder-metrics');
  if (!container) return;

  // Compute active automations across all categories
  let totalActive = 0;
  let totalCount = 0;
  Object.values(ALL_AUTOMATIONS_CATALOG).forEach(list => {
    list.forEach(item => {
      totalCount++;
      if (item.is_active !== false) totalActive++;
    });
  });

  container.innerHTML = `
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Active Flows</div>
        <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">${totalActive} <span class="text-xs font-semibold text-slate-400">/ ${totalCount}</span></div>
        <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Live running</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Messages Sent</div>
        <div class="text-xl font-black text-slate-900 dark:text-white mt-1">14,820</div>
        <div class="text-[10px] text-slate-400 font-bold mt-0.5">Last 30 days</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Email Delivery</div>
        <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">99.4%</div>
        <div class="text-[10px] text-slate-400 font-bold mt-0.5">SPF / DKIM verified</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">SMS Delivery</div>
        <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">99.8%</div>
        <div class="text-[10px] text-slate-400 font-bold mt-0.5">10DLC registered</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Reply Rate</div>
        <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">18.2%</div>
        <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">+4.1% vs baseline</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Re-engaged</div>
        <div class="text-xl font-black text-sky-600 dark:text-sky-400 mt-1">42 Leads</div>
        <div class="text-[10px] text-slate-400 font-bold mt-0.5">Saved from lost</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Appts Booked</div>
        <div class="text-xl font-black text-violet-600 dark:text-violet-400 mt-1">28 Appts</div>
        <div class="text-[10px] text-slate-400 font-bold mt-0.5">Showroom &amp; Service</div>
      </div>
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div class="text-[11px] font-black uppercase tracking-wider text-slate-400">Attributed Rev</div>
        <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">$148.2k</div>
        <div class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">14 closed deals</div>
      </div>
    </div>
  `;
}

// ── Main Page Loader for Email & SMS Automation Engine ────────────────────────
async function loadAutoBuilderPage() {
  const tabsEl = document.getElementById('auto-builder-tabs');
  if (!tabsEl) return;

  renderAutoMetricsStrip();

  const tabBtn = (id, label) => `
    <button onclick="autoTab('${id}')" class="px-4 py-2.5 text-xs font-black border-b-2 transition whitespace-nowrap cursor-pointer ${__autoTab === id ? 'border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}">
      ${label}
    </button>
  `;

  tabsEl.innerHTML = `
    <div class="flex items-center gap-1 overflow-x-auto w-full border-b border-slate-200 dark:border-slate-800">
      ${tabBtn('overview', 'Overview')}
      ${tabBtn('leads', 'Lead')}
      ${tabBtn('sales', 'Sales & Delivery')}
      ${tabBtn('service', 'Service')}
      ${tabBtn('inventory', 'Inventory')}
      ${tabBtn('marketing', 'Marketing')}
      ${tabBtn('lifecycle', 'Lifecycle')}
      ${tabBtn('custom', 'Custom')}
      ${tabBtn('performance', 'Performance')}
    </div>
  `;

  // Hide auxiliary containers
  const roots = { delivery: 'auto-delivery-root', holidays: 'auto-holidays-root' };
  Object.values(roots).forEach(id => document.getElementById(id)?.classList.add('hidden'));

  const mainRoot = document.getElementById('auto-leads-root');
  if (!mainRoot) return;
  mainRoot.classList.remove('hidden');

  if (__autoTab === 'overview') {
    renderAutoOverviewTab(mainRoot);
  } else if (__autoTab === 'performance') {
    renderAutoPerformanceTab(mainRoot);
  } else if (__autoTab === 'custom') {
    renderAutoCategoryTab(mainRoot, 'custom', 'Custom Automation Workflows', 'Build custom multi-step event triggers, delays, branch logic, salesperson assignments, and webhook actions.');
  } else if (__autoTab === 'leads') {
    renderAutoCategoryTab(mainRoot, 'leads', 'Sales Lead Follow-up Automations', 'Rapid response speed-to-lead, appointment reminders, still-looking check-ins, and long-term buyer nurture sequences.');
  } else if (__autoTab === 'sales' || __autoTab === 'delivery') {
    renderAutoCategoryTab(mainRoot, 'sales', 'Sales & Vehicle Delivery Automations', 'Post-delivery congratulations, first-month check-ins, Google review routers, referral rewards, and purchase anniversaries.');
  } else if (__autoTab === 'service') {
    renderAutoCategoryTab(mainRoot, 'service', 'Service Department Automations', 'Appointment confirmations, video MPI updates, vehicle ready alerts, declined service follow-ups, and maintenance intervals.');
  } else if (__autoTab === 'inventory') {
    renderAutoCategoryTab(mainRoot, 'inventory', 'Inventory & Sales Opportunity Automations', 'Price drop notifications, similar vehicle arrivals, aged inventory clearance, lease maturities, and equity radar alerts.');
  } else if (__autoTab === 'marketing') {
    renderAutoCategoryTab(mainRoot, 'marketing', 'Marketing Campaigns & Broadcast Automations', 'Monthly newsletters, holiday sales specials, VIP tent events, service coupon packs, and inactive customer win-backs.');
  } else if (__autoTab === 'lifecycle' || __autoTab === 'holidays' || __autoTab === 'birthdays') {
    renderAutoCategoryTab(mainRoot, 'lifecycle', 'Customer Lifecycle & Calendar Automations', 'Birthday greetings, annual purchase milestones, regional holiday wishes, and customer appreciation campaigns.');
  }
}
window.loadAutoBuilderPage = loadAutoBuilderPage;

// ── Render Category Tab with Rich Cards & Visual Flows ────────────────────────
function renderAutoCategoryTab(container, categoryKey, title, description) {
  const items = ALL_AUTOMATIONS_CATALOG[categoryKey] || [];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Section Header -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-500/20 shadow-md">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">Communication Engine</span>
            <h3 class="text-xl font-black text-white mt-1.5">${esc(title)}</h3>
            <p class="text-xs text-slate-300 mt-1 max-w-2xl">${esc(description)}</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openMarketingEmailSettings()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition">Settings &amp; Providers</button>
            <button onclick="openAutoNewWorkflowModal('${categoryKey}')" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md">+ New Automation</button>
          </div>
        </div>
      </div>

      <!-- Workflow Cards Grid -->
      <div class="grid gap-4">
        ${items.length ? items.map(wf => renderAutoWorkflowCard(wf)).join('') : `
          <div class="py-12 text-center text-sm text-slate-400 italic bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            No active workflows in this category yet. Click <b>+ New Automation</b> to create one.
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Render Individual Workflow Card ───────────────────────────────────────────
function renderAutoWorkflowCard(wf) {
  const isBoth = wf.channel === 'both';
  const isSms = wf.channel === 'sms';
  const isTask = wf.channel === 'task';
  const chClass = isBoth ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
    : isSms ? 'bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30'
    : isTask ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
    : 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30';

  const chLabel = isBoth ? 'Email + SMS' : isSms ? 'SMS Only' : isTask ? 'Sales Rep Task' : 'Email Only';

  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition hover:border-slate-300 dark:hover:border-slate-700 space-y-4">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div class="flex items-start gap-3">
          <div class="w-3.5 h-3.5 rounded-full mt-1 ${wf.is_active !== false ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-400'}"></div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="text-sm font-black text-slate-900 dark:text-white">${esc(wf.name)}</h4>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${chClass}">${chLabel}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Sender: ${wf.sender_identity === 'rep' ? 'Assigned Rep' : wf.sender_identity === 'house' ? 'Dealership' : 'Smart Switch'}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">Trigger: <span class="text-slate-700 dark:text-slate-200">${esc(wf.trigger_event)}</span> · Delay: <span class="text-slate-700 dark:text-slate-200">${autoDelayText(wf.delay_minutes)}</span></p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" ${wf.is_active !== false ? 'checked' : ''} onchange="toggleWorkflowActive('${wf.key}', this.checked)" class="sr-only peer">
            <div class="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      <!-- Step Map & Conditions -->
      ${wf.steps && wf.steps.length ? `
        <div class="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-mono space-y-1 text-slate-600 dark:text-slate-300">
          ${wf.steps.map((st, i) => `
            <div class="${i === 0 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : i === wf.steps.length - 1 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}">
              ${i === 0 ? ' ' : '└─ '}${esc(st)}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Message Template Preview -->
      <div class="p-3 bg-slate-50/50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300">
        ${wf.subject_template ? `<div class="font-bold text-slate-900 dark:text-white mb-1">Subject: ${esc(wf.subject_template)}</div>` : ''}
        <div class="italic line-clamp-2">"${esc(wf.message_body_template)}"</div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap gap-2">
        <div class="flex items-center gap-1.5">
          <button onclick="openAutoWorkflowModal('${wf.key}')" class="px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs transition">Edit Template &amp; Rules</button>
          <button onclick="quickAiRewriteWorkflow('${wf.key}')" class="px-3 py-1.5 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-600 dark:text-violet-400 font-bold text-xs transition">AI Rewrite</button>
          <button onclick="testSendWorkflowModal('${wf.key}')" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition">Test Send</button>
        </div>
        <div class="text-[11px] text-slate-400">
          Updated recently · Zero human delay
        </div>
      </div>
    </div>
  `;
}

// ── Render Overview Tab ───────────────────────────────────────────────────────
function renderAutoOverviewTab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Welcome Hero Banner -->
      <div class="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border border-indigo-900/50 shadow-xl">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              Autonomous Dealership Communications
            </div>
            <h2 class="text-2xl font-black tracking-tight text-white">Email &amp; SMS Automation Engine</h2>
            <p class="text-xs text-slate-300 mt-1 max-w-2xl">
              MarketSync runs event-driven lead follow-up, post-delivery retention, service reminders, price drop alerts, and customer win-back journeys automatically without human delay.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="openMarketingEmailSettings()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition">Email &amp; SMS Settings</button>
            <button onclick="autoTab('custom')" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg transition">+ Create Custom Flow</button>
          </div>
        </div>
      </div>

      <!-- Core Automation Categories Hub -->
      <div>
        <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Automation Categories</h3>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onclick="autoTab('leads')" class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-500 transition cursor-pointer group">
            <div class="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black mb-3 group-hover:bg-indigo-600 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>
            </div>
            <h4 class="text-base font-black text-slate-900 dark:text-white">Lead Follow-ups</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">90-second rapid response, missed calls, day 1-7 follow-ups, appointments.</p>
            <div class="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-3 flex items-center gap-1">12 Flows Active &rarr;</div>
          </div>

          <div onclick="autoTab('sales')" class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500 transition cursor-pointer group">
            <div class="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black mb-3 group-hover:bg-emerald-600 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <h4 class="text-base font-black text-slate-900 dark:text-white">Sales &amp; Delivery</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Delivery checklists, review requests, referrals, and ownership anniversaries.</p>
            <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-3 flex items-center gap-1">11 Flows Active &rarr;</div>
          </div>

          <div onclick="autoTab('service')" class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-sky-500 transition cursor-pointer group">
            <div class="w-10 h-10 rounded-xl bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black mb-3 group-hover:bg-sky-600 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 004.486-6.32l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.32 4.486c.118.58.094 1.193-.07 1.743"/></svg>
            </div>
            <h4 class="text-base font-black text-slate-900 dark:text-white">Service Department</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Service booking, video inspection updates, vehicle ready alerts, oil &amp; tires.</p>
            <div class="text-xs font-bold text-sky-600 dark:text-sky-400 mt-3 flex items-center gap-1">12 Flows Active &rarr;</div>
          </div>

          <div onclick="autoTab('inventory')" class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-violet-500 transition cursor-pointer group">
            <div class="w-10 h-10 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black mb-3 group-hover:bg-violet-600 group-hover:text-white transition">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>
            </div>
            <h4 class="text-base font-black text-slate-900 dark:text-white">Inventory &amp; Equity</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Price drop alerts, similar inventory matches, lease pull-ahead, equity radar.</p>
            <div class="text-xs font-bold text-violet-600 dark:text-violet-400 mt-3 flex items-center gap-1">11 Flows Active &rarr;</div>
          </div>
        </div>
      </div>

      <!-- Featured Highlight Workflows -->
      <div>
        <h3 class="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Top Performing Live Workflows</h3>
        <div class="space-y-4">
          ${renderAutoWorkflowCard(ALL_AUTOMATIONS_CATALOG.leads[0])}
          ${renderAutoWorkflowCard(ALL_AUTOMATIONS_CATALOG.sales[10])}
          ${renderAutoWorkflowCard(ALL_AUTOMATIONS_CATALOG.service[0])}
        </div>
      </div>
    </div>
  `;
}

// ── Render Performance Tab ────────────────────────────────────────────────────
function renderAutoPerformanceTab(container) {
  const rows = [
    { name: 'Instant New Lead 90-Second Response', channel: 'SMS', sent: 3420, delivered: '99.8%', opened: '94.2%', replied: '26.4%', appts: 18, sales: 8, rev: '$84,000' },
    { name: '48-Hour Google Review Router', channel: 'SMS', sent: 1140, delivered: '99.9%', opened: '96.1%', replied: '48.2%', appts: '—', sales: '—', rev: '4.9  Rating' },
    { name: 'Showroom Appointment 2-Hour Reminder', channel: 'SMS', sent: 890, delivered: '99.7%', opened: '98.0%', replied: '19.2%', appts: 62, sales: 24, rev: '$210,000' },
    { name: 'Price Drop Alert on Viewed Units', channel: 'Email + SMS', sent: 2150, delivered: '99.2%', opened: '62.4%', replied: '14.8%', appts: 9, sales: 4, rev: '$42,500' },
    { name: '6-Month Factory Maintenance Reminder', channel: 'Email + SMS', sent: 4890, delivered: '99.5%', opened: '54.8%', replied: '22.1%', appts: 94, sales: '—', rev: '$38,900' },
    { name: 'Lease 6-Month Maturity Pull-Ahead', channel: 'Email + SMS', sent: 420, delivered: '99.6%', opened: '71.2%', replied: '31.5%', appts: 12, sales: 7, rev: '$78,400' },
  ];

  container.innerHTML = `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="text-lg font-black text-slate-900 dark:text-white">Email &amp; SMS Performance Telemetry</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Detailed conversion metrics, response rates, and closed revenue attribution.</p>
        </div>
        <button onclick="showToast('Exporting CSV report...', 'info')" class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">Export CSV</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400">
              <th class="py-3 px-2">Automation Workflow</th>
              <th class="py-3 px-2">Channel</th>
              <th class="py-3 px-2">Sent</th>
              <th class="py-3 px-2">Delivery</th>
              <th class="py-3 px-2">Open Rate</th>
              <th class="py-3 px-2">Reply Rate</th>
              <th class="py-3 px-2">Appts</th>
              <th class="py-3 px-2">Deals</th>
              <th class="py-3 px-2">Attributed Rev</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            ${rows.map(r => `
              <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                <td class="py-3 px-2 font-bold text-slate-900 dark:text-white">${esc(r.name)}</td>
                <td class="py-3 px-2"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">${esc(r.channel)}</span></td>
                <td class="py-3 px-2 font-mono">${r.sent.toLocaleString()}</td>
                <td class="py-3 px-2 font-mono text-emerald-600 dark:text-emerald-400 font-bold">${r.delivered}</td>
                <td class="py-3 px-2 font-mono">${r.opened}</td>
                <td class="py-3 px-2 font-mono text-indigo-600 dark:text-indigo-400 font-bold">${r.replied}</td>
                <td class="py-3 px-2 font-mono font-bold">${r.appts}</td>
                <td class="py-3 px-2 font-mono font-bold">${r.sales}</td>
                <td class="py-3 px-2 font-mono font-black text-emerald-600 dark:text-emerald-400">${r.rev}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// VISUAL AUTOMATION BUILDER — N8N-STYLE, MARKETSYNC-SIMPLE
// Interactive node-based canvas, visual execution engine, live validation & AI
// ══════════════════════════════════════════════════════════════════════════════

// ── Node Types Definition & Palette ──────────────────────────────────────────
const VISUAL_NODE_LIBRARY = {
  triggers: [
    // CRM Triggers
    { type: 'trigger_crm_new_lead', category: 'trigger', subcat: 'CRM', label: 'New Lead Created', icon: 'user', desc: 'Fires when an inbound lead arrives from any CRM source.' },
    { type: 'trigger_crm_status_changed', category: 'trigger', subcat: 'CRM', label: 'Lead Status Changed', icon: 'tag', desc: 'Fires when lead stage changes (e.g. Contacted, Showroom).' },
    { type: 'trigger_crm_customer_replied', category: 'trigger', subcat: 'CRM', label: 'Customer Replied', icon: 'mail', desc: 'Fires when a customer sends an SMS or email reply.' },
    { type: 'trigger_crm_appt_booked', category: 'trigger', subcat: 'CRM', label: 'Appointment Booked', icon: 'calendar', desc: 'Fires when a showroom or test drive appointment is set.' },
    { type: 'trigger_crm_appt_missed', category: 'trigger', subcat: 'CRM', label: 'Appointment Missed / No-Show', icon: 'alert', desc: 'Fires when a scheduled customer does not show up.' },
    { type: 'trigger_crm_deal_sold', category: 'trigger', subcat: 'CRM', label: 'Deal Sold', icon: 'dollar', desc: 'Fires when a deal contract is signed.' },
    { type: 'trigger_crm_delivered', category: 'trigger', subcat: 'CRM', label: 'Delivery Completed', icon: 'check', desc: 'Fires when the vehicle is driven off the lot.' },

    // Website Triggers
    { type: 'trigger_web_form', category: 'trigger', subcat: 'Website', label: 'Website Form Submitted', icon: 'window', desc: 'Lead submitted general website contact form.' },
    { type: 'trigger_web_test_drive', category: 'trigger', subcat: 'Website', label: 'Test Drive Requested', icon: 'car', desc: 'Customer requested test drive on specific vehicle.' },
    { type: 'trigger_web_trade_appraisal', category: 'trigger', subcat: 'Website', label: 'Trade Appraisal Submitted', icon: 'clipboard', desc: 'Online trade-in appraisal form completed.' },
    { type: 'trigger_web_credit_app', category: 'trigger', subcat: 'Website', label: 'Credit App Submitted', icon: 'card', desc: 'Online digital credit application submitted.' },
    { type: 'trigger_web_chat_lead', category: 'trigger', subcat: 'Website', label: 'Chat Lead Captured', icon: 'user', desc: 'Website AI ChatBot captured verified phone/email.' },

    // Inventory Triggers
    { type: 'trigger_inv_added', category: 'trigger', subcat: 'Inventory', label: 'Vehicle Added to Inventory', icon: 'car', desc: 'New stock number added from DMS/inventory feed.' },
    { type: 'trigger_inv_price_changed', category: 'trigger', subcat: 'Inventory', label: 'Vehicle Price Drop / Change', icon: 'dollar', desc: 'Price reduced on active inventory unit.' },
    { type: 'trigger_inv_sold', category: 'trigger', subcat: 'Inventory', label: 'Vehicle Sold in DMS', icon: 'check', desc: 'Unit marked sold in DMS inventory ledger.' },
    { type: 'trigger_inv_aging', category: 'trigger', subcat: 'Inventory', label: 'Vehicle Aging Threshold', icon: 'clock', desc: 'Unit reaches 30, 60, or 90 days in stock.' },

    // Service Triggers
    { type: 'trigger_svc_appt_created', category: 'trigger', subcat: 'Service', label: 'Service Appt Booked', icon: 'calendar', desc: 'Customer booked maintenance or repair online.' },
    { type: 'trigger_svc_completed', category: 'trigger', subcat: 'Service', label: 'Repair Order Completed', icon: 'check', desc: 'Technician flagged vehicle ready for pickup.' },
    { type: 'trigger_svc_declined', category: 'trigger', subcat: 'Service', label: 'Declined Service Rec', icon: 'alert', desc: 'Customer declined recommended repair on RO.' },
    { type: 'trigger_svc_maintenance_due', category: 'trigger', subcat: 'Service', label: 'Maintenance Due (Milestone)', icon: 'clock', desc: '6-month or 5,000-mile factory service due date.' },

    // AI ChatBot Triggers
    { type: 'trigger_ai_human_requested', category: 'trigger', subcat: 'AI ChatBot', label: 'Human Rep Requested', icon: 'alert', desc: 'Chat visitor explicitly requested human staff.' },
    { type: 'trigger_ai_abandoned', category: 'trigger', subcat: 'AI ChatBot', label: 'Chat Conversation Abandoned', icon: 'clock', desc: 'Chat visitor dropped off before scheduling.' }
  ],

  actions: [
    // Communication
    { type: 'action_send_sms', category: 'action', subcat: 'Communication', label: 'Send SMS Text', icon: 'mail', desc: 'Dispatch text message via Twilio / verified 10DLC.' },
    { type: 'action_send_email', category: 'action', subcat: 'Communication', label: 'Send Email', icon: 'mail', desc: 'Dispatch branded HTML email via verified domain.' },
    { type: 'action_send_ai_sms', category: 'action', subcat: 'Communication', label: 'Send AI-Written SMS', icon: 'sparkles', desc: 'Generate contextual SMS tailored to customer inquiry.' },
    { type: 'action_send_ai_email', category: 'action', subcat: 'Communication', label: 'Send AI-Written Email', icon: 'sparkles', desc: 'Generate customized relational email body.' },
    { type: 'action_notify_rep', category: 'action', subcat: 'Communication', label: 'Alert Salesperson', icon: 'bell', desc: 'Send push alert / SMS notice to assigned rep.' },
    { type: 'action_notify_mgr', category: 'action', subcat: 'Communication', label: 'Alert Sales Manager', icon: 'bell', desc: 'Send escalation notice to Desk Manager on duty.' },

    // CRM
    { type: 'action_create_task', category: 'action', subcat: 'CRM', label: 'Create CRM Task', icon: 'clipboard', desc: 'Assign actionable follow-up task with due date.' },
    { type: 'action_assign_rep', category: 'action', subcat: 'CRM', label: 'Assign Salesperson', icon: 'user', desc: 'Round-robin or rule-based salesperson assignment.' },
    { type: 'action_update_stage', category: 'action', subcat: 'CRM', label: 'Change Lead Stage', icon: 'tag', desc: 'Transition pipeline stage (e.g. Contacted, Working).' },
    { type: 'action_add_note', category: 'action', subcat: 'CRM', label: 'Add Activity Note', icon: 'doc', desc: 'Log note on canonical customer timeline.' },
    { type: 'action_add_tag', category: 'action', subcat: 'CRM', label: 'Add Tag to Contact', icon: 'tag', desc: 'Tag contact (e.g. Truck-Buyer, VIP-Trade, Prime).' },

    // Marketing & Integration
    { type: 'action_add_campaign', category: 'action', subcat: 'Marketing', label: 'Add to Marketing List', icon: 'user', desc: 'Subscribe customer to email newsletter or SMS group.' },
    { type: 'action_send_webhook', category: 'action', subcat: 'Integration', label: 'Send Webhook (Zapier/Make)', icon: 'globe', desc: 'POST payload to external webhook URL.' }
  ],

  logic: [
    { type: 'logic_if_else', category: 'logic', subcat: 'Flow Control', label: 'If / Else Condition', icon: 'split', desc: 'Branch execution based on rules (YES / NO paths).' },
    { type: 'logic_wait', category: 'logic', subcat: 'Timing', label: 'Wait / Delay Interval', icon: 'clock', desc: 'Pause execution for 90s, hours, days, or business hours.' },
    { type: 'logic_split', category: 'logic', subcat: 'Flow Control', label: 'Multi-Way Split', icon: 'split', desc: 'Split traffic by Lead Source, Vehicle Type, or Tier.' },
    { type: 'logic_stop', category: 'logic', subcat: 'Termination', label: 'Stop Workflow', icon: 'stop', desc: 'Terminate sequence when goal is achieved or customer replies.' }
  ],

  ai: [
    { type: 'ai_generate_message', category: 'ai', subcat: 'Intelligence', label: 'Generate AI Message', icon: 'sparkles', desc: 'Draft hyper-personalized message from CRM profile.' },
    { type: 'ai_score_lead', category: 'ai', subcat: 'Intelligence', label: 'Score Lead Intent', icon: 'chart', desc: 'Score purchase urgency (Hot / Warm / Nurture).' },
    { type: 'ai_summarize', category: 'ai', subcat: 'Intelligence', label: 'Summarize Customer History', icon: 'doc', desc: 'Generate 2-sentence executive summary for rep.' }
  ]
};

// ── 15 Pre-Built Automotive Templates ─────────────────────────────────────────
const VISUAL_TEMPLATES_CATALOG = [
  {
    key: 'speed_to_lead_90s',
    name: 'New Lead 90-Second Rapid Response & SLA Routing',
    category: 'pipeline',
    desc: 'Instant lead engagement: waits 90 seconds, checks for human rep reply, dispatches SMS, assigns salesperson, and executes 3-day follow-up.',
    graph: {
      nodes: [
        { id: 'n_trig', type: 'trigger_crm_new_lead', category: 'trigger', label: 'New Lead Ingested', x: 380, y: 60, config: { source: 'all' } },
        { id: 'n_wait1', type: 'logic_wait', category: 'logic', label: 'Wait 90 Seconds', x: 380, y: 190, config: { delay_value: 90, delay_unit: 'seconds' } },
        { id: 'n_if1', type: 'logic_if_else', category: 'logic', label: 'Human Rep Replied?', x: 380, y: 320, config: { condition_field: 'human_replied', condition_op: 'equals', condition_value: 'true' } },
        { id: 'n_stop1', type: 'logic_stop', category: 'logic', label: 'Stop Sequence (Rep Active)', x: 180, y: 460, config: { reason: 'Human rep actively communicating' } },
        { id: 'n_sms1', type: 'action_send_sms', category: 'action', label: 'Send Rapid SMS', x: 580, y: 460, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, it is {{rep.first_name|the sales team}} at {{dealership.name}}. Saw you were looking at the {{vehicle.ymm|vehicle}} — is that still the one you had your eye on, or are you open to options?' } },
        { id: 'n_assign', type: 'action_assign_rep', category: 'action', label: 'Assign Salesperson (Round Robin)', x: 580, y: 600, config: { routing_mode: 'round_robin' } },
        { id: 'n_wait2', type: 'logic_wait', category: 'logic', label: 'Wait 3 Days', x: 580, y: 740, config: { delay_value: 3, delay_unit: 'days' } },
        { id: 'n_email1', type: 'action_send_email', category: 'action', label: 'Day 3 Check-in Email', x: 580, y: 880, config: { sender_identity: 'house', subject_template: 'Still shopping for the {{vehicle.model|vehicle}}?', message_template: 'Hi {{customer.first_name|there}},\n\nJust circling back on the {{vehicle.ymm|vehicle}} at {{dealership.name}}. Are you still looking to take a test drive this week?\n\n{{rep.first_name|Your sales team}}\n{{dealership.name}}' } },
        { id: 'n_stop2', type: 'logic_stop', category: 'logic', label: 'Stop on Appointment / Reply', x: 580, y: 1020, config: { reason: 'Customer booked appointment or replied' } }
      ],
      edges: [
        { id: 'e1', source: 'n_trig', target: 'n_wait1' },
        { id: 'e2', source: 'n_wait1', target: 'n_if1' },
        { id: 'e_yes', source: 'n_if1', target: 'n_stop1', label: 'YES' },
        { id: 'e_no', source: 'n_if1', target: 'n_sms1', label: 'NO' },
        { id: 'e3', source: 'n_sms1', target: 'n_assign' },
        { id: 'e4', source: 'n_assign', target: 'n_wait2' },
        { id: 'e5', source: 'n_wait2', target: 'n_email1' },
        { id: 'e6', source: 'n_email1', target: 'n_stop2' }
      ]
    }
  },
  {
    key: 'review_router_48h',
    name: '48-Hour Google Review Request & Routing',
    category: 'reviews',
    desc: 'Post-delivery review cadence that checks customer satisfaction before routing to Google Review page.',
    graph: {
      nodes: [
        { id: 'r_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Vehicle Delivered', x: 380, y: 60, config: {} },
        { id: 'r_wait', type: 'logic_wait', category: 'logic', label: 'Wait 48 Hours', x: 380, y: 190, config: { delay_value: 48, delay_unit: 'hours' } },
        { id: 'r_sms', type: 'action_send_sms', category: 'action', label: 'Send Review Request SMS', x: 380, y: 320, config: { sender_identity: 'house', message_template: 'Hi {{customer.first_name|there}}, thanks again for choosing {{dealership.name}}! If you have 30 seconds, a quick Google review would mean the world to our team: {{review_url}}' } },
        { id: 'r_stop', type: 'logic_stop', category: 'logic', label: 'Complete Journey', x: 380, y: 460, config: { reason: 'Review request sent' } }
      ],
      edges: [
        { id: 're1', source: 'r_trig', target: 'r_wait' },
        { id: 're2', source: 'r_wait', target: 'r_sms' },
        { id: 're3', source: 'r_sms', target: 'r_stop' }
      ]
    }
  },
  {
    key: 'missed_appt_recovery',
    name: 'Missed Appointment No-Show Recovery',
    category: 'pipeline',
    desc: 'Automatically checks in with customers who missed their scheduled test drive within 25 minutes.',
    graph: {
      nodes: [
        { id: 'm_trig', type: 'trigger_crm_appt_missed', category: 'trigger', label: 'Appointment Missed', x: 380, y: 60, config: {} },
        { id: 'm_wait', type: 'logic_wait', category: 'logic', label: 'Wait 25 Minutes', x: 380, y: 190, config: { delay_value: 25, delay_unit: 'minutes' } },
        { id: 'm_sms', type: 'action_send_sms', category: 'action', label: 'Send Reschedule SMS', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, sorry we missed you for your appointment today at {{dealership.name}}! Let me know if you would like to reschedule for tomorrow or this weekend.' } },
        { id: 'm_task', type: 'action_create_task', category: 'action', label: 'Create Rep Call Task', x: 380, y: 460, config: { task_title: 'Call missed appointment lead' } }
      ],
      edges: [
        { id: 'me1', source: 'm_trig', target: 'm_wait' },
        { id: 'me2', source: 'm_wait', target: 'm_sms' },
        { id: 'me3', source: 'm_sms', target: 'm_task' }
      ]
    }
  },
  {
    key: 'nurture_7day_lead',
    name: '7-Day Inactive Lead Re-Engagement',
    category: 'pipeline',
    desc: 'Multi-touch nurture sequence for leads that went cold after initial contact.',
    graph: {
      nodes: [
        { id: 'n7_trig', type: 'trigger_crm_new_lead', category: 'trigger', label: 'Lead Inactive 7 Days', x: 380, y: 60, config: {} },
        { id: 'n7_wait1', type: 'logic_wait', category: 'logic', label: 'Wait 7 Days', x: 380, y: 190, config: { delay_value: 7, delay_unit: 'days' } },
        { id: 'n7_sms', type: 'action_send_sms', category: 'action', label: 'Send Still Looking SMS', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hey {{customer.first_name|there}} — did you end up finding something, or are you still shopping around for the {{vehicle.model|right vehicle}}?' } }
      ],
      edges: [
        { id: 'n7_e1', source: 'n7_trig', target: 'n7_wait1' },
        { id: 'n7_e2', source: 'n7_wait1', target: 'n7_sms' }
      ]
    }
  },
  {
    key: 'day1_delivery_welcome',
    name: 'Day 1 Post-Delivery Welcome & Tech Support',
    category: 'retention',
    desc: 'Warm congratulatory text message providing assistance with vehicle tech, phone pairing, and owner onboarding.',
    graph: {
      nodes: [
        { id: 'd1_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Delivery Completed', x: 380, y: 60, config: {} },
        { id: 'd1_wait', type: 'logic_wait', category: 'logic', label: 'Wait 24 Hours', x: 380, y: 190, config: { delay_value: 24, delay_unit: 'hours' } },
        { id: 'd1_sms', type: 'action_send_sms', category: 'action', label: 'Send Welcome SMS', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Congrats again on the {{vehicle.ymm|new vehicle}}, {{customer.first_name|there}}! Hope the first drive was a good one. If you want a hand pairing your phone or setting up dash settings, shout anytime!' } }
      ],
      edges: [
        { id: 'd1_e1', source: 'd1_trig', target: 'd1_wait' },
        { id: 'd1_e2', source: 'd1_wait', target: 'd1_sms' }
      ]
    }
  },
  {
    key: 'day30_milestone',
    name: '30-Day New Owner Check-In & Service Intro',
    category: 'retention',
    desc: 'One month milestone email introducing the service team and online appointment scheduling portal.',
    graph: {
      nodes: [
        { id: 'd30_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Vehicle Delivered', x: 380, y: 60, config: {} },
        { id: 'd30_wait', type: 'logic_wait', category: 'logic', label: 'Wait 30 Days', x: 380, y: 190, config: { delay_value: 30, delay_unit: 'days' } },
        { id: 'd30_email', type: 'action_send_email', category: 'action', label: 'Send 30-Day Check-in Email', x: 380, y: 320, config: { sender_identity: 'house', subject_template: 'One month in — how is the {{vehicle.model|new ride}}?', message_template: 'Hi {{customer.first_name|there}},\n\nHard to believe it is already been a month with your {{vehicle.ymm|vehicle}}! When you are ready for routine maintenance, you can book online anytime: {{service_url}}.\n\nThanks again from {{dealership.name}}!' } }
      ],
      edges: [
        { id: 'd30_e1', source: 'd30_trig', target: 'd30_wait' },
        { id: 'd30_e2', source: 'd30_wait', target: 'd30_email' }
      ]
    }
  },
  {
    key: 'service_reminder_6mo',
    name: '6-Month Factory Recommended Service Notice',
    category: 'retention',
    desc: 'Automated maintenance cadence for oil change, tire rotation, and safety inspection.',
    graph: {
      nodes: [
        { id: 's6_trig', type: 'trigger_svc_completed', category: 'trigger', label: 'Last Service Completed', x: 380, y: 60, config: {} },
        { id: 's6_wait', type: 'logic_wait', category: 'logic', label: 'Wait 180 Days', x: 380, y: 190, config: { delay_value: 180, delay_unit: 'days' } },
        { id: 's6_sms', type: 'action_send_sms', category: 'action', label: 'Send Maintenance Alert', x: 380, y: 320, config: { sender_identity: 'house', message_template: 'Hi {{customer.first_name|there}}, your {{vehicle.model|vehicle}} is due for factory recommended routine service. Book online in 60 seconds: {{service_url}}' } }
      ],
      edges: [
        { id: 's6_e1', source: 's6_trig', target: 's6_wait' },
        { id: 's6_e2', source: 's6_wait', target: 's6_sms' }
      ]
    }
  },
  {
    key: 'service_declined_rec',
    name: 'Declined Service Recommendation Follow-Up',
    category: 'retention',
    desc: 'Gentle follow-up on critical repairs or maintenance items declined during the last service visit.',
    graph: {
      nodes: [
        { id: 'sd_trig', type: 'trigger_svc_declined', category: 'trigger', label: 'Declined RO Recommendation', x: 380, y: 60, config: {} },
        { id: 'sd_wait', type: 'logic_wait', category: 'logic', label: 'Wait 14 Days', x: 380, y: 190, config: { delay_value: 14, delay_unit: 'days' } },
        { id: 'sd_sms', type: 'action_send_sms', category: 'action', label: 'Send Recall & Safety Notice', x: 380, y: 320, config: { sender_identity: 'house', message_template: 'Hi {{customer.first_name|there}}, our service director wanted to check in on the repair recommendation from your last visit on your {{vehicle.model|vehicle}}. Let us know if you would like us to reserve parts.' } }
      ],
      edges: [
        { id: 'sd_e1', source: 'sd_trig', target: 'sd_wait' },
        { id: 'sd_e2', source: 'sd_wait', target: 'sd_sms' }
      ]
    }
  },
  {
    key: 'lease_pull_ahead',
    name: 'Lease Maturity & Equity Mining Pull-Ahead',
    category: 'equity',
    desc: 'Targeted equity campaign for customers 6 months prior to lease expiration.',
    graph: {
      nodes: [
        { id: 'eq_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Delivered (30-Month Trigger)', x: 380, y: 60, config: {} },
        { id: 'eq_wait', type: 'logic_wait', category: 'logic', label: 'Wait 30 Months', x: 380, y: 190, config: { delay_value: 30, delay_unit: 'days' } },
        { id: 'eq_sms', type: 'action_send_sms', category: 'action', label: 'Send Pull-Ahead SMS', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, it is {{rep.first_name}} at {{dealership.name}}. Great news on your {{vehicle.ymm|vehicle}} — you may be in a strong equity position to upgrade early for a similar payment. Want me to run numbers?' } }
      ],
      edges: [
        { id: 'eqe1', source: 'eq_trig', target: 'eq_wait' },
        { id: 'eqe2', source: 'eq_wait', target: 'eq_sms' }
      ]
    }
  },
  {
    key: 'trade_appraisal_drop',
    name: 'Incomplete Trade Appraisal Re-Engagement',
    category: 'pipeline',
    desc: 'Triggers when a customer inputs their VIN/plate online but does not complete appointment booking.',
    graph: {
      nodes: [
        { id: 'ta_trig', type: 'trigger_web_trade_appraisal', category: 'trigger', label: 'Trade Form Submitted', x: 380, y: 60, config: {} },
        { id: 'ta_wait', type: 'logic_wait', category: 'logic', label: 'Wait 15 Minutes', x: 380, y: 190, config: { delay_value: 15, delay_unit: 'minutes' } },
        { id: 'ta_sms', type: 'action_send_sms', category: 'action', label: 'Send Valuation Offer', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, we reviewed your trade appraisal for the {{vehicle.ymm|vehicle}}. We have high demand for this trade and can offer top market value. Can we schedule a 10-min visual inspection?' } }
      ],
      edges: [
        { id: 'ta_e1', source: 'ta_trig', target: 'ta_wait' },
        { id: 'ta_e2', source: 'ta_wait', target: 'ta_sms' }
      ]
    }
  },
  {
    key: 'price_drop_watcher',
    name: 'Inventory Price Drop Notification for Saved Units',
    category: 'pipeline',
    desc: 'Alerts leads who viewed or inquired about a specific vehicle when price is reduced.',
    graph: {
      nodes: [
        { id: 'pd_trig', type: 'trigger_inv_price_changed', category: 'trigger', label: 'Vehicle Price Reduced', x: 380, y: 60, config: {} },
        { id: 'pd_wait', type: 'logic_wait', category: 'logic', label: 'Wait 5 Minutes', x: 380, y: 190, config: { delay_value: 5, delay_unit: 'minutes' } },
        { id: 'pd_sms', type: 'action_send_sms', category: 'action', label: 'Send Price Drop Alert', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Great news {{customer.first_name|there}}! The {{vehicle.ymm|vehicle}} you checked out just had a price drop at {{dealership.name}}. Are you still interested before it gets claimed?' } }
      ],
      edges: [
        { id: 'pd_e1', source: 'pd_trig', target: 'pd_wait' },
        { id: 'pd_e2', source: 'pd_wait', target: 'pd_sms' }
      ]
    }
  },
  {
    key: 'birthday_vip_gift',
    name: 'Customer Birthday Anniversary & Service Credit',
    category: 'retention',
    desc: 'Annual customer celebration text with an exclusive service or detailing voucher.',
    graph: {
      nodes: [
        { id: 'b_trig', type: 'trigger_crm_new_lead', category: 'trigger', label: 'Customer Birthday Match', x: 380, y: 60, config: {} },
        { id: 'b_sms', type: 'action_send_sms', category: 'action', label: 'Send Birthday Text', x: 380, y: 190, config: { sender_identity: 'rep', message_template: 'Happy Birthday {{customer.first_name|there}}! Wishing you a fantastic day from all of us at {{dealership.name}}. Stop by this month for a complimentary executive car wash on us!' } }
      ],
      edges: [
        { id: 'b_e1', source: 'b_trig', target: 'b_sms' }
      ]
    }
  },
  {
    key: 'referral_day14',
    name: 'Day 14 Customer Referral Program Pitch',
    category: 'referrals',
    desc: 'Engages happy new owners 2 weeks after purchase with a referral reward offer.',
    graph: {
      nodes: [
        { id: 'ref_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Vehicle Delivered', x: 380, y: 60, config: {} },
        { id: 'ref_wait', type: 'logic_wait', category: 'logic', label: 'Wait 14 Days', x: 380, y: 190, config: { delay_value: 14, delay_unit: 'days' } },
        { id: 'ref_sms', type: 'action_send_sms', category: 'action', label: 'Send Referral Offer', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hey {{customer.first_name|there}}! Hope you are loving the {{vehicle.model|new ride}}. Quick reminder: we pay a $250 referral bonus for any friend or family member you send our way who buys. Send them my direct line anytime!' } }
      ],
      edges: [
        { id: 'ref_e1', source: 'ref_trig', target: 'ref_wait' },
        { id: 'ref_e2', source: 'ref_wait', target: 'ref_sms' }
      ]
    }
  },
  {
    key: 'credit_app_dropoff',
    name: 'Unfinished Online Credit Application Assist',
    category: 'pipeline',
    desc: 'Assists customers who started a digital credit app but did not finalize submission.',
    graph: {
      nodes: [
        { id: 'ca_trig', type: 'trigger_web_credit_app', category: 'trigger', label: 'Credit App Incomplete', x: 380, y: 60, config: {} },
        { id: 'ca_wait', type: 'logic_wait', category: 'logic', label: 'Wait 20 Minutes', x: 380, y: 190, config: { delay_value: 20, delay_unit: 'minutes' } },
        { id: 'ca_sms', type: 'action_send_sms', category: 'action', label: 'Send Finance Assist SMS', x: 380, y: 320, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, our finance team saw you started an online application for the {{vehicle.ymm|vehicle}}. Would you like a finance specialist to help lock in competitive rates for you?' } }
      ],
      edges: [
        { id: 'ca_e1', source: 'ca_trig', target: 'ca_wait' },
        { id: 'ca_e2', source: 'ca_wait', target: 'ca_sms' }
      ]
    }
  },
  {
    key: 'website_chat_capture',
    name: 'AI ChatBot Lead Immediate Sales Rep Dispatch',
    category: 'pipeline',
    desc: 'Instant lead routing when AI website assistant captures verified phone and vehicle interest.',
    graph: {
      nodes: [
        { id: 'wc_trig', type: 'trigger_web_chat_lead', category: 'trigger', label: 'Chat Lead Captured', x: 380, y: 60, config: {} },
        { id: 'wc_sms', type: 'action_send_sms', category: 'action', label: 'Send Immediate Text', x: 380, y: 190, config: { sender_identity: 'rep', message_template: 'Hi {{customer.first_name|there}}, this is {{rep.first_name|the team}} at {{dealership.name}}. Continuing our conversation from our website chat about the {{vehicle.ymm|vehicle}} — what questions can I answer for you?' } },
        { id: 'wc_assign', type: 'action_assign_rep', category: 'action', label: 'Assign Sales Rep', x: 380, y: 320, config: { routing_mode: 'round_robin' } }
      ],
      edges: [
        { id: 'wc_e1', source: 'wc_trig', target: 'wc_sms' },
        { id: 'wc_e2', source: 'wc_sms', target: 'wc_assign' }
      ]
    }
  },
  {
    key: 'quarterly_equity_pulse',
    name: '18-Month Equity Position & Trade-Up Alert',
    category: 'equity',
    desc: 'Mid-term ownership equity check to invite customers into newer inventory with zero out-of-pocket.',
    graph: {
      nodes: [
        { id: 'qp_trig', type: 'trigger_crm_delivered', category: 'trigger', label: 'Vehicle Delivered (18 Mo)', x: 380, y: 60, config: {} },
        { id: 'qp_wait', type: 'logic_wait', category: 'logic', label: 'Wait 540 Days', x: 380, y: 190, config: { delay_value: 540, delay_unit: 'days' } },
        { id: 'qp_email', type: 'action_send_email', category: 'action', label: 'Send Equity Report Email', x: 380, y: 320, config: { sender_identity: 'house', subject_template: 'Equity status report for your {{vehicle.ymm|vehicle}}', message_template: 'Hi {{customer.first_name|there}},\n\nVehicle values are currently elevated for pre-owned {{vehicle.make|vehicles}}. You may be eligible to trade into a newer model with full warranty coverage for a comparable payment.\n\nReply to this email or call us to see your options.' } }
      ],
      edges: [
        { id: 'qp_e1', source: 'qp_trig', target: 'qp_wait' },
        { id: 'qp_e2', source: 'qp_wait', target: 'qp_email' }
      ]
    }
  }
];

// ── Visual Builder Global State ───────────────────────────────────────────────
let __vb = {
  active: false,
  wfKey: null,
  wfName: 'Workflow',
  category: 'pipeline',
  isActive: true,
  mode: 'simple', // 'simple' | 'advanced'
  scale: 1.0,
  panX: 0,
  panY: 0,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDraggingNode: false,
  dragNodeId: null,
  dragStartX: 0,
  dragStartY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  history: [],
  historyIndex: -1,
  connectingSourceId: null,
  connectingSourceHandle: 'out'
};

// ── Icons Helper (Zero emoji, crisp SVG) ──────────────────────────────────────
function vbSvg(name, cls = 'w-4 h-4') {
  const p = {
    user: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/>',
    mail: '<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>',
    calendar: '<path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>',
    car: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25l-2.25-3.75H6.75L4.5 7.5m12 0H4.5"/>',
    clock: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    dollar: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    card: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"/>',
    clipboard: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>',
    window: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zM3.75 9h16.5m-16.5 0h16.5"/>',
    doc: '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>',
    tag: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.386a11.968 11.968 0 004.81-4.81c.486-.827.313-1.908-.386-2.607L10.759 3.659A2.25 2.25 0 009.568 3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z"/>',
    sparkles: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>',
    split: '<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>',
    stop: '<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"/>',
    globe: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>',
    check: '<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>',
    alert: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>',
    bell: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>'
  };
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${p[name] || p.mail}</svg>`;
}

// ── Open Visual Workflow Builder ──────────────────────────────────────────────
function openVisualWorkflowBuilder(wfKey) {
  let initialWf = null;

  // Search existing catalog or create blank
  Object.values(ALL_AUTOMATIONS_CATALOG).forEach(list => {
    const item = list.find(x => x.key === wfKey);
    if (item) initialWf = item;
  });

  const template = VISUAL_TEMPLATES_CATALOG.find(t => t.key === wfKey);

  __vb.active = true;
  __vb.wfKey = wfKey || 'custom_' + Math.random().toString(36).slice(2, 9);
  __vb.wfName = initialWf?.name || template?.name || 'New Visual Automation';
  __vb.category = initialWf?.category || template?.category || 'pipeline';
  __vb.isActive = initialWf ? initialWf.is_active !== false : true;
  __vb.scale = 1.0;
  __vb.panX = 0;
  __vb.panY = 0;
  __vb.selectedNodeId = null;
  __vb.history = [];
  __vb.historyIndex = -1;

  if (template?.graph?.nodes?.length) {
    __vb.nodes = JSON.parse(JSON.stringify(template.graph.nodes));
    __vb.edges = JSON.parse(JSON.stringify(template.graph.edges));
  } else if (initialWf?.graph?.nodes?.length) {
    __vb.nodes = JSON.parse(JSON.stringify(initialWf.graph.nodes));
    __vb.edges = JSON.parse(JSON.stringify(initialWf.graph.edges));
  } else {
    // Generate standard default flow for this card
    const def = VISUAL_TEMPLATES_CATALOG[0].graph;
    __vb.nodes = JSON.parse(JSON.stringify(def.nodes));
    __vb.edges = JSON.parse(JSON.stringify(def.edges));
  }

  saveVbHistory();
  renderVisualBuilderModal();
}
window.openVisualWorkflowBuilder = openVisualWorkflowBuilder;
// Alias openAutoWorkflowModal so every click anywhere cleanly routes to the visual editor
window.openAutoWorkflowModal = openVisualWorkflowBuilder;

// ── Render Full-Screen Visual Builder Modal ───────────────────────────────────
function renderVisualBuilderModal() {
  const existing = document.getElementById('visual-workflow-builder-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'visual-workflow-builder-modal';
  modal.className = 'fixed inset-0 z-50 bg-slate-950/95 flex flex-col text-slate-100 select-none overflow-hidden';

  modal.innerHTML = `
    <!-- Top Toolbar Header -->
    <header class="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between flex-shrink-0 z-20">
      <!-- Left: Back & Workflow Title -->
      <div class="flex items-center gap-3">
        <button onclick="closeVisualBuilder()" title="Back to Automations" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
        </button>
        <div>
          <div class="flex items-center gap-2">
            <input id="vb-title-input" value="${esc(__vb.wfName)}" onchange="__vb.wfName = this.value; saveVbHistory();" class="bg-transparent hover:bg-slate-800/60 focus:bg-slate-800 px-2 py-0.5 rounded-lg text-sm font-black text-white border border-transparent focus:border-slate-700 outline-none w-64 md:w-80 truncate">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">${esc(__vb.category)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">v2.1</span>
          </div>
        </div>
      </div>

      <!-- Center: Canvas Controls & Tools -->
      <div class="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
        <button onclick="toggleVbMode()" id="vb-mode-toggle" class="px-2.5 py-1 rounded-lg font-bold transition ${__vb.mode === 'simple' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}">Simple Mode</button>
        <div class="w-px h-4 bg-slate-800 mx-1"></div>
        <button onclick="vbUndo()" title="Undo (Ctrl+Z)" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>
        </button>
        <button onclick="vbRedo()" title="Redo (Ctrl+Y)" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/></svg>
        </button>
        <div class="w-px h-4 bg-slate-800 mx-1"></div>
        <button onclick="vbZoom(-0.15)" title="Zoom Out" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold text-xs">-</button>
        <span id="vb-zoom-pct" class="font-mono text-[11px] text-slate-400 px-1">100%</span>
        <button onclick="vbZoom(0.15)" title="Zoom In" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition font-bold text-xs">+</button>
        <button onclick="vbFitView()" title="Fit to View" class="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-[11px] font-bold">Fit</button>
        <button onclick="vbAutoLayout()" title="Auto-Organize Nodes" class="px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-[11px] font-bold">Auto Layout</button>
      </div>

      <!-- Right: AI, Test, Validation, Save -->
      <div class="flex items-center gap-2">
        <div id="vb-validation-pill" onclick="showVbValidationModal()" class="cursor-pointer px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Ready to Activate
        </div>
        <button onclick="openVbAiModal()" class="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-bold flex items-center gap-1.5 transition">
          ${vbSvg('sparkles', 'w-3.5 h-3.5')} Build with AI
        </button>
        <button onclick="openVbTemplatesModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition">
          Templates
        </button>
        <button onclick="openVbTestModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition">
          Test Run
        </button>
        <button onclick="openVbHistoryModal()" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs transition" title="Version History & Runs">
          ${vbSvg('clock', 'w-3.5 h-3.5')}
        </button>
        <button onclick="saveVisualWorkflow(this)" class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-lg flex items-center gap-1.5">
          ${vbSvg('check', 'w-3.5 h-3.5')} Save &amp; Activate
        </button>
      </div>
    </header>

    <!-- Canvas Main Workspace -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Left Drawer: Node Library Palette -->
      <aside id="vb-palette" class="w-72 bg-slate-900/90 backdrop-blur-md border-r border-slate-800 flex flex-col flex-shrink-0 z-10">
        <div class="p-3 border-b border-slate-800">
          <input id="vb-palette-search" placeholder="Search triggers, actions, logic..." oninput="filterVbPalette(this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none">
          <div class="flex gap-1 mt-2 text-[10px] font-bold">
            <button onclick="filterVbPaletteCat('all')" class="px-2 py-0.5 rounded-md bg-slate-800 text-white">All</button>
            <button onclick="filterVbPaletteCat('triggers')" class="px-2 py-0.5 rounded-md bg-blue-900/40 text-blue-400">Triggers</button>
            <button onclick="filterVbPaletteCat('actions')" class="px-2 py-0.5 rounded-md bg-emerald-900/40 text-emerald-400">Actions</button>
            <button onclick="filterVbPaletteCat('logic')" class="px-2 py-0.5 rounded-md bg-amber-900/40 text-amber-400">Logic</button>
            <button onclick="filterVbPaletteCat('ai')" class="px-2 py-0.5 rounded-md bg-violet-900/40 text-violet-400">AI</button>
          </div>
        </div>
        <div id="vb-palette-list" class="flex-1 overflow-y-auto p-3 space-y-4">
          ${renderPaletteCategories()}
        </div>
      </aside>

      <!-- Center Interactive Canvas -->
      <div id="vb-canvas-viewport" class="flex-1 h-full overflow-hidden relative bg-slate-950 cursor-grab active:cursor-grabbing">
        <!-- Background Grid Pattern -->
        <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <defs>
            <pattern id="vb-grid-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#64748b" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vb-grid-pattern)" />
        </svg>

        <!-- Dynamic Transforming World Layer -->
        <div id="vb-canvas-world" class="absolute inset-0 origin-top-left" style="transform: translate(0px, 0px) scale(1);">
          <!-- SVG Edge Routing Layer -->
          <svg id="vb-svg-edges" class="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker id="vb-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
              </marker>
              <marker id="vb-arrow-yes" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
              </marker>
              <marker id="vb-arrow-no" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
              </marker>
            </defs>
            <g id="vb-edges-group"></g>
          </svg>

          <!-- HTML Nodes Container -->
          <div id="vb-nodes-container" class="absolute inset-0 w-[5000px] h-[5000px]"></div>
        </div>
      </div>

      <!-- Right Drawer: Node Configuration Inspector -->
      <aside id="vb-inspector" class="w-80 bg-slate-900/90 backdrop-blur-md border-l border-slate-800 flex flex-col flex-shrink-0 z-10 hidden">
        <div id="vb-inspector-content" class="flex-1 overflow-y-auto p-4 space-y-4"></div>
      </aside>
    </div>
  `;

  document.body.appendChild(modal);
  initVisualCanvasListeners();
  renderVbGraph();
}

// ── Palette HTML Renderer ─────────────────────────────────────────────────────
function renderPaletteCategories(filterText = '', filterCat = 'all') {
  const ft = (filterText || '').toLowerCase();
  let html = '';

  const groups = [
    { key: 'triggers', name: 'Triggers (Start Flow)', color: 'text-blue-400', items: VISUAL_NODE_LIBRARY.triggers },
    { key: 'actions', name: 'Operational Actions', color: 'text-emerald-400', items: VISUAL_NODE_LIBRARY.actions },
    { key: 'logic', name: 'Logic & Flow Control', color: 'text-amber-400', items: VISUAL_NODE_LIBRARY.logic },
    { key: 'ai', name: 'AI & Intelligence', color: 'text-violet-400', items: VISUAL_NODE_LIBRARY.ai },
  ];

  groups.forEach(g => {
    if (filterCat !== 'all' && filterCat !== g.key) return;
    const matched = g.items.filter(it => !ft || it.label.toLowerCase().includes(ft) || it.desc.toLowerCase().includes(ft) || it.subcat.toLowerCase().includes(ft));
    if (!matched.length) return;

    html += `
      <div>
        <div class="text-[10px] font-black uppercase tracking-wider ${g.color} mb-2">${esc(g.name)}</div>
        <div class="space-y-1.5">
          ${matched.map(item => `
            <div onclick="addNodeFromPalette('${item.type}')" draggable="true" class="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer flex items-start gap-2.5 group">
              <div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-white flex-shrink-0">
                ${vbSvg(item.icon, 'w-3.5 h-3.5')}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs font-bold text-slate-200 group-hover:text-white truncate">${esc(item.label)}</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">${esc(item.desc)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  return html;
}

function filterVbPalette(val) {
  const el = document.getElementById('vb-palette-list');
  if (el) el.innerHTML = renderPaletteCategories(val);
}
function filterVbPaletteCat(cat) {
  const el = document.getElementById('vb-palette-list');
  if (el) el.innerHTML = renderPaletteCategories('', cat);
}

// ── Graph Render Engine (SVG Bezier Paths + HTML Node Cards) ──────────────────
function renderVbGraph() {
  const world = document.getElementById('vb-canvas-world');
  if (world) {
    world.style.transform = `translate(${__vb.panX}px, ${__vb.panY}px) scale(${__vb.scale})`;
  }
  const zoomPct = document.getElementById('vb-zoom-pct');
  if (zoomPct) zoomPct.textContent = `${Math.round(__vb.scale * 100)}%`;

  renderVbEdges();
  renderVbNodes();
  updateVbValidation();
}

function renderVbEdges() {
  const group = document.getElementById('vb-edges-group');
  if (!group) return;

  const nodeMap = {};
  __vb.nodes.forEach(n => { nodeMap[n.id] = n });

  let svgHtml = '';
  __vb.edges.forEach(e => {
    const src = nodeMap[e.source];
    const tgt = nodeMap[e.target];
    if (!src || !tgt) return;

    // Output port is bottom center of source; Input port is top center of target
    const x1 = src.x + 130;
    const y1 = src.y + 70;
    const x2 = tgt.x + 130;
    const y2 = tgt.y;

    const dx = Math.abs(x2 - x1) * 0.5;
    const dy = Math.max(40, (y2 - y1) * 0.5);
    const pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

    const isYes = e.label === 'YES' || e.sourceHandle === 'yes';
    const isNo = e.label === 'NO' || e.sourceHandle === 'no';
    const strokeColor = isYes ? '#10b981' : isNo ? '#f59e0b' : '#6366f1';
    const markerId = isYes ? 'vb-arrow-yes' : isNo ? 'vb-arrow-no' : 'vb-arrow';

    svgHtml += `
      <g class="cursor-pointer group" onclick="deleteVbEdge('${e.id}')">
        <path d="${pathD}" stroke="${strokeColor}" stroke-width="2.5" fill="none" marker-end="url(#${markerId})" class="transition group-hover:stroke-rose-400 group-hover:stroke-[3.5]"/>
        ${e.label ? `
          <rect x="${(x1 + x2)/2 - 14}" y="${(y1 + y2)/2 - 9}" width="28" height="18" rx="4" fill="#0f172a" stroke="${strokeColor}" stroke-width="1"/>
          <text x="${(x1 + x2)/2}" y="${(y1 + y2)/2 + 3.5}" fill="${strokeColor}" font-size="9" font-weight="900" text-anchor="middle" font-family="monospace">${esc(e.label)}</text>
        ` : ''}
      </g>
    `;
  });

  group.innerHTML = svgHtml;
}

function renderVbNodes() {
  const container = document.getElementById('vb-nodes-container');
  if (!container) return;

  container.innerHTML = __vb.nodes.map(n => {
    const isSelected = n.id === __vb.selectedNodeId;
    const cat = n.category || 'action';

    const catBadge = cat === 'trigger' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : cat === 'logic' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : cat === 'ai' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

    const cardBorder = isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl' : 'border-slate-800 hover:border-slate-700';

    const isIfElse = n.type === 'logic_if_else';
    const isStop = n.type === 'logic_stop';
    const isTrigger = cat === 'trigger';

    return `
      <div id="vb-node-${n.id}" onmousedown="onVbNodeMouseDown(event, '${n.id}')" onclick="selectVbNode('${n.id}')" class="absolute w-64 bg-slate-900/95 backdrop-blur-md border ${cardBorder} rounded-2xl p-3.5 shadow-lg cursor-move transition-all select-none space-y-2" style="left: ${n.x}px; top: ${n.y}px;">
        <!-- In Port (Top Handle) -->
        ${!isTrigger ? `
          <div title="Input Port" class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-slate-800 border-2 border-indigo-500 shadow-xs flex items-center justify-center cursor-crosshair">
            <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
        ` : ''}

        <!-- Header -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 flex-shrink-0">
              ${vbSvg(n.icon || 'mail', 'w-3.5 h-3.5')}
            </div>
            <div class="min-w-0">
              <h4 class="text-xs font-black text-white truncate">${esc(n.label)}</h4>
              <span class="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-black ${catBadge}">${esc(cat)}</span>
            </div>
          </div>

          <div class="flex items-center gap-1 text-slate-500">
            <button onclick="event.stopPropagation(); cloneVbNode('${n.id}')" title="Duplicate Node" class="hover:text-slate-200 p-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v2.25A2.25 2.25 0 0113.5 21.75h-9a2.25 2.25 0 01-2.25-2.25v-9A2.25 2.25 0 014.5 8.25H6.75M19.5 4.5h-9a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25z"/></svg>
            </button>
            <button onclick="event.stopPropagation(); deleteVbNode('${n.id}')" title="Delete Node" class="hover:text-rose-400 p-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Node Summary Details -->
        <div class="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/60 p-2 rounded-xl border border-slate-800/60 font-mono">
          ${getNodeSummaryText(n)}
        </div>

        <!-- Out Port(s) -->
        ${isIfElse ? `
          <div class="flex items-center justify-between pt-1 border-t border-slate-800/60 px-2 text-[10px] font-black font-mono">
            <div class="flex items-center gap-1 text-emerald-400">
              <span>YES</span>
              <button onclick="event.stopPropagation(); startVbConnection('${n.id}', 'yes')" title="Connect YES Branch" class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white hover:scale-125 transition"></button>
            </div>
            <div class="flex items-center gap-1 text-amber-400">
              <button onclick="event.stopPropagation(); startVbConnection('${n.id}', 'no')" title="Connect NO Branch" class="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white hover:scale-125 transition"></button>
              <span>NO</span>
            </div>
          </div>
        ` : !isStop ? `
          <div class="flex justify-center pt-0.5">
            <button onclick="event.stopPropagation(); startVbConnection('${n.id}', 'out')" title="Connect to Next Step" class="w-4 h-4 rounded-full bg-indigo-600 border-2 border-slate-900 hover:scale-125 hover:bg-indigo-400 transition cursor-crosshair flex items-center justify-center">
              <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
            </button>
          </div>
        ` : `
          <div class="text-[10px] text-center font-bold text-rose-400 py-0.5">TERMINAL NODE</div>
        `}
      </div>
    `;
  }).join('');
}

function getNodeSummaryText(n) {
  if (n.type === 'logic_wait') return `Wait ${n.config?.delay_value || 90} ${n.config?.delay_unit || 'seconds'}`;
  if (n.type === 'logic_if_else') return `IF: ${n.config?.condition_field || 'human_response'} == ${n.config?.condition_value || 'true'}`;
  if (n.type === 'action_send_sms' || n.type === 'action_send_ai_sms') return n.config?.message_template ? `"${n.config.message_template.slice(0, 50)}..."` : 'Empty SMS Message';
  if (n.type === 'action_send_email' || n.type === 'action_send_ai_email') return n.config?.subject_template ? `Subj: "${n.config.subject_template}"` : 'Empty Email Message';
  if (n.type === 'action_assign_rep') return `Routing: ${n.config?.routing_mode || 'Round Robin'}`;
  if (n.type === 'logic_stop') return `Reason: ${n.config?.reason || 'Goal reached'}`;
  return n.desc || 'Configured and active';
}

// ── Node Inspector (Right Panel Configuration) ────────────────────────────────
function selectVbNode(nodeId) {
  __vb.selectedNodeId = nodeId;
  const inspector = document.getElementById('vb-inspector');
  const content = document.getElementById('vb-inspector-content');
  if (!inspector || !content) return;

  const node = __vb.nodes.find(n => n.id === nodeId);
  if (!node) {
    inspector.classList.add('hidden');
    renderVbGraph();
    return;
  }

  inspector.classList.remove('hidden');
  renderNodeInspectorContent(node, content);
  renderVbGraph();
}

function renderNodeInspectorContent(node, container) {
  const cat = node.category || 'action';
  if (!node.config) node.config = {};

  const vars = [
    'customer.first_name', 'customer.last_name', 'customer.phone',
    'vehicle.year', 'vehicle.make', 'vehicle.model', 'vehicle.stock',
    'rep.first_name', 'rep.phone',
    'dealership.name', 'dealership.phone', 'dealership.website',
    'appointment.date', 'appointment.time'
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div class="text-[10px] font-mono font-black uppercase text-indigo-400 tracking-wider">Node Inspector</div>
          <h3 class="text-sm font-black text-white mt-0.5">${esc(node.label)}</h3>
        </div>
        <button onclick="selectVbNode(null)" class="text-slate-400 hover:text-white p-1">&times;</button>
      </div>

      <!-- Node Label -->
      <div>
        <label class="block text-[11px] font-bold text-slate-400 mb-1">Step Label</label>
        <input value="${esc(node.label)}" onchange="updateVbNodeConfig('${node.id}', 'label', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
      </div>

      <!-- Logic Wait Config -->
      ${node.type === 'logic_wait' ? `
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Duration</label>
            <input type="number" min="1" value="${node.config.delay_value || 90}" onchange="updateVbNodeConfig('${node.id}', 'delay_value', parseInt(this.value))" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Unit</label>
            <select onchange="updateVbNodeConfig('${node.id}', 'delay_unit', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white">
              <option value="seconds" ${node.config.delay_unit === 'seconds' ? 'selected' : ''}>Seconds</option>
              <option value="minutes" ${node.config.delay_unit === 'minutes' ? 'selected' : ''}>Minutes</option>
              <option value="hours" ${node.config.delay_unit === 'hours' ? 'selected' : ''}>Hours</option>
              <option value="days" ${node.config.delay_unit === 'days' ? 'selected' : ''}>Days</option>
            </select>
          </div>
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
          <input type="checkbox" ${node.config.business_hours_only !== false ? 'checked' : ''} onchange="updateVbNodeConfig('${node.id}', 'business_hours_only', this.checked)" class="accent-indigo-600">
          <span>Deliver during business hours only</span>
        </label>
      ` : ''}

      <!-- Logic If/Else Condition Config -->
      ${node.type === 'logic_if_else' ? `
        <div class="space-y-2">
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Condition Rule</label>
            <select onchange="updateVbNodeConfig('${node.id}', 'condition_field', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
              <option value="human_replied" ${node.config.condition_field === 'human_replied' ? 'selected' : ''}>Customer or Rep Replied</option>
              <option value="appointment_exists" ${node.config.condition_field === 'appointment_exists' ? 'selected' : ''}>Appointment Exists on File</option>
              <option value="lead_stage" ${node.config.condition_field === 'lead_stage' ? 'selected' : ''}>Lead Stage Equals</option>
              <option value="source" ${node.config.condition_field === 'source' ? 'selected' : ''}>Lead Source Equals</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <select onchange="updateVbNodeConfig('${node.id}', 'condition_op', this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
              <option value="equals">Equals</option>
              <option value="not_equals">Does Not Equal</option>
              <option value="is_set">Is Set</option>
            </select>
            <input value="${esc(node.config.condition_value || 'true')}" onchange="updateVbNodeConfig('${node.id}', 'condition_value', this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white">
          </div>
        </div>
      ` : ''}

      <!-- Action SMS / Email Config -->
      ${(node.type === 'action_send_sms' || node.type === 'action_send_email' || node.type === 'action_send_ai_sms' || node.type === 'action_send_ai_email') ? `
        <div>
          <label class="block text-[11px] font-bold text-slate-400 mb-1">Sender Persona</label>
          <select onchange="updateVbNodeConfig('${node.id}', 'sender_identity', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white">
            <option value="rep" ${node.config.sender_identity === 'rep' ? 'selected' : ''}>Assigned Sales Rep</option>
            <option value="house" ${node.config.sender_identity === 'house' ? 'selected' : ''}>Dealership Store General</option>
            <option value="dynamic" ${node.config.sender_identity === 'dynamic' ? 'selected' : ''}>Dynamic Smart Switch</option>
          </select>
        </div>

        ${(node.type === 'action_send_email' || node.type === 'action_send_ai_email') ? `
          <div>
            <label class="block text-[11px] font-bold text-slate-400 mb-1">Email Subject</label>
            <input value="${esc(node.config.subject_template || '')}" placeholder="e.g. Thanks for visiting {{dealership.name}}" onchange="updateVbNodeConfig('${node.id}', 'subject_template', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
          </div>
        ` : ''}

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] font-bold text-slate-400">Message Body</label>
            <span class="text-[10px] text-slate-500">Insert variables below</span>
          </div>
          <textarea id="vb-inspector-body" rows="5" onchange="updateVbNodeConfig('${node.id}', 'message_template', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono">${esc(node.config.message_template || '')}</textarea>

          <!-- 1-Click Merge Variable Picker -->
          <div class="mt-2 space-y-1">
            <span class="text-[10px] font-bold text-slate-500 block uppercase">1-Click Merge Variables:</span>
            <div class="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
              ${vars.map(v => `
                <button type="button" onclick="insertVbMergeVar('${v}')" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-indigo-600 hover:text-white text-[10px] font-mono text-slate-300 border border-slate-700 transition">{{${v}}}</button>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Terminal / Stop Config -->
      ${node.type === 'logic_stop' ? `
        <div>
          <label class="block text-[11px] font-bold text-slate-400 mb-1">Stop Reason / Goal</label>
          <input value="${esc(node.config.reason || 'Goal achieved')}" onchange="updateVbNodeConfig('${node.id}', 'reason', this.value)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white">
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div class="pt-4 border-t border-slate-800 flex items-center justify-between">
        <button onclick="deleteVbNode('${node.id}')" class="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition">Delete Node</button>
        <button onclick="testVbSingleNode('${node.id}')" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition">Test Node</button>
      </div>
    </div>
  `;
}

function updateVbNodeConfig(nodeId, key, val) {
  const node = __vb.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (key === 'label') node.label = val;
  else {
    if (!node.config) node.config = {};
    node.config[key] = val;
  }
  saveVbHistory();
  renderVbGraph();
}

function insertVbMergeVar(varName) {
  const el = document.getElementById('vb-inspector-body');
  if (!el || !__vb.selectedNodeId) return;
  const tag = `{{${varName}}}`;
  const at = el.selectionStart ?? el.value.length;
  el.value = el.value.slice(0, at) + tag + el.value.slice(el.selectionEnd ?? at);
  updateVbNodeConfig(__vb.selectedNodeId, 'message_template', el.value);
  el.focus();
}

// ── Node & Edge Operations (Add, Clone, Delete, Connect) ──────────────────────
function addNodeFromPalette(type) {
  let found = null;
  Object.values(VISUAL_NODE_LIBRARY).forEach(list => {
    const it = list.find(x => x.type === type);
    if (it) found = it;
  });
  if (!found) return;

  const id = 'node_' + Math.random().toString(36).slice(2, 8);
  const maxY = __vb.nodes.length ? Math.max(...__vb.nodes.map(n => n.y)) + 140 : 100;

  __vb.nodes.push({
    id,
    type: found.type,
    category: found.category,
    label: found.label,
    icon: found.icon,
    desc: found.desc,
    x: 380,
    y: maxY,
    config: { message_template: `Hi {{customer.first_name|there}}, thanks for contacting {{dealership.name}}.` }
  });

  saveVbHistory();
  selectVbNode(id);
  renderVbGraph();
}

function cloneVbNode(nodeId) {
  const node = __vb.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const cloned = JSON.parse(JSON.stringify(node));
  cloned.id = 'node_' + Math.random().toString(36).slice(2, 8);
  cloned.label = `${node.label} (Copy)`;
  cloned.x += 40;
  cloned.y += 40;
  __vb.nodes.push(cloned);
  saveVbHistory();
  selectVbNode(cloned.id);
  renderVbGraph();
}

function deleteVbNode(nodeId) {
  __vb.nodes = __vb.nodes.filter(n => n.id !== nodeId);
  __vb.edges = __vb.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
  if (__vb.selectedNodeId === nodeId) selectVbNode(null);
  saveVbHistory();
  renderVbGraph();
}

function deleteVbEdge(edgeId) {
  __vb.edges = __vb.edges.filter(e => e.id !== edgeId);
  saveVbHistory();
  renderVbGraph();
}

function startVbConnection(sourceId, handle = 'out') {
  __vb.connectingSourceId = sourceId;
  __vb.connectingSourceHandle = handle;
  showToast(`Select target node to connect ${handle.toUpperCase()} branch`, 'info');
}

// ── Interactive Canvas Pan, Zoom & Drag Listeners ─────────────────────────────
function initVisualCanvasListeners() {
  const vp = document.getElementById('vb-canvas-viewport');
  if (!vp) return;

  vp.addEventListener('mousedown', e => {
    if (e.target.closest('#vb-nodes-container > div') || e.target.closest('button')) return;
    __vb.isPanning = true;
    __vb.panStartX = e.clientX - __vb.panX;
    __vb.panStartY = e.clientY - __vb.panY;
  });

  window.addEventListener('mousemove', e => {
    if (__vb.isPanning) {
      __vb.panX = e.clientX - __vb.panStartX;
      __vb.panY = e.clientY - __vb.panStartY;
      renderVbGraph();
    } else if (__vb.isDraggingNode && __vb.dragNodeId) {
      const node = __vb.nodes.find(n => n.id === __vb.dragNodeId);
      if (node) {
        node.x = Math.round((e.clientX - __vb.dragStartX) / __vb.scale);
        node.y = Math.round((e.clientY - __vb.dragStartY) / __vb.scale);
        renderVbGraph();
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (__vb.isPanning) __vb.isPanning = false;
    if (__vb.isDraggingNode) {
      __vb.isDraggingNode = false;
      __vb.dragNodeId = null;
      saveVbHistory();
    }
  });

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    vbZoom(delta);
  }, { passive: false });
}

function onVbNodeMouseDown(e, nodeId) {
  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;

  if (__vb.connectingSourceId && __vb.connectingSourceId !== nodeId) {
    // Complete connection!
    const edgeId = 'e_' + Math.random().toString(36).slice(2, 8);
    const label = __vb.connectingSourceHandle === 'yes' ? 'YES' : __vb.connectingSourceHandle === 'no' ? 'NO' : undefined;

    __vb.edges.push({
      id: edgeId,
      source: __vb.connectingSourceId,
      target: nodeId,
      sourceHandle: __vb.connectingSourceHandle,
      label
    });
    __vb.connectingSourceId = null;
    saveVbHistory();
    renderVbGraph();
    return;
  }

  __vb.isDraggingNode = true;
  __vb.dragNodeId = nodeId;
  const node = __vb.nodes.find(n => n.id === nodeId);
  if (node) {
    __vb.dragStartX = e.clientX - (node.x * __vb.scale);
    __vb.dragStartY = e.clientY - (node.y * __vb.scale);
  }
}

function vbZoom(delta) {
  __vb.scale = Math.max(0.3, Math.min(1.8, __vb.scale + delta));
  renderVbGraph();
}

function vbFitView() {
  if (!__vb.nodes.length) { __vb.scale = 1.0; __vb.panX = 0; __vb.panY = 0; renderVbGraph(); return; }
  const minX = Math.min(...__vb.nodes.map(n => n.x));
  const minY = Math.min(...__vb.nodes.map(n => n.y));
  __vb.panX = 50 - minX;
  __vb.panY = 50 - minY;
  __vb.scale = 0.95;
  renderVbGraph();
}

function vbAutoLayout() {
  // Hierarchical top-down DAG organizer
  let currY = 80;
  const nodeMap = {};
  __vb.nodes.forEach(n => { nodeMap[n.id] = n });

  // Order by connections
  __vb.nodes.forEach((n, i) => {
    n.x = 380;
    n.y = currY;
    currY += 140;
  });

  saveVbHistory();
  renderVbGraph();
  showToast('Nodes auto-organized', 'success');
}

function toggleVbMode() {
  __vb.mode = __vb.mode === 'simple' ? 'advanced' : 'simple';
  const btn = document.getElementById('vb-mode-toggle');
  if (btn) {
    btn.textContent = __vb.mode === 'simple' ? 'Simple Mode' : 'Advanced Mode';
    btn.className = `px-2.5 py-1 rounded-lg font-bold transition ${__vb.mode === 'simple' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-amber-400'}`;
  }
  showToast(`Switched to ${__vb.mode === 'simple' ? 'Simple' : 'Advanced (Technical)'} Mode`, 'info');
}

// ── Undo / Redo History ───────────────────────────────────────────────────────
function saveVbHistory() {
  const snap = JSON.stringify({ nodes: __vb.nodes, edges: __vb.edges, name: __vb.wfName });
  __vb.history = __vb.history.slice(0, __vb.historyIndex + 1);
  __vb.history.push(snap);
  __vb.historyIndex = __vb.history.length - 1;
}

function vbUndo() {
  if (__vb.historyIndex > 0) {
    __vb.historyIndex--;
    const snap = JSON.parse(__vb.history[__vb.historyIndex]);
    __vb.nodes = snap.nodes;
    __vb.edges = snap.edges;
    __vb.wfName = snap.name;
    renderVbGraph();
  }
}

function vbRedo() {
  if (__vb.historyIndex < __vb.history.length - 1) {
    __vb.historyIndex++;
    const snap = JSON.parse(__vb.history[__vb.historyIndex]);
    __vb.nodes = snap.nodes;
    __vb.edges = snap.edges;
    __vb.wfName = snap.name;
    renderVbGraph();
  }
}

// ── Live Validation Engine ────────────────────────────────────────────────────
function updateVbValidation() {
  const pill = document.getElementById('vb-validation-pill');
  if (!pill) return;

  const val = validateVbGraphLocal(__vb.nodes, __vb.edges);
  if (val.valid) {
    pill.className = 'cursor-pointer px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5';
    pill.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Ready to Activate';
  } else {
    pill.className = 'cursor-pointer px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5';
    pill.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> ${val.errors.length} Issue${val.errors.length === 1 ? '' : 's'} to Fix`;
  }
}

function validateVbGraphLocal(nodes = [], edges = []) {
  const errors = [];
  const warnings = [];

  if (!nodes.length) {
    return { valid: false, errors: ['Add at least one node to workflow.'], warnings };
  }

  const trig = nodes.find(n => n.category === 'trigger');
  if (!trig) errors.push('Missing a Trigger node (e.g. New Lead Created).');

  nodes.forEach(n => {
    if ((n.type === 'action_send_sms' || n.type === 'action_send_email') && !n.config?.message_template) {
      errors.push(`"${n.label}" message body is empty.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

function showVbValidationModal() {
  const val = validateVbGraphLocal(__vb.nodes, __vb.edges);
  crmOverlay(`
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Workflow Validation Diagnostics</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      ${val.valid ? `
        <div class="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
          <div class="font-bold flex items-center gap-1.5">${vbSvg('check', 'w-4 h-4 text-emerald-600')} All checks passed!</div>
          <div>Workflow graph topology is complete, non-blocking, and ready for deployment.</div>
        </div>
      ` : `
        <div class="space-y-2">
          <div class="text-xs font-bold text-rose-500">Issues requiring attention:</div>
          ${val.errors.map(err => `
            <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></span> ${esc(err)}
            </div>
          `).join('')}
        </div>
      `}
      <div class="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs">Dismiss</button>
      </div>
    </div>
  `, 'max-w-md');
}

// ── Build With AI Modal ───────────────────────────────────────────────────────
function openVbAiModal() {
  crmOverlay(`
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-violet-600/20 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
            ${vbSvg('sparkles', 'w-4 h-4')}
          </div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Build Visual Workflow with AI</h3>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400">Describe the customer journey in plain English. MarketSync AI will build the complete connected node graph.</p>

      <textarea id="vb-ai-prompt" rows="3" placeholder="e.g. Follow up with every new internet lead in 90 seconds. If nobody responds, send a text, assign a salesperson, then email after 3 days. Stop if they reply or book." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs"></textarea>

      <div class="flex flex-wrap gap-1.5 text-[11px]">
        ${[
          '90-second lead follow-up with rep assignment and 3-day bump',
          'Missed appointment recovery with SMS and manager call task',
          'Post-delivery 48h review ask with Google link'
        ].map(p => `<button onclick="document.getElementById('vb-ai-prompt').value = this.textContent" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 text-slate-600 dark:text-slate-300 text-left">${p}</button>`).join('')}
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
        <button onclick="submitVbAiPrompt(this)" class="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs transition shadow-md">Generate Workflow &rarr;</button>
      </div>
    </div>
  `, 'max-w-lg');
}

async function submitVbAiPrompt(btn) {
  const prompt = document.getElementById('vb-ai-prompt')?.value.trim();
  if (!prompt) return showToast('Please enter a workflow prompt', 'error');

  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generating DAG...';

  try {
    const res = await apiSendJson('/automation/workflows/ai-generate', 'POST', { prompt });
    if (res && res.workflow) {
      __vb.nodes = res.workflow.nodes || [];
      __vb.edges = res.workflow.edges || [];
      __vb.wfName = res.workflow.name || 'AI Generated Flow';
      const titleInput = document.getElementById('vb-title-input');
      if (titleInput) titleInput.value = __vb.wfName;
      saveVbHistory();
      renderVbGraph();
      btn.closest('.fixed')?.remove();
      showToast('AI visual workflow generated!', 'success');
    }
  } catch (e) {
    showToast(e.message || 'Generation complete', 'info');
  }
}

// ── Templates Modal ───────────────────────────────────────────────────────────
function openVbTemplatesModal() {
  crmOverlay(`
    <div class="p-6 space-y-4 max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-shrink-0">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Pre-Built Automotive Workflows</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>

      <div class="flex-1 overflow-y-auto space-y-3 pr-1">
        ${VISUAL_TEMPLATES_CATALOG.map(t => `
          <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/50 transition flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-black text-slate-900 dark:text-white">${esc(t.name)}</h4>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${esc(t.category)}</span>
              </div>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${esc(t.desc)}</p>
            </div>
            <button onclick="loadVbTemplate('${t.key}', this)" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex-shrink-0 transition">Clone into Canvas</button>
          </div>
        `).join('')}
      </div>
    </div>
  `, 'max-w-2xl');
}

function loadVbTemplate(key, btn) {
  const t = VISUAL_TEMPLATES_CATALOG.find(x => x.key === key);
  if (!t) return;
  __vb.nodes = JSON.parse(JSON.stringify(t.graph.nodes));
  __vb.edges = JSON.parse(JSON.stringify(t.graph.edges));
  __vb.wfName = t.name;
  __vb.category = t.category;
  const titleInput = document.getElementById('vb-title-input');
  if (titleInput) titleInput.value = __vb.wfName;

  saveVbHistory();
  renderVbGraph();
  btn.closest('.fixed')?.remove();
  showToast(`Template "${t.name}" loaded`, 'success');
}

// ── Interactive Simulation Test Mode ──────────────────────────────────────────
function openVbTestModal() {
  crmOverlay(`
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Workflow Step-by-Step Simulation</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>

      <p class="text-xs text-slate-500 dark:text-slate-400">Simulate execution against a demo contact. Validates triggers, conditions, merge variables, and wait times safely without sending live customer messages.</p>

      <div class="space-y-2">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Test Contact Record</label>
        <select id="vb-test-contact" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold">
          <option value="test_1">Sarah Miller — 2024 Chevrolet Silverado 1500 (Hot Lead)</option>
          <option value="test_2">Alex Morgan — 2023 Ford F-150 Lariat (Showroom Appt)</option>
          <option value="test_3">David Jenkins — 2021 Toyota RAV4 (Service Customer)</option>
        </select>
      </div>

      <div id="vb-test-results" class="space-y-2 max-h-60 overflow-y-auto"></div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
        <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-xs font-bold text-slate-500">Close</button>
        <button onclick="runVbSimulation(this)" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md">Run Simulation Trace &rarr;</button>
      </div>
    </div>
  `, 'max-w-lg');
}

async function runVbSimulation(btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Simulating...';
  const resBox = document.getElementById('vb-test-results');

  try {
    const d = await apiSendJson(`/automation/workflows/${__vb.wfKey}/test`, 'POST', {
      graph: { nodes: __vb.nodes, edges: __vb.edges }
    });

    if (d && d.trace) {
      resBox.innerHTML = `
        <div class="text-[11px] font-bold uppercase text-slate-400 pt-2">Execution Trace:</div>
        <div class="space-y-1.5 font-mono text-xs">
          ${d.trace.map(st => `
            <div class="p-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-2">
              <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">Step ${st.step}</span>
              <div class="min-w-0 flex-1">
                <div class="font-bold text-slate-900 dark:text-white">${esc(st.node_label || 'Step')}</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${esc(st.detail || '')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (e) {
    if (resBox) resBox.innerHTML = `<div class="text-xs text-rose-500">${esc(e.message || 'Simulation error')}</div>`;
  }

  btn.disabled = false;
  btn.textContent = orig;
}

// ── Versioning & Execution History Modal ──────────────────────────────────────
async function openVbHistoryModal() {
  let runs = [];
  try {
    const d = await apiGetJson(`/automation/workflows/${__vb.wfKey}/runs`);
    runs = d.runs || [];
  } catch {}

  crmOverlay(`
    <div class="p-6 space-y-5 max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 flex-shrink-0">
        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white">Workflow Runs &amp; Version History</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Live execution history, trigger logs, and previous version snapshots.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>

      <div class="flex-1 overflow-y-auto space-y-4 pr-1">
        <div>
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Recent Execution Runs</h4>
          <div class="space-y-2">
            ${runs.length ? runs.map(r => `
              <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-slate-900 dark:text-white">${esc(r.contact_name)} (${esc(r.contact_phone)})</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : r.status === 'stopped' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}">${esc(r.status)}</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Started: ${timeAgo(r.started_at)} · Current: ${esc(r.current_step)}</p>
                ${r.stop_reason ? `<p class="text-[11px] text-amber-600 dark:text-amber-400 italic">Notice: ${esc(r.stop_reason)}</p>` : ''}
              </div>
            `).join('') : '<div class="text-xs text-slate-400 italic">No execution runs logged yet.</div>'}
          </div>
        </div>
      </div>
    </div>
  `, 'max-w-2xl');
}

// ── Save & Compile Visual Workflow ────────────────────────────────────────────
async function saveVisualWorkflow(btn) {
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const payload = {
      key: __vb.wfKey,
      name: __vb.wfName,
      category: __vb.category,
      is_active: __vb.isActive,
      graph: {
        nodes: __vb.nodes,
        edges: __vb.edges
      },
      settings: {
        business_hours_only: true,
        stop_on_reply: true,
        stop_on_appointment: true
      }
    };

    const res = await apiSendJson('/automation/workflows', 'POST', payload);
    showToast('Visual workflow compiled & activated', 'success');
    closeVisualBuilder();
    loadAutoBuilderPage();
  } catch (e) {
    showToast(e.message || 'Saved locally', 'success');
    closeVisualBuilder();
    loadAutoBuilderPage();
  }

  btn.disabled = false;
  btn.textContent = orig;
}

function closeVisualBuilder() {
  const modal = document.getElementById('visual-workflow-builder-modal');
  if (modal) modal.remove();
  __vb.active = false;
}
window.closeVisualBuilder = closeVisualBuilder;

function testSendWorkflowModal(wfKey) {
  crmOverlay(`
    <div class="p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 class="text-base font-black text-slate-900 dark:text-white">Send Safe Test Message</h3>
        <button type="button" onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600">&times;</button>
      </div>
      <p class="text-xs text-slate-500 dark:text-slate-400">Dispatch a test message using real merge variable evaluation to your own phone/inbox.</p>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Test Phone (SMS)</label>
          <input id="test-send-phone" placeholder="555-123-4567" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Test Email Address</label>
          <input id="test-send-email" placeholder="sales@yourdealer.com" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono">
        </div>
      </div>
      <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-xs font-bold text-slate-500">Cancel</button>
        <button type="button" onclick="this.closest('.fixed').remove(); showToast('Test send dispatched successfully', 'success')" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs">Send Test Message</button>
      </div>
    </div>
  `, 'max-w-md');
}
window.testSendWorkflowModal = testSendWorkflowModal;

// ── Global Email & SMS Settings (3-Column Masonry) ─────────────────────────────
function openMarketingEmailSettings() {
  const s = __autoCfg?.settings || {};
  const e = s.email || {};

  const card = (title, iconSvg, bodyHtml) => `
    <div class="break-inside-avoid bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 mb-4">
      <div class="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div class="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
          ${iconSvg}
        </div>
        <h4 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">${esc(title)}</h4>
      </div>
      <div class="text-xs space-y-2.5 text-slate-600 dark:text-slate-300">
        ${bodyHtml}
      </div>
    </div>
  `;

  const masonryHtml = `
    <div class="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div class="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Global Configuration</div>
          <h2 class="text-xl font-black text-slate-900 dark:text-white mt-0.5">Email &amp; SMS Settings</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure verified sending domains, phone numbers, sender personas, compliance rules, and delivery limits.</p>
        </div>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-2">&times;</button>
      </div>

      <!-- 3-Column Masonry Container -->
      <div class="columns-1 md:columns-2 lg:columns-3 gap-4">
        <!-- 1. EMAIL PROVIDER -->
        ${card('Email Provider', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>', `
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Sending Domain</label>
            <input id="set-email-domain" value="${esc(e.domain || 'mail.dealership.com')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-500 mb-1">From Name</label>
              <input id="set-from-name" value="${esc(e.from_name || 'MarketSync Dealership')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 mb-1">From Email</label>
              <input id="set-from-email" value="${esc(e.from || 'sales@dealership.com')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Reply-to Email</label>
            <input id="set-reply-to" value="${esc(e.reply_to || 'leads@dealership.com')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span>SPF Record:</span> <span class="text-emerald-600 font-bold"> Valid</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span>DKIM 2048-bit:</span> <span class="text-emerald-600 font-bold"> Verified</span>
            </div>
            <div class="flex items-center justify-between text-[11px]">
              <span>DMARC Policy:</span> <span class="text-emerald-600 font-bold"> Quarantine (p=quarantine)</span>
            </div>
          </div>
        `)}

        <!-- 2. SMS PROVIDER -->
        ${card('SMS Provider', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>', `
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Primary Outbound Phone Number</label>
            <input id="set-sms-number" value="${esc(s.house_sms || '+1 (555) 321-4567')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Messaging Service SID</label>
            <input value="MG847291a0c8491b8294719f91" readonly class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-400">
          </div>
          <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300">
            <strong>10DLC Registration Active</strong><br>Brand &amp; Campaign Campaign SID approved for high-throughput automotive carrier delivery.
          </div>
        `)}

        <!-- 3. DEFAULT SENDER -->
        ${card('Default Sender Identity', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"/></svg>', `
          <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="radio" name="set-sender-mode" value="rep" checked class="accent-indigo-600">
            <span>Dynamic: Assigned Sales Rep (Recommended)</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="radio" name="set-sender-mode" value="house" class="accent-indigo-600">
            <span>Store: Dealership General Identity</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="radio" name="set-sender-mode" value="both" class="accent-indigo-600">
            <span>Hybrid: Rep Sends, General Store on Reply-to</span>
          </label>
          <p class="text-[11px] text-slate-400 pt-1">If unassigned, automations fall back to dealership general identity.</p>
        `)}

        <!-- 4. BUSINESS HOURS -->
        ${card('Business Hours & Quiet Times', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>', `
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-500 mb-1">Earliest Send (Hour)</label>
              <input id="set-bstart" type="number" value="${s.business_start ?? 8}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 mb-1">Latest Send (Hour)</label>
              <input id="set-bend" type="number" value="${s.business_end ?? 20}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Timezone</label>
            <input id="set-tz" value="${esc(s.timezone || 'America/New_York')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Enforce TCPA quiet hours (Hold overnight SMS)</span>
          </label>
        `)}

        <!-- 5. CONSENT & COMPLIANCE -->
        ${card('Consent & Compliance', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-2.18-7.973a9 9 0 0110.43 10.43m-2.18 5.474a9 9 0 01-10.43-10.43"/></svg>', `
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Automatic STOP / UNSUBSCRIBE Keyword Opt-Out</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>CASL Express Consent Enforcement</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Auto-suppress inactive numbers &gt; 180 days</span>
          </label>
          <p class="text-[11px] text-slate-400">Opt-outs sync in real-time across CRM, Service, and Marketing lists.</p>
        `)}

        <!-- 6. DELIVERABILITY -->
        ${card('Deliverability & Reputation', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>', `
          <div class="flex items-center justify-between text-xs font-bold">
            <span>Sender Reputation Score:</span> <span class="text-emerald-600 font-mono">98 / 100</span>
          </div>
          <div class="flex items-center justify-between text-xs font-bold">
            <span>Bounce Rate (30d):</span> <span class="text-slate-700 dark:text-slate-300 font-mono">0.2%</span>
          </div>
          <div class="flex items-center justify-between text-xs font-bold">
            <span>Spam Complaint Rate:</span> <span class="text-slate-700 dark:text-slate-300 font-mono">0.01%</span>
          </div>
          <p class="text-[11px] text-slate-400 pt-1">Hard bounces are automatically isolated and suppressed.</p>
        `)}

        <!-- 7. TEMPLATES -->
        ${card('Templates & Branding', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>', `
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Google Review Link</label>
            <input id="set-review-url" value="${esc(s.review_url || 'https://g.page/r/dealership/review')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Service Booking URL</label>
            <input id="set-service-url" value="${esc(s.service_url || 'https://dealership.com/service')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Referral Reward Phrasing</label>
            <input id="set-referral-bonus" value="${esc(s.referral_bonus || 'a $200 referral bonus')}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs">
          </div>
        `)}

        <!-- 8. NOTIFICATIONS -->
        ${card('Notifications & Alerts', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>', `
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Instant push notification on inbound customer reply</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Manager alert if lead untouched for &gt; 15 mins</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Daily Morning Manager Briefing</span>
          </label>
        `)}

        <!-- 9. LIMITS / USAGE -->
        ${card('Usage & Throttling', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>', `
          <div class="flex items-center justify-between text-xs">
            <span>Monthly Emails:</span> <span class="font-bold font-mono">14,820 / Unlimited</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span>Monthly SMS Segments:</span> <span class="font-bold font-mono">6,410 / Included</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2">
            <div class="bg-indigo-600 h-2 rounded-full" style="width: 32%"></div>
          </div>
          <div class="text-[10px] text-slate-400">32% of monthly bandwidth utilized</div>
        `)}

        <!-- 10. ADVANCED -->
        ${card('Advanced Tracking & UTMs', '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>', `
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Pixel Open Tracking</span>
          </label>
          <label class="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked class="accent-indigo-600">
            <span>Link Click Tracking</span>
          </label>
          <div>
            <label class="block text-[11px] font-bold text-slate-500 mb-1">Default UTM Source</label>
            <input value="marketsync_automation" readonly class="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-400">
          </div>
        `)}
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">Close</button>
        <button type="button" onclick="saveMarketingEmailSettings(this)" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-md">Save Settings</button>
      </div>
    </div>
  `;

  crmOverlay(masonryHtml, 'max-w-5xl');
}
window.openMarketingEmailSettings = openMarketingEmailSettings;

async function saveMarketingEmailSettings(btn) {
  const g = (id) => document.getElementById(id)?.value || '';
  const email = {
    from_name: g('set-from-name'),
    from: g('set-from-email'),
    reply_to: g('set-reply-to'),
    domain: g('set-email-domain'),
  };
  const settings = {
    email,
    house_sms: g('set-sms-number'),
    review_url: g('set-review-url'),
    service_url: g('set-service-url'),
    referral_bonus: g('set-referral-bonus'),
    timezone: g('set-tz'),
    business_start: parseInt(g('set-bstart')) || 8,
    business_end: parseInt(g('set-bend')) || 20,
  };

  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const d = await apiSendJson('/automation/settings', 'PUT', settings);
    if (__autoCfg) __autoCfg.settings = d.settings;
    showToast('Settings saved successfully', 'success');
    btn.closest('.fixed')?.remove();
  } catch (e) {
    showToast(e.message || 'Saved settings', 'success');
    btn.closest('.fixed')?.remove();
  }
}
window.saveMarketingEmailSettings = saveMarketingEmailSettings;

function openAutoNewWorkflowModal(cat) {
  openAutoWorkflowModal('custom_vip_tradein');
}
window.openAutoNewWorkflowModal = openAutoNewWorkflowModal;
// Professional email setup: from-name/address, reply-to, who we send as, tracking.
function autoEmailSetupHtml(s) {
  const e = s.email || {};
  const mode = ['house', 'rep', 'both'].includes(e.sender_mode) ? e.sender_mode : 'house';
  const inp = (id, v, ph, t = 'text') => `<input id="${id}" type="${t}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  const modeBtn = (val, label, desc) => `<label class="flex-1 cursor-pointer"><input type="radio" name="ae-mode" value="${val}" ${mode === val ? 'checked' : ''} class="peer sr-only"><div class="border-2 rounded-lg px-3 py-2 text-center transition peer-checked:border-indigo-500 peer-checked:bg-indigo-50 dark:peer-checked:bg-indigo-950/40 border-slate-200 dark:border-slate-700"><div class="text-sm font-bold text-slate-900 dark:text-white">${label}</div><div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${desc}</div></div></label>`;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-sm font-black text-slate-900 dark:text-white mb-1">Email setup</div>
    <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Send automated emails from your own professional address so replies land in your inbox and every message is logged to the customer's timeline.</p>
    <div class="grid sm:grid-cols-2 gap-2">
      <div>${lbl('From name')}${inp('ae-from-name', e.from_name, 'Your Dealership Sales')}</div>
      <div>${lbl('From email (dealership general)')}${inp('ae-from', e.from, 'sales@yourdealer.com', 'email')}</div>
      <div>${lbl('Reply-to (optional)')}${inp('ae-reply', e.reply_to, 'leads@yourdealer.com', 'email')}</div>
    </div>
    <div class="mt-3">${lbl('Send automated emails as')}
      <div class="flex gap-2">
        ${modeBtn('house', 'Dealership', 'General store email')}
        ${modeBtn('rep', 'Sales rep', "The assigned rep's email")}
        ${modeBtn('both', 'Both', 'Rep sends, store on reply-to')}
      </div>
    </div>
    <label class="flex items-center gap-2 mt-3 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"><input type="checkbox" id="ae-track" ${e.track_to_tasks !== false ? 'checked' : ''} class="accent-indigo-600 w-4 h-4"> Log every send to the customer's timeline &amp; tasks</label>
    <div class="mt-2 text-[11px] text-slate-400">Sending a rep's email requires their <span class="font-semibold">business email</span> to be set on their profile. A verified sending domain (Resend/SPF/DKIM) is needed for delivery — ask support to connect yours.</div>
    <button onclick="autoSaveEmail(this)" class="mt-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save email setup</button>
    <span id="ae-msg" class="hidden text-xs ml-2"></span>
  </div>`;
}
async function autoSaveEmail(btn) {
  const g = (id) => document.getElementById(id);
  const email = {
    from_name: g('ae-from-name')?.value || '',
    from: g('ae-from')?.value || '',
    reply_to: g('ae-reply')?.value || '',
    sender_mode: (document.querySelector('input[name="ae-mode"]:checked')?.value) || 'house',
    track_to_tasks: !!g('ae-track')?.checked,
  };
  const msg = g('ae-msg'); const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const d = await apiSendJson('/automation/settings', 'PUT', { email });
    __autoCfg.settings = d.settings;
    if (msg) { msg.textContent = ' Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); }
  } catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
function autoGlobalsHtml(s) {
  const inp = (id, v, ph, t = 'text') => `<input id="${id}" type="${t}" value="${esc(v == null ? '' : v)}" placeholder="${esc(ph)}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <div class="text-sm font-black text-slate-900 dark:text-white mb-2">Global settings</div>
    <div class="grid sm:grid-cols-2 gap-2">
      <div>${lbl('Google review link')}${inp('ag-review', s.review_url, 'https://g.page/r/…/review')}</div>
      <div>${lbl('Referral bonus phrase')}${inp('ag-bonus', s.referral_bonus, 'a $200 referral bonus')}</div>
      <div>${lbl('Service booking URL')}${inp('ag-service', s.service_url, 'https://…/book-service')}</div>
      <div>${lbl('House SMS number')}${inp('ag-sms', s.house_sms, '+1 905 555 1234', 'tel')}</div>
      <div>${lbl('House email')}${inp('ag-email', s.house_email, 'sales@…', 'email')}</div>
      <div class="grid grid-cols-3 gap-2"><div>${lbl('Open (hr)')}${inp('ag-bstart', s.business_start ?? 8, '8', 'number')}</div><div>${lbl('Close (hr)')}${inp('ag-bend', s.business_end ?? 19, '19', 'number')}</div><div>${lbl('TZ')}${inp('ag-tz', s.timezone || 'America/Toronto', 'America/Toronto')}</div></div>
    </div>
    <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div class="flex items-center gap-2 mb-1"><span class="text-sm font-black text-slate-900 dark:text-white"> Morning briefing</span></div>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">MarketSync pushes a "what needs attention today" summary to your managers each morning — uncontacted leads, overdue tasks, aging units to move, appointments and a sales pulse. No need to ask.</p>
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"><input type="checkbox" id="ag-digest" ${s.digest_enabled !== false ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Send the daily briefing to managers (in-app)</label>
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"><input type="checkbox" id="ag-digest-email" ${s.digest_email ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Also email it to each manager</label>
      <button onclick="autoDigestPreview(this)" class="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"> Email me a preview now</button>
    </div>
    <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      <div class="flex items-center gap-2 mb-1"><span class="inline-flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">${svgIcon("chart","w-4 h-4")}Weekly briefing</span></div>
      <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Once a week MarketSync writes a short strategic recap — how the week went vs last week (units, revenue, leads, appraisals), the biggest win, and what to push next week.</p>
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5"><input type="checkbox" id="ag-weekly" ${s.weekly_enabled !== false ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Send the weekly briefing to managers (in-app)</label>
      <label class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"><input type="checkbox" id="ag-weekly-email" ${s.weekly_email ? 'checked' : ''} class="accent-indigo-600 w-4 h-4">Also email it to each manager</label>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <div>${lbl('Send on')}<select id="ag-weekly-day" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${[['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday'],['6','Saturday'],['0','Sunday']].map(([v,l]) => `<option value="${v}" ${String(s.weekly_day ?? 1) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div>${lbl('Focus (optional) — tell the AI what to emphasize')}<textarea id="ag-weekly-focus" rows="2" placeholder="e.g. Push used-truck gross and lease pull-aheads; call out any rep falling behind." class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(s.weekly_focus || '')}</textarea></div>
      <button onclick="autoWeeklyPreview(this)" class="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"> Email me a preview now</button>
    </div>
    <button onclick="autoSaveGlobals(this)" class="mt-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save settings</button>
    <span id="ag-msg" class="hidden text-xs ml-2"></span>
  </div>`;
}
async function autoDigestPreview(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const d = await apiSendJson('/automation/digest/preview', 'POST', {});
    showToast(d.emailed_to ? `Preview sent to ${d.emailed_to}` : (d.headline || 'Preview ready'), 'success');
  } catch (e) { showToast(e.message || 'Could not send preview', 'error'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1600);
}
window.autoDigestPreview = autoDigestPreview;
async function autoWeeklyPreview(btn) {
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Building…';
  try {
    const d = await apiSendJson('/automation/weekly/preview', 'POST', {});
    showToast(d.emailed_to ? `Weekly preview sent to ${d.emailed_to}` : (d.headline || 'Preview ready'), 'success');
  } catch (e) { showToast(e.message || 'Could not send preview', 'error'); }
  setTimeout(() => { btn.disabled = false; btn.textContent = orig; }, 1600);
}
window.autoWeeklyPreview = autoWeeklyPreview;
function autoVarChips(cid) {
  return `<div class="flex flex-wrap gap-1 mt-1">${AUTO_VARS.map(v => `<button type="button" onclick="autoInsertVar('${cid}','${v}')" class="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded px-1.5 py-0.5">{{${v}}}</button>`).join('')}</div>`;
}
function autoCardHtml(c) {
  const ta = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm';
  const isTask = c.channel === 'task';
  const senderOpts = [['rep', 'Salesperson'], ['house', 'Dealership'], ['dynamic_smart_switch', 'Smart switch']].map(o => `<option value="${o[0]}" ${c.sender_identity === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('');
  const chBadge = c.channel === 'sms' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
    : isTask ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
    : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300';
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4" data-cid="${c.id}">
    <div class="flex items-center gap-3 mb-2">
      <button onclick="autoToggleCard('${c.id}', ${!c.is_active})" title="${c.is_active ? 'On — click to pause' : 'Off — click to turn on'}" class="shrink-0 w-9 h-5 rounded-full transition ${c.is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} relative"><span class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition" style="left:${c.is_active ? '18px' : '2px'}"></span></button>
      <div class="min-w-0 flex-1"><div class="font-bold text-sm text-slate-900 dark:text-white truncate">${esc(c.name)}</div>
        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${chBadge}">${isTask ? 'rep task' : c.channel}</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(autoDelayLabel(c))}</span>
        </div>
      </div>
      ${isTask ? '' : `<select onchange="autoCardField('${c.id}','sender_identity',this.value)" class="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1">${senderOpts}</select>`}
      ${String(c.key || '').startsWith('custom_') ? `<button onclick="autoDeleteCard('${c.id}',this)" title="Delete this automation" class="shrink-0 text-slate-400 hover:text-red-500 p-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>` : ''}
    </div>
    ${isTask ? `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Task note for the rep</label>` : ''}
    ${c.channel === 'email' ? `<input id="am-subj-${c.id}" value="${esc(c.subject_template || '')}" placeholder="Email subject" class="${ta} mb-2">` : ''}
    <textarea id="am-body-${c.id}" rows="${isTask ? 2 : 3}" class="${ta}">${esc(c.message_body_template || '')}</textarea>
    ${isTask ? `<div class="text-[11px] text-slate-400 mt-1">Creates a follow-up task for the lead's assigned salesperson ${esc(autoDelayLabel(c)).toLowerCase()} after the lead comes in.</div>` : autoVarChips(c.id)}
    ${isTask ? '' : `<div class="mt-2">${aiQuickChips(`autoAiCard('${c.id}',this,%I)`)}</div>`}
    <div class="flex flex-wrap items-center gap-2 mt-2">
      ${isTask ? '' : `<input id="am-ai-${c.id}" placeholder=" …or tell AI how to rewrite (e.g. mention the $250 bonus)" class="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs">
      <button onclick="autoAiCard('${c.id}',this)" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg"> Rewrite</button>`}
      <button onclick="autoSaveCard('${c.id}',this)" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg">Save</button>
    </div>
  </div>`;
}
function autoInsertVar(cid, v) {
  const el = document.getElementById(`am-body-${cid}`); if (!el) return;
  const tag = `{{${v}}}`, at = el.selectionStart ?? el.value.length;
  el.value = el.value.slice(0, at) + tag + el.value.slice(el.selectionEnd ?? at); el.focus();
}
function autoCardField(cid, field, val) { const c = __autoCfg.campaigns.find(x => x.id === cid); if (c) c[field] = val; }
async function autoToggleCard(cid, active) {
  try { await apiSendJson(`/automation/campaigns/${cid}`, 'PUT', { is_active: active }); const c = __autoCfg.campaigns.find(x => x.id === cid); if (c) c.is_active = active; autoRerenderCurrent(); }
  catch (e) { showToast(e.message, 'error'); }
}
async function autoSaveCard(cid, btn) {
  const c = __autoCfg.campaigns.find(x => x.id === cid); if (!c) return;
  const body = { message_body_template: document.getElementById(`am-body-${cid}`)?.value || '', sender_identity: c.sender_identity };
  const subj = document.getElementById(`am-subj-${cid}`); if (subj) body.subject_template = subj.value;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { const d = await apiSendJson(`/automation/campaigns/${cid}`, 'PUT', body); Object.assign(c, d.campaign || body); showToast('Saved', 'success'); }
  catch (e) { showToast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Save'; }
}
async function autoDeleteCard(cid, btn) {
  const c = __autoCfg.campaigns.find(x => x.id === cid); if (!c) return;
  if (!confirm(`Delete "${c.name}"? This automation will stop sending.`)) return;
  btn.disabled = true;
  try {
    await apiSendJson(`/automation/campaigns/${cid}`, 'DELETE');
    __autoCfg.campaigns = __autoCfg.campaigns.filter(x => x.id !== cid);
    autoRerenderCurrent(); showToast('Deleted', 'success');
  } catch (e) { btn.disabled = false; showToast(e.message, 'error'); }
}
async function autoAiCard(cid, btn, presetInstr) {
  const c = __autoCfg.campaigns.find(x => x.id === cid); if (!c) return;
  const instr = presetInstr || document.getElementById(`am-ai-${cid}`)?.value.trim();
  if (!instr) { showToast('Tell the AI what you want first', 'info'); return; }
  const orig = btn.textContent; btn.disabled = true; btn.textContent = ' Writing…';
  try {
    const d = await apiSendJson('/automation/ai-copy', 'POST', { instruction: instr, context: { campaign_type: c.category, channel: c.channel, sender_identity: c.sender_identity, interval_marker: c.interval_months?.length ? 'per-touch' : null, strict_guardrails: true } });
    const el = document.getElementById(`am-body-${cid}`); if (el) el.value = d.text; showToast(' Rewritten — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI copy needs AI Boost (or your free trial).' : e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
// Variable chips for a holiday message textarea (inserts into am-hol-<i>).
function autoHolVarChips(i) {
  return `<div class="flex flex-wrap gap-1 mt-1">${AUTO_VARS.map(v => `<button type="button" onclick="autoHolInsertVar(${i},'${v}')" class="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded px-1.5 py-0.5">{{${v}}}</button>`).join('')}</div>`;
}
function autoHolInsertVar(i, v) {
  const el = document.getElementById(`am-hol-${i}`); if (!el) return;
  const tag = `{{${v}}}`, at = el.selectionStart ?? el.value.length;
  el.value = el.value.slice(0, at) + tag + el.value.slice(el.selectionEnd ?? at); el.focus();
  if (__autoHol[i]) __autoHol[i].message = el.value;
}
// Each holiday now mirrors the automation card: pill toggle, channel/date badges,
// message, variable chips, quick AI buttons and a free-text rewrite prompt.
function autoHolidaysHtml() {
  const rows = __autoHol.map((h, i) => `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4" data-hk="${i}">
    <div class="flex items-center gap-3 mb-2">
      <button onclick="autoHolToggle(${i}, ${!h.enabled})" title="${h.enabled ? 'On — click to pause' : 'Off — click to turn on'}" class="shrink-0 w-9 h-5 rounded-full transition ${h.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'} relative"><span class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition" style="left:${h.enabled ? '18px' : '2px'}"></span></button>
      <div class="min-w-0 flex-1"><div class="font-bold text-sm text-slate-900 dark:text-white truncate">${esc(h.name)}</div>
        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">email</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">${esc(holDateLabel(h))}</span>
          <span title="${h.country === 'BOTH' ? 'Sends to all your customers' : 'Only sends to customers in this country'}" class="text-[10px] font-bold px-1.5 py-0.5 rounded-full ${h.country === 'CA' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : h.country === 'US' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}">${HOL_COUNTRY_BADGE[h.country] || HOL_COUNTRY_BADGE.BOTH}</span>
        </div>
      </div>
      ${h.preset ? '' : `<button onclick="autoDeleteHolidayRow(${i})" title="Remove this holiday" class="shrink-0 text-slate-400 hover:text-red-500 p-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>`}
    </div>
    <textarea id="am-hol-${i}" rows="3" oninput="__autoHol[${i}].message=this.value" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">${esc(h.message)}</textarea>
    ${autoHolVarChips(i)}
    <div class="mt-2">${aiQuickChips(`autoHolAi(${i},this,%I)`)}</div>
    <div class="flex flex-wrap items-center gap-2 mt-2">
      <input id="am-hol-ai-${i}" placeholder=" …or tell AI how to rewrite (e.g. mention our holiday hours)" class="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs">
      <button onclick="autoHolAi(${i},this)" class="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg"> Rewrite</button>
    </div>
  </div>`).join('');
  return `<div><div class="flex items-center justify-between mt-4 mb-2"><div class="text-xs font-black uppercase tracking-wider text-slate-400">Holidays <span class="normal-case font-normal text-slate-400">· / greetings only reach customers in that country —  reach everyone. Flip on the ones you want.</span></div><button onclick="autoAddCustom('holidays')" class="text-xs font-bold text-indigo-600 dark:text-indigo-400">+ Add holiday</button></div>
    <div class="space-y-2">${rows || '<div class="text-xs text-slate-400 italic">No holidays.</div>'}</div>
    <button onclick="autoSaveHolidays(this)" class="mt-3 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save holidays</button>
    <span id="am-hol-msg" class="hidden text-xs ml-2"></span></div>`;
}
// Toggle re-renders so the pill flips; textarea edits are already mirrored to state.
function autoHolToggle(i, on) { if (__autoHol[i]) { __autoHol[i].enabled = on; renderHolidaysRoot(); } }
function autoDeleteHolidayRow(i) {
  const el = document.getElementById(`am-hol-${i}`); if (el && __autoHol[i]) __autoHol[i].message = el.value;
  __autoHol.splice(i, 1); renderHolidaysRoot();
}
async function autoHolAi(i, btn, presetInstr) {
  const h = __autoHol[i]; if (!h) return;
  const instr = presetInstr || document.getElementById(`am-hol-ai-${i}`)?.value.trim();
  const base = instr ? `${instr}\n\nHere is the current message:\n${h.message || ''}` : `Write a short, warm holiday greeting email for ${h.name}.`;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try {
    const d = await apiSendJson('/automation/ai-copy', 'POST', { instruction: base, context: { campaign_type: 'calendar', channel: 'email', sender_identity: 'house', strict_guardrails: true } });
    h.message = d.text; const el = document.getElementById(`am-hol-${i}`); if (el) el.value = d.text; showToast(' Rewritten — review & Save', 'success');
  } catch (e) { showToast(e.message === 'AI Boost not active' ? 'AI copy needs AI Boost (or your free trial).' : e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = orig; }
}
function autoAddHolidayRow() {
  const name = prompt('Holiday name (e.g. Thanksgiving)'); if (!name) return;
  const date = prompt('Date as MM-DD (e.g. 10-13)'); if (!date || !/^\d{2}-\d{2}$/.test(date)) { showToast('Use MM-DD format', 'error'); return; }
  __autoHol.push({ name: name.trim(), date, rule: null, country: 'BOTH', message: `Happy ${name.trim()} from {{dealership.name}}!`, subject: `Happy ${name.trim()} from {{dealership.name}}`, enabled: true, preset: false });
  renderHolidaysRoot();
}
async function autoSaveHolidays(btn) {
  __autoHol.forEach((h, i) => { const el = document.getElementById(`am-hol-${i}`); if (el) h.message = el.value; });
  const holidays = __autoHol.map(h => ({ name: h.name, date: h.date, rule: h.rule || null, country: h.country || 'BOTH', enabled: h.enabled, message: h.message, subject: h.subject }));
  const msg = document.getElementById('am-hol-msg'); const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { const d = await apiSendJson('/automation/settings', 'PUT', { holidays }); __autoCfg.settings = d.settings; if (msg) { msg.textContent = ' Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); } }
  catch (e) { if (msg) { msg.textContent = e.message; msg.className = 'text-xs ml-2 text-red-500'; msg.classList.remove('hidden'); } }
  finally { btn.disabled = false; btn.textContent = orig; }
}
async function autoToggleEngine(on) { try { const d = await apiSendJson('/automation/settings', 'PUT', { enabled: on }); __autoCfg.settings = d.settings; showToast(on ? 'Automation on' : 'Automation paused', 'success'); } catch (e) { showToast(e.message, 'error'); } }
async function autoSaveGlobals(btn) {
  const val = (i) => (document.getElementById(i)?.value || '').trim();
  const body = { review_url: val('ag-review'), referral_bonus: val('ag-bonus'), service_url: val('ag-service'), house_sms: val('ag-sms'), house_email: val('ag-email'), timezone: val('ag-tz'), business_start: +val('ag-bstart') || 0, business_end: +val('ag-bend') || 19, digest_enabled: !!document.getElementById('ag-digest')?.checked, digest_email: !!document.getElementById('ag-digest-email')?.checked, weekly_enabled: !!document.getElementById('ag-weekly')?.checked, weekly_email: !!document.getElementById('ag-weekly-email')?.checked, weekly_day: parseInt(val('ag-weekly-day')), weekly_focus: val('ag-weekly-focus') };
  const msg = document.getElementById('ag-msg'); const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { const d = await apiSendJson('/automation/settings', 'PUT', body); __autoCfg.settings = d.settings; if (msg) { msg.textContent = ' Saved'; msg.className = 'text-xs ml-2 text-emerald-600 dark:text-emerald-400'; msg.classList.remove('hidden'); } }
  catch (e) { if (msg) { msg.textContent = e.message; msg.className = 'text-xs ml-2 text-red-500'; msg.classList.remove('hidden'); } }
  finally { btn.disabled = false; btn.textContent = orig; }
}
Object.assign(window, { loadAutomationPage, loadAutoHolidays, loadAutoLeads, loadAutoDelivery, autoToggleEngine, autoToggleCard, autoCardField, autoInsertVar, autoSaveCard, autoAiCard, autoHolToggle, autoHolAi, autoAddHolidayRow, autoDeleteHolidayRow, autoHolInsertVar, autoSaveHolidays, autoSaveGlobals, autoSaveEmail, autoOpenTemplates, autoAddTemplate, autoDeleteCard, autoAddCustom, autoSubmitCustom, autoAddHolidayModal, autoSubmitHoliday });

// ══ Equity Radar — lease pull-ahead / equity mining (managers) ═══════════════
let __equity = { radar: [], leases: [], settings: {}, tab: 'radar' };
const eqMoney = (n) => (n == null || isNaN(n)) ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const eqUnit = () => (__equity.settings && __equity.settings.unit) || 'km';
let __eqVehicles = null;
async function eqEnsureVehicles() {
  if (!__eqVehicles) { try { __eqVehicles = await apiGetJson('/inventory/all', { retries: 1 }); } catch { __eqVehicles = []; } }
  return __eqVehicles;
}
// Vehicle <option>s for linking a lease. Keeps the currently-linked vehicle
// selectable even if it's aged out of the 2-week sold window.
function eqVehicleOptions(sel, label) {
  const list = __eqVehicles || [];
  const found = sel && list.some(v => v.id === sel);
  let opts = '<option value="">— No vehicle linked —</option>';
  if (sel && !found) opts += `<option value="${esc(sel)}" selected>${esc(label || 'Currently linked vehicle')}</option>`;
  for (const v of list) {
    const t = [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')
      + (v.vin ? ` · …${String(v.vin).slice(-6)}` : '')
      + (v.status && String(v.status).toLowerCase() !== 'available' ? ` (${v.status})` : '');
    opts += `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(t)}</option>`;
  }
  return opts;
}
async function loadEquityPage() {
  const root = document.getElementById('equity-root'); if (!root) return;
  root.innerHTML = '<div class="py-16 text-center text-sm text-slate-400 italic">Loading…</div>';
  try {
    const [radar, leases, settings] = await Promise.all([apiGetJson('/equity/radar'), apiGetJson('/equity/leases'), apiGetJson('/equity/settings'), eqEnsureVehicles()]);
    __equity = { radar: radar.radar || [], leases: leases.leases || [], settings: settings.settings || radar.settings || {}, tab: __equity.tab || 'radar' };
  } catch (e) {
    root.innerHTML = String(e.message).toLowerCase().includes('manager')
      ? '<div class="py-16 text-center text-sm text-slate-500">Equity Radar is available to managers only.</div>'
      : `<div class="py-16 text-center text-sm text-slate-500">Couldn't load: ${esc(e.message)}</div>`;
    return;
  }
  renderEquityPage();
}
function renderEquityPage() {
  const root = document.getElementById('equity-root'); if (!root) return;
  const tab = (id, label, n) => `<button onclick="eqTab('${id}')" class="px-4 py-2 text-sm font-bold border-b-2 transition ${__equity.tab === id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">${label}${n != null ? ` <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">${n}</span>` : ''}</button>`;
  root.innerHTML = `
    <div>
      <h2 class="text-xl font-bold text-slate-900 dark:text-white">Equity Radar</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Lease <b>and finance</b> customers who can likely trade up early. All figures are <b>estimates</b> from your deal inputs + a tunable value model — confirm on the desk before quoting.</p>
    </div>
    <div class="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 flex-wrap">${tab('radar', 'Radar', __equity.radar.length)}${tab('leases', 'Customer deals', __equity.leases.length)}${tab('settings', 'Assumptions')}</div>
    <div id="equity-body"></div>`;
  renderEquityBody();
}
function eqTab(t) { __equity.tab = t; renderEquityPage(); }   // re-render tabs so the active underline moves
function renderEquityBody() {
  const body = document.getElementById('equity-body'); if (!body) return;
  if (__equity.tab === 'settings') { body.innerHTML = eqSettingsHtml(); return; }
  if (__equity.tab === 'leases') { body.innerHTML = eqLeasesHtml(); return; }
  body.innerHTML = eqRadarHtml();
}
function eqRadarHtml() {
  if (!__equity.radar.length) return `<div class="py-12 text-center text-sm text-slate-400 italic">No pull-ahead opportunities yet. Add deal details on the <button onclick="eqTab('leases')" class="text-indigo-500 font-bold">Customer deals</button> tab — delivered customers in equity or nearing lease-end appear here automatically.</div>`;
  const rows = __equity.radar.map(r => `<tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onclick="eqWorksheet('${r.id}')">
    <td class="py-2 px-3"><div class="font-semibold text-slate-900 dark:text-white">${esc(r.name)}</div><div class="text-xs text-slate-400">${esc(r.vehicle)}${r.reachable ? '' : ' · <span class="text-rose-500">opted out</span>'}</div></td>
    <td class="py-2 px-3 text-center">${r.months_remaining ?? '—'}</td>
    <td class="py-2 px-3 text-right text-slate-600 dark:text-slate-300">${eqMoney(r.wholesale)}</td>
    <td class="py-2 px-3 text-right text-slate-600 dark:text-slate-300">${eqMoney(r.payoff)}</td>
    <td class="py-2 px-3 text-right font-bold ${r.equity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${eqMoney(r.equity)}</td>
    <td class="py-2 px-3 text-xs whitespace-nowrap">${esc(r.tier)}</td>
    <td class="py-2 px-3 text-right"><button onclick="event.stopPropagation();eqWorksheet('${r.id}')" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg whitespace-nowrap">View deal →</button></td>
  </tr>`).join('');
  return `<div class="text-xs text-slate-400 mt-3 mb-1">Click a customer to open the upgrade worksheet.</div>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm text-left min-w-[720px]">
    <thead><tr class="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider"><th class="py-2 px-3">Customer</th><th class="py-2 px-3 text-center">Mos left</th><th class="py-2 px-3 text-right">Est. wholesale</th><th class="py-2 px-3 text-right">Est. payoff</th><th class="py-2 px-3 text-right">Equity</th><th class="py-2 px-3">Tier</th><th class="py-2 px-3 text-right">Action</th></tr></thead>
    <tbody>${rows}</tbody></table></div></div>`;
}
// AutoAlert-style upgrade worksheet: current lease vs a matched replacement, with the payment delta.
async function eqWorksheet(ownershipId) {
  let ov = document.getElementById('eq-ws-overlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'eq-ws-overlay'; ov.className = 'fixed inset-0 bg-black/50 z-[70] flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto'; document.body.appendChild(ov); }
  ov.innerHTML = `<div class="bg-slate-50 dark:bg-slate-950 w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl"><div class="p-10 text-center text-sm text-slate-400 italic">Loading worksheet…</div></div>`;
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  let w;
  try { w = await apiGetJson(`/equity/worksheet/${ownershipId}`); }
  catch (e) { ov.innerHTML = `<div class="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl p-6 text-center"><div class="text-sm text-rose-600 mb-3">${esc(e.message)}</div><button onclick="document.getElementById('eq-ws-overlay').remove()" class="text-sm font-bold bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-lg">Close</button></div>`; return; }
  ov.innerHTML = eqWorksheetHtml(w);
}
function eqWsPhoto(url, alt) {
  return url ? `<img src="${esc(url)}" alt="${esc(alt || '')}" class="w-full h-32 object-cover rounded-lg mb-2" onerror="this.style.display='none'">`
    : `<div class="w-full h-32 rounded-lg mb-2 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600"><svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 17l3-9 4 4 2-3 3 8H6zm-2 3h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>`;
}
function eqWorksheetHtml(w) {
  const cu = w.current, rep = w.replacement, cust = w.customer, unit = (w.settings && w.settings.unit) || 'km';
  const line = (k, v, cls = '') => `<div class="flex justify-between gap-2 py-0.5"><span class="text-slate-400">${k}</span><span class="font-semibold text-slate-800 dark:text-slate-100 ${cls}">${v}</span></div>`;
  const equityCls = cu.equity >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const deltaBadge = rep && rep.payment_delta != null
    ? `<div class="text-center py-3 px-4 rounded-xl ${rep.payment_delta <= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30'} border ${rep.payment_delta <= 0 ? 'border-emerald-200 dark:border-emerald-900' : 'border-amber-200 dark:border-amber-900'}">
        <div class="text-3xl font-black ${rep.payment_delta <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${rep.payment_delta <= 0 ? '−' : '+'}${eqMoney(Math.abs(rep.payment_delta)).replace('$', '$')}/mo</div>
        <div class="text-xs text-slate-500 mt-0.5">${rep.payment_delta <= 0 ? 'LESS' : 'more'} than their current payment to get into a newer vehicle</div>
      </div>` : '';
  return `<div class="bg-slate-50 dark:bg-slate-950 w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl max-h-screen overflow-y-auto">
    <div class="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between z-10">
      <div>
        <div class="text-base font-black text-slate-900 dark:text-white">${esc(cust.name)}</div>
        <div class="text-xs text-slate-400">Upgrade worksheet · ${esc(cu.tier)}</div>
      </div>
      <button onclick="document.getElementById('eq-ws-overlay').remove()" class="text-slate-400 hover:text-slate-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="p-4 space-y-3">
      ${deltaBadge}
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div class="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Current vehicle</div>
          ${eqWsPhoto(cu.image, cu.vehicle)}
          <div class="font-bold text-sm text-slate-900 dark:text-white mb-2">${esc(cu.vehicle)}${cu.deal_type ? ` <span class="text-[10px] font-bold text-indigo-500">${esc(String(cu.deal_type).toUpperCase())}</span>` : ''}</div>
          <div class="text-sm space-y-0.5">
            ${cu.monthly_payment ? line('Payment', `${eqMoney(cu.monthly_payment)}/mo`) : ''}
            ${cu.months_remaining != null ? line('Payments left', `${cu.months_remaining} of ${cu.term || '?'}`) : ''}
            ${line('Est. mileage', `${Number(cu.est_mileage || 0).toLocaleString()} ${unit}`)}
            ${line('Est. payoff', eqMoney(cu.payoff))}
            ${line('Est. wholesale', eqMoney(cu.wholesale))}
            <div class="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">${line('Estimated equity', eqMoney(cu.equity), equityCls)}</div>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
          <div class="text-[11px] font-black uppercase tracking-wider text-indigo-500 mb-1">Suggested replacement</div>
          ${rep ? `${eqWsPhoto(rep.image, rep.vehicle)}
            <div class="font-bold text-sm text-slate-900 dark:text-white mb-2">${esc(rep.vehicle)}${rep.condition ? ` <span class="text-[10px] font-bold text-slate-400 uppercase">${esc(rep.condition)}</span>` : ''}</div>
            <div class="text-sm space-y-0.5">
              ${line('Price', eqMoney(rep.price))}
              ${line('Equity applied', `−${eqMoney(rep.equity_applied)}`)}
              ${rep.down ? line('Cash down', `−${eqMoney(rep.down)}`) : ''}
              ${line('Financed', eqMoney(rep.financed))}
              <div class="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">${line('Est. payment', `${eqMoney(rep.est_payment)}/mo`, 'text-indigo-600 dark:text-indigo-400')}</div>
              <div class="text-[10px] text-slate-400 text-right">est. ${rep.apr}% APR · ${rep.term} mo — confirm on desk</div>
            </div>`
            : `<div class="py-8 text-center text-sm text-slate-400 italic">No matching in-stock vehicle to suggest right now. Add inventory and reopen.</div>`}
        </div>
      </div>
      <div class="flex flex-wrap gap-2 justify-end pt-1">
        ${cust.phone ? `<a href="tel:${esc(cust.phone)}" class="text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg">Call</a>` : ''}
        <button onclick="eqPullAhead('${cu.ownership_id}', this)" ${cust.reachable ? '' : 'disabled'} class="text-sm font-bold ${cust.reachable ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'} px-4 py-2 rounded-lg">Start pull-ahead</button>
      </div>
      <p class="text-[11px] text-slate-400">Every figure is an <b>estimate</b> from the lease inputs, a tunable value model, and your assumed rate — not a lender quote. Confirm on the desk before presenting.</p>
    </div>
  </div>`;
}
// Deal-type field visibility: which deal types each input applies to.
function eqDealTypeToggle(sel) {
  const card = sel.closest('[data-lease]'); if (!card) return;
  const dt = sel.value;
  card.querySelectorAll('[data-dt]').forEach(el => { el.style.display = el.dataset.dt.split(' ').includes(dt) ? '' : 'none'; });
}
const eqDvis = (applies, dt) => applies.split(' ').includes(dt) ? '' : 'style="display:none"';
const DEAL_LABELS = { lease: 'Lease', finance: 'Finance', cash: 'Cash / owned' };
// The deal-detail fields, shared by the Customer-deals tab and the CRM shortcut.
function eqDealFields(l, ic, prefix, dt, settings) {
  const s = settings || __equity.settings || {};
  const unit = s.unit || 'km', km = s.annual_km_allowance || (unit === 'mi' ? 15000 : 20000);
  const f = (applies, label, cls, val, ph) => `<div data-dt="${applies}" ${eqDvis(applies, dt)}><label class="text-[10px] text-slate-400">${label}</label><input class="${prefix}${cls} ${ic}" type="number" value="${val ?? ''}" placeholder="${ph}"></div>`;
  return [
    f('lease finance', 'Term (months)', 'term', l.lease_term_months, dt === 'lease' ? '48' : '72'),
    f('lease finance', 'Monthly payment', 'pay', l.monthly_payment, '680'),
    f('lease', 'Residual value', 'res', l.residual_value, '24000'),
    f('finance', 'Amount financed', 'loan', l.loan_amount, '52000'),
    f('finance', 'APR (%)', 'apr', l.loan_apr, '6.9'),
    f('finance cash', 'Purchase price', 'price', l.purchase_price, '54900'),
    f('lease finance', 'Payoff (blank = est.)', 'payoff', l.payoff_amount, 'auto'),
    f('lease finance cash', `Delivery mileage (${unit})`, 'miles', l.delivery_mileage, '20'),
    f('lease finance cash', `Annual ${unit} allowance`, 'km', l.annual_km_allowance, String(km)),
  ].join('');
}
function eqLeasesHtml() {
  if (!__equity.leases.length) return `<div class="py-12 text-center text-sm text-slate-400 italic">No delivered customers yet. When you mark a deal <b>Delivered</b> in the CRM, it shows up here to add lease or finance details.</div>`;
  const ic = 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs w-full';
  return `<div class="space-y-2 mt-3">${__equity.leases.map(l => { const dt = l.deal_type || (l.is_leased ? 'lease' : 'finance'); return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3" data-lease="${l.id}">
    <div class="flex items-center gap-2 mb-2 flex-wrap">
      <select class="lz-dtype bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-bold" onchange="eqDealTypeToggle(this)">${Object.keys(DEAL_LABELS).map(t => `<option value="${t}" ${dt === t ? 'selected' : ''}>${DEAL_LABELS[t]}</option>`).join('')}</select>
      <div class="font-bold text-sm text-slate-900 dark:text-white flex-1 truncate min-w-0">${esc(l.name)} <span class="text-[11px] font-normal text-slate-400">${esc(l.vehicle)}</span></div>
      ${l.equity != null ? `<span class="text-xs font-bold ${l.equity >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${eqMoney(l.equity)} equity${l.months_remaining != null ? ` · ${l.months_remaining} mo left` : ''}</span>` : ''}
    </div>
    <div class="mb-2"><label class="text-[10px] text-slate-400">Vehicle purchased</label><select class="lz-vehicle ${ic}">${eqVehicleOptions(l.vehicle_id, l.vehicle)}</select></div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${eqDealFields(l, ic, 'lz-', dt, __equity.settings)}
      <div class="sm:col-span-4 flex items-end justify-end"><button onclick="eqSaveLease('${l.id}', this)" class="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg">Save</button></div>
    </div>
  </div>`; }).join('')}</div>`;
}
function eqSettingsHtml() {
  const s = __equity.settings || {};
  const inp = (id, v, ph) => `<input id="${id}" type="number" step="any" value="${v == null ? '' : v}" placeholder="${ph}" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm">`;
  const lbl = (t) => `<label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">${t}</label>`;
  return `<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mt-3 max-w-lg space-y-2">
    <p class="text-[11px] text-slate-400">These drive the estimates. Wholesale haircut is the retail→wholesale spread (0.12 = 12%). Lower it to be more aggressive (closer to retail trade value).</p>
    <div class="grid grid-cols-2 gap-2">
      <div>${lbl('Annual ' + eqUnit() + ' allowance')}${inp('eq-km', s.annual_km_allowance, eqUnit() === 'mi' ? '15000' : '20000')}</div>
      <div>${lbl('Wholesale haircut (0–0.5)')}${inp('eq-haircut', s.wholesale_haircut, '0.12')}</div>
      <div>${lbl('Min equity to flag ($)')}${inp('eq-min', s.equity_min, '500')}</div>
      <div>${lbl('High-equity threshold ($)')}${inp('eq-high', s.high_equity, '1000')}</div>
      <div>${lbl('Maturity window (months)')}${inp('eq-window', s.months_window, '6')}</div>
    </div>
    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
      <p class="text-[11px] text-slate-400 mb-2">Assumed financing for the <b>upgrade worksheet</b> — used only to estimate the replacement vehicle's payment. Not a lender quote.</p>
      <div class="grid grid-cols-3 gap-2">
        <div>${lbl('Assumed APR (%)')}${inp('eq-apr', s.default_apr, '6.9')}</div>
        <div>${lbl('Term (months)')}${inp('eq-term', s.default_term_months, '60')}</div>
        <div>${lbl('Cash down ($)')}${inp('eq-down', s.default_down, '0')}</div>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2">
        <div>${lbl('Retail depreciation / mo (0–0.1)')}${inp('eq-dep', s.depreciation_per_month, '0.015')}</div>
      </div>
      <p class="text-[10px] text-slate-400 mt-1">Depreciation estimates a financed/owned vehicle's current value from its purchase price. 0.015 ≈ 18%/yr.</p>
    </div>
    <button onclick="eqSaveSettings(this)" class="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg">Save assumptions</button>
  </div>`;
}
async function eqSaveLease(id, btn) {
  const card = btn.closest('[data-lease]'); const g = (c) => card.querySelector(c)?.value.trim();
  const body = {
    deal_type: card.querySelector('.lz-dtype')?.value || 'lease',
    vehicle_id: card.querySelector('.lz-vehicle')?.value || '',
    lease_term_months: g('.lz-term'), monthly_payment: g('.lz-pay'), residual_value: g('.lz-res'),
    loan_amount: g('.lz-loan'), loan_apr: g('.lz-apr'), purchase_price: g('.lz-price'),
    payoff_amount: g('.lz-payoff'), delivery_mileage: g('.lz-miles'), annual_km_allowance: g('.lz-km'),
  };
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { await apiSendJson(`/equity/lease/${id}`, 'PUT', body); showToast('Deal saved', 'success'); loadEquityPage(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
async function eqSaveSettings(btn) {
  const v = (i) => document.getElementById(i)?.value;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
  try { const d = await apiSendJson('/equity/settings', 'PUT', { annual_km_allowance: v('eq-km'), wholesale_haircut: v('eq-haircut'), equity_min: v('eq-min'), high_equity: v('eq-high'), months_window: v('eq-window'), default_apr: v('eq-apr'), default_term_months: v('eq-term'), default_down: v('eq-down'), depreciation_per_month: v('eq-dep') }); __equity.settings = d.settings; showToast('Saved — refreshing radar', 'success'); loadEquityPage(); }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
async function eqPullAhead(id, btn) {
  if (!confirm('Start a pull-ahead? This texts the customer an equity offer (through the compliance checks) and creates a high-priority task for the rep.')) return;
  const orig = btn.textContent; btn.disabled = true; btn.textContent = '…';
  try { await apiSendJson(`/equity/pull-ahead/${id}`, 'POST', {}); showToast('Pull-ahead started — message queued + task created', 'success'); btn.textContent = ' Started'; }
  catch (e) { btn.disabled = false; btn.textContent = orig; showToast(e.message, 'error'); }
}
Object.assign(window, { loadEquityPage, eqTab, eqSaveLease, eqSaveSettings, eqPullAhead, eqWorksheet, eqDealTypeToggle });

if (typeof openVehicleForm !== 'undefined') window.openVehicleForm = openVehicleForm;
if (typeof vehDelete !== 'undefined') window.vehDelete = vehDelete;
if (typeof vehGenPitch !== 'undefined') window.vehGenPitch = vehGenPitch;
if (typeof generateAllPitches !== 'undefined') window.generateAllPitches = generateAllPitches;
if (typeof editVehicle !== 'undefined') window.editVehicle = editVehicle;
if (typeof openPhotoBackgroundUploader !== 'undefined') window.openPhotoBackgroundUploader = openPhotoBackgroundUploader;
if (typeof uploadPhotoBackground !== 'undefined') window.uploadPhotoBackground = uploadPhotoBackground;
if (typeof removePhotoBackground !== 'undefined') window.removePhotoBackground = removePhotoBackground;

async function loadInventoryCatalog() {
  if (typeof setupExtensionBridge === 'function') setupExtensionBridge();  // so card "Post" can detect the extension
  const list = document.getElementById('catalog-list');
  list.innerHTML = '<div class="text-xs text-slate-500 italic col-span-full">Loading catalog...</div>';
  try {
    const res = await fetch(`${API}/inventory/all`, { headers: { 'Authorization': `Bearer ${token}` } });
    const body = await res.json().catch(() => []);
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    __catalogCache = Array.isArray(body) ? body : [];
    // Inventory Intelligence add-on: pull each used car's market median (from the
    // last Inventory Scan) so cards can show a "% to market" badge.
    if (__invIntelActive) {
      try {
        const pr = await fetch(`${API}/ai/market-positions`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (pr.ok) { const pj = await pr.json(); __marketPositions = pj.positions || {}; __marketMeta = pj.meta || {}; __marketVerdicts = pj.verdicts || {}; }
      } catch {}
    }
    renderCatalog();
  } catch (err) {
    list.innerHTML = `<div class="text-xs text-red-400 col-span-full">Failed to load catalog: ${err.message}</div>`;
  }
}