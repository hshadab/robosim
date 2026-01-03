#!/usr/bin/env node
// Visual browser test - opens a VISIBLE browser window for observation
import puppeteer from 'puppeteer';

const PROJECT_DIR = '/home/hshadab/robotics-simulation';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function clickButtonWithText(page, text, timeout = 10000) {
  const selector = `xpath/.//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${text.toLowerCase()}')]`;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch (e) {
    console.log(`   Could not click "${text}": ${e.message}`);
    return false;
  }
}

async function clickElementWithText(page, text, timeout = 5000) {
  const selector = `xpath/.//*[contains(text(), '${text}')]`;
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    return true;
  } catch (e) {
    return false;
  }
}

async function runTest() {
  console.log('');
  console.log('================================================================');
  console.log('   VISUAL BROWSER TEST - Watch the robot pick up the ball!');
  console.log('================================================================');
  console.log('');

  let browser;
  try {
    // Launch VISIBLE browser (not headless)
    console.log('Launching visible browser...');
    console.log('(If you don\'t see a window, you may need WSLg or an X server)');
    console.log('');

    browser = await puppeteer.launch({
      headless: false,  // VISIBLE browser!
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--start-maximized',
      ],
      defaultViewport: null  // Use full window size
    });

    const page = await browser.newPage();

    // Log robot actions
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[handlePickUpCommand]') ||
          text.includes('Waypoint') ||
          text.includes('FULL SEQUENCE')) {
        console.log('>>> ROBOT:', text.substring(0, 100));
      }
    });

    console.log('Opening app at http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded!');

    await wait(2000);

    // Click Get Started
    console.log('Clicking Get Started...');
    await clickButtonWithText(page, 'get started') ||
    await clickButtonWithText(page, 'login') ||
    await clickButtonWithText(page, 'try it');

    await wait(3000);

    // Click Quick Demo Login
    console.log('Clicking Quick Demo Login...');
    await clickButtonWithText(page, 'quick demo', 10000);

    await wait(4000);

    // Dismiss welcome modal
    await clickButtonWithText(page, 'skip', 3000);
    await wait(2000);

    // Add Tennis Ball
    console.log('Adding Tennis Ball to scene...');
    await clickButtonWithText(page, 'standard object', 5000);
    await wait(1500);

    await clickElementWithText(page, 'Toys', 3000);
    await wait(1000);

    await clickElementWithText(page, 'Tennis Ball', 3000);
    await wait(3000);

    // Send pickup command
    console.log('');
    console.log('================================================================');
    console.log('   SENDING PICKUP COMMAND - WATCH THE ROBOT!');
    console.log('================================================================');
    console.log('');

    // Find and use chat input
    const chatInput = await page.$('input[type="text"]') || await page.$('textarea');
    if (chatInput) {
      await chatInput.click();
      await wait(200);
      await chatInput.type('Pick up the tennis ball', { delay: 50 });
      await wait(200);
      await page.keyboard.press('Enter');
      console.log('Command sent! Watch the robot move...');
    }

    // Keep browser open for observation
    console.log('');
    console.log('================================================================');
    console.log('   Browser will stay open for 5 minutes.');
    console.log('   Watch the robot pick up the tennis ball!');
    console.log('   Press Ctrl+C to close when done.');
    console.log('================================================================');

    await wait(300000); // 5 minutes

  } catch (error) {
    console.error('Error:', error.message);

    if (error.message.includes('Failed to launch') || error.message.includes('DISPLAY')) {
      console.log('');
      console.log('================================================================');
      console.log('   CANNOT OPEN VISIBLE BROWSER');
      console.log('================================================================');
      console.log('');
      console.log('WSL2 does not have a display. Options:');
      console.log('');
      console.log('1. Enable WSLg (Windows 11):');
      console.log('   wsl --update');
      console.log('   wsl --shutdown');
      console.log('   Then restart WSL');
      console.log('');
      console.log('2. Install VcXsrv on Windows:');
      console.log('   - Download from https://sourceforge.net/projects/vcxsrv/');
      console.log('   - Run XLaunch with "Disable access control" checked');
      console.log('   - In WSL: export DISPLAY=:0');
      console.log('');
      console.log('3. Just open http://localhost:5173 in your Windows browser!');
      console.log('   The dev server is running - test it manually.');
      console.log('================================================================');
    }

    await wait(30000);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runTest();
