import { test, expect } from '@playwright/test';

test('Arm rendering test', async ({ page }) => {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });

  // Navigate to the app
  console.log('Navigating to app...');
  await page.goto('http://localhost:5000/', { waitUntil: 'domcontentloaded' });

  // Call mockLogin via the exposed store
  console.log('Logging in via mockLogin...');
  await page.evaluate(async () => {
    // Access Zustand store via window (exposed in dev)
    const store = (window as any).__ZUSTAND_STORE__ ||
      // Try to get it from React internals
      document.querySelector('#root')?.__reactContainer$?.memoizedState?.element?.props?.value;

    // Fallback: directly set localStorage and reload
    const mockAuthState = {
      state: {
        isAuthenticated: true,
        user: {
          id: 'mock-user-id',
          email: 'test@test.com',
          user_metadata: { full_name: 'Test User' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
        profile: {
          id: 'mock-user-id',
          email: 'test@test.com',
          full_name: 'Test User',
          tier: 'free',
          usage: { episodes_generated: 0, ai_images_generated: 0 },
          usage_reset_at: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
      },
      version: 0,
    };
    localStorage.setItem('robosim-auth', JSON.stringify(mockAuthState));
  });

  // Click the login button and use the modal
  console.log('Clicking Get Started...');
  await page.click('text=GET STARTED');
  await page.waitForTimeout(500);

  // Fill in email and click continue (mock login)
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill('test@test.com');
    await page.click('text=Continue');
    await page.waitForTimeout(1000);
  }

  // Wait for navigation to simulation
  console.log('Waiting for simulation...');

  // Wait for page to settle
  await page.waitForTimeout(1000);

  // Take initial screenshot
  await page.screenshot({ path: 'tests/screenshots/initial.png', fullPage: true });

  // Wait for canvas to appear (simulation page)
  console.log('Waiting for canvas...');
  try {
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('Canvas found!');
  } catch (e) {
    console.log('Canvas NOT found');
    const html = await page.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log('Page HTML:', html);
  }

  // Wait for arm to load (URDF loading takes time)
  await page.waitForTimeout(4000);

  // Take screenshot of simulation
  await page.screenshot({ path: 'tests/screenshots/simulation.png', fullPage: true });

  // Print all console logs
  console.log('\n=== CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));

  // Print errors specifically
  if (consoleErrors.length > 0) {
    console.log('\n=== ERRORS ===');
    consoleErrors.forEach(err => console.log('ERROR:', err));
  }

  // Check if SO101Arm3D logged links found
  const armLog = consoleLogs.find(log => log.includes('[SO101Arm3D]'));
  console.log('\n=== ARM LOADING ===');
  console.log(armLog || 'No arm loading log found');
});
