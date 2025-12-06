/**
 * Code Exporter - Generates real hardware code from RoboSim simulation code
 *
 * Transforms JavaScript simulation code into:
 * - Arduino C++ (.ino)
 * - MicroPython (.py)
 * - CircuitPython (.py)
 *
 * Supports multiple robot types with proper pin mappings.
 */

import type { RobotProfile } from '../types';
import {
  type HardwareKit,
  type RobotPinMapping,
  getHardwareKit,
  getPinMapping,
} from '../config/hardwareKits';

// ============================================================================
// TYPES
// ============================================================================

export type ExportLanguage = 'arduino' | 'micropython' | 'circuitpython' | 'lerobot';

export interface ExportOptions {
  language: ExportLanguage;
  robotId: string;
  hardwareKitId: string;
  includeComments: boolean;
  includeSetupInstructions: boolean;
}

export interface ExportResult {
  success: boolean;
  code: string;
  filename: string;
  language: ExportLanguage;
  warnings: string[];
  errors: string[];
}

interface ParsedCommand {
  type: 'move_joint' | 'set_gripper' | 'go_home' | 'wait' | 'print' |
        'forward' | 'backward' | 'turn_left' | 'turn_right' | 'stop' |
        'set_wheels' | 'set_servo' | 'read_ultrasonic' | 'read_ir' |
        'arm' | 'disarm' | 'takeoff' | 'land' | 'set_throttle' |
        'loop_start' | 'loop_end' | 'if_start' | 'if_end' | 'else' |
        'variable' | 'unknown';
  args: (string | number)[];
  raw: string;
}

// ============================================================================
// CODE PARSER
// ============================================================================

/**
 * Parse simulation JavaScript into structured commands
 */
function parseSimulationCode(code: string): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Parse await moveJoint('name', angle)
    const moveJointMatch = trimmed.match(/await\s+moveJoint\s*\(\s*['"](\w+)['"]\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (moveJointMatch) {
      commands.push({
        type: 'move_joint',
        args: [moveJointMatch[1], parseFloat(moveJointMatch[2])],
        raw: trimmed,
      });
      continue;
    }

    // Parse await moveJoints({ ... })
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

    // Parse await goHome()
    if (trimmed.includes('goHome()')) {
      commands.push({ type: 'go_home', args: [], raw: trimmed });
      continue;
    }

    // Parse gripper commands
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

    // Parse wait
    const waitMatch = trimmed.match(/await\s+wait\s*\(\s*(\d+)/);
    if (waitMatch) {
      commands.push({ type: 'wait', args: [parseInt(waitMatch[1])], raw: trimmed });
      continue;
    }

    // Parse print
    const printMatch = trimmed.match(/print\s*\((.+)\)/);
    if (printMatch) {
      commands.push({ type: 'print', args: [printMatch[1]], raw: trimmed });
      continue;
    }

    // Wheeled robot commands
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

    // Sensor reads
    if (trimmed.includes('readUltrasonic()')) {
      commands.push({ type: 'read_ultrasonic', args: [], raw: trimmed });
      continue;
    }

    if (trimmed.includes('readIR(') || trimmed.includes('readAllIR()')) {
      commands.push({ type: 'read_ir', args: [], raw: trimmed });
      continue;
    }

    // Drone commands
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

    // Control structures
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

    // Variable assignments
    const varMatch = trimmed.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.+)/);
    if (varMatch) {
      commands.push({ type: 'variable', args: [varMatch[1], varMatch[2]], raw: trimmed });
      continue;
    }
  }

  return commands;
}

// ============================================================================
// ARDUINO CODE GENERATOR
// ============================================================================

function generateArduinoCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  kit: HardwareKit,
  mapping: RobotPinMapping,
  options: ExportOptions
): string {
  const lines: string[] = [];

  // Header comment
  if (options.includeComments) {
    lines.push('/*');
    lines.push(` * RoboSim Export - ${robot.name}`);
    lines.push(` * Hardware: ${kit.name}`);
    lines.push(` * Generated: ${new Date().toISOString()}`);
    lines.push(' *');
    lines.push(' * This code was generated from RoboSim simulation.');
    lines.push(' * Verify pin connections before uploading!');
    lines.push(' */');
    lines.push('');
  }

  // Includes based on robot type
  const includes = new Set<string>();
  includes.add('#include <Arduino.h>');

  if (robot.type === 'arm' || mapping.servoConfigs.length > 0) {
    if (kit.id.startsWith('esp32')) {
      includes.add('#include <ESP32Servo.h>');
    } else {
      includes.add('#include <Servo.h>');
    }
  }

  if (mapping.sensorConfigs.some(s => s.sensorType === 'ultrasonic')) {
    includes.add('#include <NewPing.h>');
  }

  if (mapping.sensorConfigs.some(s => s.i2cAddress)) {
    includes.add('#include <Wire.h>');
  }

  lines.push([...includes].join('\n'));
  lines.push('');

  // Pin definitions
  if (options.includeComments) {
    lines.push('// ========== PIN DEFINITIONS ==========');
  }

  for (const assignment of mapping.pinAssignments) {
    const pinNum = typeof kit.pins.find(p => p.id === assignment.pinId)?.gpioNumber === 'number'
      ? kit.pins.find(p => p.id === assignment.pinId)?.gpioNumber
      : assignment.pinId;
    lines.push(`#define PIN_${assignment.function.toUpperCase()} ${pinNum}`);
  }
  lines.push('');

  // Motor/Servo objects
  if (robot.type === 'arm') {
    lines.push('// Servo objects for arm joints');
    for (const servo of mapping.servoConfigs) {
      lines.push(`Servo servo_${servo.servoId};`);
    }
    lines.push('');

    // Joint angle storage
    lines.push('// Current joint angles');
    for (const servo of mapping.servoConfigs) {
      lines.push(`int angle_${servo.servoId} = ${servo.defaultAngle || 90};`);
    }
    lines.push('');
  }

  if (robot.type === 'wheeled') {
    // Ultrasonic sensor
    const ultrasonicConfig = mapping.sensorConfigs.find(s => s.sensorType === 'ultrasonic');
    if (ultrasonicConfig) {
      lines.push('// Ultrasonic sensor');
      lines.push(`NewPing sonar(PIN_ULTRASONIC_TRIG, PIN_ULTRASONIC_ECHO, 200);`);
      lines.push('');
    }

    // Servo for head
    if (mapping.servoConfigs.length > 0) {
      lines.push('Servo servoHead;');
      lines.push('');
    }
  }

  // Helper functions based on robot type
  if (options.includeComments) {
    lines.push('// ========== HELPER FUNCTIONS ==========');
    lines.push('');
  }

  if (robot.type === 'arm') {
    lines.push(generateArmHelperFunctions(mapping));
  } else if (robot.type === 'wheeled') {
    lines.push(generateWheeledHelperFunctions(mapping));
  } else if (robot.type === 'drone') {
    lines.push(generateDroneHelperFunctions(mapping));
  }

  // Setup function
  lines.push('void setup() {');
  lines.push('  Serial.begin(115200);');
  lines.push('  Serial.println("RoboSim - Starting...");');
  lines.push('');

  if (robot.type === 'arm') {
    for (const servo of mapping.servoConfigs) {
      if (!servo.pin.startsWith('PCA9685')) {
        lines.push(`  servo_${servo.servoId}.attach(PIN_SERVO_${servo.servoId.toUpperCase()});`);
      }
    }
    lines.push('');
    lines.push('  // Move to home position');
    lines.push('  goHome();');
  }

  if (robot.type === 'wheeled') {
    for (const motor of mapping.motorConfigs) {
      if (motor.pins.enable) lines.push(`  pinMode(PIN_MOTOR_${motor.motorId.toUpperCase()}_ENABLE, OUTPUT);`);
      if (motor.pins.in1) lines.push(`  pinMode(PIN_MOTOR_${motor.motorId.toUpperCase()}_IN1, OUTPUT);`);
      if (motor.pins.in2) lines.push(`  pinMode(PIN_MOTOR_${motor.motorId.toUpperCase()}_IN2, OUTPUT);`);
    }
    if (mapping.servoConfigs.length > 0) {
      lines.push('  servoHead.attach(PIN_SERVO_HEAD);');
      lines.push('  servoHead.write(90);');
    }
    lines.push('');
    lines.push('  stopMotors();');
  }

  if (robot.type === 'drone') {
    for (const motor of mapping.motorConfigs) {
      lines.push(`  pinMode(PIN_MOTOR_${motor.motorId.toUpperCase()}, OUTPUT);`);
    }
    lines.push('');
    lines.push('  // Initialize IMU');
    lines.push('  Wire.begin();');
  }

  lines.push('');
  lines.push('  delay(1000);');
  lines.push('  Serial.println("Ready!");');
  lines.push('}');
  lines.push('');

  // Loop function with converted commands
  lines.push('void loop() {');

  let indentLevel = 1;
  const indent = () => '  '.repeat(indentLevel);

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'move_joint':
        lines.push(`${indent()}moveJoint("${cmd.args[0]}", ${cmd.args[1]});`);
        break;

      case 'go_home':
        lines.push(`${indent()}goHome();`);
        break;

      case 'set_gripper':
        lines.push(`${indent()}setGripper(${cmd.args[0]});`);
        break;

      case 'wait':
        lines.push(`${indent()}delay(${cmd.args[0]});`);
        break;

      case 'print':
        lines.push(`${indent()}Serial.println(${cmd.args[0]});`);
        break;

      case 'forward':
        lines.push(`${indent()}forward(${cmd.args[0]});`);
        break;

      case 'backward':
        lines.push(`${indent()}backward(${cmd.args[0]});`);
        break;

      case 'turn_left':
        lines.push(`${indent()}turnLeft(${cmd.args[0]});`);
        break;

      case 'turn_right':
        lines.push(`${indent()}turnRight(${cmd.args[0]});`);
        break;

      case 'stop':
        lines.push(`${indent()}stopMotors();`);
        break;

      case 'set_wheels':
        lines.push(`${indent()}setWheels(${cmd.args[0]}, ${cmd.args[1]});`);
        break;

      case 'set_servo':
        lines.push(`${indent()}servoHead.write(${(cmd.args[0] as number) + 90});`);
        break;

      case 'read_ultrasonic':
        lines.push(`${indent()}int distance = sonar.ping_cm();`);
        break;

      case 'loop_start':
        lines.push(`${indent()}for (int ${cmd.args[0]} = ${cmd.args[1]}; ${cmd.args[0]} < ${cmd.args[2]}; ${cmd.args[0]}++) {`);
        indentLevel++;
        break;

      case 'loop_end':
        indentLevel = Math.max(1, indentLevel - 1);
        lines.push(`${indent()}}`);
        break;

      case 'variable': {
        // Simple variable translation
        const varValue = String(cmd.args[1]).replace(/readUltrasonic\(\)/, 'sonar.ping_cm()');
        lines.push(`${indent()}int ${cmd.args[0]} = ${varValue};`);
        break;
      }
    }
  }

  lines.push('');
  lines.push('  // Stop after running once');
  lines.push('  while (true) { delay(1000); }');
  lines.push('}');

  return lines.join('\n');
}

function generateArmHelperFunctions(mapping: RobotPinMapping): string {
  const lines: string[] = [];

  lines.push(`void moveJoint(const char* joint, int angle) {`);
  for (const servo of mapping.servoConfigs) {
    lines.push(`  if (strcmp(joint, "${servo.servoId}") == 0) {`);
    lines.push(`    angle = constrain(angle, ${servo.minAngle}, ${servo.maxAngle});`);
    lines.push(`    int pulseWidth = map(angle, ${servo.minAngle}, ${servo.maxAngle}, ${servo.minPulseUs}, ${servo.maxPulseUs});`);
    lines.push(`    servo_${servo.servoId}.writeMicroseconds(pulseWidth);`);
    lines.push(`    angle_${servo.servoId} = angle;`);
    lines.push(`    delay(300); // Allow time for movement`);
    lines.push(`  }`);
  }
  lines.push(`}`);
  lines.push('');

  lines.push(`void goHome() {`);
  for (const servo of mapping.servoConfigs) {
    lines.push(`  moveJoint("${servo.servoId}", ${servo.defaultAngle || 0});`);
  }
  lines.push(`}`);
  lines.push('');

  lines.push(`void setGripper(int percent) {`);
  lines.push(`  moveJoint("gripper", percent);`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

function generateWheeledHelperFunctions(mapping: RobotPinMapping): string {
  const lines: string[] = [];
  const leftMotor = mapping.motorConfigs.find(m => m.motorId === 'left' || m.motorId === 'front_left');
  const rightMotor = mapping.motorConfigs.find(m => m.motorId === 'right' || m.motorId === 'front_right');

  if (!leftMotor || !rightMotor) {
    return '// Motor configuration not found\n';
  }

  lines.push(`void setMotor(int enablePin, int in1Pin, int in2Pin, int speed) {`);
  lines.push(`  if (speed > 0) {`);
  lines.push(`    digitalWrite(in1Pin, HIGH);`);
  lines.push(`    digitalWrite(in2Pin, LOW);`);
  lines.push(`    analogWrite(enablePin, speed);`);
  lines.push(`  } else if (speed < 0) {`);
  lines.push(`    digitalWrite(in1Pin, LOW);`);
  lines.push(`    digitalWrite(in2Pin, HIGH);`);
  lines.push(`    analogWrite(enablePin, -speed);`);
  lines.push(`  } else {`);
  lines.push(`    digitalWrite(in1Pin, LOW);`);
  lines.push(`    digitalWrite(in2Pin, LOW);`);
  lines.push(`    analogWrite(enablePin, 0);`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('');

  lines.push(`void setWheels(int leftSpeed, int rightSpeed) {`);
  lines.push(`  setMotor(PIN_MOTOR_LEFT_ENABLE, PIN_MOTOR_LEFT_IN1, PIN_MOTOR_LEFT_IN2, leftSpeed);`);
  lines.push(`  setMotor(PIN_MOTOR_RIGHT_ENABLE, PIN_MOTOR_RIGHT_IN1, PIN_MOTOR_RIGHT_IN2, rightSpeed);`);
  lines.push(`}`);
  lines.push('');

  lines.push(`void forward(int speed) { setWheels(speed, speed); }`);
  lines.push(`void backward(int speed) { setWheels(-speed, -speed); }`);
  lines.push(`void turnLeft(int speed) { setWheels(-speed, speed); }`);
  lines.push(`void turnRight(int speed) { setWheels(speed, -speed); }`);
  lines.push(`void stopMotors() { setWheels(0, 0); }`);
  lines.push('');

  return lines.join('\n');
}

function generateDroneHelperFunctions(mapping: RobotPinMapping): string {
  const lines: string[] = [];

  lines.push(`// WARNING: Drone code requires extensive safety testing!`);
  lines.push(`// This is a basic template - DO NOT fly without proper tuning.`);
  lines.push('');
  lines.push(`bool armed = false;`);
  lines.push(`int throttle = 0;`);
  lines.push('');

  lines.push(`void arm() {`);
  lines.push(`  Serial.println("ARMING - Stay clear!");`);
  lines.push(`  armed = true;`);
  lines.push(`  delay(2000);`);
  lines.push(`}`);
  lines.push('');

  lines.push(`void disarm() {`);
  lines.push(`  armed = false;`);
  lines.push(`  setAllMotors(0);`);
  lines.push(`  Serial.println("DISARMED");`);
  lines.push(`}`);
  lines.push('');

  lines.push(`void setAllMotors(int pwmValue) {`);
  for (const motor of mapping.motorConfigs) {
    lines.push(`  analogWrite(PIN_MOTOR_${motor.motorId.toUpperCase()}, pwmValue);`);
  }
  lines.push(`}`);
  lines.push('');

  lines.push(`void setThrottle(int percent) {`);
  lines.push(`  if (!armed) return;`);
  lines.push(`  throttle = map(percent, 0, 100, 0, 255);`);
  lines.push(`  setAllMotors(throttle);`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// MICROPYTHON CODE GENERATOR
// ============================================================================

function generateMicroPythonCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  kit: HardwareKit,
  mapping: RobotPinMapping,
  options: ExportOptions
): string {
  const lines: string[] = [];

  // Header
  if (options.includeComments) {
    lines.push('"""');
    lines.push(`RoboSim Export - ${robot.name}`);
    lines.push(`Hardware: ${kit.name}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('This code was generated from RoboSim simulation.');
    lines.push('Verify pin connections before running!');
    lines.push('"""');
    lines.push('');
  }

  // Imports
  lines.push('from machine import Pin, PWM, I2C, ADC');
  lines.push('import time');
  lines.push('');

  // Pin definitions
  if (options.includeComments) {
    lines.push('# ========== PIN DEFINITIONS ==========');
  }

  for (const assignment of mapping.pinAssignments) {
    const pin = kit.pins.find(p => p.id === assignment.pinId);
    const pinNum = typeof pin?.gpioNumber === 'number' ? pin.gpioNumber : `"${assignment.pinId}"`;
    lines.push(`PIN_${assignment.function.toUpperCase()} = ${pinNum}`);
  }
  lines.push('');

  // Setup based on robot type
  if (robot.type === 'arm') {
    lines.push('# Servo setup using PWM');
    lines.push('class Servo:');
    lines.push('    def __init__(self, pin, min_us=500, max_us=2500, min_angle=-90, max_angle=90):');
    lines.push('        self.pwm = PWM(Pin(pin))');
    lines.push('        self.pwm.freq(50)');
    lines.push('        self.min_us = min_us');
    lines.push('        self.max_us = max_us');
    lines.push('        self.min_angle = min_angle');
    lines.push('        self.max_angle = max_angle');
    lines.push('        self.angle = 0');
    lines.push('');
    lines.push('    def write(self, angle):');
    lines.push('        angle = max(self.min_angle, min(self.max_angle, angle))');
    lines.push('        pulse_us = int(self.min_us + (angle - self.min_angle) * (self.max_us - self.min_us) / (self.max_angle - self.min_angle))');
    lines.push('        self.pwm.duty_ns(pulse_us * 1000)');
    lines.push('        self.angle = angle');
    lines.push('        time.sleep_ms(300)');
    lines.push('');

    lines.push('# Initialize servos');
    for (const servo of mapping.servoConfigs) {
      if (!servo.pin.startsWith('PCA9685')) {
        lines.push(`servo_${servo.servoId} = Servo(PIN_SERVO_${servo.servoId.toUpperCase()}, ${servo.minPulseUs}, ${servo.maxPulseUs}, ${servo.minAngle}, ${servo.maxAngle})`);
      }
    }
    lines.push('');
  }

  if (robot.type === 'wheeled') {
    lines.push('# Motor setup');
    for (const motor of mapping.motorConfigs) {
      if (motor.pins.enable) {
        lines.push(`motor_${motor.motorId}_en = PWM(Pin(PIN_MOTOR_${motor.motorId.toUpperCase()}_ENABLE))`);
        lines.push(`motor_${motor.motorId}_en.freq(1000)`);
      }
      if (motor.pins.in1) lines.push(`motor_${motor.motorId}_in1 = Pin(PIN_MOTOR_${motor.motorId.toUpperCase()}_IN1, Pin.OUT)`);
      if (motor.pins.in2) lines.push(`motor_${motor.motorId}_in2 = Pin(PIN_MOTOR_${motor.motorId.toUpperCase()}_IN2, Pin.OUT)`);
    }
    lines.push('');

    // Ultrasonic setup
    const ultrasonicConfig = mapping.sensorConfigs.find(s => s.sensorType === 'ultrasonic');
    if (ultrasonicConfig) {
      lines.push('# Ultrasonic sensor');
      lines.push('ultrasonic_trig = Pin(PIN_ULTRASONIC_TRIG, Pin.OUT)');
      lines.push('ultrasonic_echo = Pin(PIN_ULTRASONIC_ECHO, Pin.IN)');
      lines.push('');
      lines.push('def read_ultrasonic():');
      lines.push('    ultrasonic_trig.off()');
      lines.push('    time.sleep_us(2)');
      lines.push('    ultrasonic_trig.on()');
      lines.push('    time.sleep_us(10)');
      lines.push('    ultrasonic_trig.off()');
      lines.push('    ');
      lines.push('    while ultrasonic_echo.value() == 0:');
      lines.push('        pulse_start = time.ticks_us()');
      lines.push('    while ultrasonic_echo.value() == 1:');
      lines.push('        pulse_end = time.ticks_us()');
      lines.push('    ');
      lines.push('    duration = time.ticks_diff(pulse_end, pulse_start)');
      lines.push('    distance = duration * 0.0343 / 2');
      lines.push('    return distance');
      lines.push('');
    }
  }

  // Helper functions
  if (options.includeComments) {
    lines.push('# ========== HELPER FUNCTIONS ==========');
    lines.push('');
  }

  if (robot.type === 'arm') {
    lines.push('def move_joint(joint, angle):');
    for (const servo of mapping.servoConfigs) {
      lines.push(`    if joint == "${servo.servoId}":`);
      lines.push(`        servo_${servo.servoId}.write(angle)`);
    }
    lines.push('');

    lines.push('def go_home():');
    for (const servo of mapping.servoConfigs) {
      lines.push(`    move_joint("${servo.servoId}", ${servo.defaultAngle || 0})`);
    }
    lines.push('');

    lines.push('def set_gripper(percent):');
    lines.push('    move_joint("gripper", percent)');
    lines.push('');
  }

  if (robot.type === 'wheeled') {
    lines.push('def set_wheels(left_speed, right_speed):');
    lines.push('    # Set left motor');
    lines.push('    if left_speed > 0:');
    lines.push('        motor_left_in1.on()');
    lines.push('        motor_left_in2.off()');
    lines.push('    elif left_speed < 0:');
    lines.push('        motor_left_in1.off()');
    lines.push('        motor_left_in2.on()');
    lines.push('        left_speed = -left_speed');
    lines.push('    else:');
    lines.push('        motor_left_in1.off()');
    lines.push('        motor_left_in2.off()');
    lines.push('    motor_left_en.duty_u16(int(left_speed * 257))');
    lines.push('    ');
    lines.push('    # Set right motor');
    lines.push('    if right_speed > 0:');
    lines.push('        motor_right_in1.on()');
    lines.push('        motor_right_in2.off()');
    lines.push('    elif right_speed < 0:');
    lines.push('        motor_right_in1.off()');
    lines.push('        motor_right_in2.on()');
    lines.push('        right_speed = -right_speed');
    lines.push('    else:');
    lines.push('        motor_right_in1.off()');
    lines.push('        motor_right_in2.off()');
    lines.push('    motor_right_en.duty_u16(int(right_speed * 257))');
    lines.push('');

    lines.push('def forward(speed): set_wheels(speed, speed)');
    lines.push('def backward(speed): set_wheels(-speed, -speed)');
    lines.push('def turn_left(speed): set_wheels(-speed, speed)');
    lines.push('def turn_right(speed): set_wheels(speed, -speed)');
    lines.push('def stop(): set_wheels(0, 0)');
    lines.push('');
  }

  // Main program
  lines.push('# ========== MAIN PROGRAM ==========');
  lines.push('');
  lines.push('print("RoboSim - Starting...")');
  lines.push('time.sleep(1)');
  lines.push('');

  // Convert commands
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'move_joint':
        lines.push(`move_joint("${cmd.args[0]}", ${cmd.args[1]})`);
        break;
      case 'go_home':
        lines.push('go_home()');
        break;
      case 'set_gripper':
        lines.push(`set_gripper(${cmd.args[0]})`);
        break;
      case 'wait':
        lines.push(`time.sleep_ms(${cmd.args[0]})`);
        break;
      case 'print':
        lines.push(`print(${cmd.args[0]})`);
        break;
      case 'forward':
        lines.push(`forward(${cmd.args[0]})`);
        break;
      case 'backward':
        lines.push(`backward(${cmd.args[0]})`);
        break;
      case 'turn_left':
        lines.push(`turn_left(${cmd.args[0]})`);
        break;
      case 'turn_right':
        lines.push(`turn_right(${cmd.args[0]})`);
        break;
      case 'stop':
        lines.push('stop()');
        break;
      case 'loop_start':
        lines.push(`for ${cmd.args[0]} in range(${cmd.args[1]}, ${cmd.args[2]}):`);
        break;
      case 'read_ultrasonic':
        lines.push('distance = read_ultrasonic()');
        break;
    }
  }

  lines.push('');
  lines.push('print("Done!")');

  return lines.join('\n');
}

// ============================================================================
// LEROBOT PYTHON CODE GENERATOR
// ============================================================================

/**
 * Generate LeRobot-compatible Python code for SO-101
 * Based on HuggingFace LeRobot framework: https://huggingface.co/docs/lerobot
 */
function generateLeRobotCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  options: ExportOptions
): string {
  const lines: string[] = [];

  // Header
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

  // Imports
  lines.push('import time');
  lines.push('from lerobot.common.robot_devices.robots.factory import make_robot');
  lines.push('from lerobot.common.robot_devices.motors.feetech import FeetechMotorsBus');
  lines.push('');

  // Configuration
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

  // Helper functions
  if (options.includeComments) {
    lines.push('# ========== HELPER FUNCTIONS ==========');
    lines.push('');
  }

  lines.push('class SO101Controller:');
  lines.push('    """Controller for SO-101 robot arm using LeRobot framework."""');
  lines.push('');
  lines.push('    def __init__(self, port: str = "/dev/ttyUSB0"):');
  lines.push('        """Initialize the robot connection.');
  lines.push('');
  lines.push('        Args:');
  lines.push('            port: Serial port for Feetech servo bus (use lerobot-find-port to discover)');
  lines.push('        """');
  lines.push('        self.motors = FeetechMotorsBus(port=port, motors=MOTOR_IDS)');
  lines.push('        self.motors.connect()');
  lines.push('        print(f"Connected to SO-101 on {port}")');
  lines.push('');

  lines.push('    def move_joint(self, joint: str, angle: float, duration: float = 0.5):');
  lines.push('        """Move a single joint to target angle.');
  lines.push('');
  lines.push('        Args:');
  lines.push('            joint: Joint name (base, shoulder, elbow, wrist, wristRoll, gripper)');
  lines.push('            angle: Target angle in degrees');
  lines.push('            duration: Movement duration in seconds');
  lines.push('        """');
  lines.push('        motor_name = JOINT_MAP.get(joint, joint)');
  lines.push('        if motor_name not in MOTOR_IDS:');
  lines.push('            print(f"Unknown joint: {joint}")');
  lines.push('            return');
  lines.push('');
  lines.push('        self.motors.write("Goal_Position", {motor_name: angle})');
  lines.push('        time.sleep(duration)');
  lines.push('');

  lines.push('    def move_joints(self, joints: dict, duration: float = 0.5):');
  lines.push('        """Move multiple joints simultaneously.');
  lines.push('');
  lines.push('        Args:');
  lines.push('            joints: Dictionary of joint names to target angles');
  lines.push('            duration: Movement duration in seconds');
  lines.push('        """');
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

  // Main program
  lines.push('# ========== MAIN PROGRAM ==========');
  lines.push('');
  lines.push('def main():');
  lines.push('    """Main program - converted from RoboSim simulation."""');
  lines.push('');
  lines.push('    # Initialize robot (adjust port as needed)');
  lines.push('    # Use: lerobot-find-port to discover the correct port');
  lines.push('    robot = SO101Controller(port="/dev/ttyUSB0")');
  lines.push('');
  lines.push('    try:');

  // Convert commands
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
        // Python uses indentation, handled by loop structure
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
  lines.push('        # Always disconnect cleanly');
  lines.push('        robot.disconnect()');
  lines.push('');
  lines.push('');
  lines.push('if __name__ == "__main__":');
  lines.push('    main()');

  return lines.join('\n');
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export function exportCode(
  simulationCode: string,
  robot: RobotProfile,
  options: ExportOptions
): ExportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Get hardware kit and pin mapping
  const kit = getHardwareKit(options.hardwareKitId);
  if (!kit) {
    return {
      success: false,
      code: '',
      filename: '',
      language: options.language,
      warnings: [],
      errors: [`Hardware kit '${options.hardwareKitId}' not found`],
    };
  }

  const mapping = getPinMapping(options.robotId, options.hardwareKitId);
  if (!mapping) {
    return {
      success: false,
      code: '',
      filename: '',
      language: options.language,
      warnings: [],
      errors: [`No pin mapping found for ${robot.name} with ${kit.name}`],
    };
  }

  // Parse the simulation code
  const commands = parseSimulationCode(simulationCode);

  if (commands.length === 0) {
    warnings.push('No recognized commands found in simulation code');
  }

  // Generate code based on language
  let code: string;
  let extension: string;

  switch (options.language) {
    case 'arduino':
      code = generateArduinoCode(commands, robot, kit, mapping, options);
      extension = 'ino';
      break;

    case 'micropython':
    case 'circuitpython':
      code = generateMicroPythonCode(commands, robot, kit, mapping, options);
      extension = 'py';
      break;

    case 'lerobot':
      // LeRobot doesn't require hardware kit mapping - it's for SO-101 specifically
      code = generateLeRobotCode(commands, robot, options);
      extension = 'py';
      break;

    default:
      return {
        success: false,
        code: '',
        filename: '',
        language: options.language,
        warnings: [],
        errors: [`Unsupported language: ${options.language}`],
      };
  }

  const filename = `robosim_${robot.id}_${options.language}.${extension}`;

  return {
    success: true,
    code,
    filename,
    language: options.language,
    warnings,
    errors,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Download generated code as a file
 */
export function downloadCode(result: ExportResult): void {
  const blob = new Blob([result.code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy generated code to clipboard
 */
export async function copyCodeToClipboard(result: ExportResult): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(result.code);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of supported export targets for a robot
 */
export function getSupportedExports(robotId: string): Array<{
  kitId: string;
  kitName: string;
  languages: ExportLanguage[];
}> {
  const mappings = DEFAULT_PIN_MAPPINGS.filter(m => m.robotId === robotId);
  const results: Array<{ kitId: string; kitName: string; languages: ExportLanguage[] }> = [];

  // Add LeRobot Python support for SO-101
  if (robotId === 'so-101') {
    results.push({
      kitId: 'lerobot',
      kitName: 'LeRobot (HuggingFace)',
      languages: ['lerobot'],
    });
  }

  for (const mapping of mappings) {
    const kit = getHardwareKit(mapping.hardwareKitId);
    if (kit) {
      results.push({
        kitId: kit.id,
        kitName: kit.name,
        languages: kit.programmingLanguages as ExportLanguage[],
      });
    }
  }

  return results;
}

// Import for DEFAULT_PIN_MAPPINGS reference
import { DEFAULT_PIN_MAPPINGS } from '../config/hardwareKits';
