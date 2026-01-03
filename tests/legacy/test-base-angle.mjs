/**
 * Test base angle mapping with URDF FK
 * Run with: node test-base-angle.mjs
 */

import { chromium } from 'playwright';

const run = async () => {
  console.log('Testing base angle mapping with URDF FK...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);

  // Test different base angles with fixed arm pose
  const testAngles = [-90, -60, -30, 0, 30, 60, 90];

  console.log('Base angle -> Gripper position (FK)');
  console.log('=====================================');

  for (const baseAngle of testAngles) {
    const pos = await page.evaluate(async (base) => {
      const module = await import('/src/components/simulation/SO101KinematicsURDF.ts');
      // Use a neutral arm pose to see base effect clearly
      const joints = { base, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
      return module.calculateGripperPositionURDF(joints);
    }, baseAngle);

    console.log(`base=${baseAngle.toString().padStart(4)}° -> X=${(pos[0]*100).toFixed(1).padStart(6)}cm, Z=${(pos[2]*100).toFixed(1).padStart(6)}cm`);
  }

  console.log('\nWith reaching pose (shoulder=-45, elbow=45, wrist=45):');
  console.log('=====================================');

  for (const baseAngle of testAngles) {
    const pos = await page.evaluate(async (base) => {
      const module = await import('/src/components/simulation/SO101KinematicsURDF.ts');
      const joints = { base, shoulder: -45, elbow: 45, wrist: 45, wristRoll: 0 };
      return module.calculateGripperPositionURDF(joints);
    }, baseAngle);

    console.log(`base=${baseAngle.toString().padStart(4)}° -> X=${(pos[0]*100).toFixed(1).padStart(6)}cm, Z=${(pos[2]*100).toFixed(1).padStart(6)}cm`);
  }

  await browser.close();
  console.log('\nDone.');
};

run().catch(console.error);
