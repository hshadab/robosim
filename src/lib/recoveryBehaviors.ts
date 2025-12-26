/**
 * Recovery Behaviors Library for Sim-to-Real Transfer
 *
 * Simulates recovery from mistakes during manipulation tasks.
 * All recovery behaviors end in SUCCESS (mistake → correction → successful pickup)
 * This teaches the policy how to recover from common errors.
 */

/**
 * Types of recovery behaviors
 */
export type RecoveryType =
  | 'overshoot'          // Move past target, then correct back
  | 'undershoot'         // Stop short, then continue to target
  | 'miss_and_reapproach' // Miss to the side, open gripper, reapproach
  | 'partial_grasp';     // Grasp slightly off-center, adjust

/**
 * Recovery behavior configuration
 */
export interface RecoveryBehavior {
  type: RecoveryType;
  probability: number;  // 0-1, probability of this behavior occurring
}

/**
 * Motion step in a recovery sequence
 */
export interface RecoveryMotionStep {
  joints: Partial<{
    base: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    wristRoll: number;
    gripper: number;
  }>;
  durationMs: number;
  description: string;
}

/**
 * Recovery sequence result
 */
export interface RecoverySequence {
  type: RecoveryType;
  steps: RecoveryMotionStep[];
  totalDurationMs: number;
}

/**
 * Default recovery behaviors with probabilities
 * Total probability ~40% for any recovery behavior
 */
export const RECOVERY_BEHAVIORS: RecoveryBehavior[] = [
  { type: 'overshoot', probability: 0.12 },
  { type: 'undershoot', probability: 0.12 },
  { type: 'miss_and_reapproach', probability: 0.10 },
  { type: 'partial_grasp', probability: 0.06 },
];

/**
 * Recovery behavior configuration
 */
export interface RecoveryConfig {
  enabled: boolean;
  overallProbability: number;  // Scale all probabilities
  behaviors: RecoveryBehavior[];
}

/**
 * Default recovery configuration
 */
export const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  enabled: true,
  overallProbability: 1.0,
  behaviors: RECOVERY_BEHAVIORS,
};

/**
 * Check if a recovery behavior should be applied
 * Returns the recovery type or null if no recovery
 */
export function shouldApplyRecovery(
  config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG
): RecoveryBehavior | null {
  if (!config.enabled) return null;

  // Roll for each behavior type
  for (const behavior of config.behaviors) {
    const adjustedProbability = behavior.probability * config.overallProbability;
    if (Math.random() < adjustedProbability) {
      return behavior;
    }
  }

  return null;
}

/**
 * Generate recovery sequence based on behavior type
 * All sequences end with successful completion of the original goal
 */
export function generateRecoverySequence(
  behavior: RecoveryBehavior,
  targetJoints: {
    base: number;
    shoulder: number;
    elbow: number;
    wrist: number;
    wristRoll: number;
    gripper: number;
  },
  _phase: 'approach' | 'grasp' | 'lift' = 'grasp'
): RecoverySequence {
  const steps: RecoveryMotionStep[] = [];

  switch (behavior.type) {
    case 'overshoot':
      // Move past target, then correct back
      steps.push({
        joints: {
          shoulder: targetJoints.shoulder - 5,
          elbow: targetJoints.elbow + 5,
        },
        durationMs: 300,
        description: 'Overshoot target',
      });
      steps.push({
        joints: {
          shoulder: targetJoints.shoulder,
          elbow: targetJoints.elbow,
        },
        durationMs: 400,
        description: 'Correct back to target',
      });
      break;

    case 'undershoot':
      // Stop short, pause, then continue
      steps.push({
        joints: {
          shoulder: targetJoints.shoulder + 3,
          elbow: targetJoints.elbow - 3,
        },
        durationMs: 300,
        description: 'Stop short of target',
      });
      // Brief pause (no movement)
      steps.push({
        joints: {},
        durationMs: 200,
        description: 'Pause to assess',
      });
      steps.push({
        joints: {
          shoulder: targetJoints.shoulder,
          elbow: targetJoints.elbow,
        },
        durationMs: 350,
        description: 'Continue to target',
      });
      break;

    case 'miss_and_reapproach':
      // Miss to the side, open gripper, reapproach
      steps.push({
        joints: {
          base: targetJoints.base + 4,
          gripper: 100, // Open
        },
        durationMs: 350,
        description: 'Miss to the side',
      });
      steps.push({
        joints: {
          shoulder: targetJoints.shoulder + 15, // Pull back
          elbow: targetJoints.elbow - 10,
        },
        durationMs: 400,
        description: 'Pull back from missed position',
      });
      steps.push({
        joints: {
          base: targetJoints.base,
          shoulder: targetJoints.shoulder,
          elbow: targetJoints.elbow,
        },
        durationMs: 450,
        description: 'Reapproach correctly',
      });
      break;

    case 'partial_grasp':
      // Grasp off-center, adjust grip
      steps.push({
        joints: {
          gripper: 30, // Partially closed
        },
        durationMs: 300,
        description: 'Partial grasp',
      });
      steps.push({
        joints: {
          gripper: 100, // Open
        },
        durationMs: 250,
        description: 'Release for adjustment',
      });
      steps.push({
        joints: {
          base: targetJoints.base + 1, // Slight adjustment
        },
        durationMs: 200,
        description: 'Adjust position',
      });
      steps.push({
        joints: {
          base: targetJoints.base,
          gripper: 0, // Close properly
        },
        durationMs: 350,
        description: 'Grasp correctly',
      });
      break;
  }

  const totalDurationMs = steps.reduce((sum, step) => sum + step.durationMs, 0);

  return {
    type: behavior.type,
    steps,
    totalDurationMs,
  };
}

/**
 * Get a human-readable description of a recovery behavior
 */
export function getRecoveryDescription(type: RecoveryType): string {
  switch (type) {
    case 'overshoot':
      return 'Moved past target, corrected back';
    case 'undershoot':
      return 'Stopped short, then continued';
    case 'miss_and_reapproach':
      return 'Missed grasp, pulled back and reapproached';
    case 'partial_grasp':
      return 'Off-center grasp, released and re-grasped';
    default:
      return 'Unknown recovery';
  }
}

/**
 * Recovery metadata to store with episode
 */
export interface RecoveryMetadata {
  hasRecovery: boolean;
  recoveryType?: RecoveryType;
  recoveryDescription?: string;
  recoveryDurationMs?: number;
  phase?: 'approach' | 'grasp' | 'lift';
}

/**
 * Generate recovery metadata for an episode
 */
export function generateRecoveryMetadata(
  recovery: RecoverySequence | null
): RecoveryMetadata {
  if (!recovery) {
    return { hasRecovery: false };
  }

  return {
    hasRecovery: true,
    recoveryType: recovery.type,
    recoveryDescription: getRecoveryDescription(recovery.type),
    recoveryDurationMs: recovery.totalDurationMs,
  };
}
