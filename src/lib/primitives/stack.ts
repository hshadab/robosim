/**
 * Stack Action Primitive
 *
 * Composite primitive that picks up one object and places it on another.
 * This demonstrates how primitives can be composed.
 */

import type { ActionPrimitive, ActionParams, Phase, RobotState, SuccessCriteria } from './types';
import { findObject } from './utils';
import { PickPrimitive } from './pick';
import { PlacePrimitive } from './place';
import { createLogger } from '../logger';

const log = createLogger('StackPrimitive');

/**
 * Stack primitive implementation
 */
export const StackPrimitive: ActionPrimitive = {
  name: 'stack',
  description: 'Pick up one object and place it on top of another',
  requiredParams: ['object', 'targetObject'],
  optionalParams: ['speed'],

  validate(params: ActionParams, state: RobotState): string | null {
    if (!params.object) {
      return 'Object to pick up is required';
    }
    if (!params.targetObject) {
      return 'Target object to stack on is required';
    }

    const pickObj = findObject(state.objects, params.object);
    if (!pickObj) {
      return `Object "${params.object}" not found in scene`;
    }

    const targetObj = findObject(state.objects, params.targetObject);
    if (!targetObj) {
      return `Target object "${params.targetObject}" not found in scene`;
    }

    if (pickObj.id === targetObj.id) {
      return 'Cannot stack an object on itself';
    }

    if (pickObj.isGrabbed) {
      return `Object "${pickObj.name}" is already grabbed`;
    }

    if (targetObj.isGrabbed) {
      return `Cannot stack on "${targetObj.name}" - it is currently grabbed`;
    }

    return null;
  },

  async plan(params: ActionParams, state: RobotState): Promise<Phase[]> {
    const pickObj = findObject(state.objects, params.object!);
    const targetObj = findObject(state.objects, params.targetObject!);

    if (!pickObj || !targetObj) {
      throw new Error('Objects not found');
    }

    log.info(`Planning stack: pick "${pickObj.name}" and place on "${targetObj.name}"`);

    // Phase 1: Pick up the object
    const pickParams: ActionParams = {
      object: params.object,
      speed: params.speed,
    };

    const pickPhases = await PickPrimitive.plan(pickParams, state);

    // Create intermediate state after pick (simulate that we now hold the object)
    const stateAfterPick: RobotState = {
      ...state,
      heldObject: pickObj.id,
    };

    // Phase 2: Place on target object
    const placeParams: ActionParams = {
      targetObject: params.targetObject,
      speed: params.speed,
    };

    const placePhases = await PlacePrimitive.plan(placeParams, stateAfterPick);

    // Combine phases with prefixes for clarity
    const allPhases: Phase[] = [
      ...pickPhases.map(p => ({
        ...p,
        name: `pick_${p.name}`,
        description: `[Pick] ${p.description}`,
      })),
      ...placePhases.map(p => ({
        ...p,
        name: `place_${p.name}`,
        description: `[Place] ${p.description}`,
      })),
    ];

    log.debug(`Stack sequence has ${allPhases.length} phases total`);

    return allPhases;
  },

  getSuccessCriteria(): SuccessCriteria {
    return {
      objectReleased: true,
    };
  },
};
