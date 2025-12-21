/**
 * WebGPU JSX Type Declarations
 * Extends React Three Fiber's JSX types to include WebGPU node materials
 */

import * as THREE from 'three/webgpu';
import { Object3DNode, MaterialNode } from '@react-three/fiber';

// Extend R3F's ThreeElements to include WebGPU node materials
declare module '@react-three/fiber' {
  interface ThreeElements {
    meshStandardNodeMaterial: MaterialNode<THREE.MeshStandardNodeMaterial, typeof THREE.MeshStandardNodeMaterial>;
    meshBasicNodeMaterial: MaterialNode<THREE.MeshBasicNodeMaterial, typeof THREE.MeshBasicNodeMaterial>;
    meshPhysicalNodeMaterial: MaterialNode<THREE.MeshPhysicalNodeMaterial, typeof THREE.MeshPhysicalNodeMaterial>;
  }
}

export {};
