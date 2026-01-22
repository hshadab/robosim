/**
 * Zustand Store Slices
 *
 * This directory contains modular state slices that compose into the main app store.
 * Each slice is self-contained with its own state and actions.
 */

// UI Slice - user preferences and control modes
export {
  createUISlice,
  getDefaultUIState,
  type UISlice,
  type UIState,
  type UIActions,
} from './uiSlice';

// Code Slice - code editor and console
export {
  createCodeSlice,
  getDefaultCodeState,
  type CodeSlice,
  type CodeSliceState,
  type CodeSliceActions,
} from './codeSlice';

// Simulation Slice - simulation status and sensors
export {
  createSimulationSlice,
  getDefaultSimulationState,
  type SimulationSlice,
  type SimulationSliceState,
  type SimulationSliceActions,
} from './simulationSlice';

// Chat Slice - chat messages and LLM state
export {
  createChatSlice,
  getDefaultChatState,
  type ChatSlice,
  type ChatSliceState,
  type ChatSliceActions,
} from './chatSlice';

// Environment Slice - objects and target zones
export {
  createEnvironmentSlice,
  getDefaultEnvironmentState,
  type EnvironmentSlice,
  type EnvironmentSliceState,
  type EnvironmentSliceActions,
} from './environmentSlice';

// Gripper Slice - gripper position and orientation
export {
  createGripperSlice,
  getDefaultGripperState,
  type GripperSlice,
  type GripperSliceState,
  type GripperSliceActions,
} from './gripperSlice';

// Challenge Slice - challenges and progression
export {
  createChallengeSlice,
  getDefaultChallengeState,
  type ChallengeSlice,
  type ChallengeSliceState,
  type ChallengeSliceActions,
} from './challengeSlice';

// Robot Slice - joints, motor dynamics, robot types
export {
  createRobotSlice,
  getDefaultRobotState,
  DEFAULT_MOTOR_DYNAMICS,
  type RobotSlice,
  type RobotSliceState,
  type RobotSliceActions,
  type MotorDynamicsConfig,
} from './robotSlice';
