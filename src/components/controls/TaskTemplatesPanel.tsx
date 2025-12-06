/**
 * Task Templates Panel
 *
 * Provides predefined task sequences for common robot operations:
 * - Pick and Place
 * - Stacking
 * - Sorting
 * - Custom sequences
 */

import React, { useState, useCallback } from 'react';
import {
  Package,
  Layers,
  ArrowRight,
  Play,
  Pause,
  Square,
  ChevronDown,
  ChevronUp,
  Target,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { useTrajectoryExecution } from '../../hooks/useTrajectoryExecution';
import type { JointState } from '../../types';

// Task template definition
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'manipulation' | 'navigation' | 'inspection';
  waypoints: JointState[];
  durations?: number[];
}

// Predefined waypoint configurations
const HOME_POSITION: JointState = {
  base: 0,
  shoulder: 0,
  elbow: 0,
  wrist: 0,
  wristRoll: 0,
  gripper: 50,
};

const PICK_READY: JointState = {
  base: 0,
  shoulder: -30,
  elbow: 60,
  wrist: -30,
  wristRoll: 0,
  gripper: 100, // Open
};

const PICK_DOWN: JointState = {
  base: 0,
  shoulder: -50,
  elbow: 70,
  wrist: -20,
  wristRoll: 0,
  gripper: 100, // Open
};

const PICK_GRASP: JointState = {
  base: 0,
  shoulder: -50,
  elbow: 70,
  wrist: -20,
  wristRoll: 0,
  gripper: 20, // Closed
};

const PLACE_READY: JointState = {
  base: 90,
  shoulder: -30,
  elbow: 60,
  wrist: -30,
  wristRoll: 0,
  gripper: 20, // Closed
};

const PLACE_DOWN: JointState = {
  base: 90,
  shoulder: -50,
  elbow: 70,
  wrist: -20,
  wristRoll: 0,
  gripper: 20, // Closed
};

const PLACE_RELEASE: JointState = {
  base: 90,
  shoulder: -50,
  elbow: 70,
  wrist: -20,
  wristRoll: 0,
  gripper: 100, // Open
};

// Task templates
const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'pick-place-right',
    name: 'Pick & Place (Right)',
    description: 'Pick from center, place to the right',
    icon: <Package className="w-4 h-4" />,
    category: 'manipulation',
    waypoints: [
      HOME_POSITION,
      PICK_READY,
      PICK_DOWN,
      PICK_GRASP,
      PICK_READY,
      PLACE_READY,
      PLACE_DOWN,
      PLACE_RELEASE,
      PLACE_READY,
      HOME_POSITION,
    ],
    durations: [0.8, 0.5, 0.3, 0.5, 1.0, 0.5, 0.3, 0.5, 0.8],
  },
  {
    id: 'pick-place-left',
    name: 'Pick & Place (Left)',
    description: 'Pick from center, place to the left',
    icon: <Package className="w-4 h-4" />,
    category: 'manipulation',
    waypoints: [
      HOME_POSITION,
      PICK_READY,
      PICK_DOWN,
      PICK_GRASP,
      PICK_READY,
      { ...PLACE_READY, base: -90 },
      { ...PLACE_DOWN, base: -90 },
      { ...PLACE_RELEASE, base: -90 },
      { ...PLACE_READY, base: -90 },
      HOME_POSITION,
    ],
    durations: [0.8, 0.5, 0.3, 0.5, 1.0, 0.5, 0.3, 0.5, 0.8],
  },
  {
    id: 'stack-two',
    name: 'Stack Objects',
    description: 'Pick and stack two objects',
    icon: <Layers className="w-4 h-4" />,
    category: 'manipulation',
    waypoints: [
      HOME_POSITION,
      // First pick
      { ...PICK_READY, base: -45 },
      { ...PICK_DOWN, base: -45 },
      { ...PICK_GRASP, base: -45 },
      { ...PICK_READY, base: -45 },
      // Place on stack position
      { ...PLACE_READY, base: 45, shoulder: -20 },
      { ...PLACE_DOWN, base: 45, shoulder: -40 },
      { ...PLACE_RELEASE, base: 45, shoulder: -40 },
      { ...PLACE_READY, base: 45, shoulder: -20 },
      HOME_POSITION,
    ],
  },
  {
    id: 'scan-arc',
    name: 'Arc Scan',
    description: 'Sweep the workspace in an arc',
    icon: <Target className="w-4 h-4" />,
    category: 'inspection',
    waypoints: [
      HOME_POSITION,
      { base: -90, shoulder: -20, elbow: 40, wrist: -20, wristRoll: 0, gripper: 50 },
      { base: -45, shoulder: -30, elbow: 50, wrist: -20, wristRoll: 0, gripper: 50 },
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 50 },
      { base: 45, shoulder: -30, elbow: 50, wrist: -20, wristRoll: 0, gripper: 50 },
      { base: 90, shoulder: -20, elbow: 40, wrist: -20, wristRoll: 0, gripper: 50 },
      HOME_POSITION,
    ],
    durations: [1.0, 1.5, 1.5, 1.5, 1.5, 1.0],
  },
  {
    id: 'wave-hello',
    name: 'Wave Hello',
    description: 'Friendly waving gesture',
    icon: <ArrowRight className="w-4 h-4" />,
    category: 'navigation',
    waypoints: [
      HOME_POSITION,
      { base: 0, shoulder: -60, elbow: 90, wrist: 0, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -60, elbow: 90, wrist: 30, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -60, elbow: 90, wrist: -30, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -60, elbow: 90, wrist: 30, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -60, elbow: 90, wrist: -30, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -60, elbow: 90, wrist: 0, wristRoll: 0, gripper: 100 },
      HOME_POSITION,
    ],
    durations: [0.8, 0.3, 0.3, 0.3, 0.3, 0.3, 0.8],
  },
  {
    id: 'demo-cycle',
    name: 'Demo Cycle',
    description: 'Full demonstration of arm capabilities',
    icon: <RotateCcw className="w-4 h-4" />,
    category: 'navigation',
    waypoints: [
      HOME_POSITION,
      // Reach forward
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 50 },
      // Rotate wrist
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 90, gripper: 50 },
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: -90, gripper: 50 },
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 50 },
      // Open/close gripper
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 100 },
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 0 },
      { base: 0, shoulder: -40, elbow: 60, wrist: -20, wristRoll: 0, gripper: 50 },
      // Sweep around
      { base: -90, shoulder: -30, elbow: 50, wrist: -20, wristRoll: 0, gripper: 50 },
      { base: 90, shoulder: -30, elbow: 50, wrist: -20, wristRoll: 0, gripper: 50 },
      HOME_POSITION,
    ],
    durations: [1.0, 0.5, 0.5, 0.5, 0.3, 0.3, 0.5, 1.5, 1.5, 1.0],
  },
];

export const TaskTemplatesPanel: React.FC = () => {
  const { isAnimating, activeRobotType } = useAppStore();
  const { state, executeWaypoints, pause, resume, stop } = useTrajectoryExecution();
  const [expanded, setExpanded] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const handleRunTask = useCallback(
    (template: TaskTemplate) => {
      setSelectedTask(template.id);
      executeWaypoints(template.waypoints, template.durations, 'cubic');
    },
    [executeWaypoints]
  );

  const handleStop = useCallback(() => {
    stop();
    setSelectedTask(null);
  }, [stop]);

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  const getCategoryColor = (category: TaskTemplate['category']) => {
    switch (category) {
      case 'manipulation':
        return 'text-blue-400';
      case 'navigation':
        return 'text-green-400';
      case 'inspection':
        return 'text-purple-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-400" />
          Task Templates
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
          {/* Execution status */}
          {state.isExecuting && (
            <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Running task...</span>
                <div className="flex gap-1">
                  <button
                    onClick={state.isPaused ? resume : pause}
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                  >
                    {state.isPaused ? (
                      <Play className="w-3 h-3" />
                    ) : (
                      <Pause className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    onClick={handleStop}
                    className="p-1 text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-100"
                  style={{ width: `${state.progress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {TASK_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className={`p-2 rounded-lg border transition-colors ${
                  selectedTask === template.id && state.isExecuting
                    ? 'bg-orange-500/20 border-orange-500/50'
                    : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <div className={`mt-0.5 ${getCategoryColor(template.category)}`}>
                      {template.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{template.name}</div>
                      <div className="text-xs text-slate-400">{template.description}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {template.waypoints.length} waypoints
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRunTask(template)}
                    disabled={isAnimating || state.isExecuting}
                    className="text-orange-400 hover:text-orange-300"
                  >
                    <Play className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Category legend */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-4 text-xs">
            <span className="text-blue-400">Manipulation</span>
            <span className="text-green-400">Navigation</span>
            <span className="text-purple-400">Inspection</span>
          </div>
        </>
      )}
    </div>
  );
};
