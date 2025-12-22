/**
 * Scene Background Component
 * Simple, lightweight background for the 3D scene
 */

import React from 'react';

// Simple grid floor
const GridFloor: React.FC<{ size?: number }> = ({ size = 2 }) => {
  return (
    <group>
      {/* Main floor surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#1a2332" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Grid overlay */}
      <gridHelper args={[size, 20, '#3a4a5f', '#2a3a4f']} position={[0, 0.001, 0]} />
    </group>
  );
};

interface SceneBackgroundProps {
  floorSize?: number;
}

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  floorSize = 2,
}) => {
  return (
    <group>
      {/* Simple background color is set on Canvas */}
      <GridFloor size={floorSize} />
    </group>
  );
};

// Simple lighting setup
export const SceneLighting: React.FC = () => {
  return (
    <group>
      {/* Key light */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-1, 1, 1, -1, 0.1, 20]} />
      </directionalLight>

      {/* Fill light */}
      <directionalLight position={[-3, 4, -2]} intensity={0.8} color="#a0c4ff" />

      {/* Rim light */}
      <directionalLight position={[0, 3, -5]} intensity={0.6} color="#ffd6a5" />

      {/* Ambient */}
      <ambientLight intensity={0.4} />
    </group>
  );
};

export default SceneBackground;
