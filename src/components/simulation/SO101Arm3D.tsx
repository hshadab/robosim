/**
 * SO-101 Robot Arm 3D Model
 * Uses urdf-loader library for proper URDF parsing and STL loading
 * Includes physics colliders for all arm segments
 */

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import type { RapierRigidBody } from '@react-three/rapier';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import type { JointState } from '../../types';
import { SO101_DIMS, calculateJointPositions } from './SO101Kinematics';
import { RealisticGripperPhysics } from './RealisticGripperPhysics';
import { useAppStore } from '../../stores/useAppStore';

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
 * Physics colliders that follow the arm's kinematic chain
 * These are kinematic bodies that update position based on joint angles
 */
const ArmPhysicsColliders: React.FC<{ joints: JointState }> = ({ joints }) => {
  const upperArmRef = useRef<RapierRigidBody>(null);
  const forearmRef = useRef<RapierRigidBody>(null);
  const wristRef = useRef<RapierRigidBody>(null);

  useFrame(() => {
    const positions = calculateJointPositions(joints);

    // Convert degrees to radians for rotation calculations
    const shoulderPanRad = (joints.base * Math.PI) / 180;
    const shoulderLiftRad = (joints.shoulder * Math.PI) / 180;
    const elbowFlexRad = (joints.elbow * Math.PI) / 180;
    const wristFlexRad = (joints.wrist * Math.PI) / 180;

    // Upper arm: between shoulder and elbow
    if (upperArmRef.current) {
      const midPoint = {
        x: (positions.shoulder[0] + positions.elbow[0]) / 2,
        y: (positions.shoulder[1] + positions.elbow[1]) / 2,
        z: (positions.shoulder[2] + positions.elbow[2]) / 2,
      };
      upperArmRef.current.setNextKinematicTranslation(midPoint);

      // Calculate rotation quaternion for upper arm
      const q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(
        0,
        -shoulderPanRad,
        -shoulderLiftRad,
        'YXZ'
      ));
      upperArmRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    // Forearm: between elbow and wrist
    if (forearmRef.current) {
      const midPoint = {
        x: (positions.elbow[0] + positions.wrist[0]) / 2,
        y: (positions.elbow[1] + positions.wrist[1]) / 2,
        z: (positions.elbow[2] + positions.wrist[2]) / 2,
      };
      forearmRef.current.setNextKinematicTranslation(midPoint);

      const q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(
        0,
        -shoulderPanRad,
        -(shoulderLiftRad + elbowFlexRad),
        'YXZ'
      ));
      forearmRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    // Wrist: between wrist joint and gripper
    if (wristRef.current) {
      const midPoint = {
        x: (positions.wrist[0] + positions.gripper[0]) / 2,
        y: (positions.wrist[1] + positions.gripper[1]) / 2,
        z: (positions.wrist[2] + positions.gripper[2]) / 2,
      };
      wristRef.current.setNextKinematicTranslation(midPoint);

      const q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(
        0,
        -shoulderPanRad,
        -(shoulderLiftRad + elbowFlexRad + wristFlexRad),
        'YXZ'
      ));
      wristRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    // Note: Gripper jaw colliders are now handled by RealisticGripperPhysics component
  });

  const dims = SO101_DIMS;

  return (
    <>
      {/* Upper arm collider */}
      <RigidBody
        ref={upperArmRef}
        type="kinematicPosition"
        colliders={false}
      >
        <CuboidCollider args={[0.025, dims.link3Length / 2, 0.025]} />
      </RigidBody>

      {/* Forearm collider */}
      <RigidBody
        ref={forearmRef}
        type="kinematicPosition"
        colliders={false}
      >
        <CuboidCollider args={[0.02, dims.link4Length / 2, 0.02]} />
      </RigidBody>

      {/* Wrist collider */}
      <RigidBody
        ref={wristRef}
        type="kinematicPosition"
        colliders={false}
      >
        <CuboidCollider args={[0.015, (dims.link5Length + dims.gripperLength) / 2, 0.015]} />
      </RigidBody>

      {/* Gripper jaw colliders are now handled by RealisticGripperPhysics */}
    </>
  );
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
  useFrame(() => {
    if (!robotRef.current) return;

    const robotInstance = robotRef.current as ReturnType<typeof URDFLoader.prototype.parse>;

    // Convert degrees to radians and apply to joints
    if (robotInstance.joints[JOINT_MAP.base]) {
      robotInstance.joints[JOINT_MAP.base].setJointValue((joints.base * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.shoulder]) {
      robotInstance.joints[JOINT_MAP.shoulder].setJointValue((joints.shoulder * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.elbow]) {
      robotInstance.joints[JOINT_MAP.elbow].setJointValue((joints.elbow * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.wrist]) {
      robotInstance.joints[JOINT_MAP.wrist].setJointValue((joints.wrist * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.wristRoll]) {
      robotInstance.joints[JOINT_MAP.wristRoll].setJointValue((joints.wristRoll * Math.PI) / 180);
    }
    if (robotInstance.joints[JOINT_MAP.gripper]) {
      // Gripper: 0 = closed, 100 = open
      // URDF joint limits: lower=-0.174533 (-10°), upper=1.74533 (+100°)
      // When closed (gripper=0), jaw should be at minimum angle (most closed)
      // When open (gripper=100), jaw should be at maximum angle (most open)
      // Map: 0 -> -0.174533 (closed), 100 -> 1.74533 (open)
      const minRad = -0.174533; // Closed position
      const maxRad = 1.74533;   // Open position
      const gripperRad = minRad + (joints.gripper / 100) * (maxRad - minRad);
      robotInstance.joints[JOINT_MAP.gripper].setJointValue(gripperRad);
    }

    // Read actual gripper world position from URDF model
    // gripper_frame_link is a dummy link at the gripper tip
    const links = robotInstance.links as Record<string, THREE.Object3D> | undefined;
    const gripperLink = links?.['gripper_frame_link'] || links?.['gripper_link'];

    // Debug: log link finding once
    if (!linkDebugLoggedRef.current) {
      linkDebugLoggedRef.current = true;
      console.log('[SO101Arm3D] Links found:', links ? Object.keys(links) : 'none');
      console.log('[SO101Arm3D] Gripper link:', gripperLink ? 'found' : 'NOT FOUND');
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
  });

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
