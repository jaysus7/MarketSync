// dashboard-bridge.js — runs on the MarketSync dashboard (marketsync.link).
// Bridges window.postMessage (page) ↔ chrome messaging (extension) so the dashboard
// can launch a Cloudflare browser-capture and show live progress WITHOUT the user
// opening the extension popup. The capture still runs in the extension (only the
// user's browser session gets past Cloudflare); this just lets the dashboard drive it.
(() => {
  const post = (msg) => window.postMessage({ __marketsync: true, dir: 'from-ext', ...msg }, '*')
  const version = (() => { try { return chrome.runtime.getManifest().version } catch { return null } })()

  // Tell the page the extension is installed → dashboard enables its Pull button.
  post({ type: 'EXT_PRESENT', version })

  window.addEventListener('message', (e) => {
    if (e.source !== window) return
    const d = e.data
    if (!d || d.__marketsync !== true || d.dir !== 'from-page') return

    if (d.type === 'PING') { post({ type: 'EXT_PRESENT', version }); return }

    if (d.type === 'PULL_INVENTORY' && d.feedUrl) {
      chrome.runtime.sendMessage(
        { type: 'CONNECT_DEALER_SITE', url: d.feedUrl, feed_id: d.feedId || null },
        (resp) => {
          post({
            type: 'PULL_STARTED',
            feedId: d.feedId || null,
            ok: !!resp?.success,
            error: resp?.error || null,
            needsEnable: !!resp?.needsEnable
          })
        }
      )
    }
  })

  // Relay capture progress (background writes captureState as it runs).
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.captureState) {
        post({ type: 'CAPTURE_STATE', state: changes.captureState.newValue || null })
      }
    })
    chrome.storage.local.get(['captureState'], ({ captureState }) => {
      if (captureState) post({ type: 'CAPTURE_STATE', state: captureState })
    })
  } catch {}
})()
