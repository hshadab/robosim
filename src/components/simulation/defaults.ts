import type { DroneConfig, DroneState, HumanoidState, WheeledRobotConfig } from '../../types';

// Shared configuration for drone component
export const DRONE_CONFIG: DroneConfig = {
  armLength: 0.08,
  bodySize: 0.06,
  maxThrottle: 0.5,
  maxTilt: 30,
  propellerSize: 0.04,
};

export const DEFAULT_DRONE_STATE: DroneState = {
  position: { x: 0, y: 0.05, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  throttle: 0,
  armed: false,
  flightMode: 'stabilize',
  motorsRPM: [0, 0, 0, 0],
};

// Shared configuration for wheeled robot component
export const WHEELED_ROBOT_CONFIG: WheeledRobotConfig = {
  wheelRadius: 0.025,
  wheelBase: 0.1,
  maxSpeed: 0.3,
  bodyWidth: 0.12,
  bodyLength: 0.15,
  bodyHeight: 0.05,
};

// Humanoid defaults/dimensions reused by component and store
export const HUMANOID_SCALE = 1;
export const HUMANOID_DIMENSIONS = {
  torsoHeight: 0.25 * HUMANOID_SCALE,
  torsoWidth: 0.18 * HUMANOID_SCALE,
  torsoDepth: 0.12 * HUMANOID_SCALE,
  headRadius: 0.06 * HUMANOID_SCALE,
  neckHeight: 0.04 * HUMANOID_SCALE,
  upperArmLength: 0.12 * HUMANOID_SCALE,
  upperArmRadius: 0.025 * HUMANOID_SCALE,
  lowerArmLength: 0.11 * HUMANOID_SCALE,
  lowerArmRadius: 0.02 * HUMANOID_SCALE,
  handLength: 0.05 * HUMANOID_SCALE,
  hipWidth: 0.14 * HUMANOID_SCALE,
  upperLegLength: 0.18 * HUMANOID_SCALE,
  upperLegRadius: 0.035 * HUMANOID_SCALE,
  lowerLegLength: 0.17 * HUMANOID_SCALE,
  lowerLegRadius: 0.03 * HUMANOID_SCALE,
  footLength: 0.1 * HUMANOID_SCALE,
  footHeight: 0.03 * HUMANOID_SCALE,
  footWidth: 0.06 * HUMANOID_SCALE,
};

const STANDING_HEIGHT =
  HUMANOID_DIMENSIONS.torsoHeight / 2 + 0.04 +
  HUMANOID_DIMENSIONS.upperLegLength + 0.04 +
  HUMANOID_DIMENSIONS.lowerLegLength + 0.04 +
  HUMANOID_DIMENSIONS.footHeight;

export const DEFAULT_HUMANOID_STATE: HumanoidState = {
  position: { x: 0, y: STANDING_HEIGHT, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  leftHipPitch: 0,
  leftHipRoll: 0,
  leftHipYaw: 0,
  leftKnee: 0,
  leftAnklePitch: 0,
  leftAnkleRoll: 0,
  rightHipPitch: 0,
  rightHipRoll: 0,
  rightHipYaw: 0,
  rightKnee: 0,
  rightAnklePitch: 0,
  rightAnkleRoll: 0,
  leftShoulderPitch: 0,
  leftShoulderRoll: 0,
  leftShoulderYaw: 0,
  leftElbow: 0,
  leftWrist: 0,
  rightShoulderPitch: 0,
  rightShoulderRoll: 0,
  rightShoulderYaw: 0,
  rightElbow: 0,
  rightWrist: 0,
  isWalking: false,
  walkPhase: 0,
  balance: { x: 0, z: 0 },
};

export const HUMANOID_CONFIG = {
  name: 'Berkeley Humanoid Lite',
  manufacturer: 'UC Berkeley',
  height: 0.8,
  weight: 16,
  dof: 22,
  description: 'Open-source, sub-$5000 humanoid robot with 3D-printed gearboxes',
  joints: {
    hipPitch: { min: -60, max: 60 },
    hipRoll: { min: -30, max: 30 },
    hipYaw: { min: -45, max: 45 },
    knee: { min: 0, max: 120 },
    anklePitch: { min: -45, max: 45 },
    ankleRoll: { min: -20, max: 20 },
    shoulderPitch: { min: -180, max: 60 },
    shoulderRoll: { min: -90, max: 90 },
    shoulderYaw: { min: -90, max: 90 },
    elbow: { min: 0, max: 135 },
    wrist: { min: -90, max: 90 },
  },
};
