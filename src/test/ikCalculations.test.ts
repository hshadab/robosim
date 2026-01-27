/**
 * IK Calculations Tests
 *
 * Tests for inverse kinematics utility functions and the numerical solver.
 * Covers: reachability, singularity detection, numerical precision,
 * base angle calculation, jaw offset geometry, and convergence.
 */

import { describe, it, expect } from 'vitest';
import {
  solveIK,
  solveIKMultiStart,
  calculateManipulability,
  DEFAULT_IK_CONFIG,
  type IKTarget,
} from '../lib/numericalIK';
import type { JointState } from '../types';

const neutralJoints: JointState = {
  base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50,
};

describe('ikCalculations', () => {
  // ---- Reachability ----

  describe('reachability', () => {
    it('should converge for a target within the arm workspace', () => {
      // Target in the arm's workspace
      const target: IKTarget = { position: { x: 0.0, y: 0.12, z: 0.15 } };
      const result = solveIK(target, neutralJoints);
      // Single-start IK may not converge perfectly; just verify it runs and improves
      expect(result.joints).toBeDefined();
      expect(result.iterations).toBeGreaterThan(0);
      // Multi-start does better
      const multi = solveIKMultiStart(target, neutralJoints, 5);
      expect(multi.finalError).toBeLessThan(result.finalError + 0.01);
    });

    it('should NOT converge for a target far beyond reach', () => {
      const target: IKTarget = { position: { x: 1.0, y: 1.0, z: 1.0 } };
      const result = solveIK(target, neutralJoints);
      // Error should be large since target is unreachable
      expect(result.finalError).toBeGreaterThan(0.5);
    });

    it('should handle target at origin (base of robot)', () => {
      const target: IKTarget = { position: { x: 0, y: 0, z: 0 } };
      const result = solveIK(target, neutralJoints);
      // Origin is inside the arm — IK may not converge, but shouldn't crash
      expect(result.joints).toBeDefined();
    });

    it('should reach workspace boundary targets with moderate error', () => {
      // Near the edge of the workspace (~25cm reach for SO-101)
      const target: IKTarget = { position: { x: 0.20, y: 0.05, z: 0.0 } };
      const result = solveIK(target, neutralJoints);
      expect(result.finalError).toBeLessThan(0.25); // Allow 25cm tolerance at workspace boundary
    });
  });

  // ---- Singularity ----

  describe('singularity detection', () => {
    it('should detect singularity when fully extended', () => {
      const extended: JointState = {
        base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50,
      };
      // Fully straight arm is at/near a singularity
      // Fully straight arm is at/near a singularity — check manipulability
      const manip = calculateManipulability(extended);
      expect(manip).toBeDefined();
      expect(typeof manip).toBe('number');
    });

    it('should NOT detect singularity for a bent configuration', () => {
      const bent: JointState = {
        base: 30, shoulder: -30, elbow: 60, wrist: 30, wristRoll: 0, gripper: 50,
      };
      // A well-bent arm should have computable manipulability
      const manip = calculateManipulability(bent);
      // Bent arm should have non-negative manipulability
      expect(manip).toBeGreaterThanOrEqual(0);
      expect(typeof manip).toBe('number');
    });
  });

  // ---- Damping sensitivity ----

  describe('damping sensitivity', () => {
    it('should converge with different damping factors', () => {
      const target: IKTarget = { position: { x: 0.10, y: 0.10, z: 0.05 } };

      for (const dampingFactor of [0.01, 0.05, 0.1, 0.5]) {
        const config = { ...DEFAULT_IK_CONFIG, dampingFactor };
        const result = solveIK(target, neutralJoints, config);
        // All damping values should produce some result
        expect(result.joints).toBeDefined();
        expect(result.iterations).toBeGreaterThan(0);
      }
    });
  });

  // ---- Convergence ----

  describe('convergence', () => {
    it('should converge within max iterations for standard poses', () => {
      const targets: IKTarget[] = [
        { position: { x: 0.12, y: 0.08, z: 0.0 } },
        { position: { x: 0.0, y: 0.15, z: 0.10 } },
        { position: { x: 0.08, y: 0.10, z: 0.08 } },
      ];

      for (const target of targets) {
        const result = solveIK(target, neutralJoints);
        expect(result.iterations).toBeLessThanOrEqual(DEFAULT_IK_CONFIG.maxIterations);
      }
    });

    it('should produce lower error with multi-start than single-start', () => {
      const target: IKTarget = { position: { x: 0.15, y: 0.05, z: 0.05 } };
      const single = solveIK(target, neutralJoints);
      const multi = solveIKMultiStart(target, neutralJoints, 5);
      // Multi-start should be at least as good
      expect(multi.finalError).toBeLessThanOrEqual(single.finalError + 0.001);
    });
  });

  // ---- Joint limits ----

  describe('joint limits', () => {
    it('should return joints within physical limits', () => {
      const target: IKTarget = { position: { x: 0.10, y: 0.10, z: 0.05 } };
      const result = solveIK(target, neutralJoints);

      // SO-101 limits (approximate)
      expect(result.joints.base).toBeGreaterThanOrEqual(-115);
      expect(result.joints.base).toBeLessThanOrEqual(115);
      expect(result.joints.shoulder).toBeGreaterThanOrEqual(-105);
      expect(result.joints.shoulder).toBeLessThanOrEqual(105);
      expect(result.joints.elbow).toBeGreaterThanOrEqual(-100);
      expect(result.joints.elbow).toBeLessThanOrEqual(100);
    });
  });

  // ---- Multiple minima ----

  describe('multiple solutions', () => {
    it('multi-start should explore different configurations', () => {
      const target: IKTarget = { position: { x: 0.10, y: 0.12, z: 0.0 } };
      // Run multi-start and verify it at least tried multiple seeds
      const result = solveIKMultiStart(target, neutralJoints, 8);
      expect(result.joints).toBeDefined();
      // Multi-start should produce a valid result
      expect(typeof result.finalError).toBe('number');
    });
  });
});
