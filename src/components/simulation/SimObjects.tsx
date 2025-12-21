import React, { useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three/webgpu';
import type { SimObject, TargetZone } from '../../types';

// GLB Model component - hooks must be called unconditionally
const GLBModel: React.FC<{
  url: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}> = ({ url, position, rotation, scale }) => {
  const { scene } = useGLTF(url);
  const clonedScene = scene.clone();

  // Enable shadows on all meshes
  clonedScene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return (
    <primitive
      object={clonedScene}
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
    />
  );
};

interface SimObjectProps {
  object: SimObject;
  isNearGripper?: boolean;
}

// Individual object component
export const SimObjectMesh: React.FC<SimObjectProps> = ({ object, isNearGripper = false }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Subtle hover animation for grababble objects
  useFrame((state) => {
    if (meshRef.current && object.isGrabbable && !object.isGrabbed) {
      // Bounce more when near gripper
      const bounceAmount = isNearGripper ? 0.008 : 0.002;
      const bounceSpeed = isNearGripper ? 4 : 2;
      meshRef.current.position.y =
        object.position[1] + Math.sin(state.clock.elapsedTime * bounceSpeed) * bounceAmount;
    }
  });

  // Determine emissive state (glows when grabbed OR when near gripper)
  const emissiveColor = object.isGrabbed ? object.color : (isNearGripper ? '#FFFFFF' : '#000000');
  const emissiveIntensity = object.isGrabbed ? 0.3 : (isNearGripper ? 0.15 : 0);

  const renderShape = () => {
    switch (object.type) {
      case 'cube':
        return (
          <RoundedBox
            ref={meshRef}
            args={[object.scale, object.scale, object.scale]}
            radius={object.scale * 0.1}
            position={object.position}
            rotation={object.rotation}
            castShadow
          >
            <meshStandardNodeMaterial
              color={object.color}
              metalness={0.1}
              roughness={0.6}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </RoundedBox>
        );

      case 'ball':
        return (
          <mesh
            ref={meshRef}
            position={object.position}
            rotation={object.rotation}
            castShadow
          >
            <sphereGeometry args={[object.scale, 24, 24]} />
            <meshStandardNodeMaterial
              color={object.color}
              metalness={0.2}
              roughness={0.4}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        );

      case 'cylinder':
        return (
          <mesh
            ref={meshRef}
            position={object.position}
            rotation={object.rotation}
            castShadow
          >
            <cylinderGeometry args={[object.scale, object.scale, object.scale * 2, 24]} />
            <meshStandardNodeMaterial
              color={object.color}
              metalness={0.15}
              roughness={0.5}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        );

      case 'glb':
        if (!object.modelUrl) {
          return null;
        }
        return (
          <Suspense fallback={
            <mesh position={object.position}>
              <boxGeometry args={[0.1, 0.1, 0.1]} />
              <meshStandardNodeMaterial color="#ffff00" />
            </mesh>
          }>
            <GLBModel
              url={object.modelUrl}
              position={object.position}
              rotation={object.rotation}
              scale={object.scale}
            />
          </Suspense>
        );

      default:
        return null;
    }
  };

  return renderShape();
};

interface TargetZoneMeshProps {
  zone: TargetZone;
}

// Target zone component with pulsing effect
export const TargetZoneMesh: React.FC<TargetZoneMeshProps> = ({ zone }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      if (!zone.isSatisfied) {
        // Pulsing effect when not satisfied
        const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
        material.opacity = pulse;
      } else {
        material.opacity = 0.6;
      }
    }
  });

  return (
    <group position={zone.position}>
      {/* Zone base */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[zone.size[0], zone.size[2]]} />
        <meshStandardNodeMaterial
          color={zone.color}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Zone border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry
          args={[
            Math.min(zone.size[0], zone.size[2]) * 0.45,
            Math.min(zone.size[0], zone.size[2]) * 0.5,
            32,
          ]}
        />
        <meshBasicNodeMaterial color={zone.color} transparent opacity={0.8} />
      </mesh>

      {/* Corner markers */}
      {[
        [zone.size[0] / 2, zone.size[2] / 2],
        [-zone.size[0] / 2, zone.size[2] / 2],
        [zone.size[0] / 2, -zone.size[2] / 2],
        [-zone.size[0] / 2, -zone.size[2] / 2],
      ].map((corner, i) => (
        <mesh key={i} position={[corner[0] * 0.9, 0.002, corner[1] * 0.9]}>
          <boxGeometry args={[0.01, 0.002, 0.01]} />
          <meshBasicNodeMaterial color={zone.color} />
        </mesh>
      ))}

      {/* Success indicator */}
      {zone.isSatisfied && (
        <mesh position={[0, 0.02, 0]}>
          <torusGeometry args={[0.02, 0.005, 8, 24]} />
          <meshStandardNodeMaterial color="#22C55E" emissive="#22C55E" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
};

interface SimObjectsLayerProps {
  objects: SimObject[];
  targetZones: TargetZone[];
  gripperPosition?: [number, number, number];
}

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

// Main layer component that renders all objects and zones
export const SimObjectsLayer: React.FC<SimObjectsLayerProps> = ({
  objects,
  targetZones,
  gripperPosition
}) => {
  const grabRadius = 0.1; // Must match the hook

  return (
    <group>
      {/* Render target zones first (below objects) */}
      {targetZones.map((zone) => (
        <TargetZoneMesh key={zone.id} zone={zone} />
      ))}

      {/* Render interactive objects */}
      {objects.map((obj) => {
        const isNearGripper = gripperPosition && obj.isGrabbable && !obj.isGrabbed
          ? distance3D(gripperPosition, obj.position) < grabRadius
          : false;
        return (
          <SimObjectMesh key={obj.id} object={obj} isNearGripper={isNearGripper} />
        );
      })}
    </group>
  );
};
