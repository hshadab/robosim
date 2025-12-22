/**
 * Wheeled Robot 3D Component
 * Differential drive robot with ultrasonic sensor on servo
 * PBR Materials for realistic rendering
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Cylinder } from '@react-three/drei';
import type * as THREE from 'three';
import type { WheeledRobotState, WheeledRobotConfig } from '../../types';
import { WHEELED_ROBOT_CONFIG } from './defaults';

// PBR Material property configurations (not instances - to avoid disposal issues)
const MATERIALS = {
  body: {
    color: '#2563eb',
    metalness: 0.1,
    roughness: 0.25,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.0,
  },
  bodyAccent: {
    color: '#1d4ed8',
    metalness: 0.15,
    roughness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.2,
  },
  tire: {
    color: '#1a1a1a',
    roughness: 0.95,
    metalness: 0.0,
  },
  wheelHub: {
    color: '#b0b0b0',
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.5,
  },
  sensor: {
    color: '#10b981',
    metalness: 0.7,
    roughness: 0.25,
    envMapIntensity: 1.3,
  },
  pcb: {
    color: '#065f46',
    roughness: 0.8,
    metalness: 0.1,
  },
  caster: {
    color: '#c0c0c0',
    metalness: 0.95,
    roughness: 0.1,
    envMapIntensity: 2.0,
  },
  chrome: {
    color: '#ffffff',
    metalness: 1.0,
    roughness: 0.05,
    envMapIntensity: 2.5,
  },
};

// Legacy colors for LED states (kept for dynamic colors)
const COLORS = {
  led: '#ef4444',           // Red LED
};

interface WheeledRobot3DProps {
  state: WheeledRobotState;
  config?: Partial<WheeledRobotConfig>;
  onStateChange?: (state: Partial<WheeledRobotState>) => void;
}

// Wheel component with inline PBR materials
const Wheel: React.FC<{
  position: [number, number, number];
  rotation: number;
  radius: number;
  isLeft?: boolean;
}> = ({ position, rotation, radius, isLeft = true }) => {
  const wheelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (wheelRef.current) {
      // Rotate wheel based on movement
      wheelRef.current.rotation.x += rotation * 0.1;
    }
  });

  return (
    <group position={position} rotation={[0, 0, isLeft ? Math.PI / 2 : -Math.PI / 2]}>
      <group ref={wheelRef}>
        {/* Tire - rubber material */}
        <Cylinder args={[radius, radius, 0.015, 24]} castShadow>
          <meshStandardMaterial {...MATERIALS.tire} />
        </Cylinder>
        {/* Hub - polished metal */}
        <Cylinder args={[radius * 0.4, radius * 0.4, 0.016, 16]} position={[0, 0.001, 0]} castShadow>
          <meshPhysicalMaterial {...MATERIALS.wheelHub} />
        </Cylinder>
        {/* Center cap - chrome */}
        <Cylinder args={[radius * 0.15, radius * 0.15, 0.017, 12]} position={[0, 0.002, 0]}>
          <meshPhysicalMaterial {...MATERIALS.chrome} />
        </Cylinder>
        {/* Tread pattern */}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 12) * Math.PI * 2) * radius * 0.85,
              0,
              Math.sin((i / 12) * Math.PI * 2) * radius * 0.85,
            ]}
            rotation={[Math.PI / 2, 0, (i / 12) * Math.PI * 2]}
          >
            <boxGeometry args={[0.003, 0.016, 0.006]} />
            <meshStandardMaterial {...MATERIALS.tire} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// Ultrasonic sensor on servo mount with inline PBR
const UltrasonicSensor: React.FC<{
  servoAngle: number;
  position: [number, number, number];
}> = ({ servoAngle, position }) => {
  const servoRad = (servoAngle * Math.PI) / 180;

  return (
    <group position={position}>
      {/* Servo mount */}
      <RoundedBox args={[0.02, 0.015, 0.015]} radius={0.002} castShadow>
        <meshPhysicalMaterial {...MATERIALS.bodyAccent} />
      </RoundedBox>

      {/* Rotating sensor head */}
      <group rotation={[0, servoRad, 0]} position={[0, 0.012, 0]}>
        {/* Sensor bracket */}
        <RoundedBox args={[0.025, 0.008, 0.02]} radius={0.001} castShadow>
          <meshPhysicalMaterial {...MATERIALS.body} />
        </RoundedBox>

        {/* Ultrasonic "eyes" - metallic sensor transducers */}
        <Cylinder
          args={[0.006, 0.006, 0.01, 16]}
          position={[-0.008, 0.004, 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <meshPhysicalMaterial {...MATERIALS.sensor} />
        </Cylinder>
        <Cylinder
          args={[0.006, 0.006, 0.01, 16]}
          position={[0.008, 0.004, 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <meshPhysicalMaterial {...MATERIALS.sensor} />
        </Cylinder>
        {/* Sensor mesh grilles */}
        <mesh position={[-0.008, 0.004, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.005, 16]} />
          <meshStandardMaterial color="#0d9488" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0.008, 0.004, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.005, 16]} />
          <meshStandardMaterial color="#0d9488" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
};

// Main wheeled robot component
export const WheeledRobot3D: React.FC<WheeledRobot3DProps> = ({
  state,
  config: configOverrides = {},
}) => {
  const config = { ...WHEELED_ROBOT_CONFIG, ...configOverrides };
  const groupRef = useRef<THREE.Group>(null);

  // Calculate wheel positions
  const wheelZ = config.wheelBase / 2;

  // Calculate body Y position
  const bodyY = config.bodyHeight / 2 + config.wheelRadius;

  return (
    <group
      ref={groupRef}
      position={[state.position.x, bodyY, state.position.z]}
      rotation={[0, (state.heading * Math.PI) / 180, 0]}
    >

        {/* Robot body */}
        <group>
          {/* Main chassis - glossy blue plastic */}
          <RoundedBox
            args={[config.bodyLength, config.bodyHeight, config.bodyWidth]}
            radius={0.008}
            castShadow
          >
            <meshPhysicalMaterial {...MATERIALS.body} />
          </RoundedBox>

          {/* Top cover - accent color */}
          <RoundedBox
            args={[config.bodyLength * 0.8, 0.01, config.bodyWidth * 0.8]}
            radius={0.003}
            position={[0, config.bodyHeight / 2 + 0.005, 0]}
            castShadow
          >
            <meshPhysicalMaterial {...MATERIALS.bodyAccent} />
          </RoundedBox>

          {/* PCB visible through slots */}
          <mesh position={[0, config.bodyHeight / 2 - 0.01, 0]} castShadow>
            <boxGeometry args={[config.bodyLength * 0.6, 0.002, config.bodyWidth * 0.6]} />
            <meshStandardMaterial {...MATERIALS.pcb} />
          </mesh>

          {/* Component traces on PCB */}
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[(i - 2) * 0.015, config.bodyHeight / 2 - 0.009, 0]}>
              <boxGeometry args={[0.002, 0.001, config.bodyWidth * 0.4]} />
              <meshStandardMaterial color="#b8860b" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}

          {/* Front bumper/sensor area */}
          <RoundedBox
            args={[0.02, config.bodyHeight * 0.6, config.bodyWidth * 0.9]}
            radius={0.003}
            position={[config.bodyLength / 2 - 0.01, 0, 0]}
            castShadow
          >
            <meshPhysicalMaterial {...MATERIALS.bodyAccent} />
          </RoundedBox>

          {/* Chrome trim line */}
          <mesh position={[0, config.bodyHeight / 2 + 0.011, 0]}>
            <boxGeometry args={[config.bodyLength * 0.7, 0.002, 0.003]} />
            <meshPhysicalMaterial {...MATERIALS.chrome} />
          </mesh>

          {/* Status LEDs */}
          <mesh position={[config.bodyLength / 2 - 0.02, config.bodyHeight / 2, 0.02]}>
            <sphereGeometry args={[0.004, 12, 12]} />
            <meshStandardMaterial
              color={state.leftWheelSpeed !== 0 || state.rightWheelSpeed !== 0 ? '#22c55e' : '#4b5563'}
              emissive={state.leftWheelSpeed !== 0 || state.rightWheelSpeed !== 0 ? '#22c55e' : '#000'}
              emissiveIntensity={0.8}
            />
          </mesh>
          <mesh position={[config.bodyLength / 2 - 0.02, config.bodyHeight / 2, -0.02]}>
            <sphereGeometry args={[0.004, 12, 12]} />
            <meshStandardMaterial color={COLORS.led} emissive={COLORS.led} emissiveIntensity={0.5} />
          </mesh>

          {/* Ultrasonic sensor on top */}
          <UltrasonicSensor
            servoAngle={state.servoHead}
            position={[config.bodyLength / 2 - 0.03, config.bodyHeight / 2 + 0.008, 0]}
          />

          {/* Caster wheel (back) - polished chrome ball */}
          <group position={[-config.bodyLength / 2 + 0.02, -config.bodyHeight / 2 - 0.005, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.01, 16, 16]} />
              <meshPhysicalMaterial {...MATERIALS.caster} />
            </mesh>
            {/* Caster housing */}
            <mesh position={[0, 0.008, 0]}>
              <cylinderGeometry args={[0.012, 0.015, 0.008, 16]} />
              <meshPhysicalMaterial {...MATERIALS.wheelHub} />
            </mesh>
          </group>

          {/* Battery indicator on side */}
          <mesh position={[0, 0, config.bodyWidth / 2 + 0.001]} rotation={[0, 0, 0]}>
            <planeGeometry args={[0.04, 0.015]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, config.bodyWidth / 2 + 0.002]} rotation={[0, 0, 0]}>
            <planeGeometry args={[0.035, 0.01]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
          </mesh>

          {/* Ventilation slots on sides */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.02 + i * 0.015, 0, config.bodyWidth / 2 - 0.005]}>
              <boxGeometry args={[0.008, config.bodyHeight * 0.4, 0.002]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          ))}
        </group>

        {/* Wheels with PBR (4WD layout) */}
        {[
          { x: config.bodyLength / 2 - 0.02, z: wheelZ + 0.008, left: true },
          { x: config.bodyLength / 2 - 0.02, z: -wheelZ - 0.008, left: false },
          { x: -config.bodyLength / 2 + 0.02, z: wheelZ + 0.008, left: true },
          { x: -config.bodyLength / 2 + 0.02, z: -wheelZ - 0.008, left: false },
        ].map((wheel, idx) => (
          <Wheel
            key={idx}
            position={[wheel.x, -config.bodyHeight / 2 + 0.005, wheel.z]}
            rotation={(wheel.left ? state.leftWheelSpeed : state.rightWheelSpeed) / 50}
            radius={config.wheelRadius}
            isLeft={wheel.left}
          />
        ))}
    </group>
  );
};
