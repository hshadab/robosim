/**
 * Dataset Export/Import for Robotics Training Data
 * Compatible with LeRobot format for imitation learning
 */

import type { JointState, WheeledRobotState, DroneState, HumanoidState, ActiveRobotType } from '../types';

// LeRobot-compatible episode structure
export interface Episode {
  episodeId: number;
  frames: Frame[];
  metadata: EpisodeMetadata;
}

export interface Frame {
  timestamp: number;
  observation: Observation;
  action: Action;
  reward?: number;
  done: boolean;
}

export interface Observation {
  /** Joint positions in radians or degrees */
  jointPositions: number[];
  /** Joint velocities */
  jointVelocities?: number[];
  /** End effector position [x, y, z] */
  endEffectorPosition?: [number, number, number];
  /** Camera image as base64 or blob URL */
  image?: string;
  /** Additional sensor data */
  sensors?: Record<string, number>;
}

export interface Action {
  /** Target joint positions */
  jointTargets: number[];
  /** Gripper action (0 = closed, 1 = open) */
  gripper?: number;
  /** Additional action parameters */
  extras?: Record<string, number>;
}

export interface EpisodeMetadata {
  robotType: ActiveRobotType;
  robotId: string;
  task?: string;
  /** Free-form natural language instruction for language-conditioned learning */
  languageInstruction?: string;
  success?: boolean;
  duration: number;
  frameCount: number;
  recordedAt: string;
}

export interface DatasetMetadata {
  name: string;
  description: string;
  robotType: ActiveRobotType;
  robotId: string;
  episodeCount: number;
  totalFrames: number;
  createdAt: string;
  version: string;
}

export interface Dataset {
  metadata: DatasetMetadata;
  episodes: Episode[];
}

/**
 * Recording session for capturing robot telemetry
 */
export class DatasetRecorder {
  private frames: Frame[] = [];
  private startTime = 0;
  private isRecording = false;
  private episodeId = 0;
  private robotType: ActiveRobotType = 'arm';
  private robotId = 'unknown';

  constructor(robotType: ActiveRobotType, robotId: string) {
    this.robotType = robotType;
    this.robotId = robotId;
  }

  /**
   * Start recording a new episode
   */
  startEpisode(): void {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }
    this.frames = [];
    this.startTime = performance.now();
    this.isRecording = true;
    this.episodeId++;
  }

  /**
   * Record a frame during the episode
   */
  recordFrame(
    state: JointState | WheeledRobotState | DroneState | HumanoidState,
    action: Partial<Action> = {},
    imageDataUrl?: string,
    done = false
  ): void {
    if (!this.isRecording) return;

    const timestamp = performance.now() - this.startTime;

    // Convert state to observation
    const observation = this.stateToObservation(state, imageDataUrl);

    // Build action from state changes
    const fullAction: Action = {
      jointTargets: observation.jointPositions,
      gripper: action.gripper,
      extras: action.extras,
    };

    this.frames.push({
      timestamp,
      observation,
      action: fullAction,
      done,
    });
  }

  /**
   * End the current episode
   * @param success - Whether the episode was successful
   * @param task - Categorical task name (e.g., "pick_and_place")
   * @param languageInstruction - Free-form natural language instruction for language-conditioned learning
   */
  endEpisode(success = true, task?: string, languageInstruction?: string): Episode {
    this.isRecording = false;

    // Mark last frame as done
    if (this.frames.length > 0) {
      this.frames[this.frames.length - 1].done = true;
    }

    const episode: Episode = {
      episodeId: this.episodeId,
      frames: [...this.frames],
      metadata: {
        robotType: this.robotType,
        robotId: this.robotId,
        task,
        languageInstruction,
        success,
        duration: this.frames.length > 0 ? this.frames[this.frames.length - 1].timestamp : 0,
        frameCount: this.frames.length,
        recordedAt: new Date().toISOString(),
      },
    };

    this.frames = [];
    return episode;
  }

  /**
   * Check if currently recording
   */
  get recording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current frame count
   */
  get frameCount(): number {
    return this.frames.length;
  }

  private stateToObservation(
    state: JointState | WheeledRobotState | DroneState | HumanoidState,
    image?: string
  ): Observation {
    // Convert different robot states to a common observation format
    if ('base' in state) {
      // Arm robot
      const armState = state as JointState;
      return {
        jointPositions: [
          armState.base,
          armState.shoulder,
          armState.elbow,
          armState.wrist,
          armState.gripper,
        ],
        image,
      };
    } else if ('leftWheelSpeed' in state) {
      // Wheeled robot
      const wheeled = state as WheeledRobotState;
      return {
        jointPositions: [
          wheeled.leftWheelSpeed,
          wheeled.rightWheelSpeed,
          wheeled.servoHead,
        ],
        sensors: {
          heading: wheeled.heading,
          velocity: wheeled.velocity,
        },
        image,
      };
    } else if ('throttle' in state) {
      // Drone
      const drone = state as DroneState;
      return {
        jointPositions: [
          drone.throttle,
          drone.rotation.x,
          drone.rotation.y,
          drone.rotation.z,
        ],
        endEffectorPosition: [
          drone.position.x,
          drone.position.y,
          drone.position.z,
        ],
        image,
      };
    } else {
      // Humanoid
      const humanoid = state as HumanoidState;
      return {
        jointPositions: [
          humanoid.leftHipPitch,
          humanoid.leftHipRoll,
          humanoid.leftKnee,
          humanoid.leftAnklePitch,
          humanoid.rightHipPitch,
          humanoid.rightHipRoll,
          humanoid.rightKnee,
          humanoid.rightAnklePitch,
          humanoid.leftShoulderPitch,
          humanoid.leftElbow,
          humanoid.rightShoulderPitch,
          humanoid.rightElbow,
        ],
        image,
      };
    }
  }
}

/**
 * Export dataset to JSON format (LeRobot compatible)
 */
export function exportDatasetJSON(
  episodes: Episode[],
  name: string,
  description: string
): string {
  const robotType = episodes[0]?.metadata.robotType || 'arm';
  const robotId = episodes[0]?.metadata.robotId || 'unknown';

  const dataset: Dataset = {
    metadata: {
      name,
      description,
      robotType,
      robotId,
      episodeCount: episodes.length,
      totalFrames: episodes.reduce((sum, ep) => sum + ep.frames.length, 0),
      createdAt: new Date().toISOString(),
      version: '1.0.0',
    },
    episodes,
  };

  return JSON.stringify(dataset, null, 2);
}

/**
 * Import dataset from JSON
 */
export function importDatasetJSON(json: string): Dataset {
  const dataset = JSON.parse(json) as Dataset;

  // Validate structure
  if (!dataset.metadata || !dataset.episodes) {
    throw new Error('Invalid dataset format');
  }

  return dataset;
}

/**
 * Export episode to CSV format
 */
export function exportEpisodeCSV(episode: Episode): string {
  const headers = [
    'timestamp',
    'joint_0', 'joint_1', 'joint_2', 'joint_3', 'joint_4',
    'action_0', 'action_1', 'action_2', 'action_3', 'action_4',
    'done',
  ];

  const rows = [headers.join(',')];

  for (const frame of episode.frames) {
    const row = [
      frame.timestamp.toFixed(2),
      ...frame.observation.jointPositions.slice(0, 5).map(v => v?.toFixed(4) || '0'),
      ...frame.action.jointTargets.slice(0, 5).map(v => v?.toFixed(4) || '0'),
      frame.done ? '1' : '0',
    ];

    // Pad with zeros if fewer joints
    while (row.length < headers.length) {
      row.splice(row.length - 1, 0, '0');
    }

    rows.push(row.join(','));
  }

  return rows.join('\n');
}

/**
 * Download dataset as file
 */
export function downloadDataset(
  episodes: Episode[],
  name: string,
  format: 'json' | 'csv' = 'json'
): void {
  let content: string;
  let filename: string;
  let mimeType: string;

  if (format === 'json') {
    content = exportDatasetJSON(episodes, name, `RoboSim dataset: ${name}`);
    filename = `${name.replace(/\s+/g, '_')}.json`;
    mimeType = 'application/json';
  } else {
    // For CSV, export each episode separately
    content = episodes.map(ep => exportEpisodeCSV(ep)).join('\n\n');
    filename = `${name.replace(/\s+/g, '_')}.csv`;
    mimeType = 'text/csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Load dataset from file
 */
export async function loadDatasetFromFile(file: File): Promise<Dataset> {
  const text = await file.text();

  if (file.name.endsWith('.json')) {
    return importDatasetJSON(text);
  }

  throw new Error('Unsupported file format. Use JSON.');
}

/**
 * Generate statistics for a dataset
 */
export function getDatasetStats(dataset: Dataset): {
  episodeCount: number;
  totalFrames: number;
  avgEpisodeLength: number;
  totalDuration: number;
  successRate: number;
} {
  const episodeCount = dataset.episodes.length;
  const totalFrames = dataset.episodes.reduce((sum, ep) => sum + ep.frames.length, 0);
  const totalDuration = dataset.episodes.reduce((sum, ep) => sum + ep.metadata.duration, 0);
  const successCount = dataset.episodes.filter(ep => ep.metadata.success).length;

  return {
    episodeCount,
    totalFrames,
    avgEpisodeLength: episodeCount > 0 ? totalFrames / episodeCount : 0,
    totalDuration,
    successRate: episodeCount > 0 ? successCount / episodeCount : 0,
  };
}

/**
 * Merge multiple datasets
 */
export function mergeDatasets(datasets: Dataset[]): Dataset {
  if (datasets.length === 0) {
    throw new Error('No datasets to merge');
  }

  // Use first dataset's metadata as base
  const base = datasets[0];

  // Collect all episodes with renumbered IDs
  let episodeCounter = 0;
  const allEpisodes: Episode[] = [];

  for (const dataset of datasets) {
    for (const episode of dataset.episodes) {
      episodeCounter++;
      allEpisodes.push({
        ...episode,
        episodeId: episodeCounter,
      });
    }
  }

  return {
    metadata: {
      ...base.metadata,
      episodeCount: allEpisodes.length,
      totalFrames: allEpisodes.reduce((sum, ep) => sum + ep.frames.length, 0),
      createdAt: new Date().toISOString(),
    },
    episodes: allEpisodes,
  };
}

/**
 * Filter episodes by criteria
 */
export function filterEpisodes(
  dataset: Dataset,
  criteria: {
    minFrames?: number;
    maxFrames?: number;
    successOnly?: boolean;
    task?: string;
  }
): Episode[] {
  return dataset.episodes.filter(episode => {
    if (criteria.minFrames && episode.frames.length < criteria.minFrames) return false;
    if (criteria.maxFrames && episode.frames.length > criteria.maxFrames) return false;
    if (criteria.successOnly && !episode.metadata.success) return false;
    if (criteria.task && episode.metadata.task !== criteria.task) return false;
    return true;
  });
}
