/**
 * Arduino Code Generator
 *
 * Generates Arduino C++ (.ino) from parsed simulation commands.
 */

import type { RobotProfile } from '../../types';
import type { HardwareKit, RobotPinMapping } from '../../config/hardwareKits';
import type { ParsedCommand } from './parser';
import type { ExportOptions } from './index';

export function generateArduinoCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  kit: HardwareKit,
  mapping: RobotPinMapping,
  options: ExportOptions
): string {
  const lines: string[] = [];

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

  if (robot.type === 'arm') {
    lines.push('// Servo objects for arm joints');
    for (const servo of mapping.servoConfigs) {
      lines.push(`Servo servo_${servo.servoId};`);
    }
    lines.push('');

    lines.push('// Current joint angles');
    for (const servo of mapping.servoConfigs) {
      lines.push(`int angle_${servo.servoId} = ${servo.defaultAngle || 90};`);
    }
    lines.push('');
  }

  if (robot.type === 'wheeled') {
    const ultrasonicConfig = mapping.sensorConfigs.find(s => s.sensorType === 'ultrasonic');
    if (ultrasonicConfig) {
      lines.push('// Ultrasonic sensor');
      lines.push(`NewPing sonar(PIN_ULTRASONIC_TRIG, PIN_ULTRASONIC_ECHO, 200);`);
      lines.push('');
    }

    if (mapping.servoConfigs.length > 0) {
      lines.push('Servo servoHead;');
      lines.push('');
    }
  }

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
