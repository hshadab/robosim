import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Upload,
  Folder,
  Film,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import {
  importDataset,
  cleanupImportedDataset,
  getFrameIndexAtTime,
  interpolateFrames,
  type ImportedDataset,
} from '../../lib/lerobotImporter';
import type { Frame } from '../../lib/datasetExporter';

type PlaybackSpeed = 0.25 | 0.5 | 1 | 2;

export const DatasetPlayerPanel: React.FC = () => {
  const { setJoints, activeRobotType } = useAppStore();

  // Dataset state
  const [dataset, setDataset] = useState<ImportedDataset | null>(null);
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);

  // UI state
  const [showStats, setShowStats] = useState(false);
  const [showEpisodeList, setShowEpisodeList] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentEpisode = dataset?.episodes[currentEpisodeIndex];
  const currentFrame = currentEpisode?.frames[currentFrameIndex];
  const totalFrames = currentEpisode?.frames.length || 0;
  const duration = currentEpisode?.metadata.duration || 0;

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportProgress(0);
    setImportMessage('Starting import...');

    try {
      const imported = await importDataset(file, (progress, message) => {
        setImportProgress(progress);
        setImportMessage(message);
      });

      // Cleanup previous dataset
      if (dataset) {
        cleanupImportedDataset(dataset);
      }

      setDataset(imported);
      setCurrentEpisodeIndex(0);
      setCurrentFrameIndex(0);
      setIsPlaying(false);
      setImportProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportProgress(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Apply frame to robot
  const applyFrame = useCallback(
    (frame: Frame) => {
      if (activeRobotType !== 'arm') return;

      // Map LeRobot joint positions back to RoboSim joints
      const positions = frame.observation.jointPositions;
      setJoints({
        base: positions[0] || 0,
        shoulder: positions[1] || 0,
        elbow: positions[2] || 0,
        wrist: positions[3] || 0,
        wristRoll: positions[4] || 0,
        gripper: positions[5] || 0,
      });
    },
    [activeRobotType, setJoints]
  );

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying || !currentEpisode) return;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = timestamp;
      }

      const deltaMs = (timestamp - lastTimeRef.current) * playbackSpeed;
      lastTimeRef.current = timestamp;

      const currentTimeMs = currentFrame?.timestamp || 0;
      const newTimeMs = currentTimeMs + deltaMs;

      // Find next frame
      const newFrameIndex = getFrameIndexAtTime(currentEpisode, newTimeMs);

      if (newFrameIndex >= totalFrames - 1) {
        // End of episode
        setCurrentFrameIndex(totalFrames - 1);
        setIsPlaying(false);
        lastTimeRef.current = 0;
        return;
      }

      // Apply interpolated frame for smooth playback
      if (newFrameIndex < totalFrames - 1) {
        const frame1 = currentEpisode.frames[newFrameIndex];
        const frame2 = currentEpisode.frames[newFrameIndex + 1];
        const t = (newTimeMs - frame1.timestamp) / (frame2.timestamp - frame1.timestamp);
        const interpolated = interpolateFrames(frame1, frame2, Math.max(0, Math.min(1, t)));
        applyFrame(interpolated);
      }

      setCurrentFrameIndex(newFrameIndex);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = 0;
    };
  }, [isPlaying, currentEpisode, currentFrame, totalFrames, playbackSpeed, applyFrame]);

  // Sync video with playback
  useEffect(() => {
    if (videoRef.current && dataset?.videoUrls?.[currentEpisodeIndex]) {
      const video = videoRef.current;
      const frameTime = (currentFrame?.timestamp || 0) / 1000;

      if (isPlaying) {
        video.playbackRate = playbackSpeed;
        if (video.paused) {
          video.currentTime = frameTime;
          video.play().catch(() => {});
        }
      } else {
        video.pause();
        video.currentTime = frameTime;
      }
    }
  }, [isPlaying, currentFrame, playbackSpeed, dataset, currentEpisodeIndex]);

  // Play/Pause toggle
  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // If at end, restart from beginning
      if (currentFrameIndex >= totalFrames - 1) {
        setCurrentFrameIndex(0);
      }
      setIsPlaying(true);
    }
  };

  // Seek to frame
  const seekToFrame = (frameIndex: number) => {
    const clamped = Math.max(0, Math.min(frameIndex, totalFrames - 1));
    setCurrentFrameIndex(clamped);

    if (currentEpisode?.frames[clamped]) {
      applyFrame(currentEpisode.frames[clamped]);
    }
  };

  // Episode navigation
  const goToEpisode = (index: number) => {
    setCurrentEpisodeIndex(index);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setShowEpisodeList(false);
  };

  const prevEpisode = () => {
    if (currentEpisodeIndex > 0) {
      goToEpisode(currentEpisodeIndex - 1);
    }
  };

  const nextEpisode = () => {
    if (dataset && currentEpisodeIndex < dataset.episodes.length - 1) {
      goToEpisode(currentEpisodeIndex + 1);
    }
  };

  // Clear dataset
  const clearDataset = () => {
    if (dataset) {
      cleanupImportedDataset(dataset);
    }
    setDataset(null);
    setCurrentEpisodeIndex(0);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    setError(null);
  };

  // Format time display
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-cyan-400" />
          Dataset Playback
        </h3>
        {dataset && (
          <button
            onClick={clearDataset}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
            title="Close dataset"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Import Progress */}
      {importProgress !== null && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{importMessage}</span>
            <span>{Math.round(importProgress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-200"
              style={{ width: `${importProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-3 p-2 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-400">
          {error}
        </div>
      )}

      {/* No Dataset - Import Button */}
      {!dataset && importProgress === null && (
        <div className="text-center py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Import Dataset
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            Supports LeRobot (.zip) and RoboSim (.json)
          </p>
        </div>
      )}

      {/* Dataset Loaded */}
      {dataset && (
        <>
          {/* Dataset Info */}
          <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-white truncate max-w-[150px]">
                  {dataset.metadata.name}
                </span>
              </div>
              <button
                onClick={() => setShowStats(!showStats)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                {showStats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showStats && (
              <div className="mt-2 pt-2 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Episodes:</span>
                  <span className="text-slate-300 ml-1">{dataset.episodes.length}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total Frames:</span>
                  <span className="text-slate-300 ml-1">{dataset.metadata.totalFrames}</span>
                </div>
                <div>
                  <span className="text-slate-500">Robot:</span>
                  <span className="text-slate-300 ml-1">{dataset.metadata.robotId}</span>
                </div>
                <div>
                  <span className="text-slate-500">Format:</span>
                  <span className="text-slate-300 ml-1">{dataset.sourceFormat}</span>
                </div>
              </div>
            )}
          </div>

          {/* Video Preview (if available) */}
          {dataset.videoUrls?.[currentEpisodeIndex] && (
            <div className="mb-3 rounded-lg overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                src={dataset.videoUrls[currentEpisodeIndex]}
                className="w-full h-full object-contain"
                muted
                playsInline
              />
            </div>
          )}

          {/* Episode Selector */}
          <div className="mb-3">
            <button
              onClick={() => setShowEpisodeList(!showEpisodeList)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/50 rounded-lg text-sm hover:bg-slate-900/70 transition-colors"
            >
              <span className="text-slate-300">
                Episode {currentEpisodeIndex + 1} / {dataset.episodes.length}
              </span>
              <div className="flex items-center gap-2">
                {currentEpisode?.metadata.success ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                {showEpisodeList ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {showEpisodeList && (
              <div className="mt-1 max-h-32 overflow-y-auto bg-slate-900/50 rounded-lg">
                {dataset.episodes.map((ep, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToEpisode(idx)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors ${
                      idx === currentEpisodeIndex ? 'bg-slate-800 text-white' : 'text-slate-400'
                    }`}
                  >
                    <span>Episode {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <span>{ep.frames.length} frames</span>
                      {ep.metadata.success ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="space-y-3">
            {/* Timeline Scrubber */}
            <div>
              <input
                type="range"
                min={0}
                max={totalFrames - 1}
                value={currentFrameIndex}
                onChange={(e) => seekToFrame(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                  [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>{formatTime(currentFrame?.timestamp || 0)}</span>
                <span>
                  Frame {currentFrameIndex + 1} / {totalFrames}
                </span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevEpisode}
                disabled={currentEpisodeIndex === 0}
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={togglePlayback}
                className="px-6"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={nextEpisode}
                disabled={!dataset || currentEpisodeIndex === dataset.episodes.length - 1}
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Speed Control */}
            <div className="flex items-center justify-center gap-1">
              {([0.25, 0.5, 1, 2] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    playbackSpeed === speed
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
