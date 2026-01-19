/**
 * Episode to Export Pipeline Tests
 *
 * Tests the third stage of the pipeline: exporting episodes to LeRobot format.
 */

import { describe, it, expect } from 'vitest';
import {
  validateLeRobotSchema,
  validateInfoJson,
  validateStatsJson,
} from '../utils/validationHelpers';
import { VALID_EPISODES, INVALID_EPISODES, LEROBOT_SCHEMA } from '../fixtures/episodes';
import { mean, std, min, max } from '../utils/statisticsHelpers';

describe('Episode to Export Pipeline', () => {
  // ============================================================================
  // Schema Validation
  // ============================================================================

  describe('LeRobot Schema Validation', () => {
    it('should validate episode with all required fields', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.pickupSuccess);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.missingFields.length).toBe(0);
      expect(result.invalidTypes.length).toBe(0);
    });

    it('should validate place episode', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.placeSuccess);

      expect(result.valid).toBe(true);
    });

    it('should validate minimal episode', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.minimalValid);

      expect(result.valid).toBe(true);
    });

    it('should reject episode with wrong state dimensions', () => {
      const result = validateLeRobotSchema(INVALID_EPISODES.wrongDimensions);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('6 elements'))).toBe(true);
    });
  });

  // ============================================================================
  // Info.json Validation
  // ============================================================================

  describe('info.json Validation', () => {
    it('should validate complete info.json', () => {
      const validInfo = {
        codebase_version: LEROBOT_SCHEMA.codebase_version,
        robot_type: LEROBOT_SCHEMA.robot_type,
        fps: LEROBOT_SCHEMA.fps,
        features: {
          'observation.state': { dtype: 'float32', shape: [6] },
          action: { dtype: 'float32', shape: [6] },
        },
      };

      const result = validateInfoJson(validInfo);

      expect(result.valid).toBe(true);
    });

    it('should reject info.json missing codebase_version', () => {
      const invalidInfo = {
        robot_type: 'so101',
        fps: 30,
        features: {},
      };

      const result = validateInfoJson(invalidInfo);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('codebase_version');
    });

    it('should reject info.json with wrong fps type', () => {
      const invalidInfo = {
        codebase_version: '2.0',
        robot_type: 'so101',
        fps: '30', // Should be number
        features: {},
      };

      const result = validateInfoJson(invalidInfo);

      expect(result.valid).toBe(false);
      expect(result.invalidTypes.some(t => t.includes('fps'))).toBe(true);
    });

    it('should validate feature structure', () => {
      const infoMissingFeature = {
        codebase_version: '2.0',
        robot_type: 'so101',
        fps: 30,
        features: {
          'observation.state': { dtype: 'float32', shape: [6] },
          // Missing 'action'
        },
      };

      const result = validateInfoJson(infoMissingFeature);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('features.action');
    });
  });

  // ============================================================================
  // Stats.json Validation
  // ============================================================================

  describe('stats.json Validation', () => {
    it('should validate complete stats.json', () => {
      const validStats = {
        'observation.state': {
          min: [-3.14, -1.57, -2.0, -1.57, -3.14, 0],
          max: [3.14, 1.57, 2.0, 1.57, 3.14, 1],
          mean: [0, 0, 0, 0, 0, 0.5],
          std: [1, 0.5, 0.5, 0.5, 1, 0.3],
        },
        action: {
          min: [-3.14, -1.57, -2.0, -1.57, -3.14, 0],
          max: [3.14, 1.57, 2.0, 1.57, 3.14, 1],
          mean: [0, 0, 0, 0, 0, 0.5],
          std: [1, 0.5, 0.5, 0.5, 1, 0.3],
        },
      };

      const result = validateStatsJson(validStats);

      expect(result.valid).toBe(true);
    });

    it('should reject stats missing observation.state', () => {
      const invalidStats = {
        action: {
          min: [0, 0, 0, 0, 0, 0],
          max: [1, 1, 1, 1, 1, 1],
          mean: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          std: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        },
      };

      const result = validateStatsJson(invalidStats);

      expect(result.valid).toBe(false);
      expect(result.missingFields).toContain('observation.state');
    });

    it('should reject stats with wrong array length', () => {
      const invalidStats = {
        'observation.state': {
          min: [0, 0, 0, 0, 0], // Only 5 elements
          max: [1, 1, 1, 1, 1, 1],
          mean: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          std: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        },
        action: {
          min: [0, 0, 0, 0, 0, 0],
          max: [1, 1, 1, 1, 1, 1],
          mean: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          std: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        },
      };

      const result = validateStatsJson(invalidStats);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('6 elements'))).toBe(true);
    });

    it('should reject stats with non-array values', () => {
      const invalidStats = {
        'observation.state': {
          min: 0, // Should be array
          max: [1, 1, 1, 1, 1, 1],
          mean: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          std: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        },
        action: {
          min: [0, 0, 0, 0, 0, 0],
          max: [1, 1, 1, 1, 1, 1],
          mean: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
          std: [0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
        },
      };

      const result = validateStatsJson(invalidStats);

      expect(result.valid).toBe(false);
      expect(result.invalidTypes.some(t => t.includes('array'))).toBe(true);
    });
  });

  // ============================================================================
  // Statistics Calculation
  // ============================================================================

  describe('Statistics Calculation', () => {
    it('should calculate correct mean for joint positions', () => {
      const values = [0, 1, 2, 3, 4];
      expect(mean(values)).toBe(2);
    });

    it('should calculate correct std', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const calculatedStd = std(values);
      expect(calculatedStd).toBeCloseTo(2.138, 2);
    });

    it('should handle single value arrays', () => {
      expect(std([5])).toBe(0);
    });

    it('should handle empty arrays', () => {
      expect(mean([])).toBe(0);
      expect(std([])).toBe(0);
      expect(min([])).toBe(0);
      expect(max([])).toBe(0);
    });

    it('should calculate min/max correctly', () => {
      const values = [5, -3, 10, 2, 0];
      expect(min(values)).toBe(-3);
      expect(max(values)).toBe(10);
    });
  });

  // ============================================================================
  // Export Data Structure
  // ============================================================================

  describe('Export Data Structure', () => {
    it('should have consistent frame structure', () => {
      const episode = VALID_EPISODES.pickupSuccess;

      for (const frame of episode.frames) {
        expect(frame).toHaveProperty('timestamp');
        expect(frame).toHaveProperty('observation');
        expect(frame.observation).toHaveProperty('state');
        expect(frame).toHaveProperty('action');
      }
    });

    it('should have matching state and action dimensions', () => {
      const episode = VALID_EPISODES.pickupSuccess;

      for (const frame of episode.frames) {
        expect(frame.observation.state.length).toBe(frame.action.length);
      }
    });

    it('should have valid metadata', () => {
      const episode = VALID_EPISODES.pickupSuccess;

      expect(episode.metadata).toBeDefined();
      expect(episode.metadata.action).toBe('pickup');
      expect(episode.metadata.success).toBe(true);
    });
  });

  // ============================================================================
  // Episode ID Format
  // ============================================================================

  describe('Episode ID Format', () => {
    it('should have valid episode ID', () => {
      const episode = VALID_EPISODES.pickupSuccess;

      expect(episode.id).toBeDefined();
      expect(typeof episode.id).toBe('string');
      expect(episode.id.length).toBeGreaterThan(0);
    });

    it('should follow naming convention', () => {
      const episode = VALID_EPISODES.pickupSuccess;

      // ID should be a reasonable format
      expect(episode.id).toMatch(/^episode_/);
    });
  });
});
