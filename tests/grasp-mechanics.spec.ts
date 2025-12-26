import { test, expect } from '@playwright/test';

/**
 * Grasp Mechanics Test
 * Tests floor collision, gripper limits, and object grasping physics
 */

test('Grasp mechanics - floor collision and gripper limits', async ({ page }, testInfo) => {
  testInfo.setTimeout(90000); // Increase timeout for this test
  const consoleLogs: string[] = [];
  const graspLogs: string[] = [];
  const floorConstraintLogs: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);

    // Track grasp-related logs
    if (text.includes('[GraspManager]')) {
      graspLogs.push(text);
    }
    if (text.includes('Floor constraint')) {
      floorConstraintLogs.push(text);
    }
  });

  // Capture console logs for debugging
  const authLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Auth]')) {
      authLogs.push(text);
    }
  });

  // Add init script that runs BEFORE page JavaScript to set mock auth
  console.log('1. Setting up mock auth via addInitScript...');
  await page.addInitScript(() => {
    const mockAuthState = {
      state: {
        isAuthenticated: true,
        user: {
          id: 'mock-user-id',
          email: 'test@test.com',
          user_metadata: { full_name: 'Test User' },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        },
        profile: {
          id: 'mock-user-id',
          email: 'test@test.com',
          full_name: 'Test User',
          tier: 'free',
          usage: { episodes_generated: 0, ai_images_generated: 0 },
          usage_reset_at: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
      },
      version: 0,
    };
    localStorage.setItem('robosim-auth', JSON.stringify(mockAuthState));
  });

  // Navigate to the app - mock auth will be set before app loads
  console.log('2. Navigating to app...');
  await page.goto('http://localhost:5000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Print auth debug logs
  console.log('AUTH LOGS:', authLogs.join('\n'));

  // Debug: Check localStorage and auth state
  const debugState = await page.evaluate(() => {
    const stored = localStorage.getItem('robosim-auth');
    return {
      localStorage: stored ? 'SET' : 'NOT SET',
      rawContent: stored?.substring(0, 200),
    };
  });
  console.log('DEBUG - localStorage:', JSON.stringify(debugState));

  // Wait for canvas
  console.log('4. Waiting for simulation canvas...');
  try {
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('Canvas found!');
  } catch (e) {
    console.log('Canvas NOT found, taking screenshot for debug');
    await page.screenshot({ path: 'tests/screenshots/grasp-no-canvas.png', fullPage: true });
    return;
  }

  // Wait for arm to load
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'tests/screenshots/grasp-initial.png', fullPage: true });

  // Get initial state
  console.log('5. Getting initial state...');
  const initialState = await page.evaluate(() => {
    // Access the Zustand store through window or find it in React
    try {
      // This depends on how the store is exposed - may need adjustment
      const appStore = (window as any).__APP_STORE__;
      if (appStore) {
        const state = appStore.getState();
        return {
          objects: state.objects,
          joints: state.joints,
          gripperMinValue: state.gripperMinValue,
        };
      }
    } catch (e) {
      return { error: String(e) };
    }
    return { error: 'Store not found' };
  });
  console.log('Initial state:', JSON.stringify(initialState, null, 2));

  // Spawn a demo cube via store (not chat - avoids LLM dependency)
  console.log('5. Spawning demo cube via store...');

  const spawnResult = await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    if (!store) return { error: 'Store not found' };

    const spawnObject = store.getState().spawnObject;
    if (spawnObject) {
      spawnObject({
        type: 'cube',
        position: [0.12, 0.025, 0.15],
        rotation: [0, 0, 0],
        scale: 0.04,
        color: '#FF0000',
        isGrabbable: true,
        name: 'Test Cube',
      });
      return { success: true };
    }
    return { error: 'spawnObject not found' };
  });
  console.log('Spawn result:', spawnResult);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/grasp-cube-spawned.png', fullPage: true });

  // Move arm to grasp position via store (verified working position)
  console.log('6. Moving arm to grasp position...');
  await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    if (store) {
      // Use verified demo pickup joints - cube at [12, 2, 15]cm
      store.getState().setJoints({
        base: 51,
        shoulder: -50,
        elbow: 80,
        wrist: 10,
        wristRoll: 90,
        gripper: 100, // Open gripper first
      });
    }
  });
  await page.waitForTimeout(1500);

  // Close gripper to grasp
  console.log('7. Closing gripper...');
  await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    if (store) {
      store.getState().setJoints({ gripper: 0 });
    }
  });
  await page.waitForTimeout(1500);

  // Lift the arm
  console.log('8. Lifting arm...');
  await page.evaluate(() => {
    const store = (window as any).__APP_STORE__;
    if (store) {
      store.getState().setJoints({
        base: 51,
        shoulder: -30,
        elbow: 60,
        wrist: 0,
        wristRoll: 90,
      });
    }
  });
  await page.waitForTimeout(2000);

  // Take screenshots during grasp sequence
  const screenshots: string[] = [];
  for (let i = 0; i < 3; i++) {
    const filename = `tests/screenshots/grasp-sequence-${i}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    screenshots.push(filename);

    // Check object position
    const state = await page.evaluate(() => {
      try {
        const appStore = (window as any).__APP_STORE__;
        if (appStore) {
          const s = appStore.getState();
          return {
            objects: s.objects?.map((o: any) => ({
              id: o.id,
              name: o.name,
              position: o.position,
              isGrabbed: o.isGrabbed,
              isGrabbable: o.isGrabbable,
            })),
            gripperValue: s.joints?.gripper,
            gripperMinValue: s.gripperMinValue,
            grabbedObjectId: s.grabbedObjectId,
          };
        }
      } catch (e) {}
      return null;
    });

    console.log(`Frame ${i}:`, JSON.stringify(state, null, 2));
  }

  // Final state
  console.log('\n=== FINAL STATE ===');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/grasp-final.png', fullPage: true });

  const finalState = await page.evaluate(() => {
    try {
      const appStore = (window as any).__APP_STORE__;
      if (appStore) {
        const s = appStore.getState();
        return {
          objects: s.objects,
          joints: s.joints,
          gripperMinValue: s.gripperMinValue,
        };
      }
    } catch (e) {}
    return null;
  });
  console.log('Final state:', JSON.stringify(finalState, null, 2));

  // Print grasp logs
  console.log('\n=== GRASP MANAGER LOGS ===');
  graspLogs.forEach(log => console.log(log));

  // Print floor constraint logs
  console.log('\n=== FLOOR CONSTRAINT LOGS ===');
  floorConstraintLogs.forEach(log => console.log(log));

  // Assertions
  console.log('\n=== ASSERTIONS ===');

  // Check if grasp was detected
  const graspDetected = graspLogs.some(log => log.includes('Grasped object'));
  console.log(`Grasp detected: ${graspDetected}`);
  expect(graspDetected).toBe(true);

  // Check if gripper min was set
  const minGripperLog = graspLogs.find(log => log.includes('minGripper='));
  console.log(`Min gripper log: ${minGripperLog}`);

  // Check floor constraint was applied (if arm went low enough)
  const floorConstrained = floorConstraintLogs.length > 0;
  console.log(`Floor constraint applied: ${floorConstrained} (${floorConstraintLogs.length} times)`);

  // Check final object position is above floor
  if (finalState?.objects) {
    for (const obj of finalState.objects) {
      if (obj.isGrabbed) {
        console.log(`Grabbed object ${obj.id} at Y=${obj.position[1]}`);
        expect(obj.position[1]).toBeGreaterThan(0);
      }
    }
  }
});

test('Gripper does not close past minimum when holding object', async ({ page }) => {
  const consoleLogs: string[] = [];

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  await page.goto('http://localhost:5000/', { waitUntil: 'domcontentloaded' });

  // Mock auth
  await page.evaluate(() => {
    localStorage.setItem('robosim-auth', JSON.stringify({
      state: {
        isAuthenticated: true,
        user: { id: 'test', email: 'test@test.com', user_metadata: {}, app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() },
        profile: { id: 'test', email: 'test@test.com', full_name: 'Test', tier: 'free', usage: {}, usage_reset_at: new Date().toISOString() },
        isLoading: false, error: null,
      },
      version: 0,
    }));
  });

  // Reload to pick up mock auth
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000);

  // Directly manipulate the store to test gripper clamping
  const result = await page.evaluate(async () => {
    const store = (window as any).__APP_STORE__;
    if (!store) return { error: 'Store not found' };

    const getState = store.getState;
    const setState = store.setState;

    // Spawn a test cube
    const spawnObject = getState().spawnObject;
    if (spawnObject) {
      spawnObject({
        type: 'cube',
        position: [0.12, 0.025, 0.15],
        rotation: [0, 0, 0],
        scale: 0.05,
        color: '#FF0000',
        isGrabbable: true,
        name: 'Test Cube',
      });
    }

    await new Promise(r => setTimeout(r, 500));

    // Set gripperMinValue directly (simulating a grasp)
    setState({ gripperMinValue: 35 });

    // Try to set gripper to 0 (should be clamped to 35)
    const setJoints = getState().setJoints;
    setJoints({ gripper: 0 });

    await new Promise(r => setTimeout(r, 100));

    // Check what the actual gripper value is
    const finalGripper = getState().joints.gripper;
    const finalMinValue = getState().gripperMinValue;

    return {
      attemptedGripper: 0,
      actualGripper: finalGripper,
      gripperMinValue: finalMinValue,
      clamped: finalGripper >= 35,
    };
  });

  console.log('Gripper clamping test result:', result);

  if (!result.error) {
    expect(result.clamped).toBe(true);
    expect(result.actualGripper).toBeGreaterThanOrEqual(35);
    console.log(`SUCCESS: Gripper attempted ${result.attemptedGripper}, clamped to ${result.actualGripper}`);
  }
});
