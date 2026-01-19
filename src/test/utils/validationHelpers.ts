/**
 * Validation Test Helpers
 *
 * Utility functions for validating data against SO-101 hardware specs
 * and LeRobot schema requirements.
 */

import type { Episode, EpisodeFrame } from '../fixtures/episodes';
import { SO101_LIMITS_RAD, SO101_MAX_VEL_RAD, LEROBOT_SCHEMA } from '../fixtures/episodes';

// ============================================================================
// Types
// ============================================================================

export interface HardwareValidationResult {
  valid: boolean;
  errors: HardwareError[];
  warnings: string[];
}

export interface HardwareError {
  type: 'position' | 'velocity' | 'gripper_timing' | 'dimension';
  joint?: string;
  frame?: number;
  value?: number;
  limit?: number;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  missingFields: string[];
  invalidTypes: string[];
}

// Joint index mapping
const JOINT_NAMES = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'] as const;

// ============================================================================
// Hardware Validation
// ============================================================================

/**
 * Validate an episode against SO-101 hardware limits
 */
export function validateForSO101(episode: Episode): HardwareValidationResult {
  const errors: HardwareError[] = [];
  const warnings: string[] = [];

  for (let frameIdx = 0; frameIdx < episode.frames.length; frameIdx++) {
    const frame = episode.frames[frameIdx];

    // Validate state dimensions
    if (frame.observation.state.length !== 6) {
      errors.push({
        type: 'dimension',
        frame: frameIdx,
        message: `Expected 6 joint values, got ${frame.observation.state.length}`,
      });
      continue;
    }

    // Validate position limits
    for (let jointIdx = 0; jointIdx < 6; jointIdx++) {
      const jointName = JOINT_NAMES[jointIdx];
      const value = frame.observation.state[jointIdx];
      const limits = SO101_LIMITS_RAD[jointName];

      if (value < limits.min || value > limits.max) {
        errors.push({
          type: 'position',
          joint: jointName,
          frame: frameIdx,
          value,
          limit: value < limits.min ? limits.min : limits.max,
          message: `${jointName} position ${value.toFixed(3)} rad out of bounds [${limits.min.toFixed(3)}, ${limits.max.toFixed(3)}]`,
        });
      }
    }

    // Validate velocity limits (if velocity data available)
    if (frame.velocity && frameIdx > 0) {
      for (let jointIdx = 0; jointIdx < 6; jointIdx++) {
        const jointName = JOINT_NAMES[jointIdx];
        const velocity = Math.abs(frame.velocity[jointIdx]);
        const maxVel = SO101_MAX_VEL_RAD[jointName];

        // Allow 10% tolerance for velocity
        if (velocity > maxVel * 1.1) {
          errors.push({
            type: 'velocity',
            joint: jointName,
            frame: frameIdx,
            value: velocity,
            limit: maxVel,
            message: `${jointName} velocity ${velocity.toFixed(3)} rad/s exceeds limit ${maxVel.toFixed(3)} rad/s`,
          });
        }
      }
    }
  }

  // Validate gripper closure timing for pickup episodes
  if (episode.metadata.action === 'pickup') {
    const gripperValidation = validateGripperClosureTiming(episode);
    if (!gripperValidation.valid) {
      errors.push({
        type: 'gripper_timing',
        message: gripperValidation.message,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate gripper closure takes at least 800ms
 */
function validateGripperClosureTiming(episode: Episode): { valid: boolean; message: string } {
  const frames = episode.frames;
  const GRIPPER_IDX = 5;

  let closeStartFrame = -1;
  let closeEndFrame = -1;

  for (let i = 1; i < frames.length; i++) {
    const prevGripper = frames[i - 1].observation.state[GRIPPER_IDX];
    const currGripper = frames[i].observation.state[GRIPPER_IDX];

    // Detect start of close (going from open to closed)
    if (prevGripper > 0.5 && currGripper <= 0.5 && closeStartFrame === -1) {
      closeStartFrame = i - 1;
    }

    // Detect end of close
    if (closeStartFrame >= 0 && currGripper < 0.1) {
      closeEndFrame = i;
      break;
    }
  }

  if (closeStartFrame >= 0 && closeEndFrame >= 0) {
    const duration = frames[closeEndFrame].timestamp - frames[closeStartFrame].timestamp;
    if (duration < 800) {
      return {
        valid: false,
        message: `Gripper closure took ${duration}ms, minimum 800ms required for physics detection`,
      };
    }
  }

  return { valid: true, message: '' };
}

/**
 * Check if all positions are within workspace bounds
 */
export function validateWorkspaceBounds(episode: Episode): boolean {
  // Simplified check - real implementation would use FK
  for (const frame of episode.frames) {
    const shoulder = frame.observation.state[1];
    const elbow = frame.observation.state[2];

    // Very extended arm (potential singularity)
    if (Math.abs(shoulder) + Math.abs(elbow) > 3.0) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Validate episode data against LeRobot schema
 */
export function validateLeRobotSchema(episode: Episode): SchemaValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];
  const invalidTypes: string[] = [];

  // Check required fields
  if (!episode.id) missingFields.push('id');
  if (!episode.frames) missingFields.push('frames');
  if (!episode.metadata) missingFields.push('metadata');

  if (episode.frames) {
    for (let i = 0; i < episode.frames.length; i++) {
      const frame = episode.frames[i];

      // Check frame structure
      if (typeof frame.timestamp !== 'number') {
        invalidTypes.push(`frames[${i}].timestamp should be number`);
      }

      if (!frame.observation || !frame.observation.state) {
        missingFields.push(`frames[${i}].observation.state`);
      } else if (!Array.isArray(frame.observation.state)) {
        invalidTypes.push(`frames[${i}].observation.state should be array`);
      } else if (frame.observation.state.length !== 6) {
        errors.push(`frames[${i}].observation.state should have 6 elements, got ${frame.observation.state.length}`);
      }

      if (!frame.action) {
        missingFields.push(`frames[${i}].action`);
      } else if (!Array.isArray(frame.action)) {
        invalidTypes.push(`frames[${i}].action should be array`);
      } else if (frame.action.length !== 6) {
        errors.push(`frames[${i}].action should have 6 elements, got ${frame.action.length}`);
      }
    }
  }

  return {
    valid: errors.length === 0 && missingFields.length === 0 && invalidTypes.length === 0,
    errors,
    missingFields,
    invalidTypes,
  };
}

/**
 * Validate info.json structure
 */
export function validateInfoJson(info: Record<string, unknown>): SchemaValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];
  const invalidTypes: string[] = [];

  // Required fields
  const requiredFields = ['codebase_version', 'robot_type', 'fps', 'features'];
  for (const field of requiredFields) {
    if (!(field in info)) {
      missingFields.push(field);
    }
  }

  // Type checks
  if (info.fps && typeof info.fps !== 'number') {
    invalidTypes.push('fps should be number');
  }

  if (info.robot_type && typeof info.robot_type !== 'string') {
    invalidTypes.push('robot_type should be string');
  }

  // Feature structure
  if (info.features && typeof info.features === 'object') {
    const features = info.features as Record<string, unknown>;
    const requiredFeatures = ['observation.state', 'action'];

    for (const feature of requiredFeatures) {
      if (!(feature in features)) {
        missingFields.push(`features.${feature}`);
      }
    }
  }

  return {
    valid: errors.length === 0 && missingFields.length === 0 && invalidTypes.length === 0,
    errors,
    missingFields,
    invalidTypes,
  };
}

/**
 * Validate stats.json structure
 */
export function validateStatsJson(stats: Record<string, unknown>): SchemaValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];
  const invalidTypes: string[] = [];

  const requiredStats = ['observation.state', 'action'];

  for (const statName of requiredStats) {
    if (!(statName in stats)) {
      missingFields.push(statName);
      continue;
    }

    const stat = stats[statName] as Record<string, unknown>;
    const requiredFields = ['min', 'max', 'mean', 'std'];

    for (const field of requiredFields) {
      if (!(field in stat)) {
        missingFields.push(`${statName}.${field}`);
      } else if (!Array.isArray(stat[field])) {
        invalidTypes.push(`${statName}.${field} should be array`);
      } else if ((stat[field] as number[]).length !== 6) {
        errors.push(`${statName}.${field} should have 6 elements`);
      }
    }
  }

  return {
    valid: errors.length === 0 && missingFields.length === 0 && invalidTypes.length === 0,
    errors,
    missingFields,
    invalidTypes,
  };
}

// ============================================================================
// Temporal Validation
// ============================================================================

/**
 * Validate timestamp consistency
 */
export function validateTemporalConsistency(episode: Episode): {
  valid: boolean;
  monotonic: boolean;
  maxGap: number;
  avgGap: number;
  errors: string[];
} {
  const errors: string[] = [];
  let monotonic = true;
  let maxGap = 0;
  let totalGap = 0;

  for (let i = 1; i < episode.frames.length; i++) {
    const gap = episode.frames[i].timestamp - episode.frames[i - 1].timestamp;

    if (gap <= 0) {
      monotonic = false;
      errors.push(`Non-monotonic timestamp at frame ${i}: ${episode.frames[i].timestamp} <= ${episode.frames[i - 1].timestamp}`);
    }

    if (gap > maxGap) maxGap = gap;
    totalGap += gap;

    // Check for excessive gaps (more than 50ms)
    if (gap > 50) {
      errors.push(`Large timestamp gap at frame ${i}: ${gap}ms`);
    }
  }

  const avgGap = episode.frames.length > 1 ? totalGap / (episode.frames.length - 1) : 0;

  return {
    valid: errors.length === 0,
    monotonic,
    maxGap,
    avgGap,
    errors,
  };
}

/**
 * Validate frame rate consistency
 */
export function validateFrameRate(episode: Episode, targetFps: number = 30): {
  valid: boolean;
  actualFps: number;
  deviation: number;
} {
  if (episode.frames.length < 2) {
    return { valid: false, actualFps: 0, deviation: 1 };
  }

  const duration = (episode.frames[episode.frames.length - 1].timestamp - episode.frames[0].timestamp) / 1000;
  const actualFps = (episode.frames.length - 1) / duration;
  const deviation = Math.abs(actualFps - targetFps) / targetFps;

  return {
    valid: deviation < 0.1, // Within 10% of target
    actualFps,
    deviation,
  };
}
