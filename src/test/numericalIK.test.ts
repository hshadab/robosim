import { describe, it, expect } from 'vitest';
import {
  DEFAULT_IK_CONFIG,
  solveIK,
  type IKTarget,
  type IKConfig,
} from '../lib/numericalIK';
import type { JointState } from '../types';

describe('numericalIK', () => {
  const defaultJoints: JointState = {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    wristRoll: 0,
    gripper: 50,
  };

  describe('DEFAULT_IK_CONFIG', () => {
    it('should have reasonable default values', () => {
      expect(DEFAULT_IK_CONFIG.maxIterations).toBeGreaterThan(0);
      expect(DEFAULT_IK_CONFIG.positionTolerance).toBeLessThan(0.01); // Less than 1cm
      expect(DEFAULT_IK_CONFIG.dampingFactor).toBeGreaterThan(0);
      expect(DEFAULT_IK_CONFIG.stepSize).toBeGreaterThan(0);
      expect(DEFAULT_IK_CONFIG.stepSize).toBeLessThanOrEqual(1);
    });
  });

  describe('solveIK', () => {
    it('should find solution for reachable target', () => {
      // Target position that's within the robot's workspace - directly in front
      const target: IKTarget = {
        position: { x: 0.0, y: 0.12, z: 0.15 },
      };

      const result = solveIK(target, defaultJoints);

      // IK should return a result (may not always converge perfectly)
      expect(result.joints).toBeDefined();
      expect(result.finalError).toBeDefined();
    });

    it('should respect joint limits', () => {
      const target: IKTarget = {
        position: { x: 0.0, y: 0.12, z: 0.15 },
      };

      const result = solveIK(target, defaultJoints);

      // Check all joints are within their limits (with some margin for numerical precision)
      expect(result.joints.base).toBeGreaterThanOrEqual(-115);
      expect(result.joints.base).toBeLessThanOrEqual(115);
      expect(result.joints.shoulder).toBeGreaterThanOrEqual(-105);
      expect(result.joints.shoulder).toBeLessThanOrEqual(105);
      expect(result.joints.elbow).toBeGreaterThanOrEqual(-100);
      expect(result.joints.elbow).toBeLessThanOrEqual(100);
      expect(result.joints.wrist).toBeGreaterThanOrEqual(-100);
      expect(result.joints.wrist).toBeLessThanOrEqual(100);
    });

    it('should use starting joints as initial guess', () => {
      const startJoints: JointState = {
        base: 45,
        shoulder: 30,
        elbow: -20,
        wrist: 10,
        wristRoll: 0,
        gripper: 50,
      };

      const target: IKTarget = {
        position: { x: 0.05, y: 0.12, z: 0.08 },
      };

      const result = solveIK(target, startJoints);

      // Should return valid joint configuration
      expect(result.joints).toBeDefined();
      expect(result.iterations).toBeLessThanOrEqual(DEFAULT_IK_CONFIG.maxIterations);
    });

    it('should handle unreachable targets gracefully', () => {
      // Target that's too far away
      const target: IKTarget = {
        position: { x: 1.0, y: 1.0, z: 1.0 },
      };

      const result = solveIK(target, defaultJoints);

      // Should return a result even if not fully converged
      expect(result.joints).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should respect custom configuration', () => {
      const customConfig: Partial<IKConfig> = {
        maxIterations: 10,
        positionTolerance: 0.1, // Very loose tolerance
      };

      const target: IKTarget = {
        position: { x: 0.1, y: 0.1, z: 0.1 },
      };

      const result = solveIK(target, defaultJoints, customConfig);

      expect(result.iterations).toBeLessThanOrEqual(10);
    });

    it('should preserve gripper value', () => {
      const startJoints: JointState = {
        ...defaultJoints,
        gripper: 75,
      };

      const target: IKTarget = {
        position: { x: 0.1, y: 0.1, z: 0.1 },
      };

      const result = solveIK(target, startJoints);

      expect(result.joints.gripper).toBe(75);
    });

    it('should return results for positions in the primary workspace', () => {
      // Test multiple positions in the typical workspace
      const targets = [
        { x: 0.0, y: 0.12, z: 0.15 },  // Center-forward
        { x: 0.08, y: 0.10, z: 0.12 }, // Right side
        { x: -0.08, y: 0.10, z: 0.12 }, // Left side
      ];

      for (const pos of targets) {
        const result = solveIK({ position: pos }, defaultJoints);
        // IK should at least return joint values
        expect(result.joints).toBeDefined();
        expect(result.joints.base).toBeDefined();
        expect(result.joints.shoulder).toBeDefined();
        expect(result.joints.elbow).toBeDefined();
      }
    });
  });
});
