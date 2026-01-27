/**
 * Simulation Code Parser
 *
 * Parses JavaScript simulation code into structured commands
 * for code generation across target platforms.
 */

export interface ParsedCommand {
  type: 'move_joint' | 'set_gripper' | 'go_home' | 'wait' | 'print' |
        'forward' | 'backward' | 'turn_left' | 'turn_right' | 'stop' |
        'set_wheels' | 'set_servo' | 'read_ultrasonic' | 'read_ir' |
        'arm' | 'disarm' | 'takeoff' | 'land' | 'set_throttle' |
        'loop_start' | 'loop_end' | 'if_start' | 'if_end' | 'else' |
        'variable' | 'unknown';
  args: (string | number)[];
  raw: string;
}

/**
 * Parse simulation JavaScript into structured commands
 */
export function parseSimulationCode(code: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('//')) continue;

    const moveJointMatch = trimmed.match(/await\s+moveJoint\s*\(\s*['"](\w+)['"]\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (moveJointMatch) {
      commands.push({
        type: 'move_joint',
        args: [moveJointMatch[1], parseFloat(moveJointMatch[2])],
        raw: trimmed,
      });
      continue;
    }

    const moveJointsMatch = trimmed.match(/await\s+moveJoints\s*\(\s*\{([^}]+)\}/);
    if (moveJointsMatch) {
      const jointPairs = moveJointsMatch[1].match(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/g);
      if (jointPairs) {
        for (const pair of jointPairs) {
          const [, name, value] = pair.match(/(\w+)\s*:\s*(-?\d+(?:\.\d+)?)/) || [];
          if (name && value) {
            commands.push({
              type: 'move_joint',
              args: [name, parseFloat(value)],
              raw: trimmed,
            });
          }
        }
      }
      continue;
    }

    if (trimmed.includes('goHome()')) {
      commands.push({ type: 'go_home', args: [], raw: trimmed });
      continue;
    }

    if (trimmed.includes('openGripper()')) {
      commands.push({ type: 'set_gripper', args: [100], raw: trimmed });
      continue;
    }
    if (trimmed.includes('closeGripper()')) {
      commands.push({ type: 'set_gripper', args: [0], raw: trimmed });
      continue;
    }
    const setGripperMatch = trimmed.match(/setGripper\s*\(\s*(\d+)/);
    if (setGripperMatch) {
      commands.push({ type: 'set_gripper', args: [parseInt(setGripperMatch[1])], raw: trimmed });
      continue;
    }

    const waitMatch = trimmed.match(/await\s+wait\s*\(\s*(\d+)/);
    if (waitMatch) {
      commands.push({ type: 'wait', args: [parseInt(waitMatch[1])], raw: trimmed });
      continue;
    }

    const printMatch = trimmed.match(/print\s*\((.+)\)/);
    if (printMatch) {
      commands.push({ type: 'print', args: [printMatch[1]], raw: trimmed });
      continue;
    }

    const forwardMatch = trimmed.match(/(?:await\s+)?forward\s*\(\s*(\d+)/);
    if (forwardMatch) {
      commands.push({ type: 'forward', args: [parseInt(forwardMatch[1])], raw: trimmed });
      continue;
    }

    const backwardMatch = trimmed.match(/(?:await\s+)?backward\s*\(\s*(\d+)/);
    if (backwardMatch) {
      commands.push({ type: 'backward', args: [parseInt(backwardMatch[1])], raw: trimmed });
      continue;
    }

    const turnLeftMatch = trimmed.match(/(?:await\s+)?turnLeft\s*\(\s*(\d+)/);
    if (turnLeftMatch) {
      commands.push({ type: 'turn_left', args: [parseInt(turnLeftMatch[1])], raw: trimmed });
      continue;
    }

    const turnRightMatch = trimmed.match(/(?:await\s+)?turnRight\s*\(\s*(\d+)/);
    if (turnRightMatch) {
      commands.push({ type: 'turn_right', args: [parseInt(turnRightMatch[1])], raw: trimmed });
      continue;
    }

    if (trimmed.includes('stop()')) {
      commands.push({ type: 'stop', args: [], raw: trimmed });
      continue;
    }

    const setWheelsMatch = trimmed.match(/setWheels\s*\(\s*(-?\d+)\s*,\s*(-?\d+)/);
    if (setWheelsMatch) {
      commands.push({
        type: 'set_wheels',
        args: [parseInt(setWheelsMatch[1]), parseInt(setWheelsMatch[2])],
        raw: trimmed,
      });
      continue;
    }

    const setServoMatch = trimmed.match(/setServo\s*\(\s*(-?\d+)/);
    if (setServoMatch) {
      commands.push({ type: 'set_servo', args: [parseInt(setServoMatch[1])], raw: trimmed });
      continue;
    }

    if (trimmed.includes('readUltrasonic()')) {
      commands.push({ type: 'read_ultrasonic', args: [], raw: trimmed });
      continue;
    }

    if (trimmed.includes('readIR(') || trimmed.includes('readAllIR()')) {
      commands.push({ type: 'read_ir', args: [], raw: trimmed });
      continue;
    }

    if (trimmed.includes('arm()')) {
      commands.push({ type: 'arm', args: [], raw: trimmed });
      continue;
    }
    if (trimmed.includes('disarm()')) {
      commands.push({ type: 'disarm', args: [], raw: trimmed });
      continue;
    }

    const takeoffMatch = trimmed.match(/takeoff\s*\(\s*([\d.]+)/);
    if (takeoffMatch) {
      commands.push({ type: 'takeoff', args: [parseFloat(takeoffMatch[1])], raw: trimmed });
      continue;
    }

    if (trimmed.includes('land()')) {
      commands.push({ type: 'land', args: [], raw: trimmed });
      continue;
    }

    const throttleMatch = trimmed.match(/setThrottle\s*\(\s*(\d+)/);
    if (throttleMatch) {
      commands.push({ type: 'set_throttle', args: [parseInt(throttleMatch[1])], raw: trimmed });
      continue;
    }

    if (trimmed.match(/for\s*\(/)) {
      const iterMatch = trimmed.match(/(\w+)\s*=\s*(\d+).*<\s*(\d+)/);
      if (iterMatch) {
        commands.push({
          type: 'loop_start',
          args: [iterMatch[1], parseInt(iterMatch[2]), parseInt(iterMatch[3])],
          raw: trimmed,
        });
      }
      continue;
    }

    if (trimmed === '}' || trimmed === '};') {
      commands.push({ type: 'loop_end', args: [], raw: trimmed });
      continue;
    }

    const varMatch = trimmed.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.+)/);
    if (varMatch) {
      commands.push({ type: 'variable', args: [varMatch[1], varMatch[2]], raw: trimmed });
      continue;
    }
  }

  return commands;
}
