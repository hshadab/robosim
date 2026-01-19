/**
 * Test Fixtures: LLM Responses
 *
 * Sample LLM responses for pipeline testing - both valid and invalid.
 */

export const VALID_LLM_RESPONSES = {
  pickupCube: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      // Gripper closes over 2000ms to ensure 800ms from 0.5->0.1 after normalization
      { timestamp: 600, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 2600, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 5 }, _gripperOnly: true, _duration: 2000 },
      { timestamp: 3100, joints: { base: 5, shoulder: -35, elbow: 40, wrist: 55, wristRoll: 90, gripper: 5 } },
    ],
    metadata: {
      objectPosition: [0.16, 0.02, 0.01],
      objectType: 'cube',
    },
  },

  stackBlocks: {
    action: 'stack',
    target: 'red cube on blue cube',
    sequence: [
      // Approach red cube
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 600, joints: { base: 10, shoulder: -25, elbow: 55, wrist: 60, wristRoll: 90, gripper: 100 } },
      // Grasp red cube (2000ms gripper close for proper physics)
      { timestamp: 2600, joints: { base: 10, shoulder: -25, elbow: 55, wrist: 60, wristRoll: 90, gripper: 5 }, _gripperOnly: true, _duration: 2000 },
      // Lift
      { timestamp: 3100, joints: { base: 10, shoulder: -35, elbow: 45, wrist: 50, wristRoll: 90, gripper: 5 } },
      // Move to blue cube
      { timestamp: 3700, joints: { base: -15, shoulder: -30, elbow: 50, wrist: 55, wristRoll: 90, gripper: 5 } },
      // Lower onto blue cube
      { timestamp: 4300, joints: { base: -15, shoulder: -20, elbow: 55, wrist: 60, wristRoll: 90, gripper: 5 } },
      // Release (2000ms gripper open)
      { timestamp: 6300, joints: { base: -15, shoulder: -20, elbow: 55, wrist: 60, wristRoll: 90, gripper: 100 }, _gripperOnly: true, _duration: 2000 },
      // Retract
      { timestamp: 6800, joints: { base: -15, shoulder: -35, elbow: 40, wrist: 50, wristRoll: 90, gripper: 100 } },
    ],
    metadata: {
      objectPosition: [0.18, 0.02, 0.05],
      targetPosition: [0.14, 0.05, -0.03],
      objectType: 'cube',
    },
  },

  placeObject: {
    action: 'place',
    target: 'left zone',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: -30, elbow: 45, wrist: 55, wristRoll: 90, gripper: 0 } },
      { timestamp: 600, joints: { base: -30, shoulder: -25, elbow: 50, wrist: 60, wristRoll: 90, gripper: 0 } },
      { timestamp: 1200, joints: { base: -30, shoulder: -18, elbow: 55, wrist: 65, wristRoll: 90, gripper: 0 } },
      { timestamp: 2000, joints: { base: -30, shoulder: -18, elbow: 55, wrist: 65, wristRoll: 90, gripper: 100 }, _gripperOnly: true, _duration: 800 },
      { timestamp: 2500, joints: { base: -30, shoulder: -35, elbow: 40, wrist: 50, wristRoll: 90, gripper: 100 } },
    ],
    metadata: {
      targetZone: 'left',
      targetPosition: [-0.10, 0.02, 0.15],
    },
  },

  singleMove: {
    action: 'move',
    target: 'home position',
    sequence: [
      { timestamp: 0, joints: { base: 15, shoulder: -20, elbow: 40, wrist: 50, wristRoll: 90, gripper: 50 } },
      { timestamp: 800, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
    ],
    metadata: {},
  },

  smoothMotion: {
    action: 'move',
    target: 'smooth trajectory test',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 50 } },
      { timestamp: 200, joints: { base: 5, shoulder: -5, elbow: 10, wrist: 10, wristRoll: 90, gripper: 50 } },
      { timestamp: 400, joints: { base: 10, shoulder: -10, elbow: 20, wrist: 20, wristRoll: 90, gripper: 50 } },
      { timestamp: 600, joints: { base: 15, shoulder: -15, elbow: 30, wrist: 30, wristRoll: 90, gripper: 50 } },
      { timestamp: 800, joints: { base: 20, shoulder: -20, elbow: 40, wrist: 40, wristRoll: 90, gripper: 50 } },
      { timestamp: 1000, joints: { base: 25, shoulder: -25, elbow: 50, wrist: 50, wristRoll: 90, gripper: 50 } },
    ],
    metadata: {},
  },

  cylinderPickup: {
    action: 'pickup',
    target: 'blue cylinder',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 } },
      { timestamp: 600, joints: { base: -8, shoulder: -20, elbow: 48, wrist: 58, wristRoll: 0, gripper: 100 } },
      // Gripper closes over 2000ms to ensure 800ms from 0.5->0.1 after normalization
      { timestamp: 700, joints: { base: -8, shoulder: -20, elbow: 48, wrist: 58, wristRoll: 0, gripper: 100 } },
      { timestamp: 2700, joints: { base: -8, shoulder: -20, elbow: 48, wrist: 58, wristRoll: 0, gripper: 5 }, _gripperOnly: true, _duration: 2000 },
      { timestamp: 3200, joints: { base: -8, shoulder: -32, elbow: 38, wrist: 50, wristRoll: 0, gripper: 5 } },
    ],
    metadata: {
      objectPosition: [0.15, 0.025, -0.02],
      objectType: 'cylinder',
    },
  },
};

export const INVALID_LLM_RESPONSES = {
  malformedJson: 'This is not valid JSON {{{ broken',

  missingFields: {
    action: 'pickup',
    // Missing sequence and target
  },

  emptySequence: {
    action: 'pickup',
    target: 'red cube',
    sequence: [],
  },

  outOfBoundsJoints: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 150, shoulder: -150, elbow: 120, wrist: 63, wristRoll: 90, gripper: 100 } }, // base and shoulder out of bounds
    ],
  },

  excessiveVelocity: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 100, joints: { base: 90, shoulder: -80, elbow: 80, wrist: 63, wristRoll: 90, gripper: 100 } }, // 900°/s velocity!
    ],
  },

  gripperTooFast: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 100, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 80 } },
      { timestamp: 200, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 60 } },
      { timestamp: 300, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 40 } },
      { timestamp: 400, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 20 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 } }, // 500ms gripper close (< 800ms required)
      { timestamp: 800, joints: { base: 5, shoulder: -35, elbow: 40, wrist: 55, wristRoll: 90, gripper: 0 } },
    ],
  },

  noLiftAfterGrasp: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 1300, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 }, _gripperOnly: true, _duration: 800 },
      // Missing lift step - shoulder should decrease
    ],
  },

  negativeTimestamps: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: -100, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
    ],
  },

  nonMonotonicTimestamp: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 0, joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 1000, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 } }, // Goes backward
    ],
  },

  invalidTimestampType: {
    action: 'pickup',
    target: 'red cube',
    sequence: [
      { timestamp: 'zero', joints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 } },
      { timestamp: 500, joints: { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 } },
    ],
  },
};

export const LLM_RESPONSE_MARKDOWN = {
  withCodeBlock: `Here's the pickup sequence:

\`\`\`
{
  "action": "pickup",
  "target": "red cube",
  "sequence": [
    { "timestamp": 0, "joints": { "base": 0, "shoulder": 0, "elbow": 0, "wrist": 0, "wristRoll": 90, "gripper": 100 } },
    { "timestamp": 500, "joints": { "base": 5, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 100 } },
    { "timestamp": 1300, "joints": { "base": 5, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 0 }, "_gripperOnly": true, "_duration": 800 },
    { "timestamp": 1800, "joints": { "base": 5, "shoulder": -35, "elbow": 40, "wrist": 55, "wristRoll": 90, "gripper": 0 } }
  ]
}
\`\`\`

This will pick up the cube.`,

  withJsonLabel: `Here's the pickup sequence:

\`\`\`json
{
  "action": "pickup",
  "target": "red cube",
  "sequence": [
    { "timestamp": 0, "joints": { "base": 0, "shoulder": 0, "elbow": 0, "wrist": 0, "wristRoll": 90, "gripper": 100 } },
    { "timestamp": 500, "joints": { "base": 5, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 100 } },
    { "timestamp": 1300, "joints": { "base": 5, "shoulder": -22, "elbow": 51, "wrist": 63, "wristRoll": 90, "gripper": 0 }, "_gripperOnly": true, "_duration": 800 },
    { "timestamp": 1800, "joints": { "base": 5, "shoulder": -35, "elbow": 40, "wrist": 55, "wristRoll": 90, "gripper": 0 } }
  ]
}
\`\`\`

This will pick up the cube.`,

  noCodeBlock: `The robot should move to position base=5, shoulder=-22, elbow=51 to pick up the cube.`,
};
