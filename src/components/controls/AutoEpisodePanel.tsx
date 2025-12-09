/**
 * Auto-Episode Generator Panel
 *
 * One-click synthetic dataset generation:
 * - Select task templates to use
 * - Configure episode count and augmentation
 * - Generate with progress feedback
 * - Export directly to LeRobot format
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Wand2,
  ChevronDown,
  ChevronUp,
  Square,
  Download,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Button } from '../common';
import {
  generateEpisodes,
  estimateEpisodeCount,
  getAvailableTemplates,
  type GenerationConfig,
  type GenerationProgress,
  type GenerationResult,
} from '../../lib/autoEpisodeGenerator';
import { exportLeRobotDataset } from '../../lib/lerobotExporter';
import { downloadDataset } from '../../lib/datasetExporter';

export const AutoEpisodePanel: React.FC = () => {
  const [expanded, setExpanded] = useState(true);

  // Generation config state
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(['pick-place-parameterized']);
  const [episodesPerTemplate, setEpisodesPerTemplate] = useState(10);
  const [enableAugmentation, setEnableAugmentation] = useState(true);
  const [augmentationMultiplier, setAugmentationMultiplier] = useState(5);
  const [frameRate] = useState(30);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Available templates
  const availableTemplates = useMemo(() => getAvailableTemplates(), []);

  // Build config
  const config: GenerationConfig = useMemo(
    () => ({
      templateIds: selectedTemplates,
      episodesPerTemplate,
      frameRate,
      enableAugmentation,
      augmentationConfig: {
        numAugmentations: augmentationMultiplier,
        actionNoiseStd: 2.0,
        timeStretchRange: [0.9, 1.1],
        spatialJitter: 1.0,
      },
      randomizeParameters: true,
      robotType: 'arm',
      robotId: 'so-101-sim',
    }),
    [selectedTemplates, episodesPerTemplate, frameRate, enableAugmentation, augmentationMultiplier]
  );

  // Estimate episode count
  const estimate = useMemo(() => estimateEpisodeCount(config), [config]);

  // Toggle template selection
  const toggleTemplate = useCallback((templateId: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  }, []);

  // Start generation
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      const generationResult = await generateEpisodes(config, (p) => {
        setProgress(p);
      });
      setResult(generationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [config]);

  // Cancel generation (note: currently no true cancellation, just resets UI)
  const handleCancel = useCallback(() => {
    setIsGenerating(false);
    setProgress(null);
  }, []);

  // Export as LeRobot
  const handleExportLeRobot = useCallback(async () => {
    if (!result) return;

    try {
      await exportLeRobotDataset(
        result.episodes,
        `auto_generated_${Date.now()}`,
        'so-101-sim',
        30
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [result]);

  // Export as JSON
  const handleExportJSON = useCallback(() => {
    if (!result) return;

    downloadDataset(result.episodes, `auto_generated_${Date.now()}`, 'json');
  }, [result]);

  // Progress percentage
  const progressPercent = useMemo(() => {
    if (!progress) return 0;
    if (progress.phase === 'complete') return 100;
    if (progress.phase === 'augmenting') return 90;

    const templateProgress = (progress.currentTemplate - 1) / progress.totalTemplates;
    const episodeProgress = progress.currentEpisode / progress.totalEpisodes;
    return Math.round((templateProgress + episodeProgress / progress.totalTemplates) * 85);
  }, [progress]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-green-400" />
          Auto-Episode Generator
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
            Generate synthetic training episodes automatically from task templates.
          </p>

          {/* Template selection */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">Task Templates</span>
              <span className="text-xs text-slate-500">{selectedTemplates.length} selected</span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {availableTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => toggleTemplate(template.id)}
                  disabled={isGenerating}
                  className={`w-full p-2 text-left rounded-lg transition-colors ${
                    selectedTemplates.includes(template.id)
                      ? 'bg-green-500/20 border border-green-500/50'
                      : 'bg-slate-900/50 border border-slate-700/50 hover:border-slate-600/50'
                  } ${isGenerating ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{template.name}</span>
                    {selectedTemplates.includes(template.id) && (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{template.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick settings */}
          <div className="mb-3 p-3 bg-slate-900/30 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-300">Episode Count</span>
              <span className="text-xs text-slate-400">{episodesPerTemplate} per template</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={episodesPerTemplate}
              onChange={(e) => setEpisodesPerTemplate(parseInt(e.target.value))}
              disabled={isGenerating}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-3
                         [&::-webkit-slider-thumb]:h-3
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-green-500"
            />

            {/* Augmentation toggle */}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Enable Augmentation
              </span>
              <button
                onClick={() => setEnableAugmentation(!enableAugmentation)}
                disabled={isGenerating}
                className={`w-10 h-5 rounded-full transition-colors ${
                  enableAugmentation ? 'bg-green-600' : 'bg-slate-600'
                } ${isGenerating ? 'opacity-50' : ''}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                    enableAugmentation ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {enableAugmentation && (
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Augmentation Multiplier</span>
                  <span className="text-xs text-slate-400">{augmentationMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={augmentationMultiplier}
                  onChange={(e) => setAugmentationMultiplier(parseInt(e.target.value))}
                  disabled={isGenerating}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer
                             [&::-webkit-slider-thumb]:appearance-none
                             [&::-webkit-slider-thumb]:w-3
                             [&::-webkit-slider-thumb]:h-3
                             [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-green-500"
                />
              </div>
            )}
          </div>

          {/* Estimation */}
          <div className="mb-3 p-3 bg-slate-900/50 rounded-lg">
            <div className="text-xs font-medium text-slate-300 mb-2">Output Estimate</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-white">{estimate.baseEpisodes}</div>
                <div className="text-xs text-slate-500">Base</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-400">+{estimate.augmentedEpisodes}</div>
                <div className="text-xs text-slate-500">Augmented</div>
              </div>
              <div>
                <div className="text-lg font-bold text-blue-400">{estimate.totalEpisodes}</div>
                <div className="text-xs text-slate-500">Total</div>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isGenerating && progress && (
            <div className="mb-3 p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">
                  {progress.phase === 'generating' && `Generating (${progress.currentEpisode}/${progress.totalEpisodes})`}
                  {progress.phase === 'augmenting' && 'Applying augmentation...'}
                  {progress.phase === 'complete' && 'Complete!'}
                </span>
                <span className="text-xs text-green-400">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
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

          {/* Result */}
          {result && !isGenerating && (
            <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                Generation Complete!
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>Episodes: {result.stats.totalEpisodes}</div>
                <div>Frames: {result.stats.totalFrames.toLocaleString()}</div>
                <div>Time: {(result.stats.duration / 1000).toFixed(1)}s</div>
              </div>

              {/* Export buttons */}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExportLeRobot}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  LeRobot
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleExportJSON}
                  className="flex-1"
                >
                  <Download className="w-3 h-3 mr-1" />
                  JSON
                </Button>
              </div>
            </div>
          )}

          {/* Generate button */}
          {!isGenerating ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={selectedTemplates.length === 0}
              className="w-full bg-green-600 hover:bg-green-500"
            >
              <Sparkles className="w-3 h-3 mr-2" />
              Generate {estimate.totalEpisodes} Episodes
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              className="w-full"
            >
              <Square className="w-3 h-3 mr-2" />
              Cancel
            </Button>
          )}

          {/* Info */}
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">
              Episodes are generated using parameterized task templates with random variations.
              Enable augmentation to multiply your dataset.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
