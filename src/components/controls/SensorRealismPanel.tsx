/**
 * Sensor Realism Panel
 *
 * Configure sensor noise models for sim-to-real transfer.
 * Allows adjusting noise levels to match real hardware characteristics.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Radio, Info, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  getNoiseSettings,
  setNoiseSettings,
  type NoiseSettings,
  NOISE_PROFILES,
} from '../../lib/sensorNoise';

const REALISM_OPTIONS: Array<{
  value: NoiseSettings['realism'];
  label: string;
  description: string;
}> = [
  {
    value: 'none',
    label: 'None',
    description: 'Perfect sensors, no noise (ideal for learning)',
  },
  {
    value: 'low',
    label: 'Low',
    description: 'Minimal noise (good for initial testing)',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Realistic noise (matches typical hardware)',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Challenging noise (stress testing)',
  },
  {
    value: 'extreme',
    label: 'Extreme',
    description: 'Very noisy (worst-case scenarios)',
  },
];

export const SensorRealismPanel: React.FC = () => {
  const [settings, setSettings] = useState<NoiseSettings>(getNoiseSettings);
  const [showDetails, setShowDetails] = useState(false);

  // Sync settings when changed
  useEffect(() => {
    setNoiseSettings(settings);
  }, [settings]);

  const handleEnableToggle = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const handleRealismChange = useCallback((realism: NoiseSettings['realism']) => {
    setSettings(prev => ({ ...prev, realism }));
  }, []);

  const getNoiseColor = (realism: NoiseSettings['realism']) => {
    switch (realism) {
      case 'none': return 'text-slate-400';
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'extreme': return 'text-red-400';
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Radio className="w-4 h-4 text-yellow-400" />
          Sensor Realism
        </h3>
        <button
          onClick={handleEnableToggle}
          className={`p-1 transition-colors ${settings.enabled ? 'text-green-400' : 'text-slate-500'}`}
          title={settings.enabled ? 'Noise enabled' : 'Noise disabled'}
        >
          {settings.enabled ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Realism Level Selector */}
      <div className="space-y-2 mb-3">
        <div className="text-xs text-slate-400 mb-2">Noise Level:</div>
        <div className="grid grid-cols-5 gap-1">
          {REALISM_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => handleRealismChange(option.value)}
              disabled={!settings.enabled}
              className={`px-2 py-1.5 text-xs rounded transition-colors ${
                settings.realism === option.value
                  ? `${getNoiseColor(option.value)} bg-slate-700`
                  : settings.enabled
                  ? 'text-slate-500 hover:bg-slate-700/50 hover:text-slate-300'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current status */}
      <div className={`text-xs p-2 rounded-lg ${
        settings.enabled
          ? `bg-slate-900/50 ${getNoiseColor(settings.realism)}`
          : 'bg-slate-900/30 text-slate-500'
      }`}>
        {settings.enabled ? (
          <>
            <span className="font-medium">{REALISM_OPTIONS.find(o => o.value === settings.realism)?.label}</span>
            {' - '}
            {REALISM_OPTIONS.find(o => o.value === settings.realism)?.description}
          </>
        ) : (
          'Sensor noise disabled - perfect readings'
        )}
      </div>

      {/* Details toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="mt-3 text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
      >
        <Info className="w-3 h-3" />
        {showDetails ? 'Hide details' : 'Show sensor details'}
      </button>

      {/* Sensor noise details */}
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
          <div className="text-xs text-slate-400 mb-2">Noise profiles per sensor:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(NOISE_PROFILES).slice(0, 8).map(([sensor, profile]) => (
              <div key={sensor} className="flex items-center justify-between bg-slate-900/30 px-2 py-1 rounded">
                <span className="text-slate-400 capitalize">{sensor}</span>
                <span className="text-slate-500">
                  ±{((profile.gaussianStdDev || 0) * (settings.enabled ? getMultiplier(settings.realism) : 0)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Includes: Gaussian noise, bias, quantization, dropouts, spikes, and lag
          </div>
        </div>
      )}
    </div>
  );
};

function getMultiplier(realism: NoiseSettings['realism']): number {
  switch (realism) {
    case 'none': return 0;
    case 'low': return 0.25;
    case 'medium': return 0.5;
    case 'high': return 1.0;
    case 'extreme': return 2.0;
  }
}
