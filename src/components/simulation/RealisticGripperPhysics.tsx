/**
 * Realistic Gripper Physics for SO-101 Robot Arm
 *
 * This component creates physics-accurate jaw colliders that:
 * 1. Follow the actual URDF link positions/orientations
 * 2. Moving jaw rotates with gripper joint value
 * 3. Uses high friction for physics-based object gripping
 * 4. Objects are held by friction forces, not "teleport attach"
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

// Jaw dimensions for colliders - sized to match actual gripper jaws
const JAW_LENGTH = 0.035; // 3.5cm length (along jaw)
const JAW_THICKNESS = 0.008; // 0.8cm thick
const JAW_DEPTH = 0.015; // 1.5cm depth

// High friction for gripping
const JAW_FRICTION = 2.0;

interface RealisticGripperPhysicsProps {
  joints: JointState;
}

/**
 * Creates physics colliders for both gripper jaws that:
 * - Track actual gripper position/orientation from URDF
 * - Moving jaw rotates based on gripper joint value
 * - Use high friction for realistic object gripping
 */
export const RealisticGripperPhysics: React.FC<RealisticGripperPhysicsProps> = ({ joints }) => {
  // Refs for the jaw rigid bodies
  const fixedJawRef = useRef<RapierRigidBody>(null);
  const movingJawRef = useRef<RapierRigidBody>(null);

  // State for jaw positions - triggers re-render to move visual meshes
  const [fixedJawPos, setFixedJawPos] = useState<[number, number, number]>([0, 0.2, 0]);
  const [movingJawPos, setMovingJawPos] = useState<[number, number, number]>([0, 0.2, 0]);
  const [jawRotation, setJawRotation] = useState<[number, number, number, number]>([0, 0, 0, 1]);

  // Reusable objects to avoid allocations
  const gripperQuat = useRef(new THREE.Quaternion());
  const jawOffset = useRef(new THREE.Vector3());

  useFrame(() => {
    // CRITICAL: Read directly from store to avoid React prop timing issues
    const currentJoints = useAppStore.getState().joints;
    const currentGripperPos = useAppStore.getState().gripperWorldPosition;
    const currentGripperQuat = useAppStore.getState().gripperWorldQuaternion;

    // Get gripper orientation as quaternion
    gripperQuat.current.set(
      currentGripperQuat[0],
      currentGripperQuat[1],
      currentGripperQuat[2],
      currentGripperQuat[3]
    );

    // ===== JAW POSITIONING =====
    // moving_jaw_link is at the jaw PIVOT point (base), not the tip
    // We need to offset forward along the jaw to reach the TIPS where objects are gripped
    // The jaws are about 4-5cm long from pivot to tip
    const jawBaseOffset = new THREE.Vector3(0, 0.045, 0); // 4.5cm along jaw towards tips (local +Y)

    // Gap between jaws depends on gripper opening
    const jawGap = 0.005 + (currentJoints.gripper / 100) * 0.055;
    const halfGap = jawGap / 2;

    // Calculate fixed jaw position
    // Jaws separate along local X axis (perpendicular to gripper forward direction)
    const fixedJawLocalOffset = jawBaseOffset.clone();
    fixedJawLocalOffset.x += halfGap;
    jawOffset.current.copy(fixedJawLocalOffset);
    jawOffset.current.applyQuaternion(gripperQuat.current);

    const fixedX = currentGripperPos[0] + jawOffset.current.x;
    const fixedY = currentGripperPos[1] + jawOffset.current.y;
    const fixedZ = currentGripperPos[2] + jawOffset.current.z;

    // Calculate moving jaw position
    const movingJawLocalOffset = jawBaseOffset.clone();
    movingJawLocalOffset.x -= halfGap;
    jawOffset.current.copy(movingJawLocalOffset);
    jawOffset.current.applyQuaternion(gripperQuat.current);

    const movingX = currentGripperPos[0] + jawOffset.current.x;
    const movingY = currentGripperPos[1] + jawOffset.current.y;
    const movingZ = currentGripperPos[2] + jawOffset.current.z;

    // Update physics bodies
    if (fixedJawRef.current) {
      fixedJawRef.current.setNextKinematicTranslation({ x: fixedX, y: fixedY, z: fixedZ });
      fixedJawRef.current.setNextKinematicRotation({
        x: gripperQuat.current.x,
        y: gripperQuat.current.y,
        z: gripperQuat.current.z,
        w: gripperQuat.current.w,
      });
    }

    if (movingJawRef.current) {
      movingJawRef.current.setNextKinematicTranslation({ x: movingX, y: movingY, z: movingZ });
      movingJawRef.current.setNextKinematicRotation({
        x: gripperQuat.current.x,
        y: gripperQuat.current.y,
        z: gripperQuat.current.z,
        w: gripperQuat.current.w,
      });
    }

    // Update state for visual meshes (every frame for smooth tracking)
    setFixedJawPos([fixedX, fixedY, fixedZ]);
    setMovingJawPos([movingX, movingY, movingZ]);
    setJawRotation([
      gripperQuat.current.x,
      gripperQuat.current.y,
      gripperQuat.current.z,
      gripperQuat.current.w,
    ]);
  });

  return (
    <>
      {/* Fixed Jaw Physics Body */}
      <RigidBody
        ref={fixedJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
        ccd={true}
        position={fixedJawPos}
      >
        <CuboidCollider
          args={[JAW_THICKNESS / 2, JAW_LENGTH / 2, JAW_DEPTH / 2]}
          friction={JAW_FRICTION}
        />
        {/* Debug mesh inside RigidBody - moves with physics body */}
        <mesh>
          <boxGeometry args={[JAW_THICKNESS, JAW_LENGTH, JAW_DEPTH]} />
          <meshStandardMaterial color="#00ff00" transparent opacity={0.7} />
        </mesh>
      </RigidBody>

      {/* Moving Jaw Physics Body */}
      <RigidBody
        ref={movingJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
        ccd={true}
        position={movingJawPos}
      >
        <CuboidCollider
          args={[JAW_THICKNESS / 2, JAW_LENGTH / 2, JAW_DEPTH / 2]}
          friction={JAW_FRICTION}
        />
        {/* Debug mesh inside RigidBody - moves with physics body */}
        <mesh>
          <boxGeometry args={[JAW_THICKNESS, JAW_LENGTH, JAW_DEPTH]} />
          <meshStandardMaterial color="#0088ff" transparent opacity={0.7} />
        </mesh>
      </RigidBody>
    </>
  );
};

export default RealisticGripperPhysics;
