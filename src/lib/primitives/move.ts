/**
 * Move Action Primitive
 *
 * Moves the gripper to a target position or relative offset.
 */

import type { ActionPrimitive, ActionParams, Phase, RobotState, SuccessCriteria } from './types';
import { findObject, calculateIK } from './utils';
import { createLogger } from '../logger';

const log = createLogger('MovePrimitive');

/**
 * Move primitive implementation
 */
export const MovePrimitive: ActionPrimitive = {
  name: 'move',
  description: 'Move the gripper to a target position',
  requiredParams: [], // Either position or object
  optionalParams: ['position', 'object', 'speed', 'height', 'modifiers'],

  validate(params: ActionParams, state: RobotState): string | null {
    if (!params.position && !params.object && !params.modifiers?.length) {
      return 'Either position, object, or direction modifier is required';
    }

    if (params.object) {
      const obj = findObject(state.objects, params.object);
      if (!obj) {
        return `Object "${params.object}" not found in scene`;
      }
    }

    return null;
  },

  async plan(params: ActionParams, state: RobotState): Promise<Phase[]> {
    const speedMultiplier = params.speed || 1.0;
    let targetX: number, targetY: number, targetZ: number;
    let description: string;

    // Current gripper position
    const [currentX, currentY, currentZ] = state.gripperWorldPosition;

    // Get current gripper and wrist state
    const currentGripper = state.joints.gripper ?? 100;
    const currentWristRoll = state.joints.wristRoll ?? 90;

    if (params.position) {
      // Move to absolute position
      [targetX, targetY, targetZ] = params.position;
      description = `Move to [${(targetX*100).toFixed(0)}, ${(targetY*100).toFixed(0)}, ${(targetZ*100).toFixed(0)}]cm`;
    } else if (params.object) {
      // Move to object position (above it)
      const obj = findObject(state.objects, params.object);
      if (!obj) {
        throw new Error(`Object "${params.object}" not found`);
      }
      targetX = obj.position[0];
      targetZ = obj.position[2];
      targetY = obj.position[1] + obj.scale + 0.05; // 5cm above object
      description = `Move to ${obj.name}`;
    } else if (params.modifiers?.length) {
      // Parse relative movement from modifiers
      const modStr = params.modifiers.join(' ').toLowerCase();
      const amount = params.height || 0.05; // Default 5cm movement

      targetX = currentX;
      targetY = currentY;
      targetZ = currentZ;

      if (modStr.includes('left')) {
        targetX += amount; // +X is left in the coordinate system
        description = `Move left ${(amount*100).toFixed(0)}cm`;
      } else if (modStr.includes('right')) {
        targetX -= amount;
        description = `Move right ${(amount*100).toFixed(0)}cm`;
      } else if (modStr.includes('forward') || modStr.includes('front')) {
        targetZ += amount;
        description = `Move forward ${(amount*100).toFixed(0)}cm`;
      } else if (modStr.includes('back') || modStr.includes('backward')) {
        targetZ -= amount;
        description = `Move back ${(amount*100).toFixed(0)}cm`;
      } else if (modStr.includes('up') || modStr.includes('higher')) {
        targetY += amount;
        description = `Move up ${(amount*100).toFixed(0)}cm`;
      } else if (modStr.includes('down') || modStr.includes('lower')) {
        targetY -= amount;
        description = `Move down ${(amount*100).toFixed(0)}cm`;
      } else {
        throw new Error(`Unknown movement direction in: ${modStr}`);
      }
    } else {
      throw new Error('Either position, object, or direction modifier is required');
    }

    // Apply height override if specified
    if (params.height && params.position) {
      targetY = params.height;
    }

    log.info(`${description} from [${(currentX*100).toFixed(1)}, ${(currentY*100).toFixed(1)}, ${(currentZ*100).toFixed(1)}]cm`);

    // Calculate IK for target position
    const targetIK = await calculateIK(targetX, targetY, targetZ, state.joints);
    if (!targetIK) {
      throw new Error(`Cannot reach target position [${(targetX*100).toFixed(0)}, ${(targetY*100).toFixed(0)}, ${(targetZ*100).toFixed(0)}]cm`);
    }

    // Calculate distance for duration
    const distance = Math.sqrt(
      Math.pow(targetX - currentX, 2) +
      Math.pow(targetY - currentY, 2) +
      Math.pow(targetZ - currentZ, 2)
    );

    // Base duration + distance-based duration
    const baseDuration = 400;
    const durationPerCm = 30; // 30ms per cm
    const duration = Math.round((baseDuration + distance * 100 * durationPerCm) / speedMultiplier);

    const phases: Phase[] = [
      {
        name: 'move',
        description,
        joints: {
          ...targetIK.joints,
          wristRoll: currentWristRoll,
          gripper: currentGripper,
        },
        duration: Math.max(300, Math.min(2000, duration)), // Clamp to reasonable range
        successCriteria: {
          positionTolerance: 0.03, // 3cm tolerance
        },
      },
    ];

    return phases;
  },

  getSuccessCriteria(): SuccessCriteria {
    return {
      positionTolerance: 0.03,
    };
  },
};
