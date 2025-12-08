/**
 * Feature Gating Hook
 *
 * Provides easy access to tier-based feature gating throughout the app.
 * Use this hook to check if a user can access specific features or is within usage limits.
 */

import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { TIER_LIMITS, type UserTier } from '../lib/supabase';

type Feature = keyof typeof TIER_LIMITS.free.features;
type UsageLimit = 'episodes_per_month' | 'api_calls_per_day';

interface FeatureGateResult {
  // Current user tier
  tier: UserTier;
  isAuthenticated: boolean;

  // Feature access
  canAccess: (feature: Feature) => boolean;
  hasFeature: (feature: Feature) => boolean;

  // Usage limits
  isWithinLimit: (limitType: UsageLimit) => boolean;
  getLimit: (limitType: UsageLimit) => number;
  getCurrentUsage: (limitType: UsageLimit) => number;
  getRemainingUsage: (limitType: UsageLimit) => number;

  // Tier info
  tierLimits: (typeof TIER_LIMITS)[UserTier];
  isFreeTier: boolean;
  isProOrAbove: boolean;
  isTeamOrAbove: boolean;
  isEnterprise: boolean;

  // Upgrade prompts
  requiresUpgrade: (feature: Feature) => boolean;
  getRequiredTierForFeature: (feature: Feature) => UserTier | null;
}

/**
 * Hook for checking feature access based on user tier
 */
export function useFeatureGate(): FeatureGateResult {
  const { profile, isAuthenticated, getTier, canAccessFeature, isWithinUsageLimit } =
    useAuthStore();

  const tier = getTier();
  const tierLimits = TIER_LIMITS[tier];

  const isFreeTier = tier === 'free';
  const isProOrAbove = tier === 'pro' || tier === 'team' || tier === 'enterprise';
  const isTeamOrAbove = tier === 'team' || tier === 'enterprise';
  const isEnterprise = tier === 'enterprise';

  const canAccess = useCallback(
    (feature: Feature): boolean => {
      if (!isAuthenticated) return false;
      return canAccessFeature(feature);
    },
    [isAuthenticated, canAccessFeature]
  );

  const hasFeature = useCallback(
    (feature: Feature): boolean => {
      return tierLimits.features[feature];
    },
    [tierLimits]
  );

  const isWithinLimit = useCallback(
    (limitType: UsageLimit): boolean => {
      return isWithinUsageLimit(limitType);
    },
    [isWithinUsageLimit]
  );

  const getLimit = useCallback(
    (limitType: UsageLimit): number => {
      return tierLimits[limitType];
    },
    [tierLimits]
  );

  const getCurrentUsage = useCallback(
    (limitType: UsageLimit): number => {
      if (!profile?.usage_this_month) return 0;

      if (limitType === 'episodes_per_month') {
        return profile.usage_this_month.episodes_exported || 0;
      }
      return profile.usage_this_month.api_calls || 0;
    },
    [profile]
  );

  const getRemainingUsage = useCallback(
    (limitType: UsageLimit): number => {
      const limit = getLimit(limitType);
      if (limit === -1) return Infinity; // Unlimited
      const current = getCurrentUsage(limitType);
      return Math.max(0, limit - current);
    },
    [getLimit, getCurrentUsage]
  );

  const requiresUpgrade = useCallback(
    (feature: Feature): boolean => {
      return !hasFeature(feature);
    },
    [hasFeature]
  );

  const getRequiredTierForFeature = useCallback((feature: Feature): UserTier | null => {
    const tiers: UserTier[] = ['free', 'pro', 'team', 'enterprise'];

    for (const t of tiers) {
      if (TIER_LIMITS[t].features[feature]) {
        return t;
      }
    }
    return null;
  }, []);

  return useMemo(
    () => ({
      tier,
      isAuthenticated,
      canAccess,
      hasFeature,
      isWithinLimit,
      getLimit,
      getCurrentUsage,
      getRemainingUsage,
      tierLimits,
      isFreeTier,
      isProOrAbove,
      isTeamOrAbove,
      isEnterprise,
      requiresUpgrade,
      getRequiredTierForFeature,
    }),
    [
      tier,
      isAuthenticated,
      canAccess,
      hasFeature,
      isWithinLimit,
      getLimit,
      getCurrentUsage,
      getRemainingUsage,
      tierLimits,
      isFreeTier,
      isProOrAbove,
      isTeamOrAbove,
      isEnterprise,
      requiresUpgrade,
      getRequiredTierForFeature,
    ]
  );
}

/**
 * Feature gate component for conditional rendering
 */
interface FeatureGateProps {
  feature: Feature;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const { canAccess } = useFeatureGate();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Usage limit gate component
 */
interface UsageLimitGateProps {
  limitType: UsageLimit;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function UsageLimitGate({ limitType, children, fallback = null }: UsageLimitGateProps) {
  const { isWithinLimit } = useFeatureGate();

  if (isWithinLimit(limitType)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
