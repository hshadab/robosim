/**
 * Direct test of pickup IK without UI
 * Tests the IK calculations and store updates directly
 * Run with: node test-pickup-direct.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Starting direct pickup test (bypassing UI)...\n');

  const browser = await chromium.launch({ headless: true }); // headless for faster execution
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[solveIKForTarget]') ||
        text.includes('[handlePickUpCommand]') ||
        text.includes('[calculateGraspJoints]') ||
        text.includes('[GripperInteraction]') ||
        text.includes('IK error') ||
        text.includes('WARNING')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('Loading app...');
  await page.goto('http://localhost:5174');

  // Wait for app to load (even on landing page, the store should be available)
  await page.waitForTimeout(3000);

  // Check if store is available
  const storeAvailable = await page.evaluate(() => {
    return !!window.__ZUSTAND_STORE__;
  });
  console.log('Store available:', storeAvailable);

  if (!storeAvailable) {
    console.log('Store not available, exiting');
    await browser.close();
    return;
  }

  // Add an object at a REACHABLE position directly via store
  console.log('\nAdding blue block at reachable position [0.12, 0.05, 0.0]...');
  await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    store.getState().spawnObject({
      name: 'Blue Block',
      type: 'cube',
      color: '#3498db',
      scale: 0.04,
      mass: 0.1,
      position: [0.12, 0.05, 0.0], // X=12cm, Z=0 - directly in front
      rotation: [0, 0, 0],
      isGrabbable: true,
      isGrabbed: false,
      isInTargetZone: false,
    });
  });

  // Get objects to verify
  const objects = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store.getState().objects.map(o => ({
      id: o.id,
      name: o.name,
      position: o.position,
      isGrabbable: o.isGrabbable
    }));
  });
  console.log('Objects:', JSON.stringify(objects, null, 2));

  // Import and call the claudeApi handlePickUpCommand logic directly
  console.log('\n=== Testing pickup IK directly ===\n');

  const result = await page.evaluate(async () => {
    // Import the module dynamically
    const module = await import('/src/lib/claudeApi.ts');

    // Get current state
    const store = window.__ZUSTAND_STORE__;
    const state = store.getState();

    // Call the API with a pickup message
    const response = await module.callClaudeAPI(
      'pick up the blue block',
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
      null, // no API key, use demo mode
      []
    );

    return response;
  });

  console.log('Pickup response:');
  console.log('  Action:', result.action);
  console.log('  Description:', result.description);

  if (result.joints && Array.isArray(result.joints)) {
    console.log('\n  Sequence steps:');
    for (let i = 0; i < result.joints.length; i++) {
      const step = result.joints[i];
      console.log(`    Step ${i + 1}:`, JSON.stringify(step));
    }
  }

  // Execute the sequence
  if (result.action === 'sequence' && result.joints) {
    console.log('\n=== Executing pickup sequence ===');

    const sequence = result.joints;
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      console.log(`\nExecuting step ${i + 1}/${sequence.length}:`, JSON.stringify(step));

      await page.evaluate((jointUpdate) => {
        const store = window.__ZUSTAND_STORE__;
        store.getState().setJoints(jointUpdate);
      }, step);

      // Wait for animation/update
      await page.waitForTimeout(800);

      // Get gripper position after this step
      const pos = await page.evaluate(() => {
        const store = window.__ZUSTAND_STORE__;
        return store.getState().gripperWorldPosition;
      });
      console.log(`  Gripper position: [${pos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    }

    // Check final state
    await page.waitForTimeout(500);
    const finalState = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      const state = store.getState();
      return {
        joints: state.joints,
        gripperPos: state.gripperWorldPosition,
        objects: state.objects.map(o => ({
          name: o.name,
          position: o.position,
          isGrabbed: o.isGrabbed
        }))
      };
    });

    console.log('\n=== Final State ===');
    console.log('Joints:', JSON.stringify(finalState.joints, null, 2));
    console.log('Gripper position:', finalState.gripperPos.map(p => (p*100).toFixed(1)), 'cm');
    console.log('Objects:', JSON.stringify(finalState.objects, null, 2));

    const grabbed = finalState.objects.find(o => o.isGrabbed);
    if (grabbed) {
      console.log('\n=== SUCCESS: Object grabbed! ===');
    } else {
      console.log('\n=== Object NOT grabbed ===');
      console.log('Check if gripper position is close enough to object');
    }
  }

  await browser.close();
  console.log('\nTest complete.');
};

run().catch(console.error);
