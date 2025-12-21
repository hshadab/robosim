/**
 * WebGPU Node Materials
 * Provides WebGPU-compatible materials using Three.js TSL (Three Shading Language)
 */

import * as THREE from 'three/webgpu';

// Re-export THREE from webgpu module for components that need it
export { THREE };

// Material configuration types (matching existing patterns)
export interface StandardMaterialConfig {
  color: string | number;
  metalness?: number;
  roughness?: number;
  emissive?: string | number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  wireframe?: boolean;
}

export interface BasicMaterialConfig {
  color: string | number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  wireframe?: boolean;
  depthWrite?: boolean;
}

/**
 * Create a WebGPU-compatible MeshStandardNodeMaterial
 */
export function createStandardNodeMaterial(config: StandardMaterialConfig): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial();

  material.color = new THREE.Color(config.color);
  material.metalness = config.metalness ?? 0;
  material.roughness = config.roughness ?? 1;

  if (config.emissive) {
    material.emissive = new THREE.Color(config.emissive);
    material.emissiveIntensity = config.emissiveIntensity ?? 1;
  }

  if (config.transparent !== undefined) {
    material.transparent = config.transparent;
  }

  if (config.opacity !== undefined) {
    material.opacity = config.opacity;
  }

  if (config.side !== undefined) {
    material.side = config.side;
  }

  if (config.wireframe !== undefined) {
    material.wireframe = config.wireframe;
  }

  return material;
}

/**
 * Create a WebGPU-compatible MeshBasicNodeMaterial
 */
export function createBasicNodeMaterial(config: BasicMaterialConfig): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  material.color = new THREE.Color(config.color);

  if (config.transparent !== undefined) {
    material.transparent = config.transparent;
  }

  if (config.opacity !== undefined) {
    material.opacity = config.opacity;
  }

  if (config.side !== undefined) {
    material.side = config.side;
  }

  if (config.wireframe !== undefined) {
    material.wireframe = config.wireframe;
  }

  if (config.depthWrite !== undefined) {
    material.depthWrite = config.depthWrite;
  }

  return material;
}

// Pre-configured materials for SO-101 robot arm
export const SO101_MATERIALS = {
  printed: () => createStandardNodeMaterial({
    color: '#F5F0E6',
    metalness: 0.0,
    roughness: 0.4,
  }),
  servo: () => createStandardNodeMaterial({
    color: '#1a1a1a',
    metalness: 0.2,
    roughness: 0.3,
  }),
};

// Common materials used across components
export const COMMON_MATERIALS = {
  floor: () => createStandardNodeMaterial({
    color: '#334155',
    roughness: 0.8,
    metalness: 0.2,
  }),
  shadowPlane: () => createStandardNodeMaterial({
    color: '#000000',
    transparent: true,
    opacity: 0.3,
  }),
  debugCyan: () => createBasicNodeMaterial({
    color: '#00ffff',
    transparent: true,
    opacity: 0.7,
  }),
  debugMagenta: () => createBasicNodeMaterial({
    color: '#ff00ff',
    transparent: true,
    opacity: 0.6,
  }),
};
