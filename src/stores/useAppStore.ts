/**
 * Main application state store using Zustand
 *
 * This store manages all application state including:
 * - Robot state (joints, motor dynamics, different robot types)
 * - Gripper state (position, orientation, grasp state)
 * - Simulation state
 * - Environment state (objects, target zones)
 * - Challenge/game state
 * - Code editor state
 * - Chat/LLM state
 * - UI preferences
 *
 * NOTE: This store is intentionally kept as a single unit for now due to
 * interdependencies between state slices. Future refactoring could split
 * into separate slices using Zustand's slice pattern.
 */

import { create } from 'zustand';
import type {
  JointState,
  ChatMessage,
  SimulationState,
  CodeState,
  SensorReading,
  RobotProfile,
  SkillLevel,
  EnvironmentType,
  SimObject,
  TargetZone,
  Challenge,
  ChallengeState,
  SensorVisualization,
  ConsoleMessage,
  ConsoleMessageType,
  ActiveRobotType,
  WheeledRobotState,
  DroneState,
  HumanoidState,
} from '../types';
import { ROBOT_PROFILES, DEFAULT_ROBOT_ID, getDefaultCode } from '../config/robots';
import {
  DEFAULT_ENVIRONMENT,
  getEnvironmentObjects,
  getEnvironmentTargetZones,
  CHALLENGES,
} from '../config/environments';
import { DEFAULT_HUMANOID_STATE } from '../components/simulation/defaults';
// NOTE: Floor constraint feature disabled - uncomment when re-enabling
// import { calculateGripperPositionURDF } from '../components/simulation/SO101KinematicsURDF';
import { preventSelfCollision } from '../lib/selfCollision';
import { generateSecureId } from '../lib/crypto';
import { CONSOLE_CONFIG } from '../lib/config';

/**
 * Motor dynamics configuration for realistic servo simulation
 * Velocity limits in degrees/second, acceleration in degrees/second²
 */
export interface MotorDynamicsConfig {
  enabled: boolean;
  velocityLimits: JointState;      // Max velocity per joint (deg/s)
  accelerationLimits: JointState;  // Max acceleration per joint (deg/s²)
  latencyMs: number;               // Command latency (ms)
}

// Default SO-101 motor dynamics based on STS3215 servo specs
const DEFAULT_MOTOR_DYNAMICS: MotorDynamicsConfig = {
  enabled: false,  // Disabled by default for backwards compatibility
  velocityLimits: {
    base: 120,      // Base rotation (slower for stability)
    shoulder: 90,   // Shoulder lift (slowest - heavy load)
    elbow: 90,      // Elbow flex
    wrist: 120,     // Wrist flex
    wristRoll: 150, // Wrist roll
    gripper: 180,   // Gripper (fastest)
  },
  accelerationLimits: {
    base: 500,
    shoulder: 400,
    elbow: 400,
    wrist: 600,
    wristRoll: 800,
    gripper: 1000,
  },
  latencyMs: 0,
};

interface AppState {
  // Robot State
  selectedRobotId: string;
  selectedRobot: RobotProfile | null;
  activeRobotType: ActiveRobotType;
  joints: JointState;              // Target joints (what user commands)
  actualJoints: JointState;        // Actual joints (after motor dynamics)
  jointVelocities: JointState;     // Current joint velocities (deg/s)
  motorDynamics: MotorDynamicsConfig; // Motor simulation config
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;
  isAnimating: boolean;

  // Gripper world position - updated from Three.js scene each frame
  gripperWorldPosition: [number, number, number];
  // Gripper world quaternion - updated from Three.js scene each frame (for orientation-aware grab)
  gripperWorldQuaternion: [number, number, number, number]; // [x, y, z, w]
  // Gripper minimum value - when holding an object, gripper can't close past this
  gripperMinValue: number | null;

  // Simulation State
  simulation: SimulationState;
  sensors: SensorReading;
  sensorVisualization: SensorVisualization;

  // Environment State
  currentEnvironment: EnvironmentType;
  objects: SimObject[];
  targetZones: TargetZone[];

  // Challenge State
  challenges: Challenge[];
  challengeState: ChallengeState;

  // Code State
  code: CodeState;
  consoleMessages: ConsoleMessage[];
  isCodeRunning: boolean;

  // Chat State
  messages: ChatMessage[];
  isLLMLoading: boolean;

  // User State
  skillLevel: SkillLevel;

  // Advanced Control State
  controlMode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad';
  showWorkspace: boolean;
  showGripperDebug: boolean; // Show gripper tip/jaw debug visualization

  // Actions
  setSelectedRobot: (robotId: string) => void;
  setActiveRobotType: (type: ActiveRobotType) => void;
  setJoints: (joints: Partial<JointState>) => void;
  setWheeledRobot: (state: Partial<WheeledRobotState>) => void;
  setDrone: (state: Partial<DroneState>) => void;
  setHumanoid: (state: Partial<HumanoidState>) => void;
  setGripperWorldPosition: (position: [number, number, number]) => void;
  setGripperWorldQuaternion: (quaternion: [number, number, number, number]) => void;
  setGripperMinValue: (value: number | null) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setSimulationStatus: (status: SimulationState['status']) => void;
  setSensors: (sensors: Partial<SensorReading>) => void;
  setSensorVisualization: (viz: Partial<SensorVisualization>) => void;
  setCode: (code: Partial<CodeState>) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setLLMLoading: (loading: boolean) => void;
  setSkillLevel: (level: SkillLevel) => void;
  setControlMode: (mode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad') => void;
  setShowWorkspace: (show: boolean) => void;
  setShowGripperDebug: (show: boolean) => void;
  resetToDefaults: () => void;

  // Motor Dynamics Actions
  setMotorDynamics: (config: Partial<MotorDynamicsConfig>) => void;
  updateActualJoints: (deltaTime: number) => void;  // Called each frame

  // Environment Actions
  setEnvironment: (envId: EnvironmentType) => void;
  spawnObject: (obj: Omit<SimObject, 'id'>) => void;
  removeObject: (objId: string) => void;
  updateObject: (objId: string, updates: Partial<SimObject>) => void;
  clearObjects: () => void;

  // Challenge Actions
  startChallenge: (challengeId: string) => void;
  completeObjective: (objectiveId: string) => void;
  failChallenge: () => void;
  resetChallenge: () => void;
  updateChallengeTimer: (elapsed: number) => void;

  // Console Actions
  addConsoleMessage: (type: ConsoleMessageType, message: string) => void;
  clearConsole: () => void;
  setCodeRunning: (running: boolean) => void;
}

const getDefaultState = () => {
  const robot = ROBOT_PROFILES.find((r) => r.id === DEFAULT_ROBOT_ID) || ROBOT_PROFILES[0];
  const defaultEnv = DEFAULT_ENVIRONMENT as EnvironmentType;
  return {
    selectedRobotId: DEFAULT_ROBOT_ID,
    selectedRobot: robot,
    activeRobotType: 'arm' as ActiveRobotType,
    joints: robot.defaultPosition,                    // Target joints (what user commands)
    actualJoints: robot.defaultPosition,              // Actual joints (after motor dynamics)
    jointVelocities: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0 } as JointState,
    motorDynamics: { ...DEFAULT_MOTOR_DYNAMICS },     // Motor simulation config
    gripperWorldPosition: [0, 0.15, 0] as [number, number, number], // Default gripper position
    gripperWorldQuaternion: [0, 0, 0, 1] as [number, number, number, number], // Identity quaternion
    gripperMinValue: null as number | null, // Minimum gripper value when holding object
    wheeledRobot: {
      leftWheelSpeed: 0,
      rightWheelSpeed: 0,
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      velocity: 0,
      angularVelocity: 0,
      servoHead: 0,
    } as WheeledRobotState,
    drone: {
      position: { x: 0, y: 0.05, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      throttle: 0,
      armed: false,
      flightMode: 'stabilize' as const,
      motorsRPM: [0, 0, 0, 0] as [number, number, number, number],
    } as DroneState,
    humanoid: DEFAULT_HUMANOID_STATE,
    isAnimating: false,
    simulation: {
      status: 'idle' as const,
      fps: 60,
      elapsedTime: 0,
    },
    sensors: {
      ultrasonic: 25.0,
      leftIR: false,
      centerIR: false,
      rightIR: false,
      leftMotor: 0,
      rightMotor: 0,
      battery: 100,
    },
    sensorVisualization: {
      showUltrasonicBeam: false,
      showIRIndicators: false,
      showDistanceLabels: false,
    },
    // Environment state
    currentEnvironment: defaultEnv,
    objects: getEnvironmentObjects(defaultEnv),
    targetZones: getEnvironmentTargetZones(defaultEnv),
    // Challenge state
    challenges: CHALLENGES,
    challengeState: {
      activeChallenge: null,
      elapsedTime: 0,
      isTimerRunning: false,
      objectivesCompleted: 0,
      totalObjectives: 0,
      score: 0,
    },
    code: {
      source: getDefaultCode(DEFAULT_ROBOT_ID),
      language: 'javascript' as const,
      isCompiling: false,
      isGenerated: false,
    },
    consoleMessages: [],
    isCodeRunning: false,
    messages: [
      {
        id: '1',
        role: 'assistant' as const,
        content:
          "Hi! I'm your RoboSim AI assistant. Tell me what you want your robot to do in plain English, and I'll generate the code and run the simulation!",
        timestamp: new Date(),
      },
    ],
    isLLMLoading: false,
    skillLevel: 'prompter' as const,
    controlMode: 'manual' as const,
    showWorkspace: false,
    showGripperDebug: true, // Enable gripper debug visualization by default
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  ...getDefaultState(),

  setSelectedRobot: (robotId: string) => {
    const robot = ROBOT_PROFILES.find((r) => r.id === robotId);
    if (robot) {
      set({
        selectedRobotId: robotId,
        selectedRobot: robot,
        joints: robot.defaultPosition,
        code: {
          ...get().code,
          source: getDefaultCode(robotId),
          isGenerated: false,
        },
      });
    }
  },

  setActiveRobotType: (type: ActiveRobotType) => {
    set({ activeRobotType: type });
  },

  setWheeledRobot: (state: Partial<WheeledRobotState>) => {
    set((s) => ({
      wheeledRobot: { ...s.wheeledRobot, ...state },
    }));
  },

  setDrone: (state: Partial<DroneState>) => {
    set((s) => ({
      drone: { ...s.drone, ...state },
    }));
  },

  setHumanoid: (state: Partial<HumanoidState>) => {
    set((s) => ({
      humanoid: { ...s.humanoid, ...state },
    }));
  },

  setGripperWorldPosition: (position: [number, number, number]) => {
    set({ gripperWorldPosition: position });
  },

  setGripperWorldQuaternion: (quaternion: [number, number, number, number]) => {
    set({ gripperWorldQuaternion: quaternion });
  },

  setGripperMinValue: (value: number | null) => {
    set({ gripperMinValue: value });
  },

  setJoints: (joints: Partial<JointState>) => {
    const currentJoints = get().joints;
    const robot = get().selectedRobot;
    const robotId = get().selectedRobotId;
    let gripperMinValue = get().gripperMinValue;
    const objects = get().objects;
    const gripperWorldPosition = get().gripperWorldPosition;
    const gripperWorldQuaternion = get().gripperWorldQuaternion;

    // Apply individual joint limits
    let newJoints = { ...currentJoints };
    for (const [key, value] of Object.entries(joints)) {
      const jointKey = key as keyof JointState;
      if (robot && robot.limits[jointKey]) {
        const { min, max } = robot.limits[jointKey];
        newJoints[jointKey] = Math.max(min, Math.min(max, value as number));
      } else {
        newJoints[jointKey] = value as number;
      }
    }

    // === FLOOR CONSTRAINT ===
    // Temporarily disabled for debugging - the URDF-based FK might have issues
    // TODO: Re-enable once we verify the FK matches the visual
    /*
    const predictedGripperPos = calculateGripperPositionURDF(newJoints);
    const FLOOR_CLEARANCE = 0.005; // 5mm clearance above floor
    if (predictedGripperPos[1] < FLOOR_CLEARANCE) {
      // Gripper would go below floor - reject these joint changes
      // Keep the old arm joints, only allow gripper changes
      if (joints.gripper !== undefined) {
        newJoints = { ...currentJoints, gripper: newJoints.gripper };
      } else {
        newJoints = { ...currentJoints };
      }
    }
    */

    // === PROACTIVE COLLISION DETECTION ===
    // Check if there's an object in the grasp zone
    // This runs BEFORE the visual updates, preventing pass-through
    const hasGrabbedObject = objects.some(o => o.isGrabbed);

    if (!hasGrabbedObject && gripperWorldPosition[0] !== 0) {
      // Constants for collision detection - using correct sinusoidal geometry
      const JAW_LOCAL_OFFSET = { x: -0.0079, y: 0, z: 0.0068 }; // Jaw center in gripper_frame local coords
      const GRASP_ZONE = 0.10;   // 10cm detection zone
      const JAW_LENGTH = 0.030;  // 3cm jaw length from pivot to tip
      const GRIPPER_MIN_ANGLE_DEG = -10;  // Closed position
      const GRIPPER_ANGLE_RANGE_DEG = 110; // -10° to +100°

      // Calculate jaw position from gripper tip
      const qx = gripperWorldQuaternion[0];
      const qy = gripperWorldQuaternion[1];
      const qz = gripperWorldQuaternion[2];
      const qw = gripperWorldQuaternion[3];

      // Rotate local jaw offset by gripper quaternion (no allocations)
      const ox = JAW_LOCAL_OFFSET.x;
      const oy = JAW_LOCAL_OFFSET.y;
      const oz = JAW_LOCAL_OFFSET.z;
      const uvx = qy * oz - qz * oy;
      const uvy = qz * ox - qx * oz;
      const uvz = qx * oy - qy * ox;
      const uuvx = qy * uvz - qz * uvy;
      const uuvy = qz * uvx - qx * uvz;
      const uuvz = qx * uvy - qy * uvx;
      const twoW = 2 * qw;
      const jawOffsetX = ox + uvx * twoW + uuvx * 2;
      const jawOffsetY = oy + uvy * twoW + uuvy * 2;
      const jawOffsetZ = oz + uvz * twoW + uuvz * 2;

      const jawX = gripperWorldPosition[0] + jawOffsetX;
      const jawY = gripperWorldPosition[1] + jawOffsetY;
      const jawZ = gripperWorldPosition[2] + jawOffsetZ;

      // Find nearest graspable object in zone
      for (const obj of objects) {
        if (!obj.isGrabbable || obj.isGrabbed) continue;

        const dx = obj.position[0] - jawX;
        const dy = obj.position[1] - jawY;
        const dz = obj.position[2] - jawZ;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < GRASP_ZONE) {
          // Object in grasp zone - calculate minimum gripper value using sinusoidal formula
          const objectDiameter = obj.scale;
          const targetGap = objectDiameter * 0.95;
          const maxGap = 2 * JAW_LENGTH; // Maximum possible gap (when jaws at 90°)
          const sinAngle = Math.min(1, targetGap / maxGap);
          const angleRad = Math.asin(sinAngle);
          const angleDeg = angleRad * (180 / Math.PI);
          const minForObject = Math.max(0, Math.min(100, ((angleDeg - GRIPPER_MIN_ANGLE_DEG) / GRIPPER_ANGLE_RANGE_DEG) * 100));

          // Set the more restrictive minimum
          if (gripperMinValue === null || minForObject > gripperMinValue) {
            gripperMinValue = minForObject;
            set({ gripperMinValue: minForObject });
          }
          break; // Only need to check one object
        }
      }
    }

    // Apply gripper minimum when holding an object (prevents crushing)
    if (gripperMinValue !== null && newJoints.gripper < gripperMinValue) {
      newJoints.gripper = gripperMinValue;
    }

    // Apply self-collision prevention for articulated arms
    newJoints = preventSelfCollision(newJoints, robotId);

    set({ joints: newJoints });
  },

  setIsAnimating: (isAnimating: boolean) => set({ isAnimating }),

  setSimulationStatus: (status: SimulationState['status']) =>
    set((state) => ({
      simulation: { ...state.simulation, status },
    })),

  setSensors: (sensors: Partial<SensorReading>) =>
    set((state) => ({
      sensors: { ...state.sensors, ...sensors },
    })),

  setSensorVisualization: (viz: Partial<SensorVisualization>) =>
    set((state) => ({
      sensorVisualization: { ...state.sensorVisualization, ...viz },
    })),

  setCode: (code: Partial<CodeState>) =>
    set((state) => ({
      code: { ...state.code, ...code },
    })),

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date(),
        },
      ],
    })),

  clearMessages: () =>
    set({
      messages: [
        {
          id: '1',
          role: 'assistant',
          content: "Chat cleared. How can I help you with your robot?",
          timestamp: new Date(),
        },
      ],
    }),

  setLLMLoading: (loading: boolean) => set({ isLLMLoading: loading }),

  setSkillLevel: (level: SkillLevel) => set({ skillLevel: level }),

  setControlMode: (mode: 'manual' | 'click-to-move' | 'keyboard' | 'gamepad') => set({ controlMode: mode }),

  setShowWorkspace: (show: boolean) => set({ showWorkspace: show }),

  setShowGripperDebug: (show: boolean) => set({ showGripperDebug: show }),

  resetToDefaults: () => set(getDefaultState()),

  // Motor Dynamics Actions
  setMotorDynamics: (config: Partial<MotorDynamicsConfig>) => {
    set((state) => ({
      motorDynamics: { ...state.motorDynamics, ...config },
    }));
  },

  /**
   * Update actual joints by applying motor dynamics (velocity/acceleration limits)
   * Called each animation frame with delta time in seconds
   * When motor dynamics is disabled, actual joints immediately match target joints
   */
  updateActualJoints: (deltaTime: number) => {
    const state = get();
    const { joints: target, actualJoints: actual, jointVelocities, motorDynamics } = state;

    // If motor dynamics disabled, snap to target immediately
    if (!motorDynamics.enabled) {
      if (actual !== target) {
        set({
          actualJoints: { ...target },
          jointVelocities: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 0 },
        });
      }
      return;
    }

    // Apply motor dynamics with velocity and acceleration limits
    const newActual: JointState = { ...actual };
    const newVelocities: JointState = { ...jointVelocities };
    const jointKeys: (keyof JointState)[] = ['base', 'shoulder', 'elbow', 'wrist', 'wristRoll', 'gripper'];

    for (const key of jointKeys) {
      const error = target[key] - actual[key];
      const maxVel = motorDynamics.velocityLimits[key];
      const maxAccel = motorDynamics.accelerationLimits[key];
      const currentVel = jointVelocities[key];

      // Calculate desired velocity (P-controller with velocity limit)
      // Use proportional gain of 5 for responsive but smooth tracking
      const kP = 5.0;
      let desiredVel = error * kP;
      desiredVel = Math.max(-maxVel, Math.min(maxVel, desiredVel));

      // Apply acceleration limit
      const velChange = desiredVel - currentVel;
      const maxVelChange = maxAccel * deltaTime;
      const limitedVelChange = Math.max(-maxVelChange, Math.min(maxVelChange, velChange));
      const newVel = currentVel + limitedVelChange;

      // Update position
      newActual[key] = actual[key] + newVel * deltaTime;
      newVelocities[key] = newVel;

      // Clamp to target if very close (prevents oscillation)
      if (Math.abs(newActual[key] - target[key]) < 0.1 && Math.abs(newVel) < 1) {
        newActual[key] = target[key];
        newVelocities[key] = 0;
      }
    }

    set({
      actualJoints: newActual,
      jointVelocities: newVelocities,
    });
  },

  // Environment Actions
  setEnvironment: (envId: EnvironmentType) => {
    const objects = getEnvironmentObjects(envId);
    const targetZones = getEnvironmentTargetZones(envId);
    set({
      currentEnvironment: envId,
      objects,
      targetZones,
      // Reset challenge state when changing environment
      challengeState: {
        ...get().challengeState,
        activeChallenge: null,
        elapsedTime: 0,
        isTimerRunning: false,
        objectivesCompleted: 0,
        totalObjectives: 0,
      },
    });
  },

  spawnObject: (obj: Omit<SimObject, 'id'>) => {
    const newObj: SimObject = {
      ...obj,
      id: generateSecureId('obj'),
    };
    set((state) => ({
      objects: [...state.objects, newObj],
    }));
  },

  removeObject: (objId: string) => {
    set((state) => ({
      objects: state.objects.filter((o) => o.id !== objId),
    }));
  },

  updateObject: (objId: string, updates: Partial<SimObject>) => {
    set((state) => ({
      objects: state.objects.map((o) =>
        o.id === objId ? { ...o, ...updates } : o
      ),
    }));
  },

  clearObjects: () => {
    set({ objects: [] });
  },

  // Challenge Actions
  startChallenge: (challengeId: string) => {
    const challenge = get().challenges.find((c) => c.id === challengeId);
    if (!challenge || challenge.status === 'locked') return;

    // Update challenge status
    const updatedChallenges = get().challenges.map((c) =>
      c.id === challengeId ? { ...c, status: 'in_progress' as const, attempts: c.attempts + 1 } : c
    );

    // Load environment for this challenge
    const objects = getEnvironmentObjects(challenge.environment);
    const targetZones = getEnvironmentTargetZones(challenge.environment);

    set({
      challenges: updatedChallenges,
      currentEnvironment: challenge.environment,
      objects,
      targetZones,
      challengeState: {
        activeChallenge: { ...challenge, status: 'in_progress' },
        elapsedTime: 0,
        isTimerRunning: true,
        objectivesCompleted: 0,
        totalObjectives: challenge.objectives.length,
        score: 0,
      },
    });
  },

  completeObjective: (objectiveId: string) => {
    const { challengeState, challenges } = get();
    if (!challengeState.activeChallenge) return;

    const updatedObjectives = challengeState.activeChallenge.objectives.map((obj) =>
      obj.id === objectiveId ? { ...obj, isCompleted: true } : obj
    );

    const completedCount = updatedObjectives.filter((o) => o.isCompleted).length;
    const allCompleted = completedCount === updatedObjectives.length;

    // Calculate score based on time (faster = more points)
    const timeBonus = challengeState.activeChallenge.timeLimit
      ? Math.max(0, challengeState.activeChallenge.timeLimit - challengeState.elapsedTime) * 10
      : 0;
    const objectivePoints = completedCount * 100;

    if (allCompleted) {
      // Challenge completed!
      const updatedChallenges = challenges.map((c) => {
        if (c.id === challengeState.activeChallenge!.id) {
          return {
            ...c,
            status: 'completed' as const,
            bestTime: c.bestTime
              ? Math.min(c.bestTime, challengeState.elapsedTime)
              : challengeState.elapsedTime,
          };
        }
        // Unlock next challenge if applicable
        if (c.status === 'locked') {
          const idx = challenges.findIndex((ch) => ch.id === c.id);
          const prevIdx = challenges.findIndex(
            (ch) => ch.id === challengeState.activeChallenge!.id
          );
          if (idx === prevIdx + 1) {
            return { ...c, status: 'available' as const };
          }
        }
        return c;
      });

      set({
        challenges: updatedChallenges,
        challengeState: {
          ...challengeState,
          activeChallenge: {
            ...challengeState.activeChallenge,
            objectives: updatedObjectives,
            status: 'completed',
          },
          objectivesCompleted: completedCount,
          isTimerRunning: false,
          score: objectivePoints + timeBonus,
        },
      });
    } else {
      set({
        challengeState: {
          ...challengeState,
          activeChallenge: {
            ...challengeState.activeChallenge,
            objectives: updatedObjectives,
          },
          objectivesCompleted: completedCount,
          score: objectivePoints,
        },
      });
    }
  },

  failChallenge: () => {
    const { challengeState, challenges } = get();
    if (!challengeState.activeChallenge) return;

    const updatedChallenges = challenges.map((c) =>
      c.id === challengeState.activeChallenge!.id
        ? { ...c, status: 'available' as const }
        : c
    );

    set({
      challenges: updatedChallenges,
      challengeState: {
        ...challengeState,
        activeChallenge: {
          ...challengeState.activeChallenge,
          status: 'failed',
        },
        isTimerRunning: false,
      },
    });
  },

  resetChallenge: () => {
    const { challengeState } = get();
    if (!challengeState.activeChallenge) return;

    // Restart the same challenge
    get().startChallenge(challengeState.activeChallenge.id);
  },

  updateChallengeTimer: (elapsed: number) => {
    const { challengeState } = get();
    if (!challengeState.isTimerRunning) return;

    // Check time limit
    if (
      challengeState.activeChallenge?.timeLimit &&
      elapsed >= challengeState.activeChallenge.timeLimit
    ) {
      get().failChallenge();
      return;
    }

    set({
      challengeState: {
        ...challengeState,
        elapsedTime: elapsed,
      },
    });
  },

  // Console Actions
  addConsoleMessage: (type: ConsoleMessageType, message: string) => {
    const newMessage: ConsoleMessage = {
      id: generateSecureId('console'),
      type,
      message,
      timestamp: new Date(),
    };
    set((state) => ({
      consoleMessages: [...state.consoleMessages, newMessage].slice(-CONSOLE_CONFIG.MAX_MESSAGES),
    }));
  },

  clearConsole: () => {
    set({ consoleMessages: [] });
  },

  setCodeRunning: (running: boolean) => {
    set({ isCodeRunning: running });
  },
}));

// Expose store to window for testing
if (typeof window !== 'undefined') {
  (window as unknown as { __ZUSTAND_STORE__: typeof useAppStore; __APP_STORE__: typeof useAppStore }).__ZUSTAND_STORE__ = useAppStore;
  (window as unknown as { __APP_STORE__: typeof useAppStore }).__APP_STORE__ = useAppStore;
}
