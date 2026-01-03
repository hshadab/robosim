/**
 * Type definitions for Claude API integration
 */

import type { JointState, WheeledRobotState, DroneState, HumanoidState, SensorReading, SimObject } from '../../types';

/** Pickup attempt metadata for training data collection */
export interface PickupAttemptInfo {
  objectPosition: [number, number, number];
  objectType: string;
  objectName: string;
  objectScale: number;
  ikErrors: {
    approach: number;
    grasp: number;
    lift: number;
  };
}

/** Response from Claude API or simulation */
export interface ClaudeResponse {
  action: 'move' | 'sequence' | 'code' | 'explain' | 'query' | 'error';
  description: string;
  code?: string;
  joints?: Partial<JointState> | Partial<JointState>[];
  wheeledAction?: Partial<WheeledRobotState>;
  droneAction?: Partial<DroneState>;
  humanoidAction?: Partial<HumanoidState>;
  duration?: number;
  /** Allow LLM to ask clarifying questions */
  clarifyingQuestion?: string;
  /** Pickup attempt info for training data collection */
  pickupAttempt?: PickupAttemptInfo;
}

/** Full robot state for context building */
export interface FullRobotState {
  joints: JointState;
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;
  sensors: SensorReading;
  isAnimating: boolean;
  objects?: SimObject[];
}

/** Conversation message for chat history */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Options for calling Claude API */
export interface CallClaudeAPIOptions {
  /** Force real API call even for manipulation commands (for training data generation) */
  forceRealAPI?: boolean;
}

/** Joint angles for IK calculations */
export interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}
