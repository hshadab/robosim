import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { JointState } from '../../types';

interface PhysicsArmProps {
  joints: JointState;
}

// PBR material property configurations (not instances - to avoid disposal issues)
const MATERIALS = {
  aluminum: {
    color: '#d4d8dc',
    metalness: 0.95,
    roughness: 0.35,
    envMapIntensity: 1.2,
    clearcoat: 0.1,
    clearcoatRoughness: 0.4,
  },
  servoBlue: {
    color: '#1a4a8a',
    metalness: 0.1,
    roughness: 0.3,
    envMapIntensity: 1.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
  },
  servoLight: {
    color: '#2860a8',
    metalness: 0.15,
    roughness: 0.35,
    envMapIntensity: 0.9,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  },
  blackPlastic: {
    color: '#1a1a1a',
    metalness: 0.0,
    roughness: 0.6,
    envMapIntensity: 0.5,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
  },
  bearing: {
    color: '#606060',
    metalness: 0.98,
    roughness: 0.15,
    envMapIntensity: 1.8,
  },
  gripperPad: {
    color: '#e05500',
    metalness: 0.0,
    roughness: 0.85,
    envMapIntensity: 0.3,
  },
  chrome: {
    color: '#ffffff',
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 2.5,
  },
};

// Servo component with inline PBR materials (avoids disposal issues)
const Servo: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Main servo body */}
      <RoundedBox args={[0.028, 0.04, 0.024]} radius={0.003} position={[0, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial {...MATERIALS.servoBlue} />
      </RoundedBox>
      {/* Servo horn */}
      <mesh position={[0, 0.018, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.01, 0.004, 16]} />
        <meshPhysicalMaterial {...MATERIALS.servoLight} />
      </mesh>
      {/* Center screw */}
      <mesh position={[0, 0.0205, 0]} castShadow>
        <cylinderGeometry args={[0.002, 0.002, 0.002, 8]} />
        <meshPhysicalMaterial {...MATERIALS.chrome} />
      </mesh>
      {/* Wire exit detail */}
      <mesh position={[0, -0.018, -0.01]} castShadow>
        <boxGeometry args={[0.008, 0.006, 0.004]} />
        <meshPhysicalMaterial {...MATERIALS.blackPlastic} />
      </mesh>
    </group>
  );
};

// Bracket component with inline PBR materials
const Bracket: React.FC<{
  length: number;
  width?: number;
  height?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ length, width = 0.026, height = 0.006, position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[length, height, width]} radius={0.0015} castShadow receiveShadow>
        <meshPhysicalMaterial {...MATERIALS.aluminum} />
      </RoundedBox>
      {/* Mounting holes detail */}
      <mesh position={[length * 0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.002, 0.002, height + 0.001, 8]} />
        <meshPhysicalMaterial {...MATERIALS.bearing} />
      </mesh>
      <mesh position={[-length * 0.35, 0, 0]} castShadow>
        <cylinderGeometry args={[0.002, 0.002, height + 0.001, 8]} />
        <meshPhysicalMaterial {...MATERIALS.bearing} />
      </mesh>
    </group>
  );
};

export const PhysicsArm: React.FC<PhysicsArmProps> = ({ joints }) => {
  // Refs for kinematic bodies
  const baseRef = useRef<RapierRigidBody>(null);
  const shoulderRef = useRef<RapierRigidBody>(null);
  const elbowRef = useRef<RapierRigidBody>(null);
  const wristRef = useRef<RapierRigidBody>(null);
  const leftFingerRef = useRef<RapierRigidBody>(null);
  const rightFingerRef = useRef<RapierRigidBody>(null);

  // Convert degrees to radians
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;
  const gripperOpen = joints.gripper / 100;

  // Arm segment lengths
  const baseHeight = 0.12;
  const upperArmLength = 0.1;
  const forearmLength = 0.088;
  const wristLength = 0.045;

  // Calculate forward kinematics for each segment
  useFrame(() => {
    // Base rotation (around Y axis)
    if (baseRef.current) {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -baseRad, 0));
      baseRef.current.setNextKinematicRotation(rotation);
    }

    // Calculate shoulder position and rotation
    const angle1 = shoulderRad;
    const shoulderPos = new THREE.Vector3(0, baseHeight, 0);

    if (shoulderRef.current) {
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -baseRad, angle1)
      );
      shoulderRef.current.setNextKinematicTranslation(shoulderPos);
      shoulderRef.current.setNextKinematicRotation(rotation);
    }

    // Calculate elbow position
    const angle2 = angle1 + elbowRad;
    const elbowPos = new THREE.Vector3(
      upperArmLength * Math.sin(angle1) * Math.cos(-baseRad),
      baseHeight + upperArmLength * Math.cos(angle1),
      upperArmLength * Math.sin(angle1) * Math.sin(-baseRad)
    );

    if (elbowRef.current) {
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -baseRad, angle2)
      );
      elbowRef.current.setNextKinematicTranslation(elbowPos);
      elbowRef.current.setNextKinematicRotation(rotation);
    }

    // Calculate wrist position
    const angle3 = angle2 + wristRad;
    const wristPos = new THREE.Vector3(
      elbowPos.x + forearmLength * Math.sin(angle2) * Math.cos(-baseRad),
      elbowPos.y + forearmLength * Math.cos(angle2),
      elbowPos.z + forearmLength * Math.sin(angle2) * Math.sin(-baseRad)
    );

    if (wristRef.current) {
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -baseRad, angle3)
      );
      wristRef.current.setNextKinematicTranslation(wristPos);
      wristRef.current.setNextKinematicRotation(rotation);
    }

    // Calculate gripper/finger positions
    const gripperPos = new THREE.Vector3(
      wristPos.x + wristLength * Math.sin(angle3) * Math.cos(-baseRad),
      wristPos.y + wristLength * Math.cos(angle3),
      wristPos.z + wristLength * Math.sin(angle3) * Math.sin(-baseRad)
    );

    const fingerOffset = 0.02 + gripperOpen * 0.03;
    const perpX = Math.cos(-baseRad);
    const perpZ = Math.sin(-baseRad);

    if (leftFingerRef.current) {
      leftFingerRef.current.setNextKinematicTranslation({
        x: gripperPos.x + perpX * fingerOffset,
        y: gripperPos.y,
        z: gripperPos.z + perpZ * fingerOffset,
      });
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -baseRad, angle3)
      );
      leftFingerRef.current.setNextKinematicRotation(rotation);
    }

    if (rightFingerRef.current) {
      rightFingerRef.current.setNextKinematicTranslation({
        x: gripperPos.x - perpX * fingerOffset,
        y: gripperPos.y,
        z: gripperPos.z - perpZ * fingerOffset,
      });
      const rotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, -baseRad, angle3)
      );
      rightFingerRef.current.setNextKinematicRotation(rotation);
    }
  });

  return (
    <group>
      {/* Static base - textured black plastic */}
      <RigidBody type="fixed" position={[0, 0.005, 0]}>
        <CylinderCollider args={[0.005, 0.06]} />
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.06, 0.068, 0.01, 48]} />
          <meshPhysicalMaterial {...MATERIALS.blackPlastic} />
        </mesh>
        {/* Decorative ring */}
        <mesh position={[0, 0.003, 0]} castShadow>
          <torusGeometry args={[0.058, 0.002, 8, 48]} />
          <meshPhysicalMaterial {...MATERIALS.chrome} />
        </mesh>
      </RigidBody>

      {/* Bearing ring - polished steel */}
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.05, 0.055, 0.008, 48]} />
        <meshPhysicalMaterial {...MATERIALS.bearing} />
      </mesh>

      {/* Rotating base tower - kinematic */}
      <RigidBody ref={baseRef} type="kinematicPosition" position={[0, 0.045, 0]}>
        <CuboidCollider args={[0.025, 0.02, 0.02]} />
        <RoundedBox args={[0.05, 0.04, 0.04]} radius={0.003} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.aluminum} />
        </RoundedBox>
        <Servo position={[0, 0.025, 0]} scale={1.2} />
        <RoundedBox args={[0.06, 0.05, 0.045]} radius={0.004} position={[0, 0.055, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.aluminum} />
        </RoundedBox>
        {/* Ventilation slots detail */}
        {[-0.015, 0, 0.015].map((z, i) => (
          <mesh key={i} position={[0.031, 0.055, z]} castShadow>
            <boxGeometry args={[0.002, 0.03, 0.006]} />
            <meshPhysicalMaterial {...MATERIALS.blackPlastic} />
          </mesh>
        ))}
      </RigidBody>

      {/* Upper arm - kinematic */}
      <RigidBody ref={shoulderRef} type="kinematicPosition" position={[0, baseHeight, 0]}>
        <CuboidCollider args={[0.013, upperArmLength / 2, 0.013]} position={[0, upperArmLength / 2, 0]} />
        <Servo position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]} />
        <group position={[0, upperArmLength / 2, 0]}>
          <Bracket length={upperArmLength} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      </RigidBody>

      {/* Forearm - kinematic */}
      <RigidBody ref={elbowRef} type="kinematicPosition" position={[0, baseHeight + upperArmLength, 0]}>
        <CuboidCollider args={[0.011, forearmLength / 2, 0.011]} position={[0, forearmLength / 2, 0]} />
        <Servo position={[0, 0, 0.018]} rotation={[Math.PI / 2, 0, 0]} scale={0.9} />
        <group position={[0, forearmLength / 2, 0]}>
          <Bracket length={forearmLength} width={0.022} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      </RigidBody>

      {/* Wrist - kinematic */}
      <RigidBody ref={wristRef} type="kinematicPosition" position={[0, baseHeight + upperArmLength + forearmLength, 0]}>
        <CuboidCollider args={[0.009, wristLength / 2, 0.009]} position={[0, wristLength / 2, 0]} />
        <Servo position={[0, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]} scale={0.8} />
        <group position={[0, wristLength / 2, 0]}>
          <Bracket length={wristLength} width={0.018} height={0.005} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        </group>
        {/* Gripper mount */}
        <RoundedBox args={[0.028, 0.015, 0.02]} radius={0.002} position={[0, wristLength, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.bearing} />
        </RoundedBox>
        <RoundedBox args={[0.02, 0.012, 0.016]} radius={0.002} position={[0, wristLength + 0.006, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.servoBlue} />
        </RoundedBox>
      </RigidBody>

      {/* Left finger - kinematic, for physics interaction */}
      <RigidBody ref={leftFingerRef} type="kinematicPosition" position={[0.02, baseHeight + upperArmLength + forearmLength + wristLength, 0]}>
        <CuboidCollider args={[0.003, 0.025, 0.004]} position={[0, 0.018, 0]} />
        <RoundedBox args={[0.006, 0.036, 0.008]} radius={0.001} position={[0, 0.018, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.aluminum} />
        </RoundedBox>
        {/* Rubber grip pad */}
        <mesh position={[0, 0.034, 0]} castShadow>
          <sphereGeometry args={[0.007, 16, 16]} />
          <meshPhysicalMaterial {...MATERIALS.gripperPad} />
        </mesh>
        {/* Inner grip texture */}
        <mesh position={[-0.003, 0.034, 0]} castShadow>
          <boxGeometry args={[0.002, 0.01, 0.006]} />
          <meshPhysicalMaterial {...MATERIALS.gripperPad} />
        </mesh>
      </RigidBody>

      {/* Right finger - kinematic, for physics interaction */}
      <RigidBody ref={rightFingerRef} type="kinematicPosition" position={[-0.02, baseHeight + upperArmLength + forearmLength + wristLength, 0]}>
        <CuboidCollider args={[0.003, 0.025, 0.004]} position={[0, 0.018, 0]} />
        <RoundedBox args={[0.006, 0.036, 0.008]} radius={0.001} position={[0, 0.018, 0]} castShadow receiveShadow>
          <meshPhysicalMaterial {...MATERIALS.aluminum} />
        </RoundedBox>
        {/* Rubber grip pad */}
        <mesh position={[0, 0.034, 0]} castShadow>
          <sphereGeometry args={[0.007, 16, 16]} />
          <meshPhysicalMaterial {...MATERIALS.gripperPad} />
        </mesh>
        {/* Inner grip texture */}
        <mesh position={[0.003, 0.034, 0]} castShadow>
          <boxGeometry args={[0.002, 0.01, 0.006]} />
          <meshPhysicalMaterial {...MATERIALS.gripperPad} />
        </mesh>
      </RigidBody>
    </group>
  );
};
