/**
 * Test pickup with object in reachable position
 * Run with: node test-pickup-reachable.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Starting pickup test with reachable object position...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[solveIKForTarget]') ||
        text.includes('[handlePickUpCommand]') ||
        text.includes('[calculateGraspJoints]') ||
        text.includes('[GripperInteraction]') ||
        text.includes('WARNING') ||
        text.includes('IK error')) {
      console.log('BROWSER:', text);
    }
  });

  // Set up auth bypass
  await context.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User'
    }));
    localStorage.setItem('auth_timestamp', Date.now().toString());
  });

  console.log('Loading app...');
  await page.goto('http://localhost:5174');

  // Wait for landing page to load
  await page.waitForTimeout(2000);

  // Click "GET STARTED" to enter the simulation using JavaScript
  console.log('Clicking to enter simulation...');
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('GET STARTED')) {
        btn.click();
        break;
      }
    }
  });
  await page.waitForTimeout(3000);

  // Use JavaScript to navigate directly if needed
  await page.evaluate(() => {
    // Try to get to simulation mode by dispatching route change or clicking start
    const startBtn = document.querySelector('button[class*="Start"]');
    if (startBtn) {
      startBtn.click();
    }
  });
  await page.waitForTimeout(2000);

  // Dismiss login modal by clicking the X button in the modal header
  console.log('Dismissing login modal...');

  // Click the X button - it's near the top right of the modal
  // The modal header shows "Log in to RoboSim" with X on the right
  await page.evaluate(() => {
    // Find the modal and its close button
    const modal = document.querySelector('[class*="modal"], [class*="fixed"]');
    if (modal) {
      // Find any button with just an X or close icon
      const buttons = modal.querySelectorAll('button');
      for (const btn of buttons) {
        // Check if it's likely a close button (small, contains X icon)
        const svg = btn.querySelector('svg');
        if (svg || btn.textContent?.trim() === '×' || btn.textContent?.trim() === '') {
          console.log('Found close button, clicking...');
          btn.click();
          return;
        }
      }
    }

    // Also try clicking the backdrop to close
    const backdrop = document.querySelector('.backdrop-blur-sm, [class*="backdrop"]');
    if (backdrop) {
      backdrop.click();
    }
  });
  await page.waitForTimeout(1000);

  // Try clicking outside the modal (on the backdrop)
  await page.mouse.click(100, 100);
  await page.waitForTimeout(500);

  // Press Escape as fallback
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Add a blue block at a REACHABLE position (X=12cm, Z=0cm is directly in front)
  console.log('\nAdding blue block at reachable position [0.12, 0.05, 0.0]...');
  await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    if (store) {
      store.getState().spawnObject({
        name: 'Blue Block',
        type: 'cube',
        color: '#3498db',
        scale: 0.04,
        mass: 0.1,
        position: [0.12, 0.05, 0.0], // Directly in front of arm (X=12cm, Z=0)
        rotation: [0, 0, 0],
        isGrabbable: true,
        isGrabbed: false,
        isInTargetZone: false,
      });
    }
  });

  await page.waitForTimeout(1000);

  // Get object positions
  const objects = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store.getState().objects.map(o => ({
      name: o.name,
      position: o.position,
      isGrabbable: o.isGrabbable
    }));
  });
  console.log('Objects:', JSON.stringify(objects, null, 2));

  // Get initial gripper position
  const initialPos = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store.getState().gripperWorldPosition;
  });
  console.log(`Initial gripper position: [${initialPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

  // Find the chat input and type a pickup command
  console.log('\n=== Sending pickup command ===');

  // Wait a bit more for chat panel to appear
  await page.waitForTimeout(2000);

  // Try multiple selectors
  let chatInput = await page.$('textarea[placeholder*="robot"]');
  if (!chatInput) {
    chatInput = await page.$('textarea[placeholder*="Tell"]');
  }
  if (!chatInput) {
    // Maybe need to click something to show chat panel first
    const chatButton = await page.$('button:has-text("AI Chat")');
    if (chatButton) {
      console.log('Found AI Chat button, clicking...');
      try {
        await chatButton.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1500);
        chatInput = await page.$('textarea');
      } catch (e) {
        console.log('Could not click AI Chat button:', e.message);
      }
    }
  }
  if (!chatInput) {
    // Just get any textarea
    chatInput = await page.$('textarea');
  }

  console.log('Chat input found:', !!chatInput);

  // Take a screenshot to see UI layout
  await page.screenshot({ path: 'test-screenshots/ui-layout.png' });
  console.log('Screenshot saved to test-screenshots/ui-layout.png');

  // If still no chat input, list all textareas and buttons
  if (!chatInput) {
    const allTextareas = await page.$$('textarea');
    console.log('Number of textareas found:', allTextareas.length);

    const allButtons = await page.$$('button');
    console.log('Number of buttons found:', allButtons.length);

    // Print button texts
    for (const btn of allButtons.slice(0, 10)) {
      const text = await btn.textContent();
      console.log('Button:', text?.slice(0, 30));
    }
  }

  if (chatInput) {
    await chatInput.fill('pick up the blue block');
    await chatInput.press('Enter');

    console.log('Command sent, waiting for sequence to execute...');

    // Wait for the sequence to play out
    await page.waitForTimeout(10000);

    // Get final gripper position
    const finalPos = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      return store.getState().gripperWorldPosition;
    });
    console.log(`\nFinal gripper position: [${finalPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    // Get final joint angles
    const joints = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      return store.getState().joints;
    });
    console.log('Final joints:', JSON.stringify(joints, null, 2));

    // Check if any object was grabbed
    const grabbedObjects = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      return store.getState().objects.filter(o => o.isGrabbed);
    });

    if (grabbedObjects.length > 0) {
      console.log('\n=== SUCCESS: Object grabbed! ===');
      console.log('Grabbed objects:', grabbedObjects.map(o => o.name));
    } else {
      console.log('\n=== FAILED: No object grabbed ===');

      // Check final object positions
      const finalObjects = await page.evaluate(() => {
        const store = window.__ZUSTAND_STORE__;
        return store.getState().objects.map(o => ({
          name: o.name,
          position: o.position,
          isGrabbed: o.isGrabbed
        }));
      });
      console.log('Final object positions:', JSON.stringify(finalObjects, null, 2));
    }

  } else {
    console.log('Could not find chat input!');
  }

  // Keep browser open for inspection
  console.log('\nTest complete. Browser will stay open for 20 seconds for inspection...');
  await page.waitForTimeout(20000);

  await browser.close();
};

run().catch(console.error);
