/**
 * Gripper Interaction Hook - Physics-Based Version
 *
 * This hook handles gripper-object interactions using realistic physics:
 * - Objects are held by friction forces from jaw colliders, NOT teleported
 * - Detects when objects are placed in target zones
 * - Updates challenge objectives
 *
 * The actual gripping is done by RealisticGripperPhysics component
 * which creates kinematic jaw colliders with high friction.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { loggers } from '../lib/logger';

const log = loggers.gripper;

// Distance threshold for detecting object in target zone
const ZONE_CHECK_INTERVAL = 500; // Check every 500ms to reduce overhead

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
  const completeObjective = useAppStore((state) => state.completeObjective);
  const updateObject = useAppStore((state) => state.updateObject);
  const lastCheckRef = useRef(0);

  useEffect(() => {
    // Periodic check for objects in target zones
    // This is lightweight since we're not doing grab detection anymore
    const checkInterval = setInterval(() => {
      const { objects, targetZones, challengeState } = useAppStore.getState();
      const now = Date.now();

      if (now - lastCheckRef.current < ZONE_CHECK_INTERVAL) return;
      lastCheckRef.current = now;

      // Check each object against target zones
      for (const obj of objects) {
        // Skip non-grabbable objects
        if (!obj.isGrabbable) continue;

        // Check each target zone
        for (const zone of targetZones) {
          if (zone.acceptedObjectIds.includes(obj.id)) {
            const wasInZone = obj.isInTargetZone;
            const isNowInZone = isInZone(obj.position, zone.position, zone.size);

            // Update object's zone status if changed
            if (wasInZone !== isNowInZone) {
              updateObject(obj.id, { isInTargetZone: isNowInZone });

              // Check challenge objectives when object enters zone
              if (isNowInZone && challengeState.activeChallenge) {
                for (const objective of challengeState.activeChallenge.objectives) {
                  if (
                    !objective.isCompleted &&
                    objective.type === 'move_object' &&
                    objective.target?.objectId === obj.id &&
                    objective.target?.zoneId === zone.id
                  ) {
                    completeObjective(objective.id);
                    log.info(`Objective completed: ${objective.description}`);
                  }
                }
              }
            }
          }
        }
      }
    }, 100); // Check every 100ms

    return () => clearInterval(checkInterval);
  }, [completeObjective, updateObject]);

  return null;
};
