/**
 * Gripper Force Feedback System
 *
 * Provides real-time feedback about gripper state, contact forces,
 * and object stability during manipulation.
 */

import { createLogger } from './logger';

const log = createLogger('GripperFeedback');

/**
 * Gripper state information
 */
export interface GripperState {
  position: number;           // 0-100 (0=closed, 100=open)
  velocity: number;           // deg/s of gripper movement
  isMoving: boolean;          // Whether gripper is currently moving
  targetPosition: number;     // Target position being moved to
}

/**
 * Contact information
 */
export interface ContactInfo {
  isContacting: boolean;      // Whether gripper is touching an object
  contactForce: number;       // 0-1 normalized force
  contactDuration: number;    // How long contact has been maintained (ms)
  objectId: string | null;    // ID of contacted object
  contactPoints: number;      // Number of contact points (0, 1, or 2 for both fingers)
}

/**
 * Stability assessment
 */
export interface StabilityInfo {
  isStable: boolean;          // Whether grasp is stable
  slipRisk: number;           // 0-1 risk of object slipping
  graspQuality: number;       // 0-1 overall grasp quality
  suggestedAction: GripperAction | null;  // Suggested corrective action
}

export type GripperAction =
  | 'close_more'      // Increase grip force
  | 'open_slightly'   // Release pressure
  | 'regrasp'         // Release and try again
  | 'adjust_position' // Move gripper for better grasp
  | 'hold_steady';    // Maintain current state

/**
 * Complete gripper feedback
 */
export interface GripperFeedback {
  state: GripperState;
  contact: ContactInfo;
  stability: StabilityInfo;
  timestamp: number;
}

// ============================================================================
// Feedback State Management
// ============================================================================

let currentFeedback: GripperFeedback = {
  state: {
    position: 100,
    velocity: 0,
    isMoving: false,
    targetPosition: 100,
  },
  contact: {
    isContacting: false,
    contactForce: 0,
    contactDuration: 0,
    objectId: null,
    contactPoints: 0,
  },
  stability: {
    isStable: false,
    slipRisk: 0,
    graspQuality: 0,
    suggestedAction: null,
  },
  timestamp: Date.now(),
};

let contactStartTime: number | null = null;
let previousForce = 0;
let forceHistory: number[] = [];

// Callback for feedback updates
type FeedbackCallback = (feedback: GripperFeedback) => void;
const feedbackCallbacks: FeedbackCallback[] = [];

/**
 * Subscribe to gripper feedback updates
 */
export function subscribeFeedback(callback: FeedbackCallback): () => void {
  feedbackCallbacks.push(callback);
  return () => {
    const index = feedbackCallbacks.indexOf(callback);
    if (index >= 0) feedbackCallbacks.splice(index, 1);
  };
}

/**
 * Notify all subscribers of feedback update
 */
function notifyFeedbackUpdate(): void {
  for (const callback of feedbackCallbacks) {
    callback(currentFeedback);
  }
}

// ============================================================================
// State Updates
// ============================================================================

/**
 * Update gripper position state
 */
export function updateGripperState(
  position: number,
  targetPosition: number,
  isMoving: boolean
): void {
  const previousPosition = currentFeedback.state.position;
  const dt = (Date.now() - currentFeedback.timestamp) / 1000;

  currentFeedback.state = {
    position,
    velocity: dt > 0 ? Math.abs(position - previousPosition) / dt : 0,
    isMoving,
    targetPosition,
  };
  currentFeedback.timestamp = Date.now();

  notifyFeedbackUpdate();
}

/**
 * Update contact information from physics simulation
 */
export function updateContactInfo(
  isContacting: boolean,
  contactForce: number,
  objectId: string | null,
  contactPoints: number = 0
): void {
  // Track contact duration
  if (isContacting && !currentFeedback.contact.isContacting) {
    contactStartTime = Date.now();
  } else if (!isContacting) {
    contactStartTime = null;
  }

  const contactDuration = contactStartTime
    ? Date.now() - contactStartTime
    : 0;

  // Update force history for slip detection
  forceHistory.push(contactForce);
  if (forceHistory.length > 10) {
    forceHistory.shift();
  }

  currentFeedback.contact = {
    isContacting,
    contactForce,
    contactDuration,
    objectId,
    contactPoints,
  };

  // Recalculate stability
  updateStability();

  previousForce = contactForce;
  currentFeedback.timestamp = Date.now();

  notifyFeedbackUpdate();
}

/**
 * Calculate and update stability assessment
 */
function updateStability(): void {
  const { contact, state } = currentFeedback;

  // No stability if no contact
  if (!contact.isContacting) {
    currentFeedback.stability = {
      isStable: false,
      slipRisk: 0,
      graspQuality: 0,
      suggestedAction: null,
    };
    return;
  }

  // Calculate slip risk based on force history
  let slipRisk = 0;
  if (forceHistory.length >= 3) {
    // Check for decreasing force trend (potential slip)
    const recentForces = forceHistory.slice(-3);
    const avgRecent = recentForces.reduce((a, b) => a + b, 0) / recentForces.length;
    const olderForces = forceHistory.slice(0, -3);
    if (olderForces.length > 0) {
      const avgOlder = olderForces.reduce((a, b) => a + b, 0) / olderForces.length;
      if (avgRecent < avgOlder * 0.8) {
        slipRisk = (avgOlder - avgRecent) / avgOlder;
      }
    }

    // Check for force oscillation (unstable grasp)
    const forceVariance = recentForces.reduce((sum, f) =>
      sum + (f - avgRecent) ** 2, 0) / recentForces.length;
    if (forceVariance > 0.01) {
      slipRisk = Math.max(slipRisk, Math.sqrt(forceVariance) * 2);
    }
  }

  // Calculate grasp quality
  let graspQuality = 0;

  // Factor 1: Contact force (optimal around 0.5-0.8)
  const forceScore = contact.contactForce > 0.3 && contact.contactForce < 0.9
    ? 1 - Math.abs(contact.contactForce - 0.6) * 2
    : contact.contactForce * 0.5;

  // Factor 2: Contact points (2 is ideal)
  const pointsScore = contact.contactPoints === 2 ? 1 : contact.contactPoints * 0.4;

  // Factor 3: Contact duration (longer is better, up to 500ms)
  const durationScore = Math.min(1, contact.contactDuration / 500);

  // Factor 4: Gripper position (closed enough but not crushing)
  const positionScore = state.position < 30 ? 1 - state.position / 100 : 0.3;

  graspQuality = (forceScore * 0.3 + pointsScore * 0.3 + durationScore * 0.2 + positionScore * 0.2);

  // Determine stability
  const isStable = graspQuality > 0.5 && slipRisk < 0.3 && contact.contactDuration > 200;

  // Suggest corrective action
  let suggestedAction: GripperAction | null = null;
  if (!isStable) {
    if (slipRisk > 0.5) {
      suggestedAction = 'close_more';
    } else if (contact.contactForce > 0.9) {
      suggestedAction = 'open_slightly';
    } else if (contact.contactPoints < 2) {
      suggestedAction = 'adjust_position';
    } else if (graspQuality < 0.3) {
      suggestedAction = 'regrasp';
    } else {
      suggestedAction = 'hold_steady';
    }
  }

  currentFeedback.stability = {
    isStable,
    slipRisk: Math.min(1, slipRisk),
    graspQuality,
    suggestedAction,
  };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get current gripper feedback
 */
export function getGripperFeedback(): GripperFeedback {
  return { ...currentFeedback };
}

// Alias for backwards compatibility
export const getCurrentFeedback = getGripperFeedback;

/**
 * Check if object is being held securely
 */
export function isHoldingSecurely(): boolean {
  return (
    currentFeedback.contact.isContacting &&
    currentFeedback.stability.isStable &&
    currentFeedback.stability.graspQuality > 0.6
  );
}

/**
 * Check if object is slipping
 */
export function isSlipping(): boolean {
  return (
    currentFeedback.contact.isContacting &&
    currentFeedback.stability.slipRisk > 0.5
  );
}

/**
 * Get suggested grip adjustment
 */
export function getSuggestedAdjustment(): {
  action: GripperAction | null;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
} {
  const { stability, contact } = currentFeedback;

  if (!stability.suggestedAction) {
    return { action: null, reason: 'No adjustment needed', urgency: 'low' };
  }

  let reason = '';
  let urgency: 'low' | 'medium' | 'high' = 'low';

  switch (stability.suggestedAction) {
    case 'close_more':
      reason = 'Object may be slipping, increase grip force';
      urgency = stability.slipRisk > 0.7 ? 'high' : 'medium';
      break;
    case 'open_slightly':
      reason = 'Excessive grip force detected, reduce pressure';
      urgency = 'low';
      break;
    case 'regrasp':
      reason = 'Poor grasp quality, release and reposition';
      urgency = 'medium';
      break;
    case 'adjust_position':
      reason = 'Only partial contact, adjust gripper position';
      urgency = contact.contactPoints === 0 ? 'high' : 'medium';
      break;
    case 'hold_steady':
      reason = 'Maintain current grip';
      urgency = 'low';
      break;
  }

  return { action: stability.suggestedAction, reason, urgency };
}

/**
 * Reset feedback state
 */
export function resetFeedback(): void {
  currentFeedback = {
    state: {
      position: 100,
      velocity: 0,
      isMoving: false,
      targetPosition: 100,
    },
    contact: {
      isContacting: false,
      contactForce: 0,
      contactDuration: 0,
      objectId: null,
      contactPoints: 0,
    },
    stability: {
      isStable: false,
      slipRisk: 0,
      graspQuality: 0,
      suggestedAction: null,
    },
    timestamp: Date.now(),
  };
  contactStartTime = null;
  previousForce = 0;
  forceHistory = [];

  log.debug('Gripper feedback reset');
}

/**
 * Generate feedback summary for LLM context
 */
export function getFeedbackSummary(): string {
  const { state, contact, stability } = currentFeedback;

  if (!contact.isContacting) {
    return `Gripper: ${state.position}% open, no contact`;
  }

  const stabilityText = stability.isStable ? 'stable' : 'unstable';
  const qualityText = stability.graspQuality > 0.7 ? 'good' :
                      stability.graspQuality > 0.4 ? 'moderate' : 'poor';

  let summary = `Gripper: ${state.position}% open, ` +
                `contact force ${(contact.contactForce * 100).toFixed(0)}%, ` +
                `${stabilityText} grasp (${qualityText} quality)`;

  if (stability.suggestedAction && stability.suggestedAction !== 'hold_steady') {
    summary += `. Suggestion: ${stability.suggestedAction.replace('_', ' ')}`;
  }

  return summary;
}
