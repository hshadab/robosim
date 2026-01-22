/**
 * Claude API Integration for RoboSim
 *
 * Provides real LLM-powered robot control and code generation
 * Enhanced with semantic state for natural language understanding
 *
 * This module has been refactored into smaller modules in ./claude/
 * This file now serves as the main entry point and orchestrator.
 *
 * Module structure:
 * - ./claude/types.ts: Type definitions
 * - ./claude/constants.ts: Constants and configuration
 * - ./claude/ikCalculations.ts: IK-related functions
 * - ./claude/pickupSequence.ts: Pickup command handler
 * - ./claude/stackHandler.ts: Stack and move-to handlers
 * - ./claude/multiStepHandler.ts: Multi-step command handler
 * - ./claude/armHandler.ts: Arm response simulation
 * - ./claude/otherRobots.ts: Wheeled, drone, humanoid handlers
 * - ./claude/objectMatching.ts: Object matching utilities
 * - ./claude/helpers.ts: Helper functions
 * - ./claude/apiKey.ts: API key management
 */

import type { JointState, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState, SimObject } from '../types';
import { SYSTEM_PROMPTS } from '../hooks/useLLMChat';
import { generateSemanticState } from './semanticState';
import { API_CONFIG } from './config';
import { loggers } from './logger';
import { findSimilarPickups, getPickupStats } from './pickupExamples';
import { generateFailureContext, getSuggestedAdjustments } from './failureAnalysis';

// Import from refactored modules
import { CLAUDE_RESPONSE_FORMAT } from './claude/constants';
import { simulateArmResponse } from './claude/armHandler';
import { simulateWheeledResponse, simulateDroneResponse, simulateHumanoidResponse } from './claude/otherRobots';
import { describeState, getHelpText } from './claude/helpers';

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
} from './claude/types';

const log = loggers.claude;

/**
 * Build the system prompt for Claude API
 */
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
      for (const obj of grabbableObjects.slice(0, 2)) {
        const similar = findSimilarPickups(obj.type || 'cube', obj.position as [number, number, number], 1);
        if (similar.length > 0) {
          const ex = similar[0];
          const grasp = ex.jointSequence[0];
          if (grasp) {
            similarExamples += `\n   Similar successful pickup: base=${grasp.base?.toFixed(0)}, shoulder=${grasp.shoulder?.toFixed(0)}, elbow=${grasp.elbow?.toFixed(0)}, wrist=${grasp.wrist?.toFixed(0)}`;
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
2. For cubes/balls: use wristRoll=90 (vertical fingers)
3. For cylinders: use wristRoll=0 (horizontal fingers)
4. Close gripper with _gripperOnly:true flag for 800ms physics time
5. Lift AFTER gripper is fully closed

CRITICAL: Gripper grab radius is only 4cm - the object must be precisely between the gripper fingers.
`;

      // Add failure context if there are recent failures
      const failureContext = generateFailureContext();
      if (failureContext) {
        objectsDescription += failureContext;
      }

      // Add suggested adjustments based on failure history
      if (grabbableObjects.length > 0) {
        const suggestions = getSuggestedAdjustments(
          grabbableObjects[0].position as [number, number, number],
          grabbableObjects[0].type || 'cube'
        );
        if (suggestions.length > 0) {
          objectsDescription += `\n# TIPS BASED ON HISTORY\n${suggestions.map(s => `- ${s}`).join('\n')}\n`;
        }
      }
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

/**
 * Call the Claude API with the given message
 */
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

  // For arm manipulation commands, use local IK-based handlers
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

/**
 * Simulated Claude responses for demo mode (no API key)
 * Delegates to specialized handlers based on robot type
 */
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

  // Delegate to specialized handlers
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

// =============================================================================
// API Key Management (delegated to central apiKeys.ts)
// =============================================================================

import {
  getClaudeApiKey as _getClaudeApiKey,
  setClaudeApiKey as _setClaudeApiKey,
  clearClaudeApiKey as _clearClaudeApiKey,
} from './apiKeys';

/**
 * Set Claude API key
 */
export function setClaudeApiKey(key: string | null, _persistToStorage = false) {
  _setClaudeApiKey(key);
}

/**
 * Get Claude API key from localStorage
 */
export function getClaudeApiKey(): string | null {
  return _getClaudeApiKey();
}

/**
 * Clear stored API key
 */
export function clearClaudeApiKey(): void {
  _clearClaudeApiKey();
}
