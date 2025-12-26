/**
 * Motion Variation Library for Sim-to-Real Transfer
 *
 * Provides functions to vary motion parameters during demo generation:
 * - Approach angle variation
 * - Speed variation
 * - Trajectory perturbations
 */

/**
 * Approach variation configuration
 */
export interface ApproachVariation {
  baseOffset: number;         // Degrees offset from direct approach (-3 to +3)
  wristRollVariation: number; // Wrist roll angle (80-100 instead of fixed 90)
  approachHeight: number;     // Height offset in meters (-0.01 to +0.01)
  shoulderOffset: number;     // Shoulder angle offset (-2 to +2)
  elbowOffset: number;        // Elbow angle offset (-2 to +2)
}

/**
 * Motion quality configuration
 */
export interface MotionQualityConfig {
  speedRange: [number, number];           // Min/max speed factor (0.7 to 1.3)
  approachAngleVariance: number;          // Degrees variance for approach
  wristRollRange: [number, number];       // Range for wrist roll (80-100)
  enableApproachVariation: boolean;
  enableSpeedVariation: boolean;
}

/**
 * Default motion quality configuration
 */
export const DEFAULT_MOTION_CONFIG: MotionQualityConfig = {
  speedRange: [0.7, 1.3],
  approachAngleVariance: 3,
  wristRollRange: [80, 100],
  enableApproachVariation: true,
  enableSpeedVariation: true,
};

/**
 * Gaussian random number generator (Box-Muller transform)
 */
function gaussianRandom(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Random number in range
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate approach angle variation for a demo
 */
export function generateApproachVariation(
  config: MotionQualityConfig = DEFAULT_MOTION_CONFIG
): ApproachVariation {
  if (!config.enableApproachVariation) {
    return {
      baseOffset: 0,
      wristRollVariation: 90,
      approachHeight: 0,
      shoulderOffset: 0,
      elbowOffset: 0,
    };
  }

  return {
    baseOffset: gaussianRandom(0, config.approachAngleVariance / 2),
    wristRollVariation: randomInRange(
      config.wristRollRange[0],
      config.wristRollRange[1]
    ),
    approachHeight: gaussianRandom(0, 0.005), // ±0.5cm std dev
    shoulderOffset: gaussianRandom(0, 1.5),
    elbowOffset: gaussianRandom(0, 1.5),
  };
}

/**
 * Generate speed factor for a demo
 * Returns a multiplier (0.7 to 1.3) to apply to movement durations
 */
export function generateSpeedFactor(
  config: MotionQualityConfig = DEFAULT_MOTION_CONFIG
): number {
  if (!config.enableSpeedVariation) {
    return 1.0;
  }

  return randomInRange(config.speedRange[0], config.speedRange[1]);
}

/**
 * Apply speed factor to duration
 * Faster = shorter duration, slower = longer duration
 */
export function applySpeedFactor(baseDurationMs: number, speedFactor: number): number {
  return Math.round(baseDurationMs / speedFactor);
}

/**
 * Motion metadata to store with episode
 */
export interface MotionMetadata {
  interpolationType: string;
  speedFactor: number;
  approachVariation: ApproachVariation;
  hasRecovery: boolean;
  recoveryType?: string;
}

/**
 * Generate complete motion variation for an episode
 */
export function generateMotionVariation(
  config: MotionQualityConfig = DEFAULT_MOTION_CONFIG
): { speedFactor: number; approachVariation: ApproachVariation } {
  return {
    speedFactor: generateSpeedFactor(config),
    approachVariation: generateApproachVariation(config),
  };
}

/**
 * Calculate adjusted joint angles with approach variation
 */
export function applyApproachVariation(
  baseAngles: {
    base: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    wristRoll: number;
    gripper: number;
  },
  variation: ApproachVariation
): {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
  gripper: number;
} {
  return {
    base: baseAngles.base + variation.baseOffset,
    shoulder: baseAngles.shoulder + variation.shoulderOffset,
    elbow: baseAngles.elbow + variation.elbowOffset,
    wrist: baseAngles.wrist,
    wristRoll: variation.wristRollVariation,
    gripper: baseAngles.gripper,
  };
}
