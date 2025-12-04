/**
 * URDF Parser
 * Parses Unified Robot Description Format (URDF) XML files
 */

import * as THREE from 'three';

// URDF Types
export interface URDFOrigin {
  xyz: [number, number, number];
  rpy: [number, number, number]; // roll, pitch, yaw
}

export interface URDFGeometry {
  type: 'box' | 'cylinder' | 'sphere' | 'mesh';
  size?: [number, number, number]; // box
  radius?: number;                 // cylinder, sphere
  length?: number;                 // cylinder
  filename?: string;               // mesh
  scale?: [number, number, number];
}

export interface URDFMaterial {
  name: string;
  color?: { rgba: [number, number, number, number] };
  texture?: string;
}

export interface URDFVisual {
  name?: string;
  origin?: URDFOrigin;
  geometry: URDFGeometry;
  material?: URDFMaterial;
}

export interface URDFCollision {
  name?: string;
  origin?: URDFOrigin;
  geometry: URDFGeometry;
}

export interface URDFInertial {
  origin?: URDFOrigin;
  mass: number;
  inertia: {
    ixx: number;
    ixy: number;
    ixz: number;
    iyy: number;
    iyz: number;
    izz: number;
  };
}

export interface URDFLink {
  name: string;
  visual?: URDFVisual[];
  collision?: URDFCollision[];
  inertial?: URDFInertial;
}

export interface URDFJointLimit {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

export interface URDFJoint {
  name: string;
  type: 'revolute' | 'continuous' | 'prismatic' | 'fixed' | 'floating' | 'planar';
  parent: string;
  child: string;
  origin?: URDFOrigin;
  axis?: [number, number, number];
  limit?: URDFJointLimit;
}

export interface URDFRobot {
  name: string;
  links: URDFLink[];
  joints: URDFJoint[];
  materials: URDFMaterial[];
}

// Parser class
export class URDFParser {
  private materials: Map<string, URDFMaterial> = new Map();

  /**
   * Parse URDF XML string into robot structure
   */
  parse(urdfString: string): URDFRobot {
    const parser = new DOMParser();
    const doc = parser.parseFromString(urdfString, 'text/xml');

    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`URDF parsing error: ${parseError.textContent}`);
    }

    const robotElement = doc.querySelector('robot');
    if (!robotElement) {
      throw new Error('No <robot> element found in URDF');
    }

    const robotName = robotElement.getAttribute('name') || 'unnamed_robot';

    // Parse materials first (they can be referenced by name)
    this.materials.clear();
    const materialElements = robotElement.querySelectorAll(':scope > material');
    materialElements.forEach((el) => {
      const material = this.parseMaterial(el);
      if (material) {
        this.materials.set(material.name, material);
      }
    });

    // Parse links
    const links: URDFLink[] = [];
    const linkElements = robotElement.querySelectorAll('link');
    linkElements.forEach((el) => {
      const link = this.parseLink(el);
      if (link) {
        links.push(link);
      }
    });

    // Parse joints
    const joints: URDFJoint[] = [];
    const jointElements = robotElement.querySelectorAll('joint');
    jointElements.forEach((el) => {
      const joint = this.parseJoint(el);
      if (joint) {
        joints.push(joint);
      }
    });

    return {
      name: robotName,
      links,
      joints,
      materials: Array.from(this.materials.values()),
    };
  }

  private parseOrigin(element: Element | null): URDFOrigin | undefined {
    if (!element) return undefined;

    const xyzStr = element.getAttribute('xyz') || '0 0 0';
    const rpyStr = element.getAttribute('rpy') || '0 0 0';

    const xyz = xyzStr.split(' ').map(Number) as [number, number, number];
    const rpy = rpyStr.split(' ').map(Number) as [number, number, number];

    return { xyz, rpy };
  }

  private parseGeometry(element: Element | null): URDFGeometry | undefined {
    if (!element) return undefined;

    const box = element.querySelector('box');
    if (box) {
      const sizeStr = box.getAttribute('size') || '1 1 1';
      const size = sizeStr.split(' ').map(Number) as [number, number, number];
      return { type: 'box', size };
    }

    const cylinder = element.querySelector('cylinder');
    if (cylinder) {
      const radius = parseFloat(cylinder.getAttribute('radius') || '0.5');
      const length = parseFloat(cylinder.getAttribute('length') || '1');
      return { type: 'cylinder', radius, length };
    }

    const sphere = element.querySelector('sphere');
    if (sphere) {
      const radius = parseFloat(sphere.getAttribute('radius') || '0.5');
      return { type: 'sphere', radius };
    }

    const mesh = element.querySelector('mesh');
    if (mesh) {
      const filename = mesh.getAttribute('filename') || '';
      const scaleStr = mesh.getAttribute('scale');
      const scale = scaleStr
        ? (scaleStr.split(' ').map(Number) as [number, number, number])
        : undefined;
      return { type: 'mesh', filename, scale };
    }

    return undefined;
  }

  private parseMaterial(element: Element | null): URDFMaterial | undefined {
    if (!element) return undefined;

    const name = element.getAttribute('name') || 'default';

    // Check if it's a reference to another material
    const childCount = element.children.length;
    if (childCount === 0 && this.materials.has(name)) {
      return this.materials.get(name);
    }

    const colorEl = element.querySelector('color');
    let color: { rgba: [number, number, number, number] } | undefined;
    if (colorEl) {
      const rgbaStr = colorEl.getAttribute('rgba') || '1 1 1 1';
      const rgba = rgbaStr.split(' ').map(Number) as [number, number, number, number];
      color = { rgba };
    }

    const textureEl = element.querySelector('texture');
    const texture = textureEl?.getAttribute('filename') ?? undefined;

    return { name, color, texture };
  }

  private parseVisual(element: Element): URDFVisual | undefined {
    const name = element.getAttribute('name');
    const origin = this.parseOrigin(element.querySelector('origin'));
    const geometry = this.parseGeometry(element.querySelector('geometry'));

    if (!geometry) return undefined;

    const materialEl = element.querySelector('material');
    const material = this.parseMaterial(materialEl);

    return { name: name || undefined, origin, geometry, material };
  }

  private parseCollision(element: Element): URDFCollision | undefined {
    const name = element.getAttribute('name');
    const origin = this.parseOrigin(element.querySelector('origin'));
    const geometry = this.parseGeometry(element.querySelector('geometry'));

    if (!geometry) return undefined;

    return { name: name || undefined, origin, geometry };
  }

  private parseInertial(element: Element | null): URDFInertial | undefined {
    if (!element) return undefined;

    const origin = this.parseOrigin(element.querySelector('origin'));
    const massEl = element.querySelector('mass');
    const mass = parseFloat(massEl?.getAttribute('value') || '1');

    const inertiaEl = element.querySelector('inertia');
    const inertia = {
      ixx: parseFloat(inertiaEl?.getAttribute('ixx') || '1'),
      ixy: parseFloat(inertiaEl?.getAttribute('ixy') || '0'),
      ixz: parseFloat(inertiaEl?.getAttribute('ixz') || '0'),
      iyy: parseFloat(inertiaEl?.getAttribute('iyy') || '1'),
      iyz: parseFloat(inertiaEl?.getAttribute('iyz') || '0'),
      izz: parseFloat(inertiaEl?.getAttribute('izz') || '1'),
    };

    return { origin, mass, inertia };
  }

  private parseLink(element: Element): URDFLink | undefined {
    const name = element.getAttribute('name');
    if (!name) return undefined;

    const visuals: URDFVisual[] = [];
    element.querySelectorAll('visual').forEach((el) => {
      const visual = this.parseVisual(el);
      if (visual) visuals.push(visual);
    });

    const collisions: URDFCollision[] = [];
    element.querySelectorAll('collision').forEach((el) => {
      const collision = this.parseCollision(el);
      if (collision) collisions.push(collision);
    });

    const inertial = this.parseInertial(element.querySelector('inertial'));

    return {
      name,
      visual: visuals.length > 0 ? visuals : undefined,
      collision: collisions.length > 0 ? collisions : undefined,
      inertial,
    };
  }

  private parseJoint(element: Element): URDFJoint | undefined {
    const name = element.getAttribute('name');
    const type = element.getAttribute('type') as URDFJoint['type'];

    if (!name || !type) return undefined;

    const parentEl = element.querySelector('parent');
    const childEl = element.querySelector('child');

    const parent = parentEl?.getAttribute('link');
    const child = childEl?.getAttribute('link');

    if (!parent || !child) return undefined;

    const origin = this.parseOrigin(element.querySelector('origin'));

    const axisEl = element.querySelector('axis');
    const axisStr = axisEl?.getAttribute('xyz');
    const axis = axisStr
      ? (axisStr.split(' ').map(Number) as [number, number, number])
      : undefined;

    const limitEl = element.querySelector('limit');
    let limit: URDFJointLimit | undefined;
    if (limitEl) {
      limit = {
        lower: parseFloat(limitEl.getAttribute('lower') || '0'),
        upper: parseFloat(limitEl.getAttribute('upper') || '0'),
        effort: parseFloat(limitEl.getAttribute('effort') || '0'),
        velocity: parseFloat(limitEl.getAttribute('velocity') || '0'),
      };
    }

    return { name, type, parent, child, origin, axis, limit };
  }
}

// Helper to convert URDF to Three.js geometry
export const urdfGeometryToThree = (geometry: URDFGeometry): THREE.BufferGeometry => {
  switch (geometry.type) {
    case 'box':
      {
        const [sx, sy, sz] = geometry.size || [1, 1, 1];
        return new THREE.BoxGeometry(sx, sy, sz);
      }

    case 'cylinder':
      return new THREE.CylinderGeometry(
        geometry.radius || 0.5,
        geometry.radius || 0.5,
        geometry.length || 1,
        32
      );

    case 'sphere':
      return new THREE.SphereGeometry(geometry.radius || 0.5, 32, 32);

    case 'mesh':
      // Return placeholder for mesh - actual loading needs async
      console.warn('Mesh geometry requires async loading:', geometry.filename);
      return new THREE.BoxGeometry(0.1, 0.1, 0.1);

    default:
      return new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
};

// Helper to convert URDF origin to Three.js transformation
export const urdfOriginToMatrix = (origin?: URDFOrigin): THREE.Matrix4 => {
  const matrix = new THREE.Matrix4();

  if (!origin) return matrix;

  const [x, y, z] = origin.xyz;
  const [roll, pitch, yaw] = origin.rpy;

  const euler = new THREE.Euler(roll, pitch, yaw, 'XYZ');
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  const position = new THREE.Vector3(x, y, z);

  matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));

  return matrix;
};

// Helper to convert URDF material to Three.js material
export const urdfMaterialToThree = (material?: URDFMaterial): THREE.MeshStandardMaterial => {
  const mat = new THREE.MeshStandardMaterial();

  if (material?.color) {
    const [r, g, b, a] = material.color.rgba;
    mat.color = new THREE.Color(r, g, b);
    mat.opacity = a;
    mat.transparent = a < 1;
  }

  mat.metalness = 0.3;
  mat.roughness = 0.7;

  return mat;
};

// Export singleton parser instance
export const urdfParser = new URDFParser();
