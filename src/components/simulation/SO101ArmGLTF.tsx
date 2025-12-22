/**
 * SO-101 Robot Arm 3D Model - GLTF Version
 * Uses pre-converted GLTF model for reliable rendering
 * 100% accurate geometry from official LeRobot SO-101 CAD files
 */

import React, { useMemo, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import type { JointState } from '../../types';
import { SO101_DIMS } from './SO101Kinematics';

interface SO101ArmProps {
  joints: JointState;
}

// Preload the combined model (single mesh, correctly positioned)
useGLTF.preload('/models/so101.glb');

const LoadingFallback: React.FC = () => (
  <mesh position={[0, 0.15, 0]}>
    <boxGeometry args={[0.05, 0.3, 0.05]} />
    <meshStandardMaterial color="#F5F0E6" wireframe />
  </mesh>
);

/**
 * Static GLTF robot arm - displays 100% accurate geometry
 * The model shows the robot in rest pose (all joints at 0)
 * For animated version, we'd need to create a properly rigged GLTF in Blender
 */
const StaticGLTFArm: React.FC<SO101ArmProps> = ({ joints: _joints }) => {
  const { scene } = useGLTF('/models/so101.glb');

  // Clone and set up materials
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Determine color based on existing vertex colors or default
        const currentColor = (child.material as THREE.MeshStandardMaterial)?.color;
        const isDark = currentColor && (currentColor.r + currentColor.g + currentColor.b) < 1;

        child.material = new THREE.MeshStandardMaterial({
          color: isDark ? '#1a1a1a' : '#F5F0E6',
          metalness: isDark ? 0.3 : 0.05,
          roughness: isDark ? 0.4 : 0.6,
        });
      }
    });

    return clone;
  }, [scene]);

  return (
    <group>
      {/* Base collider for physics */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[SO101_DIMS.baseHeight / 2, SO101_DIMS.baseRadius]}
          position={[0, SO101_DIMS.baseHeight / 2, 0]}
        />
      </RigidBody>

      {/* The accurate SO-101 geometry */}
      <primitive object={clonedScene} />
    </group>
  );
};

export const SO101Arm3D: React.FC<SO101ArmProps> = ({ joints }) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <StaticGLTFArm joints={joints} />
    </Suspense>
  );
};
