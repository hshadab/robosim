/**
 * Statistics Test Helpers
 *
 * Utility functions for statistical analysis of training data batches.
 */

import type { Episode, EpisodeFrame } from '../fixtures/episodes';

// ============================================================================
// Basic Statistics
// ============================================================================

/**
 * Calculate mean of an array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate min of an array
 */
export function min(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate max of an array
 */
export function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// ============================================================================
// Outlier Detection
// ============================================================================

/**
 * Detect outliers using z-score method
 * @param values Array of values
 * @param threshold Number of standard deviations (default 3)
 * @returns Array of outlier values
 */
export function detectOutliers(values: number[], threshold: number = 3): number[] {
  if (values.length < 3) return [];

  const m = mean(values);
  const s = std(values);

  if (s === 0) return [];

  return values.filter(v => Math.abs((v - m) / s) > threshold);
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  return values.filter(v => v < lowerBound || v > upperBound);
}

// ============================================================================
// Batch Analysis
// ============================================================================

/**
 * Extract all joint positions from a batch of episodes
 */
export function extractAllJointPositions(episodes: Episode[]): Record<string, number[]> {
  const joints = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'];
  const positions: Record<string, number[]> = {};

  for (const joint of joints) {
    positions[joint] = [];
  }

  for (const episode of episodes) {
    for (const frame of episode.frames) {
      for (let i = 0; i < joints.length; i++) {
        positions[joints[i]].push(frame.observation.state[i]);
      }
    }
  }

  return positions;
}

/**
 * Extract all velocities from a batch of episodes
 */
export function extractAllVelocities(episodes: Episode[]): Record<string, number[]> {
  const joints = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'];
  const velocities: Record<string, number[]> = {};

  for (const joint of joints) {
    velocities[joint] = [];
  }

  for (const episode of episodes) {
    for (const frame of episode.frames) {
      if (frame.velocity) {
        for (let i = 0; i < joints.length; i++) {
          velocities[joints[i]].push(frame.velocity[i]);
        }
      }
    }
  }

  return velocities;
}

/**
 * Extract grasp positions from pickup episodes
 */
export function extractGraspPositions(episodes: Episode[]): Array<{ x: number; y: number; z: number }> {
  const positions: Array<{ x: number; y: number; z: number }> = [];

  for (const episode of episodes) {
    // Find the frame where gripper closes (grasp position)
    for (let i = 1; i < episode.frames.length; i++) {
      const prevGripper = episode.frames[i - 1].observation.state[5];
      const currGripper = episode.frames[i].observation.state[5];

      if (prevGripper > 0.5 && currGripper < 0.5) {
        // This is approximately the grasp position
        // In a real implementation, we'd use FK to get cartesian position
        const frame = episode.frames[i];
        positions.push({
          x: frame.observation.state[0], // base rotation as proxy for x
          y: frame.observation.state[1], // shoulder as proxy for height
          z: frame.observation.state[2], // elbow as proxy for reach
        });
        break;
      }
    }
  }

  return positions;
}

// ============================================================================
// Distribution Analysis
// ============================================================================

/**
 * Check if values follow a reasonable distribution
 */
export function analyzeDistribution(values: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
  isNormal: boolean;
} {
  const m = mean(values);
  const s = std(values);
  const n = values.length;

  // Calculate skewness
  let skewSum = 0;
  let kurtSum = 0;

  for (const v of values) {
    const z = s > 0 ? (v - m) / s : 0;
    skewSum += z ** 3;
    kurtSum += z ** 4;
  }

  const skewness = n > 2 ? (n / ((n - 1) * (n - 2))) * skewSum : 0;
  const kurtosis = n > 3 ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurtSum - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3)) : 0;

  // Simple normality check: skewness and kurtosis close to 0
  const isNormal = Math.abs(skewness) < 1 && Math.abs(kurtosis) < 3;

  return {
    mean: m,
    std: s,
    min: min(values),
    max: max(values),
    skewness,
    kurtosis,
    isNormal,
  };
}

/**
 * Calculate coverage of workspace
 */
export function calculateWorkspaceCoverage(positions: Array<{ x: number; y: number; z: number }>): {
  xRange: number;
  yRange: number;
  zRange: number;
  volume: number;
  density: number;
} {
  if (positions.length === 0) {
    return { xRange: 0, yRange: 0, zRange: 0, volume: 0, density: 0 };
  }

  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const zs = positions.map(p => p.z);

  const xRange = max(xs) - min(xs);
  const yRange = max(ys) - min(ys);
  const zRange = max(zs) - min(zs);
  const volume = xRange * yRange * zRange;
  const density = positions.length / (volume || 1);

  return { xRange, yRange, zRange, volume, density };
}

// ============================================================================
// Quality Metrics
// ============================================================================

/**
 * Calculate batch quality score
 */
export function calculateBatchQualityScore(episodes: Episode[]): {
  passRate: number;
  avgQualityScore: number;
  durationStats: { mean: number; std: number };
  frameCountStats: { mean: number; std: number };
} {
  const durations: number[] = [];
  const frameCounts: number[] = [];
  let passCount = 0;

  for (const episode of episodes) {
    const frameCount = episode.frames.length;
    frameCounts.push(frameCount);

    if (frameCount >= 2) {
      const duration = episode.frames[frameCount - 1].timestamp - episode.frames[0].timestamp;
      durations.push(duration);
    }

    // Simple pass criteria: enough frames and successful
    if (frameCount >= 45 && episode.metadata.success) {
      passCount++;
    }
  }

  const passRate = episodes.length > 0 ? passCount / episodes.length : 0;

  // Quality score based on consistency
  const durationStd = std(durations);
  const frameCountStd = std(frameCounts);
  const consistencyScore = 100 - Math.min(50, durationStd / 10) - Math.min(50, frameCountStd);

  return {
    passRate,
    avgQualityScore: Math.max(0, consistencyScore),
    durationStats: { mean: mean(durations), std: durationStd },
    frameCountStats: { mean: mean(frameCounts), std: frameCountStd },
  };
}

/**
 * Validate batch has sufficient variety
 */
export function validateBatchVariety(episodes: Episode[]): {
  valid: boolean;
  positionVariety: boolean;
  actionVariety: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check position variety
  const positions = extractGraspPositions(episodes);
  if (positions.length > 0) {
    const coverage = calculateWorkspaceCoverage(positions);
    if (coverage.xRange < 0.1) {
      errors.push('Insufficient X-axis coverage');
    }
    if (coverage.zRange < 0.08) {
      errors.push('Insufficient Z-axis coverage');
    }
  }

  // Check action variety (not all same action)
  const actions = new Set(episodes.map(e => e.metadata.action));
  const actionVariety = actions.size > 1 || episodes.length < 10;

  return {
    valid: errors.length === 0,
    positionVariety: errors.length === 0,
    actionVariety,
    errors,
  };
}
