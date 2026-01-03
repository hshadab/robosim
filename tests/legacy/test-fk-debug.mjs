/**
 * Debug FK calculation vs actual URDF position
 * Run with: node test-fk-debug.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Debugging FK calculations...\n');

  const browser = await chromium.launch({ headless: true }); // headless for CI
  const context = await browser.newContext();
  const page = await context.newPage();

  // Auth bypass
  await context.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 'test', email: 'test@test.com', name: 'Test' }));
    localStorage.setItem('auth_timestamp', Date.now().toString());
  });

  // Listen to console for FK Compare logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[FK Compare]') || text.includes('[SO101Arm3D]')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('Loading app...');
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000); // Wait for URDF to load

  // Test configurations
  const testConfigs = [
    { name: 'Home', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Shoulder -45', joints: { base: 0, shoulder: -45, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Shoulder -90', joints: { base: 0, shoulder: -90, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Grasp pose', joints: { base: 0, shoulder: -97, elbow: 80, wrist: 90, wristRoll: 0, gripper: 0 } },
    { name: 'Elbow only', joints: { base: 0, shoulder: 0, elbow: 80, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Base 90', joints: { base: 90, shoulder: -80, elbow: 70, wrist: 70, wristRoll: 0, gripper: 50 } },
  ];

  for (const config of testConfigs) {
    console.log(`\n=== Testing: ${config.name} ===`);
    console.log('Setting joints:', JSON.stringify(config.joints));

    // Set joints via store
    await page.evaluate((joints) => {
      const store = window.__ZUSTAND_STORE__;
      if (store) {
        store.getState().setJoints(joints);
      }
    }, config.joints);

    // Wait for FK update and logging
    await page.waitForTimeout(1000);

    // Get the store values
    const storeData = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      if (!store) return null;
      const state = store.getState();
      return {
        joints: state.joints,
        gripperPos: state.gripperWorldPosition,
      };
    });

    if (storeData) {
      console.log('Store joints:', JSON.stringify(storeData.joints));
      console.log(`Store gripperWorldPosition: [${storeData.gripperPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('Watch the console output above for [FK Compare] logs showing the difference between');
  console.log('our FK calculation and the actual URDF position.');

  await browser.close();
};

run().catch(console.error);
