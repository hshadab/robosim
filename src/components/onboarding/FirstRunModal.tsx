/**
 * First Run Modal
 *
 * Welcomes new users and guides them to the tutorial system.
 * Only shows once per user (tracked via localStorage).
 */

import React, { useState, useEffect } from 'react';
import {
  Rocket,
  GraduationCap,
  X,
  ChevronRight,
  Sliders,
  Brain,
  Database,
  Gamepad2
} from 'lucide-react';

const STORAGE_KEY = 'robosim_onboarding_completed';

interface FirstRunModalProps {
  onStartTutorial: () => void;
  onSkip: () => void;
}

const FeatureHighlight: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string
}> = ({ icon, title, description }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
    <div className="text-blue-400 mt-0.5">{icon}</div>
    <div>
      <h4 className="text-sm font-medium text-white">{title}</h4>
      <p className="text-xs text-slate-400 mt-0.5">{description}</p>
    </div>
  </div>
);

export const FirstRunModal: React.FC<FirstRunModalProps> = ({
  onStartTutorial,
  onSkip
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding before
    const hasCompleted = localStorage.getItem(STORAGE_KEY);
    if (!hasCompleted) {
      // Small delay for smoother appearance
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleStartTutorial = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onStartTutorial();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg mx-4 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="welcome-title"
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-4">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h2 id="welcome-title" className="text-2xl font-bold text-white mb-2">
            Welcome to RoboSim!
          </h2>
          <p className="text-blue-100 text-sm">
            Browser-based robotics simulation with AI-powered controls
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-300 text-sm text-center mb-4">
            Get started quickly with these key features:
          </p>

          <div className="space-y-3">
            <FeatureHighlight
              icon={<Brain className="w-5 h-5" />}
              title="AI-Powered Pickup"
              description="Chat 'pick up the cube' - AI plans IK with validation and auto-retry"
            />
            <FeatureHighlight
              icon={<Database className="w-5 h-5" />}
              title="Training Data Pipeline"
              description="Active learning auto-promotes successful pickups + exports to LeRobot"
            />
            <FeatureHighlight
              icon={<Sliders className="w-5 h-5" />}
              title="Training Dashboard"
              description="Track success rates, view coverage heatmap, export contact events"
            />
            <FeatureHighlight
              icon={<Gamepad2 className="w-5 h-5" />}
              title="Multiple Control Modes"
              description="Keyboard, gamepad, hand tracking, click-to-move IK, and voice"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Skip for Now
          </button>
          <button
            onClick={handleStartTutorial}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            Start Tutorial
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Footer note */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-slate-500">
            You can access the tutorial anytime from the Control tab
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to manage first-run state
 * NOTE: Tutorial modal is disabled - always returns showModal: false
 */
export const useFirstRun = () => {
  // Tutorial modal disabled - never show
  const showModal = false;
  const hasChecked = true;

  const markComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const resetOnboarding = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    showModal,
    hasChecked,
    markComplete,
    resetOnboarding,
  };
};

/**
 * Reset onboarding state (for testing)
 */
export const resetOnboarding = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
};

// Expose to window for debugging (dev mode only)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { resetRoboSimOnboarding: typeof resetOnboarding }).resetRoboSimOnboarding = resetOnboarding;
}
