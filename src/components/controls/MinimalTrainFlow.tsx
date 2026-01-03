/**
 * Minimal Train Flow
 *
 * Apple-inspired one-button UX for the "photo to trained robot" flow.
 * Shows only what's needed at each step - everything else in a drawer.
 *
 * Component Structure (potential future refactoring targets):
 * - WelcomeModal: First-time visitor welcome dialog
 * - FlowStepIndicator: Shows current step in the flow
 * - AddObjectStep: Object selection/generation UI
 * - RecordDemoStep: Demo recording UI with LLM control
 * - GenerateStep: Batch episode generation
 * - UploadStep: HuggingFace dataset upload
 * - ApiKeyInputs: FAL/HF API key management
 * - SettingsDrawer: Advanced settings panel
 *
 * Flow Steps:
 * 1. add-object - Select or generate a 3D object
 * 2. record-demo - Record a pickup demonstration
 * 3. generate - Generate training data variations
 * 4. upload - Upload dataset to HuggingFace
 * 5. done - Success state
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Camera,
  Rocket,
  CheckCircle,
  Loader2,
  Settings,
  Box,
  ChevronLeft,
  Send,
  Play,
  ExternalLink,
  Cpu,
  Bot,
  MessageSquare,
  Database,
  GraduationCap,
  Wrench,
  FlaskConical,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { Episode, Frame } from '../../lib/datasetExporter';
import { generateTrainableObject as generateFalObject } from '../../lib/falImageTo3D';
import { useLLMChat } from '../../hooks/useLLMChat';
import { getClaudeApiKey, setClaudeApiKey, callClaudeAPI, type FullRobotState, type ClaudeResponse } from '../../lib/claudeApi';
import type { JointState } from '../../types';
import { getFalApiKey, setFalApiKey, getHfToken, setHfToken } from '../../lib/apiKeys';
import { getOptimalPlacement } from '../../lib/workspacePlacement';
import {
  PRIMITIVE_OBJECTS,
  createSimObjectFromTemplate,
  type ObjectTemplate,
} from '../../lib/objectLibrary';
import { scheduleFrame, cancelFrame } from '../../lib/animationUtils';
import {
  autoGenerateEpisodes,
  TARGET_EPISODE_COUNT,
  type QuickTrainState,
  initialQuickTrainState,
  getAllEpisodes,
} from '../../lib/quickTrainFlow';
import { exportLeRobotDataset } from '../../lib/lerobotExporter';
import {
  uploadViaBackendAPI,
  isBackendAPIAvailable,
} from '../../lib/huggingfaceUpload';
import { calculateQualityMetrics } from '../../lib/teleoperationGuide';
import { createLogger } from '../../lib/logger';
// Motion variation and recovery behaviors removed for reliable demos
// (can be re-enabled once base pickup is more robust)
import { randomizeVisualsForEpisode } from '../../stores/useVisualStore';
import { captureFromCanvas, randomAugmentationConfig, applyAugmentations, type AugmentationConfig } from '../../lib/cameraCapture';
import { useUsageStore } from '../../stores/useUsageStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { TIER_LIMITS } from '../../lib/supabase';
import { TARGET_ZONES, generatePlaceSequence, type TargetZone } from '../../lib/placeExamples';

const log = createLogger('TrainFlow');

// Number of demos to generate for training data
const BATCH_COUNT = 10;

/**
 * Catmull-Rom spline interpolation for smooth motion through waypoints
 * Maintains velocity continuity across waypoints for natural robot motion
 */
function catmullRomInterpolate(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Interpolate joint positions using Catmull-Rom splines
 * waypoints: array of joint position arrays [base, shoulder, elbow, wrist, wristRoll, gripper]
 * t: global parameter 0-1 across entire trajectory
 */
function interpolateWaypoints(
  waypoints: number[][],
  t: number
): number[] {
  if (waypoints.length < 2) return waypoints[0] || [0, 0, 0, 0, 0, 100];

  const numSegments = waypoints.length - 1;
  const segmentT = t * numSegments;
  const segmentIndex = Math.min(Math.floor(segmentT), numSegments - 1);
  const localT = segmentT - segmentIndex;

  // Get the 4 control points for Catmull-Rom (extend endpoints)
  const p0 = waypoints[Math.max(0, segmentIndex - 1)];
  const p1 = waypoints[segmentIndex];
  const p2 = waypoints[Math.min(waypoints.length - 1, segmentIndex + 1)];
  const p3 = waypoints[Math.min(waypoints.length - 1, segmentIndex + 2)];

  // Interpolate each joint
  const result: number[] = [];
  for (let i = 0; i < 6; i++) {
    result.push(catmullRomInterpolate(p0[i], p1[i], p2[i], p3[i], localT));
  }
  return result;
}

type FlowStep = 'add-object' | 'record-demo' | 'generate' | 'upload' | 'done';

interface MinimalTrainFlowProps {
  onOpenDrawer: () => void;
}

export const MinimalTrainFlow: React.FC<MinimalTrainFlowProps> = ({ onOpenDrawer }) => {
  // Welcome modal for first-time visitors
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem('robosim-welcomed');
  });

  const dismissWelcome = useCallback(() => {
    localStorage.setItem('robosim-welcomed', 'true');
    setShowWelcome(false);
  }, []);

  // Flow state
  const [step, setStep] = useState<FlowStep>('add-object');
  const [state, setState] = useState<QuickTrainState>(initialQuickTrainState);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API keys - load from persistent storage
  const [falApiKey, setFalApiKeyState] = useState(() => getFalApiKey() || '');
  const [hfToken, setHfTokenState] = useState(() => getHfToken() || '');
  const [showKeyInput, setShowKeyInput] = useState<'fal' | 'hf' | null>(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Wrapper to persist fal API key
  const updateFalApiKey = useCallback((key: string) => {
    setFalApiKeyState(key);
    if (key) setFalApiKey(key); // Persist to localStorage
  }, []);

  // Wrapper to persist HF token
  const updateHfToken = useCallback((key: string) => {
    setHfTokenState(key);
    if (key) setHfToken(key); // Persist to localStorage
  }, []);

  // Object selection mode
  const [objectMode, setObjectMode] = useState<'choose' | 'library' | 'photo'>('choose');

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<{ intervalId: ReturnType<typeof setInterval> } | null>(null);
  const recordedFramesRef = useRef<{ timestamp: number; jointPositions: number[] }[]>([]);

  // Store
  const { joints, selectedRobotId, spawnObject, objects, messages, isLLMLoading, isAnimating } = useAppStore();

  // Chat
  const { sendMessage } = useLLMChat();
  const [chatInput, setChatInput] = useState('');
  const [hasClaudeKey, setHasClaudeKey] = useState(!!getClaudeApiKey());
  const [claudeKeyInput, setClaudeKeyInput] = useState('');

  // Demo mode
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Task type for batch demos
  type TaskType = 'pickup' | 'stack' | 'place';
  const [selectedTask, setSelectedTask] = useState<TaskType>('pickup');

  // Upgrade prompt
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // LLM prompt debug display
  const [currentLLMPrompt, setCurrentLLMPrompt] = useState<string | null>(null);
  const [currentLLMResponse, setCurrentLLMResponse] = useState<string | null>(null);
  const [showPromptDebug, setShowPromptDebug] = useState(false);
  const [demoResults, setDemoResults] = useState<Array<{ demo: number; prompt: string; response: string; success: boolean }>>([]);

  // Abort controller for cancelling demos
  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check backend on mount
  useEffect(() => {
    isBackendAPIAvailable().then(setBackendAvailable);
  }, []);

  // Cleanup on unmount - abort any running demos
  useEffect(() => {
    return () => {
      abortRef.current.aborted = true;
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    };
  }, []);

  // Get joint positions (must be before handleChatSend which uses it)
  const getJointPositions = useCallback((): number[] => {
    return [joints.base, joints.shoulder, joints.elbow, joints.wrist, joints.wristRoll, joints.gripper];
  }, [joints]);

  // Handle chat send
  const handleChatSend = useCallback(() => {
    log.debug('handleChatSend called', {
      chatInput: chatInput.trim(),
      isLLMLoading,
      isRecording,
      objectCount: objects.length
    });

    if (chatInput.trim() && !isLLMLoading) {
      // Auto-spawn a cube if no graspable objects exist
      const graspableObjects = objects.filter(o => o.isGrabbable);
      if (graspableObjects.length === 0) {
        log.debug('No graspable objects - spawning default cube');
        const cubeTemplate = PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-red');
        if (cubeTemplate) {
          const newCube = createSimObjectFromTemplate(cubeTemplate, [0.17, 0.02, 0]);
          const { id, ...objWithoutId } = newCube;
          spawnObject({ ...objWithoutId, name: 'Red Cube', scale: 0.03 });
        }
      }

      // Start recording when sending a command
      if (!isRecording) {
        log.debug('Starting recording');
        setIsRecording(true);
        recordedFramesRef.current = [];
        const startTime = Date.now();
        const interval = setInterval(() => {
          recordedFramesRef.current.push({
            timestamp: Date.now() - startTime,
            jointPositions: getJointPositions(),
          });
        }, 33);
        recorderRef.current = { intervalId: interval };
      }

      log.debug('Sending message to LLM', { message: chatInput.trim() });
      sendMessage(chatInput.trim());
      setChatInput('');
    } else {
      log.debug('Chat send blocked', {
        emptyInput: !chatInput.trim(),
        isLoading: isLLMLoading
      });
    }
  }, [chatInput, isLLMLoading, isRecording, sendMessage, getJointPositions, objects, spawnObject]);

  // Auto-stop recording when robot stops moving after a command
  useEffect(() => {
    if (isRecording && !isAnimating && !isLLMLoading && recordedFramesRef.current.length > 30) {
      // Wait a moment to ensure the animation is truly complete
      const timeout = setTimeout(() => {
        if (!isAnimating) {
          // Stop recording and save episode
          setIsRecording(false);
          if (recorderRef.current) {
            clearInterval(recorderRef.current.intervalId);
          }

          if (recordedFramesRef.current.length > 10) {
            const frames: Frame[] = recordedFramesRef.current.map((f, i) => ({
              timestamp: f.timestamp,
              observation: { jointPositions: f.jointPositions },
              action: { jointTargets: f.jointPositions, gripper: f.jointPositions[5] },
              done: i === recordedFramesRef.current.length - 1,
            }));

            const duration = recordedFramesRef.current.length > 0
              ? (recordedFramesRef.current[recordedFramesRef.current.length - 1].timestamp - recordedFramesRef.current[0].timestamp) / 1000
              : 0;

            const episode: Episode = {
              episodeId: state.demoEpisodes.length,
              frames,
              metadata: {
                robotType: 'arm',
                robotId: selectedRobotId,
                task: `pick_${state.objectName}`,
                languageInstruction: `Pick up the ${state.objectName}`,
                duration,
                frameCount: frames.length,
                recordedAt: new Date().toISOString(),
              },
            };

            const quality = calculateQualityMetrics(recordedFramesRef.current);

            setState(s => ({
              ...s,
              demoEpisodes: [...s.demoEpisodes, episode],
              demoQuality: [...s.demoQuality, quality],
            }));
          }

          recordedFramesRef.current = [];
        }
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [isRecording, isAnimating, isLLMLoading, state.demoEpisodes.length, state.objectName, selectedRobotId]);

  // Save Claude API key (persist to localStorage)
  const handleSaveClaudeKey = useCallback(() => {
    if (claudeKeyInput.trim()) {
      setClaudeApiKey(claudeKeyInput.trim(), true); // true = persist to storage
      setHasClaudeKey(true);
      setClaudeKeyInput('');
    }
  }, [claudeKeyInput]);

  // Demo pick up - one-click test
  // Note: Works without API key using built-in simulation mode
  const handleDemoPickUp = useCallback(async () => {
    if (isDemoRunning || isAnimating || isLLMLoading) return;

    setIsDemoRunning(true);
    setError(null);

    try {
      // Step 1: Clear existing objects and reset arm
      setDemoStatus('Resetting scene...');
      const { clearObjects, setJoints } = useAppStore.getState();
      clearObjects();

      // Reset arm to home position
      setJoints({
        base: 0,
        shoulder: 0,
        elbow: 0,
        wrist: 0,
        wristRoll: 0,
        gripper: 100, // Open
      });

      await new Promise(r => setTimeout(r, 500));

      // Step 2: Spawn a cube for demo - sized for reliable gripper pickup
      setDemoStatus('Adding cube...');
      const cubeTemplate = PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-red');
      if (!cubeTemplate) throw new Error('Cube template not found');

      // Use 3cm cube - smaller for more realistic grip
      // Gripper max opening is ~6cm, so 3cm gives plenty of margin
      const demoScale = 0.03; // 3cm cube

      // Position cube to match user's arm config (base=5, shoulder=-22, elbow=51, wrist=63)
      // From user's screenshot: cube at [16, 2, 1]cm
      const x = 0.16;   // 16cm forward
      const z = 0.01;   // 1cm to side (matches base=5°)
      const y = 0.02;   // 2cm up (slightly above ground for 3cm cube)

      const newObject = createSimObjectFromTemplate(cubeTemplate, [x, y, z]);
      const { id, ...objWithoutId } = newObject;
      // Override scale to make cube larger for demo
      spawnObject({ ...objWithoutId, name: 'Demo Cube (Red)', scale: demoScale });

      setState(s => ({ ...s, objectName: 'Demo Cube (Red)', objectPlaced: true }));
      setStep('record-demo');

      // Wait for physics to settle - longer wait ensures object is stable
      await new Promise(r => setTimeout(r, 1500));

      // Step 3: Execute direct pick sequence using IK
      setDemoStatus('Picking up cube...');

      const currentJoints = useAppStore.getState().joints;

      // Time-based smooth move using setTimeout for reliability in headless browsers
      // requestAnimationFrame can be throttled in headless mode, causing infinite waits
      const smoothMove = async (targetJoints: Partial<typeof currentJoints>, durationMs: number) => {
        const startJoints = { ...useAppStore.getState().joints };
        const startTime = Date.now();
        const frameInterval = 16; // ~60fps

        return new Promise<void>((resolve) => {
          const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);

            // Ease-in-out cubic for natural motion
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

            const interpolated: Partial<typeof currentJoints> = {};
            for (const key of Object.keys(targetJoints) as (keyof typeof targetJoints)[]) {
              const start = startJoints[key];
              const end = targetJoints[key];
              if (typeof start === 'number' && typeof end === 'number') {
                interpolated[key] = start + (end - start) * ease;
              }
            }
            setJoints(interpolated);

            if (t < 1) {
              // Always use setTimeout for reliable timing in all browser contexts
              setTimeout(animate, frameInterval);
            } else {
              setJoints(targetJoints);
              resolve();
            }
          };
          animate();
        });
      };

      // Calculate base angle to point arm toward cube: atan2(z, x) for URDF convention
      // Based on testing: at base=0 arm extends along +X, base rotates toward +Z
      const baseAngle = Math.atan2(z, x) * (180 / Math.PI);
      log.debug(`Cube at [${(x*100).toFixed(1)}, ${(y*100).toFixed(1)}, ${(z*100).toFixed(1)}]cm, base angle: ${baseAngle.toFixed(1)}°`);

      // Cube is at [20, 1.5, 0]cm - positioned for vertical top-down approach
      // Based on testing: shoulder=10, elbow=96, wrist=-85 gives [23, 2.7]
      // Need to adjust to reach X=20cm - try higher elbow for more fold

      // SIMPLE 3-MOVE SEQUENCE (user's exact config):
      // Move 1: Open gripper + position at cube
      await smoothMove({ base: 5, shoulder: -22, elbow: 51, wrist: 63, wristRoll: 90, gripper: 100 }, 800);
      
      // Move 2: Close gripper (slower for physics collision detection)
      await smoothMove({ gripper: 0 }, 800);
      
      // Move 3: Lift with wrist at 45 degrees
      await smoothMove({ base: 5, shoulder: -50, elbow: 30, wrist: 45, wristRoll: 90, gripper: 0 }, 700);

      setDemoStatus('Done!');
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setIsDemoRunning(false);
      setDemoStatus(null);
    }
  }, [isDemoRunning, isAnimating, isLLMLoading, spawnObject]);

  // Batch generate demos for training data
  // Uses proven pickup configuration matching handleDemoPickUp (x=0.16, z=0.01)
  const handleBatchDemos = useCallback(async (taskType: 'pickup' | 'stack' | 'place' = 'pickup') => {
    if (isDemoRunning || isAnimating || isLLMLoading) {
      console.log('[BatchDemo] Blocked - already running:', { isDemoRunning, isAnimating, isLLMLoading });
      return;
    }

    console.log(`[BatchDemo] Task type: ${taskType}`);

    // Check usage limits
    const tier = useAuthStore.getState().getTier();
    const { canRunDemos, getDemosRemaining, resetIfNewDay } = useUsageStore.getState();
    resetIfNewDay(); // Reset counter if new day

    if (!canRunDemos(tier)) {
      const remaining = getDemosRemaining(tier);
      console.log(`[BatchDemo] Usage limit reached - ${remaining} demos remaining today`);
      setError(`Daily limit reached (${TIER_LIMITS[tier].demos_per_day} demos/day). Upgrade to Pro for unlimited demos.`);
      setShowUpgradePrompt(true);
      return;
    }

    // Reset abort flag at start
    abortRef.current.aborted = false;

    const demoScale = 0.03; // 3cm cube

    console.log(`[BatchDemo] ========== STARTING ${BATCH_COUNT} DEMOS ==========`);
    console.log('[BatchDemo] Cube scale:', demoScale, '(3cm)');
    console.log(`[BatchDemo] Tier: ${tier}, Demos remaining: ${getDemosRemaining(tier)}`);

    // Check WebGL context health before starting - wait for recovery if needed
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (canvas) {
      let attempts = 0;
      const maxAttempts = 5;
      while (attempts < maxAttempts) {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl && !gl.isContextLost()) {
          console.log('[BatchDemo] WebGL context healthy ✓');
          break;
        }
        attempts++;
        console.warn(`[BatchDemo] WebGL context lost, waiting for recovery (attempt ${attempts}/${maxAttempts})...`);
        await new Promise(r => setTimeout(r, 1500));
      }
      if (attempts >= maxAttempts) {
        console.error('[BatchDemo] WebGL context not recovered after max attempts');
        setError('WebGL not available. Try refreshing the page.');
        setIsDemoRunning(false);
        return;
      }
    }

    // Brief startup delay to let rendering settle after any context recovery
    console.log('[BatchDemo] Startup delay 800ms...');
    await new Promise(r => setTimeout(r, 800));

    // Check for Claude API key - required for LLM-driven demos
    const claudeApiKey = getClaudeApiKey();
    if (!claudeApiKey) {
      console.error('[BatchDemo] No Claude API key found - LLM-driven demos require an API key');
      setError('Claude API key required for AI-driven demos. Add your key in Settings.');
      setIsDemoRunning(false);
      return;
    }
    console.log('[BatchDemo] Claude API key found ✓');

    // Varied natural language prompts for realistic training data
    // Prompt generator based on task type - includes coordinates for place task
    const getObjectPrompt = (
      type: string,
      color: string,
      task: string,
      objectPos: { x: number; z: number },
      secondObj?: { type: string; color: string },
      targetZone?: TargetZone
    ): string => {
      if (task === 'pickup') {
        const templates = [
          `pick up the ${color} ${type}`,
          `grab the ${color} ${type}`,
          `grasp the ${type}`,
          `pick up that ${type}`,
          `grab the ${type} on the table`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      } else if (task === 'stack' && secondObj) {
        const templates = [
          `stack the ${color} ${type} on the ${secondObj.color} ${secondObj.type}`,
          `put the ${type} on top of the ${secondObj.type}`,
          `place the ${color} ${type} on the ${secondObj.color} ${secondObj.type}`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      } else if (task === 'place' && targetZone) {
        // Include specific coordinates for place task - this helps LLM accuracy significantly
        const srcX = (objectPos.x * 100).toFixed(0);
        const srcZ = (objectPos.z * 100).toFixed(0);
        const tgtX = (targetZone.position[0] * 100).toFixed(0);
        const tgtZ = (targetZone.position[2] * 100).toFixed(0);
        const templates = [
          `pick up the ${color} ${type} at [${srcX}, 2, ${srcZ}]cm and place it at the ${targetZone.id} zone [${tgtX}, 2, ${tgtZ}]cm`,
          `move the ${color} ${type} from [${srcX}, 2, ${srcZ}]cm to ${targetZone.description} at [${tgtX}, 2, ${tgtZ}]cm`,
          `grab the ${type} and put it on the ${targetZone.id} at position [${tgtX}, 2, ${tgtZ}]cm`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      return `pick up the ${color} ${type}`;
    };

    // Generate varied positions with x from 0.16-0.195 (tested reliable range)
    // Z range ±3cm for wider lateral coverage
    // Positions distributed across the expanded workspace
    const positions: Array<{ x: number; z: number }> = [
      { x: 0.16, z: 0.00 },    // Near center
      { x: 0.17, z: 0.02 },    // Mid-near right
      { x: 0.18, z: -0.02 },   // Mid left
      { x: 0.19, z: 0.01 },    // Mid-far slight right
      { x: 0.195, z: 0.00 },   // Far center
      { x: 0.16, z: -0.03 },   // Near far left
      { x: 0.17, z: 0.03 },    // Mid-near far right
      { x: 0.18, z: 0.00 },    // Mid center
      { x: 0.19, z: -0.02 },   // Mid-far left
      { x: 0.195, z: 0.015 },  // Far slight right
      { x: 0.16, z: 0.015 },   // Near slight right
      { x: 0.17, z: -0.015 },  // Mid-near slight left
      { x: 0.18, z: 0.025 },   // Mid right
      { x: 0.19, z: -0.01 },   // Mid-far slight left
      { x: 0.195, z: -0.02 },  // Far left
    ];

    setIsDemoRunning(true);
    setError(null);
    setBatchProgress({ current: 0, total: BATCH_COUNT });
    setDemoResults([]); // Clear previous demo results
    setCurrentLLMPrompt(null);
    setCurrentLLMResponse(null);

    const collectedEpisodes: Episode[] = [];
    const collectedQuality: ReturnType<typeof calculateQualityMetrics>[] = [];

    // Get store methods for animation
    const { clearObjects, setJoints } = useAppStore.getState();

    // Helper for abortable delay
    const delay = (ms: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const checkAbort = () => {
          if (abortRef.current.aborted) {
            resolve(false);
          } else {
            resolve(true);
          }
        };
        setTimeout(checkAbort, ms);
      });
    };

    /**
     * Execute a sequence of waypoints as a single continuous trajectory
     * Uses Catmull-Rom splines for velocity-preserving interpolation
     * Special handling for gripper: holds during approach, closes at grasp point
     */
    const smoothMoveSequence = async (
      waypoints: Array<{ base: number; shoulder: number; elbow: number; wrist: number; wristRoll: number; gripper: number }>,
      totalDurationMs: number,
      graspWaypointIndex: number, // Index where gripper should close (usually 2 for 4-step sequence)
      graspDwellMs: number, // Extra time to dwell at grasp position for physics
      recordTo: { timestamp: number; jointPositions: number[]; image?: string }[],
      recordStartTime: number,
      label: string,
      augmentConfig?: AugmentationConfig
    ): Promise<boolean> => {
      if (abortRef.current.aborted) return false;

      // Convert waypoints to arrays for interpolation
      const waypointArrays = waypoints.map(w => [w.base, w.shoulder, w.elbow, w.wrist, w.wristRoll, w.gripper]);

      // Split trajectory into phases:
      // Phase 1: Start to grasp position (gripper open)
      // Phase 2: Dwell at grasp + close gripper
      // Phase 3: Grasp to end (gripper closed)
      const phase1Duration = (graspWaypointIndex / (waypoints.length - 1)) * totalDurationMs;
      const phase3Duration = ((waypoints.length - 1 - graspWaypointIndex) / (waypoints.length - 1)) * totalDurationMs;
      const totalTime = phase1Duration + graspDwellMs + phase3Duration;

      const startTime = Date.now();
      let lastImageCapture = 0;
      const IMAGE_CAPTURE_INTERVAL = 100;
      const capturedImagesMap: Map<number, string> = new Map();

      console.log(`[BatchDemo] smoothMoveSequence(${label}) START - total=${totalTime.toFixed(0)}ms (motion=${totalDurationMs}ms + dwell=${graspDwellMs}ms)`);

      // Generate synthetic frames at 30fps
      const recordInterval = 33;
      const numFrames = Math.ceil(totalTime / recordInterval);
      for (let f = 0; f <= numFrames; f++) {
        const t = f / numFrames;
        const elapsed = t * totalTime;

        let frameJoints: number[];
        if (elapsed <= phase1Duration) {
          // Phase 1: Moving to grasp position (gripper stays open)
          const phase1T = phase1Duration > 0 ? elapsed / phase1Duration : 1;
          const trajectoryT = phase1T * (graspWaypointIndex / (waypoints.length - 1));
          frameJoints = interpolateWaypoints(waypointArrays, trajectoryT);
          frameJoints[5] = waypoints[0].gripper; // Keep gripper open
        } else if (elapsed <= phase1Duration + graspDwellMs) {
          // Phase 2: Dwell at grasp position, close gripper
          const dwellT = (elapsed - phase1Duration) / graspDwellMs;
          const graspPos = waypointArrays[graspWaypointIndex];
          frameJoints = [...graspPos];
          // Interpolate gripper from open to closed
          const openGripper = waypoints[graspWaypointIndex - 1]?.gripper ?? 100;
          const closedGripper = waypoints[graspWaypointIndex].gripper;
          frameJoints[5] = openGripper + (closedGripper - openGripper) * dwellT;
        } else {
          // Phase 3: Lifting (gripper closed)
          const phase3T = phase3Duration > 0 ? (elapsed - phase1Duration - graspDwellMs) / phase3Duration : 1;
          const startT = graspWaypointIndex / (waypoints.length - 1);
          const trajectoryT = startT + phase3T * (1 - startT);
          frameJoints = interpolateWaypoints(waypointArrays, trajectoryT);
          frameJoints[5] = waypoints[graspWaypointIndex].gripper; // Keep gripper closed
        }

        recordTo.push({
          timestamp: recordStartTime > 0 ? (startTime - recordStartTime) + (f * recordInterval) : f * recordInterval,
          jointPositions: frameJoints,
        });
      }

      // Animate visually
      return new Promise<boolean>((resolve) => {
        let rafId: number | null = null;

        const animate = () => {
          if (abortRef.current.aborted) {
            if (rafId) cancelFrame(rafId);
            resolve(false);
            return;
          }

          const now = Date.now();
          const elapsed = now - startTime;
          const t = Math.min(1, elapsed / totalTime);

          let currentJoints: number[];
          if (elapsed <= phase1Duration) {
            // Phase 1: Moving to grasp
            const phase1T = phase1Duration > 0 ? elapsed / phase1Duration : 1;
            const trajectoryT = phase1T * (graspWaypointIndex / (waypoints.length - 1));
            currentJoints = interpolateWaypoints(waypointArrays, trajectoryT);
            currentJoints[5] = waypoints[0].gripper;
          } else if (elapsed <= phase1Duration + graspDwellMs) {
            // Phase 2: Dwell + close gripper
            const dwellT = (elapsed - phase1Duration) / graspDwellMs;
            const graspPos = waypointArrays[graspWaypointIndex];
            currentJoints = [...graspPos];
            const openGripper = waypoints[graspWaypointIndex - 1]?.gripper ?? 100;
            const closedGripper = waypoints[graspWaypointIndex].gripper;
            currentJoints[5] = openGripper + (closedGripper - openGripper) * dwellT;
          } else {
            // Phase 3: Lifting
            const phase3T = phase3Duration > 0 ? (elapsed - phase1Duration - graspDwellMs) / phase3Duration : 1;
            const startT = graspWaypointIndex / (waypoints.length - 1);
            const trajectoryT = startT + phase3T * (1 - startT);
            currentJoints = interpolateWaypoints(waypointArrays, trajectoryT);
            currentJoints[5] = waypoints[graspWaypointIndex].gripper;
          }

          setJoints({
            base: currentJoints[0],
            shoulder: currentJoints[1],
            elbow: currentJoints[2],
            wrist: currentJoints[3],
            wristRoll: currentJoints[4],
            gripper: currentJoints[5],
          });

          // Capture images at 10Hz
          const timeSinceLastCapture = now - lastImageCapture;
          if (timeSinceLastCapture >= IMAGE_CAPTURE_INTERVAL || lastImageCapture === 0) {
            const demoCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
            if (demoCanvas) {
              const captured = captureFromCanvas(demoCanvas, 'overhead');
              if (captured && captured.imageData.length > 100) {
                const relativeTimestamp = now - recordStartTime;
                if (augmentConfig) {
                  applyAugmentations(captured.imageData, augmentConfig).then(augmented => {
                    capturedImagesMap.set(relativeTimestamp, augmented);
                  }).catch(() => {
                    capturedImagesMap.set(relativeTimestamp, captured.imageData);
                  });
                } else {
                  capturedImagesMap.set(relativeTimestamp, captured.imageData);
                }
              }
            }
            lastImageCapture = now;
          }

          if (t < 1) {
            rafId = scheduleFrame(animate);
          } else {
            // Attach images to nearest frames
            for (const [imgTimestamp, imgData] of capturedImagesMap) {
              let closestIdx = 0;
              let closestDiff = Infinity;
              for (let i = 0; i < recordTo.length; i++) {
                const diff = Math.abs(recordTo[i].timestamp - imgTimestamp);
                if (diff < closestDiff) {
                  closestDiff = diff;
                  closestIdx = i;
                }
              }
              if (closestDiff < 50 && !recordTo[closestIdx].image) {
                recordTo[closestIdx].image = imgData;
              }
            }

            const actualElapsed = Date.now() - startTime;
            console.log(`[BatchDemo] smoothMoveSequence(${label}) DONE - actual=${actualElapsed}ms (expected ${totalTime.toFixed(0)}ms), captured ${capturedImagesMap.size} images`);
            resolve(true);
          }
        };

        rafId = scheduleFrame(animate);
      });
    };

    try {
      // Object templates for variety - cubes, balls, cylinders
      const objectTemplates = [
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-red')!, type: 'cube', color: 'red' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-blue')!, type: 'cube', color: 'blue' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-green')!, type: 'cube', color: 'green' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-ball-red')!, type: 'ball', color: 'red' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-ball-blue')!, type: 'ball', color: 'blue' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-ball-green')!, type: 'ball', color: 'green' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cylinder-yellow')!, type: 'cylinder', color: 'yellow' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cylinder-purple')!, type: 'cylinder', color: 'purple' },
        { template: PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cylinder-orange')!, type: 'cylinder', color: 'orange' },
      ].filter(o => o.template); // Filter out any missing templates

      if (objectTemplates.length === 0) throw new Error('No object templates found');

      for (let i = 0; i < BATCH_COUNT; i++) {
        // Check for abort at start of each demo
        if (abortRef.current.aborted) {
          console.log('[BatchDemo] ABORTED by user');
          break;
        }

        console.log(`[BatchDemo] ========== DEMO ${i+1}/${BATCH_COUNT} ==========`);
        setBatchProgress({ current: i + 1, total: BATCH_COUNT });
        setDemoStatus(`Demo ${i + 1}/${BATCH_COUNT}...`);

        // Visual randomization
        const visualConfig = randomizeVisualsForEpisode();
        console.log(`[BatchDemo] Demo ${i+1} - Visual randomization:`, {
          lighting: visualConfig.domain.lighting.keyLightIntensity.toFixed(2),
          floor: visualConfig.texture.floor.type,
          distractors: visualConfig.distractors.length,
        });

        // Image augmentation config for sim-to-real transfer
        // Consistent per episode: same noise/blur/brightness for all frames
        const episodeAugment = randomAugmentationConfig();
        console.log(`[BatchDemo] Demo ${i+1} - Image augmentation:`, {
          noise: episodeAugment.noiseSigma?.toFixed(1),
          blur: episodeAugment.motionBlurStrength?.toFixed(1),
          brightness: episodeAugment.brightnessVariation?.toFixed(1),
          contrast: episodeAugment.contrastVariation?.toFixed(2),
        });

        // Clear scene and reset arm
        console.log(`[BatchDemo] Demo ${i+1} - Clearing scene and resetting arm to home`);
        clearObjects();
        setJoints({ base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 });
        if (!await delay(500)) break;

        // Select random object type for variety
        // For stack and place tasks, only use cubes (balls roll, cylinders are tricky to place)
        const cubesOnly = objectTemplates.filter(o => o.type === 'cube');
        const templatePool = (taskType === 'stack' || taskType === 'place') ? cubesOnly : objectTemplates;

        // For place task, select a target zone
        const zoneKeys = Object.keys(TARGET_ZONES) as Array<'left' | 'center' | 'right'>;
        const selectedZone = TARGET_ZONES[zoneKeys[i % zoneKeys.length]];

        const objChoice = templatePool[i % templatePool.length];
        const objectTemplate = objChoice.template;
        const objectType = objChoice.type;
        const objectColor = objChoice.color;
        const objectName = `${objectColor.charAt(0).toUpperCase() + objectColor.slice(1)} ${objectType.charAt(0).toUpperCase() + objectType.slice(1)}`;

        // For stack task, we need a second cube (different color)
        let secondObj: { type: string; color: string; template: ObjectTemplate } | undefined;
        if (taskType === 'stack') {
          // Pick a different colored cube for the base
          const baseChoice = cubesOnly[(i + 2) % cubesOnly.length]; // Offset to get different color
          secondObj = { type: baseChoice.type, color: baseChoice.color, template: baseChoice.template };
        }

        // Spawn object(s) at varied positions
        const pos = positions[i % positions.length];
        // Y position depends on object type (balls and cylinders need different heights)
        const y = objectType === 'cylinder' ? 0.03 : 0.02;
        console.log(`[BatchDemo] Demo ${i+1} - Spawning ${objectName} at [${(pos.x*100).toFixed(1)}, ${(y*100).toFixed(1)}, ${(pos.z*100).toFixed(1)}]cm`);
        const newObject = createSimObjectFromTemplate(objectTemplate, [pos.x, y, pos.z]);
        const { id, ...objWithoutId } = newObject;
        spawnObject({ ...objWithoutId, name: `${objectName} ${i + 1}`, scale: demoScale });

        // For stack task, spawn a second cube (the base) nearby
        if (taskType === 'stack' && secondObj) {
          const baseY = 0.02; // Cubes only
          const basePos = { x: pos.x + 0.04, z: pos.z }; // 4cm to the right
          console.log(`[BatchDemo] Demo ${i+1} - Spawning base ${secondObj.color} cube at [${(basePos.x*100).toFixed(1)}, ${(baseY*100).toFixed(1)}, ${(basePos.z*100).toFixed(1)}]cm`);
          const baseObject = createSimObjectFromTemplate(secondObj.template, [basePos.x, baseY, basePos.z]);
          const { id: baseId, ...baseWithoutId } = baseObject;
          spawnObject({ ...baseWithoutId, name: `Base ${secondObj.color} Cube ${i + 1}`, scale: demoScale });
        }

        // Wait for physics to settle
        console.log(`[BatchDemo] Demo ${i+1} - Waiting 1500ms for physics to settle`);
        if (!await delay(1500)) break;

        // Start recording - frames are captured during smoothMove animations
        const recordStartTime = Date.now();
        const recordedFrames: { timestamp: number; jointPositions: number[]; image?: string }[] = [];

        // Get canvas for this demo (query fresh each time to ensure it's available)
        const demoCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;

        // Capture initial scene image (cube in place, arm at home)
        let initialImage: string | undefined;
        if (demoCanvas) {
          const captured = captureFromCanvas(demoCanvas, 'overhead');
          if (captured && captured.imageData.length > 100) {
            initialImage = captured.imageData;
          }
        }

        try {
          // Select a varied natural language prompt for this demo based on task type
          const prompt = getObjectPrompt(objectType, objectColor, taskType, pos, secondObj, selectedZone);
          console.log(`[BatchDemo] Demo ${i+1} - Task: ${taskType}, LLM Prompt: "${prompt}"`);
          if (taskType === 'place') {
            console.log(`[BatchDemo] Demo ${i+1} - Target zone: ${selectedZone.id} at [${(selectedZone.position[0]*100).toFixed(0)}, ${(selectedZone.position[1]*100).toFixed(0)}, ${(selectedZone.position[2]*100).toFixed(0)}]cm`);
          }

          // Update UI with current prompt for debugging
          setCurrentLLMPrompt(prompt);

          // Build full robot state for LLM context
          const currentJoints = useAppStore.getState().joints;
          const currentObjects = useAppStore.getState().objects;
          const fullState: FullRobotState = {
            joints: currentJoints,
            wheeledRobot: {
              leftWheelSpeed: 0,
              rightWheelSpeed: 0,
              position: { x: 0, y: 0, z: 0 },
              heading: 0,
              velocity: 0,
              angularVelocity: 0,
              servoHead: 0,
            },
            drone: {
              throttle: 0,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              velocity: { x: 0, y: 0, z: 0 },
              armed: false,
              flightMode: 'stabilize',
              motorsRPM: [0, 0, 0, 0],
            },
            humanoid: {
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              leftHipPitch: 0, leftHipRoll: 0, leftHipYaw: 0,
              leftKnee: 0, leftAnklePitch: 0, leftAnkleRoll: 0,
              rightHipPitch: 0, rightHipRoll: 0, rightHipYaw: 0,
              rightKnee: 0, rightAnklePitch: 0, rightAnkleRoll: 0,
              leftShoulderPitch: 0, leftShoulderRoll: 0, leftShoulderYaw: 0,
              leftElbow: 0, leftWrist: 0,
              rightShoulderPitch: 0, rightShoulderRoll: 0, rightShoulderYaw: 0,
              rightElbow: 0, rightWrist: 0,
              isWalking: false, walkPhase: 0, balance: { x: 0, z: 0 },
            },
            sensors: {},
            isAnimating: false,
            objects: currentObjects,
          };

          // For place task, use template-based sequences for reliability
          // LLM can be used for pickup but place needs precise target positioning
          let jointSequence: Partial<JointState>[];
          let llmResponseDesc = '';

          if (taskType === 'place') {
            // Use template-based place sequence (more reliable than LLM)
            console.log(`[BatchDemo] Demo ${i+1} - Using TEMPLATE-based place (LLM-free for reliability)`);
            const objPosArray: [number, number, number] = [pos.x, y, pos.z];
            jointSequence = generatePlaceSequence(objPosArray, selectedZone.id, objectType as 'cube' | 'cylinder');
            llmResponseDesc = `Template: Pick from [${(pos.x*100).toFixed(0)}, ${(pos.z*100).toFixed(0)}]cm, place at ${selectedZone.id}`;
            setCurrentLLMResponse(`[Template-Based] ${llmResponseDesc}`);
            console.log(`[BatchDemo] Demo ${i+1} - Generated ${jointSequence.length} template waypoints`);
          } else {
            // Call Claude API for pickup/stack tasks
            console.log(`[BatchDemo] Demo ${i+1} - Calling Claude API...`);
            const llmStartTime = Date.now();
            let llmResponse: ClaudeResponse;
            try {
              llmResponse = await callClaudeAPI(
                prompt,
                'arm',
                fullState,
                claudeApiKey,
                [], // No conversation history needed
                { forceRealAPI: true }
              );
            } catch (apiError) {
              console.error(`[BatchDemo] Demo ${i+1} - API Error:`, apiError);
              throw apiError;
            }
            const llmDuration = Date.now() - llmStartTime;
            llmResponseDesc = llmResponse.description || 'No description';
            console.log(`[BatchDemo] Demo ${i+1} - LLM Response in ${llmDuration}ms:`, llmResponse.action, llmResponseDesc);
            setCurrentLLMResponse(`[LLM] ${llmResponseDesc}`);

            // Extract joint sequence from LLM response
            if (!llmResponse.joints) {
              console.error(`[BatchDemo] Demo ${i+1} - No joints in LLM response`);
              throw new Error('LLM did not return joint commands');
            }

            // Handle both single joint object and sequence array
            jointSequence = Array.isArray(llmResponse.joints)
              ? llmResponse.joints
              : [llmResponse.joints];
          }

          console.log(`[BatchDemo] Demo ${i+1} - Executing ${jointSequence.length} waypoints as continuous trajectory`);

          // Find the grasp waypoint (where gripper closes)
          let graspWaypointIndex = jointSequence.findIndex(step => step.gripper !== undefined && step.gripper < 50);
          if (graspWaypointIndex < 0) graspWaypointIndex = Math.floor(jointSequence.length / 2); // Default to middle

          // Convert to full waypoints with all joint values
          const homeJoints = { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 90, gripper: 100 };
          const waypoints = jointSequence.map(step => ({
            base: step.base ?? homeJoints.base,
            shoulder: step.shoulder ?? homeJoints.shoulder,
            elbow: step.elbow ?? homeJoints.elbow,
            wrist: step.wrist ?? homeJoints.wrist,
            wristRoll: step.wristRoll ?? homeJoints.wristRoll,
            gripper: step.gripper ?? homeJoints.gripper,
          }));

          // Execute as single continuous trajectory
          // Total motion duration ~2.5s, with 500ms dwell at grasp for physics detection
          const motionDuration = 2500; // Total motion time (excluding dwell)
          const graspDwell = 500; // Dwell time at grasp for physics
          if (!await smoothMoveSequence(
            waypoints,
            motionDuration,
            graspWaypointIndex,
            graspDwell,
            recordedFrames,
            recordStartTime,
            `Demo${i+1}`,
            episodeAugment
          )) break;

          // Brief pause to verify grasp (reduced from 300ms)
          console.log(`[BatchDemo] Demo ${i+1} - Pause 150ms to verify grasp`);
          if (!await delay(150)) break;

          // Capture final lift image
          let liftImage: string | undefined;
          if (demoCanvas) {
            const captured = captureFromCanvas(demoCanvas, 'overhead');
            if (captured && captured.imageData.length > 100) {
              liftImage = captured.imageData;
            }
          }

          const graspCheckObjects = useAppStore.getState().objects;
          // Find the target object (could be cube, ball, or cylinder)
          const targetObj = graspCheckObjects.find(o => o.isGrabbable);
          const objY = targetObj?.position?.[1] ?? 0;
          const graspSuccess = objY > 0.05;
          console.log(`[BatchDemo] Demo ${i+1} - GRASP CHECK: ${objectName} Y=${(objY*100).toFixed(1)}cm, success=${graspSuccess ? 'YES ✓' : 'NO ✗'}`);

          // Track result for debug panel
          setDemoResults(prev => [...prev, {
            demo: i + 1,
            prompt,
            response: llmResponseDesc,
            success: graspSuccess,
          }]);

          // Count images attached during smoothMove animation (at 10Hz)
          const framesWithImages = recordedFrames.filter(f => f.image).length;
          console.log(`[BatchDemo] Demo ${i+1} - Recorded ${recordedFrames.length} frames, ${framesWithImages} frames with images (10Hz)`);

          // Create episode from recorded frames - images already attached by smoothMove at 10Hz
          if (recordedFrames.length > 10) {
            // Ensure first frame has initial image if not already set
            if (!recordedFrames[0].image && initialImage) {
              recordedFrames[0].image = initialImage;
            }
            // Ensure last frame has lift image if not already set
            if (!recordedFrames[recordedFrames.length - 1].image && liftImage) {
              recordedFrames[recordedFrames.length - 1].image = liftImage;
            }

            const frames: Frame[] = recordedFrames.map((f, idx) => {
              return {
                timestamp: f.timestamp,
                observation: {
                  jointPositions: f.jointPositions,
                  image: f.image, // Use image attached by smoothMove at 10Hz
                },
                action: { jointTargets: f.jointPositions, gripper: f.jointPositions[5] },
                done: idx === recordedFrames.length - 1,
              };
            });

            const duration = (recordedFrames[recordedFrames.length - 1].timestamp - recordedFrames[0].timestamp) / 1000;

            const episode: Episode = {
              episodeId: collectedEpisodes.length,
              frames,
              metadata: {
                robotType: 'arm',
                robotId: selectedRobotId,
                task: 'pick_object',
                languageInstruction: `Pick up the ${objectName} at [${(pos.x*100).toFixed(0)}, 2, ${(pos.z*100).toFixed(0)}]cm`,
                duration,
                frameCount: frames.length,
                recordedAt: new Date().toISOString(),
                success: graspSuccess,
              },
            };

            const quality = calculateQualityMetrics(recordedFrames);
            collectedEpisodes.push(episode);
            collectedQuality.push(quality);
            console.log(`[BatchDemo] Demo ${i+1} - EPISODE SAVED: ${frames.length} frames, duration=${duration.toFixed(2)}s, quality=${quality.overallScore}`);
          } else {
            console.log(`[BatchDemo] Demo ${i+1} - SKIPPED: only ${recordedFrames.length} frames (need >10)`);
          }

        } catch (demoError) {
          console.error(`[BatchDemo] Demo ${i+1} - ERROR:`, demoError);
          // Continue to next demo
        }

        // Brief pause between demos
        console.log(`[BatchDemo] Demo ${i+1} - COMPLETE. Pausing 500ms before next demo...`);
        console.log(`[BatchDemo] ----------------------------------------`);
        if (!await delay(500)) break;
      }

      // Only save if we collected episodes and weren't aborted
      if (collectedEpisodes.length > 0 && !abortRef.current.aborted) {
        console.log(`[BatchDemo] ========== ALL DEMOS COMPLETE ==========`);
        console.log(`[BatchDemo] Total episodes collected: ${collectedEpisodes.length}/${BATCH_COUNT}`);
        const successCount = collectedEpisodes.filter(e => e.metadata.success).length;
        console.log(`[BatchDemo] Successful grasps: ${successCount}/${collectedEpisodes.length}`);

        // Increment usage counter (1 demo run = 1 usage, regardless of episode count)
        useUsageStore.getState().incrementDemos(1);
        const remaining = useUsageStore.getState().getDemosRemaining(useAuthStore.getState().getTier());
        console.log(`[BatchDemo] Usage incremented. Demos remaining today: ${remaining}`);

        setState(s => ({
          ...s,
          objectName: 'Cube',
          objectPlaced: true,
          demoEpisodes: [...s.demoEpisodes, ...collectedEpisodes],
          demoQuality: [...s.demoQuality, ...collectedQuality],
        }));

        setDemoStatus(`Done! ${collectedEpisodes.length} demo${collectedEpisodes.length > 1 ? 's' : ''} recorded`);
        await delay(1000);
        setStep('record-demo');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch demo failed');
    } finally {
      setIsDemoRunning(false);
      setDemoStatus(null);
      setBatchProgress(null);
    }
  }, [isDemoRunning, isAnimating, isLLMLoading, spawnObject, selectedRobotId]);

  // Handle adding a standard library object
  const handleAddLibraryObject = useCallback((template: ObjectTemplate) => {
    // Random position in front of robot - optimal workspace zone
    // IMPORTANT: Keep objects nearly straight ahead (small angle) for reliable IK pickup
    // Demo Pick Up uses [16, 2, 1]cm which works perfectly - stay close to that
    const x = 0.14 + Math.random() * 0.04; // 14-18cm forward (Demo uses 16cm)
    const z = -0.02 + Math.random() * 0.04; // -2cm to +2cm sideways (nearly centered, Demo uses 1cm)

    // Use the template's actual scale - Easy Grasp objects are already sized correctly
    const scale = template.scale;
    // Spawn objects ON the table (Y=0) - object center at half height
    // Cylinders are tall (height = 6*scale), cubes/balls use scale directly
    const y = template.type === 'cylinder' ? scale * 3 : scale / 2;

    const newObject = createSimObjectFromTemplate(template, [x, y, z]);
    // Remove the 'id' since spawnObject will generate one
    const { id, ...objWithoutId } = newObject;

    // Make sure name property is set for LLM matching, and use graspable scale
    const objToSpawn = {
      ...objWithoutId,
      name: template.name,
      scale: scale, // Override with graspable scale (min 6cm)
    };

    log.debug('Spawning object', { name: objToSpawn.name });
    spawnObject(objToSpawn);

    setState(s => ({ ...s, objectName: template.name, objectPlaced: true }));
    setStep('record-demo');
  }, [spawnObject]);

  // Handle image upload
  const handleImageSelect = useCallback(async (file: File) => {
    if (!falApiKey) {
      setShowKeyInput('fal');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const objectName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');

      log.debug('Starting 3D generation', { objectName });

      const generated = await generateFalObject(
        { apiKey: falApiKey },
        file,
        { objectName, outputFormat: 'glb', removeBackground: true },
        (status) => log.debug('Generation status', { status })
      );

      log.debug('Generated object', { hasMeshUrl: !!generated.meshUrl });

      if (!generated.meshUrl) {
        throw new Error('No mesh URL returned from 3D generation');
      }

      const existingPositions = objects.map(o => o.position as [number, number, number]);
      const placement = getOptimalPlacement(generated.dimensions, { avoidPositions: existingPositions });

      log.debug('Spawning at position', { position: placement.position });

      spawnObject({
        type: 'glb',
        position: placement.position,
        rotation: placement.rotation,
        modelUrl: generated.meshUrl,
        name: objectName,
        scale: 1,
        color: '#888888',
        isGrabbable: true,
        isGrabbed: false,
        isInTargetZone: false,
      });

      log.debug('Object spawned successfully');

      setState(s => ({ ...s, objectName, objectPlaced: true }));
      setStep('record-demo');
    } catch (err) {
      console.error('[MinimalTrainFlow] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, [falApiKey, objects, spawnObject]);

  // Generate training data
  const handleGenerate = useCallback(async () => {
    setIsProcessing(true);
    setStep('generate');

    try {
      const generated = await autoGenerateEpisodes(
        state.demoEpisodes,
        state.objectName,
        TARGET_EPISODE_COUNT,
        () => {}
      );

      setState(s => ({
        ...s,
        generatedEpisodes: generated.slice(s.demoEpisodes.length),
      }));

      setStep('upload');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setIsProcessing(false);
    }
  }, [state.demoEpisodes, state.objectName]);

  // Upload to HuggingFace
  const handleUpload = useCallback(async () => {
    if (!hfToken && backendAvailable) {
      setShowKeyInput('hf');
      return;
    }

    setIsProcessing(true);
    const allEpisodes = getAllEpisodes(state);

    try {
      if (backendAvailable && hfToken) {
        const result = await uploadViaBackendAPI(
          allEpisodes,
          {
            hfToken,
            repoName: `${state.objectName}-training-${Date.now()}`,
            robotType: selectedRobotId,
            isPrivate: true,
          },
          () => {}
        );

        if (result.success) {
          setState(s => ({ ...s, exportedUrl: result.repoUrl ?? null }));
          setStep('done');
        } else {
          throw new Error(result.error);
        }
      } else {
        // Fallback to download
        await exportLeRobotDataset(allEpisodes, `${state.objectName}_training`, selectedRobotId);
        setState(s => ({ ...s, exportedUrl: 'downloaded' }));
        setStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsProcessing(false);
    }
  }, [state, hfToken, backendAvailable, selectedRobotId]);

  // Render the current step
  const renderStep = () => {
    // API Key inputs
    if (showKeyInput === 'fal') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Enter your fal.ai API key</p>
          <input
            type="password"
            value={falApiKey}
            onChange={(e) => updateFalApiKey(e.target.value)}
            placeholder="fal_..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
          />
          <p className="text-xs text-slate-500">Get one free at fal.ai</p>
          <button
            onClick={() => {
              if (falApiKey) {
                setShowKeyInput(null);
                fileInputRef.current?.click();
              }
            }}
            disabled={!falApiKey}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-xl text-white font-medium transition"
          >
            Continue
          </button>
        </div>
      );
    }

    if (showKeyInput === 'hf') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Enter your HuggingFace token</p>
          <input
            type="password"
            value={hfToken}
            onChange={(e) => updateHfToken(e.target.value)}
            placeholder="hf_..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
          />
          <p className="text-xs text-slate-500">Get one at huggingface.co/settings/tokens</p>
          <button
            onClick={() => {
              if (hfToken) {
                setShowKeyInput(null);
                handleUpload();
              }
            }}
            disabled={!hfToken}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 rounded-xl text-white font-medium transition"
          >
            Upload
          </button>
        </div>
      );
    }

    switch (step) {
      case 'add-object':
        // Choose between options
        if (objectMode === 'choose') {
          const taskDescriptions = {
            pickup: 'LLM-driven: Approach → Grasp → Lift',
            stack: 'LLM-driven: Pick A → Place on B',
            place: 'Template: Pick → Move to zone → Release (cubes only)',
          };

          return (
            <div className="space-y-3">
              {/* Task Type Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Task Type</span>
                  <span className="text-xs text-slate-500">Template-based for reliable data</span>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-800 rounded-lg">
                  {(['pickup', 'stack', 'place'] as const).map((task) => (
                    <button
                      key={task}
                      onClick={() => setSelectedTask(task)}
                      className={`py-2 px-3 rounded-md text-sm font-medium transition ${
                        selectedTask === task
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {task.charAt(0).toUpperCase() + task.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-slate-500">{taskDescriptions[selectedTask]}</p>
              </div>

              {/* Batch Demo Button - Generate 10 varied demos */}
              <button
                onClick={() => handleBatchDemos(selectedTask)}
                disabled={isDemoRunning || isAnimating || isLLMLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-600 disabled:to-slate-700 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 flex items-center justify-center gap-3 ring-2 ring-purple-400/50 ring-offset-2 ring-offset-slate-900"
              >
                {isDemoRunning && batchProgress ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {demoStatus || `Demo ${batchProgress.current}/${batchProgress.total}`}
                  </>
                ) : (
                  <>
                    Generate {BATCH_COUNT} {selectedTask.charAt(0).toUpperCase() + selectedTask.slice(1)} Demos
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-400">
                Uses proven motion templates • Varied positions & speeds
              </p>

              {/* Prompt Debug Panel - shows during demo */}
              {(isDemoRunning || demoResults.length > 0) && (
                <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 font-medium">Demo Progress</span>
                    <button
                      onClick={() => setShowPromptDebug(!showPromptDebug)}
                      className="text-slate-500 hover:text-white transition"
                    >
                      {showPromptDebug ? 'Hide Details' : 'Show Details'}
                    </button>
                  </div>

                  {/* Current prompt being executed */}
                  {currentLLMPrompt && (
                    <div className="mb-2">
                      <div className="text-slate-500">Prompt:</div>
                      <div className="text-blue-400 font-mono text-[10px] break-all">{currentLLMPrompt}</div>
                    </div>
                  )}

                  {/* Current response */}
                  {currentLLMResponse && (
                    <div className="mb-2">
                      <div className="text-slate-500">Response:</div>
                      <div className="text-green-400 font-mono text-[10px] break-all">{currentLLMResponse}</div>
                    </div>
                  )}

                  {/* Results summary */}
                  {demoResults.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Results:</span>
                        <span className="text-green-400">{demoResults.filter(r => r.success).length} passed</span>
                        <span className="text-slate-600">/</span>
                        <span className="text-red-400">{demoResults.filter(r => !r.success).length} failed</span>
                        <span className="text-slate-600">/</span>
                        <span>{demoResults.length} total</span>
                      </div>

                      {/* Detailed results (toggle) */}
                      {showPromptDebug && (
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {demoResults.map((result, idx) => (
                            <div
                              key={idx}
                              className={`p-1 rounded text-[10px] ${result.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}
                            >
                              <div className="flex items-center gap-1">
                                <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                                  Demo {result.demo}: {result.success ? 'OK' : 'FAIL'}
                                </span>
                              </div>
                              <div className="text-slate-500 truncate">{result.prompt}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or chat with AI</span>
                </div>
              </div>

              {/* Chat input - talk to the robot */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    placeholder="Try: pick up the red cube"
                    disabled={isLLMLoading || isDemoRunning}
                    className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || isLLMLoading || isDemoRunning}
                    className="p-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-xl text-white transition"
                  >
                    {isLLMLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-center text-xs text-slate-500">
                  AI-planned motion • Flexible but experimental
                </p>
                {/* Quick prompts */}
                <div className="flex flex-wrap gap-1 justify-center">
                  {['pick up the cube', 'stack blue on red', 'place it on the left'].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setChatInput(prompt)}
                      disabled={isLLMLoading || isDemoRunning}
                      className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or test with one click</span>
                </div>
              </div>

              {/* Demo Pick Up Button - One-click test */}
              <button
                onClick={handleDemoPickUp}
                disabled={isDemoRunning || isAnimating || isLLMLoading}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-700 rounded-xl text-white font-medium transition flex items-center justify-center gap-2"
              >
                {isDemoRunning && !batchProgress ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {demoStatus || 'Running...'}
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Test Single Pickup
                  </>
                )}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or add custom object</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setObjectMode('library')}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Box className="w-4 h-4" />
                  Objects
                </button>
                <button
                  onClick={() => setObjectMode('photo')}
                  className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Photo
                </button>
              </div>
            </div>
          );
        }

        // Library object selection - all types
        if (objectMode === 'library') {
          const cubes = PRIMITIVE_OBJECTS.filter(o => o.type === 'cube');
          const balls = PRIMITIVE_OBJECTS.filter(o => o.type === 'ball');
          const cylinders = PRIMITIVE_OBJECTS.filter(o => o.type === 'cylinder');

          return (
            <div className="space-y-3">
              <button
                onClick={() => setObjectMode('choose')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center text-sm text-slate-400 mb-2">
                Pick an object to add
              </div>

              {/* Cubes */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 font-medium">Cubes</div>
                <div className="grid grid-cols-6 gap-1">
                  {cubes.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleAddLibraryObject(template)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-blue-500/50 transition"
                      title={template.name}
                    >
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: template.color }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Balls */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 font-medium">Balls</div>
                <div className="grid grid-cols-6 gap-1">
                  {balls.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleAddLibraryObject(template)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-blue-500/50 transition"
                      title={template.name}
                    >
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: template.color }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Cylinders */}
              <div className="space-y-1">
                <div className="text-xs text-slate-500 font-medium">Cylinders</div>
                <div className="grid grid-cols-6 gap-1">
                  {cylinders.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleAddLibraryObject(template)}
                      className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-blue-500/50 transition"
                      title={template.name}
                    >
                      <div
                        className="w-4 h-6 rounded-sm"
                        style={{ backgroundColor: template.color }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        // Photo upload mode
        return (
          <div className="space-y-3">
            <button
              onClick={() => setObjectMode('choose')}
              className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => falApiKey ? fileInputRef.current?.click() : setShowKeyInput('fal')}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Creating 3D model...
                </>
              ) : (
                <>
                  <Camera className="w-6 h-6" />
                  Select Photo
                </>
              )}
            </button>
            <p className="text-center text-sm text-slate-500">
              Take a photo of anything you want the robot to pick up
            </p>
          </div>
        );

      case 'record-demo':
        // Check if Claude API key is needed
        if (!hasClaudeKey) {
          return (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">Enter your Claude API key to control the robot with chat</p>
              <input
                type="password"
                value={claudeKeyInput}
                onChange={(e) => setClaudeKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
              />
              <p className="text-xs text-slate-500">Get one at console.anthropic.com</p>
              <button
                onClick={handleSaveClaudeKey}
                disabled={!claudeKeyInput.trim()}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-xl text-white font-medium transition"
              >
                Continue
              </button>
            </div>
          );
        }

        // If we have demos, show generate button prominently
        if (state.demoEpisodes.length >= 1 && !isRecording) {
          return (
            <div className="space-y-4">
              {/* Success status */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900/30 rounded-full text-green-400 mb-2">
                  <CheckCircle className="w-5 h-5" />
                  {state.demoEpisodes.length} demo{state.demoEpisodes.length > 1 ? 's' : ''} recorded
                </div>
              </div>

              {/* Generate button - PROMINENT */}
              <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 ring-2 ring-green-400/50 ring-offset-2 ring-offset-slate-900"
              >
                Generate Training Data ({TARGET_EPISODE_COUNT} episodes)
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or add more demos</span>
                </div>
              </div>

              {/* Chat input for more demos */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder={`"Pick up the ${state.objectName}"`}
                  disabled={isLLMLoading}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                />
                <button
                  onClick={handleChatSend}
                  disabled={!chatInput.trim() || isLLMLoading}
                  className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-xl text-white transition"
                >
                  {isLLMLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          );
        }

        // No demos yet - show instructions
        return (
          <div className="space-y-4">
            {/* Status */}
            <div className="text-center">
              <p className="text-slate-300 text-sm">
                Tell the robot what to do with the {state.objectName}
              </p>
              {isRecording && (
                <div className="flex items-center justify-center gap-2 mt-2 text-red-400">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs">Recording...</span>
                </div>
              )}
            </div>

            {/* Suggested prompts */}
            {!isRecording && (
              <div className="flex flex-wrap gap-1 justify-center">
                {[`Pick up the ${state.objectName}`, `Grab the ${state.objectName}`].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setChatInput(prompt)}
                    className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Chat input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder={`"Pick up the ${state.objectName}"`}
                disabled={isLLMLoading}
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isLLMLoading}
                className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 rounded-xl text-white transition"
              >
                {isLLMLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Last message preview */}
            {messages.length > 0 && (
              <div className="text-xs text-slate-500 truncate">
                Last: {messages[messages.length - 1]?.content?.slice(0, 50)}...
              </div>
            )}
          </div>
        );

      case 'generate':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-white font-medium">Generating {TARGET_EPISODE_COUNT} episodes...</p>
            <p className="text-slate-400 text-sm mt-2">This takes a few seconds</p>
          </div>
        );

      case 'upload':
        const totalEpisodes = state.demoEpisodes.length + state.generatedEpisodes.length;
        return (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-900/30 rounded-full text-green-400 mb-2">
                <CheckCircle className="w-5 h-5" />
                {totalEpisodes} episodes ready
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Rocket className="w-6 h-6" />
                  {backendAvailable ? 'Upload to HuggingFace' : 'Download Dataset'}
                </>
              )}
            </button>
          </>
        );

      case 'done':
        // Colab notebook URL
        const colabNotebookUrl = 'https://colab.research.google.com/github/hshadab/robosim/blob/main/notebooks/train_so101_colab.ipynb';

        return (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Train!</h3>
            {state.exportedUrl && state.exportedUrl !== 'downloaded' ? (
              <>
                <p className="text-slate-400 text-sm mb-4">
                  Dataset uploaded to HuggingFace
                </p>

                {/* Train on Colab Button */}
                <a
                  href={colabNotebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 mb-3"
                >
                  <Cpu className="w-6 h-6" />
                  Train on Google Colab
                  <ExternalLink className="w-5 h-5" />
                </a>

                <p className="text-slate-500 text-xs mb-4">
                  Free GPU • ~2 hours • No setup required
                </p>

                <div className="bg-slate-800/50 rounded-lg p-3 text-left mb-4">
                  <p className="text-xs text-slate-400 mb-1">Your dataset ID:</p>
                  <code className="text-xs text-blue-400 break-all">{state.exportedUrl}</code>
                  <p className="text-xs text-slate-500 mt-2">
                    Copy this into the Colab notebook when prompted
                  </p>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-sm mb-4">
                Dataset downloaded. Run LeRobot training locally.
              </p>
            )}
            <button
              onClick={() => {
                setState(initialQuickTrainState);
                setStep('add-object');
                setObjectMode('choose');
              }}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
            >
              Train Another Object
            </button>
          </div>
        );
    }
  };

  // Progress dots
  const steps: FlowStep[] = ['add-object', 'record-demo', 'generate', 'upload', 'done'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <button
          onClick={() => setShowWelcome(true)}
          className="flex items-center gap-2 text-lg font-semibold text-white hover:text-purple-400 transition"
          title="About RoboSim"
        >
          <Bot className="w-5 h-5 opacity-70" />
          RoboSim
        </button>
        <div className="flex items-center gap-2">
          <a
            href="https://buy.stripe.com/cNibJ0fTA5D5cdZdXgbEA00"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white text-xs font-medium transition flex items-center gap-1"
          >
            <Rocket className="w-3 h-3" />
            Pro $10/mo
          </a>
          <button
            onClick={onOpenDrawer}
            className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
            title="Advanced Tools"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 py-4">
        {steps.slice(0, -1).map((s, i) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition ${
              i <= currentStepIndex ? 'bg-blue-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="float-right text-red-500 hover:text-red-400">×</button>
          </div>
        )}

        {renderStep()}
      </div>

      {/* Welcome Modal for First-Time Visitors */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                <Bot className="w-8 h-8 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Browser-Based Robot Training</h2>
              <p className="text-slate-400">
                Generate training data, train on free GPUs, deploy to real hardware.
                <span className="text-slate-500 block text-sm mt-1">Optimized for SO-101 and LeRobot-compatible arms.</span>
              </p>
            </div>

            {/* Comparison Table */}
            <div className="bg-slate-900/50 rounded-xl p-4 mb-4 overflow-x-auto">
              <h3 className="text-white font-semibold mb-3 text-center text-sm">Why Browser-Based?</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2 pr-2"></th>
                    <th className="text-center py-2 px-2 text-xs">Isaac Sim</th>
                    <th className="text-center py-2 px-2 text-xs">MuJoCo</th>
                    <th className="text-center py-2 px-2 text-purple-400 text-xs">RoboSim</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300 text-xs">
                  <tr className="border-b border-slate-700/50">
                    <td className="py-2 pr-2 text-slate-400">GPU Required</td>
                    <td className="text-center py-2 px-2">RTX 3080+</td>
                    <td className="text-center py-2 px-2">Optional</td>
                    <td className="text-center py-2 px-2 text-green-400">None</td>
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="py-2 pr-2 text-slate-400">Setup</td>
                    <td className="text-center py-2 px-2">Hours</td>
                    <td className="text-center py-2 px-2">30+ min</td>
                    <td className="text-center py-2 px-2 text-green-400">0 min</td>
                  </tr>
                  <tr className="border-b border-slate-700/50">
                    <td className="py-2 pr-2 text-slate-400">50 Demos</td>
                    <td className="text-center py-2 px-2">Manual</td>
                    <td className="text-center py-2 px-2">Scripted</td>
                    <td className="text-center py-2 px-2 text-green-400">5 min</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 text-slate-400">LeRobot</td>
                    <td className="text-center py-2 px-2">Convert</td>
                    <td className="text-center py-2 px-2">Convert</td>
                    <td className="text-center py-2 px-2 text-green-400">Native</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-900/50 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-2 text-sm">Two Ways to Use</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-blue-400 opacity-70" />
                      <span className="text-white font-medium">Explore</span>
                    </div>
                    <p className="text-slate-400">Chat with the robot, test commands, learn the API</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-purple-400 opacity-70" />
                      <span className="text-white font-medium">Train</span>
                    </div>
                    <p className="text-slate-400">Generate demos, upload to HuggingFace, train on Colab</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-3">
                <div className="flex flex-wrap gap-2 justify-center text-xs">
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full text-slate-400">
                    <GraduationCap className="w-3 h-3 opacity-60" /> Students
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full text-slate-400">
                    <Wrench className="w-3 h-3 opacity-60" /> Makers
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full text-slate-400">
                    <FlaskConical className="w-3 h-3 opacity-60" /> Researchers
                  </span>
                  <span className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/50 rounded-full text-slate-400">
                    <BookOpen className="w-3 h-3 opacity-60" /> Educators
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={dismissWelcome}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-white font-semibold transition"
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Upgrade to Pro</h2>
              <p className="text-slate-400">
                You've reached your daily demo limit. Upgrade for unlimited demos and more features.
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-semibold">Pro Plan</span>
                <span className="text-2xl font-bold text-white">$10<span className="text-sm text-slate-400">/mo</span></span>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Unlimited demo runs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  HuggingFace upload
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  LeRobot export format
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  AI chat with robot
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  window.open('https://buy.stripe.com/cNibJ0fTA5D5cdZdXgbEA00', '_blank');
                }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-white font-semibold transition"
              >
                Upgrade Now
              </button>
              <button
                onClick={() => {
                  setShowUpgradePrompt(false);
                  setError(null);
                }}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 transition"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
