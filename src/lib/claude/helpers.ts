/**
 * Helper functions for Claude API responses
 */

import type { JointState, ActiveRobotType, SimObject } from '../../types';
import type { ClaudeResponse, JointAngles } from './types';
import { JOINT_LIMITS, JAW_LOCAL_Z_OFFSET } from './constants';
import { loggers } from '../logger';
import { calculateJawPositionURDF } from '../../components/simulation/SO101KinematicsURDF';

const log = loggers.claude;

/**
 * Parse amount from natural language (e.g., "45 degrees", "a lot")
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
 * Calculate base angle to point at a position
 * Robot faces +Z direction when base=0, positive rotation is counter-clockwise (left)
 */
export function calculateBaseAngleForPosition(x: number, z: number): number {
  // Base=0 points toward +X, Base=90 points toward +Z
  // atan2(z, x) gives angle from X axis toward Z axis
  const angleRad = Math.atan2(z, x);
  const angleDeg = (angleRad * 180) / Math.PI;
  log.debug(`[calculateBaseAngle] x=${x.toFixed(3)}, z=${z.toFixed(3)} => angle=${angleDeg.toFixed(1)}°`);
  return Math.max(-110, Math.min(110, angleDeg));
}

/**
 * Clamp joint angle to its limits
 */
export function clampJoint(jointName: keyof typeof JOINT_LIMITS, value: number): number {
  const limits = JOINT_LIMITS[jointName];
  return Math.max(limits.min, Math.min(limits.max, value));
}

/**
 * Calculate gripper position using URDF-based FK
 * Uses the jaw contact point for IK targeting
 */
export function calculateGripperPos(joints: JointAngles): [number, number, number] {
  return calculateJawPositionURDF(joints);
}

/**
 * Calculate where the TIP needs to be so that JAWS are at target position
 */
export function calculateTipYForJawY(targetY: number, wristAngleDeg: number): number {
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  const jawOffsetY = JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
  return targetY - jawOffsetY;
}

/**
 * Estimate where jaws will be given tip position and wrist angle
 */
export function estimateJawY(tipY: number, wristAngleDeg: number): number {
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  return tipY + JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
}

/**
 * Get help text for a robot type
 */
export function getHelpText(robotType: ActiveRobotType): string {
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

/**
 * Describe current robot state
 */
export function describeState(robotType: ActiveRobotType, state: unknown, objects?: SimObject[]): ClaudeResponse {
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
