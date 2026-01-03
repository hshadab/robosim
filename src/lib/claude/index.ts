/**
 * Claude API Integration for RoboSim
 *
 * This module provides LLM-powered robot control and code generation.
 * For backwards compatibility, the main claudeApi.ts file re-exports from here.
 */

// Re-export types
export type {
  PickupAttemptInfo,
  ClaudeResponse,
  FullRobotState,
  ConversationMessage,
  CallClaudeAPIOptions,
  JointAngles,
} from './types';

// Re-export constants
export {
  TYPE_ALIASES,
  COLOR_WORDS,
  JOINT_LIMITS,
  IK_ERROR_THRESHOLD,
  JAW_LOCAL_Z_OFFSET,
  CLAUDE_RESPONSE_FORMAT,
} from './constants';

// Re-export object matching utilities
export {
  matchObjectToMessage,
  findObjectByDescription,
} from './objectMatching';

// Re-export helper functions
export {
  parseAmount,
  calculateBaseAngleForPosition,
  clampJoint,
  calculateGripperPos,
  calculateTipYForJawY,
  estimateJawY,
  getHelpText,
  describeState,
} from './helpers';

// Re-export API key management
export {
  setClaudeApiKey,
  getClaudeApiKey,
  clearClaudeApiKey,
} from './apiKey';

// Re-export other robot handlers
export {
  simulateWheeledResponse,
  simulateDroneResponse,
  simulateHumanoidResponse,
} from './otherRobots';
