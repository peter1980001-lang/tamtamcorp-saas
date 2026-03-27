import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://tamtamcorp.tech'

const pages = [
  '/',
  '/services',
  '/about',
  '/team',
  '/contact',
  '/lead-generator',
  '/PrivacyPolicy',
  '/Terms',
  '/DataSecurity',
  '/HowWeDecide',
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

for (const path of pages) {
  const url = BASE + path
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})

  const content = await page.evaluate(() => {
    // Remove scripts, styles, svgs
    document.querySelectorAll('script, style, svg, noscript').forEach(el => el.remove())
    return document.body?.innerText?.trim() ?? '(empty)'
  })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`PAGE: ${url}`)
  console.log('='.repeat(60))
  console.log(content.slice(0, 8000))

  await page.close()
}

await browser.close()
