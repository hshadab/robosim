/**
 * Action Calibration Library for Sim-to-Real Transfer
 *
 * Maps simulated joint angles to real servo commands:
 * - Joint angle offsets and scales
 * - Servo pulse width mapping (PWM)
 * - Velocity limits per joint
 * - Direction correction (some servos may be reversed)
 */

/**
 * Per-joint calibration parameters
 */
export interface JointCalibration {
  simName: string;           // Joint name in simulation
  realServoId: number;       // Servo ID on real robot (e.g., 0-5)
  offset: number;            // Degrees offset (real = sim + offset)
  scale: number;             // Multiplier (real = sim * scale + offset)
  direction: 1 | -1;         // Direction correction (1 = same, -1 = reversed)
  minAngle: number;          // Real servo min angle (degrees)
  maxAngle: number;          // Real servo max angle (degrees)
  minPulse: number;          // PWM pulse width at min angle (µs)
  maxPulse: number;          // PWM pulse width at max angle (µs)
}

/**
 * Complete action calibration configuration
 */
export interface ActionCalibrationConfig {
  robotId: string;
  joints: JointCalibration[];
  velocityLimits: number[];   // Max velocity per joint (deg/s)
  accelerationLimits: number[]; // Max acceleration per joint (deg/s²)
  controlRate: number;        // Control loop rate (Hz)
  smoothingFactor: number;    // Position smoothing (0-1)
  calibratedAt: string;
}

/**
 * Default SO-101 calibration (factory defaults)
 * These values should be adjusted for each physical robot
 */
export const DEFAULT_SO101_CALIBRATION: ActionCalibrationConfig = {
  robotId: 'so-101',
  joints: [
    {
      simName: 'base',
      realServoId: 0,
      offset: 0,
      scale: 1.0,
      direction: 1,
      minAngle: -180,
      maxAngle: 180,
      minPulse: 500,
      maxPulse: 2500,
    },
    {
      simName: 'shoulder',
      realServoId: 1,
      offset: 0,
      scale: 1.0,
      direction: -1,  // Often reversed on real robots
      minAngle: -180,
      maxAngle: 180,
      minPulse: 500,
      maxPulse: 2500,
    },
    {
      simName: 'elbow',
      realServoId: 2,
      offset: 0,
      scale: 1.0,
      direction: 1,
      minAngle: -180,
      maxAngle: 180,
      minPulse: 500,
      maxPulse: 2500,
    },
    {
      simName: 'wrist',
      realServoId: 3,
      offset: 0,
      scale: 1.0,
      direction: -1,
      minAngle: -180,
      maxAngle: 180,
      minPulse: 500,
      maxPulse: 2500,
    },
    {
      simName: 'wristRoll',
      realServoId: 4,
      offset: 0,
      scale: 1.0,
      direction: 1,
      minAngle: -180,
      maxAngle: 180,
      minPulse: 500,
      maxPulse: 2500,
    },
    {
      simName: 'gripper',
      realServoId: 5,
      offset: 0,
      scale: 1.0,
      direction: 1,
      minAngle: 0,
      maxAngle: 100,
      minPulse: 1000,
      maxPulse: 2000,
    },
  ],
  velocityLimits: [120, 90, 90, 120, 150, 180],  // deg/s
  accelerationLimits: [500, 400, 400, 600, 800, 1000],  // deg/s²
  controlRate: 50,  // Hz
  smoothingFactor: 0.2,
  calibratedAt: new Date().toISOString(),
};

/**
 * Convert simulation joint angle to real servo angle
 */
export function simToRealAngle(
  simAngle: number,
  calibration: JointCalibration
): number {
  // Apply scale, direction, and offset
  let realAngle = simAngle * calibration.scale * calibration.direction + calibration.offset;

  // Clamp to servo limits
  realAngle = Math.max(calibration.minAngle, Math.min(calibration.maxAngle, realAngle));

  return realAngle;
}

/**
 * Convert real servo angle to simulation joint angle
 */
export function realToSimAngle(
  realAngle: number,
  calibration: JointCalibration
): number {
  // Reverse the transformation
  const simAngle = (realAngle - calibration.offset) / calibration.scale * calibration.direction;
  return simAngle;
}

/**
 * Convert angle to PWM pulse width
 */
export function angleToPulse(
  angle: number,
  calibration: JointCalibration
): number {
  // Linear interpolation from angle to pulse
  const angleRange = calibration.maxAngle - calibration.minAngle;
  const pulseRange = calibration.maxPulse - calibration.minPulse;

  const normalizedAngle = (angle - calibration.minAngle) / angleRange;
  const pulse = calibration.minPulse + normalizedAngle * pulseRange;

  return Math.round(pulse);
}

/**
 * Convert PWM pulse width to angle
 */
export function pulseToAngle(
  pulse: number,
  calibration: JointCalibration
): number {
  const pulseRange = calibration.maxPulse - calibration.minPulse;
  const angleRange = calibration.maxAngle - calibration.minAngle;

  const normalizedPulse = (pulse - calibration.minPulse) / pulseRange;
  const angle = calibration.minAngle + normalizedPulse * angleRange;

  return angle;
}

/**
 * Convert full simulation joint state to real servo commands
 */
export function simToRealAction(
  simJoints: number[],
  config: ActionCalibrationConfig
): {
  angles: number[];
  pulses: number[];
  velocities: number[];
} {
  const angles: number[] = [];
  const pulses: number[] = [];

  for (let i = 0; i < config.joints.length; i++) {
    const cal = config.joints[i];
    const realAngle = simToRealAngle(simJoints[i], cal);
    const pulse = angleToPulse(realAngle, cal);

    angles.push(realAngle);
    pulses.push(pulse);
  }

  return {
    angles,
    pulses,
    velocities: config.velocityLimits,
  };
}

/**
 * Convert real servo state to simulation joint state
 */
export function realToSimState(
  realPulses: number[],
  config: ActionCalibrationConfig
): number[] {
  const simJoints: number[] = [];

  for (let i = 0; i < config.joints.length; i++) {
    const cal = config.joints[i];
    const realAngle = pulseToAngle(realPulses[i], cal);
    const simAngle = realToSimAngle(realAngle, cal);

    simJoints.push(simAngle);
  }

  return simJoints;
}

/**
 * Apply velocity limit to a joint movement
 */
export function applyVelocityLimit(
  currentAngle: number,
  targetAngle: number,
  maxVelocity: number,
  dt: number
): number {
  const maxDelta = maxVelocity * dt;
  const delta = targetAngle - currentAngle;

  if (Math.abs(delta) <= maxDelta) {
    return targetAngle;
  }

  return currentAngle + Math.sign(delta) * maxDelta;
}

/**
 * Apply exponential smoothing to position
 */
export function smoothPosition(
  currentTarget: number,
  previousTarget: number,
  smoothingFactor: number
): number {
  return previousTarget + smoothingFactor * (currentTarget - previousTarget);
}

/**
 * Generate smooth trajectory from current to target
 */
export function generateSmoothTrajectory(
  currentAngles: number[],
  targetAngles: number[],
  config: ActionCalibrationConfig,
  durationMs: number
): number[][] {
  const numSteps = Math.ceil((durationMs / 1000) * config.controlRate);
  const trajectory: number[][] = [];

  for (let step = 0; step <= numSteps; step++) {
    const t = step / numSteps;

    // Minimum-jerk profile
    const t3 = t * t * t;
    const t4 = t3 * t;
    const t5 = t4 * t;
    const s = 10 * t3 - 15 * t4 + 6 * t5;

    const intermediateAngles: number[] = [];
    for (let j = 0; j < currentAngles.length; j++) {
      const angle = currentAngles[j] + s * (targetAngles[j] - currentAngles[j]);
      intermediateAngles.push(angle);
    }

    trajectory.push(intermediateAngles);
  }

  return trajectory;
}

/**
 * Calibration data point for automatic calibration
 */
export interface CalibrationDataPoint {
  simAngle: number;
  realAngle: number;
  pulse: number;
}

/**
 * Perform automatic calibration from data points
 * Uses linear regression to find offset and scale
 */
export function autoCalibrate(
  jointIndex: number,
  dataPoints: CalibrationDataPoint[],
  config: ActionCalibrationConfig
): JointCalibration {
  if (dataPoints.length < 2) {
    return config.joints[jointIndex]; // Not enough data
  }

  // Linear regression: realAngle = scale * simAngle + offset
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const n = dataPoints.length;

  for (const point of dataPoints) {
    sumX += point.simAngle;
    sumY += point.realAngle;
    sumXY += point.simAngle * point.realAngle;
    sumX2 += point.simAngle * point.simAngle;
  }

  const scale = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const offset = (sumY - scale * sumX) / n;

  // Determine direction from sign of scale
  const direction = scale >= 0 ? 1 : -1;

  return {
    ...config.joints[jointIndex],
    scale: Math.abs(scale),
    offset,
    direction: direction as 1 | -1,
  };
}

/**
 * Validate calibration by checking for reasonable values
 */
export function validateCalibration(
  config: ActionCalibrationConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const joint of config.joints) {
    // Check scale is reasonable (0.5 to 2.0)
    if (joint.scale < 0.5 || joint.scale > 2.0) {
      errors.push(`${joint.simName}: scale ${joint.scale} out of reasonable range`);
    }

    // Check offset is reasonable (-30 to +30 degrees)
    if (Math.abs(joint.offset) > 30) {
      errors.push(`${joint.simName}: offset ${joint.offset}° exceeds 30°`);
    }

    // Check pulse range is valid
    if (joint.minPulse >= joint.maxPulse) {
      errors.push(`${joint.simName}: invalid pulse range`);
    }

    // Check angle range is valid
    if (joint.minAngle >= joint.maxAngle) {
      errors.push(`${joint.simName}: invalid angle range`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export calibration to JSON
 */
export function exportCalibration(config: ActionCalibrationConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Import calibration from JSON
 */
export function importCalibration(json: string): ActionCalibrationConfig {
  return JSON.parse(json) as ActionCalibrationConfig;
}

/**
 * Merge calibration with defaults (for partial calibration files)
 */
export function mergeWithDefaults(
  partial: Partial<ActionCalibrationConfig>
): ActionCalibrationConfig {
  return {
    ...DEFAULT_SO101_CALIBRATION,
    ...partial,
    joints: partial.joints?.map((j, i) => ({
      ...DEFAULT_SO101_CALIBRATION.joints[i],
      ...j,
    })) ?? DEFAULT_SO101_CALIBRATION.joints,
    calibratedAt: new Date().toISOString(),
  };
}
