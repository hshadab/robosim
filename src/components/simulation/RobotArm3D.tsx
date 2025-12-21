import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Canvas, useLoader, extend } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
} from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three/webgpu';
import { WebGPURenderer } from 'three/webgpu';

// Extend R3F with WebGPU module classes
extend({
  MeshStandardNodeMaterial: THREE.MeshStandardNodeMaterial,
  MeshBasicNodeMaterial: THREE.MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial: THREE.MeshPhysicalNodeMaterial,
});
import type { JointState, SimObject, TargetZone, EnvironmentType, SensorReading, SensorVisualization, ActiveRobotType, WheeledRobotState, DroneState, HumanoidState } from '../../types';
import { EnvironmentLayer } from './Environments';
import { PhysicsObject, TargetZonePhysics, FloorCollider } from './PhysicsObjects';
import { SO101Arm3D } from './SO101Arm3D';
import { calculateSO101GripperPosition } from './SO101Kinematics';
import { SensorVisualization3DLayer } from './SensorVisualization3D';
import { WheeledRobot3D } from './WheeledRobot3D';
import { Drone3D } from './Drone3D';
import { Humanoid3D } from './Humanoid3D';
import { DEFAULT_DRONE_STATE, DEFAULT_HUMANOID_STATE } from './defaults';
import { ClickToMove, WorkspaceVisualization } from './ClickToMove';
import type { AIGeneratedObject } from '../../lib/aiImageGeneration';

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
  onDroneStateChange?: (state: Partial<DroneState>) => void;
  // Advanced controls
  clickToMoveEnabled?: boolean;
  showWorkspace?: boolean;
  onJointsChange?: (joints: JointState) => void;
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

// Floor with AI texture - separate component to ensure hooks are always called
const TexturedFloor: React.FC<{ textureUrl: string }> = ({ textureUrl }) => {
  const baseTexture = useLoader(THREE.TextureLoader, textureUrl);

  // Clone and configure texture for tiling
  const texture = useMemo(() => {
    const cloned = baseTexture.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(4, 4);
    cloned.needsUpdate = true;
    return cloned;
  }, [baseTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
      <planeGeometry args={[2, 2]} />
      <meshStandardNodeMaterial map={texture} roughness={0.8} metalness={0.2} />
    </mesh>
  );
};

// Base workspace grid and floor with optional AI texture
const WorkspaceGrid: React.FC<{ size?: number; textureUrl?: string | null }> = ({ size = 0.5, textureUrl }) => {
  return (
    <group>
      {/* Visible floor plane */}
      {textureUrl ? (
        <TexturedFloor textureUrl={textureUrl} />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[2, 2]} />
          <meshStandardNodeMaterial color="#334155" roughness={0.8} metalness={0.2} />
        </mesh>
      )}
      {/* Grid overlay - hidden when texture is applied */}
      {!textureUrl && (
        <gridHelper args={[size * 2, 20, '#475569', '#3b4559']} position={[0, 0, 0]} />
      )}
    </group>
  );
};

// AI-generated background component using a skybox sphere
const AIBackground: React.FC<{ imageUrl: string }> = ({ imageUrl }) => {
  const texture = useLoader(THREE.TextureLoader, imageUrl);

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 32, 32]} />
      <meshBasicNodeMaterial map={texture} side={THREE.BackSide} />
    </mesh>
  );
};

// AI-generated object component with physics
const AIObject3D: React.FC<{ aiObject: AIGeneratedObject }> = ({ aiObject }) => {
  const texture = useLoader(THREE.TextureLoader, aiObject.texture.url);

  const getGeometry = () => {
    switch (aiObject.type) {
      case 'sphere':
        return <sphereGeometry args={[aiObject.size.x / 2, 32, 32]} />;
      case 'cylinder':
        return <cylinderGeometry args={[aiObject.size.x / 2, aiObject.size.x / 2, aiObject.size.y, 32]} />;
      case 'cube':
      default:
        return <boxGeometry args={[aiObject.size.x, aiObject.size.y, aiObject.size.z]} />;
    }
  };

  return (
    <mesh
      position={[aiObject.position.x, aiObject.position.y, aiObject.position.z]}
      castShadow
      receiveShadow
    >
      {getGeometry()}
      <meshStandardNodeMaterial map={texture} roughness={0.6} metalness={0.1} />
    </mesh>
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

// Use SO-101 forward kinematics for gripper position
const calculateGripperPosition = calculateSO101GripperPosition;

// Get robot name based on type
const getRobotName = (type: ActiveRobotType): string => {
  switch (type) {
    case 'arm':
      return 'SO-101 Robot Arm';
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
  onDroneStateChange,
  clickToMoveEnabled = false,
  showWorkspace = false,
  onJointsChange,
}) => {
  // Disable sensor visualizations by default to reduce distraction
  const defaultSensorViz: SensorVisualization = {
    showUltrasonicBeam: false,
    showIRIndicators: false,
    showDistanceLabels: false,
  };

  const [contextLost, setContextLost] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);

  // AI-generated content state
  const [aiBackgroundUrl, setAiBackgroundUrl] = useState<string | null>(null);
  const [aiFloorTextureUrl, setAiFloorTextureUrl] = useState<string | null>(null);
  const [aiObjects, setAiObjects] = useState<AIGeneratedObject[]>([]);

  // Listen for AI content events
  useEffect(() => {
    const handleBackgroundApplied = (event: CustomEvent<{ url: string }>) => {
      setAiBackgroundUrl(event.detail.url);
    };

    const handleFloorTextureApplied = (event: CustomEvent<{ url: string }>) => {
      setAiFloorTextureUrl(event.detail.url);
    };

    const handleObjectSpawn = (event: CustomEvent<{ object: AIGeneratedObject }>) => {
      setAiObjects(prev => [...prev, event.detail.object]);
    };

    const handleClearAIContent = () => {
      setAiBackgroundUrl(null);
      setAiFloorTextureUrl(null);
      setAiObjects([]);
    };

    window.addEventListener('ai-background-applied', handleBackgroundApplied as EventListener);
    window.addEventListener('ai-floor-texture-applied', handleFloorTextureApplied as EventListener);
    window.addEventListener('ai-object-spawn', handleObjectSpawn as EventListener);
    window.addEventListener('ai-clear-content', handleClearAIContent);

    return () => {
      window.removeEventListener('ai-background-applied', handleBackgroundApplied as EventListener);
      window.removeEventListener('ai-floor-texture-applied', handleFloorTextureApplied as EventListener);
      window.removeEventListener('ai-object-spawn', handleObjectSpawn as EventListener);
      window.removeEventListener('ai-clear-content', handleClearAIContent);
    };
  }, []);

  const gripperPosition = calculateGripperPosition(joints);

  // Store event listener refs for cleanup
  const contextLostHandlerRef = useRef<((event: Event) => void) | null>(null);
  const contextRestoredHandlerRef = useRef<(() => void) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreated = useCallback((state: any) => {
    const gl = state.gl as WebGPURenderer;
    rendererRef.current = gl;
    const canvas = gl.domElement;
    canvasRef.current = canvas;

    // Reduce GPU pressure
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));

    // Shadow settings - use type assertion for WebGPU/WebGL compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shadowMap = gl.shadowMap as any;
    if (shadowMap) {
      shadowMap.type = THREE.BasicShadowMap;
      shadowMap.autoUpdate = false;
      shadowMap.needsUpdate = true;
    }

    // Create handlers with refs for cleanup
    contextLostHandlerRef.current = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    contextRestoredHandlerRef.current = () => {
      setContextLost(false);
    };

    canvas.addEventListener('webglcontextlost', contextLostHandlerRef.current);
    canvas.addEventListener('webglcontextrestored', contextRestoredHandlerRef.current);
  }, []);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      const canvas = canvasRef.current;
      if (canvas) {
        if (contextLostHandlerRef.current) {
          canvas.removeEventListener('webglcontextlost', contextLostHandlerRef.current);
        }
        if (contextRestoredHandlerRef.current) {
          canvas.removeEventListener('webglcontextrestored', contextRestoredHandlerRef.current);
        }
      }
    };
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
        shadows
        dpr={[1, 1.5]}
        gl={async (props) => {
          // Create WebGPU renderer with automatic WebGL fallback
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          });
          await renderer.init();
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.1;
          return renderer;
        }}
        onCreated={handleCreated}
      >
        {/* Default background - hidden when AI background is applied */}
        {!aiBackgroundUrl && <color attach="background" args={['#0f172a']} />}

        {/* AI-generated background */}
        {aiBackgroundUrl && <AIBackground imageUrl={aiBackgroundUrl} />}

        <PerspectiveCamera makeDefault position={getCameraPosition()} fov={45} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.15}
          maxDistance={2}
          target={getCameraTarget()}
        />

        {/* Key light */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
        >
          <orthographicCamera attach="shadow-camera" args={[-1, 1, 1, -1, 0.1, 20]} />
        </directionalLight>

        {/* Fill light */}
        <directionalLight position={[-3, 4, -2]} intensity={0.8} color="#a0c4ff" />

        {/* Rim light */}
        <directionalLight position={[0, 3, -5]} intensity={0.6} color="#ffd6a5" />

        {/* Ambient light - increased to compensate for removed Environment */}
        <ambientLight intensity={0.4} />

        {/* Simple shadow plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <circleGeometry args={[0.8, 32]} />
          <meshStandardNodeMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
        </mesh>

        <Physics gravity={[0, -9.81, 0]} timeStep={1/60}>
          <FloorCollider />

          {/* Render the appropriate robot based on type */}
          {activeRobotType === 'arm' && (
            <SO101Arm3D joints={joints} />
          )}

          {activeRobotType === 'wheeled' && (
            <WheeledRobot3D state={wheeledRobot} />
          )}

          {activeRobotType === 'drone' && (
            <Drone3D state={drone} onStateChange={onDroneStateChange} />
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

          {/* AI-generated interactive objects */}
          {aiObjects.map((aiObj) => (
            <AIObject3D key={aiObj.id} aiObject={aiObj} />
          ))}
        </Physics>

        <WorkspaceGrid size={activeRobotType === 'drone' ? 1 : 0.5} textureUrl={aiFloorTextureUrl} />
        <EnvironmentLayer environmentId={environment} />

        {/* Sensor visualization (for arm) */}
        {activeRobotType === 'arm' && sensors && (
          <SensorVisualization3DLayer
            sensors={sensors}
            visualization={sensorVisualization || defaultSensorViz}
            joints={joints}
          />
        )}

        {/* Click-to-move and workspace visualization (for arm) */}
        {activeRobotType === 'arm' && (
          <>
            <WorkspaceVisualization visible={showWorkspace} />
            {clickToMoveEnabled && onJointsChange && (
              <ClickToMove
                joints={joints}
                onMove={onJointsChange}
                enabled={clickToMoveEnabled}
              />
            )}
          </>
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
            {/* Object positions */}
            {objects && objects.length > 0 && (
              <>
                <div className="text-xs text-slate-400 mt-2 mb-1 border-t border-slate-700 pt-2">Objects in Scene</div>
                {objects.slice(0, 3).map((obj, i) => {
                  const [x, y, z] = obj.position;
                  const dist = Math.sqrt(x * x + z * z);
                  return (
                    <div key={obj.id || i} className="text-xs font-mono text-slate-300">
                      <span className="text-blue-400">{obj.name || obj.type}</span>: [{(x * 100).toFixed(0)}, {(y * 100).toFixed(0)}, {(z * 100).toFixed(0)}]cm <span className="text-slate-500">({(dist * 100).toFixed(0)}cm)</span>
                    </div>
                  );
                })}
                {objects.length > 3 && (
                  <div className="text-xs text-slate-500">+{objects.length - 3} more</div>
                )}
              </>
            )}
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
