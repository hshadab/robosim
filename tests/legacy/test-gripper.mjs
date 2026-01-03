#!/usr/bin/env node
/**
 * Robot Arm Gripper Test
 *
 * Tests the robot arm picking up a standardized object.
 * Uses Playwright to open a visible browser window you can watch.
 *
 * Run from WSL: node test-gripper.mjs
 */
import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import { mkdir } from 'fs/promises';
import path from 'path';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const DEV_SERVER_URL = 'http://localhost:5173';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Check if server is running
async function isServerRunning() {
  try {
    await fetch(DEV_SERVER_URL);
    return true;
  } catch {
    return false;
  }
}

// Wait for server to be ready
async function waitForServer(maxAttempts = 30) {
  console.log('   Waiting for dev server...');
  for (let i = 0; i < maxAttempts; i++) {
    if (await isServerRunning()) {
      return true;
    }
    await wait(1000);
    process.stdout.write('.');
  }
  console.log('');
  return false;
}

// Take screenshot with timestamp
async function screenshot(page, name) {
  const filename = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 Screenshot: ${name}.png`);
  return filename;
}

async function runGripperTest() {
  let browser = null;
  let devServer = null;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ROBOT ARM GRIPPER TEST                             ║');
  console.log('║   Testing pickup of standardized object                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Create screenshot directory
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Step 1: Check/start dev server
    console.log('Step 1: Checking dev server...');
    if (await isServerRunning()) {
      console.log('   ✓ Dev server already running');
    } else {
      console.log('   Starting dev server...');
      devServer = spawn('npm', ['run', 'dev', '--', '--host'], {
        cwd: PROJECT_DIR,
        stdio: 'pipe',
        detached: true,
      });

      if (!await waitForServer(30)) {
        throw new Error('Dev server failed to start. Run "npm run dev" manually first.');
      }
      console.log('');
      console.log('   ✓ Dev server started');
    }

    // Step 2: Launch browser
    console.log('');
    console.log('Step 2: Launching browser...');

    // Try Edge first (works best from WSL), then Chrome, then Chromium
    let launchOptions = {
      headless: false,
      args: [
        '--start-maximized',
        '--enable-webgl',
        '--use-gl=angle',
        '--enable-gpu-rasterization',
      ]
    };

    try {
      // Try Edge first (best for WSL2)
      browser = await chromium.launch({ ...launchOptions, channel: 'msedge' });
      console.log('   ✓ Launched Microsoft Edge');
    } catch {
      try {
        // Try Chrome
        browser = await chromium.launch({ ...launchOptions, channel: 'chrome' });
        console.log('   ✓ Launched Google Chrome');
      } catch {
        // Fallback to bundled Chromium
        browser = await chromium.launch(launchOptions);
        console.log('   ✓ Launched Chromium');
      }
    }

    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // Log robot-related console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('pickup') || text.includes('grasp') ||
          text.includes('gripper') || text.includes('IK') ||
          text.includes('approach') || text.includes('lift')) {
        console.log(`   🤖 ${text.slice(0, 100)}`);
      }
    });

    // Step 3: Navigate to app
    console.log('');
    console.log('Step 3: Opening application...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(3000);
    await screenshot(page, '01-landing');
    console.log('   ✓ App loaded');

    // Step 4: Login
    console.log('');
    console.log('Step 4: Logging in...');

    // Click Get Started
    try {
      await page.getByRole('button', { name: /get started/i }).click({ timeout: 5000 });
      console.log('   Clicked "Get Started"');
    } catch {
      try {
        await page.getByRole('button', { name: /try it/i }).click({ timeout: 3000 });
        console.log('   Clicked "Try It"');
      } catch {
        console.log('   No login button found, may already be logged in');
      }
    }
    await wait(2000);

    // Click Quick Demo Login
    try {
      await page.getByRole('button', { name: /quick demo/i }).click({ timeout: 8000 });
      console.log('   Clicked "Quick Demo Login"');
      await wait(3000);
    } catch {
      console.log('   No demo login button, may already be logged in');
    }

    // Dismiss any modals
    for (const btnText of ['skip', 'close', 'got it', 'dismiss']) {
      try {
        await page.getByRole('button', { name: new RegExp(btnText, 'i') }).click({ timeout: 1000 });
      } catch { /* ignore */ }
    }
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, '02-logged-in');
    console.log('   ✓ Login complete');

    // Step 5: Add a standardized object
    console.log('');
    console.log('Step 5: Adding standardized object...');

    // Try to click "Use Standard Object" button
    let objectAdded = false;
    try {
      await page.getByRole('button', { name: /standard object/i }).click({ timeout: 5000 });
      await wait(1500);

      // Click on "Toys" category
      await page.getByText('Toys').click({ timeout: 3000 });
      await wait(1000);

      // Click on "Red Cube" or "Tennis Ball"
      try {
        await page.getByText('Red Cube').click({ timeout: 2000 });
        console.log('   Added Red Cube');
        objectAdded = true;
      } catch {
        await page.getByText('Tennis Ball').click({ timeout: 2000 });
        console.log('   Added Tennis Ball');
        objectAdded = true;
      }
      await wait(2000);
    } catch (e) {
      console.log(`   Could not add via UI: ${e.message.split('\n')[0]}`);
    }

    // Alternative: Try Objects panel if MinimalTrainFlow isn't visible
    if (!objectAdded) {
      try {
        // Open Tools drawer and find Objects panel
        await page.getByText('Objects').click({ timeout: 3000 });
        await wait(1000);
        await page.getByText('Red Cube').click({ timeout: 2000 });
        objectAdded = true;
        console.log('   Added Red Cube via Objects panel');
      } catch {
        console.log('   Could not add object - will try with existing scene');
      }
    }

    await screenshot(page, '03-object-added');

    // Step 6: Find chat input and send pickup command
    console.log('');
    console.log('Step 6: Sending pickup command...');
    console.log('');
    console.log('   ╔════════════════════════════════════════════╗');
    console.log('   ║  WATCH THE ROBOT ARM IN THE BROWSER!       ║');
    console.log('   ╚════════════════════════════════════════════╝');
    console.log('');

    // Find chat input
    let commandSent = false;
    const pickupCommand = objectAdded ? 'Pick up the red cube' : 'Pick up the nearest object';

    // Try different input selectors
    for (const selector of [
      'input[type="text"]',
      'textarea',
      '[placeholder*="Tell"]',
      '[placeholder*="Pick"]',
      '[placeholder*="Type"]',
    ]) {
      try {
        const input = page.locator(selector).first();
        await input.click({ timeout: 2000 });
        await input.fill(pickupCommand);
        await page.keyboard.press('Enter');
        commandSent = true;
        console.log(`   ✓ Sent: "${pickupCommand}"`);
        break;
      } catch { /* try next */ }
    }

    if (!commandSent) {
      console.log('   ⚠ Could not find chat input - you can type manually in the browser');
    }

    await screenshot(page, '04-command-sent');

    // Step 7: Watch the pickup sequence
    console.log('');
    console.log('Step 7: Capturing pickup sequence...');
    console.log('');

    // Take screenshots during the pickup motion
    const phases = [
      { time: 2, name: '05-approaching' },
      { time: 4, name: '06-reaching' },
      { time: 6, name: '07-gripper-open' },
      { time: 8, name: '08-contact' },
      { time: 10, name: '09-gripping' },
      { time: 12, name: '10-lifting' },
      { time: 14, name: '11-lifted' },
      { time: 16, name: '12-final' },
    ];

    for (const phase of phases) {
      await wait(2000);
      await screenshot(page, phase.name);
    }

    // Final result screenshot
    await wait(2000);
    await screenshot(page, '13-result');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST COMPLETE                             ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Screenshots saved to: test-screenshots/                     ║');
    console.log('║                                                              ║');
    console.log('║  Files:                                                      ║');
    console.log('║    01-landing.png       - Initial page                       ║');
    console.log('║    02-logged-in.png     - After login                        ║');
    console.log('║    03-object-added.png  - Object in scene                    ║');
    console.log('║    04-command-sent.png  - Pickup command sent                ║');
    console.log('║    05-13-*.png          - Pickup sequence                    ║');
    console.log('║                                                              ║');
    console.log('║  Browser will stay open for 2 minutes.                       ║');
    console.log('║  Press Ctrl+C to close earlier.                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Keep browser open for observation
    await wait(120000);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');

    if (error.message.includes('Executable')) {
      console.log('Browser not found. Try one of these options:');
      console.log('');
      console.log('  Option 1: Install Edge/Chrome on Windows (WSL will use it)');
      console.log('  Option 2: Run: npx playwright install chromium');
      console.log('  Option 3: Start the app manually and open in your browser:');
      console.log('            npm run dev');
      console.log('            Then open http://localhost:5173');
      console.log('');
    }

    // Open in Windows browser as fallback
    try {
      execSync('cmd.exe /c start http://localhost:5173', { stdio: 'ignore' });
      console.log('Opened app in Windows browser. Follow these steps:');
      console.log('');
      console.log('  1. Click "Get Started" → "Quick Demo Login"');
      console.log('  2. Click "Skip" on any tutorials');
      console.log('  3. Click "Use Standard Object" → "Toys" → "Red Cube"');
      console.log('  4. Type "Pick up the red cube" and press Enter');
      console.log('  5. Watch the robot arm pick up the cube!');
      console.log('');
    } catch { /* ignore */ }

    await wait(30000);
  } finally {
    if (browser) {
      await browser.close();
    }

    // Don't kill dev server - user might want it running
    console.log('');
    console.log('Done! Dev server is still running at http://localhost:5173');
  }
}

runGripperTest();
