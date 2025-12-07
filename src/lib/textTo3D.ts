/**
 * Text-to-3D Model Generation for RoboSim
 *
 * Generates 3D meshes from text descriptions using:
 * - Procedural mesh generation for basic shapes
 * - AI-powered texture generation
 * - Future: Integration with AI 3D generation APIs
 *
 * Currently implements:
 * - Parametric primitives with AI textures
 * - Compound shapes from descriptions
 * - Simple object composition
 */

import * as THREE from 'three';
import { generateObjectTexture, type AIObjectRequest } from './aiImageGeneration';
import { createLogger } from './logger';

const logger = createLogger('TextTo3D');

export interface Text3DRequest {
  description: string;
  style?: 'realistic' | 'cartoon' | 'low-poly' | 'voxel';
  scale?: number;
  generateTexture?: boolean;
}

export interface Generated3DObject {
  mesh: THREE.Mesh | THREE.Group;
  name: string;
  description: string;
  boundingBox: THREE.Box3;
  isGrabbable: boolean;
  mass: number;
}

// Object type mappings based on keywords
const OBJECT_MAPPINGS: Array<{
  keywords: string[];
  generator: (desc: string, style: string) => THREE.Mesh | THREE.Group;
  baseScale: number;
  mass: number;
  grabbable: boolean;
}> = [
  {
    keywords: ['ball', 'sphere', 'orb', 'marble'],
    generator: createSphere,
    baseScale: 0.03,
    mass: 0.1,
    grabbable: true,
  },
  {
    keywords: ['cube', 'box', 'block', 'crate'],
    generator: createBox,
    baseScale: 0.04,
    mass: 0.2,
    grabbable: true,
  },
  {
    keywords: ['cylinder', 'can', 'tube', 'pipe', 'bottle'],
    generator: createCylinder,
    baseScale: 0.03,
    mass: 0.15,
    grabbable: true,
  },
  {
    keywords: ['cone', 'pyramid', 'traffic cone'],
    generator: createCone,
    baseScale: 0.04,
    mass: 0.1,
    grabbable: true,
  },
  {
    keywords: ['ring', 'donut', 'torus'],
    generator: createTorus,
    baseScale: 0.03,
    mass: 0.05,
    grabbable: true,
  },
  {
    keywords: ['table', 'desk'],
    generator: createTable,
    baseScale: 0.15,
    mass: 5.0,
    grabbable: false,
  },
  {
    keywords: ['chair', 'stool', 'seat'],
    generator: createChair,
    baseScale: 0.1,
    mass: 2.0,
    grabbable: false,
  },
  {
    keywords: ['shelf', 'shelving', 'rack'],
    generator: createShelf,
    baseScale: 0.2,
    mass: 10.0,
    grabbable: false,
  },
  {
    keywords: ['apple', 'fruit'],
    generator: createApple,
    baseScale: 0.025,
    mass: 0.15,
    grabbable: true,
  },
  {
    keywords: ['cup', 'mug', 'glass'],
    generator: createCup,
    baseScale: 0.03,
    mass: 0.2,
    grabbable: true,
  },
];

// Color mappings
const COLOR_MAPPINGS: Record<string, number> = {
  red: 0xff4444,
  blue: 0x4444ff,
  green: 0x44ff44,
  yellow: 0xffff44,
  orange: 0xff8844,
  purple: 0x8844ff,
  pink: 0xff44aa,
  white: 0xffffff,
  black: 0x222222,
  gray: 0x888888,
  grey: 0x888888,
  brown: 0x8b4513,
  gold: 0xffd700,
  silver: 0xc0c0c0,
  wooden: 0xdeb887,
  metal: 0x888899,
  plastic: 0xeeeeee,
};

/**
 * Generate a 3D object from text description
 */
export async function generateFromText(
  request: Text3DRequest
): Promise<Generated3DObject> {
  const description = request.description.toLowerCase();
  const style = request.style || 'realistic';
  const scale = request.scale || 1.0;

  logger.info(`Generating 3D object: "${request.description}"`);

  // Find matching object type
  let generator = createBox; // default
  let baseScale = 0.04;
  let mass = 0.2;
  let grabbable = true;

  for (const mapping of OBJECT_MAPPINGS) {
    if (mapping.keywords.some(kw => description.includes(kw))) {
      generator = mapping.generator;
      baseScale = mapping.baseScale;
      mass = mapping.mass;
      grabbable = mapping.grabbable;
      break;
    }
  }

  // Create the mesh
  let mesh = generator(description, style);
  mesh.scale.multiplyScalar(scale);

  // Extract and apply color
  const color = extractColor(description);
  applyColorToMesh(mesh, color);

  // Apply style modifications
  if (style === 'low-poly') {
    mesh = applyLowPolyStyle(mesh);
  } else if (style === 'voxel') {
    // Voxel style would require geometry conversion
    logger.debug('Voxel style not fully implemented, using low-poly');
    mesh = applyLowPolyStyle(mesh);
  }

  // Generate texture if requested and API is available
  if (request.generateTexture) {
    try {
      const textureImage = await generateObjectTexture({
        type: getMeshPrimitiveType(mesh),
        description: request.description,
        style: style === 'cartoon' ? 'cartoon' : 'realistic',
      });

      // Apply texture to mesh
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(textureImage.url);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;

      mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshStandardMaterial).map = texture;
          (child.material as THREE.MeshStandardMaterial).needsUpdate = true;
        }
      });

      logger.info('Applied AI-generated texture');
    } catch (error) {
      logger.warn('Failed to generate texture, using solid color', error);
    }
  }

  // Calculate bounding box
  const boundingBox = new THREE.Box3().setFromObject(mesh);

  // Set name and user data
  mesh.name = request.description;
  mesh.userData = {
    isGrabbable: grabbable,
    mass: mass * scale * scale * scale,
    description: request.description,
    generated: true,
  };

  return {
    mesh,
    name: request.description,
    description: request.description,
    boundingBox,
    isGrabbable: grabbable,
    mass: mass * scale * scale * scale,
  };
}

/**
 * Extract color from description
 */
function extractColor(description: string): number {
  for (const [colorName, colorValue] of Object.entries(COLOR_MAPPINGS)) {
    if (description.includes(colorName)) {
      return colorValue;
    }
  }
  // Random color if none specified
  return Math.random() * 0xffffff;
}

/**
 * Apply color to mesh and all children
 */
function applyColorToMesh(mesh: THREE.Object3D, color: number): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      if (material.color) {
        material.color.setHex(color);
      }
    }
  });
}

/**
 * Get primitive type for texture generation
 */
function getMeshPrimitiveType(mesh: THREE.Object3D): AIObjectRequest['type'] {
  let type: AIObjectRequest['type'] = 'cube';

  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry;
      if (geo instanceof THREE.SphereGeometry) type = 'sphere';
      else if (geo instanceof THREE.CylinderGeometry) type = 'cylinder';
    }
  });

  return type;
}

/**
 * Apply low-poly style by reducing geometry detail
 */
function applyLowPolyStyle(mesh: THREE.Object3D): THREE.Mesh | THREE.Group {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.computeVertexNormals();
      const material = child.material as THREE.MeshStandardMaterial;
      material.flatShading = true;
      material.needsUpdate = true;
    }
  });

  return mesh as THREE.Mesh | THREE.Group;
}

// ============ Shape Generators ============

function createSphere(_desc: string, _style: string): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, 16, 16);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.4,
    metalness: 0.1,
  });
  return new THREE.Mesh(geometry, material);
}

function createBox(_desc: string, _style: string): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.0,
  });
  return new THREE.Mesh(geometry, material);
}

function createCylinder(_desc: string, _style: string): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.2,
  });
  return new THREE.Mesh(geometry, material);
}

function createCone(_desc: string, _style: string): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(0.5, 1.5, 16);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.1,
  });
  return new THREE.Mesh(geometry, material);
}

function createTorus(_desc: string, _style: string): THREE.Mesh {
  const geometry = new THREE.TorusGeometry(0.6, 0.2, 16, 32);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.4,
    metalness: 0.3,
  });
  return new THREE.Mesh(geometry, material);
}

function createApple(_desc: string, _style: string): THREE.Group {
  const group = new THREE.Group();

  // Apple body
  const bodyGeometry = new THREE.SphereGeometry(1, 16, 16);
  bodyGeometry.scale(1, 0.9, 1);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xff3333,
    roughness: 0.3,
    metalness: 0.0,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);

  // Stem
  const stemGeometry = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.8,
  });
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = 0.9;
  group.add(stem);

  // Leaf
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.2, 0.15, 0.3, 0);
  leafShape.quadraticCurveTo(0.2, -0.05, 0, 0);

  const leafGeometry = new THREE.ShapeGeometry(leafShape);
  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x228b22,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
  leaf.position.set(0.1, 1.0, 0);
  leaf.rotation.z = -0.3;
  group.add(leaf);

  return group;
}

function createCup(_desc: string, _style: string): THREE.Group {
  const group = new THREE.Group();

  // Cup body (hollow cylinder approximation using lathe)
  const points = [];
  points.push(new THREE.Vector2(0.4, 0));
  points.push(new THREE.Vector2(0.45, 0.1));
  points.push(new THREE.Vector2(0.5, 1));
  points.push(new THREE.Vector2(0.45, 1));
  points.push(new THREE.Vector2(0.4, 0.1));
  points.push(new THREE.Vector2(0.35, 0.1));

  const bodyGeometry = new THREE.LatheGeometry(points, 24);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    metalness: 0.0,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  group.add(body);

  // Handle
  const handleGeometry = new THREE.TorusGeometry(0.2, 0.04, 8, 16, Math.PI);
  const handle = new THREE.Mesh(handleGeometry, bodyMaterial);
  handle.position.set(0.6, 0.5, 0);
  handle.rotation.z = Math.PI / 2;
  group.add(handle);

  return group;
}

function createTable(_desc: string, _style: string): THREE.Group {
  const group = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xdeb887,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Table top
  const topGeometry = new THREE.BoxGeometry(2, 0.1, 1);
  const top = new THREE.Mesh(topGeometry, woodMaterial);
  top.position.y = 0.75;
  group.add(top);

  // Legs
  const legGeometry = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  const positions = [
    [-0.85, 0.35, -0.4],
    [0.85, 0.35, -0.4],
    [-0.85, 0.35, 0.4],
    [0.85, 0.35, 0.4],
  ];

  for (const [x, y, z] of positions) {
    const leg = new THREE.Mesh(legGeometry, woodMaterial);
    leg.position.set(x, y, z);
    group.add(leg);
  }

  return group;
}

function createChair(_desc: string, _style: string): THREE.Group {
  const group = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xcd853f,
    roughness: 0.7,
    metalness: 0.0,
  });

  // Seat
  const seatGeometry = new THREE.BoxGeometry(0.5, 0.05, 0.5);
  const seat = new THREE.Mesh(seatGeometry, woodMaterial);
  seat.position.y = 0.45;
  group.add(seat);

  // Back
  const backGeometry = new THREE.BoxGeometry(0.5, 0.6, 0.05);
  const back = new THREE.Mesh(backGeometry, woodMaterial);
  back.position.set(0, 0.75, -0.225);
  group.add(back);

  // Legs
  const legGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);
  const legPositions = [
    [-0.2, 0.225, -0.2],
    [0.2, 0.225, -0.2],
    [-0.2, 0.225, 0.2],
    [0.2, 0.225, 0.2],
  ];

  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeometry, woodMaterial);
    leg.position.set(x, y, z);
    group.add(leg);
  }

  return group;
}

function createShelf(_desc: string, _style: string): THREE.Group {
  const group = new THREE.Group();

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    roughness: 0.4,
    metalness: 0.7,
  });

  // Uprights
  const uprightGeometry = new THREE.BoxGeometry(0.05, 2, 0.05);
  const uprightPositions = [
    [-0.5, 1, -0.3],
    [0.5, 1, -0.3],
    [-0.5, 1, 0.3],
    [0.5, 1, 0.3],
  ];

  for (const [x, y, z] of uprightPositions) {
    const upright = new THREE.Mesh(uprightGeometry, metalMaterial);
    upright.position.set(x, y, z);
    group.add(upright);
  }

  // Shelves
  const shelfGeometry = new THREE.BoxGeometry(1.1, 0.03, 0.65);
  for (let i = 0; i < 4; i++) {
    const shelf = new THREE.Mesh(shelfGeometry, metalMaterial);
    shelf.position.set(0, 0.1 + i * 0.6, 0);
    group.add(shelf);
  }

  return group;
}

/**
 * Generate multiple objects from a scene description
 */
export async function generateScene(
  sceneDescription: string,
  options: {
    maxObjects?: number;
    areaSize?: number;
  } = {}
): Promise<Generated3DObject[]> {
  const maxObjects = options.maxObjects || 5;
  const areaSize = options.areaSize || 1;

  // Parse the description for object mentions
  const objects: string[] = [];
  const parts = sceneDescription.toLowerCase().split(/[,;.]|\band\b/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 2 && objects.length < maxObjects) {
      objects.push(trimmed);
    }
  }

  // Generate each object
  const generated: Generated3DObject[] = [];

  for (let i = 0; i < objects.length; i++) {
    try {
      const obj = await generateFromText({
        description: objects[i],
        generateTexture: false,
      });

      // Position objects in a grid pattern
      const cols = Math.ceil(Math.sqrt(objects.length));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const spacing = areaSize / cols;

      obj.mesh.position.set(
        (col - (cols - 1) / 2) * spacing,
        0,
        (row - (cols - 1) / 2) * spacing
      );

      generated.push(obj);
    } catch (error) {
      logger.error(`Failed to generate object: ${objects[i]}`, error);
    }
  }

  return generated;
}

/**
 * Dispose of generated 3D object resources
 */
export function disposeGenerated3DObject(obj: Generated3DObject): void {
  obj.mesh.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
        const stdMat = child.material as THREE.MeshStandardMaterial;
        if (stdMat.map) stdMat.map.dispose();
      }
    }
  });
}
