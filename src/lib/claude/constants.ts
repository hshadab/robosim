/**
 * Constants for Claude API and robot control
 */

import { SO101_JOINT_LIMITS } from '../../config/so101Limits';
import { IK, JAW_OFFSET } from '../../config/gripperConstants';

/** Shape/type synonyms for natural language matching */
export const TYPE_ALIASES: Record<string, string[]> = {
  cube: ['cube', 'block', 'box', 'square'],
  ball: ['ball', 'sphere', 'round'],
  cylinder: ['cylinder', 'can', 'bottle', 'cup', 'tube'],
};

/** Common color words for object matching */
export const COLOR_WORDS = ['red', 'blue', 'green', 'yellow', 'orange', 'white', 'black', 'pink', 'purple'];

/**
 * Joint limits for SO-101 - re-exported from so101Limits.ts for backward compatibility
 * @deprecated Import directly from '../../config/so101Limits' instead
 */
export const JOINT_LIMITS = SO101_JOINT_LIMITS;

/**
 * IK error threshold - re-exported from gripperConstants.ts for backward compatibility
 * @deprecated Import directly from '../../config/gripperConstants' instead
 */
export const IK_ERROR_THRESHOLD = IK.ERROR_THRESHOLD_M;

/**
 * JAW-TIP OFFSET CONSTANT - re-exported from gripperConstants.ts for backward compatibility
 * @deprecated Import directly from '../../config/gripperConstants' instead
 */
export const JAW_LOCAL_Z_OFFSET = JAW_OFFSET.LOCAL_Z;

/** Claude API response format instruction */
export const CLAUDE_RESPONSE_FORMAT = `
RESPONSE FORMAT - You MUST respond with valid JSON:
{
  "action": "sequence",
  "description": "Brief explanation of the action",
  "joints": [
    { "base": 0, "shoulder": -50, "elbow": 30, "wrist": 45, "wristRoll": 90, "gripper": 100 },
    { "base": 0, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 100 },
    { "base": 0, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 0, "_gripperOnly": true },
    { "base": 0, "shoulder": -50, "elbow": 30, "wrist": 45, "wristRoll": 90, "gripper": 0 }
  ],
  "duration": 700
}

CRITICAL 4-STEP PICKUP SEQUENCE (PROVEN TO WORK):
1. APPROACH from above: shoulder=-50, elbow=30, wrist=45, gripper=100 (open)
2. DESCEND to grasp: shoulder=-22, elbow=51, wrist=63, gripper=100 (still open)
3. CLOSE gripper: same position, gripper=0, "_gripperOnly": true
4. LIFT: shoulder=-50, elbow=30, wrist=45, gripper=0 (closed)

BASE ANGLE CALCULATION - MUST calculate from object position:
- base = atan2(z_cm, x_cm) * 180 / PI (in degrees)
- Object at [17, 2, 0]cm → base = 0°
- Object at [17, 2, 1]cm → base = 3.4°
- Object at [17, 2, -1]cm → base = -3.4°
- Object at [18, 2, 1]cm → base = 3.2°
- Object at [18, 2, -1]cm → base = -3.2°

CRITICAL: Negative z = negative base angle! wristRoll=90 for cubes (vertical fingers).
`;
