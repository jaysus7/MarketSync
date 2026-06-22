// background.js
const API = 'https://vehicle-marketplace-s0e4.onrender.com'
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Record a listing as posted
  if (msg.type === 'LISTING_POSTED') {
    chrome.storage.local.get(['token'], async ({ token }) => {
      if (!token) {
        sendResponse({ success: false, error: 'Not signed in' })
        return
      }
      try {
        const r = await fetch(`${API}/listings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            inventory_id: msg.inventory_id,
            fb_listing_id: msg.fb_listing_id || null,
            fb_listing_url: msg.fb_listing_url || null
          })
        })
        if (!r.ok) {
          const body = await r.text().catch(() => '')
          console.error(`POST /listings failed: ${r.status}`, body)
          sendResponse({ success: false, status: r.status, error: body || `HTTP ${r.status}` })
          return
        }
        sendResponse({ success: true })
      } catch (e) {
        console.error('POST /listings threw:', e)
        sendResponse({ success: false, error: e.message })
      }
    })
    return true
  }

  // Download all vehicle photos
  if (msg.type === 'DOWNLOAD_PHOTOS') {
    const { imageUrls } = msg
    const downloadIds = []

    if (!chrome.downloads) {
      console.error('chrome.downloads not available')
      sendResponse({ success: false, error: 'Downloads API not available' })
      return true
    }

    const doDownloads = async () => {
      for (let i = 0; i < imageUrls.length; i++) {
        const url = `${API}/proxy-image?url=${encodeURIComponent(imageUrls[i])}`
        const filename = `WellandChev_Temp/photo_${String(i + 1).padStart(2, '0')}.jpg`
        await new Promise(resolve => {
          chrome.downloads.download(
            { url, filename, saveAs: false, conflictAction: 'overwrite' },
            id => {
              const err = chrome.runtime.lastError
              if (err) console.warn(`Download ${i+1} failed:`, err.message)
              else if (id) downloadIds.push(id)
              resolve()
            }
          )
        })
        await new Promise(r => setTimeout(r, 400))
      }
      console.log(`✅ Downloaded ${downloadIds.length}/${imageUrls.length} photos`)
      sendResponse({ success: true, downloadIds })
    }

    doDownloads()
    return true
  }

  // Delete temp photos after upload
  if (msg.type === 'DELETE_TEMP_PHOTOS') {
    const { downloadIds } = msg
    if (downloadIds?.length) {
      downloadIds.forEach(id => {
        chrome.downloads.removeFile(id, () => {
          chrome.downloads.erase({ id })
        })
      })
    }
    sendResponse({ success: true })
    return true
  }

  // ── EXTENSION-SIDE DEALER SITE CAPTURE ───────────────────────────────────
  // Pipeline: popup → background → permission grant → open tab → content
  //           script extracts → background forwards to MarketSync backend.
  // Bypasses Cloudflare / bot detection by using the user's own authenticated
  // Chrome session for the dealer-site fetches.

  // Step 1: popup asks us to register a new dealer site. We request host
  // permission for that origin so the dealer-extract content script can run.
  if (msg.type === 'CONNECT_DEALER_SITE') {
    (async () => {
      try {
        const origin = new URL(msg.url).origin + '/*'
        // The popup already requested this permission (it has the user gesture MV3
        // needs). Here we only verify it's present — requesting from a service worker
        // silently fails, which is what made the button look stuck.
        const has = await chrome.permissions.contains({ origins: [origin] })
        if (!has) {
          // needsEnable tells the dashboard to prompt the one-time "Enable one-click
          // capture" grant in the extension (web pages / service workers can't request
          // host permissions themselves — only an extension UI with a user gesture can).
          sendResponse({ success: false, needsEnable: true, error: 'Site access not granted. Open the MarketSync extension and click "Enable one-click capture", then try again.' })
          return
        }
        // Persist an in-progress marker so the (ephemeral) popup can show the true
        // status when it reopens — the capture runs in the background and outlives
        // the popup, so without this it looks like it "reset" to idle.
        await chrome.storage.local.set({
          captureState: { feedId: msg.feed_id || null, status: 'pulling', startedAt: Date.now() }
        })
        // Open the dealer site in a new tab. Once it loads, we inject the
        // extractor with msg.feed_id stashed on window so the content script
        // can include it when it phones home.
        const tab = await chrome.tabs.create({ url: msg.url, active: false })

        const onUpdated = (tabId, info) => {
          if (tabId !== tab.id || info.status !== 'complete') return
          chrome.tabs.onUpdated.removeListener(onUpdated)
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (feedId) => { window.__marketsyncFeedId = feedId },
            args: [msg.feed_id || null]
          }).then(() => chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dealer-extract.js']
          })).catch(err => console.error('extract injection failed:', err))
        }
        chrome.tabs.onUpdated.addListener(onUpdated)

        sendResponse({ success: true, tab_id: tab.id })
      } catch (e) {
        sendResponse({ success: false, error: e.message })
      }
    })()
    return true
  }

  // Progress pings from the dealer-extract content script while it paginates the
  // dealer's inventory. We mirror them into captureState so the popup shows a %.
  if (msg.type === 'CAPTURE_PROGRESS') {
    const total = Number(msg.total) || 0
    const current = Number(msg.current) || 0
    const pct = total > 0 ? Math.min(95, Math.round((current / total) * 100)) : null
    chrome.storage.local.set({
      captureState: {
        feedId: msg.feed_id || null, status: 'pulling', phase: msg.phase || 'scanning',
        current, total, pct, startedAt: Date.now()
      }
    })
    return false  // no response needed
  }

  // Step 2: content script (dealer-extract.js) posts the scraped vehicles
  // back to us. We forward to MarketSync's /feeds/:id/extension-capture.
  if (msg.type === 'DEALER_INVENTORY_CAPTURED') {
    chrome.storage.local.get(['token'], async ({ token }) => {
      const setState = (s) => chrome.storage.local.set({
        captureState: { feedId: msg.feed_id || null, finishedAt: Date.now(), ...s }
      })
      if (!token) {
        await setState({ status: 'error', error: 'Not signed in to MarketSync' })
        sendResponse({ success: false, error: 'Not signed in to MarketSync' })
        return
      }
      // The extractor found nothing — surface that instead of a silent 0-vehicle upload.
      if (!Array.isArray(msg.vehicles) || msg.vehicles.length === 0) {
        await setState({ status: 'error', error: msg.error || 'No inventory detected on that page.' })
        sendResponse({ success: false, error: msg.error || 'No inventory detected on that page.' })
        return
      }
      try {
        const r = await fetch(`${API}/feeds/${encodeURIComponent(msg.feed_id)}/extension-capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            vehicles: msg.vehicles,
            source_url: msg.source_url,
            platform: msg.platform || 'extension_capture'
          })
        })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) {
          console.error('extension-capture upload failed:', r.status, body)
          await setState({ status: 'error', error: body.error || `Upload failed (HTTP ${r.status})` })
          sendResponse({ success: false, status: r.status, error: body.error || `HTTP ${r.status}` })
          return
        }
        await setState({ status: 'done', count: body.upserted ?? msg.vehicles.length })
        sendResponse({ success: true, ...body })
        // Auto-close the tab we opened (only if it's not the user's active tab)
        if (sender.tab?.id) {
          chrome.tabs.get(sender.tab.id, (t) => {
            if (t && !t.active) chrome.tabs.remove(sender.tab.id).catch(() => {})
          })
        }
      } catch (e) {
        console.error('extension-capture threw:', e)
        await setState({ status: 'error', error: e.message })
        sendResponse({ success: false, error: e.message })
      }
    })
    return true
  }
})
