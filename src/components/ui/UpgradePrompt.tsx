/**
 * Upgrade Prompt Component
 *
 * Shows a prompt when a user tries to access a feature that requires an upgrade.
 */

import React from 'react';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { TIER_LIMITS, type UserTier } from '../../lib/supabase';

type Feature = keyof typeof TIER_LIMITS.free.features;

interface UpgradePromptProps {
  feature: Feature;
  title?: string;
  description?: string;
  variant?: 'inline' | 'card' | 'banner';
  onUpgradeClick?: () => void;
}

const FEATURE_NAMES: Record<Feature, string> = {
  basic_simulation: 'Basic Simulation',
  dataset_export: 'Dataset Export',
  huggingface_upload: 'HuggingFace Upload',
  ai_chat: 'AI Chat Assistant',
  image_to_3d: 'Image to 3D Conversion',
  policy_inference: 'Policy Inference',
  multi_robot: 'Multi-Robot Simulation',
  custom_environments: 'Custom Environments',
};

const TIER_LABELS: Record<UserTier, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  title,
  description,
  variant = 'card',
  onUpgradeClick,
}) => {
  const { getRequiredTierForFeature, tier } = useFeatureGate();
  const requiredTier = getRequiredTierForFeature(feature);
  const featureName = FEATURE_NAMES[feature] || feature;

  const defaultTitle = `Upgrade to ${requiredTier ? TIER_LABELS[requiredTier] : 'Pro'}`;
  const defaultDescription = `${featureName} is available on the ${requiredTier ? TIER_LABELS[requiredTier] : 'Pro'} plan and above.`;

  if (variant === 'inline') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400 text-sm">
        <Lock className="w-3 h-3" />
        <span>{requiredTier ? TIER_LABELS[requiredTier] : 'Pro'}</span>
      </span>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-amber-100">
            {title || defaultTitle}: {description || defaultDescription}
          </span>
        </div>
        <button
          onClick={onUpgradeClick}
          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm font-medium transition"
        >
          Upgrade <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Default card variant
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">{title || defaultTitle}</h3>

      <p className="text-slate-400 mb-4">{description || defaultDescription}</p>

      <div className="text-sm text-slate-500 mb-4">
        Current plan: <span className="text-slate-300">{TIER_LABELS[tier]}</span>
      </div>

      <button
        onClick={onUpgradeClick}
        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 mx-auto"
      >
        <Sparkles className="w-4 h-4" />
        Upgrade Now
      </button>
    </div>
  );
};

/**
 * Usage limit warning component
 */
interface UsageLimitWarningProps {
  limitType: 'episodes_per_month' | 'api_calls_per_day';
  variant?: 'inline' | 'card' | 'banner';
  onUpgradeClick?: () => void;
}

export const UsageLimitWarning: React.FC<UsageLimitWarningProps> = ({
  limitType,
  variant = 'banner',
  onUpgradeClick,
}) => {
  const { getCurrentUsage, getLimit, getRemainingUsage, tier } = useFeatureGate();

  const current = getCurrentUsage(limitType);
  const limit = getLimit(limitType);
  const remaining = getRemainingUsage(limitType);

  const isUnlimited = limit === -1;
  const isNearLimit = !isUnlimited && remaining <= limit * 0.2;
  const isAtLimit = !isUnlimited && remaining === 0;

  if (isUnlimited || (!isNearLimit && !isAtLimit)) {
    return null;
  }

  const limitLabel =
    limitType === 'episodes_per_month' ? 'episode exports this month' : 'API calls today';

  if (variant === 'inline') {
    return (
      <span
        className={`text-sm ${isAtLimit ? 'text-red-400' : 'text-amber-400'}`}
      >
        {isAtLimit ? 'Limit reached' : `${remaining} remaining`}
      </span>
    );
  }

  const message = isAtLimit
    ? `You've reached your ${limitLabel} limit (${limit})`
    : `${remaining} of ${limit} ${limitLabel} remaining`;

  if (variant === 'banner') {
    return (
      <div
        className={`${
          isAtLimit
            ? 'bg-red-500/20 border-red-500/30'
            : 'bg-amber-500/20 border-amber-500/30'
        } border rounded-lg px-4 py-3 flex items-center justify-between`}
      >
        <span className={isAtLimit ? 'text-red-100' : 'text-amber-100'}>{message}</span>
        <button
          onClick={onUpgradeClick}
          className={`flex items-center gap-1 ${
            isAtLimit ? 'text-red-400 hover:text-red-300' : 'text-amber-400 hover:text-amber-300'
          } text-sm font-medium transition`}
        >
          Upgrade for more <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
      <div
        className={`w-12 h-12 ${
          isAtLimit ? 'bg-red-500/20' : 'bg-amber-500/20'
        } rounded-full flex items-center justify-center mx-auto mb-4`}
      >
        <Lock className={`w-6 h-6 ${isAtLimit ? 'text-red-400' : 'text-amber-400'}`} />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        {isAtLimit ? 'Usage Limit Reached' : 'Approaching Limit'}
      </h3>

      <p className="text-slate-400 mb-2">{message}</p>

      <div className="w-full bg-slate-700 rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full ${isAtLimit ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.min(100, (current / limit) * 100)}%` }}
        />
      </div>

      <div className="text-sm text-slate-500 mb-4">
        Current plan: <span className="text-slate-300">{TIER_LABELS[tier]}</span>
      </div>

      <button
        onClick={onUpgradeClick}
        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 mx-auto"
      >
        <Sparkles className="w-4 h-4" />
        Upgrade for More
      </button>
    </div>
  );
};
