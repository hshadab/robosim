import React from 'react';
import * as THREE from 'three';
import type { EnvironmentType } from '../../types';

// Wall component for maze
const Wall: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, size, rotation = [0, 0, 0] }) => {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#475569" metalness={0.1} roughness={0.8} />
    </mesh>
  );
};

// Line track for line following
const LineTrack: React.FC = () => {
  // Create a curved line path
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 0.001, 0),
    new THREE.Vector3(0.15, 0.001, 0.1),
    new THREE.Vector3(0.05, 0.001, 0.12),
    new THREE.Vector3(-0.05, 0.001, 0.08),
    new THREE.Vector3(-0.1, 0.001, 0),
    new THREE.Vector3(-0.08, 0.001, -0.1),
    new THREE.Vector3(0, 0.001, -0.15),
    new THREE.Vector3(0.1, 0.001, -0.1),
    new THREE.Vector3(0.15, 0.001, -0.05),
    new THREE.Vector3(0.2, 0.001, 0),
  ]);

  return (
    <group>
      {/* Base surface - light color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} receiveShadow>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color="#E2E8F0" />
      </mesh>

      {/* Wider track using tube for visibility (main line) */}
      <mesh>
        <tubeGeometry args={[curve, 100, 0.015, 8, false]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Start marker */}
      <mesh position={[0.2, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.02, 16]} />
        <meshBasicMaterial color="#22C55E" />
      </mesh>

      {/* Checkpoints */}
      {[
        [0.05, 0.12],
        [-0.1, 0],
        [0, -0.15],
      ].map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.002, pos[1]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.015, 0.02, 16]} />
          <meshBasicMaterial color="#F59E0B" />
        </mesh>
      ))}
    </group>
  );
};

// Maze layout
const MazeLayout: React.FC = () => {
  const wallHeight = 0.04;
  const wallThickness = 0.01;

  return (
    <group>
      {/* Maze floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Outer walls */}
      <Wall position={[0, wallHeight / 2, 0.2]} size={[0.4, wallHeight, wallThickness]} />
      <Wall position={[0, wallHeight / 2, -0.2]} size={[0.4, wallHeight, wallThickness]} />
      <Wall position={[0.2, wallHeight / 2, 0]} size={[wallThickness, wallHeight, 0.4]} />
      <Wall position={[-0.2, wallHeight / 2, 0]} size={[wallThickness, wallHeight, 0.4]} />

      {/* Inner maze walls */}
      <Wall position={[-0.1, wallHeight / 2, 0.1]} size={[0.15, wallHeight, wallThickness]} />
      <Wall position={[0.05, wallHeight / 2, 0.05]} size={[wallThickness, wallHeight, 0.12]} />
      <Wall position={[0.1, wallHeight / 2, -0.05]} size={[0.12, wallHeight, wallThickness]} />
      <Wall position={[-0.05, wallHeight / 2, -0.1]} size={[0.18, wallHeight, wallThickness]} />
      <Wall position={[-0.12, wallHeight / 2, -0.05]} size={[wallThickness, wallHeight, 0.12]} />
      <Wall position={[0.12, wallHeight / 2, 0.1]} size={[wallThickness, wallHeight, 0.08]} />

      {/* Start zone */}
      <mesh position={[-0.15, 0.002, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 0.06]} />
        <meshBasicMaterial color="#22C55E" transparent opacity={0.5} />
      </mesh>

      {/* End zone */}
      <mesh position={[0.15, 0.002, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.06, 0.06]} />
        <meshBasicMaterial color="#EF4444" transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

// Obstacle course with various obstacles
const ObstacleCourse: React.FC = () => {
  return (
    <group>
      {/* Course floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Static obstacles */}
      <mesh position={[0.05, 0.025, 0.08]} castShadow>
        <boxGeometry args={[0.04, 0.05, 0.04]} />
        <meshStandardMaterial color="#6B7280" metalness={0.3} roughness={0.7} />
      </mesh>

      <mesh position={[-0.08, 0.02, -0.05]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.04, 16]} />
        <meshStandardMaterial color="#6B7280" metalness={0.3} roughness={0.7} />
      </mesh>

      <mesh position={[0.0, 0.02, -0.1]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.03]} />
        <meshStandardMaterial color="#6B7280" metalness={0.3} roughness={0.7} />
      </mesh>

      {/* Ramp */}
      <mesh position={[-0.12, 0.015, 0.1]} rotation={[0, 0, Math.PI / 12]} castShadow>
        <boxGeometry args={[0.08, 0.005, 0.06]} />
        <meshStandardMaterial color="#9CA3AF" metalness={0.2} roughness={0.6} />
      </mesh>

      {/* Guide markers */}
      {[0.15, 0.05, -0.05, -0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.002, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.01, 8]} />
          <meshBasicMaterial color="#60A5FA" />
        </mesh>
      ))}
    </group>
  );
};

// Warehouse with shelves and zones
const WarehouseLayout: React.FC = () => {
  return (
    <group>
      {/* Warehouse floor with grid pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color="#1F2937" />
      </mesh>

      {/* Floor markings - lanes */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[0.02, 0.4]} />
        <meshBasicMaterial color="#FBBF24" transparent opacity={0.6} />
      </mesh>

      {/* Pickup area indicator */}
      <group position={[0.15, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[0.12, 0.25]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.15} />
        </mesh>
        {/* Corner brackets */}
        {[
          [0.055, 0.12],
          [-0.055, 0.12],
          [0.055, -0.12],
          [-0.055, -0.12],
        ].map((pos, i) => (
          <mesh key={i} position={[pos[0], 0.003, pos[1]]} rotation={[-Math.PI / 2, 0, Math.PI / 4 * (i % 2 ? 1 : -1)]}>
            <planeGeometry args={[0.02, 0.002]} />
            <meshBasicMaterial color="#3B82F6" />
          </mesh>
        ))}
      </group>

      {/* Dropoff area indicator */}
      <group position={[-0.15, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[0.12, 0.25]} />
          <meshBasicMaterial color="#22C55E" transparent opacity={0.15} />
        </mesh>
      </group>

      {/* Mini shelves/racks */}
      <mesh position={[0.22, 0.02, 0.15]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.08]} />
        <meshStandardMaterial color="#64748B" metalness={0.4} roughness={0.6} />
      </mesh>

      <mesh position={[0.22, 0.02, -0.15]} castShadow>
        <boxGeometry args={[0.04, 0.04, 0.08]} />
        <meshStandardMaterial color="#64748B" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Conveyor representation */}
      <mesh position={[-0.22, 0.015, 0]} castShadow>
        <boxGeometry args={[0.04, 0.025, 0.35]} />
        <meshStandardMaterial color="#374151" metalness={0.2} roughness={0.8} />
      </mesh>
      {/* Conveyor rollers */}
      {[-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map((z, i) => (
        <mesh key={i} position={[-0.22, 0.028, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.045, 8]} />
          <meshStandardMaterial color="#6B7280" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
};

// Empty workspace - minimal
const EmptyWorkspace: React.FC = () => {
  return (
    <group>
      {/* Clean workspace surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[0.5, 0.4]} />
        <meshStandardMaterial color="#475569" metalness={0.1} roughness={0.8} />
      </mesh>

      {/* Subtle grid markings */}
      {[-0.15, -0.05, 0.05, 0.15].map((x, i) =>
        [-0.1, 0, 0.1].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, 0.002, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.008, 0.01, 16]} />
            <meshBasicMaterial color="#64748B" transparent opacity={0.3} />
          </mesh>
        ))
      )}

      {/* Center reference marker */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.018, 32]} />
        <meshBasicMaterial color="#60A5FA" transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

interface EnvironmentLayerProps {
  environmentId: EnvironmentType;
}

// Main environment layer that switches between layouts
export const EnvironmentLayer: React.FC<EnvironmentLayerProps> = ({ environmentId }) => {
  switch (environmentId) {
    case 'lineTrack':
      return <LineTrack />;
    case 'maze':
      return <MazeLayout />;
    case 'obstacles':
      return <ObstacleCourse />;
    case 'warehouse':
      return <WarehouseLayout />;
    case 'empty':
    default:
      return <EmptyWorkspace />;
  }
};
