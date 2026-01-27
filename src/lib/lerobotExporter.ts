/**
 * LeRobotDataset v3.0 Exporter
 *
 * Orchestrates the LeRobot export pipeline. Submodules:
 * - lerobot/metadata.ts — info.json, stats, tasks, episodes metadata
 * - lerobot/dataConversion.ts — tabular conversion, Parquet data, stats helpers
 * - lerobot/documentation.ts — README generation
 */

import type { Episode } from './datasetExporter';
import { episodesToParquetFormat, writeParquetFilePure, validateParquetData, generateConversionScript } from './parquetWriter';
import { checkBatchQuality, DEFAULT_THRESHOLDS, STRICT_THRESHOLDS, LENIENT_THRESHOLDS, type QualityThresholds, type QualityGateResult } from './qualityGates';

// Re-export everything from submodules for backward compatibility
export {
  generateInfoJson,
  generateStatsJson,
  generateTasksJsonl,
  generateEpisodesJsonl,
  episodesToParquetData,
  createSimpleParquetBlob,
  type LeRobotCameraView,
  type MultiCameraVideoBlobs,
  type LeRobotDatasetInfo,
  type SimToRealMetadata,
  type FeatureInfo,
  type ExportOptions,
  type ExportResult,
  type LeRobotStats,
  CAMERA_POSITION_TO_LEROBOT,
} from './lerobot';

import {
  generateInfoJson,
  generateStatsJson,
  generateTasksJsonl,
  generateEpisodesJsonl,
  episodesToParquetData,
  type LeRobotCameraView,
  type MultiCameraVideoBlobs,
  type ExportOptions,
  type ExportResult,
} from './lerobot';

import { generateReadme } from './lerobot/documentation';

// Re-export quality gates for convenience
export { DEFAULT_THRESHOLDS, STRICT_THRESHOLDS, LENIENT_THRESHOLDS, checkBatchQuality };
export type { QualityThresholds, QualityGateResult };

/**
 * Export full LeRobot dataset as a ZIP file with optional quality gates
 * Supports multi-camera export with cam_high, cam_wrist, etc.
 */
export async function exportLeRobotDataset(
  episodes: Episode[],
  datasetName: string,
  robotId: string,
  fps?: number,
  videoBlobs?: Blob[]
): Promise<void>;
export async function exportLeRobotDataset(
  episodes: Episode[],
  options: ExportOptions
): Promise<ExportResult>;
export async function exportLeRobotDataset(
  episodes: Episode[],
  datasetNameOrOptions: string | ExportOptions,
  robotId?: string,
  fps?: number,
  videoBlobs?: Blob[]
): Promise<void | ExportResult> {
  const options: ExportOptions = typeof datasetNameOrOptions === 'string'
    ? { datasetName: datasetNameOrOptions, robotId: robotId!, fps, videoBlobs }
    : datasetNameOrOptions;

  const {
    datasetName,
    robotId: robot,
    fps: framerate = 30,
    videoBlobs: videos,
    multiCameraVideoBlobs,
    qualityGates,
  } = options;

  const finalMultiCameraBlobs: MultiCameraVideoBlobs | undefined =
    multiCameraVideoBlobs ?? (videos ? { cam_high: videos } : undefined);

  let episodesToExport = episodes;
  let qualityResults: ExportResult['qualityResults'];

  if (qualityGates?.enabled) {
    const thresholds = qualityGates.thresholds ?? DEFAULT_THRESHOLDS;
    const batchResult = checkBatchQuality(episodes, thresholds);

    qualityResults = {
      passed: batchResult.summary.passed,
      failed: batchResult.summary.failed,
      averageScore: batchResult.summary.averageScore,
      details: batchResult.results,
    };

    if (batchResult.summary.failed > 0) {
      if (qualityGates.filterFailedEpisodes) {
        episodesToExport = batchResult.passedEpisodes;
        console.warn(
          `Quality gates: Filtered ${batchResult.summary.failed} failed episodes, exporting ${batchResult.summary.passed}`
        );
      } else if (qualityGates.blockOnFailure) {
        const failureMessages = batchResult.results
          .filter(r => !r.passed)
          .flatMap(r => r.failures.map(f => f.message))
          .slice(0, 5);

        return {
          success: false,
          exportedEpisodes: 0,
          skippedEpisodes: episodes.length,
          qualityResults,
          error: `Export blocked: ${batchResult.summary.failed} episodes failed quality gates. Issues: ${failureMessages.join('; ')}`,
        };
      }
    }
  }

  if (episodesToExport.length === 0) {
    return {
      success: false,
      exportedEpisodes: 0,
      skippedEpisodes: episodes.length,
      qualityResults,
      error: 'No episodes to export after quality filtering',
    };
  }

  return exportLeRobotDatasetInternal(
    episodesToExport,
    datasetName,
    robot,
    framerate,
    finalMultiCameraBlobs,
    typeof datasetNameOrOptions === 'object',
    episodes.length - episodesToExport.length,
    qualityResults,
    options.simToReal
  );
}

async function exportLeRobotDatasetInternal(
  episodes: Episode[],
  datasetName: string,
  robotId: string,
  fps: number,
  multiCameraBlobs?: MultiCameraVideoBlobs,
  returnResult = false,
  skippedCount = 0,
  qualityResults?: ExportResult['qualityResults'],
  simToReal?: ExportOptions['simToReal']
): Promise<void | ExportResult> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  const cameraViews: LeRobotCameraView[] = [];
  if (multiCameraBlobs) {
    for (const view of ['cam_high', 'cam_wrist', 'cam_left', 'cam_right'] as LeRobotCameraView[]) {
      if (multiCameraBlobs[view] && multiCameraBlobs[view]!.length > 0) {
        cameraViews.push(view);
      }
    }
  }
  const hasVideo = cameraViews.length > 0;

  const info = generateInfoJson(episodes, robotId, fps, hasVideo, simToReal, cameraViews);
  zip.file('meta/info.json', JSON.stringify(info, null, 2));

  const stats = generateStatsJson(episodes, fps);
  zip.file('meta/stats.json', JSON.stringify(stats, null, 2));

  const tasks = generateTasksJsonl(episodes);
  zip.file('meta/tasks.jsonl', tasks);

  const episodesMeta = generateEpisodesJsonl(episodes);
  zip.file('meta/episodes.jsonl', episodesMeta);

  for (let i = 0; i < episodes.length; i++) {
    try {
      const normalizedEpisode = {
        frames: episodes[i].frames.map(f => ({
          timestamp: f.timestamp,
          observation: { jointPositions: f.observation.jointPositions },
          action: { jointTargets: f.action.jointTargets },
          done: false,
        })),
        metadata: {
          duration: episodes[i].metadata.duration,
          success: episodes[i].metadata.success ?? true,
          task: episodes[i].metadata.task,
        },
      };
      const parquetData = episodesToParquetFormat([normalizedEpisode], fps);

      const validation = validateParquetData(parquetData);
      if (!validation.valid) {
        console.warn(`Episode ${i} validation warnings:`, validation.errors);
      }

      const parquetBytes = await writeParquetFilePure(parquetData);
      const filename = `data/chunk-000/episode_${String(i).padStart(6, '0')}.parquet`;
      zip.file(filename, parquetBytes);
    } catch (error) {
      console.warn(`Parquet write failed for episode ${i}, using JSON fallback:`, error);
      const episodeData = episodesToParquetData([episodes[i]], fps);
      const filename = `data/chunk-000/episode_${String(i).padStart(6, '0')}.json`;
      zip.file(filename, JSON.stringify(episodeData.columns, null, 2));
    }
  }

  if (multiCameraBlobs) {
    for (const view of cameraViews) {
      const viewBlobs = multiCameraBlobs[view];
      if (viewBlobs) {
        for (let i = 0; i < viewBlobs.length; i++) {
          const filename = `videos/observation.images.${view}/episode_${String(i).padStart(6, '0')}.mp4`;
          zip.file(filename, viewBlobs[i]);
        }
      }
    }
  }

  const conversionScript = generateConversionScript();
  zip.file('convert_to_parquet.py', conversionScript);

  const readmeContent = generateReadme(datasetName, robotId, episodes.length, hasVideo, cameraViews);
  zip.file('README.md', readmeContent);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${datasetName}_lerobot.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  if (returnResult) {
    return {
      success: true,
      exportedEpisodes: episodes.length,
      skippedEpisodes: skippedCount,
      qualityResults,
    };
  }
}

/**
 * Export dataset metadata only (for preview/validation)
 */
export function exportMetadataOnly(
  episodes: Episode[],
  robotId: string,
  fps = 30
): {
  info: import('./lerobot').LeRobotDatasetInfo;
  stats: import('./lerobot').LeRobotStats;
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

    const jointCounts = new Set(episode.frames.map(f => f.observation.jointPositions.length));
    if (jointCounts.size > 1) {
      warnings.push(`Episode ${i} has inconsistent joint counts: ${[...jointCounts].join(', ')}`);
    }

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
