/**
 * SO-101 Robot Arm 3D Model
 * Uses urdf-loader library for proper URDF parsing and STL loading
 * Includes physics colliders for all arm segments
 */

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { JointState } from '../../types';
import { SO101_DIMS } from '../../config/so101Dimensions';
import { RealisticGripperPhysics } from './RealisticGripperPhysics';
import { GraspManager } from './GraspManager';
import { useAppStore } from '../../stores/useAppStore';
import { loggers } from '../../lib/logger';

const log = loggers.urdf;

interface SO101ArmProps {
  joints: JointState;
}

// Joint name mapping from our UI to URDF joint names
const JOINT_MAP = {
  base: 'shoulder_pan',
  shoulder: 'shoulder_lift',
  elbow: 'elbow_flex',
  wrist: 'wrist_flex',
  wristRoll: 'wrist_roll',
  gripper: 'gripper',
};

const LoadingFallback: React.FC = () => (
  <mesh position={[0, 0.15, 0]}>
    <boxGeometry args={[0.05, 0.3, 0.05]} />
    <meshStandardMaterial color="gray" wireframe />
  </mesh>
);

// Materials
const PRINTED_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#F5F0E6',
  metalness: 0.0,
  roughness: 0.4,
});

const SERVO_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#1a1a1a',
  metalness: 0.2,
  roughness: 0.3,
});

/**
 * Physics colliders for the arm - DISABLED
 * The arm segment colliders used simplified kinematics that didn't match the URDF robot.
 * For now, we only use gripper jaw colliders (in RealisticGripperPhysics) which read
 * positions directly from the URDF robot's world transform.
 */
const ArmPhysicsColliders: React.FC<{ joints: JointState }> = () => {
  // ARM COLLIDERS DISABLED - they used simplified FK that didn't match URDF
  // Only gripper jaw colliders are used (from RealisticGripperPhysics)
  return null;
};

const URDFRobot: React.FC<SO101ArmProps> = ({ joints }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [robot, setRobot] = useState<THREE.Object3D | null>(null);
  const robotRef = useRef<ReturnType<typeof URDFLoader.prototype.parse> | null>(null);
  const setGripperWorldPosition = useAppStore((state) => state.setGripperWorldPosition);
  const setGripperWorldQuaternion = useAppStore((state) => state.setGripperWorldQuaternion);
  const gripperWorldPosVec = useRef(new THREE.Vector3()); // Reusable vector to avoid allocations
  const gripperWorldQuat = useRef(new THREE.Quaternion()); // Reusable quaternion to avoid allocations
  const linkDebugLoggedRef = useRef(false); // Track whether we've logged link info

  useEffect(() => {
    const loader = new URDFLoader();

    // Set the path for loading meshes relative to URDF
    loader.packages = '/models/so101';

    // Custom mesh loader to handle STL loading
    loader.loadMeshCb = (path: string, manager: THREE.LoadingManager, onComplete: (obj: THREE.Object3D, err?: Error) => void) => {
      import('three-stdlib').then(({ STLLoader }) => {
        const stlLoader = new STLLoader(manager);

        stlLoader.load(
          path,
          (geometry) => {
            geometry.computeVertexNormals();

            // Determine material based on filename
            const isServo = path.includes('sts3215');
            const material = isServo ? SERVO_MATERIAL : PRINTED_MATERIAL;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            onComplete(mesh);
          },
          undefined,
          (error) => {
            console.error('Error loading STL:', path, error);
            onComplete(new THREE.Object3D(), error as unknown as Error);
          }
        );
      });
    };

    // Load the URDF
    loader.load(
      '/models/so101/so101.urdf',
      (loadedRobot) => {
        robotRef.current = loadedRobot;

        // Rotate from URDF Z-up to Three.js Y-up
        loadedRobot.rotation.x = -Math.PI / 2;

        setRobot(loadedRobot);
      },
      undefined,
      (error) => {
        console.error('Error loading URDF:', error);
      }
    );

    return () => {
      robotRef.current = null;
    };
  }, []);

  // Update joint positions
  // CRITICAL: Read directly from store to avoid React prop timing issues
  // Props only update on re-render, but useFrame runs every animation frame
  // Priority -1 ensures arm updates BEFORE GraspManager reads gripper position
  useFrame((_, delta) => {
    if (!robotRef.current) return;

    // Update motor dynamics simulation first
    // This applies velocity/acceleration limits when motor dynamics is enabled
    useAppStore.getState().updateActualJoints(delta);

    // Read actual joint values (after motor dynamics) for rendering
    const currentJoints = useAppStore.getState().actualJoints;
    const robotInstance = robotRef.current as ReturnType<typeof URDFLoader.prototype.parse>;

    // Convert degrees to radians and apply to joints
    if (robotInstance.joints[JOINT_MAP.base]) {
      robotInstance.joints[JOINT_MAP.base].setJointValue((currentJoints.base * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.shoulder]) {
      robotInstance.joints[JOINT_MAP.shoulder].setJointValue((currentJoints.shoulder * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.elbow]) {
      robotInstance.joints[JOINT_MAP.elbow].setJointValue((currentJoints.elbow * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.wrist]) {
      robotInstance.joints[JOINT_MAP.wrist].setJointValue((currentJoints.wrist * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.wristRoll]) {
      robotInstance.joints[JOINT_MAP.wristRoll].setJointValue((currentJoints.wristRoll * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.gripper]) {
      // Gripper: 0 = closed, 100 = open
      // URDF joint limits: lower=-0.174533 (-10°), upper=1.74533 (+100°)
      // Extended closed position (-0.35 rad = -20°) for tighter visual closure
      // The joint will clamp if needed, but visually shows fully closed jaws
      const minRad = -0.35; // Extended closed position for tighter visual
      const maxRad = 1.74533;   // Open position
      const gripperRad = minRad + (currentJoints.gripper / 100) * (maxRad - minRad);
      robotInstance.joints[JOINT_MAP.gripper].setJointValue(gripperRad);

      // Debug logging disabled - uncomment to debug gripper issues
      // if (currentJoints.gripper < 50) {
      //   console.log(`[URDF] Gripper: ${currentJoints.gripper.toFixed(1)}% -> ${(gripperRad * 180 / Math.PI).toFixed(1)}°`);
      // }
    }

    // Read actual gripper world position from URDF model
    // Use gripper_frame_link to match FK calculation, fall back to gripper_link
    // NOTE: moving_jaw_so101_v1_link is ~7.5cm closer to base than gripper_frame
    const links = robotInstance.links as Record<string, THREE.Object3D> | undefined;
    const gripperLink = links?.['gripper_frame_link'] || links?.['gripper_link'];

    // Debug: log link finding once
    if (!linkDebugLoggedRef.current) {
      linkDebugLoggedRef.current = true;
      log.debug('Links found:', links ? Object.keys(links) : 'none');
      log.debug('Gripper link:', gripperLink ? 'found' : 'NOT FOUND');
    }

    if (gripperLink) {
      // Force update of the world matrix hierarchy before reading position
      // This ensures the URDF rotation (-90° on X) is applied
      robotInstance.updateMatrixWorld(true);

      gripperLink.getWorldPosition(gripperWorldPosVec.current);
      gripperLink.getWorldQuaternion(gripperWorldQuat.current);

      setGripperWorldPosition([
        gripperWorldPosVec.current.x,
        gripperWorldPosVec.current.y,
        gripperWorldPosVec.current.z,
      ]);

      setGripperWorldQuaternion([
        gripperWorldQuat.current.x,
        gripperWorldQuat.current.y,
        gripperWorldQuat.current.z,
        gripperWorldQuat.current.w,
      ]);
    }
  }, -1); // Priority -1: run BEFORE GraspManager

  return (
    <group ref={groupRef}>
      {/* Fixed base with collider */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[SO101_DIMS.baseHeight / 2, SO101_DIMS.baseRadius]} position={[0, SO101_DIMS.baseHeight / 2, 0]} />
        <CuboidCollider args={[0.04, SO101_DIMS.link1Height / 2, 0.04]} position={[0, SO101_DIMS.baseHeight + SO101_DIMS.link1Height / 2, 0]} />
      </RigidBody>

      {/* Visual URDF model */}
      {robot && <primitive object={robot} />}

      {/* Kinematic physics colliders for arm segments */}
      <ArmPhysicsColliders joints={joints} />

      {/* Realistic gripper jaw physics - dynamic colliders that move with gripper value */}
      <RealisticGripperPhysics joints={joints} />

      {/* Grasp manager - handles object attachment when gripper closes */}
      <GraspManager />

      {/* Debug visualization removed - was distracting */}
    </group>
  );
};

export const SO101Arm3D: React.FC<SO101ArmProps> = ({ joints }) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <URDFRobot joints={joints} />
    </Suspense>
  );
};
