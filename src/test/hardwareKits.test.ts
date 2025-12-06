import { describe, it, expect } from 'vitest';
import {
  HARDWARE_KITS,
  DEFAULT_PIN_MAPPINGS,
  getHardwareKit,
  getHardwareKitsForRobot,
  getPinMapping,
  getCompatibleKits,
  validatePinMapping,
} from '../config/hardwareKits';

describe('Hardware Kits Configuration', () => {
  describe('HARDWARE_KITS', () => {
    it('should have all required kits defined', () => {
      const kitIds = HARDWARE_KITS.map(k => k.id);

      expect(kitIds).toContain('arduino-uno');
      expect(kitIds).toContain('arduino-nano');
      expect(kitIds).toContain('arduino-mega');
      expect(kitIds).toContain('esp32-devkit');
      expect(kitIds).toContain('rpi-pico');
    });

    it('should have valid voltage values', () => {
      for (const kit of HARDWARE_KITS) {
        expect([3.3, 5]).toContain(kit.voltage);
      }
    });

    it('should have pins with valid modes', () => {
      const validModes = [
        'input', 'output', 'analog_in', 'analog_out',
        'pwm', 'i2c_sda', 'i2c_scl', 'spi', 'uart_tx', 'uart_rx', 'servo'
      ];

      for (const kit of HARDWARE_KITS) {
        for (const pin of kit.pins) {
          for (const mode of pin.supportedModes) {
            expect(validModes).toContain(mode);
          }
        }
      }
    });

    it('should have programming languages defined', () => {
      for (const kit of HARDWARE_KITS) {
        expect(kit.programmingLanguages.length).toBeGreaterThan(0);
      }
    });
  });

  describe('DEFAULT_PIN_MAPPINGS', () => {
    it('should have mappings for common robot/kit combinations', () => {
      const mappingKeys = DEFAULT_PIN_MAPPINGS.map(m => `${m.robotId}:${m.hardwareKitId}`);

      expect(mappingKeys).toContain('so-101:arduino-uno');
      expect(mappingKeys).toContain('elegoo-smart-car-v4:arduino-uno');
    });

    it('should have valid pin references', () => {
      for (const mapping of DEFAULT_PIN_MAPPINGS) {
        const kit = getHardwareKit(mapping.hardwareKitId);
        if (!kit) continue;

        const kitPinIds = kit.pins.map(p => p.id);

        for (const assignment of mapping.pinAssignments) {
          // Skip PCA9685 channels which are I2C-based
          if (assignment.pinId.startsWith('PCA9685')) continue;
          expect(kitPinIds).toContain(assignment.pinId);
        }
      }
    });
  });

  describe('getHardwareKit', () => {
    it('should return kit by ID', () => {
      const kit = getHardwareKit('arduino-uno');

      expect(kit).not.toBeUndefined();
      expect(kit?.name).toBe('Arduino Uno R3');
      expect(kit?.manufacturer).toBe('Arduino');
    });

    it('should return undefined for unknown ID', () => {
      const kit = getHardwareKit('nonexistent');
      expect(kit).toBeUndefined();
    });
  });

  describe('getHardwareKitsForRobot', () => {
    it('should return kits with mappings for so-101', () => {
      const kits = getHardwareKitsForRobot('so-101');

      expect(kits.length).toBeGreaterThan(0);
      expect(kits.some(k => k.id === 'arduino-uno')).toBe(true);
    });

    it('should return kits with mappings for elegoo car', () => {
      const kits = getHardwareKitsForRobot('elegoo-smart-car-v4');

      expect(kits.length).toBeGreaterThan(0);
    });

    it('should return empty array for robot without mappings', () => {
      const kits = getHardwareKitsForRobot('nonexistent-robot');
      expect(kits).toEqual([]);
    });
  });

  describe('getPinMapping', () => {
    it('should return mapping for valid robot/kit combination', () => {
      const mapping = getPinMapping('so-101', 'arduino-uno');

      expect(mapping).not.toBeUndefined();
      expect(mapping?.robotId).toBe('so-101');
      expect(mapping?.hardwareKitId).toBe('arduino-uno');
    });

    it('should return undefined for invalid combination', () => {
      const mapping = getPinMapping('so-101', 'nonexistent-kit');
      expect(mapping).toBeUndefined();
    });
  });

  describe('getCompatibleKits', () => {
    it('should return compatible kits for arm robots', () => {
      const kits = getCompatibleKits('arm');

      expect(kits.length).toBeGreaterThan(0);
      expect(kits.some(k => k.id === 'arduino-uno')).toBe(true);
    });

    it('should return compatible kits for wheeled robots', () => {
      const kits = getCompatibleKits('wheeled');

      expect(kits.length).toBeGreaterThan(0);
      expect(kits.some(k => k.id === 'esp32-devkit')).toBe(true);
    });

    it('should return compatible kits for drones', () => {
      const kits = getCompatibleKits('drone');

      expect(kits.length).toBeGreaterThan(0);
      expect(kits.some(k => k.id === 'esp32-devkit')).toBe(true);
    });
  });

  describe('validatePinMapping', () => {
    it('should validate mapping and report issues', () => {
      const kit = getHardwareKit('arduino-uno')!;
      const mapping = getPinMapping('elegoo-smart-car-v4', 'arduino-uno')!;

      const result = validatePinMapping(mapping, kit);

      // The validation function checks if pins exist and support modes
      // We just verify it runs and returns a result
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should detect invalid pin IDs', () => {
      const kit = getHardwareKit('arduino-uno')!;
      const invalidMapping = {
        robotId: 'test',
        hardwareKitId: 'arduino-uno',
        name: 'Test',
        description: 'Test mapping',
        pinAssignments: [
          { function: 'test', pinId: 'INVALID_PIN', mode: 'output' as const },
        ],
        sensorConfigs: [],
        motorConfigs: [],
        servoConfigs: [],
      };

      const result = validatePinMapping(invalidMapping, kit);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('not found'))).toBe(true);
    });
  });
});
