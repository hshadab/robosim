/**
 * SO-100/SO-101 Robot Arm Kinematics
 * Forward kinematics calculations for the LeRobot / The Robot Studio arm
 */

import type { JointState } from '../../types';

// SO-100 Kinematics (based on URDF and physical measurements)
export const SO100_DIMS = {
  // Base dimensions
  baseHeight: 0.025,       // Base plate height
  baseRadius: 0.045,       // Base plate radius

  // Link lengths (meters) - derived from URDF
  link1Height: 0.0624,     // Base to shoulder pan axis
  link2Length: 0.040,      // Shoulder bracket
  link3Length: 0.095,      // Upper arm
  link4Length: 0.088,      // Forearm
  link5Length: 0.042,      // Wrist
  gripperLength: 0.045,    // Gripper fingers

  // Joint offsets
  shoulderOffset: 0.0388,  // X offset for shoulder
};

/**
 * Calculate the gripper tip position using forward kinematics
 * @param joints - Joint state with base, shoulder, elbow, wrist angles in degrees
 * @returns [x, y, z] position of the gripper tip in meters
 */
export const calculateSO100GripperPosition = (joints: JointState): [number, number, number] => {
  const dims = SO100_DIMS;
  const shoulderPanRad = (joints.base * Math.PI) / 180;
  const shoulderLiftRad = (joints.shoulder * Math.PI) / 180;
  const elbowFlexRad = (joints.elbow * Math.PI) / 180;
  const wristFlexRad = (joints.wrist * Math.PI) / 180;

  const shoulderHeight = dims.baseHeight + dims.link1Height;
  const shoulderPos = {
    x: dims.shoulderOffset * Math.cos(-shoulderPanRad),
    y: shoulderHeight,
    z: dims.shoulderOffset * Math.sin(-shoulderPanRad),
  };

  const angle1 = shoulderLiftRad;
  const elbowPos = {
    x: shoulderPos.x + dims.link3Length * Math.sin(angle1) * Math.cos(-shoulderPanRad),
    y: shoulderPos.y + dims.link3Length * Math.cos(angle1),
    z: shoulderPos.z + dims.link3Length * Math.sin(angle1) * Math.sin(-shoulderPanRad),
  };

  const angle2 = angle1 + elbowFlexRad;
  const wristPos = {
    x: elbowPos.x + dims.link4Length * Math.sin(angle2) * Math.cos(-shoulderPanRad),
    y: elbowPos.y + dims.link4Length * Math.cos(angle2),
    z: elbowPos.z + dims.link4Length * Math.sin(angle2) * Math.sin(-shoulderPanRad),
  };

  const angle3 = angle2 + wristFlexRad;
  const gripperPos = {
    x: wristPos.x + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.cos(-shoulderPanRad),
    y: wristPos.y + (dims.link5Length + dims.gripperLength) * Math.cos(angle3),
    z: wristPos.z + (dims.link5Length + dims.gripperLength) * Math.sin(angle3) * Math.sin(-shoulderPanRad),
  };

  return [gripperPos.x, gripperPos.y, gripperPos.z];
};
