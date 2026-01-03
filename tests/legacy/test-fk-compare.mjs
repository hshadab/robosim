/**
 * Compare our FK calculation with actual URDF model FK
 * Run with: node test-fk-compare.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Comparing FK calculations...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Auth bypass
  await context.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 'test', email: 'test@test.com', name: 'Test' }));
    localStorage.setItem('auth_timestamp', Date.now().toString());
  });

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(5000); // Wait for URDF to load

  // Test various joint configurations
  const testConfigs = [
    { name: 'Home', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Shoulder -90', joints: { base: 0, shoulder: -90, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Elbow 90', joints: { base: 0, shoulder: 0, elbow: 90, wrist: 0, wristRoll: 0 } },
    { name: 'Grasp pose', joints: { base: 0, shoulder: -97, elbow: 80, wrist: 90, wristRoll: 0 } },
    { name: 'Base 90', joints: { base: 90, shoulder: -80, elbow: 70, wrist: 70, wristRoll: 0 } },
  ];

  for (const config of testConfigs) {
    console.log(`\n=== Testing: ${config.name} ===`);
    console.log('Joints:', JSON.stringify(config.joints));

    // Calculate using our FK
    const ourFK = await page.evaluate(async (joints) => {
      const module = await import('/src/components/simulation/SO101KinematicsURDF.ts');
      return module.calculateGripperPositionURDF(joints);
    }, config.joints);

    console.log(`Our FK: [${ourFK.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    // Set joints and get actual URDF position
    await page.evaluate((joints) => {
      const store = window.__ZUSTAND_STORE__;
      if (store) {
        store.getState().setJoints(joints);
      }
    }, config.joints);

    await page.waitForTimeout(500); // Wait for FK to update

    const actualPos = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      return store ? store.getState().gripperWorldPosition : [0, 0, 0];
    });

    console.log(`URDF FK: [${actualPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    // Calculate difference
    const diff = [
      Math.abs(ourFK[0] - actualPos[0]) * 100,
      Math.abs(ourFK[1] - actualPos[1]) * 100,
      Math.abs(ourFK[2] - actualPos[2]) * 100,
    ];
    console.log(`Diff: [${diff.map(d => d.toFixed(1)).join(', ')}]cm`);
  }

  await browser.close();
  console.log('\nTest complete.');
};

run().catch(console.error);
