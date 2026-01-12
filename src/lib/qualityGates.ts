/**
 * Quality Gates for Training Data Export
 *
 * Validates episode quality before export to ensure training data
 * meets minimum standards for effective robot learning.
 */

import type { Episode } from './datasetExporter';
import { loggers } from './logger';

const log = loggers.simulation;

// =============================================================================
// Quality Thresholds
// =============================================================================

export interface QualityThresholds {
  /** Minimum frames per episode */
  minFrames: number;
  /** Maximum allowed jerk (smoothness metric) */
  maxJerk: number;
  /** Minimum action variance (detect stuck/no-op episodes) */
  minActionVariance: number;
  /** Maximum consecutive identical frames */
  maxStaticFrames: number;
  /** Minimum task completion confidence (0-1) */
  minTaskConfidence: number;
  /** Maximum allowed frame timestamp gaps (ms) */
  maxTimestampGap: number;
  /** Minimum episode duration (ms) */
  minDuration: number;
}

/**
 * Default quality thresholds - balanced between strictness and flexibility
 * Updated to be more strict to ensure higher quality training data
 */
export const DEFAULT_THRESHOLDS: QualityThresholds = {
  minFrames: 45,           // ~1.5 seconds at 30fps (was 30)
  maxJerk: 35.0,           // rad/s³ - moderate smoothness required (was 50)
  minActionVariance: 0.003, // require meaningful movement (was 0.001)
  maxStaticFrames: 45,     // ~1.5 seconds max idle (was 60)
  minTaskConfidence: 0.6,   // 60% confidence required (was 0.5)
  maxTimestampGap: 75,     // ms - tighter timing (was 100)
  minDuration: 1500,       // 1.5 second minimum (was 1000)
};

/**
 * Strict quality thresholds - for production training data
 * Use these when quality is more important than quantity
 */
export const STRICT_THRESHOLDS: QualityThresholds = {
  minFrames: 60,           // 2 seconds at 30fps
  maxJerk: 25.0,           // rad/s³ - smooth motion only
  minActionVariance: 0.01,  // significant movement required
  maxStaticFrames: 30,     // 1 second max idle
  minTaskConfidence: 0.75,  // 75% confidence required
  maxTimestampGap: 50,     // ms - strict timing
  minDuration: 2000,       // 2 second minimum
};

/**
 * Lenient thresholds - for debugging or initial data collection
 * Only use when you need to capture more data and will filter later
 */
export const LENIENT_THRESHOLDS: QualityThresholds = {
  minFrames: 20,           // ~0.7 seconds at 30fps
  maxJerk: 75.0,           // allow jerky motion
  minActionVariance: 0.0005, // nearly static episodes ok
  maxStaticFrames: 90,     // 3 seconds max idle
  minTaskConfidence: 0.3,   // 30% confidence
  maxTimestampGap: 150,    // ms - loose timing
  minDuration: 500,        // 0.5 second minimum
};

// =============================================================================
// Quality Metrics
// =============================================================================

export interface QualityMetrics {
  /** Number of frames in episode */
  frameCount: number;
  /** Episode duration in ms */
  duration: number;
  /** Average jerk (third derivative of position) */
  averageJerk: number;
  /** Peak jerk value */
  peakJerk: number;
  /** Variance of actions (low = no meaningful movement) */
  actionVariance: number;
  /** Longest sequence of nearly identical frames */
  maxStaticSequence: number;
  /** Task completion confidence if available */
  taskConfidence: number | null;
  /** Average gap between timestamps */
  avgTimestampGap: number;
  /** Maximum timestamp gap */
  maxTimestampGap: number;
  /** Trajectory smoothness score (0-1, higher = smoother) */
  smoothnessScore: number;
  /** Completeness score (0-1, based on gripper activity) */
  completenessScore: number;
}

export interface QualityGateResult {
  passed: boolean;
  metrics: QualityMetrics;
  failures: QualityFailure[];
  warnings: QualityWarning[];
  overallScore: number; // 0-100
}

export interface QualityFailure {
  gate: keyof QualityThresholds;
  message: string;
  actual: number;
  threshold: number;
}

export interface QualityWarning {
  type: string;
  message: string;
}

// =============================================================================
// Quality Analysis Functions
// =============================================================================

/**
 * Calculate quality metrics for an episode
 */
export function calculateQualityMetrics(episode: Episode): QualityMetrics {
  const frames = episode.frames;
  const frameCount = frames.length;

  if (frameCount < 2) {
    return {
      frameCount,
      duration: 0,
      averageJerk: 0,
      peakJerk: 0,
      actionVariance: 0,
      maxStaticSequence: frameCount,
      taskConfidence: null,
      avgTimestampGap: 0,
      maxTimestampGap: 0,
      smoothnessScore: 0,
      completenessScore: 0,
    };
  }

  // Duration
  const duration = frames[frameCount - 1].timestamp - frames[0].timestamp;

  // Calculate jerk (third derivative)
  const { averageJerk, peakJerk } = calculateJerk(frames);

  // Action variance
  const actionVariance = calculateActionVariance(frames);

  // Static frame detection
  const maxStaticSequence = findMaxStaticSequence(frames);

  // Timestamp gaps
  const { avg: avgTimestampGap, max: maxTimestampGap } = calculateTimestampGaps(frames);

  // Smoothness score (inverse of jerk, normalized)
  const smoothnessScore = Math.max(0, 1 - averageJerk / 100);

  // Completeness score (based on gripper activity and movement)
  const completenessScore = calculateCompletenessScore(frames);

  // Task confidence from metadata (may be set by task verification system)
  const taskConfidence = episode.metadata.taskConfidence ?? null;

  return {
    frameCount,
    duration,
    averageJerk,
    peakJerk,
    actionVariance,
    maxStaticSequence,
    taskConfidence,
    avgTimestampGap,
    maxTimestampGap,
    smoothnessScore,
    completenessScore,
  };
}

/**
 * Run quality gates on an episode
 */
export function checkQualityGates(
  episode: Episode,
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS
): QualityGateResult {
  const metrics = calculateQualityMetrics(episode);
  const failures: QualityFailure[] = [];
  const warnings: QualityWarning[] = [];

  // Check each gate
  if (metrics.frameCount < thresholds.minFrames) {
    failures.push({
      gate: 'minFrames',
      message: `Episode too short: ${metrics.frameCount} frames (minimum: ${thresholds.minFrames})`,
      actual: metrics.frameCount,
      threshold: thresholds.minFrames,
    });
  }

  if (metrics.duration < thresholds.minDuration) {
    failures.push({
      gate: 'minDuration',
      message: `Episode too short: ${metrics.duration}ms (minimum: ${thresholds.minDuration}ms)`,
      actual: metrics.duration,
      threshold: thresholds.minDuration,
    });
  }

  if (metrics.averageJerk > thresholds.maxJerk) {
    failures.push({
      gate: 'maxJerk',
      message: `Motion too jerky: avg jerk ${metrics.averageJerk.toFixed(2)} (max: ${thresholds.maxJerk})`,
      actual: metrics.averageJerk,
      threshold: thresholds.maxJerk,
    });
  }

  if (metrics.actionVariance < thresholds.minActionVariance) {
    failures.push({
      gate: 'minActionVariance',
      message: `Insufficient action variance: ${metrics.actionVariance.toFixed(4)} (min: ${thresholds.minActionVariance})`,
      actual: metrics.actionVariance,
      threshold: thresholds.minActionVariance,
    });
  }

  if (metrics.maxStaticSequence > thresholds.maxStaticFrames) {
    failures.push({
      gate: 'maxStaticFrames',
      message: `Too many static frames: ${metrics.maxStaticSequence} consecutive (max: ${thresholds.maxStaticFrames})`,
      actual: metrics.maxStaticSequence,
      threshold: thresholds.maxStaticFrames,
    });
  }

  if (metrics.maxTimestampGap > thresholds.maxTimestampGap) {
    failures.push({
      gate: 'maxTimestampGap',
      message: `Timestamp gap too large: ${metrics.maxTimestampGap}ms (max: ${thresholds.maxTimestampGap}ms)`,
      actual: metrics.maxTimestampGap,
      threshold: thresholds.maxTimestampGap,
    });
  }

  if (metrics.taskConfidence !== null && metrics.taskConfidence < thresholds.minTaskConfidence) {
    failures.push({
      gate: 'minTaskConfidence',
      message: `Task confidence too low: ${(metrics.taskConfidence * 100).toFixed(0)}% (min: ${thresholds.minTaskConfidence * 100}%)`,
      actual: metrics.taskConfidence,
      threshold: thresholds.minTaskConfidence,
    });
  }

  // Add warnings for borderline cases
  if (metrics.smoothnessScore < 0.5) {
    warnings.push({
      type: 'smoothness',
      message: `Low smoothness score: ${(metrics.smoothnessScore * 100).toFixed(0)}%`,
    });
  }

  if (metrics.completenessScore < 0.5) {
    warnings.push({
      type: 'completeness',
      message: `Low completeness score: ${(metrics.completenessScore * 100).toFixed(0)}%`,
    });
  }

  // Calculate overall score (0-100)
  const overallScore = calculateOverallScore(metrics, thresholds);

  const passed = failures.length === 0;

  log.debug('Quality gate check', {
    passed,
    failures: failures.length,
    warnings: warnings.length,
    score: overallScore,
  });

  return {
    passed,
    metrics,
    failures,
    warnings,
    overallScore,
  };
}

/**
 * Check quality gates for multiple episodes and return summary
 */
export function checkBatchQuality(
  episodes: Episode[],
  thresholds: QualityThresholds = DEFAULT_THRESHOLDS
): {
  results: QualityGateResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
    passRate: number;
  };
  passedEpisodes: Episode[];
  failedEpisodes: Episode[];
} {
  const results = episodes.map(ep => checkQualityGates(ep, thresholds));

  const passed = results.filter(r => r.passed).length;
  const totalScore = results.reduce((sum, r) => sum + r.overallScore, 0);

  const passedEpisodes = episodes.filter((_, i) => results[i].passed);
  const failedEpisodes = episodes.filter((_, i) => !results[i].passed);

  return {
    results,
    summary: {
      total: episodes.length,
      passed,
      failed: episodes.length - passed,
      averageScore: episodes.length > 0 ? totalScore / episodes.length : 0,
      passRate: episodes.length > 0 ? passed / episodes.length : 0,
    },
    passedEpisodes,
    failedEpisodes,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

interface Frame {
  timestamp: number;
  observation: { jointPositions: number[] };
  action: { jointTargets: number[] };
  done?: boolean;
}

function calculateJerk(frames: Frame[]): { averageJerk: number; peakJerk: number } {
  if (frames.length < 4) {
    return { averageJerk: 0, peakJerk: 0 };
  }

  const jerks: number[] = [];

  for (let i = 3; i < frames.length; i++) {
    const dt1 = (frames[i - 2].timestamp - frames[i - 3].timestamp) / 1000;
    const dt2 = (frames[i - 1].timestamp - frames[i - 2].timestamp) / 1000;
    const dt3 = (frames[i].timestamp - frames[i - 1].timestamp) / 1000;

    if (dt1 <= 0 || dt2 <= 0 || dt3 <= 0) continue;

    // Calculate velocity at each point
    const v1 = frames[i - 2].observation.jointPositions.map(
      (p, j) => (p - frames[i - 3].observation.jointPositions[j]) / dt1
    );
    const v2 = frames[i - 1].observation.jointPositions.map(
      (p, j) => (p - frames[i - 2].observation.jointPositions[j]) / dt2
    );
    const v3 = frames[i].observation.jointPositions.map(
      (p, j) => (p - frames[i - 1].observation.jointPositions[j]) / dt3
    );

    // Calculate acceleration
    const a1 = v2.map((v, j) => (v - v1[j]) / ((dt1 + dt2) / 2));
    const a2 = v3.map((v, j) => (v - v2[j]) / ((dt2 + dt3) / 2));

    // Calculate jerk (derivative of acceleration)
    const jerk = a2.map((a, j) => Math.abs(a - a1[j]) / ((dt2 + dt3) / 2));
    const maxJerk = Math.max(...jerk);
    jerks.push(maxJerk);
  }

  if (jerks.length === 0) {
    return { averageJerk: 0, peakJerk: 0 };
  }

  const averageJerk = jerks.reduce((a, b) => a + b, 0) / jerks.length;
  const peakJerk = Math.max(...jerks);

  return { averageJerk, peakJerk };
}

function calculateActionVariance(frames: Frame[]): number {
  if (frames.length < 2) return 0;

  const allActions: number[] = [];
  for (const frame of frames) {
    allActions.push(...frame.action.jointTargets);
  }

  if (allActions.length === 0) return 0;

  const mean = allActions.reduce((a, b) => a + b, 0) / allActions.length;
  const variance = allActions.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allActions.length;

  return variance;
}

function findMaxStaticSequence(frames: Frame[]): number {
  if (frames.length < 2) return frames.length;

  const POSITION_THRESHOLD = 0.001; // rad
  let maxSequence = 1;
  let currentSequence = 1;

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].observation.jointPositions;
    const curr = frames[i].observation.jointPositions;

    const maxDiff = Math.max(...prev.map((p, j) => Math.abs(p - curr[j])));

    if (maxDiff < POSITION_THRESHOLD) {
      currentSequence++;
      maxSequence = Math.max(maxSequence, currentSequence);
    } else {
      currentSequence = 1;
    }
  }

  return maxSequence;
}

function calculateTimestampGaps(frames: Frame[]): { avg: number; max: number } {
  if (frames.length < 2) return { avg: 0, max: 0 };

  const gaps: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    gaps.push(frames[i].timestamp - frames[i - 1].timestamp);
  }

  return {
    avg: gaps.reduce((a, b) => a + b, 0) / gaps.length,
    max: Math.max(...gaps),
  };
}

function calculateCompletenessScore(frames: Frame[]): number {
  if (frames.length < 2) return 0;

  let score = 0;

  // Check for gripper activity (last joint typically)
  const gripperIndex = frames[0].action.jointTargets.length - 1;
  const gripperValues = frames.map(f => f.action.jointTargets[gripperIndex] ?? 0);
  const gripperVariance = calculateVariance(gripperValues);
  if (gripperVariance > 0.01) score += 0.3; // Gripper was used

  // Check for arm movement
  const armMovement = frames.slice(0, -1).map(f => f.action.jointTargets.slice(0, -1));
  const totalMovement = armMovement.reduce((sum, actions) => {
    return sum + actions.reduce((s, a) => s + Math.abs(a), 0);
  }, 0);
  if (totalMovement > armMovement.length * 0.1) score += 0.3; // Meaningful arm movement

  // Check for successful ending (done flag)
  if (frames[frames.length - 1].done) score += 0.4;

  return Math.min(1, score);
}

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

function calculateOverallScore(metrics: QualityMetrics, thresholds: QualityThresholds): number {
  let score = 0;

  // Frame count (up to 20 points)
  score += Math.min(20, (metrics.frameCount / thresholds.minFrames) * 10);

  // Smoothness (up to 25 points)
  score += metrics.smoothnessScore * 25;

  // Action variance (up to 15 points)
  score += Math.min(15, (metrics.actionVariance / thresholds.minActionVariance) * 5);

  // No static sequences (up to 15 points)
  const staticPenalty = Math.max(0, metrics.maxStaticSequence - thresholds.maxStaticFrames / 2);
  score += Math.max(0, 15 - staticPenalty * 0.5);

  // Task confidence (up to 15 points)
  if (metrics.taskConfidence !== null) {
    score += metrics.taskConfidence * 15;
  } else {
    score += 7.5; // Neutral if no task confidence
  }

  // Completeness (up to 10 points)
  score += metrics.completenessScore * 10;

  return Math.min(100, Math.max(0, score));
}
