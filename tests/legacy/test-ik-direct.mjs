/**
 * Direct test of IK calculations using the same logic as claudeApi.ts
 * This bypasses the browser to verify the IK math is correct
 */

// Copy the URDF joints data
const URDF_JOINTS = {
  shoulder_pan: {
    xyz: [0.0388353, 0, 0.0624],
    rpy: [Math.PI, 0, -Math.PI],
  },
  shoulder_lift: {
    xyz: [-0.0303992, -0.0182778, -0.0542],
    rpy: [-Math.PI/2, -Math.PI/2, 0],
  },
  elbow_flex: {
    xyz: [-0.11257, -0.028, 0],
    rpy: [0, 0, Math.PI/2],
  },
  wrist_flex: {
    xyz: [-0.1349, 0.0052, 0],
    rpy: [0, 0, -Math.PI/2],
  },
  wrist_roll: {
    xyz: [0, -0.0611, 0.0181],
    rpy: [Math.PI/2, 0.0486795, Math.PI],
  },
  gripper_frame: {
    xyz: [-0.0079, -0.000218121, -0.0981274],
    rpy: [0, Math.PI, 0],
  },
};

// Matrix utilities
function createIdentityMatrix() {
  return [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
}

function createTranslationMatrix(x, y, z) {
  return [[1,0,0,x],[0,1,0,y],[0,0,1,z],[0,0,0,1]];
}

function createRotationMatrixX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[1,0,0,0],[0,c,-s,0],[0,s,c,0],[0,0,0,1]];
}

function createRotationMatrixY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]];
}

function createRotationMatrixZ(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [[c,-s,0,0],[s,c,0,0],[0,0,1,0],[0,0,0,1]];
}

function createRPYMatrix(roll, pitch, yaw) {
  const Rz = createRotationMatrixZ(yaw);
  const Ry = createRotationMatrixY(pitch);
  const Rx = createRotationMatrixX(roll);
  return multiplyMatrices(multiplyMatrices(Rz, Ry), Rx);
}

function multiplyMatrices(a, b) {
  const result = createIdentityMatrix();
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

function getTranslation(matrix) {
  return [matrix[0][3], matrix[1][3], matrix[2][3]];
}

function createJointTransform(xyz, rpy, jointAngle = 0) {
  const T = createTranslationMatrix(xyz[0], xyz[1], xyz[2]);
  const R = createRPYMatrix(rpy[0], rpy[1], rpy[2]);
  const origin = multiplyMatrices(T, R);
  const jointRot = createRotationMatrixZ(jointAngle);
  return multiplyMatrices(origin, jointRot);
}

function calculateGripperPositionURDF(joints) {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;
  const wristRollRad = (joints.wristRoll * Math.PI) / 180;

  const T1 = createJointTransform(URDF_JOINTS.shoulder_pan.xyz, URDF_JOINTS.shoulder_pan.rpy, baseRad);
  const T2 = createJointTransform(URDF_JOINTS.shoulder_lift.xyz, URDF_JOINTS.shoulder_lift.rpy, shoulderRad);
  const T3 = createJointTransform(URDF_JOINTS.elbow_flex.xyz, URDF_JOINTS.elbow_flex.rpy, elbowRad);
  const T4 = createJointTransform(URDF_JOINTS.wrist_flex.xyz, URDF_JOINTS.wrist_flex.rpy, wristRad);
  const T5 = createJointTransform(URDF_JOINTS.wrist_roll.xyz, URDF_JOINTS.wrist_roll.rpy, wristRollRad);
  const T6 = createJointTransform(URDF_JOINTS.gripper_frame.xyz, URDF_JOINTS.gripper_frame.rpy, 0);

  let T = T1;
  T = multiplyMatrices(T, T2);
  T = multiplyMatrices(T, T3);
  T = multiplyMatrices(T, T4);
  T = multiplyMatrices(T, T5);
  T = multiplyMatrices(T, T6);

  const posURDF = getTranslation(T);
  return [posURDF[0], posURDF[2], -posURDF[1]]; // Convert URDF Z-up to Three.js Y-up
}

// Joint limits
const JOINT_LIMITS = {
  base: { min: -110, max: 110 },
  shoulder: { min: -100, max: 100 },
  elbow: { min: -97, max: 97 },
  wrist: { min: -95, max: 95 },
  wristRoll: { min: -157, max: 163 },
};

function clampJoint(jointName, value) {
  const limits = JOINT_LIMITS[jointName];
  return Math.max(limits.min, Math.min(limits.max, value));
}

// IK solver - improved with more starting configs and iterations
function solveIKForTarget(targetPos, maxIter = 1000, fixedBaseAngle) {
  let bestJoints = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
  let bestError = Infinity;

  // FIXED: atan2(z, x) for correct base angle (was atan2(x, z))
  const baseAngle = fixedBaseAngle !== undefined
    ? clampJoint('base', fixedBaseAngle)
    : clampJoint('base', Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI));

  const optimizeBase = fixedBaseAngle === undefined;

  // Starting configs based on REAL SO-101 dataset - more configs at higher elbow angles
  const startConfigs = [
    { base: baseAngle, shoulder: -99, elbow: 97, wrist: 75, wristRoll: 0 },   // Real grasp pose (at joint limits)
    { base: baseAngle, shoulder: -95, elbow: 95, wrist: 75, wristRoll: 0 },   // Near grasp pose
    { base: baseAngle, shoulder: -90, elbow: 90, wrist: 75, wristRoll: 0 },   // Good grasp pose
    { base: baseAngle, shoulder: -86, elbow: 73, wrist: 75, wristRoll: 0 },   // Real reach pose
    { base: baseAngle, shoulder: -80, elbow: 80, wrist: 70, wristRoll: 0 },   // Variant
    { base: baseAngle, shoulder: -75, elbow: 75, wrist: 65, wristRoll: 0 },   // Medium bent
    { base: baseAngle, shoulder: -70, elbow: 70, wrist: 60, wristRoll: 0 },   // Less bent
    { base: baseAngle, shoulder: -60, elbow: 60, wrist: 50, wristRoll: 0 },   // Even less bent
  ];

  for (const startConfig of startConfigs) {
    let joints = { ...startConfig };
    // More step sizes for finer control
    const stepSizes = [10.0, 5.0, 2.0, 1.0, 0.5, 0.25, 0.1];

    for (const stepSize of stepSizes) {
      // More iterations per step size
      for (let iter = 0; iter < 30; iter++) {
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

        if (error < 0.002) break; // Tighter tolerance

        const jointNames = optimizeBase ? ['base', 'shoulder', 'elbow', 'wrist'] : ['shoulder', 'elbow', 'wrist'];

        for (const jn of jointNames) {
          const testPlus = { ...joints, [jn]: clampJoint(jn, joints[jn] + stepSize) };
          const testMinus = { ...joints, [jn]: clampJoint(jn, joints[jn] - stepSize) };

          const posPlus = calculateGripperPositionURDF(testPlus);
          const posMinus = calculateGripperPositionURDF(testMinus);

          const errorPlus = Math.sqrt(
            (posPlus[0] - targetPos[0]) ** 2 +
            (posPlus[1] - targetPos[1]) ** 2 +
            (posPlus[2] - targetPos[2]) ** 2
          );
          const errorMinus = Math.sqrt(
            (posMinus[0] - targetPos[0]) ** 2 +
            (posMinus[1] - targetPos[1]) ** 2 +
            (posMinus[2] - targetPos[2]) ** 2
          );

          if (errorPlus < error && errorPlus <= errorMinus) {
            joints[jn] = clampJoint(jn, joints[jn] + stepSize);
          } else if (errorMinus < error) {
            joints[jn] = clampJoint(jn, joints[jn] - stepSize);
          }
        }
      }
    }
  }

  return { joints: bestJoints, error: bestError };
}

// Test
console.log('=== Testing IK with Real SO-101 Dataset-Informed Starting Positions ===\n');

// First, let's understand the coordinate system by testing base rotation
console.log('=== COORDINATE SYSTEM TEST ===');
console.log('Testing where gripper goes with different base angles:\n');

const testPose = { shoulder: -80, elbow: 70, wrist: 70, wristRoll: 0 };
for (const base of [0, 45, 90, -45, -90]) {
  const pos = calculateGripperPositionURDF({ base, ...testPose });
  console.log(`  Base=${base}°: gripper at [X=${(pos[0]*100).toFixed(1)}, Y=${(pos[1]*100).toFixed(1)}, Z=${(pos[2]*100).toFixed(1)}]cm`);
}

console.log('\n=== CONCLUSION ===');
console.log('Base=0 points toward +X, Base=90 points toward +Z, Base=-90 points toward -Z\n');

// First, let's see what the real dataset positions look like
console.log('Real SO-101 dataset reference poses:');
const realGrasp = { base: 2, shoulder: -99, elbow: 99, wrist: 75, wristRoll: -51 };
const realReach = { base: 8.75, shoulder: -86, elbow: 73, wrist: 75, wristRoll: -48 };

const graspPos = calculateGripperPositionURDF(realGrasp);
const reachPos = calculateGripperPositionURDF(realReach);

console.log(`  Grasp pose (shoulder=-99, elbow=99, wrist=75):`);
console.log(`    Gripper position: [${graspPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
console.log(`  Reach pose (shoulder=-86, elbow=73, wrist=75):`);
console.log(`    Gripper position: [${reachPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

console.log('\n--- Testing IK for typical object positions ---\n');

const GRIP_CENTER_OFFSET = 0.045;

// Test cases - objects at various positions
const testCases = [
  // Positions in the arm's natural workspace (+X direction, Z near 0)
  { name: 'Reachable: X=10cm, Z=3cm (in workspace)', objPos: [0.10, 0.05, 0.03] },
  { name: 'Reachable: X=12cm, Z=0cm (directly in front)', objPos: [0.12, 0.05, 0.0] },
  { name: 'Reachable: X=8cm, Z=5cm', objPos: [0.08, 0.05, 0.05] },
  // Positions that require base rotation
  { name: 'Object at Z=10cm (near)', objPos: [0, 0.05, 0.10] },
  { name: 'Object at Z=12cm', objPos: [-0.033, 0.05, 0.12] },
  // Positions near/at workspace limits
  { name: 'Screenshot case: X=-9cm, Z=9cm (near limit)', objPos: [-0.09, 0.05, 0.09] },
  { name: 'Object at Z=15cm (far)', objPos: [0, 0.05, 0.15] },
];

for (const tc of testCases) {
  console.log(`${tc.name}:`);
  console.log(`  Object position: [${tc.objPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

  // Calculate base angle (atan2(z, x) - base=0 points +X, base=90 points +Z)
  const baseAngle = clampJoint('base', Math.atan2(tc.objPos[2], tc.objPos[0]) * (180 / Math.PI));
  console.log(`  Base angle: ${baseAngle.toFixed(1)}°`);

  // Calculate grasp target (tip below object so grip center at object)
  const graspTargetY = Math.max(0.02, tc.objPos[1] - GRIP_CENTER_OFFSET);
  const graspTarget = [tc.objPos[0], graspTargetY, tc.objPos[2]];
  console.log(`  Grasp target (tip): [${graspTarget.map(p => (p*100).toFixed(1)).join(', ')}]cm`);

  // Solve IK
  const result = solveIKForTarget(graspTarget, 500, baseAngle);

  console.log(`  IK Result: base=${result.joints.base.toFixed(1)}°, shoulder=${result.joints.shoulder.toFixed(1)}°, elbow=${result.joints.elbow.toFixed(1)}°, wrist=${result.joints.wrist.toFixed(1)}°`);
  console.log(`  IK Error: ${(result.error * 100).toFixed(2)}cm`);

  // Verify position
  const achievedPos = calculateGripperPositionURDF(result.joints);
  console.log(`  Achieved tip: [${achievedPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  console.log(`  Grip center: [${achievedPos[0]*100}, ${(achievedPos[1] + GRIP_CENTER_OFFSET)*100}, ${achievedPos[2]*100}]cm`);

  // Check if grip center is at object
  const gripCenterY = achievedPos[1] + GRIP_CENTER_OFFSET;
  const yError = Math.abs(gripCenterY - tc.objPos[1]) * 100;
  const xzError = Math.sqrt((achievedPos[0] - tc.objPos[0])**2 + (achievedPos[2] - tc.objPos[2])**2) * 100;
  console.log(`  Grip center vs object: Y error=${yError.toFixed(1)}cm, XZ error=${xzError.toFixed(1)}cm`);
  console.log(`  ${yError < 2 && xzError < 2 ? '✓ GOOD' : '✗ NEEDS WORK'}`);
  console.log('');
}

console.log('=== Test Complete ===');
