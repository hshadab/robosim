/**
 * Pickup Sequence Handler
 *
 * Handles pick-up commands for the SO-101 robot arm using IK-based control.
 * Extracted from claudeApi.ts for better modularity.
 */

import type { JointState, JointSequenceStep, SimObject } from '../../types';
import type { ClaudeResponse, PickupAttemptInfo } from './types';
import { loggers } from '../logger';
import { findSimilarPickups, findClosestVerifiedPickup, adaptVerifiedSequence } from '../pickupExamples';
import { matchObjectToMessage } from './objectMatching';
import {
  calculateGraspJoints,
  calculateApproachJoints,
  calculateLiftJoints,
  calculateGripperPos,
  clampJoint,
} from './ikCalculations';

const log = loggers.claude;

/**
 * Handle pick-up commands (async for IK worker)
 */
export async function handlePickUpCommand(
  message: string,
  grabbableObjects: SimObject[],
  heldObject: SimObject | undefined
): Promise<ClaudeResponse> {
  // If we're already holding something
  if (heldObject) {
    return {
      action: 'explain',
      description: `I'm already holding "${heldObject.name || heldObject.id}". Say "drop" or "place" to release it first.`,
    };
  }

  // Find an object to pick up
  if (grabbableObjects.length === 0) {
    log.debug('No grabbable objects found');
    return {
      action: 'explain',
      description: "I don't see any objects to pick up. Try adding an object using the Object Library first.",
    };
  }

  log.debug('Grabbable objects:', grabbableObjects.map(o => ({
    name: o.name,
    type: o.type,
    id: o.id,
    position: o.position,
    isGrabbable: o.isGrabbable
  })));

  // Find closest object or one matching the name/color/type
  let targetObject = grabbableObjects[0];
  let matchFound = false;

  for (const obj of grabbableObjects) {
    const matchResult = matchObjectToMessage(obj, message);
    if (matchResult.match) {
      targetObject = obj;
      matchFound = true;
      log.debug(`Matched object: ${targetObject.name} via ${matchResult.via}`);
      break;
    }
  }

  if (!matchFound) {
    log.debug('No specific match found, using first object:', targetObject.name);
  }

  const [objX, objY, objZ] = targetObject.position;
  const objName = targetObject.name || targetObject.id;
  const objScale = targetObject.scale || 0.04;
  const objType = targetObject.type || 'cube';

  // Calculate horizontal distance from robot base to object
  const distance = Math.sqrt(objX * objX + objZ * objZ);

  // For cylinders: height = 6*scale, radius = 0.5*scale
  const cylHeight = objType === 'cylinder' ? objScale * 6 : objScale;
  const cylRadius = objType === 'cylinder' ? objScale * 0.5 : objScale / 2;
  const objBottom = objY - cylHeight / 2;
  const objTop = objY + cylHeight / 2;

  log.debug(`[handlePickUpCommand] ========================================`);
  log.debug(`[handlePickUpCommand] Pick up "${objName}" (${objType})`);
  log.debug(`[handlePickUpCommand]   Scale: ${(objScale*100).toFixed(1)}cm`);
  log.debug(`[handlePickUpCommand]   Position (center): [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);
  log.debug(`[handlePickUpCommand]   Distance from base: ${(distance*100).toFixed(1)}cm`);
  if (objType === 'cylinder') {
    log.debug(`[handlePickUpCommand]   Cylinder height: ${(cylHeight*100).toFixed(1)}cm, radius: ${(cylRadius*100).toFixed(1)}cm`);
    log.debug(`[handlePickUpCommand]   Cylinder bottom: Y=${(objBottom*100).toFixed(1)}cm, top: Y=${(objTop*100).toFixed(1)}cm`);
  }
  log.debug(`[handlePickUpCommand] ========================================`);

  // ========================================
  // VERIFIED EXAMPLE MATCHING (smart demo zone)
  // ========================================
  const verifiedMatch = findClosestVerifiedPickup(objType, [objX, objY, objZ], 0.01);

  if (verifiedMatch) {
    const { example, distance: matchDistance } = verifiedMatch;
    log.debug(`[handlePickUpCommand] Found verified example "${example.id}" at ${(matchDistance * 100).toFixed(1)}cm distance`);

    const baseForObject = Math.atan2(objZ, objX) * (180 / Math.PI);
    const adaptedSequence = adaptVerifiedSequence(example, baseForObject);

    log.debug(`[handlePickUpCommand] Using verified sequence with base=${baseForObject.toFixed(1)}`);

    return {
      action: 'sequence',
      joints: adaptedSequence,
      description: `Picking up "${objName}" using verified motion (matched to ${example.objectName}).`,
      code: `// Verified pickup for "${objName}" (matched example: ${example.id})
// Original position: [${example.objectPosition.map(p => (p * 100).toFixed(0)).join(', ')}]cm
// Target position: [${(objX * 100).toFixed(0)}, ${(objY * 100).toFixed(0)}, ${(objZ * 100).toFixed(0)}]cm
await moveJoints({ base: ${baseForObject.toFixed(1)}, shoulder: ${example.jointSequence[1]?.shoulder ?? -22}, elbow: ${example.jointSequence[1]?.elbow ?? 51}, wrist: ${example.jointSequence[1]?.wrist ?? 63}, wristRoll: 90, gripper: 100 });
await closeGripper();
await liftArm();`,
      pickupAttempt: {
        objectPosition: [objX, objY, objZ],
        objectType: objType,
        objectName: objName,
        objectScale: objScale,
        ikErrors: { approach: 0.005, grasp: matchDistance, lift: 0.005 },
      } as PickupAttemptInfo,
    };
  }

  // ========================================
  // URDF-BASED IK APPROACH (fallback for other positions)
  // ========================================
  log.debug(`[handlePickUpCommand] Using URDF-based IK approach (object not in Demo zone)`);

  let graspTargetY = objY;
  if (objType === 'cylinder') {
    const graspHeight = objBottom + cylHeight * 0.35;
    graspTargetY = graspHeight;
    log.debug(`[handlePickUpCommand] Cylinder grasp: targeting Y=${(graspTargetY*100).toFixed(1)}cm (1/3 up from bottom)`);
  } else {
    log.debug(`[handlePickUpCommand] Object center at Y=${(objY*100).toFixed(1)}cm - targeting directly`);
  }

  // Calculate base angle ONCE and use for all phases to prevent spinning
  const rawBaseAngle = Math.atan2(objZ, objX) * (180 / Math.PI);
  const baseAngle = clampJoint('base', rawBaseAngle);

  if (Math.abs(rawBaseAngle) > 110) {
    log.warn(`[handlePickUpCommand] WARNING: Object at angle ${rawBaseAngle.toFixed(1)} is outside base rotation limits (110)`);
  }
  log.debug(`[handlePickUpCommand] Fixed base angle: ${baseAngle.toFixed(1)} for object at X=${(objX*100).toFixed(1)}cm, Z=${(objZ*100).toFixed(1)}cm`);

  // Determine if we need to force side grasp
  const isLowObject = graspTargetY < 0.05;
  const forceSideGrasp = objType === 'cylinder' || (objType === 'cube' && isLowObject);
  log.debug(`[handlePickUpCommand] Force side grasp: ${forceSideGrasp} (type=${objType}, isLow=${isLowObject})`);

  // Calculate joint angles for each phase
  const graspResult = await calculateGraspJoints(objX, graspTargetY, objZ, undefined, forceSideGrasp);
  const optimalBaseAngle = graspResult.joints.base;

  log.debug(`[handlePickUpCommand] Optimal base from grasp IK: ${optimalBaseAngle.toFixed(1)} (nominal was ${baseAngle.toFixed(1)})`);

  const approachResult = await calculateApproachJoints(objX, graspTargetY, objZ, optimalBaseAngle, graspResult.achievedY, graspResult.joints, forceSideGrasp);
  const liftResult = await calculateLiftJoints(objX, graspTargetY, objZ, optimalBaseAngle, graspResult.achievedY);

  log.debug(`[handlePickUpCommand] IK errors: approach=${(approachResult.error*100).toFixed(1)}cm, grasp=${(graspResult.error*100).toFixed(1)}cm, lift=${(liftResult.error*100).toFixed(1)}cm`);

  // ========================================
  // VALIDATION LOOP WITH RETRY
  // ========================================
  const IK_FALLBACK_THRESHOLD = 0.04;
  const IK_RETRY_THRESHOLD = 0.03;

  let finalGraspResult = graspResult;
  let finalApproachResult = approachResult;
  let finalLiftResult = liftResult;
  let retryAttempts = 0;
  const maxRetries = 3;
  const maxError = Math.max(approachResult.error, graspResult.error, liftResult.error);

  if (maxError > IK_FALLBACK_THRESHOLD) {
    log.warn(`[handlePickUpCommand] IK error ${(maxError*100).toFixed(1)}cm exceeds threshold, starting validation loop`);

    // RETRY STRATEGY 1: Try different base angles
    const baseOffsets = [5, -5, 10, -10];
    for (const offset of baseOffsets) {
      if (retryAttempts >= maxRetries) break;
      retryAttempts++;

      const retryBase = clampJoint('base', optimalBaseAngle + offset);
      log.debug(`[handlePickUpCommand] Retry ${retryAttempts}: base offset ${offset > 0 ? '+' : ''}${offset} (${retryBase.toFixed(1)})`);

      const retryGrasp = await calculateGraspJoints(objX, graspTargetY, objZ, retryBase, forceSideGrasp);
      if (retryGrasp.error < finalGraspResult.error) {
        finalGraspResult = retryGrasp;
        finalApproachResult = await calculateApproachJoints(objX, graspTargetY, objZ, retryBase, retryGrasp.achievedY, retryGrasp.joints, forceSideGrasp);
        finalLiftResult = await calculateLiftJoints(objX, graspTargetY, objZ, retryBase, retryGrasp.achievedY);

        const newMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
        log.debug(`[handlePickUpCommand] Retry improved: error ${(newMaxError*100).toFixed(1)}cm`);

        if (newMaxError < IK_RETRY_THRESHOLD) {
          log.info(`[handlePickUpCommand] Retry succeeded with base offset ${offset > 0 ? '+' : ''}${offset}`);
          break;
        }
      }
    }

    // RETRY STRATEGY 2: Try different grasp heights
    const heightOffsets = [0.01, -0.01, 0.02, -0.02];
    const currentMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);

    if (currentMaxError > IK_RETRY_THRESHOLD) {
      for (const hOffset of heightOffsets) {
        if (retryAttempts >= maxRetries * 2) break;
        retryAttempts++;

        const retryY = Math.max(0.02, graspTargetY + hOffset);
        log.debug(`[handlePickUpCommand] Retry ${retryAttempts}: height offset ${(hOffset*100).toFixed(0)}cm (Y=${(retryY*100).toFixed(1)}cm)`);

        const retryGrasp = await calculateGraspJoints(objX, retryY, objZ, undefined, forceSideGrasp);
        if (retryGrasp.error < finalGraspResult.error) {
          finalGraspResult = retryGrasp;
          finalApproachResult = await calculateApproachJoints(objX, retryY, objZ, retryGrasp.joints.base, retryGrasp.achievedY, retryGrasp.joints, forceSideGrasp);
          finalLiftResult = await calculateLiftJoints(objX, retryY, objZ, retryGrasp.joints.base, retryGrasp.achievedY);

          const newMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
          log.debug(`[handlePickUpCommand] Height retry improved: error ${(newMaxError*100).toFixed(1)}cm`);

          if (newMaxError < IK_RETRY_THRESHOLD) {
            log.info(`[handlePickUpCommand] Height retry succeeded with offset ${(hOffset*100).toFixed(0)}cm`);
            break;
          }
        }
      }
    }

    // RETRY STRATEGY 3: Toggle side grasp approach
    const finalMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);
    if (finalMaxError > IK_RETRY_THRESHOLD && retryAttempts < maxRetries * 3) {
      const altSideGrasp = !forceSideGrasp;
      log.debug(`[handlePickUpCommand] Retry: toggling side grasp to ${altSideGrasp}`);

      const retryGrasp = await calculateGraspJoints(objX, graspTargetY, objZ, undefined, altSideGrasp);
      if (retryGrasp.error < finalGraspResult.error * 0.8) {
        finalGraspResult = retryGrasp;
        finalApproachResult = await calculateApproachJoints(objX, graspTargetY, objZ, retryGrasp.joints.base, retryGrasp.achievedY, retryGrasp.joints, altSideGrasp);
        finalLiftResult = await calculateLiftJoints(objX, graspTargetY, objZ, retryGrasp.joints.base, retryGrasp.achievedY);
        log.info(`[handlePickUpCommand] Side grasp toggle improved result`);
      }
    }

    // After all retries, check if we should fall back to verified examples
    const bestMaxError = Math.max(finalApproachResult.error, finalGraspResult.error, finalLiftResult.error);

    if (bestMaxError > IK_FALLBACK_THRESHOLD) {
      log.warn(`[handlePickUpCommand] All retries exhausted, best error ${(bestMaxError*100).toFixed(1)}cm, checking verified fallback`);

      const similarPickups = findSimilarPickups(objType, [objX, objY, objZ], 1);

      if (similarPickups.length > 0 && similarPickups[0].ikErrors.grasp < 0.02) {
        const fallbackExample = similarPickups[0];
        const fallbackBase = Math.atan2(objZ, objX) * (180 / Math.PI);

        log.info(`[handlePickUpCommand] Falling back to verified example "${fallbackExample.id}" after ${retryAttempts} retries`);

        const fallbackSequence = adaptVerifiedSequence(fallbackExample, fallbackBase);

        return {
          action: 'sequence',
          joints: fallbackSequence,
          description: `Picking up "${objName}" using verified fallback (IK error after ${retryAttempts} retries: ${(bestMaxError*100).toFixed(0)}cm).`,
          code: `// Verified fallback for "${objName}" (IK error: ${(bestMaxError*100).toFixed(0)}cm, ${retryAttempts} retries)
// Using verified example: ${fallbackExample.id}
await moveJoints({ base: ${fallbackBase.toFixed(1)}, ...verifiedGraspAngles });
await closeGripper();
await liftArm();`,
          pickupAttempt: {
            objectPosition: [objX, objY, objZ],
            objectType: objType,
            objectName: objName,
            objectScale: objScale,
            ikErrors: { approach: bestMaxError, grasp: bestMaxError, lift: bestMaxError },
          } as PickupAttemptInfo,
        };
      } else {
        log.warn(`[handlePickUpCommand] No suitable verified fallback, proceeding with best IK result (${(bestMaxError*100).toFixed(1)}cm error)`);
      }
    } else {
      log.info(`[handlePickUpCommand] Validation loop succeeded after ${retryAttempts} retries (${(bestMaxError*100).toFixed(1)}cm error)`);
    }
  }

  // Update results with final validated values
  const validatedGraspResult = finalGraspResult;
  const validatedApproachResult = finalApproachResult;
  const validatedLiftResult = finalLiftResult;
  const validatedMaxError = Math.max(validatedApproachResult.error, validatedGraspResult.error, validatedLiftResult.error);

  // Check for reachability warnings
  let reachabilityWarning = '';
  if (Math.abs(objX) < 0.05 && Math.abs(objZ) > 0.10) {
    reachabilityWarning = ` Warning: Object is in a difficult-to-reach zone (small X, large Z). The arm has a ~4cm X offset that limits reach to X < 0.05m at far distances.`;
    log.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (validatedMaxError > 0.06) {
    reachabilityWarning = ` Warning: Object may be outside arm's reachable workspace (IK error: ${(validatedMaxError*100).toFixed(0)}cm). Try repositioning the object.`;
    log.warn(`[handlePickUpCommand] ${reachabilityWarning}`);
  } else if (validatedMaxError > 0.04) {
    reachabilityWarning = ` Note: Object is at edge of arm's reach (IK error: ${(validatedMaxError*100).toFixed(0)}cm).`;
  } else if (validatedMaxError > 0.02) {
    log.debug(`[handlePickUpCommand] Good reach with ${(validatedMaxError*100).toFixed(1)}cm error`);
  } else {
    log.debug(`[handlePickUpCommand] Excellent reach with ${(validatedMaxError*100).toFixed(1)}cm error`);
  }

  // Build the grasp sequence using validated IK-calculated angles
  const wristRollAngle = forceSideGrasp ? 0 : 90;

  const graspJoints: JointState = {
    base: validatedGraspResult.joints.base,
    shoulder: validatedGraspResult.joints.shoulder,
    elbow: validatedGraspResult.joints.elbow,
    wrist: validatedGraspResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 0,
  };

  const approachJoints: JointState = {
    base: validatedApproachResult.joints.base,
    shoulder: validatedApproachResult.joints.shoulder,
    elbow: validatedApproachResult.joints.elbow,
    wrist: validatedApproachResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 100,
  };

  const liftJoints: JointState = {
    base: validatedLiftResult.joints.base,
    shoulder: validatedLiftResult.joints.shoulder,
    elbow: validatedLiftResult.joints.elbow,
    wrist: validatedLiftResult.joints.wrist,
    wristRoll: wristRollAngle,
    gripper: 0,
  };

  log.debug(`[handlePickUpCommand] Approach: base=${approachJoints.base.toFixed(1)}, shoulder=${approachJoints.shoulder.toFixed(1)}, elbow=${approachJoints.elbow.toFixed(1)}, wrist=${approachJoints.wrist.toFixed(1)}`);
  log.debug(`[handlePickUpCommand] Grasp: base=${graspJoints.base.toFixed(1)}, shoulder=${graspJoints.shoulder.toFixed(1)}, elbow=${graspJoints.elbow.toFixed(1)}, wrist=${graspJoints.wrist.toFixed(1)}`);
  log.debug(`[handlePickUpCommand] Lift: base=${liftJoints.base.toFixed(1)}, shoulder=${liftJoints.shoulder.toFixed(1)}, elbow=${liftJoints.elbow.toFixed(1)}, wrist=${liftJoints.wrist.toFixed(1)}`);
  log.debug(`[handlePickUpCommand] WristRoll: ${wristRollAngle} (${forceSideGrasp ? 'horizontal fingers for cylinder' : 'vertical fingers for cube/ball'})`);
  log.debug(`[handlePickUpCommand] Approach type: ${forceSideGrasp ? 'SIDE (horizontal)' : 'VERTICAL (from above)'}`);

  // Log expected tip positions from our FK
  const expectedGraspPos = calculateGripperPos(graspResult.joints);
  const expectedApproachPos = calculateGripperPos(approachResult.joints);
  log.debug(`[handlePickUpCommand] Expected approach tip: [${expectedApproachPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  log.debug(`[handlePickUpCommand] Expected grasp tip: [${expectedGraspPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  log.debug(`[handlePickUpCommand] Object position: [${(objX*100).toFixed(1)}, ${(objY*100).toFixed(1)}, ${(objZ*100).toFixed(1)}]cm`);

  // Build 5-step sequence
  const sequence: JointSequenceStep[] = [
    // Step 1: Move to APPROACH position (above object) with gripper open
    {
      base: approachJoints.base,
      shoulder: approachJoints.shoulder,
      elbow: approachJoints.elbow,
      wrist: approachJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 100
    },
    // Step 2: Lower to grasp position (gripper still open)
    {
      base: graspJoints.base,
      shoulder: graspJoints.shoulder,
      elbow: graspJoints.elbow,
      wrist: graspJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 100
    },
    // Step 3: Close gripper ONLY (no arm movement)
    { gripper: 0, _gripperOnly: true },
    // Step 4: Hold position with gripper closed (physics settle time)
    {
      base: graspJoints.base,
      shoulder: graspJoints.shoulder,
      elbow: graspJoints.elbow,
      wrist: graspJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 0
    },
    // Step 5: Lift HIGH
    {
      base: liftJoints.base,
      shoulder: liftJoints.shoulder,
      elbow: liftJoints.elbow,
      wrist: liftJoints.wrist,
      wristRoll: wristRollAngle,
      gripper: 0
    },
  ];

  log.debug('Pick up sequence:', sequence);

  return {
    action: 'sequence',
    joints: sequence,
    description: `Picking up "${objName}" using URDF-based IK.${reachabilityWarning}`,
    code: `// Pick up "${objName}" using URDF-based IK
await openGripper();
await moveJoints({ base: ${approachJoints.base.toFixed(1)}, shoulder: ${approachJoints.shoulder.toFixed(1)}, elbow: ${approachJoints.elbow.toFixed(1)}, wrist: ${approachJoints.wrist.toFixed(1)} }); // Approach
await moveJoints({ base: ${graspJoints.base.toFixed(1)}, shoulder: ${graspJoints.shoulder.toFixed(1)}, elbow: ${graspJoints.elbow.toFixed(1)}, wrist: ${graspJoints.wrist.toFixed(1)} }); // Grasp position
await closeGripper();
await moveJoints({ base: ${liftJoints.base.toFixed(1)}, shoulder: ${liftJoints.shoulder.toFixed(1)}, elbow: ${liftJoints.elbow.toFixed(1)}, wrist: ${liftJoints.wrist.toFixed(1)} }); // Lift`,
    pickupAttempt: {
      objectPosition: [objX, objY, objZ],
      objectType: objType,
      objectName: objName,
      objectScale: objScale,
      ikErrors: {
        approach: validatedApproachResult.error,
        grasp: validatedGraspResult.error,
        lift: validatedLiftResult.error,
      },
    },
  };
}
