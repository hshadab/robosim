/**
 * Robot Selector Component
 * UI for switching between different robot types
 */

import React, { useState } from 'react';
import {
  Car,
  Plane,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  User,
  Clock,
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
  comingSoon?: boolean;
}

const ROBOT_OPTIONS: RobotOption[] = [
  {
    type: 'arm',
    name: 'SO-101 Robot Arm',
    description: '6-DOF open-source arm with LeRobot support',
    icon: <GripHorizontal className="w-6 h-6" />,
    color: 'blue',
    features: ['6-DOF', 'URDF Model', 'LeRobot Ready'],
  },
  {
    type: 'wheeled',
    name: 'Wheeled Robot',
    description: 'Differential drive mobile robot',
    icon: <Car className="w-6 h-6" />,
    color: 'green',
    features: ['4WD', 'Ultrasonic', 'Line following'],
    comingSoon: true,
  },
  {
    type: 'drone',
    name: 'Quadcopter',
    description: 'Mini quadcopter drone',
    icon: <Plane className="w-6 h-6" />,
    color: 'purple',
    features: ['4 rotors', 'Altitude hold', '3D flight'],
    comingSoon: true,
  },
  {
    type: 'humanoid',
    name: 'Humanoid',
    description: 'Berkeley Humanoid Lite - 22-DOF bipedal',
    icon: <User className="w-6 h-6" />,
    color: 'orange',
    features: ['22-DOF', 'Walking', 'Manipulation'],
    comingSoon: true,
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

  const getColorClasses = (color: string, isActive: boolean, comingSoon?: boolean) => {
    if (comingSoon) {
      return {
        bg: 'bg-slate-800/30',
        border: 'border-slate-700/30',
        text: 'text-slate-500',
      };
    }
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
      orange: {
        bg: isActive ? 'bg-orange-500/20' : 'bg-slate-800/50',
        border: isActive ? 'border-orange-500/50' : 'border-slate-700/50',
        text: isActive ? 'text-orange-400' : 'text-slate-400',
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
            const colors = getColorClasses(robot.color, isActive, robot.comingSoon);

            return (
              <button
                key={robot.type}
                onClick={() => !robot.comingSoon && handleSelect(robot.type)}
                disabled={robot.comingSoon}
                className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all
                  ${colors.bg} ${colors.border}
                  ${robot.comingSoon ? 'cursor-not-allowed opacity-60' : ''}
                  ${isActive ? '' : robot.comingSoon ? '' : 'hover:bg-slate-700/30 hover:border-slate-600/50'}
                `}
              >
                <div className={`p-2 rounded-lg ${isActive ? colors.bg : 'bg-slate-700/50'}`}>
                  <div className={colors.text}>{robot.icon}</div>
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${robot.comingSoon ? 'text-slate-500' : isActive ? 'text-slate-200' : 'text-slate-300'}`}>
                      {robot.name}
                    </span>
                    {robot.comingSoon ? (
                      <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Coming Soon
                      </span>
                    ) : isActive ? (
                      <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{robot.description}</p>
                  <div className="flex gap-1 mt-2">
                    {robot.features.map((feature) => (
                      <span
                        key={feature}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${robot.comingSoon ? 'bg-slate-700/30 text-slate-500' : 'bg-slate-700/50 text-slate-400'}`}
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

// Compact version for header - only shows SO-101 arm for now
export const RobotSelectorCompact: React.FC = () => {
  const { activeRobotType } = useAppStore();

  const getIcon = (type: ActiveRobotType) => {
    switch (type) {
      case 'arm':
        return <GripHorizontal className="w-4 h-4" />;
      case 'wheeled':
        return <Car className="w-4 h-4" />;
      case 'drone':
        return <Plane className="w-4 h-4" />;
      case 'humanoid':
        return <User className="w-4 h-4" />;
    }
  };

  const comingSoonTypes: ActiveRobotType[] = ['wheeled', 'drone', 'humanoid'];

  const getColor = (type: ActiveRobotType, isActive: boolean) => {
    if (comingSoonTypes.includes(type)) return 'text-slate-600 cursor-not-allowed';
    if (!isActive) return 'text-slate-500 hover:text-slate-300';
    switch (type) {
      case 'arm':
        return 'text-blue-400 bg-blue-500/20';
      case 'wheeled':
        return 'text-green-400 bg-green-500/20';
      case 'drone':
        return 'text-purple-400 bg-purple-500/20';
      case 'humanoid':
        return 'text-orange-400 bg-orange-500/20';
    }
  };

  return (
    <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700/50">
      {(['arm', 'wheeled', 'drone', 'humanoid'] as ActiveRobotType[]).map((type) => {
        const isActive = type === activeRobotType;
        const isComingSoon = comingSoonTypes.includes(type);
        return (
          <button
            key={type}
            onClick={() => {}} // Only arm is selectable for now
            disabled={isComingSoon}
            className={`p-1.5 rounded transition-colors ${getColor(type, isActive)} ${isComingSoon ? 'opacity-40' : ''}`}
            title={isComingSoon ? `${type.charAt(0).toUpperCase() + type.slice(1)} (Coming Soon)` : type.charAt(0).toUpperCase() + type.slice(1)}
          >
            {getIcon(type)}
          </button>
        );
      })}
    </div>
  );
};
