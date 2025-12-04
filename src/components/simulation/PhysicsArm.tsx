import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { JointState } from '../../types';

interface PhysicsArmProps {
  joints: JointState;
}

// Material colors
const COLORS = {
  aluminum: '#C8CED6',
  servoBlue: '#1E5FAB',
  servoLight: '#2B74C4',
  blackPlastic: '#2A2A2A',
  bearing: '#4A4A4A',
  gripperPad: '#E65C00',
};

// Servo component with inline materials
const Servo: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}> = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <RoundedBox args={[0.028, 0.04, 0.024]} radius={0.002} position={[0, 0, 0]}>
        <meshStandardMaterial color={COLORS.servoBlue} metalness={0.3} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.018, 0]}>
        <boxGeometry args={[0.024, 0.004, 0.02]} />
        <meshStandardMaterial color={COLORS.servoLight} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
};

// Bracket component with inline materials
const Bracket: React.FC<{
  length: number;
  width?: number;
  height?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ length, width = 0.026, height = 0.006, position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[length, height, width]} radius={0.002}>
        <meshStandardMaterial color={COLORS.aluminum} metalness={0.7} roughness={0.4} />
      </RoundedBox>
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
      {/* Static base */}
      <RigidBody type="fixed" position={[0, 0.005, 0]}>
        <CylinderCollider args={[0.005, 0.06]} />
        <mesh>
          <cylinderGeometry args={[0.06, 0.065, 0.01, 32]} />
          <meshStandardMaterial color={COLORS.blackPlastic} metalness={0.1} roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Bearing ring */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.008, 32]} />
        <meshStandardMaterial color={COLORS.bearing} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Rotating base tower - kinematic */}
      <RigidBody ref={baseRef} type="kinematicPosition" position={[0, 0.045, 0]}>
        <CuboidCollider args={[0.025, 0.02, 0.02]} />
        <mesh>
          <boxGeometry args={[0.05, 0.04, 0.04]} />
          <meshStandardMaterial color={COLORS.aluminum} metalness={0.7} roughness={0.4} />
        </mesh>
        <Servo position={[0, 0.025, 0]} scale={1.2} />
        <mesh position={[0, 0.055, 0]}>
          <boxGeometry args={[0.06, 0.05, 0.045]} />
          <meshStandardMaterial color={COLORS.aluminum} metalness={0.7} roughness={0.4} />
        </mesh>
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
        <mesh position={[0, wristLength, 0]}>
          <boxGeometry args={[0.028, 0.015, 0.02]} />
          <meshStandardMaterial color={COLORS.bearing} metalness={0.5} roughness={0.6} />
        </mesh>
        <mesh position={[0, wristLength + 0.006, 0]}>
          <boxGeometry args={[0.02, 0.012, 0.016]} />
          <meshStandardMaterial color={COLORS.servoBlue} metalness={0.3} roughness={0.6} />
        </mesh>
      </RigidBody>

      {/* Left finger - kinematic, for physics interaction */}
      <RigidBody ref={leftFingerRef} type="kinematicPosition" position={[0.02, baseHeight + upperArmLength + forearmLength + wristLength, 0]}>
        <CuboidCollider args={[0.003, 0.025, 0.004]} position={[0, 0.018, 0]} />
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.006, 0.036, 0.008]} />
          <meshStandardMaterial color={COLORS.aluminum} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.034, 0]}>
          <sphereGeometry args={[0.006, 12, 12]} />
          <meshStandardMaterial color={COLORS.gripperPad} metalness={0.0} roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* Right finger - kinematic, for physics interaction */}
      <RigidBody ref={rightFingerRef} type="kinematicPosition" position={[-0.02, baseHeight + upperArmLength + forearmLength + wristLength, 0]}>
        <CuboidCollider args={[0.003, 0.025, 0.004]} position={[0, 0.018, 0]} />
        <mesh position={[0, 0.018, 0]}>
          <boxGeometry args={[0.006, 0.036, 0.008]} />
          <meshStandardMaterial color={COLORS.aluminum} metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.034, 0]}>
          <sphereGeometry args={[0.006, 12, 12]} />
          <meshStandardMaterial color={COLORS.gripperPad} metalness={0.0} roughness={0.9} />
        </mesh>
      </RigidBody>
    </group>
  );
};
