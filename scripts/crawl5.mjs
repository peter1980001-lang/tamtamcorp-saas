import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://tamtamcorp.tech'
const paths = ['/OurTeam', '/StartConversation', '/LeadGenerator']

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

for (const path of paths) {
  const page = await browser.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {})
  const content = await page.evaluate(() => {
    document.querySelectorAll('script,style,svg,noscript').forEach(el => el.remove())
    return document.body?.innerText?.trim() ?? ''
  })
  console.log(`\n${'='.repeat(60)}`)
  console.log(`PAGE: ${path}`)
  console.log('='.repeat(60))
  console.log(content)
  await page.close()
}

await browser.close()
