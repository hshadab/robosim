/**
 * SO-101 Kinematics derived directly from URDF
 *
 * This module implements Forward Kinematics that exactly matches
 * the URDF model from the LeRobot SO-101 open source project.
 *
 * Joint chain: base_link -> shoulder_link -> upper_arm_link ->
 *              lower_arm_link -> wrist_link -> gripper_link -> gripper_frame_link
 */

// URDF joint origins (in meters)
// These are extracted directly from so101.urdf
const URDF_JOINTS = {
  // shoulder_pan: base_link -> shoulder_link
  shoulder_pan: {
    xyz: [0.0388353, 0, 0.0624],
    rpy: [Math.PI, 0, -Math.PI], // 180°, 0, -180°
  },
  // shoulder_lift: shoulder_link -> upper_arm_link
  shoulder_lift: {
    xyz: [-0.0303992, -0.0182778, -0.0542],
    rpy: [-Math.PI/2, -Math.PI/2, 0], // -90°, -90°, 0
  },
  // elbow_flex: upper_arm_link -> lower_arm_link
  elbow_flex: {
    xyz: [-0.11257, -0.028, 0],
    rpy: [0, 0, Math.PI/2], // 0, 0, 90°
  },
  // wrist_flex: lower_arm_link -> wrist_link
  wrist_flex: {
    xyz: [-0.1349, 0.0052, 0],
    rpy: [0, 0, -Math.PI/2], // 0, 0, -90°
  },
  // wrist_roll: wrist_link -> gripper_link
  wrist_roll: {
    xyz: [0, -0.0611, 0.0181],
    rpy: [Math.PI/2, 0.0486795, Math.PI], // 90°, ~2.8°, 180°
  },
  // gripper_frame_joint (fixed): gripper_link -> gripper_frame_link
  gripper_frame: {
    xyz: [-0.0079, -0.000218121, -0.0981274],
    rpy: [0, Math.PI, 0], // 0, 180°, 0
  },
};

// Matrix and vector utilities
type Vec3 = [number, number, number];
type Mat4 = number[][]; // 4x4 matrix

function createIdentityMatrix(): Mat4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

function createTranslationMatrix(x: number, y: number, z: number): Mat4 {
  return [
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixX(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [1, 0, 0, 0],
    [0, c, -s, 0],
    [0, s, c, 0],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixY(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1],
  ];
}

function createRotationMatrixZ(angle: number): Mat4 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0, 0],
    [s, c, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

// Create rotation matrix from roll-pitch-yaw (XYZ order, as used in URDF)
function createRPYMatrix(roll: number, pitch: number, yaw: number): Mat4 {
  // URDF uses XYZ fixed axis rotation (same as ZYX Euler)
  const Rz = createRotationMatrixZ(yaw);
  const Ry = createRotationMatrixY(pitch);
  const Rx = createRotationMatrixX(roll);
  return multiplyMatrices(multiplyMatrices(Rz, Ry), Rx);
}

function multiplyMatrices(a: Mat4, b: Mat4): Mat4 {
  const result: Mat4 = createIdentityMatrix();
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i][j] = 0;
      for (let k = 0; k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

function getTranslation(matrix: Mat4): Vec3 {
  return [matrix[0][3], matrix[1][3], matrix[2][3]];
}

// Create transform matrix for a joint (URDF convention)
function createJointTransform(
  xyz: Vec3,
  rpy: Vec3,
  jointAngle: number = 0,
  axis: 'x' | 'y' | 'z' = 'z'
): Mat4 {
  // First apply the fixed origin transform
  const T = createTranslationMatrix(xyz[0], xyz[1], xyz[2]);
  const R = createRPYMatrix(rpy[0], rpy[1], rpy[2]);
  const origin = multiplyMatrices(T, R);

  // Then apply the joint rotation around its axis
  let jointRot: Mat4;
  switch (axis) {
    case 'x': jointRot = createRotationMatrixX(jointAngle); break;
    case 'y': jointRot = createRotationMatrixY(jointAngle); break;
    case 'z': jointRot = createRotationMatrixZ(jointAngle); break;
  }

  return multiplyMatrices(origin, jointRot);
}

export interface JointAngles {
  base: number;      // shoulder_pan in degrees
  shoulder: number;  // shoulder_lift in degrees
  elbow: number;     // elbow_flex in degrees
  wrist: number;     // wrist_flex in degrees
  wristRoll: number; // wrist_roll in degrees
}

// Jaw offset from gripper_frame (tip) - jaws are ~7.5cm behind tip toward gripper body
// In gripper_link local coords, tip is at Z=-0.0981, jaws are at approximately Z=-0.025
// So jaw offset from tip is about 0.0981 - 0.025 = 0.073m (7.3cm) in +Z direction (toward body)
const JAW_OFFSET_FROM_TIP = 0.073; // meters

/**
 * Calculate gripper frame position using exact URDF transforms
 * Returns position in meters, in the world coordinate system
 * (Y-up, as used by Three.js after the -90° X rotation)
 *
 * @param joints - Joint angles in degrees
 * @param useJawPosition - If true, return jaw position instead of tip position
 */
export function calculateGripperPositionURDF(joints: JointAngles, useJawPosition = false): Vec3 {
  // Convert degrees to radians
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;
  const wristRollRad = (joints.wristRoll * Math.PI) / 180;

  // Build transform chain following URDF structure
  // Each joint: origin transform + rotation around axis

  // shoulder_pan (base rotation)
  const T1 = createJointTransform(
    URDF_JOINTS.shoulder_pan.xyz as Vec3,
    URDF_JOINTS.shoulder_pan.rpy as Vec3,
    baseRad,
    'z'
  );

  // shoulder_lift
  const T2 = createJointTransform(
    URDF_JOINTS.shoulder_lift.xyz as Vec3,
    URDF_JOINTS.shoulder_lift.rpy as Vec3,
    shoulderRad,
    'z'
  );

  // elbow_flex
  const T3 = createJointTransform(
    URDF_JOINTS.elbow_flex.xyz as Vec3,
    URDF_JOINTS.elbow_flex.rpy as Vec3,
    elbowRad,
    'z'
  );

  // wrist_flex
  const T4 = createJointTransform(
    URDF_JOINTS.wrist_flex.xyz as Vec3,
    URDF_JOINTS.wrist_flex.rpy as Vec3,
    wristRad,
    'z'
  );

  // wrist_roll
  const T5 = createJointTransform(
    URDF_JOINTS.wrist_roll.xyz as Vec3,
    URDF_JOINTS.wrist_roll.rpy as Vec3,
    wristRollRad,
    'z'
  );

  // gripper_frame (fixed joint, no rotation)
  // If useJawPosition, use a shorter offset to get jaw position instead of tip
  const gripperFrameXYZ = useJawPosition
    ? [
        URDF_JOINTS.gripper_frame.xyz[0],
        URDF_JOINTS.gripper_frame.xyz[1],
        URDF_JOINTS.gripper_frame.xyz[2] + JAW_OFFSET_FROM_TIP, // Move toward body (less negative Z)
      ] as Vec3
    : URDF_JOINTS.gripper_frame.xyz as Vec3;

  const T6 = createJointTransform(
    gripperFrameXYZ,
    URDF_JOINTS.gripper_frame.rpy as Vec3,
    0,
    'z'
  );

  // Chain all transforms: T_total = T1 * T2 * T3 * T4 * T5 * T6
  let T = T1;
  T = multiplyMatrices(T, T2);
  T = multiplyMatrices(T, T3);
  T = multiplyMatrices(T, T4);
  T = multiplyMatrices(T, T5);
  T = multiplyMatrices(T, T6);

  // The URDF is Z-up, but Three.js uses Y-up
  // The robot is rotated -90° on X when loaded
  // So we need to convert: (x, y, z)_urdf -> (x, z, -y)_threejs
  const posURDF = getTranslation(T);

  // Apply the -90° X rotation that happens when loading URDF
  const posThreeJS: Vec3 = [
    posURDF[0],
    posURDF[2],  // URDF Z becomes Three.js Y
    -posURDF[1], // URDF -Y becomes Three.js Z
  ];

  return posThreeJS;
}

/**
 * Calculate JAW position (for grasping) instead of tip position
 * This is a convenience function that calls calculateGripperPositionURDF with useJawPosition=true
 */
export function calculateJawPositionURDF(joints: JointAngles): Vec3 {
  return calculateGripperPositionURDF(joints, true);
}

/**
 * Simple numerical IK solver
 * Finds joint angles to reach a target position
 */
export function solveIK(
  targetPos: Vec3,
  initialGuess: JointAngles = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 }
): { joints: JointAngles; error: number } | null {
  const maxIterations = 100;
  const tolerance = 0.005; // 5mm
  const stepSize = 0.5; // degrees

  let joints = { ...initialGuess };
  let bestJoints = { ...joints };
  let bestError = Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    const pos = calculateGripperPositionURDF(joints);
    const error = Math.sqrt(
      (pos[0] - targetPos[0]) ** 2 +
      (pos[1] - targetPos[1]) ** 2 +
      (pos[2] - targetPos[2]) ** 2
    );

    if (error < bestError) {
      bestError = error;
      bestJoints = { ...joints };
    }

    if (error < tolerance) {
      return { joints: bestJoints, error: bestError };
    }

    // Gradient descent: try small changes in each joint
    const jointNames = ['base', 'shoulder', 'elbow', 'wrist'] as const;
    for (const jointName of jointNames) {
      // Try positive step
      const testJointsPos = { ...joints, [jointName]: joints[jointName] + stepSize };
      const posPlus = calculateGripperPositionURDF(testJointsPos);
      const errorPlus = Math.sqrt(
        (posPlus[0] - targetPos[0]) ** 2 +
        (posPlus[1] - targetPos[1]) ** 2 +
        (posPlus[2] - targetPos[2]) ** 2
      );

      // Try negative step
      const testJointsNeg = { ...joints, [jointName]: joints[jointName] - stepSize };
      const posMinus = calculateGripperPositionURDF(testJointsNeg);
      const errorMinus = Math.sqrt(
        (posMinus[0] - targetPos[0]) ** 2 +
        (posMinus[1] - targetPos[1]) ** 2 +
        (posMinus[2] - targetPos[2]) ** 2
      );

      // Move in the direction that reduces error most
      if (errorPlus < error && errorPlus <= errorMinus) {
        joints[jointName] += stepSize;
      } else if (errorMinus < error) {
        joints[jointName] -= stepSize;
      }
    }
  }

  return { joints: bestJoints, error: bestError };
}

// Export for testing
export const URDF_JOINT_DATA = URDF_JOINTS;
