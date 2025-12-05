import type { RobotProfile } from '../types';

export const ROBOT_PROFILES: RobotProfile[] = [
  {
    id: 'so-100',
    name: 'SO-101',
    manufacturer: 'LeRobot',
    type: 'arm',
    description: '6-DOF Open-Source Desktop Arm for AI/ML Research (SO-101)',
    limits: {
      base: { min: -180, max: 180 },       // shoulder_pan
      shoulder: { min: -90, max: 90 },      // shoulder_lift
      elbow: { min: -135, max: 135 },       // elbow_flex
      wrist: { min: -90, max: 90 },         // wrist_flex
      gripper: { min: 0, max: 100 },        // gripper open %
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 0,
      gripper: 50,
    },
  },
  {
    id: 'elegoo-smart-car-v4',
    name: 'Smart Robot Car v4',
    manufacturer: 'Elegoo',
    type: 'wheeled',
    description: '4WD Arduino Robot Car with Ultrasonic & IR Sensors',
    limits: {
      base: { min: -180, max: 180 },
      shoulder: { min: 0, max: 255 },
      elbow: { min: 0, max: 255 },
      wrist: { min: 0, max: 180 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 90,
      gripper: 0,
    },
  },
  {
    id: 'mini-quadcopter',
    name: 'Mini Quadcopter',
    manufacturer: 'Generic',
    type: 'drone',
    description: 'Mini Quadcopter Drone with Altitude Hold',
    limits: {
      base: { min: -180, max: 180 },
      shoulder: { min: -45, max: 45 },
      elbow: { min: -45, max: 45 },
      wrist: { min: 0, max: 100 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 50,
      gripper: 0,
    },
  },
  {
    id: 'berkeley-humanoid-lite',
    name: 'Humanoid Lite',
    manufacturer: 'UC Berkeley',
    type: 'humanoid',
    description: 'Open-source 22-DOF humanoid robot (0.8m, 16kg)',
    limits: {
      base: { min: -180, max: 180 },
      shoulder: { min: -180, max: 60 },
      elbow: { min: 0, max: 135 },
      wrist: { min: -90, max: 90 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 0,
      gripper: 0,
    },
  },
];

export const DEFAULT_ROBOT_ID = 'so-100';

export const getDefaultCode = (robotId: string): string => {
  if (robotId === 'so-100') {
    return `// SO-101 Robot Arm Control Code
// LeRobot / The Robot Studio Open-Source Arm
// https://github.com/TheRobotStudio/SO-ARM100

// Move to home position
await goHome();
print("SO-101 arm ready!");

// Example: Wave hello
await moveJoint('shoulder', 45);
await moveJoint('elbow', -60);

// Wave the wrist
for (let i = 0; i < 2; i++) {
  await moveJoint('wrist', 45);
  await wait(300);
  await moveJoint('wrist', -45);
  await wait(300);
}

await goHome();
print("Done waving!");
`;
  }

  return `// Robot Control Code
// RoboSim JavaScript API

print("Starting robot program...");

// Read sensors
const distance = readUltrasonic();
print("Distance:", distance, "cm");

// Move to home
await goHome();

// Example movement sequence
await moveJoint('base', 45);
await wait(500);
await moveJoint('base', -45);
await wait(500);
await goHome();

print("Program complete!");
`;
};
