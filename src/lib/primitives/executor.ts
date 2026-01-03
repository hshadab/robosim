/**
 * Sequence Executor
 *
 * Executes composed sequences of action primitives with validation
 * and error handling.
 */

import type {
  Phase,
  RobotState,
  ComposedSequence,
  ExecutionOptions,
  PrimitiveResult,
} from './types';
import { planSequence } from './composer';
import { createLogger } from '../logger';

const log = createLogger('Executor');

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: ExecutionOptions = {
  stopOnFailure: true,
  validatePhases: true,
  speedMultiplier: 1.0,
};

/**
 * Convert phases to the JointSequenceStep format used by useLLMChat
 */
export function phasesToSequenceSteps(phases: Phase[]): import('../../types').JointSequenceStep[] {
  return phases.map(phase => ({
    base: phase.joints.base,
    shoulder: phase.joints.shoulder,
    elbow: phase.joints.elbow,
    wrist: phase.joints.wrist,
    wristRoll: phase.joints.wristRoll,
    gripper: phase.joints.gripper,
    _gripperOnly: phase.flags?.gripperOnly,
    _duration: phase.duration,
    _phaseName: phase.name,
    _description: phase.description,
  }));
}

/**
 * Execute a composed sequence
 *
 * This function prepares the sequence for execution and returns
 * the steps in a format that can be passed to executeArmSequence()
 */
export async function executeSequence(
  sequence: ComposedSequence,
  initialState: RobotState,
  options: Partial<ExecutionOptions> = {}
): Promise<{
  steps: import('../../types').JointSequenceStep[];
  phases: Phase[];
  description: string;
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  log.info(`Executing sequence: "${sequence.description}"`);
  log.debug(`Steps: ${sequence.steps.map(s => s.primitive).join(' → ')}`);

  // Plan all phases
  const phases = await planSequence(sequence, initialState);

  // Apply speed multiplier
  if (opts.speedMultiplier && opts.speedMultiplier !== 1.0) {
    for (const phase of phases) {
      if (!phase.flags?.gripperOnly) {
        phase.duration = Math.round(phase.duration / opts.speedMultiplier);
      }
    }
  }

  // Convert to sequence steps
  const steps = phasesToSequenceSteps(phases);

  // Log execution plan
  log.info(`Execution plan: ${phases.length} phases, estimated ${phases.reduce((t, p) => t + p.duration, 0) / 1000}s`);
  for (const phase of phases) {
    log.debug(`  - ${phase.name}: ${phase.description || 'no description'} (${phase.duration}ms)`);
  }

  return {
    steps,
    phases,
    description: sequence.description,
  };
}

/**
 * Validate execution result against success criteria
 */
export function validateResult(
  phases: Phase[],
  finalState: RobotState
): PrimitiveResult {
  const result: PrimitiveResult = {
    success: true,
    duration: phases.reduce((t, p) => t + p.duration, 0),
    ikErrors: {},
  };

  // Check each phase's success criteria
  for (const phase of phases) {
    if (phase.successCriteria) {
      const criteria = phase.successCriteria;

      if (criteria.objectGrabbed !== undefined) {
        const hasGrabbed = finalState.heldObject !== undefined;
        if (criteria.objectGrabbed !== hasGrabbed) {
          result.success = false;
          result.failedPhase = phase.name;
          result.error = criteria.objectGrabbed
            ? 'Failed to grab object'
            : 'Object should not be grabbed';
          break;
        }
      }

      if (criteria.objectReleased !== undefined) {
        const hasReleased = finalState.heldObject === undefined;
        if (criteria.objectReleased !== hasReleased) {
          result.success = false;
          result.failedPhase = phase.name;
          result.error = criteria.objectReleased
            ? 'Failed to release object'
            : 'Object should not be released';
          break;
        }
      }

      if (criteria.custom) {
        if (!criteria.custom(finalState)) {
          result.success = false;
          result.failedPhase = phase.name;
          result.error = 'Custom validation failed';
          break;
        }
      }
    }
  }

  result.finalState = finalState;
  return result;
}

/**
 * Create a simple single-primitive execution
 */
export async function executePrimitive(
  primitiveName: string,
  params: import('./types').ActionParams,
  state: RobotState
): Promise<{
  steps: import('../../types').JointSequenceStep[];
  phases: Phase[];
  description: string;
}> {
  const { getPrimitive } = await import('./composer');
  const primitive = getPrimitive(primitiveName);

  if (!primitive) {
    throw new Error(`Unknown primitive: ${primitiveName}`);
  }

  // Validate
  const validationError = primitive.validate(params, state);
  if (validationError) {
    throw new Error(validationError);
  }

  // Plan phases
  const phases = await primitive.plan(params, state);

  // Convert to steps
  const steps = phasesToSequenceSteps(phases);

  return {
    steps,
    phases,
    description: `${primitiveName}: ${primitive.description}`,
  };
}

/**
 * Generate a description of what the execution will do
 */
export function describeExecution(phases: Phase[]): string {
  const descriptions = phases
    .filter(p => p.description)
    .map(p => p.description!);

  if (descriptions.length === 0) {
    return 'Executing sequence...';
  }

  if (descriptions.length <= 3) {
    return descriptions.join(', then ');
  }

  // Summarize longer sequences
  return `${descriptions.slice(0, 2).join(', then ')}, and ${descriptions.length - 2} more steps`;
}
