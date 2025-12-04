import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import type { ActiveRobotType } from '../../types';

interface QuickPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const PROMPTS_BY_ROBOT: Record<ActiveRobotType, string[]> = {
  arm: [
    'wave hello',
    'pick up object',
    'scan the area',
    'go home position',
    'open gripper',
    'reach forward',
  ],
  wheeled: [
    'drive forward',
    'turn around',
    'follow line',
    'avoid obstacles',
    'spin in circle',
    'stop',
  ],
  drone: [
    'take off',
    'hover in place',
    'fly forward',
    'do a flip',
    'land safely',
    'rotate 360°',
  ],
  humanoid: [
    'wave hello',
    'walk forward',
    'do a squat',
    'raise arms',
    'stand on one leg',
    'reset pose',
  ],
};

export const QuickPrompts: React.FC<QuickPromptsProps> = ({
  onSelect,
  disabled = false,
}) => {
  const { activeRobotType } = useAppStore();
  const prompts = PROMPTS_BY_ROBOT[activeRobotType] || PROMPTS_BY_ROBOT.arm;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-3">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          onClick={() => onSelect(prompt)}
          disabled={disabled}
          className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600 rounded-full text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
};
