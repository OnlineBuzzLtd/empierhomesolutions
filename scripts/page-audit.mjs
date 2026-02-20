import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:3000';
const routes = [
  '/',
  '/demo-routes',
  '/lp/boiler-repair/uxbridge',
  '/lp/boiler-repair/hayes',
  '/lp/boiler-installation/uxbridge',
  '/lp/boiler-installation/hayes',
  '/finance',
  '/about-trust',
];

const checks = {
  '/': ['Empire Home Solutions', 'Book Now', '01895 725 151', '07340 020 938', 'info@empirehomesolutions.co.uk'],
  '/lp/boiler-repair/uxbridge': ['Call Now', 'Book Now', '24/7 emergency call out', 'Finance available over 3, 5, 8, and 10 years'],
  '/lp/boiler-repair/hayes': ['Call Now', 'Book Now', '24/7 emergency call out', 'Finance available over 3, 5, 8, and 10 years'],
  '/lp/boiler-installation/uxbridge': ['Call Now', 'Book Now', 'Guaranteed for up to 10 years', '£1,995 - £5,000'],
  '/lp/boiler-installation/hayes': ['Call Now', 'Book Now', 'Guaranteed for up to 10 years', '£1,995 - £5,000'],
  '/finance': ['Boiler Finance Options', '3, 5, 8, and 10 years', 'Interest rates are discussed during your quote appointment'],
  '/about-trust': ['Heating and Gas Engineers', '01895 725 151', '07340 020 938', 'info@empirehomesolutions.co.uk'],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
const page = await context.newPage();
page.setDefaultNavigationTimeout(120000);

let failed = 0;

for (const route of routes) {
  const url = `${base}${route}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 120000 });
  const content = await page.locator('body').innerText();
  const missing = (checks[route] ?? []).filter((text) => !content.includes(text));
  const screenshotPath = `test-results/manual-audit-${route.replace(/[^a-z0-9]+/gi, '_')}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });

  if (missing.length) {
    failed += 1;
    console.log(`FAIL ${route}`);
    for (const text of missing) {
      console.log(`  - missing: ${text}`);
    }
  } else {
    console.log(`PASS ${route}`);
  }
  console.log(`  screenshot: ${screenshotPath}`);
}

await browser.close();

if (failed > 0) {
  process.exit(1);
}
