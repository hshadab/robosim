/**
 * SO-101 Robot Arm Dimensions
 *
 * This is the SINGLE SOURCE OF TRUTH for SO-101 arm link dimensions.
 * These values are derived from the official SO-101 URDF (so101.urdf).
 *
 * URDF Source:
 * https://github.com/huggingface/lerobot/tree/main/lerobot/common/robot_devices/robots/so100
 *
 * Note: For accurate forward kinematics calculations, use the URDF-based
 * implementations in SO101KinematicsURDF.ts. These dimensions are provided
 * for visualization and simplified calculations.
 */

/**
 * SO-101 link dimensions in meters
 */
export const SO101_DIMS = {
  // Base dimensions
  baseHeight: 0.025,       // Base plate height
  baseRadius: 0.045,       // Base plate radius

  // Link lengths (meters) - from official URDF joint origins
  link1Height: 0.0624,     // Base to shoulder pan axis (shoulder_pan xyz z=0.0624)
  link2Length: 0.0542,     // Shoulder bracket (shoulder_lift xyz z=0.0542)
  link3Length: 0.11257,    // Upper arm (elbow_flex xyz x=0.11257)
  link4Length: 0.1349,     // Forearm (wrist_flex xyz x=0.1349)
  link5Length: 0.0611,     // Wrist (wrist_roll xyz y=0.0611)
  gripperLength: 0.098,    // Gripper to tip (gripper_frame xyz z=0.0981)

  // Joint offsets from URDF
  shoulderOffset: 0.0388,  // X offset for shoulder (shoulder_pan xyz x=0.0388)
  shoulderLiftOffset: 0.0304, // shoulder_lift xyz x offset
} as const;

/**
 * Calculate total arm reach (approximate)
 */
export function getMaxReach(): number {
  return SO101_DIMS.link3Length + SO101_DIMS.link4Length +
         SO101_DIMS.link5Length + SO101_DIMS.gripperLength;
}

/**
 * Get workspace bounds for SO-101
 */
export function getWorkspaceBounds(): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  maxReach: number;
} {
  const maxReach = getMaxReach();

  return {
    minX: -maxReach,
    maxX: maxReach,
    minY: 0,
    maxY: SO101_DIMS.baseHeight + SO101_DIMS.link1Height +
          SO101_DIMS.link2Length + maxReach,
    minZ: -maxReach,
    maxZ: maxReach,
    maxReach,
  };
}
