/**
 * Click-to-Move Component for SO-101 Robot Arm
 *
 * Enables clicking in 3D space to set a target position.
 * Uses inverse kinematics to calculate joint angles.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import type { JointState } from '../../types';
import {
  calculateInverseKinematics,
  isPositionReachable,
  getWorkspaceBounds,
} from './SO101Kinematics';

interface ClickToMoveProps {
  joints: JointState;
  onMove: (newJoints: JointState) => void;
  enabled?: boolean;
}

// Target marker that shows where the arm will move
const TargetMarker: React.FC<{
  position: [number, number, number];
  reachable: boolean;
  visible: boolean;
}> = ({ position, reachable, visible }) => {
  const markerRef = useRef<THREE.Group>(null);

  // Animate the marker
  useFrame((state) => {
    if (markerRef.current && visible) {
      markerRef.current.rotation.y = state.clock.elapsedTime * 2;
      markerRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.005;
    }
  });

  if (!visible) return null;

  return (
    <group ref={markerRef} position={position}>
      {/* Outer ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.003, 8, 32]} />
        <meshStandardNodeMaterial
          color={reachable ? '#22c55e' : '#ef4444'}
          emissive={reachable ? '#22c55e' : '#ef4444'}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Inner cross */}
      <mesh>
        <boxGeometry args={[0.04, 0.002, 0.002]} />
        <meshStandardNodeMaterial
          color={reachable ? '#22c55e' : '#ef4444'}
          emissive={reachable ? '#22c55e' : '#ef4444'}
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[0.002, 0.002, 0.04]} />
        <meshStandardNodeMaterial
          color={reachable ? '#22c55e' : '#ef4444'}
          emissive={reachable ? '#22c55e' : '#ef4444'}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Vertical line to ground */}
      <mesh position={[0, -position[1] / 2, 0]}>
        <boxGeometry args={[0.001, position[1], 0.001]} />
        <meshStandardNodeMaterial
          color={reachable ? '#22c55e' : '#ef4444'}
          opacity={0.3}
          transparent
        />
      </mesh>

      {/* Label */}
      <Html position={[0, 0.04, 0]} center>
        <div
          className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap ${
            reachable
              ? 'bg-green-900/80 text-green-300 border border-green-500/50'
              : 'bg-red-900/80 text-red-300 border border-red-500/50'
          }`}
        >
          {reachable ? 'Click to move' : 'Out of reach'}
          <div className="text-[10px] opacity-70">
            ({position[0].toFixed(3)}, {position[1].toFixed(3)}, {position[2].toFixed(3)})
          </div>
        </div>
      </Html>
    </group>
  );
};

// Invisible plane for raycasting clicks
const ClickPlane: React.FC<{
  onHover: (point: THREE.Vector3 | null) => void;
  onClick: (point: THREE.Vector3) => void;
  height: number;
}> = ({ onHover, onClick, height }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      position={[0, height, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(e.point);
      }}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e.point);
      }}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial visible={false} />
    </mesh>
  );
};

// Workspace visualization (semi-transparent dome showing reachable area)
const WorkspaceVisualization: React.FC<{ visible: boolean }> = ({ visible }) => {
  const bounds = getWorkspaceBounds();

  if (!visible) return null;

  return (
    <group>
      {/* Outer reach boundary (hemisphere) */}
      <mesh position={[0, bounds.minY + 0.14, 0]}>
        <sphereGeometry args={[bounds.maxReach, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardNodeMaterial
          color="#3b82f6"
          opacity={0.08}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Inner unreachable zone */}
      <mesh position={[0, bounds.minY + 0.14, 0]}>
        <sphereGeometry args={[0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardNodeMaterial
          color="#ef4444"
          opacity={0.1}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ground circle showing reach */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, bounds.maxReach, 64]} />
        <meshStandardNodeMaterial
          color="#3b82f6"
          opacity={0.15}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

export const ClickToMove: React.FC<ClickToMoveProps> = ({
  joints,
  onMove,
  enabled = true,
}) => {
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [targetHeight] = useState(0.15); // Default height

  const handleHover = useCallback((point: THREE.Vector3 | null) => {
    if (point) {
      // Keep the point at the current target height
      setHoverPoint(new THREE.Vector3(point.x, targetHeight, point.z));
    } else {
      setHoverPoint(null);
    }
  }, [targetHeight]);

  const handleClick = useCallback(
    (point: THREE.Vector3) => {
      if (!enabled) return;

      const targetPos: [number, number, number] = [point.x, targetHeight, point.z];

      // Calculate IK solution
      const solution = calculateInverseKinematics(
        targetPos[0],
        targetPos[1],
        targetPos[2],
        joints
      );

      if (solution) {
        onMove(solution);
      }
    },
    [enabled, joints, onMove, targetHeight]
  );

  const isReachable = hoverPoint
    ? isPositionReachable(hoverPoint.x, hoverPoint.y, hoverPoint.z)
    : false;

  if (!enabled) return null;

  return (
    <group>
      {/* Click planes at different heights */}
      <ClickPlane onHover={handleHover} onClick={handleClick} height={targetHeight} />

      {/* Target marker */}
      <TargetMarker
        position={hoverPoint ? [hoverPoint.x, hoverPoint.y, hoverPoint.z] : [0, 0, 0]}
        reachable={isReachable}
        visible={!!hoverPoint}
      />
    </group>
  );
};

export { WorkspaceVisualization };
