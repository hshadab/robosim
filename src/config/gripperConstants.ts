/**
 * Gripper and IK Constants
 *
 * This is the SINGLE SOURCE OF TRUTH for gripper, IK, and timing constants.
 * All files should import from here rather than using magic numbers.
 */

/**
 * Gripper physical constants
 */
export const GRIPPER = {
  /** Radius in meters within which an object can be grabbed */
  GRAB_RADIUS_M: 0.04,
  /** Time in ms for gripper to fully close */
  CLOSE_TIME_MS: 800,
  /** Length of gripper jaw in meters */
  JAW_LENGTH_M: 0.040,
} as const;

/**
 * Inverse Kinematics constants
 */
export const IK = {
  /** Error threshold in meters - positions with error below this are reachable */
  ERROR_THRESHOLD_M: 0.03,
  /** Fallback threshold in meters - for secondary IK attempts */
  FALLBACK_THRESHOLD_M: 0.04,
} as const;

/**
 * Timing constants for robot motion
 */
export const TIMING = {
  /** Duration of each step in a motion sequence (ms) */
  STEP_DURATION_MS: 700,
  /** Duration for gripper-only steps (ms) */
  GRIPPER_STEP_MS: 800,
} as const;

/**
 * Jaw offset constants for gripper positioning
 * These define the offset from gripper_frame_link to jaw contact point
 */
export const JAW_OFFSET = {
  /** Offset in local gripper X axis (meters) */
  LOCAL_X: -0.0079,
  /** Offset in local gripper Y axis (meters) */
  LOCAL_Y: 0,
  /** Offset in local gripper Z axis (meters) - forward toward jaw tips */
  LOCAL_Z: 0.0068,
} as const;
