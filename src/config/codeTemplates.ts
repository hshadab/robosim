/**
 * Pre-built code templates for common robotics tasks
 */

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'intermediate' | 'advanced';
  code: string;
}

export const CODE_TEMPLATES: CodeTemplate[] = [
  // Basic Templates
  {
    id: 'hello-world',
    name: 'Hello World',
    description: 'Simple program that moves and prints a message',
    category: 'basic',
    code: `// Hello World - Your first robot program!

print("Hello from RoboSim!");

// Move to home position
await goHome();
print("Robot is at home position");

// Wave hello
await moveJoint('shoulder', 40);
await moveJoint('wrist', 30);
await wait(500);
await moveJoint('wrist', -30);
await wait(500);

await goHome();
print("Done!");
`,
  },
  {
    id: 'joint-explorer',
    name: 'Joint Explorer',
    description: 'Test each joint movement individually',
    category: 'basic',
    code: `// Joint Explorer - Test each joint

print("Testing all joints...");

// Test base rotation
print("Testing base rotation...");
await moveJoint('base', 45);
await wait(500);
await moveJoint('base', -45);
await wait(500);
await moveJoint('base', 0);

// Test shoulder
print("Testing shoulder...");
await moveJoint('shoulder', 45);
await wait(500);
await moveJoint('shoulder', -30);
await wait(500);
await moveJoint('shoulder', 0);

// Test elbow
print("Testing elbow...");
await moveJoint('elbow', -90);
await wait(500);
await moveJoint('elbow', 0);

// Test wrist
print("Testing wrist...");
await moveJoint('wrist', 45);
await wait(500);
await moveJoint('wrist', -45);
await wait(500);
await moveJoint('wrist', 0);

// Test gripper
print("Testing gripper...");
await openGripper();
await wait(500);
await closeGripper();
await wait(500);
await setGripper(50);

print("All joints tested!");
`,
  },
  {
    id: 'sensor-reader',
    name: 'Sensor Reader',
    description: 'Read and display all sensor values',
    category: 'basic',
    code: `// Sensor Reader - Display all sensor values

print("=== Sensor Readings ===");

// Read ultrasonic
const distance = readUltrasonic();
print("Ultrasonic distance:", distance, "cm");

// Read IR sensors
const ir = readAllIR();
print("IR Left:", ir.left);
print("IR Center:", ir.center);
print("IR Right:", ir.right);

// Read battery
const battery = getBattery();
print("Battery level:", battery, "%");

// Read joint positions
const joints = getAllJoints();
print("\\n=== Joint Positions ===");
print("Base:", joints.base, "degrees");
print("Shoulder:", joints.shoulder, "degrees");
print("Elbow:", joints.elbow, "degrees");
print("Wrist:", joints.wrist, "degrees");
print("Gripper:", joints.gripper, "%");

print("\\nSensor reading complete!");
`,
  },

  // Intermediate Templates
  {
    id: 'pick-and-place',
    name: 'Pick and Place',
    description: 'Pick up an object and place it elsewhere',
    category: 'intermediate',
    code: `// Pick and Place - Basic object manipulation

print("Starting pick and place sequence...");

// Move to home first
await goHome();

// Open gripper
print("Opening gripper...");
await openGripper();

// Move down to object
print("Reaching for object...");
await moveJoints({ shoulder: -25, elbow: -110 });
await wait(300);

// Close gripper to grab
print("Grabbing object...");
await closeGripper();
await wait(300);

// Lift object
print("Lifting object...");
await moveJoints({ shoulder: 30, elbow: -30 });
await wait(300);

// Rotate to new position
print("Moving to target...");
await moveJoint('base', 90);
await wait(300);

// Lower to place
print("Placing object...");
await moveJoints({ shoulder: -20, elbow: -100 });
await wait(300);

// Release
print("Releasing object...");
await openGripper();
await wait(300);

// Return home
print("Returning to home...");
await goHome();

print("Pick and place complete!");
`,
  },
  {
    id: 'scanning-pattern',
    name: 'Scanning Pattern',
    description: 'Scan the environment with sensor readings',
    category: 'intermediate',
    code: `// Scanning Pattern - Survey the surroundings

print("Starting environment scan...");

const readings = [];

// Scan in 30-degree increments
for (let angle = -90; angle <= 90; angle += 30) {
  print("Scanning at", angle, "degrees...");
  await moveJoint('base', angle);
  await wait(300);

  const distance = readUltrasonic();
  readings.push({ angle, distance });
  print("  Distance:", distance, "cm");
}

// Return to center
await moveJoint('base', 0);

// Report findings
print("\\n=== Scan Results ===");
let minDistance = Infinity;
let minAngle = 0;

for (const r of readings) {
  if (r.distance < minDistance) {
    minDistance = r.distance;
    minAngle = r.angle;
  }
}

print("Closest object at", minAngle, "degrees");
print("Distance:", minDistance, "cm");

print("\\nScan complete!");
`,
  },
  {
    id: 'wave-hello',
    name: 'Wave Hello',
    description: 'Friendly wave animation',
    category: 'intermediate',
    code: `// Wave Hello - A friendly greeting

print("Let me wave hello!");

// Raise arm
await moveJoints({ shoulder: 60, elbow: -90 });

// Wave 3 times
for (let i = 0; i < 3; i++) {
  await moveJoint('wrist', 40);
  await wait(200);
  await moveJoint('wrist', -40);
  await wait(200);
}

// Return wrist to center
await moveJoint('wrist', 0);
await wait(200);

// Return to home
await goHome();

print("Hello!");
`,
  },

  // Advanced Templates
  {
    id: 'obstacle-avoidance',
    name: 'Obstacle Avoidance',
    description: 'Navigate around detected obstacles',
    category: 'advanced',
    code: `// Obstacle Avoidance - Navigate safely

print("Starting obstacle avoidance program...");

const SAFE_DISTANCE = 15; // cm
const SCAN_ANGLES = [-60, -30, 0, 30, 60];

async function findClearPath() {
  let bestAngle = 0;
  let maxDistance = 0;

  for (const angle of SCAN_ANGLES) {
    await moveJoint('base', angle);
    await wait(200);

    const distance = readUltrasonic();
    print("Angle", angle, ":", distance, "cm");

    if (distance > maxDistance) {
      maxDistance = distance;
      bestAngle = angle;
    }
  }

  return { angle: bestAngle, distance: maxDistance };
}

// Main loop - run 3 iterations
for (let i = 0; i < 3; i++) {
  print("\\n--- Iteration", i + 1, "---");

  // Check current direction
  await moveJoint('base', 0);
  await wait(200);
  const frontDistance = readUltrasonic();

  if (frontDistance < SAFE_DISTANCE) {
    print("Obstacle detected! Finding clear path...");
    const clearPath = await findClearPath();
    print("Best path at", clearPath.angle, "degrees");
    await moveJoint('base', clearPath.angle);
  } else {
    print("Path clear, distance:", frontDistance, "cm");
  }

  await wait(1000);
}

await goHome();
print("\\nObstacle avoidance complete!");
`,
  },
  {
    id: 'sorting-demo',
    name: 'Sorting Demo',
    description: 'Demonstrate sorting objects to different locations',
    category: 'advanced',
    code: `// Sorting Demo - Sort objects to left or right

print("Starting sorting demonstration...");

// Define positions
const PICKUP_POS = { shoulder: -20, elbow: -100 };
const LIFT_POS = { shoulder: 20, elbow: -30 };
const LEFT_BASE = -70;
const RIGHT_BASE = 70;

async function pickObject() {
  await openGripper();
  await moveJoints(PICKUP_POS);
  await wait(300);
  await closeGripper();
  await wait(200);
  await moveJoints(LIFT_POS);
}

async function placeObject(side) {
  const baseAngle = side === 'left' ? LEFT_BASE : RIGHT_BASE;
  await moveJoint('base', baseAngle);
  await wait(300);
  await moveJoints(PICKUP_POS);
  await wait(200);
  await openGripper();
  await wait(200);
  await moveJoints(LIFT_POS);
  await moveJoint('base', 0);
}

// Simulate sorting 3 objects
const sortOrder = ['left', 'right', 'left'];

for (let i = 0; i < sortOrder.length; i++) {
  print("\\nSorting object", i + 1, "to", sortOrder[i]);

  await goHome();
  await wait(300);

  print("  Picking up...");
  await pickObject();

  print("  Placing on", sortOrder[i], "side...");
  await placeObject(sortOrder[i]);
}

await goHome();
print("\\nSorting complete!");
`,
  },
  {
    id: 'drawing-pattern',
    name: 'Drawing Pattern',
    description: 'Move in a pattern as if drawing a shape',
    category: 'advanced',
    code: `// Drawing Pattern - Trace a square pattern

print("Drawing a square pattern...");

// Lower arm to drawing position
await moveJoints({ shoulder: 30, elbow: -20, wrist: -10 });
print("Arm in drawing position");

// Draw square corners
const corners = [
  { base: -30, shoulder: 30 },
  { base: -30, shoulder: 50 },
  { base: 30, shoulder: 50 },
  { base: 30, shoulder: 30 },
  { base: -30, shoulder: 30 }, // Return to start
];

for (let i = 0; i < corners.length - 1; i++) {
  print("Drawing line", i + 1, "of 4...");

  const start = corners[i];
  const end = corners[i + 1];

  // Move in small steps for smooth line
  const steps = 10;
  for (let s = 0; s <= steps; s++) {
    const progress = s / steps;
    const base = start.base + (end.base - start.base) * progress;
    const shoulder = start.shoulder + (end.shoulder - start.shoulder) * progress;

    await moveJoints({ base, shoulder }, 2); // Fast movement
    await wait(50);
  }
}

print("Square complete!");
await goHome();
print("Done!");
`,
  },
];

export const getTemplatesByCategory = (category: CodeTemplate['category']): CodeTemplate[] => {
  return CODE_TEMPLATES.filter(t => t.category === category);
};

export const getTemplateById = (id: string): CodeTemplate | undefined => {
  return CODE_TEMPLATES.find(t => t.id === id);
};
