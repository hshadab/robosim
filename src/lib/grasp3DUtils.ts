/**
 * Shared utilities for 3D object analysis
 *
 * Provides grasp point estimation and physics configuration
 * for image-to-3D generated objects.
 */

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface GraspPoint {
  position: [number, number, number];
  normal: [number, number, number];
  graspType: 'pinch' | 'power' | 'hook';
  confidence: number;
}

export interface PhysicsConfig {
  mass: number;
  friction: number;
  restitution: number;
  collisionShape: 'box' | 'sphere' | 'convex' | 'mesh';
}

export interface Generated3DObject {
  sessionId: string;
  name: string;
  meshUrl: string;
  objUrl?: string;
  fbxUrl?: string;
  thumbnailUrl?: string;
  dimensions: [number, number, number];
  graspPoints: GraspPoint[];
  physicsConfig: PhysicsConfig;
  /** Computed bounding box from actual mesh geometry */
  boundingBox?: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
}

/**
 * Load a GLB file and extract its bounding box dimensions
 * This gives accurate dimensions from the actual mesh geometry
 */
export async function analyzeGLBMesh(url: string): Promise<{
  dimensions: [number, number, number];
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
  };
  vertexCount: number;
  meshCount: number;
}> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const box = new THREE.Box3();
        let vertexCount = 0;
        let meshCount = 0;

        // Compute bounding box from all meshes in the scene
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshCount++;
            if (child.geometry) {
              child.geometry.computeBoundingBox();
              const childBox = child.geometry.boundingBox;
              if (childBox) {
                // Transform bounding box to world space
                childBox.applyMatrix4(child.matrixWorld);
                box.union(childBox);
              }
              // Count vertices
              const posAttr = child.geometry.getAttribute('position');
              if (posAttr) {
                vertexCount += posAttr.count;
              }
            }
          }
        });

        // If no valid bounding box, use defaults
        if (box.isEmpty()) {
          resolve({
            dimensions: [0.1, 0.1, 0.1],
            boundingBox: {
              min: [-0.05, -0.05, -0.05],
              max: [0.05, 0.05, 0.05],
              center: [0, 0, 0],
            },
            vertexCount: 0,
            meshCount: 0,
          });
          return;
        }

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        resolve({
          dimensions: [size.x, size.y, size.z],
          boundingBox: {
            min: [box.min.x, box.min.y, box.min.z],
            max: [box.max.x, box.max.y, box.max.z],
            center: [center.x, center.y, center.z],
          },
          vertexCount,
          meshCount,
        });
      },
      undefined,
      (error) => {
        console.error('[analyzeGLBMesh] Failed to load GLB:', error);
        reject(error);
      }
    );
  });
}

/**
 * Determine optimal collision shape based on mesh analysis
 */
export function determineCollisionShape(
  dimensions: [number, number, number],
  _vertexCount: number
): PhysicsConfig['collisionShape'] {
  const [w, h, d] = dimensions;
  const aspectRatioXY = Math.max(w, h) / Math.min(w, h);
  const aspectRatioXZ = Math.max(w, d) / Math.min(w, d);
  const aspectRatioYZ = Math.max(h, d) / Math.min(h, d);

  // Check if roughly spherical (all aspects close to 1)
  if (aspectRatioXY < 1.3 && aspectRatioXZ < 1.3 && aspectRatioYZ < 1.3) {
    return 'sphere';
  }

  // Check if roughly cubic/box-like
  if (aspectRatioXY < 2 && aspectRatioXZ < 2 && aspectRatioYZ < 2) {
    return 'box';
  }

  // Complex shape - use convex hull
  return 'convex';
}

/**
 * Estimate grasp points based on object dimensions and type
 * Uses heuristics based on object geometry to suggest grasp configurations
 */
export function estimateGraspPoints(
  dimensions: [number, number, number],
  objectType?: string
): GraspPoint[] {
  const [width, height, depth] = dimensions;
  const graspPoints: GraspPoint[] = [];

  const maxDim = Math.max(width, height, depth);
  const minDim = Math.min(width, height, depth);
  const aspectRatio = maxDim / Math.max(0.001, minDim);

  // Determine dominant axis (which dimension is largest)
  const isYTallest = height >= width && height >= depth;
  const isXWidest = width >= height && width >= depth;

  // Object type hints for better grasp estimation
  const typeHints = objectType?.toLowerCase() || '';
  const isBottle = /bottle|can|cup|mug|container|jar/i.test(typeHints);
  const isTool = /tool|hammer|screwdriver|wrench|drill/i.test(typeHints);
  const isFlat = /plate|book|box|card/i.test(typeHints);
  const isBall = /ball|sphere|orange|apple|fruit/i.test(typeHints);

  // Spherical objects (aspect ratio close to 1)
  if (aspectRatio < 1.4 || isBall) {
    // Top pinch grasp
    graspPoints.push({
      position: [0, height * 0.35, 0],
      normal: [0, 1, 0],
      graspType: 'pinch',
      confidence: 0.9,
    });
    // Side power grasp
    graspPoints.push({
      position: [width * 0.4, 0, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.85,
    });
    return graspPoints;
  }

  // Long/thin objects (tools, bottles standing up, etc.)
  if (aspectRatio > 2.5 || isTool) {
    if (isYTallest) {
      // Vertical object - grasp middle for stability
      graspPoints.push({
        position: [0, 0, 0],
        normal: [1, 0, 0],
        graspType: 'power',
        confidence: 0.9,
      });
      // Lower grasp for picking up
      graspPoints.push({
        position: [0, -height * 0.25, 0],
        normal: [1, 0, 0],
        graspType: 'power',
        confidence: 0.85,
      });
      // Top pinch for precision
      graspPoints.push({
        position: [0, height * 0.4, 0],
        normal: [0, 1, 0],
        graspType: 'pinch',
        confidence: 0.7,
      });
    } else {
      // Horizontal long object - grasp ends
      const longAxis = isXWidest ? [1, 0, 0] : [0, 0, 1];
      const longDim = isXWidest ? width : depth;

      graspPoints.push({
        position: [longAxis[0] * longDim * 0.3, 0, longAxis[2] * longDim * 0.3],
        normal: [0, 1, 0],
        graspType: 'power',
        confidence: 0.85,
      });
      graspPoints.push({
        position: [0, 0, 0],
        normal: [0, 1, 0],
        graspType: 'power',
        confidence: 0.9,
      });
    }
    return graspPoints;
  }

  // Bottle/container shapes (taller than wide, but not extremely)
  if (isBottle || (isYTallest && aspectRatio > 1.5 && aspectRatio < 2.5)) {
    // Wrap around middle
    graspPoints.push({
      position: [0, -height * 0.1, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.9,
    });
    // Wrap around neck area
    graspPoints.push({
      position: [0, height * 0.3, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.8,
    });
    return graspPoints;
  }

  // Flat objects (plates, books, boxes)
  if (isFlat || (!isYTallest && aspectRatio > 1.5)) {
    // Top pinch grasp
    graspPoints.push({
      position: [0, height * 0.4, 0],
      normal: [0, 1, 0],
      graspType: 'pinch',
      confidence: 0.9,
    });
    // Edge grasp
    graspPoints.push({
      position: [width * 0.4, 0, 0],
      normal: [1, 0, 0],
      graspType: 'pinch',
      confidence: 0.8,
    });
    return graspPoints;
  }

  // Default: box-like objects
  // Two-sided power grasp (most stable)
  graspPoints.push({
    position: [width * 0.4, 0, 0],
    normal: [1, 0, 0],
    graspType: 'power',
    confidence: 0.85,
  });
  graspPoints.push({
    position: [-width * 0.4, 0, 0],
    normal: [-1, 0, 0],
    graspType: 'power',
    confidence: 0.85,
  });

  // Top pinch for small objects
  if (maxDim < 0.1) {
    graspPoints.push({
      position: [0, height * 0.4, 0],
      normal: [0, 1, 0],
      graspType: 'pinch',
      confidence: 0.8,
    });
  }

  // Front/back grasp alternative
  if (depth > width * 0.8) {
    graspPoints.push({
      position: [0, 0, depth * 0.4],
      normal: [0, 0, 1],
      graspType: 'power',
      confidence: 0.75,
    });
  }

  return graspPoints;
}

/**
 * Estimate physics configuration based on object dimensions
 */
export function estimatePhysicsConfig(
  dimensions: [number, number, number],
  _objectType?: string
): PhysicsConfig {
  const [width, height, depth] = dimensions;
  const volume = width * height * depth;

  // Assume wood-like density (kg/m^3)
  const density = 800;
  const mass = Math.max(0.01, Math.min(5, volume * density));

  const aspectRatio = Math.max(width, height, depth) / Math.min(width, height, depth);
  let collisionShape: PhysicsConfig['collisionShape'] = 'convex';

  // Use box for nearly cubic objects
  if (aspectRatio < 1.3) {
    collisionShape = 'box';
  }

  return {
    mass,
    friction: 0.5,
    restitution: 0.2,
    collisionShape,
  };
}

/**
 * Convert a File to base64 data URL
 */
export function imageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
