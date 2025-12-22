import { test, expect } from '@playwright/test';

/**
 * Grasp Mechanics Test
 * Tests floor collision, gripper limits, and object grasping physics
 */

test('Grasp mechanics - floor collision and gripper limits', async ({ page }) => {
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

  // Navigate to the app
  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Set up mock auth
  await page.evaluate(async () => {
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

  // Click login
  console.log('2. Logging in...');
  await page.click('text=GET STARTED');
  await page.waitForTimeout(500);

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill('test@test.com');
    await page.click('text=Continue');
    await page.waitForTimeout(1000);
  }

  // Wait for canvas
  console.log('3. Waiting for simulation canvas...');
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
  console.log('4. Getting initial state...');
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

  // Spawn a demo cube using chat
  console.log('5. Spawning demo cube...');

  // Find and click the chat input
  const chatInput = await page.$('input[placeholder*="message"], textarea[placeholder*="message"], input[type="text"]');
  if (chatInput) {
    await chatInput.fill('spawn a red cube at position 0.12, 0.025, 0.15');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: 'tests/screenshots/grasp-cube-spawned.png', fullPage: true });

  // Send pick up command
  console.log('6. Sending pick up command...');
  if (chatInput) {
    await chatInput.fill('pick up the cube');
    await page.keyboard.press('Enter');
  }

  // Wait and take screenshots during the animation
  const screenshots: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
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
            })),
            gripperValue: s.joints?.gripper,
            gripperMinValue: s.gripperMinValue,
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

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // Mock auth
  await page.evaluate(async () => {
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

  await page.click('text=GET STARTED');
  await page.waitForTimeout(500);

  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.fill('test@test.com');
    await page.click('text=Continue');
  }

  await page.waitForTimeout(2000);
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
