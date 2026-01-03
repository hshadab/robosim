#!/usr/bin/env node
/**
 * Robot Arm Grab Test
 *
 * Automated test that:
 * 1. Logs in with mock mode
 * 2. Adds a Red Block object
 * 3. Sends pickup command
 * 4. Monitors for errors
 * 5. Captures screenshots of the entire sequence
 */
import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';
import { mkdir, rename, access, writeFile } from 'fs/promises';
import { constants } from 'fs';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const ENV_PATH = `${PROJECT_DIR}/.env`;
const ENV_BACKUP = `${PROJECT_DIR}/.env.grab-test-backup`;
const RESULTS_FILE = `${SCREENSHOT_DIR}/test-results.json`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function fileExists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function waitForServer(url, max = 60) {
  for (let i = 0; i < max; i++) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await wait(1000);
  }
  return false;
}

async function screenshot(page, name, results) {
  const filename = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: filename });
  console.log(`   📸 ${name}`);
  results.screenshots.push(name);
}

// Click helpers with logging
async function clickXPath(page, xpath, desc, timeout = 5000) {
  try {
    await page.waitForSelector(`xpath/${xpath}`, { timeout });
    await page.click(`xpath/${xpath}`);
    console.log(`   ✓ Clicked: ${desc}`);
    return true;
  } catch (e) {
    console.log(`   ✗ Failed to click: ${desc} - ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function clickButton(page, text, timeout = 5000) {
  return clickXPath(page, `.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`, `button "${text}"`, timeout);
}

async function clickText(page, text, timeout = 3000) {
  return clickXPath(page, `.//*[contains(text(), '${text}')]`, `text "${text}"`, timeout);
}

async function runTest() {
  let browser = null;
  let envBackedUp = false;

  const results = {
    success: false,
    startTime: new Date().toISOString(),
    steps: [],
    errors: [],
    consoleMessages: [],
    screenshots: [],
  };

  const addStep = (name, success, details = '') => {
    results.steps.push({ name, success, details, time: new Date().toISOString() });
    console.log(`${success ? '✓' : '✗'} ${name}${details ? ': ' + details : ''}`);
  };

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           ROBOT ARM GRAB TEST                                ║');
  console.log('║   Automated test of pickup functionality                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Step 1: Backup .env for mock login
    console.log('Step 1: Setup mock login mode');
    if (await fileExists(ENV_PATH)) {
      await rename(ENV_PATH, ENV_BACKUP);
      envBackedUp = true;
      addStep('Backup .env', true, 'Mock login enabled');
    } else {
      addStep('Check .env', true, 'Already in mock mode');
    }

    // Step 2: Build app
    console.log('');
    console.log('Step 2: Build app');
    try {
      execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'pipe' });
      addStep('Build', true);
    } catch (e) {
      addStep('Build', false, e.message);
      throw e;
    }

    // Step 3: Start server
    console.log('');
    console.log('Step 3: Start server');
    try { execSync('pkill -f vite', { stdio: 'ignore' }); } catch {}
    await wait(2000);

    const server = spawn('npm', ['run', 'preview', '--', '--port', '5173'], {
      cwd: PROJECT_DIR, stdio: 'pipe', detached: true
    });
    server.unref();

    if (await waitForServer('http://localhost:5173', 30)) {
      addStep('Server start', true, 'http://localhost:5173');
    } else {
      addStep('Server start', false);
      throw new Error('Server failed to start');
    }

    // Step 4: Launch browser
    console.log('');
    console.log('Step 4: Launch browser');
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
    addStep('Browser launch', true, 'Headless mode');

    const page = await browser.newPage();

    // Capture ALL console messages
    page.on('console', msg => {
      const text = msg.text();
      results.consoleMessages.push({
        type: msg.type(),
        text: text.slice(0, 500),
        time: new Date().toISOString()
      });

      // Log important messages
      if (text.includes('Error') || text.includes('error') ||
          text.includes('pickup') || text.includes('grasp') ||
          text.includes('IK') || text.includes('handlePickUp') ||
          text.includes('gripper') || text.includes('lift') ||
          text.includes('[MinimalTrainFlow]') || text.includes('[robotAPI]')) {
        const icon = text.includes('Error') || text.includes('error') ? '❌' : '🤖';
        console.log(`   ${icon} ${text.slice(0, 100)}`);
      }
    });

    // Capture page errors
    page.on('pageerror', err => {
      results.errors.push({ type: 'pageerror', message: err.message, time: new Date().toISOString() });
      console.log(`   ❌ PAGE ERROR: ${err.message.slice(0, 100)}`);
    });

    // Step 5: Load app
    console.log('');
    console.log('Step 5: Load app');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(3000);
    await screenshot(page, 'grab-01-loaded', results);
    addStep('Load app', true);

    // Step 6: Login
    console.log('');
    console.log('Step 6: Login');
    const clickedStart = await clickButton(page, 'get started', 8000) || await clickButton(page, 'try it', 3000);
    await wait(2000);
    await screenshot(page, 'grab-02-login-modal', results);

    const clickedDemo = await clickButton(page, 'quick demo', 10000);
    await wait(4000);

    if (clickedDemo) {
      addStep('Login', true, 'Quick Demo Login');
    } else {
      addStep('Login', false, 'Could not find Quick Demo button');
      results.errors.push({ type: 'login', message: 'Quick Demo Login not found' });
    }

    // Dismiss modals
    await clickButton(page, 'skip', 2000);
    await clickButton(page, 'close', 1000);
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, 'grab-03-logged-in', results);

    // Step 7: Add Red Block
    console.log('');
    console.log('Step 7: Add Red Block');

    let objectAdded = false;
    if (await clickButton(page, 'standard object', 5000)) {
      await wait(1500);
      await screenshot(page, 'grab-04-object-picker', results);

      // Click Toys & Blocks category (may already be selected)
      await clickText(page, 'Toys & Blocks', 2000) || await clickText(page, 'Toys', 2000);
      await wait(500);

      // Click Red Block - try multiple selectors
      objectAdded = await clickText(page, 'Red Bl', 3000);
      if (!objectAdded) {
        // Try clicking the first object button in the grid
        objectAdded = await clickXPath(page, './/button[contains(@class, "bg-slate-800")]//div[contains(text(), "Red")]', 'Red Block button', 3000);
      }
      await wait(2000);
    }

    await screenshot(page, 'grab-05-after-object', results);
    addStep('Add object', objectAdded, objectAdded ? 'Red Block added' : 'Could not add object');

    // Step 8: Handle Claude API key (if needed)
    console.log('');
    console.log('Step 8: Check for API key requirement');
    await wait(2000);

    // Check if API key input is visible
    const apiKeyInput = await page.$('input[placeholder*="sk-ant"]');
    if (apiKeyInput) {
      console.log('   API key required - entering test key...');
      // Use a placeholder key - the actual API call may fail but we want to test the flow
      await apiKeyInput.type('sk-ant-test-key-for-flow-testing');
      await clickButton(page, 'continue', 3000);
      await wait(2000);
      addStep('API key', true, 'Test key entered');
    } else {
      addStep('API key', true, 'Not required or already set');
    }

    await screenshot(page, 'grab-06-ready-for-chat', results);

    // Step 9: Send pickup command
    console.log('');
    console.log('Step 9: Send pickup command');

    let commandSent = false;
    const pickupCommand = 'Pick up the Red Block';

    // Try to find the chat input (it should have placeholder like "Pick up the Red Block")
    const chatSelectors = [
      'input[placeholder*="Pick up"]',
      'input[placeholder*="pick up"]',
      'input.bg-slate-800',
      'input[type="text"]',
    ];

    for (const selector of chatSelectors) {
      try {
        const input = await page.waitForSelector(selector, { timeout: 3000 });
        if (input) {
          await input.click();
          await wait(200);

          // Clear any existing text
          await page.keyboard.down('Control');
          await page.keyboard.press('a');
          await page.keyboard.up('Control');

          await input.type(pickupCommand, { delay: 30 });
          await wait(300);

          // Press Enter to send
          await page.keyboard.press('Enter');
          commandSent = true;
          console.log(`   ✓ Sent: "${pickupCommand}" via ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!commandSent) {
      // Try clicking Send button if visible
      const sendClicked = await clickButton(page, 'send', 2000);
      if (sendClicked) commandSent = true;
    }

    await screenshot(page, 'grab-07-command-sent', results);
    addStep('Send command', commandSent, commandSent ? pickupCommand : 'Could not find chat input');

    // Step 10: Wait and capture pickup sequence
    console.log('');
    console.log('Step 10: Capture pickup sequence (60 seconds)');
    console.log('   Watching for robot movement and errors...');
    console.log('');

    const pickupTimes = [2, 5, 8, 12, 16, 20, 25, 30, 40, 50, 60];
    let lastTime = 0;

    for (const t of pickupTimes) {
      await wait((t - lastTime) * 1000);
      lastTime = t;
      await screenshot(page, `grab-08-pickup-${String(t).padStart(2, '0')}s`, results);
      console.log(`   [${t}s] Frame captured`);
    }

    // Final screenshot
    await screenshot(page, 'grab-09-final', results);

    // Analyze results
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                      TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');

    // Check for errors in console
    const errorMessages = results.consoleMessages.filter(m =>
      m.type === 'error' || m.text.toLowerCase().includes('error')
    );

    const robotMessages = results.consoleMessages.filter(m =>
      m.text.includes('pickup') || m.text.includes('grasp') ||
      m.text.includes('IK') || m.text.includes('gripper') ||
      m.text.includes('handlePickUp') || m.text.includes('lift')
    );

    console.log('');
    console.log(`Steps completed: ${results.steps.filter(s => s.success).length}/${results.steps.length}`);
    console.log(`Screenshots taken: ${results.screenshots.length}`);
    console.log(`Console errors: ${errorMessages.length}`);
    console.log(`Robot-related messages: ${robotMessages.length}`);

    if (errorMessages.length > 0) {
      console.log('');
      console.log('ERRORS FOUND:');
      errorMessages.slice(0, 10).forEach(e => {
        console.log(`  ❌ ${e.text.slice(0, 150)}`);
      });
    }

    if (robotMessages.length > 0) {
      console.log('');
      console.log('ROBOT MESSAGES:');
      robotMessages.slice(0, 15).forEach(m => {
        console.log(`  🤖 ${m.text.slice(0, 150)}`);
      });
    }

    results.success = results.steps.every(s => s.success) && errorMessages.length === 0;
    results.endTime = new Date().toISOString();

    // Save results
    await writeFile(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log('');
    console.log(`Results saved to: ${RESULTS_FILE}`);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(results.success ? '  ✅ TEST PASSED' : '  ❌ TEST FAILED - SEE ERRORS ABOVE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Screenshots saved in: test-screenshots/');
    console.log('  View with: ls -la test-screenshots/grab-*.png');

  } catch (error) {
    console.error('');
    console.error('❌ FATAL ERROR:', error.message);
    results.errors.push({ type: 'fatal', message: error.message });
    results.success = false;
  } finally {
    console.log('');
    console.log('Cleaning up...');

    if (browser) {
      await browser.close();
    }

    // Restore .env
    if (envBackedUp && await fileExists(ENV_BACKUP)) {
      await rename(ENV_BACKUP, ENV_PATH);
      console.log('   .env restored');
    }

    // Stop server
    try { execSync('pkill -f "vite preview"', { stdio: 'ignore' }); } catch {}

    console.log('Done!');
  }

  return results;
}

runTest().then(results => {
  process.exit(results.success ? 0 : 1);
});
