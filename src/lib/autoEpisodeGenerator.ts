/**
 * Auto-Episode Generator
 *
 * Automatically generates synthetic episodes by:
 * 1. Running parameterized task templates with random variations
 * 2. Recording joint states at each frame
 * 3. Applying trajectory augmentation for additional variety
 *
 * This enables one-click generation of large training datasets.
 */

import type { JointState, ActiveRobotType } from '../types';
import type { Episode, Frame, EpisodeMetadata } from './datasetExporter';
import {
  PARAMETERIZED_TEMPLATES,
  resolveTaskTemplate,
  type ParameterizedTaskTemplate,
  type ResolvedTaskTemplate,
} from './taskTemplates';
import {
  augmentDataset,
  type AugmentationConfig,
} from './trajectoryAugmentation';

export interface GenerationConfig {
  // Which task templates to use
  templateIds: string[];
  // How many base episodes per template
  episodesPerTemplate: number;
  // Frame rate for generated episodes
  frameRate: number;
  // Whether to apply augmentation to generated episodes
  enableAugmentation: boolean;
  // Augmentation settings
  augmentationConfig?: Partial<AugmentationConfig>;
  // Whether to randomize task parameters
  randomizeParameters: boolean;
  // Robot type
  robotType: ActiveRobotType;
  // Robot ID
  robotId: string;
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  templateIds: ['pick-place-parameterized'],
  episodesPerTemplate: 10,
  frameRate: 30,
  enableAugmentation: true,
  augmentationConfig: {
    numAugmentations: 5,
    actionNoiseStd: 2.0,
    timeStretchRange: [0.9, 1.1],
    spatialJitter: 1.0,
  },
  randomizeParameters: true,
  robotType: 'arm',
  robotId: 'so-101-sim',
};

export interface GenerationProgress {
  currentTemplate: number;
  totalTemplates: number;
  currentEpisode: number;
  totalEpisodes: number;
  phase: 'generating' | 'augmenting' | 'complete';
  generatedCount: number;
}

export interface GenerationResult {
  episodes: Episode[];
  stats: {
    baseEpisodes: number;
    augmentedEpisodes: number;
    totalEpisodes: number;
    totalFrames: number;
    templatesUsed: string[];
    duration: number; // ms
  };
}

/**
 * Interpolate between two joint states
 */
function interpolateJoints(from: JointState, to: JointState, t: number): JointState {
  return {
    base: from.base + (to.base - from.base) * t,
    shoulder: from.shoulder + (to.shoulder - from.shoulder) * t,
    elbow: from.elbow + (to.elbow - from.elbow) * t,
    wrist: from.wrist + (to.wrist - from.wrist) * t,
    wristRoll: from.wristRoll + (to.wristRoll - from.wristRoll) * t,
    gripper: from.gripper + (to.gripper - from.gripper) * t,
  };
}

/**
 * Smooth interpolation using ease-in-out
 */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Convert JointState to number array
 */
function jointStateToArray(joints: JointState): number[] {
  return [
    joints.base,
    joints.shoulder,
    joints.elbow,
    joints.wrist,
    joints.wristRoll,
    joints.gripper,
  ];
}

/**
 * Generate frames for a resolved task by interpolating between waypoints
 */
function generateFramesForTask(
  resolved: ResolvedTaskTemplate,
  frameRate: number
): Frame[] {
  const frames: Frame[] = [];
  const { waypoints, durations } = resolved;

  let currentTime = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const fromWaypoint = waypoints[i];
    const toWaypoint = waypoints[i + 1];
    const duration = durations[i] || 0.5;
    const frameCount = Math.max(1, Math.round(duration * frameRate));

    for (let f = 0; f < frameCount; f++) {
      const t = f / frameCount;
      const smoothT = easeInOut(t);
      const interpolated = interpolateJoints(fromWaypoint, toWaypoint, smoothT);

      frames.push({
        timestamp: currentTime + t * duration,
        observation: {
          jointPositions: jointStateToArray(interpolated),
        },
        action: {
          jointTargets: jointStateToArray(toWaypoint),
          gripper: toWaypoint.gripper / 100, // Normalize to 0-1
        },
        done: false,
      });
    }

    currentTime += duration;
  }

  // Add final frame
  const lastWaypoint = waypoints[waypoints.length - 1];
  frames.push({
    timestamp: currentTime,
    observation: {
      jointPositions: jointStateToArray(lastWaypoint),
    },
    action: {
      jointTargets: jointStateToArray(lastWaypoint),
      gripper: lastWaypoint.gripper / 100,
    },
    done: true,
  });

  return frames;
}

/**
 * Generate a single episode from a resolved task
 */
function generateEpisode(
  resolved: ResolvedTaskTemplate,
  episodeId: number,
  config: GenerationConfig
): Episode {
  const frames = generateFramesForTask(resolved, config.frameRate);
  const duration = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;

  const metadata: EpisodeMetadata = {
    robotType: config.robotType,
    robotId: config.robotId,
    task: resolved.name,
    success: true,
    duration,
    frameCount: frames.length,
    recordedAt: new Date().toISOString(),
  };

  return {
    episodeId,
    frames,
    metadata,
  };
}

/**
 * Get template by ID
 */
function getTemplateById(id: string): ParameterizedTaskTemplate | undefined {
  return PARAMETERIZED_TEMPLATES.find((t) => t.id === id);
}

/**
 * Generate episodes for all selected templates
 */
export async function generateEpisodes(
  config: GenerationConfig = DEFAULT_GENERATION_CONFIG,
  onProgress?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  const startTime = Date.now();
  const baseEpisodes: Episode[] = [];
  let episodeIdCounter = 0;

  // Filter to valid templates
  const templates = config.templateIds
    .map(getTemplateById)
    .filter((t): t is ParameterizedTaskTemplate => t !== undefined);

  if (templates.length === 0) {
    // Use default template if none found
    const defaultTemplate = PARAMETERIZED_TEMPLATES[0];
    if (defaultTemplate) {
      templates.push(defaultTemplate);
    }
  }

  // Generate base episodes
  for (let ti = 0; ti < templates.length; ti++) {
    const template = templates[ti];

    for (let ei = 0; ei < config.episodesPerTemplate; ei++) {
      // Report progress
      onProgress?.({
        currentTemplate: ti + 1,
        totalTemplates: templates.length,
        currentEpisode: ei + 1,
        totalEpisodes: config.episodesPerTemplate,
        phase: 'generating',
        generatedCount: baseEpisodes.length,
      });

      // Resolve template with optional randomization
      const resolved = resolveTaskTemplate(
        template,
        config.randomizeParameters ? undefined : undefined // Pass undefined to randomize
      );

      // Generate episode
      const episode = generateEpisode(resolved, episodeIdCounter++, config);
      baseEpisodes.push(episode);

      // Small delay to allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  // Apply augmentation if enabled
  let finalEpisodes = baseEpisodes;
  if (config.enableAugmentation && baseEpisodes.length > 0) {
    onProgress?.({
      currentTemplate: templates.length,
      totalTemplates: templates.length,
      currentEpisode: config.episodesPerTemplate,
      totalEpisodes: config.episodesPerTemplate,
      phase: 'augmenting',
      generatedCount: baseEpisodes.length,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    finalEpisodes = augmentDataset(baseEpisodes, config.augmentationConfig);
  }

  // Report completion
  onProgress?.({
    currentTemplate: templates.length,
    totalTemplates: templates.length,
    currentEpisode: config.episodesPerTemplate,
    totalEpisodes: config.episodesPerTemplate,
    phase: 'complete',
    generatedCount: finalEpisodes.length,
  });

  const totalFrames = finalEpisodes.reduce((sum, ep) => sum + ep.frames.length, 0);

  return {
    episodes: finalEpisodes,
    stats: {
      baseEpisodes: baseEpisodes.length,
      augmentedEpisodes: finalEpisodes.length - baseEpisodes.length,
      totalEpisodes: finalEpisodes.length,
      totalFrames,
      templatesUsed: templates.map((t) => t.name),
      duration: Date.now() - startTime,
    },
  };
}

/**
 * Estimate the number of episodes that will be generated
 */
export function estimateEpisodeCount(config: GenerationConfig): {
  baseEpisodes: number;
  augmentedEpisodes: number;
  totalEpisodes: number;
} {
  const templateCount = Math.max(1, config.templateIds.length);
  const baseEpisodes = templateCount * config.episodesPerTemplate;

  if (!config.enableAugmentation) {
    return {
      baseEpisodes,
      augmentedEpisodes: 0,
      totalEpisodes: baseEpisodes,
    };
  }

  const augMultiplier = config.augmentationConfig?.numAugmentations || 5;
  const augmentedEpisodes = baseEpisodes * augMultiplier;

  return {
    baseEpisodes,
    augmentedEpisodes,
    totalEpisodes: baseEpisodes + augmentedEpisodes,
  };
}

/**
 * Get available template options
 */
export function getAvailableTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  category: string;
}> {
  return PARAMETERIZED_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
  }));
}
