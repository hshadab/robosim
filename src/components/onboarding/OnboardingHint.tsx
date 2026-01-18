/**
 * Onboarding Hint Component
 *
 * Shows contextual hints during guided onboarding.
 * Appears as a floating banner with current step info and skip option.
 */

import React from 'react';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { useOnboardingGuide } from '../../hooks/useOnboardingGuide';

export const OnboardingHint: React.FC = () => {
  const { isActive, currentStep, getHintText, skipStep, dismissGuide } = useOnboardingGuide();

  const hintText = getHintText();

  if (!isActive || !hintText) return null;

  const stepNumber = currentStep === 'add-object' ? 1 : currentStep === 'generate-demos' ? 2 : 3;
  const totalSteps = 3;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/20">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${(stepNumber / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-white/70">
                Step {stepNumber} of {totalSteps}
              </span>
            </div>
            <p className="text-sm text-white leading-relaxed">
              {hintText}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={skipStep}
              className="px-2 py-1 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
            >
              Skip
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={dismissGuide}
              className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss guide"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Pulsing highlight wrapper for onboarding targets
 *
 * Wrap any button/element to add a pulsing glow when it's the current step.
 */
export const OnboardingHighlight: React.FC<{
  step: 'add-object' | 'generate-demos' | 'export';
  children: React.ReactNode;
  className?: string;
}> = ({ step, children, className = '' }) => {
  const { shouldHighlight } = useOnboardingGuide();
  const isHighlighted = shouldHighlight(step);

  if (!isHighlighted) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Pulsing ring */}
      <div className="absolute inset-0 rounded-lg animate-pulse-ring pointer-events-none" />
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-lg bg-blue-500/20 animate-pulse pointer-events-none" />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

// Add CSS for pulse animation (add to global CSS or use inline)
// .animate-pulse-ring {
//   box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
//   animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
// }
// @keyframes pulse-ring {
//   0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
//   70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
//   100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
// }
