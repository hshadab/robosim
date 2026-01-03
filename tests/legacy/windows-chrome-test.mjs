#!/usr/bin/env node
// Windows Chrome E2E Test - Opens visible Chrome window you can watch
import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function clickButtonWithText(page, text, timeout = 10000) {
  const selector = `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch (e) {
    console.log(`   Could not click "${text}": ${e.message.split('\n')[0]}`);
    return false;
  }
}

async function clickElementWithText(page, text, timeout = 5000) {
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
  console.log('');
  console.log('================================================================');
  console.log('   WINDOWS CHROME TEST - Watch the robot pick up the ball!');
  console.log('================================================================');
  console.log('');

  // Kill any existing Chrome with debugging port
  try {
    execSync('taskkill.exe /F /IM chrome.exe 2>/dev/null', { stdio: 'ignore' });
  } catch {}

  await wait(2000);

  // Launch Chrome on Windows with remote debugging
  console.log('Launching Chrome on Windows with remote debugging...');
  const chromePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';

  const chromeProcess = spawn(chromePath, [
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/chrome-test-profile',
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'http://localhost:5173'
  ], {
    detached: true,
    stdio: 'ignore'
  });
  chromeProcess.unref();

  console.log('Waiting for Chrome to start...');
  await wait(5000);

  let browser;
  try {
    // Connect to Chrome via remote debugging
    console.log('Connecting to Chrome via remote debugging...');
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Make sure we're on the right page
    const currentUrl = page.url();
    if (!currentUrl.includes('localhost:5173')) {
      await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
    }

    console.log('Page loaded! Starting automation...');
    await wait(3000);

    // Step 1: Click Get Started
    console.log('');
    console.log('Step 1: Clicking Get Started...');
    let clicked = await clickButtonWithText(page, 'get started', 8000);
    if (!clicked) {
      clicked = await clickButtonWithText(page, 'try it', 3000);
    }
    if (!clicked) {
      clicked = await clickButtonWithText(page, 'login', 3000);
    }
    console.log(`   Result: ${clicked ? 'Success' : 'Not found (may already be logged in)'}`);
    await wait(3000);

    // Step 2: Quick Demo Login
    console.log('');
    console.log('Step 2: Clicking Quick Demo Login...');
    clicked = await clickButtonWithText(page, 'quick demo', 8000);
    console.log(`   Result: ${clicked ? 'Success' : 'Not found'}`);
    await wait(4000);

    // Step 3: Skip tutorial/welcome modal
    console.log('');
    console.log('Step 3: Looking for Skip/Close/Got it buttons...');
    clicked = await clickButtonWithText(page, 'skip', 3000);
    if (!clicked) clicked = await clickButtonWithText(page, 'close', 2000);
    if (!clicked) clicked = await clickButtonWithText(page, 'got it', 2000);
    if (!clicked) clicked = await clickButtonWithText(page, 'dismiss', 2000);
    if (!clicked) clicked = await clickButtonWithText(page, 'continue', 2000);
    // Also try clicking any X close buttons
    if (!clicked) {
      try {
        await page.click('[aria-label="Close"]');
        clicked = true;
      } catch {}
    }
    if (!clicked) {
      try {
        await page.click('.close-button');
        clicked = true;
      } catch {}
    }
    // Try pressing Escape
    await page.keyboard.press('Escape');
    console.log(`   Result: ${clicked ? 'Dismissed modal' : 'No modal found'}`);
    await wait(2000);

    // Step 4: Add Tennis Ball
    console.log('');
    console.log('Step 4: Adding Tennis Ball to scene...');
    clicked = await clickButtonWithText(page, 'standard object', 5000);
    if (!clicked) clicked = await clickButtonWithText(page, 'add object', 3000);
    console.log(`   Clicked add object: ${clicked}`);
    await wait(2000);

    // Click Toys category
    await clickElementWithText(page, 'Toys', 3000);
    console.log('   Clicked Toys');
    await wait(1500);

    // Click Tennis Ball
    await clickElementWithText(page, 'Tennis Ball', 3000);
    console.log('   Clicked Tennis Ball');
    await wait(3000);

    // Step 5: Send pickup command
    console.log('');
    console.log('================================================================');
    console.log('Step 5: SENDING PICKUP COMMAND - WATCH THE ROBOT!');
    console.log('================================================================');
    console.log('');

    // Find chat input
    let chatInput = null;
    for (const sel of ['input[type="text"]', 'textarea', '[placeholder*="Pick"]', '[placeholder*="Tell"]']) {
      try {
        await page.waitForSelector(sel, { timeout: 2000 });
        chatInput = sel;
        break;
      } catch {}
    }

    if (chatInput) {
      await page.click(chatInput);
      await wait(300);
      await page.type(chatInput, 'Pick up the tennis ball', { delay: 40 });
      await wait(300);
      await page.keyboard.press('Enter');
      console.log('   Command sent! Watch the robot arm move!');
    } else {
      console.log('   Could not find chat input. Try typing manually.');
    }

    console.log('');
    console.log('================================================================');
    console.log('   ROBOT IS NOW EXECUTING THE PICKUP!');
    console.log('   Watch Chrome - you should see the arm move down,');
    console.log('   grab the ball, and lift it up.');
    console.log('');
    console.log('   Press Ctrl+C here when done watching.');
    console.log('================================================================');

    // Keep running so user can watch
    await wait(300000); // 5 minutes

  } catch (error) {
    console.error('Error:', error.message);

    if (error.message.includes('connect')) {
      console.log('');
      console.log('Could not connect to Chrome. Try manually:');
      console.log('1. Open Chrome on Windows');
      console.log('2. Go to http://localhost:5173');
      console.log('3. Follow the steps manually');
    }
  } finally {
    if (browser) {
      browser.disconnect(); // Don't close, just disconnect
    }
  }
}

runTest();
