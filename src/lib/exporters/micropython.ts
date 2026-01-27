/**
 * MicroPython/CircuitPython Code Generator
 *
 * Generates MicroPython (.py) from parsed simulation commands.
 */

import type { RobotProfile } from '../../types';
import type { HardwareKit, RobotPinMapping } from '../../config/hardwareKits';
import type { ParsedCommand } from './parser';
import type { ExportOptions } from './index';

export function generateMicroPythonCode(
  commands: ParsedCommand[],
  robot: RobotProfile,
  kit: HardwareKit,
  mapping: RobotPinMapping,
  options: ExportOptions
): string {
  const lines: string[] = [];

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

  lines.push('from machine import Pin, PWM, I2C, ADC');
  lines.push('import time');
  lines.push('');

  if (options.includeComments) {
    lines.push('# ========== PIN DEFINITIONS ==========');
  }

  for (const assignment of mapping.pinAssignments) {
    const pin = kit.pins.find(p => p.id === assignment.pinId);
    const pinNum = typeof pin?.gpioNumber === 'number' ? pin.gpioNumber : `"${assignment.pinId}"`;
    lines.push(`PIN_${assignment.function.toUpperCase()} = ${pinNum}`);
  }
  lines.push('');

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

  lines.push('# ========== MAIN PROGRAM ==========');
  lines.push('');
  lines.push('print("RoboSim - Starting...")');
  lines.push('time.sleep(1)');
  lines.push('');

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
