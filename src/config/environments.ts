import type { EnvironmentConfig, Challenge, SimObject, TargetZone } from '../types';

export const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    id: 'empty',
    name: 'Empty Workspace',
    description: 'Clean workspace for free exploration and learning basic movements',
    icon: 'square',
    difficulty: 'beginner',
  },
  {
    id: 'obstacles',
    name: 'Obstacle Course',
    description: 'Navigate around obstacles to reach targets',
    icon: 'boxes',
    difficulty: 'beginner',
  },
  {
    id: 'lineTrack',
    name: 'Line Track',
    description: 'Follow the line using IR sensors',
    icon: 'route',
    difficulty: 'intermediate',
  },
  {
    id: 'maze',
    name: 'Maze Challenge',
    description: 'Find your way through the maze using sensors',
    icon: 'grid-3x3',
    difficulty: 'intermediate',
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Pick and place objects to designated zones',
    icon: 'warehouse',
    difficulty: 'advanced',
  },
];

// Default objects for each environment
export const getEnvironmentObjects = (envId: string): SimObject[] => {
  switch (envId) {
    case 'obstacles':
      return [
        {
          id: 'cube1',
          type: 'cube',
          position: [0.12, 0.015, 0.05],
          rotation: [0, 0, 0],
          scale: 0.03,
          color: '#EF4444',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
        {
          id: 'cube2',
          type: 'cube',
          position: [-0.1, 0.015, 0.08],
          rotation: [0, Math.PI / 4, 0],
          scale: 0.03,
          color: '#3B82F6',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
        {
          id: 'ball1',
          type: 'ball',
          position: [0.08, 0.015, -0.1],
          rotation: [0, 0, 0],
          scale: 0.025,
          color: '#22C55E',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
      ];
    case 'warehouse':
      return [
        {
          id: 'package1',
          type: 'cube',
          position: [0.15, 0.02, 0.0],
          rotation: [0, 0, 0],
          scale: 0.04,
          color: '#F59E0B',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
        {
          id: 'package2',
          type: 'cube',
          position: [0.15, 0.02, 0.08],
          rotation: [0, 0, 0],
          scale: 0.04,
          color: '#8B5CF6',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
        {
          id: 'package3',
          type: 'cube',
          position: [0.15, 0.02, -0.08],
          rotation: [0, 0, 0],
          scale: 0.04,
          color: '#EC4899',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
        {
          id: 'cylinder1',
          type: 'cylinder',
          position: [-0.12, 0.02, 0.05],
          rotation: [0, 0, 0],
          scale: 0.03,
          color: '#06B6D4',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
      ];
    case 'empty':
    default:
      return [
        {
          id: 'demo-cube',
          type: 'cube',
          position: [0.12, 0.015, 0],
          rotation: [0, 0, 0],
          scale: 0.03,
          color: '#3B82F6',
          isGrabbable: true,
          isGrabbed: false,
          isInTargetZone: false,
        },
      ];
  }
};

// Target zones for each environment
export const getEnvironmentTargetZones = (envId: string): TargetZone[] => {
  switch (envId) {
    case 'warehouse':
      return [
        {
          id: 'zone-a',
          position: [-0.15, 0.005, 0.0],
          size: [0.08, 0.01, 0.08],
          color: '#22C55E',
          acceptedObjectIds: ['package1', 'package2', 'package3'],
          isSatisfied: false,
        },
        {
          id: 'zone-b',
          position: [-0.15, 0.005, 0.12],
          size: [0.06, 0.01, 0.06],
          color: '#3B82F6',
          acceptedObjectIds: ['cylinder1'],
          isSatisfied: false,
        },
      ];
    case 'obstacles':
      return [
        {
          id: 'goal-zone',
          position: [-0.12, 0.005, 0],
          size: [0.1, 0.01, 0.1],
          color: '#22C55E',
          acceptedObjectIds: ['cube1', 'cube2', 'ball1'],
          isSatisfied: false,
        },
      ];
    default:
      return [];
  }
};

// Challenge definitions
export const CHALLENGES: Challenge[] = [
  // Beginner challenges
  {
    id: 'first-pickup',
    name: 'First Pickup',
    description: 'Learn to pick up your first object. Move the arm to grab the cube and lift it up.',
    environment: 'empty',
    difficulty: 'beginner',
    objectives: [
      {
        id: 'obj1',
        description: 'Move the gripper above the cube',
        type: 'reach_position',
        target: { position: [0.12, 0.1, 0] },
        isCompleted: false,
      },
      {
        id: 'obj2',
        description: 'Close the gripper to grab the cube',
        type: 'reach_position',
        isCompleted: false,
      },
      {
        id: 'obj3',
        description: 'Lift the cube off the table',
        type: 'reach_position',
        target: { position: [0.12, 0.15, 0] },
        isCompleted: false,
      },
    ],
    hints: [
      'Try saying "move above the cube"',
      'Use "close gripper" to grab objects',
      'Say "lift up" to raise the arm',
    ],
    status: 'available',
    attempts: 0,
  },
  {
    id: 'sort-by-color',
    name: 'Sort by Color',
    description: 'Move all objects to the green target zone.',
    environment: 'obstacles',
    difficulty: 'beginner',
    timeLimit: 120,
    objectives: [
      {
        id: 'obj1',
        description: 'Move the red cube to the target zone',
        type: 'move_object',
        target: { objectId: 'cube1', zoneId: 'goal-zone' },
        isCompleted: false,
      },
      {
        id: 'obj2',
        description: 'Move the blue cube to the target zone',
        type: 'move_object',
        target: { objectId: 'cube2', zoneId: 'goal-zone' },
        isCompleted: false,
      },
      {
        id: 'obj3',
        description: 'Move the green ball to the target zone',
        type: 'move_object',
        target: { objectId: 'ball1', zoneId: 'goal-zone' },
        isCompleted: false,
      },
    ],
    hints: [
      'Start with the closest object',
      'Plan your movements to avoid knocking over other objects',
      'You can ask me to "pick up the red cube" or "move ball to target"',
    ],
    status: 'available',
    attempts: 0,
  },
  // Intermediate challenges
  {
    id: 'follow-the-line',
    name: 'Follow the Line',
    description: 'Use the IR sensors to follow the black line track.',
    environment: 'lineTrack',
    difficulty: 'intermediate',
    objectives: [
      {
        id: 'obj1',
        description: 'Start at the beginning of the line',
        type: 'reach_position',
        isCompleted: false,
      },
      {
        id: 'obj2',
        description: 'Follow the line to the end',
        type: 'follow_line',
        isCompleted: false,
      },
    ],
    hints: [
      'Keep the center IR sensor on the line',
      'If left sensor sees the line, turn left slightly',
      'Move slowly for better control',
    ],
    status: 'available',
    attempts: 0,
  },
  {
    id: 'maze-runner',
    name: 'Maze Runner',
    description: 'Navigate through the maze using ultrasonic sensors to avoid walls.',
    environment: 'maze',
    difficulty: 'intermediate',
    timeLimit: 180,
    objectives: [
      {
        id: 'obj1',
        description: 'Navigate to the maze exit',
        type: 'navigate_maze',
        isCompleted: false,
      },
    ],
    hints: [
      'Use the ultrasonic sensor to detect walls',
      'Try the "right-hand rule" - always keep wall on your right',
      'Ask me for help with "wall following" logic',
    ],
    status: 'locked',
    attempts: 0,
  },
  // Advanced challenges
  {
    id: 'warehouse-sort',
    name: 'Warehouse Sort',
    description: 'Sort all packages to their designated zones as fast as possible.',
    environment: 'warehouse',
    difficulty: 'advanced',
    timeLimit: 300,
    objectives: [
      {
        id: 'obj1',
        description: 'Move all cubes to Zone A (green)',
        type: 'collect_all',
        target: { zoneId: 'zone-a' },
        isCompleted: false,
      },
      {
        id: 'obj2',
        description: 'Move the cylinder to Zone B (blue)',
        type: 'move_object',
        target: { objectId: 'cylinder1', zoneId: 'zone-b' },
        isCompleted: false,
      },
    ],
    hints: [
      'Plan an efficient route before starting',
      'Group similar movements together',
      'Consider which objects are closest first',
    ],
    status: 'locked',
    attempts: 0,
  },
];

export const DEFAULT_ENVIRONMENT: string = 'empty';
