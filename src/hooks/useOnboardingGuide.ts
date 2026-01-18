/**
 * Onboarding Guide Hook
 *
 * Minimalist guided onboarding for new users.
 * Tracks progress through key actions and highlights next steps.
 *
 * Flow:
 * 1. Add an object to the scene
 * 2. Generate batch demos
 * 3. (Optional) Export to LeRobot
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'robosim_onboarding_guide';

export type OnboardingStep = 'add-object' | 'generate-demos' | 'export' | 'complete';

interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isActive: boolean; // Whether guided mode is active
  hasSeenWelcome: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  currentStep: 'add-object',
  completedSteps: [],
  isActive: false,
  hasSeenWelcome: false,
};

/**
 * Load onboarding state from localStorage
 */
function loadState(): OnboardingState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE;
}

/**
 * Save onboarding state to localStorage
 */
function saveState(state: OnboardingState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get the next step after completing a step
 */
function getNextStep(current: OnboardingStep): OnboardingStep {
  switch (current) {
    case 'add-object':
      return 'generate-demos';
    case 'generate-demos':
      return 'export';
    case 'export':
      return 'complete';
    default:
      return 'complete';
  }
}

/**
 * Hook for managing onboarding guide state
 */
export function useOnboardingGuide() {
  const [state, setState] = useState<OnboardingState>(loadState);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  /**
   * Start the guided onboarding flow
   */
  const startGuide = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: true,
      hasSeenWelcome: true,
      currentStep: prev.completedSteps.length === 0 ? 'add-object' : prev.currentStep,
    }));
  }, []);

  /**
   * Mark a step as complete and advance to next
   */
  const completeStep = useCallback((step: OnboardingStep) => {
    setState(prev => {
      if (prev.completedSteps.includes(step)) {
        return prev; // Already completed
      }

      const completedSteps = [...prev.completedSteps, step];
      const nextStep = getNextStep(step);

      return {
        ...prev,
        completedSteps,
        currentStep: nextStep,
        isActive: nextStep !== 'complete' ? prev.isActive : false,
      };
    });
  }, []);

  /**
   * Skip the current step
   */
  const skipStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: getNextStep(prev.currentStep),
      isActive: getNextStep(prev.currentStep) !== 'complete',
    }));
  }, []);

  /**
   * Dismiss the guide entirely
   */
  const dismissGuide = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
    }));
  }, []);

  /**
   * Reset onboarding (for testing)
   */
  const resetGuide = useCallback(() => {
    setState(DEFAULT_STATE);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /**
   * Check if a step should be highlighted
   */
  const shouldHighlight = useCallback((step: OnboardingStep) => {
    return state.isActive && state.currentStep === step;
  }, [state.isActive, state.currentStep]);

  /**
   * Get hint text for current step
   */
  const getHintText = useCallback(() => {
    if (!state.isActive) return null;

    switch (state.currentStep) {
      case 'add-object':
        return 'First, add an object to the scene. Click "Add Object" in the Objects panel.';
      case 'generate-demos':
        return 'Great! Now generate training demos. Click "Generate 10 Demos" to create varied pickup demonstrations.';
      case 'export':
        return 'Demos recorded! Export to LeRobot format for training, or upload to HuggingFace.';
      default:
        return null;
    }
  }, [state.isActive, state.currentStep]);

  return {
    // State
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    isActive: state.isActive,
    hasSeenWelcome: state.hasSeenWelcome,

    // Actions
    startGuide,
    completeStep,
    skipStep,
    dismissGuide,
    resetGuide,

    // Helpers
    shouldHighlight,
    getHintText,
  };
}

// Expose reset function for debugging
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { resetOnboardingGuide: () => void }).resetOnboardingGuide = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
}
