/**
 * LeRobotDataset v3.0 Importer
 *
 * Imports LeRobot datasets for playback and visualization in RoboSim.
 * Supports:
 * - ZIP archives with Parquet/JSON data
 * - Individual JSON episode files
 * - HuggingFace dataset URLs (meta only)
 */

import type { Episode, Frame, Observation, Action, EpisodeMetadata, Dataset, DatasetMetadata } from './datasetExporter';
import type { LeRobotDatasetInfo, LeRobotStats } from './lerobotExporter';

// Imported dataset with additional LeRobot metadata
export interface ImportedDataset extends Dataset {
  lerobotInfo?: LeRobotDatasetInfo;
  lerobotStats?: LeRobotStats;
  sourceFormat: 'lerobot' | 'json' | 'robosim';
  videoUrls?: string[]; // Object URLs for video blobs
}

// Progress callback for import operations
export type ImportProgressCallback = (progress: number, message: string) => void;

/**
 * Import a LeRobot dataset from a ZIP file
 */
export async function importLeRobotZip(
  file: File,
  onProgress?: ImportProgressCallback
): Promise<ImportedDataset> {
  onProgress?.(0, 'Loading ZIP file...');

  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(file);

  onProgress?.(20, 'Reading metadata...');

  // Read meta/info.json
  let lerobotInfo: LeRobotDatasetInfo | undefined;
  const infoFile = zip.file('meta/info.json');
  if (infoFile) {
    const infoText = await infoFile.async('text');
    lerobotInfo = JSON.parse(infoText);
  }

  // Read meta/stats.json
  let lerobotStats: LeRobotStats | undefined;
  const statsFile = zip.file('meta/stats.json');
  if (statsFile) {
    const statsText = await statsFile.async('text');
    lerobotStats = JSON.parse(statsText);
  }

  // Read meta/episodes.jsonl
  const episodesMeta: Array<{ episode_index: number; tasks: string; length: number }> = [];
  const episodesFile = zip.file('meta/episodes.jsonl');
  if (episodesFile) {
    const episodesText = await episodesFile.async('text');
    for (const line of episodesText.split('\n').filter(Boolean)) {
      episodesMeta.push(JSON.parse(line));
    }
  }

  onProgress?.(40, 'Loading episode data...');

  // Find and load episode data files
  const episodes: Episode[] = [];
  const dataFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('data/') && (name.endsWith('.json') || name.endsWith('.parquet'))
  );

  // Sort by episode number
  dataFiles.sort((a, b) => {
    const numA = parseInt(a.match(/episode_(\d+)/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/episode_(\d+)/)?.[1] || '0', 10);
    return numA - numB;
  });

  for (let i = 0; i < dataFiles.length; i++) {
    const dataFile = zip.file(dataFiles[i]);
    if (!dataFile) continue;

    const progress = 40 + (i / dataFiles.length) * 40;
    onProgress?.(progress, `Loading episode ${i + 1}/${dataFiles.length}...`);

    const dataText = await dataFile.async('text');
    const columns = JSON.parse(dataText);

    // Convert columnar data to episode frames
    const episode = columnarToEpisode(columns, i, episodesMeta[i], lerobotInfo);
    episodes.push(episode);
  }

  onProgress?.(80, 'Loading videos...');

  // Load video files
  const videoUrls: string[] = [];
  const videoFiles = Object.keys(zip.files).filter(
    (name) => name.startsWith('videos/') && (name.endsWith('.mp4') || name.endsWith('.webm'))
  );

  videoFiles.sort((a, b) => {
    const numA = parseInt(a.match(/episode_(\d+)/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/episode_(\d+)/)?.[1] || '0', 10);
    return numA - numB;
  });

  for (const videoPath of videoFiles) {
    const videoFile = zip.file(videoPath);
    if (videoFile) {
      const blob = await videoFile.async('blob');
      const url = URL.createObjectURL(blob);
      videoUrls.push(url);
    }
  }

  onProgress?.(100, 'Import complete');

  // Build dataset metadata
  const metadata: DatasetMetadata = {
    name: file.name.replace('.zip', ''),
    description: `Imported LeRobot dataset: ${lerobotInfo?.robot_type || 'unknown'}`,
    robotType: mapRobotType(lerobotInfo?.robot_type),
    robotId: lerobotInfo?.robot_id || lerobotInfo?.robot_type || 'unknown',
    episodeCount: episodes.length,
    totalFrames: episodes.reduce((sum, ep) => sum + ep.frames.length, 0),
    createdAt: new Date().toISOString(),
    version: lerobotInfo?.codebase_version || '1.0.0',
  };

  return {
    metadata,
    episodes,
    lerobotInfo,
    lerobotStats,
    sourceFormat: 'lerobot',
    videoUrls: videoUrls.length > 0 ? videoUrls : undefined,
  };
}

/**
 * Import a RoboSim JSON dataset
 */
export async function importRoboSimJson(
  file: File,
  onProgress?: ImportProgressCallback
): Promise<ImportedDataset> {
  onProgress?.(0, 'Reading file...');

  const text = await file.text();
  const data = JSON.parse(text);

  onProgress?.(50, 'Processing...');

  // Check if it's a RoboSim dataset or raw episodes
  if (data.metadata && data.episodes) {
    onProgress?.(100, 'Import complete');
    return {
      ...data,
      sourceFormat: 'robosim',
    };
  }

  // Raw episodes array
  if (Array.isArray(data)) {
    const episodes = data as Episode[];
    const metadata: DatasetMetadata = {
      name: file.name.replace('.json', ''),
      description: 'Imported dataset',
      robotType: episodes[0]?.metadata.robotType || 'arm',
      robotId: episodes[0]?.metadata.robotId || 'unknown',
      episodeCount: episodes.length,
      totalFrames: episodes.reduce((sum, ep) => sum + ep.frames.length, 0),
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    };

    onProgress?.(100, 'Import complete');
    return {
      metadata,
      episodes,
      sourceFormat: 'json',
    };
  }

  throw new Error('Unrecognized dataset format');
}

/**
 * Import dataset from file (auto-detect format)
 */
export async function importDataset(
  file: File,
  onProgress?: ImportProgressCallback
): Promise<ImportedDataset> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.zip')) {
    return importLeRobotZip(file, onProgress);
  } else if (fileName.endsWith('.json')) {
    return importRoboSimJson(file, onProgress);
  }

  throw new Error(`Unsupported file format: ${fileName}. Use .zip (LeRobot) or .json (RoboSim)`);
}

/**
 * Convert columnar LeRobot data to Episode format
 */
function columnarToEpisode(
  columns: Record<string, unknown[]>,
  episodeIndex: number,
  meta?: { tasks: string; length: number },
  info?: LeRobotDatasetInfo
): Episode {
  const stateData = columns['observation.state'] as number[][] || [];
  const actionData = columns['action'] as number[][] || [];
  const timestamps = columns['timestamp'] as number[] || [];
  const doneFlags = columns['next.done'] as boolean[] || [];

  const frames: Frame[] = [];
  const numFrames = stateData.length;

  for (let i = 0; i < numFrames; i++) {
    const observation: Observation = {
      jointPositions: stateData[i] || [],
    };

    const action: Action = {
      jointTargets: actionData[i] || [],
    };

    frames.push({
      timestamp: (timestamps[i] || i / 30) * 1000, // Convert to ms
      observation,
      action,
      done: doneFlags[i] || i === numFrames - 1,
    });
  }

  const episodeMetadata: EpisodeMetadata = {
    robotType: mapRobotType(info?.robot_type),
    robotId: info?.robot_id || info?.robot_type || 'unknown',
    task: meta?.tasks,
    success: true, // Assume success unless marked otherwise
    duration: frames.length > 0 ? frames[frames.length - 1].timestamp : 0,
    frameCount: frames.length,
    recordedAt: new Date().toISOString(),
  };

  return {
    episodeId: episodeIndex,
    frames,
    metadata: episodeMetadata,
  };
}

/**
 * Map LeRobot robot type to RoboSim ActiveRobotType
 */
function mapRobotType(lerobotType?: string): 'arm' | 'wheeled' | 'drone' | 'humanoid' {
  if (!lerobotType) return 'arm';

  const lower = lerobotType.toLowerCase();
  if (lower.includes('so-101') || lower.includes('so101') || lower.includes('koch')) {
    return 'arm';
  }
  if (lower.includes('wheeled') || lower.includes('car') || lower.includes('rover')) {
    return 'wheeled';
  }
  if (lower.includes('drone') || lower.includes('quad') || lower.includes('copter')) {
    return 'drone';
  }
  if (lower.includes('humanoid') || lower.includes('biped')) {
    return 'humanoid';
  }

  return 'arm';
}

/**
 * Cleanup imported dataset (revoke video URLs)
 */
export function cleanupImportedDataset(dataset: ImportedDataset): void {
  if (dataset.videoUrls) {
    for (const url of dataset.videoUrls) {
      URL.revokeObjectURL(url);
    }
  }
}

/**
 * Get episode at specific time during playback
 */
export function getFrameAtTime(episode: Episode, timeMs: number): Frame | null {
  if (episode.frames.length === 0) return null;

  // Find frame closest to requested time
  for (let i = 0; i < episode.frames.length; i++) {
    if (episode.frames[i].timestamp >= timeMs) {
      return episode.frames[i];
    }
  }

  return episode.frames[episode.frames.length - 1];
}

/**
 * Get frame index at specific time
 */
export function getFrameIndexAtTime(episode: Episode, timeMs: number): number {
  if (episode.frames.length === 0) return 0;

  for (let i = 0; i < episode.frames.length; i++) {
    if (episode.frames[i].timestamp >= timeMs) {
      return i;
    }
  }

  return episode.frames.length - 1;
}

/**
 * Interpolate between frames for smooth playback
 */
export function interpolateFrames(
  frame1: Frame,
  frame2: Frame,
  t: number // 0-1 interpolation factor
): Frame {
  const lerp = (a: number, b: number) => a + (b - a) * t;

  const interpolatedPositions = frame1.observation.jointPositions.map((pos, i) =>
    lerp(pos, frame2.observation.jointPositions[i] || pos)
  );

  const interpolatedTargets = frame1.action.jointTargets.map((target, i) =>
    lerp(target, frame2.action.jointTargets[i] || target)
  );

  return {
    timestamp: lerp(frame1.timestamp, frame2.timestamp),
    observation: {
      ...frame1.observation,
      jointPositions: interpolatedPositions,
    },
    action: {
      ...frame1.action,
      jointTargets: interpolatedTargets,
    },
    done: t >= 1 ? frame2.done : frame1.done,
  };
}
