/**
 * Temporal Consistency Validation Tests
 *
 * Tests for validating timestamp ordering, frame rate, and temporal smoothness.
 */

import { describe, it, expect } from 'vitest';
import {
  validateTemporalConsistency,
  validateFrameRate,
} from '../utils/validationHelpers';
import {
  validateEpisodeQuality,
  calculateAverageFrameGap,
  calculateAverageJerk,
} from '../utils/pipelineHelpers';
import { VALID_EPISODES, INVALID_EPISODES } from '../fixtures/episodes';
import type { Episode, EpisodeFrame } from '../fixtures/episodes';

describe('Temporal Consistency Validation', () => {
  // ============================================================================
  // Timestamp Monotonicity
  // ============================================================================

  describe('Timestamp Monotonicity', () => {
    it('should accept monotonically increasing timestamps', () => {
      const result = validateTemporalConsistency(VALID_EPISODES.pickupSuccess);

      expect(result.monotonic).toBe(true);
    });

    it('should reject non-monotonic timestamps', () => {
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 100, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 50, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Out of order
      ];

      const episode: Episode = {
        id: 'non_monotonic_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      expect(result.monotonic).toBe(false);
      expect(result.valid).toBe(false);
    });

    it('should reject duplicate timestamps', () => {
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 100, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 100, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Duplicate
      ];

      const episode: Episode = {
        id: 'duplicate_timestamp_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      expect(result.monotonic).toBe(false);
    });

    it('should handle single frame episode', () => {
      const episode: Episode = {
        id: 'single_frame_test',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        ],
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      // Single frame should be valid (nothing to compare)
      expect(result.monotonic).toBe(true);
    });
  });

  // ============================================================================
  // Timestamp Gaps
  // ============================================================================

  describe('Timestamp Gaps', () => {
    it('should calculate max gap correctly', () => {
      const result = validateTemporalConsistency(VALID_EPISODES.pickupSuccess);

      expect(result.maxGap).toBeGreaterThan(0);
    });

    it('should calculate average gap correctly', () => {
      const result = validateTemporalConsistency(VALID_EPISODES.pickupSuccess);

      expect(result.avgGap).toBeGreaterThan(0);
    });

    it('should detect excessive gaps', () => {
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 33, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 133, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // 100ms gap
      ];

      const episode: Episode = {
        id: 'large_gap_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      expect(result.errors.some(e => e.includes('Large timestamp gap'))).toBe(true);
    });

    it('should accept normal 30fps gaps (~33ms)', () => {
      const frames: EpisodeFrame[] = [];
      for (let i = 0; i < 10; i++) {
        frames.push({
          timestamp: i * 33,
          observation: { state: [0, 0, 0, 0, 0, 0] },
          action: [0, 0, 0, 0, 0, 0],
        });
      }

      const episode: Episode = {
        id: 'normal_gap_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      expect(result.valid).toBe(true);
      expect(result.avgGap).toBeCloseTo(33, 0);
    });
  });

  // ============================================================================
  // Frame Rate Validation
  // ============================================================================

  describe('Frame Rate Validation', () => {
    it('should validate 30fps episodes', () => {
      // Use minimalValid which has ~30fps frame data
      const result = validateFrameRate(VALID_EPISODES.minimalValid, 30);

      // Should be close to 30fps
      expect(result.actualFps).toBeGreaterThan(25);
      expect(result.actualFps).toBeLessThan(35);
    });

    it('should calculate deviation from target fps', () => {
      const result = validateFrameRate(VALID_EPISODES.pickupSuccess, 30);

      expect(result.deviation).toBeDefined();
      expect(result.deviation).toBeGreaterThanOrEqual(0);
    });

    it('should accept within 10% deviation', () => {
      // Create episode at exactly 30fps
      const frames: EpisodeFrame[] = [];
      for (let i = 0; i < 60; i++) {
        frames.push({
          timestamp: i * 33.33,
          observation: { state: [0, 0, 0, 0, 0, 0] },
          action: [0, 0, 0, 0, 0, 0],
        });
      }

      const episode: Episode = {
        id: 'exact_30fps_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateFrameRate(episode, 30);

      expect(result.valid).toBe(true);
      expect(result.deviation).toBeLessThan(0.1);
    });

    it('should reject large deviations', () => {
      // Create episode at 15fps (50% deviation)
      const frames: EpisodeFrame[] = [];
      for (let i = 0; i < 30; i++) {
        frames.push({
          timestamp: i * 66.67, // ~15fps
          observation: { state: [0, 0, 0, 0, 0, 0] },
          action: [0, 0, 0, 0, 0, 0],
        });
      }

      const episode: Episode = {
        id: '15fps_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateFrameRate(episode, 30);

      expect(result.valid).toBe(false);
      expect(result.deviation).toBeGreaterThan(0.1);
    });

    it('should handle insufficient frames', () => {
      const episode: Episode = {
        id: 'short_episode',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        ],
        metadata: { action: 'test', success: true },
      };

      const result = validateFrameRate(episode, 30);

      expect(result.valid).toBe(false);
      expect(result.actualFps).toBe(0);
    });
  });

  // ============================================================================
  // Duration Validation
  // ============================================================================

  describe('Duration Validation', () => {
    it('should calculate duration correctly', () => {
      const episode = VALID_EPISODES.pickupSuccess;
      const frames = episode.frames;
      const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;

      expect(duration).toBeGreaterThan(0);
    });

    it('should reject episodes shorter than 1.5s', () => {
      const result = validateEpisodeQuality(INVALID_EPISODES.tooFewFrames);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duration') || e.includes('frames'))).toBe(true);
    });

    it('should accept episodes >= 1.5s', () => {
      const result = validateEpisodeQuality(VALID_EPISODES.pickupSuccess);

      const durationErrors = result.errors.filter(e => e.includes('Duration'));
      expect(durationErrors.length).toBe(0);
    });

    it('should warn for very long episodes', () => {
      // Create 60 second episode
      const frames: EpisodeFrame[] = [];
      for (let i = 0; i < 1800; i++) {
        frames.push({
          timestamp: i * 33,
          observation: { state: [0, 0, 0, 0, 0, 0] },
          action: [0, 0, 0, 0, 0, 0],
        });
      }

      const episode: Episode = {
        id: 'long_episode_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateEpisodeQuality(episode);

      expect(result.warnings.some(w => w.includes('long'))).toBe(true);
    });
  });

  // ============================================================================
  // Average Frame Gap
  // ============================================================================

  describe('Average Frame Gap', () => {
    it('should calculate average gap for valid episodes', () => {
      // Use minimalValid which has ~30fps frame data
      const avgGap = calculateAverageFrameGap(VALID_EPISODES.minimalValid);

      expect(avgGap).toBeGreaterThan(0);
      // Should be close to 33ms for 30fps
      expect(avgGap).toBeGreaterThan(25);
      expect(avgGap).toBeLessThan(50);
    });

    it('should return 0 for single frame', () => {
      const episode: Episode = {
        id: 'single_frame',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        ],
        metadata: { action: 'test', success: true },
      };

      const avgGap = calculateAverageFrameGap(episode);

      expect(avgGap).toBe(0);
    });

    it('should return 0 for empty episode', () => {
      const episode: Episode = {
        id: 'empty',
        frames: [],
        metadata: { action: 'test', success: true },
      };

      const avgGap = calculateAverageFrameGap(episode);

      expect(avgGap).toBe(0);
    });
  });

  // ============================================================================
  // Jerk Analysis
  // ============================================================================

  describe('Jerk Analysis', () => {
    it('should calculate average jerk for smooth motion', () => {
      const avgJerk = calculateAverageJerk(VALID_EPISODES.pickupSuccess);

      expect(avgJerk).toBeGreaterThanOrEqual(0);
      // Smooth motion should have low jerk
      expect(avgJerk).toBeLessThan(1000);
    });

    it('should detect high jerk for erratic motion', () => {
      // Create episode with sudden changes
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 33, observation: { state: [1, 0, 0, 0, 0, 0] }, action: [1, 0, 0, 0, 0, 0] },
        { timestamp: 66, observation: { state: [-1, 0, 0, 0, 0, 0] }, action: [-1, 0, 0, 0, 0, 0] },
        { timestamp: 99, observation: { state: [1, 0, 0, 0, 0, 0] }, action: [1, 0, 0, 0, 0, 0] },
      ];

      const episode: Episode = {
        id: 'jerky_motion',
        frames,
        metadata: { action: 'test', success: true },
      };

      const avgJerk = calculateAverageJerk(episode);

      // Should have higher jerk than smooth motion
      expect(avgJerk).toBeGreaterThan(0);
    });

    it('should handle short episodes gracefully', () => {
      const episode: Episode = {
        id: 'short',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
          { timestamp: 33, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        ],
        metadata: { action: 'test', success: true },
      };

      const avgJerk = calculateAverageJerk(episode);

      expect(avgJerk).toBe(0);
    });
  });

  // ============================================================================
  // Error Reporting
  // ============================================================================

  describe('Error Reporting', () => {
    it('should provide detailed error messages', () => {
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 50, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Gap OK
        { timestamp: 200, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Large gap
      ];

      const episode: Episode = {
        id: 'error_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      // Should have error about large gap
      const gapErrors = result.errors.filter(e => e.includes('gap'));
      expect(gapErrors.length).toBeGreaterThan(0);
      // Error should mention frame index
      expect(gapErrors[0]).toMatch(/frame \d+/);
    });

    it('should aggregate all temporal errors', () => {
      const frames: EpisodeFrame[] = [
        { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        { timestamp: 200, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Gap 1
        { timestamp: 450, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] }, // Gap 2
      ];

      const episode: Episode = {
        id: 'multiple_errors_test',
        frames,
        metadata: { action: 'test', success: true },
      };

      const result = validateTemporalConsistency(episode);

      // Should have multiple gap errors
      const gapErrors = result.errors.filter(e => e.includes('gap'));
      expect(gapErrors.length).toBe(2);
    });
  });
});
