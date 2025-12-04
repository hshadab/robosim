/**
 * Berkeley Humanoid Lite 3D Component
 * A simplified geometric representation of the Berkeley Humanoid Lite robot
 * Based on specs: 0.8m tall, 16kg, 22 DOF
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HumanoidState } from '../../types';

// Robot dimensions (in meters, scaled for scene)
const SCALE = 1;
const DIMENSIONS = {
  // Torso
  torsoHeight: 0.25 * SCALE,
  torsoWidth: 0.18 * SCALE,
  torsoDepth: 0.12 * SCALE,

  // Head
  headRadius: 0.06 * SCALE,
  neckHeight: 0.04 * SCALE,

  // Arms
  upperArmLength: 0.12 * SCALE,
  upperArmRadius: 0.025 * SCALE,
  lowerArmLength: 0.11 * SCALE,
  lowerArmRadius: 0.02 * SCALE,
  handLength: 0.05 * SCALE,

  // Legs
  hipWidth: 0.14 * SCALE,
  upperLegLength: 0.18 * SCALE,
  upperLegRadius: 0.035 * SCALE,
  lowerLegLength: 0.17 * SCALE,
  lowerLegRadius: 0.03 * SCALE,
  footLength: 0.1 * SCALE,
  footHeight: 0.03 * SCALE,
  footWidth: 0.06 * SCALE,
};

// Calculate total leg height for proper standing position
// torsoHeight/2 + hip joint (0.04) + upperLeg (0.18 + 0.04) + lowerLeg (0.17 + 0.04) + ankle (0.025) + foot (0.03)
const STANDING_HEIGHT =
  DIMENSIONS.torsoHeight / 2 + 0.04 +  // hip joint
  DIMENSIONS.upperLegLength + 0.04 +    // upper leg + knee
  DIMENSIONS.lowerLegLength + 0.04 +    // lower leg + ankle
  DIMENSIONS.footHeight;                 // foot

// Default humanoid state
export const DEFAULT_HUMANOID_STATE: HumanoidState = {
  position: { x: 0, y: STANDING_HEIGHT, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },

  // Leg joints (degrees)
  leftHipPitch: 0,
  leftHipRoll: 0,
  leftHipYaw: 0,
  leftKnee: 0,
  leftAnklePitch: 0,
  leftAnkleRoll: 0,

  rightHipPitch: 0,
  rightHipRoll: 0,
  rightHipYaw: 0,
  rightKnee: 0,
  rightAnklePitch: 0,
  rightAnkleRoll: 0,

  // Arm joints (degrees)
  leftShoulderPitch: 0,
  leftShoulderRoll: 0,
  leftShoulderYaw: 0,
  leftElbow: 0,
  leftWrist: 0,

  rightShoulderPitch: 0,
  rightShoulderRoll: 0,
  rightShoulderYaw: 0,
  rightElbow: 0,
  rightWrist: 0,

  // State
  isWalking: false,
  walkPhase: 0,
  balance: { x: 0, z: 0 },
};

// Materials
const createMaterials = () => ({
  body: new THREE.MeshStandardMaterial({
    color: '#2563eb',
    metalness: 0.6,
    roughness: 0.4
  }),
  joint: new THREE.MeshStandardMaterial({
    color: '#1e40af',
    metalness: 0.7,
    roughness: 0.3
  }),
  limb: new THREE.MeshStandardMaterial({
    color: '#3b82f6',
    metalness: 0.5,
    roughness: 0.5
  }),
  hand: new THREE.MeshStandardMaterial({
    color: '#60a5fa',
    metalness: 0.4,
    roughness: 0.6
  }),
  foot: new THREE.MeshStandardMaterial({
    color: '#1e3a8a',
    metalness: 0.5,
    roughness: 0.5
  }),
  head: new THREE.MeshStandardMaterial({
    color: '#dbeafe',
    metalness: 0.3,
    roughness: 0.7
  }),
  eye: new THREE.MeshStandardMaterial({
    color: '#0ea5e9',
    emissive: '#0ea5e9',
    emissiveIntensity: 0.5,
  }),
});

// Limb component
const Limb: React.FC<{
  length: number;
  radius: number;
  material: THREE.Material;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ length, radius, material, position = [0, 0, 0], rotation = [0, 0, 0] }) => (
  <mesh position={position} rotation={rotation} castShadow>
    <capsuleGeometry args={[radius, length, 8, 16]} />
    <primitive object={material} attach="material" />
  </mesh>
);

// Joint sphere
const Joint: React.FC<{
  radius: number;
  material: THREE.Material;
  position?: [number, number, number];
}> = ({ radius, material, position = [0, 0, 0] }) => (
  <mesh position={position} castShadow>
    <sphereGeometry args={[radius, 16, 16]} />
    <primitive object={material} attach="material" />
  </mesh>
);

interface Humanoid3DProps {
  state: HumanoidState;
}

export const Humanoid3D: React.FC<Humanoid3DProps> = ({ state }) => {
  const groupRef = useRef<THREE.Group>(null);
  const materials = useMemo(() => createMaterials(), []);

  // Convert degrees to radians
  const deg2rad = (deg: number) => (deg * Math.PI) / 180;

  // Walking animation
  useFrame((_, delta) => {
    if (state.isWalking && groupRef.current) {
      // Could add subtle body sway here
    }
  });

  const d = DIMENSIONS;

  // Calculate leg positions for walking
  const walkCycle = state.walkPhase;
  const walkAmplitude = state.isWalking ? 15 : 0;

  return (
    <group
      ref={groupRef}
      position={[state.position.x, state.position.y, state.position.z]}
      rotation={[deg2rad(state.rotation.x), deg2rad(state.rotation.y), deg2rad(state.rotation.z)]}
    >
      {/* Torso */}
      <mesh castShadow>
        <boxGeometry args={[d.torsoWidth, d.torsoHeight, d.torsoDepth]} />
        <primitive object={materials.body} attach="material" />
      </mesh>

      {/* Chest detail */}
      <mesh position={[0, d.torsoHeight * 0.1, d.torsoDepth * 0.4]} castShadow>
        <boxGeometry args={[d.torsoWidth * 0.6, d.torsoHeight * 0.4, 0.02]} />
        <primitive object={materials.joint} attach="material" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, d.torsoHeight / 2 + d.neckHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, d.neckHeight, 16]} />
        <primitive object={materials.joint} attach="material" />
      </mesh>

      {/* Head */}
      <group position={[0, d.torsoHeight / 2 + d.neckHeight + d.headRadius, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[d.headRadius, 24, 24]} />
          <primitive object={materials.head} attach="material" />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.02, 0.01, d.headRadius * 0.9]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <primitive object={materials.eye} attach="material" />
        </mesh>
        <mesh position={[-0.02, 0.01, d.headRadius * 0.9]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <primitive object={materials.eye} attach="material" />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.01, d.headRadius * 0.85]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.07, 0.02, 0.01]} />
          <primitive object={materials.joint} attach="material" />
        </mesh>
      </group>

      {/* Left Arm */}
      <group position={[d.torsoWidth / 2 + 0.02, d.torsoHeight * 0.35, 0]}>
        {/* Shoulder joint */}
        <group rotation={[
          deg2rad(state.leftShoulderPitch),
          deg2rad(state.leftShoulderYaw),
          deg2rad(state.leftShoulderRoll - 10)
        ]}>
          <Joint radius={0.03} material={materials.joint} />

          {/* Upper arm */}
          <group position={[d.upperArmLength / 2 + 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <Limb length={d.upperArmLength} radius={d.upperArmRadius} material={materials.limb} />
          </group>

          {/* Elbow */}
          <group position={[d.upperArmLength + 0.04, 0, 0]}>
            <group rotation={[deg2rad(-state.leftElbow), 0, 0]}>
              <Joint radius={0.025} material={materials.joint} />

              {/* Lower arm */}
              <group position={[d.lowerArmLength / 2 + 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <Limb length={d.lowerArmLength} radius={d.lowerArmRadius} material={materials.limb} />
              </group>

              {/* Wrist & Hand */}
              <group position={[d.lowerArmLength + 0.04, 0, 0]} rotation={[deg2rad(state.leftWrist), 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[d.handLength, 0.04, 0.025]} />
                  <primitive object={materials.hand} attach="material" />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Right Arm (mirrored) */}
      <group position={[-(d.torsoWidth / 2 + 0.02), d.torsoHeight * 0.35, 0]}>
        <group rotation={[
          deg2rad(state.rightShoulderPitch),
          deg2rad(-state.rightShoulderYaw),
          deg2rad(-(state.rightShoulderRoll - 10))
        ]}>
          <Joint radius={0.03} material={materials.joint} />

          <group position={[-(d.upperArmLength / 2 + 0.02), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <Limb length={d.upperArmLength} radius={d.upperArmRadius} material={materials.limb} />
          </group>

          <group position={[-(d.upperArmLength + 0.04), 0, 0]}>
            <group rotation={[deg2rad(-state.rightElbow), 0, 0]}>
              <Joint radius={0.025} material={materials.joint} />

              <group position={[-(d.lowerArmLength / 2 + 0.02), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <Limb length={d.lowerArmLength} radius={d.lowerArmRadius} material={materials.limb} />
              </group>

              <group position={[-(d.lowerArmLength + 0.04), 0, 0]} rotation={[deg2rad(state.rightWrist), 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[d.handLength, 0.04, 0.025]} />
                  <primitive object={materials.hand} attach="material" />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Left Leg */}
      <group position={[d.hipWidth / 2, -d.torsoHeight / 2, 0]}>
        {/* Hip joint */}
        <group rotation={[
          deg2rad(state.leftHipPitch + (state.isWalking ? Math.sin(walkCycle) * walkAmplitude : 0)),
          deg2rad(state.leftHipYaw),
          deg2rad(state.leftHipRoll)
        ]}>
          <Joint radius={0.04} material={materials.joint} />

          {/* Upper leg */}
          <group position={[0, -d.upperLegLength / 2 - 0.02, 0]}>
            <Limb length={d.upperLegLength} radius={d.upperLegRadius} material={materials.limb} />
          </group>

          {/* Knee */}
          <group position={[0, -d.upperLegLength - 0.04, 0]}>
            <group rotation={[deg2rad(-state.leftKnee - (state.isWalking ? Math.max(0, Math.sin(walkCycle)) * walkAmplitude * 2 : 0)), 0, 0]}>
              <Joint radius={0.035} material={materials.joint} />

              {/* Lower leg */}
              <group position={[0, -d.lowerLegLength / 2 - 0.02, 0]}>
                <Limb length={d.lowerLegLength} radius={d.lowerLegRadius} material={materials.limb} />
              </group>

              {/* Ankle */}
              <group position={[0, -d.lowerLegLength - 0.04, 0]}>
                <group rotation={[
                  deg2rad(state.leftAnklePitch - (state.isWalking ? Math.sin(walkCycle) * walkAmplitude * 0.5 : 0)),
                  0,
                  deg2rad(state.leftAnkleRoll)
                ]}>
                  <Joint radius={0.025} material={materials.joint} />

                  {/* Foot */}
                  <mesh position={[0, -d.footHeight / 2, d.footLength * 0.2]} castShadow>
                    <boxGeometry args={[d.footWidth, d.footHeight, d.footLength]} />
                    <primitive object={materials.foot} attach="material" />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* Right Leg (mirrored, phase offset for walking) */}
      <group position={[-d.hipWidth / 2, -d.torsoHeight / 2, 0]}>
        <group rotation={[
          deg2rad(state.rightHipPitch + (state.isWalking ? Math.sin(walkCycle + Math.PI) * walkAmplitude : 0)),
          deg2rad(-state.rightHipYaw),
          deg2rad(-state.rightHipRoll)
        ]}>
          <Joint radius={0.04} material={materials.joint} />

          <group position={[0, -d.upperLegLength / 2 - 0.02, 0]}>
            <Limb length={d.upperLegLength} radius={d.upperLegRadius} material={materials.limb} />
          </group>

          <group position={[0, -d.upperLegLength - 0.04, 0]}>
            <group rotation={[deg2rad(-state.rightKnee - (state.isWalking ? Math.max(0, Math.sin(walkCycle + Math.PI)) * walkAmplitude * 2 : 0)), 0, 0]}>
              <Joint radius={0.035} material={materials.joint} />

              <group position={[0, -d.lowerLegLength / 2 - 0.02, 0]}>
                <Limb length={d.lowerLegLength} radius={d.lowerLegRadius} material={materials.limb} />
              </group>

              <group position={[0, -d.lowerLegLength - 0.04, 0]}>
                <group rotation={[
                  deg2rad(state.rightAnklePitch - (state.isWalking ? Math.sin(walkCycle + Math.PI) * walkAmplitude * 0.5 : 0)),
                  0,
                  deg2rad(-state.rightAnkleRoll)
                ]}>
                  <Joint radius={0.025} material={materials.joint} />

                  <mesh position={[0, -d.footHeight / 2, d.footLength * 0.2]} castShadow>
                    <boxGeometry args={[d.footWidth, d.footHeight, d.footLength]} />
                    <primitive object={materials.foot} attach="material" />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

// Humanoid configuration
export const HUMANOID_CONFIG = {
  name: 'Berkeley Humanoid Lite',
  manufacturer: 'UC Berkeley',
  height: 0.8,
  weight: 16,
  dof: 22,
  description: 'Open-source, sub-$5000 humanoid robot with 3D-printed gearboxes',
  joints: {
    // Leg joints (per leg)
    hipPitch: { min: -60, max: 60 },
    hipRoll: { min: -30, max: 30 },
    hipYaw: { min: -45, max: 45 },
    knee: { min: 0, max: 120 },
    anklePitch: { min: -45, max: 45 },
    ankleRoll: { min: -20, max: 20 },
    // Arm joints (per arm)
    shoulderPitch: { min: -180, max: 60 },
    shoulderRoll: { min: -90, max: 90 },
    shoulderYaw: { min: -90, max: 90 },
    elbow: { min: 0, max: 135 },
    wrist: { min: -90, max: 90 },
  },
};
