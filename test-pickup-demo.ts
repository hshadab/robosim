/**
 * Test script to demonstrate robot arm pickup functionality
 * Tests the inverse kinematics and pickup sequence logic
 */

// Import the kinematics functions directly
import {
  calculateSO101GripperPosition,
  calculateInverseKinematics,
  isPositionReachable,
  getWorkspaceBounds
} from './src/components/simulation/SO101Kinematics';

import type { JointState } from './src/types';

// Simulate the pickup logic from claudeApi.ts
function simulatePickup(objectName: string, objectPosition: [number, number, number]) {
  const [objX, objY, objZ] = objectPosition;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 PICKUP TEST: "${objectName}"`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Object position: [${objX.toFixed(3)}, ${objY.toFixed(3)}, ${objZ.toFixed(3)}]`);
  console.log(`Distance from robot: ${Math.sqrt(objX*objX + objZ*objZ).toFixed(3)}m`);

  // Check if position is reachable
  if (!isPositionReachable(objX, objY, objZ)) {
    console.log('❌ Position is NOT reachable by the robot arm!');
    return null;
  }
  console.log('✅ Position is within reach');

  // Default joints for IK
  const defaultJoints: JointState = {
    base: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    wristRoll: 0,
    gripper: 100,
  };

  // Calculate base angle
  const baseAngle = Math.atan2(objX, objZ) * (180 / Math.PI);
  console.log(`\n📐 Base rotation needed: ${baseAngle.toFixed(1)}°`);

  // Calculate IK for grasp position
  console.log('\n🔧 Calculating Inverse Kinematics for grasp...');
  const graspIK = calculateInverseKinematics(objX, objY, objZ, defaultJoints);

  if (!graspIK) {
    console.log('❌ IK failed to find solution for grasp position');
    return null;
  }

  console.log('✅ IK Solution found:');
  console.log(`   Base:     ${graspIK.base.toFixed(1)}°`);
  console.log(`   Shoulder: ${graspIK.shoulder.toFixed(1)}°`);
  console.log(`   Elbow:    ${graspIK.elbow.toFixed(1)}°`);
  console.log(`   Wrist:    ${graspIK.wrist.toFixed(1)}°`);

  // Verify with forward kinematics
  const graspPos = calculateSO101GripperPosition(graspIK);
  const graspError = Math.sqrt(
    (graspPos[0] - objX) ** 2 +
    (graspPos[1] - objY) ** 2 +
    (graspPos[2] - objZ) ** 2
  );
  console.log(`\n📍 Gripper position: [${graspPos[0].toFixed(3)}, ${graspPos[1].toFixed(3)}, ${graspPos[2].toFixed(3)}]`);
  console.log(`   Error: ${(graspError * 1000).toFixed(1)}mm`);

  // Calculate approach position (above object)
  const approachY = objY + 0.10;
  console.log('\n🔧 Calculating IK for approach (10cm above)...');
  const approachIK = calculateInverseKinematics(objX, approachY, objZ, defaultJoints);

  if (approachIK) {
    console.log('✅ Approach IK found:');
    console.log(`   Shoulder: ${approachIK.shoulder.toFixed(1)}° Elbow: ${approachIK.elbow.toFixed(1)}°`);
    const approachPos = calculateSO101GripperPosition(approachIK);
    console.log(`   Position: [${approachPos[0].toFixed(3)}, ${approachPos[1].toFixed(3)}, ${approachPos[2].toFixed(3)}]`);
  }

  // Calculate lift position (above object after grab)
  const liftY = objY + 0.15;
  console.log('\n🔧 Calculating IK for lift (15cm above)...');
  const liftIK = calculateInverseKinematics(objX, liftY, objZ, defaultJoints);

  if (liftIK) {
    console.log('✅ Lift IK found:');
    console.log(`   Shoulder: ${liftIK.shoulder.toFixed(1)}° Elbow: ${liftIK.elbow.toFixed(1)}°`);
    const liftPos = calculateSO101GripperPosition(liftIK);
    console.log(`   Position: [${liftPos[0].toFixed(3)}, ${liftPos[1].toFixed(3)}, ${liftPos[2].toFixed(3)}]`);
  }

  // Generate the pickup sequence
  console.log('\n📋 PICKUP SEQUENCE:');
  const sequence = [];

  // Step 1: Open gripper
  sequence.push({ step: 1, action: 'Open gripper', joints: { gripper: 100 } });

  // Step 2: Rotate base to face object
  sequence.push({ step: 2, action: 'Rotate to face object', joints: { base: baseAngle } });

  // Step 3: Move to approach position
  if (approachIK) {
    sequence.push({
      step: 3,
      action: 'Move to approach position',
      joints: { base: approachIK.base, shoulder: approachIK.shoulder, elbow: approachIK.elbow, wrist: approachIK.wrist }
    });
  }

  // Step 4: Lower to grasp position
  sequence.push({
    step: 4,
    action: 'Lower to grasp position',
    joints: { base: graspIK.base, shoulder: graspIK.shoulder, elbow: graspIK.elbow, wrist: graspIK.wrist }
  });

  // Step 5: Close gripper
  sequence.push({ step: 5, action: 'Close gripper (grab object)', joints: { gripper: 0 } });

  // Step 6: Lift up
  if (liftIK) {
    sequence.push({
      step: 6,
      action: 'Lift object',
      joints: { base: liftIK.base, shoulder: liftIK.shoulder, elbow: liftIK.elbow, wrist: liftIK.wrist, gripper: 0 }
    });
  }

  sequence.forEach(s => {
    console.log(`\n   Step ${s.step}: ${s.action}`);
    console.log(`   Joints: ${JSON.stringify(s.joints)}`);
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ PICKUP SEQUENCE GENERATED SUCCESSFULLY!');
  console.log(`${'='.repeat(60)}\n`);

  return sequence;
}

// Main test function
async function main() {
  console.log('\n🤖 ROBOT ARM PICKUP FUNCTIONALITY TEST');
  console.log('Testing inverse kinematics and pickup sequence generation\n');

  // Get workspace bounds
  const bounds = getWorkspaceBounds();
  console.log('📦 Workspace bounds:');
  console.log(`   X: [${bounds.minX.toFixed(3)}, ${bounds.maxX.toFixed(3)}]`);
  console.log(`   Y: [${bounds.minY.toFixed(3)}, ${bounds.maxY.toFixed(3)}]`);
  console.log(`   Z: [${bounds.minZ.toFixed(3)}, ${bounds.maxZ.toFixed(3)}]`);
  console.log(`   Max reach: ${bounds.maxReach.toFixed(3)}m`);

  // Test 1: Tennis ball in front of robot
  simulatePickup('Tennis Ball', [0, 0.05, 0.25]);

  // Test 2: Red cube to the left
  simulatePickup('Red Cube', [0.15, 0.05, 0.20]);

  // Test 3: Blue ball to the right
  simulatePickup('Blue Ball', [-0.10, 0.03, 0.22]);

  // Test 4: Object directly in front at table height
  simulatePickup('Yellow Cylinder', [0, 0.04, 0.30]);

  // Test forward kinematics at key positions
  console.log('\n🔍 FORWARD KINEMATICS VERIFICATION:');
  const testPoses: { name: string; joints: JointState }[] = [
    { name: 'Home', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Extended', joints: { base: 0, shoulder: 45, elbow: -30, wrist: 0, wristRoll: 0, gripper: 50 } },
    { name: 'Lowered', joints: { base: 0, shoulder: 30, elbow: -60, wrist: -30, wristRoll: 0, gripper: 50 } },
    { name: 'Rotated Left', joints: { base: 45, shoulder: 45, elbow: -45, wrist: 0, wristRoll: 0, gripper: 50 } },
  ];

  testPoses.forEach(pose => {
    const pos = calculateSO101GripperPosition(pose.joints);
    console.log(`   ${pose.name.padEnd(15)}: [${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)}]`);
  });

  console.log('\n✨ All tests completed!\n');
}

main().catch(console.error);
