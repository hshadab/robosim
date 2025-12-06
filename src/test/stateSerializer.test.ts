import { describe, it, expect, beforeEach } from 'vitest';
import {
  serializeState,
  deserializeState,
  generateShareUrl,
  estimateUrlSize,
  compressCode,
} from '../lib/stateSerializer';

describe('State Serializer', () => {
  describe('serializeState / deserializeState', () => {
    it('should serialize and deserialize arm robot state', () => {
      const hash = serializeState({
        robotId: 'xarm-1s',
        activeRobotType: 'arm',
        code: 'await goHome();',
        joints: {
          base: 45,
          shoulder: 30,
          elbow: -60,
          wrist: 0,
          wristRoll: 0,
          gripper: 50,
        },
        environment: 'empty',
      });

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');

      const parsed = deserializeState(hash);
      expect(parsed).not.toBeNull();
      expect(parsed?.robotId).toBe('xarm-1s');
      expect(parsed?.activeRobotType).toBe('arm');
      expect(parsed?.code).toBe('await goHome();');
      expect(parsed?.joints?.base).toBe(45);
      expect(parsed?.joints?.shoulder).toBe(30);
      expect(parsed?.environment).toBe('empty');
    });

    it('should serialize and deserialize wheeled robot state', () => {
      const hash = serializeState({
        robotId: 'elegoo-smart-car-v4',
        activeRobotType: 'wheeled',
        code: 'forward(150);',
        wheeledRobot: {
          leftWheelSpeed: 150,
          rightWheelSpeed: 150,
          position: { x: 0, y: 0, z: 0 },
          heading: 90,
          velocity: 0,
          angularVelocity: 0,
          servoHead: 45,
        },
      });

      const parsed = deserializeState(hash);
      expect(parsed?.robotId).toBe('elegoo-smart-car-v4');
      expect(parsed?.activeRobotType).toBe('wheeled');
      expect(parsed?.wheeledRobot?.leftWheelSpeed).toBe(150);
      expect(parsed?.wheeledRobot?.servoHead).toBe(45);
    });

    it('should serialize and deserialize drone state', () => {
      const hash = serializeState({
        robotId: 'mini-quadcopter',
        activeRobotType: 'drone',
        code: 'arm(); takeoff(0.5);',
        drone: {
          position: { x: 0, y: 0.5, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          throttle: 60,
          armed: true,
          flightMode: 'altitude_hold',
          motorsRPM: [1000, 1000, 1000, 1000],
        },
      });

      const parsed = deserializeState(hash);
      expect(parsed?.robotId).toBe('mini-quadcopter');
      expect(parsed?.activeRobotType).toBe('drone');
      expect(parsed?.drone?.armed).toBe(true);
      expect(parsed?.drone?.throttle).toBe(60);
    });

    it('should include optional name and description', () => {
      const hash = serializeState({
        robotId: 'xarm-1s',
        activeRobotType: 'arm',
        code: 'test',
        name: 'My Demo',
        description: 'A test simulation',
      });

      const parsed = deserializeState(hash);
      expect(parsed?.name).toBe('My Demo');
      expect(parsed?.description).toBe('A test simulation');
    });

    it('should handle invalid encoded string', () => {
      const parsed = deserializeState('invalid-base64!!');
      expect(parsed).toBeNull();
    });
  });

  describe('generateShareUrl', () => {
    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://robosim.example.com',
          pathname: '/',
        },
        writable: true,
      });
    });

    it('should generate a valid share URL', () => {
      const url = generateShareUrl({
        robotId: 'xarm-1s',
        activeRobotType: 'arm',
        code: 'await goHome();',
      });

      expect(url).toContain('https://robosim.example.com/');
      expect(url).toContain('#share/');
    });
  });

  describe('estimateUrlSize', () => {
    it('should estimate URL size for small code', () => {
      const size = estimateUrlSize({
        robotId: 'xarm-1s',
        activeRobotType: 'arm',
        code: 'await goHome();',
      });

      expect(size.bytes).toBeLessThan(500);
      expect(size.isLarge).toBe(false);
      expect(size.warning).toBeUndefined();
    });

    it('should warn for large code', () => {
      const largeCode = 'await goHome();\n'.repeat(100);
      const size = estimateUrlSize({
        robotId: 'xarm-1s',
        activeRobotType: 'arm',
        code: largeCode,
      });

      expect(size.bytes).toBeGreaterThan(1000);
      expect(size.isLarge).toBe(true);
      expect(size.warning).toBeTruthy();
    });
  });

  describe('compressCode', () => {
    it('should remove excessive whitespace', () => {
      const code = `
        await goHome();


        await moveJoint('shoulder', 45);


        await wait(500);
      `;

      const compressed = compressCode(code);
      expect(compressed).not.toContain('\n\n\n');
      expect(compressed).toContain('await goHome()');
    });

    it('should trim whitespace', () => {
      const code = '   await goHome();   ';
      const compressed = compressCode(code);
      expect(compressed).toBe('await goHome();');
    });
  });
});
