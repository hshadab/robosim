/**
 * Trajectory Augmentation for Dataset Diversity
 *
 * Provides tools to augment recorded robot trajectories with:
 * - Gaussian action noise (small perturbations to joint angles)
 * - Time stretching (speed variations)
 * - Spatial jitter (small position offsets to start/end)
 * - Mirroring (flip left/right for symmetric tasks)
 */

import type { Episode, Frame } from './datasetExporter';

export interface AugmentationConfig {
  // Gaussian noise added to joint angles (in degrees)
  actionNoiseStd: number;
  // Time stretch factor range [min, max], 1.0 = original speed
  timeStretchRange: [number, number];
  // Whether to generate mirrored version (base angle flipped)
  mirrorLeftRight: boolean;
  // Small random offset to add to all positions (degrees)
  spatialJitter: number;
  // Number of augmented copies per original episode
  numAugmentations: number;
}

export const DEFAULT_AUGMENTATION_CONFIG: AugmentationConfig = {
  actionNoiseStd: 2.0, // ±2 degrees of noise
  timeStretchRange: [0.9, 1.1], // 90% to 110% speed
  mirrorLeftRight: false,
  spatialJitter: 1.0, // ±1 degree offset
  numAugmentations: 5,
};

/**
 * Generate Gaussian random number using Box-Muller transform
 */
function gaussianRandom(mean = 0, std = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * std + mean;
}

/**
 * Random number in range [min, max]
 */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Add Gaussian noise to joint positions
 */
function addActionNoise(positions: number[], std: number): number[] {
  return positions.map(p => p + gaussianRandom(0, std));
}

/**
 * Add spatial jitter (constant offset) to all positions in a trajectory
 * Note: Currently used implicitly through augmentFrame's spatialOffset parameter
 */
function _addSpatialJitter(positions: number[], jitter: number): number[] {
  const offsets = positions.map(() => gaussianRandom(0, jitter));
  return positions.map((p, i) => p + offsets[i]);
}

// Export for potential future use
export { _addSpatialJitter as addSpatialJitter };

/**
 * Mirror trajectory by flipping the base joint angle
 * Useful for symmetric tasks like pick-and-place
 */
function mirrorFrame(frame: Frame): Frame {
  return {
    ...frame,
    observation: {
      ...frame.observation,
      jointPositions: frame.observation.jointPositions.map((p, i) =>
        i === 0 ? -p : p // Flip base joint (index 0)
      ),
    },
    action: {
      ...frame.action,
      jointTargets: frame.action.jointTargets.map((p, i) =>
        i === 0 ? -p : p
      ),
    },
  };
}

/**
 * Time stretch a trajectory by resampling frames
 */
function timeStretchEpisode(episode: Episode, stretchFactor: number): Episode {
  const originalFrames = episode.frames;
  const originalLength = originalFrames.length;
  const newLength = Math.round(originalLength / stretchFactor);

  if (newLength < 2) {
    return episode; // Can't stretch to less than 2 frames
  }

  const newFrames: Frame[] = [];

  for (let i = 0; i < newLength; i++) {
    // Map new index to original index
    const originalIdx = (i / (newLength - 1)) * (originalLength - 1);
    const lowerIdx = Math.floor(originalIdx);
    const upperIdx = Math.min(lowerIdx + 1, originalLength - 1);
    const t = originalIdx - lowerIdx;

    const lowerFrame = originalFrames[lowerIdx];
    const upperFrame = originalFrames[upperIdx];

    // Interpolate between frames
    const interpolatedPositions = lowerFrame.observation.jointPositions.map((p, j) =>
      p + t * (upperFrame.observation.jointPositions[j] - p)
    );
    const interpolatedTargets = lowerFrame.action.jointTargets.map((p, j) =>
      p + t * (upperFrame.action.jointTargets[j] - p)
    );

    newFrames.push({
      timestamp: (i / (newLength - 1)) * (episode.metadata.duration),
      observation: {
        jointPositions: interpolatedPositions,
        endEffectorPosition: lowerFrame.observation.endEffectorPosition, // Keep from lower frame
        sensors: lowerFrame.observation.sensors,
        image: undefined, // Don't interpolate images
      },
      action: {
        jointTargets: interpolatedTargets,
        gripper: lowerFrame.action.gripper,
      },
      done: i === newLength - 1,
    });
  }

  return {
    ...episode,
    frames: newFrames,
    metadata: {
      ...episode.metadata,
      duration: episode.metadata.duration / stretchFactor,
    },
  };
}

/**
 * Augment a single frame with noise
 */
function augmentFrame(frame: Frame, config: AugmentationConfig, spatialOffset: number[]): Frame {
  const noisyPositions = addActionNoise(
    frame.observation.jointPositions.map((p, i) => p + spatialOffset[i]),
    config.actionNoiseStd
  );
  const noisyTargets = addActionNoise(
    frame.action.jointTargets.map((p, i) => p + spatialOffset[i]),
    config.actionNoiseStd
  );

  return {
    ...frame,
    observation: {
      ...frame.observation,
      jointPositions: noisyPositions,
      image: undefined, // Remove images from augmented data
    },
    action: {
      ...frame.action,
      jointTargets: noisyTargets,
    },
  };
}

/**
 * Augment a single episode
 */
export function augmentEpisode(
  episode: Episode,
  config: Partial<AugmentationConfig> = {}
): Episode {
  const fullConfig = { ...DEFAULT_AUGMENTATION_CONFIG, ...config };

  // Apply time stretching
  const stretchFactor = randomInRange(
    fullConfig.timeStretchRange[0],
    fullConfig.timeStretchRange[1]
  );
  let augmentedEpisode = timeStretchEpisode(episode, stretchFactor);

  // Generate spatial offset (constant for whole trajectory)
  const spatialOffset = episode.frames[0].observation.jointPositions.map(() =>
    gaussianRandom(0, fullConfig.spatialJitter)
  );

  // Apply noise to each frame
  augmentedEpisode = {
    ...augmentedEpisode,
    frames: augmentedEpisode.frames.map(frame =>
      augmentFrame(frame, fullConfig, spatialOffset)
    ),
    metadata: {
      ...augmentedEpisode.metadata,
      task: `${episode.metadata.task || 'task'}_augmented`,
    },
  };

  // Apply mirroring if enabled
  if (fullConfig.mirrorLeftRight && Math.random() > 0.5) {
    augmentedEpisode = {
      ...augmentedEpisode,
      frames: augmentedEpisode.frames.map(mirrorFrame),
      metadata: {
        ...augmentedEpisode.metadata,
        task: `${augmentedEpisode.metadata.task}_mirrored`,
      },
    };
  }

  return augmentedEpisode;
}

/**
 * Generate multiple augmented versions of an episode
 */
export function generateAugmentedEpisodes(
  episode: Episode,
  config: Partial<AugmentationConfig> = {}
): Episode[] {
  const fullConfig = { ...DEFAULT_AUGMENTATION_CONFIG, ...config };
  const augmented: Episode[] = [];

  for (let i = 0; i < fullConfig.numAugmentations; i++) {
    augmented.push(augmentEpisode(episode, config));
  }

  return augmented;
}

/**
 * Augment an entire dataset
 */
export function augmentDataset(
  episodes: Episode[],
  config: Partial<AugmentationConfig> = {}
): Episode[] {
  const fullConfig = { ...DEFAULT_AUGMENTATION_CONFIG, ...config };
  const allEpisodes: Episode[] = [...episodes]; // Include originals

  for (const episode of episodes) {
    const augmented = generateAugmentedEpisodes(episode, fullConfig);
    allEpisodes.push(...augmented);
  }

  return allEpisodes;
}

/**
 * Get statistics about augmentation
 */
export function getAugmentationStats(
  originalCount: number,
  config: Partial<AugmentationConfig> = {}
): {
  originalEpisodes: number;
  augmentedEpisodes: number;
  totalEpisodes: number;
  multiplier: number;
} {
  const fullConfig = { ...DEFAULT_AUGMENTATION_CONFIG, ...config };
  const augmentedCount = originalCount * fullConfig.numAugmentations;
  const totalCount = originalCount + augmentedCount;

  return {
    originalEpisodes: originalCount,
    augmentedEpisodes: augmentedCount,
    totalEpisodes: totalCount,
    multiplier: totalCount / originalCount,
  };
}

/**
 * Preview augmentation on a single episode
 * Returns original and one augmented version for comparison
 */
export function previewAugmentation(
  episode: Episode,
  config: Partial<AugmentationConfig> = {}
): { original: Episode; augmented: Episode } {
  return {
    original: episode,
    augmented: augmentEpisode(episode, config),
  };
}

// ============================================================================
// TIME WARPING
// Non-linear temporal stretching for more diverse motion profiles
// ============================================================================

/**
 * Time warp configuration
 */
export interface TimeWarpConfig {
  enabled: boolean;
  warpType: 'sine' | 'quadratic' | 'random' | 'smooth';
  amplitude: number;      // 0-0.5 (higher = more distortion)
  frequency: number;      // For sine: number of oscillations
  preserveEndpoints: boolean; // Ensure first/last frames unchanged
}

/**
 * Default time warp configuration
 */
export const DEFAULT_TIME_WARP_CONFIG: TimeWarpConfig = {
  enabled: true,
  warpType: 'sine',
  amplitude: 0.2,
  frequency: 2,
  preserveEndpoints: true,
};

/**
 * Generate warped time value
 * Maps t (0-1) to t' (warped 0-1)
 */
function warpTime(t: number, config: TimeWarpConfig): number {
  if (!config.enabled || config.amplitude === 0) {
    return t;
  }

  let warpedT: number;

  switch (config.warpType) {
    case 'sine':
      // Sinusoidal warp: t' = t + amplitude * sin(2π * frequency * t)
      // Creates smooth speed-up/slow-down oscillations
      warpedT = t + config.amplitude * Math.sin(2 * Math.PI * config.frequency * t);
      break;

    case 'quadratic':
      // Quadratic warp: starts slow, speeds up in middle, slows at end
      // t' = t + amplitude * t * (1 - t) * 4 * (0.5 - t)
      warpedT = t + config.amplitude * 4 * t * (1 - t) * (t - 0.5);
      break;

    case 'random':
      // Random walk warp (deterministic based on t for reproducibility)
      const seed = Math.sin(t * 12.9898 + config.frequency * 78.233) * 43758.5453;
      const noise = (seed - Math.floor(seed)) * 2 - 1; // -1 to 1
      warpedT = t + config.amplitude * noise * t * (1 - t);
      break;

    case 'smooth':
      // Smooth cubic ease: emphasizes middle of trajectory
      // Creates a natural "hesitate → commit → settle" motion
      const eased = 3 * t * t - 2 * t * t * t; // smoothstep
      warpedT = t + config.amplitude * (eased - t);
      break;

    default:
      warpedT = t;
  }

  // Ensure endpoints are preserved if configured
  if (config.preserveEndpoints) {
    // Smooth ramp to 0 at start and end
    const blend = t * (1 - t) * 4; // 0 at endpoints, 1 at midpoint
    warpedT = t + blend * (warpedT - t);
  }

  // Clamp to valid range [0, 1]
  return Math.max(0, Math.min(1, warpedT));
}

/**
 * Apply time warping to an episode
 * Non-linear resampling of the trajectory
 */
export function timeWarpEpisode(
  episode: Episode,
  config: Partial<TimeWarpConfig> = {}
): Episode {
  const fullConfig = { ...DEFAULT_TIME_WARP_CONFIG, ...config };

  if (!fullConfig.enabled) {
    return episode;
  }

  const originalFrames = episode.frames;
  const numFrames = originalFrames.length;

  if (numFrames < 3) {
    return episode; // Need at least 3 frames for meaningful warping
  }

  const warpedFrames: Frame[] = [];

  for (let i = 0; i < numFrames; i++) {
    // Normalize current index to [0, 1]
    const t = i / (numFrames - 1);

    // Get warped time
    const warpedT = warpTime(t, fullConfig);

    // Map warped time back to frame index
    const warpedIdx = warpedT * (numFrames - 1);
    const lowerIdx = Math.floor(warpedIdx);
    const upperIdx = Math.min(lowerIdx + 1, numFrames - 1);
    const interpT = warpedIdx - lowerIdx;

    const lowerFrame = originalFrames[lowerIdx];
    const upperFrame = originalFrames[upperIdx];

    // Interpolate between frames
    const interpolatedPositions = lowerFrame.observation.jointPositions.map((p, j) =>
      p + interpT * (upperFrame.observation.jointPositions[j] - p)
    );
    const interpolatedTargets = lowerFrame.action.jointTargets.map((p, j) =>
      p + interpT * (upperFrame.action.jointTargets[j] - p)
    );

    // Interpolate gripper (simple linear)
    const interpolatedGripper = lowerFrame.action.gripper +
      interpT * (upperFrame.action.gripper - lowerFrame.action.gripper);

    warpedFrames.push({
      timestamp: originalFrames[i].timestamp, // Keep original timing
      observation: {
        jointPositions: interpolatedPositions,
        endEffectorPosition: lowerFrame.observation.endEffectorPosition,
        sensors: lowerFrame.observation.sensors,
        image: i === lowerIdx ? lowerFrame.observation.image : undefined, // Keep image only if exact match
      },
      action: {
        jointTargets: interpolatedTargets,
        gripper: interpolatedGripper,
      },
      done: i === numFrames - 1,
    });
  }

  return {
    ...episode,
    frames: warpedFrames,
    metadata: {
      ...episode.metadata,
      // Add time warp info to metadata
      timeWarp: {
        type: fullConfig.warpType,
        amplitude: fullConfig.amplitude,
        frequency: fullConfig.frequency,
      },
    },
  };
}

/**
 * Generate multiple time-warped versions of an episode
 */
export function generateTimeWarpedEpisodes(
  episode: Episode,
  numVersions: number = 3,
  baseConfig: Partial<TimeWarpConfig> = {}
): Episode[] {
  const warped: Episode[] = [];
  const warpTypes: ('sine' | 'quadratic' | 'random' | 'smooth')[] =
    ['sine', 'quadratic', 'smooth'];

  for (let i = 0; i < numVersions; i++) {
    // Vary the parameters for each version
    const config: Partial<TimeWarpConfig> = {
      ...baseConfig,
      enabled: true,
      warpType: warpTypes[i % warpTypes.length],
      amplitude: 0.1 + Math.random() * 0.25, // 0.1 to 0.35
      frequency: 1 + Math.floor(Math.random() * 3), // 1 to 3
    };

    warped.push(timeWarpEpisode(episode, config));
  }

  return warped;
}

/**
 * Combined trajectory augmentation with time warping
 */
export function augmentEpisodeWithTimeWarp(
  episode: Episode,
  augConfig: Partial<AugmentationConfig> = {},
  timeWarpConfig: Partial<TimeWarpConfig> = {}
): Episode {
  // First apply standard augmentation
  let augmented = augmentEpisode(episode, augConfig);

  // Then apply time warping
  augmented = timeWarpEpisode(augmented, timeWarpConfig);

  return augmented;
}

/**
 * Time warp metadata type for episode metadata
 */
export interface TimeWarpMetadata {
  type: 'sine' | 'quadratic' | 'random' | 'smooth';
  amplitude: number;
  frequency: number;
}
