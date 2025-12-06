/**
 * Joint Trajectory Graph
 *
 * Real-time plotting of joint positions over time using Canvas.
 * Shows the last N seconds of joint movement history.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

// Configuration
const HISTORY_SECONDS = 10;
const SAMPLE_RATE_HZ = 30;
const MAX_SAMPLES = HISTORY_SECONDS * SAMPLE_RATE_HZ;

// Joint colors for the graph
const JOINT_COLORS: Record<keyof JointState, string> = {
  base: '#ef4444', // Red
  shoulder: '#f97316', // Orange
  elbow: '#eab308', // Yellow
  wrist: '#22c55e', // Green
  wristRoll: '#3b82f6', // Blue
  gripper: '#a855f7', // Purple
};

// Joint display names
const JOINT_NAMES: Record<keyof JointState, string> = {
  base: 'Base',
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  wristRoll: 'Roll',
  gripper: 'Gripper',
};

interface DataPoint {
  timestamp: number;
  joints: JointState;
}

interface JointTrajectoryGraphProps {
  height?: number;
}

export const JointTrajectoryGraph: React.FC<JointTrajectoryGraphProps> = ({
  height = 200,
}) => {
  const { activeRobotType } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<DataPoint[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  const [expanded, setExpanded] = useState(true);
  const [isRecording, setIsRecording] = useState(true);
  const [visibleJoints, setVisibleJoints] = useState<Set<keyof JointState>>(
    new Set(['base', 'shoulder', 'elbow', 'wrist'])
  );

  // Toggle joint visibility
  const toggleJoint = useCallback((joint: keyof JointState) => {
    setVisibleJoints((prev) => {
      const next = new Set(prev);
      if (next.has(joint)) {
        next.delete(joint);
      } else {
        next.add(joint);
      }
      return next;
    });
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    dataRef.current = [];
    startTimeRef.current = Date.now();
  }, []);

  // Record data points
  useEffect(() => {
    if (!isRecording) return;

    const recordInterval = setInterval(() => {
      const now = Date.now();
      const currentJoints = useAppStore.getState().joints;

      dataRef.current.push({
        timestamp: now,
        joints: { ...currentJoints },
      });

      // Trim old data
      const cutoffTime = now - HISTORY_SECONDS * 1000;
      while (dataRef.current.length > 0 && dataRef.current[0].timestamp < cutoffTime) {
        dataRef.current.shift();
      }

      // Limit total samples
      if (dataRef.current.length > MAX_SAMPLES) {
        dataRef.current = dataRef.current.slice(-MAX_SAMPLES);
      }
    }, 1000 / SAMPLE_RATE_HZ);

    return () => clearInterval(recordInterval);
  }, [isRecording]);

  // Draw the graph
  useEffect(() => {
    if (!canvasRef.current || !expanded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Set canvas size with DPR
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const graphHeight = rect.height;

      // Clear
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, graphHeight);

      // Draw grid
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.5;

      // Horizontal grid lines (every 45 degrees equivalent)
      for (let i = -2; i <= 2; i++) {
        const y = graphHeight / 2 + (i * graphHeight) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical grid lines (every 2 seconds)
      for (let i = 0; i <= HISTORY_SECONDS; i += 2) {
        const x = (i / HISTORY_SECONDS) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, graphHeight);
        ctx.stroke();
      }

      // Draw zero line
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, graphHeight / 2);
      ctx.lineTo(width, graphHeight / 2);
      ctx.stroke();

      // Draw data
      const data = dataRef.current;
      if (data.length < 2) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = Date.now();
      const timeStart = now - HISTORY_SECONDS * 1000;

      // Draw each joint
      const jointKeys = Object.keys(JOINT_COLORS) as (keyof JointState)[];

      for (const jointKey of jointKeys) {
        if (!visibleJoints.has(jointKey)) continue;

        ctx.strokeStyle = JOINT_COLORS[jointKey];
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        let started = false;
        for (let i = 0; i < data.length; i++) {
          const point = data[i];
          const x = ((point.timestamp - timeStart) / (HISTORY_SECONDS * 1000)) * width;

          // Map value to y coordinate
          // For gripper: 0-100% maps to -100 to 100 for display purposes
          let value = point.joints[jointKey];
          if (jointKey === 'gripper') {
            value = value - 50; // Center at 0
          }

          const y = graphHeight / 2 - (value / 100) * (graphHeight / 2);

          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
      }

      // Draw current time marker
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(width - 2, 0);
      ctx.lineTo(width - 2, graphHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Y-axis labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('100°', 2, 12);
      ctx.fillText('0°', 2, graphHeight / 2 - 2);
      ctx.fillText('-100°', 2, graphHeight - 4);

      // Request next frame
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [expanded, visibleJoints]);

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <LineChart className="w-4 h-4 text-cyan-400" />
          Joint Trajectory
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`p-1 transition-colors ${
              isRecording ? 'text-green-400' : 'text-slate-400 hover:text-white'
            }`}
            title={isRecording ? 'Pause recording' : 'Resume recording'}
          >
            {isRecording ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button
            onClick={clearHistory}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Clear history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Joint toggles */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(Object.keys(JOINT_COLORS) as (keyof JointState)[]).map((joint) => (
              <button
                key={joint}
                onClick={() => toggleJoint(joint)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  visibleJoints.has(joint)
                    ? 'text-white'
                    : 'text-slate-500 opacity-50'
                }`}
                style={{
                  backgroundColor: visibleJoints.has(joint)
                    ? JOINT_COLORS[joint] + '40'
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: JOINT_COLORS[joint],
                }}
              >
                {JOINT_NAMES[joint]}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div
            className="w-full rounded overflow-hidden border border-slate-700/50"
            style={{ height }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Time axis label */}
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>-{HISTORY_SECONDS}s</span>
            <span>Now</span>
          </div>
        </>
      )}
    </div>
  );
};
