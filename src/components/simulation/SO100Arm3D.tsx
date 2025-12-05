/**
 * SO-101 Robot Arm 3D Model
 * Based on Hugging Face LeRobot / The Robot Studio open-source design
 * https://github.com/TheRobotStudio/SO-ARM100
 *
 * SO-101 is the flagship/newer version of the SO-100.
 *
 * Part names from official STL files:
 * - Base_SO101.stl
 * - Base_motor_holder_SO101.stl
 * - Rotation_Pitch_SO101.stl (shoulder bracket)
 * - Upper_arm_SO101.stl
 * - Under_arm_SO101.stl (forearm)
 * - Motor_holder_SO101_Wrist.stl
 * - Wrist_Roll_Pitch_SO101.stl
 * - Moving_Jaw_SO101.stl
 *
 * Key design features:
 * - 5-DOF arm + 1-DOF gripper (6 STS3215 servos total)
 * - Fixed jaw + moving jaw gripper design
 * - External wire routing (improved from SO-100)
 * - White 3D printed PLA+ structure
 * - Blue anodized STS3215 bus servos
 */

import React from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { RoundedBox, Cylinder } from '@react-three/drei';
import type { JointState } from '../../types';

interface SO100ArmProps {
  joints: JointState;
}

// STS3215 servo dimensions (meters) - 24x32x48mm
const SERVO = {
  width: 0.024,
  height: 0.032,
  length: 0.048,
};

// SO-101 dimensions (meters) - based on STL analysis
const D = {
  // Base_SO101
  baseOuterRadius: 0.048,
  baseInnerRadius: 0.035,
  baseHeight: 0.010,

  // Base_motor_holder_SO101 (cylindrical tower on base)
  baseTowerRadius: 0.032,
  baseTowerHeight: 0.045,

  // Rotation_Pitch_SO101 (shoulder bracket - distinctive shape)
  shoulderWidth: 0.056,
  shoulderHeight: 0.065,
  shoulderDepth: 0.038,
  shoulderWallThick: 0.006,

  // Upper_arm_SO101
  upperArmLength: 0.095,
  upperArmWidth: 0.035,
  upperArmThick: 0.014,

  // Under_arm_SO101 (forearm)
  forearmLength: 0.095,
  forearmWidth: 0.032,
  forearmThick: 0.012,

  // Wrist_Roll_Pitch_SO101
  wristBlockWidth: 0.030,
  wristBlockHeight: 0.028,
  wristBlockDepth: 0.030,

  // Gripper with Moving_Jaw_SO101
  gripperPalmWidth: 0.042,
  gripperPalmHeight: 0.014,
  gripperPalmDepth: 0.028,
  fixedJawLength: 0.048,
  fixedJawWidth: 0.010,
  fixedJawThick: 0.016,
  movingJawLength: 0.050,
  movingJawWidth: 0.008,
  movingJawThick: 0.014,
  jawMaxOpen: 0.032,
};

// Materials for SO-101
const M = {
  // White PLA+ (main structure)
  white: { color: '#FAFAFA', metalness: 0.0, roughness: 0.32 },
  // Slightly darker white for accents
  whiteShade: { color: '#EBEBEB', metalness: 0.0, roughness: 0.38 },
  // STS3215 servo blue anodized aluminum
  servoBlue: { color: '#2563EB', metalness: 0.82, roughness: 0.12 },
  // Black base plate
  black: { color: '#1C1C1C', metalness: 0.0, roughness: 0.45 },
  // Chrome/metal accents
  chrome: { color: '#B8B8B8', metalness: 0.92, roughness: 0.08 },
  // Rubber grip pads
  rubber: { color: '#282828', metalness: 0.0, roughness: 0.88 },
};

// STS3215 Servo component
const STS3215: React.FC<{
  rotation?: [number, number, number];
  scale?: number;
}> = ({ rotation = [0, 0, 0], scale = 1 }) => {
  const w = SERVO.width * scale;
  const h = SERVO.height * scale;
  const len = SERVO.length * scale;

  return (
    <group rotation={rotation}>
      {/* Main body */}
      <RoundedBox args={[w, h, len]} radius={0.0015} castShadow receiveShadow>
        <meshStandardMaterial {...M.servoBlue} />
      </RoundedBox>
      {/* Output flange */}
      <mesh position={[0, h / 2 + 0.0025, 0]}>
        <cylinderGeometry args={[0.0085 * scale, 0.0085 * scale, 0.005, 16]} />
        <meshStandardMaterial {...M.servoBlue} />
      </mesh>
      {/* Center screw */}
      <mesh position={[0, h / 2 + 0.005, 0]}>
        <cylinderGeometry args={[0.0028 * scale, 0.0028 * scale, 0.003, 8]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      {/* Mounting tabs front/back */}
      <mesh position={[0, 0, len / 2 + 0.0035]}>
        <boxGeometry args={[w * 1.35, 0.003, 0.007]} />
        <meshStandardMaterial {...M.servoBlue} />
      </mesh>
      <mesh position={[0, 0, -len / 2 - 0.0035]}>
        <boxGeometry args={[w * 1.35, 0.003, 0.007]} />
        <meshStandardMaterial {...M.servoBlue} />
      </mesh>
    </group>
  );
};

// Main SO-101 Arm Component
export const SO100Arm3D: React.FC<SO100ArmProps> = ({ joints }) => {
  const baseRot = (joints.base * Math.PI) / 180;
  const shoulderRot = (joints.shoulder * Math.PI) / 180;
  const elbowRot = (joints.elbow * Math.PI) / 180;
  const wristRot = (joints.wrist * Math.PI) / 180;
  const gripperOpen = joints.gripper / 100;
  const jawOffset = gripperOpen * D.jawMaxOpen;

  return (
    <group>
      {/* ==================== BASE_SO101 ==================== */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[D.baseHeight / 2, D.baseOuterRadius]}
          position={[0, D.baseHeight / 2, 0]}
        />

        {/* Black circular base plate */}
        <Cylinder
          args={[D.baseOuterRadius, D.baseOuterRadius + 0.004, D.baseHeight, 32]}
          position={[0, D.baseHeight / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...M.black} />
        </Cylinder>

        {/* Chrome ring detail on base */}
        <mesh position={[0, D.baseHeight, 0]}>
          <torusGeometry args={[D.baseOuterRadius - 0.004, 0.002, 8, 32]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>

        {/* BASE_MOTOR_HOLDER_SO101 - cylindrical tower */}
        <Cylinder
          args={[D.baseTowerRadius, D.baseTowerRadius + 0.002, D.baseTowerHeight, 24]}
          position={[0, D.baseHeight + D.baseTowerHeight / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial {...M.white} />
        </Cylinder>

        {/* Cutout visualization (darker inset) */}
        <Cylinder
          args={[D.baseTowerRadius - 0.008, D.baseTowerRadius - 0.008, D.baseTowerHeight - 0.010, 20]}
          position={[0, D.baseHeight + D.baseTowerHeight / 2 + 0.003, 0]}
          castShadow
        >
          <meshStandardMaterial {...M.whiteShade} />
        </Cylinder>

        {/* Base rotation servo (vertical) */}
        <group position={[0, D.baseHeight + D.baseTowerHeight / 2, 0]}>
          <STS3215 scale={0.88} />
        </group>

        {/* Top lip of base tower */}
        <mesh position={[0, D.baseHeight + D.baseTowerHeight, 0]}>
          <torusGeometry args={[D.baseTowerRadius - 0.003, 0.003, 8, 24]} />
          <meshStandardMaterial {...M.white} />
        </mesh>
      </RigidBody>

      {/* ==================== ROTATING ARM ==================== */}
      <group
        position={[0, D.baseHeight + D.baseTowerHeight + 0.006, 0]}
        rotation={[0, -baseRot, 0]}
      >
        <RigidBody type="kinematicPosition" colliders={false}>
          <CuboidCollider
            args={[D.shoulderWidth / 2, D.shoulderHeight / 2, D.shoulderDepth / 2]}
            position={[0, D.shoulderHeight / 2, 0]}
          />

          {/* ==================== ROTATION_PITCH_SO101 ==================== */}
          {/* Shoulder bracket - U-shape with left wall, right wall, back wall */}

          {/* Left wall */}
          <RoundedBox
            args={[D.shoulderWallThick, D.shoulderHeight, D.shoulderDepth]}
            radius={0.002}
            position={[-D.shoulderWidth / 2 + D.shoulderWallThick / 2, D.shoulderHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Right wall */}
          <RoundedBox
            args={[D.shoulderWallThick, D.shoulderHeight, D.shoulderDepth]}
            radius={0.002}
            position={[D.shoulderWidth / 2 - D.shoulderWallThick / 2, D.shoulderHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Back wall */}
          <RoundedBox
            args={[D.shoulderWidth - D.shoulderWallThick * 2, D.shoulderHeight, D.shoulderWallThick]}
            radius={0.002}
            position={[0, D.shoulderHeight / 2, -D.shoulderDepth / 2 + D.shoulderWallThick / 2]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.whiteShade} />
          </RoundedBox>

          {/* Bottom plate */}
          <RoundedBox
            args={[D.shoulderWidth, D.shoulderWallThick, D.shoulderDepth]}
            radius={0.002}
            position={[0, D.shoulderWallThick / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.whiteShade} />
          </RoundedBox>

          {/* Top cross bar */}
          <RoundedBox
            args={[D.shoulderWidth, D.shoulderWallThick, D.shoulderDepth * 0.5]}
            radius={0.002}
            position={[0, D.shoulderHeight - D.shoulderWallThick / 2, D.shoulderDepth * 0.15]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Shoulder pitch servo (horizontal) */}
          <group position={[0, D.shoulderHeight * 0.55, 0.002]} rotation={[0, 0, Math.PI / 2]}>
            <STS3215 scale={0.88} />
          </group>
        </RigidBody>

        {/* ==================== SHOULDER PITCH ==================== */}
        <group
          position={[0, D.shoulderHeight + 0.004, 0.006]}
          rotation={[shoulderRot, 0, 0]}
        >
          {/* ==================== UPPER_ARM_SO101 ==================== */}
          <group position={[0, D.upperArmLength / 2 + 0.006, 0]}>
            {/* Main arm body */}
            <RoundedBox
              args={[D.upperArmWidth, D.upperArmLength, D.upperArmThick]}
              radius={0.003}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>

            {/* Surface detail/ridge */}
            <mesh position={[0, 0, D.upperArmThick / 2 + 0.001]}>
              <boxGeometry args={[D.upperArmWidth * 0.65, D.upperArmLength * 0.88, 0.002]} />
              <meshStandardMaterial {...M.whiteShade} />
            </mesh>

            {/* Side cutout details */}
            <mesh position={[D.upperArmWidth / 2 + 0.001, 0, 0]}>
              <boxGeometry args={[0.002, D.upperArmLength * 0.7, D.upperArmThick * 0.6]} />
              <meshStandardMaterial {...M.whiteShade} />
            </mesh>
            <mesh position={[-D.upperArmWidth / 2 - 0.001, 0, 0]}>
              <boxGeometry args={[0.002, D.upperArmLength * 0.7, D.upperArmThick * 0.6]} />
              <meshStandardMaterial {...M.whiteShade} />
            </mesh>
          </group>

          {/* ==================== ELBOW ==================== */}
          <group
            position={[0, D.upperArmLength + 0.010, 0]}
            rotation={[elbowRot, 0, 0]}
          >
            {/* Elbow joint housing */}
            <RoundedBox
              args={[D.upperArmWidth + 0.006, 0.024, D.upperArmThick + 0.004]}
              radius={0.003}
              position={[0, 0.012, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.whiteShade} />
            </RoundedBox>

            {/* Elbow servo */}
            <group position={[0, 0.012, 0]} rotation={[0, 0, Math.PI / 2]}>
              <STS3215 scale={0.78} />
            </group>

            {/* ==================== UNDER_ARM_SO101 (Forearm) ==================== */}
            <group position={[0, 0.024 + D.forearmLength / 2 + 0.004, 0]}>
              <RoundedBox
                args={[D.forearmWidth, D.forearmLength, D.forearmThick]}
                radius={0.003}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Surface ridge */}
              <mesh position={[0, 0, D.forearmThick / 2 + 0.001]}>
                <boxGeometry args={[D.forearmWidth * 0.6, D.forearmLength * 0.85, 0.002]} />
                <meshStandardMaterial {...M.whiteShade} />
              </mesh>
            </group>

            {/* ==================== WRIST ==================== */}
            <group
              position={[0, 0.024 + D.forearmLength + 0.008, 0]}
              rotation={[wristRot, 0, 0]}
            >
              {/* MOTOR_HOLDER_SO101_WRIST + WRIST_ROLL_PITCH_SO101 */}
              <RoundedBox
                args={[D.wristBlockWidth, D.wristBlockHeight, D.wristBlockDepth]}
                radius={0.003}
                position={[0, D.wristBlockHeight / 2, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Wrist servo */}
              <group position={[0, D.wristBlockHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
                <STS3215 scale={0.62} />
              </group>

              {/* Wrist roll cylinder (connects to gripper) */}
              <Cylinder
                args={[0.012, 0.012, 0.030, 14]}
                position={[0, D.wristBlockHeight + 0.015, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial {...M.white} />
              </Cylinder>

              {/* ==================== GRIPPER ==================== */}
              <group position={[0, D.wristBlockHeight + 0.038, 0]}>
                {/* Gripper palm */}
                <RoundedBox
                  args={[D.gripperPalmWidth, D.gripperPalmHeight, D.gripperPalmDepth]}
                  radius={0.002}
                  position={[0, 0, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial {...M.white} />
                </RoundedBox>

                {/* Gripper servo (small, underneath) */}
                <group position={[-0.006, -D.gripperPalmHeight / 2 - 0.010, 0]}>
                  <STS3215 scale={0.45} rotation={[Math.PI / 2, 0, 0]} />
                </group>

                {/* Fixed jaw (right side) - part of gripper base */}
                <group position={[D.gripperPalmWidth / 2 - D.fixedJawWidth / 2 - 0.003, D.gripperPalmHeight / 2, 0]}>
                  <RoundedBox
                    args={[D.fixedJawWidth, D.fixedJawLength, D.fixedJawThick]}
                    radius={0.002}
                    position={[0, D.fixedJawLength / 2, 0]}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial {...M.white} />
                  </RoundedBox>
                  {/* Rubber grip pad */}
                  <mesh position={[-D.fixedJawWidth / 2 - 0.0015, D.fixedJawLength * 0.6, 0]}>
                    <boxGeometry args={[0.003, D.fixedJawLength * 0.55, D.fixedJawThick - 0.004]} />
                    <meshStandardMaterial {...M.rubber} />
                  </mesh>
                  {/* Finger tip */}
                  <mesh position={[0, D.fixedJawLength, 0]}>
                    <sphereGeometry args={[D.fixedJawThick / 2 - 0.001, 8, 8]} />
                    <meshStandardMaterial {...M.rubber} />
                  </mesh>
                </group>

                {/* MOVING_JAW_SO101 (left side) */}
                <group position={[-D.gripperPalmWidth / 2 + D.movingJawWidth / 2 + 0.005 + jawOffset, D.gripperPalmHeight / 2, 0]}>
                  <RoundedBox
                    args={[D.movingJawWidth, D.movingJawLength, D.movingJawThick]}
                    radius={0.002}
                    position={[0, D.movingJawLength / 2, 0]}
                    castShadow
                    receiveShadow
                  >
                    <meshStandardMaterial {...M.whiteShade} />
                  </RoundedBox>
                  {/* Rubber grip pad */}
                  <mesh position={[D.movingJawWidth / 2 + 0.0015, D.movingJawLength * 0.6, 0]}>
                    <boxGeometry args={[0.003, D.movingJawLength * 0.55, D.movingJawThick - 0.004]} />
                    <meshStandardMaterial {...M.rubber} />
                  </mesh>
                  {/* Finger tip */}
                  <mesh position={[0, D.movingJawLength, 0]}>
                    <sphereGeometry args={[D.movingJawThick / 2 - 0.001, 8, 8]} />
                    <meshStandardMaterial {...M.rubber} />
                  </mesh>
                  {/* Pivot pin */}
                  <mesh position={[0, -0.004, 0]}>
                    <cylinderGeometry args={[0.003, 0.003, D.movingJawThick + 0.006, 10]} />
                    <meshStandardMaterial {...M.chrome} />
                  </mesh>
                </group>

              </group>
              {/* End Gripper */}

            </group>
            {/* End Wrist */}

          </group>
          {/* End Elbow */}

        </group>
        {/* End Shoulder Pitch */}

      </group>
      {/* End Rotating Structure */}

    </group>
  );
};
