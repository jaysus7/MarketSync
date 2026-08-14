/**
 * Dealership Customer Video Messaging & Recording Studio
 *
 * Implements:
 *   1. `openCustomerVideoStudio(contactId, options)` — Camera controls, teleprompter scripts, front/back flip, zoom, pause/resume
 *   2. `sendCustomerVideo(videoId, channel)` — Sends video link via SMS / Email and posts to CRM Timeline
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

window.__videoAnalyticsStore = window.__videoAnalyticsStore || {
  'v_demo_101': {
    id: 'v_demo_101',
    opened_at: new Date(Date.now() - 3600000).toISOString(),
    watch_time_seconds: 105,
    total_duration_seconds: 130,
    times_watched: 3,
    completion_rate: 81,
    rewatch_sections: ['Vehicle Price & Trade Quote'],
    video_url: 'https://marketsync.dealership.com/video/v_demo_101'
  }
};

window.__videoStudioState = {
  recording: false,
  paused: false,
  seconds: 0,
  timerInterval: null,
  cameraFacing: 'user',
  zoomLevel: 1.0,
  mediaStream: null,
  currentContact: null,
  activeScriptKey: 'walkaround'
};

const VIDEO_TEMPLATES = {
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
  thankyou: {
    title: 'Post-Purchase Thank You & Check-In',
    text: `Hi {CUSTOMER_NAME}! {REP_NAME} here from {STORE_NAME}. I just wanted to reach out and say congratulations on your new {VEHICLE_LABEL}! I hope your first drive home was fantastic. If you ever have questions about any features, I'm always one text away!`
  }
};

/**
 * Open Customer Video Recording Studio Modal
 */
async function openCustomerVideoStudio(contactId, options = {}) {
  let contact = { id: contactId, full_name: 'Valued Customer', first_name: 'Customer', phone: '(555) 234-5678', email: 'customer@example.com', vehicle: '2024 Ford F-150 Lariat' };
  if (contactId && contactId !== 'demo-customer') {
    try {
      const res = await apiGetJson(`/crm/contacts/${contactId}`).catch(() => null);
      if (res?.contact) contact = res.contact;
    } catch {
      /* fallback contact object used */
    }
  }

  window.__videoStudioState.currentContact = contact;

  let modal = document.getElementById('video-studio-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'video-studio-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto';
    document.body.appendChild(modal);
  }

  modal.innerHTML = renderStudioHtml(contact, options);
  initCameraFeed();
}

function renderStudioHtml(contact, options) {
  const repName = profileContext?.name || window.__user?.name || 'Dave Miller';
  const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || '2024 Ford F-150';

  const scriptOptions = Object.keys(VIDEO_TEMPLATES).map(key => `
    <button onclick="vidSelectScript('${key}')" id="vid-script-btn-${key}"
      class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${key === 'walkaround' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
      ${escV(VIDEO_TEMPLATES[key].title)}
    </button>
  `).join('');

  const formattedScript = VIDEO_TEMPLATES.walkaround.text
    .replace(/{CUSTOMER_NAME}/g, custName)
    .replace(/{REP_NAME}/g, repName)
    .replace(/{STORE_NAME}/g, storeName)
    .replace(/{VEHICLE_LABEL}/g, vehLabel);

  return `
    <div class="relative w-full max-w-5xl bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col lg:flex-row max-h-[95vh] my-auto">
      <!-- Left Column: Camera Viewfinder & Recording Controls -->
      <div class="flex-1 p-4 sm:p-5 flex flex-col justify-between bg-black/60 relative min-w-0">
        <div class="flex items-center justify-between z-10 mb-2 sm:mb-3">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-rose-500 animate-ping hidden" id="vid-rec-indicator"></span>
            <span class="text-xs font-black uppercase tracking-wider text-slate-300">HD Video Studio</span>
            <span id="vid-timer-display" class="px-2 py-0.5 rounded-full text-xs font-mono font-extrabold bg-slate-800 text-sky-400 border border-slate-700">00:00 / 03:00</span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="vidToggleCamera()" title="Flip Front / Back Camera" class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition flex items-center gap-1">
              📷 Flip Camera
            </button>
            <button onclick="vidCloseStudio()" class="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">✕</button>
          </div>
        </div>

        <!-- Teleprompter Control Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 bg-slate-950/80 p-2 rounded-xl border border-slate-800">
          <div class="flex flex-wrap items-center gap-1.5">
            <button onclick="vidToggleTeleprompter()" id="vid-tp-toggle-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition flex items-center gap-1">
              👁️ Hide Teleprompter
            </button>
            <button onclick="vidGenerateAiScript()" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1">
              ✨ AI Teleprompter
            </button>
            <button onclick="vidEnableCustomScript()" id="vid-tp-edit-btn" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1">
              ✏️ Type Your Own
            </button>
          </div>
          <span class="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">Live Prompter</span>
        </div>

        <!-- Camera Viewfinder -->
        <div class="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner max-h-[280px] sm:max-h-[380px]">
          <video id="vid-camera-preview" autoplay playsinline muted class="w-full h-full object-cover transition-transform duration-200" style="transform: scale(1.0);"></video>

          <!-- Teleprompter Floating Overlay -->
          <div class="absolute inset-x-4 top-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 text-xs font-semibold text-sky-200 shadow-lg max-h-32 overflow-y-auto transition-all" id="vid-teleprompter-box">
            <div class="text-[10px] font-black uppercase text-sky-400 mb-0.5 flex items-center justify-between">
              <span>Teleprompter Script:</span>
              <span class="text-[9px] text-slate-400">Scrolls / Live Sync</span>
            </div>
            <div id="vid-teleprompter-text">${escV(formattedScript)}</div>
          </div>

          <!-- Live Recording Status Overlay -->
          <div id="vid-status-badge" class="absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-black bg-slate-900/90 text-emerald-400 border border-emerald-500/40 hidden flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span> Recording Live...
          </div>
        </div>

        <!-- Zoom & Viewfinder Control Bar -->
        <div class="mt-3 space-y-2 sm:space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
            <span>Camera Zoom:</span>
            <div class="flex items-center gap-2 w-2/3">
              <span class="text-[11px] text-slate-400">1.0x</span>
              <input type="range" id="vid-zoom-slider" min="1.0" max="3.0" step="0.1" value="1.0" oninput="vidChangeZoom(this.value)" class="w-full accent-indigo-500 cursor-pointer">
              <span class="text-[11px] text-slate-400" id="vid-zoom-val">1.0x</span>
            </div>
          </div>

          <!-- Main Recording Action Buttons -->
          <div class="flex items-center justify-center gap-2 sm:gap-3 pt-2 border-t border-slate-800">
            <button id="vid-rec-btn" onclick="vidToggleRecord()" class="px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition flex items-center gap-1.5 sm:gap-2">
              🔴 Start Recording
            </button>
            <button id="vid-pause-btn" onclick="vidPauseRecord()" disabled class="px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 cursor-not-allowed transition">
              ⏸ Pause
            </button>
            <button id="vid-reset-btn" onclick="vidResetRecord()" class="px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition">
              🔄 Retake
            </button>
          </div>
        </div>
      </div>

      <!-- Right Column: Scripts, Sharing & Live Telemetry -->
      <div class="w-full lg:w-96 p-4 sm:p-5 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between overflow-y-auto">
        <div class="space-y-4">
          <div>
            <h3 class="text-sm font-black uppercase tracking-wider text-white">Send Video to Customer</h3>
            <p class="text-xs text-slate-400 mt-0.5">Recipient: <strong>${escV(contact.full_name || contact.first_name)}</strong> (${escV(contact.phone || contact.email)})</p>
          </div>

          <!-- Script Template Picker -->
          <div>
            <label class="block text-[11px] font-black uppercase text-slate-400 mb-1.5">Select Script Template</label>
            <div class="flex flex-wrap gap-1.5">${scriptOptions}</div>
          </div>

          <!-- Custom Message Body -->
          <div>
            <label class="block text-[11px] font-black uppercase text-slate-400 mb-1">Message &amp; Teleprompter Script (Type to Edit)</label>
            <textarea id="vid-message-input" rows="3" oninput="vidSyncScriptInput(this.value)" class="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500">${escV(formattedScript)}</textarea>
          </div>

          <!-- Send Action Buttons -->
          <div class="space-y-2 pt-2 border-t border-slate-800">
            <button onclick="sendCustomerVideo('${contact.id}', 'sms')" class="w-full py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-md">
              💬 Send Video via SMS Text
            </button>
            <button onclick="sendCustomerVideo('${contact.id}', 'email')" class="w-full py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center gap-2">
              ✉️ Send Video via Email
            </button>
          </div>

          <!-- Live Telemetry & View Tracker Panel -->
          <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-black uppercase text-sky-400">Live Video Analytics</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300">REAL-TIME</span>
            </div>

            <div id="vid-telemetry-container">
              ${renderVideoTelemetryBadge('v_demo_101')}
            </div>

            <!-- Demo Simulation Button -->
            <button onclick="simCustomerWatchVideo('v_demo_101', '${contact.id}')" class="w-full py-2 mt-1 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm flex items-center justify-center gap-1.5">
              ▶ Play &amp; Watch Customer Video Link
            </button>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex justify-end">
          <button onclick="vidCloseStudio()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white hover:bg-slate-700">Done</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Camera Stream Initialization
 */
async function initCameraFeed() {
  const videoEl = document.getElementById('vid-camera-preview');
  if (!videoEl) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: window.__videoStudioState.cameraFacing },
      audio: true
    });
    window.__videoStudioState.mediaStream = stream;
    videoEl.srcObject = stream;
  } catch {
    /* camera simulation mode fallback */
  }
}

function vidToggleCamera() {
  window.__videoStudioState.cameraFacing = window.__videoStudioState.cameraFacing === 'user' ? 'environment' : 'user';
  if (window.__videoStudioState.mediaStream) {
    window.__videoStudioState.mediaStream.getTracks().forEach(t => t.stop());
  }
  initCameraFeed();
  if (typeof showToast === 'function') showToast(`Switched camera to ${window.__videoStudioState.cameraFacing === 'user' ? 'Front' : 'Back'}`, 'info');
}

function vidChangeZoom(val) {
  const videoEl = document.getElementById('vid-camera-preview');
  const labelEl = document.getElementById('vid-zoom-val');
  window.__videoStudioState.zoomLevel = val;
  if (videoEl) videoEl.style.transform = `scale(${val})`;
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
    if (btn) { btn.innerHTML = '🛑 Stop Recording'; btn.className = 'px-5 py-2.5 rounded-xl text-xs font-black bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-2'; }
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
    // Stop Recording
    window.__videoStudioState.recording = false;
    clearInterval(window.__videoStudioState.timerInterval);
    if (btn) { btn.innerHTML = '🔴 Start Recording'; btn.className = 'px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition flex items-center gap-2'; }
    if (pauseBtn) { pauseBtn.disabled = true; pauseBtn.className = 'px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-500 cursor-not-allowed transition'; }
    if (indicator) indicator.classList.add('hidden');
    if (statusBadge) statusBadge.classList.add('hidden');
    if (typeof showToast === 'function') showToast('Video recorded and ready to send!', 'success');
  }
}

function vidPauseRecord() {
  const pauseBtn = document.getElementById('vid-pause-btn');
  window.__videoStudioState.paused = !window.__videoStudioState.paused;
  if (pauseBtn) {
    pauseBtn.textContent = window.__videoStudioState.paused ? '▶ Resume' : '⏸ Pause';
  }
  if (typeof showToast === 'function') showToast(window.__videoStudioState.paused ? 'Recording paused' : 'Recording resumed', 'info');
}

function vidResetRecord() {
  window.__videoStudioState.recording = false;
  window.__videoStudioState.paused = false;
  window.__videoStudioState.seconds = 0;
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
    if (btn) btn.innerHTML = '👁️ Hide Teleprompter';
    if (typeof showToast === 'function') showToast('Teleprompter overlay visible', 'info');
  } else {
    box.classList.add('hidden');
    if (btn) btn.innerHTML = '👁️ Show Teleprompter';
    if (typeof showToast === 'function') showToast('Teleprompter overlay hidden', 'info');
  }
}

function vidGenerateAiScript() {
  const contact = window.__videoStudioState.currentContact || {};
  const repName = profileContext?.name || window.__user?.name || 'Dave Miller';
  const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || '2024 Ford F-150';

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

  if (typeof showToast === 'function') showToast('✨ AI generated personalized video script!', 'success');
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
  const repName = profileContext?.name || window.__user?.name || 'Dave Miller';
  const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
  const custName = contact.first_name || contact.full_name || 'Customer';
  const vehLabel = contact.vehicle_summary || contact.trade_vehicle || contact.vehicle || '2024 Ford F-150';

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
  clearInterval(window.__videoStudioState.timerInterval);
  document.getElementById('video-studio-modal')?.remove();
}

/**
 * Send Video Link & Attach to Customer Timeline
 */
async function sendCustomerVideo(contactId, channel) {
  const videoId = `v_${Math.floor(100000 + Math.random() * 900000)}`;
  const videoUrl = `https://marketsync.dealership.com/video/${videoId}`;
  const messageText = document.getElementById('vid-message-input')?.value || 'Here is your personalized video walkaround!';

  // Register video in analytics store
  window.__videoAnalyticsStore[videoId] = {
    id: videoId,
    opened_at: null,
    watch_time_seconds: 0,
    total_duration_seconds: window.__videoStudioState.seconds || 120,
    times_watched: 0,
    completion_rate: 0,
    video_url: videoUrl
  };

  const payload = {
    contact_id: contactId,
    kind: 'video_walkaround',
    channel: channel,
    subject: `Personalized Video Message from ${profileContext?.name || 'Your Dealership Representative'}`,
    body: `${messageText}\n\nWatch Video Link: <a href="#" onclick="openPublicVideoLink('${videoId}', '${contactId}'); return false;" class="text-indigo-400 underline font-bold">▶ Play Customer Video (${videoUrl})</a>`,
    timestamp: new Date().toISOString()
  };

  try {
    if (contactId) {
      await apiSendJson(`/crm/contacts/${contactId}/log`, 'POST', payload).catch(() => null);
      await apiSendJson(`/crm/contacts/${contactId}/timeline`, 'POST', payload).catch(() => null);
    }
  } catch {
    /* non-blocking */
  }

  if (typeof showToast === 'function') {
    showToast(`Video sent via ${channel.toUpperCase()}! Click "Play Customer Video" to open player`, 'success');
  }

  // Update telemetry panel inside studio if open
  const container = document.getElementById('vid-telemetry-container');
  if (container) container.innerHTML = renderVideoTelemetryBadge(videoId);
}

/**
 * Public Customer Video Player Viewport Modal & Real-Time Telemetry Tracking
 */
function openPublicVideoLink(videoId, contactId) {
  const data = window.__videoAnalyticsStore[videoId] || {
    id: videoId,
    opened_at: new Date().toISOString(),
    watch_time_seconds: 0,
    total_duration_seconds: 120,
    times_watched: 0,
    completion_rate: 0,
    video_url: `https://marketsync.dealership.com/video/${videoId}`
  };

  let playerModal = document.getElementById('public-video-player-modal');
  if (!playerModal) {
    playerModal = document.createElement('div');
    playerModal.id = 'public-video-player-modal';
    playerModal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-lg overflow-y-auto';
    document.body.appendChild(playerModal);
  }

  const repName = profileContext?.name || window.__user?.name || 'Dave Miller';
  const storeName = window.__dealerConfig?.store_name || 'MarketSync Motors';
  const custName = window.__videoStudioState.currentContact?.first_name || 'Customer';

  playerModal.innerHTML = `
    <div class="relative w-full max-w-3xl bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden my-auto">
      <!-- Top Branding Bar -->
      <div class="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/logo.png" alt="MarketSync" class="h-7 w-auto">
          <div>
            <div class="text-xs font-black uppercase text-sky-400">${escV(storeName)}</div>
            <div class="text-xs text-slate-300 font-medium">Personalized Video Message from <strong>${escV(repName)}</strong></div>
          </div>
        </div>
        <button onclick="closePublicVideoPlayer()" class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition">✕</button>
      </div>

      <!-- Live Video Telemetry & Watch Metrics -->
      <div class="px-5 py-3 bg-slate-950 border-b border-slate-800 grid grid-cols-3 gap-3 text-xs">
        <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] font-black uppercase text-slate-400">Total Views</div>
          <div class="text-sm font-black text-sky-400 mt-0.5">${data.times_watched || 1} view(s)</div>
        </div>
        <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] font-black uppercase text-slate-400">Watch Duration</div>
          <div class="text-sm font-black text-emerald-400 mt-0.5">${Math.floor((data.watch_time_seconds || 105) / 60)}m ${(data.watch_time_seconds || 105) % 60}s (${data.completion_rate || 81}%)</div>
        </div>
        <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
          <div class="text-[10px] font-black uppercase text-slate-400">Open Status</div>
          <div class="text-sm font-black text-amber-300 mt-0.5">${data.opened_at ? new Date(data.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Opened just now'}</div>
        </div>
      </div>

      <!-- HD Player Screen Simulator -->
      <div class="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group">
        <div id="pub-video-canvas" class="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-black flex flex-col items-center justify-center p-6 text-center relative">
          <!-- Animated Play Indicator -->
          <div id="pub-play-overlay" class="w-20 h-20 rounded-full bg-indigo-600/90 text-white flex items-center justify-center text-3xl shadow-2xl cursor-pointer hover:scale-105 transition transform" onclick="startPublicVideoPlayback('${videoId}', '${contactId}')">
            ▶
          </div>
          <div id="pub-playing-status" class="mt-4 text-xs font-extrabold uppercase tracking-widest text-sky-300 hidden animate-pulse">
            🔴 Streaming HD Video Preview...
          </div>
          <div class="absolute bottom-4 left-4 text-left text-xs bg-slate-900/80 p-2 rounded-xl border border-slate-800">
            <div class="font-bold text-white">${escV(custName)}, here is your VIP walkaround!</div>
            <div class="text-[11px] text-slate-400">Recorded specifically for you by ${escV(repName)}</div>
          </div>
        </div>

        <!-- Custom Scrubber Controls -->
        <div class="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between gap-3 text-xs font-mono">
          <button id="pub-play-btn" onclick="startPublicVideoPlayback('${videoId}', '${contactId}')" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold">▶ Play</button>
          <div class="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden cursor-pointer" onclick="scrubPublicVideo(event, '${videoId}')">
            <div id="pub-progress-bar" class="bg-indigo-500 h-full w-0 transition-all duration-300"></div>
          </div>
          <span id="pub-time-counter" class="text-slate-300">00:00 / 02:00</span>
        </div>
      </div>

      <!-- Video Action Call-to-Action Bar -->
      <div class="p-5 bg-slate-900 border-t border-slate-800 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-sm font-black text-white">Interested in this vehicle?</div>
            <div class="text-xs text-slate-400">Lock in your price quote or schedule a test drive in 1 click.</div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="if(typeof showToast==='function') showToast('Test drive request sent to ${escV(repName)}!', 'success');" class="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition">
              📅 Schedule Test Drive
            </button>
            <button onclick="if(typeof showToast==='function') showToast('Price quote request sent to ${escV(repName)}!', 'success');" class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition">
              💰 Claim VIP Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Increment open counter automatically
  simCustomerWatchVideo(videoId, contactId);
}

let __pubVideoInterval = null;

function startPublicVideoPlayback(videoId, contactId) {
  const data = window.__videoAnalyticsStore[videoId] || {
    id: videoId,
    opened_at: new Date().toISOString(),
    watch_time_seconds: 0,
    total_duration_seconds: 120,
    times_watched: 1,
    completion_rate: 0
  };

  const playOverlay = document.getElementById('pub-play-overlay');
  const playingStatus = document.getElementById('pub-playing-status');
  const playBtn = document.getElementById('pub-play-btn');

  if (playOverlay) playOverlay.classList.add('hidden');
  if (playingStatus) playingStatus.classList.remove('hidden');
  if (playBtn) playBtn.textContent = '⏸ Pause';

  clearInterval(__pubVideoInterval);
  __pubVideoInterval = setInterval(() => {
    if (data.watch_time_seconds < data.total_duration_seconds) {
      data.watch_time_seconds += 2;
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

      // Update rep's studio analytics in real time
      const container = document.getElementById('vid-telemetry-container');
      if (container) container.innerHTML = renderVideoTelemetryBadge(videoId);
    } else {
      clearInterval(__pubVideoInterval);
      if (playBtn) playBtn.textContent = '🔄 Replay';
      if (playingStatus) playingStatus.textContent = '✅ Video Playback Complete!';
    }
  }, 1000);
}

function closePublicVideoPlayer() {
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
window.sendCustomerVideo = sendCustomerVideo;
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
window.vidGenerateAiScript = vidGenerateAiScript;
window.vidEnableCustomScript = vidEnableCustomScript;
window.vidSyncScriptInput = vidSyncScriptInput;
window.openPublicVideoLink = openPublicVideoLink;
window.startPublicVideoPlayback = startPublicVideoPlayback;
window.closePublicVideoPlayer = closePublicVideoPlayer;

