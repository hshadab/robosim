/**
 * SO-101 Robot Arm Kinematics
 * Forward and Inverse kinematics calculations for the LeRobot / The Robot Studio arm
 *
 * Joint structure (6-DOF):
 * - base (shoulder_pan): Rotation around Y axis
 * - shoulder (shoulder_lift): Rotation around Z axis (perpendicular to arm plane)
 * - elbow (elbow_flex): Rotation around Z axis
 * - wrist (wrist_flex): Rotation around Z axis
 * - wristRoll: Rotation around X axis (along arm)
 * - gripper: Linear motion
 */

import type { JointState } from '../../types';

// SO-101 Kinematics (based on official URDF: so101_new_calib.urdf)
// Joint chain: base → shoulder_pan → shoulder_lift → elbow_flex → wrist_flex → wrist_roll → gripper
export const SO101_DIMS = {
  // Base dimensions
  baseHeight: 0.025,       // Base plate height
  baseRadius: 0.045,       // Base plate radius

  // Link lengths (meters) - from official URDF joint origins
  link1Height: 0.0624,     // Base to shoulder pan axis (shoulder_pan xyz z=0.0624)
  link2Length: 0.0542,     // Shoulder bracket (shoulder_lift xyz z=0.0542)
  link3Length: 0.11257,    // Upper arm (elbow_flex xyz x=0.11257)
  link4Length: 0.1349,     // Forearm (wrist_flex xyz x=0.1349)
  link5Length: 0.0611,     // Wrist (wrist_roll xyz y=0.0611)
  gripperLength: 0.098,    // Gripper to tip (gripper_frame xyz z=0.0981)

  // Joint offsets from URDF
  shoulderOffset: 0.0388,  // X offset for shoulder (shoulder_pan xyz x=0.0388)
  shoulderLiftOffset: 0.0304, // shoulder_lift xyz x offset
};

/**
 * Calculate the gripper tip position using forward kinematics
 * Based on SO-101 URDF joint chain with proper transform order
 * @param joints - Joint state with base, shoulder, elbow, wrist angles in degrees
 * @returns [x, y, z] position of the gripper tip in meters
 */
export const calculateSO101GripperPosition = (joints: JointState): [number, number, number] => {
  const dims = SO101_DIMS;

  // Convert joint angles to radians
  const shoulderPanRad = (joints.base * Math.PI) / 180;
  const shoulderLiftRad = (joints.shoulder * Math.PI) / 180;
  const elbowFlexRad = (joints.elbow * Math.PI) / 180;
  const wristFlexRad = (joints.wrist * Math.PI) / 180;

  // Start from base - shoulder pan joint is at offset and height
  const shoulderHeight = dims.baseHeight + dims.link1Height;

  // Shoulder position after shoulder_pan rotation
  const shoulderPos = {
    x: dims.shoulderOffset * Math.cos(-shoulderPanRad),
    y: shoulderHeight,
    z: dims.shoulderOffset * Math.sin(-shoulderPanRad),
  };

  // Add shoulder bracket height and offset for shoulder_lift pivot
  const shoulderLiftPos = {
    x: shoulderPos.x - dims.shoulderLiftOffset * Math.cos(-shoulderPanRad),
    y: shoulderPos.y + dims.link2Length,
    z: shoulderPos.z - dims.shoulderLiftOffset * Math.sin(-shoulderPanRad),
  };

  // Upper arm: extends from shoulder_lift at angle
  const angle1 = shoulderLiftRad;
  const elbowPos = {
    x: shoulderLiftPos.x + dims.link3Length * Math.sin(angle1) * Math.cos(-shoulderPanRad),
    y: shoulderLiftPos.y + dims.link3Length * Math.cos(angle1),
    z: shoulderLiftPos.z + dims.link3Length * Math.sin(angle1) * Math.sin(-shoulderPanRad),
  };

  // Forearm: extends from elbow at cumulative angle
  const angle2 = angle1 + elbowFlexRad;
  const wristPos = {
    x: elbowPos.x + dims.link4Length * Math.sin(angle2) * Math.cos(-shoulderPanRad),
    y: elbowPos.y + dims.link4Length * Math.cos(angle2),
    z: elbowPos.z + dims.link4Length * Math.sin(angle2) * Math.sin(-shoulderPanRad),
  };

  // Gripper: extends from wrist at cumulative angle
  const angle3 = angle2 + wristFlexRad;
  const gripperPos = {
    x: wristPos.x + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.cos(-shoulderPanRad),
    y: wristPos.y + (dims.link5Length + dims.gripperLength) * Math.cos(angle3),
    z: wristPos.z + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.sin(-shoulderPanRad),
  };

  return [gripperPos.x, gripperPos.y, gripperPos.z];
};

/**
 * Joint limits for SO-101 (in degrees)
 */
export const SO101_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
  wristRoll: { min: -157, max: 163 },
  gripper: { min: 0, max: 100 },
};

/**
 * Clamp a value between min and max
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Normalize angle to [-180, 180] range
 */
const normalizeAngle = (angle: number): number => {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
};

/**
 * Calculate inverse kinematics for SO-101 arm
 * Uses geometric approach for a 4-DOF arm (base, shoulder, elbow, wrist)
 *
 * @param targetX - Target X position in meters
 * @param targetY - Target Y position in meters (height)
 * @param targetZ - Target Z position in meters
 * @param currentJoints - Current joint state (used for wristRoll and gripper preservation)
 * @returns Joint state to reach target, or null if unreachable
 */
export const calculateInverseKinematics = (
  targetX: number,
  targetY: number,
  targetZ: number,
  currentJoints: JointState
): JointState | null => {
  const dims = SO101_DIMS;

  // Effective link lengths for IK calculation
  const L1 = dims.link2Length; // Shoulder height
  const L2 = dims.link3Length; // Upper arm
  const L3 = dims.link4Length; // Forearm
  const L4 = dims.link5Length + dims.gripperLength; // Wrist + gripper

  // Base height (shoulder pivot point)
  const baseY = dims.baseHeight + dims.link1Height + L1;

  // Calculate base rotation (shoulder_pan) from X-Z position
  const baseAngleRad = Math.atan2(-targetZ, targetX);
  const baseAngle = normalizeAngle((baseAngleRad * 180) / Math.PI);

  // Check base angle limits
  if (baseAngle < SO101_LIMITS.base.min || baseAngle > SO101_LIMITS.base.max) {
    return null;
  }

  // Distance from base axis to target in the arm plane
  const horizontalDist = Math.sqrt(targetX * targetX + targetZ * targetZ);

  // Adjust for shoulder offset
  const armPlaneDist = horizontalDist - dims.shoulderOffset - dims.shoulderLiftOffset;

  // Height relative to shoulder pivot
  const heightFromShoulder = targetY - baseY;

  // Distance from shoulder to target (for 3-link IK: shoulder-elbow-wrist)
  // We'll use wrist as end point, then add wrist angle for final positioning
  const targetDist = Math.sqrt(armPlaneDist * armPlaneDist + heightFromShoulder * heightFromShoulder);

  // Combined length of upper arm + forearm (for reachability check)
  const maxReach = L2 + L3 + L4 * 0.5; // Allow some wrist bend
  const minReach = Math.abs(L2 - L3) * 0.5;

  if (targetDist > maxReach || targetDist < minReach) {
    return null; // Target unreachable
  }

  // Angle from shoulder to target point
  const targetAngle = Math.atan2(armPlaneDist, heightFromShoulder);

  // Use law of cosines for elbow angle
  // For simplified 2-link IK: shoulder to elbow, elbow to wrist position
  const wristTargetDist = Math.sqrt(
    (armPlaneDist - L4 * 0.3) * (armPlaneDist - L4 * 0.3) +
    heightFromShoulder * heightFromShoulder
  );

  // Elbow angle using law of cosines
  const cosElbow = (L2 * L2 + L3 * L3 - wristTargetDist * wristTargetDist) / (2 * L2 * L3);
  const clampedCosElbow = clamp(cosElbow, -1, 1);
  const elbowAngleRad = Math.acos(clampedCosElbow);

  // Shoulder angle
  const cosAlpha = (L2 * L2 + wristTargetDist * wristTargetDist - L3 * L3) / (2 * L2 * wristTargetDist);
  const clampedCosAlpha = clamp(cosAlpha, -1, 1);
  const alphaRad = Math.acos(clampedCosAlpha);

  // Final shoulder angle
  const shoulderAngleRad = targetAngle - alphaRad;
  const shoulderAngle = normalizeAngle((shoulderAngleRad * 180) / Math.PI);

  // Elbow angle (interior angle to exterior)
  const elbowAngle = normalizeAngle(180 - (elbowAngleRad * 180) / Math.PI);

  // Wrist angle to keep gripper relatively level (or pointing at target)
  const totalArmAngle = shoulderAngle + elbowAngle;
  const wristAngle = clamp(-totalArmAngle * 0.3, SO101_LIMITS.wrist.min, SO101_LIMITS.wrist.max);

  // Validate all angles are within limits
  if (
    shoulderAngle < SO101_LIMITS.shoulder.min ||
    shoulderAngle > SO101_LIMITS.shoulder.max ||
    elbowAngle < SO101_LIMITS.elbow.min ||
    elbowAngle > SO101_LIMITS.elbow.max
  ) {
    return null;
  }

  return {
    base: clamp(baseAngle, SO101_LIMITS.base.min, SO101_LIMITS.base.max),
    shoulder: clamp(shoulderAngle, SO101_LIMITS.shoulder.min, SO101_LIMITS.shoulder.max),
    elbow: clamp(elbowAngle, SO101_LIMITS.elbow.min, SO101_LIMITS.elbow.max),
    wrist: clamp(wristAngle, SO101_LIMITS.wrist.min, SO101_LIMITS.wrist.max),
    wristRoll: currentJoints.wristRoll, // Preserve current wrist roll
    gripper: currentJoints.gripper, // Preserve current gripper state
  };
};

/**
 * Check if a position is within the workspace of the SO-101 arm
 */
export const isPositionReachable = (x: number, y: number, z: number): boolean => {
  const dims = SO101_DIMS;
  const L2 = dims.link3Length;
  const L3 = dims.link4Length;
  const L4 = dims.link5Length + dims.gripperLength;

  const baseY = dims.baseHeight + dims.link1Height + dims.link2Length;
  const horizontalDist = Math.sqrt(x * x + z * z) - dims.shoulderOffset - dims.shoulderLiftOffset;
  const heightFromShoulder = y - baseY;
  const targetDist = Math.sqrt(horizontalDist * horizontalDist + heightFromShoulder * heightFromShoulder);

  const maxReach = L2 + L3 + L4 * 0.5;
  const minReach = Math.abs(L2 - L3) * 0.3;

  return targetDist <= maxReach && targetDist >= minReach && y >= 0;
};

/**
 * Get workspace bounds for SO-101
 */
export const getWorkspaceBounds = (): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  maxReach: number;
} => {
  const dims = SO101_DIMS;
  const maxReach = dims.link3Length + dims.link4Length + dims.link5Length + dims.gripperLength;

  return {
    minX: -maxReach,
    maxX: maxReach,
    minY: 0,
    maxY: dims.baseHeight + dims.link1Height + dims.link2Length + maxReach,
    minZ: -maxReach,
    maxZ: maxReach,
    maxReach,
  };
};

/**
 * Calculate all joint positions for visualization
 * Returns positions of each joint in the kinematic chain
 */
export const calculateJointPositions = (
  joints: JointState
): {
  base: [number, number, number];
  shoulder: [number, number, number];
  elbow: [number, number, number];
  wrist: [number, number, number];
  gripper: [number, number, number];
} => {
  const dims = SO101_DIMS;

  const shoulderPanRad = (joints.base * Math.PI) / 180;
  const shoulderLiftRad = (joints.shoulder * Math.PI) / 180;
  const elbowFlexRad = (joints.elbow * Math.PI) / 180;
  const wristFlexRad = (joints.wrist * Math.PI) / 180;

  // Base position
  const base: [number, number, number] = [0, dims.baseHeight, 0];

  // Shoulder position
  const shoulderHeight = dims.baseHeight + dims.link1Height + dims.link2Length;
  const shoulder: [number, number, number] = [
    dims.shoulderOffset * Math.cos(-shoulderPanRad),
    shoulderHeight,
    dims.shoulderOffset * Math.sin(-shoulderPanRad),
  ];

  // Elbow position
  const angle1 = shoulderLiftRad;
  const elbow: [number, number, number] = [
    shoulder[0] + dims.link3Length * Math.sin(angle1) * Math.cos(-shoulderPanRad),
    shoulder[1] + dims.link3Length * Math.cos(angle1),
    shoulder[2] + dims.link3Length * Math.sin(angle1) * Math.sin(-shoulderPanRad),
  ];

  // Wrist position
  const angle2 = angle1 + elbowFlexRad;
  const wrist: [number, number, number] = [
    elbow[0] + dims.link4Length * Math.sin(angle2) * Math.cos(-shoulderPanRad),
    elbow[1] + dims.link4Length * Math.cos(angle2),
    elbow[2] + dims.link4Length * Math.sin(angle2) * Math.sin(-shoulderPanRad),
  ];

  // Gripper position
  const angle3 = angle2 + wristFlexRad;
  const gripper: [number, number, number] = [
    wrist[0] + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.cos(-shoulderPanRad),
    wrist[1] + (dims.link5Length + dims.gripperLength) * Math.cos(angle3),
    wrist[2] + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.sin(-shoulderPanRad),
  ];

  return { base, shoulder, elbow, wrist, gripper };
};
