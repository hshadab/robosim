/**
 * Usage Tracking Store
 *
 * Tracks daily demo usage for free tier limits.
 * Uses localStorage for persistence (simple MVP approach).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TIER_LIMITS, type UserTier } from '../lib/supabase';

interface DailyUsage {
  date: string;  // YYYY-MM-DD
  demos: number;
}

interface UsageState {
  // Current day's usage
  dailyUsage: DailyUsage;

  // Actions
  incrementDemos: (count?: number) => void;
  getDemosToday: () => number;
  getDemosRemaining: (tier: UserTier) => number;
  canRunDemos: (tier: UserTier, count?: number) => boolean;
  resetIfNewDay: () => void;
}

const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      dailyUsage: {
        date: getTodayString(),
        demos: 0,
      },

      incrementDemos: (count = 1) => {
        const state = get();
        const today = getTodayString();

        // Reset if new day
        if (state.dailyUsage.date !== today) {
          set({
            dailyUsage: {
              date: today,
              demos: count,
            },
          });
        } else {
          set({
            dailyUsage: {
              ...state.dailyUsage,
              demos: state.dailyUsage.demos + count,
            },
          });
        }
      },

      getDemosToday: () => {
        const state = get();
        const today = getTodayString();

        // Return 0 if it's a new day
        if (state.dailyUsage.date !== today) {
          return 0;
        }
        return state.dailyUsage.demos;
      },

      getDemosRemaining: (tier: UserTier) => {
        const limit = TIER_LIMITS[tier].demos_per_day;
        if (limit === -1) return Infinity;

        const used = get().getDemosToday();
        return Math.max(0, limit - used);
      },

      canRunDemos: (tier: UserTier, count = 1) => {
        const limit = TIER_LIMITS[tier].demos_per_day;
        if (limit === -1) return true;  // Unlimited

        const used = get().getDemosToday();
        return used + count <= limit;
      },

      resetIfNewDay: () => {
        const state = get();
        const today = getTodayString();

        if (state.dailyUsage.date !== today) {
          set({
            dailyUsage: {
              date: today,
              demos: 0,
            },
          });
        }
      },
    }),
    {
      name: 'robosim-usage',
      version: 1,
    }
  )
);
