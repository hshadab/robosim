/**
 * Semantic State Provider
 * Translates raw robot state into natural language for LLM context
 */

import type {
  JointState,
  WheeledRobotState,
  DroneState,
  HumanoidState,
  ActiveRobotType,
  SensorReading
} from '../types';
import { robotContext, type RobotEvent } from './robotContext';
import { calculateSO101GripperPosition } from '../components/simulation/SO101Kinematics';

// Direction descriptions
function describeAngle(angle: number, axis: 'horizontal' | 'vertical' | 'rotation'): string {
  const absAngle = Math.abs(angle);

  if (absAngle < 5) {
    return axis === 'rotation' ? 'facing forward' :
           axis === 'horizontal' ? 'centered' : 'level';
  }

  const intensity = absAngle < 20 ? 'slightly' :
                    absAngle < 45 ? 'moderately' :
                    absAngle < 70 ? 'significantly' : 'fully';

  if (axis === 'rotation') {
    return `rotated ${intensity} ${angle > 0 ? 'left' : 'right'} (${Math.round(angle)}°)`;
  } else if (axis === 'horizontal') {
    return `${intensity} ${angle > 0 ? 'raised' : 'lowered'} (${Math.round(angle)}°)`;
  } else {
    return `${intensity} ${angle > 0 ? 'extended' : 'bent'} (${Math.round(angle)}°)`;
  }
}

function describeGripper(value: number): string {
  if (value > 90) return 'fully open';
  if (value > 70) return 'mostly open';
  if (value > 40) return 'half open';
  if (value > 15) return 'mostly closed';
  return 'fully closed (gripping)';
}

function describePosition(pos: { x: number; y: number; z: number }): string {
  const descriptions: string[] = [];

  // Height
  if (pos.y > 0.25) descriptions.push('high up');
  else if (pos.y > 0.15) descriptions.push('at medium height');
  else if (pos.y > 0.05) descriptions.push('low');
  else descriptions.push('near the base');

  // Reach
  const reach = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
  if (reach > 0.25) descriptions.push('extended far forward');
  else if (reach > 0.15) descriptions.push('reaching forward');
  else if (reach > 0.08) descriptions.push('close to body');
  else descriptions.push('retracted');

  // Side
  if (Math.abs(pos.x) > 0.05) {
    descriptions.push(pos.x > 0 ? 'to the left' : 'to the right');
  }

  return descriptions.join(', ');
}

function formatDistance(cm: number): string {
  if (cm > 300) return 'nothing detected (clear path)';
  if (cm > 100) return `obstacle far ahead (~${Math.round(cm)}cm)`;
  if (cm > 50) return `obstacle ahead (~${Math.round(cm)}cm)`;
  if (cm > 20) return `obstacle nearby (~${Math.round(cm)}cm)`;
  return `obstacle very close (${Math.round(cm)}cm) - caution!`;
}

// Generate semantic description for arm robot
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function describeArmState(joints: JointState, _sensors: SensorReading): string {
  const lines: string[] = [];

  // Overall pose
  lines.push('## Current Arm State');

  // Base rotation
  lines.push(`- **Base**: ${describeAngle(joints.base, 'rotation')}`);

  // Shoulder
  lines.push(`- **Shoulder**: ${describeAngle(joints.shoulder, 'horizontal')}`);

  // Elbow
  const elbowDesc = joints.elbow < -80 ? 'tightly folded' :
                    joints.elbow < -40 ? 'bent inward' :
                    joints.elbow > 20 ? 'extended outward' : 'relaxed position';
  lines.push(`- **Elbow**: ${elbowDesc} (${Math.round(joints.elbow)}°)`);

  // Wrist
  lines.push(`- **Wrist**: ${describeAngle(joints.wrist, 'vertical')}`);

  // Wrist roll
  if (Math.abs(joints.wristRoll) > 10) {
    lines.push(`- **Wrist Roll**: ${describeAngle(joints.wristRoll, 'rotation')}`);
  }

  // Gripper
  lines.push(`- **Gripper**: ${describeGripper(joints.gripper)}`);

  // End effector position (computed via FK)
  try {
    const [x, y, z] = calculateSO101GripperPosition(joints);
    const eePos = { x, y, z };
    lines.push('');
    lines.push(`## End Effector Position`);
    lines.push(`The gripper is ${describePosition(eePos)}.`);
    lines.push(`Coordinates: (${eePos.x.toFixed(3)}m, ${eePos.y.toFixed(3)}m, ${eePos.z.toFixed(3)}m)`);
  } catch {
    // FK not available, skip position
  }

  return lines.join('\n');
}

// Generate semantic description for wheeled robot
function describeWheeledState(state: WheeledRobotState, sensors: SensorReading): string {
  const lines: string[] = [];

  lines.push('## Current Wheeled Robot State');

  // Motion state
  if (state.leftWheelSpeed === 0 && state.rightWheelSpeed === 0) {
    lines.push('- **Motion**: Stationary');
  } else if (state.leftWheelSpeed === state.rightWheelSpeed) {
    const dir = state.leftWheelSpeed > 0 ? 'forward' : 'backward';
    const speed = Math.abs(state.leftWheelSpeed);
    const intensity = speed > 200 ? 'fast' : speed > 100 ? 'moderate' : 'slow';
    lines.push(`- **Motion**: Moving ${dir} at ${intensity} speed`);
  } else if (state.leftWheelSpeed === -state.rightWheelSpeed) {
    const dir = state.leftWheelSpeed < 0 ? 'left' : 'right';
    lines.push(`- **Motion**: Spinning ${dir} in place`);
  } else {
    const primary = state.leftWheelSpeed + state.rightWheelSpeed > 0 ? 'forward' : 'backward';
    const turn = state.leftWheelSpeed > state.rightWheelSpeed ? 'right' : 'left';
    lines.push(`- **Motion**: Moving ${primary} while turning ${turn}`);
  }

  // Position and heading
  lines.push(`- **Position**: (${state.position.x.toFixed(2)}, ${state.position.z.toFixed(2)})m`);
  lines.push(`- **Heading**: ${Math.round(state.heading)}° from forward`);

  // Servo head
  if (state.servoHead !== 0) {
    const headDir = state.servoHead > 0 ? 'left' : 'right';
    lines.push(`- **Ultrasonic Head**: Looking ${headDir} (${Math.round(state.servoHead)}°)`);
  }

  // Sensors
  lines.push('');
  lines.push('## Sensors');
  lines.push(`- **Ultrasonic**: ${formatDistance(sensors.ultrasonic ?? 400)}`);

  const irStatus = [];
  if (sensors.leftIR) irStatus.push('left');
  if (sensors.centerIR) irStatus.push('center');
  if (sensors.rightIR) irStatus.push('right');

  if (irStatus.length === 0) {
    lines.push('- **Line Sensors**: No line detected');
  } else if (irStatus.length === 3) {
    lines.push('- **Line Sensors**: On the line (all sensors active)');
  } else {
    lines.push(`- **Line Sensors**: Line detected on ${irStatus.join(' and ')}`);
  }

  lines.push(`- **Battery**: ${sensors.battery ?? 100}%`);

  return lines.join('\n');
}

// Generate semantic description for drone
function describeDroneState(state: DroneState): string {
  const lines: string[] = [];

  lines.push('## Current Drone State');

  // Armed status
  lines.push(`- **Status**: ${state.armed ? 'ARMED and ready' : 'Disarmed (safe)'}`);
  lines.push(`- **Flight Mode**: ${state.flightMode.replace('_', ' ')}`);

  // Altitude
  const altDesc = state.position.y > 2 ? 'high altitude' :
                  state.position.y > 1 ? 'medium altitude' :
                  state.position.y > 0.3 ? 'low altitude' :
                  state.position.y > 0.1 ? 'hovering low' : 'on ground';
  lines.push(`- **Altitude**: ${altDesc} (${state.position.y.toFixed(2)}m)`);

  // Position
  lines.push(`- **Position**: (${state.position.x.toFixed(2)}, ${state.position.z.toFixed(2)})m from origin`);

  // Throttle
  if (state.armed) {
    const throttleDesc = state.throttle > 80 ? 'high power' :
                         state.throttle > 50 ? 'medium power' :
                         state.throttle > 20 ? 'low power' : 'idle';
    lines.push(`- **Throttle**: ${throttleDesc} (${Math.round(state.throttle)}%)`);
  }

  // Attitude
  if (Math.abs(state.rotation.x) > 5 || Math.abs(state.rotation.z) > 5) {
    const pitchDesc = state.rotation.z < -5 ? 'pitching forward' :
                      state.rotation.z > 5 ? 'pitching backward' : '';
    const rollDesc = state.rotation.x < -5 ? 'rolling left' :
                     state.rotation.x > 5 ? 'rolling right' : '';
    const attitude = [pitchDesc, rollDesc].filter(Boolean).join(', ');
    if (attitude) lines.push(`- **Attitude**: ${attitude}`);
  }

  return lines.join('\n');
}

// Generate semantic description for humanoid
function describeHumanoidState(state: HumanoidState): string {
  const lines: string[] = [];

  lines.push('## Current Humanoid State');

  // Walking status
  if (state.isWalking) {
    lines.push('- **Activity**: Walking');
  } else {
    // Check pose
    const isSquatting = state.leftKnee < -30 && state.rightKnee < -30;
    const armsRaised = state.leftShoulderPitch < -45 || state.rightShoulderPitch < -45;

    if (isSquatting) {
      lines.push('- **Pose**: Squatting');
    } else if (armsRaised) {
      const which = state.leftShoulderPitch < -45 && state.rightShoulderPitch < -45
        ? 'both arms' : state.leftShoulderPitch < -45 ? 'left arm' : 'right arm';
      lines.push(`- **Pose**: Standing with ${which} raised`);
    } else {
      lines.push('- **Pose**: Standing upright');
    }
  }

  // Leg positions
  if (Math.abs(state.leftKnee) > 15 || Math.abs(state.rightKnee) > 15) {
    lines.push(`- **Knees**: Left ${Math.round(state.leftKnee)}°, Right ${Math.round(state.rightKnee)}°`);
  }

  // Arm positions
  if (Math.abs(state.leftShoulderPitch) > 15 || Math.abs(state.rightShoulderPitch) > 15) {
    lines.push(`- **Shoulders**: Left ${Math.round(state.leftShoulderPitch)}°, Right ${Math.round(state.rightShoulderPitch)}°`);
  }

  return lines.join('\n');
}

// Format recent events for context
function describeRecentEvents(events: RobotEvent[]): string {
  if (events.length === 0) return '';

  const lines: string[] = ['', '## Recent Events'];

  const eventDescriptions: Record<string, string> = {
    motion_started: 'Started moving',
    motion_completed: 'Completed movement',
    motion_cancelled: 'Movement was cancelled',
    target_reached: 'Reached target position',
    collision_detected: 'Collision detected!',
    limit_reached: 'Hit joint limit',
    gripper_opened: 'Gripper opened',
    gripper_closed: 'Gripper closed',
    object_grasped: 'Object grasped',
    object_released: 'Object released',
    sensor_triggered: 'Sensor triggered',
    error: 'Error occurred',
    idle: 'Now idle',
    task_started: 'Started task',
    task_completed: 'Completed task',
    task_failed: 'Task failed',
  };

  // Show last 5 events
  events.slice(0, 5).forEach(event => {
    const desc = eventDescriptions[event.type] || event.type;
    const detail = event.details ? `: ${event.details}` : '';
    const ago = Math.round((Date.now() - event.timestamp.getTime()) / 1000);
    const timeStr = ago < 5 ? 'just now' : `${ago}s ago`;
    lines.push(`- ${desc}${detail} (${timeStr})`);
  });

  return lines.join('\n');
}

/**
 * Generate complete semantic state for LLM context
 */
export function generateSemanticState(
  robotType: ActiveRobotType,
  joints: JointState,
  wheeled: WheeledRobotState,
  drone: DroneState,
  humanoid: HumanoidState,
  sensors: SensorReading,
  isAnimating: boolean
): string {
  const context = robotContext.getState();
  let stateDescription: string;

  switch (robotType) {
    case 'arm':
      stateDescription = describeArmState(joints, sensors);
      break;
    case 'wheeled':
      stateDescription = describeWheeledState(wheeled, sensors);
      break;
    case 'drone':
      stateDescription = describeDroneState(drone);
      break;
    case 'humanoid':
      stateDescription = describeHumanoidState(humanoid);
      break;
    default:
      stateDescription = '(Unknown robot type)';
  }

  // Add status
  const statusLines: string[] = ['', '## Status'];
  if (isAnimating) {
    statusLines.push('- **Currently**: Executing movement');
    if (context.currentTask) {
      statusLines.push(`- **Task**: ${context.currentTask}`);
    }
  } else {
    statusLines.push('- **Currently**: Idle, awaiting commands');
  }

  if (context.lastAction) {
    const ago = context.lastActionTime
      ? Math.round((Date.now() - context.lastActionTime.getTime()) / 1000)
      : 0;
    statusLines.push(`- **Last Action**: ${context.lastAction} (${ago}s ago)`);
  }

  // Add recent events
  const eventsDescription = describeRecentEvents(context.recentEvents);

  return `${stateDescription}\n${statusLines.join('\n')}${eventsDescription}`;
}

/**
 * Generate a brief one-liner status for quick context
 */
export function generateBriefStatus(
  robotType: ActiveRobotType,
  joints: JointState,
  isAnimating: boolean
): string {
  if (isAnimating) {
    return 'Robot is currently moving...';
  }

  if (robotType === 'arm') {
    const gripperStatus = joints.gripper > 80 ? 'open' :
                          joints.gripper < 20 ? 'closed' : 'partial';
    return `Arm idle. Base: ${Math.round(joints.base)}°, Gripper: ${gripperStatus}`;
  }

  return 'Robot is idle and ready for commands.';
}

/**
 * Generate an event message for chat display
 */
export function eventToMessage(event: RobotEvent): string {
  const messages: Record<string, string> = {
    motion_started: 'Starting movement...',
    motion_completed: 'Movement complete.',
    target_reached: 'Target position reached.',
    collision_detected: 'Warning: Collision detected!',
    limit_reached: 'Joint limit reached.',
    gripper_opened: 'Gripper opened.',
    gripper_closed: 'Gripper closed.',
    object_grasped: 'Object grasped successfully.',
    object_released: 'Object released.',
    task_started: `Starting: ${event.details || 'task'}`,
    task_completed: `Completed: ${event.details || 'task'}`,
    task_failed: `Failed: ${event.details || 'unknown error'}`,
    error: `Error: ${event.details || 'unknown'}`,
  };

  return messages[event.type] || `Event: ${event.type}`;
}
