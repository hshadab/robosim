/**
 * Interactive Tutorial Panel
 *
 * Guides new users through RoboSim features with step-by-step instructions.
 * Highlights relevant UI elements and tracks completion.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  X,
  Lightbulb,
  Gamepad2,
  Brain,
  Database,
  Download,
  Keyboard,
  MousePointer2,
  Mic,
  Eye,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../common';
import { useAppStore } from '../../stores/useAppStore';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  targetPanel?: string;
  completed?: boolean;
  tips?: string[];
}

interface TutorialModule {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: TutorialStep[];
  estimatedTime: string;
}

const TUTORIAL_MODULES: TutorialModule[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of controlling the robot arm',
    icon: <Lightbulb className="w-5 h-5" />,
    estimatedTime: '2 min',
    steps: [
      {
        id: 'gs-1',
        title: 'Explore the 3D View',
        description: 'Click and drag to rotate the camera. Scroll to zoom in/out. Right-click drag to pan.',
        icon: <MousePointer2 className="w-4 h-4" />,
        tips: ['Hold Shift while dragging for finer control', 'Double-click to reset the camera view'],
      },
      {
        id: 'gs-2',
        title: 'Move the Robot with Sliders',
        description: 'Use the Joint Controls panel on the right to move individual joints. Try moving the base joint left and right.',
        icon: <Gamepad2 className="w-4 h-4" />,
        targetPanel: 'joint-controls',
        tips: ['Each slider controls one joint', 'The gripper slider opens and closes the claw'],
      },
      {
        id: 'gs-3',
        title: 'Try a Preset Position',
        description: 'Click one of the preset buttons (Home, Wave, Pick) to see the robot move to a predefined pose.',
        icon: <Sparkles className="w-4 h-4" />,
        targetPanel: 'presets',
      },
      {
        id: 'gs-4',
        title: 'Enable Keyboard Control',
        description: 'In Advanced Controls, click the Keyboard icon to enable WASD control. Use WASD for base/shoulder, arrow keys for elbow/wrist.',
        icon: <Keyboard className="w-4 h-4" />,
        targetPanel: 'advanced-controls',
        tips: ['Q/E controls the gripper', 'Space resets to home position'],
      },
    ],
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    description: 'Use AI to control and understand the robot',
    icon: <Brain className="w-5 h-5" />,
    estimatedTime: '3 min',
    steps: [
      {
        id: 'ai-1',
        title: 'Chat with the Robot',
        description: 'Open the AI Chat panel and type a command like "wave hello" or "move left". The AI will control the robot for you.',
        icon: <Brain className="w-4 h-4" />,
        targetPanel: 'llm-chat',
        tips: ['Try "pick up the cube"', 'Ask "where is the gripper?"'],
      },
      {
        id: 'ai-2',
        title: 'Try Voice Control',
        description: 'Open the Voice Control panel and click the microphone. Say "move forward" or "open gripper".',
        icon: <Mic className="w-4 h-4" />,
        targetPanel: 'voice-control',
        tips: ['Say "Hey Robot" to use wake word mode', 'Works best in Chrome or Edge'],
      },
      {
        id: 'ai-3',
        title: 'Analyze the Scene',
        description: 'Open Vision Analysis and click "Analyze Scene". Ask questions like "What objects are in the scene?"',
        icon: <Eye className="w-4 h-4" />,
        targetPanel: 'vision-analysis',
      },
      {
        id: 'ai-4',
        title: 'Load a Trained Policy',
        description: 'Open LeRobot Policies and search for SO-101 policies. Download one with ONNX and click Run to see autonomous behavior.',
        icon: <Brain className="w-4 h-4" />,
        targetPanel: 'policy-browser',
        tips: ['Only policies with ONNX export work in browser', 'Policies run at 20Hz inference'],
      },
    ],
  },
  {
    id: 'data-collection',
    title: 'Data Collection',
    description: 'Record demonstrations for training',
    icon: <Database className="w-5 h-5" />,
    estimatedTime: '3 min',
    steps: [
      {
        id: 'dc-1',
        title: 'Start Recording',
        description: 'Open the LeRobot Dataset panel. Click Record to start capturing your demonstration.',
        icon: <Database className="w-4 h-4" />,
        targetPanel: 'dataset-recorder',
      },
      {
        id: 'dc-2',
        title: 'Perform a Task',
        description: 'Control the robot to perform a task (e.g., pick up a cube). Use keyboard, sliders, or click-to-move.',
        icon: <Gamepad2 className="w-4 h-4" />,
        tips: ['Keep movements smooth and deliberate', 'Aim for 5-10 second episodes'],
      },
      {
        id: 'dc-3',
        title: 'Mark Success or Failure',
        description: 'When done, click Success if the task was completed, or Fail if it wasn\'t. This labels the episode for training.',
        icon: <CheckCircle className="w-4 h-4" />,
      },
      {
        id: 'dc-4',
        title: 'Export to LeRobot',
        description: 'After recording multiple episodes, click Export to download in LeRobot format. Use this data for training policies.',
        icon: <Download className="w-4 h-4" />,
        tips: ['LeRobot v3 format includes Parquet + video', 'Upload to HuggingFace Hub for sharing'],
      },
    ],
  },
];

// Local storage key for tutorial progress
const TUTORIAL_PROGRESS_KEY = 'robosim_tutorial_progress';

interface TutorialProgress {
  completedSteps: string[];
  currentModule: string | null;
  dismissed: boolean;
}

function loadProgress(): TutorialProgress {
  try {
    const saved = localStorage.getItem(TUTORIAL_PROGRESS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore localStorage errors
  }
  return { completedSteps: [], currentModule: null, dismissed: false };
}

function saveProgress(progress: TutorialProgress): void {
  try {
    localStorage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Ignore localStorage errors
  }
}

export const TutorialPanel: React.FC = () => {
  const { activeRobotType } = useAppStore();
  const [progress, setProgress] = useState<TutorialProgress>(loadProgress);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [minimized, setMinimized] = useState(false);

  // Save progress when it changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Check if step is completed
  const isStepCompleted = useCallback(
    (stepId: string) => progress.completedSteps.includes(stepId),
    [progress.completedSteps]
  );

  // Mark step as completed
  const completeStep = useCallback((stepId: string) => {
    setProgress((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(stepId)
        ? prev.completedSteps
        : [...prev.completedSteps, stepId],
    }));
  }, []);

  // Get current module
  const currentModule = TUTORIAL_MODULES.find((m) => m.id === activeModule);
  const currentStep = currentModule?.steps[activeStep];

  // Calculate overall progress
  const totalSteps = TUTORIAL_MODULES.reduce((sum, m) => sum + m.steps.length, 0);
  const completedSteps = progress.completedSteps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  // Navigate steps
  const nextStep = () => {
    if (!currentModule) return;
    if (currentStep) {
      completeStep(currentStep.id);
    }
    if (activeStep < currentModule.steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      setActiveModule(null);
      setActiveStep(0);
    }
  };

  const prevStep = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  // Reset tutorial
  const resetTutorial = () => {
    setProgress({ completedSteps: [], currentModule: null, dismissed: false });
    setActiveModule(null);
    setActiveStep(0);
  };

  // Dismiss tutorial
  const dismissTutorial = () => {
    setProgress((prev) => ({ ...prev, dismissed: true }));
  };

  // Only show for arm robot
  if (activeRobotType !== 'arm') return null;

  // Don't show if dismissed and mostly complete
  if (progress.dismissed && progressPercent > 50) return null;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-yellow-400" />
          Interactive Tutorial
          {progressPercent > 0 && (
            <span className="text-xs font-normal text-slate-400">
              {progressPercent}% complete
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {progressPercent > 0 && (
            <button
              onClick={resetTutorial}
              className="p-1 text-slate-500 hover:text-white transition-colors"
              title="Reset tutorial"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setMinimized(!minimized)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {minimized ? <ChevronRight className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Active lesson */}
          {currentModule && currentStep ? (
            <div className="space-y-3">
              {/* Module header */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {currentModule.icon}
                <span>{currentModule.title}</span>
                <span className="text-slate-600">•</span>
                <span>
                  Step {activeStep + 1} of {currentModule.steps.length}
                </span>
              </div>

              {/* Step content */}
              <div className="p-3 bg-slate-900/50 rounded-lg border border-yellow-500/20">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                    {currentStep.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white mb-1">{currentStep.title}</h4>
                    <p className="text-xs text-slate-400">{currentStep.description}</p>
                    {currentStep.tips && currentStep.tips.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {currentStep.tips.map((tip, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-1 text-xs text-yellow-400/70"
                          >
                            <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            {tip}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={prevStep} disabled={activeStep === 0}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={nextStep}
                >
                  {activeStep === currentModule.steps.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-1">
                {currentModule.steps.map((step, i) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === activeStep
                        ? 'bg-yellow-400'
                        : isStepCompleted(step.id)
                        ? 'bg-green-500'
                        : 'bg-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Module selection */
            <div className="space-y-2">
              {TUTORIAL_MODULES.map((module) => {
                const moduleCompleted = module.steps.every((s) =>
                  progress.completedSteps.includes(s.id)
                );
                const moduleProgress = module.steps.filter((s) =>
                  progress.completedSteps.includes(s.id)
                ).length;

                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      setActiveModule(module.id);
                      setActiveStep(0);
                    }}
                    className={`w-full p-3 rounded-lg border transition-colors text-left ${
                      moduleCompleted
                        ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
                        : 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          moduleCompleted
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}
                      >
                        {moduleCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          module.icon
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white">{module.title}</span>
                          <span className="text-xs text-slate-500">{module.estimatedTime}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{module.description}</p>
                        {/* Progress indicator */}
                        <div className="flex items-center gap-1 mt-2">
                          {module.steps.map((step) => (
                            <div
                              key={step.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                progress.completedSteps.includes(step.id)
                                  ? 'bg-green-500'
                                  : 'bg-slate-600'
                              }`}
                            />
                          ))}
                          <span className="text-xs text-slate-500 ml-1">
                            {moduleProgress}/{module.steps.length}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Dismiss option */}
          {!activeModule && progressPercent < 50 && (
            <button
              onClick={dismissTutorial}
              className="w-full mt-3 text-xs text-slate-500 hover:text-slate-400 transition-colors"
            >
              I'm familiar with RoboSim, hide tutorial
            </button>
          )}
        </>
      )}
    </div>
  );
};
