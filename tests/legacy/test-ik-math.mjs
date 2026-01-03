/**
 * Direct test of IK/FK math - no browser needed
 * Run with: node test-ik-math.mjs
 */

// SO-101 dimensions from the codebase
const SO101_DIMS = {
  baseHeight: 0.025,
  baseRadius: 0.045,
  link1Height: 0.0624,
  link2Length: 0.0542,
  link3Length: 0.11257,
  link4Length: 0.1349,
  link5Length: 0.0611,
  gripperLength: 0.098,
  shoulderOffset: 0.0388,
  shoulderLiftOffset: 0.0304,
};

const SO101_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
};

// Forward Kinematics - compute gripper position from joint angles
function forwardKinematics(joints) {
  const dims = SO101_DIMS;
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  const shoulderHeight = dims.baseHeight + dims.link1Height + dims.link2Length;

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

  const forwardDist = dims.shoulderOffset + gripperLocal;

  const x = forwardDist * Math.sin(baseRad);
  const z = forwardDist * Math.cos(baseRad);
  const y = shoulderHeight + gripperUp;

  return { x, y, z };
}

// Simple IK solver (same as in codebase)
function inverseKinematics(targetX, targetY, targetZ) {
  const baseAngle = Math.atan2(targetX, targetZ) * (180 / Math.PI);

  if (baseAngle < SO101_LIMITS.base.min || baseAngle > SO101_LIMITS.base.max) {
    return null;
  }

  let bestSolution = null;
  let bestError = Infinity;

  // Coarse grid search - 3° step
  for (let shoulder = SO101_LIMITS.shoulder.min; shoulder <= SO101_LIMITS.shoulder.max; shoulder += 3) {
    for (let elbow = SO101_LIMITS.elbow.min; elbow <= SO101_LIMITS.elbow.max; elbow += 3) {
      for (let wrist = SO101_LIMITS.wrist.min; wrist <= SO101_LIMITS.wrist.max; wrist += 5) {
        const pos = forwardKinematics({ base: baseAngle, shoulder, elbow, wrist });
        const error = Math.sqrt(
          (pos.x - targetX) ** 2 +
          (pos.y - targetY) ** 2 +
          (pos.z - targetZ) ** 2
        );
        if (error < bestError) {
          bestError = error;
          bestSolution = { base: baseAngle, shoulder, elbow, wrist };
        }
      }
    }
  }

  // Refine search
  if (bestSolution && bestError < 0.08) {
    const refineRange = 8;
    for (let ds = -refineRange; ds <= refineRange; ds++) {
      for (let de = -refineRange; de <= refineRange; de++) {
        for (let dw = -refineRange; dw <= refineRange; dw++) {
          const shoulder = Math.max(SO101_LIMITS.shoulder.min, Math.min(SO101_LIMITS.shoulder.max, bestSolution.shoulder + ds));
          const elbow = Math.max(SO101_LIMITS.elbow.min, Math.min(SO101_LIMITS.elbow.max, bestSolution.elbow + de));
          const wrist = Math.max(SO101_LIMITS.wrist.min, Math.min(SO101_LIMITS.wrist.max, bestSolution.wrist + dw));

          const pos = forwardKinematics({ base: baseAngle, shoulder, elbow, wrist });
          const error = Math.sqrt(
            (pos.x - targetX) ** 2 +
            (pos.y - targetY) ** 2 +
            (pos.z - targetZ) ** 2
          );
          if (error < bestError) {
            bestError = error;
            bestSolution = { base: baseAngle, shoulder, elbow, wrist };
          }
        }
      }
    }
  }

  return bestSolution && bestError < 0.05 ? { ...bestSolution, error: bestError } : null;
}

// Test cases
console.log("=== IK/FK Math Test ===\n");

// Test 1: Known good position from screenshot (grip.png)
// Red Block at [5, 5, 9]cm = [0.05, 0.05, 0.09]m
// Known good joints: Base: 77°, Shoulder: 6°, Elbow: 36°, Wrist: 92°
console.log("Test 1: Verify known-good grasp position");
const knownGoodJoints = { base: 77, shoulder: 6, elbow: 36, wrist: 92 };
const fkResult1 = forwardKinematics(knownGoodJoints);
console.log(`  Input joints: base=${knownGoodJoints.base}°, shoulder=${knownGoodJoints.shoulder}°, elbow=${knownGoodJoints.elbow}°, wrist=${knownGoodJoints.wrist}°`);
console.log(`  FK result: x=${(fkResult1.x * 100).toFixed(2)}cm, y=${(fkResult1.y * 100).toFixed(2)}cm, z=${(fkResult1.z * 100).toFixed(2)}cm`);
console.log(`  Expected:  x=5.00cm, y=5.00cm, z=9.00cm`);
const error1 = Math.sqrt((fkResult1.x - 0.05)**2 + (fkResult1.y - 0.05)**2 + (fkResult1.z - 0.09)**2);
console.log(`  Error: ${(error1 * 100).toFixed(2)}cm`);
console.log(`  Status: ${error1 < 0.05 ? "PASS" : "FAIL"}\n`);

// Test 2: IK for red block at [5, 5, 9]cm
console.log("Test 2: IK solver for [5, 5, 9]cm");
const ikResult1 = inverseKinematics(0.05, 0.05, 0.09);
if (ikResult1) {
  console.log(`  IK result: base=${ikResult1.base.toFixed(1)}°, shoulder=${ikResult1.shoulder}°, elbow=${ikResult1.elbow}°, wrist=${ikResult1.wrist}°`);
  console.log(`  IK error: ${(ikResult1.error * 100).toFixed(2)}cm`);
  const fkVerify = forwardKinematics(ikResult1);
  console.log(`  FK verify: x=${(fkVerify.x * 100).toFixed(2)}cm, y=${(fkVerify.y * 100).toFixed(2)}cm, z=${(fkVerify.z * 100).toFixed(2)}cm`);
} else {
  console.log(`  IK FAILED - no solution found`);
}
console.log();

// Test 3: IK for red block at [-5, 5, 9]cm (grip2.png position)
console.log("Test 3: IK solver for [-5, 5, 9]cm (grip2.png)");
const ikResult2 = inverseKinematics(-0.05, 0.05, 0.09);
if (ikResult2) {
  console.log(`  IK result: base=${ikResult2.base.toFixed(1)}°, shoulder=${ikResult2.shoulder}°, elbow=${ikResult2.elbow}°, wrist=${ikResult2.wrist}°`);
  console.log(`  IK error: ${(ikResult2.error * 100).toFixed(2)}cm`);
  const fkVerify = forwardKinematics(ikResult2);
  console.log(`  FK verify: x=${(fkVerify.x * 100).toFixed(2)}cm, y=${(fkVerify.y * 100).toFixed(2)}cm, z=${(fkVerify.z * 100).toFixed(2)}cm`);
} else {
  console.log(`  IK FAILED - no solution found`);
}
console.log();

// Test 4: What does the BAD position from grip2.png compute to?
console.log("Test 4: Verify BAD position from grip2.png");
const badJoints = { base: -28, shoulder: 5, elbow: 82, wrist: 68 };
const fkResultBad = forwardKinematics(badJoints);
console.log(`  Input joints: base=${badJoints.base}°, shoulder=${badJoints.shoulder}°, elbow=${badJoints.elbow}°, wrist=${badJoints.wrist}°`);
console.log(`  FK result: x=${(fkResultBad.x * 100).toFixed(2)}cm, y=${(fkResultBad.y * 100).toFixed(2)}cm, z=${(fkResultBad.z * 100).toFixed(2)}cm`);
console.log(`  Target:    x=-5.00cm, y=5.00cm, z=9.00cm`);
const errorBad = Math.sqrt((fkResultBad.x - (-0.05))**2 + (fkResultBad.y - 0.05)**2 + (fkResultBad.z - 0.09)**2);
console.log(`  Error from target: ${(errorBad * 100).toFixed(2)}cm`);
console.log();

// Test 5: Grid search to find what angles WOULD reach [-5, 5, 9]cm
console.log("Test 5: Exhaustive search for angles that reach [-5, 5, 9]cm");
const target = { x: -0.05, y: 0.05, z: 0.09 };
let bestFound = null;
let bestFoundError = Infinity;

for (let base = -110; base <= 110; base += 5) {
  for (let shoulder = -100; shoulder <= 100; shoulder += 5) {
    for (let elbow = -97; elbow <= 97; elbow += 5) {
      for (let wrist = -95; wrist <= 95; wrist += 10) {
        const pos = forwardKinematics({ base, shoulder, elbow, wrist });
        const error = Math.sqrt(
          (pos.x - target.x) ** 2 +
          (pos.y - target.y) ** 2 +
          (pos.z - target.z) ** 2
        );
        if (error < bestFoundError) {
          bestFoundError = error;
          bestFound = { base, shoulder, elbow, wrist };
        }
      }
    }
  }
}

if (bestFound) {
  console.log(`  Best angles found: base=${bestFound.base}°, shoulder=${bestFound.shoulder}°, elbow=${bestFound.elbow}°, wrist=${bestFound.wrist}°`);
  console.log(`  Error: ${(bestFoundError * 100).toFixed(2)}cm`);
  const fkBest = forwardKinematics(bestFound);
  console.log(`  FK verify: x=${(fkBest.x * 100).toFixed(2)}cm, y=${(fkBest.y * 100).toFixed(2)}cm, z=${(fkBest.z * 100).toFixed(2)}cm`);
}

console.log("\n=== Test Complete ===");
