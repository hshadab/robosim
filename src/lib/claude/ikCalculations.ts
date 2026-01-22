/**
 * IK Calculations for Claude Robot Control
 *
 * Contains inverse kinematics functions for the SO-101 robot arm.
 * Extracted from claudeApi.ts for better modularity.
 */

import { loggers } from '../logger';
import { solveIKAsync } from '../ikSolverWorker';
import { calculateJawPositionURDF } from '../../components/simulation/SO101KinematicsURDF';
import { SO101_JOINT_LIMITS, clampJointValue } from '../../config/so101Limits';
import { IK, JAW_OFFSET } from '../../config/gripperConstants';

const log = loggers.claude;

/**
 * Joint angles for IK calculations (degrees)
 */
export interface JointAngles {
  base: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  wristRoll: number;
}

// Re-export for backward compatibility
export const JOINT_LIMITS = SO101_JOINT_LIMITS;

/**
 * IK error threshold - positions with error below this are reachable
 */
export const IK_ERROR_THRESHOLD = IK.ERROR_THRESHOLD_M;

/**
 * JAW-TIP OFFSET CONSTANT
 * The jaw contact point is offset from gripper_frame_link in local gripper coordinates
 */
export const JAW_LOCAL_Z_OFFSET = JAW_OFFSET.LOCAL_Z;

/**
 * Clamp joint angle to its limits
 */
export function clampJoint(jointName: keyof typeof SO101_JOINT_LIMITS, value: number): number {
  return clampJointValue(jointName, value);
}

/**
 * Calculate gripper position using URDF-based FK
 * Uses JAW position for IK - this is where the object will be grasped.
 */
export function calculateGripperPos(joints: JointAngles): [number, number, number] {
  return calculateJawPositionURDF(joints);
}

/**
 * Calculate base angle to point at a position
 * Robot faces +Z direction when base=0, positive rotation is counter-clockwise (left)
 */
export function calculateBaseAngleForPosition(x: number, z: number): number {
  // Base=0 points toward +X, Base=90 points toward +Z
  // atan2(z, x) gives angle from X axis toward Z axis
  const angleRad = Math.atan2(z, x);
  const angleDeg = (angleRad * 180) / Math.PI;
  log.debug(`[calculateBaseAngle] x=${x.toFixed(3)}, z=${z.toFixed(3)} => angle=${angleDeg.toFixed(1)}`);
  return Math.max(-110, Math.min(110, angleDeg));
}

/**
 * Calculate where the TIP needs to be so that JAWS are at target position
 * @param targetY - Desired jaw Y position (object center height)
 * @param wristAngleDeg - Expected wrist angle (0=horizontal, 90=vertical)
 * @returns Required tip Y position
 */
export function calculateTipYForJawY(targetY: number, wristAngleDeg: number): number {
  // When gripper points down (wrist=90), jaw Z offset becomes Y offset
  // When gripper is horizontal (wrist=0), jaw Z offset is horizontal (no Y change)
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  const jawOffsetY = JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
  return targetY - jawOffsetY;
}

/**
 * Estimate where jaws will be given tip position and wrist angle
 */
export function estimateJawY(tipY: number, wristAngleDeg: number): number {
  const wristRad = (Math.abs(wristAngleDeg) * Math.PI) / 180;
  return tipY + JAW_LOCAL_Z_OFFSET * Math.sin(wristRad);
}

/**
 * Numerical IK solver using Web Worker to prevent UI freezes
 * Tries multiple starting configurations to avoid local minima
 * If fixedBaseAngle is provided, the base angle is locked to that value
 * If preferHorizontalGrasp is true, penalize high wrist angles to get horizontal grasps
 */
export async function solveIKForTarget(
  targetPos: [number, number, number],
  _maxIter = 1000,
  fixedBaseAngle?: number,
  preferHorizontalGrasp = false
): Promise<{ joints: JointAngles; error: number }> {
  // Use Web Worker for non-blocking IK solving
  const result = await solveIKAsync(targetPos, {
    maxIter: _maxIter,
    fixedBaseAngle,
    preferHorizontalGrasp,
  });

  log.debug(`[solveIKForTarget] Target: [${(targetPos[0]*100).toFixed(1)}, ${(targetPos[1]*100).toFixed(1)}, ${(targetPos[2]*100).toFixed(1)}]cm`);
  log.debug(`[solveIKForTarget] Result: base=${result.joints.base.toFixed(1)}, shoulder=${result.joints.shoulder.toFixed(1)}, elbow=${result.joints.elbow.toFixed(1)}, wrist=${result.joints.wrist.toFixed(1)}`);
  log.debug(`[solveIKForTarget] Error: ${(result.error*100).toFixed(2)}cm`);

  // Verify the final position
  const finalPos = calculateGripperPos(result.joints);
  log.debug(`[solveIKForTarget] Achieved: [${(finalPos[0]*100).toFixed(1)}, ${(finalPos[1]*100).toFixed(1)}, ${(finalPos[2]*100).toFixed(1)}]cm`);

  return result;
}

/**
 * Calculate grasp position using LeRobot-style configurations
 *
 * Based on real SO-101 training data from HuggingFace (lerobot/svla_so101_pickplace):
 *   - shoulder_lift: -99 to -86 (pointing strongly downward)
 *   - elbow_flex: 73 to 100 (bent)
 *   - wrist_flex: ~75 (STEEP angle, NOT horizontal!)
 *   - wrist_roll: -48 to +10
 *
 * Key insight: Real robot grasps use TOP-DOWN approach with steep wrist (~75),
 * NOT horizontal side approach. The jaw contact point is offset from gripper_frame.
 */
export async function calculateGraspJoints(
  objX: number,
  objY: number,
  objZ: number,
  baseAngle?: number,
  forceSideGrasp = false
): Promise<{ joints: JointAngles; error: number; achievedY: number }> {
  const MIN_GRASP_HEIGHT = 0.01; // 1cm above floor - allow very low reach

  log.debug(`[calculateGraspJoints] ========================================`);
  log.debug(`[calculateGraspJoints] Object at [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);
  log.debug(`[calculateGraspJoints] Force side grasp: ${forceSideGrasp}`);

  let bestResult = { joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } as JointAngles, error: Infinity };
  let bestAchievedY = 0;
  let bestJawY = 0;
  let bestStrategy = '';

  // STRATEGY 0: For low objects, DIRECTLY target the object position
  log.debug(`[calculateGraspJoints] STRATEGY 0: Direct targeting at object height${forceSideGrasp ? ' (FORCING HORIZONTAL)' : ''}`);

  const directTargets: [number, number, number][] = [
    [objX, objY, objZ],                    // Exact object center
    [objX, objY + 0.01, objZ],             // 1cm above
    [objX, objY + 0.02, objZ],             // 2cm above
    [objX, objY + 0.03, objZ],             // 3cm above
  ];

  for (const target of directTargets) {
    const result = await solveIKForTarget(target, 1000, baseAngle, forceSideGrasp);
    const achievedPos = calculateGripperPos(result.joints);
    const jawY = estimateJawY(achievedPos[1], result.joints.wrist);

    log.debug(`[calculateGraspJoints] Direct target Y=${(target[1]*100).toFixed(1)}cm: tip=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(jawY*100).toFixed(1)}cm, wrist=${result.joints.wrist.toFixed(1)}, error=${(result.error*100).toFixed(2)}cm`);

    const jawError = Math.abs(jawY - objY);
    const combinedScore = result.error + jawError * 0.5;

    if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5 || bestResult.error === Infinity) {
      bestResult = result;
      bestAchievedY = achievedPos[1];
      bestJawY = jawY;
      bestStrategy = `Direct Y=${(target[1]*100).toFixed(1)}cm`;
    }

    if (result.error < 0.02 && jawError < 0.05) {
      log.debug(`[calculateGraspJoints] Good direct solution found!`);
      break;
    }
  }

  // STRATEGY 1: For low objects, try HORIZONTAL grasps
  if (objY < 0.08) {
    log.debug(`[calculateGraspJoints] STRATEGY 1: Horizontal grasp for low object`);

    const horizontalTargets: [number, number, number][] = [
      [objX, objY, objZ],
      [objX, objY + 0.01, objZ],
      [objX, objY + 0.02, objZ],
    ];

    for (const target of horizontalTargets) {
      const result = await solveIKForTarget(target, 1000, baseAngle, true);
      const achievedPos = calculateGripperPos(result.joints);
      const jawY = estimateJawY(achievedPos[1], result.joints.wrist);
      const jawError = Math.abs(jawY - objY);
      const combinedScore = result.error + jawError * 0.5;

      log.debug(`[calculateGraspJoints] Horizontal target Y=${(target[1]*100).toFixed(1)}cm: tip=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(jawY*100).toFixed(1)}cm, wrist=${result.joints.wrist.toFixed(1)}, error=${(result.error*100).toFixed(2)}cm`);

      if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5) {
        bestResult = result;
        bestAchievedY = achievedPos[1];
        bestJawY = jawY;
        bestStrategy = `Horizontal Y=${(target[1]*100).toFixed(1)}cm`;
      }

      if (result.error < 0.02 && Math.abs(result.joints.wrist) < 45) {
        log.debug(`[calculateGraspJoints] Good horizontal solution found!`);
        break;
      }
    }
  }

  // STRATEGY 2: Try angled grasps
  log.debug(`[calculateGraspJoints] STRATEGY 2: Angled grasps`);

  const wristAngles = [30, 45, 60];

  for (const wristAngle of wristAngles) {
    const tipY = calculateTipYForJawY(objY, wristAngle);

    if (tipY < MIN_GRASP_HEIGHT) {
      log.debug(`[calculateGraspJoints] Wrist ${wristAngle} would require tip at Y=${(tipY*100).toFixed(1)}cm - skipping`);
      continue;
    }

    const target: [number, number, number] = [objX, tipY, objZ];
    const result = await solveIKForTarget(target, 1000, baseAngle, false);
    const achievedPos = calculateGripperPos(result.joints);
    const actualJawY = estimateJawY(achievedPos[1], result.joints.wrist);
    const jawError = Math.abs(actualJawY - objY);
    const combinedScore = result.error + jawError * 0.5;

    log.debug(`[calculateGraspJoints] Angled ${wristAngle}: tip target Y=${(tipY*100).toFixed(1)}cm, achieved=[${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm, jaw Y=${(actualJawY*100).toFixed(1)}cm, error=${(result.error*100).toFixed(2)}cm`);

    if (combinedScore < bestResult.error + Math.abs(bestJawY - objY) * 0.5) {
      bestResult = result;
      bestAchievedY = achievedPos[1];
      bestJawY = actualJawY;
      bestStrategy = `Angled ${wristAngle}`;
    }
  }

  log.debug(`[calculateGraspJoints] ========================================`);
  log.debug(`[calculateGraspJoints] BEST RESULT: ${bestStrategy}`);
  log.debug(`[calculateGraspJoints]   Object Y: ${(objY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Tip Y: ${(bestAchievedY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Jaw Y: ${(bestJawY*100).toFixed(1)}cm`);
  log.debug(`[calculateGraspJoints]   Wrist: ${bestResult.joints.wrist.toFixed(1)}`);
  log.debug(`[calculateGraspJoints]   IK Error: ${(bestResult.error*100).toFixed(2)}cm`);

  const jawToObjectError = Math.abs(bestJawY - objY);
  if (jawToObjectError > 0.05) {
    log.warn(`[calculateGraspJoints] WARNING: Jaw-object gap of ${(jawToObjectError*100).toFixed(1)}cm may prevent grasp!`);
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateGraspJoints] WARNING: IK error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold!`);
  }

  return { ...bestResult, achievedY: bestAchievedY };
}

/**
 * Calculate approach position DERIVED from grasp joints for smooth vertical descent
 * Instead of independent IK (which can find different arm configurations causing sweep),
 * we derive approach from grasp by raising the shoulder to lift the arm while keeping similar shape
 */
export async function calculateApproachJoints(
  objX: number,
  objY: number,
  objZ: number,
  baseAngle: number,
  graspAchievedY?: number,
  graspJoints?: JointAngles,
  forceSideApproach?: boolean
): Promise<{ joints: JointAngles; error: number }> {
  // For SIDE APPROACH: derive approach from grasp joints to ensure smooth horizontal motion
  if (forceSideApproach && graspJoints) {
    const graspPos = calculateGripperPos(graspJoints);

    log.debug(`[calculateApproachJoints] SIDE APPROACH: grasp pos=[${(graspPos[0]*100).toFixed(1)}, ${(graspPos[1]*100).toFixed(1)}, ${(graspPos[2]*100).toFixed(1)}]cm, wrist=${graspJoints.wrist.toFixed(1)}`);

    const adjustments = [
      { shoulder: 15, elbow: -10, wrist: 0 },
      { shoulder: 20, elbow: -15, wrist: 0 },
      { shoulder: 25, elbow: -20, wrist: -5 },
      { shoulder: 30, elbow: -25, wrist: -5 },
    ];

    for (const adj of adjustments) {
      const approachJoints: JointAngles = {
        base: graspJoints.base,
        shoulder: clampJoint('shoulder', graspJoints.shoulder + adj.shoulder),
        elbow: clampJoint('elbow', graspJoints.elbow + adj.elbow),
        wrist: clampJoint('wrist', graspJoints.wrist + adj.wrist),
        wristRoll: 0,
      };

      const approachPos = calculateGripperPos(approachJoints);

      const graspDist = Math.sqrt(graspPos[0] ** 2 + graspPos[2] ** 2);
      const approachDist = Math.sqrt(approachPos[0] ** 2 + approachPos[2] ** 2);
      const heightDiff = Math.abs(approachPos[1] - graspPos[1]);

      if (approachDist > graspDist + 0.03 && heightDiff < 0.02) {
        const error = Math.sqrt(
          (approachPos[0] - objX) ** 2 +
          (approachPos[2] - objZ) ** 2
        );
        log.debug(`[calculateApproachJoints] SIDE APPROACH SUCCESS: approach=[${(approachPos[0]*100).toFixed(1)}, ${(approachPos[1]*100).toFixed(1)}, ${(approachPos[2]*100).toFixed(1)}]cm, wrist=${approachJoints.wrist.toFixed(1)}`);
        return { joints: approachJoints, error };
      }
    }

    log.debug(`[calculateApproachJoints] SIDE APPROACH: derived approach failed, trying IK fallback`);

    const dirX = objX;
    const dirZ = objZ;
    const dist = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const normX = dirX / dist;
    const normZ = dirZ / dist;

    for (const offset of [0.06, 0.08, 0.05]) {
      const approachX = objX + normX * offset;
      const approachZ = objZ + normZ * offset;
      const approachY = graspPos[1] + 0.005;

      const result = await solveIKForTarget([approachX, approachY, approachZ], 1000, baseAngle, true);
      if (result.error < 0.03 && Math.abs(result.joints.wrist) < 45) {
        log.debug(`[calculateApproachJoints] SIDE APPROACH IK fallback: wrist=${result.joints.wrist.toFixed(1)}`);
        return result;
      }
    }

    log.debug(`[calculateApproachJoints] SIDE APPROACH failed completely, falling back to vertical`);
  }

  // If we have grasp joints, derive approach from them for smooth vertical motion
  if (graspJoints) {
    const adjustments = [
      { shoulder: 25, elbow: -15, wrist: -5 },
      { shoulder: 30, elbow: -20, wrist: -10 },
      { shoulder: 20, elbow: -10, wrist: 0 },
      { shoulder: 35, elbow: -25, wrist: -15 },
    ];

    const graspPos = calculateGripperPos(graspJoints);

    for (const adj of adjustments) {
      const approachJoints: JointAngles = {
        base: graspJoints.base,
        shoulder: clampJoint('shoulder', graspJoints.shoulder + adj.shoulder),
        elbow: clampJoint('elbow', graspJoints.elbow + adj.elbow),
        wrist: clampJoint('wrist', graspJoints.wrist + adj.wrist),
        wristRoll: 0,
      };

      const approachPos = calculateGripperPos(approachJoints);

      if (approachPos[1] > graspPos[1] + 0.04) {
        const error = Math.sqrt(
          (approachPos[0] - objX) ** 2 +
          (approachPos[2] - objZ) ** 2
        );

        log.debug(`[calculateApproachJoints] Derived from grasp: approach Y=${(approachPos[1]*100).toFixed(1)}cm, grasp Y=${(graspPos[1]*100).toFixed(1)}cm, delta=${((approachPos[1]-graspPos[1])*100).toFixed(1)}cm, horiz_error=${(error*100).toFixed(1)}cm`);
        return { joints: approachJoints, error };
      }
    }
    log.debug(`[calculateApproachJoints] All derived approaches too low, falling back to IK`);
  }

  // Fallback: Use IK to find approach position
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  const approachHeights = [
    referenceY + 0.06,
    referenceY + 0.08,
    referenceY + 0.10,
    referenceY + 0.12,
  ];

  let bestResult = await solveIKForTarget([objX, approachHeights[0], objZ], 1000, baseAngle);

  for (const approachY of approachHeights) {
    const approachTarget: [number, number, number] = [objX, approachY, objZ];
    const result = await solveIKForTarget(approachTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    if (result.error < 0.02) {
      log.debug(`[calculateApproachJoints] Found good approach at Y=${(approachY*100).toFixed(1)}cm via IK`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateApproachJoints] WARNING: Best approach error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}

/**
 * Calculate lift position with validation (raised after grasping)
 * KEEP SAME BASE ANGLE to prevent spinning
 * Uses achieved grasp Y to determine lift height for consistency
 */
export async function calculateLiftJoints(
  objX: number,
  objY: number,
  objZ: number,
  baseAngle: number,
  graspAchievedY?: number
): Promise<{ joints: JointAngles; error: number }> {
  const referenceY = graspAchievedY !== undefined ? graspAchievedY : objY;

  const liftHeights = [
    referenceY + 0.15,
    referenceY + 0.18,
    referenceY + 0.20,
    referenceY + 0.12,
  ];

  let bestResult = await solveIKForTarget([objX, liftHeights[0], objZ], 1000, baseAngle);

  for (const liftY of liftHeights) {
    const liftTarget: [number, number, number] = [objX, liftY, objZ];
    const result = await solveIKForTarget(liftTarget, 1000, baseAngle);

    if (result.error < bestResult.error) {
      bestResult = result;
    }

    if (result.error < 0.02 && liftY >= referenceY + 0.14) {
      log.debug(`[calculateLiftJoints] Found good lift at Y=${(liftY*100).toFixed(1)}cm`);
      break;
    }
  }

  if (bestResult.error > IK_ERROR_THRESHOLD) {
    log.warn(`[calculateLiftJoints] WARNING: Best lift error ${(bestResult.error*100).toFixed(1)}cm exceeds threshold`);
  }

  return bestResult;
}
