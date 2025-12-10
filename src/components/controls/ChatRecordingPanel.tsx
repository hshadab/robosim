/**
 * Chat-Based Recording Panel
 *
 * Records robot demonstrations while you chat with the LLM.
 * Every command you give becomes a labeled training episode.
 *
 * Flow:
 * 1. Start recording session
 * 2. Chat naturally with the robot ("pick up the red block")
 * 3. Each command creates an episode with the language instruction
 * 4. Export all episodes as a LeRobot dataset
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Download,
  Trash2,
  Database,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Video,
  Mic,
  Play,
  Square,
  Sparkles,
  Clock,
  Activity,
  Target,
  BarChart3,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { DatasetRecorder, type Episode } from '../../lib/datasetExporter';
import { exportLeRobotDataset, validateForLeRobot } from '../../lib/lerobotExporter';
import { CanvasVideoRecorder } from '../../lib/videoRecorder';
import { augmentDataset, type AugmentationConfig } from '../../lib/trajectoryAugmentation';
import {
  calculateQualityMetrics,
  getQualityLevel,
  getQualityColor,
  type EpisodeQualityMetrics,
} from '../../lib/teleoperationGuide';

interface RecordingSession {
  id: string;
  startTime: number;
  episodes: Episode[];
  qualityMetrics: EpisodeQualityMetrics[];
  totalCommands: number;
}

/**
 * Chat-Based Recording Panel Component
 *
 * Records robot movements triggered by chat commands.
 */
export const ChatRecordingPanel: React.FC = () => {
  const {
    joints,
    activeRobotType,
    selectedRobotId,
    wheeledRobot,
    drone,
    humanoid,
    messages,
  } = useAppStore();

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSession, setCurrentSession] = useState<RecordingSession | null>(null);
  const [isRecordingEpisode, setIsRecordingEpisode] = useState(false);

  // Current episode state
  const [currentInstruction, setCurrentInstruction] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  // Settings
  const [expanded, setExpanded] = useState(true);
  const [recordVideo, setRecordVideo] = useState(true);
  const [autoRecord, setAutoRecord] = useState(true);
  const [datasetName, setDatasetName] = useState('chat_demonstrations');

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [enableAugmentation, setEnableAugmentation] = useState(false);

  // Refs
  const recorderRef = useRef<DatasetRecorder | null>(null);
  const videoRecorderRef = useRef<CanvasVideoRecorder | null>(null);
  const intervalRef = useRef<number | null>(null);
  const recordedFramesRef = useRef<Array<{ timestamp: number; jointPositions: number[] }>>([]);
  const lastMessageCountRef = useRef(0);

  // Get current robot state
  const getCurrentState = useCallback(() => {
    switch (activeRobotType) {
      case 'wheeled': return wheeledRobot;
      case 'drone': return drone;
      case 'humanoid': return humanoid;
      default: return joints;
    }
  }, [activeRobotType, joints, wheeledRobot, drone, humanoid]);

  // Get joint positions array
  const getJointPositions = useCallback((): number[] => {
    const state = getCurrentState();
    if ('base' in state) {
      return [state.base, state.shoulder, state.elbow, state.wrist, state.wristRoll, state.gripper];
    }
    return [];
  }, [getCurrentState]);

  // Start recording session
  const startSession = useCallback(() => {
    const session: RecordingSession = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      episodes: [],
      qualityMetrics: [],
      totalCommands: 0,
    };
    setCurrentSession(session);
    setSessionActive(true);
    lastMessageCountRef.current = messages.length;
  }, [messages.length]);

  // End recording session
  const endSession = useCallback(() => {
    if (isRecordingEpisode) {
      stopEpisodeRecording(false);
    }
    setSessionActive(false);
  }, [isRecordingEpisode]);

  // Start recording an episode
  const startEpisodeRecording = useCallback((instruction: string) => {
    if (!sessionActive || isRecordingEpisode) return;

    recorderRef.current = new DatasetRecorder(activeRobotType, selectedRobotId);
    recorderRef.current.startEpisode();
    recordedFramesRef.current = [];

    if (recordVideo) {
      videoRecorderRef.current = new CanvasVideoRecorder({ fps: 30 });
      const canvas = videoRecorderRef.current.findThreeCanvas();
      if (canvas) {
        videoRecorderRef.current.start();
      }
    }

    setCurrentInstruction(instruction);
    setIsRecordingEpisode(true);
    setFrameCount(0);

    // Start recording frames
    intervalRef.current = window.setInterval(() => {
      if (recorderRef.current?.recording) {
        const imageDataUrl = recordVideo ? videoRecorderRef.current?.captureFrame() : undefined;
        recorderRef.current.recordFrame(getCurrentState(), {}, imageDataUrl || undefined);
        setFrameCount(recorderRef.current.frameCount);

        // Track for quality calculation
        recordedFramesRef.current.push({
          timestamp: performance.now(),
          jointPositions: getJointPositions(),
        });
      }
    }, 33); // ~30 fps
  }, [sessionActive, isRecordingEpisode, activeRobotType, selectedRobotId, recordVideo, getCurrentState, getJointPositions]);

  // Stop recording an episode
  const stopEpisodeRecording = useCallback(async (success: boolean = true) => {
    if (!isRecordingEpisode || !recorderRef.current) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop video recording
    if (videoRecorderRef.current?.recording) {
      await videoRecorderRef.current.stop();
    }

    // End episode
    const taskName = currentInstruction?.split(' ').slice(0, 3).join('_') || 'chat_command';
    const episode = recorderRef.current.endEpisode(success, taskName, currentInstruction || undefined);

    // Calculate quality metrics
    const metrics = calculateQualityMetrics(recordedFramesRef.current);

    // Add to session
    setCurrentSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        episodes: [...prev.episodes, episode],
        qualityMetrics: [...prev.qualityMetrics, metrics],
        totalCommands: prev.totalCommands + 1,
      };
    });

    setIsRecordingEpisode(false);
    setCurrentInstruction(null);
    setFrameCount(0);
  }, [isRecordingEpisode, currentInstruction]);

  // Watch for new chat messages and auto-record
  useEffect(() => {
    if (!sessionActive || !autoRecord) return;

    // Check for new user messages
    if (messages.length > lastMessageCountRef.current) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      lastMessageCountRef.current = messages.length;

      // Find user messages that could be commands
      for (const msg of newMessages) {
        if (msg.role === 'user') {
          // This is a new user command - start recording
          if (!isRecordingEpisode) {
            startEpisodeRecording(msg.content);
          }
        } else if (msg.role === 'assistant' && isRecordingEpisode) {
          // Assistant responded - robot might have moved, wait a bit then stop
          setTimeout(() => {
            if (isRecordingEpisode) {
              stopEpisodeRecording(true);
            }
          }, 2000); // Give 2 seconds for motion to complete
        }
      }
    }
  }, [messages, sessionActive, autoRecord, isRecordingEpisode, startEpisodeRecording, stopEpisodeRecording]);

  // Export dataset
  const handleExport = useCallback(async () => {
    if (!currentSession || currentSession.episodes.length === 0) return;

    setIsExporting(true);
    try {
      let episodes = currentSession.episodes;

      if (enableAugmentation) {
        const augConfig: Partial<AugmentationConfig> = {
          actionNoiseStd: 2.0,
          numAugmentations: 5,
          timeStretchRange: [0.9, 1.1],
          spatialJitter: 1.0,
        };
        episodes = augmentDataset(episodes, augConfig);
      }

      const validation = validateForLeRobot(currentSession.episodes);
      if (!validation.valid) {
        alert(`Warning: ${validation.errors.join(', ')}`);
      }

      await exportLeRobotDataset(
        episodes,
        datasetName,
        selectedRobotId,
        30
      );
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Check console for details.');
    }
    setIsExporting(false);
  }, [currentSession, enableAugmentation, datasetName, selectedRobotId]);

  // Clear session
  const clearSession = useCallback(() => {
    setCurrentSession(prev => prev ? {
      ...prev,
      episodes: [],
      qualityMetrics: [],
      totalCommands: 0,
    } : null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Calculate stats
  const stats = currentSession ? {
    episodeCount: currentSession.episodes.length,
    totalFrames: currentSession.episodes.reduce((sum, ep) => sum + ep.frames.length, 0),
    totalDuration: currentSession.episodes.reduce((sum, ep) => sum + ep.metadata.duration, 0) / 1000,
    avgQuality: currentSession.qualityMetrics.length > 0
      ? Math.round(currentSession.qualityMetrics.reduce((sum, m) => sum + m.overallScore, 0) / currentSession.qualityMetrics.length)
      : 0,
    successRate: currentSession.episodes.length > 0
      ? Math.round((currentSession.episodes.filter(ep => ep.metadata.success).length / currentSession.episodes.length) * 100)
      : 0,
  } : null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          Chat → Training Data
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            LIVE
          </span>
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Description */}
          <p className="text-xs text-slate-400 mb-3">
            Chat with the robot naturally. Each command becomes a labeled training episode.
          </p>

          {/* Session Controls */}
          <div className="mb-3">
            {!sessionActive ? (
              <Button
                variant="primary"
                size="sm"
                onClick={startSession}
                className="w-full bg-blue-600 hover:bg-blue-500"
              >
                <Play className="w-3 h-3 mr-1" />
                Start Recording Session
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={endSession}
                  className="flex-1"
                >
                  <Square className="w-3 h-3 mr-1" />
                  End Session
                </Button>
              </div>
            )}
          </div>

          {/* Recording Indicator */}
          {isRecordingEpisode && currentInstruction && (
            <div className="mb-3 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-red-400 text-sm mb-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="font-medium">Recording Command</span>
              </div>
              <p className="text-xs text-red-300 truncate">"{currentInstruction}"</p>
              <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
                <span>{frameCount} frames</span>
                <span>•</span>
                <span>{(frameCount / 30).toFixed(1)}s</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => stopEpisodeRecording(true)}
                  className="flex-1 text-xs"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Mark Success
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => stopEpisodeRecording(false)}
                  className="flex-1 text-xs"
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Mark Fail
                </Button>
              </div>
            </div>
          )}

          {/* Session Active Indicator */}
          {sessionActive && !isRecordingEpisode && (
            <div className="mb-3 p-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-400 text-sm">
                <Mic className="w-4 h-4" />
                <span>Session Active - Chat with the robot!</span>
              </div>
              {autoRecord && (
                <p className="text-xs text-blue-300 mt-1">
                  Auto-recording enabled: commands will be captured automatically
                </p>
              )}
            </div>
          )}

          {/* Settings */}
          {sessionActive && (
            <div className="mb-3 p-2 bg-slate-900/30 rounded-lg space-y-2">
              {/* Auto Record Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Auto-record on chat</span>
                <button
                  onClick={() => setAutoRecord(!autoRecord)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    autoRecord ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      autoRecord ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
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
                    recordVideo ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full transition-transform ${
                      recordVideo ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Dataset Name */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Dataset Name</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
                />
              </div>
            </div>
          )}

          {/* Session Stats */}
          {stats && stats.episodeCount > 0 && (
            <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <Database className="w-4 h-4" />
                {stats.episodeCount} Episodes Recorded
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    Frames
                  </span>
                  <span className="text-white">{stats.totalFrames}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Duration
                  </span>
                  <span className="text-white">{stats.totalDuration.toFixed(1)}s</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Success
                  </span>
                  <span className={stats.successRate >= 50 ? 'text-green-400' : 'text-red-400'}>
                    {stats.successRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-slate-800/50 rounded">
                  <span className="text-slate-400 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" />
                    Quality
                  </span>
                  <span
                    style={{ color: getQualityColor(getQualityLevel(stats.avgQuality)) }}
                  >
                    {stats.avgQuality}%
                  </span>
                </div>
              </div>

              {/* Episode List */}
              {currentSession && currentSession.episodes.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                  {currentSession.episodes.map((ep, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs px-2 py-1 bg-slate-800/50 rounded"
                    >
                      <span className="text-slate-300 truncate flex-1 mr-2">
                        {ep.metadata.languageInstruction || `Episode ${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">{ep.frames.length}f</span>
                        {ep.metadata.success ? (
                          <CheckCircle className="w-3 h-3 text-green-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Augmentation Toggle */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Data Augmentation (5x)
                </span>
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

              {/* Export Buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  {isExporting ? 'Exporting...' : 'Export LeRobot'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSession}
                  disabled={isExporting}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Workflow Tips - show when quality could be improved */}
              {stats.avgQuality < 70 && stats.episodeCount >= 3 && (
                <div className="mt-3 p-2 bg-amber-900/20 border border-amber-700/30 rounded-lg">
                  <p className="text-xs text-amber-300">
                    <strong>Tip:</strong> Quality score is {stats.avgQuality}%. For smoother demonstrations, try <strong>Guided Recording</strong> with visual guides.
                  </p>
                </div>
              )}
              {stats.episodeCount >= 10 && stats.episodeCount < 50 && (
                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                  <p className="text-xs text-blue-300">
                    <strong>Tip:</strong> Good start! Use <strong>Data Augmentation</strong> or <strong>LLM Batch Recording</strong> to scale to 50+ episodes for better training.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Usage Tips */}
          {!sessionActive && (
            <div className="p-2 bg-slate-900/30 rounded-lg text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Click "Start Recording Session"</li>
                <li>Chat with the robot: "Pick up the red block"</li>
                <li>Each command is recorded with the language instruction</li>
                <li>Export as LeRobot dataset for training</li>
              </ol>
              <p className="mt-2 text-slate-500 border-t border-slate-700/50 pt-2">
                <strong className="text-slate-400">Workflow:</strong> Start here for quick data, then use Guided Recording for higher quality or Batch Generation for more volume.
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50 mt-3">
            <p className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              Language-conditioned data from natural chat
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatRecordingPanel;
