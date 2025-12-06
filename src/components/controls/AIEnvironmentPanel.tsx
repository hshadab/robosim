/**
 * AI Environment Panel
 *
 * UI for generating AI-powered backgrounds, textures, and interactive objects
 * using Google Gemini (Nano Banana) or other image generation APIs.
 */

import React, { useState, useCallback } from 'react';
import {
  Sparkles,
  Box,
  Palette,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Download,
  Check,
  AlertCircle,
  Mountain,
  Grid3X3,
} from 'lucide-react';
import {
  configureAIImageService,
  isAIImageServiceConfigured,
  generateBackground,
  generateTexture,
  createAIObject,
  ENVIRONMENT_PRESETS,
  OBJECT_PRESETS,
  type GeneratedImage,
  type AIGeneratedObject,
  type AIBackgroundRequest,
} from '../../lib/aiImageGeneration';

type TabType = 'background' | 'texture' | 'objects';
type GenerationStatus = 'idle' | 'generating' | 'success' | 'error';

export const AIEnvironmentPanel: React.FC = () => {

  // API configuration
  const [apiKey, setApiKey] = useState(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      configureAIImageService({ apiKey: saved });
      return saved;
    }
    return '';
  });
  const [showSettings, setShowSettings] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('background');

  // Generation state
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Background state
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [backgroundStyle, setBackgroundStyle] = useState<AIBackgroundRequest['style']>('realistic');
  const [backgroundMood, setBackgroundMood] = useState<AIBackgroundRequest['mood']>('bright');
  const [generatedBackground, setGeneratedBackground] = useState<GeneratedImage | null>(null);

  // Texture state
  const [texturePrompt, setTexturePrompt] = useState('');
  const [textureSurface, setTextureSurface] = useState<'floor' | 'wall'>('floor');
  const [generatedTexture, setGeneratedTexture] = useState<GeneratedImage | null>(null);

  // Objects state
  const [objectPrompt, setObjectPrompt] = useState('');
  const [objectType, setObjectType] = useState<'cube' | 'sphere' | 'cylinder'>('cube');
  const [objectStyle, setObjectStyle] = useState<'realistic' | 'cartoon'>('realistic');
  const [generatedObjects, setGeneratedObjects] = useState<AIGeneratedObject[]>([]);

  // Scene integration callbacks (to be connected to 3D scene)
  const [appliedBackground, setAppliedBackground] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_appliedFloorTexture, setAppliedFloorTexture] = useState<string | null>(null);

  // Save API key
  const handleSaveApiKey = useCallback(() => {
    localStorage.setItem('gemini_api_key', apiKey);
    configureAIImageService({ apiKey });
    setShowSettings(false);
  }, [apiKey]);

  // Generate background
  const handleGenerateBackground = useCallback(async () => {
    if (!isAIImageServiceConfigured()) {
      setShowSettings(true);
      return;
    }

    setStatus('generating');
    setErrorMessage('');

    try {
      const result = await generateBackground({
        description: backgroundPrompt || 'clean robotics laboratory',
        style: backgroundStyle,
        mood: backgroundMood,
      });
      setGeneratedBackground(result);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
    }
  }, [backgroundPrompt, backgroundStyle, backgroundMood]);

  // Generate texture
  const handleGenerateTexture = useCallback(async () => {
    if (!isAIImageServiceConfigured()) {
      setShowSettings(true);
      return;
    }

    setStatus('generating');
    setErrorMessage('');

    try {
      const result = await generateTexture({
        surface: textureSurface,
        description: texturePrompt || 'concrete',
        seamless: true,
      });
      setGeneratedTexture(result);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
    }
  }, [texturePrompt, textureSurface]);

  // Generate object
  const handleGenerateObject = useCallback(async () => {
    if (!isAIImageServiceConfigured()) {
      setShowSettings(true);
      return;
    }

    setStatus('generating');
    setErrorMessage('');

    try {
      const obj = await createAIObject(
        objectPrompt || 'Custom Object',
        objectPrompt || 'colorful toy block',
        {
          type: objectType,
          style: objectStyle,
          grabbable: true,
        }
      );
      setGeneratedObjects((prev) => [...prev, obj]);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
    }
  }, [objectPrompt, objectType, objectStyle]);

  // Apply preset
  const handleApplyPreset = useCallback(
    (presetKey: keyof typeof ENVIRONMENT_PRESETS) => {
      const preset = ENVIRONMENT_PRESETS[presetKey];
      setBackgroundPrompt(preset.description);
      setBackgroundStyle(preset.style);
      setBackgroundMood(preset.mood);
    },
    []
  );

  // Remove generated object
  const handleRemoveObject = useCallback((id: string) => {
    setGeneratedObjects((prev) => prev.filter((obj) => obj.id !== id));
  }, []);

  // Apply background to scene (dispatches event for 3D scene to pick up)
  const handleApplyBackground = useCallback(() => {
    if (generatedBackground) {
      setAppliedBackground(generatedBackground.url);
      // Dispatch custom event for scene to pick up
      window.dispatchEvent(
        new CustomEvent('ai-background-applied', {
          detail: { url: generatedBackground.url },
        })
      );
    }
  }, [generatedBackground]);

  // Apply floor texture
  const handleApplyFloorTexture = useCallback(() => {
    if (generatedTexture) {
      setAppliedFloorTexture(generatedTexture.url);
      window.dispatchEvent(
        new CustomEvent('ai-floor-texture-applied', {
          detail: { url: generatedTexture.url },
        })
      );
    }
  }, [generatedTexture]);

  // Spawn object in scene
  const handleSpawnObject = useCallback((obj: AIGeneratedObject) => {
    window.dispatchEvent(
      new CustomEvent('ai-object-spawn', {
        detail: { object: obj },
      })
    );
  }, []);

  const isConfigured = isAIImageServiceConfigured();

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          AI Environment
          <span className="text-xs text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded">
            Gemini
          </span>
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1 transition-colors ${
            showSettings ? 'text-purple-400' : 'text-slate-400 hover:text-white'
          }`}
          title="API Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* API Settings */}
      {showSettings && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg space-y-3">
          <div className="text-xs text-slate-400 mb-2">Gemini API Key</div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
          />
          <button
            onClick={handleSaveApiKey}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded transition-colors"
          >
            Save API Key
          </button>
          <p className="text-xs text-slate-500">
            Get your key from{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      )}

      {/* Status indicator */}
      {!isConfigured && !showSettings && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          API key required. Click settings to configure.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { id: 'background' as TabType, label: 'Background', icon: <Mountain className="w-3 h-3" /> },
          { id: 'texture' as TabType, label: 'Textures', icon: <Grid3X3 className="w-3 h-3" /> },
          { id: 'objects' as TabType, label: 'Objects', icon: <Box className="w-3 h-3" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Background Tab */}
      {activeTab === 'background' && (
        <div className="space-y-3">
          {/* Presets */}
          <div>
            <div className="text-xs text-slate-400 mb-2">Quick Presets</div>
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(ENVIRONMENT_PRESETS).slice(0, 6).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleApplyPreset(key as keyof typeof ENVIRONMENT_PRESETS)}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded truncate"
                  title={preset.description}
                >
                  {key.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Custom prompt */}
          <div>
            <div className="text-xs text-slate-400 mb-1">Description</div>
            <textarea
              value={backgroundPrompt}
              onChange={(e) => setBackgroundPrompt(e.target.value)}
              placeholder="industrial warehouse with high ceilings..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm resize-none"
            />
          </div>

          {/* Style options */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-400 mb-1">Style</div>
              <select
                value={backgroundStyle}
                onChange={(e) => setBackgroundStyle(e.target.value as AIBackgroundRequest['style'])}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              >
                <option value="realistic">Realistic</option>
                <option value="cartoon">Cartoon</option>
                <option value="abstract">Abstract</option>
                <option value="minimalist">Minimalist</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Mood</div>
              <select
                value={backgroundMood}
                onChange={(e) => setBackgroundMood(e.target.value as AIBackgroundRequest['mood'])}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              >
                <option value="bright">Bright</option>
                <option value="dark">Dark</option>
                <option value="warm">Warm</option>
                <option value="cool">Cool</option>
              </select>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerateBackground}
            disabled={status === 'generating' || !isConfigured}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            {status === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Background
              </>
            )}
          </button>

          {/* Preview */}
          {generatedBackground && (
            <div className="space-y-2">
              <div className="relative aspect-video bg-slate-900 rounded overflow-hidden">
                <img
                  src={generatedBackground.url}
                  alt="Generated background"
                  className="w-full h-full object-cover"
                />
                {appliedBackground === generatedBackground.url && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Applied
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyBackground}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Apply to Scene
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = generatedBackground.url;
                    link.download = 'ai-background.png';
                    link.click();
                  }}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded transition-colors"
                  title="Download"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Texture Tab */}
      {activeTab === 'texture' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-400 mb-1">Surface</div>
              <select
                value={textureSurface}
                onChange={(e) => setTextureSurface(e.target.value as 'floor' | 'wall')}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Material</div>
              <input
                type="text"
                value={texturePrompt}
                onChange={(e) => setTexturePrompt(e.target.value)}
                placeholder="concrete, wood..."
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateTexture}
            disabled={status === 'generating' || !isConfigured}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            {status === 'generating' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Palette className="w-4 h-4" />
            )}
            Generate Texture
          </button>

          {generatedTexture && (
            <div className="space-y-2">
              <div className="relative aspect-square bg-slate-900 rounded overflow-hidden max-w-[150px] mx-auto">
                <img
                  src={generatedTexture.url}
                  alt="Generated texture"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={handleApplyFloorTexture}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors"
              >
                <Check className="w-3 h-3" />
                Apply to {textureSurface}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Objects Tab */}
      {activeTab === 'objects' && (
        <div className="space-y-3">
          {/* Quick object presets */}
          <div>
            <div className="text-xs text-slate-400 mb-2">Quick Add</div>
            <div className="grid grid-cols-2 gap-1">
              {OBJECT_PRESETS.food_items.slice(0, 4).map((item) => (
                <button
                  key={item}
                  onClick={() => setObjectPrompt(item)}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded truncate"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Custom object */}
          <div>
            <div className="text-xs text-slate-400 mb-1">Object Description</div>
            <input
              type="text"
              value={objectPrompt}
              onChange={(e) => setObjectPrompt(e.target.value)}
              placeholder="red apple, cardboard box..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-slate-400 mb-1">Shape</div>
              <select
                value={objectType}
                onChange={(e) => setObjectType(e.target.value as 'cube' | 'sphere' | 'cylinder')}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              >
                <option value="cube">Cube/Box</option>
                <option value="sphere">Sphere/Ball</option>
                <option value="cylinder">Cylinder</option>
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1">Style</div>
              <select
                value={objectStyle}
                onChange={(e) => setObjectStyle(e.target.value as 'realistic' | 'cartoon')}
                className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
              >
                <option value="realistic">Realistic</option>
                <option value="cartoon">Cartoon</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateObject}
            disabled={status === 'generating' || !isConfigured}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            {status === 'generating' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Generate Object
          </button>

          {/* Generated objects list */}
          {generatedObjects.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Generated Objects</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {generatedObjects.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-center gap-2 p-2 bg-slate-900/50 rounded"
                  >
                    <img
                      src={obj.texture.url}
                      alt={obj.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <span className="flex-1 text-xs text-white truncate">{obj.name}</span>
                    <button
                      onClick={() => handleSpawnObject(obj)}
                      className="p-1 text-green-400 hover:bg-green-500/20 rounded"
                      title="Spawn in scene"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleRemoveObject(obj.id)}
                      className="p-1 text-red-400 hover:bg-red-500/20 rounded"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {status === 'error' && errorMessage && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
