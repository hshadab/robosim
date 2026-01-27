/**
 * LeRobot Dataset Metadata Generators
 *
 * Generates info.json, stats.json, tasks.jsonl, and episodes.jsonl
 * for LeRobot v3.0 format datasets.
 */

import type { Episode } from '../datasetExporter';
import type { SimCameraConfig } from '../../types';
import type { ImageAugmentationConfig } from '../imageAugmentation';
import type { TimeWarpConfig } from '../trajectoryAugmentation';
import type { PhysicsIdentification } from '../systemIdentification';
import type { ActionCalibrationConfig } from '../actionCalibration';
import type { LeRobotStats } from './dataConversion';

/**
 * LeRobot camera view names - standard naming convention
 * Maps to physical camera positions on real robots
 */
export type LeRobotCameraView =
  | 'cam_high'     // Main overhead/workspace camera
  | 'cam_wrist'    // Gripper/wrist-mounted camera
  | 'cam_left'     // Left side camera
  | 'cam_right';   // Right side camera

/**
 * Map RoboSim camera positions to LeRobot view names
 */
export const CAMERA_POSITION_TO_LEROBOT: Record<string, LeRobotCameraView> = {
  'overhead': 'cam_high',
  'gripper': 'cam_wrist',
  'wrist': 'cam_wrist',
  'base': 'cam_high',
};

/**
 * Video blobs for multiple camera views
 */
export interface MultiCameraVideoBlobs {
  cam_high?: Blob[];
  cam_wrist?: Blob[];
  cam_left?: Blob[];
  cam_right?: Blob[];
}

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
  robosim_version: string;
  robot_id: string;
  simToReal?: SimToRealMetadata;
}

/**
 * Sim-to-real transfer metadata for reproducibility and calibration
 */
export interface SimToRealMetadata {
  cameraConfig?: SimCameraConfig;
  cameraIntrinsics?: {
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    width: number;
    height: number;
    distortion: number[];
  };
  physicsIdentification?: PhysicsIdentification;
  actionCalibration?: ActionCalibrationConfig;
  augmentation?: {
    imageAugmentation?: Partial<ImageAugmentationConfig>;
    trajectoryAugmentation?: Partial<TimeWarpConfig>;
    augmentedVersionsPerEpisode?: number;
  };
  domainRandomization?: {
    enabled: boolean;
    visualRandomization: boolean;
    motionVariation: boolean;
    recoveryBehaviors: boolean;
  };
}

export interface FeatureInfo {
  dtype: string;
  shape: number[];
  names?: string[] | null;
}

interface LeRobotEpisodeMeta {
  episode_index: number;
  tasks: string;
  length: number;
  language_instruction?: string;
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
    'observation.velocity': {
      dtype: 'float32',
      shape: [6],
      names: SO101_JOINT_NAMES.map(n => `${n}_velocity`),
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
  'observation.velocity': {
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

export interface ExportOptions {
  datasetName: string;
  robotId: string;
  fps?: number;
  /** @deprecated Use multiCameraVideoBlobs instead for multi-camera support */
  videoBlobs?: Blob[];
  multiCameraVideoBlobs?: MultiCameraVideoBlobs;
  qualityGates?: {
    enabled: boolean;
    thresholds?: import('../qualityGates').QualityThresholds;
    filterFailedEpisodes?: boolean;
    blockOnFailure?: boolean;
  };
  simToReal?: {
    cameraConfig?: SimCameraConfig;
    cameraConfigs?: Partial<Record<LeRobotCameraView, SimCameraConfig>>;
    physicsIdentification?: PhysicsIdentification;
    actionCalibration?: ActionCalibrationConfig;
    imageAugmentation?: {
      enabled: boolean;
      config?: Partial<ImageAugmentationConfig>;
      versionsPerEpisode?: number;
    };
    trajectoryAugmentation?: {
      enabled: boolean;
      config?: Partial<TimeWarpConfig>;
    };
    domainRandomization?: {
      enabled: boolean;
      visualRandomization: boolean;
      motionVariation: boolean;
      recoveryBehaviors: boolean;
    };
  };
}

export interface ExportResult {
  success: boolean;
  exportedEpisodes: number;
  skippedEpisodes: number;
  qualityResults?: {
    passed: number;
    failed: number;
    averageScore: number;
    details: import('../qualityGates').QualityGateResult[];
  };
  error?: string;
}

/**
 * Generate info.json for LeRobot dataset
 */
export function generateInfoJson(
  episodes: Episode[],
  robotId: string,
  fps = 30,
  hasVideo = false,
  simToReal?: ExportOptions['simToReal'],
  cameraViews?: LeRobotCameraView[]
): LeRobotDatasetInfo {
  const totalFrames = episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const features = { ...(ROBOT_FEATURES[robotId] || DEFAULT_FEATURES) };

  const views = cameraViews ?? (hasVideo ? ['cam_high'] as LeRobotCameraView[] : []);

  for (const view of views) {
    features[`observation.images.${view}`] = {
      dtype: 'video',
      shape: [480, 640, 3],
      names: ['height', 'width', 'channels'],
    };
  }

  const computeIntrinsics = (cam: SimCameraConfig) => {
    const [width, height] = cam.resolution;
    const fovRadians = (cam.fov * Math.PI) / 180;
    const fy = height / (2 * Math.tan(fovRadians / 2));
    const fx = fy;
    return {
      fx,
      fy,
      cx: width / 2,
      cy: height / 2,
      width,
      height,
      distortion: [0, 0, 0, 0, 0],
    };
  };

  const simToRealMetadata: SimToRealMetadata | undefined = simToReal ? {
    cameraConfig: simToReal.cameraConfig,
    cameraIntrinsics: simToReal.cameraConfig ? computeIntrinsics(simToReal.cameraConfig) : undefined,
    physicsIdentification: simToReal.physicsIdentification,
    actionCalibration: simToReal.actionCalibration,
    augmentation: (simToReal.imageAugmentation?.enabled || simToReal.trajectoryAugmentation?.enabled) ? {
      imageAugmentation: simToReal.imageAugmentation?.enabled ? simToReal.imageAugmentation.config : undefined,
      trajectoryAugmentation: simToReal.trajectoryAugmentation?.enabled ? simToReal.trajectoryAugmentation.config : undefined,
      augmentedVersionsPerEpisode: simToReal.imageAugmentation?.versionsPerEpisode,
    } : undefined,
    domainRandomization: simToReal.domainRandomization,
  } : undefined;

  const totalVideos = views.length > 0 ? episodes.length * views.length : 0;
  const videoPaths = views.map(v => `videos/observation.images.${v}/episode_{episode:06d}.mp4`);
  const videoPath = videoPaths.length > 0 ? videoPaths[0] : '';

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
    total_videos: totalVideos,
    total_chunks: 1,
    chunks_size: 1000,
    data_path: 'data/chunk-{chunk:03d}/episode_{episode:06d}.parquet',
    video_path: videoPath,
    robosim_version: '1.0.0',
    robot_id: robotId,
    simToReal: simToRealMetadata,
  };
}

/**
 * Generate stats.json for LeRobot dataset
 */
export { generateStatsJson } from './dataConversion';

/**
 * Generate tasks.jsonl content
 */
export function generateTasksJsonl(episodes: Episode[]): string {
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

    if (episode.metadata.languageInstruction) {
      meta.language_instruction = episode.metadata.languageInstruction;
    }

    lines.push(JSON.stringify(meta));
  }

  return lines.join('\n');
}
