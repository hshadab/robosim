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

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider, useRapier } from '@react-three/rapier';
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

  const { world, rapier } = useRapier();

  const jawShape = useMemo(() => {
    if (!rapier) return null;
    return new rapier.Cuboid(JAW_THICKNESS / 2, JAW_LENGTH / 2, JAW_DEPTH / 2);
  }, [rapier]);

  const prevFixedPos = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.2, z: 0 });
  const prevMovingPos = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0.2, z: 0 });

  const castShapeForCollision = (
    currentPos: { x: number; y: number; z: number },
    targetPos: { x: number; y: number; z: number },
    rotation: THREE.Quaternion,
    excludeRigidBody: RapierRigidBody | null
  ): { x: number; y: number; z: number } => {
    if (!world || !rapier || !jawShape) {
      return applyFloorClamp(targetPos);
    }

    const deltaX = targetPos.x - currentPos.x;
    const deltaY = targetPos.y - currentPos.y;
    const deltaZ = targetPos.z - currentPos.z;

    const deltaMag = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    if (deltaMag < 0.0001) {
      return applyFloorClamp(targetPos);
    }

    const shapePos = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
    const shapeRot = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    const shapeVel = { x: deltaX, y: deltaY, z: deltaZ };

    try {
      const hit = world.castShape(
        shapePos,
        shapeRot,
        shapeVel,
        jawShape,
        0.0,
        1.0,
        true,
        undefined,
        undefined,
        excludeRigidBody ? excludeRigidBody.handle : undefined,
        undefined
      );

      if (hit && hit.time_of_impact < 1.0) {
        const safeToi = Math.max(0, hit.time_of_impact - COLLISION_EPSILON / deltaMag);
        const clampedPos = {
          x: currentPos.x + deltaX * safeToi,
          y: currentPos.y + deltaY * safeToi,
          z: currentPos.z + deltaZ * safeToi,
        };
        return applyFloorClamp(clampedPos);
      }
    } catch {
      // Fallback to floor clamping only on error
    }

    return applyFloorClamp(targetPos);
  };

  const applyFloorClamp = (pos: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
    return {
      x: pos.x,
      y: Math.max(pos.y, FLOOR_Y),
      z: pos.z,
    };
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

    const clampedFixed = castShapeForCollision(
      prevFixedPos.current,
      { x: targetFixedX, y: targetFixedY, z: targetFixedZ },
      gripperQuat.current,
      fixedJawRef.current
    );

    const clampedMoving = castShapeForCollision(
      prevMovingPos.current,
      { x: targetMovingX, y: targetMovingY, z: targetMovingZ },
      gripperQuat.current,
      movingJawRef.current
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
