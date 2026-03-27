import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

const page = await browser.newPage()
await page.goto('https://tamtamcorp.tech/resources', { waitUntil: 'networkidle2', timeout: 20000 })
const content = await page.evaluate(() => {
  document.querySelectorAll('script,style,svg,noscript').forEach(el => el.remove())
  return document.body?.innerText?.trim() ?? ''
})
console.log(content)
await page.close()
await browser.close()
