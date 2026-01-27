/**
 * LeRobot Data Conversion
 *
 * Converts RoboSim episodes to LeRobot tabular format and computes statistics.
 */

import type { Episode } from '../datasetExporter';

export type LeRobotStats = Record<string, {
  min: number[];
  max: number[];
  mean: number[];
  std: number[];
}>;

interface LeRobotRow {
  'observation.state': number[];
  'observation.velocity': number[];
  'action': number[];
  'episode_index': number;
  'frame_index': number;
  'timestamp': number;
  'next.done': boolean;
  'task_index': number;
}

/**
 * Convert RoboSim episodes to LeRobot tabular format
 * Includes joint velocity estimation from position deltas
 */
export function episodesToTabular(episodes: Episode[], fps: number): {
  rows: LeRobotRow[];
  stats: LeRobotStats;
} {
  const rows: LeRobotRow[] = [];
  const dt = 1.0 / fps;

  const stateStats = { min: [] as number[], max: [] as number[], sum: [] as number[], sumSq: [] as number[], count: 0 };
  const actionStats = { min: [] as number[], max: [] as number[], sum: [] as number[], sumSq: [] as number[], count: 0 };
  const velocityStats = { min: [] as number[], max: [] as number[], sum: [] as number[], sumSq: [] as number[], count: 0 };

  for (let episodeIdx = 0; episodeIdx < episodes.length; episodeIdx++) {
    const episode = episodes[episodeIdx];
    const taskIndex = 0;

    let prevState: number[] | null = null;

    for (let frameIdx = 0; frameIdx < episode.frames.length; frameIdx++) {
      const frame = episode.frames[frameIdx];
      const timestamp = frame.timestamp / 1000;

      const DEG_TO_RAD = Math.PI / 180;
      const stateInDegrees = padArray(frame.observation.jointPositions, 6);
      const actionInDegrees = padArray(frame.action.jointTargets, 6);

      const state = stateInDegrees.map((val, idx) => {
        if (idx === 5) return val / 100;
        return val * DEG_TO_RAD;
      });
      const action = actionInDegrees.map((val, idx) => {
        if (idx === 5) return val / 100;
        return val * DEG_TO_RAD;
      });

      let velocity: number[];
      if (frame.observation.jointVelocities && frame.observation.jointVelocities.length === 6) {
        velocity = frame.observation.jointVelocities.map((v, idx) => {
          if (idx === 5) return v;
          return v * DEG_TO_RAD;
        });
      } else if (prevState) {
        velocity = state.map((pos, idx) => (pos - prevState![idx]) / dt);
      } else {
        velocity = new Array(6).fill(0);
      }

      updateStats(stateStats, state);
      updateStats(actionStats, action);
      updateStats(velocityStats, velocity);

      rows.push({
        'observation.state': state,
        'observation.velocity': velocity,
        'action': action,
        'episode_index': episodeIdx,
        'frame_index': frameIdx,
        'timestamp': timestamp,
        'next.done': frame.done,
        'task_index': taskIndex,
      });

      prevState = state;
    }
  }

  const stats: LeRobotStats = {
    'observation.state': finalizeStats(stateStats),
    'observation.velocity': finalizeStats(velocityStats),
    'action': finalizeStats(actionStats),
  };

  return { rows, stats };
}

function padArray(arr: number[], length: number): number[] {
  const result = [...arr];
  while (result.length < length) {
    result.push(0);
  }
  return result.slice(0, length);
}

function updateStats(stats: { min: number[]; max: number[]; sum: number[]; sumSq: number[]; count: number }, values: number[]) {
  if (stats.count === 0) {
    stats.min = [...values];
    stats.max = [...values];
    stats.sum = [...values];
    stats.sumSq = values.map(v => v * v);
  } else {
    for (let i = 0; i < values.length; i++) {
      stats.min[i] = Math.min(stats.min[i], values[i]);
      stats.max[i] = Math.max(stats.max[i], values[i]);
      stats.sum[i] += values[i];
      stats.sumSq[i] += values[i] * values[i];
    }
  }
  stats.count++;
}

function finalizeStats(stats: { min: number[]; max: number[]; sum: number[]; sumSq: number[]; count: number }) {
  const mean = stats.sum.map(s => s / stats.count);
  const std = stats.sumSq.map((sq, i) => {
    const variance = (sq / stats.count) - (mean[i] * mean[i]);
    return Math.sqrt(Math.max(0, variance));
  });

  return {
    min: stats.min,
    max: stats.max,
    mean,
    std,
  };
}

/**
 * Convert episodes to Parquet-compatible row format
 */
export function episodesToParquetData(episodes: Episode[], fps = 30): {
  columns: Record<string, unknown[]>;
  schema: Record<string, string>;
} {
  const { rows } = episodesToTabular(episodes, fps);

  const columns: Record<string, unknown[]> = {
    'observation.state': [],
    'observation.velocity': [],
    'action': [],
    'episode_index': [],
    'frame_index': [],
    'timestamp': [],
    'next.done': [],
    'task_index': [],
  };

  for (const row of rows) {
    columns['observation.state'].push(row['observation.state']);
    columns['observation.velocity'].push(row['observation.velocity']);
    columns['action'].push(row['action']);
    columns['episode_index'].push(row['episode_index']);
    columns['frame_index'].push(row['frame_index']);
    columns['timestamp'].push(row['timestamp']);
    columns['next.done'].push(row['next.done']);
    columns['task_index'].push(row['task_index']);
  }

  const schema = {
    'observation.state': 'list<float>',
    'observation.velocity': 'list<float>',
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
 * Generate stats.json for LeRobot dataset
 */
export function generateStatsJson(episodes: Episode[], fps: number): LeRobotStats {
  const { stats } = episodesToTabular(episodes, fps);
  return stats;
}

/**
 * Create a simple Parquet-like binary format
 */
export function createSimpleParquetBlob(episodes: Episode[], fps = 30): Blob {
  const { columns } = episodesToParquetData(episodes, fps);

  const data = {
    format: 'lerobot-compatible',
    version: '3.0',
    columns,
  };

  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}
