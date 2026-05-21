// content.js
const DELAY = 600
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitFor(fn, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const el = fn()
    if (el) return el
    await sleep(300)
  }
  return null
}

// Get all visible text inputs and textareas
function getFormFields() {
  return [...document.querySelectorAll('input[type="text"], input[type="number"], textarea')]
    .filter(el => !el.closest('[aria-hidden="true"]'))
}

// Type into a field using React-compatible setter
async function typeInto(el, value) {
  if (!el) return false
  el.click()
  el.focus()
  await sleep(200)

  const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  const setter = el.tagName === 'TEXTAREA' ? nativeTextareaSetter : nativeInputSetter

  if (setter) setter.call(el, value)
  else el.value = value

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  await sleep(300)
  return true
}

// Find a field by its nearby label text
function fieldByLabel(labelText) {
  const labels = [...document.querySelectorAll('label, div, span')]
  for (const label of labels) {
    if (label.textContent.trim() === labelText) {
      // Look for an input inside or immediately after
      const input = label.querySelector('input, textarea') ||
        label.nextElementSibling?.querySelector('input, textarea') ||
        label.closest('div')?.querySelector('input, textarea')
      if (input) return input
    }
  }
  return null
}

// Click a dropdown (div with role button or select-like behavior)
async function pickDropdown(labelText, value) {
  // Find the dropdown trigger by nearby label
  const allDivs = [...document.querySelectorAll('div[role="button"], div[role="combobox"]')]
  const trigger = allDivs.find(el => {
    const parent = el.closest('label, [class]')
    return parent?.textContent?.includes(labelText)
  }) || [...document.querySelectorAll('div, span')]
    .find(el => el.textContent.trim() === labelText)

  if (!trigger) {
    console.warn('Dropdown trigger not found:', labelText)
    return false
  }

  trigger.click()
  await sleep(800)

  const option = await waitFor(() =>
    [...document.querySelectorAll('[role="option"]')]
      .find(el => el.textContent.trim().toLowerCase().includes(value.toString().toLowerCase()))
  , 5000)

  if (option) {
    option.click()
    await sleep(500)
    return true
  }

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await sleep(300)
  return false
}

async function uploadImages(imageUrls) {
  if (!imageUrls?.length) return
  const files = []
  for (const url of imageUrls.slice(0, 20)) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const filename = url.split('/').pop().split('?')[0] || 'vehicle.jpg'
      files.push(new File([blob], filename, { type: blob.type || 'image/jpeg' }))
    } catch (e) {
      console.warn('Image fetch failed:', url)
    }
  }
  if (!files.length) return
  const dt = new DataTransfer()
  files.forEach(f => dt.items.add(f))
  const fileInput = document.querySelector('input[type="file"][accept*="image"]')
  if (fileInput) {
    Object.defineProperty(fileInput, 'files', { value: dt.files, writable: false })
    fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    await sleep(2000)
  }
}

async function fillListingForm(vehicle) {
  console.log('🚗 Starting:', vehicle.year, vehicle.make, vehicle.model)
  showStatus('Starting... please don\'t click anything')
  await sleep(2500)

  // VEHICLE TYPE — dropdown (no input, click-based)
  showStatus('Selecting vehicle type...')
  const modelLower = vehicle.model?.toLowerCase() || ''
  let vehicleType = 'Sedan'
  if (['silverado','sierra','ram','f-150','f150','tundra','ranger','colorado','canyon','tacoma','titan','frontier'].some(t => modelLower.includes(t))) vehicleType = 'Truck'
  else if (['equinox','traverse','tahoe','suburban','blazer','trax','trailblazer','terrain','enclave','acadia','yukon','expedition','explorer','escape','edge','pilot'].some(t => modelLower.includes(t))) vehicleType = 'SUV'
  else if (['express','transit','odyssey','sienna','caravan'].some(t => modelLower.includes(t))) vehicleType = 'Minivan'
  await pickDropdown('Vehicle type', vehicleType)
  await sleep(DELAY)

  // YEAR — dropdown
  showStatus('Selecting year...')
  await pickDropdown('Year', String(vehicle.year))
  await sleep(DELAY)

  // MAKE — index 6 (text input, label = "Make")
  showStatus('Filling make...')
  await waitFor(() => {
    const fields = getFormFields()
    return fields.find(f => f.closest('label, div')?.textContent?.includes('Make'))
  })
  const makeEl = getFormFields().find(f => f.closest('label, div')?.textContent?.includes('Make'))
    || fieldByLabel('Make')
  if (makeEl) {
    await typeInto(makeEl, vehicle.make)
    await sleep(500)
    // Accept suggestion if appears
    const opt = document.querySelector('[role="option"]')
    if (opt) { opt.click(); await sleep(400) }
  }
  await sleep(DELAY)

  // MODEL — index 7
  showStatus('Filling model...')
  const modelEl = getFormFields().find(f => f.closest('label, div')?.textContent?.includes('Model'))
    || fieldByLabel('Model')
  if (modelEl) {
    await typeInto(modelEl, vehicle.model)
    await sleep(500)
    const opt = document.querySelector('[role="option"]')
    if (opt) { opt.click(); await sleep(400) }
  }
  await sleep(DELAY)

  // PRICE — index 8
  showStatus('Filling price...')
  const priceEl = getFormFields().find(f => f.closest('label, div')?.textContent?.includes('Price'))
    || fieldByLabel('Price')
  if (priceEl) await typeInto(priceEl, String(Math.round(vehicle.price)))
  await sleep(DELAY)

  // MILEAGE — if present
  showStatus('Filling mileage...')
  const mileageEl = getFormFields().find(f =>
    f.closest('label, div')?.textContent?.includes('Mileage') ||
    f.closest('label, div')?.textContent?.includes('Kilometers')
  )
  if (mileageEl) await typeInto(mileageEl, String(vehicle.mileage || 0))
  await sleep(DELAY)

  // EXTERIOR COLOR
  showStatus('Selecting color...')
  await pickDropdown('Exterior color', vehicle.exterior_color || 'Black')
  await sleep(DELAY)

  // TRANSMISSION
  showStatus('Selecting transmission...')
  await pickDropdown('Transmission', vehicle.transmission || 'Automatic')
  await sleep(DELAY)

  // FUEL TYPE
  showStatus('Selecting fuel type...')
  await pickDropdown('Fuel type', vehicle.fuel_type || 'Gasoline')
  await sleep(DELAY)

  // DESCRIPTION — textarea (index 9)
  showStatus('Writing description...')
  const descEl = await waitFor(() => document.querySelector('textarea'))
  if (descEl) {
    const desc = vehicle.ai_description || vehicle.description ||
      `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''}. ` +
      `${vehicle.mileage ? vehicle.mileage.toLocaleString() + ' km. ' : ''}` +
      `${vehicle.exterior_color ? vehicle.exterior_color + ' exterior. ' : ''}` +
      `${vehicle.transmission || 'Automatic'} transmission. ` +
      `Contact Welland Chev for more info!`
    await typeInto(descEl, desc)
  }
  await sleep(DELAY)

  // IMAGES
  showStatus('Uploading photos...')
  await uploadImages(vehicle.image_urls)

  showStatus('✅ Form filled! Review and click Publish.', 'success')
  console.log('✅ Done')

  chrome.runtime.sendMessage({
    type: 'LISTING_POSTED',
    inventory_id: vehicle.id,
    fb_listing_url: window.location.href
  })
}

function showStatus(message, type = 'info') {
  let overlay = document.getElementById('wc-status')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'wc-status'
    overlay.style.cssText = `
      position:fixed;bottom:20px;right:20px;background:#1a1a1a;
      color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;
      font-family:-apple-system,sans-serif;z-index:999999;
      border:1px solid #333;max-width:280px;
      box-shadow:0 4px 20px rgba(0,0,0,0.4);
    `
    document.body.appendChild(overlay)
  }
  overlay.style.borderColor = type === 'success' ? '#22c55e' : '#3b82f6'
  overlay.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px">${type === 'success' ? '✅' : '⚙️'} Marketplace Lister</div>
    <div style="color:#aaa">${message}</div>
  `
}

if (window.location.href.includes('/marketplace/create/vehicle') ||
    window.location.href.includes('/marketplace/create/')) {
  chrome.storage.local.get(['pendingPost'], ({ pendingPost }) => {
    if (!pendingPost?.vehicle) return
    chrome.storage.local.remove(['pendingPost'])
    setTimeout(() => fillListingForm(pendingPost.vehicle), 2500)
  })
}