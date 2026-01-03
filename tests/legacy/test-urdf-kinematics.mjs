/**
 * Test URDF-based kinematics
 * Verifies FK calculations match the actual URDF model
 * Run with: node test-urdf-kinematics.mjs
 */

// Import the kinematics module (we'll use dynamic import for ESM)
const runTests = async () => {
  // Since we can't directly import TypeScript, we'll implement the same logic here
  // This tests the algorithm before integrating into the app

  // URDF joint origins (copied from SO101KinematicsURDF.ts)
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
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
  }

  function createTranslationMatrix(x, y, z) {
    return [
      [1, 0, 0, x],
      [0, 1, 0, y],
      [0, 0, 1, z],
      [0, 0, 0, 1],
    ];
  }

  function createRotationMatrixX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      [1, 0, 0, 0],
      [0, c, -s, 0],
      [0, s, c, 0],
      [0, 0, 0, 1],
    ];
  }

  function createRotationMatrixY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      [c, 0, s, 0],
      [0, 1, 0, 0],
      [-s, 0, c, 0],
      [0, 0, 0, 1],
    ];
  }

  function createRotationMatrixZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
      [c, -s, 0, 0],
      [s, c, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
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

    const T1 = createJointTransform(
      URDF_JOINTS.shoulder_pan.xyz,
      URDF_JOINTS.shoulder_pan.rpy,
      baseRad
    );

    const T2 = createJointTransform(
      URDF_JOINTS.shoulder_lift.xyz,
      URDF_JOINTS.shoulder_lift.rpy,
      shoulderRad
    );

    const T3 = createJointTransform(
      URDF_JOINTS.elbow_flex.xyz,
      URDF_JOINTS.elbow_flex.rpy,
      elbowRad
    );

    const T4 = createJointTransform(
      URDF_JOINTS.wrist_flex.xyz,
      URDF_JOINTS.wrist_flex.rpy,
      wristRad
    );

    const T5 = createJointTransform(
      URDF_JOINTS.wrist_roll.xyz,
      URDF_JOINTS.wrist_roll.rpy,
      wristRollRad
    );

    const T6 = createJointTransform(
      URDF_JOINTS.gripper_frame.xyz,
      URDF_JOINTS.gripper_frame.rpy,
      0
    );

    let T = T1;
    T = multiplyMatrices(T, T2);
    T = multiplyMatrices(T, T3);
    T = multiplyMatrices(T, T4);
    T = multiplyMatrices(T, T5);
    T = multiplyMatrices(T, T6);

    const posURDF = getTranslation(T);

    // Convert URDF Z-up to Three.js Y-up (after -90° X rotation)
    return [
      posURDF[0],
      posURDF[2],   // Z -> Y
      -posURDF[1],  // -Y -> Z
    ];
  }

  // Test cases
  console.log('=== URDF Kinematics Test ===\n');

  const testCases = [
    { name: 'Home position (all zeros)', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Base +45°', joints: { base: 45, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Base -45°', joints: { base: -45, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Shoulder +30°', joints: { base: 0, shoulder: 30, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Shoulder -30°', joints: { base: 0, shoulder: -30, elbow: 0, wrist: 0, wristRoll: 0 } },
    { name: 'Elbow +45°', joints: { base: 0, shoulder: 0, elbow: 45, wrist: 0, wristRoll: 0 } },
    { name: 'Wrist +45°', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 45, wristRoll: 0 } },
    { name: 'Grasp position (known good)', joints: { base: 77, shoulder: 6, elbow: 36, wrist: 92, wristRoll: 0 } },
    { name: 'Forward reach', joints: { base: 0, shoulder: 30, elbow: 30, wrist: 30, wristRoll: 0 } },
    { name: 'Extended arm', joints: { base: 0, shoulder: 45, elbow: 45, wrist: 45, wristRoll: 0 } },
  ];

  console.log('Calculated gripper positions (Three.js Y-up coordinates):\n');

  for (const tc of testCases) {
    const pos = calculateGripperPositionURDF(tc.joints);
    console.log(`${tc.name}:`);
    console.log(`  Joints: base=${tc.joints.base}°, shoulder=${tc.joints.shoulder}°, elbow=${tc.joints.elbow}°, wrist=${tc.joints.wrist}°`);
    console.log(`  Position: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm`);
    console.log(`  Distance from origin: ${(Math.sqrt(pos[0]**2 + pos[1]**2 + pos[2]**2)*100).toFixed(1)}cm`);
    console.log('');
  }

  // Expected vs Actual comparison
  // The Playwright test showed these actual URDF positions:
  // Home: [39.1, 22.6, 0.0]cm
  // Right side (base=45, shoulder=20, elbow=40, wrist=50): [11.3, -4.8, 7.4]cm
  // Left side (base=-45, shoulder=20, elbow=40, wrist=50): [11.3, -4.8, -7.4]cm

  console.log('=== Comparison with Actual URDF Readings ===\n');

  const comparisonCases = [
    {
      name: 'Home position',
      joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 },
      expected: [39.1, 22.6, 0.0], // From Playwright test
    },
    {
      name: 'Right side config',
      joints: { base: 45, shoulder: 20, elbow: 40, wrist: 50, wristRoll: 0 },
      expected: [11.3, -4.8, 7.4], // From Playwright test
    },
    {
      name: 'Left side config',
      joints: { base: -45, shoulder: 20, elbow: 40, wrist: 50, wristRoll: 0 },
      expected: [11.3, -4.8, -7.4], // From Playwright test
    },
  ];

  for (const tc of comparisonCases) {
    const pos = calculateGripperPositionURDF(tc.joints);
    const posCm = [pos[0]*100, pos[1]*100, pos[2]*100];
    const diff = [
      posCm[0] - tc.expected[0],
      posCm[1] - tc.expected[1],
      posCm[2] - tc.expected[2],
    ];
    const totalError = Math.sqrt(diff[0]**2 + diff[1]**2 + diff[2]**2);

    console.log(`${tc.name}:`);
    console.log(`  Calculated: [${posCm[0].toFixed(1)}, ${posCm[1].toFixed(1)}, ${posCm[2].toFixed(1)}]cm`);
    console.log(`  Expected:   [${tc.expected[0].toFixed(1)}, ${tc.expected[1].toFixed(1)}, ${tc.expected[2].toFixed(1)}]cm`);
    console.log(`  Difference: [${diff[0].toFixed(1)}, ${diff[1].toFixed(1)}, ${diff[2].toFixed(1)}]cm`);
    console.log(`  Total error: ${totalError.toFixed(1)}cm ${totalError < 5 ? '✓' : '✗ LARGE ERROR'}`);
    console.log('');
  }

  console.log('=== Test Complete ===\n');

  // Now test the IK solver
  console.log('=== IK Solver Test ===\n');

  function solveIK(targetPos, maxIter = 500) {
    let joints = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 };
    let bestJoints = { ...joints };
    let bestError = Infinity;

    // Initial base angle to point towards target
    const baseAngle = Math.atan2(targetPos[2], targetPos[0]) * (180 / Math.PI);
    joints.base = Math.max(-110, Math.min(110, baseAngle));

    // Multi-pass optimization with decreasing step sizes
    const stepSizes = [5.0, 2.0, 1.0, 0.5, 0.2];

    for (const stepSize of stepSizes) {
      for (let iter = 0; iter < maxIter / stepSizes.length; iter++) {
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

        if (error < 0.003) break; // 3mm tolerance

        // Gradient descent on ALL joints including base
        const jointNames = ['base', 'shoulder', 'elbow', 'wrist'];

        for (const jn of jointNames) {
          const testPlus = { ...joints, [jn]: joints[jn] + stepSize };
          const testMinus = { ...joints, [jn]: joints[jn] - stepSize };

          if (jn === 'base') {
            testPlus.base = Math.max(-110, Math.min(110, testPlus.base));
            testMinus.base = Math.max(-110, Math.min(110, testMinus.base));
          }

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
            joints[jn] += stepSize;
            if (jn === 'base') joints.base = Math.max(-110, Math.min(110, joints.base));
          } else if (errorMinus < error) {
            joints[jn] -= stepSize;
            if (jn === 'base') joints.base = Math.max(-110, Math.min(110, joints.base));
          }
        }
      }
    }

    return { joints: bestJoints, error: bestError };
  }

  // Test IK for various target positions
  const ikTargets = [
    { name: 'Object at [12, 1.5, 5]cm', target: [0.12, 0.015, 0.05] },
    { name: 'Object at [-10, 1.5, 8]cm', target: [-0.10, 0.015, 0.08] },
    { name: 'Object at [5, 5, 9]cm (reference grasp)', target: [0.05, 0.05, 0.09] },
    { name: 'Object at [8, 1.5, -10]cm', target: [0.08, 0.015, -0.10] },
    { name: 'Object at [15, 3, 10]cm', target: [0.15, 0.03, 0.10] },
  ];

  for (const tc of ikTargets) {
    const result = solveIK(tc.target);
    const reachPos = calculateGripperPositionURDF(result.joints);

    console.log(`${tc.name}:`);
    console.log(`  Target:    [${(tc.target[0]*100).toFixed(1)}, ${(tc.target[1]*100).toFixed(1)}, ${(tc.target[2]*100).toFixed(1)}]cm`);
    console.log(`  Reached:   [${(reachPos[0]*100).toFixed(1)}, ${(reachPos[1]*100).toFixed(1)}, ${(reachPos[2]*100).toFixed(1)}]cm`);
    console.log(`  Error:     ${(result.error*100).toFixed(2)}cm ${result.error < 0.02 ? '✓' : result.error < 0.05 ? '~' : '✗'}`);
    console.log(`  Joints:    base=${result.joints.base.toFixed(1)}°, shoulder=${result.joints.shoulder.toFixed(1)}°, elbow=${result.joints.elbow.toFixed(1)}°, wrist=${result.joints.wrist.toFixed(1)}°`);
    console.log('');
  }

  console.log('=== IK Test Complete ===');
};

runTests().catch(console.error);
