/**
 * Pipeline Test Helpers
 *
 * Utility functions for testing the LLM → Training Data pipeline.
 */

import type { JointState } from '../../types';
import type { Trajectory, TrajectoryFrame } from '../fixtures/trajectories';
import type { Episode, EpisodeFrame } from '../fixtures/episodes';
import { SO101_JOINT_LIMITS, SO101_MAX_VELOCITIES } from '../fixtures/trajectories';

// ============================================================================
// Types
// ============================================================================

export interface PipelineResult {
  success: boolean;
  trajectory?: Trajectory;
  error?: {
    category: 'parse_error' | 'validation_error' | 'joint_limits' | 'velocity' | 'gripper_timing' | 'structure';
    message: string;
    details?: Record<string, unknown>;
    recoverable: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// LLM Response Processing
// ============================================================================

/**
 * Process an LLM response into a validated trajectory
 */
export function processLLMToTrajectory(llmResponse: unknown): PipelineResult {
  // Handle null/undefined
  if (llmResponse === null || llmResponse === undefined) {
    return {
      success: false,
      error: {
        category: 'parse_error',
        message: 'LLM response is null or undefined',
        recoverable: false,
      },
    };
  }

  // Step 1: Parse JSON
  let parsed: Record<string, unknown>;
  try {
    if (typeof llmResponse === 'string') {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = llmResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        parsed = JSON.parse(llmResponse);
      }
    } else if (typeof llmResponse === 'object') {
      parsed = llmResponse as Record<string, unknown>;
    } else {
      return {
        success: false,
        error: {
          category: 'parse_error',
          message: 'LLM response is not a valid type',
          recoverable: false,
        },
      };
    }
  } catch {
    return {
      success: false,
      error: {
        category: 'parse_error',
        message: 'Failed to parse LLM response as JSON',
        recoverable: true,
      },
    };
  }

  // Step 2: Validate structure
  if (!parsed.sequence || !Array.isArray(parsed.sequence)) {
    return {
      success: false,
      error: {
        category: 'structure',
        message: 'Missing or invalid sequence array',
        recoverable: false,
      },
    };
  }

  if (parsed.sequence.length === 0) {
    return {
      success: false,
      error: {
        category: 'structure',
        message: 'Empty sequence array',
        recoverable: false,
      },
    };
  }

  // Step 3: Validate each frame
  const frames: TrajectoryFrame[] = [];
  let prevTimestamp = -1;

  for (let i = 0; i < parsed.sequence.length; i++) {
    const frame = parsed.sequence[i] as Record<string, unknown>;

    // Check timestamp
    const timestamp = frame.timestamp as number;
    if (typeof timestamp !== 'number' || timestamp < 0) {
      return {
        success: false,
        error: {
          category: 'validation_error',
          message: `Invalid timestamp at frame ${i}`,
          details: { frame: i, timestamp },
          recoverable: false,
        },
      };
    }

    if (timestamp <= prevTimestamp) {
      return {
        success: false,
        error: {
          category: 'validation_error',
          message: `Non-monotonic timestamp at frame ${i}`,
          details: { frame: i, timestamp, prevTimestamp },
          recoverable: false,
        },
      };
    }

    // Check joints
    const joints = frame.joints as Partial<JointState>;
    if (!joints) {
      return {
        success: false,
        error: {
          category: 'validation_error',
          message: `Missing joints at frame ${i}`,
          recoverable: false,
        },
      };
    }

    // Validate joint limits
    for (const [joint, value] of Object.entries(joints)) {
      if (typeof value !== 'number') continue;
      const limits = SO101_JOINT_LIMITS[joint as keyof typeof SO101_JOINT_LIMITS];
      if (limits && (value < limits.min || value > limits.max)) {
        return {
          success: false,
          error: {
            category: 'joint_limits',
            message: `Joint ${joint} out of bounds at frame ${i}`,
            details: { frame: i, joint, value, limits },
            recoverable: false,
          },
        };
      }
    }

    // Validate velocity (if not first frame)
    if (i > 0) {
      const dt = (timestamp - prevTimestamp) / 1000; // seconds
      const prevFrame = parsed.sequence[i - 1] as Record<string, unknown>;
      const prevJoints = prevFrame.joints as Partial<JointState>;

      for (const [joint, value] of Object.entries(joints)) {
        if (typeof value !== 'number') continue;
        const prevValue = prevJoints[joint as keyof JointState];
        if (typeof prevValue !== 'number') continue;

        const velocity = Math.abs(value - prevValue) / dt;
        const maxVel = SO101_MAX_VELOCITIES[joint as keyof typeof SO101_MAX_VELOCITIES];
        if (maxVel && velocity > maxVel * 1.5) { // 50% tolerance
          return {
            success: false,
            error: {
              category: 'velocity',
              message: `Excessive velocity for ${joint} at frame ${i}`,
              details: { frame: i, joint, velocity, maxVel },
              recoverable: false,
            },
          };
        }
      }
    }

    frames.push({
      timestamp,
      joints,
      _gripperOnly: frame._gripperOnly as boolean | undefined,
      _duration: frame._duration as number | undefined,
    });

    prevTimestamp = timestamp;
  }

  // Step 4: Validate gripper timing for pickup actions
  if (parsed.action === 'pickup') {
    const gripperCloseValidation = validateGripperTiming(frames);
    if (!gripperCloseValidation.valid) {
      return {
        success: false,
        error: {
          category: 'gripper_timing',
          message: gripperCloseValidation.errors[0],
          recoverable: false,
        },
      };
    }
  }

  return {
    success: true,
    trajectory: {
      frames,
      metadata: {
        action: parsed.action as string,
        objectType: (parsed.metadata as Record<string, unknown>)?.objectType as string,
        objectPosition: (parsed.metadata as Record<string, unknown>)?.objectPosition as [number, number, number],
      },
    },
  };
}

/**
 * Validate gripper close timing
 */
function validateGripperTiming(frames: TrajectoryFrame[]): ValidationResult {
  const errors: string[] = [];

  // Find gripper close
  let closeStart = -1;
  let closeEnd = -1;

  for (let i = 1; i < frames.length; i++) {
    const prevGripper = frames[i - 1].joints.gripper;
    const currGripper = frames[i].joints.gripper;

    if (prevGripper !== undefined && currGripper !== undefined) {
      if (prevGripper > 50 && currGripper < 50) {
        closeStart = frames[i - 1].timestamp;
        closeEnd = frames[i].timestamp;
        break;
      }
    }
  }

  if (closeStart >= 0 && closeEnd >= 0) {
    const duration = closeEnd - closeStart;
    if (duration < 800) {
      errors.push(`Gripper close too fast: ${duration}ms (minimum 800ms required)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: [],
  };
}

// ============================================================================
// Trajectory to Episode Conversion
// ============================================================================

/**
 * Convert a trajectory to an episode with interpolation to 30fps
 */
export function trajectoryToEpisode(trajectory: Trajectory): Episode {
  const FPS = 30;
  const FRAME_INTERVAL = 1000 / FPS; // 33.33ms

  const frames: EpisodeFrame[] = [];
  const srcFrames = trajectory.frames;

  if (srcFrames.length === 0) {
    return {
      id: `episode_${Date.now()}`,
      frames: [],
      metadata: {
        action: trajectory.metadata?.action || 'unknown',
        success: false,
      },
    };
  }

  const startTime = srcFrames[0].timestamp;
  const endTime = srcFrames[srcFrames.length - 1].timestamp;
  const duration = endTime - startTime;

  // Generate frames at 30fps
  let frameIndex = 0;
  for (let t = 0; t <= duration; t += FRAME_INTERVAL) {
    const timestamp = startTime + t;

    // Find surrounding source frames for interpolation
    let srcIdx = 0;
    for (let i = 0; i < srcFrames.length - 1; i++) {
      if (srcFrames[i + 1].timestamp >= timestamp) {
        srcIdx = i;
        break;
      }
      srcIdx = i;
    }

    const srcFrame = srcFrames[srcIdx];
    const nextFrame = srcFrames[Math.min(srcIdx + 1, srcFrames.length - 1)];

    // Interpolation factor
    const dt = nextFrame.timestamp - srcFrame.timestamp;
    const alpha = dt > 0 ? (timestamp - srcFrame.timestamp) / dt : 0;

    // Interpolate joints
    const state = interpolateJoints(srcFrame.joints, nextFrame.joints, alpha);

    // Calculate velocity from previous frame
    let velocity = [0, 0, 0, 0, 0, 0];
    if (frames.length > 0) {
      const prevFrame = frames[frames.length - 1];
      const timeDelta = (timestamp - prevFrame.timestamp) / 1000;
      if (timeDelta > 0) {
        velocity = state.map((val, i) => (val - prevFrame.observation.state[i]) / timeDelta);
      }
    }

    frames.push({
      timestamp: Math.round(timestamp),
      observation: { state },
      action: state.slice(), // Action is same as target state
      velocity,
    });

    frameIndex++;
  }

  // Generate unique ID with timestamp + random component
  const uniqueId = `episode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: uniqueId,
    frames,
    metadata: {
      action: trajectory.metadata?.action || 'unknown',
      success: true,
      objectType: trajectory.metadata?.objectType,
      language: `${trajectory.metadata?.action} the ${trajectory.metadata?.objectType}`,
    },
  };
}

/**
 * Interpolate between two joint states
 */
function interpolateJoints(
  from: Partial<JointState>,
  to: Partial<JointState>,
  alpha: number
): number[] {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const normGripper = (val: number) => val / 100;

  const joints = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'] as const;
  const result: number[] = [];

  for (const joint of joints) {
    const fromVal = from[joint] ?? 0;
    const toVal = to[joint] ?? fromVal;
    const interpolated = fromVal + (toVal - fromVal) * alpha;

    if (joint === 'gripper') {
      result.push(normGripper(interpolated));
    } else {
      result.push(toRad(interpolated));
    }
  }

  return result;
}

// ============================================================================
// Episode Validation
// ============================================================================

/**
 * Validate an episode for quality metrics
 */
export function validateEpisodeQuality(episode: Episode): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check frame count
  if (episode.frames.length < 45) {
    errors.push(`Too few frames: ${episode.frames.length} (minimum 45 for 1.5s at 30fps)`);
  }

  // Check duration
  if (episode.frames.length >= 2) {
    const duration = episode.frames[episode.frames.length - 1].timestamp - episode.frames[0].timestamp;
    if (duration < 1500) {
      errors.push(`Duration too short: ${duration}ms (minimum 1500ms)`);
    }
    if (duration > 30000) {
      warnings.push(`Duration very long: ${duration}ms`);
    }
  }

  // Check timestamp monotonicity
  for (let i = 1; i < episode.frames.length; i++) {
    if (episode.frames[i].timestamp <= episode.frames[i - 1].timestamp) {
      errors.push(`Non-monotonic timestamp at frame ${i}`);
      break;
    }
  }

  // Check state dimensions
  for (let i = 0; i < episode.frames.length; i++) {
    if (episode.frames[i].observation.state.length !== 6) {
      errors.push(`Invalid state dimensions at frame ${i}: expected 6, got ${episode.frames[i].observation.state.length}`);
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate average jerk for an episode
 */
export function calculateAverageJerk(episode: Episode): number {
  if (episode.frames.length < 3) return 0;

  let totalJerk = 0;
  let count = 0;

  for (let i = 2; i < episode.frames.length; i++) {
    const dt1 = (episode.frames[i - 1].timestamp - episode.frames[i - 2].timestamp) / 1000;
    const dt2 = (episode.frames[i].timestamp - episode.frames[i - 1].timestamp) / 1000;

    if (dt1 <= 0 || dt2 <= 0) continue;

    for (let j = 0; j < 6; j++) {
      const v1 = (episode.frames[i - 1].observation.state[j] - episode.frames[i - 2].observation.state[j]) / dt1;
      const v2 = (episode.frames[i].observation.state[j] - episode.frames[i - 1].observation.state[j]) / dt2;
      const a1 = v1 / dt1;
      const a2 = v2 / dt2;
      const jerk = Math.abs(a2 - a1) / ((dt1 + dt2) / 2);
      totalJerk += jerk;
      count++;
    }
  }

  return count > 0 ? totalJerk / count : 0;
}

/**
 * Calculate average frame gap in milliseconds
 */
export function calculateAverageFrameGap(episode: Episode): number {
  if (episode.frames.length < 2) return 0;

  let totalGap = 0;
  for (let i = 1; i < episode.frames.length; i++) {
    totalGap += episode.frames[i].timestamp - episode.frames[i - 1].timestamp;
  }

  return totalGap / (episode.frames.length - 1);
}
