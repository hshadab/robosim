/**
 * Place Action Primitive
 *
 * Places a held object at a target position or on another object.
 */

import type { ActionPrimitive, ActionParams, Phase, RobotState, SuccessCriteria } from './types';
import { findObject, calculateIK } from './utils';
import { createLogger } from '../logger';

const log = createLogger('PlacePrimitive');

/**
 * Place primitive implementation
 */
export const PlacePrimitive: ActionPrimitive = {
  name: 'place',
  description: 'Place a held object at a position or on another object',
  requiredParams: [], // Either position or targetObject
  optionalParams: ['position', 'targetObject', 'speed'],

  validate(params: ActionParams, state: RobotState): string | null {
    if (!state.heldObject) {
      return 'Not holding any object. Pick up an object first.';
    }

    if (!params.position && !params.targetObject) {
      return 'Either position or targetObject is required';
    }

    if (params.targetObject) {
      const target = findObject(state.objects, params.targetObject, true);
      if (!target) {
        return `Target object "${params.targetObject}" not found in scene`;
      }
      if (target.isGrabbed) {
        return `Cannot place on "${target.name}" - it is currently grabbed`;
      }
    }

    return null;
  },

  async plan(params: ActionParams, state: RobotState): Promise<Phase[]> {
    let targetX: number, targetY: number, targetZ: number;
    let targetDescription: string;
    const speedMultiplier = params.speed || 1.0;

    // Get current wristRoll from held object (maintain orientation)
    const currentWristRoll = state.joints.wristRoll ?? 90;

    if (params.targetObject) {
      // Place on another object (stacking)
      const target = findObject(state.objects, params.targetObject, true);
      if (!target) {
        throw new Error(`Target object "${params.targetObject}" not found`);
      }

      targetX = target.position[0];
      targetZ = target.position[2];
      // Place on top of target object
      targetY = target.position[1] + target.scale + 0.02; // 2cm above top
      targetDescription = `on ${target.name}`;

      log.info(`Planning place on "${target.name}" at [${(targetX*100).toFixed(1)}, ${(targetY*100).toFixed(1)}, ${(targetZ*100).toFixed(1)}]cm`);
    } else if (params.position) {
      // Place at specific position
      [targetX, targetY, targetZ] = params.position;
      targetDescription = `at [${(targetX*100).toFixed(0)}, ${(targetY*100).toFixed(0)}, ${(targetZ*100).toFixed(0)}]cm`;

      log.info(`Planning place at position [${(targetX*100).toFixed(1)}, ${(targetY*100).toFixed(1)}, ${(targetZ*100).toFixed(1)}]cm`);
    } else {
      throw new Error('Either position or targetObject is required');
    }

    // Calculate approach height (above target)
    const approachY = targetY + 0.08; // 8cm above target

    // Phase 1: Move above target
    const approachIK = await calculateIK(targetX, approachY, targetZ, state.joints);
    if (!approachIK) {
      throw new Error(`Cannot calculate approach position above target`);
    }

    // Phase 2: Lower to place position
    const placeIK = await calculateIK(targetX, targetY, targetZ, state.joints);
    if (!placeIK) {
      throw new Error(`Cannot calculate place position`);
    }

    // Phase 3: Retreat position
    const retreatY = targetY + 0.10; // 10cm above after release
    const retreatIK = await calculateIK(targetX, retreatY, targetZ, state.joints);
    if (!retreatIK) {
      throw new Error(`Cannot calculate retreat position`);
    }

    const phases: Phase[] = [
      {
        name: 'approach',
        description: `Move above target ${targetDescription}`,
        joints: {
          ...approachIK.joints,
          wristRoll: currentWristRoll,
          gripper: 0, // Keep gripper closed
        },
        duration: Math.round(800 / speedMultiplier),
      },
      {
        name: 'lower',
        description: `Lower to place position ${targetDescription}`,
        joints: {
          ...placeIK.joints,
          wristRoll: currentWristRoll,
          gripper: 0, // Keep gripper closed
        },
        duration: Math.round(600 / speedMultiplier),
      },
      {
        name: 'release',
        description: 'Open gripper to release object',
        joints: {
          gripper: 100, // Open gripper
        },
        duration: 600,
        flags: {
          gripperOnly: true,
        },
        successCriteria: {
          objectReleased: true,
        },
      },
      {
        name: 'settle',
        description: 'Wait for object to settle',
        joints: {
          ...placeIK.joints,
          wristRoll: currentWristRoll,
          gripper: 100,
        },
        duration: 400,
      },
      {
        name: 'retreat',
        description: 'Move away from placed object',
        joints: {
          ...retreatIK.joints,
          wristRoll: currentWristRoll,
          gripper: 100,
        },
        duration: Math.round(500 / speedMultiplier),
      },
    ];

    return phases;
  },

  getSuccessCriteria(): SuccessCriteria {
    return {
      objectReleased: true,
    };
  },
};
