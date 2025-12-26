/**
 * Visual Configuration Store
 *
 * Manages domain randomization settings for lighting, materials, and camera.
 * Extended with full visual randomization for sim-to-real transfer.
 */

import { create } from 'zustand';
import {
  DEFAULT_DOMAIN_CONFIG,
  DEFAULT_FULL_VISUAL_CONFIG,
  randomizeDomainConfig,
  randomizeVisuals,
  applyLightingPreset,
  type LIGHTING_PRESETS,
  type DomainRandomizationConfig,
  type LightingConfig,
  type MaterialConfig,
  type CameraConfig,
  type FullVisualRandomizationConfig,
  type DistractorObject,
} from '../lib/domainRandomization';

interface VisualState {
  // Current configuration
  config: DomainRandomizationConfig;

  // Full visual randomization (includes distractors, textures, etc.)
  fullRandomization: FullVisualRandomizationConfig | null;

  // Distractor objects (kept separate for easy access)
  distractorObjects: DistractorObject[];

  // Whether to auto-randomize between recordings
  autoRandomize: boolean;

  // Whether visual randomization is enabled for batch generation
  visualRandomizationEnabled: boolean;

  // Actions
  setConfig: (config: DomainRandomizationConfig) => void;
  updateLighting: (updates: Partial<LightingConfig>) => void;
  updateMaterials: (updates: Partial<MaterialConfig>) => void;
  updateCamera: (updates: Partial<CameraConfig>) => void;
  randomize: () => void;
  reset: () => void;
  applyPreset: (preset: keyof typeof LIGHTING_PRESETS) => void;
  setAutoRandomize: (auto: boolean) => void;

  // New actions for full visual randomization
  randomizeVisualsForEpisode: () => FullVisualRandomizationConfig;
  setFullRandomization: (config: FullVisualRandomizationConfig | null) => void;
  setDistractors: (distractors: DistractorObject[]) => void;
  clearDistractors: () => void;
  setVisualRandomizationEnabled: (enabled: boolean) => void;
  resetVisuals: () => void;
}

export const useVisualStore = create<VisualState>((set, get) => ({
  config: DEFAULT_DOMAIN_CONFIG,
  fullRandomization: null,
  distractorObjects: [],
  autoRandomize: false,
  visualRandomizationEnabled: true,

  setConfig: (config) => set({ config }),

  updateLighting: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        lighting: {
          ...state.config.lighting,
          ...updates,
        },
      },
    })),

  updateMaterials: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        materials: {
          ...state.config.materials,
          ...updates,
        },
      },
    })),

  updateCamera: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        camera: {
          ...state.config.camera,
          ...updates,
        },
      },
    })),

  randomize: () =>
    set({ config: randomizeDomainConfig(DEFAULT_DOMAIN_CONFIG) }),

  reset: () => set({ config: DEFAULT_DOMAIN_CONFIG }),

  applyPreset: (preset) =>
    set((state) => ({
      config: applyLightingPreset(state.config, preset),
    })),

  setAutoRandomize: (auto) => set({ autoRandomize: auto }),

  // New full visual randomization actions
  randomizeVisualsForEpisode: () => {
    const visualConfig = randomizeVisuals();
    set({
      fullRandomization: visualConfig,
      distractorObjects: visualConfig.distractors,
      config: visualConfig.domain,
    });
    return visualConfig;
  },

  setFullRandomization: (config) =>
    set({
      fullRandomization: config,
      distractorObjects: config?.distractors || [],
      config: config?.domain || DEFAULT_DOMAIN_CONFIG,
    }),

  setDistractors: (distractors) => set({ distractorObjects: distractors }),

  clearDistractors: () => set({ distractorObjects: [] }),

  setVisualRandomizationEnabled: (enabled) =>
    set({ visualRandomizationEnabled: enabled }),

  resetVisuals: () =>
    set({
      fullRandomization: null,
      distractorObjects: [],
      config: DEFAULT_DOMAIN_CONFIG,
    }),
}));

/**
 * Hook to get just the lighting config (for 3D scene)
 */
export const useLightingConfig = () => {
  return useVisualStore((state) => state.config.lighting);
};

/**
 * Hook to get just the materials config
 */
export const useMaterialsConfig = () => {
  return useVisualStore((state) => state.config.materials);
};

/**
 * Hook to get just the camera config
 */
export const useCameraConfig = () => {
  return useVisualStore((state) => state.config.camera);
};

/**
 * Hook to get full visual randomization config
 */
export const useFullRandomization = () => {
  return useVisualStore((state) => state.fullRandomization);
};

/**
 * Hook to get distractor objects
 */
export const useDistractorObjects = () => {
  return useVisualStore((state) => state.distractorObjects);
};

/**
 * Hook to get visual randomization enabled state
 */
export const useVisualRandomizationEnabled = () => {
  return useVisualStore((state) => state.visualRandomizationEnabled);
};

/**
 * Convenience function to randomize visuals for a single episode
 * Can be called from outside React components
 */
export function randomizeVisualsForEpisode(): FullVisualRandomizationConfig {
  return useVisualStore.getState().randomizeVisualsForEpisode();
}
