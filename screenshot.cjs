const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--use-gl=egl']
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  await context.addInitScript(() => {
    localStorage.setItem('robosim-auth', JSON.stringify({
      state: {
        user: { id: '123', email: 'test@test.com' },
        isAuthenticated: true,
        isLoading: false,
        profile: { full_name: 'Test User', tier: 'free' }
      },
      version: 0
    }));
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(8000);

  // Screenshot
  await page.screenshot({ path: '/tmp/simulation.png', fullPage: false });

  console.log('Screenshot saved to /tmp/simulation.png');
  await browser.close();
})();
