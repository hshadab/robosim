/**
 * Collision Guard for Kinematic Robot Arm
 * 
 * Provides collision detection to prevent the kinematic arm from penetrating
 * objects (floor, cubes, etc.) by checking for collisions before each movement.
 */

import { useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';

const FLOOR_Y = 0.02;
const CUBE_HALF_HEIGHT = 0.02;

interface CollisionResult {
  hasCollision: boolean;
  clampedPosition: [number, number, number];
  collisionType: 'none' | 'floor' | 'object';
}

export function useCollisionGuard() {
  const checkGripperCollision = useCallback(
    (targetPosition: [number, number, number]): CollisionResult => {
      const [x, y, z] = targetPosition;

      if (y < FLOOR_Y) {
        return {
          hasCollision: true,
          clampedPosition: [x, FLOOR_Y, z],
          collisionType: 'floor',
        };
      }

      const objects = useAppStore.getState().objects;
      for (const obj of objects) {
        const [ox, oy, oz] = obj.position;
        const objRadius = obj.scale * 0.6;
        
        const dx = x - ox;
        const dy = y - oy;
        const dz = z - oz;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < objRadius + 0.03) {
          const safeY = Math.max(y, oy + objRadius + 0.02);
          return {
            hasCollision: true,
            clampedPosition: [x, safeY, z],
            collisionType: 'object',
          };
        }
      }

      return {
        hasCollision: false,
        clampedPosition: targetPosition,
        collisionType: 'none',
      };
    },
    []
  );

  const clampGripperHeight = useCallback(
    (targetY: number, minHeight: number = FLOOR_Y): number => {
      return Math.max(targetY, minHeight);
    },
    []
  );

  const isMovementSafe = useCallback(
    (
      currentJoints: { shoulder: number; elbow: number; wrist: number },
      targetJoints: { shoulder?: number; elbow?: number; wrist?: number }
    ): { safe: boolean; reason?: string } => {
      const gripperY = useAppStore.getState().gripperWorldPosition[1];
      
      if (gripperY < FLOOR_Y) {
        return { safe: false, reason: 'floor_collision' };
      }

      const newShoulder = targetJoints.shoulder ?? currentJoints.shoulder;
      const newElbow = targetJoints.elbow ?? currentJoints.elbow;
      
      if (newShoulder > 30 && newElbow > 70) {
        const estimatedY = 0.10 - (newShoulder / 100) * 0.15 - (newElbow / 100) * 0.10;
        if (estimatedY < FLOOR_Y) {
          return { safe: false, reason: 'estimated_floor_collision' };
        }
      }

      return { safe: true };
    },
    []
  );

  return {
    checkGripperCollision,
    clampGripperHeight,
    isMovementSafe,
    FLOOR_Y,
    CUBE_HALF_HEIGHT,
  };
}

export function getFloorClampedJoints(
  currentJoints: { base: number; shoulder: number; elbow: number; wrist: number; wristRoll: number; gripper: number },
  targetJoints: Partial<typeof currentJoints>,
  minGripperY: number = FLOOR_Y
): { clamped: boolean; adjustedJoints: Partial<typeof currentJoints> } {
  const gripperPos = useAppStore.getState().gripperWorldPosition;
  const currentY = gripperPos[1];

  if (currentY < minGripperY) {
    const shoulderAdjust = (targetJoints.shoulder ?? currentJoints.shoulder) - 5;
    const elbowAdjust = Math.max(0, (targetJoints.elbow ?? currentJoints.elbow) - 10);
    
    return {
      clamped: true,
      adjustedJoints: {
        ...targetJoints,
        shoulder: shoulderAdjust,
        elbow: elbowAdjust,
      },
    };
  }

  return {
    clamped: false,
    adjustedJoints: targetJoints,
  };
}

export function isPositionSafe(position: [number, number, number]): boolean {
  const [, y] = position;
  return y >= FLOOR_Y;
}
