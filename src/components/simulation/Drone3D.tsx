/**
 * Drone 3D Component
 * Quadcopter drone with physics simulation
 * PBR Materials for realistic rendering
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Cylinder, Sphere } from '@react-three/drei';
import type * as THREE from 'three';
import type { DroneState, DroneConfig } from '../../types';
import { DRONE_CONFIG } from './defaults';

// PBR Material property configurations (not instances - to avoid disposal issues)
const MATERIALS = {
  carbonFiber: {
    color: '#1a1a1a',
    metalness: 0.3,
    roughness: 0.4,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.0,
  },
  bodyAccent: {
    color: '#2d2d2d',
    metalness: 0.2,
    roughness: 0.6,
    envMapIntensity: 0.8,
  },
  arm: {
    color: '#252525',
    metalness: 0.25,
    roughness: 0.45,
    clearcoat: 0.5,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.9,
  },
  motor: {
    color: '#0a0a0a',
    metalness: 0.9,
    roughness: 0.2,
    envMapIntensity: 1.5,
  },
  motorBell: {
    color: '#c0c0c0',
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 2.0,
  },
  propeller: {
    color: '#4a4a4a',
    metalness: 0.0,
    roughness: 0.3,
  },
  battery: {
    color: '#1e40af',
    metalness: 0.1,
    roughness: 0.6,
    clearcoat: 0.3,
    envMapIntensity: 0.8,
  },
  cameraLens: {
    color: '#0a0a0a',
    metalness: 0.8,
    roughness: 0.05,
    envMapIntensity: 2.5,
  },
  cameraBody: {
    color: '#1e293b',
    metalness: 0.5,
    roughness: 0.4,
    envMapIntensity: 1.2,
  },
  landingGear: {
    color: '#2d2d2d',
    roughness: 0.9,
    metalness: 0.0,
  },
};

// LED colors (kept for dynamic states)
const COLORS = {
  led: {
    armed: '#22c55e',
    disarmed: '#ef4444',
    warning: '#f59e0b',
  },
  propellerTip: '#ef4444',
};

interface Drone3DProps {
  state: DroneState;
  config?: Partial<DroneConfig>;
  onStateChange?: (state: Partial<DroneState>) => void;
}

// Propeller component with spinning animation and inline PBR materials
const Propeller: React.FC<{
  position: [number, number, number];
  rpm: number;
  size: number;
  clockwise?: boolean;
}> = ({ position, rpm, size, clockwise = true }) => {
  const propRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (propRef.current && rpm > 0) {
      // Spin based on RPM (simplified animation)
      const rotationSpeed = (rpm / 1000) * Math.PI * 2 * (clockwise ? 1 : -1);
      propRef.current.rotation.y += rotationSpeed * delta * 60;
    }
  });

  const isSpinning = rpm > 100;

  return (
    <group position={position}>
      {/* Motor base - dark metallic */}
      <Cylinder args={[0.012, 0.014, 0.012, 16]} position={[0, -0.016, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIALS.motor} />
      </Cylinder>
      {/* Motor bell - silver aluminum */}
      <Cylinder args={[0.011, 0.012, 0.01, 16]} position={[0, -0.005, 0]} castShadow>
        <meshPhysicalMaterial {...MATERIALS.motorBell} />
      </Cylinder>
      {/* Motor coil detail */}
      <Cylinder args={[0.008, 0.008, 0.004, 12]} position={[0, -0.018, 0]}>
        <meshStandardMaterial color="#8b4513" metalness={0.7} roughness={0.4} />
      </Cylinder>

      {/* Propeller */}
      <group ref={propRef} position={[0, 0.005, 0]}>
        {isSpinning ? (
          // Show disc when spinning fast - motion blur effect
          <Cylinder args={[size, size, 0.002, 32]}>
            <meshStandardMaterial
              color="#505050"
              transparent
              opacity={0.25}
            />
          </Cylinder>
        ) : (
          // Show actual blades when slow/stopped
          <>
            <RoundedBox
              args={[size * 2, 0.003, 0.015]}
              radius={0.001}
              rotation={[0, 0, 0]}
              castShadow
            >
              <meshPhysicalMaterial {...MATERIALS.propeller} />
            </RoundedBox>
            <RoundedBox
              args={[size * 2, 0.003, 0.015]}
              radius={0.001}
              rotation={[0, Math.PI / 2, 0]}
              castShadow
            >
              <meshPhysicalMaterial {...MATERIALS.propeller} />
            </RoundedBox>
            {/* Red tips for visibility */}
            <mesh position={[size - 0.005, 0, 0]}>
              <boxGeometry args={[0.01, 0.003, 0.015]} />
              <meshStandardMaterial color={COLORS.propellerTip} emissive={COLORS.propellerTip} emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[-size + 0.005, 0, 0]}>
              <boxGeometry args={[0.01, 0.003, 0.015]} />
              <meshStandardMaterial color={COLORS.propellerTip} emissive={COLORS.propellerTip} emissiveIntensity={0.3} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

// Drone arm component with inline PBR
const DroneArm: React.FC<{
  angle: number;
  length: number;
  motorRPM: number;
  propellerSize: number;
  clockwise: boolean;
}> = ({ angle, length, motorRPM, propellerSize, clockwise }) => {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * length;
  const z = Math.sin(rad) * length;

  return (
    <group>
      {/* Carbon fiber arm */}
      <group rotation={[0, -rad, 0]}>
        <RoundedBox
          args={[length, 0.01, 0.015]}
          radius={0.003}
          position={[length / 2, 0, 0]}
          castShadow
        >
          <meshPhysicalMaterial {...MATERIALS.arm} />
        </RoundedBox>
        {/* Arm reinforcement stripe */}
        <mesh position={[length / 2, 0.006, 0]}>
          <boxGeometry args={[length * 0.8, 0.002, 0.008]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>

      {/* Motor and propeller at end */}
      <Propeller
        position={[x, 0.015, z]}
        rpm={motorRPM}
        size={propellerSize}
        clockwise={clockwise}
      />
    </group>
  );
};

// Main drone component
export const Drone3D: React.FC<Drone3DProps> = ({
  state,
  config: configOverrides = {},
  onStateChange,
}) => {
  const config = { ...DRONE_CONFIG, ...configOverrides };
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: state.position.x, y: state.position.y, z: state.position.z });

  // Motor angles: FL, FR, BL, BR (45, -45, 135, -135 degrees)
  const motorAngles = [45, -45, 135, -135];
  const motorClockwise = [true, false, false, true]; // Alternating for stability

  // Convert rotation to radians for visual display
  const rollRad = (state.rotation.x * Math.PI) / 180;
  const pitchRad = (state.rotation.z * Math.PI) / 180;
  const yawRad = (state.rotation.y * Math.PI) / 180;

  // Calculate motor RPMs based on throttle (used for propeller animation)
  const baseRPM = state.armed ? (state.throttle / 100) * 8000 : 0;
  const motorsRPM: [number, number, number, number] = state.armed
    ? [baseRPM, baseRPM, baseRPM, baseRPM]
    : [0, 0, 0, 0];

  // Update position based on controls
  useFrame(() => {
    const minHeight = 0.05;

    if (!state.armed) {
      // When not armed, stay on ground
      if (posRef.current.y !== minHeight) {
        posRef.current.y = minHeight;
        if (onStateChange) {
          onStateChange({ position: { ...posRef.current }, motorsRPM: [0, 0, 0, 0] });
        }
      }
      return;
    }

    // Calculate vertical speed based on throttle (0-100)
    // throttle 50 = hover, >50 = rise, <50 = descend
    const throttleNormalized = (state.throttle - 50) / 50; // -1 to 1
    const verticalSpeed = throttleNormalized * 0.005; // Speed per frame

    // Calculate horizontal movement from tilt
    const tiltForce = 0.002;
    const vx = Math.sin(pitchRad) * tiltForce * (state.throttle / 50);
    const vz = -Math.sin(rollRad) * tiltForce * (state.throttle / 50);

    // Landing mode - descend slowly
    const vy = state.flightMode === 'land' ? -0.003 : verticalSpeed;

    // Update position
    let newY = posRef.current.y + vy;
    if (newY < minHeight) newY = minHeight;
    if (newY > 2) newY = 2; // Max height

    const newX = posRef.current.x + vx;
    const newZ = posRef.current.z + vz;

    // Only update if changed
    if (newX !== posRef.current.x || newY !== posRef.current.y || newZ !== posRef.current.z) {
      posRef.current = { x: newX, y: newY, z: newZ };
      if (onStateChange) {
        onStateChange({ position: { x: newX, y: newY, z: newZ } });
      }
    }

    // Update group position directly for smooth rendering
    if (groupRef.current) {
      groupRef.current.position.set(newX, newY, newZ);
    }
  });

  // LED color based on state
  const ledColor = state.armed
    ? state.flightMode === 'land'
      ? COLORS.led.warning
      : COLORS.led.armed
    : COLORS.led.disarmed;

  return (
    <group
      ref={groupRef}
      position={[state.position.x, state.position.y, state.position.z]}
      rotation={[rollRad, yawRad, pitchRad]}
    >
        <group>
          {/* Central body - carbon fiber */}
          <RoundedBox args={[config.bodySize, 0.025, config.bodySize]} radius={0.008} castShadow>
            <meshPhysicalMaterial {...MATERIALS.carbonFiber} />
          </RoundedBox>

          {/* Top cover - accent panel */}
          <RoundedBox
            args={[config.bodySize * 0.7, 0.015, config.bodySize * 0.7]}
            radius={0.005}
            position={[0, 0.02, 0]}
            castShadow
          >
            <meshPhysicalMaterial {...MATERIALS.bodyAccent} />
          </RoundedBox>

          {/* Flight controller board detail */}
          <mesh position={[0, 0.028, 0]}>
            <boxGeometry args={[config.bodySize * 0.4, 0.003, config.bodySize * 0.4]} />
            <meshStandardMaterial color="#1a472a" roughness={0.7} metalness={0.1} />
          </mesh>

          {/* Battery - LiPo with PBR */}
          <RoundedBox
            args={[config.bodySize * 0.5, 0.012, config.bodySize * 0.3]}
            radius={0.003}
            position={[0, -0.018, 0]}
            castShadow
          >
            <meshPhysicalMaterial {...MATERIALS.battery} />
          </RoundedBox>
          {/* Battery warning label */}
          <mesh position={[0, -0.011, 0]}>
            <planeGeometry args={[config.bodySize * 0.3, 0.008]} />
            <meshStandardMaterial color="#fbbf24" />
          </mesh>

          {/* Camera/gimbal at front */}
          <group position={[config.bodySize / 2 - 0.01, -0.01, 0]}>
            <Sphere args={[0.012, 16, 16]} castShadow>
              <meshPhysicalMaterial {...MATERIALS.cameraBody} />
            </Sphere>
            <Cylinder
              args={[0.006, 0.008, 0.01, 16]}
              position={[0.008, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <meshPhysicalMaterial {...MATERIALS.cameraLens} />
            </Cylinder>
            {/* Lens glass */}
            <mesh position={[0.014, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <circleGeometry args={[0.005, 16]} />
              <meshPhysicalMaterial color="#0a0a0a" metalness={0.9} roughness={0.0} envMapIntensity={3} />
            </mesh>
          </group>

          {/* Status LEDs */}
          <mesh position={[0, 0.03, config.bodySize / 2 - 0.01]}>
            <sphereGeometry args={[0.005, 12, 12]} />
            <meshStandardMaterial
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={state.armed ? 1.0 : 0.4}
            />
          </mesh>
          <mesh position={[0, 0.03, -config.bodySize / 2 + 0.01]}>
            <sphereGeometry args={[0.005, 12, 12]} />
            <meshStandardMaterial
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={state.armed ? 1.0 : 0.4}
            />
          </mesh>

          {/* Arms and motors with PBR */}
          {motorAngles.map((angle, i) => (
            <DroneArm
              key={i}
              angle={angle}
              length={config.armLength}
              motorRPM={motorsRPM[i]}
              propellerSize={config.propellerSize}
              clockwise={motorClockwise[i]}
            />
          ))}

          {/* Landing gear with rubber feet */}
          {[
            [config.armLength * 0.7, 0, config.armLength * 0.7],
            [config.armLength * 0.7, 0, -config.armLength * 0.7],
            [-config.armLength * 0.7, 0, config.armLength * 0.7],
            [-config.armLength * 0.7, 0, -config.armLength * 0.7],
          ].map((pos, i) => (
            <group key={i} position={pos as [number, number, number]}>
              {/* Carbon fiber leg */}
              <Cylinder args={[0.003, 0.003, 0.03, 8]} position={[0, -0.025, 0]} castShadow>
                <meshPhysicalMaterial {...MATERIALS.arm} />
              </Cylinder>
              {/* Rubber foot */}
              <Sphere args={[0.006, 12, 12]} position={[0, -0.04, 0]}>
                <meshStandardMaterial {...MATERIALS.landingGear} />
              </Sphere>
            </group>
          ))}
        </group>

      {/* Shadow/ground indicator when flying */}
      {state.armed && state.position.y > 0.1 && (
        <mesh
          position={[state.position.x, 0.001, state.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.08, 32]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={Math.max(0.1, 0.4 - state.position.y * 0.3)}
          />
        </mesh>
      )}
    </group>
  );
};
