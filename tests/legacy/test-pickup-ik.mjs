/**
 * Test pickup IK with real SO-101 data-informed starting positions
 * Run with: node test-pickup-ik.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Starting pickup IK test...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[solveIKForTarget]') ||
        text.includes('[handlePickUpCommand]') ||
        text.includes('[calculateGraspJoints]') ||
        text.includes('[GripperInteraction]')) {
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

  // Wait for app to load
  await page.waitForTimeout(3000);

  // Check if URDF loaded by looking at store
  const urdfLoaded = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    if (!store) return false;
    const state = store.getState();
    // Check if gripper position is non-default
    const pos = state.gripperWorldPosition;
    return pos[0] !== 0 || pos[1] !== 0.15 || pos[2] !== 0;
  });

  console.log('URDF loaded:', urdfLoaded);

  // Wait more if needed
  if (!urdfLoaded) {
    console.log('Waiting for URDF to load...');
    await page.waitForTimeout(3000);
  }

  // Get initial gripper position
  const initialPos = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store.getState().gripperWorldPosition;
  });
  console.log(`Initial gripper position: [${initialPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

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

  // Find the chat input and type a pickup command
  console.log('\nSending pickup command...');

  const chatInput = await page.$('input[placeholder*="robot"], textarea[placeholder*="robot"], input[type="text"]');
  if (chatInput) {
    await chatInput.fill('pick up the block');
    await chatInput.press('Enter');

    console.log('Command sent, waiting for sequence to execute...');

    // Wait for the sequence to play out
    await page.waitForTimeout(8000);

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
    console.log('Grabbed objects:', grabbedObjects.length > 0 ? grabbedObjects.map(o => o.name) : 'NONE');

  } else {
    console.log('Could not find chat input!');
  }

  // Keep browser open for inspection
  console.log('\nTest complete. Browser will stay open for 30 seconds for inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
};

run().catch(console.error);
