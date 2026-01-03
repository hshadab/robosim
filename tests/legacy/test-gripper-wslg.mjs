#!/usr/bin/env node
/**
 * Visual Robot Gripper Test using Playwright + WSLg
 */
import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import { mkdir, rename, access } from 'fs/promises';
import { constants } from 'fs';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';
const SCREENSHOT_DIR = `${PROJECT_DIR}/test-screenshots`;
const ENV_PATH = `${PROJECT_DIR}/.env`;
const ENV_BACKUP = `${PROJECT_DIR}/.env.wslg-backup`;

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

async function runTest() {
  let browser = null;
  let envBackedUp = false;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      🤖 VISUAL ROBOT GRIPPER TEST (Playwright + WSLg)        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    await mkdir(SCREENSHOT_DIR, { recursive: true });

    // Disable Supabase
    console.log('Setting up mock login...');
    if (await fileExists(ENV_PATH)) {
      await rename(ENV_PATH, ENV_BACKUP);
      envBackedUp = true;
    }

    // Build
    console.log('Building app...');
    execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'pipe' });

    // Start server
    console.log('Starting server...');
    try { execSync('pkill -f vite', { stdio: 'ignore' }); } catch {}
    await wait(1000);

    const server = spawn('npm', ['run', 'preview', '--', '--port', '5173'], {
      cwd: PROJECT_DIR, stdio: 'ignore', detached: true
    });
    server.unref();

    if (!await waitForServer('http://localhost:5173', 30)) {
      throw new Error('Server failed to start');
    }
    console.log('✓ Server running');
    console.log('');

    // Launch VISIBLE browser with Playwright
    console.log('Launching browser window (this may take a moment)...');
    console.log('');

    browser = await chromium.launch({
      headless: false,
      args: [
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    const page = await context.newPage();

    // Log robot messages
    page.on('console', msg => {
      const t = msg.text();
      if (t.includes('pickup') || t.includes('grasp') || t.includes('lift') || t.includes('IK')) {
        console.log(`   🤖 ${t.slice(0, 80)}`);
      }
    });

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║   👀 BROWSER WINDOW SHOULD BE VISIBLE NOW!                   ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');

    // Load app
    console.log('Step 1: Loading app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await wait(2000);
    await screenshot(page, 'wsl-01-loaded');

    // Login
    console.log('Step 2: Logging in...');
    try {
      await page.getByRole('button', { name: /get started/i }).click({ timeout: 8000 });
    } catch {
      await page.getByRole('button', { name: /try it/i }).click({ timeout: 3000 }).catch(() => {});
    }
    await wait(2000);

    try {
      await page.getByRole('button', { name: /quick demo/i }).click({ timeout: 8000 });
      await wait(4000);
    } catch {
      console.log('   (Demo login not found)');
    }

    // Dismiss modals
    try { await page.getByRole('button', { name: /skip/i }).click({ timeout: 2000 }); } catch {}
    await page.keyboard.press('Escape');
    await wait(2000);
    await screenshot(page, 'wsl-02-loggedin');
    console.log('   ✓ Logged in');

    // Add object
    console.log('Step 3: Adding Red Block...');
    try {
      await page.getByRole('button', { name: /standard object/i }).click({ timeout: 5000 });
      await wait(1500);
      await page.getByText('Toys').click({ timeout: 3000 });
      await wait(1000);
      await page.getByText('Red Bl').first().click({ timeout: 3000 });
      await wait(2000);
      console.log('   ✓ Red Block added');
    } catch (e) {
      console.log('   Object picker:', e.message.split('\n')[0]);
    }
    await screenshot(page, 'wsl-03-object');

    // Go back and open controls
    console.log('Step 4: Opening chat controls...');
    try {
      await page.getByText('Back').click({ timeout: 2000 });
      await wait(1500);
    } catch {}

    try {
      await page.getByText('manual controls').click({ timeout: 3000 });
      await wait(1500);
    } catch {}
    await screenshot(page, 'wsl-04-controls');

    // Send command
    console.log('');
    console.log('Step 5: Sending pickup command...');
    console.log('');
    console.log('   ╔════════════════════════════════════════════════════════════╗');
    console.log('   ║     👀 WATCH THE ROBOT ARM MOVE!                           ║');
    console.log('   ╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const command = 'Pick up the red block';
    let sent = false;

    // Try to find chat input
    for (const placeholder of ['Tell', 'Pick', 'Type', 'Chat']) {
      try {
        const input = page.getByPlaceholder(new RegExp(placeholder, 'i'));
        await input.click({ timeout: 2000 });
        await input.fill(command);
        await page.keyboard.press('Enter');
        sent = true;
        console.log(`   ✓ Sent: "${command}"`);
        break;
      } catch {}
    }

    // Fallback: try textarea
    if (!sent) {
      try {
        const textarea = page.locator('textarea').first();
        await textarea.click({ timeout: 2000 });
        await textarea.fill(command);
        await page.keyboard.press('Enter');
        sent = true;
        console.log(`   ✓ Sent via textarea: "${command}"`);
      } catch {}
    }

    if (!sent) {
      console.log('   ⚠ Please type the command manually:');
      console.log(`      "${command}"`);
    }

    await screenshot(page, 'wsl-05-command');

    // Watch pickup sequence
    console.log('');
    console.log('Step 6: Capturing pickup (45 seconds)...');
    for (let i = 1; i <= 15; i++) {
      await wait(3000);
      await screenshot(page, `wsl-06-pickup-${String(i * 3).padStart(2, '0')}s`);
      console.log(`   [${i * 3}s]`);
    }

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ TEST COMPLETE!                         ║');
    console.log('║                                                              ║');
    console.log('║  Browser stays open for 2 minutes. Try more commands:        ║');
    console.log('║    • "Open the gripper"                                      ║');
    console.log('║    • "Move to home position"                                 ║');
    console.log('║    • "Pick up the blue block"                                ║');
    console.log('║                                                              ║');
    console.log('║  Press Ctrl+C to exit.                                       ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // List screenshots
    console.log('');
    console.log('Screenshots:');
    execSync(`ls ${SCREENSHOT_DIR}/wsl-*.png 2>/dev/null | tail -10`, { stdio: 'inherit' });

    await wait(120000);

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message.split('\n')[0]);

    if (error.message.includes('Executable') || error.message.includes('browser')) {
      console.log('');
      console.log('Try installing Playwright browsers:');
      console.log('  npx playwright install chromium');
    }
  } finally {
    console.log('');
    console.log('Cleaning up...');
    if (browser) try { await browser.close(); } catch {}

    if (envBackedUp && await fileExists(ENV_BACKUP)) {
      await rename(ENV_BACKUP, ENV_PATH);
      console.log('   .env restored');
    }

    try { execSync('pkill -f "vite preview"', { stdio: 'ignore' }); } catch {}
    console.log('Done!');
  }
}

runTest();
