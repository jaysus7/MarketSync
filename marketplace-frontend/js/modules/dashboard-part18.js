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
let __autoTab = 'templates';
function autoTab(t) { __autoTab = t; loadAutoBuilderPage(); }
window.autoTab = autoTab;

async function loadAutoBuilderPage() {
  const tabsEl = document.getElementById('auto-builder-tabs');
  if (!tabsEl) return;
  const tab = (id, label) => `<button onclick="autoTab('${id}')" class="px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap ${__autoTab === id ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}">${label}</button>`;
  
  tabsEl.innerHTML = `
    <div class="flex items-center gap-1 overflow-x-auto w-full border-b border-slate-200 dark:border-slate-800">
      ${tab('leads', 'Lead Follow-ups')}
      ${tab('delivery', 'Delivery Follow-ups')}
      ${tab('service', 'Service Follow-ups')}
      ${tab('reviews', 'Review / Referral')}
      ${tab('birthdays', 'Birthdays & Anniversaries')}
      ${tab('holidays', 'Holidays')}
      ${tab('winback', 'Win-back')}
      ${tab('custom', 'Custom')}
      ${tab('settings', 'Automation Settings')}
    </div>
  `;

  const roots = { leads: 'auto-leads-root', delivery: 'auto-delivery-root', holidays: 'auto-holidays-root' };
  Object.entries(roots).forEach(([k, id]) => document.getElementById(id)?.classList.add('hidden'));

  const leadRoot = document.getElementById('auto-leads-root');
  if (leadRoot) {
    leadRoot.classList.remove('hidden');
    if (__autoTab === 'delivery') {
      await loadAutoDelivery();
    } else if (__autoTab === 'holidays') {
      await loadAutoHolidays();
    } else if (__autoTab === 'settings') {
      leadRoot.innerHTML = `
        <div class="space-y-6">
          <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900 shadow-sm">
            <h3 class="text-base font-black text-slate-900 dark:text-white mb-1">Automation Engine Global Settings</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Configure sender identities, quiet hours, throttling, and AI response rules across all automation triggers.</p>
            ${typeof autoEmailSetupHtml === 'function' ? autoEmailSetupHtml(__autoCfg || {}) : ''}
          </div>
        </div>
      `;
    } else if (['leads', 'service', 'reviews', 'birthdays', 'winback', 'custom'].includes(__autoTab)) {
      const activeCategory = __autoTab === 'service' ? 'Service Follow-ups & Reminders'
        : __autoTab === 'reviews' ? 'Review & Referral Generation'
        : __autoTab === 'birthdays' ? 'Birthdays & Anniversaries'
        : __autoTab === 'winback' ? 'Win-Back Lost Leads'
        : __autoTab === 'custom' ? 'Custom Event Workflows'
        : 'Sales Lead Follow-ups';

      leadRoot.innerHTML = `
        <div class="space-y-6">
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-500/20 shadow-md">
            <div class="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">Event-Driven Automation Engine</span>
                <h3 class="text-lg font-black text-white mt-1">${esc(activeCategory)} Builder</h3>
                <p class="text-xs text-slate-300 mt-0.5">Automated sequences trigger dynamically on real customer events in CRM, Sales, or Service.</p>
              </div>
              <button onclick="showToast('New sequence builder opened', 'success')" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition shadow-sm">+ Add New Workflow</button>
            </div>
          </div>

          <!-- Event-Driven Workflows Visual Cards -->
          <div class="space-y-4">
            <!-- Workflow 1: New Lead 90-Second Rapid Response -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white">New Lead 90-Second Rapid Response &amp; SLA Routing</h4>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-400">Status:</span>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked onchange="showToast('Automation sequence updated', 'info')" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <!-- Sequence Visual Step Map -->
              <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-mono space-y-1.5">
                <div class="text-indigo-600 dark:text-indigo-400 font-bold">\u{26A1} TRIGGER: New Lead Created in CRM</div>
                <div class="text-slate-500 pl-4">\u{2514}\u{2500} \u{23F1} Wait 90 seconds</div>
                <div class="text-slate-500 pl-4">\u{2514}\u{2500} \u{2753} IF no human rep response:</div>
                <div class="text-slate-700 dark:text-slate-300 pl-8">\u{251C}\u{2500}\u{2500}  Send SMS: "Hi {CUSTOMER_NAME}! This is {REP_NAME} at {STORE_NAME}..."</div>
                <div class="text-slate-700 dark:text-slate-300 pl-8">\u{251C}\u{2500}\u{2500}  Auto-assign round-robin salesperson</div>
                <div class="text-slate-500 pl-8">\u{2514}\u{2500}\u{2500} \u{23F1} Wait 3 days \u{2192} IF no response \u{2192} \u{2709} Send follow-up email</div>
                <div class="text-emerald-600 dark:text-emerald-400 font-bold pl-4"> STOP CONDITION: Customer books appointment or replies</div>
              </div>
            </div>

            <!-- Workflow 2: Delivery Thank You & Sentiment Check -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white">Vehicle Delivery Thank-You &amp; Google Review Router</h4>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-400">Status:</span>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked onchange="showToast('Automation sequence updated', 'info')" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <!-- Sequence Visual Step Map -->
              <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-mono space-y-1.5">
                <div class="text-indigo-600 dark:text-indigo-400 font-bold">\u{26A1} TRIGGER: Vehicle Delivery Completed</div>
                <div class="text-slate-500 pl-4">\u{2514}\u{2500} \u{23F1} Wait 24 hours</div>
                <div class="text-slate-700 dark:text-slate-300 pl-4">\u{2514}\u{2500}  Send Thank-You SMS from assigned rep</div>
                <div class="text-slate-500 pl-4">\u{2514}\u{2500} \u{23F1} Wait 5 days</div>
                <div class="text-slate-700 dark:text-slate-300 pl-4">└─  Send Review Request SMS with sentiment check</div>
                <div class="text-amber-600 dark:text-amber-400 pl-8">├── IF negative sentiment: Create Urgent GM Manager Task (Do not send review link)</div>
                <div class="text-emerald-600 dark:text-emerald-400 pl-8">└── IF positive sentiment: Redirect to 5-Star Google Review link</div>
              </div>
            </div>

            <!-- Workflow 3: Service Maintenance Recall -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
                  <h4 class="text-sm font-black text-slate-900 dark:text-white">Service RO Closed 6-Month Maintenance Reminder</h4>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-400">Status:</span>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked onchange="showToast('Automation sequence updated', 'info')" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              <!-- Sequence Visual Step Map -->
              <div class="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-mono space-y-1.5">
                <div class="text-indigo-600 dark:text-indigo-400 font-bold">\u{26A1} TRIGGER: Service Repair Order Closed</div>
                <div class="text-slate-500 pl-4">\u{2514}\u{2500} \u{23F1} Wait 6 months OR +5,000 miles</div>
                <div class="text-slate-700 dark:text-slate-300 pl-4">\u{2514}\u{2500} \u{2709} Send Maintenance Reminder Email + SMS with 1-click booking link</div>
                <div class="text-emerald-600 dark:text-emerald-400 font-bold pl-4"> STOP CONDITION: Service appointment booked</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      await loadAutoLeads();
    }
  }
}
window.loadAutoBuilderPage = loadAutoBuilderPage;
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