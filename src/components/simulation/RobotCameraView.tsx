/**
 * Robot Camera View
 * Picture-in-picture camera from robot's perspective
 */

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState, RobotCameraConfig } from '../../types';

// Calculate camera position and look direction based on joint state
const calculateCameraTransform = (
  joints: JointState,
  position: RobotCameraConfig['position']
): { position: THREE.Vector3; lookAt: THREE.Vector3; up: THREE.Vector3 } => {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  // Segment lengths
  const baseHeight = 0.12;
  const upperArm = 0.1;
  const forearm = 0.088;
  const wrist = 0.045;

  // Cumulative angles
  const angle1 = shoulderRad;
  const angle2 = angle1 + elbowRad;
  const angle3 = angle2 + wristRad;

  if (position === 'base') {
    // Camera at base looking outward
    return {
      position: new THREE.Vector3(0, baseHeight + 0.02, 0),
      lookAt: new THREE.Vector3(
        Math.sin(-baseRad) * 0.5,
        baseHeight,
        Math.cos(-baseRad) * 0.5
      ),
      up: new THREE.Vector3(0, 1, 0),
    };
  }

  if (position === 'overhead') {
    // Bird's eye view
    return {
      position: new THREE.Vector3(0, 0.5, 0),
      lookAt: new THREE.Vector3(0, 0, 0),
      up: new THREE.Vector3(0, 0, -1),
    };
  }

  // Default: gripper camera
  // Calculate wrist position
  let x = upperArm * Math.sin(angle1) * Math.cos(-baseRad);
  let y = baseHeight + upperArm * Math.cos(angle1);
  let z = upperArm * Math.sin(angle1) * Math.sin(-baseRad);

  x += forearm * Math.sin(angle2) * Math.cos(-baseRad);
  y += forearm * Math.cos(angle2);
  z += forearm * Math.sin(angle2) * Math.sin(-baseRad);

  const camPos = new THREE.Vector3(
    x + wrist * 0.5 * Math.sin(angle3) * Math.cos(-baseRad),
    y + wrist * 0.5 * Math.cos(angle3),
    z + wrist * 0.5 * Math.sin(angle3) * Math.sin(-baseRad)
  );

  // Look direction along the arm
  const lookDir = new THREE.Vector3(
    Math.sin(angle3) * Math.cos(-baseRad),
    Math.cos(angle3),
    Math.sin(angle3) * Math.sin(-baseRad)
  );

  const lookAt = camPos.clone().add(lookDir.multiplyScalar(0.5));

  // Up vector perpendicular to arm direction
  const up = new THREE.Vector3(
    -Math.cos(angle3) * Math.cos(-baseRad),
    Math.sin(angle3),
    -Math.cos(angle3) * Math.sin(-baseRad)
  ).normalize();

  return { position: camPos, lookAt, up };
};

interface RobotCameraProps {
  config?: Partial<RobotCameraConfig>;
}

// Internal camera that renders to FBO
const RobotCameraInternal: React.FC<{
  config: RobotCameraConfig;
  target: THREE.WebGLRenderTarget;
}> = ({ config, target }) => {
  const { scene, gl } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const joints = useAppStore((state) => state.joints);

  useFrame(() => {
    if (!cameraRef.current) return;

    const { position, lookAt, up } = calculateCameraTransform(joints, config.position);

    cameraRef.current.position.copy(position);
    cameraRef.current.up.copy(up);
    cameraRef.current.lookAt(lookAt);
    cameraRef.current.updateMatrixWorld();

    // Render to FBO
    gl.setRenderTarget(target);
    gl.render(scene, cameraRef.current);
    gl.setRenderTarget(null);
  });

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={config.fov}
      aspect={config.resolution[0] / config.resolution[1]}
      near={config.nearClip}
      far={config.farClip}
    />
  );
};

// Render target quad (for displaying in scene if needed)
export const RobotCameraDisplay: React.FC<{
  texture: THREE.Texture;
  position?: [number, number, number];
  size?: [number, number];
}> = ({ texture, position = [0, 0.5, -0.3], size = [0.2, 0.15] }) => {
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

// Main component - use inside Canvas
export const RobotCamera: React.FC<RobotCameraProps> = ({ config = {} }) => {
  const fullConfig: RobotCameraConfig = {
    enabled: true,
    resolution: [320, 240],
    fov: 60,
    nearClip: 0.01,
    farClip: 2,
    position: 'gripper',
    ...config,
  };

  // Create render target
  const target = useFBO(fullConfig.resolution[0], fullConfig.resolution[1], {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
  });

  if (!fullConfig.enabled) return null;

  return (
    <>
      <RobotCameraInternal config={fullConfig} target={target} />
    </>
  );
};

// Overlay component for displaying camera feed outside Canvas
interface RobotCameraOverlayProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'small' | 'medium' | 'large';
  cameraPosition?: RobotCameraConfig['position'];
  onClose?: () => void;
}

export const RobotCameraOverlay: React.FC<RobotCameraOverlayProps> = ({
  position = 'bottom-right',
  size = 'medium',
  cameraPosition = 'gripper',
  onClose,
}) => {
  const joints = useAppStore((state) => state.joints);

  const sizeClasses = {
    small: 'w-32 h-24',
    medium: 'w-48 h-36',
    large: 'w-64 h-48',
  };

  const positionClasses = {
    'top-left': 'top-14 left-3',
    'top-right': 'top-14 right-3',
    'bottom-left': 'bottom-14 left-3',
    'bottom-right': 'bottom-14 right-3',
  };

  // Calculate view direction for display (for future use in HUD overlay)
  const _cameraTransform = calculateCameraTransform(joints, cameraPosition);
  void _cameraTransform;

  return (
    <div
      className={`absolute ${positionClasses[position]} ${sizeClasses[size]}
                  bg-slate-900/90 rounded-lg border border-slate-600 overflow-hidden shadow-xl`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-medium text-slate-300 uppercase">
            {cameraPosition} cam
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs"
          >
            x
          </button>
        )}
      </div>

      {/* Camera view placeholder - actual rendering happens in Canvas */}
      <div className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {/* Simulated camera view with grid */}
        <div className="absolute inset-0 flex items-center justify-center">
          <CameraViewSimulation joints={joints} cameraPosition={cameraPosition} />
        </div>

        {/* Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-4 h-[1px] bg-green-500/50" />
          <div className="absolute w-[1px] h-4 bg-green-500/50" />
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-1 left-1 text-[8px] text-green-400 font-mono">
          FOV: 60° | {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

// Simulated camera view visualization
const CameraViewSimulation: React.FC<{
  joints: JointState;
  cameraPosition: RobotCameraConfig['position'];
}> = ({ joints, cameraPosition }) => {
  // Create a simple 2D representation of what the camera sees
  const viewStyle = useMemo(() => {
    if (cameraPosition === 'overhead') {
      return {
        background: 'radial-gradient(circle, #1e3a5f 0%, #0f172a 100%)',
      };
    }

    if (cameraPosition === 'base') {
      const rotation = joints.base;
      return {
        background: `linear-gradient(${180 + rotation}deg, #1e3a5f 0%, #0f172a 50%, #1a1a2e 100%)`,
      };
    }

    // Gripper view - show based on arm position
    const tilt = joints.shoulder + joints.elbow + joints.wrist;
    const isLookingDown = tilt > 45;

    return {
      background: isLookingDown
        ? 'linear-gradient(180deg, #1e293b 0%, #334155 50%, #475569 100%)'
        : 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
    };
  }, [joints, cameraPosition]);

  return (
    <div className="w-full h-full" style={viewStyle}>
      {/* Horizon line for gripper cam */}
      {cameraPosition === 'gripper' && (
        <div
          className="absolute w-full h-[1px] bg-slate-600/50"
          style={{
            top: `${50 - (joints.shoulder + joints.elbow + joints.wrist) / 3}%`,
          }}
        />
      )}

      {/* Grid overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <pattern
            id="grid"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="#64748b"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
};
