const { chromium } = require('playwright');

const urls = [
  'https://tamtamcorp.tech/',
  'https://tamtamcorp.tech/AIAutomationConsulting',
  'https://tamtamcorp.tech/AIProductImagery',
  'https://tamtamcorp.tech/About',
  'https://tamtamcorp.tech/BusinessAutomation',
  'https://tamtamcorp.tech/ConsultationQualification',
  'https://tamtamcorp.tech/DataSecurity',
  'https://tamtamcorp.tech/FounderLedImplementation',
  'https://tamtamcorp.tech/HowWeDecide',
  'https://tamtamcorp.tech/LeadGenerator',
  'https://tamtamcorp.tech/LeadQualification',
  'https://tamtamcorp.tech/OurTeam',
  'https://tamtamcorp.tech/PersonaCampaign',
  'https://tamtamcorp.tech/Resources',
  'https://tamtamcorp.tech/SelectiveOutreach',
  'https://tamtamcorp.tech/StartConversation',
  'https://tamtamcorp.tech/SystemArchitectureIntegrations',
  'https://tamtamcorp.tech/WhatsAppAgents',
  'https://tamtamcorp.tech/WhatsAppBotsConsulting',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = {};

  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      const slug = url.replace('https://tamtamcorp.tech/', '') || 'home';
      results[slug] = text.trim();
      console.log(`✓ ${slug}`);
    } catch (e) {
      console.error(`✗ ${url}: ${e.message}`);
    }
  }

  await browser.close();

  const fs = require('fs');
  fs.writeFileSync('crawl-results.json', JSON.stringify(results, null, 2));
  console.log('\nDone! Results saved to crawl-results.json');
})();
