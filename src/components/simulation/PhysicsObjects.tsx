import React, { useRef, useEffect, Suspense } from 'react';
import { RigidBody, CuboidCollider, BallCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SimObject, TargetZone } from '../../types';

// GLB Model component for loaded 3D models
// Note: useGLTF suspends during loading, so this must be wrapped in Suspense
const GLBModel: React.FC<{
  url: string;
  scale: number;
}> = ({ url, scale }) => {
  console.log('[GLBModel] Loading model from:', url);

  const { scene } = useGLTF(url);

  // Clone the scene to allow multiple instances
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    // Enable shadows on all meshes
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  console.log('[GLBModel] Model loaded successfully');

  return (
    <primitive
      object={clonedScene}
      scale={[scale, scale, scale]}
    />
  );
};

interface PhysicsObjectProps {
  object: SimObject;
  isNearGripper?: boolean;
}

export const PhysicsObject: React.FC<PhysicsObjectProps> = ({
  object,
  isNearGripper = false,
}) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  // Determine emissive state
  const emissiveColor = object.isGrabbed ? object.color : (isNearGripper ? '#FFFFFF' : '#000000');
  const emissiveIntensity = object.isGrabbed ? 0.3 : (isNearGripper ? 0.15 : 0);

  // When grabbed, make it kinematic and follow gripper (handled by parent)
  useEffect(() => {
    if (rigidBodyRef.current) {
      if (object.isGrabbed) {
        rigidBodyRef.current.setBodyType(2, true); // Kinematic
      } else {
        rigidBodyRef.current.setBodyType(0, true); // Dynamic
      }
    }
  }, [object.isGrabbed]);

  // Update position when grabbed
  useEffect(() => {
    if (rigidBodyRef.current && object.isGrabbed) {
      rigidBodyRef.current.setTranslation(
        { x: object.position[0], y: object.position[1], z: object.position[2] },
        true
      );
    }
  }, [object.position, object.isGrabbed]);

  const renderShape = () => {
    switch (object.type) {
      case 'cube':
        return (
          <RigidBody
            ref={rigidBodyRef}
            position={object.position}
            rotation={object.rotation}
            colliders={false}
            mass={0.5}
            restitution={0.2}
            friction={0.8}
          >
            <CuboidCollider args={[object.scale / 2, object.scale / 2, object.scale / 2]} />
            <RoundedBox
              args={[object.scale, object.scale, object.scale]}
              radius={object.scale * 0.1}
              castShadow
            >
              <meshStandardMaterial
                color={object.color}
                metalness={0.1}
                roughness={0.6}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
              />
            </RoundedBox>
          </RigidBody>
        );

      case 'ball':
        return (
          <RigidBody
            ref={rigidBodyRef}
            position={object.position}
            rotation={object.rotation}
            colliders={false}
            mass={0.3}
            restitution={0.5}
            friction={0.5}
          >
            <BallCollider args={[object.scale]} />
            <mesh castShadow>
              <sphereGeometry args={[object.scale, 24, 24]} />
              <meshStandardMaterial
                color={object.color}
                metalness={0.2}
                roughness={0.4}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
          </RigidBody>
        );

      case 'cylinder':
        return (
          <RigidBody
            ref={rigidBodyRef}
            position={object.position}
            rotation={object.rotation}
            colliders={false}
            mass={0.4}
            restitution={0.3}
            friction={0.7}
          >
            <CylinderCollider args={[object.scale, object.scale]} />
            <mesh castShadow>
              <cylinderGeometry args={[object.scale, object.scale, object.scale * 2, 24]} />
              <meshStandardMaterial
                color={object.color}
                metalness={0.15}
                roughness={0.5}
                emissive={emissiveColor}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
          </RigidBody>
        );

      case 'glb':
        console.log('[PhysicsObject] Rendering GLB:', object.modelUrl);
        if (!object.modelUrl) {
          console.warn('[PhysicsObject] No modelUrl for GLB object');
          return null;
        }
        return (
          <RigidBody
            ref={rigidBodyRef}
            position={object.position}
            rotation={object.rotation}
            colliders={false}
            mass={0.5}
            restitution={0.2}
            friction={0.8}
          >
            {/* Use a box collider as approximation for GLB */}
            <CuboidCollider args={[object.scale / 2, object.scale / 2, object.scale / 2]} />
            <Suspense fallback={
              <mesh>
                <boxGeometry args={[object.scale, object.scale, object.scale]} />
                <meshStandardMaterial color="#ffff00" />
              </mesh>
            }>
              <GLBModel url={object.modelUrl} scale={object.scale} />
            </Suspense>
          </RigidBody>
        );

      default:
        return null;
    }
  };

  return renderShape();
};

interface TargetZonePhysicsProps {
  zone: TargetZone;
}

export const TargetZonePhysics: React.FC<TargetZonePhysicsProps> = ({ zone }) => {
  return (
    <group position={zone.position}>
      {/* Visual indicator only - no physics */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[zone.size[0], zone.size[2]]} />
        <meshStandardMaterial
          color={zone.color}
          transparent
          opacity={zone.isSatisfied ? 0.6 : 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry
          args={[
            Math.min(zone.size[0], zone.size[2]) * 0.45,
            Math.min(zone.size[0], zone.size[2]) * 0.5,
            32,
          ]}
        />
        <meshBasicMaterial color={zone.color} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

// Floor collider - thin collider at Y=0 so objects rest on the visual floor
export const FloorCollider: React.FC = () => {
  return (
    <RigidBody type="fixed" position={[0, -0.005, 0]} friction={0.8} restitution={0.1}>
      <CuboidCollider args={[2, 0.005, 2]} />
    </RigidBody>
  );
};
