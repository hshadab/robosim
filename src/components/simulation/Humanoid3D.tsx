/**
 * Berkeley Humanoid Lite 3D Component
 * A simplified geometric representation of the Berkeley Humanoid Lite robot
 * Based on specs: 0.8m tall, 16kg, 22 DOF
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { HumanoidState } from '../../types';
import { HUMANOID_DIMENSIONS } from './defaults';

// PBR Material property configurations (not instances - to avoid disposal issues)
const MATERIALS = {
  body: {
    color: '#e8e8e8',
    metalness: 0.85,
    roughness: 0.25,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.2,
  },
  joint: {
    color: '#1e40af',
    metalness: 0.9,
    roughness: 0.2,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.5,
  },
  limb: {
    color: '#d4d4d4',
    metalness: 0.8,
    roughness: 0.35,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    envMapIntensity: 1.1,
  },
  hand: {
    color: '#a8a8a8',
    metalness: 0.7,
    roughness: 0.4,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.0,
  },
  foot: {
    color: '#1a1a1a',
    metalness: 0.1,
    roughness: 0.7,
    clearcoat: 0.2,
    envMapIntensity: 0.6,
  },
  head: {
    color: '#f5f5f5',
    metalness: 0.2,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.3,
  },
  eye: {
    color: '#0ea5e9',
    emissive: '#0ea5e9',
    emissiveIntensity: 0.8,
    metalness: 0.5,
    roughness: 0.2,
  },
  visor: {
    color: '#0a0a0a',
    metalness: 0.9,
    roughness: 0.05,
    envMapIntensity: 2.5,
  },
  accent: {
    color: '#3b82f6',
    metalness: 0.8,
    roughness: 0.25,
    clearcoat: 0.6,
    envMapIntensity: 1.4,
  },
};

// Limb component with inline material
const Limb: React.FC<{
  length: number;
  radius: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}> = ({ length, radius, position = [0, 0, 0], rotation = [0, 0, 0] }) => (
  <mesh position={position} rotation={rotation} castShadow>
    <capsuleGeometry args={[radius, length, 8, 16]} />
    <meshPhysicalMaterial {...MATERIALS.limb} />
  </mesh>
);

// Joint sphere with inline material
const Joint: React.FC<{
  radius: number;
  position?: [number, number, number];
}> = ({ radius, position = [0, 0, 0] }) => (
  <mesh position={position} castShadow>
    <sphereGeometry args={[radius, 16, 16]} />
    <meshPhysicalMaterial {...MATERIALS.joint} />
  </mesh>
);

interface Humanoid3DProps {
  state: HumanoidState;
}

export const Humanoid3D: React.FC<Humanoid3DProps> = ({ state }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Convert degrees to radians
  const deg2rad = (deg: number) => (deg * Math.PI) / 180;

  // Walking animation
  useFrame(() => {
    if (state.isWalking && groupRef.current) {
      // Could add subtle body sway here
    }
  });

  const d = HUMANOID_DIMENSIONS;

  // Calculate leg positions for walking
  const walkCycle = state.walkPhase;
  const walkAmplitude = state.isWalking ? 15 : 0;

  return (
    <group
      ref={groupRef}
      position={[state.position.x, state.position.y, state.position.z]}
      rotation={[deg2rad(state.rotation.x), deg2rad(state.rotation.y), deg2rad(state.rotation.z)]}
    >
      {/* Torso - main body */}
      <mesh castShadow>
        <boxGeometry args={[d.torsoWidth, d.torsoHeight, d.torsoDepth]} />
        <meshPhysicalMaterial {...MATERIALS.body} />
      </mesh>

      {/* Torso panel lines */}
      <mesh position={[0, 0, d.torsoDepth / 2 + 0.001]}>
        <planeGeometry args={[d.torsoWidth * 0.9, d.torsoHeight * 0.9]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Chest detail - accent panel */}
      <mesh position={[0, d.torsoHeight * 0.1, d.torsoDepth * 0.45]} castShadow>
        <boxGeometry args={[d.torsoWidth * 0.6, d.torsoHeight * 0.4, 0.015]} />
        <meshPhysicalMaterial {...MATERIALS.accent} />
      </mesh>

      {/* Chest logo/sensor */}
      <mesh position={[0, d.torsoHeight * 0.15, d.torsoDepth / 2 + 0.008]}>
        <circleGeometry args={[0.02, 24]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0ea5e9" emissiveIntensity={0.3} />
      </mesh>

      {/* Side vents */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (d.torsoWidth / 2 + 0.001), 0, 0]} rotation={[0, side * Math.PI / 2, 0]}>
          {Array.from({ length: 3 }).map((_, i) => (
            <mesh key={i} position={[0, (i - 1) * 0.03, 0]}>
              <planeGeometry args={[d.torsoDepth * 0.6, 0.008]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Neck - metallic cylinder */}
      <mesh position={[0, d.torsoHeight / 2 + d.neckHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, d.neckHeight, 20]} />
        <meshPhysicalMaterial {...MATERIALS.joint} />
      </mesh>

      {/* Head */}
      <group position={[0, d.torsoHeight / 2 + d.neckHeight + d.headRadius, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[d.headRadius, 32, 32]} />
          <meshPhysicalMaterial {...MATERIALS.head} />
        </mesh>
        {/* Face plate */}
        <mesh position={[0, 0, d.headRadius * 0.7]} rotation={[0.1, 0, 0]}>
          <planeGeometry args={[d.headRadius * 1.2, d.headRadius * 0.8]} />
          <meshPhysicalMaterial color="#f0f0f0" metalness={0.3} roughness={0.2} clearcoat={0.8} />
        </mesh>
        {/* Eyes - glowing */}
        <mesh position={[0.02, 0.01, d.headRadius * 0.92]}>
          <sphereGeometry args={[0.012, 16, 16]} />
          <meshStandardMaterial {...MATERIALS.eye} />
        </mesh>
        <mesh position={[-0.02, 0.01, d.headRadius * 0.92]}>
          <sphereGeometry args={[0.012, 16, 16]} />
          <meshStandardMaterial {...MATERIALS.eye} />
        </mesh>
        {/* Visor - glossy black */}
        <mesh position={[0, 0.01, d.headRadius * 0.88]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.07, 0.02, 0.008]} />
          <meshPhysicalMaterial {...MATERIALS.visor} />
        </mesh>
        {/* Ear sensors */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * d.headRadius * 0.85, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.01, 0.015, 12]} />
            <meshPhysicalMaterial {...MATERIALS.joint} />
          </mesh>
        ))}
      </group>

      {/* Left Arm */}
      <group position={[d.torsoWidth / 2 + 0.02, d.torsoHeight * 0.35, 0]}>
        {/* Shoulder joint */}
        <group rotation={[
          deg2rad(state.leftShoulderPitch),
          deg2rad(state.leftShoulderYaw),
          deg2rad(state.leftShoulderRoll - 10)
        ]}>
          <Joint radius={0.03} />

          {/* Upper arm */}
          <group position={[d.upperArmLength / 2 + 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <Limb length={d.upperArmLength} radius={d.upperArmRadius} />
          </group>

          {/* Elbow */}
          <group position={[d.upperArmLength + 0.04, 0, 0]}>
            <group rotation={[deg2rad(-state.leftElbow), 0, 0]}>
              <Joint radius={0.025} />

              {/* Lower arm */}
              <group position={[d.lowerArmLength / 2 + 0.02, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <Limb length={d.lowerArmLength} radius={d.lowerArmRadius} />
              </group>

              {/* Wrist & Hand */}
              <group position={[d.lowerArmLength + 0.04, 0, 0]} rotation={[deg2rad(state.leftWrist), 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[d.handLength, 0.04, 0.025]} />
                  <meshPhysicalMaterial {...MATERIALS.hand} />
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
          <Joint radius={0.03} />

          <group position={[-(d.upperArmLength / 2 + 0.02), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <Limb length={d.upperArmLength} radius={d.upperArmRadius} />
          </group>

          <group position={[-(d.upperArmLength + 0.04), 0, 0]}>
            <group rotation={[deg2rad(-state.rightElbow), 0, 0]}>
              <Joint radius={0.025} />

              <group position={[-(d.lowerArmLength / 2 + 0.02), 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <Limb length={d.lowerArmLength} radius={d.lowerArmRadius} />
              </group>

              <group position={[-(d.lowerArmLength + 0.04), 0, 0]} rotation={[deg2rad(state.rightWrist), 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[d.handLength, 0.04, 0.025]} />
                  <meshPhysicalMaterial {...MATERIALS.hand} />
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
          <Joint radius={0.04} />

          {/* Upper leg */}
          <group position={[0, -d.upperLegLength / 2 - 0.02, 0]}>
            <Limb length={d.upperLegLength} radius={d.upperLegRadius} />
          </group>

          {/* Knee */}
          <group position={[0, -d.upperLegLength - 0.04, 0]}>
            <group rotation={[deg2rad(-state.leftKnee - (state.isWalking ? Math.max(0, Math.sin(walkCycle)) * walkAmplitude * 2 : 0)), 0, 0]}>
              <Joint radius={0.035} />

              {/* Lower leg */}
              <group position={[0, -d.lowerLegLength / 2 - 0.02, 0]}>
                <Limb length={d.lowerLegLength} radius={d.lowerLegRadius} />
              </group>

              {/* Ankle */}
              <group position={[0, -d.lowerLegLength - 0.04, 0]}>
                <group rotation={[
                  deg2rad(state.leftAnklePitch - (state.isWalking ? Math.sin(walkCycle) * walkAmplitude * 0.5 : 0)),
                  0,
                  deg2rad(state.leftAnkleRoll)
                ]}>
                  <Joint radius={0.025} />

                  {/* Foot */}
                  <mesh position={[0, -d.footHeight / 2, d.footLength * 0.2]} castShadow>
                    <boxGeometry args={[d.footWidth, d.footHeight, d.footLength]} />
                    <meshPhysicalMaterial {...MATERIALS.foot} />
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
          <Joint radius={0.04} />

          <group position={[0, -d.upperLegLength / 2 - 0.02, 0]}>
            <Limb length={d.upperLegLength} radius={d.upperLegRadius} />
          </group>

          <group position={[0, -d.upperLegLength - 0.04, 0]}>
            <group rotation={[deg2rad(-state.rightKnee - (state.isWalking ? Math.max(0, Math.sin(walkCycle + Math.PI)) * walkAmplitude * 2 : 0)), 0, 0]}>
              <Joint radius={0.035} />

              <group position={[0, -d.lowerLegLength / 2 - 0.02, 0]}>
                <Limb length={d.lowerLegLength} radius={d.lowerLegRadius} />
              </group>

              <group position={[0, -d.lowerLegLength - 0.04, 0]}>
                <group rotation={[
                  deg2rad(state.rightAnklePitch - (state.isWalking ? Math.sin(walkCycle + Math.PI) * walkAmplitude * 0.5 : 0)),
                  0,
                  deg2rad(-state.rightAnkleRoll)
                ]}>
                  <Joint radius={0.025} />

                  <mesh position={[0, -d.footHeight / 2, d.footLength * 0.2]} castShadow>
                    <boxGeometry args={[d.footWidth, d.footHeight, d.footLength]} />
                    <meshPhysicalMaterial {...MATERIALS.foot} />
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
