/**
 * Camera Capture Service
 *
 * Captures frames from the robot camera for training data recording.
 * Converts Three.js render target textures to base64 images.
 */

import * as THREE from 'three';
import { loggers } from './logger';

const log = loggers.video;

export interface CapturedFrame {
  timestamp: number;
  imageData: string; // base64 encoded JPEG
  resolution: [number, number];
  cameraPosition: 'gripper' | 'base' | 'overhead';
}

// Global reference to the camera capture callback
let captureCallback: ((frame: CapturedFrame) => void) | null = null;
let captureInterval: number | null = null;
let isCapturing = false;

// Store for the WebGL renderer and render target
let cachedRenderer: THREE.WebGLRenderer | null = null;
let cachedRenderTarget: THREE.WebGLRenderTarget | null = null;

/**
 * Register the WebGL renderer for frame capture
 */
export function registerRenderer(renderer: THREE.WebGLRenderer): void {
  cachedRenderer = renderer;
  log.debug('Renderer registered for camera capture');
}

/**
 * Register the render target for frame capture
 */
export function registerRenderTarget(target: THREE.WebGLRenderTarget): void {
  cachedRenderTarget = target;
  log.debug('Render target registered for camera capture');
}

/**
 * Start capturing frames at the specified interval
 */
export function startCapture(
  callback: (frame: CapturedFrame) => void,
  intervalMs = 33, // ~30 FPS
  cameraPosition: 'gripper' | 'base' | 'overhead' = 'overhead'
): void {
  if (isCapturing) {
    log.warn('Camera capture already in progress');
    return;
  }

  captureCallback = callback;
  isCapturing = true;

  log.info('Started camera capture', { intervalMs, cameraPosition });

  captureInterval = window.setInterval(() => {
    if (!cachedRenderer || !cachedRenderTarget || !captureCallback) {
      return;
    }

    try {
      const frame = captureFrame(cameraPosition);
      if (frame) {
        captureCallback(frame);
      }
    } catch (error) {
      log.error('Failed to capture frame', { error });
    }
  }, intervalMs);
}

/**
 * Stop capturing frames
 */
export function stopCapture(): void {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  captureCallback = null;
  isCapturing = false;
  log.info('Stopped camera capture');
}

/**
 * Check if capture is active
 */
export function isCaptureActive(): boolean {
  return isCapturing;
}

/**
 * Capture a single frame from the render target
 */
export function captureFrame(
  cameraPosition: 'gripper' | 'base' | 'overhead' = 'overhead'
): CapturedFrame | null {
  if (!cachedRenderer || !cachedRenderTarget) {
    return null;
  }

  const width = cachedRenderTarget.width;
  const height = cachedRenderTarget.height;

  // Read pixels from render target
  const buffer = new Uint8Array(width * height * 4);
  cachedRenderer.readRenderTargetPixels(
    cachedRenderTarget,
    0,
    0,
    width,
    height,
    buffer
  );

  // Convert to ImageData and flip vertically (WebGL is bottom-up)
  const imageData = new ImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((height - 1 - y) * width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      imageData.data[dstIdx] = buffer[srcIdx];     // R
      imageData.data[dstIdx + 1] = buffer[srcIdx + 1]; // G
      imageData.data[dstIdx + 2] = buffer[srcIdx + 2]; // B
      imageData.data[dstIdx + 3] = 255; // A (full opacity)
    }
  }

  // Convert to base64 JPEG
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.putImageData(imageData, 0, 0);

  // Compress as JPEG for smaller file size
  const base64 = canvas.toDataURL('image/jpeg', 0.85);

  return {
    timestamp: Date.now(),
    imageData: base64,
    resolution: [width, height],
    cameraPosition,
  };
}

/**
 * Capture frame from a canvas element directly
 * (Alternative method when render target is not available)
 */
export function captureFromCanvas(
  canvas: HTMLCanvasElement,
  cameraPosition: 'gripper' | 'base' | 'overhead' = 'overhead'
): CapturedFrame | null {
  try {
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    return {
      timestamp: Date.now(),
      imageData: base64,
      resolution: [canvas.width, canvas.height],
      cameraPosition,
    };
  } catch (error) {
    log.error('Failed to capture from canvas', { error });
    return null;
  }
}

/**
 * Resize and compress an image for efficient storage
 */
export function compressImage(
  base64: string,
  maxWidth = 320,
  maxHeight = 240,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = base64;
  });
}
