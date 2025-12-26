/**
 * Distractor Objects Component
 * Renders random distractor objects for domain randomization
 * These objects are not interactable, just visual clutter for training robustness
 */

import React from 'react';
import type { DistractorObject } from '../../lib/domainRandomization';

interface DistractorObjectsProps {
  distractors: DistractorObject[];
}

/**
 * Single distractor object renderer
 */
const DistractorMesh: React.FC<{ distractor: DistractorObject }> = ({ distractor }) => {
  const { shape, position, rotation, scale, color, roughness, metalness } = distractor;

  // Select geometry based on shape
  const renderGeometry = () => {
    switch (shape) {
      case 'sphere':
        return <sphereGeometry args={[scale, 16, 16]} />;
      case 'cylinder':
        return <cylinderGeometry args={[scale * 0.5, scale * 0.5, scale * 1.5, 16]} />;
      case 'cube':
      default:
        return <boxGeometry args={[scale, scale, scale]} />;
    }
  };

  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      {renderGeometry()}
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
};

/**
 * Container for all distractor objects
 */
export const DistractorObjects: React.FC<DistractorObjectsProps> = ({ distractors }) => {
  if (!distractors || distractors.length === 0) {
    return null;
  }

  return (
    <group name="distractors">
      {distractors.map((distractor) => (
        <DistractorMesh key={distractor.id} distractor={distractor} />
      ))}
    </group>
  );
};

export default DistractorObjects;
