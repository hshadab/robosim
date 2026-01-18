/**
 * STS3215 Servo Motor Specifications
 *
 * The SO-101 robot arm uses Feetech STS3215 serial bus servos.
 * These values are derived from the official STS3215 datasheet:
 * https://www.feetechrc.com/sts3215-servo-motor
 *
 * Datasheet reference values (12V operation):
 * - No-load speed: 62 RPM (372 deg/s)
 * - Stall torque: 19 kg-cm at 12V
 * - Operating voltage: 6-12.6V
 * - Resolution: 0.088° (4096 positions per revolution)
 * - Communication: TTL/RS485 half-duplex serial
 */

/**
 * Motor specifications for simulation
 */
export interface MotorSpec {
  /** Motor model identifier */
  model: string;
  /** Datasheet reference URL */
  datasheet: string;
  /** Maximum velocity at no load (degrees per second) */
  maxVelocityDegS: number;
  /** Maximum velocity in radians per second */
  maxVelocityRadS: number;
  /** Stall torque at rated voltage (kg-cm) */
  stallTorqueKgCm: number;
  /** Stall torque in Nm */
  stallTorqueNm: number;
  /** Angular resolution (degrees) */
  resolutionDeg: number;
  /** Operating voltage range */
  voltage: { min: number; max: number };
  /** Gear ratio (output:input) */
  gearRatio: string;
}

/**
 * STS3215 servo specifications (from datasheet)
 */
export const STS3215_SPEC: MotorSpec = {
  model: 'STS3215',
  datasheet: 'https://www.feetechrc.com/sts3215-servo-motor',
  // 62 RPM @ no-load = 62 * 6 = 372 deg/s
  maxVelocityDegS: 372,
  maxVelocityRadS: 372 * (Math.PI / 180), // ~6.49 rad/s
  // 19 kg-cm stall torque @ 12V
  stallTorqueKgCm: 19,
  stallTorqueNm: 19 * 0.0981, // ~1.86 Nm
  // 4096 positions per revolution
  resolutionDeg: 360 / 4096, // ~0.088°
  voltage: { min: 6, max: 12.6 },
  gearRatio: '1:345',
};

/**
 * Joint-specific motor dynamics for SO-101
 *
 * These values are conservative estimates based on:
 * - STS3215 no-load speed (372 deg/s max)
 * - Typical reduction for stability and payload handling
 * - LeRobot SO-101 observed performance
 *
 * Values are derated from datasheet for realistic loaded operation:
 * - Base/shoulder: slower for stability with payload
 * - Elbow/wrist: moderate speed for precision
 * - WristRoll/gripper: faster for dexterity
 */
export interface JointMotorConfig {
  /** Maximum velocity for this joint (degrees per second) */
  velocityLimit: number;
  /** Maximum acceleration (degrees per second squared) */
  accelerationLimit: number;
  /** Motor model used */
  motor: string;
  /** Notes about this configuration */
  notes?: string;
}

/**
 * Default motor dynamics for SO-101 joints
 * Based on STS3215 specs with conservative derating for loaded operation
 */
export const SO101_MOTOR_DYNAMICS: Record<string, JointMotorConfig> = {
  base: {
    velocityLimit: 120,      // Conservative for stability (32% of no-load)
    accelerationLimit: 500,
    motor: 'STS3215',
    notes: 'Base rotation - slower for stability with arm payload',
  },
  shoulder: {
    velocityLimit: 90,       // Slowest - carries most weight (24% of no-load)
    accelerationLimit: 400,
    motor: 'STS3215',
    notes: 'Shoulder lift - heavy load, prioritize torque over speed',
  },
  elbow: {
    velocityLimit: 90,       // Moderate load
    accelerationLimit: 400,
    motor: 'STS3215',
    notes: 'Elbow flex - moderate load',
  },
  wrist: {
    velocityLimit: 120,      // Light load
    accelerationLimit: 600,
    motor: 'STS3215',
    notes: 'Wrist flex - lighter load, more speed allowed',
  },
  wristRoll: {
    velocityLimit: 150,      // Very light load (40% of no-load)
    accelerationLimit: 800,
    motor: 'STS3215',
    notes: 'Wrist roll - minimal load, higher speed for orientation tasks',
  },
  gripper: {
    velocityLimit: 180,      // Fast for quick grasp/release (48% of no-load)
    accelerationLimit: 1000,
    motor: 'STS3215',
    notes: 'Gripper - fast actuation for responsive grasping',
  },
};

/**
 * Convert motor dynamics config to the format used by useAppStore
 */
export function getDefaultMotorDynamicsConfig() {
  return {
    enabled: false, // Disabled by default for backwards compatibility
    velocityLimits: {
      base: SO101_MOTOR_DYNAMICS.base.velocityLimit,
      shoulder: SO101_MOTOR_DYNAMICS.shoulder.velocityLimit,
      elbow: SO101_MOTOR_DYNAMICS.elbow.velocityLimit,
      wrist: SO101_MOTOR_DYNAMICS.wrist.velocityLimit,
      wristRoll: SO101_MOTOR_DYNAMICS.wristRoll.velocityLimit,
      gripper: SO101_MOTOR_DYNAMICS.gripper.velocityLimit,
    },
    accelerationLimits: {
      base: SO101_MOTOR_DYNAMICS.base.accelerationLimit,
      shoulder: SO101_MOTOR_DYNAMICS.shoulder.accelerationLimit,
      elbow: SO101_MOTOR_DYNAMICS.elbow.accelerationLimit,
      wrist: SO101_MOTOR_DYNAMICS.wrist.accelerationLimit,
      wristRoll: SO101_MOTOR_DYNAMICS.wristRoll.accelerationLimit,
      gripper: SO101_MOTOR_DYNAMICS.gripper.accelerationLimit,
    },
    latencyMs: 0,
  };
}
