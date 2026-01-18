/**
 * Velocity Profiling System
 *
 * Adjusts robot movement velocities based on payload, configuration,
 * and safety considerations.
 */

import type { JointState } from '../types';
import { createLogger } from './logger';

const log = createLogger('VelocityProfiling');

// ============================================================================
// Types
// ============================================================================

/**
 * Payload information
 */
export interface PayloadInfo {
  mass: number;           // Estimated mass in kg
  isHolding: boolean;     // Whether gripper is holding an object
  objectType?: string;    // Type of held object
  fragile?: boolean;      // Whether object is fragile
}

/**
 * Velocity profile
 */
export interface VelocityProfile {
  baseVelocity: number;       // Base joint velocity (deg/s)
  shoulderVelocity: number;   // Shoulder joint velocity
  elbowVelocity: number;      // Elbow joint velocity
  wristVelocity: number;      // Wrist joint velocity
  gripperVelocity: number;    // Gripper velocity
  accelerationTime: number;   // Time to reach max velocity (ms)
  decelerationTime: number;   // Time to stop from max velocity (ms)
}

/**
 * Velocity constraints
 */
export interface VelocityConstraints {
  maxVelocity: number;        // Maximum allowed velocity
  minVelocity: number;        // Minimum velocity (for smooth motion)
  nearSingularityScale: number;  // Velocity scale near singularities
  payloadScale: number;       // Scale based on payload
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default velocity profiles for different scenarios
 */
export const VELOCITY_PROFILES = {
  // Normal operation - no payload
  normal: {
    baseVelocity: 180,
    shoulderVelocity: 150,
    elbowVelocity: 180,
    wristVelocity: 200,
    gripperVelocity: 300,
    accelerationTime: 100,
    decelerationTime: 100,
  } as VelocityProfile,

  // Holding object - reduced velocity
  holding: {
    baseVelocity: 100,
    shoulderVelocity: 80,
    elbowVelocity: 100,
    wristVelocity: 120,
    gripperVelocity: 150,
    accelerationTime: 150,
    decelerationTime: 150,
  } as VelocityProfile,

  // Fragile object - very slow
  fragile: {
    baseVelocity: 60,
    shoulderVelocity: 50,
    elbowVelocity: 60,
    wristVelocity: 70,
    gripperVelocity: 80,
    accelerationTime: 200,
    decelerationTime: 200,
  } as VelocityProfile,

  // Near obstacles - cautious
  cautious: {
    baseVelocity: 80,
    shoulderVelocity: 70,
    elbowVelocity: 80,
    wristVelocity: 90,
    gripperVelocity: 100,
    accelerationTime: 150,
    decelerationTime: 150,
  } as VelocityProfile,

  // Approach grasp - precision
  precision: {
    baseVelocity: 50,
    shoulderVelocity: 40,
    elbowVelocity: 50,
    wristVelocity: 60,
    gripperVelocity: 80,
    accelerationTime: 200,
    decelerationTime: 200,
  } as VelocityProfile,
};

// ============================================================================
// Profile Selection
// ============================================================================

/**
 * Select appropriate velocity profile based on conditions
 */
export function selectVelocityProfile(
  payload: PayloadInfo,
  isNearObstacle: boolean = false,
  isPrecisionMove: boolean = false
): VelocityProfile {
  // Priority: precision > fragile > near obstacle > holding > normal
  if (isPrecisionMove) {
    return VELOCITY_PROFILES.precision;
  }

  if (payload.fragile) {
    return VELOCITY_PROFILES.fragile;
  }

  if (isNearObstacle) {
    return VELOCITY_PROFILES.cautious;
  }

  if (payload.isHolding) {
    return VELOCITY_PROFILES.holding;
  }

  return VELOCITY_PROFILES.normal;
}

/**
 * Calculate velocity scale based on payload mass
 */
export function calculatePayloadScale(mass: number): number {
  // Linear scaling: full speed at 0kg, 50% at 0.5kg, 30% at 1kg+
  if (mass <= 0) return 1.0;
  if (mass >= 1.0) return 0.3;
  return 1.0 - (mass * 0.7);
}

/**
 * Calculate velocity scale based on joint configuration
 * (near singularities or joint limits)
 */
export function calculateConfigurationScale(joints: JointState): number {
  let scale = 1.0;

  // Reduce velocity near joint limits
  const limitMargin = 15; // degrees from limit

  const checkLimit = (value: number, min: number, max: number) => {
    const distFromMin = value - min;
    const distFromMax = max - value;
    const minDist = Math.min(distFromMin, distFromMax);
    if (minDist < limitMargin) {
      return 0.5 + (minDist / limitMargin) * 0.5;
    }
    return 1.0;
  };

  scale = Math.min(scale, checkLimit(joints.base, -110, 110));
  scale = Math.min(scale, checkLimit(joints.shoulder, -100, 100));
  scale = Math.min(scale, checkLimit(joints.elbow, -97, 97));
  scale = Math.min(scale, checkLimit(joints.wrist, -95, 95));

  // Reduce velocity in stretched configurations (potential singularity)
  const armExtension = Math.abs(joints.shoulder) + Math.abs(joints.elbow);
  if (armExtension > 160) {
    scale *= 0.6;
  }

  return scale;
}

// ============================================================================
// Duration Calculation
// ============================================================================

/**
 * Calculate movement duration for a joint change
 */
export function calculateMovementDuration(
  fromJoints: JointState,
  toJoints: JointState,
  profile: VelocityProfile,
  payload: PayloadInfo = { mass: 0, isHolding: false }
): number {
  // Calculate joint changes
  const changes = {
    base: Math.abs(toJoints.base - fromJoints.base),
    shoulder: Math.abs(toJoints.shoulder - fromJoints.shoulder),
    elbow: Math.abs(toJoints.elbow - fromJoints.elbow),
    wrist: Math.abs(toJoints.wrist - fromJoints.wrist),
    gripper: Math.abs(toJoints.gripper - fromJoints.gripper),
  };

  // Calculate time for each joint
  const times = {
    base: (changes.base / profile.baseVelocity) * 1000,
    shoulder: (changes.shoulder / profile.shoulderVelocity) * 1000,
    elbow: (changes.elbow / profile.elbowVelocity) * 1000,
    wrist: (changes.wrist / profile.wristVelocity) * 1000,
    gripper: (changes.gripper / profile.gripperVelocity) * 1000,
  };

  // Dominant time (slowest joint)
  const movementTime = Math.max(times.base, times.shoulder, times.elbow, times.wrist, times.gripper);

  // Add acceleration/deceleration time
  const totalTime = movementTime + profile.accelerationTime + profile.decelerationTime;

  // Apply payload scaling
  const payloadScale = calculatePayloadScale(payload.mass);

  // Apply configuration scaling
  const configScale = calculateConfigurationScale(fromJoints);

  // Final duration (longer for heavier/awkward configurations)
  return totalTime / (payloadScale * configScale);
}

/**
 * Calculate optimal step durations for a joint sequence
 */
export function calculateSequenceDurations(
  sequence: JointState[],
  payload: PayloadInfo = { mass: 0, isHolding: false }
): number[] {
  if (sequence.length < 2) {
    return [500]; // Default minimum duration
  }

  const durations: number[] = [];
  const profile = selectVelocityProfile(payload);

  for (let i = 1; i < sequence.length; i++) {
    const duration = calculateMovementDuration(
      sequence[i - 1],
      sequence[i],
      profile,
      payload
    );

    // Minimum duration for physics stability
    durations.push(Math.max(200, duration));
  }

  return durations;
}

// ============================================================================
// Velocity Scaling
// ============================================================================

/**
 * Apply velocity scaling to a step duration
 */
export function applyVelocityScale(
  baseDuration: number,
  velocityScale: number
): number {
  // velocityScale < 1 means slower (longer duration)
  // velocityScale > 1 means faster (shorter duration)
  return baseDuration / Math.max(0.1, velocityScale);
}

/**
 * Get velocity multiplier for gripper state
 */
export function getGripperVelocityMultiplier(
  isGripperClosing: boolean,
  isHoldingObject: boolean
): number {
  // Slower gripper movement when holding object
  if (isHoldingObject) {
    return 0.5;
  }

  // Slower gripper close for better physics detection
  if (isGripperClosing) {
    return 0.7;
  }

  return 1.0;
}

/**
 * Calculate S-curve velocity profile parameters
 */
export function calculateSCurveParams(
  totalDistance: number,
  maxVelocity: number,
  accelerationTime: number
): {
  cruiseVelocity: number;
  accelDistance: number;
  cruiseDistance: number;
  decelDistance: number;
} {
  // Calculate acceleration
  const acceleration = maxVelocity / (accelerationTime / 1000);

  // Distance covered during acceleration/deceleration
  const accelDistance = 0.5 * acceleration * (accelerationTime / 1000) ** 2;

  // If total distance is too short for full profile, scale down
  if (accelDistance * 2 >= totalDistance) {
    const scaledAccelDist = totalDistance / 2;
    const scaledVelocity = Math.sqrt(2 * acceleration * scaledAccelDist);
    return {
      cruiseVelocity: scaledVelocity,
      accelDistance: scaledAccelDist,
      cruiseDistance: 0,
      decelDistance: scaledAccelDist,
    };
  }

  return {
    cruiseVelocity: maxVelocity,
    accelDistance,
    cruiseDistance: totalDistance - 2 * accelDistance,
    decelDistance: accelDistance,
  };
}

// ============================================================================
// Profile Generation
// ============================================================================

/**
 * Generate a custom velocity profile
 */
export function generateCustomProfile(
  baseScale: number,
  options: {
    isHolding?: boolean;
    mass?: number;
    isFragile?: boolean;
    nearObstacle?: boolean;
    nearLimit?: boolean;
  } = {}
): VelocityProfile {
  // Start with normal profile
  let profile = { ...VELOCITY_PROFILES.normal };

  // Apply base scale
  profile.baseVelocity *= baseScale;
  profile.shoulderVelocity *= baseScale;
  profile.elbowVelocity *= baseScale;
  profile.wristVelocity *= baseScale;
  profile.gripperVelocity *= baseScale;

  // Apply holding reduction
  if (options.isHolding) {
    const holdingScale = 0.6;
    profile.baseVelocity *= holdingScale;
    profile.shoulderVelocity *= holdingScale;
    profile.elbowVelocity *= holdingScale;
    profile.wristVelocity *= holdingScale;
    profile.accelerationTime *= 1.5;
    profile.decelerationTime *= 1.5;
  }

  // Apply mass reduction
  if (options.mass) {
    const massScale = calculatePayloadScale(options.mass);
    profile.baseVelocity *= massScale;
    profile.shoulderVelocity *= massScale;
    profile.elbowVelocity *= massScale;
    profile.wristVelocity *= massScale;
  }

  // Apply fragile reduction
  if (options.isFragile) {
    const fragileScale = 0.5;
    profile.baseVelocity *= fragileScale;
    profile.shoulderVelocity *= fragileScale;
    profile.elbowVelocity *= fragileScale;
    profile.wristVelocity *= fragileScale;
    profile.gripperVelocity *= fragileScale;
    profile.accelerationTime *= 2;
    profile.decelerationTime *= 2;
  }

  // Apply obstacle proximity reduction
  if (options.nearObstacle) {
    const obstacleScale = 0.5;
    profile.baseVelocity *= obstacleScale;
    profile.shoulderVelocity *= obstacleScale;
    profile.elbowVelocity *= obstacleScale;
    profile.wristVelocity *= obstacleScale;
  }

  // Apply joint limit reduction
  if (options.nearLimit) {
    const limitScale = 0.6;
    profile.baseVelocity *= limitScale;
    profile.shoulderVelocity *= limitScale;
    profile.elbowVelocity *= limitScale;
    profile.wristVelocity *= limitScale;
  }

  log.debug('Generated custom velocity profile', profile);

  return profile;
}

/**
 * Get recommended velocity profile as human-readable summary
 */
export function getProfileSummary(profile: VelocityProfile): string {
  const avgVelocity = (
    profile.baseVelocity +
    profile.shoulderVelocity +
    profile.elbowVelocity +
    profile.wristVelocity
  ) / 4;

  if (avgVelocity > 150) {
    return 'Fast (normal operation)';
  } else if (avgVelocity > 100) {
    return 'Moderate (holding object)';
  } else if (avgVelocity > 60) {
    return 'Slow (near obstacles/limits)';
  } else {
    return 'Very slow (fragile/precision)';
  }
}
