/**
 * Trajectory Validator Tests
 *
 * Tests for the trajectory validation library that ensures
 * LLM-generated and demo trajectories are physically executable.
 */

import { describe, it, expect } from 'vitest';
import {
  validateTrajectory,
  validatePickupSequence,
  llmJointsToTrajectory,
  interpolateTrajectory,
  isTrajectoryValid,
  formatValidationResult,
  TrajectoryFrame,
} from '../lib/trajectoryValidator';

describe('Trajectory Validation', () => {
  describe('validateTrajectory', () => {
    it('should accept valid trajectory', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
        { timestamp: 800, joints: { base: 10, shoulder: -20, elbow: 30, wrist: 40, wristRoll: 90, gripper: 100 } },
        { timestamp: 1600, joints: { base: 10, shoulder: -20, elbow: 30, wrist: 40, wristRoll: 90, gripper: 0 } },
      ];

      const result = validateTrajectory(frames);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject trajectory with out-of-bounds joints', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 150, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
      ];

      const result = validateTrajectory(frames);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'joint_limit')).toBe(true);
    });

    it('should reject trajectory with excessive velocity', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
        { timestamp: 50, joints: { base: 100, shoulder: -90, elbow: 90, wrist: 90, wristRoll: 90, gripper: 100 } },
      ];

      const result = validateTrajectory(frames);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'velocity')).toBe(true);
    });

    it('should warn about near-limit positions', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 108, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
      ];

      const result = validateTrajectory(frames);
      expect(result.warnings.some(w => w.type === 'near_limit')).toBe(true);
    });

    it('should track max velocity and acceleration', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
        { timestamp: 1000, joints: { base: 30, shoulder: -30, elbow: 30, wrist: 30, wristRoll: 30, gripper: 100 } },
      ];

      const result = validateTrajectory(frames);
      expect(result.stats.maxVelocity.base).toBe(30); // 30° in 1s = 30°/s
      expect(result.stats.maxVelocity.shoulder).toBe(30);
    });
  });

  describe('validatePickupSequence', () => {
    it('should accept valid pickup sequence', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
        { timestamp: 800, joints: { gripper: 0 }, _gripperOnly: true, _duration: 800 },
        { timestamp: 1500, joints: { base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 } },
      ];

      const result = validatePickupSequence(frames);
      expect(result.valid).toBe(true);
    });

    it('should reject pickup without gripper close', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
        { timestamp: 800, joints: { base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 } },
      ];

      const result = validatePickupSequence(frames);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('gripper close'))).toBe(true);
    });

    it('should warn about missing lift', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { gripper: 100 } },
        { timestamp: 800, joints: { gripper: 0 }, _gripperOnly: true, _duration: 800 },
      ];

      const result = validatePickupSequence(frames);
      expect(result.warnings.some(w => w.type === 'missing_lift')).toBe(true);
    });

    it('should reject gripper close that is too fast', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
        { timestamp: 100, joints: { gripper: 0 }, _gripperOnly: true, _duration: 100 },
        { timestamp: 800, joints: { base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 } },
      ];

      const result = validatePickupSequence(frames);
      expect(result.errors.some(e => e.type === 'gripper_timing')).toBe(true);
    });
  });

  describe('llmJointsToTrajectory', () => {
    it('should convert LLM joints array to trajectory', () => {
      const llmJoints = [
        { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
        { gripper: 0, _gripperOnly: true, _duration: 800 },
        { base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      ];

      const trajectory = llmJointsToTrajectory(llmJoints);

      expect(trajectory).toHaveLength(3);
      expect(trajectory[0].timestamp).toBe(0);
      expect(trajectory[1].timestamp).toBe(600); // Default duration
      expect(trajectory[2].timestamp).toBe(1400); // 600 + 800
    });

    it('should preserve _gripperOnly flag', () => {
      const llmJoints = [
        { gripper: 100 },
        { gripper: 0, _gripperOnly: true, _duration: 800 },
      ];

      const trajectory = llmJointsToTrajectory(llmJoints);

      expect(trajectory[1]._gripperOnly).toBe(true);
      expect(trajectory[1]._duration).toBe(800);
    });
  });

  describe('interpolateTrajectory', () => {
    it('should interpolate to target frame rate', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0 } },
        { timestamp: 1000, joints: { base: 90 } },
      ];

      const interpolated = interpolateTrajectory(frames, 30);

      // 1000ms at 30fps = 30 frames + 1
      expect(interpolated.length).toBeGreaterThanOrEqual(30);
    });

    it('should use easing for smooth motion', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0 } },
        { timestamp: 1000, joints: { base: 100 } },
      ];

      const interpolated = interpolateTrajectory(frames, 30);

      // Early frames should have smaller delta (ease-in)
      const earlyDelta = (interpolated[2].joints.base ?? 0) - (interpolated[1].joints.base ?? 0);
      const midIdx = Math.floor(interpolated.length / 2);
      const midDelta = (interpolated[midIdx + 1].joints.base ?? 0) - (interpolated[midIdx].joints.base ?? 0);

      expect(earlyDelta).toBeLessThan(midDelta);
    });

    it('should handle single frame', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 45 } },
      ];

      const interpolated = interpolateTrajectory(frames, 30);
      expect(interpolated).toHaveLength(1);
    });
  });

  describe('isTrajectoryValid', () => {
    it('should return true for valid trajectory', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0, gripper: 100 } },
        { timestamp: 1000, joints: { base: 30, gripper: 0 } },
      ];

      expect(isTrajectoryValid(frames)).toBe(true);
    });

    it('should return false for invalid trajectory', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 200, gripper: 100 } }, // base out of bounds
      ];

      expect(isTrajectoryValid(frames)).toBe(false);
    });
  });

  describe('formatValidationResult', () => {
    it('should format valid result', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 0 } },
        { timestamp: 1000, joints: { base: 30 } },
      ];

      const result = validateTrajectory(frames);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('✓ Trajectory is valid');
      expect(formatted).toContain('2 frames');
    });

    it('should format errors and warnings', () => {
      const frames: TrajectoryFrame[] = [
        { timestamp: 0, joints: { base: 150, gripper: 100 } }, // error: out of bounds
        { timestamp: 100, joints: { base: 0, gripper: 0 } },   // warning: fast motion
      ];

      const result = validateTrajectory(frames);
      const formatted = formatValidationResult(result);

      expect(formatted).toContain('✗ Trajectory has errors');
      expect(formatted).toContain('joint_limit');
    });
  });
});

describe('Edge Cases', () => {
  it('should handle empty trajectory', () => {
    const result = validateTrajectory([]);
    expect(result.valid).toBe(true);
    expect(result.stats.totalFrames).toBe(0);
  });

  it('should handle partial joint specification', () => {
    const frames: TrajectoryFrame[] = [
      { timestamp: 0, joints: { base: 10 } },          // Only base
      { timestamp: 500, joints: { shoulder: -20 } },   // Only shoulder
      { timestamp: 1000, joints: { gripper: 0 } },     // Only gripper
    ];

    const result = validateTrajectory(frames);
    // Should be valid - partial specs are allowed
    expect(result.errors.filter(e => e.type === 'joint_limit')).toHaveLength(0);
  });

  it('should handle gripper-only frames', () => {
    const frames: TrajectoryFrame[] = [
      { timestamp: 0, joints: { gripper: 100 }, _gripperOnly: true },
      { timestamp: 800, joints: { gripper: 0 }, _gripperOnly: true, _duration: 800 },
    ];

    const result = validateTrajectory(frames);
    expect(result.valid).toBe(true);
  });

  it('should handle negative timestamps gracefully', () => {
    const frames: TrajectoryFrame[] = [
      { timestamp: -100, joints: { base: 0 } },
      { timestamp: 0, joints: { base: 10 } },
    ];

    // Should warn but not crash
    const result = validateTrajectory(frames);
    expect(result).toBeDefined();
  });
});
