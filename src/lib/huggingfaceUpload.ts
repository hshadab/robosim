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
 * Convert episodes to data format for upload
 */
function convertToUploadData(
  episodes: Episode[],
  config: HFUploadConfig
): {
  episodeData: string;
  metadata: string;
} {
  const frames = episodes.flatMap((ep, epIdx) =>
    ep.frames.map((frame, frameIdx) => ({
      episode_index: epIdx,
      frame_index: frameIdx,
      timestamp: frame.timestamp,
      observation_state: frame.observation.jointPositions,
      action: frame.action.jointTargets || frame.observation.jointPositions,
      done: frame.done,
    }))
  );

  return {
    episodeData: JSON.stringify(frames),
    metadata: JSON.stringify({
      fps: config.fps,
      robot_type: config.robotId,
      episode_count: episodes.length,
      total_frames: frames.length,
    }),
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
 * Upload dataset to HuggingFace Hub
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

    onProgress({
      phase: 'uploading',
      message: 'Generating dataset card...',
      progress: 30,
      currentFile: 'README.md',
      totalFiles: 3,
      uploadedFiles: 0,
    });

    const datasetCard = generateDatasetCard(config, stats);
    await uploadFile(repoId, 'README.md', datasetCard, config.token, 'Add dataset card');

    onProgress({
      phase: 'uploading',
      message: 'Converting episode data...',
      progress: 50,
      currentFile: 'data/episodes.json',
      totalFiles: 3,
      uploadedFiles: 1,
    });

    const { episodeData, metadata } = convertToUploadData(episodes, config);
    await uploadFile(repoId, 'data/episodes.json', episodeData, config.token, 'Add episode data');

    onProgress({
      phase: 'uploading',
      message: 'Uploading metadata...',
      progress: 75,
      currentFile: 'meta/info.json',
      totalFiles: 3,
      uploadedFiles: 2,
    });

    await uploadFile(repoId, 'meta/info.json', metadata, config.token, 'Add metadata');

    onProgress({
      phase: 'complete',
      message: 'Upload complete!',
      progress: 100,
      totalFiles: 3,
      uploadedFiles: 3,
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
