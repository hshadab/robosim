import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import type { SensorReading, SensorVisualization, JointState } from '../../types';

interface UltrasonicBeamProps {
  position: [number, number, number];
  direction: [number, number, number];
  distance: number;
  maxRange: number;
  showLabel: boolean;
}

// Ultrasonic sensor cone visualization
const UltrasonicBeam: React.FC<UltrasonicBeamProps> = ({
  position,
  direction,
  distance,
  maxRange,
  showLabel,
}) => {
  const coneRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  // Normalize the distance for visualization
  const normalizedDist = Math.min(distance, maxRange) / maxRange;
  const coneLength = normalizedDist * 0.15; // Max 15cm visualization
  const coneRadius = coneLength * 0.3; // 30 degree cone angle

  // Color based on distance (green = far, yellow = medium, red = close)
  const color = useMemo(() => {
    if (distance < 10) return '#EF4444'; // Red - close
    if (distance < 20) return '#F59E0B'; // Yellow - medium
    return '#22C55E'; // Green - far
  }, [distance]);

  // Animate pulse effect
  useFrame((state) => {
    if (pulseRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      pulseRef.current.scale.set(scale, scale, scale);
    }
  });

  // Calculate rotation to point in direction
  const lookAt = new THREE.Vector3(...direction).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    lookAt
  );

  return (
    <group position={position} quaternion={quaternion}>
      {/* Main cone beam */}
      <mesh ref={coneRef} position={[0, coneLength / 2, 0]}>
        <coneGeometry args={[coneRadius, coneLength, 16, 1, true]} />
        <meshBasicNodeMaterial
          color={color}
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe outline */}
      <mesh position={[0, coneLength / 2, 0]}>
        <coneGeometry args={[coneRadius, coneLength, 8, 1, true]} />
        <meshBasicNodeMaterial
          color={color}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Detection point pulse */}
      <mesh ref={pulseRef} position={[0, coneLength, 0]}>
        <sphereGeometry args={[0.005, 8, 8]} />
        <meshBasicNodeMaterial color={color} transparent opacity={0.8} />
      </mesh>

      {/* Distance rings */}
      {[0.33, 0.66, 1.0].map((t, i) => (
        <mesh key={i} position={[0, coneLength * t, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[coneRadius * t * 0.9, coneRadius * t, 16]} />
          <meshBasicNodeMaterial color={color} transparent opacity={0.15} />
        </mesh>
      ))}

      {/* Distance indicator sphere (replaces text label) */}
      {showLabel && (
        <mesh position={[0.025, coneLength / 2, 0]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicNodeMaterial color={color} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
};

interface IRIndicatorProps {
  position: [number, number, number];
  isActive: boolean;
}

// IR sensor indicator
const IRIndicator: React.FC<IRIndicatorProps> = ({ position, isActive }) => {
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && isActive) {
      const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
      glowRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  return (
    <group position={position}>
      {/* Sensor body */}
      <mesh>
        <cylinderGeometry args={[0.006, 0.008, 0.01, 12]} />
        <meshStandardNodeMaterial
          color={isActive ? '#DC2626' : '#1F2937'}
          metalness={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Active glow */}
      {isActive && (
        <>
          <mesh ref={glowRef} position={[0, -0.008, 0]}>
            <coneGeometry args={[0.015, 0.02, 8]} />
            <meshBasicNodeMaterial
              color="#DC2626"
              transparent
              opacity={0.3}
            />
          </mesh>
          {/* Detection beam */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.003, 0.01, 0.03, 8]} />
            <meshBasicNodeMaterial
              color="#DC2626"
              transparent
              opacity={0.15}
            />
          </mesh>
        </>
      )}

      {/* Label indicator (small colored marker instead of text) */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.004, 0.002, 0.004]} />
        <meshBasicNodeMaterial color={isActive ? '#DC2626' : '#64748B'} />
      </mesh>
    </group>
  );
};

interface SensorVisualization3DProps {
  sensors: SensorReading;
  visualization: SensorVisualization;
  joints: JointState;
}

// Calculate gripper tip position based on joint angles (forward kinematics)
const calculateGripperPosition = (joints: JointState): [number, number, number] => {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Segment lengths
  const baseHeight = 0.12;
  const upperArm = 0.1;
  const forearm = 0.088;
  const wrist = 0.045;
  const gripper = 0.05;

  // Calculate cumulative angles
  const angle1 = shoulderRad;
  const angle2 = angle1 + elbowRad;
  const angle3 = angle2 + wristRad;

  // Forward kinematics
  let x = 0;
  let y = baseHeight;
  let z = 0;

  // Upper arm
  x += upperArm * Math.sin(angle1) * Math.cos(baseRad);
  y += upperArm * Math.cos(angle1);
  z += upperArm * Math.sin(angle1) * Math.sin(baseRad);

  // Forearm
  x += forearm * Math.sin(angle2) * Math.cos(baseRad);
  y += forearm * Math.cos(angle2);
  z += forearm * Math.sin(angle2) * Math.sin(baseRad);

  // Wrist + gripper
  x += (wrist + gripper) * Math.sin(angle3) * Math.cos(baseRad);
  y += (wrist + gripper) * Math.cos(angle3);
  z += (wrist + gripper) * Math.sin(angle3) * Math.sin(baseRad);

  return [x, y, -z]; // Negate z for correct orientation
};

// Main sensor visualization layer
export const SensorVisualization3DLayer: React.FC<SensorVisualization3DProps> = ({
  sensors,
  visualization,
  joints,
}) => {
  // Calculate gripper position for ultrasonic sensor
  const gripperPos = calculateGripperPosition(joints);

  // Direction the gripper is pointing (simplified - pointing along wrist angle)
  const baseRad = (joints.base * Math.PI) / 180;
  const totalAngle =
    ((joints.shoulder + joints.elbow + joints.wrist) * Math.PI) / 180;

  const direction: [number, number, number] = [
    Math.sin(totalAngle) * Math.cos(baseRad),
    Math.cos(totalAngle),
    -Math.sin(totalAngle) * Math.sin(baseRad),
  ];

  return (
    <group>
      {/* Ultrasonic sensor beam */}
      {visualization.showUltrasonicBeam && sensors.ultrasonic !== undefined && (
        <UltrasonicBeam
          position={gripperPos}
          direction={direction}
          distance={sensors.ultrasonic}
          maxRange={50}
          showLabel={visualization.showDistanceLabels}
        />
      )}

      {/* IR sensors (positioned at base for arm robot) */}
      {visualization.showIRIndicators && (
        <group position={[0, 0.005, 0]}>
          <IRIndicator
            position={[-0.04, 0, 0.05]}
            isActive={sensors.leftIR || false}
          />
          <IRIndicator
            position={[0, 0, 0.06]}
            isActive={sensors.centerIR || false}
          />
          <IRIndicator
            position={[0.04, 0, 0.05]}
            isActive={sensors.rightIR || false}
          />
        </group>
      )}
    </group>
  );
};
