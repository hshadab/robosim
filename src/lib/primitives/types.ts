/**
 * Action Primitives Type Definitions
 *
 * Defines the core interfaces for composable robot action primitives.
 * Primitives are atomic actions that can be chained to form complex behaviors.
 */

import type { JointState } from '../../types';

/**
 * Parameters that can be passed to action primitives
 */
export interface ActionParams {
  /** Target object name or ID */
  object?: string;
  /** Target position [x, y, z] in meters */
  position?: [number, number, number];
  /** Target object for stacking/placing on */
  targetObject?: string;
  /** Rotation axis: 'roll', 'pitch', 'yaw' */
  axis?: 'roll' | 'pitch' | 'yaw';
  /** Rotation amount in degrees */
  degrees?: number;
  /** Movement speed multiplier (0.5 = slow, 1.0 = normal, 2.0 = fast) */
  speed?: number;
  /** Height modifier in meters */
  height?: number;
  /** Additional modifiers from natural language */
  modifiers?: string[];
}

/**
 * Success criteria for validating primitive execution
 */
export interface SuccessCriteria {
  /** Object must be grabbed */
  objectGrabbed?: boolean;
  /** Object must be released */
  objectReleased?: boolean;
  /** End effector must be within distance (meters) of target */
  positionTolerance?: number;
  /** Gripper must be at this value (0-100) */
  gripperValue?: number;
  /** Custom validation function */
  custom?: (state: RobotState) => boolean;
}

/**
 * A single phase within an action primitive
 */
export interface Phase {
  /** Human-readable phase name */
  name: string;
  /** Target joint configuration */
  joints: Partial<JointState>;
  /** Duration in milliseconds */
  duration: number;
  /** Description for debugging/logging */
  description?: string;
  /** Special flags (e.g., _gripperOnly for physics timing) */
  flags?: {
    gripperOnly?: boolean;
    waitForContact?: boolean;
  };
  /** Success criteria for this phase */
  successCriteria?: SuccessCriteria;
  /** Can this phase be retried on failure? */
  retryable?: boolean;
  /** Max retry attempts */
  maxRetries?: number;
}

/**
 * Result of executing an action primitive
 */
export interface PrimitiveResult {
  /** Whether the primitive succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Which phase failed (if any) */
  failedPhase?: string;
  /** Final robot state after execution */
  finalState?: RobotState;
  /** Execution duration in milliseconds */
  duration?: number;
  /** IK errors for each phase [approach, grasp, lift] */
  ikErrors?: { [phaseName: string]: number };
}

/**
 * Minimal robot state needed for primitive execution
 */
export interface RobotState {
  joints: JointState;
  gripperWorldPosition: [number, number, number];
  objects: SceneObject[];
  heldObject?: string;
}

/**
 * Scene object representation
 */
export interface SceneObject {
  id: string;
  name: string;
  type: 'cube' | 'cylinder' | 'ball' | 'custom';
  position: [number, number, number];
  scale: number;
  isGrabbed?: boolean;
}

/**
 * Core action primitive interface
 */
export interface ActionPrimitive {
  /** Unique primitive name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Required parameters */
  requiredParams: (keyof ActionParams)[];
  /** Optional parameters */
  optionalParams: (keyof ActionParams)[];

  /**
   * Generate the execution phases for this primitive
   * @param params Action parameters
   * @param state Current robot state
   * @returns Array of phases to execute
   */
  plan(params: ActionParams, state: RobotState): Promise<Phase[]>;

  /**
   * Validate that the primitive can be executed with given params
   * @param params Action parameters
   * @param state Current robot state
   * @returns null if valid, error message if invalid
   */
  validate(params: ActionParams, state: RobotState): string | null;

  /**
   * Get success criteria for the entire primitive
   */
  getSuccessCriteria(): SuccessCriteria;
}

/**
 * A composed sequence of multiple primitives
 */
export interface ComposedSequence {
  /** Unique sequence ID */
  id: string;
  /** Human-readable description of the full task */
  description: string;
  /** Original natural language command */
  originalCommand: string;
  /** Ordered list of primitives to execute */
  steps: {
    primitive: string;
    params: ActionParams;
    phases?: Phase[];
  }[];
  /** Estimated total duration */
  estimatedDuration: number;
  /** Objects involved in this sequence */
  involvedObjects: string[];
}

/**
 * Result of decomposing a natural language command
 */
export interface TaskDecomposition {
  /** Whether decomposition was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** The decomposed sequence */
  sequence?: ComposedSequence;
  /** Confidence score 0-1 */
  confidence?: number;
  /** Alternative interpretations */
  alternatives?: ComposedSequence[];
}

/**
 * Primitive registry for looking up primitives by name
 */
export type PrimitiveRegistry = Map<string, ActionPrimitive>;

/**
 * Execution options for running sequences
 */
export interface ExecutionOptions {
  /** Stop on first failure vs continue */
  stopOnFailure?: boolean;
  /** Enable per-phase validation */
  validatePhases?: boolean;
  /** Callback for phase completion */
  onPhaseComplete?: (phase: Phase, success: boolean) => void;
  /** Callback for step completion */
  onStepComplete?: (stepIndex: number, success: boolean) => void;
  /** Speed multiplier for all phases */
  speedMultiplier?: number;
}
