/**
 * Claude API Integration for RoboSim
 * Provides real LLM-powered robot control and code generation
 */

import type { JointState, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState } from '../types';
import { SYSTEM_PROMPTS } from '../hooks/useLLMChat';

export interface ClaudeResponse {
  action: 'move' | 'sequence' | 'code' | 'explain' | 'error';
  description: string;
  code?: string;
  joints?: Partial<JointState> | Array<Partial<JointState>>;
  wheeledAction?: Partial<WheeledRobotState>;
  droneAction?: Partial<DroneState>;
  humanoidAction?: Partial<HumanoidState>;
  duration?: number;
}

const CLAUDE_RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "action": "move" | "sequence" | "code" | "explain",
  "description": "Human-readable explanation of what you're doing",
  "code": "Optional: Arduino/JavaScript code for this action",
  "joints": { "base": 0, "shoulder": 0, "elbow": 0, "wrist": 0, "wristRoll": 0, "gripper": 50 },
  "duration": 1000
}

For arm robots, use joints. For wheeled robots, use wheeledAction with leftWheelSpeed, rightWheelSpeed.
For drones, use droneAction with throttle, position, rotation, armed, flightMode.
For humanoids, use humanoidAction with joint names like leftKnee, rightShoulderPitch, etc.
`;

function buildSystemPrompt(robotType: ActiveRobotType, currentState: unknown): string {
  const basePrompt = SYSTEM_PROMPTS[robotType];

  return `${basePrompt}

CURRENT STATE:
${JSON.stringify(currentState, null, 2)}

${CLAUDE_RESPONSE_FORMAT}

Important: Always respond with valid JSON. Be concise but helpful.`;
}

export async function callClaudeAPI(
  message: string,
  robotType: ActiveRobotType,
  currentState: JointState | WheeledRobotState | DroneState | HumanoidState,
  apiKey?: string
): Promise<ClaudeResponse> {
  // If no API key, use the demo mode with simulated responses
  if (!apiKey) {
    return simulateClaudeResponse(message, robotType, currentState);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: buildSystemPrompt(robotType, currentState),
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
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
    console.error('Claude API error:', error);
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
  currentState: unknown
): Promise<ClaudeResponse> {
  // Add realistic delay
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

  const lowerMessage = message.toLowerCase();

  // Common patterns across all robot types
  if (lowerMessage.includes('help') || lowerMessage.includes('what can')) {
    return {
      action: 'explain',
      description: getHelpText(robotType),
    };
  }

  switch (robotType) {
    case 'arm':
      return simulateArmResponse(lowerMessage, currentState as JointState);
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

function simulateArmResponse(message: string, state: JointState): ClaudeResponse {
  const amount = parseAmount(message);

  // Movement commands
  if (message.includes('left')) {
    const target = Math.min(state.base + amount, 135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base left to ${target}°`,
      code: `await moveJoint('base', ${target});`,
    };
  }
  if (message.includes('right')) {
    const target = Math.max(state.base - amount, -135);
    return {
      action: 'move',
      joints: { base: target },
      description: `Rotating base right to ${target}°`,
      code: `await moveJoint('base', ${target});`,
    };
  }
  if (message.includes('up') || message.includes('raise')) {
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

  // Gripper
  if (message.includes('open')) {
    return {
      action: 'move',
      joints: { gripper: 100 },
      description: 'Opening gripper',
      code: `await openGripper();`,
    };
  }
  if (message.includes('close') || message.includes('grab')) {
    return {
      action: 'move',
      joints: { gripper: 0 },
      description: 'Closing gripper',
      code: `await closeGripper();`,
    };
  }

  // Presets
  if (message.includes('wave') || message.includes('hello')) {
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

  if (message.includes('home') || message.includes('reset')) {
    return {
      action: 'move',
      joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, gripper: 50 },
      description: 'Moving to home position',
      code: `await goHome();`,
    };
  }

  if (message.includes('pick')) {
    return {
      action: 'sequence',
      joints: [
        { gripper: 100 },
        { shoulder: -25, elbow: -110 },
        { gripper: 0 },
        { shoulder: 20, elbow: -30 },
      ],
      description: 'Executing pick up motion',
      code: `await openGripper();
await moveJoint('shoulder', -25);
await moveJoint('elbow', -110);
await closeGripper();
await moveJoint('shoulder', 20);`,
    };
  }

  return {
    action: 'explain',
    description: getHelpText('arm'),
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

// Store for API key
let storedApiKey: string | null = null;

export function setClaudeApiKey(key: string | null) {
  storedApiKey = key;
  if (key) {
    localStorage.setItem('robosim-claude-api-key', key);
  } else {
    localStorage.removeItem('robosim-claude-api-key');
  }
}

export function getClaudeApiKey(): string | null {
  if (storedApiKey) return storedApiKey;
  storedApiKey = localStorage.getItem('robosim-claude-api-key');
  return storedApiKey;
}
