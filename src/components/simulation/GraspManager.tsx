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
import * as THREE from 'three';
import { useAppStore } from '../../stores/useAppStore';

// Gripper thresholds
// Note: These are fallbacks - contact grasp uses object-specific minimum values
const GRIPPER_CLOSED_THRESHOLD = 60; // Gripper value below this = closed enough for fallback grasp
const GRIPPER_OPEN_THRESHOLD = 70;   // Gripper value above this = open enough to release
const GRASP_DISTANCE = 0.025;         // 2.5cm - max distance from jaw center to object center for grasp
                                      // Balanced tolerance for visual alignment
const JAW_LOCAL_OFFSET: [number, number, number] = [-0.0079, 0, 0.0068]; // Jaw center in gripper_frame local coords

// Gripper geometry for calculating minimum grip value
// Based on URDF: jaw ~4cm from pivot, rotating -10° to +100°
// Gap relationship: gap = 2 × jawLength × sin(angle)
// This is SINUSOIDAL, not linear!
// NOTE: Must match RealisticGripperPhysics.tsx JAW_LENGTH for visual consistency
const JAW_LENGTH = 0.040;  // 4cm jaw length from pivot to tip (matches physics)
const GRIPPER_MIN_ANGLE_DEG = -10;  // Closed position
const GRIPPER_MAX_ANGLE_DEG = 100;  // Open position
const GRIPPER_ANGLE_RANGE_DEG = GRIPPER_MAX_ANGLE_DEG - GRIPPER_MIN_ANGLE_DEG; // 110°

/**
 * Calculate the minimum gripper value needed to hold an object of given diameter
 * Uses inverse trig to account for sinusoidal gap relationship:
 *   gap = 2 × jawLength × sin(angle)
 *   angle = arcsin(gap / (2 × jawLength))
 *   gripper% = (angle - minAngle) / angleRange × 100
 */
const calculateGripperMinForObject = (objectDiameter: number): number => {
  // Target gap smaller than object for a firm visible grip
  // Using 70% ensures jaws visually contact the object
  const targetGap = objectDiameter * 0.70; // 70% of diameter = firm visible grip

  // Calculate required angle using inverse sin
  const maxGap = 2 * JAW_LENGTH; // Maximum possible gap (when jaws at 90°)
  const sinAngle = Math.min(1, targetGap / maxGap); // Clamp to valid sin range
  const angleRad = Math.asin(sinAngle);
  const angleDeg = angleRad * (180 / Math.PI);

  // Convert angle to gripper percentage
  // gripper% = (angle - minAngle) / angleRange × 100
  const gripperValue = ((angleDeg - GRIPPER_MIN_ANGLE_DEG) / GRIPPER_ANGLE_RANGE_DEG) * 100;

  return Math.max(0, Math.min(100, gripperValue));
};

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
  const setGripperMinValue = useAppStore((state) => state.setGripperMinValue);
  const setJoints = useAppStore((state) => state.setJoints);

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
    const isClosing = currentGripper < prevGripperValue.current;

    // Calculate jaw position (between the two jaws)
    gripperQuat.current.set(
      gripperWorldQuaternion[0],
      gripperWorldQuaternion[1],
      gripperWorldQuaternion[2],
      gripperWorldQuaternion[3]
    );

    // Offset from gripper_frame to jaw center (midpoint between jaw tips)
    const jawLocalOffset = new THREE.Vector3(...JAW_LOCAL_OFFSET);
    jawLocalOffset.applyQuaternion(gripperQuat.current);

    jawPosition.current.set(
      gripperWorldPosition[0] + jawLocalOffset.x,
      gripperWorldPosition[1] + jawLocalOffset.y,
      gripperWorldPosition[2] + jawLocalOffset.z
    );

    // === COLLISION PREVENTION ===
    // CRITICAL: Prevent gripper from passing through objects
    // Check if there's an object in the grasp zone and set gripper minimum BEFORE it closes through
    if (!graspState.current.graspedObjectId) {
      let nearestObjectInZone: typeof objects[0] | null = null;
      let nearestDistance = 0.12; // 12cm detection zone - larger zone for early detection

      for (const obj of objects) {
        if (!obj.isGrabbable) continue;

        objectPos.current.set(obj.position[0], obj.position[1], obj.position[2]);
        const distance = jawPosition.current.distanceTo(objectPos.current);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestObjectInZone = obj;
        }
      }

      // If there's an object in the grasp zone, enforce minimum gripper value
      if (nearestObjectInZone) {
        const objectDiameter = nearestObjectInZone.scale;
        const minGripperForObject = calculateGripperMinForObject(objectDiameter);

        // Get current minimum from store
        const storeState = useAppStore.getState();
        const currentMin = storeState.gripperMinValue;

        // Set the minimum if not already set or if this is more restrictive
        if (currentMin === null || minGripperForObject > currentMin) {
          setGripperMinValue(minGripperForObject);

          // If gripper is already past the minimum, snap it to the minimum
          if (currentGripper < minGripperForObject) {
            setJoints({ gripper: minGripperForObject });
          }
        }

        // TRIGGER GRASP when gripper reaches the object-based minimum
        // This is the "contact" point - jaws are touching the object surface
        // Use a small tolerance (2%) to detect when we've "reached" the minimum
        const reachedMinimum = currentGripper <= minGripperForObject + 2;
        // Either actively closing OR at/below the object's minimum (clamped)
        const gripperIsClosing = isClosing || currentGripper <= minGripperForObject + 5;

        if (reachedMinimum && gripperIsClosing && nearestDistance < GRASP_DISTANCE) {
          // Trigger grasp immediately - jaws have made contact with object
          graspState.current.graspedObjectId = nearestObjectInZone.id;

          // Calculate offset from JAW position to object
          graspState.current.graspOffset.set(
            nearestObjectInZone.position[0] - jawPosition.current.x,
            nearestObjectInZone.position[1] - jawPosition.current.y,
            nearestObjectInZone.position[2] - jawPosition.current.z
          );

          // Transform offset to gripper local space
          const invGripperQuat = gripperQuat.current.clone().invert();
          graspState.current.graspOffset.applyQuaternion(invGripperQuat);

          // Store rotation offset
          graspState.current.graspRotationOffset.setFromEuler(
            new THREE.Euler(
              nearestObjectInZone.rotation[0],
              nearestObjectInZone.rotation[1],
              nearestObjectInZone.rotation[2]
            )
          );
          graspState.current.graspRotationOffset.premultiply(invGripperQuat);

          // Mark object as grabbed
          updateObject(nearestObjectInZone.id, { isGrabbed: true });

          console.log(`[GraspManager] CONTACT GRASP: ${nearestObjectInZone.name || nearestObjectInZone.id}`);
          console.log(`[GraspManager]   Gripper at ${currentGripper.toFixed(1)}% (min=${minGripperForObject.toFixed(1)}%)`);
          console.log(`[GraspManager]   Object pos: [${nearestObjectInZone.position.map(v => (v*100).toFixed(1)).join(', ')}] cm`);
          console.log(`[GraspManager]   Jaw pos: [${(jawPosition.current.x*100).toFixed(1)}, ${(jawPosition.current.y*100).toFixed(1)}, ${(jawPosition.current.z*100).toFixed(1)}] cm`);
        }
      } else {
        // No object in zone - clear the minimum (unless we're grasping)
        const storeState = useAppStore.getState();
        if (storeState.gripperMinValue !== null && !graspState.current.graspedObjectId) {
          setGripperMinValue(null);
        }
      }
    }

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

        // Calculate and set gripper minimum based on object size
        // This prevents the gripper from crushing the object
        const objectDiameter = closestObject.scale; // For cubes, scale = side length
        const minGripperValue = calculateGripperMinForObject(objectDiameter);
        setGripperMinValue(minGripperValue);

        // IMPORTANT: Immediately apply the clamp to the current gripper value
        // This ensures the visual gripper stops at the object surface
        setJoints({ gripper: minGripperValue });

        console.log(`[GraspManager] Grasped object: ${closestObject.name || closestObject.id}`);
        console.log(`[GraspManager]   Object pos: [${closestObject.position.map(v => (v*100).toFixed(1)).join(', ')}] cm`);
        console.log(`[GraspManager]   Jaw pos: [${(jawPosition.current.x*100).toFixed(1)}, ${(jawPosition.current.y*100).toFixed(1)}, ${(jawPosition.current.z*100).toFixed(1)}] cm`);
        console.log(`[GraspManager]   Grasp offset (local): [${(graspState.current.graspOffset.x*100).toFixed(1)}, ${(graspState.current.graspOffset.y*100).toFixed(1)}, ${(graspState.current.graspOffset.z*100).toFixed(1)}] cm`);
        console.log(`[GraspManager]   minGripper=${minGripperValue.toFixed(1)}`);
      }
    }

    // === RELEASE DETECTION ===
    // If gripper opened and we have an object, release it
    if (isOpen && graspState.current.graspedObjectId) {
      const releasedId = graspState.current.graspedObjectId;

      // Mark object as released
      updateObject(releasedId, { isGrabbed: false });

      // Clear gripper minimum constraint
      setGripperMinValue(null);

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

        // === FLOOR CONSTRAINT ===
        // Prevent object from going below the floor (Y=0 + object half-height)
        // Different object types have different height calculations:
        // - cube: scale is side length, so half-height = scale / 2
        // - ball: scale is radius, so half-height = scale
        // - cylinder: scale * 3 is height (6x scale), so half-height = scale * 3
        let objectHalfHeight: number;
        switch (graspedObj.type) {
          case 'ball':
            objectHalfHeight = graspedObj.scale;
            break;
          case 'cylinder':
            objectHalfHeight = graspedObj.scale * 3; // Height is 6x scale
            break;
          case 'cube':
          default:
            objectHalfHeight = graspedObj.scale / 2;
            break;
        }
        const minY = objectHalfHeight + 0.002; // 2mm above floor
        const needsClamp = newPosition.current.y < minY;
        if (needsClamp) {
          newPosition.current.y = minY;
        }

        // Debug logging only when clamped (floor constraint active)
        if (needsClamp && Math.random() < 0.1) {
          console.log(`[GraspManager] Floor clamp active: Y=${(newPosition.current.y*100).toFixed(1)}cm`);
        }

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
