/**
 * Arm Response Handler
 *
 * Handles arm robot response simulation for the SO-101 robot arm.
 * Extracted from claudeApi.ts for better modularity.
 */

import type { JointState, SimObject } from '../../types';
import type { ClaudeResponse } from './types';
import { loggers } from '../logger';
import { calculateInverseKinematics } from '../../components/simulation/SO101Kinematics';
import { calculateGripperPositionURDF } from '../../components/simulation/SO101KinematicsURDF';
import { handlePickUpCommand } from './pickupSequence';
import { handleStackCommand, handleMoveToCommand } from './stackHandler';
import { handleMultiStepCommand } from './multiStepHandler';

const log = loggers.claude;

/**
 * Parse amount from message (degrees)
 */
export function parseAmount(message: string): number {
  const degreeMatch = message.match(/(\d+)\s*(degrees?|deg|°)/i);
  if (degreeMatch) return parseInt(degreeMatch[1]);
  if (message.includes('little') || message.includes('slight')) return 15;
  if (message.includes('lot') || message.includes('far')) return 60;
  if (message.includes('max') || message.includes('fully')) return 90;
  return 30;
}

/**
 * Parse height/distance from message (returns meters)
 */
export function parseHeight(message: string): number | null {
  // Explicit cm: "20cm", "15 cm", "20 centimeters"
  const cmMatch = message.match(/(\d+(?:\.\d+)?)\s*(cm|centimeters?)/i);
  if (cmMatch) return parseFloat(cmMatch[1]) / 100;

  // Explicit meters: "0.2m", "0.15 meters"
  const mMatch = message.match(/(\d+(?:\.\d+)?)\s*(m|meters?)/i);
  if (mMatch) return parseFloat(mMatch[1]);

  // Height modifiers (return absolute heights from ground)
  if (message.includes('very high') || message.includes('maximum height')) return 0.28;
  if (message.includes('high')) return 0.22;
  if (message.includes('medium') || message.includes('mid')) return 0.15;
  if (message.includes('low') || message.includes('slightly')) return 0.10;
  if (message.includes('very low') || message.includes('barely')) return 0.06;

  return null;
}

/**
 * Parse target joint angle from message: "shoulder to 45", "base 90 degrees"
 */
export function parseJointTarget(message: string): { joint: string; angle: number } | null {
  const joints = ['base', 'shoulder', 'elbow', 'wrist', 'wristroll', 'gripper'];

  for (const joint of joints) {
    const regex = new RegExp(`${joint}\\s*(?:to|at|=)?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(degrees?|deg|°)?`, 'i');
    const match = message.match(regex);
    if (match) {
      return { joint: joint === 'wristroll' ? 'wristRoll' : joint, angle: parseFloat(match[1]) };
    }
  }

  // Also check for "set X to Y" pattern
  const setMatch = message.match(/set\s+(base|shoulder|elbow|wrist|wristroll|gripper)\s+(?:to\s+)?(-?\d+(?:\.\d+)?)/i);
  if (setMatch) {
    const joint = setMatch[1].toLowerCase();
    return { joint: joint === 'wristroll' ? 'wristRoll' : joint, angle: parseFloat(setMatch[2]) };
  }

  return null;
}

/**
 * Get help text for arm robot
 */
export function getHelpText(): string {
  return `I can help you control the robot arm! Try:
- **Movement**: "move left", "raise up", "extend forward"
- **Joints**: "set shoulder to 45", "bend elbow"
- **Gripper**: "open gripper", "grab object"
- **Actions**: "wave hello", "pick up", "go home"`;
}

/**
 * Main arm response simulation function
 */
export async function simulateArmResponse(
  message: string,
  state: JointState,
  objects?: SimObject[]
): Promise<ClaudeResponse> {
  log.debug('Processing message:', message);
  const amount = parseAmount(message);

  // Find grabbable objects
  const grabbableObjects = objects?.filter(o => o.isGrabbable && !o.isGrabbed) || [];
  const heldObject = objects?.find(o => o.isGrabbed);

  // Check for MULTI-STEP commands
  const actionVerbs = ['pick', 'grab', 'place', 'put', 'stack', 'move', 'rotate', 'twist', 'turn', 'lift', 'drop', 'release'];
  const lowerMessage = message.toLowerCase();
  const hasMultipleActions = (() => {
    const parts = lowerMessage.split(/\s*(?:,\s*(?:then\s+)?|(?:\s+and\s+)?then\s+)\s*/);
    if (parts.length < 2) return false;
    let verbCount = 0;
    for (const part of parts) {
      if (actionVerbs.some(verb => part.includes(verb))) {
        verbCount++;
        if (verbCount >= 2) return true;
      }
    }
    return false;
  })();

  if (hasMultipleActions) {
    log.info('Detected multi-step command, using primitives system');
    try {
      const result = await handleMultiStepCommand(message, state, objects || []);
      if (result) return result;
    } catch (error) {
      log.warn('Multi-step command failed, falling back to single command:', error);
    }
  }

  // Check compound commands first (like "pick up") before simple ones (like "up")

  // Pick up / grab objects
  if (message.includes('pick') || message.includes('grab')) {
    log.debug('Detected pick/grab command');
    return await handlePickUpCommand(message, grabbableObjects, heldObject);
  }

  // Stack on / place on top of
  if ((message.includes('stack') || message.includes('place on') || message.includes('put on')) &&
      !message.includes('put down')) {
    return handleStackCommand(message, objects || [], heldObject, state);
  }

  // Move to object position
  if ((message.includes('move to') || message.includes('go to') || message.includes('reach')) &&
      objects && objects.length > 0) {
    return handleMoveToCommand(message, objects, state);
  }

  // Direct joint setting
  const jointTarget = parseJointTarget(message);
  if (jointTarget) {
    const { joint, angle } = jointTarget;
    const limits: Record<string, [number, number]> = {
      base: [-135, 135],
      shoulder: [-90, 90],
      elbow: [-135, 0],
      wrist: [-90, 90],
      wristRoll: [-90, 90],
      gripper: [0, 100],
    };
    const [min, max] = limits[joint] || [-180, 180];
    const clampedAngle = Math.max(min, Math.min(max, angle));
    return {
      action: 'move',
      joints: { [joint]: clampedAngle },
      description: `Setting ${joint} to ${clampedAngle}`,
      code: `await moveJoint('${joint}', ${clampedAngle});`,
    };
  }

  // Lift to specific height
  const targetHeight = parseHeight(message);
  if (targetHeight && (message.includes('lift') || message.includes('raise'))) {
    const currentPos = calculateGripperPositionURDF(state);
    const targetX = currentPos[0];
    const targetZ = currentPos[2];

    const ikResult = calculateInverseKinematics(targetX, targetHeight, targetZ, state);
    if (ikResult) {
      const heightCm = (targetHeight * 100).toFixed(0);
      return {
        action: 'move',
        joints: {
          base: ikResult.base,
          shoulder: ikResult.shoulder,
          elbow: ikResult.elbow,
          wrist: ikResult.wrist,
        },
        description: `Lifting to ${heightCm}cm height`,
        code: `await moveToPosition({ y: ${targetHeight.toFixed(3)} }); // ${heightCm}cm`,
      };
    } else {
      return {
        action: 'error',
        description: `Cannot reach ${(targetHeight * 100).toFixed(0)}cm height - out of range`,
        code: '',
      };
    }
  }

  // Movement commands - base rotation
  if (message.includes('left') && !message.includes('elbow')) {
    const target = Math.min(state.base + amount, 135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base left to ${target}`,
      code: `await moveJoint('base', ${target});`,
    };
  }
  if (message.includes('right') && !message.includes('elbow')) {
    const target = Math.max(state.base - amount, -135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base right to ${target}`,
      code: `await moveJoint('base', ${target});`,
    };
  }

  // Shoulder commands
  if (message.includes('up') || message.includes('raise') || message.includes('lift')) {
    const target = Math.min(state.shoulder + amount, 90);
    return {
      action: 'move',
      joints: { shoulder: target },
      description: `Raising shoulder to ${target}`,
      code: `await moveJoint('shoulder', ${target});`,
    };
  }
  if (message.includes('down') || message.includes('lower')) {
    const target = Math.max(state.shoulder - amount, -90);
    return {
      action: 'move',
      joints: { shoulder: target },
      description: `Lowering shoulder to ${target}`,
      code: `await moveJoint('shoulder', ${target});`,
    };
  }

  // Elbow commands
  if (message.includes('bend') || message.includes('fold') || message.includes('elbow')) {
    if (message.includes('straight') || message.includes('extend')) {
      return {
        action: 'move',
        joints: { elbow: 0 },
        description: 'Straightening elbow',
        code: `await moveJoint('elbow', 0);`,
      };
    }
    const target = Math.max(state.elbow - amount, -135);
    return {
      action: 'move',
      joints: { elbow: target },
      description: `Bending elbow to ${target}`,
      code: `await moveJoint('elbow', ${target});`,
    };
  }

  // Extend/reach forward
  if (message.includes('extend') || message.includes('reach') || message.includes('forward')) {
    return {
      action: 'move',
      joints: { shoulder: 45, elbow: -30 },
      description: 'Extending arm forward',
      code: `await moveJoint('shoulder', 45);\nawait moveJoint('elbow', -30);`,
    };
  }

  // Retract
  if (message.includes('retract') || message.includes('pull back')) {
    return {
      action: 'move',
      joints: { shoulder: 0, elbow: -90 },
      description: 'Retracting arm',
      code: `await moveJoint('shoulder', 0);\nawait moveJoint('elbow', -90);`,
    };
  }

  // Wrist commands
  if (message.includes('wrist') || message.includes('rotate') || message.includes('twist')) {
    if (message.includes('roll') || message.includes('spin')) {
      const target = state.wristRoll > 0 ? -90 : 90;
      return {
        action: 'move',
        joints: { wristRoll: target },
        description: `Rolling wrist to ${target}`,
        code: `await moveJoint('wristRoll', ${target});`,
      };
    }
    const wristAmount = message.includes('up') ? amount : -amount;
    const target = Math.max(-90, Math.min(90, state.wrist + wristAmount));
    return {
      action: 'move',
      joints: { wrist: target },
      description: `Tilting wrist to ${target}`,
      code: `await moveJoint('wrist', ${target});`,
    };
  }

  // Gripper
  if (message.includes('open') || message.includes('release') || message.includes('let go')) {
    return {
      action: 'move',
      joints: { gripper: 100 },
      description: 'Opening gripper',
      code: `await openGripper();`,
    };
  }
  if (message.includes('close') || message.includes('grab') || message.includes('grip') || message.includes('hold')) {
    return {
      action: 'move',
      joints: { gripper: 0 },
      description: 'Closing gripper',
      code: `await closeGripper();`,
    };
  }

  // Presets and sequences
  if (message.includes('wave') || message.includes('hello') || message.includes('hi')) {
    return {
      action: 'sequence',
      joints: [
        { shoulder: 50, elbow: -60 },
        { wrist: 45 },
        { wrist: -45 },
        { wrist: 45 },
        { wrist: 0 },
      ],
      description: 'Waving hello!',
      code: `// Wave animation
await moveJoint('shoulder', 50);
await moveJoint('elbow', -60);
for (let i = 0; i < 2; i++) {
  await moveJoint('wrist', 45);
  await wait(300);
  await moveJoint('wrist', -45);
  await wait(300);
}`,
    };
  }

  if (message.includes('home') || message.includes('reset') || message.includes('zero') || message.includes('neutral')) {
    return {
      action: 'move',
      joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
      description: 'Moving to home position',
      code: `await goHome();`,
    };
  }

  if (message.includes('place') || message.includes('put down') || message.includes('drop')) {
    const currentGripperPos = calculateGripperPositionURDF(state);
    const [gx, gy, gz] = currentGripperPos;

    const placeHeight = Math.max(0.05, gy - 0.1);
    const placeIK = calculateInverseKinematics(gx, placeHeight, gz, state);

    const liftHeight = Math.max(0.15, placeHeight + 0.1);
    const liftIK = calculateInverseKinematics(gx, liftHeight, gz, state);

    if (placeIK && liftIK) {
      log.debug(`[place] Using IK to place at [${gx.toFixed(3)}, ${placeHeight.toFixed(3)}, ${gz.toFixed(3)}]`);
      return {
        action: 'sequence',
        joints: [
          { base: placeIK.base, shoulder: placeIK.shoulder, elbow: placeIK.elbow, wrist: placeIK.wrist },
          { gripper: 100 },
          { base: liftIK.base, shoulder: liftIK.shoulder, elbow: liftIK.elbow, wrist: liftIK.wrist },
        ],
        description: `Placing object at [${gx.toFixed(2)}, ${placeHeight.toFixed(2)}, ${gz.toFixed(2)}] using IK`,
        code: `// Place object using inverse kinematics
await moveJoints({ base: ${placeIK.base.toFixed(1)}, shoulder: ${placeIK.shoulder.toFixed(1)}, elbow: ${placeIK.elbow.toFixed(1)}, wrist: ${placeIK.wrist.toFixed(1)} });
await openGripper();
await moveJoints({ base: ${liftIK.base.toFixed(1)}, shoulder: ${liftIK.shoulder.toFixed(1)}, elbow: ${liftIK.elbow.toFixed(1)}, wrist: ${liftIK.wrist.toFixed(1)} });`,
      };
    }

    log.debug('Place command IK failed, using heuristic fallback');
    return {
      action: 'sequence',
      joints: [
        { shoulder: -20, elbow: -100 },
        { gripper: 100 },
        { shoulder: 20, elbow: -30 },
      ],
      description: 'Placing object down (heuristic)',
      code: `await moveJoint('shoulder', -20);
await moveJoint('elbow', -100);
await openGripper();
await moveJoint('shoulder', 20);`,
    };
  }

  if (message.includes('scan') || message.includes('look around') || message.includes('search')) {
    return {
      action: 'sequence',
      joints: [
        { base: 60, shoulder: 30 },
        { base: -60 },
        { base: 0, shoulder: 0 },
      ],
      description: 'Scanning the area',
      code: `// Scan pattern
await moveJoint('base', 60);
await moveJoint('shoulder', 30);
await wait(500);
await moveJoint('base', -60);
await wait(500);
await moveJoint('base', 0);`,
    };
  }

  if (message.includes('dance') || message.includes('celebrate')) {
    return {
      action: 'sequence',
      joints: [
        { shoulder: 45, elbow: -45 },
        { base: 30, wrist: 30 },
        { base: -30, wrist: -30 },
        { base: 30, wrist: 30 },
        { base: 0, wrist: 0, shoulder: 0, elbow: 0 },
      ],
      description: 'Dancing!',
      code: `// Dance sequence`,
    };
  }

  if (message.includes('point') || message.includes('show')) {
    const direction = message.includes('left') ? 60 : message.includes('right') ? -60 : 0;
    return {
      action: 'move',
      joints: { base: direction, shoulder: 30, elbow: 0, gripper: 0 },
      description: `Pointing ${direction > 0 ? 'left' : direction < 0 ? 'right' : 'forward'}`,
      code: `await moveJoint('base', ${direction});\nawait moveJoint('shoulder', 30);`,
    };
  }

  if (message.includes('nod') || message.includes('yes')) {
    return {
      action: 'sequence',
      joints: [
        { shoulder: 20 },
        { shoulder: -10 },
        { shoulder: 20 },
        { shoulder: 0 },
      ],
      description: 'Nodding yes',
      code: `// Nod sequence`,
    };
  }

  if (message.includes('shake') || message.includes('no')) {
    return {
      action: 'sequence',
      joints: [
        { base: 20 },
        { base: -20 },
        { base: 20 },
        { base: 0 },
      ],
      description: 'Shaking no',
      code: `// Shake head sequence`,
    };
  }

  // If nothing matched, suggest help
  return {
    action: 'explain',
    description: `I'm not sure how to "${message}". ` + getHelpText(),
  };
}
