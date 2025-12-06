/**
 * Self-collision prevention for SO-101 robot arm
 *
 * This module implements geometric constraints to prevent the arm
 * from passing through itself. Based on the SO-101 arm geometry.
 */

import type { JointState } from '../types';

// SO-101 arm link lengths (approximate, in arbitrary units)
// Reserved for future geometric collision detection:
// baseHeight: 0.08, shoulderLength: 0.10, forearmLength: 0.10, wristLength: 0.08

/**
 * Check if the current joint configuration would cause self-collision
 * and return corrected values if needed.
 *
 * Key collision zones for SO-101:
 * 1. Elbow-to-base collision: When shoulder lifts forward and elbow folds back
 * 2. Wrist-to-shoulder collision: When arm is fully folded
 * 3. Gripper-to-arm collision: When wrist bends back into forearm
 */
export function preventSelfCollision(
  joints: JointState,
  robotId: string
): JointState {
  // Only apply to SO-101 arm
  if (robotId !== 'so-101') {
    return joints;
  }

  const corrected = { ...joints };

  // === Collision Zone 1: Elbow-Base Collision ===
  // When shoulder tilts forward (positive) and elbow folds down (negative),
  // the forearm can pass through the base.
  //
  // The critical relationship: shoulder + elbow should not go too negative
  // (meaning the arm folds back on itself toward the base)

  const shoulderElbowSum = corrected.shoulder + corrected.elbow;

  // If shoulder is tilted forward (>20°), limit how much elbow can fold back
  if (corrected.shoulder > 20) {
    // The more the shoulder tilts forward, the less the elbow can fold back
    // Linear constraint: shoulder + elbow >= -30 (roughly)
    const minSum = -30;
    if (shoulderElbowSum < minSum) {
      // Correct by limiting elbow
      corrected.elbow = minSum - corrected.shoulder;
    }
  }

  // If shoulder is significantly tilted (>40°), apply stricter constraint
  if (corrected.shoulder > 40) {
    const minSum = -10;
    if (shoulderElbowSum < minSum) {
      corrected.elbow = minSum - corrected.shoulder;
    }
  }

  // If shoulder is very tilted (>60°), elbow must stay mostly extended
  if (corrected.shoulder > 60) {
    const minSum = 10;
    if (shoulderElbowSum < minSum) {
      corrected.elbow = minSum - corrected.shoulder;
    }
  }

  // === Collision Zone 2: Symmetric back collision ===
  // Same logic applies when shoulder tilts backward
  if (corrected.shoulder < -20) {
    const maxSum = 30;
    if (shoulderElbowSum > maxSum) {
      corrected.elbow = maxSum - corrected.shoulder;
    }
  }

  if (corrected.shoulder < -40) {
    const maxSum = 10;
    if (shoulderElbowSum > maxSum) {
      corrected.elbow = maxSum - corrected.shoulder;
    }
  }

  if (corrected.shoulder < -60) {
    const maxSum = -10;
    if (shoulderElbowSum > maxSum) {
      corrected.elbow = maxSum - corrected.shoulder;
    }
  }

  // === Collision Zone 3: Wrist-Forearm Collision ===
  // When wrist bends too far in the same direction as the elbow fold
  const elbowWristSum = corrected.elbow + corrected.wrist;

  // Prevent extreme wrist bend when elbow is already folded
  if (Math.abs(elbowWristSum) > 150) {
    // Limit wrist to prevent collision
    if (elbowWristSum > 150) {
      corrected.wrist = 150 - corrected.elbow;
    } else if (elbowWristSum < -150) {
      corrected.wrist = -150 - corrected.elbow;
    }
  }

  // === Ensure values stay within original limits ===
  // The collision prevention might push values outside normal ranges
  corrected.elbow = Math.max(-97, Math.min(97, corrected.elbow));
  corrected.wrist = Math.max(-95, Math.min(95, corrected.wrist));

  return corrected;
}

/**
 * Check if a specific joint change would cause collision
 * Returns true if the change is safe, false if it would cause collision
 */
export function isJointChangeSafe(
  currentJoints: JointState,
  jointName: keyof JointState,
  newValue: number,
  robotId: string
): boolean {
  if (robotId !== 'so-101') {
    return true;
  }

  const testJoints = { ...currentJoints, [jointName]: newValue };
  const corrected = preventSelfCollision(testJoints, robotId);

  // If the corrected value matches what we wanted, it's safe
  return Math.abs(corrected[jointName] - newValue) < 0.5;
}

/**
 * Get the safe range for a joint given the current configuration
 * Returns adjusted min/max values that prevent self-collision
 */
export function getSafeJointRange(
  currentJoints: JointState,
  jointName: keyof JointState,
  robotId: string,
  originalLimits: { min: number; max: number }
): { min: number; max: number } {
  if (robotId !== 'so-101') {
    return originalLimits;
  }

  let safeMin = originalLimits.min;
  let safeMax = originalLimits.max;

  // Test values across the range to find actual safe limits
  for (let testValue = originalLimits.min; testValue <= originalLimits.max; testValue += 5) {
    const testJoints = { ...currentJoints, [jointName]: testValue };
    const corrected = preventSelfCollision(testJoints, robotId);

    if (Math.abs(corrected[jointName] - testValue) < 0.5) {
      // This value is safe
      if (testValue < safeMin) safeMin = testValue;
      safeMax = testValue;
    }
  }

  return { min: safeMin, max: safeMax };
}
