import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Circle,
  Download,
  Trash2,
  Database,
  Video,
  CheckCircle,
  XCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Play,
  Square,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { DatasetRecorder as Recorder, downloadDataset, type Episode } from '../../lib/datasetExporter';
import { exportLeRobotDataset, validateForLeRobot } from '../../lib/lerobotExporter';
import { CanvasVideoRecorder } from '../../lib/videoRecorder';
import { augmentDataset, type AugmentationConfig } from '../../lib/trajectoryAugmentation';

type ExportFormat = 'json' | 'lerobot';

export const DatasetRecorderPanel: React.FC = () => {
  const { joints, activeRobotType, selectedRobotId, wheeledRobot, drone, humanoid } = useAppStore();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [videoBlobs, setVideoBlobs] = useState<Blob[]>([]);

  // UI state
  const [exportFormat, setExportFormat] = useState<ExportFormat>('lerobot');
  const [recordVideo, setRecordVideo] = useState(true);
  const [taskName, setTaskName] = useState('manipulation_task');
  const [languageInstruction, setLanguageInstruction] = useState('');
  const [datasetName, setDatasetName] = useState('robosim_dataset');
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Batch recording state
  const [batchMode, setBatchMode] = useState(false);
  const [batchTarget, setBatchTarget] = useState(10);
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [batchPaused, setBatchPaused] = useState(false);
  const [pauseBetweenEpisodes, setPauseBetweenEpisodes] = useState(2); // seconds

  // Augmentation state
  const [enableAugmentation, setEnableAugmentation] = useState(false);
  const [augmentationMultiplier, setAugmentationMultiplier] = useState(5);
  const [actionNoiseStd, setActionNoiseStd] = useState(2.0);

  // Refs
  const recorderRef = useRef<Recorder | null>(null);
  const videoRecorderRef = useRef<CanvasVideoRecorder | null>(null);
  const intervalRef = useRef<number | null>(null);
  const batchTimerRef = useRef<number | null>(null);
  const frameCountRef = useRef(0); // Avoid re-renders on every frame
  const lastUiUpdateRef = useRef(0); // Throttle UI updates
  const imageIntervalRef = useRef<number | null>(null); // Separate interval for images

  // Get current state based on robot type
  const getCurrentState = () => {
    switch (activeRobotType) {
      case 'wheeled':
        return wheeledRobot;
      case 'drone':
        return drone;
      case 'humanoid':
        return humanoid;
      default:
        return joints;
    }
  };

  const startRecording = async () => {
    // Initialize data recorder
    recorderRef.current = new Recorder(activeRobotType, selectedRobotId);
    recorderRef.current.startEpisode();

    // Reset frame tracking
    frameCountRef.current = 0;
    lastUiUpdateRef.current = Date.now();

    // Initialize video recorder if enabled
    if (recordVideo) {
      videoRecorderRef.current = new CanvasVideoRecorder({ fps: 30 });

      // Initialize the Web Worker for non-blocking encoding
      await videoRecorderRef.current.initializeEncoder();

      const canvas = videoRecorderRef.current.findThreeCanvas();
      if (canvas) {
        videoRecorderRef.current.start();
      } else {
        console.warn('Could not find canvas for video recording');
      }
    }

    setIsRecording(true);
    setFrameCount(0);

    // OPTIMIZATION 1: Record joint data at 30 FPS (fast, no encoding)
    intervalRef.current = window.setInterval(() => {
      if (recorderRef.current?.recording) {
        // Record frame WITHOUT image (images captured separately at lower rate)
        recorderRef.current.recordFrame(getCurrentState(), {}, undefined);
        frameCountRef.current = recorderRef.current.frameCount;

        // OPTIMIZATION 4: Throttle UI updates to every 500ms
        const now = Date.now();
        if (now - lastUiUpdateRef.current > 500) {
          setFrameCount(frameCountRef.current);
          lastUiUpdateRef.current = now;
        }
      }
    }, 33); // 30 FPS for joint data

    // OPTIMIZATION 2: Capture images at 10 FPS (non-blocking)
    if (recordVideo) {
      imageIntervalRef.current = window.setInterval(async () => {
        if (recorderRef.current?.recording && videoRecorderRef.current) {
          // OPTIMIZATION 3: Use Web Worker for encoding (non-blocking)
          const imageDataUrl = await videoRecorderRef.current.captureFrameNonBlocking();
          if (imageDataUrl && recorderRef.current.recording) {
            // Attach image to the most recent frame
            const frames = recorderRef.current.getCurrentFrames?.();
            if (frames && frames.length > 0) {
              const lastFrame = frames[frames.length - 1];
              if (lastFrame && !lastFrame.observation.image) {
                lastFrame.observation.image = imageDataUrl;
              }
            }
          }
        }
      }, 100); // 10 FPS for images (3x less encoding work)
    }
  };

  const stopRecording = async (success = true) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop image capture interval
    if (imageIntervalRef.current) {
      clearInterval(imageIntervalRef.current);
      imageIntervalRef.current = null;
    }

    // Final UI update with accurate frame count
    setFrameCount(frameCountRef.current);

    // Stop video recording and get blob
    let videoBlob: Blob | null = null;
    if (videoRecorderRef.current?.recording) {
      videoBlob = await videoRecorderRef.current.stop();
    }

    if (recorderRef.current) {
      const episode = recorderRef.current.endEpisode(success, taskName, languageInstruction || undefined);
      setEpisodes((prev) => [...prev, episode]);

      // Store video blob
      if (videoBlob) {
        setVideoBlobs((prev) => [...prev, videoBlob!]);
      }
    }

    setIsRecording(false);

    // If in batch mode and not paused, schedule next recording
    if (batchMode && !batchPaused && batchCurrent < batchTarget - 1) {
      setBatchCurrent((prev) => prev + 1);
      batchTimerRef.current = window.setTimeout(() => {
        startRecording();
      }, pauseBetweenEpisodes * 1000);
    } else if (batchMode && batchCurrent >= batchTarget - 1) {
      // Batch complete
      setBatchMode(false);
      setBatchCurrent(0);
    }
  };

  // Start batch recording
  const startBatchRecording = useCallback(() => {
    setBatchMode(true);
    setBatchCurrent(0);
    setBatchPaused(false);
    startRecording();
  }, [startRecording]);

  // Pause/resume batch
  const toggleBatchPause = useCallback(() => {
    if (batchPaused) {
      // Resume - start next episode
      setBatchPaused(false);
      if (!isRecording) {
        startRecording();
      }
    } else {
      // Pause - stop current recording and don't auto-start next
      setBatchPaused(true);
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    }
  }, [batchPaused, isRecording, startRecording]);

  // Cancel batch recording
  const cancelBatchRecording = useCallback(() => {
    setBatchMode(false);
    setBatchCurrent(0);
    setBatchPaused(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    if (isRecording) {
      stopRecording(false);
    }
  }, [isRecording, stopRecording]);

  const clearEpisodes = () => {
    setEpisodes([]);
    setVideoBlobs([]);
  };

  const exportDataset = async () => {
    if (episodes.length === 0) return;

    setIsExporting(true);

    try {
      // Apply augmentation if enabled
      let episodesToExport = episodes;
      if (enableAugmentation) {
        const augConfig: Partial<AugmentationConfig> = {
          actionNoiseStd,
          numAugmentations: augmentationMultiplier,
          timeStretchRange: [0.9, 1.1],
          spatialJitter: 1.0,
        };
        episodesToExport = augmentDataset(episodes, augConfig);
      }

      if (exportFormat === 'lerobot') {
        // Validate first (use original episodes for validation)
        const validation = validateForLeRobot(episodes);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
          alert(`Cannot export: ${validation.errors.join(', ')}`);
          setIsExporting(false);
          return;
        }

        // Export LeRobot format
        await exportLeRobotDataset(
          episodesToExport,
          datasetName,
          selectedRobotId,
          30, // fps
          // Only include videos for original episodes when not augmenting
          enableAugmentation ? undefined : (recordVideo ? videoBlobs : undefined)
        );
      } else {
        // Export JSON format
        const name = `${datasetName}_${Date.now()}`;
        downloadDataset(episodesToExport, name, 'json');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Check console for details.');
    }

    setIsExporting(false);
  };

  // Validation info
  const validation = episodes.length > 0 ? validateForLeRobot(episodes) : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (imageIntervalRef.current) {
        clearInterval(imageIntervalRef.current);
      }
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  // Calculate totals
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const totalDuration = episodes.reduce((sum, ep) => sum + ep.metadata.duration, 0) / 1000;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-400" />
          LeRobot Dataset
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg space-y-3">
          {/* Dataset Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Dataset Name</label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="my_dataset"
            />
          </div>

          {/* Task Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Task Category</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="pick_and_place"
            />
          </div>

          {/* Language Instruction - Key for language-conditioned learning */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Language Instruction
              <span className="text-purple-400 ml-1">(for RT-1/OpenVLA training)</span>
            </label>
            <textarea
              value={languageInstruction}
              onChange={(e) => setLanguageInstruction(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-white resize-none"
              placeholder="Pick up the red cube and place it on the green target"
              rows={2}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Natural language description of the task for language-conditioned imitation learning
            </p>
          </div>

          {/* Export Format */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Export Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setExportFormat('lerobot')}
                className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${
                  exportFormat === 'lerobot'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                LeRobot v3.0
              </button>
              <button
                onClick={() => setExportFormat('json')}
                className={`flex-1 px-3 py-1.5 text-xs rounded transition-colors ${
                  exportFormat === 'json'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                JSON
              </button>
            </div>
          </div>

          {/* Video Recording Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Video className="w-3 h-3" />
              Record Video
            </span>
            <button
              onClick={() => setRecordVideo(!recordVideo)}
              className={`w-10 h-5 rounded-full transition-colors ${
                recordVideo ? 'bg-purple-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  recordVideo ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Batch Recording Settings */}
          <div className="border-t border-slate-700/50 pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-3 h-3 text-purple-400" />
              <span className="text-xs text-slate-300 font-medium">Batch Recording</span>
            </div>

            {/* Batch Target */}
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-slate-400 w-20">Episodes:</label>
              <select
                value={batchTarget}
                onChange={(e) => setBatchTarget(Number(e.target.value))}
                className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                disabled={batchMode}
              >
                <option value={5}>5 episodes</option>
                <option value={10}>10 episodes</option>
                <option value={25}>25 episodes</option>
                <option value={50}>50 episodes</option>
                <option value={100}>100 episodes</option>
              </select>
            </div>

            {/* Pause Between Episodes */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 w-20">Pause:</label>
              <select
                value={pauseBetweenEpisodes}
                onChange={(e) => setPauseBetweenEpisodes(Number(e.target.value))}
                className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                disabled={batchMode}
              >
                <option value={1}>1 second</option>
                <option value={2}>2 seconds</option>
                <option value={3}>3 seconds</option>
                <option value={5}>5 seconds</option>
              </select>
            </div>
          </div>

          {/* Data Augmentation Settings */}
          <div className="border-t border-slate-700/50 pt-3 mt-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3 text-green-400" />
                <span className="text-xs text-slate-300 font-medium">Data Augmentation</span>
              </div>
              <button
                onClick={() => setEnableAugmentation(!enableAugmentation)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  enableAugmentation ? 'bg-green-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    enableAugmentation ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {enableAugmentation && (
              <>
                {/* Multiplier */}
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-400 w-20">Multiplier:</label>
                  <select
                    value={augmentationMultiplier}
                    onChange={(e) => setAugmentationMultiplier(Number(e.target.value))}
                    className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                  >
                    <option value={2}>2x (1 orig + 2 aug)</option>
                    <option value={5}>5x (1 orig + 5 aug)</option>
                    <option value={10}>10x (1 orig + 10 aug)</option>
                    <option value={20}>20x (1 orig + 20 aug)</option>
                  </select>
                </div>

                {/* Noise Level */}
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-400 w-20">Noise:</label>
                  <select
                    value={actionNoiseStd}
                    onChange={(e) => setActionNoiseStd(Number(e.target.value))}
                    className="flex-1 px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                  >
                    <option value={0.5}>Low (±0.5°)</option>
                    <option value={1.0}>Medium-Low (±1°)</option>
                    <option value={2.0}>Medium (±2°)</option>
                    <option value={3.0}>Medium-High (±3°)</option>
                    <option value={5.0}>High (±5°)</option>
                  </select>
                </div>

                {/* Preview Stats */}
                {episodes.length > 0 && (
                  <div className="text-xs text-green-300 bg-green-900/20 px-2 py-1 rounded">
                    {episodes.length} episodes → {episodes.length * (augmentationMultiplier + 1)} total
                  </div>
                )}
              </>
            )}
          </div>

          {/* LeRobot Link */}
          {exportFormat === 'lerobot' && (
            <a
              href="https://huggingface.co/docs/lerobot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
            >
              <ExternalLink className="w-3 h-3" />
              LeRobot Documentation
            </a>
          )}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col gap-2 mb-3">
        {/* Single Episode Recording */}
        {!batchMode && (
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={startRecording}
                  leftIcon={<Circle className="w-3 h-3 fill-current" />}
                >
                  Record
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={startBatchRecording}
                  leftIcon={<Layers className="w-3 h-3" />}
                  title={`Record ${batchTarget} episodes`}
                >
                  Batch ({batchTarget})
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => stopRecording(true)}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Success
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => stopRecording(false)}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Fail
                </Button>
              </>
            )}
          </div>
        )}

        {/* Batch Mode Controls */}
        {batchMode && (
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => stopRecording(true)}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  Success
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => stopRecording(false)}
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  Fail
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={batchPaused ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={toggleBatchPause}
                  leftIcon={batchPaused ? <Play className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                >
                  {batchPaused ? 'Resume' : 'Waiting...'}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelBatchRecording}
              leftIcon={<Square className="w-3 h-3" />}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Batch Progress */}
      {batchMode && (
        <div className="mb-3 p-2 bg-purple-900/30 border border-purple-700/50 rounded-lg">
          <div className="flex items-center justify-between text-sm text-purple-300 mb-1">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Batch Recording
            </span>
            <span>{batchCurrent + 1} / {batchTarget}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-purple-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((batchCurrent + (isRecording ? 0.5 : 0)) / batchTarget) * 100}%` }}
            />
          </div>
          {batchPaused && !isRecording && (
            <div className="text-xs text-yellow-400 mt-1">Paused - Click Resume to continue</div>
          )}
        </div>
      )}

      {/* Recording Status */}
      {isRecording && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-medium">Recording</span>
            <span className="text-red-300">
              {frameCount} frames ({(frameCount / 30).toFixed(1)}s)
            </span>
          </div>
          {recordVideo && (
            <div className="flex items-center gap-1 text-xs text-red-300 mt-1">
              <Video className="w-3 h-3" />
              Video capture active
            </div>
          )}
        </div>
      )}

      {/* Episodes List */}
      {episodes.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-slate-400 mb-2">
            {episodes.length} episode{episodes.length !== 1 ? 's' : ''} &middot; {totalFrames} frames
            &middot; {totalDuration.toFixed(1)}s
          </div>

          {/* Episode mini-list */}
          <div className="max-h-24 overflow-y-auto space-y-1">
            {episodes.map((ep, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs px-2 py-1 bg-slate-900/50 rounded"
              >
                <span className="text-slate-300">Episode {idx + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{ep.frames.length} frames</span>
                  {ep.metadata.success ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Status */}
      {validation && exportFormat === 'lerobot' && (
        <div
          className={`mb-3 p-2 rounded-lg text-xs ${
            validation.valid
              ? 'bg-green-900/30 border border-green-700/50'
              : 'bg-yellow-900/30 border border-yellow-700/50'
          }`}
        >
          <div className="flex items-center gap-1">
            {validation.valid ? (
              <>
                <CheckCircle className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Ready for LeRobot export</span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-yellow-400" />
                <span className="text-yellow-400">{validation.errors.length} issues</span>
              </>
            )}
          </div>
          {validation.warnings.length > 0 && (
            <div className="mt-1 text-yellow-300/70">
              {validation.warnings.slice(0, 2).map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Export Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={exportDataset}
          disabled={episodes.length === 0 || isExporting || isRecording}
          leftIcon={<Download className="w-4 h-4" />}
          className="flex-1"
        >
          {isExporting ? 'Exporting...' : `Export ${exportFormat === 'lerobot' ? 'LeRobot' : 'JSON'}`}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearEpisodes}
          disabled={episodes.length === 0 || isRecording}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* HuggingFace Upload Hint */}
      {exportFormat === 'lerobot' && episodes.length > 0 && (
        <div className="mt-3 p-2 bg-slate-900/50 rounded text-xs text-slate-400">
          <div className="flex items-center gap-1 mb-1">
            <Upload className="w-3 h-3" />
            <span>After export:</span>
          </div>
          <code className="text-purple-300 text-[10px]">
            huggingface-cli upload your-name/{datasetName} ./{datasetName}_lerobot.zip
          </code>
        </div>
      )}
    </div>
  );
};
