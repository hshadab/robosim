import { describe, it, expect } from 'vitest';
import { exportCode, getSupportedExports } from '../lib/codeExporter';
import { ROBOT_PROFILES } from '../config/robots';

describe('Code Exporter', () => {
  describe('exportCode', () => {
    it('should export Arduino code for so-101 with arduino-uno', () => {
      const robot = ROBOT_PROFILES.find(r => r.id === 'so-101');
      if (!robot) throw new Error('Robot not found');

      const result = exportCode(
        `
        await goHome();
        await moveJoint('shoulder', 45);
        await wait(500);
        print("Hello!");
        `,
        robot,
        {
          language: 'arduino',
          robotId: 'so-101',
          hardwareKitId: 'arduino-uno',
          includeComments: true,
          includeSetupInstructions: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('robosim_so-101_arduino.ino');
      expect(result.code).toContain('#include <Arduino.h>');
      expect(result.code).toContain('#include <Servo.h>');
      expect(result.code).toContain('void setup()');
      expect(result.code).toContain('void loop()');
      expect(result.code).toContain('goHome()');
      expect(result.code).toContain('moveJoint');
      expect(result.code).toContain('delay(500)');
      expect(result.code).toContain('Serial.println');
    });

    it('should export Arduino code for wheeled robot', () => {
      const robot = ROBOT_PROFILES.find(r => r.id === 'elegoo-smart-car-v4');
      if (!robot) throw new Error('Robot not found');

      const result = exportCode(
        `
        forward(150);
        await wait(1000);
        turnLeft(100);
        stop();
        `,
        robot,
        {
          language: 'arduino',
          robotId: 'elegoo-smart-car-v4',
          hardwareKitId: 'arduino-uno',
          includeComments: true,
          includeSetupInstructions: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('forward(150)');
      expect(result.code).toContain('turnLeft(100)');
      expect(result.code).toContain('stopMotors()');
    });

    it('should export Arduino code for wheeled robot with Arduino Uno', () => {
      const robot = ROBOT_PROFILES.find(r => r.id === 'elegoo-smart-car-v4');
      if (!robot) throw new Error('Robot not found');

      const result = exportCode(
        `
        forward(200);
        await wait(500);
        stop();
        `,
        robot,
        {
          language: 'arduino',
          robotId: 'elegoo-smart-car-v4',
          hardwareKitId: 'arduino-uno',
          includeComments: true,
          includeSetupInstructions: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.filename).toBe('robosim_elegoo-smart-car-v4_arduino.ino');
      expect(result.code).toContain('#include <Arduino.h>');
      expect(result.code).toContain('forward(200)');
      expect(result.code).toContain('delay(500)');
    });

    it('should fail for unsupported kit', () => {
      const robot = ROBOT_PROFILES.find(r => r.id === 'so-101');
      if (!robot) throw new Error('Robot not found');

      const result = exportCode(
        'await goHome();',
        robot,
        {
          language: 'arduino',
          robotId: 'so-101',
          hardwareKitId: 'nonexistent-kit',
          includeComments: false,
          includeSetupInstructions: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should parse loop constructs', () => {
      const robot = ROBOT_PROFILES.find(r => r.id === 'so-101');
      if (!robot) throw new Error('Robot not found');

      const result = exportCode(
        `
        for (let i = 0; i < 3; i++) {
          await moveJoint('wrist', 45);
          await wait(200);
        }
        `,
        robot,
        {
          language: 'arduino',
          robotId: 'so-101',
          hardwareKitId: 'arduino-uno',
          includeComments: false,
          includeSetupInstructions: false,
        }
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain('for (int i = 0; i < 3; i++)');
    });
  });

  describe('getSupportedExports', () => {
    it('should return supported exports for so-101', () => {
      const exports = getSupportedExports('so-101');

      expect(exports.length).toBeGreaterThan(0);
      // LeRobot is now the first option for SO-101
      expect(exports[0].kitId).toBe('lerobot');
      expect(exports[0].languages).toContain('lerobot');
      // Arduino should also be available
      expect(exports.some(e => e.kitId === 'arduino-uno')).toBe(true);
    });

    it('should return supported exports for elegoo-smart-car-v4', () => {
      const exports = getSupportedExports('elegoo-smart-car-v4');

      expect(exports.length).toBeGreaterThan(0);
      expect(exports[0].kitId).toBe('arduino-uno');
    });

    it('should return supported exports for drone', () => {
      const exports = getSupportedExports('mini-quadcopter');

      // Drones may not have hardware mappings yet, so check it handles this gracefully
      expect(Array.isArray(exports)).toBe(true);
    });

    it('should return empty array for unknown robot', () => {
      const exports = getSupportedExports('nonexistent-robot');

      expect(exports).toEqual([]);
    });
  });
});
