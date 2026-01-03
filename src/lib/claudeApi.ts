/**
 * Claude API Integration for RoboSim
 * Provides real LLM-powered robot control and code generation
 * Enhanced with semantic state for natural language understanding
 *
 * NOTE: This module is being refactored into smaller modules in ./claude/
 * New code should import from './claude' where possible.
 */

import type { JointState, JointSequenceStep, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState, SimObject } from '../types';
import { SYSTEM_PROMPTS } from '../hooks/useLLMChat';
import { generateSemanticState } from './semanticState';
import { API_CONFIG, STORAGE_CONFIG } from './config';
import { loggers } from './logger';
import { calculateInverseKinematics } from '../components/simulation/SO101Kinematics';
import { solveIKAsync } from './ikSolverWorker';
import { findSimilarPickups, getPickupStats, findClosestVerifiedPickup, adaptVerifiedSequence } from './pickupExamples';

// NOTE: Modular versions exist in ./claude/ for new code
// This file still contains local definitions for backwards compatibility
import { CLAUDE_RESPONSE_FORMAT } from './claude/constants';
import { calculateJawPositionURDF, calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';

// Re-export types for backwards compatibility
export type {
  PickupAttemptInfo,
  ClaudeResponse,
  FullRobotState,
  ConversationMessage,
  CallClaudeAPIOptions,
} from './claude/types';

import type {
  ClaudeResponse,
  FullRobotState,
  ConversationMessage,
  CallClaudeAPIOptions,
  PickupAttemptInfo,
} from './claude/types';

import { matchObjectToMessage } from './claude/objectMatching';

const log = loggers.claude;

// NOTE: The following types, interfaces, and helper functions have been moved to ./claude/
// They are imported at the top of this file for backwards compatibility.
// - PickupAttemptInfo, ClaudeResponse, FullRobotState, ConversationMessage, CallClaudeAPIOptions, JointAngles (types)
// - TYPE_ALIASES, COLOR_WORDS, JOINT_LIMITS, IK_ERROR_THRESHOLD, CLAUDE_RESPONSE_FORMAT (constants)
// - matchObjectToMessage, findObjectByDescription (object matching)
// - parseAmount, calculateBaseAngleForPosition, clampJoint, etc. (helpers)
// - simulateWheeledResponse, simulateDroneResponse, simulateHumanoidResponse (other robots)
// - setClaudeApiKey, getClaudeApiKey, clearClaudeApiKey (API key management)

// FullRobotState is now imported from ./claude/types

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
      // Find similar successful pickups for each object
      let similarExamples = '';
      for (const obj of grabbableObjects.slice(0, 2)) { // Limit to first 2 objects
        const similar = findSimilarPickups(obj.type || 'cube', obj.position as [number, number, number], 1);
        if (similar.length > 0) {
          const ex = similar[0];
          const grasp = ex.jointSequence[0];
          if (grasp) {
            similarExamples += `\n   Similar successful pickup: base=${grasp.base?.toFixed(0)}°, shoulder=${grasp.shoulder?.toFixed(0)}°, elbow=${grasp.elbow?.toFixed(0)}°, wrist=${grasp.wrist?.toFixed(0)}°`;
          }
        }
      }

      // Get pickup stats for context
      const stats = getPickupStats();
      const statsInfo = stats.total > 2
        ? `\n(${stats.successful}/${stats.total} pickups successful, ${(stats.successRate * 100).toFixed(0)}% success rate)`
        : '';

      objectsDescription = `
# OBJECTS IN SCENE
${grabbableObjects.map(obj => {
  const pos = obj.position;
  const grabbed = obj.isGrabbed ? ' (CURRENTLY HELD)' : '';
  return `- "${obj.name || obj.id}": ${obj.type || 'object'} at position [${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}]${grabbed}`;
}).join('\n')}
${similarExamples}${statsInfo}

To pick up an object:
1. Rotate base to face the object (base angle = atan2(z, x) in degrees)
2. For cubes/balls: use wristRoll=90° (vertical fingers)
3. For cylinders: use wristRoll=0° (horizontal fingers)
4. Close gripper with _gripperOnly:true flag for 800ms physics time
5. Lift AFTER gripper is fully closed

CRITICAL: Gripper grab radius is only 4cm - the object must be precisely between the gripper fingers.
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

// ConversationMessage and CallClaudeAPIOptions are now imported from ./claude/types

export async function callClaudeAPI(
  message: string,
  robotType: ActiveRobotType,
  fullState: FullRobotState,
  apiKey?: string,
  conversationHistory: ConversationMessage[] = [],
  options: CallClaudeAPIOptions = {}
): Promise<ClaudeResponse> {
  // Get current state based on robot type for demo mode
  const currentState = robotType === 'arm' ? fullState.joints :
                       robotType === 'wheeled' ? fullState.wheeledRobot :
                       robotType === 'drone' ? fullState.drone :
                       fullState.humanoid;

  // For arm manipulation commands (pick, grab, stack, place), use local IK-based handlers
  // UNLESS forceRealAPI is true (for training data generation with real LLM responses)
  if (!options.forceRealAPI) {
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
      log.debug('Using local IK handlers for manipulation command', { message });
      return simulateClaudeResponse(message, robotType, currentState, conversationHistory, fullState.objects);
    }
  }

  // If no API key, use the demo mode with simulated responses
  if (!apiKey) {
    if (options.forceRealAPI) {
      throw new Error('Claude API key required for LLM-driven training data generation');
    }
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

  log.debug('Routing to robot handler', {
    robotType,
    message: lowerMessage,
    objectCount: objects?.length || 0,
  });

  switch (robotType) {
    case 'arm':
      const response = await simulateArmResponse(lowerMessage, currentState as JointState, objects);
      log.debug('Arm response', {
        action: response.action,
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

// Parse height/distance from message (returns meters)
function parseHeight(message: string): number | null {
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

  return null; // No height specified
}

// Parse target joint angle from message: "shoulder to 45", "base 90 degrees"
function parseJointTarget(message: string): { joint: string; angle: number } | null {
  const joints = ['base', 'shoulder', 'elbow', 'wrist', 'wristroll', 'gripper'];

  for (const joint of joints) {
    // Match patterns like "shoulder to 45", "base 90 degrees", "elbow at -30°"
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

// Calculate base angle to point at a position
// Robot faces +Z direction when base=0, positive rotation is counter-clockwise (left)
function calculateBaseAngleForPosition(x: number, z: number): number {
  // Base=0 points toward +X, Base=90 points toward +Z
  // atan2(z, x) gives angle from X axis toward Z axis
  const angleRad = Math.atan2(z, x);
  const angleDeg = (angleRad * 180) / Math.PI;
  log.debug(`[calculateBaseAngle] x=${x.toFixed(3)}, z=${z.toFixed(3)} => angle=${angleDeg.toFixed(1)}°`);
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
/**
 * Calculate position for IK targeting - uses the jaw contact point
 * (offset from gripper_frame_link) so targets align with where the object is grasped.
 */
function calculateGripperPos(joints: JointAngles): [number, number, number] {
  // Use JAW position for IK - this is where the object will be grasped
  return calculateJawPositionURDF(joints);
}

// Numerical IK solver using Web Worker to prevent UI freezes
// Tries multiple starting configurations to avoid local minima
// If fixedBaseAngle is provided, the base angle is locked to that value
// Now also tries nearby base angles if the error is too large
// If preferHorizontalGrasp is true, penalize high wrist angles to get horizontal grasps
async function solveIKForTarget(targetPos: [number, number, number], _maxIter = 1000, fixedBaseAngle?: number, preferHorizontalGrasp = false): Promise<{ joints: JointAngles; error: number }> {
  // Use Web Worker for non-blocking IK solving
  const result = await solveIKAsync(targetPos, {
    maxIter: _maxIter,
    fixedBaseAngle,
    preferHorizontalGrasp,
  });

  log.debug(`[solveIKForTarget] Target: [${(targetPos[0]*100).toFixed(1)}, ${(targetPos[1]*100).toFixed(1)}, ${(targetPos[2]*100).toFixed(1)}]cm`);
  log.debug(`[solveIKForTarget] Result: base=${result.joints.base.toFixed(1)}°, shoulder=${result.joints.shoulder.toFixed(1)}°, elbow=${result.joints.elbow.toFixed(1)}°, wrist=${result.joints.wrist.toFixed(1)}°`);
  log.debug(`[solveIKForTarget] Error: ${(result.error*100).toFixed(2)}cm`);

  // Verify the final position
  const finalPos = calculateGripperPos(result.joints);
  log.debug(`[solveIKForTarget] Achieved: [${(finalPos[0]*100).toFixed(1)}, ${(finalPos[1]*100).toFixed(1)}, ${(finalPos[2]*100).toFixed(1)}]cm`);

  return result;
}

// IK error threshold - if error is larger than this, the position may not be reachable
const IK_ERROR_THRESHOLD = 0.03; // 3cm - positions with larger errors may not be grabbable

// JAW-TIP OFFSET CONSTANT
// The jaw contact point is offset from gripper_frame_link in local gripper coordinates:
// JAW_LOCAL_OFFSET = [-0.0079, 0, 0.0068] in gripper local space
// When gripper is pointing down (wrist ~90°), the Z offset becomes a Y offset in world space
// When gripper is horizontal (wrist ~0°), the Z offset becomes a horizontal offset
const JAW_LOCAL_Z_OFFSET = 0.0068; // 6.8mm forward toward jaw tips in local gripper Z
// X offset kept for reference: -0.0079 (7.9mm to the side)

/**
 * Calculate where the TIP needs to be so that JAWS are at target position
 * @param targetY - Desired jaw Y position (object center height)
 * @param wristAngleDeg - Expected wrist angle (0=horizontal, 90=vertical)
 * @returns Required tip Y position
 */
function calculateTipYForJawY(targetY: number, wristAngleDeg: number): number {
  // When gripper points down (wrist=90°), jaw Z offset becomes Y offset
  // When gripper is horizontal (wrist=0°), jaw Z offset is horizontal (no Y change)
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  const jawOffsetY = JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
  return targetY - jawOffsetY;
}

/**
 * Estimate where jaws will be given tip position and wrist angle
 */
function estimateJawY(tipY: number, wristAngleDeg: number): number {
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  return tipY + JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
}

/**
 * Calculate grasp position using LeRobot-style configurations
 *
 * Based on real SO-101 training data from HuggingFace (lerobot/svla_so101_pickplace):
 *   - shoulder_lift: -99° to -86° (pointing strongly downward)
 *   - elbow_flex: 73° to 100° (bent)
 *   - wrist_flex: ~75° (STEEP angle, NOT horizontal!)
 *   - wrist_roll: -48° to +10°
 *
 * Key insight: Real robot grasps use TOP-DOWN approach with steep wrist (~75°),
 * NOT horizontal side approach. The jaw contact point is offset from gripper_frame.
 */
async function calculateGraspJoints(objX: number, objY: number, objZ: number, baseAngle?: number, forceSideGrasp = false): Promise<{ joints: JointAngles; error: number; achievedY: number }> {
  const MIN_GRASP_HEIGHT = 0.01; // 1cm above floor - allow very low reach

  log.debug(`[calculateGraspJoints] ========================================`);
  log.debug(`[calculateGraspJoints] Object at [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);
  log.debug(`[calculateGraspJoints] Force side grasp: ${forceSideGrasp}`);

  let bestResult = { joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } as JointAngles, error: Infinity };
  let bestAchievedY = 0;
  let bestJawY = 0;
  let bestStrategy = '';

  // STRATEGY 0: For low objects, DIRECTLY target the object position
  // The IK solver with negative wrist angles can reach very low Y
  // These negative wrist poses put the tip/jaw low at object level
  // For side grasps (cylinders), we FORCE horizontal gripper orientation
  log.debug(`[calculateGraspJoints] STRATEGY 0: Direct targeting at object height${forceSideGrasp ? ' (FORCING HORIZONTAL)' : ''}`);

  const directTargets: [number, number, number][] = [
    [objX, objY, objZ],                    // Exact object center
    [objX, objY + 0.01, objZ],             // 1cm above
    [objX, objY + 0.02, objZ],             // 2cm above
    [objX, objY + 0.03, objZ],             // 3cm above
  ];

  for (const target of directTargets) {
    // For side grasps (cylinders), prefer horizontal gripper orientation
    // This ensures the gripper approaches from the side, not top-down
    const result = await solveIKForTarget(target, 1000, baseAngle, forceSideGrasp);
    const achievedPos = calculateGripperPos(result.joints);
    const jawY = estimateJawY(achievedPos[1], result.joints.wrist);

    log.debug(`[calculateGraspJoints] Direct target Y=${(target[1]*100).toFixed(1)}cm: tip=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(jawY*100).toFixed(1)}cm, wrist=${result.joints.wrist.toFixed(1)}°, error=${(result.error*100).toFixed(2)}cm`);

    // For low objects, prefer solutions where JAW height is close to object
    const jawError = Math.abs(jawY - objY);
    const combinedScore = result.error + jawError * 0.5; // Weight jaw accuracy

    if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5 || bestResult.error === Infinity) {
      bestResult = result;
      bestAchievedY = achievedPos[1];
      bestJawY = jawY;
      bestStrategy = `Direct Y=${(target[1]*100).toFixed(1)}cm`;
    }

    if (result.error < 0.02 && jawError < 0.05) {
      log.debug(`[calculateGraspJoints] Good direct solution found!`);
      break;
    }
  }

  // STRATEGY 1: For low objects, try HORIZONTAL grasps
  // Horizontal wrist keeps the approach side-on for low objects
  if (objY < 0.08) {
    log.debug(`[calculateGraspJoints] STRATEGY 1: Horizontal grasp for low object`);

    const horizontalTargets: [number, number, number][] = [
      [objX, objY, objZ],
      [objX, objY + 0.01, objZ],
      [objX, objY + 0.02, objZ],
    ];

    for (const target of horizontalTargets) {
      // Solve with preference for horizontal wrist (wrist < 30°)
      const result = await solveIKForTarget(target, 1000, baseAngle, true); // preferHorizontalGrasp = true
      const achievedPos = calculateGripperPos(result.joints);
      const jawY = estimateJawY(achievedPos[1], result.joints.wrist);
      const jawError = Math.abs(jawY - objY);
      const combinedScore = result.error + jawError * 0.5;

      log.debug(`[calculateGraspJoints] Horizontal target Y=${(target[1]*100).toFixed(1)}cm: tip=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(jawY*100).toFixed(1)}cm, wrist=${result.joints.wrist.toFixed(1)}°, error=${(result.error*100).toFixed(2)}cm`);

      if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5) {
        bestResult = result;
        bestAchievedY = achievedPos[1];
        bestJawY = jawY;
        bestStrategy = `Horizontal Y=${(target[1]*100).toFixed(1)}cm`;
      }

      if (result.error < 0.02 && Math.abs(result.joints.wrist) < 45) {
        log.debug(`[calculateGraspJoints] Good horizontal solution found!`);
        break;
      }
    }
  }

  // STRATEGY 2: Try angled grasps
  log.debug(`[calculateGraspJoints] STRATEGY 2: Angled grasps`);

  const wristAngles = [30, 45, 60]; // Moderate angles only

  for (const wristAngle of wristAngles) {
    const tipY = calculateTipYForJawY(objY, wristAngle);

    if (tipY < MIN_GRASP_HEIGHT) {
      log.debug(`[calculateGraspJoints] Wrist ${wristAngle}° would require tip at Y=${(tipY*100).toFixed(1)}cm - skipping`);
      continue;
    }

    const target: [number, number, number] = [objX, tipY, objZ];
    const result = await solveIKForTarget(target, 1000, baseAngle, false);
    const achievedPos = calculateGripperPos(result.joints);
    const actualJawY = estimateJawY(achievedPos[1], result.joints.wrist);
    const jawError = Math.abs(actualJawY - objY);
    const combinedScore = result.error + jawError * 0.5;

    log.debug(`[calculateGraspJoints] Angled ${wristAngle}°: tip target Y=${(tipY*100).toFixed(1)}cm, achieved=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(actualJawY*100).toFixed(1)}cm, error=${(result.error*100).toFixed(2)}cm`);

    if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5) {
      bestResult = result;
      bestAchievedY = achievedPos[1];
      bestJawY = actualJawY;
      bestStrategy = `Angled ${wristAngle}°`;
    }
  }

  log.debug(`[calculateGraspJoints] ========================================`);
  log.debug(`[calculateGraspJoints] BEST RESULT: ${bestStrategy}`);
  log.debug(`[calculateGraspJoints]   Object Y: ${(objY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Tip Y: ${(bestAchievedY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Jaw Y: ${(bestJawY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Wrist: ${bestResult.joints.wrist.toFixed(1)}°`);
  log.debug(`[calculateGraspJoints]   IK Error: ${(bestResult.error*100).toFixed(2)}cm`);

  // Check if jaws are close to object center
  const jawToObjectError = Math.abs(bestJawY - objY);
  if (jawToObjectError > 0.05) {
    log.warn(`[calculateGraspJoints] WARNING: Jaw-object gap of ${(jawToObjectError*100).toFixed(1)}cm may prevent grasp!`);
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateGraspJoints] WARNING: IK error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold!`);
  }

  return { ...bestResult, achievedY: bestAchievedY };
}

// Calculate approach position DERIVED from grasp joints for smooth vertical descent
// Instead of independent IK (which can find different arm configurations causing sweep),
// we derive approach from grasp by raising the shoulder to lift the arm while keeping similar shape
async function calculateApproachJoints(
  objX: number, objY: number, objZ: number,
  baseAngle: number,
  graspAchievedY?: number,
  graspJoints?: JointAngles,
  forceSideApproach?: boolean
): Promise<{ joints: JointAngles; error: number }> {
  // For SIDE APPROACH: derive approach from grasp joints to ensure smooth horizontal motion
  // Instead of independent IK (which finds different configurations), we modify grasp joints
  // to extend the arm horizontally backward while maintaining similar wrist angle
  if (forceSideApproach && graspJoints) {
    const graspPos = calculateGripperPos(graspJoints);

    log.debug(`[calculateApproachJoints] SIDE APPROACH: grasp pos=[${(graspPos[0]*100).toFixed(1)}, ${(graspPos[1]*100).toFixed(1)}, ${(graspPos[2]*100).toFixed(1)}]cm, wrist=${graspJoints.wrist.toFixed(1)}°`);

    // Try small adjustments to extend arm backward while keeping similar pose
    // Increasing shoulder and reducing elbow extends the arm outward
    const adjustments = [
      { shoulder: 15, elbow: -10, wrist: 0 },   // Slight extension
      { shoulder: 20, elbow: -15, wrist: 0 },   // More extension
      { shoulder: 25, elbow: -20, wrist: -5 },  // Even more
      { shoulder: 30, elbow: -25, wrist: -5 },  // Maximum extension
    ];

    for (const adj of adjustments) {
      const approachJoints: JointAngles = {
        base: graspJoints.base,
        shoulder: clampJoint('shoulder', graspJoints.shoulder + adj.shoulder),
        elbow: clampJoint('elbow', graspJoints.elbow + adj.elbow),
        wrist: clampJoint('wrist', graspJoints.wrist + adj.wrist),
        wristRoll: 0,
      };

      const approachPos = calculateGripperPos(approachJoints);

      // Approach must be at same height (±1cm) but further from base
      const graspDist = Math.sqrt(graspPos[0] ** 2 + graspPos[2] ** 2);
      const approachDist = Math.sqrt(approachPos[0] ** 2 + approachPos[2] ** 2);
      const heightDiff = Math.abs(approachPos[1] - graspPos[1]);

      if (approachDist > graspDist + 0.03 && heightDiff < 0.02) {
        // Good side approach - further out, same height
        const error = Math.sqrt(
          (approachPos[0] - objX) ** 2 +
          (approachPos[2] - objZ) ** 2
        );
        log.debug(`[calculateApproachJoints] SIDE APPROACH SUCCESS: approach=[${(approachPos[0]*100).toFixed(1)}, ${(approachPos[1]*100).toFixed(1)}, ${(approachPos[2]*100).toFixed(1)}]cm, wrist=${approachJoints.wrist.toFixed(1)}°`);
        return { joints: approachJoints, error };
      }
    }

    log.debug(`[calculateApproachJoints] SIDE APPROACH: derived approach failed, trying IK fallback`);

    // Fallback: use IK but constrain to horizontal wrist
    const dirX = objX;
    const dirZ = objZ;
    const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const normX = dirX / dist;
    const normZ = dirZ / dist;

    for (const offset of [0.06, 0.08, 0.05]) {
      const approachX = objX + normX * offset;
      const approachZ = objZ + normZ * offset;
      const approachY = graspPos[1] + 0.005;

      const result = await solveIKForTarget([approachX, approachY, approachZ], 1000, baseAngle, true);
      if (result.error < 0.03 && Math.abs(result.joints.wrist) < 45) {
        log.debug(`[calculateApproachJoints] SIDE APPROACH IK fallback: wrist=${result.joints.wrist.toFixed(1)}°`);
        return result;
      }
    }

    log.debug(`[calculateApproachJoints] SIDE APPROACH failed completely, falling back to vertical`);
  }

  // If we have grasp joints, derive approach from them for smooth vertical motion
  if (graspJoints) {
    // Try different shoulder/elbow adjustments to find one that raises the arm
    const adjustments = [
      { shoulder: 25, elbow: -15, wrist: -5 },   // Primary: raise shoulder, reduce elbow
      { shoulder: 30, elbow: -20, wrist: -10 },  // More aggressive raise
      { shoulder: 20, elbow: -10, wrist: 0 },    // Gentler raise
      { shoulder: 35, elbow: -25, wrist: -15 },  // Very aggressive raise
    ];

    const graspPos = calculateGripperPos(graspJoints);

    for (const adj of adjustments) {
      const approachJoints: JointAngles = {
        base: graspJoints.base,  // Keep same base angle!
        shoulder: clampJoint('shoulder', graspJoints.shoulder + adj.shoulder),
        elbow: clampJoint('elbow', graspJoints.elbow + adj.elbow),
        wrist: clampJoint('wrist', graspJoints.wrist + adj.wrist),
        wristRoll: 0,
      };

      const approachPos = calculateGripperPos(approachJoints);

      // Approach must be at least 4cm higher than grasp for safe descent
      if (approachPos[1] > graspPos[1] + 0.04) {
        const error = Math.sqrt(
          (approachPos[0] - objX) ** 2 +
          (approachPos[2] - objZ) ** 2
        ); // Only measure horizontal error for approach

        log.debug(`[calculateApproachJoints] Derived from grasp: approach Y=${(approachPos[1]*100).toFixed(1)}cm, grasp Y=${(graspPos[1]*100).toFixed(1)}cm, delta=${((approachPos[1]-graspPos[1])*100).toFixed(1)}cm, horiz_error=${(error*100).toFixed(1)}cm`);
        return { joints: approachJoints, error };
      }
    }
    // Fall through to IK-based approach if no derived approach was high enough
    log.debug(`[calculateApproachJoints] All derived approaches too low, falling back to IK`);
  }

  // Fallback: Use IK to find approach position (same X/Z but higher Y)
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  const approachHeights = [
    referenceY + 0.06,  // 6cm above reference
    referenceY + 0.08,  // 8cm above reference
    referenceY + 0.10,  // 10cm above reference
    referenceY + 0.12,  // 12cm above reference
  ];

  let bestResult = await solveIKForTarget([objX, approachHeights[0], objZ], 1000, baseAngle);

  for (const approachY of approachHeights) {
    const approachTarget: [number, number, number] = [objX, approachY, objZ];
    const result = await solveIKForTarget(approachTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    if (result.error < 0.02) {
      log.debug(`[calculateApproachJoints] Found good approach at Y=${(approachY*100).toFixed(1)}cm via IK`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateApproachJoints] WARNING: Best approach error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}

// Calculate lift position with validation (raised after grasping) - KEEP SAME BASE ANGLE to prevent spinning
// Uses achieved grasp Y to determine lift height for consistency
async function calculateLiftJoints(objX: number, objY: number, objZ: number, baseAngle: number, graspAchievedY?: number): Promise<{ joints: JointAngles; error: number }> {
  // Lift straight up from current position - DO NOT change X/Z significantly
  // This prevents the arm from spinning around
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  // Try multiple lift heights - lift high enough to be clearly visible
  const liftHeights = [
    referenceY + 0.15,  // 15cm above reference
    referenceY + 0.18,  // 18cm above reference
    referenceY + 0.20,  // 20cm above reference
    referenceY + 0.12,  // 12cm fallback if higher positions unreachable
  ];

  let bestResult = await solveIKForTarget([objX, liftHeights[0], objZ], 1000, baseAngle);

  for (const liftY of liftHeights) {
    const liftTarget: [number, number, number] = [objX, liftY, objZ];
    const result = await solveIKForTarget(liftTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    // If we found a good solution at a high lift, stop searching
    // Only stop early for the first 3 (high) positions, not the fallback
    if (result.error < 0.02 && liftY >= referenceY + 0.14) {
      log.debug(`[calculateLiftJoints] Found good lift at Y=${(liftY*100).toFixed(1)}cm`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateLiftJoints] WARNING: Best lift error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}

// Helper function to handle pick-up commands (async for IK worker)
async function handlePickUpCommand(
  message: string,
  grabbableObjects: SimObject[],
  heldObject: SimObject | undefined
): Promise<ClaudeResponse> {
  // If we're already holding something
  if (heldObject) {
    return {
      action: 'explain',
      description: `I'm already holding "${heldObject.name || heldObject.id}". Say "drop" or "place" to release it first.`,
    };
  }

  // Find an object to pick up
  if (grabbableObjects.length === 0) {
    log.debug('No grabbable objects found');
    return {
      action: 'explain',
      description: "I don't see any objects to pick up. Try adding an object using the Object Library first.",
    };
  }

  log.debug('Grabbable objects:', grabbableObjects.map(o => ({
    name: o.name,
    type: o.type,
    id: o.id,
    position: o.position,
    isGrabbable: o.isGrabbable
  })));

  // Find closest object or one matching the name/color/type
  let targetObject = grabbableObjects[0];
  let matchFound = false;

  for (const obj of grabbableObjects) {
    const matchResult = matchObjectToMessage(obj, message);
    if (matchResult.match) {
      targetObject = obj;
      matchFound = true;
      log.debug(`Matched object: ${targetObject.name} via ${matchResult.via}`);
      break;
    }
  }

  if (!matchFound) {
    log.debug('No specific match found, using first object:', targetObject.name);
  }

  const [objX, objY, objZ] = targetObject.position;
  const objName = targetObject.name || targetObject.id;
  const objScale = targetObject.scale || 0.04;
  const objType = targetObject.type || 'cube';

  // Calculate horizontal distance from robot base to object
  const distance = Math.sqrt(objX * objX + objZ * objZ);

  // For cylinders: height = 6*scale, radius = 0.5*scale
  // Object center is at Y, bottom is at Y - height/2, top is at Y + height/2
  const cylHeight = objType === 'cylinder' ? objScale * 6 : objScale;
  const cylRadius = objType === 'cylinder' ? objScale * 0.5 : objScale / 2;
  const objBottom = objY - cylHeight / 2;
  const objTop = objY + cylHeight / 2;

  log.debug(`[handlePickUpCommand] ========================================`);
  log.debug(`[handlePickUpCommand] Pick up "${objName}" (${objType})`);
  log.debug(`[handlePickUpCommand]   Scale: ${(objScale*100).toFixed(1)}cm`);
  log.debug(`[handlePickUpCommand]   Position (center): [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);
  log.debug(`[handlePickUpCommand]   Distance from base: ${(distance*100).toFixed(1)}cm`);
  if (objType === 'cylinder') {
    log.debug(`[handlePickUpCommand]   Cylinder height: ${(cylHeight*100).toFixed(1)}cm, radius: ${(cylRadius*100).toFixed(1)}cm`);
    log.debug(`[handlePickUpCommand]   Cylinder bottom: Y=${(objBottom*100).toFixed(1)}cm, top: Y=${(objTop*100).toFixed(1)}cm`);
  }
  log.debug(`[handlePickUpCommand] ========================================`);

  // ========================================
  // VERIFIED EXAMPLE MATCHING (smart demo zone)
  // ========================================
  // Instead of hardcoded position thresholds, search for verified pickup examples
  // that are close to the target position. Use their proven joint sequences.
  // This expands coverage from ~30% to ~70% of the workspace.

  const verifiedMatch = findClosestVerifiedPickup(objType, [objX, objY, objZ], 0.04); // 4cm threshold

  if (verifiedMatch) {
    const { example, distance: matchDistance } = verifiedMatch;
    log.debug(`[handlePickUpCommand] Found verified example "${example.id}" at ${(matchDistance * 100).toFixed(1)}cm distance`);

    // Calculate base angle for the actual object position
    const baseForObject = Math.atan2(objZ, objX) * (180 / Math.PI);

    // Adapt the verified sequence to use the correct base angle
    const adaptedSequence = adaptVerifiedSequence(example, baseForObject);

    log.debug(`[handlePickUpCommand] Using verified sequence with base=${baseForObject.toFixed(1)}°`);

    return {
      action: 'sequence',
      joints: adaptedSequence,
      description: `Picking up "${objName}" using verified motion (matched to ${example.objectName}).`,
      code: `// Verified pickup for "${objName}" (matched example: ${example.id})
// Original position: [${example.objectPosition.map(p => (p * 100).toFixed(0)).join(', ')}]cm
// Target position: [${(objX * 100).toFixed(0)}, ${(objY * 100).toFixed(0)}, ${(objZ * 100).toFixed(0)}]cm
await moveJoints({ base: ${baseForObject.toFixed(1)}, shoulder: ${example.jointSequence[1]?.shoulder ?? -22}, elbow: ${example.jointSequence[1]?.elbow ?? 51}, wrist: ${example.jointSequence[1]?.wrist ?? 63}, wristRoll: 90, gripper: 100 });
await closeGripper();
await liftArm();`,
      pickupAttempt: {
        objectPosition: [objX, objY, objZ],
        objectType: objType,
        objectName: objName,
        objectScale: objScale,
        ikErrors: { approach: 0.005, grasp: matchDistance, lift: 0.005 }, // Minimal error for verified
      } as PickupAttemptInfo,
    };
  }

  // ========================================
  // URDF-BASED IK APPROACH (fallback for other positions)
  // ========================================
  // Use accurate FK from URDF to calculate joint angles via numerical IK.
  // The FK matches the actual robot within 0.1cm accuracy.

  log.debug(`[handlePickUpCommand] Using URDF-based IK approach (object not in Demo zone)`);

  // Target the object's center directly - calculateGraspJoints handles the
  // jaw contact point (offset from gripper_frame). Don't artificially raise the target height
  // as this causes the gripper to close ABOVE the object instead of around it.
  // The calculateGraspJoints function already has a 1cm minimum to prevent floor collision.
  let graspTargetY = objY;
  if (objType === 'cylinder') {
    // Target 1/3 up from bottom instead of center for cylinders
    // This is easier for the arm to reach and gives room for gripper to close
    const graspHeight = objBottom + cylHeight * 0.35;
    graspTargetY = graspHeight;
    log.debug(`[handlePickUpCommand] Cylinder grasp: targeting Y=${(graspTargetY*100).toFixed(1)}cm (1/3 up from bottom)`);
  } else {
    // For cubes/balls, target the object center directly
    log.debug(`[handlePickUpCommand] Object center at Y=${(objY*100).toFixed(1)}cm - targeting directly`);
  }

  // Calculate base angle ONCE and use for all phases to prevent spinning
  // URDF FK coordinate system: base=0° points along +X, base=90° points along +Z
  // So to reach (objX, objZ), we need base = atan2(Z, X)
  const rawBaseAngle = Math.atan2(objZ, objX) * (180 / Math.PI);
  const baseAngle = clampJoint('base', rawBaseAngle);

  // Check if object is within rotation range
  if (Math.abs(rawBaseAngle) > 110) {
    log.warn(`[handlePickUpCommand] WARNING: Object at angle ${rawBaseAngle.toFixed(1)}° is outside base rotation limits (±110°)`);
  }
  log.debug(`[handlePickUpCommand] Fixed base angle: ${baseAngle.toFixed(1)}° for object at X=${(objX*100).toFixed(1)}cm, Z=${(objZ*100).toFixed(1)}cm`);

  // Calculate joint angles for each phase
  // First calculate grasp WITHOUT fixed base angle to find the best configuration
  // Then use the resulting base angle for approach/lift to ensure smooth motion
  // For cylinders, force side grasp (horizontal orientation) to avoid tipping them over
  // For cubes at LOW heights (Y < 5cm), also force side grasp to prevent gripper body passing through
  const isLowObject = graspTargetY < 0.05; // Object center below 5cm
  const forceSideGrasp = objType === 'cylinder' || (objType === 'cube' && isLowObject);
  log.debug(`[handlePickUpCommand] Force side grasp: ${forceSideGrasp} (type=${objType}, isLow=${isLowObject})`);
  const graspResult = await calculateGraspJoints(objX, graspTargetY, objZ, undefined, forceSideGrasp);
  const optimalBaseAngle = graspResult.joints.base;

  log.debug(`[handlePickUpCommand] Optimal base from grasp IK: ${optimalBaseAngle.toFixed(1)}° (nominal was ${baseAngle.toFixed(1)}°)`);

  // Now use the optimal base angle for approach and lift
  // Pass grasp joints to approach so it can derive a smooth vertical descent trajectory
  // Use graspTargetY (adjusted for cylinders) instead of objY
  // Use SIDE approach for low objects to prevent gripper body passing through them
  const approachResult = await calculateApproachJoints(objX, graspTargetY, objZ, optimalBaseAngle, graspResult.achievedY, graspResult.joints, forceSideGrasp);
  const liftResult = await calculateLiftJoints(objX, graspTargetY, objZ, optimalBaseAngle, graspResult.achievedY);

  // Log IK quality
  log.debug(`[handlePickUpCommand] IK errors: approach=${(approachResult.error*100).toFixed(1)}cm, grasp=${(graspResult.error*100).toFixed(1)}cm, lift=${(liftResult.error*100).toFixed(1)}cm`);

  // Check if object is in reachable workspace
  // The arm has a ~4cm X offset due to shoulder_pan joint origin
  // Objects with small X (< 5cm) and large Z (> 10cm) are often unreachable
  const maxError = Math.max(approachResult.error, graspResult.error, liftResult.error);
  let reachabilityWarning = '';

  // ========================================
  // VALIDATION LOOP WITH RETRY
  // ========================================
  // If IK error > 4cm, try multiple retry strategies before falling back
  const IK_FALLBACK_THRESHOLD = 0.04; // 4cm
  const IK_RETRY_THRESHOLD = 0.03; // 3cm - acceptable after retry

  let finalGraspResult = graspResult;
  let finalApproachResult = approachResult;
  let finalLiftResult = liftResult;
  let retryAttempts = 0;
  const maxRetries = 3;

  if (maxError > IK_FALLBACK_THRESHOLD) {
    log.warn(`[handlePickUpCommand] IK error ${(maxError*100).toFixed(1)}cm exceeds threshold, starting validation loop`);

    // RETRY STRATEGY 1: Try different base angles (±5°, ±10°)
    const baseOffsets = [5, -5, 10, -10];
    for (const offset of baseOffsets) {
      if (retryAttempts >= maxRetries) break;
      retryAttempts++;

      const retryBase = clampJoint('base', optimalBaseAngle + offset);
      log.debug(`[handlePickUpCommand] Retry ${retryAttempts}: base offset ${offset > 0 ? '+' : ''}${offset}° (${retryBase.toFixed(1)}°)`);

      const retryGrasp = await calculateGraspJoints(objX, graspTargetY, objZ, retryBase, forceSideGrasp);
      if (retryGrasp.error < finalGraspResult.error) {
        finalGraspResult = retryGrasp;
        finalApproachResult = await calculateApproachJoints(objX, graspTargetY, objZ, retryBase, retryGrasp.achievedY, retryGrasp.joints, forceSideGrasp);
        finalLiftResult = await calculateLiftJoints(objX, graspTargetY, objZ, retryBase, retryGrasp.achievedY);

        const newMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
        log.debug(`[handlePickUpCommand] Retry improved: error ${(newMaxError*100).toFixed(1)}cm`);

        if (newMaxError < IK_RETRY_THRESHOLD) {
          log.info(`[handlePickUpCommand] Retry succeeded with base offset ${offset > 0 ? '+' : ''}${offset}°`);
          break;
        }
      }
    }

    // RETRY STRATEGY 2: Try different grasp heights (±1cm, ±2cm)
    const heightOffsets = [0.01, -0.01, 0.02, -0.02];
    const currentMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);

    if (currentMaxError > IK_RETRY_THRESHOLD) {
      for (const hOffset of heightOffsets) {
        if (retryAttempts >= maxRetries * 2) break;
        retryAttempts++;

        const retryY = Math.max(0.02, graspTargetY + hOffset); // Min 2cm height
        log.debug(`[handlePickUpCommand] Retry ${retryAttempts}: height offset ${(hOffset*100).toFixed(0)}cm (Y=${(retryY*100).toFixed(1)}cm)`);

        const retryGrasp = await calculateGraspJoints(objX, retryY, objZ, undefined, forceSideGrasp);
        if (retryGrasp.error < finalGraspResult.error) {
          finalGraspResult = retryGrasp;
          finalApproachResult = await calculateApproachJoints(objX, retryY, objZ, retryGrasp.joints.base, retryGrasp.achievedY, retryGrasp.joints, forceSideGrasp);
          finalLiftResult = await calculateLiftJoints(objX, retryY, objZ, retryGrasp.joints.base, retryGrasp.achievedY);

          const newMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
          log.debug(`[handlePickUpCommand] Height retry improved: error ${(newMaxError*100).toFixed(1)}cm`);

          if (newMaxError < IK_RETRY_THRESHOLD) {
            log.info(`[handlePickUpCommand] Height retry succeeded with offset ${(hOffset*100).toFixed(0)}cm`);
            break;
          }
        }
      }
    }

    // RETRY STRATEGY 3: Toggle side grasp approach
    const finalMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
    if (finalMaxError > IK_RETRY_THRESHOLD && retryAttempts < maxRetries * 3) {
      const altSideGrasp = !forceSideGrasp;
      log.debug(`[handlePickUpCommand] Retry: toggling side grasp to ${altSideGrasp}`);

      const retryGrasp = await calculateGraspJoints(objX, graspTargetY, objZ, undefined, altSideGrasp);
      if (retryGrasp.error < finalGraspResult.error * 0.8) { // Must be significantly better
        finalGraspResult = retryGrasp;
        finalApproachResult = await calculateApproachJoints(objX, graspTargetY, objZ, retryGrasp.joints.base, retryGrasp.achievedY, retryGrasp.joints, altSideGrasp);
        finalLiftResult = await calculateLiftJoints(objX, graspTargetY, objZ, retryGrasp.joints.base, retryGrasp.achievedY);
        log.info(`[handlePickUpCommand] Side grasp toggle improved result`);
      }
    }

    // After all retries, check if we should fall back to verified examples
    const bestMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);

    if (bestMaxError > IK_FALLBACK_THRESHOLD) {
      log.warn(`[handlePickUpCommand] All retries exhausted, best error ${(bestMaxError*100).toFixed(1)}cm, checking verified fallback`);

      // Try to find a similar successful pickup to use instead
      const similarPickups = findSimilarPickups(objType, [objX, objY, objZ], 1);

      if (similarPickups.length > 0 && similarPickups[0].ikErrors.grasp < 0.02) {
        const fallbackExample = similarPickups[0];
        const fallbackBase = Math.atan2(objZ, objX) * (180 / Math.PI);

        log.info(`[handlePickUpCommand] Falling back to verified example "${fallbackExample.id}" after ${retryAttempts} retries`);

        const fallbackSequence = adaptVerifiedSequence(fallbackExample, fallbackBase);

        return {
          action: 'sequence',
          joints: fallbackSequence,
          description: `Picking up "${objName}" using verified fallback (IK error after ${retryAttempts} retries: ${(bestMaxError*100).toFixed(0)}cm).`,
          code: `// Verified fallback for "${objName}" (IK error: ${(bestMaxError*100).toFixed(0)}cm, ${retryAttempts} retries)
// Using verified example: ${fallbackExample.id}
await moveJoints({ base: ${fallbackBase.toFixed(1)}, ...verifiedGraspAngles });
await closeGripper();
await liftArm();`,
          pickupAttempt: {
            objectPosition: [objX, objY, objZ],
            objectType: objType,
            objectName: objName,
            objectScale: objScale,
            ikErrors: { approach: bestMaxError, grasp: bestMaxError, lift: bestMaxError },
          } as PickupAttemptInfo,
        };
      } else {
        log.warn(`[handlePickUpCommand] No suitable verified fallback, proceeding with best IK result (${(bestMaxError*100).toFixed(1)}cm error)`);
      }
    } else {
      log.info(`[handlePickUpCommand] Validation loop succeeded after ${retryAttempts} retries (${(bestMaxError*100).toFixed(1)}cm error)`);
    }
  }

  // Update results with final validated values
  const validatedGraspResult = finalGraspResult;
  const validatedApproachResult = finalApproachResult;
  const validatedLiftResult = finalLiftResult;
  const validatedMaxError = Math.max(validatedApproachResult.error, validatedGraspResult.error, validatedLiftResult.error);

  // Check for "dead zone" - small X with large Z
  if (Math.abs(objX) < 0.05 && Math.abs(objZ) > 0.10) {
    reachabilityWarning = ` Warning: Object is in a difficult-to-reach zone (small X, large Z). The arm has a ~4cm X offset that limits reach to X < 0.05m at far distances.`;
    log.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (validatedMaxError > 0.06) { // 6cm error - likely unreachable
    reachabilityWarning = ` Warning: Object may be outside arm's reachable workspace (IK error: ${(validatedMaxError*100).toFixed(0)}cm). Try repositioning the object.`;
    log.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (validatedMaxError > 0.04) { // 4cm error - marginal reach
    reachabilityWarning = ` Note: Object is at edge of arm's reach (IK error: ${(validatedMaxError*100).toFixed(0)}cm).`;
  } else if (validatedMaxError > 0.02) {
    log.debug(`[handlePickUpCommand] Good reach with ${(validatedMaxError*100).toFixed(1)}cm error`);
  } else {
    log.debug(`[handlePickUpCommand] Excellent reach with ${(validatedMaxError*100).toFixed(1)}cm error`);
  }

  // Build the grasp sequence using validated IK-calculated angles
  // wristRoll controls gripper finger orientation:
  // - wristRoll=90° = fingers close VERTICALLY (top-down grasp for cubes/balls)
  // - wristRoll=0° = fingers close HORIZONTALLY (side grasp for cylinders)
  // Demo Pick Up uses wristRoll=90 for cubes - this is the working configuration!
  const wristRollAngle = forceSideGrasp ? 0 : 90;  // 90° for cubes/balls, 0° for cylinders

  const graspJoints: JointState = {
    base: validatedGraspResult.joints.base,
    shoulder: validatedGraspResult.joints.shoulder,
    elbow: validatedGraspResult.joints.elbow,
    wrist: validatedGraspResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 0,
  };

  const approachJoints: JointState = {
    base: validatedApproachResult.joints.base,
    shoulder: validatedApproachResult.joints.shoulder,
    elbow: validatedApproachResult.joints.elbow,
    wrist: validatedApproachResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 100,
  };

  const liftJoints: JointState = {
    base: validatedLiftResult.joints.base,
    shoulder: validatedLiftResult.joints.shoulder,
    elbow: validatedLiftResult.joints.elbow,
    wrist: validatedLiftResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 0,
  };

  log.debug(`[handlePickUpCommand] Approach: base=${approachJoints.base.toFixed(1)}°, shoulder=${approachJoints.shoulder.toFixed(1)}°, elbow=${approachJoints.elbow.toFixed(1)}°, wrist=${approachJoints.wrist.toFixed(1)}°`);
  log.debug(`[handlePickUpCommand] Grasp: base=${graspJoints.base.toFixed(1)}°, shoulder=${graspJoints.shoulder.toFixed(1)}°, elbow=${graspJoints.elbow.toFixed(1)}°, wrist=${graspJoints.wrist.toFixed(1)}°`);
  log.debug(`[handlePickUpCommand] Lift: base=${liftJoints.base.toFixed(1)}°, shoulder=${liftJoints.shoulder.toFixed(1)}°, elbow=${liftJoints.elbow.toFixed(1)}°, wrist=${liftJoints.wrist.toFixed(1)}°`);
  log.debug(`[handlePickUpCommand] WristRoll: ${wristRollAngle}° (${forceSideGrasp ? 'horizontal fingers for cylinder' : 'vertical fingers for cube/ball'})`);
  log.debug(`[handlePickUpCommand] Approach type: ${forceSideGrasp ? 'SIDE (horizontal)' : 'VERTICAL (from above)'}`);

  // Log expected tip positions from our FK
  const expectedGraspPos = calculateGripperPos(graspResult.joints);
  const expectedApproachPos = calculateGripperPos(approachResult.joints);
  log.debug(`[handlePickUpCommand] Expected approach tip: [${expectedApproachPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  log.debug(`[handlePickUpCommand] Expected grasp tip: [${expectedGraspPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  log.debug(`[handlePickUpCommand] Object position: [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);

  // Build 5-step sequence with proper approach to avoid knocking cube:
  // 1. Approach position (above object) with gripper open
  // 2. Lower to grasp position
  // 3. Close gripper (SLOW - physics needs time to detect contact)
  // 4. Hold briefly for physics to register grab
  // 5. Lift HIGH
  //
  // Key insight: Demo uses 800ms for gripper close - that's what makes it work!

  const sequence: JointSequenceStep[] = [
    // Step 1: Move to APPROACH position (above object) with gripper open
    {
      base: approachJoints.base,
      shoulder: approachJoints.shoulder,
      elbow: approachJoints.elbow,
      wrist: approachJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 100
    },
    // Step 2: Lower to grasp position (gripper still open)
    {
      base: graspJoints.base,
      shoulder: graspJoints.shoulder,
      elbow: graspJoints.elbow,
      wrist: graspJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 100
    },
    // Step 3: Close gripper ONLY (no arm movement)
    // This step gets extra time via _gripperOnly flag for physics detection
    { gripper: 0, _gripperOnly: true },
    // Step 4: Hold position with gripper closed (physics settle time)
    {
      base: graspJoints.base,
      shoulder: graspJoints.shoulder,
      elbow: graspJoints.elbow,
      wrist: graspJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 0
    },
    // Step 5: Lift HIGH
    {
      base: liftJoints.base,
      shoulder: liftJoints.shoulder,
      elbow: liftJoints.elbow,
      wrist: liftJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 0
    },
  ];

  log.debug('Pick up sequence:', sequence);

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
    // Include pickup attempt info for training data collection
    pickupAttempt: {
      objectPosition: [objX, objY, objZ],
      objectType: objType,
      objectName: objName,
      objectScale: objScale,
      ikErrors: {
        approach: validatedApproachResult.error,
        grasp: validatedGraspResult.error,
        lift: validatedLiftResult.error,
      },
    },
  };
}


// Helper function to find an object by name, color, or type from a message
function findObjectByDescription(message: string, objects: SimObject[]): SimObject | null {
  for (const obj of objects) {
    const matchResult = matchObjectToMessage(obj, message);
    if (matchResult.match) {
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

async function simulateArmResponse(message: string, state: JointState, objects?: SimObject[]): Promise<ClaudeResponse> {
  log.debug('Processing message:', message);
  const amount = parseAmount(message);

  // Find grabbable objects
  const grabbableObjects = objects?.filter(o => o.isGrabbable && !o.isGrabbed) || [];
  const heldObject = objects?.find(o => o.isGrabbed);

  // IMPORTANT: Check compound commands first (like "pick up") before simple ones (like "up")

  // Pick up / grab objects - check BEFORE checking "up"
  if (message.includes('pick') || message.includes('grab')) {
    log.debug('Detected pick/grab command');
    return await handlePickUpCommand(message, grabbableObjects, heldObject);
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

  // Direct joint setting: "shoulder to 45", "base 90 degrees", "set elbow to -30"
  const jointTarget = parseJointTarget(message);
  if (jointTarget) {
    const { joint, angle } = jointTarget;
    // Clamp to joint limits
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
      description: `Setting ${joint} to ${clampedAngle}°`,
      code: `await moveJoint('${joint}', ${clampedAngle});`,
    };
  }

  // Lift to specific height (with held object or just arm)
  // Check for height modifiers: "lift high", "raise to 20cm", "lift very high"
  const targetHeight = parseHeight(message);
  if (targetHeight && (message.includes('lift') || message.includes('raise'))) {
    // Use IK to find joint angles for target height
    // Keep current X/Z, just change Y
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
    const currentGripperPos = calculateGripperPositionURDF(state);
    const [gx, gy, gz] = currentGripperPos;

    // Calculate IK for lowering to place position (lower Y to near table)
    const placeHeight = Math.max(0.05, gy - 0.1); // Lower by 10cm or to table height
    const placeIK = calculateInverseKinematics(gx, placeHeight, gz, state);

    // Calculate IK for lifting back up after placing
    const liftHeight = Math.max(0.15, placeHeight + 0.1);
    const liftIK = calculateInverseKinematics(gx, liftHeight, gz, state);

    if (placeIK && liftIK) {
      log.debug(`[place] Using IK to place at [${gx.toFixed(3)}, ${placeHeight.toFixed(3)}, ${gz.toFixed(3)}]`);
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
 * Validate and clean Claude API key
 */
function cleanApiKey(key: string | null): string | null {
  if (!key) return null;
  // Trim whitespace and newlines
  const cleaned = key.trim().replace(/[\r\n]/g, '');
  if (!cleaned) return null;
  // Log prefix for debugging (never log full key)
  const prefix = cleaned.substring(0, 12);
  log.debug(`API key prefix: ${prefix}...`);
  return cleaned;
}

/**
 * Set Claude API key
 * Note: For security, API keys are only stored in memory by default.
 * Enable localStorage storage only for development convenience.
 */
export function setClaudeApiKey(key: string | null, persistToStorage = false) {
  storedApiKey = cleanApiKey(key);
  if (persistToStorage) {
    if (storedApiKey) {
      // Warn about security implications
      log.warn('Storing API key in localStorage. This is insecure for production use.');
      localStorage.setItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY, storedApiKey);
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
  const stored = localStorage.getItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
  storedApiKey = cleanApiKey(stored);
  // Update storage with cleaned version if needed
  if (stored && storedApiKey && stored !== storedApiKey) {
    localStorage.setItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY, storedApiKey);
  }
  return storedApiKey;
}

/**
 * Clear stored API key from both memory and localStorage
 */
export function clearClaudeApiKey(): void {
  storedApiKey = null;
  localStorage.removeItem(STORAGE_CONFIG.KEYS.CLAUDE_API_KEY);
}
