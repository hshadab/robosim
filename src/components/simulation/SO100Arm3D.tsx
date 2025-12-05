/**
 * SO-101 Robot Arm 3D Model
 * Based on STL analysis and reference images
 * STL files are in METERS
 */

import React, { useMemo, Suspense } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three-stdlib';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import * as THREE from 'three';
import type { JointState } from '../../types';

interface SO100ArmProps {
  joints: JointState;
}

const STL_PATH = '/models/so101';

const MAT = {
  printed: { color: '#F5F0E6', metalness: 0.0, roughness: 0.4 },
  servo: { color: '#1a1a1a', metalness: 0.2, roughness: 0.3 },
};

const STLMesh: React.FC<{
  file: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  material?: typeof MAT.printed;
}> = ({ file, position = [0, 0, 0], rotation = [0, 0, 0], material = MAT.printed }) => {
  const geometry = useLoader(STLLoader, `${STL_PATH}/${file}`);

  const processedGeometry = useMemo(() => {
    const geo = geometry.clone();
    geo.computeVertexNormals();
    return geo;
  }, [geometry]);

  return (
    <mesh
      geometry={processedGeometry}
      position={position}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial {...material} />
    </mesh>
  );
};

const LoadingFallback: React.FC = () => (
  <mesh position={[0, 0.15, 0]}>
    <boxGeometry args={[0.05, 0.3, 0.05]} />
    <meshStandardMaterial color="gray" wireframe />
  </mesh>
);

const SO100Arm3DInner: React.FC<SO100ArmProps> = ({ joints }) => {
  // Convert degrees to radians
  const baseRot = (joints.base * Math.PI) / 180;
  const shoulderRot = (joints.shoulder * Math.PI) / 180;
  const elbowRot = (joints.elbow * Math.PI) / 180;
  const wristRot = (joints.wrist * Math.PI) / 180;
  const gripperOpen = (joints.gripper / 100) * 0.5;

  return (
    <group>
      {/* ========== FIXED BASE ========== */}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.036, 0.055]} position={[0, 0.036, 0]} />

        {/* Base plate - sits on ground */}
        <STLMesh
          file="base_so101_v2.stl"
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Motor holder tower */}
        <STLMesh
          file="base_motor_holder_so101_v1.stl"
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />

        {/* Base servo - inside the tower */}
        <STLMesh
          file="sts3215_03a_v1.stl"
          position={[0, 0.025, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={MAT.servo}
        />
      </RigidBody>

      {/* ========== SHOULDER PAN (base rotation) ========== */}
      {/* Sits directly on top of base - height matches base tower */}
      <group position={[0, 0.065, 0]} rotation={[0, baseRot, 0]}>

        {/* Shoulder bracket - centered on base, not offset */}
        <STLMesh
          file="rotation_pitch_so101_v1.stl"
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
        />

        {/* Motor holder at shoulder */}
        <STLMesh
          file="motor_holder_so101_base_v1.stl"
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
        />

        {/* Shoulder servo - horizontal */}
        <STLMesh
          file="sts3215_03a_v1.stl"
          position={[0, 0.025, 0.020]}
          rotation={[Math.PI / 2, 0, 0]}
          material={MAT.servo}
        />

        {/* ========== SHOULDER LIFT ========== */}
        <group position={[0, 0.025, 0.030]} rotation={[shoulderRot, 0, 0]}>

          {/* Upper arm - "pants" shape */}
          <STLMesh
            file="upper_arm_so101_v1.stl"
            position={[0, 0, 0.065]}
            rotation={[Math.PI, 0, -Math.PI / 2]}
          />

          {/* Elbow servo */}
          <STLMesh
            file="sts3215_03a_v1.stl"
            position={[0, 0, 0.120]}
            rotation={[Math.PI / 2, 0, 0]}
            material={MAT.servo}
          />

          {/* ========== ELBOW FLEX ========== */}
          <group position={[0, 0, 0.125]} rotation={[elbowRot, 0, 0]}>

            {/* Forearm */}
            <STLMesh
              file="under_arm_so101_v1.stl"
              position={[0, 0, 0.055]}
              rotation={[Math.PI, 0, -Math.PI / 2]}
            />

            {/* Wrist motor holder */}
            <STLMesh
              file="motor_holder_so101_wrist_v1.stl"
              position={[0, 0, 0.095]}
              rotation={[Math.PI, 0, -Math.PI / 2]}
            />

            {/* Wrist servo */}
            <STLMesh
              file="sts3215_03a_v1.stl"
              position={[0, 0, 0.110]}
              rotation={[Math.PI / 2, 0, 0]}
              material={MAT.servo}
            />

            {/* ========== WRIST FLEX ========== */}
            <group position={[0, 0, 0.115]} rotation={[wristRot, 0, 0]}>

              {/* Wrist roll/pitch bracket */}
              <STLMesh
                file="wrist_roll_pitch_so101_v2.stl"
                position={[0, 0, 0.025]}
                rotation={[0, 0, 0]}
              />

              {/* Wrist roll servo */}
              <STLMesh
                file="sts3215_03a_no_horn_v1.stl"
                position={[0, 0.025, 0.040]}
                rotation={[0, 0, 0]}
                material={MAT.servo}
              />

              {/* ========== GRIPPER ASSEMBLY ========== */}
              <group position={[0, 0.020, 0.060]}>

                {/* Gripper follower */}
                <STLMesh
                  file="wrist_roll_follower_so101_v1.stl"
                  position={[0, 0, 0.012]}
                  rotation={[0, 0, 0]}
                />

                {/* Gripper servo */}
                <STLMesh
                  file="sts3215_03a_v1.stl"
                  position={[0, 0.015, 0.025]}
                  rotation={[0, 0, 0]}
                  material={MAT.servo}
                />

                {/* Moving jaw */}
                <group position={[0, 0.025, 0.045]} rotation={[-gripperOpen, 0, 0]}>
                  <STLMesh
                    file="moving_jaw_so101_v1.stl"
                    position={[0, 0, 0.020]}
                    rotation={[0, 0, 0]}
                  />
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

export const SO100Arm3D: React.FC<SO100ArmProps> = ({ joints }) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SO100Arm3DInner joints={joints} />
    </Suspense>
  );
};
