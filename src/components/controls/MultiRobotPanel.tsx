/**
 * Multi-Robot Panel
 *
 * UI for managing multiple robot instances in the simulation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Circle,
  Settings,
  Move,
  LayoutGrid,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import {
  getMultiRobotManager,
  createRobotInstance,
  cloneRobotInstance,
  calculateFormation,
  type RobotInstance,
} from '../../lib/multiRobot';

type FormationPattern = 'line' | 'grid' | 'circle' | 'v-formation';

export const MultiRobotPanel: React.FC = () => {
  const { activeRobotType, selectedRobotId } = useAppStore();
  const manager = getMultiRobotManager();

  const [robots, setRobots] = useState<RobotInstance[]>(manager.getRobots());
  const [activeId, setActiveId] = useState<string | null>(manager.getActiveRobotId());
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFormation, setSelectedFormation] = useState<FormationPattern>('line');

  // Subscribe to manager updates
  useEffect(() => {
    const unsubscribe = manager.subscribe((updatedRobots) => {
      setRobots(updatedRobots);
      setActiveId(manager.getActiveRobotId());
    });
    return unsubscribe;
  }, [manager]);

  // Add new robot
  const handleAddRobot = useCallback(() => {
    const robot = createRobotInstance(activeRobotType, selectedRobotId);

    // Offset position if there are existing robots
    if (robots.length > 0) {
      robot.position.x = robots.length * 0.3;
    }

    manager.addRobot(robot);
  }, [manager, activeRobotType, selectedRobotId, robots.length]);

  // Clone selected robot
  const handleCloneRobot = useCallback((robotId: string) => {
    const source = manager.getRobot(robotId);
    if (source) {
      const clone = cloneRobotInstance(source);
      manager.addRobot(clone);
    }
  }, [manager]);

  // Remove robot
  const handleRemoveRobot = useCallback((robotId: string) => {
    manager.removeRobot(robotId);
  }, [manager]);

  // Toggle robot visibility
  const handleToggleEnabled = useCallback((robotId: string) => {
    const robot = manager.getRobot(robotId);
    if (robot) {
      manager.updateRobot(robotId, { enabled: !robot.enabled });
    }
  }, [manager]);

  // Set active robot
  const handleSetActive = useCallback((robotId: string) => {
    manager.setActiveRobot(robotId);
  }, [manager]);

  // Apply formation
  const handleApplyFormation = useCallback(() => {
    const positions = calculateFormation(
      robots.length,
      selectedFormation,
      { x: 0, y: 0, z: 0 },
      0.3
    );

    robots.forEach((robot, index) => {
      if (positions[index]) {
        manager.updateRobot(robot.id, { position: positions[index] });
      }
    });
  }, [manager, robots, selectedFormation]);

  // Clear all robots
  const handleClearAll = useCallback(() => {
    manager.clear();
  }, [manager]);

  // Get robot type icon color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'arm': return 'text-blue-400';
      case 'wheeled': return 'text-green-400';
      case 'drone': return 'text-purple-400';
      case 'humanoid': return 'text-orange-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          Multi-Robot
          <span className="text-xs text-slate-500">({robots.length}/8)</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 transition-colors ${showSettings ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            title="Formation settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddRobot}
            disabled={robots.length >= 8}
            className="p-1 text-green-400 hover:text-green-300 transition-colors disabled:text-slate-600 disabled:cursor-not-allowed"
            title="Add robot"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Formation Settings */}
      {showSettings && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded-lg">
          <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
            <LayoutGrid className="w-3 h-3" />
            Formation Pattern
          </div>
          <div className="flex gap-1 mb-2">
            {(['line', 'grid', 'circle', 'v-formation'] as FormationPattern[]).map((pattern) => (
              <button
                key={pattern}
                onClick={() => setSelectedFormation(pattern)}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  selectedFormation === pattern
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {pattern.replace('-', ' ')}
              </button>
            ))}
          </div>
          <button
            onClick={handleApplyFormation}
            disabled={robots.length < 2}
            className="w-full px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            <Move className="w-3 h-3 inline mr-1" />
            Apply Formation
          </button>
        </div>
      )}

      {/* Robot List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {robots.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">
            No robots yet. Click + to add one!
          </div>
        ) : (
          robots.map((robot) => (
            <button
              key={robot.id}
              type="button"
              onClick={() => handleSetActive(robot.id)}
              className={`w-full text-left p-2 rounded-lg cursor-pointer transition-colors ${
                activeId === robot.id
                  ? 'bg-slate-700/70 border border-cyan-500/50'
                  : 'bg-slate-900/30 hover:bg-slate-800/50 border border-transparent'
              }`}
              aria-pressed={activeId === robot.id}
              aria-label={`Select robot ${robot.name}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Color indicator */}
                  <Circle
                    className="w-3 h-3"
                    fill={robot.color}
                    stroke={robot.color}
                  />
                  {/* Name */}
                  <span className={`text-sm ${robot.enabled ? 'text-white' : 'text-slate-500'}`}>
                    {robot.name}
                  </span>
                  {/* Type badge */}
                  <span className={`text-xs ${getTypeColor(robot.type)}`}>
                    {robot.type}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleToggleEnabled(robot.id)}
                    className={`p-1 rounded transition-colors ${
                      robot.enabled ? 'text-green-400 hover:bg-green-500/20' : 'text-slate-500 hover:bg-slate-700'
                    }`}
                    title={robot.enabled ? 'Disable' : 'Enable'}
                  >
                    {robot.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => handleCloneRobot(robot.id)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Clone"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleRemoveRobot(robot.id)}
                    className="p-1 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Position info */}
              {activeId === robot.id && (
                <div className="mt-1 text-xs text-slate-500">
                  Position: ({robot.position.x.toFixed(2)}, {robot.position.y.toFixed(2)}, {robot.position.z.toFixed(2)})
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {robots.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            Active: {activeId ? robots.find(r => r.id === activeId)?.name : 'None'}
          </span>
          <button
            onClick={handleClearAll}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
