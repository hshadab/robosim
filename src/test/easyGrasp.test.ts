/**
 * Easy Grasp Objects Test
 *
 * Tests that the IK solver can reach the Easy Grasp peg positions
 * which are designed to be graspable at comfortable heights.
 */

import { describe, it, expect } from 'vitest';
import { calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';
import { SO101_JOINT_LIMITS, clampJointValue } from '../config/so101Limits';

type Vec3 = [number, number, number];

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}

// Use centralized joint limits (no wristRoll limit needed for these tests)
const JOINT_LIMITS = {
  base: SO101_JOINT_LIMITS.base,
  shoulder: SO101_JOINT_LIMITS.shoulder,
  elbow: SO101_JOINT_LIMITS.elbow,
  wrist: SO101_JOINT_LIMITS.wrist,
};

function clampJoint(name: keyof typeof JOINT_LIMITS, value: number): number {
  return clampJointValue(name as keyof typeof SO101_JOINT_LIMITS, value);
}

function getGripperPos(joints: JointAngles): Vec3 {
  return calculateGripperPositionURDF(joints);
}

function positionError(actual: Vec3, target: Vec3): number {
  return Math.sqrt(
    (actual[0] - target[0]) ** 2 +
    (actual[1] - target[1]) ** 2 +
    (actual[2] - target[2]) ** 2
  );
}

// Solve IK with proper base angle calculation
function solveIKWithBase(targetPos: Vec3): { joints: JointAngles; error: number } {
  let bestJoints: JointAngles = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
  let bestError = Infinity;

  // Calculate base angle to face the target
  const baseAngle = Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI);
  const clampedBase = clampJoint('base', baseAngle);

  // Try different base angles around the calculated one
  const baseAngles = [clampedBase, clampedBase + 5, clampedBase - 5, clampedBase + 10, clampedBase - 10];

  for (const base of baseAngles) {
    // Starting configurations optimized for different heights
    const startConfigs = [
      // For Y ~ 1.5-3cm (Easy Grasp peg heights)
      { shoulder: 19, elbow: 75, wrist: -77 },   // Negative wrist for low reach
      { shoulder: 15, elbow: 78, wrist: -80 },
      { shoulder: 25, elbow: 70, wrist: -70 },
      { shoulder: 0, elbow: 88, wrist: -65 },
      { shoulder: 10, elbow: 80, wrist: -85 },
      // Medium height poses
      { shoulder: -30, elbow: 50, wrist: 20 },
      { shoulder: -40, elbow: 60, wrist: 30 },
      { shoulder: -50, elbow: 70, wrist: 40 },
      // Extended poses
      { shoulder: -60, elbow: 60, wrist: 50 },
      { shoulder: -70, elbow: 70, wrist: 55 },
    ];

    for (const start of startConfigs) {
      let joints: JointAngles = { base: clampJoint('base', base), ...start, wristRoll: 0 };

      // Gradient descent refinement
      const stepSizes = [5.0, 2.0, 1.0, 0.5, 0.2];
      for (const stepSize of stepSizes) {
        for (let iter = 0; iter < 20; iter++) {
          const pos = getGripperPos(joints);
          const error = positionError(pos, targetPos);

          if (error < bestError) {
            bestError = error;
            bestJoints = { ...joints };
          }

          if (error < 0.005) break; // 5mm is excellent

          // Try adjusting each joint
          for (const jn of ['shoulder', 'elbow', 'wrist'] as const) {
            const testPlus = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
            const testMinus = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };
            const errPlus = positionError(getGripperPos(testPlus), targetPos);
            const errMinus = positionError(getGripperPos(testMinus), targetPos);
            if (errPlus < error && errPlus <= errMinus) {
              joints = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
            } else if (errMinus < error) {
              joints = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };
            }
          }
        }
      }
    }
  }

  return { joints: bestJoints, error: bestError };
}

describe('Easy Grasp Objects Reachability', () => {
  // Easy Grasp Peg positions from objectLibrary.ts
  // Pegs: scale=0.02, height=6*scale=12cm, radius=0.5*scale=1cm, center at Y=3*scale=6cm
  // Grasp target: 1/3 up from bottom = ~4cm
  const pegPositions = [
    { name: 'Red Peg', pos: [0.05, 0.04, 0.16] as Vec3 },   // grasp at Y=4cm, base ~73°
    { name: 'Blue Peg', pos: [0.10, 0.04, 0.13] as Vec3 },  // grasp at Y=4cm, base ~52°
    { name: 'Green Peg', pos: [0.15, 0.04, 0.08] as Vec3 }, // grasp at Y=4cm, base ~28°
  ];

  // Easy Grasp Stick positions
  // Sticks: scale=0.025, height=6*scale=15cm, center at Y=7.5cm
  // Grasp target: 1/3 up from bottom = ~5cm
  const stickPositions = [
    { name: 'Red Stick', pos: [0.02, 0.05, 0.17] as Vec3 },  // grasp at Y=5cm, base ~83°
    { name: 'Blue Stick', pos: [0.12, 0.05, 0.12] as Vec3 }, // grasp at Y=5cm, base ~45°
  ];

  describe('Peg Reachability', () => {
    pegPositions.forEach(({ name, pos }) => {
      it(`can reach ${name} at [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`, () => {
        const result = solveIKWithBase(pos);
        const achieved = getGripperPos(result.joints);

        console.log(`[${name}]`);
        console.log(`  Target: [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
        console.log(`  Achieved: [${achieved.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
        console.log(`  Joints: base=${result.joints.base.toFixed(1)}°, shoulder=${result.joints.shoulder.toFixed(1)}°, elbow=${result.joints.elbow.toFixed(1)}°, wrist=${result.joints.wrist.toFixed(1)}°`);
        console.log(`  Error: ${(result.error * 100).toFixed(2)}cm`);

        // Should be reachable within 3cm
        expect(result.error).toBeLessThan(0.03);
      });
    });
  });

  describe('Stick Reachability', () => {
    stickPositions.forEach(({ name, pos }) => {
      it(`can reach ${name} at [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`, () => {
        const result = solveIKWithBase(pos);
        const achieved = getGripperPos(result.joints);

        console.log(`[${name}]`);
        console.log(`  Target: [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
        console.log(`  Achieved: [${achieved.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
        console.log(`  Error: ${(result.error * 100).toFixed(2)}cm`);

        expect(result.error).toBeLessThan(0.03);
      });
    });
  });

  describe('Grasp Height Analysis', () => {
    it('can reach comfortable grasp height (Y=3cm) at Z=15cm', () => {
      // This is the key test - can we reach Y=3cm at a typical Z distance?
      const target: Vec3 = [0.0, 0.03, 0.15];
      const result = solveIKWithBase(target);
      const achieved = getGripperPos(result.joints);

      console.log('[Grasp Height Test]');
      console.log(`  Target: [${target.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Achieved: [${achieved.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Joints: base=${result.joints.base.toFixed(1)}°, shoulder=${result.joints.shoulder.toFixed(1)}°, elbow=${result.joints.elbow.toFixed(1)}°, wrist=${result.joints.wrist.toFixed(1)}°`);
      console.log(`  Error: ${(result.error * 100).toFixed(2)}cm`);

      expect(result.error).toBeLessThan(0.03);
    });

    it('can reach very low (Y=1.5cm) at Z=12cm', () => {
      const target: Vec3 = [0.0, 0.015, 0.12];
      const result = solveIKWithBase(target);
      const achieved = getGripperPos(result.joints);

      console.log('[Very Low Test]');
      console.log(`  Target: [${target.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Achieved: [${achieved.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Wrist: ${result.joints.wrist.toFixed(1)}°`);
      console.log(`  Error: ${(result.error * 100).toFixed(2)}cm`);

      // This is challenging - document what we achieve
      expect(result.error).toBeLessThan(0.05); // Allow 5cm for very low positions
    });
  });
});
