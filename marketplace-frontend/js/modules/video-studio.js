/**
 * Dealership Customer Video Messaging & Recording Studio
 *
 * Implements:
 *   1. `openCustomerVideoStudio(contactId, options)` — Camera controls, teleprompter scripts, front/back flip, zoom, pause/resume
 *   2. `vidSendVideoTo(channel)` / `vidCopyShareLink()` — Resolves the recipient
 *      (creating an ad-hoc CRM contact from typed name/phone/email if there is
 *      no CRM contact behind this video), uploads if needed, and either sends
 *      via the real /sales-videos/:id/send endpoint or copies a shareable link.
 *   3. `simCustomerWatchVideo(videoId)` — Simulates customer opening video and generates live watch telemetry
 *   4. `renderVideoTelemetryBadge(videoId)` — Renders open status, watch time duration, and view counts
 */

function escV(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.__videoAnalyticsStore = window.__videoAnalyticsStore || {};

window.__videoStudioState = {
  phase: 'setup',   // 'setup' -> 'camera' -> 'review', or 'sent-detail' for an already-sent video
  recording: false,
  paused: false,
  seconds: 0,
  timerInterval: null,
  cameraFacing: 'user',
  zoomLevel: 1.0,
  mediaStream: null,
  currentContact: null,
  activeScriptKey: 'walkaround',
  compositeRAF: null,
};

// Whether the teleprompter starts hidden — persisted, not per-session: once a rep
// hides it (from the setup screen or the in-camera toggle), it stays hidden on
// every future video until they turn it back on. This is what lets portrait mode
// actually work well on a phone: no floating text box to fight for space in a tall
// narrow frame, and no per-video re-decision.
const VID_TP_PREF_KEY = 'ms_video_tp_hidden';
function vidTeleprompterHiddenByDefault() {
  try { return localStorage.getItem(VID_TP_PREF_KEY) === '1'; } catch { return false; }
}
function vidSetTeleprompterPref(hidden) {
  try { localStorage.setItem(VID_TP_PREF_KEY, hidden ? '1' : '0'); } catch {}
}

const VIDEO_TEMPLATES = {
  product_demo: {
    title: 'MarketSync Product Demo',
    text: `Hi {CUSTOMER_NAME}, {REP_NAME} from MarketSync here. I recorded this short walkthrough of {VEHICLE_LABEL} so you can see exactly how the workflow helps your team. Reply with the part you want to implement first and I will tailor your setup.`
  },
  onboarding: {
    title: 'Customer Onboarding Check-In',
    text: `Hi {CUSTOMER_NAME}, welcome to MarketSync. This video walks through your next setup milestone for {VEHICLE_LABEL}. I will stay with you through activation, and your account timeline will keep every decision and next step in one place.`
  },
  feature_update: {
    title: 'New Feature Update',
    text: `Hi {CUSTOMER_NAME}, here is a quick look at the latest MarketSync update for {VEHICLE_LABEL}. I will show what changed, how it saves time, and the exact next step for your team.`
  },
  walkaround: {
    title: 'Personalized Vehicle Walkaround',
    text: `Hi {CUSTOMER_NAME}! This is {REP_NAME} from {STORE_NAME}. I wanted to personally record this walkaround video of the {VEHICLE_LABEL} for you. As you can see, the exterior paint and tires are in excellent condition, and inside we have the premium leather seating and panoramic sunroof you asked about. Let me know what time works best for your test drive today!`
  },
  quote: {
    title: 'Price Quote & Deal Delivery Summary',
    text: `Hi {CUSTOMER_NAME}, {REP_NAME} here from {STORE_NAME}! I just finished structuring your trade appraisal and monthly payment breakdown on the {VEHICLE_LABEL}. I've unlocked our top manager discount for you this week. Take a look at the figures in the link below, and reply right here when you're ready to reserve it!`
  },
  service: {
    title: 'Service Multi-Point Inspection (DVI)',
    text: `Hi {CUSTOMER_NAME}, this is {REP_NAME} from Service at {STORE_NAME}. Our certified technician has your {VEHICLE_LABEL} up on the rack right now. Your front brakes and tires look great, but we noticed the rear cabin filter is due for replacement. I've attached the quick approval button right below this video!`
  },
  social_ad: {
    title: 'Social Ad / Reel',
    text: `This week at {STORE_NAME} — {VEHICLE_LABEL} is ready to go. Clean, priced, and available now. Message us for the details or stop by and drive it today.`
  },
  lot_update: {
    title: 'Lot / Offer Update',
    text: `Quick update from {STORE_NAME}. New units just landed and this {VEHICLE_LABEL} is the one to see. Ask for {REP_NAME} and we will walk you through it.`
  },
  thankyou: {
    title: 'Post-Purchase Thank You & Check-In',
    text: `Hi {CUSTOMER_NAME}! {REP_NAME} here from {STORE_NAME}. I just wanted to reach out and say congratulations on your new {VEHICLE_LABEL}! I hope your first drive home was fantastic. If you ever have questions about any features, I'm always one text away!`
  }
};

/**
 * Open Customer Video Recording Studio Modal
 */
async function openCustomerVideoStudio(contactId, options = {}) {
  let contact = { id: contactId || '', full_name: '', first_name: '', phone: '', email: '', vehicle: '' };
  if (contactId) {
    try {
      const res = await apiGetJson(`/crm/contacts/${contactId}`).catch(() => null);
      if (res?.contact) contact = res.contact;
    } catch {
      /* fallback contact object used */
    }
  }

  const autoDept = vidDeptForRole(options.department || options.dept);
  // Recorded once here for vidEnsureUploadedFor() (called later, disconnected
  // from this options object, to tag the outgoing video) — not a switch a user
  // can write to themselves; vidDeptForRole() above is still the only place that
  // decides the value.
  window.__videoStudioState.activeDepartment = autoDept;
  window.__videoStudioState.activeScriptKey = options.scriptKey || (autoDept === 'Service' ? 'service' : 'walkaround');
  window.__videoStudioState.currentContact = contact;
  window.__videoStudioState.optionsSnapshot = options;

  let modal = document.getElementById('video-studio-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'video-studio-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md overflow-y-auto';
    document.body.appendChild(modal);
  }

  // Viewing an already-sent video's telemetry skips straight past setup/camera —
  // there's nothing left to record or configure.
  if (options.isViewingSent || options.sentVideo || options.videoId) {
    window.__videoStudioState.phase = 'sent-detail';
    modal.innerHTML = renderStudioReviewHtml(contact, options);
    return;
  }

  // The teleprompter script is picked BEFORE the camera opens — not fiddled with
  // live once recording chrome is already up. This is also what a native camera
  // app does: configure, THEN shoot.
  window.__videoStudioState.phase = 'setup';
  modal.innerHTML = renderStudioSetupHtml(contact, options);
}

// The video is a Service video for a SERVICE role and a Sales video for a SALES_REP
// — no manual override for either; there is no UI control left anywhere that can
// flip it, and this is computed fresh on every render rather than cached in mutable
// state, so there's no stored value to flip out-of-band either. MarketSync's own
// staff (marketsyncOwnerMode()) get their own 'MarketSync' department, checked
// first since it isn't a dealership role at all.
//
// A DEALER_ADMIN/OWNER/MANAGER isn't inherently one department the way a rep or
// tech is — they can legitimately record either kind. For them (and only them),
// `explicitDept` is honored: it's an app-level signal (e.g. "this button lives on
// the Service workspace page"), never a user-facing switch inside the Studio
// itself, so it doesn't reopen the loophole this function exists to close.
function vidDeptForRole(explicitDept) {
  if (typeof marketsyncOwnerMode === 'function' && marketsyncOwnerMode()) return 'MarketSync';
  const role = window.profileContext?.role || window.__user?.role;
  if (role === 'SERVICE') return 'Service';
  if (role === 'SALES_REP') return 'Sales';
  const raw = String(explicitDept || '').toLowerCase();
  if (raw === 'service') return 'Service';
  if (raw === 'marketing' || raw === 'marketsync') return 'Marketing';
  return 'Sales';
}
window.vidDeptForRole = vidDeptForRole;

// Configure-then-shoot: pick the script and decide whether the teleprompter shows
// at all BEFORE the camera opens, exactly like choosing a mode on a phone's camera
// app before the shutter is even live. Nothing here is re-decided mid-recording.
function renderStudioSetupHtml(contact, options) {
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const storeName = window.__dealerConfig?.store_name || profileContext?.dealership?.name || 'Your dealership';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || 'the selected vehicle';

  const activeDept = vidDeptForRole(options.department || options.dept);
  const isSaas = activeDept === 'MarketSync';
  const activeKey = window.__videoStudioState.activeScriptKey || (activeDept === 'Service' ? 'service' : 'walkaround');
  const isService = activeDept === 'Service';

  const allowedScripts = options.studioMode
    ? ['social_ad', 'lot_update', 'product_demo', 'thankyou']
    : (isSaas ? ['product_demo', 'onboarding', 'feature_update', 'thankyou'] : Object.keys(VIDEO_TEMPLATES));
  const scriptOptions = allowedScripts.map(key => `
    <button onclick="vidSelectScript('${key}')" id="vid-script-btn-${key}"
      class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${key === activeKey ? (isService ? 'bg-emerald-600 text-white shadow-sm' : 'bg-indigo-600 text-white shadow-sm') : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
      ${escV(VIDEO_TEMPLATES[key].title)}
    </button>
  `).join('');

  const currentTemplateText = VIDEO_TEMPLATES[activeKey]?.text || VIDEO_TEMPLATES.walkaround.text;
  const formattedScript = (options.initialScript || currentTemplateText)
    .replace(/{CUSTOMER_NAME}/g, custName)
    .replace(/{REP_NAME}/g, repName)
    .replace(/{STORE_NAME}/g, storeName)
    .replace(/{VEHICLE_LABEL}/g, vehLabel);

  const tpHidden = vidTeleprompterHiddenByDefault();

  return `
    <div class="relative w-full max-w-xl bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800 overflow-hidden max-h-[95vh] my-4 mx-2 sm:mx-auto flex flex-col">
      <div class="flex items-center justify-between gap-2 p-4 border-b border-slate-800">
        <div>
          <div class="text-xs font-black uppercase tracking-wider ${isService ? 'text-emerald-400' : 'text-indigo-400'}">${isService ? 'Service Inspection Video' : isSaas ? 'MarketSync Product Video' : 'Sales Video'}</div>
          <h3 class="text-sm font-bold text-white mt-0.5">Set up before you record</h3>
        </div>
        <button onclick="vidCloseStudio()" class="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">\u{2715}</button>
      </div>

      <div class="p-4 space-y-4 overflow-y-auto">
        <div>
          <label class="block text-[11px] font-black uppercase text-slate-400 mb-1.5">Script</label>
          <div class="flex flex-wrap gap-1.5">${scriptOptions}</div>
        </div>

        <div>
          <label class="block text-[11px] font-black uppercase text-slate-400 mb-1">Message &amp; teleprompter script</label>
          <textarea id="vid-message-input" rows="4" oninput="vidSyncScriptInput(this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500">${escV(formattedScript)}</textarea>
          <div id="vid-teleprompter-text" class="hidden">${escV(formattedScript)}</div>
          <button onclick="vidGenerateAiScript()" class="mt-2 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition">AI Teleprompter</button>
        </div>

        <label class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
          <span>
            <span class="block text-xs font-bold text-white">Show teleprompter while recording</span>
            <span class="block text-[11px] text-slate-400 mt-0.5">Stays off until you turn it back on here — no floating box to fight with in portrait mode.</span>
          </span>
          <input type="checkbox" id="vid-setup-tp-toggle" ${tpHidden ? '' : 'checked'} onchange="vidSetTeleprompterPref(!this.checked)" class="w-5 h-5 accent-indigo-500 shrink-0">
        </label>
      </div>

      <div class="p-4 border-t border-slate-800">
        <button onclick="vidEnterCameraView()" id="vid-setup-start-btn" class="w-full py-3 rounded-xl text-sm font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition flex items-center justify-center gap-2">
          <span class="w-3 h-3 rounded-full bg-white"></span> Open Camera
        </button>
      </div>
    </div>
  `;
}

// Camera opens full-screen on a phone — no side panel, no chrome fighting the
// viewfinder for space — the same way a native camera app owns the whole screen.
// The send/script panel that used to live beside the camera now only appears
// AFTER recording stops (renderStudioReviewHtml), once there's actually something
// to send.
function renderStudioCameraHtml(contact, options) {
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const storeName = window.__dealerConfig?.store_name || 'Your dealership';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || 'the selected vehicle';

  const activeDept = vidDeptForRole(options.department || options.dept);
  const isSaas = activeDept === 'MarketSync';
  const activeKey = window.__videoStudioState.activeScriptKey || (activeDept === 'Service' ? 'service' : 'walkaround');
  const isService = activeDept === 'Service';

  const currentTemplateText = VIDEO_TEMPLATES[activeKey]?.text || VIDEO_TEMPLATES.walkaround.text;
  const formattedScript = currentTemplateText
    .replace(/{CUSTOMER_NAME}/g, custName)
    .replace(/{REP_NAME}/g, repName)
    .replace(/{STORE_NAME}/g, storeName)
    .replace(/{VEHICLE_LABEL}/g, vehLabel);
  // The setup screen already wrote whatever the rep actually chose/edited into
  // vid-message-input before we got here; that's the real source of truth for the
  // teleprompter text now, not the freshly-recomputed template default.
  const scriptText = window.__videoStudioState.scriptText || formattedScript;

  const tpHiddenClass = vidTeleprompterHiddenByDefault() ? ' hidden' : '';

  return `
    <div class="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-md bg-black text-white sm:rounded-3xl shadow-2xl sm:border sm:border-slate-800 overflow-hidden flex flex-col sm:my-4">
      <!-- Camera Viewfinder — fills the whole screen like a phone's native camera
           app, not boxed beside a side panel. aspect-video is just the initial
           guess before the stream loads; vidSyncViewfinderAspect() overrides it
           with the real track dimensions so a portrait phone camera gets a
           portrait frame instead of being center-cropped into a fixed 16:9 box. -->
      <div id="vid-camera-viewfinder" class="relative flex-1 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
        <video id="vid-camera-preview" autoplay playsinline muted class="w-full h-full object-cover transition-transform duration-200" style="transform: ${window.__videoStudioState.cameraFacing === 'user' ? 'scaleX(-1) ' : ''}scale(1.0);"></video>
        <!-- Compositing canvas — never shown; the visible preview above is the raw
             camera feed. This is what MediaRecorder actually reads from once
             recording starts, so the rep name / phone / logo overlay ends up
             burned into the saved video, not just floating on top of the live
             preview. -->
        <canvas id="vid-composite-canvas" class="hidden"></canvas>

        <!-- Top bar overlay — close, department badge, flip camera, timer -->
        <div class="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3 sm:p-4 bg-gradient-to-b from-black/70 to-transparent">
          <button onclick="vidCloseStudio()" class="p-2 rounded-full text-white bg-black/40 hover:bg-black/60 transition">\u{2715}</button>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping hidden" id="vid-rec-indicator"></span>
            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isService ? 'bg-emerald-500/25 text-emerald-300' : 'bg-indigo-500/25 text-indigo-300'}">
              ${isSaas ? 'MarketSync' : isService ? 'Service' : 'Sales'}
            </span>
            <span id="vid-timer-display" class="px-2 py-1 rounded-full text-xs font-mono font-extrabold bg-black/50 text-sky-300">00:00 / 03:00</span>
          </div>
          <button onclick="vidToggleCamera()" title="Flip Front / Back Camera" class="p-2 rounded-full text-white bg-black/40 hover:bg-black/60 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>
        </div>

        <!-- Teleprompter Floating Overlay — hidden by default per the persisted
             preference (vidTeleprompterHiddenByDefault()), draggable via
             makeWsPanelDraggable(), wired up in initCameraFeed(). -->
        <div class="absolute inset-x-5 top-16 sm:top-20 bg-transparent p-1 max-h-40 overflow-y-auto transition-all z-10${tpHiddenClass}" id="vid-teleprompter-box" style="background:transparent;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none">
          <div id="vid-teleprompter-handle" class="h-4 mb-1 cursor-grab active:cursor-grabbing opacity-40" title="Drag"></div>
          <div id="vid-teleprompter-text" class="text-[15px] sm:text-base font-semibold leading-relaxed text-white text-center" style="text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 10px rgba(0,0,0,.45);background:transparent">${escV(scriptText)}</div>
        </div>

        <!-- Live Recording Status Overlay -->
        <div id="vid-status-badge" class="absolute top-16 sm:top-20 right-4 px-3 py-1 rounded-full text-xs font-black bg-slate-900/90 text-emerald-400 border border-emerald-500/40 hidden flex items-center gap-1.5 z-10">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Recording Live...
        </div>

        <!-- Bottom bar overlay — zoom, teleprompter quick-toggle, then the big
             shutter button flanked by Retake/Pause, the way a phone camera lays
             its own bottom bar out. -->
        <div class="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4 pb-6 sm:pb-6 bg-gradient-to-t from-black/80 to-transparent space-y-2 sm:space-y-3">
          <div class="flex items-center justify-center gap-2">
            <span class="text-[11px] text-slate-300">1.0x</span>
            <input type="range" id="vid-zoom-slider" min="1.0" max="3.0" step="0.1" value="1.0" oninput="vidChangeZoom(this.value)" class="w-1/2 accent-indigo-500 cursor-pointer">
            <span class="text-[11px] text-slate-300" id="vid-zoom-val">1.0x</span>
            <button onclick="vidToggleTeleprompter()" id="vid-tp-toggle-btn" class="ml-2 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/40 hover:bg-black/60 text-sky-300 transition">
              ${tpHiddenClass ? 'Show Teleprompter' : 'Hide Teleprompter'}
            </button>
          </div>
          <div class="flex items-center justify-center gap-6 sm:gap-8">
            <button id="vid-reset-btn" onclick="vidResetRecord()" class="px-3 py-2 rounded-xl text-xs font-bold bg-black/40 hover:bg-black/60 text-white transition">
              Retake
            </button>
            <button id="vid-rec-btn" onclick="vidToggleRecord()" title="Start Recording" class="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition flex items-center justify-center">
              <span class="w-6 h-6 rounded-full bg-white"></span>
            </button>
            <button id="vid-pause-btn" onclick="vidPauseRecord()" disabled class="px-3 py-2 rounded-xl text-xs font-bold bg-black/20 text-slate-500 cursor-not-allowed transition">
              Pause
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Recording stopped — this is where the send panel a phone camera app shows as
// "review your shot" lives, not beside the live viewfinder the whole time.
function renderStudioReviewHtml(contact, options) {
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const activeDept = vidDeptForRole(options.department || options.dept);
  const isViewingSent = !!options.isViewingSent || !!options.sentVideo || !!options.videoId;
  const scriptText = window.__videoStudioState.scriptText || '';
  const previewUrl = window.__videoStudioState.lastRecordedUrl || '';

  return `
    <div class="relative w-full max-w-xl bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800 overflow-hidden max-h-[95vh] my-4 mx-2 sm:mx-auto flex flex-col">
      <div class="flex items-center justify-between gap-2 p-4 border-b border-slate-800">
        <h3 class="text-sm font-black uppercase tracking-wider text-white">${options.studioMode ? 'Recording saved' : (isViewingSent ? 'Sent Video Details' : 'Send video to customer')}</h3>
        <button onclick="vidCloseStudio()" class="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">\u{2715}</button>
      </div>
      ${options.studioMode ? `<div class="p-4 border-b border-slate-800 space-y-2">
        <p class="text-xs text-slate-300">This recording is in your Studio library. Drop it straight onto the design you were working on, or close and add it later from Uploads.</p>
        <button type="button" onclick="vidUseRecordingInDesign()" class="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black">Use in my design</button>
      </div>` : ''}

      <div class="p-4 space-y-4 overflow-y-auto">
        <!-- Sharing/sending needs step-up MFA, same as texting/social — this stays
             visible once hit instead of relying on a toast a rep can miss, and it's
             the same "Complete multi-factor authentication..." wording Settings
             already uses for texting, so it reads as one consistent rule, not a
             video-specific quirk. -->
        <div id="vid-mfa-notice" class="hidden p-3 rounded-xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs space-y-2">
          <p>Complete multi-factor authentication to share or send this video.</p>
          <button onclick="vidGoCompleteMfa()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition">Complete MFA</button>
        </div>
        ${!isViewingSent && previewUrl ? `
        <video src="${escV(previewUrl)}" controls playsinline class="w-full max-h-72 rounded-xl bg-black object-contain"></video>
        ` : ''}
        ${!isViewingSent ? `
        <div>
          <label class="block text-[11px] font-black uppercase text-slate-400 mb-1.5">Recipient</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input id="vid-recipient-name" placeholder="Customer name" value="${escV(contact.full_name || contact.first_name || '')}" class="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 placeholder-slate-500">
            <input id="vid-recipient-phone" type="tel" placeholder="Mobile phone" value="${escV(contact.phone || '')}" class="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 placeholder-slate-500">
            <input id="vid-recipient-email" type="email" placeholder="Email" value="${escV(contact.email || '')}" class="px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 placeholder-slate-500">
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Enter a phone or email to send directly, or just copy the link below and send it yourself.</p>
        </div>

        <div>
          <label class="block text-[11px] font-black uppercase text-slate-400 mb-1">Message &amp; script</label>
          <textarea id="vid-message-input" rows="3" oninput="vidSyncScriptInput(this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500">${escV(scriptText)}</textarea>
        </div>

        <div>
          <label class="block text-[11px] font-black uppercase text-slate-400 mb-1">Shareable link</label>
          <div class="flex items-center gap-2">
            <div id="vid-share-link-box" class="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-slate-400 text-xs font-mono truncate">Tap Copy Link to generate it</div>
            <button id="vid-copy-link-btn" onclick="vidCopyShareLink()" class="shrink-0 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Copy Link</button>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t border-slate-800">
          <button id="vid-send-sms-btn" onclick="vidSendVideoTo('sms')" class="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Send Video via SMS Text
          </button>
          <button id="vid-send-email-btn" onclick="vidSendVideoTo('email')" class="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Send Video via Email
          </button>
          <button onclick="vidRetakeFromReview()" class="w-full py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">Retake</button>
        </div>
        ` : ''}

        ${isViewingSent ? `
        <p class="text-xs text-slate-400">Recipient: <strong>${escV(contact.full_name || contact.first_name)}</strong> (${escV(contact.phone || contact.email)})</p>
        <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-black uppercase text-sky-400">Live Video Analytics</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300">REAL-TIME</span>
          </div>
          <div id="vid-telemetry-container">
            ${options.videoId ? renderVideoTelemetryBadge(options.videoId) : '<div class="text-xs text-slate-400">Analytics will appear after this video is sent.</div>'}
          </div>
          ${options.videoId ? `<button onclick="simCustomerWatchVideo('${options.videoId}', '${contact.id || ''}')" class="w-full py-2 mt-1 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm flex items-center justify-center gap-1.5">
            Play &amp; Watch Customer Video Link
          </button>` : ''}
        </div>
        ` : ''}
      </div>

      <div class="p-4 border-t border-slate-800 flex justify-end">
        <button onclick="vidCloseStudio()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700">Done</button>
      </div>
    </div>
  `;
}

// Setup -> Camera transition: the rep already picked the script and teleprompter
// preference on renderStudioSetupHtml; now actually open the camera, full-screen.
function vidEnterCameraView() {
  window.__videoStudioState.scriptText = document.getElementById('vid-message-input')?.value || window.__videoStudioState.scriptText;
  window.__videoStudioState.phase = 'camera';
  const modal = document.getElementById('video-studio-modal');
  if (!modal) return;
  const contact = window.__videoStudioState.currentContact || {};
  const options = window.__videoStudioState.optionsSnapshot || {};
  modal.innerHTML = renderStudioCameraHtml(contact, options);
  initCameraFeed();
}
window.vidEnterCameraView = vidEnterCameraView;

// Stop -> Review transition, once the recorded blob is actually ready.
function vidEnterReview() {
  vidStopCompositeLoop();
  if (window.__videoStudioState.mediaStream) {
    window.__videoStudioState.mediaStream.getTracks().forEach(t => t.stop());
  }
  window.__videoStudioState.phase = 'review';
  const modal = document.getElementById('video-studio-modal');
  if (!modal) return;
  const contact = window.__videoStudioState.currentContact || {};
  const options = window.__videoStudioState.optionsSnapshot || {};
  modal.innerHTML = renderStudioReviewHtml(contact, options);
  // A recording started from the Design Studio has no customer to send to — its
  // whole purpose is to become an asset you can drop onto an ad. It used to sit
  // in memory until a SHARE action uploaded it to /sales-videos as a customer
  // video, so from the Studio's side it saved nowhere and never appeared in the
  // media library. Put it in the library as soon as it exists.
  if (options.studioMode) vidSaveRecordingToStudioLibrary();
  else vidAutoPrepareShareLink();
}

// Uploads the recording to the marketing asset library — the same endpoint the
// Studio's own "Upload video" button uses, so it lands beside everything else.
async function vidSaveRecordingToStudioLibrary() {
  const state = window.__videoStudioState;
  const blob = state.lastRecordedBlob;
  if (!blob) return null;
  if (state.studioLibraryAsset) return state.studioLibraryAsset;   // already saved
  try {
    const form = new FormData();
    form.append('file', blob, `studio-recording-${Date.now()}.webm`);
    form.append('title', `Studio recording ${new Date().toLocaleString()}`);
    const response = await fetch(`${API}/marketing/assets/video`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save the recording');
    state.studioLibraryAsset = data.asset || data;
    if (typeof window.loadStudioUploadedVideos === 'function') window.loadStudioUploadedVideos();
    if (typeof showToast === 'function') showToast('Recording saved to your Studio library', 'success');
    return state.studioLibraryAsset;
  } catch (error) {
    if (typeof showToast === 'function') showToast(error.message || 'Recording could not be saved', 'error');
    return null;
  }
}
window.vidSaveRecordingToStudioLibrary = vidSaveRecordingToStudioLibrary;

// "Use in my design": save it if that has not happened yet, then drop it straight
// onto the artboard rather than making the user hunt for it in the library.
window.vidUseRecordingInDesign = async function vidUseRecordingInDesign() {
  const asset = await vidSaveRecordingToStudioLibrary();
  const url = asset?.public_url || asset?.url;
  if (!url) return;
  if (typeof vidCloseStudio === 'function') vidCloseStudio();
  if (typeof window.addLibraryVideoToCanvas === 'function') window.addLibraryVideoToCanvas(url, 'Studio recording');
};

// The share link is generated automatically the moment recording stops — it
// should "just be there" when the rep looks at the Review screen, not gated
// behind a tap that then also has to wait on the whole upload. A manual tap of
// Copy Link (below) awaits this exact same request rather than starting a
// second upload, so by the time someone taps it the link is usually already
// sitting there ready — which is also what makes the clipboard write reliable,
// since there is no more long async gap between the tap and the actual copy.
async function vidAutoPrepareShareLink() {
  try {
    const contactId = await vidEnsureContact();
    const video = await vidEnsureUploadedFor(contactId);
    vidUpdateShareLinkBox(video.share_token);
  } catch (e) {
    // MFA_REQUIRED is the one failure that's worth surfacing even before the
    // rep acts on anything — every path to actually sending is blocked by it,
    // and staying silent here just left the link box reading "Tap Copy Link to
    // generate it" forever with nothing to explain why. Any other failure (no
    // recording yet, a transient network error) stays quiet — Copy Link/Send
    // will surface those if the rep acts on them.
    if (e.message === 'MFA_REQUIRED') vidShowMfaNotice();
  }
}

function vidUpdateShareLinkBox(shareToken) {
  const url = vidBuildShareUrl(shareToken);
  const linkBox = document.getElementById('vid-share-link-box');
  if (linkBox) { linkBox.textContent = url; linkBox.classList.remove('text-slate-400'); linkBox.classList.add('text-sky-300'); }
  return url;
}

// Review -> Camera: re-open the camera to shoot again, keeping the same script.
function vidRetakeFromReview() {
  window.__videoStudioState.lastRecordedUrl = null;
  window.__videoStudioState.lastRecordedBlob = null;
  window.__videoStudioState.seconds = 0;
  vidEnterCameraView();
}
window.vidRetakeFromReview = vidRetakeFromReview;

// Rep name, dealership phone, and a small logo badge — burned into the bottom of
// every recorded video (not just floating over the live preview), so a sent
// video is always identifiable even outside the app. Kept small and translucent
// on purpose: it should never compete with the actual walkaround for attention.
function vidOverlayInfo() {
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const phone = profileContext?.dealership?.phone || profileContext?.dealership?.phone_number || '';
  const storeName = window.__dealerConfig?.store_name || profileContext?.dealership?.name || 'Your dealership';
  const initials = storeName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'MS';
  return { repName, phone, storeName, initials };
}

// Draws the live camera frame plus the branding bar onto the (never-shown)
// compositing canvas, one frame at a time, only while actively recording — this
// is the stream MediaRecorder actually reads from.
function vidStartCompositeLoop() {
  const videoEl = document.getElementById('vid-camera-preview');
  const canvas = document.getElementById('vid-composite-canvas');
  if (!videoEl || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = videoEl.videoWidth || 720;
  canvas.height = videoEl.videoHeight || 1280;
  const { repName, phone, initials } = vidOverlayInfo();
  const barH = Math.round(canvas.height * 0.07);
  const badgeSize = Math.round(barH * 0.7);
  const pad = Math.round(barH * 0.15);

  const draw = () => {
    if (!window.__videoStudioState.recording) return;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH);

    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(pad, canvas.height - barH + (barH - badgeSize) / 2, badgeSize, badgeSize);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(badgeSize * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, pad + badgeSize / 2, canvas.height - barH / 2);

    const textX = pad * 2 + badgeSize;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(barH * 0.32)}px sans-serif`;
    ctx.fillText(repName, textX, canvas.height - barH / 2 - barH * 0.14);
    if (phone) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = `${Math.round(barH * 0.26)}px sans-serif`;
      ctx.fillText(phone, textX, canvas.height - barH / 2 + barH * 0.2);
    }

    window.__videoStudioState.compositeRAF = requestAnimationFrame(draw);
  };
  draw();
}

function vidStopCompositeLoop() {
  if (window.__videoStudioState.compositeRAF) cancelAnimationFrame(window.__videoStudioState.compositeRAF);
  window.__videoStudioState.compositeRAF = null;
}

/**
 * Camera Stream Initialization
 */
async function initCameraFeed() {
  const videoEl = document.getElementById('vid-camera-preview');
  if (!videoEl) return;
  try {
    // Do NOT ask the camera for a narrow portrait-shaped resolution (e.g.
    // 720x1280) — most camera pipelines satisfy a request that doesn't match the
    // sensor's native (wide) aspect ratio by digitally zooming/cropping into the
    // center, which is exactly what made the studio feel "way too close" on a
    // real phone. Request a generously wide resolution instead and let the
    // full-screen viewfinder's object-cover crop it for portrait display — that
    // only trims the sides/top-bottom of the real field of view, it never asks
    // the sensor itself to zoom in.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: window.__videoStudioState.cameraFacing,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: true
    });
    window.__videoStudioState.mediaStream = stream;
    videoEl.srcObject = stream;
    // A front camera's live preview is mirrored (like every other camera app —
    // it's what a rep expects to see of themselves), a back camera's is not.
    // The recording itself is unaffected: canvas.drawImage reads the video
    // element's real pixel data, not its CSS transform.
    vidApplyPreviewTransform();
    // Many phones (especially ones with multiple rear lenses) don't actually
    // start their "1x" camera at true 1x — the sensor/lens the browser picks by
    // default is often already zoomed in. Force the hardware zoom down to its
    // real minimum so the studio opens as wide/zoomed-out as the camera can go,
    // the same starting point a native camera app uses. Not all browsers expose
    // this (notably iOS Safari), so it's a no-op there rather than an error.
    const videoTrack = stream.getVideoTracks()[0];
    const zoomCap = videoTrack?.getCapabilities?.().zoom;
    if (zoomCap && typeof zoomCap.min === 'number') {
      videoTrack.applyConstraints({ advanced: [{ zoom: zoomCap.min }] }).catch(() => {});
    }
    // The viewfinder fills the whole screen via flex-1 + object-cover already;
    // this only matters as a fallback for older layouts/paths that still size a
    // boxed container from the stream's real aspect ratio.
    videoEl.addEventListener('loadedmetadata', vidSyncViewfinderAspect);
    // Rotating the device mid-session doesn't change the already-negotiated
    // track's dimensions on most browsers — re-requesting the stream (not just
    // re-reading it) is what actually gets a correctly-shaped feed for the new
    // orientation.
    if (window.screen?.orientation && !window.__videoStudioState.__orientationBound) {
      window.__videoStudioState.__orientationBound = true;
      window.screen.orientation.addEventListener('change', () => setTimeout(vidRestartCameraForOrientation, 250));
    }
  } catch {
    /* camera simulation mode fallback */
  }
  if (typeof window.makeWsPanelDraggable === 'function') {
    window.makeWsPanelDraggable(document.getElementById('vid-teleprompter-handle'), document.getElementById('vid-teleprompter-box'));
  }
}

// Re-requests the camera stream shaped for the device's current orientation.
// Never interrupts an active recording — rotating the phone mid-take must not
// kill the take; the box just stays whatever shape the in-progress track already
// is until recording stops.
function vidRestartCameraForOrientation() {
  if (window.__videoStudioState.recording) return;
  if (window.__videoStudioState.mediaStream) {
    window.__videoStudioState.mediaStream.getTracks().forEach(t => t.stop());
  }
  initCameraFeed();
}

function vidSyncViewfinderAspect() {
  const videoEl = document.getElementById('vid-camera-preview');
  const box = document.getElementById('vid-camera-viewfinder');
  if (!videoEl || !box || !videoEl.videoWidth || !videoEl.videoHeight) return;
  box.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
}
window.vidSyncViewfinderAspect = vidSyncViewfinderAspect;

// Front camera preview mirrors, like every other camera/video-call app — a rep
// looking at their own face expects to see it the way a mirror shows it. Back
// camera never mirrors. Combined with whatever CSS zoom level is currently set,
// since both share the same style.transform.
function vidApplyPreviewTransform() {
  const videoEl = document.getElementById('vid-camera-preview');
  if (!videoEl) return;
  const mirror = window.__videoStudioState.cameraFacing === 'user';
  const zoom = window.__videoStudioState.zoomLevel || 1.0;
  videoEl.style.transform = `${mirror ? 'scaleX(-1) ' : ''}scale(${zoom})`;
}
window.vidApplyPreviewTransform = vidApplyPreviewTransform;

function vidToggleCamera() {
  window.__videoStudioState.cameraFacing = window.__videoStudioState.cameraFacing === 'user' ? 'environment' : 'user';
  if (window.__videoStudioState.mediaStream) {
    window.__videoStudioState.mediaStream.getTracks().forEach(t => t.stop());
  }
  initCameraFeed();
  if (typeof showToast === 'function') showToast(`Switched camera to ${window.__videoStudioState.cameraFacing === 'user' ? 'Front' : 'Back'}`, 'info');
}

function vidChangeZoom(val) {
  const labelEl = document.getElementById('vid-zoom-val');
  window.__videoStudioState.zoomLevel = val;
  vidApplyPreviewTransform();
  if (labelEl) labelEl.textContent = `${Number(val).toFixed(1)}x`;
}

function vidToggleRecord() {
  const btn = document.getElementById('vid-rec-btn');
  const pauseBtn = document.getElementById('vid-pause-btn');
  const indicator = document.getElementById('vid-rec-indicator');
  const statusBadge = document.getElementById('vid-status-badge');

  if (!window.__videoStudioState.recording) {
    // Start Recording
    window.__videoStudioState.recording = true;
    window.__videoStudioState.paused = false;
    window.__videoStudioState.seconds = 0;
    window.__videoStudioState.recordedChunks = [];

    const stream = window.__videoStudioState.mediaStream;
    if (stream && typeof MediaRecorder !== 'undefined') {
      try {
        // Record from the compositing canvas (camera frame + rep name / phone /
        // logo bar), not the raw camera stream directly — that's what actually
        // burns the overlay into the saved video instead of just floating it over
        // the live preview. Falls back to the raw stream if canvas.captureStream
        // isn't available in this browser.
        let recordStream = stream;
        const canvas = document.getElementById('vid-composite-canvas');
        if (canvas && typeof canvas.captureStream === 'function') {
          try {
            // Size the canvas BEFORE capturing its stream — captureStream() on a
            // still-0x0 canvas (the sizing normally happens inside
            // vidStartCompositeLoop, called after this) produced an unreliable
            // stream. vidStartCompositeLoop still sets these again once its draw
            // loop starts; setting them here too is harmless.
            const previewEl = document.getElementById('vid-camera-preview');
            canvas.width = previewEl?.videoWidth || 720;
            canvas.height = previewEl?.videoHeight || 1280;
            const canvasStream = canvas.captureStream(30);
            // Building a fresh MediaStream from explicit track arrays is the
            // documented-reliable way to combine a canvas's video track with the
            // mic's audio track — mutating the canvas-returned stream via
            // addTrack() dropped audio on some mobile Chrome builds.
            recordStream = new MediaStream([...canvasStream.getVideoTracks(), ...stream.getAudioTracks()]);
            vidStartCompositeLoop();
          } catch { recordStream = stream; }
        }

        let options = { mimeType: 'video/webm;codecs=vp9,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/mp4' };
        }
        const recorder = new MediaRecorder(recordStream, options);
        window.__videoStudioState.mediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            window.__videoStudioState.recordedChunks.push(e.data);
          }
        };
        recorder.onstop = () => {
          if (window.__videoStudioState.recordedChunks && window.__videoStudioState.recordedChunks.length > 0) {
            const blob = new Blob(window.__videoStudioState.recordedChunks, { type: 'video/webm' });
            window.__videoStudioState.lastRecordedBlob = blob;
            window.__videoStudioState.lastRecordedUrl = URL.createObjectURL(blob);
          }
          vidEnterReview();
        };
        recorder.start(100);
      } catch (err) {
        console.warn('MediaRecorder recording fallback:', err);
      }
    }

    if (btn) { btn.innerHTML = 'Stop Recording'; btn.className = 'px-5 py-2.5 rounded-xl text-xs font-black bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-2'; }
    if (pauseBtn) { pauseBtn.disabled = false; pauseBtn.className = 'px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white transition'; }
    if (indicator) indicator.classList.remove('hidden');
    if (statusBadge) statusBadge.classList.remove('hidden');

    window.__videoStudioState.timerInterval = setInterval(() => {
      if (!window.__videoStudioState.paused) {
        window.__videoStudioState.seconds++;
        const mins = String(Math.floor(window.__videoStudioState.seconds / 60)).padStart(2, '0');
        const secs = String(window.__videoStudioState.seconds % 60).padStart(2, '0');
        const display = document.getElementById('vid-timer-display');
        if (display) display.textContent = `${mins}:${secs} / 03:00`;
      }
    }, 1000);

    if (typeof showToast === 'function') showToast('Recording started', 'success');
  } else {
    // Stop Recording — transition to the review screen happens in the recorder's
    // onstop handler (set up above), once the actual blob is ready, not on a
    // fixed timeout guess. If MediaRecorder never started (unsupported browser /
    // camera simulation fallback), there's nothing to wait on — go straight there.
    window.__videoStudioState.recording = false;
    clearInterval(window.__videoStudioState.timerInterval);

    const recorder = window.__videoStudioState.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { vidEnterReview(); }
    } else {
      vidEnterReview();
    }

    if (btn) { btn.innerHTML = 'Start Recording'; btn.className = 'px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-2'; }
    if (pauseBtn) { pauseBtn.disabled = true; pauseBtn.className = 'px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 cursor-not-allowed transition'; }
    if (indicator) indicator.classList.add('hidden');
    if (statusBadge) statusBadge.classList.add('hidden');
    if (typeof showToast === 'function') showToast('Video recorded & saved locally! Ready to preview or send.', 'success');
  }
}

function vidPauseRecord() {
  const pauseBtn = document.getElementById('vid-pause-btn');
  window.__videoStudioState.paused = !window.__videoStudioState.paused;
  if (pauseBtn) {
    pauseBtn.textContent = window.__videoStudioState.paused ? 'Resume' : 'Pause';
  }
  if (typeof showToast === 'function') showToast(window.__videoStudioState.paused ? 'Recording paused' : 'Recording resumed', 'info');
}

function vidResetRecord() {
  // A Retake discards and stays on the live camera — it must NOT trigger the
  // recorder's onstop handler, which is what sends a normal Stop Recording to
  // the review screen.
  const recorder = window.__videoStudioState.mediaRecorder;
  if (recorder && recorder.state !== 'inactive') {
    recorder.onstop = null;
    try { recorder.stop(); } catch {}
  }
  window.__videoStudioState.recording = false;
  window.__videoStudioState.paused = false;
  window.__videoStudioState.seconds = 0;
  window.__videoStudioState.recordedChunks = [];
  vidStopCompositeLoop();
  clearInterval(window.__videoStudioState.timerInterval);
  const display = document.getElementById('vid-timer-display');
  if (display) display.textContent = '00:00 / 03:00';
  const indicator = document.getElementById('vid-rec-indicator');
  if (indicator) indicator.classList.add('hidden');
  const statusBadge = document.getElementById('vid-status-badge');
  if (statusBadge) statusBadge.classList.add('hidden');
  if (typeof showToast === 'function') showToast('Retake ready', 'info');
}

function vidToggleTeleprompter() {
  const box = document.getElementById('vid-teleprompter-box');
  const btn = document.getElementById('vid-tp-toggle-btn');
  if (!box) return;
  const isHidden = box.classList.contains('hidden');
  if (isHidden) {
    box.classList.remove('hidden');
    if (btn) btn.innerHTML = 'Hide Teleprompter';
    // A choice made in-camera persists the same as one made on the setup screen —
    // "indefinitely until turned on again", not just for this one video.
    vidSetTeleprompterPref(false);
    if (typeof showToast === 'function') showToast('Teleprompter overlay visible', 'info');
  } else {
    box.classList.add('hidden');
    if (btn) btn.innerHTML = 'Show Teleprompter';
    vidSetTeleprompterPref(true);
    if (typeof showToast === 'function') showToast('Teleprompter hidden — stays off next time too, until you turn it back on', 'info');
  }
}

function vidGenerateAiScript() {
  const contact = window.__videoStudioState.currentContact || {};
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const storeName = window.__dealerConfig?.store_name || 'Your dealership';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || 'the selected vehicle';

  const aiScripts = [
    `Hi ${custName}! ${repName} here with ${storeName}. I wanted to send you a quick personalized walkaround video of the ${vehLabel}. We just completed our multi-point safety inspection and detail on this vehicle, and it looks immaculate! Click below to review your instant payment options or lock in your test drive today!`,
    `Good day ${custName}! This is ${repName} from ${storeName}. I know you've been searching for the perfect ${vehLabel}. I personally pulled this one up to the front of our showroom for you. Watch this quick video to inspect the condition, and let me know if you'd like me to hold the keys for you!`,
    `Hello ${custName}! ${repName} at ${storeName}. I've structured an exclusive executive price quote on your ${vehLabel} with zero hassle. Take a look at the video walkthrough and figures, and text me back directly as soon as you watch it!`
  ];

  const randomAiScript = aiScripts[Math.floor(Math.random() * aiScripts.length)];
  const textEl = document.getElementById('vid-teleprompter-text');
  const inputEl = document.getElementById('vid-message-input');
  if (textEl) textEl.textContent = randomAiScript;
  if (inputEl) inputEl.value = randomAiScript;

  // Make sure teleprompter is visible when AI generates script
  const box = document.getElementById('vid-teleprompter-box');
  if (box && box.classList.contains('hidden')) vidToggleTeleprompter();

  if (typeof showToast === 'function') showToast('AI generated personalized video script!', 'success');
}

function vidEnableCustomScript() {
  const inputEl = document.getElementById('vid-message-input');
  if (inputEl) {
    inputEl.focus();
    inputEl.select();
  }
  // Ensure teleprompter is visible
  const box = document.getElementById('vid-teleprompter-box');
  if (box && box.classList.contains('hidden')) vidToggleTeleprompter();
  if (typeof showToast === 'function') showToast('Type in the text box to update teleprompter live!', 'info');
}

function vidSyncScriptInput(val) {
  const textEl = document.getElementById('vid-teleprompter-text');
  if (textEl) textEl.textContent = val || 'Type your script here...';
}

function vidSelectScript(key) {
  Object.keys(VIDEO_TEMPLATES).forEach(k => {
    const b = document.getElementById(`vid-script-btn-${k}`);
    if (b) {
      if (k === key) b.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm';
      else b.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700';
    }
  });

  const contact = window.__videoStudioState.currentContact || {};
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const storeName = window.__dealerConfig?.store_name || 'Your dealership';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || 'the selected vehicle';

  const tmpl = VIDEO_TEMPLATES[key]?.text || '';
  const formatted = tmpl
    .replace(/{CUSTOMER_NAME}/g, custName)
    .replace(/{REP_NAME}/g, repName)
    .replace(/{STORE_NAME}/g, storeName)
    .replace(/{VEHICLE_LABEL}/g, vehLabel);

  const textEl = document.getElementById('vid-teleprompter-text');
  const inputEl = document.getElementById('vid-message-input');
  if (textEl) textEl.textContent = formatted;
  if (inputEl) inputEl.value = formatted;
}

function vidCloseStudio() {
  if (window.__videoStudioState.mediaStream) {
    window.__videoStudioState.mediaStream.getTracks().forEach(t => t.stop());
  }
  vidStopCompositeLoop();
  clearInterval(window.__videoStudioState.timerInterval);
  if (window.__videoStudioState.lastRecordedUrl) {
    try { URL.revokeObjectURL(window.__videoStudioState.lastRecordedUrl); } catch {}
  }
  window.__videoStudioState.phase = 'setup';
  window.__videoStudioState.mediaStream = null;
  window.__videoStudioState.lastRecordedUrl = null;
  window.__videoStudioState.lastRecordedBlob = null;
  window.__videoStudioState.scriptText = null;
  document.getElementById('video-studio-modal')?.remove();
}

/**
 * Send Video Link & Attach to Customer Timeline
 */
// The only working external link, given this is a plain static-file server with
// no /watch.html/:token rewrite — see the matching fix in watch.html's own token
// parsing, which now reads this same ?t= query param first.
function vidBuildShareUrl(shareToken) {
  return `${window.location.origin}/watch.html?t=${encodeURIComponent(shareToken)}`;
}

// Makes an MFA_REQUIRED failure impossible to miss — a toast alone can flash by
// unnoticed on a phone, and every button involved already resets itself back to
// its normal label right after, so nothing else on screen hints that anything
// went wrong.
function vidShowMfaNotice() {
  document.getElementById('vid-mfa-notice')?.classList.remove('hidden');
}

// Leaves the studio and drops the rep exactly where they'd complete step-up MFA
// — Settings -> My Account, where Security already lives.
async function vidGoCompleteMfa() {
  vidCloseStudio();
  // If a factor is already enrolled, this session just hasn't stepped up to
  // aal2 yet — and there is no in-app step-up prompt once already logged in,
  // only the login screen challenges an existing factor. Settings' enrollment
  // panel has nothing to do in that case (2FA already reads "On"), so sending
  // a rep there would be a dead end that looks like "the MFA piece doesn't
  // work" even though the actual fix is just signing back in.
  try {
    const status = await apiGetJson('/auth/2fa/status');
    if (status?.enabled) {
      if (confirm('Two-factor sign-in is already set up on your account — this browser session just needs to confirm it again. Sign out and back in now?')) {
        if (typeof window.msSignOut === 'function') window.msSignOut(true);
      }
      return;
    }
  } catch { /* fall through to Settings either way */ }
  if (typeof switchPage === 'function') switchPage('profile');
  if (typeof settingsTab === 'function') settingsTab('account');
}
window.vidGoCompleteMfa = vidGoCompleteMfa;

function vidRecipientFields() {
  return {
    name: document.getElementById('vid-recipient-name')?.value.trim() || '',
    phone: document.getElementById('vid-recipient-phone')?.value.trim() || '',
    email: document.getElementById('vid-recipient-email')?.value.trim() || '',
  };
}

// Resolves who this video is actually for. An "independent"/single-product
// Video account has no CRM to pick a contact from — the rep types a name/phone/
// email right here instead. If those fields still match whatever real CRM
// contact this studio was opened for (untouched), that contact is reused rather
// than creating a duplicate; if they were edited (or there was never a real
// contact), an ad-hoc contact is created from what was typed. Memoized by the
// exact field values so clicking Copy Link then Send doesn't create two.
async function vidEnsureContact() {
  const fields = vidRecipientFields();
  const contact = window.__videoStudioState.currentContact || {};
  const isRealContact = !!contact.id;
  const unchanged = isRealContact
    && fields.name === (contact.full_name || contact.first_name || '')
    && fields.phone === (contact.phone || '')
    && fields.email === (contact.email || '');
  if (unchanged) return contact.id;
  if (!fields.name && !fields.phone && !fields.email) return null;

  const cacheKey = `${fields.name}|${fields.phone}|${fields.email}`;
  const cached = window.__videoStudioState.adhocContact;
  if (cached && cached.key === cacheKey) return cached.id;
  // The share link is prepared automatically the moment the Review screen opens
  // AND a rep can also tap Copy Link/Send at any time — both must resolve to the
  // SAME contact-creation call, not one each.
  const inflight = window.__videoStudioState.adhocContactPromise;
  if (inflight && inflight.key === cacheKey) return inflight.promise;

  const promise = (async () => {
    const res = await apiSendJson('/crm/contacts', 'POST', {
      full_name: fields.name || undefined,
      phone: fields.phone || undefined,
      email: fields.email || undefined,
    });
    const id = res?.contact?.id;
    if (id) window.__videoStudioState.adhocContact = { key: cacheKey, id };
    return id || null;
  })();
  window.__videoStudioState.adhocContactPromise = { key: cacheKey, promise };
  try { return await promise; }
  finally { window.__videoStudioState.adhocContactPromise = null; }
}

// Uploads the recorded blob once per distinct recipient (re-uploads only if the
// contact actually changes between actions — there is no endpoint to re-attach a
// contact to an already-uploaded video). The auto-prepare-on-entry call and a
// manual Copy Link/Send tap share the same in-flight request instead of each
// starting their own upload of the same recording.
async function vidEnsureUploadedFor(contactId) {
  const key = contactId || null;
  const cached = window.__videoStudioState.uploadedVideo;
  if (cached && cached.contact_id === key) return cached;
  const inflight = window.__videoStudioState.uploadPromise;
  if (inflight && inflight.contactId === key) return inflight.promise;

  const blob = window.__videoStudioState.lastRecordedBlob;
  if (!blob) throw new Error('No recording to upload yet.');
  const contact = window.__videoStudioState.currentContact || {};
  const dept = window.__videoStudioState.activeDepartment || 'Sales';
  const formData = new FormData();
  formData.append('file', blob, `video-${Date.now()}.webm`);
  if (contactId) formData.append('contact_id', contactId);
  formData.append('title', `${contact.vehicle || 'Vehicle'} ${dept} Video`);
  formData.append('duration_seconds', window.__videoStudioState.seconds || 0);

  const promise = (async () => {
    const res = await apiSendFormData('/sales-videos', 'POST', formData);
    if (!res?.video?.id) throw new Error('Upload failed.');
    const uploaded = { ...res.video, contact_id: key };
    window.__videoStudioState.uploadedVideo = uploaded;
    return uploaded;
  })();
  window.__videoStudioState.uploadPromise = { contactId: key, promise };
  try { return await promise; }
  finally { window.__videoStudioState.uploadPromise = null; }
}

// Copy a share link without requiring a named recipient at all — "just copy the
// link and I'll send it myself" is a valid path, not just SMS/Email.
async function vidCopyShareLink() {
  const btn = document.getElementById('vid-copy-link-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
  try {
    const contactId = await vidEnsureContact();
    const video = await vidEnsureUploadedFor(contactId);
    const url = vidUpdateShareLinkBox(video.share_token);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      if (typeof showToast === 'function') showToast('Video link copied — paste it anywhere', 'success');
    } else if (typeof showToast === 'function') {
      showToast('Link ready — copy it from the box below', 'info');
    }
  } catch (e) {
    if (e.message === 'MFA_REQUIRED') vidShowMfaNotice();
    if (typeof showToast === 'function') showToast(e.message === 'MFA_REQUIRED' ? 'Complete multi-factor authentication to share this video.' : (e.message || 'Could not prepare the link'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Copy Link'; }
  }
}
window.vidCopyShareLink = vidCopyShareLink;

// Real delivery for an already-uploaded video — the one place that actually
// calls the backend's send endpoint (consent-gated, same as every other
// customer-facing sender). Used both by the Review screen and the video
// library's "Resend" button.
async function vidSendExistingVideo(videoId, channel) {
  try {
    const res = await apiSendJson(`/sales-videos/${videoId}/send`, 'POST', { channel });
    // No server-side sender set up (no texting number / email service) → open the
    // rep's own Messages or Mail app with the customer + watch link prefilled, so
    // they can send it straight from their phone.
    if (res && res.code === 'delivery_unconfigured') {
      vidDeviceHandoff(channel, res.to, res.watch_url);
      if (typeof showToast === 'function') showToast(`Opening your ${channel === 'sms' ? 'Messages' : 'email'} app to send it`, 'info');
      return res;
    }
    if (typeof showToast === 'function') showToast(`Sent via ${channel.toUpperCase()}`, 'success');
    return res;
  } catch (e) {
    if (e.message === 'MFA_REQUIRED') vidShowMfaNotice();
    if (typeof showToast === 'function') {
      showToast(e.message === 'MFA_REQUIRED' ? 'Complete multi-factor authentication to send videos.' : (e.message || 'Send failed'), 'error');
    }
    throw e;
  }
}
window.vidSendExistingVideo = vidSendExistingVideo;

// Fall back to the device's native apps when the server can't send. Opens the SMS
// or Mail composer prefilled with the watch link (and the rep's typed note, if any
// is on screen) — the rep just hits send. The sms:/mailto: forms used here work on
// both iOS and Android.
function vidDeviceHandoff(channel, to, url) {
  if (!url) return;
  const note = (document.getElementById('vid-message-input')?.value || '').trim();
  if (channel === 'sms') {
    const body = `${note ? note + ' ' : ''}${url}`;
    window.location.href = `sms:${to || ''}?&body=${encodeURIComponent(body)}`;
  } else {
    const subject = 'A video for you';
    const body = `${note ? note + '\n\n' : ''}Watch your video: ${url}`;
    window.location.href = `mailto:${to || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
window.vidDeviceHandoff = vidDeviceHandoff;

// Review screen's Send buttons: resolve who it's going to (creating an ad-hoc
// contact from the typed name/phone/email if this is an independent Video
// account with no CRM contact behind it), upload if not already, then actually
// send — no more silently succeeding regardless of whether anyone real received
// anything.
async function vidSendVideoTo(channel) {
  const fields = vidRecipientFields();
  if (channel === 'sms' && !fields.phone) { if (typeof showToast === 'function') showToast("Enter the customer's mobile phone number", 'error'); return; }
  if (channel === 'email' && !fields.email) { if (typeof showToast === 'function') showToast("Enter the customer's email address", 'error'); return; }

  const btn = document.getElementById(channel === 'sms' ? 'vid-send-sms-btn' : 'vid-send-email-btn');
  const restoreLabel = channel === 'sms' ? 'Send Video via SMS Text' : 'Send Video via Email';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  let contactId, video;
  try {
    contactId = await vidEnsureContact();
    if (!contactId) throw new Error('Enter at least a name, phone, or email for the customer');
    video = await vidEnsureUploadedFor(contactId);
  } catch (e) {
    if (e.message === 'MFA_REQUIRED') vidShowMfaNotice();
    if (typeof showToast === 'function') showToast(e.message === 'MFA_REQUIRED' ? 'Complete multi-factor authentication to send videos.' : (e.message || 'Could not prepare the video'), 'error');
    if (btn) { btn.disabled = false; btn.textContent = restoreLabel; }
    return;
  }

  try {
    await vidSendExistingVideo(video.id, channel);
    const messageText = document.getElementById('vid-message-input')?.value || '';
    apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', {
      kind: 'video_walkaround', channel,
      subject: `Personalized ${window.__videoStudioState.activeDepartment || 'Sales'} Video Message`,
      body: messageText,
      timestamp: new Date().toISOString(),
    }).catch(() => null);
  } catch { /* vidSendExistingVideo already showed the failure toast */ }
  finally {
    if (btn) { btn.disabled = false; btn.textContent = restoreLabel; }
  }
}
window.vidSendVideoTo = vidSendVideoTo;

/**
 * Public Customer Video Player Viewport Modal & Real-Time Telemetry Tracking
 */
async function openPublicVideoLink(videoId, contactId) {
  let data = window.__videoAnalyticsStore[videoId] || __videoLibraryVideos.find(v => v.id === videoId || v.share_token === videoId) || {
    id: videoId,
    opened_at: new Date().toISOString(),
    watch_time_seconds: 0,
    total_duration_seconds: 120,
    times_watched: 0,
    completion_rate: 0,
    video_url: ''
  };

  // If no live signed playback URL, fetch one on demand
  if (!data.playback_url && !data.local_url) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId);
      if (isUuid) {
        const pb = await apiGetJson(`/sales-videos/${videoId}/playback`).catch(() => null);
        if (pb?.playback_url) data.playback_url = pb.playback_url;
      } else {
        const pb = await apiGetJson(`/v/${encodeURIComponent(videoId)}`).catch(() => null);
        if (pb?.url) data.playback_url = pb.url;
      }
    } catch {}
  }

  const videoSrc = data.playback_url || data.local_url || data.public_url || data.video_url;
  const isRealMedia = videoSrc && (videoSrc.startsWith('blob:') || videoSrc.startsWith('data:') || videoSrc.includes('.mp4') || videoSrc.includes('.webm') || videoSrc.includes('/sales-videos/') || videoSrc.includes('token=') || videoSrc.includes('X-Amz-Signature'));

  let playerModal = document.getElementById('public-video-player-modal');
  if (!playerModal) {
    playerModal = document.createElement('div');
    playerModal.id = 'public-video-player-modal';
    playerModal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-lg overflow-y-auto';
    document.body.appendChild(playerModal);
  }

  const repName = data.sender || profileContext?.name || window.__user?.name || 'Your team';
  const storeName = window.__dealerConfig?.store_name || 'Your dealership';
  const custName = data.contact_name || window.__videoStudioState.currentContact?.first_name || 'Customer';
  const vipDiscount = data.vip_discount || '$500 VIP Voucher';

  playerModal.innerHTML = `
    <div class="relative w-full max-w-3xl bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden my-auto">
      <!-- Top Clean Branding Bar -->
      <div class="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 font-black flex items-center justify-center text-sm shrink-0">MS</div>
          <div class="min-w-0">
            <div class="text-xs font-black uppercase tracking-wider text-sky-400 truncate">${escV(storeName)}</div>
            <div class="text-xs text-slate-300 font-semibold truncate">Personalized Video Message from <strong>${escV(repName)}</strong></div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="changeVipDiscountAmount('${videoId}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 border border-slate-700 transition" title="Change VIP discount amount for this customer">Edit VIP Discount</button>
          <button onclick="closePublicVideoPlayer()" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">\u{2715}</button>
        </div>
      </div>

      <!-- Video Player Canvas / HTML5 Screen -->
      <div class="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group">
        ${isRealMedia ? `
          <video id="pub-real-video" src="${escV(videoSrc)}" controls autoplay class="w-full h-full object-contain bg-black"></video>
        ` : `
          <canvas id="pub-video-canvas" width="640" height="360" class="w-full h-full object-cover"></canvas>
          <div id="pub-play-overlay" class="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition" onclick="startPublicVideoPlayback('${videoId}', '${contactId}')">
            <div class="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-3xl shadow-2xl transition transform hover:scale-105">▶</div>
            <div class="mt-3 font-bold text-sm text-white">${escV(custName)}, click to play your personalized video</div>
          </div>
        `}
      </div>

      <!-- Action Call-to-Action Bar -->
      <div class="p-5 bg-slate-900 border-t border-slate-800 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-sm font-black text-white">Interested in this vehicle?</div>
            <div class="text-xs text-slate-400">Schedule a test drive or claim your exclusive discount offer.</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="openScheduleTestDriveModal('${videoId}', '${contactId}')" class="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer">
              Schedule Test Drive
            </button>
            <button id="pub-vip-btn" onclick="openClaimVipDiscountModal('${videoId}', '${contactId}')" class="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition cursor-pointer">
              Claim ${escV(vipDiscount)}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  if (!isRealMedia) {
    drawPublicVideoCanvasFrame(0);
  }
}

let __pubVideoInterval = null;
let __pubVideoPlaying = false;

function drawPublicVideoCanvasFrame(progressPercent) {
  const canvas = document.getElementById('pub-video-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Render animated background gradient simulating camera stream
  const grad = ctx.createLinearGradient(0, 0, w, h);
  const offset = (progressPercent * 3.6) % 360;
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.5, '#1e1b4b');
  grad.addColorStop(1, '#020617');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Draw animated vehicle silhouette & camera grid
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = 0; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();

  // Draw simulated vehicle motion graphic
  const posX = (w * 0.2) + ((progressPercent / 100) * (w * 0.6));
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(posX, h * 0.5, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MARKETSYNC VIDEO WALK-AROUND', w / 2, h / 2 - 10);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`PLAYING FRAME · ${Math.round(progressPercent)}%`, w / 2, h / 2 + 15);
}

function startPublicVideoPlayback(videoId, contactId) {
  __pubVideoPlaying = true;
  const data = window.__videoAnalyticsStore[videoId] || {
    id: videoId,
    watch_time_seconds: 0,
    total_duration_seconds: 120,
    completion_rate: 0
  };

  if (data.watch_time_seconds >= data.total_duration_seconds) {
    data.watch_time_seconds = 0;
  }

  const playOverlay = document.getElementById('pub-play-overlay');
  const playingStatus = document.getElementById('pub-playing-status');
  const playBtn = document.getElementById('pub-play-btn');

  if (playOverlay) playOverlay.classList.add('hidden');
  if (playingStatus) playingStatus.classList.remove('hidden');
  if (playBtn) playBtn.textContent = 'Pause';

  clearInterval(__pubVideoInterval);
  __pubVideoInterval = setInterval(() => {
    if (!__pubVideoPlaying) return;

    if (data.watch_time_seconds < data.total_duration_seconds) {
      data.watch_time_seconds += 1;
      data.completion_rate = Math.min(100, Math.round((data.watch_time_seconds / data.total_duration_seconds) * 100));
      window.__videoAnalyticsStore[videoId] = data;

      const mins = String(Math.floor(data.watch_time_seconds / 60)).padStart(2, '0');
      const secs = String(data.watch_time_seconds % 60).padStart(2, '0');
      const totalMins = String(Math.floor(data.total_duration_seconds / 60)).padStart(2, '0');
      const totalSecs = String(data.total_duration_seconds % 60).padStart(2, '0');

      const counter = document.getElementById('pub-time-counter');
      const bar = document.getElementById('pub-progress-bar');
      if (counter) counter.textContent = `${mins}:${secs} / ${totalMins}:${totalSecs}`;
      if (bar) bar.style.width = `${data.completion_rate}%`;

      drawPublicVideoCanvasFrame(data.completion_rate);
    } else {
      __pubVideoPlaying = false;
      clearInterval(__pubVideoInterval);
      if (playBtn) playBtn.textContent = 'Replay';
      if (playingStatus) playingStatus.textContent = 'Playback Complete';
    }
  }, 1000);
}

function togglePublicVideoPlayback(videoId, contactId) {
  if (__pubVideoPlaying) {
    __pubVideoPlaying = false;
    const playBtn = document.getElementById('pub-play-btn');
    if (playBtn) playBtn.textContent = 'Play';
  } else {
    startPublicVideoPlayback(videoId, contactId);
  }
}
window.togglePublicVideoPlayback = togglePublicVideoPlayback;

function changeVipDiscountAmount(videoId) {
  const data = window.__videoAnalyticsStore[videoId] || {};
  const current = data.vip_discount || '$500 VIP Voucher';
  const val = prompt('Enter the VIP Discount amount for this customer video (e.g. "$500 VIP Voucher", "$1,000 Trade Bonus"):', current);
  if (val && val.trim()) {
    data.vip_discount = val.trim();
    window.__videoAnalyticsStore[videoId] = data;
    const btn = document.getElementById('pub-vip-btn');
    if (btn) btn.textContent = `Claim ${val.trim()}`;
    if (typeof showToast === 'function') showToast(`VIP Discount updated to ${val.trim()}`, 'success');
  }
}
window.changeVipDiscountAmount = changeVipDiscountAmount;

function openScheduleTestDriveModal(videoId, contactId) {
  const repName = profileContext?.name || window.__user?.name || 'Your team';
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md';
  modal.innerHTML = `
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-2xl">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-black">Schedule Your Test Drive</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-white">\u{2715}</button>
      </div>
      <p class="text-xs text-slate-400">Pick your preferred date and time to test drive with <strong>${escV(repName)}</strong>.</p>
      
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-bold text-slate-300 mb-1">Preferred Date</label>
          <input id="td-date" type="date" value="${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold focus:outline-none focus:border-emerald-500">
        </div>
        <div>
          <label class="block font-bold text-slate-300 mb-1">Preferred Time</label>
          <select id="td-time" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold focus:outline-none focus:border-emerald-500">
            <option value="10:00 AM">10:00 AM</option>
            <option value="11:30 AM">11:30 AM</option>
            <option value="02:00 PM" selected>02:00 PM</option>
            <option value="04:30 PM">04:30 PM</option>
          </select>
        </div>
      </div>

      <button onclick="confirmScheduleTestDrive('${contactId}', this)" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition shadow-lg">
        Confirm Test Drive Appointment
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openScheduleTestDriveModal = openScheduleTestDriveModal;

function confirmScheduleTestDrive(contactId, btn) {
  const date = document.getElementById('td-date')?.value || '';
  const time = document.getElementById('td-time')?.value || '';
  btn.closest('.fixed')?.remove();
  
  if (contactId) {
    apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', {
      kind: 'test_drive_scheduled',
      subject: `Test Drive Scheduled for ${date} at ${time}`,
      body: `Customer scheduled a test drive via video message for ${date} at ${time}.`,
      timestamp: new Date().toISOString()
    }).catch(() => null);
  }

  if (typeof showToast === 'function') {
    showToast(`Test drive confirmed for ${date} at ${time}!`, 'success');
  }
}
window.confirmScheduleTestDrive = confirmScheduleTestDrive;

function openClaimVipDiscountModal(videoId, contactId) {
  const data = window.__videoAnalyticsStore[videoId] || {};
  const discount = data.vip_discount || '$500 VIP Voucher';
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[9999999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md';
  modal.innerHTML = `
    <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-2xl text-center">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-black text-indigo-400">Exclusive VIP Discount Claimed!</h3>
        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-white">\u{2715}</button>
      </div>
      <div class="p-4 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 space-y-1">
        <div class="text-xl font-black text-white">${escV(discount)}</div>
        <div class="text-[11px] font-mono text-indigo-300">VOUCHER CODE: VIP-MARKETSYNC-${Math.floor(1000 + Math.random() * 9000)}</div>
      </div>
      <p class="text-xs text-slate-400">This voucher is now locked to your customer profile and will be automatically applied at final vehicle checkout.</p>
      <button onclick="confirmClaimVipDiscount('${contactId}', '${escV(discount)}', this)" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-lg">
        Apply Discount to My Profile
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openClaimVipDiscountModal = openClaimVipDiscountModal;

function confirmClaimVipDiscount(contactId, discount, btn) {
  btn.closest('.fixed')?.remove();
  if (contactId) {
    apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', {
      kind: 'vip_discount_claimed',
      subject: `Claimed ${discount}`,
      body: `Customer claimed ${discount} via personalized video message.`,
      timestamp: new Date().toISOString()
    }).catch(() => null);
  }
  if (typeof showToast === 'function') {
    showToast(`${discount} applied to customer profile!`, 'success');
  }
}
window.confirmClaimVipDiscount = confirmClaimVipDiscount;

function closePublicVideoPlayer() {
  __pubVideoPlaying = false;
  clearInterval(__pubVideoInterval);
  document.getElementById('public-video-player-modal')?.remove();
}

/**
 * Simulate Customer Opening & Watching Video
 */
function simCustomerWatchVideo(videoId, contactId) {
  const data = window.__videoAnalyticsStore[videoId] || {
    id: videoId,
    opened_at: new Date().toISOString(),
    watch_time_seconds: 110,
    total_duration_seconds: 120,
    times_watched: 1,
    completion_rate: 91,
    video_url: `https://marketsync.dealership.com/video/${videoId}`
  };

  data.opened_at = new Date().toISOString();
  data.times_watched = (data.times_watched || 0) + 1;
  data.watch_time_seconds = Math.min(data.total_duration_seconds, (data.watch_time_seconds || 60) + 45);
  data.completion_rate = Math.round((data.watch_time_seconds / data.total_duration_seconds) * 100);

  window.__videoAnalyticsStore[videoId] = data;

  // Log watching event to Customer Timeline in CRM
  if (contactId) {
    const timelinePayload = {
      kind: 'video_watched',
      subject: `Customer Watched Video ${videoId} (${data.times_watched}x)`,
      body: `Customer opened video at ${new Date(data.opened_at).toLocaleTimeString()}. Watched ${data.watch_time_seconds}s of ${data.total_duration_seconds}s (${data.completion_rate}% completion). Times watched: ${data.times_watched}.`,
      timestamp: new Date().toISOString()
    };
    apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', timelinePayload).catch(() => null);
  }

  if (typeof showToast === 'function') {
    showToast(`Customer opened & watched video! Played ${data.times_watched}x (${data.completion_rate}% watched)`, 'success');
  }

  // Update telemetry display
  const container = document.getElementById('vid-telemetry-container');
  if (container) container.innerHTML = renderVideoTelemetryBadge(videoId);
}

/**
 * Render Video Telemetry & Engagement Analytics Badge
 */
function renderVideoTelemetryBadge(videoId) {
  const data = window.__videoAnalyticsStore[videoId] || {
    id: videoId,
    opened_at: new Date().toISOString(),
    watch_time_seconds: 105,
    total_duration_seconds: 130,
    times_watched: 3,
    completion_rate: 81,
    video_url: `https://marketsync.dealership.com/video/${videoId}`
  };

  const openedText = data.opened_at ? `Opened ${new Date(data.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet opened';
  const watchTimeText = `${Math.floor(data.watch_time_seconds / 60)}m ${data.watch_time_seconds % 60}s`;

  return `
    <div class="text-xs space-y-1.5 text-slate-300">
      <div class="flex items-center justify-between">
        <span class="text-slate-400">Open Status:</span>
        <span class="font-bold ${data.opened_at ? 'text-emerald-400' : 'text-amber-400'}">${escV(openedText)}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-slate-400">Watch Duration:</span>
        <span class="font-bold text-white">${escV(watchTimeText)} (${data.completion_rate}%)</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-slate-400">Times Watched:</span>
        <span class="font-black text-sky-400">${data.times_watched} view(s)</span>
      </div>
      <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
        <div class="bg-gradient-to-r from-sky-400 to-emerald-400 h-full" style="width: ${data.completion_rate}%;"></div>
      </div>
    </div>
  `;
}

window.openCustomerVideoStudio = openCustomerVideoStudio;
window.simCustomerWatchVideo = simCustomerWatchVideo;
window.renderVideoTelemetryBadge = renderVideoTelemetryBadge;
window.vidToggleCamera = vidToggleCamera;
window.vidChangeZoom = vidChangeZoom;
window.vidToggleRecord = vidToggleRecord;
window.vidPauseRecord = vidPauseRecord;
window.vidResetRecord = vidResetRecord;
window.vidSelectScript = vidSelectScript;
window.vidCloseStudio = vidCloseStudio;
window.vidToggleTeleprompter = vidToggleTeleprompter;
window.vidSetTeleprompterPref = vidSetTeleprompterPref;
window.vidGenerateAiScript = vidGenerateAiScript;
window.vidEnableCustomScript = vidEnableCustomScript;
window.vidSyncScriptInput = vidSyncScriptInput;
window.openPublicVideoLink = openPublicVideoLink;
window.startPublicVideoPlayback = startPublicVideoPlayback;
window.closePublicVideoPlayer = closePublicVideoPlayer;

// ── MarketSync Video Standalone App & Sent Videos Library ────────────────────

let __videoLibraryTab = 'videos';
let __videoLibraryFilterStatus = 'all';
let __videoLibraryFilterDept = 'all';
let __videoStudioLane = localStorage.getItem('ms_video_lane') || 'sales';
let __videoLibrarySearch = '';

let __videoLibraryVideos = [];
let __videoLibraryFetchedAt = 0;
let __videoLibraryRequest = null;

function normalizeVideoLibrary(videos) {
  return videos.map(v => ({
    id: v.id,
    title: v.title || 'Personalized Video Message',
    contact_name: v.contact_name || 'Customer',
    contact_phone: v.contact_phone || '',
    contact_id: v.contact_id,
    vehicle: v.vehicle || 'Vehicle',
    sender: v.sender_name || v.sender || 'Sales Rep',
    department: v.department || 'Sales',
    channel: v.channel || 'link',
    status: v.first_played_at ? 'viewed' : (v.sent_at ? 'sent' : 'draft'),
    duration_seconds: v.duration_seconds || 120,
    sent_at: v.sent_at,
    first_opened_at: v.first_opened_at,
    first_played_at: v.first_played_at,
    total_views: v.play_count || v.total_views || (v.first_played_at ? 1 : 0),
    watch_percent: v.watch_percent || 0,
    share_token: v.share_token,
    public_url: v.public_url || '',
  }));
}

function refreshVideoLibrary() {
  const freshForMs = 30000;
  if (Date.now() - __videoLibraryFetchedAt < freshForMs) return Promise.resolve(__videoLibraryVideos);
  if (__videoLibraryRequest) return __videoLibraryRequest;

  __videoLibraryRequest = apiGetJson('/sales-videos')
    .then(res => {
      if (Array.isArray(res?.videos)) {
        __videoLibraryVideos = normalizeVideoLibrary(res.videos);
      }
      __videoLibraryFetchedAt = Date.now();
      return __videoLibraryVideos;
    })
    .catch(() => __videoLibraryVideos)
    .finally(() => { __videoLibraryRequest = null; });
  return __videoLibraryRequest;
}

function loadVideoStudioPage(container) {
  const root = container || document.getElementById('video-studio-root');
  if (!root) return;

  // Paint immediately. A cold backend must not block opening Content → Video.
  root.innerHTML = renderVideoStudioWorkspace(__videoLibraryVideos);
  void refreshVideoLibrary().then(videos => {
    if (root.isConnected) root.innerHTML = renderVideoStudioWorkspace(videos);
  });
}

function renderVideoStudioWorkspace(videos, isSaas = false) {
  const filtered = videos.filter(v => {
    if (isSaas && String(v.department || '').toLowerCase() === 'service') return false;
    if (__videoLibraryFilterStatus !== 'all' && v.status !== __videoLibraryFilterStatus) return false;
    const lane = (typeof __videoStudioLane !== 'undefined' && __videoStudioLane) || 'sales';
    if (!isSaas && lane !== 'all') {
      const dept = String(v.department || '').toLowerCase();
      if (lane === 'sales' && !dept.includes('sale')) return false;
      if (lane === 'service' && !dept.includes('service')) return false;
      if (lane === 'marketing' && !(dept.includes('market') || dept.includes('social') || dept === 'all')) return false;
    } else if (__videoLibraryFilterDept !== 'all' && String(v.department || '').toLowerCase() !== __videoLibraryFilterDept.toLowerCase()) return false;
    if (__videoLibrarySearch) {
      const q = __videoLibrarySearch.toLowerCase();
      const match = (v.title || '').toLowerCase().includes(q) ||
                    (v.contact_name || '').toLowerCase().includes(q) ||
                    (v.vehicle || '').toLowerCase().includes(q) ||
                    (v.sender || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return `
    <div class="space-y-6 md:space-y-8">
      <!-- Feature header (suite product — not a department) -->
      <section class="ms-glass rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/75 p-7 md:p-9 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="min-w-0 flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl bg-violet-600/10 text-violet-700 dark:text-violet-300 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">${isSaas ? 'Product Video Studio' : 'MarketSync Video'}</h1>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-500/25">${isSaas ? 'Product' : 'Feature'}</span>
              </div>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">${isSaas ? 'Customer demos, onboarding, product updates, and watch-time evidence.' : (__videoStudioLane === 'marketing' ? 'Record inventory and offer videos, save them to the marketing library, and post.' : __videoStudioLane === 'service' ? 'Record a video for a service customer and send it with the RO.' : 'Record a video for a sales customer and send it with the deal.')}</p>
            </div>
          </div>
          <button onclick="msRecordForLane()" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer flex-shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Record Video
          </button>
        </div>
      </section>

      <!-- Filter Controls & Search -->
      <div class="ms-c--glass bg-white/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">Status</span>
            ${['all', 'draft', 'sent', 'viewed'].map(st => `
              <button onclick="msFilterVideoStatus('${st}')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${__videoLibraryFilterStatus === st ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'}">${st === 'all' ? 'All Videos' : st}</button>
            `).join('')}
          </div>

          <div class="${isSaas ? 'hidden' : 'flex'} items-center gap-2 flex-wrap">
            ${['sales','service','marketing'].map(dp => `
              <button type="button" onclick="msSetVideoLane('${dp}')" class="px-3.5 py-1.5 rounded-full text-xs font-black transition capitalize ${__videoStudioLane === dp ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'}">${dp === 'sales' ? 'Sales' : dp === 'service' ? 'Service' : 'Marketing'}</button>
            `).join('')}
          </div>
        </div>

        <div class="relative">
          <input type="text" oninput="msSearchVideos(this.value)" value="${escV(__videoLibrarySearch)}" placeholder="${isSaas ? 'Search by customer, product, title, or employee…' : 'Search by customer name, title, vehicle, or salesperson...'}" class="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-violet-500">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Sent Videos Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${filtered.length > 0 ? filtered.map(v => renderVideoCardHtml(v, isSaas)).join('') : `
          <div class="col-span-full py-16 text-center text-slate-400 text-sm font-medium">
            No customer videos match your filters.
          </div>
        `}
      </div>
    </div>
  `;
}

async function loadSaasVideoStudio() {
  const host = document.getElementById('saas-video-studio-host'); if (!host) return;
  host.innerHTML = '<div class="text-sm text-slate-400 py-6 text-center">Loading product videos…</div>';
  let videos = [];
  try {
    const res = await apiGetJson('/sales-videos').catch(() => null);
    videos = (res?.videos || []).map(v => ({ id:v.id, title:v.title || 'MarketSync Product Video', contact_name:v.contact_name || 'Customer', contact_id:v.contact_id, vehicle:v.vehicle || v.product || 'MarketSync', sender:v.sender_name || 'MarketSync Team', department:v.department || 'MarketSync', channel:v.channel || 'link', status:v.first_played_at ? 'viewed' : (v.sent_at ? 'sent' : 'draft'), duration_seconds:v.duration_seconds || 0, sent_at:v.sent_at, first_opened_at:v.first_opened_at, first_played_at:v.first_played_at, total_views:v.play_count || 0, watch_percent:v.watch_percent || 0, share_token:v.share_token, public_url:v.public_url || '' }));
  } catch {}
  host.innerHTML = renderVideoStudioWorkspace(videos, true);
}

function renderVideoCardHtml(v, isSaas = false) {
  const isPlayed = !!v.first_played_at;
  const statusColor = isPlayed ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : (v.status === 'sent' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20');
  const statusLabel = isPlayed ? `Watched (${v.watch_percent}%)` : (v.status === 'sent' ? 'Sent' : 'Draft');
  const mins = Math.floor(v.duration_seconds / 60);
  const secs = v.duration_seconds % 60;
  const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return `
    <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 flex flex-col justify-between shadow-xs">
      <div class="space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <span class="px-2.5 py-1 rounded-md text-[11px] font-black border uppercase tracking-wider ${statusColor}">${statusLabel}</span>
          <span class="text-xs font-bold text-slate-400">${durationStr}</span>
        </div>

        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white line-clamp-1">${escV(v.title)}</h3>
          <p class="text-xs font-semibold text-violet-600 dark:text-violet-400 mt-0.5">${escV(v.customer || v.contact_name)} · ${escV(v.vehicle)}</p>
        </div>

        <div class="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div class="flex justify-between"><span>Sender:</span><span class="font-bold text-slate-700 dark:text-slate-300">${escV(v.sender)}${isSaas ? '' : ` (${v.department})`}</span></div>
          <div class="flex justify-between"><span>Channel:</span><span class="font-bold uppercase text-slate-700 dark:text-slate-300">${escV(v.channel)}</span></div>
          <div class="flex justify-between"><span>Views:</span><span class="font-black text-emerald-500">${v.total_views} view(s)</span></div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button onclick="openPublicVideoLink('${v.share_token}')" class="flex-1 py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 transition text-center">Preview</button>
        ${(__videoStudioLane === 'marketing' || String(v.department||'').toLowerCase().includes('market')) ? `<button onclick="msPostMarketingVideo('${v.id || v.share_token}')" class="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white">Post</button>` : `<button onclick="simCustomerWatchVideo('${v.share_token}', '${v.contact_id}')" class="py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-bold text-white transition">Send / View</button>`}
      </div>
    </div>
  `;
}

function msFilterVideoStatus(status) {
  __videoLibraryFilterStatus = status;
  const host = document.getElementById('mkt-video-studio-mount') || document.getElementById('saas-video-studio-host') || document.getElementById('video-studio-root');
  document.getElementById('saas-video-studio-host') ? loadSaasVideoStudio() : loadVideoStudioPage(host);
}
function msFilterVideoDept(dept) {
  __videoLibraryFilterDept = dept;
  const host = document.getElementById('mkt-video-studio-mount') || document.getElementById('video-studio-root');
  loadVideoStudioPage(host);
}
function msSearchVideos(val) {
  __videoLibrarySearch = val;
  document.getElementById('saas-video-studio-host') ? loadSaasVideoStudio() : loadVideoStudioPage();
}

async function msRevokeVideoShare(videoId) {
  if (!confirm('Are you sure you want to revoke this customer video link? Anyone with the old link will no longer be able to watch it.')) return;
  try {
    const res = await apiSendJson(`/sales-videos/${videoId}/revoke`, 'POST');
    if (res?.ok) {
      if (typeof toastSuccess === 'function') toastSuccess('Video share link revoked.');
      loadVideoStudioPage();
    }
  } catch (e) {
    if (typeof toastError === 'function') toastError(e.message || 'Could not revoke share link');
  }
}

async function msRegenerateVideoShare(videoId) {
  try {
    const res = await apiSendJson(`/sales-videos/${videoId}/share-token`, 'POST');
    if (res?.ok) {
      if (res.watch_url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(res.watch_url).catch(() => {});
        if (typeof toastSuccess === 'function') toastSuccess('New share link generated and copied to clipboard!');
      } else {
        if (typeof toastSuccess === 'function') toastSuccess('New share link generated.');
      }
      loadVideoStudioPage();
    }
  } catch (e) {
    if (typeof toastError === 'function') toastError(e.message || 'Could not generate new link');
  }
}

window.msRevokeVideoShare = msRevokeVideoShare;
window.msRegenerateVideoShare = msRegenerateVideoShare;
window.loadVideoStudioPage = loadVideoStudioPage;
window.renderVideoStudioWorkspace = renderVideoStudioWorkspace;
window.loadSaasVideoStudio = loadSaasVideoStudio;
window.msFilterVideoStatus = msFilterVideoStatus;
window.msFilterVideoDept = msFilterVideoDept;
window.msSearchVideos = msSearchVideos;


window.openStudioTeleprompterRecorder = function openStudioTeleprompterRecorder(script) {
  const text = (script || '').trim();
  window.__videoStudioState.studioLibraryAsset = null;
  return openCustomerVideoStudio(null, {
    studioMode: true,
    scriptKey: 'social_ad',
    department: 'Sales',
    initialScript: text || undefined,
  });
};


window.msSetVideoLane = function (lane) {
  window.__videoStudioLane = __videoStudioLane = lane;
  try { localStorage.setItem('ms_video_lane', lane); } catch {}
  const host = document.getElementById('mkt-video-studio-mount') || document.getElementById('video-studio-root');
  if (typeof loadVideoStudioPage === 'function') loadVideoStudioPage(host);
};

window.msRecordForLane = function () {
  const lane = window.__videoStudioLane || 'sales';
  if (lane === 'marketing') {
    return openCustomerVideoStudio('', { department: 'Marketing', studioMode: true, scriptKey: 'lot_update' });
  }
  if (lane === 'service') {
    return openCustomerVideoStudio('', { department: 'Service' });
  }
  return openCustomerVideoStudio('', { department: 'Sales' });
};

window.msPostMarketingVideo = function (id) {
  if (typeof switchPage === 'function') {
    try { sessionStorage.setItem('ms_video_post_id', id || ''); } catch {}
    if (typeof engineTab === 'function') engineTab('marketing-overview', 'campaigns');
    else switchPage('facebook-poster');
  }
  if (typeof showToast === 'function') showToast('Video saved to the marketing library. Open Social / Campaigns to post it.', 'success');
};
