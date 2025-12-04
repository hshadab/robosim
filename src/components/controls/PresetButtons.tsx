import React from 'react';
import { Zap } from 'lucide-react';
import { Button } from '../common';
import { useLLMChat } from '../../hooks/useLLMChat';
import { useAppStore } from '../../stores/useAppStore';

const PRESETS = [
  { label: 'Home', icon: '🏠', command: 'go home' },
  { label: 'Wave', icon: '👋', command: 'wave hello' },
  { label: 'Pick', icon: '🫳', command: 'pick up object' },
  { label: 'Scan', icon: '👀', command: 'scan the area' },
  { label: 'Flex', icon: '💪', command: 'flex muscles' },
];

export const PresetButtons: React.FC = () => {
  const { sendMessage } = useLLMChat();
  const { isAnimating, isLLMLoading } = useAppStore();

  const disabled = isAnimating || isLLMLoading;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold text-slate-300">Quick Actions</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="secondary"
            size="sm"
            onClick={() => sendMessage(preset.command)}
            disabled={disabled}
            className="flex-1 min-w-[70px]"
          >
            <span className="mr-1">{preset.icon}</span>
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
