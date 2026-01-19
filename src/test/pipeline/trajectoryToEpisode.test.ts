/**
 * Trajectory to Episode Pipeline Tests
 *
 * Tests the second stage of the pipeline: converting trajectories to LeRobot episodes.
 */

import { describe, it, expect } from 'vitest';
import { trajectoryToEpisode, calculateAverageFrameGap, calculateAverageJerk } from '../utils/pipelineHelpers';
import { VALID_TRAJECTORIES, INVALID_TRAJECTORIES } from '../fixtures/trajectories';

describe('Trajectory to Episode Pipeline', () => {
  // ============================================================================
  // Basic Conversion
  // ============================================================================

  describe('Basic Conversion', () => {
    it('should convert simple pickup trajectory to episode', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      expect(episode).toBeDefined();
      expect(episode.id).toBeDefined();
      expect(episode.frames.length).toBeGreaterThan(0);
      expect(episode.metadata.action).toBe('pickup');
    });

    it('should convert smooth motion trajectory', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.smoothMotion);

      expect(episode).toBeDefined();
      expect(episode.frames.length).toBeGreaterThan(0);
    });

    it('should handle minimal valid trajectory', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.minimalValid);

      expect(episode).toBeDefined();
      expect(episode.frames.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle empty trajectory', () => {
      const emptyTrajectory = { frames: [], metadata: {} };
      const episode = trajectoryToEpisode(emptyTrajectory);

      expect(episode).toBeDefined();
      expect(episode.frames.length).toBe(0);
      expect(episode.metadata.success).toBe(false);
    });
  });

  // ============================================================================
  // 30fps Interpolation
  // ============================================================================

  describe('30fps Interpolation', () => {
    it('should produce approximately 30fps output', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.longDuration);

      if (episode.frames.length >= 2) {
        const avgGap = calculateAverageFrameGap(episode);
        // 30fps = 33.33ms per frame, allow 10% tolerance
        expect(avgGap).toBeGreaterThan(30);
        expect(avgGap).toBeLessThan(40);
      }
    });

    it('should interpolate smoothly between keyframes', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.smoothMotion);

      // Calculate jerk (rate of acceleration change) - should be reasonable
      const avgJerk = calculateAverageJerk(episode);
      expect(avgJerk).toBeLessThan(1000); // Reasonable jerk limit
    });

    it('should handle sparse keyframes correctly', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      // Should have more frames than source keyframes due to interpolation
      expect(episode.frames.length).toBeGreaterThan(VALID_TRAJECTORIES.simplePickup.frames.length);
    });
  });

  // ============================================================================
  // Unit Conversion
  // ============================================================================

  describe('Unit Conversion', () => {
    it('should convert degrees to radians for joints', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      // All joint values should be in radians (typically < 2π for reasonable angles)
      for (const frame of episode.frames) {
        for (let i = 0; i < 5; i++) {
          // First 5 joints (not gripper)
          expect(Math.abs(frame.observation.state[i])).toBeLessThan(Math.PI * 2);
        }
      }
    });

    it('should normalize gripper to 0-1 range', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (const frame of episode.frames) {
        const gripper = frame.observation.state[5];
        expect(gripper).toBeGreaterThanOrEqual(0);
        expect(gripper).toBeLessThanOrEqual(1);
      }
    });

    it('should preserve gripper state transitions', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      // For pickup, should have gripper transition from open to closed
      const firstGripper = episode.frames[0].observation.state[5];
      const lastGripper = episode.frames[episode.frames.length - 1].observation.state[5];

      // Pickup should start open (higher value) and end closed (lower value)
      expect(firstGripper).toBeGreaterThan(lastGripper);
    });
  });

  // ============================================================================
  // Velocity Calculation
  // ============================================================================

  describe('Velocity Calculation', () => {
    it('should include velocity data in frames', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.smoothMotion);

      for (let i = 1; i < episode.frames.length; i++) {
        expect(episode.frames[i].velocity).toBeDefined();
        expect(episode.frames[i].velocity!.length).toBe(6);
      }
    });

    it('should calculate reasonable velocities', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.smoothMotion);

      for (const frame of episode.frames) {
        if (frame.velocity) {
          for (const vel of frame.velocity) {
            // Velocity should be finite and within reasonable bounds
            expect(Number.isFinite(vel)).toBe(true);
            expect(Math.abs(vel)).toBeLessThan(10); // rad/s reasonable bound
          }
        }
      }
    });

    it('should have zero velocity for first frame', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      if (episode.frames.length > 0) {
        const firstVelocity = episode.frames[0].velocity || [0, 0, 0, 0, 0, 0];
        for (const vel of firstVelocity) {
          expect(vel).toBe(0);
        }
      }
    });
  });

  // ============================================================================
  // State and Action Arrays
  // ============================================================================

  describe('State and Action Arrays', () => {
    it('should produce 6-element state arrays', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (const frame of episode.frames) {
        expect(frame.observation.state.length).toBe(6);
      }
    });

    it('should produce 6-element action arrays', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (const frame of episode.frames) {
        expect(frame.action.length).toBe(6);
      }
    });

    it('should have action match target state', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (const frame of episode.frames) {
        // In this simple implementation, action equals state
        expect(frame.action).toEqual(frame.observation.state);
      }
    });
  });

  // ============================================================================
  // Timestamp Handling
  // ============================================================================

  describe('Timestamp Handling', () => {
    it('should have monotonically increasing timestamps', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (let i = 1; i < episode.frames.length; i++) {
        expect(episode.frames[i].timestamp).toBeGreaterThan(episode.frames[i - 1].timestamp);
      }
    });

    it('should round timestamps to integers', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      for (const frame of episode.frames) {
        expect(Number.isInteger(frame.timestamp)).toBe(true);
      }
    });

    it('should preserve approximate duration', () => {
      const trajectory = VALID_TRAJECTORIES.longDuration;
      const episode = trajectoryToEpisode(trajectory);

      if (trajectory.frames.length >= 2 && episode.frames.length >= 2) {
        const srcDuration =
          trajectory.frames[trajectory.frames.length - 1].timestamp -
          trajectory.frames[0].timestamp;
        const destDuration =
          episode.frames[episode.frames.length - 1].timestamp - episode.frames[0].timestamp;

        // Duration should be preserved within 10%
        expect(Math.abs(destDuration - srcDuration) / srcDuration).toBeLessThan(0.1);
      }
    });
  });

  // ============================================================================
  // Metadata
  // ============================================================================

  describe('Metadata', () => {
    it('should preserve action type in metadata', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      expect(episode.metadata.action).toBe('pickup');
    });

    it('should preserve object type in metadata', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      expect(episode.metadata.objectType).toBe('cube');
    });

    it('should generate language description', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      expect(episode.metadata.language).toContain('pickup');
      expect(episode.metadata.language).toContain('cube');
    });

    it('should set success flag based on completion', () => {
      const episode = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);

      // Valid trajectory should result in successful episode
      expect(episode.metadata.success).toBe(true);
    });

    it('should generate unique episode ID', () => {
      const episode1 = trajectoryToEpisode(VALID_TRAJECTORIES.simplePickup);
      const episode2 = trajectoryToEpisode(VALID_TRAJECTORIES.smoothMotion);

      expect(episode1.id).not.toBe(episode2.id);
    });
  });
});
