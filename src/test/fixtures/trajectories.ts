/**
 * Test Fixtures: Trajectories
 *
 * Sample trajectory data for testing trajectory-to-episode conversion.
 */

import type { JointState } from '../../types';

export interface TrajectoryFrame {
  timestamp: number;
  joints: Partial<JointState>;
  _gripperOnly?: boolean;
  _duration?: number;
}

export interface Trajectory {
  frames: TrajectoryFrame[];
  metadata?: {
    action?: string;
    objectType?: string;
    objectPosition?: [number, number, number];
  };
}

export const VALID_TRAJECTORIES: Record<string, Trajectory> = {
  simplePickup: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 1300, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 }, _gripperOnly: true, _duration: 800 },
      { timestamp: 1800, joints: { base: 5, shoulder: -35, elbow: 40, wrist: 55, wristRoll: 90, gripper: 0 } },
    ],
    metadata: {
      action: 'pickup',
      objectType: 'cube',
      objectPosition: [0.16, 0.02, 0.01],
    },
  },

  smoothMotion: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 200, joints: { base: 5, shoulder: -5, elbow: 10, wrist: 10, wristRoll: 90, gripper: 50 } },
      { timestamp: 400, joints: { base: 10, shoulder: -10, elbow: 20, wrist: 20, wristRoll: 90, gripper: 50 } },
      { timestamp: 600, joints: { base: 15, shoulder: -15, elbow: 30, wrist: 30, wristRoll: 90, gripper: 50 } },
      { timestamp: 800, joints: { base: 20, shoulder: -20, elbow: 40, wrist: 40, wristRoll: 90, gripper: 50 } },
      { timestamp: 1000, joints: { base: 25, shoulder: -25, elbow: 50, wrist: 50, wristRoll: 90, gripper: 50 } },
    ],
    metadata: {
      action: 'move',
    },
  },

  longDuration: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 1000, joints: { base: 10, shoulder: -20, elbow: 40, wrist: 50, wristRoll: 90, gripper: 100 } },
      { timestamp: 2000, joints: { base: 10, shoulder: -20, elbow: 40, wrist: 50, wristRoll: 90, gripper: 50 } },
      { timestamp: 3000, joints: { base: 10, shoulder: -20, elbow: 40, wrist: 50, wristRoll: 90, gripper: 0 }, _duration: 1000 },
      { timestamp: 4000, joints: { base: 10, shoulder: -30, elbow: 30, wrist: 40, wristRoll: 90, gripper: 0 } },
      { timestamp: 5000, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 0 } },
    ],
    metadata: {
      action: 'pickup',
      objectType: 'cube',
    },
  },

  minimalValid: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 1500, joints: { base: 5, shoulder: -20, elbow: 45, wrist: 55, wristRoll: 90, gripper: 100 } },
      // 2000ms gripper close for proper physics detection after normalization
      { timestamp: 3500, joints: { base: 5, shoulder: -20, elbow: 45, wrist: 55, wristRoll: 90, gripper: 5 }, _gripperOnly: true, _duration: 2000 },
      { timestamp: 4000, joints: { base: 5, shoulder: -30, elbow: 35, wrist: 45, wristRoll: 90, gripper: 5 } },
    ],
    metadata: {
      action: 'pickup',
    },
  },
};

export const INVALID_TRAJECTORIES: Record<string, Trajectory> = {
  tooShort: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -20, elbow: 45, wrist: 55, wristRoll: 90, gripper: 0 } },
    ],
    metadata: {
      action: 'pickup',
    },
  },

  excessiveVelocity: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 50, joints: { base: 60, shoulder: -60, elbow: 60, wrist: 60, wristRoll: 90, gripper: 100 } }, // 1200°/s!
      { timestamp: 850, joints: { base: 60, shoulder: -60, elbow: 60, wrist: 60, wristRoll: 90, gripper: 0 }, _gripperOnly: true, _duration: 800 },
    ],
    metadata: {
      action: 'pickup',
    },
  },

  outOfBounds: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 150, shoulder: -120, elbow: 110, wrist: 100, wristRoll: 90, gripper: 100 } }, // All out of bounds
    ],
    metadata: {
      action: 'move',
    },
  },

  noGripperClose: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 1000, joints: { base: 5, shoulder: -35, elbow: 40, wrist: 55, wristRoll: 90, gripper: 100 } }, // Never closes gripper
    ],
    metadata: {
      action: 'pickup',
    },
  },

  highJerk: {
    frames: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 100, joints: { base: 30, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 200, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 300, joints: { base: 30, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 400, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
    ],
    metadata: {
      action: 'move',
    },
  },
};

/**
 * SO-101 joint limits for validation
 * Re-exported from centralized so101Limits.ts for backward compatibility
 */
export { SO101_JOINT_LIMITS } from '../../config/so101Limits';

// SO-101 max velocities in degrees per second
export const SO101_MAX_VELOCITIES = {
  base: 180,
  shoulder: 120,
  elbow: 150,
  wrist: 200,
  wristRoll: 200,
  gripper: 300,
};
