import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import type { JointState, SimObject, TargetZone, EnvironmentType, SensorReading, SensorVisualization, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState } from '../../types';
import { EnvironmentLayer } from './Environments';
import { PhysicsObject, TargetZonePhysics, FloorCollider } from './PhysicsObjects';
import { PhysicsArm } from './PhysicsArm';
import { SensorVisualization3DLayer } from './SensorVisualization3D';
import { WheeledRobot3D } from './WheeledRobot3D';
import { Drone3D, DEFAULT_DRONE_STATE } from './Drone3D';
import { Humanoid3D, DEFAULT_HUMANOID_STATE } from './Humanoid3D';

interface RobotArm3DProps {
  joints: JointState;
  environment?: EnvironmentType;
  objects?: SimObject[];
  targetZones?: TargetZone[];
  sensors?: SensorReading;
  sensorVisualization?: SensorVisualization;
  activeRobotType?: ActiveRobotType;
  wheeledRobot?: WheeledRobotState;
  drone?: DroneState;
  humanoid?: HumanoidState;
}

// Default wheeled robot state
const DEFAULT_WHEELED_STATE: WheeledRobotState = {
  leftWheelSpeed: 0,
  rightWheelSpeed: 0,
  position: { x: 0, y: 0, z: 0 },
  heading: 0,
  velocity: 0,
  angularVelocity: 0,
  servoHead: 0,
};

// Base workspace grid and floor
const WorkspaceGrid: React.FC<{ size?: number }> = ({ size = 0.5 }) => {
  return (
    <group>
      {/* Visible floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[2, 2]} />
        <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* Grid overlay */}
      <gridHelper args={[size * 2, 20, '#475569', '#3b4559']} position={[0, 0, 0]} />
    </group>
  );
};

// Calculate distance between two 3D points
const distance3D = (
  a: [number, number, number],
  b: [number, number, number]
): number => {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
};

// Calculate gripper tip position using forward kinematics
const calculateGripperPosition = (joints: JointState): [number, number, number] => {
  const baseRad = (joints.base * Math.PI) / 180;
  const shoulderRad = (joints.shoulder * Math.PI) / 180;
  const elbowRad = (joints.elbow * Math.PI) / 180;
  const wristRad = (joints.wrist * Math.PI) / 180;

  const baseHeight = 0.12;
  const upperArm = 0.1;
  const forearm = 0.088;
  const wrist = 0.045;
  const gripper = 0.05;

  const angle1 = shoulderRad;
  const angle2 = angle1 + elbowRad;
  const angle3 = angle2 + wristRad;

  let x = 0;
  let y = baseHeight;
  let z = 0;

  x += upperArm * Math.sin(angle1) * Math.cos(-baseRad);
  y += upperArm * Math.cos(angle1);
  z += upperArm * Math.sin(angle1) * Math.sin(-baseRad);

  x += forearm * Math.sin(angle2) * Math.cos(-baseRad);
  y += forearm * Math.cos(angle2);
  z += forearm * Math.sin(angle2) * Math.sin(-baseRad);

  x += (wrist + gripper) * Math.sin(angle3) * Math.cos(-baseRad);
  y += (wrist + gripper) * Math.cos(angle3);
  z += (wrist + gripper) * Math.sin(angle3) * Math.sin(-baseRad);

  return [x, y, z];
};

// Get robot name based on type
const getRobotName = (type: ActiveRobotType): string => {
  switch (type) {
    case 'arm':
      return 'Hiwonder xArm 1S';
    case 'wheeled':
      return 'Differential Drive Robot';
    case 'drone':
      return 'Mini Quadcopter';
    case 'humanoid':
      return 'Berkeley Humanoid Lite';
    default:
      return 'Robot';
  }
};

// Main component with Canvas
export const RobotArm3D: React.FC<RobotArm3DProps> = ({
  joints,
  environment = 'empty',
  objects = [],
  targetZones = [],
  sensors,
  sensorVisualization,
  activeRobotType = 'arm',
  wheeledRobot = DEFAULT_WHEELED_STATE,
  drone = DEFAULT_DRONE_STATE,
  humanoid = DEFAULT_HUMANOID_STATE,
}) => {
  const defaultSensorViz: SensorVisualization = {
    showUltrasonicBeam: true,
    showIRIndicators: true,
    showDistanceLabels: true,
  };

  const [contextLost, setContextLost] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const gripperPosition = calculateGripperPosition(joints);

  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    rendererRef.current = gl;
    const canvas = gl.domElement;

    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    gl.shadowMap.type = THREE.BasicShadowMap;

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('WebGL context lost, will attempt recovery...');
      setContextLost(true);
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      setContextLost(false);
    });
  }, []);

  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    if (contextLost) {
      const timer = setTimeout(() => {
        setCanvasKey(k => k + 1);
        setContextLost(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [contextLost]);

  if (contextLost) {
    return (
      <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="text-yellow-400 mb-2">WebGL Context Lost</div>
          <div className="text-slate-400 text-sm">Recovering...</div>
        </div>
      </div>
    );
  }

  // Camera position based on robot type
  const getCameraPosition = (): [number, number, number] => {
    switch (activeRobotType) {
      case 'arm':
        return [0.3, 0.25, 0.3];
      case 'wheeled':
        return [0.4, 0.3, 0.4];
      case 'drone':
        return [0.5, 0.4, 0.5];
      case 'humanoid':
        return [0.8, 0.6, 0.8];
      default:
        return [0.3, 0.25, 0.3];
    }
  };

  const getCameraTarget = (): [number, number, number] => {
    switch (activeRobotType) {
      case 'arm':
        return [0, 0.15, 0];
      case 'wheeled':
        return [wheeledRobot.position.x, 0.05, wheeledRobot.position.z];
      case 'drone':
        return [drone.position.x, drone.position.y, drone.position.z];
      case 'humanoid':
        return [0, 0.4, 0];
      default:
        return [0, 0.15, 0];
    }
  };

  return (
    <div ref={canvasContainerRef} className="w-full h-full rounded-lg overflow-hidden">
      <Canvas
        key={canvasKey}
        shadows="basic"
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        }}
        onCreated={handleCreated}
      >
        <color attach="background" args={['#1e293b']} />
        <fog attach="fog" args={['#1e293b', 0.8, 2.5]} />

        <PerspectiveCamera makeDefault position={getCameraPosition()} fov={50} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.2}
          maxDistance={2}
          target={getCameraTarget()}
        />

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[512, 512]}
        />
        <directionalLight position={[-3, 5, -3]} intensity={0.4} />
        <directionalLight position={[0, 5, 5]} intensity={0.3} />
        <hemisphereLight args={['#94a3b8', '#475569', 0.5]} />

        <Physics gravity={[0, -9.81, 0]} timeStep={1/60}>
          <FloorCollider />

          {/* Render the appropriate robot based on type */}
          {activeRobotType === 'arm' && (
            <PhysicsArm joints={joints} />
          )}

          {activeRobotType === 'wheeled' && (
            <WheeledRobot3D state={wheeledRobot} />
          )}

          {activeRobotType === 'drone' && (
            <Drone3D state={drone} />
          )}

          {activeRobotType === 'humanoid' && (
            <Humanoid3D state={humanoid} />
          )}

          {/* Physics-enabled objects (only for arm) */}
          {activeRobotType === 'arm' && objects.map((obj) => {
            const isNearGripper = obj.isGrabbable && !obj.isGrabbed
              ? distance3D(gripperPosition, obj.position) < 0.1
              : false;
            return (
              <PhysicsObject
                key={obj.id}
                object={obj}
                isNearGripper={isNearGripper}
              />
            );
          })}

          {/* Target zones */}
          {targetZones.map((zone) => (
            <TargetZonePhysics key={zone.id} zone={zone} />
          ))}
        </Physics>

        <WorkspaceGrid size={activeRobotType === 'drone' ? 1 : 0.5} />
        <EnvironmentLayer environmentId={environment} />

        {/* Sensor visualization (for arm) */}
        {activeRobotType === 'arm' && sensors && (
          <SensorVisualization3DLayer
            sensors={sensors}
            visualization={sensorVisualization || defaultSensorViz}
            joints={joints}
          />
        )}
      </Canvas>

      {/* Overlay info */}
      <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
        <div className="text-sm font-bold text-white">{getRobotName(activeRobotType)}</div>
        <div className="text-xs text-slate-400">3D Simulation • Drag to rotate</div>
      </div>

      {/* Robot-specific overlays */}
      {activeRobotType === 'arm' && (
        <>
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-1">Joint Positions</div>
            <div className="text-xs font-mono text-slate-300">
              Base: {joints.base.toFixed(0)}° | Shoulder: {joints.shoulder.toFixed(0)}°
            </div>
            <div className="text-xs font-mono text-slate-300">
              Elbow: {joints.elbow.toFixed(0)}° | Wrist: {joints.wrist.toFixed(0)}°
            </div>
          </div>
          <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400">Gripper</div>
            <div className="text-lg font-bold text-orange-500">{joints.gripper.toFixed(0)}%</div>
          </div>
        </>
      )}

      {activeRobotType === 'wheeled' && (
        <>
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-1">Motor Speeds</div>
            <div className="text-xs font-mono text-slate-300">
              Left: {wheeledRobot.leftWheelSpeed} | Right: {wheeledRobot.rightWheelSpeed}
            </div>
            <div className="text-xs font-mono text-slate-300">
              Heading: {wheeledRobot.heading.toFixed(0)}°
            </div>
          </div>
          <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400">Servo</div>
            <div className="text-lg font-bold text-green-500">{wheeledRobot.servoHead.toFixed(0)}°</div>
          </div>
        </>
      )}

      {activeRobotType === 'drone' && (
        <>
          <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-1">Flight Data</div>
            <div className="text-xs font-mono text-slate-300">
              Alt: {(drone.position.y * 100).toFixed(0)}cm | Mode: {drone.flightMode}
            </div>
            <div className="text-xs font-mono text-slate-300">
              Roll: {drone.rotation.x.toFixed(0)}° | Pitch: {drone.rotation.z.toFixed(0)}°
            </div>
          </div>
          <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
            <div className="text-xs text-slate-400">Status</div>
            <div className={`text-lg font-bold ${drone.armed ? 'text-green-500' : 'text-red-500'}`}>
              {drone.armed ? 'ARMED' : 'DISARMED'}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
