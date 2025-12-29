/**
 * Minimal Train Flow
 *
 * Apple-inspired one-button UX for the "photo to trained robot" flow.
 * Shows only what's needed at each step - everything else in a drawer.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Camera,
  Rocket,
  CheckCircle,
  Loader2,
  Settings,
  Sparkles,
  Box,
  ChevronLeft,
  Send,
  Play,
  ExternalLink,
  Cpu,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { Episode, Frame } from '../../lib/datasetExporter';
import { generateTrainableObject as generateFalObject } from '../../lib/falImageTo3D';
import { useLLMChat } from '../../hooks/useLLMChat';
import { getClaudeApiKey, setClaudeApiKey } from '../../lib/claudeApi';
import { getFalApiKey, setFalApiKey, getHfToken, setHfToken } from '../../lib/apiKeys';
import { getOptimalPlacement } from '../../lib/workspacePlacement';
import {
  PRIMITIVE_OBJECTS,
  createSimObjectFromTemplate,
  type ObjectTemplate,
} from '../../lib/objectLibrary';
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
import { captureFromCanvas } from '../../lib/cameraCapture';

const log = createLogger('TrainFlow');

// Number of demos to generate for training data
const BATCH_COUNT = 10;

type FlowStep = 'add-object' | 'record-demo' | 'generate' | 'upload' | 'done';

interface MinimalTrainFlowProps {
  onOpenDrawer: () => void;
}

export const MinimalTrainFlow: React.FC<MinimalTrainFlowProps> = ({ onOpenDrawer }) => {
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
  }, [chatInput, isLLMLoading, isRecording, sendMessage, getJointPositions, objects]);

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
  const handleBatchDemos = useCallback(async () => {
    if (isDemoRunning || isAnimating || isLLMLoading) return;

    // Reset abort flag at start
    abortRef.current.aborted = false;

    const demoScale = 0.03; // 3cm cube

    log.debug('Starting batch demo', { BATCH_COUNT });

    // Generate varied positions with x from 0.16-0.18 (tested reliable range)
    // x=0.15 and closer causes overshooting, x=0.19+ may be out of reach
    const positions: Array<{ x: number; z: number }> = [
      { x: 0.16, z: 0.01 },   // Close center-right (matches handleDemoPickUp)
      { x: 0.17, z: 0.00 },   // Mid center
      { x: 0.18, z: 0.02 },   // Far right
      { x: 0.16, z: -0.01 },  // Close slight left
      { x: 0.17, z: 0.015 },  // Mid slight right
      { x: 0.18, z: -0.005 }, // Far near center left
      { x: 0.16, z: 0.005 },  // Close near center right
      { x: 0.17, z: -0.015 }, // Mid left
      { x: 0.18, z: 0.025 },  // Far further right
      { x: 0.16, z: -0.02 },  // Close further left
    ];

    setIsDemoRunning(true);
    setError(null);
    setBatchProgress({ current: 0, total: BATCH_COUNT });

    const collectedEpisodes: Episode[] = [];
    const collectedQuality: ReturnType<typeof calculateQualityMetrics>[] = [];

    // Define smoothMove ONCE outside the loop (not recreated each iteration)
    const { clearObjects, setJoints } = useAppStore.getState();

    // Time-based smooth move with abort checking and frame recording
    // Generates synthetic frames at 30fps for training data (headless browsers throttle timers)
    const smoothMove = async (
      targetJoints: Partial<ReturnType<typeof useAppStore.getState>['joints']>,
      durationMs: number,
      recordTo?: { timestamp: number; jointPositions: number[]; image?: string }[],
      recordStartTime?: number
    ): Promise<boolean> => {
      if (abortRef.current.aborted) return false;

      const startJoints = { ...useAppStore.getState().joints };
      const moveStartTime = Date.now();

      // Generate synthetic frames at 30fps for training data
      // This ensures consistent data regardless of browser timer throttling
      if (recordTo && recordStartTime !== undefined) {
        const frameInterval = 33; // ~30fps for training data
        const numFrames = Math.ceil(durationMs / frameInterval);

        for (let f = 0; f <= numFrames; f++) {
          const t = Math.min(1, f / numFrames);
          // Ease-in-out cubic for natural motion
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          const frameJoints: number[] = [
            startJoints.base + ((targetJoints.base ?? startJoints.base) - startJoints.base) * ease,
            startJoints.shoulder + ((targetJoints.shoulder ?? startJoints.shoulder) - startJoints.shoulder) * ease,
            startJoints.elbow + ((targetJoints.elbow ?? startJoints.elbow) - startJoints.elbow) * ease,
            startJoints.wrist + ((targetJoints.wrist ?? startJoints.wrist) - startJoints.wrist) * ease,
            startJoints.wristRoll + ((targetJoints.wristRoll ?? startJoints.wristRoll) - startJoints.wristRoll) * ease,
            startJoints.gripper + ((targetJoints.gripper ?? startJoints.gripper) - startJoints.gripper) * ease,
          ];

          recordTo.push({
            timestamp: (moveStartTime - recordStartTime) + (f * frameInterval),
            jointPositions: frameJoints,
          });
        }
      }

      // Skip animation loop in batch mode - just set final position immediately
      // and wait a fixed time for physics. Visual animation is nice but not required
      // for training data generation, and it gets throttled heavily in headless browsers.
      setJoints(targetJoints);
      await new Promise(resolve => setTimeout(resolve, Math.min(durationMs, 100)));
      return !abortRef.current.aborted;
    };

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

    try {
      const cubeTemplate = PRIMITIVE_OBJECTS.find(o => o.id === 'lerobot-cube-red');
      if (!cubeTemplate) throw new Error('Cube template not found');

      for (let i = 0; i < BATCH_COUNT; i++) {
        // Check for abort at start of each demo
        if (abortRef.current.aborted) {
          log.debug('Batch demo aborted');
          break;
        }

        setBatchProgress({ current: i + 1, total: BATCH_COUNT });
        setDemoStatus(`Demo ${i + 1}/${BATCH_COUNT}...`);

        // Visual randomization
        const visualConfig = randomizeVisualsForEpisode();
        log.debug(`Episode ${i + 1}: Visual randomization applied`, {
          lighting: visualConfig.domain.lighting.keyLightIntensity.toFixed(2),
          floorTexture: visualConfig.texture.floor.type,
          distractorCount: visualConfig.distractors.length,
        });

        // Clear scene and reset arm
        clearObjects();
        setJoints({ base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0, gripper: 100 });
        if (!await delay(500)) break;

        // Spawn cube at varied position
        const pos = positions[i % positions.length];
        const y = 0.02;
        log.debug(`Demo ${i + 1}: Spawning cube at [${(pos.x*100).toFixed(1)}, ${(y*100).toFixed(1)}, ${(pos.z*100).toFixed(1)}]cm`);
        const newObject = createSimObjectFromTemplate(cubeTemplate, [pos.x, y, pos.z]);
        const { id, ...objWithoutId } = newObject;
        spawnObject({ ...objWithoutId, name: `Cube ${i + 1}`, scale: demoScale });

        // Wait for physics to settle
        if (!await delay(1500)) break;

        // Start recording - frames are captured during smoothMove animations
        const recordStartTime = Date.now();
        const recordedFrames: { timestamp: number; jointPositions: number[]; image?: string }[] = [];

        // Get canvas for this demo (query fresh each time to ensure it's available)
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;

        // Capture initial scene image (cube in place, arm at home)
        let initialImage: string | undefined;
        if (canvas) {
          const captured = captureFromCanvas(canvas, 'overhead');
          if (captured && captured.imageData.length > 100) {
            initialImage = captured.imageData;
          }
        }

        try {
          // Calculate joint angles - use EXACT values from working Demo Pick Up
          // Base config: base=5, shoulder=-22, elbow=51, wrist=63, wristRoll=90
          // Adjust only for position offset from baseline
          const baseAngle = Math.atan2(pos.z, pos.x) * (180 / Math.PI);

          // Use proven joint values with small adjustments for position
          const xOffset = (pos.x - 0.16) * 100; // cm offset from baseline
          const shoulderGrasp = -22 + xOffset * 2;  // Adjust for reach
          const elbowGrasp = 51 - xOffset * 3;      // Compensate elbow
          const wristGrasp = 63;
          const wristRollVar = 90 + (Math.random() - 0.5) * 4; // 88-92°

          log.debug(`Demo ${i+1}: base=${baseAngle.toFixed(1)}°, shoulder=${shoulderGrasp.toFixed(1)}°, elbow=${elbowGrasp.toFixed(1)}°`);

          // Move 1: Position at cube with gripper open (record frames)
          if (!await smoothMove({
            base: baseAngle,
            shoulder: shoulderGrasp,
            elbow: elbowGrasp,
            wrist: wristGrasp,
            wristRoll: wristRollVar,
            gripper: 100
          }, 800, recordedFrames, recordStartTime)) break;

          // Move 2: Close gripper smoothly over 1 second
          // Record synthetic frames for training data (30fps, smooth linear close)
          const gripperCloseStart = Date.now();
          const gripperCloseDuration = 1000; // 1 second
          const gripperFrameCount = Math.ceil(gripperCloseDuration / 33);
          for (let f = 0; f <= gripperFrameCount; f++) {
            const t = f / gripperFrameCount;
            const gripperValue = 100 * (1 - t); // Linear 100 -> 0

            recordedFrames.push({
              timestamp: (gripperCloseStart - recordStartTime) + (f * 33),
              jointPositions: [baseAngle, shoulderGrasp, elbowGrasp, wristGrasp, wristRollVar, gripperValue],
            });
          }

          // Close gripper - simplified for batch mode (no visual animation needed)
          // Just set to closed and wait for physics
          setJoints({
            base: baseAngle,
            shoulder: shoulderGrasp,
            elbow: elbowGrasp,
            wrist: wristGrasp,
            wristRoll: wristRollVar,
            gripper: 0
          });

          // Wait for physics to register grasp (300ms minimum)
          await new Promise(resolve => setTimeout(resolve, 300));
          if (abortRef.current.aborted) break;

          // Capture grasp image (gripper closed on object)
          let graspImage: string | undefined;
          if (canvas) {
            const captured = captureFromCanvas(canvas, 'overhead');
            if (captured && captured.imageData.length > 100) {
              graspImage = captured.imageData;
            }
          }

          // Move 3: Lift (record frames)
          if (!await smoothMove({
            base: baseAngle,
            shoulder: -50,
            elbow: 30,
            wrist: 45,
            wristRoll: wristRollVar,
            gripper: 0
          }, 700, recordedFrames, recordStartTime)) break;

          // Verify grasp
          if (!await delay(300)) break;

          // Capture final lift image
          let liftImage: string | undefined;
          if (canvas) {
            const captured = captureFromCanvas(canvas, 'overhead');
            if (captured && captured.imageData.length > 100) {
              liftImage = captured.imageData;
            }
          }

          const currentObjects = useAppStore.getState().objects;
          const cube = currentObjects.find(o => o.name?.includes('Cube'));
          const cubeY = cube?.position?.[1] ?? 0;
          const graspSuccess = cubeY > 0.05;
          log.debug(`Grasp verification: cubeY=${(cubeY*100).toFixed(1)}cm, success=${graspSuccess}`);

          // Debug: log how many frames were recorded
          const imageCount = [initialImage, graspImage, liftImage].filter(Boolean).length;
          log.debug(`Recorded frames: ${recordedFrames.length}, key images: ${imageCount}`);

          // Create episode from recorded frames with key images attached
          if (recordedFrames.length > 10) {
            // Attach key images to specific frames
            const midFrameIdx = Math.floor(recordedFrames.length / 2);
            const frames: Frame[] = recordedFrames.map((f, idx) => {
              // Attach images at key moments: start, middle (grasp), end (lift)
              let frameImage: string | undefined;
              if (idx === 0) frameImage = initialImage;
              else if (idx === midFrameIdx) frameImage = graspImage;
              else if (idx === recordedFrames.length - 1) frameImage = liftImage;

              return {
                timestamp: f.timestamp,
                observation: {
                  jointPositions: f.jointPositions,
                  image: frameImage,
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
                task: 'pick_cube',
                languageInstruction: `Pick up the cube at [${(pos.x*100).toFixed(0)}, 2, ${(pos.z*100).toFixed(0)}]cm`,
                duration,
                frameCount: frames.length,
                recordedAt: new Date().toISOString(),
                graspSuccess,
                cubePosition: [pos.x, 0.02, pos.z],
                finalCubeY: cubeY,
              },
            };

            const quality = calculateQualityMetrics(recordedFrames);
            collectedEpisodes.push(episode);
            collectedQuality.push(quality);
            log.debug(`Episode ${i + 1} recorded: ${frames.length} frames, duration=${duration.toFixed(2)}s`);
          }

        } catch (demoError) {
          log.debug(`Demo ${i + 1} error:`, demoError);
          // Continue to next demo
        }

        // Brief pause between demos
        if (!await delay(300)) break;
      }

      // Only save if we collected episodes and weren't aborted
      if (collectedEpisodes.length > 0 && !abortRef.current.aborted) {
        log.debug(`All demos complete. Total episodes: ${collectedEpisodes.length}`);

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
          return (
            <div className="space-y-3">
              {/* Batch Demo Button - Generate 10 varied demos */}
              <button
                onClick={handleBatchDemos}
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
                    <Sparkles className="w-6 h-6" />
                    Generate {BATCH_COUNT === 1 ? '1 Demo' : '10 Demos'}
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-400">
                {BATCH_COUNT === 1 ? 'Testing mode - 1 demo' : 'Auto-generates 10 varied pickups for training data'}
              </p>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or test first</span>
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
                  Cubes
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

        // Library object selection - simplified to just cubes
        if (objectMode === 'library') {
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
                Pick a cube color to add
              </div>

              {/* Simple cube grid */}
              <div className="grid grid-cols-3 gap-2">
                {PRIMITIVE_OBJECTS.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleAddLibraryObject(template)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-blue-500/50 transition"
                  >
                    <div
                      className="w-10 h-10 rounded"
                      style={{ backgroundColor: template.color }}
                    />
                    <span className="text-xs text-slate-300">{template.name.replace(' Cube', '')}</span>
                  </button>
                ))}
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
                <Sparkles className="w-6 h-6" />
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
        <h1 className="text-lg font-semibold text-white">Train Robot</h1>
        <button
          onClick={onOpenDrawer}
          className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white"
          title="Advanced Tools"
        >
          <Settings className="w-5 h-5" />
        </button>
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

    </div>
  );
};
