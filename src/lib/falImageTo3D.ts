/**
 * fal.ai TripoSR Image-to-3D Integration
 *
 * Fast, cheap image-to-3D using TripoSR model hosted on fal.ai:
 * - ~10-30 second generation time
 * - $0.07 per generation (pay-per-use)
 * - High quality output
 *
 * API Docs: https://fal.ai/models/fal-ai/triposr
 */

import {
  estimateGraspPoints,
  estimatePhysicsConfig,
  type GraspPoint,
  type PhysicsConfig,
  type Generated3DObject,
} from './grasp3DUtils';

export type { GraspPoint, PhysicsConfig, Generated3DObject };

export interface FalConfig {
  apiKey: string;
}

export interface FalImageTo3DRequest {
  imageSource: string | File;
  objectName?: string;
  outputFormat?: 'glb' | 'obj';
  removeBackground?: boolean;
  foregroundRatio?: number;
  mcResolution?: number;
  scaledBbox?: [number, number, number];
}

export interface FalResult {
  model_mesh: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
  };
}

// fal.ai API endpoint
const FAL_API_BASE = 'https://fal.run/fal-ai/triposr';

export async function generateWithFal(
  config: FalConfig,
  request: FalImageTo3DRequest
): Promise<FalResult> {
  let imageUrl: string;

  // If it's a File or base64, we need to upload it first
  if (request.imageSource instanceof File) {
    imageUrl = await uploadToFal(config, request.imageSource);
  } else if (request.imageSource.startsWith('data:')) {
    // Convert base64 to blob and upload
    const blob = base64ToBlob(request.imageSource);
    imageUrl = await uploadToFal(config, blob);
  } else {
    imageUrl = request.imageSource;
  }

  const response = await fetch(FAL_API_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      output_format: request.outputFormat || 'glb',
      do_remove_background: request.removeBackground !== false,
      foreground_ratio: request.foregroundRatio || 0.9,
      mc_resolution: request.mcResolution || 256,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[fal.ai] API error:', error);
    throw new Error('fal.ai API error: ' + error);
  }

  const result = await response.json();
  return result;
}

async function uploadToFal(config: FalConfig, file: File | Blob): Promise<string> {
  // Get upload URL from fal.ai
  const initResponse = await fetch('https://fal.run/fal-ai/triposr/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content_type: file.type || 'image/jpeg',
      file_name: file instanceof File ? file.name : 'image.jpg',
    }),
  });

  if (!initResponse.ok) {
    // Fallback: use data URL directly
    if (file instanceof File) {
      return await fileToDataUrl(file);
    }
    return await blobToDataUrl(file);
  }

  const { upload_url, file_url } = await initResponse.json();

  // Upload the file
  await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
  });

  return file_url;
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const data = atob(parts[1]);
  const array = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    array[i] = data.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { estimateGraspPoints, estimatePhysicsConfig };

export async function generateTrainableObject(
  config: FalConfig,
  imageSource: string | File,
  options: Partial<FalImageTo3DRequest> = {},
  onProgress?: (phase: string, progress: number, message: string) => void
): Promise<Generated3DObject> {
  onProgress?.('preparing', 0, 'Preparing image...');

  onProgress?.('uploading', 10, 'Uploading to fal.ai...');

  onProgress?.('generating', 30, 'Generating 3D model (~10-30s)...');

  const result = await generateWithFal(config, {
    imageSource,
    outputFormat: 'glb',
    removeBackground: true,
    foregroundRatio: 0.9,
    mcResolution: 256,
    ...options,
  });

  onProgress?.('processing', 85, 'Processing mesh...');

  if (!result.model_mesh?.url) {
    throw new Error('No mesh URL in response');
  }

  onProgress?.('analyzing', 90, 'Analyzing mesh geometry...');

  // Try to analyze actual mesh dimensions
  let dimensions: [number, number, number] = options.scaledBbox || [0.1, 0.1, 0.1];
  let analyzedBounds: Generated3DObject['boundingBox'] | undefined;

  try {
    const { analyzeGLBMesh } = await import('./grasp3DUtils');
    const meshAnalysis = await analyzeGLBMesh(result.model_mesh.url);

    // Use analyzed dimensions if user didn't specify
    if (!options.scaledBbox) {
      // Scale to reasonable size (target ~10cm for largest dimension)
      const maxDim = Math.max(...meshAnalysis.dimensions);
      const targetSize = 0.1; // 10cm
      const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
      dimensions = meshAnalysis.dimensions.map(d => d * scaleFactor) as [number, number, number];
    }

    analyzedBounds = meshAnalysis.boundingBox;
    onProgress?.('analyzing', 95, `Mesh: ${meshAnalysis.meshCount} meshes, ${meshAnalysis.vertexCount} vertices`);
  } catch (err) {
    console.warn('[fal.ai] Could not analyze mesh, using defaults:', err);
  }

  onProgress?.('analyzing', 97, 'Estimating grasp points...');

  const graspPoints = estimateGraspPoints(dimensions, options.objectName);
  const physicsConfig = estimatePhysicsConfig(dimensions, options.objectName);

  onProgress?.('complete', 100, 'Object ready for training!');

  return {
    sessionId: 'fal-' + Date.now(),
    name: options.objectName || 'generated_object',
    meshUrl: result.model_mesh.url,
    dimensions,
    graspPoints,
    physicsConfig,
    boundingBox: analyzedBounds,
  };
}

export async function validateFalApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || apiKey.length < 10) {
    return false;
  }
  // fal.ai keys look like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxx
  // or just alphanumeric strings
  return /^[a-zA-Z0-9_:-]{20,}$/.test(apiKey);
}
