/**
 * Image to 3D Panel
 *
 * Upload a photo of a real object and convert it to a training-ready 3D model:
 * - Drag & drop or click to upload image
 * - Configure object dimensions and physics
 * - Generate 3D model via CSM or Rodin API
 * - Auto-estimate grasp points
 * - Add to scene for robot training
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Camera,
  Upload,
  Box,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Scale,
  Sparkles,
  Download,
  Play,
  Zap,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '../common';
import {
  generateTrainableObject as generateCSMObject,
  validateCSMApiKey,
  type Generated3DObject,
  type ImageTo3DRequest,
} from '../../lib/csmImageTo3D';
import {
  generateTrainableObject as generateRodinObject,
  validateRodinApiKey,
  type RodinImageTo3DRequest,
} from '../../lib/rodinImageTo3D';
import {
  generateTrainableObject as generateFalObject,
  validateFalApiKey,
  type FalImageTo3DRequest,
} from '../../lib/falImageTo3D';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useAppStore } from '../../stores/useAppStore';

type ServiceProvider = 'fal' | 'csm' | 'rodin';

const SERVICE_INFO = {
  fal: {
    name: 'TripoSR',
    badge: '$0.07',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    description: '~10-30s, pay-per-use',
    signupUrl: 'https://fal.ai',
    signupText: 'fal.ai',
  },
  csm: {
    name: 'CSM',
    badge: 'FREE',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    description: '2-5 min, 10 free credits',
    signupUrl: 'https://csm.ai',
    signupText: 'csm.ai',
  },
  rodin: {
    name: 'Rodin',
    badge: '$96/mo',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    description: '~70s generation',
    signupUrl: 'https://hyper3d.ai',
    signupText: 'hyper3d.ai',
  },
} as const;

interface ImageTo3DPanelProps {
  onObjectGenerated?: (object: Generated3DObject) => void;
}

// Size presets for quick mobile selection
const SIZE_PRESETS = [
  { id: 'small', label: 'Small', icon: '🔹', dims: [0.05, 0.05, 0.05] },
  { id: 'medium', label: 'Medium', icon: '🔷', dims: [0.10, 0.10, 0.10] },
  { id: 'large', label: 'Large', icon: '📦', dims: [0.20, 0.20, 0.20] },
  { id: 'custom', label: 'Custom', icon: '✏️', dims: null },
] as const;

export const ImageTo3DPanel: React.FC<ImageTo3DPanelProps> = ({
  onObjectGenerated,
}) => {
  const [expanded, setExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const spawnObject = useAppStore((state) => state.spawnObject);

  // Service provider selection (default to fal.ai - fast and cheap)
  const [service, setService] = useState<ServiceProvider>('fal');
  const serviceInfo = SERVICE_INFO[service];

  // Add object to scene
  const handleAddToScene = useCallback((obj: Generated3DObject) => {
    // Calculate scale - models from fal.ai are typically normalized, so use a reasonable default
    const scale = 0.08; // 8cm - good size for robot manipulation

    spawnObject({
      type: 'glb',
      position: [0.2, 0.1, 0.15], // To the right and in front of robot, elevated to drop naturally
      rotation: [0, 0, 0],
      scale,
      color: '#ffffff',
      isGrabbable: true,
      isGrabbed: false,
      isInTargetZone: false,
      modelUrl: obj.meshUrl,
      name: obj.name,
    });

    onObjectGenerated?.(obj);
  }, [spawnObject, onObjectGenerated]);

  // API key state
  const [apiKey, setApiKey] = useState('');
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Rodin-specific options
  const [rodinTier, setRodinTier] = useState<'Sketch' | 'Regular' | 'Detail'>('Regular');

  // Image state - support multiple images for better 3D generation
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  // For backwards compatibility, primary image is first in array
  const imageFile = imageFiles[0] || null;
  const imagePreview = imagePreviews[0] || null;

  // Object config
  const [objectName, setObjectName] = useState('');
  const [width, setWidth] = useState(0.1);
  const [height, setHeight] = useState(0.15);
  const [depth, setDepth] = useState(0.05);
  const [quality, setQuality] = useState<'base' | 'turbo' | 'highest'>('base');
  const [withTexture, setWithTexture] = useState(true);
  const [sizePreset, setSizePreset] = useState<string>('medium');
  const [showCustomDims, setShowCustomDims] = useState(false);

  // Handle size preset change
  const handleSizePreset = (presetId: string) => {
    setSizePreset(presetId);
    const preset = SIZE_PRESETS.find(p => p.id === presetId);
    if (preset && preset.dims) {
      setWidth(preset.dims[0]);
      setHeight(preset.dims[1]);
      setDepth(preset.dims[2]);
      setShowCustomDims(false);
    } else {
      setShowCustomDims(true);
    }
  };

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ phase: '', percent: 0, message: '' });
  const [generatedObject, setGeneratedObject] = useState<Generated3DObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate API key based on selected service
  const handleValidateKey = useCallback(async () => {
    if (!apiKey || apiKey.length < 10) {
      setApiKeyValid(null);
      return;
    }

    setIsValidating(true);
    let valid = false;
    if (service === 'fal') {
      valid = await validateFalApiKey(apiKey);
    } else if (service === 'rodin') {
      valid = await validateRodinApiKey(apiKey);
    } else {
      valid = await validateCSMApiKey(apiKey);
    }
    setApiKeyValid(valid);
    setIsValidating(false);
  }, [apiKey, service]);

  // Reset API key validation when service changes
  const handleServiceChange = useCallback((newService: ServiceProvider) => {
    setService(newService);
    setApiKeyValid(null);
    setError(null);
  }, []);

  // Handle image selection - supports adding multiple images
  const handleImageSelect = useCallback((file: File, addToExisting = false) => {
    setError(null);
    setGeneratedObject(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (addToExisting && imageFiles.length < 4) {
        // Add to existing images (max 4)
        setImageFiles(prev => [...prev, file]);
        setImagePreviews(prev => [...prev, preview]);
      } else {
        // Replace all images
        setImageFiles([file]);
        setImagePreviews([preview]);
      }
    };
    reader.readAsDataURL(file);

    // Auto-set name from filename (only if not already set)
    if (!objectName) {
      const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      setObjectName(name);
    }
  }, [objectName, imageFiles.length]);

  // Remove a specific image
  const handleRemoveImage = useCallback((index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all images
  const handleClearImages = useCallback(() => {
    setImageFiles([]);
    setImagePreviews([]);
    setGeneratedObject(null);
  }, []);

  // Handle file drop - supports multiple files
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      // First file replaces, subsequent files add
      handleImageSelect(files[0], false);
      files.slice(1, 4).forEach(file => {
        setTimeout(() => handleImageSelect(file, true), 100);
      });
    }
  }, [handleImageSelect]);

  // Handle file input change - supports multiple files
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, addToExisting = false) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (addToExisting) {
        // Add to existing
        Array.from(files).slice(0, 4 - imageFiles.length).forEach(file => {
          handleImageSelect(file, true);
        });
      } else {
        // Replace with first file
        handleImageSelect(files[0], false);
        // Add subsequent files
        Array.from(files).slice(1, 4).forEach(file => {
          setTimeout(() => handleImageSelect(file, true), 100);
        });
      }
    }
    // Reset input
    e.target.value = '';
  }, [handleImageSelect, imageFiles.length]);

  // Generate 3D model using selected service
  const handleGenerate = useCallback(async () => {
    if (!imageFile || !apiKey || !apiKeyValid) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedObject(null);

    try {
      let result: Generated3DObject;

      if (service === 'fal') {
        // Use fal.ai TripoSR API (fastest)
        const falOptions: Partial<FalImageTo3DRequest> = {
          objectName,
          outputFormat: 'glb',
          removeBackground: true,
          scaledBbox: [width, height, depth],
        };

        result = await generateFalObject(
          { apiKey },
          imageFile,
          falOptions,
          (phase, percent, message) => {
            setProgress({ phase, percent, message });
          }
        );
      } else if (service === 'rodin') {
        // Use Rodin API
        const rodinOptions: Partial<RodinImageTo3DRequest> = {
          objectName,
          tier: rodinTier,
          quality: quality === 'highest' ? 'high' : quality === 'turbo' ? 'medium' : 'medium',
          material: withTexture ? 'PBR' : 'Shaded',
          scaledBbox: [width, height, depth],
        };

        result = await generateRodinObject(
          { apiKey },
          imageFile,
          rodinOptions,
          (phase, percent, message) => {
            setProgress({ phase, percent, message });
          }
        );
      } else {
        // Use CSM API
        const csmOptions: Partial<ImageTo3DRequest> = {
          objectName,
          geometryModel: quality,
          textureModel: withTexture ? 'baked' : 'none',
          resolution: quality === 'highest' ? 100000 : quality === 'turbo' ? 50000 : 30000,
          scaledBbox: [width, height, depth],
          symmetry: 'auto',
        };

        result = await generateCSMObject(
          { apiKey },
          imageFile,
          csmOptions,
          (phase, percent, message) => {
            setProgress({ phase, percent, message });
          }
        );
      }

      setGeneratedObject(result);
      onObjectGenerated?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [imageFile, apiKey, apiKeyValid, objectName, quality, withTexture, width, height, depth, service, rodinTier, onObjectGenerated]);

  const canGenerate = imageFile && apiKeyValid && !isGenerating;

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-400" />
          Image to 3D
          <span className={`text-xs px-1.5 py-0.5 rounded border ${serviceInfo.badgeColor}`}>
            {serviceInfo.badge}
          </span>
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse Image to 3D panel' : 'Expand Image to 3D panel'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          {/* Description */}
          <p className="text-xs text-slate-400 mb-3">
            Upload a photo of a real object to generate a training-ready 3D model with physics and grasp points.
          </p>

          {/* Service Selector */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 mb-2 block">
              Service Provider
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleServiceChange('fal')}
                className={`p-2 rounded-lg border text-left transition ${
                  service === 'fal'
                    ? 'border-cyan-500/50 bg-cyan-500/10'
                    : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <Zap className={`w-3.5 h-3.5 ${service === 'fal' ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${service === 'fal' ? 'text-cyan-400' : 'text-slate-300'}`}>
                    TripoSR
                  </span>
                </div>
                <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400 mt-1 inline-block">
                  $0.07
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">~20s</p>
              </button>
              <button
                onClick={() => handleServiceChange('csm')}
                className={`p-2 rounded-lg border text-left transition ${
                  service === 'csm'
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <Box className={`w-3.5 h-3.5 ${service === 'csm' ? 'text-green-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${service === 'csm' ? 'text-green-400' : 'text-slate-300'}`}>
                    CSM
                  </span>
                </div>
                <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 mt-1 inline-block">
                  FREE
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">2-5 min</p>
              </button>
              <button
                onClick={() => handleServiceChange('rodin')}
                className={`p-2 rounded-lg border text-left transition ${
                  service === 'rodin'
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <Sparkles className={`w-3.5 h-3.5 ${service === 'rodin' ? 'text-yellow-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-medium ${service === 'rodin' ? 'text-yellow-400' : 'text-slate-300'}`}>
                    Rodin
                  </span>
                </div>
                <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 mt-1 inline-block">
                  $96/mo
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">~70s</p>
              </button>
            </div>
          </div>

          {/* API Key */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-300 mb-1 block">
              {service === 'fal' ? 'fal.ai' : service === 'rodin' ? 'Rodin' : 'CSM'} API Key
            </label>
            <div className="relative">
              <Key className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onBlur={handleValidateKey}
                placeholder={service === 'fal' ? 'Enter fal.ai API key...' : service === 'rodin' ? 'Enter Rodin API key...' : 'csm_...'}
                className="w-full pl-8 pr-8 py-2 text-sm bg-slate-900/50 border border-slate-700/50
                         rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {isValidating && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                {!isValidating && apiKeyValid === true && <CheckCircle className="w-4 h-4 text-green-400" />}
                {!isValidating && apiKeyValid === false && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Get API key at{' '}
              <a
                href={serviceInfo.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {serviceInfo.signupText}
              </a>
            </p>
          </div>

          {/* Rodin Tier Selection */}
          {service === 'rodin' && (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-300 mb-1 block">
                Generation Speed
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Sketch', 'Regular', 'Detail'] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setRodinTier(tier)}
                    className={`py-1.5 px-2 rounded text-xs font-medium transition ${
                      rodinTier === tier
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {tier}
                    <span className="block text-[10px] opacity-70">
                      {tier === 'Sketch' ? '~20s' : tier === 'Regular' ? '~70s' : '~120s'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Image Upload - Multi-image support */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Object Photos
              </label>
              {imagePreviews.length > 0 && (
                <span className="text-xs text-slate-500">
                  {imagePreviews.length}/4 images
                </span>
              )}
            </div>

            {/* Multi-image preview grid */}
            {imagePreviews.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={`preview-${index}-${imageFiles[index]?.name || 'img'}`} className="relative group">
                      <img
                        src={preview}
                        alt={`View ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-slate-700/50"
                      />
                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(index);
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                                 flex items-center justify-center opacity-0 group-hover:opacity-100
                                 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {/* Primary indicator */}
                      {index === 0 && (
                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-cyan-500/90
                                      rounded text-[10px] text-white font-medium">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add more button (if less than 4 images) */}
                  {imagePreviews.length < 4 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-slate-700/50
                               hover:border-cyan-500/50 bg-slate-900/30 flex flex-col items-center
                               justify-center gap-1 transition-colors"
                    >
                      <Plus className="w-5 h-5 text-slate-500" />
                      <span className="text-[10px] text-slate-500">Add</span>
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleClearImages}
                    className="flex-1 py-1.5 text-xs text-slate-400 hover:text-white
                             bg-slate-800/50 rounded transition-colors"
                  >
                    Clear All
                  </button>
                  {imagePreviews.length < 4 && (
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 py-1.5 text-xs text-cyan-400 hover:text-cyan-300
                               bg-cyan-500/10 rounded transition-colors flex items-center justify-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      Add View
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 text-center">
                  Multiple angles improve 3D quality. Primary image is main reference.
                </p>
              </div>
            ) : (
              /* No images - show upload options */
              <>
                {/* Mobile: Show camera + gallery buttons */}
                {isMobile ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full h-20 flex flex-col items-center justify-center gap-2
                               bg-cyan-600/20 border-2 border-dashed border-cyan-500/50
                               rounded-xl text-cyan-400 active:bg-cyan-600/30 transition touch-manipulation"
                    >
                      <Camera className="w-8 h-8" />
                      <span className="text-sm font-medium">Take Photo</span>
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-14 flex items-center justify-center gap-2
                               bg-slate-800/50 border border-slate-700/50
                               rounded-xl text-slate-300 active:bg-slate-700/50 transition touch-manipulation"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-sm">Choose from Gallery</span>
                    </button>
                  </div>
                ) : (
                  /* Desktop: Drag & drop */
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition
                             border-slate-700/50 hover:border-slate-600/50 bg-slate-900/30"
                  >
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <div className="text-sm text-slate-400">
                      Drop images or click to upload
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Up to 4 images for better quality
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileChange(e, imagePreviews.length > 0)}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileChange(e, imagePreviews.length > 0)}
              className="hidden"
            />
          </div>

          {/* Object Config */}
          {imagePreview && (
            <div className="mb-4 p-3 bg-slate-900/30 rounded-lg space-y-3">
              {/* Object Name */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Object Name</label>
                <input
                  type="text"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  placeholder="screwdriver"
                  className="w-full px-3 py-1.5 text-sm bg-slate-800/50 border border-slate-700/50
                           rounded text-white placeholder-slate-500"
                />
              </div>

              {/* Dimensions - Mobile uses presets, desktop shows inputs */}
              <div>
                <label className="text-xs text-slate-400 mb-2 block flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  Object Size
                </label>

                {/* Size preset buttons */}
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSizePreset(preset.id)}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition touch-manipulation
                        ${sizePreset === preset.id
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                        }`}
                    >
                      <span className="block text-base mb-0.5">{preset.icon}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom dimensions - shown when Custom selected or on desktop */}
                {(showCustomDims || !isMobile) && (
                  <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-3'}`}>
                    <div className={isMobile ? 'flex items-center gap-2' : ''}>
                      <span className={`text-xs text-slate-500 ${isMobile ? 'w-16' : 'block'}`}>
                        Width (m)
                      </span>
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(parseFloat(e.target.value) || 0.1)}
                        step={0.01}
                        min={0.01}
                        max={2}
                        className={`px-2 py-2 text-sm bg-slate-800/50 border border-slate-700/50
                                 rounded text-white ${isMobile ? 'flex-1' : 'w-full'}`}
                      />
                    </div>
                    <div className={isMobile ? 'flex items-center gap-2' : ''}>
                      <span className={`text-xs text-slate-500 ${isMobile ? 'w-16' : 'block'}`}>
                        Height (m)
                      </span>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(parseFloat(e.target.value) || 0.1)}
                        step={0.01}
                        min={0.01}
                        max={2}
                        className={`px-2 py-2 text-sm bg-slate-800/50 border border-slate-700/50
                                 rounded text-white ${isMobile ? 'flex-1' : 'w-full'}`}
                      />
                    </div>
                    <div className={isMobile ? 'flex items-center gap-2' : ''}>
                      <span className={`text-xs text-slate-500 ${isMobile ? 'w-16' : 'block'}`}>
                        Depth (m)
                      </span>
                      <input
                        type="number"
                        value={depth}
                        onChange={(e) => setDepth(parseFloat(e.target.value) || 0.1)}
                        step={0.01}
                        min={0.01}
                        max={2}
                        className={`px-2 py-2 text-sm bg-slate-800/50 border border-slate-700/50
                                 rounded text-white ${isMobile ? 'flex-1' : 'w-full'}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Quality */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Quality</span>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as 'base' | 'turbo' | 'highest')}
                  className="px-2 py-1 text-sm bg-slate-800/50 border border-slate-700/50
                           rounded text-white"
                >
                  <option value="base">Base (fast)</option>
                  <option value="turbo">Turbo</option>
                  <option value="highest">Highest</option>
                </select>
              </div>

              {/* Texture toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Include Texture</span>
                <button
                  onClick={() => setWithTexture(!withTexture)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    withTexture ? 'bg-cyan-600' : 'bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                      withTexture ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">{progress.message}</span>
                <span className="text-xs text-cyan-400">{Math.round(progress.percent)}%</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-2 bg-red-500/10 rounded-lg border border-red-500/30">
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" />
                {error}
              </div>
            </div>
          )}

          {/* Result */}
          {generatedObject && !isGenerating && (
            <div className="mb-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                3D Model Ready!
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  {generatedObject.name}
                </div>
                <div className="flex items-center gap-1">
                  <Crosshair className="w-3 h-3" />
                  {generatedObject.graspPoints.length} grasp points detected
                </div>
                <div>
                  Mass: {generatedObject.physicsConfig.mass.toFixed(2)}kg
                </div>
              </div>

              <div className={`mt-3 ${isMobile ? 'flex flex-col gap-2' : 'flex gap-2'}`}>
                <a
                  href={generatedObject.meshUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={isMobile ? 'w-full' : 'flex-1'}
                >
                  <Button variant="secondary" size="sm" className="w-full h-11">
                    <Download className="w-4 h-4 mr-2" />
                    Download GLB
                  </Button>
                </a>
                <Button
                  variant="primary"
                  size="sm"
                  className={`bg-cyan-600 hover:bg-cyan-500 h-11 ${isMobile ? 'w-full' : 'flex-1'}`}
                  onClick={() => handleAddToScene(generatedObject)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Add to Scene
                </Button>
              </div>
            </div>
          )}

          {/* Generate Button - larger on mobile for touch */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full bg-cyan-600 hover:bg-cyan-500 touch-manipulation ${
              isMobile ? 'h-12 text-base' : ''
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className={`animate-spin ${isMobile ? 'w-5 h-5 mr-2' : 'w-3 h-3 mr-2'}`} />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className={isMobile ? 'w-5 h-5 mr-2' : 'w-3 h-3 mr-2'} />
                Generate 3D Model
              </>
            )}
          </Button>

          {/* Info */}
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <p className="text-xs text-slate-500">
              Powered by{' '}
              <a
                href={serviceInfo.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {service === 'fal' ? 'fal.ai TripoSR' : service === 'rodin' ? 'Hyper3D Rodin' : 'CSM.ai'}
              </a>
              . Photo converts to physics-ready 3D with auto grasp points for robot training.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
