/**
 * Vision Analysis Panel
 *
 * Provides scene understanding with "What's in the scene?" functionality.
 */

import React, { useState, useCallback, useRef } from 'react';
import { Eye, Camera, HelpCircle, Loader2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../common';
import {
  askAboutScene,
  generateSceneAnalysis,
  captureSceneImage,
  type SceneAnalysis,
  type VisionResponse,
} from '../../lib/visionLanguage';
import { useAppStore } from '../../stores/useAppStore';
import { generateSemanticState } from '../../lib/semanticState';

// Collapsible wrapper for the panel
const CollapsiblePanel: React.FC<{
  title: string;
  icon: React.FC<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-800/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-700/30 transition"
      >
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-300 flex-1">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isOpen && (
        <div className="border-t border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  );
};

interface VisionAnalysisPanelProps {
  defaultOpen?: boolean;
}

const QUICK_QUESTIONS = [
  "What's in the scene?",
  "What can the robot pick up?",
  "Describe the environment",
  "Where are the objects?",
];

export const VisionAnalysisPanel: React.FC<VisionAnalysisPanelProps> = ({
  defaultOpen = false,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [, setLastAnalysis] = useState<SceneAnalysis | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [response, setResponse] = useState<VisionResponse | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);

  const { activeRobotType, joints, wheeledRobot, drone, humanoid, sensors } = useAppStore();
  const activeRobot = activeRobotType;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Get the 3D canvas
  const getCanvas = useCallback((): HTMLCanvasElement | null => {
    if (canvasRef.current) return canvasRef.current;

    // Find the Three.js canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvasRef.current = canvas;
      return canvas;
    }
    return null;
  }, []);

  // Capture and analyze the scene
  const analyzeScene = useCallback(async () => {
    const canvas = getCanvas();
    if (!canvas) {
      setResponse({
        answer: 'Could not find the 3D viewport canvas.',
        confidence: 0,
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Capture image
      const imageData = captureSceneImage(canvas);
      setCapturedImage(imageData);

      // Get robot state
      const robotState = generateSemanticState(
        activeRobot,
        joints,
        wheeledRobot,
        drone,
        humanoid,
        sensors,
        false
      );

      // Generate full analysis
      const analysis = await generateSceneAnalysis(canvas, robotState);
      setLastAnalysis(analysis);
      setResponse({
        answer: analysis.description,
        confidence: 0.8,
        detectedObjects: analysis.objects,
        suggestedActions: analysis.suggestions,
      });
    } catch (error) {
      setResponse({
        answer: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [getCanvas, activeRobot, joints, wheeledRobot, drone, humanoid, sensors]);

  // Ask a specific question
  const askQuestion = useCallback(async (question: string) => {
    const canvas = getCanvas();
    if (!canvas) {
      setResponse({
        answer: 'Could not find the 3D viewport canvas.',
        confidence: 0,
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const imageData = captureSceneImage(canvas);
      setCapturedImage(imageData);

      const result = await askAboutScene({
        question,
        imageData,
        context: {
          robotType: activeRobot,
          jointPositions: joints as unknown as Record<string, number>,
        },
      });

      setResponse(result);
    } catch (error) {
      setResponse({
        answer: `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [getCanvas, activeRobot, joints]);

  const handleQuickQuestion = (question: string) => {
    setCustomQuestion('');
    askQuestion(question);
  };

  const handleCustomQuestion = () => {
    if (customQuestion.trim()) {
      askQuestion(customQuestion);
    }
  };

  return (
    <CollapsiblePanel
      title="Vision Analysis"
      icon={Eye}
      defaultOpen={defaultOpen}
    >
      <div className="p-3 space-y-4">
        {/* Main Analyze Button */}
        <Button
          variant="primary"
          className="w-full"
          onClick={analyzeScene}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Analyze Scene
            </>
          )}
        </Button>

        {/* Quick Questions */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Quick questions
          </div>
          <div className="grid grid-cols-2 gap-1">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleQuickQuestion(q)}
                disabled={isAnalyzing}
                className="text-xs px-2 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded text-slate-300 text-left truncate disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Question */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomQuestion()}
            placeholder="Ask about the scene..."
            className="flex-1 px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isAnalyzing}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCustomQuestion}
            disabled={isAnalyzing || !customQuestion.trim()}
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>

        {/* Captured Image Preview */}
        {capturedImage && (
          <div>
            <button
              onClick={() => setShowImage(!showImage)}
              className="text-xs text-slate-400 hover:text-slate-300 mb-1"
            >
              {showImage ? 'Hide' : 'Show'} captured image
            </button>
            {showImage && (
              <img
                src={capturedImage}
                alt="Captured scene"
                className="w-full rounded border border-slate-600"
              />
            )}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            <div className="text-sm text-slate-200">{response.answer}</div>

            {/* Detected Objects */}
            {response.detectedObjects && response.detectedObjects.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-400 mb-1">Detected objects:</div>
                <div className="flex flex-wrap gap-1">
                  {response.detectedObjects.map((obj, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-0.5 rounded ${
                        obj.isGrabbable
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-600/50 text-slate-400'
                      }`}
                    >
                      {obj.label}
                      {obj.confidence && ` (${(obj.confidence * 100).toFixed(0)}%)`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Actions */}
            {response.suggestedActions && response.suggestedActions.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-400 mb-1">Suggested actions:</div>
                <div className="space-y-1">
                  {response.suggestedActions.map((action, i) => (
                    <div
                      key={i}
                      className="text-xs text-blue-400 cursor-pointer hover:text-blue-300"
                      onClick={() => {
                        // Could send to chat
                      }}
                    >
                      → {action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence */}
            {response.confidence > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                Confidence: {(response.confidence * 100).toFixed(0)}%
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-slate-500">
          Uses local vision models for object detection. Add Claude API key for advanced understanding.
        </div>
      </div>
    </CollapsiblePanel>
  );
};
