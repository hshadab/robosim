import React from 'react';
import { Map, Square, Route, Grid3X3, Boxes, Warehouse } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { ENVIRONMENTS } from '../../config/environments';
import type { EnvironmentType } from '../../types';

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  square: Square,
  boxes: Boxes,
  route: Route,
  'grid-3x3': Grid3X3,
  warehouse: Warehouse,
};

const difficultyColors = {
  beginner: 'text-green-400 bg-green-400/10 border-green-400/30',
  intermediate: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  advanced: 'text-red-400 bg-red-400/10 border-red-400/30',
};

export const EnvironmentSelector: React.FC = () => {
  const { currentEnvironment, setEnvironment, challengeState } = useAppStore();

  // Don't allow environment change during active challenge
  const isLocked = challengeState.activeChallenge !== null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3">
      <div className="flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-slate-200">Environment</span>
        {isLocked && (
          <span className="text-xs text-yellow-400 ml-auto">
            (Challenge Active)
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ENVIRONMENTS.map((env) => {
          const IconComponent = iconMap[env.icon] || Square;
          const isSelected = currentEnvironment === env.id;

          return (
            <button
              key={env.id}
              onClick={() => !isLocked && setEnvironment(env.id as EnvironmentType)}
              disabled={isLocked}
              className={`
                relative flex flex-col items-start p-2.5 rounded-lg border transition-all
                ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${
                  isSelected
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-slate-700/30 border-slate-600/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <IconComponent className="w-4 h-4" />
                <span className="text-xs font-medium">{env.name}</span>
              </div>

              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${difficultyColors[env.difficulty]}`}
              >
                {env.difficulty}
              </span>

              {isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
