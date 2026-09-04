/* Check-in keeps an arrival video. Tech walkaround stays a separate DVI recording. */
(function (global) {
  'use strict';

  let recorder = null;
  let chunks = [];
  let stream = null;

  function toast(msg, kind) {
    if (typeof global.showToast === 'function') global.showToast(msg, kind || 'info');
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null;
    recorder = null;
  }

  function ensurePanel() {
    const modal = document.getElementById('svc-checkin-modal');
    if (!modal || document.getElementById('svc-in-video-panel')) return document.getElementById('svc-in-video-panel');
    const sig = modal.querySelector('#svc-walk-sig');
    const host = document.createElement('div');
    host.id = 'svc-in-video-panel';
    host.className = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2';
    host.innerHTML = '
      <div class="text-[10px] font-black uppercase tracking-wider text-slate-500">Check-in video</div>
      <p class="text-sm text-slate-500">Record the arrival walkaround with the customer before they sign. Tech inspection video is separate.</p>
      <video id="svc-in-video-preview" class="w-full h-40 rounded-xl bg-slate-900 object-cover" playsinline muted></video>
      <div class="flex flex-wrap gap-2">
        <button type="button" id="svc-in-video-start" class="px-3 py-2 rounded-xl text-xs font-black bg-rose-600 text-white">Start camera</button>
        <button type="button" id="svc-in-video-rec" class="px-3 py-2 rounded-xl text-xs font-black bg-slate-200 dark:bg-slate-800" disabled>Record</button>
        <button type="button" id="svc-in-video-stop" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-300" disabled>Stop</button>
      </div>
      <div id="svc-in-video-status" class="text-[11px] font-bold text-slate-500">No arrival video yet</div>
    ';
    if (sig && sig.parentElement && sig.parentElement.parentElement) {
      sig.parentElement.parentElement.insertBefore(host, sig.parentElement);
    } else {
      modal.querySelector('.p-5')?.appendChild(host);
    }
    bind(host);
    return host;
  }

  function bind(host) {
    const preview = host.querySelector('#svc-in-video-preview');
    const startBtn = host.querySelector('#svc-in-video-start');
    const recBtn = host.querySelector('#svc-in-video-rec');
    const stopBtn = host.querySelector('#svc-in-video-stop');
    const status = host.querySelector('#svc-in-video-status');

    startBtn.addEventListener('click', async function () {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: true });
        preview.srcObject = stream;
        preview.muted = true;
        await preview.play();
        recBtn.disabled = false;
        status.textContent = 'Camera ready — walk the car with the customer';
      } catch (e) {
        toast('Camera permission is required for the check-in video', 'error');
      }
    });

    recBtn.addEventListener('click', function () {
      if (!stream) return;
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      recorder.onstop = function () {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        global.__svcCheckinVideo = blob;
        global.__lastServiceWalkaround = { kind: 'checkin', blob: blob, at: Date.now() };
        const url = URL.createObjectURL(blob);
        preview.srcObject = null;
        preview.src = url;
        preview.muted = false;
        preview.controls = true;
        status.textContent = 'Arrival video saved with this check-in';
        toast('Check-in video saved', 'success');
      };
      recorder.start();
      recBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = 'Recording arrival walkaround…';
    });

    stopBtn.addEventListener('click', function () {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stopStream();
      stopBtn.disabled = true;
    });
  }

  function openTechWalkaround(roId, contactId) {
    window.__videoStudioLane = 'service-tech';
    const start = function () {
      if (typeof openCustomerVideoStudio === 'function') {
        openCustomerVideoStudio(contactId || '', {
          department: 'Service',
          scriptKey: 'service',
          roId: roId || null,
          studioMode: false,
          title: 'Tech inspection walkaround'
        });
        toast('Tech inspection camera', 'success');
        return true;
      }
      return false;
    };
    if (start()) return;
    if (window.msLoadScript) {
      window.msLoadScript('js/modules/video-studio.js?v=20260826_video_fix_v2').then(function () {
        if (!start()) toast('Could not open the tech camera', 'error');
      });
    }
  }
  global.svcOpenTechVideoWalkaround = openTechWalkaround;

  function wrapVideo() {
    if (typeof global.svcOpenVideoWalkaround !== 'function' || global.svcOpenVideoWalkaround.__msSplit) return;
    const orig = global.svcOpenVideoWalkaround;
    global.svcOpenVideoWalkaround = function (roId, contactId) {
      const inCheckin = !!document.getElementById('svc-checkin-modal');
      if (inCheckin && !roId) {
        ensurePanel();
        const start = document.getElementById('svc-in-video-start');
        if (start) start.click();
        toast('Record the arrival video here — do not leave check-in', 'info');
        return;
      }
      openTechWalkaround(roId, contactId);
    };
    global.svcOpenVideoWalkaround.__msSplit = true;
  }

  function relabelButtons() {
    document.querySelectorAll('button').forEach(function (btn) {
      const label = (btn.textContent || '').trim();
      if (btn.dataset.msTechVid) return;
      if (label === 'Video Walkaround' && !document.getElementById('svc-checkin-modal')) {
        btn.dataset.msTechVid = '1';
        btn.textContent = 'Tech video walkaround';
      }
      if (label === 'Record video walkaround') {
        btn.dataset.msTechVid = '1';
        btn.textContent = 'Record check-in video';
      }
    });
  }

  function enhance() {
    wrapVideo();
    if (document.getElementById('svc-checkin-modal')) ensurePanel();
    relabelButtons();
  }

  const tick = setInterval(enhance, 500);
  setTimeout(function () { clearInterval(tick); enhance(); }, 20000);
})(window);
