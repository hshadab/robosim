/**
 * SO-101 Joint Limits Configuration
 *
 * This is the SINGLE SOURCE OF TRUTH for SO-101 joint limits.
 * All other files should import from here rather than defining their own limits.
 *
 * These limits are derived from the official SO-101 URDF (so101.urdf):
 * https://github.com/huggingface/lerobot/tree/main/lerobot/common/robot_devices/robots/so100
 *
 * URDF joint limit specifications:
 * - shoulder_pan:  lower="-1.92"  upper="1.92"  (~±110°)
 * - shoulder_lift: lower="-1.75"  upper="1.75"  (~±100°)
 * - elbow_flex:    lower="-1.69"  upper="1.69"  (~±97°)
 * - wrist_flex:    lower="-1.66"  upper="1.66"  (~±95°)
 * - wrist_roll:    lower="-2.74"  upper="2.84"  (~-157° to +163°)
 * - gripper:       0-100% open
 */

import type { JointState } from '../types';

/**
 * Joint limits in degrees
 */
export interface JointLimit {
  min: number;
  max: number;
}

/**
 * SO-101 joint limits in degrees
 * Derived from URDF radian values converted to degrees
 */
export const SO101_JOINT_LIMITS: Record<keyof JointState, JointLimit> = {
  base: { min: -110, max: 110 },        // shoulder_pan: ±1.92 rad ≈ ±110°
  shoulder: { min: -100, max: 100 },    // shoulder_lift: ±1.75 rad ≈ ±100°
  elbow: { min: -97, max: 97 },         // elbow_flex: ±1.69 rad ≈ ±97°
  wrist: { min: -95, max: 95 },         // wrist_flex: ±1.66 rad ≈ ±95°
  wristRoll: { min: -157, max: 163 },   // wrist_roll: -2.74 to 2.84 rad ≈ -157° to +163°
  gripper: { min: 0, max: 100 },        // gripper open percentage
};

/**
 * SO-101 joint limits in radians (for FK/IK calculations)
 */
export const SO101_JOINT_LIMITS_RAD: Record<keyof JointState, JointLimit> = {
  base: { min: -1.92, max: 1.92 },
  shoulder: { min: -1.75, max: 1.75 },
  elbow: { min: -1.69, max: 1.69 },
  wrist: { min: -1.66, max: 1.66 },
  wristRoll: { min: -2.74, max: 2.84 },
  gripper: { min: 0, max: 1 }, // Normalized 0-1 for radians version
};

/**
 * URDF joint names mapping to our internal joint names
 */
export const SO101_URDF_TO_INTERNAL: Record<string, keyof JointState> = {
  shoulder_pan: 'base',
  shoulder_lift: 'shoulder',
  elbow_flex: 'elbow',
  wrist_flex: 'wrist',
  wrist_roll: 'wristRoll',
  gripper: 'gripper',
};

/**
 * Internal joint names mapping to URDF names
 */
export const SO101_INTERNAL_TO_URDF: Record<keyof JointState, string> = {
  base: 'shoulder_pan',
  shoulder: 'shoulder_lift',
  elbow: 'elbow_flex',
  wrist: 'wrist_flex',
  wristRoll: 'wrist_roll',
  gripper: 'gripper',
};

/**
 * LeRobot dataset joint names (matching official LeRobot format)
 */
export const SO101_LEROBOT_JOINT_NAMES = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
] as const;

/**
 * Default home position for SO-101
 */
export const SO101_HOME_POSITION: JointState = {
  base: 0,
  shoulder: 0,
  elbow: 0,
  wrist: 0,
  wristRoll: 0,
  gripper: 50, // 50% open
};

/**
 * Safe "tucked" position for SO-101 (minimal workspace footprint)
 */
export const SO101_TUCKED_POSITION: JointState = {
  base: 0,
  shoulder: 90,   // Arm pointing up
  elbow: -90,     // Forearm folded back
  wrist: 0,
  wristRoll: 0,
  gripper: 50,
};

/**
 * Clamp a joint value to its limits
 */
export function clampJointValue(joint: keyof JointState, value: number): number {
  const limit = SO101_JOINT_LIMITS[joint];
  return Math.max(limit.min, Math.min(limit.max, value));
}

/**
 * Clamp all joints in a JointState to their limits
 */
export function clampJointState(state: JointState): JointState {
  return {
    base: clampJointValue('base', state.base),
    shoulder: clampJointValue('shoulder', state.shoulder),
    elbow: clampJointValue('elbow', state.elbow),
    wrist: clampJointValue('wrist', state.wrist),
    wristRoll: clampJointValue('wristRoll', state.wristRoll),
    gripper: clampJointValue('gripper', state.gripper),
  };
}

/**
 * Check if a joint value is within limits
 */
export function isJointWithinLimits(joint: keyof JointState, value: number): boolean {
  const limit = SO101_JOINT_LIMITS[joint];
  return value >= limit.min && value <= limit.max;
}

/**
 * Check if all joints are within limits
 */
export function isJointStateWithinLimits(state: JointState): boolean {
  return (
    isJointWithinLimits('base', state.base) &&
    isJointWithinLimits('shoulder', state.shoulder) &&
    isJointWithinLimits('elbow', state.elbow) &&
    isJointWithinLimits('wrist', state.wrist) &&
    isJointWithinLimits('wristRoll', state.wristRoll) &&
    isJointWithinLimits('gripper', state.gripper)
  );
}
