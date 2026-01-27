/**
 * Image-to-3D Provider Interface
 *
 * Unified interface for all image-to-3D generation backends.
 */

import type { Generated3DObject, GraspPoint, PhysicsConfig } from '../grasp3DUtils';

export type { Generated3DObject, GraspPoint, PhysicsConfig };

export interface ImageTo3DRequest {
  imageSource: string | File;
  objectName?: string;
  scaledBbox?: [number, number, number];
}

export interface ProviderConfig {
  apiKey: string;
}

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface JobStatusResult {
  status: JobStatus;
  progress?: number;
  error?: string;
}

export interface Generated3DResult {
  meshUrl: string;
  object: Generated3DObject;
}

export interface ImageTo3DProvider {
  name: string;
  generate(config: ProviderConfig, request: ImageTo3DRequest): Promise<Generated3DResult>;
  pollStatus?(config: ProviderConfig, jobId: string): Promise<JobStatusResult>;
  validateApiKey?(apiKey: string): Promise<boolean>;
}
