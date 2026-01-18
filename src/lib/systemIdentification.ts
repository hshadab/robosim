/**
 * System Identification Library for Sim-to-Real Transfer
 *
 * Manages physics parameters that affect robot behavior:
 * - Joint friction, damping, and backlash
 * - Motor torque limits and dynamics
 * - Gripper mechanics
 * - Environment physics
 * - Sensor noise characteristics
 */

import { generateSecureId } from './crypto';

/**
 * Per-joint physics parameters
 */
export interface JointPhysics {
  friction: number;       // Static friction (Nm)
  damping: number;        // Viscous damping (Nm·s/rad)
  backlash: number;       // Mechanical backlash (degrees)
  inertia: number;        // Rotational inertia (kg·m²)
  torqueLimit: number;    // Max motor torque (Nm)
}

/**
 * Robot physics identification
 */
export interface RobotPhysicsIdentification {
  joints: {
    base: JointPhysics;
    shoulder: JointPhysics;
    elbow: JointPhysics;
    wrist: JointPhysics;
    wristRoll: JointPhysics;
    gripper: JointPhysics;
  };
  gripper: {
    maxGripForce: number;     // Newtons
    fingerFriction: number;   // Coefficient
    closingSpeed: number;     // deg/s
    openingSpeed: number;     // deg/s
    compliance: number;       // Stiffness factor (0-1)
  };
}

/**
 * Environment physics parameters
 */
export interface EnvironmentPhysics {
  gravity: number;            // m/s² (typically 9.81)
  floorFriction: number;      // Coefficient
  objectFriction: number;     // Default object friction
  airDamping: number;         // Air resistance factor
}

/**
 * Sensor noise characteristics
 */
export interface SensorNoise {
  jointEncoderNoise: number;  // Degrees std dev
  jointVelocityNoise: number; // deg/s std dev
  cameraLatency: number;      // Milliseconds
  cameraJitter: number;       // Position std dev (cm)
}

/**
 * Complete physics identification
 */
export interface PhysicsIdentification {
  robot: RobotPhysicsIdentification;
  environment: EnvironmentPhysics;
  sensors: SensorNoise;
  version: string;
  identifiedAt: string;
}

/**
 * Default SO-101 physics parameters (estimated)
 */
export const DEFAULT_SO101_PHYSICS: PhysicsIdentification = {
  robot: {
    joints: {
      base: {
        friction: 0.05,
        damping: 0.02,
        backlash: 0.5,
        inertia: 0.001,
        torqueLimit: 2.0,
      },
      shoulder: {
        friction: 0.08,
        damping: 0.03,
        backlash: 0.8,
        inertia: 0.002,
        torqueLimit: 4.0,
      },
      elbow: {
        friction: 0.06,
        damping: 0.025,
        backlash: 0.6,
        inertia: 0.0015,
        torqueLimit: 3.0,
      },
      wrist: {
        friction: 0.04,
        damping: 0.015,
        backlash: 0.4,
        inertia: 0.0008,
        torqueLimit: 1.5,
      },
      wristRoll: {
        friction: 0.03,
        damping: 0.01,
        backlash: 0.3,
        inertia: 0.0005,
        torqueLimit: 1.0,
      },
      gripper: {
        friction: 0.02,
        damping: 0.008,
        backlash: 0.2,
        inertia: 0.0003,
        torqueLimit: 0.8,
      },
    },
    gripper: {
      maxGripForce: 10,      // N
      fingerFriction: 0.6,
      closingSpeed: 90,      // deg/s
      openingSpeed: 120,     // deg/s
      compliance: 0.8,
    },
  },
  environment: {
    gravity: 9.81,
    floorFriction: 0.5,
    objectFriction: 0.4,
    airDamping: 0.01,
  },
  sensors: {
    jointEncoderNoise: 0.1,
    jointVelocityNoise: 1.0,
    cameraLatency: 50,
    cameraJitter: 0.2,
  },
  version: '1.0.0',
  identifiedAt: new Date().toISOString(),
};

/**
 * Calibration session data from real robot measurements
 */
export interface CalibrationSession {
  id: string;
  robotId: string;
  createdAt: string;
  measurements: {
    jointRanges: Record<string, [number, number]>;  // [min, max] in degrees
    zeroPositions: Record<string, number>;           // Calibrated zero positions
    velocityScales: Record<string, number>;          // Velocity calibration factors
  };
  calibration: {
    jointOffsets: Record<string, number>;            // Offset from sim to real
    jointScales: Record<string, number>;             // Scale factor from sim to real
    velocityFactors: Record<string, number>;         // Velocity scaling
  };
}

/**
 * Create a new calibration session
 */
export function createCalibrationSession(robotId: string): CalibrationSession {
  return {
    id: generateSecureId('cal'),
    robotId,
    createdAt: new Date().toISOString(),
    measurements: {
      jointRanges: {
        base: [-180, 180],
        shoulder: [-180, 180],
        elbow: [-180, 180],
        wrist: [-180, 180],
        wristRoll: [-180, 180],
        gripper: [0, 100],
      },
      zeroPositions: {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        wristRoll: 0,
        gripper: 50,
      },
      velocityScales: {
        base: 1.0,
        shoulder: 1.0,
        elbow: 1.0,
        wrist: 1.0,
        wristRoll: 1.0,
        gripper: 1.0,
      },
    },
    calibration: {
      jointOffsets: {
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        wristRoll: 0,
        gripper: 0,
      },
      jointScales: {
        base: 1.0,
        shoulder: 1.0,
        elbow: 1.0,
        wrist: 1.0,
        wristRoll: 1.0,
        gripper: 1.0,
      },
      velocityFactors: {
        base: 1.0,
        shoulder: 1.0,
        elbow: 1.0,
        wrist: 1.0,
        wristRoll: 1.0,
        gripper: 1.0,
      },
    },
  };
}

/**
 * Apply friction model to a joint torque
 */
export function applyFrictionModel(
  targetVelocity: number,
  physics: JointPhysics
): number {
  // Coulomb friction (direction-dependent constant)
  const coulombFriction = Math.sign(targetVelocity) * physics.friction;

  // Viscous damping (velocity-proportional)
  const viscousDamping = physics.damping * targetVelocity;

  // Total resistive torque
  return coulombFriction + viscousDamping;
}

/**
 * Simulate backlash effect on position
 */
export function applyBacklash(
  commandedPosition: number,
  actualPosition: number,
  _direction: number,
  backlash: number
): number {
  const deadzone = backlash / 2;
  const delta = commandedPosition - actualPosition;

  if (Math.abs(delta) < deadzone) {
    // Within deadzone - no movement
    return actualPosition;
  }

  // Move by the amount exceeding deadzone
  return actualPosition + Math.sign(delta) * (Math.abs(delta) - deadzone);
}

/**
 * Add sensor noise to a measurement
 */
export function addSensorNoise(
  trueValue: number,
  noiseStd: number
): number {
  // Box-Muller transform for Gaussian noise
  const u1 = Math.random();
  const u2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return trueValue + gaussian * noiseStd;
}

/**
 * Apply physics identification to simulated motion
 */
export function applyPhysicsModel(
  targetPositions: number[],
  currentPositions: number[],
  currentVelocities: number[],
  physics: RobotPhysicsIdentification,
  dt: number
): { positions: number[]; velocities: number[] } {
  const jointNames = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'] as const;
  const newPositions: number[] = [];
  const newVelocities: number[] = [];

  for (let i = 0; i < 6; i++) {
    const joint = physics.joints[jointNames[i]];
    const target = targetPositions[i];
    const current = currentPositions[i];
    const velocity = currentVelocities[i];

    // Simple PD controller with physics
    const kp = 10;  // Position gain
    const kd = 1;   // Velocity gain
    const error = target - current;
    const desiredAccel = kp * error - kd * velocity;

    // Apply torque limits
    const torque = Math.max(-joint.torqueLimit, Math.min(joint.torqueLimit, desiredAccel * joint.inertia));

    // Apply friction
    const frictionTorque = applyFrictionModel(velocity, joint);

    // Net acceleration
    const accel = (torque - frictionTorque) / joint.inertia;

    // Integrate
    const newVel = velocity + accel * dt;
    let newPos = current + newVel * dt;

    // Apply backlash
    newPos = applyBacklash(target, newPos, Math.sign(newVel), joint.backlash);

    newPositions.push(newPos);
    newVelocities.push(newVel);
  }

  return { positions: newPositions, velocities: newVelocities };
}

/**
 * Estimate physics parameters from recorded trajectory
 * Uses least-squares fitting to estimate friction and damping
 */
export function estimatePhysicsFromTrajectory(
  _positions: number[][],
  velocities: number[][],
  accelerations: number[][],
  _dt: number
): Partial<RobotPhysicsIdentification> {
  // This is a simplified estimation - real system ID would use more sophisticated methods
  const jointNames = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'] as const;
  const estimatedJoints: Partial<RobotPhysicsIdentification['joints']> = {};

  for (let j = 0; j < 6; j++) {
    // Collect samples where there's motion
    const movingSamples: { vel: number; accel: number }[] = [];

    for (let i = 0; i < velocities.length; i++) {
      if (Math.abs(velocities[i][j]) > 1) { // Only consider moving samples
        movingSamples.push({
          vel: velocities[i][j],
          accel: accelerations[i][j],
        });
      }
    }

    if (movingSamples.length < 10) {
      continue; // Not enough data
    }

    // Simple linear regression to estimate damping
    // accel ≈ -damping * vel (ignoring other terms)
    let sumVelAccel = 0;
    let sumVelSquared = 0;

    for (const sample of movingSamples) {
      sumVelAccel += sample.vel * sample.accel;
      sumVelSquared += sample.vel * sample.vel;
    }

    const estimatedDamping = -sumVelAccel / sumVelSquared;

    estimatedJoints[jointNames[j]] = {
      ...DEFAULT_SO101_PHYSICS.robot.joints[jointNames[j]],
      damping: Math.max(0.001, estimatedDamping),
    };
  }

  return {
    joints: estimatedJoints as RobotPhysicsIdentification['joints'],
  };
}

/**
 * Export physics identification to JSON
 */
export function exportPhysicsIdentification(
  physics: PhysicsIdentification
): string {
  return JSON.stringify(physics, null, 2);
}

/**
 * Import physics identification from JSON
 */
export function importPhysicsIdentification(
  json: string
): PhysicsIdentification {
  return JSON.parse(json) as PhysicsIdentification;
}
