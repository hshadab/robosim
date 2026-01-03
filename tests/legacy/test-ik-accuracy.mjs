/**
 * Test IK accuracy for various object positions
 * Run with: node test-ik-accuracy.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Testing IK accuracy for various object positions...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Auth bypass
  await context.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 'test', email: 'test@test.com', name: 'Test' }));
    localStorage.setItem('auth_timestamp', Date.now().toString());
  });

  // Capture IK logs
  const ikLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[solveIKForTarget]') || text.includes('[handlePickUpCommand]')) {
      ikLogs.push(text);
    }
  });

  console.log('Loading app...');
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);

  // Test positions at various angles
  const testPositions = [
    { x: 0.12, y: 0.05, z: 0.00, name: 'Front (Z=0)' },
    { x: 0.10, y: 0.05, z: 0.05, name: 'Front-Right' },
    { x: 0.05, y: 0.05, z: 0.10, name: 'Right (small X)' },
    { x: 0.00, y: 0.05, z: 0.12, name: 'Right (X=0)' },
    { x: -0.05, y: 0.05, z: 0.10, name: 'Back-Right' },
    { x: 0.08, y: 0.05, z: 0.08, name: 'Diagonal' },
  ];

  for (const pos of testPositions) {
    console.log(`\n=== Testing: ${pos.name} at [${(pos.x*100).toFixed(0)}, ${(pos.y*100).toFixed(0)}, ${(pos.z*100).toFixed(0)}]cm ===`);
    ikLogs.length = 0;

    // Spawn object at this position
    await page.evaluate((p) => {
      const store = window.__ZUSTAND_STORE__;
      if (store) {
        // Clear previous objects
        store.getState().clearObjects();
        // Spawn new object
        store.getState().spawnObject({
          name: 'Test Block',
          type: 'cube',
          color: '#3498db',
          scale: 0.04,
          mass: 0.1,
          position: [p.x, p.y, p.z],
          rotation: [0, 0, 0],
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        });
      }
    }, pos);

    await page.waitForTimeout(500);

    // Call pickup
    await page.evaluate(async () => {
      const module = await import('/src/lib/claudeApi.ts');
      const store = window.__ZUSTAND_STORE__;
      const state = store.getState();

      await module.callClaudeAPI(
        'pick up the test block',
        'arm',
        {
          joints: state.joints,
          wheeledRobot: {},
          drone: {},
          humanoid: {},
          sensors: state.sensors,
          isAnimating: false,
          objects: state.objects,
        },
        null,
        []
      );
    });

    await page.waitForTimeout(500);

    // Parse and display IK results
    const graspLog = ikLogs.find(l => l.includes('Grasp:') && l.includes('shoulder'));
    const errorLog = ikLogs.find(l => l.includes('IK errors:'));

    if (graspLog) console.log('  ' + graspLog.replace('BROWSER: ', ''));
    if (errorLog) console.log('  ' + errorLog.replace('BROWSER: ', ''));

    const graspIkLog = ikLogs.find(l => l.includes('[solveIKForTarget]') && l.includes('Target') && l.includes('2.0'));
    const achievedLog = ikLogs.find(l => l.includes('[solveIKForTarget]') && l.includes('Achieved') && l.includes('2.0'));
    if (graspIkLog) console.log('  ' + graspIkLog.replace('BROWSER: ', ''));
    if (achievedLog) console.log('  ' + achievedLog.replace('BROWSER: ', ''));
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
};

run().catch(console.error);
