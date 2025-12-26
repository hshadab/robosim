/**
 * Object Library for Robot Manipulation
 *
 * Common household objects for training data generation.
 * Based on YCB Object Set categories commonly used in robotics research.
 */

import type { SimObject } from '../types';

export interface ObjectTemplate {
  id: string;
  name: string;
  category: 'container' | 'food' | 'tool' | 'toy' | 'kitchen' | 'office' | 'lerobot';
  description: string;
  type: SimObject['type'];
  scale: number;
  color: string;
  // For compound objects or GLB
  modelUrl?: string;
  // Suggested physics properties
  mass?: number;
  friction?: number;
  restitution?: number;
}

/**
 * Built-in object templates using primitive shapes
 * Simplified to essential training objects only
 */
export const PRIMITIVE_OBJECTS: ObjectTemplate[] = [
  // ===========================================
  // LEROBOT TRAINING CUBES - Core training objects
  // 2.5cm cubes match SO-101 training datasets
  // ===========================================
  {
    id: 'lerobot-cube-red',
    name: 'Red Cube',
    category: 'lerobot',
    description: '2.5cm - ideal for training',
    type: 'cube',
    scale: 0.025,
    color: '#e74c3c',
    mass: 0.03,
    friction: 0.8,
  },
  {
    id: 'lerobot-cube-blue',
    name: 'Blue Cube',
    category: 'lerobot',
    description: '2.5cm - ideal for training',
    type: 'cube',
    scale: 0.025,
    color: '#3498db',
    mass: 0.03,
    friction: 0.8,
  },
  {
    id: 'lerobot-cube-green',
    name: 'Green Cube',
    category: 'lerobot',
    description: '2.5cm - ideal for training',
    type: 'cube',
    scale: 0.025,
    color: '#2ecc71',
    mass: 0.03,
    friction: 0.8,
  },
  {
    id: 'lerobot-cube-yellow',
    name: 'Yellow Cube',
    category: 'lerobot',
    description: '2.5cm - ideal for training',
    type: 'cube',
    scale: 0.025,
    color: '#f1c40f',
    mass: 0.03,
    friction: 0.8,
  },
  {
    id: 'lerobot-cube-purple',
    name: 'Purple Cube',
    category: 'lerobot',
    description: '3cm - good for stacking',
    type: 'cube',
    scale: 0.03,
    color: '#9b59b6',
    mass: 0.04,
    friction: 0.9,
  },
  {
    id: 'lerobot-cube-orange',
    name: 'Orange Cube',
    category: 'lerobot',
    description: '2.5cm - ideal for training',
    type: 'cube',
    scale: 0.025,
    color: '#e67e22',
    mass: 0.03,
    friction: 0.8,
  },
];

/**
 * All available objects (simplified - just training cubes)
 */
export const ALL_OBJECTS: ObjectTemplate[] = [...PRIMITIVE_OBJECTS];

/**
 * Get objects by category
 */
export function getObjectsByCategory(category: ObjectTemplate['category']): ObjectTemplate[] {
  return ALL_OBJECTS.filter(obj => obj.category === category);
}

/**
 * Get object by ID
 */
export function getObjectById(id: string): ObjectTemplate | undefined {
  return ALL_OBJECTS.find(obj => obj.id === id);
}

/**
 * Create a SimObject from a template
 */
export function createSimObjectFromTemplate(
  template: ObjectTemplate,
  position: [number, number, number] = [0.15, 0.02, 0],
  rotation: [number, number, number] = [0, 0, 0]
): SimObject {
  return {
    id: `${template.id}-${Date.now()}`,
    name: template.name,
    type: template.type,
    position,
    rotation,
    scale: template.scale,
    color: template.color,
    isGrabbable: true,
    isGrabbed: false,
    isInTargetZone: false,
    modelUrl: template.modelUrl,
  };
}

/**
 * Preset scene configurations for common tasks
 */
export interface ScenePreset {
  id: string;
  name: string;
  description: string;
  objects: {
    templateId: string;
    position: [number, number, number];
    rotation?: [number, number, number];
  }[];
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: 'single-cube',
    name: 'Single Cube',
    description: 'One cube for basic pick training',
    objects: [
      { templateId: 'lerobot-cube-red', position: [0.16, 0.0125, 0.01] },
    ],
  },
  {
    id: 'two-cubes',
    name: 'Two Cubes',
    description: 'Two cubes for varied training',
    objects: [
      { templateId: 'lerobot-cube-red', position: [0.14, 0.0125, 0.02] },
      { templateId: 'lerobot-cube-blue', position: [0.18, 0.0125, -0.01] },
    ],
  },
  {
    id: 'color-set',
    name: 'Color Set',
    description: 'Four colored cubes',
    objects: [
      { templateId: 'lerobot-cube-red', position: [0.14, 0.0125, 0.02] },
      { templateId: 'lerobot-cube-blue', position: [0.16, 0.0125, -0.02] },
      { templateId: 'lerobot-cube-green', position: [0.18, 0.0125, 0.01] },
      { templateId: 'lerobot-cube-yellow', position: [0.15, 0.0125, 0.00] },
    ],
  },
];

/**
 * Create SimObjects from a scene preset
 */
export function createSceneFromPreset(presetId: string): SimObject[] {
  const preset = SCENE_PRESETS.find(p => p.id === presetId);
  if (!preset) return [];

  return preset.objects.map(objConfig => {
    const template = getObjectById(objConfig.templateId);
    if (!template) return null;
    return createSimObjectFromTemplate(
      template,
      objConfig.position,
      objConfig.rotation || [0, 0, 0]
    );
  }).filter((obj): obj is SimObject => obj !== null);
}

/**
 * Categories with display names (simplified)
 */
export const OBJECT_CATEGORIES = [
  { id: 'lerobot', name: 'Training Cubes', icon: '🎯' },
] as const;
