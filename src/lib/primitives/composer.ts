/**
 * Sequence Composer
 *
 * Composes multiple action primitives into executable sequences.
 * Handles task decomposition from natural language commands.
 */

import type {
  ActionPrimitive,
  ActionParams,
  Phase,
  RobotState,
  ComposedSequence,
  TaskDecomposition,
  PrimitiveRegistry,
} from './types';
import { findObject, OBJECT_COLORS } from './utils';
import { PickPrimitive } from './pick';
import { PlacePrimitive } from './place';
import { RotatePrimitive } from './rotate';
import { MovePrimitive } from './move';
import { StackPrimitive } from './stack';
import { createLogger } from '../logger';

const log = createLogger('Composer');

/**
 * Registry of all available primitives
 */
export const primitiveRegistry: PrimitiveRegistry = new Map([
  ['pick', PickPrimitive],
  ['place', PlacePrimitive],
  ['rotate', RotatePrimitive],
  ['move', MovePrimitive],
  ['stack', StackPrimitive],
]);

/**
 * Get a primitive by name
 */
export function getPrimitive(name: string): ActionPrimitive | undefined {
  return primitiveRegistry.get(name.toLowerCase());
}


/**
 * Parse a natural language command into a sequence of primitives
 */
export function decomposeCommand(
  command: string,
  state: RobotState
): TaskDecomposition {
  const lower = command.toLowerCase();
  const steps: { primitive: string; params: ActionParams }[] = [];

  log.info(`Decomposing command: "${command}"`);

  // Split command by conjunctions
  const parts = lower.split(/\s*(?:,|and|then|after that|next)\s*/);

  for (const part of parts) {
    if (!part.trim()) continue;

    const step = parseCommandPart(part.trim(), state);
    if (step) {
      steps.push(step);
    }
  }

  if (steps.length === 0) {
    return {
      success: false,
      error: `Could not understand command: "${command}"`,
    };
  }

  // Calculate estimated duration (rough estimate)
  const estimatedDuration = steps.length * 3000; // ~3s per step

  // Get all involved objects
  const involvedObjects = new Set<string>();
  for (const step of steps) {
    if (step.params.object) {
      const obj = findObject(state.objects, step.params.object);
      if (obj) involvedObjects.add(obj.name);
    }
    if (step.params.targetObject) {
      const obj = findObject(state.objects, step.params.targetObject);
      if (obj) involvedObjects.add(obj.name);
    }
  }

  const sequence: ComposedSequence = {
    id: `seq_${Date.now()}`,
    description: command,
    originalCommand: command,
    steps,
    estimatedDuration,
    involvedObjects: Array.from(involvedObjects),
  };

  log.info(`Decomposed into ${steps.length} steps: ${steps.map(s => s.primitive).join(' → ')}`);

  return {
    success: true,
    sequence,
    confidence: 0.8, // TODO: Calculate actual confidence
  };
}

/**
 * Parse a single command part into a primitive step
 */
function parseCommandPart(
  part: string,
  state: RobotState
): { primitive: string; params: ActionParams } | null {
  // Extract object references from the command
  const objects = state.objects.map(o => o.name.toLowerCase());

  // Find object mentions in the part
  let primaryObject: string | undefined;
  let targetObject: string | undefined;

  // Check for "on", "onto", "on top of" pattern for target
  const onMatch = part.match(/(?:on|onto|on top of)\s+(?:the\s+)?(\w+(?:\s+\w+)?)/);
  if (onMatch) {
    const targetRef = onMatch[1];
    const obj = findObject(state.objects, targetRef);
    if (obj) {
      targetObject = obj.name;
    }
  }

  // Find primary object (first object reference that isn't the target)
  for (const objName of objects) {
    if (part.includes(objName.toLowerCase()) && objName !== targetObject) {
      primaryObject = objName;
      break;
    }
  }

  // Also check for color references
  if (!primaryObject) {
    for (const color of OBJECT_COLORS) {
      if (part.includes(color)) {
        const obj = state.objects.find(o => o.name.toLowerCase().includes(color));
        if (obj && obj.name !== targetObject) {
          primaryObject = obj.name;
          break;
        }
      }
    }
  }

  // Parse degrees for rotation
  let degrees: number | undefined;
  const degMatch = part.match(/(\d+)\s*(?:degrees?|°)/);
  if (degMatch) {
    degrees = parseInt(degMatch[1]);
  }

  // Determine primitive based on keywords
  // Stack/place on
  if ((part.includes('stack') || (part.includes('place') && part.includes('on'))) && targetObject) {
    if (primaryObject) {
      return {
        primitive: 'stack',
        params: { object: primaryObject, targetObject },
      };
    } else if (state.heldObject) {
      return {
        primitive: 'place',
        params: { targetObject },
      };
    }
  }

  // Pick up / grab
  if (part.includes('pick') || part.includes('grab') || part.includes('get') || part.includes('take')) {
    if (primaryObject) {
      return {
        primitive: 'pick',
        params: { object: primaryObject },
      };
    }
  }

  // Place / put down
  if (part.includes('place') || part.includes('put down') || part.includes('drop') || part.includes('release')) {
    if (targetObject) {
      return {
        primitive: 'place',
        params: { targetObject },
      };
    }
    // If no target, place at current position
    return {
      primitive: 'place',
      params: { position: state.gripperWorldPosition },
    };
  }

  // Rotate / twist / turn / flip
  if (part.includes('rotate') || part.includes('twist') || part.includes('turn') || part.includes('flip')) {
    // Determine axis
    let axis: 'roll' | 'pitch' | 'yaw' = 'roll';
    if (part.includes('side') || part.includes('horizontal')) {
      axis = 'roll';
    }

    return {
      primitive: 'rotate',
      params: {
        axis,
        degrees: degrees || 90,
        modifiers: [part],
      },
    };
  }

  // Move / go
  if (part.includes('move') || part.includes('go')) {
    // Parse direction
    const directions = ['left', 'right', 'forward', 'back', 'up', 'down'];
    const modifiers: string[] = [];

    for (const dir of directions) {
      if (part.includes(dir)) {
        modifiers.push(dir);
      }
    }

    if (primaryObject) {
      return {
        primitive: 'move',
        params: { object: primaryObject },
      };
    }

    if (modifiers.length > 0) {
      return {
        primitive: 'move',
        params: { modifiers },
      };
    }
  }

  // Lift / raise
  if (part.includes('lift') || part.includes('raise')) {
    let height = 0.15; // Default 15cm
    const heightMatch = part.match(/(\d+)\s*(?:cm|centimeters?)/);
    if (heightMatch) {
      height = parseInt(heightMatch[1]) / 100;
    }
    if (part.includes('high')) {
      height = 0.25;
    }

    return {
      primitive: 'move',
      params: { modifiers: ['up'], height },
    };
  }

  log.warn(`Could not parse command part: "${part}"`);
  return null;
}

/**
 * Plan all phases for a composed sequence
 */
export async function planSequence(
  sequence: ComposedSequence,
  initialState: RobotState
): Promise<Phase[]> {
  const allPhases: Phase[] = [];
  let currentState = { ...initialState };

  for (let i = 0; i < sequence.steps.length; i++) {
    const step = sequence.steps[i];
    const primitive = getPrimitive(step.primitive);

    if (!primitive) {
      throw new Error(`Unknown primitive: ${step.primitive}`);
    }

    // Validate the step
    const validationError = primitive.validate(step.params, currentState);
    if (validationError) {
      throw new Error(`Step ${i + 1} (${step.primitive}): ${validationError}`);
    }

    // Plan the step
    const phases = await primitive.plan(step.params, currentState);
    step.phases = phases;

    // Add step prefix to phase names
    const prefixedPhases = phases.map(p => ({
      ...p,
      name: `step${i + 1}_${p.name}`,
      description: `[Step ${i + 1}: ${step.primitive}] ${p.description}`,
    }));

    allPhases.push(...prefixedPhases);

    // Update state for next step (simulate state changes)
    if (step.primitive === 'pick') {
      const obj = findObject(currentState.objects, step.params.object!);
      if (obj) {
        currentState = {
          ...currentState,
          heldObject: obj.id,
        };
      }
    } else if (step.primitive === 'place' || step.primitive === 'stack') {
      currentState = {
        ...currentState,
        heldObject: undefined,
      };
    }
  }

  log.info(`Planned sequence with ${allPhases.length} total phases`);
  return allPhases;
}
