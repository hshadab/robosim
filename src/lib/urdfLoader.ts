/**
 * Enhanced URDF Loader using urdf-loader from NASA JPL
 * Provides Three.js integration for loading and manipulating URDF robot models
 */

import URDFLoader, { type URDFRobot, type URDFJoint, type URDFLink } from 'urdf-loader';
import * as THREE from 'three/webgpu';

export type { URDFRobot, URDFJoint, URDFLink };

export interface LoadedRobot {
  robot: URDFRobot;
  scene: THREE.Object3D;
  joints: Map<string, URDFJoint>;
  links: Map<string, URDFLink>;
}

export interface URDFLoaderOptions {
  /** Base path for resolving mesh file references */
  meshPath?: string;
  /** Custom fetch function for loading resources */
  fetchOptions?: RequestInit;
  /** Scale factor for the robot model */
  scale?: number;
  /** Callback when loading progress updates */
  onProgress?: (progress: number) => void;
}

/**
 * Load a URDF robot from a URL
 */
export async function loadURDF(
  urdfUrl: string,
  options: URDFLoaderOptions = {}
): Promise<LoadedRobot> {
  const loader = new URDFLoader();

  // Set up package path resolver for mesh files
  const meshPath = options.meshPath || urdfUrl.substring(0, urdfUrl.lastIndexOf('/') + 1);

  loader.packages = (targetPkg: string) => {
    // Handle package:// URLs commonly used in ROS
    if (targetPkg.startsWith('package://')) {
      return meshPath + targetPkg.replace('package://', '');
    }
    return meshPath + targetPkg;
  };

  return new Promise((resolve, reject) => {
    loader.load(
      urdfUrl,
      (robot: URDFRobot) => {
        // Apply scale if specified
        if (options.scale && options.scale !== 1) {
          robot.scale.setScalar(options.scale);
        }

        // Build joint and link maps for easy access
        const joints = new Map<string, URDFJoint>();
        const links = new Map<string, URDFLink>();

        robot.traverse((child) => {
          if ((child as URDFJoint).isURDFJoint) {
            const joint = child as URDFJoint;
            joints.set(joint.name, joint);
          }
          if ((child as URDFLink).isURDFLink) {
            const link = child as URDFLink;
            links.set(link.name, link);
          }
        });

        resolve({
          robot,
          scene: robot,
          joints,
          links,
        });
      },
      (progress: ProgressEvent) => {
        if (options.onProgress && progress.total > 0) {
          options.onProgress(progress.loaded / progress.total);
        }
      },
      (error: Error) => {
        reject(error);
      }
    );
  });
}

/**
 * Load a URDF robot from a string
 */
export function loadURDFFromString(
  urdfContent: string,
  options: URDFLoaderOptions = {}
): LoadedRobot {
  const loader = new URDFLoader();
  const meshPath = options.meshPath || '';

  loader.packages = (targetPkg: string) => {
    if (targetPkg.startsWith('package://')) {
      return meshPath + targetPkg.replace('package://', '');
    }
    return meshPath + targetPkg;
  };

  const robot = loader.parse(urdfContent);

  // Apply scale if specified
  if (options.scale && options.scale !== 1) {
    robot.scale.setScalar(options.scale);
  }

  // Build joint and link maps
  const joints = new Map<string, URDFJoint>();
  const links = new Map<string, URDFLink>();

  robot.traverse((child) => {
    if ((child as URDFJoint).isURDFJoint) {
      const joint = child as URDFJoint;
      joints.set(joint.name, joint);
    }
    if ((child as URDFLink).isURDFLink) {
      const link = child as URDFLink;
      links.set(link.name, link);
    }
  });

  return {
    robot,
    scene: robot,
    joints,
    links,
  };
}

/**
 * Set joint angle for a loaded robot
 */
export function setJointAngle(
  robot: LoadedRobot,
  jointName: string,
  angle: number
): boolean {
  const joint = robot.joints.get(jointName);
  if (!joint) {
    console.warn(`Joint "${jointName}" not found`);
    return false;
  }

  // URDFJoint.setJointValue handles clamping to limits
  joint.setJointValue(angle);
  return true;
}

/**
 * Set multiple joint angles at once
 */
export function setJointAngles(
  robot: LoadedRobot,
  angles: Record<string, number>
): void {
  for (const [jointName, angle] of Object.entries(angles)) {
    setJointAngle(robot, jointName, angle);
  }
}

/**
 * Get all joint angles from a robot
 */
export function getJointAngles(robot: LoadedRobot): Record<string, number> {
  const angles: Record<string, number> = {};

  for (const [name, joint] of robot.joints) {
    if (joint.jointType !== 'fixed') {
      angles[name] = joint.angle;
    }
  }

  return angles;
}

/**
 * Get joint limits for a robot
 */
export function getJointLimits(robot: LoadedRobot): Record<string, { lower: number; upper: number }> {
  const limits: Record<string, { lower: number; upper: number }> = {};

  for (const [name, joint] of robot.joints) {
    if (joint.jointType !== 'fixed') {
      limits[name] = {
        lower: joint.limit?.lower ?? -Math.PI,
        upper: joint.limit?.upper ?? Math.PI,
      };
    }
  }

  return limits;
}

/**
 * Clone a loaded robot for multiple instances
 */
export function cloneRobot(robot: LoadedRobot): LoadedRobot {
  const clonedRobot = robot.robot.clone(true) as URDFRobot;

  // Rebuild joint and link maps for the clone
  const joints = new Map<string, URDFJoint>();
  const links = new Map<string, URDFLink>();

  clonedRobot.traverse((child) => {
    if ((child as URDFJoint).isURDFJoint) {
      const joint = child as URDFJoint;
      joints.set(joint.name, joint);
    }
    if ((child as URDFLink).isURDFLink) {
      const link = child as URDFLink;
      links.set(link.name, link);
    }
  });

  return {
    robot: clonedRobot,
    scene: clonedRobot,
    joints,
    links,
  };
}

/**
 * Apply material to all meshes in the robot
 */
export function setRobotMaterial(robot: LoadedRobot, material: THREE.Material): void {
  robot.robot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).material = material;
    }
  });
}

/**
 * Get the bounding box of the robot
 */
export function getRobotBounds(robot: LoadedRobot): THREE.Box3 {
  const box = new THREE.Box3();
  box.setFromObject(robot.robot);
  return box;
}

/**
 * Center the robot at the origin
 */
export function centerRobot(robot: LoadedRobot): void {
  const box = getRobotBounds(robot);
  const center = box.getCenter(new THREE.Vector3());
  robot.robot.position.sub(center);
}
