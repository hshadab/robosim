/**
 * Challenge State Slice
 *
 * Manages challenges, challenge state, and challenge progression.
 * This slice has cross-slice dependencies with environment.
 * The composition in useAppStore handles the environment updates.
 */

import type { StateCreator } from 'zustand';
import type { Challenge, ChallengeState } from '../../types';
import { CHALLENGES } from '../../config/environments';

export interface ChallengeSliceState {
  challenges: Challenge[];
  challengeState: ChallengeState;
}

export interface ChallengeSliceActions {
  // Note: startChallenge needs environment access, so it's implemented in the composed store
  setChallenges: (challenges: Challenge[]) => void;
  setChallengeState: (state: Partial<ChallengeState>) => void;
  completeObjective: (objectiveId: string) => void;
  failChallenge: () => void;
  resetChallengeState: () => void;
  updateChallengeTimer: (elapsed: number) => void;
}

export type ChallengeSlice = ChallengeSliceState & ChallengeSliceActions;

export const getDefaultChallengeState = (): ChallengeSliceState => ({
  challenges: CHALLENGES,
  challengeState: {
    activeChallenge: null,
    elapsedTime: 0,
    isTimerRunning: false,
    objectivesCompleted: 0,
    totalObjectives: 0,
    score: 0,
  },
});

export const createChallengeSlice: StateCreator<
  ChallengeSlice,
  [],
  [],
  ChallengeSlice
> = (set, get) => ({
  ...getDefaultChallengeState(),

  setChallenges: (challenges: Challenge[]) => {
    set({ challenges });
  },

  setChallengeState: (state: Partial<ChallengeState>) => {
    set((s) => ({
      challengeState: { ...s.challengeState, ...state },
    }));
  },

  completeObjective: (objectiveId: string) => {
    const { challengeState, challenges } = get();
    if (!challengeState.activeChallenge) return;

    const updatedObjectives = challengeState.activeChallenge.objectives.map((obj) =>
      obj.id === objectiveId ? { ...obj, isCompleted: true } : obj
    );

    const completedCount = updatedObjectives.filter((o) => o.isCompleted).length;
    const allCompleted = completedCount === updatedObjectives.length;

    // Calculate score based on time (faster = more points)
    const timeBonus = challengeState.activeChallenge.timeLimit
      ? Math.max(0, challengeState.activeChallenge.timeLimit - challengeState.elapsedTime) * 10
      : 0;
    const objectivePoints = completedCount * 100;

    if (allCompleted) {
      // Challenge completed!
      const updatedChallenges = challenges.map((c) => {
        if (c.id === challengeState.activeChallenge!.id) {
          return {
            ...c,
            status: 'completed' as const,
            bestTime: c.bestTime
              ? Math.min(c.bestTime, challengeState.elapsedTime)
              : challengeState.elapsedTime,
          };
        }
        // Unlock next challenge if applicable
        if (c.status === 'locked') {
          const idx = challenges.findIndex((ch) => ch.id === c.id);
          const prevIdx = challenges.findIndex(
            (ch) => ch.id === challengeState.activeChallenge!.id
          );
          if (idx === prevIdx + 1) {
            return { ...c, status: 'available' as const };
          }
        }
        return c;
      });

      set({
        challenges: updatedChallenges,
        challengeState: {
          ...challengeState,
          activeChallenge: {
            ...challengeState.activeChallenge,
            objectives: updatedObjectives,
            status: 'completed',
          },
          objectivesCompleted: completedCount,
          isTimerRunning: false,
          score: objectivePoints + timeBonus,
        },
      });
    } else {
      set({
        challengeState: {
          ...challengeState,
          activeChallenge: {
            ...challengeState.activeChallenge,
            objectives: updatedObjectives,
          },
          objectivesCompleted: completedCount,
          score: objectivePoints,
        },
      });
    }
  },

  failChallenge: () => {
    const { challengeState, challenges } = get();
    if (!challengeState.activeChallenge) return;

    const updatedChallenges = challenges.map((c) =>
      c.id === challengeState.activeChallenge!.id
        ? { ...c, status: 'available' as const }
        : c
    );

    set({
      challenges: updatedChallenges,
      challengeState: {
        ...challengeState,
        activeChallenge: {
          ...challengeState.activeChallenge,
          status: 'failed',
        },
        isTimerRunning: false,
      },
    });
  },

  resetChallengeState: () => {
    set({
      challengeState: {
        activeChallenge: null,
        elapsedTime: 0,
        isTimerRunning: false,
        objectivesCompleted: 0,
        totalObjectives: 0,
        score: 0,
      },
    });
  },

  updateChallengeTimer: (elapsed: number) => {
    const { challengeState } = get();
    if (!challengeState.isTimerRunning) return;

    // Check time limit
    if (
      challengeState.activeChallenge?.timeLimit &&
      elapsed >= challengeState.activeChallenge.timeLimit
    ) {
      get().failChallenge();
      return;
    }

    set({
      challengeState: {
        ...challengeState,
        elapsedTime: elapsed,
      },
    });
  },
});
