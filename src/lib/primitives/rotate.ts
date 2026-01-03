/**
 * Rotate Action Primitive
 *
 * Rotates a held object or the wrist by a specified amount.
 */

import type { ActionPrimitive, ActionParams, Phase, RobotState, SuccessCriteria } from './types';
import { createLogger } from '../logger';

const log = createLogger('RotatePrimitive');

/**
 * Rotate primitive implementation
 */
export const RotatePrimitive: ActionPrimitive = {
  name: 'rotate',
  description: 'Rotate the wrist/held object by a specified amount',
  requiredParams: [],
  optionalParams: ['axis', 'degrees', 'speed', 'modifiers'],

  validate(params: ActionParams, state: RobotState): string | null {
    // Rotation is always valid as long as we have degrees
    if (!params.degrees && !params.modifiers?.length) {
      return 'Either degrees or a rotation modifier (e.g., "90 degrees", "twist") is required';
    }

    // Check joint limits for wristRoll
    const targetDegrees = params.degrees || 90;
    const currentWristRoll = state.joints.wristRoll ?? 0;
    const newWristRoll = currentWristRoll + targetDegrees;

    // wristRoll limits are typically -90 to 90
    if (newWristRoll < -90 || newWristRoll > 90) {
      return `Cannot rotate to ${newWristRoll}° - wristRoll limit is -90° to 90°`;
    }

    return null;
  },

  async plan(params: ActionParams, state: RobotState): Promise<Phase[]> {
    const speedMultiplier = params.speed || 1.0;

    // Parse rotation amount from degrees or modifiers
    let rotationDegrees = params.degrees || 90;

    // Check for rotation modifiers in natural language
    if (params.modifiers) {
      const modStr = params.modifiers.join(' ').toLowerCase();

      // Parse degrees from modifiers
      const degMatch = modStr.match(/(\d+)\s*(?:degrees?|°)/);
      if (degMatch) {
        rotationDegrees = parseInt(degMatch[1]);
      }

      // Handle directional modifiers
      if (modStr.includes('left') || modStr.includes('counter')) {
        rotationDegrees = -Math.abs(rotationDegrees);
      } else if (modStr.includes('right') || modStr.includes('clockwise')) {
        rotationDegrees = Math.abs(rotationDegrees);
      }

      // Handle special rotation terms
      if (modStr.includes('flip') || modStr.includes('turn over')) {
        rotationDegrees = 180;
      } else if (modStr.includes('quarter')) {
        rotationDegrees = 90;
      } else if (modStr.includes('half')) {
        rotationDegrees = 180;
      } else if (modStr.includes('twist') || modStr.includes('side')) {
        rotationDegrees = 90; // Default twist is 90 degrees
      }
    }

    // Determine which axis to rotate
    const axis = params.axis || 'roll';

    // Get current joint values
    const currentWristRoll = state.joints.wristRoll ?? 0;
    const currentWrist = state.joints.wrist ?? 0;
    const currentBase = state.joints.base ?? 0;

    let targetJoints: Partial<import('../../types').JointState> = {};
    let description = '';

    switch (axis) {
      case 'roll':
        // Rotate wrist roll (most common for object rotation)
        const newWristRoll = Math.max(-90, Math.min(90, currentWristRoll + rotationDegrees));
        targetJoints = { wristRoll: newWristRoll };
        description = `Rotate wrist roll ${rotationDegrees}° (${currentWristRoll}° → ${newWristRoll}°)`;
        break;

      case 'pitch':
        // Rotate wrist flex
        const newWrist = Math.max(-90, Math.min(90, currentWrist + rotationDegrees));
        targetJoints = { wrist: newWrist };
        description = `Rotate wrist ${rotationDegrees}° (${currentWrist}° → ${newWrist}°)`;
        break;

      case 'yaw':
        // Rotate base
        const newBase = Math.max(-110, Math.min(110, currentBase + rotationDegrees));
        targetJoints = { base: newBase };
        description = `Rotate base ${rotationDegrees}° (${currentBase}° → ${newBase}°)`;
        break;
    }

    log.info(description);

    // Calculate duration based on rotation amount
    const baseDuration = 500;
    const durationPerDegree = 5; // 5ms per degree
    const duration = Math.round((baseDuration + Math.abs(rotationDegrees) * durationPerDegree) / speedMultiplier);

    const phases: Phase[] = [
      {
        name: 'rotate',
        description,
        joints: {
          // Keep current position, only change rotation
          base: state.joints.base,
          shoulder: state.joints.shoulder,
          elbow: state.joints.elbow,
          wrist: state.joints.wrist,
          wristRoll: state.joints.wristRoll,
          gripper: state.joints.gripper,
          ...targetJoints,
        },
        duration,
      },
    ];

    // If rotating significantly (>45°), add a stabilization phase
    if (Math.abs(rotationDegrees) > 45) {
      phases.push({
        name: 'stabilize',
        description: 'Stabilize after rotation',
        joints: {
          base: state.joints.base,
          shoulder: state.joints.shoulder,
          elbow: state.joints.elbow,
          wrist: state.joints.wrist,
          wristRoll: state.joints.wristRoll,
          gripper: state.joints.gripper,
          ...targetJoints,
        },
        duration: 200,
      });
    }

    return phases;
  },

  getSuccessCriteria(): SuccessCriteria {
    return {
      // Rotation is always successful if we reach the target
    };
  },
};
