/**
 * Trajectory Validator
 *
 * Validates robot trajectories before execution or training data export.
 * Ensures:
 * 1. All joint positions are within limits
 * 2. Velocities don't exceed motor capabilities
 * 3. Accelerations are smooth (no sudden jerks)
 * 4. Gripper timing is sufficient for physics
 * 5. Trajectory is executable on real hardware
 *
 * Used by both LLM response validation and batch demo generation.
 */

import { SO101_CONSTRAINTS } from '../test/realisticData.test';

// Joint state interface (matches main types)
export interface JointState {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
  gripper: number;
}

// Trajectory frame
export interface TrajectoryFrame {
  timestamp: number;  // milliseconds
  joints: Partial<JointState>;
  _gripperOnly?: boolean;
  _duration?: number;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: TrajectoryStats;
}

export interface ValidationError {
  type: 'joint_limit' | 'velocity' | 'acceleration' | 'gripper_timing' | 'format';
  message: string;
  frameIndex: number;
  joint?: keyof JointState;
  value?: number;
  limit?: number;
}

export interface ValidationWarning {
  type: 'near_limit' | 'fast_motion' | 'short_duration' | 'missing_lift';
  message: string;
  frameIndex?: number;
}

export interface TrajectoryStats {
  totalFrames: number;
  durationMs: number;
  maxVelocity: Record<keyof JointState, number>;
  maxAcceleration: Record<keyof JointState, number>;
  workspaceRange: {
    minReach: number;
    maxReach: number;
    minHeight: number;
    maxHeight: number;
  };
}

// Default constraints (can be overridden)
const DEFAULT_CONSTRAINTS = {
  jointLimits: {
    base: { min: -110, max: 110 },
    shoulder: { min: -100, max: 100 },
    elbow: { min: -97, max: 97 },
    wrist: { min: -95, max: 95 },
    wristRoll: { min: -157, max: 163 },
    gripper: { min: 0, max: 100 },
  },
  maxVelocities: {
    base: 180,
    shoulder: 120,
    elbow: 150,
    wrist: 200,
    wristRoll: 200,
    gripper: 300,
  },
  maxAccelerations: {
    base: 500,
    shoulder: 300,
    elbow: 400,
    wrist: 600,
    wristRoll: 600,
    gripper: 1000,
  },
  minGripperCloseMs: 800,
  nearLimitMarginDeg: 5,
};

/**
 * Validate a complete trajectory
 */
export function validateTrajectory(
  frames: TrajectoryFrame[],
  constraints = DEFAULT_CONSTRAINTS
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const joints: (keyof JointState)[] = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'];

  // Initialize stats
  const maxVelocity: Record<keyof JointState, number> = {
    base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0
  };
  const maxAcceleration: Record<keyof JointState, number> = {
    base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0
  };

  // Track previous values for velocity/acceleration calculation
  let prevJoints: Partial<JointState> = {};
  let prevVelocities: Partial<Record<keyof JointState, number>> = {};
  let prevTimestamp = 0;

  // Track gripper state for timing validation
  let lastGripperOpen = true;
  let gripperCloseStartTime = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { joints: currentJoints, timestamp } = frame;

    // Validate joint limits
    for (const joint of joints) {
      const value = currentJoints[joint];
      if (value === undefined) continue;

      const limit = constraints.jointLimits[joint];

      // Check hard limits
      if (value < limit.min) {
        errors.push({
          type: 'joint_limit',
          message: `${joint} = ${value.toFixed(1)}° below minimum ${limit.min}°`,
          frameIndex: i,
          joint,
          value,
          limit: limit.min,
        });
      }
      if (value > limit.max) {
        errors.push({
          type: 'joint_limit',
          message: `${joint} = ${value.toFixed(1)}° above maximum ${limit.max}°`,
          frameIndex: i,
          joint,
          value,
          limit: limit.max,
        });
      }

      // Check near limits (warning)
      if (value < limit.min + constraints.nearLimitMarginDeg ||
          value > limit.max - constraints.nearLimitMarginDeg) {
        warnings.push({
          type: 'near_limit',
          message: `${joint} = ${value.toFixed(1)}° near limit [${limit.min}, ${limit.max}]`,
          frameIndex: i,
        });
      }
    }

    // Calculate velocities and accelerations (if not first frame)
    if (i > 0) {
      const dt = (timestamp - prevTimestamp) / 1000; // seconds

      if (dt > 0) {
        for (const joint of joints) {
          const curr = currentJoints[joint];
          const prev = prevJoints[joint];

          if (curr !== undefined && prev !== undefined) {
            // Velocity
            const velocity = Math.abs(curr - prev) / dt;
            maxVelocity[joint] = Math.max(maxVelocity[joint], velocity);

            // Check velocity limit
            const maxVel = constraints.maxVelocities[joint];
            if (velocity > maxVel * 1.2) { // 20% tolerance
              errors.push({
                type: 'velocity',
                message: `${joint} velocity ${velocity.toFixed(1)}°/s exceeds limit ${maxVel}°/s`,
                frameIndex: i,
                joint,
                value: velocity,
                limit: maxVel,
              });
            } else if (velocity > maxVel * 0.9) {
              warnings.push({
                type: 'fast_motion',
                message: `${joint} moving at ${(velocity / maxVel * 100).toFixed(0)}% of max velocity`,
                frameIndex: i,
              });
            }

            // Acceleration
            const prevVel = prevVelocities[joint];
            if (prevVel !== undefined) {
              const acceleration = Math.abs(velocity - prevVel) / dt;
              maxAcceleration[joint] = Math.max(maxAcceleration[joint], acceleration);

              const maxAcc = constraints.maxAccelerations[joint];
              if (acceleration > maxAcc * 1.5) {
                errors.push({
                  type: 'acceleration',
                  message: `${joint} acceleration ${acceleration.toFixed(0)}°/s² exceeds limit ${maxAcc}°/s²`,
                  frameIndex: i,
                  joint,
                  value: acceleration,
                  limit: maxAcc,
                });
              }
            }

            prevVelocities[joint] = velocity;
          }
        }
      } else {
        warnings.push({
          type: 'short_duration',
          message: `Frame ${i} has zero or negative time delta`,
          frameIndex: i,
        });
      }
    }

    // Validate gripper timing
    if (currentJoints.gripper !== undefined) {
      const gripperOpen = currentJoints.gripper > 50;

      if (lastGripperOpen && !gripperOpen) {
        // Gripper starting to close
        gripperCloseStartTime = timestamp;
      } else if (!lastGripperOpen && gripperOpen) {
        // Gripper opened (release)
        // No validation needed for release
      }

      // Check if gripper close operation has sufficient duration
      if (!gripperOpen && frame._gripperOnly) {
        const duration = frame._duration ?? (i > 0 ? timestamp - frames[i - 1].timestamp : 0);
        if (duration < constraints.minGripperCloseMs) {
          errors.push({
            type: 'gripper_timing',
            message: `Gripper close duration ${duration}ms < required ${constraints.minGripperCloseMs}ms`,
            frameIndex: i,
            value: duration,
            limit: constraints.minGripperCloseMs,
          });
        }
      }

      lastGripperOpen = gripperOpen;
    }

    prevJoints = { ...currentJoints };
    prevTimestamp = timestamp;
  }

  // Check for missing lift after pickup
  if (frames.length >= 2) {
    const hasGripperClose = frames.some((f, i) =>
      i > 0 && (f.joints.gripper ?? 100) < 50 && (frames[i - 1].joints.gripper ?? 100) > 50
    );

    if (hasGripperClose) {
      // Find last frame with shoulder movement
      const lastShoulderFrame = [...frames].reverse().find(f => f.joints.shoulder !== undefined);
      const firstApproachFrame = frames.find(f => f.joints.shoulder !== undefined);

      if (lastShoulderFrame && firstApproachFrame) {
        const liftAmount = (lastShoulderFrame.joints.shoulder ?? 0) - (firstApproachFrame.joints.shoulder ?? 0);
        if (liftAmount > -10) {
          warnings.push({
            type: 'missing_lift',
            message: 'Pickup sequence may be missing lift phase (shoulder should decrease after grasp)',
          });
        }
      }
    }
  }

  // Calculate duration
  const durationMs = frames.length > 0
    ? frames[frames.length - 1].timestamp - frames[0].timestamp
    : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFrames: frames.length,
      durationMs,
      maxVelocity,
      maxAcceleration,
      workspaceRange: {
        minReach: 0.10,  // Placeholder - would need FK to calculate
        maxReach: 0.28,
        minHeight: 0.00,
        maxHeight: 0.35,
      },
    },
  };
}

/**
 * Validate a pickup sequence specifically
 */
export function validatePickupSequence(frames: TrajectoryFrame[]): ValidationResult {
  const baseResult = validateTrajectory(frames);

  // Additional pickup-specific checks
  const pickupErrors: ValidationError[] = [];
  const pickupWarnings: ValidationWarning[] = [];

  // Check sequence structure: approach -> close -> lift
  const gripperValues = frames.map(f => f.joints.gripper ?? 100);
  const hasApproach = gripperValues[0] > 50;
  const hasClose = gripperValues.some(g => g < 50);
  const hasLift = frames.length > 2;

  if (!hasApproach) {
    pickupWarnings.push({
      type: 'near_limit',
      message: 'Pickup should start with gripper open (>50)',
    });
  }

  if (!hasClose) {
    pickupErrors.push({
      type: 'format',
      message: 'Pickup sequence missing gripper close',
      frameIndex: -1,
    });
  }

  if (!hasLift) {
    pickupWarnings.push({
      type: 'missing_lift',
      message: 'Pickup sequence may be too short (need approach, close, lift)',
    });
  }

  return {
    valid: baseResult.valid && pickupErrors.length === 0,
    errors: [...baseResult.errors, ...pickupErrors],
    warnings: [...baseResult.warnings, ...pickupWarnings],
    stats: baseResult.stats,
  };
}

/**
 * Convert LLM response joints to trajectory frames
 */
export function llmJointsToTrajectory(
  joints: (Partial<JointState> & { _gripperOnly?: boolean; _duration?: number })[]
): TrajectoryFrame[] {
  const frames: TrajectoryFrame[] = [];
  let timestamp = 0;

  for (const step of joints) {
    const duration = step._duration ?? 600; // Default 600ms per step
    const frame: TrajectoryFrame = {
      timestamp,
      joints: { ...step },
      _gripperOnly: step._gripperOnly,
      _duration: step._duration,
    };
    delete (frame.joints as Record<string, unknown>)._gripperOnly;
    delete (frame.joints as Record<string, unknown>)._duration;

    frames.push(frame);
    timestamp += duration;
  }

  return frames;
}

/**
 * Interpolate trajectory to target frame rate
 */
export function interpolateTrajectory(
  frames: TrajectoryFrame[],
  targetFps = 30
): TrajectoryFrame[] {
  if (frames.length < 2) return frames;

  const result: TrajectoryFrame[] = [];
  const frameIntervalMs = 1000 / targetFps;

  const totalDuration = frames[frames.length - 1].timestamp;
  const numFrames = Math.ceil(totalDuration / frameIntervalMs);

  for (let i = 0; i <= numFrames; i++) {
    const t = i * frameIntervalMs;

    // Find surrounding keyframes
    let keyframeBefore = frames[0];
    let keyframeAfter = frames[frames.length - 1];

    for (let j = 0; j < frames.length - 1; j++) {
      if (frames[j].timestamp <= t && frames[j + 1].timestamp >= t) {
        keyframeBefore = frames[j];
        keyframeAfter = frames[j + 1];
        break;
      }
    }

    // Interpolate
    const segmentDuration = keyframeAfter.timestamp - keyframeBefore.timestamp;
    const localT = segmentDuration > 0
      ? (t - keyframeBefore.timestamp) / segmentDuration
      : 0;

    // Ease-in-out cubic
    const eased = localT < 0.5
      ? 4 * localT * localT * localT
      : 1 - Math.pow(-2 * localT + 2, 3) / 2;

    const interpolatedJoints: Partial<JointState> = {};

    for (const joint of ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'] as const) {
      const before = keyframeBefore.joints[joint];
      const after = keyframeAfter.joints[joint];

      if (before !== undefined && after !== undefined) {
        interpolatedJoints[joint] = before + (after - before) * eased;
      } else if (before !== undefined) {
        interpolatedJoints[joint] = before;
      } else if (after !== undefined) {
        interpolatedJoints[joint] = after;
      }
    }

    result.push({
      timestamp: t,
      joints: interpolatedJoints,
    });
  }

  return result;
}

/**
 * Quick validation check (returns boolean only)
 */
export function isTrajectoryValid(frames: TrajectoryFrame[]): boolean {
  return validateTrajectory(frames).valid;
}

/**
 * Format validation result for display
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✓ Trajectory is valid');
  } else {
    lines.push('✗ Trajectory has errors:');
    for (const error of result.errors) {
      lines.push(`  - [${error.type}] ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  - ${warning.message}`);
    }
  }

  lines.push(`Stats: ${result.stats.totalFrames} frames, ${result.stats.durationMs}ms duration`);

  return lines.join('\n');
}

export { DEFAULT_CONSTRAINTS };
