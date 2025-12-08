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

export interface Generated3DObject {
  sessionId: string;
  name: string;
  meshUrl: string;
  objUrl?: string;
  fbxUrl?: string;
  thumbnailUrl?: string;
  dimensions: [number, number, number];
  graspPoints: GraspPoint[];
  physicsConfig: PhysicsConfig;
}

export interface GraspPoint {
  position: [number, number, number];
  normal: [number, number, number];
  graspType: 'pinch' | 'power' | 'hook';
  confidence: number;
}

export interface PhysicsConfig {
  mass: number;
  friction: number;
  restitution: number;
  collisionShape: 'box' | 'sphere' | 'convex' | 'mesh';
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

  console.log('[fal.ai] Generating 3D model from:', imageUrl.substring(0, 50) + '...');

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
  console.log('[fal.ai] Generation complete:', result);
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
    // Fallback: try using data URL directly
    console.log('[fal.ai] Upload init failed, using data URL fallback');
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

export function estimateGraspPoints(
  dimensions: [number, number, number],
  _objectType?: string
): GraspPoint[] {
  const [width, height, depth] = dimensions;
  const graspPoints: GraspPoint[] = [];

  const maxDim = Math.max(width, height, depth);
  const minDim = Math.min(width, height, depth);
  const aspectRatio = maxDim / minDim;

  if (aspectRatio > 3) {
    graspPoints.push({
      position: [0, -height * 0.3, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.9,
    });
    graspPoints.push({
      position: [0, height * 0.4, 0],
      normal: [1, 0, 0],
      graspType: 'pinch',
      confidence: 0.7,
    });
  } else if (aspectRatio < 1.5) {
    graspPoints.push({
      position: [width * 0.4, 0, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.85,
    });
    graspPoints.push({
      position: [-width * 0.4, 0, 0],
      normal: [-1, 0, 0],
      graspType: 'power',
      confidence: 0.85,
    });
  } else {
    graspPoints.push({
      position: [0, 0, 0],
      normal: [1, 0, 0],
      graspType: 'power',
      confidence: 0.8,
    });
    graspPoints.push({
      position: [0, height * 0.3, 0],
      normal: [0, 1, 0],
      graspType: 'pinch',
      confidence: 0.7,
    });
  }

  return graspPoints;
}

export function estimatePhysicsConfig(
  dimensions: [number, number, number],
  _objectType?: string
): PhysicsConfig {
  const [width, height, depth] = dimensions;
  const volume = width * height * depth;

  const density = 800;
  const mass = Math.max(0.01, Math.min(5, volume * density));

  const aspectRatio = Math.max(width, height, depth) / Math.min(width, height, depth);
  let collisionShape: PhysicsConfig['collisionShape'] = 'convex';

  if (aspectRatio < 1.3) {
    collisionShape = 'box';
  }

  return {
    mass,
    friction: 0.5,
    restitution: 0.2,
    collisionShape,
  };
}

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

  onProgress?.('processing', 90, 'Processing mesh...');

  if (!result.model_mesh?.url) {
    throw new Error('No mesh URL in response');
  }

  onProgress?.('analyzing', 95, 'Analyzing for robot training...');

  const dimensions: [number, number, number] = options.scaledBbox || [0.1, 0.1, 0.1];
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
