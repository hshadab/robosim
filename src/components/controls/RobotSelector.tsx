/**
 * Robot Selector Component
 * UI for switching between different robot types
 */

import React, { useState } from 'react';
import {
  Bot,
  Car,
  Plane,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Cpu,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { ActiveRobotType } from '../../types';

interface RobotOption {
  type: ActiveRobotType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}

const ROBOT_OPTIONS: RobotOption[] = [
  {
    type: 'arm',
    name: 'Robot Arm',
    description: 'Hiwonder xArm 1S - 5-DOF articulated arm',
    icon: <GripHorizontal className="w-6 h-6" />,
    color: 'blue',
    features: ['5 joints', 'Gripper', 'Pick & place'],
  },
  {
    type: 'wheeled',
    name: 'Wheeled Robot',
    description: 'Differential drive mobile robot',
    icon: <Car className="w-6 h-6" />,
    color: 'green',
    features: ['2 wheels', 'Ultrasonic', 'Line following'],
  },
  {
    type: 'drone',
    name: 'Quadcopter',
    description: 'Mini quadcopter drone',
    icon: <Plane className="w-6 h-6" />,
    color: 'purple',
    features: ['4 rotors', 'Altitude hold', '3D flight'],
  },
];

export const RobotSelector: React.FC = () => {
  const { activeRobotType, setActiveRobotType } = useAppStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const currentRobot = ROBOT_OPTIONS.find((r) => r.type === activeRobotType) || ROBOT_OPTIONS[0];

  const handleSelect = (type: ActiveRobotType) => {
    setActiveRobotType(type);
    setIsExpanded(false);
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      blue: {
        bg: isActive ? 'bg-blue-500/20' : 'bg-slate-800/50',
        border: isActive ? 'border-blue-500/50' : 'border-slate-700/50',
        text: isActive ? 'text-blue-400' : 'text-slate-400',
      },
      green: {
        bg: isActive ? 'bg-green-500/20' : 'bg-slate-800/50',
        border: isActive ? 'border-green-500/50' : 'border-slate-700/50',
        text: isActive ? 'text-green-400' : 'text-slate-400',
      },
      purple: {
        bg: isActive ? 'bg-purple-500/20' : 'bg-slate-800/50',
        border: isActive ? 'border-purple-500/50' : 'border-slate-700/50',
        text: isActive ? 'text-purple-400' : 'text-slate-400',
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header / Current Selection */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${getColorClasses(currentRobot.color, true).bg}`}>
            <div className={getColorClasses(currentRobot.color, true).text}>
              {currentRobot.icon}
            </div>
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-slate-200">{currentRobot.name}</div>
            <div className="text-xs text-slate-500">{currentRobot.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
            Active
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Options */}
      {isExpanded && (
        <div className="border-t border-slate-700/50 p-2 space-y-2">
          {ROBOT_OPTIONS.map((robot) => {
            const isActive = robot.type === activeRobotType;
            const colors = getColorClasses(robot.color, isActive);

            return (
              <button
                key={robot.type}
                onClick={() => handleSelect(robot.type)}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all
                  ${colors.bg} ${colors.border}
                  ${isActive ? '' : 'hover:bg-slate-700/30 hover:border-slate-600/50'}
                `}
              >
                <div className={`p-2 rounded-lg ${isActive ? colors.bg : 'bg-slate-700/50'}`}>
                  <div className={colors.text}>{robot.icon}</div>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isActive ? 'text-slate-200' : 'text-slate-300'}`}>
                      {robot.name}
                    </span>
                    {isActive && (
                      <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{robot.description}</p>
                  <div className="flex gap-1 mt-2">
                    {robot.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Compact version for header
export const RobotSelectorCompact: React.FC = () => {
  const { activeRobotType, setActiveRobotType } = useAppStore();

  const getIcon = (type: ActiveRobotType) => {
    switch (type) {
      case 'arm':
        return <GripHorizontal className="w-4 h-4" />;
      case 'wheeled':
        return <Car className="w-4 h-4" />;
      case 'drone':
        return <Plane className="w-4 h-4" />;
    }
  };

  const getColor = (type: ActiveRobotType, isActive: boolean) => {
    if (!isActive) return 'text-slate-500 hover:text-slate-300';
    switch (type) {
      case 'arm':
        return 'text-blue-400 bg-blue-500/20';
      case 'wheeled':
        return 'text-green-400 bg-green-500/20';
      case 'drone':
        return 'text-purple-400 bg-purple-500/20';
    }
  };

  return (
    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
      {(['arm', 'wheeled', 'drone'] as ActiveRobotType[]).map((type) => {
        const isActive = type === activeRobotType;
        return (
          <button
            key={type}
            onClick={() => setActiveRobotType(type)}
            className={`p-1.5 rounded transition-colors ${getColor(type, isActive)}`}
            title={type.charAt(0).toUpperCase() + type.slice(1)}
          >
            {getIcon(type)}
          </button>
        );
      })}
    </div>
  );
};
