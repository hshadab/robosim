/**
 * Text-to-3D Panel
 *
 * Generate 3D objects from text descriptions.
 */

import React, { useState, useCallback } from 'react';
import { Box, Sparkles, Loader2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../common';
import {
  generateFromText,
  type Generated3DObject,
  type Text3DRequest,
} from '../../lib/textTo3D';

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

interface TextTo3DPanelProps {
  defaultOpen?: boolean;
  onObjectGenerated?: (object: Generated3DObject) => void;
}

const PRESET_OBJECTS = [
  { label: 'Red Apple', description: 'red apple' },
  { label: 'Blue Cube', description: 'blue cube' },
  { label: 'Yellow Ball', description: 'yellow ball' },
  { label: 'Metal Can', description: 'metal cylinder can' },
  { label: 'Wooden Box', description: 'wooden crate box' },
  { label: 'Orange Cone', description: 'orange traffic cone' },
];

const STYLE_OPTIONS: Array<{ value: Text3DRequest['style']; label: string }> = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'low-poly', label: 'Low Poly' },
  { value: 'voxel', label: 'Voxel' },
];

export const TextTo3DPanel: React.FC<TextTo3DPanelProps> = ({
  defaultOpen = false,
  onObjectGenerated,
}) => {
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState<Text3DRequest['style']>('realistic');
  const [scale, setScale] = useState(1.0);
  const [generateTexture, setGenerateTexture] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedObjects, setGeneratedObjects] = useState<Generated3DObject[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (desc: string) => {
    if (!desc.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateFromText({
        description: desc,
        style,
        scale,
        generateTexture,
      });

      setGeneratedObjects((prev) => [...prev, result]);
      onObjectGenerated?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [style, scale, generateTexture, onObjectGenerated]);

  const handleGenerate = () => {
    generate(description);
    setDescription('');
  };

  const handlePreset = (preset: { description: string }) => {
    generate(preset.description);
  };

  const removeObject = (index: number) => {
    setGeneratedObjects((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setGeneratedObjects([]);
  };

  return (
    <CollapsiblePanel
      title="Text to 3D"
      icon={Box}
      defaultOpen={defaultOpen}
    >
      <div className="p-3 space-y-4">
        {/* Description Input */}
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            Describe an object
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g., red apple, blue cube..."
              className="flex-1 px-2 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isGenerating}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !description.trim()}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Preset Objects */}
        <div>
          <div className="text-xs text-slate-400 mb-1">Quick generate</div>
          <div className="grid grid-cols-3 gap-1">
            {PRESET_OBJECTS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                disabled={isGenerating}
                className="text-xs px-2 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded text-slate-300 disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style Options */}
        <div>
          <div className="text-xs text-slate-400 mb-1">Style</div>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setStyle(option.value)}
                className={`text-xs px-2 py-1 rounded transition ${
                  style === option.value
                    ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50'
                    : 'bg-slate-700/50 text-slate-400 border border-transparent hover:bg-slate-600/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scale */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Scale</span>
            <span className="text-slate-500">{scale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* AI Texture Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={generateTexture}
            onChange={(e) => setGenerateTexture(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          <span className="text-sm text-slate-300">Generate AI texture</span>
          <span className="text-xs text-slate-500">(requires Gemini API)</span>
        </label>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded p-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Generated Objects List */}
        {generatedObjects.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-slate-400">
                Generated ({generatedObjects.length})
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {generatedObjects.map((obj, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-slate-800/50 rounded px-2 py-1"
                >
                  <div className="flex items-center gap-2">
                    <Box className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-300 truncate max-w-[140px]">
                      {obj.name}
                    </span>
                    {obj.isGrabbable && (
                      <span className="text-xs text-green-400">(grabbable)</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeObject(i)}
                    className="text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-slate-500">
          Objects are generated using procedural geometry. Enable AI texture for photo-realistic appearances.
        </div>
      </div>
    </CollapsiblePanel>
  );
};
