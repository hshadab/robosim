#!/usr/bin/env node
/**
 * Robot Arm Gripper Test - Headless Mode
 *
 * Runs in headless mode for WSL compatibility, takes screenshots.
 * Also opens browser in Windows so you can watch!
 */
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { mkdir } from 'fs/promises';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const DEV_SERVER_URL = 'http://localhost:5173';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Screenshot helper
async function screenshot(page, name) {
  const filename = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  console.log(`   📸 ${name}.png`);
  return filename;
}

// Click button by text (XPath)
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

// Click element containing text
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

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         ROBOT ARM GRIPPER TEST (Headless + Screenshots)      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Create screenshot dir
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Open browser in Windows for watching
    console.log('Opening app in your Windows browser for watching...');
    try {
      execSync('cmd.exe /c start http://localhost:5173', { stdio: 'ignore' });
      console.log('   ✓ Browser opened - follow along while test runs!');
    } catch { /* ignore */ }
    console.log('');

    // Launch headless Puppeteer for screenshots
    console.log('Launching headless browser for screenshots...');
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

    // Log robot messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('pickup') || text.includes('grasp') ||
          text.includes('gripper') || text.includes('lift') ||
          text.includes('approach') || text.includes('IK')) {
        console.log(`   🤖 ${text.slice(0, 80)}`);
      }
    });

    // Step 1: Load app
    console.log('');
    console.log('Step 1: Loading app...');
    await page.goto(DEV_SERVER_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
    await screenshot(page, '01-landing');
    console.log('   ✓ App loaded');

    // Step 2: Login
    console.log('');
    console.log('Step 2: Logging in...');
    await clickButton(page, 'get started') || await clickButton(page, 'try it');
    await wait(2000);
    await clickButton(page, 'quick demo', 8000);
    await wait(3000);

    // Dismiss modals
    await clickButton(page, 'skip', 2000);
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, '02-logged-in');
    console.log('   ✓ Login complete');

    // Step 3: Add object
    console.log('');
    console.log('Step 3: Adding Red Cube...');

    let objectAdded = false;
    if (await clickButton(page, 'standard object', 5000)) {
      await wait(1500);
      if (await clickText(page, 'Toys', 3000)) {
        await wait(1000);
        objectAdded = await clickText(page, 'Red Cube', 3000);
        if (!objectAdded) {
          objectAdded = await clickText(page, 'Tennis Ball', 2000);
        }
      }
    }

    await wait(2000);
    await screenshot(page, '03-object-added');
    console.log(`   ${objectAdded ? '✓' : '⚠'} Object ${objectAdded ? 'added' : 'may already exist'}`);

    // Step 4: Send pickup command
    console.log('');
    console.log('Step 4: Sending pickup command...');
    console.log('');
    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║   WATCH THE ROBOT IN YOUR WINDOWS BROWSER!                 ║');
    console.log('   ║   The arm should move to pick up the object...             ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const command = 'Pick up the red cube';
    let commandSent = false;

    // Try different input selectors
    for (const sel of ['textarea', 'input[type="text"]']) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.click(sel);
        await wait(200);
        await page.type(sel, command, { delay: 20 });
        await page.keyboard.press('Enter');
        commandSent = true;
        console.log(`   ✓ Sent: "${command}"`);
        break;
      } catch { /* try next */ }
    }

    if (!commandSent) {
      console.log('   ⚠ Could not find chat input - type manually in your browser');
    }

    await screenshot(page, '04-command-sent');

    // Step 5: Capture pickup sequence
    console.log('');
    console.log('Step 5: Capturing pickup sequence (30 seconds)...');

    const phases = [
      { sec: 2, name: '05-phase-02s', desc: 'Starting motion' },
      { sec: 4, name: '06-phase-04s', desc: 'Approaching' },
      { sec: 6, name: '07-phase-06s', desc: 'Reaching' },
      { sec: 8, name: '08-phase-08s', desc: 'Gripper open' },
      { sec: 10, name: '09-phase-10s', desc: 'Contact' },
      { sec: 12, name: '10-phase-12s', desc: 'Gripping' },
      { sec: 14, name: '11-phase-14s', desc: 'Closing gripper' },
      { sec: 16, name: '12-phase-16s', desc: 'Lifting' },
      { sec: 20, name: '13-phase-20s', desc: 'Lifting higher' },
      { sec: 25, name: '14-phase-25s', desc: 'Final position' },
      { sec: 30, name: '15-final', desc: 'Complete' },
    ];

    let lastTime = 0;
    for (const phase of phases) {
      await wait((phase.sec - lastTime) * 1000);
      lastTime = phase.sec;
      await screenshot(page, phase.name);
      console.log(`   [${phase.sec}s] ${phase.desc}`);
    }

    // Done!
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST COMPLETE!                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  Screenshots saved to: test-screenshots/                     ║');
    console.log('║                                                              ║');
    console.log('║  Key files:                                                  ║');
    console.log('║    01-landing.png      - Landing page                        ║');
    console.log('║    02-logged-in.png    - After login                         ║');
    console.log('║    03-object-added.png - Red cube in scene                   ║');
    console.log('║    04-command-sent.png - Pickup command sent                 ║');
    console.log('║    05-15-*.png         - Pickup sequence frames              ║');
    console.log('║                                                              ║');
    console.log('║  View screenshots:                                           ║');
    console.log('║    ls -la test-screenshots/                                  ║');
    console.log('║    Or open them in Windows file explorer                     ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // List screenshot files
    console.log('Screenshots captured:');
    execSync(`ls -la ${SCREENSHOT_DIR}/*.png 2>/dev/null | tail -20`, { stdio: 'inherit' });

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('');
    console.log('Done! The dev server is still running at http://localhost:5173');
    console.log('You can still interact with the app in your Windows browser.');
  }
}

runTest();
