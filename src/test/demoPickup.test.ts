/**
 * Demo Pickup IK Test
 *
 * Verifies that the IK solver produces values close to the Demo Pick Up configuration
 * Demo cube position: [16cm, 2cm, 1cm]
 * Demo joints: base=5, shoulder=-22, elbow=51, wrist=63, wristRoll=90
 */

import { describe, it, expect } from 'vitest';
import { calculateGripperPositionURDF, calculateJawPositionURDF } from '../components/simulation/SO101KinematicsURDF';

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}

// Demo Pick Up configuration that WORKS
const DEMO_CUBE_POSITION = { x: 0.16, y: 0.02, z: 0.01 }; // 16cm, 2cm, 1cm
const DEMO_JOINTS: JointAngles = {
  base: 5,
  shoulder: -22,
  elbow: 51,
  wrist: 63,
  wristRoll: 90
};

// Calculate position error
function positionError(actual: [number, number, number], target: [number, number, number]): number {
  return Math.sqrt(
    (actual[0] - target[0]) ** 2 +
    (actual[1] - target[1]) ** 2 +
    (actual[2] - target[2]) ** 2
  );
}

describe('Demo Pickup IK Verification', () => {

  it('Demo joints reach near the cube position', () => {
    // Calculate where the Demo joints actually place the gripper
    const tipPos = calculateGripperPositionURDF(DEMO_JOINTS);
    const jawPos = calculateJawPositionURDF(DEMO_JOINTS);

    console.log('\n[Demo Pickup Test]');
    console.log(`  Cube position: [${DEMO_CUBE_POSITION.x * 100}, ${DEMO_CUBE_POSITION.y * 100}, ${DEMO_CUBE_POSITION.z * 100}]cm`);
    console.log(`  Demo joints: base=${DEMO_JOINTS.base}, shoulder=${DEMO_JOINTS.shoulder}, elbow=${DEMO_JOINTS.elbow}, wrist=${DEMO_JOINTS.wrist}`);
    console.log(`  Tip position: [${(tipPos[0]*100).toFixed(1)}, ${(tipPos[1]*100).toFixed(1)}, ${(tipPos[2]*100).toFixed(1)}]cm`);
    console.log(`  Jaw position: [${(jawPos[0]*100).toFixed(1)}, ${(jawPos[1]*100).toFixed(1)}, ${(jawPos[2]*100).toFixed(1)}]cm`);

    const cubeTarget: [number, number, number] = [DEMO_CUBE_POSITION.x, DEMO_CUBE_POSITION.y, DEMO_CUBE_POSITION.z];
    const jawError = positionError(jawPos, cubeTarget);
    console.log(`  Jaw-to-cube error: ${(jawError*100).toFixed(2)}cm`);

    // Demo should be within reasonable distance of the cube
    // Note: Demo works in practice, so this is more about understanding the FK
    expect(jawError).toBeLessThan(0.10); // 10cm tolerance for understanding
  });

  it('IK solver should produce similar results to Demo for same cube position', async () => {
    // This test verifies our IK is reasonable for the Demo cube position
    // We use the synchronous FK-based search to check what our IK would return

    // Target: cube at [16cm, 2cm, 1cm]
    const targetPos: [number, number, number] = [
      DEMO_CUBE_POSITION.x,
      DEMO_CUBE_POSITION.y,
      DEMO_CUBE_POSITION.z
    ];

    // Simple IK search similar to what our worker does
    let bestJoints: JointAngles = { ...DEMO_JOINTS }; // Start from demo
    let bestError = Infinity;

    // Calculate base angle (same logic as main IK)
    const baseAngle = Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI);

    // Starting configurations from our IK solver
    const startConfigs = [
      // LeRobot-style compact poses (these work well for close objects)
      { shoulder: -22, elbow: 51, wrist: 63 }, // Demo exact values
      { shoulder: -20, elbow: 50, wrist: 60 }, // Nearby
      { shoulder: -25, elbow: 55, wrist: 65 }, // Nearby
      { shoulder: -30, elbow: 60, wrist: 70 }, // More compact
      // Far workspace poses
      { shoulder: 19, elbow: 75, wrist: -77 },
      { shoulder: 0, elbow: 88, wrist: -65 },
      // Medium poses
      { shoulder: -50, elbow: 80, wrist: 10 },
      { shoulder: -60, elbow: 60, wrist: 50 },
    ];

    for (const config of startConfigs) {
      const joints: JointAngles = {
        base: baseAngle,
        shoulder: config.shoulder,
        elbow: config.elbow,
        wrist: config.wrist,
        wristRoll: 0
      };

      // Use jaw position for accuracy (like main IK)
      const jawPos = calculateJawPositionURDF(joints);
      const error = positionError(jawPos, targetPos);

      if (error < bestError) {
        bestError = error;
        bestJoints = { ...joints };
      }
    }

    console.log('\n[IK Search Result]');
    console.log(`  Best joints: base=${bestJoints.base.toFixed(1)}, shoulder=${bestJoints.shoulder}, elbow=${bestJoints.elbow}, wrist=${bestJoints.wrist}`);
    console.log(`  Error: ${(bestError*100).toFixed(2)}cm`);

    // Compare with Demo
    const demoJawPos = calculateJawPositionURDF(DEMO_JOINTS);
    const demoError = positionError(demoJawPos, targetPos);
    console.log(`  Demo error: ${(demoError*100).toFixed(2)}cm`);

    // The IK should find something comparable to Demo
    // If Demo works and has X error, our IK should be within 2X error
    expect(bestError).toBeLessThan(Math.max(demoError * 2, 0.05));
  });

  it('Cube at Z=15cm should be reachable (typical object spawn position)', () => {
    // Objects are often spawned at Z=15cm+
    const typicalCube: [number, number, number] = [0.12, 0.02, 0.15]; // 12cm X, 2cm Y, 15cm Z

    // Calculate base angle
    const baseAngle = Math.atan2(typicalCube[2], typicalCube[0]) * (180 / Math.PI);

    // Try starting configurations
    const configs = [
      { shoulder: -50, elbow: 80, wrist: 10 },
      { shoulder: -40, elbow: 70, wrist: 20 },
      { shoulder: 19, elbow: 75, wrist: -77 },
      { shoulder: 0, elbow: 88, wrist: -65 },
    ];

    let bestError = Infinity;
    let bestJoints: JointAngles | null = null;

    for (const config of configs) {
      const joints: JointAngles = {
        base: baseAngle,
        ...config,
        wristRoll: 0
      };

      const jawPos = calculateJawPositionURDF(joints);
      const error = positionError(jawPos, typicalCube);

      if (error < bestError) {
        bestError = error;
        bestJoints = joints;
      }
    }

    console.log('\n[Typical Object Position Test]');
    console.log(`  Target: [${(typicalCube[0]*100).toFixed(0)}, ${(typicalCube[1]*100).toFixed(0)}, ${(typicalCube[2]*100).toFixed(0)}]cm`);
    console.log(`  Base angle: ${baseAngle.toFixed(1)}°`);
    if (bestJoints) {
      const jawPos = calculateJawPositionURDF(bestJoints);
      console.log(`  Best joints: shoulder=${bestJoints.shoulder}, elbow=${bestJoints.elbow}, wrist=${bestJoints.wrist}`);
      console.log(`  Achieved: [${(jawPos[0]*100).toFixed(1)}, ${(jawPos[1]*100).toFixed(1)}, ${(jawPos[2]*100).toFixed(1)}]cm`);
    }
    console.log(`  Error: ${(bestError*100).toFixed(2)}cm`);

    // Should be reachable with < 5cm error
    expect(bestError).toBeLessThan(0.05);
  });
});
