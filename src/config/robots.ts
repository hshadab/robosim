import type { RobotProfile } from '../types';

export const ROBOT_PROFILES: RobotProfile[] = [
  {
    id: 'so-101',
    name: 'SO-101',
    manufacturer: 'The Robot Studio',
    type: 'arm',
    description: '6-DOF Open-Source Desktop Arm for AI/ML Research (SO-101)',
    limits: {
      base: { min: -110, max: 110 },        // shoulder_pan: ±1.92 rad
      shoulder: { min: -100, max: 100 },    // shoulder_lift: ±1.75 rad
      elbow: { min: -97, max: 97 },         // elbow_flex: ±1.69 rad
      wrist: { min: -95, max: 95 },         // wrist_flex: ±1.66 rad
      wristRoll: { min: -157, max: 163 },   // wrist_roll: -2.74 to 2.84 rad
      gripper: { min: 0, max: 100 },        // gripper open %
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 0,
      wristRoll: 0,
      gripper: 50,
    },
    // Gear ratios from LeRobot/HuggingFace documentation
    // Follower arm uses STS3215 motors with uniform 1/345 gearing
    gearRatios: {
      base: { ratio: '1/345', motorType: 'STS3215' },         // shoulder_pan
      shoulder: { ratio: '1/345', motorType: 'STS3215' },     // shoulder_lift
      elbow: { ratio: '1/345', motorType: 'STS3215' },        // elbow_flex
      wrist: { ratio: '1/345', motorType: 'STS3215' },        // wrist_flex
      wristRoll: { ratio: '1/345', motorType: 'STS3215' },    // wrist_roll
      gripper: { ratio: '1/345', motorType: 'STS3215' },      // gripper
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
      wristRoll: { min: -180, max: 180 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 90,
      wristRoll: 0,
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
      wristRoll: { min: -180, max: 180 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 50,
      wristRoll: 0,
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
      wristRoll: { min: -180, max: 180 },
      gripper: { min: 0, max: 100 },
    },
    defaultPosition: {
      base: 0,
      shoulder: 0,
      elbow: 0,
      wrist: 0,
      wristRoll: 0,
      gripper: 0,
    },
  },
];

export const DEFAULT_ROBOT_ID = 'so-101';

export const getDefaultCode = (robotId: string): string => {
  if (robotId === 'so-101') {
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
