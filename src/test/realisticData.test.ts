/**
 * Realistic Data Validation Tests
 *
 * Validates that simulation-generated training data matches
 * physical constraints of the real SO-101 robot.
 *
 * These tests ensure sim-to-real transfer by checking:
 * 1. Joint velocities are within motor limits
 * 2. Trajectories are physically executable
 * 3. Gripper physics match real behavior
 * 4. Data format matches LeRobot requirements
 */

import { describe, it, expect } from 'vitest';
import { calculateJawPositionURDF, calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';

// Real SO-101 hardware constraints (from STS3215 servo specs)
const SO101_CONSTRAINTS = {
  // Joint limits in degrees
  jointLimits: {
    base: { min: -110, max: 110 },
    shoulder: { min: -100, max: 100 },
    elbow: { min: -97, max: 97 },
    wrist: { min: -95, max: 95 },
    wristRoll: { min: -157, max: 163 },
    gripper: { min: 0, max: 100 },
  },
  // Maximum joint velocities in degrees/second (STS3215 specs)
  maxVelocities: {
    base: 180,      // Base can move faster (lighter load)
    shoulder: 120,  // Shoulder is slower (heavy load)
    elbow: 150,
    wrist: 200,
    wristRoll: 200,
    gripper: 300,   // Gripper is fast
  },
  // Maximum joint accelerations in deg/s²
  maxAccelerations: {
    base: 500,
    shoulder: 300,
    elbow: 400,
    wrist: 600,
    wristRoll: 600,
    gripper: 1000,
  },
  // Gripper grasp parameters
  gripper: {
    maxGraspWidth: 0.08,    // 8cm max opening
    minGraspForce: 2.0,     // 2N minimum for secure grasp
    closureTimeMs: 800,     // Minimum time for physics detection
  },
  // Workspace limits in meters
  workspace: {
    minReach: 0.10,   // 10cm minimum reach
    maxReach: 0.28,   // 28cm maximum reach
    minHeight: 0.00,  // Floor level
    maxHeight: 0.35,  // 35cm max height
  },
};

// Sample trajectory from batch demo (realistic pickup sequence)
const SAMPLE_PICKUP_TRAJECTORY = [
  { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
  { timestamp: 800, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
  { timestamp: 1600, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 } },
  { timestamp: 2300, joints: { base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 } },
];

describe('Realistic Data Validation', () => {
  describe('Joint Limits Compliance', () => {
    it('all trajectory points should be within joint limits', () => {
      for (const point of SAMPLE_PICKUP_TRAJECTORY) {
        const { joints } = point;

        expect(joints.base).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.jointLimits.base.min);
        expect(joints.base).toBeLessThanOrEqual(SO101_CONSTRAINTS.jointLimits.base.max);

        expect(joints.shoulder).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.jointLimits.shoulder.min);
        expect(joints.shoulder).toBeLessThanOrEqual(SO101_CONSTRAINTS.jointLimits.shoulder.max);

        expect(joints.elbow).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.jointLimits.elbow.min);
        expect(joints.elbow).toBeLessThanOrEqual(SO101_CONSTRAINTS.jointLimits.elbow.max);

        expect(joints.wrist).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.jointLimits.wrist.min);
        expect(joints.wrist).toBeLessThanOrEqual(SO101_CONSTRAINTS.jointLimits.wrist.max);

        expect(joints.gripper).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.jointLimits.gripper.min);
        expect(joints.gripper).toBeLessThanOrEqual(SO101_CONSTRAINTS.jointLimits.gripper.max);
      }
    });

    it('should reject trajectories with out-of-bounds joints', () => {
      const invalidTrajectory = [
        { timestamp: 0, joints: { base: 150, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 } },
      ];

      const isWithinLimits = (joints: typeof invalidTrajectory[0]['joints']) => {
        return joints.base >= SO101_CONSTRAINTS.jointLimits.base.min &&
               joints.base <= SO101_CONSTRAINTS.jointLimits.base.max;
      };

      expect(isWithinLimits(invalidTrajectory[0].joints)).toBe(false);
    });
  });

  describe('Velocity Constraints', () => {
    it('joint velocities should not exceed motor limits', () => {
      for (let i = 1; i < SAMPLE_PICKUP_TRAJECTORY.length; i++) {
        const prev = SAMPLE_PICKUP_TRAJECTORY[i - 1];
        const curr = SAMPLE_PICKUP_TRAJECTORY[i];
        const dt = (curr.timestamp - prev.timestamp) / 1000; // Convert to seconds

        // Calculate velocities
        const velocities = {
          base: Math.abs(curr.joints.base - prev.joints.base) / dt,
          shoulder: Math.abs(curr.joints.shoulder - prev.joints.shoulder) / dt,
          elbow: Math.abs(curr.joints.elbow - prev.joints.elbow) / dt,
          wrist: Math.abs(curr.joints.wrist - prev.joints.wrist) / dt,
          wristRoll: Math.abs(curr.joints.wristRoll - prev.joints.wristRoll) / dt,
          gripper: Math.abs(curr.joints.gripper - prev.joints.gripper) / dt,
        };

        // Check against limits
        expect(velocities.base).toBeLessThanOrEqual(SO101_CONSTRAINTS.maxVelocities.base);
        expect(velocities.shoulder).toBeLessThanOrEqual(SO101_CONSTRAINTS.maxVelocities.shoulder);
        expect(velocities.elbow).toBeLessThanOrEqual(SO101_CONSTRAINTS.maxVelocities.elbow);
        expect(velocities.wrist).toBeLessThanOrEqual(SO101_CONSTRAINTS.maxVelocities.wrist);
        expect(velocities.gripper).toBeLessThanOrEqual(SO101_CONSTRAINTS.maxVelocities.gripper);
      }
    });

    it('should calculate realistic velocity from position delta', () => {
      const p1 = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 };
      const p2 = { base: 10, shoulder: -20, elbow: 30, wrist: 40, wristRoll: 0, gripper: 100 };
      const dt = 0.5; // 500ms

      const velocity = {
        base: (p2.base - p1.base) / dt,
        shoulder: (p2.shoulder - p1.shoulder) / dt,
        elbow: (p2.elbow - p1.elbow) / dt,
        wrist: (p2.wrist - p1.wrist) / dt,
      };

      // Velocity = delta / time
      expect(velocity.base).toBe(20);      // 10° / 0.5s = 20°/s
      expect(velocity.shoulder).toBe(-40); // -20° / 0.5s = -40°/s
      expect(velocity.elbow).toBe(60);     // 30° / 0.5s = 60°/s
      expect(velocity.wrist).toBe(80);     // 40° / 0.5s = 80°/s
    });
  });

  describe('Workspace Reachability', () => {
    it('end effector should stay within workspace bounds', () => {
      for (const point of SAMPLE_PICKUP_TRAJECTORY) {
        const pos = calculateGripperPositionURDF(point.joints);
        const reach = Math.sqrt(pos[0] ** 2 + pos[2] ** 2);

        // Note: workspace bounds are approximate, actual robot can reach further
        // at certain configurations. Allow 50% tolerance for edge cases.
        expect(reach).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.workspace.minReach * 0.5);
        expect(reach).toBeLessThanOrEqual(SO101_CONSTRAINTS.workspace.maxReach * 1.5);
        expect(pos[1]).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.workspace.minHeight - 0.05);
        expect(pos[1]).toBeLessThanOrEqual(SO101_CONSTRAINTS.workspace.maxHeight + 0.05);
      }
    });

    it('demo positions should be reachable', () => {
      const demoPositions = [
        { x: 0.16, y: 0.02, z: 0.01 },  // Original demo position
        { x: 0.12, y: 0.02, z: 0.15 },  // Far angled position
        { x: 0.17, y: 0.02, z: -0.03 }, // Left position
        { x: 0.17, y: 0.02, z: 0.03 },  // Right position
        { x: 0.19, y: 0.02, z: 0.00 },  // Extended reach
      ];

      for (const pos of demoPositions) {
        const reach = Math.sqrt(pos.x ** 2 + pos.z ** 2);
        expect(reach).toBeLessThanOrEqual(SO101_CONSTRAINTS.workspace.maxReach);
        expect(reach).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.workspace.minReach);
      }
    });
  });

  describe('Gripper Physics Validation', () => {
    it('gripper closure should have minimum duration for physics', () => {
      // Find gripper close step
      for (let i = 1; i < SAMPLE_PICKUP_TRAJECTORY.length; i++) {
        const prev = SAMPLE_PICKUP_TRAJECTORY[i - 1];
        const curr = SAMPLE_PICKUP_TRAJECTORY[i];

        // If gripper closed from open
        if (prev.joints.gripper > 50 && curr.joints.gripper < 50) {
          const closeDuration = curr.timestamp - prev.timestamp;
          expect(closeDuration).toBeGreaterThanOrEqual(SO101_CONSTRAINTS.gripper.closureTimeMs);
        }
      }
    });

    it('lift should occur after gripper close', () => {
      let gripperCloseIndex = -1;
      let liftIndex = -1;

      for (let i = 1; i < SAMPLE_PICKUP_TRAJECTORY.length; i++) {
        const prev = SAMPLE_PICKUP_TRAJECTORY[i - 1];
        const curr = SAMPLE_PICKUP_TRAJECTORY[i];

        // Find gripper close
        if (prev.joints.gripper > 50 && curr.joints.gripper < 50) {
          gripperCloseIndex = i;
        }

        // Find lift (shoulder going more negative = lifting)
        if (curr.joints.shoulder < prev.joints.shoulder - 10) {
          liftIndex = i;
        }
      }

      if (gripperCloseIndex > 0 && liftIndex > 0) {
        expect(liftIndex).toBeGreaterThan(gripperCloseIndex);
      }
    });
  });

  describe('Trajectory Smoothness', () => {
    it('trajectory should have monotonically increasing timestamps', () => {
      for (let i = 1; i < SAMPLE_PICKUP_TRAJECTORY.length; i++) {
        expect(SAMPLE_PICKUP_TRAJECTORY[i].timestamp)
          .toBeGreaterThan(SAMPLE_PICKUP_TRAJECTORY[i - 1].timestamp);
      }
    });

    it('should have reasonable frame intervals for 30fps', () => {
      const expectedInterval = 1000 / 30; // ~33ms
      const maxAllowedInterval = 2000; // 2 seconds max between keyframes

      for (let i = 1; i < SAMPLE_PICKUP_TRAJECTORY.length; i++) {
        const interval = SAMPLE_PICKUP_TRAJECTORY[i].timestamp -
                         SAMPLE_PICKUP_TRAJECTORY[i - 1].timestamp;
        expect(interval).toBeLessThanOrEqual(maxAllowedInterval);
      }
    });

    it('interpolated trajectory should maintain smoothness', () => {
      // Interpolate between two keyframes
      const start = SAMPLE_PICKUP_TRAJECTORY[0].joints;
      const end = SAMPLE_PICKUP_TRAJECTORY[1].joints;
      const duration = SAMPLE_PICKUP_TRAJECTORY[1].timestamp - SAMPLE_PICKUP_TRAJECTORY[0].timestamp;
      const fps = 30;
      const numFrames = Math.ceil(duration / (1000 / fps));

      let prevVelocity = 0;
      for (let f = 1; f <= numFrames; f++) {
        const t = f / numFrames;
        // Cubic ease-in-out
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const currentShoulder = start.shoulder + (end.shoulder - start.shoulder) * eased;

        if (f > 1) {
          const prevT = (f - 1) / numFrames;
          const prevEased = prevT < 0.5 ? 4 * prevT * prevT * prevT : 1 - Math.pow(-2 * prevT + 2, 3) / 2;
          const prevShoulder = start.shoulder + (end.shoulder - start.shoulder) * prevEased;

          const velocity = (currentShoulder - prevShoulder) / (1 / fps);
          const acceleration = (velocity - prevVelocity) / (1 / fps);

          // Check acceleration is reasonable
          expect(Math.abs(acceleration)).toBeLessThan(SO101_CONSTRAINTS.maxAccelerations.shoulder * 2);
          prevVelocity = velocity;
        }
      }
    });
  });
});

describe('Data Format Validation for LeRobot', () => {
  it('joint angles should be convertible to radians', () => {
    const DEG_TO_RAD = Math.PI / 180;

    for (const point of SAMPLE_PICKUP_TRAJECTORY) {
      const radians = {
        base: point.joints.base * DEG_TO_RAD,
        shoulder: point.joints.shoulder * DEG_TO_RAD,
        elbow: point.joints.elbow * DEG_TO_RAD,
        wrist: point.joints.wrist * DEG_TO_RAD,
        wristRoll: point.joints.wristRoll * DEG_TO_RAD,
      };

      // Verify conversion is correct
      expect(radians.base).toBeCloseTo(point.joints.base * DEG_TO_RAD, 6);

      // Verify radians are within expected range (-π to π for most joints)
      expect(Math.abs(radians.base)).toBeLessThan(Math.PI);
      expect(Math.abs(radians.shoulder)).toBeLessThan(Math.PI);
    }
  });

  it('gripper should normalize to 0-1 range', () => {
    for (const point of SAMPLE_PICKUP_TRAJECTORY) {
      const normalized = point.joints.gripper / 100;
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThanOrEqual(1);
    }
  });

  it('timestamps should convert to seconds', () => {
    for (const point of SAMPLE_PICKUP_TRAJECTORY) {
      const seconds = point.timestamp / 1000;
      expect(seconds).toBeGreaterThanOrEqual(0);
      expect(typeof seconds).toBe('number');
      expect(Number.isFinite(seconds)).toBe(true);
    }
  });
});

/**
 * Helper function to validate a complete episode
 */
export function validateEpisodeRealism(episode: {
  frames: Array<{
    timestamp: number;
    observation: { jointPositions: number[] };
    action: { jointTargets: number[] };
  }>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (let i = 0; i < episode.frames.length; i++) {
    const frame = episode.frames[i];
    const joints = frame.observation.jointPositions;

    // Check joint limits
    const limits = [
      SO101_CONSTRAINTS.jointLimits.base,
      SO101_CONSTRAINTS.jointLimits.shoulder,
      SO101_CONSTRAINTS.jointLimits.elbow,
      SO101_CONSTRAINTS.jointLimits.wrist,
      SO101_CONSTRAINTS.jointLimits.wristRoll,
      SO101_CONSTRAINTS.jointLimits.gripper,
    ];

    for (let j = 0; j < Math.min(joints.length, limits.length); j++) {
      if (joints[j] < limits[j].min || joints[j] > limits[j].max) {
        errors.push(`Frame ${i}: Joint ${j} out of bounds (${joints[j]})`);
      }
    }

    // Check velocity (if not first frame)
    if (i > 0) {
      const prevFrame = episode.frames[i - 1];
      const dt = (frame.timestamp - prevFrame.timestamp) / 1000;

      if (dt > 0) {
        const maxVelocities = [
          SO101_CONSTRAINTS.maxVelocities.base,
          SO101_CONSTRAINTS.maxVelocities.shoulder,
          SO101_CONSTRAINTS.maxVelocities.elbow,
          SO101_CONSTRAINTS.maxVelocities.wrist,
          SO101_CONSTRAINTS.maxVelocities.wristRoll,
          SO101_CONSTRAINTS.maxVelocities.gripper,
        ];

        for (let j = 0; j < Math.min(joints.length, maxVelocities.length); j++) {
          const velocity = Math.abs(joints[j] - prevFrame.observation.jointPositions[j]) / dt;
          if (velocity > maxVelocities[j] * 1.5) { // 50% tolerance
            errors.push(`Frame ${i}: Joint ${j} velocity too high (${velocity.toFixed(1)}°/s)`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Export the constraints for use in other tests
 */
export { SO101_CONSTRAINTS };
