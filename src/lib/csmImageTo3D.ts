/**
 * CSM (Common Sense Machines) Image-to-3D Integration
 *
 * Converts photos of real objects into 3D models for robot training:
 * - Upload image → Generate 3D mesh via CSM API
 * - Auto-generate collision mesh for physics
 * - Estimate grasp points from geometry
 * - Create training-ready objects for the simulator
 *
 * API Docs: https://docs.csm.ai/sessions/image-to-3d
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

export interface CSMConfig {
  apiKey: string;
}

export interface ImageTo3DRequest {
  imageSource: string;
  objectName?: string;
  geometryModel?: 'base' | 'turbo' | 'highest' | 'parts';
  textureModel?: 'none' | 'baked' | 'pbr';
  resolution?: number;
  scaledBbox?: [number, number, number];
  symmetry?: 'auto' | 'on' | 'off';
}

export interface CSMSession {
  _id: string;
  status: 'incomplete' | 'pending' | 'complete' | 'failed';
  output?: {
    meshes: Array<{
      format: string;
      url: string;
    }>;
  };
  error_code?: string;
  status_message?: string;
  created_at: string;
  updated_at: string;
}

// Use Vite proxy in development to bypass CORS
// In production, deploy with a backend proxy or serverless function
const CSM_API_BASE = '/api/csm';

export async function createImageTo3DSession(
  config: CSMConfig,
  request: ImageTo3DRequest
): Promise<CSMSession> {
  const response = await fetch(`${CSM_API_BASE}/sessions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
    },
    body: JSON.stringify({
      type: 'image_to_3d',
      input: {
        image: request.imageSource,
        settings: {
          geometry_model: request.geometryModel || 'base',
          texture_model: request.textureModel || 'baked',
          resolution: request.resolution || 50000,
          symmetry: request.symmetry || 'auto',
          ...(request.scaledBbox && {
            scaled_bbox: request.scaledBbox,
            preserve_aspect_ratio: true,
          }),
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('CSM API error: ' + error);
  }

  return response.json();
}

export async function getSessionStatus(
  config: CSMConfig,
  sessionId: string
): Promise<CSMSession> {
  const response = await fetch(`${CSM_API_BASE}/sessions/${sessionId}`, {
    headers: { 'X-API-KEY': config.apiKey },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error('CSM API error: ' + error);
  }

  return response.json();
}

export async function waitForSession(
  config: CSMConfig,
  sessionId: string,
  onProgress?: (status: string, elapsed: number) => void,
  maxWaitMs: number = 600000 // 10 minutes - CSM can be slow
): Promise<CSMSession> {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const session = await getSessionStatus(config, sessionId);
      const elapsed = Date.now() - startTime;

      onProgress?.(session.status, elapsed);

      if (session.status === 'complete') {
        return session;
      }

      if (session.status === 'failed') {
        console.error('[CSM] Generation failed:', session.status_message || session.error_code);
        throw new Error('Generation failed: ' + (session.status_message || session.error_code));
      }
    } catch (err) {
      console.error('[CSM] Poll error:', err);
      // Continue polling on network errors
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for 3D generation');
}

export async function generateTrainableObject(
  config: CSMConfig,
  imageSource: string | File,
  options: Partial<ImageTo3DRequest> = {},
  onProgress?: (phase: string, progress: number, message: string) => void
): Promise<Generated3DObject> {
  onProgress?.('preparing', 0, 'Preparing image...');

  let imageData: string;
  if (imageSource instanceof File) {
    imageData = await imageFileToBase64(imageSource);
  } else {
    imageData = imageSource;
  }

  onProgress?.('uploading', 10, 'Uploading to CSM...');

  const session = await createImageTo3DSession(config, {
    imageSource: imageData,
    geometryModel: options.geometryModel || 'base',
    textureModel: options.textureModel || 'baked',
    resolution: options.resolution || 30000,
    scaledBbox: options.scaledBbox,
    symmetry: options.symmetry || 'auto',
    ...options,
  });

  onProgress?.('generating', 20, 'Generating 3D model...');

  const completedSession = await waitForSession(
    config,
    session._id,
    (_status, elapsed) => {
      const progress = Math.min(90, 20 + (elapsed / 120000) * 70);
      onProgress?.('generating', progress, 'Generating... (' + Math.round(elapsed / 1000) + 's)');
    }
  );

  onProgress?.('processing', 92, 'Processing mesh...');

  const meshes = completedSession.output?.meshes || [];

  // Safely find meshes with null checks
  const glbMesh = meshes.find((m) => m.format === 'glb' || (m.url && m.url.endsWith('.glb')));
  const objMesh = meshes.find((m) => m.format === 'obj' || (m.url && m.url.endsWith('.obj')));
  const fbxMesh = meshes.find((m) => m.format === 'fbx' || (m.url && m.url.endsWith('.fbx')));

  if (!glbMesh || !glbMesh.url) {
    console.error('[CSM] No GLB mesh found. Available meshes:', meshes);
    throw new Error('No GLB mesh in response. Available: ' + meshes.map(m => m.format || 'unknown').join(', '));
  }

  onProgress?.('analyzing', 93, 'Analyzing mesh geometry...');

  // Try to analyze actual mesh dimensions
  let dimensions: [number, number, number] = options.scaledBbox || [0.1, 0.1, 0.1];
  let analyzedBounds: Generated3DObject['boundingBox'] | undefined;

  try {
    const { analyzeGLBMesh } = await import('./grasp3DUtils');
    const meshAnalysis = await analyzeGLBMesh(glbMesh.url);

    // Use analyzed dimensions if user didn't specify
    if (!options.scaledBbox) {
      const maxDim = Math.max(...meshAnalysis.dimensions);
      const targetSize = 0.1; // 10cm
      const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
      dimensions = meshAnalysis.dimensions.map(d => d * scaleFactor) as [number, number, number];
    }

    analyzedBounds = meshAnalysis.boundingBox;
    onProgress?.('analyzing', 96, `Mesh: ${meshAnalysis.meshCount} meshes, ${meshAnalysis.vertexCount} vertices`);
  } catch (err) {
    console.warn('[CSM] Could not analyze mesh, using defaults:', err);
  }

  onProgress?.('analyzing', 98, 'Estimating grasp points...');

  const graspPoints = estimateGraspPoints(dimensions, options.objectName);
  const physicsConfig = estimatePhysicsConfig(dimensions, options.objectName);

  onProgress?.('complete', 100, 'Object ready for training!');

  return {
    sessionId: session._id,
    name: options.objectName || 'generated_object',
    meshUrl: glbMesh.url,
    objUrl: objMesh?.url,
    fbxUrl: fbxMesh?.url,
    dimensions,
    graspPoints,
    physicsConfig,
    boundingBox: analyzedBounds,
  };
}

export async function validateCSMApiKey(apiKey: string): Promise<boolean> {
  // CSM API doesn't support CORS, so we can't validate from browser
  // Instead, check if the key looks valid (32 hex characters)
  // Real validation happens when user tries to generate

  if (!apiKey || apiKey.length < 20) {
    return false;
  }

  // CSM API keys are typically 32 character hex strings
  const hexPattern = /^[a-fA-F0-9]{32}$/;
  if (hexPattern.test(apiKey)) {
    return true;
  }

  // Also accept other formats that look like API keys
  const apiKeyPattern = /^[a-zA-Z0-9_-]{20,}$/;
  return apiKeyPattern.test(apiKey);

}
