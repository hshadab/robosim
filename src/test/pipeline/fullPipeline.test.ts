/**
 * Full Pipeline Integration Tests
 *
 * End-to-end tests for the complete LLM → Trajectory → Episode → Export pipeline.
 */

import { describe, it, expect } from 'vitest';
import { processLLMToTrajectory, trajectoryToEpisode, validateEpisodeQuality } from '../utils/pipelineHelpers';
import { validateForSO101, validateLeRobotSchema, validateTemporalConsistency } from '../utils/validationHelpers';
import { VALID_LLM_RESPONSES, INVALID_LLM_RESPONSES } from '../fixtures/llmResponses';

describe('Full Pipeline Integration', () => {
  // ============================================================================
  // Happy Path: Complete Pipeline
  // ============================================================================

  describe('Complete Pipeline - Happy Path', () => {
    it('should process pickup command through full pipeline', () => {
      // Stage 1: LLM → Trajectory
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      expect(trajectoryResult.success).toBe(true);

      // Stage 2: Trajectory → Episode
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      expect(episode.frames.length).toBeGreaterThan(0);

      // Stage 3: Validate Episode Quality
      const qualityResult = validateEpisodeQuality(episode);
      expect(qualityResult.valid).toBe(true);

      // Stage 4: Validate for Hardware
      const hardwareResult = validateForSO101(episode);
      expect(hardwareResult.valid).toBe(true);

      // Stage 5: Validate Schema
      const schemaResult = validateLeRobotSchema(episode);
      expect(schemaResult.valid).toBe(true);
    });

    it('should process place command through full pipeline', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.placeObject);
      expect(trajectoryResult.success).toBe(true);

      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const qualityResult = validateEpisodeQuality(episode);
      const hardwareResult = validateForSO101(episode);
      const schemaResult = validateLeRobotSchema(episode);

      expect(qualityResult.valid).toBe(true);
      expect(hardwareResult.valid).toBe(true);
      expect(schemaResult.valid).toBe(true);
    });

    it('should process stack command through full pipeline', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.stackBlocks);
      expect(trajectoryResult.success).toBe(true);

      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      // Stack operations should produce longer episodes
      expect(episode.frames.length).toBeGreaterThan(50);

      const schemaResult = validateLeRobotSchema(episode);
      expect(schemaResult.valid).toBe(true);
    });
  });

  // ============================================================================
  // Error Propagation
  // ============================================================================

  describe('Error Propagation', () => {
    it('should fail early on invalid LLM response', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.malformedJson);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.trajectory).toBeUndefined();
    });

    it('should fail on joint limit violations', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.outOfBoundsJoints);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('joint_limits');
    });

    it('should fail on velocity violations', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.excessiveVelocity);

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe('velocity');
    });

    it('should provide actionable error messages', () => {
      const result = processLLMToTrajectory(INVALID_LLM_RESPONSES.outOfBoundsJoints);

      expect(result.error?.message).toBeDefined();
      expect(result.error?.message.length).toBeGreaterThan(10);
      expect(result.error?.details).toBeDefined();
    });
  });

  // ============================================================================
  // Data Quality Gates
  // ============================================================================

  describe('Quality Gates', () => {
    it('should produce episodes with minimum frame count', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const qualityResult = validateEpisodeQuality(episode);

      // Minimum 45 frames for 1.5s at 30fps
      expect(episode.frames.length).toBeGreaterThanOrEqual(45);
      expect(qualityResult.valid).toBe(true);
    });

    it('should produce episodes with minimum duration', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      if (episode.frames.length >= 2) {
        const duration = episode.frames[episode.frames.length - 1].timestamp - episode.frames[0].timestamp;
        expect(duration).toBeGreaterThanOrEqual(1500); // 1.5s minimum
      }
    });

    it('should have consistent frame timing', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.smoothMotion);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const temporalResult = validateTemporalConsistency(episode);

      expect(temporalResult.monotonic).toBe(true);
    });
  });

  // ============================================================================
  // Hardware Compatibility
  // ============================================================================

  describe('Hardware Compatibility', () => {
    it('should produce SO-101 compatible joint positions', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const hardwareResult = validateForSO101(episode);

      expect(hardwareResult.valid).toBe(true);
      expect(hardwareResult.errors.filter(e => e.type === 'position').length).toBe(0);
    });

    it('should produce SO-101 compatible velocities', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.smoothMotion);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const hardwareResult = validateForSO101(episode);

      expect(hardwareResult.errors.filter(e => e.type === 'velocity').length).toBe(0);
    });

    it('should have proper gripper timing for pickup', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      const hardwareResult = validateForSO101(episode);

      expect(hardwareResult.errors.filter(e => e.type === 'gripper_timing').length).toBe(0);
    });
  });

  // ============================================================================
  // Metadata Preservation
  // ============================================================================

  describe('Metadata Preservation', () => {
    it('should preserve action type through pipeline', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      expect(episode.metadata.action).toBe('pickup');
    });

    it('should preserve object type through pipeline', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.cylinderPickup);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      expect(episode.metadata.objectType).toBe('cylinder');
    });

    it('should generate language description', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      expect(episode.metadata.language).toBeDefined();
      expect(episode.metadata.language).toContain('pickup');
    });
  });

  // ============================================================================
  // Batch Processing
  // ============================================================================

  describe('Batch Processing', () => {
    it('should process multiple episodes consistently', () => {
      const responses = [
        VALID_LLM_RESPONSES.pickupCube,
        VALID_LLM_RESPONSES.placeObject,
        VALID_LLM_RESPONSES.singleMove,
      ];

      const episodes = responses.map(response => {
        const trajectoryResult = processLLMToTrajectory(response);
        expect(trajectoryResult.success).toBe(true);
        return trajectoryToEpisode(trajectoryResult.trajectory!);
      });

      // All episodes should be valid
      for (const episode of episodes) {
        const schemaResult = validateLeRobotSchema(episode);
        expect(schemaResult.valid).toBe(true);
      }
    });

    it('should generate unique episode IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 5; i++) {
        const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.singleMove);
        const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
        ids.add(episode.id);
      }

      // All IDs should be unique
      expect(ids.size).toBe(5);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle minimal valid trajectory', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.singleMove);
      expect(trajectoryResult.success).toBe(true);

      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      expect(episode.frames.length).toBeGreaterThan(0);
    });

    it('should handle long trajectories', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.stackBlocks);
      expect(trajectoryResult.success).toBe(true);

      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);
      // Stack blocks has many keyframes, should produce many interpolated frames
      expect(episode.frames.length).toBeGreaterThan(100);
    });

    it('should correctly interpolate between sparse keyframes', () => {
      const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.singleMove);
      const episode = trajectoryToEpisode(trajectoryResult.trajectory!);

      // Should have interpolated frames between the two keyframes
      expect(episode.frames.length).toBeGreaterThan(2);

      // All values should be within valid ranges
      for (const frame of episode.frames) {
        for (let i = 0; i < 6; i++) {
          expect(Number.isFinite(frame.observation.state[i])).toBe(true);
        }
      }
    });
  });

  // ============================================================================
  // Performance Characteristics
  // ============================================================================

  describe('Performance Characteristics', () => {
    it('should process pipeline in reasonable time', () => {
      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        const trajectoryResult = processLLMToTrajectory(VALID_LLM_RESPONSES.pickupCube);
        trajectoryToEpisode(trajectoryResult.trajectory!);
      }

      const elapsed = performance.now() - startTime;

      // Should process 10 episodes in under 1 second
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle malformed input efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        processLLMToTrajectory(INVALID_LLM_RESPONSES.malformedJson);
      }

      const elapsed = performance.now() - startTime;

      // Should reject 100 invalid inputs in under 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });
});
