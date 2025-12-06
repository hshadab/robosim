/**
 * SO-101 Robot Arm 3D Model
 * Uses urdf-loader library for proper URDF parsing and STL loading
 */

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type { JointState } from '../../types';

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

const URDFRobot: React.FC<SO101ArmProps> = ({ joints }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [robot, setRobot] = useState<THREE.Object3D | null>(null);
  const robotRef = useRef<ReturnType<typeof URDFLoader.prototype.parse> | null>(null);

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
      // Gripper: 0-100 maps to joint limits
      const gripperRad = (joints.gripper / 100) * 1.74533;
      robotInstance.joints[JOINT_MAP.gripper].setJointValue(gripperRad);
    }
  });

  return (
    <group ref={groupRef}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.06, 0.04, 0.06]} position={[0, 0.04, 0]} />
        {robot && <primitive object={robot} />}
      </RigidBody>
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
