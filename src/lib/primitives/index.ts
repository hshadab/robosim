/**
 * Action Primitives Module
 *
 * Provides composable robot action primitives for multi-step tasks.
 *
 * Usage:
 *   import { decomposeCommand, executeSequence } from './primitives';
 *
 *   const decomposition = decomposeCommand("pick up the cube, twist it, place on blue", state);
 *   if (decomposition.success) {
 *     const { steps, phases } = await executeSequence(decomposition.sequence, state);
 *     // Pass steps to executeArmSequence()
 *   }
 */

// Types
export type {
  ActionPrimitive,
  ActionParams,
  Phase,
  RobotState,
  SceneObject,
  SuccessCriteria,
  PrimitiveResult,
  ComposedSequence,
  TaskDecomposition,
  ExecutionOptions,
  PrimitiveRegistry,
} from './types';

// Utilities
export { findObject, calculateIK, OBJECT_COLORS, DEFAULT_JOINTS } from './utils';

// Primitives
export { PickPrimitive } from './pick';
export { PlacePrimitive } from './place';
export { RotatePrimitive } from './rotate';
export { MovePrimitive } from './move';
export { StackPrimitive } from './stack';

// Composer
export {
  primitiveRegistry,
  getPrimitive,
  decomposeCommand,
  planSequence,
} from './composer';

// Executor
export {
  phasesToSequenceSteps,
  executeSequence,
  executePrimitive,
  validateResult,
  describeExecution,
} from './executor';
