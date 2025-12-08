/**
 * Dataset Statistics Dashboard
 *
 * Shows statistics and visualizations for recorded episodes.
 * Helps identify data quality issues and coverage gaps.
 */

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { Episode } from '../../lib/datasetExporter';

interface DatasetStatsProps {
  episodes: Episode[];
}

interface JointStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  range: number;
}

interface DatasetAnalysis {
  totalEpisodes: number;
  totalFrames: number;
  totalDuration: number;
  successRate: number;
  avgEpisodeLength: number;
  avgFramesPerEpisode: number;
  fps: number;
  jointStats: JointStats[];
  actionStats: JointStats[];
  issues: string[];
  recommendations: string[];
}

/**
 * Analyze dataset and compute statistics
 */
function analyzeDataset(episodes: Episode[]): DatasetAnalysis {
  const totalEpisodes = episodes.length;
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const totalDuration = episodes.reduce((sum, ep) => sum + ep.metadata.duration, 0) / 1000;
  const successCount = episodes.filter((ep) => ep.metadata.success).length;
  const successRate = totalEpisodes > 0 ? successCount / totalEpisodes : 0;
  const avgEpisodeLength = totalEpisodes > 0 ? totalDuration / totalEpisodes : 0;
  const avgFramesPerEpisode = totalEpisodes > 0 ? totalFrames / totalEpisodes : 0;
  const fps = totalDuration > 0 ? totalFrames / totalDuration : 30;

  // Compute joint statistics
  const numJoints = episodes[0]?.frames[0]?.observation.jointPositions.length || 6;
  const jointStats: JointStats[] = [];
  const actionStats: JointStats[] = [];

  for (let j = 0; j < numJoints; j++) {
    const positions: number[] = [];
    const actions: number[] = [];

    for (const ep of episodes) {
      for (const frame of ep.frames) {
        if (frame.observation.jointPositions[j] !== undefined) {
          positions.push(frame.observation.jointPositions[j]);
        }
        if (frame.action.jointTargets[j] !== undefined) {
          actions.push(frame.action.jointTargets[j]);
        }
      }
    }

    jointStats.push(computeStats(positions));
    actionStats.push(computeStats(actions));
  }

  // Identify issues and recommendations
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (totalEpisodes < 10) {
    issues.push(`Only ${totalEpisodes} episodes - need at least 50 for training`);
    recommendations.push('Record more demonstrations (aim for 50-100 episodes)');
  }

  if (successRate < 0.5) {
    issues.push(`Low success rate: ${(successRate * 100).toFixed(0)}%`);
    recommendations.push('Focus on completing tasks successfully');
  }

  if (avgEpisodeLength < 2) {
    issues.push('Episodes are very short (< 2 seconds)');
    recommendations.push('Record longer, more complete demonstrations');
  }

  if (avgEpisodeLength > 30) {
    issues.push('Episodes are very long (> 30 seconds)');
    recommendations.push('Consider breaking into shorter subtasks');
  }

  // Check for low variance (not enough diversity)
  for (let j = 0; j < numJoints; j++) {
    if (jointStats[j].std < 0.1) {
      issues.push(`Joint ${j + 1} has low variance - limited movement`);
    }
  }

  if (issues.length === 0 && totalEpisodes >= 50) {
    recommendations.push('Dataset looks good for training!');
  }

  return {
    totalEpisodes,
    totalFrames,
    totalDuration,
    successRate,
    avgEpisodeLength,
    avgFramesPerEpisode,
    fps,
    jointStats,
    actionStats,
    issues,
    recommendations,
  };
}

function computeStats(values: number[]): JointStats {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, std: 0, range: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  return { min, max, mean, std, range: max - min };
}

// MiniBarChart component for future use
// const MiniBarChart: React.FC<{ values: number[]; maxValue: number; color: string }> = ({
//   values,
//   maxValue,
//   color,
// }) => {
//   return (
//     <div className="flex items-end gap-0.5 h-8">
//       {values.map((v, i) => (
//         <div
//           key={i}
//           className={`w-2 rounded-t ${color}`}
//           style={{ height: `${Math.max(2, (v / maxValue) * 100)}%` }}
//         />
//       ))}
//     </div>
//   );
// };

/**
 * Joint coverage visualization
 */
const JointCoverage: React.FC<{ stats: JointStats; jointIndex: number }> = ({
  stats,
  jointIndex,
}) => {
  const jointNames = ['Base', 'Shoulder', 'Elbow', 'Wrist', 'Roll', 'Gripper'];
  const name = jointNames[jointIndex] || `Joint ${jointIndex + 1}`;

  // Normalize to -180 to 180 range for visualization
  const normalizedMin = Math.max(-180, stats.min);
  const normalizedMax = Math.min(180, stats.max);
  const rangeStart = ((normalizedMin + 180) / 360) * 100;
  const rangeWidth = ((normalizedMax - normalizedMin) / 360) * 100;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-16">{name}</span>
      <div className="flex-1 h-2 bg-slate-700 rounded-full relative overflow-hidden">
        <div
          className="absolute h-full bg-blue-500/50 rounded-full"
          style={{ left: `${rangeStart}%`, width: `${rangeWidth}%` }}
        />
        {/* Mean indicator */}
        <div
          className="absolute w-0.5 h-full bg-yellow-400"
          style={{ left: `${((stats.mean + 180) / 360) * 100}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-12 text-right">
        {stats.range.toFixed(0)}°
      </span>
    </div>
  );
};

export const DatasetStatsPanel: React.FC<DatasetStatsProps> = ({ episodes }) => {
  const [expanded, setExpanded] = useState(true);
  const [showJointDetails, setShowJointDetails] = useState(false);

  const analysis = useMemo(() => analyzeDataset(episodes), [episodes]);

  if (episodes.length === 0) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <BarChart3 className="w-4 h-4" />
          <span>No episodes recorded yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Dataset Statistics
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
          {/* Quick stats grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                <Layers className="w-3 h-3" />
                Episodes
              </div>
              <div className="text-lg font-bold text-white">{analysis.totalEpisodes}</div>
            </div>
            <div className="p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                <Activity className="w-3 h-3" />
                Frames
              </div>
              <div className="text-lg font-bold text-white">
                {analysis.totalFrames.toLocaleString()}
              </div>
            </div>
            <div className="p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                <Clock className="w-3 h-3" />
                Duration
              </div>
              <div className="text-lg font-bold text-white">
                {analysis.totalDuration.toFixed(1)}s
              </div>
            </div>
            <div className="p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                <TrendingUp className="w-3 h-3" />
                Success
              </div>
              <div
                className={`text-lg font-bold ${
                  analysis.successRate >= 0.7
                    ? 'text-green-400'
                    : analysis.successRate >= 0.4
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {(analysis.successRate * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Success/fail breakdown */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Episode outcomes</span>
              <span className="text-xs text-slate-500">
                {Math.round(analysis.avgFramesPerEpisode)} avg frames/ep
              </span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden">
              <div
                className="bg-green-500"
                style={{ width: `${analysis.successRate * 100}%` }}
              />
              <div
                className="bg-red-500"
                style={{ width: `${(1 - analysis.successRate) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs">
              <span className="text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {Math.round(analysis.successRate * analysis.totalEpisodes)} success
              </span>
              <span className="text-red-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {Math.round((1 - analysis.successRate) * analysis.totalEpisodes)} failed
              </span>
            </div>
          </div>

          {/* Joint coverage */}
          <div className="mb-4">
            <button
              onClick={() => setShowJointDetails(!showJointDetails)}
              className="flex items-center justify-between w-full text-xs text-slate-400 mb-2 hover:text-slate-300"
            >
              <span>Joint coverage (state space)</span>
              {showJointDetails ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showJointDetails && (
              <div className="space-y-2 p-2 bg-slate-900/50 rounded-lg">
                {analysis.jointStats.map((stats, i) => (
                  <JointCoverage key={i} stats={stats} jointIndex={i} />
                ))}
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 pt-2 border-t border-slate-700/50">
                  <div className="w-3 h-2 bg-blue-500/50 rounded" />
                  <span>Range covered</span>
                  <div className="w-0.5 h-3 bg-yellow-400 ml-2" />
                  <span>Mean position</span>
                </div>
              </div>
            )}
          </div>

          {/* Issues and recommendations */}
          {(analysis.issues.length > 0 || analysis.recommendations.length > 0) && (
            <div className="space-y-2">
              {analysis.issues.map((issue, i) => (
                <div
                  key={`issue-${i}`}
                  className="flex items-start gap-2 text-xs p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                >
                  <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-yellow-300">{issue}</span>
                </div>
              ))}
              {analysis.recommendations.map((rec, i) => (
                <div
                  key={`rec-${i}`}
                  className="flex items-start gap-2 text-xs p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                >
                  <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-blue-300">{rec}</span>
                </div>
              ))}
            </div>
          )}

          {/* LeRobot compatibility */}
          <div className="mt-4 pt-3 border-t border-slate-700/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">LeRobot format compatibility</span>
              <span
                className={`flex items-center gap-1 ${
                  analysis.totalEpisodes >= 10 ? 'text-green-400' : 'text-yellow-400'
                }`}
              >
                {analysis.totalEpisodes >= 10 ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Ready to export
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Need more episodes
                  </>
                )}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
