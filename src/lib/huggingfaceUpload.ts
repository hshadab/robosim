/**
 * HuggingFace Hub Upload Library
 *
 * Provides direct upload of LeRobot-format datasets to HuggingFace Hub:
 * - Creates new dataset repos
 * - Uploads Parquet files and metadata
 * - Generates dataset cards
 * - Handles authentication via token
 */

import type { Episode } from './datasetExporter';
import type { ActiveRobotType } from '../types';

export interface HFUploadConfig {
  // HuggingFace username or organization
  username: string;
  // Dataset repository name
  repoName: string;
  // HuggingFace API token (write access required)
  token: string;
  // Dataset description
  description?: string;
  // Whether to make the dataset private
  isPrivate?: boolean;
  // Robot type
  robotType: ActiveRobotType;
  // Robot model ID
  robotId: string;
  // Recording FPS
  fps: number;
  // Task description
  task?: string;
  // Tags for discoverability
  tags?: string[];
}

export interface HFUploadProgress {
  phase: 'preparing' | 'creating_repo' | 'uploading' | 'finalizing' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  currentFile?: string;
  totalFiles?: number;
  uploadedFiles?: number;
}

export interface HFUploadResult {
  success: boolean;
  repoUrl?: string;
  repoId?: string;
  error?: string;
  stats?: {
    episodeCount: number;
    frameCount: number;
    fileSizeBytes: number;
  };
}

// HuggingFace API endpoints
const HF_API_BASE = 'https://huggingface.co/api';

/**
 * Validate HuggingFace token by making a whoami request
 */
export async function validateHFToken(token: string): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${HF_API_BASE}/whoami`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false, error: 'Invalid token or authentication failed' };
    }

    const data = await response.json();
    return { valid: true, username: data.name };
  } catch (_error) {
    return { valid: false, error: 'Failed to connect to HuggingFace' };
  }
}

/**
 * Check if a repository exists
 */
async function checkRepoExists(repoId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(`${HF_API_BASE}/datasets/${repoId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Create a new dataset repository on HuggingFace Hub
 */
async function createDatasetRepo(
  config: HFUploadConfig,
  onProgress: (progress: HFUploadProgress) => void
): Promise<string> {
  onProgress({
    phase: 'creating_repo',
    message: 'Creating dataset repository...',
    progress: 10,
  });

  const repoId = `${config.username}/${config.repoName}`;

  // Check if repo exists
  const exists = await checkRepoExists(repoId, config.token);
  if (exists) {
    return repoId;
  }

  // Create new repo
  const response = await fetch(`${HF_API_BASE}/repos/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      name: config.repoName,
      type: 'dataset',
      private: config.isPrivate ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create repository: ${error}`);
  }

  return repoId;
}

/**
 * Generate a dataset card (README.md) for the repository
 */
function generateDatasetCard(
  config: HFUploadConfig,
  stats: {
    episodeCount: number;
    frameCount: number;
  }
): string {
  const tags = [
    'robotics',
    'lerobot',
    config.robotType,
    config.robotId,
    ...(config.tags || []),
  ];

  const tagYaml = tags.map((t) => '  - ' + t).join('\n');

  return `---
tags:
${tagYaml}
task_categories:
  - robotics
license: apache-2.0
---

# ${config.repoName}

${config.description || 'A robotics dataset recorded with RoboSim.'}

## Dataset Details

| Property | Value |
|----------|-------|
| Robot Type | ${config.robotType} |
| Robot ID | ${config.robotId} |
| FPS | ${config.fps} |
| Episodes | ${stats.episodeCount} |
| Total Frames | ${stats.frameCount} |
${config.task ? '| Task | ' + config.task + ' |' : ''}

## Dataset Structure

This dataset follows the LeRobot v3.0 format.

## Usage with LeRobot

\`\`\`python
from lerobot.common.datasets.lerobot_dataset import LeRobotDataset

dataset = LeRobotDataset("${config.username}/${config.repoName}")
\`\`\`

## License

This dataset is released under the Apache 2.0 License.
`;
}

/**
 * Convert episodes to LeRobot-compatible format for upload
 */
function convertToLeRobotFormat(
  episodes: Episode[],
  config: HFUploadConfig
): {
  infoJson: string;
  statsJson: string;
  episodesJsonl: string;
  tasksJsonl: string;
  episodeDataFiles: Array<{ filename: string; content: string }>;
} {
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);

  // Generate info.json (LeRobot v3.0 format)
  const info = {
    codebase_version: '0.4.2',
    robot_type: config.robotId,
    fps: config.fps,
    features: {
      'observation.state': { dtype: 'float32', shape: [6], names: null },
      'action': { dtype: 'float32', shape: [6], names: null },
      'episode_index': { dtype: 'int64', shape: [1], names: null },
      'frame_index': { dtype: 'int64', shape: [1], names: null },
      'timestamp': { dtype: 'float32', shape: [1], names: null },
      'next.done': { dtype: 'bool', shape: [1], names: null },
      'task_index': { dtype: 'int64', shape: [1], names: null },
    },
    splits: { train: `0:${episodes.length}` },
    total_episodes: episodes.length,
    total_frames: totalFrames,
    total_tasks: 1,
    total_videos: 0,
    total_chunks: 1,
    chunks_size: 1000,
    data_path: 'data/chunk-{chunk:03d}/episode_{episode:06d}.parquet',
    video_path: '',
  };

  // Generate stats.json
  const stats = calculateStats(episodes);

  // Generate episodes.jsonl
  const episodesJsonl = episodes.map((ep, idx) => JSON.stringify({
    episode_index: idx,
    tasks: ep.metadata.task || 'default_task',
    length: ep.frames.length,
    ...(ep.metadata.languageInstruction && { language_instruction: ep.metadata.languageInstruction }),
  })).join('\n');

  // Generate tasks.jsonl
  const tasks = new Set(episodes.map(ep => ep.metadata.task || 'default_task'));
  const tasksJsonl = Array.from(tasks).map((task, idx) =>
    JSON.stringify({ task_index: idx, task })
  ).join('\n');

  // Generate episode data files (JSON format - note for user to convert)
  const episodeDataFiles = episodes.map((episode, epIdx) => {
    const data = {
      _meta: {
        format: 'robosim-lerobot-json',
        lerobot_version: '3.0',
        num_rows: episode.frames.length,
        note: 'Convert to Parquet using: python convert_to_parquet.py',
      },
      columns: {
        'observation.state': episode.frames.map(f => padArray(f.observation.jointPositions, 6)),
        'action': episode.frames.map(f => padArray(f.action.jointTargets, 6)),
        'episode_index': episode.frames.map(() => epIdx),
        'frame_index': episode.frames.map((_, i) => i),
        'timestamp': episode.frames.map(f => f.timestamp / 1000),
        'next.done': episode.frames.map((f, i) => i === episode.frames.length - 1 || f.done),
        'task_index': episode.frames.map(() => 0),
      }
    };
    return {
      filename: `data/chunk-000/episode_${String(epIdx).padStart(6, '0')}.parquet`,
      content: JSON.stringify(data),
    };
  });

  return {
    infoJson: JSON.stringify(info, null, 2),
    statsJson: JSON.stringify(stats, null, 2),
    episodesJsonl,
    tasksJsonl,
    episodeDataFiles,
  };
}

/**
 * Pad array to specified length
 */
function padArray(arr: number[], length: number): number[] {
  const result = [...arr];
  while (result.length < length) result.push(0);
  return result.slice(0, length);
}

/**
 * Calculate stats for episodes
 */
function calculateStats(episodes: Episode[]): Record<string, { min: number[]; max: number[]; mean: number[]; std: number[] }> {
  const allStates: number[][] = [];
  const allActions: number[][] = [];

  for (const ep of episodes) {
    for (const frame of ep.frames) {
      allStates.push(padArray(frame.observation.jointPositions, 6));
      allActions.push(padArray(frame.action.jointTargets, 6));
    }
  }

  const calcFeatureStats = (data: number[][]) => {
    if (data.length === 0) return { min: [0], max: [0], mean: [0], std: [0] };
    const dim = data[0].length;
    const min = Array(dim).fill(Infinity);
    const max = Array(dim).fill(-Infinity);
    const sum = Array(dim).fill(0);
    const sumSq = Array(dim).fill(0);

    for (const row of data) {
      for (let i = 0; i < dim; i++) {
        min[i] = Math.min(min[i], row[i]);
        max[i] = Math.max(max[i], row[i]);
        sum[i] += row[i];
        sumSq[i] += row[i] * row[i];
      }
    }

    const mean = sum.map(s => s / data.length);
    const std = sumSq.map((sq, i) => Math.sqrt(Math.max(0, sq / data.length - mean[i] * mean[i])));

    return { min, max, mean, std };
  };

  return {
    'observation.state': calcFeatureStats(allStates),
    'action': calcFeatureStats(allActions),
  };
}

/**
 * Upload a file to HuggingFace Hub
 */
async function uploadFile(
  repoId: string,
  path: string,
  content: string,
  token: string,
  commitMessage: string
): Promise<void> {
  const response = await fetch(
    `${HF_API_BASE}/datasets/${repoId}/commit/main`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        additions: [
          {
            path,
            encoding: 'utf-8',
            content,
          },
        ],
        deletions: [],
        commit_message: commitMessage,
        commit_description: 'Uploaded via RoboSim',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload ${path}: ${error}`);
  }
}

/**
 * Upload dataset to HuggingFace Hub in LeRobot v3.0 format
 */
export async function uploadToHuggingFace(
  episodes: Episode[],
  config: HFUploadConfig,
  onProgress: (progress: HFUploadProgress) => void
): Promise<HFUploadResult> {
  try {
    onProgress({
      phase: 'preparing',
      message: 'Validating authentication...',
      progress: 5,
    });

    const tokenValidation = await validateHFToken(config.token);
    if (!tokenValidation.valid) {
      return {
        success: false,
        error: tokenValidation.error || 'Invalid token',
      };
    }

    const repoId = await createDatasetRepo(config, onProgress);
    const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
    const stats = {
      episodeCount: episodes.length,
      frameCount: totalFrames,
      fileSizeBytes: 0,
    };

    // Convert to LeRobot format
    const lerobotData = convertToLeRobotFormat(episodes, config);
    const totalFiles = 5 + lerobotData.episodeDataFiles.length; // README, info, stats, episodes, tasks + data files
    let uploadedFiles = 0;

    onProgress({
      phase: 'uploading',
      message: 'Uploading dataset card...',
      progress: 10,
      currentFile: 'README.md',
      totalFiles,
      uploadedFiles,
    });

    const datasetCard = generateDatasetCard(config, stats);
    await uploadFile(repoId, 'README.md', datasetCard, config.token, 'Add dataset card');
    uploadedFiles++;

    onProgress({
      phase: 'uploading',
      message: 'Uploading metadata...',
      progress: 20,
      currentFile: 'meta/info.json',
      totalFiles,
      uploadedFiles,
    });

    await uploadFile(repoId, 'meta/info.json', lerobotData.infoJson, config.token, 'Add info.json');
    uploadedFiles++;

    onProgress({
      phase: 'uploading',
      message: 'Uploading statistics...',
      progress: 30,
      currentFile: 'meta/stats.json',
      totalFiles,
      uploadedFiles,
    });

    await uploadFile(repoId, 'meta/stats.json', lerobotData.statsJson, config.token, 'Add stats.json');
    uploadedFiles++;

    onProgress({
      phase: 'uploading',
      message: 'Uploading episode metadata...',
      progress: 40,
      currentFile: 'meta/episodes.jsonl',
      totalFiles,
      uploadedFiles,
    });

    await uploadFile(repoId, 'meta/episodes.jsonl', lerobotData.episodesJsonl, config.token, 'Add episodes.jsonl');
    uploadedFiles++;

    await uploadFile(repoId, 'meta/tasks.jsonl', lerobotData.tasksJsonl, config.token, 'Add tasks.jsonl');
    uploadedFiles++;

    // Upload episode data files
    for (let i = 0; i < lerobotData.episodeDataFiles.length; i++) {
      const file = lerobotData.episodeDataFiles[i];
      const progress = 50 + (i / lerobotData.episodeDataFiles.length) * 45;

      onProgress({
        phase: 'uploading',
        message: `Uploading episode ${i + 1}/${lerobotData.episodeDataFiles.length}...`,
        progress,
        currentFile: file.filename,
        totalFiles,
        uploadedFiles,
      });

      await uploadFile(repoId, file.filename, file.content, config.token, `Add episode ${i}`);
      uploadedFiles++;
    }

    // Upload conversion script
    const conversionScript = generateConversionScript();
    await uploadFile(repoId, 'convert_to_parquet.py', conversionScript, config.token, 'Add conversion script');

    onProgress({
      phase: 'complete',
      message: 'Upload complete! Run convert_to_parquet.py to finalize.',
      progress: 100,
      totalFiles,
      uploadedFiles: totalFiles,
    });

    return {
      success: true,
      repoUrl: `https://huggingface.co/datasets/${repoId}`,
      repoId,
      stats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    onProgress({
      phase: 'error',
      message: errorMessage,
      progress: 0,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate Python conversion script
 */
function generateConversionScript(): string {
  return `#!/usr/bin/env python3
"""
Convert RoboSim JSON episode files to Apache Parquet format for LeRobot.

Usage:
    python convert_to_parquet.py

Requirements:
    pip install pandas pyarrow
"""

import json
from pathlib import Path

try:
    import pandas as pd
    import pyarrow as pa
    import pyarrow.parquet as pq
except ImportError:
    print("Please install required packages: pip install pandas pyarrow")
    exit(1)

def convert_episode_file(json_path: Path) -> None:
    with open(json_path, 'r') as f:
        data = json.load(f)
    columns = data['columns']
    df = pd.DataFrame({
        'observation.state': columns['observation.state'],
        'action': columns['action'],
        'episode_index': pd.array(columns['episode_index'], dtype='int64'),
        'frame_index': pd.array(columns['frame_index'], dtype='int64'),
        'timestamp': pd.array(columns['timestamp'], dtype='float32'),
        'next.done': columns['next.done'],
        'task_index': pd.array(columns['task_index'], dtype='int64'),
    })
    table = pa.Table.from_pandas(df)
    pq.write_table(table, json_path)
    print(f"Converted: {json_path}")

def main():
    data_dir = Path('data/chunk-000')
    if not data_dir.exists():
        print(f"Data directory not found: {data_dir}")
        return
    json_files = list(data_dir.glob('episode_*.parquet'))
    if not json_files:
        print("No episode files found.")
        return
    print(f"Converting {len(json_files)} files...")
    for f in sorted(json_files):
        convert_episode_file(f)
    print("Done! Dataset ready for LeRobot.")

if __name__ == '__main__':
    main()
`;
}

/**
 * Generate a suggested repository name
 */
export function generateRepoName(task?: string, robotId?: string): string {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const taskSlug = task?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20) || 'dataset';
  const robotSlug = robotId?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'robot';
  return `${robotSlug}-${taskSlug}-${date}`;
}

/**
 * Validate repository name for HuggingFace
 */
export function validateRepoName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name) {
    return { valid: false, error: 'Repository name is required' };
  }
  if (name.length < 3) {
    return { valid: false, error: 'Repository name must be at least 3 characters' };
  }
  if (name.length > 96) {
    return { valid: false, error: 'Repository name must be 96 characters or less' };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    return { valid: false, error: 'Invalid repository name format' };
  }
  return { valid: true };
}
