/**
 * Stack and Move Handlers
 *
 * Handles stack on, place on, and move to commands for the SO-101 robot arm.
 * Extracted from claudeApi.ts for better modularity.
 */

import type { JointState, SimObject } from '../../types';
import type { ClaudeResponse } from './types';
import { loggers } from '../logger';
import { calculateInverseKinematics } from '../../components/simulation/SO101Kinematics';
import { matchObjectToMessage } from './objectMatching';
import { calculateBaseAngleForPosition } from './ikCalculations';

const log = loggers.claude;

/**
 * Find an object by name, color, or type from a message
 */
export function findObjectByDescription(message: string, objects: SimObject[]): SimObject | null {
  for (const obj of objects) {
    const matchResult = matchObjectToMessage(obj, message);
    if (matchResult.match) {
      return obj;
    }
  }
  return null;
}

/**
 * Handle "stack on" / "place on top of" commands
 */
export function handleStackCommand(
  message: string,
  objects: SimObject[],
  heldObject: SimObject | undefined,
  state: JointState
): ClaudeResponse {
  // Must be holding something to stack
  if (!heldObject) {
    return {
      action: 'explain',
      description: "I need to be holding an object to stack it. Say 'pick up' first.",
    };
  }

  // Find the target object to stack on
  const targetSearch = message
    .replace(/stack|place|put|on top of|on|the/gi, '')
    .trim()
    .toLowerCase();

  const targetObject = findObjectByDescription(targetSearch, objects.filter(o => o !== heldObject));

  if (!targetObject) {
    return {
      action: 'explain',
      description: `I couldn't find "${targetSearch}" to stack on. Available objects: ${objects.filter(o => o !== heldObject).map(o => o.name || o.id).join(', ')}`,
    };
  }

  const [targetX, targetY, targetZ] = targetObject.position;
  const targetName = targetObject.name || targetObject.id;
  const heldName = heldObject.name || heldObject.id;

  // Estimate target object height (default 0.05m if not specified)
  const targetHeight = (targetObject as { dimensions?: [number, number, number] }).dimensions?.[1] || 0.05;
  const stackHeight = targetY + targetHeight + 0.03; // Place 3cm above target object top

  log.debug(`[handleStackCommand] Stack "${heldName}" on "${targetName}" at height ${stackHeight.toFixed(3)}m`);

  // Calculate IK for approach (above the stack position)
  const approachHeight = stackHeight + 0.08;
  const approachIK = calculateInverseKinematics(targetX, approachHeight, targetZ, state);

  // Calculate IK for place position
  const placeIK = calculateInverseKinematics(targetX, stackHeight, targetZ, state);

  // Calculate IK for retreat (lift back up)
  const retreatHeight = stackHeight + 0.1;
  const retreatIK = calculateInverseKinematics(targetX, retreatHeight, targetZ, state);

  if (approachIK && placeIK && retreatIK) {
    log.debug(`[handleStackCommand] IK success for stacking at [${targetX.toFixed(3)}, ${stackHeight.toFixed(3)}, ${targetZ.toFixed(3)}]`);
    return {
      action: 'sequence',
      joints: [
        { base: approachIK.base, shoulder: approachIK.shoulder, elbow: approachIK.elbow, wrist: approachIK.wrist },
        { base: placeIK.base, shoulder: placeIK.shoulder, elbow: placeIK.elbow, wrist: placeIK.wrist },
        { gripper: 100 }, // Release
        { base: retreatIK.base, shoulder: retreatIK.shoulder, elbow: retreatIK.elbow, wrist: retreatIK.wrist },
      ],
      description: `Stacking "${heldName}" on top of "${targetName}" at height ${stackHeight.toFixed(2)}m using IK`,
      code: `// Stack "${heldName}" on "${targetName}"
await moveJoints({ base: ${approachIK.base.toFixed(1)}, shoulder: ${approachIK.shoulder.toFixed(1)}, elbow: ${approachIK.elbow.toFixed(1)}, wrist: ${approachIK.wrist.toFixed(1)} }); // Approach
await moveJoints({ base: ${placeIK.base.toFixed(1)}, shoulder: ${placeIK.shoulder.toFixed(1)}, elbow: ${placeIK.elbow.toFixed(1)}, wrist: ${placeIK.wrist.toFixed(1)} }); // Place
await openGripper();
await moveJoints({ base: ${retreatIK.base.toFixed(1)}, shoulder: ${retreatIK.shoulder.toFixed(1)}, elbow: ${retreatIK.elbow.toFixed(1)}, wrist: ${retreatIK.wrist.toFixed(1)} }); // Retreat`,
    };
  }

  // Fallback to heuristic
  log.debug('Stack command IK failed, using heuristic fallback');
  const baseAngle = calculateBaseAngleForPosition(targetX, targetZ);
  return {
    action: 'sequence',
    joints: [
      { base: baseAngle },
      { shoulder: 20, elbow: -40 },
      { shoulder: -10, elbow: -80 },
      { gripper: 100 },
      { shoulder: 30, elbow: -45 },
    ],
    description: `Stacking "${heldName}" on "${targetName}" (heuristic)`,
    code: `// Stack (heuristic)\nawait moveJoint('base', ${baseAngle.toFixed(0)});\nawait openGripper();`,
  };
}

/**
 * Handle "move to object" / "go to object" commands
 */
export function handleMoveToCommand(
  message: string,
  objects: SimObject[],
  state: JointState
): ClaudeResponse {
  // Remove common words to find target
  const targetSearch = message
    .replace(/move to|go to|reach|the|position|object/gi, '')
    .trim()
    .toLowerCase();

  const targetObject = findObjectByDescription(targetSearch, objects);

  if (!targetObject) {
    return {
      action: 'explain',
      description: `I couldn't find "${targetSearch}". Try "move to the [color] [object]" or use basic movement commands.`,
    };
  }

  const [objX, objY, objZ] = targetObject.position;
  const objName = targetObject.name || targetObject.id;

  // Move gripper to hover above the object
  const hoverHeight = Math.max(objY + 0.1, 0.15);

  log.debug(`[handleMoveToCommand] Moving to "${objName}" at [${objX.toFixed(3)}, ${hoverHeight.toFixed(3)}, ${objZ.toFixed(3)}]`);

  const hoverIK = calculateInverseKinematics(objX, hoverHeight, objZ, state);

  if (hoverIK) {
    return {
      action: 'move',
      joints: { base: hoverIK.base, shoulder: hoverIK.shoulder, elbow: hoverIK.elbow, wrist: hoverIK.wrist },
      description: `Moving to hover above "${objName}" at [${objX.toFixed(2)}, ${hoverHeight.toFixed(2)}, ${objZ.toFixed(2)}] using IK`,
      code: `// Move to "${objName}"\nawait moveJoints({ base: ${hoverIK.base.toFixed(1)}, shoulder: ${hoverIK.shoulder.toFixed(1)}, elbow: ${hoverIK.elbow.toFixed(1)}, wrist: ${hoverIK.wrist.toFixed(1)} });`,
    };
  }

  // Fallback to just rotating base
  const baseAngle = calculateBaseAngleForPosition(objX, objZ);
  return {
    action: 'move',
    joints: { base: baseAngle },
    description: `Rotating toward "${objName}" (IK failed for full approach)`,
    code: `await moveJoint('base', ${baseAngle.toFixed(0)});`,
  };
}
