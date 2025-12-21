/**
 * IK Debug Test - investigate the constant 3.8cm error
 */

import { describe, it, expect } from 'vitest';
import { calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';

type Vec3 = [number, number, number];

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
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

describe('IK Debug', () => {
  it('verify home position', () => {
    const home = getGripperPos({ base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 });
    console.log(`Home position: [${home.map(p => (p * 100).toFixed(2)).join(', ')}]cm`);

    // Home position at [39, 22.7, 0]cm - arm extended at ~45° above horizontal
    // Note: Y=22.7cm is lower than might be expected due to gripper length
    expect(home[1]).toBeGreaterThan(0.20); // Above 20cm at home
    expect(home[0]).toBeGreaterThan(0.35); // X > 35cm (extended forward)
    expect(Math.abs(home[2])).toBeLessThan(0.01); // Z near 0 when base=0
  });

  it('test known working configurations from claudeApi.ts', () => {
    // From claudeApi.ts startConfigs - these are supposed to work
    const configs: { name: string; joints: JointAngles; expectedY?: number }[] = [
      // FAR WORKSPACE POSES (from claudeApi.ts)
      { name: 'optimal-low', joints: { base: 0, shoulder: 19, elbow: 75, wrist: -77, wristRoll: 0 } },
      { name: 'variant-1', joints: { base: 0, shoulder: 20, elbow: 73, wrist: -75, wristRoll: 0 } },
      { name: 'negative-wrist', joints: { base: 0, shoulder: 0, elbow: 88, wrist: -65, wristRoll: 0 } },

      // LEROBOT COMPACT POSES
      { name: 'lerobot-grasp', joints: { base: 0, shoulder: -99, elbow: 97, wrist: 75, wristRoll: 0 } },
      { name: 'lerobot-less-compact', joints: { base: 0, shoulder: -90, elbow: 90, wrist: 70, wristRoll: 0 } },

      // MEDIUM DISTANCE
      { name: 'extended', joints: { base: 0, shoulder: -60, elbow: 60, wrist: 50, wristRoll: 0 } },
      { name: 'straight', joints: { base: 0, shoulder: -30, elbow: 30, wrist: 30, wristRoll: 0 } },
    ];

    for (const cfg of configs) {
      const pos = getGripperPos(cfg.joints);
      console.log(`${cfg.name}: [${pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
    }
  });

  it('scan for low Y positions', { timeout: 10000 }, () => {
    // Exhaustively scan to find poses that reach low Y values
    let bestLowY = Infinity;
    let bestPose: JointAngles | null = null;
    let bestPos: Vec3 | null = null;

    // Scan shoulder, elbow, wrist in steps
    for (let shoulder = -100; shoulder <= 100; shoulder += 10) {
      for (let elbow = -97; elbow <= 97; elbow += 10) {
        for (let wrist = -95; wrist <= 95; wrist += 10) {
          const joints: JointAngles = { base: 0, shoulder, elbow, wrist, wristRoll: 0 };
          const pos = getGripperPos(joints);

          // Only consider valid (above ground) positions
          if (pos[1] > 0 && pos[1] < bestLowY) {
            // Also require reasonable Z (forward) reach
            if (pos[2] > 0.10 && pos[2] < 0.30) {
              bestLowY = pos[1];
              bestPose = joints;
              bestPos = pos;
            }
          }
        }
      }
    }

    if (bestPose && bestPos) {
      console.log(`\nBest low-Y pose (with Z=10-30cm):`);
      console.log(`  Joints: shoulder=${bestPose.shoulder}°, elbow=${bestPose.elbow}°, wrist=${bestPose.wrist}°`);
      console.log(`  Position: [${bestPos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Minimum Y: ${(bestLowY * 100).toFixed(1)}cm`);
    }

    // Find the actual minimum Y achievable anywhere
    let absoluteMinY = Infinity;
    let absoluteBestPos: Vec3 | null = null;
    for (let shoulder = -100; shoulder <= 100; shoulder += 5) {
      for (let elbow = -97; elbow <= 97; elbow += 5) {
        for (let wrist = -95; wrist <= 95; wrist += 5) {
          const joints: JointAngles = { base: 0, shoulder, elbow, wrist, wristRoll: 0 };
          const pos = getGripperPos(joints);
          if (pos[1] > 0 && pos[1] < absoluteMinY) {
            absoluteMinY = pos[1];
            absoluteBestPos = pos;
          }
        }
      }
    }

    console.log(`\nAbsolute minimum Y (anywhere): ${(absoluteMinY * 100).toFixed(1)}cm`);
    if (absoluteBestPos) {
      console.log(`  At position: [${absoluteBestPos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
    }
  });

  it('scan for positions reachable at Y=5cm, Z=15-20cm', { timeout: 10000 }, () => {
    const targetY = 0.05;
    const targetZRange = [0.15, 0.20];

    let bestMatch: { joints: JointAngles; pos: Vec3; error: number } | null = null;
    let bestError = Infinity;

    for (let shoulder = -100; shoulder <= 100; shoulder += 5) {
      for (let elbow = -97; elbow <= 97; elbow += 5) {
        for (let wrist = -95; wrist <= 95; wrist += 5) {
          const joints: JointAngles = { base: 0, shoulder, elbow, wrist, wristRoll: 0 };
          const pos = getGripperPos(joints);

          // Check if Z is in target range
          if (pos[2] >= targetZRange[0] && pos[2] <= targetZRange[1]) {
            const yError = Math.abs(pos[1] - targetY);
            if (yError < bestError) {
              bestError = yError;
              bestMatch = { joints, pos, error: yError };
            }
          }
        }
      }
    }

    if (bestMatch) {
      console.log(`\nBest match for Y=5cm, Z=15-20cm:`);
      console.log(`  Joints: shoulder=${bestMatch.joints.shoulder}°, elbow=${bestMatch.joints.elbow}°, wrist=${bestMatch.joints.wrist}°`);
      console.log(`  Position: [${bestMatch.pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Y error: ${(bestMatch.error * 100).toFixed(2)}cm`);
    } else {
      console.log(`\nNo match found in target range!`);
    }
  });

  it('test different base angles for position [4, 5, 20]cm', () => {
    const target: Vec3 = [0.04, 0.05, 0.20];

    // The expected base angle for X=4cm, Z=20cm
    const expectedBase = Math.atan2(target[2], target[0]) * (180 / Math.PI);
    console.log(`Expected base for [4, ?, 20]: ${expectedBase.toFixed(1)}°`);

    // Focused search around known good configurations
    let bestError = Infinity;
    let bestMatch: { joints: JointAngles; pos: Vec3 } | null = null;

    // Search with coarser steps to avoid timeout
    for (let base = expectedBase - 15; base <= expectedBase + 15; base += 5) {
      for (let shoulder = -100; shoulder <= 100; shoulder += 15) {
        for (let elbow = -97; elbow <= 97; elbow += 15) {
          for (let wrist = -95; wrist <= 95; wrist += 15) {
            const joints: JointAngles = { base, shoulder, elbow, wrist, wristRoll: 0 };
            const pos = getGripperPos(joints);
            const error = positionError(pos, target);

            if (error < bestError) {
              bestError = error;
              bestMatch = { joints, pos };
            }
          }
        }
      }
    }

    if (bestMatch) {
      console.log(`\nBest match for target [4, 5, 20]cm (coarse search):`);
      console.log(`  Joints: base=${bestMatch.joints.base.toFixed(1)}°, shoulder=${bestMatch.joints.shoulder}°, elbow=${bestMatch.joints.elbow}°, wrist=${bestMatch.joints.wrist}°`);
      console.log(`  Achieved: [${bestMatch.pos.map(p => (p * 100).toFixed(1)).join(', ')}]cm`);
      console.log(`  Error: ${(bestError * 100).toFixed(2)}cm`);

      expect(bestError).toBeLessThan(0.10); // Coarse search may have higher error
    }
  }, 10000); // 10 second timeout
});
