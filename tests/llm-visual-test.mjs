#!/usr/bin/env node
/**
 * LLM Visual Integration Test
 * Tests Claude API-powered robot control with visual verification
 */
import puppeteer from 'puppeteer';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const APP_URL = 'http://localhost:5004';
const SCREENSHOT_DIR = '/home/hshadab/robosim/test-screenshots';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log('');
  console.log('================================================================');
  console.log('   LLM VISUAL INTEGRATION TEST');
  console.log('================================================================');
  console.log('');

  if (!API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY environment variable not set');
    process.exit(1);
  }

  // Create screenshots directory
  const { mkdirSync, existsSync } = await import('fs');
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  let browser;
  const consoleLogs = [];

  try {
    console.log('Step 1: Launching headless browser with WebGL...');
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

    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push({ time: new Date().toISOString(), text });

      // Print relevant logs
      if (text.includes('[handlePickUpCommand]') ||
          text.includes('Pickup') ||
          text.includes('Claude') ||
          text.includes('LLM') ||
          text.includes('trajectory') ||
          text.includes('GRABBED') ||
          text.includes('SUCCESS') ||
          text.includes('ERROR')) {
        console.log(`  [BROWSER] ${text}`);
      }
    });

    console.log('Step 2: Navigating to app...');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await wait(3000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial.png` });
    console.log('  Screenshot: 01-initial.png');

    // Set API key in localStorage
    console.log('Step 3: Setting Claude API key...');
    await page.evaluate((key) => {
      localStorage.setItem('robosim-claude-api-key', key);
    }, API_KEY);

    // Close welcome modal by clicking "Get Started" to go through the proper flow
    console.log('Step 4: Closing welcome modal...');

    // First try to click Get Started to close the modal
    try {
      const getStartedClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('get started')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (getStartedClicked) {
        console.log('  Clicked "Get Started" button');
        await wait(2000);
      }
    } catch (e) {
      console.log('  Get Started click failed:', e.message);
    }

    // Now close any secondary modals (demo login, etc.)
    try {
      // Try Quick Demo Login if visible
      const demoClicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('quick demo') || text.includes('demo login') || text.includes('skip')) {
            btn.click();
            return 'clicked: ' + btn.textContent;
          }
        }
        return null;
      });
      if (demoClicked) {
        console.log(`  ${demoClicked}`);
        await wait(2000);
      }
    } catch (e) {
      console.log('  No demo button');
    }

    // Press Escape multiple times to close any remaining modals
    await page.keyboard.press('Escape');
    await wait(500);
    await page.keyboard.press('Escape');
    await wait(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-after-skip.png` });

    // Add an object to the scene
    console.log('Step 5: Adding object to scene...');

    // Look for "Add Object" or similar button
    const addedObject = await page.evaluate(() => {
      // Try to find and click "Single Cube" or "Add Object" button
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('single cube') || text.includes('add object') || text.includes('cube')) {
          btn.click();
          return btn.textContent?.trim();
        }
      }

      // Try clicking on object library items
      const items = document.querySelectorAll('[class*="object"], [class*="library"] button');
      for (const item of items) {
        if (item.textContent?.toLowerCase().includes('cube')) {
          item.click();
          return item.textContent?.trim();
        }
      }
      return null;
    });

    if (addedObject) {
      console.log(`  Added: ${addedObject}`);
    } else {
      console.log('  Could not find object button, trying Presets panel...');

      // Try expanding Presets and clicking Single Cube
      await page.evaluate(() => {
        // Look for Presets section
        const headings = document.querySelectorAll('h3, h4, button, [class*="accordion"]');
        for (const h of headings) {
          if (h.textContent?.includes('Presets') || h.textContent?.includes('Object')) {
            h.click();
          }
        }
      });
      await wait(500);

      // Now try Single Cube again
      const clicked = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Single Cube')) {
            btn.click();
            return true;
          }
        }
        return false;
      });
      console.log(`  Single Cube clicked: ${clicked}`);
    }

    await wait(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-object-added.png` });
    console.log('  Screenshot: 03-object-added.png');

    // Send LLM command via chat
    console.log('');
    console.log('================================================================');
    console.log('Step 6: SENDING LLM COMMAND - "Pick up the red cube"');
    console.log('================================================================');
    console.log('');

    // Find chat input
    const chatInput = await page.$('input[placeholder*="Pick"], input[placeholder*="robot"], textarea[placeholder*="robot"], textarea');

    if (chatInput) {
      await chatInput.click();
      await chatInput.type('Pick up the red cube', { delay: 50 });
      await page.screenshot({ path: `${SCREENSHOT_DIR}/04-command-typed.png` });
      console.log('  Screenshot: 04-command-typed.png');

      // Press Enter to send
      await page.keyboard.press('Enter');
      console.log('  Command sent! Waiting for Claude response and robot motion...');
    } else {
      console.log('  Looking for chat input another way...');
      // Try to find any text input
      const inputFound = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        for (const input of inputs) {
          const placeholder = input.placeholder?.toLowerCase() || '';
          if (placeholder.includes('pick') || placeholder.includes('robot') || placeholder.includes('tell')) {
            input.focus();
            input.value = 'Pick up the red cube';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      if (inputFound) {
        await page.keyboard.press('Enter');
        console.log('  Command sent via input event!');
      } else {
        console.log('  ERROR: Could not find chat input');
      }
    }

    // Wait longer for IK solver (slow in headless Chrome with SwiftShader)
    console.log('');
    console.log('Waiting for IK solver and robot motion (this takes 30-60s in headless mode)...');

    // Wait 30 seconds for IK to complete
    await wait(30000);
    console.log('  [30s] IK should be complete');

    // Now capture motion sequence
    console.log('');
    console.log('Capturing robot motion sequence...');

    for (let i = 0; i < 10; i++) {
      await wait(2000);
      const filename = `${SCREENSHOT_DIR}/05-motion-${String(i).padStart(2, '0')}.png`;
      await page.screenshot({ path: filename });
      console.log(`  [${30 + (i + 1) * 2}s] Screenshot: 05-motion-${String(i).padStart(2, '0')}.png`);
    }

    // Final screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-final.png` });
    console.log('  Screenshot: 06-final.png');

    // Check for success indicators
    const pageContent = await page.content();
    const hasGrabbed = pageContent.includes('GRABBED') || pageContent.includes('grabbed');
    const hasSuccess = consoleLogs.some(l => l.text.includes('SUCCESS'));

    console.log('');
    console.log('================================================================');
    console.log('RESULTS:');
    console.log('================================================================');
    console.log(`  Object grabbed indicator: ${hasGrabbed ? 'YES' : 'NO'}`);
    console.log(`  Success in console: ${hasSuccess ? 'YES' : 'NO'}`);
    console.log(`  Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('');

    // Print relevant console logs
    console.log('Relevant console logs:');
    const relevantLogs = consoleLogs.filter(l =>
      l.text.includes('Pick') ||
      l.text.includes('Claude') ||
      l.text.includes('trajectory') ||
      l.text.includes('GRAB') ||
      l.text.includes('SUCCESS') ||
      l.text.includes('ERROR')
    );
    for (const log of relevantLogs.slice(-20)) {
      console.log(`  ${log.text}`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed.');
    }
  }
}

runTest();
