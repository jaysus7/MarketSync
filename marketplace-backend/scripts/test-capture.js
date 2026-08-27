import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  console.log('Playwright Chromium launched successfully')
  await browser.close()
}

main().catch(err => console.error(err))
