/**
 * Robot State Slice
 *
 * Manages robot state including joints, motor dynamics, and different robot types.
 * This slice has dependencies on environment for collision detection.
 * The full collision detection logic is in the composed store.
 */

import type { StateCreator } from 'zustand';
import type {
  JointState,
  RobotProfile,
  ActiveRobotType,
  WheeledRobotState,
  DroneState,
  HumanoidState,
} from '../../types';
import { ROBOT_PROFILES, DEFAULT_ROBOT_ID } from '../../config/robots';
import { DEFAULT_HUMANOID_STATE } from '../../components/simulation/defaults';

/**
 * Motor dynamics configuration for realistic servo simulation
 * Velocity limits in degrees/second, acceleration in degrees/second²
 */
export interface MotorDynamicsConfig {
  enabled: boolean;
  velocityLimits: JointState;      // Max velocity per joint (deg/s)
  accelerationLimits: JointState;  // Max acceleration per joint (deg/s²)
  latencyMs: number;               // Command latency (ms)
}

// Default SO-101 motor dynamics based on STS3215 servo specs
export const DEFAULT_MOTOR_DYNAMICS: MotorDynamicsConfig = {
  enabled: false,  // Disabled by default for backwards compatibility
  velocityLimits: {
    base: 120,      // Base rotation (slower for stability)
    shoulder: 90,   // Shoulder lift (slowest - heavy load)
    elbow: 90,      // Elbow flex
    wrist: 120,     // Wrist flex
    wristRoll: 150, // Wrist roll
    gripper: 180,   // Gripper (fastest)
  },
  accelerationLimits: {
    base: 500,
    shoulder: 400,
    elbow: 400,
    wrist: 600,
    wristRoll: 800,
    gripper: 1000,
  },
  latencyMs: 0,
};

export interface RobotSliceState {
  selectedRobotId: string;
  selectedRobot: RobotProfile | null;
  activeRobotType: ActiveRobotType;
  joints: JointState;              // Target joints (what user commands)
  actualJoints: JointState;        // Actual joints (after motor dynamics)
  jointVelocities: JointState;     // Current joint velocities (deg/s)
  motorDynamics: MotorDynamicsConfig; // Motor simulation config
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;
  isAnimating: boolean;
}

export interface RobotSliceActions {
  setSelectedRobot: (robotId: string) => void;
  setActiveRobotType: (type: ActiveRobotType) => void;
  // Note: setJoints with collision detection is implemented in composed store
  setJointsBasic: (joints: Partial<JointState>) => void;
  setWheeledRobot: (state: Partial<WheeledRobotState>) => void;
  setDrone: (state: Partial<DroneState>) => void;
  setHumanoid: (state: Partial<HumanoidState>) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setMotorDynamics: (config: Partial<MotorDynamicsConfig>) => void;
  updateActualJoints: (deltaTime: number) => void;
}

export type RobotSlice = RobotSliceState & RobotSliceActions;

export const getDefaultRobotState = (): RobotSliceState => {
  const robot = ROBOT_PROFILES.find((r) => r.id === DEFAULT_ROBOT_ID) || ROBOT_PROFILES[0];
  return {
    selectedRobotId: DEFAULT_ROBOT_ID,
    selectedRobot: robot,
    activeRobotType: 'arm',
    joints: robot.defaultPosition,
    actualJoints: robot.defaultPosition,
    jointVelocities: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0 },
    motorDynamics: { ...DEFAULT_MOTOR_DYNAMICS },
    wheeledRobot: {
      leftWheelSpeed: 0,
      rightWheelSpeed: 0,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      velocity: 0,
      angularVelocity: 0,
      servoHead: 0,
    },
    drone: {
      position: { x: 0, y: 0.05, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      throttle: 0,
      armed: false,
      flightMode: 'stabilize',
      motorsRPM: [0, 0, 0, 0],
    },
    humanoid: DEFAULT_HUMANOID_STATE,
    isAnimating: false,
  };
};

export const createRobotSlice: StateCreator<
  RobotSlice,
  [],
  [],
  RobotSlice
> = (set, get) => ({
  ...getDefaultRobotState(),

  setSelectedRobot: (robotId: string) => {
    const robot = ROBOT_PROFILES.find((r) => r.id === robotId);
    if (robot) {
      set({
        selectedRobotId: robotId,
        selectedRobot: robot,
        joints: robot.defaultPosition,
        actualJoints: robot.defaultPosition,
      });
    }
  },

  setActiveRobotType: (type: ActiveRobotType) => {
    set({ activeRobotType: type });
  },

  // Basic joint setter without collision detection
  // The full setJoints with collision is in the composed store
  setJointsBasic: (joints: Partial<JointState>) => {
    const currentJoints = get().joints;
    const robot = get().selectedRobot;

    let newJoints = { ...currentJoints };
    for (const [key, value] of Object.entries(joints)) {
      const jointKey = key as keyof JointState;
      if (robot && robot.limits[jointKey]) {
        const { min, max } = robot.limits[jointKey];
        newJoints[jointKey] = Math.max(min, Math.min(max, value as number));
      } else {
        newJoints[jointKey] = value as number;
      }
    }

    set({ joints: newJoints });
  },

  setWheeledRobot: (state: Partial<WheeledRobotState>) => {
    set((s) => ({
      wheeledRobot: { ...s.wheeledRobot, ...state },
    }));
  },

  setDrone: (state: Partial<DroneState>) => {
    set((s) => ({
      drone: { ...s.drone, ...state },
    }));
  },

  setHumanoid: (state: Partial<HumanoidState>) => {
    set((s) => ({
      humanoid: { ...s.humanoid, ...state },
    }));
  },

  setIsAnimating: (isAnimating: boolean) => set({ isAnimating }),

  setMotorDynamics: (config: Partial<MotorDynamicsConfig>) => {
    set((state) => ({
      motorDynamics: { ...state.motorDynamics, ...config },
    }));
  },

  /**
   * Update actual joints by applying motor dynamics (velocity/acceleration limits)
   * Called each animation frame with delta time in seconds
   * When motor dynamics is disabled, actual joints immediately match target joints
   */
  updateActualJoints: (deltaTime: number) => {
    const state = get();
    const { joints: target, actualJoints: actual, jointVelocities, motorDynamics } = state;

    // If motor dynamics disabled, snap to target immediately
    if (!motorDynamics.enabled) {
      if (actual !== target) {
        set({
          actualJoints: { ...target },
          jointVelocities: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0 },
        });
      }
      return;
    }

    // Apply motor dynamics with velocity and acceleration limits
    const newActual: JointState = { ...actual };
    const newVelocities: JointState = { ...jointVelocities };
    const jointKeys: (keyof JointState)[] = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'];

    for (const key of jointKeys) {
      const error = target[key] - actual[key];
      const maxVel = motorDynamics.velocityLimits[key];
      const maxAccel = motorDynamics.accelerationLimits[key];
      const currentVel = jointVelocities[key];

      // Calculate desired velocity (P-controller with velocity limit)
      // Use proportional gain of 5 for responsive but smooth tracking
      const kP = 5.0;
      let desiredVel = error * kP;
      desiredVel = Math.max(-maxVel, Math.min(maxVel, desiredVel));

      // Apply acceleration limit
      const velChange = desiredVel - currentVel;
      const maxVelChange = maxAccel * deltaTime;
      const limitedVelChange = Math.max(-maxVelChange, Math.min(maxVelChange, velChange));
      const newVel = currentVel + limitedVelChange;

      // Update position
      newActual[key] = actual[key] + newVel * deltaTime;
      newVelocities[key] = newVel;

      // Clamp to target if very close (prevents oscillation)
      if (Math.abs(newActual[key] - target[key]) < 0.1 && Math.abs(newVel) < 1) {
        newActual[key] = target[key];
        newVelocities[key] = 0;
      }
    }

    set({
      actualJoints: newActual,
      jointVelocities: newVelocities,
    });
  },
});
