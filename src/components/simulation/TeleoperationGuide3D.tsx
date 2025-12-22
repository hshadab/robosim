/**
 * Teleoperation Guide 3D Overlay
 *
 * Renders visual guides in the 3D scene to help users during teleoperation:
 * - Target position markers (ghost arm)
 * - Path arrows showing movement direction
 * - Waypoint indicators
 * - Step-by-step visual instructions
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { TaskStep, GuidanceState } from '../../lib/teleoperationGuide';

interface TeleoperationGuide3DProps {
  guidance: GuidanceState;
  gripperPosition?: [number, number, number];
  isRecording: boolean;
}

/**
 * Pulsing target marker component
 */
const TargetMarker: React.FC<{
  position: [number, number, number];
  color: string;
  size?: number;
  label?: string;
}> = ({ position, color, size = 0.03, label }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      // Pulsing animation
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.2;
      ringRef.current.scale.setScalar(scale);
    }
    if (innerRef.current) {
      // Rotation animation
      innerRef.current.rotation.y = state.clock.elapsedTime;
    }
  });

  return (
    <group position={position}>
      {/* Outer pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size * 1.5, size * 0.1, 8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner rotating marker */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[size * 0.5]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Vertical beam */}
      <mesh>
        <cylinderGeometry args={[size * 0.02, size * 0.02, 0.3, 8]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Label */}
      {label && (
        <Html position={[0, 0.1, 0]} center>
          <div className="px-2 py-0.5 bg-slate-900/80 rounded text-xs text-white whitespace-nowrap">
            {label}
          </div>
        </Html>
      )}
    </group>
  );
};

/**
 * Arrow showing movement direction
 */
const DirectionArrow: React.FC<{
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}> = ({ from, to, color }) => {
  const arrowRef = useRef<THREE.ArrowHelper>(null);

  const direction = useMemo(() => {
    const dir = new THREE.Vector3(
      to[0] - from[0],
      to[1] - from[1],
      to[2] - from[2]
    );
    const length = dir.length();
    dir.normalize();
    return { dir, length };
  }, [from, to]);

  if (direction.length < 0.01) return null;

  return (
    <group position={from}>
      <arrowHelper
        ref={arrowRef}
        args={[
          direction.dir,
          new THREE.Vector3(0, 0, 0),
          direction.length,
          color,
          direction.length * 0.2,
          direction.length * 0.1,
        ]}
      />
    </group>
  );
};

/**
 * Dashed path line between points
 */
const PathLine: React.FC<{
  points: [number, number, number][];
  color: string;
}> = ({ points, color }) => {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      dashed
      dashSize={0.02}
      gapSize={0.02}
    />
  );
};

/**
 * Ghost representation of target pose
 */
const GhostGripper: React.FC<{
  position: [number, number, number];
  isOpen: boolean;
}> = ({ position, isOpen }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Gentle floating animation
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.005;
    }
  });

  const fingerAngle = isOpen ? 0.3 : 0;

  return (
    <group ref={groupRef} position={position}>
      {/* Gripper body */}
      <mesh>
        <boxGeometry args={[0.03, 0.02, 0.02]} />
        <meshStandardMaterial
          color="#8b5cf6"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>

      {/* Left finger */}
      <mesh position={[-0.015, -0.015, 0]} rotation={[0, 0, fingerAngle]}>
        <boxGeometry args={[0.005, 0.025, 0.015]} />
        <meshStandardMaterial
          color="#8b5cf6"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>

      {/* Right finger */}
      <mesh position={[0.015, -0.015, 0]} rotation={[0, 0, -fingerAngle]}>
        <boxGeometry args={[0.005, 0.025, 0.015]} />
        <meshStandardMaterial
          color="#8b5cf6"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </group>
  );
};

/**
 * Highlight ring around object
 */
const HighlightRing: React.FC<{
  position: [number, number, number];
  radius: number;
  color: string;
}> = ({ position, radius, color }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      ringRef.current.scale.setScalar(scale);
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={[position[0], position[1] + 0.001, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[radius, radius * 0.1, 8, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
};

/**
 * Step instruction overlay in 3D space
 */
const StepInstruction3D: React.FC<{
  step: TaskStep;
  stepNumber: number;
}> = ({ step, stepNumber }) => {
  if (!step.targetPosition) return null;

  return (
    <Html
      position={[step.targetPosition[0], step.targetPosition[1] + 0.15, step.targetPosition[2]]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div className="px-3 py-2 bg-purple-900/90 border border-purple-500/50 rounded-lg shadow-lg max-w-[200px]">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-5 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-bold">
            {stepNumber}
          </span>
          <span className="text-xs text-purple-200 font-medium">Current Step</span>
        </div>
        <p className="text-xs text-white">{step.instruction}</p>
        {step.requiredGripperState && step.requiredGripperState !== 'any' && (
          <p className="text-xs text-purple-300 mt-1">
            Gripper: {step.requiredGripperState}
          </p>
        )}
      </div>
    </Html>
  );
};

/**
 * Recording indicator in 3D space
 */
const RecordingIndicator3D: React.FC = () => {
  const dotRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (dotRef.current) {
      const visible = Math.sin(state.clock.elapsedTime * 5) > 0;
      dotRef.current.visible = visible;
    }
  });

  return (
    <Html position={[0, 0.5, 0]} center style={{ pointerEvents: 'none' }}>
      <div className="flex items-center gap-2 px-2 py-1 bg-red-900/80 border border-red-500/50 rounded-full">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs text-red-200 font-medium">REC</span>
      </div>
    </Html>
  );
};

/**
 * Main Teleoperation Guide 3D Component
 */
export const TeleoperationGuide3D: React.FC<TeleoperationGuide3DProps> = ({
  guidance,
  gripperPosition,
  isRecording,
}) => {
  const { taskTemplate, currentStepIndex, isActive } = guidance;

  // Get current step
  const currentStep = taskTemplate?.steps[currentStepIndex];

  // Get all step positions for path visualization
  const stepPositions = useMemo(() => {
    if (!taskTemplate) return [];
    return taskTemplate.steps
      .filter(step => step.targetPosition)
      .map(step => step.targetPosition as [number, number, number]);
  }, [taskTemplate]);

  // Get completed step positions
  const completedPositions = useMemo(() => {
    if (!taskTemplate) return [];
    return taskTemplate.steps
      .slice(0, currentStepIndex)
      .filter(step => step.targetPosition)
      .map(step => step.targetPosition as [number, number, number]);
  }, [taskTemplate, currentStepIndex]);

  if (!isActive || !taskTemplate) {
    // Only show recording indicator when recording without guidance
    return isRecording ? <RecordingIndicator3D /> : null;
  }

  return (
    <group>
      {/* Recording indicator */}
      {isRecording && <RecordingIndicator3D />}

      {/* Path showing all steps */}
      {stepPositions.length > 1 && (
        <PathLine points={stepPositions} color="#4b5563" />
      )}

      {/* Completed step markers */}
      {completedPositions.map((pos, idx) => (
        <TargetMarker
          key={`completed-${idx}`}
          position={pos}
          color="#22c55e"
          size={0.02}
        />
      ))}

      {/* Current step visualization */}
      {currentStep && (
        <>
          {/* Target marker */}
          {currentStep.targetPosition && (
            <>
              <TargetMarker
                position={currentStep.targetPosition}
                color="#8b5cf6"
                size={0.04}
              />

              {/* Arrow from gripper to target */}
              {gripperPosition && (
                <DirectionArrow
                  from={gripperPosition}
                  to={currentStep.targetPosition}
                  color="#8b5cf6"
                />
              )}

              {/* Ghost gripper at target */}
              {currentStep.visualGuide === 'ghost' && (
                <GhostGripper
                  position={currentStep.targetPosition}
                  isOpen={currentStep.requiredGripperState === 'open'}
                />
              )}

              {/* Step instruction */}
              <StepInstruction3D
                step={currentStep}
                stepNumber={currentStepIndex + 1}
              />
            </>
          )}

          {/* Highlight for grab actions */}
          {currentStep.visualGuide === 'highlight' && gripperPosition && (
            <HighlightRing
              position={gripperPosition}
              radius={0.05}
              color="#f59e0b"
            />
          )}
        </>
      )}

      {/* Future step markers (dimmed) */}
      {taskTemplate.steps.slice(currentStepIndex + 1).map((step, idx) => (
        step.targetPosition && (
          <TargetMarker
            key={`future-${idx}`}
            position={step.targetPosition}
            color="#374151"
            size={0.02}
          />
        )
      ))}
    </group>
  );
};

export default TeleoperationGuide3D;
