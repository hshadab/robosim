/**
 * Test Fixtures: Episodes
 *
 * Sample episode data in LeRobot-compatible format for export testing.
 */

export interface EpisodeFrame {
  timestamp: number;
  observation: {
    state: number[]; // 6 joints in radians, gripper 0-1
  };
  action: number[]; // 6 values
  velocity?: number[]; // 6 values in rad/s
}

export interface Episode {
  id: string;
  frames: EpisodeFrame[];
  metadata: {
    action: string;
    success: boolean;
    objectType?: string;
    language?: string;
  };
}

// Helper to convert degrees to radians
const toRad = (deg: number) => deg * Math.PI / 180;

// Helper to normalize gripper (0-100 to 0-1)
const normGripper = (val: number) => val / 100;

export const VALID_EPISODES: Record<string, Episode> = {
  pickupSuccess: {
    id: 'episode_001',
    frames: [
      {
        timestamp: 0,
        observation: { state: [toRad(0), toRad(0), toRad(0), toRad(0), toRad(90), normGripper(100)] },
        action: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), normGripper(100)],
        velocity: [0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: 33,
        observation: { state: [toRad(0.3), toRad(-1.3), toRad(3.1), toRad(3.8), toRad(90), normGripper(100)] },
        action: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), normGripper(100)],
        velocity: [toRad(9), toRad(-39), toRad(93), toRad(114), 0, 0],
      },
      // ... more frames at 30fps would be here
      {
        timestamp: 500,
        observation: { state: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), normGripper(100)] },
        action: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), normGripper(0)],
        velocity: [0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: 1300,
        observation: { state: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), normGripper(0)] },
        action: [toRad(5), toRad(-35), toRad(40), toRad(55), toRad(90), normGripper(0)],
        velocity: [0, 0, 0, 0, 0, -0.001], // Gripper velocity normalized (not in degrees)
      },
      {
        timestamp: 1800,
        observation: { state: [toRad(5), toRad(-35), toRad(40), toRad(55), toRad(90), normGripper(0)] },
        action: [toRad(5), toRad(-35), toRad(40), toRad(55), toRad(90), normGripper(0)],
        velocity: [0, toRad(-26), toRad(-22), toRad(-16), 0, 0],
      },
    ],
    metadata: {
      action: 'pickup',
      success: true,
      objectType: 'cube',
      language: 'Pick up the red cube',
    },
  },

  placeSuccess: {
    id: 'episode_002',
    frames: [
      {
        timestamp: 0,
        observation: { state: [toRad(0), toRad(-30), toRad(40), toRad(50), toRad(90), normGripper(0)] },
        action: [toRad(-25), toRad(-25), toRad(45), toRad(55), toRad(90), normGripper(0)],
        velocity: [0, 0, 0, 0, 0, 0],
      },
      {
        timestamp: 600,
        observation: { state: [toRad(-25), toRad(-25), toRad(45), toRad(55), toRad(90), normGripper(0)] },
        action: [toRad(-25), toRad(-18), toRad(52), toRad(62), toRad(90), normGripper(0)],
        velocity: [toRad(-41.7), toRad(8.3), toRad(8.3), toRad(8.3), 0, 0],
      },
      {
        timestamp: 1200,
        observation: { state: [toRad(-25), toRad(-18), toRad(52), toRad(62), toRad(90), normGripper(0)] },
        action: [toRad(-25), toRad(-18), toRad(52), toRad(62), toRad(90), normGripper(100)],
        velocity: [0, toRad(11.7), toRad(11.7), toRad(11.7), 0, 0],
      },
      {
        timestamp: 2000,
        observation: { state: [toRad(-25), toRad(-18), toRad(52), toRad(62), toRad(90), normGripper(100)] },
        action: [toRad(-25), toRad(-30), toRad(40), toRad(50), toRad(90), normGripper(100)],
        velocity: [0, 0, 0, 0, 0, 0.001], // Gripper velocity normalized (not in degrees)
      },
      {
        timestamp: 2500,
        observation: { state: [toRad(-25), toRad(-30), toRad(40), toRad(50), toRad(90), normGripper(100)] },
        action: [toRad(-25), toRad(-30), toRad(40), toRad(50), toRad(90), normGripper(100)],
        velocity: [0, toRad(-24), toRad(-24), toRad(-24), 0, 0],
      },
    ],
    metadata: {
      action: 'place',
      success: true,
      objectType: 'cube',
      language: 'Place the cube in the left zone',
    },
  },

  minimalValid: {
    id: 'episode_003',
    frames: generateMinimalValidFrames(),
    metadata: {
      action: 'pickup',
      success: true,
      objectType: 'cube',
    },
  },
};

// Generate 90 frames (3s at 30fps) - ensures 800ms+ gripper close
function generateMinimalValidFrames(): EpisodeFrame[] {
  const frames: EpisodeFrame[] = [];
  const frameCount = 90;
  const duration = 3000; // ms

  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    const timestamp = Math.round(t * duration);

    // Smooth interpolation from start to end (using smaller angles to stay within limits)
    const base = toRad(t * 5);
    const shoulder = toRad(t * -20);
    const elbow = toRad(t * 45);
    const wrist = toRad(t * 50);
    const wristRoll = toRad(90);
    // Gripper opens for first 33%, then closes slowly over remaining 67% (2000ms)
    // This ensures gripper close (0.5 -> 0.1) takes > 800ms
    let gripper: number;
    if (t < 0.33) {
      gripper = 1.0;
    } else {
      gripper = Math.max(0.05, 1.0 - ((t - 0.33) / 0.67) * 0.95);
    }

    frames.push({
      timestamp,
      observation: { state: [base, shoulder, elbow, wrist, wristRoll, gripper] },
      action: [base, shoulder, elbow, wrist, wristRoll, gripper],
      velocity: i === 0 ? [0, 0, 0, 0, 0, 0] : undefined,
    });
  }

  return frames;
}

export const INVALID_EPISODES: Record<string, Episode> = {
  tooFewFrames: {
    id: 'episode_invalid_001',
    frames: [
      {
        timestamp: 0,
        observation: { state: [0, 0, 0, 0, toRad(90), 1.0] },
        action: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), 0],
      },
      {
        timestamp: 500,
        observation: { state: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), 0] },
        action: [toRad(5), toRad(-22), toRad(51), toRad(63), toRad(90), 0],
      },
    ],
    metadata: {
      action: 'pickup',
      success: false,
    },
  },

  wrongDimensions: {
    id: 'episode_invalid_002',
    frames: [
      {
        timestamp: 0,
        observation: { state: [0, 0, 0, 0, 0] }, // Only 5 dimensions, should be 6
        action: [0, 0, 0, 0, 0],
      },
    ],
    metadata: {
      action: 'pickup',
      success: false,
    },
  },

  outOfRangeJoint: {
    id: 'episode_invalid_003',
    frames: [
      {
        timestamp: 0,
        observation: { state: [toRad(200), toRad(-150), toRad(120), toRad(100), toRad(90), 1.0] }, // Base at 200° is out of ±110° bounds
        action: [toRad(200), toRad(-150), toRad(120), toRad(100), toRad(90), 1.0],
      },
    ],
    metadata: {
      action: 'pickup',
      success: false,
    },
  },
};

// LeRobot schema constants
export const LEROBOT_SCHEMA = {
  codebase_version: 'v2.0',
  fps: 30,
  robot_type: 'so101',
  features: {
    'observation.state': { shape: [6], dtype: 'float32' },
    'action': { shape: [6], dtype: 'float32' },
    'observation.velocity': { shape: [6], dtype: 'float32' },
    'episode_index': { shape: [1], dtype: 'int64' },
    'frame_index': { shape: [1], dtype: 'int64' },
    'timestamp': { shape: [1], dtype: 'float32' },
  },
};

// SO-101 limits in radians for validation
export const SO101_LIMITS_RAD = {
  base: { min: toRad(-110), max: toRad(110) },
  shoulder: { min: toRad(-100), max: toRad(100) },
  elbow: { min: toRad(-97), max: toRad(97) },
  wrist: { min: toRad(-95), max: toRad(95) },
  wristRoll: { min: toRad(-157), max: toRad(163) },
  gripper: { min: 0, max: 1 },
};

// Max velocities in rad/s (gripper in normalized units/s)
export const SO101_MAX_VEL_RAD = {
  base: toRad(180),
  shoulder: toRad(120),
  elbow: toRad(150),
  wrist: toRad(200),
  wristRoll: toRad(200),
  // Gripper is normalized 0-1, original limit 300 deg/s from 0-100 range = 3.0 units/s
  gripper: 3.0,
};
