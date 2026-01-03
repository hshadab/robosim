/**
 * Browser-based test to compare actual gripper position vs FK formula
 * Run with: npx playwright test test-arm-positions.mjs --headed
 */

import { test, expect } from '@playwright/test';

test.describe('Robot Arm Position Tests', () => {

  test('Compare actual gripper position vs FK formula', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5173');

    // Wait for the 3D scene to load
    await page.waitForTimeout(3000);

    // Test multiple joint configurations
    const testCases = [
      { name: 'Home', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0 } },
      { name: 'Forward reach', joints: { base: 0, shoulder: 45, elbow: 45, wrist: 0 } },
      { name: 'Known good from screenshot', joints: { base: 77, shoulder: 6, elbow: 36, wrist: 92 } },
      { name: 'Negative angles', joints: { base: -29, shoulder: -94, elbow: -97, wrist: -95 } },
    ];

    for (const tc of testCases) {
      console.log(`\n=== Testing: ${tc.name} ===`);
      console.log(`Joints: base=${tc.joints.base}°, shoulder=${tc.joints.shoulder}°, elbow=${tc.joints.elbow}°, wrist=${tc.joints.wrist}°`);

      // Set joints via the store
      await page.evaluate((joints) => {
        const store = window.__ZUSTAND_STORE__;
        if (store) {
          store.getState().setJoints(joints);
        }
      }, tc.joints);

      await page.waitForTimeout(500); // Wait for animation

      // Get the actual gripper position from Three.js scene
      const result = await page.evaluate(() => {
        // Access the Three.js scene
        const canvas = document.querySelector('canvas');
        if (!canvas) return { error: 'No canvas found' };

        // Get the store state
        const store = window.__ZUSTAND_STORE__;
        if (!store) return { error: 'No store found' };

        const state = store.getState();
        const joints = state.joints;

        // Calculate FK position using the formula
        const SO101_DIMS = {
          baseHeight: 0.025,
          link1Height: 0.0624,
          link2Length: 0.0542,
          link3Length: 0.11257,
          link4Length: 0.1349,
          link5Length: 0.0611,
          gripperLength: 0.098,
          shoulderOffset: 0.0388,
        };

        const baseRad = (joints.base * Math.PI) / 180;
        const shoulderRad = (joints.shoulder * Math.PI) / 180;
        const elbowRad = (joints.elbow * Math.PI) / 180;
        const wristRad = (joints.wrist * Math.PI) / 180;

        const shoulderHeight = SO101_DIMS.baseHeight + SO101_DIMS.link1Height + SO101_DIMS.link2Length;

        const angle1 = shoulderRad;
        const elbowLocal = SO101_DIMS.link3Length * Math.sin(angle1);
        const elbowUp = SO101_DIMS.link3Length * Math.cos(angle1);

        const angle2 = angle1 + elbowRad;
        const wristLocal = elbowLocal + SO101_DIMS.link4Length * Math.sin(angle2);
        const wristUp = elbowUp + SO101_DIMS.link4Length * Math.cos(angle2);

        const angle3 = angle2 + wristRad;
        const gripperLen = SO101_DIMS.link5Length + SO101_DIMS.gripperLength;
        const gripperLocal = wristLocal + gripperLen * Math.sin(angle3);
        const gripperUp = wristUp + gripperLen * Math.cos(angle3);

        const forwardDist = SO101_DIMS.shoulderOffset + gripperLocal;

        const fkX = forwardDist * Math.sin(baseRad);
        const fkZ = forwardDist * Math.cos(baseRad);
        const fkY = shoulderHeight + gripperUp;

        return {
          joints,
          fkPosition: { x: fkX, y: fkY, z: fkZ },
        };
      });

      if (result.error) {
        console.log(`Error: ${result.error}`);
        continue;
      }

      console.log(`FK Position: x=${(result.fkPosition.x * 100).toFixed(2)}cm, y=${(result.fkPosition.y * 100).toFixed(2)}cm, z=${(result.fkPosition.z * 100).toFixed(2)}cm`);
    }

    // Take a screenshot
    await page.screenshot({ path: 'test-screenshots/arm-test.png' });
  });

  test('Find correct angles for target position', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);

    // Target: [-5, 5, 9]cm = [-0.05, 0.05, 0.09]m
    const target = { x: -0.05, y: 0.05, z: 0.09 };
    console.log(`\nTarget position: x=${target.x * 100}cm, y=${target.y * 100}cm, z=${target.z * 100}cm`);

    // Try different joint configurations and measure distance to target
    const candidates = [
      { base: -29, shoulder: -94, elbow: -97, wrist: -95 }, // IK result
      { base: -77, shoulder: 6, elbow: 36, wrist: 92 },     // Mirror of known good
      { base: -45, shoulder: 30, elbow: 30, wrist: 60 },    // Reasonable forward reach
      { base: -30, shoulder: 20, elbow: 40, wrist: 70 },    // Another attempt
      { base: -50, shoulder: 10, elbow: 50, wrist: 80 },    // More extended
    ];

    for (const joints of candidates) {
      // Set joints
      await page.evaluate((j) => {
        const store = window.__ZUSTAND_STORE__;
        if (store) store.getState().setJoints({ ...j, wristRoll: 0, gripper: 100 });
      }, joints);

      await page.waitForTimeout(300);

      // Take screenshot with joints in filename
      const filename = `test-screenshots/joints_b${joints.base}_s${joints.shoulder}_e${joints.elbow}_w${joints.wrist}.png`;
      await page.screenshot({ path: filename });
      console.log(`Saved: ${filename}`);
    }
  });
});
