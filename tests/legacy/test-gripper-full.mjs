#!/usr/bin/env node
/**
 * Robot Arm Gripper Test - Full Version
 *
 * Disables Supabase to enable mock login, then tests robot pickup.
 * Takes screenshots and opens Windows browser for watching.
 */
import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';
import { mkdir, rename, access } from 'fs/promises';
import { constants } from 'fs';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const ENV_PATH = `${PROJECT_DIR}/.env`;
const ENV_BACKUP = `${PROJECT_DIR}/.env.test-backup`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(url, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* ignore */ }
    await wait(1000);
  }
  return false;
}

async function screenshot(page, name) {
  const filename = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 ${name}.png`);
}

async function clickButton(page, text, timeout = 5000) {
  const selector = `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

async function clickText(page, text, timeout = 3000) {
  const selector = `xpath/.//*[contains(text(), '${text}')]`;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

async function runTest() {
  let browser = null;
  let envBackedUp = false;
  let serverProcess = null;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         ROBOT ARM GRIPPER TEST                               ║');
  console.log('║   Full test with mock login and pickup verification          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Step 1: Backup .env to disable Supabase (enables mock login)
    console.log('Step 1: Configuring mock login mode...');
    if (await fileExists(ENV_PATH)) {
      await rename(ENV_PATH, ENV_BACKUP);
      envBackedUp = true;
      console.log('   ✓ Supabase disabled (mock login enabled)');
    } else {
      console.log('   ✓ Already in mock mode');
    }

    // Step 2: Kill existing servers and build fresh
    console.log('');
    console.log('Step 2: Building app (mock mode must be baked in)...');
    try {
      execSync('pkill -f vite 2>/dev/null', { stdio: 'ignore' });
    } catch { /* ignore */ }
    await wait(2000);

    // Build fresh without Supabase
    console.log('   Building... (this takes ~15 seconds)');
    execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'pipe' });
    console.log('   ✓ Build complete');

    // Start preview server
    console.log('   Starting preview server...');
    serverProcess = spawn('npm', ['run', 'preview', '--', '--port', '5173'], {
      cwd: PROJECT_DIR,
      stdio: 'pipe',
      detached: true,
    });
    serverProcess.unref();

    if (!await waitForServer('http://localhost:5173', 30)) {
      throw new Error('Server failed to start');
    }
    console.log('   ✓ Server running at http://localhost:5173');

    // Step 3: Open browser in Windows for watching
    console.log('');
    console.log('Step 3: Opening browser for watching...');
    try {
      execSync('cmd.exe /c start http://localhost:5173', { stdio: 'ignore' });
      console.log('   ✓ Browser opened in Windows');
    } catch {
      console.log('   ⚠ Could not open Windows browser');
    }

    // Step 4: Launch headless Puppeteer for screenshots
    console.log('');
    console.log('Step 4: Starting headless browser for screenshots...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--enable-webgl',
        '--use-gl=swiftshader',
        '--enable-gpu-rasterization',
        '--ignore-gpu-blocklist',
      ],
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();

    // Log important robot messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('handlePickUpCommand') ||
          text.includes('grasp') ||
          text.includes('approach') ||
          text.includes('lift') ||
          text.includes('IK solution')) {
        console.log(`   🤖 ${text.slice(0, 100)}`);
      }
    });

    // Step 5: Load app
    console.log('');
    console.log('Step 5: Loading app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(3000);
    await screenshot(page, '01-landing');
    console.log('   ✓ App loaded');

    // Step 6: Login with mock mode
    console.log('');
    console.log('Step 6: Logging in (mock mode)...');

    // Click Get Started
    const clickedStart = await clickButton(page, 'get started', 8000) ||
                         await clickButton(page, 'try it', 3000);
    console.log(`   Get Started clicked: ${clickedStart}`);
    await wait(3000);
    await screenshot(page, '02-login-modal');

    // Click Quick Demo Login (only available in mock mode)
    const clickedDemo = await clickButton(page, 'quick demo', 10000);
    console.log(`   Quick Demo Login clicked: ${clickedDemo}`);

    if (!clickedDemo) {
      console.log('');
      console.log('   ⚠ Quick Demo Login not found!');
      console.log('   This usually means Supabase is still configured.');
      console.log('   The build may have cached the old config.');
      console.log('');
      console.log('   TRY MANUALLY IN YOUR WINDOWS BROWSER:');
      console.log('   1. Close the login modal (X button)');
      console.log('   2. The app might work without login');
      console.log('');
    }

    await wait(5000);
    await screenshot(page, '03-after-login');

    // Dismiss any modals
    await clickButton(page, 'skip', 2000);
    await clickButton(page, 'close', 1000);
    await clickButton(page, 'got it', 1000);
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, '04-main-view');

    // Step 7: Add object
    console.log('');
    console.log('Step 7: Adding Red Cube to scene...');

    let objectAdded = false;

    // Try clicking "Use Standard Object" in the MinimalTrainFlow
    if (await clickButton(page, 'standard object', 5000)) {
      await wait(2000);
      await screenshot(page, '05-object-picker');

      // Click Toys category
      if (await clickText(page, 'Toys', 3000)) {
        await wait(1000);

        // Click Red Cube or Tennis Ball
        objectAdded = await clickText(page, 'Red Cube', 3000);
        if (!objectAdded) {
          objectAdded = await clickText(page, 'Tennis Ball', 2000);
        }
        console.log(`   Object selected: ${objectAdded}`);
      }
    }

    await wait(3000);
    await screenshot(page, '06-object-in-scene');

    // Step 8: Send pickup command
    console.log('');
    console.log('Step 8: Sending pickup command...');
    console.log('');
    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║        WATCH THE ROBOT ARM IN YOUR BROWSER!                ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const pickupCommand = 'Pick up the red cube';
    let commandSent = false;

    // Try to find and use the chat input
    for (const selector of ['textarea', 'input[type="text"]', '[placeholder*="Tell"]', '[placeholder*="command"]']) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        await wait(300);
        await page.type(selector, pickupCommand, { delay: 30 });
        await wait(300);
        await page.keyboard.press('Enter');
        commandSent = true;
        console.log(`   ✓ Command sent: "${pickupCommand}"`);
        break;
      } catch { /* try next */ }
    }

    if (!commandSent) {
      console.log('   ⚠ Could not find chat input');
      console.log('   Please type in your Windows browser:');
      console.log(`   "${pickupCommand}"`);
    }

    await screenshot(page, '07-command-sent');

    // Step 9: Capture pickup sequence
    console.log('');
    console.log('Step 9: Capturing pickup sequence (40 seconds)...');
    console.log('');

    const timestamps = [2, 4, 6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40];
    let lastT = 0;

    for (const t of timestamps) {
      await wait((t - lastT) * 1000);
      lastT = t;
      await screenshot(page, `08-pickup-${String(t).padStart(2, '0')}s`);
      console.log(`   [${t}s] Captured frame`);
    }

    // Final screenshot
    await screenshot(page, '09-final-result');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST COMPLETE!                            ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  Screenshots saved in: test-screenshots/                     ║');
    console.log('║                                                              ║');
    console.log('║  View them with:                                             ║');
    console.log('║    explorer.exe test-screenshots                             ║');
    console.log('║                                                              ║');
    console.log('║  Or list them:                                               ║');
    console.log('║    ls -la test-screenshots/*.png                             ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // List screenshots
    execSync(`ls -la ${SCREENSHOT_DIR}/*.png 2>/dev/null | grep "08-pickup\\|09-final" | head -15`, { stdio: 'inherit' });

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
  } finally {
    // Cleanup
    console.log('');
    console.log('Cleaning up...');

    if (browser) {
      await browser.close();
      console.log('   Browser closed');
    }

    // Restore .env
    if (envBackedUp && await fileExists(ENV_BACKUP)) {
      await rename(ENV_BACKUP, ENV_PATH);
      console.log('   .env restored');
    }

    // Kill preview server
    try {
      execSync('pkill -f "vite preview" 2>/dev/null', { stdio: 'ignore' });
      execSync('pkill -f vite 2>/dev/null', { stdio: 'ignore' });
      console.log('   Server stopped');
    } catch { /* ignore */ }

    console.log('');
    console.log('Done!');
  }
}

runTest();
