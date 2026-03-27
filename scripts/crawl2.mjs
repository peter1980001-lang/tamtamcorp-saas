import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://tamtamcorp.tech'
const paths = ['/SelectiveOutreach', '/process', '/demo', '/Demo', '/resources']

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

for (const path of paths) {
  const page = await browser.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
  const content = await page.evaluate(() => {
    document.querySelectorAll('script,style,svg,noscript').forEach(el => el.remove())
    return document.body?.innerText?.trim().slice(0, 800) ?? ''
  })
  console.log(`\n--- ${path} ---`)
  console.log(content)
  await page.close()
}

await browser.close()
