/**
 * Wheeled Robot 3D Component
 * Differential drive robot with ultrasonic sensor on servo
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider, CylinderCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox, Cylinder } from '@react-three/drei';
import * as THREE from 'three';
import type { WheeledRobotState, WheeledRobotConfig } from '../../types';

// Default configuration for a small differential drive robot
const DEFAULT_CONFIG: WheeledRobotConfig = {
  wheelRadius: 0.025,       // 2.5cm radius wheels
  wheelBase: 0.1,           // 10cm between wheels
  maxSpeed: 0.3,            // 30cm/s max speed
  bodyWidth: 0.12,          // 12cm wide
  bodyLength: 0.15,         // 15cm long
  bodyHeight: 0.05,         // 5cm tall
};

// Material colors
const COLORS = {
  body: '#2563eb',          // Blue body
  bodyAccent: '#1d4ed8',
  wheel: '#1f2937',         // Dark gray wheels
  wheelHub: '#6b7280',
  sensor: '#10b981',        // Green sensor
  led: '#ef4444',           // Red LED
  pcb: '#065f46',           // PCB green
};

interface WheeledRobot3DProps {
  state: WheeledRobotState;
  config?: Partial<WheeledRobotConfig>;
  onStateChange?: (state: Partial<WheeledRobotState>) => void;
}

// Wheel component
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
        {/* Tire */}
        <Cylinder args={[radius, radius, 0.015, 24]}>
          <meshStandardMaterial color={COLORS.wheel} roughness={0.9} />
        </Cylinder>
        {/* Hub */}
        <Cylinder args={[radius * 0.4, radius * 0.4, 0.016, 16]} position={[0, 0.001, 0]}>
          <meshStandardMaterial color={COLORS.wheelHub} metalness={0.5} roughness={0.5} />
        </Cylinder>
        {/* Tread pattern */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((i / 8) * Math.PI * 2) * radius * 0.8,
              0,
              Math.sin((i / 8) * Math.PI * 2) * radius * 0.8,
            ]}
            rotation={[Math.PI / 2, 0, (i / 8) * Math.PI * 2]}
          >
            <boxGeometry args={[0.004, 0.016, 0.008]} />
            <meshStandardMaterial color={COLORS.wheelHub} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// Ultrasonic sensor on servo mount
const UltrasonicSensor: React.FC<{
  servoAngle: number;
  position: [number, number, number];
}> = ({ servoAngle, position }) => {
  const servoRad = (servoAngle * Math.PI) / 180;

  return (
    <group position={position}>
      {/* Servo mount */}
      <RoundedBox args={[0.02, 0.015, 0.015]} radius={0.002}>
        <meshStandardMaterial color={COLORS.bodyAccent} />
      </RoundedBox>

      {/* Rotating sensor head */}
      <group rotation={[0, servoRad, 0]} position={[0, 0.012, 0]}>
        {/* Sensor bracket */}
        <RoundedBox args={[0.025, 0.008, 0.02]} radius={0.001}>
          <meshStandardMaterial color={COLORS.body} />
        </RoundedBox>

        {/* Ultrasonic "eyes" */}
        <Cylinder
          args={[0.006, 0.006, 0.01, 12]}
          position={[-0.008, 0.004, 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color={COLORS.sensor} metalness={0.3} />
        </Cylinder>
        <Cylinder
          args={[0.006, 0.006, 0.01, 12]}
          position={[0.008, 0.004, 0.01]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <meshStandardMaterial color={COLORS.sensor} metalness={0.3} />
        </Cylinder>
      </group>
    </group>
  );
};

// Main wheeled robot component
export const WheeledRobot3D: React.FC<WheeledRobot3DProps> = ({
  state,
  config: configOverrides = {},
  onStateChange,
}) => {
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  const bodyRef = useRef<RapierRigidBody>(null);
  const prevState = useRef(state);

  // Calculate wheel positions
  const wheelY = config.wheelRadius;
  const wheelZ = config.wheelBase / 2;

  // Physics simulation
  useFrame((_, delta) => {
    if (!bodyRef.current) return;

    // Convert wheel speeds to linear and angular velocity
    // Differential drive kinematics
    const leftSpeed = (state.leftWheelSpeed / 255) * config.maxSpeed;
    const rightSpeed = (state.rightWheelSpeed / 255) * config.maxSpeed;

    const linearVelocity = (leftSpeed + rightSpeed) / 2;
    const angularVelocity = (rightSpeed - leftSpeed) / config.wheelBase;

    // Get current heading
    const headingRad = (state.heading * Math.PI) / 180;

    // Calculate velocity components
    const vx = linearVelocity * Math.sin(headingRad);
    const vz = linearVelocity * Math.cos(headingRad);

    // Apply velocity to physics body
    bodyRef.current.setLinvel({ x: vx, y: 0, z: vz }, true);
    bodyRef.current.setAngvel({ x: 0, y: angularVelocity, z: 0 }, true);

    // Update state if callback provided
    if (onStateChange) {
      const pos = bodyRef.current.translation();
      const rot = bodyRef.current.rotation();

      // Calculate heading from quaternion
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
      );
      const newHeading = ((euler.y * 180) / Math.PI + 360) % 360;

      onStateChange({
        position: { x: pos.x, y: pos.y, z: pos.z },
        heading: newHeading,
        velocity: linearVelocity,
        angularVelocity: (angularVelocity * 180) / Math.PI,
      });
    }

    prevState.current = state;
  });

  // Initial rotation from heading
  const initialRotation = useMemo(() => {
    return new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, (state.heading * Math.PI) / 180, 0)
    );
  }, []);

  return (
    <group>
      {/* Main body - kinematic for controlled movement */}
      <RigidBody
        ref={bodyRef}
        type="kinematicVelocity"
        position={[state.position.x, config.bodyHeight / 2 + config.wheelRadius, state.position.z]}
        rotation={[0, (state.heading * Math.PI) / 180, 0]}
        colliders={false}
      >
        <CuboidCollider
          args={[config.bodyLength / 2, config.bodyHeight / 2, config.bodyWidth / 2]}
        />

        {/* Robot body */}
        <group>
          {/* Main chassis */}
          <RoundedBox
            args={[config.bodyLength, config.bodyHeight, config.bodyWidth]}
            radius={0.008}
          >
            <meshStandardMaterial color={COLORS.body} metalness={0.2} roughness={0.6} />
          </RoundedBox>

          {/* Top cover */}
          <RoundedBox
            args={[config.bodyLength * 0.8, 0.01, config.bodyWidth * 0.8]}
            radius={0.003}
            position={[0, config.bodyHeight / 2 + 0.005, 0]}
          >
            <meshStandardMaterial color={COLORS.bodyAccent} metalness={0.3} roughness={0.5} />
          </RoundedBox>

          {/* PCB visible through slots */}
          <mesh position={[0, config.bodyHeight / 2 - 0.01, 0]}>
            <boxGeometry args={[config.bodyLength * 0.6, 0.002, config.bodyWidth * 0.6]} />
            <meshStandardMaterial color={COLORS.pcb} />
          </mesh>

          {/* Front bumper/sensor area */}
          <RoundedBox
            args={[0.02, config.bodyHeight * 0.6, config.bodyWidth * 0.9]}
            radius={0.003}
            position={[config.bodyLength / 2 - 0.01, 0, 0]}
          >
            <meshStandardMaterial color={COLORS.bodyAccent} />
          </RoundedBox>

          {/* Status LEDs */}
          <mesh position={[config.bodyLength / 2 - 0.02, config.bodyHeight / 2, 0.02]}>
            <sphereGeometry args={[0.004, 8, 8]} />
            <meshStandardMaterial
              color={state.leftWheelSpeed !== 0 || state.rightWheelSpeed !== 0 ? '#22c55e' : '#4b5563'}
              emissive={state.leftWheelSpeed !== 0 || state.rightWheelSpeed !== 0 ? '#22c55e' : '#000'}
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[config.bodyLength / 2 - 0.02, config.bodyHeight / 2, -0.02]}>
            <sphereGeometry args={[0.004, 8, 8]} />
            <meshStandardMaterial color={COLORS.led} emissive={COLORS.led} emissiveIntensity={0.3} />
          </mesh>

          {/* Ultrasonic sensor on top */}
          <UltrasonicSensor
            servoAngle={state.servoHead}
            position={[config.bodyLength / 2 - 0.03, config.bodyHeight / 2 + 0.008, 0]}
          />

          {/* Caster wheel (back) */}
          <group position={[-config.bodyLength / 2 + 0.02, -config.bodyHeight / 2 - 0.005, 0]}>
            <mesh>
              <sphereGeometry args={[0.01, 12, 12]} />
              <meshStandardMaterial color={COLORS.wheelHub} metalness={0.6} roughness={0.4} />
            </mesh>
          </group>

          {/* Battery indicator on side */}
          <mesh position={[0, 0, config.bodyWidth / 2 + 0.001]} rotation={[0, 0, 0]}>
            <planeGeometry args={[0.04, 0.015]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0, config.bodyWidth / 2 + 0.002]} rotation={[0, 0, 0]}>
            <planeGeometry args={[0.035, 0.01]} />
            <meshStandardMaterial color="#22c55e" />
          </mesh>
        </group>

        {/* Wheels */}
        <Wheel
          position={[0, -config.bodyHeight / 2 + 0.005, wheelZ + 0.008]}
          rotation={state.leftWheelSpeed / 50}
          radius={config.wheelRadius}
          isLeft={true}
        />
        <Wheel
          position={[0, -config.bodyHeight / 2 + 0.005, -wheelZ - 0.008]}
          rotation={state.rightWheelSpeed / 50}
          radius={config.wheelRadius}
          isLeft={false}
        />
      </RigidBody>
    </group>
  );
};

export { DEFAULT_CONFIG as WHEELED_ROBOT_CONFIG };
