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
  OBJECT_CATEGORIES,
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
import { solveIK, type IKTarget } from '../../lib/numericalIK';

const log = createLogger('TrainFlow');

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
  const [selectedCategory, setSelectedCategory] = useState<string>('lerobot');

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

  // Check backend on mount
  useEffect(() => {
    isBackendAPIAvailable().then(setBackendAvailable);
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

      // Use 4cm cube - good balance of visibility and grippability
      // Gripper max opening is ~6cm, so 4cm gives good margin
      const demoScale = 0.04; // 4cm cube

      // Position in front of robot, within reachable workspace
      // Based on FK analysis: arm reaches ~14cm in X-Z plane optimally
      const x = 0.15;  // 15cm forward
      const z = 0.10;  // 10cm to the side - well within reach
      const y = demoScale / 2; // Half height above table (2cm for 4cm cube)

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

      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      const currentJoints = useAppStore.getState().joints;

      // Smooth interpolation helper - animates joints over duration
      const smoothMove = async (targetJoints: Partial<typeof currentJoints>, durationMs: number) => {
        const startJoints = { ...useAppStore.getState().joints };
        const steps = Math.max(10, Math.floor(durationMs / 16)); // ~60fps
        const stepDelay = durationMs / steps;
        
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
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
          await delay(stepDelay);
        }
      };

      // Calculate base angle to face the cube: atan2(z, x) in degrees
      const baseAngle = Math.atan2(z, x) * (180 / Math.PI);
      console.log(`[DemoPick] Cube at [${(x*100).toFixed(1)}, ${(y*100).toFixed(1)}, ${(z*100).toFixed(1)}]cm, base angle: ${baseAngle.toFixed(1)}°`);

      // Step 3a: Open gripper and rotate to face cube
      await smoothMove({ gripper: 100, base: baseAngle, wristRoll: 0 }, 500);

      // Step 3b: Move to approach position (above cube)
      const approachHeight = y + 0.08; // 8cm above cube
      const approachTarget: IKTarget = { position: { x, y: approachHeight, z } };
      const approachResult = solveIK(approachTarget, { ...currentJoints, base: baseAngle, gripper: 100 });
      if (approachResult.success) {
        await smoothMove({ ...approachResult.joints, gripper: 100 }, 600);
      } else {
        await smoothMove({ shoulder: 0, elbow: 45, wrist: 60 }, 600);
      }
      let pos = useAppStore.getState().gripperWorldPosition;
      console.log(`[DemoPick] Approach - gripper at: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm`);

      // Step 3c: Move to pre-grasp position (closer to cube)
      const preGraspHeight = y + 0.03; // 3cm above cube
      const preGraspTarget: IKTarget = { position: { x, y: preGraspHeight, z } };
      const preGraspResult = solveIK(preGraspTarget, useAppStore.getState().joints);
      if (preGraspResult.success) {
        await smoothMove({ ...preGraspResult.joints, gripper: 100 }, 500);
      }
      pos = useAppStore.getState().gripperWorldPosition;
      console.log(`[DemoPick] Pre-grasp - gripper at: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm`);

      // Step 3d: Move to grasp position (at cube height)
      const graspTarget: IKTarget = { position: { x, y: y + 0.01, z } };
      const graspResult = solveIK(graspTarget, useAppStore.getState().joints);
      if (graspResult.success) {
        await smoothMove({ ...graspResult.joints, gripper: 100 }, 400);
      }
      pos = useAppStore.getState().gripperWorldPosition;
      console.log(`[DemoPick] Grasp - gripper at: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm, target: [${(x*100).toFixed(1)}, ${(y*100).toFixed(1)}, ${(z*100).toFixed(1)}]cm`);

      // Step 3e: Close gripper to grab cube
      await smoothMove({ gripper: 0 }, 400);
      await delay(200); // Brief pause to ensure grip

      // Step 3f: Lift the cube using IK
      const liftTarget: IKTarget = { position: { x, y: y + 0.10, z } };
      const liftResult = solveIK(liftTarget, useAppStore.getState().joints);
      if (liftResult.success) {
        await smoothMove({ ...liftResult.joints, gripper: 0 }, 700);
      } else {
        await smoothMove({ shoulder: -20, elbow: 60, wrist: 50, gripper: 0 }, 700);
      }
      pos = useAppStore.getState().gripperWorldPosition;
      console.log(`[DemoPick] Lift - gripper at: [${(pos[0]*100).toFixed(1)}, ${(pos[1]*100).toFixed(1)}, ${(pos[2]*100).toFixed(1)}]cm`);

      setDemoStatus('Done!');
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setIsDemoRunning(false);
      setDemoStatus(null);
    }
  }, [isDemoRunning, isAnimating, isLLMLoading, spawnObject, sendMessage]);

  // Handle adding a standard library object
  const handleAddLibraryObject = useCallback((template: ObjectTemplate) => {
    // Random position in FRONT of robot - within optimal workspace zone
    // Use polar coordinates: distance 16-22cm, angle 30° to 60° from +X axis
    // This ensures objects are in the +X, +Z quadrant (front-right of robot)
    // where the arm has best reach and can approach from above
    const distance = 0.16 + Math.random() * 0.06; // 16-22cm from base
    const angle = (Math.PI / 6) + Math.random() * (Math.PI / 6); // 30° to 60° from +X axis (always positive Z)

    const x = Math.max(0.12, distance * Math.cos(angle)); // Ensure minimum positive X (12cm+)
    const z = Math.max(0.15, distance * Math.sin(angle)); // Ensure minimum positive Z (15cm+)

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
        // Choose between library and photo
        if (objectMode === 'choose') {
          return (
            <div className="space-y-3">
              {/* Demo Pick Up Button - One-click test */}
              <button
                onClick={handleDemoPickUp}
                disabled={isDemoRunning || isAnimating || isLLMLoading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-700 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 flex items-center justify-center gap-3 ring-2 ring-green-400/50 ring-offset-2 ring-offset-slate-900"
              >
                {isDemoRunning ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {demoStatus || 'Running demo...'}
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6" />
                    Demo Pick Up
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-500">or start training</span>
                </div>
              </div>

              <button
                onClick={() => setObjectMode('library')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Box className="w-6 h-6" />
                Use LeRobot Objects
              </button>
              <button
                onClick={() => setObjectMode('photo')}
                className="w-full py-4 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Camera className="w-6 h-6" />
                Upload Photo
              </button>
              <p className="text-center text-sm text-slate-500 mt-2">
                LeRobot objects match SO-101 training data. Photos take ~20s.
              </p>
            </div>
          );
        }

        // Library object selection
        if (objectMode === 'library') {
          const filteredObjects = PRIMITIVE_OBJECTS.filter(obj => obj.category === selectedCategory);
          // LeRobot objects - match training data for best compatibility
          const lerobotObjects = PRIMITIVE_OBJECTS.filter(obj => obj.category === 'lerobot');

          return (
            <div className="space-y-3">
              <button
                onClick={() => setObjectMode('choose')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {/* LeRobot Training Objects - Recommended */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">LeRobot Training Objects</span>
                </div>
                <p className="text-xs text-slate-500">Match SO-101 training data for best results</p>
                <div className="grid grid-cols-2 gap-2">
                  {lerobotObjects.slice(0, 6).map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleAddLibraryObject(template)}
                      className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-500/30 hover:border-blue-400/50 transition text-left"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: template.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-blue-300 truncate">{template.name}</div>
                        <div className="text-xs text-slate-400 truncate">{template.description?.split(' - ')[0] || template.type}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-3">
                <span className="text-xs text-slate-500">Or pick other objects:</span>
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1">
                {OBJECT_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2 py-1 rounded text-xs transition ${
                      selectedCategory === cat.id
                        ? 'bg-purple-500/30 text-purple-300'
                        : 'bg-slate-800/50 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>

              {/* Object grid */}
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {filteredObjects.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleAddLibraryObject(template)}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-purple-500/50 transition text-left"
                  >
                    <div
                      className="w-8 h-8 rounded flex-shrink-0"
                      style={{
                        backgroundColor: template.color,
                        borderRadius: template.type === 'ball' ? '50%' : template.type === 'cylinder' ? '20%' : '4px',
                      }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{template.name}</div>
                      <div className="text-xs text-slate-500 truncate">{template.description}</div>
                    </div>
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

        return (
          <div className="space-y-4">
            {/* Status */}
            <div className="text-center">
              <p className="text-slate-300 text-sm">
                {state.demoEpisodes.length === 0
                  ? `Tell the robot what to do with the ${state.objectName}`
                  : `${state.demoEpisodes.length} demo${state.demoEpisodes.length > 1 ? 's' : ''} recorded`
                }
              </p>
              {isRecording && (
                <div className="flex items-center justify-center gap-2 mt-2 text-red-400">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs">Recording...</span>
                </div>
              )}
            </div>

            {/* Suggested prompts */}
            {state.demoEpisodes.length === 0 && !isRecording && (
              <div className="flex flex-wrap gap-1 justify-center">
                {[`Pick up the ${state.objectName}`, `Move to the ${state.objectName}`, `Grab the ${state.objectName}`].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setChatInput(prompt);
                    }}
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

            {/* Generate button */}
            {state.demoEpisodes.length >= 1 && !isRecording && (
              <button
                onClick={handleGenerate}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Sparkles className="w-6 h-6" />
                Generate Training Data
              </button>
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
        return (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Train!</h3>
            {state.exportedUrl && state.exportedUrl !== 'downloaded' ? (
              <p className="text-slate-400 text-sm">
                Dataset uploaded to HuggingFace
              </p>
            ) : (
              <p className="text-slate-400 text-sm">
                Dataset downloaded. Run LeRobot training.
              </p>
            )}
            <button
              onClick={() => {
                setState(initialQuickTrainState);
                setStep('add-object');
                setObjectMode('choose');
              }}
              className="mt-4 px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition"
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
