/**
 * Pickup Examples - Training Data Collection
 *
 * Stores successful pickup sequences for training the LLM chat.
 * Seeds with verified working examples from Demo Pick Up.
 */

import type { JointState } from '../types';
import { createLogger } from './logger';

const log = createLogger('PickupExamples');

export interface PickupExample {
  id: string;
  timestamp: number;
  // Object info
  objectPosition: [number, number, number];
  objectType: 'cube' | 'cylinder' | 'ball' | string;
  objectName: string;
  objectScale: number;
  // The joint sequence that worked
  jointSequence: Partial<JointState>[];
  // IK quality metrics
  ikErrors: {
    approach: number;
    grasp: number;
    lift: number;
  };
  // Natural language that triggered this
  userMessage: string;
  // Outcome
  success: boolean;
  failureReason?: string;
}

export interface PickupAttempt {
  objectPosition: [number, number, number];
  objectType: string;
  objectName: string;
  objectScale: number;
  jointSequence: Partial<JointState>[];
  ikErrors: { approach: number; grasp: number; lift: number };
  userMessage: string;
}

// In-memory store for pickup examples
let pickupExamples: PickupExample[] = [];

// Verified working examples from Demo Pick Up - these are known to work!
export const VERIFIED_PICKUPS: PickupExample[] = [
  {
    id: 'demo-cube-16-2-1',
    timestamp: 0,
    objectPosition: [0.16, 0.02, 0.01],
    objectType: 'cube',
    objectName: 'Demo Cube',
    objectScale: 0.04,
    jointSequence: [
      { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      { gripper: 0 },
      { base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 0 },
      { base: 5, shoulder: -10, elbow: 40, wrist: 50, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.02 },
    userMessage: 'pick up the cube',
    success: true,
  },
  {
    id: 'demo-cube-12-2-15',
    timestamp: 0,
    objectPosition: [0.12, 0.02, 0.15],
    objectType: 'cube',
    objectName: 'Far Cube',
    objectScale: 0.04,
    jointSequence: [
      { base: 51, shoulder: -50, elbow: 80, wrist: 10, wristRoll: 90, gripper: 100 },
      { gripper: 0 },
      { base: 51, shoulder: -50, elbow: 80, wrist: 10, wristRoll: 90, gripper: 0 },
      { base: 51, shoulder: -40, elbow: 70, wrist: 0, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.02, grasp: 0.02, lift: 0.02 },
    userMessage: 'pick up the cube',
    success: true,
  },
];

/**
 * Initialize the examples store with verified pickups
 */
export function initializePickupExamples(): void {
  pickupExamples = [...VERIFIED_PICKUPS];
  log.info(`Initialized with ${pickupExamples.length} verified examples`);
}

/**
 * Log a pickup attempt (before we know if it succeeded)
 */
export function logPickupAttempt(attempt: PickupAttempt): string {
  const id = `pickup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const example: PickupExample = {
    id,
    timestamp: Date.now(),
    objectPosition: attempt.objectPosition,
    objectType: attempt.objectType,
    objectName: attempt.objectName,
    objectScale: attempt.objectScale,
    jointSequence: attempt.jointSequence,
    ikErrors: attempt.ikErrors,
    userMessage: attempt.userMessage,
    success: false, // Will be updated when we know the outcome
  };

  pickupExamples.push(example);
  log.debug(`Logged pickup attempt ${id} for "${attempt.objectName}"`);

  return id;
}

/**
 * Mark a pickup as successful
 */
export function markPickupSuccess(id: string): void {
  const example = pickupExamples.find(e => e.id === id);
  if (example) {
    example.success = true;
    log.info(`Pickup ${id} succeeded - "${example.objectName}" at [${example.objectPosition.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
  }
}

/**
 * Mark a pickup as failed with reason
 */
export function markPickupFailure(id: string, reason: string): void {
  const example = pickupExamples.find(e => e.id === id);
  if (example) {
    example.success = false;
    example.failureReason = reason;
    log.warn(`Pickup ${id} failed: ${reason}`);
  }
}

/**
 * Get all successful pickups (for training)
 */
export function getSuccessfulPickups(): PickupExample[] {
  return pickupExamples.filter(e => e.success);
}

/**
 * Get all failed pickups (for analysis)
 */
export function getFailedPickups(): PickupExample[] {
  return pickupExamples.filter(e => !e.success);
}

/**
 * Get pickup statistics
 */
export function getPickupStats(): {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  byObjectType: Record<string, { success: number; fail: number }>;
} {
  const successful = pickupExamples.filter(e => e.success).length;
  const failed = pickupExamples.filter(e => !e.success).length;
  const total = pickupExamples.length;

  const byObjectType: Record<string, { success: number; fail: number }> = {};
  for (const example of pickupExamples) {
    if (!byObjectType[example.objectType]) {
      byObjectType[example.objectType] = { success: 0, fail: 0 };
    }
    if (example.success) {
      byObjectType[example.objectType].success++;
    } else {
      byObjectType[example.objectType].fail++;
    }
  }

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? successful / total : 0,
    byObjectType,
  };
}

/**
 * Find similar successful pickups (for few-shot learning)
 */
export function findSimilarPickups(
  objectType: string,
  position: [number, number, number],
  limit: number = 3
): PickupExample[] {
  const successful = getSuccessfulPickups();

  // Score by similarity (same type + close position)
  const scored = successful.map(example => {
    const typeMatch = example.objectType === objectType ? 1 : 0;
    const distance = Math.sqrt(
      (example.objectPosition[0] - position[0]) ** 2 +
      (example.objectPosition[1] - position[1]) ** 2 +
      (example.objectPosition[2] - position[2]) ** 2
    );
    // Lower distance = better score (invert and scale)
    const distanceScore = Math.max(0, 1 - distance / 0.3); // 30cm = 0 score

    return {
      example,
      score: typeMatch * 2 + distanceScore,
    };
  });

  // Sort by score descending and return top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.example);
}

/**
 * Export examples for LeRobot training format
 */
export function exportForTraining(): {
  examples: PickupExample[];
  stats: ReturnType<typeof getPickupStats>;
} {
  return {
    examples: getSuccessfulPickups(),
    stats: getPickupStats(),
  };
}

/**
 * Generate few-shot prompt examples from successful pickups
 */
export function generateFewShotExamples(limit: number = 3): string {
  const examples = getSuccessfulPickups().slice(0, limit);

  if (examples.length === 0) {
    return '';
  }

  const lines = examples.map(ex => {
    const pos = ex.objectPosition.map(p => (p * 100).toFixed(0)).join(', ');
    const grasp = ex.jointSequence[0];
    return `- ${ex.objectType} at [${pos}]cm: base=${grasp?.base?.toFixed(0)}°, shoulder=${grasp?.shoulder?.toFixed(0)}°, elbow=${grasp?.elbow?.toFixed(0)}°, wrist=${grasp?.wrist?.toFixed(0)}°`;
  });

  return `
PROVEN WORKING PICKUP EXAMPLES:
${lines.join('\n')}

Key: Use wristRoll=90° for cubes/balls (vertical fingers), wristRoll=0° for cylinders (horizontal fingers).
Always use { gripper: 0, _gripperOnly: true } step with 800ms timing for physics detection.
`;
}

/**
 * Clear all non-verified examples (for testing)
 */
export function clearExamples(): void {
  pickupExamples = [...VERIFIED_PICKUPS];
  log.info('Cleared examples, reset to verified pickups only');
}

// Initialize on module load
initializePickupExamples();
