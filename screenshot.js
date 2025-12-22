const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  
  // Wait for the 3D scene to render
  await page.waitForTimeout(3000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/simulation.png', fullPage: false });
  
  console.log('Screenshot saved to /tmp/simulation.png');
  await browser.close();
})();
