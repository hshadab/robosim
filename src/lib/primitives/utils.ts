/**
 * Shared utilities for action primitives
 */

import type { SceneObject } from './types';

/**
 * Color names that can be used to identify objects
 */
export const OBJECT_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;

/**
 * Find an object in the scene by name, type, or color reference
 *
 * @param objects Array of scene objects
 * @param ref Reference string (name, type, or color)
 * @param excludeGrabbed Optionally exclude grabbed objects from results
 * @returns The matching object or undefined
 */
export function findObject(
  objects: SceneObject[],
  ref: string,
  excludeGrabbed = false
): SceneObject | undefined {
  const lower = ref.toLowerCase();
  const candidates = excludeGrabbed ? objects.filter(o => !o.isGrabbed) : objects;

  // Try exact name match first
  let obj = candidates.find(o => o.name.toLowerCase() === lower);
  if (obj) return obj;

  // Try partial name match
  obj = candidates.find(o => o.name.toLowerCase().includes(lower));
  if (obj) return obj;

  // Try type match (e.g., "cube", "cylinder")
  obj = candidates.find(o => o.type === lower);
  if (obj) return obj;

  // Try color match (e.g., "red cube", "blue")
  for (const color of OBJECT_COLORS) {
    if (lower.includes(color)) {
      obj = candidates.find(o => o.name.toLowerCase().includes(color));
      if (obj) return obj;
    }
  }

  return undefined;
}

/**
 * Default joint state for IK calculations
 */
export const DEFAULT_JOINTS: import('../../types').JointState = {
  base: 0,
  shoulder: 45,
  elbow: -90,
  wrist: 45,
  wristRoll: 90,
  gripper: 100,
};

/**
 * Calculate IK for a target position using the SO101 kinematics solver
 */
export async function calculateIK(
  targetX: number,
  targetY: number,
  targetZ: number,
  currentJoints: Partial<import('../../types').JointState>
): Promise<{ joints: Partial<import('../../types').JointState>; error: number } | null> {
  const { calculateInverseKinematics } = await import('../../components/simulation/SO101Kinematics');

  // Merge with defaults to create full JointState
  const fullJoints: import('../../types').JointState = {
    ...DEFAULT_JOINTS,
    ...currentJoints,
  };

  const result = calculateInverseKinematics(targetX, targetY, targetZ, fullJoints);
  if (!result) return null;

  return {
    joints: {
      base: result.base,
      shoulder: result.shoulder,
      elbow: result.elbow,
      wrist: result.wrist,
    },
    error: 0, // IK solver returns null on failure, so 0 means success
  };
}
