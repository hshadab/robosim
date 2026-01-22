/**
 * Helper functions for Claude API responses
 *
 * Many of these are now implemented in specialized modules:
 * - ikCalculations.ts: IK-related functions
 * - armHandler.ts: Arm response handling
 *
 * This file re-exports them for backward compatibility.
 */

import type { JointState, ActiveRobotType, SimObject } from '../../types';
import type { ClaudeResponse } from './types';

// Re-export IK-related functions from ikCalculations.ts
export {
  clampJoint,
  calculateGripperPos,
  calculateTipYForJawY,
  estimateJawY,
  calculateBaseAngleForPosition,
} from './ikCalculations';

// Re-export parseAmount from armHandler.ts
export { parseAmount } from './armHandler';

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
