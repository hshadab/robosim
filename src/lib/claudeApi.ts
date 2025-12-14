/**
 * Claude API Integration for RoboSim
 * Provides real LLM-powered robot control and code generation
 * Enhanced with semantic state for natural language understanding
 */

import type { JointState, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState, SensorReading, SimObject } from '../types';
import { SYSTEM_PROMPTS } from '../hooks/useLLMChat';
import { generateSemanticState } from './semanticState';
import { API_CONFIG, STORAGE_CONFIG } from './config';
import { loggers } from './logger';
import { calculateInverseKinematics, calculateSO101GripperPosition } from '../components/simulation/SO101Kinematics';
import { calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';

const log = loggers.claude;

export interface ClaudeResponse {
  action: 'move' | 'sequence' | 'code' | 'explain' | 'query' | 'error';
  description: string;
  code?: string;
  joints?: Partial<JointState> | Partial<JointState>[];
  wheeledAction?: Partial<WheeledRobotState>;
  droneAction?: Partial<DroneState>;
  humanoidAction?: Partial<HumanoidState>;
  duration?: number;
  // New: allow LLM to ask clarifying questions
  clarifyingQuestion?: string;
}

const CLAUDE_RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "action": "move" | "sequence" | "code" | "explain" | "query",
  "description": "Human-readable explanation of what you're doing",
  "code": "Optional: Arduino/JavaScript code for this action",
  "joints": { "base": 0, "shoulder": 0, "elbow": 0, "wrist": 0, "wristRoll": 0, "gripper": 50 },
  "duration": 1000,
  "clarifyingQuestion": "Optional: Ask user for more info if needed"
}

For arm robots, use joints. For wheeled robots, use wheeledAction with leftWheelSpeed, rightWheelSpeed.
For drones, use droneAction with throttle, position, rotation, armed, flightMode.
For humanoids, use humanoidAction with joint names like leftKnee, rightShoulderPitch, etc.

IMPORTANT CAPABILITIES:
- You can see the robot's CURRENT STATE including joint positions, sensor readings, and recent events
- You can understand spatial relationships ("move to the left", "go higher", "closer to the object")
- You can reference the robot's current position ("from here", "continue", "go back")
- You can provide feedback about what you observe in the robot's state
- If the user's request is unclear, use action="query" with clarifyingQuestion to ask for more details
`;

export interface FullRobotState {
  joints: JointState;
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;
  sensors: SensorReading;
  isAnimating: boolean;
  objects?: SimObject[];
}

function buildSystemPrompt(robotType: ActiveRobotType, fullState: FullRobotState): string {
  const basePrompt = SYSTEM_PROMPTS[robotType];

  // Generate semantic state description
  const semanticState = generateSemanticState(
    robotType,
    fullState.joints,
    fullState.wheeledRobot,
    fullState.drone,
    fullState.humanoid,
    fullState.sensors,
    fullState.isAnimating
  );

  // Build objects description for arm robots
  let objectsDescription = '';
  if (robotType === 'arm' && fullState.objects && fullState.objects.length > 0) {
    const grabbableObjects = fullState.objects.filter(o => o.isGrabbable);
    if (grabbableObjects.length > 0) {
      objectsDescription = `
# OBJECTS IN SCENE
${grabbableObjects.map(obj => {
  const pos = obj.position;
  const grabbed = obj.isGrabbed ? ' (CURRENTLY HELD)' : '';
  return `- "${obj.name || obj.id}": at position [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}]${grabbed}`;
}).join('\n')}

To pick up an object:
1. Rotate base to face the object (base angle = atan2(x, z) in degrees)
2. Position gripper AROUND the object with these reference angles:
   - For objects near [0.05, 0.05, 0.09]m: base=77°, shoulder=6°, elbow=36°, wrist=92°
   - Gripper must be pointing DOWN with wrist ~90° for table pickups
3. Close gripper (gripper: 0) - object must be BETWEEN the fingers
4. Lift by reducing shoulder angle (e.g., shoulder=30°, elbow=30°)

CRITICAL: Gripper grab radius is only 4cm - the object must be precisely between the gripper fingers.
Object at X>0 means base should rotate positive (counter-clockwise when viewed from above).
`;
    }
  }

  return `${basePrompt}

# CURRENT ROBOT STATE (Natural Language)
${semanticState}
${objectsDescription}
# RAW STATE DATA (For precise control)
${JSON.stringify(
  robotType === 'arm' ? fullState.joints :
  robotType === 'wheeled' ? fullState.wheeledRobot :
  robotType === 'drone' ? fullState.drone :
  fullState.humanoid,
  null, 2
)}

${CLAUDE_RESPONSE_FORMAT}

Important:
- Always respond with valid JSON
- Be concise but helpful
- Reference the current state when relevant ("I see you're currently...", "From the current position...")
- Acknowledge what just happened when continuing a task
`;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function callClaudeAPI(
  message: string,
  robotType: ActiveRobotType,
  fullState: FullRobotState,
  apiKey?: string,
  conversationHistory: ConversationMessage[] = []
): Promise<ClaudeResponse> {
  // Get current state based on robot type for demo mode
  const currentState = robotType === 'arm' ? fullState.joints :
                       robotType === 'wheeled' ? fullState.wheeledRobot :
                       robotType === 'drone' ? fullState.drone :
                       fullState.humanoid;

  // For arm manipulation commands (pick, grab, stack, place), always use local IK-based handlers
  // This ensures precise inverse kinematics calculations regardless of API key presence
  const lowerMessage = message.toLowerCase();
  const isManipulationCommand = robotType === 'arm' && (
    lowerMessage.includes('pick') ||
    lowerMessage.includes('grab') ||
    lowerMessage.includes('stack') ||
    lowerMessage.includes('place') ||
    lowerMessage.includes('put down') ||
    lowerMessage.includes('drop') ||
    (lowerMessage.includes('move to') && fullState.objects && fullState.objects.length > 0)
  );

  if (isManipulationCommand) {
    console.log('[callClaudeAPI] Using local IK handlers for manipulation command:', message);
    return simulateClaudeResponse(message, robotType, currentState, conversationHistory, fullState.objects);
  }

  // If no API key, use the demo mode with simulated responses
  if (!apiKey) {
    return simulateClaudeResponse(message, robotType, currentState, conversationHistory, fullState.objects);
  }

  try {
    // Build messages array with conversation history
    const recentHistory = conversationHistory.slice(-API_CONFIG.MAX_CONVERSATION_HISTORY);
    const messages = [
      ...recentHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    const response = await fetch(`${API_CONFIG.CLAUDE.BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_CONFIG.CLAUDE.VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: API_CONFIG.CLAUDE.DEFAULT_MODEL,
        max_tokens: API_CONFIG.CLAUDE.MAX_TOKENS,
        system: buildSystemPrompt(robotType, fullState),
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'move',
          description: parsed.description || content,
          code: parsed.code,
          joints: parsed.joints,
          wheeledAction: parsed.wheeledAction,
          droneAction: parsed.droneAction,
          humanoidAction: parsed.humanoidAction,
          duration: parsed.duration || 1000,
        };
      } catch {
        // If JSON parsing fails, return the text as description
        return {
          action: 'explain',
          description: content,
        };
      }
    }

    return {
      action: 'explain',
      description: content,
    };
  } catch (error) {
    log.error('Claude API error', error);
    return {
      action: 'error',
      description: `Failed to connect to Claude: ${error instanceof Error ? error.message : 'Unknown error'}. Using demo mode.`,
    };
  }
}

// Simulated Claude responses for demo mode (no API key)
async function simulateClaudeResponse(
  message: string,
  robotType: ActiveRobotType,
  currentState: unknown,
  conversationHistory: ConversationMessage[] = [],
  objects?: SimObject[]
): Promise<ClaudeResponse> {
  // Add realistic delay
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

  const lowerMessage = message.toLowerCase();

  // Check for context from conversation history
  const lastAssistantMessage = conversationHistory
    .filter(m => m.role === 'assistant')
    .pop()?.content?.toLowerCase() || '';

  // Handle follow-up commands like "again", "more", "continue"
  if (lowerMessage.includes('again') || lowerMessage === 'repeat') {
    const lastUserMessage = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-2, -1)[0]?.content;
    if (lastUserMessage) {
      return simulateClaudeResponse(lastUserMessage, robotType, currentState, [], objects);
    }
  }

  if (lowerMessage.includes('more') || lowerMessage.includes('further') || lowerMessage.includes('continue')) {
    // Continue the last action direction
    if (lastAssistantMessage.includes('left')) {
      return simulateClaudeResponse('move left more', robotType, currentState, [], objects);
    }
    if (lastAssistantMessage.includes('right')) {
      return simulateClaudeResponse('move right more', robotType, currentState, [], objects);
    }
    if (lastAssistantMessage.includes('up') || lastAssistantMessage.includes('rais')) {
      return simulateClaudeResponse('raise up more', robotType, currentState, [], objects);
    }
    if (lastAssistantMessage.includes('down') || lastAssistantMessage.includes('lower')) {
      return simulateClaudeResponse('lower down more', robotType, currentState, [], objects);
    }
  }

  // Common patterns across all robot types
  if (lowerMessage.includes('help') || lowerMessage.includes('what can') || lowerMessage === '?') {
    return {
      action: 'explain',
      description: getHelpText(robotType),
    };
  }

  // Status/state queries
  if (lowerMessage.includes('where') || lowerMessage.includes('status') || lowerMessage.includes('position')) {
    return describeState(robotType, currentState, objects);
  }

  // Undo command
  if (lowerMessage.includes('undo') || lowerMessage.includes('go back')) {
    return {
      action: 'move',
      joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 },
      description: "Returning to neutral position. (Full undo requires API key for context tracking)",
    };
  }

  console.log('[simulateClaudeResponse] Routing to robot handler:', {
    robotType,
    message: lowerMessage,
    objectCount: objects?.length || 0,
    objects: objects?.map(o => ({ name: o.name, type: o.type, position: o.position }))
  });

  switch (robotType) {
    case 'arm':
      const response = simulateArmResponse(lowerMessage, currentState as JointState, objects);
      console.log('[simulateClaudeResponse] Arm response:', {
        action: response.action,
        description: response.description,
        hasJoints: !!response.joints,
        jointCount: Array.isArray(response.joints) ? response.joints.length : (response.joints ? 1 : 0)
      });
      return response;
    case 'wheeled':
      return simulateWheeledResponse(lowerMessage, currentState as WheeledRobotState);
    case 'drone':
      return simulateDroneResponse(lowerMessage, currentState as DroneState);
    case 'humanoid':
      return simulateHumanoidResponse(lowerMessage, currentState as HumanoidState);
    default:
      return {
        action: 'error',
        description: 'Unknown robot type',
      };
  }
}

// Describe current state
function describeState(robotType: ActiveRobotType, state: unknown, objects?: SimObject[]): ClaudeResponse {
  if (robotType === 'arm') {
    const joints = state as JointState;
    const baseDir = joints.base > 10 ? 'left' : joints.base < -10 ? 'right' : 'center';
    const shoulderPos = joints.shoulder > 20 ? 'raised' : joints.shoulder < -20 ? 'lowered' : 'level';
    const gripperState = joints.gripper > 70 ? 'open' : joints.gripper < 30 ? 'closed' : 'partially open';

    let objectInfo = '';
    if (objects && objects.length > 0) {
      const grabbable = objects.filter(o => o.isGrabbable && !o.isGrabbed);
      const held = objects.find(o => o.isGrabbed);
      if (held) {
        objectInfo = `\n\n**Currently holding:** "${held.name || held.id}"`;
      }
      if (grabbable.length > 0) {
        objectInfo += `\n\n**Objects nearby:** ${grabbable.map(o => `"${o.name || o.id}" at [${o.position.map(p => p.toFixed(2)).join(', ')}]`).join(', ')}`;
      }
    }

    return {
      action: 'explain',
      description: `Current arm state:
• Base: ${joints.base.toFixed(0)}° (facing ${baseDir})
• Shoulder: ${joints.shoulder.toFixed(0)}° (${shoulderPos})
• Elbow: ${joints.elbow.toFixed(0)}°
• Wrist: ${joints.wrist.toFixed(0)}°
• Gripper: ${joints.gripper.toFixed(0)}% (${gripperState})${objectInfo}`,
    };
  }
  return {
    action: 'explain',
    description: `Current ${robotType} state: ${JSON.stringify(state, null, 2)}`,
  };
}

function getHelpText(robotType: ActiveRobotType): string {
  switch (robotType) {
    case 'arm':
      return `I can help you control the robot arm! Try:
- **Movement**: "move left", "raise up", "extend forward"
- **Joints**: "set shoulder to 45", "bend elbow"
- **Gripper**: "open gripper", "grab object"
- **Actions**: "wave hello", "pick up", "go home"`;
    case 'wheeled':
      return `I can control the wheeled robot! Try:
- **Drive**: "go forward", "turn left", "reverse"
- **Actions**: "follow line", "avoid obstacles"
- **Stop**: "stop motors"`;
    case 'drone':
      return `I can fly the drone! Try:
- **Flight**: "take off", "land", "hover"
- **Move**: "fly forward", "go left", "ascend"
- **Rotate**: "turn around", "rotate 90 degrees"`;
    case 'humanoid':
      return `I can control the humanoid! Try:
- **Walk**: "walk forward", "take a step"
- **Arms**: "wave hello", "raise arms"
- **Actions**: "squat", "bow", "stand on one leg"`;
  }
}

function parseAmount(message: string): number {
  const degreeMatch = message.match(/(\d+)\s*(degrees?|deg|°)/i);
  if (degreeMatch) return parseInt(degreeMatch[1]);
  if (message.includes('little') || message.includes('slight')) return 15;
  if (message.includes('lot') || message.includes('far')) return 60;
  if (message.includes('max') || message.includes('fully')) return 90;
  return 30;
}

// Calculate base angle to point at a position
// Robot faces +Z direction when base=0, positive rotation is counter-clockwise (left)
function calculateBaseAngleForPosition(x: number, z: number): number {
  // Base=0 points toward +X, Base=90 points toward +Z
  // atan2(z, x) gives angle from X axis toward Z axis
  const angleRad = Math.atan2(z, x);
  const angleDeg = (angleRad * 180) / Math.PI;
  console.log(`[calculateBaseAngle] x=${x.toFixed(3)}, z=${z.toFixed(3)} => angle=${angleDeg.toFixed(1)}°`);
  return Math.max(-110, Math.min(110, angleDeg));
}

/**
 * URDF-BASED IK SYSTEM
 *
 * Uses accurate FK derived directly from the SO-101 URDF model.
 * The FK in SO101KinematicsURDF.ts matches the actual robot within 0.1cm.
 * This numerical IK solver finds joint angles to reach any target position.
 */

interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}

// Joint limits for SO-101 (from robots.ts)
const JOINT_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
  wristRoll: { min: -157, max: 163 },
};

// Clamp joint angle to its limits
function clampJoint(jointName: keyof typeof JOINT_LIMITS, value: number): number {
  const limits = JOINT_LIMITS[jointName];
  return Math.max(limits.min, Math.min(limits.max, value));
}

/**
 * Calculate gripper position using URDF-based FK
 * This matches the actual robot behavior exactly (verified by FK Compare logs)
 */
function calculateGripperPos(joints: JointAngles): [number, number, number] {
  return calculateGripperPositionURDF(joints);
}

// Numerical IK solver using gradient descent with adaptive step size
// Tries multiple starting configurations to avoid local minima
// If fixedBaseAngle is provided, the base angle is locked to that value
// Now also tries nearby base angles if the error is too large
function solveIKForTarget(targetPos: [number, number, number], _maxIter = 1000, fixedBaseAngle?: number): { joints: JointAngles; error: number } {
  let bestJoints: JointAngles = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
  let bestError = Infinity;

  // Calculate initial base angle to point towards target (X-Z plane)
  // URDF FK: base=0° points along +X, base=90° points along +Z
  // So to reach (targetX, targetZ), we need base = atan2(Z, X)
  const nominalBaseAngle = fixedBaseAngle !== undefined
    ? clampJoint('base', fixedBaseAngle)
    : clampJoint('base', Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI));

  // Try a range of base angles around the nominal to find the best fit
  // This helps when the workspace geometry makes the nominal angle suboptimal
  const baseAnglesToTry = fixedBaseAngle !== undefined
    ? [nominalBaseAngle] // If fixed, only use that angle
    : [nominalBaseAngle, nominalBaseAngle - 5, nominalBaseAngle + 5, nominalBaseAngle - 10, nominalBaseAngle + 10].map(a => clampJoint('base', a));

  const optimizeBase = false; // Don't optimize base during gradient descent - we try multiple angles instead

  // Try multiple base angles, each with multiple starting configurations
  for (const baseAngle of baseAnglesToTry) {
    // Starting configurations based on REAL SO-101 dataset values and URDF FK testing
    // From lerobot/svla_so101_pickplace dataset on HuggingFace:
    // Real grasp: shoulder=-99°, elbow=+99°, wrist=+75°
    // Real reach: shoulder=-86°, elbow=+73°, wrist=+75°
    //
    // IMPORTANT: Test results show optimal configs are often ASYMMETRIC:
    // - For [19, 3, -9]cm target: shoulder=-65, elbow=85, wrist=25 achieves 0.2cm error
    // - The key is: moderate shoulder + high elbow + low wrist for low+distant targets
    //
    // We need configs for:
    // 1. Close objects (compact poses with high shoulder/elbow)
    // 2. Distant objects at LOW height (asymmetric: moderate shoulder, high elbow, low wrist)
    // 3. Distant objects at HIGH height (extended symmetric poses)
    const startConfigs: JointAngles[] = [
      // COMPACT POSES - for close objects at low height
      { base: baseAngle, shoulder: -99, elbow: 97, wrist: 75, wristRoll: 0 },   // Real grasp pose (reach ~9cm)
      { base: baseAngle, shoulder: -95, elbow: 95, wrist: 75, wristRoll: 0 },   // Near grasp pose
      { base: baseAngle, shoulder: -90, elbow: 90, wrist: 75, wristRoll: 0 },   // Good grasp pose

      // MEDIUM POSES - for medium distance objects
      { base: baseAngle, shoulder: -86, elbow: 73, wrist: 75, wristRoll: 0 },   // Real reach pose (reach ~12cm)
      { base: baseAngle, shoulder: -80, elbow: 80, wrist: 70, wristRoll: 0 },   // Variant
      { base: baseAngle, shoulder: -75, elbow: 75, wrist: 65, wristRoll: 0 },   // Medium bent

      // ASYMMETRIC POSES - for DISTANT objects at LOW height (key discovery!)
      // These have moderate shoulder, HIGH elbow, and LOW wrist to reach far while staying low
      { base: baseAngle, shoulder: -65, elbow: 85, wrist: 25, wristRoll: 0 },   // Optimal for ~19cm at Y=3cm
      { base: baseAngle, shoulder: -60, elbow: 85, wrist: 20, wristRoll: 0 },   // Variant for low+far
      { base: baseAngle, shoulder: -70, elbow: 90, wrist: 30, wristRoll: 0 },   // More bent shoulder
      { base: baseAngle, shoulder: -55, elbow: 80, wrist: 15, wristRoll: 0 },   // Even more extended
      { base: baseAngle, shoulder: -65, elbow: 75, wrist: 35, wristRoll: 0 },   // Lower elbow variant
      { base: baseAngle, shoulder: -50, elbow: 75, wrist: 10, wristRoll: 0 },   // Very extended, low wrist

      // EXTENDED SYMMETRIC POSES - for distant objects at higher height
      { base: baseAngle, shoulder: -70, elbow: 70, wrist: 60, wristRoll: 0 },   // Less bent (reach ~15cm)
      { base: baseAngle, shoulder: -60, elbow: 60, wrist: 50, wristRoll: 0 },   // Extended (reach ~18cm)
      { base: baseAngle, shoulder: -50, elbow: 50, wrist: 40, wristRoll: 0 },   // More extended
      { base: baseAngle, shoulder: -45, elbow: 45, wrist: 45, wristRoll: 0 },   // Very extended
      { base: baseAngle, shoulder: -40, elbow: 40, wrist: 40, wristRoll: 0 },   // Almost straight
      { base: baseAngle, shoulder: -30, elbow: 30, wrist: 30, wristRoll: 0 },   // Near straight (max reach)
    ];

  for (const startConfig of startConfigs) {
    let joints = { ...startConfig };

    // Multi-pass optimization with decreasing step sizes - more steps for finer control
    // Added very fine steps at the end for better precision
    const stepSizes = [10.0, 5.0, 2.0, 1.0, 0.5, 0.25, 0.1, 0.05];

    for (const stepSize of stepSizes) {
      // Run more iterations per step size for better convergence
      // More iterations for finer step sizes where convergence is slower
      const iterations = stepSize < 0.2 ? 50 : 30;
      for (let iter = 0; iter < iterations; iter++) {
        const pos = calculateGripperPos(joints);
        const error = Math.sqrt(
          (pos[0] - targetPos[0]) ** 2 +
          (pos[1] - targetPos[1]) ** 2 +
          (pos[2] - targetPos[2]) ** 2
        );

        if (error < bestError) {
          bestError = error;
          bestJoints = { ...joints };
        }

        if (error < 0.002) break; // 2mm tolerance for precision

        // Gradient descent on joints (skip base if fixed)
        const jointNames: (keyof JointAngles)[] = optimizeBase
          ? ['base', 'shoulder', 'elbow', 'wrist']
          : ['shoulder', 'elbow', 'wrist'];

        for (const jn of jointNames) {

          const testPlus = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
          const testMinus = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };

          const posPlus = calculateGripperPos(testPlus);
          const posMinus = calculateGripperPos(testMinus);

          const errorPlus = Math.sqrt(
            (posPlus[0] - targetPos[0]) ** 2 +
            (posPlus[1] - targetPos[1]) ** 2 +
            (posPlus[2] - targetPos[2]) ** 2
          );
          const errorMinus = Math.sqrt(
            (posMinus[0] - targetPos[0]) ** 2 +
            (posMinus[1] - targetPos[1]) ** 2 +
            (posMinus[2] - targetPos[2]) ** 2
          );

          if (errorPlus < error && errorPlus <= errorMinus) {
            joints[jn] = clampJoint(jn, joints[jn] + stepSize);
          } else if (errorMinus < error) {
            joints[jn] = clampJoint(jn, joints[jn] - stepSize);
          }
        }
      }
    }
  } // end startConfigs loop
  } // end baseAnglesToTry loop

  console.log(`[solveIKForTarget] Target: [${(targetPos[0]*100).toFixed(1)}, ${(targetPos[1]*100).toFixed(1)}, ${(targetPos[2]*100).toFixed(1)}]cm`);
  console.log(`[solveIKForTarget] Result: base=${bestJoints.base.toFixed(1)}°, shoulder=${bestJoints.shoulder.toFixed(1)}°, elbow=${bestJoints.elbow.toFixed(1)}°, wrist=${bestJoints.wrist.toFixed(1)}°`);
  console.log(`[solveIKForTarget] Error: ${(bestError*100).toFixed(2)}cm`);

  // Verify the final position
  const finalPos = calculateGripperPos(bestJoints);
  console.log(`[solveIKForTarget] Achieved: [${(finalPos[0]*100).toFixed(1)}, ${(finalPos[1]*100).toFixed(1)}, ${(finalPos[2]*100).toFixed(1)}]cm`);

  return { joints: bestJoints, error: bestError };
}

// Distance from gripper tip to grip center (must match useGripperInteraction.ts)
const GRIP_CENTER_OFFSET = 0.045; // 4.5cm

// IK error threshold - if error is larger than this, the position may not be reachable
const IK_ERROR_THRESHOLD = 0.03; // 3cm - positions with larger errors may not be grabbable

// Calculate grasp position with validation (gripper tip must go BELOW object so grip center is AT object)
// Tries multiple grasp heights if the ideal position is unreachable
// If baseAngle is not provided, the IK will search for the optimal base angle
function calculateGraspJoints(objX: number, objY: number, objZ: number, baseAngle?: number): { joints: JointAngles; error: number; achievedY: number } {
  // The grip center is 4.5cm ABOVE the gripper tip (when pointing down).
  // We need the grip center at object height, so tip should be BELOW object.
  // tip_y = obj_y - grip_center_offset
  const idealGraspY = Math.max(0.02, objY - GRIP_CENTER_OFFSET);

  // Try multiple grasp heights - start with ideal, then try progressively higher
  // This helps when the arm can't reach far horizontally at low heights
  const graspHeightsToTry = [
    idealGraspY,                    // Ideal: grip center at object height
    objY,                           // Higher: gripper tip at object height
    objY + 0.02,                    // Even higher: 2cm above object
    objY + 0.04,                    // 4cm above object
  ];

  let bestResult = { joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } as JointAngles, error: Infinity };
  let bestAchievedY = 0;

  for (const graspY of graspHeightsToTry) {
    const graspTarget: [number, number, number] = [objX, graspY, objZ];
    const result = solveIKForTarget(graspTarget, 1000, baseAngle);

    // Calculate actual achieved position
    const achievedPos = calculateGripperPos(result.joints);
    const horizontalError = Math.sqrt(
      (achievedPos[0] - objX) ** 2 +
      (achievedPos[2] - objZ) ** 2
    );

    console.log(`[calculateGraspJoints] Trying Y=${(graspY*100).toFixed(1)}cm: error=${(result.error*100).toFixed(1)}cm, achieved=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, horiz_error=${(horizontalError*100).toFixed(1)}cm`);

    // Accept if this is better OR if horizontal error is low enough (within 3cm)
    // We prioritize horizontal accuracy for grasping
    if (result.error < bestResult.error || (horizontalError < 0.03 && result.error < bestResult.error + 0.02)) {
      bestResult = result;
      bestAchievedY = achievedPos[1];
    }

    // If we found a good solution (error < 2cm), stop searching
    if (result.error < 0.02) {
      console.log(`[calculateGraspJoints] Found good solution at Y=${(graspY*100).toFixed(1)}cm`);
      break;
    }
  }

  console.log(`[calculateGraspJoints] Object at Y=${(objY*100).toFixed(1)}cm, best grasp error=${(bestResult.error*100).toFixed(1)}cm, achieved Y=${(bestAchievedY*100).toFixed(1)}cm`);

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    console.warn(`[calculateGraspJoints] WARNING: Best IK error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold ${IK_ERROR_THRESHOLD*100}cm - object may not be reachable!`);
  }

  return { ...bestResult, achievedY: bestAchievedY };
}

// Calculate approach position with validation (above object)
// Uses achieved grasp Y to determine approach height for consistency
function calculateApproachJoints(objX: number, objY: number, objZ: number, baseAngle: number, graspAchievedY?: number): { joints: JointAngles; error: number } {
  // Approach from above: same X/Z but higher Y
  // Use achieved grasp Y as reference if available, otherwise use object Y
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  // Try multiple approach heights to find a reachable one
  const approachHeights = [
    referenceY + 0.06,  // 6cm above reference
    referenceY + 0.08,  // 8cm above reference
    referenceY + 0.10,  // 10cm above reference
    referenceY + 0.12,  // 12cm above reference
  ];

  let bestResult = solveIKForTarget([objX, approachHeights[0], objZ], 1000, baseAngle);

  for (const approachY of approachHeights) {
    const approachTarget: [number, number, number] = [objX, approachY, objZ];
    const result = solveIKForTarget(approachTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    // If we found a good solution, stop searching
    if (result.error < 0.02) {
      console.log(`[calculateApproachJoints] Found good approach at Y=${(approachY*100).toFixed(1)}cm`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    console.warn(`[calculateApproachJoints] WARNING: Best approach error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}

// Calculate lift position with validation (raised after grasping) - KEEP SAME BASE ANGLE to prevent spinning
// Uses achieved grasp Y to determine lift height for consistency
function calculateLiftJoints(objX: number, objY: number, objZ: number, baseAngle: number, graspAchievedY?: number): { joints: JointAngles; error: number } {
  // Lift straight up from current position - DO NOT change X/Z significantly
  // This prevents the arm from spinning around
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  // Try multiple lift heights
  const liftHeights = [
    referenceY + 0.08,  // 8cm above reference
    referenceY + 0.10,  // 10cm above reference
    referenceY + 0.12,  // 12cm above reference
    referenceY + 0.15,  // 15cm above reference
  ];

  let bestResult = solveIKForTarget([objX, liftHeights[0], objZ], 1000, baseAngle);

  for (const liftY of liftHeights) {
    const liftTarget: [number, number, number] = [objX, liftY, objZ];
    const result = solveIKForTarget(liftTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    // If we found a good solution, stop searching
    if (result.error < 0.02) {
      console.log(`[calculateLiftJoints] Found good lift at Y=${(liftY*100).toFixed(1)}cm`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    console.warn(`[calculateLiftJoints] WARNING: Best lift error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}

// Helper function to handle pick-up commands
function handlePickUpCommand(
  message: string,
  grabbableObjects: SimObject[],
  heldObject: SimObject | undefined
): ClaudeResponse {
  // If we're already holding something
  if (heldObject) {
    return {
      action: 'explain',
      description: `I'm already holding "${heldObject.name || heldObject.id}". Say "drop" or "place" to release it first.`,
    };
  }

  // Find an object to pick up
  if (grabbableObjects.length === 0) {
    console.log('[handlePickUpCommand] No grabbable objects found');
    return {
      action: 'explain',
      description: "I don't see any objects to pick up. Try adding an object using the Object Library first.",
    };
  }

  console.log('[handlePickUpCommand] Grabbable objects:', grabbableObjects.map(o => ({
    name: o.name,
    type: o.type,
    id: o.id,
    position: o.position,
    isGrabbable: o.isGrabbable
  })));

  // Find closest object or one matching the name/color/type
  let targetObject = grabbableObjects[0];
  let matchFound = false;

  // Shape/type synonyms: "cube" = "block", "ball" = "sphere", etc.
  const typeAliases: Record<string, string[]> = {
    cube: ['cube', 'block', 'box', 'square'],
    ball: ['ball', 'sphere', 'round'],
    cylinder: ['cylinder', 'can', 'bottle', 'cup', 'tube'],
  };

  for (const obj of grabbableObjects) {
    const name = (obj.name || '').toLowerCase();
    const objType = (obj.type || '').toLowerCase();
    const color = (obj.color || '').toLowerCase();

    // Check for name match, partial name match, type match, or color match
    const words = name.split(/\s+/);
    const colorWords = ['red', 'blue', 'green', 'yellow', 'orange', 'white', 'black', 'pink', 'purple'];
    const messageColor = colorWords.find(c => message.includes(c));

    // Check if message contains any alias for the object's type
    const typeMatches = typeAliases[objType]?.some(alias => message.includes(alias)) || message.includes(objType);

    if (message.includes(name) ||
        message.includes(obj.id) ||
        words.some(word => word.length > 2 && message.includes(word)) ||
        typeMatches ||
        (messageColor && (name.includes(messageColor) || color.includes(messageColor)))) {
      targetObject = obj;
      matchFound = true;
      console.log('[handlePickUpCommand] Matched object:', targetObject.name, 'via',
        message.includes(name) ? 'full name' :
        words.some(word => word.length > 2 && message.includes(word)) ? 'word match' :
        typeMatches ? 'type match' : 'color match');
      break;
    }
  }

  if (!matchFound) {
    console.log('[handlePickUpCommand] No specific match found, using first object:', targetObject.name);
  }

  const [objX, objY, objZ] = targetObject.position;
  const objName = targetObject.name || targetObject.id;

  // Calculate horizontal distance from robot base to object
  const distance = Math.sqrt(objX * objX + objZ * objZ);

  console.log(`[handlePickUpCommand] Pick up "${objName}": pos=[${objX.toFixed(3)}, ${objY.toFixed(3)}, ${objZ.toFixed(3)}], distance=${distance.toFixed(3)}m`);

  // ========================================
  // URDF-BASED IK APPROACH
  // ========================================
  // Use accurate FK from URDF to calculate joint angles via numerical IK.
  // The FK matches the actual robot within 0.1cm accuracy.

  console.log(`[handlePickUpCommand] Using URDF-based IK approach`);

  // Calculate base angle ONCE and use for all phases to prevent spinning
  // URDF FK coordinate system: base=0° points along +X, base=90° points along +Z
  // So to reach (objX, objZ), we need base = atan2(Z, X)
  const rawBaseAngle = Math.atan2(objZ, objX) * (180 / Math.PI);
  const baseAngle = clampJoint('base', rawBaseAngle);

  // Check if object is within rotation range
  if (Math.abs(rawBaseAngle) > 110) {
    console.warn(`[handlePickUpCommand] WARNING: Object at angle ${rawBaseAngle.toFixed(1)}° is outside base rotation limits (±110°)`);
  }
  console.log(`[handlePickUpCommand] Fixed base angle: ${baseAngle.toFixed(1)}° for object at X=${(objX*100).toFixed(1)}cm, Z=${(objZ*100).toFixed(1)}cm`);

  // Calculate joint angles for each phase
  // First calculate grasp WITHOUT fixed base angle to find the best configuration
  // Then use the resulting base angle for approach/lift to ensure smooth motion
  const graspResult = calculateGraspJoints(objX, objY, objZ);  // Let IK find best base angle
  const optimalBaseAngle = graspResult.joints.base;

  console.log(`[handlePickUpCommand] Optimal base from grasp IK: ${optimalBaseAngle.toFixed(1)}° (nominal was ${baseAngle.toFixed(1)}°)`);

  // Now use the optimal base angle for approach and lift
  const approachResult = calculateApproachJoints(objX, objY, objZ, optimalBaseAngle, graspResult.achievedY);
  const liftResult = calculateLiftJoints(objX, objY, objZ, optimalBaseAngle, graspResult.achievedY);

  // Log IK quality
  console.log(`[handlePickUpCommand] IK errors: approach=${(approachResult.error*100).toFixed(1)}cm, grasp=${(graspResult.error*100).toFixed(1)}cm, lift=${(liftResult.error*100).toFixed(1)}cm`);

  // Check if object is in reachable workspace
  // The arm has a ~4cm X offset due to shoulder_pan joint origin
  // Objects with small X (< 5cm) and large Z (> 10cm) are often unreachable
  const maxError = Math.max(approachResult.error, graspResult.error, liftResult.error);
  let reachabilityWarning = '';

  // Check for "dead zone" - small X with large Z
  if (Math.abs(objX) < 0.05 && Math.abs(objZ) > 0.10) {
    reachabilityWarning = ` Warning: Object is in a difficult-to-reach zone (small X, large Z). The arm has a ~4cm X offset that limits reach to X < 0.05m at far distances.`;
    console.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (maxError > 0.06) { // 6cm error - likely unreachable
    reachabilityWarning = ` Warning: Object may be outside arm's reachable workspace (IK error: ${(maxError*100).toFixed(0)}cm). Try repositioning the object.`;
    console.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (maxError > 0.04) { // 4cm error - marginal reach
    reachabilityWarning = ` Note: Object is at edge of arm's reach (IK error: ${(maxError*100).toFixed(0)}cm).`;
  } else if (maxError > 0.02) {
    console.log(`[handlePickUpCommand] Good reach with ${(maxError*100).toFixed(1)}cm error`);
  } else {
    console.log(`[handlePickUpCommand] Excellent reach with ${(maxError*100).toFixed(1)}cm error`);
  }

  // Build the grasp sequence using IK-calculated angles
  const graspJoints: JointState = {
    base: graspResult.joints.base,
    shoulder: graspResult.joints.shoulder,
    elbow: graspResult.joints.elbow,
    wrist: graspResult.joints.wrist,
    wristRoll: 0,
    gripper: 0,
  };

  const approachJoints: JointState = {
    base: approachResult.joints.base,
    shoulder: approachResult.joints.shoulder,
    elbow: approachResult.joints.elbow,
    wrist: approachResult.joints.wrist,
    wristRoll: 0,
    gripper: 100,
  };

  const liftJoints: JointState = {
    base: liftResult.joints.base,
    shoulder: liftResult.joints.shoulder,
    elbow: liftResult.joints.elbow,
    wrist: liftResult.joints.wrist,
    wristRoll: 0,
    gripper: 0,
  };

  console.log(`[handlePickUpCommand] Approach: base=${approachJoints.base.toFixed(1)}°, shoulder=${approachJoints.shoulder.toFixed(1)}°, elbow=${approachJoints.elbow.toFixed(1)}°, wrist=${approachJoints.wrist.toFixed(1)}°`);
  console.log(`[handlePickUpCommand] Grasp: base=${graspJoints.base.toFixed(1)}°, shoulder=${graspJoints.shoulder.toFixed(1)}°, elbow=${graspJoints.elbow.toFixed(1)}°, wrist=${graspJoints.wrist.toFixed(1)}°`);
  console.log(`[handlePickUpCommand] Lift: base=${liftJoints.base.toFixed(1)}°, shoulder=${liftJoints.shoulder.toFixed(1)}°, elbow=${liftJoints.elbow.toFixed(1)}°, wrist=${liftJoints.wrist.toFixed(1)}°`);

  // Log expected tip positions from our FK
  const expectedGraspPos = calculateGripperPos(graspResult.joints);
  console.log(`[handlePickUpCommand] Expected grasp tip: [${expectedGraspPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  console.log(`[handlePickUpCommand] Object position: [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);

  // Build simple sequence: approach -> grasp -> close -> lift
  const sequence: Partial<JointState>[] = [
    // Step 1: Open gripper
    { gripper: 100 },
    // Step 2: Move to approach position (above object)
    { base: approachJoints.base, shoulder: approachJoints.shoulder, elbow: approachJoints.elbow, wrist: approachJoints.wrist },
    // Step 3: Lower to grasp position
    { base: graspJoints.base, shoulder: graspJoints.shoulder, elbow: graspJoints.elbow, wrist: graspJoints.wrist },
    // Step 4: Close gripper
    { gripper: 0 },
    // Step 5: Hold position with gripper closed (ensure grab registers)
    { base: graspJoints.base, shoulder: graspJoints.shoulder, elbow: graspJoints.elbow, wrist: graspJoints.wrist, gripper: 0 },
    // Step 6: Lift
    { base: liftJoints.base, shoulder: liftJoints.shoulder, elbow: liftJoints.elbow, wrist: liftJoints.wrist, gripper: 0 },
  ];

  console.log('[handlePickUpCommand] FULL SEQUENCE:', JSON.stringify(sequence, null, 2));

  return {
    action: 'sequence',
    joints: sequence,
    description: `Picking up "${objName}" using URDF-based IK.${reachabilityWarning}`,
    code: `// Pick up "${objName}" using URDF-based IK
await openGripper();
await moveJoints({ base: ${approachJoints.base.toFixed(1)}, shoulder: ${approachJoints.shoulder.toFixed(1)}, elbow: ${approachJoints.elbow.toFixed(1)}, wrist: ${approachJoints.wrist.toFixed(1)} }); // Approach
await moveJoints({ base: ${graspJoints.base.toFixed(1)}, shoulder: ${graspJoints.shoulder.toFixed(1)}, elbow: ${graspJoints.elbow.toFixed(1)}, wrist: ${graspJoints.wrist.toFixed(1)} }); // Grasp position
await closeGripper();
await moveJoints({ base: ${liftJoints.base.toFixed(1)}, shoulder: ${liftJoints.shoulder.toFixed(1)}, elbow: ${liftJoints.elbow.toFixed(1)}, wrist: ${liftJoints.wrist.toFixed(1)} }); // Lift`,
  };
}


// Helper function to find an object by name, color, or type from a message
function findObjectByDescription(message: string, objects: SimObject[]): SimObject | null {
  const typeAliases: Record<string, string[]> = {
    cube: ['cube', 'block', 'box', 'square'],
    ball: ['ball', 'sphere', 'round'],
    cylinder: ['cylinder', 'can', 'bottle', 'cup', 'tube'],
  };
  const colorWords = ['red', 'blue', 'green', 'yellow', 'orange', 'white', 'black', 'pink', 'purple'];

  for (const obj of objects) {
    const name = (obj.name || '').toLowerCase();
    const objType = (obj.type || '').toLowerCase();
    const color = (obj.color || '').toLowerCase();
    const words = name.split(/\s+/);
    const messageColor = colorWords.find(c => message.includes(c));
    const typeMatches = typeAliases[objType]?.some(alias => message.includes(alias)) || message.includes(objType);

    if (message.includes(name) ||
        message.includes(obj.id) ||
        words.some(word => word.length > 2 && message.includes(word)) ||
        typeMatches ||
        (messageColor && (name.includes(messageColor) || color.includes(messageColor)))) {
      return obj;
    }
  }
  return null;
}

// Handle "stack on" / "place on top of" commands
function handleStackCommand(
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
  // Remove "stack", "on", "top", "place", "put" to find the target
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

  console.log(`[handleStackCommand] Stack "${heldName}" on "${targetName}" at height ${stackHeight.toFixed(3)}m`);

  // Calculate IK for approach (above the stack position)
  const approachHeight = stackHeight + 0.08;
  const approachIK = calculateInverseKinematics(targetX, approachHeight, targetZ, state);

  // Calculate IK for place position
  const placeIK = calculateInverseKinematics(targetX, stackHeight, targetZ, state);

  // Calculate IK for retreat (lift back up)
  const retreatHeight = stackHeight + 0.1;
  const retreatIK = calculateInverseKinematics(targetX, retreatHeight, targetZ, state);

  if (approachIK && placeIK && retreatIK) {
    console.log(`[handleStackCommand] IK success for stacking at [${targetX.toFixed(3)}, ${stackHeight.toFixed(3)}, ${targetZ.toFixed(3)}]`);
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
  console.log('[handleStackCommand] IK failed, using heuristic fallback');
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

// Handle "move to object" / "go to object" commands
function handleMoveToCommand(
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
    // Maybe they meant a position? Fall through to regular movement
    return {
      action: 'explain',
      description: `I couldn't find "${targetSearch}". Try "move to the [color] [object]" or use basic movement commands.`,
    };
  }

  const [objX, objY, objZ] = targetObject.position;
  const objName = targetObject.name || targetObject.id;

  // Move gripper to hover above the object
  const hoverHeight = Math.max(objY + 0.1, 0.15);

  console.log(`[handleMoveToCommand] Moving to "${objName}" at [${objX.toFixed(3)}, ${hoverHeight.toFixed(3)}, ${objZ.toFixed(3)}]`);

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

function simulateArmResponse(message: string, state: JointState, objects?: SimObject[]): ClaudeResponse {
  console.log('[simulateArmResponse] Processing message:', message);
  const amount = parseAmount(message);

  // Find grabbable objects
  const grabbableObjects = objects?.filter(o => o.isGrabbable && !o.isGrabbed) || [];
  const heldObject = objects?.find(o => o.isGrabbed);

  // IMPORTANT: Check compound commands first (like "pick up") before simple ones (like "up")

  // Pick up / grab objects - check BEFORE checking "up"
  if (message.includes('pick') || message.includes('grab')) {
    console.log('[simulateArmResponse] Detected pick/grab command');
    return handlePickUpCommand(message, grabbableObjects, heldObject);
  }

  // Stack on / place on top of - check BEFORE "place"
  if ((message.includes('stack') || message.includes('place on') || message.includes('put on')) &&
      !message.includes('put down')) {
    return handleStackCommand(message, objects || [], heldObject, state);
  }

  // Move to object position - check BEFORE basic movement commands
  if ((message.includes('move to') || message.includes('go to') || message.includes('reach')) &&
      objects && objects.length > 0) {
    return handleMoveToCommand(message, objects, state);
  }

  // Movement commands - base rotation
  if (message.includes('left') && !message.includes('elbow')) {
    const target = Math.min(state.base + amount, 135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base left to ${target}°`,
      code: `await moveJoint('base', ${target});`,
    };
  }
  if (message.includes('right') && !message.includes('elbow')) {
    const target = Math.max(state.base - amount, -135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base right to ${target}°`,
      code: `await moveJoint('base', ${target});`,
    };
  }

  // Shoulder commands
  if (message.includes('up') || message.includes('raise') || message.includes('lift')) {
    const target = Math.min(state.shoulder + amount, 90);
    return {
      action: 'move',
      joints: { shoulder: target },
      description: `Raising shoulder to ${target}°`,
      code: `await moveJoint('shoulder', ${target});`,
    };
  }
  if (message.includes('down') || message.includes('lower')) {
    const target = Math.max(state.shoulder - amount, -90);
    return {
      action: 'move',
      joints: { shoulder: target },
      description: `Lowering shoulder to ${target}°`,
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
      description: `Bending elbow to ${target}°`,
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
        description: `Rolling wrist to ${target}°`,
        code: `await moveJoint('wristRoll', ${target});`,
      };
    }
    const wristAmount = message.includes('up') ? amount : -amount;
    const target = Math.max(-90, Math.min(90, state.wrist + wristAmount));
    return {
      action: 'move',
      joints: { wrist: target },
      description: `Tilting wrist to ${target}°`,
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
      description: 'Waving hello! 👋',
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
    // Get current gripper position using FK
    const currentGripperPos = calculateSO101GripperPosition(state);
    const [gx, gy, gz] = currentGripperPos;

    // Calculate IK for lowering to place position (lower Y to near table)
    const placeHeight = Math.max(0.05, gy - 0.1); // Lower by 10cm or to table height
    const placeIK = calculateInverseKinematics(gx, placeHeight, gz, state);

    // Calculate IK for lifting back up after placing
    const liftHeight = Math.max(0.15, placeHeight + 0.1);
    const liftIK = calculateInverseKinematics(gx, liftHeight, gz, state);

    if (placeIK && liftIK) {
      console.log(`[place] Using IK to place at [${gx.toFixed(3)}, ${placeHeight.toFixed(3)}, ${gz.toFixed(3)}]`);
      return {
        action: 'sequence',
        joints: [
          { base: placeIK.base, shoulder: placeIK.shoulder, elbow: placeIK.elbow, wrist: placeIK.wrist },
          { gripper: 100 }, // Open gripper to release
          { base: liftIK.base, shoulder: liftIK.shoulder, elbow: liftIK.elbow, wrist: liftIK.wrist },
        ],
        description: `Placing object at [${gx.toFixed(2)}, ${placeHeight.toFixed(2)}, ${gz.toFixed(2)}] using IK`,
        code: `// Place object using inverse kinematics
await moveJoints({ base: ${placeIK.base.toFixed(1)}, shoulder: ${placeIK.shoulder.toFixed(1)}, elbow: ${placeIK.elbow.toFixed(1)}, wrist: ${placeIK.wrist.toFixed(1)} });
await openGripper();
await moveJoints({ base: ${liftIK.base.toFixed(1)}, shoulder: ${liftIK.shoulder.toFixed(1)}, elbow: ${liftIK.elbow.toFixed(1)}, wrist: ${liftIK.wrist.toFixed(1)} });`,
      };
    }

    // Fallback to heuristic if IK fails
    console.log('[place] IK failed, using heuristic fallback');
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
      description: 'Dancing! 🎉',
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
    description: `I'm not sure how to "${message}". ` + getHelpText('arm'),
  };
}

 
function simulateWheeledResponse(message: string, _state: WheeledRobotState): ClaudeResponse {
  if (message.includes('forward') || message.includes('drive')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 150, rightWheelSpeed: 150 },
      duration: 2000,
      description: 'Driving forward',
      code: `forward(150);
await wait(2000);
stop();`,
    };
  }
  if (message.includes('backward') || message.includes('reverse')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: -150, rightWheelSpeed: -150 },
      duration: 2000,
      description: 'Reversing',
      code: `backward(150);
await wait(2000);
stop();`,
    };
  }
  if (message.includes('left')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: -100, rightWheelSpeed: 100 },
      duration: 800,
      description: 'Turning left',
      code: `turnLeft(100);`,
    };
  }
  if (message.includes('right')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 100, rightWheelSpeed: -100 },
      duration: 800,
      description: 'Turning right',
      code: `turnRight(100);`,
    };
  }
  if (message.includes('stop')) {
    return {
      action: 'move',
      wheeledAction: { leftWheelSpeed: 0, rightWheelSpeed: 0 },
      duration: 100,
      description: 'Stopping',
      code: `stop();`,
    };
  }

  return {
    action: 'explain',
    description: getHelpText('wheeled'),
  };
}

function simulateDroneResponse(message: string, state: DroneState): ClaudeResponse {
  if (message.includes('take off') || message.includes('takeoff')) {
    return {
      action: 'move',
      droneAction: { armed: true, throttle: 60, flightMode: 'altitude_hold', position: { x: 0, y: 0.5, z: 0 } },
      duration: 2000,
      description: 'Taking off to 50cm altitude',
      code: `arm();
takeoff(0.5);`,
    };
  }
  if (message.includes('land')) {
    return {
      action: 'move',
      droneAction: { throttle: 20, flightMode: 'land', position: { x: state.position.x, y: 0.05, z: state.position.z } },
      duration: 3000,
      description: 'Landing',
      code: `land();`,
    };
  }
  if (message.includes('hover')) {
    return {
      action: 'move',
      droneAction: { throttle: 50, flightMode: 'position_hold' },
      duration: 1000,
      description: 'Hovering in place',
      code: `hover();`,
    };
  }
  if (message.includes('forward')) {
    return {
      action: 'move',
      droneAction: { rotation: { x: 0, y: state.rotation.y, z: -15 } },
      duration: 1500,
      description: 'Flying forward',
      code: `flyForward(1.0);`,
    };
  }

  return {
    action: 'explain',
    description: getHelpText('drone'),
  };
}

 
function simulateHumanoidResponse(message: string, _state: HumanoidState): ClaudeResponse {
  if (message.includes('wave') || message.includes('hello')) {
    return {
      action: 'move',
      humanoidAction: {
        rightShoulderPitch: -90,
        rightShoulderRoll: 30,
        rightElbow: 45,
      },
      duration: 2000,
      description: 'Waving hello!',
      code: `wave();`,
    };
  }
  if (message.includes('walk') || message.includes('forward')) {
    return {
      action: 'move',
      humanoidAction: { isWalking: true, walkPhase: 0 },
      duration: 3000,
      description: 'Walking forward',
      code: `walk(3);`,
    };
  }
  if (message.includes('squat')) {
    return {
      action: 'move',
      humanoidAction: {
        leftKnee: -60,
        rightKnee: -60,
        leftHipPitch: -30,
        rightHipPitch: -30,
      },
      duration: 1500,
      description: 'Squatting',
      code: `squat();`,
    };
  }
  if (message.includes('reset') || message.includes('stand')) {
    return {
      action: 'move',
      humanoidAction: {
        leftKnee: 0, rightKnee: 0,
        leftHipPitch: 0, rightHipPitch: 0,
        leftShoulderPitch: 0, rightShoulderPitch: 0,
        isWalking: false,
      },
      duration: 1000,
      description: 'Resetting to standing pose',
      code: `resetPose();`,
    };
  }

  return {
    action: 'explain',
    description: getHelpText('humanoid'),
  };
}

// In-memory store for API key (not persisted for security)
let storedApiKey: string | null = null;

/**
 * Set Claude API key
 * Note: For security, API keys are only stored in memory by default.
 * Enable localStorage storage only for development convenience.
 */
export function setClaudeApiKey(key: string | null, persistToStorage = false) {
  storedApiKey = key;
  if (persistToStorage) {
    if (key) {
      // Warn about security implications
      log.warn('Storing API key in localStorage. This is insecure for production use.');
      localStorage.setItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY, key);
    } else {
      localStorage.removeItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
    }
  }
}

/**
 * Get Claude API key from memory or localStorage
 */
export function getClaudeApiKey(): string | null {
  if (storedApiKey) return storedApiKey;
  // Check localStorage as fallback (for development convenience)
  storedApiKey = localStorage.getItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
  return storedApiKey;
}

/**
 * Clear stored API key from both memory and localStorage
 */
export function clearClaudeApiKey(): void {
  storedApiKey = null;
  localStorage.removeItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
}
