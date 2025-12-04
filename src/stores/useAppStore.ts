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

interface AppState {
  // Robot State
  selectedRobotId: string;
  selectedRobot: RobotProfile | null;
  activeRobotType: ActiveRobotType;
  joints: JointState;
  wheeledRobot: WheeledRobotState;
  drone: DroneState;
  humanoid: HumanoidState;
  isAnimating: boolean;

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

  // Actions
  setSelectedRobot: (robotId: string) => void;
  setActiveRobotType: (type: ActiveRobotType) => void;
  setJoints: (joints: Partial<JointState>) => void;
  setWheeledRobot: (state: Partial<WheeledRobotState>) => void;
  setDrone: (state: Partial<DroneState>) => void;
  setHumanoid: (state: Partial<HumanoidState>) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setSimulationStatus: (status: SimulationState['status']) => void;
  setSensors: (sensors: Partial<SensorReading>) => void;
  setSensorVisualization: (viz: Partial<SensorVisualization>) => void;
  setCode: (code: Partial<CodeState>) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setLLMLoading: (loading: boolean) => void;
  setSkillLevel: (level: SkillLevel) => void;
  resetToDefaults: () => void;

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
    joints: robot.defaultPosition,
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
      showUltrasonicBeam: true,
      showIRIndicators: true,
      showDistanceLabels: true,
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

  setJoints: (joints: Partial<JointState>) => {
    const currentJoints = get().joints;
    const robot = get().selectedRobot;

    // Apply limits
    const newJoints = { ...currentJoints };
    for (const [key, value] of Object.entries(joints)) {
      const jointKey = key as keyof JointState;
      if (robot && robot.limits[jointKey]) {
        const { min, max } = robot.limits[jointKey];
        newJoints[jointKey] = Math.max(min, Math.min(max, value as number));
      } else {
        newJoints[jointKey] = value as number;
      }
    }

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

  resetToDefaults: () => set(getDefaultState()),

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
      id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
      id: `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
    };
    set((state) => ({
      consoleMessages: [...state.consoleMessages, newMessage].slice(-100), // Keep last 100 messages
    }));
  },

  clearConsole: () => {
    set({ consoleMessages: [] });
  },

  setCodeRunning: (running: boolean) => {
    set({ isCodeRunning: running });
  },
}));
