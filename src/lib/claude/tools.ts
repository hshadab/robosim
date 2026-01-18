/**
 * Claude Tool Use API
 *
 * Defines structured tools for robot control that can be used with
 * Claude's tool_use feature for more reliable command parsing.
 */

import type { JointState, JointSequenceStep } from '../../types';

/**
 * Tool definitions for Claude's tool_use API
 */
export const ROBOT_TOOLS = [
  {
    name: 'execute_pickup',
    description: 'Pick up an object from the scene. The robot will approach, grasp, and lift the object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_object: {
          type: 'string',
          description: 'Name or description of the object to pick up (e.g., "red cube", "cylinder")',
        },
        grasp_type: {
          type: 'string',
          enum: ['vertical', 'horizontal', 'auto'],
          description: 'Gripper orientation: vertical for cubes/balls (wristRoll=90), horizontal for cylinders (wristRoll=0), auto to detect from object type',
        },
        approach_height: {
          type: 'number',
          description: 'Height above object to start approach (meters, default 0.05)',
          minimum: 0.02,
          maximum: 0.15,
        },
        grip_force: {
          type: 'number',
          description: 'Gripper close percentage (0-100, default 0 for full close)',
          minimum: 0,
          maximum: 100,
        },
      },
      required: ['target_object'],
    },
  },
  {
    name: 'execute_place',
    description: 'Place the currently held object at a target position or on another object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target_position: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X position in meters' },
            y: { type: 'number', description: 'Y position (height) in meters' },
            z: { type: 'number', description: 'Z position in meters' },
          },
          required: ['x', 'y', 'z'],
          description: 'Target position to place the object',
        },
        target_object: {
          type: 'string',
          description: 'Name of object to place on top of (alternative to target_position)',
        },
        release_height: {
          type: 'number',
          description: 'Height above target to release object (meters, default 0.02)',
          minimum: 0.01,
          maximum: 0.10,
        },
      },
    },
  },
  {
    name: 'move_to_position',
    description: 'Move the gripper to a specific position in 3D space.',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: {
          type: 'number',
          description: 'X position in meters (distance from robot base)',
          minimum: 0.08,
          maximum: 0.25,
        },
        y: {
          type: 'number',
          description: 'Y position (height) in meters',
          minimum: 0.0,
          maximum: 0.30,
        },
        z: {
          type: 'number',
          description: 'Z position in meters (left-right, negative=left)',
          minimum: -0.15,
          maximum: 0.15,
        },
        gripper_open: {
          type: 'boolean',
          description: 'Whether gripper should be open (true) or closed (false)',
        },
      },
      required: ['x', 'y', 'z'],
    },
  },
  {
    name: 'set_joints',
    description: 'Set specific joint angles directly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        base: {
          type: 'number',
          description: 'Base rotation in degrees (-110 to 110)',
          minimum: -110,
          maximum: 110,
        },
        shoulder: {
          type: 'number',
          description: 'Shoulder angle in degrees (-100 to 100)',
          minimum: -100,
          maximum: 100,
        },
        elbow: {
          type: 'number',
          description: 'Elbow angle in degrees (-97 to 97)',
          minimum: -97,
          maximum: 97,
        },
        wrist: {
          type: 'number',
          description: 'Wrist angle in degrees (-95 to 95)',
          minimum: -95,
          maximum: 95,
        },
        wristRoll: {
          type: 'number',
          description: 'Wrist roll in degrees (-157 to 163)',
          minimum: -157,
          maximum: 163,
        },
        gripper: {
          type: 'number',
          description: 'Gripper position (0=closed, 100=open)',
          minimum: 0,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'execute_sequence',
    description: 'Execute a sequence of joint movements. Use for complex multi-step motions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              base: { type: 'number' },
              shoulder: { type: 'number' },
              elbow: { type: 'number' },
              wrist: { type: 'number' },
              wristRoll: { type: 'number' },
              gripper: { type: 'number' },
              _gripperOnly: {
                type: 'boolean',
                description: 'Set to true for gripper-only steps (requires 800ms duration)',
              },
              _duration: {
                type: 'number',
                description: 'Duration for this step in milliseconds',
              },
            },
          },
          description: 'Array of joint configurations to execute in sequence',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the sequence',
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'go_home',
    description: 'Move the robot arm to its home/neutral position.',
    input_schema: {
      type: 'object' as const,
      properties: {
        gripper_open: {
          type: 'boolean',
          description: 'Whether to open gripper when going home (default true)',
        },
      },
    },
  },
  {
    name: 'open_gripper',
    description: 'Open the gripper to release an object or prepare for grasping.',
    input_schema: {
      type: 'object' as const,
      properties: {
        percentage: {
          type: 'number',
          description: 'How much to open (0-100, default 100 for fully open)',
          minimum: 0,
          maximum: 100,
        },
      },
    },
  },
  {
    name: 'close_gripper',
    description: 'Close the gripper to grasp an object.',
    input_schema: {
      type: 'object' as const,
      properties: {
        percentage: {
          type: 'number',
          description: 'How much to close (0=fully closed, 100=open, default 0)',
          minimum: 0,
          maximum: 100,
        },
        duration: {
          type: 'number',
          description: 'Duration in milliseconds (minimum 800 for physics detection)',
          minimum: 800,
          maximum: 2000,
        },
      },
    },
  },
  {
    name: 'get_state',
    description: 'Get the current state of the robot arm and scene.',
    input_schema: {
      type: 'object' as const,
      properties: {
        include_objects: {
          type: 'boolean',
          description: 'Whether to include objects in the scene',
        },
        include_held_object: {
          type: 'boolean',
          description: 'Whether to include info about currently held object',
        },
      },
    },
  },
];

/**
 * Tool call result types
 */
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  joints?: JointState | JointSequenceStep[];
  description?: string;
}

/**
 * Parse a tool call and convert to ClaudeResponse format
 */
export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Convert tool call to joint sequence
 */
export function toolCallToSequence(
  toolCall: ToolCall,
  currentJoints: JointState
): { joints: JointSequenceStep[]; description: string } | null {
  switch (toolCall.name) {
    case 'set_joints': {
      const input = toolCall.input as Partial<JointState>;
      return {
        joints: [{ ...currentJoints, ...input }],
        description: 'Setting joint angles',
      };
    }

    case 'execute_sequence': {
      const input = toolCall.input as { steps: JointSequenceStep[]; description?: string };
      return {
        joints: input.steps,
        description: input.description || 'Executing sequence',
      };
    }

    case 'go_home': {
      const input = toolCall.input as { gripper_open?: boolean };
      const gripperValue = input.gripper_open !== false ? 100 : 0;
      return {
        joints: [{ base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: gripperValue }],
        description: 'Moving to home position',
      };
    }

    case 'open_gripper': {
      const input = toolCall.input as { percentage?: number };
      return {
        joints: [{ gripper: input.percentage ?? 100 }],
        description: 'Opening gripper',
      };
    }

    case 'close_gripper': {
      const input = toolCall.input as { percentage?: number; duration?: number };
      return {
        joints: [{
          gripper: input.percentage ?? 0,
          _gripperOnly: true,
          _duration: input.duration ?? 800,
        }],
        description: 'Closing gripper',
      };
    }

    default:
      return null;
  }
}

/**
 * Get tool definitions for API call
 */
export function getToolDefinitions() {
  return ROBOT_TOOLS;
}

/**
 * Validate tool call input against schema
 */
export function validateToolCall(toolCall: ToolCall): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const tool = ROBOT_TOOLS.find(t => t.name === toolCall.name);

  if (!tool) {
    errors.push(`Unknown tool: ${toolCall.name}`);
    return { valid: false, errors };
  }

  const schema = tool.input_schema;
  const input = toolCall.input;

  // Check required properties
  if (schema.required) {
    for (const prop of schema.required) {
      if (!(prop in input)) {
        errors.push(`Missing required property: ${prop}`);
      }
    }
  }

  // Check property types and ranges
  const properties = schema.properties as Record<string, {
    type?: string;
    minimum?: number;
    maximum?: number;
  }>;

  for (const [key, value] of Object.entries(input)) {
    const propSchema = properties[key];
    if (!propSchema) continue;

    if (propSchema.type === 'number' && typeof value === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        errors.push(`${key} must be >= ${propSchema.minimum}, got ${value}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        errors.push(`${key} must be <= ${propSchema.maximum}, got ${value}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format tool for system prompt
 */
export function formatToolsForPrompt(): string {
  const lines = ['# AVAILABLE TOOLS', ''];

  for (const tool of ROBOT_TOOLS) {
    lines.push(`## ${tool.name}`);
    lines.push(tool.description);

    const props = tool.input_schema.properties as Record<string, { description?: string; type?: string }>;
    const required = tool.input_schema.required || [];

    lines.push('Parameters:');
    for (const [name, schema] of Object.entries(props)) {
      const reqMarker = required.includes(name) ? ' (required)' : '';
      lines.push(`  - ${name}${reqMarker}: ${schema.description || schema.type || 'any'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
