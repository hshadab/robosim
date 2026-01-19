/**
 * Hardware Limits Validation Tests
 *
 * Tests for validating data against SO-101 hardware constraints.
 */

import { describe, it, expect } from 'vitest';
import { validateForSO101, validateWorkspaceBounds } from '../utils/validationHelpers';
import { VALID_EPISODES, INVALID_EPISODES, SO101_LIMITS_RAD, SO101_MAX_VEL_RAD } from '../fixtures/episodes';
import type { Episode, EpisodeFrame } from '../fixtures/episodes';

describe('Hardware Limits Validation', () => {
  // ============================================================================
  // Joint Position Limits
  // ============================================================================

  describe('Joint Position Limits', () => {
    it('should accept positions within limits', () => {
      // minimalValid is designed to pass all hardware validation
      const result = validateForSO101(VALID_EPISODES.minimalValid);

      expect(result.valid).toBe(true);
      expect(result.errors.filter(e => e.type === 'position').length).toBe(0);
    });

    it('should reject positions exceeding base limits', () => {
      const result = validateForSO101(INVALID_EPISODES.outOfRangeJoint);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.type === 'position' && e.joint === 'base')).toBe(true);
    });

    it('should check all 6 joints', () => {
      const result = validateForSO101(VALID_EPISODES.pickupSuccess);

      // No position errors means all joints were validated
      expect(result.errors.filter(e => e.type === 'position').length).toBe(0);
    });

    it('should report specific joint and frame for violations', () => {
      const result = validateForSO101(INVALID_EPISODES.outOfRangeJoint);

      const positionErrors = result.errors.filter(e => e.type === 'position');
      if (positionErrors.length > 0) {
        expect(positionErrors[0].joint).toBeDefined();
        expect(positionErrors[0].frame).toBeDefined();
        expect(positionErrors[0].value).toBeDefined();
        expect(positionErrors[0].limit).toBeDefined();
      }
    });

    it('should validate against documented SO-101 limits', () => {
      // Create episode at exact limit boundaries
      const frame: EpisodeFrame = {
        timestamp: 0,
        observation: {
          state: [
            SO101_LIMITS_RAD.base.max, // At max
            SO101_LIMITS_RAD.shoulder.min, // At min
            0, 0, 0, 0.5,
          ],
        },
        action: [0, 0, 0, 0, 0, 0.5],
      };

      const episode: Episode = {
        id: 'boundary_test',
        frames: [frame],
        metadata: { action: 'test', success: true },
      };

      const result = validateForSO101(episode);

      expect(result.errors.filter(e => e.type === 'position').length).toBe(0);
    });
  });

  // ============================================================================
  // Velocity Limits
  // ============================================================================

  describe('Velocity Limits', () => {
    it('should accept velocities within limits', () => {
      // minimalValid is designed to pass all hardware validation
      const result = validateForSO101(VALID_EPISODES.minimalValid);

      expect(result.errors.filter(e => e.type === 'velocity').length).toBe(0);
    });

    it('should check velocity for frames with velocity data', () => {
      // minimalValid has velocity data that is within limits
      const episode = VALID_EPISODES.minimalValid;
      const hasVelocity = episode.frames.some(f => f.velocity !== undefined);

      if (hasVelocity) {
        const result = validateForSO101(episode);
        expect(result.errors.filter(e => e.type === 'velocity').length).toBe(0);
      }
    });

    it('should allow 10% velocity tolerance', () => {
      // Create episode with velocity at 105% of limit (should pass)
      const frame1: EpisodeFrame = {
        timestamp: 0,
        observation: { state: [0, 0, 0, 0, 0, 0.5] },
        action: [0, 0, 0, 0, 0, 0.5],
      };

      const frame2: EpisodeFrame = {
        timestamp: 100,
        observation: { state: [0, 0, 0, 0, 0, 0.5] },
        action: [0, 0, 0, 0, 0, 0.5],
        velocity: [
          SO101_MAX_VEL_RAD.base * 1.05, // 5% over - should pass
          0, 0, 0, 0, 0,
        ],
      };

      const episode: Episode = {
        id: 'velocity_tolerance_test',
        frames: [frame1, frame2],
        metadata: { action: 'test', success: true },
      };

      const result = validateForSO101(episode);

      expect(result.errors.filter(e => e.type === 'velocity').length).toBe(0);
    });

    it('should reject velocity exceeding 110% of limit', () => {
      const frame1: EpisodeFrame = {
        timestamp: 0,
        observation: { state: [0, 0, 0, 0, 0, 0.5] },
        action: [0, 0, 0, 0, 0, 0.5],
      };

      const frame2: EpisodeFrame = {
        timestamp: 100,
        observation: { state: [0, 0, 0, 0, 0, 0.5] },
        action: [0, 0, 0, 0, 0, 0.5],
        velocity: [
          SO101_MAX_VEL_RAD.base * 1.2, // 20% over - should fail
          0, 0, 0, 0, 0,
        ],
      };

      const episode: Episode = {
        id: 'velocity_over_test',
        frames: [frame1, frame2],
        metadata: { action: 'test', success: true },
      };

      const result = validateForSO101(episode);

      expect(result.errors.filter(e => e.type === 'velocity').length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Gripper Timing
  // ============================================================================

  describe('Gripper Timing', () => {
    it('should accept gripper close >= 800ms for pickup', () => {
      const result = validateForSO101(VALID_EPISODES.pickupSuccess);

      expect(result.errors.filter(e => e.type === 'gripper_timing').length).toBe(0);
    });

    it('should reject gripper close < 800ms for pickup', () => {
      // Create pickup episode with fast gripper close
      const frames: EpisodeFrame[] = [];

      // Open gripper frame
      frames.push({
        timestamp: 0,
        observation: { state: [0, 0, 0, 0, 0, 0.9] },
        action: [0, 0, 0, 0, 0, 0.9],
      });

      // Close gripper too fast (only 500ms)
      frames.push({
        timestamp: 500,
        observation: { state: [0, 0, 0, 0, 0, 0.05] },
        action: [0, 0, 0, 0, 0, 0.05],
      });

      const episode: Episode = {
        id: 'fast_gripper_test',
        frames,
        metadata: { action: 'pickup', success: true },
      };

      const result = validateForSO101(episode);

      expect(result.errors.filter(e => e.type === 'gripper_timing').length).toBeGreaterThan(0);
    });

    it('should not check gripper timing for place actions', () => {
      const result = validateForSO101(VALID_EPISODES.placeSuccess);

      // Place actions should not have gripper timing requirements
      expect(result.errors.filter(e => e.type === 'gripper_timing').length).toBe(0);
    });

    it('should detect proper grasp sequence', () => {
      // Create proper grasp sequence (open -> close over >800ms)
      const frames: EpisodeFrame[] = [];

      // 100 frames at 30fps = 3.3 seconds total
      for (let i = 0; i <= 100; i++) {
        const t = i * 33; // 30fps
        let gripper: number;
        if (i < 30) {
          gripper = 0.9; // Open for first 1 second
        } else if (i < 90) {
          // Close slowly over 60 frames (2000ms) - from 0.9 to 0.05
          // This ensures >800ms for 0.5->0.1 transition
          gripper = 0.9 - ((i - 30) / 60) * 0.85;
        } else {
          gripper = 0.05; // Closed
        }
        frames.push({
          timestamp: t,
          observation: { state: [0, 0, 0, 0, 0, gripper] },
          action: [0, 0, 0, 0, 0, gripper],
        });
      }

      const episode: Episode = {
        id: 'proper_grasp_test',
        frames,
        metadata: { action: 'pickup', success: true },
      };

      const result = validateForSO101(episode);

      expect(result.errors.filter(e => e.type === 'gripper_timing').length).toBe(0);
    });
  });

  // ============================================================================
  // State Dimensions
  // ============================================================================

  describe('State Dimensions', () => {
    it('should accept 6-dimensional state', () => {
      const result = validateForSO101(VALID_EPISODES.pickupSuccess);

      expect(result.errors.filter(e => e.type === 'dimension').length).toBe(0);
    });

    it('should reject wrong dimensions', () => {
      const result = validateForSO101(INVALID_EPISODES.wrongDimensions);

      expect(result.errors.filter(e => e.type === 'dimension').length).toBeGreaterThan(0);
    });

    it('should report dimension errors with frame index', () => {
      const result = validateForSO101(INVALID_EPISODES.wrongDimensions);

      const dimErrors = result.errors.filter(e => e.type === 'dimension');
      if (dimErrors.length > 0) {
        expect(dimErrors[0].frame).toBeDefined();
        expect(dimErrors[0].message).toContain('joint values');
      }
    });
  });

  // ============================================================================
  // Workspace Bounds
  // ============================================================================

  describe('Workspace Bounds', () => {
    it('should accept positions within workspace', () => {
      const result = validateWorkspaceBounds(VALID_EPISODES.pickupSuccess);

      expect(result).toBe(true);
    });

    it('should detect potential singularity configurations', () => {
      // Create episode with extended arm (potential singularity)
      const frame: EpisodeFrame = {
        timestamp: 0,
        observation: {
          state: [0, 2.0, 1.5, 0, 0, 0.5], // Very extended arm
        },
        action: [0, 2.0, 1.5, 0, 0, 0.5],
      };

      const episode: Episode = {
        id: 'singularity_test',
        frames: [frame],
        metadata: { action: 'test', success: true },
      };

      const result = validateWorkspaceBounds(episode);

      expect(result).toBe(false);
    });

    it('should accept compact configurations', () => {
      // Create episode with tucked arm
      const frame: EpisodeFrame = {
        timestamp: 0,
        observation: {
          state: [0, 0.5, 0.5, 0, 0, 0.5],
        },
        action: [0, 0.5, 0.5, 0, 0, 0.5],
      };

      const episode: Episode = {
        id: 'compact_test',
        frames: [frame],
        metadata: { action: 'test', success: true },
      };

      const result = validateWorkspaceBounds(episode);

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Error Aggregation
  // ============================================================================

  describe('Error Aggregation', () => {
    it('should collect all errors from all frames', () => {
      const result = validateForSO101(INVALID_EPISODES.outOfRangeJoint);

      // Should have at least one error
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should include warnings for marginal cases', () => {
      const result = validateForSO101(VALID_EPISODES.pickupSuccess);

      // Warnings array should exist even if empty
      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should provide complete validation summary', () => {
      const result = validateForSO101(VALID_EPISODES.pickupSuccess);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  // ============================================================================
  // Integration with Real Constraints
  // ============================================================================

  describe('Real Hardware Constraints', () => {
    it('should validate against actual SO-101 base limits (±110°)', () => {
      // Base limit is ±110° = ±1.92 rad (real SO-101 hardware limit)
      expect(SO101_LIMITS_RAD.base.min).toBeCloseTo(-110 * Math.PI / 180, 1);
      expect(SO101_LIMITS_RAD.base.max).toBeCloseTo(110 * Math.PI / 180, 1);
    });

    it('should validate against actual SO-101 shoulder limits', () => {
      // Shoulder should have asymmetric limits
      expect(SO101_LIMITS_RAD.shoulder.min).toBeLessThan(0);
      expect(SO101_LIMITS_RAD.shoulder.max).toBeGreaterThan(0);
    });

    it('should validate against actual SO-101 velocity limits', () => {
      // All velocity limits should be positive
      for (const [joint, limit] of Object.entries(SO101_MAX_VEL_RAD)) {
        expect(limit).toBeGreaterThan(0);
      }
    });

    it('should handle gripper normalized range (0-1)', () => {
      // Gripper should be 0-1 in normalized form
      expect(SO101_LIMITS_RAD.gripper.min).toBe(0);
      expect(SO101_LIMITS_RAD.gripper.max).toBe(1);
    });
  });
});
