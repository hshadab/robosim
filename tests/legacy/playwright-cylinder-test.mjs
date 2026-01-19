#!/usr/bin/env node
// Playwright test for cylinder side-grasp - takes screenshots and captures console logs
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function runTest() {
  console.log('');
  console.log('================================================================');
  console.log('   LEROBOT CUBE GRASP TEST - Testing pick and place');
  console.log('================================================================');
  console.log('');

  // Create screenshots directory - save to Desktop
  const screenshotDir = '/mnt/c/Users/hshad/Desktop/robosim-screenshots';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  let browser;
  const consoleLogs = [];

  try {
    console.log('Launching headless browser...');

    browser = await chromium.launch({
      headless: true,  // Run headless for automated testing
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Capture console logs to see wrist angles
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      // Print IK-related logs
      if (text.includes('wrist') || text.includes('Grasp') || text.includes('STRATEGY') || text.includes('horizontal') || text.includes('Cylinder') || text.includes('SIDE') || text.includes('APPROACH') || text.includes('approach')) {
        console.log('[BROWSER]', text);
      }
    });

    console.log('Navigating to app on port 5175...');
    await page.goto('http://localhost:5175', { waitUntil: 'networkidle', timeout: 30000 });
    await wait(2000);
    await page.screenshot({ path: path.join(screenshotDir, '01-initial.png') });
    console.log('Screenshot: 01-initial.png');

    // Step 1: Mock login to bypass auth
    console.log('Step 1: Performing mock login...');
    try {
      // Wait for Zustand store to initialize
      await wait(1000);

      // Call mockLogin via page.evaluate
      const loginSuccess = await page.evaluate(async () => {
        // Access Zustand store via window - need to find it
        // Try to find the store in the React DevTools internals or via a global
        // First, let's check if there's a way to set localStorage directly

        // Set the auth state directly in localStorage (Zustand persist)
        const authState = {
          state: {
            user: {
              id: 'test-user',
              email: 'test@example.com',
              user_metadata: { full_name: 'Test User' },
              app_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString()
            },
            profile: {
              id: 'test-user',
              email: 'test@example.com',
              full_name: 'Test User',
              avatar_url: null,
              tier: 'free',
              tier_expires_at: null,
              usage_this_month: { episodes_exported: 0, api_calls: 0, storage_mb: 0 },
              settings: { theme: 'system', notifications_enabled: true },
              created_at: new Date().toISOString()
            },
            isAuthenticated: true,
            isLoading: false,
            error: null
          },
          version: 0
        };
        localStorage.setItem('robosim-auth', JSON.stringify(authState));
        return true;
      });

      console.log('   Mock login set in localStorage');

      // Reload the page to apply the auth state
      await page.reload({ waitUntil: 'networkidle' });
      await wait(3000);
    } catch (e) {
      console.log('   Mock login failed:', e.message);
    }
    await page.screenshot({ path: path.join(screenshotDir, '02-after-login.png') });
    console.log('Screenshot: 02-after-login.png');

    // Step 2: Verify we're in the simulator
    console.log('Step 2: Verifying simulator view...');
    await wait(2000);
    await page.screenshot({ path: path.join(screenshotDir, '03-simulator-view.png') });
    console.log('Screenshot: 03-simulator-view.png');

    // Step 4: Add LeRobot Cube
    console.log('Step 4: Adding LeRobot Cube...');
    try {
      // Click "Use LeRobot Objects" button via JavaScript
      console.log('   Looking for Use LeRobot Objects button...');
      let clicked = await page.evaluate(() => {
        // Find button containing "LeRobot" text
        const buttons = document.querySelectorAll('button, [role="button"], div[class*="cursor-pointer"]');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('LeRobot')) {
            console.log('Found button:', btn.textContent.trim().substring(0, 50));
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (!clicked) {
        // Take debug screenshot
        await page.screenshot({ path: path.join(screenshotDir, '04b-debug-buttons.png') });
        console.log('   Could not find LeRobot Objects button. Debug screenshot saved.');
        throw new Error('Button not found');
      }
      console.log('   Clicked Use LeRobot Objects!');
      await wait(1500);
      await page.screenshot({ path: path.join(screenshotDir, '05-object-menu.png') });
      console.log('Screenshot: 05-object-menu.png');

      // Click on LeRobot Cube (Red) - first object in the LeRobot Training Objects section
      console.log('   Looking for LeRobot Cube...');
      const objClicked = await page.evaluate(() => {
        // Find buttons containing "LeRobot Cube" text
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('LeRobot Cube')) {
            console.log('Found cube button:', btn.textContent.trim().substring(0, 50));
            btn.click();
            return 'LeRobot Cube';
          }
        }
        // Fallback: look for red-colored element in object grid
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          const style = window.getComputedStyle(div);
          const bg = style.backgroundColor;
          // Check for reddish backgrounds
          if (bg && bg.includes('231') && bg.includes('76') && bg.includes('60')) {
            // Found red element, click its parent container
            const parent = div.closest('button');
            if (parent) {
              parent.click();
              return 'Red object via color';
            }
          }
        }
        return null;
      });

      if (objClicked) {
        console.log(`   Selected: ${objClicked}`);
      } else {
        console.log('   Could not find LeRobot cube, trying coordinate click...');
        await page.mouse.click(60, 320);
      }

      await page.screenshot({ path: path.join(screenshotDir, '06-after-click.png') });
      console.log('Screenshot: 06-after-click.png');

      await wait(2000);
      await page.screenshot({ path: path.join(screenshotDir, '07-object-added.png') });
      console.log('Screenshot: 07-object-added.png (cylinder should be visible)');
    } catch (e) {
      console.log('   Could not add cylinder:', e.message.split('\n')[0]);
    }

    // Close any popups
    await page.keyboard.press('Escape');
    await wait(1000);

    // Step 5: Handle API key prompt and send pickup command
    console.log('');
    console.log('================================================================');
    console.log('Step 5: HANDLING API KEY AND SENDING PICKUP COMMAND');
    console.log('================================================================');
    console.log('');

    try {
      // Use Playwright's native methods for reliable interaction
      console.log('   Looking for API key input...');

      // Check if API key prompt is visible
      const apiKeyInput = await page.$('input[placeholder*="sk-ant"]');
      if (apiKeyInput) {
        console.log('   Found API key input, filling...');
        await apiKeyInput.fill(process.env.ANTHROPIC_API_KEY || 'your-api-key-here');
        await wait(500);

        // Click Continue button
        const continueBtn = await page.$('button:has-text("Continue")');
        if (continueBtn) {
          await continueBtn.click();
          console.log('   Clicked Continue');
          await wait(2000);
        }
      } else {
        console.log('   No API key prompt found, app may already be configured');
      }

      await page.screenshot({ path: path.join(screenshotDir, '08-after-api-key.png') });
      console.log('Screenshot: 08-after-api-key.png');

      // Now find and use the chat input
      // Note: MinimalTrainFlow uses an input (not textarea) for chat
      console.log('   Looking for chat input...');
      await wait(1000);

      // First try: look for the chat input in MinimalTrainFlow (placeholder contains "Pick up")
      let chatInput = await page.$('input[placeholder*="Pick up"]');

      if (!chatInput) {
        // Second try: look for any input that looks like a chat input
        chatInput = await page.$('input[placeholder*="robot"]');
      }

      if (!chatInput) {
        // Third try: look for textarea (ChatPanel uses textarea)
        const chatTextarea = await page.$('textarea[placeholder*="robot"]');
        if (chatTextarea) {
          chatInput = chatTextarea;
        }
      }

      if (chatInput) {
        console.log('   Found chat input, typing command...');

        // Focus and type using Playwright's reliable methods
        await chatInput.click();
        await chatInput.fill('Pick up the red cube');
        await wait(300);

        await page.screenshot({ path: path.join(screenshotDir, '08b-command-typed.png') });
        console.log('Screenshot: 08b-command-typed.png');

        // Press Enter to send - Playwright's keyboard is more reliable
        await page.keyboard.press('Enter');
        console.log('   Sent command via Enter key');
      } else {
        console.log('   Could not find chat input! Checking all inputs and textareas...');
        const allInputs = await page.$$('input');
        console.log(`   Found ${allInputs.length} inputs total`);
        for (let i = 0; i < allInputs.length; i++) {
          const placeholder = await allInputs[i].getAttribute('placeholder');
          const type = await allInputs[i].getAttribute('type');
          console.log(`   Input ${i}: type="${type}", placeholder="${placeholder}"`);
        }
        const allTextareas = await page.$$('textarea');
        console.log(`   Found ${allTextareas.length} textareas total`);
        for (let i = 0; i < allTextareas.length; i++) {
          const placeholder = await allTextareas[i].getAttribute('placeholder');
          console.log(`   Textarea ${i}: placeholder="${placeholder}"`);
        }
      }

      // Wait and take screenshots during the motion
      console.log('Waiting for robot motion...');

      await wait(3000);
      await page.screenshot({ path: path.join(screenshotDir, '09-motion-3s.png'), timeout: 60000 });
      console.log('Screenshot: 09-motion-3s.png');

      await wait(3000);
      await page.screenshot({ path: path.join(screenshotDir, '10-motion-6s.png'), timeout: 60000 });
      console.log('Screenshot: 10-motion-6s.png');

      await wait(4000);
      await page.screenshot({ path: path.join(screenshotDir, '11-motion-10s.png'), timeout: 60000 });
      console.log('Screenshot: 11-motion-10s.png');

      await wait(5000);
      await page.screenshot({ path: path.join(screenshotDir, '12-final.png'), timeout: 60000 });
      console.log('Screenshot: 12-final.png');

    } catch (e) {
      console.log('   Could not send command:', e.message.split('\n')[0]);
    }

    // Print relevant console logs
    console.log('');
    console.log('================================================================');
    console.log('RELEVANT CONSOLE LOGS (wrist angles, grasp strategy):');
    console.log('================================================================');

    const relevantLogs = consoleLogs.filter(log =>
      log.includes('wrist') ||
      log.includes('Grasp') ||
      log.includes('STRATEGY') ||
      log.includes('IK') ||
      log.includes('target') ||
      log.includes('cube') ||
      log.includes('Cube') ||
      log.includes('GRIPPER') ||
      log.includes('position') ||
      log.includes('[useLLMChat]') ||
      log.includes('[callClaudeAPI]') ||
      log.includes('[handlePickUpCommand]') ||
      log.includes('sequence') ||
      log.includes('animation') ||
      log.includes('Pick')
    );

    for (const log of relevantLogs.slice(-30)) {
      console.log(log);
    }

    console.log('');
    console.log('================================================================');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    console.log('================================================================');

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

runTest();
