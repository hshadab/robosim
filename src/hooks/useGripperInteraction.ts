import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { JointState, SimObject } from '../types';

// Threshold for position updates (to avoid infinite loops)
const POSITION_THRESHOLD = 0.001;

// Calculate gripper tip position using forward kinematics
const calculateGripperPosition = (joints: JointState): [number, number, number] => {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Segment lengths (matching RobotArm3D)
  const baseHeight = 0.12;
  const upperArm = 0.1;
  const forearm = 0.088;
  const wrist = 0.045;
  const gripper = 0.05;

  // Calculate cumulative angles
  const angle1 = shoulderRad;
  const angle2 = angle1 + elbowRad;
  const angle3 = angle2 + wristRad;

  // Forward kinematics
  let x = 0;
  let y = baseHeight;
  let z = 0;

  // Upper arm
  x += upperArm * Math.sin(angle1) * Math.cos(-baseRad);
  y += upperArm * Math.cos(angle1);
  z += upperArm * Math.sin(angle1) * Math.sin(-baseRad);

  // Forearm
  x += forearm * Math.sin(angle2) * Math.cos(-baseRad);
  y += forearm * Math.cos(angle2);
  z += forearm * Math.sin(angle2) * Math.sin(-baseRad);

  // Wrist + gripper
  x += (wrist + gripper) * Math.sin(angle3) * Math.cos(-baseRad);
  y += (wrist + gripper) * Math.cos(angle3);
  z += (wrist + gripper) * Math.sin(angle3) * Math.sin(-baseRad);

  return [x, y, z];
};

// Calculate distance between two 3D points
const distance3D = (
  a: [number, number, number],
  b: [number, number, number]
): number => {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
};

// Check if object is in target zone
const isInZone = (
  objPos: [number, number, number],
  zonePos: [number, number, number],
  zoneSize: [number, number, number]
): boolean => {
  return (
    Math.abs(objPos[0] - zonePos[0]) < zoneSize[0] / 2 &&
    Math.abs(objPos[2] - zonePos[2]) < zoneSize[2] / 2
  );
};

export const useGripperInteraction = () => {
  // Use selectors to avoid unnecessary re-renders
  const joints = useAppStore((state) => state.joints);
  const updateObject = useAppStore((state) => state.updateObject);
  const completeObjective = useAppStore((state) => state.completeObjective);

  const prevGripperRef = useRef(joints.gripper);
  const grabbedObjectIdRef = useRef<string | null>(null);
  const lastPositionRef = useRef<[number, number, number]>([0, 0, 0]);

  // Check if position changed significantly
  const positionChanged = useCallback((newPos: [number, number, number], oldPos: [number, number, number]) => {
    return (
      Math.abs(newPos[0] - oldPos[0]) > POSITION_THRESHOLD ||
      Math.abs(newPos[1] - oldPos[1]) > POSITION_THRESHOLD ||
      Math.abs(newPos[2] - oldPos[2]) > POSITION_THRESHOLD
    );
  }, []);

  useEffect(() => {
    // Get current state directly from store to avoid dependency issues
    const { objects, targetZones, challengeState } = useAppStore.getState();

    const gripperPos = calculateGripperPosition(joints);
    const gripperClosed = joints.gripper < 30;
    const wasClosing = prevGripperRef.current >= 30 && joints.gripper < 30;
    const wasOpening = prevGripperRef.current <= 70 && joints.gripper > 70;

    // Check for grabbing (gripper just closed)
    if (wasClosing && !grabbedObjectIdRef.current) {
      // Find closest grabbable object within reach
      let closestObj: SimObject | null = null;
      let closestDist = Infinity;
      const grabRadius = 0.1; // 10cm grab radius for easier grabbing

      for (const obj of objects) {
        if (obj.isGrabbable && !obj.isGrabbed) {
          const dist = distance3D(gripperPos, obj.position);
          if (dist < grabRadius && dist < closestDist) {
            closestObj = obj;
            closestDist = dist;
          }
        }
      }

      if (closestObj) {
        grabbedObjectIdRef.current = closestObj.id;
        updateObject(closestObj.id, { isGrabbed: true });
      }
    }

    // Check for releasing (gripper just opened)
    if (wasOpening && grabbedObjectIdRef.current) {
      const releasedId = grabbedObjectIdRef.current;
      const releasedObj = objects.find((o) => o.id === releasedId);

      if (releasedObj) {
        // Calculate drop position (current gripper position, but on the ground)
        const dropPos: [number, number, number] = [
          gripperPos[0],
          releasedObj.scale / 2 + 0.001, // Place on ground based on object size
          gripperPos[2],
        ];

        // Check if dropped in a target zone
        let inTargetZone = false;
        for (const zone of targetZones) {
          if (zone.acceptedObjectIds.includes(releasedId) && isInZone(dropPos, zone.position, zone.size)) {
            inTargetZone = true;

            // Check challenge objectives
            if (challengeState.activeChallenge) {
              for (const obj of challengeState.activeChallenge.objectives) {
                if (
                  !obj.isCompleted &&
                  obj.type === 'move_object' &&
                  obj.target?.objectId === releasedId &&
                  obj.target?.zoneId === zone.id
                ) {
                  completeObjective(obj.id);
                }
              }
            }
            break;
          }
        }

        updateObject(releasedId, {
          isGrabbed: false,
          position: dropPos,
          isInTargetZone: inTargetZone,
        });
      }

      grabbedObjectIdRef.current = null;
    }

    // Update grabbed object position to follow gripper (only if position changed)
    if (grabbedObjectIdRef.current && gripperClosed) {
      // Position object slightly below gripper
      const objPos: [number, number, number] = [
        gripperPos[0],
        gripperPos[1] - 0.02,
        gripperPos[2],
      ];

      // Only update if position actually changed
      if (positionChanged(objPos, lastPositionRef.current)) {
        lastPositionRef.current = objPos;
        updateObject(grabbedObjectIdRef.current, { position: objPos });
      }
    }

    prevGripperRef.current = joints.gripper;
  }, [joints, updateObject, completeObjective, positionChanged]);

  return {
    gripperPosition: calculateGripperPosition(joints),
    grabbedObjectId: grabbedObjectIdRef.current,
  };
};
