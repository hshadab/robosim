/**
 * Rodin (Hyper3D) Image-to-3D Integration
 *
 * Converts photos of real objects into 3D models for robot training:
 * - Upload image → Generate 3D mesh via Rodin API
 * - Fast generation (~70s for Regular, ~20s for Sketch)
 * - Auto-generate collision mesh for physics
 * - Estimate grasp points from geometry
 *
 * API Docs: https://developer.hyper3d.ai/api-specification/rodin-generation
 */

import {
  estimateGraspPoints,
  estimatePhysicsConfig,
  imageFileToBase64,
  type GraspPoint,
  type PhysicsConfig,
  type Generated3DObject,
} from './grasp3DUtils';

export type { GraspPoint, PhysicsConfig, Generated3DObject };
export { estimateGraspPoints, estimatePhysicsConfig, imageFileToBase64 };

export interface RodinConfig {
  apiKey: string;
}

export interface RodinImageTo3DRequest {
  imageSource: string | File;
  objectName?: string;
  tier?: 'Sketch' | 'Regular' | 'Detail' | 'Smooth';
  quality?: 'high' | 'medium' | 'low' | 'extra-low';
  material?: 'PBR' | 'Shaded';
  meshMode?: 'Quad' | 'Raw';
  scaledBbox?: [number, number, number];
}

export interface RodinSession {
  uuid: string;
  jobs: {
    uuids: string[];
    subscription_key: string;
  };
  error?: string | null;
  message?: string;
}

export interface RodinJobStatus {
  uuid: string;
  status: 'Pending' | 'Processing' | 'Done' | 'Failed';
  progress?: number;
  error?: string;
}

export interface RodinDownloadResult {
  list: Array<{
    name: string;
    url: string;
  }>;
}

// Use Vite proxy in development to bypass CORS
const RODIN_API_BASE = '/api/rodin';

export async function createRodinSession(
  config: RodinConfig,
  request: RodinImageTo3DRequest
): Promise<RodinSession> {
  const formData = new FormData();

  // Handle image - either File or base64
  if (request.imageSource instanceof File) {
    formData.append('images', request.imageSource);
  } else if (typeof request.imageSource === 'string') {
    // Convert base64 to blob
    const base64Data = request.imageSource.split(',')[1] || request.imageSource;
    const byteString = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    formData.append('images', blob, 'image.jpg');
  }

  // Add optional parameters
  if (request.tier) {
    formData.append('tier', request.tier);
  }
  if (request.quality) {
    formData.append('quality', request.quality);
  }
  if (request.material) {
    formData.append('material', request.material);
  }
  if (request.meshMode) {
    formData.append('mesh_mode', request.meshMode);
  }
  if (request.scaledBbox) {
    formData.append('bbox_condition', JSON.stringify(request.scaledBbox));
  }

  // Request GLB format
  formData.append('geometry_file_format', 'glb');

  const response = await fetch(`${RODIN_API_BASE}/rodin`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Rodin] API error:', error);
    throw new Error('Rodin API error: ' + error);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error('Rodin error: ' + result.error);
  }

  return result;
}

export async function checkJobStatus(
  config: RodinConfig,
  subscriptionKey: string
): Promise<RodinJobStatus[]> {
  const response = await fetch(`${RODIN_API_BASE}/status`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription_key: subscriptionKey,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Rodin status error: ' + error);
  }

  return response.json();
}

export async function downloadResult(
  config: RodinConfig,
  taskUuid: string
): Promise<RodinDownloadResult> {
  const response = await fetch(`${RODIN_API_BASE}/download`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task_uuid: taskUuid,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('Rodin download error: ' + error);
  }

  return response.json();
}

export async function waitForSession(
  config: RodinConfig,
  session: RodinSession,
  onProgress?: (status: string, progress: number) => void,
  maxWaitMs: number = 300000
): Promise<RodinDownloadResult> {
  const startTime = Date.now();
  const pollInterval = 2000; // Rodin is faster, poll every 2s

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const statuses = await checkJobStatus(config, session.jobs.subscription_key);
      const elapsed = Date.now() - startTime;

      // Find the main generation job status
      const mainJob = statuses[0];

      if (mainJob) {
        const progressPercent = mainJob.progress || (elapsed / 120000) * 100;
        onProgress?.(mainJob.status, Math.min(95, progressPercent));

        if (mainJob.status === 'Done') {
          // Get download links
          const result = await downloadResult(config, session.jobs.uuids[0]);
          return result;
        }

        if (mainJob.status === 'Failed') {
          console.error('[Rodin] Generation failed:', mainJob.error);
          throw new Error('Generation failed: ' + (mainJob.error || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error('[Rodin] Poll error:', err);
      // Continue polling on network errors
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for 3D generation');
}

export async function generateTrainableObject(
  config: RodinConfig,
  imageSource: string | File,
  options: Partial<RodinImageTo3DRequest> = {},
  onProgress?: (phase: string, progress: number, message: string) => void
): Promise<Generated3DObject> {
  onProgress?.('preparing', 0, 'Preparing image...');

  onProgress?.('uploading', 10, 'Uploading to Rodin...');

  const session = await createRodinSession(config, {
    imageSource,
    tier: options.tier || 'Regular',
    quality: options.quality || 'medium',
    material: options.material || 'PBR',
    meshMode: options.meshMode || 'Quad',
    scaledBbox: options.scaledBbox,
    ...options,
  });

  onProgress?.('generating', 20, 'Generating 3D model...');

  const downloadFiles = await waitForSession(
    config,
    session,
    (status, progress) => {
      const adjustedProgress = Math.min(90, 20 + (progress * 0.7));
      onProgress?.('generating', adjustedProgress, `${status}... (${Math.round(progress)}%)`);
    }
  );

  onProgress?.('processing', 92, 'Processing mesh...');

  const files = downloadFiles.list || [];

  // Find GLB file
  const glbFile = files.find((f) => f.name?.endsWith('.glb') || f.url?.includes('.glb'));
  const objFile = files.find((f) => f.name?.endsWith('.obj') || f.url?.includes('.obj'));
  const fbxFile = files.find((f) => f.name?.endsWith('.fbx') || f.url?.includes('.fbx'));

  if (!glbFile || !glbFile.url) {
    console.error('[Rodin] No GLB file found. Available files:', files);
    throw new Error('No GLB mesh in response. Available: ' + files.map((f) => f.name || 'unknown').join(', '));
  }

  onProgress?.('analyzing', 95, 'Analyzing for robot training...');

  const dimensions: [number, number, number] = options.scaledBbox || [0.1, 0.1, 0.1];
  const graspPoints = estimateGraspPoints(dimensions, options.objectName);
  const physicsConfig = estimatePhysicsConfig(dimensions, options.objectName);

  onProgress?.('complete', 100, 'Object ready for training!');

  return {
    sessionId: session.uuid,
    name: options.objectName || 'generated_object',
    meshUrl: glbFile.url,
    objUrl: objFile?.url,
    fbxUrl: fbxFile?.url,
    dimensions,
    graspPoints,
    physicsConfig,
  };
}

export async function validateRodinApiKey(apiKey: string): Promise<boolean> {
  // Rodin API keys are Bearer tokens
  // Basic format validation - real validation happens on first use
  if (!apiKey || apiKey.length < 20) {
    return false;
  }

  // Accept various API key formats
  const apiKeyPattern = /^[a-zA-Z0-9_-]{20,}$/;
  return apiKeyPattern.test(apiKey);
}
