import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://tamtamcorp.tech'
const paths = [
  '/OurTeam', '/our-team', '/Team',
  '/Contact', '/StartConversation', '/start-conversation',
  '/Services', '/our-services',
  '/LeadGenerator', '/lead-generator', '/aibo', '/AI-bo',
  '/Demo', '/demo', '/live-demo',
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

for (const path of paths) {
  const page = await browser.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 12000 }).catch(() => {})
  const result = await page.evaluate(() => {
    document.querySelectorAll('script,style,svg,noscript').forEach(el => el.remove())
    const text = document.body?.innerText?.trim() ?? ''
    const is404 = text.includes('404') || text.includes('Page Not Found')
    return { is404, preview: text.slice(0, 200) }
  })
  if (!result.is404) {
    console.log(`\n✅ FOUND: ${path}`)
    console.log(result.preview)
  }
  await page.close()
}

await browser.close()
console.log('\nDone.')
