/**
 * Horizontal Grasp Test
 *
 * Verifies that the IK solver can find horizontal grasp poses for side-grasping cylinders.
 */

import { describe, it, expect } from 'vitest';
import { calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';
import { SO101_JOINT_LIMITS, clampJointValue } from '../config/so101Limits';

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

describe('Horizontal Grasp Configurations', () => {
  it('scans for horizontal poses at Y=4-5cm height', () => {
    // Find horizontal configurations (wrist near 0°) that reach Y=4-5cm at Z=15-18cm
    const targetY = 0.04; // 4cm - typical cylinder grasp height
    const targetZ = 0.16; // 16cm - typical cylinder Z position
    const tolerance = 0.02; // 2cm tolerance

    console.log(`Searching for horizontal poses (wrist ±20°) reaching Y~${(targetY*100).toFixed(0)}cm, Z~${(targetZ*100).toFixed(0)}cm:`);

    const results: { joints: JointAngles; pos: [number, number, number]; error: number }[] = [];

    // Scan with horizontal wrist angles (-20° to +20°)
    for (let wrist = -20; wrist <= 20; wrist += 10) {
      for (let shoulder = -70; shoulder <= 30; shoulder += 10) {
        for (let elbow = 30; elbow <= 97; elbow += 10) {
          const joints: JointAngles = {
            base: 56, // Facing the object
            shoulder: clampJoint('shoulder', shoulder),
            elbow: clampJoint('elbow', elbow),
            wrist: clampJoint('wrist', wrist),
            wristRoll: 0,
          };

          const pos = calculateGripperPositionURDF(joints) as [number, number, number];

          // Check if this pose is near the target
          const yError = Math.abs(pos[1] - targetY);
          const zError = Math.abs(pos[2] - targetZ);

          if (yError < tolerance && zError < 0.05 && pos[1] > 0.02) {
            results.push({ joints, pos, error: yError + zError });
          }
        }
      }
    }

    // Sort by error
    results.sort((a, b) => a.error - b.error);

    // Log top results
    console.log(`Found ${results.length} horizontal poses near target:`);
    for (const r of results.slice(0, 10)) {
      console.log(`  shoulder=${r.joints.shoulder}°, elbow=${r.joints.elbow}°, wrist=${r.joints.wrist}° -> pos=[${r.pos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    }

    // Should find at least some horizontal poses
    expect(results.length).toBeGreaterThan(0);
    if (results.length > 0) {
      const best = results[0];
      console.log(`\nBest horizontal pose: shoulder=${best.joints.shoulder}°, elbow=${best.joints.elbow}°, wrist=${best.joints.wrist}°`);
      expect(best.pos[1]).toBeGreaterThan(0.02); // Y > 2cm (above table)
      expect(Math.abs(best.joints.wrist)).toBeLessThan(25); // Wrist is near horizontal
    }
  });

  it('compares horizontal vs steep approach for cylinder target', () => {
    // Target for a cylinder at [10, 4, 16]cm (typical peg position)
    const target = { x: 0.10, y: 0.04, z: 0.16 };

    // Based on scan results, find a good horizontal configuration
    // Less negative shoulder with moderate elbow and near-zero wrist
    const horizontalJoints: JointAngles = { base: 56, shoulder: -30, elbow: 67, wrist: 10, wristRoll: 0 };
    const horizPos = calculateGripperPositionURDF(horizontalJoints);

    // With steep approach, wrist around -70° to -80°
    // The gripper comes from above - bad for cylinders (tips them over)
    const steepJoints: JointAngles = { base: 56, shoulder: 19, elbow: 75, wrist: -77, wristRoll: 0 };
    const steepPos = calculateGripperPositionURDF(steepJoints);

    console.log(`Target: [${(target.x*100).toFixed(1)}, ${(target.y*100).toFixed(1)}, ${(target.z*100).toFixed(1)}]cm`);
    console.log(`Horizontal (wrist=${horizontalJoints.wrist}°): [${horizPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    console.log(`Steep (wrist=${steepJoints.wrist}°): [${steepPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

    console.log('\nNote: Horizontal approach is better for side-grasping cylinders');
    console.log('The gripper comes from the side, not top-down, preventing tip-over');
  });
});
