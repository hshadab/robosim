/**
 * Shared utilities for 3D object analysis
 *
 * Provides grasp point estimation and physics configuration
 * for image-to-3D generated objects.
 */

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
}

/**
 * Estimate grasp points based on object dimensions
 */
export function estimateGraspPoints(
  dimensions: [number, number, number],
  _objectType?: string
): GraspPoint[] {
  const [width, height, depth] = dimensions;
  const graspPoints: GraspPoint[] = [];

  const maxDim = Math.max(width, height, depth);
  const minDim = Math.min(width, height, depth);
  const aspectRatio = maxDim / minDim;

  if (aspectRatio > 3) {
    // Long/thin objects - grasp along length
    graspPoints.push({
      position: [0, -height * 0.3, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.9,
    });
    graspPoints.push({
      position: [0, height * 0.4, 0],
      normal: [1, 0, 0],
      graspType: 'pinch',
      confidence: 0.7,
    });
  } else if (aspectRatio < 1.5) {
    // Roughly cubic objects - side grasps
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
    // Small objects can also be pinched from top
    if (maxDim < 0.1) {
      graspPoints.push({
        position: [0, height * 0.4, 0],
        normal: [0, 1, 0],
        graspType: 'pinch',
        confidence: 0.8,
      });
    }
  } else {
    // Medium aspect ratio - default grasps
    graspPoints.push({
      position: [0, 0, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.8,
    });
    graspPoints.push({
      position: [0, height * 0.3, 0],
      normal: [0, 1, 0],
      graspType: 'pinch',
      confidence: 0.7,
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
