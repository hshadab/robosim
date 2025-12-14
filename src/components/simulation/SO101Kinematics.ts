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
 * Simplified planar arm model: base rotates around Y axis, arm moves in a vertical plane
 * Convention: base=0 means arm extends along +Z axis, Y is up
 * @param joints - Joint state with base, shoulder, elbow, wrist angles in degrees
 * @returns [x, y, z] position of the gripper tip in meters
 */
export const calculateSO101GripperPosition = (joints: JointState): [number, number, number] => {
  const dims = SO101_DIMS;

  // Convert joint angles to radians
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Shoulder pivot height (base + link1 + link2)
  const shoulderHeight = dims.baseHeight + dims.link1Height + dims.link2Length;

  // Compute arm extension in the local 2D plane (forward + up from shoulder)
  // shoulder=0 means arm points up, positive rotates forward
  const angle1 = shoulderRad;
  const elbowLocal = dims.link3Length * Math.sin(angle1);
  const elbowUp = dims.link3Length * Math.cos(angle1);

  // Elbow angle is cumulative with shoulder
  const angle2 = angle1 + elbowRad;
  const wristLocal = elbowLocal + dims.link4Length * Math.sin(angle2);
  const wristUp = elbowUp + dims.link4Length * Math.cos(angle2);

  // Wrist angle is cumulative
  const angle3 = angle2 + wristRad;
  const gripperLen = dims.link5Length + dims.gripperLength;
  const gripperLocal = wristLocal + gripperLen * Math.sin(angle3);
  const gripperUp = wristUp + gripperLen * Math.cos(angle3);

  // Total forward distance from robot center (including shoulder offset)
  const forwardDist = dims.shoulderOffset + gripperLocal;

  // Convert to world coordinates using base rotation
  // base=0 means arm extends along +Z axis, positive base rotates toward +X (left)
  const x = forwardDist * Math.sin(baseRad);
  const z = forwardDist * Math.cos(baseRad);
  const y = shoulderHeight + gripperUp;

  return [x, y, z];
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
 * Internal forward kinematics for IK solver
 * Computes gripper position from joint angles using simplified geometry
 */
const fkForIK = (base: number, shoulder: number, elbow: number, wrist: number): { x: number; y: number; z: number } => {
  const dims = SO101_DIMS;
  const baseRad = (base * Math.PI) / 180;
  const shoulderRad = (shoulder * Math.PI) / 180;
  const elbowRad = (elbow * Math.PI) / 180;
  const wristRad = (wrist * Math.PI) / 180;

  const shoulderHeight = dims.baseHeight + dims.link1Height + dims.link2Length;

  // Compute arm extension in the local 2D plane (forward + up)
  const angle1 = shoulderRad;
  const elbowLocal = dims.link3Length * Math.sin(angle1);
  const elbowUp = dims.link3Length * Math.cos(angle1);

  const angle2 = angle1 + elbowRad;
  const wristLocal = elbowLocal + dims.link4Length * Math.sin(angle2);
  const wristUp = elbowUp + dims.link4Length * Math.cos(angle2);

  const angle3 = angle2 + wristRad;
  const gripperLen = dims.link5Length + dims.gripperLength;
  const gripperLocal = wristLocal + gripperLen * Math.sin(angle3);
  const gripperUp = wristUp + gripperLen * Math.cos(angle3);

  // Total forward distance including shoulder offset
  const forwardDist = dims.shoulderOffset + gripperLocal;

  // Convert to world coordinates using base rotation
  // base=0 means arm extends along +Z axis
  const x = forwardDist * Math.sin(baseRad);
  const z = forwardDist * Math.cos(baseRad);
  const y = shoulderHeight + gripperUp;

  return { x, y, z };
};

/**
 * Calculate inverse kinematics for SO-101 arm
 * Uses numerical grid search to find joint angles that reach the target position
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
  // Calculate base angle from target X-Z position
  const baseAngle = Math.atan2(targetX, targetZ) * (180 / Math.PI);

  // Check base angle limits
  if (baseAngle < SO101_LIMITS.base.min || baseAngle > SO101_LIMITS.base.max) {
    return null;
  }

  let bestSolution: { shoulder: number; elbow: number; wrist: number } | null = null;
  let bestError = Infinity;

  // Coarse grid search - use 3° step for better coverage
  for (let shoulder = SO101_LIMITS.shoulder.min; shoulder <= SO101_LIMITS.shoulder.max; shoulder += 3) {
    for (let elbow = SO101_LIMITS.elbow.min; elbow <= SO101_LIMITS.elbow.max; elbow += 3) {
      for (let wrist = SO101_LIMITS.wrist.min; wrist <= SO101_LIMITS.wrist.max; wrist += 5) {
        const pos = fkForIK(baseAngle, shoulder, elbow, wrist);
        const error = Math.sqrt(
          (pos.x - targetX) ** 2 +
          (pos.y - targetY) ** 2 +
          (pos.z - targetZ) ** 2
        );
        if (error < bestError) {
          bestError = error;
          bestSolution = { shoulder, elbow, wrist };
        }
      }
    }
  }

  // Refine search around best solution - expanded range for better precision
  if (bestSolution && bestError < 0.08) {
    const refineRange = 8;
    const refineStep = 1;
    for (let ds = -refineRange; ds <= refineRange; ds += refineStep) {
      for (let de = -refineRange; de <= refineRange; de += refineStep) {
        for (let dw = -refineRange; dw <= refineRange; dw += refineStep) {
          const shoulder = clamp(bestSolution.shoulder + ds, SO101_LIMITS.shoulder.min, SO101_LIMITS.shoulder.max);
          const elbow = clamp(bestSolution.elbow + de, SO101_LIMITS.elbow.min, SO101_LIMITS.elbow.max);
          const wrist = clamp(bestSolution.wrist + dw, SO101_LIMITS.wrist.min, SO101_LIMITS.wrist.max);

          const pos = fkForIK(baseAngle, shoulder, elbow, wrist);
          const error = Math.sqrt(
            (pos.x - targetX) ** 2 +
            (pos.y - targetY) ** 2 +
            (pos.z - targetZ) ** 2
          );
          if (error < bestError) {
            bestError = error;
            bestSolution = { shoulder, elbow, wrist };
          }
        }
      }
    }
  }

  // Return solution if within 5cm tolerance (relaxed from 3cm for better success rate)
  if (bestSolution && bestError < 0.05) {
    return {
      base: clamp(baseAngle, SO101_LIMITS.base.min, SO101_LIMITS.base.max),
      shoulder: bestSolution.shoulder,
      elbow: bestSolution.elbow,
      wrist: bestSolution.wrist,
      wristRoll: currentJoints.wristRoll,
      gripper: currentJoints.gripper,
    };
  }

  return null;
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

  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Base position (center of robot base)
  const base: [number, number, number] = [0, dims.baseHeight, 0];

  // Shoulder pivot height
  const shoulderHeight = dims.baseHeight + dims.link1Height + dims.link2Length;

  // Shoulder position (at shoulder offset, rotated by base)
  const shoulder: [number, number, number] = [
    dims.shoulderOffset * Math.sin(baseRad),
    shoulderHeight,
    dims.shoulderOffset * Math.cos(baseRad),
  ];

  // Compute arm positions in local 2D plane, then rotate by base
  const angle1 = shoulderRad;
  const elbowLocal = dims.link3Length * Math.sin(angle1);
  const elbowUp = dims.link3Length * Math.cos(angle1);
  const elbowForward = dims.shoulderOffset + elbowLocal;

  const elbow: [number, number, number] = [
    elbowForward * Math.sin(baseRad),
    shoulderHeight + elbowUp,
    elbowForward * Math.cos(baseRad),
  ];

  // Wrist position
  const angle2 = angle1 + elbowRad;
  const wristLocal = elbowLocal + dims.link4Length * Math.sin(angle2);
  const wristUp = elbowUp + dims.link4Length * Math.cos(angle2);
  const wristForward = dims.shoulderOffset + wristLocal;

  const wrist: [number, number, number] = [
    wristForward * Math.sin(baseRad),
    shoulderHeight + wristUp,
    wristForward * Math.cos(baseRad),
  ];

  // Gripper position
  const angle3 = angle2 + wristRad;
  const gripperLen = dims.link5Length + dims.gripperLength;
  const gripperLocal = wristLocal + gripperLen * Math.sin(angle3);
  const gripperUp = wristUp + gripperLen * Math.cos(angle3);
  const gripperForward = dims.shoulderOffset + gripperLocal;

  const gripper: [number, number, number] = [
    gripperForward * Math.sin(baseRad),
    shoulderHeight + gripperUp,
    gripperForward * Math.cos(baseRad),
  ];

  return { base, shoulder, elbow, wrist, gripper };
};
