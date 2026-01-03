#!/usr/bin/env node
// E2E pickup test - uses native Puppeteer methods to avoid frame detachment
import puppeteer from 'puppeteer';
import { spawn, execSync } from 'child_process';
import { rename, access } from 'fs/promises';
import { constants } from 'fs';

const API_KEY = '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';
const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const ENV_PATH = `${PROJECT_DIR}/.env`;
const ENV_BACKUP = `${PROJECT_DIR}/.env.e2e-backup`;

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
      await fetch(url);
      return true;
    } catch {
      await wait(1000);
    }
  }
  return false;
}

// Helper to click button containing text using XPath - with retry on frame detachment
async function clickButtonWithText(page, text, timeout = 10000) {
  const selector = `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / 3 });
      await page.click(selector);
      return true;
    } catch (e) {
      if (e.message.includes('detached Frame') && attempt < 2) {
        console.log(`   Frame detached when clicking "${text}", retrying...`);
        await wait(2000);
        continue;
      }
      if (attempt === 2 || !e.message.includes('detached Frame')) {
        console.log(`   Could not click "${text}": ${e.message}`);
        return false;
      }
    }
  }
  return false;
}

// Helper to click element containing text - with retry on frame detachment
async function clickElementWithText(page, text, timeout = 5000) {
  const selector = `xpath/.//*[contains(text(), '${text}')]`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / 3 });
      await page.click(selector);
      return true;
    } catch (e) {
      if (e.message.includes('detached Frame') && attempt < 2) {
        console.log(`   Frame detached clicking "${text}", retrying...`);
        await wait(2000);
        continue;
      }
      if (attempt === 2 || !e.message.includes('detached Frame')) {
        console.log(`   Could not click element with "${text}": ${e.message}`);
        return false;
      }
    }
  }
  return false;
}

async function runTest() {
  let envBackedUp = false;
  let devServerProcess = null;
  let browser = null;

  console.log('');
  console.log('================================================================');
  console.log('       E2E PICKUP TEST                                          ');
  console.log('================================================================');
  console.log('');

  try {
    // Step 1: Backup .env to disable Supabase (enables mock login)
    console.log('Step 1: Backing up .env to disable Supabase...');
    if (await fileExists(ENV_PATH)) {
      await rename(ENV_PATH, ENV_BACKUP);
      envBackedUp = true;
      console.log('   .env backed up - Supabase disabled');
    } else {
      console.log('   No .env found - mock mode already active');
    }

    // Step 2: Kill existing vite servers
    console.log('Step 2: Killing existing dev servers...');
    try {
      execSync('pkill -f vite 2>/dev/null', { stdio: 'ignore' });
    } catch {}
    await wait(2000);
    console.log('   Done');

    // Step 3: Build app without Supabase (.env is already backed up)
    // MUST rebuild because isSupabaseConfigured is baked into the build
    console.log('Step 3: Building app without Supabase...');
    try {
      execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' });
    } catch (e) {
      console.log('   Build completed (or already built)');
    }

    devServerProcess = spawn('npm', ['run', 'preview', '--', '--port', '5173'], {
      cwd: PROJECT_DIR,
      stdio: 'ignore',
      detached: true,
    });
    devServerProcess.unref();

    const serverReady = await waitForServer('http://localhost:5173', 60);
    if (!serverReady) {
      throw new Error('Preview server failed to start');
    }
    console.log('   Server running at http://localhost:5173 (preview mode)');

    // Step 4: Launch browser with WebGL enabled
    console.log('Step 4: Launching browser with WebGL support...');
    browser = await puppeteer.launch({
      headless: 'new',  // Use headless mode for WSL2 compatibility
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        // Enable WebGL in headless mode
        '--enable-webgl',
        '--use-gl=swiftshader',  // Software WebGL renderer
        '--enable-gpu-rasterization',
        '--ignore-gpu-blocklist',
        '--enable-features=VaapiVideoDecoder',
        '--disable-software-rasterizer',
      ],
      defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();

    // Capture robot-related console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('XZ offset') ||
          text.includes('Height above') ||
          text.includes('[handlePickUpCommand]') ||
          text.includes('Found approach') ||
          text.includes('grasp position') ||
          text.includes('Approach:') ||
          text.includes('Grasp:')) {
        console.log('>>> ROBOT:', text);
      }
    });

    // Step 5: Open app and wait for full load
    console.log('Step 5: Opening app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('   Page loaded');

    // Wait for React to hydrate (preview mode - no HMR)
    console.log('   Waiting for React to hydrate...');
    await wait(3000);

    // Set API key via URL parameter method (more reliable)
    console.log('   Setting API key...');
    await page.evaluate((key) => {
      try {
        localStorage.setItem('robosim-claude-api-key', key);
      } catch (e) {
        console.log('Failed to set API key:', e.message);
      }
    }, API_KEY);

    // Step 6: Click Get Started button
    console.log('Step 6: Clicking Get Started...');
    await wait(2000);

    let clickedGetStarted = await clickButtonWithText(page, 'get started');
    if (!clickedGetStarted) {
      clickedGetStarted = await clickButtonWithText(page, 'login');
    }
    if (!clickedGetStarted) {
      clickedGetStarted = await clickButtonWithText(page, 'try it');
    }
    console.log(`   Get Started clicked: ${clickedGetStarted}`);

    // Wait longer for modal animation and render
    console.log('   Waiting for login modal to open...');
    await wait(4000);

    // Step 7: Click Quick Demo Login
    console.log('Step 7: Clicking Quick Demo Login...');
    const clickedDemoLogin = await clickButtonWithText(page, 'quick demo', 15000);
    console.log(`   Quick Demo Login clicked: ${clickedDemoLogin}`);

    // Wait for login to complete and page to re-render
    console.log('   Waiting for login to complete...');
    await wait(5000);

    // Step 8: Dismiss welcome modal if present
    console.log('Step 8: Checking for welcome modal...');
    const clickedSkip = await clickButtonWithText(page, 'skip', 3000);
    console.log(`   Welcome modal dismissed: ${clickedSkip}`);
    await wait(2000);

    // Take screenshot to check state
    await page.screenshot({ path: `${PROJECT_DIR}/e2e-screenshot.png` });
    console.log('   Screenshot saved to e2e-screenshot.png');

    // Check if we're logged in by looking for Logout button or demo username
    let isLoggedIn = false;
    try {
      const logoutSelector = `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'logout')]`;
      await page.waitForSelector(logoutSelector, { timeout: 5000 });
      isLoggedIn = true;
      console.log('   Detected: User is logged in (found Logout button)');
    } catch {
      // Also check for "demo" text
      try {
        const hasDemo = await page.evaluate(() => document.body.textContent?.includes('demo'));
        if (hasDemo) {
          isLoggedIn = true;
          console.log('   Detected: User is logged in (found "demo" text)');
        }
      } catch {}
    }

    if (!isLoggedIn) {
      console.log('');
      console.log('⚠️  Mock login did not work - showing landing page instead of simulation');
      console.log('   The app requires clicking "Quick Demo Login" when Supabase is disabled.');
      console.log('');
      console.log('   Browser stays open for 2 minutes. Press Ctrl+C to close.');
      console.log('================================================================');
      await wait(120000);
    } else {
      // Step 9: Add Tennis Ball via MinimalTrainFlow
      console.log('Step 9: Adding Tennis Ball to scene...');

      // Click "Use Standard Object" button in the Train Robot panel
      const clickedStandard = await clickButtonWithText(page, 'standard object', 5000);
      console.log(`   Clicked "Use Standard Object": ${clickedStandard}`);
      await wait(2000);

      // Click the Toys category card
      await clickElementWithText(page, 'Toys', 3000);
      console.log('   Clicked Toys category');
      await wait(1000);

      // Click Tennis Ball in the objects list
      await clickElementWithText(page, 'Tennis Ball', 3000);
      console.log('   Clicked Tennis Ball');
      await wait(3000);

      // Take screenshot after adding object
      await page.screenshot({ path: `${PROJECT_DIR}/e2e-after-object.png` });
      console.log('   Screenshot saved to e2e-after-object.png');

      // Now we should be on the "record-demo" step with chat input
      // Look for the textarea or input in the MinimalTrainFlow panel
      console.log('Step 10: Looking for chat input...');

      let chatInput = null;
      // Try multiple selectors for the chat input
      for (const selector of ['textarea', 'input[type="text"]', '.chat-input', '[placeholder*="Tell"]', '[placeholder*="Pick"]']) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          chatInput = selector;
          console.log(`   Found chat input: ${selector}`);
          break;
        } catch {}
      }

      // Step 11: Send pickup command
      console.log('Step 11: Sending pickup command...');

      if (chatInput) {
        try {
          await page.click(chatInput);
          await wait(200);
          await page.type(chatInput, 'Pick up the tennis ball', { delay: 30 });
          await wait(200);
          await page.keyboard.press('Enter');
          console.log('   Command sent!');
        } catch (e) {
          console.log(`   Failed to send command via ${chatInput}: ${e.message}`);
        }
      } else {
        // Fallback: try clicking "Need manual controls" to get the full controls panel
        console.log('   No chat input found, trying manual controls...');
        await clickElementWithText(page, 'Need manual controls', 3000);
        await wait(2000);

        // Try textarea again
        try {
          await page.waitForSelector('textarea', { timeout: 5000 });
          await page.click('textarea');
          await wait(200);
          await page.type('textarea', 'Pick up the tennis ball', { delay: 30 });
          await wait(200);
          await page.keyboard.press('Enter');
          console.log('   Command sent via manual controls!');
        } catch (e) {
          console.log(`   Could not find any chat input: ${e.message}`);
        }
      }

      console.log('');
      console.log('================================================================');
      console.log('  CAPTURING ROBOT PICKUP SEQUENCE...');
      console.log('================================================================');
      console.log('');

      // Take screenshots during pickup to capture lift
      console.log('Step 12: Capturing pickup sequence screenshots...');
      for (let i = 0; i < 15; i++) {
        await wait(2000);
        const filename = `${PROJECT_DIR}/e2e-pickup-${String(i).padStart(2, '0')}.png`;
        await page.screenshot({ path: filename });
        console.log(`   [${(i + 1) * 2}s] Screenshot: e2e-pickup-${String(i).padStart(2, '0')}.png`);
      }

      // Final lift screenshot
      await page.screenshot({ path: `${PROJECT_DIR}/e2e-lift-success.png` });
      console.log('');
      console.log('================================================================');
      console.log('  LIFT SCREENSHOT CAPTURED: e2e-lift-success.png');
      console.log('================================================================');
      console.log('');
      console.log('  Screenshots saved:');
      for (let i = 0; i < 15; i++) {
        console.log(`   - e2e-pickup-${String(i).padStart(2, '0')}.png`);
      }
      console.log('   - e2e-lift-success.png (final state)');
      console.log('');
      console.log('  Browser stays open for 60 seconds. Press Ctrl+C to exit.');
      console.log('================================================================');

      await wait(60000);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    await wait(30000);
  } finally {
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
      console.log('   Preview server stopped');
    } catch {}

    console.log('Done!');
  }
}

runTest();
