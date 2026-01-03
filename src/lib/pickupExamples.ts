/**
 * Pickup Examples - Training Data Collection
 *
 * Stores successful pickup sequences for training the LLM chat.
 * Seeds with verified working examples from Demo Pick Up.
 * Includes language augmentation for diverse training data.
 */

import type { JointState } from '../types';
import { createLogger } from './logger';
import { generateLanguageVariants } from './languageAugmentation';

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
  // Language augmentation - diverse phrasings of the same action
  languageVariants?: string[];
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

// Internal mutable array for promoted examples (kept separate from base verified examples)
let promotedExamples: PickupExample[] = [];

/**
 * Validate that an object has the required PickupExample shape
 */
function isValidPickupExample(obj: unknown): obj is PickupExample {
  if (!obj || typeof obj !== 'object') return false;
  const example = obj as Record<string, unknown>;

  return (
    typeof example.id === 'string' &&
    typeof example.timestamp === 'number' &&
    Array.isArray(example.objectPosition) &&
    example.objectPosition.length === 3 &&
    example.objectPosition.every((p: unknown) => typeof p === 'number') &&
    typeof example.objectType === 'string' &&
    typeof example.objectName === 'string' &&
    typeof example.objectScale === 'number' &&
    Array.isArray(example.jointSequence) &&
    typeof example.ikErrors === 'object' &&
    example.ikErrors !== null &&
    typeof example.userMessage === 'string' &&
    typeof example.success === 'boolean'
  );
}

// Verified working examples from Demo Pick Up - these are known to work!
// Expanded to cover more of the workspace for higher success rates.
export const VERIFIED_PICKUPS: PickupExample[] = [
  // Original Demo position - center-right
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
  // Far position - angled right
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
  // Left workspace - [17, 2, -3]cm (base ≈ -10°)
  {
    id: 'verified-cube-left-1',
    timestamp: 0,
    objectPosition: [0.17, 0.02, -0.03],
    objectType: 'cube',
    objectName: 'Left Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: -10, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
      { base: -10, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: -10, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cube on the left',
    success: true,
  },
  // Right workspace - [17, 2, 3]cm (base ≈ +10°)
  {
    id: 'verified-cube-right-1',
    timestamp: 0,
    objectPosition: [0.17, 0.02, 0.03],
    objectType: 'cube',
    objectName: 'Right Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: 10, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 100 },
      { base: 10, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: 10, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cube on the right',
    success: true,
  },
  // Near reach - [14, 2, 0]cm (base ≈ 0°) - closer to robot
  {
    id: 'verified-cube-near-1',
    timestamp: 0,
    objectPosition: [0.14, 0.02, 0.00],
    objectType: 'cube',
    objectName: 'Near Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: 0, shoulder: -50, elbow: 25, wrist: 50, wristRoll: 90, gripper: 100 },
      { base: 0, shoulder: -18, elbow: 45, wrist: 70, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: 0, shoulder: -50, elbow: 25, wrist: 50, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cube close to me',
    success: true,
  },
  // Far reach - [19, 2, 0]cm (base ≈ 0°) - extended reach
  {
    id: 'verified-cube-far-1',
    timestamp: 0,
    objectPosition: [0.19, 0.02, 0.00],
    objectType: 'cube',
    objectName: 'Far Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: 0, shoulder: -50, elbow: 40, wrist: 40, wristRoll: 90, gripper: 100 },
      { base: 0, shoulder: -28, elbow: 60, wrist: 55, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: 0, shoulder: -50, elbow: 40, wrist: 40, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.015, grasp: 0.015, lift: 0.015 },
    userMessage: 'pick up the cube far away',
    success: true,
  },
  // Left corner - [15, 2, -4]cm (base ≈ -15°)
  {
    id: 'verified-cube-left-corner-1',
    timestamp: 0,
    objectPosition: [0.15, 0.02, -0.04],
    objectType: 'cube',
    objectName: 'Left Corner Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: -15, shoulder: -50, elbow: 28, wrist: 48, wristRoll: 90, gripper: 100 },
      { base: -15, shoulder: -20, elbow: 48, wrist: 65, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: -15, shoulder: -50, elbow: 28, wrist: 48, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cube in the left corner',
    success: true,
  },
  // Right corner - [15, 2, 4]cm (base ≈ +15°)
  {
    id: 'verified-cube-right-corner-1',
    timestamp: 0,
    objectPosition: [0.15, 0.02, 0.04],
    objectType: 'cube',
    objectName: 'Right Corner Cube',
    objectScale: 0.03,
    jointSequence: [
      { base: 15, shoulder: -50, elbow: 28, wrist: 48, wristRoll: 90, gripper: 100 },
      { base: 15, shoulder: -20, elbow: 48, wrist: 65, wristRoll: 90, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: 15, shoulder: -50, elbow: 28, wrist: 48, wristRoll: 90, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cube in the right corner',
    success: true,
  },
  // ========================================
  // CYLINDER EXAMPLES (horizontal grasp with wristRoll=0)
  // ========================================
  // Cylinders require horizontal finger orientation (wristRoll=0) and
  // side approach to properly grasp the curved surface.
  {
    id: 'verified-cylinder-center-1',
    timestamp: 0,
    objectPosition: [0.17, 0.02, 0.00],
    objectType: 'cylinder',
    objectName: 'Center Cylinder',
    objectScale: 0.03,
    jointSequence: [
      // Side approach - fingers horizontal
      { base: 0, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 100 },
      // Grasp position - target 1/3 up from bottom
      { base: 0, shoulder: -25, elbow: 55, wrist: 55, wristRoll: 0, gripper: 100 },
      // Close gripper
      { gripper: 0, _gripperOnly: true },
      // Lift
      { base: 0, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cylinder',
    success: true,
  },
  {
    id: 'verified-cylinder-left-1',
    timestamp: 0,
    objectPosition: [0.16, 0.02, -0.03],
    objectType: 'cylinder',
    objectName: 'Left Cylinder',
    objectScale: 0.03,
    jointSequence: [
      { base: -11, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 100 },
      { base: -11, shoulder: -25, elbow: 55, wrist: 55, wristRoll: 0, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: -11, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cylinder on the left',
    success: true,
  },
  {
    id: 'verified-cylinder-right-1',
    timestamp: 0,
    objectPosition: [0.16, 0.02, 0.03],
    objectType: 'cylinder',
    objectName: 'Right Cylinder',
    objectScale: 0.03,
    jointSequence: [
      { base: 11, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 100 },
      { base: 11, shoulder: -25, elbow: 55, wrist: 55, wristRoll: 0, gripper: 100 },
      { gripper: 0, _gripperOnly: true },
      { base: 11, shoulder: -45, elbow: 35, wrist: 40, wristRoll: 0, gripper: 0 },
    ],
    ikErrors: { approach: 0.01, grasp: 0.01, lift: 0.01 },
    userMessage: 'pick up the cylinder on the right',
    success: true,
  },
];

// ========================================
// LOCALSTORAGE PERSISTENCE
// ========================================
const STORAGE_KEY = 'robosim_verified_pickups';

/**
 * Load promoted examples from localStorage with validation
 */
function loadPromotedExamples(): PickupExample[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);

    // Validate that parsed data is an array
    if (!Array.isArray(parsed)) {
      log.warn('localStorage data is not an array, clearing');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    // Filter to only valid examples
    const validExamples = parsed.filter((item: unknown) => {
      const isValid = isValidPickupExample(item);
      if (!isValid) {
        log.warn(`Invalid pickup example in localStorage, skipping: ${JSON.stringify(item).slice(0, 100)}...`);
      }
      return isValid;
    });

    log.info(`Loaded ${validExamples.length} promoted examples from localStorage (${parsed.length - validExamples.length} invalid)`);
    return validExamples;
  } catch (error) {
    log.warn(`Failed to load promoted examples from localStorage: ${error}`);
    // Clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    return [];
  }
}

/**
 * Save promoted examples to localStorage
 */
function savePromotedExamples(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(promotedExamples));
    log.debug(`Saved ${promotedExamples.length} promoted examples to localStorage`);
  } catch (error) {
    log.warn(`Failed to save promoted examples to localStorage: ${error}`);
  }
}

/**
 * Initialize the examples store with verified pickups
 * Loads additional promoted examples from localStorage
 */
export function initializePickupExamples(): void {
  // Load promoted examples from localStorage
  promotedExamples = loadPromotedExamples();

  // Start with base verified examples plus promoted ones
  pickupExamples = [...VERIFIED_PICKUPS, ...promotedExamples];

  log.info(`Initialized with ${VERIFIED_PICKUPS.length} base + ${promotedExamples.length} promoted = ${pickupExamples.length} total examples`);
}

/**
 * Get all verified examples (base + promoted)
 */
export function getAllVerifiedExamples(): PickupExample[] {
  return [...VERIFIED_PICKUPS, ...promotedExamples];
}

/**
 * Clear all promoted examples from localStorage
 */
export function clearPromotedExamples(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
      promotedExamples = [];
      pickupExamples = [...VERIFIED_PICKUPS];
      log.info('Cleared all promoted examples');
    }
  } catch (error) {
    log.warn(`Failed to clear promoted examples: ${error}`);
  }
}

/**
 * Log a pickup attempt (before we know if it succeeded)
 */
export function logPickupAttempt(attempt: PickupAttempt): string {
  const id = `pickup-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

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
 * Mark a pickup as successful and generate language variants
 */
export function markPickupSuccess(id: string): void {
  const example = pickupExamples.find(e => e.id === id);
  if (example) {
    example.success = true;

    // Generate language variants for training data augmentation
    example.languageVariants = generateLanguageVariants('pick', example.objectName, undefined, 20);

    log.info(`Pickup ${id} succeeded - "${example.objectName}" at [${example.objectPosition.map(p => (p*100).toFixed(1)).join(', ')}]cm`);
    log.debug(`Generated ${example.languageVariants.length} language variants for training`);
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

// ========================================
// ACTIVE LEARNING - Auto-promote successful pickups
// ========================================

// Minimum distance from existing verified examples to consider "novel"
const NOVELTY_DISTANCE_THRESHOLD = 0.05; // 5cm
// Maximum IK error for a pickup to be promoted
const PROMOTION_IK_THRESHOLD = 0.015; // 1.5cm

/**
 * Attempt to promote a successful pickup to verified status
 * Returns true if promoted, false if not eligible
 */
export function promoteToVerified(id: string): boolean {
  const example = pickupExamples.find(e => e.id === id);

  if (!example) {
    log.warn(`Cannot promote ${id}: not found`);
    return false;
  }

  if (!example.success) {
    log.debug(`Cannot promote ${id}: not successful`);
    return false;
  }

  // Check IK quality - only promote high-confidence pickups
  const maxError = Math.max(
    example.ikErrors.approach,
    example.ikErrors.grasp,
    example.ikErrors.lift
  );

  if (maxError > PROMOTION_IK_THRESHOLD) {
    log.debug(`Cannot promote ${id}: IK error ${(maxError * 100).toFixed(1)}cm exceeds threshold`);
    return false;
  }

  // Check novelty - is this position sufficiently different from existing verified examples?
  const allVerified = getAllVerifiedExamples();
  const isDuplicate = allVerified.some(verified => {
    const dist = positionDistance(verified.objectPosition, example.objectPosition);
    return verified.objectType === example.objectType && dist < NOVELTY_DISTANCE_THRESHOLD;
  });

  if (isDuplicate) {
    log.debug(`Cannot promote ${id}: too close to existing verified example`);
    return false;
  }

  // Promote to verified!
  const promotedExample: PickupExample = {
    ...example,
    id: `promoted-${example.id}`,
    timestamp: Date.now(),
  };

  promotedExamples.push(promotedExample);
  pickupExamples = [...VERIFIED_PICKUPS, ...promotedExamples];

  // Persist to localStorage
  savePromotedExamples();

  log.info(
    `Promoted pickup ${id} to verified! ` +
    `Position: [${example.objectPosition.map(p => (p * 100).toFixed(1)).join(', ')}]cm, ` +
    `Type: ${example.objectType}, ` +
    `Total verified: ${allVerified.length + 1}`
  );

  return true;
}

/**
 * Get count of verified examples by type
 */
export function getVerifiedCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const example of getAllVerifiedExamples()) {
    counts[example.objectType] = (counts[example.objectType] || 0) + 1;
  }
  return counts;
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
 * Calculate Euclidean distance between two positions
 */
export function positionDistance(
  pos1: [number, number, number],
  pos2: [number, number, number]
): number {
  return Math.sqrt(
    (pos1[0] - pos2[0]) ** 2 +
    (pos1[1] - pos2[1]) ** 2 +
    (pos1[2] - pos2[2]) ** 2
  );
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
    const distance = positionDistance(example.objectPosition, position);
    // Lower distance = better score (invert and scale)
    const distanceScore = Math.max(0, 1 - distance / 0.3); // 30cm = 0 score

    return {
      example,
      score: typeMatch * 2 + distanceScore,
      distance,
    };
  });

  // Sort by score descending and return top N
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.example);
}

/**
 * Find the closest verified pickup example within a distance threshold
 * Used for demo zone matching - returns null if no example is close enough
 */
export function findClosestVerifiedPickup(
  objectType: string,
  position: [number, number, number],
  maxDistance: number = 0.03  // 3cm default threshold
): { example: PickupExample; distance: number } | null {
  // Only search verified examples (base + promoted, not runtime attempts)
  const verified = getAllVerifiedExamples().filter(e => e.objectType === objectType);

  let closest: { example: PickupExample; distance: number } | null = null;

  for (const example of verified) {
    const dist = positionDistance(example.objectPosition, position);
    if (dist <= maxDistance && (!closest || dist < closest.distance)) {
      closest = { example, distance: dist };
    }
  }

  return closest;
}

/**
 * Adapt a verified example's joint sequence for a new base angle
 * Keeps the same arm configuration but rotates the base
 */
export function adaptVerifiedSequence(
  example: PickupExample,
  newBaseAngle: number
): Partial<import('../types').JointState>[] {
  return example.jointSequence.map(step => {
    // If this step only has gripper, keep it as-is
    if (Object.keys(step).length <= 2 && 'gripper' in step) {
      return { ...step };
    }
    // Otherwise, update the base angle
    return { ...step, base: newBaseAngle };
  });
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
