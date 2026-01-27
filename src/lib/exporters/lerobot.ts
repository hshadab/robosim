/**
 * LeRobot Python Code Generator
 *
 * Generates LeRobot-compatible Python code for SO-101.
 */

import type { RobotProfile } from '../../types';
import type { ParsedCommand } from './parser';
import type { ExportOptions } from './index';

export function generateLeRobotCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  options: ExportOptions
): string {
  const lines: string[] = [];

  if (options.includeComments) {
    lines.push('"""');
    lines.push(`LeRobot Export - ${robot.name}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('This code was generated from RoboSim simulation.');
    lines.push('Compatible with LeRobot framework: https://github.com/huggingface/lerobot');
    lines.push('');
    lines.push('Setup:');
    lines.push('  pip install lerobot');
    lines.push('  pip install -e ".[feetech]"  # For STS3215 servo support');
    lines.push('"""');
    lines.push('');
  }

  lines.push('import time');
  lines.push('from lerobot.common.robot_devices.robots.factory import make_robot');
  lines.push('from lerobot.common.robot_devices.motors.feetech import FeetechMotorsBus');
  lines.push('');

  if (options.includeComments) {
    lines.push('# ========== CONFIGURATION ==========');
  }
  lines.push('');
  lines.push('# Motor IDs for SO-101 follower arm (STS3215 bus servos)');
  lines.push('MOTOR_IDS = {');
  lines.push('    "shoulder_pan": 1,');
  lines.push('    "shoulder_lift": 2,');
  lines.push('    "elbow_flex": 3,');
  lines.push('    "wrist_flex": 4,');
  lines.push('    "wrist_roll": 5,');
  lines.push('    "gripper": 6,');
  lines.push('}');
  lines.push('');

  lines.push('# Joint name mapping from RoboSim to LeRobot');
  lines.push('JOINT_MAP = {');
  lines.push('    "base": "shoulder_pan",');
  lines.push('    "shoulder": "shoulder_lift",');
  lines.push('    "elbow": "elbow_flex",');
  lines.push('    "wrist": "wrist_flex",');
  lines.push('    "wristRoll": "wrist_roll",');
  lines.push('    "gripper": "gripper",');
  lines.push('}');
  lines.push('');

  if (options.includeComments) {
    lines.push('# ========== HELPER FUNCTIONS ==========');
    lines.push('');
  }

  lines.push('class SO101Controller:');
  lines.push('    """Controller for SO-101 robot arm using LeRobot framework."""');
  lines.push('');
  lines.push('    def __init__(self, port: str = "/dev/ttyUSB0"):');
  lines.push('        """Initialize the robot connection."""');
  lines.push('        self.motors = FeetechMotorsBus(port=port, motors=MOTOR_IDS)');
  lines.push('        self.motors.connect()');
  lines.push('        print(f"Connected to SO-101 on {port}")');
  lines.push('');

  lines.push('    def move_joint(self, joint: str, angle: float, duration: float = 0.5):');
  lines.push('        """Move a single joint to target angle."""');
  lines.push('        motor_name = JOINT_MAP.get(joint, joint)');
  lines.push('        if motor_name not in MOTOR_IDS:');
  lines.push('            print(f"Unknown joint: {joint}")');
  lines.push('            return');
  lines.push('');
  lines.push('        self.motors.write("Goal_Position", {motor_name: angle})');
  lines.push('        time.sleep(duration)');
  lines.push('');

  lines.push('    def move_joints(self, joints: dict, duration: float = 0.5):');
  lines.push('        """Move multiple joints simultaneously."""');
  lines.push('        motor_positions = {}');
  lines.push('        for joint, angle in joints.items():');
  lines.push('            motor_name = JOINT_MAP.get(joint, joint)');
  lines.push('            if motor_name in MOTOR_IDS:');
  lines.push('                motor_positions[motor_name] = angle');
  lines.push('');
  lines.push('        if motor_positions:');
  lines.push('            self.motors.write("Goal_Position", motor_positions)');
  lines.push('            time.sleep(duration)');
  lines.push('');

  lines.push('    def go_home(self):');
  lines.push('        """Move all joints to home position."""');
  lines.push('        home_position = {');
  lines.push('            "shoulder_pan": 0,');
  lines.push('            "shoulder_lift": 0,');
  lines.push('            "elbow_flex": 0,');
  lines.push('            "wrist_flex": 0,');
  lines.push('            "wrist_roll": 0,');
  lines.push('            "gripper": 50,');
  lines.push('        }');
  lines.push('        self.motors.write("Goal_Position", home_position)');
  lines.push('        time.sleep(1.0)');
  lines.push('        print("Moved to home position")');
  lines.push('');

  lines.push('    def open_gripper(self):');
  lines.push('        """Open the gripper fully."""');
  lines.push('        self.move_joint("gripper", 100)');
  lines.push('');

  lines.push('    def close_gripper(self):');
  lines.push('        """Close the gripper fully."""');
  lines.push('        self.move_joint("gripper", 0)');
  lines.push('');

  lines.push('    def set_gripper(self, percent: float):');
  lines.push('        """Set gripper to a specific percentage (0=closed, 100=open)."""');
  lines.push('        self.move_joint("gripper", percent)');
  lines.push('');

  lines.push('    def read_positions(self) -> dict:');
  lines.push('        """Read current positions of all joints."""');
  lines.push('        return self.motors.read("Present_Position")');
  lines.push('');

  lines.push('    def disconnect(self):');
  lines.push('        """Disconnect from the robot."""');
  lines.push('        self.motors.disconnect()');
  lines.push('        print("Disconnected from SO-101")');
  lines.push('');
  lines.push('');

  lines.push('# ========== MAIN PROGRAM ==========');
  lines.push('');
  lines.push('def main():');
  lines.push('    """Main program - converted from RoboSim simulation."""');
  lines.push('');
  lines.push('    robot = SO101Controller(port="/dev/ttyUSB0")');
  lines.push('');
  lines.push('    try:');

  const indent = '        ';
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'move_joint':
        lines.push(`${indent}robot.move_joint("${cmd.args[0]}", ${cmd.args[1]})`);
        break;
      case 'go_home':
        lines.push(`${indent}robot.go_home()`);
        break;
      case 'set_gripper':
        lines.push(`${indent}robot.set_gripper(${cmd.args[0]})`);
        break;
      case 'wait':
        lines.push(`${indent}time.sleep(${(cmd.args[0] as number) / 1000})`);
        break;
      case 'print':
        lines.push(`${indent}print(${cmd.args[0]})`);
        break;
      case 'loop_start':
        lines.push(`${indent}for ${cmd.args[0]} in range(${cmd.args[1]}, ${cmd.args[2]}):`);
        break;
      case 'loop_end':
        break;
      case 'variable': {
        lines.push(`${indent}${cmd.args[0]} = ${cmd.args[1]}`);
        break;
      }
    }
  }

  lines.push('');
  lines.push('        print("Program complete!")');
  lines.push('');
  lines.push('    finally:');
  lines.push('        robot.disconnect()');
  lines.push('');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    main()');

  return lines.join('\n');
}
