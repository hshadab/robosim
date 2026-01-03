#!/usr/bin/env node
/**
 * Visual Robot Arm Gripper Test
 *
 * Runs with a VISIBLE browser window using WSLg.
 * You can watch the robot pick up objects in real-time!
 */
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { mkdir, rename, access } from 'fs/promises';
import { constants } from 'fs';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const ENV_PATH = `${PROJECT_DIR}/.env`;
const ENV_BACKUP = `${PROJECT_DIR}/.env.visual-backup`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function fileExists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function waitForServer(url, max = 30) {
  for (let i = 0; i < max; i++) {
    try { if ((await fetch(url)).ok) return true; } catch {}
    await wait(1000);
  }
  return false;
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
  console.log(`   📸 ${name}`);
}

async function click(page, selector, timeout = 5000) {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch { return false; }
}

async function clickButton(page, text, timeout = 5000) {
  return click(page, `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`, timeout);
}

async function clickText(page, text, timeout = 3000) {
  return click(page, `xpath/.//*[contains(text(), '${text}')]`, timeout);
}

async function runTest() {
  let browser = null;
  let envBackedUp = false;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      🤖 VISUAL ROBOT ARM GRIPPER TEST                        ║');
  console.log('║      Watch the robot pick up objects in real-time!           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Disable Supabase for mock login
    console.log('Setting up mock login mode...');
    if (await fileExists(ENV_PATH)) {
      await rename(ENV_PATH, ENV_BACKUP);
      envBackedUp = true;
    }

    // Build and start server
    console.log('Building app...');
    execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'pipe' });

    console.log('Starting server...');
    try { execSync('pkill -f vite', { stdio: 'ignore' }); } catch {}
    await wait(2000);

    // Start server in background
    const { spawn } = await import('child_process');
    const server = spawn('npm', ['run', 'preview', '--', '--port', '5173'], {
      cwd: PROJECT_DIR,
      stdio: 'ignore',
      detached: true
    });
    server.unref();

    if (!await waitForServer('http://localhost:5173', 30)) {
      throw new Error('Server failed to start');
    }
    console.log('✓ Server ready at http://localhost:5173');
    console.log('');

    // Launch VISIBLE browser
    console.log('Launching visible browser window...');
    console.log('');

    browser = await puppeteer.launch({
      headless: false,  // VISIBLE WINDOW!
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1400,900',
        '--window-position=100,100',
        // WebGL support
        '--enable-webgl',
        '--enable-gpu-rasterization',
        '--ignore-gpu-blocklist',
      ],
      defaultViewport: null  // Use window size
    });

    const page = await browser.newPage();

    // Log robot actions
    page.on('console', msg => {
      const t = msg.text();
      if (t.includes('pickup') || t.includes('grasp') || t.includes('lift') ||
          t.includes('approach') || t.includes('IK') || t.includes('gripper')) {
        console.log(`   🤖 ${t.slice(0, 80)}`);
      }
    });

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   A browser window should now be visible on your screen!     ║');
    console.log('║   Watch as the test runs automatically...                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Step 1: Load app
    console.log('Step 1: Loading app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(2000);
    await screenshot(page, 'v01-loaded');

    // Step 2: Login
    console.log('Step 2: Logging in...');
    await clickButton(page, 'get started', 8000);
    await wait(2000);
    await clickButton(page, 'quick demo', 8000);
    await wait(4000);

    // Dismiss modals
    await clickButton(page, 'skip', 2000);
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, 'v02-logged-in');
    console.log('   ✓ Logged in');

    // Step 3: Add Red Block
    console.log('Step 3: Adding Red Block...');
    if (await clickButton(page, 'standard object', 5000)) {
      await wait(1500);
      await clickText(page, 'Toys', 3000);
      await wait(1000);

      // Click Red Block (try Red Bl... or Red Block)
      const clicked = await clickText(page, 'Red Bl', 3000);
      console.log(`   ✓ Red Block added: ${clicked}`);
      await wait(2000);
    }
    await screenshot(page, 'v03-object-added');

    // Step 4: Go back to get chat
    console.log('Step 4: Navigating to chat...');
    await clickText(page, 'Back', 3000);
    await wait(2000);

    // Click "Need manual controls?"
    await clickText(page, 'manual controls', 3000);
    await wait(2000);
    await screenshot(page, 'v04-controls-open');

    // Step 5: Find and use chat input
    console.log('');
    console.log('Step 5: Sending pickup command...');
    console.log('');
    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║     👀 WATCH THE ROBOT ARM MOVE IN THE BROWSER!            ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const command = 'Pick up the red block';
    let sent = false;

    // Try different selectors for chat input
    for (const sel of ['textarea', 'input[placeholder*="Tell"]', 'input[placeholder*="Pick"]', 'input[type="text"]']) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.click(sel);
        await wait(200);

        // Type slowly so user can see
        await page.type(sel, command, { delay: 50 });
        await wait(500);
        await page.keyboard.press('Enter');
        sent = true;
        console.log(`   ✓ Sent: "${command}"`);
        break;
      } catch {}
    }

    if (!sent) {
      console.log('   ⚠ Chat input not found automatically');
      console.log('   Please type the command manually in the browser:');
      console.log(`   "${command}"`);
    }

    await screenshot(page, 'v05-command-sent');

    // Step 6: Watch the pickup!
    console.log('');
    console.log('Step 6: Watching robot pickup sequence...');
    console.log('   (Taking screenshots every 3 seconds for 45 seconds)');
    console.log('');

    for (let i = 1; i <= 15; i++) {
      await wait(3000);
      await screenshot(page, `v06-pickup-${String(i * 3).padStart(2, '0')}s`);
      console.log(`   [${i * 3}s] Frame captured`);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TEST COMPLETE!                         ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║                                                              ║');
    console.log('║  The browser will stay open for 60 seconds so you can       ║');
    console.log('║  interact with the robot manually if you want.              ║');
    console.log('║                                                              ║');
    console.log('║  Try these commands:                                         ║');
    console.log('║    • "Move to home position"                                 ║');
    console.log('║    • "Open the gripper"                                      ║');
    console.log('║    • "Pick up the blue block"                                ║');
    console.log('║                                                              ║');
    console.log('║  Screenshots saved in: test-screenshots/                     ║');
    console.log('║  Press Ctrl+C to close earlier.                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Keep browser open
    await wait(60000);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);

    if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
      console.log('   Browser window was closed.');
    }
  } finally {
    console.log('');
    console.log('Cleaning up...');

    if (browser) {
      try { await browser.close(); } catch {}
    }

    // Restore .env
    if (envBackedUp && await fileExists(ENV_BACKUP)) {
      await rename(ENV_BACKUP, ENV_PATH);
      console.log('   .env restored');
    }

    // Stop server
    try {
      execSync('pkill -f "vite preview" 2>/dev/null', { stdio: 'ignore' });
    } catch {}

    console.log('Done!');
  }
}

runTest();
