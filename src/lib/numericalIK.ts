/**
 * Numerical Inverse Kinematics Solver
 *
 * Jacobian-based IK solver for robot arms with support for:
 * - Damped Least Squares (DLS) method
 * - Pseudo-inverse Jacobian
 * - Joint limits handling
 * - Singularity avoidance
 * - Configurable convergence parameters
 */

import type { JointState, Vector3D } from '../types';
import {
  calculateGripperPositionURDF,
  type JointAngles,
} from '../components/simulation/SO101KinematicsURDF';
// DEPRECATED: The simplified planar FK model is no longer used.
// Use SO101KinematicsURDF for accurate URDF-based forward kinematics.
import {
  calculateJointPositions,
  SO101_LIMITS,
} from '../components/simulation/SO101Kinematics';

/**
 * Wrapper to convert JointState to URDF FK format and call accurate FK
 * Uses the URDF-based transform matrices for precise position calculation
 */
function calculateSO101GripperPosition(joints: JointState): [number, number, number] {
  const angles: JointAngles = {
    base: joints.base,
    shoulder: joints.shoulder,
    elbow: joints.elbow,
    wrist: joints.wrist,
    wristRoll: joints.wristRoll,
  };
  return calculateGripperPositionURDF(angles);
}

// Types for IK configuration
export interface IKConfig {
  maxIterations: number;
  positionTolerance: number;    // meters
  orientationTolerance: number; // radians (if orientation control is enabled)
  dampingFactor: number;        // for DLS method (lambda)
  stepSize: number;             // learning rate
  jointLimitMargin: number;     // degrees - stay this far from limits
  method: 'jacobian' | 'dls' | 'ccd';
}

export interface IKResult {
  success: boolean;
  joints: JointState;
  iterations: number;
  finalError: number;
  converged: boolean;
  message: string;
}

export interface IKTarget {
  position: Vector3D;
  orientation?: Vector3D;  // Optional roll, pitch, yaw in degrees
}

// Default configuration
export const DEFAULT_IK_CONFIG: IKConfig = {
  maxIterations: 100,
  positionTolerance: 0.001,   // 1mm
  orientationTolerance: 0.02, // ~1 degree
  dampingFactor: 0.1,
  stepSize: 0.5,
  jointLimitMargin: 5,        // 5 degrees from limits
  method: 'dls',
};

// Joint indices for easier manipulation
const JOINT_NAMES = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll'] as const;

/**
 * Convert JointState to array for numerical operations
 */
function jointStateToArray(joints: JointState): number[] {
  return [
    joints.base,
    joints.shoulder,
    joints.elbow,
    joints.wrist,
    joints.wristRoll,
  ];
}

/**
 * Convert array back to JointState
 */
function arrayToJointState(arr: number[], gripper: number): JointState {
  return {
    base: arr[0],
    shoulder: arr[1],
    elbow: arr[2],
    wrist: arr[3],
    wristRoll: arr[4],
    gripper,
  };
}

/**
 * Get joint limits as arrays
 */
function getJointLimits(): { min: number[]; max: number[] } {
  return {
    min: [
      SO101_LIMITS.base.min,
      SO101_LIMITS.shoulder.min,
      SO101_LIMITS.elbow.min,
      SO101_LIMITS.wrist.min,
      SO101_LIMITS.wristRoll.min,
    ],
    max: [
      SO101_LIMITS.base.max,
      SO101_LIMITS.shoulder.max,
      SO101_LIMITS.elbow.max,
      SO101_LIMITS.wrist.max,
      SO101_LIMITS.wristRoll.max,
    ],
  };
}

/**
 * Clamp joints to their limits with margin
 */
function clampJoints(joints: number[], margin: number): number[] {
  const limits = getJointLimits();
  return joints.map((j, i) =>
    Math.max(limits.min[i] + margin, Math.min(limits.max[i] - margin, j))
  );
}

/**
 * Calculate position error (Euclidean distance)
 */
function calculatePositionError(current: [number, number, number], target: Vector3D): number {
  const dx = target.x - current[0];
  const dy = target.y - current[1];
  const dz = target.z - current[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate error vector (target - current)
 */
function calculateErrorVector(current: [number, number, number], target: Vector3D): number[] {
  return [
    target.x - current[0],
    target.y - current[1],
    target.z - current[2],
  ];
}

/**
 * Compute the Jacobian matrix numerically using finite differences
 *
 * The Jacobian relates joint velocities to end-effector velocities:
 * dx = J * dq
 *
 * For a 6-DOF arm with 3D position, J is a 3x5 matrix (5 joints, ignoring gripper)
 */
function computeJacobian(joints: JointState, delta = 0.1): number[][] {
  const numJoints = 5; // base, shoulder, elbow, wrist, wristRoll
  const numOutputs = 3; // x, y, z position

  const jacobian: number[][] = Array(numOutputs)
    .fill(null)
    .map(() => Array(numJoints).fill(0));

  // Current end-effector position
  const currentPos = calculateSO101GripperPosition(joints);

  // Compute partial derivatives numerically
  const jointArr = jointStateToArray(joints);

  for (let j = 0; j < numJoints; j++) {
    // Perturb joint j
    const perturbedJoints = [...jointArr];
    perturbedJoints[j] += delta;

    // Calculate perturbed position
    const perturbedState = arrayToJointState(perturbedJoints, joints.gripper);
    const perturbedPos = calculateSO101GripperPosition(perturbedState);

    // Compute partial derivatives (position change / joint change)
    // Units: meters per degree (consistent with joint angles in degrees)
    for (let i = 0; i < numOutputs; i++) {
      jacobian[i][j] = (perturbedPos[i] - currentPos[i]) / delta;
    }
  }

  return jacobian;
}

/**
 * Transpose a matrix
 */
function transpose(matrix: number[][]): number[][] {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = Array(cols)
    .fill(null)
    .map(() => Array(rows).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

/**
 * Multiply matrices
 */
function matmul(a: number[][], b: number[][]): number[][] {
  const rowsA = a.length;
  const colsA = a[0].length;
  const colsB = b[0].length;

  const result: number[][] = Array(rowsA)
    .fill(null)
    .map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

/**
 * Multiply matrix by vector
 */
function matvec(matrix: number[][], vec: number[]): number[] {
  return matrix.map((row) =>
    row.reduce((sum, val, i) => sum + val * vec[i], 0)
  );
}

/**
 * Add identity matrix scaled by lambda (for DLS)
 */
function addScaledIdentity(matrix: number[][], lambda: number): number[][] {
  const n = matrix.length;
  const result = matrix.map((row) => [...row]);
  for (let i = 0; i < n; i++) {
    result[i][i] += lambda * lambda;
  }
  return result;
}

/**
 * Invert a 3x3 matrix (for DLS)
 */
function invert3x3(m: number[][]): number[][] | null {
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  if (Math.abs(det) < 1e-10) {
    return null; // Singular matrix
  }

  const invDet = 1 / det;
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet,
    ],
  ];
}

/**
 * Compute pseudo-inverse of Jacobian using Damped Least Squares
 *
 * J_pinv = J^T * (J * J^T + lambda^2 * I)^-1
 */
function dampedPseudoInverse(jacobian: number[][], lambda: number): number[][] | null {
  const Jt = transpose(jacobian);
  const JJt = matmul(jacobian, Jt); // 3x3 matrix
  const JJtDamped = addScaledIdentity(JJt, lambda);

  const JJtInv = invert3x3(JJtDamped);
  if (!JJtInv) {
    return null;
  }

  return matmul(Jt, JJtInv);
}

/**
 * Damped Least Squares IK solver
 *
 * Uses the Jacobian transpose/pseudo-inverse method with damping
 * to iteratively solve for joint angles.
 */
function solveDLS(
  target: IKTarget,
  initialJoints: JointState,
  config: IKConfig
): IKResult {
  let joints = jointStateToArray(initialJoints);
  const gripper = initialJoints.gripper;

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const currentState = arrayToJointState(joints, gripper);
    const currentPos = calculateSO101GripperPosition(currentState);
    const error = calculatePositionError(currentPos, target.position);

    // Check convergence
    if (error < config.positionTolerance) {
      return {
        success: true,
        joints: arrayToJointState(clampJoints(joints, config.jointLimitMargin), gripper),
        iterations: iter + 1,
        finalError: error,
        converged: true,
        message: `Converged in ${iter + 1} iterations`,
      };
    }

    // Compute Jacobian
    const jacobian = computeJacobian(currentState);

    // Compute damped pseudo-inverse
    const jPinv = dampedPseudoInverse(jacobian, config.dampingFactor);
    if (!jPinv) {
      // Singularity - try with larger damping
      continue;
    }

    // Compute error vector
    const errorVec = calculateErrorVector(currentPos, target.position);

    // Compute joint update: dq = J_pinv * error
    const dq = matvec(jPinv, errorVec);

    // Apply update with step size (dq is already in degrees since Jacobian is m/deg)
    for (let j = 0; j < 5; j++) {
      joints[j] += config.stepSize * dq[j];
    }

    // Clamp to joint limits
    joints = clampJoints(joints, config.jointLimitMargin);
  }

  // Did not converge
  const finalState = arrayToJointState(joints, gripper);
  const finalPos = calculateSO101GripperPosition(finalState);
  const finalError = calculatePositionError(finalPos, target.position);

  return {
    success: finalError < config.positionTolerance * 10, // Allow 10x tolerance
    joints: arrayToJointState(clampJoints(joints, config.jointLimitMargin), gripper),
    iterations: config.maxIterations,
    finalError,
    converged: false,
    message: `Max iterations reached. Final error: ${(finalError * 1000).toFixed(1)}mm`,
  };
}

/**
 * Cyclic Coordinate Descent (CCD) IK solver
 *
 * Iteratively adjusts each joint to minimize end-effector error.
 * Simple and robust, especially for chains with many joints.
 */
function solveCCD(
  target: IKTarget,
  initialJoints: JointState,
  config: IKConfig
): IKResult {
  const joints = jointStateToArray(initialJoints);
  const gripper = initialJoints.gripper;
  const limits = getJointLimits();

  for (let iter = 0; iter < config.maxIterations; iter++) {
    const currentState = arrayToJointState(joints, gripper);
    const currentPos = calculateSO101GripperPosition(currentState);
    const error = calculatePositionError(currentPos, target.position);

    // Check convergence
    if (error < config.positionTolerance) {
      return {
        success: true,
        joints: arrayToJointState(joints, gripper),
        iterations: iter + 1,
        finalError: error,
        converged: true,
        message: `CCD converged in ${iter + 1} iterations`,
      };
    }

    // Iterate through joints from end to base
    for (let j = 4; j >= 0; j--) {
      const jointName = JOINT_NAMES[j];
      const jointPositions = calculateJointPositions(arrayToJointState(joints, gripper));

      // Get joint position
      let jointPos: [number, number, number];
      switch (jointName) {
        case 'base':
          jointPos = jointPositions.base;
          break;
        case 'shoulder':
          jointPos = jointPositions.shoulder;
          break;
        case 'elbow':
          jointPos = jointPositions.elbow;
          break;
        case 'wrist':
          jointPos = jointPositions.wrist;
          break;
        default:
          jointPos = jointPositions.wrist;
      }

      // Get current end-effector position
      const effectorPos = calculateSO101GripperPosition(arrayToJointState(joints, gripper));

      // Vector from joint to end-effector
      const toEffector = [
        effectorPos[0] - jointPos[0],
        effectorPos[1] - jointPos[1],
        effectorPos[2] - jointPos[2],
      ];

      // Vector from joint to target
      const toTarget = [
        target.position.x - jointPos[0],
        target.position.y - jointPos[1],
        target.position.z - jointPos[2],
      ];

      // Calculate angle between vectors (simplified for rotation axes)
      // For base joint (Y-axis rotation)
      if (j === 0) {
        const effectorAngle = Math.atan2(-toEffector[2], toEffector[0]);
        const targetAngle = Math.atan2(-toTarget[2], toTarget[0]);
        const deltaAngle = (targetAngle - effectorAngle) * (180 / Math.PI);
        joints[j] += deltaAngle * config.stepSize;
      } else {
        // For other joints, project onto arm plane
        const effectorDist = Math.sqrt(toEffector[0] ** 2 + toEffector[2] ** 2);
        const targetDist = Math.sqrt(toTarget[0] ** 2 + toTarget[2] ** 2);

        const effectorAngle = Math.atan2(effectorDist, toEffector[1]);
        const targetAngle = Math.atan2(targetDist, toTarget[1]);
        const deltaAngle = (targetAngle - effectorAngle) * (180 / Math.PI);
        joints[j] += deltaAngle * config.stepSize * 0.3;
      }

      // Clamp to limits
      joints[j] = Math.max(
        limits.min[j] + config.jointLimitMargin,
        Math.min(limits.max[j] - config.jointLimitMargin, joints[j])
      );
    }
  }

  const finalState = arrayToJointState(joints, gripper);
  const finalPos = calculateSO101GripperPosition(finalState);
  const finalError = calculatePositionError(finalPos, target.position);

  return {
    success: finalError < config.positionTolerance * 10,
    joints: finalState,
    iterations: config.maxIterations,
    finalError,
    converged: false,
    message: `CCD max iterations reached. Final error: ${(finalError * 1000).toFixed(1)}mm`,
  };
}

/**
 * Main IK solver function
 *
 * Solves inverse kinematics using the specified method
 */
export function solveIK(
  target: IKTarget,
  initialJoints: JointState,
  config: Partial<IKConfig> = {}
): IKResult {
  const fullConfig: IKConfig = { ...DEFAULT_IK_CONFIG, ...config };

  switch (fullConfig.method) {
    case 'dls':
    case 'jacobian':
      return solveDLS(target, initialJoints, fullConfig);
    case 'ccd':
      return solveCCD(target, initialJoints, fullConfig);
    default:
      return solveDLS(target, initialJoints, fullConfig);
  }
}

/**
 * Solve IK with multiple starting configurations
 *
 * Tries several initial configurations to find the best solution
 */
export function solveIKMultiStart(
  target: IKTarget,
  currentJoints: JointState,
  numStarts = 5,
  config: Partial<IKConfig> = {}
): IKResult {
  const limits = getJointLimits();
  let bestResult: IKResult | null = null;

  // Try current configuration first
  const currentResult = solveIK(target, currentJoints, config);
  if (currentResult.success && currentResult.converged) {
    return currentResult;
  }
  bestResult = currentResult;

  // Try random configurations
  for (let i = 0; i < numStarts - 1; i++) {
    const randomJoints: JointState = {
      base: limits.min[0] + Math.random() * (limits.max[0] - limits.min[0]),
      shoulder: limits.min[1] + Math.random() * (limits.max[1] - limits.min[1]),
      elbow: limits.min[2] + Math.random() * (limits.max[2] - limits.min[2]),
      wrist: limits.min[3] + Math.random() * (limits.max[3] - limits.min[3]),
      wristRoll: currentJoints.wristRoll,
      gripper: currentJoints.gripper,
    };

    const result = solveIK(target, randomJoints, config);

    if (result.converged) {
      return result;
    }

    if (!bestResult || result.finalError < bestResult.finalError) {
      bestResult = result;
    }
  }

  return bestResult!;
}

/**
 * Calculate the manipulability of the current configuration
 *
 * Manipulability = sqrt(det(J * J^T))
 * Higher values indicate configurations with better dexterity
 */
export function calculateManipulability(joints: JointState): number {
  const jacobian = computeJacobian(joints);
  const Jt = transpose(jacobian);
  const JJt = matmul(jacobian, Jt);

  // Determinant of 3x3 matrix
  const det =
    JJt[0][0] * (JJt[1][1] * JJt[2][2] - JJt[1][2] * JJt[2][1]) -
    JJt[0][1] * (JJt[1][0] * JJt[2][2] - JJt[1][2] * JJt[2][0]) +
    JJt[0][2] * (JJt[1][0] * JJt[2][1] - JJt[1][1] * JJt[2][0]);

  return Math.sqrt(Math.max(0, det));
}

/**
 * Check if the current configuration is near a singularity
 */
export function isNearSingularity(joints: JointState, threshold = 0.01): boolean {
  return calculateManipulability(joints) < threshold;
}

/**
 * Generate a trajectory from current to target using IK
 *
 * Interpolates the target position and solves IK for each waypoint
 */
export function generateIKTrajectory(
  startJoints: JointState,
  targetPosition: Vector3D,
  numWaypoints = 10,
  config: Partial<IKConfig> = {}
): { waypoints: JointState[]; success: boolean } {
  const startPos = calculateSO101GripperPosition(startJoints);
  const waypoints: JointState[] = [{ ...startJoints }];
  let currentJoints = { ...startJoints };

  for (let i = 1; i <= numWaypoints; i++) {
    const t = i / numWaypoints;

    // Linear interpolation of target position
    const interpPos: Vector3D = {
      x: startPos[0] + t * (targetPosition.x - startPos[0]),
      y: startPos[1] + t * (targetPosition.y - startPos[1]),
      z: startPos[2] + t * (targetPosition.z - startPos[2]),
    };

    const result = solveIK({ position: interpPos }, currentJoints, {
      ...config,
      maxIterations: 50, // Fewer iterations for trajectory points
    });

    if (!result.success) {
      return { waypoints, success: false };
    }

    waypoints.push(result.joints);
    currentJoints = result.joints;
  }

  return { waypoints, success: true };
}

// ============================================================================
// Multi-Solution IK with Ranking
// ============================================================================

/**
 * A ranked IK solution with quality metrics
 */
export interface RankedIKSolution {
  joints: JointState;
  error: number;              // Position error in meters
  travelDistance: number;     // Sum of absolute joint angle changes from current
  manipulability: number;     // Dexterity measure (higher = better)
  approachScore: number;      // 0-1, quality of gripper approach angle
  collisionRisk: number;      // 0-1, estimated collision risk (0 = safe)
  overallScore: number;       // Combined ranking score (higher = better)
}

/**
 * Configuration for multi-solution IK
 */
export interface MultiSolutionConfig {
  numSolutions: number;       // How many solutions to generate
  baseAngleOffsets: number[]; // Base angle offsets to try
  shoulderVariants: number[]; // Shoulder angle variants
  preferLowTravel: boolean;   // Prioritize solutions closer to current position
  preferHighManip: boolean;   // Prioritize high manipulability configurations
}

const DEFAULT_MULTI_CONFIG: MultiSolutionConfig = {
  numSolutions: 5,
  baseAngleOffsets: [0, 5, -5, 10, -10, 15, -15],
  shoulderVariants: [0, -10, 10],
  preferLowTravel: true,
  preferHighManip: true,
};

/**
 * Calculate travel distance between two joint configurations
 */
function calculateTravelDistance(from: JointState, to: JointState): number {
  return (
    Math.abs(to.base - from.base) +
    Math.abs(to.shoulder - from.shoulder) +
    Math.abs(to.elbow - from.elbow) +
    Math.abs(to.wrist - from.wrist) +
    Math.abs(to.wristRoll - from.wristRoll)
  );
}

/**
 * Estimate approach quality (0-1)
 * Good approach: gripper coming from above at reasonable angle
 */
function estimateApproachScore(joints: JointState): number {
  // Ideal shoulder angle for approach: -30 to -60 degrees (looking down)
  const shoulderScore = Math.max(0, 1 - Math.abs(joints.shoulder + 45) / 60);

  // Ideal wrist angle: 40-70 degrees (angled but not extreme)
  const wristScore = Math.max(0, 1 - Math.abs(joints.wrist - 55) / 50);

  // Elbow should be positive (arm bent, not extended)
  const elbowScore = joints.elbow > 20 ? 1 : joints.elbow / 20;

  return (shoulderScore * 0.4 + wristScore * 0.3 + elbowScore * 0.3);
}

/**
 * Estimate collision risk (0-1, 0 = safe)
 * Simple heuristic based on joint angles
 */
function estimateCollisionRisk(joints: JointState, targetY: number): number {
  let risk = 0;

  // Risk if wrist is very negative (pointing down into table)
  if (joints.wrist < -20) {
    risk += 0.3 * Math.min(1, Math.abs(joints.wrist + 20) / 40);
  }

  // Risk if shoulder is too positive (arm reaching back/up)
  if (joints.shoulder > 30) {
    risk += 0.2 * Math.min(1, (joints.shoulder - 30) / 30);
  }

  // Risk if target is very low
  if (targetY < 0.03) {
    risk += 0.2 * (1 - targetY / 0.03);
  }

  return Math.min(1, risk);
}

/**
 * Solve IK and return multiple ranked solutions
 *
 * Generates several solutions by trying different starting configurations
 * and ranks them by error, travel distance, manipulability, and approach quality.
 */
export function solveIKMultipleSolutions(
  target: IKTarget,
  currentJoints: JointState,
  config: Partial<MultiSolutionConfig> = {},
  ikConfig: Partial<IKConfig> = {}
): RankedIKSolution[] {
  const multiConfig = { ...DEFAULT_MULTI_CONFIG, ...config };
  const solutions: RankedIKSolution[] = [];
  const seenConfigs = new Set<string>();

  // Helper to create a unique key for a joint configuration
  const configKey = (j: JointState) =>
    `${Math.round(j.base)},${Math.round(j.shoulder)},${Math.round(j.elbow)},${Math.round(j.wrist)}`;

  // Try different base angle offsets
  for (const baseOffset of multiConfig.baseAngleOffsets) {
    // Calculate target base angle from position
    const targetBaseAngle = Math.atan2(target.position.z, target.position.x) * (180 / Math.PI);
    const trialBase = Math.max(-110, Math.min(110, targetBaseAngle + baseOffset));

    // Try different shoulder variants
    for (const shoulderOffset of multiConfig.shoulderVariants) {
      const startJoints: JointState = {
        ...currentJoints,
        base: trialBase,
        shoulder: Math.max(-100, Math.min(100, currentJoints.shoulder + shoulderOffset)),
      };

      const result = solveIK(target, startJoints, {
        ...ikConfig,
        maxIterations: 75, // Fewer iterations for multi-solution
      });

      // Skip if we've seen a very similar configuration
      const key = configKey(result.joints);
      if (seenConfigs.has(key)) continue;
      seenConfigs.add(key);

      // Calculate metrics
      const travelDistance = calculateTravelDistance(currentJoints, result.joints);
      const manipulability = calculateManipulability(result.joints);
      const approachScore = estimateApproachScore(result.joints);
      const collisionRisk = estimateCollisionRisk(result.joints, target.position.y);

      // Calculate overall score (higher is better)
      const errorPenalty = result.finalError * 100; // Convert to cm for scaling
      const travelPenalty = multiConfig.preferLowTravel ? travelDistance / 180 : 0;
      const manipBonus = multiConfig.preferHighManip ? manipulability * 0.5 : 0;

      const overallScore =
        1.0 -                           // Start at 1
        errorPenalty * 5 -              // Heavy penalty for error
        travelPenalty * 0.3 +           // Light penalty for travel
        manipBonus +                    // Bonus for manipulability
        approachScore * 0.2 -           // Bonus for good approach
        collisionRisk * 0.5;            // Penalty for collision risk

      solutions.push({
        joints: result.joints,
        error: result.finalError,
        travelDistance,
        manipulability,
        approachScore,
        collisionRisk,
        overallScore,
      });
    }
  }

  // Sort by overall score (descending)
  solutions.sort((a, b) => b.overallScore - a.overallScore);

  // Return top N solutions
  return solutions.slice(0, multiConfig.numSolutions);
}

/**
 * Get the best IK solution from multiple attempts
 *
 * Convenience wrapper that returns just the best solution
 */
export function solveBestIK(
  target: IKTarget,
  currentJoints: JointState,
  config: Partial<IKConfig> = {}
): IKResult {
  const solutions = solveIKMultipleSolutions(target, currentJoints, { numSolutions: 5 }, config);

  if (solutions.length === 0) {
    return {
      success: false,
      joints: currentJoints,
      iterations: 0,
      finalError: Infinity,
      converged: false,
      message: 'No valid IK solutions found',
    };
  }

  const best = solutions[0];
  return {
    success: best.error < 0.04, // 4cm threshold
    joints: best.joints,
    iterations: 0,
    finalError: best.error,
    converged: best.error < 0.01,
    message: `Best of ${solutions.length} solutions. Error: ${(best.error * 100).toFixed(1)}cm, ` +
             `Travel: ${best.travelDistance.toFixed(0)}°, Score: ${best.overallScore.toFixed(2)}`,
  };
}

/**
 * Get diagnostic information about the IK solver state
 */
export function getIKDiagnostics(joints: JointState): {
  gripperPosition: [number, number, number];
  manipulability: number;
  nearSingularity: boolean;
  jointMargins: { joint: string; margin: number }[];
} {
  const limits = getJointLimits();
  const jointArr = jointStateToArray(joints);

  const jointMargins = JOINT_NAMES.map((name, i) => {
    const distToMin = jointArr[i] - limits.min[i];
    const distToMax = limits.max[i] - jointArr[i];
    return {
      joint: name,
      margin: Math.min(distToMin, distToMax),
    };
  });

  return {
    gripperPosition: calculateSO101GripperPosition(joints),
    manipulability: calculateManipulability(joints),
    nearSingularity: isNearSingularity(joints),
    jointMargins,
  };
}
