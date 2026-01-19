/**
 * Batch Statistics Validation Tests
 *
 * Tests for validating statistical properties of training data batches.
 */

import { describe, it, expect } from 'vitest';
import {
  mean,
  std,
  min,
  max,
  percentile,
  detectOutliers,
  detectOutliersIQR,
  extractAllJointPositions,
  extractAllVelocities,
  extractGraspPositions,
  analyzeDistribution,
  calculateWorkspaceCoverage,
  calculateBatchQualityScore,
  validateBatchVariety,
} from '../utils/statisticsHelpers';
import { VALID_EPISODES } from '../fixtures/episodes';
import type { Episode, EpisodeFrame } from '../fixtures/episodes';

// Helper to create test episodes
function createTestEpisodes(count: number): Episode[] {
  const episodes: Episode[] = [];

  for (let i = 0; i < count; i++) {
    const frames: EpisodeFrame[] = [];
    for (let j = 0; j < 50; j++) {
      const t = j * 33;
      const phase = (j / 50) * Math.PI;
      frames.push({
        timestamp: t,
        observation: {
          state: [
            Math.sin(phase + i * 0.5) * 0.5, // base
            Math.cos(phase) * 0.3, // shoulder
            Math.sin(phase) * 0.4 + 0.2, // elbow
            Math.cos(phase) * 0.2, // wrist
            0, // wristRoll
            j < 25 ? 0.9 : 0.1, // gripper
          ],
        },
        action: [0, 0, 0, 0, 0, j < 25 ? 0.9 : 0.1],
        velocity: [0.1, 0.05, 0.08, 0.03, 0, 0],
      });
    }

    episodes.push({
      id: `episode_${i}`,
      frames,
      metadata: {
        action: 'pickup',
        success: true,
        objectType: 'cube',
      },
    });
  }

  return episodes;
}

describe('Batch Statistics Validation', () => {
  // ============================================================================
  // Basic Statistics
  // ============================================================================

  describe('Basic Statistics', () => {
    it('should calculate mean correctly', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
      expect(mean([10])).toBe(10);
      expect(mean([])).toBe(0);
    });

    it('should calculate standard deviation correctly', () => {
      // Population std of [2, 4, 4, 4, 5, 5, 7, 9] is ~2.0
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const s = std(values);
      expect(s).toBeGreaterThan(1.9);
      expect(s).toBeLessThan(2.3);
    });

    it('should return 0 std for single value', () => {
      expect(std([5])).toBe(0);
    });

    it('should calculate min correctly', () => {
      expect(min([5, 2, 8, 1, 9])).toBe(1);
      expect(min([-5, -10, 0])).toBe(-10);
    });

    it('should calculate max correctly', () => {
      expect(max([5, 2, 8, 1, 9])).toBe(9);
      expect(max([-5, -10, 0])).toBe(0);
    });

    it('should calculate percentile correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(values, 50)).toBe(5);
      expect(percentile(values, 25)).toBe(3);
      expect(percentile(values, 75)).toBe(8);
    });
  });

  // ============================================================================
  // Outlier Detection
  // ============================================================================

  describe('Outlier Detection', () => {
    it('should detect z-score outliers', () => {
      // Create array with more values so outlier is clearly distinct
      const values = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 100]; // 100 is outlier
      const outliers = detectOutliers(values);

      expect(outliers).toContain(100);
    });

    it('should use configurable threshold', () => {
      const values = [1, 2, 2, 2, 2, 2, 2, 2, 2, 5];
      const outliers2 = detectOutliers(values, 2);
      const outliers3 = detectOutliers(values, 3);

      // Stricter threshold should find fewer outliers
      expect(outliers2.length).toBeGreaterThanOrEqual(outliers3.length);
    });

    it('should handle small arrays', () => {
      expect(detectOutliers([1, 2])).toEqual([]);
      expect(detectOutliers([1])).toEqual([]);
      expect(detectOutliers([])).toEqual([]);
    });

    it('should detect IQR outliers', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const outliers = detectOutliersIQR(values);

      expect(outliers).toContain(100);
    });

    it('should handle uniform data (no outliers)', () => {
      const values = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      const outliers = detectOutliers(values);

      expect(outliers).toEqual([]);
    });
  });

  // ============================================================================
  // Joint Position Extraction
  // ============================================================================

  describe('Joint Position Extraction', () => {
    it('should extract positions for all joints', () => {
      const episodes = createTestEpisodes(3);
      const positions = extractAllJointPositions(episodes);

      expect(positions.base).toBeDefined();
      expect(positions.shoulder).toBeDefined();
      expect(positions.elbow).toBeDefined();
      expect(positions.wrist).toBeDefined();
      expect(positions.wristRoll).toBeDefined();
      expect(positions.gripper).toBeDefined();
    });

    it('should extract correct number of positions', () => {
      const episodes = createTestEpisodes(3);
      const positions = extractAllJointPositions(episodes);

      // 3 episodes × 50 frames = 150 positions per joint
      expect(positions.base.length).toBe(150);
    });

    it('should handle empty episode list', () => {
      const positions = extractAllJointPositions([]);

      expect(positions.base).toEqual([]);
      expect(positions.gripper).toEqual([]);
    });
  });

  // ============================================================================
  // Velocity Extraction
  // ============================================================================

  describe('Velocity Extraction', () => {
    it('should extract velocities for all joints', () => {
      const episodes = createTestEpisodes(3);
      const velocities = extractAllVelocities(episodes);

      expect(velocities.base).toBeDefined();
      expect(velocities.base.length).toBeGreaterThan(0);
    });

    it('should skip frames without velocity data', () => {
      const episode: Episode = {
        id: 'no_velocity',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
          { timestamp: 33, observation: { state: [0, 0, 0, 0, 0, 0] }, action: [0, 0, 0, 0, 0, 0] },
        ],
        metadata: { action: 'test', success: true },
      };

      const velocities = extractAllVelocities([episode]);

      expect(velocities.base.length).toBe(0);
    });
  });

  // ============================================================================
  // Grasp Position Extraction
  // ============================================================================

  describe('Grasp Position Extraction', () => {
    it('should extract grasp positions from pickup episodes', () => {
      const episodes = createTestEpisodes(5);
      const graspPositions = extractGraspPositions(episodes);

      // Should find grasp in each episode
      expect(graspPositions.length).toBe(5);
    });

    it('should extract x, y, z for each grasp', () => {
      const episodes = createTestEpisodes(3);
      const graspPositions = extractGraspPositions(episodes);

      for (const pos of graspPositions) {
        expect(pos.x).toBeDefined();
        expect(pos.y).toBeDefined();
        expect(pos.z).toBeDefined();
      }
    });

    it('should handle episodes without grasp', () => {
      // Create episode where gripper never closes
      const episode: Episode = {
        id: 'no_grasp',
        frames: [
          { timestamp: 0, observation: { state: [0, 0, 0, 0, 0, 0.9] }, action: [0, 0, 0, 0, 0, 0.9] },
          { timestamp: 33, observation: { state: [0, 0, 0, 0, 0, 0.9] }, action: [0, 0, 0, 0, 0, 0.9] },
        ],
        metadata: { action: 'pickup', success: false },
      };

      const graspPositions = extractGraspPositions([episode]);

      expect(graspPositions.length).toBe(0);
    });
  });

  // ============================================================================
  // Distribution Analysis
  // ============================================================================

  describe('Distribution Analysis', () => {
    it('should calculate distribution metrics', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const dist = analyzeDistribution(values);

      expect(dist.mean).toBeCloseTo(5.5, 1);
      expect(dist.min).toBe(1);
      expect(dist.max).toBe(10);
      expect(dist.std).toBeGreaterThan(0);
    });

    it('should calculate skewness', () => {
      const symmetric = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1];
      const dist = analyzeDistribution(symmetric);

      // Symmetric distribution should have skewness close to 0
      expect(Math.abs(dist.skewness)).toBeLessThan(0.5);
    });

    it('should calculate kurtosis', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const dist = analyzeDistribution(values);

      expect(dist.kurtosis).toBeDefined();
    });

    it('should assess normality', () => {
      // Create approximately normal distribution
      const normal = [];
      for (let i = 0; i < 100; i++) {
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        normal.push(n);
      }

      const dist = analyzeDistribution(normal);

      // Should be approximately normal
      expect(Math.abs(dist.skewness)).toBeLessThan(2);
    });
  });

  // ============================================================================
  // Workspace Coverage
  // ============================================================================

  describe('Workspace Coverage', () => {
    it('should calculate workspace ranges', () => {
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 2, z: 3 },
        { x: -1, y: -2, z: -1 },
      ];

      const coverage = calculateWorkspaceCoverage(positions);

      expect(coverage.xRange).toBe(2);
      expect(coverage.yRange).toBe(4);
      expect(coverage.zRange).toBe(4);
    });

    it('should calculate volume', () => {
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
      ];

      const coverage = calculateWorkspaceCoverage(positions);

      expect(coverage.volume).toBe(1); // 1 × 1 × 1
    });

    it('should calculate density', () => {
      const positions = [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 0.5, y: 0.5, z: 0.5 },
      ];

      const coverage = calculateWorkspaceCoverage(positions);

      expect(coverage.density).toBe(3); // 3 points / 1 volume
    });

    it('should handle empty positions', () => {
      const coverage = calculateWorkspaceCoverage([]);

      expect(coverage.xRange).toBe(0);
      expect(coverage.yRange).toBe(0);
      expect(coverage.zRange).toBe(0);
      expect(coverage.volume).toBe(0);
      expect(coverage.density).toBe(0);
    });
  });

  // ============================================================================
  // Batch Quality Score
  // ============================================================================

  describe('Batch Quality Score', () => {
    it('should calculate pass rate', () => {
      const episodes = createTestEpisodes(10);
      const quality = calculateBatchQualityScore(episodes);

      // All test episodes have 50 frames and success=true
      expect(quality.passRate).toBe(1);
    });

    it('should calculate duration statistics', () => {
      const episodes = createTestEpisodes(5);
      const quality = calculateBatchQualityScore(episodes);

      expect(quality.durationStats.mean).toBeGreaterThan(0);
      expect(quality.durationStats.std).toBeGreaterThanOrEqual(0);
    });

    it('should calculate frame count statistics', () => {
      const episodes = createTestEpisodes(5);
      const quality = calculateBatchQualityScore(episodes);

      expect(quality.frameCountStats.mean).toBe(50);
    });

    it('should calculate average quality score', () => {
      const episodes = createTestEpisodes(5);
      const quality = calculateBatchQualityScore(episodes);

      expect(quality.avgQualityScore).toBeGreaterThan(0);
      expect(quality.avgQualityScore).toBeLessThanOrEqual(100);
    });

    it('should handle mixed success rates', () => {
      const episodes = createTestEpisodes(4);
      // Mark some as failed
      episodes[0].metadata.success = false;
      episodes[1].metadata.success = false;

      const quality = calculateBatchQualityScore(episodes);

      expect(quality.passRate).toBe(0.5);
    });
  });

  // ============================================================================
  // Batch Variety Validation
  // ============================================================================

  describe('Batch Variety Validation', () => {
    it('should validate batch with good variety', () => {
      // Create episodes with more variety in positions
      const episodes = createTestEpisodes(10);
      // Add more X and Z variation to the episodes
      episodes.forEach((ep, idx) => {
        ep.frames.forEach((frame, fIdx) => {
          // Add variety to base (X) and elbow (Z proxy)
          frame.observation.state[0] += (idx - 5) * 0.2; // More X spread
          frame.observation.state[2] += (idx - 5) * 0.1; // More Z spread
        });
      });
      const result = validateBatchVariety(episodes);

      expect(result.valid).toBe(true);
    });

    it('should detect insufficient X-axis coverage', () => {
      // Create episodes with same X position
      const episodes = createTestEpisodes(10);
      for (const ep of episodes) {
        for (const frame of ep.frames) {
          frame.observation.state[0] = 0; // Same X for all
        }
      }

      const result = validateBatchVariety(episodes);

      expect(result.positionVariety).toBe(false);
      expect(result.errors.some(e => e.includes('X-axis'))).toBe(true);
    });

    it('should check action variety', () => {
      const episodes = createTestEpisodes(10);
      const result = validateBatchVariety(episodes);

      // All same action type, but small batch so should pass
      expect(result.actionVariety).toBeDefined();
    });

    it('should handle empty batch', () => {
      const result = validateBatchVariety([]);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should validate complete batch pipeline', () => {
      const episodes = createTestEpisodes(20);
      // Add more variety to positions
      episodes.forEach((ep, idx) => {
        ep.frames.forEach((frame) => {
          frame.observation.state[0] += (idx - 10) * 0.15; // X spread
          frame.observation.state[2] += (idx - 10) * 0.08; // Z spread
        });
      });

      // Extract positions
      const positions = extractAllJointPositions(episodes);
      expect(Object.keys(positions).length).toBe(6);

      // Extract velocities
      const velocities = extractAllVelocities(episodes);
      expect(Object.keys(velocities).length).toBe(6);

      // Analyze distribution
      const baseDist = analyzeDistribution(positions.base);
      expect(baseDist.std).toBeGreaterThan(0);

      // Calculate quality
      const quality = calculateBatchQualityScore(episodes);
      expect(quality.passRate).toBe(1);

      // Validate variety
      const variety = validateBatchVariety(episodes);
      expect(variety.valid).toBe(true);
    });

    it('should detect outliers in real batch', () => {
      const episodes = createTestEpisodes(50);

      // Add outlier episode
      episodes[25].frames[25].observation.state[0] = 10; // Way out of range

      const positions = extractAllJointPositions(episodes);
      const outliers = detectOutliers(positions.base);

      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers).toContain(10);
    });
  });
});
