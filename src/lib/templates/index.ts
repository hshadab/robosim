/**
 * Parameterized Task Templates
 *
 * This module provides configurable task templates with randomizable parameters
 * for generating diverse training data.
 *
 * For backwards compatibility, the main taskTemplates.ts re-exports from here.
 */

// Re-export types
export type {
  TaskParameter,
  ParameterizedWaypoint,
  ParameterizedTaskTemplate,
  ResolvedTaskTemplate,
} from './types';

// Re-export parameters
export { DEFAULT_PARAMETERS } from './parameters';

// Re-export utilities
export {
  randomizeParameter,
  safeEvaluateExpression,
  resolveParameterValue,
  resolveWaypoint,
  resolveTaskTemplate,
  generateTaskVariations,
  getDefaultParameterValues,
  validateTemplate,
} from './utils';

// Note: PARAMETERIZED_TEMPLATES is defined in the main taskTemplates.ts file
// as it contains large data structures that are best kept together.
// New templates can be added to separate files and imported here.
