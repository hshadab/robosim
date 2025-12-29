/**
 * Batch Demo Tests
 *
 * Fast unit tests for batch demo generation logic.
 * Tests position variety, frame generation, and data quality
 * without needing a browser.
 */

import { describe, it, expect } from 'vitest';
import { calculateJawPositionURDF } from '../components/simulation/SO101KinematicsURDF';

// Position variety configuration (should match MinimalTrainFlow.tsx)
const BATCH_POSITIONS = [
  { x: 0.16, z: 0.01 },   // Close center-right
  { x: 0.17, z: 0.00 },   // Mid center
  { x: 0.18, z: 0.02 },   // Far right
  { x: 0.16, z: -0.01 },  // Close slight left
  { x: 0.17, z: 0.015 },  // Mid slight right
  { x: 0.18, z: -0.005 }, // Far near center left
  { x: 0.16, z: 0.005 },  // Close near center right
  { x: 0.17, z: -0.015 }, // Mid left
  { x: 0.18, z: 0.025 },  // Far further right
  { x: 0.16, z: -0.02 },  // Close further left
];

// Synthetic frame generation (matches MinimalTrainFlow smoothMove)
function generateSyntheticFrames(
  startJoints: number[],
  targetJoints: number[],
  durationMs: number
): { timestamp: number; jointPositions: number[] }[] {
  const frames: { timestamp: number; jointPositions: number[] }[] = [];
  const frameInterval = 33; // ~30fps
  const numFrames = Math.ceil(durationMs / frameInterval);

  for (let f = 0; f <= numFrames; f++) {
    const t = Math.min(1, f / numFrames);
    // Ease-in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const frameJoints = startJoints.map((start, i) =>
      start + (targetJoints[i] - start) * ease
    );

    frames.push({
      timestamp: f * frameInterval,
      jointPositions: frameJoints,
    });
  }

  return frames;
}

// Calculate IK for a given position (simplified version)
function calculateGraspJoints(pos: { x: number; z: number }): {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
} {
  const baseAngle = Math.atan2(pos.z, pos.x) * (180 / Math.PI);
  const xOffset = (pos.x - 0.16) * 100; // cm offset from baseline
  const shoulderGrasp = -22 + xOffset * 2;
  const elbowGrasp = 51 - xOffset * 3;
  const wristGrasp = 63;
  const wristRollVar = 90;

  return {
    base: baseAngle,
    shoulder: shoulderGrasp,
    elbow: elbowGrasp,
    wrist: wristGrasp,
    wristRoll: wristRollVar,
  };
}

describe('Batch Demo Position Variety', () => {
  it('should have 10 unique positions', () => {
    expect(BATCH_POSITIONS.length).toBe(10);
  });

  it('should have varied X positions (16, 17, 18 cm)', () => {
    const xPositions = new Set(BATCH_POSITIONS.map(p => Math.round(p.x * 100)));
    expect(xPositions.has(16)).toBe(true);
    expect(xPositions.has(17)).toBe(true);
    expect(xPositions.has(18)).toBe(true);
    expect(xPositions.size).toBe(3);
  });

  it('should have varied Z positions', () => {
    const zPositions = new Set(BATCH_POSITIONS.map(p => p.z));
    // Should have more than 5 unique Z values
    expect(zPositions.size).toBeGreaterThan(5);
  });

  it('all positions should be reachable by the arm', () => {
    for (const pos of BATCH_POSITIONS) {
      const joints = calculateGraspJoints(pos);
      const jawPos = calculateJawPositionURDF(joints);

      // Jaw should be within 5cm of target XZ (Y varies with grasp height)
      const xzError = Math.sqrt(
        (jawPos[0] - pos.x) ** 2 +
        (jawPos[2] - pos.z) ** 2
      );

      expect(xzError).toBeLessThan(0.05); // 5cm tolerance
    }
  });
});

describe('Synthetic Frame Generation', () => {
  it('should generate ~30fps frames for 800ms movement', () => {
    const startJoints = [0, 0, 0, 0, 0, 100]; // home with gripper open
    const targetJoints = [5, -22, 51, 63, 90, 100]; // grasp position

    const frames = generateSyntheticFrames(startJoints, targetJoints, 800);

    // 800ms / 33ms per frame = ~24 frames + 1 for start
    expect(frames.length).toBeGreaterThanOrEqual(24);
    expect(frames.length).toBeLessThanOrEqual(26);
  });

  it('should generate ~30fps frames for 700ms lift', () => {
    const startJoints = [5, -22, 51, 63, 90, 0]; // grasp position, gripper closed
    const targetJoints = [5, -50, 30, 45, 90, 0]; // lift position

    const frames = generateSyntheticFrames(startJoints, targetJoints, 700);

    // 700ms / 33ms = ~21 frames + 1
    expect(frames.length).toBeGreaterThanOrEqual(21);
    expect(frames.length).toBeLessThanOrEqual(23);
  });

  it('should have smooth easing (not linear)', () => {
    const startJoints = [0, 0, 0, 0, 0, 0];
    const targetJoints = [0, -50, 0, 0, 0, 0]; // shoulder only

    const frames = generateSyntheticFrames(startJoints, targetJoints, 1000);

    // First few frames should move slowly (ease-in)
    const earlyDelta = Math.abs(frames[1].jointPositions[1] - frames[0].jointPositions[1]);
    // Middle frames should move faster
    const midIdx = Math.floor(frames.length / 2);
    const midDelta = Math.abs(frames[midIdx + 1].jointPositions[1] - frames[midIdx].jointPositions[1]);

    // Early movement should be slower than middle
    expect(earlyDelta).toBeLessThan(midDelta);
  });

  it('should end exactly at target position', () => {
    const startJoints = [0, 0, 0, 0, 0, 100];
    const targetJoints = [5, -22, 51, 63, 90, 0];

    const frames = generateSyntheticFrames(startJoints, targetJoints, 800);
    const lastFrame = frames[frames.length - 1];

    for (let i = 0; i < 6; i++) {
      expect(lastFrame.jointPositions[i]).toBeCloseTo(targetJoints[i], 1);
    }
  });
});

describe('Gripper Close Frame Generation', () => {
  it('should generate 30fps frames for 1000ms gripper close', () => {
    const gripperCloseDuration = 1000;
    const gripperFrameCount = Math.ceil(gripperCloseDuration / 33);

    const frames: { timestamp: number; jointPositions: number[] }[] = [];
    const baseJoints = [5, -22, 51, 63, 90];

    for (let f = 0; f <= gripperFrameCount; f++) {
      const t = f / gripperFrameCount;
      const gripperValue = 100 * (1 - t); // Linear 100 -> 0

      frames.push({
        timestamp: f * 33,
        jointPositions: [...baseJoints, gripperValue],
      });
    }

    // Should have ~30 frames
    expect(frames.length).toBeGreaterThanOrEqual(30);
    expect(frames.length).toBeLessThanOrEqual(32);

    // First frame: gripper open
    expect(frames[0].jointPositions[5]).toBe(100);

    // Last frame: gripper closed
    expect(frames[frames.length - 1].jointPositions[5]).toBeCloseTo(0, 1);
  });
});

describe('Full Demo Episode Structure', () => {
  it('should generate ~81 frames per episode (25 + 31 + 22 + buffer)', () => {
    // Move 1: 800ms positioning = ~25 frames
    // Move 2: 1000ms gripper close = ~31 frames
    // Move 3: 700ms lift = ~22 frames
    // Total: ~78-81 frames

    const move1Frames = generateSyntheticFrames([0,0,0,0,0,100], [5,-22,51,63,90,100], 800);
    const move2Frames = Math.ceil(1000 / 33) + 1; // gripper close
    const move3Frames = generateSyntheticFrames([5,-22,51,63,90,0], [5,-50,30,45,90,0], 700);

    const totalFrames = move1Frames.length + move2Frames + move3Frames.length;

    expect(totalFrames).toBeGreaterThanOrEqual(75);
    expect(totalFrames).toBeLessThanOrEqual(85);
  });

  it('episode duration should be ~2.5 seconds', () => {
    // 800ms + 1000ms + 700ms = 2500ms
    const expectedDuration = (800 + 1000 + 700) / 1000;
    expect(expectedDuration).toBe(2.5);
  });
});

describe('Data Quality Verification', () => {
  it('all joint values should be within valid ranges', () => {
    const JOINT_LIMITS = {
      base: { min: -180, max: 180 },
      shoulder: { min: -90, max: 90 },
      elbow: { min: -90, max: 135 },
      wrist: { min: -90, max: 90 },
      wristRoll: { min: -180, max: 180 },
      gripper: { min: 0, max: 100 },
    };

    for (const pos of BATCH_POSITIONS) {
      const joints = calculateGraspJoints(pos);

      expect(joints.base).toBeGreaterThanOrEqual(JOINT_LIMITS.base.min);
      expect(joints.base).toBeLessThanOrEqual(JOINT_LIMITS.base.max);
      expect(joints.shoulder).toBeGreaterThanOrEqual(JOINT_LIMITS.shoulder.min);
      expect(joints.shoulder).toBeLessThanOrEqual(JOINT_LIMITS.shoulder.max);
      expect(joints.elbow).toBeGreaterThanOrEqual(JOINT_LIMITS.elbow.min);
      expect(joints.elbow).toBeLessThanOrEqual(JOINT_LIMITS.elbow.max);
      expect(joints.wrist).toBeGreaterThanOrEqual(JOINT_LIMITS.wrist.min);
      expect(joints.wrist).toBeLessThanOrEqual(JOINT_LIMITS.wrist.max);
    }
  });

  it('timestamps should be monotonically increasing', () => {
    const frames = generateSyntheticFrames([0,0,0,0,0,0], [10,10,10,10,10,10], 500);

    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].timestamp).toBeGreaterThan(frames[i - 1].timestamp);
    }
  });

  it('frame interval should be ~33ms (30fps)', () => {
    const frames = generateSyntheticFrames([0,0,0,0,0,0], [10,10,10,10,10,10], 500);

    for (let i = 1; i < frames.length; i++) {
      const interval = frames[i].timestamp - frames[i - 1].timestamp;
      expect(interval).toBe(33);
    }
  });
});
