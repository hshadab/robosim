/**
 * Test grab detection logic by manually setting gripper position
 * This bypasses URDF loading issues in headless mode
 * Run with: node test-grab-logic.mjs
 */

// Simulate the grab detection logic from useGripperInteraction.ts
const GRAB_DISTANCE_THRESHOLD = 0.08; // 8cm

function testGrabDetection(gripperPos, objects) {
  let closestObj = null;
  let closestDist = Infinity;

  for (const obj of objects) {
    if (obj.isGrabbable && !obj.isGrabbed) {
      const distToGripper = Math.sqrt(
        (obj.position[0] - gripperPos[0]) ** 2 +
        (obj.position[1] - gripperPos[1]) ** 2 +
        (obj.position[2] - gripperPos[2]) ** 2
      );

      console.log(`  Object "${obj.name}" at [${obj.position.map(p => (p*100).toFixed(1)).join(', ')}]cm, distance: ${(distToGripper*100).toFixed(1)}cm`);

      if (distToGripper < GRAB_DISTANCE_THRESHOLD && distToGripper < closestDist) {
        closestObj = obj;
        closestDist = distToGripper;
      }
    }
  }

  return { grabbed: closestObj, distance: closestDist };
}

// Test the base angle calculation
const BASE_ANGLE_OFFSET = 48;

function calculateEmpiricalBaseAngle(x, z) {
  const rawAngle = Math.atan2(x, z) * (180 / Math.PI);
  const correctedAngle = rawAngle + BASE_ANGLE_OFFSET;
  return Math.max(-110, Math.min(110, correctedAngle));
}

console.log('=== Test 1: Base Angle Calculation ===\n');

const testPositions = [
  { x: 0.05, z: 0.09, desc: 'Original calibration point [5, 9]cm' },
  { x: -0.07, z: 0.12, desc: 'Left side [-7, 12]cm' },
  { x: 0.12, z: 0.05, desc: 'Right side [12, 5]cm' },
  { x: -0.10, z: 0.08, desc: 'Left side [-10, 8]cm' },
];

for (const pos of testPositions) {
  const rawAngle = Math.atan2(pos.x, pos.z) * (180 / Math.PI);
  const baseAngle = calculateEmpiricalBaseAngle(pos.x, pos.z);
  console.log(`${pos.desc}:`);
  console.log(`  raw atan2 = ${rawAngle.toFixed(1)}°, corrected base = ${baseAngle.toFixed(1)}°\n`);
}

console.log('=== Test 2: Grab Detection ===\n');

// Simulate objects in the 'obstacles' environment
const objects = [
  { id: 'cube1', name: 'Red Cube', position: [0.12, 0.015, 0.05], isGrabbable: true, isGrabbed: false },
  { id: 'cube2', name: 'Blue Cube', position: [-0.10, 0.015, 0.08], isGrabbable: true, isGrabbed: false },
  { id: 'ball1', name: 'Green Ball', position: [0.08, 0.015, -0.10], isGrabbable: true, isGrabbed: false },
];

// Test case 1: Gripper near red cube
console.log('Test 2a: Gripper at [12, 5, 5]cm (near red cube):');
let result = testGrabDetection([0.12, 0.05, 0.05], objects);
console.log(`  Result: ${result.grabbed ? `GRABBED "${result.grabbed.name}" at ${(result.distance*100).toFixed(1)}cm` : 'Nothing grabbed'}\n`);

// Test case 2: Gripper near blue cube
console.log('Test 2b: Gripper at [-10, 5, 8]cm (near blue cube):');
result = testGrabDetection([-0.10, 0.05, 0.08], objects);
console.log(`  Result: ${result.grabbed ? `GRABBED "${result.grabbed.name}" at ${(result.distance*100).toFixed(1)}cm` : 'Nothing grabbed'}\n`);

// Test case 3: Gripper too far from any object
console.log('Test 2c: Gripper at [0, 20, 0]cm (too far from objects):');
result = testGrabDetection([0, 0.20, 0], objects);
console.log(`  Result: ${result.grabbed ? `GRABBED "${result.grabbed.name}" at ${(result.distance*100).toFixed(1)}cm` : 'Nothing grabbed'}\n`);

// Test case 4: Gripper exactly at object position
console.log('Test 2d: Gripper exactly at red cube position [12, 1.5, 5]cm:');
result = testGrabDetection([0.12, 0.015, 0.05], objects);
console.log(`  Result: ${result.grabbed ? `GRABBED "${result.grabbed.name}" at ${(result.distance*100).toFixed(1)}cm` : 'Nothing grabbed'}\n`);

console.log('=== Test 3: Object Follow Gripper ===\n');

// Simulate grabbed object following gripper
const grabbedOffset = [0.01, 0.02, 0.01]; // Small offset from when grabbed
const gripperPositions = [
  [0.12, 0.05, 0.05],
  [0.15, 0.10, 0.05],
  [0.10, 0.15, 0.08],
  [0.05, 0.20, 0.10],
];

console.log('Simulating object following gripper (with offset [1, 2, 1]cm):');
for (const gp of gripperPositions) {
  const objPos = [
    gp[0] + grabbedOffset[0],
    Math.max(gp[1] + grabbedOffset[1], 0.03),
    gp[2] + grabbedOffset[2],
  ];
  console.log(`  Gripper: [${gp.map(p => (p*100).toFixed(1)).join(', ')}]cm -> Object: [${objPos.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
}

console.log('\n=== All Tests Complete ===');
