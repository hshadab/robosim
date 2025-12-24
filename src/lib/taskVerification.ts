/**
 * Task Verification System
 *
 * Detects whether manipulation tasks succeeded by comparing
 * object positions before and after the action.
 */

import type { SimObject, TargetZone } from '../types';
import { loggers } from './logger';

const log = loggers.simulation;

export interface TaskSnapshot {
  timestamp: number;
  objects: ObjectSnapshot[];
  gripperPosition: [number, number, number];
  gripperClosed: boolean;
}

export interface ObjectSnapshot {
  id: string;
  name?: string;
  position: [number, number, number];
  isGrabbed: boolean;
  isInTargetZone: boolean;
}

export interface TaskVerificationResult {
  success: boolean;
  confidence: number; // 0-1
  details: {
    objectMoved: boolean;
    objectPickedUp: boolean;
    objectPlaced: boolean;
    objectInTargetZone: boolean;
    movementDistance: number;
    heightChange: number;
  };
  failureReason?: string;
}

// Thresholds for task verification
const MOVEMENT_THRESHOLD = 0.02; // 2cm minimum movement to count as "moved"
const PICKUP_HEIGHT_THRESHOLD = 0.03; // 3cm height increase to count as "picked up"
const TARGET_ZONE_TOLERANCE = 0.05; // 5cm tolerance for target zone

/**
 * Create a snapshot of the current task state
 */
export function createTaskSnapshot(
  objects: SimObject[],
  gripperPosition: [number, number, number],
  gripperValue: number
): TaskSnapshot {
  return {
    timestamp: Date.now(),
    objects: objects.map(obj => ({
      id: obj.id,
      name: obj.name,
      position: [...obj.position] as [number, number, number],
      isGrabbed: obj.isGrabbed,
      isInTargetZone: obj.isInTargetZone,
    })),
    gripperPosition: [...gripperPosition] as [number, number, number],
    gripperClosed: gripperValue < 50,
  };
}

/**
 * Verify if a pick-and-place task succeeded
 */
export function verifyPickPlaceTask(
  beforeSnapshot: TaskSnapshot,
  afterSnapshot: TaskSnapshot,
  targetObjectId?: string,
  targetZone?: TargetZone
): TaskVerificationResult {
  // Find the target object (or the first grabbable object that moved)
  let targetBefore: ObjectSnapshot | undefined;
  let targetAfter: ObjectSnapshot | undefined;

  if (targetObjectId) {
    targetBefore = beforeSnapshot.objects.find(o => o.id === targetObjectId);
    targetAfter = afterSnapshot.objects.find(o => o.id === targetObjectId);
  } else {
    // Find the object that moved the most
    let maxMovement = 0;
    for (const beforeObj of beforeSnapshot.objects) {
      const afterObj = afterSnapshot.objects.find(o => o.id === beforeObj.id);
      if (afterObj) {
        const distance = calculateDistance(beforeObj.position, afterObj.position);
        if (distance > maxMovement) {
          maxMovement = distance;
          targetBefore = beforeObj;
          targetAfter = afterObj;
        }
      }
    }
  }

  if (!targetBefore || !targetAfter) {
    return {
      success: false,
      confidence: 0,
      details: {
        objectMoved: false,
        objectPickedUp: false,
        objectPlaced: false,
        objectInTargetZone: false,
        movementDistance: 0,
        heightChange: 0,
      },
      failureReason: 'Target object not found',
    };
  }

  const movementDistance = calculateDistance(targetBefore.position, targetAfter.position);
  const heightChange = targetAfter.position[1] - targetBefore.position[1];

  const objectMoved = movementDistance > MOVEMENT_THRESHOLD;
  const objectPickedUp = heightChange > PICKUP_HEIGHT_THRESHOLD || targetAfter.isGrabbed;
  const objectPlaced = !targetAfter.isGrabbed && objectMoved;
  const objectInTargetZone = targetZone
    ? isInZone(targetAfter.position, targetZone.position, targetZone.size)
    : targetAfter.isInTargetZone;

  // Calculate confidence based on multiple factors
  let confidence = 0;
  if (objectMoved) confidence += 0.25;
  if (objectPickedUp) confidence += 0.25;
  if (objectPlaced) confidence += 0.25;
  if (objectInTargetZone) confidence += 0.25;

  const success = objectMoved && objectPickedUp && objectPlaced;

  let failureReason: string | undefined;
  if (!success) {
    if (!objectMoved) {
      failureReason = 'Object did not move significantly';
    } else if (!objectPickedUp) {
      failureReason = 'Object was not picked up (no height change detected)';
    } else if (!objectPlaced) {
      failureReason = 'Object was not released';
    }
  }

  log.debug('Task verification result', {
    success,
    confidence,
    objectMoved,
    objectPickedUp,
    objectPlaced,
    objectInTargetZone,
    movementDistance: movementDistance.toFixed(3),
    heightChange: heightChange.toFixed(3),
  });

  return {
    success,
    confidence,
    details: {
      objectMoved,
      objectPickedUp,
      objectPlaced,
      objectInTargetZone,
      movementDistance,
      heightChange,
    },
    failureReason,
  };
}

/**
 * Verify if a stacking task succeeded
 */
export function verifyStackTask(
  beforeSnapshot: TaskSnapshot,
  afterSnapshot: TaskSnapshot,
  stackedObjectId: string,
  baseObjectId: string
): TaskVerificationResult {
  const stackedBefore = beforeSnapshot.objects.find(o => o.id === stackedObjectId);
  const stackedAfter = afterSnapshot.objects.find(o => o.id === stackedObjectId);
  const baseBefore = beforeSnapshot.objects.find(o => o.id === baseObjectId);
  const baseAfter = afterSnapshot.objects.find(o => o.id === baseObjectId);

  if (!stackedBefore || !stackedAfter || !baseBefore || !baseAfter) {
    return {
      success: false,
      confidence: 0,
      details: {
        objectMoved: false,
        objectPickedUp: false,
        objectPlaced: false,
        objectInTargetZone: false,
        movementDistance: 0,
        heightChange: 0,
      },
      failureReason: 'Objects not found',
    };
  }

  const movementDistance = calculateDistance(stackedBefore.position, stackedAfter.position);
  const heightChange = stackedAfter.position[1] - stackedBefore.position[1];

  // Check if stacked object is now above the base object
  const horizontalDistance = Math.sqrt(
    Math.pow(stackedAfter.position[0] - baseAfter.position[0], 2) +
    Math.pow(stackedAfter.position[2] - baseAfter.position[2], 2)
  );
  const isStacked = horizontalDistance < 0.05 && stackedAfter.position[1] > baseAfter.position[1];

  const objectMoved = movementDistance > MOVEMENT_THRESHOLD;
  const objectPickedUp = heightChange > PICKUP_HEIGHT_THRESHOLD;
  const objectPlaced = !stackedAfter.isGrabbed;

  let confidence = 0;
  if (objectMoved) confidence += 0.2;
  if (objectPickedUp) confidence += 0.2;
  if (objectPlaced) confidence += 0.2;
  if (isStacked) confidence += 0.4;

  const success = objectMoved && objectPlaced && isStacked;

  return {
    success,
    confidence,
    details: {
      objectMoved,
      objectPickedUp,
      objectPlaced,
      objectInTargetZone: isStacked,
      movementDistance,
      heightChange,
    },
    failureReason: success ? undefined : 'Object not properly stacked',
  };
}

/**
 * Calculate 3D distance between two points
 */
function calculateDistance(
  p1: [number, number, number],
  p2: [number, number, number]
): number {
  return Math.sqrt(
    Math.pow(p2[0] - p1[0], 2) +
    Math.pow(p2[1] - p1[1], 2) +
    Math.pow(p2[2] - p1[2], 2)
  );
}

/**
 * Check if a position is within a target zone
 */
function isInZone(
  position: [number, number, number],
  zoneCenter: [number, number, number],
  zoneSize: [number, number, number]
): boolean {
  return (
    Math.abs(position[0] - zoneCenter[0]) < zoneSize[0] / 2 + TARGET_ZONE_TOLERANCE &&
    Math.abs(position[2] - zoneCenter[2]) < zoneSize[2] / 2 + TARGET_ZONE_TOLERANCE
  );
}

/**
 * Auto-detect task type from command
 */
export function detectTaskType(
  command: string
): 'pick_place' | 'stack' | 'push' | 'unknown' {
  const lower = command.toLowerCase();

  if (lower.includes('stack') || lower.includes('on top')) {
    return 'stack';
  }
  if (lower.includes('push') || lower.includes('slide')) {
    return 'push';
  }
  if (
    lower.includes('pick') ||
    lower.includes('grab') ||
    lower.includes('place') ||
    lower.includes('put') ||
    lower.includes('move')
  ) {
    return 'pick_place';
  }

  return 'unknown';
}
