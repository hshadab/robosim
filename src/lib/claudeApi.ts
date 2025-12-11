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

const log = loggers.claude;

export interface ClaudeResponse {
  action: 'move' | 'sequence' | 'code' | 'explain' | 'query' | 'error';
  description: string;
  code?: string;
  joints?: Partial<JointState> | Array<Partial<JointState>>;
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
1. Move arm above object position (shoulder ~45°, match base rotation to object angle)
2. Lower arm (shoulder to -20°, elbow to -100°)
3. Close gripper (gripper: 0)
4. Lift back up (shoulder to 30°)

Gripper grab radius is 10cm. Object at X>0 means base should rotate positive (left).
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
  // atan2(x, z) gives angle from Z axis (forward direction)
  // Positive X is to the left, so positive angle rotates left
  const angleRad = Math.atan2(x, z);
  const angleDeg = (angleRad * 180) / Math.PI;
  console.log(`[calculateBaseAngle] x=${x.toFixed(3)}, z=${z.toFixed(3)} => angle=${angleDeg.toFixed(1)}°`);
  return Math.max(-110, Math.min(110, angleDeg));
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

  // Default joint state for IK calculations
  const defaultJoints: JointState = {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    wristRoll: 0,
    gripper: 100,
  };

  // Calculate base angle for the object position
  const baseAngle = Math.atan2(objX, objZ) * (180 / Math.PI);

  // Use inverse kinematics to calculate joint angles for grasp position
  // Grasp position: gripper tip at object center height
  // The object's Y position is its center, so we target that directly
  // The gripper geometry means the tip needs to be AT or slightly BELOW the object center
  const graspHeight = objY; // Target the object center directly
  const graspIK = calculateInverseKinematics(objX, graspHeight, objZ, defaultJoints);

  console.log('[handlePickUpCommand] Grasp IK:', graspIK ?
    `base=${graspIK.base.toFixed(1)}°, shoulder=${graspIK.shoulder.toFixed(1)}°, elbow=${graspIK.elbow.toFixed(1)}°, wrist=${graspIK.wrist.toFixed(1)}°` :
    'FAILED');

  // If grasp IK succeeded, derive approach and lift positions from it
  if (graspIK) {
    // Verify the grasp position is close enough
    const graspPos = calculateSO101GripperPosition(graspIK);
    const graspError = Math.sqrt((graspPos[0]-objX)**2 + (graspPos[1]-graspHeight)**2 + (graspPos[2]-objZ)**2);
    console.log('[handlePickUpCommand] Grasp position:', graspPos, 'error:', (graspError * 1000).toFixed(1), 'mm');

    if (graspError < 0.03) { // Within 3cm
      // For approach and lift, we need positions that are:
      // 1. Directly above the grasp position (same X, Z but higher Y)
      // 2. Gripper pointing downward to avoid batting the object
      //
      // Strategy: Find IK solution for position directly above the object
      // If that fails, move vertically from grasp by adjusting shoulder/elbow equally

      // Try IK for approach position (10cm above object)
      const approachY = Math.max(objY + 0.10, 0.12);
      let approachIK = calculateInverseKinematics(objX, approachY, objZ, defaultJoints);

      // Try IK for lift position (15cm above object)
      const liftY = Math.max(objY + 0.15, 0.18);
      let liftIK = calculateInverseKinematics(objX, liftY, objZ, defaultJoints);

      // If approach IK failed, use a safe "hover" position that's always above the table
      // For close objects (extreme grasp angles), we need a safe approach rather than deriving from grasp
      if (!approachIK) {
        // Use a safe raised position with arm extended toward the object direction
        // The key is to stay above ground while being in the general direction of the object
        approachIK = {
          base: graspIK.base,
          shoulder: 20,   // Slight forward tilt
          elbow: 60,      // Extended downward
          wrist: 30,      // Gripper angled down
          wristRoll: 0,
          gripper: 100,
        };

        // Verify this is above ground and adjust if needed
        let testPos = calculateSO101GripperPosition(approachIK);
        if (testPos[1] < 0.05) {
          // Still too low, use more upright position
          approachIK.shoulder = 30;
          approachIK.elbow = 40;
          approachIK.wrist = 20;
        }
        console.log('[handlePickUpCommand] Using safe hover approach');
      }

      // If lift IK failed, use safe raised position
      if (!liftIK) {
        liftIK = {
          base: graspIK.base,
          shoulder: 30,
          elbow: 50,
          wrist: 20,
          wristRoll: 0,
          gripper: 0,
        };
        console.log('[handlePickUpCommand] Using safe hover lift');
      }

      // Verify positions
      const approachPos = calculateSO101GripperPosition(approachIK);
      const liftPos = calculateSO101GripperPosition(liftIK);
      console.log('[handlePickUpCommand] Approach position:', approachPos);
      console.log('[handlePickUpCommand] Lift position:', liftPos);

      // Ensure approach is above grasp (Y should be higher)
      // If not, adjust until it is
      if (approachPos[1] <= graspPos[1]) {
        console.log('[handlePickUpCommand] Approach not above grasp, adjusting...');
        approachIK.shoulder = Math.min(approachIK.shoulder + 20, 100);
        approachIK.elbow = Math.min(approachIK.elbow + 20, 97);
      }

      console.log('[handlePickUpCommand] Using IK-derived sequence');

      return {
        action: 'sequence',
        joints: [
          { gripper: 100 }, // Open gripper wide
          { base: graspIK.base }, // First rotate base to face object
          { base: approachIK.base, shoulder: approachIK.shoulder, elbow: approachIK.elbow, wrist: approachIK.wrist }, // Approach (above object)
          { base: graspIK.base, shoulder: graspIK.shoulder, elbow: graspIK.elbow, wrist: graspIK.wrist }, // Lower to grasp
          { gripper: 0 }, // Close gripper
          { base: liftIK.base, shoulder: liftIK.shoulder, elbow: liftIK.elbow, wrist: liftIK.wrist }, // Lift object
        ],
        description: `Picking up "${objName}" at [${objX.toFixed(2)}, ${objY.toFixed(2)}, ${objZ.toFixed(2)}] using IK`,
        code: `// Pick up "${objName}" using inverse kinematics
await openGripper();
await moveJoint('base', ${graspIK.base.toFixed(1)}); // Face object
await moveJoints({ base: ${approachIK.base.toFixed(1)}, shoulder: ${approachIK.shoulder.toFixed(1)}, elbow: ${approachIK.elbow.toFixed(1)}, wrist: ${approachIK.wrist.toFixed(1)} }); // Approach
await moveJoints({ base: ${graspIK.base.toFixed(1)}, shoulder: ${graspIK.shoulder.toFixed(1)}, elbow: ${graspIK.elbow.toFixed(1)}, wrist: ${graspIK.wrist.toFixed(1)} }); // Grasp
await closeGripper();
await moveJoints({ base: ${liftIK.base.toFixed(1)}, shoulder: ${liftIK.shoulder.toFixed(1)}, elbow: ${liftIK.elbow.toFixed(1)}, wrist: ${liftIK.wrist.toFixed(1)} }); // Lift`,
      };
    }
  }

  // Fallback: IK failed or grasp error too large
  console.log('[handlePickUpCommand] IK failed or error too large, using search-based fallback');

  // Search for best joints that reach the object
  let bestGrasp = { shoulder: 0, elbow: 0, wrist: 0, error: Infinity };
  for (let shoulder = -100; shoulder <= 100; shoulder += 10) {
    for (let elbow = -97; elbow <= 97; elbow += 10) {
      for (let wrist = -95; wrist <= 95; wrist += 15) {
        const testJoints = { base: baseAngle, shoulder, elbow, wrist, wristRoll: 0, gripper: 100 };
        const pos = calculateSO101GripperPosition(testJoints);
        const error = Math.sqrt((pos[0]-objX)**2 + (pos[1]-objY)**2 + (pos[2]-objZ)**2);
        if (error < bestGrasp.error) {
          bestGrasp = { shoulder, elbow, wrist, error };
        }
      }
    }
  }

  // Fine-tune
  for (let ds = -9; ds <= 9; ds++) {
    for (let de = -9; de <= 9; de++) {
      for (let dw = -14; dw <= 14; dw++) {
        const s = Math.max(-100, Math.min(100, bestGrasp.shoulder + ds));
        const e = Math.max(-97, Math.min(97, bestGrasp.elbow + de));
        const w = Math.max(-95, Math.min(95, bestGrasp.wrist + dw));
        const testJoints = { base: baseAngle, shoulder: s, elbow: e, wrist: w, wristRoll: 0, gripper: 100 };
        const pos = calculateSO101GripperPosition(testJoints);
        const error = Math.sqrt((pos[0]-objX)**2 + (pos[1]-objY)**2 + (pos[2]-objZ)**2);
        if (error < bestGrasp.error) {
          bestGrasp = { shoulder: s, elbow: e, wrist: w, error };
        }
      }
    }
  }

  console.log('[handlePickUpCommand] Best grasp found:', bestGrasp);

  // Derive approach and lift from grasp by adjusting angles
  // Adding to shoulder/elbow raises the arm while keeping it pointed in same direction
  const approachShoulder = Math.min(bestGrasp.shoulder + 25, 100);
  const approachElbow = Math.min(bestGrasp.elbow + 15, 97);
  const approachWrist = Math.min(bestGrasp.wrist + 10, 95);
  const liftShoulder = Math.min(bestGrasp.shoulder + 35, 100);
  const liftElbow = Math.min(bestGrasp.elbow + 20, 97);
  const liftWrist = Math.min(bestGrasp.wrist + 15, 95);

  return {
    action: 'sequence',
    joints: [
      { gripper: 100 },
      { base: baseAngle }, // First rotate to face object
      { base: baseAngle, shoulder: approachShoulder, elbow: approachElbow, wrist: approachWrist },
      { base: baseAngle, shoulder: bestGrasp.shoulder, elbow: bestGrasp.elbow, wrist: bestGrasp.wrist },
      { gripper: 0 },
      { base: baseAngle, shoulder: liftShoulder, elbow: liftElbow, wrist: liftWrist },
    ],
    description: `Picking up "${objName}" at [${objX.toFixed(2)}, ${objY.toFixed(2)}, ${objZ.toFixed(2)}] (search mode, ${(bestGrasp.error * 1000).toFixed(0)}mm error)`,
    code: `// Pick up "${objName}" using grid search
await openGripper();
await moveJoints({ base: ${baseAngle.toFixed(1)}, shoulder: ${approachShoulder}, elbow: ${approachElbow}, wrist: ${approachWrist} }); // Approach
await moveJoints({ base: ${baseAngle.toFixed(1)}, shoulder: ${bestGrasp.shoulder}, elbow: ${bestGrasp.elbow}, wrist: ${bestGrasp.wrist} }); // Grasp
await closeGripper();
await moveJoints({ base: ${baseAngle.toFixed(1)}, shoulder: ${liftShoulder}, elbow: ${liftElbow}, wrist: ${liftWrist} }); // Lift`,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
export function setClaudeApiKey(key: string | null, persistToStorage: boolean = false) {
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
