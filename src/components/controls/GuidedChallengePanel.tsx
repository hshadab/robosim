/**
 * Guided Challenge Panel
 *
 * Interactive tutorials with step-by-step guidance and position validation:
 * - Visual indicators showing target positions
 * - Real-time progress tracking
 * - Hints and feedback
 * - Success animations
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  RotateCcw,
  CheckCircle,
  Target,
  Lightbulb,
  Trophy,
  MapPin,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';
import type { JointState } from '../../types';

interface GuidedStep {
  id: string;
  title: string;
  description: string;
  targetJoints: Partial<JointState>;
  tolerance: number; // degrees
  hint: string;
  successMessage: string;
}

interface GuidedChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: GuidedStep[];
}

// Predefined guided challenges
const GUIDED_CHALLENGES: GuidedChallenge[] = [
  {
    id: 'basic-movement',
    name: 'Basic Movement',
    description: 'Learn the fundamental joint movements',
    difficulty: 'beginner',
    steps: [
      {
        id: 'step1',
        title: 'Rotate the Base',
        description: 'Turn the base joint to 45 degrees to the right',
        targetJoints: { base: 45 },
        tolerance: 10,
        hint: 'Use the Base slider or press the arrow keys while holding the base joint',
        successMessage: 'Great! You rotated the base.',
      },
      {
        id: 'step2',
        title: 'Lower the Shoulder',
        description: 'Move the shoulder down to -30 degrees',
        targetJoints: { shoulder: -30 },
        tolerance: 10,
        hint: 'The shoulder controls the main up/down motion of the arm',
        successMessage: 'Perfect! The shoulder is in position.',
      },
      {
        id: 'step3',
        title: 'Extend the Elbow',
        description: 'Bend the elbow to 60 degrees to reach forward',
        targetJoints: { elbow: 60 },
        tolerance: 10,
        hint: 'The elbow extends the arm forward and back',
        successMessage: 'Excellent! You extended the arm.',
      },
      {
        id: 'step4',
        title: 'Open the Gripper',
        description: 'Open the gripper to 100% to prepare for grabbing',
        targetJoints: { gripper: 100 },
        tolerance: 15,
        hint: 'Move the gripper slider all the way to the right',
        successMessage: 'The gripper is open and ready!',
      },
    ],
  },
  {
    id: 'reach-position',
    name: 'Reach a Position',
    description: 'Move the arm to a specific pose',
    difficulty: 'beginner',
    steps: [
      {
        id: 'step1',
        title: 'Home Position',
        description: 'Return all joints to their home position (0°)',
        targetJoints: { base: 0, shoulder: 0, elbow: 0, wrist: 0, wristRoll: 0 },
        tolerance: 10,
        hint: 'Click the "Home" preset button or manually move all sliders to 0',
        successMessage: 'You found the home position!',
      },
      {
        id: 'step2',
        title: 'Ready Position',
        description: 'Move to the ready position for picking',
        targetJoints: { base: 0, shoulder: -30, elbow: 60, wrist: -30 },
        tolerance: 10,
        hint: 'This is a common starting pose for pick-and-place tasks',
        successMessage: 'Ready position achieved!',
      },
      {
        id: 'step3',
        title: 'Extended Reach',
        description: 'Extend the arm forward to maximum reach',
        targetJoints: { shoulder: -45, elbow: 75, wrist: -30 },
        tolerance: 10,
        hint: 'Lower the shoulder and extend the elbow to reach further',
        successMessage: 'Maximum reach achieved!',
      },
    ],
  },
  {
    id: 'pick-motion',
    name: 'Pick Motion Sequence',
    description: 'Learn the complete pick-up motion',
    difficulty: 'intermediate',
    steps: [
      {
        id: 'step1',
        title: 'Position Above Object',
        description: 'Move the gripper above the pick position',
        targetJoints: { base: 0, shoulder: -30, elbow: 60, wrist: -30, gripper: 100 },
        tolerance: 10,
        hint: 'Start with the gripper open and positioned above',
        successMessage: 'Gripper positioned above!',
      },
      {
        id: 'step2',
        title: 'Lower to Object',
        description: 'Lower the arm to reach the object',
        targetJoints: { shoulder: -50, elbow: 70, wrist: -20, gripper: 100 },
        tolerance: 10,
        hint: 'Lower the shoulder and adjust the elbow to descend',
        successMessage: 'Arm lowered successfully!',
      },
      {
        id: 'step3',
        title: 'Close Gripper',
        description: 'Close the gripper to grasp the object',
        targetJoints: { gripper: 20 },
        tolerance: 15,
        hint: 'Move the gripper slider to close around the object',
        successMessage: 'Object grasped!',
      },
      {
        id: 'step4',
        title: 'Lift Object',
        description: 'Raise the arm to lift the object',
        targetJoints: { shoulder: -30, elbow: 60, gripper: 20 },
        tolerance: 10,
        hint: 'Raise the shoulder while keeping the gripper closed',
        successMessage: 'Object lifted! Challenge complete!',
      },
    ],
  },
];

// Check if current joints match target within tolerance
function checkStepComplete(
  currentJoints: JointState,
  targetJoints: Partial<JointState>,
  tolerance: number
): boolean {
  for (const [joint, targetValue] of Object.entries(targetJoints)) {
    const currentValue = currentJoints[joint as keyof JointState];
    if (Math.abs(currentValue - targetValue) > tolerance) {
      return false;
    }
  }
  return true;
}

// Calculate progress for a step (0-100)
function calculateStepProgress(
  currentJoints: JointState,
  targetJoints: Partial<JointState>
): number {
  const joints = Object.entries(targetJoints);
  if (joints.length === 0) return 100;

  let totalProgress = 0;
  for (const [joint, targetValue] of joints) {
    const currentValue = currentJoints[joint as keyof JointState];
    const diff = Math.abs(currentValue - targetValue);
    const maxDiff = 180; // Maximum possible difference
    const jointProgress = Math.max(0, 100 - (diff / maxDiff) * 100);
    totalProgress += jointProgress;
  }

  return Math.round(totalProgress / joints.length);
}

export const GuidedChallengePanel: React.FC = () => {
  const { joints } = useAppStore();
  const [expanded, setExpanded] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<GuidedChallenge | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showHint, setShowHint] = useState(false);
  const [challengeComplete, setChallengeComplete] = useState(false);

  // Current step
  const currentStep = selectedChallenge?.steps[currentStepIndex] || null;

  // Check step completion
  const isCurrentStepComplete = useMemo(() => {
    if (!currentStep) return false;
    return checkStepComplete(joints, currentStep.targetJoints, currentStep.tolerance);
  }, [joints, currentStep]);

  // Step progress
  const stepProgress = useMemo(() => {
    if (!currentStep) return 0;
    return calculateStepProgress(joints, currentStep.targetJoints);
  }, [joints, currentStep]);

  // Auto-advance when step is complete
  useEffect(() => {
    if (!isCurrentStepComplete || !currentStep || completedSteps.has(currentStep.id)) {
      return;
    }

    // Mark step complete and auto-advance after delay
    const timer = setTimeout(() => {
      setCompletedSteps((prev) => new Set(prev).add(currentStep.id));
      if (selectedChallenge && currentStepIndex < selectedChallenge.steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
        setShowHint(false);
      } else {
        setChallengeComplete(true);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isCurrentStepComplete, currentStep, completedSteps, selectedChallenge, currentStepIndex]);

  // Start challenge
  const handleStartChallenge = useCallback((challenge: GuidedChallenge) => {
    setSelectedChallenge(challenge);
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setChallengeComplete(false);
    setShowHint(false);
  }, []);

  // Reset challenge
  const handleReset = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setChallengeComplete(false);
    setShowHint(false);
  }, []);

  // Back to challenge list
  const handleBack = useCallback(() => {
    setSelectedChallenge(null);
    setChallengeComplete(false);
  }, []);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-400';
      case 'intermediate':
        return 'text-yellow-400';
      case 'advanced':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-blue-400" />
          Guided Challenges
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Challenge list */}
          {!selectedChallenge && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 mb-3">
                Learn robot control through interactive step-by-step tutorials.
              </p>
              {GUIDED_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.id}
                  onClick={() => handleStartChallenge(challenge)}
                  className="w-full p-3 text-left rounded-lg bg-slate-900/50 border border-slate-700/50
                           hover:border-blue-500/50 hover:bg-blue-500/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{challenge.name}</span>
                    <span className={`text-xs ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{challenge.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Target className="w-3 h-3" />
                    {challenge.steps.length} steps
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Active challenge */}
          {selectedChallenge && !challengeComplete && (
            <div className="space-y-3">
              {/* Challenge header */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className="text-xs text-slate-400 hover:text-white transition-colors"
                >
                  &larr; Back
                </button>
                <button
                  onClick={handleReset}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Restart challenge"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Challenge name */}
              <div className="p-2 bg-slate-900/50 rounded-lg">
                <div className="text-sm font-medium text-white">{selectedChallenge.name}</div>
                <div className="text-xs text-slate-400">
                  Step {currentStepIndex + 1} of {selectedChallenge.steps.length}
                </div>
              </div>

              {/* Step progress indicators */}
              <div className="flex gap-1">
                {selectedChallenge.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`flex-1 h-1 rounded-full transition-colors ${
                      completedSteps.has(step.id)
                        ? 'bg-green-500'
                        : idx === currentStepIndex
                        ? 'bg-blue-500'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Current step */}
              {currentStep && (
                <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    {isCurrentStepComplete ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <MapPin className="w-5 h-5 text-blue-400" />
                    )}
                    <span className="text-sm font-medium text-white">{currentStep.title}</span>
                  </div>

                  <p className="text-xs text-slate-400 mb-3">{currentStep.description}</p>

                  {/* Target joints */}
                  <div className="mb-3 p-2 bg-slate-800/50 rounded">
                    <div className="text-xs text-slate-500 mb-1">Target Position:</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      {Object.entries(currentStep.targetJoints).map(([joint, value]) => {
                        const currentValue = joints[joint as keyof JointState];
                        const isMatching = Math.abs(currentValue - value) <= currentStep.tolerance;
                        return (
                          <div key={joint} className="flex items-center justify-between">
                            <span className="text-slate-400 capitalize">{joint}:</span>
                            <span className={isMatching ? 'text-green-400' : 'text-slate-300'}>
                              {currentValue.toFixed(0)}° / {value}°
                              {isMatching && <CheckCircle className="w-3 h-3 inline ml-1" />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Progress</span>
                      <span className={stepProgress >= 100 ? 'text-green-400' : 'text-slate-400'}>
                        {stepProgress}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          isCurrentStepComplete ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${stepProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Success message */}
                  {isCurrentStepComplete && (
                    <div className="p-2 bg-green-500/20 rounded-lg border border-green-500/30 text-center">
                      <div className="text-sm text-green-400">{currentStep.successMessage}</div>
                    </div>
                  )}

                  {/* Hint button */}
                  {!isCurrentStepComplete && (
                    <>
                      <button
                        onClick={() => setShowHint(!showHint)}
                        className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                      >
                        <Lightbulb className="w-3 h-3" />
                        {showHint ? 'Hide hint' : 'Show hint'}
                      </button>

                      {showHint && (
                        <div className="mt-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                          <p className="text-xs text-yellow-300">{currentStep.hint}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Challenge complete */}
          {challengeComplete && selectedChallenge && (
            <div className="text-center py-6">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-white mb-2">Challenge Complete!</h4>
              <p className="text-sm text-slate-400 mb-4">
                You completed "{selectedChallenge.name}"
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleBack}
                >
                  More Challenges
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Info */}
          {!selectedChallenge && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-xs text-slate-500">
                Guided challenges teach you robot control with real-time feedback.
                Your progress is tracked as you move the joints.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
