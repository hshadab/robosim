/**
 * Drone 3D Component
 * Quadcopter drone with physics simulation
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox, Cylinder, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import type { DroneState, DroneConfig } from '../../types';

// Default drone configuration
const DEFAULT_CONFIG: DroneConfig = {
  armLength: 0.08,        // 8cm from center to motor
  bodySize: 0.06,         // 6cm body
  maxThrottle: 0.5,       // 50cm/s max vertical speed
  maxTilt: 30,            // 30 degree max tilt
  propellerSize: 0.04,    // 4cm propeller radius
};

// Material colors
const COLORS = {
  body: '#1f2937',        // Dark gray body
  bodyAccent: '#374151',
  arm: '#4b5563',
  motor: '#111827',
  propeller: '#6b7280',
  propellerTip: '#ef4444', // Red tips for visibility
  led: {
    armed: '#22c55e',
    disarmed: '#ef4444',
    warning: '#f59e0b',
  },
  camera: '#1e293b',
};

interface Drone3DProps {
  state: DroneState;
  config?: Partial<DroneConfig>;
  onStateChange?: (state: Partial<DroneState>) => void;
}

// Propeller component with spinning animation
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
      {/* Motor housing */}
      <Cylinder args={[0.012, 0.014, 0.02, 12]} position={[0, -0.01, 0]}>
        <meshStandardMaterial color={COLORS.motor} metalness={0.8} roughness={0.3} />
      </Cylinder>

      {/* Propeller */}
      <group ref={propRef} position={[0, 0.005, 0]}>
        {isSpinning ? (
          // Show disc when spinning fast
          <Cylinder args={[size, size, 0.002, 32]}>
            <meshStandardMaterial
              color={COLORS.propeller}
              transparent
              opacity={0.3}
            />
          </Cylinder>
        ) : (
          // Show actual blades when slow/stopped
          <>
            <RoundedBox
              args={[size * 2, 0.003, 0.015]}
              radius={0.001}
              rotation={[0, 0, 0]}
            >
              <meshStandardMaterial color={COLORS.propeller} />
            </RoundedBox>
            <RoundedBox
              args={[size * 2, 0.003, 0.015]}
              radius={0.001}
              rotation={[0, Math.PI / 2, 0]}
            >
              <meshStandardMaterial color={COLORS.propeller} />
            </RoundedBox>
            {/* Red tips */}
            <mesh position={[size - 0.005, 0, 0]}>
              <boxGeometry args={[0.01, 0.003, 0.015]} />
              <meshStandardMaterial color={COLORS.propellerTip} />
            </mesh>
            <mesh position={[-size + 0.005, 0, 0]}>
              <boxGeometry args={[0.01, 0.003, 0.015]} />
              <meshStandardMaterial color={COLORS.propellerTip} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

// Drone arm component
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
      {/* Arm */}
      <group rotation={[0, -rad, 0]}>
        <RoundedBox
          args={[length, 0.01, 0.015]}
          radius={0.003}
          position={[length / 2, 0, 0]}
        >
          <meshStandardMaterial color={COLORS.arm} metalness={0.3} roughness={0.7} />
        </RoundedBox>
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
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const bodyRef = useRef<RapierRigidBody>(null);

  // Motor angles: FL, FR, BL, BR (45, -45, 135, -135 degrees)
  const motorAngles = [45, -45, 135, -135];
  const motorClockwise = [true, false, false, true]; // Alternating for stability

  // Physics simulation
  useFrame((_, delta) => {
    if (!bodyRef.current || !state.armed) return;

    // Calculate thrust from throttle
    const baseThrust = (state.throttle / 100) * 9.81 * 1.2; // Slightly more than gravity

    // Apply tilt for movement
    const rollRad = (state.rotation.x * Math.PI) / 180;
    const pitchRad = (state.rotation.z * Math.PI) / 180;
    const yawRad = (state.rotation.y * Math.PI) / 180;

    // Calculate velocity based on tilt
    const tiltForce = 0.3;
    const vx = Math.sin(pitchRad) * tiltForce * state.throttle / 100;
    const vz = -Math.sin(rollRad) * tiltForce * state.throttle / 100;
    const vy = state.flightMode === 'land' ? -0.2 : (baseThrust - 9.81) * 0.05;

    // Apply forces
    bodyRef.current.setLinvel(
      {
        x: state.velocity.x + vx * delta * 10,
        y: Math.max(-1, Math.min(1, state.velocity.y + vy)),
        z: state.velocity.z + vz * delta * 10,
      },
      true
    );

    // Apply rotation
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rollRad, yawRad, pitchRad)
    );
    bodyRef.current.setRotation(rotation, true);

    // Update state callback
    if (onStateChange) {
      const pos = bodyRef.current.translation();
      const linvel = bodyRef.current.linvel();

      onStateChange({
        position: { x: pos.x, y: pos.y, z: pos.z },
        velocity: { x: linvel.x, y: linvel.y, z: linvel.z },
      });
    }
  });

  // LED color based on state
  const ledColor = state.armed
    ? state.flightMode === 'land'
      ? COLORS.led.warning
      : COLORS.led.armed
    : COLORS.led.disarmed;

  return (
    <group>
      <RigidBody
        ref={bodyRef}
        type={state.armed ? 'kinematicVelocity' : 'fixed'}
        position={[state.position.x, state.position.y, state.position.z]}
        colliders={false}
        gravityScale={state.armed ? 0.5 : 0}
      >
        <CuboidCollider args={[config.armLength, 0.02, config.armLength]} />

        <group>
          {/* Central body */}
          <RoundedBox args={[config.bodySize, 0.025, config.bodySize]} radius={0.008}>
            <meshStandardMaterial color={COLORS.body} metalness={0.4} roughness={0.6} />
          </RoundedBox>

          {/* Top cover */}
          <RoundedBox
            args={[config.bodySize * 0.7, 0.015, config.bodySize * 0.7]}
            radius={0.005}
            position={[0, 0.02, 0]}
          >
            <meshStandardMaterial color={COLORS.bodyAccent} metalness={0.3} roughness={0.7} />
          </RoundedBox>

          {/* Battery */}
          <RoundedBox
            args={[config.bodySize * 0.5, 0.012, config.bodySize * 0.3]}
            radius={0.003}
            position={[0, -0.018, 0]}
          >
            <meshStandardMaterial color="#1e40af" metalness={0.2} roughness={0.8} />
          </RoundedBox>

          {/* Camera/gimbal at front */}
          <group position={[config.bodySize / 2 - 0.01, -0.01, 0]}>
            <Sphere args={[0.012, 12, 12]}>
              <meshStandardMaterial color={COLORS.camera} metalness={0.5} roughness={0.4} />
            </Sphere>
            <Cylinder
              args={[0.006, 0.008, 0.01, 12]}
              position={[0.008, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </Cylinder>
          </group>

          {/* Status LEDs */}
          <mesh position={[0, 0.03, config.bodySize / 2 - 0.01]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshStandardMaterial
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={state.armed ? 0.8 : 0.3}
            />
          </mesh>
          <mesh position={[0, 0.03, -config.bodySize / 2 + 0.01]}>
            <sphereGeometry args={[0.005, 8, 8]} />
            <meshStandardMaterial
              color={ledColor}
              emissive={ledColor}
              emissiveIntensity={state.armed ? 0.8 : 0.3}
            />
          </mesh>

          {/* Arms and motors */}
          {motorAngles.map((angle, i) => (
            <DroneArm
              key={i}
              angle={angle}
              length={config.armLength}
              motorRPM={state.motorsRPM[i]}
              propellerSize={config.propellerSize}
              clockwise={motorClockwise[i]}
            />
          ))}

          {/* Landing gear */}
          {[
            [config.armLength * 0.7, 0, config.armLength * 0.7],
            [config.armLength * 0.7, 0, -config.armLength * 0.7],
            [-config.armLength * 0.7, 0, config.armLength * 0.7],
            [-config.armLength * 0.7, 0, -config.armLength * 0.7],
          ].map((pos, i) => (
            <group key={i} position={pos as [number, number, number]}>
              <Cylinder args={[0.003, 0.003, 0.03, 8]} position={[0, -0.025, 0]}>
                <meshStandardMaterial color={COLORS.arm} />
              </Cylinder>
              <Sphere args={[0.005, 8, 8]} position={[0, -0.04, 0]}>
                <meshStandardMaterial color={COLORS.body} />
              </Sphere>
            </group>
          ))}
        </group>
      </RigidBody>

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

export { DEFAULT_CONFIG as DRONE_CONFIG };

// Default drone state
export const DEFAULT_DRONE_STATE: DroneState = {
  position: { x: 0, y: 0.05, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  throttle: 0,
  armed: false,
  flightMode: 'stabilize',
  motorsRPM: [0, 0, 0, 0],
};
