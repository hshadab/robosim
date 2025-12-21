/**
 * Grasp Manager - Reliable object gripping system
 *
 * This component handles:
 * 1. Detecting when gripper closes on an object
 * 2. Attaching object to gripper (kinematic lock)
 * 3. Releasing object when gripper opens
 *
 * Uses proximity detection + gripper state rather than pure friction
 * for reliable picking behavior.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import { useAppStore } from '../../stores/useAppStore';

// Gripper thresholds
const GRIPPER_CLOSED_THRESHOLD = 35; // Gripper value below this = closed enough to grasp
const GRIPPER_OPEN_THRESHOLD = 50;   // Gripper value above this = open enough to release
const GRASP_DISTANCE = 0.04;          // 4cm - max distance from jaw center to object center for grasp
const JAW_Y_OFFSET = 0.073;           // Offset from tip to jaw (matches SO101KinematicsURDF)

interface GraspState {
  graspedObjectId: string | null;
  graspOffset: THREE.Vector3;        // Offset from gripper to object at grasp time
  graspRotationOffset: THREE.Quaternion; // Rotation offset at grasp time
}

export const GraspManager: React.FC = () => {
  // Get state from store
  const objects = useAppStore((state) => state.objects);
  const updateObject = useAppStore((state) => state.updateObject);
  const joints = useAppStore((state) => state.joints);
  const gripperWorldPosition = useAppStore((state) => state.gripperWorldPosition);
  const gripperWorldQuaternion = useAppStore((state) => state.gripperWorldQuaternion);

  // Grasp state
  const graspState = useRef<GraspState>({
    graspedObjectId: null,
    graspOffset: new THREE.Vector3(),
    graspRotationOffset: new THREE.Quaternion(),
  });

  // Reusable objects
  const jawPosition = useRef(new THREE.Vector3());
  const gripperQuat = useRef(new THREE.Quaternion());
  const objectPos = useRef(new THREE.Vector3());
  const newPosition = useRef(new THREE.Vector3());

  // Track previous gripper state to detect close/open transitions
  const prevGripperValue = useRef(joints.gripper);

  useFrame(() => {
    const currentGripper = joints.gripper;
    const isClosed = currentGripper <= GRIPPER_CLOSED_THRESHOLD;
    const isOpen = currentGripper >= GRIPPER_OPEN_THRESHOLD;

    // Calculate jaw position (between the two jaws)
    gripperQuat.current.set(
      gripperWorldQuaternion[0],
      gripperWorldQuaternion[1],
      gripperWorldQuaternion[2],
      gripperWorldQuaternion[3]
    );

    // Jaw is offset from gripper tip toward the body
    const jawLocalOffset = new THREE.Vector3(0, 0, -JAW_Y_OFFSET);
    jawLocalOffset.applyQuaternion(gripperQuat.current);

    jawPosition.current.set(
      gripperWorldPosition[0] + jawLocalOffset.x,
      gripperWorldPosition[1] + jawLocalOffset.y,
      gripperWorldPosition[2] + jawLocalOffset.z
    );

    // === GRASP DETECTION ===
    // If gripper just closed and we don't have an object, try to grasp
    if (isClosed && !graspState.current.graspedObjectId) {
      // Find closest graspable object within range
      let closestObject: typeof objects[0] | null = null;
      let closestDistance = GRASP_DISTANCE;

      for (const obj of objects) {
        if (!obj.isGrabbable) continue;

        objectPos.current.set(obj.position[0], obj.position[1], obj.position[2]);
        const distance = jawPosition.current.distanceTo(objectPos.current);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestObject = obj;
        }
      }

      // Grasp the closest object
      if (closestObject) {
        graspState.current.graspedObjectId = closestObject.id;

        // Calculate offset from JAW position to object (not gripper tip!)
        // This ensures the object stays at the jaw position when following
        graspState.current.graspOffset.set(
          closestObject.position[0] - jawPosition.current.x,
          closestObject.position[1] - jawPosition.current.y,
          closestObject.position[2] - jawPosition.current.z
        );

        // Transform offset to gripper local space
        const invGripperQuat = gripperQuat.current.clone().invert();
        graspState.current.graspOffset.applyQuaternion(invGripperQuat);

        // Store rotation offset
        graspState.current.graspRotationOffset.setFromEuler(
          new THREE.Euler(
            closestObject.rotation[0],
            closestObject.rotation[1],
            closestObject.rotation[2]
          )
        );
        graspState.current.graspRotationOffset.premultiply(invGripperQuat);

        // Mark object as grabbed
        updateObject(closestObject.id, { isGrabbed: true });

        console.log(`[GraspManager] Grasped object: ${closestObject.name || closestObject.id} at distance ${(closestDistance * 100).toFixed(1)}cm`);
      }
    }

    // === RELEASE DETECTION ===
    // If gripper opened and we have an object, release it
    if (isOpen && graspState.current.graspedObjectId) {
      const releasedId = graspState.current.graspedObjectId;

      // Mark object as released
      updateObject(releasedId, { isGrabbed: false });

      console.log(`[GraspManager] Released object: ${releasedId}`);

      // Clear grasp state
      graspState.current.graspedObjectId = null;
    }

    // === OBJECT FOLLOWING ===
    // If we have a grasped object, make it follow the JAW position
    if (graspState.current.graspedObjectId) {
      const graspedObj = objects.find(o => o.id === graspState.current.graspedObjectId);
      if (graspedObj) {
        // Calculate new position: JAW position + rotated offset
        newPosition.current.copy(graspState.current.graspOffset);
        newPosition.current.applyQuaternion(gripperQuat.current);
        newPosition.current.add(jawPosition.current);

        // Calculate new rotation
        const newRotation = gripperQuat.current.clone();
        newRotation.multiply(graspState.current.graspRotationOffset);
        const euler = new THREE.Euler().setFromQuaternion(newRotation);

        // Update object position and rotation
        updateObject(graspState.current.graspedObjectId, {
          position: [newPosition.current.x, newPosition.current.y, newPosition.current.z],
          rotation: [euler.x, euler.y, euler.z],
        });
      }
    }

    prevGripperValue.current = currentGripper;
  });

  return null; // This is a logic-only component
};

export default GraspManager;
