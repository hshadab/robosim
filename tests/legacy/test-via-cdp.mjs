#!/usr/bin/env node
/**
 * Test via Chrome DevTools Protocol
 *
 * Connect to a browser running with --remote-debugging-port=9222
 * and run the pickup test
 */
import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';

const SCREENSHOT_DIR = '/home/hshadab/robotics-simulation/test-screenshots';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function screenshot(page, name) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
  console.log(`📸 ${name}`);
}

async function runTest() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ROBOT ARM TEST VIA CDP                                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Try to connect to Windows browser
  const endpoints = [
    'http://127.0.0.1:9222',
    'http://localhost:9222',
  ];

  let browser = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying to connect to ${endpoint}...`);
      browser = await puppeteer.connect({
        browserURL: endpoint,
        defaultViewport: null,
      });
      console.log('✓ Connected!');
      break;
    } catch (e) {
      console.log(`  Failed: ${e.message.slice(0, 50)}`);
    }
  }

  if (!browser) {
    console.log('');
    console.log('Could not connect to browser. Please start Edge/Chrome with:');
    console.log('');
    console.log('  In Windows CMD or PowerShell:');
    console.log('  msedge --remote-debugging-port=9222 --user-data-dir="C:\\temp\\edge-debug" http://localhost:5173');
    console.log('');
    console.log('  Or for Chrome:');
    console.log('  chrome --remote-debugging-port=9222 --user-data-dir="C:\\temp\\chrome-debug" http://localhost:5173');
    console.log('');
    return;
  }

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  try {
    // Get the page
    const pages = await browser.pages();
    let page = pages.find(p => p.url().includes('localhost:5173'));

    if (!page) {
      console.log('Opening new tab to localhost:5173...');
      page = await browser.newPage();
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    }

    console.log('Page URL:', page.url());
    await screenshot(page, 'cdp-01-initial');

    // Listen to console
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('handlePickUpCommand') || text.includes('grasp') ||
          text.includes('lift') || text.includes('Lift')) {
        console.log(`🤖 ${text.slice(0, 120)}`);
      }
    });

    // Check if logged in (look for user avatar or logout button)
    console.log('');
    console.log('Checking login status...');
    await wait(2000);

    const isLoggedIn = await page.evaluate(() => {
      return document.body.innerText.includes('Logout') ||
             document.body.innerText.includes('demo') ||
             document.querySelector('[data-testid="user-menu"]') !== null;
    });

    console.log('Logged in:', isLoggedIn);

    if (!isLoggedIn) {
      console.log('');
      console.log('Please log in with Google in the browser, then run this script again.');
      return;
    }

    await screenshot(page, 'cdp-02-logged-in');

    // Check if there's already an object
    console.log('');
    console.log('Looking for objects in scene...');

    const hasObjects = await page.evaluate(() => {
      // Check for object-related UI elements
      return document.body.innerText.includes('Red') ||
             document.body.innerText.includes('Block') ||
             document.body.innerText.includes('Ball');
    });

    console.log('Objects present:', hasObjects);

    // Try to add an object if none exist
    if (!hasObjects) {
      console.log('');
      console.log('Adding Red Block...');

      // Click "Use Standard Object"
      try {
        await page.click('button:has-text("Standard Object")');
        await wait(1500);
        await screenshot(page, 'cdp-03-object-picker');

        // Click "Toys & Blocks"
        await page.click('text=Toys');
        await wait(1000);

        // Click Red Block
        await page.click('text=Red Bl');
        await wait(2000);
        console.log('✓ Red Block added');
      } catch (e) {
        console.log('Could not add object:', e.message.slice(0, 50));
      }
    }

    await screenshot(page, 'cdp-04-with-object');

    // Find and use chat input
    console.log('');
    console.log('Looking for chat input...');

    const chatInput = await page.$('input[placeholder*="Pick up"], input[placeholder*="pick up"], textarea');

    if (chatInput) {
      console.log('Found chat input, sending command...');
      await chatInput.click();
      await chatInput.type('Pick up the Red Block', { delay: 30 });
      await wait(500);
      await page.keyboard.press('Enter');
      console.log('✓ Command sent: "Pick up the Red Block"');
    } else {
      console.log('Chat input not found. Please type "Pick up the Red Block" manually.');
    }

    await screenshot(page, 'cdp-05-command-sent');

    // Watch the sequence
    console.log('');
    console.log('Watching pickup sequence (30 seconds)...');
    console.log('');

    for (let i = 1; i <= 10; i++) {
      await wait(3000);
      await screenshot(page, `cdp-06-pickup-${i * 3}s`);
      console.log(`[${i * 3}s]`);
    }

    await screenshot(page, 'cdp-07-final');

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  TEST COMPLETE                                               ║');
    console.log('║                                                              ║');
    console.log('║  Screenshots saved to: test-screenshots/cdp-*.png            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('Error:', error.message);
  }

  // Don't close the browser - let user keep using it
  console.log('');
  console.log('Browser left open for manual inspection.');
}

runTest();
