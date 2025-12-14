import React, { useRef, useEffect, Suspense, useState, useMemo, useCallback } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider, BallCollider, CylinderCollider, ConvexHullCollider } from '@react-three/rapier';
import { RoundedBox, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SimObject, TargetZone } from '../../types';

/** Shape classification for physics colliders */
type ColliderShape = 'sphere' | 'box' | 'cylinder' | 'convex';

/** Mesh analysis result */
interface MeshAnalysis {
  bounds: { size: THREE.Vector3; center: THREE.Vector3 };
  shape: ColliderShape;
  vertices: Float32Array | null;
  aspectRatios: { xy: number; xz: number; yz: number };
}

/**
 * Analyze mesh geometry to determine optimal collider shape
 */
function analyzeMeshGeometry(scene: THREE.Object3D): MeshAnalysis {
  const box = new THREE.Box3();
  const allVertices: number[] = [];

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      child.updateWorldMatrix(true, false);
      box.expandByObject(child);

      // Extract vertices for convex hull
      const posAttr = child.geometry.getAttribute('position');
      if (posAttr) {
        const matrix = child.matrixWorld;
        const vertex = new THREE.Vector3();

        // Sample vertices (limit for performance)
        const step = Math.max(1, Math.floor(posAttr.count / 500));
        for (let i = 0; i < posAttr.count; i += step) {
          vertex.fromBufferAttribute(posAttr, i);
          vertex.applyMatrix4(matrix);
          allVertices.push(vertex.x, vertex.y, vertex.z);
        }
      }
    }
  });

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  if (!box.isEmpty()) {
    box.getSize(size);
    box.getCenter(center);
  } else {
    size.set(1, 1, 1);
  }

  // Calculate aspect ratios
  const aspectRatios = {
    xy: Math.max(size.x, size.y) / Math.max(0.001, Math.min(size.x, size.y)),
    xz: Math.max(size.x, size.z) / Math.max(0.001, Math.min(size.x, size.z)),
    yz: Math.max(size.y, size.z) / Math.max(0.001, Math.min(size.y, size.z)),
  };

  // Determine shape based on aspect ratios
  let shape: ColliderShape = 'convex';

  // Spherical: all aspects close to 1
  if (aspectRatios.xy < 1.4 && aspectRatios.xz < 1.4 && aspectRatios.yz < 1.4) {
    shape = 'sphere';
  }
  // Cylindrical: one axis much longer, other two similar
  else if (
    (aspectRatios.xy < 1.4 && aspectRatios.xz > 2) || // Y is long axis
    (aspectRatios.xz < 1.4 && aspectRatios.xy > 2) || // Z is long axis
    (aspectRatios.yz < 1.4 && aspectRatios.xy > 2)    // X is long axis
  ) {
    shape = 'cylinder';
  }
  // Box-like: moderate aspect ratios
  else if (aspectRatios.xy < 2.5 && aspectRatios.xz < 2.5 && aspectRatios.yz < 2.5) {
    shape = 'box';
  }

  return {
    bounds: { size, center },
    shape,
    vertices: allVertices.length > 9 ? new Float32Array(allVertices) : null,
    aspectRatios,
  };
}

// GLB Model component for loaded 3D models with geometry analysis
const GLBModel: React.FC<{
  url: string;
  scale: number;
  onAnalysisComplete?: (analysis: MeshAnalysis) => void;
}> = ({ url, scale, onAnalysisComplete }) => {
  const { scene } = useGLTF(url);

  // Clone and analyze the scene
  const { clonedScene, analysis } = useMemo(() => {
    const clone = scene.clone();

    // Enable shadows
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const meshAnalysis = analyzeMeshGeometry(clone);
    return { clonedScene: clone, analysis: meshAnalysis };
  }, [scene]);

  // Report analysis to parent
  useEffect(() => {
    if (onAnalysisComplete) {
      onAnalysisComplete(analysis);
    }
  }, [analysis, onAnalysisComplete]);

  return (
    <primitive
      object={clonedScene}
      scale={[scale, scale, scale]}
    />
  );
};

/**
 * GLB Physics Object - loads model and creates optimal colliders based on geometry
 */
const GLBPhysicsObject: React.FC<{
  object: SimObject;
  rigidBodyRef: React.RefObject<RapierRigidBody | null>;
  emissiveColor: string;
  emissiveIntensity: number;
}> = ({ object, rigidBodyRef, emissiveColor, emissiveIntensity }) => {
  const [analysis, setAnalysis] = useState<MeshAnalysis | null>(null);

  const handleAnalysis = useCallback((a: MeshAnalysis) => {
    setAnalysis(a);
  }, []);

  // Compute collider based on analysis
  const collider = useMemo(() => {
    if (!analysis) {
      // Fallback while loading
      return <CuboidCollider args={[object.scale / 2, object.scale / 2, object.scale / 2]} />;
    }

    const { bounds, shape, vertices } = analysis;
    const s = object.scale;

    switch (shape) {
      case 'sphere': {
        const radius = Math.max(bounds.size.x, bounds.size.y, bounds.size.z) * s / 2;
        return <BallCollider args={[radius]} />;
      }

      case 'cylinder': {
        // Determine cylinder orientation based on longest axis
        const { x, y, z } = bounds.size;
        let halfHeight: number;
        let radius: number;

        if (y >= x && y >= z) {
          // Y is longest (upright cylinder)
          halfHeight = (y * s) / 2;
          radius = Math.max(x, z) * s / 2;
        } else if (x >= y && x >= z) {
          // X is longest
          halfHeight = (x * s) / 2;
          radius = Math.max(y, z) * s / 2;
        } else {
          // Z is longest
          halfHeight = (z * s) / 2;
          radius = Math.max(x, y) * s / 2;
        }
        return <CylinderCollider args={[halfHeight, radius]} />;
      }

      case 'convex': {
        // Use convex hull if we have vertices
        if (vertices && vertices.length > 9) {
          // Scale vertices
          const scaledVertices = new Float32Array(vertices.length);
          for (let i = 0; i < vertices.length; i++) {
            scaledVertices[i] = vertices[i] * s;
          }
          return <ConvexHullCollider args={[scaledVertices]} />;
        }
        // Fallback to box
        return (
          <CuboidCollider
            args={[
              (bounds.size.x * s) / 2,
              (bounds.size.y * s) / 2,
              (bounds.size.z * s) / 2,
            ]}
          />
        );
      }

      case 'box':
      default:
        return (
          <CuboidCollider
            args={[
              (bounds.size.x * s) / 2,
              (bounds.size.y * s) / 2,
              (bounds.size.z * s) / 2,
            ]}
          />
        );
    }
  }, [analysis, object.scale]);

  // Calculate mass based on volume
  const mass = useMemo(() => {
    if (!analysis) return 0.5;
    const { size } = analysis.bounds;
    const volume = size.x * size.y * size.z * Math.pow(object.scale, 3);
    // Assume density ~800 kg/m³ (wood-like), clamp to reasonable range
    return Math.max(0.05, Math.min(5, volume * 800));
  }, [analysis, object.scale]);

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={object.position}
      rotation={object.rotation}
      colliders={false}
      mass={mass}
      restitution={0.2}
      friction={0.7}
    >
      {collider}
      <Suspense fallback={
        <mesh>
          <boxGeometry args={[object.scale, object.scale, object.scale]} />
          <meshStandardMaterial
            color="#ffff00"
            emissive={emissiveColor}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>
      }>
        <GLBModel
          url={object.modelUrl!}
          scale={object.scale}
          onAnalysisComplete={handleAnalysis}
        />
      </Suspense>
    </RigidBody>
  );
};

interface PhysicsObjectProps {
  object: SimObject;
  isNearGripper?: boolean;
}

// Physics friction coefficient for grippable objects
// Higher friction makes objects easier to grip and hold
const GRIPPABLE_FRICTION = 1.5;

export const PhysicsObject: React.FC<PhysicsObjectProps> = ({
  object,
  isNearGripper = false,
}) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  // Determine emissive state (visual feedback only, no kinematic switching)
  const emissiveColor = isNearGripper ? '#FFFFFF' : '#000000';
  const emissiveIntensity = isNearGripper ? 0.15 : 0;

  // Objects are ALWAYS dynamic - physics handles gripping via friction
  // No kinematic switching, no teleporting

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
            restitution={0.1}
            friction={GRIPPABLE_FRICTION}
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
            restitution={0.2}
            friction={GRIPPABLE_FRICTION}
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
            restitution={0.1}
            friction={GRIPPABLE_FRICTION}
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
        if (!object.modelUrl) {
          console.warn('[PhysicsObject] No modelUrl for GLB object');
          return null;
        }
        return (
          <GLBPhysicsObject
            object={object}
            rigidBodyRef={rigidBodyRef}
            emissiveColor={emissiveColor}
            emissiveIntensity={emissiveIntensity}
          />
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
