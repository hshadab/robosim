/**
 * Utility functions for task templates
 */

import type { JointState } from '../../types';
import type { TaskParameter, ParameterizedWaypoint, ParameterizedTaskTemplate, ResolvedTaskTemplate } from './types';

/**
 * Generate a random value within parameter range
 */
export function randomizeParameter(param: TaskParameter): number {
  if (!param.randomize) {
    return param.defaultValue;
  }
  return param.min + Math.random() * (param.max - param.min);
}

/**
 * Safe arithmetic expression evaluator
 * Handles basic math operations without using eval/Function
 */
export function safeEvaluateExpression(expression: string): number {
  // Tokenize: split into numbers and operators
  const tokens: (number | string)[] = [];
  let current = '';

  for (const char of expression) {
    if ('+-*/()'.includes(char)) {
      if (current.trim()) {
        tokens.push(parseFloat(current.trim()));
        current = '';
      }
      tokens.push(char);
    } else if (char !== ' ') {
      current += char;
    }
  }
  if (current.trim()) {
    tokens.push(parseFloat(current.trim()));
  }

  // Simple recursive descent parser for basic arithmetic
  let pos = 0;

  function parseExpression(): number {
    let left = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    if (tokens[pos] === '(') {
      pos++; // skip '('
      const result = parseExpression();
      pos++; // skip ')'
      return result;
    }
    // Handle negative numbers
    if (tokens[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    return tokens[pos++] as number;
  }

  return parseExpression();
}

/**
 * Resolve a parameter reference string like "${pickBaseAngle}"
 * Also handles simple expressions like "${sweepStart * 0.5 + sweepEnd * 0.5}"
 */
export function resolveParameterValue(
  value: number | string,
  paramValues: Record<string, number>
): number {
  if (typeof value === 'number') {
    return value;
  }

  // Extract expression from ${...}
  const match = value.match(/^\$\{(.+)\}$/);
  if (!match) {
    return parseFloat(value) || 0;
  }

  const expression = match[1];

  // Simple parameter reference
  if (paramValues[expression] !== undefined) {
    return paramValues[expression];
  }

  // Handle simple arithmetic expressions
  // Replace parameter names with values
  let evalExpression = expression;
  for (const [name, val] of Object.entries(paramValues)) {
    evalExpression = evalExpression.replace(new RegExp(name, 'g'), val.toString());
  }

  // Safe evaluation using our custom parser
  try {
    // Only allow numbers, operators, parentheses, spaces, and decimal points
    if (/^[\d\s+\-*/.()]+$/.test(evalExpression)) {
      return safeEvaluateExpression(evalExpression);
    }
  } catch {
    console.warn(`Failed to evaluate expression: ${expression}`);
  }

  return 0;
}

/**
 * Resolve a parameterized waypoint to concrete joint values
 */
export function resolveWaypoint(
  waypoint: ParameterizedWaypoint,
  paramValues: Record<string, number>
): JointState {
  return {
    base: resolveParameterValue(waypoint.joints.base, paramValues),
    shoulder: resolveParameterValue(waypoint.joints.shoulder, paramValues),
    elbow: resolveParameterValue(waypoint.joints.elbow, paramValues),
    wrist: resolveParameterValue(waypoint.joints.wrist, paramValues),
    wristRoll: resolveParameterValue(waypoint.joints.wristRoll, paramValues),
    gripper: resolveParameterValue(waypoint.joints.gripper, paramValues),
  };
}

/**
 * Resolve a full task template with given or randomized parameters
 */
export function resolveTaskTemplate(
  template: ParameterizedTaskTemplate,
  customValues?: Partial<Record<string, number>>
): ResolvedTaskTemplate {
  // Generate parameter values (randomized or custom)
  const paramValues: Record<string, number> = {};
  for (const param of template.parameters) {
    if (customValues && customValues[param.name] !== undefined) {
      paramValues[param.name] = customValues[param.name]!;
    } else {
      paramValues[param.name] = randomizeParameter(param);
    }
  }

  // Get movement speed for duration scaling
  const speedMultiplier = paramValues.movementSpeed || 1.0;

  // Resolve waypoints
  const waypoints = template.waypoints.map((wp) => resolveWaypoint(wp, paramValues));
  const durations = template.waypoints.map((wp) => (wp.duration || 0.5) / speedMultiplier);

  return {
    id: template.id,
    name: template.name,
    waypoints,
    durations,
    parameterValues: paramValues,
  };
}

/**
 * Generate multiple variations of a task template
 */
export function generateTaskVariations(
  template: ParameterizedTaskTemplate,
  count: number
): ResolvedTaskTemplate[] {
  const variations: ResolvedTaskTemplate[] = [];
  for (let i = 0; i < count; i++) {
    variations.push(resolveTaskTemplate(template));
  }
  return variations;
}

/**
 * Get default parameter values (no randomization)
 */
export function getDefaultParameterValues(
  template: ParameterizedTaskTemplate
): Record<string, number> {
  const values: Record<string, number> = {};
  for (const param of template.parameters) {
    values[param.name] = param.defaultValue;
  }
  return values;
}

/**
 * Validate that all parameter references in waypoints are defined
 */
export function validateTemplate(template: ParameterizedTaskTemplate): string[] {
  const errors: string[] = [];
  const paramNames = new Set(template.parameters.map((p) => p.name));

  for (const waypoint of template.waypoints) {
    for (const [joint, value] of Object.entries(waypoint.joints)) {
      if (typeof value === 'string') {
        const match = value.match(/\$\{([^}]+)\}/g);
        if (match) {
          for (const ref of match) {
            const paramName = ref.slice(2, -1).split(/[+\-*/\s]/)[0].trim();
            if (!paramNames.has(paramName) && !/^\d+$/.test(paramName)) {
              errors.push(`Waypoint "${waypoint.name}" joint "${joint}" references undefined parameter "${paramName}"`);
            }
          }
        }
      }
    }
  }

  return errors;
}
