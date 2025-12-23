/**
 * Realistic Gripper Physics for SO-101 Robot Arm
 *
 * This component creates physics-accurate jaw colliders that:
 * 1. Follow the actual URDF link positions/orientations
 * 2. Moving jaw rotates with gripper joint value
 * 3. Uses high friction for physics-based object gripping
 * 4. Objects are held by friction forces, not "teleport attach"
 * 5. Collision detection prevents penetration of floor/objects
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

const JAW_LENGTH = 0.040;
const JAW_THICKNESS = 0.010;
const JAW_DEPTH = 0.018;

const JAW_FRICTION = 2.5;

const FLOOR_Y = 0.02;
const COLLISION_EPSILON = 0.001;

interface RealisticGripperPhysicsProps {
  joints: JointState;
}

/**
 * Creates physics colliders for both gripper jaws that:
 * - Track actual gripper position/orientation from URDF
 * - Moving jaw rotates based on gripper joint value
 * - Use high friction for realistic object gripping
 * - Collision detection prevents penetration
 */
export const RealisticGripperPhysics: React.FC<RealisticGripperPhysicsProps> = () => {
  const fixedJawRef = useRef<RapierRigidBody>(null);
  const movingJawRef = useRef<RapierRigidBody>(null);

  const [fixedJawPos, setFixedJawPos] = useState<[number, number, number]>([0, 0.2, 0]);
  const [movingJawPos, setMovingJawPos] = useState<[number, number, number]>([0, 0.2, 0]);

  const gripperQuat = useRef(new THREE.Quaternion());
  const jawOffset = useRef(new THREE.Vector3());

  const prevFixedPos = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.2, z: 0 });
  const prevMovingPos = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.2, z: 0 });

  const clampToSafePosition = (
    targetPos: { x: number; y: number; z: number },
    prevPos: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } => {
    // Simple collision avoidance: clamp to floor and push away from objects
    let clampedX = targetPos.x;
    let clampedY = Math.max(targetPos.y, FLOOR_Y);
    let clampedZ = targetPos.z;
    
    // Check collision with scene objects using sphere collision
    const objects = useAppStore.getState().objects;
    const jawRadius = JAW_LENGTH * 0.4; // Effective collision radius of jaw
    
    for (const obj of objects) {
      const [ox, oy, oz] = obj.position;
      const objRadius = obj.scale * 0.5; // Half the object size (for cubes)
      const minDist = objRadius + jawRadius; // Minimum allowed distance
      
      const dx = clampedX - ox;
      const dy = clampedY - oy;
      const dz = clampedZ - oz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // If we're penetrating the object, push the jaw out
      if (distance < minDist && distance > 0.001) {
        // Normalize the direction and push out to safe distance
        const pushDist = minDist - distance + COLLISION_EPSILON;
        const nx = dx / distance;
        const ny = dy / distance;
        const nz = dz / distance;
        
        clampedX += nx * pushDist;
        clampedY += ny * pushDist;
        clampedZ += nz * pushDist;
        
        // Keep above floor
        clampedY = Math.max(clampedY, FLOOR_Y);
      } else if (distance <= 0.001) {
        // Edge case: exactly at object center, use previous position
        return prevPos;
      }
    }
    
    return { x: clampedX, y: clampedY, z: clampedZ };
  };

  useFrame(() => {
    const currentJoints = useAppStore.getState().joints;
    const currentGripperPos = useAppStore.getState().gripperWorldPosition;
    const currentGripperQuat = useAppStore.getState().gripperWorldQuaternion;

    gripperQuat.current.set(
      currentGripperQuat[0],
      currentGripperQuat[1],
      currentGripperQuat[2],
      currentGripperQuat[3]
    );

    const jawBaseOffset = new THREE.Vector3(0, 0.045, 0);

    const jawGap = 0.005 + (currentJoints.gripper / 100) * 0.055;
    const halfGap = jawGap / 2;

    const fixedJawLocalOffset = jawBaseOffset.clone();
    fixedJawLocalOffset.x += halfGap;
    jawOffset.current.copy(fixedJawLocalOffset);
    jawOffset.current.applyQuaternion(gripperQuat.current);

    const targetFixedX = currentGripperPos[0] + jawOffset.current.x;
    const targetFixedY = currentGripperPos[1] + jawOffset.current.y;
    const targetFixedZ = currentGripperPos[2] + jawOffset.current.z;

    const movingJawLocalOffset = jawBaseOffset.clone();
    movingJawLocalOffset.x -= halfGap;
    jawOffset.current.copy(movingJawLocalOffset);
    jawOffset.current.applyQuaternion(gripperQuat.current);

    const targetMovingX = currentGripperPos[0] + jawOffset.current.x;
    const targetMovingY = currentGripperPos[1] + jawOffset.current.y;
    const targetMovingZ = currentGripperPos[2] + jawOffset.current.z;

    const clampedFixed = clampToSafePosition(
      { x: targetFixedX, y: targetFixedY, z: targetFixedZ },
      prevFixedPos.current
    );

    const clampedMoving = clampToSafePosition(
      { x: targetMovingX, y: targetMovingY, z: targetMovingZ },
      prevMovingPos.current
    );

    if (fixedJawRef.current) {
      fixedJawRef.current.setNextKinematicTranslation(clampedFixed);
      fixedJawRef.current.setNextKinematicRotation({
        x: gripperQuat.current.x,
        y: gripperQuat.current.y,
        z: gripperQuat.current.z,
        w: gripperQuat.current.w,
      });
    }

    if (movingJawRef.current) {
      movingJawRef.current.setNextKinematicTranslation(clampedMoving);
      movingJawRef.current.setNextKinematicRotation({
        x: gripperQuat.current.x,
        y: gripperQuat.current.y,
        z: gripperQuat.current.z,
        w: gripperQuat.current.w,
      });
    }

    prevFixedPos.current = clampedFixed;
    prevMovingPos.current = clampedMoving;

    setFixedJawPos([clampedFixed.x, clampedFixed.y, clampedFixed.z]);
    setMovingJawPos([clampedMoving.x, clampedMoving.y, clampedMoving.z]);
  });

  return (
    <>
      <RigidBody
        ref={fixedJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
        ccd={true}
        position={fixedJawPos}
        restitution={0.0}
      >
        <CuboidCollider
          args={[JAW_THICKNESS / 2, JAW_LENGTH / 2, JAW_DEPTH / 2]}
          friction={JAW_FRICTION}
          restitution={0.0}
        />
      </RigidBody>

      <RigidBody
        ref={movingJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
        ccd={true}
        position={movingJawPos}
        restitution={0.0}
      >
        <CuboidCollider
          args={[JAW_THICKNESS / 2, JAW_LENGTH / 2, JAW_DEPTH / 2]}
          friction={JAW_FRICTION}
          restitution={0.0}
        />
      </RigidBody>
    </>
  );
};

export default RealisticGripperPhysics;
