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
} from './objectMatching';

// Re-export findObjectByDescription from stackHandler
export { findObjectByDescription } from './stackHandler';

// Re-export IK calculation functions
export {
  clampJoint,
  calculateGripperPos,
  calculateTipYForJawY,
  estimateJawY,
  calculateBaseAngleForPosition,
  solveIKForTarget,
  calculateGraspJoints,
  calculateApproachJoints,
  calculateLiftJoints,
} from './ikCalculations';

// Re-export arm handler functions
export {
  parseAmount,
  parseHeight,
  parseJointTarget,
  getHelpText as getArmHelpText,
  simulateArmResponse,
} from './armHandler';

// Re-export helper functions (backward compatibility)
export {
  getHelpText,
  describeState,
} from './helpers';

// Re-export pickup sequence handler
export { handlePickUpCommand } from './pickupSequence';

// Re-export stack handlers
export { handleStackCommand, handleMoveToCommand } from './stackHandler';

// Re-export multi-step handler
export { handleMultiStepCommand } from './multiStepHandler';

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
