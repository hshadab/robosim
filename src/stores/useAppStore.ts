/**
 * Main application state store using Zustand
 *
 * This store composes modular slices from ./slices/ directory:
 * - uiSlice: User preferences and control modes
 * - codeSlice: Code editor and console
 * - simulationSlice: Simulation status and sensors
 * - chatSlice: Chat messages and LLM state
 * - environmentSlice: Objects and target zones
 * - gripperSlice: Gripper position and orientation
 * - challengeSlice: Challenges and progression
 * - robotSlice: Joints, motor dynamics, robot types
 *
 * Cross-slice interactions are handled in this file.
 */

import { create } from 'zustand';
import type { JointState, EnvironmentType } from '../types';
import { getDefaultCode } from '../config/robots';
import { getEnvironmentObjects, getEnvironmentTargetZones } from '../config/environments';
import { preventSelfCollision } from '../lib/selfCollision';

// Import all slices
import {
  createUISlice,
  getDefaultUIState,
  type UISlice,
} from './slices/uiSlice';

import {
  createCodeSlice,
  getDefaultCodeState,
  type CodeSlice,
} from './slices/codeSlice';

import {
  createSimulationSlice,
  getDefaultSimulationState,
  type SimulationSlice,
} from './slices/simulationSlice';

import {
  createChatSlice,
  getDefaultChatState,
  type ChatSlice,
} from './slices/chatSlice';

import {
  createEnvironmentSlice,
  getDefaultEnvironmentState,
  type EnvironmentSlice,
} from './slices/environmentSlice';

import {
  createGripperSlice,
  getDefaultGripperState,
  type GripperSlice,
} from './slices/gripperSlice';

import {
  createChallengeSlice,
  getDefaultChallengeState,
  type ChallengeSlice,
} from './slices/challengeSlice';

import {
  createRobotSlice,
  getDefaultRobotState,
  type RobotSlice,
  type MotorDynamicsConfig,
} from './slices/robotSlice';

// Re-export MotorDynamicsConfig for backward compatibility
export type { MotorDynamicsConfig };

/**
 * Combined app state type - all slices merged
 */
type AppState =
  & UISlice
  & CodeSlice
  & SimulationSlice
  & ChatSlice
  & EnvironmentSlice
  & GripperSlice
  & ChallengeSlice
  & RobotSlice
  & {
    // Cross-slice actions
    setJoints: (joints: Partial<JointState>) => void;
    setSelectedRobot: (robotId: string) => void;
    setEnvironment: (envId: EnvironmentType) => void;
    startChallenge: (challengeId: string) => void;
    resetChallenge: () => void;
    resetToDefaults: () => void;
  };

/**
 * Get default state from all slices
 */
const getDefaultState = () => ({
  ...getDefaultUIState(),
  ...getDefaultCodeState(),
  ...getDefaultSimulationState(),
  ...getDefaultChatState(),
  ...getDefaultEnvironmentState(),
  ...getDefaultGripperState(),
  ...getDefaultChallengeState(),
  ...getDefaultRobotState(),
});

export const useAppStore = create<AppState>((set, get, store) => ({
  // Compose all slices
  ...createUISlice(set, get, store),
  ...createCodeSlice(set, get, store),
  ...createSimulationSlice(set, get, store),
  ...createChatSlice(set, get, store),
  ...createEnvironmentSlice(set, get, store),
  ...createGripperSlice(set, get, store),
  ...createChallengeSlice(set, get, store),
  ...createRobotSlice(set, get, store),

  // Override setSelectedRobot to also update code
  setSelectedRobot: (robotId: string) => {
    const state = get();
    const robot = state.selectedRobot;
    // First call the robot slice's setSelectedRobot
    const robotSlice = createRobotSlice(set, get, store);
    robotSlice.setSelectedRobot(robotId);

    // Then update code if robot changed
    const newRobot = get().selectedRobot;
    if (newRobot && newRobot.id !== robot?.id) {
      set({
        code: {
          ...get().code,
          source: getDefaultCode(robotId),
          isGenerated: false,
        },
      });
    }
  },

  // Override setEnvironment to also reset challenge state
  setEnvironment: (envId: EnvironmentType) => {
    const objects = getEnvironmentObjects(envId);
    const targetZones = getEnvironmentTargetZones(envId);
    set({
      currentEnvironment: envId,
      objects,
      targetZones,
      // Reset challenge state when changing environment
      challengeState: {
        ...get().challengeState,
        activeChallenge: null,
        elapsedTime: 0,
        isTimerRunning: false,
        objectivesCompleted: 0,
        totalObjectives: 0,
      },
    });
  },

  // Cross-slice: startChallenge updates environment AND challenge state
  startChallenge: (challengeId: string) => {
    const state = get();
    const challenge = state.challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status === 'locked') return;

    // Update challenge status
    const updatedChallenges = state.challenges.map((c) =>
      c.id === challengeId ? { ...c, status: 'in_progress' as const, attempts: c.attempts + 1 } : c
    );

    // Load environment for this challenge
    const objects = getEnvironmentObjects(challenge.environment);
    const targetZones = getEnvironmentTargetZones(challenge.environment);

    set({
      challenges: updatedChallenges,
      currentEnvironment: challenge.environment,
      objects,
      targetZones,
      challengeState: {
        activeChallenge: { ...challenge, status: 'in_progress' },
        elapsedTime: 0,
        isTimerRunning: true,
        objectivesCompleted: 0,
        totalObjectives: challenge.objectives.length,
        score: 0,
      },
    });
  },

  // Cross-slice: resetChallenge restarts the active challenge
  resetChallenge: () => {
    const { challengeState } = get();
    if (!challengeState.activeChallenge) return;
    get().startChallenge(challengeState.activeChallenge.id);
  },

  // Cross-slice: setJoints with collision detection
  // This needs access to objects and gripper state
  setJoints: (joints: Partial<JointState>) => {
    const currentJoints = get().joints;
    const robot = get().selectedRobot;
    const robotId = get().selectedRobotId;
    let gripperMinValue = get().gripperMinValue;
    const objects = get().objects;
    const gripperWorldPosition = get().gripperWorldPosition;
    const gripperWorldQuaternion = get().gripperWorldQuaternion;

    // Apply individual joint limits
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

    // === PROACTIVE COLLISION DETECTION ===
    // Check if there's an object in the grasp zone
    const hasGrabbedObject = objects.some(o => o.isGrabbed);

    if (!hasGrabbedObject && gripperWorldPosition[0] !== 0) {
      // Constants for collision detection - using correct sinusoidal geometry
      const JAW_LOCAL_OFFSET = { x: -0.0079, y: 0, z: 0.0068 };
      const GRASP_ZONE = 0.10;   // 10cm detection zone
      const JAW_LENGTH = 0.030;  // 3cm jaw length from pivot to tip
      const GRIPPER_MIN_ANGLE_DEG = -10;
      const GRIPPER_ANGLE_RANGE_DEG = 110;

      // Calculate jaw position from gripper tip
      const qx = gripperWorldQuaternion[0];
      const qy = gripperWorldQuaternion[1];
      const qz = gripperWorldQuaternion[2];
      const qw = gripperWorldQuaternion[3];

      // Rotate local jaw offset by gripper quaternion
      const ox = JAW_LOCAL_OFFSET.x;
      const oy = JAW_LOCAL_OFFSET.y;
      const oz = JAW_LOCAL_OFFSET.z;
      const uvx = qy * oz - qz * oy;
      const uvy = qz * ox - qx * oz;
      const uvz = qx * oy - qy * ox;
      const uuvx = qy * uvz - qz * uvy;
      const uuvy = qz * uvx - qx * uvz;
      const uuvz = qx * uvy - qy * uvx;
      const twoW = 2 * qw;
      const jawOffsetX = ox + uvx * twoW + uuvx * 2;
      const jawOffsetY = oy + uvy * twoW + uuvy * 2;
      const jawOffsetZ = oz + uvz * twoW + uuvz * 2;

      const jawX = gripperWorldPosition[0] + jawOffsetX;
      const jawY = gripperWorldPosition[1] + jawOffsetY;
      const jawZ = gripperWorldPosition[2] + jawOffsetZ;

      // Find nearest graspable object in zone
      for (const obj of objects) {
        if (!obj.isGrabbable || obj.isGrabbed) continue;

        const dx = obj.position[0] - jawX;
        const dy = obj.position[1] - jawY;
        const dz = obj.position[2] - jawZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < GRASP_ZONE) {
          // Object in grasp zone - calculate minimum gripper value using sinusoidal formula
          const objectDiameter = obj.scale;
          const targetGap = objectDiameter * 0.95;
          const maxGap = 2 * JAW_LENGTH;
          const sinAngle = Math.min(1, targetGap / maxGap);
          const angleRad = Math.asin(sinAngle);
          const angleDeg = angleRad * (180 / Math.PI);
          const minForObject = Math.max(0, Math.min(100, ((angleDeg - GRIPPER_MIN_ANGLE_DEG) / GRIPPER_ANGLE_RANGE_DEG) * 100));

          // Set the more restrictive minimum
          if (gripperMinValue === null || minForObject > gripperMinValue) {
            gripperMinValue = minForObject;
            set({ gripperMinValue: minForObject });
          }
          break;
        }
      }
    }

    // Apply gripper minimum when holding an object (prevents crushing)
    if (gripperMinValue !== null && newJoints.gripper < gripperMinValue) {
      newJoints.gripper = gripperMinValue;
    }

    // Apply self-collision prevention for articulated arms
    newJoints = preventSelfCollision(newJoints, robotId);

    set({ joints: newJoints });
  },

  // Reset all state to defaults
  resetToDefaults: () => set(getDefaultState()),
}));

// Expose store to window for testing
if (typeof window !== 'undefined') {
  (window as unknown as { __ZUSTAND_STORE__: typeof useAppStore; __APP_STORE__: typeof useAppStore }).__ZUSTAND_STORE__ = useAppStore;
  (window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore;
}
