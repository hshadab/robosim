/**
 * Place Examples - Training Data for Place Task
 *
 * Stores verified working place sequences (pick + place to target zone).
 * Used for few-shot learning and template-based place operations.
 */

import type { JointState } from '../types';
import { createLogger } from './logger';
import { generateSecureId } from './crypto';

const log = createLogger('PlaceExamples');

// Target zones with specific coordinates
export interface TargetZone {
  id: 'left' | 'center' | 'right';
  name: string;
  position: [number, number, number]; // [x, y, z] in meters
  description: string;
}

export const TARGET_ZONES: Record<string, TargetZone> = {
  left: {
    id: 'left',
    name: 'Left Zone',
    position: [0.16, 0.02, -0.05], // 5cm to the left
    description: 'left side of the workspace',
  },
  center: {
    id: 'center',
    name: 'Center Zone',
    position: [0.18, 0.02, 0.00], // center
    description: 'center of the workspace',
  },
  right: {
    id: 'right',
    name: 'Right Zone',
    position: [0.16, 0.02, 0.05], // 5cm to the right
    description: 'right side of the workspace',
  },
};

export interface PlaceExample {
  id: string;
  timestamp: number;
  // Source object info
  objectPosition: [number, number, number];
  objectType: 'cube' | 'cylinder' | string;
  objectName: string;
  objectScale: number;
  // Target zone
  targetZone: 'left' | 'center' | 'right';
  targetPosition: [number, number, number];
  // The joint sequence that worked (pickup + place)
  jointSequence: Partial<JointState>[];
  // Natural language that triggered this
  userMessage: string;
  // Outcome
  success: boolean;
  failureReason?: string;
}

// Verified working place examples
export const VERIFIED_PLACE_EXAMPLES: PlaceExample[] = [
  {
    id: 'place-cube-left-1',
    timestamp: 0,
    objectPosition: [0.17, 0.02, 0.01],
    objectType: 'cube',
    objectName: 'Red Cube',
    objectScale: 0.03,
    targetZone: 'left',
    targetPosition: [0.16, 0.02, -0.05],
    jointSequence: [
      // Approach pickup position
      { base: 3, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
      // Descend to grasp
      { base: 3, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Close gripper
      { base: 3, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Lift
      { base: 3, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Move to left zone (rotate base to -17 degrees for Z=-5cm)
      { base: -17, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Descend to place
      { base: -17, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Open gripper to release
      { base: -17, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Lift away
      { base: -17, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
    ],
    userMessage: 'place the red cube on the left',
    success: true,
  },
  {
    id: 'place-cube-right-1',
    timestamp: 0,
    objectPosition: [0.17, 0.02, -0.01],
    objectType: 'cube',
    objectName: 'Blue Cube',
    objectScale: 0.03,
    targetZone: 'right',
    targetPosition: [0.16, 0.02, 0.05],
    jointSequence: [
      // Approach pickup position
      { base: -3, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
      // Descend to grasp
      { base: -3, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Close gripper
      { base: -3, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Lift
      { base: -3, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Move to right zone (rotate base to +17 degrees for Z=+5cm)
      { base: 17, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Descend to place
      { base: 17, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Open gripper to release
      { base: 17, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Lift away
      { base: 17, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
    ],
    userMessage: 'place the blue cube on the right',
    success: true,
  },
  {
    id: 'place-cube-center-1',
    timestamp: 0,
    objectPosition: [0.16, 0.02, 0.02],
    objectType: 'cube',
    objectName: 'Green Cube',
    objectScale: 0.03,
    targetZone: 'center',
    targetPosition: [0.18, 0.02, 0.00],
    jointSequence: [
      // Approach pickup position
      { base: 7, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
      // Descend to grasp
      { base: 7, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Close gripper
      { base: 7, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Lift
      { base: 7, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Move to center zone (base to 0 degrees)
      { base: 0, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
      // Descend to place
      { base: 0, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      // Open gripper to release
      { base: 0, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      // Lift away
      { base: 0, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
    ],
    userMessage: 'place the green cube in the center',
    success: true,
  },
];

// In-memory store for place examples
let placeExamples: PlaceExample[] = [];

/**
 * Initialize the examples store with verified examples
 */
export function initializePlaceExamples(): void {
  placeExamples = [...VERIFIED_PLACE_EXAMPLES];
  log.info(`Initialized with ${placeExamples.length} verified place examples`);
}

/**
 * Get all successful place examples
 */
export function getSuccessfulPlaceExamples(): PlaceExample[] {
  return placeExamples.filter(e => e.success);
}

/**
 * Find similar successful place examples (for few-shot learning)
 */
export function findSimilarPlaceExamples(
  objectType: string,
  targetZone: 'left' | 'center' | 'right',
  limit: number = 2
): PlaceExample[] {
  const successful = getSuccessfulPlaceExamples();

  // Score by similarity (same type + same zone)
  const scored = successful.map(example => {
    const typeMatch = example.objectType === objectType ? 2 : 0;
    const zoneMatch = example.targetZone === targetZone ? 3 : 0;
    return { example, score: typeMatch + zoneMatch };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.example);
}

/**
 * Generate template-based place sequence for a given object position and target zone
 */
export function generatePlaceSequence(
  objectPosition: [number, number, number],
  targetZone: 'left' | 'center' | 'right',
  objectType: 'cube' | 'cylinder' = 'cube'
): Partial<JointState>[] {
  const zone = TARGET_ZONES[targetZone];

  // Calculate base angles
  const pickupBase = Math.atan2(objectPosition[2], objectPosition[0]) * (180 / Math.PI);
  const placeBase = Math.atan2(zone.position[2], zone.position[0]) * (180 / Math.PI);

  // Use wristRoll=90 for cubes, 0 for cylinders
  const wristRoll = objectType === 'cylinder' ? 0 : 90;

  return [
    // Approach pickup position from above
    { base: pickupBase, shoulder: -50, elbow: 30, wrist: 45, wristRoll, gripper: 100 },
    // Descend to grasp
    { base: pickupBase, shoulder: -22, elbow: 51, wrist: 63, wristRoll, gripper: 100 },
    // Close gripper
    { base: pickupBase, shoulder: -22, elbow: 51, wrist: 63, wristRoll, gripper: 0 },
    // Lift
    { base: pickupBase, shoulder: -50, elbow: 30, wrist: 45, wristRoll, gripper: 0 },
    // Move to target zone
    { base: placeBase, shoulder: -50, elbow: 30, wrist: 45, wristRoll, gripper: 0 },
    // Descend to place
    { base: placeBase, shoulder: -22, elbow: 51, wrist: 63, wristRoll, gripper: 0 },
    // Open gripper to release
    { base: placeBase, shoulder: -22, elbow: 51, wrist: 63, wristRoll, gripper: 100 },
    // Lift away
    { base: placeBase, shoulder: -50, elbow: 30, wrist: 45, wristRoll, gripper: 100 },
  ];
}

/**
 * Generate few-shot prompt examples for place task
 */
export function generatePlaceFewShotExamples(limit: number = 2): string {
  const examples = getSuccessfulPlaceExamples().slice(0, limit);

  if (examples.length === 0) {
    return '';
  }

  const lines = examples.map(ex => {
    const srcPos = ex.objectPosition.map(p => (p * 100).toFixed(0)).join(', ');
    const tgtPos = ex.targetPosition.map(p => (p * 100).toFixed(0)).join(', ');
    return `- ${ex.objectType} from [${srcPos}]cm to ${ex.targetZone} [${tgtPos}]cm: pickup base=${ex.jointSequence[0]?.base?.toFixed(0)}°, place base=${ex.jointSequence[4]?.base?.toFixed(0)}°`;
  });

  return `
PROVEN WORKING PLACE EXAMPLES:
${lines.join('\n')}

Place sequence: pickup (4 steps) → move to zone → place (4 steps)
Key: Calculate base angle for both pickup AND place positions using atan2(z, x).
`;
}

/**
 * Log a place attempt
 */
export function logPlaceAttempt(attempt: Omit<PlaceExample, 'id' | 'timestamp' | 'success'>): string {
  const id = generateSecureId('place');

  const example: PlaceExample = {
    id,
    timestamp: Date.now(),
    ...attempt,
    success: false,
  };

  placeExamples.push(example);
  log.debug(`Logged place attempt ${id} for "${attempt.objectName}" to ${attempt.targetZone}`);

  return id;
}

/**
 * Mark a place as successful
 */
export function markPlaceSuccess(id: string): void {
  const example = placeExamples.find(e => e.id === id);
  if (example) {
    example.success = true;
    log.info(`Place ${id} succeeded - "${example.objectName}" to ${example.targetZone}`);
  }
}

/**
 * Mark a place as failed
 */
export function markPlaceFailure(id: string, reason: string): void {
  const example = placeExamples.find(e => e.id === id);
  if (example) {
    example.success = false;
    example.failureReason = reason;
    log.warn(`Place ${id} failed: ${reason}`);
  }
}

/**
 * Get place statistics
 */
export function getPlaceStats(): {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  byZone: Record<string, { success: number; fail: number }>;
} {
  const successful = placeExamples.filter(e => e.success).length;
  const failed = placeExamples.filter(e => !e.success).length;
  const total = placeExamples.length;

  const byZone: Record<string, { success: number; fail: number }> = {};
  for (const example of placeExamples) {
    if (!byZone[example.targetZone]) {
      byZone[example.targetZone] = { success: 0, fail: 0 };
    }
    if (example.success) {
      byZone[example.targetZone].success++;
    } else {
      byZone[example.targetZone].fail++;
    }
  }

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? successful / total : 0,
    byZone,
  };
}

// Initialize on module load
initializePlaceExamples();
