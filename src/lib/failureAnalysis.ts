/**
 * Structured Failure Analysis System
 *
 * Provides categorized failure types for pickup attempts,
 * enabling better learning and prompt enhancement.
 */

import { createLogger } from './logger';

const log = createLogger('FailureAnalysis');

/**
 * Failure categories for pickup attempts
 */
export type FailureCategory =
  | 'ik_unreachable'      // IK error > threshold, can't reach position
  | 'grasp_missed'        // Gripper closed but no contact detected
  | 'object_slipped'      // Had contact but lost it during lift
  | 'collision_detected'  // Hit table or obstacle
  | 'timeout'             // Animation/physics took too long
  | 'physics_unstable'    // Object flew away or physics glitched
  | 'gripper_timing'      // Gripper closed too fast for physics
  | 'approach_failed'     // Failed to reach approach position
  | 'unknown';            // Unclassified failure

/**
 * Structured failure information
 */
export interface StructuredFailure {
  category: FailureCategory;
  details: {
    ikError?: number;           // IK positioning error in meters
    graspDistance?: number;     // Distance from gripper to object at grasp
    contactDuration?: number;   // How long contact was maintained (ms)
    collisionPoint?: [number, number, number];  // Where collision occurred
    physicsState?: string;      // Physics engine state at failure
    gripperCloseDuration?: number;  // How long gripper close took
  };
  suggestedFix: string;         // Actionable suggestion for LLM
  timestamp: number;
}

/**
 * Recent failures storage for prompt enhancement
 */
interface RecentFailure {
  position: [number, number, number];
  objectType: string;
  failure: StructuredFailure;
}

// Store recent failures for learning (max 10)
const recentFailures: RecentFailure[] = [];
const MAX_RECENT_FAILURES = 10;

/**
 * Thresholds for failure classification
 */
export const FAILURE_THRESHOLDS = {
  IK_ERROR_MAX: 0.04,           // 4cm - beyond this, IK is unreachable
  GRASP_DISTANCE_MAX: 0.04,     // 4cm - gripper grab radius
  GRIPPER_CLOSE_MIN_MS: 800,    // Minimum gripper close time for physics
  CONTACT_DURATION_MIN_MS: 100, // Minimum contact to consider "had contact"
  LIFT_HEIGHT_MIN: 0.02,        // 2cm - minimum lift to consider successful
};

/**
 * Failure category descriptions and suggested fixes
 */
export const FAILURE_CATEGORIES: Record<FailureCategory, { description: string; suggestedFix: string }> = {
  ik_unreachable: {
    description: 'Position is outside robot workspace',
    suggestedFix: 'Try positions closer to robot base (X: 0.12-0.18m)',
  },
  grasp_missed: {
    description: 'Gripper closed but missed the object',
    suggestedFix: 'Adjust approach to get gripper closer to object center',
  },
  object_slipped: {
    description: 'Object was grasped but slipped during lift',
    suggestedFix: 'Close gripper more firmly and lift more slowly',
  },
  collision_detected: {
    description: 'Robot collided with table or obstacle',
    suggestedFix: 'Use higher approach position to avoid collision',
  },
  timeout: {
    description: 'Operation took too long',
    suggestedFix: 'Simplify motion sequence or reduce animation duration',
  },
  physics_unstable: {
    description: 'Physics simulation became unstable',
    suggestedFix: 'Move more slowly and avoid sudden movements',
  },
  gripper_timing: {
    description: 'Gripper closed too fast for physics detection',
    suggestedFix: 'Use _duration: 800 or higher for gripper close',
  },
  approach_failed: {
    description: 'Could not reach approach position',
    suggestedFix: 'Use different base angle or higher approach height',
  },
  unknown: {
    description: 'Unclassified failure',
    suggestedFix: 'Check object position and try different approach',
  },
};

/**
 * Analyze a failed pickup attempt and categorize the failure
 */
export function analyzeFailure(params: {
  ikError?: number;
  graspDistance?: number;
  hadContact?: boolean;
  lostContact?: boolean;
  gripperCloseDuration?: number;
  objectFlewAway?: boolean;
  hitObstacle?: boolean;
  timedOut?: boolean;
  objectPosition?: [number, number, number];
  finalObjectPosition?: [number, number, number];
}): StructuredFailure {
  const {
    ikError,
    graspDistance,
    hadContact,
    lostContact,
    gripperCloseDuration,
    objectFlewAway,
    hitObstacle,
    timedOut,
    objectPosition,
    finalObjectPosition,
  } = params;

  // Priority order for classification

  // 1. Timeout
  if (timedOut) {
    return {
      category: 'timeout',
      details: {},
      suggestedFix: 'Reduce animation duration or simplify the motion sequence.',
      timestamp: Date.now(),
    };
  }

  // 2. Physics instability
  if (objectFlewAway) {
    const distance = objectPosition && finalObjectPosition
      ? Math.sqrt(
          (objectPosition[0] - finalObjectPosition[0]) ** 2 +
          (objectPosition[1] - finalObjectPosition[1]) ** 2 +
          (objectPosition[2] - finalObjectPosition[2]) ** 2
        )
      : undefined;

    return {
      category: 'physics_unstable',
      details: { physicsState: distance ? `Object moved ${(distance * 100).toFixed(1)}cm` : 'Object position unstable' },
      suggestedFix: 'Approach more slowly. Use gentler gripper close. Avoid sudden movements.',
      timestamp: Date.now(),
    };
  }

  // 3. Collision
  if (hitObstacle) {
    return {
      category: 'collision_detected',
      details: {},
      suggestedFix: 'Use higher approach position. Avoid table collision by keeping wrist angle above 0.',
      timestamp: Date.now(),
    };
  }

  // 4. Gripper timing issue
  if (gripperCloseDuration !== undefined && gripperCloseDuration < FAILURE_THRESHOLDS.GRIPPER_CLOSE_MIN_MS) {
    return {
      category: 'gripper_timing',
      details: { gripperCloseDuration },
      suggestedFix: `Gripper closed in ${gripperCloseDuration}ms - needs ${FAILURE_THRESHOLDS.GRIPPER_CLOSE_MIN_MS}ms minimum. Use { _gripperOnly: true, _duration: 800 }.`,
      timestamp: Date.now(),
    };
  }

  // 5. IK unreachable
  if (ikError !== undefined && ikError > FAILURE_THRESHOLDS.IK_ERROR_MAX) {
    return {
      category: 'ik_unreachable',
      details: { ikError },
      suggestedFix: `Position has ${(ikError * 100).toFixed(1)}cm IK error. Try different base angle or check if position is in reachable workspace.`,
      timestamp: Date.now(),
    };
  }

  // 6. Object slipped (had contact but lost it)
  if (hadContact && lostContact) {
    return {
      category: 'object_slipped',
      details: { contactDuration: params.hadContact ? 100 : 0 },
      suggestedFix: 'Object slipped during lift. Close gripper more firmly. Lift more slowly. Check object is centered between fingers.',
      timestamp: Date.now(),
    };
  }

  // 7. Grasp missed (no contact)
  if (graspDistance !== undefined && graspDistance > FAILURE_THRESHOLDS.GRASP_DISTANCE_MAX) {
    return {
      category: 'grasp_missed',
      details: { graspDistance },
      suggestedFix: `Gripper was ${(graspDistance * 100).toFixed(1)}cm from object. Adjust shoulder/elbow to get closer. The grab radius is only 4cm.`,
      timestamp: Date.now(),
    };
  }

  // 8. Approach failed
  if (ikError !== undefined && ikError > FAILURE_THRESHOLDS.IK_ERROR_MAX * 0.75) {
    return {
      category: 'approach_failed',
      details: { ikError },
      suggestedFix: `Approach position has ${(ikError * 100).toFixed(1)}cm error. Use higher approach height or different base angle.`,
      timestamp: Date.now(),
    };
  }

  // 9. Unknown
  return {
    category: 'unknown',
    details: { ikError, graspDistance },
    suggestedFix: 'Check object position and try a different approach angle.',
    timestamp: Date.now(),
  };
}

/**
 * Record a failure for learning
 */
export function recordFailure(
  position: [number, number, number],
  objectType: string,
  failure: StructuredFailure
): void {
  recentFailures.push({ position, objectType, failure });

  // Keep only recent failures
  while (recentFailures.length > MAX_RECENT_FAILURES) {
    recentFailures.shift();
  }

  log.info(`Recorded ${failure.category} failure at [${position.map(p => (p*100).toFixed(1)).join(', ')}]cm: ${failure.suggestedFix}`);
}

/**
 * Get recent failures for prompt enhancement
 */
export function getRecentFailures(limit: number = 3): RecentFailure[] {
  return recentFailures.slice(-limit);
}

/**
 * Clear all recent failures
 */
export function clearRecentFailures(): void {
  recentFailures.length = 0;
}

/**
 * Get failure statistics
 */
export function getFailureStats(): Record<FailureCategory, number> {
  const stats: Record<FailureCategory, number> = {
    ik_unreachable: 0,
    grasp_missed: 0,
    object_slipped: 0,
    collision_detected: 0,
    timeout: 0,
    physics_unstable: 0,
    gripper_timing: 0,
    approach_failed: 0,
    unknown: 0,
  };

  for (const { failure } of recentFailures) {
    stats[failure.category]++;
  }

  return stats;
}

/**
 * Generate failure context for LLM prompt
 */
export function generateFailureContext(): string {
  const failures = getRecentFailures(3);

  if (failures.length === 0) {
    return '';
  }

  const lines = failures.map(({ position, objectType, failure }) => {
    const pos = position.map(p => (p * 100).toFixed(1)).join(', ');
    return `- ${objectType} at [${pos}]cm: ${failure.category} - ${failure.suggestedFix}`;
  });

  return `
# RECENT FAILURES (avoid these patterns)
${lines.join('\n')}
`;
}

/**
 * Check if a position has recently failed
 */
export function hasRecentFailure(
  position: [number, number, number],
  maxDistance: number = 0.03  // 3cm
): RecentFailure | null {
  for (const failure of recentFailures) {
    const dist = Math.sqrt(
      (failure.position[0] - position[0]) ** 2 +
      (failure.position[1] - position[1]) ** 2 +
      (failure.position[2] - position[2]) ** 2
    );
    if (dist <= maxDistance) {
      return failure;
    }
  }
  return null;
}

/**
 * Get suggested adjustments based on failure history
 */
export function getSuggestedAdjustments(
  position: [number, number, number],
  objectType: string
): string[] {
  const suggestions: string[] = [];
  const stats = getFailureStats();

  // If many IK failures, suggest different approach
  if (stats.ik_unreachable >= 2) {
    suggestions.push('Try positions closer to the robot base (X: 0.12-0.18m)');
  }

  // If many grasp misses, suggest better alignment
  if (stats.grasp_missed >= 2) {
    suggestions.push('Ensure gripper is directly above object before closing');
    suggestions.push('Use lower approach to get closer to object');
  }

  // If objects slipping, suggest slower motion
  if (stats.object_slipped >= 1) {
    suggestions.push('Lift more slowly after grasping');
    suggestions.push('Wait longer after gripper close before lifting');
  }

  // If gripper timing issues
  if (stats.gripper_timing >= 1) {
    suggestions.push('Always use _duration: 800 for gripper close steps');
  }

  return suggestions;
}

/**
 * Convert legacy string failure reason to structured failure
 */
export function parseFailureReason(reason: string): StructuredFailure {
  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes('no object grabbed') || lowerReason.includes('not grabbed')) {
    return analyzeFailure({ hadContact: false, graspDistance: 0.05 });
  }

  if (lowerReason.includes('slipped') || lowerReason.includes('dropped')) {
    return analyzeFailure({ hadContact: true, lostContact: true });
  }

  if (lowerReason.includes('unreachable') || lowerReason.includes('ik error')) {
    return analyzeFailure({ ikError: 0.05 });
  }

  if (lowerReason.includes('collision') || lowerReason.includes('hit')) {
    return analyzeFailure({ hitObstacle: true });
  }

  if (lowerReason.includes('timeout')) {
    return analyzeFailure({ timedOut: true });
  }

  return analyzeFailure({});
}
