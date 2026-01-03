/**
 * Automated test for gripper position tracking and grab detection
 * Run with: npx playwright test test-gripper-grab.mjs --headed
 */

import { test, expect } from '@playwright/test';

// Helper to wait and get store state
async function getStoreState(page) {
  return await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    if (!store) return null;
    const state = store.getState();
    return {
      joints: state.joints,
      gripperWorldPosition: state.gripperWorldPosition,
      objects: state.objects.map(o => ({
        id: o.id,
        name: o.name,
        position: o.position,
        isGrabbed: o.isGrabbed,
        isGrabbable: o.isGrabbable,
      })),
    };
  });
}

// Helper to set joints
async function setJoints(page, joints) {
  const before = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store ? store.getState().joints : null;
  });

  await page.evaluate((j) => {
    const store = window.__ZUSTAND_STORE__;
    if (store) store.getState().setJoints(j);
  }, joints);

  // Wait longer for URDF model to update (useFrame runs each render)
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__;
    return store ? store.getState().joints : null;
  });

  // Verify joints changed
  if (JSON.stringify(before) === JSON.stringify(after)) {
    console.log('WARNING: Joints did not change!', { before, after, requested: joints });
  }
}

// Helper to calculate distance
function distance3D(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

test.describe('Gripper Position and Grab Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Add console listener for ALL logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('SO101') || text.includes('Links') || text.includes('Error') || text.includes('URDF') || msg.type() === 'error') {
        console.log(`[Browser ${msg.type()}] ${text}`);
      }
    });

    await page.goto('http://localhost:5173');
    console.log('Page loaded, bypassing auth with mockLogin...');

    // Wait for page to initialize
    await page.waitForTimeout(1000);

    // Use mockLogin to bypass authentication
    await page.evaluate(async () => {
      // Access the auth store - it's exposed as a Zustand store
      const authStore = window.__ZUSTAND_AUTH_STORE__;
      if (authStore) {
        await authStore.getState().mockLogin('test@robosim.dev');
        console.log('Mock login successful');
      } else {
        // Try to find it via the module
        console.log('Auth store not found on window, trying alternative...');
      }
    });

    await page.waitForTimeout(500);

    // Check if we're authenticated now
    const isAuth = await page.evaluate(() => {
      const authStore = window.__ZUSTAND_AUTH_STORE__;
      return authStore ? authStore.getState().isAuthenticated : false;
    });
    console.log('Authenticated:', isAuth);

    // If not authenticated, try setting localStorage directly and reloading
    if (!isAuth) {
      console.log('Setting auth via localStorage...');
      await page.evaluate(() => {
        const mockAuthState = {
          state: {
            isAuthenticated: true,
            user: {
              id: 'test-user-id',
              email: 'test@robosim.dev',
              user_metadata: { full_name: 'Test User' },
              app_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString(),
            },
            profile: {
              id: 'test-user-id',
              email: 'test@robosim.dev',
              full_name: 'Test User',
              tier: 'free',
            }
          },
          version: 0
        };
        localStorage.setItem('robosim-auth', JSON.stringify(mockAuthState));
      });
      await page.reload();
      await page.waitForTimeout(2000);
    }

    // Handle tutorial modal if present
    const skipTutorialButton = page.locator('button:has-text("Skip Tutorial"), button:has-text("Got it")').first();
    if (await skipTutorialButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found tutorial, skipping...');
      await skipTutorialButton.click();
      await page.waitForTimeout(1000);
    }

    console.log('Waiting for simulator to load...');
    await page.waitForTimeout(3000); // Wait for scene to initialize

    // Set environment to 'obstacles' which has objects
    await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      if (store) {
        store.getState().setEnvironment('obstacles');
      }
    });
    console.log('Set environment to obstacles');
    await page.waitForTimeout(5000); // Wait for scene and URDF to load

    // Debug: Check what's in the store and Three.js scene
    const debugState = await page.evaluate(() => {
      const store = window.__ZUSTAND_STORE__;
      if (!store) return { error: 'No store' };
      const state = store.getState();

      // Check if Three.js scene exists
      let threeInfo = { found: false };
      if (window.__THREE_DEVTOOLS__) {
        threeInfo.devtools = true;
      }

      // Try to find the canvas element
      const canvas = document.querySelector('canvas');
      if (canvas) {
        threeInfo.canvasFound = true;
        threeInfo.canvasSize = { width: canvas.width, height: canvas.height };
      }

      return {
        hasStore: true,
        objectCount: state.objects?.length || 0,
        gripperPos: state.gripperWorldPosition,
        joints: state.joints,
        environment: state.currentEnvironment,
        threeInfo,
      };
    });
    console.log('Store state:', JSON.stringify(debugState, null, 2));

    // Take a debug screenshot after setup
    await page.screenshot({ path: 'test-screenshots/debug-after-setup.png' });

    expect(debugState.hasStore).toBe(true);
  });

  test('Gripper world position tracks actual gripper', async ({ page }) => {
    console.log('\n=== Test: Gripper Position Tracking ===\n');

    // Test multiple joint configurations
    const testCases = [
      { name: 'Home', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, gripper: 100 } },
      { name: 'Forward reach', joints: { base: 0, shoulder: 30, elbow: 30, wrist: 30, gripper: 100 } },
      { name: 'Right side', joints: { base: 45, shoulder: 20, elbow: 40, wrist: 50, gripper: 100 } },
      { name: 'Left side', joints: { base: -45, shoulder: 20, elbow: 40, wrist: 50, gripper: 100 } },
    ];

    for (const tc of testCases) {
      await setJoints(page, tc.joints);
      await page.waitForTimeout(200);

      const state = await getStoreState(page);
      const pos = state.gripperWorldPosition;

      console.log(`${tc.name}:`);
      console.log(`  Joints: base=${tc.joints.base}°, shoulder=${tc.joints.shoulder}°, elbow=${tc.joints.elbow}°, wrist=${tc.joints.wrist}°`);
      console.log(`  Gripper pos: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm`);

      // Basic sanity checks
      expect(pos[1]).toBeGreaterThan(-0.1); // Y should be above ground (with some tolerance)
      expect(Math.abs(pos[0]) + Math.abs(pos[2])).toBeLessThan(0.5); // Within 50cm reach
    }

    await page.screenshot({ path: 'test-screenshots/gripper-tracking.png' });
  });

  test('Grab detection with closed gripper near object', async ({ page }) => {
    console.log('\n=== Test: Grab Detection ===\n');

    // Get initial state
    let state = await getStoreState(page);
    const obj = state.objects.find(o => o.isGrabbable);

    if (!obj) {
      console.log('No grabbable object found, skipping test');
      return;
    }

    console.log(`Target object: "${obj.name}" at [${obj.position.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    // Calculate what base angle should point toward the object
    const objX = obj.position[0];
    const objZ = obj.position[2];
    const rawAngle = Math.atan2(objX, objZ) * (180 / Math.PI);
    const baseAngle = rawAngle + 48; // Apply offset

    console.log(`Calculated base angle: raw=${rawAngle.toFixed(1)}°, corrected=${baseAngle.toFixed(1)}°`);

    // Move arm toward object with gripper open
    await setJoints(page, {
      base: baseAngle,
      shoulder: 30,
      elbow: 40,
      wrist: 50,
      gripper: 100, // Open
    });
    await page.waitForTimeout(500);

    state = await getStoreState(page);
    let gripperPos = state.gripperWorldPosition;
    let distToObj = distance3D(gripperPos, obj.position);

    console.log(`After positioning:`);
    console.log(`  Gripper: [${(gripperPos[0]*100).toFixed(1)}, ${(gripperPos[1]*100).toFixed(1)}, ${(gripperPos[2]*100).toFixed(1)}]cm`);
    console.log(`  Distance to object: ${(distToObj*100).toFixed(1)}cm`);

    await page.screenshot({ path: 'test-screenshots/grab-test-positioned.png' });

    // Try different arm configurations to get closer
    const armConfigs = [
      { shoulder: 20, elbow: 50, wrist: 60 },
      { shoulder: 10, elbow: 60, wrist: 70 },
      { shoulder: 5, elbow: 40, wrist: 90 },
      { shoulder: 15, elbow: 35, wrist: 80 },
    ];

    let bestConfig = null;
    let bestDist = Infinity;

    for (const config of armConfigs) {
      await setJoints(page, { base: baseAngle, ...config, gripper: 100 });
      await page.waitForTimeout(200);

      state = await getStoreState(page);
      gripperPos = state.gripperWorldPosition;
      distToObj = distance3D(gripperPos, obj.position);

      console.log(`  Config shoulder=${config.shoulder}, elbow=${config.elbow}, wrist=${config.wrist}: dist=${(distToObj*100).toFixed(1)}cm`);

      if (distToObj < bestDist) {
        bestDist = distToObj;
        bestConfig = config;
      }
    }

    console.log(`\nBest config: shoulder=${bestConfig.shoulder}, elbow=${bestConfig.elbow}, wrist=${bestConfig.wrist}`);
    console.log(`Best distance: ${(bestDist*100).toFixed(1)}cm`);

    // Apply best config and close gripper
    await setJoints(page, { base: baseAngle, ...bestConfig, gripper: 100 });
    await page.waitForTimeout(300);

    // Now close gripper to attempt grab
    console.log('\nClosing gripper...');
    await setJoints(page, { base: baseAngle, ...bestConfig, gripper: 0 });
    await page.waitForTimeout(500);

    // Check if object was grabbed
    state = await getStoreState(page);
    const grabbedObj = state.objects.find(o => o.id === obj.id);

    console.log(`Object grabbed: ${grabbedObj?.isGrabbed}`);
    console.log(`Object position after grab: [${grabbedObj?.position.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    await page.screenshot({ path: 'test-screenshots/grab-test-closed.png' });

    // If grabbed, test that object follows gripper
    if (grabbedObj?.isGrabbed) {
      console.log('\nTesting object follows gripper...');

      // Move arm
      await setJoints(page, { base: baseAngle + 20, shoulder: -20, elbow: 30, wrist: 40, gripper: 0 });
      await page.waitForTimeout(500);

      state = await getStoreState(page);
      const movedObj = state.objects.find(o => o.id === obj.id);
      gripperPos = state.gripperWorldPosition;

      console.log(`After moving arm:`);
      console.log(`  Gripper: [${(gripperPos[0]*100).toFixed(1)}, ${(gripperPos[1]*100).toFixed(1)}, ${(gripperPos[2]*100).toFixed(1)}]cm`);
      console.log(`  Object: [${movedObj?.position.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

      await page.screenshot({ path: 'test-screenshots/grab-test-moved.png' });
    }
  });

  test('Chat pickup command', async ({ page }) => {
    console.log('\n=== Test: Chat Pickup Command ===\n');

    // Get initial object position
    let state = await getStoreState(page);
    const obj = state.objects.find(o => o.isGrabbable);

    if (!obj) {
      console.log('No grabbable object found');
      return;
    }

    console.log(`Target: "${obj.name}" at [${obj.position.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    await page.screenshot({ path: 'test-screenshots/pickup-before.png' });

    // Type pickup command in chat
    const chatInput = page.locator('textarea[placeholder*="Type"], input[placeholder*="Type"]').first();
    await chatInput.fill(`pick up the ${obj.name?.toLowerCase() || 'red block'}`);
    await chatInput.press('Enter');

    // Wait for animation to complete
    console.log('Waiting for pickup animation...');
    await page.waitForTimeout(8000);

    await page.screenshot({ path: 'test-screenshots/pickup-after.png' });

    // Check final state
    state = await getStoreState(page);
    const finalObj = state.objects.find(o => o.id === obj.id);

    console.log(`\nFinal state:`);
    console.log(`  Object grabbed: ${finalObj?.isGrabbed}`);
    console.log(`  Object position: [${finalObj?.position.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    console.log(`  Gripper position: [${state.gripperWorldPosition.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  });
});
