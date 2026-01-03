/**
 * Constants for Claude API and robot control
 */

/** Shape/type synonyms for natural language matching */
export const TYPE_ALIASES: Record<string, string[]> = {
  cube: ['cube', 'block', 'box', 'square'],
  ball: ['ball', 'sphere', 'round'],
  cylinder: ['cylinder', 'can', 'bottle', 'cup', 'tube'],
};

/** Common color words for object matching */
export const COLOR_WORDS = ['red', 'blue', 'green', 'yellow', 'orange', 'white', 'black', 'pink', 'purple'];

/** Joint limits for SO-101 (from robots.ts) */
export const JOINT_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
  wristRoll: { min: -157, max: 163 },
};

/** IK error threshold - if error is larger than this, the position may not be reachable */
export const IK_ERROR_THRESHOLD = 0.03; // 3cm

/**
 * JAW-TIP OFFSET CONSTANT
 * The jaw contact point is offset from gripper_frame_link in local gripper coordinates:
 * JAW_LOCAL_OFFSET = [-0.0079, 0, 0.0068] in gripper local space
 * When gripper is pointing down (wrist ~90°), the Z offset becomes a Y offset in world space
 * When gripper is horizontal (wrist ~0°), the Z offset becomes a horizontal offset
 */
export const JAW_LOCAL_Z_OFFSET = 0.0068; // 6.8mm forward toward jaw tips in local gripper Z

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
