/**
 * Pick Action Primitive
 *
 * Picks up an object from the scene. Generates approach, grasp, and lift phases.
 */

import type { ActionPrimitive, ActionParams, Phase, RobotState, SuccessCriteria } from './types';
import { findObject, calculateIK } from './utils';
import { createLogger } from '../logger';

const log = createLogger('PickPrimitive');

/**
 * Pick primitive implementation
 */
export const PickPrimitive: ActionPrimitive = {
  name: 'pick',
  description: 'Pick up an object from the scene',
  requiredParams: ['object'],
  optionalParams: ['speed', 'height'],

  validate(params: ActionParams, state: RobotState): string | null {
    if (!params.object) {
      return 'Object parameter is required';
    }

    const obj = findObject(state.objects, params.object);
    if (!obj) {
      return `Object "${params.object}" not found in scene`;
    }

    if (obj.isGrabbed) {
      return `Object "${obj.name}" is already grabbed`;
    }

    if (state.heldObject) {
      return `Already holding an object. Release it first.`;
    }

    return null;
  },

  async plan(params: ActionParams, state: RobotState): Promise<Phase[]> {
    const obj = findObject(state.objects, params.object!);
    if (!obj) {
      throw new Error(`Object "${params.object}" not found`);
    }

    const [objX, objY, objZ] = obj.position;
    const objScale = obj.scale;
    const speedMultiplier = params.speed || 1.0;

    log.info(`Planning pick for "${obj.name}" at [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);

    // Determine grasp parameters based on object type
    const isHorizontalGrasp = obj.type === 'cylinder';
    const wristRoll = isHorizontalGrasp ? 0 : 90; // 0 for horizontal, 90 for vertical

    // Calculate grasp height (slightly above object center for cubes, 1/3 height for cylinders)
    const graspHeightOffset = obj.type === 'cylinder' ? objScale * 0.33 : objScale * 0.5;
    const graspY = objY + graspHeightOffset;

    // Calculate approach height (above grasp position)
    const approachY = graspY + 0.08; // 8cm above grasp

    // Calculate lift height
    const liftY = params.height || (graspY + 0.15); // 15cm above grasp by default

    // Phase 1: Approach - move above the object
    const approachIK = await calculateIK(objX, approachY, objZ, state.joints);
    if (!approachIK) {
      throw new Error(`Cannot calculate approach position for object at [${objX}, ${approachY}, ${objZ}]`);
    }

    // Phase 2: Lower to grasp position
    const graspIK = await calculateIK(objX, graspY, objZ, state.joints);
    if (!graspIK) {
      throw new Error(`Cannot calculate grasp position for object at [${objX}, ${graspY}, ${objZ}]`);
    }

    // Phase 3: Lift position
    const liftIK = await calculateIK(objX, liftY, objZ, state.joints);
    if (!liftIK) {
      throw new Error(`Cannot calculate lift position at height ${liftY}`);
    }

    const phases: Phase[] = [
      {
        name: 'approach',
        description: `Move above ${obj.name}`,
        joints: {
          ...approachIK.joints,
          wristRoll,
          gripper: 100, // Open gripper
        },
        duration: Math.round(800 / speedMultiplier),
        successCriteria: {
          positionTolerance: 0.05, // 5cm tolerance
        },
      },
      {
        name: 'lower',
        description: `Lower to grasp ${obj.name}`,
        joints: {
          ...graspIK.joints,
          wristRoll,
          gripper: 100, // Keep gripper open
        },
        duration: Math.round(600 / speedMultiplier),
        successCriteria: {
          positionTolerance: 0.02, // 2cm tolerance
        },
      },
      {
        name: 'grasp',
        description: `Close gripper on ${obj.name}`,
        joints: {
          gripper: 0, // Close gripper
        },
        duration: 800, // Fixed timing for physics contact detection
        flags: {
          gripperOnly: true,
          waitForContact: true,
        },
        successCriteria: {
          objectGrabbed: true,
        },
        retryable: true,
        maxRetries: 2,
      },
      {
        name: 'hold',
        description: 'Secure grip',
        joints: {
          ...graspIK.joints,
          wristRoll,
          gripper: 0,
        },
        duration: 400, // Wait for physics to settle
      },
      {
        name: 'lift',
        description: `Lift ${obj.name}`,
        joints: {
          ...liftIK.joints,
          wristRoll,
          gripper: 0, // Keep gripper closed
        },
        duration: Math.round(700 / speedMultiplier),
        successCriteria: {
          objectGrabbed: true,
        },
      },
    ];

    // Log IK errors for debugging
    log.debug(`IK errors - approach: ${(approachIK.error * 100).toFixed(1)}cm, grasp: ${(graspIK.error * 100).toFixed(1)}cm, lift: ${(liftIK.error * 100).toFixed(1)}cm`);

    return phases;
  },

  getSuccessCriteria(): SuccessCriteria {
    return {
      objectGrabbed: true,
    };
  },
};
