import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'https://tamtamcorp.tech'
const paths = ['/Services', '/OurServices', '/our-services', '/WhatWeBuild', '/what-we-build', '/solutions', '/Solutions', '/products', '/Products']

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })

for (const path of paths) {
  const page = await browser.newPage()
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
  const result = await page.evaluate(() => {
    document.querySelectorAll('script,style,svg,noscript').forEach(el => el.remove())
    const text = document.body?.innerText?.trim() ?? ''
    return { is404: text.includes('Page Not Found'), preview: text.slice(0, 150) }
  })
  if (!result.is404) {
    console.log(`✅ FOUND: ${path}`)
    console.log(result.preview)
  }
  await page.close()
}

await browser.close()
console.log('Done.')
