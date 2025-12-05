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
  // White PLA+ (main structure) - slightly off-white like real 3D prints
  white: { color: '#F5F5F0', metalness: 0.0, roughness: 0.35 },
  // Slightly darker white for recessed areas
  whiteShade: { color: '#E8E8E3', metalness: 0.0, roughness: 0.4 },
  // STS3215 servo - BLACK/dark grey (corrected from blue)
  servoBlack: { color: '#1A1A1A', metalness: 0.15, roughness: 0.3 },
  // Servo face plate (slightly lighter)
  servoFace: { color: '#2D2D2D', metalness: 0.1, roughness: 0.35 },
  // Chrome/metal screws
  chrome: { color: '#C0C0C0', metalness: 0.95, roughness: 0.1 },
  // Brass/gold screws
  brass: { color: '#B8860B', metalness: 0.85, roughness: 0.15 },
  // Wire colors
  wireRed: { color: '#CC0000', metalness: 0.1, roughness: 0.5 },
  wireBlack: { color: '#111111', metalness: 0.1, roughness: 0.5 },
  wireWhite: { color: '#EEEEEE', metalness: 0.1, roughness: 0.5 },
  // PCB green
  pcbGreen: { color: '#228B22', metalness: 0.2, roughness: 0.4 },
};

// STS3215 Servo component - realistic black servo with details
const STS3215: React.FC<{
  rotation?: [number, number, number];
  scale?: number;
}> = ({ rotation = [0, 0, 0], scale = 1 }) => {
  const w = SERVO.width * scale;
  const h = SERVO.height * scale;
  const len = SERVO.length * scale;

  return (
    <group rotation={rotation}>
      {/* Main body - black servo */}
      <RoundedBox args={[w, h, len]} radius={0.002 * scale} castShadow receiveShadow>
        <meshStandardMaterial {...M.servoBlack} />
      </RoundedBox>
      {/* Face plate detail */}
      <mesh position={[0, h / 2 - 0.001, 0]}>
        <boxGeometry args={[w * 0.85, 0.001, len * 0.7]} />
        <meshStandardMaterial {...M.servoFace} />
      </mesh>
      {/* Output flange */}
      <mesh position={[0, h / 2 + 0.002, 0]}>
        <cylinderGeometry args={[0.009 * scale, 0.009 * scale, 0.004, 20]} />
        <meshStandardMaterial {...M.servoBlack} />
      </mesh>
      {/* Center screw */}
      <mesh position={[0, h / 2 + 0.0045, 0]}>
        <cylinderGeometry args={[0.003 * scale, 0.003 * scale, 0.003, 6]} />
        <meshStandardMaterial {...M.chrome} />
      </mesh>
      {/* Mounting screw holes (4 corners on top) */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.007 * scale, h / 2 + 0.003, z * 0.015 * scale]}>
          <cylinderGeometry args={[0.0015 * scale, 0.0015 * scale, 0.002, 6]} />
          <meshStandardMaterial {...M.chrome} />
        </mesh>
      ))}
      {/* Mounting tabs front/back with holes */}
      <mesh position={[0, 0, len / 2 + 0.003]}>
        <boxGeometry args={[w * 1.4, 0.0025, 0.006]} />
        <meshStandardMaterial {...M.servoBlack} />
      </mesh>
      <mesh position={[0, 0, -len / 2 - 0.003]}>
        <boxGeometry args={[w * 1.4, 0.0025, 0.006]} />
        <meshStandardMaterial {...M.servoBlack} />
      </mesh>
      {/* Cable connector (back) */}
      <mesh position={[0, -h * 0.3, -len / 2 - 0.002]}>
        <boxGeometry args={[0.008 * scale, 0.004 * scale, 0.004 * scale]} />
        <meshStandardMaterial {...M.servoFace} />
      </mesh>
    </group>
  );
};

// Wire bundle component for external cable routing
const WireBundle: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  mid?: [number, number, number];
}> = ({ start, end, mid }) => {
  const wireRadius = 0.0012;
  const wireSpacing = 0.003;

  // Calculate direction and length
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Calculate rotation to point from start to end
  const rotX = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy);
  const rotY = Math.atan2(dx, dz);

  const midPoint: [number, number, number] = mid || [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  return (
    <group position={midPoint} rotation={[rotX, rotY, 0]}>
      {/* Red wire */}
      <mesh position={[-wireSpacing, 0, 0]}>
        <cylinderGeometry args={[wireRadius, wireRadius, length, 6]} />
        <meshStandardMaterial {...M.wireRed} />
      </mesh>
      {/* Black wire */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[wireRadius, wireRadius, length, 6]} />
        <meshStandardMaterial {...M.wireBlack} />
      </mesh>
      {/* White wire */}
      <mesh position={[wireSpacing, 0, 0]}>
        <cylinderGeometry args={[wireRadius, wireRadius, length, 6]} />
        <meshStandardMaterial {...M.wireWhite} />
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

        {/* Base plate with sawtooth/stepped edge */}
        <group position={[0, 0, 0]}>
          {/* Main base body */}
          <RoundedBox
            args={[D.baseOuterRadius * 2, D.baseHeight, D.baseOuterRadius * 1.6]}
            radius={0.004}
            position={[0, D.baseHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Rectangular slot pattern on base top (3x5 grid) */}
          {[-1, 0, 1].map((row) =>
            [-2, -1, 0, 1, 2].map((col) => (
              <mesh
                key={`slot-${row}-${col}`}
                position={[row * 0.018, D.baseHeight + 0.001, col * 0.012]}
              >
                <boxGeometry args={[0.012, 0.003, 0.006]} />
                <meshStandardMaterial {...M.whiteShade} />
              </mesh>
            ))
          )}

          {/* Front step/ledge detail */}
          <RoundedBox
            args={[D.baseOuterRadius * 1.5, D.baseHeight * 0.6, 0.015]}
            radius={0.002}
            position={[0, D.baseHeight * 0.3, D.baseOuterRadius * 0.8 + 0.008]}
            castShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>
        </group>

        {/* BASE_MOTOR_HOLDER_SO101 - motor housing with details */}
        <group position={[0, D.baseHeight, 0]}>
          {/* Main cylindrical housing */}
          <Cylinder
            args={[D.baseTowerRadius, D.baseTowerRadius + 0.003, D.baseTowerHeight, 24]}
            position={[0, D.baseTowerHeight / 2, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial {...M.white} />
          </Cylinder>

          {/* Dot-matrix holes on motor holder (2 columns of 3) */}
          {[-1, 1].map((side) =>
            [-1, 0, 1].map((row) => (
              <mesh
                key={`mh-hole-${side}-${row}`}
                position={[side * (D.baseTowerRadius + 0.001), D.baseTowerHeight * 0.5 + row * 0.012, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.003, 0.003, 0.004, 8]} />
                <meshStandardMaterial {...M.whiteShade} />
              </mesh>
            ))
          )}

          {/* Front cutout/window on motor holder */}
          <mesh position={[0, D.baseTowerHeight * 0.6, D.baseTowerRadius - 0.002]}>
            <boxGeometry args={[0.018, 0.022, 0.008]} />
            <meshStandardMaterial {...M.whiteShade} />
          </mesh>
        </group>

        {/* Base rotation servo (inside motor holder) */}
        <group position={[0, D.baseHeight + D.baseTowerHeight / 2, 0]}>
          <STS3215 scale={0.85} />
        </group>

        {/* Top mounting ring */}
        <Cylinder
          args={[D.baseTowerRadius + 0.004, D.baseTowerRadius + 0.006, 0.005, 24]}
          position={[0, D.baseHeight + D.baseTowerHeight - 0.002, 0]}
          castShadow
        >
          <meshStandardMaterial {...M.white} />
        </Cylinder>

        {/* Mounting screws on base corners */}
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
          <mesh key={`base-screw-${i}`} position={[x * 0.038, D.baseHeight + 0.002, z * 0.028]}>
            <cylinderGeometry args={[0.002, 0.002, 0.003, 6]} />
            <meshStandardMaterial {...M.chrome} />
          </mesh>
        ))}

        {/* PCB hint on back of base */}
        <mesh position={[-0.025, D.baseHeight * 0.6, -D.baseOuterRadius * 0.6]}>
          <boxGeometry args={[0.025, 0.003, 0.020]} />
          <meshStandardMaterial {...M.pcbGreen} />
        </mesh>

        {/* Wire bundle from PCB to motor holder */}
        <WireBundle
          start={[-0.015, D.baseHeight, -D.baseOuterRadius * 0.5]}
          end={[-0.015, D.baseHeight + D.baseTowerHeight * 0.8, -D.baseTowerRadius + 0.005]}
        />
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
          {/* Shoulder bracket - butterfly/bowtie shape with diamond lattice */}

          {/* Left wing of butterfly shape */}
          <group position={[-D.shoulderWidth / 2 + 0.012, D.shoulderHeight / 2, 0]}>
            {/* Outer frame */}
            <RoundedBox
              args={[0.024, D.shoulderHeight, D.shoulderDepth]}
              radius={0.003}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>
            {/* Diamond lattice cutouts (3x4 pattern) */}
            {[-1.2, -0.4, 0.4, 1.2].map((row) =>
              [-0.8, 0, 0.8].map((col) => (
                <mesh
                  key={`lat-l-${row}-${col}`}
                  position={[0, row * 0.012, col * 0.01]}
                  rotation={[0, 0, Math.PI / 4]}
                >
                  <boxGeometry args={[0.008, 0.008, D.shoulderDepth * 0.85]} />
                  <meshStandardMaterial {...M.whiteShade} />
                </mesh>
              ))
            )}
          </group>

          {/* Right wing of butterfly shape */}
          <group position={[D.shoulderWidth / 2 - 0.012, D.shoulderHeight / 2, 0]}>
            {/* Outer frame */}
            <RoundedBox
              args={[0.024, D.shoulderHeight, D.shoulderDepth]}
              radius={0.003}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>
            {/* Diamond lattice cutouts (3x4 pattern) */}
            {[-1.2, -0.4, 0.4, 1.2].map((row) =>
              [-0.8, 0, 0.8].map((col) => (
                <mesh
                  key={`lat-r-${row}-${col}`}
                  position={[0, row * 0.012, col * 0.01]}
                  rotation={[0, 0, Math.PI / 4]}
                >
                  <boxGeometry args={[0.008, 0.008, D.shoulderDepth * 0.85]} />
                  <meshStandardMaterial {...M.whiteShade} />
                </mesh>
              ))
            )}
          </group>

          {/* Center spine connecting the wings */}
          <RoundedBox
            args={[D.shoulderWidth - 0.024, D.shoulderWallThick * 1.5, D.shoulderDepth * 0.4]}
            radius={0.002}
            position={[0, D.shoulderHeight * 0.15, 0]}
            castShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Top bar connecting wings */}
          <RoundedBox
            args={[D.shoulderWidth - 0.016, D.shoulderWallThick * 1.2, D.shoulderDepth * 0.35]}
            radius={0.002}
            position={[0, D.shoulderHeight - 0.006, D.shoulderDepth * 0.15]}
            castShadow
          >
            <meshStandardMaterial {...M.white} />
          </RoundedBox>

          {/* Servo mounting plate (back, with dot pattern) */}
          <group position={[0, D.shoulderHeight * 0.55, -D.shoulderDepth / 2 + 0.004]}>
            <RoundedBox
              args={[0.032, 0.038, 0.008]}
              radius={0.002}
              castShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>
            {/* Dot-matrix mounting holes (2x3) */}
            {[-1, 1].map((x) =>
              [-1, 0, 1].map((y) => (
                <mesh
                  key={`sh-dot-${x}-${y}`}
                  position={[x * 0.008, y * 0.010, 0.005]}
                >
                  <cylinderGeometry args={[0.002, 0.002, 0.003, 8]} />
                  <meshStandardMaterial {...M.whiteShade} />
                </mesh>
              ))
            )}
          </group>

          {/* Shoulder pitch servo */}
          <group position={[0, D.shoulderHeight * 0.55, 0.004]} rotation={[0, 0, Math.PI / 2]}>
            <STS3215 scale={0.85} />
          </group>

          {/* Mounting screws on shoulder */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y], i) => (
            <mesh key={`sh-screw-${i}`} position={[x * 0.022, D.shoulderHeight * 0.55 + y * 0.014, D.shoulderDepth / 2 - 0.002]}>
              <cylinderGeometry args={[0.0015, 0.0015, 0.004, 6]} />
              <meshStandardMaterial {...M.chrome} />
            </mesh>
          ))}

          {/* Wire bundle from base to shoulder servo */}
          <WireBundle
            start={[D.shoulderWidth / 2 - 0.008, 0.010, -D.shoulderDepth / 2 + 0.008]}
            end={[D.shoulderWidth / 2 - 0.008, D.shoulderHeight * 0.5, -D.shoulderDepth / 2 + 0.008]}
          />
        </RigidBody>

        {/* ==================== SHOULDER PITCH ==================== */}
        <group
          position={[0, D.shoulderHeight + 0.004, 0.006]}
          rotation={[shoulderRot, 0, 0]}
        >
          {/* ==================== UPPER_ARM_SO101 ==================== */}
          {/* Two-pronged "pants" shape with oval cutout */}
          <group position={[0, D.upperArmLength / 2 + 0.008, 0]}>
            {/* Left prong */}
            <RoundedBox
              args={[0.010, D.upperArmLength, D.upperArmThick]}
              radius={0.003}
              position={[-D.upperArmWidth / 2 + 0.005, 0, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>

            {/* Right prong */}
            <RoundedBox
              args={[0.010, D.upperArmLength, D.upperArmThick]}
              radius={0.003}
              position={[D.upperArmWidth / 2 - 0.005, 0, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>

            {/* Top connecting bar (where prongs meet) */}
            <RoundedBox
              args={[D.upperArmWidth, 0.022, D.upperArmThick]}
              radius={0.003}
              position={[0, -D.upperArmLength / 2 + 0.011, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>

            {/* Bottom connecting bar */}
            <RoundedBox
              args={[D.upperArmWidth, 0.016, D.upperArmThick]}
              radius={0.003}
              position={[0, D.upperArmLength / 2 - 0.008, 0]}
              castShadow
            >
              <meshStandardMaterial {...M.white} />
            </RoundedBox>

            {/* Center bridge (thinner) */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[D.upperArmWidth * 0.5, D.upperArmLength * 0.3, D.upperArmThick * 0.7]} />
              <meshStandardMaterial {...M.whiteShade} />
            </mesh>

            {/* Dot-matrix holes at top (servo mounting) */}
            {[-1, 0, 1].map((x) =>
              [-1, 1].map((y) => (
                <mesh
                  key={`ua-dot-${x}-${y}`}
                  position={[x * 0.008, -D.upperArmLength / 2 + 0.011 + y * 0.006, D.upperArmThick / 2 + 0.001]}
                >
                  <cylinderGeometry args={[0.0018, 0.0018, 0.003, 8]} />
                  <meshStandardMaterial {...M.whiteShade} />
                </mesh>
              ))
            )}

            {/* Screw holes along the arm */}
            {[-0.3, 0, 0.3].map((pos, i) => (
              <mesh key={`ua-screw-${i}`} position={[D.upperArmWidth / 2 - 0.005, pos * D.upperArmLength * 0.7, D.upperArmThick / 2 + 0.001]}>
                <cylinderGeometry args={[0.0012, 0.0012, 0.002, 6]} />
                <meshStandardMaterial {...M.chrome} />
              </mesh>
            ))}
            {[-0.3, 0, 0.3].map((pos, i) => (
              <mesh key={`ua-screw2-${i}`} position={[-D.upperArmWidth / 2 + 0.005, pos * D.upperArmLength * 0.7, D.upperArmThick / 2 + 0.001]}>
                <cylinderGeometry args={[0.0012, 0.0012, 0.002, 6]} />
                <meshStandardMaterial {...M.chrome} />
              </mesh>
            ))}

            {/* Wire bundle running along upper arm (external routing) */}
            <WireBundle
              start={[D.upperArmWidth / 2 + 0.004, -D.upperArmLength / 2 + 0.015, D.upperArmThick / 2 - 0.002]}
              end={[D.upperArmWidth / 2 + 0.004, D.upperArmLength / 2 - 0.010, D.upperArmThick / 2 - 0.002]}
            />
          </group>

          {/* ==================== ELBOW ==================== */}
          <group
            position={[0, D.upperArmLength + 0.012, 0]}
            rotation={[elbowRot, 0, 0]}
          >
            {/* Elbow joint housing - C-shaped bracket */}
            <group position={[0, 0.010, 0]}>
              {/* Left elbow bracket */}
              <RoundedBox
                args={[0.008, 0.028, D.upperArmThick + 0.006]}
                radius={0.002}
                position={[-D.upperArmWidth / 2, 0, 0]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>
              {/* Right elbow bracket */}
              <RoundedBox
                args={[0.008, 0.028, D.upperArmThick + 0.006]}
                radius={0.002}
                position={[D.upperArmWidth / 2, 0, 0]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>
              {/* Back plate */}
              <RoundedBox
                args={[D.upperArmWidth + 0.016, 0.022, 0.006]}
                radius={0.002}
                position={[0, 0, -D.upperArmThick / 2 - 0.003]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>
            </group>

            {/* Elbow servo */}
            <group position={[0, 0.010, 0]} rotation={[0, 0, Math.PI / 2]}>
              <STS3215 scale={0.78} />
            </group>

            {/* ==================== UNDER_ARM_SO101 (Forearm) ==================== */}
            {/* Two-pronged shape like upper arm */}
            <group position={[0, 0.026 + D.forearmLength / 2, 0]}>
              {/* Left prong */}
              <RoundedBox
                args={[0.009, D.forearmLength, D.forearmThick]}
                radius={0.003}
                position={[-D.forearmWidth / 2 + 0.0045, 0, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Right prong */}
              <RoundedBox
                args={[0.009, D.forearmLength, D.forearmThick]}
                radius={0.003}
                position={[D.forearmWidth / 2 - 0.0045, 0, 0]}
                castShadow
                receiveShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Top connecting bar */}
              <RoundedBox
                args={[D.forearmWidth, 0.018, D.forearmThick]}
                radius={0.003}
                position={[0, -D.forearmLength / 2 + 0.009, 0]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Bottom connecting bar */}
              <RoundedBox
                args={[D.forearmWidth, 0.014, D.forearmThick]}
                radius={0.003}
                position={[0, D.forearmLength / 2 - 0.007, 0]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* Center bridge */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[D.forearmWidth * 0.45, D.forearmLength * 0.25, D.forearmThick * 0.65]} />
                <meshStandardMaterial {...M.whiteShade} />
              </mesh>

              {/* Screw holes */}
              {[-0.25, 0.25].map((pos, i) => (
                <mesh key={`fa-screw-${i}`} position={[D.forearmWidth / 2 - 0.0045, pos * D.forearmLength * 0.7, D.forearmThick / 2 + 0.001]}>
                  <cylinderGeometry args={[0.0012, 0.0012, 0.002, 6]} />
                  <meshStandardMaterial {...M.chrome} />
                </mesh>
              ))}
              {[-0.25, 0.25].map((pos, i) => (
                <mesh key={`fa-screw2-${i}`} position={[-D.forearmWidth / 2 + 0.0045, pos * D.forearmLength * 0.7, D.forearmThick / 2 + 0.001]}>
                  <cylinderGeometry args={[0.0012, 0.0012, 0.002, 6]} />
                  <meshStandardMaterial {...M.chrome} />
                </mesh>
              ))}

              {/* Wire bundle running along forearm */}
              <WireBundle
                start={[D.forearmWidth / 2 + 0.003, -D.forearmLength / 2 + 0.012, D.forearmThick / 2 - 0.002]}
                end={[D.forearmWidth / 2 + 0.003, D.forearmLength / 2 - 0.008, D.forearmThick / 2 - 0.002]}
              />
            </group>

            {/* ==================== WRIST ==================== */}
            <group
              position={[0, 0.026 + D.forearmLength + 0.006, 0]}
              rotation={[wristRot, 0, 0]}
            >
              {/* MOTOR_HOLDER_SO101_WRIST - C-shaped bracket */}
              <group position={[0, D.wristBlockHeight / 2, 0]}>
                {/* Left side */}
                <RoundedBox
                  args={[0.008, D.wristBlockHeight, D.wristBlockDepth]}
                  radius={0.002}
                  position={[-D.wristBlockWidth / 2 + 0.004, 0, 0]}
                  castShadow
                >
                  <meshStandardMaterial {...M.white} />
                </RoundedBox>
                {/* Right side */}
                <RoundedBox
                  args={[0.008, D.wristBlockHeight, D.wristBlockDepth]}
                  radius={0.002}
                  position={[D.wristBlockWidth / 2 - 0.004, 0, 0]}
                  castShadow
                >
                  <meshStandardMaterial {...M.white} />
                </RoundedBox>
                {/* Back plate with dots */}
                <RoundedBox
                  args={[D.wristBlockWidth, D.wristBlockHeight, 0.006]}
                  radius={0.002}
                  position={[0, 0, -D.wristBlockDepth / 2 + 0.003]}
                  castShadow
                >
                  <meshStandardMaterial {...M.white} />
                </RoundedBox>
                {/* Dot-matrix holes */}
                {[-1, 1].map((x) =>
                  [-1, 0, 1].map((y) => (
                    <mesh
                      key={`wr-dot-${x}-${y}`}
                      position={[x * 0.007, y * 0.007, -D.wristBlockDepth / 2 + 0.007]}
                    >
                      <cylinderGeometry args={[0.0015, 0.0015, 0.003, 6]} />
                      <meshStandardMaterial {...M.whiteShade} />
                    </mesh>
                  ))
                )}
              </group>

              {/* Wrist servo */}
              <group position={[0, D.wristBlockHeight / 2, 0.002]} rotation={[0, 0, Math.PI / 2]}>
                <STS3215 scale={0.60} />
              </group>

              {/* Wrist roll connector */}
              <RoundedBox
                args={[0.022, 0.018, 0.022]}
                radius={0.004}
                position={[0, D.wristBlockHeight + 0.009, 0]}
                castShadow
              >
                <meshStandardMaterial {...M.white} />
              </RoundedBox>

              {/* ==================== GRIPPER ==================== */}
              <group position={[0, D.wristBlockHeight + 0.024, 0]}>
                {/* Gripper palm/base */}
                <RoundedBox
                  args={[D.gripperPalmWidth, D.gripperPalmHeight, D.gripperPalmDepth]}
                  radius={0.003}
                  position={[0, 0, 0]}
                  castShadow
                  receiveShadow
                >
                  <meshStandardMaterial {...M.white} />
                </RoundedBox>

                {/* Gripper servo (between jaws) */}
                <group position={[0, D.gripperPalmHeight / 2 + 0.008, 0]} rotation={[0, 0, 0]}>
                  <STS3215 scale={0.52} />
                </group>

                {/* Fixed jaw (right) - POINTED TRIANGULAR FINGER with holes */}
                <group position={[D.gripperPalmWidth / 2 - 0.006, D.gripperPalmHeight / 2 + 0.022, 0]}>
                  {/* Main finger body - tapered */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.012, D.fixedJawLength * 0.7, D.fixedJawThick]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Tapered tip section */}
                  <mesh position={[0.001, D.fixedJawLength * 0.35 + 0.012, 0]} castShadow>
                    <boxGeometry args={[0.008, 0.024, D.fixedJawThick * 0.85]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Pointed tip */}
                  <mesh position={[0.002, D.fixedJawLength * 0.35 + 0.028, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
                    <boxGeometry args={[0.005, 0.012, D.fixedJawThick * 0.7]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Line of holes along finger */}
                  {[0, 0.012, 0.024, 0.036].map((y, i) => (
                    <mesh key={`fj-hole-${i}`} position={[0, y - 0.008, D.fixedJawThick / 2 + 0.001]}>
                      <cylinderGeometry args={[0.0012, 0.0012, 0.003, 6]} />
                      <meshStandardMaterial {...M.whiteShade} />
                    </mesh>
                  ))}
                  {/* Mounting screws */}
                  <mesh position={[0, -D.fixedJawLength * 0.3, D.fixedJawThick / 2 + 0.001]}>
                    <cylinderGeometry args={[0.0015, 0.0015, 0.003, 6]} />
                    <meshStandardMaterial {...M.chrome} />
                  </mesh>
                </group>

                {/* Moving jaw (left) - POINTED TRIANGULAR FINGER with holes */}
                <group position={[-D.gripperPalmWidth / 2 + 0.006 + jawOffset, D.gripperPalmHeight / 2 + 0.022, 0]}>
                  {/* Main finger body - tapered */}
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[0.012, D.movingJawLength * 0.7, D.movingJawThick]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Tapered tip section */}
                  <mesh position={[-0.001, D.movingJawLength * 0.35 + 0.012, 0]} castShadow>
                    <boxGeometry args={[0.008, 0.024, D.movingJawThick * 0.85]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Pointed tip */}
                  <mesh position={[-0.002, D.movingJawLength * 0.35 + 0.028, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
                    <boxGeometry args={[0.005, 0.012, D.movingJawThick * 0.7]} />
                    <meshStandardMaterial {...M.white} />
                  </mesh>
                  {/* Line of holes along finger */}
                  {[0, 0.012, 0.024, 0.036].map((y, i) => (
                    <mesh key={`mj-hole-${i}`} position={[0, y - 0.008, D.movingJawThick / 2 + 0.001]}>
                      <cylinderGeometry args={[0.0012, 0.0012, 0.003, 6]} />
                      <meshStandardMaterial {...M.whiteShade} />
                    </mesh>
                  ))}
                  {/* Mounting screws */}
                  <mesh position={[0, -D.movingJawLength * 0.3, D.movingJawThick / 2 + 0.001]}>
                    <cylinderGeometry args={[0.0015, 0.0015, 0.003, 6]} />
                    <meshStandardMaterial {...M.chrome} />
                  </mesh>
                </group>

                {/* Wire bundle to gripper servo - forms a small loop */}
                <WireBundle
                  start={[D.gripperPalmWidth / 2 + 0.002, -0.008, D.gripperPalmDepth / 2 - 0.003]}
                  end={[D.gripperPalmWidth / 2 - 0.008, D.gripperPalmHeight / 2 + 0.012, D.gripperPalmDepth / 2 - 0.003]}
                />

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
