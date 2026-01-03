// Robot Types
export interface JointLimits {
  min: number;
  max: number;
}

export interface JointState {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
  gripper: number;
}

/** Extended joint state for sequences that include metadata flags */
export type JointSequenceStep = Partial<JointState> & {
  /** Flag to indicate gripper-only step with extended timing for physics */
  _gripperOnly?: boolean;
  /** Duration in milliseconds for this step (from primitives system) */
  _duration?: number;
  /** Phase name for debugging/logging */
  _phaseName?: string;
  /** Human-readable description of what this step does */
  _description?: string;
};

// Gear ratio configuration for servo motors
export interface GearRatio {
  ratio: string;           // e.g., "1/345" for 1:345 reduction
  motorType?: string;      // e.g., "STS3215"
}

export interface RobotProfile {
  id: string;
  name: string;
  manufacturer: string;
  type: 'arm' | 'wheeled' | 'quadruped' | 'drone' | 'humanoid';
  description: string;
  imageUrl?: string;
  limits: Record<keyof JointState, JointLimits>;
  defaultPosition: JointState;
  gearRatios?: Record<string, GearRatio>;  // Optional gear ratio info per joint
}

// Common Types
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/** Tuple representation of a 3D vector [x, y, z] */
export type Vector3Tuple = [number, number, number];

/** Tuple representation of a quaternion [x, y, z, w] */
export type QuaternionTuple = [number, number, number, number];

/** Euler angles in radians or degrees */
export interface EulerAngles {
  x: number;
  y: number;
  z: number;
  order?: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY';
}

/** Transform combining position and rotation */
export interface Transform {
  position: Vector3Tuple;
  rotation: Vector3Tuple | QuaternionTuple;
}

// Wheeled Robot Types
export interface WheeledRobotState {
  leftWheelSpeed: number;     // -255 to 255 (PWM)
  rightWheelSpeed: number;    // -255 to 255 (PWM)
  position: Vector3D;         // World position
  heading: number;            // degrees (0-360)
  velocity: number;           // m/s
  angularVelocity: number;    // degrees/s
  servoHead: number;          // Ultrasonic servo angle (-90 to 90)
}

export interface WheeledRobotConfig {
  wheelRadius: number;        // meters
  wheelBase: number;          // distance between wheels (meters)
  maxSpeed: number;           // max linear speed m/s
  bodyWidth: number;
  bodyLength: number;
  bodyHeight: number;
}

// Drone Types
export interface DroneState {
  position: Vector3D;         // World position (x, y=altitude, z)
  rotation: Vector3D;         // roll, pitch, yaw in degrees
  velocity: Vector3D;         // m/s
  throttle: number;           // 0-100%
  armed: boolean;
  flightMode: 'stabilize' | 'altitude_hold' | 'position_hold' | 'land';
  motorsRPM: [number, number, number, number]; // FL, FR, BL, BR
}

export interface DroneConfig {
  armLength: number;          // meters (center to motor)
  bodySize: number;           // meters
  maxThrottle: number;        // max vertical speed m/s
  maxTilt: number;            // max roll/pitch degrees
  propellerSize: number;      // meters
}

// Humanoid Robot Types
export interface HumanoidState {
  position: Vector3D;
  rotation: Vector3D;

  // Left leg joints (degrees)
  leftHipPitch: number;
  leftHipRoll: number;
  leftHipYaw: number;
  leftKnee: number;
  leftAnklePitch: number;
  leftAnkleRoll: number;

  // Right leg joints (degrees)
  rightHipPitch: number;
  rightHipRoll: number;
  rightHipYaw: number;
  rightKnee: number;
  rightAnklePitch: number;
  rightAnkleRoll: number;

  // Left arm joints (degrees)
  leftShoulderPitch: number;
  leftShoulderRoll: number;
  leftShoulderYaw: number;
  leftElbow: number;
  leftWrist: number;

  // Right arm joints (degrees)
  rightShoulderPitch: number;
  rightShoulderRoll: number;
  rightShoulderYaw: number;
  rightElbow: number;
  rightWrist: number;

  // Animation state
  isWalking: boolean;
  walkPhase: number;
  balance: { x: number; z: number };
}

// Active Robot Type
export type ActiveRobotType = 'arm' | 'wheeled' | 'drone' | 'humanoid';

export interface RobotState {
  type: ActiveRobotType;
  arm?: JointState;
  wheeled?: WheeledRobotState;
  drone?: DroneState;
  humanoid?: HumanoidState;
}

// Sensor Types
export interface IMUReading {
  roll: number;   // degrees
  pitch: number;  // degrees
  yaw: number;    // degrees
}

export interface TouchSensors {
  gripperLeft: boolean;
  gripperRight: boolean;
  base: boolean;
}

export interface SensorReading {
  // Distance sensors
  ultrasonic?: number;          // cm
  leftIR?: boolean;
  centerIR?: boolean;
  rightIR?: boolean;

  // Motor feedback
  leftMotor?: number;
  rightMotor?: number;

  // Power
  battery?: number;             // percentage

  // Extended sensors (Phase 2)
  gps?: Vector3D;               // Position in world coordinates (meters)
  accelerometer?: Vector3D;     // m/s² (gravity-corrected)
  gyroscope?: Vector3D;         // degrees/second
  imu?: IMUReading;             // Orientation
  touchSensors?: TouchSensors;  // Contact detection
  temperature?: number;         // Celsius (simulated motor temp)

  // Lidar
  lidar?: LidarReading;
}

// Lidar Types
export interface LidarPoint {
  angle: number;      // degrees (0-360)
  distance: number;   // meters
  hit: boolean;       // true if hit an object
  x: number;          // world x coordinate
  z: number;          // world z coordinate
}

export interface LidarReading {
  points: LidarPoint[];
  timestamp: number;
  scanComplete: boolean;
}

export interface LidarConfig {
  enabled: boolean;
  numRays: number;        // e.g., 360 for 1° resolution
  maxRange: number;       // meters
  minRange: number;       // meters
  scanRate: number;       // Hz
  mountHeight: number;    // height above base
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isError?: boolean;
  codeGenerated?: string;
}

// Simulation Types
export type SimulationStatus = 'idle' | 'running' | 'paused' | 'error';

export interface SimulationState {
  status: SimulationStatus;
  fps: number;
  elapsedTime: number;
  error?: string;
}

// Code Types
export interface CodeState {
  source: string;
  language: 'javascript' | 'python';
  isCompiling: boolean;
  compileError?: string;
  isGenerated: boolean;
}

// Console Output Types
export type ConsoleMessageType = 'log' | 'error' | 'warn' | 'info';

export interface ConsoleMessage {
  id: string;
  type: ConsoleMessageType;
  message: string;
  timestamp: Date;
}

export interface ConsoleState {
  messages: ConsoleMessage[];
  isCodeRunning: boolean;
}

// User Skill Level
export type SkillLevel = 'prompter' | 'reader' | 'editor' | 'coder' | 'engineer';

export interface UserProgress {
  level: SkillLevel;
  completedChallenges: string[];
  currentModule: number;
}

// LLM Types
export type JointValue = number | string; // string for relative moves like "+30"
export type JointCommand = Record<string, JointValue>;

export interface LLMResponse {
  action: 'move' | 'sequence' | 'error' | 'explain' | 'code';
  joints?: JointCommand | JointCommand[];
  wheeledAction?: Partial<WheeledRobotState>;
  droneAction?: Partial<DroneState>;
  humanoidAction?: Partial<HumanoidState>;
  duration?: number;
  code?: string;
  description: string;
  explanation?: string;
}

// Environment Types
export type EnvironmentType = 'empty' | 'maze' | 'lineTrack' | 'obstacles' | 'warehouse';

export interface EnvironmentConfig {
  id: EnvironmentType;
  name: string;
  description: string;
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// Interactive Object Types
export type ObjectType = 'cube' | 'ball' | 'cylinder' | 'target' | 'glb';

export interface SimObject {
  id: string;
  type: ObjectType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
  isGrabbable: boolean;
  isGrabbed: boolean;
  isInTargetZone: boolean;
  // For GLB models
  modelUrl?: string;
  name?: string;
}

export interface TargetZone {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  acceptedObjectIds: string[];
  isSatisfied: boolean;
}

// Sensor Types (Extended)
export interface SensorConfig {
  ultrasonic: {
    enabled: boolean;
    maxRange: number;
    coneAngle: number;
    position: [number, number, number];
  };
  irSensors: {
    enabled: boolean;
    positions: { id: string; offset: [number, number, number] }[];
  };
}

export interface SensorVisualization {
  showUltrasonicBeam: boolean;
  showIRIndicators: boolean;
  showDistanceLabels: boolean;
}

// Challenge/Mission Types
export type ChallengeStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';

export interface ChallengeObjective {
  id: string;
  description: string;
  type: 'move_object' | 'reach_position' | 'follow_line' | 'navigate_maze' | 'collect_all';
  target?: {
    objectId?: string;
    position?: [number, number, number];
    zoneId?: string;
  };
  isCompleted: boolean;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  environment: EnvironmentType;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeLimit?: number; // seconds, optional
  objectives: ChallengeObjective[];
  hints: string[];
  status: ChallengeStatus;
  bestTime?: number;
  attempts: number;
}

export interface ChallengeState {
  activeChallenge: Challenge | null;
  elapsedTime: number;
  isTimerRunning: boolean;
  objectivesCompleted: number;
  totalObjectives: number;
  score: number;
}

// Real-time Plot Types
export interface PlotDataPoint {
  time: number;     // timestamp in ms
  value: number;
}

export interface PlotSeries {
  id: string;
  label: string;
  data: PlotDataPoint[];
  color: string;
  visible: boolean;
}

export interface PlotConfig {
  enabled: boolean;
  maxDataPoints: number;    // ring buffer size
  updateInterval: number;   // ms between updates
  timeWindow: number;       // visible time window in ms
}

// Robot Camera Types
export interface RobotCameraConfig {
  enabled: boolean;
  resolution: [number, number];
  fov: number;
  nearClip: number;
  farClip: number;
  position: 'gripper' | 'base' | 'overhead';
}

/**
 * Camera Intrinsics Matrix for sim-to-real transfer
 * Standard pinhole camera model: K = [[fx, 0, cx], [0, fy, cy], [0, 0, 1]]
 */
export interface CameraIntrinsics {
  fx: number;                            // Focal length x (pixels)
  fy: number;                            // Focal length y (pixels)
  cx: number;                            // Principal point x (pixels)
  cy: number;                            // Principal point y (pixels)
  width: number;                         // Image width (pixels)
  height: number;                        // Image height (pixels)
  distortion?: [number, number, number, number, number]; // [k1, k2, p1, p2, k3] radial/tangential
}

/**
 * Simulation Camera Configuration for Sim-to-Real Transfer
 * Matches real SO-101 camera setup for accurate data capture
 */
export interface SimCameraConfig {
  // Intrinsics
  fov: number;                           // Field of view in degrees (vertical)
  resolution: [number, number];          // [width, height] in pixels
  aspectRatio: number;                   // width/height

  // Camera matrix (computed from FOV and resolution)
  intrinsics?: CameraIntrinsics;         // Full intrinsics matrix for calibration

  // Extrinsics
  position: [number, number, number];    // Camera position in world coords
  target: [number, number, number];      // Look-at target
  up: [number, number, number];          // Up vector

  // Capture settings
  jpegQuality: number;                   // 0.0 - 1.0

  // Preset identifier
  preset?: 'SO-101-default' | 'SO-101-overhead' | 'SO-101-side' | 'custom';
}

/**
 * Compute camera intrinsics from FOV and resolution
 * Uses pinhole camera model with centered principal point
 */
export function computeCameraIntrinsics(
  fovDegrees: number,
  width: number,
  height: number
): CameraIntrinsics {
  // Convert vertical FOV to focal length
  const fovRadians = (fovDegrees * Math.PI) / 180;
  const fy = height / (2 * Math.tan(fovRadians / 2));
  const fx = fy; // Assuming square pixels

  return {
    fx,
    fy,
    cx: width / 2,
    cy: height / 2,
    width,
    height,
    distortion: [0, 0, 0, 0, 0], // No distortion in simulation
  };
}

/**
 * SO-101 camera presets matching real hardware configurations
 */
export const SO101_CAMERA_PRESETS: Record<string, SimCameraConfig> = {
  'SO-101-default': {
    fov: 60,
    resolution: [640, 480],
    aspectRatio: 640 / 480,
    position: [0.3, 0.25, 0.3],
    target: [0.15, 0.05, 0],
    up: [0, 1, 0],
    jpegQuality: 0.85,
    preset: 'SO-101-default',
  },
  'SO-101-overhead': {
    fov: 55,
    resolution: [640, 480],
    aspectRatio: 640 / 480,
    position: [0.15, 0.5, 0.0],
    target: [0.15, 0, 0],
    up: [0, 0, -1],
    jpegQuality: 0.85,
    preset: 'SO-101-overhead',
  },
  'SO-101-side': {
    fov: 50,
    resolution: [640, 480],
    aspectRatio: 640 / 480,
    position: [0.4, 0.2, 0.0],
    target: [0.15, 0.1, 0],
    up: [0, 1, 0],
    jpegQuality: 0.85,
    preset: 'SO-101-side',
  },
};
