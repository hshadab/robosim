/**
 * Realistic Gripper Physics for SO-101 Robot Arm
 *
 * This component creates physics-accurate jaw colliders that:
 * 1. Follow the actual URDF link positions/orientations
 * 2. Moving jaw rotates with gripper joint value
 * 3. Uses high friction for physics-based object gripping
 * 4. Objects are held by friction forces, not "teleport attach"
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

// Gripper geometry constants (from URDF analysis)
// The gripper joint rotates from -0.174533 rad (closed) to 1.74533 rad (open)
const GRIPPER_MIN_RAD = -0.174533; // Closed position (-10°)
const GRIPPER_MAX_RAD = 1.74533;   // Open position (+100°)

// Jaw dimensions (approximated from STL/URDF inertial data)
// The SO-101 jaw is tapered - thicker at base, thinner at tip
const JAW_LENGTH = 0.055; // 5.5cm from pivot to tip
const JAW_BASE_THICKNESS = 0.012; // 1.2cm at base
const JAW_TIP_THICKNESS = 0.006; // 0.6cm at tip
const JAW_DEPTH = 0.018; // 1.8cm depth

// High friction for gripping
const JAW_FRICTION = 2.0; // High friction coefficient for grip

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

  // Get gripper state from store
  const gripperWorldPosition = useAppStore((state) => state.gripperWorldPosition);
  const gripperWorldQuaternion = useAppStore((state) => state.gripperWorldQuaternion);

  // Reusable objects to avoid allocations
  const gripperQuat = useRef(new THREE.Quaternion());
  const jawOffset = useRef(new THREE.Vector3());
  const jawQuat = useRef(new THREE.Quaternion());
  const jawRotation = useRef(new THREE.Quaternion());

  useFrame(() => {
    // Get gripper orientation as quaternion
    gripperQuat.current.set(
      gripperWorldQuaternion[0],
      gripperWorldQuaternion[1],
      gripperWorldQuaternion[2],
      gripperWorldQuaternion[3]
    );

    // Calculate world position of the jaw pivot point
    // The pivot is offset from gripper_frame_link (tip) by PIVOT_OFFSET in gripper local space
    // But we need to go from the tip back to the gripper_link, then to the pivot

    // Actually, let's position jaws relative to the gripper tip for simplicity
    // The fixed jaw and moving jaw meet near the tip

    // Calculate gripper joint angle from gripper value (0-100)
    const gripperRad = GRIPPER_MIN_RAD + (joints.gripper / 100) * (GRIPPER_MAX_RAD - GRIPPER_MIN_RAD);

    // ===== FIXED JAW =====
    // The fixed jaw is attached to the gripper body
    // It extends from the gripper in a fixed orientation
    if (fixedJawRef.current) {
      // Position the fixed jaw - it's offset to one side of the gripper
      // In gripper local coords, the fixed jaw is on the +X side
      const fixedJawLocalOffset = new THREE.Vector3(0.012, 0.025, 0); // Offset from tip

      // Rotate offset to world coords
      jawOffset.current.copy(fixedJawLocalOffset);
      jawOffset.current.applyQuaternion(gripperQuat.current);

      const fixedJawPos = {
        x: gripperWorldPosition[0] + jawOffset.current.x,
        y: gripperWorldPosition[1] + jawOffset.current.y,
        z: gripperWorldPosition[2] + jawOffset.current.z,
      };

      fixedJawRef.current.setNextKinematicTranslation(fixedJawPos);
      fixedJawRef.current.setNextKinematicRotation({
        x: gripperQuat.current.x,
        y: gripperQuat.current.y,
        z: gripperQuat.current.z,
        w: gripperQuat.current.w,
      });
    }

    // ===== MOVING JAW =====
    // The moving jaw rotates about the gripper joint axis
    // When closed (gripperRad = -0.174533), it's parallel to fixed jaw
    // When open (gripperRad = 1.74533), it's rotated away
    if (movingJawRef.current) {
      // The moving jaw pivots about an axis perpendicular to the jaw length
      // We apply the gripper joint rotation to position the moving jaw

      // Start with base position (on -X side, opposite to fixed jaw)
      const movingJawBaseOffset = new THREE.Vector3(-0.012, 0.025, 0);

      // Create rotation for the moving jaw angle
      // The jaw rotates about the Z axis in gripper local space
      jawRotation.current.setFromAxisAngle(new THREE.Vector3(0, 0, 1), gripperRad);

      // Apply jaw rotation then gripper orientation
      jawQuat.current.copy(gripperQuat.current);
      jawQuat.current.multiply(jawRotation.current);

      // Rotate the offset by the gripper orientation (not the jaw rotation)
      jawOffset.current.copy(movingJawBaseOffset);
      jawOffset.current.applyQuaternion(gripperQuat.current);

      // Adjust position based on jaw angle - the jaw swings outward when opening
      const swingOffset = new THREE.Vector3(
        -Math.sin(gripperRad) * 0.015, // Swing away as it opens
        -Math.cos(gripperRad) * 0.015 + 0.015, // Adjust Y
        0
      );
      swingOffset.applyQuaternion(gripperQuat.current);

      const movingJawPos = {
        x: gripperWorldPosition[0] + jawOffset.current.x + swingOffset.x,
        y: gripperWorldPosition[1] + jawOffset.current.y + swingOffset.y,
        z: gripperWorldPosition[2] + jawOffset.current.z + swingOffset.z,
      };

      movingJawRef.current.setNextKinematicTranslation(movingJawPos);
      movingJawRef.current.setNextKinematicRotation({
        x: jawQuat.current.x,
        y: jawQuat.current.y,
        z: jawQuat.current.z,
        w: jawQuat.current.w,
      });
    }
  });

  return (
    <>
      {/* Fixed Jaw - high friction kinematic body */}
      <RigidBody
        ref={fixedJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
      >
        {/* Main jaw body - tapered shape approximated with boxes */}
        {/* Base section (thicker) */}
        <CuboidCollider
          args={[JAW_BASE_THICKNESS / 2, JAW_LENGTH * 0.3, JAW_DEPTH / 2]}
          position={[0, JAW_LENGTH * 0.35, 0]}
          friction={JAW_FRICTION}
        />
        {/* Middle section */}
        <CuboidCollider
          args={[(JAW_BASE_THICKNESS + JAW_TIP_THICKNESS) / 4, JAW_LENGTH * 0.35, JAW_DEPTH / 2]}
          position={[0, JAW_LENGTH * 0.0, 0]}
          friction={JAW_FRICTION}
        />
        {/* Tip section (thinner) - this is the gripping surface */}
        <CuboidCollider
          args={[JAW_TIP_THICKNESS / 2, JAW_LENGTH * 0.35, JAW_DEPTH / 2]}
          position={[0, -JAW_LENGTH * 0.35, 0]}
          friction={JAW_FRICTION}
        />
      </RigidBody>

      {/* Moving Jaw - high friction kinematic body that rotates */}
      <RigidBody
        ref={movingJawRef}
        type="kinematicPosition"
        colliders={false}
        friction={JAW_FRICTION}
      >
        {/* Main jaw body - tapered shape */}
        {/* Base section (thicker) */}
        <CuboidCollider
          args={[JAW_BASE_THICKNESS / 2, JAW_LENGTH * 0.3, JAW_DEPTH / 2]}
          position={[0, JAW_LENGTH * 0.35, 0]}
          friction={JAW_FRICTION}
        />
        {/* Middle section */}
        <CuboidCollider
          args={[(JAW_BASE_THICKNESS + JAW_TIP_THICKNESS) / 4, JAW_LENGTH * 0.35, JAW_DEPTH / 2]}
          position={[0, JAW_LENGTH * 0.0, 0]}
          friction={JAW_FRICTION}
        />
        {/* Tip section (thinner) - this is the gripping surface */}
        <CuboidCollider
          args={[JAW_TIP_THICKNESS / 2, JAW_LENGTH * 0.35, JAW_DEPTH / 2]}
          position={[0, -JAW_LENGTH * 0.35, 0]}
          friction={JAW_FRICTION}
        />
      </RigidBody>
    </>
  );
};

export default RealisticGripperPhysics;
