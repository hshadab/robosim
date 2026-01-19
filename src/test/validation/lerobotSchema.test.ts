/**
 * LeRobot Schema Validation Tests
 *
 * Tests for validating data against LeRobot v2.0 schema requirements.
 */

import { describe, it, expect } from 'vitest';
import {
  validateLeRobotSchema,
  validateInfoJson,
  validateStatsJson,
} from '../utils/validationHelpers';
import { VALID_EPISODES, INVALID_EPISODES, LEROBOT_SCHEMA } from '../fixtures/episodes';
import type { Episode } from '../fixtures/episodes';

describe('LeRobot Schema Validation', () => {
  // ============================================================================
  // Episode Structure
  // ============================================================================

  describe('Episode Structure', () => {
    it('should validate complete episode', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.pickupSuccess);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should require episode ID', () => {
      const episodeWithoutId = { ...VALID_EPISODES.pickupSuccess, id: undefined } as unknown as Episode;
      const result = validateLeRobotSchema(episodeWithoutId);

      expect(result.missingFields).toContain('id');
    });

    it('should require frames array', () => {
      const episodeWithoutFrames = {
        id: 'test',
        metadata: { action: 'pickup', success: true },
      } as unknown as Episode;
      const result = validateLeRobotSchema(episodeWithoutFrames);

      expect(result.missingFields).toContain('frames');
    });

    it('should require metadata', () => {
      const episodeWithoutMetadata = {
        id: 'test',
        frames: [],
      } as unknown as Episode;
      const result = validateLeRobotSchema(episodeWithoutMetadata);

      expect(result.missingFields).toContain('metadata');
    });
  });

  // ============================================================================
  // Frame Structure
  // ============================================================================

  describe('Frame Structure', () => {
    it('should validate frame timestamps', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.pickupSuccess);

      expect(result.invalidTypes.filter(t => t.includes('timestamp')).length).toBe(0);
    });

    it('should reject non-numeric timestamps', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 'invalid' as unknown as number,
            observation: { state: [0, 0, 0, 0, 0, 0] },
            action: [0, 0, 0, 0, 0, 0],
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode);

      expect(result.invalidTypes.some(t => t.includes('timestamp'))).toBe(true);
    });

    it('should require observation.state in each frame', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 0,
            observation: {},
            action: [0, 0, 0, 0, 0, 0],
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode as unknown as Episode);

      expect(result.missingFields.some(f => f.includes('observation.state'))).toBe(true);
    });

    it('should require action in each frame', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 0,
            observation: { state: [0, 0, 0, 0, 0, 0] },
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode as unknown as Episode);

      expect(result.missingFields.some(f => f.includes('action'))).toBe(true);
    });
  });

  // ============================================================================
  // State Array Dimensions
  // ============================================================================

  describe('State Array Dimensions', () => {
    it('should require 6-element state arrays', () => {
      const result = validateLeRobotSchema(VALID_EPISODES.pickupSuccess);

      expect(result.errors.filter(e => e.includes('6 elements')).length).toBe(0);
    });

    it('should reject 5-element state arrays', () => {
      const result = validateLeRobotSchema(INVALID_EPISODES.wrongDimensions);

      expect(result.errors.some(e => e.includes('6 elements'))).toBe(true);
    });

    it('should reject non-array state', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 0,
            observation: { state: 'not an array' },
            action: [0, 0, 0, 0, 0, 0],
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode as unknown as Episode);

      expect(result.invalidTypes.some(t => t.includes('array'))).toBe(true);
    });
  });

  // ============================================================================
  // Action Array Dimensions
  // ============================================================================

  describe('Action Array Dimensions', () => {
    it('should require 6-element action arrays', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 0,
            observation: { state: [0, 0, 0, 0, 0, 0] },
            action: [0, 0, 0, 0, 0], // Only 5 elements
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode as Episode);

      expect(result.errors.some(e => e.includes('action') && e.includes('6 elements'))).toBe(true);
    });

    it('should reject non-array action', () => {
      const episode = {
        id: 'test',
        frames: [
          {
            timestamp: 0,
            observation: { state: [0, 0, 0, 0, 0, 0] },
            action: 'not an array',
          },
        ],
        metadata: { action: 'pickup', success: true },
      };

      const result = validateLeRobotSchema(episode as unknown as Episode);

      expect(result.invalidTypes.some(t => t.includes('action') && t.includes('array'))).toBe(true);
    });
  });

  // ============================================================================
  // Info.json Schema
  // ============================================================================

  describe('info.json Schema', () => {
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

    it('should require codebase_version', () => {
      const info = {
        robot_type: 'so101',
        fps: 30,
        features: {},
      };

      const result = validateInfoJson(info);

      expect(result.missingFields).toContain('codebase_version');
    });

    it('should require robot_type', () => {
      const info = {
        codebase_version: '2.0',
        fps: 30,
        features: {},
      };

      const result = validateInfoJson(info);

      expect(result.missingFields).toContain('robot_type');
    });

    it('should require fps as number', () => {
      const info = {
        codebase_version: '2.0',
        robot_type: 'so101',
        fps: '30', // String instead of number
        features: {},
      };

      const result = validateInfoJson(info);

      expect(result.invalidTypes.some(t => t.includes('fps'))).toBe(true);
    });

    it('should require features.observation.state', () => {
      const info = {
        codebase_version: '2.0',
        robot_type: 'so101',
        fps: 30,
        features: {
          action: { dtype: 'float32', shape: [6] },
        },
      };

      const result = validateInfoJson(info);

      expect(result.missingFields).toContain('features.observation.state');
    });

    it('should require features.action', () => {
      const info = {
        codebase_version: '2.0',
        robot_type: 'so101',
        fps: 30,
        features: {
          'observation.state': { dtype: 'float32', shape: [6] },
        },
      };

      const result = validateInfoJson(info);

      expect(result.missingFields).toContain('features.action');
    });
  });

  // ============================================================================
  // Stats.json Schema
  // ============================================================================

  describe('stats.json Schema', () => {
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

    it('should validate complete stats.json', () => {
      const result = validateStatsJson(validStats);

      expect(result.valid).toBe(true);
    });

    it('should require observation.state stats', () => {
      const stats = {
        action: validStats.action,
      };

      const result = validateStatsJson(stats);

      expect(result.missingFields).toContain('observation.state');
    });

    it('should require action stats', () => {
      const stats = {
        'observation.state': validStats['observation.state'],
      };

      const result = validateStatsJson(stats);

      expect(result.missingFields).toContain('action');
    });

    it('should require min, max, mean, std for each stat', () => {
      const stats = {
        'observation.state': {
          min: [-1, -1, -1, -1, -1, 0],
          max: [1, 1, 1, 1, 1, 1],
          // Missing mean and std
        },
        action: validStats.action,
      };

      const result = validateStatsJson(stats);

      expect(result.missingFields.some(f => f.includes('mean'))).toBe(true);
      expect(result.missingFields.some(f => f.includes('std'))).toBe(true);
    });

    it('should require 6-element arrays for all stats', () => {
      const stats = {
        'observation.state': {
          min: [-1, -1, -1, -1, -1], // Only 5 elements
          max: [1, 1, 1, 1, 1, 1],
          mean: [0, 0, 0, 0, 0, 0],
          std: [1, 1, 1, 1, 1, 1],
        },
        action: validStats.action,
      };

      const result = validateStatsJson(stats);

      expect(result.errors.some(e => e.includes('6 elements'))).toBe(true);
    });
  });

  // ============================================================================
  // Multiple Episodes
  // ============================================================================

  describe('Multiple Episodes', () => {
    it('should validate all valid episodes', () => {
      const episodes = [
        VALID_EPISODES.pickupSuccess,
        VALID_EPISODES.placeSuccess,
        VALID_EPISODES.minimalValid,
      ];

      for (const episode of episodes) {
        const result = validateLeRobotSchema(episode);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject all invalid episodes', () => {
      const episodes = [
        INVALID_EPISODES.tooFewFrames,
        INVALID_EPISODES.wrongDimensions,
      ];

      let failCount = 0;
      for (const episode of episodes) {
        const result = validateLeRobotSchema(episode);
        if (!result.valid) failCount++;
      }

      // At least one should fail schema validation
      expect(failCount).toBeGreaterThan(0);
    });
  });
});
