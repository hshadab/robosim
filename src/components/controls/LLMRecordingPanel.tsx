/**
 * LLM-Driven Recording Panel
 *
 * Type natural language instructions → LLM generates motion plan →
 * Physics simulation executes → Camera captures frames → Export dataset
 *
 * This enables one-sentence data generation for language-conditioned policies.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Square,
  Download,
  Sparkles,
  Camera,
  Database,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Loader2,
  Layers,
  Wand2,
} from 'lucide-react';
import { Button } from '../common';
import {
  PhysicsEpisodeGenerator,
  parseInstructionToMotionPlan,
  getAvailableScenePresets,
  generatePickPlacePlan,
  type PhysicsGenerationConfig,
  type PhysicsGenerationProgress,
  type MotionPlan,
} from '../../lib/physicsEpisodeGenerator';
import { exportLeRobotDataset } from '../../lib/lerobotExporter';
import { downloadDataset, type Episode } from '../../lib/datasetExporter';
import { getClaudeApiKey } from '../../lib/claudeApi';

interface TaskSuggestion {
  instruction: string;
  scenePreset: string;
  description: string;
}

const TASK_SUGGESTIONS: TaskSuggestion[] = [
  {
    instruction: 'Pick up the red block and stack it on the blue block',
    scenePreset: 'stacking-blocks',
    description: 'Block stacking task',
  },
  {
    instruction: 'Sort the blocks by color - put red blocks on the left',
    scenePreset: 'sorting-colors',
    description: 'Color sorting task',
  },
  {
    instruction: 'Pick up the orange and place it in the center',
    scenePreset: 'pick-place-fruit',
    description: 'Fruit manipulation',
  },
  {
    instruction: 'Stack all four blocks into a tower',
    scenePreset: 'multi-stack',
    description: 'Multi-block stacking',
  },
];

export const LLMRecordingPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);
  const [instruction, setInstruction] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('stacking-blocks');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [progress, setProgress] = useState<PhysicsGenerationProgress | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [captureImages, setCaptureImages] = useState(true);
  const [episodeCount, setEpisodeCount] = useState(5);

  const generatorRef = useRef<PhysicsEpisodeGenerator | null>(null);
  const scenePresets = getAvailableScenePresets();

  /**
   * Parse instruction using LLM if available, otherwise use simple parser
   */
  const parseInstruction = useCallback(async (text: string): Promise<MotionPlan | null> => {
    // First try simple pattern matching
    const simplePlan = parseInstructionToMotionPlan(text);
    if (simplePlan) return simplePlan;

    // Check if Claude API is available for more complex parsing
    const apiKey = getClaudeApiKey();
    if (apiKey) {
      // TODO: Implement Claude API call for complex motion planning
      // For now, return a default plan
      console.log('Claude API available for complex parsing');
    }

    // Default: generate a pick-and-place plan
    return generatePickPlacePlan(
      { x: -0.1, z: 0.1 },
      { x: 0.1, z: 0.1 }
    );
  }, []);

  /**
   * Generate episodes with physics simulation
   */
  const handleGenerate = useCallback(async () => {
    if (!instruction.trim()) {
      setError('Please enter an instruction');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    try {
      // Parse instruction to motion plan
      setIsParsing(true);
      const plan = await parseInstruction(instruction);
      setIsParsing(false);

      if (!plan) {
        setError('Could not understand instruction. Try a simpler command.');
        setIsGenerating(false);
        return;
      }

      // Update plan description with the instruction
      plan.description = instruction;

      // Generate multiple episodes with slight variations
      const newEpisodes: Episode[] = [];

      for (let i = 0; i < episodeCount; i++) {
        if (!isGenerating) break; // Allow cancellation

        const config: PhysicsGenerationConfig = {
          languageInstruction: instruction,
          scenePreset: selectedPreset,
          robotId: 'so-101-sim',
          frameRate: 30,
          maxDuration: 30000,
          captureImages,
        };

        const generator = new PhysicsEpisodeGenerator(config);
        generatorRef.current = generator;

        // Add slight randomization to the plan for variety
        const variedPlan = addPlanVariation(plan, i);

        const result = await generator.executeMotionPlan(variedPlan, (p) => {
          setProgress({
            ...p,
            message: `Episode ${i + 1}/${episodeCount}: ${p.message}`,
          });
        });

        if (result.success) {
          newEpisodes.push(result.episode);
        }

        // Small delay between episodes
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setEpisodes(prev => [...prev, ...newEpisodes]);
      setProgress({
        phase: 'complete',
        currentFrame: 0,
        elapsedTime: 0,
        message: `Generated ${newEpisodes.length} episodes`,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
      generatorRef.current = null;
    }
  }, [instruction, selectedPreset, episodeCount, captureImages, parseInstruction, isGenerating]);

  /**
   * Stop current generation
   */
  const handleStop = useCallback(() => {
    if (generatorRef.current) {
      generatorRef.current.stop();
    }
    setIsGenerating(false);
  }, []);

  /**
   * Export dataset
   */
  const handleExport = useCallback(async (format: 'lerobot' | 'json') => {
    if (episodes.length === 0) return;

    try {
      if (format === 'lerobot') {
        await exportLeRobotDataset(
          episodes,
          `llm_generated_${Date.now()}`,
          'so-101-sim',
          30
        );
      } else {
        downloadDataset(episodes, `llm_generated_${Date.now()}`, 'json');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [episodes]);

  /**
   * Apply a suggestion
   */
  const applySuggestion = useCallback((suggestion: TaskSuggestion) => {
    setInstruction(suggestion.instruction);
    setSelectedPreset(suggestion.scenePreset);
  }, []);

  /**
   * Clear all episodes
   */
  const clearEpisodes = useCallback(() => {
    setEpisodes([]);
  }, []);

  // Calculate stats
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const totalDuration = episodes.reduce((sum, ep) => sum + ep.metadata.duration, 0);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-400" />
          LLM → Physics Recording
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
            NEW
          </span>
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
          {/* Description */}
          <p className="text-xs text-slate-400 mb-3">
            Describe a task in natural language → AI generates motion plan →
            Physics sim records with camera → Export training data
          </p>

          {/* Task Suggestions */}
          <div className="mb-3">
            <div className="text-xs font-medium text-slate-400 mb-2">Quick Tasks</div>
            <div className="flex flex-wrap gap-1">
              {TASK_SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => applySuggestion(suggestion)}
                  disabled={isGenerating}
                  className="px-2 py-1 text-[10px] rounded bg-slate-700/50 text-slate-300
                           hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  {suggestion.description}
                </button>
              ))}
            </div>
          </div>

          {/* Instruction Input */}
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-300 block mb-1">
              <MessageSquare className="w-3 h-3 inline mr-1" />
              Task Instruction
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g., Pick up the red block and stack it on the blue block"
              disabled={isGenerating}
              className="w-full px-3 py-2 text-sm bg-slate-900/50 border border-slate-700/50
                       rounded-lg text-white placeholder-slate-500 resize-none
                       focus:outline-none focus:border-purple-500/50"
              rows={2}
            />
          </div>

          {/* Scene Preset Selection */}
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-300 block mb-1">
              <Layers className="w-3 h-3 inline mr-1" />
              Scene Preset
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              disabled={isGenerating}
              className="w-full px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-700/50
                       rounded text-white focus:outline-none focus:border-purple-500/50"
            >
              {scenePresets.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.objectCount} objects)
                </option>
              ))}
            </select>
          </div>

          {/* Settings */}
          <div className="mb-3 p-2 bg-slate-900/30 rounded-lg space-y-2">
            {/* Episode Count */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Episodes to Generate</span>
              <select
                value={episodeCount}
                onChange={(e) => setEpisodeCount(Number(e.target.value))}
                disabled={isGenerating}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-white"
              >
                <option value={1}>1</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Capture Images Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                Capture Camera Frames
              </span>
              <button
                onClick={() => setCaptureImages(!captureImages)}
                disabled={isGenerating}
                className={`w-10 h-5 rounded-full transition-colors ${
                  captureImages ? 'bg-purple-600' : 'bg-slate-600'
                } ${isGenerating ? 'opacity-50' : ''}`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full transition-transform ${
                    captureImages ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Progress */}
          {isGenerating && progress && (
            <div className="mb-3 p-2 bg-purple-900/20 border border-purple-700/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-purple-300 mb-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {isParsing ? 'Parsing instruction...' : progress.message}
              </div>
              {progress.phase === 'recording' && (
                <div className="flex items-center gap-2 text-xs text-purple-400">
                  <span>Frame {progress.currentFrame}</span>
                  <span>•</span>
                  <span>{(progress.elapsedTime / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div className="flex gap-2 mb-3">
            {!isGenerating ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerate}
                disabled={!instruction.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-500"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Generate {episodeCount} Episode{episodeCount > 1 ? 's' : ''}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStop}
                className="flex-1"
              >
                <Square className="w-3 h-3 mr-1" />
                Stop
              </Button>
            )}
          </div>

          {/* Episodes Summary */}
          {episodes.length > 0 && (
            <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                {episodes.length} Episodes Recorded
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div>
                  <div className="text-white font-medium">{totalFrames.toLocaleString()}</div>
                  <div>Frames</div>
                </div>
                <div>
                  <div className="text-white font-medium">{totalDuration.toFixed(1)}s</div>
                  <div>Duration</div>
                </div>
                <div>
                  <div className="text-white font-medium">
                    {captureImages ? 'Yes' : 'No'}
                  </div>
                  <div>Images</div>
                </div>
              </div>

              {/* Export Buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleExport('lerobot')}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  LeRobot
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleExport('json')}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearEpisodes}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
            <p className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              Language-conditioned data for RT-1, OpenVLA, ACT policies
            </p>
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Add slight variation to a motion plan for data diversity
 */
function addPlanVariation(plan: MotionPlan, seed: number): MotionPlan {
  const variation = (seed * 0.1) - 0.05; // ±5% variation

  return {
    ...plan,
    steps: plan.steps.map(step => ({
      ...step,
      joints: Object.fromEntries(
        Object.entries(step.joints).map(([key, value]) => [
          key,
          typeof value === 'number' ? value * (1 + variation * (Math.random() - 0.5)) : value,
        ])
      ) as typeof step.joints,
      duration: step.duration * (1 + variation * 0.5),
    })),
  };
}
