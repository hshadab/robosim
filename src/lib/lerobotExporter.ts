/**
 * LeRobotDataset v3.0 Exporter
 *
 * Exports RoboSim recordings to HuggingFace LeRobot format:
 * - Parquet files for tabular data (states, actions, timestamps)
 * - MP4 videos for camera observations
 * - JSON metadata files
 *
 * Format spec: https://huggingface.co/docs/lerobot/en/lerobot-dataset-v3
 */

import type { Episode } from './datasetExporter';

// LeRobot dataset structure
export interface LeRobotDatasetInfo {
  codebase_version: string;
  robot_type: string;
  fps: number;
  features: Record<string, FeatureInfo>;
  splits: {
    train: string;
  };
  total_episodes: number;
  total_frames: number;
  total_tasks: number;
  total_videos: number;
  total_chunks: number;
  chunks_size: number;
  data_path: string;
  video_path: string;
  // RoboSim specific
  robosim_version: string;
  robot_id: string;
}

interface FeatureInfo {
  dtype: string;
  shape: number[];
  names?: string[] | null;
}

export interface LeRobotStats {
  [key: string]: {
    min: number[];
    max: number[];
    mean: number[];
    std: number[];
  };
}

interface LeRobotEpisodeMeta {
  episode_index: number;
  tasks: string;
  length: number;
}

// SO-101 joint mapping to LeRobot names
const SO101_JOINT_NAMES = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
];

// Feature definitions for different robots
const ROBOT_FEATURES: Record<string, Record<string, FeatureInfo>> = {
  'so-101': {
    'observation.state': {
      dtype: 'float32',
      shape: [6],
      names: SO101_JOINT_NAMES,
    },
    'action': {
      dtype: 'float32',
      shape: [6],
      names: SO101_JOINT_NAMES,
    },
    'episode_index': {
      dtype: 'int64',
      shape: [1],
      names: null,
    },
    'frame_index': {
      dtype: 'int64',
      shape: [1],
      names: null,
    },
    'timestamp': {
      dtype: 'float32',
      shape: [1],
      names: null,
    },
    'next.done': {
      dtype: 'bool',
      shape: [1],
      names: null,
    },
    'task_index': {
      dtype: 'int64',
      shape: [1],
      names: null,
    },
  },
};

// Default features for unknown robots
const DEFAULT_FEATURES: Record<string, FeatureInfo> = {
  'observation.state': {
    dtype: 'float32',
    shape: [6],
    names: null,
  },
  'action': {
    dtype: 'float32',
    shape: [6],
    names: null,
  },
  'episode_index': {
    dtype: 'int64',
    shape: [1],
    names: null,
  },
  'frame_index': {
    dtype: 'int64',
    shape: [1],
    names: null,
  },
  'timestamp': {
    dtype: 'float32',
    shape: [1],
    names: null,
  },
  'next.done': {
    dtype: 'bool',
    shape: [1],
    names: null,
  },
  'task_index': {
    dtype: 'int64',
    shape: [1],
    names: null,
  },
};

/**
 * Convert RoboSim episodes to LeRobot tabular format
 */
function episodesToTabular(episodes: Episode[], _fps: number): {
  rows: LeRobotRow[];
  stats: LeRobotStats;
} {
  const rows: LeRobotRow[] = [];

  // Track min/max/sum for stats
  const stateStats = { min: [] as number[], max: [] as number[], sum: [] as number[], count: 0 };
  const actionStats = { min: [] as number[], max: [] as number[], sum: [] as number[], count: 0 };

  for (let episodeIdx = 0; episodeIdx < episodes.length; episodeIdx++) {
    const episode = episodes[episodeIdx];
    const taskIndex = 0; // Single task for now

    for (let frameIdx = 0; frameIdx < episode.frames.length; frameIdx++) {
      const frame = episode.frames[frameIdx];
      const timestamp = frame.timestamp / 1000; // Convert ms to seconds

      // Get observation state (pad to 6 values for SO-101)
      const state = padArray(frame.observation.jointPositions, 6);
      const action = padArray(frame.action.jointTargets, 6);

      // Update stats
      updateStats(stateStats, state);
      updateStats(actionStats, action);

      rows.push({
        'observation.state': state,
        'action': action,
        'episode_index': episodeIdx,
        'frame_index': frameIdx,
        'timestamp': timestamp,
        'next.done': frame.done,
        'task_index': taskIndex,
      });
    }
  }

  // Calculate final stats
  const stats: LeRobotStats = {
    'observation.state': finalizeStats(stateStats),
    'action': finalizeStats(actionStats),
  };

  return { rows, stats };
}

interface LeRobotRow {
  'observation.state': number[];
  'action': number[];
  'episode_index': number;
  'frame_index': number;
  'timestamp': number;
  'next.done': boolean;
  'task_index': number;
}

function padArray(arr: number[], length: number): number[] {
  const result = [...arr];
  while (result.length < length) {
    result.push(0);
  }
  return result.slice(0, length);
}

function updateStats(stats: { min: number[]; max: number[]; sum: number[]; count: number }, values: number[]) {
  if (stats.count === 0) {
    stats.min = [...values];
    stats.max = [...values];
    stats.sum = [...values];
  } else {
    for (let i = 0; i < values.length; i++) {
      stats.min[i] = Math.min(stats.min[i], values[i]);
      stats.max[i] = Math.max(stats.max[i], values[i]);
      stats.sum[i] += values[i];
    }
  }
  stats.count++;
}

function finalizeStats(stats: { min: number[]; max: number[]; sum: number[]; count: number }) {
  const mean = stats.sum.map(s => s / stats.count);
  // Simplified std calculation (would need second pass for accurate std)
  const std = stats.min.map((min, i) => (stats.max[i] - min) / 4);

  return {
    min: stats.min,
    max: stats.max,
    mean,
    std,
  };
}

/**
 * Generate info.json for LeRobot dataset
 */
export function generateInfoJson(
  episodes: Episode[],
  robotId: string,
  fps: number = 30,
  hasVideo: boolean = false
): LeRobotDatasetInfo {
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const features = ROBOT_FEATURES[robotId] || DEFAULT_FEATURES;

  // Add video feature if we have video
  if (hasVideo) {
    features['observation.images.cam_high'] = {
      dtype: 'video',
      shape: [480, 640, 3],
      names: ['height', 'width', 'channels'],
    };
  }

  return {
    codebase_version: '0.4.2',
    robot_type: robotId,
    fps,
    features,
    splits: {
      train: `0:${episodes.length}`,
    },
    total_episodes: episodes.length,
    total_frames: totalFrames,
    total_tasks: 1,
    total_videos: hasVideo ? episodes.length : 0,
    total_chunks: 1,
    chunks_size: 1000,
    data_path: 'data/chunk-{chunk:03d}/episode_{episode:06d}.parquet',
    video_path: hasVideo ? 'videos/observation.images.cam_high/episode_{episode:06d}.mp4' : '',
    robosim_version: '1.0.0',
    robot_id: robotId,
  };
}

/**
 * Generate stats.json for LeRobot dataset
 */
export function generateStatsJson(episodes: Episode[], fps: number): LeRobotStats {
  const { stats } = episodesToTabular(episodes, fps);
  return stats;
}

/**
 * Generate tasks.jsonl content
 */
export function generateTasksJsonl(episodes: Episode[]): string {
  // Collect unique tasks
  const tasks = new Set<string>();
  for (const episode of episodes) {
    tasks.add(episode.metadata.task || 'default_task');
  }

  const lines: string[] = [];
  let taskIndex = 0;
  for (const task of tasks) {
    lines.push(JSON.stringify({ task_index: taskIndex, task }));
    taskIndex++;
  }

  return lines.join('\n');
}

/**
 * Generate episodes.jsonl content
 */
export function generateEpisodesJsonl(episodes: Episode[]): string {
  const lines: string[] = [];

  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];
    const meta: LeRobotEpisodeMeta = {
      episode_index: i,
      tasks: episode.metadata.task || 'default_task',
      length: episode.frames.length,
    };
    lines.push(JSON.stringify(meta));
  }

  return lines.join('\n');
}

/**
 * Convert episodes to Parquet-compatible row format
 * Returns data that can be written to Parquet
 */
export function episodesToParquetData(episodes: Episode[], fps: number = 30): {
  columns: Record<string, unknown[]>;
  schema: Record<string, string>;
} {
  const { rows } = episodesToTabular(episodes, fps);

  // Transpose rows to columns for Parquet
  const columns: Record<string, unknown[]> = {
    'observation.state': [],
    'action': [],
    'episode_index': [],
    'frame_index': [],
    'timestamp': [],
    'next.done': [],
    'task_index': [],
  };

  for (const row of rows) {
    columns['observation.state'].push(row['observation.state']);
    columns['action'].push(row['action']);
    columns['episode_index'].push(row['episode_index']);
    columns['frame_index'].push(row['frame_index']);
    columns['timestamp'].push(row['timestamp']);
    columns['next.done'].push(row['next.done']);
    columns['task_index'].push(row['task_index']);
  }

  const schema = {
    'observation.state': 'list<float>',
    'action': 'list<float>',
    'episode_index': 'int64',
    'frame_index': 'int64',
    'timestamp': 'float',
    'next.done': 'bool',
    'task_index': 'int64',
  };

  return { columns, schema };
}

/**
 * Create a simple Parquet-like binary format
 * Since parquet-wasm is complex, we'll create a simpler format
 * that can be converted to Parquet later, or use Apache Arrow
 */
export function createSimpleParquetBlob(episodes: Episode[], fps: number = 30): Blob {
  const { columns } = episodesToParquetData(episodes, fps);

  // For now, export as JSON that matches Parquet column structure
  // This can be converted to actual Parquet using Python or Arrow.js
  const data = {
    format: 'lerobot-compatible',
    version: '3.0',
    columns,
  };

  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

/**
 * Export full LeRobot dataset as a ZIP file
 */
export async function exportLeRobotDataset(
  episodes: Episode[],
  datasetName: string,
  robotId: string,
  fps: number = 30,
  videoBlobs?: Blob[]
): Promise<void> {
  // We'll use JSZip to create the archive
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const hasVideo = videoBlobs && videoBlobs.length > 0;

  // meta/info.json
  const info = generateInfoJson(episodes, robotId, fps, hasVideo);
  zip.file('meta/info.json', JSON.stringify(info, null, 2));

  // meta/stats.json
  const stats = generateStatsJson(episodes, fps);
  zip.file('meta/stats.json', JSON.stringify(stats, null, 2));

  // meta/tasks.jsonl
  const tasks = generateTasksJsonl(episodes);
  zip.file('meta/tasks.jsonl', tasks);

  // meta/episodes.jsonl
  const episodesMeta = generateEpisodesJsonl(episodes);
  zip.file('meta/episodes.jsonl', episodesMeta);

  // data/chunk-000/episode_XXXXXX.parquet (as JSON for now)
  // In a full implementation, we'd use parquet-wasm here
  for (let i = 0; i < episodes.length; i++) {
    const episodeData = episodesToParquetData([episodes[i]], fps);
    const filename = `data/chunk-000/episode_${String(i).padStart(6, '0')}.json`;
    zip.file(filename, JSON.stringify(episodeData.columns, null, 2));
  }

  // videos/observation.images.cam_high/episode_XXXXXX.mp4
  if (videoBlobs) {
    for (let i = 0; i < videoBlobs.length; i++) {
      const filename = `videos/observation.images.cam_high/episode_${String(i).padStart(6, '0')}.mp4`;
      zip.file(filename, videoBlobs[i]);
    }
  }

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${datasetName}_lerobot.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Export dataset metadata only (for preview/validation)
 */
export function exportMetadataOnly(
  episodes: Episode[],
  robotId: string,
  fps: number = 30
): {
  info: LeRobotDatasetInfo;
  stats: LeRobotStats;
  tasks: string;
  episodes: string;
} {
  return {
    info: generateInfoJson(episodes, robotId, fps, false),
    stats: generateStatsJson(episodes, fps),
    tasks: generateTasksJsonl(episodes),
    episodes: generateEpisodesJsonl(episodes),
  };
}

/**
 * Validate episodes for LeRobot compatibility
 */
export function validateForLeRobot(episodes: Episode[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (episodes.length === 0) {
    errors.push('No episodes to export');
  }

  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];

    if (episode.frames.length === 0) {
      errors.push(`Episode ${i} has no frames`);
    }

    if (episode.frames.length < 10) {
      warnings.push(`Episode ${i} has only ${episode.frames.length} frames (recommend >= 10)`);
    }

    // Check for consistent joint count
    const jointCounts = new Set(episode.frames.map(f => f.observation.jointPositions.length));
    if (jointCounts.size > 1) {
      warnings.push(`Episode ${i} has inconsistent joint counts: ${[...jointCounts].join(', ')}`);
    }

    // Check for missing done flag
    const lastFrame = episode.frames[episode.frames.length - 1];
    if (!lastFrame?.done) {
      warnings.push(`Episode ${i} last frame doesn't have done=true`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
