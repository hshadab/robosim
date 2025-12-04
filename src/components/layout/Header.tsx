import React from 'react';
import { Play, Square, Bot, Save, Download, Settings } from 'lucide-react';
import { Button, Select } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import { ROBOT_PROFILES } from '../../config/robots';

export const Header: React.FC = () => {
  const {
    selectedRobotId,
    setSelectedRobot,
    setActiveRobotType,
    simulation,
    setSimulationStatus,
    isAnimating,
  } = useAppStore();

  const robotOptions = ROBOT_PROFILES.map((robot) => ({
    value: robot.id,
    label: `${robot.manufacturer} ${robot.name}`,
    description: robot.description,
  }));

  const handleRobotChange = (robotId: string) => {
    setSelectedRobot(robotId);
    // Also update the active robot type based on the selected profile
    const profile = ROBOT_PROFILES.find((r) => r.id === robotId);
    if (profile) {
      setActiveRobotType(profile.type as 'arm' | 'wheeled' | 'drone');
    }
  };

  const handleRun = () => {
    setSimulationStatus('running');
  };

  const handleStop = () => {
    setSimulationStatus('idle');
  };

  return (
    <header className="h-14 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 flex items-center justify-between px-4">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Bot className="w-7 h-7 text-blue-400" />
          <span className="text-lg font-bold text-white">RoboSim</span>
        </div>
        <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
          AI-Native
        </span>
      </div>

      {/* Robot Selector */}
      <div className="flex items-center gap-4">
        <Select
          options={robotOptions}
          value={selectedRobotId}
          onChange={handleRobotChange}
          className="w-56"
        />

        {/* Simulation Controls */}
        <div className="flex items-center gap-2">
          {simulation.status === 'running' ? (
            <Button
              variant="danger"
              size="md"
              leftIcon={<Square className="w-4 h-4" />}
              onClick={handleStop}
              disabled={isAnimating}
            >
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={handleRun}
              disabled={isAnimating}
            >
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" leftIcon={<Save className="w-4 h-4" />}>
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Download className="w-4 h-4" />}
        >
          Export to Arduino
        </Button>
        <Button variant="ghost" size="sm">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
};
