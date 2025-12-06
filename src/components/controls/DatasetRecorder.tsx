import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { DatasetRecorder as Recorder, downloadDataset, type Episode } from '../../lib/datasetExporter';
import { exportLeRobotDataset, validateForLeRobot } from '../../lib/lerobotExporter';
import { CanvasVideoRecorder } from '../../lib/videoRecorder';

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
  const [datasetName, setDatasetName] = useState('robosim_dataset');
  const [showSettings, setShowSettings] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Refs
  const recorderRef = useRef<Recorder | null>(null);
  const videoRecorderRef = useRef<CanvasVideoRecorder | null>(null);
  const intervalRef = useRef<number | null>(null);

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

  const startRecording = () => {
    // Initialize data recorder
    recorderRef.current = new Recorder(activeRobotType, selectedRobotId);
    recorderRef.current.startEpisode();

    // Initialize video recorder if enabled
    if (recordVideo) {
      videoRecorderRef.current = new CanvasVideoRecorder({ fps: 30 });
      const canvas = videoRecorderRef.current.findThreeCanvas();
      if (canvas) {
        videoRecorderRef.current.start();
      } else {
        console.warn('Could not find canvas for video recording');
      }
    }

    setIsRecording(true);
    setFrameCount(0);

    // Record frames at 30 FPS
    intervalRef.current = window.setInterval(() => {
      if (recorderRef.current?.recording) {
        // Capture frame with optional image
        const imageDataUrl = recordVideo ? videoRecorderRef.current?.captureFrame() : undefined;
        recorderRef.current.recordFrame(getCurrentState(), {}, imageDataUrl || undefined);
        setFrameCount(recorderRef.current.frameCount);
      }
    }, 33);
  };

  const stopRecording = async (success = true) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop video recording and get blob
    let videoBlob: Blob | null = null;
    if (videoRecorderRef.current?.recording) {
      videoBlob = await videoRecorderRef.current.stop();
    }

    if (recorderRef.current) {
      const episode = recorderRef.current.endEpisode(success, taskName);
      setEpisodes((prev) => [...prev, episode]);

      // Store video blob
      if (videoBlob) {
        setVideoBlobs((prev) => [...prev, videoBlob!]);
      }
    }

    setIsRecording(false);
  };

  const clearEpisodes = () => {
    setEpisodes([]);
    setVideoBlobs([]);
  };

  const exportDataset = async () => {
    if (episodes.length === 0) return;

    setIsExporting(true);

    try {
      if (exportFormat === 'lerobot') {
        // Validate first
        const validation = validateForLeRobot(episodes);
        if (!validation.valid) {
          console.error('Validation errors:', validation.errors);
          alert(`Cannot export: ${validation.errors.join(', ')}`);
          setIsExporting(false);
          return;
        }

        // Export LeRobot format
        await exportLeRobotDataset(
          episodes,
          datasetName,
          selectedRobotId,
          30, // fps
          recordVideo ? videoBlobs : undefined
        );
      } else {
        // Export JSON format
        const name = `${datasetName}_${Date.now()}`;
        downloadDataset(episodes, name, 'json');
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
            <label className="text-xs text-slate-400 block mb-1">Task Description</label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-white"
              placeholder="pick_and_place"
            />
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
      <div className="flex items-center gap-2 mb-3">
        {!isRecording ? (
          <Button
            variant="primary"
            size="sm"
            onClick={startRecording}
            leftIcon={<Circle className="w-3 h-3 fill-current" />}
          >
            Record
          </Button>
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
