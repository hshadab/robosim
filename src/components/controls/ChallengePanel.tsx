import React, { useEffect, useRef } from 'react';
import {
  Trophy,
  Play,
  RotateCcw,
  Lock,
  CheckCircle,
  Circle,
  Clock,
  Star,
  XCircle,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { Button } from '../common';
import type { Challenge, ChallengeStatus } from '../../types';

const statusIcons: Record<ChallengeStatus, React.FC<{ className?: string }>> = {
  locked: Lock,
  available: Circle,
  in_progress: Play,
  completed: CheckCircle,
  failed: XCircle,
};

const statusColors: Record<ChallengeStatus, string> = {
  locked: 'text-slate-500',
  available: 'text-blue-400',
  in_progress: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

const difficultyStars: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

interface ChallengeCardProps {
  challenge: Challenge;
  onStart: () => void;
  isActive: boolean;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  challenge,
  onStart,
  isActive,
}) => {
  const StatusIcon = statusIcons[challenge.status];
  const stars = difficultyStars[challenge.difficulty];

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all
        ${
          isActive
            ? 'bg-yellow-500/10 border-yellow-500/50'
            : challenge.status === 'completed'
            ? 'bg-green-500/10 border-green-500/30'
            : challenge.status === 'locked'
            ? 'bg-slate-800/50 border-slate-700/30 opacity-60'
            : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <StatusIcon
          className={`w-5 h-5 mt-0.5 ${statusColors[challenge.status]}`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-200 truncate">
              {challenge.name}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: stars }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    challenge.status === 'completed'
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-500'
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-2 line-clamp-2">
            {challenge.description}
          </p>

          <div className="flex items-center gap-3 text-xs">
            {challenge.timeLimit && (
              <span className="flex items-center gap-1 text-slate-500">
                <Clock className="w-3 h-3" />
                {Math.floor(challenge.timeLimit / 60)}:
                {(challenge.timeLimit % 60).toString().padStart(2, '0')}
              </span>
            )}

            {challenge.bestTime && (
              <span className="flex items-center gap-1 text-green-400">
                <Trophy className="w-3 h-3" />
                {Math.floor(challenge.bestTime / 60)}:
                {Math.floor(challenge.bestTime % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            )}

            {challenge.attempts > 0 && (
              <span className="text-slate-500">
                {challenge.attempts} attempt{challenge.attempts !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {challenge.status !== 'locked' && !isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStart}
            className="shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Active challenge display
const ActiveChallengeDisplay: React.FC = () => {
  const { challengeState, resetChallenge, updateChallengeTimer } = useAppStore();
  const { activeChallenge, elapsedTime, objectivesCompleted, totalObjectives, score } =
    challengeState;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Timer effect
  useEffect(() => {
    if (challengeState.isTimerRunning) {
      startTimeRef.current = Date.now() - elapsedTime * 1000;

      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        updateChallengeTimer(elapsed);
      }, 100);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [challengeState.isTimerRunning, elapsedTime, updateChallengeTimer]);

  if (!activeChallenge) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const timeRemaining = activeChallenge.timeLimit
    ? activeChallenge.timeLimit - elapsedTime
    : null;

  const isCompleted = activeChallenge.status === 'completed';
  const isFailed = activeChallenge.status === 'failed';

  return (
    <div
      className={`
        p-4 rounded-lg border
        ${
          isCompleted
            ? 'bg-green-500/20 border-green-500/50'
            : isFailed
            ? 'bg-red-500/20 border-red-500/50'
            : 'bg-yellow-500/10 border-yellow-500/50'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">{activeChallenge.name}</h3>
          <p className="text-xs text-slate-400">{activeChallenge.environment}</p>
        </div>

        {isCompleted ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-bold">Complete!</span>
          </div>
        ) : isFailed ? (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-5 h-5" />
            <span className="text-sm font-bold">Time's Up!</span>
          </div>
        ) : null}
      </div>

      {/* Timer and score */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Time</div>
          <div
            className={`text-lg font-mono font-bold ${
              timeRemaining !== null && timeRemaining < 30
                ? 'text-red-400'
                : 'text-white'
            }`}
          >
            {formatTime(elapsedTime)}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Progress</div>
          <div className="text-lg font-bold text-blue-400">
            {objectivesCompleted}/{totalObjectives}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Score</div>
          <div className="text-lg font-bold text-yellow-400">{score}</div>
        </div>
      </div>

      {/* Objectives */}
      <div className="space-y-2 mb-3">
        <div className="text-xs text-slate-400 font-medium">Objectives</div>
        {activeChallenge.objectives.map((obj) => (
          <div
            key={obj.id}
            className={`flex items-center gap-2 text-sm ${
              obj.isCompleted ? 'text-green-400' : 'text-slate-300'
            }`}
          >
            {obj.isCompleted ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4 text-slate-500" />
            )}
            <span className={obj.isCompleted ? 'line-through opacity-60' : ''}>
              {obj.description}
            </span>
          </div>
        ))}
      </div>

      {/* Hints */}
      {!isCompleted && activeChallenge.hints.length > 0 && (
        <details className="mb-3">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-1">
            <Lightbulb className="w-3 h-3" />
            Need a hint?
          </summary>
          <ul className="mt-2 space-y-1">
            {activeChallenge.hints.map((hint, i) => (
              <li key={i} className="text-xs text-slate-500 pl-4">
                • {hint}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetChallenge}
          className="flex-1"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          Restart
        </Button>
      </div>
    </div>
  );
};

export const ChallengePanel: React.FC = () => {
  const { challenges, challengeState, startChallenge } = useAppStore();

  const hasActiveChallenge = challengeState.activeChallenge !== null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-3 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-medium text-slate-200">Challenges</span>
        <span className="text-xs text-slate-500 ml-auto">
          {challenges.filter((c) => c.status === 'completed').length}/
          {challenges.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {hasActiveChallenge ? (
          <ActiveChallengeDisplay />
        ) : (
          challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onStart={() => startChallenge(challenge.id)}
              isActive={challengeState.activeChallenge?.id === challenge.id}
            />
          ))
        )}
      </div>
    </div>
  );
};
