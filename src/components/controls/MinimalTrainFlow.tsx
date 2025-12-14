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
  ChevronRight,
  Sparkles,
  Box,
  ChevronLeft,
  Send,
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
  const [selectedCategory, setSelectedCategory] = useState<string>('toy');

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
    console.log('[MinimalTrainFlow] handleChatSend called:', {
      chatInput: chatInput.trim(),
      isLLMLoading,
      isRecording,
      objectsInScene: objects.map(o => ({ name: o.name, type: o.type, position: o.position }))
    });

    if (chatInput.trim() && !isLLMLoading) {
      // Start recording when sending a command
      if (!isRecording) {
        console.log('[MinimalTrainFlow] Starting recording...');
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

      console.log('[MinimalTrainFlow] Sending message to LLM:', chatInput.trim());
      sendMessage(chatInput.trim());
      setChatInput('');
    } else {
      console.log('[MinimalTrainFlow] Chat send blocked:', {
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

  // Handle adding a standard library object
  const handleAddLibraryObject = useCallback((template: ObjectTemplate) => {
    // Random position in front of robot - WITHIN REACHABLE WORKSPACE
    // Use polar coordinates: distance 14-18cm, angle -40° to +40° from +X axis
    // Closer distance makes pickup easier with natural arm poses
    const distance = 0.14 + Math.random() * 0.04; // 14-18cm from base
    const angle = (Math.random() - 0.5) * (Math.PI / 2.25); // ±40° from +X axis

    const x = Math.max(0.10, distance * Math.cos(angle)); // Ensure minimum positive X
    const z = distance * Math.sin(angle);

    // Use smaller scale for easier gripping (60% of template size, min 2cm)
    const scale = Math.max(0.02, template.scale * 0.6);
    // Spawn objects with center at ~5cm height for reliable grasping
    // For 2.4cm cube: center at 5cm, bottom at 3.8cm, top at 6.2cm
    const y = scale / 2 + 0.04;

    const newObject = createSimObjectFromTemplate(template, [x, y, z]);
    // Remove the 'id' since spawnObject will generate one
    const { id, ...objWithoutId } = newObject;

    // Make sure name property is set for LLM matching, and use smaller scale
    const objToSpawn = {
      ...objWithoutId,
      name: template.name,
      scale: scale, // Override with smaller scale for easier gripping
    };

    console.log('[MinimalTrainFlow] Spawning object:', objToSpawn);
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

      console.log('[MinimalTrainFlow] Starting 3D generation for:', objectName);

      const generated = await generateFalObject(
        { apiKey: falApiKey },
        file,
        { objectName, outputFormat: 'glb', removeBackground: true },
        (status) => console.log('[MinimalTrainFlow] Generation status:', status)
      );

      console.log('[MinimalTrainFlow] Generated object:', generated);
      console.log('[MinimalTrainFlow] Mesh URL:', generated.meshUrl);

      if (!generated.meshUrl) {
        throw new Error('No mesh URL returned from 3D generation');
      }

      const existingPositions = objects.map(o => o.position as [number, number, number]);
      const placement = getOptimalPlacement(generated.dimensions, { avoidPositions: existingPositions });

      console.log('[MinimalTrainFlow] Spawning at position:', placement.position);

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

      console.log('[MinimalTrainFlow] Object spawned successfully');

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
              <button
                onClick={() => setObjectMode('library')}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Box className="w-6 h-6" />
                Use Standard Object
              </button>
              <button
                onClick={() => setObjectMode('photo')}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-2xl text-white font-semibold text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <Camera className="w-6 h-6" />
                Upload Photo
              </button>
              <p className="text-center text-sm text-slate-500 mt-2">
                Standard objects work instantly. Photos take ~20s to convert.
              </p>
            </div>
          );
        }

        // Library object selection
        if (objectMode === 'library') {
          const filteredObjects = PRIMITIVE_OBJECTS.filter(obj => obj.category === selectedCategory);
          return (
            <div className="space-y-3">
              <button
                onClick={() => setObjectMode('choose')}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

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

      {/* Footer hint */}
      {step !== 'done' && (
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onOpenDrawer}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm transition"
          >
            Need manual controls?
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
